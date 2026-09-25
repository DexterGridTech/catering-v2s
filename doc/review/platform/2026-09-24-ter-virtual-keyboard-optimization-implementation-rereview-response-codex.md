REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER-VK-2026-09-24-IMPLEMENTATION
REVIEW_ROUND=FINAL-REREVIEW-HANDOFF
AUTHOR_STATUS=SUPERSEDED_BY_FINAL_REREVIEW_RESPONSE

> 本文件的动态段落已被 `doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-implementation-final-rereview-response-codex.md` 与 `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/tr16-final-rereview-20260924.md` 取代。不要使用本文件的旧 APK、旧 Web、旧 IA-19 或旧 cleanup 汇总作为当前事实。

## 背景

本轮承接 Claude 的实现静态复评第二轮：`doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-implementation-static-rereview-claude.md`。S-1（scroll readback 不能在键盘动画结束时误报失败）、S-2（快速往返切换不能生成重复 outgoing key）、N-1（输入框架必须在 hosted canvas 子树）已经按批准范围修复；N-2 的 TR-16 顺序已写入实施计划并按 Web→设备执行。

静态修复、focused/typecheck、真实 red mutation、步骤对账和 fresh 只读复核已完成。Web 与两个授权虚拟机的动态运行也已完成到受管 runner 边界；截图的逐控件视觉判定仍保持 OPEN，不把截图存在性、pixel diff、harness 或 focused 结果升级为整体验收。

## 评审目标

请独立复核：

1. S-1 的 0.5 logical-unit 容差、scroll terminal signal、1500ms request-scoped watchdog 是否与实现和测试一致，且不会在键盘 250ms presentation 完成时提前失败；
2. S-2 的 immutable `layerKey` 是否覆盖 A(l1)→B(l2)→A(l1)→C，渲染层 key 是否两两唯一且不重复挂载；
3. N-1 的输入框架是否确实位于 `ui-base-render:surface-host-canvas` 子树，非单位缩放与层级测试是否依赖被测代码；
4. TR-16 Web→设备顺序、共享源码字节、场景分母和证据分档是否如实；
5. device runner 的首败、last known good、controlled harness、生产 consumer 未覆盖项以及 cleanup 是否被正确分开记录。

## 需阅读文件

