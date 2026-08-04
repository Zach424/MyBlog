# Iteration 0028：响应式 Markdown 正文图片

## 1. 范围与成功标准

项目继续服务同一目标：作者从 Studio 或 Obsidian 写入 Git，构建证明内容和媒体可用，公开页面把学习与项目记录呈现为稳定、可分享的工程资产。Iteration 0027 已让 cover 形成“归档、验证、固有尺寸、响应式展示、社交分享”闭环，但 Markdown 正文仍由 React Markdown 默认 `<img>` 渲染；完整 HTTPS 外图虽通过内容契约，却会被公开 CSP 阻断。本轮只推进这一条纵切，不扩展数据库、编辑器或外部服务。

成功标准：本地正文图片继续使用现有 Markdown alt；构建期按正文 URL 找到仓库文件并读取真实宽高；文章和项目复用同一服务端媒体层；`next/image` 的 `sizes` 与 48rem 阅读栏、55rem 单列和 42rem 移动留白一致；多图、重复引用和引用式图片正确处理；代码示例不形成图片；空 alt 在源文件行失败；HTTPS 外图行为明确且可显示，但不开放任意远程优化主机；无图内容不变；生产 HTML、桌面深色、320px、线上资产和完整门禁都通过。

回滚边界包括一个共享媒体描述器、Markdown 服务端组件、两条详情路由、正文样式、公开图片 CSP、alt 构建门、一个真实文章样本、测试和文档。cover 字段、Obsidian/Studio 发布事务、页面结构、搜索、Feed、OAuth 与部署工作流不变。

## 2. 项目结构状态

- `lib/content/media.ts`：替代只服务 cover 的 `cover.ts`，统一把已验证仓库图片转换为 `{ src, width, height }`，cover 额外附带 alt；
- `lib/content/media-references.ts`：Markdown AST 图片引用同时返回 URL、行号与现有 alt；
- `build/validate-media-references.ts`：在路径/所有权之前拒绝正文空 alt；
- `components/MarkdownContent.tsx`：异步服务端组件，渲染前建立本地图描述器表，本地/外部图片分支清晰；
- `app/posts/[slug]/page.tsx`、`app/projects/[slug]/page.tsx`：把记录 `sourcePath` 传给 Markdown 层；
- `app/globals.css`：正文图片共享直角证据框、轨迹色边和锈红信号边，不过滤图像颜色；
- `next.config.ts`：公开 CSP 的图片源从同源/data 扩展为同源/data/HTTPS；
- `public/uploads/building-a-maintainable-blog/content-delivery-pipeline.webp`：第一个真实生产正文样本；
- 测试：AST 多图/引用式/代码忽略、空 alt、本地尺寸去重、生产 HTML、CSP 与现有全局质量门共同覆盖。

## 3. 设计内容

设计对象是阅读学习过程和工程复盘的人。正文图片的工作是提供“技术证据”，不是制造文章 hero。页面继续使用淡蓝灰纸面、深海军蓝、轨迹青和锈红信号色；图像使用直角、细描边和左侧 3px 信号边，承接 Evidence Rail/Artifact Rail 的语言。没有新增字体、圆角卡片、渐变、阴影、覆盖式标题或图注容器。

图片宽度严格等于正文阅读栏，段间留出 2rem，既明显中断长文本又不脱离论述。深色主题下不对正文图使用封面的 brightness/contrast 滤镜，因为截图、图表和代码证据的颜色本身具有信息意义；边框负责把浅色图与深色画布分开。唯一视觉风险是浅色工程图在深色页中对比过强，最终通过原图宽松留白、细边框而不是整体压暗解决。

真实样本使用内置 ImageGen 生成，无输入参考图。最终提示词的核心是：16:9 文章内证据图，淡蓝灰技术制图纸上，Markdown 文档依次经过提交分支、自动质量检查并生成公开网页；Swiss 信息设计、建筑蓝图与丝网印刷质感；使用 `#F2F6F7/#18263D/#486F78/#B9D8DE/#B9431F`；禁止文字、数字、Logo、人物、设备、渐变、圆角卡片、发光和水印。生成 PNG 为 1672×941、1.74 MiB，经共享 Sharp 策略转为同尺寸 WebP 60990 字节，减少 96.7%。

