# Iteration 0041：Studio 媒体最新选择边界

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex 即可从 Studio 或 Obsidian 产生可审计 Git 内容，浏览器预检不能让异步先后改变作者最后一次明确选择。Iteration 0040 已建立生产/会话双层媒体基线，但同一 file input 快速连续 change 时，旧文件的解码、manifest 或确认可能晚于新文件结束；如果仍产生副作用，就可能重放未经最新流程确认的文件、覆盖提示或清空当前 input。

本轮只实现 per-input latest-wins：每个真实 change 获得单调 token，任何异步边界后的旧代次都必须静默失效。旧成功不能 report/dispatch/commit，旧失败不能清空 input 或报告 error，manifest 后过期不能弹替换确认，确认等待期间变旧不能修改会话基线。不得二次读取文件、伪装底层 Promise 已取消、引入持久化/外部 API、修改 Decap、Obsidian 或构建权威。

## 2. 项目结构状态

- `studio/media-preflight.mjs`：新增 stale 判别结果、checker `isCurrent` 边界、handler `selectionGenerations` WeakMap、File 身份核对和旧结果副作用隔离；
- `tests/studio-media-preflight.test.mjs`：新增 deferred promise 工具，覆盖 manifest 后过期、确认期间变旧、旧成功晚到、旧失败晚到和最新选择正常提交；
- 架构、发布、质量、状态、路线图与本文件：同步 latest-wins 设计、作者语义、验证、经验和下一读者体验主线；
- 内容、公开页面、媒体清单 schema、Studio 配置/样式、Obsidian、Actions 与 Vercel 配置均未修改。

## 3. 设计内容

latest-wins 的核心不是取消工作，而是撤销旧工作的副作用资格。浏览器图片解码、SHA-256 和共享 manifest fetch 不一定能安全、真实地中断；即使它们继续完成，只要每次续体先证明自己仍是当前 generation，就不会影响作者最后选择。UI 因此只显示两个真实 change 的 checking 过程和最新一个最终 success/error，旧完成不会闪回旧文件名或错误。

generation 以 input 为边界，而不是全页面：封面与正文不同 file input 互不取消。真实 change 即使没有文件也递增，可让在途选择失效；合成 change 必须先由 approved `File` WeakSet 识别并直接返回，不能误增 generation 把自己的外层事务标成 stale。token 之外再核对 `input.files[0]` 与原始 File 身份，覆盖 input 内容被其他代码改变但未按预期触发新流程的情况。

## 4. 使用的技术

- `WeakMap<HTMLInputElement, number>`：按 input 保存单调 generation，不阻止 DOM/输入被垃圾回收；
- `isCurrent()` 闭包：同时核对 generation 与当前 File 身份；
- 冻结的 `{ state: "stale" }` 判别结果：checker 把过期作为控制流而非错误；
- async/await continuation gate：图片检查后、manifest 后、替换确认后和 handler conflict 后复核；
- WeakSet 合成重放保护：synthetic change 不生成新 token；
- deferred Promise 单测：显式控制两个选择、manifest 与确认的完成顺序；
- ESLint、TypeScript、Node test、Next production build、真实 HTTP、生产冒烟、GitHub Actions 与 Vercel；
- research-iteration-loop skill 约束本轮只处理媒体时序，并在全局复盘中比较代码复制、JSON Feed 与年度归档。

## 5. 实现的功能

- 每个 Studio image input 的真实 change 在读取异步结果前同步递增 generation；
- 新 change 到达后，旧图片即使随后检查成功也不会进入 conflict checker、不会重放或提交账本；
- 旧图片检查失败晚到时静默返回，不清空新 input、不追加 error report；
- manifest Promise 返回后若已过期，checker 直接 stale，不打开旧路径替换确认；
- confirm Promise 等待期间变旧，确认结果不再转成取消错误或批准结果，也不更新 session baseline；
- 最新事件仍完整显示 checking/success，执行目标冲突检查、合成 change 与一次 commit；
- 空文件 change 可以使在途事务过期，但不产生无文件错误；
- 合成 replay 继续由 approvedFiles 捕获，不递增 generation，不形成循环；
- stale 是内存控制状态，不进入 UI、网络、存储或 Git。

## 6. 实现方法

handler 先确认目标是图片 file input，再读取当前 File。若 File 已在 approvedFiles 中，这是当前外层发出的合成 replay：删除 WeakSet 标记并直接放行。其他 change 立即把 `selectionGenerations[input]` 加一；没有 File 时结束，有 File 时捕获 generation，并构造同时检查 token 和 `input.files[0]` 的 `isCurrent`。

