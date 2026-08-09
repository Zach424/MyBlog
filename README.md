# Zach424 / Engineering Notes

记录学习路径、技术取舍和项目复盘的个人技术博客。内容、附件与历史都保存在 GitHub；作者可以使用网页发布后台或 Obsidian 写作，合并到 `main` 后由 Vercel 自动发布，不依赖 Codex 或 Cloudflare。

## 当前状态

- GitHub：<https://github.com/Zach424/MyBlog>
- 当前生产站：<https://blog-iota-five-59.vercel.app>
- 迁移期回退站：<https://zach424-engineering-notes.zhiqingchen792.chatgpt.site>
- 发布状态：Vercel 原生 Next.js、GitHub `main` 自动部署、Studio editorial workflow 与只读内容复核队列、Obsidian `--push`、活动正式笔记有界生产收敛等待、内部链接/标题锚点门禁、反向引用、公开知识地图、RSS 与 JSON Feed 1.1、可供 Obsidian/自动化发现的 `/content.json` 清单及 `/content.schema.json` JSON Schema、六个结构化发现端点的 SHA-256 ETag/条件请求、带内容 ETag/条件请求的文章/项目可移植 Markdown 源文、详情页规范链接分享与 Markdown 引用复制、可解释的 HTML 与结构化发现 raw/gzip 双层预算、版本化永久重定向、生产冒烟、回滚恢复与六处官方 Actions 不可变 SHA 门禁均已验收
- 内容入口：`/studio` 网页后台、`/studio/maintenance` 已公开 Current 内容复核队列、仓库根目录 Obsidian Vault、普通 Git 编辑器
- 数据模型：仓库内 Markdown + YAML frontmatter，无数据库；公开内容标明当前维护/历史快照和最近复核日期

## 本地开发

要求 Node.js 22.13 或更高版本。

```bash
npm ci
npm run dev
```

常用检查：

```bash
npm run check
npm run content:inbox
npm run media:staging
npm run links:external
npm run release:check
npm run production:smoke -- https://your-production.example --expect-oauth
```

## 发布文章

