# Iteration 0033：永久重定向注册表

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex，即可从网页 Studio 或 Obsidian 发布学习记录和项目复盘，内容、附件、路由历史与回滚证据都进入 Git，并由 `main` 自动交付到 Vercel。Iteration 0031 已锁定 Studio 中既有内容的 slug，但真正迁移仍只能靠文档提醒作者“记得建立重定向”；仓库没有可执行的旧 URL 契约，改名可能直接制造外链和搜索索引 404。

本轮只闭合“版本化永久重定向”这一条纵切：用仓库数据声明旧路径到当前公开页面；在 Next 配置加载时验证来源、目标、日期与关系；输出原生永久 308；用真实本地进程和稳定生产域名证明单跳行为。不得自动猜测迁移、不得依赖 Vercel/Cloudflare 控制台、不得建立第二份内容身份源，也不在本轮改造 Studio 或 Obsidian 写作界面。

## 2. 项目结构状态

- `content/redirects.yml`：`version: 1` 的 Git 版本化重定向事实源，首条规则为 `/blog -> /posts`；
- `lib/redirects.ts`：严格 YAML/Zod schema、精确路径、日期、来源冲突、目标、重复、单跳和环路不变量；
- `build/validate-redirects.ts`：读取当前内容仓库，派生公开 HTML 路由，并盘点运维路由与 `public` 静态文件；
- `next.config.ts`：与内容/媒体门禁并行加载验证后的规则，通过 `redirects()` 交给 Next；
- `tests/redirect-registry.test.mjs`：注册表语法和全部关系边界的 8 项单元测试；
- `tests/rendered-html.test.mjs`：真实 Next 生产进程中的 308、查询参数透传和目标 200；
- `scripts/smoke-production.mjs`：稳定生产域名上的状态、同源目标和单跳检查；
- `README.md`、`docs/ARCHITECTURE.md`、`CONTENT_MODEL.md`、`PUBLISHING.md`、`QUALITY.md`、`OPERATIONS.md`：同步设计、迁移步骤、质量与回滚手册；
- `docs/STATUS.md`、`ROADMAP.md` 与本文件：仓库根 Obsidian Vault 的状态、经验和后续主线归档。

## 3. 设计内容

这是路由与作者运维设计，不新增公开视觉组件。数据文件刻意保持可人工审阅：一条规则只有旧地址、最终地址、加入日期和原因；永久状态统一由系统决定，不让每条记录重复填写 308。原因最少 8 个字符，避免注册表退化成无法复盘的路径对照表。

对外行为遵守“一个旧地址、一次跳转、一个当前页面”。来源是已经不再占用的历史地址，不能遮蔽首页、集合、内容详情、专题、标签、公开静态文件、Studio、API、上传附件或 Next 内部资源；目标只允许同一次构建中可见的 HTML 页面。多个历史来源可以汇聚到同一规范页，但不能把旧地址串联成链。旧地址不加入 Sitemap，查询参数由 Next 原生保留。

## 4. 使用的技术

- Next.js 16.3.0 `next.config.ts` `redirects()`：`permanent: true` 输出 308；
- `yaml` 2.9.0 `parseDocument`：拒绝重复键、解析错误和别名扩张；
- Zod 4.4.3 strict schema：版本、字段、长度与数量上限；
- Node.js `fs/promises`：递归盘点 `public` 文件并读取注册表；
- 现有内容 contract：按冻结的 `CONTENT_BUILD_DATE` 过滤草稿和未来内容，派生文章、项目、专题和标签 URL；
- 图关系遍历：在目标存在性检查前识别环路，再拒绝任何 destination 仍是 source 的多跳链；
- Node test、真实 Next 生产进程、GitHub Actions、Vercel deployment status 与稳定域名生产冒烟。

实现前完整阅读仓库内 Next 16 随包文档的 `next.config.js redirects` 与 redirecting guide，确认配置规则在文件系统路由前运行、`permanent: true` 为 308、查询参数透传以及平台规则数量限制。本轮因此把注册表上限设为 1000，低于 Vercel 1024 条限制，并只使用静态精确规则。

## 5. 实现的功能

- `content/redirects.yml` 成为旧公开 URL 的唯一版本化注册表；
- 每条规则必须包含 `source`、`destination`、`addedAt`、`reason`，未知字段和重复 YAML 键失败；
- 路径只能是小写 ASCII 精确绝对路径，拒绝查询、锚点、百分号编码、参数、通配符、尾斜杠、`.`/`..` 段和大写；
- `addedAt` 必须是真实日期且不能晚于冻结的构建日期；
- source 不能覆盖当前 HTML 路由、运维路由、任何 `public` 文件或 `/_next`、`/api`、`/studio`、`/uploads` 命名空间；
- destination 必须是当前已公开 HTML 页面，草稿、未来内容、缺失页面、Feed、静态文件和后台端点均失败；
- 重复 source、自跳转、链式跳转和循环在构建前失败；多个旧来源可以直达同一最终页面；
- 规则按 source 排序后转换为 Next 永久重定向；
- 真实本地请求证明 `/blog?from=legacy` 返回 308、`Location` 为 `/posts?from=legacy`，目标一次请求返回 200；
- 生产冒烟固定验证 `/blog` 的 308、同源 `/posts` 和单跳 200。

## 6. 实现方法

解析分两层完成：YAML 层负责拒绝语法错误、重复键和别名，Zod 层负责拒绝未知字段、错误版本、弱原因和超过 1000 条规则。语义层先验证日期与精确路径，再建立 `source -> rule` Map。所有 source 收集完毕后先沿映射遍历检测环路，随后拒绝 destination 仍在 source 集合中的链，最后核对 destination 是否属于公开 HTML 集合；这个顺序使环路报告不会被“目标不存在”掩盖。

