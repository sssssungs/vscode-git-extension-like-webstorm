import { execFile } from "node:child_process";
import * as vscode from "vscode";

export interface GitBranch {
  name: string;
  lastUpdatedAt: number | null;
  remoteName?: string;
  shortName?: string;
  upstreamName?: string | null;
  aheadCount?: number;
  behindCount?: number;
}

export interface GitBranchData {
  workspaceStatus: "ready" | "noWorkspace" | "notGitRepository";
  repositoryName: string | null;
  repositoryPath: string | null;
  remoteName: string | null;
  remoteStatus: "ready" | "noRemote" | "loadFailed";
  remoteErrorMessage: string | null;
  currentBranch: string | null;
  localBranches: GitBranch[];
  remoteBranches: GitBranch[];
}

export async function getGitBranchData(): Promise<GitBranchData> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return {
      workspaceStatus: "noWorkspace",
      repositoryName: null,
      repositoryPath: null,
      remoteName: null,
      remoteStatus: "noRemote",
      remoteErrorMessage: null,
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
      workspaceStatus: "notGitRepository",
      repositoryName: null,
      repositoryPath: null,
      remoteName: null,
      remoteStatus: "noRemote",
      remoteErrorMessage: null,
      currentBranch: null,
      localBranches: [],
      remoteBranches: [],
    };
  }

  const remoteName = await getPrimaryRemoteName(cwd).catch(() => null);
  const [currentBranchRaw, localRaw] = await Promise.all([
    runGitCommand(cwd, ["branch", "--show-current"]),
    runGitCommand(cwd, [
      "for-each-ref",
      "refs/heads",
      "--format=%(refname:short)\t%(committerdate:unix)\t%(upstream:short)\t%(upstream:track)",
    ]),
  ]);
  const remoteResult = remoteName
    ? await runGitCommand(cwd, ["ls-remote", "--heads", remoteName])
        .then((output) => ({ status: "ready" as const, output, errorMessage: null }))
        .catch((error: unknown) => ({
          status: "loadFailed" as const,
          output: "",
          errorMessage:
            error instanceof Error ? error.message : "Failed to load remote branches.",
        }))
    : {
        status: "noRemote" as const,
        output: "",
        errorMessage: null,
      };

  const localBranches = normalizeBranchList(localRaw);
  const remoteBranches = normalizeRemoteBranchList(remoteResult.output, remoteName).filter(
    (branch) => !branch.name.endsWith("/HEAD")
  );

  return {
    workspaceStatus: "ready",
    repositoryName: workspaceFolder.name,
    repositoryPath: cwd,
    remoteName,
    remoteStatus: remoteResult.status,
    remoteErrorMessage: remoteResult.errorMessage,
    currentBranch: normalizeBranchName(currentBranchRaw) ?? null,
    localBranches,
    remoteBranches,
  };
}

export async function checkoutLocalBranch(branchName: string): Promise<void> {
  const repositoryPath = await getRepositoryPath();
  await runGitCommand(repositoryPath, ["checkout", branchName]);
}

export async function createLocalBranch(
  branchName: string,
  sourceBranchName?: string,
): Promise<void> {
  const repositoryPath = await getRepositoryPath();
  const args = ["checkout", "-b", branchName];

  if (sourceBranchName) {
    args.push(sourceBranchName);
  }

  await runGitCommand(repositoryPath, args);
}

export async function renameLocalBranch(
  branchName: string,
  nextBranchName: string,
): Promise<void> {
  const repositoryPath = await getRepositoryPath();
  await runGitCommand(repositoryPath, ["branch", "-m", branchName, nextBranchName]);
}

export async function pushLocalBranch(branchName: string, upstreamName?: string | null): Promise<void> {
  const repositoryPath = await getRepositoryPath();

  if (!upstreamName) {
    const remoteName = await getPrimaryRemoteName(repositoryPath);
    await runGitCommand(repositoryPath, ["push", "-u", remoteName, `${branchName}:${branchName}`]);
    return;
  }

  const { remoteName, shortBranchName } = parseRemoteBranchName(upstreamName);
  await runGitCommand(repositoryPath, ["push", remoteName, `${branchName}:${shortBranchName}`]);
}

export async function deleteLocalBranch(branchName: string): Promise<void> {
  const repositoryPath = await getRepositoryPath();
  await runGitCommand(repositoryPath, ["branch", "-d", branchName]);
}

export async function deleteRemoteBranch(upstreamName: string): Promise<void> {
  const repositoryPath = await getRepositoryPath();
  const { remoteName, shortBranchName } = parseRemoteBranchName(upstreamName);
  await runGitCommand(repositoryPath, ["push", remoteName, "--delete", shortBranchName]);
}

