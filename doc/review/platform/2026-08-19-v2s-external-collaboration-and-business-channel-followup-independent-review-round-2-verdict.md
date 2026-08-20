# R5 外部协作与经营渠道 implementation follow-up 独立复核 Round 2 Verdict

## Metadata

```text
REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_FOLLOWUP_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=READ_INPUTS_THEN_REOPEN_SOURCE
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerInputChecklist=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-followup-independent-review-round-2-input-checklist.md
VERDICT=GO
M=0
S=0
N=0
```

## 独立结论

`GO` 仅适用于本轮批准范围内的静态 implementation follow-up。Round 2 重新打开了 checklist、仓入口、显式 Roadmap 授权、六个 project-memory kernel、当前 memory route 命中材料、原始 IA/interaction/Journey、implementation/serial design、契约/catalog/generated、owner service、路径服务、edge controller、focused contract test、acceptance scenarios 与 UI source。Round 1 verdict 与作者 intake 在完成上述源码核验后才作为历史输入读取，未直接接受其结论。

未执行且未声称通过：DEV、reset、seed、Testcontainers、真实 HTTP、浏览器、L2、UAT、外部联调。故本 verdict 不是动态业务验收结论。

## 逐条核验

### 1. S-1：queryText 进入 owner-side pre-pagination filtered relation — `CONFIRMED`

契约与 catalog 仍明确声明 queryText 是大小写不敏感的服务端子串搜索，范围包含 binding name、business node display name/path 与 node reference：

- `contracts/openapi/paths/platform-admin/external-collaboration.paths.json:520-527`
- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:8038-8059`
- `contracts/openapi/components/collaboration/collaboration.schemas.json:298-370,373-419`
- `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:1819-1836,995-1024`

owner SQL 已把 business node display projection 放在最终 owner relation 的 WHERE 之前：

- owner/provider/workspace relation 与 requested node set：`apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java:175-182`
- recursive node seed、ancestor 与 `node_paths.display_path`：`:183-203`
- 五类 node display projection：`:204-228`
- 同一 filtered relation 上的 binding name、node ref、node display name、`node_display_path` 四个 OR 条件：`:229-240`
- `COUNT(*) OVER()` 位于过滤后的 SELECT，`ORDER BY ... LIMIT ? OFFSET ?` 位于 WHERE 之后：`:229-240`

edge controller 仍只在 owner page 得到结果后用 canonical organization path 做 response enrichment：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/PlatformExternalCollaborationController.java:263-317`。因此当前 search path 不再依赖分页之后才出现的 display path。前端继续把 queryText、page、pageSize 交给服务端 Page，并使用 metadata.total：`apps/frontend/platform-admin/src/features/external-collaboration/application/queries.ts:12-28`、`apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx:49-79`。

### 2. 五类路径与 canonical persisted path — `CONFIRMED`

逐项对照 `OrganizationTaskPathService.persistedTaskPathsSql()`：

- `COMMERCIAL_GROUP`：owner projection 使用 `code name` 作为 display name、`name（code）` 作为 display path；canonical persisted path 的 group 分支也是 `name（code）`，且两者都按 `group_workspace_key` 取 group：`CollaborationOwnerService.java:205-211` 对 `OrganizationTaskPathService.java:186-188,216-228`。
- `REGION` / `PROJECT`：owner 使用相同的 `organization_node` workspace/group scope、递归 parent scope、`string_agg(code || ' ' || name, ' / ' ORDER BY depth DESC)`；canonical 对应递归与 projection 位于 `OrganizationTaskPathService.java:193-215,228-230`，owner 对应位于 `CollaborationOwnerService.java:183-203,212-216`。
- `HEAD_COMPANY`：两侧均按 workspace/group 与 target id 取 `code name`，并将其作为 display path：`CollaborationOwnerService.java:216-221`、`OrganizationTaskPathService.java:230-231`。
- `STORE`：两侧都从 store 的 `project_id` 建立组织 ancestor path，再追加 `store.code || ' ' || store.name`：`CollaborationOwnerService.java:188-203,222-228`、`OrganizationTaskPathService.java:198-205,232-244`。
- owner final join 使用 node type + node ref：`CollaborationOwnerService.java:234-235`；edge 对外部 `COMMERCIAL_GROUP` 做唯一的 `COMMERCIAL_GROUP -> GROUP` canonical type normalization：`PlatformExternalCollaborationController.java:300-320`。

我也反例核对了 `persistedTaskPathsSql()` 的 REGION/PROJECT target-row join 没有显式写 `node.node_type=requested.target_type`，而 owner seed join 写了 `requested.node_type=node.node_type`：`OrganizationTaskPathService.java:190-205`、`CollaborationOwnerService.java:183-187`。该差异只使 owner-side projection 对错误的跨类型 nodeRef 更严格；对批准的 typed node candidate（五类有效目标）不改变 ancestor、display name/path 或 scope 语义，也没有形成另一条有效业务路径。因此本轮不把这个 invalid persisted-state edge case 计为 M/S/N finding。当前 owner binding 的 `node_type/node_ref` 本身是 opaque facts，数据库也没有跨 owner FK：`apps/backend/catering-business-server/src/main/resources/db/migration/V20260819_230000_000__collaboration_owner.sql:30-58`；若未来要承诺任意手工写入的错配事实也必须可读，应另开数据完整性决策与验证，不在本轮扩大范围。

