# Iteration 0027：响应式详情页封面

## 1. 范围与成功标准

项目继续服务同一目标：作者从 Studio 或 Obsidian 写入 Git，构建证明内容和媒体可用，公开页面把学习与项目记录呈现为稳定、可分享的工程资产。Iteration 0026 已经验证 `cover` 指向的文件存在、大小写精确且归档所有权正确，但公开页面完全不消费这个字段。本轮唯一任务是把已验证本地 cover 接入文章/项目详情、可访问语义和社交元数据。

成功标准：cover 必须是仓库内 `/uploads/...` 图片；设置时必须提供替代文本；构建/服务端读取真实宽高；文章与项目共享组件；`next/image` 输出响应式候选且保留固有比例；没有 cover 的内容不出现占位或布局变化；内容图片进入 Open Graph、Twitter 与 JSON-LD；Studio 和 Obsidian 都可独立发布封面；Obsidian cover 与正文附件共用压缩/归档/回滚事务；320px、深色、生产 HTML、真实线上资源和完整质量门通过。

回滚边界包括 cover 契约、一个服务端描述器、一个共享组件、两条详情路由、Studio/Obsidian 入口、MyBlog 示例资产、样式、测试和文档。首页、集合页、正文内容、数据库边界、OAuth、部署工作流与外部服务不变。

## 2. 项目结构状态

- `lib/content/cover.ts`：把已验证 cover 转成 `{ src, alt, width, height }`；文件系统根静态收窄到 `public/uploads`；
- `components/ContentCover.tsx`：文章、TIL 和项目共享的服务端封面 figure，使用 `next/image` 与 Artifact Rail；
- `app/posts/[slug]/page.tsx`、`app/projects/[slug]/page.tsx`：详情页、Open Graph、Twitter 与 JSON-LD 消费同一 cover 描述器；
- `lib/content/contract.ts`：cover 只接受 `/uploads/...`，新增成对 `coverAlt`，替代文本限制 1–200 字符；
- `lib/obsidian-publishing.ts`：识别 frontmatter cover，并与正文附件登记到同一发布事务；
- `studio/config.mjs`、`templates/obsidian/*.md`：两个作者入口都暴露 cover 与 coverAlt；
- `public/uploads/myblog/cover.webp`、`content/projects/myblog.md`：首个真实生产封面及其可访问描述；
- `app/globals.css`：Artifact Rail、边框、深色滤镜与 42rem 以下单列规则；
- 测试：内容契约、媒体引用、Studio、Obsidian 发布、生产 HTML 与现有全局质量门共同覆盖。

## 3. 设计内容

设计对象是技术记录读者。页面的工作不是用一张大图制造营销氛围，而是在进入正文前给出一份可核验的视觉档案。色彩继续使用纸蓝灰、深海军蓝、轨迹青和锈红信号色；标题继续使用现有 condensed display，尺寸与资产标签继续使用 mono；没有引入新的字体、渐变、圆角卡片或覆盖式文案。

最初备选是常规全宽博客 hero，但它会让标题可读性依赖图片，也与 Commit Trace / Evidence Rail 失去关系，因此被否决。最终唯一视觉风险是把窄的 Artifact Rail 放在图片左侧：它显示 `Visual artifact`、内容种类和真实像素，不把解释性文字压在图片上。封面位于事实区之后、正文之前；桌面上 rail 与图片不对称并列，42rem 以下折叠为两行横向标注。图片边框保留一枚锈红校准角，承接现有工程档案语言。

MyBlog 封面使用内置 ImageGen 生成，无输入参考图。最终提示词的核心是：16:9 个人工程博客项目封面，淡蓝灰制图纸上由文档、提交节点、网页与部署检查点组成的抽象系统图；Swiss 信息设计与技术蓝图结合；使用 `#F2F6F7/#18263D/#486F78/#B9D8DE/#B9431F`；禁止文字、数字、Logo、渐变、玻璃拟态、设备模型、人物和水印。生成 PNG 1672×941、2.22 MiB，经现有 Sharp 策略转为 1672×941 WebP 129054 字节，减少 94.5%。

