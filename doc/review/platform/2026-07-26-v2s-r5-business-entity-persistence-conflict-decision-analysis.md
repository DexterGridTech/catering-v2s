---
title: R5 业务实体冻结契约与 owner 持久化冲突——决策分析请求
type: review
subtype: dexter-and-claude-decision-analysis
status: AWAITING_DEXTER_AND_CLAUDE_DECISION
reviewTarget: R5 business-entity contract-to-owner persistence closure
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
createdAt: 2026-07-26
author: Codex
authorizationBoundary: ANALYSIS_ONLY_NO_IMPLEMENTATION_AUTHORITY
---

## 背景

Phase B 的 B3 要求 edge controller 消费 generated wire，且不能以 inline DTO、`Object`、反射或
`null` 填充伪造契约合规。实现时发现一个不是类型转换能解决的冲突：R5 冻结 contract 已保留
all-v2 已实现的业务实体编辑字段，但当前 v2s owner schema 和 command API 都不能保存或读回其中
的部分字段。

这不是要求恢复 all-v2 runtime/build fallback。Heritage 仅作为已冻结字段和既有用户任务的只读
证据；v2s 仍应保持一个 deployable、一库七 schema、单 Flyway history、generated wire 和两个独立
admin app。

## 已核验的冻结输入

| 输入 | 当前 SHA-256 | 本问题中的含义 |
| --- | --- | --- |
| `contracts/openapi/components/organization/business-entity.schemas.yaml` | `377ec01121ab75a4ed60ce3ab3e6160b693bab4aad3f1edb624be16930ad221d` | R5 wire 的字段真相 |
| `apps/backend/catering-business-server/src/main/resources/db/migration/V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql` | `0fde7d832aa376c57fe8eecd41ed40a3a2d7ca9ec2d9e50266e9f604f2eb2ff0` | 当前 organization 表实际形状 |
| `libraries/backend/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java` | `618b303474a49e1dd78f429f26fb5f45ed65cd8251818e2c2c69dd940c314c39` | 当前 owner command/readback 能力 |
| `../catering-all-v2/apps/backend/organization-service/src/main/resources/db/migration/V4__business_entity_management.sql` | `009ff90b03013011805bf4a70b344571f3e375147d6f4142ee25a187721e6ec9` | Heritage 持久化对照，仅只读 |
| `../catering-all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx` | `ce3ff54d22af79f5e973c42cfa8040199b1feb4d11f0dae03464fc417340276f` | Heritage 已实现 UI 任务对照，仅只读 |
| `doc/review/platform/2026-07-26-v2s-r5-structure-and-enforcement-execution-directive-claude.md` | `b18084a1f564aecb14c5bf9289489033cc2fabc3c14cceda0b8b0efe9a32418d` | 当前执行边界：不改 owner API/migration byte |

# 事实链

## 1. 冻结 contract 不是死字段

`BrandCreateRequest`/`BrandUpdateRequest` 接受 `alias`、`remark`；`Tenant` 与
`HeadCompany` 的 create/update 接受 `remark`，同时三类 readback 都要求准确的
`extensionValues`、`extensionRuleRevision`、`createdAt`、`updatedAt`。Tenant/HeadCompany
还要求非空的 `legalName` 与 `unifiedSocialCreditCode`。

- Brand schema: `business-entity.schemas.yaml:4-123,180-223`。
- HeadCompany schema: `:241-365,409-531`；Tenant schema: `:533-700`。
- v2 真实 UI 不只是显示这些字段：创建和编辑都提交 brand 的 `alias/remark`、legal entity 的
  `legalName/unifiedSocialCreditCode/remark`，并在详情/表单中读回。证据见 Heritage
  `BusinessEntityManagementPage.tsx:397-438,510-554`。
- R5 carry-over manifest 明确将该页面作为 `OPERATIONS-BUSINESS-ENTITIES`、`ADAPT`，并把
  “brand-tenant-head-company-auth-extension-fields”列为 focused evidence：
  `contracts/policy/frontend-asset-carryover-manifest.json:396-403`。

因此，这不是“可空字段可以悄悄不支持”的情况；至少 `alias` 和三类 `remark` 均有真实用户输入和
owner readback 语义。

## 2. 当前 v2s owner 无法保存这些事实

当前 migration 的三张 owner 表只有：

