# TER terminal 输入形态与虚拟键盘需求 review request

REVIEW_STATUS=READY_FOR_CLAUDE_REQUIREMENTS_REVIEW
REVIEW_CYCLE_ID=TERMINAL_INPUT_SURFACE_AND_KEYBOARD_REQUIREMENTS_2026-09-06
REVIEW_TARGET=REQUIREMENTS
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
REVIEW_KIND=INDEPENDENT_REQUIREMENTS_REVIEW
IMPLEMENTATION_AUTHORITY=false

## 背景

TER terminal 的 ui/base/input 当前只有一个固定横屏前提：sample-console 的静态
terminalSurfaces 尺寸经 assembly 传入 InputSurfaceFrame，VirtualKeyboard 再据此
计算高度和可见性。这个模型不能代表 Android Presentation 的副屏、Web 的实际
transform 尺寸、窗口缩放，也不能承载 Dexter 新裁定的手持 POS 竖屏。

本轮已把问题拆成两个需求输入：

1. surface-form requirements：冻结横屏/竖屏产品形态、竖屏单屏拓扑、沉浸式而非
   true Kiosk 的边界，以及每个 InputSurfaceFrame 用自己的 onLayout 作为尺寸来源；
2. keyboard-visual redesign requirements v2：重做 full、alpha、numeric 和
   financial。full/numeric 有既有业务消费者；alpha/financial 由 sample 会员资料
   页新增的两个受控能力验证字段消费，字段只由 input registry 持有，不进入会员
   domain 或 command。

旧的四布局首版只保留为历史记录。两份新需求仍是
DRAFT_FOR_REQUIREMENTS_REVIEW，尚未进入详设或实施。

## 评审目标

请先评审形态需求，再评审键盘 v2。若形态需求的尺寸来源、竖屏拓扑或 Kiosk/
沉浸式边界不成立，请直接阻断键盘 v2，不要以键盘文档的局部合理性替代前置输入。

请独立判断：

1. 横屏单屏、横屏双屏、竖屏单屏的产品矩阵是否与当前 Journey 和既有
   handheld-confirm 语义闭合；
2. 解除 orientation 与 screenOrientation 横屏硬锁、保留 A 档沉浸式、暂不做
   true Kiosk/Lock Task 的边界是否合理；若需要 Dexter 产品裁决请单列；
3. InputSurfaceFrame 根 View 的 onLayout 是否是能同时覆盖 PRIMARY、SECONDARY、
   Web 响应式盒子、旋转和窗口缩放的正确尺寸 owner；
4. 首帧未测量、不再猜测尺寸、尺寸变化重新计算以及 imeInset 继续由 adapter
   提供的分工是否可实施；
5. 1157 × 723 与 962 × 541 被明确为验收基线而非运行时输入后，Web transform、
   物理 hit target 与 onLayout 的关系是否仍有漏洞；
6. 从 public input API 删除 surfaceSize/InputSurfaceSize、assembly 不再下传静态
   尺寸、同时保留 imeInset 的公共面收敛是否完整；
7. full、alpha、numeric、financial 的键集合、空间分组、keyId/testID、shift/
   caps/backspace/complete/maxLength/焦点与提交语义是否均未被视觉需求改写；
8. sample-only alpha/financial 能力验证字段是否是保留两种布局的最小且诚实方案，
   是否需要进入 Member/PendingMember/command，或者应该被拒绝为测试 UI；
9. full compact/portrait 不强制横向 48、纵向保持 48、numeric 三列保持 48 基线、
   同 surface 同 dock 高度、纵横两轴可行性与“不可行时不死焦点”的组合是否闭合；
10. 需求是否真正解决 flat keyboard 的可用性问题，复杂度是否与当前阶段匹配，
    是否建议进入详设。

## 需阅读文件

请从 catering-v2s 仓库根打开：

- doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md：
  本轮第一份形态需求正本；
- doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md：
  本轮第二份键盘视觉需求正本；
- doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md：
  已标记 superseded 的历史首稿，只用于核对本轮范围变化；
- doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md：
  既有 input 需求正本，确认 system/virtual owner、收缩模型、焦点滚入、年龄和
  性能边界；
- doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-analysis-claude.md：
  历史方案分析，用于识别已被后续裁定推翻的 Dimensions/POC 论点；
- apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx：
  当前 surfaceSize 接缝、内容区与键盘 dock；
- apps/terminal/ui/base/input/src/components/InputProvider.tsx：
  当前 keyboard owner、焦点切换和 surface metrics 接缝；
- apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx：
  当前 flat renderer、四种键集合、keyId 和标签；
- apps/terminal/ui/base/input/src/model/keyboardHeight.ts：
  当前静态尺寸与高度公式；
- apps/terminal/ui/base/input/test/keyboardHeight.test.ts：
  PRIMARY/SECONDARY 基线与既有同高测试；
