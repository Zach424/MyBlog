import { readFileSync } from "node:fs";

const requiredFiles = [
  ".github/workflows/quality.yml",
  ".github/workflows/production-smoke.yml",
  ".github/workflows/rollback.yml",
  ".env.example",
];

for (const file of requiredFiles) {
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

const smokeWorkflow = readFileSync(
  new URL("../.github/workflows/production-smoke.yml", import.meta.url),
  "utf8",
);

const qualityWorkflow = readFileSync(
  new URL("../.github/workflows/quality.yml", import.meta.url),
  "utf8",
);
for (const marker of ["schedule:", 'cron: "0 1 * * 1"', "content:status", "--github-summary"]) {
  if (!qualityWorkflow.includes(marker)) {
    throw new Error(`Quality workflow is missing content maintenance marker: ${marker}`);
  }
}

for (const marker of [
  "deployment_status",
  "Production",
  "environment_url",
  "production:smoke",
  "--expect-oauth",
]) {
  if (!smokeWorkflow.includes(marker)) {
    throw new Error(`Production smoke workflow is missing required marker: ${marker}`);
  }
}

const rollbackWorkflow = readFileSync(
  new URL("../.github/workflows/rollback.yml", import.meta.url),
  "utf8",
);
for (const marker of ["vercel@56.3.2", "rollback", "VERCEL_TOKEN", "VERCEL_PRODUCTION_URL", "production:smoke"]) {
  if (!rollbackWorkflow.includes(marker)) {
    throw new Error(`Rollback workflow is missing required marker: ${marker}`);
  }
}

for (const [name, workflow] of [
  ["quality", qualityWorkflow],
  ["production smoke", smokeWorkflow],
  ["rollback", rollbackWorkflow],
]) {
  for (const marker of [
    "uses: actions/checkout@v6",
    "uses: actions/setup-node@v6",
    "node-version: 22",
    "cache: npm",
  ]) {
    if (!workflow.includes(marker)) {
      throw new Error(`${name} workflow is missing the current Actions runtime contract: ${marker}`);
    }
  }

  if (/actions\/(?:checkout|setup-node)@v[1-5]\b/u.test(workflow)) {
    throw new Error(`${name} workflow still references a pre-Node 24 action major.`);
  }
}

console.log("Release configuration is complete.");
