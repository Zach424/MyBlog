# 系统架构

## 1. 架构目标

MyBlog 是 Git-first 个人技术博客。公开阅读不依赖数据库；网页后台、Obsidian 和普通编辑器只负责产生 Git 提交。部署平台可以替换，但内容契约、URL 和写作入口保持稳定。

## 2. 技术组成

| 层 | 技术 | 职责 |
| --- | --- | --- |
| 界面 | React 19、Next.js 16 App Router | 页面、元数据、Route Handlers 与服务端渲染 |
| 内容 | Markdown、YAML、Zod | 文章/项目解析、字段校验、草稿过滤与派生索引 |
| 维护 | Node CLI、GitHub Actions | Current record 日龄、分级队列、摘要与过期门 |
| 阅读 | react-markdown、remark-gfm、rehype | GFM、标题锚点、代码高亮与目录 |
| 发现 | 本地搜索、RSS、Sitemap、robots、JSON-LD | 检索、订阅与搜索引擎发现 |
| 发布 | Decap CMS、Obsidian、GitHub | 两个作者入口，共用同一内容事实源 |
| 媒体 | Sharp、Git `public/uploads` | 原图安全解码、确定性 WebP 优化、公开预算与附件版本化 |
| 托管 | Vercel | Git 自动预览、`main` 生产部署、环境变量与回滚 |
| 质量 | Node test、TypeScript、ESLint、生产 HTTP 测试 | 内容、HTML、安全、链接、体积与发布契约 |

## 3. 项目结构

```text
app/
  api/cms/{auth,callback}/route.ts  GitHub OAuth 同源端点
  studio/                           Studio HTML、配置、样式和版本化 CMS 运行时路由
  posts/ projects/ series/ tags/   集合与详情页
  search/ about/                    搜索和关于页
  rss.xml/ sitemap.xml/ robots.txt/ 发现端点
components/                         站点框架、内容视图、Markdown、搜索
content/
  posts/ projects/                  唯一公开内容源
  inbox/                            Obsidian 待发布区
public/uploads/<slug>/              按内容隔离的公开图片附件
lib/
  content/                          内容契约、维护报告、文件读取、派生索引与引用关系
  cms-oauth.ts                      签名 OAuth state 与 token 交换
  media-policy.ts                   原图安全包络、WebP 优化与公开媒体预算的共享策略
  obsidian-publishing.ts            Obsidian 校验、附件与目标路径转换
  studio-assets.ts                  构建期 Studio 资源响应
studio/                             Decap CMS 源文件（不放入 public）
templates/obsidian/                 文章、TIL、项目模板
scripts/                            发布、内容维护报告、冒烟、迁移和生产测试器
build/validate-media.ts             构建前递归扫描全部公开上传图片
tests/                              单元、生产 HTTP 与质量审计
.github/workflows/
  quality.yml                       PR/main/每周完整质量门与维护摘要
  production-smoke.yml              Vercel 生产部署成功后的在线验收
  rollback.yml                      所有者手动 Vercel 回滚与复核
vercel.json                         Vercel Next.js 框架声明
```

## 4. 内容与构建

`next.config.ts` 在开发和构建开始时冻结作者时区日期，并行执行内容与媒体仓库校验。内容校验器先验证全部 Markdown，再对已公开内容执行关系完整性与新鲜度检查；媒体校验器递归扫描 `public/uploads`，拒绝符号链接、非图片、损坏图片、扩展名伪装和预算超限。纯净 Git 检出尚无上传目录时等价于零张图片；目录一旦存在，所有子项都必须通过校验。`lib/content/index.ts` 在构建/服务端从 `content/posts` 与 `content/projects` 读取文件，解析为统一记录，过滤草稿和未来内容，再派生专题、标签、搜索、RSS 与 Sitemap。

公开日期按 `Asia/Shanghai` 在 Next.js 配置加载时冻结为 `CONTENT_BUILD_DATE`。同一个部署内的页面、搜索和 Feed 因而共享确定内容集合，不会因 Serverless 实例启动时间变化。

