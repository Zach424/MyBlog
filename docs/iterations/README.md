# 迭代归档

每个开发轮次创建一个按四位数字编号的 Markdown 文件，并与该轮代码一起提交。

## 文件命名

```text
0001-foundation.md
0002-content-contract.md
0003-homepage-design-system.md
0004-content-pipeline.md
0005-core-content-routes.md
0006-discovery-and-feeds.md
0007-release-candidate-quality.md
0008-production-launch.md
0009-browser-qa.md
0010-public-launch.md
0011-owner-controlled-delivery.md
0012-publishing-studio.md
0013-obsidian-authoring.md
0014-migration-and-cutover.md
0015-sites-studio-security.md
0016-vercel-native-migration.md
0017-vercel-production-and-authoring.md
0018-git-auto-delivery-verification.md
0019-obsidian-attachment-pipeline.md
0020-content-knowledge-links.md
0021-content-freshness-contract.md
0022-local-media-budget.md
0023-content-maintenance-report.md
0024-bidirectional-reference-ledger.md
0025-obsidian-webp-optimization.md
0026-content-media-reference-integrity.md
0027-responsive-content-covers.md
0028-responsive-markdown-images.md
0029-studio-slug-media-archive.md
0030-studio-media-preflight.md
0031-studio-stable-slug-lifecycle.md
0032-staging-media-inventory.md
0033-permanent-redirect-registry.md
0034-obsidian-inbox-readiness.md
0035-accessible-knowledge-map.md
0036-external-link-inventory.md
0037-internal-heading-anchor-integrity.md
0038-structured-external-endpoints.md
0039-studio-media-collision-preflight.md
0040-studio-media-session-ledger.md
0041-studio-media-latest-selection.md
0042-accessible-code-copy.md
0043-markdown-heading-permalinks.md
0044-print-ready-content.md
0045-accessible-markdown-footnotes.md
0046-obsidian-markdown-math.md
0047-studio-math-preview.md
0048-studio-entry-preflight.md
0049-github-actions-node24-runtime.md
0050-studio-content-maintenance-queue.md
```

## 必填结构

```markdown
# Iteration NNNN：名称

## 1. 范围与成功标准
## 2. 项目结构状态
## 3. 设计内容
## 4. 使用的技术
## 5. 实现的功能
## 6. 实现方法
## 7. 验证证据
## 8. 经验与教训
## 9. 全局状态、风险与未解决问题
## 10. 下一轮唯一主任务
```

验证证据应包含执行的检查和结果摘要；失败后修复的内容也需要保留，避免重复踩坑。
