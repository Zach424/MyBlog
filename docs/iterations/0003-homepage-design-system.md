# Iteration 0003：正式首页与设计系统

- 日期：2026-07-18
- 状态：完成

## 1. 范围与成功标准

本轮只完成推荐的首页视觉组合、共享根布局和发布元数据，不实现 Markdown 内容管线或详情路由。

成功标准：正式首页替换 starter；选定设计可以在桌面和手机宽度成立；浅色/深色、键盘焦点和减少动画有明确规则；社交卡片接入；lint、Cloudflare 目标构建与 Worker HTML 测试通过；变更归档、提交并推送。

## 2. 项目结构状态

```text
app/
  globals.css             设计 Token、响应式、深色和减少动画
  layout.tsx              根布局、Viewport、Open Graph 与 X 元数据
  page.tsx                正式首页和真实工程状态
public/
  og.png                  1200 × 630 社交分享卡
tests/
  rendered-html.test.mjs  构建产物与设计契约测试
docs/
  DESIGN.md               已冻结设计系统
  ARCHITECTURE.md         当前实现结构
  ROADMAP.md              全局阶段状态
  iterations/0003-homepage-design-system.md
```

删除了 `app/_sites-preview`、starter SVG 和 `react-loading-skeleton`。`package.json` 与 lockfile 已同步清理。

## 3. 设计内容

用户采用推荐组合：A“工程轨迹”为主要视觉语言，C“Evidence Rail”为次级功能区。首页主句是“把写过的代码，变成可复用的判断。”

设计以冷调瓷蓝画布、蓝黑主墨色、橙色 Signal 和青色轨迹线组成。Commit Trace 连接三条真实开发记录，并从最近记录分支到 MyBlog 项目；Evidence Rail 只展示 Verified、Building、Learned 三种可解释状态。完整 Token、排版、断点和排除项见 [DESIGN.md](../DESIGN.md)。

OG 卡片复用了相同的标题、轨迹和证据语言，最终文件为 `public/og.png`，没有使用第二套视觉主题。

## 4. 使用的技术

- React 19 服务端组件和 Next.js 兼容 App Router；
- Vinext + Vite 8 生成 Cloudflare Worker-compatible output；
- TypeScript 常量数据和语义化 JSX；
- Tailwind CSS 4 入口 + 原生 CSS 自定义属性；
- Next Metadata / Viewport API 与 `next/headers`；
- Node test 验证构建后 Worker HTML 和 PNG 尺寸；
- 内置 imagegen 生成项目专用社交图，再在本地规范化为 `1200 × 630`。

## 5. 实现的功能

- 中文根布局、站点标题、摘要、canonical、Open Graph 和 X 分享信息；
- 动态读取转发主机与协议，生成部署域名对应的绝对分享 URL；
- 首页 Hero、当前关注、Evidence Rail、最近记录、项目分支、主题索引和页脚；
- 真实 GitHub 仓库入口和不会产生 404 的同页导航；
- 自动浅色/深色模式、清晰键盘焦点、跳过链接和减少动画适配；
- 1200 × 630 OG 社交卡片；
- starter 骨架、预览标记、无关 SVG 和加载依赖清理。

## 6. 实现方法

先把三个候选中共享的内容固定，再只保留一个主要视觉风险：Commit Trace。Evidence Rail 被约束为状态证据，不参与装饰竞争。页面使用服务端静态 JSX 和 CSS，当前不增加客户端状态或组件抽象；内容管线尚未实现时，首页数据集中在只读常量中，便于下一轮替换为构建期内容读取。

元数据优先使用 `NEXT_PUBLIC_SITE_URL`；没有显式配置时读取 `x-forwarded-host`、`host` 和 `x-forwarded-proto`，测试环境缺失主机时回退到 `http://localhost:3000`。

## 7. 验证证据

- `npm run lint`：通过，无 ESLint 错误；
- `npm run build`：通过，五个 Vinext 构建阶段全部完成；
- `npm test`：通过，2/2 个 Worker HTML 与设计契约测试通过；
- `git diff --check`：通过，无空白错误；
- OG 文件检查：PNG 为 `1200 × 630`，标题和 VERIFIED / BUILDING / LEARNED 均清晰可读。

首次测试曾把 canonical 固定预期为 `http://localhost/`，但 Worker 测试夹具不传递 URL 的 Host 给 `headers()`，实际走了 localhost:3000 回退。修复方式是在夹具中显式传入 Cloudflare 常见的 `x-forwarded-host` 和 `x-forwarded-proto`，从而验证生产所需的动态绝对 URL，而不是修改正确的产品逻辑。

## 8. 经验与教训

- 视觉组合应明确主次；把 Evidence Rail 定义为证据组件后，页面不会同时出现两套装饰语言；
- 状态文案必须来自项目真实进度，虚构实时数据会削弱工程日志的可信度；
- 本地系统字体栈比首轮引入远程字体更稳健，尤其适合需要兼顾中文覆盖和大陆网络的站点；
- 动态元数据测试要模拟代理头，单独构造 Request URL 不等于运行时一定暴露 Host；
- 删除 starter 时要同时清理组件、样式、依赖、元数据、测试和静态资源，避免残留成为长期负担。

## 9. 全局状态、风险与未解决问题

- 工程与归档基线：done；
- 内容契约：done，尚待代码实现；
- 设计系统：done；
- 正式首页：done；
- 内容详情与索引页面：pending；
- 发布与部署：partial，基础 SEO/OG 完成，Cloudflare 尚未上线。

风险：Vinext 因 `headers()` 将首页标记为 `Unknown` 路由，但构建与 Worker 渲染通过；需要在真实预览部署继续验证。作者简介、联系方式、域名和最终首批内容仍未确定。

## 10. 下一轮唯一主任务

实现构建期 Markdown 内容管线：解析并校验 `content/posts` 与 `content/projects`，生成稳定 slug、排序结果和派生的专题/标签索引，然后让首页数据改由该管线提供。
