export const STUDIO_FILETREE_EDITOR_ID = "myblog-filetree";
export const STUDIO_FILETREE_MIN_NODES = 2;
export const STUDIO_FILETREE_MAX_NODES = 32;
export const STUDIO_FILETREE_MAX_DEPTH = 4;

const FILETREE_NODE_SOURCE = String.raw`> ((?: {2}){0,3})- \x60([^\x60\r\n]{1,80})\x60 — ([^\r\n]{1,240})`;
export const STUDIO_FILETREE_PATTERN = new RegExp(
  String.raw`^> \[!filetree\] ([^\[\]\r\n]{1,120})\r?\n((?:${FILETREE_NODE_SOURCE}(?:\r?\n|$)){2,32})(?!> (?: {2}){0,3}- \x60)`,
  "imu",
);
const REGISTRATION_KEY = "__MYBLOG_FILETREE_EDITOR_COMPONENT__";
const PATH_SEGMENT = /^[^\s/\\`\u0000-\u001f\u007f]{1,79}$/u;

function plainValue(value) {
  return value && typeof value.toJS === "function" ? value.toJS() : value;
}

function normalizedData(data) {
  const value = plainValue(data) ?? {};
  const rawNodes = plainValue(value.nodes);
  return {
    nodes: Array.isArray(rawNodes)
      ? rawNodes.map((candidate) => {
          const node = plainValue(candidate) ?? {};
          return {
            description:
              typeof node.description === "string" ? node.description.trim() : "",
            path: typeof node.path === "string" ? node.path.trim() : "",
          };
        })
      : [],
    title: typeof value.title === "string" ? value.title.trim() : "",
  };
}

function pathFacts(path, index) {
  if (
    !path ||
    path.length > 320 ||
    path.startsWith("/") ||
    path.includes("//") ||
    path.includes("\\") ||
    /[\r\n]/u.test(path)
  ) {
    throw new Error(`第 ${index + 1} 个路径必须是 1–320 字符的相对 POSIX 路径。`);
  }
  const folder = path.endsWith("/");
  const segments = path.replace(/\/$/u, "").split("/");
  if (
    segments.length > STUDIO_FILETREE_MAX_DEPTH ||
    segments.some((segment) =>
      !PATH_SEGMENT.test(segment) || segment === "." || segment === "..")
  ) {
    throw new Error(
      `第 ${index + 1} 个路径最多 ${STUDIO_FILETREE_MAX_DEPTH} 层，每层必须是 1–79 字符的安全路径段。`,
    );
  }
  return { depth: segments.length, folder, segments };
}

function validateFileTree(data) {
  const normalized = normalizedData(data);
  if (!/^[^\[\]\r\n]{1,120}$/u.test(normalized.title)) {
    throw new Error("文件树标题无效：请填写 1–120 字符的单行纯文本标题。");
  }
  if (
    normalized.nodes.length < STUDIO_FILETREE_MIN_NODES ||
    normalized.nodes.length > STUDIO_FILETREE_MAX_NODES
  ) {
    throw new Error(
      `文件树必须包含 ${STUDIO_FILETREE_MIN_NODES}–${STUDIO_FILETREE_MAX_NODES} 个节点。`,
    );
  }
  const keys = new Set();
  const openFolders = [];
  normalized.nodes.forEach((node, index) => {
    const facts = pathFacts(node.path, index);
    if (
      !node.description ||
      node.description.length > 240 ||
      /[\r\n]/u.test(node.description)
    ) {
      throw new Error(`第 ${index + 1} 个节点说明必须是 1–240 字符的单行内容。`);
    }
    if (/!\[|<[^>]+>|\[\^/u.test(node.description)) {
      throw new Error(`第 ${index + 1} 个节点说明不能包含图片、HTML 或脚注。`);
    }
    const key = node.path
      .replace(/\/$/u, "")
      .normalize("NFKC")
      .toLocaleLowerCase("zh-CN");
    if (keys.has(key)) throw new Error(`第 ${index + 1} 个完整路径不能重复。`);
    keys.add(key);
    if (facts.depth > 1) {
      const expectedParent = `${facts.segments.slice(0, -1).join("/")}/`;
      if (openFolders[facts.depth - 2] !== expectedParent) {
        throw new Error(
          `第 ${index + 1} 个节点必须紧跟在已声明的父文件夹 ${expectedParent} 之后。`,
        );
      }
    }
    openFolders.length = facts.depth - 1;
    if (facts.folder) openFolders[facts.depth - 1] = node.path;
  });
  return normalized;
}

function serializeFileTree(data) {
  const normalized = validateFileTree(data);
  const lines = [`> [!filetree] ${normalized.title}`];
  normalized.nodes.forEach((node, index) => {
    const facts = pathFacts(node.path, index);
    const name = `${facts.segments.at(-1)}${facts.folder ? "/" : ""}`;
    lines.push(`> ${"  ".repeat(facts.depth - 1)}- \`${name}\` — ${node.description}`);
  });
  return lines.join("\n");
}

function parseFileTreeMatch(match) {
  if (!match) throw new Error("无法解析 Studio 文件树。");
  const nodeMatches = [
    ...match[2].trimEnd().matchAll(new RegExp(FILETREE_NODE_SOURCE, "giu")),
  ];
  const stack = [];
  const nodes = nodeMatches.map((node, index) => {
    const depth = node[1].length / 2 + 1;
    if (depth > 1 && !stack[depth - 2]) {
      throw new Error(`第 ${index + 1} 个文件树节点缺少父文件夹。`);
    }
    const displayName = node[2];
    const folder = displayName.endsWith("/");
    const name = folder ? displayName.slice(0, -1) : displayName;
    const parent = depth > 1 ? stack[depth - 2] : "";
    const path = `${parent}${name}${folder ? "/" : ""}`;
    stack.length = depth - 1;
    if (folder) stack[depth - 1] = path;
    return { description: node[3], path };
  });
  return validateFileTree({ nodes, title: match[1] });
}

