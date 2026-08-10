# Iteration 0109：文章阅读统计结构化数据

## 1. 范围与成功标准

本轮只把内容管线已经确定性计算、详情页已经展示的文章字数与阅读时长投影到 `BlogPosting`。目标是让读者可见的“4 min”和机器可读的 `timeRequired` 使用同一 `PostRecord.readingMinutes`，让正文统计与 `wordCount` 使用同一 `PostRecord.wordCount`，不增加第二套估算、frontmatter 或作者维护负担。

成功标准是：`BlogPosting.wordCount` 保留现有整数；`timeRequired` 固定映射为 ISO 8601 分钟 Duration `PT<n>M`；代表历史文章精确输出 899 与 `PT4M`；项目 `SoftwareSourceCode` 不获得文章字段；现有标题、身份、日期、作者和可见 UI 不漂移；纯函数、真实 SSR、浏览器和生产 smoke 都验证相同事实；功能稳定部署后从真实生产响应更新九路 HTML 来源基线，不能用本地输出或未部署代码自我放行。

## 2. 项目结构状态

- `lib/content/structured-data.ts`：文章生成器输入增加 `readingMinutes` 与 `wordCount`，输出增加 `wordCount` 与 `timeRequired`；
- `tests/content-structured-data.test.mjs`：精确对象覆盖 1542/`PT8M` 和最小 1/`PT1M`，继续锁定序列化顺序与可选图片边界；
- `tests/rendered-html.test.mjs`：真实 Next SSR 精确验证代表文章 899/`PT4M`，并证明项目没有两个文章字段；
- `scripts/smoke-production.mjs`：稳定生产冒烟执行相同文章/项目类型边界；
- `scripts/html-budget.mjs`、`tests/html-budget.test.mjs`：以稳定生产功能提交 `1f0b6ce5f5dd6418afdf401326a2eb7df23ce77e` 重测并冻结九路 raw/gzip 基线；
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md` 与本文件：同步结构、设计、技术、功能、方法、验证、经验、风险和下一轮主线；
- `docs/iterations/0108-pure-content-structured-data.md`：把上一轮下一步中误写的 `readMinutes` 更正为真实字段 `readingMinutes`。

## 3. 设计内容

本轮没有新增可见界面。文章详情原有 Read Time 仍显示由 `post.readingMinutes` 驱动的“4 min”，标题、封面、正文、面包屑、分享、推荐、Reference ledger 与打印版式保持原样。新增事实只位于原生服务端 JSON-LD script，不增加读者可见的重复字数、SEO 徽章、加载状态或客户端交互。

事实流保持单向：

```text
Markdown 正文
   │
   ▼
内容契约统一统计
   ├─ wordCount = 899 ───────────────┐
   └─ readingMinutes = 4 ────────┐   │
                                 │   │
