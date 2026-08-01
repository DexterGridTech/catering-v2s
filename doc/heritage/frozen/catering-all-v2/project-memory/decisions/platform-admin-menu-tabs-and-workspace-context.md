---
id: decisions.platform-admin-menu-tabs-and-workspace-context
title: 平台管理后台菜单、Content Tabs 与集团空间上下文
type: decision
status: active
layer: routed
scope: all-v2 platform-admin current and future iterations
createdAt: 2026-07-15
taskKinds: [journey-design, ui-design, ui-review, frontend-implementation]
domains: [admin-ui, platform, iam, organization, contract, extension]
consumerFaces: [platform-admin]
owners: [frontend-platform, product]
impacts: [navigation, state, workspace-entry, data-scope]
triggers: [admin-page, new-page, scope-change, shell, ui-change]
sourceRefs:
  - doc/platform/admin-consumer-chrome-standard.md
  - doc/review/platform/2026-07-15-four-domain-journey-design/d01-s06-domain-diagnostics.md
  - doc/review/platform/2026-07-15-four-domain-journey-design/README.md
---

# 平台管理后台菜单、Content Tabs 与集团空间上下文

本规则是 platform-admin 的长期 Shell 不变量。当前四域和后续新增迭代都必须先判定页面是否依赖集团空间上下文，再登记菜单、Content Tab 与切换刷新行为，不能由 feature 临场决定。

## 1. 当前四域菜单分组

| 上下文 | 左侧菜单 | 对应当前 Scenario |
| --- | --- | --- |
| 全局，不要求选择集团空间 | 集团空间管理 | D01-S02/S03/S04/S05 |
| 全局，不要求选择集团空间 | 运维管理员管理 | D04-S11 |
| 集团空间相关 | 集团空间总览 | D01-S06 |
| 集团空间相关 | 组织与经营概览 | D02-S06 |
| 集团空间相关 | 合同概览 | D03-S06 |
| 集团空间相关，归入“账号与权限”菜单组 | 业务角色、页面准入、空间账号 | D04-S01/S02；空间账号页以“账号/邀请”内部 Tab 承接 D04-S03/S05P，不另设空间邀请菜单 |
| 集团空间相关 | 扩展字段 | D01-S07P |

登录成功后默认打开全局的“集团空间管理” Content Tab。集团空间选择器允许未选择；未选择时，全局菜单正常可用，集团空间相关菜单不可进入，并以明确的禁用状态提示先选择集团空间。

## 2. 菜单与 Content Tab

1. 点击任一可用菜单都打开或聚焦对应 Content Tab；同一菜单在同一 Shell 中只保留一个 Tab，不重复打开副本。
2. 全局 Tab 不绑定集团空间；集团空间相关 Tab 绑定当前选择器上下文，但 Tab 身份不包含集团空间，因此切换空间不会复制一批同名 Tab。
3. 页面内部的详情 Drawer、编辑 Drawer 和确认 Modal 使用遮罩承载；任一 Drawer/Modal 打开期间，Shell 左侧菜单、Content Tabs 和集团空间选择器均不可操作。用户必须先完成、取消或关闭当前载体，才能操作 Shell。

## 3. 切换集团空间

1. 集团空间切换只可能发生在没有 Drawer/Modal 打开的基础页面状态，因此不存在“切换时放弃未保存表单”的产品分支，也不存在跨空间携带编辑草稿。
2. 切换立即生效：全局 Tab 保持原数据；所有集团空间相关 Tab 立即清除旧空间内容并标记失效。
3. 当前激活的集团空间相关 Tab 在新空间下立即重新加载；未激活的相关 Tab 不显示旧数据，在用户重新聚焦时加载新空间内容。
4. 新空间加载失败时显示新空间下的失败状态，禁止回退展示旧空间缓存；workspaceKey/workspaceId 不得被业务页面各自复制成第二份当前上下文。

菜单、Content Tab、页面标题和用户反馈不得出现“诊断”；内部 owner query/evidence 仍可使用 `diagnostic` 技术分类。当前用户可见名称固定为“集团空间总览”“组织与经营概览”“合同概览”。

## 4. 后续新增页面

每个新增 platform-admin 页面在 Journey JG0/JG3 必须声明：菜单名称与分组、是否要求集团空间、Content Tab 唯一键、Drawer/Modal 对 Shell 的交互阻断，以及空间切换后的 invalidation/refetch 行为。没有这些裁决，不得进入实现派生。
