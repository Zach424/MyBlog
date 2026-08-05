# Iteration 0076：当前草稿媒体替代文本轨迹

## 1. 范围与成功标准

本轮只解决一个作者问题：`MEDIA TRACE` 已经能证明附件的 COVER/BODY 用途、次数、源码行和最终变换，但作者仍无法在发布前逐使用点核对最终进入 Markdown 或封面的替代文本。

成功标准冻结为：

- 每个 `PreparedAttachmentUsage` 必须携带 `altTexts: string[]`，按索引与 `sourceLines` 一一对应，长度等于 `occurrences`；
- COVER 文本必须来自已经通过正式 Zod 契约的 `record.coverAlt`；
- BODY 文本必须在既有 Wiki/Markdown 图片归一化回调构造最终 `![alt](url)` 时记录；
- 空或纯空白文本不能被隐藏，必须显示 `EMPTY · WILL FAIL` 并产生 `attachment-alt-empty` blocker；
- Obsidian 在现有媒体用途台账内显示 `ALT · L<n>`，不得增加新卡片、导航、操作或第二套媒体解析；
- readiness schema 从 version 3 提升到 version 4，旧消费方失败关闭；
- 插件与 author doctor 的受信版本同步提升到 1.27.0；
- Git、网络、托管和发布事务边界保持不变。

本轮回滚边界为功能提交 `4ff7acc6d3cbbb71f47d25ebde60b754653cc68c`。

## 2. 项目结构状态

本轮没有新增运行时目录、页面、路由、数据库或云服务，继续以仓库根目录作为 Obsidian Vault。变化集中在现有四层：

```text
lib/
├── obsidian-publishing.ts      # 在现有附件注册/转换中聚合逐次 altTexts
└── content/
    ├── inbox-readiness.ts      # version 4、空 alt blocker 与文本证据
    └── author-doctor.ts        # 受信插件版本 1.27.0
.obsidian/plugins/myblog-publisher/
├── main.js                     # version 4 严格解析、双向 blocker 核对与 ALT DOM
├── styles.css                  # 既有用途台账内的文本/空值状态
└── manifest.json               # 1.27.0
tests/                           # producer、readiness、plugin 与 doctor 回归
docs/                            # 状态、设计、架构、运维、发布与本轮归档
```

项目仍使用 Next.js 16.3.0、React 19.2.6、TypeScript 5、仓库 Markdown/YAML/Zod、Sharp 0.35.3、Obsidian 原生插件和 Vercel 原生 Next.js 部署。GitHub 继续是唯一事实源，Cloudflare 只保留为迁移历史，不是当前依赖。

依照仓库 `AGENTS.md`，实现前完整阅读了 `node_modules/next/dist/docs/01-app/03-api-reference/05-config/02-typescript.md`。本轮没有修改 Next.js 运行时、API、约定或配置；该阅读用于确认现有类型检查与构建路径，而不是引入框架变更。

## 3. 设计内容

视觉继续服务于发布前证据核对。沿用现有 Evidence Rail / media source ledger：

- 每条 COVER/BODY 来源行下面增加一条 `ALT · L<n>`；
- 文本使用宿主已有前景/弱化 token，保留作者原文；
- 空值显示 `EMPTY · WILL FAIL`，只复用宿主 `--text-error`，不扩充产品色板；
- 长文本允许在现有两列布局内换行，窄屏继续折为单列；
- 不增加新卡片、按钮、跳转、自动生成、修复或发布动作。

信息顺序固定为“在哪里使用 → 最终如何描述 → 从哪里到哪里 → 如何变换”，让作者把可访问性措辞和源码位置直接对应起来。

## 4. 使用的技术

- TypeScript required contract：`PreparedAttachmentUsage.altTexts`；
- 正式 Zod 内容解析：COVER 只读取验证后的 `coverAlt`；
- 既有 Wiki/Markdown 图片联合归一化回调：构造最终 Markdown 的同时记录 BODY alt；
- version 4 JSON readiness schema 与 `attachment-alt-empty` 结构化 blocker；
- CommonJS Obsidian 插件的失败关闭 schema、计数和双向 blocker 校验；
- Obsidian 原生 DOM、`setText` 与宿主 CSS token，不渲染 HTML；
- Node test、TypeScript、ESLint、Next build、生产服务器测试与 npm audit。

## 5. 实现的功能

1. 每个 COVER/BODY 媒体使用点都能报告与源码行一一对应的最终替代文本。
2. Markdown 图片保留作者 alt，包括空字符串；Wiki 图片保留显式 display，尺寸语法或无 display 暂时使用文件名回退。
3. 同一附件重复使用或同时作为封面/正文时，各次文本和行号按稳定顺序保留。
4. 空或纯空白 alt 不被美化成成功状态：CLI、JSON 和插件保留证据，并阻塞 readiness。
5. 插件拒绝缺少 `altTexts`、长度不一致、非字符串文本、空值无 blocker 或无空值却出现孤立 blocker 的报告。
6. 插件在原有媒体来源账本中显示 `ALT · L<n>`；空值使用 `EMPTY · WILL FAIL`。
7. inbox evidence 提升为 version 4，插件 manifest、运行时代码和 doctor 提升为 1.27.0。

## 6. 实现方法

