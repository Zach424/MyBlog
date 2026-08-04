# 系统架构

## 1. 架构目标

MyBlog 是 Git-first 个人技术博客。公开阅读不依赖数据库；网页后台、Obsidian 和普通编辑器只负责产生 Git 提交。部署平台可以替换，但内容契约、URL 和写作入口保持稳定。

## 2. 技术组成

| 层 | 技术 | 职责 |
| --- | --- | --- |
| 界面 | React 19、Next.js 16 App Router | 页面、元数据、Route Handlers 与服务端渲染 |
| 内容 | Markdown、YAML、Zod | 文章/项目解析、字段校验、草稿过滤与派生索引 |
| 维护 | Node CLI、GitHub Actions | Current record 日龄、根媒体库存、外链库存、分级队列、摘要与过期门 |
| 阅读 | react-markdown、remark-gfm、rehype | GFM、标题锚点、代码高亮与目录 |
| 发现 | 本地搜索、RSS、Sitemap、robots、JSON-LD | 检索、订阅与搜索引擎发现 |
| 发布 | Decap CMS、Obsidian、GitHub | 两个作者入口，共用同一内容事实源 |
| 媒体 | Sharp、Markdown AST、`next/image`、Git `public/uploads` | 原图安全解码、WebP 优化、共享固有尺寸、响应式封面/正文图、引用所有权与附件版本化 |
| 托管 | Vercel | Git 自动预览、`main` 生产部署、环境变量与回滚 |
| 质量 | Node test、TypeScript、ESLint、生产 HTTP 测试 | 内容、HTML、安全、链接、体积与发布契约 |

## 3. 项目结构

```text
app/
  api/cms/{auth,callback}/route.ts  GitHub OAuth 同源端点
  studio/                           Studio HTML、配置、媒体清单、预检、slug 控件和版本化 CMS 运行时路由
  posts/ projects/ series/ tags/   集合与详情页
  knowledge/ search/ about/         知识地图、搜索和关于页
  rss.xml/ sitemap.xml/ robots.txt/ 发现端点
components/                         站点框架、内容视图、Markdown、搜索
  ContentCover.tsx                  文章/项目共享的响应式封面与 Artifact Rail
  KnowledgeMap.tsx                  服务端 SVG 信号场、关系账本与孤立记录
content/
  posts/ projects/                  唯一公开内容源
  inbox/                            Obsidian 待发布区
  redirects.yml                     版本化永久重定向注册表
public/uploads/<slug>/              按内容隔离的公开图片附件
lib/
  content/                          内容契约、维护报告、文件读取、派生索引与引用关系
    inbox-readiness.ts              全部 Obsidian 草稿的只读发布就绪聚合
    external-links.ts               GFM 外链库存、受控 HEAD 检查与公网目标防护
    knowledge-graph.ts              公开节点、有向边、邻接与孤立状态派生
    media.ts                        封面与正文图共享的固有尺寸描述器
    media-references.ts             Markdown 图片 AST 抽取与安全 `/uploads` 路径解析
    staging-media.ts                根暂存库存、inbox 引用、年龄证据与报告格式
  cms-oauth.ts                      签名 OAuth state 与 token 交换
  media-policy.ts                   原图安全包络、WebP 优化与公开媒体预算的共享策略
  studio-media-manifest.ts          已归档媒体路径、字节数与 SHA-256 的确定性清单
  obsidian-publishing.ts            Obsidian 校验、附件与目标路径转换
  redirects.ts                      重定向 schema、路径不变量与 Next 规则转换
  studio-assets.ts                  构建期 Studio 资源响应
studio/                             Decap CMS、浏览器媒体预检与稳定 slug 控件源文件（不放入 public）
templates/obsidian/                 文章、TIL、项目模板
scripts/                            发布、inbox/内容/暂存媒体/外链报告、冒烟、迁移和生产测试器
build/validate-media.ts             构建前递归扫描全部公开上传图片
build/validate-media-references.ts  正式内容图片存在性、slug 所有权和孤儿附件门禁
build/validate-redirects.ts         当前公开路由、静态文件与重定向关系门禁
tests/                              单元、生产 HTTP 与质量审计
.github/workflows/
  quality.yml                       PR/main/每周完整质量门与维护摘要
  production-smoke.yml              Vercel 生产部署成功后的在线验收
  rollback.yml                      所有者手动 Vercel 回滚与复核
vercel.json                         Vercel Next.js 框架声明
```

