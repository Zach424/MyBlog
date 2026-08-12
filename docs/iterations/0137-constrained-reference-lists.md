# Iteration 0137：受约束的参考资料清单

## 1. 范围与成功标准

本轮让作者在文章与项目中维护官方文档、论文、仓库和站内延伸阅读，同时继续以 Git Markdown 为唯一事实源。第一版只保存作者明确填写的可见名称、链接与短注，不抓取远程标题、摘要、favicon 或可用性状态，不引入数据库、书签服务或 Cloudflare。

成功标准：

1. 使用可迁移、可直接在 Obsidian 和普通编辑器中阅读的 Markdown；
2. 清单标题、条目数量、可见名称、目标、短注、重复链接和单篇总量均有严格预算；
3. Studio 提供可增删和排序的结构化组件，Obsidian 提供一键模板；
4. 阅读端清楚区分站内与站外来源，移动端无横向溢出，打印时保留显式 URL；
5. 搜索保留人类语义，站内目标继续进入知识关系，HTTPS 目标继续进入外链库存；
6. 内容构建、Studio 字段预检、作者预览和生产 smoke 共用同一契约；
7. 不访问远程资源来补全或决定内容能否构建。

## 2. 项目结构状态

本轮新增：

- `lib/markdown-references.ts`：参考资料 mdast 抽取、严格校验、HAST 阅读投影和搜索降级；
- `studio/references-editor.mjs`：Decap `myblog-references` 结构化 editor component；
- `app/studio/references-editor.mjs/route.ts`：显式同源 Studio 资源路由；
- `tests/markdown-references.test.mjs`、`tests/studio-references-editor.test.mjs`；
- 本档案与 `docs/knowledge/0137-links-are-maintained-evidence.md`。

本轮修改内容契约、Markdown 管线、搜索、Studio 静态资源/配置/预览/样式、Obsidian 发布器模板命令、作者环境版本联锁、生产 smoke 和质量门。归档时继续保留用户自己的 `README.md`、`docs/README.md` 修改，以及三个 `docs/*_CURRENT.md` 新文件；它们未被本轮暂存或提交。

## 3. 设计内容

视觉采用“引用索引脊柱”：清单不是通用圆角卡片，而是一段有序的 Source Index。顶部 Evidence Rail 同时显示资料数量与 `HTTPS + LOCAL · STATIC`；左侧固定两位序号形成索引脊柱，右侧依次呈现可见名称、来源域名或“本站”以及作者短注。390 px 下来源标签转入名称下方，仍保持顺序与边界。

打印时每条资料不跨页，并把目标 URL 作为独立文字显式输出一次；屏幕阅读时 URL 隐藏，避免视觉噪声。该方向由 `frontend-design` skill 收敛为“来源索引 + 证据层级”，使参考资料与正文、Callout 和普通链接有明确职责差异。

## 4. 使用的技术

- Next.js 16.3、React 19、TypeScript 5、Node.js 22+；
- unified、remark-gfm、mdast、remark-rehype 与 HAST；
- Decap CMS 3.14.1 custom editor component 与嵌套 list widget；
- Obsidian Publisher 1.47.0、命令模板、三方版本联锁与 3/3 SHA-256 bundle；
- 既有站内关系/知识图谱与离线 HTTPS 外链库存；
- CSS Grid、打印媒体查询、桌面与 390 px 响应式布局；
- Node test、ESLint、TypeScript、Next production build/application tests、Playwright CLI；
- Vercel 原生交付，不依赖 Cloudflare。

