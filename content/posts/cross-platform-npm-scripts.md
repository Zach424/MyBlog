---
title: "Windows 下的跨平台 npm scripts"
description: "一次看似简单的启动命令修正，如何暴露 shell 假设，并把本地开发与托管构建统一成可重复流程。"
type: til
publishedAt: 2026-07-18
tags: ["Node.js", "Windows", "Tooling"]
draft: false
featured: false
---

## 问题

项目最初的 npm scripts 带有只适用于类 Unix shell 的环境变量写法。在 Windows PowerShell 或 `cmd.exe` 中运行时，命令会在应用启动前失败。本地开发和托管环境使用不同 shell，就意味着同一份仓库并没有真正可重复的构建入口。

## 处理方式

当前的开发、构建和启动命令直接调用 Vinext：

```json
{
  "scripts": {
    "dev": "vinext dev",
    "build": "vinext build",
    "start": "vinext start"
  }
}
```

非必要的环境变量不再塞进命令字符串；确实需要跨平台设置时，再引入专门工具或让应用从标准环境读取，而不是依赖某一种 shell 语法。

## 学到的判断

“在我的终端能运行”不是脚本完成的证据。至少要同时验证 Windows 本地命令、干净安装后的构建命令，以及最终托管目标使用的构建流程。跨平台脚本不是额外优化，而是可重复交付的一部分。
