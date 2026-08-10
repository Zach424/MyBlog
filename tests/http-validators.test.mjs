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
const lastModified = "Sun, 06 Nov 1994 08:49:37 GMT";

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

test("emits one canonical Last-Modified validator when explicitly configured", async () => {
  const response = createSha256ConditionalResponse(
    new Request(url),
    body,
    headers,
    { lastModified },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("last-modified"), lastModified);
  assert.equal(await response.text(), body);
});

test("accepts every HTTP-date form for If-Modified-Since", async () => {
  for (const value of [
    lastModified,
    "Sunday, 06-Nov-94 08:49:37 GMT",
    "Sun Nov  6 08:49:37 1994",
    "Sun, 06 Nov 1994 08:49:38 GMT",
  ]) {
    const response = createSha256ConditionalResponse(
      new Request(url, { headers: { "if-modified-since": value } }),
      body,
      headers,
      { lastModified },
    );

    assert.equal(response.status, 304, value);
    assert.equal(await response.text(), "", value);
    assert.equal(response.headers.get("etag"), expectedEtag(body), value);
    assert.equal(response.headers.get("last-modified"), lastModified, value);
  }
});

test("ignores stale, malformed, repeated, and calendar-invalid date validators", async () => {
  for (const value of [
    "Sun, 06 Nov 1994 08:49:36 GMT",
    "1994-11-06T08:49:37Z",
    `${lastModified}, ${lastModified}`,
    "Thursday, 31-Feb-94 08:49:37 GMT",
    "Mon Nov  6 08:49:37 1994",
  ]) {
    const response = createSha256ConditionalResponse(
      new Request(url, { headers: { "if-modified-since": value } }),
      body,
      headers,
      { lastModified },
    );

    assert.equal(response.status, 200, value);
    assert.equal(await response.text(), body, value);
  }
});

test("gives If-None-Match precedence over every date condition", async () => {
  const etag = expectedEtag(body);
  const staleTag = await createSha256ConditionalResponse(
    new Request(url, {
      headers: {
        "if-none-match": '"sha256-stale"',
        "if-modified-since": lastModified,
      },
    }),
    body,
    headers,
    { lastModified },
  );
  const malformedTag = await createSha256ConditionalResponse(
    new Request(url, {
      headers: {
        "if-none-match": '"unterminated',
        "if-modified-since": lastModified,
      },
    }),
    body,
    headers,
    { lastModified },
  );
  const matchingTag = await createSha256ConditionalResponse(
    new Request(url, {
      headers: {
        "if-none-match": etag,
        "if-modified-since": "Sun, 06 Nov 1994 08:49:36 GMT",
      },
    }),
    body,
    headers,
    { lastModified },
  );

  assert.equal(staleTag.status, 200);
  assert.equal(malformedTag.status, 200);
  assert.equal(matchingTag.status, 304);
});

test("rejects response validators that are not canonical or are in the future", () => {
  assert.throws(
    () =>
      createSha256ConditionalResponse(new Request(url), body, headers, {
        lastModified: "Sunday, 06-Nov-94 08:49:37 GMT",
      }),
    /lastModified must be a canonical IMF-fixdate/u,
  );
  assert.throws(
    () =>
      createSha256ConditionalResponse(new Request(url), body, headers, {
        lastModified: "Sat, 06 Nov 2094 08:49:37 GMT",
      }),
    /lastModified cannot be in the future/u,
  );
});
