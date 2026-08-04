import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { parsePostFile } from "../lib/content/contract.ts";
import {
  checkExternalLinks,
  createExternalLinkInventory,
  externalLinkReportHasBrokenEntries,
  formatExternalLinkReportText,
  guardExternalLinkTarget,
  isPublicNetworkAddress,
} from "../lib/content/external-links.ts";

function post(slug, body, title = `Post ${slug}`) {
  return parsePostFile(
    `content/posts/${slug}.md`,
    `---
title: "${title}"
description: "用于验证外部 HTTPS 链接库存和显式健康检查。"
type: article
publishedAt: 2026-08-05
freshness: historical
reviewedAt: 2026-08-05
tags: ["Personal Knowledge"]
draft: false
featured: false
---

${body}`,
  );
}

function publicGuard(target) {
  return guardExternalLinkTarget(
    target,
    async () => [{ address: "203.0.114.10", family: 4 }],
  );
}

test("extracts GFM HTTPS links with occurrences while ignoring images, code and internal targets", () => {
  const report = createExternalLinkInventory([
    post(
      "source",
      `第一条 [文档](https://docs.example/path#part)，重复 [文档](https://docs.example/path#part)。

裸链接 https://bare.example/guide 与 [参考定义][reference]。

[reference]: https://reference.example/resource

![外图](https://images.example/cover.png)
[站内](/posts/target) [锚点](#section) [邮箱](mailto:hello@example.com)

\`[行内代码](https://code.example/inline)\`

\`\`\`md
[围栏代码](https://code.example/fenced)
\`\`\``,
    ),
  ]);

  assert.equal(report.checked, false);
  assert.deepEqual(report.counts, {
    attention: 0,
    broken: 0,
    checked: 0,
    healthy: 0,
    issues: 0,
    occurrences: 4,
    records: 1,
    sourceRecords: 1,
    uniqueUrls: 3,
  });
  assert.deepEqual(
    report.links.map((entry) => [entry.url, entry.occurrenceCount]),
    [
      ["https://bare.example/guide", 1],
      ["https://docs.example/path#part", 2],
      ["https://reference.example/resource", 1],
    ],
  );
  assert.equal(report.links[1].occurrences[0].sourcePath, "content/posts/source.md");
  assert.equal(report.links[1].occurrences[0].bodyLine, 1);
  assert.doesNotMatch(JSON.stringify(report), /images\.example|code\.example/u);
});

test("reports unsafe authored URL forms without leaking embedded credentials", () => {
  const report = createExternalLinkInventory([
    post(
      "issues",
      `[HTTP](http://example.com/path)
[相对协议](//example.com/path)
[凭据](https://owner:super-secret@example.com/private)
[无效](https://)`,
    ),
  ]);

  assert.equal(report.links.length, 0);
  assert.deepEqual(
    report.issues.map((entry) => entry.code),
    ["insecure-http", "protocol-relative", "credentials", "invalid-https"],
  );
  assert.doesNotMatch(JSON.stringify(report), /super-secret/u);
  assert.match(formatExternalLinkReportText(report), /默认命令不访问网络/u);
  assert.equal(externalLinkReportHasBrokenEntries(report), true);
});

test("keeps inventory ordering deterministic across repository input order", () => {
  const alpha = post("alpha", "[Z](https://z.example) [A](https://a.example)");
  const beta = post("beta", "[A](https://a.example)");
  const forward = createExternalLinkInventory([alpha, beta]);
  const reverse = createExternalLinkInventory([beta, alpha]);

  assert.deepEqual(forward, reverse);
  assert.deepEqual(
    forward.links[0].occurrences.map((entry) => entry.sourcePath),
    ["content/posts/alpha.md", "content/posts/beta.md"],
  );
});

test("classifies public and non-public IPv4 and IPv6 addresses", () => {
  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.1.1",
    "198.51.100.2",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "not-an-ip",
  ]) {
    assert.equal(isPublicNetworkAddress(address), false, address);
  }
  assert.equal(isPublicNetworkAddress("8.8.8.8"), true);
  assert.equal(isPublicNetworkAddress("2606:4700:4700::1111"), true);
});

test("guards every target against protocol downgrade, credentials, ports and private DNS", async () => {
  const publicLookup = async () => [{ address: "8.8.8.8", family: 4 }];
  const privateLookup = async () => [{ address: "127.0.0.1", family: 4 }];
  const mixedLookup = async () => [
    { address: "8.8.8.8", family: 4 },
    { address: "10.0.0.1", family: 4 },
  ];

  assert.deepEqual(
    await guardExternalLinkTarget(new URL("https://example.com/path"), publicLookup),
    { address: "8.8.8.8", family: 4 },
  );
  for (const [url, lookup] of [
    ["http://example.com", publicLookup],
    ["https://owner:secret@example.com", publicLookup],
    ["https://example.com:8443", publicLookup],
    ["https://localhost", publicLookup],
    ["https://service.internal", publicLookup],
    ["https://example.com", privateLookup],
    ["https://example.com", mixedLookup],
    ["https://127.0.0.1", publicLookup],
  ]) {
    await assert.rejects(
      guardExternalLinkTarget(new URL(url), lookup),
      /HTTPS|用户名|端口|本地|内部|私网|回环|保留/u,
      url,
    );
  }
});