## 4. 使用的技术

- Next.js 16.3 `next/image`：按 `sizes` 生成候选，使用显式宽高防止布局跳动；
- Next.js Metadata API：内容级 `openGraph.images`、`twitter.images` 与 `summary_large_image`；
- React `cache`：同一服务端进程内复用 cover 文件检查；
- Sharp 0.35.3：复用公开媒体策略读取方向校正后的固有尺寸并生成 WebP；
- Zod 4.4.3：cover/coverAlt 成对跨字段约束；
- Schema.org：BlogPosting/SoftwareSourceCode 的 `image` 使用请求站点绝对 URL；
- CSS Grid、自定义属性与媒体查询：桌面 Artifact Rail、320px 单列、深色亮度控制；
- Decap CMS 与 Obsidian 发布器：相同字段语义、不同作者入口；
- 内置 ImageGen：项目绑定的原创位图封面，最终资产进入 Git，不依赖生成目录。

## 5. 实现的功能

- 文章、TIL、项目详情可选渲染响应式封面；
- 无 cover 记录完全保持原 HTML/布局；
- cover 使用真实文件宽高和原始比例，不靠 CSS 猜测比例；
- cover alt、OG/Twitter alt 和内容记录来自同一个 `coverAlt`；
- 内容级 OG/Twitter 输出绝对封面 URL、宽高和 alt；
- BlogPosting/SoftwareSourceCode JSON-LD 在有 cover 时输出绝对 `image`；
- Studio 上传封面时禁止外链，并提示必须填写替代文本；
- Obsidian 模板提供注释示例，不强迫无封面内容补数据；
- Obsidian 发布器会归档和改写 frontmatter cover，静态图继续优化为 WebP；
- MyBlog 项目生产详情页提供第一张真实封面；
- 320px rail 折叠、深色图片亮度控制、0 横向溢出；
- 生产测试证明 `srcSet`、宽高、alt、OG、Twitter 与 JSON-LD 同时存在。

## 6. 实现方法

契约先把 cover 收窄为 `/uploads/...`。正文仍可使用完整 HTTPS 图片，但 cover 必须在仓库中，因为构建要确定宽高、公开 CSP 只允许同源图片，且任意远程主机无法安全加入 `next/image` 白名单。`superRefine` 同时拒绝“有 cover 无 coverAlt”和“无 cover 只留 coverAlt”，避免页面替代文本与资产漂移。

`getContentCover` 先复用 Iteration 0026 的安全 URL 解析器，再从 `public/uploads` 静态根拼接路径并调用共享媒体解码器。第一次实现直接对 `process.cwd()` 动态拼接，Turbopack 警告会追踪整个项目；修正后把静态前缀明确写入 `path.join(process.cwd(), "public", "uploads", ...)`，构建警告消失，Serverless 追踪边界保持最小。

详情页 metadata 和页面渲染都取得同一个描述器。组件把实际宽高交给 `Image`，`sizes` 按 42rem/64rem 与桌面内容宽度描述布局；图片保持 `height: auto`。封面在 30rem 内容头之后，因此保留默认 lazy loading，不抢首屏标题资源。Metadata 使用相对 src，由根 `metadataBase` 解析绝对 URL；JSON-LD 在页面已知请求 origin 后显式绝对化。

Obsidian 的附件转换原本只识别正文 Markdown/Wiki 图片。本轮在同一 `normalizeAttachmentLinks` 闭包中先匹配简单 frontmatter cover，再调用相同 `register`。因此 cover 与正文引用同一源时不会重复安装，命名、冲突、安全包络、WebP 派生、staging、失败恢复和 Git 暂存规则全部复用，避免新建第二套媒体事务。

## 7. 验证证据

