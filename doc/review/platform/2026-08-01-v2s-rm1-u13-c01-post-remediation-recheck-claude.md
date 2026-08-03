---
title: RM1 U13 C01 post-remediation current-byte recheck（Claude）
reviewTarget: IMPLEMENTATION
scope: C01 对 Claude S1 的 current-byte 证据表述修复
verdict: GO
findings: M=0 / S=0 / N=1
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅覆盖 C01 对 S1 的证据表述修复；不授权 handler、owner、UI、generated artifact 手改、DEV、seed/reset、L2、HTTP workload、CRUD 性能结论、business/cleanup PASS 或 Roadmap 状态变更
createdAt: 2026-08-01
---

# C01 post-remediation current-byte recheck

## 0. 结论

**GO — `M=0 / S=0 / N=1`。**

**`S1` 已在我点名的那一处、以我建议的最小方式准确关闭**，且**没有**把静态 proof 升格为
package-exit、HTTP workload、CRUD 性能、business、cleanup 或 Roadmap 结论。
`N1`（控制面附带改动的披露）也一并被吸收进 scope statement。

唯一的 `N` 是 exit 的 `review` 块没有登记本轮新出现的第二个独立 round 及其新开 N。

## 1. `S1` 是否真被修复 —— CLOSED

**字段本体**：`status` 这个键在 current exit 中**已不存在**（我实测 `'status' in exit → False`），
取而代之的是 `staticProofStatus: "PASS"`。

**scope statement**（`rm1p6-u13-c01-root-contract-registry-package-exit.json:47`）：

> staticProofStatus=PASS proves only static root OpenAPI/generated route-registry denominator closure
> **and the bounded successor-manifest bootstrap correction**. **It is not a machine-validated package
> exit**, HTTP workload coverage, CRUD efficiency/performance, DEV, seed/reset, managed L2,
> user-journey business PASS, cleanup PASS, or Roadmap closure.

我原审 `S1` 的原话是「字段名读起来像门的结果」——现在字段名不再占用 `status` 的既有门语义，
而且**用明文否定句直接排除了 machine-validated package exit**。歧义在原处消除。✓

**横向确认没有残留**：全仓检索 C01 相关工件中的 `PACKAGE_EXIT=PASS` / `"status": "PASS"`，
命中只剩三类——我上一篇 review 里的**历史引述**、review-request 里对该修复的**描述**、
以及上面这句 scope statement 本身。**没有任何工件仍宣称 C01 有 machine package-exit PASS。** ✓

**没有把改名扩散成新的歧义**：`package-input.json` 的顶层 `status` 值为
**`"ACTIVE_NOT_EXIT"`**——刻意措辞成不可被读作 exit 结果。✓

**顺带闭合我的 `N1`**：scope statement 现在明确把
"the bounded successor-manifest bootstrap correction" 列入 C01 的证明范围，
author resolution `:30` 也记 `N1=CONFIRMED_ALREADY_DISCLOSED` 并说明 amendment 已补根因/边界/红证据。
我原来要求的就是「一句话把它标出来」，已满足。✓

## 2. `PACKAGE_BASELINE_MISSING` 是否仍作为已退役 validator 的预期失败 —— 是，且不得改绿

我重跑 `validate-package-exit`：

```
PACKAGE_EXIT=FAIL   REASON=PACKAGE_BASELINE_MISSING
```

**失败原因与改名前完全一致**——这一点我特意核过：`validatePackageExit` 先调 `deltaState(root)`
（baseline 加载，`cli.mjs:2061` 抛 `PACKAGE_BASELINE_MISSING`），**之后**才做 schema 形状校验。
所以删掉 `status` 键**没有**把信号退化成 `PACKAGE_EXIT_INVALID` 这种更弱的 schema 报错，
它仍然精确地失败在**已退役的前置条件**上。✓

**而且「把它跑绿」是被项目记忆禁止的**：
`project-memory/decisions/incremental-compliance-hook.md:21` 的
`PACKAGE_EXIT_CHANGED_PATH_LIST_ONLY` 明写——package exit **只**保留本包实际变更文件的路径清单，
**不再要求** `actualChangedPaths` 与 `incrementalChecks` 双向 exact-set、逐条 `afterSha256` 复算
或 `sourceComplianceDisposition` hash 绑定。

因此 Codex 拒绝恢复 baseline/receipt 机制，**不是取巧，而是遵守现行规则**；
恢复它才会违反项目记忆。我原审给的两个最小选项中，(a) 改字段名正是唯一合规的一条，作者选对了。
`harnessTrimObservation` 仍如实记录 `legacyBaselineExitValidator: NOT_INVOKED_DURING_OBSERVATION`
及其移除属独立控制面后续项。✓

