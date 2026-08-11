# Iteration 0132：受约束的本地静音 MP4

## 1. 范围与成功标准

本轮把“视频”从未定义的外部嵌入风险，收敛为一类可以由 Git、构建门和作者工具共同验证的本地内容。目标不是做视频网站，也不是开放任意播放器，而是让短时、无声的屏幕操作演示能够从 Studio 或 Obsidian 发布，并在网页、移动端和打印中保持可解释降级。

成功标准：

1. 正式内容只使用 `![详细画面说明](/uploads/<slug>/<file>.mp4 "短标题")`；Obsidian 草稿可暂时引用根 `/uploads/<file>.mp4`，但必须由发布器归档和改写；
2. 只接受仓库内、同内容 slug 目录下的 `.mp4`，每篇最多 2 段；
3. 单段最多 12 MiB、90 秒、1920×1080 / 2,073,600 像素；
4. 只接受单一 H.264/AVC 画面轨、无音轨、无其他轨、非分片、fast-start MP4；
5. 读者端只输出原生 `<video controls preload="none" playsinline>`，禁止 autoplay、iframe 和第三方追踪播放器；
6. 标题和画面文字说明必填；v1 只允许静音视频，因此不伪装成已具备字幕/文字稿能力；
7. Studio 提供可发现的编辑组件与浏览器预检，服务端/构建仍是编码、音轨和 fast-start 的权威；
8. Obsidian 可以归档 MP4、保留标题/说明、进入原有原子回滚和 sealed Git 交付；
9. 正文、Studio、搜索、移动端、打印和生产 smoke 使用同一契约；
10. 不引入 Cloudflare、外部视频主机、账号、数据库、追踪或读者端视频 JavaScript。

## 2. 项目结构状态

本轮新增：

- `lib/markdown-video.ts`：视频声明抽取、文本契约、HAST `<figure>/<video>` 转换和打印降级；
- `lib/video-policy.ts`：基于 MP4Box 的真实容器/轨道/编码/时长/尺寸/fast-start 校验；
- `studio/video-editor.mjs`：Decap 自定义“本地静音视频”编辑组件；
- `app/studio/video-editor.mjs/route.ts`：同源、`no-store` 的 Studio 模块路由；
- `tests/markdown-video.test.mjs`、`tests/video-policy.test.mjs`、`tests/studio-video-editor.test.mjs`；
- 本文件与 `docs/knowledge/0132-video-is-a-publishing-contract.md`。

本轮修改：

- Markdown 内容契约、共享 rehype 管线、Studio 生产预览与条目预检；
- 读者端/Studio Evidence Rail、移动端和 print CSS；
- Studio 媒体浏览器预检、媒体冲突账本和编辑器组件注册；
- Obsidian 附件识别、归档、发布候选、inbox readiness version 7 与插件 1.42.0；
- 构建期媒体仓库扫描、引用所有权、孤儿附件和 sealed publication envelope；
- 生产 smoke、应用路由测试、部署契约与全量单测脚本；
- `package.json`/lock：固定生产依赖 `mp4box@2.4.1`。

归档时工作区另有用户自己的 `README.md`、`docs/README.md` 修改，以及 `docs/API_REFERENCE_CURRENT.md`、`docs/DATABASE_AND_DATA_MODEL_CURRENT.md`、`docs/PRD_CURRENT_IMPLEMENTATION.md` 新文件。本轮没有覆盖、暂存或提交这些内容。

## 3. 设计内容

视频继续使用 Evidence Rail，而不是第三方播放器皮肤。顶部固定显示 `VIDEO / SILENT MP4` 与 `LOCAL · NO TRACKING`；中间是深色、直角、无装饰的原生播放器；下方依次展示标题、画面说明和“静音演示 · 点击播放后加载”。颜色、规则线、等宽标签与焦点环复用 Paper/Ink/Signal/Trace token。

`preload="none"` 让页面初始阅读不主动下载视频正文；读者明确点击播放后才承担媒体带宽。播放器没有自动播放、循环、悬浮控制或营销封面。320px 下 figure、视频和 caption 都在正文宽度内自然收敛；打印隐藏播放器，保留标题、说明和可复制的本地文件地址。

