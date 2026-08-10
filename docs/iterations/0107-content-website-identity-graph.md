# Iteration 0107：内容—站点身份图

## 1. 范围与成功标准

本轮只解决文章与项目结构化数据仍是孤立文档的问题：为现有 `BlogPosting` 和 `SoftwareSourceCode` 增加稳定内容 `@id`，并用 Schema.org `isPartOf` 引用 iteration 0106 已发布的主页 `WebSite` 节点。目标不是新增 SEO 字段，而是让已存在、已验证的 canonical 与站点身份形成一张可追踪的 JSON-LD 图。

成功标准是：内容 `@id` 固定为 `<canonical>#content`；`isPartOf` 严格为 `{ "@id": "<root>#website" }`；站点 ID 只能由同一个纯函数派生；内容 URL 必须使用站点同 origin、无凭据、无查询/fragment 且不是首页；输入 URL 不被修改；文章/项目原有标题、描述、日期、URL、图片、作者、仓库和技术栈字段不漂移；内部页仍不复制完整 `WebSite`；未知 slug 不输出内容文档；不增加可见 UI、客户端代码、数据库、内容字段、Person/ProfilePage 或未经确认的公开事实；真实 Next、浏览器、生产烟测与 HTML 预算全部通过。

## 2. 项目结构状态

- `lib/website.ts`：新增 `createWebsiteId()` 与 `createContentStructuredIdentity()`，统一站点 ID、内容 ID、同源和 URL 安全边界；
- `app/posts/[slug]/page.tsx`：`BlogPosting` 接入共享内容身份，并把 `inLanguage` 改为复用 `SITE_LANGUAGE`；
- `app/projects/[slug]/page.tsx`：`SoftwareSourceCode` 接入同一身份边界与语言常量；
- `tests/website.test.mjs`：增加成功身份、不修改输入与跨 origin/首页/查询/凭据失败关闭测试；单元测试总数由 495 增至 497；
- `tests/rendered-html.test.mjs`：增加真实 Next HTML 的文章、项目、主页节点引用、原字段保持与 404 关闭测试；应用测试总数由 22 增至 23；
- `scripts/smoke-production.mjs`、`tests/deployment-tools.test.mjs`：生产站精确验证两个内容类型、canonical、语言、站点引用与未知详情关闭；
- `scripts/html-budget.mjs`、`tests/html-budget.test.mjs`：功能部署稳定后，以生产提交 `668d26fb347849eed477b8d81b5f4d9faa0b7393` 重测并冻结九路 HTML 基线；
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md` 与本文件：同步当前结构、设计、技术、功能、方法、风险、经验和下一轮主线。

## 3. 设计内容

本轮没有新增可见组件。文章标题、项目标题、封面、正文、面包屑、分享、推荐、Reference ledger 与 Commit Trace 视觉语言全部保持原样；机器身份只存在于原有原生 JSON-LD script 中，不增加“SEO 状态”、实体 ID 徽章或新的作者卡。

结构化设计采用“完整节点只在权威页面出现，其他文档只引用 ID”的最小图：

```text
主页
└─ WebSite @id = https://<origin>/#website

文章详情
└─ BlogPosting @id = https://<origin>/posts/<slug>#content
   └─ isPartOf → https://<origin>/#website

项目详情
└─ SoftwareSourceCode @id = https://<origin>/projects/<slug>#content
   └─ isPartOf → https://<origin>/#website
```

文章/项目页不重复站点名称、描述或语言组成的完整 `WebSite` 文档；主页也不嵌入全部内容节点。这样避免重复事实和页面体积扩散，同时让消费者能用稳定 IRI 合并节点。通用 `#content` fragment 表达“这个 canonical 页面上的主要内容实体”，无需为文章与项目维护第二套后缀规则。

## 4. 使用的技术

