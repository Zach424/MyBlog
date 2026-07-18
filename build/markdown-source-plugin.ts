import type { Plugin } from "vite";

export function markdownSourcePlugin(): Plugin {
  return {
    name: "myblog-markdown-source",
    enforce: "pre",
    transform(source, id) {
      const filePath = id.split("?", 1)[0];
      if (!filePath.endsWith(".md")) return null;

      return {
        code: `export default ${JSON.stringify(source)};`,
        map: null,
      };
    },
  };
}
