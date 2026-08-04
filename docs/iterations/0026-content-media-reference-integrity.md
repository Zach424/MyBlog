# Iteration 0026：内容—媒体引用完整性

## 1. 范围与成功标准

项目继续服务同一目标：Markdown、附件、版本和交付由 Git 统一管理，作者可以独立发布，而构建必须在上线前证明所有公开输入完整。Iteration 0025 已保证 Obsidian 产物真实、预算内且可回滚，但媒体文件扫描与正文校验仍彼此独立：不存在的图片 URL 可以进入页面，已删除引用的旧附件也会永久留在 Git。本轮唯一任务是建立正式内容与上传附件的双向引用门禁。

成功标准：解析正式 posts/projects 的正文图片与 `cover`；支持行内和引用式 Markdown，忽略代码示例；本地图片只接受安全 `/uploads/...` 根路径；精确核对仓库大小写和文件存在；已归档 `public/uploads/<slug>/...` 只能由同 slug 内容拥有；无人引用的归档文件阻止构建；draft/future 正式记录仍可拥有附件；`content/inbox` 与根目录暂存附件保持原工作流；外部 HTTPS 图片不进入本地所有权；不改公开 URL、页面 UI、发布事务或外部服务。

回滚边界包括一个 AST 引用模块、一个构建关系校验器、媒体文件清单复用、Next 配置挂载、一个直接依赖、测试与文档。公开组件、内容数据、Studio/OAuth、Obsidian 插件和部署工作流不变。

## 2. 项目结构状态

- `lib/content/media-references.ts`：标准 Markdown AST 图片提取与安全媒体 URL → 仓库路径解析；
- `build/validate-media-references.ts`：加载正式文章/项目和精确媒体清单，校验存在性、大小写、slug 所有权与归档孤儿；
- `build/validate-media.ts`：新增可复用、排序稳定的 `listMediaRepositoryFiles`，原格式/预算扫描行为保持兼容；
- `next.config.ts`：开发和构建启动时并行执行内容、媒体文件和内容—媒体关系三类门禁；
- `tests/content-media-references.test.mjs`：5 项 AST、路径、所有权、孤儿和编辑流边界测试；
- `package.json` / lock：把已由 React Markdown 间接使用的 `mdast-util-from-markdown@2.0.3` 声明为直接生产依赖；
- 当前 `public/uploads` 没有媒体文件，只有历史空目录；现有四条公开内容无需迁移。

## 3. 设计内容

本轮没有新增可见界面，设计对象是“谁拥有哪个文件”的作者心智模型。正式 Markdown 或 cover 从内容指向文件，归档文件必须反向找到同 slug 内容；只有两个方向都成立，资产才可以进入部署。错误文案同时包含内容源、正文行/cover、公开 URL 或仓库路径，使作者能直接修正文或删除孤儿文件。

`public/uploads` 根目录继续承担发布前暂存与 Studio 兼容，不能因为尚未有正式所有者就被删除；进入 `<slug>/` 子目录后即视为归档，必须有所有者。代码示例只用于教学，不能偷偷让真实文件逃过孤儿检查。正式目录中的 draft/future 内容仍是可验证的编辑对象，虽然不进入公开索引，但需要在 PR/Preview 阶段保留附件。

## 4. 使用的技术

- `mdast-util-from-markdown@2.0.3`：按 CommonMark AST 识别 `image`、`imageReference` 与 `definition`；
- TypeScript：结构化图片位置、路径解析与 `ContentRecord` 所有权；
- Node `path.posix`：按 URL 语义检查图片扩展名；
- 现有 `ContentValidationError`：把媒体引用错误绑定到 Markdown 源文件；
- 现有媒体白名单与递归文件扫描：避免复制允许格式和目录规则；
- Next.js 16.3 异步配置：在 dev/build 进入路由编译前并行执行关系门；
- Node test 临时仓库：验证 Windows 大小写陷阱、draft/future、inbox 和根暂存边界。

## 5. 实现的功能

- 抽取正文中的行内 Markdown 图片；
- 解析引用式图片及其 definition；
- 行内代码、围栏代码和普通链接不形成媒体引用；
- `cover` 与正文图片使用同一存在性/所有权规则；
- 完整 HTTPS 外图保持不变，不进入本地文件关系；
- HTTP、协议相对、相对本地路径、查询、锚点、编码分隔符、目录穿越、非法字符和非图片扩展名失败；
- `/uploads/...` 解码为精确 `public/uploads/...`，大小写不一致即使在 Windows 也失败；
- 归档子目录必须等于引用内容 slug，跨内容偷用附件失败；
- 任一已归档文件没有正式 Markdown/cover 引用时构建失败；
- draft/future posts/projects 可以拥有归档文件；inbox 内容不参与，根目录附件可暂时无人拥有；
- 关系结果报告引用次数、唯一已引用文件数、归档文件数和根暂存文件数，便于后续维护报告扩展。

## 6. 实现方法

