import assert from "node:assert/strict";
import test from "node:test";

import {
  createPostDeliveryHandoff,
  createPostDeliveryHandoffTarget,
  formatPostDeliveryHandoffLine,
  POST_DELIVERY_HANDOFF_PREFIX,
} from "../lib/content/post-delivery-handoff.ts";

const origin = "https://blog.example.test";
const sourcePath = "content/posts/handoff-note.md";
const source = Buffer.from(`---
title: "Handoff note"
description: "A delivered post with a frozen production identity."
type: article
publishedAt: 2026-08-10
freshness: historical
reviewedAt: 2026-08-10
tags: ["TypeScript"]
draft: false
featured: false
---

## Delivered

Stable body.
`);

test("creates one immutable post-delivery handoff from exact source bytes", () => {
  const target = createPostDeliveryHandoffTarget({ origin, source, sourcePath });
  const handoff = createPostDeliveryHandoff({
    commitOid: "a".repeat(40),
    delivery: "publication",
    target,
  });

  assert.equal(Object.isFrozen(handoff), true);
  assert.equal(Object.isFrozen(handoff.target), true);
  assert.deepEqual(handoff, {
    version: 1,
    mode: "post-delivery",
    delivery: "publication",
    commitOid: "a".repeat(40),
    target: {
      id: `${origin}/posts/handoff-note`,
      kind: "post",
      type: "article",
      title: "Handoff note",
      sourcePath,
      markdownUrl: `${origin}/posts/handoff-note/source.md`,
      localEtag: target.localEtag,
      sourceSha256: target.sourceSha256,
    },
    safety: {
      gitDelivered: true,
      productionChecked: false,
      waitStarted: false,
    },
  });
  const line = formatPostDeliveryHandoffLine(handoff);
  assert.equal(line.startsWith(POST_DELIVERY_HANDOFF_PREFIX), true);
  assert.deepEqual(
    JSON.parse(line.slice(POST_DELIVERY_HANDOFF_PREFIX.length)),
    handoff,
  );
});

test("rejects forged delivery identity before a handoff can be emitted", () => {
  const target = createPostDeliveryHandoffTarget({ origin, source, sourcePath });
  assert.throws(
    () => createPostDeliveryHandoff({
      commitOid: "not-a-commit",
      delivery: "publication",
      target,
    }),
    /commitOid/u,
  );
  assert.throws(
    () => createPostDeliveryHandoff({
      commitOid: "b".repeat(40),
      delivery: "unknown",
      target,
    }),
    /delivery/u,
  );
  assert.throws(
    () => createPostDeliveryHandoffTarget({
      origin,
      source,
      sourcePath: "content/inbox/handoff-note.md",
    }),
    /content\/posts.*content\/projects/u,
  );
});
