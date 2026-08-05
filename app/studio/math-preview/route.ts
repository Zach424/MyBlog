import {
  renderStudioMathPreview,
  STUDIO_MATH_PREVIEW_MAX_BYTES,
} from "@/lib/studio-math-preview";

export const runtime = "nodejs";

const responseHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-robots-tag": "noindex, nofollow",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: responseHeaders,
    status,
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return json({ message: "仅接受 JSON 正文。", ok: false }, 415);
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ message: "仅接受同源 Studio 预览请求。", ok: false }, 403);
  }

  const declaredBytes = Number(request.headers.get("content-length") ?? 0);
  if (declaredBytes > STUDIO_MATH_PREVIEW_MAX_BYTES) {
    return json({ message: "正文超过 Studio 预览上限。", ok: false }, 413);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > STUDIO_MATH_PREVIEW_MAX_BYTES) {
    return json({ message: "正文超过 Studio 预览上限。", ok: false }, 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ message: "请求 JSON 无法解析。", ok: false }, 400);
  }

  const markdown =
    payload && typeof payload === "object" && "markdown" in payload
      ? (payload as { markdown?: unknown }).markdown
      : undefined;
  if (typeof markdown !== "string") {
    return json({ message: "markdown 必须是字符串。", ok: false }, 400);
  }

  const result = renderStudioMathPreview(markdown);
  return json(result, result.ok ? 200 : 422);
}
