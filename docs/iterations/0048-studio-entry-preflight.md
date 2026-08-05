# Iteration 0048：Studio 全字段发布就绪预检

## 1. 范围与成功标准

本轮只为网页 Studio 增加 posts/projects 当前条目的只读全字段 Author Proof，不改变 Git 内容事实源、Decap required widget、editorial workflow、OAuth、媒体上传、Obsidian 发布事务或正式构建门。成功标准是：标题、slug、摘要、日期/新鲜度、标签、草稿/精选、封面/替代文本、文章类型/专题/canonical、项目状态/技术栈/repository/demo 与正文复用正式内容契约；问题集中显示并随输入自动更新；READY 明确只表示当前条目字段通过；预检不保存、不阻断编辑、不发送未知字段；快速输入保持 latest-wins，网络失败保留正文；320px、深色与桌面布局无根溢出；端点同源、限量、不缓存、不索引，完整仓库构建仍是最终权威。

## 2. 项目结构状态

- `lib/content/contract.ts`：新增 `inspectContentDraft`，在结构化条目上复用既有文章/项目 Zod schema、标签注册表、正文公式门、字词统计与 180 天时效规则；
- `lib/studio-entry-preflight.ts`：把内容契约结果组织为 PATH、VISIBILITY、CONTEXT、BODY 四项证据、逐字段问题和明确的仓库检查边界；
- `app/studio/entry-preflight/route.ts`：同源、JSON-only、128 KiB、`no-store`/`noindex` 的只读 POST；
- `studio/entry-preflight.mjs`：固定 posts/projects 字段白名单，归一 Date/Immutable 值、过滤空可选字段、请求端点并提供状态/字段中文名；
- `app/studio/entry-preflight.mjs/route.ts` 与 `lib/studio-assets.ts`：以显式静态 Route Handler 同源提供作者端 ESM；
- `studio/math-preview.mjs`：现有 custom preview template 按集合创建实例，新增独立 320 ms 防抖、AbortController、generation 与 publication ledger，同时保留公式预览状态机；
- `studio/preview.css`：新增 ENTRY CONTRACT 横向证据账本、问题清单、状态轨、320px 两列/单列降级和深色规则；
- `tests/studio-entry-preflight.test.mjs`：覆盖字段清单对齐、数据归一/最小披露、文章/项目、跨字段问题、时效边界与请求协议；
- `tests/studio-math-preview.test.mjs`：覆盖按集合幂等注册、字段预检 latest-wins、旧回包丢弃与网络恢复；
- `tests/quality-gates.test.mjs`：真实生产服务器覆盖静态模块、有效/无效 200/422、403、413、415 与响应头；
- `scripts/smoke-production.mjs`：线上冒烟新增预检模块和真实有效文章 POST；
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/PUBLISHING.md`：同步作者操作、架构、视觉和失败恢复；
- 公开页面、内容文件、搜索、Feed、数据库边界、OAuth scope、媒体事务与 Obsidian 命令没有改变。

## 3. 设计内容

新能力扩展原有 `AUTHOR PROOF / GIT DRAFT`，没有再叠一张圆角后台卡片。`ENTRY CONTRACT` 是一张 publication ledger：左侧细状态轨表达 preparing/checking/ready/needs work，标题先说明当前结论，说明行给出下一步；PATH、VISIBILITY、CONTEXT、BODY 四格分别回答会发布到哪里、是否公开、内容属于持续维护还是历史快照、正文规模是多少。

错误不是笼统百分比，而是按中文字段名和可执行原因逐行对齐。最多展开八项，其余显示剩余计数，避免空白新条目的大量必填问题把正文推到不可达区域。READY 文案显式保留“仓库关系、媒体引用和完整构建仍在保存后验证”；网络失败说明内容没有丢失。`role=status/alert` 与 `aria-live` 提供无图标语义，颜色仅沿用 Paper/Ink/Signal/Trace。320px 四格折成两列、问题从双列折成单列；桌面恢复四格与字段/原因双列。

## 4. 使用的技术

- Next.js 16.3.0 App Router Route Handler、React 19.2.6、TypeScript 5 与 Node.js 22；
- Zod 4.4.3 内容 schema、既有标签注册表、KaTeX 正文门与 Asia/Shanghai 构建日；
- Decap CMS 3.14.1 `registerPreviewTemplate`、Immutable entry 读取与同源 ESM；
- JSON 字段白名单、128 KiB 双重体积检查、Origin/content-type 校验；
- 320 ms 防抖、AbortController、独立单调 generation 与 same-origin fetch；
- CSS Grid、`minmax(0, 1fr)`、border-box、深色 media query 与语义 live region；
- Node test、TypeScript、Next production HTTP、真实本地生产构建与浏览器控制；
- research-iteration-loop 将范围限制为一个可回滚、只读的作者预检；frontend-design 把界面收敛成发布账本而非通用卡片；浏览器/Playwright 工作流用真实 320px 深色与 1280px 视口复核根宽和布局。

## 5. 实现的功能

- posts 与 projects 获得各自固定集合身份的 preview template，避免依靠不稳定的运行期集合推断；
- 浏览器只序列化集合契约内字段，OAuth token、编辑器状态和未知字段不会进入请求；
- Date 按作者本地日历日转为 `YYYY-MM-DD`，Immutable List/Map 递归转为普通 JSON，空可选字段不冒充正式 frontmatter 值；
- 普通字段变化等待 320 ms 自动复检，正文公式仍使用独立 240 ms 生产渲染预览；
- 文章检查 type/series/canonical，项目检查 status/stack/repository/demo，共享检查其余字段、正文与公式；
- 日期检查 updatedAt/reviewedAt 顺序、未来 reviewedAt 和 Current 180 天复核期限；
- 跨字段检查草稿不能精选、cover/coverAlt 成对、标签数量/重复/注册表、HTTPS URL、稳定 slug 与非空正文；
- 清单显示最终路径、草稿/定时/公开候选、Current/Historical 和字词/阅读时长；
- 旧 timer/请求会被取消，无法取消但晚到的旧 promise 也因 generation 不匹配而失去更新权限；
- 无效条目返回 422 但仍是可恢复作者状态；协议、来源、体积或结构错误返回 400/403/413/415；
- 服务不可用时不清空字段、不替换正文、不阻止继续保存草稿；
- 生产冒烟主动验证预检模块、缓存边界和一份有效文章契约。

## 6. 实现方法

内容 schema 仍只有一份。`inspectContentDraft` 从结构化输入分离 `body`，将其余字段交给现有 `postFrontmatterSchema` 或 `projectFrontmatterSchema.safeParse`，把全部 Zod issue 转成稳定的 `field/message`；随后复用标签 alias map、`getMarkdownMathIssue`、`measureContent` 和 `validateContentFreshness`。只有全部单条字段有效时才返回 `ContentRecord`。文件名/slug 重复、专题跨文章连续性、媒体存在/所有权和正文关系需要仓库全景，因此有意不在该函数中伪造结论。

客户端 allowlist 与 `studio/config.mjs` 的集合字段由测试逐项对齐。序列化函数先把 Decap Immutable 值转为普通数据；Date 使用浏览器本地年月日而非 UTC `toISOString().slice`，防止 UTC+8 午夜前移一天；可选空值被省略，必填空值保留给契约报告。端点再次用 strict schema 防守未知键，客户端最小披露不是唯一安全边界。

条目预检与公式渲染保持两套独立状态和取消器。`componentDidUpdate` 对 allowlisted JSON signature 做比较；变化后先取消 entry timer/controller、增加 generation，再进入 checking。只有组件仍挂载且回包 generation 等于当前值时才能设置 facts/issues/status。这样公式正文可能有两次同源检查，但职责清楚：条目契约给字段结论，公式端点给正式 HTML + MathML，不把一个端点改成难回滚的混合协议。

## 7. 验证证据

- 实现提交 `5e67ef2e6c51c398c679b2aacf2cb320a252ed0b` 已推送 `main`；
- 最终 `npm run release:check` 通过：release 配置完整、Current 1/Historical 3/未公开 0、inbox 0、根暂存 0、外链 2 URL/3 occurrences/0 issue、ESLint 0 warning、144/144 单元、TypeScript、42 条构建页面、19/19 生产应用测试、production audit 0；
- 单元覆盖文章/项目有效条目、多个问题同时返回、未知标签、HTTP URL、草稿+精选、公式错误、Current 过期、未来复核日、allowlist 不发送 `secretToken`、Date/Immutable 归一与 320 ms 请求；
- 状态机通过受控 promise 证明第二次快速输入先完成后，第一次旧 422 不能覆盖 ready；随后模拟断网进入 unavailable 并保留正文；
- 生产 HTTP 验证 `/studio/entry-preflight.mjs` 静态 no-store 资产与 POST 的 200/422/403/413/415、`no-store`/`noindex`、四项 facts 和逐字段 issue；
- 公开客户端产物仍为 1,817,681 B：JavaScript 609,752 B、CSS 88,204 B、最大 JS 228,844 B；作者端新增 entry 模块 5,084 B，组合 preview 模块 13,007 B，preview CSS 6,882 B，均不进入公开阅读客户端预算；
- 真实本地生产 `/studio` 显示固定 Decap 登录页，标题/返回链接正确；本机无已登录 Studio 会话，因此没有声称真实提交编辑表单；
- 真实浏览器 320×800 且系统深色：`--canvas=#101820`，shell/ledger 均 272.67 px，document/body 没有正向溢出，facts 为两列 `136.33px + 136.33px`，issue 为单列 `238.27px`，3 个问题完整存在；
- 真实浏览器 1280×800：ledger 640 px，facts 恢复四列 `160px × 4`，issue 恢复 `129.68px + 463.14px`，根无正向溢出；浏览器 console 0 error；
- 浏览器使用的临时静态夹具在验证后删除，最终构建和提交不包含测试页面。

