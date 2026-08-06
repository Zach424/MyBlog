# Iteration 0079：草稿链接引用精确源码行导航

## 1. 范围与成功标准

本轮只解决一个问题：`LINK TRACE` 已能证明每个精确站内目标的类型、公开路径、出现次数和全部源码行，但作者仍要手动寻找引用。每个 occurrence 必须成为独立的 `REF · L<n>` 原生键盘按钮，并复用 Iteration 0078 已验证的来源行导航守卫；公开目标代码块继续只读，避免同时承担“公开跳转”和“本地定位”两种含义。

成功标准是插件升至 1.30.0，readiness 继续使用 version 5；ALT 与 REF 共享一个 Modal single-flight，导航成功才关闭 Modal，任何路径、文件、异步读取、行界、视图或宿主失败都保留现场。实现不写正文、不自动修复、不执行检查/发布/Git，也不访问网络或云 API。功能提交为 `bb0b1b0e822321c913f0ae36a05ebe002bcc7c9b`；回滚应使用 `git revert bb0b1b0e822321c913f0ae36a05ebe002bcc7c9b`，其父提交为 `e87cc09a0ec42dd12c43de6a1584065750645651`。

## 2. 项目结构状态

App Router、公开页面、内容目录、readiness schema、发布脚本和部署配置均未改变。功能提交只修改七个既有文件：

