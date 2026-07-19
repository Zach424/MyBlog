# 作者发布手册

网页后台、Obsidian 和普通 Git 编辑器操作同一个 GitHub 仓库。文章没有数据库副本：草稿、附件、版本和回滚都在 Git 历史中。进入 `main` 的提交由 Vercel 自动发布，不依赖 Codex。

## 方式一：网页后台

一次性配置见 [MIGRATION.md](./MIGRATION.md)。完成后：

1. 打开生产站 `/studio`；
2. 点击 GitHub 登录，仅在 GitHub 官方页面授权；
3. 选择“文章与 TIL”或“项目复盘”，创建条目；
4. 填写稳定 slug、标题、摘要、日期、标签和正文；
5. 草稿阶段保持 `draft: true`，通过 editorial workflow 保存；
6. 预览并把状态推进到 Ready；
7. 发布后确认 GitHub 提交/PR、Quality Gate、Vercel Production 和在线文章全部成功。

不要在正文、字段或截图中保存 OAuth token。若后台显示未配置，检查 Vercel Production 的 `GITHUB_OAUTH_ID` 与 `GITHUB_OAUTH_SECRET`，不要把值复制到聊天。

## 方式二：Obsidian

1. 在 Obsidian 选择“打开文件夹作为仓库”，打开项目根目录；
2. 从 `templates/obsidian/article.md`、`til.md` 或 `project.md` 创建文件；
3. 将工作文件放入 `content/inbox`，文件名直接使用稳定 slug，例如 `learning-vercel-deployments.md`；
4. 图片可粘贴到 Obsidian 附件目录，发布器会移动到 `public/uploads/<slug>/` 并重写链接；
5. 打开命令面板，运行 `Publish current note to blog`；
6. 阅读预检摘要，确认目标路径、附件和 frontmatter；
7. 发布器创建内容提交；使用普通 Git 客户端 push/PR，合并到 `main` 后 Vercel 自动上线。

命令行等价操作：

```bash
npm run content:publish -- content/inbox/learning-vercel-deployments.md
```

默认会校验并提交，不自动 push。使用 `--dry-run` 只预览转换；使用 `--no-commit` 生成文件但不提交。

## 内容字段

所有内容共有：`title`、`description`、`publishedAt`、`tags`、`draft`、`featured` 和正文。文章额外有 `type`、可选 `series`/`canonical`；项目额外有 `status`、`stack`、可选 `repository`/`demo`。详细契约见 [CONTENT_MODEL.md](./CONTENT_MODEL.md)。

## 发布前自检

- slug 是小写 ASCII、数字和连字符，首次发布后不修改；
- 标题和摘要能独立说明读者所得；
- 标签来自 Studio/契约注册表；
- `updatedAt` 不早于 `publishedAt`；
- 外链使用 HTTPS；
- 图片有替代文本，附件不含隐私信息；
- 公开前把 `draft` 改为 `false`；
- `npm run check` 或 GitHub Quality Gate 通过。

## 常见问题

- `/studio` 返回 503：生产 OAuth 环境变量未配置或未重新部署。
- GitHub 登录回调失败：OAuth App 的 Homepage/Callback 与当前生产 origin 不一致。
- 内容未上线：确认 PR 已进入 `main`、Vercel Production 成功，并检查 `draft` 和日期。
- Obsidian 拒绝发布：根据错误修正 slug、标签、日期、附件路径或字段；不要绕过校验。
- Preview 无法登录 Studio：Preview 默认关闭 OAuth，这是安全设计；在 Production 验收发布。
