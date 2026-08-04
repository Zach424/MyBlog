# Iteration 0030：Studio 媒体上传前预检

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex，即可从网页 Studio 或 Obsidian 发布学习记录和项目复盘，内容、附件与历史都进入 Git，并由 `main` 自动交付到 Vercel。Iteration 0029 已让 Studio 的正式图片直接进入 `public/uploads/<slug>/`，但 Decap 3.14.1 自带 image widget 只在媒体库持久化前检查 `max_file_size`。尺寸、真实格式、损坏、扩展名伪装和动图总像素只能到 Next 构建时才失败，作者反馈太晚。

本轮只闭合“选择图片 → 进入 Git 草稿前诊断”这一条纵切：支持与公开媒体契约一致的格式、体积、尺寸、像素和可可靠计数的动图预算；通过后必须把原始文件交回 Decap，保持 editorial workflow、per-slug 归档、重名确认、草稿和回滚语义；失败必须清空选择并给出作者可执行修复；视觉反馈沿用现有 Evidence Rail；不引入外部媒体服务，不在浏览器中实现不确定的 WebP 重编码。

回滚边界包括一个独立浏览器模块、一个显式 Studio 资源路由、Studio HTML 样式/安装、媒体/交付测试和作者文档。内容 schema、Decap 配置、OAuth、Obsidian Sharp 事务、公开图片字节、GitHub workflow 与 Vercel 配置保持不变。

## 2. 项目结构状态

- `studio/media-preflight.mjs`：浏览器可复用的格式识别、帧计数、真实解码、预算校验、捕获事件接管和状态报告；
- `app/studio/media-preflight.mjs/route.ts`：通过现有 `studioAssetResponse` 同源提供 JavaScript；
- `lib/studio-assets.ts`：把预检模块加入受控 Studio 资源类型与内容类型映射；
- `studio/index.html`：在 CMS 初始化前安装预检，并增加浅/深色、非模态 Evidence Rail；
- `tests/studio-media-preflight.test.mjs`：真实静态格式、失败路径、GIF/WebP 动图、AVIF 边界、事件重放和安装生命周期；
- `tests/studio-config.test.mjs`、`quality-gates.test.mjs`、`deployment-tools.test.mjs`：锁定 HTML 集成、Route Handler、缓存和生产 smoke；
- `scripts/smoke-production.mjs`：稳定域名必须提供可执行预检模块；
- `README.md`、`docs/ARCHITECTURE.md`、`CONTENT_MODEL.md`、`DESIGN.md`、`PUBLISHING.md`、`QUALITY.md`：记录作者工作流、设计、技术边界与质量证据；
- `docs/STATUS.md`、`ROADMAP.md` 与本文件：仓库根 Obsidian Vault 的当前状态和本轮经验。

## 3. 设计内容

目标用户是博客所有者，核心任务是在图片尚未进入 Git 草稿时回答三个问题：能否发布、为什么失败、下一步怎么修。反馈不做弹窗，不阻断继续编辑，也不复制 CMS 卡片系统；选择开始后，右下角出现单一 Evidence Rail，使用既有 `#F2F6F7` Canvas、`#18263D` Ink、`#486F78` Trace、`#B9431F` Signal 与等宽元数据字体。3px 左状态线区分检查中、通过和失败，正文只显示真实格式、宽高、帧数、体积与修复方式。

状态区使用静态结构加 `textContent` 写入文件名和错误，避免把作者文件名当 HTML；`role=status/alert`、`aria-live=polite/assertive` 和 `aria-atomic` 为辅助技术提供同等反馈。它没有图标、阴影、循环动效和模态遮罩，手机宽度使用 `calc(100vw - 2rem)`，深色模式复用既有后台色彩。安装完成只在 `<html>` 留下 `data-media-preflight="installed"` 可观测标记，状态区在首次选择前不出现。

## 4. 使用的技术

