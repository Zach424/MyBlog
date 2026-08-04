# 作者发布手册

网页后台、Obsidian 和普通 Git 编辑器操作同一个 GitHub 仓库。文章没有数据库副本：草稿、附件、版本和回滚都在 Git 历史中。进入 `main` 的提交由 Vercel 自动发布，不依赖 Codex。

## 方式一：网页后台

一次性配置见 [MIGRATION.md](./MIGRATION.md)。完成后：

1. 打开生产站 `/studio`；
2. 点击 GitHub 登录，仅在 GitHub 官方页面授权；
3. 选择“文章与 TIL”或“项目复盘”，创建条目；
4. 填写稳定 slug、标题、摘要、内容语境、复核日期、标签和正文；历史记录选择 Historical，持续维护说明选择 Current；
5. 草稿阶段保持 `draft: true`，通过 editorial workflow 保存；
6. 预览并把状态推进到 Ready；
7. 发布后确认 GitHub 提交/PR、Quality Gate、Vercel Production 和在线文章全部成功。

不要在正文、字段或截图中保存 OAuth token。若后台显示未配置，检查 Vercel Production 的 `GITHUB_OAUTH_ID` 与 `GITHUB_OAUTH_SECRET`，不要把值复制到聊天。

## 方式二：Obsidian

1. 在 Obsidian 选择“打开文件夹作为仓库”，打开项目根目录；
2. 从 `templates/obsidian/article.md`、`til.md` 或 `project.md` 创建文件；
3. 将工作文件放入 `content/inbox`，文件名直接使用稳定 slug，例如 `learning-vercel-deployments.md`；
4. 图片可直接粘贴到 Obsidian；默认先进入 `public/uploads`，发布器会移动到 `public/uploads/<slug>/`、规范化带空格或中文的文件名，并重写 Wiki/Markdown 图片链接；静态 PNG/JPEG/WebP 自动优化为 WebP，GIF/AVIF 和动画 WebP 保持原文件；
5. 链接已有文章或项目时可以写 `[[note]]`、`[[note#标题|别名]]`、`[[projects/slug]]` 或相对 Markdown 链接；发布器会转换为稳定 `/posts/...`、`/projects/...` URL 和标题锚点；
6. 选择 `freshness`：学习过程和阶段性方案通常用 `historical`，需要持续准确的项目/操作说明用 `current`；`reviewedAt` 填写本次确认事实的日期；
7. 先运行“检查当前草稿”；确认内容已经可以公开后，运行“发布当前草稿并同步 GitHub”；该命令会把 `draft` 改为 `false`，未来日期内容会保持计划状态；
8. 阅读预检摘要，确认目标路径、附件源/产物格式、宽高、帧数、体积变化、站内链接、内容语境和 frontmatter；
9. 发布器运行完整质量门、创建内容提交并 push `main`；Vercel Git 连接完成后会自动上线。若团队改用 PR 流程，则不要运行同步命令，改由普通 Git 客户端创建分支和 PR。

命令行等价操作：

```bash
npm run content:publish -- content/inbox/learning-vercel-deployments.md --check-only
npm run content:publish -- content/inbox/learning-vercel-deployments.md --push
```

`--check-only` 会在仓库同盘的忽略 staging 中完成真实媒体处理，验证 frontmatter、目标路径、附件与站内链接，并列出每个附件的归档路径和源/产物差异；随后删除 staging，不修改文件。省略标志会关闭草稿状态、原子归档已验证附件、把 Obsidian 链接转换为稳定站点 URL、生成正式内容并运行完整检查，但不提交；完整检查还会确认正式图片 URL 精确存在、归档目录与内容 slug 一致且没有孤立文件。如果检查失败，草稿与全部附件会按原路径、原文本和原字节恢复。`--push` 在同一流程通过后只暂存目标内容、受跟踪的源文件删除和归档附件，创建提交并推送 `main`。运行 `--push` 前应确认暂存区为空。

## 本地图片预算

| 检查 | 上限或规则 |
| --- | --- |
| 文件类型 | PNG、JPEG、WebP、GIF、AVIF；扩展名必须匹配真实解码格式 |
| 单文件体积 | `≤ 3 MiB` |
| 单帧宽高 | 各 `≤ 2560 px` |
| 单帧像素 | `≤ 8,000,000` |
| 动图总像素 | `宽 × 高 × 帧数 ≤ 80,000,000` |