构建适配层复用现有内容加载器和 `isPublished`，以同一个冻结日期生成文章、项目、专题、标签与七个静态 HTML 入口。Studio、OAuth、Feed、Sitemap 等显式列为运维路由；`public` 目录递归盘点成精确 URL，所以未来增加静态文件也不会被旧规则无意遮蔽。校验与现有三个构建门并行执行，只有验证后的纯 `{ source, destination, permanent: true }` 进入 Next 配置。

测试分三层：纯注册表测试穷举失败边界；现有生产测试器启动真实 `next start` 验证框架行为和查询透传；生产冒烟对稳定域名手动禁用自动跟随，先检查 308 与 Location，再单独请求目标以证明只有一跳。这避免只验证纯函数，却漏掉 Next/Vercel 的实际路由语义。

## 7. 验证证据

- 专项 redirect 与 deployment 测试：10/10 通过；选定文件 ESLint 与 TypeScript 通过；
- 真实本地 Next 构建成功，35/35 页面生成；生产 HTTP/质量测试 16/16 通过；
- 完整 `npm run check`：ESLint、90/90 单元测试、TypeScript、35 个构建页面、16/16 真实 HTTP 测试全部通过；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- `check-release-config.mjs`：Release configuration is complete；内容维护报告 Current 1、Historical 3、未公开 0，Current 健康；
- `npm run media:staging -- --date 2026-08-05`：根暂存 0 个 / 0 B，引用、共享、未引用、陈旧、缺失均为 0；
- 实现提交 `628fc9f94f7a035c74a3cc693e1cd3be5b0fc75e` 已推送 `main`；GitHub Quality Gate `30938734018` completed/success；
- GitHub Production deployment `5749330934` 精确绑定实现提交且 state=success；`Verify Vercel production` `30938771248` completed/success；
- 稳定域名 `https://blog-iota-five-59.vercel.app` 独立冒烟：`23 routes, OAuth 302`，其中 `/blog` 为同源 `/posts` 的单跳 308；
- 网络命令只在当前进程使用 `http://127.0.0.1:7897`，未写入永久代理配置。

失败与修复证据：第一版校验先执行通用路径正则，导致 `/_next/...` 虽然被拒绝，却给出泛化的“非精确路径”消息；调整为先检查保留命名空间后，作者能直接知道不能占用系统路由。第一次线上只读轮询把 PowerShell `foreach` 直接接到管道，解析器报 `An empty pipe element is not allowed`；改为显式结果数组后正常取得 Actions 和 deployment 状态，错误发生在本地查询解析阶段，没有改动仓库或外部状态。`build/` 目录被仓库 ESLint ignore 规则忽略，因此专项直接 lint 出现提示；该文件仍由 TypeScript、真实构建和完整运行测试覆盖，没有通过修改 ignore 范围扩大本轮任务。

## 8. 经验与教训

- URL 兼容性是内容数据的一部分，应与 Markdown 同版本、同评审、同回滚，而不是藏在托管平台控制台；
- “目标存在”必须按当前公开集合判断，文件存在并不等于读者当前可访问，草稿和未来内容不能成为迁移终点；
- 重定向冲突不仅是页面冲突，静态图片、Feed、后台和框架内部路径同样需要保护；
- 单跳约束比自动解析链更容易审计，也避免搜索引擎、缓存和读者多付一次往返；
- 环路需要在一般目标检查前识别，否则真正的配置关系错误会被较弱的缺失目标提示掩盖；
- 纯函数测试不能证明框架最终状态码、Location 或查询参数语义，必须启动生产模式的真实 HTTP 服务；
- 生产冒烟应禁用自动跳转，分别检查源和目标，否则 fetch 自动跟随后只看到最终 200，会把失效的 301/302/多跳当作成功；
- research-iteration-loop skill 使本轮保持在一个可回滚的 redirect 纵切内，没有混入 slug 自动迁移、云端规则或编辑器改造。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容契约、知识链接、内容维护、永久 URL 迁移、媒体预算/引用/展示、Obsidian 优化事务、Studio per-slug 归档/上传预检/稳定身份、根暂存库存、自动交付和恢复均可用。真正 slug 迁移现在已有可执行的 Git 路由历史，不再只靠手册约定。

剩余主要风险：迁移仍是需要作者审阅的多文件 Git 操作，注册表不自动推断且不支持通配参数；Obsidian 可逐篇 `--check-only`，但没有全部 inbox 草稿的发布就绪总览；本地未跟踪附件不会出现在 Actions；同 slug 文件名冲突仍由 Decap 与作者处理；附件增长会扩大 Git 历史；Decap 固定 bundle 契约/上游开发依赖审计、宽 OAuth scope、CSP 内联/eval 例外、Vercel deployment 保护/Hobby 回滚、自定义域名、统计、评论、外部提醒与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

建立 Obsidian inbox 发布就绪报告。用只读 CLI 一次扫描全部 `content/inbox/*.md`，逐篇给出推断内容类型、稳定 slug、目标路径、草稿/日期状态、附件源与优化产物摘要、目标冲突以及明确的 ready/blocked 原因。它必须复用真实发布器的解析和媒体 staging 逻辑，但不能移动附件、改写 Markdown、提交或推送；需要证明运行前后工作区逐字节不变，并明确本地未跟踪草稿不属于 GitHub Actions 可见范围。本轮不新增网页 dashboard、不接云端 API。
