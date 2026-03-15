import * as vscode from "vscode";
import { BranchesViewProvider, type BranchSortMode } from "./branchesView";
import {
  checkoutLocalBranch,
  createIndependentLocalBranchFromRemote,
  checkoutRemoteBranchAsLocal,
  getRepositoryGithubUrl,
  syncRemoteBranches,
} from "./git";

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

  const checkoutRemoteBranchAsLocalCommand = vscode.commands.registerCommand(
    "gitBranchPanel.checkoutRemoteBranchAsLocal",
    async (item?: { label?: string; branchKind?: string; fullBranchName?: string }) => {
      if (!item?.label || item.branchKind !== "remote" || !item.fullBranchName) {
        return;
      }

      try {
        await checkoutRemoteBranchAsLocal(item.fullBranchName, item.label);
        vscode.window.showInformationMessage(
          `Created and checked out local branch: ${item.label}`,
        );
        branchesViewProvider.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to create a local branch from the remote branch.";
        vscode.window.showErrorMessage(message);
      }
    },
  );

  const createIndependentLocalBranchCommand = vscode.commands.registerCommand(
    "gitBranchPanel.createIndependentLocalBranchFromRemote",
    async (item?: { label?: string; branchKind?: string; fullBranchName?: string }) => {
      if (!item?.label || item.branchKind !== "remote" || !item.fullBranchName) {
        return;
      }

      const fullBranchName = item.fullBranchName;
      const customBranchName = await vscode.window.showInputBox({
        title: "Create Local Branch",
        prompt: "Enter a name for the new local branch",
        value: item.label,
        ignoreFocusOut: true,
      });

      if (customBranchName === undefined) {
        return;
      }

      const localBranchName = customBranchName.trim();

      if (!localBranchName) {
        vscode.window.showErrorMessage("Branch name is required.");
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Creating local branch ${localBranchName}`,
          },
          async () => {
            await createIndependentLocalBranchFromRemote(
              fullBranchName,
              localBranchName,
            );
          },
        );
        vscode.window.showInformationMessage(
          `Created local branch: ${localBranchName}`,
        );
        branchesViewProvider.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to create an independent local branch.";
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

  const syncRemoteBranchesCommand = vscode.commands.registerCommand(
    "gitBranchPanel.syncRemoteBranches",
    async () => {
      try {
        const remoteName = await syncRemoteBranches();
        vscode.window.showInformationMessage(
          `Synced remote branches from ${remoteName}.`,
        );
        branchesViewProvider.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to sync remote branches.";
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
    checkoutRemoteBranchAsLocalCommand,
    createIndependentLocalBranchCommand,
    changeSortOrderCommand,
    openGithubRepositoryCommand,
    syncRemoteBranchesCommand,
    workspaceWatcher,
  );
}

export function deactivate(): void {}
