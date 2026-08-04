# 作者发布手册

网页后台、Obsidian 和普通 Git 编辑器操作同一个 GitHub 仓库。文章没有数据库副本：草稿、附件、版本和回滚都在 Git 历史中。进入 `main` 的提交由 Vercel 自动发布，不依赖 Codex。

## 方式一：网页后台

一次性配置见 [MIGRATION.md](./MIGRATION.md)。完成后：

1. 打开生产站 `/studio`；
2. 点击 GitHub 登录，仅在 GitHub 官方页面授权；
3. 选择“文章与 TIL”或“项目复盘”，创建条目；
4. 先填写稳定 slug，再上传封面或在正文插图；首次保存后该字段会显示 `Identity state / locked` 并变为只读。复制已有条目时必须在第一次保存前换成新的 slug。Studio 会在本地先检查真实格式、体积、宽高与动图总像素，通过后才把原文件交给 Git 草稿，并显示格式/尺寸/帧数/体积 Evidence Rail。图片直接保存到 `public/uploads/<slug>/`，正文写入 `/uploads/<slug>/...`。同一条目内的图片使用不同文件名，避免替换已有附件；然后填写标题、摘要、内容语境、复核日期、标签和正文，历史记录选择 Historical，持续维护说明选择 Current；需要封面时同时填写不重复标题的“封面替代文本”；
5. 草稿阶段保持 `draft: true`，通过 editorial workflow 保存；
6. 预览并把状态推进到 Ready；
7. 发布后确认 GitHub 提交/PR、Quality Gate、Vercel Production 和在线文章全部成功。

不要在正文、字段或截图中保存 OAuth token。若后台显示未配置，检查 Vercel Production 的 `GITHUB_OAUTH_ID` 与 `GITHUB_OAUTH_SECRET`，不要把值复制到聊天。

## 方式二：Obsidian

1. 在 Obsidian 选择“打开文件夹作为仓库”，打开项目根目录；
2. 从 `templates/obsidian/article.md`、`til.md` 或 `project.md` 创建文件；
3. 将工作文件放入 `content/inbox`，文件名直接使用稳定 slug，例如 `learning-vercel-deployments.md`；
4. 图片可直接粘贴到 Obsidian；默认先进入 `public/uploads`，发布器会移动到 `public/uploads/<slug>/`、规范化带空格或中文的文件名，并重写 Wiki/Markdown 图片链接；需要封面时取消模板中 `cover`/`coverAlt` 的注释，cover 指向同一附件目录中的图片；静态 PNG/JPEG/WebP 自动优化为 WebP，GIF/AVIF 和动画 WebP 保持原文件；
5. 链接已有文章或项目时可以写 `[[note]]`、`[[note#标题|别名]]`、`[[projects/slug]]` 或相对 Markdown 链接；发布器会转换为稳定 `/posts/...`、`/projects/...` URL 和标题锚点；
6. 选择 `freshness`：学习过程和阶段性方案通常用 `historical`，需要持续准确的项目/操作说明用 `current`；`reviewedAt` 填写本次确认事实的日期；
7. 先运行“查看全部草稿发布就绪状态”，在只读弹窗中处理 `blocked`，确认 `scheduled` 日期；再运行“检查当前草稿”；
8. 确认当前内容已经可以公开后，运行“发布当前草稿并同步 GitHub”；该命令会把 `draft` 改为 `false`，未来日期内容会保持计划状态；
9. 阅读预检摘要，确认目标路径、附件源/产物格式、宽高、帧数、体积变化、站内链接、内容语境和 frontmatter；
10. 发布器运行完整质量门、创建内容提交并 push `main`；Vercel Git 连接完成后会自动上线。若团队改用 PR 流程，则不要运行同步命令，改由普通 Git 客户端创建分支和 PR。

命令行等价操作：

```bash
npm run content:publish -- content/inbox/learning-vercel-deployments.md --check-only
npm run content:publish -- content/inbox/learning-vercel-deployments.md --push
```

`--check-only` 会在仓库同盘的忽略 staging 中完成真实媒体处理，验证 frontmatter、目标路径、正文附件、cover 与站内链接，并列出每个附件的归档路径和源/产物差异；随后删除 staging，不修改文件。省略标志会关闭草稿状态、原子归档已验证附件、把 Obsidian 链接与 cover 转换为稳定站点 URL、生成正式内容并运行完整检查，但不提交；完整检查还会确认正式图片 URL 精确存在、归档目录与内容 slug 一致且没有孤立文件。如果检查失败，草稿与全部附件会按原路径、原文本和原字节恢复。`--push` 在同一流程通过后只暂存目标内容、受跟踪的源文件删除和归档附件，创建提交并推送 `main`。运行 `--push` 前应确认暂存区为空。

