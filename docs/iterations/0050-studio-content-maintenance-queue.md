# Iteration 0050：Studio 全库只读内容复核队列

## 1. 范围与成功标准

本轮只解决一个作者体验空白：Current 内容已经有 CLI、Actions 摘要和 180 天构建门，但作者进入网页 Studio 后看不到全库复核优先级。目标是在不增加数据库、外部 API、云配置或消息渠道的前提下，提供 public-only、同源、只读的维护队列；它必须复用既有 healthy / review-soon / due-soon / overdue 规则，显示 review-by、剩余天数、稳定编辑入口和公开证据，同时明确不改 `reviewedAt`、不创建提交、不替代完整构建。

成功标准包括：公开内容集合与部署一致但报告日能随 `Asia/Shanghai` 自然日推进；响应不泄露正文、源路径、草稿、未来记录或 Historical 快照；浏览器对响应契约失败关闭并可重试；1280px 深色、320px 单栏、键盘焦点、Studio 固定入口、生产 HTTP 与稳定域名 smoke 全部通过。实现回滚边界是提交 `5dd380a7d7551bff2f6952520092e5ab64678f2b`，普通 `git revert` 可以完整移除新增路由、资源、适配层和 Studio 入口，不影响现有 CLI/Actions 维护报告或内容数据。

## 2. 项目结构状态

- `lib/studio-maintenance.ts`：把正式维护报告映射为版本 1 的最小作者快照，生成稳定 Studio/公开 URL；
- `app/studio/maintenance.json/route.ts`：Node.js 动态同源端点，按请求日生成队列并返回 `no-store` / `noindex`；
- `app/studio/maintenance{,.mjs,.css}/route.ts`：通过既有 Studio 资源读取器显式提供页面、模块和样式；
- `studio/maintenance.html`：语义化 Review Horizon、计数账本、队列、复核协议、跳转链接与恢复按钮；
- `studio/maintenance.mjs`：版本/计数/日期/状态/URL 严格验证、DOM 安全渲染、empty/error/retry 与 latest-wins 请求；
- `studio/maintenance.css`：Paper / Ink / Trace / Signal 浅深色系统、桌面双栏、42rem 单栏、焦点与无动画规则；
- `studio/index.html`：在 Decap `#nc-root` 外增加固定复核入口，窄屏只显示“复核队列”以避开登录品牌区；
- `lib/studio-assets.ts`：扩展允许的构建期 Studio 资源类型；
- `tests/studio-maintenance.test.mjs`：最小快照、严格客户端、状态恢复、语义/响应式/注入边界；
- `tests/quality-gates.test.mjs`、`scripts/smoke-production.mjs`、`tests/deployment-tools.test.mjs`：维护页、模块、样式和 JSON 纳入生产 HTTP 与线上 smoke；
- `README.md`、架构/设计/发布/运维/路线图、`content/projects/myblog.md` 与本迭代档案：同步入口、技术、设计、边界、证据和下一任务。

## 3. 设计内容

页面没有采用常见后台的圆角指标卡。核心视觉是 `Review Horizon`：以真实 180 / 60 / 30 / 0 天边界绘制一条时间标尺，四格 ledger 只显示四级真实计数，右侧审计行按紧急度列出内容身份、最近复核、最后有效日和两个可验证去向。视觉继续使用冷调纸面、压缩标题字、等宽元数据、直角 Trace 规则与 Signal 状态边，不显示虚构完成率，也不用图标或动画代替文字状态。

桌面版使用 14rem / 自适应双栏，复核协议横跨队列列；`≤ 42rem` 后整体折为单栏，长标题、计数和操作自然换行。系统深色只替换既有 token。跳到正文、导航、编辑/公开链接和重试按钮都有可见焦点。首次实机截图发现 1280px 大标题把“断，”孤立成一行，随后把两句改成明确展示行并调低桌面字号；320px Studio 登录画面又发现双行固定入口压到 Decap 标识，随后在窄屏隐藏英文副标，只保留短标签。

## 4. 使用的技术

