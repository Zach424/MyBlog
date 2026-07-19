import { readFile } from "node:fs/promises";
import path from "node:path";

type StudioAssetName = "index.html" | "config.mjs" | "preview.css";

const contentTypes: Record<StudioAssetName, string> = {
  "index.html": "text/html; charset=utf-8",
  "config.mjs": "text/javascript; charset=utf-8",
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
