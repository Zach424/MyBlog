# Iteration 0108：纯内容结构化数据生成器

## 1. 范围与成功标准

本轮只处理 iteration 0107 留下的实现边界：文章 `BlogPosting` 与项目 `SoftwareSourceCode` 虽然已经拥有稳定 `@id` 和站点引用，但完整对象仍分别内联在两个页面中。本轮将两类文档提取为纯 TypeScript 生成器，用对象级测试固定全部已有字段、字段顺序、可选值序列化和输入不变性。

成功标准是：两条详情路由只负责收集已验证记录、canonical、站点 origin 与可选封面 URL；生成器继续复用 `createContentStructuredIdentity()` 和 `SITE_LANGUAGE`；标题、描述、发布日期、复核日期、标签、主页面、图片、作者、仓库与技术栈完全不漂移；无图片或仓库时对象内保留 `undefined`，JSON 序列化后省略对应属性；调用方数组和 URL 不被修改；实际 HTML、可见 UI、客户端代码、数据库、内容字段和公开事实均不变化；真实 Next、浏览器、生产 smoke 与现有预算全部通过，九路 HTML 原始字节若不变则不得重置生产基线。

## 2. 项目结构状态

- `lib/content/structured-data.ts`：新增文章、项目两个完整结构化文档纯生成器，并集中现有作者对象、URL 克隆、语言和内容身份复用；
- `app/posts/[slug]/page.tsx`：删除内联 `BlogPosting` 对象，改为调用 `createBlogPostingStructuredData()`；
- `app/projects/[slug]/page.tsx`：删除内联 `SoftwareSourceCode` 对象，改为调用 `createSoftwareSourceCodeStructuredData()`；
- `tests/content-structured-data.test.mjs`：新增精确对象、JSON 属性顺序、数组隔离、可选字段省略与页面边界测试；单元测试总数由 497 增至 501；
- `package.json`：把新测试纳入默认单元测试门；
- `README.md`、`docs/ARCHITECTURE.md`、`docs/DESIGN.md`、`docs/DISCOVERY.md`、`docs/QUALITY.md`、`docs/OPERATIONS.md`、`docs/ROADMAP.md`、`docs/STATUS.md` 与本文件：同步结构、设计、技术、功能、方法、验证、经验、风险和下一轮主线；
- `scripts/html-budget.mjs`：未修改。线上九路 raw 与 iteration 0107 基线完全相同，继续使用 `668d26fb347849eed477b8d81b5f4d9faa0b7393` 的有来源基线。

## 3. 设计内容

本轮没有可见设计变化。文章标题、项目标题、封面、正文、面包屑、分享、推荐、Reference ledger 与打印版式保持原样；生成器仍通过既有 `StructuredData` 服务端边界输出 JSON-LD，不增加状态徽章、作者卡、调试信息或客户端交互。

代码职责调整为一条明确的数据轨道：

```text
已验证 ContentRecord + canonical + origin + 可选封面
                         │
                         ▼
          纯结构化数据生成器
          ├─ BlogPosting
          └─ SoftwareSourceCode
                         │
                         ▼
          StructuredData 安全序列化
                         │
                         ▼
              原生 JSON-LD script
```

页面不再同时承担字段选择、身份派生、作者重复声明和序列化契约；纯函数也不引入新的抽象配置或通用 schema builder，避免把两个清晰的公开类型变成难以审计的动态映射。

## 4. 使用的技术

- TypeScript `Pick` 类型收窄与纯函数；
- 原生 `URL` 克隆、确定性对象属性顺序和 `JSON.stringify` 的 `undefined` 省略语义；
- Next.js 16.3 App Router Server Components 与原生 `<script type="application/ld+json">`；
- Schema.org `BlogPosting`、`SoftwareSourceCode`、`Person`、`CreativeWork` 字段；
- 既有 `SITE_LANGUAGE`、`createContentStructuredIdentity()` 与 `<` 安全转义边界；
- Node.js test runner、TypeScript、ESLint、Next production build、真实 SSR 测试、in-app Chromium 与 Vercel production smoke；
- 九路 HTML raw/gzip 与七路结构化发现预算；
- `research-iteration-loop` skill 用于失败优先、单一范围、部署证据和全局复盘；`browser` skill 用于真实 DOM 与 console 验收。

