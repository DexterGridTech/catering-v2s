# R5 外部协作与经营渠道 implementation remediation 独立复核结论

## Review metadata

~~~text
REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_REMEDIATION_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=READ_INPUTS_THEN_REOPEN_SOURCE
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEW_ROOT=/Users/dexter/Documents/workspace/idea/catering-v2s
INPUT_CHECKLIST=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-remediation-independent-review-round-2-input-checklist.md
~~~

本文件是同一 REVIEW_CYCLE_ID 的最终 Round 2 独立审查结论。审查先读取输入清单及其最小完整输入，再重新打开 owning source、契约、generated output、测试和实际静态命令结果；作者 intake 只作为待证伪输入，不作为结论依据。本轮不召集第三轮 reviewer。

## Verdict

**NO-GO**

~~~text
M=0
S=2
N=2
~~~

NO-GO 的直接原因是 S-2 与 N-1 仍未闭合；S-1 还有契约语义漂移；另有本轮 acceptance denominator 与 15/59 声明不一致。M-1 的真实同项目 foreign-store 绕过面已由当前 guard 与负向 acceptance 静态闭合，但本轮没有执行动态 acceptance，因此不宣称 runtime PASS。

## Input and review boundary

已逐文件读取的最小完整输入包括：

- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、doc/platform/roadmap-program-registry.json、当前 R5 Roadmap 授权字段；
- doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md、doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md、doc/decisions/2026-08-19-v2s-business-channel-management-journey.md；
- doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md、doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md；
- Round 1 independent verdict、Round 1 author intake、contracts/openapi-source/collaboration.schemas.json 与 R5 edge contract catalog；
- checklist 列出的 controller、collaboration owner、acceptance scenarios、owner contract test、两份 detail UI、OwnerBindingList、operations scope architecture test，以及对应 materialized/generated wire。

本轮只做源码、契约、generated output、编译、focused test 和静态审查。没有执行 DEV、reset、seed、Testcontainers、真实 HTTP、浏览器 L2、UAT 或外部联调；所有 acceptance 结论均明确限于源码/编译证据。

## Finding disposition

### M-1 — REJECTED_WITH_EVIDENCE

当前 candidate route 已真正复用 selected-store equality guard：

- apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java:110-126 先执行 requireStoreProjectPair，再调用 owner candidate read。
- .../OperationsBusinessChannelController.java:452-473 中 requireStoreProjectPair 调用 requireScopedStore；requireScopedStore 在 :459-461 将 URL storeRef 与 requireStore(session) 的 selected store 做精确比较，之后才返回 organization owner projection。requireStore 在 :510-513 直接取 session 的 selected store。
- 负向 acceptance 不是只测 project mismatch：apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java:310-317 选择 attacker store，并通过 siblingStoreFixtureSameBrand 建立同一 project 下的第二个 store；fixture helper 在 BackendAcceptanceTest.java:627-632 明确复用 existing.projectId()。
- BusinessChannelAcceptanceScenarios.java:377-385 使用 owner 的真实同 project projectRef 与 foreign storeRef，断言 403 且不返回 owner template ref；:363-375 的 forged project 断言是另一条独立 pair guard 负向路径。

这条静态证据链已覆盖 controller → selected-store guard → organization owner projection → same-project foreign-store negative acceptance。因本轮禁止动态环境，未把该 acceptance 标成已执行的业务 PASS。

### S-1 — PARTIALLY_CONFIRMED

owner Page 的核心实现已从根上修复，且不是 edge 组装 display path 后再过滤：

- apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java:150-211 的 pageBindings 在 owner SQL 内建立 provider-scoped owner_bindings、requested_nodes 与 owner_node_display；覆盖 COMMERCIAL_GROUP、REGION、PROJECT、HEAD_COMPANY、STORE 五类节点。
- 同一 SQL 的 predicate 在 :208-210 同时匹配 binding_display_name、node_ref 与 node_display.node_display_name；COUNT(*) OVER() 在 :205 位于过滤后的选择阶段，LIMIT ? OFFSET ? 在 :211 作用于同一过滤结果。参数绑定 :216-233 与这组 CTE、三个 query pattern、LIMIT/OFFSET 的顺序一致。
- PlatformExternalCollaborationController.java:98-115 将 queryText/page/pageSize 传给 owner Page；ExternalCollaborationWireMapper.java:122-131 只在 owner Page 完成后做 wire mapping，没有对 Page 结果进行 edge-side display-path 过滤。
- CollaborationOwnerContractTest.java:126-180 的 focused contract test 断言 owner SQL、COUNT(*) OVER()、owner_node_display、organization task join、LIMIT/OFFSET 和参数序号；CollaborationAcceptanceScenarios.java:183-211 的新 scenario 使用真实 owner binding 的节点名称查询，且 createBinding helper 在 :485-500 将绑定名称设置为 provider/node type，不是节点名称，因此不是把 binding name 当作 node-name 证据。