## 3. business / cleanup 与 static-only 边界 —— 保持

`business = "NOT_APPLICABLE"`、`cleanup = "NOT_APPLICABLE"`（未变）。
`staticProof` 仍只声明 `rootOpenApiTuples=147 / generatedRouteRegistryTuples=147 /
duplicates=0 / twoWayDifference=0`——这四个数我在上一轮已独立重算确认，本轮未改动。
scope statement 的否定清单覆盖 HTTP workload、CRUD 性能、DEV、seed/reset、managed L2、
journey business PASS、cleanup PASS、Roadmap closure。**无越级。** ✓

## 4. `postRemediationRebind` 是否被误报为 current bytes 已复核 —— 没有，反而是范本

`rm1p6-u13-c01-root-contract-registry-package-input.json` 的 `postRemediationRebind`：

```json
{"version":"POST_REMEDIATION_V1",
 "historicalClaudeReview":{"path":"…review-claude.md","sha256":"1ef27451…"},
 "intake":{"path":"…author-resolution.md","sha256":"9e05c7b0…"},
 "currentBytesNotReviewedByOriginalReview": true,
 "claudeRecheckRequired": true,
 "implementationAuthority": false}
```

**两个绑定 hash 我逐个复算，均 MATCH**（`1ef27451…` = 我上一篇 review 的当前字节；
`9e05c7b0…` = author resolution）。`deliveryManifestSha256` 亦 MATCH。

`currentBytesNotReviewedByOriginalReview: true` + `claudeRecheckRequired: true`
正是 `doc/decisions/2026-07-26-v2s-post-remediation-review-binding-governance.md` 要求的边界：
**post-remediation 记录不能替代 recheck**。它没有借我的历史 GO 覆盖新字节，
也没有自授 implementation authority。✓

## 5. N1 ｜exit 的 `review` 块未登记 round 2 及其新开 N

`changedPaths` 中新增了
`doc/review/platform/2026-08-01-rm1-u13-c01-root-contract-registry-implementation-adversarial-review-round2.md`，
它是一次**盲审在先**（`authorMaterialReadAfterIndependentVerdict=true`）的独立 round-2，
结论 `GO — M=0, S=0, N=1`。

但 exit 的 `review` 块仍只有：

```json
{"round1":"…round1.md","authorResolution":"…author-resolution.md",
 "verdict":"GO_M0_S0_N1",
 "openNonBlockingFinding":"N-01: CURRENT_STEP phase vocabulary is not a standards-coverage phase; …"}
```

两个问题：

1. **round 2 没有被引用**。两轮 verdict 形状恰好相同（都是 `M=0/S=0/N=1`），
   所以记录的 `verdict` 值不算错；但读 exit 的人无法得知在整改后的字节上还做过一次独立复核。
2. **两个 N-01 不是同一件事，exit 只登记了其中之一。**
   round-1 的 N-01 是 standards phase 词表（`RM1-P6-3` `UNKNOWN_PHASE`）；
   round-2 的 N-01 是 **delivery manifest 的 `complianceRoute.owner=platform-asset`
   不在六维召回词表内**（有效上位 owner 是 `platform`），状态 `CONFIRMED`、属既有 route 元数据、
   需由词表/源 owner 单独裁定。我在 exit 与 amendment 中检索 `route vocabulary` 相关字样，
   **零命中**——该开放项在包证据里没有落点。

**影响面**：仅证据可追溯性。它不影响契约分母闭合，也没有制造越级主张。
**最小修复**：`review` 块补 `round2` 路径，并把 `openNonBlockingFinding` 改为数组同时登记两条。
**是否需要 Dexter 产品裁决**：否。

## 6. 处置

- **`N1`** 在既有批准边界内，Codex 可自主处置。
- **不得回退**：`staticProofStatus` 字段名与「not a machine-validated package exit」的明文否定、
  `PACKAGE_BASELINE_MISSING` 作为已退役 validator 的如实失败（不得改绿、不得恢复 baseline/receipt）、
  `business`/`cleanup` 的 `NOT_APPLICABLE`、
  以及 `postRemediationRebind` 的 `currentBytesNotReviewedByOriginalReview` / `claudeRecheckRequired` 声明。
- **本 GO 仅覆盖** C01 对 `S1` 的 current-byte 证据表述修复；
  不授权 handler、owner、UI、generated artifact 手改、DEV、seed/reset、L2、HTTP workload、
  CRUD 性能结论、business/cleanup PASS 或 Roadmap 状态变更。
  我上一轮已确认为真的 147/147 exact-set 与三类红变异结论不因本次改名而变化。