全部草稿的命令行总览：

```bash
npm run content:inbox
npm run content:inbox -- --format json
npm run content:inbox -- --date 2026-08-05
```

它逐篇给出 `ready`、`scheduled` 或 `blocked`，并展示内容类型、draft 状态、公开日、目标路径、真实媒体候选和结构化阻塞原因。一个坏草稿不会中止其他草稿；blocked 只进入报告，不改变命令退出码。总览不移动附件、不改写 Markdown、不提交、不推送；`ready` 也不替代单篇检查和正式发布时的完整质量门。因为本地未跟踪草稿不会出现在 GitHub 检出中，该报告只集成本地 `release:check` 和 Obsidian，不伪装成 Actions 的完整作者工作区视图。

## 迁移已公开 URL

正常发布不要修改 slug。确需迁移时使用普通 Git 分支一次完成以下事项：

1. 移动 Markdown 文件并同步修改 frontmatter slug；
2. 将 `public/uploads/<旧 slug>/` 移到新 slug，并更新 cover、正文图片、站内链接和引用；
3. 在 `content/redirects.yml` 增加旧 URL 到最终新 URL 的记录，填写当天 `addedAt` 和清晰的 `reason`；
4. 直接指向最终公开页面，不把旧地址串成多跳链；
5. 运行 `npm run check`，合并后再确认旧地址返回 308 且 `Location` 是新地址。

注册表中的 `/blog -> /posts` 是可运行示例。不要为草稿、未来内容、静态附件、Studio/API 路径建立重定向，也不要移除仍有外部访问或搜索索引价值的旧地址。若误配，回滚对应 Git 提交即可恢复上一版路由表。

## 本地图片预算

| 检查 | 上限或规则 |
| --- | --- |
| 文件类型 | PNG、JPEG、WebP、GIF、AVIF；扩展名必须匹配真实解码格式 |
| 单文件体积 | `≤ 3 MiB` |
| 单帧宽高 | 各 `≤ 2560 px` |
| 单帧像素 | `≤ 8,000,000` |
| 动图总像素 | `宽 × 高 × 帧数 ≤ 80,000,000` |

Obsidian 的静态 PNG/JPEG/WebP 原图可以在发布前暂时超过公开预算，但不得超过 25 MiB、8192×8192 px 或 4000 万像素的安全包络；发布器会自动校正方向、等比缩放并生成 WebP，产物仍必须通过上表。GIF、AVIF 和动画 WebP 不自动重编码，输入本身必须符合上表。网页 Studio 会在本地拒绝不支持或伪装格式、损坏文件、超体积/尺寸/像素预算的图片，并计算 GIF、WebP 与 APNG 帧预算；动画 AVIF 需要先转换为静态 AVIF/WebP 或改用 Obsidian。Studio 保留原始字节，JPEG/PNG 若需要自动缩放转 WebP，请改用 Obsidian 发布器。`next dev`、`next build` 和 GitHub Quality Gate 会重新递归校验 `public/uploads` 及正式内容引用，所以普通 Git 编辑器也不能绕过门禁。不要只改扩展名。

## 内容维护报告

随时运行：

```bash
npm run content:status
npm run content:status -- --format json
```

报告只列出已经公开的 Current record，显示最近复核日、最后有效日和剩余天数；Historical snapshot、草稿和未来内容不进入队列。剩余 60 天进入复核窗口，剩余 30 天标为即将到期，第 180 天仍可发布，第 181 天报告与构建失败。GitHub Quality Gate 每次提交和每周一 09:00（Asia/Shanghai）自动生成同一份可勾选摘要，预警直接标注到源 Markdown，但不会在到期前阻断发布。

复核时逐项检查架构、版本、项目状态、操作步骤和关键外链；事实变化时更新正文与 `updatedAt`，全部确认后再更新 `reviewedAt`。不要只改日期绕过复核。

## 根暂存附件报告

Obsidian 粘贴的图片在发布前位于 `public/uploads` 根目录。随时运行：

```bash
npm run media:staging
npm run media:staging -- --format json
npm run media:staging -- --date 2026-08-05 --stale-days 30
```

报告按路径列出体积、Git 状态、最近变化日期、引用它的 `content/inbox` 草稿和处理建议，并区分单草稿引用、多草稿共享、未引用、缺失引用与无法审计的草稿。干净且已跟踪的文件使用 Git 最后提交日期；未跟踪或本地已修改文件使用明确标注的 filesystem 日期，所以不会把本地观察伪装成 Git 历史。默认 30 天标为陈旧，只用于提示草稿可能已搁置。

Quality Gate 每次提交和每周维护都会把同一库存写入 Actions summary，并为共享、未引用、陈旧、缺失或无法解析的条目创建 warning。报告始终返回成功（扫描本身失败除外），也不会自动删除文件。删除前应先打开列出的草稿确认引用；多草稿共享时先为每个内容复制独立附件，再分别发布。

