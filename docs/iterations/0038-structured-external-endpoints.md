# Iteration 0038：结构化外部端点统一库存

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex 即可发布和维护 Markdown 技术记录，公开内容依赖的外部地址有可复核证据。Iteration 0036 已建立正文普通 HTTPS 库存和受控 HEAD，Iteration 0037 闭合站内标题深链；但文章 `canonical`、项目 `repository`/`demo` 仍只受 schema 与人工清单约束，未进入同一来源和健康视图。

本轮只补齐这个结构化字段盲区：现有外链库存必须同时读取正文与 canonical/repository/demo，标明来源字段，与相同 URL 的正文出现确定性合并，并直接复用原有健康检查和 SSRF 边界。不得放宽内容 schema、复制网络检查器、请求第三方正文、把实时状态写回 Markdown、接入硬 CI 或新增云服务。

## 2. 项目结构状态

- `lib/content/external-links.ts`：新增 `sourceField` occurrence 契约、结构化端点抽取、跨来源聚合、稳定排序和字段文本输出；
- `scripts/report-external-links.mjs`：帮助文本明确默认读取正文与结构化端点字段；
- `tests/external-links.test.mjs`：canonical/repository/demo、`demo: null`、正文重复合并、来源排序与真实 CLI 库存；
- README、架构、内容模型、质量与发布手册：同步统一库存的作者语义；
- `docs/STATUS.md`、`ROADMAP.md` 与本文件：仓库根 Obsidian Vault 的全局状态、经验和下一主线归档；
- 网络探针、内容 schema、GitHub Actions、页面路由、部署配置和公开内容文件均未修改。

## 3. 设计内容

库存的核心单位仍是规范 URL，但维护证据的核心单位是 occurrence。一个项目可在正文中链接在线演示，同时把同一地址声明为 `demo`；这应是一个待检查目标、两个可追溯来源，而不是两个网络请求或被去重掉的一条证据。`sourceCount` 继续回答“涉及多少内容文件”，`occurrenceCount` 回答“出现多少次”，`sourceField` 回答“正文还是哪个结构化字段”。

正文 occurrence 使用 `sourceField: body`，保留 `bodyLine` 与可见 label；结构化 occurrence 使用 `canonical`、`repository` 或 `demo`，文本显示 `frontmatter.<field>` 且不伪造行号。稳定顺序为 URL → sourcePath → body/canonical/repository/demo → bodyLine → label。结构化字段由 Zod schema 先保证 HTTPS，但仍进入同一个规范化函数，防止聚合语义分叉。

## 4. 使用的技术

- ContentRecord 判别联合：post 读取可选 canonical，project 读取可选 repository 与 nullable demo；
- `URL` 标准解析：正文与字段共用 HTTPS 规范形式，补齐主机尾斜杠等标准化差异；
- GFM mdast：正文继续识别行内、引用式与裸 URL，图片和代码不参与；
- `Map<URL, occurrences[]>` 与确定性排序：跨正文/字段聚合并保留完整来源；
- 原有 Node DNS/BlockList/HTTPS 固定地址 HEAD、重定向、并发、超时和状态分类原样复用；
- Node test、真实 CLI、ESLint、TypeScript、Next 生产构建、GitHub Actions、Vercel 与稳定域名冒烟；
- research-iteration-loop skill 将范围限制为库存数据源扩展，并要求全局复盘后再选下一作者体验纵切。

## 5. 实现的功能

- `ExternalLinkOccurrence.sourceField` 明确为 body/canonical/repository/demo；
- 文章 canonical、项目 repository/demo 自动进入离线文本与 JSON 库存；
- `demo: null` 保留“没有公开演示”的内容语义，不产生空链接；
- 同 URL 跨正文和字段合并为一个 `ExternalLinkEntry`，但保留每次 occurrence；
- 文本报告对正文显示“正文第 N 行 · 标签”，对结构化字段显示 `frontmatter.<field>`；
- 健康检查仍按唯一 link entry 执行，同地址不会因多 occurrence 重复 HEAD；
- 当前真实库存从 1 URL/1 occurrence 扩展为 2 URL/3 occurrences：Vercel demo 同时来自正文和 demo 字段，GitHub 来自 repository；
- 默认库存仍零网络、零写入，实时检查仍不进入 Actions 或默认构建硬门。

## 6. 实现方法

正文提取流程保持 definition 收集与 link/linkReference walker。每次命中通过 `occurrenceFor(record, "body", label, bodyLine)` 建模；随后根据 `record.kind` 构造结构化字段列表，post 只取 canonical，project 取 repository/demo。空值和 null 跳过，其他值调用原 `normalizeExternalUrl`，成功后与正文结果一起写入 `linksByUrl`。

