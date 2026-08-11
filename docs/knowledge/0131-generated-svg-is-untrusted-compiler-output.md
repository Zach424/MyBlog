---
title: 生成的 SVG 仍是不可信编译器输出
date: 2026-08-11
iteration: "0131"
tags:
  - MyBlog
  - Markdown
  - Security
  - Architecture
---

# 生成的 SVG 仍是不可信编译器输出

关联：[[STATUS|当前项目状态]] · [[0131-constrained-server-mermaid|Iteration 0131]] · [[0130-rich-markdown-should-be-an-ast-contract|富 Markdown 应该是语法树契约]]

## 服务端不是信任边界

把 Mermaid 从浏览器移到服务器，可以消除客户端 bundle、hydration flash、第三方运行时和无 JavaScript 降级问题，但不能让输出自动安全。renderer 仍然是一个接受作者文本的编译器；它可能生成 style、远程字体、链接、`foreignObject`、冲突 id，升级后还可能出现新的标签或属性。

因此正确边界不是“renderer 声称输出 self-contained SVG”，而是：

```text
受限作者源码
  → 类型/指令/输入预算
  → 固定 renderer
  → 输出字节/元素/视窗预算
  → 解析为 HAST
  → 独立 allowlist sanitizer
  → 站点拥有的语义外壳与 CSS
```

renderer 负责布局，博客负责信任。两者不能合并为一个判断。

## 输入门和输出门解决不同问题

输入字节、行数和图表数量限制作者可以提交多少工作，但短源码也可能让布局器生成大量节点或巨大坐标。输出字节、元素数和 viewBox 限制实际产物，却不能阻止某些复杂输入在输出前消耗过多 CPU。因此两边都需要限制，还要限制支持的图表家族和指令集合。

同步 renderer 无法被普通 Promise timeout 中断，所以第一层必须足够保守：少数明确类型、有限行数、有限图数、禁止可扩展样式/HTML/交互。未来需要更强隔离时，应考虑构建子进程或 worker 的可终止边界，而不是只提高上限。

## 清理 style 会暴露隐式运行时依赖

本轮删除上游 `<style>` 后，节点仍然正常，但连线文字标签变成黑底。原因是标签 rect 的 presentation attribute 使用 `var(--bg)`，这个变量原本由 root inline style 提供。字符串安全断言都通过，只有真实截图暴露视觉 fallback。

修复方式不是恢复整段不受控 style，而是把 renderer 仍会消费的有限变量在 `.markdown-diagram` 作用域显式映射到站点 token。这个案例说明 sanitizer 后还必须检查：

- 保留下来的属性引用了哪些 CSS 变量；
- 浅色与深色是否都有确定值；
- 文本、边、标签背景和 marker 是否同时可见；
- print 是否依赖被删除的内部规则；
- 最简单夹具是否遗漏 edge label、group、axis 等元素。

## SVG id 属于整个 HTML 文档

每个 SVG 单独看都可以有 `id="arrowhead"`，但内联到同一 HTML 文档后，`url(#arrowhead)` 的解析可能跨图命中。renderer 不知道页面上还有几张图，因此集成层必须给每张图建立确定性命名空间，并同时重写 id 与所有 fragment 引用。

这个问题只会在“两张图同页”出现，所以安全/渲染测试必须包含多实例，而不能只循环单实例夹具。

## 保留源码比保存派生产物更可靠

SVG 是版本化 renderer、布局参数和主题的派生结果。把 SVG 提交为内容源会导致：

- Obsidian 无法继续编辑语义图；
- 主题变化需要批量重生成文件；
- 搜索只能猜测 SVG 文本；
- 安全策略升级无法自动重新清理旧产物；
- diff 充满布局坐标而不是作者判断。

保留 Mermaid fence 后，构建可以随 renderer、安全策略和设计 token 重建；公开 `source.md` 与源码折叠也保留可移植证据。派生 SVG 只存在响应 HTML，不成为第二事实源。

## 可复用判断

1. 所有“从不可信文本生成富表示”的库都应视作编译器，而不是 sanitizer；
2. 先限制语言子集，再验证输出，最后才进入页面树；
3. 删除危险能力后必须检查残余依赖，不要把“标签被删了”当成视觉完成；
4. 多实例、暗色、窄屏、打印和键盘都属于安全输出契约的一部分；
5. 浏览器截图应覆盖语法里的特殊结构，例如带文字的边，而不只覆盖 happy-path；
6. 原始语义源码应是事实源，HTML/SVG/PDF 都是可重建投影；
7. 包 exports、生成标签集合与安全 schema 必须作为同一个依赖升级事务复核。