- apps/terminal/ui/base/input/test/provider.test.tsx：
  owner、焦点与切换行为测试，注意不要把调用计数当成真实焦点证明；
- apps/terminal/ui/integration/sample-console/src/assembly.tsx：
  静态 terminalSurfaces 向 InputSurfaceFrame 的当前传递；
- apps/terminal/ui/integration/sample-console/package.json：
  当前横屏 target baseline；
- apps/terminal/ui/base/dev-host/src/testExpoApp.tsx：
  Web static canvas、scaleToFit、transform 与 viewport 外壳；
- apps/terminal/assembly/android/sample-terminal/app.json：
  当前 Expo orientation；
- apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml：
  当前 Android screenOrientation 与 adjustResize 声明；
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt：
  Presentation 沉浸式 window flags；
- apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLogin.tsx：
  full 的真实消费者；
- apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx：
  system 姓名、virtual numeric 电话以及本轮新增 alpha/financial sample-only 字段的
  owning surface；
- apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx：
  副屏/handheld-confirm 年龄 numeric、maxLength=3 与决策动作；
- apps/terminal/kernel/feature/sample-member-registry/src/types.ts：
  核对 sample-only 字段不得进入 Member/PendingMember；
- apps/terminal/kernel/feature/sample-member-registry/src/commands.ts：
  核对 submitMemberCommand/confirmMemberCommand 不被测试字段扩展；
- apps/terminal/kernel/feature/sample-member-registry/src/features/actors/actors.ts：
  核对年龄与会员 owner 链不被键盘能力验证字段污染；
- doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md：
  已关闭的 input/focus/容量/快照边界；
- doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md：
  副屏系统 IME 的既有产品决定和实施边界。

## 独立核验重点

请以证伪立场亲自重开源码和两份新需求，不接受本 brief 的结论替代核验：

1. 逐行核对方向锁、静态尺寸接缝和 Presentation 沉浸式事实；区分仓内事实、产品
   判断、推论和未证假设；特别核对宿主在 `ensureSecondarySurface` 之前按 PRIMARY
   Activity 当前方向抑制竖屏 SECONDARY 的 owner、时点和反例；
2. 构造一个 PRIMARY、一个 SECONDARY、一个竖屏 frame 和一个 Web resize 场景，
   逐个判断本地 onLayout 能否成为唯一 input 几何来源；
3. 检查首帧无尺寸、尺寸暂时无效、旋转、transform 后实际命中区域与焦点/键盘
   owner 之间是否存在死状态；
4. 复算 1157 × 723 与 962 × 541 的高度边界，另构造窄竖屏的十列 full、三列
   numeric、alpha 和 financial，判断纵向 48、横向 dense token、dock 同高和内容
   208 是否能共同成立；
5. 逐项核对 full、alpha、numeric、financial 的 key set，确认没有丢失旧 key、重复
   testID、改变 keyId 或偷偷引入 space/enter/未批准业务快捷键；
6. 亲自核对 sample-only 两个字段的 fieldId/testID、可见文案、生命周期与提交
   边界；确认它们位于 PRIMARY-only MemberForm 的业务字段之后、动作之前，明确
   “仅 sample/不保存”文案与业务 dirty 隔离，并判断“不进入
   Member/PendingMember/command”是否是诚实且足够的消费者；
7. 检查“不可行时不渲染键盘”是否同时定义了焦点、草稿、可选/必填和决策动作，
   不得留下已获焦却无法输入也无法继续的状态；
8. 检查 resize/transform、系统字体与 Web/Android 单位边界，不能把目标尺寸当成
   运行时输入，也不能把模型 red mutation 当成生产结果；
9. 检查旧 input 需求里的 owner 互斥、none 中转、surface 收缩、焦点滚入、副屏
   不启用系统 IME、快照与年龄链是否被新需求意外改写；
10. 若发现矛盾，给出最小修改，不要通过新增兼容层、设备分类、伪业务字段或未授权
    第三方库回避根因。

每条 finding 请包含：状态、事实类型、仓根相对路径与行号、失败场景、影响面、
最小修复、是否需要 Dexter 产品裁决。状态只能使用
CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、
UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION。

## 期望结论

请分别给出形态需求和键盘需求的结论，并给出总裁定：

GO 或 NO-GO
M=<major> / S=<significant> / N=<note>

请单独回答：

1. 这两份需求是否解决真实问题；
2. 是否存在更简单且不损失可寻址性/可用性的替代；
3. 形态先于键盘视觉的拆分是否正确；
4. sample-only alpha/financial 字段是否是合理的最小消费者；
5. 复杂度是否与当前阶段匹配；
6. 是否建议进入详设。

即使静态 GO，也不表示已实施、已编译、已运行 Android/Web、已通过截图或 UAT。

## 授权边界

