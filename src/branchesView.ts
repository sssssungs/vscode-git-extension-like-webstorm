import * as vscode from "vscode";
import { type GitBranch, getGitBranchData } from "./git";

type BranchNodeType = "repository" | "group" | "pathGroup" | "branch" | "message";
type BranchKind = "local" | "remote" | null;
export type BranchSortMode = "name" | "updated";
export type BranchViewMode = "list" | "grouped";

const REPOSITORY_LABEL = "Repository";
const LOCAL_BRANCHES_LABEL = "Local";
const REMOTE_BRANCHES_LABEL = "Remote";

export class BranchesViewProvider implements vscode.TreeDataProvider<BranchTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    BranchTreeItem | undefined | void
  >();
  private sortMode: BranchSortMode = "updated";
  private viewMode: BranchViewMode = "list";

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

  setViewMode(viewMode: BranchViewMode): void {
    this.viewMode = viewMode;
    this.refresh();
  }

  getViewMode(): BranchViewMode {
    return this.viewMode;
  }

  getTreeItem(element: BranchTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BranchTreeItem): Promise<BranchTreeItem[]> {
    const data = await getGitBranchData();

    if (!element) {
      if (!data.repositoryName || !data.repositoryPath) {
        return [
          new BranchTreeItem(
            "No Git repository found in the current folder.",
            "message",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }

      return [
        new BranchTreeItem(
          data.repositoryName,
          "repository",
          vscode.TreeItemCollapsibleState.Expanded,
          data.repositoryPath,
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
      const branches = isLocalBranchGroup
        ? sortLocalBranches(data.localBranches, data.currentBranch, this.sortMode)
        : sortBranches(data.remoteBranches, this.sortMode);

      if (branches.length === 0) {
        return [
          new BranchTreeItem(
            "No branches found",
            "message",
            vscode.TreeItemCollapsibleState.None,
          ),
        ];
      }

      if (this.viewMode === "grouped") {
        if (isLocalBranchGroup && data.currentBranch) {
          const currentBranch = branches.find((branch) => branch.name === data.currentBranch);
          const otherBranches = branches.filter((branch) => branch.name !== data.currentBranch);

          if (currentBranch) {
            return [
              createBranchItem(currentBranch, "local", data.currentBranch, currentBranch.name),
              ...buildGroupedBranchItems(otherBranches, "local", data.currentBranch, null),
            ];
          }
        }

        return buildGroupedBranchItems(
          branches,
          isLocalBranchGroup ? "local" : "remote",
          data.currentBranch,
          null,
        );
      }

      return branches.map((branch) =>
        createBranchItem(branch, isLocalBranchGroup ? "local" : "remote", data.currentBranch),
      );
    }

    if (element.nodeType === "pathGroup") {
      const branchKind = element.branchKind === "local" ? "local" : "remote";
      const isLocalBranchGroup = branchKind === "local";
      const branches = isLocalBranchGroup
        ? sortLocalBranches(data.localBranches, data.currentBranch, this.sortMode)
        : sortBranches(data.remoteBranches, this.sortMode);

      return buildGroupedBranchItems(
        branches,
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
): GitBranch[] {
  if (!currentBranch) {
    return sortBranches(branches, sortMode);
  }

  const currentBranches = branches.filter((branch) => branch.name === currentBranch);
  const otherBranches = sortBranches(
    branches.filter((branch) => branch.name !== currentBranch),
    sortMode,
  );
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

function buildBranchTooltip(branch: GitBranch): string {
  const upstreamLine = branch.upstreamName ? `\nUpstream: ${branch.upstreamName}` : "\nUpstream: none";

  if (!branch.lastUpdatedAt) {
    return `${branch.name}${upstreamLine}`;
  }

  const updatedAt = new Date(branch.lastUpdatedAt * 1000).toLocaleString();
  return `${branch.name}\nUpdated: ${updatedAt}${upstreamLine}`;
}

function getRemoteGroupLabel(remoteName: string | null): string {
  return remoteName ? `${REMOTE_BRANCHES_LABEL} (${remoteName})` : REMOTE_BRANCHES_LABEL;
}

function createBranchItem(
  branch: GitBranch,
  branchKind: "local" | "remote",
  currentBranch: string | null,
  labelOverride?: string,
): BranchTreeItem {
  const item = new BranchTreeItem(
    labelOverride ?? (branchKind === "local" ? branch.name : branch.shortName ?? branch.name),
    "branch",
    vscode.TreeItemCollapsibleState.None,
    undefined,
    branchKind,
  );

  if (branchKind === "local" && branch.name === currentBranch) {
    item.contextValue = "currentLocalBranch";
    item.description = "✨";
    item.fullBranchName = branch.name;
  } else if (branchKind === "local") {
    item.contextValue = "localBranch";
    item.fullBranchName = branch.name;
  } else {
    item.contextValue = "remoteBranch";
    item.fullBranchName = branch.name;
  }

  item.hasUpstream = branchKind === "local" ? Boolean(branch.upstreamName) : true;
  item.iconPath =
    branchKind === "local" && !item.hasUpstream
      ? {
          light: vscode.Uri.joinPath(vscode.Uri.file(__dirname), "..", "media", "blank.svg"),
          dark: vscode.Uri.joinPath(vscode.Uri.file(__dirname), "..", "media", "blank.svg"),
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
    const displayName = branchKind === "local" ? branch.name : branch.shortName ?? branch.name;
    const relativeName = parentPrefix ? trimPrefix(displayName, `${parentPrefix}/`) : displayName;

    if (!relativeName || relativeName === displayName && parentPrefix && !displayName.startsWith(`${parentPrefix}/`)) {
      continue;
    }

    const slashIndex = relativeName.indexOf("/");
    if (slashIndex === -1) {
      directBranches.push(branch);
      continue;
    }

    const nextSegment = relativeName.slice(0, slashIndex);
    const currentPrefix = parentPrefix ? `${parentPrefix}/${nextSegment}` : nextSegment;
    groupedBranches.set(currentPrefix, [...(groupedBranches.get(currentPrefix) ?? []), branch]);
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
    const displayName = branchKind === "local" ? branch.name : branch.shortName ?? branch.name;
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
