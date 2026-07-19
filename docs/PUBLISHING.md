# 自助发布指南

## 发布模型

网页后台、Obsidian 和普通 Git 编辑器都操作同一个 GitHub 仓库。文章没有数据库副本：草稿、附件、版本和回滚都可以在 Git 历史中找到。main 的精确提交通过质量门后由所有者 Cloudflare 自动部署。

## 首次启用网页后台

等所有者 Cloudflare Worker 获得稳定 origin 后，只需配置一次：

1. 在 GitHub `Settings → Developer settings → OAuth Apps` 创建 OAuth App；
2. `Homepage URL` 填博客的新 Cloudflare origin；
3. `Authorization callback URL` 填 `<origin>/api/cms/callback?provider=github`；
4. 在仓库 `production` Environment 增加 `GITHUB_OAUTH_ID` 和 `GITHUB_OAUTH_SECRET`；
5. 同一 Environment 保存 `CLOUDFLARE_ACCOUNT_ID` 与 `CLOUDFLARE_API_TOKEN`；
6. 仓库变量设置 `CLOUDFLARE_DEPLOY_ENABLED=true`，手动运行一次部署；
7. 打开 `<origin>/studio`，使用对 `Zach424/MyBlog` 有写权限的 GitHub 账号登录。

所有 secret 只进入 GitHub Environment 和 Cloudflare Worker。不要把值放进 `.env.example`、文档、截图、聊天或提交历史。

## 在网页后台发布文章

1. 打开 `/studio`，进入“文章与 TIL”，选择“新建文章”；
2. 填写标题和稳定 Slug。Slug 只使用小写字母、数字、连字符，发布后不要修改；
3. 填写摘要、类型、发布日期、1–5 个标签，正文可以在富文本与 Markdown 源码间切换；
4. 新内容默认 `draft: true`，可随时保存。Editorial workflow 会为草稿建立分支和 pull request，不直接覆盖生产；
5. 在预览中检查标题层级、代码块、图片和链接；
6. 准备公开时关闭“草稿”，确认没有把草稿设为首页精选，然后选择发布；
7. GitHub 合并后自动运行质量门和部署。检查通过并完成线上冒烟后，本次发布才结束。

项目复盘使用“项目复盘”集合，额外填写状态、技术栈、源码和演示地址。

## 图片

后台上传文件保存到 `public/uploads`，正文引用 `/uploads/<file>`。单个文件限制 5 MiB；文件名使用小写 ASCII、数字和连字符，优先 WebP/AVIF/JPEG/PNG。不得上传密钥、个人证件、包含私密窗口的截图或未获许可素材。

## 常见恢复方式

- 登录按钮提示 OAuth 未配置：检查四个 GitHub Environment secrets，并重新运行部署；
- GitHub 显示仓库不存在：确认登录账号对 `Zach424/MyBlog` 有写权限；
- 发布检查失败：打开 Actions 中失败步骤，按具体内容字段或链接提示修改草稿；
- Slug 不一致：保持文件名和 frontmatter `slug` 相同；已发布内容不要通过改名修复，应先设计重定向；
- 线上内容没有变化：确认 pull request 已合并、Deploy workflow 成功，且查看的是新 Cloudflare origin。
