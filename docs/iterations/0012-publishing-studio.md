# Iteration 0012：网页发布后台

## 1. 范围与成功标准

本轮目标是实现不依赖 Codex 的 `/studio` 发布后台代码：作者可以用 GitHub 登录，编辑文章/项目、保存 PR 草稿、预览 Markdown、上传图片并发布；未配置密钥时后台必须保持关闭。真实 OAuth 和线上写入需要作者 Cloudflare/GitHub secrets，因此本轮只有自动证据的部分标记为完成。

## 2. 项目结构状态

新增 `public/studio` 启动页、动态配置与预览样式；新增 `lib/cms-oauth.ts`；Worker 增加 Studio 静态映射和 OAuth 分流；内容 schema 接受与文件名一致的可选 `slug`；部署工作流增加 OAuth secrets；新增两组单元测试并扩展 Worker、安全、robots 和内容测试。

## 3. 设计内容

加载入口沿用 Commit Trace 顶部轨迹、冷调纸面、Ink 与 Signal，操作主句为“把草稿推进为可验证的发布”。编辑器不伪装为公开站点；正文预览才完整复用阅读页排版、代码块、规则线与深色偏好。唯一视觉风险集中在“草稿→证据”的发布语义，不叠加通用后台仪表盘。

## 4. 使用的技术

- Decap CMS `3.14.1`，固定 CDN 版本与 SHA-384 SRI；
- GitHub backend、GraphQL 与 editorial workflow；
- Cloudflare Worker 同源 GitHub OAuth；
- Web Crypto HMAC-SHA256、随机 nonce 与十分钟 state；
- 路由级 CSP、COOP 与 no-store；
- GitHub Actions/Cloudflare secrets 注入。

## 5. 实现的功能

1. `/studio` 直接管理 `content/posts` 与 `content/projects`；
2. 文章字段覆盖标题、Slug、摘要、类型、日期、标签、草稿、精选、专题、canonical、封面与正文；
3. 项目字段覆盖状态、技术栈、源码与演示地址；
4. 默认草稿、PR editorial workflow、预览、标签筛选、图片上传和发布；
5. OAuth 未配置时 503；非法 provider、跨站 site ID、篡改或过期 state 被拒绝；
6. 后台不进入 Sitemap，robots 禁止 `/studio` 与 `/api/cms/`；
7. 页脚提供 `rel=nofollow` 的写作后台入口。

## 6. 实现方法

CMS 使用手动初始化配置，在浏览器中从当前 origin 生成 OAuth base URL，避免 workers.dev 与自定义域名维护两份配置。新增内容要求作者显式填写 ASCII Slug，文件模板使用该字段；内容构建再次检查 frontmatter slug 与文件名一致，双重防止 URL 漂移。

OAuth 不增加独立代理 Worker。主 Worker 的 `/api/cms/auth` 生成签名 state 并跳转 GitHub；callback 验签、检查时效与 origin，再用服务端 secret 交换一次性 code。回调窗口只向签名 state 中的同源 opener 发送 Decap 协议消息。Studio 使用 `same-origin-allow-popups` 保留 OAuth popup，公开页面仍使用 `same-origin`。

## 7. 验证证据

- ESLint 与 TypeScript 通过；
- 21/21 单元测试通过，其中 4 条覆盖 OAuth 关闭、授权、跨站/篡改和 callback；
- 8/8 Worker 集成测试通过，包括真实构建产物的 `/studio` 静态响应和未配置 OAuth 503；
- 6/6 发布审计通过，Studio no-store、COOP 与 GitHub CSP 单独验证；
- 生产依赖审计为 0 个已知漏洞；Wrangler 干跑读取 32 个静态文件，总上传 `2633.55 KiB`、gzip `627.20 KiB`，无绑定；
- CMS 配置测试证明两个集合仍指向唯一 `content` 目录、标签与 registry 一致、资源版本/SRI 固定；
- 真实 OAuth、PR 写入和线上图片上传仍等待所有者 secrets，不能标记为已在线完成。

## 8. 经验与教训

OAuth popup 不是普通重定向。站点原有 `Cross-Origin-Opener-Policy: same-origin` 会切断跨 GitHub 往返的 opener；只给 Studio 与 callback 使用 `same-origin-allow-popups`，才能兼顾登录协议和公开阅读页隔离。

把 CMS URL 写死到某个预览域名会让迁移再次依赖工程修改。浏览器手动初始化把当前 origin 注入后台，同时由签名 state 把 callback 约束回同一个 origin，配置便利性与安全边界可以同时成立。

中文标题不能可靠生成符合现有 ASCII 契约的 URL。让作者明确选择一次 Slug，再由 schema 强制它与文件名相同，比静默音译或放宽稳定 URL 规则更可维护。

## 9. 全局状态、风险与未解决问题

网页后台代码、字段模型、预览、附件路径和 OAuth 安全边界完成。风险是 Decap 主包仍从固定第三方 CDN 加载，虽有 SRI 和失败提示，离线不可用；真实 GitHub OAuth App 和 Cloudflare secrets 尚未配置，不能声称线上后台已可登录。Obsidian 入口尚未实现。

## 10. 下一轮唯一主任务

实现 Obsidian Vault 配置、文章/TIL/项目模板、附件路径、Git 同步与一键发布前检查，使本地写作和网页后台共享相同内容契约。
