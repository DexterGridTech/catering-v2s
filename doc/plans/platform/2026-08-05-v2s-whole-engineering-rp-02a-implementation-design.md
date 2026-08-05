---
title: 全工程修复 RP-02a implementation-facing 详设：同源契约消费者恢复
status: PROPOSED_REVIEW_ONLY
programId: V2S_W0_W4_EXECUTION
goalId: WHOLE_ENGINEERING_REMEDIATION_20260805
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
reviewCycleId: WHOLE-ENGINEERING-RP-02A-DESIGN-20260805
reviewRoundLimit: 2
---

SKILL_USED=cs-spec-to-plan@bd813d97c343571fdf22f88fe6573a7deb7ac5fd7ec73ea11b4957a270a5f7b9
SKILL_USED=cs-writing-plans@985b7fe1496e1113493d631cc74598599f57871930b7eeac87ffd9ac5254077a

BUSINESS_REQUIREMENT_SOURCE=doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md#1.2
BUSINESS_PROBLEM=契约从 147 演进到 generated registry 154 后，手写 facts 仍只有 144、测试仍断言 147、catalog 仍以 generic operation 形状记录 121，且 store/contract runner 继续发送 owner schema 已删除的 projectId；诊断因此在首请求前失败或被 strict parser 拒绝。
BUSINESS_USER_OR_OWNER=platform-admin、operations-admin 与 public task 的 edge contract/owner，以及维护受管诊断消费者的工程 owner。
CURRENT_TASK=一次性恢复 RP-02a-U01 的 facts、catalog/placement 对账、请求 payload、RM1 assertions 与 operations recovery 顺序；不实现 D4 validator 或动态运行。
SUCCESS_OUTCOME=154 个 generated route-face tuple 与 154 个具体 catalog operation、154 个 placement row 和 154 个 source-backed fact/disposition 对齐；store/contract create body 没有 projectId、允许 query/read context 仍保留；recovery 顺序精确为 start/send/verify/complete；每个同根回归都有真实静态 red proof。

# 1. 决策与有限范围

RP-02a 是一个原子实现单元，不按 face、文件或单项 gate 拆交付。它修复的是契约演进后
下游未跟随的同一根因，采用 R5 既有业务任务，不新增 UI Journey。Journey 绑定为
`doc/decisions/2026-08-05-v2s-rp-02a-contract-consumer-recovery.md#1.-这不是一个新产品-journey`。

## 1.1 采用方案与替代方案

1. **facts 保持手写**：registry 只做 exact coverage denominator；为 10 个缺失 operation
   逐条重开 owner source，写入 task/sourceRefs/ownerReadback/prerequisite/oracle，不能从
   operationId、method、route 或 face 生成事实。
2. **catalog 以 generator projection 的 materialized 结果为 source truth**：先用当前
   projectEdgeCatalog 的 R24/P3C 投影得到 154 个具体 operation，再把该结果 materialize
   回 source catalog；source catalog、placement/report、root contract-face gate 与 generated
   output 共用同一具体记录集合。投影模块增加显式 MATERIALIZED 状态与幂等 readback，不能
   对已 materialized 的 154 条记录再次展开。R24 的 add/remove error augmentations、
   retired component baseline 删除、P3C 的 query/component narrowing 必须随 materialized
   catalog 一起保留；121 + 42 - 9 = 154 只作为迁移算术，不是第二份 runtime truth。
3. **payload 只修 request body**：从 operations store/contract create body 删除 `projectId`；
   `projectId` 在 workspace/query/read context 中保留，因为项目范围的真相来自 session/context
   和允许的候选查询，而不是 create body。
4. **recovery 以 owner source 为准**：`executeOperationsRecoveryWorkload` 仅四个实际 recovery
   operation；邻近的 `executePublicInvitationWorkload` 七步不变。

更小但被拒绝的替代是只把 `147` 改成 `154`、只改 catalog denominator 或全局删除
`projectId`；它们无法闭合具体 operation 映射、语义 facts 或 read/query scope 反例。
D4 validator 是更强的长期防复发方案，但它依赖 Dexter 的 D4 选择，故留给 RP-02b，不阻塞本单元。

## 1.2 明确不做

