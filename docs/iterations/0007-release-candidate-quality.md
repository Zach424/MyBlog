# Iteration 0007：上线候选质量基线

## 1. 范围与成功标准

本轮唯一目标是把已经具备核心阅读、搜索和发布发现能力的博客变成可部署的发布候选。成功标准是：生产响应头与缓存策略明确；HTML 语义、内部链接、可访问性颜色、构建产物和依赖安全都有自动门槛；Cloudflare 部署干跑成功；结构化数据与站点图标补齐；本轮全部证据归档。

不把生产部署写成本轮完成项。真实 Cloudflare URL、在线响应和回滚手册属于下一轮。

## 2. 项目结构状态

本轮新增或改变的关键结构：

```text
.env.example                         可选公开站点地址示例
app/icon.png                         256 × 256 Commit Trace 站点图标
app/layout.tsx                       作者、创建者与图标元数据入口
app/posts/[slug]/page.tsx            BlogPosting JSON-LD
app/projects/[slug]/page.tsx         SoftwareSourceCode JSON-LD
components/StructuredData.tsx        安全 JSON-LD 输出组件
worker/index.ts                      安全头与 HTML 边缘缓存
tests/rendered-html.test.mjs         图标、结构化数据与响应集成断言
tests/quality-gates.test.mjs         发布质量审计
docs/QUALITY.md                      长期质量、安全和缓存基线
docs/iterations/0007-*.md            本轮证据与经验
```

仓库当前有 22 个 Markdown 内容或文档文件：3 篇文章、1 个项目复盘、18 个项目档案（含根 README）。数据库、认证、R2 和第三方搜索仍不在首版范围。

## 3. 设计内容

保留“工程轨迹 + Evidence Rail”作为唯一视觉签名，没有新增通用卡片或第二套品牌语言。首页更新为 `REV. 007`：Verified 显示 12 项单元、7 项 Worker 与 5 项审计证据；Building 指向 Cloudflare 生产发布；Learned 强调质量必须写成可重复门槛。

浅色 `muted`、`faint`、`signal`、`trace-dark` 从低对比版本调整为 `#566D77`、`#60737D`、`#B9431F`、`#486F78`。浅色与深色文本角色现在都自动验证至少 `4.5:1`。

站点图标沿用 OG 分享卡的冷调纸面、深蓝节点、青色轨迹与烧橙信号色，只表现单个 Commit Trace 节点，不使用文字或另一套标志。生成提示词要点为：“正方形极简个人技术博客 favicon，以参考图的 Commit Trace 为风格，冷白纸面、深海军蓝节点、青色轨迹环、烧橙半环，无文字、无渐变、无阴影、无水印、适合 32px 识别”。生成源图为 `1254 × 1254`，随后确定性缩放为 `app/icon.png` 的 `256 × 256`、`43,153 bytes`。

## 4. 使用的技术

- Next.js `16.2.10`、React 19、TypeScript 5；
- Vinext `0.0.50`、Vite 8 与 Cloudflare Worker；
- Node 原生 test runner，用真实构建 Worker 执行 HTTP 级审计；
- JSON-LD / Schema.org 的 `BlogPosting` 与 `SoftwareSourceCode`；
- CSS Token、WCAG 相对亮度与对比度公式；
- Wrangler 部署干跑；
- Imagegen 生成候选位图，System.Drawing 确定性缩放，尺寸测试防止资产回退；
- npm 生产依赖审计与 package overrides。

## 5. 实现的功能

1. Worker 统一输出 CSP、HSTS、COOP、Permissions Policy、Referrer Policy、nosniff、点击劫持防护，并移除技术暴露头。
2. HTML 使用浏览器零缓存、边缘一小时缓存和一天 stale-while-revalidate。
3. 关键 HTML 路由验证唯一主区域、唯一主标题、中文语言、描述、绝对 canonical、跳转链接、唯一 ID 和 HTML 体积。
4. 自动收集集合页可见的站内链接并逐个验证小于 400 的响应状态。
5. 对客户端、服务端、最大客户端 JS、Worker 与全局 CSS 建立体积预算。
6. 浅色和深色所有文本 Token 自动验证 WCAG AA。
7. 文章和项目详情发布结构化数据；站点补充作者、创建者与 favicon。
8. Next.js 补丁版升级，内部 PostCSS 最小覆盖到已修复版本，生产依赖审计清零。

## 6. 实现方法

