# Zach424 / Engineering Notes

记录学习路径、技术取舍和项目复盘的个人技术博客。内容、附件与历史都保存在 GitHub；作者可以使用网页发布后台或 Obsidian 写作，合并到 `main` 后由 Vercel 自动发布，不依赖 Codex 或 Cloudflare。

## 当前状态

- GitHub：<https://github.com/Zach424/MyBlog>
- 当前生产站：<https://blog-iota-five-59.vercel.app>
- 迁移期回退站：<https://zach424-engineering-notes.zhiqingchen792.chatgpt.site>
- 发布状态：Vercel 原生 Next.js、GitHub `main` 自动部署、Studio editorial workflow、Obsidian `--push`、生产冒烟与回滚恢复均已验收
- 内容入口：`/studio` 网页后台、仓库根目录 Obsidian Vault、普通 Git 编辑器
- 数据模型：仓库内 Markdown + YAML frontmatter，无数据库

## 本地开发

要求 Node.js 22.13 或更高版本。

```bash
npm ci
npm run dev
```

常用检查：

```bash
npm run check
npm run release:check
npm run production:smoke -- https://your-production.example --expect-oauth
```

## 发布文章

网页方式打开 [生产站 Studio](https://blog-iota-five-59.vercel.app/studio)，使用 GitHub 登录，创建草稿、预览并发布。Obsidian 方式在仓库根目录打开 Vault，从 `templates/obsidian` 新建笔记，再运行命令面板中的“发布当前草稿并同步 GitHub”。两种方式最终都产生 Git 提交；Vercel 只部署通过质量门并进入 `main` 的版本。

完整步骤见 [发布手册](./docs/PUBLISHING.md) 和 [Vercel 迁移清单](./docs/MIGRATION.md)。

## 文档索引

- [项目与范围](./docs/PROJECT.md)
- [设计说明](./docs/DESIGN.md)
- [系统架构](./docs/ARCHITECTURE.md)
- [内容模型](./docs/CONTENT_MODEL.md)
- [质量标准](./docs/QUALITY.md)
- [运行维护](./docs/OPERATIONS.md)
- [路线图](./docs/ROADMAP.md)
- [迭代归档](./docs/iterations/README.md)
