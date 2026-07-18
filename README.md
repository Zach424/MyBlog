# Zach424 / MyBlog

一个用于记录学习过程、技术判断和项目复盘的个人技术博客。

## 当前状态

- 阶段：工程与设计基线已经建立，页面仍为启动骨架
- 当前轮次：`0001-foundation`
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
npm run build
npm run lint
npm test
```

## 文档入口

- [项目章程](./docs/PROJECT.md)
- [技术架构](./docs/ARCHITECTURE.md)
- [设计基线](./docs/DESIGN.md)
- [开发路线图](./docs/ROADMAP.md)
- [架构决策](./docs/decisions/0001-runtime-and-hosting.md)
- [迭代归档](./docs/iterations/README.md)
