# 质量标准

## 完整质量门

```bash
npm run check
```

顺序为 ESLint → 126 项内容/维护/inbox/暂存媒体/关系/标题锚点与永久链接/打印版式/知识图/外链库存与检查/搜索/OAuth/Studio/Obsidian/媒体/重定向/代码复制/交付单元测试 → Next 路由类型生成与 TypeScript → 原生 Next.js 生产构建（37 个页面）→ 17 项真实生产 HTTP 与质量审计。任何一步失败都阻止合并和生产部署。

发布候选额外执行：

```bash
npm run release:check
```

它会先输出 Current record 维护状态、当前作者工作区的 inbox 发布就绪状态、根暂存媒体库存和零网络外链库存，再校验 Vercel 冒烟/回滚配置并执行 production-only `npm audit`。不使用会强制改变主版本的 `npm audit fix --force`。

## 内容维护质量门

```bash
npm run content:status
npm run content:status -- --date 2027-01-01 --format json
```

- `healthy`：剩余 61 天以上；
- `review-soon`：剩余 31–60 天，Actions warning；
- `due-soon`：剩余 0–30 天，Actions warning；
- `overdue`：已越过第 180 天，命令返回 1，后续构建也会失败。

Quality Gate 在 PR、`main`、手动触发和每周一 01:00 UTC 自动运行。报告写入 `GITHUB_STEP_SUMMARY`，并把预警绑定到对应 Markdown 源文件。固定 `--date` 用于边界测试，正常维护不应伪造日期。

## 根暂存媒体报告

```bash
npm run media:staging
npm run media:staging -- --date 2026-08-05 --stale-days 30 --format json
```

报告只扫描 `public/uploads` 根文件，并以 Obsidian 发布器的同一解析规则读取 inbox 草稿中的 Wiki 图片、Markdown 图片和 cover。测试锁定单草稿引用、多草稿共享、未引用、缺失引用、代码示例忽略、无效草稿、Git/文件系统双年龄证据、固定 JSON、GitHub summary/annotation 和零删除行为。默认 30 天标为陈旧；warning 不阻断质量门，扫描错误才返回非零。Quality Gate 在内容维护报告之后运行它，因此每次 push/PR 和每周任务都有同一库存证据。

## Inbox 发布就绪报告

```bash
npm run content:inbox
npm run content:inbox -- --date 2026-08-05 --format json
```

测试覆盖 ready/scheduled 日期边界、文章/项目推断、真实 PNG→WebP 候选、无效草稿隔离、正式目标冲突、缺失/已跟踪/共享附件、结构化阻塞原因、空 inbox、无效日期、真实 CLI JSON，以及运行前后草稿/附件逐字节不变且没有正式目标或归档目录产生。Obsidian 插件契约还锁定桌面专用、参数数组、`shell: false`、纯文本 Modal 和版本 1.1.0。blocked 是作者诊断而非仓库失败；扫描或媒体处理基础设施错误才返回非零。该报告进入本地 `release:check`，不进入 Actions，因为 CI 无法看到作者未跟踪草稿。

## 外部 HTTPS 链接报告

```bash
npm run links:external
npm run links:external -- --format json
npm run links:external -- --check --timeout-ms 5000 --concurrency 4 --retries 1
```

默认命令从公开正文 GFM AST 与 canonical/repository/demo 生成统一确定性库存，不访问网络；每个 occurrence 标明 body 或具体 frontmatter 字段，相同规范 URL 跨来源聚合。它进入本地 `release:check` 但发现 issue 仍只报告。显式 `--check` 才按唯一 URL 发送 HEAD，支持 `--fail-on-broken` 作者硬判定。测试覆盖结构化字段、`demo: null`、跨正文聚合、行内/引用式/GFM 裸链接、重复与确定排序、图片/代码/站内忽略、HTTP/协议相对/无效/凭据隐藏、IPv4/IPv6 私网和保留地址、混合 DNS fail-closed、HTTPS/443/凭据边界、重定向/降级/跳数、401/403/404/405/5xx、超时、网络错误、重试、资源参数和真实零写入 CLI。

检查器在每个 URL 和重定向目标请求前解析全部 DNS；任一非公网结果即拒绝，并把实际 TLS 连接固定到已验证地址。响应头到达后立即关闭，不读取或保存第三方正文。`restricted`、`method-unsupported`、5xx、timeout 和 network-error 是暂不可确认，不冒充链接失效；broken 只包含确定缺失/客户端错误、不安全或坏重定向。本轮不把实时检查接入 Actions：CI 网络、限流和 DNS 路径不是内容正确性的稳定事实，后续只有积累足够误报数据后再评估定期软报告。

