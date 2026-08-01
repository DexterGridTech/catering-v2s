---
title: RM1 P6-2 implementation adversarial review
status: NO_GO
programId: V2S_W0_W4_EXECUTION
packageId: RM1P6-U02
REVIEW_TARGET: IMPLEMENTATION
REVIEW_CYCLE_ID: RM1-P6-2-IMPLEMENTATION-20260730
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: SELF_DECIDED
reviewerKind: INDEPENDENT_SUBAGENT
reviewedAt: 2026-07-30
authorizationBoundary: Review only of current RM1 P6-2 bytes and authorized design evidence. It does not authorize any implementation, DEV, seed, reset, dynamic run, Roadmap mutation, repository-control action, P6-3 work, or package exit.
---

# RM1 P6-2 implementation adversarial review — round 1 record; round 2 final decision follows

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=RM1-P6-2-IMPLEMENTATION-20260730
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT

## 用户任务

业务用户需要在已选择集团空间边界内完成平台治理：只读核对组织/合同，维护角色、账号和扩展字段，并让每一次平台写操作由真正 owner 以授权、workspace 状态和当前事实重验。用户任务不是“让已有页面能发请求”，而是能用 IA-02/IA-03 批准的条件、详情与确认路径安全完成治理。

## Dexter 立场

Dexter 已批准 P6-2 的实现范围，但要求 owner-first、无浏览器推导、双后台隔离、真实 red control 及独立业务 review。Dexter 没有授权把空缺的用户任务、权限或证据用静态门绿和局部构建成功替代。

## 替代方案

替代方案一是只保留现有少量组织筛选，或由浏览器用已加载行补 source/project/brand/tenant；不选，因为这违反 owner truth。替代方案二是增加通用前端状态/权限层；不选，因为更大且不能补 owner recheck。取舍后的更小修复是补 owner-backed query/candidate 消费，并把既有 generated requirement 接入各 owner command。

## 方案合理性

问题在于治理界面和写命令缺少关键业务事实闭环，而不在于表格组件。方案应让 owner 返回筛选、总数、候选和授权结果；这以当前已有 owner query/receipt 模式完成，复杂度与防止跨空间/越权治理的收益相称。以 edge 全量物化或 session 有效代替 owner recheck，表面上更快，却把安全和规模代价转移给业务用户。

## UI 与交互

APPLICABLE。批准 Journey 要求用户从组织概览使用“来源、项目、品牌、经营租户”定位对象，再从名称链接进入只读详情；当前 UI 缺少这些操作。更短路径不是删除条件，而是由 owner-backed searchable Select 直接提供候选并在类型/空间切换时清空不适用值。该结论来自 IA-03，而非接口字段推导，不存在需要 Dexter 裁决的产品歧义。

## 实施代码核验

已重开当前生产源码：组织/合同 owner query、platform edge controller、generated platform consumer，以及 platform-admin 页面。源码确认组织和合同 owner 可产生同谓词 page/total，但 UI 未消费完整条件；并确认平台治理写的 capability/disabled-workspace/idempotency 路径缺口。已读取两份 managed remote evidence 的运行日志、manifest、business PASS 与 cleanup PASS；它们只运行组织及 workspace-IAM module 测试，不能证明此 package 的平台 edge/UI 用户行为。故实施代码和可执行 evidence 都不足以证明批准 Journey 的业务结果。

## 1. Independent-review protocol and input checklist

`reviewerKind=INDEPENDENT_SUBAGENT`

`blindReviewDeclaration=I received the task in a fresh v2s-rooted subagent context, first tried to falsify the current implementation and formed the findings and NO-GO verdict below before reading any author self-review or author finding disposition. No P6-2 author implementation self-review or package-exit artifact existed at the reviewed paths.`

`authorMaterialReadAfterIndependentVerdict=true`

The six-dimension route was run exactly as:

```text
scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact governance --trigger task-start
```

