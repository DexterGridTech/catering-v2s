---
id: practices.detail-drawer-action-menu
title: 双后台详情抽屉统一使用操作 Popup Menu
type: practice
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["admin-ui","platform"]
consumerFaces: ["platform-admin","operations-admin"]
owners: ["frontend-platform"]
impacts: ["architecture","governance"]
triggers: ["task-start","implementation","review","failure"]
assertions: ["DETAIL_DRAWER_USES_SINGLE_OPERATION_MENU","DETAIL_DRAWER_ACTIONS_REUSE_FOUNDATION","DETAIL_DRAWER_DENOMINATOR_HAS_EXPLICIT_EXCLUSIONS"]
sourceRefs: ["doc/platform/frontend-coding-standard.md","libraries/frontend/admin-ui-foundation/src/overlay/detailActionMenu.tsx"]
---

# 双后台详情抽屉统一使用操作 Popup Menu

两个管理后台的**已存在对象详情 Drawer**，右上角动作统一收敛为一个“操作”按钮；其他动作通过点击后出现的 Popup Menu 展示。动作的业务语义、可用条件、危险标识、确认面、失败反馈和 owner 回调仍由业务 surface 保留，不能由共享组件推导或合并。

本条只覆盖详情 Drawer 的 header action。新建/编辑/配置 Drawer、Modal、页面 Card 详情、列表行菜单、详情正文内的集合行操作和 Drawer 关闭按钮不计入该分母；整改文档必须逐项列出这些反例，不能用全局 `extra` 搜索结果代替详情 Drawer 分母。

共享展示机制必须优先复用 `libraries/frontend/admin-ui-foundation` 的 `AdminDetailActionMenu`；app 不得为同一行为各自再包一层 Dropdown。每个菜单项继续消费所在 app 的 `*TestIds.ts` 唯一源，触发器也必须有稳定 testId。实现前后都要以详情 Drawer 文件、前端规范和本条逐项回读；后续新增详情 Drawer 必须在设计分母中声明菜单动作和排除理由。
