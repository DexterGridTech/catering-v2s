---
title: RM1 P6-3 平台邀请面退役与受管 L2 引导独立设计对抗审查（round 2）
status: NO_GO
reviewTarget: DESIGN
reviewerKind: INDEPENDENT_SUBAGENT
reviewCycleId: RM1P6-U03-PLATFORM-RETIREMENT-DESIGN
reviewRound: 2
reviewRoundLimit: 2
roundFinalDecision: SELF_DECIDED
furtherCodexAdversarialRoundAllowed: false
blindReviewDeclaration: true
authorMaterialReadAfterIndependentVerdict: true
implementationAuthority: false
---

# Verdict

`NO-GO (M=2 / S=2 / N=1)`。

这是同一 `RM1P6-U03-PLATFORM-RETIREMENT-DESIGN / DESIGN` cycle 的第二轮、也是最后一轮独立子 agent 审查。审查者在收到作者 finding intake 前，先以 IA01 的 operations-only invitation 任务、IA03 的单账号内容页、真实 generator 输入、当前 active-package 与 production source 尝试证伪修订设计；独立结论形成后才读取 intake。没有把 author 的 `CONFIRMED` 或任何静态命令成功当作证据。

方案的业务方向仍正确：移除 platform-admin 的重复邀请入口、保留已批准的 operations 五类 target-specific invite 与 public acceptance，是比“只隐藏 Tab、为 fixture 保留 platform HTTP”更小且正确的路径。问题在于修订后的 package 还没有成为可验证、可准入的实施设计，且 UI prewrite 基线不满足逐控件准入。

## Findings

### M1 — U07 不是可验证的 implementation-facing delivery unit，也没有进入唯一 granularity manifest

`rm1p6-u07-platform-invitation-retirement-manifest.json` 自称 delivery manifest，却使用 `kind=rm1-implementation-delivery-manifest`、`status=READY_FOR_INDEPENDENT_DESIGN_REVIEW`，缺少 production validator 需要的 `programId`、`goalId`、design/authorization bindings、adversarial policy、`currentDeviation`、`termSource`、五类 evidence 和六类 denominator 的 `owningSourceSet`。实跑：

```text
scripts/check/implementation-design-granularity \
  --manifest doc/evidence/platform/rm1/p6/rm1p6-u07-platform-invitation-retirement-manifest.json \
  --review doc/review/platform/2026-07-31-v2s-rm1p6-u03-platform-invitation-retirement-design-review-round1.md
=> FAIL: MANIFEST_IDENTITY_INVALID
```

更关键的是，详设第 43 行规定要在 `rm1-u09-implementation-design-granularity-manifest.json` 增加 hash-bound serial sub-unit；当前该唯一受支持 manifest 的 unit set 仍是 `U06/U01/U02/U03/U04/U05`，不存在 `RM1P6-PLATFORM-INVITATION-RETIREMENT-U07`。因此新 package input 和 successor admission 指向的对象不能取代实施前的 granularity/governance 闸门，也不能作为真实 package-exit 分母。

风险是激活后会在没有六类 source-binding、review-to-unit binding 与 receipt set-equality 支持的情况下修改 IA、frontend、OpenAPI 与 generated output。最小修复是把 U07 作为合法 serial delivery unit 接入唯一的 U09 granularity manifest（或按现有 validator schema 提供等价、已接线的独立 manifest），完整绑定 current design/authorization、六类 owning sources、term/evidence、review linkage 与 exact surfaces；随后以该受支持 manifest 重跑 granularity 验证。不得通过放宽/绕开 validator 或把 standalone JSON 当作通行证。

### M2 — 标为 PASS 的 U07 UI prewrite baseline 没有逐控件十维事实，不能准入 `AccountsPage.tsx`

`rm1p6-u07-platform-invitation-retirement-ui-ia-baseline.json` 对唯一保留 `.tsx` consumer 只给出 screen ID、一个业务任务句子和十个维度名称；没有为 `role-scenario`、入口/形态、具体控件变更（移除 invitation Tab/entry）、数据级联、错误/权限状态、刷新/导航、test-id/accessibility 提供各自的 IA/physical source-bound facts。对两个要删除的 production consumer 也只有 path/hash/disposition，未记录其现有控件与 IA01 的不一致及删除后不得回归的事实。

这不满足 `UI_IA_PREWRITE_BASELINE_REQUIRED` 所要求的“每个实际 consumer 精确列出 screen ID、业务任务、控件维度和 IA/physical source hash”，也无法让后续 reviewer 逐点验证 pre/post reread。现有 U02 baseline 对 `AccountsPage.tsx` 的旧 `账号/邀请 Tab` 描述反而证明该点是实质交互变更，不能用维度名称代替值。

风险是实现者仅删 import/state/render 却遗漏同一账号面可见的 invitation entry、测试/可访问性断言或 owner readback 行为。最小修复是在 U07 baseline 中对 retained 与 retired consumer 分别写出十维的具体事实、IA anchor、physical/roster binding 与禁止回归项；把 `AccountsPage` 的“单一账号内容页、无 invitation Tab/entry、保留名称链接→详情→动作”精确绑定，再在实际 activation 的 `uiInteractionAdmission` 中逐路径绑定。此 finding 阻止任何 U07 production `.tsx` 写入。

### S1 — generator input 的“three actual augmentation keys”与真实 catalog 不符

