---
title: R5 契约↔owner 持久化冲突 Claude 决策(代 Dexter 裁定)
type: review
subtype: decision
status: DELIVERED_AS_DECISION
reviewer: Claude
decisionBasis: Dexter 2026-07-26「你替我做所有决策，要求是最优最长期的方案」
createdAt: 2026-07-26
reviewTarget: doc/review/platform/2026-07-26-v2s-r5-business-entity-persistence-conflict-decision-analysis.md
amendsDirective: doc/review/platform/2026-07-26-v2s-r5-structure-and-enforcement-execution-directive-claude.md
authorizationBoundary: 在既有 R5_IMPLEMENTATION_AUTHORIZED=true 内；不授权 DEV/seed/reset/动态运行；不扩大 R5 业务范围
---

# R5 契约↔owner 持久化冲突:决策

## 0. 结论

```text
VERDICT=GO（方案 A 成立，但必须按下列扩围与更正执行）
M=2  S=3  N=3
```

**方案 A 的诊断正确、证据扎实、是最小正确路径,我批准。** 但分析**只覆盖了 5 个受影响实体中的 3 个**,若按原范围授权,Phase B 会在门店与合同上再撞两次同一堵墙。同时 `externalCode/legalExternalCode` 的 `NOT_COLLECTED_R5` 处置我**不采纳**——我改判为从契约中删除,理由见 M-2。

## 1. 亲验记录(本体独立重算,未采信分析自报)

1. **写入缺口确实无法靠读模型解决**(交办①):`BusinessEntityService.java:36,53` 的 `createEntity`/`updateEntity` 签名只有 `code/name/legalName/creditCode/expectedDefinitionVersion/extensionValues`;全文件 `alias|remark` **命中 0 次**。`requireEntity`(`:156-159`)的 SELECT 只取 `id, workspace_uuid, group_workspace_key, code, name, <fields>, status, version`——无 timestamps、无 extension values、无 extension rule revision。**command 不接收的字段,任何 task-read 都读不回来**。分析的这条区分准确。
2. **这些字段是真实用户任务,不是历史冗余**:Heritage `V4__business_entity_management.sql:6,7,26,27,28,38,39,42` 确有 `alias`、`remark`、`legal_name NOT NULL`、`unified_social_credit_code NOT NULL` + 非空白 CHECK + `UNIQUE(workspace_key, unified_social_credit_code)`;Heritage UI `BusinessEntityManagementPage.tsx:398,402,406` 逐行提交 `alias/remark/legalName/unifiedSocialCreditCode/expectedExtensionRuleRevision`。**extension rule revision 是 UI 真实提交的 command 输入**,这一条本身就否掉了"从 extension value 行推导"的替代。
3. **冻结契约的硬约束**:`Brand` required 含 `extensionValues/extensionRuleRevision/createdAt/updatedAt`;`HeadCompany`/`Tenant` required 含 `legalName(minLength 1)`、`unifiedSocialCreditCode(minLength 1, maxLength 32)`。而当前表 `legal_name VARCHAR(240)` 可空、`credit_code VARCHAR(64)` 可空——**契约 required 与库可空直接冲突**,不是可空字段静默不支持的情形。
4. **我构造并否决的更小替代**(交办⑤):从 `*_extension_value.definition_version` 取 `max()` 推导 `extensionRuleRevision`。**否决**:实体若无任何扩展值行则无 row 可取,填 0 是谎(定义可能已在 revision 5),填当前 definition version 也是谎(那不是"写入时校验against 的 revision")。而 Heritage UI 证明它是 command 输入。**必须落列。** 除此之外我未能构造出任何"既保留用户输入、又保留 owner CAS/readback、又不新增列"的方案;方案 A 是最小的。
5. **分母未动**(交办②):新增列/约束不触碰 104 operation、32 scenario、22 surface、25 pageDesignKey、7 owner schema、HTTP path、operationId、error code、事务边界。我复算确认 7 个 owner schema 不变(新增列不新增 schema)。严格 additive(只 `ALTER TABLE ADD COLUMN` 与新增约束,不改已执行 migration 字节),符合 D-11 的 expand→backfill→switch。

## 2. Findings

### M-1 范围不足:漏了门店与合同,同类缺口共 5 个实体而非 3 个