It returned the six kernel records and the routed review/governance/corpus records. Corpus search terms were `集团空间`, `组织`, `合同`, `角色`, `账号`, `扩展字段`, `platform-admin`; the applicable full corpus entries are G-01, G-02, G-05, G-07, G-09 and G-10. Their explicit non-inference boundaries were applied; no browser-side authorization or owner-fact inference was accepted.

| Required input | Path / command | SHA-256 or result | Read / result |
| --- | --- | --- | --- |
| AGENTS | `AGENTS.md` | `e4e3c9af4fb0dc46ce5403edadb6704d1d4a60dea186efc9cbe22dd62fddb347` | READ |
| Claude entry | `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | READ |
| Blueprint | `PLATFORM-BLUEPRINT.md` | `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` | READ |
| Current Roadmap | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `5476287821b966d28fb024ac400de7a6e1a86ff61b76c26a4667dd404d31c938`; Registry resolved active `V2S_W0_W4_EXECUTION` | READ_CURRENT |
| Exact package authorization | `doc/evidence/platform/rm1/p6/rm1p6-u02-implementation-amendment.md` | `fc30de6c8d68d76c7e58221f4f2e98feada898f51fc0b9f014b96a27497c48e2` | READ |
| Package binding | `doc/evidence/platform/rm1/p6/rm1p6-u02-package-input.json` | `891b231661b974f0fe6e8bf864cbeb201a73f231fd1a2b8c44a3e739b427226e` | READ; `status=ACTIVE_NOT_EXIT` |
| All kernels | `project-memory/kernel/01-workspace-and-roadmap.md`, `02-service-shape-and-owner.md`, `03-transaction-data-and-dependencies.md`, `04-contract-consumer-and-admin.md`, `05-evidence-runtime-and-git.md`, `06-heritage-and-change.md` | `f8add1ef…2bd63`, `45a26072…c032`, `f01d8e4e…5c44`, `1f6d9efb…fa88d`, `d0d75e54…65a05`, `5c52b17a…5566c` | READ_ALL |
| Routed records | `project-memory/decisions/{confirmed-business-language-corpus,deterministic-context-only,independent-subagent-adversarial-review,incremental-compliance-hook}.md`; `project-memory/operations/{business-corpus-adoption-and-read-policy,business-corpus-parked-domain-intake}.md` | index-declared hashes verified where applicable | READ_ALL |
| Applicable source refs | `doc/decisions/2026-07-24-v2s-{single-deployable-modular-monolith-service-shape,solution-reasonableness-review-policy,verification-governance}.md`; `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`; Roadmap and carry-over manifest refs | verification governance `c9632a65f9eac7678a4be919d980894e3f1e71e5e2e1ddce70ea3c7091d829dc` | READ_APPLICABLE |
| Decisions directory | `doc/decisions/` full title listing, then P6-2 applicable decisions | IA-02 `8d3821c8deaa5a7c0fa460e570b96247842d305daf387d6c59298d2fea442813`; IA-03 `88a26ba14ad8f0f4d314eab85f8848f49eb32592dae908edaca932f0fdc45d17`; independent-review decision `95b79f7c74a3f867e9fdfef6b9f0d63d9e51e50cb08abc905056307d9423d508` | TITLES_REVIEWED; relevant full texts READ |
| Reviewed design and manifest | `doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-granularity-manifest.json` | `d49830d5c3ed69eb836d2b21338a20c3ca4ced279239aadee886bd9284104be4` | READ_FULL; unit `RM1P6-U02` |
| Physical import contract | `doc/evidence/platform/rm1/p6/rm1-u09-physical-screen-import-contracts.md` | `29204acbbc30f6b4be35008a3016f8772ffe1aa006c844260a45cb607fc9acf4` | READ_FULL |
| Standards matrix | `contracts/policy/standards-coverage-matrix.json` | manifest-declared `7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3`; fresh `scripts/check/standards-coverage --phase R5` = PASS, 150 rules | READ_CHECKLIST |
| Current owner/edge/contract/UI objects | organization and store-contract task reads; platform organization/contract/extension/workspace-IAM controllers; `contracts/openapi`; generated platform edge; four requested platform-admin feature roots | representative current hashes: `PlatformReadPage.tsx=f00c21baf2a6cd9d002242f7f258ea42262e7da5aec58f61ea6683399bed7581`, organization controller `8c42e923b6729e56fab79ada2a2a0f920ea35702104f0dbd2c8ca01d4e2bb1da` | READ_CURRENT_BYTES |
| Latest two dynamic records | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1785382744557-13612/run-manifest.json`; `r5-tc-1785382848168-15656/run-manifest.json` and their `gradle.log`, `phase.jsonl`, `remote-result.json` | `2edf8a7d455d104dd71b514c4a0753477e0a9a956d0d36c663a5f143b113e737`; `080666a32aa8d30e7a431a8903dd3e5cd7de1e1ab11e2bcb2b1b09165b1989cd` | READ; both business PASS and cleanup PASS, with scope limits in F-02 |