function nestedNodes(nodes) {
  const roots = [];
  const stack = [];
  nodes.forEach((node, index) => {
    const facts = pathFacts(node.path, index);
    const entry = { ...node, children: [], facts };
    if (facts.depth === 1) roots.push(entry);
    else stack[facts.depth - 2].children.push(entry);
    stack.length = facts.depth - 1;
    if (facts.folder) stack[facts.depth - 1] = entry;
  });
  return roots;
}

function previewList(h, nodes, depth = 1) {
  return h(
    "ul",
    { className: depth === 1 ? "markdown-filetree-items" : "markdown-filetree-children" },
    ...nodes.map((node, index) => {
      const name = `${node.facts.segments.at(-1)}${node.facts.folder ? "/" : ""}`;
      return h(
        "li",
        {
          className: "markdown-filetree-node",
          "data-depth": depth,
          "data-kind": node.facts.folder ? "folder" : "file",
          key: `${node.path}-${index}`,
        },
        h(
          "div",
          { className: "markdown-filetree-row" },
          h("span", { className: "markdown-filetree-branch", "aria-hidden": "true" }, depth === 1 ? "ROOT" : "BR"),
          h("span", { className: "markdown-filetree-kind" }, node.facts.folder ? "DIR" : "FILE"),
          h("code", { className: "markdown-filetree-name" }, name),
          h("span", { className: "markdown-filetree-description" }, node.description),
        ),
        node.children.length > 0 ? previewList(h, node.children, depth + 1) : null,
      );
    }),
  );
}

export function createStudioFileTreeEditorDefinition({ h = globalThis.h } = {}) {
  if (typeof h !== "function") throw new Error("Studio 文件树组件缺少 React 运行时。");
  return {
    collapsed: false,
    id: STUDIO_FILETREE_EDITOR_ID,
    label: "项目文件树",
    fields: [
      {
        hint: "例如：MyBlog 核心结构、插件目录、示例项目布局。",
        label: "文件树标题",
        name: "title",
        pattern: ["^[^\\[\\]\\r\\n]{1,120}$", "填写 1–120 字符的单行标题"],
        widget: "string",
      },
      {
        allow_add: true,
        allow_remove: true,
        allow_reorder: true,
        collapsed: false,
        default: [
          { description: "页面、布局与同源路由。", path: "app/" },
          { description: "Git-backed 发布后台。", path: "app/studio/" },
          { description: "后台静态入口。", path: "app/studio/page.tsx" },
          { description: "共享内容解析与渲染。", path: "lib/" },
          { description: "脚本、依赖与质量门。", path: "package.json" },
        ],
        fields: [
          {
            hint: "填写从根开始的相对路径；文件夹以 / 结尾，父文件夹必须先出现。",
            label: "完整相对路径",
            name: "path",
            pattern: ["^[^\\s\\\\`\\r\\n]{1,320}$", "填写安全的相对 POSIX 路径"],
            widget: "string",
          },
          {
            hint: "说明这个文件或目录在当前项目里的职责。",
            label: "简短说明",
            name: "description",
            pattern: ["^[^\\r\\n]{1,240}$", "填写 1–240 字符的单行说明"],
            widget: "string",
          },
        ],
        label: "文件树节点",
        label_singular: "节点",
        max: STUDIO_FILETREE_MAX_NODES,
        min: STUDIO_FILETREE_MIN_NODES,
        name: "nodes",
        summary: "{{fields.path}} · {{fields.description}}",
        widget: "list",
      },
    ],
    pattern: STUDIO_FILETREE_PATTERN,
    fromBlock: parseFileTreeMatch,
    toBlock: serializeFileTree,
    toPreview(data) {
      const normalized = validateFileTree(data);
      const depths = normalized.nodes.map((node, index) => pathFacts(node.path, index).depth);
      return h(
        "section",
        {
          className: "markdown-filetree",
          "data-filetree": "repository-slice",
          "data-max-depth": Math.max(...depths),
          "data-node-count": normalized.nodes.length,
        },
        h(
          "header",
          { className: "markdown-filetree-header" },
          h(
            "span",
            { className: "markdown-filetree-rail" },
            h("span", { className: "markdown-filetree-kind-label" }, `FILE MAP / ${String(normalized.nodes.length).padStart(2, "0")} NODES`),
            h("span", { className: "markdown-filetree-mode" }, `DEPTH · ${String(Math.max(...depths)).padStart(2, "0")} MAX`),
          ),
          h("strong", { className: "markdown-filetree-title" }, normalized.title),
        ),
        previewList(h, nestedNodes(normalized.nodes)),
      );
    },
  };
}

export function registerStudioFileTreeEditor({
  CMS = globalThis.CMS,
  documentRef = globalThis.document,
  h = globalThis.h,
} = {}) {
  if (!CMS || typeof CMS.registerEditorComponent !== "function") {
    throw new Error("Studio 文件树组件无法访问 Decap 注册表。");
  }
  if (CMS[REGISTRATION_KEY]) return CMS[REGISTRATION_KEY];
  const definition = createStudioFileTreeEditorDefinition({ h });
  CMS.registerEditorComponent(definition);
  CMS[REGISTRATION_KEY] = definition;
  const dataset = documentRef?.documentElement?.dataset;
  if (dataset) dataset.filetreeEditor = "registered";
  return definition;
}
