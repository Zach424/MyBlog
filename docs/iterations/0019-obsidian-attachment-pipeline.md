# Iteration 0019：Obsidian 附件发布管线

## 1. 范围与成功标准

项目目标仍是把个人学习和项目经验沉淀为可检索、可维护、可独立发布的工程知识库。上一轮已打通 Studio、Obsidian、Git 自动部署与回滚；本轮选择作者体验关键路径中的单一任务：让 Obsidian 直接粘贴的图片可靠进入公开博客。

成功标准：Wiki 与 Markdown 图片语法都能识别；附件按内容 slug 隔离；空格、中文和大小写文件名变成稳定 URL；越界、共享跟踪文件和高风险格式被拒绝；质量门失败时草稿与附件一起恢复；真实新增内容能通过非快照化质量门。

回滚边界只包含 `lib/obsidian-publishing.ts`、`scripts/publish-note.mjs`、发布测试和配套文档，不修改公开页面视觉或外部服务。

## 2. 项目结构状态

- 仓库根目录继续作为 Obsidian Vault；默认新笔记在 `content/inbox`，默认附件先进入 `public/uploads`；
- `lib/obsidian-publishing.ts` 负责纯转换、路径约束和附件归档计划；
- `scripts/publish-note.mjs` 负责文件存在性、Git 跟踪边界、移动、质量门、恢复、提交和推送；
- 正式附件结构为 `public/uploads/<内容 slug>/<稳定文件名>`；
- `tests/obsidian-publishing.test.mjs` 验证转换契约，`tests/rendered-html.test.mjs` 验证内容增长后的公开索引不变量；
- `docs/STATUS.md` 成为每轮更新的项目状态快照，`docs/iterations/` 保存每轮知识与证据。

## 3. 设计内容

作者只需要在 Obsidian 中粘贴图片并填写有意义的替代文本。发布器把临时附件位置视为收件区，把文章专属目录视为稳定公开位置：

```text
public/uploads/Pasted image 20260804 120000.PNG
  → public/uploads/<post-slug>/pasted-image-20260804-120000-<hash>.png
  → /uploads/<post-slug>/pasted-image-20260804-120000-<hash>.png
```

已有小写 ASCII 安全文件名保持不变；不稳定文件名保留可读 ASCII 部分并追加源路径 SHA-256 的前 8 位，纯中文名使用 `asset-<hash>`。哈希只解决命名稳定和冲突，不承担安全认证。

本地图片只允许 PNG、JPEG、WebP、GIF、AVIF。SVG 没有进入白名单，避免把可能包含主动内容的文件作为作者附件带入同源站点。外部 URL 不复制进仓库。

## 4. 使用的技术

