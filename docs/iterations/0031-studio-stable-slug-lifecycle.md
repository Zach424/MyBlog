# Iteration 0031：Studio 稳定 slug 生命周期

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex，即可从网页 Studio 或 Obsidian 发布学习记录和项目复盘，内容与附件进入 Git，并由 `main` 自动交付到 Vercel。Iteration 0030 已在 Studio 图片进入草稿前完成媒体预检，但动态媒体目录、内容文件名和公开 URL 都依赖 slug；已有条目若再次修改 slug，会让这三个身份静默分叉。

本轮只闭合“新建时可定名，首次保存后锁定”这一条纵切：新建和复制条目保持可编辑；已有条目和 editorial workflow 中已形成身份的条目只读、可聚焦和复制；异常漂移必须在保存前给出恢复路径；实现不得依赖生成类名、脆弱 DOM 选择器或第二份内容事实源。内容 schema、OAuth、Git 草稿、媒体预检、Obsidian 发布器与公开路由保持不变。

## 2. 项目结构状态

- `studio/stable-slug-widget.mjs`：独立的生命周期判断、身份提取、漂移校验、Decap 控件/预览和幂等注册；
- `app/studio/stable-slug-widget.mjs/route.ts`：通过现有 `studioAssetResponse` 同源提供自定义控件模块；
- `lib/studio-assets.ts`：把 stable slug 模块加入受控 Studio 资源映射；
- `studio/config.mjs`：文章和项目的顶层 slug 改用 `stable-slug`，嵌套的 `series.slug` 不受影响；
- `studio/index.html`：在 `CMS.init()` 前注册控件，增加浅/深色行内状态样式和失败兜底；
- `tests/studio-stable-slug.test.mjs`：覆盖生命周期矩阵、身份回退、漂移、只读/可编辑行为、预览、幂等注册和实际发布 bundle 契约；
- `scripts/smoke-production.mjs` 与交付测试：把新模块加入稳定域名和响应头验证；
- `README.md`、`docs/ARCHITECTURE.md`、`CONTENT_MODEL.md`、`DESIGN.md`、`PUBLISHING.md`、`QUALITY.md`：同步作者工作流、设计边界和质量基线；
- `docs/STATUS.md`、`ROADMAP.md` 与本文件：仓库根 Obsidian Vault 的当前状态与经验归档。

## 3. 设计内容

slug 是内容身份，不是普通元数据。界面沿用 Canvas / Ink / Trace / Signal 与 Commit Trace / Evidence Rail 语言，在字段正下方增加一行 `Identity state / editable|locked` 事实说明，不引入弹窗、徽章、卡片或动画。新建态明确说明首次保存后锁定、复制条目必须改名；锁定态同时解释它决定内容文件、公开 URL 和附件目录，迁移必须走 Git。

锁定输入使用原生 `readOnly`，而不是 `disabled`：作者仍可聚焦、选择和复制 slug，值也继续参与 Decap 表单序列化。`aria-readonly`、`aria-describedby`、可见说明和既有 focus handlers 保留键盘与辅助技术反馈；深色模式只覆盖状态行和只读/可编辑边界，不建立新的后台视觉系统。

## 4. 使用的技术

- Decap CMS 3.14.1 自定义 widget API：全局 `window.CMS`、`registerWidget`、`createClass`、`h` 与 custom `isValid`；
- 实际发布的 `node_modules/decap-cms/dist/decap-cms.js.map`：锁定 `Widget.js` 传入 `entry`，以及 reducer 中已有/空白/复制草稿的 `newRecord` 语义；
- Immutable-compatible `entry.get()` 与普通对象兼容读取；
- 原生 `readOnly`、ARIA 描述关系、`inputMode="url"` 和无拼写纠正的文本输入；
- Next.js 16.3.0 静态 Route Handler 与现有 Studio `no-store` / `noindex` / CSP 策略；
- Node 24 原生 test、ESLint、TypeScript、Next build、生产 HTTP 测试和稳定域名 smoke；
- GitHub Actions、Vercel Git Integration 与 deployment-status 触发的生产验证。

## 5. 实现的功能

- 新建文章和项目的 slug 在首次保存前可编辑；
- “复制条目”即使已有源路径也保持可编辑，并提示必须使用新 slug；
- 已有条目加载后自动只读锁定，不能经普通 `change` 事件改写；
- editorial workflow 中已经拥有条目身份的记录按已有条目处理；
- 优先以 Decap entry 的 canonical slug 作为身份，缺失时回退到内容文件路径 basename；
- entry 状态缺失但已经存在身份时 fail closed，避免第三方状态变化重新开放旧 slug；
- 锁定态若字段值偏离身份，custom `isValid` 在保存前要求恢复原值并说明 Git 迁移路径；
- 保留默认条目预览中的 slug 可见性；
- 注册过程幂等，并在 `<html>` 写入 `data-stable-slug-widget="registered"` 供浏览器验收；
- 注册失败时 Studio 给出 Obsidian/Git 替代发布路径，而不是在身份保护缺失时静默启动；
- `/studio/stable-slug-widget.mjs` 纳入生产 smoke 和安全响应头检查。

## 6. 实现方法

先从固定版本的实际浏览器 bundle source map 验证生命周期，而不是猜测文档外 props。Decap 的 Widget 会把 Immutable `entry` 传给 custom control；现有条目的 `DRAFT_CREATE_FROM_ENTRY` 写入 `newRecord=false`，空白和复制草稿分别写入 `newRecord=true`。因此状态机以 `newRecord` 为主：明确 `true` 可编辑，明确 `false` 锁定；字段缺失时，已有 canonical slug 或 path identity 也锁定，没有身份才可编辑。

