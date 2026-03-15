import * as vscode from "vscode";
import {
  BranchesViewProvider,
  type BranchSortMode,
  type BranchViewMode,
} from "./branchesView";
import {
  checkoutLocalBranch,
  createLocalBranch,
  createIndependentLocalBranchFromRemote,
  deleteLocalBranch,
  deleteRemoteBranch,
  checkoutRemoteBranchAsLocal,
  getRepositoryGithubUrl,
  pushLocalBranch,
  syncRemoteBranches,
} from "./git";

export function activate(context: vscode.ExtensionContext): void {
  const branchesViewProvider = new BranchesViewProvider();
  void setBranchViewModeContext(branchesViewProvider.getViewMode());
  void setDisconnectedSortContext(branchesViewProvider.getPrioritizeDisconnectedBranches());

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
        title: "New Branch from Selected Branch",
        prompt: `Enter a name for the new branch based on ${fullBranchName}`,
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

  const createLocalBranchCommand = vscode.commands.registerCommand(
    "gitBranchPanel.createLocalBranch",
    async (item?: { branchKind?: string; fullBranchName?: string; label?: string }) => {
      const sourceBranchName =
        item?.branchKind === "local" ? item.fullBranchName ?? item.label : undefined;

      const branchName = await vscode.window.showInputBox({
        title: "New Branch from Selected Branch",
        prompt: sourceBranchName
          ? `Enter a name for the new branch based on ${sourceBranchName}`
          : "Enter a name for the new local branch",
        ignoreFocusOut: true,
      });

      if (branchName === undefined) {
        return;
      }

      const trimmedBranchName = branchName.trim();
      if (!trimmedBranchName) {
        vscode.window.showErrorMessage("Branch name is required.");
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Creating local branch ${trimmedBranchName}`,
          },
          async () => {
            await createLocalBranch(trimmedBranchName, sourceBranchName);
          },
        );
        vscode.window.showInformationMessage(`Created local branch: ${trimmedBranchName}`);
        branchesViewProvider.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create a local branch.";
        vscode.window.showErrorMessage(message);
      }
    },
  );

  const pushLocalBranchCommand = vscode.commands.registerCommand(
    "gitBranchPanel.pushLocalBranch",
    async (item?: {
      branchKind?: string;
      fullBranchName?: string;
      label?: string;
      upstreamName?: string | null;
    }) => {
      if (item?.branchKind !== "local") {
        return;
      }

      const branchName = item.fullBranchName ?? item.label;
      if (!branchName) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Pushing ${branchName}`,
          },
          async () => {
            await pushLocalBranch(branchName, item.upstreamName);
            await syncRemoteBranches();
          },
        );
        vscode.window.showInformationMessage(`Pushed local branch: ${branchName}`);
        branchesViewProvider.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to push local branch.";
        vscode.window.showErrorMessage(message);
      }
    },
  );

  const deleteLocalBranchCommand = vscode.commands.registerCommand(
    "gitBranchPanel.deleteLocalBranch",
    async (item?: {
      branchKind?: string;
      fullBranchName?: string;
      label?: string;
      upstreamName?: string | null;
    }) => {
      if (item?.branchKind !== "local") {
        return;
      }

      const branchName = item.fullBranchName ?? item.label;
      if (!branchName) {
        return;
      }

      try {
        if (!item.upstreamName) {
          const confirmed = await vscode.window.showWarningMessage(
            `Delete local branch "${branchName}"?`,
            { modal: true },
            "Delete",
          );

          if (confirmed !== "Delete") {
            return;
          }

          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Deleting local branch ${branchName}`,
            },
            async () => {
              await deleteLocalBranch(branchName);
            },
          );
        } else {
          const choice = await vscode.window.showWarningMessage(
            `Delete branch "${branchName}" locally only, or delete both local and remote?`,
            { modal: true },
            "Local Only",
            "Local + Remote",
          );

          if (!choice) {
            return;
          }

          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title:
                choice === "Local + Remote"
                  ? `Deleting local and remote branch ${branchName}`
                  : `Deleting local branch ${branchName}`,
            },
            async () => {
              if (choice === "Local + Remote") {
                await deleteRemoteBranch(item.upstreamName!);
              }

              await deleteLocalBranch(branchName);
              await syncRemoteBranches();
            },
          );
        }

        vscode.window.showInformationMessage(`Deleted branch: ${branchName}`);
        branchesViewProvider.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete branch.";
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

  const toggleDisconnectedSortCommand = vscode.commands.registerCommand(
    "gitBranchPanel.toggleDisconnectedFirst",
    async () => {
      const nextValue = !branchesViewProvider.getPrioritizeDisconnectedBranches();
      branchesViewProvider.setPrioritizeDisconnectedBranches(nextValue);
      await setDisconnectedSortContext(nextValue);
    },
  );

  const enableDisconnectedSortCommand = vscode.commands.registerCommand(
    "gitBranchPanel.enableDisconnectedFirst",
    async () => {
      branchesViewProvider.setPrioritizeDisconnectedBranches(true);
      await setDisconnectedSortContext(true);
    },
  );

  const disableDisconnectedSortCommand = vscode.commands.registerCommand(
    "gitBranchPanel.disableDisconnectedFirst",
    async () => {
      branchesViewProvider.setPrioritizeDisconnectedBranches(false);
      await setDisconnectedSortContext(false);
    },
  );

  const setListViewCommand = vscode.commands.registerCommand(
    "gitBranchPanel.setListView",
    async () => {
      branchesViewProvider.setViewMode("list");
      await setBranchViewModeContext("list");
    },
  );

  const setGroupedViewCommand = vscode.commands.registerCommand(
    "gitBranchPanel.setGroupedView",
    async () => {
      branchesViewProvider.setViewMode("grouped");
      await setBranchViewModeContext("grouped");
    },
  );

  const toggleToGroupedViewCommand = vscode.commands.registerCommand(
    "gitBranchPanel.toggleToGroupedView",
    async () => {
      branchesViewProvider.setViewMode("grouped");
      await setBranchViewModeContext("grouped");
    },
  );

  const toggleToListViewCommand = vscode.commands.registerCommand(
    "gitBranchPanel.toggleToListView",
    async () => {
      branchesViewProvider.setViewMode("list");
      await setBranchViewModeContext("list");
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
    createLocalBranchCommand,
    pushLocalBranchCommand,
    deleteLocalBranchCommand,
    changeSortOrderCommand,
    toggleDisconnectedSortCommand,
    enableDisconnectedSortCommand,
    disableDisconnectedSortCommand,
    setListViewCommand,
    setGroupedViewCommand,
    toggleToGroupedViewCommand,
    toggleToListViewCommand,
    openGithubRepositoryCommand,
    syncRemoteBranchesCommand,
    workspaceWatcher,
  );
}

export function deactivate(): void {}

async function setBranchViewModeContext(viewMode: BranchViewMode): Promise<void> {
  await vscode.commands.executeCommand("setContext", "gitBranchPanel.viewMode", viewMode);
}

async function setDisconnectedSortContext(enabled: boolean): Promise<void> {
  await vscode.commands.executeCommand(
    "setContext",
    "gitBranchPanel.disconnectedFirst",
    enabled,
  );
}