可见 Read Time = 4 min           │   │
BlogPosting.timeRequired = PT4M ◀┘   │
BlogPosting.wordCount = 899 ◀────────┘
```

没有在结构化数据生成器里重新解析 Markdown，也没有让页面从 JSON-LD 反向读取可见值。这样内容契约仍是统计事实源，页面和机器表示只是两个投影。

## 4. 使用的技术

- 既有 `ContentStats` / `PostRecord` 的确定性中英文混合字数与阅读时间算法；
- TypeScript `Pick` 类型收窄与模板字面量 `PT${minutes}M`；
- Schema.org `BlogPosting`、`Article.wordCount`、`CreativeWork.timeRequired` 与 `Duration`；
- ISO 8601 Duration 的分钟表示；
- Next.js 16.3 App Router Server Components 与原生 JSON-LD script；
- Node.js test runner、TypeScript、ESLint、Next production build、真实 SSR、in-app Chromium 与 Vercel production smoke；
- Node zlib 九路 HTML raw/gzip 预算；
- `research-iteration-loop` skill 用于单一范围、失败优先、生产基线和全局复盘；`browser` skill 用于真实 DOM、可见阅读时间、类型隔离与 console 验收。

参考：[Schema.org wordCount](https://schema.org/wordCount) 将值定义为 Article/CreativeWork 的整数；[Schema.org timeRequired](https://schema.org/timeRequired) 将值定义为 CreativeWork 的 Duration；[Schema.org Duration](https://schema.org/Duration) 要求 ISO 8601 duration 格式；[Schema.org BlogPosting](https://schema.org/BlogPosting) 继承 Article 与 CreativeWork。仓库安装版本的 Next JSON-LD 指南仍要求使用原生 script，并对 `<` 做安全转义，现有 `StructuredData` 边界继续满足。

## 5. 实现的功能

1. 每篇文章 `BlogPosting` 公开正文派生的整数 `wordCount`；
2. 每篇文章把现有正整数 `readingMinutes` 确定性转换为 `PT<n>M`；
3. 生成器最小输入类型显式声明依赖两个统计事实，避免隐式读取完整记录；
4. 文章详情的可见阅读时间与 JSON-LD 共享同一个 `PostRecord`；
5. 项目结构化数据明确保持无 `wordCount`、无 `timeRequired`；
6. 代表文章的真实值被 SSR 与生产 smoke 固定为 899/`PT4M`；
7. 最小一分钟场景固定为 1/`PT1M`，不输出零分钟或小数 Duration；
8. 所有原有结构化字段、可见页面、客户端 bundle、内容文件和发布工作流保持不变。

## 6. 实现方法

先从 `lib/content/contract.ts` 核对真实字段名与统计算法：`wordCount` 是 CJK 字符数加拉丁 token 数，`readingMinutes` 是按中文 300/分钟、拉丁 200/分钟计算后向上取整并至少为 1。再核对 Schema.org，确认 `wordCount` 需要 Integer、`timeRequired` 需要 ISO 8601 Duration。上一轮文档中的 `readMinutes` 只是命名笔误，不存在于代码。

失败优先阶段先只修改生成器测试：加入 1542/8 分钟夹具与 1/1 分钟夹具。首次运行 4 项中 2 项失败，差异精确显示缺少 `wordCount`、`timeRequired`；项目与源码边界 2 项继续通过。实现只在 `BlogPostingRecord` 的 `Pick` 中加入两个字段，并在 keywords 后按固定顺序输出整数和 `PT<n>M`，没有复制内容算法或新增运行时校验。

集成层从真实正式 Markdown 经 `parsePostFile()` 得到代表文章 899/4，再让 SSR 测试和生产 smoke 精确比较；对项目则比较键不存在。真实浏览器解析 JSON-LD，同时核对 h1、可见“4 min”、项目字段隔离与空 console。功能提交经远端质量门和 Vercel 稳定部署后，再运行生产 smoke 取得九路同批次 raw/gzip，最后更新基线来源提交和测试。

## 7. 验证证据

- 规范：`wordCount` 为 Article/CreativeWork Integer；`timeRequired` 为 CreativeWork Duration；Duration 使用 ISO 8601；
- 失败优先：首次目标测试 2/4 通过、2/4 因缺少新字段失败；
- 生成器/站点身份目标测试：9/9；生成器/部署工具目标测试：10/10；基线回归与生产工具：17/17；
- TypeScript、ESLint 均通过；Next production build：49 个页面成功；应用测试：23/23；
- 浏览器：文章标题正常，JSON-LD 为 899/`PT4M`，可见“4 min”；项目标题正常且两个文章字段都不存在；console 为空；
- 完整 `npm run release:check`：149.6 秒，501/501 单元测试、49 个构建页面、23/23 应用测试、全部预算 PASS，生产依赖审计 0；
- 功能提交：`1f0b6ce feat(discovery): publish article reading stats`；
- 基线提交：`62fb47a test(performance): rebaseline article reading metadata`；
- GitHub Actions：[Quality Gate #206](https://github.com/Zach424/MyBlog/actions/runs/31354071712) 与 [Verify Vercel production #198](https://github.com/Zach424/MyBlog/actions/runs/31354099562) 均成功；
- 稳定生产 smoke：24 个 Sitemap 路由成功、OAuth 302，新文章统计与项目关闭边界通过；
- 九路新生产基线为 `/` 27309/5996、`/posts` 17862/4251、代表文章 51865/12255、代表项目 108029/24464、专题 17511/4166、标签 17332/4135、搜索 36194/13827、知识地图 35908/7244、关于页 14912/3855 B（raw/gzip）；
- 代表文章相对 0108 增加 81 B raw / 39 B gzip；九路 gzip 上限均未变化，稳定生产余量依次为 +2196、+2917、+3105、+5232、+3002、+3033、+3581、+2996、+2289 B；
- 七路结构化发现正文未变化，继续使用 3009/921、3278/755、20697/9876、3238/1241、4527/504、155/127、700/462 B（raw/gzip）基线。
- 归档后最终 `npm run release:check`：311.9 秒，501/501 单元测试、49 个构建页面、23/23 应用测试、全部预算 PASS、生产依赖审计 0。

## 8. 经验与教训

1. 结构化数据应复用读者已经看到的事实，而不是为搜索引擎再造一套难以解释的估算；
2. 文档中的字段名也属于工程契约，`readMinutes`/`readingMinutes` 的笔误必须在下一轮显式纠正；
3. Duration 不应输出“4 min”等界面文案，标准机器值应是 `PT4M`；
4. 生成器消费已经验证的 `PostRecord`，不应重复内容契约对正文、整数和最小分钟的计算；
5. 类型隔离同样重要：`SoftwareSourceCode` 虽然也有阅读统计，但本轮没有依据把 Article 字段扩散到项目；
6. 真实内容值要从正式 Markdown 经权威解析器取得，不能用 PowerShell 的英文词数或可见文本猜测；
7. 新增两个短字段仍会进入完整 HTML/RSC，必须在真实生产部署后重测代表文章；
8. 基线更新应覆盖同一次测量的全部路径并绑定功能 SHA，即使只有一条 raw 正文发生变化。

## 9. 全局状态、风险与未解决问题

博客的文章发现数据现在覆盖稳定身份、站点归属、标题、描述、发布/复核日期、语言、标签、canonical、图片、作者、正文整数统计与典型阅读 Duration；项目继续保持适合代码作品的仓库和技术栈字段。三类结构化生成边界、搜索、推荐、知识图、Feed、清单、源文、Studio、Obsidian 与 Git/Vercel 交付均稳定。

新增统计来自启发式算法，不是对每位读者的实际承诺；`timeRequired` 表达典型阅读时间，页面和文档不得把它描述为精确完成时长。中文按 CJK 字符、拉丁文按 token 计数的混合规则在当前内容上可解释，但代码块、公式和不同语言会影响统计；若算法改变，必须同步可见 Read Time、JSON-LD、测试和生产基线。作者 Person/ProfilePage、外部 canonical、集合 ItemList 等原风险继续保留，不为字段丰富度推测事实。

全局读者功能复盘发现：文章、项目、专题、标签、搜索和知识地图各自可浏览，但还没有统一按年月查看所有学习记录与项目复盘的长期档案。首页只展示最近 3 篇文章和一个精选项目，`/posts` 也不包含项目；随着内容增长，时间维度会成为缺口。它不需要手工配置，适合作为下一轮单一主线。

长期风险仍包括首次真实 Obsidian 主题与本机代理的人机验收、Decap 开发依赖上游高危项、Actions 不可变 pin 主动复核，以及自定义域名、统计、评论和公开邮箱的所有者选择。

## 10. 下一轮唯一主任务

新增服务端 `/archive` 时间档案页：从 `getAllContent()` 单一公开集合按发布日期确定性分组为年/月，混排 Article、TIL 与 Project，显示真实日期、类型、标题与摘要；无内容时提供明确空状态。把入口接入主导航、Sitemap、内部链接健康检查与生产 smoke，并用纯分组测试、真实 SSR、320px/深浅色/打印检查和 HTML/结构化发现预算闭环。保持 Markdown/Git 单一事实源，不新增数据库、客户端请求、统计服务、云配置或作者字段。