质量审计直接导入 `dist/server/index.js` 并构造 Cloudflare 风格请求与代理头，避免只断言源代码字符串。HTML 先截断到 `</html>`，排除 RSC 传输内容对可见文档统计的干扰。内部链接从真实服务端 HTML 提取、归一化到同源 URL，再逐一调用 Worker。

产物预算递归读取 `dist/client` 与 `dist/server`；颜色审计从 `globals.css` 解析浅色和深色 Token，并按 WCAG sRGB 线性化公式计算对比度。结构化数据在 JSON 序列化后转义 `<`，既保持服务端渲染又避免内容结束脚本标签。

依赖风险采用“公告定位 → 查询最新官方包元数据 → 最小版本调整 → 锁文件更新 → 全量构建验证”的方法处理。没有接受 `npm audit fix --force` 建议的 Next.js 大幅降级。

## 7. 验证证据

`npm run check` 零失败：

- ESLint：通过；
- 单元测试：12/12 通过；
- TypeScript：通过；
- Vinext 生产构建：701 个客户端分析模块、783 个 RSC 模块，完成 14 类路由构建；
- Worker 集成测试：7/7 通过；
- 发布质量审计：5/5 通过，包括安全/缓存、HTML 语义、全部可见内部链接、产物预算和颜色对比度。

`npm audit --omit=dev --audit-level=high --json`：生产依赖 134 个，已知漏洞 0。

`wrangler deploy --dry-run`：8 个 Worker 模块、28 个静态资源；总上传 `2624.11 KiB`，gzip `624.19 KiB`，无 D1/R2 等绑定，干跑成功。

站点图标集成测试确认 PNG 为 `256 × 256` 且小于 `100 KB`；文章与项目 Worker HTML 分别包含正确类型的 JSON-LD 和绝对主实体 URL。

根据 Sites 开发工作流，本轮未擅自使用浏览器截图、DOM 操作或设备模拟。真实字体折行、窄屏布局、焦点顺序与触控体验仍需在生产部署后的浏览器验收中完成，不能被上述自动测试冒充。

## 8. 经验与教训

第一次缓存审计失败揭示框架给 HTML 返回了 `no-store`。缓存策略必须在最终 Worker 响应上验证，不能从源代码或预期推断。显式覆盖后，浏览器不持久缓存、边缘可短期缓存的意图才真正落地。

第一次完整 lint 在 Wrangler 干跑之后扫描了 `.wrangler/dry-run`，出现 951 条生成代码问题。部署产物与源码检查边界必须写入脚本，否则“做了更多验证”反而制造无效噪声。

浅色设计中 `faint`、`signal` 和 `trace-dark` 原值只有约 `2.32–3.39:1`，肉眼觉得“有层级”不代表可读。把 Token 角色纳入公式测试后，视觉取舍变成可重复约束。

缺少 favicon 不会阻止构建，却会让浏览器产生常见 404 并削弱小尺寸识别。生成位图必须再经过确定性尺寸、文件体积和视觉检查，不能直接把生成源图放进应用。

`npm audit fix --force` 建议把 Next.js 改到不合适的旧版本。依赖安全不能把“审计清零”置于框架正确性之上；最小覆盖必须和完整构建、运行时测试一起成立。

当前 CSP 为适配 Vinext 保留了 `unsafe-inline`，所以“有 CSP”不等于“最严格 CSP”。残余风险必须被记录并在框架支持 nonce 后继续收紧。

归档后首页状态从 REV.006 更新到 REV.007，最终全量门禁因此发现一条仍检查旧 Evidence Rail 文案的集成断言。证据文案本身也是接口：状态推进时，页面与对应测试必须在同一轮同步更新。

## 9. 全局状态、风险与未解决问题

阶段 1–5 的工程、内容、核心功能、发布发现与自动发布候选质量门已经完成。项目已经是可部署候选，但尚未生产上线，项目内容状态继续保持 `building`。

剩余风险：真实 Cloudflare 可能调整缓存头；动态主机元数据仍让 Vinext 把部分路由分类为 Unknown；系统字体跨平台折行和真实键盘/触控体验尚未浏览器复核；CSP 仍含 `unsafe-inline`；最终自定义域名、公开邮箱和其他联系方式未确定。

## 10. 下一轮唯一主任务

将当前发布候选部署到 Cloudflare，记录平台 URL，在线验证关键路由、发现端点、结构化数据、缓存与安全响应头，并建立监控、回滚和内容维护手册。
