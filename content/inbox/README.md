# Obsidian 写作收件箱

这里保存尚未进入博客构建的本地草稿。新建文件时先使用小写 ASCII Slug 命名，例如 `learning-worker-cache.md`，再插入 `templates/obsidian` 中的模板。

完成标题、摘要、标签和正文后，在 Obsidian 命令面板运行：

- `MyBlog Publisher: 查看全部草稿发布就绪状态`：在只读弹窗中列出 ready、scheduled、blocked、目标路径、附件派生和阻塞原因；
- `MyBlog Publisher: 检查当前草稿`：只验证，不移动、不提交；
- `MyBlog Publisher: 发布当前草稿并同步 GitHub`：关闭草稿、移动到正式内容目录、执行全量检查、提交并推送。

命令行等价总览为 `npm run content:inbox`；JSON 证据使用 `npm run content:inbox -- --format json`。总览不会移动、改写、提交或推送作者文件。

此 README 不参与博客构建。详细流程见 `docs/PUBLISHING.md`。