## 8. 经验与教训

- “复用内容契约”应复用 schema 和基础校验函数，而不是在浏览器复制一组正则；否则 Author Proof 很快会与构建门分叉；
- 单条预检必须准确命名自己的证据范围。把跨仓库关系尚未检查的状态写成“可发布”会制造错误安全感，因此本轮使用 `ENTRY CONTRACT / READY` 并在同一屏说明后续门；
- Decap 的空可选字段、Date 与 Immutable 值不是 YAML 文件最终形态。序列化层必须显式归一，同时测试 allowlist 与 config 字段集合，避免无意上传编辑器内部数据；
- `Date.toISOString()` 是 UTC 事实，不是作者日历日。`picker_utc: false` 的日期 widget 若交付 Date，应使用本地年月日，否则亚洲午夜可能前移一天；
- 防抖、AbortController 和 generation 解决不同问题：防抖减少请求，abort 尽力停止在途工作，generation 才是旧结果永远不能更新 UI 的最终保证；
- 一个 custom preview template 已经占有集合预览入口，新增作者能力应组合进现有模板，而不是注册第二个互相覆盖的模板；
- 预检错误很多时全部铺开会损害正文可达性；显示前八项并保留总数，比折叠所有错误或无限列表更适合新建条目；
- Next production server 不会自动发现构建后新增的 public 测试夹具；真实浏览器验证必须在夹具存在时重建，再在最终门禁前删除并重建；
- PowerShell `git diff --cached --check` 后用分号继续执行不会自动阻止 commit；需要显式检查 `$LASTEXITCODE`。本轮发现 EOF 空白后在推送前 amend，最终实现提交干净。

