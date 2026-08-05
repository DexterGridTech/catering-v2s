# S1 contract/generated-wire reconciliation — independent implementation review Round 1

REVIEW_CYCLE_ID=WHOLE-ENGINEERING-CONTRACT-GENERATED-WIRE-20260805
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2

```yaml
REVIEW_CYCLE_ID: WHOLE-ENGINEERING-CONTRACT-GENERATED-WIRE-20260805
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
runtimeAuthority: false
seedResetAuthority: false
dynamicEvidence: NOT_RUN_BY_AUTHORIZATION
verdict: NO-GO
counts: M1/S1/N0
```

## Blind-review declaration

I received the S1 checklist in a fresh subagent context and first tried to falsify the
implementation and generated consumers. I formed the findings and verdict before reading any
author intake, Claude review, or author disposition for this review cycle. The active package
input, design, delivery manifest, focused static proof, and the production sources named by the
package were read as review inputs; those artifacts were not accepted as proof when contradicted
by a fresh compile or semantic contract inspection. I did not read prior RP-02a review verdicts.
No DEV, HTTP, L2, Testcontainers, seed, reset, UAT, or Git action was performed.

## Review boundary and expected behavior

This review covers the authorized S1 static package only: R5 materialization, generated OpenAPI,
generated Java/TypeScript consumers, the diagnostic workload/tests, and the owner/controller
readback boundary needed to validate the contract. The package is static-only; business and
cleanup evidence must therefore remain `NOT_APPLICABLE`, and this review does not turn any static
result into a runtime or L2 claim.

The expected contract is the accepted U27 scope model: `WorkspaceSessionEntry.scopeContext` is
the owner-confirmed four-selection mirror (`region`, `project`, `store`, `headCompany`), navigation
may require `HEAD_COMPANY`, create commands derive project scope from the server session rather
than a client `projectId`, and invitation cancel/reissue preserve the explicit
`expectedContextVersion` body precondition. Generated consumers must compile against the existing
owner wire mapper.

## Required input checklist

The following were read before this verdict. Hashes are SHA-256 of the bytes in this worktree.

