# Iteration 0011：所有者控制的交付底座

## 1. 范围与成功标准

本轮目标是把“源码可手工发布”推进为“仓库可以自行检查并部署”，同时保留当前公开 Sites 地址。成功标准是 pull request/main 都有完整质量门；Cloudflare 部署只读取所有者 secrets，对精确提交重新检查；未配置凭证时不会产生失败部署；架构、运行手册与决策记录同步归档。

## 2. 项目结构状态

新增 `.github/workflows/quality.yml`、`.github/workflows/deploy.yml`、`scripts/check-release-config.mjs` 和 ADR 0002；`package.json` 新增 `release:check`。运行时页面、内容目录、Worker 和 `.openai/hosting.json` 本轮不变。

## 3. 设计内容

本轮不改变公开博客视觉。发布体验采用“双入口、单内容源”：网页后台和 Obsidian 最终都提交 GitHub，状态反馈由提交检查与部署结果提供。Sites 生产入口继续在线，直到作者账号下的新地址通过验收。

## 4. 使用的技术

- GitHub Actions、锁定 npm 安装与 Node.js 22；
- 现有 ESLint、Node test、TypeScript、Vinext/Vite 构建和质量审计；
- Cloudflare Wrangler Action 与生成的 `dist/server/wrangler.json`；
- GitHub production Environment secrets 和仓库变量开关。

## 5. 实现的功能

1. pull request、main push 和手动触发都可运行完整质量门；
2. main push 可在显式开关后自动部署到作者自己的 Cloudflare；
3. 部署前重新运行完整检查，防止“检查提交”和“部署提交”不同；
4. 本地 `npm run release:check` 统一配置检查、全量测试和 Wrangler 干跑；
5. 未配置 secrets 时部署 job 为 skipped，而不是持续制造失败状态。

## 6. 实现方法

质量和部署使用独立工作流：前者给每次协作提供快速、明确的门槛；后者即使与质量工作流同时触发，也会自行重新检查精确提交。Cloudflare Token 和账号 ID 只由 GitHub Environment 注入。仓库变量作为启用闸门，允许先合并代码、配置账号、手动验收，再开启自动生产发布。

## 7. 验证证据

- `scripts/check-release-config.mjs` 会检查两个工作流和全部必需变量标记；
- `npm run release:check` 通过：ESLint；13/13 单元测试；TypeScript；生产构建；7/7 Worker 集成测试；6/6 发布审计；生产依赖 0 个已知漏洞；Wrangler 干跑上传 `2625.63 KiB`、gzip `624.90 KiB`，无绑定；
- Git diff 与 secret 扫描在提交前确认没有凭证进入仓库；
- 首次真实 Cloudflare 部署仍需作者完成 GitHub Environment secrets 后验证，因此迁移阶段保持 `partial`。

## 8. 经验与教训

“存在自动部署文件”不等于作者已经拥有发布能力。凭证所有权、部署开关、首次人工验收和回滚入口都是交付的一部分。先加入可关闭的部署工作流，可以在不打断当前生产站的情况下建立所有者链路。

质量工作流与部署工作流不能只靠触发顺序互相信任。部署 job 自己验证精确提交，牺牲一次重复构建，换来明确的发布证据和更小的供应链歧义。

## 9. 全局状态、风险与未解决问题

代码层自动交付底座完成，当前 Sites 生产仍是公开事实入口。所有者 Cloudflare 尚未登录，GitHub Environment secrets 和启用变量也尚未配置；因此不能声称已经完成生产迁移。网页后台和 Obsidian 入口将在后续轮次实现。

## 10. 下一轮唯一主任务

实现 `/studio` 网页发布后台，包括 GitHub 登录配置、内容集合、草稿/发布字段、预览、图片附件和发布前字段提示。
