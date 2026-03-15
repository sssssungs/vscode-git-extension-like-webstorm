import * as vscode from "vscode";
import { BranchesViewProvider } from "./branchesView";

export function activate(context: vscode.ExtensionContext): void {
  const branchesViewProvider = new BranchesViewProvider();

  const treeView = vscode.window.createTreeView("gitBranchPanel.branchesView", {
    treeDataProvider: branchesViewProvider,
    showCollapseAll: true
  });

  const refreshCommand = vscode.commands.registerCommand("gitBranchPanel.refresh", () => {
    branchesViewProvider.refresh();
  });

  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    branchesViewProvider.refresh();
  });

  context.subscriptions.push(treeView, refreshCommand, workspaceWatcher);
}

export function deactivate(): void {}