| Required input | Path / command | SHA-256 or output | Result |
| --- | --- | --- | --- |
| Repository instructions | `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` | `READ` |
| Claude entry | `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | `READ` |
| Blueprint | `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d3` | `READ` |
| Current roadmap | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` | `READ; CURRENT_STEP=RM1-P6-3` |
| Review governance | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` | `READ` |
| Verification governance | `doc/decisions/2026-07-24-v2s-verification-governance.md` | `c9632a65f9eac7678a4be919d980894e3f1e71e5e2e1ddce70ea3c7091d829dc` | `READ` |
| Standards matrix | `contracts/policy/standards-coverage-matrix.json` | `b0519ea0e8691b204fc41f9a481665f381e067c1bf4f002b7913171476b149` | `READ; scripts/check/standards-coverage --phase R5` |
| Active package input | `doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-package-input.md` | `31db2c772dc6aaad699c8484518da4342f10e16440a4ba8637df4e71671681c8` | `READ` |
| Delivery manifest | `doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-delivery-manifest.json` | `c8ee0d02831057b6c514a9e4f27aceb5a86c94295dec671e46eadcdbc01cb746` | `READ` |
| Implementation design | `doc/plans/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-implementation-design.md` | `ff0b0d86653ddbda8ebcda0c4577c4a00261fff9de69c9d5d774b125987353eb` | `READ` |
| Active compliance package | `.runtime/compliance-control/active-package.json` | `317a9f318479eb862c37c85304cb16e001e4ce1cd5e4a4acedb4388dae7879a4` | `READ` |
| Focused static proof | `doc/evidence/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-focused-static-proof.json` | `db593ae663a9be1b6ee31f4b1b336be8ce8e94453f44c098d713e7414fac071e` | `READ; independently challenged` |
| U27 amendment | `doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-implementation-amendment.md` | `9bba71c706476e78a5186c9ff106915572619ffc8be1c3ffa75dee058d71e238` | `READ` |
| U27 package exit | `doc/evidence/platform/rm1/p6/rm1p6-data-scope-context-u27-package-exit.json` | `4203797c9c6b00e005b587a66fe3009c85fdbd40e08270cce07cddf5c1b65e70` | `READ` |
| Problem family | `doc/evidence/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-problem-family.json` | `a3437640a19685155891198aa6a1be54655e932f5b33c4ce3a1ceec488cf8539` | `READ` |
| Contract catalog | `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` | `4ba5707f39ef35051c6d6b5e836a1298f50cf9e8df000c1302744c0c931e2152` | `READ` |
| Materializer | `scripts/generate/r5-edge-materialize.mjs` | `f16754c3d3855c888347ad2bbc49e3ed72890b2ef6f76ad4d2a8d35e86ff2f20` | `READ` |
| Edge codegen | `scripts/generate/edge-codegen.mjs` | `176fc90d04a876a456b882e5d7c059d65decaed10932ba36ad37ae5210d84529` | `READ` |
| Route/workload sources | `scripts/test/http-diagnostic-workload.mjs` / `.test.mjs` | `a931595006db5fed332dce802791fcc39f485973c4eb110b25585b33398a4ebc`, `56fd3a78166d36acf841d867850268fb443f90dccfadf2a3036377ab8d769cdc` | `READ` |
| Contract components | `contracts/openapi/components/workspace-iam/workspace-session.schemas.yaml`, `workspace-access.schemas.yaml`, `organization/store.schemas.yaml`, `contract/contract.schemas.yaml` | `28f30a5b7843bf86e3b11bd2c984a5ec65c5a44a3fdffe71b2888e5d8d46b05b`, `2b5af2dce31c45b2bf95adb2f964102b1ac037fbbe5e546352c76e215dafa12a`, `42e13e183cbb8bc494eda434b5e595223122151c4962008adb74edf5abb0b313`, `19ed2f73619366e935b7eb4371fdc71cb29c68006b2e85d084eac76cd7970911` | `READ` |
| Generated Java | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/{WorkspaceSessionEntry,WorkspaceScopeContext,WorkspaceOperationsInvitationActionRequest}.java` | `aeb1cd1ba39132d091d8f577337be844457746780aa87a1ca370ede258e32516`, `d329f83e5f20c61077c469007d31becbcf90bd0050c00dffe12cb0873d5b41fe`, `cf6a5b38d7d2b4b90d4ada8a7de1dc8126721e5b1ae745efbc0017303be41326` | `READ; compile challenged` |
| Generated TS | `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts` | `5e1609e20b56f7fa08c6c16797909f2e0d2bbb5f0f32e5fe86a57279058661e3` | `READ; typecheck` |
| Owner readback | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceSessionEntryReadback.java` | `452726eb0381048a10929cbe33017a47c74c450c2c8de9fd0e1f56c4d98a0926` | `READ` |
| Owner/session consumers | `.../operations/session/WorkspaceSessionWireMapper.java`, `.../operations/session/OperationsSessionResolver.java` | `6a96e6ce8b044f1bb64f7549acb102c19922019e50d4255581ae5c4584e81d75`, `fc890fdba9e096be8d626ee759995e2f49798ea652f8b039e760692e9c79b786` | `READ` |
| Owner command consumers | `.../operations/access/OperationsWorkspaceInvitationController.java`, `.../operations/organization/OperationsStoreManagementController.java`, `.../operations/contract/OperationsContractController.java` | `fb67babea1764097068bd17f01a5ba3b45d8ffcec6b09fef48d1127b62ca4490`, `f0220937eeca8405fefc9570ca3c63cc58298a6a14145ea8efb461bf0ef07ee1`, `9f2286ed561bb16c0136319faeeff042078a5385ab725d90c27b7c0d233617bb` | `READ` |
| All kernels | `project-memory/kernel/{01-workspace-and-roadmap,02-service-shape-and-owner,03-transaction-data-and-dependencies,04-contract-consumer-and-admin,05-evidence-runtime-and-git,06-heritage-and-change}.md` | `f8add1ef...`, `45a26072...`, `f01d8e4e...`, `1f6d9efb...`, `f5e21965...`, `5c52b17a...` | `READ_ALL` |
| Routed memory | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact governance --trigger task-start` | output SHA-256 `4ae0834903a4ea021ced25b4d7459396052c9ea662889d7c92a365aa8b1ae30c` | `RUN; all refs read` |

