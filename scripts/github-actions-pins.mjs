export const PINNED_GITHUB_ACTIONS = Object.freeze([
  Object.freeze({
    repository: "actions/checkout",
    sha: "d23441a48e516b6c34aea4fa41551a30e30af803",
    version: "v6",
  }),
  Object.freeze({
    repository: "actions/setup-node",
    sha: "249970729cb0ef3589644e2896645e5dc5ba9c38",
    version: "v6",
  }),
]);

export function assertImmutableGitHubActionPins(source, workflowName) {
  const pins = [...source.matchAll(
    /^\s*uses:\s*(?<repository>[^@\s#]+)@(?<ref>[^\s#]+)(?:\s+#\s*(?<comment>\S+))?\s*$/gmu,
  )].map((match) => match.groups);

  if (pins.length !== PINNED_GITHUB_ACTIONS.length) {
    throw new Error(`${workflowName} must use exactly the reviewed GitHub actions`);
  }

  for (const [index, expected] of PINNED_GITHUB_ACTIONS.entries()) {
    const actual = pins[index];
    if (actual.repository !== expected.repository) {
      throw new Error(
        `${workflowName} action ${index + 1} must stay in the reviewed official repository`,
      );
    }
    if (!/^[0-9a-f]{40}$/u.test(actual.ref)) {
      throw new Error(
        `${workflowName} ${expected.repository} must use a full-length commit SHA`,
      );
    }
    if (actual.ref !== expected.sha) {
      throw new Error(
        `${workflowName} ${expected.repository} must stay on the reviewed ${expected.version} commit`,
      );
    }
    if (actual.comment !== expected.version) {
      throw new Error(
        `${workflowName} ${expected.repository} must retain the human-readable # ${expected.version} comment`,
      );
    }
  }

  return pins.map((pin) => `${pin.repository}@${pin.ref}`);
}
