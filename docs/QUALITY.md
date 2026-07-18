# 发布质量基线

此文档定义博客从“本地可运行”进入“可以部署”的可重复门槛。轮次归档保存一次执行的证据，这里保存长期不变的规则。

## 一键质量门

```bash
npm run check
```

执行顺序为：ESLint → 内容、搜索与发现单元测试 → TypeScript → Vinext 生产构建 → Worker 渲染集成测试 → 发布质量审计。内容测试会验证 `Asia/Shanghai` 日期边界，生产构建把日期冻结后再生成公开索引。任何一步失败都阻止提交和部署。

生产依赖与 Cloudflare 上传包单独验证：

```bash
npm audit --omit=dev --audit-level=high
npx wrangler deploy --dry-run --config dist/server/wrangler.json --outdir .wrangler/dry-run
```

依赖审计不使用 `npm audit fix --force`。自动修复若要求主版本变化或框架降级，先定位传递依赖，再采用可构建、可测试的最小补丁或覆盖。

## HTML 与导航门槛

关键路由必须同时满足：

- HTTP 200、唯一 `<main>`、唯一 `<h1>`、`lang="zh-CN"`；
- 描述、绝对 canonical、跳到主要内容链接和无重复 ID；
- 单页服务端 HTML 小于 `100 KB`；
- 首页、集合页、搜索与关于页上所有可见站内链接返回小于 400 的状态码；
- 未知文章或项目进入真实 404。

文章必须输出 `BlogPosting` JSON-LD，项目必须输出 `SoftwareSourceCode` JSON-LD。JSON 序列化后将 `<` 转义，避免数据内容结束脚本标签。

## 可访问性与设计门槛

- 浅色、深色主题的 `ink`、`muted`、`faint`、`signal`、`trace-dark` 文本 Token 相对各自画布的对比度不低于 WCAG AA `4.5:1`；
- 页面保留键盘跳转入口、`:focus-visible` 轮廓和 `prefers-reduced-motion` 分支；
- 每页只有一个主要标题，目录锚点与正文 ID 使用同一稳定规则；
- 站点图标必须为 `256 × 256` PNG 且小于 `100 KB`，并通过根文档图标链接发布。

自动审计不能代替不同浏览器、操作系统和窄屏设备上的视觉复核。真实字体折行、焦点移动和触控体验在上线后的浏览器验收中记录。

## 产物预算

| 产物 | 门槛 |
| --- | ---: |
| 客户端文件总量 | `< 2 MB` |
| 服务端文件总量 | `< 5 MB` |
| 最大客户端 JavaScript | `< 250 KB` |
| Worker 入口 | `< 3 MB` |
| 全局 CSS | `< 100 KB` |

预算用于阻止意外增长，不等同于真实用户性能指标。上线后仍需根据 Cloudflare 分析和真实网络请求调整。

## 生产安全头

Worker 对页面、资源和发布端点统一设置：

- `Content-Security-Policy`：默认只允许同源，禁止对象、第三方框架和跨站表单；
- `Strict-Transport-Security`：HTTPS 下启用一年并包含子域；
- `X-Content-Type-Options: nosniff`；
- `X-Frame-Options: DENY` 与 `frame-ancestors 'none'`；
- `Referrer-Policy: strict-origin-when-cross-origin`；
- `Cross-Origin-Opener-Policy: same-origin`；
- `Permissions-Policy`：关闭摄像头、地理位置和麦克风；
- 删除 `X-Powered-By`。

为兼容 Vinext 当前的内联启动脚本与现有样式，CSP 暂时保留 `script-src 'unsafe-inline'` 和 `style-src 'unsafe-inline'`。这是明确的残余风险，不是最终理想状态；框架支持 nonce 后应继续收紧。

## 缓存策略

HTML 使用：

```text
public, max-age=0, s-maxage=3600, stale-while-revalidate=86400
```

浏览器每次复核最新文档，Cloudflare 边缘可缓存一小时并在一天内提供过期回源缓冲。RSS、Sitemap 与 robots 保留各自的公共缓存策略。发布后必须在线确认 Cloudflare 没有覆盖这些响应头。

只有成功 HTML 使用上述边缘缓存；404 与其他 HTML 错误显式使用 `no-store`，避免短暂路由故障被边缘缓存放大。

## 依赖基线

- Next.js 与 `eslint-config-next` 保持相同补丁版本；
- Next.js 内部 PostCSS 覆盖到 `8.5.10`，用于修复转义公告，同时以完整构建和 Worker 测试证明兼容；
- 锁文件与 `package.json` 同一提交；
- `.env.example` 只说明可选配置，不保存 Token、账号或部署凭证。

## 发布判定

满足以下条件才可进入 Cloudflare 部署：

1. `npm run check` 零失败；
2. 生产依赖审计为 0 个已知漏洞；
3. Wrangler 干跑成功且上传包位于平台和项目预算内；
4. 结构、设计、实现、证据、失败经验和下一步已经写入本轮归档；
5. 工作树只包含本轮范围内的预期修改。

部署成功不是业务验收成功。部署后还必须按 [OPERATIONS.md](./OPERATIONS.md) 检查真实正文、Sitemap URL 数量与逐路由状态、搜索、RSS、robots、结构化数据、安全头和 404 缓存；在线证据通过后，本轮才能标记为 `done`。
