import { createHash } from "node:crypto";

export const PUBLISHER_PLUGIN_BUNDLE_VERSION = 1 as const;
export const PUBLISHER_PLUGIN_BUNDLE_ALGORITHM = "sha256" as const;
export const PUBLISHER_PLUGIN_ID = "myblog-publisher";
export const PUBLISHER_PLUGIN_BUNDLE_FILES = [
  "main.js",
  "manifest.json",
  "styles.css",
] as const;

export type PublisherPluginBundlePath =
  (typeof PUBLISHER_PLUGIN_BUNDLE_FILES)[number];

export type PublisherPluginBundleDescriptor = {
  version: typeof PUBLISHER_PLUGIN_BUNDLE_VERSION;
  algorithm: typeof PUBLISHER_PLUGIN_BUNDLE_ALGORITHM;
  plugin: { id: string; version: string };
  files: Array<{ path: PublisherPluginBundlePath; sha256: string }>;
};

export type PublisherPluginBundleObservation = {
  descriptorStatus: "valid" | "invalid" | "missing";
  files: Array<{
    expectedSha256: string | null;
    observedSha256: string | null;
    path: PublisherPluginBundlePath;
    status: "verified" | "mismatch" | "missing" | "untrusted";
  }>;
  plugin: { id: string; version: string } | null;
  version: typeof PUBLISHER_PLUGIN_BUNDLE_VERSION | null;
};

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PLUGIN_VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const expected = [...keys].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parsePublisherPluginBundleDescriptor(
  source: unknown,
): PublisherPluginBundleDescriptor | null {
  if (
    !isPlainObject(source) ||
    !hasExactKeys(source, ["version", "algorithm", "plugin", "files"]) ||
    source.version !== PUBLISHER_PLUGIN_BUNDLE_VERSION ||
    source.algorithm !== PUBLISHER_PLUGIN_BUNDLE_ALGORITHM ||
    !isPlainObject(source.plugin) ||
    !hasExactKeys(source.plugin, ["id", "version"]) ||
    source.plugin.id !== PUBLISHER_PLUGIN_ID ||
    typeof source.plugin.version !== "string" ||
    !PLUGIN_VERSION_PATTERN.test(source.plugin.version) ||
    !Array.isArray(source.files) ||
    source.files.length !== PUBLISHER_PLUGIN_BUNDLE_FILES.length
  ) {
    return null;
  }

  const files = [];
  for (let index = 0; index < PUBLISHER_PLUGIN_BUNDLE_FILES.length; index += 1) {
    const expectedPath = PUBLISHER_PLUGIN_BUNDLE_FILES[index];
    const file = source.files[index];
    if (
      !isPlainObject(file) ||
      !hasExactKeys(file, ["path", "sha256"]) ||
      file.path !== expectedPath ||
      typeof file.sha256 !== "string" ||
      !SHA256_PATTERN.test(file.sha256)
    ) {
      return null;
    }
    files.push({ path: expectedPath, sha256: file.sha256 });
  }

  return {
    version: PUBLISHER_PLUGIN_BUNDLE_VERSION,
    algorithm: PUBLISHER_PLUGIN_BUNDLE_ALGORITHM,
    plugin: {
      id: source.plugin.id,
      version: source.plugin.version,
    },
    files,
  };
}

export function createPublisherPluginBundleDescriptor(
  pluginVersion: string,
  files: Record<PublisherPluginBundlePath, Uint8Array>,
): PublisherPluginBundleDescriptor {
  if (!PLUGIN_VERSION_PATTERN.test(pluginVersion)) {
    throw new Error("插件版本必须是完整数字语义版本");
  }
  return {
    version: PUBLISHER_PLUGIN_BUNDLE_VERSION,
    algorithm: PUBLISHER_PLUGIN_BUNDLE_ALGORITHM,
    plugin: { id: PUBLISHER_PLUGIN_ID, version: pluginVersion },
    files: PUBLISHER_PLUGIN_BUNDLE_FILES.map((path) => ({
      path,
      sha256: sha256(files[path]),
    })),
  };
}

export function observePublisherPluginBundle(
  descriptorSource: unknown | undefined,
  files: Record<PublisherPluginBundlePath, Uint8Array | null>,
): PublisherPluginBundleObservation {
  const descriptor =
    descriptorSource === undefined
      ? null
      : parsePublisherPluginBundleDescriptor(descriptorSource);
  const descriptorStatus =
    descriptorSource === undefined
      ? "missing"
      : descriptor === null
        ? "invalid"
        : "valid";
  return {
    descriptorStatus,
    files: PUBLISHER_PLUGIN_BUNDLE_FILES.map((path, index) => {
      const bytes = files[path];
      const expectedSha256 = descriptor?.files[index].sha256 ?? null;
      const observedSha256 = bytes === null ? null : sha256(bytes);
      return {
        expectedSha256,
        observedSha256,
        path,
        status:
          observedSha256 === null
            ? "missing"
            : expectedSha256 === null
              ? "untrusted"
              : expectedSha256 === observedSha256
                ? "verified"
                : "mismatch",
      };
    }),
    plugin: descriptor ? { ...descriptor.plugin } : null,
    version: descriptor?.version ?? null,
  };
}

export function isPublisherPluginBundleVerified(
  observation: PublisherPluginBundleObservation,
  pluginVersion: string | null,
): boolean {
  return (
    observation.descriptorStatus === "valid" &&
    observation.version === PUBLISHER_PLUGIN_BUNDLE_VERSION &&
    observation.plugin?.id === PUBLISHER_PLUGIN_ID &&
    observation.plugin.version === pluginVersion &&
    observation.files.length === PUBLISHER_PLUGIN_BUNDLE_FILES.length &&
    observation.files.every(
      (file, index) =>
        file.path === PUBLISHER_PLUGIN_BUNDLE_FILES[index] &&
        file.status === "verified" &&
        file.expectedSha256 !== null &&
        file.expectedSha256 === file.observedSha256,
    )
  );
}

export function describePublisherPluginBundle(
  observation: PublisherPluginBundleObservation,
  pluginVersion: string | null,
): string {
  const verified = observation.files.filter(
    (file) => file.status === "verified",
  ).length;
  const failures = observation.files
    .filter((file) => file.status !== "verified")
    .map((file) => `${file.path} ${file.status}`);
  const descriptorFailure =
    observation.descriptorStatus === "valid"
      ? []
      : [`bundle.json ${observation.descriptorStatus}`];
  return `${PUBLISHER_PLUGIN_ID}@${pluginVersion ?? "unknown"} · ${verified}/${PUBLISHER_PLUGIN_BUNDLE_FILES.length} SHA-256 verified${[...descriptorFailure, ...failures].length > 0 ? ` · ${[...descriptorFailure, ...failures].join(" · ")}` : ""}`;
}