- Next.js 16.3 App Router Route Handlers、Node.js runtime 与显式 static/dynamic 路由；
- TypeScript、既有 `ContentRecord` / `createContentMaintenanceReport` 与 `resolveContentBuildDate`；
- 原生 HTML、CSS custom properties、CSS Grid、`prefers-color-scheme` 与 `:focus-visible`；
- 原生浏览器 `fetch`、`AbortController`、单调 generation、`textContent` / `createElement` / `replaceChildren`；
- Node.js `node:test`、TypeScript、ESLint、Next production server、线上 smoke 与真实 Chromium；
- research-iteration-loop 用单一纵切约束范围；frontend-design 把时间边界变成界面结构并驱动两次视觉修正；browser 技能用于应用内 Chromium 的响应式、暗色、焦点、控制台与重叠检查。

## 5. 实现的功能

- Studio 左下角始终提供 `Content review / 复核队列`，不依赖 Decap 内部侧栏 DOM；
- `/studio/maintenance` 集中显示 Current 与 Historical 总数、四级 Current 计数、报告日期和 180 天标尺；
- 队列按正式维护报告的紧急度排序，逐条显示内容类型/slug、标题、最近复核、最后有效日和剩余天数；
- 每条记录提供精确的 Decap collection/entry 链接和当前公开页面链接；
- 空集合给出明确 empty 状态，网络/结构异常给出可恢复 error 状态和 Retry；
- 同一页面快速重试只允许最新请求更新 DOM，旧响应会被取消或按 generation 丢弃；
- JSON 只包含公开 Current 最小元数据、四级计数、Historical 数量、阈值和复核清单；
- 页面、模块、样式和 JSON 均 no-store/noindex，并被本地应用测试和线上 smoke 覆盖；
- 维护页无需登录也能读取，因为它只重组已经公开的标题/URL/日期元数据，不暴露授权能力或未公开内容。

## 6. 实现方法

先复核 Decap 3.14.1 本地源码。它支持 widget/preview 等注册表，但没有稳定的自定义顶级页面 API；启动时只向 body 追加 `#nc-root`。因此没有依赖内部侧栏选择器或 monkey patch 路由，而是在 `#nc-root` 外保留一个稳定原生链接，维护队列本身使用独立页面。Next 16 本地文档确认子 Route Handler 合法、GET 默认不缓存；项目也未开启 `cacheComponents`，于是 HTML/CSS/MJS 使用显式静态路由，JSON 使用 `force-dynamic` 并继续写明 `no-store`。

服务端先调用既有维护报告，保证 180 / 60 / 30 / 0 边界只有一个权威实现，再做不可逆字段缩减。公开集合来自 `getAllContent()` 和部署期冻结日期，所以草稿与未来内容不会因 Serverless 启动时间进入响应；快照的 `reportDate` 则在每次请求按作者时区计算，同一部署可以自然变老。客户端把所有输入视为不可信：版本、ISO 日期、阈值、总数、逐级计数、kind/status/slug 和两种 URL 必须彼此一致，否则不渲染记录。

客户端渲染不用 `innerHTML`，所有作者文本只进入 `textContent`。请求显式 `cache: no-store` 与 `credentials: same-origin`，retry 会 abort 前一请求并递增 generation。测试先落地并按预期因缺少 `lib/studio-maintenance.ts` 失败，再完成服务端与浏览器两层实现；针对原 CSS 测试把允许的子元素 `min-width: 0` 误判为根宽规则的问题，测试收窄为只拒绝 html/body 根最小宽度。

## 7. 验证证据

- 失败优先：新增维护测试最初因 `lib/studio-maintenance.ts` 不存在而失败；实现后定向 4/4，再与内容维护、部署工具和 Studio 配置合并为 14/14；
- `npm run release:check` 最终通过：Current 1 / Historical 3 / 未公开 0、inbox 0、根暂存 0、外链 2 URL / 3 occurrences / 0 issue、ESLint、152/152 单元、TypeScript、45 个页面生成任务、19/19 生产应用测试、production audit 0；
- 生产 HTTP 测试确认维护 HTML/MJS/CSS/JSON 均 200、no-store/noindex，快照 version 1、Current 1、Historical 3、`myblog` 编辑/公开 URL 正确，且不存在 `body` 或 `sourcePath`；
- 真实 Chromium 1280×800 系统深色：主体为 224px / 880px 双栏，根 `clientWidth = scrollWidth = 1265`，队列 1 条，背景/前景为深色 token；修正后标题两句分别占一行；
- 真实 Chromium 320×800 系统深色：主体单栏，记录宽约 281px，根 `clientWidth = scrollWidth`，所有五个导航/条目链接可见，skip link 焦点为 3px Signal outline；
- Studio 320px：维护入口唯一、fixed、根宽无溢出；窄屏修正后链接约 74×35px，英文副标隐藏，与 Decap Logo 几何不相交；维护页与 Studio 控制台 warning/error 均为 0；
- 公开 `.next/static` 为 1,818,133 B；独立维护 HTML/CSS/MJS 合计 23,138 B，没有把作者功能并入公开阅读客户端；
- 实现提交 `5dd380a7d7551bff2f6952520092e5ab64678f2b` 已推送 `main`；Quality Gate `30980923777`（#84）和 Vercel Production 验证 `30980962760`（#77）均 completed/success；
- 上线后本地运行 `npm run production:smoke -- https://blog-iota-five-59.vercel.app --expect-oauth`，通过 24 条 Sitemap 路由、新维护资源/快照和 OAuth 302。
- 归档提交 `71acaa1ef1150a56fdcc5b16586ad6f9a0c71143` 已推送；Quality Gate `30981378943`（#85）与 Vercel Production 验证 `30981408665`（#78）均 completed/success，证明状态页与 Obsidian 轮次档案进入 `main` 后仍保持完整交付链路。

