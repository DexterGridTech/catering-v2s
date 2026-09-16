# TER screenPart 机型解析 · CP-5b 步骤级三维对账

```text
REVIEW_TARGET=STEP_RECONCILIATION
REVIEW_SCOPE=CP-5b / B-2 / R-11
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=Sartre
REVIEWER_ID=01a0a991-0b3a-7592-b60b-516561ccbca7
TESTS_RUN=NO; read-only reconciliation
VERDICT=OPEN
```

## 结论

当前 B-2 生产实现的主体与需求、详设和计划一致，但步骤收口所需的 focused negative
coverage 尚不完整，不能把本步标为 `MATCHED`。

## Finding

1. `apps/terminal/ui/base/render/test/renderSurface.test.tsx` 只断言 layer surface
   没有 `alignItems`、`justifyContent`、`padding`，没有断言外层
   `ui-base-render:layer-stack` 的 style。若把旧居中或 `padding:24` 恢复到
   `LayerStack.styles.stack`，测试仍可能全绿。
2. `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx` 与
   `apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts` 只证明 root 使用
   `rootStyle`/包含 `flex:1,width:'100%'`，没有拒绝 `maxWidth`。给 rootStyle 增加
   `maxWidth` 时现有测试仍可能全绿。

## 反例与边界

- `LayerStack` 当前 stack 与 layer 均为 absolute full-bleed，遮罩、层级、dismissible/
  decisive 与 focus/back 语义仍保留；该部分没有发现偏移。
- laptop 的 shared row/list/detail、mobile 的 wrap navigation + single content、7 个
  floating card 自持 bounded frame，以及四个 bounded section 均与当前设计相符。
- B-2 视觉铺满、无 mask 和真实双屏仍不能由本次 focused review 证明，按 D-13 保持未验证。

## 最小处置要求

- 对 `layer-stack` 外层 flattened style 增加不含 `alignItems`、`justifyContent`、`padding`
  的断言；
- 对两个真实 assembly 的 admin root flattened style 增加不含 `maxWidth` 的断言；
- 分别临时恢复 `LayerStack.styles.stack.alignItems='center'` 与
  `AdminShellFrame.rootStyle.maxWidth=480`，证明对应 focused test 变红，再恢复生产源码。

本记录是 fresh 只读审查结果，不把后续主 agent 的 mutation 复验冒充 fresh verdict。
