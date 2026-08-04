# 内容模型

## 原则

- GitHub 仓库是唯一事实源；
- 文件名决定稳定 URL；
- frontmatter 使用声明式 YAML，不执行 JavaScript；
- 同一契约服务网页后台、Obsidian、构建和测试；
- 草稿与未来内容在公开索引形成前过滤。

## 文章与 TIL

路径：`content/posts/<slug>.md`

```yaml
---
title: "标题"
description: "独立摘要"
type: article # article | til
publishedAt: 2026-07-19
updatedAt: 2026-07-19
freshness: historical # historical | current
reviewedAt: 2026-07-19
tags: ["Next.js", "TypeScript", "Vercel"]
draft: true
featured: false
series:
  slug: build-my-blog
  title: "搭建个人博客"
  order: 4
canonical: "https://example.com/original"
cover: "/uploads/example/cover.webp"
coverAlt: "文档与部署节点沿一条提交轨迹连接"
---
```

`series`、`canonical`、`cover`、`updatedAt` 可选。设置 `cover` 时 `coverAlt` 必填，未设置 cover 时不能单独保留 coverAlt。专题 order 必须从 1 连续增长。

## 项目复盘

路径：`content/projects/<slug>.md`

```yaml
---
title: "项目名称"
description: "项目摘要"
publishedAt: 2026-07-19
updatedAt: 2026-07-19
freshness: current # historical | current
reviewedAt: 2026-07-19
status: maintained # planning | building | maintained | archived
stack: ["TypeScript", "React", "Next.js", "Vercel"]
tags: ["TypeScript", "React", "Vercel"]
draft: false
featured: true
repository: "https://github.com/example/repo"
demo: "https://example.vercel.app"
cover: "/uploads/project-slug/cover.webp"
coverAlt: "项目输入、构建与发布阶段组成的工程档案图"
---
```

`repository`、`demo`、`cover`、`updatedAt` 可选；外部 URL 必须为 HTTPS。cover 必须是仓库内 `/uploads/...` 图片并与 coverAlt 成对出现。

## Slug、标签与日期

Slug 只能使用小写英文字母、数字和连字符，并必须与文件名一致。Studio 新建和复制条目在首次保存前可编辑顶层 slug；条目一旦获得稳定 Git 身份，控件会变为可聚焦、可复制但不可改写的 readOnly，并在值与 entry slug/path 不一致时阻止保存。首次公开后不可修改；若必须迁移，需要用 Git 同步移动内容文件和 `public/uploads/<slug>/`、修改正文/cover URL，并提供显式永久重定向。

### 永久重定向注册表

`content/redirects.yml` 是旧公开地址到当前规范页面的唯一注册表。格式固定为 `version: 1`，每条记录包含 `source`、`destination`、`addedAt` 和足以解释迁移原因的 `reason`：

```yaml
version: 1
redirects:
  - source: /blog
    destination: /posts
    addedAt: 2026-08-05
    reason: 将旧式通用博客入口统一到文章集合页
```

来源和目标都必须是无查询、无锚点、无编码段、无尾斜杠的小写 ASCII 绝对路径。来源不得与当前页面、公开文件、`/_next`、`/api`、`/studio` 或 `/uploads` 冲突；目标必须是当前构建中已公开的 HTML 页面，不能指向草稿、未来内容、静态文件或运维端点。重复来源、自跳转、重定向链和环路都会让构建失败；多个历史来源可以直接指向同一个最终规范页面。所有规则统一输出 308，不在数据中重复声明状态码。

标签来自 `lib/content/contract.ts` 的注册表，Studio 从同一注册表维护等价选项。别名只用于输入归一化，页面始终输出规范名称和 slug。

可见日期按作者时区 `Asia/Shanghai` 在构建时冻结。`draft: true`、发布日期晚于构建日期的记录不会出现在详情、集合、搜索、RSS 或 Sitemap。

## 内容语境与复核

`freshness` 与 `reviewedAt` 是所有文章、TIL 和项目的必填字段：

