# 路线图与全局状态

| 阶段 | 状态 | 证据 |
| --- | --- | --- |
| 1. 项目与内容契约 | done | 项目章程、严格 schema、稳定 slug、标签/专题索引 |
| 2. 视觉与阅读路径 | done | Commit Trace、响应式/深色、文章/项目/专题/标签/搜索 |
| 3. 发布发现与质量 | done | SEO、OG、JSON-LD、RSS、Sitemap、robots、全链路测试 |
| 4. 作者自助写作 | done | `/studio` OAuth + editorial workflow PR、Obsidian Vault/模板/附件/真实 `--push` |
| 5. Vercel 原生迁移 | production live | 原生 Next.js、无 Cloudflare 依赖、23 路由生产冒烟通过 |
| 6. 所有者生产上线 | done | Git 自动 Production、稳定域名自动冒烟、双端发布、回滚与恢复均已验收 |
| 7. 持续内容与作者体验 | in progress | Iteration 0026 完成正式 Markdown/cover 与上传附件的存在性、所有权和孤儿文件构建门 |

## 当前唯一主线

进入持续内容与作者体验阶段。Iteration 0026 已让正式 Markdown/cover 与上传文件形成可构建验证的双向关系：不存在、大小写漂移、跨 slug 引用和归档孤儿都会在部署前失败，同时保留 draft/future 与根目录暂存工作流。下一主线是消费已经存在但尚未渲染的 `cover` 字段，以本地固有尺寸和 `next/image` 建立第一个响应式媒体展示面，再扩展到正文多尺寸图片。需要品牌域名时再绑定自定义域名，旧公开站继续只作为迁移历史证据。

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
- 附件仍依赖 Git 仓库存储；引用完整性已闭环，但 Studio/普通 Git 入口没有自动优化，`cover` 尚未渲染，响应式派生仍待完成；
- Current record 已有每周 60/30 天 Actions 提醒和过期门；若未来需要邮件/聊天通知，必须由所有者选择渠道后再接入；
- 内部链接支持内容页和标题锚点，详情页同时展示 outgoing/backlinks；明确不支持 Obsidian 块引用，尚未提供全站关系图；
- 自定义域名、公开邮箱、统计和评论尚未选择，但不阻塞生产上线。

## 平台历史

Cloudflare/Sites 版本曾用于首个公开站并暴露了构建日期、静态资源安全头和 320px 宽度问题；这些经验保留在 0008–0015 迭代档案。它们是历史证据，不再是当前运行目标。
