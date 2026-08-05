# Iteration 0058：待交付正式复核安全重送与可信回执

## 1. 范围与成功标准

本轮完成 Iteration 0057 唯一主任务：作者已经得到一个经过候选字节、父级、唯一路径、tree/blob 和完整质量门验证的 `content: review <slug>` 提交，但第一次 push 没有送达时，可以留在 Obsidian 内安全重送，不依赖 Codex 或手工拼 Git 命令。

成功标准是：查看与执行保持两个独立命令；执行前再次证明 current branch 为 main 且仍是同一个精确 pending-review；push 源必须绑定已验证 commit OID，不读取或改写远端历史；服务器拒绝、网络失败、远端抢先推进和本地状态漂移都失败并保留本地提交；只有 push 后 local/tracking 同 OID 且 HEAD/index/worktree 稳定，才返回严格版本化回执。回滚功能提交 `3c1a7bdff540205cfbbe75b8c28f8c2a46ed26ee` 即可恢复 1.8.0 的只读状态，不需要 reset、强推或内容迁移。

## 2. 项目结构状态

- `lib/content/review-delivery.ts`：新增 version 1 delivery receipt 类型与纯后置条件构造器；
- `scripts/deliver-content-review.mjs`：新增精确待交付重送事务、固定 OID refspec、失败保留和 text/JSON 回执；
- `package.json`：新增 `content:review:deliver` 作者命令；
- `.obsidian/plugins/myblog-publisher/main.js`：新增严格 receipt parser、独立重送命令与 sealed receipt Modal；
- `.obsidian/plugins/myblog-publisher/styles.css`：新增交付封存轨、稳定性账本和窄屏折叠；
- `.obsidian/plugins/myblog-publisher/manifest.json`：插件从 1.8.0 升到 1.9.0；
- `tests/content-review.test.mjs`：新增纯 receipt、真实拒绝、成功重送、错误分支和 unseen remote 非快进测试；
- `tests/obsidian-plugin.test.mjs`、`tests/obsidian-publishing.test.mjs`：锁定命令参数、严格回执、零自动重试、DOM/CSS 与 1.9.0；
- Vault README、项目说明、架构、设计、发布、运维、路线图和状态同步当前事实；Next 页面、内容 schema、Studio、workflow、依赖与托管配置没有改变。

## 3. 设计内容

本轮主体是正在恢复一次已验证 Git 交付的博客所有者，唯一任务是判断“刚才是否把同一个 commit 送到了 origin/main”。只读视图继续保留 `ORIGIN/MAIN · LAST OBSERVED ── +1 ── LOCAL MAIN`；执行成功后用新的封存签名表达已完成动作：`VERIFIED LOCAL COMMIT ── SEALED PUSH ── ORIGIN/MAIN · OBSERVED AFTER PUSH`。两端短 OID 必须相同，下方 ledger 保留 source、完整 commit/tree/blob 和精确 refspec，并列出 `HEAD STABLE / INDEX STABLE / WORKTREE STABLE`。

视觉继续服从 Obsidian 宿主 token；fallback 为 Ink `#1f272a`、Verified `#2f756f`、Trace `#486f78`、Caution `#c6683c`、Paper `#f4f3ef`。正文使用 text/interface，refs、OID、path 与命令使用 monospace。回执不是成功营销卡：没有分数、庆祝图标、阴影、渐变、动画、复制、重试或再次 push 按钮；末行明确 Git 送达与 Vercel Production 是两份独立证据。窄屏把稳定性三列折为单列。

## 4. 使用的技术

- TypeScript 判别结构、40/64 位 Git object id 与 exact transition receipt；
- Git 精确 refspec `<verified-oid>:refs/heads/main`、非 force fast-forward 规则和本地 tracking ref 后置观察；
- `git ls-files --stage -z` 与 `git status --porcelain=v2 -z --untracked-files=all` 二进制快照；
- Node `spawnSync`、固定参数数组、`shell: false`、有界输出和明确退出码；
- version 1 exact-key JSON、跨字段 OID/path/subject/command/safety 重算；
- Obsidian 原生 Modal、Notice、宿主 token、语义 section/dl/code 与既有子进程生命周期；
- 临时真实 Git 仓库、裸远端 `pre-receive` 拒绝 hook、独立远端推进与非快进拒绝；
- `research-iteration-loop` 将范围固定为单一精确重送事务，先 fail-first，再用真实 bare remote 验证拒绝、成功和 postcondition，禁止顺手加入 fetch/rebase/reset 或云 API；
- `frontend-design` 将结果收敛为一条 sealed Git rail 和证据账本，保持 inspect/execute 分离，删除分数、卡片、动画与重试按钮。