本轮只授权独立需求 review。不得修改两份需求、源码、依赖、测试或证据；不得进入
详设、实施、Android/Web 运行、浏览器自动化、DEV、seed、UAT、部署或设备策略。
两份需求都通过后，是否进入详设仍由 Dexter 另行决定。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审 TER terminal 输入承载形态与虚拟键盘视觉重构需求。

背景：上一版键盘视觉需求以固定横屏和静态 terminalSurfaces 为前提，并同时覆盖 full、alpha、numeric、financial。Dexter 新裁定要求产品支持 laptop 横屏与手持 POS 竖屏；竖屏是单 surface 的 handheld-confirm 真实形态。同时要求 input 不依赖外部 surface 尺寸，而由每个 InputSurfaceFrame 在自己的 View 上 onLayout 自测量。当前两份新需求把形态与键盘视觉拆开：第一份冻结横屏/竖屏拓扑、沉浸式而非 true Kiosk 的边界和本地测量模型；第二份保留并重做四种布局，其中 full/numeric 有既有业务消费者，alpha/financial 由 sample 会员资料页新增的两个受控能力验证字段消费。两个字段只由 input registry 持有，不进入 Member、PendingMember 或会员 command。两份都仍是 DRAFT_FOR_REQUIREMENTS_REVIEW，尚未进入详设或实施。

目标：请先评审形态需求，再评审键盘 v2；若形态输入不成立，请阻断第二份。请判断真实问题、范围、边界、复杂度和进入详设的条件。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md
- doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md
- doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-codex.md
- doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md
- doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-analysis-claude.md
- apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx
- apps/terminal/ui/base/input/src/components/InputProvider.tsx
- apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx
- apps/terminal/ui/base/input/src/model/keyboardHeight.ts
- apps/terminal/ui/base/input/test/keyboardHeight.test.ts
- apps/terminal/ui/base/input/test/provider.test.tsx
- apps/terminal/ui/integration/sample-console/src/assembly.tsx
- apps/terminal/ui/integration/sample-console/package.json
- apps/terminal/ui/base/dev-host/src/testExpoApp.tsx
- apps/terminal/assembly/android/sample-terminal/app.json
- apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt
- apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLogin.tsx
- apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx
- apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx
- apps/terminal/kernel/feature/sample-member-registry/src/types.ts
- apps/terminal/kernel/feature/sample-member-registry/src/commands.ts
- apps/terminal/kernel/feature/sample-member-registry/src/features/actors/actors.ts
- doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md
- doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md

请重点独立核验：
1. 横屏单屏、横屏双屏、竖屏单屏的 product matrix 与 handheld-confirm 是否闭合；解除两个横屏硬锁、保留 A 档沉浸式、暂不做 true Kiosk/Lock Task 是否合理；
2. InputSurfaceFrame 根 View onLayout 是否能分别覆盖 PRIMARY、SECONDARY、Web resize、旋转和实际 pointer 命中区域；Dimensions、useWindowDimensions、device sniffing 和静态 terminalSurfaces 是否都被正确排除；
3. 首帧无尺寸、尺寸无效、尺寸变化、imeInset owner 和不可行时的焦点/草稿/决策路径是否无死状态；
4. full、alpha、numeric、financial 的 key set、QWERTY/数字/金融分组、动作行、keyId、testID、accessibilityLabel、shift/caps/backspace/complete/maxLength 语义是否闭合；
5. sample-only 两个字段是否是保留 alpha/financial 的最小诚实消费者，是否应该进入 Member/PendingMember/command，是否会污染 sample 业务语义；
6. 1157×723、962×541 作为 acceptance fixture 而不是 layout input 后，纵向 48、full 横向 dense token、numeric 三列、同 surface dock 同高、内容最小 208 与宽高两轴可行性是否可实施；
7. 平台/宿主 transform 是否会让 onLayout 与物理 hit target 脱钩，且是否有最小修法；
8. 旧 input 的 owner 互斥、none 中转、surface shrink、focus scroll、副屏不启用 system IME、atomic snapshot 和年龄链是否被新稿改写；
9. 需求是否解决真实问题、有没有更简单替代、拆分顺序和复杂度是否匹配当前阶段。

请区分仓内事实、外部事实、推论、产品判断和未证假设。每条 finding 请写状态（CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION）、事实类型、仓根相对路径与行号、失败场景、影响面、最小修复和是否需要 Dexter 裁决。

请给明确：
GO 或 NO-GO
M=<major> / S=<significant> / N=<note>

请单独回答：这是否是真问题、是否有更简单替代、形态先于键盘视觉的拆分是否正确、sample-only alpha/financial 字段是否合理、复杂度是否匹配、是否建议进入详设。静态 GO 不代表实现、编译、Android/Web 运行、截图或 UAT 已通过。

授权边界：本轮只做独立需求 review，不修改需求、源码、依赖、测试或证据，不进入详设、实施、Android/Web、浏览器自动化、DEV、seed、UAT、部署或设备策略。两份需求都通过后，是否进入详设由 Dexter 另行决定。谢谢。
```
