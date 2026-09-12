# TER terminal admin console implementation-facing design independent review — round 1

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_CYCLE_ID=TERMINAL_ADMIN_CONSOLE_DESIGN_20260911
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=NO-GO
M/S/N=10/2/0
L1_ENGINEERING=FAIL
L2_USER_VISIBLE=FAIL
L3_UNVERIFIED=POC口令字节公式、Web/Android/native/release/focused/visual evidence
SAME_ROOT_SCAN=已覆盖 catalog→selector→actor→render、integration→SurfaceHost、input→LayerStack、debug descriptor、POC引用链
EVIDENCE_TIER=静态源码与设计文档对账；未执行动态验证
```

Reviewer: fresh independent read-only Codex subagent. No source, test, dependency, build, runtime, Web, Android, native, DEV, seed, UAT, deployment, or Git action was performed. This file records the round-1 report; it is not a product decision and does not authorize implementation.

## M findings

### M-01 — UI interaction artifact does not meet the required implementation-facing template

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md:5-18; doc/decisions/templates/ui-interaction-design-template.md:31-47,163-177,181-240,362-430`

The artifact is labelled implementation-facing but lacks the template's per-screen `CONSUMER_FACE`, `UI_SURFACE`, `HOST_AND_ENTRY`, `CONTAINER_LAYOUT`, low-fidelity wireframe, v2 counterpart inventory, L2 testID roster, implementation-facing control roster, state-boundary table, face/owner matrix, and Dexter visual-review conclusion. The prose contract is not enough to support implementation or L2.

Minimum repair: fill every required field per screen, or write an explicit `NOT_APPLICABLE_WITH_REASON` with the exact reason and evidence boundary; add the low-fidelity wireframe/IA surface and leave the Dexter visual decision `OPEN`. A smaller prose-only repair cannot be reconciled field by field or bind controls to the future script.

### M-02 — CT-2 snapshot contract is not transferred as specified

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md:484-486; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:239-243; apps/terminal/ui/base/render/src/foundations/surfaceHost.ts:13-21`

The requirement requires `SurfaceHostSnapshot.isHostPrimaryDisplay`, supplied by physical display index and Web source. The design primarily specifies `SurfaceRootProps → SurfaceContext`; current `SurfaceHostSnapshot` has no such field. Adding only a context prop cannot satisfy CT-2/A-59.

Minimum repair: freeze one data shape and transfer path across snapshot, SurfaceContext, Android/Web source, and integration, including pending behavior. Do not duplicate a separately hard-coded context boolean.

### M-03 — Dynamic surface identity has no trigger contract

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:28-31; apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:10-21; apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:119-129,236-240`

The design requires geometry recomputation, admin close, and focus/scroll discard on identity replacement, but current `SurfaceRoot` only receives display mode/container key, the integration path loses physical index, and source lookup is mode-keyed. No replacement key, identity token, event, or effect trigger is defined for a physical identity change that leaves `displayMode` equal.

Minimum repair: add a capability-named surface identity and freeze how it keys/remounts or triggers the lifecycle. Relying on display-mode changes alone cannot cover same-mode identity replacement.

### M-04 — “admission rejection first” is not assigned to the command owner

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:124-138; apps/terminal/ui/base/render/src/components/LayerStack.tsx:107-110; apps/terminal/kernel/base/ui-state/src/actors/contentActors.ts:176-196; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:119-128`

Current selector accepts only non-empty container keys, LayerStack reads all layers, and `openLayer` only checks duplicate layer IDs. The plan says “shared predicate” and render fallback but does not specify the command-owner admission point, typed rejection, or state invariant. Render-only filtering still allows an invalid layer into state.

Minimum repair: define one availability API with null layer placement, name the `ui-state` command/actor admission point, specify typed rejection and render fallback separately, and add the state-level red fixture. A render-only predicate cannot prevent invalid state.

### M-05 — A-15 focus path fails against the current focus owner

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/ui/base/render/src/components/LayerStack.tsx:136-158; apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts:31-35,60-64,148-159; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:354-356`

LayerStack suspends only on 0→1. The focus controller blocks all field focus while suspended. Therefore opening admin as 1→2 after a business layer leaves admin fields suspended; closing does not have a matching restoration event. The plan schedules the final A-15 test but does not specify a repair mechanism.

Minimum repair: freeze a focus owner/scope model and explicit 1→2, 2→1, 1→0 behavior, including restoration. A final focused test cannot replace the missing implementation contract.

### M-06 — Business-layer retention during surface replacement is a Dexter decision