## 9. 全局状态、风险与未解决问题

博客现在拥有 Git-first 内容、Studio/Obsidian 双入口、内容/媒体/关系/外链/新鲜度门、搜索/Feed/知识地图、Vercel 自动交付与恢复、代码复制、永久链接、脚注、数学公式、打印，以及 Studio 内公式生产预览和全字段发布清单。Author Proof 已能在保存前给出大多数单条 entry 问题，Git、Decap 和 Obsidian 仍共享同一内容事实源。

本轮有意不把预检接入 preSave/prePublish 阻断，也不读取部署仓库伪装成当前 editorial branch；因此跨文章 slug 冲突、专题连续性、媒体存在/所有权、站内目标、重定向和全站构建仍需保存后的 Quality Gate。预检端点是动态 Serverless 调用，128 KiB 以上条目仍可使用 Git/Obsidian，但不提供 Studio 清单。固定 Decap 3.14.1、OAuth scope、CSP inline/eval、Hobby 回滚、外部网络假阴性、知识图扩容、内容复核、自定义域名/统计/评论等既有风险不变。

GitHub Quality Gate 已连续观察到 `actions/checkout@v4` 与 `actions/setup-node@v4` 的 Node 20 action runtime 弃用 warning。它不影响 Node 22 应用或本轮 0 漏洞结论，但 CI 平台会继续演进；应在独立维护轮核对官方迁移说明、升级 action major、保持权限/缓存/Node 版本不变，并验证 push、cron、production smoke 与 rollback 工作流，而不是与作者功能混改。

## 10. 下一轮唯一主任务

完成 GitHub Actions 运行时维护：根据官方文档升级仍使用 Node 20 action runtime 的 `actions/checkout` 与 `actions/setup-node`，消除现有弃用 warning；不改变应用 Node 22、workflow 权限、触发器、缓存键、Vercel 交付或质量命令。验证 push Quality、每周 cron 的可执行结构、deployment_status 生产冒烟和手动 rollback 的 action 解析/权限边界，并记录可回滚版本。
