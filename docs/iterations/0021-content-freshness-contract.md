# Iteration 0021：内容新鲜度契约与公开现状校准

## 1. 范围与成功标准

项目继续服务同一目标：把学习判断和项目实践公开为可信、可维护、可独立发布的工程知识。上一轮全局复盘发现，功能已经迁移到 Vercel，但两篇早期文章仍用“当前”描述 Vinext/Cloudflare，MyBlog 项目 Demo 也指向旧站。本轮单一任务是让历史证据与当前事实明确分层，并把准确性变成持续构建约束。

成功标准：读者能从页面判断内容是当前维护记录还是历史快照；所有公开内容有最近复核日期；更新后未复核、未来复核日期和过期 Current record 会失败；现行项目描述与代码/生产站一致；Studio、Obsidian 和 Git 编辑器使用同一字段；搜索、Feed、知识链接和发布链路不回归。

回滚边界包括内容 schema、构建期新鲜度校验、详情页事实栏、Studio/Obsidian 字段、四条公开内容和相关测试/文档；不改变 Vercel、OAuth 或 Git 发布架构。

## 2. 项目结构状态

- `lib/content/contract.ts` 新增内容语境、复核日期和 180 天校验；
- `build/validate-content.ts` 只对构建日期已公开的内容执行时效门；
- `next.config.ts` 冻结一次 `CONTENT_BUILD_DATE`，同时传给内容校验和运行时；
- `components/ContentViews.tsx` 在现有事实栏显示 Context / Reviewed；
- 文章与项目动态页把 `reviewedAt` 用作 Open Graph/JSON-LD `dateModified`；
- `studio/config.mjs`、`templates/obsidian/*` 与内容 schema 同步；
- 三篇文章标记为 Historical snapshot，MyBlog 项目标记为 Current record；
- 测试覆盖字段、时间关系、180 天窗口、Studio 对齐和生产 HTML。

## 3. 设计内容

页面的单一任务是让读者在进入正文前理解“这条记录对现在作出什么承诺”。现有右侧事实栏本来就是工程证据区，因此直接增加两行：`Context` 显示 Current record 或 Historical snapshot，`Reviewed` 显示最近复核日。没有新增彩色徽章、圆角卡片或第二套状态系统。

历史文章正文开头使用已有 Markdown blockquote：Signal 左规则建立注意层级，文字同时说明记录日期、旧技术边界和当前项目链接。项目页在正文第一节提供“当前状态（2026-08-04）”，再把 Cloudflare/Sites 证据明确放入历史小节。

桌面保持标题 `minmax(0, 1fr) + 18rem` 事实栏；窄屏沿用单列。Context 是语义而非装饰，Reviewed 是可检查日期而非“最近更新”营销标签。

## 4. 使用的技术

- Zod/YAML：必填 `freshness` 与 `reviewedAt` 解析；
- TypeScript：`ContentFreshness`、`CURRENT_CONTENT_MAX_AGE_DAYS` 与构建期验证；
- 确定日期计算：以冻结的 `Asia/Shanghai` 构建日期计算完整日龄；
- Next.js 16.3 App Router Server Components：直接从内容记录服务端渲染事实栏，不增加客户端 JavaScript；
- Open Graph 与 JSON-LD：复核日期作为 `dateModified`；
- Decap CMS 与 Obsidian Templates：两个作者入口共享字段和默认值；
- Node test、TypeScript、ESLint、Next build、生产 HTTP 测试与真实浏览器；
- 本地 Next.js 16.3 文档：动态页面继续使用 Server Components 读取内容并通过 props 渲染，无需客户端状态。

## 5. 实现的功能

- 所有正式内容必须声明 `freshness: current | historical`；
- 所有正式内容必须声明 `reviewedAt: YYYY-MM-DD`；
- `reviewedAt` 不能早于 `updatedAt` 或 `publishedAt`；
- 公开记录不能声明晚于构建日的复核日期；
- Current record 超过 180 天未复核时阻断构建；
- Historical snapshot 不因时间推移自动失效；
- 草稿和计划发布日期在公开前不参与时效门；
- 详情页显示 Context、Reviewed、Published、Updated 和 Reading；
- BlogPosting/SoftwareSourceCode 的 `dateModified` 对齐复核日期；
- Studio 增加“当前维护/历史快照”和复核日期字段；
- Obsidian 文章/TIL 默认 historical，项目模板默认 current；
- MyBlog Live demo 更新为当前 Vercel 稳定域名；
- 早期文章说明 Vinext scripts 和 Cloudflare Worker 是历史实现；
- 项目复盘增加当前 Vercel 架构摘要，并拆分历史/当前结果证据。

## 6. 实现方法

