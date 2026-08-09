# 搜索与发布发现

- 状态：RSS/Sitemap/robots implemented in iteration 0006；JSON Feed 1.1 implemented in iteration 0088
- 目标：让公开内容可搜索、可订阅、可被搜索引擎发现，同时保持 Git 内容源和无数据库架构。

## 站内搜索

`lib/search.ts` 在构建阶段把所有公开文章、TIL 与项目转换为可序列化文档。Markdown 标题、链接、强调和 fenced code 标记会被清理，但可搜索的文字和代码内容保留。

查询先经过 Unicode NFKC 与小写规范化，空格分隔的多个词使用 AND 语义。排序权重依次偏向标题、标签、摘要和正文；同分时按发布日期与标题稳定排序。空查询返回全部公开内容，未知查询返回明确的空状态。

搜索页通过 `?q=` 接收初始查询并服务端输出首屏结果。后续输入在浏览器本地匹配，同时用 `history.replaceState` 更新可分享 URL，不产生网络搜索请求，也不使用分析服务。

## RSS

- URL：`/rss.xml`
- 格式：RSS 2.0 + Atom self link
- 内容：全部公开文章、TIL 与项目
- GUID：内容稳定绝对 URL
- 日期：`publishedAt`，频道更新时间取最新 `updatedAt` 或 `publishedAt`
- 缓存：源响应声明 1 小时 fresh、24 小时 stale-while-revalidate；Vercel CDN 会消费 SWR 指令，客户端线上响应因此只保留等价的 `public, max-age=3600`

RSS 对 XML 特殊字符统一转义，并从公开内容字段生成标题、摘要、分类和链接。根布局同时输出 RSS autodiscovery `<link>`。

## JSON Feed 1.1

- URL：`/feed.json`
- MIME：`application/feed+json; charset=utf-8`
- 内容：与 RSS 相同顺序的全部公开文章、TIL 与项目
- `id` / `url`：内容稳定绝对 URL
- 正文：复用搜索使用的 Markdown AST 纯文本管线，移除语法和 raw HTML 标签，保留可见文字、代码、公式源码与图片替代文本
- 日期：`publishedAt` / 可选 `updatedAt` 确定性映射到 UTC 零点 RFC 3339
- 媒体：站点 256×256 icon；有本地 cover 的 item 输出绝对 `banner_image`
- 缓存：1 小时 fresh，24 小时 stale-while-revalidate

Feed 顶层声明 JSON Feed 1.1 `version`、站点标题/说明、`home_page_url`、`feed_url`、`language: zh-CN` 和作者。item 只暴露公开阅读字段，不包含 `draft`、源文件路径或原始 Markdown body；若 Markdown 没有可见纯文本，使用公开摘要兜底。生成器、HTTP 和生产冒烟都要求 JSON Feed 与 RSS 的稳定内容 URL 顺序完全一致。根布局使用独立 `application/feed+json` alternate link 供订阅器发现，RSS 链接保持兼容。

## Sitemap

- URL：`/sitemap.xml`
- 包含：首页、文章、项目、专题、标签、搜索、关于、全部详情与派生索引页
- `lastmod`：内容使用 `updatedAt` 或 `publishedAt`；集合使用其最新公开内容日期
- 缓存：1 小时 fresh，24 小时 stale-while-revalidate

当前公开内容生成 24 个 URL。Sitemap 不包含草稿、未来日期、查询参数或 JSON Feed/RSS/robots 端点本身。

## Robots

`/robots.txt` 允许抓取公开内容，声明当前请求主机和绝对 Sitemap URL，缓存 24 小时。`/studio` 与 `/api/cms/` 是作者发布工具而不是阅读内容，显式 `Disallow` 且不进入 Sitemap；访问控制仍由 GitHub OAuth 和仓库权限负责，robots 不被当作安全边界。

## 绝对 URL

页面元数据与四个发布端点共用 `lib/site.ts`。解析优先级为：

1. 托管环境显式设置的 `NEXT_PUBLIC_SITE_URL`；
2. Vercel/反向代理提供的首个 `x-forwarded-host` 与 `x-forwarded-proto`；
3. 请求 URL 或本地 `http://localhost:3000` 回退。

因此本地、预览域名和正式域名不需要维护多份 Feed 或 Sitemap 配置。
