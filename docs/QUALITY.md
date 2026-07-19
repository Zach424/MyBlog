# 质量标准

## 完整质量门

```bash
npm run check
```

顺序为 ESLint → 28 项内容/搜索/OAuth/Studio/Obsidian/交付单元测试 → TypeScript → 原生 Next.js 生产构建 → 15 项真实生产 HTTP 与质量审计。任何一步失败都阻止合并和生产部署。

发布候选额外执行：

```bash
npm run release:check
```

它会校验 Vercel 冒烟/回滚配置并执行 production-only `npm audit`。不使用会强制改变主版本的 `npm audit fix --force`。

## 生产冒烟

```bash
npm run production:smoke -- https://example.vercel.app --expect-oauth
```

检查代表内容、搜索、Studio/OAuth、RSS、robots、全 Sitemap、安全头、缓存与随机 404。`--expect-oauth` 只用于已配置 GitHub OAuth 的生产环境；本地和 Preview 允许 OAuth 以 503 安全关闭。

## 内容质量

- frontmatter 必须通过严格 Zod schema，未知字段报错；
- 文件名/slug 为稳定小写 ASCII，不能与 URL 漂移；
- 标签来自注册表，专题顺序连续；
- 草稿和未来内容不会进入任何公开索引；
- 内容可见日期在 `Asia/Shanghai` 构建期冻结；
- Markdown 标题锚点、目录、GFM 和代码高亮保持一致。

## HTML 与可访问性

- 每页一个 `<main>` 和 `<h1>`，`lang=zh-CN`；
- 页面具有 description、canonical、跳转主内容链接和唯一 id；
- 所有可见内部导航目标返回成功；
- 文本设计 Token 达到 WCAG AA；
- 320px 不允许根布局强制最小宽度或横向溢出；
- 焦点可见、Reduced Motion 和系统深色偏好保留。

## 体积预算

| 资产 | 预算 |
| --- | --- |
| `.next/static` 客户端总量 | `< 3 MB` |
| 最大客户端 JavaScript | `< 300 KB` |
| 全局 CSS | `< 100 KB` |
| 单页服务端 HTML | `< 100 KB` |

预算用于捕获意外回归，不代替真实网络与 Web Vitals。生产上线后应以 Vercel Analytics/日志或独立测量补充。

## 安全基线

全站必须有 CSP、HSTS、`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、Referrer Policy、Permissions Policy 和 COOP，并且不能暴露 `X-Powered-By`。

Studio 与 OAuth 必须：

- `Cache-Control` 包含 `no-store`；
- `X-Robots-Tag: noindex, nofollow`；
- `Cross-Origin-Opener-Policy: same-origin-allow-popups`；
- CSP 只额外允许锁定 Decap CDN、GitHub API/授权/头像；
- 未配置 secret 返回 503，非法 provider/site/state 返回 4xx；
- OAuth state HMAC 签名、绑定 origin、十分钟失效。

当前 Next.js 流式启动脚本和现有样式需要 `script-src/style-src 'unsafe-inline'`；这是已知残余风险。框架支持稳定 nonce 方案后继续收紧。

## 发布门槛

只有以下证据同时成立才可切换生产入口：本地 `release:check` 通过、GitHub Quality Gate 通过、Vercel Production 成功、带 OAuth 的全路由冒烟通过、未登录真实浏览器通过、Studio 和 Obsidian 各完成一次真实发布。
