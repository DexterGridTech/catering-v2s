# R5 外部协作与经营渠道 implementation remediation 独立复核结论

## Review metadata

```text
REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_REMEDIATION_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=HONORED
```

本文件是 fresh、独立、证伪优先的 implementation review。未读取或采用作者 intake、Claude closeout review、上一 cycle 独立 verdict 作为结论依据；结论来自仓内入口、原始业务材料、当前源码、契约、生成物、UI 和测试的逐点核查。

## Verdict

**NO-GO**

```text
M=1
S=2
N=1
```

阻断原因是 M-1：operations-admin 的 store template candidate read route 没有把 URL 的 `storeRef` 与当前 session 的 selected store 做精确授权校验。同一 project 下的另一个 store 可以通过 pair validation，owner 查询随后返回 project 级 STORE candidate facts。其余关键分类与静态链路不能抵消该跨节点读越权。

## Input checklist

以下输入均从仓根 `/Users/dexter/Documents/workspace/idea/catering-v2s` 恢复并逐点读取：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`。
- `doc/platform/README.md`、`doc/platform/roadmap-program-registry.json`、`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` 的当前 R5 授权字段。
- `project-memory/index.md`、六个 kernel，以及 R5 六维 recall 命中的全部原文：
  - `project-memory/decisions/deterministic-context-only.md`
  - `project-memory/decisions/independent-subagent-adversarial-review.md`
  - `project-memory/decisions/confirmed-business-language-corpus.md`
  - `project-memory/practices/collection-boundary-modes.md`
  - `project-memory/practices/cache-invalidation-granularity.md`
  - `project-memory/practices/cross-boundary-string-agreement.md`
  - `project-memory/practices/read-model-granularity.md`
  - `project-memory/practices/reuse-projection-within-request.md`
  - `project-memory/operations/backend-acceptance.md`
  - `project-memory/operations/test-closed-loop.md`
  - `project-memory/operations/verification-governance.md`
  - `project-memory/pitfalls/claim-versus-behavior.md`
  - `project-memory/pitfalls/count-without-member-list.md`
  - `project-memory/pitfalls/negative-universal-claim.md`
  - `project-memory/pitfalls/owner-boundary-reverse-inference.md`
  - `project-memory/pitfalls/check-repo-before-authoring.md`
  - `project-memory/pitfalls/designing-from-conversation-not-system.md`
  - `project-memory/pitfalls/log-first-failure.md`
  - `doc/decisions/2026-07-24-v2s-r1-authorization.md`
  - `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md`
  - `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md`
  - `doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md`
  - `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`
  - `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`
  - `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`
  - `doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md`
  - `doc/platform/foundation-charter.md`
  - `scripts/README.md`
- `doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md`，仅作为业务规格输入读取，不作为作者结论或 review verdict 读取。
- 原始业务口述/旅程/IA：
  - `doc/decisions/2026-08-19-v2s-external-collaboration-platform-configuration-journey.md`
  - `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md`
  - `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md`
  - `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md`
  - 仓内没有 `doc/records/` 目录；以上 decision 文件是按 `rg` 定位到的当前 Journey 原始记录。
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md`、`doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md`。
- source/materialized schema、path contract：
  - `contracts/openapi-source/collaboration.schemas.json`
  - `contracts/openapi-source/business-channel.schemas.json`
  - `contracts/openapi/paths/platform-admin/external-collaboration.paths.json`
  - `contracts/openapi/paths/operations-admin/business-channel.paths.json`
  - `contracts/openapi/components/collaboration/collaboration.schemas.json`
  - `contracts/openapi/components/business-channel/business-channel.schemas.json`
