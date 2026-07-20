# Iteration 0018：Git 自动交付与双端发布验收

## 1. 范围与成功标准

本轮关闭 Vercel 迁移的最后一组交付风险：将 `Zach424/MyBlog` 正式连接到 Vercel 项目，用真实 `main` 推送证明自动生产部署可用，再分别验证网页 Studio 与 Obsidian 的自助发布链路，并演练生产回滚与恢复。

成功标准是：Git 连接成功；推送提交后 Vercel 自动创建与该 SHA 对应的 Production deployment；隐藏测试草稿不会进入公开文章列表；生产冒烟通过；过程、证据、经验与剩余风险均随代码归档。

## 2. 项目结构状态

- 仓库：`Zach424/MyBlog`，生产分支 `main`。
- Vercel 项目：`czq1/blog`。
- 稳定生产入口：`https://blog-iota-five-59.vercel.app`。
- 内容源：`content/posts/*.md`，Git 为唯一事实来源。
- 网页作者入口：`/studio`，通过 GitHub OAuth 和 Decap CMS editorial workflow 写回仓库。
- 桌面作者入口：Obsidian Vault 与 `.obsidian/plugins/myblog-publisher`。
- 发布保护：内容契约、单元测试、TypeScript、Next.js 构建、真实 HTTP 测试、生产依赖审计与公网冒烟。

## 3. 设计内容

本轮不改变公开视觉设计。发布体验遵循“草稿默认隐藏、状态可追踪、失败可恢复”：测试内容使用 `draft: true`，只有进入 `main` 且显式取消草稿的内容才会出现在公开列表、RSS 与 Sitemap 中。

## 4. 使用的技术

- Vercel GitHub Integration 与原生 Next.js Production deployment；
- GitHub `main` 分支、deployment status 与 Actions；
- Decap CMS 3.14.1、GitHub OAuth、editorial workflow；
- Obsidian 自有发布插件与 `scripts/publish-note.mjs`；
- Node.js、Next.js 16、TypeScript、ESLint 与生产冒烟脚本。

## 5. 实现的功能

- 已在 Vercel 账户完成 GitHub Login Connection；
- 已执行 `vercel git connect https://github.com/Zach424/MyBlog.git`，CLI 返回 `Connected`；
- 本文件所在提交将作为第一次真实 Git 自动部署探针。

其余验收项在本轮完成后补充，不提前把待验证状态写成成功。

## 6. 实现方法

先完成账户层 GitHub Login Connection，再用 Vercel CLI 把已经存在的生产项目与唯一授权仓库关联。随后提交并推送本轮基线归档，通过 Vercel deployment 元数据核对 Git commit SHA、目标环境和最终状态，避免把手工 CLI 部署误判成 Git 自动部署。

## 7. 验证证据

- 2026-07-20：`vercel git connect` 返回 `Connected`；
- Git 自动 Production deployment：等待本提交推送后核验；
- Studio 真实草稿链路：待验收；
- Obsidian 真实 `--push`：待验收；
- 回滚与恢复：待验收；
- 最终生产冒烟：待验收。

## 8. 经验与教训

Vercel GitHub App 的仓库安装权限和 Vercel 账户的 GitHub Login Connection 是两个独立条件；前者只说明 Vercel App 可以访问仓库，后者才允许当前 Vercel 身份建立 Git 关联。验收自动部署时必须核对触发提交 SHA，不能只看稳定域名仍然可访问。

## 9. 全局状态、风险与未解决问题

生产站点、OAuth 后端、Studio 启动、Obsidian 发布预检和全量质量门已在上一轮通过。当前 Git 关联已建立，但尚需由真实推送证明自动生产部署；网页和桌面两条发布链路也尚未留下写入 Git 的端到端证据。

测试草稿必须保持隐藏并在验收后清理；回滚演练必须在恢复当前 `main` 对应部署后才算结束。

## 10. 下一轮唯一主任务

本轮尚未结束；下一步推送本归档提交并核对 Vercel 自动部署的 Git SHA。
