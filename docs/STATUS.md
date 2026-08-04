# 当前项目状态

> 更新时间：2026-08-05 · 每轮迭代更新 · 本文件位于仓库根 Obsidian Vault 中

## 产品目标

MyBlog 是 Zach424 的个人技术知识库与公开工程日志。它把学习记录、技术判断和项目复盘保存为可检索、可链接、可版本控制的 Markdown；作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，`main` 自动交付到 Vercel。

## 当前结构

| 模块 | 状态 | 当前责任与证据 |
| --- | --- | --- |
| 内容契约 | done | YAML + Zod 校验文章、TIL、项目、标签、专题、日期、URL、内容语境、复核日期与本地封面替代文本 |
| 公开阅读 | done | 首页、文章、项目、专题、标签、搜索、关于、响应式、深色模式与详情页封面 |
| Markdown | done | GFM、代码高亮、与实际渲染一致的 H1–H6 heading id、H2/H3 目录、阅读时间、相邻文章与响应式正文图片 |
| 内容发现 | done | SEO、内容级 OG/Twitter 封面、JSON-LD、RSS、Sitemap、robots、本地全文搜索 |
| 网页写作 | done | `/studio`、GitHub OAuth、Decap editorial workflow、PR、按 slug 归档媒体、稳定 slug 锁定、生产/会话双层 SHA-256 冲突预检 |
| Obsidian 写作 | done | Vault、模板、桌面发布插件、带目标标题校验的 `--check-only`、`--push` |
| Inbox 发布就绪 | done | 全草稿 ready/scheduled/blocked、真实媒体候选、目标/共享附件诊断、CLI 与 Obsidian 只读弹窗 |
| 附件发布 | done | Wiki/Markdown 图片转换、按内容隔离、稳定命名、越界保护、失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟 |
| 恢复能力 | done | Vercel 显式目标回滚、当前版本恢复、再次冒烟 |
| 内容知识网络 | done | GFM 行内/引用式/自引用链接、页面与标题锚点构建门、文章与项目双向引用账本 |
| 公开知识地图 | done | `/knowledge` 服务端 SVG 信号场、HTML 关系账本、孤立记录、主导航与 Sitemap，Markdown 链接为唯一事实源 |
| 永久链接迁移 | done | Git 版本化 redirect 注册表、当前路由/静态文件冲突门、公开目标校验、单跳 308 与生产冒烟 |
| 内容新鲜度 | done | Current/Historical 可见语境、复核日期、当前记录 180 天构建门、现行 Demo |
| 内容维护报告 | done | 本地文本/JSON、60/30 天分级、Actions 摘要与每周自动复核 |
| 外部链接库存 | done | 公开正文与 canonical/repository/demo 的统一 HTTPS 来源/次数离线报告，显式公网 HEAD 检查与非硬门状态分类 |
| 根暂存媒体审计 | done | inbox 引用账本、Git/文件系统年龄证据、共享/未引用/陈旧/缺失报告与 Actions warning，零自动删除 |
| 媒体门禁 | done | 真实格式解码、3 MiB/2560 px/像素与动图预算、Studio 上传前诊断、Obsidian 优化与构建扫描 |
| 媒体引用完整性 | done | Markdown AST 图片抽取、精确路径存在性、根暂存拒绝、slug 所有权与已归档孤儿附件门禁 |
| 媒体展示 | done | 封面与本地 Markdown 正文图共享固有尺寸/`next/image` 链路；HTTPS 外图有明确降级边界 |

## 设计与技术

