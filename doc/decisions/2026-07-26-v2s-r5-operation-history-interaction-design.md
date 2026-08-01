---
title: R5 操作历史交互设计
status: DEXTER_WIREFRAME_ACCEPTED
createdAt: 2026-07-26
journeyDecision: doc/decisions/2026-07-26-v2s-r5-operation-history-journey-decision.md
implementationAuthority: false
---

# 交互工件：R5-AUDIT 操作历史

## 1. 工件元数据

```text
JOURNEY_DECISION=doc/decisions/2026-07-26-v2s-r5-operation-history-journey-decision.md#journey-裁决r5-audit-操作历史
UI_BEARING=true
DEXTER_WIREFRAME_REVIEW=ACCEPTED
DEXTER_HIFI_REVIEW=NOT_REQUIRED
CONSUMER_FACE=platform-admin|operations-admin
```

该能力是 R-11 新增用户功能，不能把 v2 的“审计摘要”误说成完整对应页。历史页面继续以
v2 的详情信息架构（名称进入详情、详情右上动作）为基线；新增内容只是一处可复用 Modal。

## 2. Interaction map

| 顺序 | 前提 | route / 屏幕 | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 已在获授权实体详情 | 详情右上“操作历史” | 从当前事实追溯变更原因 | 仅显示按钮，不在列表操作列新增入口 | 无写；前端保留当前 entity type/id | 打开 Modal loading 态 | 无权限/无实体时按钮不替代服务端判定 |
| 2 | Modal opened | `AUDIT-HISTORY-MODAL` | 在左侧定位最近一条历史 | 左侧分页列表以发生时间为主信息，并显示操作者/动作摘要；右侧先显示该页第一条的完整详情 | platform 调用 `getPlatformEntityAuditHistory`、operations 调用 `getOperationsEntityAuditHistory`；二者共用 owner-scoped task read，首屏返回列表行和右侧详情所需字段 | 非空页默认选中首项；空页显示空态 | typed denied/not-found 关闭 Modal 并保留详情；unknown 在左侧列表区显示可重试提示 |
| 3 | 已有非空页 | 同一 Modal | 理解某条记录的具体变更 | 点击左侧任一列表项；右侧显示该项动作、操作者、目标、时间和人可读字段差异 | 不新增逐项读取；使用当前页 `items[]` 已返回的完整详情 | 本地切换 selected audit item，不跳转、不改路由、不影响实体详情 | 当前页已成功读取时，选中切换无网络失败面 |
| 4 | 多页历史 | 同一 Modal | 查看更早或更新记录 | 左侧标准分页控件“上一页 / 页码 / 下一页”；不使用“加载更多” | 按 page/pageSize 的稳定分页 readback；新页返回后默认选中该页首项 | 替换左侧列表与右侧详情为新页首项 | 页读取失败保留上一成功页和原选中详情；仅左侧显示重试 |

## 3. v2 对应页面盘点

| screen id | 对应关系 | all-v2 Heritage path@SHA-256 | 静态基线 / 摹本标注 | 差异及原因 |
| --- | --- | --- | --- | --- |
| `AUDIT-HISTORY-MODAL` | `NO_V2_COUNTERPART` | 检索范围：`catering-all-v2/apps/frontend/{platform-admin,operations-admin}/src`; 仅命中 platform-admin `PlatformAdminDetailDrawer.tsx` 的 `auditSummary`，未命中完整历史 Modal | 详情右上动作与信息分层摹自已接受的 R5 v2 详情基线 | R-11 明确新增“操作历史”；摘要不能承载分页、操作者或字段前后值，因此不得冒充对应页 |

Heritage 仅作静态审看，无 runtime/build fallback。

## 4. 低保真线框