提取器先对完整正文调用 `fromMarkdown`，第一遍遍历收集 definition，第二遍只消费 `image` 和可解析的 `imageReference`。因此引用定义可位于图片之后，代码节点内部文本不会被当作图片；无需继续扩张手写正则。每个引用保留正文相对行号，诊断可以定位到 `正文第 N 行`。

路径解析先区分完整 HTTPS 外图和本地输入。本地必须以 `/uploads/` 开始；在 `decodeURIComponent` 前拒绝编码 `/`/`\\`，解码后再次检查查询、锚点、控制字符、反斜线、空段、`.`/`..` 与 Windows 非法字符，最后复用共享格式白名单。返回值是规范 `public/uploads/...`，不是操作系统 normalize 后的近似路径。

关系校验器并行加载所有正式 posts/projects 与媒体文件清单。每个本地引用先验证归档目录与当前 `record.slug`，再用 Set 做精确字符串存在性检查，并登记源文件所有者。文件侧随后遍历所有含至少两段相对路径的归档文件，未登记即报孤儿。根目录文件不进入这一步；记录不按 `draft` 或日期过滤，确保 Studio editorial workflow 和未来计划内容的分支构建仍可通过。

`listMediaRepositoryFiles` 从原验证器中抽出，但仍使用同一个递归过程，所以符号链接、非图片和不支持扩展名在两个验证路径中保持相同边界。Next 配置同时运行文件预算与关系门，任何一个失败都阻止 dev/build。

## 7. 验证证据

- 新增引用测试：5/5 通过；覆盖行内/引用式 AST、代码忽略、cover、精确存在、大小写漂移、跨 slug、归档孤儿、安全 URL、draft+future 正式所有者、inbox 忽略与根暂存豁免；
- 针对性 `node --experimental-strip-types --test tests/content-media-references.test.mjs tests/media-policy.test.mjs`：12/12 通过；
- 初次针对性运行发现 Node TypeScript ESM 内部导入缺少 `.ts`，Next 可解析但测试器报 `ERR_MODULE_NOT_FOUND`；统一显式扩展名后通过；
- `npm run lint`、`npm run typecheck`、`git diff --check`：通过；
- `npm run release:check`：维护报告健康、58/58 单元测试、TypeScript、33/33 页面构建、15/15 生产 HTTP/质量测试、production-only audit 0；
- 实现提交、GitHub Quality Gate、Vercel Production 和稳定域名冒烟将在推送后补入本档案。

## 8. 经验与教训

- 文件有效不代表页面有效；只有把内容引用和文件清单交叉验证，才能同时发现 404 和仓库垃圾；
- 用 Markdown AST 比扩张正则更符合真实渲染语义，尤其是引用式图片、definition 顺序和代码边界；
- Windows `access` 无法证明 Linux 路径大小写正确；从 `readdir` 得到原名并做精确字符串集合比再次访问路径更可靠；
- “孤儿”必须先定义生命周期。根目录文件可能是 Obsidian inbox/Studio 尚未发布的输入，直接全目录清理会破坏作者工作流；只有 slug 子目录具备强所有权语义；
- 正式目录里的 draft/future 内容与 `content/inbox` 不同：前者参与 Studio PR/Preview，需要拥有附件；后者尚未进入正式契约，应该保持隔离；
- 代码块中的图片字符串不能形成所有权，否则一段教程示例就能掩盖真实孤儿；
- `cover` 虽然当前尚未渲染，也必须进入关系，否则 Studio 上传的封面会被误判孤儿，且未来展示前无法信任路径；
- 构建期直接导入的 TypeScript 模块要遵循 Node ESM 的显式扩展名约定，不能只依赖 Next bundler 的解析宽容度；
- 依赖已经间接存在不等于可以安全直接 import；把 mdast 解析器固定为直接依赖，升级边界和 lock 归属才清晰。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容契约、附件发布/优化、媒体预算、媒体引用所有权、双向知识链接、自动交付、恢复、新鲜度和维护预警均可用。媒体链路现在同时回答“文件是否安全”和“文件为什么存在”，为后续页面展示与响应式派生建立了可靠源关系。

剩余主要风险：`cover` 可编辑但公开页面完全未渲染；正文图片仍使用普通 `<img>`，没有固有尺寸或响应式多尺寸策略；根目录 Studio 媒体没有强制 per-slug 所有权；post/project 可使用相同 slug，而当前附件命名空间只按 slug 隔离；Studio/普通 Git 图片不自动优化；附件继续增长 Git 历史；Decap 上游依赖、CSP 内联例外、自定义域名、统计、评论与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

让 `cover` 成为真实的响应式详情页媒体：为已验证本地 cover 读取固有宽高，文章和项目共享一个服务端封面组件并用 `next/image` 输出正确 `sizes`、无布局跳动和可访问替代文本；同步加入 metadata/OG 图片选择。没有 cover 的现有内容保持当前布局，新增测试夹具验证 320px、深色模式和生产 HTML，不要求所有者补数据或配置外部图片服务。
