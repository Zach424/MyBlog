# Zach424 / Engineering Notes

记录学习路径、技术取舍和项目复盘的个人技术博客。内容、附件与历史都保存在 GitHub；作者可以使用网页发布后台或 Obsidian 写作，合并到 `main` 后由 Vercel 自动发布，不依赖 Codex 或 Cloudflare。

## 当前状态

- GitHub：<https://github.com/Zach424/MyBlog>
- 当前生产站：<https://blog-iota-five-59.vercel.app>
- 迁移期回退站：<https://zach424-engineering-notes.zhiqingchen792.chatgpt.site>
- 发布状态：Vercel 原生 Next.js、GitHub `main` 自动部署、Studio editorial workflow、Obsidian `--push`、内部链接/标题锚点门禁、反向引用、公开知识地图、版本化永久重定向、生产冒烟与回滚恢复均已验收
- 内容入口：`/studio` 网页后台、仓库根目录 Obsidian Vault、普通 Git 编辑器
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

网页方式打开 [生产站 Studio](https://blog-iota-five-59.vercel.app/studio)，使用 GitHub 登录，创建草稿、上传图片、预览并发布；图片在进入 Git 草稿前会检查真实格式、体积、尺寸和动图帧预算，并以稳定 slug、规范文件名和 SHA-256 对照已发布媒体清单及本页面已批准目标，明确显示新增、相同文件或需要确认的替换，稳定 slug 在首次保存后自动锁定。Obsidian 方式在仓库根目录打开 Vault，从 `templates/obsidian` 新建笔记，可以用 `[[note#heading|显示文字]]` 链接已发布文章或项目；发布预检会确认标题真实存在，正文链接再同时派生详情页引用账本和 `/knowledge` 全站知识地图，无需维护另一份图数据。命令面板中的“查看全部草稿发布就绪状态”会给出 ready/scheduled/blocked 总览，再用“发布当前草稿并同步 GitHub”处理选中的笔记。`npm run media:staging` 可随时审计尚未归档的根附件及 inbox 引用；`npm run links:external` 生成零网络的公开正文与 `repository`/`demo`/`canonical` HTTPS 统一库存，显式增加 `--check` 才发送受限 HEAD 请求。两者都只给证据，不删除或改写作者内容。若公开 URL 确需迁移，旧地址登记在 `content/redirects.yml`，构建会先验证它只单跳到当前公开页面。两种发布方式最终都产生 Git 提交；Vercel 只部署通过质量门并进入 `main` 的版本。

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
