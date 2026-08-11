# Iteration 0133：受约束的多图画廊

## 1. 范围与成功标准

本轮把“多张图片排在一起”收敛为一类可迁移、可校验、可搜索、可打印的有序证据组。画廊服务项目步骤、前后对比和状态证据，不承担相册、营销轮播或灯箱浏览任务。

成功标准：

1. 作者使用 Obsidian 兼容 Callout 与标准 Markdown 图片列表表达画廊；
2. 每组 2–6 张、每篇最多 3 组、画廊图片合计最多 12 张；
3. 组标题、每张图片的 alt 与可见短标题全部必填；
4. 正式内容只能引用当前 slug 目录下的本地图片，Obsidian inbox 可先使用根暂存，由发布器归档改写；
5. Studio 提供可排序的结构化画廊组件，Obsidian 提供一条快捷插入命令；
6. 正文、Studio 预览、搜索、移动端和打印共用同一语义；
7. 读者端无画廊 JavaScript、灯箱、轮播、iframe 或第三方服务；
8. 图片继续复用 3 MiB、2560 px、真实格式和引用所有权门禁；
9. Obsidian 附件事务、失败回滚、sealed Git 交付和生产 smoke 都理解画廊用途；
10. 不改写既有公开文章来制造演示数据。

## 2. 项目结构状态

本轮新增：

- `lib/markdown-gallery.ts`：画廊抽取、语法/数量/路径校验、HAST 转换和纯文本降级；
- `studio/gallery-editor.mjs`：Decap `myblog-gallery` 自定义 editor component；
- `app/studio/gallery-editor.mjs/route.ts`：同源、`no-store` Studio 模块路由；
- `tests/markdown-gallery.test.mjs` 与 `tests/studio-gallery-editor.test.mjs`；
- 本文件与 `docs/knowledge/0133-gallery-is-an-ordered-evidence-contract.md`。

本轮修改：

- 共享 Markdown/rehype 管线、正文图片组件、搜索索引与内容契约；
- 正文和 Studio 的 Evidence Rail、响应式和打印 CSS；
- Studio 配置、模块注册、生产管线预览状态与质量门；
- Obsidian 附件用途、归档顺序、插入命令、readiness version 8 与插件 1.43.0；
- 插件 bundle 三文件摘要、生产 smoke 和完整单元/应用测试清单。

功能提交为 `619a604`。归档时工作区另有用户自己的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件；本轮没有覆盖、暂存或提交它们。

## 3. 设计内容

画廊继续使用 Commit Trace / Evidence Rail。顶部显示 `GALLERY / NN FRAMES`、`ORDERED · LOCAL` 与组标题；每张图片是一个编号帧，深色 4:3 舞台使用 `object-fit: contain` 保留完整图像，下方显示 `FRAME NN`、短标题和详细说明。

桌面使用两列接触表，列间只保留一条规则线；`32rem` 以下变为单列，信息顺序不变。没有左右箭头、圆点分页、缩略图导航、手势库、自动播放或放大遮罩。打印保持两列并避免单帧内部跨页，图像舞台切换为浅色可打印背景。

信息职责明确：组标题回答“这些图片共同证明什么”，短标题标识“这一帧是什么”，alt 说明“看不到图时仍需知道什么”。顺序本身是证据，因此作者端可以重排，读者端不能重新排序。

## 4. 使用的技术

- Next.js 16.3、React 19、Server Components 与 Route Handlers；
- unified、remark/rehype、mdast 与 HAST；
- `react-markdown` 自定义图片组件和 `next/image`；
- Decap CMS 3.14.1 `registerEditorComponent` 与嵌套 list widget；
- Obsidian Publisher 1.43.0、inbox readiness version 8 与既有原子附件事务；
- CSS Grid、`aspect-ratio`、`object-fit: contain`、响应式与 `@media print`；
- Node test、ESLint、TypeScript、Next production build/application tests；
- Playwright CLI 真实浏览器几何、图片加载、控制台和窄屏检查；
- Vercel 原生部署，不依赖 Cloudflare。

## 5. 实现的功能

1. 识别精确的 `[!gallery]` Callout，拒绝折叠标记、嵌套画廊、非图片列表和额外正文；
2. 校验标题、alt、caption、图片数量、画廊数量、总图片数和重复路径；
3. 正式内容拒绝外链、查询/fragment、根暂存、跨 slug、不安全编码和 MP4；
4. Obsidian 草稿允许根暂存图片，并由发布器统一归档到当前 slug；
5. 输出语义化 `section/header/ol/li/figure/figcaption`，保留原始顺序和编号；
6. 画廊文本进入搜索索引，但不泄漏 `[!gallery]` 作者标记；
7. 本地画廊图片继续走固有尺寸和 `next/image`，获得单独的响应式 `sizes`；
8. Studio 组件提供组标题和 2–6 项可添加、删除、重排的图片字段；
9. Studio 序列化器稳定生成可移植 Markdown，解析器可回填已有画廊；
10. `/studio/math-preview` 返回 `galleryCount`、`galleryImageCount` 与生产 HAST；
11. Studio 作者状态显示 `GALLERY / READY`、数量或精确修复信息；
12. Obsidian 新增“插入受约束多图画廊模板”命令，并按 inbox/正式内容生成正确路径；
13. readiness 媒体用途新增 `GALLERY`，保留源码行、顺序和附件归档证据；
14. 画廊附件进入同一原子 rename、质量门、提交 envelope 和失败恢复；
15. 插件升级到 1.43.0，bundle 3/3 SHA-256 一致；
16. 生产 smoke 同时验证画廊模块、数量、HAST 身份、无 iframe 与既有视频/图表能力。

