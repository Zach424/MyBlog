# 设计系统

## 已选方向

视觉方案在 iteration 0003 冻结为“工程轨迹 + Evidence Rail”：

- “工程轨迹”是唯一主要识别元素，用连续的日期、节点和项目分支表达学习积累；
- Evidence Rail 是功能性证明区，只展示已经验证、正在构建和本轮学到的真实状态；
- 公开上线只在无凭证 HTTP 与未登录浏览器验收通过后进入 Verified，不能把部署成功或已登录预览等同于公众可访问；
- 页面整体保持冷调、克制和编辑感，不把技术博客做成终端窗口或仪表盘。

首页主句为“把写过的代码，变成可复用的判断。”它定义了博客的内容标准：记录不止描述结果，还要保留取舍和证据。

Evidence Rail 的运行事实必须可证明。Verified 项中的公开 URL 数量从与 Sitemap 相同的路由清单实时派生，元数据明确写作 `Sitemap synced`；首屏版本编号不再手写，改用 `LATEST · <日期>` 展示与 Sitemap 根 URL `lastmod` 相同的最新公开内容日期。Building 直接显示精选项目标题、中文状态与前两项技术栈，Learned 直接显示最新文章标题、类型、发布日期与首标签，剩余 stack/tag 用 `+N` 保持元数据密度；Current focus 组合项目状态、最新内容类型与同一最新日期。标题不在数据层截断，由既有轨道自然换行；空库显示明确等待状态，不为填满界面伪造项目、学习或日期。这个变化只提高证据可信度，不改变首页网格、颜色、排版或交互层级。

About 页继续使用四格规则线，不改成营销式个人简介。第一格从静态“记录什么”升级为 `dl` 系统档案：文章/TIL、项目、专题、标签计数可直接进入对应集合，公开 URL 与最近更新保留为不可点击的系统事实；Intro 的等宽 meta 同步显示记录总数、路由总数和更新日。第三格显示精选项目完整标题、中文状态和全部 stack，技术项以无图标的描边标签自然换行。方法原则和 GitHub-only 联系边界继续稳定存在；320/390px 折为单列，标题与 stack 不截断，深色只复用现有 Token。

项目 status 的紧凑展示统一为“中文标签 · 大写机器码”，例如 `持续维护 · MAINTAINED`。中文让普通读者直接理解阶段，大写 code 延续工程账本识别；首页项目卡、项目集合尾注和项目详情 eyebrow 使用同一核心文本，不再分别首字母大写、全大写或暴露小写 enum。窄卡片允许在分隔符附近换行，项目列表与详情自然流动，不缩小标题、不省略状态；About 与 Current focus 等完整中文句仍只用人类 label，避免机械重复。

通用内容列表的左侧元数据分成 TYPE / DATE MODE / DATE 三层，例如 `PROJECT / UPDATED / 2026-08-06`。TYPE 保持 Signal，`UPDATED/PUBLISHED` 使用更弱的等宽文字，日期保持可读；这比只换日期更明确，也不让读者把维护日误认成首发日。桌面和移动端都沿原列宽纵向堆叠，不挤压标题。时间档案是“内容何时形成”的独立视图，继续使用 `07.18` 与“发布日期”语义，不显示 UPDATED。

搜索与知识地图延续同一日期语言，但适配各自媒介。搜索结果在内容类型下纵向显示 DATE MODE 与 DATE，空查询标题和行尾提示都明确为“首发时间/首发顺序”，让视觉更新时间与实际排序同时可读；不会把 UPDATED 误写成“按更新日排序”。桌面知识图节点使用单行 `TYPE / DATE MODE / DATE`，保持节点计数和标题空间；移动端按既有规则隐藏宽 SVG，并在孤立记录的原生 HTML 中保留相同日期文本。颜色、字号和断点都复用现有 Token，不新增徽章或交互控件。

首页机器身份不增加可见徽章或“SEO 区块”。`WebSite` 的名称复用页头已经分层展示的 `Zach424 / Engineering Notes`，描述复用首页支持句的长期站点承诺，语言复用根文档 `zh-CN`；结构化脚本只承担机器发现，不与 Commit Trace 争夺视觉层级。没有真实站点别名或远程搜索动作时不为丰富 schema 而虚构字段。

文章与项目的机器身份同样不增加可见标签、卡片或作者档案区。每条内容只在已有服务端 JSON-LD 中加入 `<canonical>#content` 与指向主页 `#website` 的最小节点引用；完整文档虽然已经收口为纯生成器，标题、封面、正文、面包屑、分享和推荐的视觉层级仍保持不变。文章新增的 `wordCount`/`timeRequired` 复用正文已经显示的阅读统计，不再增加第二个字数或时长 UI。这样让机器图谱获得连接和可维护边界，同时避免把内部实现词汇暴露给读者。

## 颜色 Token

### 浅色