- 不改 `contracts/openapi`、generated wire、backend controller/service、数据库、migration 或 owner transaction。
- 不运行 DEV、HTTP diagnostic、browser L2、remote Testcontainers、reset、seed 或 UAT。
- 不实现 runtime request validator、常驻日志、frontend 行为或 UI interaction。
- 不把静态 fact/payload/test PASS 描述为 business 或 cleanup PASS。

# 2. 现状与 source-owned 分母

| 分母 | 当前事实 | owning source | 变更后目标 |
| --- | --- | --- | --- |
| generated route-face | 154 = platform 50 / operations 92 / public 12 | `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json` | 不变，继续作为强制覆盖分母 |
| placement | 154 unique rows | `doc/evidence/platform/r5-u01-edge-placement-resolution.json` | 154 与 registry tuple exact equality |
| catalog | source catalog 121 records = 50 / 59 / 12，generator projection produces 154 = 50 / 92 / 12 | `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` + `scripts/generate/edge-operation-projections.mjs` | materialized source and projection readback both 154 concrete records = 50 / 92 / 12 |
| scenario facts | 144 unique operation IDs / 84 groups | `scripts/test/http-diagnostic-scenarios.mjs` | 154 unique IDs；10 新 facts |
| RM1 assertions | hard-coded declared 147 / unexecuted 146/130 | `scripts/test/rm1-http-diagnostic.test.mjs` | derive from loaded registry/scenarios；不再固定历史数字 |
| create payloads | 4 occurrences of obsolete body `projectId` (diagnostic store/contract + fixture store/contract) | `scripts/test/http-diagnostic-workload.mjs`、`scripts/test/r5-platform-admin-l2-fixture-seed.mjs` | 0 occurrences in those four create bodies；finite query/read allowlist retained |
| recovery | test expects 7, implementation executes 4 | `scripts/test/http-diagnostic-workload.mjs`、`.test.mjs` | exact ordered four: start/send/verify/complete |

## 2.1 Catalog/placement/projection crosswalk rule

`doc/evidence/platform/2026-08-05-v2s-whole-engineering-rp-02a-catalog-crosswalk.json` records
the before/after sets and every replacement. It is evidence, not a second runtime truth. Each of
the 154 post-change rows must carry operationId, method, path, face, owner, path/query parameter
metadata, request/response schema, success status, idempotency, errorSetRef, operation error
augmentation/selection rule, scenarioIds, focused test/proof refs, source path and source anchor.
The artifact also contains explicit 42 registry-only rows and 9 generic catalog-only replacement
rows, plus exact equality predicates for registry, placement, materialized catalog, projected report
and source-backed facts. Generic records are not retained as aliases: an alias would keep a stale
operationId alive and make catalog denominator appear closed while consumers use different endpoints.

The source catalog has projectionState=MATERIALIZED after the implementation. The only accepted
projection transition is generic source -> projectEdgeCatalog -> materialized source; a subsequent
projectEdgeCatalog call must be an identity projection and must preserve error augmentations,
componentFieldBaseline/componentOverrides and concrete query parameters. edge-codegen --check and
r5-edge-materialize --check are mandatory static proofs of this identity.

## 2.2 Ten missing fact dispositions

The following facts must be written explicitly after source reread; no route inference is allowed:

| operationId | task/source owner to reopen | required disposition |
| --- | --- | --- |
| `cancelWorkspaceInvitation` | `PlatformWorkspaceInvitationController.cancel` → `WorkspaceInvitationService.cancel` | command returns owner invitation readback with expectedVersion/idempotency |
| `createWorkspaceInvitation` | `PlatformWorkspaceInvitationController.create` → `WorkspaceInvitationService.create` | invitation command creates owner assignment intent; no account direct write |
| `getWorkspaceInvitation` | `PlatformWorkspaceInvitationController.detail` → `WorkspaceInvitationService.managementInvitation` | platform invitation detail readback |
| `getWorkspaceInvitationCandidates` | `PlatformWorkspaceInvitationController.candidates` → `WorkspaceUserService.candidates` | candidate page is owner task read, not frontend filtering |
| `getWorkspaceInvitations` | `PlatformWorkspaceInvitationController.list` → `WorkspaceInvitationService.managementPage` | paged management readback |
| `reissueWorkspaceInvitation` | `PlatformWorkspaceInvitationController.reissue` → `WorkspaceInvitationService.reissue` | owner lifecycle reissue with CAS/idempotency |
| `getPlatformOrganizationCandidates` | `PlatformOrganizationOverviewController.candidatePage` → `StoreCandidateTaskReadService.candidatePage` | platform contract candidate read with selected project context |
| `getOperationsOrganizationCandidates` | `OperationsOrganizationCandidateController.candidatePage` → `StoreCandidateTaskReadService.candidatePage` | operations candidate read with session project scope |
| `getOperationsOrganizationHierarchyExtensionDefinition` | `OperationsOrganizationExtensionController.hierarchyDefinition` → `ExtensionDefinitionService` | extension definition read keyed by host/revision |
| `updateOperationsCommercialGroup` | `OperationsOrganizationHierarchyController.updateCommercialGroup` → `OrganizationCommandService.execute` | owner command readback with expectedVersion and authorization grant |

