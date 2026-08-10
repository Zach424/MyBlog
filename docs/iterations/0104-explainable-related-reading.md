# Iteration 0104：可解释继续阅读

## 1. 范围与成功标准

本轮只解决文章和项目详情的下一跳：读者从搜索或正文落地后，应能看到最多 3 条与当前记录真实相关的公开内容，以及每条建议为什么出现。推荐只允许使用现有公开记录、专题、共同标签和已经通过目标/fragment 校验的正文引用关系；服务端派生、稳定排序、自身与零信号排除、空集合不渲染，不新增数据库、分析服务、客户端请求或 frontmatter 字段。

成功标准还包括：文章与项目共用一个语义组件；桌面、`≤55rem`、320px、深色、打印和键盘路径清晰；真实 Next 页面与生产站都验证可见链接数量和理由；HTML 增长必须经过既有 raw/gzip 预算，而不是只看 JSX 体积。

## 2. 项目结构状态

- `lib/content/recommendations.ts`：新增独立纯函数、理由类型、权重、稳定决胜和最多 3 条约束；
- `lib/content/index.ts`：复用公开内容与关系快照，缓存按 URL 派生的推荐映射，暴露只读 getter；
- `components/ContentViews.tsx`：新增 Server Component `ContentRecommendations`，输出语义标题、顺序列表、真实链接和理由；
- `app/posts/[slug]/page.tsx`、`app/projects/[slug]/page.tsx`：在正文后、Reference ledger 前读取和渲染推荐；
- `app/globals.css`：增加 Continue Trace 桌面三列、窄屏单列、焦点、深色继承与打印隔离；
- `tests/content-recommendations.test.mjs`：新增 3 项算法契约；`tests/rendered-html.test.mjs`、`tests/quality-gates.test.mjs`、`tests/print-layout.test.mjs`：锁定真实页面、响应式、服务端和打印边界；
- `scripts/smoke-production.mjs`、`tests/deployment-tools.test.mjs`：在线核对真实 `<a class="content-recommendation">` 数量与理由，避免 RSC 假阳性；
- `scripts/html-budget.mjs`、`tests/html-budget.test.mjs`：功能稳定上线后，以生产提交 `dccb467967c1ed2a3d3dc08ad8d2d1b7028ac854` 重新冻结九路 HTML 基线；
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md` 与本文：同步结构、设计、技术、功能、方法、证据、经验和下一轮主线。

## 3. 设计内容

继续阅读沿用 Commit Trace / Evidence Rail，不创建“猜你喜欢”卡片体系。眉题为 `Continue trace`，中文标题为“继续阅读”；每条建议用水平轨迹节点、`TRACE 01` 序号、内容类型、标题、理由和方向箭头构成。桌面最多三列，`≤55rem` 改为单列，320px 让中文理由自然换行。浅深色只复用 Paper、Ink、Trace、Signal Token，原生链接保持可见焦点；纸面阅读不需要下一跳，因此打印隐藏整个推荐区。

第一版曾加入日期、摘要和多层标签。真实生产形态的文章 gzip 只剩 138 B 余量，说明可见内容之外还会影响 RSC/HTML 载荷。最终删去不参与判断的日期与摘要，只保留“标题 + 类型 + 可复核理由”；内部总分不展示，避免把启发式权重包装成事实。

```text
Desktop: [ TRACE 01 / title / reason ] [ TRACE 02 / ... ] [ TRACE 03 / ... ]
≤55rem:  [ TRACE 01 / title / reason ]
          [ TRACE 02 / title / reason ]
          [ TRACE 03 / title / reason ]
