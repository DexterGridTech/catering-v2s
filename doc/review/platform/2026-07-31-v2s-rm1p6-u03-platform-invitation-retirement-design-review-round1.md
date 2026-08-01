---
title: RM1 P6-3 平台邀请面退役与受管 L2 引导独立设计对抗审查（round 1）
status: NO_GO
reviewTarget: DESIGN
reviewerKind: INDEPENDENT_SUBAGENT
reviewCycleId: RM1P6-U03-PLATFORM-RETIREMENT-DESIGN
reviewRound: 1
reviewRoundLimit: 2
reviewerInputChecklistPath: doc/review/platform/2026-07-31-v2s-rm1p6-u03-platform-invitation-retirement-design-review-round1.md#reviewer-input-checklist
reviewerInputChecklistTemplateSha256: 0ef12f041bae6b4411bb4b4b3f15f2860796b31f3dab5894738fdd17441b63fe
blindReviewDeclaration: true
authorMaterialReadAfterIndependentVerdict: false
implementationAuthority: false
---

# Verdict

`NO-GO (M=2 / S=3 / N=1)`。

本轮是 fresh v2s-rooted `INDEPENDENT_SUBAGENT` 盲审：先尝试证伪本设计，并在未读取作者自评、finding intake 或作者结论的前提下形成下列 findings 与 verdict。`authorMaterialReadAfterIndependentVerdict=false`；本轮没有把任何自报 PASS 当作证据。

## 方案合理性

业务问题本身正确：G-07 要求新增任职经邀请接受生效，而 IA01 把该任务限定在运营管理后台五个 target-specific 用户页；删除 platform-admin 的重复邀请管理面是更短、更清晰的用户路径。较小替代是仅在 platform-admin 隐藏 Tab、继续保留 platform HTTP 供 L2 调用；它会继续留下未批准的操作面和生产兼容面，不能接受。

但当前方案以 39 行摘要同时要求删除双端契约/代码生成闭包、重冻结 IA03、替换受管 L2 seed 和证明零 runtime HTTP/SQL；其粒度不足以使实施者安全执行或使 reviewer 判定闭包。问题方向正确，交付形态不成立，故 NO-GO。

## Findings

### M1 — 没有可执行的退役闭包或 package-exit 分母

被审设计只列类别，没有为本次新增范围提供 delivery manifest、六类 package-exit source denominators、逐路径 owning source、pre/post readback 或 actual-changed-path/incremental-receipt set equality。现有 `RM1P6-U03` package input 的 `sourceBindings` 和 `packageExitSourceDenominators` 都是 `null`，且仍绑定 U09 manifest；这不足以承载本次 platform 退役。

实际同一闭包至少横跨 `AccountsPage.tsx`、`InvitationsPage.tsx`、`PlatformAuditHistoryModal`/barrel、两个 platform invitation controller、platform audit dispatch、OpenAPI、governance manifest、edge catalog/report、受控 generated outputs、tests 和 IA03/physical-roster bindings。没有精确分母会允许删页面但遗留 HTTP/wire，或删同名 operations/public 能力。

最小修复：先形成一个独立 implementation-facing manifest，将六类 source denominator、每条删除/保留反例、test path、controlled-codegen receipt 和 package-exit set equality 写为可验证条目；再进入实施。

### M2 — 受管 L2 bootstrap 不是可执行且可审计的设计

当前 `scripts/test/r5-platform-admin-l2-fixture-seed.mjs` 第 7 步实际通过 platform HTTP `createWorkspaceInvitation` 建立首个 operations account。新设计只声称一个 test-source-set-only `ManagedL2WorkspaceInvitationBootstrap`，但没有指定 test module/source path、启动命令/child classpath、Spring `WebApplicationType.NONE` 的实际 launcher、Service 调用参数和 `REQUIRED` transaction 边界、唯一 stdout frame protocol、token 的内存生命周期、run manifest/log path、cleanup 或可失败的 red cases。

因此它尚不能证明替代物不会成为 runtime HTTP/OpenAPI 面、不会退化为直接 SQL，或不会把 token 写入 stdout/evidence。`scripts/check/affected-l2` 的 fresh 结果也为 `FAIL: R5_AFFECTED_L2_LAYOUT_DERIVATION_DRIFT:OPERATIONS-PASSWORD`，而设计没有为联合 L2 前置红项给出 owning disposition。

最小修复：将 bootstrap 作为独立 L2 implementation set，写明准确 source-set/launcher/managed-run attachment/affected-L2 selection，规定只调用 `WorkspaceInvitationService` owner API、禁止 JDBC/Controller/RequestMapping/OpenAPI/main source，并为每个边界提供实际 production-path red proof；同时在联合 L2 前关闭或明确处理当前 affected-L2 红项。

### S1 — codegen 输入与输出分母不完整，且叙述包含不存在的输入

五个 platform invitation operation 的 catalog 条目 `pathFile=null`，当前未拥有相应 `scenarioCrosswalk` 或 `operationErrorAugmentations`。实际 edge-codegen 还读取 placement report、error disposition catalog、admin catalog、frontend carry-over manifest 和 OpenAPI；fresh `node scripts/generate/edge-codegen.mjs --check` 报告 `FILES=246`。输出不仅是平台 TS/RTK、route/capability projection，还包括 Java wire、capability catalogs、两个 admin catalog 和另外两个 face 的 projection。

