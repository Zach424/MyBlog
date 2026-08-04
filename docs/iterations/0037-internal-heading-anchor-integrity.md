# Iteration 0037：站内标题锚点完整性门禁

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex 即可从 Studio、Obsidian 或普通 Git 编辑器发布可维护的技术记录。Iteration 0036 已证明站内目标页面是否公开，但 `/posts/<slug>#fragment`、`/projects/<slug>#fragment` 与 `[[note#标题]]` 仍可能在标题改名、重复标题或编码错误后落到页面顶部而不报错。

本轮只闭合标题深链完整性：构建和 Obsidian 预检必须使用与 ReactMarkdown + `rehype-slug` 相同的 heading id，覆盖 H1–H6、Setext、中文/英文、URL 编码、重复标题、格式化标题、自引用、行内/引用式链接和代码忽略。坏 fragment 必须在生产前以来源路径和原 fragment 失败；关系账本继续按内容 URL 去重。不得引入浏览器爬取、客户端修复、模糊匹配或第二份手工锚点索引。

## 2. 项目结构状态

- `lib/content/markdown.ts`：共享 GFM AST、heading inventory、fragment 解码及行内/引用式/自引用站内链接抽取；
- `lib/content/relations.ts`：为全部公开内容建立 heading id 集合，在 outgoing/backlinks 派生前校验目标页面与 fragment；
- `lib/obsidian-publishing.ts`：转换 Wiki/Markdown 链接后，对当前草稿和已有目标正文执行同一锚点预检；
- `scripts/publish-note.mjs`、`lib/content/inbox-readiness.ts`：把已有正式内容正文传入单篇 `--check-only` 与全 inbox readiness；
- `tests/content-relations.test.mjs`、`tests/obsidian-publishing.test.mjs`：冻结渲染 slug、抽取、编码、重复、自引用和发布拒绝契约；
- README、架构、内容模型、质量与发布手册：同步作者行为和失败边界；
- `docs/STATUS.md`、`ROADMAP.md` 与本文件：仓库根 Obsidian Vault 的全局状态、经验和下一主线归档。

## 3. 设计内容

标题 id 不是“标题文本转小写”这么简单。`rehype-slug` 会按文档中所有 H1–H6 的顺序复用一个 GitHubSlugger；即使目录只显示 H2/H3，前面的 H1 或中间的 H4 也会占用重复序号。标题中的强调、链接和行内代码贡献可见文本，图片和原始 HTML 节点不贡献 HAST 文本。门禁因此先建立整篇 heading inventory，再从中筛选目录；目录不再自己维护一套近似正则。

fragment 代表作者声明的精确公开地址。百分号编码可以严格解码，除此之外不改变大小写、不重新 slug、不猜测近似标题。重复标题必须显式使用真实的 `-1`、`-2` 序号。自引用同样先校验再从关系图中排除，避免“不会生成 backlink”被误解成“无需正确”。

## 4. 使用的技术

- `mdast-util-from-markdown`、`micromark-extension-gfm`、`mdast-util-gfm`：与 `remark-gfm` 一致解析标题、行内链接、引用式链接和定义；
- `github-slugger`：复现 `rehype-slug` 的全局重复标题序号；
- ReactMarkdown + `remark-gfm` + `rehype-slug` + React server render：以真实 HTML 对照 heading inventory，而不是只相信自建算法；
- TypeScript 联合类型：显式区分 post/project 引用与只有 fragment 的 self 引用；
- ContentValidationError、Node test、ESLint、TypeScript、Next 生产构建、GitHub Actions、Vercel 与稳定域名冒烟；
- research-iteration-loop skill 将本轮固定为一个可验证的深链纵切，并在提交前做全局风险复盘。

## 5. 实现的功能

- heading inventory 覆盖 H1–H6、ATX/Setext、格式化文字、行内代码、图片忽略、原始 HTML 忽略与跨层级重复标题；
- H2/H3 目录从完整 inventory 筛选，id 会正确考虑 H1/H4/H5/H6 已占用的重复序号；
- 站内链接用 GFM AST 抽取，支持行内、引用式、`#fragment` 自引用和同一目标的多个不同 fragment；图片、行内代码、围栏代码和外链不参与；
- URL 编码的中文 fragment 可命中 Unicode id；坏编码、缺失标题和错误重复序号在构建前失败；
- `/posts|projects/<slug>#fragment` 与纯自引用使用同一校验，自引用不生成 outgoing/backlink；
- Obsidian Wiki 标题转换后的结果立即用正式目标正文校验，`--check-only` 和 inbox readiness 不再等待正式文件写入；
- 关系账本与知识地图仍只按目标内容 URL 去重，没有把 fragment 变成额外节点或边；
- 当前 4 条真实公开记录全部通过新门禁，无需修改作者正文。

## 6. 实现方法

Markdown 只解析一次 GFM mdast。第一遍收集 definition，第二遍访问 `link` 与 `linkReference`；AST 结构天然排除 image/code。引用键使用 `URL + fragment`，所以同一目标的页面链接与多个章节链接都保留供校验，关系层再用 `Set<ContentRecord>` 去重目标。纯 `#fragment` 使用独立 self 联合成员，不伪造 slug 或 URL。

