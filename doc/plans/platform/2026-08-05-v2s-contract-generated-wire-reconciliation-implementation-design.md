---
title: v2s 契约—生成线同源 reconciliation implementation-facing 详设
status: ACCEPTED_FOR_IMPLEMENTATION
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: true
runtimeAuthority: false
seedResetAuthority: false
reviewTarget: IMPLEMENTATION
reviewCycleId: WHOLE-ENGINEERING-CONTRACT-GENERATED-WIRE-20260805
reviewRoundLimit: 2
---

SKILL_USED=cs-spec-to-plan@bd813d97c343571fdf22f88fe6573a7deb7ac5fd7ec73ea11b4957a270a5f7b9

# 1. 用户任务与根因

业务任务是让已接受的 U27 operations session/context、owner-derived project scope 和
workspace invitation CAS 契约在 source catalog、materialized OpenAPI、generated wire、owner
consumer 与受管 diagnostic workload 之间只有一个真相。当前 materializer 从 Heritage 直接
重生了三类已被 v2s/U27 取代的形状：store/contract create body 重新出现 `projectId`、
invitation action 丢失 `expectedContextVersion`、session entry 从 owner-confirmed
`scopeContext` 漂移到 `selectedDataNode`。因此静态 materializer 与已接受的 backend/frontend
consumer 不再可重放；前一 RP-02a package 的 payload 修复无法在这条漂移线上闭合。

Claude post-NO-GO 复核又发现同名 `requiredDataNodeType` 的第三个 contract site：
`WorkspaceRolePage.pageAccessCatalog` 的枚举没有覆盖 owner 实际发出的 `HEAD_COMPANY`。
该漏点属于同一生成线对账根因，现通过既有 `enumAdditions` 机制补齐，并将同名 property 的
全部 schema 出现点提升为独立分母；不新建第二套枚举或 runtime 过滤。

证据入口：

- 原始 remediation：`doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-independent-review-round2.md`
- U27 已接受语义：`doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-implementation-amendment.md`
- U27 package exit：`doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-package-exit.json`
- owner consumer：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/access/OperationsWorkspaceInvitationController.java`
  与 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/session/WorkspaceSessionWireMapper.java`

# 2. Dexter stage / cost intent 与方案

Dexter 的当前意图是快速完成阻塞 RP-02a 的大包，但不牺牲生成线可重放性；本包只做静态
契约/生成线 reconciliation，保持分钟级 checker，不启动 runtime、HTTP、L2、DEV、seed 或
reset。

采用最小根修复：把 U27 的 v2s 语义写成 catalog 的显式 component override，并让
materializer 支持组件级 forbidden-property 例外；然后以同一 source 重新生成四个受影响
OpenAPI component 文件，恢复 invitation action workload 的 context version。这样不手写
generated wire、不迁移 owner 逻辑、不把 Heritage 的旧模型重新带回运行时。

拒绝的替代：

1. 继续允许手改四个 generated YAML：会保留 source/materialized 双真相；
2. 全局删除 `expectedContextVersion` 或全局删除 `projectId`：会破坏 query/context 反例及
   invitation owner CAS；
3. 迁移 backend/frontend 到 Heritage `selectedDataNode`：会反转 Dexter 已接受的 U27
   `scopeContext` 设计，成本和风险远大于本次阻塞。

# 3. 原子 implementation unit 与精确分母

`WHOLE-ENGINEERING-CONTRACT-GENERATED-WIRE-20260805` 是一个原子 unit；catalog、materializer、
OpenAPI output、generated output readback 和 workload/test 一次完成，不能拆成单文件 GO。

七类 package-exit source denominator：

