# Iteration 0029：Studio 按 slug 归档媒体

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex，即可从网页 Studio 或 Obsidian 把学习记录和项目复盘保存为 Git 中可检索、可回滚的 Markdown，并自动交付到 Vercel。Iteration 0026 已把 `public/uploads/<slug>/` 定义为正式归档命名空间，Iteration 0027/0028 完成 cover 与正文图的响应式展示；但 Studio 仍使用全局 `public/uploads`，新上传媒体可能长期停留在根暂存区。本轮只闭合 Studio 正式媒体归档这一条纵切，不改视觉页面、不增加数据库或外部媒体服务，也不提前实现浏览器图片优化。

成功标准：Decap 3.14.1 的 posts/projects 集合在新建、编辑和 editorial workflow 中都使用稳定 slug 派生仓库路径与公开 URL；cover 和 Markdown 正文图共享同一归档目录；全局根目录仍支持 Obsidian inbox 与媒体库暂存；正式 post/project 无论公开、草稿或未来日期都不能引用根暂存图；错误能指明期望目录和修复入口；现有正式内容无需破坏性迁移；作者手册明确先填 slug、重复文件名、改 slug 和失败修复边界；本地完整门、浏览器、GitHub Actions、Vercel 与稳定域名都验证通过。

回滚边界包括 Studio 配置、正式媒体引用门、两组测试和媒体/作者文档。内容 schema、Obsidian 原子发布事务、已有图片字节、渲染组件、OAuth、GitHub workflow 与 Vercel 配置保持不变。

## 2. 项目结构状态

- `studio/config.mjs`：新增共享的正式条目媒体/公开路径模板，posts/projects 集合各自覆盖全局暂存目录；slug、cover、body 字段增加操作顺序与重复文件名提示；
- `build/validate-media-references.ts`：根上传文件不再能成为正式正文或 cover 的所有权目标；跨 slug、缺失、大小写、空 alt 与孤儿规则继续复用；
- `tests/studio-config.test.mjs`：锁定全局暂存目录、两个集合的动态覆盖、模板常量和作者提示；
- `tests/content-media-references.test.mjs`：正式根正文/cover 拒绝进入回归集；根目录未引用文件仍计入 staging，不做孤儿清理；
- `docs/ARCHITECTURE.md`、`CONTENT_MODEL.md`、`QUALITY.md`：记录 Studio/Obsidian 两种媒体生命周期、模板和构建不变量；
- `docs/PUBLISHING.md`：给作者提供先填 slug、再上传、避免同名、禁止改 slug 和错误恢复步骤；
- `public/uploads/building-a-maintainable-blog/`、`public/uploads/myblog/`：现有两组真实资产已经符合 per-slug 契约，本轮零迁移、零字节改写；
- `docs/STATUS.md`、`docs/ROADMAP.md` 与本文件：作为仓库根 Obsidian Vault 的当前状态和迭代证据。

## 3. 设计内容

本轮设计的是作者工作流，不是公开页面。媒体有两个明确状态：根 `public/uploads/<文件>` 是尚未归属内容的 inbox/staging；`public/uploads/<slug>/<文件>` 是进入正式内容生命周期、受孤儿和所有权门管理的 archive。Studio 不再让作者手工理解并移动两者，而是在条目上下文中直接写入 archive；Obsidian 继续允许自由粘贴到 staging，再由发布器原子归档。

字段顺序把“稳定网址 Slug”放在标题之后、cover 和 body 之前，提示语明确要求先填 slug 再上传。slug 同时承担内容文件名、公开 URL 和媒体命名空间，首次保存后不可变。cover 与正文图不拆分目录，便于一篇内容整体迁移、审计和删除；同条目重复文件名可能替换已有媒体，当前用就近提示要求作者先改名，而不是伪装为已自动解决冲突。

构建错误使用作者可执行的语言：指出引用仍位于根暂存区、期望 `/uploads/<当前 slug>/...`，并区分 Studio 重新选择与 Obsidian 发布器归档。根 staging 不做自动孤儿清理，因为它可能仍被 inbox 草稿引用；archive 则必须由同 slug 正式内容引用。这个非对称生命周期是有意设计，不是校验遗漏。

## 4. 使用的技术

- Decap CMS 3.14.1 folder collection：集合级 `media_folder`、`public_folder` 与字符串模板；
- `{{fields.slug}}`：直接读取作者填写的稳定 slug，而不是默认以标题作为 `{{slug}}` identifier；
- 仓库根绝对媒体路径：`/public/uploads/{{fields.slug}}` 去除集合内容目录的相对解析歧义；
- 公开路径模板：`/uploads/{{fields.slug}}` 与 Next 静态文件 URL 保持一致；
- TypeScript 构建门：在精确存在性与跨 owner 校验之前判定根 staging 引用；
- mdast 图片抽取：cover、行内和引用式 Markdown 图片继续共享正式关系集合；
- Node 24 原生 `--experimental-strip-types` 测试入口、ESLint、TypeScript、Next.js 生产构建与 HTTP 测试；
- GitHub Actions deployment/status 与 Vercel Git Integration：实现 SHA、生产状态、自动 smoke 和稳定域名组成交付证据。

