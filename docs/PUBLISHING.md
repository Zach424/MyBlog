# 自助发布指南

## 发布模型

网页后台、Obsidian 和普通 Git 编辑器都操作同一个 GitHub 仓库。文章没有数据库副本：草稿、附件、版本和回滚都可以在 Git 历史中找到。main 的精确提交通过质量门后由所有者 Cloudflare 自动部署。

首次启用账号、生产 origin 与切换步骤统一按 [MIGRATION.md](./MIGRATION.md) 执行；日常写作不需要再次配置密钥。

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

## 在 Obsidian 中写作和发布

### 首次打开

1. 安装 Obsidian 桌面版；
2. 选择“打开本地仓库/Vault”，目录选整个 `MyBlog` 仓库；
3. 在“核心插件”中启用 Templates；模板目录已经设为 `templates/obsidian`；
4. 关闭 Restricted mode 后启用仓库自带的 `MyBlog Publisher`。插件代码在 `.obsidian/plugins/myblog-publisher/main.js`，只在桌面端运行；
5. 确认 Git 已能对 `origin/main` 拉取和推送。不要把 GitHub Token 写进 Vault。

Vault 会忽略 `node_modules`、构建产物、Git 内部目录和浏览器截图，只索引源码、文档与内容。普通新笔记默认进入 `content/inbox`；该目录不参与博客构建。

### 新建文章

1. 先从 GitHub 拉取最新 main，避免与网页后台的草稿冲突；
2. 在 `content/inbox` 新建文件，文件名直接使用稳定 ASCII Slug，例如 `learning-worker-cache.md`；
3. 运行 Templates 命令，选择 `article`、`til` 或 `project`；模板会把文件名写入 frontmatter `slug`，把当天日期写入日期字段；
4. 填写中文标题、独立摘要、标签和正文。文章默认 `draft: true`；
5. 图片可以拖入笔记，Vault 会保存到 `public/uploads`。发布脚本会把 `![[image.png]]` 或相对 `public/uploads` 链接统一改成博客 URL；图片文件名必须使用安全 ASCII 字符；
6. 在命令面板执行 `MyBlog Publisher: 检查当前草稿`，先修复所有字段、标签、Slug 或附件提示；
7. 执行 `MyBlog Publisher: 发布当前草稿并同步 GitHub`。它会关闭草稿、移动文件、运行完整检查、提交并推送 main；
8. GitHub 自动检查和部署完成后，按线上冒烟清单检查文章。

插件命令不会把整个工作区一起暂存。若 Git 暂存区已有其他内容，自动发布会停止，避免把无关修改混入文章提交。检查失败时原始草稿会恢复到 inbox。

不启用插件也可以在仓库终端执行：

```bash
# 只检查当前草稿
npm run content:publish -- content/inbox/my-slug.md --check-only

# 检查、移动、提交并推送
npm run content:publish -- content/inbox/my-slug.md --push
```

Obsidian 移动端不能运行本仓库的 Node/Git 发布命令。可以在移动端继续写 inbox 草稿，回到桌面后发布；也可以改用 `/studio`。

### 同时使用 Studio 与 Obsidian

- 开始写作前先同步 main；
- 同一篇内容一次只在一个入口编辑；
- Studio 的未发布稿位于 GitHub pull request，Obsidian inbox 草稿位于本地，两者不会自动合并；
- 如果必须换入口，先在原入口完成提交/PR，再同步到另一个入口；
- Git 冲突必须解决后再发布，不能用强制推送覆盖另一份草稿。

## 常见恢复方式

- 登录按钮提示 OAuth 未配置：检查四个 GitHub Environment secrets，并重新运行部署；
- GitHub 显示仓库不存在：确认登录账号对 `Zach424/MyBlog` 有写权限；
- 发布检查失败：打开 Actions 中失败步骤，按具体内容字段或链接提示修改草稿；
- Slug 不一致：保持文件名和 frontmatter `slug` 相同；已发布内容不要通过改名修复，应先设计重定向；
- 线上内容没有变化：确认 pull request 已合并、Deploy workflow 成功，且查看的是新 Cloudflare origin。
- Obsidian 命令不可用：确认当前文件位于 `content/inbox`、使用桌面版、已启用 MyBlog Publisher；
- Obsidian 发布后附件缺失：按错误提示检查 `public/uploads` 中的文件名和正文引用，不要忽略检查强行提交。