### 3. COUNT、排序分页、参数顺序与 path acceptance regression — `CONFIRMED`

- production binder 的前三个 owner scope/provider 参数及五组 organization scope 参数按 SQL placeholder 顺序绑定，四个相同 LIKE pattern 后绑定 pageSize、offset：`CollaborationOwnerService.java:241-269`。
- focused contract test 保留了 owner scope、`COUNT(*) OVER()`、recursive CTE、`node_paths`、organization node、node display name/path、`LIMIT/OFFSET` 与 cursor predicate 禁止断言，并校验 path-related parameter positions `4..20` 及 `pageSize=21/offset=22`：`apps/backend/catering-business-server/modules/collaboration/src/test/java/com/catering/v2s/collaboration/application/CollaborationOwnerContractTest.java:124-190`。
- acceptance regression 从真实 owner readback 的 `nodeDisplayPath` 取祖先 segment，而不是只取 leaf；它要求 path 至少包含 ancestor + leaf、两者不同，并验证过滤后的 binding item 与真实 metadata.total：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java:183-220`。

所以当前代码不是只增加字符串存在性：path projection 进入 SQL filtered relation，window count 与 Page members 共用该过滤关系，acceptance source 也真实构造祖先/path query。由于本轮禁止 Testcontainers/HTTP，以上 acceptance 只作为静态 regression source proof，不作为动态 PASS。

### 4. 静态回归

| 项目 | 状态 | 独立重开证据 |
|---|---|---|
| `S2` Provider/System status command、required version、command/readback retry 分离 | `CONFIRMED` | `apps/frontend/platform-admin/src/features/external-collaboration/ui/ProviderProfileDetail.tsx:35-67,87-105,137-154`; `apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalSystemDetail.tsx:86-118,141-195`; generated mutation `apps/frontend/platform-admin/src/app/api/generated/platform-edge.rtk.ts:724-727` |
| `N1` ProviderProfileView.version → generated wire/type → UI expectedVersion | `CONFIRMED` | schema required version `contracts/openapi/components/collaboration/collaboration.schemas.json:115-184`; owner readback/mapper `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/api/CollaborationReadback.java:33-48`, `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/ExternalCollaborationWireMapper.java:94-105`; generated/UI `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/ProviderProfileView.java:4-15`, `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:1218-1229`, `ProviderProfileDetail.tsx:45-56` |
| `M1` selected-store equality guard、same-project foreign-store negative acceptance、owner read projection | `CONFIRMED` | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java:452-474`; sibling fixture `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java:623-669`; negative business oracle `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java:304-418,494-498` |
| `N-COUNT` source count、44 baseline + 16 new、catalog 登记、退役机制未恢复 | `CONFIRMED` | independent static count `rg -n '@AcceptanceScenario' apps/backend/catering-business-server/src/test/java` = `60`; domain registration `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java:9-27`; design/plan `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md:411-454`, `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md:243-274`; active standard forbids provider/registry/196 shells `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md:30-54,104-116` |

### 5. 只读静态证据与禁止动作 — `CONFIRMED` / dynamic evidence `UNVERIFIED_REQUIRES_EVIDENCE`

本轮实际执行的只读检查：

```text
node scripts/check/external-collaboration-business-channel-contract.mjs
EXTERNAL_COLLABORATION_CONTRACT_PASS systems=4 providers=7

node --test apps/frontend/platform-admin/src/tests/architecture/external-collaboration-collection.test.mjs
3 pass, 0 fail

rg -n '@AcceptanceScenario' apps/backend/catering-business-server/src/test/java | wc -l
60
```

没有执行 Gradle/Testcontainers、DEV、reset、seed、HTTP、browser、L2、UAT 或外部联调。作者 checklist 中的 Gradle PASS 未被本轮当作独立动态证据；本 verdict 的 GO 依据是当前 source、契约与只读静态检查。

## 工具边界记录

本仓官方 `scripts/context/recall-memory` 与 `scripts/memory/query` 均因现存 literal owning-heading drift 返回：

```text
PROJECT_MEMORY=FAIL
REASON=missing literal owning heading: doc/platform/implementation-task-template.md:## 正本(逐字复制以下代码块)
```

按 local `cs-memory-recall` 规则保留首败，不重复同一失败信号，不修改 memory/tooling；改用当前 `project-memory/index.json` 做确定性 review 路由并读取所有命中原文，再由当前 owning source、契约与静态检查作最终判断。该工具边界未被伪装成 implementation PASS，也不改变本轮静态 verdict。

## 最小后续建议

维持当前 `GO` 的静态边界。下一次获得独立 runtime 授权时，只需按受管入口执行 focused `collaboration.binding-page-searches-node-name`，验证 ancestor segment 在真实 PostgreSQL 上命中且 metadata.total 与 page rows 一致，并独立记录 business/cleanup；不要把本 verdict 扩展为 DEV、UAT 或外部联调授权。
