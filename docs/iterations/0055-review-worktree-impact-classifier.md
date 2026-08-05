# Iteration 0055：正式复核 worktree 影响分类与 deferred 作者工作

## 1. 范围与成功标准

本轮解决 MyBlog Publisher 1.5.0 的多草稿摩擦：作者复核一篇正式 Current 内容时，不应因为另一个 Obsidian inbox 草稿或刚粘贴的根附件存在，就必须先移动、提交或删除这些未完成工作。但便利不能靠 `.gitignore`、关闭工作区检查或“提交时只选目标就行”获得；完整门所读取的状态、Proof 所声明的范围和实际 commit tree 必须保持可证明。

成功标准是：一个共享 classifier 同时驱动 CLI 前置、门后复查和 Proof 生成；只允许不会让本次正式提交产生假阳性的作者工作 deferred；任何 staged、正式内容、代码、配置、嵌套归档媒体和未知路径仍 fail closed；check-only 零 Git 副作用，push 只提交目标并保留 deferred；Proof 与 Obsidian 必须逐项显示被排除的路径。回滚功能提交 `54c69b64a64b7567319fde61dd863519375ac78b` 即可恢复 1.5.0 的严格零额外工作区模式，不改变任何内容提交历史。

## 2. 项目结构状态

- `lib/content/review-worktree.ts`：新增纯影响分类器、稳定 inbox 规则、根暂存图片规则和确定性路径集合；
- `lib/content/review-note.ts`：Author Proof 从 v1 升到 v2，新增 `deferredPaths`；Proof 生成时从原始 Git 数组重新分类，不信任调用者提供的派生列表；
- `scripts/review-note.mjs`：前后 Git 审计改用 classifier，识别 intent-to-add，文本/JSON 输出 deferred，push 保留并行工作；
- `.obsidian/plugins/myblog-publisher/main.js`：严格验证 Proof v2 的数组、排序、路径类型、差集/并集和活动目标；Modal 新增 deferred 路径账本；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增 scoped Caution 侧线、路径状态与响应式列表；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.5.0 升到 1.6.0；
- `tests/content-review.test.mjs`：新增纯分类、真实 Git deferred push、已跟踪根媒体、嵌套媒体、门后新增阻断项、intent-to-add 和控制字符覆盖；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：同步 Proof v2、1.6.0、结构化 deferred UI 与异常降级；
- Vault README、架构、设计、发布、运维、路线图、状态和公开项目页同步本轮事实；Next 页面、Studio、内容模型、workflow 与 Vercel 配置没有改变。

## 3. 设计内容

视图主体仍是“正在决定是否同步正式内容的所有者”，单一任务仍是确认一次 HEAD 到当前声明的复核转换。日期 migration rail 保持唯一视觉签名；本轮没有为并行草稿增加卡片组或第二个 dashboard，而是在既有规则线 ledger 中增加一条有真实语义的隔离边界：`DEFERRED / NOT IN COMMIT`。

样式继续服从 Obsidian 宿主 token，fallback 角色为 Evidence Ink `#1f272a`、Verified `#2f756f`、Trace `#486f78`、Caution `#c6683c`、Paper `#f4f3ef`。标题使用 text、说明使用 interface、路径与 Git 状态使用 monospace。Caution 侧线表达“需要注意但不是失败”；每条路径同时显示 `MODIFIED` 或 `UNTRACKED`，不靠颜色单独传义。窄屏把状态和路径由两列折成一列。Modal 仍没有同步按钮、渐变或动画。

## 4. 使用的技术

