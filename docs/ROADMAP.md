# 路线图与全局状态

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| 1. 项目与内容契约 | done | 项目章程、严格 schema、稳定 slug、标签/专题索引 |
| 2. 视觉与阅读路径 | done | Commit Trace、响应式/深色、文章/项目/专题/标签/搜索 |
| 3. 发布发现与质量 | done | SEO、OG、JSON-LD、JSON Feed 1.1、RSS、Sitemap、robots、全链路测试 |
| 4. 作者自助写作 | done | `/studio` OAuth + editorial workflow PR、Obsidian Vault/模板/附件/真实 `--push` |
| 5. Vercel 原生迁移 | production live | 原生 Next.js、无 Cloudflare 依赖、24 路由生产冒烟通过 |
| 6. 所有者生产上线 | done | Git 自动 Production、稳定域名自动冒烟、双端发布、回滚与恢复均已验收 |
| 7. 持续内容与作者体验 | in progress | Iteration 0096 为正常与恢复共六个 Git 写入口增加运行代码/runtime manifest/磁盘 manifest 三方版本握手，版本漂移时准确要求重载且零领域命令 |

## 当前唯一主线

进入持续内容与作者体验阶段。Iteration 0096 已让 MyBlog Publisher 1.39.0 在四个作者事务与两条恢复交付之前比较运行代码、runtime manifest 和磁盘 manifest；未来 patch/minor 版本仍能显示结构化 `PLUGIN RELOAD REQUIRED`，伪造或缺失身份失败关闭，非版本 doctor attention 则不妨碍 lease 外的必要恢复。六个写入口都不自动重载或重复 Git，真实 Vercel 以冻结摘要在 1 次、1267 ms 内收敛。下一主线是验证磁盘 manifest/main/styles 确实来自同一 bundle，关闭同版本局部同步缺口。需要品牌域名时再绑定自定义域名，旧公开站继续只作为迁移历史证据。

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
- Obsidian 1.39.0 保留既有草稿身份、作者意图、四事务联锁、sealed Git 交付恢复和维护能力；正常与恢复 publication/review 的可信 handoff 均自动接力生产等待。所有 Git writer 的三方版本握手已覆盖未来 patch/minor、伪造证据、缺失磁盘身份和恢复旁路；真实主题下 reload interlock、连续 receipt/production Modal、长 ETag、commit、尝试列表、持续 Notice 与本机代理继承仍需首次使用观察。磁盘 manifest/main/styles 目前只检查版本与存在性，下一步增加同一 bundle 的确定性完整性证明；
- 内部链接支持内容页和严格标题锚点，行内/引用式/自引用共享实际渲染 slug 规则，详情页与公开知识地图共享 outgoing/backlinks；明确不支持 Obsidian 块引用，标题改名必须同步深链，当前双列 SVG 为小型内容库优化，内容规模增长后需要过滤/分组；
- 正文普通 HTTPS 与结构化 repository/demo/canonical 已有统一确定性库存和受控实时报告；实时 DNS/网络结果有意不进 Actions，timeout/限流不能冒充内容错误；
- 文章与项目已有完整 A4 打印版式，但 PDF 仍由读者通过浏览器打印生成，仓库不把二进制 PDF 当作发布源，也不提供服务端 PDF 缓存；后续版式变化仍需重新做真实 PDF 全页复核；
- 单篇 Markdown 源文是公开投影而非作者文件的无损 round-trip：字段顺序、注释和写作字段有意不保留，项目 `type: project` 只属于公开 schema；raw HTML 属性不参与 URL 改写。源文 ETag/条件 GET 与 version 1 批量清单已闭环；清单尚无独立 JSON Schema，源站生成成本随全部公开 Markdown 线性增长，达到实测阈值后再评估派生缓存或分页；
- Git/Obsidian sealed receipt、version 1 handoff、生产清单四态、单篇有界收敛与 runtime/disk 版本 interlock 已覆盖正常和恢复交付；网络、协议或版本错误不能冒充内容差异或触发二次 Git 动作。下一轮只处理磁盘插件 bundle 完整性，不改变交付协议；
- 自定义域名、公开邮箱、统计和评论尚未选择，但不阻塞生产上线。

## 平台历史

Cloudflare/Sites 版本曾用于首个公开站并暴露了构建日期、静态资源安全头和 320px 宽度问题；这些经验保留在 0008–0015 迭代档案。它们是历史证据，不再是当前运行目标。