## 4. 内容与构建

`next.config.ts` 在开发和构建开始时冻结作者时区日期，并行执行内容、媒体文件、内容—媒体关系与永久重定向校验。内容校验器先验证全部 Markdown，再对已公开内容执行关系完整性与新鲜度检查；媒体校验器递归扫描 `public/uploads`，拒绝符号链接、非图片、损坏图片、扩展名伪装和预算超限；媒体关系校验器用标准 Markdown AST 读取正式 posts/projects 的 `cover`、行内图片与引用式图片，核对精确文件路径和 slug 所有权，再拒绝无人引用的已归档附件；重定向校验器交叉检查当前公开 HTML 路由、静态文件、运维命名空间与 `content/redirects.yml`。纯净 Git 检出尚无上传目录时等价于零张图片；目录一旦存在，所有文件和正式引用都必须通过校验。`lib/content/index.ts` 在构建/服务端从 `content/posts` 与 `content/projects` 读取文件，解析为统一记录，过滤草稿和未来内容，再派生专题、标签、搜索、RSS 与 Sitemap。

永久重定向注册表只接受小写 ASCII 精确路径，并要求每条记录包含加入日期和原因。来源不能仍是当前页面、公开静态文件、API/Studio 或 Next 内部路径；目标必须是同一次构建中的公开 HTML 页面。注册表拒绝重复来源、自跳转、链式跳转和环路，再由 Next `redirects()` 输出单跳 `308 Permanent Redirect`。查询参数沿用 Next 原生透传语义，旧地址不进入 Sitemap，也不另建内容副本。

公开日期按 `Asia/Shanghai` 在 Next.js 配置加载时冻结为 `CONTENT_BUILD_DATE`。同一个部署内的页面、搜索和 Feed 因而共享确定内容集合，不会因 Serverless 实例启动时间变化。

每条正式内容声明 `freshness` 和 `reviewedAt`。`historical` 是保留当时决策的快照，不随时间失效；`current` 承诺与现行系统一致，公开后最多 180 天必须复核。复核日期不能早于内容更新日期、不能晚于构建日期。详情页服务端渲染 Context 与 Reviewed；结构化数据的 `dateModified` 使用复核日期。

`lib/content/maintenance.ts` 复用构建硬门的 UTC 完整日计算，把公开 Current record 派生为 healthy、review-soon、due-soon、overdue。60 天进入复核窗口，30 天进入紧急队列，第 180 天仍是最后有效日，第 181 天过期。`scripts/report-content-maintenance.mjs` 提供文本/JSON、固定日期演练、GitHub Markdown 摘要和源文件注解；Historical、草稿与未来记录不参与队列。Quality Gate 在 push、PR、手动运行和每周一 01:00 UTC 执行报告，只有 overdue 返回非零，预警不改变原 180 天契约。

`lib/content/staging-media.ts` 只扫描 `public/uploads` 根文件，并复用 Obsidian 发布器自己的 Wiki/Markdown/cover 附件解析语义，交叉建立 inbox 草稿引用账本。现存文件分为单草稿引用、多草稿共享和未引用；报告还列出缺失引用与无法审计的草稿。干净且已跟踪的文件以 Git 最后提交日计算年龄，本地修改或未跟踪文件以明确标注的 filesystem mtime 作为观察证据；默认 30 天进入陈旧复核，但任何发现都只产生建议和 Actions warning，不删除文件、不改变构建结果。`scripts/report-staging-media.mjs` 提供文本/JSON、固定日期/阈值与 GitHub 摘要，Quality Gate 每次运行和每周复核都会生成库存。

