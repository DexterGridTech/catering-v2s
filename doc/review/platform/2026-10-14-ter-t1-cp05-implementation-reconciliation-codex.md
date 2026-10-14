# TER T1 · CP-05 独立三维对账

`REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
`CP=CP-05`
`REVIEWER=/root/t1_cp05_reconcile_r6`
`VERDICT=MATCHED`

## 对账输入

- 正式需求：R-03、R-15、V-02、V-03、V-18，见 `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md`。
- 详设：CP-05、§8.1、§11a，见 `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md`。
- 计划：CP-05，见 `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md`。
- 项目规范：`doc/platform/terminal-coding-standard.md` 的 TR-10、TR-R06、§8；项目记忆 `project-memory/operations/terminal-coding-standard.md`、`project-memory/pitfalls/machine-gate-selftest-format-fragility.md` 及 `project-memory/required-inventory.json`。
- 当前字节证据和 R2-R5 intake：`doc/review/platform/2026-10-14-ter-t1-cp05-implementation-evidence-codex.md`。

## 结论

Fresh 独立 reviewer `/root/t1_cp05_reconcile_r6` 在读取作者证据前先依据需求、详设、规范和当前源码形成暂定结论，之后才对照作者证据，最终判定 CP-05 **MATCHED**。 reviewer 覆盖完整 CP-05，而非仅检查 R5 单词差量。

- 30 份 CP-05 README 已逐项对照相应包的当前职责、公开 API、示例、维护命令及源码；目录门计数和 workspace README 覆盖交叉复核。
- `platform-ports` 的 11 个必填 binding 字段、README 的 11 项说明和 `remoteControl` 示例一致；R5 的“十键”残留已修正。
- source-layout 静态门、对应 red mutations、store-basic/project-basic owner callback 接线、TR-10 记忆指针及新失败模式记忆均与判据一致。
- R2-R5 已确认 README 缺口在当前字节闭合；未发现新的 CP-05 OPEN。

## 证据边界

reviewer 复用了 CP-05 证据记录中的 focused proof，因为对应生产/测试源码未受 CP-05 README 修订影响；没有把源码静态对账升级为本轮重新执行的测试或动态 PASS。本次不代表全批 6b、CP-06、13c 或整批 IMPLEMENTATION verdict。DEV、Expo Web、Android、虚拟机、后台业务和 cleanup 仍须按 CP-06 及适用准入逐项验证。

## Reopened CP-05 closure after public-export repair

The earlier MATCHED record above predates the subsequently found project-basic public-export omission and is retained as historical evidence. The omission was repaired on the current bytes and CP-05 was reopened and rechecked as a complete stage.

- Main-agent disposition: `CONFIRMED`. `selectProjectFixedTerminalUpdateContextFacts` was intentionally registered by `createProjectBasicModule` and exported from the package root, but absent from `terminal-invariants.json.publicExports` and the Chinese README selector list. This violated R-15/V-03/V-18 package maintenance alignment.
- Minimal repair: retain the existing public API; add it to the invariant export set and README, and add an exact TypeScript root-barrel/invariant test in `projectBasicRuntime.test.ts`. The path helper follows the existing `sample-wallpaper/test/publicSurface.test.ts` convention so the test does not require an unconfigured `node:url` type.
- Focused proof: `yarn workspace @catering-v2s/kernel-feature-project-basic typecheck` PASS; `yarn workspace @catering-v2s/kernel-feature-project-basic test` PASS, 2 files / 14 tests.
- Fresh full-stage reviewer: `/root/t1_cp05_full_r9`, independent three-dimensional reconciliation, `MATCHED`. The reviewer checked selector module registration, root export, invariant and README; consumers in both integrations; all 30 specified README entries; the current 41-package README census; source-layout vocabulary and red examples; and the CP-05 memory/gate records. No further CP-05 OPEN was found.
- Scope: CP-05 is now MATCHED for the current bytes. This does not replace independent batch 6b, CP-06 dynamic acceptance, 13c or final implementation review. DEV/Web/Android results remain NOT_RUN.

## Reopened CP-05 closure after 6b public-surface repair

The R6 MATCHED above predates the full-batch 6b finding and is preserved as its original byte boundary. CP-05 was reopened for the confirmed root-export/invariant drift and the V-01 source-readback artifact path correction. Fresh full-stage reviewer `/root/t1_cp05_r11` reviewed the current requirements, design, plan, source-readback record, public-export gate, README/invariant census and complete CP-05 scope, and returned **MATCHED**.

- The author source-readback record exists at `doc/review/platform/2026-10-13-ter-t1-implementation-source-review-codex.md`; it explicitly says `AUTHOR_SOURCE_READBACK`, `VERDICT=NOT_CLAIMED`, and does not substitute for independent reconciliation or dynamic evidence.
- Design V-01/V-18 now names the record as a completed source-readback artifact, not a proposed file or machine gate.
- The exact public-export repair and structural red cases were checked against current source. Existing focused proofs are reused because the CP-05 documentation/readback update did not change their tested implementation bytes.
- Current CP-05 state: `MATCHED`. This is not the full-batch 6b verdict; the original 6b R1 finding remains pending fresh batch-level reconciliation.

## Reopened CP-05 closure after full-batch 6b R2 repair

The R11 result above is retained for its original byte boundary. The subsequent full-batch 6b R2 identified six missing `publicExports` declarations and implementation inside the Android update root barrel. Those confirmed items were repaired, and CP-05 was reopened for a fresh full-stage review.

- Current-byte disposition: `CONFIRMED`; the invariant schema had silently skipped packages without `publicExports`, and `adapter/android/update/src/index.ts` contained implementation instead of only explicit exports.
- Minimal repair: declare exact exports for the six affected packages, move the update adapter implementation to `src/implementations/androidUpdatePort.ts`, keep `src/index.ts` as explicit re-exports, and strengthen the existing public-export gate plus red mutations.
- Focused proofs on these bytes: `node tools/terminal-skeleton/check-static.mjs` PASS (13/13 gates); `node tools/terminal-skeleton/check-static.test.mjs` PASS (`TERMINAL_SKELETON_MODEL_TEST=PASS`); `yarn workspace @catering-v2s/adapter-android-update typecheck` PASS; `yarn workspace @catering-v2s/adapter-android-update test` PASS (1 file / 11 tests, unhandled 0).
- Fresh full-stage reviewer `/root/t1_cp05_r12` independently read the requirement, design, plan, terminal standard, routed memory and current source before checking the author records. It returned `MATCHED` for full CP-05, including the repaired root-barrel shape, exact invariant exports, source-layout red cases, README/public-surface alignment and CP-05 evidence scope.
- Scope: current CP-05 is `MATCHED`. This does not close full-batch 6b, CP-06, 13c, final `REVIEW_TARGET=IMPLEMENTATION`, DEV, Expo Web, Android/device behavior or cleanup.

## Reopened CP-05 closure after TDC selector single-file repair

The R12 MATCHED above is retained for its original byte boundary. The subsequent 13c source scan found that the four public TDC selectors still shared the old `selectTerminalDataClientState.ts`, contrary to the explicit R-03 and appendix §11 requirement. Main-agent disposition: `CONFIRMED`.

- Minimal repair: split the four existing definitions into `selectActivationState.ts`, `selectConnectionState.ts`, `selectConnectionLatency.ts`, and `selectTerminalTopicSubscriptions.ts`; keep their selector names, payload schemas, return behavior, module registration and root exports unchanged. A private `readTerminalDataClientState.ts` remains the single shared read helper. The old combined source was removed; no consumer still imports it.
- Focused proof on the repaired bytes: `yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck` PASS; package Vitest invocation for `test/clientState.test.ts`, `test/runtimeStartup.test.ts`, and `test/terminalDataClientActor.test.ts` PASS, 3 files / 49 tests; package lint PASS, 26 source files / 0 errors / 0 warnings. The exact commands and results were executed after the source split; the lint result was not present in the prior evidence document, so it is recorded here from the main-agent run result rather than treated as a reviewer rerun.
- Fresh independent CP-05 delta reviewer `/root/t1_cp05_selector_reconcile` returned `MATCHED`. It verified the requirement, appendix, terminal standard, four current selector files, module registration, stable root exports, old-path absence and current public export/invariant shape. For unchanged CP-05 README and package census coverage it explicitly reused the earlier full CP-05 reconciliation; this delta did not reopen those unaffected bytes.
- Post-proof source readback confirmed R-03, terminal-coding-standard §8.1/TR-R06, appendix §11, selector implementations, module registration, root exports and direct tests still agree.
- Scope: CP-05 is `MATCHED` on the current selector bytes. This does not close CP-06 dynamic acceptance, 13c, final `REVIEW_TARGET=IMPLEMENTATION`, or the unrun Android scenarios.
