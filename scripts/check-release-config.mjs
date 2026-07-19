import { readFileSync } from "node:fs";

const requiredFiles = [
  ".github/workflows/quality.yml",
  ".github/workflows/deploy.yml",
  ".github/workflows/rollback.yml",
  ".env.example",
];

for (const file of requiredFiles) {
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
}

const deployWorkflow = readFileSync(
  new URL("../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);

for (const marker of [
  "CLOUDFLARE_DEPLOY_ENABLED",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "GITHUB_OAUTH_ID",
  "GITHUB_OAUTH_SECRET",
  "npm run check",
  "dist/server/wrangler.json",
  "production:smoke",
]) {
  if (!deployWorkflow.includes(marker)) {
    throw new Error(`Deployment workflow is missing required marker: ${marker}`);
  }
}

const rollbackWorkflow = readFileSync(
  new URL("../.github/workflows/rollback.yml", import.meta.url),
  "utf8",
);
for (const marker of ["wrangler", "rollback", "--yes", "CLOUDFLARE_PRODUCTION_URL", "production:smoke"]) {
  if (!rollbackWorkflow.includes(marker)) {
    throw new Error(`Rollback workflow is missing required marker: ${marker}`);
  }
}

console.log("Release configuration is complete.");