| 类别 | owning source | 有限集合与完成谓词 |
|---|---|---|
| CONTRACT_SOURCE | `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` | component overrides 明确表达 projectId removal、scopeContext shape、invitation action exception；Heritage hashes 仍先校验 |
| ENUM_PROPERTY_SURFACE | `r5-edge-materialize` + `edge-codegen` | 对 `requiredDataNodeType` 同名 property 的全部 schema 出现点一次性枚举；每个 contract/generated 出现点必须包含 owner catalog 实际可发出的 `HEAD_COMPANY` |
| MATERIALIZER_CONTROL | `scripts/generate/r5-edge-materialize.mjs`、`scripts/check/r5-edge-materialize` | 组件级 forbidden set 与全 output-set/bytes comparator；self-test 有真实 exception/drift red mutation |
| OPENAPI_OUTPUT | `contracts/openapi/components/contract/contract.schemas.json`、`organization/store.schemas.json`、`workspace-iam/workspace-access.schemas.json`、`workspace-iam/workspace-session.schemas.json`、`doc/evidence/platform/r5-u01-edge-placement-resolution.json` | materializer 生成 output 与工作区 bytes exact equality；store/contract 无 body projectId，action 四字段契约稳定，session 与 role page 的 `requiredDataNodeType` 均可表达 owner 发出的 `HEAD_COMPANY` |
| GENERATED_WIRE | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/`、`apps/frontend/*/src/app/api/generated/` | `edge-codegen --check` 的完整 output set/bytes 与 OpenAPI 同源；不得手写 generated file；platform/operations `WorkspaceRolePage` enum 与 contract 一致 |
| CONSUMER_PAYLOAD | `scripts/test/http-diagnostic-workload.mjs`、`scripts/test/http-diagnostic-workload.test.mjs` | 四个 create body 无 projectId；invitation action 的 `scopeRef`、`expectedContextVersion`、`expectedVersion`、`idempotencyKey` 与 owner 消费点稳定；其余 query/context allowlist 不扩大 |
| EVIDENCE_CONTROL | 本包 manifest、package input、focused proof、problem family、独立 review、Claude brief、package exit | 每个 finding 有 source/反例/disposition；静态 business/cleanup 明确 NOT_APPLICABLE_WITH_REASON；changed-path set equality |

# 4. owner、失败行为与事务边界

这是静态 artifact pipeline，没有数据库 owner transaction；owner truth 仍由 workspace-iam、
organization、store-contract 的现有 controller/service 决定。materializer 在 Heritage hash、
component ref、output path/set/bytes 任一漂移时 fail closed；generator 在 OpenAPI schema 与
generated wire 不一致时 fail closed；workload test 对每一个允许/禁止字段进行边界断言。

不创建新的通用 validator、MQ、outbox、runtime adapter 或 frontend wrapper。generated output
只由 `edge-codegen` 产生，catalog 是唯一 source index，U27 decisions 是语义依据。

# 5. 实施顺序与 red mutation

1. 写入 component override/source schema（projectId removal、scopeContext/ScopeNode/ScopeContext、
   `WorkspaceRolePage.requiredDataNodeType` 的 `HEAD_COMPANY`、invitation action 四字段），并补 materializer 组件级 forbidden predicate。
2. 用 materializer 预期 output 对账四个 YAML；若只恢复 bytes 而 source replay 不一致，立即失败。
3. 运行 `edge-codegen --check`；若 generated Java/TS 与 current OpenAPI 漂移，先修 source，禁止
   直接编辑 generated 文件。
4. 恢复 invitation action workload 的 context version，并以 owner 消费点对账
   `scopeRef`、`expectedContextVersion`、`expectedVersion`、`idempotencyKey` 四字段；把测试从
   global forbidden grep 收紧为 component-aware finite boundary；保留 projectId query/state 反例。
5. 运行 standards/materializer/codegen/focused static suite、JSON/syntax，并保存日志与 hash。

真实 red mutation 必须至少覆盖：删除 scopeContext override、删除 invitation exception、删除
   `WorkspaceRolePage` 的 `HEAD_COMPANY` enum addition、在任一 generated component 追加一字节、
   在 action workload 删除任一必需 context/action 字段、在 create body 重新加入 projectId；每种
   mutation 都必须被对应门拒绝且 scratch cleanup PASS。

# 6. 禁止推断与退出

本包不宣称业务 PASS、cleanup PASS 或真实登录；二者均为
`NOT_APPLICABLE_WITH_REASON: static contract/generated-wire reconciliation; no managed process started`。
不修改 Roadmap、数据库、backend owner/frontend business source、DEV/UAT、seed/reset 或 Git。
实施完成后必须先 fresh independent `REVIEW_TARGET=IMPLEMENTATION`（最多两轮），再形成 Codex
intake 和 Claude copyable brief；没有两份复核不得 package exit。