## 4. 使用的技术

- Next.js 16.3 `next/image`：动态本地 src 配合显式宽高和 `sizes` 生成响应式候选；
- React 异步 Server Component 与 `cache`：渲染前读取媒体，同仓库路径复用解码结果；
- react-markdown 10 自定义 Components：保留图片 alt/title，分别输出 Next Image 或外部原生图片；
- mdast-util-from-markdown：抽取行内/引用式图片并忽略代码，提供行号和 alt；
- Sharp 0.35.3：读取固有尺寸，并按已有发布策略生成预算内 WebP；
- CSP：公开 `img-src` 放行 `https:`，其他资源指令不变；
- CSS：正文 48rem 网格、百分比宽度、固有比例和证据描边；
- 内置 ImageGen：生成无文字、项目绑定的原创流程图，最终资产进入 Git。

## 5. 实现的功能

- 文章与项目正文中的本地 Markdown 图片输出真实 `width`/`height`；
- `next/image` 按移动 2rem 留白、55rem 下 90vw、桌面 48rem 生成候选；
- 行内、引用式、多图、重复 URL 共用同一解析/尺寸链路；
- Markdown 代码块与行内代码中的图片示例继续保持文本；
- 正文图片复用作者现有 alt，空 alt 在构建前指出正文行号；
- 完整 HTTPS 外图使用 `loading=lazy`、`decoding=async`、`referrerPolicy=no-referrer` 原生图片；
- 外图不进入开放 `remotePatterns`，因此第三方主机不消耗 Next 优化器、也不伪造未知固有尺寸；
- 公开 CSP 允许 HTTPS 图片实际加载，HTTP、协议相对和相对路径继续失败；
- React Markdown 的 AST `node` 不再因属性展开泄漏到锚点/表格 HTML；
- 无正文图内容不读取媒体，也不产生占位；
- “从零搭建可维护博客”文章提供首张真实响应式正文图。

## 6. 实现方法

`getLocalContentImage` 先复用安全 URL 解析器，把允许的 `/uploads/...` 引用变成仓库路径，再从静态 `public/uploads` 根拼绝对路径并调用共享媒体检查。描述器使用规范化公开 src，不直接信任任意文件路径。`getContentCover` 和 `getMarkdownContentImages` 建立在同一函数上；正文先用 Set 按 URL 去重，再并行读取，本轮因此没有复制 cover 的文件系统逻辑。

`MarkdownContent` 改为异步 Server Component，并要求调用者传入内容 `sourcePath`。本地图表中命中 URL 时输出 Next Image；尺寸表达真实 CSS：42rem 以下为视口减 2rem，55rem 以下为 90vw，桌面上限 48rem。未命中只可能是已经通过构建契约的完整 HTTPS 外图，组件显式输出原生图片。这里没有设置开放 `remotePatterns`，因为作者 Markdown 可以引用任意 HTTPS 主机，而第三方图没有可信构建期尺寸、可用性或长期所有权。

alt 不是组件猜测字段。AST 抽取保留 `image`/`imageReference` 节点自己的 alt；媒体关系门在解析本地/外部边界之前检查其非空，因此本地和 HTTPS 图片遵守同一可访问性规则。cover 的 `coverAlt` 契约保持不变。锚点和表格组件不再展开 react-markdown 附加的 `node`，顺手修复了之前 SSR 中的 `node="[object Object]"` 非法泄漏。

## 7. 验证证据

