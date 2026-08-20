# R5 外部协作与业务渠道实现跟进 · Independent Review Round 1 Verdict

## Metadata

```text
REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_FOLLOWUP_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-followup-independent-review-round-1-input-checklist.md
blindReviewDeclaration=READ_INPUTS_THEN_REOPEN_SOURCE
roundDecision=ROUND_1_NO_GO_NOT_FINAL_CYCLE_DECISION
```

本会话从 `catering-v2s` 仓根 fresh 启动，以“找出实现为什么不成立”为立场。清单中的上一 cycle Round2 verdict 与 author intake 仅作为不可信的历史输入；本 verdict 不复用其轮次或结论，所有当前判断均重新打开 owning source、契约、generated wire、consumer 和本轮新鲜静态/focused 输出。清单 30/30 个 SHA-256 均匹配；哈希只证明输入完整性，不作为语义结论。

## Verdict

```text
VERDICT=NO-GO
M=0
S=1
N=0
```

`NO-GO` 仅由 S-1 的服务端搜索语义缺口导致。S-2、N-1、N-COUNT、M-1 的静态实现链本轮已闭合。Round 1 不是本 cycle 的最终 GO；作者应在本 verdict 后逐条重开 owning source 做 intake，必要时再由 fresh reviewer 执行 Round 2，且不得召集第三轮。

## Findings and item status

### S-1 — `CONFIRMED`（significant）

契约/目录已经声明 `queryText` 是大小写不敏感的服务端子串搜索，覆盖 binding name、business node display name/path、node reference：

- `contracts/openapi/paths/platform-admin/external-collaboration.paths.json:520-527`
- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:8038-8059`
- materialized/generated query shape：`apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:1819-1836`
- platform query consumer：`apps/frontend/platform-admin/src/features/external-collaboration/application/queries.ts:12-28`；列表入口保留 `queryText/page/pageSize` 并把搜索交给服务端：`apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx:49-79,83-91`

但 owner SQL 的真实过滤只包含 binding name、`node_ref` 和一个 leaf-like `node_display_name`：

- `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java:175-211` 建立 `owner_node_display`；其 `:183-201` 只拼接当前 node 的 `code || ' ' || name`，`WHERE` 在 `:208-210` 没有 `nodeDisplayPath/display_path` 谓词。
- 实际返回给用户的 `nodeDisplayPath` 是 owner Page 过滤之后才由另一个 organization task-path read 补上的：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/PlatformExternalCollaborationController.java:263-277,292-317`。
- 该路径不是当前 leaf name 的同义物；递归祖先和 ` / ` 路径由 `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java:182-234` 生成。因而对祖先路径片段的 `queryText` 搜索不会命中当前 SQL。

`COUNT(*) OVER()` 与 Page members 对当前三字段 SQL 谓词本身一致（同一 filtered result 再 `ORDER/LIMIT/OFFSET`），但与契约宣称的四类搜索语义不一致。现有 focused contract test 只检查 `node_display_name`，没有证明 path predicate：`apps/backend/catering-business-server/modules/collaboration/src/test/java/com/catering/v2s/collaboration/application/CollaborationOwnerContractTest.java:144-180`。现有 acceptance 也只取 `nodeDisplayPath` 的最后一个 leaf 再查询，没有攻击祖先/path 语义：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java:183-212`。

最小修复建议：在 `CollaborationOwnerService.pageBindings` 的同一 owner-side filtered projection 中加入与 `nodeDisplayPath` 相同的 `display_path` 生成/读取，并把它加入同一 `WHERE`；保持 `COUNT(*) OVER()` 与返回 members 使用同一过滤关系。同步把 `CollaborationOwnerContractTest` 的 SQL/参数断言和 acceptance regression 改为覆盖祖先/path token，而不只是 leaf。若产品实际只要 leaf-only 搜索，则需要 Dexter 先裁决，再协调收窄 source path、catalog、UI copy 和 acceptance；当前批准契约已明确包含 path，默认推荐补齐实现而不是降级契约。

### S-2 — `CONFIRMED`（静态实现闭合；动态行为未声明通过）

ProviderProfileDetail 已具备完整的 status command/readback 分离链：

- `apps/frontend/platform-admin/src/features/external-collaboration/ui/ProviderProfileDetail.tsx:25-67` 保留 `query.currentData`、使用 generated `transitionPlatformProviderProfileStatus`、发送 `expectedVersion: profile.version`，command failure 保存 typed problem 与 `retryStatus`；`:35-43,95-104` 将 post-command readback failure 走独立 `refreshReadback` retry，而不是重发 POST。
- status control 真实渲染于 `:137-154`，不是仅有文案或静态字段。
- generated command 存在且路径/方法/会话约束闭合：`apps/frontend/platform-admin/src/app/api/generated/platform-edge.rtk.ts:433-439,724-727`；provider response/type 为 `ProviderProfileView`：`apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:1216-1229,2239-2250`。
- owner command 与 canonical expected-version/readback 真实存在：`apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java:330-363`。
- command failure 是 typed owner problem，并由 edge advice 转为 typed Problem：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:133-141`；frontend transport 将它保留为 `PlatformApiProblem`：`apps/frontend/platform-admin/src/app/api/PlatformTransport.ts:17-24,49-72`。