网页方式打开 [生产站 Studio](https://blog-iota-five-59.vercel.app/studio)，使用 GitHub 登录，创建草稿、上传图片、预览并发布；左下角的 `Content review / 复核队列` 可随时打开全库只读维护页，按 healthy、review-soon、due-soon、overdue 查看当前公开内容，并直接回到稳定条目或公开页面。Author Proof 会用正式内容契约只读检查全部条目字段并显示 PATH、VISIBILITY、CONTEXT、BODY 证据，图片在进入 Git 草稿前会检查真实格式、体积、尺寸和动图帧预算，并以稳定 slug、规范文件名和 SHA-256 对照已发布媒体清单及本页面已批准目标，明确显示新增、相同文件或需要确认的替换，稳定 slug 在首次保存后自动锁定。Obsidian 方式在仓库根目录打开 Vault，从 `templates/obsidian` 新建笔记，可以用 `[[note#heading|显示文字]]` 链接已发布文章或项目；发布预检会确认标题真实存在，正文链接再同时派生详情页引用账本和 `/knowledge` 全站知识地图，无需维护另一份图数据。MyBlog Publisher 1.34.0 的“查看当前草稿发布意图”会调用 source-scoped inbox evidence：仍轻量扫描全部草稿以保留共享附件和目标碰撞判断，但只为当前草稿生成真实媒体候选；version 6 报告再以原始草稿字节的 SHA-256 绑定当前来源，插件在打开摘要和执行任一 ALT/REF 导航前都会重读并精确核对，内容一旦变化便保留现场并要求重跑。每次运行还拥有 latest-wins generation；新运行和插件卸载都会让旧子进程结果或异步摘要读取静默失效，不会晚到后打开旧 Modal 或发送终态提示。新运行还会立即隐藏并终止同一作者意图 scope 的旧活动子进程；全 inbox、维护、doctor、发布和复核命令保持独立。“检查当前草稿身份”的异步读取也使用独立 generation：重复命令只允许最新读取展示证据，旧成功或失败与卸载后的完成项均静默；已打开 Modal 的精确旧 slug 清理继续由独立 `Vault.process` lease 保护。只读页面除 Article/TIL/Project、公开目标、日期语义和精确站内链接外，还用 `MEDIA TRACE` 逐项显示本地来源、仓库目标、公开 URL、输入/输出格式、尺寸、帧数、字节与 optimized/preserved 状态，并以 `COVER / BODY` 标明每个附件的用途、出现次数、全部草稿源码行、逐次最终替代文本及 `AUTHORED / FILENAME FALLBACK` 来源。空文本显示 `EMPTY · WILL FAIL`；Wiki 图片没有真实 display、只靠文件名生成文本时显示 `FILENAME FALLBACK`，两者都会阻塞草稿。每个媒体 `ALT · L<n> · <SOURCE>` 和链接 `REF · L<n>` 标签都能在重新验证当前草稿、Vault 文件身份、SHA-256 和行号边界后打开精确源码行；失败保留摘要，且不写文、不发布、不运行 Git 或联网。“查看全部草稿发布就绪状态”继续保留完整 ready/scheduled/blocked 总览。`npm run media:staging` 可随时审计尚未归档的根附件及 inbox 引用；`npm run links:external` 生成零网络的公开正文与 `repository`/`demo`/`canonical` HTTPS 统一库存，显式增加 `--check` 才发送受限 HEAD 请求。两者都只给证据，不删除或改写作者内容。若公开 URL 确需迁移，旧地址登记在 `content/redirects.yml`，构建会先验证它只单跳到当前公开页面。两种发布方式最终都产生 Git 提交；Vercel 只部署通过质量门并进入 `main` 的版本。

MyBlog Publisher 当前版本为 1.41.0。所有 Git 写入口先用 Author Doctor 比较运行代码、Obsidian runtime manifest 与仓库磁盘插件版本，用独立 `bundle.json` 对 `main.js`、`manifest.json`、`styles.css` 重算三份 SHA-256，并只读证明 `bundle.json` 与这三份文件都被当前 Git HEAD 跟踪、index 等于 HEAD、worktree 未修改。版本不一致显示 `PLUGIN RELOAD REQUIRED`，文件摘要异常显示 `PLUGIN BUNDLE INVALID`，Git 来源异常显示 `PLUGIN PROVENANCE UNVERIFIED`；三种联锁都不启动领域命令，也不会自动运行 add、commit、push、fetch、reset、覆盖或重载。正常发布/复核和 push 失败后的两条可信恢复交付，都会在 Git local/tracking 证明同一个 commit 已送达后冻结最终正式来源、commit、来源 SHA-256 与公开 Markdown ETag；插件完成 sealed receipt 校验，释放可能存在的作者 Git 事务并等待 Vault reconcile，再自动接力三分钟有界生产等待。timeout、网络/协议错误、来源漂移或卸载都不会回滚、重新提交、重复 push 或自动重试。手动入口“等待当前正式内容上线”和命令 `npm run content:production:wait -- --source content/projects/myblog.md` 继续保留；全库一次性核对仍使用“检查生产内容同步状态”或 `npm run content:production`。

完整步骤见 [发布手册](./docs/PUBLISHING.md) 和 [Vercel 迁移清单](./docs/MIGRATION.md)。

## 文档索引

- [项目与范围](./docs/PROJECT.md)
- [当前项目状态](./docs/STATUS.md)
- [设计说明](./docs/DESIGN.md)
- [系统架构](./docs/ARCHITECTURE.md)
- [内容模型](./docs/CONTENT_MODEL.md)
- [质量标准](./docs/QUALITY.md)
- [运行维护](./docs/OPERATIONS.md)
- [路线图](./docs/ROADMAP.md)
- [迭代归档](./docs/iterations/README.md)
