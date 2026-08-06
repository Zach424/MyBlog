# Iteration 0085：规范链接分享轨迹

## 1. 范围与成功标准

本轮只为文章与项目详情页增加无需外部服务的读者分享能力：页面必须始终服务端输出可访问的规范链接；JavaScript 可用时优先调用系统分享，不支持或发生非取消错误时回退复制规范 URL；用户取消必须静默，真实失败不得伪报成功，并发点击不得产生重复请求。组件需要融入现有 Commit Trace / Evidence Rail 视觉，兼容 320px 窄屏、键盘、屏幕阅读器和无 JavaScript 阅读，同时不进入打印/PDF，不引入社交 SDK、短链、跟踪器、账号、数据库或云 API。

## 2. 项目结构状态

- `components/ShareTrace.tsx`：新增最小客户端岛，负责渐进增强、系统分享、复制回退、single-flight、状态回执与定时复位；
- `lib/share.ts`：新增与 UI 分离的确定性分享状态机，统一返回 `shared`、`copied`、`cancelled` 或 `failed`；
- `app/posts/[slug]/page.tsx`：服务端把文章标题、描述和绝对 canonical URL 传给分享岛；
- `app/projects/[slug]/page.tsx`：项目详情复用相同契约；
- `app/globals.css`：新增桌面、中宽、320px 窄屏、状态、焦点与打印边界；
- `tests/share-controls.test.mjs`：新增行为、渐进增强、无外部服务和页面接线测试；
- `tests/rendered-html.test.mjs`：验证文章与项目的 SSR 规范链接、初始禁用增强状态和隐藏动作；
- `package.json`：把分享契约加入完整单元测试入口；
- `README.md`：公开状态加入详情页规范链接分享；
- 内容 Markdown、Studio、Obsidian 插件、OAuth、Vercel 配置、workflow 与作者文件均未改变。

## 3. 设计内容

视觉继续使用现有 Commit Trace / Evidence Rail，而不是增加漂浮圆形社交按钮。详情头部下方新增一条 `SHARE TRACE / CANONICAL` 证据轨道：左侧说明记录类型，中间直接显示并链接到规范来源，右侧只在客户端接管后出现 `SHARE / COPY` 动作。样式只复用 `--signal`、`--ink`、`--trace`、显示字体和等宽字体；55rem 以下动作进入第二列，42rem 以下转为单列和全宽按钮。状态由可见文字和 `aria-live` 同时反馈，键盘焦点沿用全站 signal 色；打印时整条交互轨道隐藏，既有 `PrintSource` 继续提供纸面来源。

设计评审中拒绝了三种方案：固定悬浮按钮会破坏工程档案感并遮挡窄屏；每个平台单独按钮会引入品牌、跟踪和维护负担；只输出客户端按钮会让无 JavaScript 页面失去规范来源。最终结构把 canonical anchor 作为永远可用的恢复路径，把动作按钮限定为能力增强。

## 4. 使用的技术

