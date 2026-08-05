# Iteration 0074：当前草稿精确媒体变换轨迹

日期：2026-08-06

状态：完成

唯一主任务：把当前草稿作者意图中的 `MEDIA` 从单一附件计数提升为可核对的精确变换清单，直接消费 readiness 已有的 source/target/public URL 与媒体准备包络，不重新读取图片、不在插件中实现第二套媒体策略。

## 1. 范围与成功标准

MyBlog 的长期目标是让作者不依赖 Codex，也能在 Obsidian 或网页 Studio 中安全维护并发布 Git 中的 Markdown。Iteration 0073 已让作者看到精确站内链接，但附件仍只有数量；作者无法在发布前确认本地图片会被归档到哪里、公开地址是什么、是否转成 WebP、尺寸/帧数是否保持，以及具体节省了多少字节。

本轮成功标准是：

- 每个附件显示精确来源路径、仓库目标路径和公开 URL；
- 已派生媒体显示输入与输出格式、宽高、帧数和字节；
- 优化结果明确显示 `OPTIMIZED` 与节省/增加的字节和百分比，原样保留显示 `PRESERVED / BYTE-STABLE`；
- 只有阻塞且存在同来源附件问题时，才允许显示 `UNPROVEN / MEDIA ENVELOPE UNAVAILABLE`；
- 插件必须交叉验证路径、格式、尺寸、帧数、字节差和 optimized 语义，任何漂移失败关闭；
- 保持 version 2 readiness schema、正式发布器、媒体策略、Git/网络/托管边界不变；
- UI 只增加只读 `MEDIA TRACE`，不增加上传、修复、检查、发布、跳转或第二套导航。

回滚边界是功能提交 `f26fe0f4adb732cf5ace7e3b523fa1993627f654`。本轮未修改 Next.js 源码或调用 Next.js API，按仓库 `AGENTS.md` 无需选择 Next.js 编码指南。

## 2. 项目结构状态

功能提交修改八个文件：

- `.obsidian/plugins/myblog-publisher/main.js`：增加媒体包络严格解析、格式化函数和 `MEDIA TRACE` 原生 Modal；
- `.obsidian/plugins/myblog-publisher/styles.css`：增加 transformation tape、媒体规格与移动端单列规则；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件升级到 1.25.0；
- `lib/content/author-doctor.ts`：doctor 期望版本同步到 1.25.0；
- `tests/inbox-readiness.test.mjs`：证明正式 producer 已提供完整且自洽的媒体准备包络；
- `tests/obsidian-plugin.test.mjs`：覆盖 optimized、preserved、unproven、渲染和九类失败关闭；
- `tests/obsidian-publishing.test.mjs`、`tests/author-doctor.test.mjs`：同步插件版本契约。

归档提交更新仓库根 Obsidian Vault 中的 README、STATUS、ROADMAP、DESIGN、ARCHITECTURE、OPERATIONS、PUBLISHING、inbox 指南、公开项目页、迭代索引与本文件。GitHub 继续是内容和代码唯一事实源，Vercel 继续是当前生产托管；当前运行链路不依赖 Cloudflare。

## 3. 设计内容

用户主体是“准备发布一篇草稿、需要在继续完整检查前确认图片变换的作者”。1.25.0 保留 `AUTHOR INTENT / LOCAL EVIDENCE`、`DRAFT → PUBLIC`、READY/SCHEDULED/HOLD、`TYPE / DATE / MEDIA / LINKS` 和 `LINK TRACE`；新的 `MEDIA TRACE / n ATTACHMENT(S)` 位于链接轨迹之前，让作者按发布事务顺序先核对内容资产，再核对内容关系。

每个媒体条目是一条真实 transformation tape：状态行显示 `OPTIMIZED`、`PRESERVED` 或 `UNPROVEN`；第二标签显示节省/增加量、`BYTE-STABLE` 或包络不可用；路径沿 `source → REPOSITORY target` 展开，公开地址单列；有准备包络时输入/输出规格并排对照。它不是上传列表、资产管理器或 dashboard，不提供点击、操作按钮、完成率、渐变、阴影或动画。