“至少包含”不能构成删除闭包。最小修复是在 manifest 中按 generator `expected()` 的真实输入/actual diff 记录 source and output denominator，并仅由 `--write-receipt` 写入后以 receipt 的精确 path set 验证。

### S2 — IA03 refreeze 的修改集合没有被冻结

当前 accepted IA03 的 `IA03-ACCOUNT-TAB` 明写“邀请 Tab 仅链接 IA01 已批准子流”；physical import contract、final roster 和 U02 IA baseline 又把该 screen 绑定到 `AccountsPage.tsx`。被审设计说只改 selector，却没有列出 IA03、physical import contract、final roster、U02 baseline、U09 manifest 及其 hash/roster 该如何一并更新，也没有给出替换后的准确 UI 文案和禁止项。

最小修复：把“账号”为唯一内容页、无 invitation Tab/entry，及 IA01 仅为 operations-admin 五个 target-specific 页面这一事实，作为受控 refreeze diff 和所有 hash-bound consumer binding 的同一 receipt；不可仅更新 IA03 的一行文字。

### S3 — 平台 audit 的保留边界未形成反例测试

删除 platform audit 的 `WORKSPACE_INVITATION` dispatch 合理，但当前 `PlatformAuditHistoryController` 将它与 `WORKSPACE_ROLE`、`WORKSPACE_ACCOUNT` 同一 switch arm。设计没有指定针对 platform 枚举/handler 的 focused test，也没有把 operations audit 仍支持 `WORKSPACE_INVITATION` 的非回归反例放入 receipt。按名称清理会错误伤害 operations-admin。

最小修复：加入 platform reject + operations retain 的双向 focused proof，并把 platform controller switch 和 operations controller 的留存路径显式列入分母。

### N1 — standards phase 应继续使用 R5

`scripts/check/standards-coverage --phase RM1P6-U03` 返回 `UNKNOWN_PHASE`；current U03 package input 的标准 phase 是 `R5`，fresh `--phase R5` 为 `PASS (RULES=150)`。后续 design/receipt 应一致使用 `R5`，而非把 package ID 当 standards phase。

## Reviewer input checklist

| Required input | Path / command | SHA-256 or result | Result |
| --- | --- | --- | --- |
| Entry chain | `AGENTS.md`; `CLAUDE.md`; `PLATFORM-BLUEPRINT.md` | `82564a7b…`; `8b12b36e…`; `29bcd893…` | READ_FULL |
| Registry and current Roadmap | `doc/platform/roadmap-program-registry.json`; `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `f3e232d2…`; `d2490f50…`; `CURRENT_STEP=RM1-P6-3`, authorization true | READ |
| All kernel | `project-memory/kernel/01` through `06` | hashes recorded in `project-memory/index.md` | READ_ALL |
| Six-dimension route | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner platform --impact architecture --trigger implementation` | route output SHA-256 `7f7361ef90033ecc233a38b02985647a986c2b855af8490ff57c8415674113ec` | RUN; every returned routed memory/source ref reopened |
| Corpus | `project-memory/decisions/confirmed-business-language-corpus.md` G-05/G-07; adoption policy | `51415f7d…`; `04d93294…` | READ; invitation/assignment matches G-05/G-07 |
| Reviewed object | `doc/plans/platform/2026-07-31-v2s-rm1-p6-3-platform-invitation-retirement-and-managed-l2-bootstrap-design.md` | `3ec2630aa8d54f8a7e516cb644f89bbc3bf57802def1ce5435bc2acaf340b872` | READ_FULL |
| Frozen IA / physical contracts / roster | IA01, IA03, U09 physical import contracts and final roster | `7e2ae73f…`; `88a26ba1…`; `7687ed3d…`; `6d728e05…` | READ |
| U03 and L2 inputs | U03 amendment/problem family; managed L2 design; affected-L2 registry | `9a907001…`; `86b169e4…`; `cdbbacc9…`; `2a65a3fc…` | READ |
| Code and generator | five-operation OpenAPI, governance manifest, platform controllers/audit, current fixture, `scripts/generate/edge-codegen.mjs` | generator `7ea0598e…`; source reopened with fixed-string recall | READ |
| All decisions title denominator | `doc/decisions/` sorted title listing | SHA-256 `51ef6f136b4f16114878de8bf26b25315896f529e6dd7a4df727b9899e25df8f` | TITLES_REVIEWED; relevant full decisions reopened |
| Standards / verification | matrix; verification governance | `7f59478c…`; `c9632a65…` | READ; R5 coverage PASS, 150 rules |
| Fresh mechanical checks | `node scripts/generate/edge-codegen.mjs --check`; `scripts/check/affected-l2`; `scripts/check/standards-coverage --phase R5` | `PASS FILES=246`; `FAIL R5_AFFECTED_L2_LAYOUT_DERIVATION_DRIFT:OPERATIONS-PASSWORD`; `PASS RULES=150` | RUN |

Per-change prewrite/post-proof reread is `NOT_YET_AVAILABLE`: this is a pre-implementation design review, so no proposed change has a receipt. Its absence must remain a mandatory implementation admission/receipt condition, not be substituted by this broad review.

## Authorization boundary

This verdict only rejects the present design from implementation admission. It does not authorize source, contract, data, seed/reset, runtime, L2 execution, or any product/Journey expansion. A corrected design needs a fresh directed round-2 review; the cycle limit is two.
