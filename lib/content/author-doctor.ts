export const AUTHOR_DOCTOR_REPORT_VERSION = 1 as const;
export const AUTHOR_DOCTOR_NODE_ENGINE = ">=22.13.0";
export const AUTHOR_DOCTOR_PACKAGE_NAME = "zach424-myblog";
export const AUTHOR_DOCTOR_PLUGIN_ID = "myblog-publisher";
export const AUTHOR_DOCTOR_PLUGIN_VERSION = "1.32.0";

export const AUTHOR_DOCTOR_REQUIRED_SCRIPTS = [
  "content:author:doctor",
  "content:delivery:status",
  "content:inbox",
  "content:publish",
  "content:publish:deliver",
  "content:publish:status",
  "content:review",
  "content:review:deliver",
  "content:review:status",
  "content:status",
  "release:check",
] as const;

export const AUTHOR_DOCTOR_REQUIRED_PATHS = [
  { kind: "directory", path: "content/inbox" },
  { kind: "directory", path: "content/posts" },
  { kind: "directory", path: "content/projects" },
  { kind: "file", path: "docs/STATUS.md" },
  { kind: "directory", path: "templates/obsidian" },
] as const;

export type AuthorDoctorGroup = "runtime" | "git" | "workspace" | "vault";
export type AuthorDoctorCheckStatus = "pass" | "attention";
export type AuthorDoctorStatus = "ready" | "needs-attention";
export type AuthorDoctorRelation =
  | "synchronized"
  | "local-ahead"
  | "behind"
  | "diverged"
  | "tracking-missing";

export type AuthorDoctorObservation = {
  currentDirectory: string;
  gitVersion: string | null;
  identity: {
    emailConfigured: boolean;
    nameConfigured: boolean;
  };
  nodeVersion: string;
  npmVersion: string | null;
  repository: {
    currentBranch: string | null;
    localHead: string | null;
    relation: AuthorDoctorRelation | null;
    root: string | null;
    trackingHead: string | null;
    upstream: string | null;
  };
  vault: {
    obsidianDirectoryPresent: boolean;
    plugin: {
      id: string;
      isDesktopOnly: boolean;
      mainPresent: boolean;
      stylesPresent: boolean;
      version: string;
    } | null;
  };
  workspace: {
    dependencyExpected: number;
    dependencyIssues: string[];
    dependencyMatching: number;
    nodeEngine: string | null;
    packageName: string | null;
    paths: Array<{
      kind: "directory" | "file";
      path: string;
      present: boolean;
    }>;
    scriptNames: string[];
  };
};

export type AuthorDoctorCheck = {
  expected: string;
  group: AuthorDoctorGroup;
  id:
    | "node-runtime"
    | "npm-cli"
    | "git-cli"
    | "repository-root"
    | "main-branch"
    | "delivery-baseline"
    | "author-identity"
    | "workspace-contract"
    | "npm-scripts"
    | "workspace-dependencies"
    | "content-layout"
    | "obsidian-vault"
    | "publisher-plugin";
  label: string;
  observed: string;
  resolution: string | null;
  status: AuthorDoctorCheckStatus;
};

export type AuthorDoctorReport = {
  version: typeof AUTHOR_DOCTOR_REPORT_VERSION;
  mode: "read-only";
  status: AuthorDoctorStatus;
  observation: AuthorDoctorObservation;
  summary: {
    attention: number;
    passed: number;
    total: number;
  };
  checks: AuthorDoctorCheck[];
  safety: {
    configurationChanged: false;
    credentialsRead: false;
    filesChanged: false;
    networkChecked: false;
  };
};

type CheckInput = Omit<AuthorDoctorCheck, "resolution" | "status"> & {
  pass: boolean;
  repair: string;
};

const GIT_OBJECT_ID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

function check(input: CheckInput): AuthorDoctorCheck {
  const { pass, repair, ...evidence } = input;
  return {
    ...evidence,
    resolution: pass ? null : repair,
    status: pass ? "pass" : "attention",
  };
}

function normalizeRoot(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.replace(/\\/gu, "/").replace(/\/+$/u, "");
  return /^[A-Za-z]:\//u.test(normalized)
    ? normalized.toLocaleLowerCase("en-US")
    : normalized;
}

function parseNumericVersion(value: string, prefix = ""): number[] | null {
  if (!value.startsWith(prefix)) return null;
  const match = value.slice(prefix.length).match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/u);
  return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(actual: string, minimum: string): boolean {
  const actualParts = parseNumericVersion(actual, "v");
  const minimumParts = parseNumericVersion(minimum);
  if (!actualParts || !minimumParts) return false;
  for (let index = 0; index < minimumParts.length; index += 1) {
    if (actualParts[index] !== minimumParts[index]) {
      return actualParts[index] > minimumParts[index];
    }
  }
  return true;
}