`lib/content/inbox-readiness.ts` 在作者工作区逐篇隔离检查直接位于 `content/inbox` 的 Markdown：复用真实发布器完成类型/slug/frontmatter/站内链接与附件目标派生，再把每张附件交给同一媒体发布策略，在系统临时目录生成并校验实际候选产物。报告额外交叉检查正式目标、附件目标、Git 跟踪附件和多草稿共享源；一个坏草稿不会阻止其他草稿产生证据。状态分为现在可发布的 `ready`、可以提交但尚未到公开日的 `scheduled` 和需要处理诊断的 `blocked`。临时目录在成功和失败路径都删除，作者 Markdown 与附件不写入；`scripts/report-inbox-readiness.mjs` 提供文本/JSON，Obsidian 桌面插件 1.1.0 用只读 Modal 显示同一文本。它不接入 Actions，因为未跟踪本地草稿对 CI 天然不可见。

`lib/content/external-links.ts` 用与正文渲染一致的 GFM AST 读取公开文章/项目正文，并从同一 `ContentRecord` 读取文章 canonical、项目 repository/demo。每个 occurrence 标明 `sourceField`；正文另保留相对行和可见标签，字段显示 `frontmatter.<field>`。URL 规范化后统一聚合，因此正文与结构化字段指向同一地址时只形成一个 link entry 和一次健康检查；图片、代码、站内链接、锚点、邮件链接和 `demo: null` 不参与。正文中的 HTTP、协议相对、无效 HTTPS 与含凭据 URL 进入本地 issue 且凭据不会写入报告；结构化字段继续由 schema 先保证 HTTPS。`scripts/report-external-links.mjs` 默认只输出确定性文本/JSON 库存并进入本地 `release:check`。只有显式 `--check` 才发送 HEAD：每跳限制 HTTPS/443/无凭据，拒绝本地命名空间和任一私网/回环/链路本地/保留 DNS 结果，再把连接固定到已验证公网地址以收窄 DNS rebinding；并发 1–8、超时 500–30000ms、重试 0–2、重定向 0–10。响应头到达后立即关闭，不下载或保存正文。404/410、其他确定 4xx、安全或重定向错误才计入 broken；403/429/HEAD 不支持、5xx、超时和网络错误保留为暂不可确认。实时检查不进入 Actions 或默认构建硬门。

`lib/content/knowledge-graph.ts` 接收同一公开文章/项目集合与已经校验的引用关系，确定性派生节点、有向边、每个节点的 outgoing/backlinks、唯一邻居数和孤立状态。`app/knowledge/page.tsx` 在服务端读取该结果；`KnowledgeMap.tsx` 同时输出可聚焦的 SVG 链接信号场、原生 HTML 有序关系账本和孤立记录列表。桌面端按文章/项目双列绘制，互相引用分轨显示；`≤ 42rem` 隐藏需要宽画布的 SVG，保留完整关系账本和说明，因此辅助技术、搜索引擎、无 JavaScript 与 320px 设备都不依赖 Canvas、客户端布局或另一份索引。新增/修改正文站内链接会在下一次构建自动更新详情页与知识地图。

`lib/content/media.ts` 是封面与正文图共享的服务端尺寸层。文件系统根静态收窄到 `public/uploads`，避免 Turbopack 把整个仓库追踪进 Serverless 产物；同一仓库路径的检查通过 React cache 复用。封面描述器附带 `coverAlt`，交给共享 `ContentCover` 和 OG/Twitter/JSON-LD；没有封面的记录不渲染 figure。`MarkdownContent` 则先从正文 AST 收集并去重 URL，只为本地 `/uploads/...` 建立描述器，再把真实宽高、作者 alt 和对应 48rem 阅读栏的 `sizes` 交给 `next/image`。两条详情路由必须传入内容 `sourcePath`，因此页面渲染与构建媒体契约使用同一安全路径边界。