| 角色 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| Canvas | `--canvas` | `#F2F6F7` | 冷调页面背景 |
| Paper | `--paper` | `#F8FAFA` | 悬停和内容层 |
| Ink | `--ink` | `#18263D` | 标题、正文和主要轮廓 |
| Muted | `--muted` | `#566D77` | 摘要和辅助信息 |
| Faint | `--faint` | `#60737D` | 次级元数据 |
| Signal | `--signal` | `#B9431F` | 状态、焦点和关键动作 |
| Trace | `--trace` | `#B9D8DE` | 轨迹强调和标记 |
| Trace dark | `--trace-dark` | `#486F78` | 轨迹线、边框和编号 |
| Rule | `--rule` | `#D7E4E7` | 分隔线 |

### 深色

深色模式由 `prefers-color-scheme` 自动跟随系统，主要值为 `#101820` 画布、`#EDF4F5` 主墨色、`#FF7851` 信号色和 `#5F8F99` 轨迹色。它保持相同的信息层级，不对浅色方案做机械反相。

浅色与深色主题中承担正文、辅助信息、元数据、信号和轨迹文本的 Token 都以各自画布为背景通过 WCAG AA `4.5:1` 自动对比度门槛。装饰线与非文本标记不冒充可读文本。

## 字体角色

- 展示与章节标题：`Bahnschrift Condensed`、`Arial Narrow` 和中文界面字体回退；
- 中文正文与界面：`Microsoft YaHei UI`、`PingFang SC`、`Noto Sans CJK SC`；
- 日期、状态和元数据：`Cascadia Code`、`Consolas` 等等宽字体回退。

第一版只使用系统字体栈，避免字体许可、体积和跨网络加载风险。后续只有在完成许可与性能验证后才引入 Web Font。

## 布局规则

- 页面最大宽度 `1440px`，水平留白随视口在 `24px` 到 `80px` 之间变化；
- 桌面首页首屏采用非对称主内容 + `318px` Evidence Rail；
- 最近记录由日期列、轨迹节点、内容列和项目分支组成；
- 精选项目从最近一条记录分支出去，表达“学习内容被项目验证”；
- 主题索引和页脚保持扁平，不额外引入卡片系统。

## 交互与动效

- 交互反馈控制在约 `160ms`，只改变颜色、下划线或轻微位移；
- 首次进入时只绘制主轨迹和项目分支，不使用循环动画；
- 所有链接具有高对比度 `:focus-visible` 轮廓；
- 提供跳到主要内容的键盘链接；
- `prefers-reduced-motion: reduce` 下禁用平滑滚动、动效和长过渡。

## 响应式规则

- `≤ 1100px`：缩小侧栏和项目分支宽度；
- `≤ 880px`：Evidence Rail 移到主句下方，项目分支进入内容列；
- `≤ 672px`：导航分成两行，证据项改为单列，轨迹日期列收窄；
- 手机端保留轨迹语义、真实状态和主要动作，不只做比例缩放。

真实 Chromium 验收覆盖 `1440 × 1000`、`390 × 844` 和 `320 × 568`，并同时检查浅色、深色与 `prefers-reduced-motion`。根 `html` 与 `body` 不设置固定最小宽度；水平留白由 `.page-shell` 控制，因此即使桌面浏览器的垂直滚动条占用布局宽度，页面 `scrollWidth` 也必须等于根元素 `clientWidth`。验收截图保存在 `output/playwright`，作为排版与修复证据，不替代跨浏览器复核。

## 集合页与阅读页