The abbreviated kernel hashes above are prefixes only; the route output hash is over the complete
JSON output. The complete paths and bytes were read from the command output. The applicable routed
operations were also read: `project-memory/decisions/deterministic-context-only.md`;
`project-memory/decisions/http-crud-efficiency-design-redlines.md`;
`project-memory/decisions/distributed-topology-is-not-current.md`;
`project-memory/operations/claude-review-handoff-standard.md`;
`project-memory/operations/verification-governance.md`;
`project-memory/operations/dev-command-separation.md`;
`project-memory/operations/roadmap-control-transfer.md`;
`project-memory/pitfalls/log-first-failure-retry.md`;
`project-memory/operations/business-corpus-adoption-and-read-policy.md`;
`project-memory/operations/business-corpus-parked-domain-intake.md`;
`project-memory/operations/phase-retrospective-and-systemic-repair.md`;
`project-memory/operations/implementation-source-reread-discipline.md`; and
`project-memory/operations/incremental-compliance-hook.md`.

## Fresh checks

| Check | Result |
| --- | --- |
| `scripts/check/r5-edge-materialize --check` | PASS; 154 operations, face counts 50/92/12 |
| `scripts/check/r5-edge-materialize --self-test` | PASS; real red mutations include JSON pointer, nested forbidden property, relative ref, capability, and path/component drift |
| `scripts/check/edge-codegen --check` | PASS; 253 generated files |
| `scripts/check/edge-codegen --self-test` | PASS; real red mutations include controlled write, route registry, OpenAPI security, untyped wire, Java/TS drift, and catalog drift |
| `scripts/check/openapi-contracts` | PASS |
| `scripts/check/contract-face` | PASS; `STATE=POST_GATE_0` |
| `scripts/check/standards-coverage --phase R5` | PASS; 150 rules |
| Focused Node suite from S1 proof | PASS; 40/40 tests |
| `yarn --cwd apps/frontend/operations-admin typecheck` | PASS; exit 0 |
| `node --check scripts/generate/r5-edge-materialize.mjs` | PASS |
| `gradle :apps:backend:catering-business-server:compileJava --no-daemon --console=plain` | **FAIL on first attempt**; two generated-wire type errors below |

The backend compile was not retried blindly. Its first failure was retained and traced to the
generated Java declarations: `WorkspaceSessionWireMapper.java:19` passes
`WorkspaceScopeContext` to a `WorkspaceSessionEntry` constructor whose generated field is
`tools.jackson.databind.JsonNode`, and `WorkspaceSessionWireMapper.java:35` passes four
`WorkspaceScopeNode` values to a generated `WorkspaceScopeContext` constructor whose fields are
`JsonNode`. Gradle reported both as incompatible-type errors.

An independent scratch copy was also tested: after a clean materialization check passed, appending a
newline to `components/organization/store.schemas.yaml` made the check fail with
`R5_EDGE_GENERATED_OUTPUT_DRIFT:components/organization/store.schemas.yaml`. This confirms the
drift gate can detect that mutation; the scratch copy was outside the repository and no source
mutation was made by this review.

## Findings

### M-01 — generated Java session wire does not compile with the owner mapper

```yaml
status: CONFIRMED
severity: M
owner: scripts/generate/edge-codegen.mjs + generated wire outputs
```

The generated `WorkspaceSessionEntry` declares `scopeContext` as
`tools.jackson.databind.JsonNode`, while `WorkspaceSessionWireMapper.scopeContext(...)` returns a
generated `WorkspaceScopeContext`. The generated `WorkspaceScopeContext` likewise declares all
four fields (`region`, `project`, `store`, `headCompany`) as `JsonNode`, while the mapper supplies
`WorkspaceScopeNode` values. The owner readback is explicitly typed as the same four
`VisibleDataNodeCandidate` selections, so this is not an optional/nullable mismatch or a harmless
wire broadening. A fresh production `compileJava` failed at exactly those two constructor calls.