但 generated contract 的语义仍然落后于实现：

- contracts/openapi/paths/platform-admin/external-collaboration.paths.json:471-527 的 getPlatformProviderProfileBindings.queryText description 仍写成 “matched against binding name or node reference”，没有声明业务节点名称/显示路径是可搜索字段。
- 同一描述来自 R5 edge contract catalog 的对应 operation entry（doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:8045-8051），因此不是仅 materialized 文件的手工偏差。
- 这与 IA 的“可搜索绑定名称/节点名称”要求（doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md:105-110）及 UI placeholder OwnerBindingList.tsx:83-91 不一致。当前静态 contract/codegen gate 只能证明结构生成一致，不能证明该语义 description 已同步。

最小修复是更新该 queryText 的 source/catalog description，说明 binding name、business node display name/path 与 node reference 均参与服务端过滤，再重新 materialize/codegen 并复跑同一静态检查；不需要新增 query API 或把 edge display path 提前成事实源。

### S-2 — PARTIALLY_CONFIRMED

查询错误的部分整改是真实的，但 P2/P3 的 status mutation/error/retry 闭环仍不成立：

- ExternalSystemDetail.tsx:80-83 使用 currentData 与 typed platformProblemOf；初次 query 失败在 :108-127 显示 typed Alert 与 query retry，已有成功 readback 时 :130-151 仍保留详情并显示 typed problem。
- External system command failure 在 :84-106 转换为 typed problem 并保留旧 system；:132-147 提供 command retry。
- ProviderProfileDetail.tsx:16-39 与 :41-57 同样对初始 query 失败和已有 currentData 的 query 失败显示 typed problem、保留旧 readback 并提供 query retry；因此 Round 1 中“纯 loading、吞掉 query error、错误期清空旧 query readback”的部分已被修复。

仍存在两个可复现的静态缺口：

1. P3 明确要求档案启停（doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md:88-99；interaction wireframe 在 doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md:96-120 显示当前状态和[停用]）。generated contract 与 backend mutation 也真实存在：contracts/openapi/paths/platform-admin/external-collaboration.paths.json:358-469、apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:2239-2253、PlatformExternalCollaborationController.java:210-231。但 ProviderProfileDetail.tsx:1-114 没有 status control、platformClient mutation、expectedVersion、mutation error state 或 mutation retry。故无法证明 provider status mutation 失败时形成 typed visible problem、保留旧成功 readback 或可重试；实现是缺少 mutation，而不是已闭合。
2. ExternalSystemDetail.tsx:90-104 把成功 command 之后的 query.refetch() 也放在同一个 try 中。若 command 已成功但 readback refetch 失败，:100-104 会把 query/readback failure 误存为 mutation problem 并设置 retryStatus；渲染处 :139-145 的“重试”随后再次执行 POST，而不是重试 query。这会重复提交旧 system.version，可能把 readback failure 转换为错误的 VERSION_CONFLICT，不符合 query/mutation 错误来源和 retry 语义。

最小修复是为 ProviderProfileDetail 补齐批准的 status mutation，并分别维护 command retry 与 post-command readback retry；不能用一次通用 retry 或重新触发 mutation 掩盖 readback failure。应增加 initial query error、已有 readback query error、command failure、command success/readback failure 四类 focused UI tests；本轮没有执行浏览器或动态 HTTP。

### N-1 — PARTIALLY_CONFIRMED

source → materialized schema → generated type → backend mapper 的 version 字段已基本闭合：

- source schema contracts/openapi-source/collaboration.schemas.json:64-75 与 :115-129 将 ExternalSystemView.version、ProviderProfileView.version 列入 required；materialized contracts/openapi/components/collaboration/collaboration.schemas.json:64-75、:115-129 保持一致。
- generated TypeScript apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:743-750 与 :1218-1228 使用 required version: number；generated Java wire ExternalSystemView.java:4-11、ProviderProfileView.java:4-14 也包含 version 字段。
- owner readback 使用 primitive long（CollaborationReadback.java:12-19、:33-43），mapper 在 ExternalCollaborationWireMapper.java:63-105 将 value.version() 传入 workspace readback。catalog-only dictionary 的 0L 在 :78-91、:108-119 是明确的 catalog-only fact，不是缺失 fallback。
- ExternalSystemDetail.tsx:90-95 将 required system.version 传给 status mutation 的 expectedVersion，目标链路没有 ?? 0。