- 集合页使用编号行而非卡片堆叠，统一展示类型、发布日期、摘要与阅读时间或项目状态；
- `/archive` 把 Commit Trace 延展为长期档案，而不是另一组内容卡片：左侧年份 spine 负责跨年定位，月份 tick 承接右侧的日期、Article/TIL/Project、标题与摘要账本；节点、直角规则线和 Signal 箭头都来自现有 Evidence Rail。`≤55rem` 时年份与月份改为上下层级，`≤42rem` 时单条记录折为日期/类型在上、标题/摘要在下；深色只替换既有 Token，打印隐藏站点框架和继续发现链接、保留完整时间语义，并避免年份/月组跨页断裂；
- `/subscribe` 把一份 Markdown/Git 内容源画成无动画 switchboard：左侧 Source rail 只说明单一来源，右侧五个 Port 用受众、标题、说明、Format、Endpoint、Freshness 与原生动作链接表达真实协议，不做通用卡片或虚构统计。`≤55rem` 时 Source 转为顶部总线，`≤42rem` 时每个 Port 折为编号轨道、正文和动作三段；深色只替换 Token，打印保留协议与 URL、隐藏无必要继续操作；
- 四类详情面包屑表达真实“首页 → 集合 → 当前标题”路径，当前项不再用 Article 或维护状态冒充页面身份；可见导航与 JSON-LD 共用同一数组。上级路径在窄屏不收缩，当前长标题负责自然换行，保留等宽、细规则和 `/` 分隔这一工程索引语法，不增加图标或卡片；
- 详情页顶部采用主标题 + 事实栏；事实栏先展示内容语境与复核日期，再展示发布日期、更新时间、阅读时间、专题或项目资源；
- 详情页 Share Trace 在 canonical 下方增加同一规则线语法的 `Portable source / VIEW .MD →` 结构来源行；它始终是原生链接、无需 JavaScript，不扩张为下载卡片或第二个主 CTA，长 URL 在 320px 自然换行且不产生页面级横向滚动；
- Current record / Historical snapshot 使用现有等宽事实行，不增加营销式徽章；历史正文用 Signal 左规则的引用块说明时间范围与当前去向；
- 正文桌面宽度控制在约 `760px`，H2/H3 目录位于右侧并使用粘性定位；窄屏时目录移到正文前并取消粘性；
- 标题锚点、正文 ID 与目录链接使用同一 GitHub slug 规则，重复标题得到稳定序号；正文 H2/H3 在标题内容之后追加独立的 `##`/`###` 原生永久链接，直接复用渲染 id，不包裹作者标题内的链接；桌面把标记放进左侧索引沟并在标题 hover、链接 focus 或目标命中时显现，触控与 `≤42rem` 常显为 44px 点击区，打印隐藏；
- fenced code 采用深蓝证据面板与固定操作轨：左侧 `CODE / LANGUAGE`，右侧 hydration 后才显示 COPY，COPIED/FAILED 只改变动作格；无 JavaScript 时语言与代码完整，320px 仅代码层横向滚动。表格、引用和行内代码继续沿用现有 Token，表格可键盘聚焦并横向滚动；
- 打印版是阅读页的纸面形态，不是第二套站点：A4 白纸保留完整标题、摘要、标签、五列事实、来源、封面、正文、代码、图片、表格与必要引用，隐藏站点框架、目录、相邻内容、复制按钮和 permalink；标题先完整占据版心，再进入事实栏，避免通用报纸式双栏压缩中文长标题；H2 用 Signal→Rule 的双段上边线延续 Evidence Rail，代码转为浅色证据块，外链追加可读 URL，关系账本压缩为标题与相对路径；
- Markdown 脚注不是悬浮卡片或正文旁注，而是阅读末尾的 Evidence Rail：正文用带 Signal 上规则的紧凑等宽编号标记，末尾以 `ANNOTATION / EVIDENCE`、中文“注释与来源”、`01 /` 序号和横向规则形成证据账本；目标脚注获得 Paper 底色与 Signal 左轨，回链保持至少 28px 操作区和可见焦点；320px 改为单列自然折行，深色模式复用现有 Token，打印保留编号、证据与链接但隐藏无意义的返回控件；
- 数学公式不是独立卡片或第三方小组件，而是正文中的 calculation strip：行内公式安静地贴合基线并以 Trace 下规则提示技术语义；块级公式使用上下 Trace 规则、Paper 底色和等宽 `CALCULATION / MODEL` 眉题，公式本身居中。窄屏只允许该条带横向滚动并提供可见焦点，整页保持 320px；深色只替换现有 Token，打印缩小字号、取消滚动并保持公式与条带同页；
- 详情页“继续阅读”不是黑盒猜你喜欢：`Continue trace` 以最多三列的直角轨迹节点承接 Commit Trace，每项保留序号、类型、标题与由专题/标签/正文引用产生的可见理由；内部数值只决定顺序，不作为读者无法解释的分数展示。`≤55rem` 改为单列，320px 理由自然换行；深浅色复用 Paper/Ink/Trace/Signal，打印隐藏。第一版日期、摘要与多层标签造成 HTML 预算接近阈值，最终主动压缩为必要证据，不复制通用卡片；
- 首页工程轨迹仍是唯一视觉签名，内容页以排版与证据层级服务阅读，不复制轨迹装饰。

## 搜索界面

- 搜索页沿用编号行与工程证据层级，不引入独立卡片系统；
- 大尺寸输入框是页面唯一动作，前缀 `/` 表示“在工程日志内检索”，不是终端角色扮演；
- Indexed 与 Matched 只显示真实公开索引数量，不展示访问量或虚构统计；
- 匹配结果说明命中标题、标签、摘要或正文，并保持发布日期、内容类型与技术标签；
- 空查询按最新顺序显示全部公开内容，零结果给出缩短关键词、检查拼写和使用标签的明确恢复路径；
- 查询参数写入当前 URL，方便分享和返回；匹配完全在浏览器本地完成，不发送搜索词。

## 知识地图

- `/knowledge` 的单一任务是回答“一条判断从哪里来，又被哪些实践继续使用”，不把内容网络包装成访问量仪表盘；
- 视觉签名是双列工程信号场：文章位于左侧、项目位于右侧，Trace 与 Signal 区分来源类型，有向箭头表示正文引用；互相引用使用两条分轨曲线，孤立节点用虚线保留；
- 节点是原生可聚焦 SVG 链接，显示类型、日期和 OUT/IN 数量；网格、总线和一次性描线只承担方向辅助，Reduced Motion 仍关闭动效；
- 图形下方始终输出逐条 HTML 关系账本和孤立记录，不要求屏幕阅读器或无 JavaScript 环境解析空间位置；
- `≤ 672px` 主动隐藏宽 SVG 并显示切换说明，完整关系改用单列账本，不在手机上强迫缩放、拖动画布或承担页面级横向滚动；
- 当前设计有意不使用通用径向气泡图：它会隐藏方向、难以承载中文长标题，也会让少量真实节点显得像虚构数据展示。