每条正式内容声明 `freshness` 和 `reviewedAt`。`historical` 是保留当时决策的快照，不随时间失效；`current` 承诺与现行系统一致，公开后最多 180 天必须复核。复核日期不能早于内容更新日期、不能晚于构建日期。详情页服务端渲染 Context 与 Reviewed；结构化数据的 `dateModified` 使用复核日期。

`lib/content/maintenance.ts` 复用构建硬门的 UTC 完整日计算，把公开 Current record 派生为 healthy、review-soon、due-soon、overdue。60 天进入复核窗口，30 天进入紧急队列，第 180 天仍是最后有效日，第 181 天过期。`scripts/report-content-maintenance.mjs` 提供文本/JSON、固定日期演练、GitHub Markdown 摘要和源文件注解；Historical、草稿与未来记录不参与队列。Quality Gate 在 push、PR、手动运行和每周一 01:00 UTC 执行报告，只有 overdue 返回非零，预警不改变原 180 天契约。

内容目录通过 Next.js output tracing 显式包含在部署中，既支持 Vercel Serverless，也不会依赖开发机器路径。

## 5. 作者发布链路

```text
网页 /studio ─┐
              ├─ GitHub 提交/PR ─ 质量门 ─ main ─ Vercel 自动生产部署
Obsidian ─────┘                                      │
                                                    └─ 生产冒烟
```

Studio 在浏览器中用当前 origin 生成 `base_url`。`/api/cms/auth` 创建十分钟有效、HMAC 签名且绑定 origin 的 state；`/api/cms/callback` 交换 GitHub token，并且只向发起授权的同源窗口发送结果。未设置 `GITHUB_OAUTH_ID` 或 `GITHUB_OAUTH_SECRET` 时返回 503，发布入口安全关闭。

Studio HTML、配置和预览样式保留在仓库根 `studio`；完整 `decap-cms@3.14.1` 浏览器包作为构建期依赖，由第四个版本化 Route Handler 同源返回。未知子资源返回真实 404。资源不进入 `public`，以便统一应用专用 CSP、`X-Robots-Tag` 与 OAuth 弹窗策略。

Obsidian 草稿中的 Wiki 图片嵌入和指向 `public/uploads` 的 Markdown 图片会在发布前转换。文件进入 `public/uploads/<内容 slug>/<稳定文件名>`，正文改写为对应 `/uploads/...` URL；文件名不稳定时使用可读 ASCII 名加路径哈希消除冲突。静态 PNG/JPEG/WebP 的公开文件名统一使用 `.webp`，相同 stem 的多种源格式因而会在修改工作区前被拒绝为目标冲突；GIF 和 AVIF 保持扩展名。

发布器先在仓库内 `node_modules/.cache/myblog-publish-*` 创建同盘 staging。每个静态 PNG/JPEG/WebP 都先自动校正 EXIF 方向，以固定 quality 82、alpha quality 100、effort 6 的 Sharp 参数生成 WebP，并在 staging 中重新执行公开预算检查；满足预算且重编码不会更小的已有 WebP 保持原字节。GIF、AVIF 和动画 WebP 不改变字节，但必须先满足公开预算。`--check-only` 完成同样的派生并报告源/产物差异，然后删除 staging，不修改工作区。

正式发布写入目标 Markdown、移除 inbox 草稿后，先把每个原附件 rename 到 staging backup，再把验证过的产物 rename 到最终路径。staging 与工作区同盘，所以安装和恢复不依赖跨卷复制。完整质量门失败时按逆序删除已安装产物、将每个 backup rename 回精确源路径、删除目标 Markdown 并按原文本恢复 inbox 草稿；成功后才删除 backup。预检、目标冲突和 `--push` 暂存区检查都发生在事务之前，避免失败残留。