- 后端 edge/owner/readback/mapper：
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/PlatformExternalCollaborationController.java`
  - `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`
  - `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java`
  - `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/api/CollaborationReadback.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/ExternalCollaborationWireMapper.java`
  - `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java`
- 前端 queries/UI/foundation：
  - `apps/frontend/operations-admin/src/features/business-channel/application/queries.ts`
  - `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelList.tsx`
  - `apps/frontend/operations-admin/src/features/business-channel/ui/ProjectBusinessChannelPage.tsx`
  - `apps/frontend/operations-admin/src/features/business-channel/ui/StoreBusinessChannelPage.tsx`
  - `apps/frontend/platform-admin/src/features/external-collaboration/application/queries.ts`
  - `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx`
  - `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingDetailDrawer.tsx`
  - `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingFormDrawer.tsx`
  - 关联详情错误边界也抽查了 `ExternalSystemDetail.tsx`、`ProviderProfileDetail.tsx`、`ExternalCollaborationPage.tsx`。
- acceptance/architecture/check/codegen：
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java`
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java`
  - `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java`
  - `apps/frontend/operations-admin/src/tests/architecture/business-channel-owner-binding-collection.test.mjs`
  - `apps/frontend/platform-admin/src/tests/architecture/external-collaboration-collection.test.mjs`
  - `scripts/check/external-collaboration-business-channel-contract.mjs`
  - `scripts/generate/r5-edge-materialize.mjs`
  - `scripts/generate/edge-codegen.mjs`

## Findings

### M-1 — store candidate URL scope does not enforce selected-store scope

```text
status=CONFIRMED
severity=M
Dexter decision required=no
```

证据：

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java:109-125` 的 candidate route 只调用 `requireStoreProjectPair(session, projectRef, storeRef)`。
- 同文件 `:451-462` 的 `requireScopedStore` 才检查 selected store；`:464-476` 的 `requireStoreProjectPair` 只读取 store、校验其 project owner、调用 `resolveSelectedProjectScope`，再比较 `projectRef`，没有比较 `session.scopeContext().store()` 与 `storeRef`。
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java:149-196` 的 SQL 以 workspace/group/project、`operator_kind='STORE'`、`status='ENABLED'` 过滤；`storeRef` 进入 cursor identity (`:160-166`)，但没有进入 candidate member predicate (`:168-185`)。这可以是 project 级关系事实，但不能替代 edge 的 URL/session scope guard。
- 已有 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java:352-375` 只覆盖 forged project 的 pair rejection，`:385-392` 覆盖 foreign store 的 channel list；没有覆盖“攻击者 selected Store A、目标 Store B 与 A 同属一个 project”的 candidate read。
- 原始 IA 明确要求 `storeRef` 的 project relationship fact 不放宽 scope：`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md:200-211`。

影响：store-scoped session 只要请求同一 project 下另一个 store 的 `storeRef`，pair validation 会通过，candidate owner read 会返回该 project 的 STORE template facts。该路径存在跨节点读越权，直接违反 M-1 的 session role/node scope 要求。

最小修复：candidate route 复用 `requireScopedStore(session, groupWorkspaceKey, storeRef)`，或把完全相同的 selected-store equality check 纳入 pair helper，同时保留 project/store pair validation；补充真实 acceptance negative：同 project 的 Store A 请求 Store B candidate 必须得到 typed access denied/无 candidate facts。

### S-1 — P4 queryText 不能搜索业务节点名称

```text
status=CONFIRMED
severity=S
Dexter decision required=no
```

证据：

- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java:155-177` 的 P4 SQL 是真实 `COUNT(*) OVER()` + `LIMIT/OFFSET` Page，但 query predicate 只匹配 `binding_display_name` 或原始 `node_ref`。
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/PlatformExternalCollaborationController.java:98-115` 正确传入 `queryText/page/pageSize`；但 `:263-276` 先把 owner 已分页的结果映射为 response，`:292-308` 才通过 task-path lookup 得到节点展示路径。展示名称产生在分页之后，不能参与 total/count 或 member selection。
- 业务目标要求按业务名称和节点名称查找：`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md:123-135`；IA 的 data source 也要求 nodeRef 由 task lookup 映射为业务名称：`doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md:102-113`。

影响：用户看到的是节点业务名称/路径而不是 UUID；输入节点名称时，P4 可能返回空页。把 lookup 放到 edge 的 page 后再过滤也会破坏真实 Page 的 total 和分页语义。

