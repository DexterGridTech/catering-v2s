# TER 虚拟键盘优化 IMPLEMENTATION 静态复核处置

## 评审目标

- `REVIEW_TARGET=IMPLEMENTATION`
- `SOURCE_REVIEW=doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-implementation-static-review-claude.md`
- `AUTHORITY=既有虚拟键盘优化实施授权；本轮只修复 Claude 指出的 S-1/S-2/S-3/N-1`
- `DYNAMIC_AUTHORITY=本轮未启动动态运行；不把 focused 或既有手工体验升级为设备/视觉验收`

## 四项处置

### S-1：canvas 缩放单位错配 — CONFIRMED，已修复

`ConsoleSurfaceInputFrame` 已放回 `SurfaceRoot.renderContentFrame`，因此位于 `SurfaceHostController` canvas 子树内。`SurfaceRoot` 不在 provider 外读取 offset；新的 `SurfaceRootContent` 在 input presentation provider 下读取 `useSurfacePresentationOffset()`。frame、字段/viewport 测量、K、offset、overlay 和 hit shield 使用同一 canvas logical unit，不增加手工 scale 换算。

对应代码：

- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:751-776`
- `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:13-23,114-125`
- `apps/terminal/ui/base/render/test/renderSurface.test.tsx:362-398`

将 provider offset 故意改为 `0` 后，非单位 host/canvas focused case 首次失败；恢复后 render `100/100` 通过。

### S-2：same-serial 动画从 0 重放 — CONFIRMED，已修复

`finishPendingPresentation` 通过 ref 更新，动画 effect 不再依赖每次 render 变化的闭包；完成回调使用当前 ref，effect 只依赖动画 phase/serial 与稳定回调。owner 或 blocked 状态在同一 serial 改变时不会重复 `progress.setValue(0)`。

对应代码：

- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:487-500,664-722`
- `apps/terminal/ui/base/input/test/provider.test.tsx:580-605`

恢复不稳定依赖与直接闭包调用后，same-serial focused test 首次检出多余的 `setValue(0)`；恢复后 input `100/100` 通过。

### S-3：scroll readback 不收敛 — CONFIRMED，已修复

`InputScrollArea` 统一通过 geometry context 注册 readback，并在 scroll event 与动画完成两个入口评估当前 offset。完成时若焦点完整可见则 success，否则以明确 failure 释放 pending；Web pending 点击只保护待提交字段自己的 input/anchor，外部点击仍可取消。

对应代码：

- `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx:40-70,166-176,220-232`
- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:470-486,697-705`
- `apps/terminal/ui/base/input/src/components/InputProvider.tsx:21-49,125-128,173-209`
- `apps/terminal/ui/base/input/test/scrollArea.test.tsx:200-237`

删除完成回调中的 `settleScrollReadback` 后，focused test 首次没有 focus-visibility-error 且 pending 未收敛；恢复后 input 全量测试通过。

### N-1：键盘层重挂与 passive noop 不稳定 — CONFIRMED，已修复

layer key 改为按 `incoming/outgoing/active + fieldId + layout` 稳定识别，不再含 phase/index；被动键盘使用模块级 `noopKeyboardKey`。

对应代码：

- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:745-804,868-887`
- `apps/terminal/ui/base/input/src/components/InputKeyboard.tsx:30,49-60`
- `apps/terminal/ui/base/input/test/provider.test.tsx:608-645`

phase/index key 变异和 inline noop 变异均真实首次失败，恢复后 focused/full suite 通过。

## 验证结果

- `@catering-v2s/ui-base-input`：`100/100 PASS`；typecheck PASS。
- `@catering-v2s/ui-base-render`：`100/100 PASS`；typecheck PASS。
- `@catering-v2s/ui-base-console-assembly`：`15/15 PASS`；typecheck PASS。
- 红变异：S-1、S-2、S-3、N-1 key、N-1 noop 均首次红，恢复后同门绿。
- 逐代码—详设对账：`doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-code-design-reconciliation-codex.md`，四项均 `MATCHED`，无 OPEN。
- Web、Android/native/device、visual、business、cleanup：本轮未启动动态验证，分别按范围记录为 `NOT_RUN`/非本轮结论。

## 交 Claude 的核验请求

请以当前仓库字节独立复核上述四项，不接受作者结论。重点核验：

1. `ConsoleSurfaceInputFrame` 的 hosted canvas 层级与 provider 下 offset 消费；非单位 host/canvas focused 断言；
2. same-serial owner/blocked 变更是否仍会重置 progress；
3. 动画完成时 scroll readback 是否成功或明确失败收敛，Web 点击保护是否仅保护 pending field；
4. layer key 与 passive noop 是否稳定，以及两类变异测试是否真的能红；
5. 本轮没有动态或视觉验收升级。

请按以下格式返回：`REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO|NO-GO|GO_WITH_OPEN_EVIDENCE`、`M/S/N=x/y/z`，并逐条给出路径、行号、证据、first failure/last known good/broken boundary；若详设存在未覆盖问题，请标 `DESIGN_GAP`，不要由实现侧补造语义。
