# Iteration 0013：Obsidian 本地写作与发布

## 1. 范围与成功标准

本轮目标是让仓库可以直接作为 Obsidian Vault，并提供不依赖 Codex 的本地草稿、模板、附件、内容检查、移动、提交和推送链路。成功标准是半成品不进入博客构建；文章/TIL/项目模板与正式 schema 一致；发布失败可恢复；自动 Git 提交不混入其他暂存内容；桌面插件和 CLI 使用同一实现。

## 2. 项目结构状态

新增 `.obsidian` Vault 设置与自带桌面插件、`templates/obsidian` 三种模板、`content/inbox` 收件箱、`lib/obsidian-publishing.ts` 纯准备逻辑、`scripts/publish-note.mjs` CLI 和对应测试。`package.json` 新增 `content:publish`；Git 忽略每台设备的 workspace/cache，不忽略可复用 Vault 配置。

## 3. 设计内容

Obsidian 入口不引入第二套可视后台，设计重点是文件状态：inbox 表示尚未进入构建，`draft: true` 表示仍不可公开，正式目录 + `draft: false` 才是发布候选。模板章节按文章、TIL 和项目实际叙事结构组织，让填写顺序本身承担内容质量提示。

## 4. 使用的技术

- Obsidian Vault、核心 Templates 与标准 Markdown/Properties；
- Obsidian 桌面 Plugin API、`FileSystemAdapter` 与命令面板；
- Node.js `spawnSync`/`spawn` 参数数组，`shell: false`；
- 现有 YAML/Zod 内容契约；
- Git 精确 pathspec 提交和 GitHub 自动部署；
- Node test 对草稿、附件、路径和插件静态边界做回归。

## 5. 实现的功能

1. 仓库根目录可作为 Vault，默认新笔记进入 `content/inbox`；
2. 附件默认保存到 `public/uploads`，构建/依赖目录不进入 Obsidian 索引；
3. 文章、TIL 与项目模板自动带日期、文件名 Slug、草稿状态和结构提纲；
4. `检查当前草稿` 命令只验证当前 inbox 笔记；
5. `发布当前草稿并同步 GitHub` 关闭草稿、移动到正确集合、全量检查、提交和推送；
6. Wiki embed 与指向 `public/uploads` 的相对链接规范化为 `/uploads`；
7. 缺失/不安全附件、错误 Slug、未知标签、无效内容类型和已有目标都会阻止发布；
8. 全量检查失败时恢复原始 inbox 草稿；Git 暂存区不为空时拒绝自动提交。

## 6. 实现方法

收件箱位于正式内容 glob 之外，使自由书写不会破坏开发服务器或 CI。模板要求先用 ASCII Slug 创建文件，Obsidian 的 `{{title}}` 再把文件名写入 frontmatter。发布准备函数推断文章/项目类型、关闭 draft、规范化附件并调用正式 `parsePostFile`/`parseProjectFile`；没有平行的“宽松 Obsidian schema”。

桌面插件不直接改 frontmatter 或实现 Git，而是用 `spawn` 参数数组调用受测试 CLI；`shell: false` 避免当前文件名进入 shell 解释。CLI 记录原始正文，写入正式文件后运行全量检查，失败时按原字节语义恢复 inbox。`--push` 检查暂存区，只 add 源/目标/引用附件，然后创建内容提交并推送 main。

## 7. 验证证据

- ESLint 与 TypeScript 通过；
- 26/26 单元测试通过，其中 5 条覆盖文章准备、项目推断、Obsidian 附件规范化、危险路径/Slug/元数据和插件命令安全边界；
- 临时真实 inbox 草稿执行 `npm run content:publish -- ... --check-only`，返回正式目标路径和 0 个附件；命令未移动、未创建正式文件，临时草稿随后删除；
- 8/8 Worker 集成测试与 6/6 发布审计通过；生产依赖审计为 0 个已知漏洞；Wrangler 干跑读取 32 个静态文件，总上传 `2633.55 KiB`、gzip `627.20 KiB`，无绑定；
- 真实 Obsidian UI 命令和远端推送需要作者在桌面 Obsidian 启用本地插件，当前自动证据不替代该联调。

## 8. 经验与教训

把正式内容目录直接设为默认新建位置，会让一个空白 Obsidian 笔记立刻破坏整个博客构建。Inbox 是必要的状态边界，不只是整理习惯。

Obsidian 附件语法与博客 URL 不同。要求作者每次手工改链接不可靠；发布边界自动规范化 Wiki embed 和相对路径，再检查目标文件存在，才能让拖放图片成为真正可用的工作流。

“一键发布”不能等于 `git add .`。限定暂存 pathspec、拒绝已有 staged 内容、在提交前运行完整检查，使便利动作仍然保留可解释的提交边界。

## 9. 全局状态、风险与未解决问题

网页与 Obsidian 双入口的代码和文档完成，二者共享 Git、内容 schema 和附件目录。Obsidian 发布插件只支持桌面，因为它需要本机 Node/Git；移动端可以继续写 inbox，但发布要回到桌面或 `/studio`。真实 Obsidian 启用、GitHub OAuth、Cloudflare secrets 和新 origin 仍待作者账号联调。

## 10. 下一轮唯一主任务

完成所有者账号迁移清单、生产切换/回滚脚本与端到端验收：Cloudflare 自动部署、Studio OAuth、Obsidian 发布、线上路由和旧 Sites 保底。