- 视觉方向：Commit Trace / Evidence Rail，中文优先、工程档案感、浅深色响应式；
- 运行时：Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- 内容：仓库内 Markdown、YAML、Zod，GitHub 是唯一事实源；
- 阅读：react-markdown、remark-gfm、rehype-slug、rehype-highlight；GFM mdast 与 GitHubSlugger 复现同一标题和链接语义；
- 发布：Decap CMS 3.14.1、GitHub OAuth、stable slug 自定义控件、同源媒体清单、内存会话账本与 SHA-256 冲突确认、Obsidian 自有插件 1.1.0、inbox readiness CLI 与 Node 发布脚本；
- 媒体：Sharp 0.35.3、浏览器 magic/帧结构解析、`createImageBitmap` 与 Web Crypto、构建期确定性摘要清单、mdast-util-from-markdown 2.0.3、`next/image`、固有尺寸、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：内容新鲜度、根暂存媒体与正文/结构化端点外链的 CLI；确定性库存进入本地发布候选，时间/DNS 敏感的外链 HEAD 只显式运行；
- 路由：严格 YAML + Zod 永久重定向注册表、Next `redirects()` 308、构建期现行路由与静态文件交叉校验；
- 知识图：纯函数派生有向节点/边、语义 SVG + HTML 账本、零客户端布局依赖与 320px 明确降级；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、线上冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮实现提交：`c97c452`（Studio 页面会话媒体目标账本、same-session 与替换基线提交时序）；
- 自动交付：Quality Gate `30952501983`、Production verification `30952538991` 均成功；GitHub Production deployment `5751862018` 精确对应实现 SHA 且状态为 success，稳定生产域名保持公开；
- 最新完成迭代：0040 Studio 媒体会话账本；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

Studio 的冲突预检现在有两层确定基线：构建期 `/studio/media-manifest.json` 表示当前生产 Git 快照，页面内存 `approvedTargets` 表示本次页面已经成功重放的目标。第一次检查只返回带 `commit()` 的结果，不改变账本；合成 change 成功返回后才登记路径、字节数和 SHA-256。随后同路径同摘要显示 same-session，不同摘要展示会话基线/新文件证据并要求确认；取消保留旧基线，确认且重放成功后才更新。刷新页面或卸载重装会清空 Map，不写浏览器持久存储或远端。完整门禁为 117/117 单元测试、37 个构建页面和 17/17 HTTP 测试，稳定域名 24 路由、OAuth 302。

## 风险与下一步

1. Studio 已完成真实格式/预算、生产快照和顺序会话选择的同路径摘要预检，但有意不自动缩放或转 WebP；快速连续选择仍可能让两次异步解码/清单检查乱序完成，旧选择需要显式 stale-result 边界，不能晚于新选择重放或改写状态；
2. 首次保存后的 slug 已在 Studio 控件层锁定；真正迁移仍只能通过 Git 同步修改内容文件、正文引用、附件目录和 `content/redirects.yml`。注册表不自动推断迁移且有意只支持精确单跳路径；该控件依赖固定 Decap 3.14.1 bundle 的 `entry/newRecord` 契约，升级时必须重审；
3. inbox readiness 已覆盖全部本地草稿，但有意不进入 Actions：未跟踪草稿和附件天然不在 CI 检出中；当前真实 inbox 为空，正向/阻塞路径由临时 Git/媒体夹具验证，首次实际多草稿使用时仍应按 Modal 逐项复核；
4. Current record 已有每周分级报告，但提醒只存在于本地输出和 GitHub Actions 摘要/注解，不发送外部消息；这是当前有意的无服务边界；
5. Obsidian 块引用是专有语法，当前明确拒绝；知识地图已公开，但当前 SVG 双列布局为小型内容库优化，内容增长后需要在不牺牲 HTML 语义的前提下增加过滤或分组；
6. 正文与结构化 HTTPS 端点已有统一离线库存和显式健康检查，但 DNS/限流/网络仍只是观察证据；本机直连 Vercel 域名继续出现 timeout 假阴性，因此实时检查不进 Actions；
7. 标题锚点采用严格的实际渲染 id；改名或调整重复标题顺序时必须同步正文深链，Obsidian 块引用和模糊匹配仍明确不支持；
8. Studio OAuth origin、GitHub 凭据、Vercel deployment URL 保护和 Hobby 回滚范围仍需按运行手册维护；
9. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
10. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。

下一轮唯一主任务：为 Studio 媒体预检增加每个 file input 的选择代次与 stale-result 丢弃。新的 change 到达后，旧一轮即使稍后完成解码、清单读取或确认，也不得重放旧文件、清空当前 input、覆盖最新 Evidence Rail 或提交会话账本；最新选择仍走完整预算/冲突流程。实现只用 WeakMap/单调 token 和可注入时序测试，不读取文件第二次、不引入 AbortController 假取消、不持久化、不调用外部 API，并覆盖“旧成功晚到”“旧失败晚到”“确认期间变旧”和正常单选重放。
