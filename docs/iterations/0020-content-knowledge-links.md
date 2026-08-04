# Iteration 0020：内容知识链接与反向引用

## 1. 范围与成功标准

项目目标继续保持：作者不依赖 Codex，在 Obsidian 或网页 Studio 中完成写作；Markdown、附件、知识关系、版本和发布证据都归 Git 管理。本轮只解决上一轮确定的单一任务：把 Obsidian 内部笔记链接转换成稳定公开 URL，并由正文自动派生反向引用。

成功标准：支持 Wiki/Markdown 笔记链接、别名与标题锚点；外链和代码示例不误转换；缺失、歧义、块引用在发布前失败；公开内容目标不存在或尚未公开时构建失败；文章和项目详情页只在存在真实来源时显示反向引用；桌面与窄屏布局可读；不引入数据库或外部服务。

回滚边界是链接转换、关系索引、详情页 Reference ledger、真实内容交叉引用、测试与文档；不改 OAuth、部署平台或内容 schema。

## 2. 项目结构状态

- 仓库根目录继续是 Obsidian Vault，`content/inbox` 是草稿入口；
- `lib/obsidian-publishing.ts` 负责把 Obsidian 输入规范化为正式 Markdown；
- `lib/content/markdown.ts` 统一处理“代码之外的 Markdown 正文”，并抽取稳定站内链接；
- 新增 `lib/content/relations.ts`，从公开内容集合派生 outgoing/backlink 索引；
- `lib/content/index.ts` 暴露详情页反向引用查询；
- `build/validate-content.ts` 在 Next.js 配置阶段检查内容关系；
- `components/ContentViews.tsx` 与 `app/*/[slug]/page.tsx` 渲染引用账本；
- `tests/content-relations.test.mjs`、发布测试和生产 HTTP 测试共同覆盖转换、关系与页面结果；
- Next.js 16.3 开发服务器生成的 `AGENTS.md`/`CLAUDE.md` 保留为框架版本的本地开发提示，避免每次开发重新产生未跟踪文件。

## 3. 设计内容

Reference ledger 延续 Commit Trace / Evidence Rail 的工程档案语言，不使用通用推荐卡片。桌面结构为左侧引用说明与数量、右侧有序内容行；顶部粗规则建立章节边界，左侧信号色竖线强调“关系证据”，内容行继续使用编号、类型、日期、标题、摘要和状态。小于 55rem 时折叠为单列，小于 42rem 时内容行压缩为编号与正文两列。

页面没有关系时完全不渲染该区域，避免制造“0 条引用”的空装饰。它的语义是“哪些公开记录真正使用了当前判断”，不是相似度推荐，也不承诺完整知识图谱。

视觉沿用已有 token：深色纸面、`--ink` 主文字、`--signal` 橙红信号、`--trace-dark` 蓝绿关系线、Display/Body/Mono 三层字体。没有加入新颜色、圆角卡片或无数据支撑的指标。

## 4. 使用的技术

