import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  analyzeAuthorEnvironment,
  AUTHOR_DOCTOR_REQUIRED_PATHS,
  AUTHOR_DOCTOR_REQUIRED_SCRIPTS,
} from "../lib/content/author-doctor.ts";

const reportScriptPath = fileURLToPath(
  new URL("../scripts/report-author-doctor.mjs", import.meta.url),
);
const oid = (value) => value.repeat(40);

function run(cwd, command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 5_000_000,
    shell: false,
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

function git(cwd, ...args) {
  return run(cwd, "git", args).stdout.trim();
}

function healthyObservation() {
  return {
    currentDirectory: "D:/Study/blog",
    gitVersion: "git version 2.37.1.windows.1",
    identity: { emailConfigured: true, nameConfigured: true },
    nodeVersion: "v24.14.0",
    npmVersion: "11.9.0",
    repository: {
      currentBranch: "main",
      localHead: oid("a"),
      relation: "synchronized",
      root: "D:/Study/blog",
      trackingHead: oid("a"),
      upstream: "origin/main",
    },
    vault: {
      obsidianDirectoryPresent: true,
      plugin: {
        id: "myblog-publisher",
        isDesktopOnly: true,
        mainPresent: true,
        stylesPresent: true,
      version: "1.48.0",
      },
    },
    workspace: {
      dependencyExpected: 3,
      dependencyIssues: [],
      dependencyMatching: 3,
      nodeEngine: ">=22.13.0",
      packageName: "zach424-myblog",
      paths: AUTHOR_DOCTOR_REQUIRED_PATHS.map(({ kind, path }) => ({
        kind,
        path,
        present: true,
      })),
      scriptNames: [...AUTHOR_DOCTOR_REQUIRED_SCRIPTS],
    },
  };
}

test("derives one fixed read-only author preflight from observed facts", () => {
  const report = analyzeAuthorEnvironment(healthyObservation());
  assert.equal(report.version, 1);
  assert.equal(report.mode, "read-only");
  assert.equal(report.status, "ready");
  assert.deepEqual(report.summary, { attention: 0, passed: 13, total: 13 });
  assert.deepEqual(
    report.checks.map(({ group, id, status }) => ({ group, id, status })),
    [
      ["runtime", "node-runtime"],
      ["runtime", "npm-cli"],
      ["runtime", "git-cli"],
      ["git", "repository-root"],
      ["git", "main-branch"],
      ["git", "delivery-baseline"],
      ["git", "author-identity"],
      ["workspace", "workspace-contract"],
      ["workspace", "npm-scripts"],
      ["workspace", "workspace-dependencies"],
      ["workspace", "content-layout"],
      ["vault", "obsidian-vault"],
      ["vault", "publisher-plugin"],
    ].map(([group, id]) => ({ group, id, status: "pass" })),
  );
  assert.deepEqual(report.safety, {
    configurationChanged: false,
    credentialsRead: false,
    filesChanged: false,
    networkChecked: false,
  });
  assert.ok(report.checks.every((check) => check.resolution === null));
});

test("routes every missing prerequisite to its exact repair evidence", () => {
  const cases = [
    ["node-runtime", (value) => { value.nodeVersion = "v20.19.0"; }],
    ["npm-cli", (value) => { value.npmVersion = null; }],
    ["git-cli", (value) => { value.gitVersion = null; }],
    ["repository-root", (value) => { value.repository.root = "D:/Study"; }],
    ["main-branch", (value) => { value.repository.currentBranch = "work"; }],
    ["delivery-baseline", (value) => { value.repository.relation = "local-ahead"; }],
    ["author-identity", (value) => { value.identity.emailConfigured = false; }],
    ["workspace-contract", (value) => { value.workspace.nodeEngine = ">=20"; }],
    ["npm-scripts", (value) => { value.workspace.scriptNames.pop(); }],
    ["workspace-dependencies", (value) => {
      value.workspace.dependencyMatching = 2;
      value.workspace.dependencyIssues = ["sharp@0.35.3 missing"];
    }],
    ["content-layout", (value) => { value.workspace.paths[0].present = false; }],
    ["obsidian-vault", (value) => { value.vault.obsidianDirectoryPresent = false; }],
    ["publisher-plugin", (value) => { value.vault.plugin.version = "1.13.0"; }],
  ];

  for (const [id, mutate] of cases) {
    const observation = structuredClone(healthyObservation());
    mutate(observation);
    const report = analyzeAuthorEnvironment(observation);
    const check = report.checks.find((candidate) => candidate.id === id);
    assert.equal(check.status, "attention", id);
    assert.equal(typeof check.resolution, "string", id);
    assert.ok(check.resolution.length > 0, id);
    assert.equal(report.status, "needs-attention", id);
    assert.ok(report.summary.attention > 0, id);
  }
});

async function createDoctorFixture() {
  const root = await mkdtemp(join(tmpdir(), "myblog-author-doctor-"));
  const remote = await mkdtemp(join(tmpdir(), "myblog-author-doctor-remote-"));
  const scripts = Object.fromEntries(
    AUTHOR_DOCTOR_REQUIRED_SCRIPTS.map((name) => [name, "node --version"]),
  );
  const packageSource = `${JSON.stringify({
    dependencies: { "fixture-package": "1.0.0" },
    devDependencies: {},
    engines: { node: ">=22.13.0" },
    name: "zach424-myblog",
    private: true,
    scripts,
  }, null, 2)}\n`;
  const pluginManifest =
    '{"id":"myblog-publisher","version":"1.48.0","isDesktopOnly":true}\n';
  const pluginMain = "module.exports = {};\n";
  const pluginStyles = ".fixture {}\n";
  const pluginBundle = `${JSON.stringify(
    {
      version: 1,
      algorithm: "sha256",
      plugin: { id: "myblog-publisher", version: "1.48.0" },
      files: [
        ["main.js", pluginMain],
        ["manifest.json", pluginManifest],
        ["styles.css", pluginStyles],
      ].map(([path, content]) => ({
        path,
        sha256: createHash("sha256").update(content).digest("hex"),
      })),
    },
    null,
    2,
  )}\n`;
  await Promise.all([
    ...AUTHOR_DOCTOR_REQUIRED_PATHS.map(({ kind, path }) =>
      kind === "directory"
        ? mkdir(join(root, ...path.split("/")), { recursive: true })
        : mkdir(join(root, ...path.split("/").slice(0, -1)), { recursive: true }),
    ),
    mkdir(join(root, ".obsidian", "plugins", "myblog-publisher"), {
      recursive: true,
    }),
    mkdir(join(root, "node_modules", "fixture-package"), { recursive: true }),
  ]);
  for (const { kind, path } of AUTHOR_DOCTOR_REQUIRED_PATHS) {
    if (kind === "file") await writeFile(join(root, ...path.split("/")), "# Status\n");
  }
  await Promise.all([
    writeFile(join(root, ".gitignore"), "node_modules/\n"),
    writeFile(join(root, "package.json"), packageSource),
    writeFile(
      join(root, "node_modules", "fixture-package", "package.json"),
      '{"name":"fixture-package","version":"1.0.0"}\n',
    ),
    writeFile(
      join(root, ".obsidian", "plugins", "myblog-publisher", "manifest.json"),
      pluginManifest,
    ),
    writeFile(
      join(root, ".obsidian", "plugins", "myblog-publisher", "main.js"),
      pluginMain,
    ),
    writeFile(
      join(root, ".obsidian", "plugins", "myblog-publisher", "styles.css"),
      pluginStyles,
    ),
    writeFile(
      join(root, ".obsidian", "plugins", "myblog-publisher", "bundle.json"),
      pluginBundle,
    ),
  ]);
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Author Doctor Test");
  git(root, "config", "user.email", "doctor@example.test");
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture: author environment");
  run(remote, "git", ["init", "--bare"]);
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "-u", "origin", "main");
  return { packageSource, remote, root };
}