## 社交分享卡

`public/og.png` 为 `1200 × 630`，复用冷调纸面、压缩标题字、Commit Trace 和三种证据状态。Open Graph 与 X/Twitter 元数据通过请求主机生成绝对 URL，未知主机时回退到本地开发地址。

## 发布后台

`/studio` 的单一任务是把草稿安全推进为 Git 提交，不复制公开首页的信息架构。CMS 加载前使用“把草稿推进为可验证的发布”作为操作主句，顶部四色轨迹复用公开站点的 Signal、Ink 与 Trace，而不是增加后台专用品牌。

编辑器沿用成熟 CMS 的列表、字段和 editorial workflow；真正与博客一致的视觉风险集中在正文预览：冷调画布、压缩标题字、Signal 顶线、规则线、代码块和深色偏好都与阅读页共用语义。后台不增加访问量、发布百分比或虚构状态，只显示 GitHub 草稿、审核与已发布事实。

图片选择后的质量反馈使用一个固定在右下角的 Evidence Rail，而不是弹窗或卡片堆叠。它只在检查开始后出现，用 3px 状态线、标题和一行证据展示真实格式、宽高、帧数与体积；通过、失败与检查中复用既有 Trace、Signal、Canvas/Ink 色彩和等宽元数据字体。反馈通过 `role=status/alert` 与 `aria-live` 对辅助技术可见，不使用图标、阴影、循环动效或会阻断编辑的模态层。

稳定 slug 字段把内容身份作为事实而不是普通文本。输入下方只有一条 `Identity state / editable|locked` 等宽说明：首次保存前用 Signal 左规则提示作者仍可决定 URL；已有条目用 Trace 规则说明内容文件、公开 URL 和附件目录已经共享同一锁。locked input 保持可聚焦和复制，不使用 disabled 灰化或弹窗；确需迁移时引导作者使用 Git 完成显式原子变更。

数学正文预览使用 `AUTHOR PROOF / GIT DRAFT` 头和一条证据状态带，不复制公开首页或增加通用卡片。普通 Markdown 标为 `STANDARD / MARKDOWN`；潜在公式依次显示 `FORMULA / CHECKING` 与 `FORMULA / VERIFIED`，语法错误显示 `FORMULA / NEEDS FIX` 和正文行号，服务不可用显示可恢复说明。公式继续使用公开正文的 calculation strip；错误/不可用时原 Markdown 仍在下方。320px 以 border-box 保持预览根宽，只有长公式 region 横向滚动并显示焦点；深色只复用 Paper/Ink/Signal/Trace Token。

全字段预检扩展同一 Author Proof，而不是再叠一张后台卡片。`ENTRY CONTRACT` 使用一张横向 publication ledger：左侧状态规则标示 preparing/checking/ready/needs work，四格字段证据固定显示 PATH、VISIBILITY、CONTEXT、BODY，问题清单把中文字段名与可执行原因逐行对齐。前八项直接展开，其余给出计数，避免空白新条目把正文推到不可达位置。READY 文案明确限定为“当前条目字段已通过”，同时保留保存后仓库关系、媒体和完整构建说明；网络不可用保持草稿可见。窄屏把四格证据折成两列、问题改为单列，深色只替换既有 token，不依赖图标、阴影或动画表达状态。

全库复核页把时间本身作为界面骨架。`Review Horizon` 用真实 180 / 60 / 30 / 0 天边界构成水平标尺，旁边的四格 ledger 只显示当前公开内容的状态计数；下方逐条列出最近复核日、最后有效日、剩余天数、稳定编辑入口和公开证据。它使用 Paper / Ink / Trace / Signal 既有 token、直角规则线和压缩标题字，不复制通用管理后台卡片，也不绘制虚假的完成率。`≤ 42rem` 时概览与队列折成单列，长标题允许自然换行；深色通过系统偏好切换，跳到正文、重试和全部原生链接均保持可见焦点。静态页面在数据失败时仍保留解释、清单和恢复入口，不用动画或颜色单独表达状态。

Obsidian 的维护入口服从宿主应用而不是复制网页皮肤。1.3.0 起提供的“已发布内容复核台账”使用原生 Modal、按钮和宿主 token，把同一版本化 JSON 画成 deadline ledger：顶部只说明 Git 事实源与报告边界，三格范围账本区分 Current/Historical/未公开，四段期限轨迹始终展示健康、进入复核窗口、即将到期与已过期的真实计数；逐条记录用左侧状态线、等宽日期/路径和文本状态表达期限，不使用通用卡片、颜色单独传意、渐变或动画。每条记录只有一个“打开笔记”主动作，且必须对应 Vault 中精确存在的 `content/posts|projects/<slug>.md`。结构版本、字段、日期计算、计数、阈值、顺序、路由或路径不可信时，插件重新运行纯文本报告并用 `setText` 显示只读证据。进度、完成、降级和失败继续使用原生 Notice，持续 Notice 必须在任一终态和插件卸载时消失。

