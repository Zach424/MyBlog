# 路线图与全局状态

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| 1. 项目与内容契约 | done | 项目章程、严格 schema、稳定 slug、标签/专题索引 |
| 2. 视觉与阅读路径 | done | Commit Trace、响应式/深色、文章/项目/专题/标签/搜索 |
| 3. 发布发现与质量 | done | SEO、OG、JSON-LD、JSON Feed 1.1、RSS、Sitemap、robots、全链路测试 |
| 4. 作者自助写作 | done | `/studio` OAuth + editorial workflow PR、Obsidian Vault/模板/附件/真实 `--push` |
| 5. Vercel 原生迁移 | production live | 原生 Next.js、无 Cloudflare 依赖、27 路由生产冒烟通过 |
| 6. 所有者生产上线 | done | Git 自动 Production、稳定域名自动冒烟、双端发布、回滚与恢复均已验收 |
| 7. 持续内容与作者体验 | in progress | Iteration 0128 已提供一次导入全站、全部公开标签与全部公开专题 RSS 的分组 OPML 2.0 |

## 当前唯一主线

进入持续内容与作者体验阶段。Iteration 0128 把聚合订阅落到 `/feeds.opml`：它直接消费公开标签/专题索引，输出“全部更新 / 按标签 / 按专题”稳定分组，当前包含 1 个根 RSS、11 个标签 RSS 和 1 个专题 RSS；`/subscribe` 因而从五条扩为六条只读通道。OPML 2.0 必填/可选属性、XML 转义、绝对 URL、输入不变、SHA-256 ETag、条件 GET/HEAD、`noindex` 与 Sitemap 排除均已闭环；无法证明的日期元数据被明确省略。功能提交 `d0f2165` 已进入稳定生产；完整证据为 534 项单元测试、65 个生成页面、34 项应用测试、27 routes 与 OAuth 302。OPML 为 5193/962 B（raw/gzip），预算提交 `e33f395` 已把第十条发现端点绑定真实部署。下一主线是 Atom 1.0 更新订阅，用标准 published/updated 语义按真实内容变化排序，同时保持现有 RSS 的首发语义不变。首次真实 Obsidian 人机验收保留为所有者可执行事项，需要品牌域名时再绑定自定义域名。

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
- Obsidian 1.41.0 保留既有草稿身份、作者意图、四事务联锁、sealed Git 交付恢复和维护能力；正常与恢复 publication/review 的可信 handoff 均自动接力生产等待。所有 Git writer 的三方版本、bundle 摘要与冻结 HEAD/index/worktree provenance 已覆盖未来 patch/minor、伪造/缺失 descriptor、局部/staged/unstaged 更新和恢复旁路；真实主题下 reload/bundle/provenance interlock、连续 receipt/production Modal、长 ETag、commit、尝试列表、持续 Notice 与本机代理继承仍需首次使用观察；
- 内部链接支持内容页和严格标题锚点，行内/引用式/自引用共享实际渲染 slug 规则，详情页与公开知识地图共享 outgoing/backlinks；明确不支持 Obsidian 块引用，标题改名必须同步深链，当前双列 SVG 为小型内容库优化，内容规模增长后需要过滤/分组；
- 正文普通 HTTPS 与结构化 repository/demo/canonical 已有统一确定性库存和受控实时报告；实时 DNS/网络结果有意不进 Actions，timeout/限流不能冒充内容错误；
- 文章与项目已有完整 A4 打印版式，但 PDF 仍由读者通过浏览器打印生成，仓库不把二进制 PDF 当作发布源，也不提供服务端 PDF 缓存；后续版式变化仍需重新做真实 PDF 全页复核；
- 单篇 Markdown 源文是公开投影而非作者文件的无损 round-trip：字段顺序、注释和写作字段有意不保留，项目 `type: project` 只属于公开 schema；raw HTML 属性不参与 URL 改写。源文 ETag/条件 GET、version 1 批量清单与独立 Draft 2020-12 Schema 已闭环；Schema 不表达跨字段相等、跨条目排序/唯一或真实日历语义，严格生产解析器仍是这些不变量的权威；
- Git/Obsidian sealed receipt、version 1 handoff、生产清单四态、单篇有界收敛、runtime/disk 版本、bundle 完整性与 Git provenance 已覆盖正常和恢复交付；网络、协议、版本、摘要或来源错误不能冒充内容差异或触发二次 Git 动作。首次真实 Obsidian 人机验收继续等待所有者操作，不用自动化假证据替代；
- 当前结构化生产 raw/gzip 基线为：清单 3009/921 B、Schema 3278/755 B、JSON Feed 20697/9876 B、根 RSS 3400/1284 B、代表标签 RSS 2059/923 B、代表专题 RSS 2065/983 B、OPML 5193/962 B、Sitemap 5059/532 B、robots 155/127 B、OpenSearch 700/462 B；逐端点推导上限和覆盖门已闭环。0128 的新聚合投影已在稳定生产重测，并把十端点基线来源绑定到功能提交 `d0f2165`；后续基线仍必须伴随产品价值复核、真实生产重测、来源提交和归档，不能自动跟随输出自我放行；
- `/subscribe` 只说明并直达现有公开读取协议，OPML 只打包订阅地址；两者都不提供邮件订阅、推送通知、写入 API、账号系统或第三方阅读器状态。若未来需要邮件列表，必须先明确供应商、隐私、退订、发送身份与成本，不能把当前只读目录当成已具备投递能力；
- 根级 404 现在有四条恢复路径并显式 noindex，但本地 Next 与 Vercel 对自动 noindex 的最终数量不同；质量门只要求语义存在，版本升级继续以稳定生产 HTML 为准。404 继承根首页 canonical，本轮没有为非索引错误页启用实验性 global-not-found；
- `/activity` 已补上 archive 有意不承载的后续维护事件；它按每条记录最多两个事件线性增长，当前 8 个事件远低于预算。首页摘要已经复用同一模型并严格限制三项，没有第二份排序。内容增长前不增加客户端筛选或分页；先由第十三路 HTML 预算提供真实压力；
- JSON Feed 的 `date_modified` 与 RSS 的 `dcterms:modified` 已共同表达逐条修改时间，RSS 仍保留首发 `pubDate`。Dublin Core Terms 是标准 XML 扩展，具体阅读器可能忽略它，因此站点只承诺元数据正确、可解析且与 JSON Feed 对齐，不承诺所有阅读器一定在界面中展示或按它重新提醒；
- 十个结构化端点与单篇 Markdown 的 GET/HEAD 条件语义已经闭环；所有 HEAD 200/304 零正文，验证器、缓存及存在的表示元数据与 GET 等价，未知源文、标签 RSS 和专题 RSS 保持无验证器 `no-store` 404。该能力依赖 Next 发送边界而非十二套显式 HEAD 导出，框架升级必须重跑真实构建与生产门；Vercel 对部分压缩 200 响应使用弱标签、对 304 精简表示元数据，生产门按 HTTP 等价语义验收；
- Feed 表示修订时间必须只在序列化正文契约改变时显式更新；当前 JSON Feed 为 `2026-08-06T10:09:53Z`，RSS 标签语义对齐后为 `2026-08-10T22:25:11Z`。不能把构建时间、部署时间或任意 Git mtime 当作资源修改事实；
- OpenSearch 1.1 已提供标准描述和 HTML 自动发现，但不同浏览器对内置搜索引擎安装的支持并不一致；端点只承诺开放协议和同源查询模板，不把浏览器 UI 行为当成本站可控能力，也不公开内部搜索索引；
- OPML 2.0 允许嵌套 outline，但导入器可能展平或隐藏分组；本站只承诺 13 个当前订阅 leaf、稳定顺序和绝对地址。可选日期字段继续只在能证明聚合表示修改时刻时增加，构建/部署时间不能代替资源事实；
- 搜索首屏仍把 4 条完整纯文本搜索文档和每条可选更新日序列化给客户端；当前生产 `/search?q=cloudflare` 为 41251/14704 B raw/gzip，远低于 163840/18432 B 上限。内容规模显著增长时必须先由 HTML 预算报警，再评估分片索引或按需加载，不能为了提前优化牺牲首屏结果与无网络本地筛选；
- `/archive` 当前只有一个年份和月份，但契约已经覆盖跨年、跨月、同日决胜、空集合和输入不变。不要为了当前四条内容提前增加客户端筛选、分页或年份导航；先让内容增长和十三路 HTML 预算提供真实压力，再决定增强方式；
- 继续阅读的排序是当前 4 条公开内容规模下的启发式契约；标签越泛化、内容量越大，分数越可能由共同标签主导。先通过可见理由与真实阅读观察积累证据，再考虑标签稀有度或多样性约束，不能引入点击追踪或黑盒模型替代当前可审计信号；
- 自定义域名、公开邮箱、统计和评论尚未选择，但不阻塞生产上线。

## 平台历史

Cloudflare/Sites 版本曾用于首个公开站并暴露了构建日期、静态资源安全头和 320px 宽度问题；这些经验保留在 0008–0015 迭代档案。它们是历史证据，不再是当前运行目标。
