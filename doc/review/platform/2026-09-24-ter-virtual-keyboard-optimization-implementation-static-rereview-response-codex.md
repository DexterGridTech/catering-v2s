# TER 虚拟键盘优化实施静态复评处置

REVIEW_TARGET=IMPLEMENTATION  
REVIEW_CYCLE_ID=TER-VK-2026-09-24-IMPLEMENTATION  
REVIEW_ROUND=STATIC-REREVIEW-RESPONSE  
AUTHOR_STATUS=STATIC_MATCHED_DYNAMIC_PENDING

对应 Claude 文件：`doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-implementation-static-rereview-claude.md`

## 逐条处置

### S-1：scroll readback 不得由键盘动画结束强制结算

结论：`CONFIRMED`，已修复。

实现不再把 250ms 键盘动画完成当作 ScrollView 已结束。`InputScrollArea` 保留 request-scoped pending，只有以下路径结算：

- `onScroll` 回读的字段框在 0.5 个逻辑单位容差内完整可见：成功；
- `onMomentumScrollEnd`：以最后 offset 判定；
- 低速 `onScrollEndDrag`：以最后 offset 判定；
- 平台不提供终止事件：每次请求一个 1500ms watchdog，以最后 offset 收敛。

代码落点：

- `apps/terminal/ui/base/input/src/foundations/scrollIntoView.ts:23-28,63-99`
- `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx:34-81,231-252`
- `apps/terminal/ui/base/primitives/src/components/PrimitiveScrollView.tsx:23-26,80-92`
- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:691-705`

测试落点：`apps/terminal/ui/base/input/test/scrollArea.test.tsx:200-302`，另有 `scrollIntoView.test.ts` 的半单位容差用例。修复前的红变异见静态对账文档 §4；恢复后 input 105/105 通过。

### S-2：快速往返切换不能复用 fieldId 造成重复 outgoing key

结论：`CONFIRMED`，已修复。

`FrozenKeyboardLayer` 持有创建时不可变的 `layerKey`。被中断的层继续携带原 key；incoming key 纳入 transition serial。measure/handoff/exit 只读取 `item.layerKey`，不再拼接 fieldId、index 或 phase。

代码：`apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:66-71,151-155,157-205,762-797`。测试：`apps/terminal/ui/base/input/test/provider.test.tsx:598-628`，真实红变异复原记录在静态对账文档 §4。

### N-1：输入框架层级测试必须依赖 hosted canvas

结论：`CONFIRMED`，已修复。

删除 `renderSurface.test.tsx` 中只对常量做计算的断言，新增 `renderContentFrame` 输出的 `ui.base.input:surface-frame` 必须是 `ui-base-render:surface-host-canvas` 后代的断言。把 `framedContent` 变为未包装 `content` 的真实红变异会同时击中非单位缩放和层级测试；恢复后 render 101/101 通过。

代码/测试：`apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`、`apps/terminal/ui/base/render/test/renderSurface.test.tsx:400-426`。

### N-2：TR-16 需 Web 先于设备

结论：`CONFIRMED`，已修订计划，动态证据尚未开始。

`doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md:59-67` 已固定 Web→单机双屏/mobile 顺序、同一源码字节和 `VK-WEB-01` 至 `VK-WEB-05` 共享清单，并明确 vitest/jsdom 不计 Web。动态开始后逐场景并列记录，双屏独有承载才可直接依赖设备。

## 静态结论

- focused：input 105/105、primitives 26/26、render 101/101。
- typecheck：input、primitives、render、console-assembly 均 exit 0。
- red mutation：S-1、S-2、N-1 均真实先红、恢复后绿。
- 动态：尚未运行；不能把本静态响应写成 Web、Android、视觉或业务 GO。

## 交付边界

不改业务页面、part、command 或键盘语义；不新增依赖；不扩大到双机拓扑、Web 窗口缩放或未授权设备。下一步按 TR-16 先验证两个 integration 的 Expo Web，再验证单机双屏与 mobile，分开记录业务和 cleanup。

## Fresh 独立只读复核

Banach（agent `01a0d324-4fe8-7240-b9ea-e53de44cfbbd`）对当前设计、实现与测试只读复核：

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=GO_WITH_OPEN_EVIDENCE
M/S/N=0/0/0
```

该 verdict 只关闭本轮静态 finding 的新增风险，不把 focused、Expo Web、Android/device、visual、business 或 cleanup 写成 PASS；动态验证仍必须按 TR-16 先 Web、后设备完成。
