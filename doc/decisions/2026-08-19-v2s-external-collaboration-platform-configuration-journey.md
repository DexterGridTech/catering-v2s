---
title: v2s 外部协作配置 Journey 裁决
status: ACCEPTED_TEXTUAL_DESCRIPTION
createdAt: 2026-08-19
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
decisionOwner: Dexter
implementationAuthority: true
---

# Journey 裁决：外部协作配置

## 1. 裁决元数据

```text
JOURNEY_ID=EXTERNAL_COLLABORATION_PLATFORM_CONFIGURATION
STATUS=ACCEPTED_TEXTUAL_DESCRIPTION
BUSINESS_JOURNEY_CONFIRMATION=ACCEPTED_TEXTUAL_DESCRIPTION
SKILL_USED=NONE
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md
BUSINESS_SOURCE=doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md
AUTHORITY=当前会话 Dexter 2026-08-19 GO；已授权按文字版 Journey/IA 实施
```

## 2. 用户任务与成功结果

- **Actor**：运维管理员，使用运维管理后台 `platform-admin`。
- **此刻任务**：切换到指定集团空间，浏览外部系统及接入档案的契约定义和该空间启停状态，按档案认证方式维护外部主体绑定，并控制系统/档案是否对运营侧开放。
- **成功结果**：页面显示契约目录、该集团空间启停状态和绑定 owner readback；非外部授权绑定可增改删，需外部授权的绑定只提供删除/解绑相关操作；任何敏感凭证值、token、`authorizationRef` 值和 `nodeRef` UUID 都不可见。
- **失败后仍成立的事实**：契约定义不因某个集团空间的启停而改变；启停和绑定写入必须由 collaboration owner 最终核验；失败不得隐藏或物理删除历史对象。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 运维管理员 | 有效 platform session | `ESTABLISHED_SOURCE` | platform edge session/owner recheck | `PLATFORM-BLUEPRINT.md`；`project-memory/practices/backend-capability-lookup.md` | 返回认证/访问问题，不创建默认身份 |
| 访问资格 | 运维管理员 | 可访问 platform-admin，且不使用 operations capability | `ESTABLISHED_SOURCE` | platform edge | `PLATFORM-BLUEPRINT.md`；`contracts/openapi/paths/platform-admin/group-workspace-management.paths.json` | 返回 typed access denied |
| 入口数据 | 运维管理员 | 已选集团空间 `groupWorkspaceKey` | `ESTABLISHED_SOURCE` | `apps/frontend/platform-admin/src/app/state/WorkspaceScope.tsx` | `project-memory/decisions/confirmed-business-language-corpus.md#G-01` | 保持页面未选空间空态，不猜空间 |
| 契约目录 | 运维管理员 | `external_system` 与 `provider_profile` checked-in 定义 | `IN_SCOPE_PRODUCED` | 本批 contract 设计；实现时由契约发布链读取 | `doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md#记录 001` | 目录发布失败；不产生 HTTP owner 状态 |
| 空间启停/绑定 | 运维管理员 | 当前集团空间的 enablement 与 binding owner facts | `IN_SCOPE_PRODUCED` | collaboration owner readback | 本批 IA 与 implementation-facing design | 只读错误/空态；不以 contract 的 `catalogStatus` 猜启停 |

## 4. 任务边界、非目标与禁推

- **范围内动作**：P1 外部系统树、P2 系统详情、P3 档案详情、P4 绑定列表、P5 绑定详情、P6 绑定新建/编辑；系统/档案启停；按认证方式维护绑定；读取能力属性字典。
- **非目标**：适配器实际调用、外部授权跳转页面、解绑 URL/签名、订单同步 runtime、菜单/库存/配送 runtime、UAT/L2、DEV、seed/reset、任何生产代码或契约写入。
- **禁推**：`catalogStatus=PLANNED` 不得被推导成不可启用或不可进入运营候选；`bindableNodeTypes` 只影响管理面候选，不推导权限、数据可见性或 runtime 分发；静态凭证不进入主库。
- **禁止伪修复**：不显示 UUID 代替节点名称；不以隐藏字段补充 `externalOwnerId`；不为 platform-admin 新造 capability；不以 UI 隐藏代替 owner 授权。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 集团空间 | `project-memory/decisions/confirmed-business-language-corpus.md#G-01` | 所有启停、绑定事实按集团空间隔离 | 无 | 否 |
| G-10 运维管理后台 URL | `project-memory/decisions/confirmed-business-language-corpus.md#G-10` | 页面路由不携带集团空间编码；空间由 WorkspaceScope 会话上下文提供；API 路径仍可携带 `groupWorkspaceKey` | 原 IA/UI 页面路由曾错误携带编码，已修正 | 否 |
| 集团→大区→项目 | `...#G-02` | 节点候选的商场运营方路径 | 无 | 否 |
| 总公司→门店关联 | `...#G-03`、`...#G-04` | 租户侧节点候选从 tenant/store owner 读取 | 无 | 否 |
| platform-admin 授权 | `PLATFORM-BLUEPRINT.md` | 有效 session + owner recheck，无 capability | 无 | 否 |
| 解绑中/失败分支 | `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md#5.6` | 只保留为 C-04 依赖，不落本轮最终状态枚举 | C-04 | 仅到具体 contract/DB 落点时问 |

## 6. UI 适用性与后续工件

`UI_BEARING=true`。交互工件为：

`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md#screen-p1外部系统接入配置树`

该工件已经给出逐 screen 九维度、交互地图、状态/边界、owner/face 矩阵和线框；
`DEXTER_WIREFRAME_REVIEW=ACCEPTED_TEXTUAL_DESCRIPTION`，按已接受的文字版 Journey/IA 实施，不再等待另行视觉确认。

## 7. Dexter 确认待办

- **已确认**：Dexter 2026-08-19 已确认本 Journey 的业务范围与 actor/owner 边界；本文本按已接受的文字版作为实现输入。
- **精确范围**：只覆盖本批 P1-P6 与 OP-01～OP-12、OP-20～OP-21 的管理面设计；外部适配器 runtime 与解绑协议细节不在本批执行。
- **已知前提**：contract 定义全局；enablement 与 binding 按集团空间隔离；`PLANNED` 只作信息标注，契约存在即可启用。
- **未决项**：C-01、C-02、C-03、C-04、C-08、C-09；均不得在本批被擅自固化为契约或数据库硬约束。
- **后续允许动作**：按已授权的 implementation-facing 详设和串行计划实施；仍须保留六项 C 的依赖态，并在实施后完成独立复核。