Each fact will use at least two real sourceRefs, an owner readback, explicit prerequisite handles and
an oracle; a source-backed `DISPOSITION` is allowed only when the operation is not actually executable
by the approved task and names the replacement/owner evidence. These ten are executable and therefore
must be facts, not blanket N/A.

The hierarchy extension fact is an explicit correction to the original owner shorthand:
getOperationsOrganizationHierarchyExtensionDefinition is owned by
OperationsOrganizationExtensionController.hierarchyDefinition, which delegates to
ExtensionDefinitionService and enforces the COMMERCIAL_GROUP/REGION/PROJECT host-type allowlist.
OperationsOrganizationHierarchyController is not an owner source for this route.

## 2.3 projectId finite proof denominator

The forbidden set is exactly four request-body occurrences, each named by source path and operation:

| id | source | operation | forbidden field |
| --- | --- | --- | --- |
| BODY-01 | scripts/test/http-diagnostic-workload.mjs:415-418 | createOperationsOrganizationStore | body.projectId |
| BODY-02 | scripts/test/http-diagnostic-workload.mjs:439-442 | createOperationsContract | body.projectId |
| BODY-03 | scripts/test/r5-platform-admin-l2-fixture-seed.mjs:133 | createOperationsOrganizationStore | body.projectId |
| BODY-04 | scripts/test/r5-platform-admin-l2-fixture-seed.mjs:134 | createOperationsContract | body.projectId |

The positive allowlist is finite and must be asserted against operation metadata, not inferred by a
broad grep. The current workload must stop sending `projectId` to the five operations whose OpenAPI
query contracts do not declare it: `getOperationsOrganizationStoreCandidates`,
`getOperationsContractExtensionDefinition`, `getOperationsContractCandidates`,
`getOperationsContracts` and `getOperationsOrganizationStores`; these calls retain only
`expectedContextVersion` plus their operation-specific query fields. The only current workload
outbound query call that carries `projectId` is `getPlatformOrganizationOverviewPage` at
`scripts/test/http-diagnostic-workload.mjs:493`. At the contract level, the finite declared query
allowlist is `getOperationsOrganizationCandidates` (operations store-management path),
`getPlatformOrganizationCandidates` (platform contract-overview path) and
`getPlatformOrganizationOverviewPage` (platform organization-overview path); the two platform
candidate/overview operations are not invoked by this workload, but remain contract-valid query
surfaces. A declared allowance does not authorize adding the field to an unrelated workload call.
`PROJECT_SCOPE` and
`SCOPED_STORE_FACTS` retain project identity as in-memory scope state. The focused proof compares
the exact forbidden four body sites, the five forbidden outbound query call sites, the one current
outbound query call site, the three contract-declared query operation IDs, and the state allowlist; it
does not delete or accept any other `projectId` occurrence.

# 3. Ordered implementation chain

1. Load generated registry, placement and existing source catalog; compute exact registry/source
   projection/fact sets. Record the 42 registry-only and 9 catalog-only operation IDs in the
   crosswalk evidence.
2. Materialize projectEdgeCatalog output into source catalog with projectionState=MATERIALIZED;
   migrate R24 error/component metadata and P3C query/component metadata; update projection to be
   identity on an already materialized catalog; verify all concrete records preserve OpenAPI
   method/path, owner, request/response and error metadata.