## 8. 经验与教训

- 作者后台扩展首先要确认编辑器是否公开稳定 API。没有时，独立页面和原生入口比依赖内部类名/DOM 顺序更可维护；
- “部署内容确定”与“时间继续前进”不是冲突：冻结公开集合、动态计算报告日，能同时避免未来内容漂移和过期队列停摆；
- 未登录可读不等于泄露。本轮端点只重组原本公开的标题、URL 和日期，但这种边界必须由服务端字段缩减和测试证明，不能依赖客户端隐藏；
- 网络边界需要校验数据内部一致性，而不只是 TypeScript interface。版本、计数、状态和 URL 交叉验证能阻止部分或混合部署数据生成错误导航；
- 真实截图能发现静态测试看不到的排版孤行和第三方界面重叠；修复也应保留品牌结构，而不是缩成通用卡片；
- `clientWidth === scrollWidth` 只能证明页面级无横滚，仍应检查关键元素自己的 `scrollWidth` 和几何相交；
- 可恢复状态不意味着弱化最终门：Studio 页面失败时可重试/回退 CLI，但 overdue 仍由正式构建拒绝；
- 本轮浏览器后端能把 skip link聚焦并证明焦点样式，但合成 Enter 未触发 fragment 导航；因此证据只声明焦点可见与原生 href 存在，不夸大为完整键盘导航事件回放。

## 9. 全局状态、风险与未解决问题

博客现在具备 Git-first 内容、Studio/Obsidian 双发布入口、公开阅读/搜索/Feed/知识地图、内容与媒体契约、引用/锚点/永久重定向、新鲜度和外链库存、Vercel 自动交付/冒烟/回滚，以及 Studio 媒体、slug、公式、条目与全库维护四类 Author Proof。当前生产链路不依赖 Cloudflare、数据库或 Codex。

维护页有意公开最小元数据并使用 noindex，不是权限边界；未来若加入草稿、内部备注或一键写操作，必须先进入已认证服务端授权设计，不能沿用当前 public-only 端点。编辑内容后队列只有在新 Production 上线时才更新，报告日期则不需重新部署。外部消息仍未接入，网络故障时由 Retry、本地 CLI 和每周 Actions 提供分层恢复。Decap 3.14.1 固定运行时、OAuth scope/CSP 例外、开发依赖审计、Hobby 回滚范围、附件 Git 历史、知识图扩容以及尚未选择的域名/统计/评论仍是既有风险。

Studio 已补齐当前公开内容队列，但 Obsidian 作者仍需打开终端运行 `npm run content:status`；现有插件已经有 inbox readiness 的只读进程与 Modal 模式，因此下一处最小高价值空白是把正式维护报告以同样方式带进 Obsidian，不需要新服务或云配置。

## 10. 下一轮唯一主任务

把 Current 内容维护报告接入仓库内 Obsidian 发布插件：新增“查看已发布内容复核队列”的只读命令和 Modal，复用现有报告 CLI 或结构化输出，展示 healthy / review-soon / due-soon / overdue、review-by、剩余天数和稳定笔记路径。保持零网络、零内容写入、零日期自动修改、零外部提醒；验证空队列、四级日期边界、子进程失败、Windows 隐藏执行、插件卸载清理和现有发布/inbox 命令无回归。
