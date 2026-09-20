# TER 虚拟键盘视觉与交互 implementation review 交接

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_STATUS=READY_FOR_CLAUDE_REVIEW
IMPLEMENTATION_AUTHORITY=DEXTER_GRANTED_2026-09-19
IMPLEMENTATION_STATUS=CODE_AND_FOCUSED_STATIC_EXECUTION_COMPLETE_REVIEW_PENDING
CODE_DESIGN_RECONCILIATION=MAIN_AGENT_MATCHED_FOR_CURRENT_REVIEW_REPAIRS
INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN
INDEPENDENT_IMPLEMENTATION_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN
STATIC=PASS
FOCUSED=PASS
WEB=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN_FOR_THIS_FIX
DEVICE=OPEN_NOT_RUN_FOR_THIS_FIX
VISUAL_ROI_98_PERCENT=OPEN
RELEASE=OPEN_NOT_RUN
CLEANUP=OPEN_FOR_THIS_FIX
PERFORMANCE=NO_PERFORMANCE_CLAIM
```

## 背景

TER 虚拟键盘的 laptop/mobile 八种形态已按用户确认的完整 IA 作为实现基线，源码实现、
focused tests、包 typecheck 与 terminal static 已执行。本轮又发现一个具体的 IA 偏差：
普通 key 与 action key 按下时只有 opacity/scale，没有显示 IA 要求的主题色边框；CAPS/SHIFT
的锁定边框已经存在。该问题已在 primitives owner 处根因修复，并补充了按下/释放红绿验证。
本轮 implementation review 另发现并已修复 dock 边框高度预算缺项与 Android 每键无用的登录
渐变变量订阅，并同步清理 evidence/计划口径，现交 Dexter 与 Claude 做复评。

本交接中的“代码与 focused/static 执行完成”不等于 implementation acceptance、视觉 98%、
Web、Android、release 或整体验收通过。

## 评审目标

请独立核验：

1. `PrimitiveButton` 是否在 `variant="key"` 与 `variant="key-action"` 下正确合并
   `selected || pressed`，使普通键/动作键按下显示 integration 的 `keyboard-focus` 边框，
   释放恢复 idle 的 `keyboard-border`，且 CAPS/SHIFT 的 selected 锁定边框不回归；
2. 按下态是否仍只由 primitive 自己持有局部状态，继续保留 key `opacity:0.78`、action
   `opacity:0.72` 与 `scale:0.985`，没有把 input controller、store 或业务状态引入 renderer；
3. 普通 key/action 的 focused test 是否真的在删除 pressed focus recipe 时变红，而不是只验证
   token 存在；释放后的 idle 恢复是否有独立断言；
4. dock 外框高度是否含上下两侧 `DOCK_BORDER_WIDTH`，laptop/mobile 内容盒加边框是否不超过
   固定高度；普通 key/action pressed 的 `border-2` 是否仍按批准 IA 保留并在连续击键时观察；
5. `PrimitiveButton` 是否只在 `login-primary` 子组件内订阅登录渐变变量，keyboard button 是否
   不再建立这两个 native-only hooks；
6. 本轮改动是否没有破坏 PrimitivePinInput 的 surface-dismiss 事件透传、alpha CAPS/SHIFT
   编辑语义、mobile modifier 符号、numeric/financial 布局、两个 integration theme 与
   非键盘 PrimitiveButton；
7. 证据是否按档位诚实分开：focused/static 已执行；fixed-ROI visual 98%、Web、Android
   device、release 未由本轮 focused/static 冒充通过。

## 需阅读文件

- `doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-design-codex.md`：视觉 token、五种按键状态、primitive owner 与不做项；
- `doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-plan-codex.md`：CP-1/CP-2 红变异与验证边界；
- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`：键盘行为、布局、alpha CAPS 与输入语义正本；
- `doc/plans/platform/assets/2026-09-19-ter-terminal-input-keyboards-ia-complete.png`：laptop/mobile 八种形态的视觉基线；
- `doc/evidence/platform/terminal-input-keyboard-visual/pressed-state-border-fix-codex.md`：本轮根因、红绿证明与证据分档；
- `doc/evidence/platform/terminal-input-keyboard-visual/cp1/reconciliation-codex.md`：primitives/theme CP-1 历史对账；
- `doc/evidence/platform/terminal-input-keyboard-visual/cp2/reconciliation-codex.md`：alpha、renderer 与输入边界 CP-2 对账；
- `doc/evidence/platform/terminal-input-keyboard-visual/cp3/reconciliation-codex.md`：consumer、README 与 static/focused 对账；
- `doc/evidence/platform/terminal-input-keyboard-visual/cp4/reconciliation-codex.md`：全批 source/design 对账；
- `doc/evidence/platform/terminal-input-keyboard-visual/dynamic-validation-codex.md`：既有 Android supporting evidence 与 OPEN 档位；
- `apps/terminal/ui/base/primitives/src/components/PrimitiveButton.tsx`：keyboard token 选择与 pressed state owner；
- `apps/terminal/ui/base/primitives/src/theme/tokens.ts`：keyboard neutral/focus semantic class recipe；
- `apps/terminal/ui/base/primitives/src/components/PrimitiveKeyboardSurface.tsx`：keyboard surface 与事件边界；
- `apps/terminal/ui/base/primitives/src/types/types.ts`：PrimitiveButton/keyboard public props；
- `apps/terminal/ui/base/primitives/src/index.ts`：primitives public export；
- `apps/terminal/ui/base/primitives/test/primitives.test.tsx`：普通 key/action 按下边框、释放恢复与 selected modifier focused proof；
- `apps/terminal/ui/base/primitives/README.md`：pressed/selected keyboard token 公共语义；
- `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx`：CAPS/SHIFT selected 传递、普通 key/action 渲染与 memo 边界；
- `apps/terminal/ui/base/input/src/foundations/keyboardHeight.ts`：dock 外框高度与边框预算；
- `apps/terminal/ui/base/input/test/keyboardHeight.test.ts`：laptop/mobile 内容盒加边框高度证明；
- `apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts`：四类键盘 key inventory 与行形；
- `apps/terminal/ui/base/input/src/foundations/editText.ts`：caps/shift 编辑语义；
- `apps/terminal/ui/base/input/test/virtualKeyboard.test.tsx`：键位、testID、modifier 与 renderer focused proof；
- `apps/terminal/ui/base/input/test/editText.test.ts`：大小写切换语义；
- `apps/terminal/ui/base/input/README.md`：input 与 primitive 的状态边界；
- `apps/terminal/ui/integration/sample-console/theme/global.css`：sample-console keyboard theme values；
- `apps/terminal/ui/integration/sample-console/tailwind.config.cjs`：sample-console semantic mapping；
- `apps/terminal/ui/integration/sample-console/test/theme.test.ts`：theme symmetry/value focused proof；
- `apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css`：sample-wallpaper-console keyboard theme values；
- `apps/terminal/ui/integration/sample-wallpaper-console/tailwind.config.cjs`：sample-wallpaper-console semantic mapping；
- `apps/terminal/ui/integration/sample-wallpaper-console/test/theme.test.ts`：theme symmetry/value focused proof；
- `doc/platform/terminal-coding-standard.md`：TER primitive、theme、依赖与验证约束；
- `doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-review-claude.md`：本轮实现 review findings；
- `project-memory/index.md`：项目记忆入口与当前终端治理索引；
- `scripts/README.md`：受管验证命令入口与证据边界。