标题回答“这段演示是什么”，说明回答“看不到画面时仍应知道什么操作与结果”。这两者是内容契约，不是装饰字段。v1 只接受无音轨素材，因此没有虚构 captions；未来若开放音频，必须先增加 WebVTT/文字稿、语言、同步、Studio/Obsidian 和打印契约。

## 4. 使用的技术

- Next.js 16.3、React 19、Server Components 与 Route Handlers；
- unified、remark/rehype、HAST 与现有 Markdown AST；
- 原生 `<figure>`、`<video>`、`<source>`、`<figcaption>`；
- `mp4box@2.4.1` 的 ISO BMFF 元数据解析；
- 浏览器 `HTMLVideoElement` 元数据解码、Blob URL、Web Crypto SHA-256；
- Decap CMS 3.14.1 自定义 editor component；
- Obsidian Publisher 1.42.0、inbox readiness version 7 与既有原子附件事务；
- CSS 响应式、暗色、`:focus-visible` 与 `@media print`；
- Node test、ESLint、TypeScript、Next production build/application tests；
- Playwright CLI 真实浏览器 DOM、计算样式、320px overflow 与 Studio 注册检查；
- Vercel 稳定生产 27 路由 smoke。

实现前阅读了仓库内 Next 16.3 的视频与 CSS 指南；外部资料只使用 MP4Box 官方 npm 说明、MDN 原生 video/可访问性资料和 Decap 官方自定义编辑组件文档。

## 5. 实现的功能

1. 抽取 inline/reference Markdown 图片语法中的 `.mp4` 声明，保留路径、标题、说明与源码行；
2. 拒绝远程 URL、协议相对 URL、查询/锚点、编码分隔符、不安全路径、根暂存和跨 slug 路径；
3. 拒绝空标题、空说明、超长文本、混排段落和每篇超过两段；
4. 输出带 Evidence Rail 的原生、可访问、无追踪播放器和下载 fallback；
5. 搜索保留标题与说明，普通图片链路不再尝试解码 MP4；
6. MP4Box 验证真实文件大小、duration/timescale、progressive、fragmented、轨道集合、codec 和整数宽高；
7. Studio 自定义组件将三个字段稳定序列化回可移植 Markdown；
8. Studio 浏览器预检检查 `.mp4`/`ftyp`、大小、时长、尺寸、摘要和同路径冲突；
9. 浏览器预检明确提示：H.264、无音轨、单轨和 fast-start 由保存后的构建门继续验证；
10. Obsidian Markdown MP4 自动归档到 `public/uploads/<slug>/`，不把它当封面或图片优化；
11. MP4 进入 readiness 的 `VIDEO` usage、发布附件清单、Git 提交 envelope 与失败回滚；
12. 构建扫描同时统计/验证图片和视频，引用门检查存在性、所有权与孤儿文件；
13. Studio `/math-preview` 返回 `videoCount`，并在语法错误时显示 `VIDEO / NEEDS FIX`；
14. 生产 smoke 验证视频编辑模块、`videoCount: 1`、`data-video="silent-mp4"`、controls/preload，以及无 autoplay/iframe；
15. 插件 bundle 升级到 1.42.0，三个文件 3/3 SHA-256 一致。

## 6. 实现方法

先写失败测试：Markdown、媒体策略、Studio 组件和 Obsidian MP4 测试分别因模块不存在、配置不识别或附件被拒绝而失败。随后先实现纯文本声明和元数据策略，再把它们接到生产渲染、作者入口、仓库扫描和 Git 交付；避免先渲染 `<video>`，最后才发现发布器和构建门不理解该文件。

浏览器预检与构建权威有意分层。浏览器可以快速证明文件签名、可解码、时长、尺寸和 SHA-256，但不能稳定枚举所有音轨、判断 moov 位置或把浏览器兼容等同于精确 H.264 profile。服务端使用 MP4Box 解析完整 ISO BMFF 信息，失败时阻止正式发布。两层各自只声明能证明的事实。

Obsidian 复用现有媒体事务而不创建第二套视频发布器：MP4 仍经过 source/target 命名、staging、后置检查、原子 rename、质量门、提交 envelope 和失败恢复，只是在 prepare 阶段做字节稳定复制而不是 Sharp 转码。这样视频获得和图片相同的 Git 可追踪性与回滚语义。

