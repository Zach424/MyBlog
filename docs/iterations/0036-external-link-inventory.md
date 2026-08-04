# Iteration 0036：外部 HTTPS 链接库存与受控健康检查

## 1. 范围与成功标准

项目继续服务同一目标：作者不依赖 Codex 即可发布和维护 Markdown 技术记录，读者看到的链接、附件、引用关系和生产版本都有可审计证据。Iteration 0035 已建立站内知识地图，但公开正文里的外部依赖仍只存在于作者人工复核清单，没有确定性库存；直接把网络爬取加入构建又会让 DNS、限流和临时故障污染内容质量。

本轮只闭合“普通外部 HTTPS 链接库存 + 作者显式健康检查”这一条纵切：用与站点一致的 GFM AST 从公开正文提取链接、来源、正文相对行、标签和次数；默认完全离线；显式 `--check` 才在协议、端口、DNS、并发、超时、重试和重定向边界内发送 HEAD。不得下载/保存第三方正文、不得自动改写链接、不得访问私网、不得把临时网络失败接入默认构建硬门或 GitHub Actions。

## 2. 项目结构状态

- `lib/content/external-links.ts`：GFM 外链抽取、规范化、issue、报告模型、公网目标防护、固定地址 HEAD、重定向/重试/状态分类与文本格式；
- `scripts/report-external-links.mjs`：`links:external` CLI，支持 text/JSON、显式检查、资源边界和可选 broken 退出码；
- `tests/external-links.test.mjs`：抽取、隐私、排序、IPv4/IPv6、DNS、状态、重定向、超时、重试、参数和真实 CLI；
- `package.json`、`package-lock.json`：声明与渲染一致的 `mdast-util-gfm`/`micromark-extension-gfm` 直接依赖，加入 108 项单元测试、本地命令与 `release:check`；
- `tests/deployment-tools.test.mjs`：锁定外链脚本、本地发布候选连接和“不进入 Actions”的边界；
- 根 README、架构、内容模型、发布、质量与运维文档：同步作者命令、状态语义和安全边界；
- `docs/STATUS.md`、`ROADMAP.md` 与本文件：仓库根 Obsidian Vault 的全局状态、经验和下一主线归档。

## 3. 设计内容

这是维护证据设计，不是网络爬虫。默认输出先说明“本地确定性库存”，再给公开记录数、有外链记录数、唯一 HTTPS URL、出现次数和本地 issue；每个 URL 下列内容源、`正文第 N 行` 和可见标签。排序固定为 URL → sourcePath → bodyLine → label，同一 URL 的重复出现和跨来源不会丢失。

实时模式必须由作者显式增加 `--check`。结果分三层：`healthy` 是 HEAD 2xx；`restricted`、`method-unsupported`、5xx、timeout、network-error 是“暂不可确认”；404/410、其他确定 4xx、unsafe、redirect-error 才是“已确认异常”。默认不因任何结果返回失败；只有作者同时使用 `--fail-on-broken` 才让确定 broken 或本地 issue 非零。报告尾部明确说明只发 HEAD、不下载正文、不自动修复，避免把当前网络视角冒充长期事实。

## 4. 使用的技术

- `mdast-util-from-markdown` + `micromark-extension-gfm` + `mdast-util-gfm`：与 `remark-gfm` 阅读页一致地识别行内、引用式和裸 HTTPS URL；
- Node `dns/promises.lookup({ all: true, verbatim: true })`：取得全部地址并 fail-closed 检查；
- Node `net.BlockList` / `isIP`：分别维护 IPv4 与 IPv6 私网、回环、链路本地、文档、组播和保留网段；
- Node `https.request`：只发 HEAD，把 TCP/TLS 连接固定到已验证公网 IP，同时用原 hostname 做 SNI/Host；
- 手动重定向：每一跳重新验证 HTTPS、443、无凭据和 DNS，拒绝协议降级；
- 有界 worker pool、请求 timeout、0–2 次瞬时重试、0–10 跳重定向；
- Node `parseArgs`、原生 test、真实 CLI、ESLint、TypeScript、Next 生产构建、GitHub Actions、Vercel 与稳定域名冒烟；
- research-iteration-loop skill 把范围固定在证据生成和显式检查，没有顺手接入定时云爬取。

## 5. 实现的功能

