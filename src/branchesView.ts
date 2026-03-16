import * as vscode from "vscode";
import { type GitBranch, getGitBranchData } from "./git";

type BranchNodeType =
  | "repository"
  | "group"
  | "pathGroup"
  | "branch"
  | "message";
type BranchKind = "local" | "remote" | null;
export type BranchSortMode = "name" | "updated";
export type BranchViewMode = "list" | "grouped";

interface BranchViewState {
  sortMode?: BranchSortMode;
  viewMode?: BranchViewMode;
  prioritizeDisconnectedBranches?: boolean;
  branchFilter?: string;
}

const REPOSITORY_LABEL = "Repository";
const LOCAL_BRANCHES_LABEL = "Local";
const REMOTE_BRANCHES_LABEL = "Remote";

export class BranchesViewProvider implements vscode.TreeDataProvider<BranchTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    BranchTreeItem | undefined | void
  >();
  private sortMode: BranchSortMode = "updated";
  private viewMode: BranchViewMode = "list";
  private prioritizeDisconnectedBranches = true;
  private branchFilter = "";

  constructor(state?: BranchViewState) {
    if (state?.sortMode) {
      this.sortMode = state.sortMode;
    }

    if (state?.viewMode) {
      this.viewMode = state.viewMode;
    }

    if (typeof state?.prioritizeDisconnectedBranches === "boolean") {
      this.prioritizeDisconnectedBranches = state.prioritizeDisconnectedBranches;
    }

    if (typeof state?.branchFilter === "string") {
      this.branchFilter = state.branchFilter.trim().toLocaleLowerCase();
    }
  }

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  setSortMode(sortMode: BranchSortMode): void {
    this.sortMode = sortMode;
    this.refresh();
  }

  getSortMode(): BranchSortMode {
    return this.sortMode;
  }

  getSortDescription(): string {
    return this.sortMode === "name" ? "Name" : "Updated";
  }

  getFilterDescription(): string | null {
    if (!this.branchFilter) {
      return null;
    }

    return `Filter: ${this.branchFilter}`;
  }

  setViewMode(viewMode: BranchViewMode): void {
    this.viewMode = viewMode;
    this.refresh();
  }

  getViewMode(): BranchViewMode {
    return this.viewMode;
  }

  setPrioritizeDisconnectedBranches(enabled: boolean): void {
    this.prioritizeDisconnectedBranches = enabled;
    this.refresh();
  }

  getPrioritizeDisconnectedBranches(): boolean {
    return this.prioritizeDisconnectedBranches;
  }

  setBranchFilter(filter: string): void {
    this.branchFilter = filter.trim().toLocaleLowerCase();
    this.refresh();
  }

  clearBranchFilter(): void {
    this.branchFilter = "";
    this.refresh();
  }

  getBranchFilter(): string {
    return this.branchFilter;
  }

  getTreeItem(element: BranchTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BranchTreeItem): Promise<BranchTreeItem[]> {
    const data = await getGitBranchData();

    if (!element) {
      if (data.workspaceStatus === "noWorkspace") {
        return [
          new BranchTreeItem(
            "Open a folder to use Git Branch Panel.",
            "message",
            vscode.TreeItemCollapsibleState.None,
            "Open a workspace folder, then open Source Control again.",
          ),
        ];
      }

      if (data.workspaceStatus === "notGitRepository" || !data.repositoryName || !data.repositoryPath) {
        return [
          new BranchTreeItem(
            "Current folder is not a Git repository.",
            "message",
            vscode.TreeItemCollapsibleState.None,
            "Initialize Git here or open a different repository folder.",
          ),
        ];
      }

      return [
        new BranchTreeItem(
          data.repositoryName,
          "repository",
          vscode.TreeItemCollapsibleState.Expanded,
        ),
      ];
    }

    if (element.nodeType === "repository") {
      const remoteLabel = getRemoteGroupLabel(data.remoteName);

      const localGroup = new BranchTreeItem(
        LOCAL_BRANCHES_LABEL,
        "group",
        vscode.TreeItemCollapsibleState.Expanded,
      );
      localGroup.contextValue = "localGroup";

      const remoteGroup = new BranchTreeItem(
        remoteLabel,
        "group",
        vscode.TreeItemCollapsibleState.Expanded,
      );
      remoteGroup.contextValue = "remoteGroup";

      return [localGroup, remoteGroup];
    }

    if (element.nodeType === "group") {
      const isLocalBranchGroup = element.label === LOCAL_BRANCHES_LABEL;
      const branchKind = isLocalBranchGroup ? "local" : "remote";

      if (!isLocalBranchGroup) {
        if (data.remoteStatus === "noRemote") {
          return [
            new BranchTreeItem(
              "No remote configured.",
              "message",
              vscode.TreeItemCollapsibleState.None,
              "Add a remote such as origin to browse and fetch remote branches.",
            ),
          ];
        }

        if (data.remoteStatus === "loadFailed") {
          return [
            new BranchTreeItem(
              "Couldn't load remote branches.",
              "message",
              vscode.TreeItemCollapsibleState.None,
              data.remoteErrorMessage ??
                "Check your network connection or Git authentication, then try again.",
            ),
          ];
        }
      }

      const branches = isLocalBranchGroup
        ? sortLocalBranches(
            data.localBranches,
            data.currentBranch,
            this.sortMode,
            this.prioritizeDisconnectedBranches,
          )
        : sortBranches(data.remoteBranches, this.sortMode);
      const filteredBranches = filterBranches(
        branches,
        branchKind,
        this.branchFilter,
      );

      if (filteredBranches.length === 0) {
        return [
          new BranchTreeItem(
            this.branchFilter
              ? `No ${branchKind} branches match "${this.branchFilter}".`
              : getEmptyBranchMessage(branchKind),
            "message",
            vscode.TreeItemCollapsibleState.None,
            this.branchFilter
              ? `Clear the search or try a different branch name.`
              : getEmptyBranchDescription(branchKind),
          ),
        ];
      }

      if (this.viewMode === "grouped") {
        if (isLocalBranchGroup && data.currentBranch) {
          const currentBranch = filteredBranches.find(
            (branch) => branch.name === data.currentBranch,
          );
          const otherBranches = filteredBranches.filter(
            (branch) => branch.name !== data.currentBranch,
          );

          if (currentBranch) {
            return [
              createBranchItem(
                currentBranch,
                "local",
                data.currentBranch,
                currentBranch.name,
              ),
              ...buildGroupedBranchItems(
                otherBranches,
                "local",
                data.currentBranch,
                null,
              ),
            ];
          }
        }

        return buildGroupedBranchItems(
          filteredBranches,
          isLocalBranchGroup ? "local" : "remote",
          data.currentBranch,
          null,
        );
      }

      return filteredBranches.map((branch) =>
        createBranchItem(
          branch,
          isLocalBranchGroup ? "local" : "remote",
          data.currentBranch,
        ),
      );
    }

    if (element.nodeType === "pathGroup") {
      const branchKind = element.branchKind === "local" ? "local" : "remote";
      const isLocalBranchGroup = branchKind === "local";
      const branches = isLocalBranchGroup
        ? sortLocalBranches(
            data.localBranches,
            data.currentBranch,
            this.sortMode,
            this.prioritizeDisconnectedBranches,
          )
        : sortBranches(data.remoteBranches, this.sortMode);
      const filteredBranches = filterBranches(
        branches,
        branchKind,
        this.branchFilter,
      );

      return buildGroupedBranchItems(
        filteredBranches,
        branchKind,
        data.currentBranch,
        element.pathPrefix ?? null,
      );
    }

    return [];
  }
}

