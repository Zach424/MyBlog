# Iteration 0025：Obsidian 自动 WebP 优化

## 1. 范围与成功标准

项目继续服务同一目标：作者可以独立地从 Obsidian 记录学习与项目，并把经过验证的 Markdown 和媒体交给 Git/Vercel。Iteration 0022 建立了公开媒体预算，但超限静态图片仍要求作者离开写作流程手工压缩。本轮唯一任务是在 Obsidian 发布事务中加入确定性的本地 WebP 优化，不接入 Cloudflare 或任何外部图片服务。

成功标准：静态 PNG/JPEG/WebP 在修改工作区前进入同盘 staging；自动校正 EXIF 方向并在需要时等比缩放；以固定参数生成 `.webp`，重新验证真实格式、尺寸、像素和 3 MiB 预算；已有高效 WebP 不因重编码变大；GIF、AVIF 与动画 WebP 保持原字节；`--check-only` 展示真实产物但不修改文件；任一附件或完整质量门失败时精确恢复草稿和所有原附件；目标碰撞在事务前失败；不改变 Studio、Markdown 契约、公开 URL 根路径或 Git/Vercel 交付模型。

回滚边界只包括共享媒体准备函数、Obsidian 稳定附件扩展名、发布脚本、测试与文档。没有修改公开页面、视觉系统、内容数据、OAuth、部署工作流或外部基础设施。

## 2. 项目结构状态

- `lib/media-policy.ts`：在既有公开预算外新增原图安全包络、静态 WebP 准备、方向校正、产物复检和人类可读处理摘要；
- `lib/obsidian-publishing.ts`：静态 PNG/JPEG/WebP 的稳定目标名统一为 `.webp`，继续按内容 slug 隔离；
- `scripts/publish-note.mjs`：增加同盘 staging、原附件 backup、原子安装、逆序事务回滚和真实 `--check-only` 预览；
- `tests/media-policy.test.mjs`：覆盖超预算 PNG 的确定性优化、EXIF 方向、高效 WebP/AVIF/GIF 保真和原图安全包络；
- `tests/obsidian-publishing.test.mjs`：覆盖 URL 改写、跨格式同 stem 冲突、真实 CLI 成功和两附件失败回滚；
- `node_modules/.cache/myblog-publish-*`：运行期短命目录，位于工作区同一磁盘并由 Git 忽略，成功或失败后都删除；
- Studio、公开阅读组件、内容 schema、部署工作流和现有公开内容本轮不变。

## 3. 设计内容

本轮是作者工作流设计，不新增公开 UI。核心体验从“先被 3 MiB 门禁拒绝，再自行寻找压缩工具”改为“粘贴原图，预检直接告诉我会发布什么”。预检逐张显示源路径到稳定目标路径，并用 `PNG · 3000×1800 px · 15.46 MiB → WEBP · 2560×1536 px · 0.01 MiB · 减少 …` 这类摘要表达真实转换，不隐藏尺寸或体积变化。

安全边界分为两层：原图安全包络控制本地解码资源，公开预算控制仓库与页面资产。成功发布对作者表现为一次事务；失败不是“尽量清理”，而是把 inbox 文本和每个源附件恢复到原路径与原字节。已有高效 WebP、动画与 AVIF 不进行没有明确收益或可能破坏语义的重编码。

## 4. 使用的技术

- Sharp 0.35.3 / libvips：格式解码、EXIF auto-orient、inside resize 与 WebP 编码；
- TypeScript：共享的 `MediaInspection`、`MediaPreparation` 与两层限制类型；
- Node.js 文件系统：`mkdtempSync`、`renameSync`、`copyFile` 和逐项事务状态；
- 同卷原子 rename：staging 固定在仓库 `node_modules/.cache`，避免 Windows 的 C: 临时目录到 D: 工作区跨卷移动；
- SHA/稳定命名既有策略：不稳定附件名仍使用可读 stem 与 8 位路径哈希；
- Node test 的真实子进程：在隔离临时项目中直接执行发布 CLI，而不只测试帮助函数；
- Git 与 Vercel 既有链路：优化产物仍是普通 `public/uploads` 版本化文件。

WebP 参数固定为 quality 82、alpha quality 100、effort 6、smart subsample；输出上界为 2560×2560 px。原图安全包络为 25 MiB、8192×8192 px、4000 万单帧像素，公开预算继续是 3 MiB、2560 px、800 万单帧像素与 8000 万动图总像素。

## 5. 实现的功能

- Obsidian 静态 PNG、JPEG 自动发布为 `.webp`；
- 静态 WebP 会走同一确定性编码，但若已满足预算且新结果不更小则保留原字节；
- EXIF 方向在缩放前校正，旋转后的宽高按公开边界等比收敛；
- GIF、AVIF 和动画 WebP 通过公开预算后逐字节保留；
- 同一 stem 的 `diagram.png` 与 `diagram.jpg` 会生成相同目标，发布前明确拒绝；
- `--check-only` 真实生成并验证 staged 产物，报告格式/尺寸/体积变化后清理，不修改草稿或附件；
- 正式发布只安装已经复检的 staged 产物；
- 完整质量门失败时，逆序删除所有已安装产物，并恢复每个 backup、正式内容和 inbox 原文；
- 超过原图安全包络的输入在 Sharp 解码前拒绝；
- 成功和失败路径都不会留下 `myblog-publish-*` 临时目录。