## 生产冒烟

```bash
npm run production:smoke -- https://example.vercel.app --expect-oauth
```

检查代表内容、搜索、Studio HTML/配置/媒体清单/媒体预检/稳定 slug 控件/预览/同源 CMS 运行时、OAuth、RSS、robots、全 Sitemap、永久重定向、安全头、缓存与随机 404。媒体清单必须是 `version: 1`、根为 `public/uploads`，每项包含安全路径、正整数节数与 64 位 SHA-256，并保持 `no-store`。永久重定向检查要求 `/blog` 返回 308、同源 `Location` 直达 `/posts`，且目标只需一次请求即返回 200。`--expect-oauth` 只用于已配置 GitHub OAuth 的生产环境；本地和 Preview 允许 OAuth 以 503 安全关闭。

## 永久重定向质量门

构建从 `content/redirects.yml` 读取严格 YAML 与 Zod schema，未知字段、重复键、弱原因、未来加入日期都会失败。测试还覆盖路径编码/大小写/尾斜杠、当前路由或静态文件遮蔽、受保护命名空间、缺失/草稿/未来目标、重复、自跳转、链与环路。真实 Next 进程验证 308 和查询参数透传，生产冒烟验证同源单跳目标，防止只在纯函数层面正确而部署行为漂移。

## 内容质量

- frontmatter 必须通过严格 Zod schema，未知字段报错；
- 文件名/slug 为稳定小写 ASCII，不能与 URL 漂移；
- 标签来自注册表，专题顺序连续；
- 草稿和未来内容不会进入任何公开索引；
- 内容可见日期在 `Asia/Shanghai` 构建期冻结；
- 所有内容声明 Current/Historical 语境与复核日期；Current record 超过 180 天未复核时构建失败；
- 复核日期不早于发布/更新日期，公开内容不能使用未来复核日期；
- Markdown 标题锚点、目录、GFM 和代码高亮保持一致；H1–H6 共用全局 GitHubSlugger 序号；
- 公开站内页面链接必须存在；带 fragment 的行内、引用式、跨内容或自引用链接必须严格命中目标实际 heading id，无效百分号编码、拼写和重复标题序号会失败；

## HTML 与可访问性

- 每页一个 `<main>` 和 `<h1>`，`lang=zh-CN`；
- 页面具有 description、canonical、跳转主内容链接和唯一 id；
- 所有可见内部导航目标返回成功；
- 有站内关系的文章/项目必须服务端渲染语义独立的 outgoing/backlinks 分组；两侧都为空时不渲染空账本；
- `/knowledge` 必须从同一关系值服务端输出 SVG 节点/有向边、HTML 关系账本和孤立记录；节点为原生链接，不用 Canvas 或客户端脚本承担唯一语义；
- 文本设计 Token 达到 WCAG AA；
- 320px 不允许根布局强制最小宽度或横向溢出；知识地图在该宽度隐藏宽 SVG、显示完整关系账本；
- 焦点可见、Reduced Motion 和系统深色偏好保留。
- 本地 Markdown 正文图必须服务端输出 alt、真实宽高、正文栏 `sizes` 和 `srcSet`；Markdown 组件不能把 AST `node` 泄漏成 HTML 属性。
- Markdown H2/H3 必须服务端输出复用真实 id 的原生永久链接；中文与编码 fragment 命中同一 `:target`，H4 和页面结构标题不得获得控件；桌面 hover/focus/target、320px 与宽屏 `hover:none` 触控、无 JavaScript 和打印均需保持明确边界。
- 文章与项目详情必须服务端输出可信 canonical 打印来源；A4 print media 隐藏站点框架、目录、邻接和交互控件，保留标题、五列事实、正文、媒体、代码、表格和必要引用。测试锁定分页、代码换行、纸面 URL 与关系账本边界；发布候选还必须在真实 Chromium 中生成 PDF、渲染全部页面并目视复核，不以 DOM/CSS 断言代替纸面结果。

## 体积预算

| 资产 | 预算 |
| --- | --- |
| `.next/static` 客户端总量 | `< 3 MB` |
| 最大客户端 JavaScript | `< 300 KB` |
| 全局 CSS | `< 100 KB` |
| 单页服务端 HTML | `< 100 KB` |

预算用于捕获意外回归，不代替真实网络与 Web Vitals。生产上线后应以 Vercel Analytics/日志或独立测量补充。

## 媒体预算