class BranchTreeItem extends vscode.TreeItem {
  public fullBranchName?: string;
  public pathPrefix?: string;
  public hasUpstream?: boolean;
  public upstreamName?: string | null;
  public needsPush?: boolean;

  constructor(
    public readonly label: string,
    public readonly nodeType: BranchNodeType,
    collapsibleState: vscode.TreeItemCollapsibleState,
    description?: string,
    public readonly branchKind: BranchKind = null,
  ) {
    super(label, collapsibleState);
    this.description = description;

    if (nodeType === "repository") {
      this.iconPath = new vscode.ThemeIcon("repo");
      this.tooltip = description ? `${label}\n${description}` : label;
      return;
    }

    if (nodeType === "group") {
      this.iconPath = getGroupIcon(label);
      return;
    }

    if (nodeType === "pathGroup") {
      this.iconPath = new vscode.ThemeIcon("folder");
      return;
    }

    if (nodeType === "branch") {
      this.iconPath = new vscode.ThemeIcon("git-branch");
      return;
    }

    this.iconPath = new vscode.ThemeIcon("info");
  }
}

function getGroupIcon(label: string): vscode.ThemeIcon {
  if (label === LOCAL_BRANCHES_LABEL) {
    return new vscode.ThemeIcon("device-desktop");
  }

  if (label.startsWith(REMOTE_BRANCHES_LABEL)) {
    return new vscode.ThemeIcon("cloud");
  }

  return new vscode.ThemeIcon("list-tree");
}

