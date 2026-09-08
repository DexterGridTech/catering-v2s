# TER 固定逻辑画布设计独立盲审输入清单

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_20260908
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=先从冻结输入与当前源码独立形成证伪式判断，再阅读作者详设与计划；不采信作者结论，不修改文件，不实施。

## 审查边界

本轮只审固定逻辑画布、Android per-surface 适配器事实、JS 共用承载、Web preview、IME/scroll 坐标、竖屏前置与计划可执行性。不得修改源码、文档、依赖或测试，不运行设备/浏览器，不把设计预期写成运行证据。

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

## 必须重开 owning source

- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenModule.kt
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt
- apps/terminal/adapter/android/dual-screen/src/implementations/imeInsets.ts
- apps/terminal/adapter/android/device/src/implementations/androidDevice.ts
- apps/terminal/kernel/base/platform-ports/src/types/device.ts
- apps/terminal/ui/integration/sample-console/package.json
- apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts
- apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx
- apps/terminal/ui/base/render/src
- apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx
- apps/terminal/ui/base/input/src/components/InputScrollArea.tsx
- apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts
- apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx
- apps/terminal/assembly/android/sample-terminal/App.tsx
- apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts
- apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml
- apps/terminal/assembly/android/sample-terminal/app.json

## RN/Android vendor source

- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactSurfaceImpl.kt
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/interfaces/fabric/ReactSurface.kt
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactDelegate.kt
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/ReactActivityDelegate.java
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/uimanager/PixelUtil.kt
- apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/views/scroll/ReactScrollViewCommandHelper.kt

## 证伪问题

1. per-surface snapshot 是否真正绑定 target display/window/generation，是否误把硬件事实做成全局 DevicePort 或单例？
2. WindowManager maximum metrics 是否适合稳定 scale，是否被 IME、系统栏、Presentation 全屏语义误读？
3. RN 0.86.3 Fabric/bridgeless public surface 是否允许 JS fixed canvas 超出 parent constraints，并且 transform 后视觉与 hit-test一致？
4. RN measureLayout/onLayout/measureInWindow 在祖先非等比 transform 下到底属于哪个坐标系？计划是否在未知时错误承诺？
5. 双 surface 同一 JS runtime 的 DisplayMetricsHolder/PixelUtil 是否会使“适配器提供硬件信息”仍不足以保证文字/滚动一致？
6. IME 是否严格除 scaleY，stable/current 是否严格分离？
7. Web uniform contain 与 Android nonuniform fill 是否符合 Android preview 目标，是否遗漏可用高度或 border box？
8. portrait declaration 是否有权威 hardware profile；没有时是否正确停机？
9. red fixture 是否能击穿手写常量、错误 identity、错误轴、旧 snapshot 和结构冒充行为？
10. 计划是否逐代码可对账、无隐含新契约、无不必要造轮子，且 RD-10 不改断言语义？

## 报告格式

先给独立 verdict：GO 或 NO-GO，M/S/N。
每条 finding 必须标注 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，并给仓库根相对路径、锚点/行号、失败场景、影响面、最小修复、是否需要 Dexter 裁决。
明确区分设计缺陷、需要运行证据的 OPEN 与不属于当前授权的实施动作。不得修改任何文件。