语法选择遵循 [CommonMark 块引用和列表结构](https://spec.commonmark.org/0.31.2/)，作者组件使用 [Decap 自定义 editor component](https://decapcms.org/docs/customization/)。链接文案要能脱离上下文理解，参考 [MDN 对 `<a>` 可访问名称的说明](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/a)；站外链接继续由统一阅读组件提供新上下文与 `noopener` 防护，依据 [MDN `rel=noopener`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/noopener)。

## 5. 实现的功能

1. 识别顶层 `[!references]` 块和紧随其后的有序紧凑列表；
2. 标题限制 1–120 字符；每组 2–12 条、每篇最多 3 组且总计不超过 24 条；
3. 每条必须以可见 Markdown 链接开头，名称限制 1–160 字符；
4. 目标只接受无凭据、默认端口的完整 HTTPS URL 或 `/` 开头的站内绝对路径，最长 2048 字符；拒绝协议相对地址、空白和未编码圆括号；
5. 可选短注必须使用精确 ` — ` 分隔，最多 240 字符；同一清单的规范化目标不能重复；
6. 非法结构通过内容解析和 Studio 条目预检返回中文正文行号；
7. Studio 提供标题与可增删、可排序的资料条目字段，可回填既有块；
8. `/studio/math-preview` 返回 `referenceListCount`、`referenceItemCount`，并输出 `REFERENCES / VERIFIED` 或 `NEEDS FIX`；
9. Obsidian 新增“插入参考资料清单模板”，插件升级到 1.47.0；
10. 阅读端输出语义 section、清单标题、稳定序号、站外 hostname/“本站”、可见名称和短注；
11. 搜索保留标题、可见名称和短注，不索引 `[!references]` marker 与目标 URL 噪声；
12. 站内链接自动复用现有目标/标题锚点校验和知识图谱，HTTPS 链接自动进入现有离线库存；
13. 打印保留每条显式 URL 一次，并抑制普通外链打印规则造成的重复；
14. 不抓取远程元数据、favicon 或实时状态，没有数据库或客户端书签状态。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!references] 延伸阅读
> 1. [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — 官方路由处理器说明。
> 2. [MyBlog 项目复盘](/projects/myblog) — 本站实现与演进记录。
```

mdast 层先只识别顶层候选，再验证 marker、紧凑有序列表、预算、每条首个链接、后续精确短注和 URL 包络。候选无标题、无列表或结构错误也会失败关闭，不会退化为普通 Callout。通过后，rehype 转换器把 blockquote 提升为带有命名标题的语义 section；该转换排在通用 Callout 之前，防止 `[!references]` 被提前消费。

同一抽取器向三个下游投影：站内链接继续由已有 content relation AST 读取，HTTPS 链接继续由已有 external inventory 读取，搜索则把 marker 替换为标题并删除短注分隔符。这样参考清单不创建第二套图谱、链接数据库或搜索源。

Studio 自定义组件只负责以结构化表单生成同一开放 Markdown；发布权威仍是服务端内容契约。Obsidian 命令只插入模板，不隐藏 URL 或创建插件专有数据。远程页面变化不参与构建，因此一次已审阅的 Git 提交可确定性重建。

## 7. 验证证据

- 参考资料定向测试：10/10；
- `npm run release:check`：122.6 秒内通过完整发布总门；
- 全量单测：612/612；Mermaid 独立测试：5/5；
- `npm run lint`、`npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，72 个生成页面/资源，新增 `/studio/references-editor.mjs`；
- `npm run test:app`：35/35，十三条 HTML 与十一个结构化发现端点预算全部 PASS；
- `npm audit --omit=dev --audit-level=high`：0 漏洞；
- 插件：`myblog-publisher@1.47.0 · 3/3 SHA-256 files`；
- 本地生产 smoke：27 条路由、OAuth 503（本地未配置）与合成参考资料预览通过；
- Playwright Studio：参考资料 editor 注册成功，浏览器控制台 0 error / 0 warning；
- Playwright 合成预览：`referenceListCount: 1`、`referenceItemCount: 2`、来源为 `nextjs.org` 与“本站”；桌面块 640 px、390 px 块 358 px，均无横向溢出；
- 截图：`output/playwright/iteration-0137-references-desktop.png`、`output/playwright/iteration-0137-references-mobile.png`；
- 功能提交 `2e2bfd6` 与归档提交 `5b6a24b` 已推送到 `origin/main`；稳定生产 `/studio/references-editor.mjs` 返回 200，并包含 `myblog-references` 注册代码（8897 B）；
- `npm run production:smoke -- https://blog-iota-five-59.vercel.app --expect-oauth`：27 条路由、GitHub OAuth 302、`referenceListCount: 1`、`referenceItemCount: 2`、Source Index HTML 与全部 HTML/发现资源预算通过。

以上证据证明受约束参考清单已经从开放 Markdown、作者入口、共享预览、阅读投影收敛到稳定生产。当前没有真实公开清单，因此生产证据仍是模块和合成预览，不冒充真实文章样本或外站长期可用性证明。

## 8. 经验与教训

1. 参考资料不是“正文末尾一堆裸 URL”，而是作者维护的标题、可见名称、目标和用途说明；
2. 可访问的链接文字必须在脱离周边句子时仍可理解，不能只写“这里”或“详情”；
3. 远程标题与 favicon 会把可重复构建变成网络快照，第一版应保存作者判断而不是抓取结果；
4. 特殊 Callout 的候选识别和转换顺序属于契约，不能让 malformed 块静默降级；
5. Studio 表单与服务端契约必须共享长度和 URL 边界，否则会产生“可编辑但不可发布”的漂移；
6. 打印 URL 要有唯一所有者；专用块输出来源后必须关闭普通外链伪元素，避免重复；
7. 站内与站外目标不需要新数据库：前者复用关系图，后者复用离线外链库存；
8. 搜索应该索引作者赋予资料的意义，而不是机器 URL；
9. 外链即时健康与内容事实不同，网络失败、限流或代理不能改变一次 Git 构建结果；
10. 合成预览能证明契约、语义和布局，不能证明远端链接永远可达。

## 9. 全局状态、风险与未解决问题

作者现在可从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、本地静音 MP4、多图画廊、技术表格、只读任务清单、本地 MP3 音频笔记和受约束参考资料清单。参考清单不依赖 Cloudflare、数据库、favicon 服务或远程元数据抓取。

当前公开内容没有真实参考清单。本轮证据覆盖语法、作者入口、构建、合成生产预览、搜索、站内关系、外链库存、桌面/移动布局与打印 CSS，不覆盖第一次真实 Decap workflow 编辑最大清单的效率，也不承诺外站长期可用。嵌套分类、BibTeX/DOI/ISBN 元数据、引用格式自动生成、网页快照、健康状态徽章和账号书签继续关闭。

## 10. 下一轮唯一主任务

建立受约束的步骤流程块：用可迁移 Markdown 表达有顺序的操作步骤、步骤标题、说明与可选验证结果，冻结单组/单篇预算、Studio/Obsidian 作者入口、搜索、窄屏和打印；不加入读者交互状态、流程数据库、提醒或外部任务系统。
