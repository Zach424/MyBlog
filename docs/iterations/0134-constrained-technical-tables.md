# Iteration 0134：受约束的技术表格

## 1. 范围与成功标准

本轮把已有的“GFM 能渲染 `<table>`”提升为一类可命名、可校验、可搜索、可编辑、可打印的技术数据契约。它服务性能对比、兼容矩阵、状态清单和配置差异，不承担电子表格、数据库视图或读者端数据分析任务。

成功标准：

1. 作者使用 Obsidian 兼容 Callout 与标准 GFM 表格表达数据；
2. 所有正式表格都有可见标题，普通无标题 GFM 表格在发布前失败关闭；
3. 每表 2–6 列、1–20 条数据行、最多 120 个数据单元格；每篇最多 4 表、合计最多 240 个数据单元格；
4. 表头非空、唯一且最多 60 字符，单元格非空且最多 240 字符；
5. 每条数据行必须与表头列数完全一致，不依赖 GFM 自动补空或忽略超额列；
6. Studio 提供可增删、重排的列定义和数据行，Obsidian 提供快捷插入命令；
7. 对齐、标题、表头、数据、搜索、Studio 预览、移动端和打印共用同一事实源；
8. 320 px 下只让表格视口横向滚动，页面本身不溢出，键盘可聚焦；
9. 首列在屏幕阅读中固定以保留行上下文，打印时解除固定并重复表头；
10. 不引入客户端表格库、排序、筛选、虚拟滚动、合并单元格或 CSV 状态。

## 2. 项目结构状态

本轮新增：

- `lib/markdown-table.ts`：技术表格抽取、结构/预算/内联内容校验、HAST 转换和搜索降级；
- `studio/table-editor.mjs`：Decap `myblog-table` 自定义 editor component；
- `app/studio/table-editor.mjs/route.ts`：同源、`no-store` Studio 模块路由；
- `tests/markdown-table.test.mjs` 与 `tests/studio-table-editor.test.mjs`；
- 本文件与 `docs/knowledge/0134-table-is-a-data-integrity-contract.md`。

本轮修改：

- 共享 Markdown/rehype 管线、内容契约、搜索索引与 React 表格边界；
- 正文和 Studio 的 Data Ledger、首列冻结、响应式和打印 CSS；
- Studio 配置、模块注册、生产管线预览计数与质量门；
- Obsidian 插件模板命令、作者环境版本和 bundle 摘要；
- 完整单元、应用、浏览器和生产路由测试清单。

功能提交为 `ff90626`。归档时工作区另有用户自己的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件；本轮没有覆盖、暂存或提交它们。

## 3. 设计内容

表格使用与站点一致的 Commit Trace / Evidence Rail，但把视觉角色收敛为 `DATA LEDGER`。顶部显示 `DATA TABLE / NN COLUMNS`、`NN ROWS · STATIC`、可见标题与 `KEY COLUMN`；十字格标记代替装饰图标，直接提示这是二维数据。

表体保留细规则线、交替行底色和等宽数字。第一列被定义为行键，在横向滚动时固定；这不是排序或数据库主键，只是让读者仍知道当前数值属于哪一行。数字列的右对齐来自作者写下的 GFM 冒号，不由渲染器猜测数据类型。

桌面宽度足够时表格自然铺满正文；`32rem` 以下表格维持 `36rem` 最小阅读宽度，由带名称、可聚焦的内部 region 承担横向滚动。打印解除 sticky 和 overflow，使用固定布局、可换行单元格、重复 `thead`，并避免单行跨页。

## 4. 使用的技术

- Next.js 16.3、React 19、Server Components 与 Route Handlers；
- unified、remark-gfm、remark-rehype、mdast 与 HAST；
- `react-markdown` 的条件表格组件映射；
- Decap CMS 3.14.1 `registerEditorComponent`、嵌套 list widget 与自定义序列化器；
- Obsidian Publisher 1.44.0 与 SHA-256 bundle；
- CSS sticky positioning、tabular numerals、逻辑 overflow、响应式与 `@media print`；
- Node test、ESLint、TypeScript、Next production build/application tests；
- Playwright CLI 的真实浏览器几何、滚动、焦点、控制台与截图检查；
- Vercel 原生部署，不依赖 Cloudflare。

## 5. 实现的功能

1. 识别顶层、静态、精确的 `[!table]` Callout，拒绝折叠、嵌套和额外段落；
2. 强制标题与恰好一个 GFM 表格，拒绝无标题普通表格；
3. 校验列数、数据行数、单表/单篇数据单元格预算；
4. 校验所有行列数严格相等，阻止 GFM 的空白补齐或超额忽略语义；
5. 校验表头非空、NFKC 后唯一、长度受限；
6. 校验单元格非空和长度，允许文本、行内代码、简单强调、链接与行内公式，拒绝图片、HTML、脚注和强制换行；
7. 保留 GFM 左/中/右对齐并给 `<th>` 增加 `scope="col"`；
8. 输出带可见标题、数据规模和滚动区域名称的语义化 Data Ledger；
9. 公开页首列冻结、数值等宽、窄屏局部滚动、键盘焦点可见；
10. 打印时解除冻结和横向滚动，重复表头并避免数据行内部断页；
11. 表格标题、表头与单元格进入搜索索引，但不泄漏 `[!table]` 标记；
12. Studio 列定义支持名称、对齐、增删与重排，数据行支持增删与重排；
13. Studio 序列化器检查每行单元格数，稳定转义竖线并可回填既有表格；
14. `/studio/math-preview` 返回 `tableCount` 与 `tableDataCellCount`，错误状态显示 `TABLE / NEEDS FIX`；
15. Obsidian 新增“插入技术数据表格模板”命令，只在博客内容目录中启用；
16. 插件升级到 1.44.0，bundle 3/3 SHA-256 一致；
17. 新 `/studio/table-editor.mjs` 进入显式 Next.js 路由、质量门与生产 smoke 范围。

