# Iteration 0116：统一公开项目状态展示

> 实现、验证、上线与归档：2026-08-11 · Vault：仓库根目录

## 1. 范围与成功标准

Iteration 0115 建立了共享中文项目状态标签，但全局审计发现三个最主要的公开项目表面仍直接格式化原始 enum：首页精选项目卡显示 `Maintained`，项目集合显示 `MAINTAINED`，项目详情显示 `Project / maintained`。数据没有错，展示语义却因组件实现不同而分叉。

本轮只统一这三处：四种项目 status 都由一个纯 presenter 输出中文 label、大写 code 和统一 meta；三个表面使用相同 `label · CODE`，About 与首页 Evidence 的自然句继续只使用 label；内容 frontmatter、Markdown/source、清单、Schema、Studio 和其他机器接口仍保存原始 enum。成功还要求 390px 深色无挤压、单一 H1、零横向溢出，既有传输预算与整站生产 smoke 继续通过。

## 2. 项目结构状态

- `lib/content-presentation.ts`：从单一中文标签函数升级为四状态双语 presenter，返回 label/code/meta 的防御性副本；
- `app/page.tsx`：首页精选项目卡删除首字母大写逻辑，消费共享 meta；
- `components/ContentViews.tsx`：项目集合及复用该组件的项目条目不再自行 `toUpperCase()`；
- `app/projects/[slug]/page.tsx`：详情 eyebrow 不再直接插入小写 enum；
- `app/globals.css`：为首页窄项目卡的双语状态补充行高和右对齐；
- `tests/content-presentation.test.mjs`：穷举 planning/building/maintained/archived 的 label/code/meta；
- `tests/rendered-html.test.mjs`：并行锁定首页、项目集合和项目详情的统一文本并拒绝三种旧格式；
- `package.json`：把 presenter 测试加入完整 `test:unit`；
- `docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md`：同步架构、设计、质量、生产证据、状态与下一主线；
- `docs/knowledge/0116-project-status-presentation.md`：新增 Obsidian 知识笔记；
- 本文件：归档本轮设计、实现、验证、上线、经验和风险。

归档时工作区另有并非本轮产生的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、删除或暂存这些内容。

## 3. 设计内容

统一核心形式为：

```text
持续维护 · MAINTAINED
```

中文 label 让读者直接理解状态；大写 code 保留工程日志的机器识别感，并与内容 enum 有明确对应。不同页面可以保留自己的上下文：首页仍有 Signal 状态点和 `Featured project`，集合仍有右箭头，详情仍以 `Project /` 开头，但状态核心文本完全相同。

About 的“持续维护 · 内容保存在 Git 中”与首页 Current focus 的“持续维护项目”属于完整中文句，只消费 label，不强插 code。窄首页卡允许中文与 code 分两行；项目列表在 390px 上保持一行；详情 eyebrow 自然换行且不影响完整 H1。没有新增徽章、颜色、图标、动画或客户端状态。

## 4. 使用的技术

- Next.js 16.3 Server Component；
- TypeScript `Record<ProjectRecord["status"], ProjectStatusPresentation>` 穷举映射；
- 纯函数 presenter 与防御性对象复制；
- 共享 React 服务端渲染边界；
- CSS inline-flex、line-height 与 text alignment；
- Node test 失败优先、TypeScript、ESLint、Next production build；
- 真实 production-server HTTP 与 raw/gzip 预算；
- Playwright CLI 三个独立页面的 390×844 深色 DOM、console 和截图；
- Vercel Git Production 与稳定域名整站 smoke；
- `research-iteration-loop` 管理范围、验证、复盘和下一步。

本轮没有新增 Next.js API 或文件约定；继续遵循本轮已阅读的安装版本 Server Component 文档。

## 5. 实现的功能

1. `planning` 唯一呈现为 `规划中 · PLANNING`；
2. `building` 唯一呈现为 `构建中 · BUILDING`；
3. `maintained` 唯一呈现为 `持续维护 · MAINTAINED`；
4. `archived` 唯一呈现为 `已归档 · ARCHIVED`；
5. 首页精选项目卡使用统一 meta；
6. `/projects` 及共享项目列表条目使用统一 meta；
7. 项目详情 eyebrow 使用 `Project / <统一 meta>`；
8. About 与首页 Evidence 继续复用相同 presenter 的 label；
9. frontmatter、公开 Markdown、内容清单、Schema、Studio 与结构化数据字段保持原始 enum；
10. 三个页面仍全部服务端输出，无 JavaScript 也可读取状态。

## 6. 实现方法

先新增 `tests/content-presentation.test.mjs` 并登记到完整单元测试；首次运行因既有模块没有 `getProjectStatusPresentation` 导出而失败。实现使用显式四项 `Record`，而不是运行时从任意字符串猜测翻译；每项同时声明 label、code 与 meta，TypeScript 在 status enum 增减时要求同步处理。

