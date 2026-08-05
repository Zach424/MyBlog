import { extname } from "node:path";
import { isSupportedImageExtension } from "../media-policy.ts";

export const DEFERRED_INBOX_NOTE_PATTERN =
  /^content\/inbox\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;
export const ROOT_STAGING_MEDIA_PATTERN =
  /^public\/uploads\/[^/\u0000-\u001f\u007f]+$/u;

export type ContentReviewWorktreeInput = {
  changedPaths: readonly string[];
  sourcePath: string;
  stagedPaths: readonly string[];
  untrackedPaths: readonly string[];
};

export type ContentReviewWorktreeImpact = {
  blockingPaths: string[];
  changedPaths: string[];
  committablePaths: string[];
  deferredPaths: string[];
  stagedPaths: string[];
  targetChanged: boolean;
  untrackedPaths: string[];
};

function sortUnique(paths: readonly string[]) {
  return [...new Set(paths)].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
}

export function isDeferredModifiedReviewPath(sourcePath: string) {
  return DEFERRED_INBOX_NOTE_PATTERN.test(sourcePath);
}

export function isDeferredUntrackedReviewPath(sourcePath: string) {
  return (
    isDeferredModifiedReviewPath(sourcePath) ||
    (ROOT_STAGING_MEDIA_PATTERN.test(sourcePath) &&
      isSupportedImageExtension(extname(sourcePath)))
  );
}

export function classifyContentReviewWorktree({
  changedPaths,
  sourcePath,
  stagedPaths,
  untrackedPaths,
}: ContentReviewWorktreeInput): ContentReviewWorktreeImpact {
  const changed = sortUnique(changedPaths);
  const staged = sortUnique(stagedPaths);
  const untracked = sortUnique(untrackedPaths);
  const targetChanged = changed.includes(sourcePath);
  const modifiedDeferred = changed.filter(
    (path) => path !== sourcePath && isDeferredModifiedReviewPath(path),
  );
  const untrackedDeferred = untracked.filter(isDeferredUntrackedReviewPath);
  const blockingPaths = sortUnique([
    ...changed.filter(
      (path) => path !== sourcePath && !isDeferredModifiedReviewPath(path),
    ),
    ...untracked.filter((path) => !isDeferredUntrackedReviewPath(path)),
  ]);
  const committable =
    targetChanged && staged.length === 0 && blockingPaths.length === 0
      ? [sourcePath]
      : [];

  return {
    blockingPaths,
    changedPaths: changed,
    committablePaths: committable,
    deferredPaths: sortUnique([...modifiedDeferred, ...untrackedDeferred]),
    stagedPaths: staged,
    targetChanged,
    untrackedPaths: untracked,
  };
}