视觉继续使用 Obsidian 宿主的 interface/monospace 字体、text token、既有 trace 色和垂直规则线。桌面端输入/输出规格双列，窄屏降为单列；状态的含义来自媒体事实，不引入新色板。`frontend-design` 约束了这一取舍：用结构表达“本地来源 → 仓库归档 → 公开 URL”的真实关系，保持 Evidence Rail 的工程档案语言。

## 4. 使用的技术

- CommonJS Obsidian 插件、原生 Modal DOM 与宿主 CSS variables；
- version 2 read-only inbox JSON 与 exact-key parser；
- 既有 `PreparedAttachment`、`MediaPreparation`、`MediaInspection` 事实；
- 路径扩展名与媒体格式的严格映射；
- B/KiB/MiB 格式化、确定性一位小数百分比；
- CSS Grid、垂直规则线与移动端响应式布局；
- Node test runner、临时 Git/Sharp 媒体夹具、ESLint、TypeScript、Next build、生产 HTTP 测试与 npm audit；
- `research-iteration-loop` 用于单主任务、失败优先、定向到全量门禁、全局复核、归档与下一任务冻结。

没有新增依赖、数据库、凭据、网络数据源、云服务或真实 API。

## 5. 实现的功能

- MyBlog Publisher 1.25.0 在当前草稿作者意图页显示 `MEDIA TRACE`；
- 计数根据 0/1/n 使用正确的 `ATTACHMENT(S)` 文案；
- optimized 静态图片显示 `SAVED` 或防御性的 `ADDED` 字节量与百分比；
- preserved WebP/AVIF/动画 GIF 显示 `PRESERVED / BYTE-STABLE`；
- 每项显示来源、仓库目标、公开 URL、输入与输出格式/尺寸/帧数/字节；
- blocked 且缺失/无效的附件可以显示 `UNPROVEN`，但不能伪装为已验证变换；
- ready/scheduled 附件缺少准备包络时直接拒绝；
- 插件拒绝重复 source/target、检查路径漂移、扩展名与格式不符、字节差错误、preserved 字节/格式/尺寸/帧变化、optimized 非静态输出、非 WebP 输出或尺寸放大；
- 既有链接 trace、发布、复核、Git 交付、媒体准备与 schema 行为保持不变。

## 6. 实现方法

readiness producer 在 0072 已把每个附件的 `sourcePath`、`targetPath`、`publicUrl` 和可选 `preparation` 放入 version 2 报告。本轮没有扩展 schema，而是在插件边界把这些已有字段提升为可显示前的强约束。

parser 先验证附件数组、精确字段和安全路径，再构造 source/target 集合保证唯一性。存在 preparation 时，source/output inspection 路径必须分别等于附件 source/target；格式必须与路径扩展名一致；宽高、帧数和字节必须是正整数；`bytesSaved` 必须精确等于输入减输出。`optimized: false` 要求格式、尺寸、帧数和字节全部不变；`optimized: true` 只接受单帧 JPEG/PNG/WebP 输入与单帧 WebP 输出，且输出不得放大。没有 preparation 时只允许 blocked，并要求存在同来源的 `attachment-missing` 或 `attachment-invalid` issue。

Modal 只消费 parser 返回的可信对象。格式化函数统一生成字节、规格和差值文案；媒体 DOM 使用状态、变换、来源、仓库目标、公开 URL、输入和输出这组固定语义。CSS 继续使用现有插件命名空间和宿主 token，避免污染 Vault 其他界面。

## 7. 验证证据

失败优先基线：先把版本合同与媒体 trace 期望写入测试，定向运行出现 36 个预期失败；除版本级联外，真实缺口收敛为没有 `MEDIA TRACE`、没有媒体包络交叉验证、插件版本仍为 1.24.0。

实现后证据：