但 ProviderProfileView 的 UI mutation 末端缺失：虽然 generated/backend provider status command 要求 ProviderProfileStatusRequest.expectedVersion，ProviderProfileDetail.tsx:1-114 没有任何 mutation caller，也没有任何 profile.version → expectedVersion 消费点。因此本轮不能把 N-1 判为全链路闭合。该缺口与 S-2 的 mutation 缺失相关但不相同：S-2 关注可见错误、旧 readback 和 retry；N-1 关注版本事实是否抵达 UI command。

### N-COUNT — CONFIRMED

本轮 source denominator 与 15/59 声明不一致：

- implementation design 在 doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md:413-427 声明 baseline 44、proposed new 15、projected 59。
- 当前源码静态计数为：Iam=10、Organization=7、CommercialContract=4、Asset=2、Catalog=18、Audit=1、Extension=2、BusinessChannel=6、Collaboration=10，总数 60。命令 rg -o '@AcceptanceScenario' apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/*.java | wc -l 返回 60；按文件 BusinessChannelAcceptanceScenarios.java=6、CollaborationAcceptanceScenarios.java=10。
- 设计列出的 15 条场景在 ...implementation-design.md:435-451，而当前 BusinessChannelAcceptanceScenarios.java:304-307 还增加了 business-channel.cross-node-read-authorization，这是 M-1 所要求的同 project foreign-store negative acceptance，未反映到 15/59 denominator。

当前 60 仍低于硬上限 80；这不是恢复 compliance-control、provider shell 或退役 scenario registry 的理由。问题是 closure claim 与 source member list 不一致，最小处置是把该 M-1 场景纳入设计/denominator，明确为 16/60，或由 Dexter 明确决定替换哪一条已有场景。不能把错误的 15/59 当成已验证事实。

## Static and focused proof executed in this Round 2

~~~text
scripts/check/external-collaboration-business-channel-contract
  EXTERNAL_COLLABORATION_CONTRACT_PASS systems=4 providers=7

scripts/check/r5-edge-materialize --check
  R5_EDGE_MATERIALIZE_CHECK=PASS
  OPERATIONS=181
  FACES=61/108/12

scripts/check/edge-codegen
  R5_EDGE_CODEGEN_CHECK=PASS
  FILES=271

scripts/check/openapi-contracts
  R5_OPENAPI_CONTRACTS=PASS

scripts/check/contract-face
  R5_CONTRACT=PASS; STATE=POST_GATE_0

scripts/check/frontend-architecture
  R5_FRONTEND_ARCHITECTURE=PASS

node --test apps/frontend/platform-admin/src/tests/architecture/external-collaboration-collection.test.mjs \
  apps/frontend/operations-admin/src/tests/architecture/business-channel-scope.test.mjs
  4 tests passed

yarn workspace @catering-v2s/platform-admin typecheck
  exit=0

./gradlew :apps:backend:catering-business-server:modules:collaboration:test \
  --tests com.catering.v2s.collaboration.application.CollaborationOwnerContractTest
  BUILD SUCCESSFUL

./gradlew :apps:backend:catering-business-server:compileTestJava
  BUILD SUCCESSFUL
~~~

这些命令证明结构、生成一致性、focused owner contract test、前端类型和 acceptance source 编译通过；它们没有执行 Testcontainers、真实 HTTP 或浏览器行为。

## Context recall and limitations

按本仓 skill 要求执行：

~~~text
scripts/context/recall-failure --query 'same-project foreign-store candidate selected-store scope'
PROJECT_MEMORY=FAIL
REASON=missing literal owning heading: doc/platform/implementation-task-template.md:## 正本(逐字复制以下代码块)
~~~

该失败是仓内 recall tooling 的缺失 heading，不是实现结论。本轮未修改 memory/tooling（输出要求只允许写 verdict）；已按 project-memory/index.md 的六维 route 手动读取命中的 kernel、decision、operation 与 pitfall 原文，然后继续以 owning source、契约、生成物、focused test 和静态命令为证据。该工具失败也不被用来替代动态证据。

## Required next step

下一步应先修复同一实现范围内的 S-1 contract description、ProviderProfileDetail status mutation/version/retry 闭环、ExternalSystemDetail readback retry 分流，并把 M-1 新增 scenario 纳入 16/60 denominator；完成后由 Dexter 决定是否开启新的 review cycle。当前 cycle 已到 Round 2 上限，本 verdict 不授权动态环境、seed/reset、L2/UAT 或任何仓库控制动作。
