# TER CP-2 阶段三维对账独立复核清单

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP2_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-2
REVIEW_ROUND_LIMIT=NOT_APPLICABLE
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY_REQUIRED
```

## 目的与边界

这是 CP-2 实施步骤的阶段三维对账，不是正式的 `REVIEW_TARGET=IMPLEMENTATION` 对抗
review cycle。它不登记 `REVIEW_CYCLE_ID`、不占用正式两轮上限；如果主 agent 修复后仍有
`OPEN`，可以再次召集 fresh reviewer，直到本阶段只剩 `MATCHED`。本复核只审 CP-2，不能
提前审 CP-3 的 canvas transform、CP-4 的 IME/scroll、CP-5 的 Web policy、portrait 或
最终视觉验收。

reviewer 必须先独立读取需求、详设/计划、项目记忆约束、当前 CP-2 源码、测试和 evidence，
然后逐条输出 `MATCHED` 或 `OPEN`；不得修改文件、运行命令或把静态/既有 evidence 写成新的
Android/Web 运行结果。

## 必读输入

| 输入 | 仓库根相对路径 | 读取要求 |
| --- | --- | --- |
| 执行边界 | `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md` | 全文 |
| 当前实施授权与步骤 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` | 第 0-4 节及 CP-2 相关条款 |
| 实施详设 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md` | CP-2 对应 §5.1-§5.3 |
| 原始需求 | `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md` | adapter、owner、边界与失败恢复条款 |
| 实现 | `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt` | 当前全文，尤其 registry/remove/captureWindow |
| 实现 | `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt` | 当前相关全文 |
| 实现 | `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt` | 当前相关全文 |
| JS source | `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts` | 当前全文 |
| focused tests | `apps/terminal/adapter/android/dual-screen/android/src/test/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalSurfaceHostActivityHandlerTest.kt`、`apps/terminal/adapter/android/dual-screen/test/surfaceHost.test.ts` | 当前全文 |
| 当前证据 | `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` | CP-2 全部历史与最新修复记录 |
| 项目规范 | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`、`doc/platform/implementation-task-template.md` | 区分阶段三维对账与正式 implementation review |

## 逐条对账问题

1. `invalid-owner-layout` 在生产 `TerminalSurfaceHostRegistry.remove` 中是否只清理同 owner 的
   旧 entry，并产生 generation+1 的 `Unavailable`；是否不会清理另一个 owner。
2. 无旧 entry 时是否保持 null 且不伪造事件；错误 owner 是否保留旧 entry。
3. 清理 PRIMARY 时 SECONDARY entry 是否保持不变；清理后 JS 是否能按已有 unavailable
   fence 清空旧事实。
4. `resolveSurfaceHostRemoval` 是否是生产 remove 的实际状态决定 seam，而不是只存在于
   测试中；4 个 native focused cases 是否逐条钉住上述行为。
5. CP-2 是否仍未扩展公共 `DevicePort`、`DisplayInfo`、`PlatformPortBindings`，未创建第二
   bridge/React host，未引入 `maximumWindowMetrics`，且仍保留副屏 density correction。
6. CP-2 证据是否把 focused、Android compile、Android adapter runtime 与后续 CP/最终视觉
   证据分栏，没有把前一轮未覆盖的反例写成已验证。

## 输出格式

```text
STAGE_RECONCILIATION_ID=TER_LOGICAL_CANVAS_STRETCH_CP2_STAGE_20260908
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEW_SCOPE=CP-2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER_STATUS=FRESH_READ_ONLY
STAGE_RECONCILIATION=MATCHED|OPEN
OPEN_COUNT=<number>
```

每一条只写 `MATCHED` 或 `OPEN`，若为 `OPEN` 必须给出源码路径、行号、失败场景、影响面和
最小修复；不得输出正式 review cycle 的 `M/S/N` 结论，也不得宣称 CP-2 已进入下一步骤。