正式内容复核采用显式的两步动词，不把“打开笔记”或“点击同步”伪装成事实确认。1.9.0 只在正式文章/项目处于活动视图时显示“检查当前正式内容复核”和“提交并同步当前正式内容复核”；作者必须先手工核对清单并编辑日期。检查成功后打开原生只读 Author Proof：`AUTHOR PROOF / CHECKED`、真实标题/路径、HEAD 到当前日期的 review transition rail，以及规则线账本中的事实变化、updatedAt、质量门、main/index、唯一提交路径。Proof v3 在同一 ledger 增加一行 Verified 侧线的 `CANDIDATE / GATE-STABLE`，以 monospace 显示 `sha256:前12位…后8位`，完整 64 位值通过 title 与 aria-label 可用；它是“门前/门后字节一致”的证据，不是安全评分、成功徽章或复制控件。若并行草稿存在，同一账本用 Caution 侧线和 `DEFERRED / NOT IN COMMIT` 逐项列出 `MODIFIED`/`UNTRACKED` 路径；这是提交边界证据，不是第二组状态卡。迁移轨仍是唯一视觉签名，使用宿主 text/interface/monospace 字体及 Verified/Trace/Caution 颜色与文本双重语义，不使用卡片、渐变、动画或同步按钮。底部明确“仍需单独运行提交并同步”；结构、摘要或差集异常则退回纯文本 Proof。

待交付复核使用一条真实提交差距作为界面骨架：`ORIGIN/MAIN · LAST OBSERVED ── +1 ── LOCAL MAIN`。它只在精确 pending-review 状态显示 `DELIVERY HOLD / LOCAL ONLY` 和 `PENDING / NOT ON TRACKING REF`，下方 ledger 列出正式路径、subject、完整 commit/tree/blob 与固定恢复命令；synchronized 使用同一轨迹显示 `+0`，其他关系只显示 INSPECT，不给 push 建议。边界文案明确本地 tracking ref 可能过期、没有 fetch/push/历史修改。Hold 使用 Caution，已对齐使用 Verified，路径和 object id 使用 monospace；没有绿色“安全”徽章、复制按钮、卡片、渐变或动画，窄屏仍保留两端引用关系并把 ledger 折为单列。

1.9.0 的执行入口与只读 rail 分开命名；成功后不是沿用 pending 弹窗改颜色，而是显示一张封存账本。唯一视觉签名为 `VERIFIED LOCAL COMMIT ── SEALED PUSH ── ORIGIN/MAIN · OBSERVED AFTER PUSH`，两端必须显示同一短 OID；下方逐行保留正式路径、完整 commit/tree/blob 和精确 refspec，再用 `HEAD STABLE / INDEX STABLE / WORKTREE STABLE` 说明本地表面未被交付动作改写。Verified 使用宿主绿色 token/fallback `#2f756f`，Trace `#486f78`、Caution `#c6683c`、Paper `#f4f3ef`，正文仍服从 Obsidian text/interface/monospace。回执没有分数、庆祝动画、复制/重试/再次 push 按钮；末行明确它只证明 Git 送达，Vercel Production 由独立检查确认。窄屏把稳定性三列折为单列，长 OID/refspec 仍按现有 ledger 换行。

1.10.0 为新内容待交付建立独立视觉语义，不把复核的单路径 receipt 套在多路径事务上。顶部仍是真实 `ORIGIN/MAIN · LAST OBSERVED ── +1 ── LOCAL MAIN`，精确发布包使用 `PUBLICATION HOLD / ATOMIC BUNDLE`；主体唯一签名是带 Caution 左侧 spine 的 `COMMIT ENVELOPE / N PATHS`，并按作者认知顺序列出 `NOTE / ADDED`、`MEDIA nn / ADDED`、`INBOX / DELETED`，每行保留路径和对应 blob 短身份。下方 ledger 才列 title、subject、完整 commit/tree/target blob 与精确 OID 命令。这个视图只读，没有按钮、卡片、分数、渐变或动画；普通 ahead 只显示 INSPECT，不给 push 建议。Verified `#2f756f`、Trace `#486f78`、Caution `#c6683c`、Paper `#f4f3ef` 与宿主 text/interface/monospace 保持一致，窄屏把 manifest 和 ledger 折为单列。