## 2. Independent attacks performed before author-material comparison

1. Reconstructed the approved user tasks from IA-02/IA-03 rather than from the existing routes, then compared each visible search/control requirement with the generated request actually emitted by the UI.
2. Followed organization and contract filters owner → edge → OpenAPI/generated edge → `PlatformReadPage`, looking for a dropped filter, client full-list filtering, or a count predicate different from the page predicate.
3. Reopened platform workspace, role, account and extension flows looking for row-action bypasses, hand-written transport, client-derived authorization/total/candidate facts, and missing foundation primitives.
4. Treated remote managed runs as evidence objects: read their manifests, phase/log records and cleanup results; then compared the executed Gradle targets and source hashes with P6-2's required current-byte dynamic hierarchy-and-capability obligation.
5. Independently enumerated actual platform-admin tests and compared them with the physical screen-import contract's required sibling focused tests.

## 3. Findings (formed before author-material comparison)

### F-01 — CONFIRMED / M: organization overview drops four approved owner-backed filters and all owner candidates

IA-03 requires `IA03-ORG-OVERVIEW` to expose type, name/code, status, source, project, brand and tenant; project/brand/tenant must be owner-searchable choices, and the owner must revalidate all conditions with the same total predicate (`doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md:690`).

The implementation has the server path: the OpenAPI/controller/service accept `source`, `projectId`, `brandId` and `tenantId`, `OrganizationOverviewTaskReadService` returns owner `filterOptions`, and its page/count share the query predicate. But `PlatformReadPage.tsx:13`, `:78-80`, and `:50` define/render/send only `name`, `code`, and `status`; it neither renders nor sends `source/projectId/brandId/tenantId`, and it never consumes `organizationPage.filterOptions`. Thus the approved governance user cannot perform the four required searches at all. This is not an allowed simplification and must not be "fixed" by filtering a loaded page in the browser.

Smallest repair: consume the owner-returned filter candidates in searchable controls, clear category-inapplicable values on tab change, and include the selected values in the generated query. Add focused behavioral coverage for each condition, including a category switch and same-predicate total/readback scenario. The existing server-side owner implementation is a useful counterexample: it proves the missing behavior is consumer integration, not a reason to invent a client-side substitute.

### F-02 — CONFIRMED / S: required dynamic evidence does not cover the reviewed current P6-2 edge/UI behavior

`rm1p6-u02-package-input.json` declares `businessEvidenceObligation=REQUIRED_CURRENT_BYTE_DYNAMIC_HIERARCHY_AND_CAPABILITY`. The two latest managed records execute only `:modules:organization:test` and `:modules:workspace-iam:test`; their source snapshot is `167dc6e4…e40d3`, while neither run executes the business-server edge adapters, generated consumer, or platform-admin interaction. Their checked test classes include `OrganizationOverviewQueryTest` and `WorkspaceRolePageRequestTest`, both built on a recording `JdbcTemplate`, not a platform route/UI interaction. They correctly establish their own Gradle success, structured run state, log inspection, and cleanup PASS; they cannot establish the package's owner-to-edge-to-consumer hierarchy/capability behavior for these current bytes.

