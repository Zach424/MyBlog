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
0051-obsidian-published-maintenance-report.md
0052-obsidian-structured-maintenance-ledger.md
0053-obsidian-published-content-review.md
0054-obsidian-structured-review-proof.md
0055-review-worktree-impact-classifier.md
0056-review-candidate-fingerprint.md
0057-pending-review-delivery.md
0058-safe-review-redelivery.md
0059-pending-publication-envelope.md
0060-safe-publication-redelivery.md
0061-unified-delivery-triage.md
0062-local-author-environment-doctor.md
0063-author-transaction-preflight-interlock.md
0064-author-transaction-single-flight-lease.md
0065-author-transaction-active-snapshot.md
0066-author-transaction-activity-pulse.md
0067-author-transaction-terminal-receipt.md
0068-obsidian-trusted-template-draft-wizard.md
0069-filename-owned-draft-rename.md
0070-legacy-draft-identity-evidence.md
0071-current-draft-author-intent.md
0072-source-scoped-draft-media-evidence.md
0073-exact-draft-link-targets.md
0074-draft-media-transformation-trace.md
0075-draft-media-source-usages.md
0076-draft-media-alternative-text-trace.md
0077-draft-media-alternative-text-provenance.md
0078-draft-media-alt-source-navigation.md
0079-draft-link-source-navigation.md
0080-draft-source-byte-binding.md
0081-draft-intent-latest-wins.md
0082-draft-identity-latest-wins.md
0083-draft-intent-process-supersession.md
0084-github-actions-immutable-pins.md
0085-canonical-share-trace.md
0086-markdown-citation-copy.md
0087-explainable-html-budgets.md
0088-json-feed-1-1.md
0089-portable-markdown-sources.md
0090-markdown-source-conditional-reads.md
0091-public-content-manifest.md
0092-production-content-sync-checker.md
0093-production-content-convergence-wait.md
0094-post-delivery-production-handoff.md
0095-recovered-delivery-production-handoff.md
0096-obsidian-plugin-version-handshake.md
0097-obsidian-plugin-bundle-integrity.md
0098-obsidian-plugin-git-provenance.md
0099-content-manifest-json-schema.md
0100-structured-discovery-transfer-budgets.md
0101-structured-discovery-conditional-reads.md
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
