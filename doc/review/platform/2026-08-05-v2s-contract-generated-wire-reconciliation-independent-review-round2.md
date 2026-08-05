# S1 contract/generated-wire reconciliation — independent implementation review Round 2

REVIEW_CYCLE_ID=WHOLE-ENGINEERING-CONTRACT-GENERATED-WIRE-20260805
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

```yaml
reviewerKind: INDEPENDENT_SUBAGENT
runtimeAuthority: false
seedResetAuthority: false
dynamicEvidence: NOT_RUN_BY_AUTHORIZATION
verdict: GO
counts: M0/S0/N0
```

## Blind/reopen declaration

This is the hard-stop second round of the same review cycle, not a third review. I reopened the
production source, generated artifacts, package manifest, changed-path evidence, and the two
Round-1 findings directly. I did not treat the remediation summary as proof: the single-reference
wire types and post-inline enum semantics were checked from current bytes, and the commands were
run again (including a forced `--rerun-tasks` backend compile). No new author self-review,
Claude disposition, or unrelated review cycle was used to manufacture a GO. No DEV, HTTP, L2,
Testcontainers, seed, reset, UAT, or Git action was performed.

## Review boundary and expected behavior

The authority remains the S1 static contract/generated-wire package only. `WorkspaceSessionEntry`
must expose the owner-confirmed `scopeContext` with four nullable `WorkspaceScopeNode` selections;
both candidate and selected navigation must accept `HEAD_COMPANY`; invitation cancel/reissue must
retain `expectedContextVersion`; store/contract creates must derive project scope from the server
session; and generated Java must compile against the existing owner mapper. Business and cleanup
remain `NOT_APPLICABLE_WITH_REASON` under the package manifest.

## Reopened inputs and hashes

The Round-1 checklist and all repository instructions remain in force. The following current bytes
were reopened for this final round; hashes are SHA-256 from this worktree.

| Input | Path | SHA-256 / command output |
| --- | --- | --- |
| Round-1 artifact | `doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-independent-review-round1.md` | `2962c3649224b9fde105762b846432dba9918790aef2d21a5c809029c81b08f6` |
| Package input | `doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-package-input.md` | `31db2c772dc6aaad699c8484518da4342f10e16440a4ba8637df4e71671681c8` |
| Delivery manifest | `doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-delivery-manifest.json` | `c8ee0d02831057b6c514a9e4f27aceb5a86c94295dec671e46eadcdbc01cb746` |
| Current focused proof | `doc/evidence/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-focused-static-proof.json` | `1deee18b4ebc521adff98b87d467af3106cc3a940fe9ad37ed2baa157d76fe49` |
| Implementation design | `doc/plans/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-implementation-design.md` | `ff0b0d86653ddbda8ebcda0c4577c4a00261fff9de69c9d5d774b125987353eb` |
| Active package control | `.runtime/compliance-control/active-package.json` | `05c0d4e945d9c1b8e768a867af9a6b55714450bb6530e12f612caaf2d252e8ef` |
| Catalog / placement | `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` / `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json` | `2d2c78f0b1d66918034694a5f4d01f53f524d2a76056e266eb86cafa6004d53c` / `80085ced72ea24cc033f518a8d2508a4b845ed83a794f79b75ce7434c6485e48` |
| Materializer / control | `scripts/generate/r5-edge-materialize.mjs` / `scripts/check/r5-edge-materialize` | `74cf9bda5281a2ad087b7f2cfcc4a98e6a3d8061f2099baeb3d444908f62bd0a` / command wrapper re-opened |
| Edge codegen | `scripts/generate/edge-codegen.mjs` | `ae653c0bccb53b1bf4ae025ffb2777ec7715c9d14e80fc0746ceb1b093dfa2c9` |
| OpenAPI outputs | `contracts/openapi/components/{workspace-iam/workspace-session.schemas.yaml,workspace-iam/workspace-access.schemas.yaml,organization/store.schemas.yaml,contract/contract.schemas.yaml}` + `contracts/openapi/edge.openapi.yaml` | `9f91912ca9e7f28b24b07ec952722e6220c43d2b885039303c43149c65f3a76b`, `2b5af2dce31c45b2bf95adb2f964102b1ac037fbbe5e546352c76e215dafa12a`, `42e13e183cbb8bc494eda434b5e595223122151c4962008adb74edf5abb0b313`, `19ed2f73619366e935b7eb4371fdc71cb29c68006b2e85d084eac76cd7970911`, `b2f205dceb6121f0d5840eb94b0dac77afa770499e662b011ad7a5f60a4b532f` |
| Generated Java | `.../generated/wire/{WorkspaceSessionEntry,WorkspaceScopeContext,WorkspaceOperationsInvitationActionRequest}.java` | `853e9981733da7bd8c8bc9d34906cf873ec51c61427b0399747566d4c66970b6`, `9e2427cb2b7b30c542c5a2045308693e379d192a3844d0fea02810f6f5717f7d`, `cf6a5b38d7d2b4b90d4ada8a7de1dc8126721e5b1ae745efbc0017303be41326` |
| Generated TS | `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts` | `77b551b19f58dda1f49ac318e8a34213be9fd02c4c425d94b2a37a3aa80fdbe8` |
| Owner mapper/readback | `.../operations/session/WorkspaceSessionWireMapper.java` / `.../modules/workspace-iam/.../WorkspaceSessionEntryReadback.java` | `6a96e6ce8b044f1bb64f7549acb102c19922019e50d4255581ae5c4584e81d75` / `452726eb0381048a10929cbe33017a47c74c450c2c8de9fd0e1f56c4d98a0926` |
| Owner controllers | invitation, store, contract controller sources | `fb67babea1764097068bd17f01a5ba3b45d8ffcec6b09fef48d1127b62ca4490`, `f0220937eeca8405fefc9570ca3c63cc58298a6a14145ea8efb461bf0ef07ee1`, `9f2286ed561bb16c0136319faeeff042078a5385ab725d90c27b7c0d233617bb` |
| Diagnostic consumer | `scripts/test/http-diagnostic-workload.mjs` / `.test.mjs` | `a931595006db5fed332dce802791fcc39f485973c4eb110b25585b33398a4ebc` / `56fd3a78166d36acf841d867850268fb443f90dccfadf2a3036377ab8d769cdc` |