ExternalSystemDetail 具有同构的 status command、required version、旧 readback 保留、command retry 和独立 readback retry：`apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalSystemDetail.tsx:73-118,119-157,183-195`；其 generated command 为 `apps/frontend/platform-admin/src/app/api/generated/platform-edge.rtk.ts:417-423,716-719`，owner implementation 为 `CollaborationOwnerService.java:295-328`。

适用边界：本轮按明确授权只做静态/focused proof，未声称真实 HTTP、DEV、Testcontainers、浏览器或外部系统运行态成功；上述 `CONFIRMED` 是实现结构和类型/编译链闭合，不替代动态 acceptance。

### N-1 — `CONFIRMED`

`ProviderProfileView.version` 全链闭合，且没有 UI `?? 0` fallback：

- source schema required/version：`contracts/openapi-source/collaboration.schemas.json:115-184`
- materialized schema 保持 required/version：`contracts/openapi/components/collaboration/collaboration.schemas.json:115-184`
- owner readback 是 required primitive：`apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/api/CollaborationReadback.java:33-47`
- backend mapper 从 owner value 直传：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/ExternalCollaborationWireMapper.java:94-105`
- generated Java wire 有 `Long version`：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/ProviderProfileView.java:4-14`
- generated TypeScript 有 required `version: number`：`apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:1218-1229`
- UI mutation 使用 `expectedVersion: profile.version`：`apps/frontend/platform-admin/src/features/external-collaboration/ui/ProviderProfileDetail.tsx:45-56`

`ExternalCollaborationWireMapper.java:108-120` 的 catalog-only dictionary mapping 明确使用 `0L` 表示没有 workspace enablement；该无 workspace、不可变更的 catalog route 不参与 ProviderProfileDetail status mutation，不是 UI fallback，不能反向证明 provider workspace version 缺失。

### N-COUNT — `CONFIRMED`

本轮用 `rg -n "@AcceptanceScenario" apps/backend/catering-business-server/src/test/java` 重新计数，实际源码为 60：baseline 44（IAM 10、Organization 7、CommercialContract 4、Asset 2、Catalog 18、Audit 1、Extension 2）+ 新增 Collaboration 10 + BusinessChannel 6。逐文件证据来自各 domain 文件的 `@AcceptanceScenario` 行，且新文件完整范围为：

- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java:57,108,155,183,214,261,297,340,405,442`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java:66,136,165,238,268,304`
- 当前显式 domain catalog 登记这两个 group：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java:9-27`

设计/串行计划的 44+16=60 与实际 source count 一致：

- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md:411-429`
- `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md:243-274`

`business-channel.cross-node-read-authorization` 已登记于设计/计划：`implementation-design.md:452`、`serial-plan.md:253-271`，并实际带 `@AcceptanceScenario`：`BusinessChannelAcceptanceScenarios.java:304-307`。当前 catalog 是正常的显式 domain group，不是退役 provider shell、共享 SPI 或通用 scenario registry；当前主动标准明确禁止恢复这些旧机制：`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md:30-54,104-116`。本轮没有发现为迎合旧分母而删除该安全场景或恢复退役控制面的证据。

### M-1 — `CONFIRMED`（静态链闭合；动态 acceptance 未授权）