## 内容字段

所有内容共有：`title`、`description`、`publishedAt`、`freshness`、`reviewedAt`、`tags`、`draft`、`featured`、可选且成对出现的 `cover`/`coverAlt` 和正文。文章额外有 `type`、可选 `series`/`canonical`；项目额外有 `status`、`stack`、可选 `repository`/`demo`。详细契约见 [CONTENT_MODEL.md](./CONTENT_MODEL.md)。

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
- 正文图片有非空替代文本；本地图片会读取真实宽高并响应式加载，完整 HTTPS 外图只做 lazy 降级；设置 cover 时同时填写 1–200 字符的 coverAlt，未设置 cover 时不保留孤立 coverAlt；附件不含隐私信息；
- 图片通过真实格式与媒体预算；Obsidian 静态图可由发布器自动生成 WebP，GIF/AVIF/动画 WebP 需预先满足公开预算；
- 正式本地图片/cover 使用 `/uploads/<slug>/...`，不能引用 `/uploads` 根暂存文件，大小写与真实文件一致；归档子目录等于内容 slug，不保留无人引用的归档文件；
- 本地图片位于 Obsidian 配置的 `public/uploads`，不要复用已经被其他公开内容跟踪的源图片；
- 公开前把 `draft` 改为 `false`；
- `npm run check` 或 GitHub Quality Gate 通过。

## 常见问题

- `/studio` 返回 503：生产 OAuth 环境变量未配置或未重新部署。
- GitHub 登录回调失败：OAuth App 的 Homepage/Callback 与当前生产 origin 不一致。
- 内容未上线：确认 PR 已进入 `main`、Vercel Production 成功，并检查 `draft` 和日期。
- 构建提示“超过 180 天未复核”：逐项复查 Current record 的架构、外链、版本和状态，更新正文/`updatedAt`（如有变化）与 `reviewedAt`；不要只改日期绕过复核。
- Actions 显示“进入复核窗口/即将到期”：运行 `npm run content:status` 查看剩余天数和清单；warning 是提前安排复核，不是构建失败。
- Actions 显示“暂存媒体需复核”：运行 `npm run media:staging` 查看引用和年龄证据；先检查对应 inbox 草稿，再手动复制、恢复引用或删除，不要批量清理。
- Obsidian 拒绝发布：根据错误修正 slug、标签、日期、附件路径、站内链接或字段；目标不存在/未公开时先发布目标，歧义时写明 `posts/` 或 `projects/`，不要绕过校验。
- inbox 总览显示 `attachment-shared`：先为每篇草稿复制独立附件并更新引用；发布任一草稿都会移动根源文件，不能让多个草稿继续共享同一路径。
- inbox 总览显示 `attachment-tracked`：该根附件已属于 Git 历史中的其他工作，不要移动；复制为新的未跟踪文件并更新当前草稿引用。
- 图片提示格式不一致或无法解码：重新从原工具导出为受支持格式，不要重命名后缀；静态原图超过 25 MiB/8192 px/4000 万像素时先裁切，GIF/AVIF/动画 WebP 超过公开预算时先在原工具优化。
- Studio 显示“图片未进入草稿”：按 Evidence Rail 的格式、尺寸、帧数或体积说明修复后重新选择；PNG/JPEG 想自动生成 WebP 时改用 Obsidian，不能关闭浏览器预检后强行上传。
- 构建提示图片不存在或大小写不一致：核对 Markdown/cover 的 `/uploads/...` 与仓库文件名；不要依赖 Windows 的大小写不敏感行为。
- 构建提示图片仍在根暂存区：Studio 中先确认 slug 正确，再删除该字段中的旧引用并重新选择图片；Obsidian 草稿则运行发布器完成归档。不要手工让正式内容长期引用 `/uploads/<文件名>`。
- 修改 slug 后图片目录不一致：恢复首次保存时的 slug；若内容尚未发布且确实必须改名，先移除旧图片和引用，再用新 slug 重新上传，避免留下孤儿附件。
- Studio 的 slug 显示 locked：这是已有条目的身份保护，不是权限故障。不要用浏览器开发工具解除；确需迁移时在 Git 中同时处理 Markdown 文件名、frontmatter、附件目录、全部引用和永久重定向。
- 构建提示归档附件无人引用：删除无用文件，或从同 slug 内容的正文/cover 正确引用；代码块中的示例不算引用。
- 构建提示正文图片替代文本为空：在 `![这里填写图片内容](地址)` 的方括号内描述读者无法看到图片时需要知道的信息。
- Preview 无法登录 Studio：Preview 默认关闭 OAuth，这是安全设计；在 Production 验收发布。
