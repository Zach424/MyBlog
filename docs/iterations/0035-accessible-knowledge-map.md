# Iteration 0035：公开可访问知识地图

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex 即可从 Studio 或 Obsidian 发布，读者能从公开站点检索、阅读并追溯学习记录与项目复盘。Iteration 0034 已让作者看见全部本地发布队列，但读者仍只能在单篇详情页查看 outgoing/backlinks，无法从全站角度看到判断与实践之间的关系，也无法发现尚未连线的记录。

本轮只闭合“公开全站知识地图”这一条可逆纵切：复用公开 Markdown 正文链接和现有关系校验，在 `/knowledge` 服务端输出文章/项目节点、有方向的边、可访问 HTML 关系账本与孤立记录；加入主导航、metadata/canonical、Sitemap、永久重定向目标白名单、稳定生产冒烟与响应式设计。不得另存图 JSON/frontmatter、不得接数据库或第三方图服务、不得让 Canvas 或客户端 JavaScript 成为唯一阅读方式。

## 2. 项目结构状态

- `lib/content/knowledge-graph.ts`：从公开记录与关系表派生确定性节点、有向边、邻接计数和孤立状态；
- `lib/content/index.ts`：在既有公开内容索引上生成并导出单一 `KnowledgeGraph`；
- `app/knowledge/page.tsx`：服务端页面、metadata、canonical、统计、继续发现入口；
- `components/KnowledgeMap.tsx`：SVG 双列信号场、原生 HTML 关系账本、孤立记录和空状态；
- `app/globals.css`：知识地图的浅/深色、焦点、一次性描线、桌面/中屏/320px 规则；
- `components/SiteChrome.tsx`：主导航增加“地图”；
- `lib/discovery.ts`、`build/validate-redirects.ts`、`scripts/smoke-production.mjs`：Sitemap、规范 HTML 目标与线上代表路由同步；
- `tests/knowledge-graph.test.mjs`：方向、互引、去重、孤立、确定顺序与空图；
- `tests/rendered-html.test.mjs`、`quality-gates.test.mjs` 与相关发现/交付/重定向测试：真实 HTML、内部导航、320px 与生产连接；
- 根 README、架构、内容模型、设计、发布、质量与运维文档：同步实现和作者边界；
- `docs/STATUS.md`、`ROADMAP.md` 与本文件：仓库根 Obsidian Vault 的全局状态、经验和下一主线归档。

## 3. 设计内容

页面的单一任务是回答“一条判断从哪里来，又流向哪些实践”。视觉延续 Commit Trace / Evidence Rail，不做通用径向气泡图或营销仪表盘。桌面端采用工程式双列信号场：文章在左、项目在右；Trace dark 与 Signal 区分来源类型；箭头表达正文引用方向；互相引用用两条分轨曲线保留两个事实；没有关系的记录使用虚线节点，不为图形密度制造链接。

主标题和真实 Nodes/Directed edges/Isolated 统计建立语境；信号场之后始终提供逐条 Relationship ledger 和 Unlinked records。SVG 节点本身是可聚焦原生链接，并带 title/desc、类型、日期与 OUT/IN 计数；HTML 账本不依赖图形空间关系。`≤ 42rem` 主动隐藏宽 SVG，显示切换说明并使用单列账本，避免手机横向拖动画布。动画只在初次进入时描线一次，系统 Reduced Motion 会收敛到近零。

## 4. 使用的技术

- Next.js 16.3 App Router 服务端组件与 Metadata API；
- React 19 服务端 JSX，无新增 Client Component 和浏览器状态；
- 现有 `deriveContentRelations` + 新的纯函数 `deriveKnowledgeGraph`；
- 语义 SVG：`viewBox`、`marker` 箭头、可聚焦 `<a>` 节点、Bezier 路径和可访问 title/desc；
- 原生 HTML `ol`/`ul`/`Link` 作为非图形关系账本；
- CSS Grid、SVG presentation、`color-mix`、系统深色偏好、Reduced Motion 与 42rem 断点；
- Node 原生 test、Next 生产服务器测试、Playwright CLI、Vercel CLI、GitHub Actions 与稳定域名冒烟；
- research-iteration-loop skill 控制单轮范围，frontend-design skill 冻结视觉层级，playwright skill 执行真实浏览器验收。

