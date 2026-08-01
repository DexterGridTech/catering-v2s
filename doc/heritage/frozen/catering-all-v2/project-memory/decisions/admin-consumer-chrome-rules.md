---
id: decisions.admin-consumer-chrome-rules
title: 双管理后台端内统一规则
type: decision
status: active
layer: routed
scope: admin-web
createdAt: 2026-07-13
lastUpdatedAt: 2026-07-16
taskKinds:
  - ui-design
  - frontend-implementation
  - ui-test
domains:
  - admin-ui
consumerFaces:
  - platform-admin
  - operations-admin
owners:
  - frontend-platform
impacts:
  - theme
  - shell
  - feedback
  - locator
  - l2
triggers:
  - admin-page
  - shell
  - theme
sourceRefs: []
---

# 双管理后台端内统一规则

platform-admin 与 operations-admin 各自只能拥有一套 app-owned theme、组件/page shell 边界、Problem feedback、locator 命名、RTK/transport 入口和 L2 runner。业务 feature 只能消费，不能重建。

- 每个 consumerFace 只绑定自己的 app-owned theme profile/config key，不绑定 dark、light、blue 等具体色调；
- 具体色调可随业务需要只改该 app 的唯一 theme config，Journey、业务 spec、页面和测试不得复制颜色值或 `realDark/light` 名称；
- 北极星是端内一致、bootstrap/login/shell/业务页同源消费主题，不要求两端视觉相同，也不要求颜色长期固定；
- 两端共享规范和机械准入形态，不默认共享 runtime UI 包。

PKG-1.5 已证明 platform-admin 最小 consumer seed。旧 PKG-2 页面不再构成 operations-admin 或完整 shell 的实现依据。新版 Roadmap PKG-2 先保留并复验 platform seed、建立 operations seed 和长期目录；PKG-3 起的每个业务 feature 必须在自己的 Journey interaction spec 中声明消费哪个 app-owned 入口。

v4 只能提供任务、层级、密度和成熟组件行为参考；不得把历史色调升级成 active product truth。主题色调整只改 app-owned theme config 与必要视觉证据，不要求批量修改 Journey/业务 spec；consumerFace、Shell 结构或任务层级变化时才需要重新 review。