内容目录通过 Next.js output tracing 显式包含在部署中，既支持 Vercel Serverless，也不会依赖开发机器路径。

## 5. 作者发布链路

```text
网页 /studio ─┐
              ├─ GitHub 提交/PR ─ 质量门 ─ main ─ Vercel 自动生产部署
Obsidian ─────┘                                      │
                                                    └─ 生产冒烟
```

Studio 在浏览器中用当前 origin 生成 `base_url`。`/api/cms/auth` 创建十分钟有效、HMAC 签名且绑定 origin 的 state；`/api/cms/callback` 交换 GitHub token，并且只向发起授权的同源窗口发送结果。未设置 `GITHUB_OAUTH_ID` 或 `GITHUB_OAUTH_SECRET` 时返回 503，发布入口安全关闭。

Studio HTML、配置、预览样式、媒体预检和稳定 slug 控件保留在仓库根 `studio`；完整 `decap-cms@3.14.1` 浏览器包作为构建期依赖。上述资源与构建期媒体清单共七类端点，全部由显式 Route Handler 同源返回。未知子资源返回真实 404。资源不进入 `public`，以便统一应用专用 CSP、`X-Robots-Tag` 与 OAuth 弹窗策略。

Studio 的全局 `media_folder`/`public_folder` 保留为根暂存与媒体库兼容入口；posts/projects 集合各自覆盖为绝对仓库模板 `/public/uploads/{{fields.slug}}` 与公开模板 `/uploads/{{fields.slug}}`。编辑器因此在作者填写稳定 slug 后，把封面和 Markdown 正文图直接写入该内容的归档目录。slug 同时决定内容文件名、公开 URL 与附件命名空间，首次保存后不可修改。

构建期 `lib/studio-media-manifest.ts` 递归读取 `public/uploads` 的普通文件，按仓库路径排序并计算字节数与 SHA-256；`/studio/media-manifest.json` 以静态、同源、`no-store`/`noindex` 响应提供这一不可写快照。浏览器预检在读取和解码同一份原始字节后计算摘要，按固定 Decap 3.14.1 的小写、去音调和 ASCII 文件名规则推导 `public/uploads/<slug>/<filename>`。不存在为 new；路径与摘要/字节相同为 same；同路径不同内容必须展示双方体积与摘要前缀，并由作者明确确认。稳定 slug 缺失、清单失败或清单结构异常时条目上传失败关闭；全局媒体库没有条目身份时只执行原媒体预算预检。文件通过后仍透传原始 `File`，不在浏览器内改写字节。

同一个 conflict checker 还持有仅存于页面内存的 `approvedTargets` Map。生产清单是初始基线，成功重放过的目标成为会话优先基线；后续同路径同摘要返回 same-session，不同摘要返回 replace-session-confirmed 并再次要求证据型确认。检查函数只返回幂等 `commit()`，handler 在合成 change 事件成功返回后才调用；取消、格式/清单失败或重放异常均不写账本。卸载并重新安装预检或刷新页面会创建新 Map，不使用 localStorage、IndexedDB 或远端状态。

media handler 另用 `WeakMap<input, generation>` 实现 latest-wins。每个真实 change 在任何 await 前同步递增代次，合成重放由 approved `File` 提前识别且不递增；`isCurrent()` 同时核对 token 和当前 `input.files[0]`。图片解码、manifest、确认等异步边界后，旧代次返回显式 stale 或静默结束。过期成功不能 report/dispatch/commit，过期失败不能清空最新 input 或覆盖 Evidence Rail；空文件 change 也会递增代次以使在途选择失效。底层解码/fetch 不伪装成已取消，只是失去产生副作用的权限。

