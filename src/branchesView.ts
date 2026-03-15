import * as vscode from "vscode";
import { type GitBranch, getGitBranchData } from "./git";

type BranchNodeType = "repository" | "group" | "branch" | "message";
type BranchKind = "local" | "remote" | null;
export type BranchSortMode = "name" | "updated";

const REPOSITORY_LABEL = "Repository";
const LOCAL_BRANCHES_LABEL = "Local";
const REMOTE_BRANCHES_LABEL = "Remote";

export class BranchesViewProvider implements vscode.TreeDataProvider<BranchTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    BranchTreeItem | undefined | void
  >();
  private sortMode: BranchSortMode = "updated";

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
      const remoteLabel = getRemoteGroupLabel(data.remoteBranches);

      return [
        new BranchTreeItem(
          LOCAL_BRANCHES_LABEL,
          "group",
          vscode.TreeItemCollapsibleState.Expanded,
        ),
        new BranchTreeItem(
          remoteLabel,
          "group",
          vscode.TreeItemCollapsibleState.Expanded,
        ),
      ];
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

      return branches.map((branch) => {
        const item = new BranchTreeItem(
          isLocalBranchGroup ? branch.name : branch.shortName ?? branch.name,
          "branch",
          vscode.TreeItemCollapsibleState.None,
          undefined,
          isLocalBranchGroup ? "local" : "remote",
        );

        if (isLocalBranchGroup && branch.name === data.currentBranch) {
          item.contextValue = "currentLocalBranch";
          item.description = "✨";
        } else if (isLocalBranchGroup) {
          item.contextValue = "localBranch";
        } else {
          item.contextValue = "remoteBranch";
        }

        item.tooltip = buildBranchTooltip(branch);
        return item;
      });
    }

    return [];
  }
}

class BranchTreeItem extends vscode.TreeItem {
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
  if (!branch.lastUpdatedAt) {
    return branch.name;
  }

  const updatedAt = new Date(branch.lastUpdatedAt * 1000).toLocaleString();
  return `${branch.name}\nUpdated: ${updatedAt}`;
}

function getRemoteGroupLabel(branches: GitBranch[]): string {
  const remoteName = branches[0]?.remoteName;
  return remoteName ? `${REMOTE_BRANCHES_LABEL} (${remoteName})` : REMOTE_BRANCHES_LABEL;
}
