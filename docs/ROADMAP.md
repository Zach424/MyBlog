# 开发路线图

状态定义：`done` 已实现且有验证证据；`partial` 已开始但未完成；`pending` 尚未开始。

| 阶段 | 状态 | 完成门槛 |
| --- | --- | --- |
| 1. 工程与归档基线 | done | 干净安装、构建通过、文档归档、独立提交 |
| 2. 内容与视觉系统 | done | schema、构建期内容管线、Markdown 正文渲染、视觉方案与首页完成 |
| 3. 博客核心功能 | done | 首页、列表、文章、项目、专题、标签、关于与 404 路径通过集成测试 |
| 4. 发布能力 | done | SEO、分享卡、草稿过滤、搜索、RSS、Sitemap 与 robots 通过 Worker 集成测试 |
| 5. 上线候选 | done | 自动化关键路由、语义、可访问性 Token、性能预算、安全头、依赖审计与 Cloudflare 干跑通过 |
| 6. 生产上线与维护基线 | done | Sites 私有生产部署成功，23/23 路由与发布端点在线验收通过，维护和回滚手册已冻结 |
| 7. 公开发布 | done | Sites 访问策略为 public，无凭证 23/23 路由与未登录 320px 首页、搜索、控制台验收通过 |
| 8. 所有者自助发布 | partial | GitHub 质量门、Cloudflare 部署/冒烟/回滚闭环已实现；待配置所有者 secrets、执行首次部署和切换入口 |
| 9. 网页后台与 Obsidian | partial | `/studio`、Worker-first 安全路由与 Obsidian Vault、模板、附件、校验/提交命令完成；待真实账号和内容联调 |
| 10. 持续内容维护与可选域名 | pending | 使用任一自助入口发布真实内容；可选域名、评论和统计只由真实需求触发 |

## 当前关键路径

1. 按 [MIGRATION.md](./MIGRATION.md) 完成 Cloudflare 授权、稳定 origin 与 GitHub secrets/variables；
2. 使用真实 GitHub OAuth App 验证 `/studio` 登录、草稿 pull request、图片和发布；
3. 在 Obsidian 桌面端启用插件，完成一条真实草稿的 check-only 与发布；
4. 验收新生产 origin 后切换入口，并用任一自助入口发布真实内容证明流程不依赖 Codex。

## 已知风险

- Vinext 仍需在项目范围内验证 Next.js 兼容边界。
- 当前候选版的 Wrangler 干跑总上传为 `2645.50 KiB`，gzip 后 `631.55 KiB`；已低于项目预算，仍需在内容增长后持续观察体积与冷启动表现。
- 动态主机元数据会让 Vinext 把 `/` 标记为 `Unknown` 路由；构建、Worker 渲染和生产绝对 URL 已通过验收，框架升级后仍需回归。
- Sites 前两个生产版本中 Sitemap 仅含 7 个基础 URL，首页与集合页也没有内容；详情 404 是内容索引为空的结果。根因已修复为构建期作者时区日期，第三个生产版本已通过 23/23 路由在线验收。
- Windows Chromium 的系统字体折行已经过 1440px、390px 与 320px 验收，公开未登录会话也在 320px 复核；macOS、Safari 和 Firefox 的字宽差异仍需回归。
- 320px 验收曾发现根 `20rem` 最小宽度与桌面滚动条共同产生 15px 横向溢出；最小宽度已删除并加入静态回归门槛。
- 当前 CSP 为兼容 Vinext 的内联启动脚本与现有 CSS 保留 `script-src/style-src 'unsafe-inline'`；后续如框架支持 nonce，应继续收紧。
- Sites 访问策略现为公开；后续每次部署都必须确认本轮提交的内容适合面向公众，并用未登录会话终验。
- GitHub 与 Sites 公开入口和首批内容已确定；自定义域名、邮箱公开范围和其他联系方式尚未选择，但不阻塞当前生产站运行。
- Cloudflare 静态资源默认优先曾绕过 Studio 安全头，并在首次修复中触发 index 规范化重定向环；现已用精确 `run_worker_first` 路由和 Wrangler 23 路由冒烟覆盖，升级 Cloudflare/Vinext 插件后必须回归。
- Sites 第 7、8 个生产版本分别证明其静态资产层可绕过 Worker-first 并忽略 `_headers`；Studio 已移出公共资产并编译进 Worker，且构建会先清理 `dist`，修复版完成公网冒烟前保持为待验收风险。