```

## 4. 使用的技术

- TypeScript 纯函数与只读 `Map` 缓存，复用 `ContentRecord` 和 `ContentRelations`；
- Next.js 16.3 App Router Server Components，不增加 `use client` 边界；
- React 19 语义 `<section>`、`<ol>`、`<li>` 与原生 `<a>`；
- CSS Grid、现有设计 Token、`@media (max-width: 55rem)` 与 print media；
- Node.js test runner、真实 Next production server、Node zlib HTML 预算和生产 smoke；
- Chromium 桌面/320px 实际页面检查；
- `research-iteration-loop` skill 用于全局复盘、失败优先、范围控制、部署取证与归档；`frontend-design` skill 用于视觉方向、信息密度和非模板化 Continue Trace 设计。实现前同时按仓库规则阅读本地 Next.js layouts/pages、server/client、dynamic page、CSS 与 accessibility 指南。

## 5. 实现的功能

1. 每篇公开文章或项目最多显示 3 条继续阅读；没有信号时不显示空区；
2. 双向引用、当前记录引用、引用当前记录、同专题和共同标签都能形成可见理由；
3. 排序权重依次为 120、80、70、60 和每个共同标签 15，同分按发布日期、中文标题和 URL 稳定决胜；
4. 双向引用用一个 120 分理由替代两个方向分数，避免重复说明；一条记录可同时展示专题与共同标签理由；
5. 推荐完全从公开内容和已经验证的关系派生，草稿、未来内容、自身和零信号不会出现；
6. 文章和项目共用服务端 UI，桌面三列、窄屏单列，320px 无横向滚动，打印隐藏；
7. 生产冒烟以真实推荐链接选择器和理由检查代表文章 2 条、代表项目 3 条。

## 6. 实现方法

先写算法测试并运行，得到预期的 `ERR_MODULE_NOT_FOUND`，证明失败确实来自尚不存在的推荐模块。实现 `deriveContentRecommendations()` 后，先把当前页 outgoing/backlinks URL 转成集合，再逐候选累计唯一关系理由、专题和共同标签理由；过滤零理由后稳定排序并截取 3 条。

内容索引复用一次加载的 `publishedContent` 与 `contentRelations`，在模块服务端生命周期内构建 `recommendationsByUrl`，详情页只做 URL getter。组件直接接收已派生对象，既不复制排序，也不把全库记录交给客户端。页面位置选择在正文之后、Reference ledger 之前：先给有限综合下一跳，再保留完整原始图边供审计。

浏览器与预算反馈发现第一版密度过高后，缩减 DOM 字段并重新跑真实 production server。功能提交 `dccb467` 上线、质量门和生产 smoke 成功后，才测量稳定生产九路响应并更新基线来源；这把“有意的产品增长”与“允许它通过的预算证据”绑定在同一个已经部署的快照上。

## 7. 验证证据

- 失败优先：新增算法测试首次运行因 `lib/content/recommendations.ts` 不存在而报 `ERR_MODULE_NOT_FOUND`；
- 算法专项：3/3 通过；关系与推荐组合专项：8/8 通过；页面/质量/打印聚焦回归：16/16 通过；
- 功能提交前 `npm run release:check`：115.0 秒，488/488 单元测试、49 个构建页面、20/20 应用测试、九路 HTML 与七路发现预算全部 PASS、生产依赖审计 0；
- 浏览器：深色桌面项目页显示 3 条紧凑推荐且理由清晰；320×760 时 `clientWidth=305`、`scrollWidth=305`，三条宽度均为 271px，理由自然换行，console warning/error 为 0。当前浏览器后端不支持实时切换 light media，未伪称完成浅色实拍；浅色 Token 继续由自动化 AA 契约覆盖；
- 功能提交：`dccb467 feat(content): add explainable related reading`；
- GitHub Actions：[Quality Gate #195](https://github.com/Zach424/MyBlog/actions/runs/31346162492) 与 [Verify Vercel Production #188](https://github.com/Zach424/MyBlog/actions/runs/31346193173) 均成功；
- 稳定生产再次运行 smoke：24 个 Sitemap 路由成功、OAuth 302、代表文章 2 条和代表项目 3 条真实推荐链接、理由与既有全部协议/预算检查通过；
- 稳定生产代表文章为 50021/11966 B、代表项目为 106324/24174 B（raw/gzip）；新冻结 gzip 上限为 15360/29696 B，余量分别为 +3394/+5522 B；
- 九路生产基线依次为 `/` 26417/5786、`/posts` 17862/4251、代表文章 50021/11966、代表项目 106324/24174、专题 16233/3873、标签 16103/3841、搜索 36194/13826、知识地图 35908/7243、关于页 14912/3852 B（raw/gzip）；七路结构化发现基线保持 3009/921、3278/755、20697/9876、3238/1241、4527/504、155/127、700/462 B；
- 基线与归档接入后的最终 `npm run release:check`：118.3 秒，488/488 单元测试、49 个构建页面、20/20 应用测试、九路 HTML 与七路发现预算全部 PASS、生产依赖审计 0；本地代表文章为 49790/11947 B、代表项目为 106024/24152 B（raw/gzip），余量 +3413/+5544 B。

## 8. 经验与教训

1. 可解释不等于信息越多越好。读者需要的是“为什么推荐”，不是日期、摘要、分数和标签的重复堆叠；
2. 关系账本与推荐不能合并：前者完整呈现原始有向事实，后者综合多种已有信号给出有限下一跳；
3. Next Server Components 中，少量可见 JSX 也可能显著增加完整 HTML/RSC 载荷，必须测真实响应而不是估算源码字符；
4. 预算不能在本地功能输出上自我重置。应先部署有价值变化、验证稳定生产，再记录确切提交、日期与响应字节；
5. 排名分数是内部工程契约，不应在缺乏统计含义时展示给读者；可见理由比伪精确分数更可信。

## 9. 全局状态、风险与未解决问题

全局复盘比较了三个候选：详情页 `BreadcrumbList` JSON-LD、搜索 Article/TIL/Project 类型筛选、CSP nonce。面包屑结构化数据可以复用现有可见层级和 origin 逻辑，服务器端共享函数即可覆盖四类详情页，爆炸半径最低且能补齐机器发现一致性，因此选为下一轮。搜索筛选在当前仅 4 条内容时会增加 URL 和客户端交互契约，收益不足；CSP nonce 会影响 Next 流式渲染与缓存边界，继续作为高风险架构议题暂缓。

推荐当前只基于 4 条公开记录。内容增长后，泛化标签可能逐渐主导排序；在有真实内容分布前不提前引入点击追踪、个性化或黑盒模型，先由可见理由、稳定测试与 HTML 预算暴露问题。其余既有风险保持：首次真实 Obsidian 主题/本机代理人机验收、Decap 开发依赖上游高危项、Actions pin 主动复核，以及等待所有者选择的自定义域名、统计、评论和公开邮箱。

## 10. 下一轮唯一主任务

为文章、项目、专题和标签详情补齐与可见面包屑一致的 `BreadcrumbList` JSON-LD。使用共享纯函数生成绝对同源 URL 与稳定 `position`，未知/404 页面不输出；保持服务端生成，不引入客户端脚本、数据库或新的内容字段。