test("checks redirects and status classes with bounded retries and deterministic output", async () => {
  const report = createExternalLinkInventory([
    post(
      "health",
      `[跳转](https://redirect.example/start)
[受限](https://restricted.example/)
[不支持 HEAD](https://method.example/)
[缺失](https://missing.example/)
[瞬时错误](https://retry.example/)
[持续服务错误](https://server.example/)
[降级](https://downgrade.example/)`,
    ),
  ]);
  const calls = new Map();
  const waits = [];
  const checked = await checkExternalLinks(report, {
    concurrency: 2,
    guardTarget: publicGuard,
    maxRedirects: 2,
    probeHead: async (target) => {
      const count = (calls.get(target.href) ?? 0) + 1;
      calls.set(target.href, count);
      if (target.hostname === "redirect.example" && target.pathname === "/start") {
        return { location: "/final", statusCode: 301 };
      }
      if (target.hostname === "redirect.example") return { statusCode: 204 };
      if (target.hostname === "restricted.example") return { statusCode: 403 };
      if (target.hostname === "method.example") return { statusCode: 405 };
      if (target.hostname === "missing.example") return { statusCode: 404 };
      if (target.hostname === "retry.example") {
        return { statusCode: count === 1 ? 503 : 200 };
      }
      if (target.hostname === "server.example") return { statusCode: 503 };
      if (target.hostname === "downgrade.example") {
        return { location: "http://private.example/", statusCode: 302 };
      }
      throw new Error(`unexpected ${target.href}`);
    },
    retries: 1,
    timeoutMs: 500,
    wait: async (milliseconds) => waits.push(milliseconds),
  });

  assert.deepEqual(
    checked.links.map((entry) => [entry.url, entry.health.status]),
    [
      ["https://downgrade.example/", "unsafe"],
      ["https://method.example/", "method-unsupported"],
      ["https://missing.example/", "missing"],
      ["https://redirect.example/start", "healthy"],
      ["https://restricted.example/", "restricted"],
      ["https://retry.example/", "healthy"],
      ["https://server.example/", "server-error"],
    ],
  );
  assert.equal(checked.links[3].health.finalUrl, "https://redirect.example/final");
  assert.deepEqual(checked.links[3].health.redirects, ["https://redirect.example/final"]);
  assert.equal(checked.links[5].health.attempts, 2);
  assert.deepEqual(waits, [250, 250]);
  assert.deepEqual(
    {
      attention: checked.counts.attention,
      broken: checked.counts.broken,
      checked: checked.counts.checked,
      healthy: checked.counts.healthy,
    },
    { attention: 3, broken: 2, checked: 7, healthy: 2 },
  );
  assert.equal(externalLinkReportHasBrokenEntries(checked), true);
  assert.match(formatExternalLinkReportText(checked), /只发送 HEAD/u);
});

test("stops redirect chains at the explicit hop limit", async () => {
  const report = createExternalLinkInventory([
    post("loop", "[循环](https://loop.example/start)"),
  ]);
  let calls = 0;
  const checked = await checkExternalLinks(report, {
    guardTarget: publicGuard,
    maxRedirects: 1,
    probeHead: async () => {
      calls += 1;
      return { location: "/start", statusCode: 301 };
    },
    retries: 0,
    timeoutMs: 500,
  });

  assert.equal(calls, 2);
  assert.equal(checked.links[0].health.status, "redirect-error");
  assert.match(checked.links[0].health.detail, /超过 1 次/u);
  assert.equal(checked.counts.broken, 1);
});

test("retries timeout and network failures within the configured envelope", async () => {
  const report = createExternalLinkInventory([
    post("failures", "[超时](https://timeout.example) [网络](https://network.example)"),
  ]);
  const checked = await checkExternalLinks(report, {
    guardTarget: publicGuard,
    probeHead: async (target) => {
      const error = new Error(target.hostname === "timeout.example" ? "timed out" : "socket closed");
      if (target.hostname === "timeout.example") error.code = "ETIMEDOUT";
      throw error;
    },
    retries: 1,
    timeoutMs: 500,
    wait: async () => {},
  });

  assert.deepEqual(
    checked.links.map((entry) => [entry.health.status, entry.health.attempts]),
    [
      ["network-error", 2],
      ["timeout", 2],
    ],
  );
  assert.equal(checked.counts.attention, 2);
  assert.equal(checked.counts.broken, 0);
  assert.equal(externalLinkReportHasBrokenEntries(checked), false);
});

test("rejects health settings outside the explicit resource envelope", async () => {
  const report = createExternalLinkInventory([]);
  for (const options of [
    { concurrency: 0 },
    { concurrency: 9 },
    { maxRedirects: 11 },
    { retries: 3 },
    { timeoutMs: 499 },
    { timeoutMs: 30_001 },
  ]) {
    await assert.rejects(checkExternalLinks(report, options), /外链检查/u);
  }
});

test("runs the real inventory CLI without changing repository state", async () => {
  const before = spawnSync("git", ["status", "--porcelain=v1", "-z"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  }).stdout;
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/report-external-links.mjs",
      "--format",
      "json",
    ],
    {
      cwd: new URL("../", import.meta.url),
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  const after = spawnSync("git", ["status", "--porcelain=v1", "-z"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  }).stdout;

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.checked, false);
  assert.equal(report.counts.records, 4);
  assert.equal(report.counts.uniqueUrls, 1);
  assert.equal(report.links[0].url, "https://blog-iota-five-59.vercel.app/");
  assert.equal(before, after);

  const source = await readFile(
    new URL("../scripts/report-external-links.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /--fail-on-broken 只能与 --check/u);
});