媒体策略只接受 PNG、JPEG、WebP、GIF 和 AVIF，扩展名必须匹配解码格式。自动优化原图安全包络为 25 MiB、8192×8192 px、4000 万单帧像素；公开单文件上限仍为 3 MiB，宽高上限均为 2560 px，单帧上限 800 万像素，动图上限 8000 万总像素。Studio 的文件选择器先应用 3 MiB 上限，构建扫描仍是所有入口的权威门禁。Sharp 的 libvips 缓存在短命发布/校验进程中关闭，避免 Windows 保留附件句柄。

同一发布阶段还会读取 `content/posts` 与 `content/projects` 的稳定文件名，把 Obsidian Wiki/Markdown 笔记链接转换为站点 URL。裸 slug 只有在文章和项目之间唯一时才可使用；显式 `posts/<slug>`、`projects/<slug>`、别名和标题链接均受支持，块引用被明确拒绝。转换跳过行内代码和围栏代码，避免把教程中的语法示例当成真实关系。

`lib/content/markdown.ts` 从公开正文抽取 `/posts/*` 与 `/projects/*` 链接，`lib/content/relations.ts` 校验目标并一次派生 `outgoingByUrl`/`backlinksByUrl`。`lib/content/index.ts` 只暴露两个只读查询，文章与项目详情页在服务端把它们交给同一 Reference ledger：`→` 追溯当前正文引用的依据，`←` 继续阅读引用当前记录的后续实践；空方向省略，两侧都空时不产生账本。关系不存入 frontmatter、客户端状态或数据库，正文链接就是唯一事实源；草稿或未来目标不在公开集合中，因此公开内容不能引用尚未公开的目标。

## 6. 安全与缓存

`next.config.ts` 为所有响应声明 CSP、HSTS、`nosniff`、`DENY`、权限策略、来源策略和 COOP，并关闭 `X-Powered-By`。公开 HTML 使用浏览器复核、CDN 一小时缓存与一天 stale-while-revalidate；Studio HTML、配置、预览 CSS、OAuth 和未知 Studio 路径必须包含 `no-store`。版本化且带 SRI 的 CMS 运行时使用一年不可变缓存。

一般页面的 COOP 为 `same-origin`；Studio 与 OAuth 为 `same-origin-allow-popups`，以允许 GitHub OAuth 弹窗完成握手。Studio CSP 不允许第三方脚本源，只额外允许 GitHub API、GitHub 授权页和头像来源；`unsafe-eval` 例外被限制在 Studio 路由，因为固定版本 Decap 编辑器/解析器需要运行时求值。

## 7. 部署与回滚

Vercel GitHub Integration 负责每个分支的 Preview 和 `main` 的 Production，不再维护重复的部署 Action。GitHub `deployment_status` 成功事件触发生产冒烟，检查代表页面、全 Sitemap、Studio/OAuth、Feed、安全头和 404。

紧急恢复使用 Vercel Instant Rollback。仓库内手动工作流调用固定版本 Vercel CLI，回滚后对稳定生产域名重跑同一冒烟；Git 历史随后通过 revert 或修复提交恢复一致性。

## 8. 不变量

- GitHub 仓库是内容、附件、版本和回滚的唯一事实源。
- 稳定 URL 来自文件名/slug，不随日期和平台变化。
- 草稿、未来内容不能进入页面、搜索、RSS 或 Sitemap。
- 公开站内链接必须指向同一构建中的公开文章或项目；outgoing 与 backlinks 只能从同一正文链接集合派生。
- 公开内容必须声明语境和复核日期；Current record 超过 180 天未复核不能进入新部署。
- Current record 的报告状态与构建硬门必须复用同一日龄计算；Historical、草稿和未来内容不进入维护队列。
- `public/uploads` 只能包含真实可解码且扩展名匹配的白名单图片，并满足共享公开媒体预算；Obsidian 自动优化只能从受限原图包络进入 staging，验证产物后才能原子安装。
- `/studio` 与 OAuth 永远不缓存、不索引，并维持同源 state 验证；只有版本化 CMS 运行时可不可变缓存。
- 发布平台不能成为写作前置条件；Obsidian 和 Git 提交在本地仍可完成。
- 每轮结构、设计、技术、功能、方法、验证、经验和风险必须与代码一起归档。
