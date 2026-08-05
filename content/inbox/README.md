# Obsidian 写作收件箱

这里保存尚未进入博客构建的本地草稿。新建文件时先使用小写 ASCII Slug 命名，例如 `learning-worker-cache.md`，再插入 `templates/obsidian` 中的模板。

完成标题、摘要、标签和正文后，在 Obsidian 命令面板运行：

- `MyBlog Publisher: 查看全部草稿发布就绪状态`：在只读弹窗中列出 ready、scheduled、blocked、目标路径、附件派生和阻塞原因；
- `MyBlog Publisher: 检查当前草稿`：只验证，不移动、不提交；
- `MyBlog Publisher: 发布当前草稿并同步 GitHub`：关闭草稿、移动到正式内容目录、执行全量检查、提交并推送。

命令行等价总览为 `npm run content:inbox`；JSON 证据使用 `npm run content:inbox -- --format json`。总览不会移动、改写、提交或推送作者文件。

维护已发布 Current 内容时，先从“查看已发布内容复核台账”打开正式笔记，按清单人工核对。无事实变化只把 `reviewedAt` 推进到当天；正文或元数据变化还要把 `updatedAt` 更新到当天。随后运行：

- `MyBlog Publisher: 检查当前正式内容复核`：执行完整仓库门，然后用只读 Author Proof 显示 HEAD/当前日期、事实变化、质量门、候选内容短指纹和唯一提交范围；不暂存、不提交；
- `MyBlog Publisher: 提交并同步当前正式内容复核`：门禁通过后只提交当前正式 Markdown 并推送 `main`。

该流程要求暂存区（包括 intent-to-add）为空，且同一天不能重复声明复核。可以同时保留稳定的 `content/inbox/<slug>.md` 草稿和未跟踪的根 `public/uploads/<图片>`；它们会在 Proof 中标为 deferred，不进入本次提交。已跟踪根附件修改、嵌套归档媒体、其他正式内容、代码或未知路径仍阻断。命令行等价入口为 `npm run content:review -- content/posts|projects/<slug>.md --check-only|--push`；机器可读证据在 check-only 后增加 `--format json`。Proof v3 的 SHA-256 绑定质量门前后原始字节，push 还核对 Git clean/filter 后的 index 与提交 tree；长检查期间修改目标或移动 HEAD 都会失败关闭。结构化证据异常时插件会重新执行纯文本检查，不会显示半可信的可提交状态。

此 README 不参与博客构建。详细流程见 `docs/PUBLISHING.md`。
