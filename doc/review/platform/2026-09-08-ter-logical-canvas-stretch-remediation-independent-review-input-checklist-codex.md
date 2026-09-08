# TER 固定逻辑画布设计修订独立盲审输入清单

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_REMEDIATION_20260908
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=这是修订后的新 review cycle。审查者必须先独立重开需求、规范、项目记忆与 owning source，再核验当前详设/计划；只读，不修改文件，不构建，不运行测试、设备、浏览器或动态环境。

## 背景与定向范围

上一轮设计审查指出两条 M、五条 S 和一条待 Dexter 裁决的 N。本轮只核验下列处置是否真实闭合：

1. M-1：stable bounds 与 density 是否来自同一 measurement context、同一次 snapshot，并且 P-01 记录出处与配对比值；
2. M-2：CP-0 是否先依据仓内已有 window-layout/IME 日志判定 current 是否变化，H-02 是否在两种窗口行为下都能击穿从 current 算 stable 的错误实现，并比较更小的 decorView 路径；
3. S-1：是否点名 maximum-metrics 的 display-context → window-context 路径、host-ready decorView 路径和 createSurfaceContext 禁止混用边界；
4. S-2：CP-1 是否覆盖 package/parser 的所有直接消费者与测试 fixture，且没有兼容层或把 shape 迁移推迟造成 CP-1 必然不编译；
5. S-3：是否直接复用既有 DisplayMode，没有新建 SurfaceKey；
6. S-4：A 是否只承担 frame/canvas box 对账，B 是否明确以宿主实际 content rect 为参照并包含四角真实命中；
7. S-5：display-context 的事实 owner、DisplayMode、TR-11 command 边界是否明确，onSurfaceHostChanged 是否仅为 render infrastructure 通知；
8. N-1：Web uniform contain 是否已改为待 Dexter 确认，而非假称既定裁定；
9. 修订是否引入新矛盾、公共契约扩张、第二 bridge、input 平台泄漏、fallback 或未授权实施承诺。

## 最小输入

1. AGENTS.md
2. PLATFORM-BLUEPRINT.md
3. doc/platform/review-standard.md
4. doc/platform/terminal-coding-standard.md
5. doc/platform/foundation-charter.md
6. project-memory/index.md
7. project-memory/decisions/deterministic-context-only.md
8. project-memory/decisions/terminal-architecture-and-stack-rulings.md
9. project-memory/operations/terminal-coding-standard.md
10. doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md
11. doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md
12. doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md
13. doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md
14. doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md
15. doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md
16. doc/review/platform/2026-09-08-ter-logical-canvas-stretch-design-independent-review-round2-codex.md

## 必须重开 owning source

- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt
- apps/terminal/kernel/base/display-context/src/types/display.ts
- apps/terminal/kernel/base/display-context/src/index.ts
- apps/terminal/ui/integration/sample-console/package.json
- apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts
- apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx
- apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx
- apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts
- apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx
- apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml
- apps/terminal/assembly/android/sample-terminal/app.json

## 报告格式

先给独立 verdict：GO 或 NO-GO，M/S/N。每条 finding 标注 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，并给仓库根相对路径、行号、失败场景、影响面、最小修复、是否需要 Dexter 裁决。必须包含 `REVIEW_TARGET=DESIGN`、`ACTION_1_VARIANT=1-B`、`L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN` 和 `DESIGN_GAPS`。不要把未运行的 CP-0/CP-7 证据写成通过；不得修改任何文件。若本轮仍有 finding，下一轮才可定向复核，最多两轮。