- `historical`：按时间点保存问题、方案和证据；可以保留旧框架/平台，但正文应说明这是历史并链接当前记录；
- `current`：承诺架构、地址、状态和操作说明与当前系统一致；最多 180 天必须重新复核；
- `reviewedAt`：最近一次逐项确认事实的日期，不能早于 `updatedAt`（或 `publishedAt`），也不能晚于构建日期；
- 计划/未来内容在公开前不参与 180 天门，Historical snapshot 不因时间推移失效。

详情页事实栏显示 `Context` 与 `Reviewed`。`dateModified` 使用 `reviewedAt`，因此搜索引擎和读者看到同一复核证据。更新正文后必须同步更新 `updatedAt` 和 `reviewedAt`；只做事实复核也需要更新 `reviewedAt`。

维护状态不是 frontmatter 字段，而是从 `reviewedAt` 与报告日期确定性派生：

| 状态 | 剩余有效天数 | 行为 |
| --- | --- | --- |
| `healthy` | 61–180 天 | 保持当前维护节奏 |
| `review-soon` | 31–60 天 | Actions warning，开始安排复核 |
| `due-soon` | 0–30 天 | Actions warning，优先完成复核 |
| `overdue` | 小于 0 天 | 报告和构建失败 |

运行 `npm run content:status` 查看人类可读队列，增加 `--format json` 可获得机器可读结果；`--date YYYY-MM-DD` 只用于确定性演练。报告中的 `reviewBy` 是第 180 天最后有效日，不能把提醒状态写回 Markdown，否则会随时间腐化。

## 构建实现

- `build/validate-content.ts`：Next.js 配置加载时读取全部内容并执行 schema、重复 slug、标签、专题、关系与 180 天新鲜度校验；
- `lib/content/maintenance.ts`：从公开 Current record 派生日龄、剩余天数、最后有效日与分级状态；
- `lib/content/index.ts`：使用 Node 文件系统读取 Markdown，并生成公开文章、项目、标签和专题索引；
- `next.config.ts`：注入构建日期，并通过 `outputFileTracingIncludes` 把 Markdown 纳入 Vercel Serverless 产物；
- `lib/content/markdown.ts`：生成与正文一致的目录锚点；
- `lib/search.ts`、`lib/discovery.ts`：从同一公开集合生成搜索文档、RSS 和 Sitemap。

选择 `yaml` 而不是允许可执行 frontmatter 的解析器，避免把动态执行带进生产包，并让字段约束可审计。

## 附件

公开附件位于 `public/uploads/<slug>/`。Obsidian 的默认附件目录是 `public/uploads`；作者可以直接粘贴图片，发布器会把当前笔记引用的 Wiki/Markdown 图片移动到文章或项目的专属子目录，并把正文改写为 `/uploads/<slug>/<稳定文件名>`。Studio 的 posts/projects 集合使用相同 slug 模板，作者先填写 slug 后上传时直接落入专属子目录。

- 允许输入格式：PNG、JPEG、WebP、GIF、AVIF；静态 PNG/JPEG/WebP 发布为 `.webp`，GIF、AVIF 和动画 WebP 保持格式与原字节；
- 原文件名已是小写 ASCII 安全名时保持 stem；空格、中文或其他不稳定字符会转换为可读前缀加 8 位路径哈希；静态格式共享同一个 `.webp` 目标命名空间，同 stem 冲突会被拒绝；
- 静态图自动校正 EXIF 方向，最长边收敛到 2560 px，并以固定参数生成确定性 WebP；若现有 WebP 已满足预算且重编码不会更小，则保留原字节；
- 可优化原图必须满足 25 MiB、8192 px 和 4000 万像素的解码安全包络；公开产物仍必须满足 3 MiB、2560 px、800 万单帧像素和 8000 万动图总像素预算；
- 本地图片必须来自 `public/uploads`，不允许 `..` 越界、查询参数、锚点或 Windows 非法字符；
- 已由 Git 跟踪且位于其他内容目录的附件不会被移动，避免破坏已有文章；
- `--check-only` 在忽略的同盘 staging 中生成并验证产物，只输出处理计划，不修改草稿或附件；
- 发布质量门失败时，草稿和本轮所有附件都会按原路径、原文本和原字节恢复。