posts/projects 的顶层 slug 使用项目自有 `stable-slug` custom widget，专题内的普通 slug 仍使用内建 string。实际提供给浏览器的 Decap 3.14.1 bundle 把当前 Immutable `entry` 传给 control；其 reducer 用 `newRecord=true` 标记新建/复制，用 `false` 标记已加载的正式或 editorial workflow 条目。控件因此只在 `newRecord=false` 时使用原生 `readOnly`，保存值仍参与序列化且可复制；新建、复制和未保存本地备份保持可编辑。已有条目若字段值与 entry 顶层 slug/path 身份不一致，`isValid` 在保存前返回可执行错误。控件使用官方全局 `createClass`/`h` 注册，在 CMS init 前安装，并以 DOM data 属性提供无内容写入的浏览器可观测性；当前内部 `entry/newRecord` 传递由所发布 bundle 的 source map 回归测试锁定，升级 Decap 时必须重审。

Obsidian 草稿中的 Wiki 图片嵌入、指向 `public/uploads` 的 Markdown 图片和 frontmatter `cover` 会在发布前转换。文件进入 `public/uploads/<内容 slug>/<稳定文件名>`，正文或 cover 改写为对应 `/uploads/...` URL；文件名不稳定时使用可读 ASCII 名加路径哈希消除冲突。静态 PNG/JPEG/WebP 的公开文件名统一使用 `.webp`，相同 stem 的多种源格式因而会在修改工作区前被拒绝为目标冲突；GIF 和 AVIF 保持扩展名。cover 与正文附件登记到同一映射，所以共享源不会重复移动，且都受同一 staging、安装与回滚事务保护。

发布前，作者可以从 Obsidian 命令面板运行“查看全部草稿发布就绪状态”。插件以参数数组和 `shell: false` 启动本地 `content:inbox`，把输出作为纯文本写入 Modal，避免诊断内容被解释为 HTML；blocked 是只读发现，不会触发发布动作。单篇“检查当前草稿”与“发布当前草稿并同步 GitHub”保持原语义，完整 `npm run check` 仍是最终权威门禁。

发布器先在仓库内 `node_modules/.cache/myblog-publish-*` 创建同盘 staging。每个静态 PNG/JPEG/WebP 都先自动校正 EXIF 方向，以固定 quality 82、alpha quality 100、effort 6 的 Sharp 参数生成 WebP，并在 staging 中重新执行公开预算检查；满足预算且重编码不会更小的已有 WebP 保持原字节。GIF、AVIF 和动画 WebP 不改变字节，但必须先满足公开预算。`--check-only` 完成同样的派生并报告源/产物差异，然后删除 staging，不修改工作区。

正式发布写入目标 Markdown、移除 inbox 草稿后，先把每个原附件 rename 到 staging backup，再把验证过的产物 rename 到最终路径。staging 与工作区同盘，所以安装和恢复不依赖跨卷复制。完整质量门失败时按逆序删除已安装产物、将每个 backup rename 回精确源路径、删除目标 Markdown 并按原文本恢复 inbox 草稿；成功后才删除 backup。预检、目标冲突和 `--push` 暂存区检查都发生在事务之前，避免失败残留。

媒体策略只接受 PNG、JPEG、WebP、GIF 和 AVIF，扩展名必须匹配解码格式。自动优化原图安全包络为 25 MiB、8192×8192 px、4000 万单帧像素；公开单文件上限仍为 3 MiB，宽高上限均为 2560 px，单帧上限 800 万像素，动图上限 8000 万总像素。Studio 在捕获阶段接管 Decap 的本地图片 `change` 事件，先读取 magic bytes、PNG/GIF/WebP 动画结构并用 `createImageBitmap` 解码真实宽高；通过后把同一个 `File` 重新派发给 Decap，失败则清空选择并给出本地 Evidence Rail 诊断。浏览器预检不上传、不重编码、不改变 editorial workflow、per-slug 路径、重名确认或 Git 回滚语义；JPEG/PNG 需要自动 WebP 时仍使用 Obsidian 发布器。动画 AVIF 因浏览器端不能可靠计帧而 fail closed。构建扫描仍是所有入口的权威门禁。Sharp 的 libvips 缓存在短命发布/校验进程中关闭，避免 Windows 保留附件句柄。

