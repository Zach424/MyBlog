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

export const FRESHNESS_OPTIONS = [
  { label: "当前维护", value: "current" },
  { label: "历史快照", value: "historical" },
];

export const MEDIA_MAX_FILE_SIZE = 3 * 1024 * 1024;
export const AUDIO_MAX_FILE_SIZE = 8 * 1024 * 1024;
export const VIDEO_MAX_FILE_SIZE = 12 * 1024 * 1024;
export const STUDIO_ENTRY_MEDIA_FOLDER = "/public/uploads/{{fields.slug}}";
export const STUDIO_ENTRY_PUBLIC_FOLDER = "/uploads/{{fields.slug}}";

const slugField = {
  label: "稳定网址 Slug",
  name: "slug",
  widget: "stable-slug",
  pattern: ["^[a-z0-9]+(?:-[a-z0-9]+)*$", "只使用小写字母、数字和连字符"],
  hint: "例如 learning-vercel-deployments。先填写本字段，再上传图片；首次保存后控件会锁定，它就是内容文件、公开网址和附件目录。复制条目时必须先换成新值。",
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
  {
    label: "内容语境",
    name: "freshness",
    widget: "select",
    options: FRESHNESS_OPTIONS,
    default: "historical",
    hint: "当前维护内容承诺与现状一致；历史快照保留当时判断，并应在正文说明当前去向。",
  },
  dateField("复核日期", "reviewedAt"),
  tagsField,
  { label: "草稿", name: "draft", widget: "boolean", default: true, hint: "草稿不会进入公开页面、搜索、RSS 或 Sitemap。" },
  { label: "首页精选", name: "featured", widget: "boolean", default: false, hint: "草稿不能设为精选。" },
  { label: "封面", name: "cover", widget: "image", required: false, choose_url: false, hint: "先填写稳定 slug 再上传；系统会核对附件目标，同名同内容可复用，同名不同内容必须明确确认替换。", media_library: { config: { max_file_size: MEDIA_MAX_FILE_SIZE } } },
  { label: "封面替代文本", name: "coverAlt", widget: "string", required: false, hint: "设置封面时必填；简洁描述图片传达的信息，不要重复文章标题。" },
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
        media_folder: STUDIO_ENTRY_MEDIA_FOLDER,
        public_folder: STUDIO_ENTRY_PUBLIC_FOLDER,
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
          { label: "正文", name: "body", widget: "markdown", modes: ["raw", "rich_text"], editor_components: ["image", "code-block", "myblog-gallery", "myblog-table", "myblog-task-list", "myblog-references", "myblog-steps", "myblog-glossary", "myblog-faq", "myblog-filetree", "myblog-timeline", "myblog-audio", "myblog-video"], audio_max_file_size: AUDIO_MAX_FILE_SIZE, video_max_file_size: VIDEO_MAX_FILE_SIZE, required: true, hint: "先填写稳定 slug 再插入媒体；系统会识别新增、同内容复用和同名替换，替换公开附件前必须确认。多张步骤图或对比图使用‘多图证据画廊’，结构化数据使用‘技术数据表格’，项目进度使用‘项目任务清单’，官方文档、论文、仓库和延伸阅读使用‘参考资料清单’，有严格先后次序的教程或操作手册使用‘操作步骤流程’，概念、缩写和上下文解释使用‘术语定义表’，多组读者疑问使用‘常见问题 FAQ’，项目目录与关键文件职责使用‘项目文件树’，项目历史、交付与决策节点使用‘项目里程碑时间线’，语音学习记录或口述复盘使用‘本地音频笔记’并填写完整文字稿，公式使用 $...$ 或 $$...$$；本地静音 MP4 使用‘本地静音视频’；建议在原始 Markdown 模式精确编辑，预览会按生产规则检查并指出错误行。" },
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
        media_folder: STUDIO_ENTRY_MEDIA_FOLDER,
        public_folder: STUDIO_ENTRY_PUBLIC_FOLDER,
        preview_path: "projects/{{slug}}",
        summary: "{{publishedAt}} · {{title}} · {{status}}",
        sortable_fields: ["publishedAt", "updatedAt", "title"],
        fields: [
          ...sharedFields.slice(0, 3),
          ...sharedFields.slice(3, 7),
          { label: "状态", name: "status", widget: "select", options: [{ label: "规划中", value: "planning" }, { label: "建设中", value: "building" }, { label: "持续维护", value: "maintained" }, { label: "已归档", value: "archived" }], default: "planning" },
          { label: "技术栈", name: "stack", widget: "list", allow_add: true, min: 1, max: 12 },
          ...sharedFields.slice(7),
          { label: "源码地址", name: "repository", widget: "string", required: false, pattern: ["^https://", "必须是完整 HTTPS URL"] },
          { label: "演示地址", name: "demo", widget: "string", required: false, pattern: ["^https://", "必须是完整 HTTPS URL"] },
          { label: "正文", name: "body", widget: "markdown", modes: ["raw", "rich_text"], editor_components: ["image", "code-block", "myblog-gallery", "myblog-table", "myblog-task-list", "myblog-references", "myblog-steps", "myblog-glossary", "myblog-faq", "myblog-filetree", "myblog-timeline", "myblog-audio", "myblog-video"], audio_max_file_size: AUDIO_MAX_FILE_SIZE, video_max_file_size: VIDEO_MAX_FILE_SIZE, required: true, hint: "先填写稳定 slug 再插入媒体；系统会识别新增、同内容复用和同名替换，替换公开附件前必须确认。多张步骤图或对比图使用‘多图证据画廊’，结构化数据使用‘技术数据表格’，项目进度使用‘项目任务清单’，官方文档、论文、仓库和延伸阅读使用‘参考资料清单’，有严格先后次序的教程或操作手册使用‘操作步骤流程’，概念、缩写和上下文解释使用‘术语定义表’，多组读者疑问使用‘常见问题 FAQ’，项目目录与关键文件职责使用‘项目文件树’，项目历史、交付与决策节点使用‘项目里程碑时间线’，语音学习记录或口述复盘使用‘本地音频笔记’并填写完整文字稿，公式使用 $...$ 或 $$...$$；本地静音 MP4 使用‘本地静音视频’；建议在原始 Markdown 模式精确编辑，预览会按生产规则检查并指出错误行。" },
        ],
      },
    ],
  };
}
