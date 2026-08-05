import { analyzeContentDeliveryTriage } from "../lib/content/delivery-triage.ts";
import { analyzeContentPublishDelivery } from "../lib/content/publish-delivery.ts";
import { analyzeContentReviewDelivery } from "../lib/content/review-delivery.ts";
import { readContentDeliveryGitSnapshot } from "./delivery-git-snapshot.mjs";
import { readContentPublishCommitFromGit } from "./publish-delivery-git.mjs";
import { readContentReviewCommitFromGit } from "./review-delivery-git.mjs";

export function inspectContentDeliveryTriageFromGit(cwd = process.cwd()) {
  const snapshot = readContentDeliveryGitSnapshot(cwd);
  const inspectCommit = snapshot.ahead === 1 && snapshot.behind === 0;
  const review = analyzeContentReviewDelivery({
    ...snapshot,
    pendingCommit: inspectCommit
      ? readContentReviewCommitFromGit(snapshot.localHead, cwd)
      : null,
  });
  const publication = analyzeContentPublishDelivery({
    ...snapshot,
    pendingCommit: inspectCommit
      ? readContentPublishCommitFromGit(snapshot.localHead, cwd)
      : null,
  });
  return analyzeContentDeliveryTriage({ publication, review });
}