1.11.0 的发布成功视图保留 Commit Envelope 作为多路径身份，不退化成泛化成功卡。顶部为 `PUBLICATION RECEIPT / SEALED ENVELOPE`，唯一轨迹是 `VERIFIED COMMIT ENVELOPE ── SEALED PUSH ── ORIGIN/MAIN · OBSERVED AFTER PUSH`；中段把同一 manifest spine 从 Caution 切为 Verified，并明确 `DELIVERED ENVELOPE / N PATHS`，NOTE、MEDIA、INBOX 的顺序、路径和 blob 身份保持不变。底部 ledger 列 commit/tree/target blob/精确 refspec，四列 `HEAD / INDEX / WORKTREE / MANIFEST STABLE` 证明本地与多路径清单未漂移。回执与执行命令分离，没有重试、复制、庆祝动画、分数或“安全”徽章；末行继续说明 Git 送达不等于 Production 完成。窄屏将四项稳定性折为单列。

1.12.0 把 push 失败后的第一步设计成 Git switchyard，而不是恢复仪表盘。顶部以 `DELIVERY TRIAGE / READ ONLY` 固定证据边界，一个 `OBSERVED LOCAL MAIN` 节点向下分出 `REVIEW`、`PUBLICATION`、`INSPECT` 三条轨道；同一时刻只有一条显示 `MATCHED`，其余保持 `STANDBY`。下方 ledger 才列 relation、branch、完整领域身份及既有 status/deliver 命令；错误分支保留类型识别但显示写入锁。synchronized 用 Verified，其余匹配用 Caution，Trace 标记观察事实，OID/path/命令使用 monospace。视图没有按钮、卡片、自动跳转、分数、渐变或动画，末行明确分诊不会执行 status/deliver，tracking ref 只是最后本地观察；窄屏把三条分支和账本都折为单列。

1.13.0 把作者环境表示成一条发布前电路，而不是健康分数仪表盘。顶部 `AUTHOR PREFLIGHT / LOCAL ONLY` 固定只读边界，`RUNTIME → GIT → WORKSPACE → VAULT` 四个真实前置站按依赖顺序汇合到 `AUTHOR READY` 或 `AUTHOR HOLD`；每站同时用 PASS/HOLD 文本和 Verified/Caution 规则线表达状态。下方 ledger 逐项给出 observed、expected 与仅在 attention 时出现的修复指令。唯一汇合端点是视觉签名，不增加按钮、自动安装、进度环、卡片、阴影、渐变或动画；正文服从宿主 text/interface，版本、路径和观测值使用 monospace。窄屏把四站与证据行折为单列，信息顺序保持不变。

1.14.0 复用这条电路作为四个新发布/复核事务的自动联锁，不另造第二套 dashboard。ready 是无视觉打断的通路，直接进入原命令；attention 才在电路前增加一条窄的双列 `TRANSACTION INTERLOCK / HELD` latch，明确显示被停止的操作与调用时冻结的来源路径，再接原有 circuit 和修复证据。latch 使用既有 caution 规则线、宿主 token 与 monospace 标识，不新增按钮、卡片、渐变、阴影或动画；窄屏折为单列，先回答“哪个事务被停止”，再说明“哪项前置条件未满足”。

1.15.0 把并发状态表达成短暂的系统占用，而不是新的错误页面。第二个新作者事务只收到一条 monospace 开头的 `AUTHOR TRANSACTION / BUSY` Notice，随后列出正在运行的原始操作、冻结 sourcePath 和“完成后再试”；它不打开 Modal、不复制 preflight circuit、不增加 CSS、按钮、进度条或虚构百分比。视觉层继续把 attention 留给可修复环境缺口，把 busy 留给暂时的串行化事实。

1.16.0 把同一条 BUSY Notice 扩展为活动证据快照，并增加“查看当前作者事务”命令。ACTIVE 与 BUSY 都以同样顺序显示操作、来源、阶段、ISO 开始时间和已运行时长；IDLE 只说明当前没有事务。阶段同时使用中文动词与 `PREFLIGHT / DOMAIN / DIAGNOSTIC` monospace 标识，使证据可扫读又不虚构完成率。界面仍只使用 Obsidian 原生 Notice，不新增 Modal、CSS、颜色、图标、动画、按钮或常驻面板；这次设计的克制点是让时间成为证据，而不是进度条。

1.17.0 在同一条原生 Notice 中补全活动脉冲。ACTIVE 与 BUSY 继续共享 operation、source、phase 的信息层级，随后依次显示“阶段进入 + 阶段用时”“最近输出 + 静默时长”“开始 + 总用时”；尚无输出时明确写“本阶段尚无输出”，不显示空时间。没有新增健康色、卡住徽章、超时阈值、进度条、Modal、CSS、按钮或常驻刷新；静默只是 stdout/stderr 的可观察间隔，不是故障判断。这样既让长门禁的阶段停留可追踪，也不把构建工具的输出缓冲误画成错误。