正式内容的本地图片 URL 必须是 `/uploads/...`，且不能包含查询、锚点、编码路径分隔符、空/`.`/`..` 段或 Windows 非法字符；Markdown 图片必须填写非空 alt。正文的非本地图只允许完整 HTTPS URL：它不加入 `next/image` 的开放远程白名单，而是明确降级为 `loading=lazy`、异步解码、`no-referrer` 的原生图片；公开 CSP 的 `img-src` 只额外允许 `https:`。cover 必须本地化以保证构建期宽高和社交元数据可确定。文件清单保留仓库中的原始大小写，因此 Windows 开发机也能在部署前发现会在 Linux/Vercel 失效的大小写漂移。`public/uploads/<slug>/...` 被视为已归档命名空间，只能由同 slug 的 post/project 正文或 cover 引用；根目录文件只保留给 Obsidian inbox 与媒体库暂存，不能被正式 posts/projects 引用，也不会被自动删除，而是进入独立库存报告供作者复核。正式目录的 draft/future 内容参与所有权，避免编辑分支在公开前被门禁阻断；`content/inbox` 只参与根暂存报告，不参与正式所有权关系。

同一发布阶段还会读取 `content/posts` 与 `content/projects` 的稳定文件名和正文，把 Obsidian Wiki/Markdown 笔记链接转换为站点 URL。裸 slug 只有在文章和项目之间唯一时才可使用；显式 `posts/<slug>`、`projects/<slug>`、别名和标题链接均受支持，块引用被明确拒绝。转换后用目标正文的实际 heading inventory 校验 fragment，所以 `--check-only` 与 inbox readiness 无需先写正式文件即可发现标题漂移。转换跳过行内代码和围栏代码，避免把教程中的语法示例当成真实关系。

`lib/content/markdown.ts` 以与渲染相同的 GFM AST 抽取行内、引用式和自引用链接，并按 H1–H6 全局顺序生成与 `rehype-slug` 一致的 heading id；`lib/content/relations.ts` 校验目标页面、URL 编码和 fragment 后，一次派生 `outgoingByUrl`/`backlinksByUrl`。关系按内容 URL 去重，自引用和 fragment 不制造额外图边。`lib/content/index.ts` 只暴露两个只读查询，文章与项目详情页在服务端把它们交给同一 Reference ledger：`→` 追溯当前正文引用的依据，`←` 继续阅读引用当前记录的后续实践；空方向省略，两侧都空时不产生账本。关系不存入 frontmatter、客户端状态或数据库，正文链接就是唯一事实源；草稿或未来目标不在公开集合中，因此公开内容不能引用尚未公开的目标。

## 6. 安全与缓存

`next.config.ts` 为所有响应声明 CSP、HSTS、`nosniff`、`DENY`、权限策略、来源策略和 COOP，并关闭 `X-Powered-By`。公开 HTML 使用浏览器复核、CDN 一小时缓存与一天 stale-while-revalidate；Studio HTML、配置、预览 CSS、OAuth 和未知 Studio 路径必须包含 `no-store`。版本化且带 SRI 的 CMS 运行时使用一年不可变缓存。

一般页面的 COOP 为 `same-origin`；Studio 与 OAuth 为 `same-origin-allow-popups`，以允许 GitHub OAuth 弹窗完成握手。Studio CSP 不允许第三方脚本源，只额外允许 GitHub API、GitHub 授权页和头像来源；`unsafe-eval` 例外被限制在 Studio 路由，因为固定版本 Decap 编辑器/解析器需要运行时求值。

