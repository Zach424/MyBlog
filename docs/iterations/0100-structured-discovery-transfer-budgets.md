# Iteration 0100：结构化发现端点传输预算

## 1. 范围与成功标准

本轮只关闭 Iteration 0099 选定的规模证据缺口。九条关键 HTML 已有可解释的 raw/gzip 预算，但 `/content.json`、`/content.schema.json`、`/feed.json`、`/rss.xml`、`/sitemap.xml`、`/robots.txt` 只有临时体积观察，没有冻结基线、推导上限、覆盖检查或生产报告。JSON Feed 携带全文，最容易随内容线性增长；其余端点也会随内容、路由或 Schema 演进增长。

成功标准是：从稳定生产的同一次快照测量六端点完整正文；定义同时约束 raw 与 gzip 的逐端点预算；本地真实 Next 应用与生产冒烟复用同一纯函数并逐项报告；漏测、重复、意外端点、可压缩 raw 膨胀和高熵 gzip 膨胀都失败关闭。预算不得改变响应正文、内容集合、Feed/清单协议、缓存、Obsidian、Studio、部署配置或任何外部服务。

## 2. 项目结构状态

- `scripts/discovery-budget.mjs`：新增稳定生产 origin、基线 provenance、raw/gzip 策略、逐端点基线/上限、测量、格式化、覆盖和失败断言；
- `tests/discovery-budget.test.mjs`：新增策略推导、双层通过/失败、报告、覆盖和来源固定 7 项测试；
- `scripts/smoke-production.mjs`：六个既有响应正文进入预算器，返回并输出 `discoveryBudgetReports`；
- `tests/rendered-html.test.mjs`：真实 Next 进程在既有发现契约测试中测量相同六端点并输出诊断；
- `tests/deployment-tools.test.mjs`：锁定生产烟测必须连接格式化、覆盖和失败断言；
- `package.json`：把新测试纳入 `test:unit`；依赖和 lockfile 未改变；
- README、架构、发现、运维、质量、状态、路线图与本归档同步更新；Route Handler、响应正文、内容 Markdown、Studio、插件 bundle、workflow 和 Vercel 配置未改变。

## 3. 设计内容

基线来自 2026-08-10 稳定生产提交 `67e7848ad116c0c919e630acba834d81fd4b3514`。测量显式请求完整正文，raw 使用 `Buffer.byteLength`，gzip 使用 Node `gzipSync(Buffer.from(body))`；它是可复现的传输代理，不声称等于 Vercel Brotli、TLS、响应头或真实用户网络成本。

每个端点有独立 raw 和 gzip 上限：

- raw：`baseline + max(50%, 4096 B)`，再向上取整到 `1024 B`；
- gzip：`baseline + max(50%, 1024 B)`，再向上取整到 `512 B`。

50% 允许正常内容演进，最小字节余量避免小端点因少量合法 metadata 频繁触线；取整让阈值易读、可审计。与 HTML 的统一 raw emergency ceiling 不同，结构化正文应同时受逐端点 raw/gzip 约束：大量重复空白/字段不能只靠压缩率过门，高熵正文也不能只靠 raw 总量过门。

本地应用继续使用 `blog.example.test` 验证 origin 派生契约，生产烟测使用实际输入 origin；较短测试域名会让正文略小，但二者共享由稳定生产推导的上限。覆盖集合固定六项，顺序只服务报告可读性；断言按路径计数，因此漏测、重复和意外路径都会指出精确集合差异。

## 4. 使用的技术

- Node `Buffer.byteLength`：最终 JavaScript string 的 UTF-8 raw 字节；
- Node `zlib.gzipSync`：同版本 Node 下的确定性 gzip 传输模拟；
- 冻结 provenance：稳定生产 origin、测量日期和完整来源提交；
- 纯函数 limit derivation：比例、最小余量与取整均显式常量；
- Node test deterministic SHA-256 noise：区分高度可压缩 raw 增长与高熵 gzip 增长；
- 真实 Next production server 与稳定 Vercel origin：相同报告器的本地/线上双证据；
- `research-iteration-loop` skill：单一任务、失败优先、定向/集成/全门、生产、全局复盘和唯一下一步。

## 5. 实现的功能

1. 六个结构化端点各有 raw/gzip baseline 与推导 limit；
2. 输入正文一次生成 raw、gzip、两层余量、两层状态与总状态；
3. `[discovery-budget]` 首行输出 origin、revision、日期和完整策略；
4. 每个端点输出实际值/上限、带符号余量、基线和 PASS/FAIL；
5. 可压缩正文 raw 超限时失败，即使 gzip 很小；
6. 高熵正文 gzip 超限时失败，即使 raw 仍在上限内；
7. 六项必须恰好各测一次，missing/unexpected/duplicate 都失败；
8. 预算失败异常包含完整报告，Actions/本地终端可直接定位；
9. 本地真实应用通过 `context.diagnostic` 输出六行证据；
10. `production:smoke` 在九路 HTML 报告之后输出六路发现报告，并由 deployment status 工作流自动执行。

## 6. 实现方法

先从生产逐端点读取完整正文，冻结 raw/gzip：清单 3009/921 B、Schema 3278/755 B、JSON Feed 20697/9876 B、RSS 3238/1241 B、Sitemap 4527/504 B、robots 155/127 B。随后先写 `tests/discovery-budget.test.mjs`，导入尚不存在的模块，测试按预期以 `ERR_MODULE_NOT_FOUND` 失败。