1.18.0 把事务结束后的空白状态设计为一条会话内证据回执。活动时仍显示 `ACTIVE`，结束后“查看当前作者事务”才显示 `IDLE · LAST RECEIPT`；信息顺序是 outcome → operation → source → final phase → started/ended/elapsed → 会话与动作边界。六类 outcome 同时使用中文动词与 `COMPLETED / HELD / COMMAND FAILED / START FAILED / RESULT FAILED / UNLOADED` monospace token，不使用绿色成功卡、红色错误卡或分数。回执仍是同一 Native Notice，不新增 Modal、CSS、按钮、动画或历史列表；最后一行明确重载即清除，且不会重试、恢复或推送。视觉上的取舍是让“刚才发生了什么”可复查，而不是把单条回执扩张成任务中心。

1.19.0 把作者入口收敛成一个只完成“创建草稿”的原生 Modal。`DRAFT ORIGIN / LOCAL ONLY`、标题和边界说明先固定零发布/零提交/零网络，随后按内容类型 → 标题 → 英文 slug 的认知顺序排列三个宿主控件，类型标签同时保留中文与 `ARTICLE / TIL / PROJECT` token。提示文字直接说明受信模板、YAML 转义与三命名空间碰撞，不增加模板预览、文件树、步骤条或历史列表；底部只有取消和一个主动作。错误用同一字段区内的 `role=alert` 文本与宿主 error token 表达，输入保持可修复；提交时临时禁用全部控件避免重复。视觉继续使用宿主 text/interface/monospace、Trace 侧线和直角间距，不用卡片、阴影、渐变、图标、动画或虚构完成率。创建成功即关闭；自动打开失败以 Notice 明确“文件已创建”和精确路径，避免把打开故障误画成写入失败。

1.20.0 把改名画成一次可核对的草稿身份转换，而不是文件管理器或迁移仪表盘。`DRAFT IDENTITY / FILE OWNED` 与边界说明先固定“只改 inbox 文件名、链接更新服从 Obsidian 设置、零发布/提交/网络”，随后以唯一的 `CURRENT → TARGET` 轨迹并列原 slug 和实时目标；当前精确路径单独放在上方，输入区只收一个新 slug。底部仍只有取消与“重命名草稿”，错误留在同一 `role=alert` 区域，提交时禁用当前 Modal 控件。成功关闭并用 Notice 给出新路径；宿主结果无法证明时关闭并用长 Notice 同时给出旧/新路径和“不自动重试”。视觉继续使用宿主字体/token、Trace 规则线、Signal 箭头和直角间距；不增加卡片、文件树、历史、进度、动画、渐变或回滚按钮。

1.21.0 把旧式身份处理画成一张本地证据页，而不是迁移向导。`DRAFT IDENTITY / LOCAL EVIDENCE`、标题和边界先声明默认只读，唯一视觉签名 `FILE ⇄ FRONTMATTER` 并列文件名与顶层字段；状态仅为 `READY / FILE OWNED`、`LEGACY / MATCHED` 或 `HOLD / CONFLICT`。`DRAFT / INBOX / POST / PROJECT` 四行 ledger 使用宿主 token 与规则线表达事实，不显示评分、进度或虚构健康度。常规和冲突状态只有“关闭”；完全匹配时才出现“移除冗余 slug”，错误复用同一 `role=alert`。没有卡片、渐变、动画、历史、批量选择或第二套导航。

1.22.0 把当前草稿的作者意图压缩成一张快速核对页，而不是复制全 inbox 报告或发布确认。`AUTHOR INTENT / LOCAL EVIDENCE` 与边界先声明它只复用正式发布解析，唯一视觉签名 `DRAFT → PUBLIC` 并列冻结的 inbox 路径和派生公开目标。状态只取 `READY / PUBLIC ON PASS`、`SCHEDULED / FUTURE DATE` 或 `HOLD / n BLOCKER(S)`；下方 `TYPE / DATE / MEDIA / LINKS` 规则线 ledger 分别呈现 Article/TIL/Project、NOW/SCHEDULED、附件数和站内引用次数，blocked 才追加有序问题证据。界面只有“关闭”，不提供检查、修复或发布按钮；使用 Obsidian 字体、颜色 token 和规则线，没有通用卡片、渐变、阴影、动画、历史或第二套导航。

1.23.0 是证据生成边界优化，不增加第二张界面。既有 `AUTHOR INTENT / LOCAL EVIDENCE`、`DRAFT → PUBLIC`、三态状态和 `TYPE / DATE / MEDIA / LINKS` 原样保留；等待文案继续只承诺读取当前路径，不展示虚构的扫描百分比。插件收到的聚焦 JSON 必须只有一个 entry，完整全库报告不能伪装成当前摘要。这样性能变化不会改变作者的判断模型，也不会借“更快”增加按钮、自动发布、进度条、动画或另一套视觉状态。

1.24.0 在原 ledger 下增加同一视觉语法的 `LINK TRACE / n VERIFIED`。每行按首次出现顺序显示 `POST / PROJECT / SELF`、精确公开路径（含原 fragment）、`L<n>` 源码位置和重复时的 `×n`；路径是 `<code>` 文本，不是可点击导航。trace 复用宿主字体、颜色 token、规则线和移动端单列降级，不新增卡片、色板、阴影、动画或操作按钮。作者看到的是“来源行 → 已验证公开目标”的审计轨迹，而不是第二个链接管理器。

