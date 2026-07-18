# 上线、维护与回滚手册

## 1. 当前生产状态

- 托管：Sites / Cloudflare Worker-compatible application；
- 生产地址：`https://zach424-engineering-notes.zhiqingchen792.chatgpt.site`；
- 访问范围：仅所有者，未向群组或公众开放；
- 数据能力：D1 与 R2 均未启用，内容和历史以 Git 仓库为准；
- 发布模型：构建期读取 Markdown，保存不可变 Sites 版本，再部署到稳定生产地址。

站点公开访问或共享范围属于外部可见性变更，必须在用户明确确认后执行。短期源码凭证、旁路验收 Token 和其他密钥不得写入仓库、命令记录或本文档。

## 2. 日常内容发布

1. 在 `content/posts` 或 `content/projects` 新增 Markdown；文件名即稳定 slug。
2. 按 [CONTENT_MODEL.md](./CONTENT_MODEL.md) 填写 frontmatter。未来日期和 `draft: true` 不会进入公开索引。
3. 本地运行 `npm run dev`，检查正文、目录、代码块、内链和窄屏折行。
4. 运行完整门槛：

   ```bash
   npm run check
   npm audit --omit=dev --audit-level=high
   npx wrangler deploy --dry-run --config dist/server/wrangler.json --outdir .wrangler/dry-run
   ```

5. 更新稳定文档和当前迭代归档，创建独立 Git 提交并推送 GitHub。
6. 通过 Sites 发布流程推送同一提交、用官方打包脚本保存版本，并部署该已保存版本。不得用未提交或不同提交的构建替代。
7. 完成下节在线冒烟验收后，才能把轮次状态标记为 `done`。

发布日期按构建时的 `Asia/Shanghai` 日期冻结。预定未来发布的文章到期后仍需要重新构建和部署；平台冷启动不会自动改变同一版本的公开内容集合。

## 3. 每次部署后的在线验收

最小检查顺序：

1. `/`、`/posts`、`/projects` 和一条最新详情返回 200，正文不是空集合；
2. `/sitemap.xml` 的 URL 数量符合当前内容模型，并逐一返回 200；
3. `/search?q=<新内容关键词>` 能找到新内容；
4. `/rss.xml` 条目数、标题、链接和生产主机正确；
5. `/robots.txt` 指向生产 Sitemap，`/icon.png` 返回 `image/png`；
6. 文章含 `BlogPosting`，项目含 `SoftwareSourceCode` JSON-LD；
7. 成功 HTML 使用浏览器不缓存、边缘缓存一小时的策略，并包含 CSP、HSTS、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff` 与 Referrer Policy；
8. 随机不存在路径返回 404 且 `Cache-Control: no-store`。

私有站点的无界面验收必须使用 Sites 临时旁路凭证，并只放在进程内存中。在线验收结果只归档状态、数量和响应头，不归档 Token。

## 4. 监控与故障分级

当前没有数据库或写接口，主要风险集中在可用性、内容索引、缓存和平台构建。

| 等级 | 现象 | 立即动作 |
| --- | --- | --- |
| P1 | 首页不可访问、全部 5xx、错误版本覆盖生产 | 检查 Sites 部署状态和 Worker 错误日志，必要时立即回滚 |
| P2 | 详情 404、Sitemap 数量异常、RSS/搜索缺内容 | 比较构建日期、公开内容索引和最近提交，暂停继续发布 |
| P3 | 样式、元数据、单个链接或内容错误 | 建立修复轮次，走完整检查后正常发布 |

每次发布后查看部署结果；出现异常时读取最近 Worker 错误日志，但不得把请求身份、访问 Token 或其他敏感字段复制到公开归档。没有定时监控服务时，至少在每次内容发布后执行完整冒烟验收。

## 5. 回滚

1. 在 Sites 版本列表中选择最近一个已通过在线验收的已保存版本。
2. 将该版本重新部署到同一生产地址；不使用 `git reset --hard`，也不删除失败提交。
3. 轮询到部署成功，并至少验证首页、一个详情、Sitemap、RSS 和随机 404。
4. 新建故障修复分支或后续提交，记录原因、影响、回滚版本证据和防复发测试。
5. 修复通过完整质量门后再发布新版本。

回滚恢复的是运行版本；Git 历史继续保留事故提交，便于复盘和修复。当前无 D1/R2，因此不涉及数据库向前兼容或数据迁移回滚。

## 6. 公开访问与自定义域名

当前生产部署是所有者私有站点。公开上线需要单独完成：

1. 用户明确批准访问策略改为 `public`；
2. 更新 Sites 访问策略并对开放世界部署再次确认；
3. 用未登录会话验证首页、详情、搜索、RSS、Sitemap 与分享元数据；
4. 如绑定域名，按 Sites 返回的 DNS 验证记录配置 CNAME/A/验证记录，等待 HTTPS 生效；
5. 设置明确的生产站点地址，重新检查 canonical、Open Graph、RSS 和 Sitemap 的绝对 URL；
6. 完成桌面、窄屏、键盘焦点和深色偏好的真实浏览器验收。

公开前不要加入邮箱、统计、评论或持久化能力。先观察真实发布频率与访问需求，再为明确问题增加运行时复杂度。