- 针对性内容契约、Studio、Obsidian 与媒体引用测试：33/33 通过；
- `npm run typecheck`：通过；
- `npm run build`：33/33 页面生成；第一次发现 Turbopack 全项目 tracing 警告，收窄路径后无警告通过；
- `npm run test:app`：15/15 通过，验证 figure、1672×941、`srcSet`、alt、OG/Twitter 与 JSON-LD；
- 浏览器桌面深色 1440px：figure 1281×774，图片 1116×628，优化地址加载完成，横向溢出 0；
- 浏览器 320px（布局宽 305px）：rail 273×44，图片 271×153，横向溢出 0，控制台 warning/error 为 0；
- `npm run check`：ESLint、60/60 单元测试、TypeScript、33/33 构建、15/15 生产测试全部通过；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；
- 实现提交 `13164f77591bd081170eb73732b95258e8841052` 已推送 `main`；GitHub Quality Gate `30923477705` completed/success；
- Vercel Production `dpl_CFPV5qHnEQJsWEy798eU6xqsYKe4` 为 Ready，不可变 URL `https://blog-o7yo3phzh-czq1.vercel.app`，日志明确克隆 `13164f7`、TypeScript 通过、33/33 页面生成、Deployment completed；
- 自动 Production smoke `30923525707` completed/success；独立稳定域名冒烟返回 `23 routes, OAuth 302`；
- 稳定域名项目页包含 figure、coverAlt、Open Graph 和 `srcSet`；`/uploads/myblog/cover.webp` 返回 200、`image/webp`、129054 字节；
- 网络命令只在当前进程使用 `http://127.0.0.1:7897`，未写入永久代理配置。

## 8. 经验与教训

- “文件已验证”仍不等于“图片可稳定展示”；页面还需要固有尺寸、可访问描述和响应式候选；
- cover 不适合沿用正文外图的宽松边界：构建期尺寸、CSP 和优化主机要求它成为仓库资产；
- alt 是资产契约，不应该由组件临时从标题猜测；成对字段能让 Studio、Obsidian、SEO 和视觉组件共享语义；
- 可选 UI 的正确兼容方式是返回 `undefined` 并完全不渲染，不是输出空 figure 或默认占位；
- Next.js 构建成功仍要读 warning；动态文件系统根可能悄悄扩大部署追踪体积；
- `sizes` 必须描述真实 CSS 宽度，不能只依赖 `width: 100%`；
- 首屏之外的封面不应机械加 priority；标题和事实区才是详情页第一屏核心；
- 发布入口扩展 cover 时应复用原附件事务，第二套复制/回滚逻辑只会制造分叉；
- 视觉资产必须进入工作区并通过正式媒体策略，不能只留在 ImageGen 默认目录；
- 浏览器检查需要同时看 DOM 语义、真实 currentSrc、控制台和 `scrollWidth-clientWidth`，截图好看不是完整证据。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容契约、附件优化/引用、封面展示/分享、双向知识链接、自动交付、恢复、新鲜度和维护报告均可用。媒体链路现在有第一个完整垂直切片：作者选择本地 cover、声明 alt、发布器归档、构建验证、服务端读取尺寸、页面响应式渲染、社交分享消费、线上冒烟验证。

剩余主要风险：Markdown 正文图片仍由 React Markdown 默认 `<img>` 渲染，没有固有尺寸/`next/image`；正文 HTTPS 外图的运行时 CSP 与展示边界仍需统一；根目录 Studio 媒体没有强制 per-slug 所有权；post/project 可使用相同 slug，而附件命名空间只按 slug 隔离；Studio/普通 Git 图片不自动优化；附件增长会增加 Git 历史；浅色主题本轮由 CSS 分支和对比度门验证，浏览器系统偏好只提供了深色真实截图；Decap 上游依赖、CSP 内联例外、自定义域名、统计、评论与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

把已验证的本地 Markdown 正文图片接入与 cover 相同的固有尺寸和响应式链路。渲染前根据正文 AST/URL 找到仓库文件，复用媒体检查结果，用 `next/image` 输出真实宽高、现有 alt 与正文宽度对应的 `sizes`；定义完整 HTTPS 外图在当前 CSP 下的明确行为；覆盖行内/引用式多图、代码示例忽略、无图片兼容、320px、深色和生产 HTML。不要要求作者重新填写已经存在的 Markdown alt，也不引入外部图片 CDN。
