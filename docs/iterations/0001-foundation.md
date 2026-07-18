# Iteration 0001：工程、设计与归档基线

- 日期：2026-07-18
- 状态：完成
- 对应提交：本轮提交后回填可通过 Git 历史查询

## 1. 范围与成功标准

本轮只完成仓库接入、可运行站点骨架、技术与设计基线、归档制度和平台兼容修正。页面产品实现不属于本轮。

成功标准：依赖可从锁文件安装；开发服务器可以启动；构建和基线测试通过；所有关键决策有文档；工作树形成一次独立提交。

## 2. 项目结构状态

### 开始前

```text
README.md
```

### 本轮目标结构

```text
.openai/hosting.json      托管能力声明
app/                      启动页面和全局布局
build/                    Sites/Vite 构建插件
db/ drizzle/ examples/    模板提供的可选能力示例，当前未启用
docs/                     项目档案、决策和迭代记录
public/                   启动图标资源
tests/                    渲染 HTML 基线测试
worker/                   Cloudflare Worker 入口
package.json              项目脚本和依赖
```

## 3. 设计内容

确立“工程工作日志”草案：冷调工作台、真实日期与状态、克制的正文排版，以 Commit Trace 连接学习和项目里程碑。该方向仍需下一轮三方案视觉比较后才能冻结。

## 4. 使用的技术

- React 19、Next.js compatible App Router；
- Vinext、Vite 8、TypeScript 5；
- Tailwind CSS 4 与 CSS 自定义属性；
- Cloudflare-compatible Worker 输出；
- Node test、ESLint、Git。

## 5. 实现的功能

- 接入远程 Git 仓库并保留初始历史；
- 建立可运行的站点启动骨架；
- 建立完整项目档案体系；
- 建立每轮归档与独立提交规则；
- 修正 npm scripts 的 Windows 兼容性；
- 用 `.gitattributes` 和 `.editorconfig` 固化 UTF-8、LF 与基础格式规则。

## 6. 实现方法

首先审计空仓库，再使用 Sites 提供的 Vinext 模板生成基线。由于缓存中的 Bash 脚本在 Windows/WSL 中存在 CRLF 和路径兼容问题，改用等价的原生模板复制和 `npm ci` 流程，未修改插件缓存。

模板原本通过 Unix 前置环境变量启动 Vinext；本轮移除非必要的 `WRANGLER_LOG_PATH=...` 前缀，使同一 scripts 可在 Windows 和托管环境运行。

## 7. 验证证据

- `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund`：成功，按锁文件安装 507 个包。
- `npm run dev`：成功，`http://localhost:3000/` 返回 HTTP 200，开发服务保持运行。
- `npm run lint`：成功，无 ESLint 错误。
- `npm run build`：成功，Vinext 完成五阶段构建并生成 Worker 输出。
- `npm test`：成功，2 项服务端渲染与骨架隔离测试全部通过，0 失败。
- `git commit`：成功，本轮形成独立本地提交。
- `git push origin main`：失败。GitHub 返回 HTTP 403；系统当前缓存的 HTTPS 身份为 `cenhanhan`，无权写入 `Zach424/MyBlog`。本地提交完整保留，等待切换到具有仓库权限的 GitHub 身份后重试。

构建输出将首页分类为 `Unknown` 并说明当前静态分析不能识别部分动态 API。这不是构建失败，但已加入后续兼容性观察项。

## 8. 经验与教训

- 跨平台启动脚本必须实际在目标开发系统执行，不能只看 package.json 判断可用。
- 插件模板可以作为可信资产复用，但初始化包装脚本仍可能受换行符和路径模型影响。
- 在写页面前先记录运行模型和重新评估条件，可以防止框架惯性掩盖真实问题。
- “本地提交成功”和“远程已同步”必须分别验证；当前环境也没有安装 GitHub CLI，不能用它切换账号或作为推送后备路径。

## 9. 全局状态、风险与未解决问题

- 工程基线：done，依赖安装、开发、构建、Lint 和测试均有证据。
- 设计系统：partial，已有方向但尚未选择定稿。
- 内容系统：pending。
- 核心页面：pending。
- 发布能力：pending。
- 部署：pending。

主要风险：Vinext 兼容边界、Markdown 构建方式、字体交付方式和作者真实内容尚未确认。

外部阻塞：远程仓库写入身份不匹配。它不阻塞本地第 2 轮开发，但在下一次远程同步前需要完成正确账号认证。

## 10. 下一轮唯一主任务

冻结内容 schema，并创建三个共享真实内容、但视觉语言明显不同的首页方向供选择；选择后归档最终设计 Token 和页面结构。