详设第 22 行及 author intake 均称五个退役 operation 对应 `operationErrorAugmentations` 的“三个实际 key”。实读 catalog，只有 `createWorkspaceInvitation` 与 `cancelWorkspaceInvitation` 两个 key；`getWorkspaceInvitations`、`getWorkspaceInvitationCandidates` 与 `reissueWorkspaceInvitation` 没有 augmentation。`scenarioIds` 五条均为 `D04-S05P`，placement 的五条 entry 则有真实 `pathFile`，与 round-1 的旧判断不同。

风险是把虚构的第三项写入删除分母，导致 source closure 与 receipt 叙述不真实。最小修复是将设计、U07 manifest、package-exit denominator 和 red proof 改为“精确五 operation + 精确二 augmentation key”，并仍让 controlled `edge-codegen --write-receipt` 决定最终 generated-output set；不要从 scenarioIds、placement path 或 schema 名称推导额外删除项。

### S2 — audit retain/operations counterexample 仍没有被具体 focused proof 覆盖

设计与 manifest 正确要求 platform audit 只移除 `WORKSPACE_INVITATION` 并保留 `WORKSPACE_ACCOUNT`/`WORKSPACE_ROLE`，同时保留 operations audit 的 invitation audit。但当前 U07 exact `changeSurfaces` 没有任何 platform audit focused test source；仓内也没有该 controller 的对应 test path。`AccountsPage` 的两个 test 不会证明 controller switch 的 platform reject 和 operations retain。

风险是字符串式清理误伤 account/role，或 platform 删除后误删除 operations audit。最小修复是把一个具体的 platform audit controller focused test 与一个 operations audit retain assertion 纳入 exact surface/receipt denominator，证明平台对 invitation target 拒绝、platform account/role 仍可 dispatch、operations invitation audit 仍可 dispatch；该 proof 必须在静态 exit 前执行，不能由 L2 代替。

### N1 — 当前 U03 historical receipt-chain FAIL 保持披露，不得被 U07 叙述为已关闭

本轮 `node tools/compliance-control/cli.mjs static-scan` 的首败仍是 `INCREMENTAL_RECEIPT_CHAIN_MISSING:doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-granularity-manifest.json`；`scripts/check/affected-l2` 仍为 `R5_AFFECTED_L2_LAYOUT_DERIVATION_DRIFT:OPERATIONS-PASSWORD`。修订设计把后者正确放到未来独立 L2 package，且没有把 static/codegen 说成 L2、business 或 cleanup PASS。U07 只可在 M1 修复后的新 baseline 中处理自身变更，不能改写此 historical finding；它仍需由其 owning package/后续正确基线如实处理。

## Reviewer input checklist

| Input | Path / command | SHA-256 or result | Read / result |
| --- | --- | --- | --- |
| Entry and Claude contract | `AGENTS.md`; `CLAUDE.md`; `PLATFORM-BLUEPRINT.md` | `82564a7…`; `8b12b36e…`; `29bcd893…` | READ_FULL |
| Current authority | registry + `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `f3e232d2…`; `d2490f50…`; `CURRENT_STEP=RM1-P6-3`, authority=true | READ_CURRENT |
| All kernel | `project-memory/kernel/01`–`06` | index-bound hashes `f8add1ef…` through `5c52b17a…` | READ_ALL |
| Six-dimension routes | `review/platform/platform-admin/platform/evidence/review`; `review/admin-ui/operations-admin/frontend-platform/governance/implementation` | both successful; all returned paths reopened | RUN_AND_READ_ALL |
| Routed memory and owning sources | corpus G-05/G-07; source reread, verification, systemic repair, hook and independent-review decisions | `51415f7…`; `82bcb60c…`; `0e786e55…`; referenced owners reopened | READ_ALL |
| IA / physical inputs | IA01, IA03, physical contracts, final roster, U02 baseline | `7e2ae73f…`; `88a26ba1…`; `7687ed3d…`; `6d728e05…`; `e84c6907…` | READ_FULL / anchors reopened |
| Corrected object | retirement/L2 design; U07 manifest/input/amendment/problem/source disposition/UI baseline | `6b635697…`; `6b071872…`; `0acc29a0…`; `41aa55e7…`; `b58c6cdc…`; `bb3eb14e…`; `9329e566…` | READ_FULL |
| Controls and source | active package successor admission; `implementation-design-granularity`; `edge-codegen`; platform/operations/public controllers and consumers | current bytes reopened | READ_FULL |
| Author material | `...design-finding-intake.md` | `01c7dfdd…` | READ_AFTER_INDEPENDENT_VERDICT |
| Mechanical checks | `edge-codegen --check`; `affected-l2`; `standards-coverage --phase R5`; U07 granularity command; static-scan | `PASS FILES=246`; `FAIL OPERATIONS-PASSWORD`; `PASS RULES=150`; `FAIL MANIFEST_IDENTITY_INVALID`; `FAIL INCREMENTAL_RECEIPT_CHAIN_MISSING` | RUN |

No implementation exists for this proposed unit, so per-change prewrite/post-proof receipts are not evidence and are not substituted by this review. They remain mandatory once the corrected delivery unit is admitted.

## Round-final decision and authorization boundary

`ROUND_FINAL_DECISION=SELF_DECIDED`; no third Codex adversarial round is permitted for this cycle. This verdict does not authorize source, contract, data, fixture/bootstrap, DEV, seed/reset, remote execution, L2, business PASS or cleanup PASS. It leaves the approved operations/public invitation journey intact and requires the author to resolve the four findings through the existing governance path before any implementation admission.
