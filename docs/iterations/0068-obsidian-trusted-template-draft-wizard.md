# Iteration 0068 · Obsidian 受信模板新建草稿向导

日期：2026-08-06
状态：完成
唯一主任务：让作者不依赖 Codex 或终端，从 Obsidian 的固定 Article、TIL、Project 模板安全创建并打开一个本地 inbox 草稿。

## 全局复核与范围

Iteration 0067 已闭合四类发布/复核事务从 doctor、single-flight、活动脉冲到会话内终态回执的观察链。当前作者链路最明显的重复操作变成：手工复制三个模板之一、创建 `content/inbox/<slug>.md`、替换标题与三处日期，并自行避免撞上已有草稿或正式内容。本轮只消除这个起点摩擦；既有发布、复核、Git 交付、Studio、内容模型与站点页面都不改。

明确不做：

- 不从中文标题猜测或静默规范化 slug；稳定身份仍由作者明确决定；
- 不覆盖、改名或删除任何已有 Vault 文件；
- 不移动附件，不运行 doctor/npm/发布脚本，不暂存、提交、推送或访问网络；
- 不把单任务 Modal 扩张成模板管理器、草稿列表、进度仪表盘或历史记录；
- 不修改 Next.js 源码，因此本轮按 `AGENTS.md` 无需读取 `node_modules/next/dist/docs/` 编码指南；
- 不依赖真实 Obsidian 宿主手工验收、云 API 或新的外部集成；宿主差异作为剩余观察风险保留。

## 项目结构状态

本轮代码提交触及七个功能文件：

- `.obsidian/plugins/myblog-publisher/main.js`：插件契约升到 1.19.0；增加 draft kind allowlist、输入/模板/路径验证、渲染、Vault 排他创建、打开结果和原生创建 Modal；
- `.obsidian/plugins/myblog-publisher/styles.css`：增加单一 `.myblog-draft-create` 作用域，定义原生表单层级、提示、错误和动作间距；
- `.obsidian/plugins/myblog-publisher/manifest.json`：版本与能力描述同步到 1.19.0；
- `lib/content/author-doctor.ts`：doctor 期望插件版本同步到 1.19.0；13 项报告 schema 与安全语义不变；
- `tests/obsidian-plugin.test.mjs`：Vault/DOM 测试桩增加 cached read、排他 create、创建账本、打开失败与控件状态；增加正向、输入、漂移、碰撞、竞态和打开失败合同；
- `tests/obsidian-publishing.test.mjs`：静态锁定新命令、Modal 与 Vault API 边界；
- `tests/author-doctor.test.mjs`：同步 1.19.0 夹具。

归档提交更新 `content/inbox/README.md`、`content/projects/myblog.md`、`docs/STATUS.md`、`ROADMAP.md`、`DESIGN.md`、`ARCHITECTURE.md`、`OPERATIONS.md`、`PUBLISHING.md` 和本文件。仓库根仍是 Obsidian Vault；GitHub 仍是内容、附件、版本与回滚的唯一事实源；生产仍为 Vercel 原生 Next.js，不依赖 Cloudflare。

## 设计内容

使用 `frontend-design` 的影响是把入口限制为一个清晰任务，而不是复用报告账本或堆叠装饰组件：

- 顶部按 `DRAFT ORIGIN / LOCAL ONLY` → “新建博客草稿” → 零发布/零提交/零网络边界排列；
- 表单顺序固定为内容类型、标题、英文 slug，三类 option 同时给中文语义与 `ARTICLE / TIL / PROJECT` 技术 token；
- 标题提示说明 YAML 转义，slug 提示说明小写字符合同和 inbox/posts/projects 三命名空间检查；
- 只有取消和“创建草稿”两个动作；打开时聚焦标题，提交时临时禁用全部控件；
- 错误使用同一表单中的安全文本节点、`role=alert`、`aria-live=polite` 与宿主 error token；失败后控件恢复，不使用弹窗堆叠；
- 创建成功关闭 Modal；打开失败用 Notice 区分“文件已创建”和“便利动作失败”，并显示精确路径；
- 只使用 Obsidian 宿主字体、颜色和标准控件，加一条 Trace 边界线；没有卡片、阴影、渐变、图标、动画、步骤条或虚构完成率。

