# Iteration 0086：Markdown 引用复制

## 1. 范围与成功标准

本轮只扩展现有详情页分享轨道，为技术读者增加可直接粘贴到 Obsidian、README 或 issue 的 Markdown 引用。输出必须精确为 `[转义后的标题](规范 URL)`；标题中的 Markdown 标点必须保持字面语义，规范 URL 不得改写。新动作与系统分享共用一个 single-flight，Clipboard 不可用或拒绝写入时必须给出真实失败和手工恢复路径。桌面、390px、320px、键盘、屏幕阅读器、无 JavaScript、打印来源和现有系统分享取消语义均不得回归；不得引入云服务、账号、跟踪器或第三方 SDK。

## 2. 项目结构状态

- `lib/share.ts`：新增 `createMarkdownCitation` 与 `copyMarkdownCitation`，引用生成和 Clipboard 结果保持无 DOM、可独立测试；
- `components/ShareTrace.tsx`：单按钮状态扩展为 `none/share/citation` × `idle/working/shared/copied/failed` 的判别联合，并加入第二个 `COPY MD` 动作；
- `app/globals.css`：分享轨道右端升级为主/次双通道控制台，桌面、中宽与窄屏共用确定性 grid；
- `tests/share-controls.test.mjs`：新增纯字符串、全 ASCII 标点 GFM 回验、精确 Clipboard 写入、无能力和拒绝写入测试，并锁定双按钮共享 busy 契约；
- `tests/rendered-html.test.mjs`：文章与项目 SSR 都必须包含两个隐藏增强按钮、规范 URL 和初始状态；
- `README.md`：公开状态加入 Markdown 引用复制；
- 内容 Markdown、Studio、Obsidian 插件、OAuth、Vercel、workflow、依赖与作者文件均未改变。

## 3. 设计内容

视觉继续把 `SHARE TRACE / CANONICAL` 当成来源证据，而不是新增通用 CTA 区。右端由单个黑底按钮扩为双通道：主动作 `SHARE / COPY` 使用实底，次动作 `COPY MD` 使用描边；两者共享一条中文结果回执。设计只复用现有 `--ink`、`--paper`、`--signal`、`--trace` 和等宽字体，不增加颜色、图标库或动效。

第一次方案给两个按钮增加了包装层和装饰符，但生产 HTML 预算证明这些元素没有承担新语义。依据 frontend-design 的克制原则，最终移除包装层、`[ ]`、箭头和重复标题 aria 文本，只保留按钮可见名称、独立中文 `aria-label`、共享 live 状态和主次色块。内部类名也在 `.content-share` 根范围内收敛为 `share-url`、`share-ops`、`share-button`、`share-status` 等短而明确的局部词汇，减少 HTML 传输而不删辅助技术属性。

## 4. 使用的技术