Root cause is in `edge-codegen.mjs`: `javaType()` resolves a direct `$ref`, but an `allOf` containing
one `$ref` falls through to `JsonNode`; `resolvedSchema()` is used for component generation but is
not applied to property type selection. The materialized contract uses `allOf: [{ $ref:
"#/components/schemas/WorkspaceScopeContext" }]` for `WorkspaceSessionEntry.scopeContext`, and
the context fields similarly use `allOf` references. The focused static proof did not include
`compileJava`, so its PASS cannot close this production compile failure.

Recommended minimal repair: keep the owner mapper untouched and repair the contract/codegen path so
a single-reference `allOf` emits the referenced generated type (or materialize those fields as
direct `$ref` where the catalog permits), regenerate Java and TS, then add the backend compile to
the focused proof. Do not hand-edit generated Java or widen the owner boundary to `JsonNode`.

### S-01 — `HEAD_COMPANY` is absent from nested navigation `requiredDataNodeType`

```yaml
status: CONFIRMED
severity: S
owner: scripts/generate/r5-edge-materialize.mjs / WorkspaceSessionEntry projection
```

The accepted catalog declares `WorkspaceSessionEntry.enumAdditions.requiredDataNodeType` with
`HEAD_COMPANY`, and the U27 amendment requires HEAD_COMPANY pages to be represented and guarded by
that value. The materialized nested navigation objects in both candidates and selected instead
contain only `NONE`, `REGION`, `PROJECT`, and `STORE` (OpenAPI lines 451-458 and 630-637); the
generated TypeScript repeats the same four-value union (lines 1535 and 1556). The owner readback
already preserves `requiredDataNodeType` as a string and handles `HEAD_COMPANY` in
`ScopeContext.selectionFor`, so the owner behavior and contract disagree.

Root cause is ordering: `addEnumValues()` runs while the session component still contains a
reference to the inherited navigation schema, then `inlineMissingReferences()` later replaces
that reference with a fresh source schema carrying the old enum. The current self-test has no
semantic assertion for this nested enum, so all mechanical gates can pass while a valid owner
HEAD_COMPANY navigation value is rejected by the generated consumer/contract.

Recommended minimal repair: apply enum additions after reference inlining or add an explicit
nested override for both candidate and selected navigation, without globally adding HEAD_COMPANY to
unrelated enums. Add a focused assertion and a red mutation proving the nested enum is enforced.

## Independently confirmed alignment (not findings)

- The forbidden-property exception is finite: `expectedContextVersion` is preserved only by
  `WorkspaceOperationsInvitationActionRequest`; the generated create request components do not
  expose `projectId`.
- Store and contract create controllers derive `projectId` from the selected server session and
  pass it to the owner command; the request body does not supply it. This matches the package
  requirement and the diagnostic workload's create bodies.
- Invitation cancel/reissue controllers require `body.expectedContextVersion`, and generated
  Java/TS action requests retain it alongside `expectedVersion` and `idempotencyKey`.
- No `selectedDataNode` field remains in the generated session contract or generated consumers;
  `dataNodeCandidates` plus the owner-confirmed `scopeContext` are the current wire shape.
- The workload's project-id query use is limited to the catalog-declared platform candidate/
  overview reads; no forbidden project-id body was found in the reviewed create flows.
- The package manifest sets runtime and seed/reset authority false. No changed S1 surface is a
  runtime, migration, seed/reset, DEV, UAT, browser-runner, or L2 implementation surface. The
  Gradle command above was a static compile diagnostic only; it is not a runtime or business
  result.

## Reasonableness and smallest repair

The overall S1 approach is reasonable: a catalog-owned materializer, generated edge consumers, and
source-bound workload checks are the smallest coherent way to reconcile contract and consumers
without adding runtime adapters or altering owner authority. The two failures are implementation
defects in that approach, not a reason to introduce a second contract or client-supplied project
scope. The smallest safe path is to correct single-reference `allOf` type resolution and apply the
existing narrow enum addition after inlining, regenerate, rerun static gates/tests, and add
`compileJava` plus the nested enum assertion to the package proof.