生产 smoke 第一次命中旧部署，失败于缺少视频编辑模块；部署切换后第二次命中一个脆弱断言：HAST 合法输出 `<video aria-label=… class=… controls>`，测试却写死 `<video controls`。修复为属性顺序无关的标签正则，并保留 preload/autoplay/iframe 的独立断言。这个失败说明 HTML 属性顺序不是语义契约。

## 7. 验证证据

- 失败优先：核心视频模块、Studio 组件与 Obsidian MP4 路径均先红后绿；
- 定向实现：24/24；集成相关套件 67/67；
- `npm run test:unit`：554/554；Obsidian 插件独立 221/221；
- `npm run test:diagram`：5/5；
- `npm run lint`、`npm run typecheck`：通过；
- `npm run build`：通过，67 个生成页面/资源；
- `npm run test:app`：35/35，十三条 HTML 与十一个发现端点预算全部 PASS；
- `npm audit --omit=dev --audit-level=high`：0 漏洞；
- `npm run plugin:bundle`：`myblog-publisher@1.42.0 · 3/3 SHA-256`；
- `node scripts/check-release-config.mjs`：发布配置完整；
- `content:status`：Current 1 / Historical 3 / 未公开 0；`content:inbox` 与根暂存媒体均为空；外链离线库存 0 问题；
- Playwright：Studio 组件 `myblog-video` 已注册、模块请求 200、控制台 0 error；合成播放器为 VIDEO、controls=true、preload=none、playsInline=true、autoplay=false、iframe=0；320×800 下 documentWidth=320、无横向溢出；
- 功能提交 `baa7f4f`，烟测健壮性提交 `3b913be`，均已推送 `main`；
- Vercel 稳定生产 smoke：27 routes、OAuth 302、13 条 HTML 和 11 个结构化端点全部 PASS；
- 线上合成 POST 返回 `videoCount: 1`、本地静音播放器与无第三方嵌入；
- 公开内容集合没有新增视频，Feed/清单/Schema 正文和既有生产预算基线无需重置。

## 8. 经验与教训

1. 视频首先是媒体发布契约，其次才是 HTML 标签；
2. 扩展名和浏览器能播放都不能证明编码、轨道或 fast-start；
3. 浏览器预检要诚实声明证据边界，不能把未知项显示成已验证；
4. 音频一旦开放，字幕/文字稿就必须和媒体同时进入内容模型、作者工具与质量门；
5. `preload="none"`、无 autoplay 和本地路径共同降低初始带宽与隐私风险；
6. 标题和画面说明使视频在搜索、无障碍、打印和文件不可用时仍有内容价值；
7. 复用图片的原子附件事务比另建视频上传旁路更可靠；
8. 构建门必须扫描仓库中的真实二进制，而不能只校验 Markdown URL；
9. 生产合成 POST 可以证明未来能力，无需修改历史文章制造演示；
10. HTML 属性顺序不属于 DOM 语义，烟测应按标签/属性存在性验证；
11. 旧部署失败是自动交付切换证据，不应通过容错吞掉；
12. Git 仓库托管视频适合少量短演示，不等于适合长视频或高流量媒体库。

## 9. 全局状态、风险与未解决问题

作者现在可以从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid 和受限本地静音 MP4，并由 Git/Vercel 自动上线。视频不依赖 Cloudflare、iframe、第三方播放器、远程脚本或数据库。

剩余边界：Git/Vercel 仍承担视频存储与传输；12 MiB × 每篇两段只是单内容上限，不是全站容量预算。当前没有真实公开视频样本，因此线上证明覆盖模块、合成渲染和协议，不覆盖 CDN 对一个真实 MP4 的 Range/Content-Type/缓存行为。音频、字幕、poster、转码、多码率、流媒体、自适应清晰度、长视频和外部托管都未开放。

首次真实 Obsidian 主题下的人机验收、自定义域名、统计、评论和公开邮箱仍需所有者操作或决策，不阻塞当前生产。

## 10. 下一轮唯一主任务

为多图内容建立受限画廊契约：先确定 Markdown/Obsidian/Studio 可移植语法、每组数量、alt/caption、响应式列数、窄屏阅读、打印、搜索与图片预算；优先服务“项目步骤、前后对比和证据组”，不默认加入灯箱脚本、手势库、自动轮播或第三方画廊。