- 定向媒体测试：7/7 通过，覆盖行内/引用式/外部图片、代码忽略、所有权、空 alt、重复本地图尺寸与安全 URL；
- `npm run check`：ESLint、62/62 单元测试、TypeScript、33/33 页面生成、15/15 生产 HTTP/质量测试全部通过；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；
- 生产 HTML：真实正文图同时包含原 alt、1672×941、正文 `sizes` 与 `srcSet`，且不再出现 `node="[object Object]"`；
- 浏览器桌面深色 1440px：阅读图 768×432，优化候选成功，左边框约 3px，横向溢出 0，warning/error 0；
- 浏览器 320px（布局宽 305px）：图片 273×153，按设备像素密度取得优化候选，横向溢出 0，warning/error 0；
- 实现提交 `8756f54` 已推送 `main`；GitHub Quality Gate `30927311495` completed/success；
- Vercel Production `dpl_99QL6UJgbC6qUcA1brDhY9jZx4fy` 为 Ready，不可变 URL `https://blog-okim9ftzh-czq1.vercel.app`，日志明确克隆 `8756f54`、TypeScript 通过、33/33 页面生成、Deployment completed；
- 自动 Production smoke `30927356444` completed/success；独立稳定域名冒烟返回 `23 routes, OAuth 302`；
- 稳定域名文章 HTML 包含 alt、尺寸与 srcSet；原始 WebP 返回 200、`image/webp`、60990 字节；
- 网络命令只在当前进程使用 `http://127.0.0.1:7897`，未写入永久代理配置。

## 8. 经验与教训

- 媒体完整性、固有尺寸和响应式加载是三个不同契约；文件存在并不自动防止布局跳动或带宽浪费；
- cover 与正文图应共享文件系统/尺寸层，但不应强行共享 alt 来源和展示结构；
- `sizes` 必须表达真实 CSS 网格，桌面 48rem、单列 90vw 和 320px 留白不能只写一个 `100vw`；
- 任意 HTTPS 外图不适合开放 Next Image 主机白名单；明确降级比伪装成等价优化更可维护；
- 允许外图的内容契约必须与运行时 CSP 同步，否则“构建通过”仍会在浏览器静默失败；
- alt 应在 AST/构建层校验并报告源行，而不是让渲染组件用空字符串掩盖作者遗漏；
- react-markdown 自定义组件的 `node` 是解析上下文，不是 HTML 属性；展开剩余 props 前必须有意剥离；
- 技术证据图在深色主题下不应机械套用装饰封面的亮度滤镜；准确颜色优先；
- 浏览器 `naturalWidth` 会反映解码/设备密度，判断候选是否正确还要同时看 `currentSrc`、rendered size、sizes 和 DPR 语境；
- 生产验证必须把部署 SHA、HTML 结构和原始资产响应连起来，不能只依赖 Ready 状态。
- 归档跨过作者时区零点时，内容 `updatedAt/reviewedAt` 和固定生产 HTML 断言必须一起推进；本轮第一次最终门禁因此出现 14/15，修正旧日期断言后再执行完整检查。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容契约、附件优化/引用、封面与正文图片展示、内容分享、双向知识链接、自动交付、恢复、新鲜度和维护报告均可用。媒体链路现在覆盖两个正式消费场景：cover 从作者入口到 OG/JSON-LD，正文图从 Markdown AST 到响应式阅读；两者共享尺寸真相和本地路径安全边界。

剩余主要风险：Studio 正式媒体仍可长期停留在 `public/uploads` 根兼容区，没有强制 per-slug 归档和孤儿清理；post/project 可使用相同 slug，而附件命名空间只按 slug 隔离；Studio/普通 Git 图片不自动优化；外部 HTTPS 图由第三方控制，降级路径无法提供固有尺寸或可用性保证；附件增长增加 Git 历史；浅色主题本轮由 CSS/对比度门覆盖，真实浏览器只检查深色；Decap 上游依赖、Actions Node 20 deprecation warning、CSP 内联例外、自定义域名、统计、评论与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

收紧网页 Studio 的正式媒体归档所有权。验证 Decap 对 per-entry media folder 的稳定支持，让文章/项目的正文图片与 cover 在创建、编辑和 editorial workflow 中最终进入 `public/uploads/<slug>/...`；若编辑器不能安全完成原子移动，则在仓库侧建立可回滚的归档步骤。正式 posts/projects 不再长期引用根暂存文件，同时保留 Obsidian inbox 暂存；覆盖新建、草稿改 slug、重复文件名、正文与 cover 共用、失败提示、现有根文件兼容和生产发布。
