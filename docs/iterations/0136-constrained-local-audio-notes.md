# Iteration 0136：受约束的本地 MP3 音频笔记

## 1. 范围与成功标准

本轮让作者把学习口述、演示复盘和项目回顾作为“音频 + 等价文字稿”发布，同时继续保持 Git Markdown 为唯一事实源。第一版只接受仓库内本地 MP3，不接外部播放器、播客托管、自动转写、播放统计或自动播放。

成功标准：

1. 每段音频有标题、一行简述、当前内容 slug 下的 MP3 和完整文字稿；
2. 每篇最多 3 段，每段最多 8 MiB、15 分钟；
3. 构建期验证真实 MPEG Layer III、32–320 kbps、16–48 kHz、单/双声道；
4. Studio 提供结构化音频组件和浏览器选前预检，Obsidian 提供模板与原子附件归档；
5. 阅读端使用无自动播放、无 iframe、无追踪的原生播放器，文字稿直接可读、可搜索、可打印；
6. 正式内容、Studio 预览、搜索、媒体所有权和发布恢复共用同一 Markdown/附件契约；
7. 不引入数据库、云转码、第三方音频服务或 Cloudflare。

## 2. 项目结构状态

本轮新增：

- `lib/audio-policy.ts`：MP3 格式、时长、码率、采样率、声道和体积权威校验；
- `lib/markdown-audio.ts`：音频块抽取、预算校验、HAST 阅读投影与搜索降级；
- `studio/audio-editor.mjs`：Decap `myblog-audio` 结构化 editor component；
- `app/studio/audio-editor.mjs/route.ts`：显式同源 Studio 资源路由；
- `tests/audio-policy.test.mjs`、`tests/markdown-audio.test.mjs`、`tests/studio-audio-editor.test.mjs`；
- 本档案与 `docs/knowledge/0136-audio-transcript-is-content.md`。

本轮修改内容契约、Markdown rehype 管线、搜索、Studio 预览/配置/上传预检、Obsidian 发布器、通用媒体准备、构建期媒体扫描与引用所有权、生产 smoke、读者/Studio CSS 和插件版本/bundle。归档时继续保留用户自己的 `README.md`、`docs/README.md` 修改，以及三个 `docs/*_CURRENT.md` 新文件；它们未被本轮暂存或提交。

## 3. 设计内容

视觉继续使用 Commit Trace / Evidence Rail。音频块顶部以 `AUDIO NOTE / MP3` 和 `LOCAL · TRANSCRIPT INCLUDED` 说明载体与来源；深色刻度轨承载原生播放器，像一段可定位的波形时间尺；文字稿紧随播放器，并在桌面使用标签 + 正文双列、390 px 下改为单列。

播放器只是证据入口，文字稿才是稳定阅读面。打印时隐藏播放器、深色轨和下载动作，保留标题、简述、完整文字稿和源文件路径；没有 JavaScript 时，浏览器原生控件和下载链接仍可使用。该方向由 `frontend-design` skill 约束为“证据轨 + 文字稿优先”，避免做成常见的圆角播客卡片。

## 4. 使用的技术

- Next.js 16.3、React 19、TypeScript 5、Node.js 22+；
- unified、remark-gfm、remark-rehype、mdast 与 HAST；
- 原生 `<audio controls preload="metadata">` 与 `<source type="audio/mpeg">`；
- `music-metadata` 11.14.0 的 `parseFile()` 构建期真实格式解析；
- Decap CMS 3.14.1 custom editor component、file/text widget；
- 浏览器 `HTMLAudioElement` 元数据、Web Crypto SHA-256 与同路径冲突清单；
- Obsidian Publisher 1.46.0、文件名身份、附件事务、回滚与 3/3 SHA-256 bundle；
- Node test、ESLint、TypeScript、Next production build/application tests、Playwright CLI；
- Vercel 原生交付，不依赖 Cloudflare。

