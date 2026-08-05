# Iteration 0075：当前草稿媒体来源用途

## 1. 范围与成功标准

本轮只解决一个作者问题：`MEDIA TRACE` 已经能证明附件如何变换，但作者仍无法直接确认它来自封面还是正文、在草稿中出现几次、具体位于哪些源码行。

成功标准冻结为：

- 每个 prepared attachment 必须携带有序 `usages`，结构为 `{ role: "cover" | "body", occurrences, sourceLines }`；
- 同一附件可以同时用作封面与正文，角色唯一且固定按 COVER、BODY 排序；
- COVER 必须恰好出现一次；BODY 可以重复，包含同一源码行内的重复引用；
- `sourceLines.length === occurrences`，行号均为正整数且非递减；
- Obsidian 在既有 `MEDIA TRACE` 变换轨迹前展示用途账本，不添加操作或第二套导航；
- 不重新读取图片，不在插件中实现第二套 Markdown/媒体解析，不改变 Git、发布、网络或托管边界；
- readiness schema 从 version 2 提升到 version 3，旧消费方必须失败关闭；
- 插件与 author doctor 的受信版本同步提升到 1.26.0。

本轮回滚边界为功能提交 `890db7f46e681474120c6d0b4b7d61a5beda528b`。

## 2. 项目结构状态

本轮没有新增运行时目录、页面、路由、数据库或云服务，继续以仓库根目录作为 Obsidian Vault。变化集中在四层：

```text
lib/
├── obsidian-publishing.ts      # 在既有附件注册/转换中聚合 usages
└── content/
    ├── markdown.ts             # 把 prose 源偏移传给现有转换回调
    ├── inbox-readiness.ts      # version 3 报告与文本来源行
    └── author-doctor.ts        # 受信插件版本 1.26.0
.obsidian/plugins/myblog-publisher/
├── main.js                     # version 3 严格解析与来源账本 DOM
├── styles.css                  # 现有 trace 内的响应式用途布局
└── manifest.json               # 1.26.0
tests/                           # 生产者、报告、插件与 doctor 回归
docs/                            # 状态、设计、架构、运维、发布与本轮归档
```

项目仍使用 Next.js 16.3.0、React 19.2.6、TypeScript 5、仓库 Markdown/YAML/Zod、Sharp 0.35.3、Obsidian 原生插件和 Vercel 原生 Next.js 部署。GitHub 继续是唯一事实源，Cloudflare 只保留为迁移历史，不是当前依赖。

本轮没有修改 Next.js 源码、API、约定或文件结构，因此没有触发 `node_modules/next/dist/docs/` 的框架实现指南读取；完整 Next build 仍用于证明现有版本兼容。

## 3. 设计内容

视觉主体是作者发布前的事实核对，不是媒体资产管理器。沿用 Commit Trace / Evidence Rail：

- 在每条现有 transformation tape 前插入紧凑来源账本；
- 使用 `COVER / BODY` 标签、`L<n>` 行号与重复时的 `×n`；
- 同一附件同时作为封面和正文时显示两条用途证据；
- 使用宿主已有字体、等宽字体和 muted token；
- 窄屏从双列折为单列；
- 不增加新色板、卡片、渐变、阴影、动画、点击、上传、修复、跳转或发布动作。

信息顺序固定为“在哪里使用 → 从哪里到哪里 → 如何变换”，让作者先核对草稿意图，再核对媒体处理结果。

## 4. 使用的技术

- TypeScript 类型契约：required `PreparedAttachment.usages`；
- 现有 Markdown prose 扫描器：传递 fenced-code 与 inline-code 边界之外的精确源偏移；
- 二分查找行号解析器：由原稿换行起点把字符偏移映射成 1-based 行号；
- 既有 Wiki/Markdown 图片联合匹配与 cover 注册：同一次归一化完成引用转换和证据聚合；
- version 3 JSON readiness schema 与失败关闭的 CommonJS 插件解析器；
- Obsidian 原生 DOM/CSS token，不引入 UI 依赖；
- Node test、TypeScript、ESLint、Next build、生产服务器测试与 npm audit。

## 5. 实现的功能

1. 每个附件现在都能报告 COVER、BODY 或两者组合。
2. BODY 的每次出现都保留源码行，包括一行内重复两次时的重复行号。
3. cover 先注册，因此附件顺序和角色顺序保持确定。
4. fenced code 与 inline code 中看起来像图片的文本仍不会计入用途。
5. CLI 文本报告会输出 `附件来源 [body] L... · ×n`，JSON 报告提升为 version 3。
6. Obsidian `MEDIA TRACE` 在既有变换详情前展示 COVER/BODY 来源账本。
7. 插件拒绝缺少 usages、重复或乱序角色、cover 重复、次数与行号数量不一致、非法或逆序行号。
8. author doctor、插件 manifest 与运行时代码统一为 1.26.0。

