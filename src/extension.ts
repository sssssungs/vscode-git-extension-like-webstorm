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
  fetchRemoteBranches,
  getRepositoryGithubUrl,
  pushLocalBranch,
  renameLocalBranch,
} from "./git";

const VIEW_STATE_STORAGE_KEY = "gitBranchPanel.viewState";

export function activate(context: vscode.ExtensionContext): void {
  const branchesViewProvider = new BranchesViewProvider(loadBranchViewState(context));
  void setBranchViewModeContext(branchesViewProvider.getViewMode());
  void setDisconnectedSortContext(branchesViewProvider.getPrioritizeDisconnectedBranches());
  void setBranchFilterContext(Boolean(branchesViewProvider.getBranchFilter()));

  const treeView = vscode.window.createTreeView("gitBranchPanel.branchesView", {
    treeDataProvider: branchesViewProvider,
    showCollapseAll: false,
  });
  updateTreeViewDescription(treeView, branchesViewProvider);

  const refreshCommand = vscode.commands.registerCommand(
    "gitBranchPanel.refresh",
    () => {
      branchesViewProvider.refresh();
    },
  );

  const searchBranchesCommand = vscode.commands.registerCommand(
    "gitBranchPanel.searchBranches",
    async () => {
      const currentFilter = branchesViewProvider.getBranchFilter();
      const searchTerm = await vscode.window.showInputBox({
        title: "Search Branches",
        prompt: "Filter local and remote branches by name",
        value: currentFilter,
        placeHolder: "feature/login",
        ignoreFocusOut: true,
      });

      if (searchTerm === undefined) {
        return;
      }

      const trimmedSearchTerm = searchTerm.trim();
      branchesViewProvider.setBranchFilter(trimmedSearchTerm);
      void persistBranchViewState(context, branchesViewProvider);
      await setBranchFilterContext(Boolean(trimmedSearchTerm));
      updateTreeViewDescription(treeView, branchesViewProvider);
    },
  );

  const clearBranchSearchCommand = vscode.commands.registerCommand(
    "gitBranchPanel.clearBranchSearch",
    async () => {
      if (!branchesViewProvider.getBranchFilter()) {
        return;
      }

      branchesViewProvider.clearBranchFilter();
      void persistBranchViewState(context, branchesViewProvider);
      await setBranchFilterContext(false);
      updateTreeViewDescription(treeView, branchesViewProvider);
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
            await fetchRemoteBranches();
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

  const renameLocalBranchCommand = vscode.commands.registerCommand(
    "gitBranchPanel.renameLocalBranch",
    async (item?: {
      branchKind?: string;
      fullBranchName?: string;
      label?: string;
      upstreamName?: string | null;
      contextValue?: string;
    }) => {
      if (item?.branchKind !== "local") {
        return;
      }

      if (item.upstreamName) {
        vscode.window.showWarningMessage(
          "Only local branches without an upstream can be renamed.",
        );
        return;
      }

      const branchName = item.fullBranchName ?? item.label;
      if (!branchName) {
        return;
      }

      const nextBranchNameInput = await vscode.window.showInputBox({
        title: "Rename Branch",
        prompt: `Enter a new name for ${branchName}`,
        value: branchName,
        ignoreFocusOut: true,
      });

      if (nextBranchNameInput === undefined) {
        return;
      }

      const nextBranchName = nextBranchNameInput.trim();
      if (!nextBranchName) {
        vscode.window.showErrorMessage("Branch name is required.");
        return;
      }

      if (nextBranchName === branchName) {
        return;
      }

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Renaming branch ${branchName} to ${nextBranchName}`,
          },
          async () => {
            await renameLocalBranch(branchName, nextBranchName);
          },
        );

        const isCurrentBranch =
          item.contextValue === "currentLocalBranch" ||
          item.contextValue === "currentPushableLocalBranch";

        vscode.window.showInformationMessage(
          isCurrentBranch
            ? `Renamed current branch to: ${nextBranchName}`
            : `Renamed branch to: ${nextBranchName}`,
        );
        branchesViewProvider.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to rename branch.";
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
              await fetchRemoteBranches();
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
      void persistBranchViewState(context, branchesViewProvider);
      updateTreeViewDescription(treeView, branchesViewProvider);
    },
  );

  const toggleDisconnectedSortCommand = vscode.commands.registerCommand(
    "gitBranchPanel.toggleDisconnectedFirst",
    async () => {
      const nextValue = !branchesViewProvider.getPrioritizeDisconnectedBranches();
      branchesViewProvider.setPrioritizeDisconnectedBranches(nextValue);
      void persistBranchViewState(context, branchesViewProvider);
      await setDisconnectedSortContext(nextValue);
    },
  );

  const enableDisconnectedSortCommand = vscode.commands.registerCommand(
    "gitBranchPanel.enableDisconnectedFirst",
    async () => {
      branchesViewProvider.setPrioritizeDisconnectedBranches(true);
      void persistBranchViewState(context, branchesViewProvider);
      await setDisconnectedSortContext(true);
    },
  );

  const disableDisconnectedSortCommand = vscode.commands.registerCommand(
    "gitBranchPanel.disableDisconnectedFirst",
    async () => {
      branchesViewProvider.setPrioritizeDisconnectedBranches(false);
      void persistBranchViewState(context, branchesViewProvider);
      await setDisconnectedSortContext(false);
    },
  );

  const setListViewCommand = vscode.commands.registerCommand(
    "gitBranchPanel.setListView",
    async () => {
      branchesViewProvider.setViewMode("list");
      void persistBranchViewState(context, branchesViewProvider);
      await setBranchViewModeContext("list");
    },
  );

  const setGroupedViewCommand = vscode.commands.registerCommand(
    "gitBranchPanel.setGroupedView",
    async () => {
      branchesViewProvider.setViewMode("grouped");
      void persistBranchViewState(context, branchesViewProvider);
      await setBranchViewModeContext("grouped");
    },
  );

  const toggleToGroupedViewCommand = vscode.commands.registerCommand(
    "gitBranchPanel.toggleToGroupedView",
    async () => {
      branchesViewProvider.setViewMode("grouped");
      void persistBranchViewState(context, branchesViewProvider);
      await setBranchViewModeContext("grouped");
    },
  );

  const toggleToListViewCommand = vscode.commands.registerCommand(
    "gitBranchPanel.toggleToListView",
    async () => {
      branchesViewProvider.setViewMode("list");
      void persistBranchViewState(context, branchesViewProvider);
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

  const fetchRemoteBranchesCommand = vscode.commands.registerCommand(
    "gitBranchPanel.fetchRemoteBranches",
    async () => {
      try {
        const remoteName = await fetchRemoteBranches();
        vscode.window.showInformationMessage(
          `Fetched remote branches from ${remoteName}.`,
        );
        branchesViewProvider.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch remote branches.";
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
    searchBranchesCommand,
    clearBranchSearchCommand,
    checkoutLocalBranchCommand,
    checkoutRemoteBranchAsLocalCommand,
    createIndependentLocalBranchCommand,
    createLocalBranchCommand,
    pushLocalBranchCommand,
    renameLocalBranchCommand,
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
    fetchRemoteBranchesCommand,
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

async function setBranchFilterContext(enabled: boolean): Promise<void> {
  await vscode.commands.executeCommand("setContext", "gitBranchPanel.hasBranchFilter", enabled);
}

function updateTreeViewDescription(
  treeView: vscode.TreeView<unknown>,
  branchesViewProvider: BranchesViewProvider,
): void {
  const parts = [branchesViewProvider.getSortDescription()];
  const filterDescription = branchesViewProvider.getFilterDescription();

  if (filterDescription) {
    parts.push(filterDescription);
  }

  treeView.description = parts.join(" | ");
}

function loadBranchViewState(context: vscode.ExtensionContext): {
  sortMode?: BranchSortMode;
  viewMode?: BranchViewMode;
  prioritizeDisconnectedBranches?: boolean;
  branchFilter?: string;
} {
  return context.workspaceState.get(VIEW_STATE_STORAGE_KEY, {});
}

async function persistBranchViewState(
  context: vscode.ExtensionContext,
  branchesViewProvider: BranchesViewProvider,
): Promise<void> {
  await context.workspaceState.update(VIEW_STATE_STORAGE_KEY, {
    sortMode: branchesViewProvider.getSortMode(),
    viewMode: branchesViewProvider.getViewMode(),
    prioritizeDisconnectedBranches: branchesViewProvider.getPrioritizeDisconnectedBranches(),
    branchFilter: branchesViewProvider.getBranchFilter(),
  });
}