## 5. 实现的功能

- `npm run content:review:deliver` 输出人读结果；`--format json` 输出稳定机器回执；
- 命令不接受路径或分支位置参数，只允许当前 main 上的精确 pending-review；
- 读取状态、保存本地表面、再次读取状态后才执行 push，任何身份漂移都在网络动作前阻断；
- push 源使用已验证 OID，不再在 Git 执行时解析可能变化的 `main` 分支名；
- push 仍为普通非强制操作，远端比本地 tracking 更新时由服务器拒绝，绝不覆盖远端；
- push 失败后确认本地 main 是否仍为目标 commit，并明确“本地提交保持不变”；
- push 成功后重新读取 delivery 状态，要求 synchronized 且 local/tracking 都等于原 commit；
- index/worktree 与执行前二进制快照完全相同，才把 `headStable/indexStable/worktreeStable` 写入回执；
- receipt 明确 `fetchExecuted/rebaseExecuted/resetExecuted: false`；
- Obsidian 新增“重新同步待交付正式内容复核”，只在可信 JSON 成功后打开 sealed receipt、reconcile 并提示完成；
- 回执缺字段、OID、关系、命令或 safety 不一致时不打开 Modal、不 reconcile、不自动重试，只引导重新查看状态；
- 真实仓库已同步时运行 deliver 以退出码 1 安全停止，没有 push。

## 6. 实现方法

前一轮建议曾写成 `git push origin main`，本轮实现前把它收紧为 `git push origin <verified-oid>:refs/heads/main`。原因是执行器验证 pending 后到 Git 解析源 ref 之间仍有极小窗口；绑定对象 ID 后，即使本地分支名被并发移动，push 的源对象仍是被验证的那个提交。目标端仍是普通 `refs/heads/main`，没有 `+` 或 `--force`，所以这个收紧不会削弱远端非快进保护。

本地 `origin/main` 仍只是最后观察。执行器不 fetch；如果真实远端已经被另一提交推进，而 tracking ref 尚未更新，普通 push 会由服务器拒绝 non-fast-forward。真实测试用第二个 clone 推进 bare remote，保留第一个 clone 的 stale tracking，再运行 deliver；结果是远端新提交未被覆盖，本地 pending 仍存在。这比执行前额外 fetch 更符合“不自动整合历史”的恢复边界。

成功退出不等于可信回执。push 返回 0 后可能发生本地 ref/worktree 并发变化，因此执行器重新取证；只有 local/tracking OID、relation、index 和 worktree 都满足后置条件才构造 receipt。若 push 已送达但取证失败，错误文案使用“push 可能已完成”，要求运行只读 status；绝不自动再 push，因为第二次网络动作会掩盖第一次的真实结果。

插件不信任 Node 脚本自述。它重新验证顶层、review、transition 与 safety 的 exact keys，四个 Git OID、slug/path/subject 派生、before commit/parent、after 双端 OID、精确 refspec 和六个固定布尔值。只有完整通过后才 reconcile 和展示。查看状态与执行重送是两个命令；pending Modal 内没有按钮，避免作者在只读取证时无意产生网络写入。

## 7. 验证证据

