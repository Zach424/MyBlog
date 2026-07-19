# 搜索与发布发现

- 状态：implemented in iteration 0006
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
- 缓存：1 小时 fresh，24 小时 stale-while-revalidate

RSS 对 XML 特殊字符统一转义，并从公开内容字段生成标题、摘要、分类和链接。根布局同时输出 RSS autodiscovery `<link>`。

## Sitemap

- URL：`/sitemap.xml`
- 包含：首页、文章、项目、专题、标签、搜索、关于、全部详情与派生索引页
- `lastmod`：内容使用 `updatedAt` 或 `publishedAt`；集合使用其最新公开内容日期
- 缓存：1 小时 fresh，24 小时 stale-while-revalidate

当前首批内容生成 23 个 URL。Sitemap 不包含草稿、未来日期、查询参数或 RSS/robots 端点本身。

## Robots

`/robots.txt` 允许抓取公开内容，声明当前请求主机和绝对 Sitemap URL，缓存 24 小时。`/studio` 与 `/api/cms/` 是作者发布工具而不是阅读内容，显式 `Disallow` 且不进入 Sitemap；访问控制仍由 GitHub OAuth 和仓库权限负责，robots 不被当作安全边界。

## 绝对 URL

页面元数据与三个发布端点共用 `lib/site.ts`。解析优先级为：

1. 托管环境显式设置的 `NEXT_PUBLIC_SITE_URL`；
2. Vercel/反向代理提供的首个 `x-forwarded-host` 与 `x-forwarded-proto`；
3. 请求 URL 或本地 `http://localhost:3000` 回退。

因此本地、预览域名和正式域名不需要维护多份 feed 或 Sitemap 配置。