function cloneObservation(
  observation: AuthorDoctorObservation,
): AuthorDoctorObservation {
  return {
    ...observation,
    identity: { ...observation.identity },
    repository: { ...observation.repository },
    vault: {
      ...observation.vault,
      plugin: observation.vault.plugin
        ? { ...observation.vault.plugin }
        : null,
    },
    workspace: {
      ...observation.workspace,
      dependencyIssues: [...observation.workspace.dependencyIssues],
      paths: observation.workspace.paths.map((path) => ({ ...path })),
      scriptNames: [...observation.workspace.scriptNames],
    },
  };
}

export function analyzeAuthorEnvironment(
  source: AuthorDoctorObservation,
): AuthorDoctorReport {
  const observation = cloneObservation(source);
  const minimumNode = AUTHOR_DOCTOR_NODE_ENGINE.slice(2);
  const requiredScripts = new Set(AUTHOR_DOCTOR_REQUIRED_SCRIPTS);
  const presentScripts = new Set(observation.workspace.scriptNames);
  const scriptsReady =
    presentScripts.size === observation.workspace.scriptNames.length &&
    [...requiredScripts].every((name) => presentScripts.has(name));
  const requiredPathsReady =
    observation.workspace.paths.length === AUTHOR_DOCTOR_REQUIRED_PATHS.length &&
    AUTHOR_DOCTOR_REQUIRED_PATHS.every((required, index) => {
      const observed = observation.workspace.paths[index];
      return (
        observed?.kind === required.kind &&
        observed.path === required.path &&
        observed.present
      );
    });
  const localHead = observation.repository.localHead;
  const trackingHead = observation.repository.trackingHead;
  const baselineReady =
    observation.repository.upstream === "origin/main" &&
    observation.repository.relation === "synchronized" &&
    localHead !== null &&
    trackingHead !== null &&
    GIT_OBJECT_ID_PATTERN.test(localHead) &&
    trackingHead === localHead;
  const identityObserved = `${observation.identity.nameConfigured ? "name configured" : "name missing"} · ${observation.identity.emailConfigured ? "email configured" : "email missing"}`;
  const plugin = observation.vault.plugin;
  const pluginReady =
    plugin?.id === AUTHOR_DOCTOR_PLUGIN_ID &&
    plugin.version === AUTHOR_DOCTOR_PLUGIN_VERSION &&
    plugin.isDesktopOnly &&
    plugin.mainPresent &&
    plugin.stylesPresent;
  const checks: AuthorDoctorCheck[] = [
    check({
      expected: AUTHOR_DOCTOR_NODE_ENGINE,
      group: "runtime",
      id: "node-runtime",
      label: "Node.js runtime",
      observed: observation.nodeVersion,
      pass: versionAtLeast(observation.nodeVersion, minimumNode),
      repair: "安装 Node.js 22.13.0 或更高版本后重启 Obsidian",
    }),
    check({
      expected: "available semantic version",
      group: "runtime",
      id: "npm-cli",
      label: "npm CLI",
      observed: observation.npmVersion ?? "missing",
      pass:
        observation.npmVersion !== null &&
        parseNumericVersion(observation.npmVersion) !== null,
      repair: "重新安装受支持的 Node.js（应同时提供 npm）",
    }),
    check({
      expected: "available version",
      group: "runtime",
      id: "git-cli",
      label: "Git CLI",
      observed: observation.gitVersion ?? "missing",
      pass:
        observation.gitVersion !== null &&
        /^git version \d+\.\d+\.\d+(?:[.-][0-9A-Za-z]+)*$/u.test(
          observation.gitVersion,
        ),
      repair: "安装 Git 后重启 Obsidian",
    }),
    check({
      expected: "current directory equals Git toplevel",
      group: "git",
      id: "repository-root",
      label: "Repository root",
      observed: observation.repository.root ?? "missing",
      pass:
        normalizeRoot(observation.currentDirectory) !== null &&
        normalizeRoot(observation.currentDirectory) ===
          normalizeRoot(observation.repository.root),
      repair: "把当前 Vault 设为 MyBlog 仓库根目录",
    }),
    check({
      expected: "main",
      group: "git",
      id: "main-branch",
      label: "Current branch",
      observed: observation.repository.currentBranch ?? "detached HEAD",
      pass: observation.repository.currentBranch === "main",
      repair: "切换到 main 后重新检查",
    }),
    check({
      expected: "main -> origin/main synchronized",
      group: "git",
      id: "delivery-baseline",
      label: "Delivery baseline",
      observed: `${observation.repository.upstream ?? "no upstream"} · ${observation.repository.relation ?? "unavailable"}`,
      pass: baselineReady,
      repair: "运行 npm run content:delivery:status 检查本地交付状态",
    }),
    check({
      expected: "user.name and user.email configured",
      group: "git",
      id: "author-identity",
      label: "Author identity",
      observed: identityObserved,
      pass:
        observation.identity.nameConfigured &&
        observation.identity.emailConfigured,
      repair: "配置 Git user.name 与 user.email 后重新检查",
    }),
    check({
      expected: `${AUTHOR_DOCTOR_PACKAGE_NAME} · node ${AUTHOR_DOCTOR_NODE_ENGINE}`,
      group: "workspace",
      id: "workspace-contract",
      label: "Workspace contract",
      observed: `${observation.workspace.packageName ?? "missing"} · node ${observation.workspace.nodeEngine ?? "missing"}`,
      pass:
        observation.workspace.packageName === AUTHOR_DOCTOR_PACKAGE_NAME &&
        observation.workspace.nodeEngine === AUTHOR_DOCTOR_NODE_ENGINE,
      repair: "恢复仓库根 package.json 的项目名称与 Node engines 契约",
    }),
    check({
      expected: `${AUTHOR_DOCTOR_REQUIRED_SCRIPTS.length} required author scripts`,
      group: "workspace",
      id: "npm-scripts",
      label: "Author scripts",
      observed: `${observation.workspace.scriptNames.filter((name) => requiredScripts.has(name as (typeof AUTHOR_DOCTOR_REQUIRED_SCRIPTS)[number])).length}/${AUTHOR_DOCTOR_REQUIRED_SCRIPTS.length} required scripts`,
      pass: scriptsReady,
      repair: "恢复 package.json 中缺失的作者脚本",
    }),
    check({
      expected: "all declared packages installed at pinned versions",
      group: "workspace",
      id: "workspace-dependencies",
      label: "Workspace dependencies",
      observed:
        observation.workspace.dependencyIssues.length === 0
          ? `${observation.workspace.dependencyMatching}/${observation.workspace.dependencyExpected} pinned packages`
          : observation.workspace.dependencyIssues.join(" · "),
      pass:
        Number.isInteger(observation.workspace.dependencyExpected) &&
        observation.workspace.dependencyExpected >= 0 &&
        observation.workspace.dependencyMatching ===
          observation.workspace.dependencyExpected &&
        observation.workspace.dependencyIssues.length === 0,
      repair: "在仓库根运行 npm ci",
    }),
    check({
      expected: `${AUTHOR_DOCTOR_REQUIRED_PATHS.length} required authoring paths`,
      group: "workspace",
      id: "content-layout",
      label: "Content layout",
      observed: `${observation.workspace.paths.filter((path) => path.present).length}/${AUTHOR_DOCTOR_REQUIRED_PATHS.length} required paths`,
      pass: requiredPathsReady,
      repair: "恢复缺失的内容目录、模板或 docs/STATUS.md",
    }),
    check({
      expected: ".obsidian directory present",
      group: "vault",
      id: "obsidian-vault",
      label: "Obsidian Vault",
      observed: observation.vault.obsidianDirectoryPresent
        ? ".obsidian present"
        : ".obsidian missing",
      pass: observation.vault.obsidianDirectoryPresent,
      repair: "把仓库根作为 Obsidian Vault 打开",
    }),
    check({
      expected: `${AUTHOR_DOCTOR_PLUGIN_ID} ${AUTHOR_DOCTOR_PLUGIN_VERSION} desktop plugin`,
      group: "vault",
      id: "publisher-plugin",
      label: "MyBlog Publisher",
      observed: plugin
        ? `${plugin.id}@${plugin.version} · ${plugin.isDesktopOnly ? "desktop" : "not desktop"}`
        : "missing",
      pass: pluginReady,
      repair: `重新安装或启用 MyBlog Publisher ${AUTHOR_DOCTOR_PLUGIN_VERSION}`,
    }),
  ];
  const passed = checks.filter((item) => item.status === "pass").length;
  const attention = checks.length - passed;
  return {
    version: AUTHOR_DOCTOR_REPORT_VERSION,
    mode: "read-only",
    status: attention === 0 ? "ready" : "needs-attention",
    observation,
    summary: { attention, passed, total: checks.length },
    checks,
    safety: {
      configurationChanged: false,
      credentialsRead: false,
      filesChanged: false,
      networkChecked: false,
    },
  };
}