## Verdict

**NO-GO (M1 / S1 / N0).** The implementation cannot receive an implementation GO or package exit:
the generated Java production boundary does not compile, and the generated session contract omits
the accepted `HEAD_COMPANY` navigation value. Static materialization, codegen, OpenAPI, workload,
and TypeScript checks remain useful evidence, but they do not override either confirmed finding.

```yaml
REVIEW_CYCLE_ID: WHOLE-ENGINEERING-CONTRACT-GENERATED-WIRE-20260805
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: NOT_FINAL_ROUND
reviewerKind: INDEPENDENT_SUBAGENT
AUTHORIZATION_BOUNDARY: static S1 contract/generated-wire review only; no source fixes, runtime, DEV, seed/reset, HTTP, L2, UAT, or Git
```

## 用户任务

业务用户需要在 operations-admin 中按 owner-confirmed scope 打开正确页面、选择
HEAD_COMPANY 页面并完成邀请、门店和合同操作；本轮只审静态 contract/generated-wire 是否能
支持该用户任务，不把缺少运行授权误报为业务 PASS。

## Dexter 立场

Dexter 要求一个 deployable、owner 保有事实与命令主权、projectId 由服务端 session 推导，
并要求独立反证先于作者处置；因此本轮保持 S1 静态边界，不通过扩展 runtime/L2 来掩盖生成物
编译失败。

## 替代方案

可用更大的替代方案是在 owner mapper 或 runtime 增加 `JsonNode` 适配层，或让前端自行补
HEAD_COMPANY；不选这些方案，因为它们扩大 owner/运行边界并复制契约事实。推荐更小的修复是
修正 single-reference `allOf` 的 codegen/materialization 类型映射、在 inline 后补窄 enum，
再重新生成并加入 compile/semantic proof。

## 方案合理性

问题、方案、代价与收益已重新核对：catalog-owned materializer + generated consumers 是
最小一致路径，修复 codegen 顺序与类型映射的复杂度低于增加 runtime adapter，且能直接消除
当前 M/S 缺陷。静态 evidence 不能替代 backend 编译或有效枚举的事实核验。

## UI 与交互

NOT_APPLICABLE：理由：不涉及 UI 实现或浏览器交互授权；只核对批准 Journey 所需的 navigation
`requiredDataNodeType` 与 `scopeContext` wire 语义。不得把当前 TypeScript typecheck 当作
用户行为或 L2 证据。

## 审查意见复核

本轮未读取 author self-review、Claude review 或 author disposition；没有外部 finding 可盲目
接受。M-01 与 S-01 均由我重新打开 source、generated output、owner readback 和 fresh command
证据核验，状态分别为 `CONFIRMED`，并检查了反例、适用边界与更小修复；未确认的风险没有升级
为 finding。

## 实施代码核验

已重开实施源码和 generated Java/TS：`WorkspaceSessionWireMapper`、owner
`WorkspaceSessionEntryReadback`、三类 operations controller、materializer、codegen、OpenAPI
components 与 workload。已执行编译、40 项 focused tests、materializer/codegen/openapi/contract-face/
standards gates 与 operations-admin typecheck；backend compile 首败为 M-01。业务用户行为、
Journey 业务结果与 cleanup 仍为静态授权边界外（`NOT_APPLICABLE`），没有动态结果冒充闭环。

## 闭环核验

生成路径、forbidden-property exception、server-derived project scope、invitation context
version 和 selectedDataNode removal 均完成静态核验；但 package exit 仍不能关闭，因为 generated
Java compile 与 HEAD_COMPANY nested enum 尚未通过。runtime、DEV、seed/reset、HTTP、L2、UAT 与
Git 均未执行。

## 结论

VERDICT=NO_GO；M1/S1/N0。M-01 必须先修复并以 backend compile evidence 证明，S-01 必须以
nested enum semantic assertion 证明，之后才可进入本 review cycle 的下一轮定向复核。