Smallest repair: after F-01 is repaired, produce one managed current-byte proof that crosses the relevant platform edge and owner persistence/authorization boundary, with a real hierarchy/capability case and separate business/cleanup PASS. Do not re-run merely to obtain a newer timestamp; bind the evidence to the repaired source bytes and read its logs.

### F-03 — CONFIRMED / S: the required focused consumer proof denominator is absent for the platform overview screens

The physical contract assigns sibling focused tests to `PlatformReadPage.tsx`, `OrganizationOverviewDetailDrawer.tsx`, and `ContractOverviewDetailDrawer.tsx`. No sibling test file exists. The only located `platform-read-boundary.test.mjs` is an architecture source-string scan: it checks that selected generated hooks/tokens occur and that `fetch`/a few disallowed tokens do not occur. It does not execute a user search, candidate selection, workspace change, detail readback, failed owner response, or the required filter-total behavior. `rm1p6-u02-package-input.json` also names focused platform-admin tests as required proof.

Smallest repair: add focused user-behavior tests at the declared screen paths (or revise the physical contract before implementation if another exact path is deliberately chosen). Tests must assert generated request arguments for all approved organization filters, owner total display, and error/empty separation; source-text assertions remain useful only as a mechanical supplement.

### F-04 — CONFIRMED / S: package is not an exit candidate, so it cannot receive an implementation GO

The package input is explicitly `ACTIVE_NOT_EXIT`, and `doc/evidence/platform/rm1/p6/rm1p6-u02-package-exit.json` is absent. The implementation manifest requires exact changed-file/non-empty receipt equality before package exit. This is a correct current state, not an accusation that an exit was falsely claimed; it nevertheless independently blocks a GO for this review target. No package-exit conclusion can be inferred from green partial tests, a standards-coverage PASS, or the two remote run manifests.

### F-05 — CONFIRMED / M: platform-administrator paging and filtering are edge-local full-list materialization

`PlatformAdminGovernanceController.list` first calls `service.listAdministrators()`, then removes non-matching entries, sorts the complete result and slices it in the edge (`PlatformAdminGovernanceController.java:42-47`). The owner method is itself unbounded (`PlatformAuthenticationService.java:254-257`). This directly contradicts the amendment's requirement that every list, filter and total originate with its owner and forbids edge-local full-list materialization. The owner-side role page is the relevant counterexample: it produces its page and total in `WorkspaceRoleService.page`.

Smallest repair: introduce a bounded platform-IAM owner page/query API carrying the approved filter/sort/pagination and a same-predicate total, then make the edge a direct mapper. Add a red test proving that the edge cannot obtain or slice an unbounded administrator list.

### F-06 — CONFIRMED / M: generated required capabilities are declarative only; the governed platform writes do not recheck authorization

The relevant OpenAPI/registry entries declare required capabilities and `OWNER_RECHECK_PLATFORM_IAM`. In the production path, `PlatformSessionResolver.requireActor` only validates an active session and produces an audit actor (`PlatformSessionResolver.java:25-32`). Platform-administrator write endpoints then pass that actor to the owner (`PlatformAdminGovernanceController.java:50-53`), while the owner methods use it for audit/invariants but do not consume a capability authorization dependency. The same structural break is present on selected-workspace account and role writes: `PlatformWorkspaceAccountController.java:40-42` and `PlatformWorkspaceRoleController.java:43-46` pass an audit actor; `WorkspaceAccountService.transitionStatus/revokeAssignment` and `WorkspaceRoleService.create/update/transitionStatus` do not perform the required platform capability recheck. The operations-specific account revoke path is a counterexample: it calls `WorkspaceCommandAuthorizationService.requireUserManagementAction`.

This is an authorization boundary, not merely missing test coverage: a valid session is not sufficient proof of each declared governance capability. Smallest repair: route the generated operation requirement into the owning command authorization boundary and add denial tests for every write family; do not infer permission from a UI menu or session validity.

