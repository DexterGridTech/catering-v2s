# TER terminal 虚拟键盘视觉重构需求 Claude review request

```text
REVIEW_CYCLE_ID=TERMINAL_INPUT_KEYBOARD_VISUAL_REQUIREMENTS_2026-09-06
REVIEW_TARGET=REQUIREMENTS
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
REVIEW_KIND=REQUIREMENTS_REVIEW
IMPLEMENTATION_AUTHORITY=false
```

## 背景

本轮交付单元是 TER terminal `ui/base/input` 的虚拟键盘视觉重构需求，不是实现 review，
也不是布局详设或实施授权。

当前 `VirtualKeyboard` 将每个布局转换为一条扁平按键数组，字符、数字、修饰键和
完成/删除动作没有稳定的视觉分区。用户希望参照系统软键盘的熟悉空间结构，对全部
虚拟键盘做一次认真重构，而不是只改颜色、圆角或平铺间距。

Codex 已形成一份需求草案，范围覆盖现有四种 layout：`full`、`alpha`、`numeric`、
`financial`。草案保留当前编辑语义、键盘 owner、surface 收缩、高度公式、testID 和
性能边界，仅规定键区分组、响应式几何、触控目标、状态、可访问性和验收方式。

本轮不授权任何源码、依赖、Android/Web 运行或视觉实现。需求 review 通过后，才另行
进入详设与实施授权。

## 评审目标

请独立判断：

1. 当前“扁平混排键盘”是否确实构成需要解决的可用性问题，而不是纯视觉偏好；
2. 需求草案提出的四种布局是否覆盖真实公共契约，复杂度是否与当前阶段匹配；
3. `full`、`alpha`、`numeric`、`financial` 的空间分组是否合理，是否有更简单而不
   牺牲可寻址性、触控可用性和跨平台一致性的替代方案；
4. 需求是否保持现有 `KeyboardKey`、光标/选区、shift/caps、backspace、complete、
   maxLength、focus-next/close-only 语义，没有借视觉重构偷偷改变业务行为；
5. 48 × 48 逻辑像素触控目标、左右对称、无截断/溢出、内容区最小 208、键盘最大
   320/半 surface 高度、同 surface 四布局同高这些约束，在 PRIMARY `1157 × 723`
   和 SECONDARY `962 × 541` 下是否可实施且不互相矛盾；
6. 需求是否正确处理 Android 与 Web 的单位、字体基线、系统字体放大、辅助技术和
   testID/accessibilityLabel，不把系统 IME 或厂商键盘行为误当作本包能力；
7. PF-1 至 PF-8 的性能判据是否足够可证伪，哪些是架构保护、哪些仍只是人工观察，
   是否存在 false green 或不必要的采集基建；
8. 新草案 §3.3 对旧需求中 `enter`/`space` 示例的边界处理是否正确。当前生产键类型
   是 `backspace`、`shift`、`caps`、`complete`；若旧需求示例仍是硬约束，请明确指出
   需要先修正哪一份需求，而不是在实现中悄悄新增功能键；
9. 需求草案是否与当前业务使用面一致：StaffLogin 的 `full`、MemberForm 的
   `numeric` 电话、CustomerMember 的三位 `numeric` 年龄，以及中文姓名走系统 IME；
10. 该需求是否应该继续进入详设，或应缩小范围、改写约束或暂缓。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md`：本轮待评需求正本，包含目标形态、四种布局、几何、交互、可访问性、性能和验收矩阵；
- `doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md`：既有 input 需求正本，确认四种 layout、中文/系统 IME 边界、容量和 PF 判据；
- `doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-analysis-claude.md`：早期方案分析，用于识别已被后续裁定推翻的替代方案，不得直接当作当前授权；
- `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx`：当前扁平渲染结构、键类型、keyId、标签和现有四种排列；
- `apps/terminal/ui/base/input/src/model/editText.ts`：当前编辑语义、选区、退格、shift/caps、complete 和 maxLength；
- `apps/terminal/ui/base/input/src/model/keyboardHeight.ts`：surface 高度、内容区下限、键盘高度上限和同布局高度基线；
- `apps/terminal/ui/base/input/test/keyboardHeight.test.ts`：PRIMARY/SECONDARY 目标尺寸和四布局同高的现有测试基线；
- `apps/terminal/ui/base/input/test/virtualKeyboard.test.tsx`：现有 memo/handler 稳定性测试；
- `apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLogin.tsx`：`full` 键盘的真实业务消费者；
- `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx`：系统中文姓名与虚拟数字电话共存的真实表单；
- `apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx`：副屏年龄字段、虚拟 numeric、三位上限和决策动作；
- `apps/terminal/ui/base/primitives/src/rnr/slots.tsx`：当前应用文本字体缩放边界和 RNR copy-in 实现；
- `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md`：已实施 input 能力的焦点、容量、性能和公共面边界，防止布局需求回退已关闭行为；
- `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md`：已实施范围与副屏系统 IME 的产品/平台边界，确认本轮不重新打开该决策。

## 独立核验重点

请以证伪立场重新打开当前源码和需求，不接受仅凭本 brief 或草案自述通过：

1. 逐项核对四种 layout 当前实际 key 集合与草案目标形态，确认没有丢失旧 key、重复
   testID、改变 keyId 或偷偷新增 `enter`/`space` 等功能。
2. 用两个真实 surface 尺寸重算布局容量：确认 48 hit target、左右间距、文本完整性、
   内容高度 208、键盘高度公式和五行/四行布局可以同时成立；如果某条必须下沉到详设，
   请指出最小应保留在需求层的约束。
3. 检查“同一 surface 四布局同高”与不同布局行数、动作行、字体基线之间是否冲突；
   不要用一张宽主屏截图替代副屏可实施性。
4. 检查视觉重构是否仍保持 keyboard dock 位于收缩内容区下方，而非变回 overlay；
   system/virtual owner、LayerStack suspend/restore、focus scroll 和副屏虚拟输入
   边界是否被需求意外改写。
5. 检查 testID、accessibilityRole、accessibilityLabel、Web/Android focus order、
   pressed/disabled/shift/caps 状态是否有可执行的验收，而非只写“看起来一致”。
6. 检查 PF-1 至 PF-8 是否能区分结构保护、真实树行为、人工连打观察和性能证明；特别
   判断“每键重渲染计数”是否会漏掉同步重活或产生不必要 false red。
7. 对照 StaffLogin、MemberForm、CustomerMember，确认 input 包仍是业务无关的布局/编辑
   owner，业务 feature 不需要加入屏数分支、业务键盘组件或 className。
8. 复核官方依据是否只支持设计原则而没有被过度外推。相关一手资料：
   [Android accessibility views](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views)、
   [Apple Virtual Keyboards](https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards)、
   [Material interaction states](https://m3.material.io/foundations/interaction/states/overview)、
   [React Native TextInput](https://reactnative.dev/docs/textinput)。
9. 明确区分：仓内事实、外部事实、推论、产品判断和仍未证明的假设；不要把已有
   implementation focused PASS 误写成新布局已在 Android/Web 验收。

## 期望结论

请返回明确的：

```text
GO 或 NO-GO
M=<major> / S=<significant> / N=<note>
```

每条 finding 请包含：

- 状态：`CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
  `UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`；