heading walker 按树顺序访问所有 heading。文本函数只拼接会成为 HAST text 的 mdast `text`/`inlineCode` 与容器后代，显式跳过 image、imageReference、html 和 break；同一 GithubSlugger 为整篇文档分配 id。真实服务端渲染对照夹具得到 `duplicate`、`duplicate-1`、`duplicate-2`、`duplicate-3` 等完全相同序列，也验证图片产生的双空格会保留为双连字符，而不是被“清理”成另一地址。

关系层先为每个公开 URL 建 `Set<heading.id>`。引用目标存在后，fragment 用 `decodeURIComponent` 严格解码并精确查集合；异常分别报告“无效 URL 编码”或“标题锚点不存在”，保留原目标和 fragment。Obsidian 目标增加可选正文，真实 CLI 与 inbox report 都读取正式 Markdown；兼容纯函数调用的旧夹具仍可只提供 kind/slug，但生产入口始终携带正文。

## 7. 验证证据

- 专项目标测试：25/25 通过，覆盖关系、heading、Obsidian、inbox、真实发布事务和失败回滚；
- 实际 ReactMarkdown + `rehype-slug` 服务端对照：8 个跨 H1–H6/Setext/格式化/图片/重复标题 id 与 inventory 逐项相等；
- 完整 `npm run release:check`：配置完整、Current 1/Historical 3/未公开 0、inbox 0、根暂存媒体 0、正文外链 1 URL/1 occurrence/0 issue；
- 同一实现候选通过 ESLint、110/110 单元测试、TypeScript、36/36 构建页面、17/17 真实生产 HTTP/质量测试；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- 编码夹具覆盖中文百分号编码与坏 UTF-8；重复标题覆盖正确/错误后缀；深度覆盖 H1–H6；链接覆盖行内、引用式、自引用、图片/代码忽略；
- 实现提交 `001ba54921fa04e1dd326af3e0cdaf5a0d2f16f0` 已推送 `main`；GitHub Quality Gate `30947662958` completed/success；
- GitHub Production deployment `5750975153` state=success（`https://blog-kz70avzuv-czq1.vercel.app`）；`Verify Vercel production` `30947708431` 精确绑定实现 SHA 且 completed/success；
- 稳定生产域名独立冒烟：`24 routes, OAuth 302`；代理只在本轮网络命令进程内设置，未写入仓库或永久配置。

失败与修复证据：原目录算法只扫描 H2/H3 并单独编号，无法知道同名 H1/H4 已占用序号；站内链接正则又以 URL 为键，第一条带 fragment 的引用会吞掉同一目标后续 fragment。实现改为完整 AST inventory、`URL + fragment` 键和关系层 URL 去重，既保持知识图语义又不丢深链校验。第一次启动完整 `release:check` 时执行器的 1 秒调用超时主动终止了命令，没有产生代码或仓库变更；随后用完整 10 分钟上限重新执行并一次通过。

## 8. 经验与教训

- 目录显示层级不等于 slug 分配层级；只扫描 H2/H3 会与真实 DOM 漂移；
- 校验算法应复现渲染数据流而非清洗后的“看起来一样”文本，图片 alt、原始 HTML和连续空格都会改变结果；
- 关系去重与引用校验是两个粒度：前者按内容 URL，后者必须保留每个 fragment；
- 自引用不生成图边，但仍是读者会点击的地址，必须校验；
- 引用式 Markdown 是 GFM 的正式能力，正则只覆盖行内语法会制造隐蔽盲区；
- Obsidian `--check-only` 若不读取目标正文，只能证明转换格式正确，不能证明发布结果可导航；
- 严格失败比模糊修复更适合永久链接：标题变化应触发作者同步更新，而不是让客户端悄悄猜测。

## 9. 全局状态、风险与未解决问题

公开阅读、站内页面/标题完整性、详情页引用、知识地图、正文外链库存、双作者入口、内容/媒体/永久 URL 契约、维护报告、自动交付与恢复均可用。作者现在能在 Obsidian 预检时发现错误标题，所有入口最终还会由构建门再次验证。

剩余主要风险：标题改名或重复标题顺序变化会按设计要求同步深链；块引用仍不支持；结构化 `repository`/`demo`/`canonical` 尚未进入正文外链库存的统一视图；知识地图扩容、Studio 同名附件、Git 媒体历史、Decap 固定 bundle/开发依赖审计、宽 OAuth scope、CSP 例外、Hobby 回滚、自定义域名、统计、评论和外部提醒保持既有状态。

## 10. 下一轮唯一主任务

把 frontmatter 的 `repository`、`demo` 与 `canonical` 结构化 HTTPS 端点纳入现有外链库存。库存 occurrence 必须标明 `body` 或具体字段名，并与正文相同 URL 确定性聚合；显式健康检查必须直接复用现有 URL 规范化、公网 DNS、固定地址 HEAD、重定向、超时和状态分类。schema 继续承担必填/HTTPS 合法性，报告只补维护证据；不得创建第二个检查器、把实时结果写回 Markdown、把网络波动接入默认构建硬门或新增云服务。
