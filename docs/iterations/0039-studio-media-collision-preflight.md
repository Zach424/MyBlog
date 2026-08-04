# Iteration 0039：Studio 媒体目标冲突预检

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，图片在进入 Git 历史前有可解释、可验证的安全边界。Iteration 0030 已阻止坏格式和超预算图片，Iteration 0031 已锁定首次保存后的 slug；但同一 slug 下选择同名文件时，作者仍只能看到 Decap 的通用替换对话框，不知道最终仓库路径，也无法区分“字节完全相同”和“公开 URL 下的内容将改变”。

本轮只闭合已发布媒体快照的选择前冲突：构建生成路径/体积/SHA-256 清单，Studio 用稳定 slug 和固定 Decap 文件名规则推导目标，明确分类 new、same、replace-risk；replace-risk 必须展示证据并显式确认，slug 或清单不可置信时失败关闭。不得上传文件、调用 GitHub API、改变原始 `File`、修改 Obsidian 事务、放宽媒体预算或新增云服务。

## 2. 项目结构状态

- `lib/studio-media-manifest.ts`：递归读取 `public/uploads`，输出确定排序的仓库路径、字节数与 SHA-256；
- `app/studio/media-manifest.json/route.ts`：静态同源 JSON 清单端点，继承 Studio 的 `no-store`、`noindex` 与安全策略；
- `studio/media-preflight.mjs`：在已有字节读取上增加 Web Crypto 摘要、目标文件名规范化、stable slug 读取、清单校验、冲突分类和明确替换确认；
- `studio/config.mjs`：封面和正文提示同步 new/same/replace 语义；
- `tests/studio-media-manifest.test.mjs`：临时目录确定性清单与真实仓库两张媒体证据；
- `tests/studio-media-preflight.test.mjs`：固定 Decap source map 契约、摘要、文件名、分类、取消、失败关闭与事件重放；
- `tests/quality-gates.test.mjs`、`scripts/smoke-production.mjs`：真实 HTTP 和生产冒烟纳入清单端点；
- README、架构、发布、质量、状态、路线图与本文件：同步作者说明、技术状态、风险和下一主线；
- 内容文件、公开 URL、Obsidian 发布器、GitHub Actions 和 Vercel 配置均未修改。

## 3. 设计内容

作者看到的是一条继续沿用 Evidence Rail 的选择前反馈，而不是另一套管理页面。目标路径是主信息，格式、尺寸、帧数、体积和摘要分类是证据。不存在目标时显示“新增图片预检通过”；路径与字节数/SHA-256 同时一致时显示“图片与已发布文件相同”；同路径不同内容时，确认框同时列出仓库路径、已发布/新文件体积与 12 位摘要前缀，并明确说明继续会改变公开地址下的原图。

条目身份不可模糊：页面存在 stable slug 控件但值为空或格式异常时拒绝；清单请求非 2xx、JSON 版本/root/entry 异常或浏览器没有 Web Crypto/fetch 时拒绝。没有 stable slug 控件代表 Decap 全局媒体库，不能伪造条目路径，只保留原格式和预算预检并标明未绑定条目。为避免项目实现与 Decap 最终名称漂移，非 ASCII 经 NFKD 去音调后仍有非 ASCII 字符时要求作者先重命名；普通英文、数字、点、下划线和连字符保持稳定。

## 4. 使用的技术

- Node `fs/promises`、`path` 与 `crypto.createHash("sha256")` 构建服务端确定性清单；
- Next.js 16 App Router `GET` Route Handler 与 `dynamic = "force-static"` 预渲染 JSON；
- 浏览器 Web Crypto `subtle.digest("SHA-256")` 复用已有 `arrayBuffer`，不二次读取文件；
- stable slug 控件的 `input[data-stable-slug-state]` 作为条目身份边界；
- Decap CMS 3.14.1 source map 回归证据，锁定 `file.name.toLowerCase()`、`sanitizeSlug` 与 `selectMediaFilePath` 调用链；
- capture-phase change 拦截、WeakSet 批准重放和依赖注入保持已有预检架构；
- Node test、Sharp 图片夹具、TypeScript、ESLint、Next 生产构建、真实 HTTP、GitHub Actions 与 Vercel 生产冒烟；
- research-iteration-loop skill 将实现限定为可回滚的清单/浏览器纵切，并要求全局复盘后再选择会话内账本。

## 5. 实现的功能

- `/studio/media-manifest.json` 当前列出 2 个已归档媒体文件、190,044 B，每项只有路径、体积与 64 位小写 SHA-256，不暴露文件正文；
- 清单按路径确定排序并带 `version: 1`、`root: "public/uploads"`，浏览器严格校验版本、根、路径、体积、摘要和重复项；
- 图片预检在 magic bytes、解码、尺寸和动图预算通过后生成 SHA-256；
- 最终目标为 `public/uploads/<stable-slug>/<decap-normalized-file-name>`，UI 总是显示条目目标；
- new 和 same 无危险确认即可继续，replace-risk 必须由作者确认；取消后清空 input，文件不会进入 Decap 草稿；
- 缺少 slug、清单不可用/不可信和无法稳定转换的文件名均失败关闭；
- 全局媒体库保持原预检能力，不发起无意义清单请求；
- 原始 `File` 只在全部检查通过后通过合成 change 事件交给 Decap，没有压缩、转码或字节替换。

