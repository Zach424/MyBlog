# Iteration 0015：Sites 生产 Studio 安全兜底

## 1. 范围与成功标准

本轮目标是把 Iteration 0014 的最新工程版本发布到现有公开 Sites 保底站，并修复真实公网验收发现的 Studio 静态响应头缺失。成功标准是 Sites 保存版本对应 GitHub 精确提交，23/23 公开路由通过生产冒烟，`/studio` 在静态层直接响应时仍具有 `no-store`、专用 CSP 与 OAuth popup 策略。

## 2. 项目结构状态

新增 `public/_headers`，由 Vite 复制到 `dist/client/_headers`。发布配置检查、部署工具单元测试和构建后质量审计同时加入静态 Studio 响应头契约。其余内容、Worker 路由、Studio CMS 和 Obsidian 发布结构不变。

## 3. 设计内容

Worker-first 仍是所有者 Cloudflare Worker 的主要安全路径；`_headers` 是静态平台或中间托管层选择资产优先时的等价兜底。两条路径保持相同的 Studio 安全策略，而公开阅读页不被迫使用后台的 `no-store`，避免牺牲正常页面的边缘缓存。

## 4. 使用的技术

- Cloudflare Workers Static Assets `_headers` 规则；
- Vinext/Vite `public` 静态资源复制；
- Sites 保存版本与公开生产部署；
- Node.js 生产冒烟与构建后质量审计；
- Git 精确提交和 Sites 专用源仓库。

## 5. 实现的功能

1. `/studio` 与 `/studio/*` 静态响应强制 `Cache-Control: no-store`；
2. 静态 Studio 获得与 Worker 相同的 CSP、COOP、HSTS、权限、来源、类型和防嵌入响应头；
3. 发布配置门检查 `_headers` 存在及关键策略；
4. 单元测试检查源规则，质量审计检查构建产物实际携带规则；
5. 生产冒烟继续作为部署后的最终判定，不因 Sites 报告“部署成功”而跳过 HTTP 验收。

## 6. 实现方法

第 7 个 Sites 版本保存并部署了提交 `641758e`。平台报告部署成功，但生产冒烟在 `/studio` 失败：最终静态 HTML 返回 `Cache-Control: public, max-age=0, must-revalidate`，证明 Sites 没有按 Wrangler 本地环境的 `run_worker_first` 顺序处理该资源。

修复在 `public/_headers` 同时匹配 `/studio` 与 `/studio/*`。Cloudflare 对 `/studio` 先做 307 目录规范化，因此最终 `/studio/` 由 splat 规则覆盖。Worker 路径仍由 `worker/index.ts` 自己附加响应头，因为平台只把 `_headers` 应用于静态资产响应。

## 7. 验证证据

- 第 7 个 Sites 版本部署成功但生产冒烟明确失败于 `Studio 必须 no-store`；`curl` 证据为 `/studio` 307 到 `/studio/`，最终 200、`CF-Cache-Status: HIT` 和默认公共缓存；
- 修复后 ESLint、TypeScript、28/28 单元测试、8/8 Worker 集成测试与 7/7 质量审计通过；新增审计确认 `dist/client/_headers` 存在并包含静态 Studio 安全策略；
- 生产依赖审计为 0 个已知漏洞；Wrangler 干跑总上传 `2633.66 KiB`、gzip `627.21 KiB`；
- 修复提交的新 Sites 版本、23 路由公网冒烟与响应头证据将在同一轮部署完成后补记。

## 8. 经验与教训

平台显示部署成功只证明产物发布完成，不证明请求一定按本地 Wrangler 的资产路由顺序执行。安全策略必须用真实生产响应头验收。

同一 Cloudflare 生态内的托管表面也可能有不同的资产优先行为。对敏感静态入口同时提供 Worker 响应头与 `_headers` 兜底，比假设所有平台完全复用 Wrangler 配置更可靠。

## 9. 全局状态、风险与未解决问题

现有 Sites 站点已更新到 Iteration 0014 功能，但第 7 个版本的 Studio 静态缓存策略未达标；在修复版完成公网冒烟前不能作为发布后台验收通过。Cloudflare 所有者 OAuth、GitHub secrets、真实 Studio 登录和 Obsidian 端到端发布仍未完成。

## 10. 下一轮唯一主任务

发布本轮精确提交到 Sites 并完成 23 路由与 Studio 响应头公网复测；随后回到所有者 Cloudflare 授权和双入口真实发布。