## 7. 部署与回滚

Vercel GitHub Integration 负责每个分支的 Preview 和 `main` 的 Production，不再维护重复的部署 Action。GitHub `deployment_status` 成功事件触发生产冒烟，检查代表页面、全 Sitemap、Studio/OAuth、Feed、安全头和 404。

紧急恢复使用 Vercel Instant Rollback。仓库内手动工作流调用固定版本 Vercel CLI，回滚后对稳定生产域名重跑同一冒烟；Git 历史随后通过 revert 或修复提交恢复一致性。

## 8. 不变量

- GitHub 仓库是内容、附件、版本和回滚的唯一事实源。
- 稳定 URL 来自文件名/slug，不随日期和平台变化。
- 必要的 URL 迁移必须登记为有日期和原因的单跳永久重定向；来源不能遮蔽现有路由或文件，目标必须在同一构建中公开。
- 草稿、未来内容不能进入页面、搜索、RSS 或 Sitemap。
- 公开站内链接必须指向同一构建中的公开文章或项目；详情页 outgoing/backlinks 与 `/knowledge` 的节点、边和孤立状态只能从同一正文链接集合派生。
- 公开内容必须声明语境和复核日期；Current record 超过 180 天未复核不能进入新部署。
- Current record 的报告状态与构建硬门必须复用同一日龄计算；Historical、草稿和未来内容不进入维护队列。
- `public/uploads` 只能包含真实可解码且扩展名匹配的白名单图片，并满足共享公开媒体预算；Obsidian 自动优化只能从受限原图包络进入 staging，验证产物后才能原子安装。
- 正式 Markdown/cover 的每个本地图片必须精确存在；已归档附件必须由同 slug 内容引用，代码示例不能形成媒体所有权。
- 正式 Markdown/cover 不能引用根暂存图片；Studio 必须先填写稳定 slug，再把媒体直接写入同 slug 归档目录。
- 根暂存媒体必须可由确定性报告区分引用、共享、未引用、陈旧与缺失；报告不得自动删除作者文件或把提醒升级为构建失败。
- inbox 就绪报告必须逐篇隔离错误、真实派生媒体候选并识别目标/共享源冲突；无论 ready、scheduled 或 blocked 都不能移动、改写、提交或推送作者文件。
- Studio 新建/复制条目的顶层 slug 在首次保存前可编辑；已有条目必须以 readOnly 控件锁定并继续序列化，身份漂移必须在保存前失败。
- Studio 本地图片进入 Decap 草稿前必须通过与公开媒体策略一致的真实格式、尺寸、体积和动图总像素预检；预检通过后必须透传原始 `File`，不能悄悄改变附件字节。
- Studio 条目媒体必须由稳定 slug 与固定 Decap 文件名规则得到唯一目标；已发布清单不可用时失败关闭，同路径不同 SHA-256 必须明确确认后才能交给 Decap。
- Studio 会话媒体账本只能在合成 change 成功重放后登记；未提交检查、取消确认和重放错误不能改变同路径摘要基线。
- 同一 Studio file input 只有最新真实 change 可以报告最终状态、重放文件或提交账本；任何旧异步结果都不能清空或覆盖最新选择。
- Markdown 图片 alt 不能为空；本地图使用共享固有尺寸与响应式候选，HTTPS 外图不能进入开放优化主机列表。
- cover 必须是仓库内图片并同时声明 `coverAlt`；详情页尺寸只能来自已验证文件，文章/项目共享组件与社交元数据选择不能分叉。
- `/studio` 与 OAuth 永远不缓存、不索引，并维持同源 state 验证；只有版本化 CMS 运行时可不可变缓存。
- 发布平台不能成为写作前置条件；Obsidian 和 Git 提交在本地仍可完成。
- 每轮结构、设计、技术、功能、方法、验证、经验和风险必须与代码一起归档。
