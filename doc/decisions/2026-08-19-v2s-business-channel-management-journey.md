---
title: v2s 经营渠道管理 Journey 裁决
status: ACCEPTED_TEXTUAL_DESCRIPTION
createdAt: 2026-08-19
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
decisionOwner: Dexter
implementationAuthority: true
---

# Journey 裁决：经营渠道管理

## 1. 裁决元数据

```text
JOURNEY_ID=BUSINESS_CHANNEL_MANAGEMENT
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

- **Actor**：商场运营方或店铺运营方，使用运营管理后台 `operations-admin`。
- **此刻任务**：在项目或门店的数据节点范围内，定义四维经营渠道模板，创建任意多条渠道实例，必要时建立/维护外部主体绑定，并通过 owner readback 判断渠道是否可生效。
- **成功结果**：项目页只维护项目定义的模板和项目主体渠道；门店页只选择上级项目维护且经营主体为门店的模板并维护门店渠道；模板编码由用户录入并在项目内唯一，渠道编码由用户录入并在集团空间内唯一，二者创建后不可修改；内部渠道创建即生效，外部渠道只有绑定有效时才可生效；同一模板可创建多条渠道。
- **失败后仍成立的事实**：渠道、模板、绑定的历史事实保留；停用对象置灰不隐藏且不可编辑；门店停用不被推导为禁止创建绑定或渠道；渠道写 capability 只有项目、门店两个目标类型。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 商场运营方/店铺运营方 | 有效 operations session | `ESTABLISHED_SOURCE` | operations session/context | `PLATFORM-BLUEPRINT.md`；`project-memory/decisions/confirmed-business-language-corpus.md#G-05` | 返回登录/上下文问题，不创建默认身份 |
| 页面准入 | 商场运营方 | 集团/大区/项目角色可访问项目渠道页 | `ESTABLISHED_SOURCE` | workspace IAM 页面准入 | 规格 §9.3；`...#G-05A` | 页面不可见或 typed access denied |
| 页面准入 | 店铺运营方 | 集团/大区/项目/门店角色可访问门店渠道页 | `ESTABLISHED_SOURCE` | workspace IAM 页面准入 | 规格 §9.3；`...#G-05A` | 页面不可见或 typed access denied |
| 数据节点 | 两类运营用户 | 项目页定位 PROJECT，门店页定位 STORE | `ESTABLISHED_SOURCE` | operations data-node context | 规格 §9.3；`...#G-05` | 保持上下文选择态，不从 URL/body 猜授权范围 |
| 写授权 | 两类运营用户 | 仅项目渠道编辑或门店渠道编辑 grant | `ESTABLISHED_SOURCE` | edge 解析 `OperationsOwnerScopeGrant`，owner 首读复核 | `project-memory/practices/backend-capability-lookup.md` | typed access denied；读接口不因无 capability 被拦截 |
| 模板/渠道/binding | 两类运营用户 | 当前 workspace 与 target owner 的真实事实 | `IN_SCOPE_PRODUCED` | 本批 business-channel/collaboration owner | 本批 IA 与 implementation-facing design | 保持失败前状态；不隐式创建关系 |

## 4. 任务边界、非目标与禁推

- **范围内动作**：O1 模板列表、O2 模板新增/修改/停用与外部档案候选、O3 项目渠道列表/维护、O4 渠道详情、O5 门店渠道列表/维护；绑定在渠道上下文中的建立/维护；能力属性字典读取。
- **非目标**：销售菜单绑定、订单同步、外卖/团购 runtime、配送、库存、外部 API、复杂规则 DSL、门店停用语义重裁、L2/UAT/DEV/seed/reset。
- **禁推**：把模板/渠道实例条数当作编码唯一性；把编码改成系统生成或允许编辑；外部能力判断规则 DSL（C-08）；“停用门店不能建渠道”；`PLANNED` 不能候选。
- **禁止伪修复**：不在运营页提供非渠道绑定管理入口；不把 capability 当 GET 读取权限；不把项目主体模板显示在门店候选；不以手工“置为有效”绕过外部授权。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 项目/门店节点 | `project-memory/decisions/confirmed-business-language-corpus.md#G-02`、`#G-03` | 页面数据节点和候选路径 | 无 | 否 |
| G-10 运营管理后台 URL | `project-memory/decisions/confirmed-business-language-corpus.md#G-10` | 项目/门店页面 URL 第一段携带 `groupWorkspaceKey`，用于定位空间但不构成授权 | 无 | 否 |
| 角色、页面准入、capability | `...#G-05`、`#G-05A` | 读取/写入分离 | 无 | 否 |
| 门店状态 | `...#G-08` | 不阻断本批绑定/渠道创建 | 已由 Dexter 2026-08-19 再确认 | 否 |
| 渠道多实例 | 规格 E-10、BR-15 | 同模板允许多渠道 | 无 | 否 |
| 恢复 stopReasons | 规格 C-01、BR-26 | 设计保留依赖，不冻结具体恢复算法 | C-01 | 具体持久化落点时问 |
| 模板/渠道编码 | 规格 §5.8/§5.9、C-03 | 模板编码项目内唯一；渠道编码集团空间内唯一；均由用户创建时录入且不可变 | 已收口 | 否 |

## 6. UI 适用性与后续工件

`UI_BEARING=true`。交互工件为：

`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md#screen-o1项目经营渠道管理`

交互工件的两个独立页面分别是“项目经营渠道管理”和“门店经营渠道管理”；每个页面内的模板区、渠道列表、详情抽屉、表单抽屉均作为独立 surface 描述。`DEXTER_WIREFRAME_REVIEW=ACCEPTED_TEXTUAL_DESCRIPTION`，按已接受的文字版 Journey/IA 实施。

## 7. Dexter 确认待办

- **已确认**：Dexter 2026-08-19 已确认本 Journey 的业务范围与 actor/owner 边界；本文本按已接受的文字版作为实现输入。
- **精确范围**：只覆盖 O1～O5 与 OP-13～OP-21 的管理面设计，以及渠道上下文内的绑定命令；不实现下游 runtime 使用。
- **已知前提**：运营侧只有项目渠道编辑、门店渠道编辑两个写 capability；读接口只依赖菜单/页面准入和 owner read scope。
- **未决项**：C-01、C-02、C-04、C-08、C-09；C-03 已按规格收口为集团空间内唯一并已落到 owner/数据库；其余未决项仍不得固化超出本批边界的契约或数据库约束。
- **后续允许动作**：按已授权的 implementation-facing 详设和串行计划实施；仍须保留五项未决 C 的依赖态，C-03 按已收口规则执行，并在实施后完成独立复核。