function sortLocalBranches(
  branches: GitBranch[],
  currentBranch: string | null,
  sortMode: BranchSortMode,
  prioritizeDisconnectedBranches: boolean,
): GitBranch[] {
  if (!currentBranch) {
    return prioritizeDisconnectedBranches
      ? sortBranchesWithDisconnectedFirst(branches, sortMode)
      : sortBranches(branches, sortMode);
  }

  const currentBranches = branches.filter(
    (branch) => branch.name === currentBranch,
  );
  const remainingBranches = branches.filter(
    (branch) => branch.name !== currentBranch,
  );
  const otherBranches = prioritizeDisconnectedBranches
    ? sortBranchesWithDisconnectedFirst(remainingBranches, sortMode)
    : sortBranches(remainingBranches, sortMode);
  return [...currentBranches, ...otherBranches];
}

function sortBranches(
  branches: GitBranch[],
  sortMode: BranchSortMode,
): GitBranch[] {
  const sortedBranches = [...branches];

  sortedBranches.sort((left, right) => {
    if (sortMode === "name") {
      return left.name.localeCompare(right.name);
    }

    const leftTimestamp = left.lastUpdatedAt ?? 0;
    const rightTimestamp = right.lastUpdatedAt ?? 0;

    if (rightTimestamp !== leftTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return left.name.localeCompare(right.name);
  });

  return sortedBranches;
}

function sortBranchesWithDisconnectedFirst(
  branches: GitBranch[],
  sortMode: BranchSortMode,
): GitBranch[] {
  const disconnectedBranches = branches.filter(
    (branch) => !branch.upstreamName,
  );
  const connectedBranches = branches.filter((branch) => branch.upstreamName);

  return [
    ...sortBranches(disconnectedBranches, sortMode),
    ...sortBranches(connectedBranches, sortMode),
  ];
}

function filterBranches(
  branches: GitBranch[],
  branchKind: "local" | "remote",
  branchFilter: string,
): GitBranch[] {
  if (!branchFilter) {
    return branches;
  }

  return branches.filter((branch) => {
    const displayName =
      branchKind === "local" ? branch.name : (branch.shortName ?? branch.name);

    return displayName.toLocaleLowerCase().includes(branchFilter);
  });
}

function buildBranchTooltip(branch: GitBranch): string {
  const upstreamLine = branch.upstreamName
    ? `\nUpstream: ${branch.upstreamName}`
    : "\nUpstream: none";

  if (!branch.lastUpdatedAt) {
    return `${branch.name}${upstreamLine}`;
  }

  const updatedAt = new Date(branch.lastUpdatedAt * 1000).toLocaleString();
  return `${branch.name}\nUpdated: ${updatedAt}${upstreamLine}`;
}

function getRemoteGroupLabel(remoteName: string | null): string {
  return remoteName
    ? `${REMOTE_BRANCHES_LABEL} (${remoteName})`
    : REMOTE_BRANCHES_LABEL;
}

function createBranchItem(
  branch: GitBranch,
  branchKind: "local" | "remote",
  currentBranch: string | null,
  labelOverride?: string,
): BranchTreeItem {
  const item = new BranchTreeItem(
    labelOverride ??
      (branchKind === "local"
        ? branch.name
        : (branch.shortName ?? branch.name)),
    "branch",
    vscode.TreeItemCollapsibleState.None,
    undefined,
    branchKind,
  );

  if (branchKind === "local" && branch.name === currentBranch) {
    item.contextValue = "currentLocalBranch";
    item.fullBranchName = branch.name;
  } else if (branchKind === "local") {
    item.contextValue = "localBranch";
    item.fullBranchName = branch.name;
  } else {
    item.contextValue = "remoteBranch";
    item.fullBranchName = branch.name;
  }

  item.hasUpstream =
    branchKind === "local" ? Boolean(branch.upstreamName) : true;
  item.upstreamName = branch.upstreamName;
  item.needsPush = branchKind === "local" ? needsPush(branch) : false;

  if (branchKind === "local" && !item.hasUpstream) {
    item.contextValue =
      branch.name === currentBranch
        ? "currentDisconnectedLocalBranch"
        : "disconnectedLocalBranch";
  } else if (branchKind === "local" && item.needsPush) {
    item.contextValue =
      branch.name === currentBranch
        ? "currentPushableLocalBranch"
        : "pushableLocalBranch";
  }

  if (branchKind === "local") {
    const markers: string[] = [];

    if (branch.name === currentBranch) {
      markers.push("✨");
    }

    if (item.needsPush) {
      markers.push("☝️");
    }

    const descriptionParts: string[] = [];

    if (branch.upstreamName) {
      descriptionParts.push(`🞵 ${branch.upstreamName}`);
    }

    if (markers.length > 0) {
      descriptionParts.push(markers.join(" "));
    }

    item.description = descriptionParts.join("  ");
  }

  item.iconPath =
    branchKind === "local" && !item.hasUpstream
      ? {
          light: vscode.Uri.joinPath(
            vscode.Uri.file(__dirname),
            "..",
            "media",
            "blank.svg",
          ),
          dark: vscode.Uri.joinPath(
            vscode.Uri.file(__dirname),
            "..",
            "media",
            "blank.svg",
          ),
        }
      : new vscode.ThemeIcon("git-branch");
  item.tooltip = buildBranchTooltip(branch);
  return item;
}

function buildGroupedBranchItems(
  branches: GitBranch[],
  branchKind: "local" | "remote",
  currentBranch: string | null,
  parentPrefix: string | null,
): BranchTreeItem[] {
  const groupedBranches = new Map<string, GitBranch[]>();
  const directBranches: GitBranch[] = [];

  for (const branch of branches) {
    const displayName =
      branchKind === "local" ? branch.name : (branch.shortName ?? branch.name);
    const relativeName = parentPrefix
      ? trimPrefix(displayName, `${parentPrefix}/`)
      : displayName;

    if (
      !relativeName ||
      (relativeName === displayName &&
        parentPrefix &&
        !displayName.startsWith(`${parentPrefix}/`))
    ) {
      continue;
    }

    const slashIndex = relativeName.indexOf("/");
    if (slashIndex === -1) {
      directBranches.push(branch);
      continue;
    }

    const nextSegment = relativeName.slice(0, slashIndex);
    const currentPrefix = parentPrefix
      ? `${parentPrefix}/${nextSegment}`
      : nextSegment;
    groupedBranches.set(currentPrefix, [
      ...(groupedBranches.get(currentPrefix) ?? []),
      branch,
    ]);
  }

  const groupItems = [...groupedBranches.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((prefix) => {
      const label = prefix.split("/").pop() ?? prefix;
      const item = new BranchTreeItem(
        label,
        "pathGroup",
        vscode.TreeItemCollapsibleState.Collapsed,
        String(groupedBranches.get(prefix)?.length ?? 0),
        branchKind,
      );
      item.pathPrefix = prefix;
      item.tooltip = prefix;
      return item;
    });

  const branchItems = directBranches.map((branch) => {
    const displayName =
      branchKind === "local" ? branch.name : (branch.shortName ?? branch.name);
    const label =
      parentPrefix && displayName.startsWith(`${parentPrefix}/`)
        ? displayName.slice(parentPrefix.length + 1)
        : displayName;

    return createBranchItem(branch, branchKind, currentBranch, label);
  });

  return [...groupItems, ...branchItems];
}

function trimPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : "";
}

function needsPush(branch: GitBranch): boolean {
  if (!branch.upstreamName) {
    return true;
  }

  return branch.upstreamTrackShort?.includes(">") ?? false;
}

function getEmptyBranchMessage(branchKind: "local" | "remote"): string {
  if (branchKind === "local") {
    return "No local branches found.";
  }

  return "No remote branches found.";
}

function getEmptyBranchDescription(branchKind: "local" | "remote"): string {
  if (branchKind === "local") {
    return "Create a branch or check out an existing branch to get started.";
  }

  return "Run Fetch Remote Branches after adding a remote, or push a branch to publish one.";
}
