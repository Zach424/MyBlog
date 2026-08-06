# 路线图与全局状态

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| 1. 项目与内容契约 | done | 项目章程、严格 schema、稳定 slug、标签/专题索引 |
| 2. 视觉与阅读路径 | done | Commit Trace、响应式/深色、文章/项目/专题/标签/搜索 |
| 3. 发布发现与质量 | done | SEO、OG、JSON-LD、RSS、Sitemap、robots、全链路测试 |
| 4. 作者自助写作 | done | `/studio` OAuth + editorial workflow PR、Obsidian Vault/模板/附件/真实 `--push` |
| 5. Vercel 原生迁移 | production live | 原生 Next.js、无 Cloudflare 依赖、24 路由生产冒烟通过 |
| 6. 所有者生产上线 | done | Git 自动 Production、稳定域名自动冒烟、双端发布、回滚与恢复均已验收 |
| 7. 持续内容与作者体验 | in progress | Iteration 0084 完成三个 workflow 的六处官方 action 不可变 SHA、共享结构/发布门禁与真实 runner 验收 |

## 当前唯一主线

进入持续内容与作者体验阶段。Iteration 0084 已把质量、生产冒烟和手动回滚 workflow 的 checkout/setup-node 六处引用固定到官方完整 SHA，同时保留 `# v6` 可读注释。共享 ESM 验证器让 YAML 测试与发布前检查共同拒绝浮动 ref、短 SHA、未复核值、错误仓库和注释漂移；触发器、权限、应用 Node 22、cache 与命令语义不变，并已通过真实 GitHub runner 和 Vercel Production。下一主线为给文章与项目详情页增加无外部服务、可访问的系统分享/复制规范链接控件；需要品牌域名时再绑定自定义域名，旧公开站继续只作为迁移历史证据。

## 已知风险

- Studio 依赖 GitHub OAuth App，回调 origin 变更后必须同步修改设置并重新部署；
- checkout/setup-node v6 已消除 Node 20 runtime warning，且三个 workflow 的六处执行引用已固定为官方完整 SHA；共享门禁拒绝浮动/短/未知引用，但不可变 pin 不会自动接收上游修复，自动更新机器人仍暂缓，后续需主动复核官方 refs；
- Studio 运行时约 5 MB，已固定 3.14.1、同源提供并使用不可变缓存；升级时必须同步修改版本化 URL、SRI、依赖和测试；
- `decap-cms` 开发依赖树仍包含上游未提供修复的审计项；当前只向已授权作者提供固定浏览器包，后续需单独评估新版或替代编辑器；
- Decap GitHub backend 的 OAuth scope 对公开仓库仍较宽，账号应启用 2FA 并定期撤销不用的授权；
- CSP 为 Next.js 内联启动脚本暂留 `'unsafe-inline'`，未来应迁移到框架支持的 nonce；
- Vercel Hobby 只保证回滚到上一生产部署，更早版本需要 Git revert/redeploy 或更高套餐；
- Vercel 不可变 deployment URL 可能受保护；自动冒烟必须以 `VERCEL_PRODUCTION_URL` 为公开检查目标，同时用 deployment 元数据核对 SHA；
- Windows Git 凭据保存在系统凭据管理器；撤销 GitHub OAuth 授权后，Obsidian `--push` 需要重新登录；
- 内容持续增长后要继续观察 `.next/static`、Serverless 函数体积和构建时间；
- 附件仍依赖 Git 仓库存储；封面和正文图的引用/展示/Studio 归档与预检已闭环，但 Studio/普通 Git 入口没有自动优化；Studio 已识别生产/会话冲突并以选择代次保护快速重选，普通 Git 仍只由构建门兜底；
- Studio 的 slug 在首次保存后已由自定义控件只读保护，真正迁移仍须使用 Git 同步修改内容、引用和附件；控件依赖固定 Decap 3.14.1 bundle 的 `entry/newRecord` 契约，升级必须重审；
- root `public/uploads` 已有确定性库存和 warning，但有意不自动删除；未跟踪附件只存在于作者工作区，GitHub Actions 无法看到，仍需本地运行报告后人工确认；
- slug 迁移已有构建验证的精确单跳 redirect 注册表，但仍是需要作者审阅的 Git 操作；不支持通配参数或自动推断，迁移必须同步处理内容、附件和引用；
- Obsidian 已有全 inbox readiness 总览，但该报告有意只代表本地单篇写入事务，不替代正式发布的完整仓库门禁，也不进入看不到未跟踪草稿的 Actions；
- Current record 已有 Studio 实时只读队列、每周 60/30 天 Actions 提醒和过期门；队列数据只随新 Production 接收内容变更，且仍不发送外部消息；若未来需要邮件/聊天通知，必须由所有者选择渠道后再接入；
- Obsidian 维护/Author Proof/交付状态与回执 1.34.0 保留四事务 owner-checked single-flight lease、phase/output activity pulse、会话内 terminal receipt、统一分诊及版本化 JSON；当前草稿作者意图使用 source-scoped version 6 inbox JSON，显示媒体 COVER/BODY、出现次数/来源行/逐次 alt/作者来源、精确变换与链接 trace，并以原始来源字节 SHA-256 绑定摘要和每次导航，同时用 latest-wins generation 约束命令、报告终态、异步读取和卸载。新运行还会先结算并终止同一 Symbol scope 的旧活动子进程，旧进度立即隐藏，其他 scope-null 命令保持独立；身份检查继续用独立 generation 约束 `vault.read`/Modal，后续清理 lease 不变。仍只为当前附件生成真实候选、轻量解析全草稿和读取已发布链接目标以保留全局正确性。模板驱动向导、文件名唯一身份、FileManager 改名与 `Vault.process` 严格旧字段清理已闭合新旧草稿身份。ALT 与 LINK occurrence 现都能在路径、`TFile`、完整摘要和双重行界复核后定位编辑器；真实 Obsidian 主题下的 Modal 版式和交互仍需首次使用观察。带注释、引号、anchor/tag、缩进、重复键或不匹配值的旧 slug 保持只读；新内容 Commit Envelope 的真实主题组合、超长 object id/path 和大量媒体仍需随使用观察；tracking ref 明确只是最后本地观察，inspect 路由不会猜测修复；
- 内部链接支持内容页和严格标题锚点，行内/引用式/自引用共享实际渲染 slug 规则，详情页与公开知识地图共享 outgoing/backlinks；明确不支持 Obsidian 块引用，标题改名必须同步深链，当前双列 SVG 为小型内容库优化，内容规模增长后需要过滤/分组；
- 正文普通 HTTPS 与结构化 repository/demo/canonical 已有统一确定性库存和受控实时报告；实时 DNS/网络结果有意不进 Actions，timeout/限流不能冒充内容错误；
- 文章与项目已有完整 A4 打印版式，但 PDF 仍由读者通过浏览器打印生成，仓库不把二进制 PDF 当作发布源，也不提供服务端 PDF 缓存；后续版式变化仍需重新做真实 PDF 全页复核；
- 自定义域名、公开邮箱、统计和评论尚未选择，但不阻塞生产上线。

## 平台历史

Cloudflare/Sites 版本曾用于首个公开站并暴露了构建日期、静态资源安全头和 320px 宽度问题；这些经验保留在 0008–0015 迭代档案。它们是历史证据，不再是当前运行目标。
