# TER 固定逻辑画布设计独立盲审输入清单（第二轮）

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_20260908
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=只在第一轮报告与当前修订材料明确的范围内定向核验；重新打开 owning source 与需求，不采信作者自述；只读，不修改文件，不运行命令、设备、浏览器或动态环境。
ROUND_FINAL_DECISION=SELF_DECIDED

## 本轮目的

第一轮报告为 NO-GO（M=3/S=2/N=4）。本轮只核验作者是否真实闭合以下修复，不重新发明方案，也不把未运行的 CP-0 证据写成已通过：

1. 1280×800 与 1280×720 的权威来源是否在详设中明确记录，旧材料是否被标成待同步而不是第二套有效基线；
2. portrait 是否仍明确为无 profile 即 OPEN，且没有把横屏范围偷偷降级为完整 TER；
3. CP-0A 是否在 CP-0/源码变更之前，能实际阻止旧条款与新条款并存；
4. Web previewViewportRect 是否有唯一 owner、实际测量边界、border/stage/gap 排除规则和短高 fixture；
5. CP-0 是否有 P-01 至 P-05 的逐项原始证据、继续/停止判定和不以静态设计代替动态事实的出口；
6. 上述修复是否引入新的跨层依赖、公共 TS 契约、第二 bridge、第二单位系统或行为承诺；
7. 计划是否仍满足 RD-10、逐代码与详设对账、步骤级三维对账及最多两轮独立审查的仓库规则。

## 最小输入

1. AGENTS.md
2. PLATFORM-BLUEPRINT.md
3. doc/platform/roadmap-program-registry.json 及当前选定 Roadmap 授权字段
4. project-memory/index.md
5. project-memory/decisions/deterministic-context-only.md
6. project-memory/decisions/terminal-architecture-and-stack-rulings.md
7. project-memory/operations/terminal-coding-standard.md
8. doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md
9. doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md
10. doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md
11. doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md
12. doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md
13. doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md
14. doc/review/platform/2026-09-08-ter-logical-canvas-stretch-design-independent-review-round1-codex.md

## 必须重开 owning source

- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt
- apps/terminal/ui/integration/sample-console/package.json
- apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts
- apps/terminal/ui/base/render/src
- apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts
- apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx
- apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml
- apps/terminal/assembly/android/sample-terminal/app.json

## 定向证伪问题

1. 详设是否把 Dexter 裁定与当前源码事实分开，是否仍存在无法执行的“未授权数字已是源码事实”表述？
2. CP-0A 的位置与 CP-0、CP-1 的依赖是否真正阻止先改代码后同步文档？
3. previewViewportRect 的 owner 是否真能排除 border、stage padding、surface gap，并覆盖正常、窄宽、短高与 resize？
4. P-01 至 P-05 是否各自有原始记录、通过条件、失败停机；是否误把 mock/静态输出当真实 hit-test/scroll 证据？
5. portrait OPEN 是否与“本轮完成固定逻辑画布”的标题、目标和验收保持一致，而不是隐式降级或伪造？
6. 复修是否破坏 adapter→JS→render→assembly→input 的依赖方向，或让 input 得到 scale/平台事实？
7. 是否还有 materially new 的设计缺口，若有，标出 M/S/N、状态、仓根相对路径与最小修复。

## 报告格式

先给独立 verdict：GO 或 NO-GO，M/S/N。每条 finding 必须标注 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，并给仓库根相对路径、锚点/行号、失败场景、影响面、最小修复、是否需要 Dexter 裁决。明确区分设计缺陷、需要运行证据的 OPEN 与不属于当前授权的实施动作。不得修改任何文件、不得运行命令。第二轮是本 cycle 最后一轮。
