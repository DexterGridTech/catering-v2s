---
id: practices.drawer-form-lifecycle
title: 可编辑 Drawer 必须由 useDrawerFormLifecycle 统一管理
type: practice
status: active
layer: routed
taskKinds: ["design", "implementation", "review", "testing"]
domains: ["admin-ui", "platform"]
consumerFaces: ["platform-admin", "operations-admin"]
owners: ["frontend-platform"]
impacts: ["architecture", "governance"]
triggers: ["task-start", "implementation", "review", "failure"]
assertions: ["EDITABLE_DRAWER_USES_FOUNDATION_LIFECYCLE", "DRAWER_CLOSE_INTENTS_SHARE_ONE_LIFECYCLE", "DRAWER_MASK_AND_KEYBOARD_FOLLOW_SUBMITTING", "DRAWER_CLOSE_CLEARS_LOCAL_DRAFT", "DRAWER_OVERLAY_LOCK_IS_FOUNDATION_OWNED", "DRAWER_LIFECYCLE_IS_NOT_REIMPLEMENTED_IN_APP"]
sourceRefs: ["doc/platform/foundation-charter.md", "doc/platform/frontend-coding-standard.md", "libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts", "libraries/frontend/admin-ui-foundation/src/overlay/overlayLock.tsx", "project-memory/practices/frontend-capability-lookup.md"]
---

# 可编辑 Drawer 的统一表单生命周期

## 1. 适用范围与根因

本条适用于 `platform-admin` 与 `operations-admin` 中所有承载新建、编辑、配置或资产暂存的
Drawer 表单。只读详情 Drawer 不需要为了“看起来统一”引入表单生命周期；它仍必须显式声明
`maskClosable`。Modal 表单使用 foundation 已有的 Modal/提交生命周期能力，不把 Drawer hook
复制到 App 内。

根因是把关闭当成 Drawer 的视觉属性：关闭按钮、右上角、遮罩点击、Esc、提交成功和页面切换
分别写了不同的回调，结果会绕过脏表单确认、在提交中误关闭，或把上一次未提交的本地草稿带到
下一次打开。最小可复用解是 foundation 的 `useDrawerFormLifecycle`，由它统一管理关闭意图、
脏状态、提交锁、成功关闭、关闭完成后的会话边界和诊断事件。

## 2. 设计规范：在 IA/交互/详设中必须先写清楚

每个可编辑 Drawer 在设计工件中都必须明确以下事实，不能只写“可关闭”或“有脏表单提示”：

1. **唯一 lifecycle owner**：使用 `useDrawerFormLifecycle`；父层拥有 `open`，Drawer 通过
   `onClose={lifecycle.requestClose}` 与 `afterOpenChange={lifecycle.afterOpenChange}` 接入。
2. **关闭意图全集**：右上角关闭、遮罩点击、Esc、底部“取消”都进入同一个
   `requestClose`，不得由某一路径直接调用 `onOpenChange(false)`。
3. **脏表单规则**：表单变更后由 `lifecycle.setDirty(true)` 标记；关闭时由 foundation 的
   确认框决定“继续编辑”或“放弃并关闭”。不得由页面另造第二个确认框或第二套 dirty 状态。
   dirty 的唯一 owner 是承载表单的 Drawer lifecycle；`Form.Item`、Switch/Input/Tree 节点、presenter
   和业务子组件只能通过宿主 Form 的变更链通知编辑意图，不得自行维护 dirty、比较草稿、安装 close guard
   或显示“请先保存/放弃修改”等提示。Shell 只能消费 foundation 的 `locked` 阻断导航、上下文切换和账号动作，
   不得把 `dirtyLocked` 渲染成第二个常驻提示；用户可见的 dirty 确认只在 lifecycle 处理关闭意图时出现。
4. **提交锁规则**：异步提交、上传、暂存或释放资产期间使用 `setSubmitting(true)`；期间
   禁止关闭和重复提交。结束后在 `finally` 恢复提交状态。
5. **遮罩与键盘规则**：所有 Drawer 都显式使用 `maskClosable`，表单 Drawer 的值为
   `maskClosable={!lifecycle.submitting}`、`keyboard={!lifecycle.submitting}`。不要用 dirty
   状态关闭遮罩，也不要依赖 Ant Design 默认值。只读详情 Drawer 显式写 `maskClosable`。
6. **关闭完成与草稿边界**：使用 `afterOpenChange(false)` 作为视觉关闭完成信号；在这里或
   对应的 `closedSessionKey`/hydrate 边界中清理本地草稿、临时资产、选中项和错误。再次打开
   同一或另一实体时，不得显示上一次取消操作留下的本地编辑内容。
7. **成功关闭**：提交成功使用 `closeAfterSuccess()` 或等价的 lifecycle 成功路径；不能把
   普通取消路径伪装成成功，也不能在 Drawer 尚未完成关闭时提前清理需要释放的资源。

设计工件必须把上述事实逐字传递到交互、IA 和 implementation-facing 详设；如果某个 Drawer
确实不能通过遮罩或 Esc 关闭，必须在该 screen 的技术边界和错误/关闭观察中说明例外原因，
并仍使用同一 `requestClose` 处理显式关闭动作。

## 3. 实现规范：只接 foundation，不在 App 重造

### 3.1 标准接线