The inherited deterministic context was reopened with
`scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact governance --trigger task-start`;
its prior complete-output hash was `4ae0834903a4ea021ced25b4d7459396052c9ea662889d7c92a365aa8b1ae30c`.
The Round-1 report contains the full kernel/routed-memory checklist and hashes; no instruction or
review-cycle input was substituted in this round.

## Fresh command evidence

All authorized static checks passed on current bytes:

| Command | Result |
| --- | --- |
| `scripts/check/r5-edge-materialize --check` | `R5_EDGE_MATERIALIZE_CHECK=PASS`; 154 operations; 50/92/12 faces |
| `scripts/check/r5-edge-materialize --self-test` | `R5_EDGE_MATERIALIZE_SELF_TEST=PASS`; includes nested enum and full path/component byte red mutations |
| `scripts/check/edge-codegen --check` | `R5_EDGE_CODEGEN_CHECK=PASS`; 253 files |
| `scripts/check/edge-codegen --self-test` | `R5_EDGE_CODEGEN_SELF_TEST=PASS`; wire/TS/RTK/catalog/security/controlled-write red mutations |
| `scripts/check/openapi-contracts` | `R5_OPENAPI_CONTRACTS=PASS` |
| `scripts/check/contract-face` | `R5_CONTRACT=PASS; STATE=POST_GATE_0` |
| `scripts/check/standards-coverage --phase R5` | `PASS`; 150 rules |
| Focused Node suite from package | 40 tests, 40 pass, 0 fail |
| `yarn --cwd apps/frontend/operations-admin typecheck` | exit 0 |
| `gradle :apps:backend:catering-business-server:compileJava --no-daemon --console=plain` | BUILD SUCCESSFUL |
| forced `gradle :apps:backend:catering-business-server:compileJava --rerun-tasks --no-daemon --console=plain` | BUILD SUCCESSFUL; 11 tasks executed; only pre-existing deprecation warnings |
| `git diff --check HEAD -- <active S1 surfaces>` | exit 0 |

No command above started an application, browser, tunnel, database, seed/reset, or remote
resource. `business` and `cleanup` therefore remain `NOT_APPLICABLE_WITH_REASON`.

## Round-1 finding recheck

### M-01 — generated Java session wire compile failure

**Disposition: CONFIRMED_CLOSED.** Current OpenAPI emits direct nullable `$ref` properties for
`WorkspaceSessionEntry.scopeContext` and the four `WorkspaceScopeContext` selections. Generated
Java now declares `WorkspaceScopeContext scopeContext` and `WorkspaceScopeNode region/project/store/
headCompany`, exactly matching `WorkspaceSessionWireMapper` constructor calls. Both ordinary and
forced `compileJava` passes prove the production generated boundary is compilable. The owner mapper
and owner readback were not widened or edited.

### S-01 — nested `HEAD_COMPANY` navigation enum missing

**Disposition: CONFIRMED_CLOSED.** Current materialized OpenAPI contains `HEAD_COMPANY` in both
candidate and selected navigation enums; generated TypeScript contains the same value in both
unions. The materializer now applies `enumAdditions` after `inlineMissingReferences`, and its
self-test first asserts both enums include `HEAD_COMPANY`, then performs a red mutation that removes
the addition and fails closed. This directly verifies the former ordering failure and prevents
regression without broadening unrelated enums.

## Semantic and boundary checks