- TypeScript 纯函数、原生 `URL` 克隆与同源验证；
- Next.js 16.3 App Router Server Components 与原生 `<script type="application/ld+json">`；
- Schema.org `BlogPosting`、`SoftwareSourceCode`、`WebSite` 与 `isPartOf`；
- W3C JSON-LD 1.1 的 IRI 节点身份和仅含 `@id` 的 node reference；
- React 19 既有 `StructuredData` 的 `<` 转义边界；
- Node.js test runner、TypeScript、ESLint、Next production build、真实 SSR 测试与生产 smoke；
- Node zlib 的九路 HTML raw/gzip 预算；
- in-app Chromium 的真实 DOM、可见标题和 console 验证；
- `research-iteration-loop` skill 用于单一范围、失败优先、全局复盘与稳定生产基线闭环；`browser` skill 用于真实页面验证。

参考：[W3C JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)、[Schema.org isPartOf](https://schema.org/isPartOf)、[Schema.org BlogPosting](https://schema.org/BlogPosting)、[Schema.org SoftwareSourceCode](https://schema.org/SoftwareSourceCode)。实现前也完整读取了仓库安装版本的 Next.js JSON-LD 指南；该指南要求在 page/layout 中使用原生 script，并对序列化结果中的 `<` 做安全转义，现有 `StructuredData` 边界继续满足这一要求。

## 5. 实现的功能

1. 主页站点身份的 `@id` 由导出的 `createWebsiteId()` 单一派生；
2. 文章和项目内容节点的 `@id` 固定为各自 canonical 加 `#content`；
3. 两类内容都用最小 node reference 引用同一 `<root>#website`；
4. 内容身份只接受同 origin 的非首页 HTTP(S) URL，并拒绝凭据、查询和 fragment；
5. 生成器复制输入 URL，不修改调用方对象；
6. `BlogPosting`、`SoftwareSourceCode` 与根文档共同复用 `SITE_LANGUAGE`；
7. 文章/项目原有公开字段、可见页面和服务端渲染方式保持不变，内部页 `WebSite` 数量仍为零；
8. 未知文章与项目 404 同时关闭 `BlogPosting`、`SoftwareSourceCode` 和错误内容身份；
9. 生产 smoke 现在直接解析 JSON-LD，精确比较内容 ID、canonical、语言与站点引用，而不是只匹配类型字符串。

## 6. 实现方法

先核对 W3C JSON-LD 的节点身份规则、Schema.org `isPartOf` 的 `CreativeWork` 适用范围和仓库安装版本的 Next JSON-LD 指南，再在 `tests/website.test.mjs` 导入尚不存在的 `createContentStructuredIdentity()`。首次目标测试按预期以 `SyntaxError: ... does not provide an export named 'createContentStructuredIdentity'` 失败，证明新测试确实约束了尚未实现的能力。

实现层先保留私有 `canonicalSiteRoot()`，再把站点 ID 提取为 `createWebsiteId()`；内容生成器从两个 URL 副本开始，依次检查凭据、origin、查询/fragment 和根路径，最终返回固定字段顺序的 `@id` 与 `isPartOf`。两条详情路由只在现有 JSON-LD 对象中展开这一身份，没有移动可见 DOM；同时把硬编码 `zh-CN` 替换为 `SITE_LANGUAGE`。

验证层分四级：纯函数测试证明安全边界和不变性；真实 Next SSR 测试同时请求主页、文章、项目和 404，比较节点图与原字段；浏览器直接从真实 DOM 解析 JSON-LD 并核对标题、节点数量和 console；生产 smoke 对 Vercel 稳定域名重复同一图谱契约。功能提交独立部署并成功后，才读取真实生产响应更新九路基线，避免用本地构建或未上线代码给自身放行。

## 7. 验证证据

- 失败优先：目标测试首次因缺少命名导出而失败；
- 纯函数与部署工具目标测试：11/11；TypeScript 与 ESLint 均通过；
- Next production build：49 个页面成功；应用测试：23/23；
- 完整 `npm run release:check`：169.6 秒，497/497 单元测试、49 个构建页面、23/23 应用测试、九路 HTML 与七路结构化发现预算全部 PASS，生产依赖审计 0；
- 浏览器：文章标题“从零搭建可维护的个人技术博客”和项目标题“MyBlog — 把学习记录做成工程资产”正常；两类 `@id`/`isPartOf`/`url` 精确，内部页 `WebSite=0`，console 警告/错误为空；
- 功能提交：`668d26f feat(discovery): link content to website identity`；
- GitHub Actions：[Quality Gate #201](https://github.com/Zach424/MyBlog/actions/runs/31351146646) 与 [Verify Vercel production #194](https://github.com/Zach424/MyBlog/actions/runs/31351175522) 均成功；
- 稳定生产 smoke：24 个 Sitemap 路由成功、OAuth 302；新增文章/项目身份与站点引用探针通过；
- 九路生产基线依次为 `/` 27309/5993、`/posts` 17862/4250、代表文章 51784/12216、代表项目 108029/24464、专题 17511/4163、标签 17332/4134、搜索 36194/13825、知识地图 35908/7242、关于页 14912/3851 B（raw/gzip）；gzip 余量依次为 +2199、+2918、+3144、+5232、+3005、+3034、+3583、+2998、+2293 B；
- 七路结构化发现基线未变化：3009/921、3278/755、20697/9876、3238/1241、4527/504、155/127、700/462 B（raw/gzip）。
- 基线与归档目标回归：18/18；最终 `npm run release:check`：122.2 秒，497/497 单元测试、49 个构建页面、23/23 应用测试、全部预算 PASS、生产依赖审计 0。

## 8. 经验与教训

1. JSON-LD 的多个 script 不会自动形成一张可审计的图；稳定 `@id` 与明确 node reference 才能表达节点关系；
2. `isPartOf` 不需要复制完整 `WebSite`，最小 `@id` 引用能减少事实漂移和 HTML 增长；
3. ID 派生必须只有一个入口，否则主页与内容页很容易在 trailing slash、代理 origin 或自定义域名切换时分叉；
4. 结构化数据也要执行同源、凭据、查询和 fragment 边界，不能因为脚本不可见就降低 URL 质量；
5. 共享常量不能只停留在主页；内容文档硬编码语言同样会形成长期漂移点；
6. 只匹配 `"@type":"BlogPosting"` 不能证明图谱正确，测试必须解析 JSON 并比较 ID、引用、canonical 与关闭边界；
7. 不可见的图谱字段仍会增加完整 HTML/RSC 体积；必须在功能提交真实部署后重新冻结生产基线；
8. 内容契约允许外部 HTTPS canonical，而当前身份生成器有意要求同 origin。未来支持转载或跨域迁移前，必须先定义本地页面与原始作品的身份语义，不能临时绕过安全门。

## 9. 全局状态、风险与未解决问题

博客当前已具有主页站点节点、文章/项目内容节点、四类可见路径面包屑、公开内容清单/Schema、Feed、OpenSearch、Sitemap、可移植源文和生产验证器；结构化发现从孤立文档前进到可追踪的站点—内容图。所有可见页面、Studio、Obsidian、发布、知识图、搜索、推荐、分享与媒体链路保持稳定。

仍未解决的结构化风险是：两个完整内容文档仍在页面内联构造，作者、日期、图片、仓库和可选字段缺少纯对象级生成器测试；Person/ProfilePage 仍等待所有者确认公开人物事实，不应由现有 GitHub URL 推测扩充；集合页 `ItemList` 的收益仍弱于当前维护风险，继续暂缓。自定义域名启用时必须同时重测站点/content ID、canonical、OG、Feed、清单、Sitemap、生产 smoke 和九路基线。其余长期风险保持：首次真实 Obsidian 主题与本机代理的人机验收、Decap 开发依赖上游高危项、Actions pin 主动复核、统计/评论/公开邮箱的所有者选择。

## 10. 下一轮唯一主任务

把文章 `BlogPosting` 与项目 `SoftwareSourceCode` 的完整 JSON-LD 对象从两个页面提取为纯生成器，继续复用共享身份与 `SITE_LANGUAGE`，用精确对象测试锁定标题、描述、日期、图片、作者、仓库、技术栈和 `undefined` 可选字段边界。保持实际 HTML、可见 UI、公开事实与生产预算不变，不新增 Person/ProfilePage、客户端代码、数据库或内容字段。