| owner fact | 当前表形状 | 无法满足的冻结语义 |
| --- | --- | --- |
| `organization.brand` | `code/name/status/version/created_at_epoch_millis/updated_at_epoch_millis` | 无 `alias`、`remark`、entity-level `extension_rule_revision` |
| `organization.tenant` | 允许空的 `legal_name/credit_code`，无 `remark`、entity-level `extension_rule_revision` | contract 的非空 legal profile、remark、稳定的 extension rule revision |
| `organization.head_company` | 同 tenant，另有授权关联表 | 同 tenant，且详情必须与授权品牌一起 readback |

证据为 `V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql:123-157`。`credit_code`
可以作为 `unifiedSocialCreditCode` 的物理承载，不要求改名；但当前它可空、长度 64 且无
workspace-scoped 唯一约束，不能证明冻结 contract 要求的非空 32 位统一社会信用代码语义。

现有 `BusinessEntityService` 也没有接收 `alias`/`remark` 的 command 参数，且 `requireEntity`
只选择 `id/workspace/key/code/name/legal_name/credit_code/status/version`，不能返回 timestamps、
extension values 或本次写入使用的 extension rule revision。见
`BusinessEntityService.java:36-73,156-165`。

仅增加 edge mapper 或 owner task-read **不能保存 command 输入**；它们只能解决已有数据库事实的
readback 投影问题。

## 3. Heritage 对照支持“补齐”，不支持“照搬”

all-v2 的 V4 migration 确实在品牌表保存 `alias/remark`，在租户/总公司表保存
`legal_name/unified_social_credit_code/remark`，并对 legal profile 加非空与 unique 约束：
`../catering-all-v2/.../V4__business_entity_management.sql:1-69`。

这不是把 v2 多服务、`workspaceKey`、source/external-sync、旧 revision 或旧 generated wire 搬回来的
理由。它只证实 R5 已冻结且被 UI 使用的字段有独立 owner 事实，不是 extension definition 或 audit
附属数据。

# 为什么不能靠实现技巧绕过

| 候选做法 | 结论 | 原因 |
| --- | --- | --- |
| edge 忽略输入或读回 `null` | 拒绝 | 用户已提交的 alias/remark 会丢失；generated 类型绿但业务行为假绿。 |
| 把 alias/remark 塞入 `extensionValues` | 拒绝 | 扩展值属于 definition-controlled 动态字段；把固定主数据塞入其中会改变宿主和 validation 语义。 |
| 写入 `organization_audit.detail_json` | 拒绝 | audit 不是当前 owner fact，不支持 CAS/readback/查询，并会把审计当业务表。 |
| edge 直接 SQL 或反射/`ObjectMapper.convertValue` | 拒绝 | 违反 edge 禁持久化、B3 显式映射和 owner sovereignty；仍不能形成正确 command 事务。 |
| 改写现有 R5 migration | 拒绝 | 破坏已执行 Flyway history 与指令的 immutable-byte 边界。 |
| 仅新增 task-read | 部分可行但不足 | 可承接 timestamps、extension values、head-company authorized brands 的 readback；不能承接缺失的写入事实。 |
| 从 contract 移除字段 | 可行但不推荐 | 会缩减 all-v2 已实现页面功能，必须重开 R5 contract/UI design scope，而非普通实现修复。 |

# 可裁决方案

## 方案 A（推荐）：授权“additive correction”而非改写历史

授权一个受限的 R5 correction pack：**新增**一条能力命名、严格递增的 Flyway migration；绝不修改
已有 R3/R5 migration 字节。该 pack 同时允许相应 owner command/readback API 和 task-read assembler
演进，以精确执行已经冻结的 contract。

最小技术内容：

1. `organization.brand` 新增 `alias VARCHAR(120)`、`remark VARCHAR(2000)`、
   `extension_rule_revision BIGINT NOT NULL DEFAULT 0`；tenant/head-company 新增
   `remark VARCHAR(2000)` 与 `extension_rule_revision BIGINT NOT NULL DEFAULT 0`。
2. 对 tenant/head-company 先做数据 precondition readback，再收紧 `legal_name`/`credit_code`：非空、
   非空白，`credit_code` 长度不超过 32，并增加 `(workspace_uuid, group_workspace_key, credit_code)`
   唯一性。既有无效/重复数据必须使 migration typed-fail，不能截断或静默归并。