- `doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-implementation-static-rereview-claude.md`：Claude 本轮 finding 与验收判据；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-static-rereview-reconciliation-codex.md`：设计/代码/focused/TR-16 对账及本轮 Web/device 结果；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md`：IA 与滚动终止、动画、键盘形态正本；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md`：详设、单位、readback、layer identity 判据；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md`：CP-0 至 CP-4 与 TR-16 共享场景；
- `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx`：滚动请求、终止信号、容差与 watchdog；
- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx`：presentation 状态、冻结层身份与动画；
- `apps/terminal/ui/base/input/src/foundations/scrollIntoView.ts`：可见性和目标 offset 计算；
- `apps/terminal/ui/base/primitives/src/components/PrimitiveScrollView.tsx`：native scroll end event 归一化；
- `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`：hosted canvas 内容层级；
- `apps/terminal/ui/base/input/test/scrollArea.test.tsx`、`provider.test.tsx`、`apps/terminal/ui/base/render/test/renderSurface.test.tsx`：对应 focused 与 red mutation；
- `scripts/test/ter-virtual-keyboard-android.mjs`：受管安装、启动、UI capture、controlled harness、读回和 cleanup；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-cp4-final01/run-manifest.json`：本轮设备 manifest、首败、业务 checks 与 cleanup；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/web/static-rereview-20260924/`：本轮 Web 键盘截图；
- `apps/terminal/ui/integration/sample-console`、`apps/terminal/ui/integration/sample-wallpaper-console`：Web 生产消费者入口。

## 独立核验重点

- focused：input 105/105、primitives 26/26、render 101/101；四个相关 package typecheck exit 0；S-1/S-2/N-1 red mutation 必须真实先红后绿；
- Web 必须早于设备，且两个 integration 都要有实际 Expo Web 结果；vitest/jsdom 不得代替 Web；
- device run `tervk-20260924-cp4-final01` 的 APK SHA、双屏/mobile shape、system_server 正向读回、四组合启动和 cleanup；
- dual PRIMARY/SECONDARY 与 mobile 的 frame coverage 只能按 runner 的 IA-01..19 分母解释；未达生产入口的 wallpaper login、scroll harness 和视觉逐控件判定必须保持 OPEN/NOT_COVERED/HARNESS_ONLY；
- controlled harness 四组合的十符号 hash 对照只能证明键盘 payload/Shift 机制，不得冒充业务 consumer；
- 不改业务页面、part、command、登录语义、键盘语义或新增依赖。

## 期望结论

请给出明确的 `GO`、`NO-GO` 或 `GO_WITH_OPEN_EVIDENCE`，并以 `M/S/N=x/y/z` 汇总。每条 finding 请给出精确文件与行号、影响面、最小修复建议，并说明是否需要 Dexter 产品裁决。请把 static、focused、Web、Android/native/device、visual、business、cleanup 分档，不以作者报告或本轮手工体验替代独立核验。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助复核 TER 虚拟键盘优化的 IMPLEMENTATION 终轮交付。

背景：本轮承接实现静态复评第二轮。S-1 的 scroll readback 提前失败、S-2 的快速切换重复 outgoing key、N-1 的 hosted canvas 测试缺口已修复；N-2 的 TR-16 Web→设备顺序已写入计划并执行。静态、focused/typecheck、真实 red mutation、Web→设备动态运行和受管 cleanup 均已留下证据，但逐控件视觉判定仍按实情保持 OPEN。

目标：请独立核验 S-1/S-2/N-1 的代码与测试是否真正闭合，TR-16 是否确实 Web 先于设备且使用同一源码字节，并检查本轮 Android manifest 的首败、恢复、生产 consumer 覆盖、controlled harness、视觉/业务分档与 cleanup 是否诚实。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-implementation-static-rereview-claude.md：原 finding 与验收判据；
- doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-static-rereview-reconciliation-codex.md：实现对账与动态分档；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md：IA 正本；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md：详设正本；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md：CP 与 TR-16 计划；
- apps/terminal/ui/base/input/src/components/InputScrollArea.tsx、apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx、apps/terminal/ui/base/input/src/foundations/scrollIntoView.ts：S-1/S-2 owning source；
- apps/terminal/ui/base/input/test/scrollArea.test.tsx、apps/terminal/ui/base/input/test/provider.test.tsx、apps/terminal/ui/base/render/test/renderSurface.test.tsx：focused 与 red mutation；
- scripts/test/ter-virtual-keyboard-android.mjs：受管动态 runner；
- doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-cp4-final01/run-manifest.json：设备运行、首败、harness、cleanup；
- doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/web/static-rereview-20260924/：Web 截图证据。

请重点独立核验：0.5 logical-unit 容差与真正 scroll terminal signal；250ms 键盘动画是否不再提前清 readback；A(l1)→B(l2)→A(l1)→C 的 layer key 两两唯一；输入框架是否在 hosted canvas；Web 是否早于双屏/mobile；19 帧分母是否缩水；wallpaper login 的设备状态缺口、harness-only URL 十符号 PASS、逐控件视觉 OPEN 和 cleanup=PASS 是否分档准确。

烦请给出明确 `GO`、`NO-GO` 或 `GO_WITH_OPEN_EVIDENCE`，并按 `M/S/N=x/y/z` 标注精确路径与行号、影响面、最小修复建议及是否需要 Dexter 产品裁决。

授权边界：本次只复核已批准的 TER 虚拟键盘优化实现与 Web→单机双屏/mobile 动态证据；不授权扩大功能、不改业务/登录/keyboard 语义、不新增依赖、不把 focused、harness 或截图存在性升级为视觉或整体验收，也不涉及其它虚拟机、真机、双机拓扑或 Git 操作。谢谢。
```
