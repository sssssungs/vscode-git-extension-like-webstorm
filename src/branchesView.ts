import * as vscode from "vscode";
import { getGitBranchData } from "./git";

type BranchNodeType = "group" | "branch" | "message";

export class BranchesViewProvider implements vscode.TreeDataProvider<BranchTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    BranchTreeItem | undefined | void
  >();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: BranchTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BranchTreeItem): Promise<BranchTreeItem[]> {
    if (!element) {
      const data = await getGitBranchData();

      if (!data.currentBranch && data.localBranches.length === 0 && data.remoteBranches.length === 0) {
        return [
          new BranchTreeItem(
            "Open a Git repository folder to see branches.",
            "message",
            vscode.TreeItemCollapsibleState.None
          )
        ];
      }

      return [
        new BranchTreeItem("Local Branches", "group", vscode.TreeItemCollapsibleState.Expanded),
        new BranchTreeItem("Remote Branches", "group", vscode.TreeItemCollapsibleState.Expanded)
      ];
    }

    if (element.nodeType === "group") {
      const data = await getGitBranchData();
      const branches =
        element.label === "Local Branches" ? data.localBranches : data.remoteBranches;

      if (branches.length === 0) {
        return [
          new BranchTreeItem(
            "No branches found",
            "message",
            vscode.TreeItemCollapsibleState.None
          )
        ];
      }

      return branches.map((branch) => {
        const item = new BranchTreeItem(branch, "branch", vscode.TreeItemCollapsibleState.None);

        if (element.label === "Local Branches" && branch === data.currentBranch) {
          item.description = "current";
        }

        item.tooltip = branch;
        item.contextValue = "branch";
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
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);

    if (nodeType === "group") {
      this.iconPath = new vscode.ThemeIcon("list-tree");
      return;
    }

    if (nodeType === "branch") {
      this.iconPath = new vscode.ThemeIcon("git-branch");
      return;
    }

    this.iconPath = new vscode.ThemeIcon("info");
  }
}