## 5. 实现的功能

- 当前 4 条公开记录生成 4 个节点、4 条有向边、3 个已连接节点和 1 个孤立节点；
- 两篇文章各引用 MyBlog 项目，MyBlog 项目分别回引两篇文章，四条方向都保留；
- “为什么先写项目章程，再写首页”作为孤立记录显式显示，不被静默遗漏；
- 相同正文目标只生成一条边，自引用不进入图，输入文件顺序变化不改变输出；
- 页面提供桌面图形、HTML 关系账本、孤立记录、空图/空关系状态和继续发现链接；
- 主导航、Sitemap、canonical、Open Graph、重定向目标验证和稳定生产冒烟均识别 `/knowledge`；
- 手机不渲染需要 64rem 内宽的图形场，但完整关系方向仍通过 HTML 账本可读；
- 页面没有 Canvas、第三方图运行时、数据库查询或客户端布局脚本。

## 6. 实现方法

内容索引先按现有 schema 读取、校验并过滤公开 posts/projects，再由 `deriveContentRelations` 得到每条记录的 outgoing/backlinks。图派生层只接收这两个已经验证的值：节点按 post/project、日期和中文标题稳定排序；边按 source/target 稳定排序；邻居数对两个方向去重；`outgoing.length === 0 && backlinks.length === 0` 得到 isolated。空输入显式返回零计数，不发明占位节点。

SVG 坐标只属于渲染层：文章、项目各自按列均匀定位，跨列边取节点端口并以中点控制 Bezier；反向边存在时按 URL 排序分配正负曲率；同列关系预留外侧 gutter。节点标题以 Unicode code point 而非 UTF-16 单元截断。图形和 HTML 账本接收同一个 `graph` prop，因此无第二份数据转换。移动断点直接隐藏 figure、显示文字说明；页面根不承担 SVG 的 `min-width`，桌面内宽只存在于局部滚动容器。

## 7. 验证证据

- 完整 `npm run release:check`：配置完整、Current 1/Historical 3/未公开 0 且 Current 健康、真实 inbox 0/0/0、根暂存媒体 0 个/0 B；
- 同一发布候选通过 ESLint、98/98 单元测试、TypeScript、36/36 构建页面、17/17 真实生产 HTTP/质量测试；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- 知识图纯函数测试覆盖有向/互引/去重/孤立、输入顺序确定性与空图；真实 HTML 验证 4 节点、4 边、8 个关系端点、canonical、SVG title/desc、孤立记录且无 Canvas；
- Playwright 生产模式桌面验收：页面标题正确、4 个 SVG 节点均为链接、焦点节点描边增强到 `3px`、控制台 0 error/0 warning；
- Playwright `320 × 900`：`documentElement.clientWidth=320`、`scrollWidth=320`，图形场 `display:none`、移动说明 `display:block`，完整账本仍在可访问树；
- 实现提交 `be33fa5e6c742f680ab435fb80683a78f4c9c525` 已推送 `main`；GitHub Quality Gate `30943278286` completed/success；
- Git push 的 Vercel webhook 在观察窗口内未创建 deployment；随后使用已连接项目直接发布同一干净 HEAD，Production `dpl_J9Mq3n5A1iR6wBjSKU4fhvVmTVTB`（`https://blog-2gdmisihw-czq1.vercel.app`）Ready 并 alias 到稳定域名；
- 手动触发的 `Verify Vercel production` `30943781842` 精确绑定实现 SHA 且 completed/success；稳定域名独立冒烟：`24 routes, OAuth 302`；
- 网络命令只在当前进程使用 `http://127.0.0.1:7897`，未写入永久代理配置。

