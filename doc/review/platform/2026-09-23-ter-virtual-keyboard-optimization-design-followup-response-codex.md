# TER 程序虚拟键盘优化设计 follow-up finding 处置

> REVIEW_TARGET=DESIGN；输入为 `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-followup-review-claude.md`；Claude 结论 `NO-GO, M/S/N=0/1/4`。本记录只陈述当前 follow-up 的作者处置，不替代 Claude verdict。
> IMPLEMENTATION_AUTHORITY=true；来源为 Dexter 在上述 Claude 复评后的本轮会话授权：设计修订后直接实施，完成 CP-0..CP-4，并仅在单机双屏与 mobile 虚拟机动态验证。
> VISUAL_REVIEW=随实施结果一并审阅（未批准）。

## Finding 处置

| Finding | 判断 | 处置与落点 |
| --- | --- | --- |
| S-1：输入 owner 变为 `none` 会使 `InputKeyboard` 被卸载，破坏 handoff/exit 过渡 | `CONFIRMED`。当前 `InputProvider` 的 `keyboardState.visible` 依赖 virtual owner 与 active field，`InputKeyboard` 当前以该 visible 门控 render；pending/outgoing 标签在 owner none 后无法读取 | 在详设 §3、§4.2、§4.5、IA §1/§2、交互 VK-04 中分离由 `InputSurfaceFrame` 几何 owner 持有的呈现状态与可编辑 owner；定义 `idle/measure/enter/display/handoff/exit`，保存 outgoing/incoming 键盘快照并在动画完成后卸载。`keyboardState.visible` 继续只门控按键分发，不放宽。计划 CP-3 要求 owner-none 途中卸载变异真实变红。 |
| N-1：严格高度比较受像素网格取整影响 | `CONFIRMED`。严格差异会在非整数设备密度下将相同容量尺寸误分支 | 详设/IA 采用 `0.5` 逻辑单位容差；预检与实测高度差超过容差或容量分类变化时重预检；`|K_B−K_A|≤0.5` 走近等高分支，offset 按共享 progress 插值并逐帧限于 `[-K(t),0]`。CP-3 覆盖 `ΔK=±0.5` 与饱和端点。 |
| N-2：progress 通过 render/assembly 两条 props 通道 | `CONFIRMED`。详设旧稿的 progress prop 与派生 offset context 确会产生双通道 | 改为 `InputSurfaceFrame` 创建唯一 progress 并提供 render-owned `SurfacePresentationOffsetProvider`；公开 `useSurfacePresentationOffset`，无 provider 返回 `0`。render 只声明/消费 offset context；`SurfaceRootContentFrame` 与 `ConsoleSurfaceInputFrame` 不透传 progress。该 provider/hook 是本批唯一必要的新增 render public API；详设 §4.5 与计划 CP-2/逐代码对账表同步。 |
| N-3：滚动字段必须属于 InputScrollArea | `CONFIRMED`。测量规则禁止跨 ScrollView 边界，与本仓 RN/RNW 的差异一致 | 详设 §4.1 写明所有处于可滚动区域的 virtual field 必须是 `InputScrollArea` 后代；CP-0 逐项核验九个生产字段及 scroll host；CP-2 修改 input README，并把 CP-0 字段表作为人工 oracle 逐项对照。 |
| N-4：动画时长/缓动未定；契约数误写为六 | `CONFIRMED` | 交互、IA `ANIMATION_RULE`、详设、计划统一为 `250ms` 与 `Easing.inOut(Easing.quad)`；详设 §9b 和计划 §7 改为“九条契约”。 |

## 实施边界与当前状态

五份正本为：正式需求、交互设计、IA、implementation-facing 详设、实施计划，均在各自头部记录当前授权来源及 `VISUAL_REVIEW=随实施结果一并审阅（未批准）`。设计修订完成后不再另等设计评审；CP-0 已按计划完成静态源码分母与候选可达性核验，独立结果为 `MATCHED`。动态范围不扩到 Web viewport resize、双机拓扑、其它虚拟机或真机。

CP-0 独立审查先发现 field-placement removal-scope 清单缺失与 topology host 可见分支描述不够精确；两项均已回源补入 `doc/evidence/platform/2026-09-23-ter-virtual-keyboard-optimization-cp0-source-reconciliation-codex.md`，之后由新的 fresh 只读子 agent 复核为 `PASS / MATCHED`。这仅证明 CP-0 静态来源记录闭合，不宣称实现、focused 或动态验证已完成。CP-1 至 CP-4 的逐 CP fresh 三维对账、全批 static/focused 与红变异、全批三维对账、逐代码—详设对账、fresh 独立 IMPLEMENTATION review 及双 VM 动态/视觉证据仍是后续必需门。
