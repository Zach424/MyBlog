# Iteration 0078：草稿媒体 ALT 精确源码行导航

## 1. 范围与成功标准

本轮只解决一个问题：作者在当前草稿发布意图中看到 `ALT · L<n> · AUTHORED/FILENAME FALLBACK` 后，应能直接回到同一草稿的精确源码行。每个既有 ALT 标签必须成为原生键盘按钮；点击时重新验证安全来源路径、冻结时的 `TFile`、当前活动 inbox、Vault 当前映射，以及磁盘和编辑器的行号边界。成功才打开目标行并关闭 Modal；任何漂移、越界或宿主失败都保留 Modal 并给出明确 Notice。

成功标准是插件升至 1.29.0，readiness 继续使用 version 5；导航只在本地 Obsidian 中发生，不写入正文、不自动修复、不启动检查/发布/Git、不访问网络或云 API。重复点击必须 single-flight。功能提交为 `99ea0ed0699da3f07fa5691e871de38742772dee`；如需撤销本轮功能，应使用 `git revert 99ea0ed0699da3f07fa5691e871de38742772dee`，其父提交为 `9ef801a05b6879250d60e246d7b2360b57027009`。

## 2. 项目结构状态

App Router 路由、公开页面、内容目录、云端结构和部署配置均未改变。功能提交只修改七个既有文件：