### Screen: AUDIT-HISTORY-MODAL

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 操作历史 · <当前实体业务名称>                                                  [×] │
├───────────────────────────────┬───────────────────────────────────────────────────┤
│ 历史记录                      │ 记录详情                                          │
│                               │                                                   │
│ ▸ <发生时间>                  │ <动作业务文案> · <目标业务名称>                  │
│   <操作者显示名> · <动作摘要> │                                                   │
│ ────────────────────────────  │ 操作者：<操作者显示名>                            │
│   <发生时间>                  │ 发生时间：<发生时间>                              │
│   <操作者显示名> · <动作摘要> │                                                   │
│ ────────────────────────────  │ 变更内容                                          │
│   <发生时间>                  │ <字段业务名称>：<变更前值> → <变更后值>          │
│   <操作者显示名> · <动作摘要> │ <字段业务名称>：<变更前值> → <变更后值>          │
│                               │                                                   │
│ [上一页]  1 / <总页数> [下一页]│                                                   │
│ [加载中] / [读取失败，可重试] │                                                   │
├───────────────────────────────┴───────────────────────────────────────────────────┤
│                                                                      [关闭]         │
└───────────────────────────────────────────────────────────────────────────────────┘
```

这是一个固定的左右 Master–Detail Modal：左栏是历史列表，发生时间为每项首要识别信息；右栏只
展示左栏当前选中项的详情。首个非空页默认选中第一项；换页成功后也默认选中该页第一项，不能保留
不属于新页的 selected id。窄屏时可上下堆叠，但仍是同一个 Modal 和同一个选择状态，不产生路由。

Modal 是详情的辅助读取，不是 Drawer：它不承载实体编辑、不会与详情 Drawer 嵌套形成另一套
生命周期，也不改变路由、tab 或当前上下文。右栏变更区域按 action 使用紧凑 Descriptions/列表块，
不得展示裸 JSON；无敏感字段时才显示前后值，凭据类 action 只显示“凭据已重置/已修改”。

## 5. 状态与边界表

| 屏幕/动作 | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown | owner/face 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 打开历史 | button click 后 Modal skeleton | entity type 必须为 Journey §4.1 闭集 | 只读，无 command | 显示首屏左侧列表，并默认选中首项；无记录时显示全 Modal 空态 | 关闭并反馈 typed error | 保留详情，Modal 可重试 | platform/operations edge 复核会话与宿主 read 权限 |
| 选择历史项 | 左侧当前页已读取 | selected audit id 必须属于当前 `items[]` | 只读，本地状态切换，无 Idempotency-Key | 右侧替换为该项完整详情 | 不适用 | 不适用；不会重新读取或拼接审计事实 | owner 已返回脱敏业务 readback；前端只按 generated `fieldKey` 映射本 app 中文 label，不得补造/过滤字段差异 |
| 切换页码 | 保留上一成功页；左栏 loading | page/pageSize 受 contract 闭集约束 | 只读，无 Idempotency-Key | 成功后替换当前页并选中新页第一项 | 同上 | 保留上一成功页和原选中详情，左栏可重试 | owner audit task read；排序为 occurredAt + audit id 稳定顺序 |
| 关闭 | 无 | 无 | 无 | 回到未变化详情 | 不适用 | 不适用 | 前端 overlay lifecycle；无服务端副作用 |

## 6. 逐操作任务合理性

| 操作 | 批准 Journey 来源 | 用户为何此时操作 | 是否有更短路径 | 不选替代的理由 | 约束归因 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- | --- | --- |
| 详情右上打开历史 | `R5-AUDIT` §2 | 用户刚在看该实体，目标已明确 | 列表操作列 / 独立页面 | 列表缺上下文；独立页面破坏追溯后返回详情的任务连续性 | R-11 要求实体详情按钮；R5 B.5 三定律 | 否，R-11 已裁决 |
| 左侧列表、右侧详情与分页读取 | `R5-AUDIT` §2 | 历史可能多，用户需要先按时间定位、再集中阅读一条详情 | 一次性全量 / 时间线混排 / Drawer | 全量不具扩展性；时间线将定位与字段差异混在一起；Drawer 与实体详情生命周期冲突，且 R-11 指定 Modal | contract/read owner | 否 |
| 人可读差异 | `R5-AUDIT` §2 | 用户要理解“改了什么” | 原始 JSON | JSON/列名不可读且 R-11 明确禁止该反模式 | R-11、G-01~G-10 | 否 |

## 7. Face / owner 对齐矩阵

| 屏幕/动作 | consumer face | 页面准入 | server operation | owner readback / command | 不可由前端替代的判定 |
| --- | --- | --- | --- | --- | --- |
| platform 详情历史 | platform-admin | 宿主详情既有平台 read scope | `getPlatformEntityAuditHistory` | 各 owner audit task read + platform session；actor 使用 command-time snapshot | entity 可见性、actor 脱敏、action 闭集、历史排序；不实时跨 owner 查身份 |
| operations 详情历史 | operations-admin | 宿主详情 page/capability/node scope | `getOperationsEntityAuditHistory` | 各 owner audit task read + workspace session/context；platform actor 固定投影“平台管理员”，workspace actor 限同一 group workspace 的历史显示名 | groupWorkspaceKey、角色/数据节点和宿主 read scope；不因审计暴露手机号、登录名或账号 id |

## 8. Manifest B.4/B.5 命中对照

| manifest 条文 | 本 Journey 的命中或不适用理由 | 遵循方式 | Heritage 原文 |
| --- | --- | --- | --- |
| B.4 前端架构与状态 | 命中：Modal read 走 generated RTK endpoint、context 失效扇出和 foundation observability | 不在组件内手写 HTTP、缓存或日志；同页选中项只用本地状态 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-frontend-implementation-standard.md@12afa79f...` |
| B.5 列表/详情/动作三定律 | 命中：实体详情右上动作；审计 Modal 内左列表只作记录定位，右栏承载详情；不新增实体列表操作列 | 入口固定在实体详情 actions，不把内部历史定位列表误作业务实体列表 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/business-entity-list-detail-action-standard.md@3d036edb...` |
| B.5 AntD/ProComponents | 命中：Modal + List/Pagination + Descriptions，不使用 disabled form 或 Drawer | 复用 admin-ui-foundation overlay/lifecycle 契约 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/admin-ui-interaction-and-ant-design-usage-standard.md@25e3ec01...` |

## 9. 高保真静态 demo

`NOT_REQUIRED`。该交互是一个受现有详情信息架构约束的标准 Master–Detail Modal；本低保真线框
已足够让 Dexter 确认左侧时间列表、右侧详情、分页和“非 Drawer”边界。

## 10. Dexter 看图结论

- 看图日期：`2026-07-26`
- 低保真线框结论：`ACCEPTED`（左侧按时间分页列表；点击项后右侧显示详情）
- 高保真 demo 结论：`NOT_REQUIRED`
- 允许进入 implementation-facing design：`是；仍须完成新的详设 manifest、独立盲审、Claude review 与 Dexter 接受；本工件不授权实施`
