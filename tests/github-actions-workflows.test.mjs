import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import YAML from "yaml";
import {
  assertImmutableGitHubActionPins,
  PINNED_GITHUB_ACTIONS,
} from "../scripts/github-actions-pins.mjs";

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

test("pins Node 24 GitHub actions while keeping the application on Node 22", async () => {
  for (const name of workflowNames) {
    const { source, value } = await readWorkflow(name);
    const job = getOnlyJob(value);
    const actionSteps = job.steps.filter((step) => step.uses);

    assert.equal(job["runs-on"], "ubuntu-latest", `${name} must stay on a GitHub-hosted runner`);
    assert.deepEqual(value.permissions, { contents: "read" }, `${name} permissions changed`);
    assert.deepEqual(
      actionSteps.map((step) => step.uses),
      assertImmutableGitHubActionPins(source, name),
      `${name} YAML values must match the source-level immutable pins`,
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

test("rejects floating, abbreviated, unreviewed, and mislabeled action pins", () => {
  const validSource = PINNED_GITHUB_ACTIONS
    .map(({ repository, sha, version }) => `      uses: ${repository}@${sha} # ${version}`)
    .join("\n");
  const cases = [
    {
      name: "floating major ref",
      source: validSource.replace(PINNED_GITHUB_ACTIONS[0].sha, "v6"),
      message: /full-length commit SHA/u,
    },
    {
      name: "abbreviated SHA",
      source: validSource.replace(
        PINNED_GITHUB_ACTIONS[0].sha,
        PINNED_GITHUB_ACTIONS[0].sha.slice(0, 12),
      ),
      message: /full-length commit SHA/u,
    },
    {
      name: "unreviewed full SHA",
      source: validSource.replace(PINNED_GITHUB_ACTIONS[0].sha, "0".repeat(40)),
      message: /reviewed v6 commit/u,
    },
    {
      name: "wrong repository",
      source: validSource.replace("actions/checkout", "someone/checkout"),
      message: /reviewed official repository/u,
    },
    {
      name: "comment drift",
      source: validSource.replace("# v6", "# latest"),
      message: /human-readable # v6 comment/u,
    },
  ];

  for (const example of cases) {
    assert.throws(
      () => assertImmutableGitHubActionPins(example.source, example.name),
      example.message,
    );
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
