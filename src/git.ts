import { execFile } from "node:child_process";
import * as vscode from "vscode";

export interface GitBranchData {
  currentBranch: string | null;
  localBranches: string[];
  remoteBranches: string[];
}

export async function getGitBranchData(): Promise<GitBranchData> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return {
      currentBranch: null,
      localBranches: [],
      remoteBranches: []
    };
  }

  const cwd = workspaceFolder.uri.fsPath;

  const isGitRepo = await runGitCommand(cwd, ["rev-parse", "--is-inside-work-tree"]).catch(
    () => null
  );

  if (!isGitRepo || isGitRepo.trim() !== "true") {
    return {
      currentBranch: null,
      localBranches: [],
      remoteBranches: []
    };
  }

  const [currentBranchRaw, localRaw, remoteRaw] = await Promise.all([
    runGitCommand(cwd, ["branch", "--show-current"]),
    runGitCommand(cwd, ["branch", "--format=%(refname:short)"]),
    runGitCommand(cwd, ["branch", "-r", "--format=%(refname:short)"])
  ]);

  return {
    currentBranch: normalizeBranchName(currentBranchRaw) ?? null,
    localBranches: normalizeBranchList(localRaw),
    remoteBranches: normalizeBranchList(remoteRaw).filter(
      (branch) => !branch.endsWith("/HEAD")
    )
  };
}

function normalizeBranchList(output: string): string[] {
  return output
    .split("\n")
    .map((line) => normalizeBranchName(line))
    .filter((line): line is string => Boolean(line));
}

function normalizeBranchName(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function runGitCommand(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }

      resolve(stdout);
    });
  });
}