## 独立核验重点

请以当前源码为准，重点执行或核对：

- `yarn workspace @catering-v2s/ui-base-primitives typecheck`；
- `yarn workspace @catering-v2s/ui-base-primitives test`；
- `yarn workspace @catering-v2s/ui-base-input typecheck` 与 `test`；
- `yarn workspace @catering-v2s/ui-feature-sample-staff-auth typecheck` 与 `test`；
- 两个 integration 的 `typecheck` 与 `test`；
- `yarn --cwd apps/terminal verify:static`；
- 直接删除或绕过 `const keyboardSelected = selected || pressed` 的 pressed 分支，确认
  `shows the theme focus outline for every pressed keyboard key and action` 必红；再确认恢复后
  普通 key/action 的按下 class 含 `border-2 border-keyboard-focus`、释放 class 不含该边框；
- 删除 `selected` 消费时，CAPS/SHIFT selected focused proof 必须变红；
- 复核 `PrimitiveButton` 的 default/button variants 没有意外消费 keyboard token；
- 复核 `VirtualKeyboard` 仍把 `selected={capsLock}` 与 `selected={shift}` 只用于 modifier，
  普通键没有业务 state；
- 复核两个 integration 的 `keyboard-focus` 仍由各自 theme 提供，未被 base 写死颜色；
- 复核 primitive/input 的 onTouchEnd/onClick 透传与 document stub 恢复没有回归；
- 视觉方面不得用 focused className 断言替代 IA↔runtime 的固定 ROI 对账；当前 fixed-ROI
  visual/98% 保持 OPEN，Web/Android/device/release/cleanup 按实际证据分档。

当前可核对的结果记录：

- primitives：typecheck PASS，1 file / 22 tests PASS；
- input：typecheck PASS，10 files / 60 tests PASS；
- sample-staff-auth：typecheck PASS，1 file / 9 tests PASS；
- sample-console：typecheck PASS，8 files / 45 tests PASS；
- sample-wallpaper-console：typecheck PASS，4 files / 18 tests PASS；
- terminal static：PASS，run id `ter-local-static-24932-1789821283376`；
- fixed-ROI visual 98%：OPEN；Web：OPEN；本轮 Android/device：OPEN；release：OPEN。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 请带：

- 精确仓库相对路径与行号；
- 仓内事实、推论与尚缺证据的区分；
- 影响面与最小修复建议；
- 是否需要 Dexter 产品或范围裁决；
- `static`、`focused`、`Web`、`Android`、`device`、`visual`、`release`、`cleanup` 的独立档位。

不得把当前 focused/static 结果写成视觉 98%、Web PASS、Android PASS、release PASS 或
implementation acceptance；`INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN` 与
`INDEPENDENT_IMPLEMENTATION_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN` 均须保留，二者不是同一轮。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请 review TER keyboard implementation。
背景：普通 key/action 按下使用 `selected || pressed` 的 `keyboard-focus`，释放 idle，CAPS/SHIFT selected 保留。Dexter 已授权。
目标：核验按键状态、theme 与 keyboard 回归。
重点：删除 pressed recipe 与 dock border budget 必须红；Android keyboard button 不应订阅登录渐变；focused/static 不等于 visual/Web/Android/acceptance；两个 independent review 状态保持 OPEN 且不得互相冒充。
请给 `GO`/`NO-GO` 与 M/S/N，finding 带相对路径/行号、事实/推论、证据缺口、最小修复及档位。
授权边界：只 review 本次键盘改动；GO 不等于 acceptance PASS。谢谢。
路径：doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-design-codex.md
```

交付前执行：

```bash
scripts/check/claude-review-handoff --file doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-review-handoff-codex.md
```
