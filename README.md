# Zach424 / MyBlog

一个用于记录学习过程、技术判断和项目复盘的个人技术博客。

## 当前状态

- 阶段：自助发布系统建设中；网页后台与 Obsidian 双写作入口完成
- 当前轮次：`0013-obsidian-authoring`
- 生产站点：<https://zach424-engineering-notes.zhiqingchen792.chatgpt.site>
- 运行目标：Cloudflare Worker-compatible web application
- 内容目标：学习笔记、完整文章、系列专题、项目复盘

详细状态、设计和实现记录统一保存在 [`docs`](./docs/README.md)。每个开发轮次都必须遵循：

1. 选择一个可验证的小范围目标；
2. 实现并运行相关检查；
3. 更新项目结构与全局状态；
4. 在 `docs/iterations` 中归档经验和证据；
5. 创建一个独立 Git 提交。

## 本地开发

```bash
npm ci
npm run dev
```

默认访问地址为 `http://localhost:3000/`。

## 常用检查

```bash
npm run check
npm audit --omit=dev --audit-level=high
npx wrangler deploy --dry-run --config dist/server/wrangler.json --outdir .wrangler/dry-run
```

## 文档入口

- [项目章程](./docs/PROJECT.md)
- [技术架构](./docs/ARCHITECTURE.md)
- [设计基线](./docs/DESIGN.md)
- [搜索与发布发现](./docs/DISCOVERY.md)
- [自助发布指南](./docs/PUBLISHING.md)
- [发布质量基线](./docs/QUALITY.md)
- [上线、维护与回滚手册](./docs/OPERATIONS.md)
- [自助发布架构决策](./docs/decisions/0002-git-first-publishing.md)
- [开发路线图](./docs/ROADMAP.md)
- [架构决策](./docs/decisions/0001-runtime-and-hosting.md)
- [迭代归档](./docs/iterations/README.md)
