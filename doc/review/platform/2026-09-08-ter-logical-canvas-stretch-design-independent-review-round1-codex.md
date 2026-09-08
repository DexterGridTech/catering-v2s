# TER 固定逻辑画布设计独立盲审报告

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_20260908
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=审查者先按冻结输入清单读取需求、规范、owning source 与 RN vendor source，形成证伪式判断后才阅读作者详设/计划；未把作者结论、会话总结或预判作为证据；未修改文件、未运行设备/浏览器/动态环境。

## 独立结论

VERDICT=NO-GO
M=3 / S=2 / N=4

结论范围：不允许 CP-1 及以后源码实施；最多允许有界的 CP-0 只读/探针事实收集。CP-0 之后必须回写设计并再次审查。

## 代表性模拟

- CP-1 要把当前 1157×723 / 962×541 替换为 1280×800 / 1280×720，但冻结需求与 current source 中未找到 PRIMARY 1280×800 的权威来源。
- CP-4 的 IME 除 scaleY 与 scroll 坐标风险识别正确，但必须等 CP-0 的真实测量证据后才能实现。
- CP-5 的 Web uniform contain 方向正确，但可用高度的 owning rect、测量时机和装饰边界未定义，实施者仍会猜 DOM 容器。

## Findings

### F1 · M · CONFIRMED

- 位置：doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md 第 83-108 行；apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml 第 19 行；apps/terminal/assembly/android/sample-terminal/app.json 第 6 行；详设第 156-165 行。
- 失败场景：portrait 是冻结需求的一部分，但计划把 portrait profile 留为 OPEN，同时允许先完成 landscape；实施结束时无法证明完整 FORM portrait，或误把 landscape 证据写成 TER 完整闭环。
- 影响面：Android host topology、SECONDARY suppression、input frame、fixtures、验收矩阵。
- 最小修复：明确本轮是完整 TER（补充权威 portrait profile）还是 landscape-only CP-0/CP-1 spike；若缩小范围，标题、验收和交付结论一并降级。
- Dexter 裁决：需要。

### F2 · M · CONFIRMED

- 位置：apps/terminal/ui/integration/sample-console/package.json 第 11-24 行；apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts 第 8-47 行；surface-form requirements 第 222-229 行；详设第 143-153 行。
- 失败场景：把“干净整数”误当产品事实，围绕未授权的 1280×800 / 1280×720 固化 declaration、host scale、IME 与 hit-test。
- 影响面：canvas declaration、host scale、IME scaleY、hit-test、Web snapshots。
- 最小修复：补 Dexter decision、真实设备 profile 或 current config owning source；没有来源则先不写死数值，只做 CP-0 事实采集。
- Dexter 裁决：若仓内确有未写入的硬件/profile 决策则需要；否则不应猜。

### F3 · M · CONFIRMED

- 位置：旧要求 doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md 第 265-292 行；旧详设 doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md 第 167-186、359-373、486-518 行；计划第 181-202 行。
- 失败场景：CP-1 到 CP-5 代码实施期间，旧 static surfaceSize、旧 baseline、旧 keyboard formula 与 fixed canvas/host scale 同时作为有效输入；测试或对账继续引用旧条款。
- 影响面：public API、fixtures、RD-10、keyboard vertical rules。
- 最小修复：在任何代码实施前形成旧条款 superseded/replaced/retained 对照表，并把 CP-6 文档同步前置到 CP-0/CP-1 准入。
- Dexter 裁决：不需要，除非刻意保留旧行为。

### F4 · S · PARTIALLY_CONFIRMED

- 位置：apps/terminal/ui/base/dev-host/src/foundations/surfacePreview.ts 第 33-63 行；apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx 第 230-303、765-790 行；详设第 231-241 行。
- 失败场景：继续 width-only scale，或误拿 window/header 外层高度作为可用高度，造成 canvas 溢出、塌陷或错误 contain。
- 影响面：Web preview parity、elementFromPoint red fixture、视觉回归。
- 最小修复：明确 previewViewportRect 的 owner、测量时机、border 排除规则和短高 viewport fixture。
- Dexter 裁决：通常不需要，除非 UX 要指定预览区域高度。

### F5 · S · UNVERIFIED_REQUIRES_EVIDENCE

- 位置：apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/runtime/ReactSurfaceImpl.kt 第 65-84、176-194 行；apps/terminal/node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/interfaces/fabric/ReactSurface.kt 第 15-48 行；详设第 197-205 行；计划第 35-57 行。
- 判断：RN 0.86.3 Fabric/bridgeless public path、祖先 transform 下 measure 坐标、PixelUtil/global DisplayMetrics 风险已被计划识别，但不能以静态设计支撑 CP-1+ GO。
- 失败场景：没有 public path 调整 native root specs，或 scroll/typography 仍使用全局 DisplayMetrics。
- 影响面：双 surface Android、hit-test、scrollTo、font/DP conversion。
- 最小修复：把 CP-0 输出升级为硬准入记录：每项 API path、输入、原始输出、继续/停止判定、失败替代方案。
- Dexter 裁决：失败时才需要范围裁决。

### F6 · N · REJECTED_WITH_EVIDENCE

- 位置：apps/terminal/kernel/base/platform-ports/src/types/device.ts 第 12-60 行；doc/platform/terminal-coding-standard.md 第 571-595 行；详设第 166-176 行。
- 判断：不应把 per-surface snapshot 塞进 DevicePort；当前 DevicePort 承载 terminal device fact，adapter/controller 更符合边界。

### F7 · N · REJECTED_WITH_EVIDENCE

- 位置：apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalImeInsetsCoordinator.kt 第 49-72 行；apps/terminal/adapter/android/dual-screen/src/implementations/imeInsets.ts 第 22-50 行；详设第 243-251 行。
- 判断：IME 除 scaleY 的风险已明确覆盖；当前代码未实施转换，但设计方向正确。

### F8 · N · REJECTED_WITH_EVIDENCE

- 位置：apps/terminal/ui/base/input/src/components/InputScrollArea.tsx 第 19-40 行；计划第 137-158 行。
- 判断：计划没有直接假设 measureInWindow 安全，而是要求 CP-0/CP-4 判断 content-local 与 transformed window 坐标，符合边界。

### F9 · N · CONFIRMED

- 位置：详设第 282-297 行。
- 失败场景：red fixture 覆盖虽较完整，但在 F1-F4 未关闭前可能围绕错误 profile 或错误容器高度写成绿灯假证据。
- 影响面：所有 host/preview/验收结论。
- 最小修复：先关闭 scope、数值来源、同步顺序与 Web viewport owner，再执行 red/negative proof。
- Dexter 裁决：不需要。

## Summary

- 方向正确：adapter snapshot、IME scaleY、RN public path gate、拒绝 DevicePort 扩张均有基础。
- 完整性不足：portrait profile、固定画布值权威来源、旧条款 supersession、Web height owner 未闭合。
- 该版本更像 CP-0 spike plan，不是可以直接进入 CP-1+ 的完整实施设计。

## Top improvements

1. 明确 scope 是完整 TER（含 portrait）还是 landscape-only CP-0/CP-1 spike。
2. 为 1280×800 / 1280×720 补 Dexter decision、设备 profile 或 current config owning source。
3. 将 9/5、9/6 与 9/8 的冲突条款同步前置，形成逐条 superseded/replaced/retained 表。
4. 指定 Web previewViewportRect 的 owner、测量时机、border 规则与短高 fixture。
5. 把 CP-0 输出改成每项有继续/停止判定的硬准入 artifact。