最小修复：在 owner-approved read model/query 中按 workspace、provider 和节点 scope 搜索节点展示名称，并让该 predicate 参与 SQL count/limit/offset；补一条按 node display name 查询的 acceptance scenario。保留现有 `queryText/page/pageSize/metadata.total` 契约。

### S-2 — P2/P3 详情和状态命令失败没有用户可见的 typed problem

```text
status=CONFIRMED
severity=S
Dexter decision required=no
```

证据：

- `apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalSystemDetail.tsx:75-95` 的状态 mutation 在 `:88-90` catch 后只调用 `void platformProblemOf(error)`，不保存 problem、不渲染 Alert/反馈，也不重新抛出；`:95` 仍只按 loading/currentData 渲染旧详情。
- `apps/frontend/platform-admin/src/features/external-collaboration/ui/ProviderProfileDetail.tsx:19-21` 在 provider detail query 失败时把 `currentData` 缺失当成“加载接入档案”，没有错误详情或重试入口。External system detail 同样在 `ExternalSystemDetail.tsx:73-95` 没有处理初始 query error。
- `apps/frontend/platform-admin/src/app/api/PlatformTransport.ts:70-72` 的 `platformProblemOf` 只是转换函数；调用它而丢弃返回值不会形成 shell feedback。
- 这与 `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md:74-85,88-99` 要求的 typed owner problem，以及 `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md:30-35` 的“失败显示 typed problem、保留旧 readback”不一致。旧 readback 被保留，但失败原因对用户不可见。

影响：停用/启用失败、版本冲突、详情读取失败会表现为旧状态或持续 loading，用户无法判断操作是否失败，也没有稳定的 retry/诊断路径。

最小修复：在 P2/P3 保存 `PlatformApiProblem` 并渲染 typed Alert/重试反馈；命令失败保持旧 query readback，但不能吞掉 problem；初始 detail query 失败也要有可见错误和 retry。不要破坏已有 owner transport/foundation boundary。

### N-1 — status version 在 schema/generated/UI 中被放宽且由 UI 回退为 0

```text
status=PARTIALLY_CONFIRMED
severity=N
Dexter decision required=no
```

证据：

- `contracts/openapi-source/collaboration.schemas.json:64-74,114-127` 的 `ExternalSystemView`/`ProviderProfileView` required 集合不包含 `version`；materialized schema 相同。
- 生成 TS `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:743-751,1218-1229` 因此把 `version` 生成成 optional；`ExternalSystemDetail.tsx:79-83` 对 status command 使用 `system.version ?? 0`。
- 当前 owner/edge 实现确实会提供版本：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/ExternalCollaborationWireMapper.java:63-75,94-105`，catalog-only mapper 在 `:78-91` 明确提供 `0L`，所以本次静态检查不能证明当前正常 readback 会丢 version。

影响：契约允许缺失 version，consumer 以 0 继续发起并发控制命令，弱化了 source→generated→UI 的一致性；未来任何缺失 version 的 response 会变成误导性的版本冲突，而不是 schema/transport failure。

最小修复：让参与状态 mutation 的 workspace system/provider response 将 `version` 设为 required 并删除 UI fallback；若 catalog-only response 必须保留不同语义，则拆出明确的 catalog-only view，而不是让同一 response 类型隐式可缺失。

## Requested focus verdict ledger

### M-2 collection classification

**PASS（静态实现）**。O1/O3/O5 的 owner reads 使用固定 source constant `BOUNDED_READ_LIMIT=100`，查询 `LIMIT 101`，超过固定上界抛 `PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION`，返回 exact set、`nextCursor=null`；证据为 `BusinessChannelOwnerService.java:39-48,103-144,201-238`，并有 `BusinessChannelOwnerContractTest.java:107-145,155-196` 的 limit/overflow contract tests。provider/store template candidates 保持 cursor protocol，见 `BusinessChannelOwnerService.java:149-196` 和 operations queries 的 cursor collection。P4 使用 SQL window total、`LIMIT/OFFSET` 和 metadata total，见 `CollaborationOwnerService.java:163-211`；S-1 只指出其业务名称 predicate 不完整，不改变 P4 的 Page 分类。

### S-1 foundation refresh/generation guard

**PASS（静态实现与 architecture test）**。business-channel UI 和 owner-binding list 使用 foundation 的 generation guard、refresh signal、page query identity；未发现手写 `active`/`refreshToken`。证据为：

- `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelList.tsx:1-10,83-101`
- `apps/frontend/operations-admin/src/features/business-channel/ui/ProjectBusinessChannelPage.tsx:19-61,137-195`
- `apps/frontend/operations-admin/src/features/business-channel/ui/StoreBusinessChannelPage.tsx:13-54`
- `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx:1-12,58-79`
- `apps/frontend/platform-admin/src/tests/architecture/external-collaboration-collection.test.mjs`
- `apps/frontend/operations-admin/src/tests/architecture/business-channel-owner-binding-collection.test.mjs`

两份 architecture test 本轮只读执行通过（4 tests）。这不等同于 browser L2 或动态竞态证据。

### S-2 typed owner Problem advice

**PASS（静态实现）**。全局 `@RestControllerAdvice` 在 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:55-58,133-151` 登记 Collaboration 和 Business Channel typed owner Problem；目标 controller 未发现本地复制的同类 mapping。现有 typed mapping test 也覆盖该 advice。前端 P2/P3 的可见反馈缺口另列为 S-2 finding，不能与后端 advice PASS 混为一谈。