## 6. 实现方法

先冻结一种作者语法，而不是先写 UI：

```markdown
> [!gallery] 发布流程证据
> - ![编辑器中的画廊表单](/uploads/release-flow/editor.webp "编辑")
> - ![发布后的双栏画廊](/uploads/release-flow/published.webp "上线")
```

该语法在 Obsidian 中仍是可读 Callout，在普通 Markdown 工具中仍是标准图片列表。`lib/markdown-gallery.ts` 从 mdast 判断完整结构，统一产生来源行、错误和 HAST，内容契约、Studio 预览、搜索与正文渲染不各写一套正则。

Studio 使用 Decap 自定义 editor component，把嵌套 list 作为作者表单，序列化器只输出上述稳定语法。Obsidian 不复制第二套发布器，而是给现有插件增加模板命令与 `GALLERY` 用途；附件仍通过 source/target、真实图片检查、原子移动、构建门和 Git 交付。

集成测试第一次出现 5 个失败，原因是插件版本断言和 bundle 摘要仍指向上一版；更新到 1.43.0 并重新封装后，安全门又发现新代码使用 `.exec(...)`，会命中插件“无隐藏 shell interpolation”的宽泛禁用规则。最终改用等价 `.match(...)`，没有放宽安全测试。

## 7. 验证证据

- 定向画廊/Callout/视频测试：17/17；
- Obsidian 插件与发布链路：242/242；
- `npm run test:unit`：565/565；
- `npm run test:diagram`：5/5；
- `npm run lint`、`npm run typecheck`：通过；
- `npm run build`：通过，68 个生成页面/资源；
- `npm run test:app`：35/35，十三条 HTML 与十一个结构化端点预算全部 PASS；
- `npm audit --omit=dev --audit-level=high`：0 漏洞；
- `npm run plugin:bundle`：`myblog-publisher@1.43.0 · 3/3 SHA-256`；
- 发布配置、内容维护、inbox、根暂存媒体和外链离线库存：全部通过，草稿/根暂存/本地问题均为 0；
- Playwright 桌面：两列各 415.5 px、2 张图片全部加载、`object-fit: contain`、无 overflow/script/iframe/dialog，控制台 0 error；
- Playwright 320 px：单列 256 px、图片全部加载、无横向溢出，视觉截图复核通过；
- 功能提交：`619a604`。

生产部署与稳定域名 smoke 在功能与归档提交推送后补记；本节不会把尚未发生的边缘交付写成已完成证据。

## 8. 经验与教训

1. 多图首先是有序内容契约，不是 CSS `grid`；
2. Obsidian Callout 加标准图片列表比自定义 HTML 更可迁移；
3. alt、caption 和组标题承担不同语义，不能互相回填；
4. 静态接触表比轮播更适合技术步骤、比较和打印；
5. `object-fit: contain` 对证据图比裁切填满更重要；
6. 作者端允许重排，不代表读者端需要交互控件；
7. 数量上限要同时约束单组、单篇组数和单篇总图数；
8. Studio 友好表单与服务端权威校验应分层，但必须生成同一语法；
9. 画廊图片应复用既有媒体事务，不应创建第二套上传/回滚流程；
10. 安全测试命中时应调整实现，不应因为“只是正则 API”而放宽全局护栏；
11. 合成预览可证明未来能力，真实公开样本才证明边缘图片传输；
12. 浏览器验收要同时看计算样式、自然尺寸、溢出与最终截图。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、受限本地静音 MP4 与受限多图画廊，并由 Git/Vercel 自动上线。画廊不依赖 Cloudflare、数据库、远程图库或读者端 JavaScript。

当前公开内容没有真实画廊样本，因此本轮生产协议使用合成 Markdown 验证，浏览器视觉使用仓库现有两张真实图片验证；这可以证明解析、渲染和响应式布局，但不等于已经证明一篇真实画廊文章的最终 CDN 缓存、图片优化候选和内容编辑体验。第一次真实发布仍应做所有者人机验收。

画廊上限不是全站媒体容量预算。内容和图片增长后仍需观察 Git 历史、Vercel 图像优化与 HTML 预算。灯箱、轮播、手势、下载打包、EXIF、远程图库和图片编辑均未开放；只有出现明确读者任务时才建立新契约。

## 10. 下一轮唯一主任务

建立受约束的技术表格阅读契约：复核 GFM 表头语义、宽表横向滚动、320 px、长代码/URL、深浅色、打印、Studio 预览和搜索；优先保证数据完整与键盘可达，不引入客户端表格库、排序脚本或虚拟滚动。