## 5. 实现的功能

- Studio 新建文章或项目时，先填写 slug 后上传的 cover 直接进入当前 slug 目录；
- Markdown raw/rich text 插入的本地图与 cover 使用相同目标目录和公开 URL 前缀；
- posts 与 projects 各自声明媒体覆盖，不依赖全局根目录作为正式保存位置；
- 全局 `public/uploads`/`/uploads` 保留，供 Obsidian inbox 和 Decap 媒体库兼容使用；
- 正式正文引用 `/uploads/<文件>` 会在构建前失败，并报告正文行号、期望 slug 目录和修复方式；
- 正式 cover 引用根文件会以 cover 标签失败，并提供同一修复路径；
- draft 与 future 正式记录继续参与所有权检查，避免媒体问题拖到公开当天才出现；
- 未被正式内容引用的根文件继续计为 staging，不触发 archive 孤儿错误；
- 跨 slug 引用、归档孤儿、精确大小写、缺失文件和正文空 alt 的既有门保持不变；
- 现有正式图片全部符合契约，不需要复制、移动、重编码或修改内容 URL；
- 作者在 Studio 字段旁直接看到先填 slug 和同名文件风险，发布手册提供改 slug 后的恢复步骤。

## 6. 实现方法

Decap 的路径语义先通过官方 folder collection 文档和仓库中实际安装的 3.14.1 源码交叉确认。`selectMediaFolder` 对以 `/` 开头的 collection folder 从仓库根解析，之后去掉前导斜杠作为 Git 路径；`folderFormatter` 在 entry data 存在时把任意字段交给模板编译器。由于默认 identifier 是标题，媒体模板没有使用容易随标题变化的 `{{slug}}`，而是与内容文件 slug 配置一样显式使用 `{{fields.slug}}`。

Studio 仍保留全局 `media_folder: "public/uploads"` 和 `public_folder: "/uploads"`。两个 folder collection 分别增加 `media_folder: STUDIO_ENTRY_MEDIA_FOLDER` 与 `public_folder: STUDIO_ENTRY_PUBLIC_FOLDER`；cover 和 body 没有字段级覆盖，因此自然继承集合路径。新建空草稿在 slug 尚未填写时无法得到安全的 per-entry 目录，所以契约通过字段顺序、必填 pattern 和就近 hint 要求先填 slug；构建门作为不可绕过的第二层保护。

引用门先把安全 `/uploads/...` URL 解析为仓库路径，再检查相对 uploads 路径的 segment 数。只有一个 segment 表示根 staging，立即抛出带当前 `record.slug` 的 `ContentValidationError`；两个以上 segment 才进入原有 owner 比对。根文件仍从 `archivedFiles` 集合排除，所以 inbox 暂存不会因没有正式 owner 而失败；一旦正式内容引用它，则在存在性检查前得到更准确的生命周期错误。

测试不把 Decap 内部实现复制进业务代码。Studio 单元测试锁定我们拥有的配置契约，随包源码与官方文档负责证明 Decap 解析语义；媒体测试则在临时仓库中写入真实可解码 WebP，分别验证根正文、根 cover、同 slug archive、draft/future 和根未引用豁免。线上验证读取实际 Vercel 提供的 `/studio/config.mjs`，确认两个集合各有媒体/公开覆盖，同时保留全局 staging。

## 7. 验证证据

- Decap 官方 Folder Collections 文档与当前安装源码交叉核对：集合级媒体目录支持 slug/字段模板，绝对 media folder 从仓库根解析；
- 定向测试：11/11 通过，包括 3 项 Studio 配置和 8 项媒体引用/尺寸测试；
- `npm run check`：ESLint、63/63 单元测试、TypeScript、33/33 页面生成、15/15 生产 HTTP/质量测试全部通过；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- 本地浏览器 `/studio`：固定 Decap 运行时和配置加载成功，显示 GitHub 登录入口，无资源失败、warning 或 error；
- 实现提交 `7682346f5620b1685ce12552cc962f08cf036ab0` 已推送 `main`；GitHub Quality Gate `30929720702` completed/success；
- GitHub Production deployment `5747675572` 与实现 SHA 关联，state=success；目标 `https://blog-aqyeokyth-czq1.vercel.app` 返回 Vercel 登录保护页，未被误当作公开博客验证目标；
- 自动 `Verify Vercel production` `30929766554` completed/success；稳定域名独立冒烟返回 `23 routes, OAuth 302`；
- 线上 `/studio/config.mjs`：200、`text/javascript`、`Cache-Control: no-store`、`X-Robots-Tag: noindex, nofollow`；posts/projects 各有 2 组 collection media/public override，总体保留全局 staging 配置；
- 线上配置包含先填 slug 和同条目不同文件名提示，稳定生产站保持公开 200；
- 网络命令只在当前进程使用 `http://127.0.0.1:7897`，未写入永久代理配置。