| 媒体属性 | 预算 |
| --- | --- |
| 实际格式 | PNG/JPEG/WebP/GIF/AVIF，且与扩展名一致 |
| 单文件 | `≤ 3 MiB` |
| 单帧宽、高 | 各 `≤ 2560 px` |
| 单帧像素 | `≤ 8,000,000` |
| 动图总像素 | `≤ 80,000,000` |

Obsidian 检查、正式发布和 Next 配置加载复用 `lib/media-policy.ts`；Studio 的独立浏览器模块用回归测试锁定同一扩展名与公开预算，并覆盖真实格式识别、浏览器解码、扩展名伪装、损坏文件、静态格式、GIF/WebP 帧计数、动画总像素、动画 AVIF fail-closed、事件拦截/重放和安装幂等清理。媒体冲突测试还锁定已发布 Decap bundle 的文件名转换调用，覆盖构建清单确定排序与真实仓库摘要、new/same/replace-confirmed、same-session/replace-session-confirmed、只检查不登记、成功重放后提交、取消后保留旧基线、确认后更新、重放异常不提交、空 slug、清单 HTTP 故障和全局媒体库降级。竞态测试用 deferred promise 覆盖旧成功晚到、旧失败晚到、manifest 后过期、确认期间变旧和正常最新选择，断言旧代次不确认、不报告最终状态、不重放、不提交，也不清空当前 input。Obsidian 静态 PNG/JPEG/WebP 可先进入 25 MiB、8192 px、4000 万像素的原图安全包络，再自动校正方向、缩放并以固定参数生成 WebP；产物必须重新通过上表。Studio 不重编码，通过后向 Decap 透传原始 `File`。GIF、AVIF、动画 WebP 与已经更高效的 WebP 保持原字节。构建递归检查 `public/uploads`，符号链接、普通非图片、损坏文件和伪装扩展名均失败。测试还覆盖确定性字节、格式碰撞、真实 CLI 预览/发布和多附件逐字节回滚；响应式候选由 Next.js 在请求时派生，不作为新的 Git 资产保存。

`lib/content/media-references.ts` 使用标准 Markdown AST 抽取行内/引用式图片并忽略代码，`build/validate-media-references.ts` 在每次 Next 配置加载时交叉检查正式 posts/projects 与精确媒体文件清单。测试覆盖安全 URL、缺失/大小写错误、根暂存引用拒绝、跨 slug 所有权、代码伪引用、归档孤儿、cover 和 draft/future 所有权；没有被正式内容引用的根目录 inbox 暂存文件仍获豁免。正文图片 alt 为空时在对应行失败；本地 URL 去重后读取固有尺寸，生产 HTML 证明 `sizes`/`srcSet`/宽高同时存在。外部 HTTPS 图片不占用本地所有权，使用受 CSP 允许但不经 Next 优化器的明确降级；其他协议或相对图片路径失败。

Studio slug 测试覆盖新建、复制、已有条目、缺省兼容、Windows/Unix path 身份回退、字段漂移、readOnly/ARIA/可复制语义、编辑事件、默认预览、注册幂等和浏览器 DOM 标记；同时直接解析实际发布的固定版本 `decap-cms.js.map` 中 `Widget.js` 与 `entryDraft.js`，证明 control 仍收到 entry，且三种 draft 创建路径维持预期 `newRecord` 状态。若 Decap 升级改变任一内部契约，质量门必须先失败，不能让控件静默解锁或误锁复制条目。

## 安全基线

全站必须有 CSP、HSTS、`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、Referrer Policy、Permissions Policy 和 COOP，并且不能暴露 `X-Powered-By`。

Studio 与 OAuth 必须：

- Studio HTML/配置/预览和 OAuth 的 `Cache-Control` 包含 `no-store`；版本化 CMS 运行时使用不可变缓存；
- `X-Robots-Tag: noindex, nofollow`；
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`；
- CSP 不允许第三方脚本源，只额外允许 GitHub API/授权/头像；
- 未配置 secret 返回 503，非法 provider/site/state 返回 4xx；
- OAuth state HMAC 签名、绑定 origin、十分钟失效。

当前 Next.js 流式启动脚本和现有样式需要 `script-src/style-src 'unsafe-inline'`；Studio 的固定 Decap 运行时还需要隔离的 `script-src 'unsafe-eval'`。这些是已知残余风险，框架和编辑器支持稳定 nonce/无 eval 方案后继续收紧。

## 发布门槛

只有以下证据同时成立才可切换生产入口：本地 `release:check` 通过、GitHub Quality Gate 通过、Vercel Production 成功、带 OAuth 的全路由冒烟通过、未登录真实浏览器通过、Studio 和 Obsidian 各完成一次真实发布。