## 6. 实现方法

先写生产者、readiness、插件和 doctor 测试，再运行四文件定向测试。失败阶段共有 41 项失败，直接暴露了 `usages` 缺失、报告仍为 version 2、插件与 doctor 仍为 1.25.0，以及 DOM 没有来源账本；其余多数失败是 schema 升级后的预期级联。

实现时没有建立第二个媒体扫描器。`transformMarkdownProse` 和行内代码分段函数只增加源偏移传递；原 Wiki/Markdown 图片联合匹配仍是唯一正文附件识别点。发布器建立一次原稿行起点索引，在 cover 注册和正文替换回调中将偏移映射为行号，再按已存在的附件 key 聚合用途。媒体读取、格式检测、优化、目标命名与事务逻辑完全复用原路径。

插件把 `usages` 作为 version 3 required 字段，先验证角色/顺序/次数/行号闭合，再验证原有 preparation 包络。渲染层只把已经通过 schema 的事实写入现有 `MEDIA TRACE`；插件不读取 Markdown、不读取图片，也没有任何修复或发布能力。

## 7. 验证证据

- 失败优先：四文件定向测试在实现前失败 41 项，覆盖所有预期缺口；
- 定向回归：`node --experimental-strip-types --test tests/obsidian-publishing.test.mjs tests/inbox-readiness.test.mjs tests/obsidian-plugin.test.mjs tests/author-doctor.test.mjs`，167/167 通过；
- `npm run lint`：0 warning、0 error；
- `git diff --check`：通过；
- `npm test`：328/328 单元/集成测试通过，TypeScript 通过，Next 构建 45/45 页面，生产应用测试 19/19；
- `npm audit --omit=dev --audit-level=high`：生产依赖 0 vulnerability；
- `npm run content:inbox -- --format json`：真实 inbox 为空，report version 3，四项 safety 声明均为 false；
- `npm run release:check`：115.4 秒通过；再次覆盖发布配置、内容维护/inbox/暂存媒体/外链库存、Lint、328/328 测试、TypeScript、45/45 页面构建、19/19 生产应用测试和生产依赖审计 0；
- 功能提交远端 Quality Gate：[run 31051421580](https://github.com/Zach424/MyBlog/actions/runs/31051421580)，成功；
- 功能提交 Vercel Production 验证：[run 31051465868](https://github.com/Zach424/MyBlog/actions/runs/31051465868)，成功；归档提交仍由同一链路独立验证。

## 8. 经验与教训

1. 行号证据应该在语法被确认的同一位置产生。另起正则扫描即使看起来便宜，也会逐渐与代码围栏、行内代码和真正转换语义分叉。
2. “出现次数”不能从去重后的附件清单反推；必须在每次真实匹配时聚合，并保留同一行的重复行号。
3. required schema 变更适合显式提升版本。version 2 消费方静默忽略新事实会让作者误以为看到了完整证据，因此 version 3 选择失败关闭。
4. UI 增加事实不等于增加产品表面。把来源账本嵌入原 transformation tape，比新增媒体卡片或独立页面更符合发布前快速核对。
5. 本轮先固定失败测试，使 schema 级联错误与真实实现缺口容易区分，也避免只更新 DOM 而遗漏 CLI、doctor 或 producer。

## 9. 全局状态、风险与未解决问题

- 当前发布链仍是 GitHub `main` → Vercel Production，Cloudflare 不参与运行；
- version 3 的 `usages` 是 required 字段，旧插件会按设计失败关闭，更新仓库后需要重启或重新启用 Obsidian 插件；
- 源码行对应原始草稿，并依赖当前归一化流程保持换行；未来若引入会重排行的预处理，必须重新审计偏移契约；
- 没有真实 Obsidian 宿主像素快照，现有 DOM/CSS、宽屏/窄屏结构测试和首次实际使用观察仍是当前边界；
- 真实 inbox 当前为空，正向与阻塞路径由临时 Markdown/媒体夹具覆盖；
- 作者现在能看到媒体用途、次数、来源行与变换，但还不能逐使用点核对最终发布的替代文本；
- Studio OAuth、Vercel 保护、自定义域名、统计、评论和公开邮箱仍按既有所有者边界维护，不在本轮接入。

## 10. 下一轮唯一主任务

为 `MEDIA TRACE` 补充每个 COVER/BODY 使用点最终发布的替代文本证据，让作者在发布前核对图片可访问性措辞。必须复用现有 frontmatter cover/`coverAlt` 和正文图片归一化结果，不得重新读取图片、在插件中实现第二套 Markdown/媒体解析、改变 Git/发布/托管边界、引入云服务或真实 API、自动发布或自动修复。