3. Add the ten hand-written scenario facts and run `declareSourceBoundDiagnosticScenarios` exact set.
4. Change RM1 tests to derive declared/unexecuted counts from the loaded registry/scenario list,
   while retaining real red tests for missing/duplicate/source-less facts.
5. Remove the four enumerated obsolete create-body `projectId` fields and stop spreading
   `projectContext()` into the five operations whose query contracts reject that field; retain the
   platform overview query and in-memory scope state. Add negative static assertions for the four
   body sites and five unsupported query call sites, plus positive exact-set assertions for the one
   current outbound query, three contract-declared query operations and state allowlist.
6. Change recovery assertion to exact ordered four operation IDs; assert the invitation workload still
   has seven calls and is not accidentally collapsed.
7. Run focused static tests and source/hash/readback checks. Do not start runtime.

Serial boundary: catalog transformation and scenario fact changes are one shared semantic write path;
tests and evidence update only after those bytes are coherent. No parallel write to catalog/scenarios.

# 4. Evidence and red mutations

| Evidence | Expected proof | Real red mutation |
| --- | --- | --- |
| L1 source set | registry/placement/catalog/facts/tests/workload/owner source hashes captured | remove one source row or alter one hash; set equality fails |
| L2 static exact set | 154 route-face tuples, 154 catalog IDs, 154 facts, 50/92/12 faces | delete fact, duplicate fact, stale 147, catalog generic ID; focused tests fail |
| L2 projection metadata | materialized source catalog is identity under projectEdgeCatalog and retains R24/P3C error/component/query metadata | delete an add/remove augmentation, restore a generic query, or remove projectionState; edge-codegen/materialize check fails |
| L2 payload | four create bodies have no projectId; five unsupported workload query calls have no projectId; the one current overview query, three contract-declared query operations and in-memory scope state remain explicitly allowlisted | re-add a body field or spread projectContext into an unsupported call; exact boundary assertion fails |
| L2 recovery | exact ordered four recovery operations; invitation seven preserved | reorder/remove/add recovery call or change invitation count; test fails |
| L2 crosswalk | 154 semantic rows plus 42/9 replacement rows exact-match all source denominators | remove metadata field, alter owner/path/schema, or add alias; crosswalk equality fails |
| business | `NOT_APPLICABLE_WITH_REASON`: no HTTP/L2/owner business run in this package | later dynamic package must provide fresh business evidence |
| cleanup | `NOT_APPLICABLE_WITH_REASON`: no managed process/remote resource started | later dynamic package must provide cleanup evidence |

# 5. Generalized finding and prevention

- **Failure pattern**：contract/generated denominator evolves without forcing manual semantic consumers,
  request literals and historical assertions to reconcile.
- **Root cause**：registry codegen gate observes only OpenAPI→registry; facts/catalog/workloads/tests are
  separate handwritten surfaces with no exact crosswalk or body/query boundary red proof.
- **Applicable denominator**：only the RP-02a finite source set above; not every `.mjs` or every frontend
  request, and not RP-02b validator scope.
- **Counterexamples**：registry cannot supply business facts; `projectId` remains valid only in the
  explicitly declared organization-candidate/overview query contracts and in-memory scope state;
  the five operations-admin calls in this workload derive project scope from session context; invitation
  seven-step public flow is not operations recovery.
- **Minimum prevention**：keep exact-set fact/catalog/red-payload/recovery checks in the focused static
  suite; route future generated-validator work to RP-02b after D4. Do not add a generic route-to-fact
  generator or a broad projectId grep gate that ignores request context.

# 6. Exit conditions

RP-02a-U01 exits only when the implementation package has:

1. current source hashes and non-empty incremental pre/post receipts for every changed file;
2. exact equality for registry, placement, catalog and fact denominators;
3. focused red/green evidence for missing/duplicate/sourceRef, stale catalog, projectId body/query
   boundary and recovery order;
4. fresh independent `REVIEW_TARGET=IMPLEMENTATION` review plus author intake and Claude review;
5. business/cleanup explicitly `NOT_APPLICABLE_WITH_REASON` for this static package, with no runtime
   claim; and
6. package-exit set equality showing every actual changed file belongs to the authorized package.
