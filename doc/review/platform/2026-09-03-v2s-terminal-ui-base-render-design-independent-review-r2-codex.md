# V2S Terminal UI Base Render Design Independent Review R2

REVIEW_CYCLE_ID=2026-09-03-TER-UI-BASE-RENDER-DESIGN-01  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
reviewerInputChecklist={path:doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-input-checklist-round2-final-codex.md,sha256:7265ee4436059d1ee5449f6fe16a00509c457da68f7700453f6e736356d6e350}  
blindReviewDeclaration=先读第1-3节独立形成最终 verdict，后读第4节作者材料  
authorMaterialReadAfterIndependentVerdict=true  
ROUND_FINAL_DECISION=SELF_DECIDED  
VERDICT=NO-GO  
M=0 S=1 N=0

## 0. Blind review boundary

This artifact is the round-2 final review artifact for the same review cycle. I first read the round-2 checklist and its sections 1-3, then reopened the round-1 frozen checklist sections 1-4 and their referenced inputs before forming this independent verdict. At this blind-verdict point, I have not used the round-1 artifact or author intake as evidence.

No source, requirement, IA, implementation design, implementation plan, tests, or existing review artifact was modified. The only write target is this artifact.

Evidence class: static source and document readback only. This review does not claim render implementation, behavior tests, DEV, seed, L2, UAT, deployment, or runtime proof.

## 1. Independent verdict

NO-GO for DESIGN closeout.

The revised IA/design/plan mostly closes the round-1 risk shape: current-source precedence is explicit, `layerTier` is narrowed to render technical ordering, R-14 public export count is coherent with current skeleton exports, T-10 covers the S-6 consumer-side lifecycle, TR-10 README is in the future implementation denominator, and L2/UNENFORCEABLE boundaries are not overclaimed.

One significant executable-oracle gap remains: the design declares `definePart({ layerTier: undefined })` invalid while omission is valid, but the named test/review matrix does not make that own-property `undefined` case a unique required oracle/red vector. A future implementation can satisfy the visible T-9b/R-11 wording while still collapsing explicit `undefined` to the default `standard`, violating the design's own stricter contract.

## 2. Findings

### S-1 — CONFIRMED — `layerTier: undefined` invalidity is specified but not uniquely protected by T/R oracle

Severity: S  
Status: CONFIRMED

Claim checked: `RendererBinding` / `definePart` must distinguish omitted `layerTier` from an own property whose value is `undefined`; omission is valid and materializes a default, explicit `undefined` is invalid and must throw.

Evidence:

- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:260-271` specifies `definePart<TProps extends object>` with `RenderComponentProps<TProps>`, canonical ownKeys, output `layerTier` materialization, and explicit invalid shape: `layerTier: undefined` with an own property must throw; omission is the only default path.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:93-96` repeats the implementation rule: omitted `layerTier` defaults to `standard`; own `layerTier: undefined` is invalid and throws.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:359` defines T-9b as canonical ownKeys/readonly plus red vector for loosened validation, missing `layerTier`, or title/description leakage. It does not explicitly require the own-property `undefined` input case.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:379` defines R-11 as field cross-contamination from requirements/POC/source/T-9a/T-9b/R-3/R-4. It does not name the omission-versus-explicit-undefined distinction.
- `doc/platform/requirements/2026-09-03-v2s-terminal-ui-base-render-requirements-fourth-version.md:560` keeps T-9b at `{ rendererKey, component, layerTier? }` and title/description exclusion; `doc/platform/requirements/2026-09-03-v2s-terminal-ui-base-render-requirements-fourth-version.md:584` keeps R-11 at field cross-contamination. The revised implementation docs intentionally override stale/current-source requirement wording elsewhere, but this oracle gap remains visible in the active design/plan T/R denominator.

Counterexample that would pass the named wording but violate the stricter design:

```ts
const binding = definePart({
  rendererKey: "x",
  component: Component,
  layerTier: undefined,
});
// Implementation treats undefined like omission and returns layerTier: "standard".
```