## 6. 实现方法

`inspectMediaWithLimits` 把原先单一检查抽成可复用解码器。公开入口 `inspectMediaFile` 保持原有错误和 3 MiB/2560 px 契约；发布准备先使用较大的 SOURCE envelope，允许可优化静态图进入 Sharp，但仍在解码前限制文件体积，并通过 `limitInputPixels` 限制像素成本。

`prepareMediaForPublishing` 根据真实解码格式和帧数分流。单帧 PNG/JPEG/WebP 执行 `autoOrient().resize({ fit: "inside", width: 2560, height: 2560, withoutEnlargement: true })` 后按固定 WebP 参数输出到 staging，再用公开预算检查。已有 WebP 只有在新输出更小或必须缩放/校正时才替换；其他支持格式先通过公开检查再复制，目标扩展名与真实格式仍由检查器核对。

发布 CLI 在任何工作区修改前检查源、目标冲突、受跟踪共享附件、正式内容目标和 `--push` 暂存区。全部附件成功进入 staging 后，预览模式直接报告并删除 staging；正式模式写入目标内容、移除 inbox 草稿，然后对每个附件记录 `backupMoved`/`targetInstalled` 状态。原附件先 rename 到 backup，产物再 rename 到公开目标。catch 按逆序消费事务记录，因此即使在第 N 个附件中途失败，也能只撤销已经发生的步骤。

## 7. 验证证据

- 针对性媒体/Obsidian 测试：21/21 通过；
- 确定性测试对同一 3000×1800、超过 3 MiB 的 PNG 独立编码两次，输出字节完全相同、宽度收敛为 2560 px，源文件不变；
- EXIF 方向测试把 1600×3200、orientation 6 的 JPEG 正确输出为 2560×1280 WebP，证明先校正方向再收敛边界；
- 保真测试确认高效 WebP、AVIF 和两帧 GIF 的输出与输入逐字节相同；25 MiB + 1 byte 输入在解码前失败；
- 真实 CLI 成功测试先执行 `--check-only` 证明零修改，再执行正式发布并验证 Markdown 使用 `.webp`、产物具有 RIFF/WEBP 文件签名、源草稿/PNG 已移除且 staging 为空；
- 真实 CLI 失败测试让质量门以 7 退出，确认 inbox 文本、PNG 与 JPEG 两个源附件逐字节恢复，正式 Markdown 和两个 WebP 均不存在，staging 为空；
- `npm run lint`、`npm run typecheck`、`git diff --check`：通过；
- `npm run release:check`：维护报告健康、53/53 单元测试、TypeScript、33/33 页面构建、15/15 生产 HTTP/质量测试、production-only audit 0；
- 实现提交、GitHub Quality Gate、Vercel Production 和稳定域名冒烟将在推送后补入本档案。

## 8. 经验与教训

- 媒体“允许输入多大”和“允许公开多大”是两个不同契约；只放宽原门禁会让超限文件进入 Git，只保留原门禁则无法自动优化；
- staging 必须与源/目标同盘。Windows 的系统 temp 在 C:、仓库在 D:，跨卷 `rename` 不是可依赖的原子操作；把短命目录放在已忽略的仓库 cache 同时解决原子性和版本污染；
- rollback 要记录已经发生的状态，并逆序恢复；只维护“已移动附件列表”无法覆盖 backup 已移动但 target 尚未安装的中间失败；
- 预览必须运行真实编码，否则作者看到的体积和尺寸仍只是估计，正式发布可能出现新的失败；
- Sharp 在 Windows 测试中可能延迟释放解码文件句柄。真实 CLI 集成测试对最终 WebP 使用 RIFF/WEBP 文件签名验证，避免测试进程自己持有输出文件而导致临时目录 `EBUSY`；格式/尺寸解码已由独立媒体单元测试覆盖；
- 生成动画 GIF 测试夹具时必须显式使用 raw `pageHeight`，否则看似传入多帧参数也可能只产出一帧；
- EXIF 方向必须在 resize 之前应用，且 resize 应针对校正后的边界。按原 metadata 预先计算目标宽高会把旋转竖图额外缩小；
- 已经高效的 WebP 不应为了“统一处理”而变大，固定格式策略仍需保留收益判断；
- 静态格式统一 `.webp` 后，原本不同扩展名可能折叠到同一目标；冲突必须在写文件前明确处理。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容/媒体契约、附件发布、双向知识链接、自动交付、恢复、新鲜度硬门和维护预警均可用。媒体派生从 pending 进入 partial：Obsidian 静态附件不再依赖人工压缩，且发布事务的恢复边界覆盖所有附件。

剩余主要风险：Studio 和普通 Git 图片仍只受公开预算约束，没有自动优化；正式 Markdown 的本地图片引用与实际文件尚未做双向完整性检查；没有响应式多尺寸派生；动画与 AVIF 需要作者自行满足预算；附件仍增加 Git 仓库体积；Decap 上游开发依赖风险、CSP 内联例外、自定义域名、统计、评论和公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

建立正式 Markdown 与 `public/uploads` 的双向引用完整性门禁：从 prose 中抽取本地 `/uploads/...` 图片，拒绝缺失、目录越界、查询/锚点和未被任何公开内容引用的已归档附件；代码示例、外部 HTTPS 图片与 `content/inbox` 草稿附件保持现有语义。先得到可靠的内容—资产所有权关系，再独立设计响应式多尺寸派生。