| Invariant | Current evidence | Result |
| --- | --- | --- |
| `scopeContext` typed, not `JsonNode` | generated Java lines 4-9; forced compile | PASS |
| `HEAD_COMPANY` nested navigation | OpenAPI has two enums; TS lines 1535/1556; materializer red test | PASS |
| No `selectedDataNode` | no match across reviewed OpenAPI/generated/workload surfaces | PASS |
| Create bodies omit client `projectId` | OpenAPI create schemas and workload exact-key assertions | PASS |
| Server-derived project scope | store controller resolves selected project; contract controller `scopedProject(session)` | PASS |
| Invitation context precondition | generated request retains `expectedContextVersion`; cancel/reissue require it | PASS |
| Forbidden-property exception | catalog preserves `expectedContextVersion` only for invitation action | PASS |
| Owner boundary | owner readback/mappers/controllers unchanged; no owner-source diff | PASS |

## Changed-path and package boundary

The current focused proof's `changedPathSet` was reopened and matches the package classes exactly:

- source truth: the implementation catalog, placement catalog, and `r5-edge-materialize.mjs`;
- contract outputs: the four affected component files and `contracts/openapi/edge.openapi.yaml`;
- generated consumers: the three generated Java records and operations-admin generated TS;
- generator control: `edge-codegen.mjs`;
- diagnostic consumer: the two workload files.

The active manifest forbids backend owner source, frontend business source, database/migration,
DEV/UAT/HTTP/L2, seed/reset, roadmap, and Git. A current diff scan found no changed path in those
forbidden surfaces. Existing unrelated RP-02a/S0 worktree files and Gradle cache churn were not
counted as S1 package changes; they were neither modified nor used as S1 evidence in this review.

## No new findings

Round2 found no remaining M, S, or N issue within the authorized package. Gradle emitted only
existing deprecation warnings; they do not affect compile correctness or package scope. No runtime,
business, cleanup, UI, or UAT claim is made.

## Reasonableness and smallest repair

The remediation is reasonable and minimal: direct nullable references make the generated Java type
match the owner mapper without a runtime adapter, and post-inline narrow enum application fixes only
the accepted session navigation fields. The alternative of adding `JsonNode` adapters or client
project scope would increase coupling and weaken owner authority, so it remains rejected. The
added self-tests and forced compile are proportionate proof for the two Round-1 failures.

## 用户任务

业务用户需要在 operations-admin 中按 owner-confirmed scope 打开正确页面、使用
HEAD_COMPANY navigation，并完成邀请、门店和合同操作；本轮确认静态契约与 generated consumers
能支撑该任务，未把静态结果冒充运行时业务结果。

## Dexter 立场

Dexter 要求独立反证、最小根因修复、owner 主权和严格 runtime/DEV/L2 边界。本轮按同一 review
cycle 的 Round2 limit 执行，结论由独立源码与命令 evidence 自决，不创建第三轮。

## 替代方案

可增加 runtime `JsonNode` 适配器、让前端补 HEAD_COMPANY，或让客户端传 projectId；不选这些
方案，因为它们扩大边界、复制事实或绕过 owner。当前 direct-ref + post-inline enum 是更小
且可回归验证的方案。

## 方案合理性

问题已经关闭；方案复杂度低、代价可审计、收益直接覆盖 Round1 的 compile 与 enum 反例，且
没有新增 runtime 依赖或 owner 写入路径。

## UI 与交互

NOT_APPLICABLE：理由：本轮没有 UI 实现或浏览器交互授权；仅核对批准 Journey 所需的
navigation enum 与 scopeContext wire 语义，不能以 TypeScript typecheck 代替用户行为/L2。

## 审查意见复核

Round1 的 M-01/S-01 已逐条重开 owning source、generated output、反例 self-test、compile 与
适用边界；两项均为 `CONFIRMED_CLOSED`。未收到新的外部 finding，不接受任何未重新核验的
作者断言；已比较更小修复与过度设计成本，当前方案无需扩大边界；没有第三轮独立审查。

## 实施代码核验

已重开真实源码中的 materializer、codegen、OpenAPI components/root、generated Java/TS、owner mapper/
readback/controllers 与 workload。40/40 tests、所有 R5 gates、frontend typecheck、普通及
forced backend compile 均 PASS；server-derived projectId、invitation context version、
selectedDataNode removal 和 changed-path boundary 均有 current-byte evidence。业务用户行为、
Journey 业务结果与 cleanup 在本静态授权下为 `NOT_APPLICABLE`。

## 闭环核验

S1 source/output/generated consumer/diagnostic sets match the focused proof and manifest; no
forbidden runtime or owner path changed; all mechanical gates and real red mutations pass. Static
package evidence is closed, while no runtime/UAT/business/cleanup closure is claimed.

## 结论

VERDICT=GO；M0/S0/N0。`ROUND_FINAL_DECISION=SELF_DECIDED`。这是静态 S1 package GO，不是 DEV、
HTTP、L2、UAT 或业务/cleanup GO；后续若要声称动态闭环，必须另行取得对应授权并运行受管
入口。

```yaml
REVIEW_CYCLE_ID: WHOLE-ENGINEERING-CONTRACT-GENERATED-WIRE-20260805
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: SELF_DECIDED
reviewerKind: INDEPENDENT_SUBAGENT
AUTHORIZATION_BOUNDARY: static S1 contract/generated-wire review only; no source fixes, runtime, DEV, seed/reset, HTTP, L2, UAT, or Git
```