This implementation can still produce canonical output ownKeys, omit title/description, avoid field cross-contamination, and satisfy a broad "validation loosened" mutation unless the own-property `undefined` case is named as a mandatory negative oracle.

Minimal fix:

- Extend T-9b or add a narrow adjacent T item so CP1 must assert that an input object with own `layerTier` set to `undefined` throws.
- Extend R-11 or the CP1 review gate to read back this exact case from source/tests.
- Add one production red vector: mutate `definePart` to coalesce own-property `undefined` to `standard`; the focused test must fail.

Applicability boundary:

- Applies only to `definePart` input validation and the declared `RendererBinding` construction contract.
- Does not change the accepted rule that omitted `layerTier` defaults to `standard`.
- Does not require product/Journey semantics for `layerTier`.
- Does not require render implementation evidence in this design review.

## 3. Same-root checks with evidence

### 3.1 Current-source precedence and S-6/S-7 single fact

Status: REJECTED_WITH_EVIDENCE for the old dual-fact/compatibility concern.

- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:20-29` and `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:37-40` explicitly declare current-source wins, no compatibility `containerKey`, no `getStore` compatibility adapter, no double shape.
- Current `apps/terminal/kernel/base/ui-state/src/types/catalog.ts:8-17` defines `containerKeys`.
- Current `apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:61-72` enforces exact ownKeys including `containerKeys`.
- Current runtime source `apps/terminal/kernel/base/runtime/src/types/runtime.ts:64-85` includes `status`, `subscribe`, `getState`, and `getStore`; the render design maps status from the property rather than inventing a `getStatus` source API.

Residual boundary: requirements still contain historical stale wording for singular `containerKey` and no `subscribe`, but the target docs classify requirements sync as a future implementation prerequisite rather than design evidence.

### 3.2 `layerTier` semantic boundary

Status: REJECTED_WITH_EVIDENCE for product/Journey overreach; S-1 remains for the executable undefined oracle only.

- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md:48` states `layerTier` is a stable renderer property used only for layer render tree order and not ui-state content or assembly override.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:413-416` states IA only adds render tree ordering and does not decide product priority.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:428-431` marks any future business/Journey visibility use as requiring a Dexter decision.

### 3.3 `RendererBinding`, generic surface, canonical ownKeys

Status: PARTIALLY_CONFIRMED.

- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:260-277` and `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:93-100` specify named generic `TProps extends object`, `RenderComponentProps<TProps>`, canonical output ownKeys, no `any`/`Record`/double-cast escape, omitted/defaulted `layerTier`, and invalid explicit `undefined`.
- The generic and canonical output rules are reviewable. The explicit `undefined` rule is not uniquely protected by the T/R denominator; see S-1.

### 3.4 R-14 public export count

Status: REJECTED_WITH_EVIDENCE for mismatch concern.

- Current skeleton `apps/terminal/ui/base/render/src/index.ts:1-2` exports only the three existing infrastructure fields.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:230-247` defines the future public surface as the 3 existing infrastructure exports plus 13 domain exports, total 16.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:251-253` explicitly excludes `RenderStateSource`, fallback components, Runtime module/factory/key/dispatch/getStore/automation exports.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:382` and `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:81-89` keep R-14 aligned with the same 16-export target.

### 3.5 T-10 S-6 consumer-side coverage

Status: REJECTED_WITH_EVIDENCE for coverage omission concern.

- S-6 design `doc/plans/platform/2026-09-03-v2s-terminal-kernel-base-runtime-s6-subscription-implementation-design-codex.md:87-93` defines the relevant runtime lifecycle semantics.
- Render target design `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:143-147` requires a fake `stateSource` with lifecycle observation and root identity coverage.
- T-10 at `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:360` covers pre-start getState blocked, starting→started re-read, started state change sync, failed unavailable surface, unsubscribe exactly once and idempotent, selector root identity/cache, and listener count oracle.
- CP2 plan `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:111-128` carries the same status/source/selector/unsubscribe oracle into the future implementation plan.