export async function checkoutRemoteBranchAsLocal(
  remoteBranchName: string,
  localBranchName: string,
): Promise<void> {
  const repositoryPath = await getRepositoryPath();
  const { remoteName, shortBranchName } = parseRemoteBranchName(remoteBranchName);

  await runGitCommand(repositoryPath, [
    "fetch",
    remoteName,
    `refs/heads/${shortBranchName}:refs/remotes/${remoteName}/${shortBranchName}`,
  ]);
  await runGitCommand(repositoryPath, [
    "checkout",
    "-b",
    localBranchName,
    "--track",
    `refs/remotes/${remoteName}/${shortBranchName}`,
  ]);
}

export async function createIndependentLocalBranchFromRemote(
  remoteBranchName: string,
  localBranchName: string,
): Promise<void> {
  const repositoryPath = await getRepositoryPath();
  const { remoteName, shortBranchName } = parseRemoteBranchName(remoteBranchName);

  await runGitCommand(repositoryPath, [
    "fetch",
    remoteName,
    `refs/heads/${shortBranchName}`,
  ]);
  await runGitCommand(repositoryPath, [
    "checkout",
    "--no-track",
    "-b",
    localBranchName,
    "FETCH_HEAD",
  ]);
}

export async function getRepositoryGithubUrl(): Promise<string> {
  const repositoryPath = await getRepositoryPath();
  const remoteName = await getPrimaryRemoteName(repositoryPath);
  const remoteUrl = normalizeBranchName(
    await runGitCommand(repositoryPath, ["remote", "get-url", remoteName]),
  );

  if (!remoteUrl) {
    throw new Error("No remote is configured for this repository.");
  }

  const githubUrl = normalizeGithubUrl(remoteUrl);
  if (!githubUrl) {
    throw new Error("The origin remote is not a GitHub URL.");
  }

  return githubUrl;
}

export async function fetchRemoteBranches(): Promise<string> {
  const repositoryPath = await getRepositoryPath();
  const remoteName = await getPrimaryRemoteName(repositoryPath);
  await runGitCommand(repositoryPath, ["fetch", "--prune", remoteName]);
  return remoteName;
}

function normalizeBranchList(output: string): GitBranch[] {
  return output
    .split("\n")
    .map((line) => normalizeBranch(line))
    .filter((branch): branch is GitBranch => Boolean(branch));
}

function normalizeRemoteBranchList(output: string, remoteName: string | null): GitBranch[] {
  return output
    .split("\n")
    .map((line) => normalizeRemoteBranch(line, remoteName))
    .filter((branch): branch is GitBranch => Boolean(branch))
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

  const [namePart, timestampPart, upstreamPart, upstreamTrackPart] = trimmed.split("\t");
  const name = normalizeBranchName(namePart);
  if (!name) {
    return null;
  }

  const parsedTimestamp = Number.parseInt(timestampPart ?? "", 10);
  const { aheadCount, behindCount } = parseUpstreamTrack(upstreamTrackPart ?? "");

  return {
    name,
    lastUpdatedAt: Number.isFinite(parsedTimestamp) ? parsedTimestamp : null,
    upstreamName: normalizeBranchName(upstreamPart ?? ""),
    aheadCount,
    behindCount,
  };
}

function normalizeRemoteBranch(value: string, remoteName: string | null): GitBranch | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  const refName = parts[1];
  const prefix = "refs/heads/";

  if (!refName?.startsWith(prefix)) {
    return null;
  }

  const shortName = refName.slice(prefix.length);
  const fullName = remoteName ? `${remoteName}/${shortName}` : shortName;

  return {
    name: fullName,
    shortName,
    remoteName: remoteName ?? undefined,
    lastUpdatedAt: null,
  };
}

function parseUpstreamTrack(value: string): {
  aheadCount: number;
  behindCount: number;
} {
  const normalizedValue = value.trim();

  if (!normalizedValue || normalizedValue === "[gone]") {
    return { aheadCount: 0, behindCount: 0 };
  }

  const aheadMatch = normalizedValue.match(/ahead (\d+)/);
  const behindMatch = normalizedValue.match(/behind (\d+)/);

  return {
    aheadCount: aheadMatch ? Number.parseInt(aheadMatch[1], 10) : 0,
    behindCount: behindMatch ? Number.parseInt(behindMatch[1], 10) : 0,
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

function parseRemoteBranchName(remoteBranchName: string): {
  remoteName: string;
  shortBranchName: string;
} {
  const [remoteName, ...branchParts] = remoteBranchName.split("/");
  const shortBranchName = branchParts.join("/");

  if (!remoteName || !shortBranchName) {
    throw new Error(`Invalid remote branch name: ${remoteBranchName}`);
  }

  return { remoteName, shortBranchName };
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

async function getPrimaryRemoteName(repositoryPath: string): Promise<string> {
  const remoteOutput = await runGitCommand(repositoryPath, ["remote"]);
  const remoteNames = remoteOutput
    .split("\n")
    .map((name) => normalizeBranchName(name))
    .filter((name): name is string => Boolean(name));

  if (remoteNames.length === 0) {
    throw new Error("No remote is configured for this repository.");
  }

  return remoteNames.includes("origin") ? "origin" : remoteNames[0];
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
