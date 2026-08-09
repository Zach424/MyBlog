import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createSha256ConditionalResponse,
  createSha256Etag,
} from "../lib/http-validators.ts";

const body = "deterministic discovery body\n";
const url = "https://blog.example.test/feed.json";
const headers = {
  "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
  "content-type": "application/feed+json; charset=utf-8",
};

function expectedEtag(value) {
  return `"sha256-${createHash("sha256").update(value, "utf8").digest("hex")}"`;
}

test("returns the final body with a strong SHA-256 validator", async () => {
  const response = createSha256ConditionalResponse(
    new Request(url),
    body,
    headers,
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), body);
  assert.equal(response.headers.get("etag"), expectedEtag(body));
  assert.equal(response.headers.get("etag"), createSha256Etag(body));
  assert.equal(response.headers.get("cache-control"), headers["cache-control"]);
  assert.equal(response.headers.get("content-type"), headers["content-type"]);
});

test("returns one header-complete empty 304 for every matching form", async () => {
  const etag = expectedEtag(body);

  for (const value of [etag, `W/${etag}`, `"other", W/${etag}`, "*"]) {
    const response = createSha256ConditionalResponse(
      new Request(url, { headers: { "if-none-match": value } }),
      body,
      headers,
    );

    assert.equal(response.status, 304, value);
    assert.equal(await response.text(), "", value);
    assert.equal(response.headers.get("etag"), etag, value);
    assert.equal(response.headers.get("cache-control"), headers["cache-control"], value);
    assert.equal(response.headers.get("content-type"), headers["content-type"], value);
  }
});

test("returns the complete body for stale or malformed validators", async () => {
  for (const value of ['"sha256-stale"', '"unterminated', "", "garbage"]) {
    const response = createSha256ConditionalResponse(
      new Request(url, { headers: { "if-none-match": value } }),
      body,
      headers,
    );

    assert.equal(response.status, 200, value);
    assert.equal(await response.text(), body, value);
    assert.equal(response.headers.get("etag"), expectedEtag(body), value);
  }
});
