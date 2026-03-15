import * as vscode from "vscode";
import { BranchesViewProvider, type BranchSortMode } from "./branchesView";
import { checkoutLocalBranch, getRepositoryGithubUrl } from "./git";

export function activate(context: vscode.ExtensionContext): void {
  const branchesViewProvider = new BranchesViewProvider();

  const treeView = vscode.window.createTreeView("gitBranchPanel.branchesView", {
    treeDataProvider: branchesViewProvider,
    showCollapseAll: false,
  });
  treeView.description = branchesViewProvider.getSortDescription();

  const refreshCommand = vscode.commands.registerCommand(
    "gitBranchPanel.refresh",
    () => {
      branchesViewProvider.refresh();
    },
  );

  const checkoutLocalBranchCommand = vscode.commands.registerCommand(
    "gitBranchPanel.checkoutLocalBranch",
    async (item?: { label?: string; branchKind?: string }) => {
      if (!item?.label || item.branchKind !== "local") {
        return;
      }

      try {
        await checkoutLocalBranch(item.label);
        vscode.window.showInformationMessage(
          `Checked out local branch: ${item.label}`,
        );
        branchesViewProvider.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to checkout branch.";
        vscode.window.showErrorMessage(message);
      }
    },
  );

  const changeSortOrderCommand = vscode.commands.registerCommand(
    "gitBranchPanel.changeSortOrder",
    async () => {
      const selected = await vscode.window.showQuickPick(
        [
          {
            label: "Updated",
            description: "Sort branches by most recently updated",
            value: "updated" as BranchSortMode,
          },
          {
            label: "Name",
            description: "Sort branches alphabetically",
            value: "name" as BranchSortMode,
          },
        ],
        {
          title: "Branch Sort Order",
          placeHolder: "Choose how to sort branches",
        },
      );

      if (!selected) {
        return;
      }

      branchesViewProvider.setSortMode(selected.value);
      treeView.description = branchesViewProvider.getSortDescription();
    },
  );

  const openGithubRepositoryCommand = vscode.commands.registerCommand(
    "gitBranchPanel.openGithubRepository",
    async () => {
      try {
        const githubUrl = await getRepositoryGithubUrl();
        await vscode.env.openExternal(vscode.Uri.parse(githubUrl));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to open the GitHub repository.";
        vscode.window.showErrorMessage(message);
      }
    },
  );

  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    branchesViewProvider.refresh();
  });

  context.subscriptions.push(
    treeView,
    refreshCommand,
    checkoutLocalBranchCommand,
    changeSortOrderCommand,
    openGithubRepositoryCommand,
    workspaceWatcher,
  );
}

export function deactivate(): void {}