控件自身持有最小职责。`handleChange` 在锁定态直接返回；render 同时移除 `onChange` 并设置原生 `readOnly`；`isValid` 再做一次身份漂移校验，形成 UI 与保存门双层保护。身份提取先读 entry slug，再把 Windows/Unix 路径归一后取无扩展名 basename，避免历史条目暂缺某一字段时失去保护。

模块在 `CMS.init()` 前通过官方 `registerWidget` 注册，沿用 Decap 暴露的 React helper，不新增 React 副本。注册对象保存在 CMS 上以确保热重载/重复调用幂等；DOM marker 只作为观测证据，不参与业务判断。顶层文章/项目 slug 使用新 widget，`series.slug` 仍是普通字符串，防止把引用其他专题的元数据误当成当前内容身份。

## 7. 验证证据

- 最终专项测试：stable slug 与配置/交付共 12/12 通过；完整 `npm run check`：ESLint、77/77 单元测试、TypeScript、35/35 静态页面生成、15/15 生产 HTTP/质量测试全部通过；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- 状态矩阵：新建、复制可编辑；已有、editorial workflow identity 和未知状态但已有 identity 均锁定；
- 控件树测试：已有条目 `readOnly=true`、ARIA 描述存在、change 被忽略；新建/复制可调用 `onChange`；漂移只在稳定身份形成后失败；
- 实际 `decap-cms.js.map` 回归锁定：Widget 继续传 `entry`，已有/空白/复制 reducer 继续提供 `false/true/true` 的 `newRecord` 语义；
- 本地真实 Chromium `http://127.0.0.1:3000/studio`：标题和 GitHub 登录入口正常，`data-media-preflight="installed"` 与 `data-stable-slug-widget="registered"` 均存在，console warnings/errors 为 0；测试没有登录、创建草稿或写入远端；
- 实现提交 `1c83e9d219be8ed64d248844675f05012da3041a` 已推送 `main`；GitHub Quality Gate `30935032971` completed/success；
- GitHub Production deployment `5748665857` 精确绑定实现 SHA；deployment-status 触发的 `Verify Vercel production` `30935109812` completed/success；
- 稳定域名 `https://blog-iota-five-59.vercel.app` 独立冒烟：`23 routes, OAuth 302`；
- 线上 `/studio`、`/studio/config.mjs`、`/studio/stable-slug-widget.mjs` 均为 200、`Cache-Control: no-store`、`X-Robots-Tag: noindex, nofollow`；配置包含 `stable-slug`，模块为 JavaScript 且包含注册与 `readOnly` 契约；
- 网络命令只在当前进程使用 `http://127.0.0.1:7897`，未写入永久代理配置。

失败与修复证据：最初测试读取间接安装的 `decap-cms-core@3.16.0` 源码，不能证明浏览器实际运行的 3.14.1 bundle，随后改为解析 `decap-cms.js.map` 中的同版本 sourcesContent；首次实现遗漏 custom preview，发现注册 widget 会替换默认字段预览后补上 slug 预览；深色可编辑规则最初没有覆盖边框，随后补齐状态选择器；本地未配置 OAuth，无法无副作用进入真实字段编辑页，因此用真实浏览器验证模块执行/控制台、用控件树与实际 bundle source map 验证交互契约，没有把未执行的登录后操作记为成功。

## 8. 经验与教训

- slug 同时拥有文件、URL 和附件目录，是跨层身份；只在帮助文字中提醒不足以防止静默分叉；
- `readOnly` 比 `disabled` 更适合稳定身份：阻止编辑但保留可复制性、焦点和表单值；
- 复制条目不是已有条目。即使临时带有源 path，也必须以 `newRecord=true` 保持可编辑，否则会复制出身份冲突；
- 状态缺失时应该由已有 identity 决定 fail closed，不能默认开放；
- custom `isValid` 是 UI 只读之外必要的保存保险，可覆盖异常状态、插件行为或未来渲染变化；
- 官方 custom widget API 说明注册入口和通用 props，但项目依赖的 entry/newRecord 是运行时契约；测试必须绑定真正发布的 bundle，而不是相邻依赖版本；
- DOM marker 适合证明模块已执行，但业务逻辑不应反向依赖 marker 或 Decap 生成类名；
- 研究迭代 skill 把本轮限定在一个可回滚纵切；frontend-design skill 促成字段内事实线和既有色彩复用，避免给单一状态另造视觉系统。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容契约、知识链接、内容维护、媒体预算/引用/展示、Obsidian 优化事务、Studio per-slug 归档/上传预检/稳定身份、自动交付和恢复均可用。网页作者现在可以在新建或复制时选择 slug，首次保存后从普通编辑界面不再改动内容文件名、公开 URL 与附件 owner。

剩余主要风险：真正的 slug 迁移仍必须在 Git 中同步修改内容文件、正文引用和 `public/uploads/<slug>/`，Studio 不提供自动迁移；同 slug 文件名冲突仍由 Decap 与作者处理；根 `public/uploads` 暂存文件不会自动清理；custom widget 依赖固定 Decap 3.14.1 bundle 的 entry/newRecord 契约，升级必须重审 source map 和状态矩阵；附件增长会扩大 Git 历史；Decap 上游开发依赖审计、宽 OAuth scope、CSP 内联/eval 例外、Vercel deployment 保护/Hobby 回滚、自定义域名、统计、评论、外部提醒与公开邮箱保持既有状态。

## 10. 下一轮唯一主任务

建立 root `public/uploads` 暂存区的确定性库存与陈旧报告。报告要区分被 Obsidian inbox/待发布内容引用和完全未引用的文件，给出路径、字节、最近 Git 变更和可执行清理建议；纳入本地维护 CLI 与自动化摘要，但绝不自动删除。目标是把“长期需要人工审计”从文档提醒变成可重复、可审阅、无外部服务依赖的维护证据。