- `.obsidian/plugins/myblog-publisher/main.js`：REF occurrence 渲染、封闭 evidence kind 与通用导航守卫；
- `.obsidian/plugins/myblog-publisher/manifest.json`：版本 1.30.0；
- `.obsidian/plugins/myblog-publisher/styles.css`：ALT/REF 共享动作样式与 occurrence 布局；
- `lib/content/author-doctor.ts`：期望插件版本；
- `tests/author-doctor.test.mjs`、`tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：版本、DOM、导航和失败关闭回归。

按仓库 `AGENTS.md` 要求，写代码前完整复核了 Next.js 16.3 内置 TypeScript 指南 561 行。本轮没有修改 Next.js API、路由、配置、类型生成或运行时约定。

## 3. 设计内容

LINK TRACE 的 post/project/self 与公开目标仍是事实列；原聚合行号被展开成 `REF · L<n>`，每次引用与动作一一对应。REF 直接复用 ALT 的透明 reset、下划线、宿主 hover/focus 和执行中 disabled，不增加卡片、页脚 CTA、新颜色、字体、阴影或动画。多次引用继续显示 `×n`，避免展开后丢失总量证据。

可访问名称包含行号、链接类型和完整目标。宽屏仍是“类型 / 目标 / occurrence”三列，窄屏折成单列并把按钮左对齐；公开目标不变成按钮，确保每个元素只承担一个清晰任务。

## 4. 使用的技术

- version 5 `internalLinks[].sourceLines` 作为唯一 occurrence 来源，不重新解析 Markdown；
- 原生 DOM button、`type=button`、`aria-label` 与 `title` 提供键盘和辅助技术语义；
- `ALT|LINK` 封闭 evidence kind 进入同一个 `openDraftIntentSourceLine`；
- Modal `navigating` lease 同时禁用所有 ALT/REF jump button，阻止跨证据重复打开；
- `vault.read`、冻结 `TFile` 身份、`WorkspaceLeaf.openFile`、活动 `MarkdownView` 和 Editor 双重行界继续组成守卫；
- CSS flex-wrap 保持 occurrence 密度，宿主 token 负责 hover、focus 与 disabled；
- Node harness 记录打开状态、cursor、scroll、focus、Vault 读取、写入尝试和子进程数量。

## 5. 实现的功能

- 每个 LINK occurrence 独立显示 `REF · L<n>`，同一目标的重复引用不会被折叠成单个动作；
- POST/PROJECT/SELF、最终目标与 `×n` 保持可见；
- 点击 L22 会打开冻结草稿并定位为 Editor `{ line: 21, ch: 0 }`，滚动、聚焦后才关闭 Modal；
- 同一按钮双击只执行一次，ALT 与 REF 也共享同一执行锁；
- LINK 越界使用 LINK 专属 Notice，保持 Modal、文件内容和 Editor 不变；
- 所有既有 ALT 漂移、文件替换、异步变化、Editor 漂移、视图缺失和打开失败条件继续由同一实现覆盖；
- 没有增加发布、检查、修复、外部跳转、子进程或网络动作。

## 6. 实现方法

先只修改测试与期望版本，运行三组目标套件，得到 29/185 失败。三项直接失败分别是 LINK 按钮不存在、LINK 成功导航不存在和 LINK 越界失败关闭不存在；其余是测试先要求 1.30.0，而实现/doctor/manifest 仍为 1.29.0 造成的预期联锁级联。

实现阶段把 LINK 的 `sourceLines` 逐次渲染为按钮，把 ALT 的默认参数显式化，再把 evidence kind 限制为 `ALT|LINK`。导航守卫本身不复制；所有 Notice 根据已验证 kind 标明证据类型。CSS 将 REF 加入 ALT 的四组状态选择器，只额外增加 occurrence 容器。实现后同一目标套件 185/185 通过，没有放宽 schema、发布动作或失败条件。

## 7. 验证证据

- 失败优先：29/185 失败；
- 目标测试：185/185 通过；
- `git diff --check`：通过；
- `npm run lint`：通过；
- `npm test`：354/354，TypeScript 通过，Next 构建 45/45 页，应用测试 19/19；
- `npm run release:check`：完整通过；
- `npm audit --omit=dev --audit-level=high`：0 个漏洞；
- 真实 author doctor：插件 1.30.0、13/13、`ready`；
- 真实 inbox report：version 5、空 inbox，四项安全声明均为 false；
- 真实 doctor/inbox 命令前后 worktree 状态完全相同；
- 功能提交已由远端 [Quality Gate #141](https://github.com/Zach424/MyBlog/actions/runs/31059328687) 与 [Verify Vercel production #134](https://github.com/Zach424/MyBlog/actions/runs/31059368545) 验证成功。

## 8. 经验与教训

- 聚合证据和逐次动作可以共存：`×n` 保留总量，REF 按钮保留每个可定位 occurrence；
- 公开目标代码块不应同时承担本地编辑导航，分离动作能避免含义歧义；
- 当两个证据类型的安全条件完全相同时，传递封闭 kind 并复用一个守卫优于复制两套方法；
- single-flight 应覆盖整个 Modal，而不是每个按钮，否则 ALT 与 REF 可以并发打开同一文件；
- 先升级测试中的版本镜像会产生大量 doctor 级联失败，但它准确证明 manifest、实现、doctor 和测试必须原子推进；
- 响应式技术账本不需要新组件，flex-wrap 与已有三列/单列断点足以保持高密度证据可读。

## 9. 全局状态、风险与未解决问题

当前草稿作者意图已经能从媒体 ALT 和站内 LINK 两类逐次证据回到编辑器。readiness v5、正式 Markdown 关系、知识图谱、媒体变换、发布/复核事务、Git 恢复和 Vercel 公开站均未改变。真实 inbox 仍为空，因此实际复杂草稿由 fixture 验证；尚未在真实 Obsidian 桌面主题中完成像素和完整交互验收。

核心残余风险是 version 5 没有内容指纹：同一 `TFile` 在报告生成后被编辑，只要路径、对象身份和目标行仍存在，ALT/REF 仍会定位到当前 L<n>，无法证明它与报告时的语义一致。另有超长 trace 列表的筛选/折叠需求，但目前没有真实规模证据，应排在正确性之后。功能仍完全本地，无遥测、Cloudflare 或其他云 API 依赖。

下一步候选为：来源内容 SHA-256、行上下文摘要、超长 trace 筛选。选择 SHA-256，因为它同时保护摘要打开与两类导航，是当前证据链最基础的缺口；上下文和筛选留待有真实草稿规模证据后再评估。

## 10. 下一轮唯一主任务

Iteration 0080：给 source-scoped inbox readiness entry 增加基于原始草稿字节的 SHA-256；Obsidian 在打开摘要和执行任一 ALT/REF 导航前重新读取并精确匹配，内容变化即失败关闭。升级版本化报告并让旧版本失败关闭，但不改写正文、不自动重跑报告、不执行发布事务、Git、网络或云 API。
