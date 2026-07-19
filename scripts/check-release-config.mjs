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

console.log("Release configuration is complete.");
