# TER CP-2 fresh independent review checklist — round 2

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-2
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER_EXPECTATION=FRESH_READ_ONLY

## Blind-review boundary

这是同一 CP-2 implementation review cycle 的第 2 轮定向复查，也是最后一轮。只读当前源码与
修复后的 focused/evidence 材料；不得修改文件，不得运行命令、构建、安装、启动 Android/Web，
不得把作者的处置摘要直接当作结论。只核验第 1 轮 M-01、M-02、M-03 是否真实闭合，以及修复
是否引入同根反例；不要重新发明未改变范围的 CP-3/CP-4/CP-5 findings。

## Required inputs

1. `doc/review/platform/2026-09-08-ter-logical-canvas-cp2-independent-review-checklist-codex.md`
2. `doc/review/platform/2026-09-08-ter-logical-canvas-cp2-independent-review-round2-checklist-codex.md`
3. `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md`
4. `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md`
5. `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`
6. `apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts`
7. `apps/terminal/adapter/android/dual-screen/test/surfaceHost.test.ts`
8. `apps/terminal/adapter/android/dual-screen/android/src/test/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalSurfaceHostActivityHandlerTest.kt`
9. `apps/terminal/adapter/android/dual-screen/android/build.gradle`
10. `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` 的 CP-2 节

## Required checks

- M-01：`shouldReuseStableHostContext` 是否同时阻止 orientation、density 和非 IME host resize
  复用旧 stable；IME current 变化是否仍能保留 stable；captureWindow 是否按同一 owner snapshot
  重建 stable/current 与 generation。
- M-02：invalid width/height/density/display 的同 owner 路径是否真的移除旧 entry、递增 generation、
  发布 unavailable；无旧 entry 是否保持 null；remove 是否不会误删另一 surface/另一 owner。
- M-03：accepted event 先于 async initial snapshot 时，same generation 的旧 initial 是否绝不覆盖；
  stale generation、wrong display/window 与 unavailable 行为是否仍保持。
- 检查修复后的测试是否确实覆盖上述反例，且没有把 mock 或结构断言写成 Android 运行证据。
- 检查 CP-2 仍未扩展公共平台契约、创建第二 bridge/host、引入 maximum metrics 或越界声称
  CP-3/CP-4/CP-5 已完成。

## Report format

```text
REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-2
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER_STATUS=FRESH_READ_ONLY
VERDICT=GO|NO-GO
M/S/N=...
```

每个 finding 必须标注状态、仓库根相对路径与行号、失败场景、影响面、最小修复和是否需要
Dexter 裁决。只有没有未闭 finding 时才可给 `CP-2=MATCHED`；不得将本 checklist 的预期或
evidence 文档的作者状态当作独立 verdict。
