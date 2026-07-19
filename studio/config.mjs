export const TAG_OPTIONS = [
  "Next.js",
  "TypeScript",
  "Cloudflare",
  "Vercel",
  "Design Systems",
  "Node.js",
  "Windows",
  "Tooling",
  "Project Management",
  "Git",
  "React",
  "Personal Knowledge",
];

const slugField = {
  label: "稳定网址 Slug",
  name: "slug",
  widget: "string",
  pattern: ["^[a-z0-9]+(?:-[a-z0-9]+)*$", "只使用小写字母、数字和连字符"],
  hint: "例如 learning-cloudflare-workers。首次发布后不要修改；它就是文章网址。",
};

const dateField = (label, name, required = true) => ({
  label,
  name,
  widget: "datetime",
  format: "YYYY-MM-DD",
  date_format: "YYYY-MM-DD",
  time_format: false,
  picker_utc: false,
  required,
});

const tagsField = {
  label: "标签",
  name: "tags",
  widget: "select",
  multiple: true,
  options: TAG_OPTIONS,
  hint: "选择 1–5 个已登记标签；新增标签需要先修改内容契约。",
};

const sharedFields = [
  { label: "标题", name: "title", widget: "string" },
  slugField,
  { label: "摘要", name: "description", widget: "text", hint: "用一段独立文字说明读者能得到什么。" },
  dateField("发布日期", "publishedAt"),
  dateField("更新日期", "updatedAt", false),
  tagsField,
  { label: "草稿", name: "draft", widget: "boolean", default: true, hint: "草稿不会进入公开页面、搜索、RSS 或 Sitemap。" },
  { label: "首页精选", name: "featured", widget: "boolean", default: false, hint: "草稿不能设为精选。" },
  { label: "封面", name: "cover", widget: "image", required: false, choose_url: false, media_library: { config: { max_file_size: 5242880 } } },
];

export function createStudioConfig(origin) {
  const siteOrigin = new URL(origin).origin;

  return {
    load_config_file: false,
    backend: {
      name: "github",
      repo: "Zach424/MyBlog",
      branch: "main",
      base_url: siteOrigin,
      auth_endpoint: "/api/cms/auth",
      site_domain: new URL(siteOrigin).hostname,
      use_graphql: true,
      squash_merges: true,
      commit_messages: {
        create: "content: create {{collection}} {{slug}}",
        update: "content: update {{collection}} {{slug}}",
        delete: "content: delete {{collection}} {{slug}}",
        uploadMedia: "content: upload {{path}}",
        deleteMedia: "content: delete {{path}}",
        openAuthoring: "content: propose {{collection}} {{slug}}",
      },
    },
    publish_mode: "editorial_workflow",
    media_folder: "public/uploads",
    public_folder: "/uploads",
    site_url: siteOrigin,
    display_url: siteOrigin,
    logo_url: `${siteOrigin}/icon.png`,
    slug: {
      encoding: "ascii",
      clean_accents: true,
      sanitize_replacement: "-",
    },
    collections: [
      {
        name: "posts",
        label: "文章与 TIL",
        label_singular: "文章",
        folder: "content/posts",
        create: true,
        delete: true,
        extension: "md",
        format: "frontmatter",
        slug: "{{fields.slug}}",
        preview_path: "posts/{{slug}}",
        summary: "{{publishedAt}} · {{title}} · {{type}}",
        sortable_fields: ["publishedAt", "updatedAt", "title"],
        view_filters: [
          { label: "草稿", field: "draft", pattern: true },
          { label: "已公开", field: "draft", pattern: false },
        ],
        fields: [
          ...sharedFields.slice(0, 3),
          { label: "类型", name: "type", widget: "select", options: [{ label: "完整文章", value: "article" }, { label: "TIL 短记录", value: "til" }], default: "article" },
          ...sharedFields.slice(3),
          {
            label: "专题",
            name: "series",
            widget: "object",
            required: false,
            collapsed: true,
            fields: [
              { label: "专题 Slug", name: "slug", widget: "string", pattern: ["^[a-z0-9]+(?:-[a-z0-9]+)*$", "只使用小写字母、数字和连字符"] },
              { label: "专题标题", name: "title", widget: "string" },
              { label: "篇章顺序", name: "order", widget: "number", value_type: "int", min: 1 },
            ],
          },
          { label: "转载 Canonical URL", name: "canonical", widget: "string", required: false, pattern: ["^https://", "必须是完整 HTTPS URL"] },
          { label: "正文", name: "body", widget: "markdown", modes: ["raw", "rich_text"], required: true },
        ],
      },
      {
        name: "projects",
        label: "项目复盘",
        label_singular: "项目",
        folder: "content/projects",
        create: true,
        delete: true,
        extension: "md",
        format: "frontmatter",
        slug: "{{fields.slug}}",
        preview_path: "projects/{{slug}}",
        summary: "{{publishedAt}} · {{title}} · {{status}}",
        sortable_fields: ["publishedAt", "updatedAt", "title"],
        fields: [
          ...sharedFields.slice(0, 3),
          ...sharedFields.slice(3, 5),
          { label: "状态", name: "status", widget: "select", options: [{ label: "规划中", value: "planning" }, { label: "建设中", value: "building" }, { label: "持续维护", value: "maintained" }, { label: "已归档", value: "archived" }], default: "planning" },
          { label: "技术栈", name: "stack", widget: "list", allow_add: true, min: 1, max: 12 },
          ...sharedFields.slice(5),
          { label: "源码地址", name: "repository", widget: "string", required: false, pattern: ["^https://", "必须是完整 HTTPS URL"] },
          { label: "演示地址", name: "demo", widget: "string", required: false, pattern: ["^https://", "必须是完整 HTTPS URL"] },
          { label: "正文", name: "body", widget: "markdown", modes: ["raw", "rich_text"], required: true },
        ],
      },
    ],
  };
}