- TypeScript 纯函数、readonly 输入、Set 去重与确定性 `localeCompare("en")` 排序；
- Git `diff --name-only -z`、`ls-files --others --exclude-standard -z`、`diff --cached --ita-visible-in-index`；
- 原有 `git add -- <path>`、`git commit --only`、`diff-tree` 与本地裸远端；
- 媒体扩展名的单一 `isSupportedImageExtension` 规则、正式内容媒体所有权约束和 Next 构建验证；
- Proof v2 exact-key schema、仓库路径安全检查、数组唯一/排序和跨数组关系重算；
- Obsidian 原生 Modal、宿主 CSS variables、语义 `dl/ul/code` 结构和现有进程账本；
- Node `vm` 行为夹具、真实临时 Git 仓库、质量门期间文件写入夹具与 `node:test`；
- `research-iteration-loop` 把范围限制为 worktree 影响纵切；`frontend-design` 保留日期轨为唯一签名，将 deferred 画成证据账本而不是模板卡片。

## 5. 实现的功能

- 已修改或未跟踪的 `content/inbox/<stable-slug>.md` 可以与正式复核共存；
- 未跟踪新增的 `public/uploads/<支持格式图片>` 可以 deferred；
- 已跟踪根附件的修改或删除继续阻断，因为它可能让本地修复掩盖 HEAD 中的坏资产；
- `public/uploads/<slug>/<file>` 嵌套归档媒体始终阻断，避免绕开正式媒体所有权；
- 任何 staged 路径都阻断，包括通常不会出现在 cached diff 的 `git add -N` intent-to-add；
- 其他正式内容、代码、配置、非法 inbox 名、非图片根文件、控制字符路径与未知路径阻断；
- 完整门前后复算影响，门运行期间新出现的阻断路径会使流程失败；
- 文本模式输出 deferred 数量、状态和路径；JSON Proof v2 输出 changed/committable/deferred/staged/untracked；
- Obsidian 逐项显示 `MODIFIED`/`UNTRACKED`，并明确这些路径保留本地、不进入本次提交；
- push 后 deferred 的 tracked 修改与 untracked 文件保持原样，远端 commit tree 只含正式目标。

## 6. 实现方法

分类不能只看路径，还要看 Git 状态。稳定 inbox 不参与 `build/validate-content.ts` 的 posts/projects 加载，因此 tracked modified 和 untracked 都可以 deferred。根暂存媒体会被构建解码和预算验证，正式内容又被明确禁止引用根路径；一个未跟踪新增根图片是加法输入，完整门会拒绝损坏文件，而远端不包含它也不会移除任何目标依赖。相反，已跟踪根图片的本地修改或删除可能恰好修复 HEAD 中的坏文件，使本地通过而远端仍失败，所以它必须阻断。

classifier 接收 changed/staged/untracked 原始数组，返回 targetChanged、blocking、deferred 和唯一 committable。CLI 先验证 main 与目标 tracked，再调用它；完整门后重新读取 Git 并再次调用。Proof 生成器不会直接复制传入的 deferred，而是用原始数组第三次派生，避免内部调用者伪造关系。插件作为独立 CommonJS 信任边界继续重算：changed 去掉目标后必须全是稳定 inbox；untracked 必须是 inbox 或根图片；两者不重叠且并集必须逐项等于 deferred；staged 为空、committable 只有活动目标。

Git 的“空 index”还包含 intent-to-add 语义。普通 `git diff --cached` 默认可能隐藏 `git add -N` 条目，因此审计和提交前验证都增加 `--ita-visible-in-index`。这不是一个 UI 特例，而是 Proof 中 `index 0` 声明成立的必要条件。

## 7. 验证证据

