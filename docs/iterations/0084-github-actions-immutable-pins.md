# Iteration 0084：GitHub Actions 不可变引用门禁

## 1. 范围与成功标准

本轮只处理 GitHub Actions 供应链的可复现性：从 `actions/checkout` 与 `actions/setup-node` 官方仓库核对当前 v6 指向，把三个 workflow 的六处引用固定到完整 commit SHA，并用本地结构测试与发布前检查拒绝浮动 ref、短 SHA、未复核 SHA、错误仓库和注释漂移。触发器、权限、runner、应用 Node 22、npm cache、workflow 命令、Vercel 语义与公开页面不得改变；不得启用 Dependabot、Renovate、真实 API 或新云服务。

## 2. 项目结构状态

- `.github/workflows/quality.yml`：质量门的 checkout/setup-node 改为完整 SHA；
- `.github/workflows/production-smoke.yml`：生产冒烟的两处 action 改为相同固定值；
- `.github/workflows/rollback.yml`：手动回滚验证的两处 action 改为相同固定值；
- `scripts/github-actions-pins.mjs`：新增唯一的 action 仓库、SHA 与可读 major 注释事实源，以及源码级严格验证器；
- `scripts/check-release-config.mjs`：发布前检查复用严格验证器，不再要求旧的 `@v6` 字符串；
- `tests/github-actions-workflows.test.mjs`：同时验证 YAML 语义和原始源码注释，并加入五类恶化夹具；
- `README.md`：公开记录六处官方 Actions 不可变 SHA 门禁已验收；
- `app/`、`content/`、Obsidian 插件、OAuth、Vercel 配置与作者文件均未改变。

## 3. 设计内容

执行引用使用完整 40 位 SHA，可读版本只保留为同一行的 `# v6` 注释。这样 runner 不再受可移动 major tag 影响，维护者仍能快速识别兼容主版本。验证分两层：YAML 解析结果锁定两个 action step 的顺序、Node 22 与 cache 契约；源码解析器锁定官方仓库名、40 位小写十六进制 SHA、已复核值和精确注释。发布前脚本与测试从同一 ESM 模块读取固定值，消除双重事实源。

## 4. 使用的技术

- Git `ls-remote`：直接核对官方仓库 `refs/tags/v6`、同名分支和语义版本 tag；
- GitHub 官方安全建议：完整 commit SHA 是不可变 action 引用，并应确认它来自官方仓库而非 fork；
- GitHub Actions：action 自身继续使用 v6 的 Node 24 runtime，应用构建仍显式使用 Node 22；
- Node.js ESM、命名捕获组与全局多行正则：从原始 YAML 源码读取 `repository@ref # comment`；
- `yaml` 与 `node:test`：分别验证 workflow 语义和失败模式；
- 官方证据：[checkout v6.1.0](https://github.com/actions/checkout/releases/tag/v6.1.0)、[checkout commit](https://github.com/actions/checkout/commit/d23441a48e516b6c34aea4fa41551a30e30af803)、[setup-node v6.5.0](https://github.com/actions/setup-node/releases/tag/v6.5.0)、[setup-node commit](https://github.com/actions/setup-node/commit/249970729cb0ef3589644e2896645e5dc5ba9c38)、[GitHub Secure use](https://docs.github.com/en/actions/reference/security/secure-use)。

## 5. 实现的功能

1. `actions/checkout` 六处中的三处统一固定为 `d23441a48e516b6c34aea4fa41551a30e30af803 # v6`，该值与官方 `v6`、`v6.1.0` tag 一致；
2. `actions/setup-node` 三处统一固定为 `249970729cb0ef3589644e2896645e5dc5ba9c38 # v6`，该值与官方 `v6`、`v6.5.0` tag 一致；
3. 三个 workflow 只允许恰好两个已复核 action，新增或换序会触发结构错误；
4. 浮动 major、12 位短 SHA、任意其他 40 位 SHA、非官方仓库与 `# latest` 等注释漂移都会失败；
5. `release:check` 在安装、测试、构建前先运行同一固定值验证器，避免本地单元测试与发布预检互相矛盾。

## 6. 实现方法

先用官方远端 refs 得到两个当前 v6 commit，并确认不存在同名 `refs/heads/v6`。随后只修改测试：旧 workflow 得到 4/5 通过、1 项失败，错误精确为 checkout 仍使用非完整 SHA。六处改值后定向测试转为 5/5。第一次完整 `release:check` 又失败在旧 `check-release-config.mjs` 的 `uses: actions/checkout@v6` 标记，证明仓库存在第二套契约；因此新增共享模块，让测试与发布预检调用同一个验证器，再重新执行全部门禁。

## 7. 验证证据

- 官方 refs：checkout `v6 = d23441a48e516b6c34aea4fa41551a30e30af803 = v6.1.0`；setup-node `v6 = 249970729cb0ef3589644e2896645e5dc5ba9c38 = v6.5.0`；
- 失败优先：workflow 测试 4/5 通过、1 项按预期失败；五类恶化夹具本身均成功拒绝错误输入；
- 修复后 workflow 测试 5/5，通过 `.github` 全量扫描确认六处引用且无浮动/短 SHA；
- workflow 与部署契约组合 7/7；完整单元测试 377/377；
- `npm run release:check` 成功：ESLint、类型检查、45/45 页面构建、19/19 应用测试、生产依赖审计 0；
- 真实只读状态：author doctor 13/13 ready，inbox 0、暂存媒体 0、外链离线库存本地问题 0；
- 功能提交：`26ab5cc8c8a5576cb6d524a0b8e75f750a6b22f8`；
- [Quality Gate #151](https://github.com/Zach424/MyBlog/actions/runs/31080308460) 成功；[Verify Vercel production #144](https://github.com/Zach424/MyBlog/actions/runs/31080346240) 成功；
- 稳定生产入口 `/`、`/projects/myblog`、`/studio` 均返回 HTTP 200。

## 8. 经验与教训

只更新 workflow 和对应单元测试仍不够：发布预检里残留的旧字符串契约会要求系统退回浮动 tag。完整 release 门禁及时暴露了这个分叉，把 action pin 抽成共享事实源后，两条验证路径才真正一致。另一个经验是“最新版”不等于“漏洞已修”：复核时 `decap-cms` 最新为 3.15.1，但 npm 仍把直接包及 `immutable` 链路标为无可用修复；因此没有用一次高回归升级制造虚假的安全完成状态。

## 9. 全局状态、风险与未解决问题

三个 workflow 的六处移动 tag 风险已关闭，触发器、权限和命令语义没有变化。不可变 pin 的代价是不自动接收上游安全与缺陷修复；自动更新机器人仍按范围要求暂缓，后续必须以官方仓库 refs 主动复核，且不能把 `# v6` 注释误认为执行引用。Decap CMS 的开发依赖高危树仍存在，但不进入公开服务端生产依赖，当前生产审计继续为 0。真实 Obsidian 主题交互、品牌域名、统计与评论仍属于需所有者选择或真实宿主的延期项。

## 10. 下一轮唯一主任务

为文章与项目详情页增加无需外部服务的读者分享控件：服务端传入规范 URL，客户端优先调用 Web Share API，不支持时回退 Clipboard API；用户取消必须静默，真实失败不得显示成功，执行期间避免重复触发，并用可访问的 `aria-live` 回执说明“已分享”或“已复制链接”。保留打印来源、内容语义、页面 canonical 和无 JavaScript 阅读能力；不得接入社交平台 SDK、跟踪器、短链、账号或云 API。实施前阅读当前 Next.js 16 客户端边界文档并使用 frontend-design 约束视觉融入。