## 6. 实现方法

构建端递归枚举 `public/uploads` 普通文件，读取一次字节并计算 SHA-256；相对仓库路径统一为 `/`，最终再排序。Route Handler 在 Next build 时生成静态 JSON，因此它与部署使用的 Git 快照精确一致；路由仍由 `/studio/:path*` 统一添加 `no-store`、`X-Robots-Tag` 和 Studio CSP。

浏览器端的 `inspectStudioMediaFile` 已经必须读取全部字节以识别真实格式，因此摘要直接基于同一个 `Uint8Array`。冲突检查器每个页面会话只获取一次不可变清单 Promise，先读取 stable slug，再规范化文件名并做精确 Map 查找。不存在、摘要相同、摘要不同分别返回带目标路径的判别状态；handler 只在状态成功或危险替换已确认后把文件加入 WeakSet 并重放 change。Decap 原有确认仍保留，作为其内部媒体列表和 editorial workflow 状态的最终兜底，而不是被项目代码绕开。

## 7. 验证证据

- 专项测试 15/15 通过；首次运行唯一失败是旧 Studio config 测试仍要求“同一条目使用不同文件名”，实现没有退回旧提示，而是把断言更新为 new/same/同名替换确认的新契约；
- 完整 `npm run release:check`：配置完整，Current 1/Historical 3/未公开 0，inbox 0，根暂存媒体 0，外链 2 URL/3 occurrences/0 issue；
- 同一候选通过 ESLint、116/116 单元测试、TypeScript、37/37 构建页面、17/17 真实生产 HTTP/质量测试；`npm audit --omit=dev --audit-level=high` 为 0；`git diff --check` 通过；
- 独立本地生产构建冒烟：`24 routes, OAuth 503`，正确验证未配置本地 OAuth 的安全关闭；第一次对用户已有 `localhost:3000` 开发服务冒烟时，未知 Studio 404 被开发模式强制为 `no-cache`；另一次选用 3100 又发现已有本地 API 占用。最终改用空闲 `127.0.0.1:3311` 和本轮 production build，证明差异来自开发服务器/端口环境而不是产品路由；临时进程已清理；
- 实现提交 `02de1c26abc1dbf84b61849db2a7c1e3e7a6acda` 已推送 `main`；GitHub Quality Gate `30951228136` completed/success；
- GitHub Production deployment `5751636882` state=success（`https://blog-oopt0vd9y-czq1.vercel.app`）；`Verify Vercel production` `30951273507` 精确绑定实现 SHA 且 completed/success；
- 稳定生产域名独立冒烟：`24 routes, OAuth 302`，其中媒体清单为 JSON、至少 2 项、摘要格式正确且 `no-store`；代理只在网络命令进程内设置，未写入仓库或永久配置。

## 8. 经验与教训

- “文件名相同”不是足够的冲突证据；路径、体积和内容摘要共同决定 same 与 replace-risk；
- 服务端与浏览器各自实现命名规则时最危险的是无声漂移；固定第三方 bundle 的真实 source map 应成为回归证据，无法可靠复现的名称宁可失败关闭；
- 文件摘要不需要第二次读取；把指纹接到既有 magic-byte 读取后，能保留单一原始字节事实源；
- 静态 manifest 既避免浏览器调用 GitHub API，也使检查与当前部署 Git 快照一致；版本字段让未来 schema 变更显式失败；
- 安全提示必须说明“哪个公开路径会变化”，只有“文件已存在”不足以让作者判断；
- 开发服务器会覆盖 404 缓存语义，且常用端口可能已被其他应用占用；生产契约要用 production build 和确认空闲的精确地址验证，不能把环境差异写成产品失败；
- 清单快照只代表已部署 Git 状态；它解决了已发布冲突，但不能自动知道本页面刚批准、尚未部署的新文件。

## 9. 全局状态、风险与未解决问题

公开阅读、知识图、内容/媒体/永久 URL 契约、外链维护、双作者入口、自动交付、恢复和 Studio 已发布附件冲突证据均可用。网页作者无需预先记住仓库中是否已有同名图片；危险改变在文件进入草稿前即可被解释和阻止。

剩余主要风险：生产清单不包含当前页面刚选择或 editorial workflow 分支中尚未部署的附件，Decap 通用确认仍承担这一层兜底；Studio 不做自动优化；非 ASCII 特殊名称选择安全拒绝；固定 Decap bundle/开发依赖审计、宽 OAuth scope、CSP 例外、Hobby 回滚、知识图扩容、Git 媒体历史、自定义域名、统计、评论和外部提醒保持既有状态。

## 10. 下一轮唯一主任务

为 Studio 冲突检查增加页面会话内的已批准媒体目标账本。每次文件真正获准重放时登记 targetPath、bytes、sha256；后续同一目标即使不在生产 manifest，也要区分 same-session 和 replace-session-risk，不同字节复用本轮的证据型确认。账本只存内存、页面刷新即清空，不读取文件第二次、不上传、不接 GitHub API、不代替 Decap 的远端状态，也不修改 Obsidian/构建契约；用多次选择、取消后不登记、确认后更新与事件重放测试锁定行为。