1.25.0 在同一作者意图页、`LINK TRACE` 之前增加 `MEDIA TRACE / n ATTACHMENT(S)`。每项用 transformation tape 表达 `source → REPOSITORY target → PUBLIC URL`，再以输入/输出双列规格显示格式、宽高、帧数与字节；状态只取 `OPTIMIZED / SAVED|ADDED`、`PRESERVED / BYTE-STABLE` 或 `UNPROVEN / MEDIA ENVELOPE UNAVAILABLE`。它继续复用宿主字体、既有 trace 色和垂直规则线，窄屏把输入/输出折为单列；没有新色板、卡片、渐变、阴影、动画、点击、上传、修复或发布动作。作者看到的是发布器已经证明的媒体变换，不是第二个资产管理器。

1.26.0 在每条既有 transformation tape 前插入紧凑的来源账本：`COVER / BODY`、`L<n>` 行号与重复时的 `×n`。同一附件可同时拥有两个用途，顺序固定为封面后正文；窄屏来源账本折为单列。它延续 Evidence Rail 的事实密度、宿主等宽字体和现有边界，不新增卡片、颜色、动作、导航或动画。作者先确认“这张图在草稿哪里、如何使用”，再确认“它将如何变换”。

1.27.0 在同一来源账本中把每次使用展开为 `ALT · L<n> → 最终替代文本`，行号与文本一一配对，避免聚合后的多条描述失去来源。空值不隐藏也不伪造文案，而是显示 `EMPTY · WILL FAIL`，只借用宿主已有错误色；其余文本继续使用 muted ink 并允许长内容换行。没有新增卡片、编辑器、生成按钮或提示动画，作者看到的仍是发布器已经确定的最终语义。

1.28.0 把来源身份直接并入同一标签：`ALT · L<n> · AUTHORED` 表示 Markdown alt、Wiki display 或正式 coverAlt，`ALT · L<n> · FILENAME FALLBACK` 表示 Wiki 图片只提供文件名或尺寸。回退值保留真实最终文本并追加 `WILL FAIL`，复用与空值相同的宿主错误色；没有新增 badge、状态卡、按钮、字体或色板。这样信息顺序仍是“使用位置 → 描述来源 → 最终文本 → 媒体变换”，作者不会把看似非空的文件名误认为已通过可访问性检查。

1.29.0 让这个技术标签本身成为原生按钮，而不是在媒体项或页脚再增加一个 CTA。透明 reset 保持原账本布局，常态下划线表达可操作性，hover 使用宿主文字强调色，`:focus-visible` 使用宿主交互描边；执行中的 disabled 只表达单航班状态。可访问名称同时包含来源行、来源类型与最终替代文本。没有新卡片、颜色、字体、阴影或动效，媒体证据仍然是界面主体。

1.30.0 把 LINK TRACE 的聚合行号展开为同一视觉语法的 `REF · L<n>`，而不让公开目标代码块承担双重动作。REF 复用 ALT 的透明按钮、下划线、宿主 hover/focus 和执行中 disabled；多次引用保留原 `×n` 计数，可访问名称同时说出行号、POST/PROJECT/SELF 与最终目标。宽屏保持“类型 / 目标 / occurrence”三列，窄屏折成单列；没有新色板、卡片、页脚动作或动画。

## 404 恢复路口

未知地址使用“断裂的工程轨迹 + 四路恢复账本”，不使用居中插画、通用错误卡或自动返回首页。首段以超大 Signal `404` 标记断点，旁边明确显示 `404 / Not Found` 与 `No redirect`；第二段按 `KEYWORD / TIME / NOTES / BUILDS` 给出搜索、档案、文章和项目四条原生链接。视觉顺序先承认错误事实，再让读者按仍掌握的线索恢复，而不是复制整套主导航。

桌面维持两列规则线与 Evidence Rail 的紧凑密度；`≤55rem` 折成上下结构，`≤42rem` 把路径条目收敛为单列且不产生页面横向滚动。深色复用全站 Paper/Ink/Signal/Trace Token。打印隐藏箭头和首页动作，保留状态、说明、四条路径及 `href`；每条路径避免跨页断裂。页面没有动画、插画、客户端状态或“成功”色，错误状态与恢复能力同时通过文字、结构和规则线表达。

## 站点图标

`app/icon.png` 为 `256 × 256` PNG，只保留 Commit Trace 的节点、轨迹环与信号色半环，不包含文字、缩写或第二套标志。图标以社交分享卡为风格参考生成，再确定性缩放并纳入尺寸与体积测试；它用于小尺寸识别，不替代首页的工程轨迹签名。

## 明确排除

- 终端窗口、代码编辑器边框和命令行角色扮演；
- 仪表盘卡片堆叠、装饰性密集网格和玻璃拟态；
- 紫色渐变、黑底荧光绿和无语义的发光效果；
- 不能对应真实项目状态的进度、时间或统计数字。
