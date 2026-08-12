import { readFile } from "node:fs/promises";
import path from "node:path";

type StudioAssetName =
  | "audio-editor.mjs"
  | "index.html"
  | "config.mjs"
  | "entry-preflight.mjs"
  | "gallery-editor.mjs"
  | "maintenance.html"
  | "maintenance.mjs"
  | "maintenance.css"
  | "math-preview.mjs"
  | "media-preflight.mjs"
  | "stable-slug-widget.mjs"
  | "table-editor.mjs"
  | "task-list-editor.mjs"
  | "video-editor.mjs"
  | "preview.css";

const contentTypes: Record<StudioAssetName, string> = {
  "audio-editor.mjs": "text/javascript; charset=utf-8",
  "index.html": "text/html; charset=utf-8",
  "config.mjs": "text/javascript; charset=utf-8",
  "entry-preflight.mjs": "text/javascript; charset=utf-8",
  "gallery-editor.mjs": "text/javascript; charset=utf-8",
  "maintenance.html": "text/html; charset=utf-8",
  "maintenance.mjs": "text/javascript; charset=utf-8",
  "maintenance.css": "text/css; charset=utf-8",
  "math-preview.mjs": "text/javascript; charset=utf-8",
  "media-preflight.mjs": "text/javascript; charset=utf-8",
  "stable-slug-widget.mjs": "text/javascript; charset=utf-8",
  "table-editor.mjs": "text/javascript; charset=utf-8",
  "task-list-editor.mjs": "text/javascript; charset=utf-8",
  "video-editor.mjs": "text/javascript; charset=utf-8",
  "preview.css": "text/css; charset=utf-8",
};

export async function studioAssetResponse(name: StudioAssetName) {
  const filePath = path.join(process.cwd(), "studio", name);
  const body = await readFile(filePath, "utf8");

  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": contentTypes[name],
    },
  });
}

export async function studioCmsScriptResponse() {
  const filePath = path.join(
    process.cwd(),
    "node_modules",
    "decap-cms",
    "dist",
    "decap-cms.js",
  );
  const body = await readFile(filePath, "utf8");

  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "text/javascript; charset=utf-8",
    },
  });
}

const katexWoff2Source =
  /src:url\(fonts\/([^()]+\.woff2)\) format\("woff2"\),url\(fonts\/[^()]+\.woff\) format\("woff"\),url\(fonts\/[^()]+\.ttf\) format\("truetype"\)/gu;

export async function studioKatexCssResponse() {
  const katexDirectory = path.join(process.cwd(), "node_modules", "katex", "dist");
  let css = await readFile(path.join(katexDirectory, "katex.min.css"), "utf8");
  const fontNames = [
    ...new Set([...css.matchAll(katexWoff2Source)].map((match) => match[1])),
  ];
  const fonts = new Map(
    await Promise.all(
      fontNames.map(async (fontName) => [
        fontName,
        (await readFile(path.join(katexDirectory, "fonts", fontName))).toString("base64"),
      ] as const),
    ),
  );

  css = css.replace(katexWoff2Source, (_source, fontName: string) => {
    const font = fonts.get(fontName);
    if (!font) throw new Error(`KaTeX preview font is missing: ${fontName}`);
    return `src:url(data:font/woff2;base64,${font}) format("woff2")`;
  });
  if (css.includes("url(fonts/")) {
    throw new Error("KaTeX preview CSS contains an unresolved font URL.");
  }

  return new Response(css, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "text/css; charset=utf-8",
    },
  });
}