- 失败优先：新测试最初因 `review-worktree.ts` 不存在失败；插件测试精确失败于 manifest 仍为 1.5.0 和旧 validator 拒绝 v2 Modal；
- 首次实现定向结果 42/45，三项失败分别暴露旧文案断言、门后错误阶段丢失和 DOM harness 根节点误用；修正调用边界后 45/45；
- intent-to-add 与控制字符加固后，content-review + obsidian-plugin 30/30；
- 真实 Git push 夹具同时保留一个 tracked modified inbox、一个 untracked inbox 和一个 untracked 根附件；本地裸远端的新 commit 只含正式 Markdown，三项 deferred 仍留在工作区；
- 质量命令运行期间新增 `late-unsafe.txt` 后，门后重分类失败，HEAD/index/remote 均不变；
- 已跟踪根图片、嵌套媒体、普通未跟踪文件、非 main、目标 staged 与 intent-to-add 均有失败证据；
- 完整 `npm run release:check` 用时 132.8 秒：Current 1 / Historical 3、inbox 0、根暂存 0、外链 2 URL / 3 occurrences / 0 issue、182/182 单元、TypeScript、45 个页面、19/19 生产应用测试、production audit 0；
- `.next/static` 为 1,818,709 B；插件 main/manifest/styles 合计 48,469 B，不进入公开客户端；
- 功能提交 `54c69b64a64b7567319fde61dd863519375ac78b` 已推送；Quality Gate `30990818494`（#97）与 Vercel Production 验证 `30990859525`（#90）均 completed/success；
- 没有新增依赖、secret、云服务、API、数据库或 Cloudflare；真实 Obsidian 主题像素外观仍未人工截图验收，本轮只声明 DOM、行为和 CSS 契约。

## 8. 经验与教训

- “安全路径”必须是路径与 Git 状态的组合。未跟踪根图片是加法草稿，已跟踪根图片修改却可能掩盖 HEAD 缺陷，两者不能共用一个 allowlist；
- deferred 不是 ignored。它必须参与完整门、出现在 Proof、保留在工作区，并被明确排除出 committable/tree；
- 允许可能造成本地假阴性的额外验证输入是可接受的，允许造成远端假阳性的输入不是。这个方向性标准比“它会不会被 build 看到”更准确；
- 派生证据不能由调用者自报。Proof 生成器和插件都应从更原始的 Git 数组重算差集关系；
- `git diff --cached` 的默认可见性不足以证明 index 真空；intent-to-add 是值得真实仓库测试的 Git 边角；
- 门前与门后必须共用同一 classifier。复制两套 if/regex 很容易让新增路径在其中一个阶段漏过；
- UI 中逐项列出被排除路径，比只显示“deferred 3”更能支持提交决定；状态标签与路径比装饰性卡片更贴近作者任务。

## 9. 全局状态、风险与未解决问题

网页 Studio、Obsidian inbox 发布、Current 维护台账和正式 review-note 四条作者路径继续共享 Git 内容源。正式复核现在可以和真实多草稿工作方式共存，仍保持完整门、结构 Proof、单文件提交、自动 Vercel Production 与失败恢复；不需要 Codex、Cloudflare 或数据库运行。

根新附件仍完整进入媒体解码与预算门，因此一个损坏草稿附件会让正式复核出现安全的假阴性；这比跳过附件验证更诚实，作者可修复或暂时移走文件。插件增至 48,469 B，但只在本机加载。真实主题、超长路径和大量 deferred 列表仍需实际使用观察。

更重要的剩余风险是目标笔记本身的 TOCTOU：inspection 在长质量门前解析；门后虽然复查路径分类，但如果同一目标再次被编辑，路径仍然相同，Proof 的事实变化可能描述旧字节，而 push 会提交新字节。当前单文件 tree 约束不能证明“被检查内容”和“被提交内容”相同。

## 10. 下一轮唯一主任务

实现正式复核候选内容指纹。门前对目标原始字节计算 SHA-256；完整门后必须仍相同，push 暂存后 index blob、commit 后 tree blob也必须绑定同一候选。Proof 升版，机器证据保存完整 64 位摘要，Obsidian 用 monospace 显示可比对的短指纹与“门后未漂移”状态。测试要让质量命令在运行期间修改目标并证明 check/push fail closed、index 取消暂存、HEAD/remote 不变，同时证明 deferred 作者工作仍被保留。零自动改日期、零外部服务和独立同步动作保持不变。