## 技术与实现方法

### 受信输入

`DRAFT_CREATION_KINDS` 是冻结 allowlist：

| kind | 模板 | 必需类型特征 | 初始语境 |
| --- | --- | --- | --- |
| `article` | `templates/obsidian/article.md` | `type: article` | `freshness: historical` |
| `til` | `templates/obsidian/til.md` | `type: til` | `freshness: historical` |
| `project` | `templates/obsidian/project.md` | `status: planning` | `freshness: current` |

标题必须是 trim 后 1–120 字符的单行文本；换行与 NUL 失败。slug 必须是 1–80 字符且精确匹配 `^[a-z0-9]+(?:-[a-z0-9]+)*$`。不接受 `post` 别名，不改变大小写，不移除危险字符，也不从标题自动派生。

### 模板漂移门

插件只对 Vault 返回的精确 Markdown template file 调用 `vault.cachedRead`。规范化换行后，模板必须同时满足：

- frontmatter 以 `---` 开始且有闭合边界；
- 唯一 `title: ""` 与唯一 `slug: "{{title}}"`；
- 恰好三个且按模板顺序出现的 `{{date:YYYY-MM-DD}}`；
- 唯一 `draft: true`、`featured: false`；
- kind 对应的两条特征行；
- 不含任何额外 Mustache token。

标题由 `JSON.stringify` 生成合法 YAML 双引号标量，因此引号、反斜杠和 Unicode 不会逃出 frontmatter。slug 已由 ASCII allowlist 证明，可安全写为无引号标量。日期通过 `Intl.DateTimeFormat(..., timeZone: "Asia/Shanghai")` 的 year/month/day parts 派生并再次按 ISO 日期验证。渲染后残留 token 会再次失败。

### 碰撞与原子边界

同一 slug 的三个路径始终一起检查：

```text
content/inbox/<slug>.md
content/posts/<slug>.md
content/projects/<slug>.md
```

第一次检查发生在模板读取前，避免无意义读取；第二次发生在异步读取/渲染后、写入前，缩小竞态窗口。最终只调用一次 Obsidian `vault.create(path, content)`；该 API 不覆盖已存在文件，负责仲裁两个 Modal 或同步程序在最后检查后的抢先创建。Modal 自身在第一次 click 的同步段设置 `submitting=true`，因此同一按钮双击不会发出第二次异步请求。

创建失败时 Modal 只显示错误并恢复输入，不调用 open、不删除或修改任何路径。创建成功后才调用 `getLeaf(false).openFile(file)`；打开失败不会回删，因为文件已成为新的作者资产，删除可能与同步或作者编辑发生竞争。方法返回冻结的 `{ file, opened, path }`，由 Modal 选择精确 Notice。

## 实现功能

- 命令面板新增 `MyBlog Publisher: 新建博客草稿`，仅桌面 Vault 可用；
- Article、TIL、Project 与三个仓库模板一一映射；
- 作者填写标题与稳定 slug，模板自动写入上海当天的 publishedAt/updatedAt/reviewedAt；
- 标题中的引号、反斜杠和中文可安全进入 YAML；
- 非法类型、空/多行/超长标题、非法/超长 slug 在模板读取前拒绝；
- 模板缺失、预填标题、未知 token、类型特征漂移在写入前拒绝；
- inbox、posts、projects 任一路径同 slug 均阻断；
- 同按钮重复提交和最终 create 竞态都不会产生两个文件；
- 成功后立即打开新草稿；打开失败保留文件并告知精确路径；
- 全流程没有 child process、Git 或网络副作用。

## 失败优先与验证证据

`research-iteration-loop` 使本轮保持“一条作者起点链路、先失败证据、真实 doctor、两次完整门、功能/归档分提交”的节奏。

失败优先基线：

- 扩展测试桩并加入五组新合同后，旧插件运行 `node --test tests/obsidian-plugin.test.mjs`：75 tests，其中既有 53 pass、新合同 22 fail；失败原因全部是命令与 `createDraftFromTemplate` 尚不存在，既有行为无回归。

