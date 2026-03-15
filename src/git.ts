import { execFile } from "node:child_process";
import * as vscode from "vscode";

export interface GitBranch {
  name: string;
  lastUpdatedAt: number | null;
  remoteName?: string;
  shortName?: string;
}

export interface GitBranchData {
  repositoryName: string | null;
  repositoryPath: string | null;
  currentBranch: string | null;
  localBranches: GitBranch[];
  remoteBranches: GitBranch[];
}

export async function getGitBranchData(): Promise<GitBranchData> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return {
      repositoryName: null,
      repositoryPath: null,
      currentBranch: null,
      localBranches: [],
      remoteBranches: [],
    };
  }

  const cwd = workspaceFolder.uri.fsPath;

  const isGitRepo = await runGitCommand(cwd, ["rev-parse", "--is-inside-work-tree"]).catch(
    () => null
  );

  if (!isGitRepo || isGitRepo.trim() !== "true") {
    return {
      repositoryName: null,
      repositoryPath: null,
      currentBranch: null,
      localBranches: [],
      remoteBranches: [],
    };
  }

  const [currentBranchRaw, localRaw, remoteRaw] = await Promise.all([
    runGitCommand(cwd, ["branch", "--show-current"]),
    runGitCommand(cwd, ["for-each-ref", "refs/heads", "--format=%(refname:short)\t%(committerdate:unix)"]),
    runGitCommand(cwd, ["for-each-ref", "refs/remotes", "--format=%(refname:short)\t%(committerdate:unix)"])
  ]);

  return {
    repositoryName: workspaceFolder.name,
    repositoryPath: cwd,
    currentBranch: normalizeBranchName(currentBranchRaw) ?? null,
    localBranches: normalizeBranchList(localRaw),
    remoteBranches: normalizeRemoteBranchList(remoteRaw).filter(
      (branch) => !branch.name.endsWith("/HEAD")
    )
  };
}

export async function checkoutLocalBranch(branchName: string): Promise<void> {
  const repositoryPath = await getRepositoryPath();
  await runGitCommand(repositoryPath, ["checkout", branchName]);
}

export async function getRepositoryGithubUrl(): Promise<string> {
  const repositoryPath = await getRepositoryPath();
  const remoteUrl = normalizeBranchName(
    await runGitCommand(repositoryPath, ["remote", "get-url", "origin"]),
  );

  if (!remoteUrl) {
    throw new Error("No origin remote is configured for this repository.");
  }

  const githubUrl = normalizeGithubUrl(remoteUrl);
  if (!githubUrl) {
    throw new Error("The origin remote is not a GitHub URL.");
  }

  return githubUrl;
}

function normalizeBranchList(output: string): GitBranch[] {
  return output
    .split("\n")
    .map((line) => normalizeBranch(line))
    .filter((branch): branch is GitBranch => Boolean(branch));
}

function normalizeRemoteBranchList(output: string): GitBranch[] {
  return output
    .split("\n")
    .map((line) => normalizeBranch(line))
    .filter((branch): branch is GitBranch => Boolean(branch))
    .map((branch) => {
      const [remoteName, ...rest] = branch.name.split("/");
      const shortName = rest.join("/");

      return {
        ...branch,
        remoteName: remoteName || undefined,
        shortName: shortName || branch.name,
      };
    });
}

function normalizeBranchName(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBranch(value: string): GitBranch | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const [namePart, timestampPart] = trimmed.split("\t");
  const name = normalizeBranchName(namePart);
  if (!name) {
    return null;
  }

  const parsedTimestamp = Number.parseInt(timestampPart ?? "", 10);

  return {
    name,
    lastUpdatedAt: Number.isFinite(parsedTimestamp) ? parsedTimestamp : null,
  };
}

function normalizeGithubUrl(remoteUrl: string): string | null {
  if (remoteUrl.startsWith("git@github.com:")) {
    const repoPath = remoteUrl
      .replace("git@github.com:", "")
      .replace(/\.git$/, "");
    return `https://github.com/${repoPath}`;
  }

  if (remoteUrl.startsWith("https://github.com/")) {
    return remoteUrl.replace(/\.git$/, "");
  }

  if (remoteUrl.startsWith("http://github.com/")) {
    return remoteUrl.replace(/^http:\/\//, "https://").replace(/\.git$/, "");
  }

  return null;
}

async function getRepositoryPath(): Promise<string> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("No folder is open in the current window.");
  }

  const cwd = workspaceFolder.uri.fsPath;
  const isGitRepo = await runGitCommand(cwd, ["rev-parse", "--is-inside-work-tree"]).catch(
    () => null
  );

  if (!isGitRepo || isGitRepo.trim() !== "true") {
    throw new Error("No Git repository found in the current folder.");
  }

  return cwd;
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
