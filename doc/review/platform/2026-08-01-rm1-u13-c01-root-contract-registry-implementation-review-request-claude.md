# RM1 U13 C01 root contract registry — Claude post-remediation recheck request

REVIEW_STATUS=POST_REMEDIATION_RECHECK_REQUEST

## 背景

Claude 已对 C01 的 root OpenAPI / generated route-registry exact-set 修复给出 `GO — M=0 / S=1 / N=2`。唯一 S1 指出：C01 package exit 使用 `status: "PASS"`，但未执行且不应恢复已退役的 baseline exit validator，字段名会把静态 proof 误读成机器验证的 package exit。

Codex 只采用 Claude 给出的最小方案 (a)：将该字段改为 `staticProofStatus: "PASS"`，并在同一 exit 中明示它不是 machine-validated package exit。业务与 cleanup 继续为 `NOT_APPLICABLE`。作者 disposition 和 package input 已诚实标注这些是 Claude 原审之后的 current bytes，要求本次限定 recheck；没有以 post-remediation 记录冒充本次 recheck 已完成。

## 评审目标

请仅独立核验 S1 的 current-byte 修复是否准确、最小且没有改变 C01 的静态边界：它是否消除了 `status: PASS` 的错误证据强度表达，同时没有恢复已退役的 prewrite-baseline / receipt 机制，也没有把 C01 提升为 HTTP workload、性能、business、cleanup 或 Roadmap closure。

## 需阅读文件

- `doc/review/platform/2026-08-01-v2s-rm1-u13-c01-root-contract-registry-review-claude.md`：原 Claude GO 与 S1/N1/N2 的精确结论。
- `doc/evidence/platform/rm1/p6/rm1p6-u13-c01-root-contract-registry-package-exit.json`：S1 修订后的 current exit 字节、静态 proof 与边界。
- `doc/review/platform/2026-08-01-rm1-u13-c01-root-contract-registry-author-resolution.md`：逐 finding 的作者验证与处置。
- `doc/evidence/platform/rm1/p6/rm1p6-u13-c01-root-contract-registry-package-input.json`：诚实的 post-remediation binding，不作为当前字节已审的替代品。
- `doc/evidence/platform/rm1/p6/rm1p6-u13-c01-root-contract-registry-implementation-amendment.md`：C01 的静态 contract/control-plane 范围。
- `doc/decisions/2026-07-26-v2s-post-remediation-review-binding-governance.md`：post-remediation 不能替代 Claude recheck 的治理边界。
- `project-memory/decisions/incremental-compliance-hook.md`：已退役 receipt/baseline 机制与保留 changed-path list 的现行规则。

## 独立核验重点

- 原 review 的 S1 是否被 current exit 的 `staticProofStatus` 与 scope statement 准确消除；不得只采信作者说明。
- `validate-package-exit` 的 `PACKAGE_BASELINE_MISSING` 是否仍应保持为已退役机制的预期失败，而不是通过伪造 baseline 或新增 trim-mode validator 让它变绿。
- exit 是否仍将 C01 限定为 root OpenAPI / route-registry static proof，并保留 `business=NOT_APPLICABLE`、`cleanup=NOT_APPLICABLE`。
- `postRemediationRebind` 是否只作诚实 provenance 披露，未被误报为现字节已经由 Claude 或机器 package-exit 审核。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。findings 使用 `M` / `S` / `N`，每项包含精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 RM1 U13 C01 作一次限定的 post-remediation current-byte recheck。

背景：您此前对 C01 的 root OpenAPI / generated route-registry exact-set 修复给出 `GO — M=0 / S=1 / N=2`。S1 指出 package exit 的 `status: "PASS"` 没有机器 package-exit validator 支撑；Codex 没有恢复已退役的 baseline/receipt 机制，而是采用您建议的最小方案，将该字段改为 `staticProofStatus: "PASS"`，并明确它不是 machine-validated package exit。business 与 cleanup 仍为 `NOT_APPLICABLE`。

目标：请独立确认这一 current-byte 修复是否准确消除了 S1 的证据强度歧义，且没有把 C01 的静态契约分母 proof 升格成 package-exit、HTTP workload、CRUD 性能、business、cleanup 或 Roadmap 结论。

请从 catering-v2s 仓库根阅读：
- `doc/review/platform/2026-08-01-v2s-rm1-u13-c01-root-contract-registry-review-claude.md`：您原审的 S1/N1/N2；
- `doc/evidence/platform/rm1/p6/rm1p6-u13-c01-root-contract-registry-package-exit.json`：修订后的 current exit；
- `doc/review/platform/2026-08-01-rm1-u13-c01-root-contract-registry-author-resolution.md`：逐 finding 处置；
- `doc/evidence/platform/rm1/p6/rm1p6-u13-c01-root-contract-registry-package-input.json`：诚实的 post-remediation provenance；
- `doc/evidence/platform/rm1/p6/rm1p6-u13-c01-root-contract-registry-implementation-amendment.md`：C01 范围；
- `doc/decisions/2026-07-26-v2s-post-remediation-review-binding-governance.md`：recheck 不能被 post-remediation 记录替代的边界；
- `project-memory/decisions/incremental-compliance-hook.md`：已退役 baseline/receipt 与现行 changed-path list 规则。

请重点独立核验：`staticProofStatus` 和 scope statement 是否真的修复 S1；`PACKAGE_BASELINE_MISSING` 是否应继续作为已退役旧 validator 的预期失败而非被伪造为绿；business/cleanup 与 static-only 边界是否保持；以及 `postRemediationRebind` 是否没有被误报为 current bytes 已获复核。

烦请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次 GO/NO-GO 仅覆盖 C01 对 Claude S1 的 current-byte 证据表述修复；不授权 handler、owner、UI、generated artifact 手改、DEV、seed/reset、L2、HTTP workload、CRUD 性能结论、business/cleanup PASS 或 Roadmap 状态变更。谢谢。
```