- 从普通 Markdown/GFM 链接、引用式链接和裸 URL 提取 HTTPS；图片、行内/围栏代码、站内路径、纯锚点与 mailto 被忽略；
- URL 按标准解析器规范化，保留路径、查询和 fragment；相同规范 URL 聚合出现次数和唯一来源数；
- HTTP、协议相对、无效 HTTPS 和含 username/password 地址进入结构化本地 issue；报告清除凭据后才保存/显示 URL；
- 当前真实公开集合：4 条记录、1 条含外链记录、1 个 HTTPS URL、1 次正文出现、0 个本地问题；
- 默认 `npm run links:external` 和 JSON 输出不访问网络、不改变仓库；已纳入本地 `release:check`；
- `--check` 支持 timeout/concurrency/retries/max-redirects，所有范围都有上下限；
- DNS 任一结果非公网即拒绝；本地/`.localhost`/`.local`/`.internal`/`.home.arpa`、非 443、凭据和 HTTPS 降级全部 fail-closed；
- 多个安全 DNS 地址按 IPv4 优先和稳定地址排序，在重试间轮换，避免只固定一个不可达地址；
- HEAD 响应到达即关闭；不以 GET 兼容不支持 HEAD 的服务器；
- 只有确定 broken 参与 `--fail-on-broken`，超时、网络、5xx 和自动访问受限保留为人工复核证据；
- 实时检查有意不接入 Quality Gate/每周 Actions，CI 仍只验证实现契约。

## 6. 实现方法

每条公开 `ContentRecord.body` 以 GFM 扩展构造 mdast。第一遍建立 definition 表，第二遍只访问 `link`/`linkReference`；AST 天然排除 code 和 image。每个 occurrence 记录 `sourcePath`、`sourceTitle`、公开 URL、正文相对行和压缩后的可见标签。因为内容解析器会剥离 frontmatter，行号明确命名为 `bodyLine` 并显示“正文第 N 行”，不伪装成源文件绝对行。库存函数不读取文件、不看系统时间、不请求网络，输入顺序变化不影响结果。

安全检查先验证 URL scheme/credentials/port/hostname，再解析全部 DNS。IPv4 与 IPv6 使用独立 BlockList，防止 Node 对 IPv4-mapped IPv6 的归一化让两个地址族互相污染；只要一个结果属于非公网范围就拒绝整个目标。通过后选择确定性公网地址，把 `https.request.hostname` 固定为 IP，`servername` 和 Host 保留原域名，因此请求阶段不会再次做不受控 DNS。重定向只读取响应状态和 Location，每跳重复同一守卫；响应对象随即 destroy。

检查 worker 按库存稳定下标写回，完成顺序不影响 JSON。瞬时状态仅对 timeout/network/5xx/408/429 重试，延迟上限 1 秒；重试次数和 DNS 地址索引同步，使多地址目标不会永远使用同一地址。最终 counts 分 healthy/attention/broken，`externalLinkReportHasBrokenEntries` 只认确定 broken 和本地 issue。

## 7. 验证证据

- 专项外链 + 交付连接最终 12/12 通过；选定文件 ESLint 与 TypeScript 通过；
- 完整 `npm run release:check`：配置完整、Current 1/Historical 3/未公开 0、inbox 0/0/0、根暂存媒体 0、外链库存 1 URL/1 occurrence/0 issue；
- 同一发布候选通过 ESLint、108/108 单元测试、TypeScript、36/36 构建页面、17/17 真实生产 HTTP/质量测试；
- `npm audit --omit=dev --audit-level=high`：0 vulnerabilities；`git diff --check`：通过；
- 抽取夹具覆盖 GFM 裸 URL、行内/引用式、重复、图片/代码/站内/邮件忽略和输入顺序确定性；
- 安全夹具覆盖 IPv4/IPv6 公网与私网/回环/链路本地/保留范围、localhost/internal、HTTP、凭据、非 443、纯私网与公网+私网混合 DNS；
- 网络夹具覆盖 301 相对跳转、HTTPS→HTTP 降级、最大跳数、403、404、405、持续/瞬时 503、timeout、socket error、重试和资源参数上限；
- 真实 CLI JSON 运行前后 `git status --porcelain -z` 完全一致；默认库存没有网络副作用；
- 真实默认探针检查 `https://github.com/Zach424/MyBlog`：HEAD 200、healthy、attempts 1，证明固定公网地址 + SNI 路径可工作；
- 当前稳定 Vercel URL 的显式直连检查两次各 5 秒后 timeout，被正确分类为 attention、broken=0、进程成功；同一稳定 URL 随后通过完整生产冒烟，证明单一 DNS/网络路径超时不能冒充链接失效；
- 实现提交 `681f191d2869192d72a542ad1220426086c9ba0f` 已推送 `main`；GitHub Quality Gate `30945915192` completed/success；
- GitHub Production deployment `5750663393` state=success（`https://blog-9p19s1lur-czq1.vercel.app`）；`Verify Vercel production` `30945961879` 精确绑定实现 SHA且 completed/success；
- 稳定域名独立冒烟：`24 routes, OAuth 302`；网络命令的代理只在当前进程设置，未写入永久配置。

