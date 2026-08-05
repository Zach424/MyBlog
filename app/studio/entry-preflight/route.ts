import {
  inspectStudioEntryPreflight,
  STUDIO_ENTRY_PREFLIGHT_MAX_BYTES,
  type StudioCollection,
} from "@/lib/studio-entry-preflight";

export const runtime = "nodejs";

const responseHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-robots-tag": "noindex, nofollow",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { headers: responseHeaders, status });
}

function isCollection(value: unknown): value is StudioCollection {
  return value === "posts" || value === "projects";
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ message: "仅接受 JSON 正文。", ok: false }, 415);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ message: "仅接受同源 Studio 预检请求。", ok: false }, 403);
  }

  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > STUDIO_ENTRY_PREFLIGHT_MAX_BYTES) {
    return json({ message: "条目超过 Studio 预检上限。", ok: false }, 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > STUDIO_ENTRY_PREFLIGHT_MAX_BYTES) {
    return json({ message: "条目超过 Studio 预检上限。", ok: false }, 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ message: "请求 JSON 无法解析。", ok: false }, 400);
  }

  const collection =
    payload && typeof payload === "object" && "collection" in payload
      ? (payload as { collection?: unknown }).collection
      : undefined;
  const fields =
    payload && typeof payload === "object" && "fields" in payload
      ? (payload as { fields?: unknown }).fields
      : undefined;
  if (!isCollection(collection)) {
    return json({ message: "collection 必须是 posts 或 projects。", ok: false }, 400);
  }
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return json({ message: "fields 必须是对象。", ok: false }, 400);
  }

  const result = inspectStudioEntryPreflight(
    collection,
    fields as Record<string, unknown>,
  );
  return json(result, result.ok ? 200 : 422);
}