- fail-first：缺少 `createContentReviewDeliveryReceipt`、1.9.0 manifest 和 `deliver-pending-review` 命令，5 项新契约按预期失败；
- 定向测试分组为 content-review 21/21、Obsidian plugin 26/26、Obsidian publishing 15/15，退出码均为 0；
- 真实 bare remote `pre-receive` 拒绝 deliver：远端和本地 OID 均保持预期，pending 仍可观察；
- 错误 current branch 在 push 前阻断；成功路径返回 receipt，远端 main、local main 和 tracking ref 等于同一 commit；
- 第二 clone 推进 unseen remote 后，精确非 force push 被 non-fast-forward 拒绝，远端新提交未被覆盖，本地 pending 保留；
- 无效成功 receipt 不打开 Modal、不 reconcile、不显示重试，Notice 引导重新查看状态；
- 真实仓库处于 synchronized 时，`content:review:deliver -- --format json` 返回 1 并明确无可安全重送对象；随后只读 status 为 ahead 0 / behind 0；
- 完整 `npm run release:check` 用时 130.9 秒：Current 1 / Historical 3、inbox 0、根暂存 0、外链 2 URL / 3 occurrences / 0 issue、199/199 单元、TypeScript、45 个页面、19/19 生产应用测试、production audit 0；
- Vault 与公开项目页归档完成后再次运行 `npm run release:check`，最终树用时 148.7 秒，同样为 199/199、45 页、19/19 与 production audit 0；
- `.next/static` 为 1,819,914 B；插件 main/manifest/styles 合计 78,904 B，且不进入公开客户端；
- 功能提交 `3c1a7bdff540205cfbbe75b8c28f8c2a46ed26ee` 已推送；Quality Gate `30997586204`（#103，1m19s）与 Vercel Production 验证 `30997626809`（#96，32s）均 completed/success，并都绑定该 SHA；
- 没有新增依赖、secret、数据库、Cloudflare、外部写入 API、fetch、rebase 或 reset；真实 Obsidian 主题像素外观仍未人工截图验收，本轮只声明 DOM、行为和 CSS 契约。

## 8. 经验与教训

- 验证分支后再 push 分支名仍有 ref-resolution 窗口；精确 OID refspec 能把网络动作绑定到已验证对象；
- stale tracking 不是覆盖远端的理由；普通非 force push 的服务器判定是最终安全边界；
- “命令成功”与“证据完整”是两个状态。成功但 postcondition 不足时必须停下来重新取证，不能自动重试；
- 查看和执行应该是两个命令；把按钮塞进状态 Modal 会模糊零网络证据边界；
- receipt 是已发生事务的可审计证据，不是庆祝性 UI；完整 OID/tree/blob/refspec 比抽象“成功”更有价值；
- Git 图后置条件还不够，本地 index/worktree 也要保持稳定，才能证明交付动作没有吞掉并行作者工作；
- 失败测试要覆盖真正的 server reject 和 unseen remote advance，而不是只模拟非零退出码。

## 9. 全局状态、风险与未解决问题

正式内容复核现在覆盖人工事实确认、日期规则、完整质量门、候选原始字节与 Git-clean blob、deferred 并行工作、唯一提交 tree、push 失败识别、防重复、精确重送与可信回执。作者可以全程留在 Obsidian；Git 交付与 Vercel Production 仍是两份独立证据。站点不依赖 Cloudflare、数据库或 Codex 发布。

剩余同类缺口转移到新草稿发布。`scripts/publish-note.mjs` 在质量门后创建 `content: publish <slug>`，可能同时包含正式 Markdown、已跟踪 inbox 删除和归档附件；push 失败会正确保留本地提交，但当前只有一条错误文本，没有窄身份、重复发布阻断或安全重送。它不能直接复用 pending-review 的“唯一正式 Markdown”假设，必须先建模多路径 commit。

其他风险保持：tracking ref 仍可能过期，但服务器非快进拒绝保护远端；push 成功而本地后置状态并发漂移时不会出 receipt，需要 status 恢复真相；实际 Git 凭据和网络仍是作者环境责任；真实 Obsidian 主题、超长 path/OID 和大量记录的像素体验仍需在日常使用中观察。

## 10. 下一轮唯一主任务

实现“新内容发布待交付”只读身份与恢复基础。先审计 `content: publish <slug>` 的合法 commit tree：父级、subject、目标正式 Markdown、可选已跟踪 inbox 删除、零到多归档附件及各 blob；把它与普通 ahead、复核提交和多提交堆叠严格区分，并让第二次 publish 在已有精确待交付发布时提前阻断。输出独立版本化状态/证据，下一步才执行精确重送；不把复核 receipt 泛化成模糊通用成功，不自动 fetch/rebase/reset，不引入云 API。
