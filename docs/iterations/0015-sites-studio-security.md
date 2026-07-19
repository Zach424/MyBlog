# Iteration 0015：Sites 生产 Studio 安全闭环

## 1. 范围与成功标准

本轮目标是把 Iteration 0014 的最新工程版本发布到现有公开 Sites 保底站，并修复真实公网验收发现的 Studio 静态响应头缺失。成功标准是 Sites 保存版本对应精确提交，23/23 公开路由通过生产冒烟，`/studio` 不再存在可被资产层抢先返回的静态副本，并始终由 Worker 附加 `no-store`、专用 CSP 与 OAuth popup 策略。

## 2. 项目结构状态

Studio 的 `index.html`、`config.mjs` 与 `preview.css` 从 `public/studio` 移到根目录 `studio/`，作为构建源而不是公开静态资源。Worker 用 Vite `?raw` 导入三份文件并服务稳定的 `/studio` URL。新增 `scripts/clean-build.mjs`，每次构建前只清理经过路径守卫的项目 `dist`；测试覆盖源码位置、Worker bundle 内容和部署产物不存在 Studio 静态目录。

## 3. 设计内容

安全边界改为结构保证，而不是依赖不同托管表面对 `run_worker_first` 或 `_headers` 的实现一致性：只要部署产物没有 `/studio` 静态文件，平台就无法绕过 Worker。公开阅读页继续使用原有缓存；发布后台 HTML、配置和预览样式全部由同一 Worker 路径设置专用安全头。

## 4. 使用的技术

- Vite raw imports，把 HTML、ES module 与 CSS 作为 Worker 字符串模块打包；
- Cloudflare Worker 路由与显式 Content-Type；
- 固定路径守卫的 Node.js `rmSync` 构建清理；
- Sites 保存版本与公开生产部署；
- Node.js 生产冒烟、Worker 集成测试和构建产物审计；
- Git 精确提交和 Sites 专用源仓库。

## 5. 实现的功能

1. `/studio`、`/studio/`、`/studio/config.mjs` 与 `/studio/preview.css` 由 Worker 内存响应；
2. 其他 `/studio/*` 路径由 Worker 返回 404/no-store，不形成任意内部资产代理；
3. Studio 所有正常响应统一获得专用 CSP、COOP、HSTS、权限、来源、类型和防嵌入响应头；
4. `npm run build` 首先安全清理固定的根 `dist`，阻止已删除公共资源残留；
5. 质量审计要求 `dist/client/studio` 与 `_studio` 不存在，同时要求 Worker bundle 包含锁定 CMS 和 Studio 标识；
6. 生产冒烟继续作为部署后的最终判定，不因 Sites 报告“部署成功”而跳过 HTTP 验收。

## 6. 实现方法

第 7 个 Sites 版本部署了提交 `641758e`。平台报告成功，但 `/studio/` 由静态层返回默认公共缓存。第一次修复用 Cloudflare 官方支持的 `public/_headers` 覆盖静态 Studio；第 8 个 Sites 版本也报告部署成功，但该托管表面仍忽略该文件，生产冒烟再次失败。

最终方案取消公开 Studio 资产：三份源文件移出 `public`，Worker 通过 `?raw` 编译进 ESM bundle，并按白名单路径返回正确类型。构建测试随后发现 Vinext 不会自动删除旧 `dist`，因此旧 `dist/client/studio` 仍可能混入包；`clean-build.mjs` 对解析后的固定 `<project>/dist` 做父目录和名称双重守卫后删除，再启动 Vinext 构建。

## 7. 验证证据

- Sites 第 7、8 个版本均部署成功，但生产冒烟分别证明 Worker-first 与 `_headers` 在该托管表面不足以保护静态 Studio；两次均保留为实现取舍证据；
- 最终结构通过 ESLint、TypeScript 和 28/28 单元测试；新增测试覆盖 raw bundle 路由、清理脚本路径守卫和构建命令；
- 8/8 Worker 集成测试与 7/7 发布质量审计通过；构建产物确认没有 `dist/client/studio` 或 `_studio`，Worker bundle 包含 `decap-cms-app@3.14.1` 与 Studio 标识；
- Wrangler 本地真实运行时生产冒烟通过：23/23 Sitemap 路由为 200，Studio 200/no-store，未配置 secrets 的 OAuth 为 503，未知路由 404/no-store；
- 生产依赖审计为 0 个已知漏洞；Wrangler 干跑读取 28 个静态文件，总上传 `2645.50 KiB`、gzip `631.55 KiB`；
- 提交 `045b8b6` 保存为 Sites 第 9 个版本并成功公开部署；增强后的公网冒烟验证 23/23 Sitemap 路由、Studio HTML/配置/预览样式、专用 CSP、`no-store`、OAuth popup 策略、未知 Studio 子资源 404/no-store、OAuth 安全关闭 503、RSS、robots 与随机 404 全部通过。

## 8. 经验与教训

平台显示部署成功只证明产物发布完成，不证明请求按本地 Wrangler 的资产路由顺序执行。安全策略必须用真实生产响应头验收。

配置兜底仍会受平台实现差异影响；从部署产物中消除冲突资产，才能把“必须经过 Worker”变成结构事实。

删除源文件不等于删除构建产物。构建必须从干净输出目录开始，否则历史静态文件会绕过新代码并造成难以解释的线上行为。

## 9. 全局状态、风险与未解决问题

现有 Sites 第 9 个版本已通过完整公网冒烟，公开阅读和未配置 OAuth 的 Studio 安全边界可作为稳定保底。Cloudflare 所有者 OAuth、GitHub secrets、真实 Studio 登录和 Obsidian 端到端发布仍未完成。GitHub 当前网络请求返回 403，本地提交和 Sites 专用源推送不受影响，但恢复前不能宣称 GitHub main 已同步。

## 10. 下一轮唯一主任务

恢复 GitHub 同步，完成所有者 Cloudflare 授权与 secrets，并用 Studio 和 Obsidian 各完成一次真实发布。
