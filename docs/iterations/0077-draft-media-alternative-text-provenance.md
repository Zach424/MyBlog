# Iteration 0077：草稿媒体替代文本来源证据

## 1. 范围与成功标准

本轮只解决一个问题：最终替代文本非空，并不代表作者真正写过描述。`PreparedAttachmentUsage` 必须为每次 `altTexts` 提供一一对应的 `altSources`，值只能是 `authored` 或 `filename-fallback`；正式 `coverAlt`、Markdown alt 和明确的 Wiki display 归为 authored，无 display 或仅尺寸 display 的 Wiki 图片归为 filename-fallback。后者保留最终文件名文本以便诊断，但必须由 `attachment-alt-filename-fallback` 阻塞发布。

成功标准是 readiness JSON 升至 version 5、插件升至 1.28.0，CLI 与 Obsidian 都能显示来源并让回退进入 `WILL FAIL`；实现继续复用正式图片归一化和 Zod cover 结果，不增加第二套解析器、图片读取、自动文案、Git 操作或网络/云 API。功能回滚点为 `db4c7381d06dc2c122bf0c04184e47d9ba48bbfd` 的父提交。

## 2. 项目结构状态

运行时目录、App Router 路由和云端结构均未改变。本轮修改集中在：

- `lib/obsidian-publishing.ts`：产生媒体使用点的 alt 来源；
- `lib/inbox-readiness.ts` 与 `lib/content/author-doctor.ts`：version 5 blocker 和终端证据；
- `.obsidian/plugins/myblog-publisher/`：1.28.0 严格消费、账本标签和失败色；
- 四个对应测试文件：锁定生产、报告、插件消费和 doctor 输出契约。

按仓库 `AGENTS.md` 要求，写代码前完整复核了 Next.js 内置 TypeScript 指南；本轮没有改动 Next.js API、配置或运行时约定。

## 3. 设计内容

媒体账本继续使用现有双列结构、等宽技术标签和 Obsidian 主机 Token。每条 alt 只把标签扩展为 `ALT · L<n> · AUTHORED/FILENAME FALLBACK`；回退与空值共用现有 `--text-error` 失败语义。没有增加卡片、徽章、操作按钮、字体或新颜色，信息层级仍是“用途与转换 → alt 证据 → 路径与媒体事实”。

## 4. 使用的技术

- TypeScript 字面量联合类型描述封闭来源集合；
- 既有 Markdown/Wiki 图片归一化回调在构造最终 Markdown 的同一位置登记正文来源；
- Zod 正式 cover 解析结果把 `coverAlt` 固定为 authored；
- version 5 JSON 把来源与文本、行号、次数组成等长数组；
- CommonJS Obsidian 插件进行长度、枚举、cover 语义和 blocker 双向校验；
- 原生 DOM `setText` 与 CSS 主机 Token 渲染安全只读证据；
- Node test runner、TypeScript、ESLint、Next build 和发布审计作为门禁。

## 5. 实现的功能

- 所有 COVER/BODY 媒体出现点现在都有可验证的 alt 来源；
- Wiki 文件名回退不再冒充合格替代文本；
- 同一附件的回退问题按附件聚合，并保留角色、行号和来源路径；
- CLI 输出 `AUTHORED` 或 `FILENAME FALLBACK`，回退追加 `WILL FAIL`；
- Obsidian 媒体账本显示同一来源标签，并用既有错误色标出阻塞证据；
- 插件对来源缺失、长度漂移、未知枚举、cover 回退和 blocker 不一致全部失败关闭。

## 6. 实现方法

先改测试并运行四个目标套件，得到 45/182 失败：生产者没有 `altSources`、schema 仍是 4、新问题码与插件 DOM 标签不存在、插件和 doctor 仍为 1.27。随后在最终图片语法产生的位置登记来源，升级 readiness/doctor/plugin 契约并补齐只读界面。

第一次实现后通过 181/182；唯一失败来自一个专门测试全局 blocker 的 fixture，其中两张无 display Wiki 图片按新规则合理新增了回退问题。该 fixture 改为明确 display，让它继续只验证原目标，而不是放宽新规则。

## 7. 验证证据

- 目标测试：`182/182` 通过；
- `git diff --check`：通过；
- `npm run lint`：通过；
- `npm test`：`343/343`，TypeScript 通过，Next 构建 45/45 页，应用测试 19/19；
- `npm run release:check`：完整通过，耗时约 147 秒；
- `npm audit --omit=dev --audit-level=high`：0 个漏洞；
- 真实 `npm run content:inbox -- --format json`：version 5、空 inbox，所有安全声明为 false；
- 功能提交：`db4c7381d06dc2c122bf0c04184e47d9ba48bbfd`；远端 [Quality Gate #137](https://github.com/Zach424/MyBlog/actions/runs/31055038601) 与 [Verify Vercel production #130](https://github.com/Zach424/MyBlog/actions/runs/31055075919) 均成功。

## 8. 经验与教训

- “最终文本非空”和“作者提供可用描述”是两个不同契约，来源必须成为结构化证据；
- provenance 应在最终语法构造处产生，避免消费者反推原始 Markdown；
- blocker 与证据需要双向核对，否则问题列表和媒体账本可能各自看似正确却互相漂移；
- 依赖隐式 Wiki 回退的旧 fixture 要明确表达测试意图，不能靠放宽生产规则维持通过；
- 在既有技术标签中加入来源，比新增视觉组件更适合高密度诊断界面。

## 9. 全局状态、风险与未解决问题

草稿媒体链现已覆盖来源路径、仓库目标、公开 URL、变换事实、使用角色、行号、最终 alt 及其作者来源。旧 version 4 报告会被 1.28.0 插件失败关闭，升级后需要在 Obsidian 重载插件。真实 inbox 当前为空，因此真实命令只验证空集合安全状态，复杂输入由 fixture 覆盖；尚未做 Obsidian 桌面像素级截图验收。作者已经能看到准确行号，但仍需手动定位；超长 alt 和大量媒体仍可能拉长 Modal。报告仍是本地 JSON + `setText`，无遥测；Cloudflare 仍不在当前运行依赖中。

## 10. 下一轮唯一主任务

Iteration 0078：让每条 ALT 证据安全导航到准确源行。只复用 version 5 `sourceLines`；点击时重新验证冻结/活动来源路径、Vault `TFile` 和行号边界，再打开本地编辑位置。不得修改内容、自动修复、启动发布事务、访问网络或云 API。
