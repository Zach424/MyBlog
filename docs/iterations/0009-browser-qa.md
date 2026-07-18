# Iteration 0009：真实浏览器与窄屏验收

## 1. 范围与成功标准

本轮唯一目标是在不扩大 Sites 访问范围的前提下，用真实 Chromium 补齐桌面、手机窄屏、深色偏好、Reduced Motion、搜索、目录锚点与键盘焦点验收。成功标准是关键页面没有控制台错误和页面级横向滚动，交互状态可辨识；发现的问题必须修复、写入自动回归并同步私有生产版本。

## 2. 项目结构状态

现有 App Router、Markdown 内容仓库、搜索、发现端点与 Worker 架构不变。`app/globals.css` 删除根 `html`/`body` 的固定最小宽度；`tests/quality-gates.test.mjs` 新增第 6 项发布审计。`output/playwright` 保存本轮桌面、手机、深色和修复前后截图，`.playwright-cli` 临时会话目录被 Git 忽略。

## 3. 设计内容

Commit Trace、Evidence Rail、颜色 Token 与排版方向保持不变。本轮只修正响应式边界：根布局必须服从真实可布局宽度，页面留白继续由 `.page-shell` 的流式计算控制。首页 Evidence Rail 更新为“真实浏览器与窄屏验收”，不会把仍未授权的公开访问写成已完成。

## 4. 使用的技术

- Playwright CLI 驱动 headed Chromium；
- 真实 viewport：`1440 × 1000`、`390 × 844`、`320 × 568`；
- `page.emulateMedia` 检查深色与 `prefers-reduced-motion: reduce`；
- DOM `scrollWidth` / `clientWidth` 定位页面级溢出；
- 可访问性快照、键盘 `Tab` / `Enter`、`:focus-visible` 计算样式；
- Node test 静态审计根 CSS 规则。

## 5. 实现的功能

1. 320px 首页、文章和搜索页不再出现页面级横向滚动。
2. 根布局不锁定 `20rem`，仍保留响应式留白和全部信息层级。
3. 质量审计阻止 `html` 或 `body` 再次加入固定 `min-width`。
4. 首页工程状态更新为 REV.009，并展示真实浏览器验收证据。
5. Git 忽略 Playwright 的临时会话文件，保留可复核截图。

## 6. 实现方法

先在 1440px 浅色首页确认布局、语义快照、控制台和水平边界，再在 390px 浅色/深色首页、深色文章页验证折行、目录、代码块、搜索与 Reduced Motion。键盘从跳到主要内容开始，首个 Tab 显示固定跳转链接和 2px 信号色轮廓；Enter 跳转到 `#main-content`，下一次 Tab 进入主要动作。

继续把 viewport 收窄到 320px 时，文章页出现横向滚动条。元素边界检查只看到 `html`、`body` 和顶部装饰条占用 320px；此时根 `clientWidth` 因桌面垂直滚动条只有 305px。根因不是文章代码块，而是 `html`/`body` 的 `min-width: 20rem`。删除两条规则后，320px 首页、文章和搜索页均得到 `scrollWidth = clientWidth = 305`，导航、标题、标签和搜索布局仍保持可读。

## 7. 验证证据

- 1440px 首页无横向溢出，`scrollWidth = innerWidth = 1440`；
- 390px 首页和文章在浅色/深色下正常折行，页面无横向溢出；
- 320px 修复前：`scrollWidth = 320`、`clientWidth = 305`，出现 15px 横向滚动；
- 320px 修复后：首页、文章、搜索均为 `scrollWidth = clientWidth = 305`；
- 深色计算值为背景 `rgb(16, 24, 32)`、文字 `rgb(237, 244, 245)`，Reduced Motion 媒体查询为 `true`；
- 跳转链接获得焦点时位于视口内，轮廓为 `rgb(185, 67, 31) solid 2px`；
- 搜索输入 `Cloudflare` 后 URL 同步为 `?q=Cloudflare`，4 条索引匹配 2 条，清除后恢复 4 条；
- 文章目录锚点更新 URL hash，相邻文章导航成功；
- 整个浏览器会话控制台为 0 Errors、0 Warnings。
- 完整质量门通过 13 项单元测试、7 项 Worker 集成测试和 6 项发布审计；生产依赖审计为 0 个已知漏洞；
- Wrangler 干跑读取 28 个静态资源，总上传 `2625.52 KiB`、gzip `624.86 KiB`，无 D1/R2 绑定。

关键截图：

- [1440px 首页](../../output/playwright/home-desktop.png)
- [390px 浅色首页](../../output/playwright/home-mobile.png)
- [390px 深色首页](../../output/playwright/home-mobile-dark.png)
- [深色文章完整页](../../output/playwright/article-mobile-dark.png)
- [320px 修复前](../../output/playwright/article-320-dark.png)
- [320px 修复后](../../output/playwright/article-320-dark-fixed.png)
- [320px 搜索页修复后](../../output/playwright/search-320-dark-fixed.png)

## 8. 经验与教训

CSS 媒体查询生效不等于窄屏没有溢出。`min-width: 20rem` 在移动设备的覆盖式滚动条环境里看似安全，但桌面真实滚动条会占用布局宽度，使相同 320px viewport 只剩 305px client width。验收应比较滚动宽度与 client width，而不是只看设计稿或 `innerWidth`。

截图能发现视觉症状，DOM 几何证据才能定位责任层。先列出越过 client width 的元素，排除了 Markdown、代码块和时间线，再收敛到根布局，避免用 `overflow-x: hidden` 掩盖问题。

键盘可访问性也需要真实操作链证明。存在 skip link 和 CSS 规则只是静态条件；Tab 后可见、Enter 后 hash 正确、下一焦点进入主要内容，才说明路径完整。

## 9. 全局状态、风险与未解决问题

私有生产功能、在线 HTTP 验收和 Chromium 真实浏览器验收已完成。公开发布阶段从 `pending` 进入 `partial`，但访问策略仍为仅所有者，不能把当前链接描述为公众可访问。

剩余风险：公开访问与自定义域名需要用户明确授权；未登录生产会话尚无法执行；Safari、Firefox、macOS 字体折行和真实触控仍待公开后回归；CSP 的 `unsafe-inline` 残余风险不变。

## 10. 下一轮唯一主任务

获得用户明确授权后，把 Sites 访问策略切换为公开，发布同一已验证版本，并用未登录会话完成生产首页、详情、搜索、RSS、Sitemap、分享元数据和窄屏回归；如用户提供域名，再进入 DNS 与 canonical 切换。