失败与修复证据：第一次定向测试误用了仓库未声明的 `tsx` loader，在模块加载前失败；改为 `package.json` 真实声明的 Node 原生 strip-types 命令后 11/11。第一次启动本地服务的 PowerShell 组合命令被执行策略拒绝；移除预删除并使用新的日志名后成功。浏览器把 `.mjs` 当顶层网页直开时被客户端拦截，但 Studio 页面作为 module 正常加载，随后用 HTTP 响应与线上源码验证配置。第一次远端 smoke 未设置 `NODE_USE_ENV_PROXY=1`，Node fetch 在代理环境下两域名都报网络失败；显式启用后稳定域名通过。不可变 Vercel URL 的 smoke 命中登录页，因此最终以 SHA 绑定的 deployment 元数据加公开稳定域名 smoke 为正确证据链。

## 8. 经验与教训

- 媒体目录不是单一文件夹配置，而是 staging 与 archive 两种生命周期；只有先定义 owner 和孤儿策略，才能决定根目录该保留还是拒绝；
- Decap 的 `{{slug}}` 默认来自 identifier，常常是标题；稳定字段必须显式写 `{{fields.slug}}`，否则标题修改可能悄悄移动媒体命名空间；
- collection media folder 的相对路径会以内容文件目录为基准；目标在仓库公共目录时使用根绝对模板更清楚，也更容易写测试；
- 动态目录在空草稿阶段没有 slug。编辑器提示负责预防，构建门负责兜底，两者缺一不可；
- 正式根引用必须失败，但未引用根文件不能按 archive 孤儿处理，否则会破坏 Obsidian inbox 工作流；
- cover 与正文图共享生命周期和 owner，应该继承同一 collection folder，而不是为两个字段维护易漂移的重复模板；
- 重复文件名与改 slug 不是本轮自动化已经解决的问题；把限制说清楚并让质量门阻断错误，比假装原子重命名更可靠；
- 测试命令要从 `package.json` 读取，不能凭之前项目习惯假设 `tsx` 存在；
- Node 24 原生 fetch 在代理环境中需要显式 `NODE_USE_ENV_PROXY=1`；PowerShell 自身联网成功不代表 Node smoke 也会走代理；
- Vercel deployment URL 可能受登录保护，即使 Production deployment 成功。公开验收应使用稳定生产域名，精确 SHA 则由 GitHub deployment 元数据证明；
- 浏览器模块作为 `<script type="module">` 加载成功，不意味着浏览器控制层允许把同一 `.mjs` 直接当文档导航；配置验证应组合 UI 运行状态、HTTP headers/source 和单元测试；
- 研究迭代应保持一个垂直切片：本轮解决归档所有权，不顺手引入客户端图片重编码，因而回滚范围和失败定位仍然清晰。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容契约、知识链接、内容维护、媒体预算、Obsidian 优化/事务、Studio/Obsidian per-slug 归档、cover/正文响应式展示、自动交付和恢复均可用。正式媒体现在从作者入口到 Git 路径、公开 URL、构建 owner、真实尺寸和页面展示形成闭环；根上传区只保留明确的 inbox/staging 责任。

剩余主要风险：Studio 选择器只限制 3 MiB，不会像 Obsidian 一样自动校正方向、缩放或生成 WebP；Decap 对同 slug 同文件名的替换行为没有项目级冲突界面；slug 首次保存后仍靠提示和构建门保持不变，编辑器本身没有条件只读；根 staging 不自动清理，长期会积累未引用文件；普通 Git 编辑仍可制造失败提交但不能通过质量门；附件增长会扩大 Git 历史；Decap 上游依赖审计、宽 OAuth scope、CSP 内联例外、Vercel deployment 保护/Hobby 回滚、自定义域名、统计、评论、外部提醒与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

为 Studio 媒体建立上传前质量反馈。验证 Decap 3.14.1 的 media library/widget 扩展点，优先在文件进入 Git 前读取真实格式、体积、宽高、帧数和方向，使用与 `lib/media-policy.ts` 一致的诊断；评估静态 PNG/JPEG/WebP 是否能在浏览器或受控仓库流程中确定性转为 WebP。若自动变换会破坏 editorial workflow、文件名或回滚语义，则先交付可靠预检、明确修复指引和相同契约测试，不引入外部媒体平台。
