# Iteration 0111：订阅与开放接口目录

> 实现、生产测量与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

本轮只解决一个发现缺口：RSS、JSON Feed、OpenSearch、公开内容清单/Schema 与单篇 Markdown 已经稳定，但普通读者缺少一个能理解这些能力、选择入口并继续操作的可见页面。新增服务端 `/subscribe`，把既有协议投影成五条只读通道，解释受众、用途、格式、更新策略和真实端点；页脚从直接 RSS 改为“订阅”，再由目录分流到具体接口。

成功标准是：目录由纯函数确定且不改变输入；五条通道顺序、MIME、路径和动作稳定；Markdown 示例从真实公开记录确定性选择；页面无客户端请求、数据库或第二份端点协议；Sitemap、内部链接、真实 SSR、生产 smoke 与 HTML 预算认识该路由；桌面深色、390px 移动视口和打印保持可读；功能部署成功后才测量并冻结真实生产基线。

明确不做：邮件订阅、账号、订阅状态存储、第三方阅读器代理、统计、云配置、端点协议变更和新的内容字段。当前页面只是现有公开读取能力的导航与说明，不承诺写入或通知服务。

## 2. 项目结构状态

- `lib/subscriptions.ts`：新增 `createSubscriptionCatalog(records)`，生成五条只读通道并确定最新 Markdown 示例；
- `app/subscribe/page.tsx`：新增 metadata、canonical、面包屑、五通道 Evidence Rail、只读边界与继续路径；
- `app/globals.css`：新增订阅目录版式、动作区、`55rem`/`42rem` 响应式、深色与打印规则；
- `components/SiteChrome.tsx`：页脚 RSS 直达链接改为“订阅”目录；
- `app/sitemap.ts`：把 `/subscribe` 纳入公开路由；
- `tests/subscriptions.test.mjs`：覆盖顺序、路径、MIME、清单双链接、最新 Markdown 决胜、输入不变与空集合；
- `tests/rendered-html.test.mjs`、`tests/navigation.test.mjs`、`tests/quality-gates.test.mjs`、生产 smoke 与 Sitemap 测试：覆盖真实 SSR、页脚、Sitemap、页面语义、五条通道及只读边界；
- `scripts/html-budget.mjs`：关键 HTML 路由从十条扩展为十一条，并冻结 `/subscribe` 基线；
- `scripts/discovery-budget.mjs`：以同一稳定生产功能提交重新确认七个发现端点，并更新包含订阅 URL 的 Sitemap 字节；
- `package.json`：把订阅目录纯函数测试纳入 `test:unit`；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md` 与本文件：同步架构、视觉、发现、质量、运维、全局状态、经验和下一步。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、删除或暂存这些内容；所有提交都按路径显式选择本轮文件。

## 3. 设计内容

订阅页沿用 Commit Trace / Evidence Rail 语言，把“Markdown/Git 单一事实源”放在上游，把五个公开端口放在下游。它不是营销式订阅表单，也不是 API 控制台：页面首屏先解释公开读取模型，随后每个通道以编号、名称、适用对象、用途、MIME、Freshness 与原生动作链接组成可扫描账本。

信息层级是“事实源 → 五条读取通道 → 只读边界 → Studio/About 下一步”。RSS 与 JSON Feed 面向阅读器；OpenSearch 面向浏览器站内搜索；内容清单和 Schema 作为一组机器契约但保留两个独立链接；Markdown 通道指向按公开记录确定的最新真实 `source.md`。端点数量和链接均来自目录生成结果，不在多个 JSX 分支重复维护。

桌面保持横向标签与动作关系；`≤55rem` 让通道主体和动作区自然重排，`≤42rem` 收敛为单列。390×844 视口下根 `scrollWidth` 与 `clientWidth` 同为 375，没有页面级横向滚动。深色模式复用既有 Token；打印隐藏站点框架和交互性提示，保留接口名称、格式、更新语义、地址与只读边界。

## 4. 使用的技术

- Next.js 16.3 App Router、React 19 Server Component 与静态 metadata；
- TypeScript readonly catalog 类型、稳定数组投影和 `localeCompare` 决胜；
- 原生 HTML 链接、definition-style 元数据、breadcrumb 与 canonical；
- 现有 CSS Token、响应式媒体查询、系统深色偏好与 print media；
- Node.js test runner、TypeScript、ESLint、Next production build 与真实 HTTP 应用测试；
- 站内 Chromium 做桌面深色、390px、语义 DOM、宽度和 console 验收；
- `Buffer.byteLength` 与 Node zlib 对十一路 HTML、七个发现端点做 raw/gzip 确定性预算；
- GitHub Actions Quality Gate、Vercel 原生 Git 部署与稳定域名生产 smoke；
- `research-iteration-loop` skill 约束单一范围、失败优先、部署后测量和全局复盘；`frontend-design` skill 让目录延续本站 Evidence Rail，而不是落入通用卡片或表单模板；`playwright` 与 browser skill 用于真实浏览器和在线工作流证据。

本轮按仓库 `AGENTS.md` 要求，在写代码前阅读了安装版本的 Next.js layouts/pages、linking/navigation、metadata/OG 与 Sitemap 指南，未依赖旧版本记忆推断路由约定。

## 5. 实现的功能

1. 新增公开 `/subscribe` 订阅与开放接口目录；
2. 固定展示 RSS、JSON Feed、OpenSearch、内容清单/Schema 与 Markdown 五条通道；
3. 每条通道显示面向对象、用途、MIME、Freshness 和真实入口；
4. 内容清单通道同时提供 `/content.json` 与 `/content.schema.json`；
5. Markdown 通道从真实公开集合选择最新条目，并显示标题、日期和 `source.md` 链接；
6. 最新条目同日时按中文标题、再按英文 URL 稳定决胜；
7. 空集合仍显示明确的 Markdown 通道不可用说明，而不生成虚假链接；
8. 页面明确声明接口只负责读取，不保存邮箱、账号或订阅状态；
9. 页脚以“订阅”进入目录，不再让普通读者只看到 RSS 缩写；
10. 页面提供 `/subscribe` canonical、可见面包屑与 Studio/About 下一跳；
11. Sitemap 和生产公开路由数从 25 增至 26；
12. `/subscribe` 纳入真实 SSR、导航、生产 smoke 与第十一条 HTML 预算。

## 6. 实现方法

先写 `tests/subscriptions.test.mjs`，用混合 Article/TIL/Project、同日标题/URL、空集合和冻结输入夹具表达目录契约。第一次运行因 `lib/subscriptions.ts` 不存在而以 `ERR_MODULE_NOT_FOUND` 失败，证明测试先于实现；实现后目标测试 9/9 通过。

`createSubscriptionCatalog()` 不读取网络，也不复制端点正文。前四条通道是对既有稳定路径和协议事实的只读描述；第五条先复制公开记录，再按发布日期倒序、`zh-CN` 标题和 `en` URL 决胜，生成最新条目的 `source.md` 地址。返回值同时携带页面需要的标签、描述、MIME、Freshness 与动作，页面只负责语义渲染。

页面保持纯服务端：`getAllContent()` 取得公开记录，目录生成器输出投影，JSX 构成五段 Evidence Rail。页脚、Sitemap、应用测试和生产 smoke 接入后，使用 Chromium 验证实际 DOM、移动宽度与 console。浏览器直接导航本地 JSON Feed 曾被客户端扩展以 `ERR_BLOCKED_BY_CLIENT` 阻止；同一端点随后由真实 HTTP 测试证明 200、正确 MIME 与缓存，因此没有把浏览器扩展噪声误判为站点缺陷。

功能提交部署成功后，才从稳定生产 origin 测量十一路 HTML 与七个发现端点。随后把 `/subscribe` 的 29108/5727 B，以及共享页脚导致的其他页面小幅变化，一起冻结到功能提交 `5ab34a70`；Sitemap 因新增一条 URL 更新为 4882/524 B、26 URLs。基线提交自身不作为测量来源。

## 7. 验证证据

- 失败优先：第一次目标测试以 `ERR_MODULE_NOT_FOUND` 失败；实现后 9/9 通过；
- `npm run typecheck`、`npm run lint` 均通过；
- `npm run build`：51 个构建页面；
- `npm run test:unit`：508/508；
- `npm run test:app`：25/25；
- 浏览器桌面深色：五条通道、端点动作、只读说明与继续路径均为可见语义 DOM；
- 浏览器 390×844：根 `scrollWidth === clientWidth === 375`，导航和单列通道无横向溢出；
- 浏览器 console：0 errors、0 warnings；
- 功能提交：`5ab34a702aec87777f6d33030dc9215a99343190 feat: publish subscription access hub`；
- 基线提交：`8c392412d4f6fbe55e232d7d1cb7e632f7c73335 test(performance): baseline subscription access hub`；
- GitHub：[Quality Gate #211](https://github.com/Zach424/MyBlog/actions/runs/31409262889) 1m12s、[Quality Gate #212](https://github.com/Zach424/MyBlog/actions/runs/31409845698) 1m13s，均成功；
- Vercel：[Verify Vercel production #203](https://github.com/Zach424/MyBlog/actions/runs/31409329481) 49s、[Verify Vercel production #204](https://github.com/Zach424/MyBlog/actions/runs/31409904998) 46s，均成功；
- 稳定生产 smoke：26 routes、OAuth 302；十一路 HTML 与七个发现端点全部 PASS；
- 十一路稳定生产基线（raw/gzip B）：`/` 27419/6016、`/posts` 17972/4265、代表文章 51975/12279、代表项目 108139/24490、`/archive` 20386/4742、`/subscribe` 29108/5727、专题 17621/4184、标签 17442/4154、搜索 36304/13847、知识地图 36018/7262、关于页 15022/3870；
- 七端点基线（raw/gzip B）：清单 3009/921、Schema 3278/755、JSON Feed 20697/9876、RSS 3238/1241、Sitemap 4882/524、robots 155/127、OpenSearch 700/462。

## 8. 经验与教训

1. 已有机器端点不等于读者能发现和理解；可见目录补的是信息架构，不需要复制或重写协议；
2. “订阅”必须明确拆分为阅读器订阅、搜索发现、机器清单和可移植源文，否则读者会自然误解为邮件表单；
3. 清单与 Schema 属于一个用途但两个资源，目录模型应允许一个通道有多个动作，而不是为 UI 人为制造第六条通道；
4. 最新 Markdown 示例必须由同一公开记录确定性派生，手写 slug 会在内容增长后陈旧；
5. 只读边界是产品功能：明确不收集邮箱和状态，能避免未来维护者误接数据库或第三方服务；
6. 页脚一个短链接也会改变所有共享框架页面的 raw 字节，生产基线必须覆盖完整路由集；
7. 浏览器扩展的 `ERR_BLOCKED_BY_CLIENT` 不能替代 HTTP 证据，协议端点应以响应状态、MIME、缓存和正文契约判断；
8. 视觉上使用 Evidence Rail 比通用卡片网格更适合表达“同一事实源、多个读取端口”的关系；
9. 390px 实际 layout viewport 可能因浏览器环境显示为 375 CSS px，验收重点应是 `scrollWidth === clientWidth` 和关键内容可达；
10. 基线必须绑定已部署的功能 SHA，而不是基线提交自身；基线提交即使再次部署并通过冒烟，也只是确认协议未漂移，不能反过来充当测量来源；
11. 并行工作区中的用户文档属于独立资产，持续使用显式路径暂存可避免误提交。

## 9. 全局状态、风险与未解决问题

博客现在具备类型入口、关系入口、文本入口、时间入口和开放接口入口。写作仍由 Studio 或 Obsidian 产生 Git 变更，Vercel 自动交付；订阅目录只投影现有公开协议，不改变发布模型。页面、Feed、机器清单、Sitemap 与源文继续共享 Markdown/Git 单一事实源。

`/subscribe` 不是邮件系统，也不跟踪读者。若未来确实需要邮件订阅，必须先由所有者选择供应商、同意隐私告知、退订机制、数据保留与成本边界。内容增长后 JSON Feed 和公开清单仍可能线性变大，现有七端点预算会先报警；不能因为有了目录就抬高协议预算。

默认 404 虽已正确返回不存在状态和安全缓存，但没有本站的恢复语境。下一步应让错误页提供真实搜索、档案、文章与项目入口，同时保留 404 语义，避免自动重定向或软 404。首次真实 Obsidian 主题/本机代理的人机验收、自定义域名、统计、评论和公开邮箱仍属于所有者选择，不阻塞当前生产。

## 10. 下一轮唯一主任务

新增服务端自定义 `not-found` 恢复页：为未知 URL 提供清晰的 404 说明，以及搜索、时间档案、文章和项目四条真实恢复路径；保持 HTTP 404 与 `no-store`、单一 H1、无客户端请求、深浅色/响应式/打印语义。

接入真实 SSR、随机 404、内部链接与生产 smoke，不创建软 404、自动重定向、数据库、统计、云配置或新的作者字段。