- [CommonMark 当前规范：Backslash escapes](https://spec.commonmark.org/current/#backslash-escapes)：任何 ASCII 标点都可用反斜杠转义；生成器只处理标题的 `U+0021–002F`、`U+003A–0040`、`U+005B–0060`、`U+007B–007E`，URL 保持原值；
- `mdast-util-from-markdown`、`mdast-util-gfm` 与 `micromark-extension-gfm`：把包含全部 ASCII 标点的真实引用重新解析，验证链接只有一个原始纯文本子节点；
- Clipboard API：只把生成后的完整引用交给既有 `navigator.clipboard.writeText` 能力；无能力或 Promise 拒绝统一返回 `failed`；
- TypeScript 判别联合：不允许 citation 进入 `shared`，也不允许 idle 伪装成某个活动动作；
- React 19：同步 `busyRef` 在 state 更新前抢占操作权，两按钮同时以同一个 `isWorking` 禁用；挂载标记和复位计时器继续阻止卸载后更新；
- Next.js 16.3：服务端仍负责标题和绝对 canonical，只有浏览器能力与交互状态进入最小 Client Component；
- 原生 CSS grid、`aria-live="polite"`、`aria-atomic="true"`、`aria-describedby` 与 print 隔离；
- 原始 HTML 体积门：通过受信代理头测量真实规范主机下的 UTF-8 响应，而不是只看较短的 localhost URL。

## 5. 实现的功能

1. 文章与项目详情页新增独立 `COPY MD` 按钮；
2. 普通标题生成 `[标题](规范 URL)`；
3. 标题中的所有 ASCII 标点均反斜杠转义，GFM 重新解析后仍是逐字相同的纯文本标题；
4. Clipboard 只接收完整 Markdown 引用，不复制描述、不改写 URL；
5. 成功显示 `MD COPIED` 和“Markdown 引用已复制到剪贴板”；失败显示明确手工恢复指引；
6. 系统分享和引用复制共用 busy 锁，任一动作 pending 时两个按钮同时 disabled；
7. 系统分享的原生成功、URL 复制回退、用户取消静默和双能力失败语义全部保留；
8. JavaScript 关闭时动作仍隐藏，规范 anchor 继续可用；打印继续只保留既有 `PrintSource`。

## 6. 实现方法

先只改测试。第一次定向执行 13 项中 6 项通过、7 项失败：五个引用子测试缺少导出函数，结构测试缺少双按钮状态，证明新契约没有被旧分享行为误覆盖。实现最小生成/复制函数和双动作判别状态后转为 13/13；随后依据 CommonMark 官方规范把三字符方案扩为全部 ASCII 标点，并增加 GFM 反解析证据，最终定向为 14/14。

生产应用测试第一次为 18/19，项目详情超过原始 HTML 100KB。没有直接放宽门禁，而是逐层移除无语义结构：按钮包装层、次按钮装饰符、主按钮箭头、重复标题 aria 文本和组件根作用域内的冗长类名前缀。只用 localhost 测量一度低于阈值，但应用测试使用的 `x-forwarded-host: blog.example.test` 让多处 canonical 增长，暴露出主机长度也是 SSR 预算的一部分。最终用与应用测试相同的代理头测得项目页 99,997 字节，原 100,000 字节门禁保持不变；归档提交后的稳定生产冒烟进一步测得实际域名下解压 HTML 为 100,493 字节，证明测试主机仍不足以代表生产主机。

## 7. 验证证据

- 失败优先：13 项中 6 通过、7 失败；修复并扩展规范后定向 14/14；
- CommonMark/GFM：包含全部 ASCII 标点的标题重新解析为一个 `link`，URL 精确，唯一子节点是与输入逐字相同的 `text`；
- 静态门禁：`git diff --check`、ESLint、Next 类型生成与 TypeScript 均通过；
- 构建与应用：45/45 页面构建、19/19 应用测试；项目页应用测试代理主机响应为 99,997/100,000 字节；
- 真实桌面浏览器 1280×720：分享轨道 1136.67×108px，动作区 336×63.5px，两按钮 188.59×44px 与 139.41×44px，横向溢出 0；
- 真实复制：点击 `COPY MD` 后进入 `action=citation / state=copied`，显示 `MD COPIED` 和中文成功回执；浏览器控制隔离不开放 Clipboard 读取，精确写入字节由纯函数和 GFM 测试闭合；
- 共享并发：系统分享 pending 时状态为 `share/working`，两按钮均 disabled；系统取消后回到 idle；
- 390×844：按钮 192.43/142.24px、轨道和根页面溢出均为 0；320×844：按钮 152.18/112.49px、轨道和根页面溢出均为 0；
- 键盘焦点：按钮获得 2px `rgb(255, 120, 81)` signal 色轮廓；文章与项目各只有一个增强分享区且 URL 精确；
- 完整 `npm run release:check`：391/391 单元测试、45/45 页面、19/19 应用测试、生产依赖审计 0；inbox 0、暂存媒体 0、外链本地问题 0；
- 功能提交：`0a3613d2f4c62357338f0fa1038978119c60f684`；
- [Quality Gate #155](https://github.com/Zach424/MyBlog/actions/runs/31087515593) 成功；[Verify Vercel production #148](https://github.com/Zach424/MyBlog/actions/runs/31087559247) 成功；
- 稳定生产入口 `/`、文章、项目、`/studio` 均为 HTTP 200，文章与项目生产 HTML 都包含 `COPY MD`；稳定域名项目页实际 UTF-8 解压 HTML 为 100,493 字节，响应使用 chunked 传输，测量时无 `Content-Encoding`。

## 8. 经验与教训

“转义括号”不足以证明引用保持标题：星号、反引号、尖括号、实体、波浪线等都可能再次进入 Markdown 语义。使用官方 ASCII 标点集合，再把结果交给项目实际使用的 GFM parser 反解析，比维护一份凭经验挑选的字符列表更可靠。

另一个教训是体积预算必须用实际生产主机测量。localhost、`https://blog.example.test` 与稳定 Vercel 域名长度不同，canonical 又同时进入 metadata、可见 anchor 与 RSC；只看本机或替代主机会得到假绿。门禁成功迫使设计移除无职责的 DOM，但测试主机 99,997 字节、稳定生产 100,493 字节也证明当前“所有路由统一 raw HTML 100KB”既把作者内容增长和模板开销混在一起，又没有覆盖真实部署主机，继续逐字符缩类名不会形成可维护的长期策略。

## 9. 全局状态、风险与未解决问题

读者现在可以取得规范 URL、系统分享、URL 复制和 Markdown 引用，且全部建立在服务端 canonical 和本地浏览器能力上。公开运行时仍无第三方分享代码或生产依赖。Clipboard 成功受安全上下文和浏览器许可影响，失败路径继续保留规范 anchor；标题转义遵循 CommonMark/GFM，但粘贴目标若采用非兼容私有语法，仍应以其渲染结果为准。

全局候选最初为 JSON Feed 1.1、公开 Markdown 源导出和 PWA manifest。JSON Feed 最符合现有 RSS/内容索引且无需云服务；公开 Markdown 源需要先定义 frontmatter 脱敏、附件绝对化和内部链接策略；PWA 对当前内容站收益最低。但应用测试项目页只剩 3 字节 raw HTML 余量，稳定生产实际已比统一上限高 493 字节，而 JSON Feed 规范建议页面增加发现 `<link>`，直接实施会继续扩大失真。因此下一轮先修复预算模型，JSON Feed 顺延一轮。既有风险仍包括真实 Obsidian 主题首次使用观察、Decap 开发依赖上游高危项、Actions pin 主动复核，以及等待所有者选择的自定义域名、统计、评论和公开邮箱。

## 10. 下一轮唯一主任务

把统一的“raw HTML < 100KB”升级为可解释的双层预算：保留明确的原始 HTML 紧急上限，同时用 `node:zlib` 对实际生产主机语义下的响应计算 gzip 传输字节，并为关键路由输出 raw/gzip 实测值、阈值和剩余余量。先写失败夹具，证明高度重复但可压缩的内容与不可压缩膨胀会得到不同判断；阈值必须由当前路由基线和公开 headroom 规则推导，不能只为当前页面放行。测试还必须证明规范主机来源与稳定生产域名一致，避免 `blog.example.test` 再次产生假绿。不得改变页面功能、内容、部署或外部服务。该门稳定后，下一功能才是复用现有公开索引实现 [JSON Feed 1.1](https://www.jsonfeed.org/version/1.1/) 的 `/feed.json` 与发现链接。