`inspect(file)` 返回后先检查 current，旧选择不会进入冲突层。checker 接收可选 `{ isCurrent }`：入口、session replace confirm 前后、manifest await 后和 published replace confirm 前后均复核，过期返回共享 stale 对象。handler 在 checker 返回后再次复核，stale 不 report success。dispatch 后只有 current 才 commit；异常进入 catch 时也先检查 current，旧错误直接结束，只有最新错误可以清空 input 并报告。这样每个副作用都由最近 token 授权，而底层异步资源不需要虚假的 AbortController 包装。

## 7. 验证证据

- Studio 媒体专项 14/14 通过；无失败后修补，第一版 token/checker 边界即覆盖目标交错；
- manifest deferred：旧检查在清单返回前失效，结果为 stale，替换确认调用次数为 0；
- confirm deferred：会话替换确认打开后变旧，最终 stale；随后原文件仍为 same-session，证明基线未改；
- 双 change 旧成功晚到：只有 latest 进入 conflict、report success、dispatch 和 commit，旧 run 返回 false，input 保留 latest；
- 双 change 旧失败晚到：最新 run 成功后旧 decode reject，报告序列没有 error，input.value 仍为 latest；
- 完整 `npm run release:check`：配置完整，Current 1/Historical 3/未公开 0，inbox 0，根暂存媒体 0，外链 2 URL/3 occurrences/0 issue；
- 同一候选通过 ESLint、120/120 单元测试、TypeScript、37/37 构建页面、17/17 真实生产 HTTP/质量测试，production-only audit 0，`git diff --check` 通过；
- 独立本地 production build 冒烟：`24 routes, OAuth 503`，本机 OAuth 安全关闭；
- 实现提交 `6099ed88374cf4eb8a0ab1838338775b7a95ae6d` 已推送 `main`；GitHub Quality Gate `30953664588` completed/success；
- GitHub Production deployment `5752066151` state=success（`https://blog-k9k2q5jmi-czq1.vercel.app`）；`Verify Vercel production` `30953702030` 精确绑定实现 SHA 且 completed/success；
- 稳定生产域名独立冒烟：`24 routes, OAuth 302`；代理只在网络命令进程内设置，未写入仓库或永久配置。

## 8. 经验与教训

- 异步竞态的正确语义通常是撤销旧结果的写权限，不是假装底层工作已经取消；
- generation 必须在第一个 await 前同步登记，否则两个 change 仍可能共享错误的“当前”身份；
- token 要按 input 隔离；页面级 token 会让封面选择错误取消正文图片，扩大无关影响面；
- 合成事件是同一事务的一部分，必须在 generation 递增前识别，否则外层会被自己的 replay 宣告过期；
- stale 不是 error。把它抛进普通错误路径会清空作者的新文件或制造误导告警；判别返回值更适合静默控制流；
- 只在 inspect 后检查不够：共享 manifest 和异步 confirm 也是可交错边界，checker 必须获得 current predicate；
- deferred Promise 比时间延迟更可靠，可以精确证明哪一轮先后完成而不让测试依赖机器速度；
- 全局复盘中，JSON Feed 与年度归档分别被已有 RSS 和当前 4 条内容规模削弱；技术代码块复制是更高频、无需服务的直接读者价值。

## 9. 全局状态、风险与未解决问题

Studio 媒体链路现在覆盖真实格式/预算、稳定 slug、生产摘要、页面会话摘要、危险替换和快速重选竞态；Obsidian 继续承担自动 WebP 优化，构建继续是所有 Git 入口的最终权威。公开阅读、知识图、搜索、外链维护、自动交付与恢复保持通过。

下一直接产品缺口转到读者侧：fenced code block 已有 rehype-highlight 和横向滚动，但长命令/代码没有一键复制、语言标签或屏幕阅读器状态反馈。后续实现必须避免把按钮加入 inline code、避免 client component 改写高亮 textContent、避免无 JS 时出现不可用控件，并守住客户端 JS 预算。其他既有风险包括 Studio 不自动优化、固定 Decap bundle/开发依赖审计、OAuth scope、CSP 例外、Hobby 回滚、知识图扩容、自定义域名、统计、评论与外部提醒。

## 10. 下一轮唯一主任务

为 Markdown fenced code block 增加可访问的一键复制控件。建立最小 client component 包装现有 `<pre><code>`：服务端代码完整可读，按钮 SSR hidden、hydration 后显示；从 code DOM 的 textContent 复制精确文本，显示语言标签、COPY/COPIED/FAILED 状态与中文 `aria-live`，定时复位并清理 timer。inline code 不受影响，rehype-highlight span 和换行必须保留，不增加第三方依赖或追踪。用组件纯函数/源码契约、生产 HTML、真实浏览器键盘与 clipboard 行为、reduced motion/320px 和构建客户端体积证明完成。