## 6. 实现方法

先冻结作者语法：

```markdown
> [!table] API 延迟对比
> | 环境 | P50 | P95 |
> | --- | ---: | ---: |
> | 本地 | 18 ms | 44 ms |
> | 生产 | 42 ms | 118 ms |
```

该语法在 Obsidian 中仍是 Callout，在普通 GFM 工具中仍是表格。`lib/markdown-table.ts` 从 mdast 读取标题、对齐、表头、数据与来源行，在内容契约进入正式记录前完成完整校验；随后 rehype 插件只把通过的精确区块提升为 Data Ledger。搜索直接复用同一 AST，把作者标记替换为标题而保留数据。

GFM 解析实验确认短行和超额行都会保留为不同数量的 `tableCell`，不会在 mdast 中自动修复，因此构建门可以精确拒绝错位。Studio 自定义组件把“列定义”和“数据行”分开建模，但序列化前再次要求每行数量等于列数；这让表单方便编辑，同时 Markdown 仍是唯一事实源。

公开页没有排序或筛选状态。首列 sticky 只保存阅读上下文，滚动发生在具名 region 内；React 表格映射识别已经增强的 class，避免再次套入旧的通用 `.table-scroll`。打印样式则显式解除 sticky，防止屏幕优化污染纸面。

## 7. 验证证据

- 新增表格与 Studio 组件定向测试：9/9；
- `npm run test:unit`：575/575；
- `npm run test:diagram`：5/5；
- `npm run lint`、`npm run typecheck`：通过；
- `npm run build`：通过，69 个生成页面/资源；
- `npm run test:app`：35/35，十三条 HTML 与十一个结构化端点预算全部 PASS；
- `npm audit --omit=dev --audit-level=high`：0 漏洞；
- `npm run plugin:bundle -- --write`：`myblog-publisher@1.44.0 · 3/3 SHA-256`；
- 内容维护、inbox 与根暂存媒体：健康，草稿/附件/问题均为 0；
- Playwright 桌面：正文宽 768 px，首列计算样式 `sticky`、数字列 `right`、组件内 script/button 为 0，控制台 0 error；
- Playwright 320 px：页面 `bodyScrollWidth 305 <= innerWidth 320`；表格 region `273 → 704 px`，滚动 220 px 后首列相对偏移仍为 0，焦点落在 `role=region`；
- 桌面与移动截图：`output/playwright/iteration-0134-table-desktop.png`、`output/playwright/iteration-0134-table-mobile.png`；
- 功能提交：`ff90626`。

生产推送与稳定域名证据将在本轮归档提交推送后补入本节；当前不把本地合成表格冒充为真实公开文章。

## 8. 经验与教训

1. 表格首先要防止数据错位，之后才是边框和斑马纹；
2. GFM 的宽松渲染适合阅读，不适合充当发布契约；正式内容应拒绝短行和超额行；
3. 标题、表头唯一性和列数一致是表格最小语义，不是可选美化；
4. 预算应同时约束列、行、单表单元格、单篇表数和单篇总单元格；
5. 对齐应由作者显式声明，渲染器不应凭字符串猜数字类型；
6. 首列冻结能保存宽表上下文，但不是主键、排序或交互状态；
7. Studio 可以像文档表单一样编辑，最终仍必须生成开放的 GFM；
8. 读者端静态表格比客户端数据网格更适合博客的搜索、打印和长期维护；
9. 局部 overflow 必须同时验证页面不 overflow、region 可聚焦和 sticky 实际几何；
10. 打印需要主动解除屏幕 sticky，并让 `thead` 重复；
11. 无标题普通 GFM 表格会绕过可访问名称和预算，应在内容进入正式记录前失败关闭；
12. 合成视觉夹具证明布局能力，真实公开内容才证明最终作者体验与 CDN 表示。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、受限本地静音 MP4、受限多图画廊与受限技术表格。表格不依赖 Cloudflare、数据库、第三方电子表格或读者端 JavaScript。

当前公开内容没有真实技术表格，因此本轮使用共享生产管线和浏览器合成 DOM 验证结构、样式、滚动与焦点。这不等于已经证明所有者第一次在 Decap 嵌套 list 中编辑 6 列 × 20 行数据的效率，也不证明真实长 URL、复杂行内公式和不同打印机驱动的最终分页。

第一版有意关闭排序、筛选、复制整表、CSV、公式计算、合并单元格、行列拖动、数据库同步和远程数据源。若以后出现可复现的读者任务，应先区分“文章中的证据表”与“交互数据产品”，不能继续扩大同一语法。

## 10. 下一轮唯一主任务

建立受约束的只读任务清单：使用 Obsidian/GFM 兼容任务列表表达项目进度，冻结标题、完成/未完成状态、项目预算、Studio/Obsidian 作者入口、搜索、打印和无障碍语义；公开页只展示状态，不允许读者修改，也不引入客户端任务管理器。