- TypeScript 与 Node.js：纯链接转换、目录扫描和类型化关系索引；
- `github-slugger`：Obsidian 标题片段与页面 `rehype-slug` 保持一致；
- Markdown/Wiki 链接解析：支持笔记、目录、别名、相对 `.md` 路径与标题片段；
- `Map`/`Set`：按稳定 URL 查找、去重和派生双向关系；
- React/Next.js App Router：服务端渲染文章与项目的引用账本；
- CSS Grid 与现有响应式 token：桌面双栏、窄屏单栏；
- Node test、TypeScript、ESLint、Next.js build、生产 HTTP 测试、真实浏览器；
- 语法依据：[Obsidian Internal links](https://obsidian.md/help/links) 与 [Embed files](https://obsidian.md/help/embeds)。Obsidian 支持 Wiki/Markdown 链接、路径、别名和标题链接；块引用因互操作性有限而在当前发布契约中拒绝。

## 5. 实现的功能

- `[[slug]]` 根据文章/项目文件名解析为稳定 URL；
- `[[slug#标题|显示文字]]` 转换别名并使用与页面一致的标题锚点；
- `[[posts/slug]]`、`[[projects/slug]]` 在同名时显式消除歧义；
- `[文字](../projects/slug.md)` 与 `content/posts/slug.md` 等 Markdown 路径转换；
- `[[#本文章节]]` 与 `[文字](#标题)` 保留为当前页面锚点；
- HTTP(S)、协议相对链接、行内代码和围栏代码示例保持原样；
- 缺失目标、文章/项目同名裸 slug、无法解码路径和 `#^block-id` 块引用产生可操作错误；
- 正式正文中的 `/posts/*`、`/projects/*` 链接生成 outgoing/backlink 索引，重复链接去重，自引用忽略；
- 公开内容指向不存在或未公开目标时阻断构建；
- 文章与项目详情页渲染 Reference ledger，并复用现有内容索引行；
- 可见链接质量测试开始爬取真实详情页，覆盖正文链接与反向引用链接；
- 现有博客文章与 MyBlog 项目加入真实交叉引用，使功能上线后有可验证内容而不是空实现。

## 6. 实现方法

发布器先完成附件转换，再处理内容链接，最后解析 frontmatter 和内容契约。目标注册表直接来自 `content/posts/*.md` 与 `content/projects/*.md` 文件名；裸 slug 通过唯一性解析，显式集合路径直接查找。标题片段先 URL 解码，再由共享 `markdownHeadingAnchor` 转换，因此发布结果和渲染锚点使用同一算法。

`transformMarkdownProse` 把正文分成围栏代码和普通段落，再把普通段落分成行内代码与可转换文本。附件转换、链接转换和关系抽取共用这一边界，避免在三个功能中各自实现略有差异的代码跳过规则。

公开关系不写回 frontmatter。内容加载完成并过滤草稿/未来记录后，以 URL 为键建立目标表，扫描正文稳定链接并生成两个索引。页面只消费 `backlinksByUrl`；outgoing 索引保留给未来的知识导航，但目前不扩展 UI。按发布时间倒序、中文标题顺序得到稳定输出。

## 7. 验证证据

- 首轮专项测试发现 `relations.ts` 在 Node strip-types ESM 测试中缺少显式 `.ts` 扩展；修正后模块正常加载；
- 第二轮专项测试发现断言没有遵循实现的同日中文标题排序；修正期望后 14/14 链接与 Obsidian 专项测试通过；
- 真实 `content:publish --check-only` 演练首次被未知 `Obsidian` 标签正确阻断，改用已登记 `TypeScript` 标签后通过，输出正式目标且附件为 0；临时草稿随后删除；
- `npm run typecheck` 与 `npm run lint` 独立通过；
- 最终 `npm run release:check` 通过：37/37 单元测试、TypeScript、Next.js 16.3.0 build（33 个静态生成任务）、15/15 生产 HTTP/质量测试，`npm audit --omit=dev --audit-level=high` 为 0；
- 真实浏览器桌面检查确认 Reference ledger 为 `240px + 832px` 双列、区域高度 252px；375px 内容视口下变为单列、内容行两列、无横向溢出；
- 浏览器真实点击引用条目后到达 `/projects/myblog`，项目页标题正确；开发模式仅出现公共 CSP 阻止 React 调试 `eval` 的提示，生产模式不使用该调试路径且生产 HTTP 测试无错误；
- 推送、GitHub Quality Gate、Vercel Production 和线上冒烟证据在交付验证后补入本文件。

## 8. 经验与教训

- Obsidian 链接的价值是作者输入自然，但公开存储应该收敛到可迁移的标准 Markdown URL；
- 关系应从真实正文派生。单独维护 backlinks/frontmatter 会产生第二事实源，最终必然漂移；
- “跳过代码”必须同时覆盖围栏代码和行内代码；共享文本边界比复制多个正则更可靠；
- 同名不是猜测问题。文章与项目 slug 相同时必须要求作者显式写集合路径；
- 标题链接可以跨工具互操作，块引用更专有；明确拒绝比生成站点无法兑现的 URL 更安全；
- 真实发布命令能发现单元测试之外的注册表治理边界；未知标签被阻断是契约成功，不是发布器故障；
- 浏览器导航等待模式可能超时，即使点击已经完成；失败后应读取实际 URL 与标题判断副作用，而不是重复点击；
- 全局复盘不仅看代码：早期内容里的“当前 Cloudflare/Vinext”已过时，内容新鲜度本身必须成为下一轮工程任务。

## 9. 全局状态、风险与未解决问题

公开阅读、内容契约、发现、Studio、Obsidian、附件、内部链接、反向引用、Git 自动生产、冒烟和回滚均为 done。内容知识网络从 pending 升级为可用的第一版：真实正文是关系源，详情页是回看入口。

剩余风险：公开早期文章和项目 Demo 尚未准确区分历史架构与当前 Vercel 架构；图片仍无体积/尺寸预算；块引用不支持；关系抽取只识别规范 `/posts/*` 与 `/projects/*`，这是有意收窄的正式契约；尚无全站图谱或 outgoing UI；Decap 开发依赖树的上游高危项仍需独立评估；自定义域名、统计和评论继续等待所有者选择。

## 10. 下一轮唯一主任务

刷新公开文章与 MyBlog 项目复盘的部署描述和时态：保留 Cloudflare/Vinext 的历史决策证据，同时增加明确的当前 Vercel 架构摘要，把项目 `demo` 改为当前生产站，并形成可测试的内容新鲜度规则。