`getProjectStatusPresentation()` 返回对象副本，`getProjectStatusLabel()` 改为读取同一 presenter，因此旧 About/Homepage 语义自然回归。首页先在服务端为 featured project 计算一次 presenter；共享 `recordMeta()` 对 project 分支返回 meta；项目详情在确认记录存在后计算同一 meta。三处不再包含 `charAt/toUpperCase/raw enum` 格式化代码。

SSR 测试并行请求三页，既要求统一文本存在，也分别拒绝旧可见格式。浏览器验证最初尝试在 Playwright 回调里使用全局 `URL` 导航，CLI 执行环境没有该全局而保持在首页；随后改为直接打开三个独立绝对地址，避免把测试脚本失败误报为页面失败。

## 7. 验证证据

- 失败优先：目标测试先因 presenter 导出不存在而失败；
- presenter + About + 首页目标测试：7/7；
- `npm run typecheck` 与 `npm run lint`：通过；
- `npm run test:unit`：517/517；
- `npm run build`：51 个页面；
- `npm run test:app`：28/28；
- 本地十二条 HTML 与七个发现端点预算：全部 PASS；
- 本地首页：31968/6824 B；本地项目详情：112505/25228 B（raw/gzip）；
- Playwright 首页、`/projects`、`/projects/myblog`：390×844 深色，三处文本正确，每页 1 个 H1、零横向溢出、0 console errors；每页只有 Next.js CSS preload 延迟未使用警告；
- 首页项目卡截图：`output/playwright/iteration-0116/.playwright-cli/page-2026-08-10T19-13-32-385Z.png`；
- 项目集合截图：`output/playwright/iteration-0116/.playwright-cli/page-2026-08-10T19-15-14-043Z.png`；
- 项目详情截图：`output/playwright/iteration-0116/.playwright-cli/page-2026-08-10T19-16-05-365Z.png`；以上均在忽略目录，不进入 Git；
- 功能提交：`c42cd18`（`feat: unify public project status`），已推送 `main`；
- Vercel 稳定域名第 12 次轮询出现新状态，三页逐一 200 且包含统一 meta；
- 稳定生产 smoke：26 routes、OAuth 302；十二条 HTML 与七个发现端点全部 PASS；
- 稳定生产首页：32195/6822 B；项目详情：112835/25276 B（raw/gzip），均继续使用既有阈值。

## 8. 经验与教训

1. 同一个 enum 直接在不同组件格式化，会产生数据正确但语义分叉的界面；
2. presenter 应同时声明人类 label 和机器 code，不能依赖 `toUpperCase()` 暗示翻译完整；
3. 用显式 `Record<union, value>` 穷举映射，状态新增时 TypeScript 能推动展示同步；
4. 自然句与紧凑 meta 是不同语境，但应消费同一 presenter 的不同字段；
5. 共享函数返回副本，避免任一消费者修改全局映射对象；
6. 页面可以保留 `Featured project`、箭头、`Project /` 等结构差异，状态核心不应因此变化；
7. 双语 meta 在窄卡片换行是可接受设计，不应为了强制一行缩小字号或截断；
8. SSR 测试必须同时断言新文本和拒绝旧文本，才能证明局部格式化已删除；
9. 机器接口测试继续保护原始 enum，展示统一不能顺手改写公开协议；
10. Playwright 工具脚本失败要看 URL 和快照，不能把“仍在首页”的断言结果当成目标页证据；
11. 直接打开独立页面比在回调环境猜测全局 Web API 更稳健；
12. 三处生产文本逐一验证后仍要跑整站 smoke，局部成功不能替代全局回归；
13. 小段文本也会影响 raw/gzip，继续以实际稳定生产预算为准；
14. Obsidian 归档仍与仓库文档共用同一物理文件和 Git 历史。

## 9. 全局状态、风险与未解决问题

首页、About 和公开项目表面的可变项目事实现在都通过共享投影或 presenter 输出。内容 schema 中的 `status` 仍是稳定机器值，UI 中的人类解释也只有一份；新增第二个项目或改变 status 时，三个主要表面会同步变化。

全局复盘发现通用 `ContentIndexList` 仍固定渲染 `publishedAt`。因此 MyBlog 在 `/projects` 显示 2026-07-18，而其 `updatedAt` 和全站最新事实是 2026-08-06；文章、专题、标签和关系列表也会出现相同歧义。`/archive` 按首发时间组织是有意语义，不能和通用列表一起改成更新排序。

本机 Git/Node 客户端需要显式继承系统代理的运维经验继续有效，本轮 push 和 smoke 均使用单次命令代理且未写入配置。首次真实 Obsidian 人机验收、自定义域名、统计、评论和公开邮箱仍需要所有者操作或选择，不进入自动主线。

## 10. 下一轮唯一主任务

为通用内容列表建立日期展示 presenter：当 `updatedAt > publishedAt` 时显示 `UPDATED <updatedAt>`，没有更新或同日时显示 `PUBLISHED <publishedAt>`；项目、文章、专题、标签和关系列表共同使用它，`/archive` 继续保持首发时间线。

覆盖无 `updatedAt`、同日、晚于首发、输入不变、SSR、390px、深色与现有预算；不改变排序、frontmatter、机器接口、客户端请求、数据库或云配置。
