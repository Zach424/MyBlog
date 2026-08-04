# Iteration 0023：内容维护状态报告

## 1. 范围与成功标准

项目继续服务同一目标：让作者无需 Codex 就能持续发布并维护可信的技术知识。Iteration 0021 已用 180 天硬门阻止过期 Current record 进入新部署，但风险只在第 181 天暴露；Iteration 0022 的全局复盘把“提前看见维护队列”选为下一条关键路径。本轮单一任务是建立本地与 CI 共用的确定性维护报告，不接入邮件、聊天或其他通知服务。

成功标准：报告只追踪已公开 Current record；显示最近复核日、日龄、最后有效日和剩余天数；60/30 天分级预警，第 181 天非零退出；文本、JSON 和 GitHub Actions 摘要来自同一模型；每周自动执行；Historical、草稿和未来内容不误报；报告与构建硬门共享日龄算法；现有页面、发布与部署不回归。

回滚边界包括共享日龄函数、维护派生模块、内容仓库读取导出、报告 CLI、Quality Gate schedule/summary、测试和文档。不改变 frontmatter、公开 URL、页面视觉、Studio/OAuth、Vercel 配置或 180 天有效边界。

## 2. 项目结构状态

- `lib/content/contract.ts`：导出硬门和报告共用的 `contentReviewAgeDays`；
- `lib/content/maintenance.ts`：四级状态、阈值、最后有效日、排序、文本/Markdown/Actions 格式；
- `build/validate-content.ts`：导出 `loadContentRepository`，构建校验与 CLI 共用严格解析；
- `scripts/report-content-maintenance.mjs`：`content:status` 命令、日期/JSON 选项、Actions summary 与退出码；
- `.github/workflows/quality.yml`：每次 PR/push、手动和每周一 01:00 UTC 运行报告；
- `scripts/check-release-config.mjs`：冻结 schedule、命令和摘要标记；
- `tests/content-maintenance.test.mjs`：日界、过滤、排序、输出、注解和错误测试；
- 公开页面、Markdown 内容、附件、Studio、OAuth 与 Vercel 运行时本轮不变。

## 3. 设计内容

本轮没有新增公开 UI。作者界面的信息层级按“日期与总量 → 按紧急度排序的记录 → 可执行复核清单”组织。单条记录统一显示状态、源路径、`reviewedAt`、`reviewBy` 和剩余/逾期天数，避免只给一个无法行动的红黄灯。

状态设计保持克制：61 天以上为健康，31–60 天进入复核窗口，0–30 天即将到期，小于 0 天已过期。两个预警阶段都使用 Actions warning 而不改变构建结果；只有原契约本就会拒绝的第 181 天输出 error 并返回 1。Markdown 摘要使用标准表格和 task list，可直接作为一次复核工作单；JSON保留稳定英文枚举，方便未来接入其他工具。

## 4. 使用的技术

- TypeScript：维护记录/报告类型、状态枚举、阈值与确定排序；
- UTC ISO 日期算术：与 180 天构建门共享完整日计算，避免时区小时漂移；
- Node.js `util.parseArgs`：无额外依赖的严格 CLI 参数解析；
- Node.js `fs/promises.appendFile`：写入 GitHub `GITHUB_STEP_SUMMARY`；
- GitHub workflow commands：warning/error 绑定到 Markdown 源文件；
- GitHub Actions cron：`0 1 * * 1`，对应 Asia/Shanghai 周一 09:00；
- Node test：精确覆盖 61、60、30、0、-1 天边界；
- 现有 YAML/Zod 内容解析：报告不维护第二份内容读取或 schema。

## 5. 实现的功能

- `npm run content:status` 输出当前真实维护队列；
- `--format json` 输出稳定机器可读报告；
- `--date YYYY-MM-DD` 冻结报告日，用于复现未来边界；
- `--github-summary` 写入 Markdown 表格/复核 task list，并输出 Actions 注解；
- healthy：剩余 61–180 天；
- review-soon：剩余 31–60 天，warning；
- due-soon：剩余 0–30 天，warning；
- overdue：第 181 天起，error 且退出码 1；
- `reviewBy` 精确表示第 180 天最后有效日；
- 报告按 overdue → due-soon → review-soon → healthy，再按剩余天数和源路径排序；
- 已公开 Historical 只计数不进入队列，草稿/未来内容单独计为未公开；
- `release:check` 在完整质量门前先显示维护状态；
- Quality Gate 每周自动运行，即使仓库近期没有提交也能重新计算日龄。

## 6. 实现方法

构建硬门原先在 `validateContentFreshness` 内部计算 UTC 日差。本轮把该算术提取为 `contentReviewAgeDays`，维护模块直接复用；报告和构建不会在午夜、夏令时或边界包含关系上产生两套答案。`remainingDays = 180 - ageDays`，因此第 180 天剩余 0 且仍有效，第 181 天为 -1 并过期；`reviewBy` 由 `reviewedAt + 180 days` 生成。

