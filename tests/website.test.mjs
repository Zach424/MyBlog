import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createWebsiteStructuredData } from "../lib/website.ts";
import {
  SITE_DESCRIPTION,
  SITE_LANGUAGE,
  SITE_TITLE,
} from "../lib/site.ts";

test("creates one canonical root WebSite identity from shared site facts", () => {
  const siteUrl = new URL(
    "https://blog.example.test/preview?source=test#fragment",
  );
  const originalHref = siteUrl.href;

  assert.deepEqual(createWebsiteStructuredData(siteUrl), {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://blog.example.test/#website",
    name: SITE_TITLE,
    url: "https://blog.example.test/",
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
  });
  assert.equal(siteUrl.href, originalHref);
});

test("rejects unsafe WebSite origins and does not invent unsupported search actions", () => {
  assert.throws(
    () => createWebsiteStructuredData(new URL("ftp://blog.example.test")),
    /http or https/u,
  );
  assert.throws(
    () => createWebsiteStructuredData(new URL("https://author:secret@blog.example.test")),
    /credentials/u,
  );

  const document = createWebsiteStructuredData(
    new URL("https://blog.example.test"),
  );
  assert.equal("alternateName" in document, false);
  assert.equal("potentialAction" in document, false);
  assert.doesNotMatch(JSON.stringify(document), /SearchAction/u);
});

test("keeps the WebSite identity on the homepage server boundary", async () => {
  const [homePage, rootLayout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(homePage, /^["']use client["'];?/mu);
  assert.match(homePage, /createWebsiteStructuredData\(siteUrl\)/u);
  assert.match(homePage, /<StructuredData/u);
  assert.match(homePage, /resolveSiteUrl\(await headers\(\)\)/u);
  assert.doesNotMatch(rootLayout, /createWebsiteStructuredData/u);
});