3. owner command 使用不可变 command DTO 接收 alias/remark/legal profile/expected extension revision；
   command 在同一 `REQUIRED` transaction 写 owner 表及 extension values，并以 owner readback 返回。
4. owner application 的 task-read assembler 提供完整的 page/detail 投影；edge 只做显式
   owner-readback → generated wire 映射。timestamps、extension values、head-company authorized brands
   均由 owner 读取，不允许 edge SQL。
5. `externalCode` / `legalExternalCode` 当前没有 R5 command 输入或 approved UI task。它们可以在
   generated response 中如实为 `null`，但必须在 mapping contract 中显式标为
   `NOT_COLLECTED_R5`；不得伪造值，也不得顺势恢复 all-v2 external-sync/source 语义。

这会改变**数据结构与 owner API 能力**，所以必须显式解除执行指令第 3 节“owner API、migration
bytes 不改”的这一小段限制；它不改变下列任何冻结分母或外部协议：104 operation、32 scenario、
22 surface、25 pageDesignKey、7 owner schema、HTTP path、operationId、error code、事务边界或已有
migration bytes。

## 方案 B：收缩 contract/UI 语义

从 R5 contract 和 carry-over target 中删除 alias/remark，并把 tenant/head-company legal profile 调整为
当前可空 `creditCode` 语义。优点是无需新 migration；代价是 R5 不再是“v2 已实现业务与前端功能”的
全量迁移，必须重开受影响 Journey/interaction/contract/frontend manifest 的设计和 review。此方案与
既有 R5 范围不一致，不推荐。

## 方案 C：接受字段存在但不落库

拒绝。它既不满足 v2 carry-over 用户任务，也不能通过 owner readback 或未来 DEV/seed 的业务证据。

# Codex 的辩证判断

**CONFIRMED**：这是 R5 实现前设计/迁移落地遗漏，不是“生成器还不够强”的问题。所有已冻结分母可以
保持不动；问题集中在 organization owner 的字段承载、command 和 readback。

**CONFIRMED**：方案 A 的成本低于方案 B。当前仍是早期，新增一条 additive migration、owner
assembler 与 focused Testcontainers proof 是一次性成本；若先把 UI/edge 做成丢字段版本，后续将至少
重做 schema、owner command、generated mapping、前端 form、seed 和 evidence 六个面。

**PARTIALLY_CONFIRMED**：`externalCode/legalExternalCode` 是 Heritage schema 残留但不在当前已批准
R5 form task 中。保持 response nullable 并显式 `NOT_COLLECTED_R5` 可避免虚构能力；是否要连同
schema 删除属于产品/contract 范围变化，应由 Dexter 决定，不能由实现会话自行删除。

**DEXTER_DECISION_REQUIRED**：是否按方案 A 允许受限 correction pack。该决定改变当前 execution
directive 的 schema/owner-API 边界，但不扩大 R5 业务范围。

# 建议的裁决文字

```text
Dexter 裁决建议：接受方案 A。允许 Codex 在 R5 已批准范围内新增一条 organization owner 的
additive correction Flyway migration，并同步演进该 owner 的 command/readback/task-read API，
仅用于完整执行已冻结的 Brand/Tenant/HeadCompany alias、remark、legal profile、extension rule
revision 与 owner readback 语义。不得改写现有 migration bytes；不得改变 104/32/22/25/7 分母、
HTTP path、operationId、error code、既定事务语义或恢复 external-sync/source 语义。完成后继续
Phase B，并把该 correction pack 连同 R5 全范围实现一次性交由唯一 whole-scope review 验收。
```

## 评审目标

请 Claude 独立确认：

1. 本文是否准确区分了“task-read 可解决的 readback 缺口”与“必须 owner 持久化/command 才能解决的
   写入缺口”；
2. 方案 A 是否在 R5 已接受范围内，且不会改变 104/32/22/25/7 分母和冻结 HTTP/错误码边界；
3. additive correction 的最小字段/约束是否遗漏了会使 alias/remark/legal profile/extension revision
   再次失真的必要项；
4. `externalCode/legalExternalCode` 的 `NOT_COLLECTED_R5` 处理是否诚实，或应升级为 contract 裁决；
5. 是否应接受建议裁决，或给出更小且不丢业务事实的替代方案。