Obsidian 的静态 PNG/JPEG/WebP 原图可以在发布前暂时超过公开预算，但不得超过 25 MiB、8192×8192 px 或 4000 万像素的安全包络；发布器会自动校正方向、等比缩放并生成 WebP，产物仍必须通过上表。GIF、AVIF 和动画 WebP 不自动重编码，输入本身必须符合上表。网页 Studio 会先拒绝超过 3 MiB 的选择；`next dev`、`next build` 和 GitHub Quality Gate 会重新递归校验 `public/uploads` 及正式内容引用，所以普通 Git 编辑器也不能绕过格式、损坏文件、尺寸、缺失路径或孤儿附件门。不要只改扩展名。

## 内容维护报告

随时运行：

```bash
npm run content:status
npm run content:status -- --format json
```

报告只列出已经公开的 Current record，显示最近复核日、最后有效日和剩余天数；Historical snapshot、草稿和未来内容不进入队列。剩余 60 天进入复核窗口，剩余 30 天标为即将到期，第 180 天仍可发布，第 181 天报告与构建失败。GitHub Quality Gate 每次提交和每周一 09:00（Asia/Shanghai）自动生成同一份可勾选摘要，预警直接标注到源 Markdown，但不会在到期前阻断发布。

复核时逐项检查架构、版本、项目状态、操作步骤和关键外链；事实变化时更新正文与 `updatedAt`，全部确认后再更新 `reviewedAt`。不要只改日期绕过复核。

## 内容字段

所有内容共有：`title`、`description`、`publishedAt`、`freshness`、`reviewedAt`、`tags`、`draft`、`featured` 和正文。文章额外有 `type`、可选 `series`/`canonical`；项目额外有 `status`、`stack`、可选 `repository`/`demo`。详细契约见 [CONTENT_MODEL.md](./CONTENT_MODEL.md)。

## 发布前自检

- slug 是小写 ASCII、数字和连字符，首次发布后不修改；
- 标题和摘要能独立说明读者所得；
- 标签来自 Studio/契约注册表；
- `updatedAt` 不早于 `publishedAt`；
- `reviewedAt` 不早于 `updatedAt`/`publishedAt`，也不写未来日期；
- Historical snapshot 明确说明记录时间和当前去向；Current record 已逐项复核地址、版本、状态和操作说明；
- 外链使用 HTTPS；
- 裸 Wiki 链接的 slug 在文章与项目间唯一；同名时显式写 `posts/slug` 或 `projects/slug`；
- 不使用 Obsidian `#^block-id` 块引用；公开知识链接使用笔记或标题链接；
- 图片有替代文本，附件不含隐私信息；
- 图片通过真实格式与媒体预算；Obsidian 静态图可由发布器自动生成 WebP，GIF/AVIF/动画 WebP 需预先满足公开预算；
- 正式本地图片/cover 使用 `/uploads/...`，大小写与真实文件一致；归档子目录等于内容 slug，不保留无人引用的归档文件；
- 本地图片位于 Obsidian 配置的 `public/uploads`，不要复用已经被其他公开内容跟踪的源图片；
- 公开前把 `draft` 改为 `false`；
- `npm run check` 或 GitHub Quality Gate 通过。

## 常见问题

- `/studio` 返回 503：生产 OAuth 环境变量未配置或未重新部署。
- GitHub 登录回调失败：OAuth App 的 Homepage/Callback 与当前生产 origin 不一致。
- 内容未上线：确认 PR 已进入 `main`、Vercel Production 成功，并检查 `draft` 和日期。
- 构建提示“超过 180 天未复核”：逐项复查 Current record 的架构、外链、版本和状态，更新正文/`updatedAt`（如有变化）与 `reviewedAt`；不要只改日期绕过复核。
- Actions 显示“进入复核窗口/即将到期”：运行 `npm run content:status` 查看剩余天数和清单；warning 是提前安排复核，不是构建失败。
- Obsidian 拒绝发布：根据错误修正 slug、标签、日期、附件路径、站内链接或字段；目标不存在/未公开时先发布目标，歧义时写明 `posts/` 或 `projects/`，不要绕过校验。
- 图片提示格式不一致或无法解码：重新从原工具导出为受支持格式，不要重命名后缀；静态原图超过 25 MiB/8192 px/4000 万像素时先裁切，GIF/AVIF/动画 WebP 超过公开预算时先在原工具优化。
- 构建提示图片不存在或大小写不一致：核对 Markdown/cover 的 `/uploads/...` 与仓库文件名；不要依赖 Windows 的大小写不敏感行为。
- 构建提示归档附件无人引用：删除无用文件，或从同 slug 内容的正文/cover 正确引用；代码块中的示例不算引用。
- Preview 无法登录 Studio：Preview 默认关闭 OAuth，这是安全设计；在 Production 验收发布。