Studio 的浏览器选择器只接受上述扩展名，并在文件进入 Decap Git 草稿前校验真实 magic 格式、扩展名一致性、可解码宽高、3 MiB/2560 px/800 万像素预算以及 GIF/WebP/APNG 帧数和 8000 万总像素预算。通过后仍保存作者选择的原始文件；JPEG/PNG 不在浏览器内自动转 WebP，Evidence Rail 会提示需要自动优化时改用 Obsidian 发布器。动画 AVIF 因浏览器端无法可靠获得序列帧数而拒绝，静态 AVIF 正常支持。最终构建会用 Sharp 再次执行权威校验，因此浏览器差异不能绕过内容契约。

正式 `content/posts` 与 `content/projects` 还必须满足引用完整性：

- `cover` 和 Markdown 图片的本地 URL 必须使用 `/uploads/...`；相对路径、`public/uploads/...`、HTTP、协议相对 URL、查询参数和锚点均会失败；Markdown 正文可以使用完整 HTTPS 外图，但 cover 必须本地化；
- Markdown 图片的 `![替代文本]` 不能为空，行内与引用式写法使用同一规则；本地图在渲染前读取真实宽高并按正文栏生成响应式候选；
- `coverAlt` 为 1–200 字符的可访问描述，与 cover 成对存在；详情页从真实文件读取宽高，用同一 alt 输出响应式图片、OG/Twitter 和 JSON-LD；
- 路径解码后不能包含目录穿越、编码的 `/`/`\\`、空路径段或非法字符，末尾扩展名必须是受支持图片格式；
- 引用按仓库原始大小写精确匹配真实文件，避免 Windows 通过但 Vercel/Linux 404；
- `public/uploads/<slug>/...` 是已归档附件，只能由相同 slug 的正式文章或项目正文/cover 引用；没有引用的归档文件会让构建失败；
- `public/uploads` 根目录只是 Obsidian inbox 与媒体库暂存区，正式 posts/projects 的正文和 cover 引用根文件会失败；`npm run media:staging` 会交叉列出 inbox 引用、Git/文件系统年龄和清理建议，但不会自动删除；
- 行内 Markdown 图片和引用式图片都参与关系，行内代码、围栏代码和普通链接不参与；
- 正式目录里的 draft/future 记录仍可拥有归档附件；`content/inbox` 不参与，未被正式内容引用的根暂存文件不做孤儿清理。

外部 HTTPS 正文图片不进入附件移动流程，也不进入 `next/image` 远程优化白名单；页面以 lazy、异步解码、`no-referrer` 的原生图片明确降级，CSP 仅允许 HTTPS 图片源。网页后台继续写入同一公开目录和内容事实源。Obsidian frontmatter cover 会与正文附件一起归档、优化和回滚；Studio cover 只允许上传本地文件，直接归档到当前 slug，并要求作者同时填写替代文本。

## 站内链接与引用关系

正式 Markdown 使用稳定站点 URL：

```markdown
[文章](/posts/building-a-maintainable-blog)
[项目章节](/projects/myblog#验证与质量门)
```

Obsidian 草稿可以使用更自然的输入，发布器会在进入正式内容目录前完成转换：

```markdown
[[building-a-maintainable-blog|文章]]
[[projects/myblog#验证与质量门|项目章节]]
[项目](../projects/myblog.md)
[[#本文章节]]
```

裸 slug 必须在文章与项目间唯一；同名时写明 `posts/` 或 `projects/`。不存在的目标、歧义目标和 `#^block-id` 块引用会被拒绝。外部链接不转换，行内代码与围栏代码中的示例不参与转换。

构建只从公开正文中的 `/posts/<slug>` 与 `/projects/<slug>` 提取关系，去重后同时生成 outgoing 与 backlinks。目标缺失或未公开会让构建失败；自引用不会进入任一列表。详情页把两个方向放在同一 Reference ledger 中：当前正文的引用去向使用 `→`，引用当前记录的来源使用 `←`；单侧为空时只显示另一侧，两侧都为空时不渲染账本。关系不另存一份 frontmatter，避免链接与人工索引漂移。