- `.obsidian/plugins/myblog-publisher/main.js`：导航守卫、Modal 单航班和 Editor 定位；
- `.obsidian/plugins/myblog-publisher/manifest.json`：版本 1.29.0；
- `.obsidian/plugins/myblog-publisher/styles.css`：原账本标签的按钮、hover、focus 和 disabled 状态；
- `lib/content/author-doctor.ts`：期望插件版本；
- `tests/author-doctor.test.mjs`、`tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：版本和导航契约回归。

按仓库 `AGENTS.md` 要求，写代码前完整复核了 Next.js 内置 TypeScript 指南的 561 行；本轮没有改动 Next.js API、配置或运行时约定。Obsidian 本地类型包不在仓库中，因此只用官方资料确认了 [`workspace.getActiveViewOfType(MarkdownView)`](https://docs.obsidian.md/Plugins/Editor/Editor)、[`WorkspaceLeaf.openFile`、`MarkdownView.editor` 与 Editor 定位方法](https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/obsidian.d.ts) 的宿主契约。

## 3. 设计内容

ALT 技术标签本身成为动作，不在媒体项或 Modal 页脚增加第二个 CTA。按钮使用透明 reset 保持既有媒体证据账本；常态下划线表达可操作，hover 使用宿主文字强调色，`:focus-visible` 使用宿主交互描边，执行中的 disabled 只表达单航班状态。可访问名称包含行号、来源类型和最终替代文本。

没有新增卡片、徽章、颜色、字体、阴影、动效或发布动作。信息层级仍是“用途与出现点 → ALT 证据 → 路径与媒体变换”，视觉上仍由证据而不是控件主导。

## 4. 使用的技术

- Obsidian `MarkdownView` 与 `workspace.getActiveViewOfType` 验证活动编辑视图；
- `WorkspaceLeaf.openFile(file, { active: true })` 打开冻结文件；
- Editor `lineCount`、`setCursor`、`scrollIntoView`、`focus` 完成一基行号到零基 `{ line: n - 1, ch: 0 }` 的定位；
- `vault.read` 在打开前只读验证磁盘行界，Editor 在打开后第二次验证当前行界；
- 原始 `TFile` 对象身份和 `vault.getAbstractFileByPath` 映射共同阻止同路径文件替换；
- Modal 内 `navigating` lease 与所有 jump button 的 disabled 状态阻止重复点击；
- Node test harness 模拟 MarkdownView、Editor、打开失败、文件替换、异步漂移和行数漂移；
- Node test runner、TypeScript、ESLint、Next build、发布检查和依赖审计组成门禁。

## 5. 实现的功能

- 每个媒体使用点的 ALT 结构标签都可通过鼠标或键盘导航；
- 成功路径打开同一草稿，将例如 `L24` 定位为 Editor `{ line: 23, ch: 0 }`，滚入视野并聚焦；
- 成功后才关闭意图 Modal；
- 来源路径漂移、活动草稿切换、冻结 `TFile` 被替换、异步读取期间漂移、磁盘越界、Editor 行数漂移、活动视图错误和打开失败均停止导航并保留 Modal；
- 同一 Modal 的连续点击只执行一个打开事务；
- 导航没有增加第二个命令、内容写入、发布调用、子进程、Git 或网络行为。

## 6. 实现方法

先写失败测试并运行插件与 doctor 目标套件，得到 34/165 失败：ALT 标签尚不是按钮、导航方法不存在，且多个版本断言仍要求 1.28.0。实现守卫和界面后，首轮目标套件 165/165 通过；再补充重复点击和 `vault.read` 期间活动草稿漂移，扩大后的目标套件 166/166 通过。

第一次完整 `npm test` 为 351/352；唯一失败来自 `tests/obsidian-publishing.test.mjs` 仍期望 manifest 1.28.0。把该镜像契约同步到 1.29.0 后，三组相关目标套件为 183/183，最终完整门为 352/352。修复的是测试中的版本镜像，没有降低导航或安全条件。

## 7. 验证证据

- 目标测试：`183/183` 通过；
- `git diff --check`：通过；
- `npm run lint`：通过；
- `npm test`：`352/352`，TypeScript 通过，Next 构建 45/45 页，应用测试 19/19；
- `npm run release:check`：完整通过；
- `npm audit --omit=dev --audit-level=high`：0 个漏洞；
- 真实 author doctor：插件 1.29.0、13/13、`ready`，全部安全开关为 false；
- 真实 inbox report：version 5、空 inbox，全部安全声明为 false；
- 功能提交已由远端 [Quality Gate #139](https://github.com/Zach424/MyBlog/actions/runs/31057335870) 与 [Verify Vercel production #132](https://github.com/Zach424/MyBlog/actions/runs/31057368905) 验证成功。

## 8. 经验与教训

- 高密度证据标签可以直接承担局部动作，无需再添加一排通用按钮；
- 只在命令启动前验证路径不够，任何 `await` 之后都要重新验证活动文件和冻结身份；
- 磁盘行界证明报告行号仍可解释，Editor 行界证明打开后的实际缓冲区仍可定位，两者不能互相替代；
- 同路径不等于同文件，Vault `TFile` 对象身份是防止替换漂移的重要证据；
- 宿主视图应使用官方 `instanceof MarkdownView`/活动视图语义，而不是依赖形似 editor 的对象；
- 插件版本被 manifest、doctor 和发布测试共同镜像，升级时应把三者视为一个原子契约；
- version 5 只提供路径与行号，没有正文内容指纹；它能证明当前 L<n> 存在，但不能证明该行语义仍与报告生成时完全相同。

## 9. 全局状态、风险与未解决问题

本轮只影响本地 Obsidian 作者界面。readiness v5、Markdown 解析器、附件转换、发布/复核事务、公开 Next.js 路由、Vercel 和 Cloudflare 历史边界均未改变。真实 inbox 当前为空，因此真实命令只验证空集合安全状态，复杂路径由 fixture 覆盖；尚未在真实 Obsidian 桌面主题中做像素和完整交互验收。

ALT 已能定位，但 `LINK TRACE` 仍是静态行号；超长媒体清单仍可能拉长 Modal。若同一个 `TFile` 内容在报告后发生变化且目标行仍存在，version 5 没有内容指纹来识别语义漂移，导航会落到当前 L<n>。这项限制必须在未来是否扩展 evidence schema 时单独设计，不能在本地导航中猜测。功能仍完全本地，无遥测、Cloudflare 或其他云 API 依赖。

## 10. 下一轮唯一主任务

Iteration 0079：让 `LINK TRACE` 的每次引用证据复用本轮守卫，安全导航到同一当前草稿的精确源码行。继续校验冻结/活动路径、同一 Vault `TFile` 与磁盘/编辑器行界；只增加局部导航，不写内容、不自动修复、不执行发布事务、Git、网络或云 API。
