# Iteration 0024：站内双向引用账本

## 1. 范围与成功标准

项目继续服务同一目标：让个人学习、技术判断与项目复盘成为可发布、可验证、可持续维护的知识网络。Iteration 0020 已从正文派生关系并在详情页展示 backlinks，Iteration 0023 的全局复盘确认读者仍无法在正文结束后看见当前记录主动引用了哪些站内内容。本轮单一任务是补齐 outgoing 视图，与 backlinks 组成双向账本。

成功标准：文章和项目详情页都消费同一关系索引；显示“这条记录引用”与“引用这条记录”两个语义方向；复用现有排序与内容行；单侧为空只显示另一侧，两侧都为空不渲染账本；服务端输出可访问 HTML；标题 ID 唯一；桌面与 320px 可读且无横向溢出；不改变 Markdown/frontmatter、URL、发布入口或关系完整性门；不引入数据库、客户端状态或图形库。

回滚边界只包括关系索引只读访问器、共享详情组件、两类详情页装配、局部 CSS、渲染测试和文档。正文关系派生算法、Obsidian 转换、Studio、Vercel 与内容数据均保持兼容。

## 2. 项目结构状态

- `lib/content/relations.ts`：继续一次派生 `outgoingByUrl` 与 `backlinksByUrl`，本轮算法不变；
- `lib/content/index.ts`：新增 `getOutgoingReferencesFor(record)`，与既有 backlinks 查询共享冻结关系集合；
- `components/ContentViews.tsx`：原单向 `ContentBacklinks` 收敛为 `ContentReferenceLedger` 与内部方向分组；
- `app/posts/[slug]/page.tsx`：服务端读取并传入 outgoing/backlinks，保留相邻文章导航；
- `app/projects/[slug]/page.tsx`：使用同一账本组件，项目资源与正文结构不变；
- `app/globals.css`：新增双向轨道布局、方向箭头和 55rem/42rem 响应式规则；
- `tests/rendered-html.test.mjs`：覆盖双分组、唯一方向标题、空关系省略与既有目标链接；
- 内容源、发布器、构建校验、搜索、Feed、Studio/OAuth 与部署工作流本轮不变。

## 3. 设计内容

视觉继续使用 Commit Trace / Evidence Rail 的工程档案语言。账本顶部只解释一次“正文链接形成的双向账本”，下面用两条真正编码信息方向的轨道组织内容：`→ Outgoing / 这条记录引用` 表示向前追溯背景与依据，`← Incoming / 引用这条记录` 表示从当前判断继续阅读后续实践。

本轮唯一识别性表达是放大的方向箭头。它不是装饰编号，而是关系语义；其余部分继续复用内容索引行、字体、颜色 Token 和细线规则。桌面采用约 15rem 说明栏加内容列表，55rem 以下折为单列，42rem 以下缩小方向栏与行网格。没有增加动画、卡片阴影或客户端切换器，避免双向关系被视觉控件掩盖。

文案从读者行为出发：“这条记录引用”回答依据去哪里找，“引用这条记录”回答之后哪里继续。空方向不显示标题或占位，两侧都空时正文直接进入原有相邻导航/页尾。

## 4. 使用的技术

- TypeScript：只读关系查询和 discriminated direction 属性；
- React 19 Server Components：在服务器端组合账本，无 hydration 状态；
- Next.js 16.3 App Router：动态详情页继续使用异步 params、`generateStaticParams` 与 `next/link`；
- 现有 `ContentRecord`/`ContentIndexList`：跨文章与项目复用排序、元数据和导航行；
- 语义 HTML：外层与两个方向均使用 `section` + `aria-labelledby`，H2/H3 保持层级；
- CSS Grid 与既有设计 Token：桌面双栏、窄屏单栏、深色偏好和 reduced motion 基线不变；
- Node test + 真实 Next production server：验证最终 HTML，而非仅检查源码字符串；
- 内嵌浏览器：桌面与 320px 视口检查布局、溢出和控制台日志。

## 5. 实现的功能

- 文章详情展示正文引用的公开文章/项目；
- 项目详情展示正文引用的公开文章/项目；
- 原有 backlinks 保留并与 outgoing 位于同一账本；
- 两个方向继续按发布日期倒序、标题稳定排序；
- 重复正文链接仍只产生一条目标记录；
- 每条关系复用类型、发布日期、标题、摘要和阅读时间/项目状态；
- 单侧为空时不出现空分组；
- 没有 outgoing/backlinks 的公开内容不出现空账本；
- 所有目标使用 `next/link`，继续进入现有预取与客户端导航路径；
- 关系仍由 Markdown 正文唯一派生，作者无需维护第二份字段。

## 6. 实现方法

关系层在上一阶段已经正确计算双向 Map，缺口不是数据而是消费接口。本轮因此没有重新解析正文，也没有复制排序逻辑；`getOutgoingReferencesFor` 与 `getBacklinksFor` 只按记录稳定 URL 查询同一个冻结 `relations` 对象，未命中返回空数组。