- **证据**(我做了全量七 owner 契约↔表对账,非抽样):
  - `contracts/openapi/components/organization/store.schemas.yaml` 的 `OrganizationStore` **required 含 `extensionRuleRevision`**、properties 含 `notes`(nullable, maxLength 2000);而 `organization.store` 表(migration `V20260726_090000_000`)**既无 `extension_rule_revision` 也无 `notes`**。
  - `contracts/openapi/components/contract/contract.schemas.yaml` 的 `StoreContract` **required 含 `extensionRuleRevision`**;而 `contract.store_contract` 表**无 `extension_rule_revision`**。(该表已有 `notes` 列,承接契约的 `note`,不是缺口。)
- **影响面**:门店与合同同属 Phase B 的 generated-wire 收敛范围。按分析原范围授权,Codex 完成业务实体后会在门店、合同上撞同一堵墙,需要第三、第四次裁决——直接违背 Dexter「一次做到位」。
- **最小修复**:correction pack 范围扩为**五个实体**:`brand`、`tenant`、`head_company`、`store`、`store_contract`,一次性补齐 `extension_rule_revision`(五张表)与 `notes`(store)。
- 需 Dexter 裁决:**否**(同类缺口的机械扩围,不扩业务范围)。

### M-2 `externalCode/legalExternalCode` 我改判为**从契约删除**,不接受 `NOT_COLLECTED_R5`

- **分析的处置**(§方案 A 第 5 点):response 中如实为 `null`,并在 mapping contract 标 `NOT_COLLECTED_R5`,是否删除交 Dexter。
- **我的裁定:删除。** 理由三条:
  1. **这是同一族清理漏成员的复发。** 上一轮已裁定把 `source`/`BusinessEntitySource(EXTERNAL_SYNC)` 从 Brand/Tenant/HeadCompany 删除,理由是 v2s 无外部同步。`externalCode`/`legalExternalCode` 是**同族外部系统标识**,只有在外部同步存在时才有意义。清了 `source` 却留下 `externalCode`,与上一轮的裁定不自洽。
  2. **未来设计也不会填它。** v6 域 16(外部协作与防腐)的形态是 raw/normalized/mapping 表承载外部标识映射,**不是在 owner 实体上挂 per-entity externalCode 列**。所以这两个字段不仅现在是 null,按已冻结的 v6 演进路径**永远不会被填**。
  3. **早期删除最便宜。** 一个永久为 null 的冻结契约字段,会让此后每一个消费者、每一次评审都要重新问一遍"它是没实现还是不该有"。现在删是改几行 schema;将来删要动前端、generated wire、evidence 与已发布契约。
- **保留的边界**:删除**不得**顺势恢复 external-sync/source 语义,也不得新建外部标识表。若将来 v6 域 16 进入范围,由那时的设计按 mapping 表形态引入。
- **影响面**:改变 `componentFieldBaseline` 的字段集(140 component 的字段内容),**不改变** 104/32/22/25/7 任何分母。与上一轮删除 `source` 属同一类契约更正。
- 需 Dexter 裁决:**已由我代裁**(Dexter 授权)。若你不同意删除,回退到分析原方案的 `NOT_COLLECTED_R5` 亦可运行,只是把这笔债留到未来。

### S-1 冻结契约自身有重复 required 条目,须一并更正

- `contracts/openapi/components/contract/contract.schemas.yaml`:`StoreContract.required` 含**重复的 `effectiveFrom`**;`StoreContractCreateRequest.required` 同样重复 `effectiveFrom`;`StoreContractUpdateRequest.required` 重复 `expectedVersion` 与 `effectiveFrom`。
- 影响面:多数 JSON Schema 校验器容忍重复,但 codegen 与"契约是唯一真相"的分母对账会因此产生不确定行为。
- 最小修复:去重(纯字节更正,不改语义)。

### S-2 收紧 legal profile 必须走 typed precondition,不能靠原生约束报错

- 分析 §方案 A 第 2 点要求"既有无效/重复数据必须使 migration typed-fail"——方向对,但没说清失败形态。直接 `ALTER TABLE ... SET NOT NULL` 在存在 NULL 行时抛的是 Postgres 原生错误,不可诊断、不指明哪些行、也不符合 D-11 的 expand→backfill→switch 纪律。
- 最小修复:收紧前先跑显式 precondition 查询(NULL/空白/超长/重复各一条),命中即以具名错误停止并列出违规行标识;precondition 全绿后才执行 `SET NOT NULL` + CHECK + UNIQUE。当前 DEV 尚未 seed、预期零行,但形态必须对,否则将来带数据升级时这条 migration 不可用。
- 附:`credit_code` 由 `VARCHAR(64)` 收窄到契约的 32 是**窄化**,同样受此 precondition 约束。`legal_name VARCHAR(240)` 对契约 maxLength 200 是宽松侧,可保留不动(宽于契约不产生失真),但 CHECK 非空白必须加。

