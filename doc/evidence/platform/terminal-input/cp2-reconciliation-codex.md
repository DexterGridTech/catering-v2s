# CP-2 逐项三维对账

```text
REVIEW_CYCLE_ID=TERMINAL-INPUT-IMPLEMENTATION-2026-09-06
STEP=CP-2
RECONCILIATION_TARGET=ui/base/input core + virtual keyboard + scroll/focus
RECONCILIATION_STATUS=PASS
```

本记录重开冻结需求、输入详设/实施计划、相关项目记忆约束与当前源码/focused evidence。
模型红向量只证明门能抓到被注入的坏形态，不能写成生产源码失败；当前生产树的
typecheck/focused 结果单独记录。

| 项 | 需求正本 | 详设/计划 | 当前源码与 focused proof | 结论 |
|---|---|---|---|---|
| field registry | 每个字段独立暂存；注销不能误删新实例 | `fieldsById` + registration token；旧 cleanup 不能删除同 id 新实例 | `useInputField` 以 token 注册/注销；provider focused 覆盖字段独立更新与卸载边界 | MATCHED |
| atomic snapshot | submit/confirm 必须读取同一时刻完整字段值，不从 store 反读 | 同步复制 live registry，冻结 `InputSnapshot`，capture 与 unregister 按 JS turn 先后胜出 | `useInputSnapshot` 读取 provider controller；member form/age confirm focused 覆盖 snapshot→command | MATCHED |
| edit model | 虚拟输入不 dispatch command；selection-aware、maxLength 统一 | 纯 `applyKeyboardKey`，普通键只更新 active field；同一 maxLength 约束程序发键 | `editText` tests 覆盖 selection/backspace/shift/caps/complete/maxLength；input 32 tests PASS | MATCHED |
| keyboard owner | 同一 surface 同时至多一个 system/virtual keyboard | system↔virtual 均经 `none`；system→virtual 只在旧 system owner 上 dismiss；virtual→system 不在目标 system 已获焦后调用全局 dismiss；目标 focus 失败停在 none；layer suspend/restore 由 boundary 协议协调 | provider focused 使用受控 native focus/blur 节点观察首击焦点保留、双向 owner、layer suspend/restore；去掉 virtual→system owner guard 的 red mutation 在目标 system 失焦处失败；`systemVisible + virtualVisible <= 1` 不变量在 state test 中验证 | MATCHED |
| keyboard performance | 每键不得重建整棵 keyboard tree 或 dispatch runtime | `VirtualKeyboard` memo；按键 callback identity 稳定；仅 layout/height/shift/caps/owner 变化可重建 | virtual keyboard focused test 检查父级更新后 key handler identity；provider tests 检查 idle field 不重渲染 | MATCHED |
| layout capacity | 高度来自 surface 声明、有上限、同 surface 各 layout 一致；不足时不制造死状态 | `MIN_CONTENT_HEIGHT=208`、`MIN_KEYBOARD_HEIGHT=250`、`MAX_KEYBOARD_HEIGHT=320`、ratio `0.5`；`MIN(320, floor(H*0.5), H-208)` | `keyboardHeight` pure tests 与 provider `contentTooSmall` focused 覆盖；决策 action 仍存在且 dock 不显示 | MATCHED |
| scroll into view | 键盘出现后字段完整可见；无祖先 no-op；不重复扣 inset | input owner 在 focus/active/layout transition 后测量真实 field 与 viewport，按收缩后 bottom 计算 offset | `InputScrollArea`、`scrollIntoView` 与 scroll focused tests 覆盖 focus/viewport geometry、无祖先 no-op 与 viewport 坐标不双减 | MATCHED |
| Surface frame | Provider 包 content subtree，dock 是 content 下方 sibling；LayerStack 留在可收缩 content | frame 由 render 的单 callback 接入，input 不反向改 render | `InputSurfaceFrame` content/dock tree；CP-1 frame tests 与 input provider tests PASS | MATCHED |
| public contract | 不暴露 inputMode；新增能力为受控加法且 testID 路径不旁路 | `PrimitiveInput` 四个可选 prop + focus/measurement seam；`PrimitiveScrollView` 通用 ref/offset seam | primitives public/invariants/README/test 同步；7/7 primitives tests PASS；input public/invariants/README 同步 | MATCHED |
| cleanup | 字段与键盘状态不能残留；临时探路代码不得进入实现 | provider/field unmount 释放 token；CP-0 probe 只存在于 run artifact | `rg` 扫 sample-terminal 无 CP0 probe/ProbeSurface/virtual-typed 命中；input package 7 files/32 tests PASS（含 native blur 与 owner 首击回归） | MATCHED |

CP-2 独立审查的 round-1/round-2 输入曾分别暴露 key tree 重建与真实 complete 转移证据缺口；主 agent
已按 finding 修复为 `VirtualKeyboard` memo + 稳定 callback，以及 next-field/final-field close-only
focused tests。该 review cycle 已达到两轮上限，不启动第三轮；本记录以当前源码重读与最新
typecheck/focused 输出闭合这两项，而不把独立审查旧的 OPEN 摘要改写成 PASS。

最新 CP-2 focused/typecheck：

```text
@catering-v2s/ui-base-primitives typecheck PASS; REAL_TESTS 7/7 PASS
@catering-v2s/ui-base-render typecheck PASS; REAL_TESTS 37/37 PASS
@catering-v2s/ui-base-input typecheck PASS; REAL_TESTS 32/32 PASS
```