### 3.6 TR-10 README denominator

Status: REJECTED_WITH_EVIDENCE for missing future denominator concern.

- `project-memory/operations/terminal-coding-standard.md:34-45` and `doc/platform/terminal-ui-coding-standard.md:377-405` require a Chinese README for each terminal workspace package at implementation closeout.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:298-306` explicitly adds TR-10 README sync to the future render implementation denominator.
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:189-190` makes CP5 update the README and compare public API/usage examples/test commands against code and tests.

### 3.7 T/R full set, fallback classes, Provider contract, production red vectors, L2 boundary

Status: REJECTED_WITH_EVIDENCE for the broad omission concern, except S-1.

- T-1 through T-13 and R-1 through R-20 are present at `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:342-388`.
- Five fallback classes are preserved by IA IDs `RENDER_SURFACE_ROOT`, `RENDER_SCREEN_CONTAINER`, `RENDER_LAYER_STACK`, and `RENDER_DIAGNOSTIC_FALLBACK` in `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md:17-29`, and by the testID/error-boundary matrix at `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:394-409`.
- The Provider state source is intentionally narrow: `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:46-51` rejects a full Runtime dependency and adopts a `stateSource` port with status/state/subscribe semantics; `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:208-211` maps runtime adapter ownership.
- T-13/R-19 require two real production red vectors at `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:363,387,390-392` and `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:175-179`.
- L2 is not claimed: `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:104-113` and `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:411-416` preserve the static/behavior/L2 boundary.

## 4. Unverified and non-claims

- Render implementation is NOT_STARTED; current `apps/terminal/ui/base/render/src/index.ts` still contains only infrastructure exports.
- Future focused tests, typecheck, invariant checks, and behavior harness are planned but not executed in this design review.
- DEV, seed/reset, browser L2, UAT, deployment, native/Hermes runtime, and user-visible end-to-end behavior remain unverified and unauthorised for this review.
- S-6 output and current source are used only as source-denominator evidence, not as proof that render has already been implemented.

## 5. Author materials comparison

Status before section-4 read: NOT_READ_AT_INDEPENDENT_VERDICT_TIME.  
Status after section-4 read: READ_AFTER_INDEPENDENT_VERDICT.

Section-4 material hashes were verified before comparison:

- `doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-independent-review-r1-codex.md` — `12452e849e1255706e38086a91889c9e884cc3b6c57ceccdd7b5104f7c1acc10`
- `doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md` — `d25f22514b94680ec5c97bb1f8a3abb1f21e662f34d115eb6ce1edac8e049fdd`

The independent verdict and S-1 finding above were formed before reading these materials. This comparison records only whether the author materials close or preserve differences; it does not rewrite the blind verdict from author claims.

### 5.1 Round-1 findings now closed by current revised design/plan

Status: REJECTED_WITH_EVIDENCE for carrying these round-1 findings forward as current blockers.