### S-3 我自己的执行指令措辞过紧,由我更正(不是 Codex 的问题)

- 我在执行指令 §3 红线 2 写的是"owner API、migration 字节**不改**"。**本意**是防止结构重构顺手改变行为;**实际**被正确地读成了阻断一个合法的完备性修复。这是我的措辞缺陷。
- **更正后的红线 2**(即刻生效,替换原文):
  > HTTP path、operationId、error code、事务语义**不改**;**已执行 migration 的字节不得改写**。owner API 与数据形状仅允许在"精确执行已冻结契约"所需范围内**新增式演进**(additive migration + command/readback 补齐),不得借此扩大业务范围、恢复已裁退语义或改变上述分母。
- 影响面:解除 correction pack 的阻塞,同时保留原意图的全部约束。

### N(3 项)

| # | 一句话 |
| --- | --- |
| N-1 | **`StoreContract.source` 不是缺口,不要为它加列**:它是 `enum: ["MANUAL"]` 单值常量,按字面量发出即可。我在全量扫描中一度把它列为缺列,复核后排除——特此写明,避免 Codex 误加一个无意义的列 |
| N-2 | 命名不一致:`OrganizationStore` 用 `notes`,`StoreContract` 用 `note`(列名 `notes`)。不改契约字段名(会动 wire),但 mapping contract 里要显式登记这组对应,避免 codegen 两侧各猜一次 |
| N-3 | `organization.project_phase_name`、`workspace_iam.role_capability`、`workspace_iam.role_page_access` 均已存在,`OrganizationNode.phases` 与角色 capability/pageAccess **不是**缺口(我的初次粗扫误报,已排除)。correction pack 不要动它们 |

## 3. 最终裁定(代 Dexter)

**接受方案 A,按下列范围执行,不需要再回头请示:**

1. 新增**一条**能力命名、严格递增的 additive Flyway migration(不改写任何已执行 migration 字节),内容:
   - `organization.brand`:`alias VARCHAR(120)`、`remark VARCHAR(2000)`、`extension_rule_revision BIGINT NOT NULL DEFAULT 0`;
   - `organization.tenant`、`organization.head_company`:`remark VARCHAR(2000)`、`extension_rule_revision BIGINT NOT NULL DEFAULT 0`;并按 S-2 的 precondition 收紧 `legal_name`(NOT NULL + 非空白 CHECK)、`credit_code`(NOT NULL + 非空白 CHECK + 长度 ≤32 + `UNIQUE(workspace_uuid, group_workspace_key, credit_code)`,tenant 与 head_company **各自**唯一,不跨表);
   - **`organization.store`:`notes VARCHAR(2000)`、`extension_rule_revision BIGINT NOT NULL DEFAULT 0`**;
   - **`contract.store_contract`:`extension_rule_revision BIGINT NOT NULL DEFAULT 0`**。
2. 相应 owner command 以不可变 command DTO 接收 alias/remark/notes/legal profile/expected extension revision,与 owner 表和 extension values 在**同一 `REQUIRED` 事务**内写入,并以 owner readback 返回;task-read assembler 提供完整 page/detail 投影(timestamps、extension values、head-company authorized brands 均由 owner 读取);edge 只做显式 owner-readback → generated wire 映射,**不得 edge SQL**。
3. 契约更正:删除 Brand/Tenant/HeadCompany 的 `externalCode` 与 `legalExternalCode`(M-2);去重三处 `required`(S-1)。
4. **不得**:改写已执行 migration 字节;恢复 external-sync/source 语义;新建外部标识表;把固定主数据塞进 `extensionValues` 或 audit;改变 104/32/22/25/7 分母、HTTP path、operationId、error code、事务语义。
5. correction pack 完成后**继续 Phase B**,不单独送审;连同 R5 全范围实现一次性交唯一 whole-scope implementation review。

**需 Dexter 另行裁决的:无。** 唯一可选回退点是 M-2(若你更倾向保留 `externalCode` 为 `NOT_COLLECTED_R5`,告知即可,不影响其余)。

## 4. 授权边界

本决定在既有 `R5_IMPLEMENTATION_AUTHORIZED=true` 内执行,并即刻更正执行指令红线 2(S-3)。不授权 DEV、seed/reset、动态运行,不扩大 R5 业务范围,不新建 review cycle。R5 仍只在全范围完成后由唯一一次 whole-scope implementation review 验收。
