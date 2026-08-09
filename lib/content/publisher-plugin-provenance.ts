export const PUBLISHER_PLUGIN_PROVENANCE_VERSION = 1 as const;

export const PUBLISHER_PLUGIN_PROVENANCE_PATHS = [
  ".obsidian/plugins/myblog-publisher/bundle.json",
  ".obsidian/plugins/myblog-publisher/main.js",
  ".obsidian/plugins/myblog-publisher/manifest.json",
  ".obsidian/plugins/myblog-publisher/styles.css",
] as const;

export type PublisherPluginGitPathStatus =
  | "clean"
  | "changed"
  | "unavailable";

export type PublisherPluginProvenanceObservation = {
  version: typeof PUBLISHER_PLUGIN_PROVENANCE_VERSION;
  headOid: string | null;
  files: Array<{
    path: (typeof PUBLISHER_PLUGIN_PROVENANCE_PATHS)[number];
    present: boolean;
    headBlobOid: string | null;
    indexBlobOid: string | null;
    indexStatus: PublisherPluginGitPathStatus;
    worktreeStatus: PublisherPluginGitPathStatus;
    status: "verified" | "unverified";
  }>;
};

const GIT_OBJECT_ID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

export function isPublisherPluginProvenanceVerified(
  observation: PublisherPluginProvenanceObservation,
): boolean {
  return (
    observation.version === PUBLISHER_PLUGIN_PROVENANCE_VERSION &&
    observation.headOid !== null &&
    GIT_OBJECT_ID_PATTERN.test(observation.headOid) &&
    observation.files.length === PUBLISHER_PLUGIN_PROVENANCE_PATHS.length &&
    observation.files.every(
      (file, index) =>
        file.path === PUBLISHER_PLUGIN_PROVENANCE_PATHS[index] &&
        file.present &&
        file.headBlobOid !== null &&
        GIT_OBJECT_ID_PATTERN.test(file.headBlobOid) &&
        file.indexBlobOid === file.headBlobOid &&
        file.indexStatus === "clean" &&
        file.worktreeStatus === "clean" &&
        file.status === "verified",
    )
  );
}

export function describePublisherPluginProvenance(
  observation: PublisherPluginProvenanceObservation,
): string {
  const verified = observation.files.filter(
    (file) => file.status === "verified",
  ).length;
  const failures = observation.files
    .filter((file) => file.status !== "verified")
    .map((file) => {
      const name = file.path.split("/").at(-1) ?? file.path;
      if (!file.present) return `${name} missing`;
      if (file.indexStatus !== "clean") {
        return `${name} index ${file.indexStatus}`;
      }
      if (file.worktreeStatus !== "clean") {
        return `${name} worktree ${file.worktreeStatus}`;
      }
      return `${name} HEAD/index mismatch`;
    });
  return `HEAD ${observation.headOid?.slice(0, 12) ?? "UNAVAILABLE"} · ${verified}/${PUBLISHER_PLUGIN_PROVENANCE_PATHS.length} tracked clean${failures.length > 0 ? ` · ${failures.join(" · ")}` : ""}`;
}

export function clonePublisherPluginProvenance(
  source: PublisherPluginProvenanceObservation,
): PublisherPluginProvenanceObservation {
  return {
    files: source.files.map((file) => ({ ...file })),
    headOid: source.headOid,
    version: source.version,
  };
}