- Next.js 16.3 Server/Client Component 边界：详情页仍在服务端生成绝对 URL，只有浏览器能力调用进入 `"use client"` 岛；
- React 19：`useState` 管理可见状态，`useRef` 管理同步 busy 锁、挂载状态、DOM 渐进增强和复位计时器；
- [W3C Web Share API](https://w3c.github.io/web-share/)：在安全上下文和用户激活中调用 `navigator.share({ title, text, url })`，把 `AbortError` 视为用户取消；
- [W3C Clipboard API](https://w3c.github.io/clipboard-apis/)：没有系统分享或非取消分享错误时调用 `navigator.clipboard.writeText(canonicalUrl)`；
- 原生 HTML/CSS：SSR `hidden` 动作、永远存在的 canonical anchor、`aria-describedby`、`aria-live="polite"`、`aria-atomic="true"`、禁用态、响应式 grid 与 print CSS；
- Node test 与真实 Next production server：纯函数行为夹具、源码结构契约和渲染 HTML 契约共同覆盖。

## 5. 实现的功能

1. 所有公开文章和项目详情页都显示可点击、可选择的绝对规范 URL；
2. 支持系统分享的浏览器会收到精确的标题、描述和规范 URL；
3. 没有系统分享时自动复制规范 URL；系统分享发生非取消错误后也会尝试复制；
4. 用户关闭系统分享面板时静默恢复初始状态，不复制、不显示失败；
5. 只有系统分享和剪贴板都失败时才显示明确失败，并引导使用旁边的永久链接；
6. 同步 busy 锁和按钮禁用阻止一次操作尚未结束时的第二次触发；
7. `WORKING`、`SHARED`、`COPIED`、`FAILED` 状态对视觉和辅助技术一致，3.2 秒后复位；
8. 无 JavaScript HTML 不显示不可工作的按钮，但保留完整规范链接；打印/PDF 保留 `PrintSource`，不打印交互轨道。

## 6. 实现方法

先冻结结果矩阵，再写失败测试：原生分享成功不得触碰剪贴板；无分享能力复制 URL；非取消错误回退复制；`AbortError` 静默；双能力失败才返回 `failed`。第一次定向执行为 0/2，分别因 `lib/share.ts` 和 `ShareTrace.tsx` 不存在而失败。随后实现无 DOM 的 `shareCanonicalRecord`，让浏览器适配层只负责提供能力和渲染结果；详情服务端组件传入同一份 canonical，避免客户端重新猜测 origin。

渐进增强采用与现有 CodeBlock 相同的“SSR 隐藏、挂载后移除 `hidden`”策略，并直接把 `data-share-enhanced` 改为 `true`，避免用额外 effect 状态制造一次无意义渲染。动作开始时先同步写入 `busyRef`，再更新 React 状态，因此快速连续事件也只能进入一次。挂载标记和计时器清理阻止卸载后的状态更新。打印样式只隐藏分享交互，不改正文语义或已有纸面来源。

## 7. 验证证据

- 失败优先：新增测试第一次 0/2，缺失模块和组件错误与范围一致；实现后定向测试 7/7；
- 静态门禁：`git diff --check`、ESLint、类型检查均通过；Next.js 16.3.0 构建 45/45 页面成功；
- 第一次应用测试 17/19：真实 SSR 已正确，但测试错误依赖 `<a>` 属性顺序；改成属性顺序无关的正向预查后 19/19；
- 完整 `npm run release:check`：384/384 单元测试、19/19 应用测试、45/45 页面构建、生产依赖审计 0；inbox 0、根暂存媒体 0、外链离线库存本地问题 0；
- 真实桌面浏览器 1280×900：分享轨道宽 1137px、高 108px，三列为 120 / 771.875 / 168px，横向溢出 0；动作按钮 168×44px；
- 真实系统分享：按钮进入 disabled `WORKING`，第二次语义点击被禁用态拒绝；按 Escape 取消后回到 idle，剪贴板哨兵不变，证明取消没有伪装成复制；
- 真实移动浏览器 390×844：单列轨道、规范 URL 自动换行、全宽按钮，无可见横向溢出；链接和按钮均显示 signal 色键盘焦点；
- 文章和项目详情各只有一个分享 region，规范 URL 精确；浏览器控制台 warning/error 为 0；
- 功能提交：`837689e2586bb1a7299755ba49a5cd887a2d38a7`；
- [Quality Gate #153](https://github.com/Zach424/MyBlog/actions/runs/31082890571) 成功；[Verify Vercel production #146](https://github.com/Zach424/MyBlog/actions/runs/31082942938) 成功；
- 稳定生产入口 `/`、`/posts/building-a-maintainable-blog`、`/projects/myblog`、`/studio` 均返回 HTTP 200，文章与项目生产 HTML 均包含正确 canonical 分享轨道。

## 8. 经验与教训

渲染测试不应依赖 React/Next 输出的 HTML 属性顺序；语义正确的实现第一次仍得到 17/19，改用每个开始标签内部的正向预查后才真正验证“同一个元素包含这些属性”。系统分享不能只靠 mock 宣称完成：真实浏览器验证了用户激活、操作中禁用和 Escape 取消路径，而剪贴板哨兵区分了“取消”与“回退复制”。

另一个经验是渐进增强的恢复路径必须先存在。canonical anchor 由服务器输出后，Web Share、Clipboard、JavaScript 乃至操作系统分享目标是否可用都只影响便利性，不影响读者取得来源。Web Share 同一时间只能有一个待处理请求，因此 UI 层的同步 busy 锁不仅改善体验，也与平台状态机保持一致。

## 9. 全局状态、风险与未解决问题

公开阅读链路现在包含正文、知识关系、打印来源和规范链接分享，且没有新增第三方运行时或生产依赖。系统分享目标由浏览器、操作系统和本机应用决定；某些桌面环境会直接进入复制回退，这属于能力差异而非站点错误。Clipboard 也要求安全上下文和浏览器许可，因此永远保留 canonical anchor，失败不隐藏来源。

全局复盘同时比较了三个候选：可安装 PWA 会为内容站引入图标、manifest 与离线更新承诺，但当前没有高频应用化需求；平台专属分享会增加品牌和跟踪边界；Markdown 引用复制可以直接服务 Obsidian、README、issue 和技术笔记，且只需扩展现有轨道。其余既有风险不变：真实 Obsidian 主题交互仍需首次使用观察；Decap 开发依赖树仍有上游无修复高危项但生产依赖审计为 0；不可变 Actions pin 需主动复核；自定义域名、统计、评论和公开邮箱仍等待所有者选择。

## 10. 下一轮唯一主任务

在现有分享轨道增加独立的“复制 Markdown 引用”动作，输出可直接粘贴到 Obsidian、README 或 issue 的 `[标题](规范 URL)`。先定义并测试标题中反斜杠、方括号等 Markdown 特殊字符的确定性转义，再实现与系统分享互不抢占的 single-flight、成功/失败 `aria-live` 回执、无 Clipboard 时的可恢复路径和 320px 布局。不得改变 canonical、系统分享取消语义、打印来源或无 JavaScript 阅读能力，也不得引入云服务、账号、跟踪器或第三方 SDK。