- Node.js `crypto.createHash`：生成确定性短哈希；
- Node.js `fs`：创建专属目录、原子重命名与失败恢复；
- TypeScript：附件计划类型与纯转换逻辑；
- Git `ls-files --error-unmatch`：阻止移动已由其他公开内容跟踪的共享源附件；
- Obsidian Wiki embeds 与标准 Markdown 图片语法；
- Node test、ESLint、TypeScript、Next.js build、生产 HTTP 测试；
- 官方语法依据：[Obsidian Attachments](https://obsidian.md/help/attachments)、[Internal links](https://obsidian.md/help/links)、[Embed files](https://obsidian.md/help/embeds)。

## 5. 实现的功能

- `![[image.png|替代文本]]` 转换为标准 Markdown 图片；
- `![](../../public/uploads/image.png)` 与 `/uploads/image.png` 统一进入文章专属目录；
- 围栏代码块中的图片语法示例保持原样，不会被误判为真实附件；
- 支持带空格、中文和大写扩展名的 Obsidian 默认粘贴文件；
- `--check-only` 输出每个附件的源路径和计划目标路径；
- 正式发布前检查源文件、目标冲突和 Git 跟踪状态；
- 完整质量门失败后反向移动本轮附件并恢复 inbox 草稿；
- Git 暂存只包含正式内容、应记录的源删除和目标附件；
- 首页版本日期改为与当前最新公开文章互相校验；
- RSS 与 Sitemap 改为比较文章/项目 URL 集合，不再固定初始条目数。

## 6. 实现方法

转换阶段先解析标准 Markdown 图片，再解析 Wiki embed，避免新生成的 Markdown URL 被第二次归档。每个引用被规范化为 `{sourcePath, targetPath, publicUrl}`；相同源只保留一个计划，不同源若映射到同一目标则失败。

执行阶段在修改文件前完成存在性、目标冲突与跟踪状态检查。生成正式内容后逐个 `rename` 附件并记录已完成列表；任何移动或 `npm run check` 失败都会按逆序恢复附件，然后恢复原草稿并删除正式内容。成功后 `--push` 只将目标附件路径传入精确暂存集合。

真实演练首次揭示：项目的生产 HTML 测试固定期待 `2026-07-18` 和 4 个 RSS 条目，导致任何当日新文章失败。测试随后改为验证业务不变量：`REV` 日期等于首页首条公开文章日期，RSS 中内容 URL 唯一，且与 Sitemap 的文章/项目 URL 集合完全相等。

## 7. 验证证据

- 专项测试第一次：30 个单元测试中 28 通过、2 失败；失败定位为 Wiki 转换结果被 Markdown 规则二次处理；
- 调整转换顺序后：Obsidian 专项测试 7/7 通过；
- 第一次真实本地发布演练：30/30 单元测试、类型检查、34 项静态生成通过，生产 HTTP 13/15；两个失败均来自固定内容快照；发布器成功恢复 inbox 草稿与根附件；
- 调整增长型断言后第二次真实演练：30/30 单元测试、类型检查、Next.js build（34 项生成）和 15/15 生产 HTTP 测试全部通过；
- 演练实际结果：草稿进入 `content/posts/iteration-19-attachment-validation.md`，图片进入 `public/uploads/iteration-19-attachment-validation/pasted-image-iteration-19-4c5de094.svg`，正文 URL 同步重写；随后演练内容完整清理；
- 最终实现进一步移除 SVG 白名单，并补充本地越界、格式与围栏代码示例回归测试，专项测试 8/8 通过；
- 首次最终 `release:check` 的代码、类型、33 项静态生成和 15/15 生产 HTTP 测试均通过，但动态 npm 审计发现 Next.js 16.2.10、PostCSS 8.5.10 与 sharp 的新高危通告，发布门按设计失败；
- 对照 GitHub Advisory 与 Next.js 官方 v16.3.0 发布，依赖升级为 Next.js/ESLint Config 16.3.0、PostCSS 8.5.23、sharp 0.35.3；`npm audit --omit=dev --audit-level=high` 随后为 0；
- 本轮最终 `npm run release:check` 通过：31/31 单元测试、TypeScript、Next.js 16.3.0 build（33 项生成）、15/15 生产 HTTP 测试与生产依赖 0 漏洞；
- 实现提交 `cd7666a` 已推送 `main`；直连 GitHub 两次超时后，仅对当前 Git 命令使用本机 `127.0.0.1:7897` 代理完成推送，未更改永久配置；
- GitHub Quality Gate run `30884132095` 为 completed/success；Vercel Production deployment `5739036748` 的 SHA 精确等于 `cd7666a7e0f97a96893fb6c70d9c22df1a5303d5`，状态 success，immutable URL 为 `https://blog-4ynawjo6y-czq1.vercel.app`；
- GitHub 自动生产冒烟 run `30884170756` 为 completed/success；独立运行 `npm run production:smoke -- https://blog-iota-five-59.vercel.app --expect-oauth` 返回 `23 routes, OAuth 302`。第一次直连复核只发生网络连接失败，启用当前进程 Node 环境代理后通过，未修改系统配置。

## 8. 经验与教训

- 写作工具的默认行为比理想化输入更重要：Obsidian 默认粘贴名经常包含空格、日期和本地语言；
- 多阶段文本转换要防止上一阶段产物被下一阶段重复消费，顺序本身就是契约；
- “测试通过”不等于“内容可增长”。样例标题可以作为基线，但日期和内容数量必须验证关系而非冻结值；
- 回滚不能只恢复 Markdown。内容与附件是同一个发布事务，任何一个遗留都会污染下一次发布；
- Git 跟踪状态是资源所有权信号：移动已跟踪的共享附件会破坏旧内容，应明确拒绝；
- 附件白名单不仅是路径问题，也要考虑同源文件格式的主动内容风险。
- 依赖审计是时间相关门，不应把过去的 0 漏洞当作当前证据；框架与其嵌套 PostCSS/sharp 必须一起核对实际解析版本。

## 9. 全局状态、风险与未解决问题

公开阅读、内容契约、搜索/Feed、Studio、Obsidian、Git 自动生产、冒烟和回滚均为 done。附件发布从“部分实现/文档不一致”升级为 done；内容增长测试从固定样例升级为稳定关系验证。

剩余风险：图片尚未压缩或限制体积；直接使用 Git 存储大量媒体会增加 clone 和部署成本；发布器只处理图片，不处理音频/PDF；Obsidian 内部文章链接与反向链接尚未进入公开知识网络；自定义域名、统计和评论仍需所有者最终选择。完整开发依赖审计仍报告 `decap-cms` 传递树的高危项，直接包暂无自动修复；它不在服务端生产依赖审计范围，但浏览器 Studio 资产仍需后续专门评估。

## 10. 下一轮唯一主任务

实现 Obsidian 内部文章/项目链接到稳定站点 URL 的转换，并从公开内容正文派生反向链接，在详情页形成无需数据库的第一版知识网络。