schema 层先验证日期格式和字段关系。仓库层获得与运行时完全相同的冻结构建日期，把全部记录过滤为当日公开集合，再执行未来复核和 180 天校验。这样计划内容可以提前准备，真正公开时又不能绕过时效规则。

日龄用 UTC 零点的 ISO 日期差计算，避免时区小时数和夏令时影响完整日。180 天边界包含当天：第 180 天仍可构建，第 181 天失败。当前 MyBlog 记录复核于 2026-08-04，若不再次复核，2027-01-31 是最后有效日。

页面保持服务端组件：文章/项目记录直接把 `freshness` 和 `reviewedAt` 传给共享 `ContentHeader`。视觉复用事实栏与 blockquote，不新增 CSS。项目 Live demo 仍来自 frontmatter，因此 Studio、JSON/HTML 与读者点击使用同一 URL。

## 7. 验证证据

- 初次专项迁移：内容契约、关系、Obsidian 与 Studio 测试 25/25 通过；
- 加入 180 天门后专项与类型检查：26/26 通过，`next typegen && tsc --noEmit` 通过；
- Studio 运行时检查：posts/projects 字段顺序正确且字段名无重复；
- 第一次 `release:check`：38/38 单元测试、TypeScript、Next build（33 个静态生成任务）和 14/15 生产测试通过；唯一失败是旧测试硬编码单参数校验器调用文本；
- 更新静态测试以验证“冻结日期同时传给校验器与 CONTENT_BUILD_DATE”后，生产 HTTP/质量测试 15/15 通过；
- 真实 Obsidian `content:publish --check-only` 演练通过，current/reviewedAt 与标题链接共同进入发布契约；临时草稿已删除；
- 真实浏览器桌面：内容标题列 759px、事实栏 288px，无碰撞、无横向溢出；Live demo 指向 Vercel；
- 375px 内容视口：标题和事实栏都折叠为 343px 单列，无横向溢出；Historical snapshot、Reviewed 与正文历史提示正确显示；
- 最终 `npm run release:check` 通过：38/38 单元测试、TypeScript、Next.js 16.3.0 build（33 个静态生成任务）、15/15 生产 HTTP/质量测试，`npm audit --omit=dev --audit-level=high` 为 0；
- 实现与初始归档提交 `4177647` 已推送 `main`；GitHub Quality Gate run `30888792915` 为 completed/success；
- Vercel Production deployment `5739866714` 的 SHA 为 `4177647051b07f5d35da29b6d357604a97dda3e0`，与实现提交精确一致，状态 success，不可变 URL 为 `https://blog-9thaxr4lu-czq1.vercel.app`；
- GitHub 自动生产冒烟 run `30888826725` 为 completed/success；独立稳定域名冒烟返回 `23 routes, OAuth 302`；
- 独立线上内容断言：MyBlog 项目页与历史文章均返回 200，分别包含 Current record + 当前 Vercel Demo、Historical snapshot + 2026-08-04 Reviewed；网络命令仅使用当前进程本机代理，未写入永久配置。

## 8. 经验与教训

- 技术博客的“旧内容”不等于错误内容；问题是没有说明时间边界，却继续使用“当前/现在”；
- `updatedAt` 只能证明文件改过，不能证明事实被逐项确认；`reviewedAt` 必须独立表达复核；
- 单纯显示日期不会阻止腐化，只有到期构建门才能把维护承诺变成工程责任；
- 历史快照不应强制追新，否则会抹掉当时的真实约束；时效门只约束 Current record；
- 构建日期必须只冻结一次并在校验与运行时共享，否则午夜附近可能产生不一致内容集合；
- Studio 与 Obsidian 模板若不同时迁移，严格 schema 会让作者入口之一悄悄失效；
- 静态质量测试应验证架构不变量，不应冻结一个已经合法演化的函数调用字面量；
- 事实栏比新徽章更适合工程档案：它把语境当成与发布日期同等级的证据。

## 9. 全局状态、风险与未解决问题

公开阅读、作者双入口、内容契约、附件、链接、反向引用、自动交付、恢复和内容新鲜度均为 done。公开内容不再把 Cloudflare/Vinext 冒充当前架构，Live demo 与 Vercel 生产站一致。

剩余主要风险：图片没有像素/体积预算；Current record 尚无到期前提醒，只会在过期构建时失败；知识网络无全站图谱/outgoing UI；Obsidian 块引用不支持；Decap 上游开发依赖审计风险仍存在；自定义域名、统计、评论和公开邮箱继续等待所有者选择。

## 10. 下一轮唯一主任务

为本地图片建立格式、单文件体积和像素尺寸预算，在 Obsidian `--check-only`、正式发布和 Next.js 构建中给出可操作诊断；先完成确定性预检，不接入外部媒体服务或需要所有者手动配置的平台。
