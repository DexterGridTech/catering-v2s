REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_REMEDIATION_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=AUTHOR_INTAKE_AFTER_INDEPENDENT_SUBAGENT
reviewerVerdict=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-remediation-independent-review-round-1-verdict.md
authorIntakeStatus=REPAIRED_STATIC_AWAITING_ROUND_2

# R5 外部协作与经营渠道 implementation remediation · Round 1 author intake

## Intake boundary

本 intake 在 fresh independent subagent Round 1 verdict 之后形成。作者重新打开了原始 Journey/IA、implementation-facing 详设、命中项目记忆、owning source 与 reviewer 点名的真实代码。所有结论均区分静态/编译/focused evidence 与未执行的动态证据；本次没有执行 seed、reset、DEV start/restart、Testcontainers、browser L2、UAT 或外部联调。六项 C（C-01、C-02、C-03、C-04、C-08、C-09）保持依赖态，没有由本 intake 偷做产品裁决。

## Finding-by-finding disposition

| finding | reviewer status | author intake | 根因与最小处置 | 产品/权限裁决 |
| --- | --- | --- | --- | --- |
| M-1 | `CONFIRMED` | `CONFIRMED_REPAIRED_STATIC` | candidate route 只调用 `requireStoreProjectPair`，未复用 selected-store equality。`requireScopedStore` 现在返回同一 organization owner projection，并由 pair guard 复用；新增同 project foreign-store candidate negative acceptance，拒绝发生在 owner facts 返回前。 | 不需要 Dexter 裁决；保留 session scope 与 project/store pair 两层判断。 |
| S-1 | `CONFIRMED` | `CONFIRMED_REPAIRED_STATIC` | P4 SQL 原先只搜 binding name/raw nodeRef，节点显示路径在 Page 之后才生成。query 分支现在以 provider-scoped `owner_bindings` 为输入，构造五类 organization node display projection，并让 node display predicate 与 binding name/nodeRef 同时参与 `COUNT(*) OVER()`、`LIMIT/OFFSET`；新增 node-name query acceptance。 | 不需要 Dexter 裁决；仍是 collaboration owner 的 task read，edge 只做 wire mapping。 |
| S-2 | `CONFIRMED` | `CONFIRMED_REPAIRED_STATIC` | P2/P3 detail query 的缺失状态原先被当作 loading，status mutation 的 typed problem 被丢弃。ExternalSystemDetail 与 ProviderProfileDetail 现在显示 `PlatformApiProblem`、保留旧 `currentData`、提供 query retry；status failure 还保留上次目标状态并可重试。 | 不需要 Dexter 裁决；未改变 owner typed problem 或 foundation transport 边界。 |
| N-1 | `PARTIALLY_CONFIRMED` | `CONFIRMED_REPAIRED_STATIC` | workspace system/provider view 的 `version` 已加入 source schema required；同时更新 R5 source hash catalog，materialize/codegen 后 generated TS 为 required；UI 删除 `system.version ?? 0`，catalog-only mapper 仍明确返回 `0L`。 | 不需要 Dexter 裁决；catalog-only 的 0 仍是明确的只读 catalog 事实，不是缺失回退。 |

## Post-Round-1 static proof

已完成的静态/编译/focused proof：

- `node scripts/generate/r5-edge-materialize.mjs`：`R5_EDGE_MATERIALIZE=PASS`，181 operations，faces `61/108/12`；
- `node scripts/generate/edge-codegen.mjs --write` 与 `--check`：`FILES=271`、`R5_EDGE_CODEGEN_CHECK=PASS`；
- `./gradlew :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:compileTestJava`：PASS；
- collaboration owner contract/policy unit：PASS；owner SQL contract 已断言 `COUNT(*) OVER()`、`LIMIT/OFFSET`、`organization.organization_node`、`owner_node_display` 与完整 query parameter binding；
- platform/operations frontend typecheck：PASS；platform architecture `13 pass/1 TODO`，operations architecture `26 pass/4 TODO`；
- OpenAPI、handler bindings、external collaboration contract、capability invariants、contract-face、query/backend/database boundaries、Flyway、module dependency、logging、code layout、name-code density、production conformity、frontend architecture：均 PASS；
- 仅本轮变更的 operations architecture test 已格式化并单文件 Prettier check PASS。全仓 format baseline 仍有未触碰的 `OperationsApp.tsx` 与 `OwnerBindingFormDrawer.tsx` 两个既有告警。

## Scope/count reconciliation

本轮为覆盖 P4 regression 新增 1 条 focused `@AcceptanceScenario`：`collaboration.binding-page-searches-node-name`，落在 collaboration domain。implementation 详设与串行计划已从原 14/58 同步为 15/59；当前 source baseline 仍为 44，硬上限仍为 80。不存在 provider shell、shared SPI、scenario registry 或 compliance-control 恢复。

## Evidence boundary and Round 2 request

当前结论为 `REPAIRED_STATIC_AWAITING_ROUND_2`。静态实现没有再发现待修源码缺口，但 Round 1 reviewer 要求的同 cycle Round 2 必须 fresh 定向复核：

1. candidate route 的 selected-store equality 与同 project foreign-store negative acceptance；
2. P4 node-name predicate 是否真的属于 owner Page 的 total/member selection，而非 page 后过滤；
3. P2/P3 typed query/mutation feedback、旧 readback 保留与 retry；
4. version source → materialized → generated → UI chain；
5. 六项 C 仍为依赖态，`PLANNED` 仍不是 enablement gate。

Round 2 是本 cycle 的最终独立子agent轮；不得召集第三轮，也不得把静态 proof、作者 intake 或后续 Claude review 当作动态 runtime/L2/UAT 证据。