- 仓根相对路径与行号；
- 事实类型：仓内事实、外部事实、推论、产品判断或尚缺证据的假设；
- 失败场景和影响面；
- 最小修复建议；
- 是否需要 Dexter 产品裁决。

请单独回答：

1. 这是否解决真实问题；
2. 是否存在更简单的替代方案；
3. 四段复杂度是否与当前阶段匹配；
4. 是否建议进入详设。

## 授权边界

本轮只授权需求 review。不得修改需求、详设、源码、依赖、测试或证据，不得运行
Android/Web、浏览器自动化、DEV、seed、UAT 或部署，不得把 review 结果当作布局实施授权。
需求 review 通过后，再由 Dexter 单独决定是否进入详设和实施。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审 TER terminal 虚拟键盘视觉重构需求。

背景：本轮只评需求是否成立、范围是否合理、边界是否清楚，不评实现，也不授权详设或实施。当前 VirtualKeyboard 把字符、数字、修饰键和完成/删除动作放在一个扁平按键列表中，用户希望参照系统软键盘的熟悉空间结构，重构 full、alpha、numeric、financial 四种程序虚拟键盘。Codex 已写出需求草案，但它仍是 DRAFT_FOR_REQUIREMENTS_REVIEW；当前实现的 input focused PASS 不等于新布局已在 Android/Web 验收。

目标：请独立判断这是否是真实可用性问题、四种布局与既有输入契约是否闭合、复杂度是否匹配当前阶段，以及是否应该进入详设。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md：本轮需求正本；
- doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md：既有 input 需求、四种 layout、容量与性能边界；
- doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-analysis-claude.md：历史替代方案，仅用于识别已被推翻的论点；
- apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx：当前 flat renderer、键集合、keyId 与标签；
- apps/terminal/ui/base/input/src/model/editText.ts：编辑与 complete/maxLength 语义；
- apps/terminal/ui/base/input/src/model/keyboardHeight.ts：高度公式与内容区边界；
- apps/terminal/ui/base/input/test/keyboardHeight.test.ts：1157×723、962×541 和四布局同高基线；
- apps/terminal/ui/base/input/test/virtualKeyboard.test.tsx：性能边界基线；
- apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLogin.tsx：full 消费者；
- apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx：系统姓名与虚拟电话共存；
- apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx：副屏年龄 numeric 与 maxLength=3；
- apps/terminal/ui/base/primitives/src/rnr/slots.tsx：字体缩放公共边界；
- doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md 和 doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md：已关闭的 input/focus/IME/性能边界。

请重点独立核验：
1. flat keyboard 是否是真实可用性问题，是否有更简单且不牺牲可寻址性/触控性的替代方案；
2. 四种布局的 key 集合、QWERTY/数字/金融分区、动作行、keyId、testID 与现有 KeyboardKey 语义是否闭合；
3. 48×48 hit target、左右对称、无截断/溢出、内容最小 208、键盘最大 320/半 surface 高度在 PRIMARY 1157×723 与 SECONDARY 962×541 是否同时可实施；
4. 同 surface 四布局同高是否与不同的行数和 action row 冲突；
5. system/virtual owner、surface shrink、focus scroll、副屏只支持 virtual keyboard 等既有边界是否被需求改写；
6. testID/accessibility/focus order/pressed-disabled-shift-caps 状态与 PF-1 至 PF-8 是否能形成可证伪验收，是否有 false green 或过度基建；
7. §3.3 对旧需求 enter/space 示例的处理是否正确，以及真实业务消费者是否覆盖了本批范围。

请区分仓内事实、外部事实、推论、产品判断和未证假设，并给出：
GO 或 NO-GO；M/S/N；每条 finding 的状态、相对路径与行号、失败场景、影响面、最小修法及是否需要 Dexter 裁决。请另外单独回答：这是否是真问题、有没有更简单替代方案、复杂度是否匹配当前阶段、是否建议进入详设。

授权边界：本轮只做需求 review，不修改任何文件，不运行 Android/Web 或浏览器自动化，不进入详设、实施、依赖改动、DEV、seed、UAT 或部署。谢谢。
```
