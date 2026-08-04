# 路线图与全局状态

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| 1. 项目与内容契约 | done | 项目章程、严格 schema、稳定 slug、标签/专题索引 |
| 2. 视觉与阅读路径 | done | Commit Trace、响应式/深色、文章/项目/专题/标签/搜索 |
| 3. 发布发现与质量 | done | SEO、OG、JSON-LD、RSS、Sitemap、robots、全链路测试 |
| 4. 作者自助写作 | done | `/studio` OAuth + editorial workflow PR、Obsidian Vault/模板/附件/真实 `--push` |
| 5. Vercel 原生迁移 | production live | 原生 Next.js、无 Cloudflare 依赖、23 路由生产冒烟通过 |
| 6. 所有者生产上线 | done | Git 自动 Production、稳定域名自动冒烟、双端发布、回滚与恢复均已验收 |
| 7. 持续内容与作者体验 | in progress | Iteration 0024 完成文章/项目 outgoing 与 backlinks 双向引用账本，服务端渲染并通过 320px 复核 |

## 当前唯一主线

进入持续内容与作者体验阶段。Iteration 0024 已让正文关系在详情页形成读者侧闭环：同一服务端索引同时输出 outgoing 与 backlinks，空关系不制造界面噪声，也不依赖图数据库。下一主线转向作者附件体验：在现有 Sharp 媒体门禁前增加可回滚的本地 WebP 优化，减少手工压缩和 Git 媒体体积。需要品牌域名时再绑定自定义域名，旧公开站继续只作为迁移历史证据。

## 已知风险

- Studio 依赖 GitHub OAuth App，回调 origin 变更后必须同步修改设置并重新部署；
- Studio 运行时约 5 MB，已固定 3.14.1、同源提供并使用不可变缓存；升级时必须同步修改版本化 URL、SRI、依赖和测试；
- `decap-cms` 开发依赖树仍包含上游未提供修复的审计项；当前只向已授权作者提供固定浏览器包，后续需单独评估新版或替代编辑器；
- Decap GitHub backend 的 OAuth scope 对公开仓库仍较宽，账号应启用 2FA 并定期撤销不用的授权；
- CSP 为 Next.js 内联启动脚本暂留 `'unsafe-inline'`，未来应迁移到框架支持的 nonce；
- Vercel Hobby 只保证回滚到上一生产部署，更早版本需要 Git revert/redeploy 或更高套餐；
- Vercel 不可变 deployment URL 可能受保护；自动冒烟必须以 `VERCEL_PRODUCTION_URL` 为公开检查目标，同时用 deployment 元数据核对 SHA；
- Windows Git 凭据保存在系统凭据管理器；撤销 GitHub OAuth 授权后，Obsidian `--push` 需要重新登录；
- 内容持续增长后要继续观察 `.next/static`、Serverless 函数体积和构建时间；
- 附件仍依赖 Git 仓库存储；格式/体积/尺寸预算已建立，但尚未自动压缩或生成响应式派生；
- Current record 已有每周 60/30 天 Actions 提醒和过期门；若未来需要邮件/聊天通知，必须由所有者选择渠道后再接入；
- 内部链接支持内容页和标题锚点，详情页同时展示 outgoing/backlinks；明确不支持 Obsidian 块引用，尚未提供全站关系图；
- 自定义域名、公开邮箱、统计和评论尚未选择，但不阻塞生产上线。

## 平台历史

Cloudflare/Sites 版本曾用于首个公开站并暴露了构建日期、静态资源安全头和 320px 宽度问题；这些经验保留在 0008–0015 迭代档案。它们是历史证据，不再是当前运行目标。