参考依据：[HTML Standard 的 audio/media 元素](https://html.spec.whatwg.org/multipage/media.html)、[WCAG 1.2.1 预录音频替代要求](https://www.w3.org/WAI/WCAG20/Understanding/audio-only-and-video-only-prerecorded)、[W3C G158 文字替代技术](https://www.w3.org/WAI/WCAG20/Techniques/general/G158)、[Decap 自定义组件](https://decapcms.org/docs/custom-widgets/) 与 [`music-metadata` 包文档](https://www.npmjs.com/package/music-metadata)。

## 5. 实现的功能

1. 识别静态 `[!audio]` 标记、严格标题、下载链接、简述和文字稿；
2. 只接受 `/uploads/<slug>/<file>.mp3`，拒绝外链、根暂存正式引用、查询参数、锚点和非 MP3；
3. 限制标题 120 字、简述 320 字、文字稿 12000 字、每篇 3 段；
4. 内容解析和 Studio 条目预检对非法音频返回带正文行号的中文错误；
5. 构建期用 `music-metadata` 验证真实 MP3 编码和完整媒体包络；
6. Studio 上传前校验 ID3/frame sync、8 MiB、浏览器可解码时长、SHA-256 和冲突；
7. Studio 提供 MP3、标题、简述、完整文字稿四字段组件，可回填既有块；
8. `/studio/math-preview` 返回 `audioCount`，并输出 `AUDIO / NEEDS FIX`；
9. Obsidian 新增“插入本地音频笔记模板”，inbox 使用根暂存路径，正式内容使用当前 slug 路径；
10. Obsidian 发布器把 MP3 原字节归档到当前 slug，改写正文，并纳入已有事务、回滚、Git 与来源行证据；
11. 构建媒体清单、正式引用所有权和孤儿附件检查识别 MP3；
12. 阅读端输出标题、简述、原生控件、完整文字稿、下载链接与打印路径；
13. 搜索保留标题、简述和文字稿，不泄漏 `[!audio]`、下载文字或 `/uploads` 路径；
14. 插件升级到 1.46.0，三方版本联锁、未来 patch/minor 与 bundle 完整性测试同步更新；
15. 生产 smoke 覆盖音频模块、预览计数、原生控件、文字稿和无交互边界。

## 6. 实现方法

作者语法冻结为：

```markdown
> [!audio] 发布复盘口述
> [下载 MP3](/uploads/demo/release-retro.mp3 "发布复盘口述")
> 这一段录音总结了发布前检查、上线确认与复盘结论。
>
> **文字稿**
> 先运行完整检查，再确认生产冒烟全部通过；最后记录失败原因与下一步。
```

mdast 层先识别 `[!audio]` 候选，再验证固定两段结构、标题/链接同值、文本预算和本地路径；通过后，rehype 转换器把 blockquote 提升为语义 figure。音频转换必须排在通用 Callout 转换之前，否则 `[!audio]` 会先被普通提示块消费。

构建媒体准备复用既有附件事务：MP3 以 1×1/1 帧作为通用媒体报告的非视觉占位包络，实际音频事实由独立 `AudioInspection` 验证；文件发布前后保持 `.mp3` 和相同字节，`bytesSaved` 固定为 0。浏览器预检只做早期反馈，构建期解析才是发布权威。

Studio 与 Obsidian 都只生成相同开放 Markdown。文字稿位于正文结构内，因此搜索、公开 Markdown、版本 diff、屏幕阅读和打印不依赖播放器是否可用。

## 7. 验证证据

- 定向跨链路回归：309/309；
- 首轮全量单测：600/601，唯一失败是媒体仓库统计新增 `audios: 0` 后旧期望未更新；修正后最终 `npm run test:unit` 为 601/601；
- `npm run test:diagram`：5/5；
- `npm run lint`、`npm run typecheck`、`git diff --check`：通过；
- `npm run build`：通过，71 个生成页面/资源，新增 `/studio/audio-editor.mjs`；
- `npm run test:app`：35/35，十三条 HTML 与十一个结构化发现端点预算全部 PASS；
- `npm audit --omit=dev --audit-level=high`：0 漏洞；
- 插件：`myblog-publisher@1.46.0 · 3/3 SHA-256 files`；
- Playwright Studio：音频 editor 注册成功，登录页 0 error / 0 warning；
- Playwright 合成音频预览：`audioCount: 1`、原生 controls、`preload=metadata`、完整文字稿；桌面块 864 px、390 px 块 334 px，均无横向溢出；
- 截图：`output/playwright/iteration-0136-audio-desktop.png`、`output/playwright/iteration-0136-audio-mobile.png`；
- 合成 MP3 路径有预期 404，因此该浏览器证据只证明渲染/布局/语义，不冒充真实文件播放或 CDN 证据。

最终全量单测、release gate、提交 SHA、Vercel 收敛与稳定生产 smoke 在部署证据提交中补充。

## 8. 经验与教训

1. 音频不是“一个可播放 URL”，而是文件、语义、等价文字和所有权的组合契约；
2. 文字稿必须是正文的一部分，不能藏在可选下载或远程服务里；
3. 特殊 Callout 的转换顺序属于功能正确性，音频必须早于通用 Callout；
4. 候选识别要覆盖 `[!audio]` 后直接换行，否则无标题块会逃过校验；
5. 浏览器元数据只提供快速反馈，真实编码、码率和声道必须由构建门解析；
6. 通用媒体事务可复用，但非视觉媒体的占位宽高必须明确记录，避免被误解为音频事实；
7. 音频文件保持原字节比无约束自动转码更可审计，第一版应先冻结输入包络；
8. 原生播放器提供键盘和浏览器能力，站点不应复制一套易失真的自定义播放状态；
9. 搜索应消费文字稿而非文件名，阅读失败时知识仍然可发现；
10. 合成路径适合验证 HTML/CSS/语义，真实播放与 CDN Range 必须等真实公开样本再证明。

## 9. 全局状态、风险与未解决问题

作者现在可从 Studio 或 Obsidian 发布 GFM、图片、代码、脚注、公式、Callout、受限 Mermaid、受限本地静音 MP4、多图画廊、技术表格、只读任务清单和本地 MP3 音频笔记。音频不依赖 Cloudflare、数据库、第三方播放器或转写 API。

当前公开内容没有真实 MP3。现有证据覆盖模块、契约、构建、合成生产预览、移动/桌面布局和发布事务，不覆盖真实文件的 Range 请求、浏览器解码差异、Vercel CDN Content-Type/缓存或作者第一次真实录音工作流。第一版有意排除 WAV/M4A/OGG、外部托管、RSS enclosure、波形解析、播放速度 UI、章节、自动转写、音频封面、播放统计和评论。

## 10. 下一轮唯一主任务

建立受约束的参考资料清单：用可迁移 Markdown 组织官方文档、论文、仓库和延伸阅读，冻结标题、条目数量、可见链接文本、HTTPS/站内目标、可选短注释、Studio/Obsidian 作者入口、搜索与打印；不在构建期抓取远程标题、摘要或 favicon，也不引入书签服务。