test("reports a real ready repository after its remote becomes unavailable", async () => {
  const fixture = await createDoctorFixture();
  try {
    const before = {
      head: git(fixture.root, "rev-parse", "HEAD"),
      index: git(fixture.root, "write-tree"),
      worktree: git(fixture.root, "status", "--porcelain=v2"),
    };
    await rm(fixture.remote, { force: true, recursive: true });
    const result = run(
      fixture.root,
      process.execPath,
      ["--experimental-strip-types", reportScriptPath, "--format", "json"],
      { allowFailure: true },
    );
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status, "ready");
    assert.deepEqual(report.summary, { attention: 0, passed: 13, total: 13 });
    assert.equal(report.observation.repository.relation, "synchronized");
    assert.equal(report.safety.networkChecked, false);
    assert.equal(report.safety.credentialsRead, false);

    const bundleResult = run(
      fixture.root,
      process.execPath,
      [
        "--experimental-strip-types",
        reportScriptPath,
        "--format",
        "json",
        "--plugin-bundle",
      ],
      { allowFailure: true },
    );
    assert.equal(
      bundleResult.status,
      0,
      `${bundleResult.stdout}\n${bundleResult.stderr}`,
    );
    const bundleReport = JSON.parse(bundleResult.stdout);
    assert.equal(bundleReport.version, 2);
    assert.equal(bundleReport.status, "ready");
    assert.deepEqual(bundleReport.summary, {
      attention: 0,
      passed: 14,
      total: 14,
    });
    assert.deepEqual(bundleReport.pluginBundle, {
      descriptorStatus: "valid",
      files: bundleReport.pluginBundle.files.map((file) => ({
        expectedSha256: file.expectedSha256,
        observedSha256: file.observedSha256,
        path: file.path,
        status: "verified",
      })),
      plugin: { id: "myblog-publisher", version: "1.48.0" },
      version: 1,
    });
    assert.deepEqual(
      bundleReport.pluginBundle.files.map((file) => file.path),
      ["main.js", "manifest.json", "styles.css"],
    );
    assert.ok(
      bundleReport.pluginBundle.files.every(
        (file) =>
          /^[a-f0-9]{64}$/u.test(file.expectedSha256) &&
          file.expectedSha256 === file.observedSha256,
      ),
    );
    assert.equal(
      bundleReport.checks.at(-1).id,
      "publisher-bundle",
    );

    const provenanceResult = run(
      fixture.root,
      process.execPath,
      [
        "--experimental-strip-types",
        reportScriptPath,
        "--format",
        "json",
        "--plugin-provenance",
      ],
      { allowFailure: true },
    );
    assert.equal(
      provenanceResult.status,
      0,
      `${provenanceResult.stdout}\n${provenanceResult.stderr}`,
    );
    const provenanceReport = JSON.parse(provenanceResult.stdout);
    assert.equal(provenanceReport.version, 3);
    assert.equal(provenanceReport.status, "ready");
    assert.deepEqual(provenanceReport.summary, {
      attention: 0,
      passed: 15,
      total: 15,
    });
    assert.equal(provenanceReport.pluginProvenance.version, 1);
    assert.match(provenanceReport.pluginProvenance.headOid, /^[a-f0-9]{40}$/u);
    assert.deepEqual(
      provenanceReport.pluginProvenance.files.map(
        ({ indexStatus, path, present, status, worktreeStatus }) => ({
          indexStatus,
          path,
          present,
          status,
          worktreeStatus,
        }),
      ),
      ["bundle.json", "main.js", "manifest.json", "styles.css"].map(
        (name) => ({
          indexStatus: "clean",
          path: `.obsidian/plugins/myblog-publisher/${name}`,
          present: true,
          status: "verified",
          worktreeStatus: "clean",
        }),
      ),
    );
    assert.ok(
      provenanceReport.pluginProvenance.files.every(
        (file) =>
          /^[a-f0-9]{40}$/u.test(file.headBlobOid) &&
          file.headBlobOid === file.indexBlobOid,
      ),
    );
    assert.equal(provenanceReport.checks.at(-1).id, "publisher-provenance");

    const stylesPath = join(
      fixture.root,
      ".obsidian",
      "plugins",
      "myblog-publisher",
      "styles.css",
    );
    const bundlePath = join(
      fixture.root,
      ".obsidian",
      "plugins",
      "myblog-publisher",
      "bundle.json",
    );
    const [originalStyles, originalBundle] = await Promise.all([
      readFile(stylesPath, "utf8"),
      readFile(bundlePath, "utf8"),
    ]);
    await writeFile(stylesPath, `${originalStyles}.partial-update {}\n`);
    const partialResult = run(
      fixture.root,
      process.execPath,
      [
        "--experimental-strip-types",
        reportScriptPath,
        "--format",
        "json",
        "--plugin-bundle",
      ],
      { allowFailure: true },
    );
    assert.equal(partialResult.status, 1);
    const partialReport = JSON.parse(partialResult.stdout);
    assert.equal(partialReport.status, "needs-attention");
    assert.equal(partialReport.pluginBundle.files.at(-1).status, "mismatch");
    assert.match(
      partialReport.checks.at(-1).observed,
      /2\/3 SHA-256 verified.*styles\.css mismatch/u,
    );
    const partialProvenanceResult = run(
      fixture.root,
      process.execPath,
      [
        "--experimental-strip-types",
        reportScriptPath,
        "--format",
        "json",
        "--plugin-provenance",
      ],
      { allowFailure: true },
    );
    assert.equal(partialProvenanceResult.status, 1);
    const partialProvenance = JSON.parse(partialProvenanceResult.stdout);
    const dirtyStyles = partialProvenance.pluginProvenance.files.at(-1);
    assert.equal(dirtyStyles.indexStatus, "clean");
    assert.equal(dirtyStyles.worktreeStatus, "changed");
    assert.equal(dirtyStyles.status, "unverified");

    git(fixture.root, "add", ".obsidian/plugins/myblog-publisher/styles.css");
    const stagedProvenanceResult = run(
      fixture.root,
      process.execPath,
      [
        "--experimental-strip-types",
        reportScriptPath,
        "--format",
        "json",
        "--plugin-provenance",
      ],
      { allowFailure: true },
    );
    assert.equal(stagedProvenanceResult.status, 1);
    const stagedProvenance = JSON.parse(stagedProvenanceResult.stdout);
    const stagedStyles = stagedProvenance.pluginProvenance.files.at(-1);
    assert.equal(stagedStyles.indexStatus, "changed");
    assert.equal(stagedStyles.worktreeStatus, "clean");
    assert.notEqual(stagedStyles.headBlobOid, stagedStyles.indexBlobOid);
    assert.equal(stagedStyles.status, "unverified");

    await writeFile(stylesPath, originalStyles);
    git(fixture.root, "add", ".obsidian/plugins/myblog-publisher/styles.css");

    const forgedBundle = JSON.parse(originalBundle);
    forgedBundle.unknown = true;
    await writeFile(bundlePath, `${JSON.stringify(forgedBundle, null, 2)}\n`);
    const forgedResult = run(
      fixture.root,
      process.execPath,
      [
        "--experimental-strip-types",
        reportScriptPath,
        "--format",
        "json",
        "--plugin-bundle",
      ],
      { allowFailure: true },
    );
    assert.equal(forgedResult.status, 1);
    const forgedReport = JSON.parse(forgedResult.stdout);
    assert.equal(forgedReport.pluginBundle.descriptorStatus, "invalid");
    assert.ok(
      forgedReport.pluginBundle.files.every(
        (file) => file.status === "untrusted",
      ),
    );
    assert.match(forgedReport.checks.at(-1).observed, /bundle\.json invalid/u);
    await writeFile(bundlePath, originalBundle);

    const textResult = run(
      fixture.root,
      process.execPath,
      ["--experimental-strip-types", reportScriptPath],
      { allowFailure: true },
    );
    assert.equal(textResult.status, 0, textResult.stderr);
    assert.match(textResult.stdout, /AUTHOR READY/u);
    assert.match(textResult.stdout, /Plugin bundle.*3\/3 SHA-256 verified/u);
    assert.match(textResult.stdout, /未读取凭据、未访问网络/u);
    assert.deepEqual(
      {
        head: git(fixture.root, "rev-parse", "HEAD"),
        index: git(fixture.root, "write-tree"),
        worktree: git(fixture.root, "status", "--porcelain=v2"),
      },
      before,
    );
    assert.equal(
      await readFile(join(fixture.root, "package.json"), "utf8"),
      fixture.packageSource,
    );
  } finally {
    await Promise.all([
      rm(fixture.root, { force: true, recursive: true }),
      rm(fixture.remote, { force: true, recursive: true }),
    ]);
  }
});