- selected-store equality guard 与 project/store pair guard：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java:452-474`；它先由 owner organization read 重新确认 store/project，再在已有 selected store context 下执行严格 equality check。
- same-project sibling store fixture 确实沿用同一 `workspaceUuid/groupWorkspaceKey/projectId/brandId`：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java:623-669`。
- negative acceptance 先创建 owner template/channel/binding，再以 attacker selected store 读取 foreign store candidate，并要求 403 且不泄露 owner templateRef：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java:304-350,377-385`；后续 project/store/channel/binding foreign reads 也覆盖于 `:387-418`，typed/no-leak oracle 在 `:494-498`。

适用边界：本轮只证明源码 guard、fixture、request 和 business oracle 的静态闭合；明确没有执行该 acceptance 的真实 HTTP/Testcontainers，也没有把静态链描述成动态 PASS。

## Fresh static/focused proof

本轮新鲜执行并通过：

```text
node scripts/generate/r5-edge-materialize.mjs                 R5_EDGE_MATERIALIZE=PASS
node scripts/generate/edge-codegen.mjs --check                R5_EDGE_CODEGEN_CHECK=PASS
node scripts/check/external-collaboration-business-channel-contract.mjs
                                                               EXTERNAL_COLLABORATION_CONTRACT_PASS systems=4 providers=7
yarn workspace @catering-v2s/platform-admin typecheck           exit 0
yarn workspace @catering-v2s/platform-admin test:architecture   14 pass, 1 todo, 0 fail
node --test apps/frontend/platform-admin/src/tests/architecture/external-collaboration-collection.test.mjs
                                                               3 pass, 0 fail
bash scripts/check/openapi-contracts                            R5_OPENAPI_CONTRACTS=PASS
bash scripts/check/frontend-architecture                       R5_FRONTEND_ARCHITECTURE=PASS
./gradlew :apps:backend:catering-business-server:modules:collaboration:test \
  --tests com.catering.v2s.collaboration.application.CollaborationOwnerContractTest \
  --no-daemon --rerun-tasks                                    BUILD SUCCESSFUL
./gradlew :apps:backend:catering-business-server:compileJava \
  --no-daemon --rerun-tasks                                    BUILD SUCCESSFUL
node --test scripts/test/backend-acceptance-structure.test.mjs  1 pass, 0 fail
```

这些命令均为源码、契约、生成物、编译、focused test 或静态 check；没有执行 DEV start/restart、reset、seed、Testcontainers、真实 HTTP/backend-acceptance、浏览器 L2、UAT 或外部联调。

## Context and failure-recall boundary

已读取仓根入口、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、显式 Roadmap 授权字段、全部 project-memory kernel、清单及清单列出的原始 IA/interaction/Journey/implementation design/serial plan/上一 cycle Round2 verdict/intake、契约、generated wire、owner source、UI source 与 focused/static evidence。当前 Roadmap 的 R5 implementation authorization 见 `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md:112-170`；它不扩大本轮用户明确禁止的动态边界。

本仓 `scripts/context/recall-memory` 与 `scripts/memory/query` 在本轮因 literal anchor drift 返回同一工具边界：

```text
PROJECT_MEMORY=FAIL
REASON=missing literal owning heading: doc/platform/implementation-task-template.md:## 正本(逐字复制以下代码块)
```

按 `cs-memory-recall` 规则没有用等待或重复相同失败信号掩盖问题；改用当前 `project-memory/index.json` 做确定性的 review 路由，打开全部命中 memory entry 和适用 source refs。`scripts/context/recall-failure` 对该 exact failure 也只返回同一工具边界，没有返回可供伪造的 runtime manifest/log；因此该项不被列为实现 finding，也不被当作动态证据。`cs-failure-recall` 与 `cs-systematic-debugging` 的要求均已遵守：首败保留、未进行第二次同信号运行、未使用 timeout/polling/magic wait。

## Author intake boundary

本文件是 fresh independent reviewer 的 Round1 verdict。作者只能在此 verdict 之后逐条重开 S-1/S-2/N-1/N-COUNT/M-1 的 owning source、原始 IA/业务条目和本轮证据，给出 dialectical intake；历史 Round2 author intake 不得直接升级为当前结论。当前唯一待修复的静态 finding 是 S-1；其余项的静态闭合不授权动态运行、seed/reset、L2 或外部协调。