先修改 producer、readiness、plugin 和 doctor 测试，再运行四文件定向测试。实现前共有 43 项失败，直接暴露 `altTexts` 缺失、报告仍为 version 3、插件/doctor 仍为 1.26.0，以及空 alt blocker 与 UI 缺失；其余是 schema 提升后的预期级联。

实现没有建立第二个媒体扫描器。正文 Wiki/Markdown 图片的现有归一化回调先计算真正写入 `![alt](url)` 的文本，再与已有来源行一起传给附件注册器；正式 post/project 解析完成后，cover 使用验证后的 `record.coverAlt` 补入同一用途记录。聚合完成后再强制检查 alt 数量与出现次数闭合。

readiness 在 prepared attachment 已经分配给 entry 后扫描空白文本，为对应附件产生带 source path、role 和 line 的 blocker。插件把 version 4 的 `altTexts` 作为 required evidence，先验证字符串/长度，再验证每个空值恰好有 blocker、每个 blocker也确实对应空值，最后才渲染到现有账本。所有文本通过原生 `setText` 写入，插件不解释 Markdown、HTML 或图片。

## 7. 验证证据

- 失败优先：四文件定向测试在实现前失败 43 项，覆盖预期契约缺口；
- 定向回归：`node --experimental-strip-types --test tests/obsidian-publishing.test.mjs tests/inbox-readiness.test.mjs tests/obsidian-plugin.test.mjs tests/author-doctor.test.mjs`，174/174 通过；
- `npm run lint`：0 warning、0 error；
- `git diff --check`：通过；
- `npm test`：335/335 单元/集成测试通过，TypeScript 通过，Next 构建 45/45 页面，生产应用测试 19/19；
- `npm audit --omit=dev --audit-level=high`：生产依赖 0 vulnerability；
- `npm run content:inbox -- --format json`：真实 inbox 为空，report version 4，四项 safety 声明均为 false；
- `npm run release:check`：116.4 秒通过；再次覆盖发布配置、内容维护/inbox/暂存媒体/外链库存、Lint、335/335 测试、TypeScript、45/45 页面构建、19/19 生产应用测试和生产依赖审计 0；
- 发布门第一次运行在 335/335、TypeScript 与 45/45 构建通过后，因项目页状态文案令服务端 HTML 超过 100 KB 而停在生产应用测试 18/19；压缩公开项目状态至比上一功能提交少 218 UTF-8 字节后，单独 19/19 和完整发布门均恢复通过；
- 功能提交远端 Quality Gate：[run 31052849364](https://github.com/Zach424/MyBlog/actions/runs/31052849364)，成功；
- 功能提交 Vercel Production 验证：[run 31052890256](https://github.com/Zach424/MyBlog/actions/runs/31052890256)，成功；归档提交仍由同一链路独立验证。

## 8. 经验与教训

1. 最终 alt 应在最终 Markdown 被构造的位置产生证据。另起正则即使能读到方括号，也会与 Wiki display、尺寸语法、代码围栏和真正发布语义分叉。
2. 可访问性失败也必须保留原始证据。把空值过滤掉会让作者误以为没有图片使用点，而不是知道哪一行会失败。
3. required schema 与双向 blocker 校验能防止“UI 看见空值但 readiness 放行”或“有 blocker 却找不到事实来源”这两类漂移。
4. 逐次 alt 不能挂在去重后的附件级单值上；同一图片在不同上下文可能需要不同描述，必须与每个来源行一一绑定。
5. UI 继续扩充已有账本，比增加一张“无障碍卡片”更容易维持扫描顺序和产品边界。
6. 项目状态也是生产页面内容，归档增长会触发 HTML 预算；把完整工程证据留在 iteration archive、把公开项目摘要保持紧凑，才能同时保留知识与页面性能边界。

## 9. 全局状态、风险与未解决问题

- 当前发布链仍是 GitHub `main` → Vercel Production，Cloudflare 不参与运行；
- version 4 的 `altTexts` 是 required 字段，旧插件会按设计失败关闭，更新仓库后需要重启或重新启用 Obsidian 插件；
- 无 display 的 Wiki 图片当前会使用文件名形成非空文本，因此不会被本轮空值门阻塞，但文件名通常不是高质量图片描述；
- 很长或多行的 alt 会扩展 Modal 中的现有台账，结构/CSS 回归已经覆盖，但仍没有真实 Obsidian 宿主像素快照；
- 真实 inbox 当前为空，正向、重复、同一行、Wiki 回退和阻塞路径由临时 Markdown/媒体夹具覆盖；
- alt 只存在于本地 readiness JSON 与插件 DOM，使用 `setText`，不联网、不进入遥测或云服务；
- Studio OAuth、Vercel 保护、自定义域名、统计、评论和公开邮箱仍按既有所有者边界维护，不在本轮接入。

## 10. 下一轮唯一主任务

为每个 BODY 替代文本增加 `AUTHORED / FILENAME FALLBACK` 来源证据，并让文件名回退进入明确 blocker，要求作者在 Markdown alt 或 Wiki display 中填写真实描述。证据必须在当前正文图片归一化回调中产生；不得另写 Markdown 解析、自动生成或改写文案、改变 Git/发布/托管边界、引入云服务或真实 API。