- Round-1 M-1/M-2 around S-6/S-7 stale current facts are no longer current design blockers: the revised target design/plan explicitly says current source wins, uses `containerKeys`, consumes `Runtime.status/getState/subscribe`, and forbids compatibility fields/fallbacks (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:20-29`; `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:37-40`). The author intake also identifies this as source-precedence repair (`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md:17-28`).
- Round-1 M-3 diagnostic schema conflict is closed at design level: lifecycle observation is separated from part diagnostics in IA/design (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md:24-29,50-59`; `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:394-409`). The intake records the same repair (`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md:41-49`).
- Round-1 M-4 product/Journey overreach is closed for this design target: the revised target docs narrow `layerTier` to render technical tree sorting and leave future business/Journey use to Dexter decision (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md:48`; `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:413-416,428-431`). The intake records this as repaired by boundary (`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md:50-59`).
- Round-1 S-1 layer tie-break is closed: T-3 includes tier/order/tie-break red vector (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:351`) and the intake records closure (`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md:63-68`).
- Round-1 S-3 public export denominator is closed: current revised design and plan explicitly require 3 existing infrastructure exports plus 13 domain exports, total 16 (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:230-247,305,382`; `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:85-89`). The intake records the same `INFRASTRUCTURE_EXPORTS` + `DOMAIN_EXPORTS` split (`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md:80-86`).
- Round-1 S-4 render-side T-10 coverage is closed at design level: T-10 now includes pre-start/status/failed/sync notification/snapshot/root/selector identity/unsubscribe/lifecycle oracle (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:360`; `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:111-128`). The intake records the same expansion (`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md:88-95`).
- Round-1 S-5 README denominator is closed: current revised design/plan include package-root README as a future implementation closeout denominator (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:306,326`; `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:187-190`). The intake records this repair (`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md:97-103`).
- Round-1 S-6 `any` typed boundary is closed in the revised design: named generic `RenderComponentProps`, `RenderComponent<TProps>`, and `RendererBinding<TProps>` replace public `any` (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:257-277`; `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:98-100`). The intake records the same repair (`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md:105-111`).

### 5.2 Difference retained against author intake

Status: CONFIRMED; retained as S-1 in this artifact.

The author intake says round-1 S-2 is repaired because the revised design now states named generic binding, output ownKeys, default materialization, and explicit `undefined` invalidity (`doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-intake-codex.md:70-78`). I agree that the object-shape definition was repaired. The retained issue is narrower and later in the proof chain: the current T/R oracle does not uniquely require an input object with own `layerTier: undefined` to throw.

Why retained:

- The target design declares the invalid input at `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:269-271`.
- The target plan repeats it at `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:93-96`.
- T-9b only names canonical binding ownKeys, title/description leakage, loosened validation, and missing layerTier red shape (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:359`).
- R-11 only names field cross-contamination (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:379`).
- CP1 proof lists T-9b/R-11 but does not add this exact negative input case (`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:103-105`).

Therefore the author material closes the previous type-shape ambiguity but does not close this round-2 proof-denominator ambiguity. The minimal fix remains to bind the own-property `undefined` case to T-9b/R-11/CP1 and add a production red vector that coalesces explicit `undefined` to default `standard`.

## 6. Final review closeout

ACTION_1_VARIANT=1-B 文档提取与同根源码对账  
SAME_ROOT_SCAN=已对 round-1 冻结输入清单第1-4节、round-2 第1-3节目标输入、current runtime/ui-state/render source、S-6 design/plan/source/tests/harness、render skeleton、T/R 分母、fallback 五类、Provider 三件套、T-13/R-19 production red vectors、TR-10 README 与 L2/UNENFORCEABLE 边界做同根复核；第4节作者材料只在独立 verdict 后读取并做差异记录。  
DESIGN_GAPS=S-1：`definePart` 输入自有 `layerTier: undefined` 必须抛错这一 stricter contract 已写入设计/计划，但没有作为唯一可执行 T/R oracle 与 production red vector 被绑定。  
L1_ENGINEERING=NO-GO on design proof denominator; current source/package baseline 已读；未运行 render typecheck、Vitest、static/behavior harness。  
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON:本 scope 是无产品 Journey 的 toolkit DESIGN review，当前授权不含 L2、浏览器、设备或 UAT；真实视觉 z-order 与 fallback 视觉质量不作结论。  
L3_UNVERIFIED=render package 尚无实现、`.tsx` 测试、Vitest config、static/behavior harness；React snapshot/selector/fallback/tree-order 未运行；DEV、seed/reset、L2、UAT、deployment 未授权且未执行。  
EVIDENCE_TIER=静态设计/源码/规范/作者材料差异对账；未来命令、S-6 output、自评与计划中的 mutation/cleanup 不作为 render 已实施证据。  

VERDICT=NO-GO  
M=0 S=1 N=0  
ROUND_FINAL_DECISION=SELF_DECIDED  
reviewerKind=INDEPENDENT_SUBAGENT  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2