### N-1 catalog-derived status / PLANNED non-gate

**PASS（静态实现）**。catalog status 从 source definition/readback 映射；provider enablement/candidate read 以空间启用状态和 capability scope 为准，没有用 `catalogStatus=PLANNED` 阻止 enablement 或候选。`CollaborationOwnerService.java:126-140`、`ExternalCollaborationWireMapper.java:78-105` 保留 PLANNED 作为 informational state。六项 C dependency 仍作为 dependency state，未被代码改写成 gate。

## Contract, route, owner and acceptance reconciliation

- source schema 与 materialized schema 的 byte comparison 均为 `0`；`scripts/check/external-collaboration-business-channel-contract.mjs` 输出 `EXTERNAL_COLLABORATION_CONTRACT_PASS systems=4 providers=7`。
- `node scripts/generate/edge-codegen.mjs --check` 输出 `R5_EDGE_CODEGEN_CHECK=PASS FILES=271`。generated backend/frontend 类型、wire mapper 与 operations/platform queries 的字段方向和 collection shape 静态一致：bounded page 只暴露 items，candidate 保留 cursor/total，P4 保留 page/pageSize/total。
- platform path 的 `x-consumer-faces` 均为 `platform-admin`，operations path 均为 `operations-admin`；读取 owner 分别保持 collaboration/business-channel，GET 没有被错误加成 capability，写操作仍只使用既定两项 business-channel capabilities。未发现因实现 remediation 合并两个 admin app 或 owner boundary 的回归。
- `BackendAcceptanceScenarioCatalog.java:9-27` 保留 Collaboration 与 BusinessChannel 两个 domain group；Business Channel 的既有 cross-node negative 覆盖 forged project、foreign store channel list、channel detail 和 binding detail，但没有覆盖 M-1 所需的同 project foreign-store candidate read。
- 本 review 没有执行 DEV、seed、reset、Testcontainers、browser L2、UAT 或外部联调。故任何真实 HTTP、数据库、动态分页、运行时 session role/node scope 和 UI 视觉结论均不宣称 PASS；这些属于 `UNVERIFIED_REQUIRES_EVIDENCE`，不用于把本 verdict 变成 GO。

## Required remediation disposition

在下一轮 implementation review 前，至少需要：

1. 修复并覆盖 M-1 的 selected-store equality，且保留同 project foreign-store 的真实 negative acceptance。
2. 修复 P4 node display name 的 owner-side search 语义，并补 node-name query acceptance。
3. 让 P2/P3 typed owner failures 可见，同时保留旧 readback和可重试路径。
4. 处理 version schema optionality，或在明确的 catalog-only response boundary 中解释并隔离该差异。

完成源码修改后必须重新进行本 cycle 的 implementation evidence 核验；本 Round 1 不宣告 GO，也不自行关闭 review cycle。