- Decap CMS 3.14.1 当前源码：`FileUploadButton` 的 `accept="image/*"` 与 `change` 事件、MediaLibrary `handlePersist` 的 `max_file_size`、`persistMedia` 的重名/路径/草稿链路；
- 官方 [Image widget](https://decapcms.org/docs/widgets/image/) 与 [Custom widgets](https://decapcms.org/docs/custom-widgets/) 文档：确认内建限制和完整 React 控件替换成本；
- 浏览器 `File.arrayBuffer()`、`Uint8Array`、`DataView`、`TextDecoder` 与 `createImageBitmap`；
- PNG chunk/APNG `acTL`、GIF 数据块、RIFF WebP `ANIM`/`ANMF` 和 ISO BMFF AVIF `ftyp` brand 解析；
- window capture-phase `click`/`change`、`WeakSet<File>` 单次批准和原生 `Event` 重放；
- Next.js 16.3.0 静态 Route Handler、现有 CSP/no-store/noindex Studio 资源策略；
- Sharp 0.35.3 测试夹具、Node 24 原生 test/strip-types、ESLint、TypeScript、Next build 与生产 HTTP 测试；
- GitHub Actions、deployment/status API、Vercel Git Integration 与稳定域名 smoke。

## 5. 实现的功能

- 文件选择器从宽泛 `image/*` 收窄为 `.avif,.gif,.jpeg,.jpg,.png,.webp`；
- 读取真实 magic bytes，拒绝未知格式和扩展名伪装；
- 浏览器实际解码图片，拒绝损坏或没有合法宽高的文件；
- 在进入 Git 草稿前执行 3 MiB、2560×2560、800 万单帧像素预算；
- 解析 GIF 和 WebP 帧数、APNG `acTL` 帧数，并执行 8000 万动图总像素预算；
- 静态 AVIF 正常通过，声明 `avis` 的动画 AVIF 因无法可靠计帧而 fail closed；
- 通过后展示格式、尺寸、帧数和体积，并把同一个 `File` 重新交给 Decap；
- JPEG/PNG 明确提示 Studio 保留原格式，需要自动 WebP 时使用 Obsidian；
- 失败后清空 input，不触发 Decap 持久化，并显示具体修复原因；
- 安装幂等、监听器可卸载、DOM 安装标记可由真实浏览器和自动化读取；
- `/studio/media-preflight.mjs` 继承 JavaScript、`no-store`、`noindex` 和 Studio CSP；
- 本地与生产 smoke 都把预检模块纳入不可缺失资源。

## 6. 实现方法

先读取安装版本源码而不是假设 Decap 提供 hook。MediaLibrary 的本地文件路径在 `change` 后进入 `handlePersist`，随后才检查内建体积上限并执行 `persistMedia`；外部 media library 只返回 URL，无法保留本地 Git 草稿；custom widget 需要替换完整 React control，会把图片选择、预览、移除和编辑状态都变成项目责任。因此选择捕获阶段的窄接管：原始 `change` 同步 `preventDefault`/`stopImmediatePropagation`，异步检查通过后把同一个 File 放入 `WeakSet` 并重放冒泡 `change`。重放事件再次经过捕获监听器时只消费批准标记，不二次解析，让 Decap 原处理器收到原文件。

编码结构解析只承担“格式与可可靠得到的页数”，真实可解码性和宽高由 `createImageBitmap` 负责。这样既不依赖 MIME 声明，也不手写完整图片解码器。GIF 遍历扩展、图像描述符、全局/局部色表和子块；WebP 遍历对齐后的 RIFF chunks；PNG 读取 `acTL`；AVIF 读取 `ftyp` compatible brands。动画 AVIF 的序列帧数无法从当前轻量浏览器契约可靠得出，因此不把未知当一帧，而是给出明确转换路径。

没有在 Canvas/浏览器编码器中复制 Obsidian Sharp 参数。浏览器实现无法保证与 quality 82、alpha quality 100、effort 6、EXIF 方向处理和“更小时才替换”相同的确定性字节，也会改变文件名、重复确认和作者预期。当前契约宁可保留原文件、提前诊断，再让构建权威门复核；自动优化继续由已经具备 staging 和逐字节回滚的 Obsidian 发布器承担。

## 7. 验证证据

- 最终专项测试：Studio 配置与媒体预检 10/10 通过；完整 `npm run check`：ESLint、70/70 单元测试、TypeScript、34/34 静态页面生成、15/15 生产 HTTP/质量测试全部通过；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- 真实格式夹具：Sharp 生成 AVIF/GIF/JPEG/PNG/WebP，全部识别、解码并报告 320×180；
- 失败夹具：不支持扩展名、PNG 冒充 JPEG、截断文件、超过 3 MiB、宽度 2561、GIF 13 帧总像素超限和动画 AVIF 均在进入草稿前失败；
- 事件测试：原事件只拦截一次，通过只重放一次，失败不重放并清空 input；安装重复调用不增加监听器，卸载清理监听器、全局函数和 DOM 标记；
- 本地真实 Chromium `http://127.0.0.1:3000/studio`：页面、GitHub 登录入口和标题正常，`data-media-preflight="installed"` 可读；
- 实现提交 `e23cfdfa94f42d9149fcb4936661d324e95fe2d9` 已推送 `main`；GitHub Quality Gate `30932928894` completed/success；
- GitHub Production deployment `5748268012` 精确绑定实现 SHA，state=success，目标 `https://blog-a31yj6r30-czq1.vercel.app`；自动 `Verify Vercel production` `30932976003` completed/success；
- 稳定域名 `https://blog-iota-five-59.vercel.app` 独立冒烟：`23 routes, OAuth 302`；
- 线上 `/studio` 200 且导入预检模块；模块 200、`text/javascript; charset=utf-8`、`Cache-Control: no-store`、`X-Robots-Tag: noindex, nofollow`，包含 inspector、`createImageBitmap` 和 installed marker；
- 网络命令只在当前进程使用 `http://127.0.0.1:7897`，Node smoke 显式设置 `NODE_USE_ENV_PROXY=1`，未写入永久代理配置。

失败与修复证据：最初静态检查发现一个未使用的 24-bit 读取函数并删除；截断 PNG 的错误比测试预期更早在结构层发生，断言改为接受结构/解码两条正确失败路径；13 个相同 GIF 画面被 Sharp 合并为单帧，测试改为每帧不同字节后真实覆盖总像素门。首次浏览器读取全局函数得到 undefined，因为 read-only evaluate 处于隔离页面作用域，不能作为主页面安装证据；增加根元素安装标记和幂等/卸载测试后真实浏览器验证通过。`localhost` 在内置浏览器网络边界内拒绝连接，改用 `127.0.0.1` 后本地页面通过。线上内置浏览器两次在页面加载阶段超时，因此没有把它记为成功；远端验收使用 SHA 绑定 deployment、稳定域名全路由 smoke 和线上同源模块 headers/source，且没有触发登录、上传或写操作。

## 8. 经验与教训

- 编辑器“接受图片”不等于项目契约已验证；内建 `max_file_size` 只能解决一维问题，真实格式、解码与帧预算必须在作者反馈链路中显式完成；
- 最安全的扩展点不一定是官方 custom widget。替换完整控件会扩大状态和回滚责任，窄捕获边界在当前固定版本中更可审计；
- 异步预检必须先同步阻断原事件，再用同一个 File 和一次性批准标记重放，否则 Decap 可能在检查完成前持久化或进入递归；
- magic bytes、结构计数和真实浏览器解码各司其职，比只信扩展名/MIME 或手写完整解码器可靠；
- 无法可靠计数的动画格式应 fail closed，不能用“假设一帧”绕过动图总预算；
- 浏览器转 WebP 不是把 Canvas 输出改个扩展名。确定性参数、方向、透明通道、文件命名和原子回滚都属于发布契约；缺一项就不应悄悄改字节；
- 可观测安装标记比读取页面世界的私有函数更适合浏览器验收，也能区分“脚本标签存在”和“模块真正执行”；
- 视觉反馈应服务修复决策：一个克制、可访问的 Evidence Rail 足够，不需要弹窗、卡片矩阵或虚构进度；
- 远端浏览器超时不能包装成通过。部署 SHA、自动工作流、稳定域名 smoke 与同源资源响应可以形成更诚实的替代证据链；
- 研究迭代维持单一纵切，使预检可独立回滚，也避免在同轮混入不可靠的浏览器重编码。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容契约、知识链接、内容维护、媒体预算与引用所有权、Obsidian 优化/事务、Studio per-slug 归档与上传前预检、cover/正文响应式展示、自动交付和恢复均可用。网页作者现在会在 Git 草稿形成前得到媒体质量反馈，普通 Git 和最终构建仍由 Sharp 权威门兜底，两个入口没有分叉内容事实源。

剩余主要风险：Studio 保留原始 PNG/JPEG，不提供自动缩放或 WebP；同 slug 同文件名仍依赖 Decap 确认和作者判断；动画 AVIF 需要预转换；首次保存后 slug 仍可编辑，可能让文件名、公开 URL 与媒体目录分叉；捕获边界依赖固定 Decap 3.14.1 的本地 file input 契约，升级必须重新审计；根 staging 不自动清理；附件增长会扩大 Git 历史；Decap 上游开发依赖审计、宽 OAuth scope、CSP 内联/eval 例外、Vercel deployment 保护/Hobby 回滚、自定义域名、统计、评论、外部提醒与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

收紧 Studio 的 slug 生命周期。审计 Decap 3.14.1 custom widget/control props、entry path 和 editorial workflow 状态，优先让已有条目在首次获得稳定文件路径后把 slug 变为只读，同时不破坏新建、复制和历史内容编辑；禁止依赖生成类名或脆弱 DOM 结构。若编辑器不能安全提供不可变控件，则实现可测试的变更检测与迁移诊断，让 slug、内容文件名、公开 URL 和 `public/uploads/<slug>/` owner 的分叉在保存/构建前得到明确阻断与恢复路径。