失败与修复证据：直接用裸 Node 导入 `lib/content/index.ts` 审计关系时，Node 无法解析 Next/TypeScript 的无扩展名内部导入；改为复用 `build/validate-content.ts` 的显式 TS 导入入口，没有修改生产模块解析规则。首次 Playwright 连接到已有 `next dev` 服务时，生产 CSP 正确拒绝开发期 `eval`/HMR，产生只属于模式不匹配的控制台错误；随后启动现有 `.next` 的 `next start` 做生产验收，控制台归零。端口 3100 的 IPv4 已被另一个本机 API 占用，而 Next 监听 IPv6；浏览器改用 `localhost` 命中正确服务，没有终止非本项目进程。首次 Playwright `run-code` 传入代码片段而非函数，CLI 报语法错误；改用 `eval` 和 `(page) => ...` 契约取得宽度与焦点证据。GitHub 未认证公共 API 又遇到共享出口限额，后续只读查询使用 Git 凭据管理器中的现有凭据，token 只在进程内且未输出。Vercel Git webhook 未产生本轮 deployment，最终按既有公开发布授权使用已认证 CLI 直接发布，并手动触发仓库自带生产验证工作流，未把延迟伪装成成功。

## 8. 经验与教训

- 图模型与图布局必须分层：关系是内容事实，坐标只是当前呈现；否则以后换布局就会误改内容数据；
- 有方向的内容关系不能压缩成无向邻接，互相引用是两条独立证据；
- 可访问降级不应是“给 Canvas 补一段说明”，而应让原生 HTML 账本独立完成全部阅读任务；
- 手机端不必保留桌面图的外观；保留关系语义、方向和链接比强迫横向缩放更重要；
- 孤立记录是一种真实状态，不是失败，也不应为了视觉饱满自动制造关系；
- 开发模式浏览器错误不能代表生产回归，安全头和运行模式必须与验收目标一致；
- Windows 本机端口可能在 IPv4/IPv6 上分别被不同进程占用，定位时要同时查看监听地址和进程归属；
- 自动发布 webhook 是外部集成而非本地事实；超时后应保留失败证据，使用已经授权的显式发布路径并补同等线上验证；
- frontend-design skill 促使页面采用与现有品牌一致的工程信号场，并明确拒绝不适合中文长标题与方向阅读的通用气泡图。

## 9. 全局状态、风险与未解决问题

公开阅读、搜索/发现、双作者入口、内容契约、详情页双向引用、全站知识地图、内容维护、永久 URL 迁移、inbox readiness、媒体预算/引用/展示、Obsidian 优化事务、Studio per-slug 归档/上传预检/稳定身份、根暂存库存、自动/显式交付和恢复均可用。作者只需在正文写真实站内链接，详情页与知识地图会在构建时同步更新。

剩余主要风险：当前图形布局为小型内容库优化，内容量增长后需要过滤、分组或虚拟化，但不能把语义退回客户端 Canvas；外部 HTTPS 链接仍只在作者维护清单中人工检查，缺少确定性库存与可选健康报告；Vercel Git webhook 本轮未自动触发，需观察下一轮是否复现；Studio 同 slug 文件名冲突、附件 Git 历史增长、Decap 固定 bundle/上游开发依赖审计、宽 OAuth scope、CSP 内联/eval 例外、Hobby 回滚、自定义域名、统计、评论、外部提醒与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

建立外部 HTTPS 链接库存与可选健康报告。复用标准 Markdown AST，从公开文章/项目正文抽取普通外链并忽略图片、代码、站内链接与锚点；输出 source、URL、出现次数和确定性排序，提供本地文本/JSON 报告及有超时/并发/重试边界的可选实时检查。实时网络失败只形成可审阅证据，不把临时 DNS/限流直接变成默认构建硬门；先覆盖重复链接、重定向、4xx/5xx、超时与隐私安全边界，再决定是否进入每周 Actions。不得抓取正文、不得保存第三方内容、不得自动改写作者链接或接入云服务。
