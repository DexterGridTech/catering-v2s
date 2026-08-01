---
id: decisions.admin-drawer-form-lifecycle-and-feedback-standard
title: Admin 抽屉表单生命周期与反馈标准
type: decision
status: active
layer: routed
scope: admin-web drawer mutation forms
createdAt: 2026-07-16
lastUpdatedAt: 2026-07-17
taskKinds: [frontend-implementation, journey-design, ui-design, ui-review, ui-test]
domains: [admin-ui]
consumerFaces: [operations-admin, platform-admin]
owners: [frontend-platform, product]
impacts: [component, feedback, l2, state]
triggers: [admin-page, new-page, review, ui-change]
sourceRefs:
  - doc/decisions/2026-07-16-admin-drawer-form-lifecycle-and-feedback-standard.md
  - ../catering-all-v1/packages/admin-ui-foundation/src/components/AppDrawerForm.tsx
  - ../requirement-doc/design-v6/09.接口契约状态错误与可见性/04-错误码体系与用户可恢复动作.md
---

# Admin 抽屉表单生命周期与反馈标准

- 当前及后续所有管理后台新建、编辑、维护、初始化、重置等 Drawer 表单统一使用 `PRISTINE -> DIRTY -> SUBMITTING -> FAILED/SUCCEEDED` 状态机；只读 Drawer、纯确认 Modal、登录/公开流程、搜索和选择器不自动适用。
- 初始 owner 数据、候选加载和程序化 readback 不计 dirty；所有合法关闭入口共用 dirty guard。dirty 时确认“关闭并放弃/继续编辑”，提交中禁止关闭，成功关闭绕过 guard。
- 受控 `DrawerForm` 的 `onOpenChange(false)` 是组件动画/内部状态同步，不是用户关闭意图，绝不得在其中执行 dirty guard、清空 owner 上下文或调用父级关闭；真实关闭只能从 `drawerProps.onClose`、明确的取消/重置按钮进入统一 `requestClose`。成功关闭由 `closeAfterSuccess` 发起，`afterOpenChange(false)` 只负责确认完全关闭后的反馈，不得再次改变父级 overlay 事实。`onOpenChange(true)` 仅在外部父级确实需要同步打开意图时回传，且不得制造第二个 open owner。
- 提交中 Form 整体 disabled，提交按钮 loading/Spin，阻断重复提交并维持单次稳定 idempotency key；UI 阻断不能替代 owner 幂等。
- 成功必须先获得 owner readback、清理草稿并关闭 Drawer，待完全关闭后再显示“新建成功/保存成功”Modal。
- 失败保持 Drawer 和安全草稿，显示含用户原因的“新建失败/保存失败”Modal；左下 `>更多信息` 可展开为 `v更多信息`，只展示清洗后的 errorCode、correlationId、status、时间和安全 operation/detail/instance。
- 技术详情禁止密码、OTP、token、cookie、header、请求体、哈希、原始 stack、SQL、内部主机；敏感表单值按现有安全规则清空。
- 共享实现只能是 `admin-ui-foundation/behavior` 的薄状态机与 app feedback port，不包装业务字段或制造第二套 ProComponents API；两个 app 分别拥有 theme、Problem 映射和反馈文案。
- 每个适用 Journey 必须把规则绑定到具体 Step、owner mutation/readback、implementation path 和 L2；文件存在或 toast 不算证据。
