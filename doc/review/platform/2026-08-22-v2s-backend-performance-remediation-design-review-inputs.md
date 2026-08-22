# 后台接口性能整改 · DESIGN 独立审查输入清单

```text
REVIEW_CYCLE_ID=BPR-DESIGN-20260822
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
```

审查者必须先独立重开以下输入，再读作者 intake；以证伪为立场，不采信作者完成声明：

1. `AGENTS.md`
2. `PLATFORM-BLUEPRINT.md`
3. `doc/platform/foundation-charter.md`
4. `doc/platform/backend-coding-standard.md`
5. `doc/platform/frontend-coding-standard.md`
6. `doc/decisions/templates/implementation-design-template.md`
7. `doc/decisions/templates/ia-design-template.md`
8. `doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-requirements-claude.md`
9. `doc/review/platform/2026-08-22-v2s-backend-performance-root-cause-analysis-claude.md`
10. `doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-journey.md`
11. `doc/decisions/2026-08-22-v2s-backend-performance-batch-outcome-ui-interaction.md`
12. `doc/plans/platform/wireframes/2026-08-22-v2s-backend-performance-batch-outcome.svg`
13. `doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-ia-codex.md`
14. `doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md`
15. `doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-serial-plan-codex.md`
16. 两个 route generator、两个 generated route registry、`DatabaseOperationTracker`、`HttpRequestMetricsInterceptor`、remote Testcontainers runner、DEV runner/environment、CatalogOwnerService/Coordinator、catalogModel/CatalogWorkbench owning source。
17. 最后才读 `doc/review/platform/2026-08-22-v2s-backend-performance-remediation-design-intake-codex.md`，只用于核对作者是否诚实处置，不能替代独立结论。

必须独立核验：

- 238 是否真实来自运行时 181+57 unique；100 GET/138 write 是否成立；
- request schema 数组分母是否真为 24，独立逐项写是否真只有 1；
- L1 远端 Java/本机 Vite/HTTP+asset tunnel 是否覆盖 identity、secret、日志、readiness、stop/reset/seed 和 browser asset；浏览器 L2 是否未被误改；
- Testcontainers 对原有 DEV 的 stop/双 PASS 后恢复规则是否有前态、失败和授权边界；
- 预算生成源、238 非 null、linear N、只降不升、event consumer、connection/transactionBegin/UNCLASSIFIED SQL 门能否实施且不复活自证式旧门；
- layer classification 是否真正满足“新增 owner SQL 不改打标代码仍归类”，并保留 unknown negative control；
- P0 94 未知时的校准方案是否可执行，是否与 acceptance 80 场景上限/seed 语义冲突；
- batch 预载是否会被项事务内重新核验，strict order/idempotency/replay/owner reason/refresh/no audit 是否闭合；
- §3 十七行与第四列全集、§7 机制行、§9b unique anchors、§10b 两栏、§11 可证伪判据是否齐全；
- IA/交互/详设同一事实是否逐字一致，是否有未获 Dexter 裁定的产品语义。

输出必须写入：
`doc/review/platform/2026-08-22-v2s-backend-performance-remediation-design-review-round-1-independent.md`

并包含：盲审声明、逐条 source evidence、`GO|NO_GO`、`M/S/N` 计数、每条 finding 的最小修复与更大方案成本、授权边界。不得修改作者设计文件。