```tsx
const lifecycle = useDrawerFormLifecycle({
  open,
  onOpenChange: nextOpen => {
    if (!nextOpen) onClose();
  },
  dirtyMessage: '当前填写内容尚未保存。',
  diagnosticOperationId: '业务操作标识',
});

return (
  <Drawer
    open={open}
    onClose={lifecycle.requestClose}
    afterOpenChange={lifecycle.afterOpenChange}
    maskClosable={!lifecycle.submitting}
    keyboard={!lifecycle.submitting}
  />
);
```

实际字段变更、暂存资产或其他业务编辑意图发生时调用 `setDirty(true)`；命令、上传、释放
资源和冲突处理期间调用 `setSubmitting(true/false)`。关闭按钮、取消按钮和宿主传入的关闭回调
都不得绕过 `requestClose`。可复用的 foundation 能力优先于本地 `Modal.confirm`、本地
overlay lock、手写 close guard 或通过 `destroyOnHidden` 假设清空草稿。

### 3.2 草稿清理与重新打开

- Drawer 关闭后必须以 `afterOpenChange(false)` 为边界清除上一次会话的本地草稿；若组件
  需要保持挂载以完成确认，则使用 lifecycle 返回的 `closedSessionKey` 触发重建或显式执行
  `reset()`。
- hydrate 逻辑必须同时检查实体 identity 与 lifecycle dirty 状态；dirty 时不能被刷新或
  候选请求覆盖，关闭完成后才能为下一次打开重新 hydrate。
- 暂存图片、预览 URL、候选选中项、动态行选中项和错误状态都属于会话状态，不能因为父层
  只把 `open` 设回 `true` 就自动复用。

### 3.3 遮罩写法唯一化

全仓 Drawer/Modal 遮罩只允许使用 `maskClosable` 属性这一种写法：

- 表单 Drawer：`maskClosable={!lifecycle.submitting}`；
- 提交型 Modal：`maskClosable={!submitting}` 或其等价提交锁；
- 只读/结果面：显式 `maskClosable` 或 `maskClosable={false}`。

禁止 `mask={{closable: ...}}`，也禁止省略 `maskClosable` 依赖 Ant Design 默认值。这个规则
只统一遮罩配置语法和关闭时机，不改变套餐组件等其他业务域的 `selectionRule` 语义。

## 4. 反例与最小修复

| 反例 | 真实后果 | 最小修复 |
|---|---|---|
| `onClose={() => onOpenChange(false)}` | 关闭绕过脏表单确认 | `onClose={lifecycle.requestClose}` |
| `maskClosable={!lifecycle.dirty}` | 脏时遮罩点击没有机会弹确认 | `maskClosable={!lifecycle.submitting}`，由 `requestClose` 判断 dirty |
| 只在 `useEffect` 里按实体 ID hydrate | 取消后再次打开继续显示上次本地草稿 | `afterOpenChange(false)` + `closedSessionKey`/`reset()` 清理会话 |
| 每个 App 自写 `Modal.confirm`、锁或关闭 hook | 两个后台出现不同文案、竞态和重复确认 | 复用 foundation `useDrawerFormLifecycle` |
| 规则树/字段控件自建 dirty 或 Shell 额外渲染 dirty 提示 | 同一次编辑出现多个 dirty owner，背景页面会出现与当前关闭意图无关的“请先保存”提示 | 由宿主 Form 的 `onValuesChange` 通知唯一 lifecycle；Shell 仅消费 `locked`，提示由 lifecycle 在关闭意图上呈现 |
| 通过 `mask={{closable: ...}}` 或省略属性 | 遮罩行为出现三种写法，后续无法做全局静态检查 | 统一显式 `maskClosable` |

## 5. 验收与证据边界

设计/实现 review 至少检查以下可观察事实：

1. 每个可编辑 Drawer 都引用 foundation hook，且 `onClose`、`afterOpenChange`、
   `maskClosable`、`keyboard` 的接线存在；没有同屏第二套 close guard。
2. 表单变更后分别从关闭按钮、遮罩、Esc 发起关闭，三者显示同一放弃确认；选择继续编辑
   不关闭，选择放弃才关闭。
3. 提交中遮罩和 Esc 不会关闭，提交结束后恢复；重复提交被锁住。
4. 取消后重新打开同一实体，商品属性、点单选项、图片暂存和动态行都来自最新读回，不会
   出现上一次未提交草稿。
5. 全仓静态扫描不存在 `mask={{closable: ...}}`，也不存在未声明 `maskClosable` 的
   Drawer/Modal。静态/typecheck/focused 证据不能冒充浏览器 L2；L2 未授权时如实标注。
6. 每个可编辑 Drawer 的 dirty 变更链只落到宿主 lifecycle；子控件/树节点没有第二套 dirty、close guard
   或 dirty 文案，Shell 只使用 `locked` 做交互阻断而不渲染常驻 dirty 提示。此静态规则必须有一个真实的违规变更可使 focused gate 失败；关闭确认、焦点和叠层行为仍需在获授权 L2 中验证。

## 6. 代码锚点

- lifecycle 正本：`libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts`
- overlay lock 正本：`libraries/frontend/admin-ui-foundation/src/overlay/overlayLock.tsx`
- operations-admin 表单样板：`apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`
- platform-admin 表单样板：`apps/frontend/platform-admin/src/features/workspace-management/ui/WorkspaceEditDrawer.tsx`
- foundation 能力索引：`project-memory/practices/frontend-capability-lookup.md`