### F-07 — CONFIRMED / M: required idempotency is validated at the edge but not executed for account status/revoke or role writes

Account status/revoke and role create/update/status accept/validate `Idempotency-Key` in their platform controllers, but the former passes no key into `WorkspaceAccountService` and the latter discards it before `WorkspaceRoleService` (`PlatformWorkspaceAccountController.java:40-42`; `PlatformWorkspaceRoleController.java:43-46`). Those owner methods have no receipt service. A CAS conflict is not an idempotency receipt: retrying a request after an unknown successful response cannot return the original success. The credential-reset path is the counterexample—it forwards the key into a receipt-backed service.

Smallest repair: make the owner command APIs receipt-backed and include the canonical request/actor scope required by the established receipt pattern; add duplicate-submit and result-unknown red cases for every affected command.

### F-08 — CONFIRMED / M: disabled selected-workspace protection is declared but not enforced on reviewed P6-2 platform routes

The overview and workspace-IAM contracts declare `PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED`. Yet account/role controllers resolve the workspace through `WorkspaceAdministrationService.require`, which queries by key without an enabled predicate (`WorkspaceAdministrationService.java:70-73`); organization/contract overview controllers use the equivalent `ContractTaskReadService.requireWorkspaceUuid` lookup. Subsequent owner calls receive a workspace UUID/key but no status fact. This leaves governed reads and writes reachable after the selected workspace is disabled. The existing password-recovery use of an enabled-status check is a counterexample showing that the owner fact is available.

Smallest repair: require an enabled workspace at every P6-2 selected-workspace task boundary (or pass a typed owner-checked context into the command/read API), and add denial/read-blocked focused proof. Do not make the browser's selected-workspace state the enforcement mechanism.

## 4. Checks that survived attack

- Organization and contract owner services do keep page/count predicates together; the organization test gives a limited mechanical check of that design.
- `PlatformReadPage` consumes generated RTK request builders and does not locally filter a full list. The problem in F-01 is omission of approved filters, not a client-side filtering violation.
- Current workspace/account/role flows retain name-link → detail → separately confirmed action rather than adding a row action column.
- Both reviewed remote manifests are well-formed managed runs: logs were read, business is PASS, and cleanup is independently PASS. Their limited scope is the reason for F-02, not a cleanup failure.

## 5. Author-material comparison after the independent verdict

After the NO-GO above was formed, the reviewer checked the available P6-2 author material. There is no P6-2 implementation self-review and no package-exit artifact. The available `rm1p6-u02-source-compliance-disposition.json` is a template/admission denominator, not execution evidence. Existing cross-scope Claude/recheck documents do not replace a P6-2 author implementation intake or current-byte package exit. Nothing in those later-read materials falsifies F-01 through F-04.

## 审查意见复核

CONFIRMED：独立源码分工在盲审 verdict 后提出的管理员 edge 全量分页、owner authorization recheck、idempotency 和 disabled-workspace 四类 finding，均已由本 reviewer 重开对应 controller、owner service、OpenAPI/registry 和反例路径复核，形成 F-05 至 F-08。证据来自当前源码而非 reviewer 断言；角色 owner page、operations revoke authorization 和 credential-reset receipt 是反例边界。适用范围限于 P6-2 declared platform governance operations。更小修复是复用 owner page/authorization/receipt/status-gate 模式，不为此引入通用前端权限层、MQ 或新平台。 

## 闭环核验

静态 standards coverage 为 PASS，但它不能裁决 F-01、F-05 至 F-08 的业务语义。remote evidence 的 business/cleanup 均 PASS，却未覆盖 platform edge/UI；package input 仍为 `ACTIVE_NOT_EXIT`，且无 receipt-equality package exit。因此 source、用户 Journey、动态 evidence 与 exit 分母尚未闭环。

## Round 1 historical conclusion

`VERDICT=NO_GO` (user-facing verdict: NO-GO)

`M=5 / S=3 / N=0`