详情页在 Server Component 中一次取得两个方向，并交给 `ContentReferenceLedger`。组件首先处理总空状态，再由内部 `ContentRelationGroup` 分别处理单侧空状态。方向决定箭头、英文辅助标签、中文标题、说明和唯一标题 ID；实际记录继续交给 `ContentIndexList`，因此标签/项目类型、日期、摘要和目标链接不会出现第三套表现。

组件保持在默认 Server Component 图中，没有 `use client`、浏览器 API或序列化边界。Next.js 16.3 本地文档确认页面默认服务端渲染、`next/link` 提供客户端转换和可见区域预取；本轮沿用这些框架契约，不引入手工路由或交互状态。

CSS 把外层标题、方向说明和记录行分开。桌面每个方向使用 `minmax(12rem, 15rem) minmax(0, 1fr)`，箭头占 2.75rem；55rem 以下方向说明和列表上下排列，42rem 以下压缩到 2rem 方向栏。所有颜色来自 `--signal`、`--muted`、`--trace-dark` 等既有 Token。

## 7. 验证证据

- `node --experimental-strip-types --test tests/content-relations.test.mjs`：3/3 通过，确认跨类型 outgoing/backlinks、去重、自引用和断链门；
- `npm run lint`：通过；
- `npm run typecheck`：Next 路由类型生成与 TypeScript 通过；
- `npm run build`：Next.js 16.3.0 编译成功，33/33 页面生成完成；
- `npm run test:app`：15/15 真实生产 HTTP/质量测试通过；有关系的文章输出两个语义分组和唯一 ID，无关系的 `project-charter-before-homepage` 不输出账本；
- 浏览器桌面复核：两个方向均为 `240px + 968.667px` 网格，账本宽度约 `1280.667px`，页面 `scrollWidth === clientWidth`；
- 浏览器 320px 复核：可布局宽度 305px，两个方向均折为单列 `272.667px`，横向溢出为 0；方向、标题、摘要和内容行可读；
- 浏览器控制台 error/warning：0；临时 3000 端口生产服务器已停止，临时视口已恢复；
- 最终 `npm run release:check`：维护报告健康、46/46 单元测试、TypeScript、33/33 构建页面、15/15 生产 HTTP/质量测试、production-only audit 0；
- `git diff --check`：通过；
- 实现与初始归档提交 `c3f3e51354938f7d5cf258a94997cf9cac2fbb6b` 已推送 `main`；GitHub Quality Gate `30895600719`（Run 27）为 completed/success；
- Vercel Production `dpl_Hq7Gg6yqZZ2bfTkvN4dFo2AKdTvD` 为 Ready，不可变 URL 是 `https://blog-jn3dykeg6-czq1.vercel.app`；完整日志明确克隆 `c3f3e51`，编译、TypeScript、33/33 页面生成与 Deployment completed 全部成功；
- 自动生产冒烟 `30895637164`（Run 21）为 completed/success；独立稳定域名冒烟再次返回 `23 routes, OAuth 302`；网络命令只在当前进程使用本机代理，未写入永久配置。

## 8. 经验与教训

- 先审计已有数据能力可以避免重复实现；本轮 outgoing 早已正确派生，真正缺口只是公开查询和界面消费；
- 双向关系不需要图数据库才能有读者价值，正文链接、稳定 URL 和两个 Map 已足够支持当前内容规模；
- 方向必须进入信息架构而非只靠颜色；箭头、英文辅助词、中文标题和 DOM 区域共同表达语义；
- 统一组件比堆叠两个近似区块更容易处理说明、空状态、标题层级和响应式规则；
- 空关系也是契约：不渲染比显示“暂无引用”更适合正文末尾的低噪声阅读路径；
- 运行时 HTML 测试应覆盖“出现”和“不出现”，否则一个总是渲染的空壳也可能通过正向断言；
- 320px 验证必须读取真实 `scrollWidth/clientWidth`，仅看截图无法证明没有不可见溢出；
- 页面关系是正文的派生视图，不能把 outgoing/backlinks 数组写回 frontmatter，否则作者会维护两个可能漂移的事实源。

## 9. 全局状态、风险与未解决问题

公开阅读、双作者入口、内容/媒体契约、附件、双向知识链接、自动交付、恢复、新鲜度硬门和维护预警均为 done。知识关系从“可写、可校验、可回看来源”升级为完整的详情页读者闭环：作者只写正文链接，构建检查目标，详情页同时给出引用去向与引用来源。

剩余主要风险：图片仍无自动压缩/响应式派生；全站关系图在当前 4 条公开内容规模下收益有限；Actions 维护提醒不发送外部消息；Obsidian 块引用不支持；Decap 上游开发依赖审计风险仍存在；自定义域名、统计、评论和公开邮箱继续等待所有者选择。

## 10. 下一轮唯一主任务

为 Obsidian 附件发布增加确定性的自动 WebP 优化：静态 PNG/JPEG/WebP 先输出到 staging，验证实际格式、尺寸、像素和体积后再进入 `public/uploads/<slug>` 并改写正文；质量门失败时连同草稿一起回滚。GIF/AVIF 先保持现状，不引入外部图片服务，响应式多尺寸派生留给后续独立迭代。
