import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import YAML from "yaml";

const workflowNames = ["quality", "production-smoke", "rollback"];

async function readWorkflow(name) {
  const source = await readFile(
    new URL(`../.github/workflows/${name}.yml`, import.meta.url),
    "utf8",
  );

  return {
    source,
    value: YAML.parse(source),
  };
}

function getOnlyJob(workflow) {
  const jobs = Object.values(workflow.jobs);
  assert.equal(jobs.length, 1);
  return jobs[0];
}

test("uses Node 24 GitHub actions while keeping the application on Node 22", async () => {
  for (const name of workflowNames) {
    const { source, value } = await readWorkflow(name);
    const job = getOnlyJob(value);
    const actionSteps = job.steps.filter((step) => step.uses);

    assert.equal(job["runs-on"], "ubuntu-latest", `${name} must stay on a GitHub-hosted runner`);
    assert.deepEqual(value.permissions, { contents: "read" }, `${name} permissions changed`);
    assert.deepEqual(
      actionSteps.map((step) => step.uses),
      ["actions/checkout@v6", "actions/setup-node@v6"],
      `${name} must use the Node 24 action majors`,
    );
    assert.deepEqual(
      actionSteps[1].with,
      { "node-version": 22, cache: "npm" },
      `${name} must keep the explicit Node 22 and npm cache contract`,
    );
    assert.doesNotMatch(source, /actions\/(?:checkout|setup-node)@v[1-5]\b/u);
    assert.doesNotMatch(source, /always-auth/u);
  }
});

test("preserves Quality Gate triggers, cancellation, and commands", async () => {
  const { value } = await readWorkflow("quality");
  const job = getOnlyJob(value);

  assert.deepEqual(value.on, {
    pull_request: null,
    push: { branches: ["main"] },
    schedule: [{ cron: "0 1 * * 1" }],
    workflow_dispatch: null,
  });
  assert.deepEqual(value.concurrency, {
    group: "quality-${{ github.ref }}",
    "cancel-in-progress": true,
  });
  assert.equal(job["timeout-minutes"], 20);
  assert.deepEqual(
    job.steps.filter((step) => step.run).map((step) => step.run),
    [
      "npm ci",
      "npm run content:status -- --github-summary",
      "npm run media:staging -- --github-summary",
      "npm run check",
      "npm audit --omit=dev --audit-level=high",
    ],
  );
});

test("preserves deployment-status and manual production smoke semantics", async () => {
  const { value } = await readWorkflow("production-smoke");
  const job = getOnlyJob(value);

  assert.deepEqual(value.on, {
    deployment_status: null,
    workflow_dispatch: {
      inputs: {
        deployment_url: {
          description: "Production deployment URL to verify",
          required: true,
          type: "string",
        },
      },
    },
  });
  assert.deepEqual(value.concurrency, {
    group: "vercel-production-smoke",
    "cancel-in-progress": true,
  });
  assert.match(job.if, /deployment_status\.state == 'success'/u);
  assert.match(job.if, /deployment\.environment == 'Production'/u);
  assert.match(job.env.DEPLOYMENT_URL, /vars\.VERCEL_PRODUCTION_URL/u);
  assert.match(job.env.DEPLOYMENT_URL, /environment_url/u);
  assert.equal(job["timeout-minutes"], 10);
  assert.equal(
    job.steps.at(-1).run,
    'npm run production:smoke -- "$DEPLOYMENT_URL" --expect-oauth',
  );
});

test("preserves the manual-only production rollback boundary", async () => {
  const { value } = await readWorkflow("rollback");
  const job = getOnlyJob(value);

  assert.deepEqual(Object.keys(value.on), ["workflow_dispatch"]);
  assert.deepEqual(Object.keys(value.on.workflow_dispatch.inputs), ["deployment_url", "reason"]);
  assert.equal(value.on.workflow_dispatch.inputs.deployment_url.required, true);
  assert.equal(value.on.workflow_dispatch.inputs.reason.required, true);
  assert.deepEqual(value.concurrency, {
    group: "vercel-production",
    "cancel-in-progress": false,
  });
  assert.deepEqual(job.environment, { name: "production" });
  assert.equal(job["timeout-minutes"], 15);
  assert.equal(job.env.VERCEL_TOKEN, "${{ secrets.VERCEL_TOKEN }}");
  assert.equal(job.env.VERCEL_ORG_ID, "${{ secrets.VERCEL_ORG_ID }}");
  assert.equal(job.env.VERCEL_PROJECT_ID, "${{ secrets.VERCEL_PROJECT_ID }}");
  assert.match(job.steps.at(-2).run, /vercel@56\.3\.2/u);
  assert.equal(
    job.steps.at(-1).run,
    'npm run production:smoke -- "$PRODUCTION_URL" --expect-oauth',
  );
});