The architecture contains useful owner-side predicate work, but the approved platform organization-search task is materially incomplete, several core governance boundaries remain declarative at the edge rather than enforced by owners, and the required current-byte focused/dynamic proof and package-exit evidence are absent. This review does not authorize a remedy; it identifies the smallest bounded path for the implementation owner to address within the already approved P6-2 scope. A second and final independent round may verify only the resulting targeted changes and evidence after the author performs its separate finding intake.

## 7. Round 2 final targeted recheck

`REVIEW_CYCLE_ID=RM1-P6-2-IMPLEMENTATION-20260730`

`REVIEW_ROUND=2`

`REVIEW_ROUND_LIMIT=2`

`reviewerKind=INDEPENDENT_SUBAGENT`

`ROUND_FINAL_DECISION=SELF_DECIDED`

`blindReviewDeclaration=Round 2 reopened current sources and run-scoped evidence directly against F-01 through F-08 before comparing the remediation problem-family record. The round-one findings remain historical inputs, not accepted facts.`

### Current input binding

| Input | Current SHA-256 / result |
| --- | --- |
| `rm1p6-u02-package-input.json` | `00ace69231e2151dceff90e109f0096b0ad17093c3043135555f9e9bab657caa`; still `ACTIVE_NOT_EXIT` |
| P6-2 amendment | `fc30de6c8d68d76c7e58221f4f2e98feada898f51fc0b9f014b96a27497c48e2` |
| P6-2 implementation manifest / physical screen contract | `6f831e291947ef4cebe3deaf4e116f8462e29e8aa77493376c2fbaf711cf0d56` / `29204acbbc30f6b4be35008a3016f8772ffe1aa006c844260a45cb607fc9acf4` |
| `PlatformReadPage.tsx` / `OrganizationOverviewFilters.ts` / focused sibling test | `98e7f29e3bd876257754fbe7fc49d8654d4b5dd252218c1031ddfa2e75d301ad` / `6d90a33b8f4df1a70bd7fd7e7bbdf825124f0872243bead314b881818dc831ce` / `cd0a555bac71f87774c87471eb6d9d4c283f4d2b43849f1ea5b12abc19314d2e` |
| Owner sources: platform IAM / workspace account / workspace role / workspace status | `49efb25d50d0606b55a750626748daccb39d2d26ccfffdd7676f3b6018559b1d` / `ea799ceca27917fe4e222c3a4d7504578c7c7d6a41819965d35bc0b24d40a368` / `293b4c85e85caccc8ddb8b22f7dabd26eacf87db693c68aeb65cb276a471b9dc` / `a0cd41270ddb60c56988a2ba101d3923171cfa20fd30e4e64ddaf12bfd7b308d` |
| Governance problem-family (including the frozen-role-model counterexample) | `e55579bc0323f81d50049d8f6e76d8057d1f6dfa1525adb1ecdf7736ab188abf` |
| Hierarchy managed run | `r5-tc-1785382744557-13612/run-manifest.json=2edf8a7d455d104dd71b514c4a0753477e0a9a956d0d36c663a5f143b113e737` |
| Final managed run | `r5-tc-1785384708048-56453/run-manifest.json=14d86c0c1a033cfd56708ad378a9597f404ef0cc1aae8ed61af632b2efaabbf1` |

The direct focused static test command was re-run without changing source or evidence: `yarn --cwd apps/frontend/platform-admin exec vitest run src/features/organization-contract-overview/ui/OrganizationOverviewFilters.test.ts` => `1 passed`, `5 passed`.

### F-01 through F-08 disposition