- 四个相关测试文件定向回归 160/160；
- `npm run lint` 0 error、0 warning；
- `git diff --check` 通过；
- `npm test` 通过 321/321 单元与集成、TypeScript、45/45 构建页面和 19/19 生产应用测试；
- `npm audit --omit=dev --audit-level=high`：0 vulnerability；
- 真实 `npm run content:inbox -- --format json` 返回 version 2、空 inbox，四项安全声明全为 false；
- 功能提交仅包含八个实现/契约文件，归档与功能提交分离；
- 归档后的 `npm run release:check` 用时 144.4 秒：Release config、Current 1 / Historical 3 / 未公开 0、inbox 0、根暂存 0、外链本地问题 0、lint、321/321、TypeScript、45/45 页面、19/19 生产应用测试和生产依赖审计 0 全部通过；远端 Actions 与生产站验证在归档提交推送后执行。

## 8. 经验与教训

1. “附件存在”与“变换可证明”是不同事实；ready 状态不能接受缺少 preparation 的媒体。
2. schema 不变不等于消费者可以宽松读取；已有字段之间仍需做路径、算术和语义交叉验证。
3. `optimized` 不是装饰标签，它同时约束输入类型、输出格式、帧数和尺寸方向。
4. `PRESERVED` 必须真正逐项稳定，仅检查 `bytesSaved === 0` 无法排除格式或尺寸漂移。
5. 字节差应由原始值重新计算，不能信任报告中的衍生数字。
6. blocked 附件没有包络是可解释状态，但必须绑定同来源的 missing/invalid 问题，不能泛化为任意失败。
7. source 和 target 都要唯一；只检查 source 会遗漏不同附件覆盖同一公开资产的风险。
8. 媒体规格适合做对照 tape，不适合做卡片矩阵；作者需要核对变换，不是在管理图库。
9. 只读 UI 仍需严格失败关闭，因为半可信摘要会让作者错误地放行后续发布。
10. producer 测试应证明 source/output 路径和字节关系，而不仅断言“有 preparation”。

## 9. 全局状态、风险与未解决问题

作者现在可以在 Obsidian 独立创建、改名、清理旧身份、查看当前草稿类型/目标/日期、精确媒体变换、精确站内链接、检查并发布；网页 Studio 仍提供另一条独立发布路径。当前草稿页仍只是发布前只读证据，完整 `--check-only`/`--push` 门禁保持最终权威。

真实 inbox 当前为空，媒体正向/阻塞路径由临时真实图片夹具覆盖；仍没有真实 Obsidian 宿主像素快照。媒体 trace 只解释每个唯一附件的变换，不显示该图片在草稿中作为封面或正文出现，也不显示源码行和重复次数。大量附件或超长路径在真实主题下仍需随首次使用观察。聚焦模式仍轻量解析全部草稿与已发布链接目标，以保留共享源和目标碰撞正确性，但只为目标草稿运行昂贵媒体准备。

本轮没有改变公开内容集合、数据集或托管；Current 1 / Historical 3 / 未公开 0 保持稳定。Studio、GitHub Actions、Vercel、Cloudflare 历史边界和所有手动外部接入均未改变。

## 10. 下一轮唯一主任务

把 `MEDIA TRACE` 从“每个唯一附件的变换”提升为“附件在当前草稿中的精确来源证据”：为每项补充 `COVER / BODY` 角色、出现次数和全部源码行，直接在现有 cover/附件规范化过程或共享 Markdown AST 中产出，不重新读取图片、不在插件中增加第二套媒体解析器。必要时以显式 schema 升版保证旧消费者失败关闭；不得改变发布、Git、网络和托管边界，不增加跳转、上传、修复或自动发布动作。

## 结论

MyBlog Publisher 1.25.0 把无法解释的 `MEDIA 2` 变成可追溯的媒体变换账本。作者现在能从本地来源核对到仓库目标和公开 URL，并比较输入/输出的真实格式、尺寸、帧数和字节；优化、保留与无法证明三种状态都有严格证据。整个能力复用 readiness 已有媒体准备结果，不再读图、不复制媒体规则，也没有把只读作者意图扩张为资产管理器或发布入口。