参考：[Schema.org BlogPosting](https://schema.org/BlogPosting)、[Schema.org SoftwareSourceCode](https://schema.org/SoftwareSourceCode)、[Schema.org Person](https://schema.org/Person)。实现前还完整读取了仓库安装版本的 Next.js JSON-LD 指南，继续使用原生 script 和既有 `<` 转义方案。

## 5. 实现的功能

1. `createBlogPostingStructuredData()` 统一生成文章完整 JSON-LD 文档；
2. `createSoftwareSourceCodeStructuredData()` 统一生成项目完整 JSON-LD 文档；
3. 两个生成器继续从共享身份函数取得 `<canonical>#content` 与 `<root>#website` 引用；
4. 文章字段固定为标题、描述、发布/复核日期、语言、标签、主页面、URL、可选图片和作者；
5. 项目字段固定为名称、描述、创建/复核日期、语言、标签、URL、可选图片、可选仓库、技术栈和作者；
6. 标签与技术栈数组会被复制，调用方记录不被生成结果持有或修改；
7. canonical 与图片 URL 会被克隆为字符串，调用方 URL 不被修改；
8. 可选图片和仓库在返回对象里保持显式 `undefined`，经 JSON 序列化后不会输出错误的空字段；
9. 两条页面源码不再出现内联 `@context`、作者、语言或身份拼装，后续字段演进只有一个生成边界；
10. 公开 HTML 与所有读者功能保持字节级不变，不增加客户端 bundle 或运行时请求。

## 6. 实现方法

先核对 Schema.org 两类类型的继承关系和当前字段适用范围，再完整读取安装版本的 Next JSON-LD 指南。随后创建测试并直接导入尚不存在的 `lib/content/structured-data.ts`；第一次目标测试按预期以 `ERR_MODULE_NOT_FOUND` 失败，证明测试先于实现约束了新边界。

实现中没有把已有页面对象机械搬到一个无类型函数，而是为文章和项目分别用 `Pick` 声明最小输入事实；共享输入只包含 `siteUrl`、`canonicalUrl` 与可选 `imageUrl`。生成器复用既有内容身份与语言常量，复制数组和 URL，并保留原对象属性顺序，使序列化结果与此前页面内联对象一致。两条页面只把已加载的 `post`/`project`、可信请求 origin、canonical 和封面描述器转换为生成器输入。

测试先精确比较完整对象和 `JSON.stringify` 结果，再主动修改返回数组证明调用方数据未被持有；无封面/仓库夹具同时验证对象键存在、值为 `undefined`，但最终 JSON 中没有对应属性；最后读取两条页面源码，阻止 `@context`、作者、语言或身份构造再次回流到路由。功能部署后使用稳定生产域名重复九路 raw/gzip 测量，raw 全部与旧基线一致，因此依据预算治理规则保留原基线，没有用无输出重构给自身重测量。

## 7. 验证证据

- 失败优先：新测试首次以 `ERR_MODULE_NOT_FOUND` 失败；
- 新生成器与站点身份目标测试：9/9；TypeScript 与 ESLint 均通过；
- Next production build：49 个页面成功；应用测试：23/23；
- 浏览器：代表文章、项目的全部 JSON-LD 字段与标题准确，文章无封面时不输出图片，项目图片/仓库/技术栈保持原值，内部页 `WebSite=0`，console 警告和错误为空；
- 完整 `npm run release:check`：173.4 秒，501/501 单元测试、49 个构建页面、23/23 应用测试、九路 HTML 与七路结构化发现预算全部 PASS，生产依赖审计 0；
- 功能提交：`025d477 feat(discovery): centralize content schema generation`；
- GitHub Actions：[Quality Gate #204](https://github.com/Zach424/MyBlog/actions/runs/31352813930) 与 [Verify Vercel production #196](https://github.com/Zach424/MyBlog/actions/runs/31352841092) 均成功；
- 稳定生产 smoke：24 个 Sitemap 路由成功、OAuth 302；
- 九路生产 raw 与 0107 基线逐项相同：`/` 27309、`/posts` 17862、代表文章 51784、代表项目 108029、专题 17511、标签 17332、搜索 36194、知识地图 35908、关于页 14912 B；gzip 实测仅在基线附近出现 -2 至 +1 B 的压缩波动，全部保有充足余量；
- 九路 HTML 基线继续固定为 `/` 27309/5993、`/posts` 17862/4250、代表文章 51784/12216、代表项目 108029/24464、专题 17511/4163、标签 17332/4134、搜索 36194/13825、知识地图 35908/7242、关于页 14912/3851 B（raw/gzip），来源提交仍为 `668d26fb`；
- 七路结构化发现也与既有基线一致：3009/921、3278/755、20697/9876、3238/1241、4527/504、155/127、700/462 B（raw/gzip）。
- 归档后最终 `npm run release:check`：120.2 秒，501/501 单元测试、49 个构建页面、23/23 应用测试、全部预算 PASS、生产依赖审计 0。

## 8. 经验与教训

1. 页面能正确输出 JSON-LD，不等于结构化数据已经有可演进的领域边界；完整对象生成器才能让字段变化被独立审查；
2. 重构结构化数据时必须锁定对象属性顺序。虽然 JSON 语义不依赖顺序，但顺序漂移会改变 HTML 字节、压缩结果和审计 diff；
3. `undefined` 的对象语义与序列化语义不同，两者都要测试，避免可选字段变成 `null`、空字符串或错误公开事实；
4. 纯函数不能保留调用方数组和可变 URL；否则后续测试或生成步骤可能产生跨页面污染；
5. 类型收窄应表达每个公开 schema 真正需要的事实，不要把完整 `PostRecord`/`ProjectRecord` 变成隐式依赖；
6. 页面源码边界测试能阻止未来开发者为了“方便”把字段重新内联，单靠生成器单测做不到；
7. 无输出重构不应重置性能基线。线上 raw 完全相同是保留旧来源基线的直接证据；
8. 生成器集中后，下一次增加字段可以先在一个纯函数上做失败测试，再决定是否值得改变生产 HTML 和基线。

## 9. 全局状态、风险与未解决问题

博客现有站点、内容和面包屑三类结构化数据都已有独立纯生成边界：主页负责唯一 `WebSite`，文章/项目生成器负责完整内容节点，四类详情的可见路径负责 `BreadcrumbList`。搜索、推荐、知识图、Feed、清单、源文、Studio、Obsidian、Git/Vercel 交付与生产预算均保持稳定。

iteration 0107 的“完整内容对象仍内联”风险已经关闭。仍需保留的结构化风险是：作者 `Person` 目前只集中复用现有姓名和 GitHub URL，没有独立稳定 `@id` 或 ProfilePage；在所有者没有确认更多人物事实前不扩充。内容身份仍有意要求 canonical 与站点同 origin；转载或外部 canonical 必须先定义作品与本地页面身份。集合页 `ItemList` 的收益仍弱于维护成本，继续暂缓。gzip 在同一 raw 正文上可能因响应/压缩环境产生极小波动，预算判断继续以有来源基线和阈值为准，不能要求每次字节完全相等。

长期风险保持不变：首次真实 Obsidian 主题与本机代理的人机验收、Decap 开发依赖上游高危项、Actions 不可变 pin 主动复核，以及自定义域名、统计、评论和公开邮箱的所有者选择。

## 10. 下一轮唯一主任务

在新的文章纯生成器中复用内容管线已经计算并在页面可见的 `wordCount` 与 `readingMinutes`，为 `BlogPosting` 增加整数 `wordCount` 和 ISO 8601 Duration `timeRequired`（例如 `PT8M`）。先用失败测试锁定正整数、分钟到 Duration 的确定性映射、真实 SSR 与生产输出，再在功能部署后重测代表文章 HTML 基线。Schema.org 明确把 [`wordCount`](https://schema.org/wordCount) 用于 Article/CreativeWork，把 [`timeRequired`](https://schema.org/timeRequired) 定义为 CreativeWork 的 Duration；本轮只记录主线，不提前实现，也不增加 frontmatter、可见 UI、客户端代码、数据库或未经验证的阅读事实。