`loadContentRepository` 仍使用严格 YAML/Zod 解析，只把解析后的 posts/projects 暴露给 CLI；`validateContentRepository` 继续在其上执行索引、关系和硬门。报告用报告日中午 UTC 判断是否已公开，再只选 `freshness=current`。这样未来发布日期不会因时区边缘误入，Historical 证据也不会被要求持续追新。

CLI 先严格校验真实 ISO 日期和 `text|json`，再输出报告。Actions 模式把同一报告格式化为 Markdown，warning/error 的 file property 指向稳定 `sourcePath`，特殊字符按 workflow command 规则转义。due-soon 仍返回 0；overdue 返回 1，与后续 Next 构建失败同义，但报告会先给出完整清单。

定时任务复用现有 Quality Gate，而不是新增通知平台。周一 01:00 UTC 会执行 locked install、维护报告、完整测试与生产依赖审计；无需 secret 或所有者配置。`check-release-config` 与静态测试锁定 schedule 和摘要参数，防止工作流在后续重构时无声丢失提醒。

## 7. 验证证据

- 内容审计：当前仓库为 1 条公开 Current（MyBlog，`reviewedAt: 2026-08-04`）、3 条公开 Historical、0 条未公开；
- 维护/内容/交付专项测试 16/16 通过；四级边界分别验证剩余 61、60、30、0、-1 天，并验证显式仓库根目录产生稳定相对源路径；
- 本地当前日期演练：MyBlog 为 healthy，剩余 180 天，最后有效日 2027-01-31；
- 固定 JSON 演练 `2027-01-01`：`due-soon`、剩余 30 天、`reviewBy: 2027-01-31`；
- GitHub 摘要演练：同一固定日期生成可勾选 Markdown 清单和 `::warning file=content/projects/myblog.md`，退出码 0；临时摘要已删除；
- 过期演练 `2027-02-01`：显示逾期 1 天并捕获退出码 1；
- `npm run lint` 与 `next typegen && tsc --noEmit` 通过；
- 最终 `npm run release:check` 通过：报告为健康、46/46 单元测试、TypeScript、Next.js 16.3.0 build（33 个静态生成任务）、15/15 生产 HTTP/质量测试，生产依赖审计为 0；
- 实现与初始归档提交 `d80e5a2` 已推送 `main`；GitHub Quality Gate `30893387552` 为 completed/success，job `91940477519` 中 `Report content maintenance` 步骤的真实结论为 success；
- Vercel Production `dpl_Cp8RdPG7G4iTBBGsubqkNdaFg1fY` 的构建日志明确克隆 `d80e5a2e2b0b9c54850f31e14c3d69e895db5e66`，33/33 静态生成后为 Ready，不可变 URL 是 `https://blog-idmsfa9fl-czq1.vercel.app`；
- 自动生产冒烟 `30893422269` 为 completed/success；独立稳定域名冒烟返回 `23 routes, OAuth 302`；网络命令只在当前进程使用本机代理，未写入永久配置。

## 8. 经验与教训

- 硬门保护准确性，但不能替代维护计划；风险应在仍有行动时间时进入队列；
- 到期状态是派生数据，不能写回 frontmatter，否则每天都会与事实漂移；
- 报告和硬门必须共享同一日龄函数，复制相似公式仍可能在第 180/181 天产生契约分叉；
- 预警与失败应分离：60/30 天给信息和清单，第 181 天才保持既有失败语义；
- 只在 push 时计算不算主动维护；每周 schedule 才能覆盖低频更新的个人博客；
- CI 摘要比长日志更适合作为复核工作单，文件级 annotation 则负责把行动定位回 Markdown；
- Historical snapshot 是证据而非持续承诺，计数可见但不进入复核队列；
- 固定日期 CLI 同时服务测试、故障复现和未来自动化，无需污染生产时钟。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容/媒体契约、附件、知识链接、反向引用、自动交付、恢复、新鲜度硬门和维护预警均为 done。当前 MyBlog 维护记录健康，最晚应在 2027-01-31 前完成下一次复核。

剩余主要风险：内容详情只有 backlinks，没有正文 outgoing 视图或全站图谱；图片无自动压缩/响应式派生；Actions 提醒不发送外部消息；Obsidian 块引用不支持；Decap 上游开发依赖审计风险仍存在；自定义域名、统计、评论和公开邮箱继续等待所有者选择。

## 10. 下一轮唯一主任务

在文章与项目详情页增加“引用去向”账本：复用现有关系派生结果，显示正文实际链接到的公开文章/项目，与 backlinks 组成双向证据；保持服务端渲染和现有视觉语言，不引入图数据库或客户端图形库。
