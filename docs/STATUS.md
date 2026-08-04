# 当前项目状态

> 更新时间：2026-08-04 · 每轮迭代更新 · 本文件位于仓库根 Obsidian Vault 中

## 产品目标

MyBlog 是 Zach424 的个人技术知识库与公开工程日志。它把学习记录、技术判断和项目复盘保存为可检索、可链接、可版本控制的 Markdown；作者不依赖 Codex 即可从网页 Studio 或 Obsidian 发布，`main` 自动交付到 Vercel。

## 当前结构

| 模块 | 状态 | 当前责任与证据 |
| --- | --- | --- |
| 内容契约 | done | YAML + Zod 校验文章、TIL、项目、标签、专题、日期、URL、内容语境与复核日期 |
| 公开阅读 | done | 首页、文章、项目、专题、标签、搜索、关于、响应式与深色模式 |
| Markdown | done | GFM、代码高亮、H2/H3 目录、阅读时间、相邻文章 |
| 内容发现 | done | SEO、OG、JSON-LD、RSS、Sitemap、robots、本地全文搜索 |
| 网页写作 | done | `/studio`、GitHub OAuth、Decap editorial workflow、PR |
| Obsidian 写作 | done | Vault、模板、桌面发布插件、`--check-only`、`--push` |
| 附件发布 | done | Wiki/Markdown 图片转换、按内容隔离、稳定命名、越界保护、失败回滚 |
| 自动交付 | done | GitHub `main` → Vercel Production → 稳定域名冒烟 |
| 恢复能力 | done | Vercel 显式目标回滚、当前版本恢复、再次冒烟 |
| 内容知识网络 | done | Obsidian/Markdown 站内链接转换、构建期完整性校验、文章与项目双向引用账本 |
| 内容新鲜度 | done | Current/Historical 可见语境、复核日期、当前记录 180 天构建门、现行 Demo |
| 内容维护报告 | done | 本地文本/JSON、60/30 天分级、Actions 摘要与每周自动复核 |
| 媒体门禁 | done | 真实格式解码、3 MiB/2560 px/像素预算、Obsidian 诊断、Studio 限额与构建扫描 |
| 媒体引用完整性 | done | Markdown AST 图片抽取、精确路径存在性、slug 所有权与已归档孤儿附件门禁 |
| 媒体派生 | partial | Obsidian 静态 PNG/JPEG/WebP 已自动生成预算内 WebP；响应式多尺寸派生尚未实现 |

## 设计与技术

- 视觉方向：Commit Trace / Evidence Rail，中文优先、工程档案感、浅深色响应式；
- 运行时：Next.js 16.3.0、React 19.2.6、TypeScript 5、Node.js 22+；
- 内容：仓库内 Markdown、YAML、Zod，GitHub 是唯一事实源；
- 阅读：react-markdown、remark-gfm、rehype-slug、rehype-highlight；
- 发布：Decap CMS 3.14.1、GitHub OAuth、Obsidian 自有插件与 Node 发布脚本；
- 媒体：Sharp 0.35.3、mdast-util-from-markdown 2.0.3、原图安全包络、WebP 优化、引用所有权与 Git 附件跟踪；
- 维护：确定日期报告 CLI、GitHub Actions 注解与每周一自动状态复核；
- 托管：Vercel 原生 Next.js，当前链路不依赖 Cloudflare；
- 质量：ESLint、Node test、TypeScript、Next build、真实生产服务器 HTTP 测试、npm audit、线上冒烟。

## 当前运行状态

- 仓库：<https://github.com/Zach424/MyBlog>，生产分支 `main`；
- 生产站：<https://blog-iota-five-59.vercel.app>；
- 本轮候选：正式内容与上传附件双向引用完整性门禁，交付证据将在推送后补入；
- 上一轮自动交付：Quality Gate `30918539573`、Production smoke `30918580120` 均成功；Vercel Production `dpl_4trWgH63hxQq6KjvNC1qBuRWqpQB` 精确构建 `87494a302c2bca9cf286cba22f342d9fbc240100`，不可变 URL 为 `https://blog-ov3kmvadc-czq1.vercel.app`；
- 最新完成迭代：0026 内容—媒体引用完整性（本地候选）；
- Obsidian 状态：仓库根目录就是 Vault，`docs/STATUS.md` 与 `docs/iterations/*.md` 可直接阅读和维护；
- 手动外部接入：自定义域名、统计、评论、公开邮箱均暂缓，不阻塞当前开发。

## 本轮新增能力

Next 配置加载现在把正式文章/项目的 `cover` 和 Markdown 图片 AST 与 `public/uploads` 精确文件清单交叉校验。行内图片和引用式图片都会进入关系，行内/围栏代码示例不会；本地图片只允许安全的 `/uploads/...` 根路径，查询参数、锚点、相对路径、非 HTTPS 外链、编码分隔符、目录穿越和不支持扩展名会失败。引用必须与仓库文件大小写完全一致；`public/uploads/<slug>/...` 只能由同 slug 的正式内容拥有，任一无人引用的已归档文件都会阻止构建。正式目录中的 draft/future 记录仍可拥有附件，根目录文件继续保留给 Obsidian inbox 与 Studio 暂存，因此不会破坏现有编辑流。

## 风险与下一步

1. 媒体文件、引用和归档所有权已形成构建闭环，但 `cover` 字段尚未在公开页面渲染，Markdown 图片也尚未生成响应式多尺寸派生；
2. Current record 已有每周分级报告，但提醒只存在于本地输出和 GitHub Actions 摘要/注解，不发送外部消息；这是当前有意的无服务边界；
3. Obsidian 块引用是专有语法，当前明确拒绝；双向关系只在详情页按正文链接展示，尚无全站图谱；
4. Studio OAuth origin、GitHub 凭据和 Vercel Hobby 回滚范围仍需按运行手册维护；
5. 统计、评论和自定义域名需要所有者最终选择，现阶段不主动接入；
6. `decap-cms` 的开发依赖树仍有上游无修复的高危审计项；它不进入公开服务端生产依赖，但其浏览器编辑器包仅对已授权作者开放，后续应单独评估升级或替代方案。

下一轮唯一主任务：让已有 `cover` 字段真正进入文章/项目详情页。读取已验证本地图片的固有尺寸，用 `next/image` 输出无布局跳动的响应式封面，补齐 SEO/OG 选择和 320px/深色视觉；没有 cover 的现有内容保持当前布局，不要求作者补数据。