实现后：

- `node --test tests/obsidian-plugin.test.mjs`：75/75；
- `node --test tests/obsidian-plugin.test.mjs tests/obsidian-publishing.test.mjs tests/author-doctor.test.mjs`：93/93，用时约 4.53 秒；
- 真实 `npm run content:author:doctor -- --format json`：ready，13/13、11/11 脚本、32/32 固定依赖、5/5 路径、MyBlog Publisher 1.19.0，且 `configurationChanged/filesChanged/credentialsRead/networkChecked` 全为 false；
- 第一次 `npm run release:check`：用时 103 秒；Current 1 / Historical 3、inbox 0、根暂存 0、HTTPS 2 URL / 3 occurrences / 0 本地问题、ESLint、259/259 单元与集成、TypeScript、45/45 页面、19/19 生产应用测试、production audit 0；
- 归档后的第二次 `npm run release:check`：用时 119.4 秒；259/259 单元与集成、TypeScript、45/45 页面、19/19 生产应用测试与 production audit 0 再次通过；Current 1 / Historical 3、inbox 0、根暂存 0 与外链本地问题 0 保持不变。

## Git 与远端交付

- 功能提交：`158e7ffd2ec7c4cf472e77b05b3aede0bce2e3ad`，`feat: create Obsidian drafts from trusted templates`；
- 功能提交已推送 `origin/main`；
- GitHub Quality Gate：run `31032881522`，completed/success；
- Verify Vercel production：run `31032925907`，completed/success；
- Vercel commit status：success，deployment completed；
- 功能提交远端合计 3/3 success；
- 本文件随独立归档提交交付；提交 identity 由本文件的 Git history 固定，不在内容中自引用尚未生成的 hash。

## 经验与判断

1. 新建文件不是“把字符串写到路径”这么简单；模板、输入、全局稳定 slug 和异步宿主 API 共同构成一个小事务。
2. 中文标题不适合生成英文稳定 slug。显式输入增加一个字段，但避免不透明音译、重名和发布后 URL 漂移。
3. 模板只按文件路径信任不够；若占位符或关键字段被作者改掉，静默替换可能生成看似正常但无法发布的草稿。运行时结构检查让漂移尽早且可解释地失败。
4. 预检永远不能替代排他写入。两次存在性检查改善错误信息，真正的竞态边界仍必须由 `vault.create` 仲裁。
5. “创建成功、打开失败”不是回滚条件。创建是资产边界，打开只是便利动作；混为一谈会带来误删和重复创建风险。
6. 双击保护必须在第一个 `await` 之前同步设置；若等模板读完才禁用，两个 handler 已经同时进入事务。
7. 使用宿主原生表单、清晰提示和一个主动作，比引入新的组件系统更适合低频但高风险的作者入口。

## 风险与下一步

- 自动测试覆盖 DOM/CSS 合同与 Vault API 语义，但没有固定真实 Obsidian 版本的宿主像素截图；首次日常使用应观察控件宽度、聚焦和错误文案，不把像素差异视为数据失败；
- `vault.create` 的底层错误文本由宿主提供，Modal 只保证前缀和“不覆盖”边界；后续不应按平台错误字符串分支业务逻辑；
- 模板检查有意严格。未来正式调整模板字段时，应同时更新 allowlist 检查、测试和文档，而不是放宽为任意文本替换；
- 创建后草稿若改变 slug，当前仍需手工同步文件名与 frontmatter。下一轮唯一主任务是先验证 Obsidian Vault rename/modify 是否能提供足够强的双字段一致性与失败恢复；不能证明安全时只做只读诊断。

## 结论

MyBlog Publisher 1.19.0 已把作者本地流程的起点从手工文件操作收敛为一个可验证的 Vault 原子创建事务。作者现在可以独立选择内容类型、标题与稳定 slug，得到已经使用受信模板和正确日期的 inbox 草稿；所有危险输入、模板漂移与同 slug 冲突都在覆盖发生前停止。既有发布与交付系统没有被扩大或耦合，站点继续由 GitHub/Vercel 自动公开且不依赖 Cloudflare。