| Finding | Round-2 disposition | Independent recheck |
| --- | --- | --- |
| F-01 | `REJECTED_WITH_EVIDENCE` | `PlatformReadPage` now renders `source` and the STORE-only owner-returned project/brand/tenant candidates, and calls `organizationOverviewQuery(...)` for the generated request. The focused test proves all four arguments, a drop-filter red mutation, non-STORE clearing, owner-only candidates and the request binding. |
| F-02 | `PARTIALLY_CONFIRMED` | Both managed manifests have read logs, matched process identity, `firstFailure=null`, business PASS and cleanup PASS. The hierarchy run proves the persisted organization hierarchy/same-predicate filters; the final Testcontainers run proves workspace account receipt replay, disabled-workspace rejection and role-write disabled rejection. They do not execute the business-server platform edge or a rendered platform-admin user journey, so they do not wholly discharge `REQUIRED_CURRENT_BYTE_DYNAMIC_HIERARCHY_AND_CAPABILITY`. |
| F-03 | `REJECTED_WITH_EVIDENCE` | The required real sibling file now exists adjacent to the overview UI and directly passed five Vitest cases. It is focused request/candidate behavior rather than an architecture-only scan. Its omission from the package's default `yarn test` script is recorded as a closure limitation under F-02/F-04, not misreported as absence. |
| F-04 | `CONFIRMED` | The exact P6-2 input remains `ACTIVE_NOT_EXIT`; `doc/evidence/platform/rm1/p6/rm1p6-u02-package-exit.json` remains absent. No other package's exit can supply its required actual-changed-path/receipt equality. |
| F-05 | `REJECTED_WITH_EVIDENCE` | `PlatformAdminGovernanceController.list` now maps `PlatformAuthenticationService.pageAdministrators(...)`; the owner owns validated filter/sort/page, same-predicate count and bounded ordered read. `PlatformAdministratorPageRequestTest` contains the matching count/read and invalid-page counterexamples. |
| F-06 | `REJECTED_WITH_EVIDENCE` | The platform-IAM owner implements `PlatformGovernanceAuthorization.requireEnabledPlatformAdministrator`; platform-admin commands call it, and workspace account/role platform command variants call the same owner API before receipt execution. The counterexample is preserved: all enabled platform administrators are frozen platform-super-administrators, with no platform role model/table introduced. |
| F-07 | `REJECTED_WITH_EVIDENCE` | Account status/revoke and role create/update/status route idempotency keys into owner-local `WorkspaceIamCommandReceiptService` with canonical requests. The final Testcontainers XML confirms receipt replay and changed-command conflict for platform account status. |
| F-08 | `REJECTED_WITH_EVIDENCE` | Selected-workspace platform account and role routes resolve through `WorkspaceAdministrationService.requireEnabled`; their owners also reject disabled workspaces. The final Testcontainers XML confirms account write disabled rejection and every role-write disabled rejection. |

### Dynamic evidence scope and cleanup

`r5-tc-1785382744557-13612` executed `:apps:backend:catering-business-server:modules:organization:test`; its XML includes `preservesStoreFiltersForSamePredicateCountAndBoundedRead()` and `permitsEachPgIamTargetOnlyForItsRealOwnerScopeAndAncestor()`. `r5-tc-1785384708048-56453` executed `:apps:backend:catering-business-server:modules:workspace-iam:test`; its XML includes receipt replay/conflict, disabled account write, and disabled every-role-write counterexamples. Both manifests record business PASS and `REAPED=PASS_REMOTE_SCRATCH_CLEANUP=PASS`; cleanup is therefore PASS, but scope is not silently widened into platform-edge/UI journey proof.

### Final round-2 decision

The eight round-one findings have been independently re-opened. F-01, F-03 and F-05 through F-08 are closed by current sources and focused proof. F-02 remains partially confirmed because the two managed module runs, although genuine and clean, do not exercise the reviewed platform edge or a rendered user journey. F-04 remains confirmed because the authorized P6-2 package has no exit and its own input still declares `ACTIVE_NOT_EXIT`.

## 结论

`VERDICT=NO_GO` (user-facing verdict: NO-GO)

`M=0 / S=2 / N=0`

`ROUND_FINAL_DECISION=SELF_DECIDED`

This is the second and final independent round for this exact cycle and approved scope. No third review round is permitted. The hard stop is bounded: obtain the package's own receipt-equality exit and evidence that actually crosses the platform edge/user journey (or have Dexter explicitly change the approved evidence obligation). No production, evidence, package-exit or dynamic-run bytes were changed by this review.
