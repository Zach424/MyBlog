# Iteration 0004：构建期内容管线

- 日期：2026-07-18
- 状态：完成

## 1. 范围与成功标准

本轮只实现 Markdown 元数据管线：frontmatter 解析、schema 校验、标签规范化、草稿/未来内容过滤、排序、专题/标签派生索引和首页接线。文章与项目详情路由、正文渲染和代码高亮留到下一轮。

成功标准：至少 3 篇文章和 1 个项目通过同一内容契约；Cloudflare 运行时不读取文件系统；无效字段能指出具体文件；首页不再维护重复数据；单元测试、类型检查、构建和 Worker HTML 测试通过；归档、提交并推送。

## 2. 项目结构状态

```text
build/
  validate-content.ts                 构建前仓库内容校验
content/
  posts/
    building-a-maintainable-blog.md
    cross-platform-npm-scripts.md
    project-charter-before-homepage.md
  projects/
    myblog.md
lib/content/
  contract.ts                         schema、解析、规范化、过滤、统计、索引
  index.ts                            import.meta.glob 与查询接口
tests/
  content-contract.test.mjs           5 个内容契约单元测试
  rendered-html.test.mjs              Worker 首页和 starter 清理集成测试
```

删除了不属于首版目标的 `db/`、`drizzle/`、`examples/d1/`、`drizzle.config.ts`、`app/chatgpt-auth.ts`，以及 Drizzle 依赖和 Worker 的 `DB` 绑定。`.openai/hosting.json` 继续声明 D1/R2 均为 `null`。

## 3. 设计内容

没有新增视觉语言。首页继续以 Commit Trace 为唯一主要识别元素，但日期、类型、标题、摘要、项目状态、技术栈和主题计数全部改为内容管线输出。首页修订号更新为 `REV. 004`，Evidence Rail 的本轮状态更新为 Markdown 内容管线和构建期 schema 校验。

详情路由尚未完成，因此首页记录仍是非交互条目；这是为了不产生指向 404 的假链接。下一轮路由存在后再把标题和导航换成真实稳定 URL。

## 4. 使用的技术

- Vite `import.meta.glob`：把 Markdown 原文打进 Worker bundle；
- YAML `2.9.0`：使用 YAML 1.2 core schema 解析声明式 frontmatter；
- Zod `4.4.3`：字段、枚举、日期、URL 和跨字段校验；
- TypeScript：区分 `PostRecord`、`ProjectRecord` 和派生索引类型；
- Node test：直接导入可擦除 TypeScript 契约模块执行单元测试；
- `@cloudflare/workers-types`：让 Worker 入口纳入项目类型检查；
- Vinext + Vite：在构建配置阶段运行仓库校验，在 Worker 侧消费已打包内容。

## 5. 实现的功能

- 从 Markdown 文件名生成稳定 slug 与 `/posts/`、`/projects/` URL；
- 校验文章、TIL 和项目的全部 v1 frontmatter 字段；
- 校验 `updatedAt`、HTTPS URL、精选草稿、标签数量和重复标签；
- 通过单一注册表规范化标签名称和 tag slug，拒绝未登记标签；
- 过滤草稿和未来发布日期内容；
- 按日期、精选状态和 slug 稳定排序；
- 派生连续专题顺序与跨文章/项目标签索引；
- 同时估算中文字符和拉丁单词的阅读时间；
- Vite 启动/构建前执行相同校验，错误包含来源文件；
- 首页从内容仓库读取 3 篇记录、1 个精选项目和热门主题；
- 新增 3 篇真实学习记录和 1 份按完整结构撰写的项目复盘。

## 6. 实现方法

`contract.ts` 保持为纯解析与校验模块，因此 Node 单测和 Vite 构建可以复用。`index.ts` 是唯一依赖 `import.meta.glob` 的运行时边界：它在打包时导入原文，模块初始化时解析，然后只向页面暴露已发布结果和派生索引。

`validate-content.ts` 只在 Node/Vite 配置阶段使用文件系统。`vite.config.ts` 在创建构建环境前调用它，使单独执行 `npm run build` 也会因无效内容失败；生产 Worker 本身没有文件系统依赖。

frontmatter 边界由项目代码显式拆分，再交给 YAML core schema。JavaScript 标签、自定义可执行类型和 YAML alias 均不进入内容能力范围。

## 7. 验证证据

- 内容契约单测：5/5 通过，覆盖正常解析、来源路径、日期、HTTPS、草稿、未知标签、专题顺序与发布时间过滤；
- `npm run lint`：通过；
- `npm run typecheck`：通过；
- `npm run build`：通过，五个 Vinext 环境构建完成，未出现解析器 `eval` 警告；
- Worker HTML 测试：2/2 通过，首页内容与主题计数来自 Markdown；
- `git diff --check` 与 Markdown 本地链接检查：在提交前通过。

首次完整测试失败是断言把 TypeScript 标签计数预期为 3，实际内容中是 2，而 Design Systems 才是 3。修正为验证真实派生结果，并移除 React 服务端渲染插入的空注释后再比较可见文本；产品逻辑未改动。

## 8. 经验与教训

- `gray-matter` 默认会把支持 JavaScript frontmatter 的直接 `eval` 引擎带进 Worker 包；即使不调用也会产生构建警告，因此改为显式 YAML 解析；
- “构建期校验”不能只依赖页面被请求后才执行，必须在 Vite 配置阶段主动遍历内容；
- 标签索引测试应验证内容实际产生的计数，不应沿用首页手写数据的直觉；
- TypeScript 检查暴露出未使用的 D1 starter 与项目架构冲突，删除无用能力比伪造环境类型更可靠；
- 解析、索引和 Vite glob 分层后，契约可以在 Node 中独立测试，Cloudflare 边界也更清晰。

## 9. 全局状态、风险与未解决问题

- 工程与归档基线：done；
- 内容契约与元数据管线：done；
- 设计系统与正式首页：done；
- Markdown 正文渲染：pending；
- 文章、项目、专题、标签、关于页面：pending；
- 发布与部署：partial，基础 SEO/OG 完成，Cloudflare 尚未上线。

风险：正文渲染器、目录和代码高亮仍需控制 Worker bundle 体积；系统字体跨平台折行仍待浏览器验收；作者简介、联系方式和最终域名尚未确定。

## 10. 下一轮唯一主任务

实现 Markdown 正文渲染与核心内容路由：文章、项目、专题、标签和关于页面使用稳定 URL，并把首页记录与导航切换到这些真实路由。