实现纯预算模块后，首次测试有 1 项失败：报告断言把 provenance 的八位短提交误写成七位，并把 fixture gzip 上限误算成 2560 B；实际公式是 `1000 + max(500,1024) = 2024`，向上取整到 512 B 得 2048 B。修正测试预期后 7/7 通过。这个失败没有通过改实现迎合错误期望，而是重新手算公开策略并保留实现。

集成阶段不重复请求端点：既有真实应用/生产烟测已经读取六份正文，预算器只消费这些最终 string。生产 smoke 在任何协议解析之后、内容集合比较之前生成报告；预算断言自己的异常包含完整证据。基线对象深冻结，且测试锁定所有数值、上限、来源提交和稳定生产地址，避免门自动追随当前输出自我放行。

## 7. 验证证据

- 失败优先：新测试最初以 `ERR_MODULE_NOT_FOUND` 找不到 `scripts/discovery-budget.mjs`；
- 预算模块定向测试：7/7 通过；
- 预算 + 部署工具定向回归：12/12 通过；
- 独立 TypeScript、Next build 与真实应用测试：48 个构建页面，20/20 通过；
- 功能提交前稳定生产：24 个 Sitemap URL、OAuth 302、九路 HTML 和六路发现预算全 PASS；
- 首次完整 `npm run release:check`：113.4 秒，478/478 单元测试、48 个构建页面、20/20 应用测试、九路 HTML 与六路发现预算全 PASS、生产依赖审计 0；
- 状态、路线图与本归档写入后第二次完整 `npm run release:check`：116.6 秒，同样保持 478/478、48 个构建页面、20/20、十五路预算全 PASS 与生产依赖审计 0；
- 内容事实保持：公开 4、Current 1、Historical 3、草稿 0、根暂存附件 0、本地外链问题 0；
- 功能提交：`8bee6a7cc80fa4a96bd22c62739ded5ddf78f55d`；
- [Quality Gate #187](https://github.com/Zach424/MyBlog/actions/runs/31340336024) 与 [Production Smoke #180](https://github.com/Zach424/MyBlog/actions/runs/31340359648) 均成功；
- 功能部署后的独立生产烟测再次输出六行 PASS：raw 最小余量为清单 +4159 B，gzip 最小余量为 Sitemap +1032 B；JSON Feed raw/gzip 余量为 +11047/+4972 B；
- 生产响应正文与 0099 基线逐字节体积一致，证明本轮没有隐式改变公开协议。

## 8. 经验与教训

“记录当前大小”不是预算。有效预算还需要来源、明确增长规则、完整覆盖和失败行为；否则每次把 baseline 改成当前值只是在自动批准回归。来源提交必须指向被测生产正文，而功能提交可以晚于来源提交，只要功能本身不改变正文并由部署后测量证明一致。

raw 与 gzip 回答不同问题。raw 限制解析/内存/异常解压后的正文规模，gzip 近似传输成本；高度重复的巨大 JSON 可以 gzip 很小，高熵内容可以 raw 尚可但传输昂贵。结构化端点体量远小于 HTML，不适合复用 160 KiB 统一 emergency ceiling，逐端点双层规则更诚实。

测试也必须服从公式。人手写入的预期短 SHA 位数和取整数值都可能错；遇到失败应重新按公开公式计算，而不是随意调整实现或阈值。报告把公式参数、baseline、limit 和 signed headroom 同时展示，使这类错误可复核。

## 9. 全局复盘与候选任务

本轮结束后用代码、生产响应头、状态风险和用户无需手动操作的约束复盘三个候选：

1. 为 JSON Feed、RSS、Sitemap、robots 补充确定性 SHA-256 ETag 与条件 304；真实生产四端点均没有 ETag/Last-Modified，而清单、Schema、单篇 Markdown 已有成熟 helper；
2. 新增 OpenSearch description 和根页面 search discovery；它能改善浏览器搜索集成，但当前四条内容和站内搜索已经可用，收益低于现存缓存不一致；
3. 移除 CSP `'unsafe-inline'` 并采用 nonce；安全价值高，但会改变全部页面的渲染/缓存动态性和 Next 部署边界，需要独立设计审计，不适合作为预算后的最小一步。

选择候选 1。它有直接线上缺失证据，可复用已经验证的 `http-validators`，不改正文或作者流程，且能让所有主要结构化端点具备一致的增量读取语义。候选 2 保留为后续产品发现功能；候选 3 先做专门的架构/性能可行性评估再实施。

## 10. 风险、回滚与下一轮

预算不是业务配额，也不应阻止正常写作。新增文章若触线，先检查是有价值的正文增长、意外序列化、重复数据还是高熵泄漏；只有第一种且经过真实生产测量时才更新 baseline/provenance。域名变化会改变全部绝对 URL 字节，必须以新稳定 origin 重建六项基线。gzip 模拟不替代 CDN Brotli 或真实用户观测。

回滚本轮功能可执行 `git revert 8bee6a7cc80fa4a96bd22c62739ded5ddf78f55d`。它会移除发现预算模块、报告和测试，恢复 0099 的无预算烟测；不会改变任何端点正文、内容、数据库、插件或外部配置。

下一轮唯一主任务：为 `/feed.json`、`/rss.xml`、`/sitemap.xml`、`/robots.txt` 增加由最终 UTF-8 响应字节生成的强 SHA-256 ETag，并按现有 GET 弱比较语义支持精确/弱/列表/`*` 的空 304。保持现有 MIME、正文和 cache-control TTL 不变；本地源站锁定完整 304 metadata，生产冒烟允许 Vercel 弱化 ETag/精简 representation metadata，但 opaque digest、缓存和零正文必须等价。
