import { createHash } from "node:crypto";

import {
  createProductionContentConvergenceTarget,
  normalizeProductionConvergenceSourcePath,
  type ProductionContentConvergenceTarget,
} from "./production-convergence.ts";
import { parsePostFile, parseProjectFile } from "./contract.ts";

export const POST_DELIVERY_HANDOFF_VERSION = 1 as const;
export const POST_DELIVERY_HANDOFF_PREFIX = "[post-delivery-handoff] ";

const GIT_OBJECT_ID_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const SOURCE_SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SHA256_ETAG_PATTERN = /^"sha256-[a-f0-9]{64}"$/u;

export type PostDeliveryKind = "publication" | "review";

export interface PostDeliveryHandoff {
  version: typeof POST_DELIVERY_HANDOFF_VERSION;
  mode: "post-delivery";
  delivery: PostDeliveryKind;
  commitOid: string;
  target: ProductionContentConvergenceTarget;
  safety: {
    gitDelivered: true;
    productionChecked: false;
    waitStarted: false;
  };
}

interface CreateTargetOptions {
  origin: string | URL;
  source: string | Uint8Array;
  sourcePath: string;
}

interface CreateHandoffOptions {
  commitOid: string;
  delivery: PostDeliveryKind;
  target: ProductionContentConvergenceTarget;
}

function sourceBytes(source: string | Uint8Array) {
  return typeof source === "string"
    ? new TextEncoder().encode(source)
    : Uint8Array.from(source);
}

function validateTarget(target: ProductionContentConvergenceTarget) {
  const sourcePath = normalizeProductionConvergenceSourcePath(target.sourcePath);
  if (!SOURCE_SHA256_PATTERN.test(target.sourceSha256)) {
    throw new Error("post-delivery target.sourceSha256 必须是 64 位小写 SHA-256");
  }
  if (!SHA256_ETAG_PATTERN.test(target.localEtag)) {
    throw new Error("post-delivery target.localEtag 必须是强 SHA-256 ETag");
  }
  let id;
  try {
    id = new URL(target.id);
  } catch {
    throw new Error("post-delivery target.id 必须是绝对 HTTPS URL");
  }
  if (id.protocol !== "https:" || id.username || id.password || id.search || id.hash) {
    throw new Error("post-delivery target.id 必须是无凭据、查询或片段的 HTTPS URL");
  }
  const route = id.pathname.match(
    /^\/(posts|projects)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/u,
  );
  if (!route) throw new Error("post-delivery target.id 必须是稳定内容 URL");
  const expectedKind = route[1] === "posts" ? "post" : "project";
  if (target.kind !== expectedKind) {
    throw new Error("post-delivery target.kind 必须与 URL 一致");
  }
  if (
    (expectedKind === "post" && !["article", "til"].includes(target.type)) ||
    (expectedKind === "project" && target.type !== "project")
  ) {
    throw new Error("post-delivery target.type 必须与 kind 一致");
  }
  const expectedSourcePath = `content/${route[1]}/${route[2]}.md`;
  if (sourcePath !== expectedSourcePath) {
    throw new Error("post-delivery target.sourcePath 必须与 URL 一致");
  }
  if (target.markdownUrl !== `${id.href}/source.md`) {
    throw new Error("post-delivery target.markdownUrl 必须由 id 加 /source.md 得到");
  }
  if (!target.title.trim()) throw new Error("post-delivery target.title 不能为空");
  return Object.freeze({ ...target, sourcePath });
}

export function createPostDeliveryHandoffTarget(
  options: CreateTargetOptions,
): ProductionContentConvergenceTarget {
  const path = normalizeProductionConvergenceSourcePath(options.sourcePath);
  const bytes = sourceBytes(options.source);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("post-delivery 正式来源必须是有效 UTF-8");
  }
  const record = path.startsWith("content/posts/")
    ? parsePostFile(path, text)
    : parseProjectFile(path, text);
  const target = createProductionContentConvergenceTarget({
    localRecords: [record],
    origin: options.origin,
    sourcePath: path,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  });
  return validateTarget(target);
}

export function createPostDeliveryHandoff(
  options: CreateHandoffOptions,
): PostDeliveryHandoff {
  if (options.delivery !== "publication" && options.delivery !== "review") {
    throw new Error("post-delivery delivery 必须是 publication 或 review");
  }
  if (!GIT_OBJECT_ID_PATTERN.test(options.commitOid)) {
    throw new Error("post-delivery commitOid 必须是 40 或 64 位小写 Git object id");
  }
  const target = validateTarget(options.target);
  return Object.freeze({
    version: POST_DELIVERY_HANDOFF_VERSION,
    mode: "post-delivery",
    delivery: options.delivery,
    commitOid: options.commitOid,
    target,
    safety: Object.freeze({
      gitDelivered: true,
      productionChecked: false,
      waitStarted: false,
    }),
  });
}

export function formatPostDeliveryHandoffLine(handoff: PostDeliveryHandoff) {
  return `${POST_DELIVERY_HANDOFF_PREFIX}${JSON.stringify(handoff)}`;
}