失败与修复证据：第一版把 IPv4 和 IPv6 保留网段加入同一个 Node `BlockList`；Node 会用 IPv4-mapped IPv6 归一化检查，`::/96` 因而误伤所有公网 IPv4，4 个专项用例失败。实现改为两个完全独立的 BlockList，没有删除任何受保护网段，最终公网/私网测试通过。地址轮换加入后，直接把三参数 `guardExternalLinkTarget(target, lookup, index)` 赋给二参数依赖接口，TypeScript 正确发现第二参数从 lookup 变成 index 的不兼容；改为显式 wrapper 注入默认 lookup 后通过。

最初 occurrence 字段叫 `line`，真实 CLI 输出 `content/projects/myblog.md:3`，但 3 是剥离 frontmatter 后的正文相对行，源文件实际位置是 21；字段改名 `bodyLine`，文本明确显示“正文第 3 行”，没有制造假精度。当前 Vercel 域名的本机直连 DNS 返回 `2a03:...` 与 `199.59...` 两个与 Vercel 不相符的公网地址，固定地址 TLS/HEAD 超时；这证明“全部公网”只解决 SSRF，不保证观察路径可信。工具保留 timeout 证据但不判 broken；稳定站真实可用由独立代理路径生产冒烟证明。安装 GFM 直接依赖时 npm 全依赖审计仍显示 Decap 开发树既有 high 项，production-only 审计为 0；没有运行 `audit fix --force`。

## 8. 经验与教训

- 外链库存与外链健康必须是两个模式：前者可复现，后者只能是带时间和网络视角的观察；
- 只检查“解析出的第一个 IP 是公网”不足以防 SSRF，全部 DNS 结果和每个重定向目标都必须 fail-closed；
- 安全地址族表要分别实现和测试；库内部的地址归一化可能改变看似直观的网段语义；
- DNS 固定能降低 rebinding，却不能修复本地 DNS 污染；因此超时/网络/5xx 不应默认等于内容错误；
- 不支持 HEAD 是目标能力差异，不应为了“变绿”退回 GET 并违背不抓取正文的承诺；
- 行号只有注明坐标系才是证据；解析后正文行不能冒充原文件绝对行；
- 隐私边界要在数据模型入口执行，含凭据 URL 即使已公开也不应再次进入日志和 JSON；
- 定时 Actions 不是所有维护工具的自然终点；当误报来源仍受 CI 网络影响时，保持本地显式运行比制造持续 warning 更诚实。

## 9. 全局状态、风险与未解决问题

公开阅读、站内知识图、正文外链库存、双作者入口、内容契约、内容维护、永久 URL、inbox readiness、媒体门禁/引用/展示、自动交付和恢复均可用。作者现在能离线看到正文 HTTPS 外部依赖，并按需取得不下载正文、拒绝私网的当前健康证据。

剩余主要风险：实时检查依赖作者当前 DNS/网络路径，本机对稳定 Vercel 域名的直连 DNS 已展示假阴性，因此不进入 Actions；frontmatter 的 `repository`/`demo`/`canonical` 是结构化字段，不属于本轮正文普通链接库存，仍由内容 schema 和维护清单复核；现有站内链接会验证目标内容存在，但 fragment 是否对应真实标题尚未构建期校验；知识地图扩容、Studio 同名附件、Git 媒体历史、Decap 固定 bundle/开发依赖审计、宽 OAuth scope、CSP 例外、Hobby 回滚、自定义域名、统计、评论和外部提醒保持既有状态。

## 10. 下一轮唯一主任务

建立站内标题锚点完整性门禁。扩展现有 Markdown 关系校验，让 `/posts/<slug>#fragment`、`/projects/<slug>#fragment` 和 Obsidian 转换后的标题链接必须命中目标正文实际渲染的 heading id；覆盖中文/英文、URL 编码、重复标题、H2–H6、自引用、引用式/行内链接和代码忽略。错误必须指向来源内容与原 fragment，构建/发布在坏锚点进入生产前失败；详情页关系仍按内容 URL 去重，fragment 只承担深链完整性，不另存索引或改变公开 URL。不得引入浏览器爬取、客户端修复或自动模糊匹配。