`STATUS=PARTIALLY_CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:298-301; apps/terminal/kernel/base/ui-state/src/commands/clearLayers.ts:5-10; apps/terminal/kernel/base/ui-state/src/slices/workspaceSlices.ts:167-172; doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md:125`

The plan reuses a clear-all-by-display-mode operation while saying business content remains. Current clear behavior removes every layer for that display mode. The Journey itself says Dexter must decide if “business content” includes business layers. Reusing clear-all can remove a business layer.

Minimum repair: ask Dexter whether business content includes business layers. If yes, define an owner-scoped/transient cleanup operation; if no, explicitly state that only persisted business content remains and close the wording. Reusing the existing clear-all command without the decision is not safe.

### M-07 — Debug source priority is only described, not defined

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md:364-369,582; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:170-176; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:237-249`

The requirement requires a priority when packaging and startup sources coexist. The design and plan say only “deterministic priority”; they do not define source enum, precedence, default, or the four combinations. A-47/A-48 cannot be implemented or falsified from that wording.

Minimum repair: freeze source enum, precedence, default, explicit startup false semantics, and a complete truth table. “Deterministic” alone is not executable.

### M-08 — Exact POC password byte formula remains an implementation blocker

`STATUS=UNVERIFIED_REQUIRES_EVIDENCE`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md:109-116; doc/review/platform/2026-09-11-v2s-terminal-admin-console-poc-analysis-and-design-discussion-claude.md:181,189-190,288-296; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:420-431`

The discussion describes `hash * 131`, but the design deliberately leaves the formula as a pre-implementation source reopen and supplies no encoding, modulo, window, or vector. The exact original POC source must be read before implementation; no replacement formula may be invented.

Minimum repair: reopen the named POC source, freeze byte encoding, hash, modulo, time window, and fixed vectors. This is not a product decision to be guessed from the prose.

### M-09 — List virtualization upper bound is not frozen

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md:541; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:269-271`

The criterion requires a concrete render-node upper bound and end visibility/recycling. The plan says only “fixed list virtualization threshold”; it gives no number, window, overscan, or recycle boundary.

Minimum repair: freeze a concrete bound and the last-item/first-batch observation in IA, interaction, and plan. “Virtualized” alone cannot construct the requested red fixture.

### M-10 — Non-DEV method-level capability descriptor API is not closed

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/adapter/android/device/src/implementations/androidDevice.ts:65-82; apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts:40-58; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:247-251`

Current Android/Web descriptors are attached only under `__DEV__`. The design requires non-DEV method-level state/source but does not freeze a public descriptor type, read API, non-DEV injection path, or complete owner/consumer chain. A private symbol or DEV-only side channel is insufficient.

Minimum repair: define one public capability snapshot API, source it from adapter/default/Web bindings in all builds, pass it through assembly runtime facts, and name the non-admin consumer and focused proof.

## S findings

### S-01 — IME retirement replacement path is incomplete

`STATUS=CONFIRMED`
`SEVERITY=S`
`PATH_OR_SYMBOL=apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx:48-52,83-104; requirements §6; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:223-229`

The current host controller still consumes `snapshot.ime` and exposes an IME context. The design says to remove render IME fields but does not enumerate the complete deletion set or the virtual-only viewport/scroll replacement path.

Minimum repair: list every input/render/host/Android IME symbol to delete, every virtual viewport fact to retain, and the exact owner transfer; keep the truth-table proof separate from geometry proof.

### S-02 — Web dual-surface input contract is not executable

`STATUS=CONFIRMED`
`SEVERITY=S`
`PATH_OR_SYMBOL=apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx:31-45,326-343; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:92-113`

Current dev-host assembly exposes only `createSurface(displayMode)`. The design states index 0/1 host mapping but does not specify how dev-host passes physical index into the assembly. A statement of target values cannot implement A-59.

Minimum repair: freeze the dev-host `SurfaceCreationInput` call path and source map, with a focused/static observation that index 0 and index 1 are created distinctly.

## Strictly unverified, not a verdict upgrade

- Web, Android, native, release, focused, and visual evidence were not run.
- Dexter wireframe review is unset.
- POC password byte formula still requires source evidence.
- No write/build/test/runtime/DEV/seed/UAT/deployment/Git action occurred.

## Reviewer conclusion

The design bundle remains `NO-GO`. It needs the template-complete UI interaction artifact, the CT-2 snapshot chain, an executable surface identity lifecycle, command-owner admission, focus-scope semantics, Dexter's business-layer retention decision, a debug priority truth table, the exact POC password vectors, a concrete List bound, a non-DEV descriptor API, a complete IME replacement map, and a Web input contract before round 2. Round 2 must re-open current bytes and verify these dispositions; this report does not authorize implementation.

