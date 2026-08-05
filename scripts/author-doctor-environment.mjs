import { spawnSync } from "node:child_process";
import { lstat, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  analyzeAuthorEnvironment,
  AUTHOR_DOCTOR_REQUIRED_PATHS,
} from "../lib/content/author-doctor.ts";
import { readContentDeliveryGitSnapshot } from "./delivery-git-snapshot.mjs";

function normalizePath(path) {
  return path.replace(/\\/gu, "/");
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 2_000_000,
    shell: false,
    stdio: "pipe",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

function git(cwd, args) {
  return run("git", args, cwd);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function hasPath(root, path, kind) {
  try {
    const detail = await lstat(join(root, ...path.split("/")));
    if (detail.isSymbolicLink()) return false;
    return kind === "directory" ? detail.isDirectory() : detail.isFile();
  } catch {
    return false;
  }
}

async function isRegularFile(path) {
  try {
    const detail = await lstat(path);
    return detail.isFile() && !detail.isSymbolicLink();
  } catch {
    return false;
  }
}

async function readNpmVersion(cwd) {
  const candidates = [
    process.env.npm_execpath,
    join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (await isRegularFile(candidate)) {
      const version = run(process.execPath, [candidate, "--version"], cwd);
      if (version) return version;
    }
  }
  return null;
}

function deriveRelation(snapshot) {
  if (snapshot.trackingHead === null) return "tracking-missing";
  if (snapshot.ahead === 0 && snapshot.behind === 0) return "synchronized";
  if (snapshot.ahead > 0 && snapshot.behind === 0) return "local-ahead";
  if (snapshot.behind > 0 && snapshot.ahead === 0) return "behind";
  return "diverged";
}

async function readDependencyState(root, packageSource) {
  if (!packageSource) {
    return {
      dependencyExpected: 0,
      dependencyIssues: ["package.json unavailable"],
      dependencyMatching: 0,
    };
  }
  const declarations = [
    ...Object.entries(packageSource.dependencies ?? {}),
    ...Object.entries(packageSource.devDependencies ?? {}),
  ].sort(([left], [right]) => left.localeCompare(right, "en"));
  let matching = 0;
  const issues = [];
  for (const [name, expected] of declarations) {
    const installed = await readJson(
      join(root, "node_modules", ...name.split("/"), "package.json"),
    );
    if (installed?.version === expected) matching += 1;
    else issues.push(`${name}@${expected} ${installed ? `found ${installed.version ?? "unknown"}` : "missing"}`);
  }
  return {
    dependencyExpected: declarations.length,
    dependencyIssues: issues,
    dependencyMatching: matching,
  };
}

export async function inspectAuthorEnvironment(cwd = process.cwd()) {
  const root = resolve(cwd);
  const packageSource = await readJson(join(root, "package.json"));
  const npmVersion = await readNpmVersion(root);
  const gitVersion = git(root, ["--version"]);
  const repositoryRoot = gitVersion
    ? git(root, ["rev-parse", "--show-toplevel"])
    : null;
  const upstream = gitVersion
    ? git(root, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])
    : null;
  let snapshot = null;
  if (gitVersion) {
    try {
      snapshot = readContentDeliveryGitSnapshot(root);
    } catch {
      snapshot = null;
    }
  }
  const paths = await Promise.all(
    AUTHOR_DOCTOR_REQUIRED_PATHS.map(async ({ kind, path }) => ({
      kind,
      path,
      present: await hasPath(root, path, kind),
    })),
  );
  const dependencyState = await readDependencyState(root, packageSource);
  const pluginRoot = join(root, ".obsidian", "plugins", "myblog-publisher");
  const pluginManifest = await readJson(join(pluginRoot, "manifest.json"));
  const plugin = pluginManifest
    ? {
        id: pluginManifest.id ?? "",
        isDesktopOnly: pluginManifest.isDesktopOnly === true,
        mainPresent: await hasPath(pluginRoot, "main.js", "file"),
        stylesPresent: await hasPath(pluginRoot, "styles.css", "file"),
        version: pluginManifest.version ?? "",
      }
    : null;
  return analyzeAuthorEnvironment({
    currentDirectory: normalizePath(root),
    gitVersion,
    identity: {
      emailConfigured: Boolean(gitVersion && git(root, ["config", "--get", "user.email"])),
      nameConfigured: Boolean(gitVersion && git(root, ["config", "--get", "user.name"])),
    },
    nodeVersion: process.version,
    npmVersion,
    repository: {
      currentBranch: snapshot?.currentBranch ?? null,
      localHead: snapshot?.localHead ?? null,
      relation: snapshot ? deriveRelation(snapshot) : null,
      root: repositoryRoot ? normalizePath(repositoryRoot) : null,
      trackingHead: snapshot?.trackingHead ?? null,
      upstream,
    },
    vault: {
      obsidianDirectoryPresent: await hasPath(root, ".obsidian", "directory"),
      plugin,
    },
    workspace: {
      ...dependencyState,
      nodeEngine: packageSource?.engines?.node ?? null,
      packageName: packageSource?.name ?? null,
      paths,
      scriptNames: Object.keys(packageSource?.scripts ?? {}).sort((left, right) =>
        left.localeCompare(right, "en"),
      ),
    },
  });
}