排序新增固定 `SOURCE_FIELD_ORDER`，避免依赖字段标签或对象属性顺序。聚合仍先按规范 URL 排序，再计算 occurrenceCount 和按 sourcePath 去重的 sourceCount。`checkExternalLinks` 接口完全未改：它接收 inventory.links，所以新端点自然沿用既有 guard/probe/retry/status 管线。JSON 是向后兼容的 occurrence 新字段；文本根据 sourceField 选择正文坐标或 frontmatter 坐标。

## 7. 验证证据

- 外链专项最终 11/11 通过；新增夹具同时覆盖 canonical、repository、demo、`demo: null`、跨正文合并、字段顺序和 sourceCount；
- 真实 JSON CLI 前后 Git porcelain 完全一致，输出 4 records / 2 unique URLs / 3 occurrences / 0 issues；
- 完整 `npm run release:check`：配置完整、Current 1/Historical 3/未公开 0、inbox 0、根暂存媒体 0、统一外链库存 2 URL/3 occurrences/0 issue；
- 同一候选通过 ESLint、111/111 单元测试、TypeScript、36/36 构建页面、17/17 真实生产 HTTP/质量测试；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- 显式真实检查（timeout 5000ms/retries 0）：2 个唯一 URL 只各检查一次；repository HEAD 200/healthy，demo timeout/attention，broken=0，进程成功；
- 实现提交 `0a7280915dacd6c8fa4a85c2612b281d5e4af57f` 已推送 `main`；GitHub Quality Gate `30949072827` completed/success；
- GitHub Production deployment `5751240598` state=success（`https://blog-695fg4xnb-czq1.vercel.app`）；`Verify Vercel production` `30949112446` 精确绑定实现 SHA且 completed/success；
- 稳定生产域名独立冒烟：`24 routes, OAuth 302`；代理只在网络命令进程内设置，未写入仓库或永久配置。

失败与修复证据：第一版结构化字段元组只允许 `string | undefined`，专项运行行为通过，但 TypeScript 正确发现项目 schema 的 `demo` 还允许显式 `null`。没有收窄 schema 或把 null 转成字符串；元组类型扩展为 `string | null | undefined`，并把显式 null 加入回归夹具，最终 lint/typecheck/真实 CLI 全部通过。一次把目标测试、lint、typecheck 和 CLI 串在同一 PowerShell 命令时，typecheck 非零被后续成功 CLI 覆盖成总退出码 0；后续验证为每一步显式检查 `$LASTEXITCODE`，避免把中途失败误报为整组成功。

## 8. 经验与教训

- 唯一 URL、内容来源数和出现次数是三个不同问题，统一库存不能只保留其中一个；
- 结构化字段有 schema 不等于有维护可见性；合法地址仍需要来源、聚合和当前健康证据；
- 可空字段应保留“明确没有”的语义，库存不能把 null 当作错误或字符串；
- 新数据源应接入既有规范化和探针管线，而不是复制一份看似简单的检查逻辑；
- 来源坐标必须诚实：正文有解析后相对行，frontmatter 有字段名，二者不能互相伪装；
- 多命令 shell 若不显式传播中途退出码，会削弱验证证据；质量步骤应 fail-fast；
- 网络结果仍需要上下文：GitHub 直连健康、Vercel 本地 DNS 路径超时不等于 demo 已失效。

## 9. 全局状态、风险与未解决问题

公开阅读、站内页面/标题完整性、知识地图、正文与结构化外链维护、双作者入口、内容/媒体/永久 URL 契约、维护报告、自动交付与恢复均可用。作者运行一个命令即可看到内容正文及核心公开端点的统一依赖面。

剩余主要风险：实时健康依赖当前 DNS/网络视角，继续保持显式软证据；Studio 同 slug 同名附件选择仍缺少现有/新文件的精确冲突证据；知识地图扩容、Git 媒体历史、Decap 固定 bundle/开发依赖审计、宽 OAuth scope、CSP 例外、Hobby 回滚、自定义域名、统计、评论和外部提醒保持既有状态。

## 10. 下一轮唯一主任务

为 Studio 增加同 slug 媒体目标冲突预检。选择文件后、交给 Decap 前，必须根据稳定 entry slug 与媒体文件名推导最终仓库路径，并与仓库已有媒体清单比较：不存在为 new；字节/摘要一致为 same；路径相同但内容不同为 replace-risk。界面应展示目标路径和证据，replace-risk 必须获得明确作者确认或安全拒绝，不能静默覆盖或只依赖 Decap 通用弹窗。复用已有 media preflight 捕获边界、stable slug 和构建权威扫描；不得上传文件、调用 GitHub API、新增云服务、修改 Obsidian 事务或放宽媒体预算。