## 需阅读文件

- `doc/review/platform/2026-07-26-v2s-r5-business-entity-persistence-conflict-decision-analysis.md`：本分析与裁决选项；
- `doc/review/platform/2026-07-26-v2s-r5-structure-and-enforcement-execution-directive-claude.md`：当前受限执行边界；
- `contracts/openapi/components/organization/business-entity.schemas.yaml`：冻结 wire 字段；
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql`：当前 owner schema；
- `libraries/backend/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java`：当前 command/readback；
- `doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md`：R5 范围与 additive Flyway 规则；
- `contracts/policy/frontend-asset-carryover-manifest.json`：该页面的 `ADAPT` 与 focused evidence；
- `../catering-all-v2/apps/backend/organization-service/src/main/resources/db/migration/V4__business_entity_management.sql`：只读 Heritage 字段承载对照；
- `../catering-all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx`：只读 Heritage 用户任务对照。

## 独立核验重点

- 重新打开冻结 OpenAPI、当前 migration 与 `BusinessEntityService`，确认 alias、remark、legal profile、
  entity-level extension rule revision 的写入/读回缺口确实不能仅靠 edge mapper 或 task-read 解决；
- 对照 Heritage migration 和 operations 页面，确认这些字段属于 R5 已批准的用户任务，而不是被误搬运的
  历史冗余；
- 检查方案 A 的 migration 仅是新增 additive correction、不会改写已有 migration bytes，并验证其不改变
  104/32/22/25/7 分母、HTTP path、operationId、error code 或事务语义；
- 尝试构造更小的替代：若能同时保留用户输入、owner CAS/readback 与 owner sovereignty，应明确列出；否则
  说明其为什么不能成立；
- 检查 `externalCode/legalExternalCode` 的 `NOT_COLLECTED_R5` 注记不会把未实现的 external-sync/source
  能力误报为已交付。

## 期望结论

请给出 `GO` 或 `NO-GO`，并以 `M` / `S` / `N` 标注精确路径与行号、影响面、最小修复和是否需要
Dexter 裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 R5 业务实体冻结契约与 owner 持久化冲突的决策分析。

背景：R5 Phase B 的 generated-wire/controller 收敛发现，已冻结且 all-v2 已实现的品牌别名、三类备注、经营租户/总公司 legal profile 与 extension rule revision，当前 v2s organization schema 和 owner command/readback 无法完整保存或读回。现行执行指令又写有“不改 owner API/migration bytes”，因此不能通过 mapper、null 或 extensionValues 伪造合规。
目标：请独立判断本文建议的“新增 additive correction migration + owner command/readback/task-read 补齐”是否是保持既有 R5 范围的最小正确路径，并核验 external-code 残留的诚实处置。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-07-26-v2s-r5-business-entity-persistence-conflict-decision-analysis.md：事实链、选项与建议裁决；
- doc/review/platform/2026-07-26-v2s-r5-structure-and-enforcement-execution-directive-claude.md：当前执行边界；
- contracts/openapi/components/organization/business-entity.schemas.yaml：冻结字段；
- apps/backend/catering-business-server/src/main/resources/db/migration/V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql：当前 owner schema；
- libraries/backend/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java：当前 owner command/readback；
- doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md：R5 范围和 additive Flyway 规则；
- contracts/policy/frontend-asset-carryover-manifest.json：业务实体页面的 ADAPT/focused evidence；
- ../catering-all-v2/apps/backend/organization-service/src/main/resources/db/migration/V4__business_entity_management.sql：只读 Heritage 持久化对照；
- ../catering-all-v2/apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx：只读 Heritage 用户任务对照。

请重点独立核验：①读模型补齐是否足以解决，还是 command/persistence 必须演进；②建议 migration 是否严格 additive、是否保持 104/32/22/25/7 分母和 HTTP/error-code 不变；③字段/约束最小集；④ externalCode/legalExternalCode 的 NOT_COLLECTED_R5 是否诚实；⑤是否存在更小且不丢业务事实的替代。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本次仅请求对 R5 correction pack 的决策分析作结论；不授权实施、DEV、seed/reset、动态运行或任何新的业务范围。即使 GO，也仅供 Dexter 决定是否解除“additive migration/owner API”这一受限边界；R5 仍只在全范围完成后进行唯一 implementation review。谢谢。
```
