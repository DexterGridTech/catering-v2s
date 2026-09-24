---
id: practices.ter-input-and-virtual-keyboard-usage
title: TER 输入与虚拟键盘使用边界
type: practice
status: active
layer: routed
scope: every TER input, virtual keyboard, input layout, focus, scroll, or keyboard verification task
taskKinds: ["design","implementation","review","testing"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["platform","frontend-platform"]
impacts: ["architecture","runtime","governance","evidence"]
triggers: ["task-start","implementation","review","failure"]
assertions: ["TER_INPUT_VIRTUAL_KEYBOARD_USAGE_MUST_READ_TR17","TER_INPUT_VIRTUAL_KEYBOARD_MEMORY_IS_POINTER"]
sourceRefs: ["doc/platform/terminal-coding-standard.md","project-memory/practices/ter-input-and-virtual-keyboard-usage.md"]
---

# TER 输入与虚拟键盘使用边界

这是给后续 agent 的路由记忆，不另立一套键盘规则。所有 TER 输入与程序虚拟键盘的硬约束，唯一正本是
[`doc/platform/terminal-coding-standard.md`](../../doc/platform/terminal-coding-standard.md) 的
`TR-17`；触及 Web/设备验证时同时遵守 `TR-16`。若本文件与正本、当前源码或获批需求存在差异，以正本
优先级和当前任务授权重新核验，不要凭历史截图、POC 或聊天摘要实现。

## 后续 agent 的任务前检查

1. 先读 `TR-17`，再读 `apps/terminal/ui/base/input/README.md`；需要改变行为时继续回读获批需求、IA、
   详设和实施计划。
2. 以 `ui/base/input` 为 owner：字段接入看 `useInputField`/`InputProvider`，surface 承载看
   `InputSurfaceFrame`，滚动字段看实际的 `InputScrollArea` 后代关系，键位目录看
   `foundations/keyboardLayout.ts`；不要在 feature/integration 另建同形能力。
3. 涉及 native-less 或 PIN 时，确认 `visibleAnchorRef` 连接的是实际可见 Pressable；涉及滚动时，确认
   hook-bearing 组件没有在滚动区外创建后再传 props。涉及几何时，逐项检查 `measureLayout` 的 root/content
   边界与 presentation offset 是否只计算一次。
4. 涉及布局、Shift、URL 字符、动画或非键盘 UI 时，按 `TR-17` 的反例栏找反例；不能只看 testID、类型、
   常态截图或 focused 结果。
5. 触及 public API 或布局正本时，先列出 README、`src/index.ts`、`terminal-invariants.json` 和 focused
   测试的同步面；验证先按 `TR-16` 在对应 integration Web，再按同一场景到 assembly/设备。

## 不可直接推断的事项

- 本记忆不授权实现、不改变字段分母、不新增业务字段，也不替代 Dexter 对产品语义和动态范围的授权。
- 历史 `_old_`/`newPOSv1` 只能作只读参考；当它与当前 `ui/base/input` 源码或获批设计冲突时，不能回填
  旧键盘形态。
- focused、typecheck 或 testID 存在只能证明对应机械门；Web、Android/native、视觉、业务和 cleanup
  必须分别记录，不能互相升级证据等级。

`TER_INPUT_VIRTUAL_KEYBOARD_USAGE_MUST_READ_TR17` 的内容正本是 `TR-17`；本文件只负责把该正本路由到
TER 输入相关的 design、implementation、review 和 testing 任务。

## 后续 agent 的触发与回读

当任务涉及 `useInputField`、`InputSurfaceFrame`、`InputScrollArea`、`InputKeyboard`、
`VirtualKeyboard`、`KeyboardLayout`、Shift、键盘高度、焦点避让、PIN 锚点、滚动测量或
sample-console/sample-wallpaper-console 的输入入口时，命中本 practice 后必须回读 `TR-17` 与上述 owning
source；完成每个变更点后，用同一组原文回读实现与证据。

`TER_INPUT_VIRTUAL_KEYBOARD_MEMORY_IS_POINTER`：本文件不复制 `TR-17` 的细节，规则修改只改规范正本，
随后重新运行 `scripts/memory/build-index` 与 `scripts/memory/build-index --check`，确保路由索引仍可用。
