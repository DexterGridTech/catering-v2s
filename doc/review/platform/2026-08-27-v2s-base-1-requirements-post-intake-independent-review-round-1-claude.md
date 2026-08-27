# base-1 requirements post-intake independent review round 1

## Metadata

- REVIEW_CYCLE_ID: `BASE1-REQUIREMENTS-2026-08-27-POST-INTAKE-CODEX-INDEPENDENT`
- REVIEW_TARGET: `DESIGN`
- ACTION_1_VARIANT: `1-B`
- REVIEW_ROUND: `1`
- REVIEW_ROUND_LIMIT: `2`
- reviewerKind: `INDEPENDENT_SUBAGENT`
- Input checklist: `doc/review/platform/2026-08-27-v2s-base-1-requirements-post-intake-independent-review-round-1-input-checklist-claude.md`
- Input checklist SHA256: `329f39ee1885c2a85e72ebfba28f64bab0059abc1059fe75420d58be48885699`
- Blind declaration: I did not read prior base-1 review conclusions or round artifacts before forming this verdict.
- Evidence boundary: static repository/document/source review only. No tests, runtime, DEV, reset, seed, L2, UAT, data/deploy, Git operation, or source edit was run.

## Verdict

NO-GO.

The current requirements draft has correctly repaired several earlier facts, but those corrections are not yet transmitted into an implementation-safe denominator. The biggest gaps are not style: they can produce false-green gates, silent disabled-account invitation failures, and partial ARCHIVED removal while live API/UI paths keep emitting or accepting `ARCHIVED`.

M/S/N: `M=3 / S=2 / N=2`

## Findings

### [M-1] 裁定 17 的 “single owner” 少了一个 live owner，且 explicit-confirmation gate 没有定义

Owning sources:

- Requirements lists the operation-count blockers and裁定 17 at `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:234-266`.
- `scripts/generate/backend-performance-budget.mjs:10` declares `EXPECTED_OPERATION_COUNT = 239`; `:210`, `:440-443`, `:473-491`, and `:674` consume it.
- `scripts/generate/operation-handler-bindings.mjs:19-25` separately declares `operations:239`, `reads:102`, `commands:137`; `:406-408` and `:415-416` gate against those constants.
- `scripts/test/r5-remote-testcontainers.mjs:343-369` separately defaults/checks 239.
- `contracts/policy/backend-performance-cp05-calibration-report.json:87-89`, `:343-349`, `:869-873` stores expected/observed/ready 239.
- Missing from the requirements’裁定 17 consumer list: `scripts/test/backend-performance-operation-reconciliation.mjs:146-163`, `:218-223`, `:256-261`, `:297-302`, and `:327-332` each enforce a literal 239.

Issue:

The requirements say `239` and `reads:102` should move to one source, and name `operation-handler-bindings.mjs`, CP05 report validation, and `r5-remote-testcontainers.mjs` as consumers. That is incomplete because `backend-performance-operation-reconciliation.mjs` is also an active run-level reconciliation owner with five literal 239 checks. The requirements also preserve an “interface set change must be explicitly confirmed” gate, but do not define where that confirmation lives, what value changes, or which consumers must reject missing confirmation.

Falsifiable failure condition:

Add/remove one operation and update only the three consumers named in the requirements. `backend-performance-operation-reconciliation.mjs` can still fail on literal 239, or the opposite path can pass after a count edit without any auditable explicit confirmation because no confirmation contract exists.

Same-root set:

Checked budget generator, binding generator, Testcontainers runner, CP05 frozen report, and operation reconciliation module. The reconciliation module is the counterexample to the current denominator.

Counterexample boundary:

Field/schema-only changes that do not alter operation identity remain correctly separated by requirements lines 251-258; this finding is only about operation identity/count changes and their explicit confirmation mechanism.

Minimum fix:

Name the single count source and exact confirmation artifact/field. Make every live count consumer, including `scripts/test/backend-performance-operation-reconciliation.mjs`, read that source. Specify that count updates require an explicit decision/confirmation token and that generators/runners fail closed when the token is absent or stale. Classify CP05 report values as generated evidence to be regenerated/validated, not as a fourth hand-maintained source.

### [M-2] 裁定 15/7 的 ARCHIVED dead-value 没有全员矩阵；当前执行面只足以处理 `catalog_composite_component`

Owning sources:

- Requirements says `ARCHIVED` is merged into `VOIDED` and releases code at `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:200-210`, lists `catalog_item` and `catalog_sku` migration work at `:313-317`, then specifically proves only `catalog_composite_component` dead-value status at `:407-421`.
- DB still contains `ARCHIVED` in `apps/backend/catering-business-server/src/main/resources/db/migration/V20260806_120000_000__catalog_inventory_backend.sql:23`, `V20260814_100000_000__catalog_p3_model.sql:16`, `:25`, `:28`, `:75`, and `V20260816_020000_000__catalog_sku_voided_code_release.sql:11`, `:23`, `:28`.
- Production code still writes or treats `ARCHIVED` as live behavior: `CatalogSkuFacts.java:206-210` excludes ARCHIVED from VOID, and `:218-230` actively sets SKU status to `ARCHIVED`.
- Contract/API accepts status strings without enumerating the intended target transition closure: `CatalogOwnerApi.java:267-272`.
- Frontend still exposes archive behavior: `catalogModel.ts:54-55`, `useCatalogBatchActionController.ts:102-104`, `CatalogBatchActionModal.tsx:58-64` and `:159-164`, `CatalogWorkbenchController.tsx:107-111`.
- Contract/manifest still carries ARCHIVED labels and smart view semantics: `contracts/catalog/catalogInventoryShapeManifest.ts:2`; `contracts/catalog/catalog-inventory-edge-contract.json:7113`.

Issue:

The draft proves `ARCHIVED` is dead only for `catalog_composite_component`; it does not provide an exact member matrix for all live `ARCHIVED` holders. For `catalog_item` and `catalog_sku`, `ARCHIVED` is not merely a CHECK dead value: owner code, batch commands, frontend modal/action wiring, smart views, tests/fixtures, and generated contract language still carry it as behavior.

Falsifiable failure condition:

If implementation removes `ARCHIVED` from DB CHECKs and indexes but does not remove or remap `useCatalogBatchActionController.ts:103` and `CatalogSkuFacts.java:227`, the UI/backend can still send/write `targetStatus='ARCHIVED'`, producing constraint failure or a half-retired lifecycle. Conversely, if only UI archive is removed but SKU replacement still archives removed rows, the database three-state invariant remains false.

Same-root set:

Checked migrations, owner API records, SKU facts writer, frontend catalog model/controller/modal, shape manifest, and contract evidence text. The current requirements cover only a subset.

Counterexample boundary:

`catalog_composite_component` remains a valid narrow dead-value case: requirements lines 413-421 identify no owner writer and require data precheck. This finding does not ask to treat that table as master data or to add a partial index.

Minimum fix:

Before implementation, add an exact ARCHIVED member matrix with one row per live source/contract/frontend/test/migration holder and one of: `MERGE_TO_VOIDED`, `DELETE_ARCHIVE_ACTION`, `RETAIN_AS_HISTORICAL_SNAPSHOT_WITH_REASON`, `GENERATED_FROM_SOURCE`, or `NOT_APPLICABLE_WITH_COUNTEREXAMPLE`. Include `catalog_item`, `catalog_sku`, smart views, batch status command, SKU replacement semantics, manifest enum labels, generated contract/OpenAPI, frontend archive UX, backend tests/fixtures, and the `catalog_composite_component` dead-value table as a separate row.

### [M-3] 裁定 16 still lacks the owner-level detection contract for disabled-account invitations

Owning sources:

- Requirements identifies the current broken behavior and desired typed rejection at `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:376-391`.
- `WorkspaceInvitationService.java:1064-1072` selects an existing account by mobile without status.
- `WorkspaceInvitationService.java:1073-1089` creates a new ENABLED account when that lookup returns null.
- `WorkspaceInvitationService.java:1323-1331` `accountExists` also checks only existence by mobile, with no status.
- Existing schema has unique keys on mobile and login in `V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql:132`.
- The positive comparison is password recovery, which already selects account status in `WorkspacePasswordRecoveryService.java:281-283` and `:304-305` per the requirements table.

Issue:

The requirements correctly say invitation must reject a disabled account with a typed problem. But it does not define the owner query shape that distinguishes `ABSENT` from `DISABLED` from `VOIDED`, nor the problem code/surface, nor how both public readiness/accountExists and final completion share the same semantic. A naive implementation can add `status='ENABLED'` to `WorkspaceInvitationService.java:1065-1066`; that would turn a disabled account into “not found”, then the insert at `:1077-1089` collides with the existing unique mobile constraint instead of returning the typed invitation rejection.

Falsifiable failure condition:

Disable a workspace account for the invitation mobile. If the fix only filters for ENABLED, completion sees no account and attempts insertion, yielding a DB unique violation or generic failure rather than the required typed problem “先启用该账号”. If the fix only changes completion, the public progress/readiness path can still present an accepting flow for a disabled account.

Same-root set:

Checked invitation create, invitation completion, invitation accountExists, account unique keys, and password recovery’s status-aware lookup. Invitation target enabled checks were also traced and are not missing: `WorkspaceInvitationService.java:260-262` calls `requireEnterable`, `:981-997` dispatches to organization stores/nodes/entities/groups; `OrganizationTaskPathService.java:773-781`, `:946-956`, and `:1046-1049`, plus `OrganizationAssignmentCandidateService.java:121-128`, `:230-248`, and `:251-270`, prove enabled target resolution exists for store/node candidate paths.

Counterexample boundary:

Login and OTP may use ENABLED-only lookup as requirements lines 386-389 state. The typed disabled-account distinction is specifically required for invitation, where disabled must be a visible administrative rejection, not indistinguishable absence.

Minimum fix:

Specify a single invitation owner lookup/readback shape such as `{accountId, status}` by mobile, used by both readiness/accountExists and completion. Define exact typed problem code, HTTP status, and generated problem mapping. State sequence: detect existing disabled/voided account first, reject typed; only insert when truly absent; reuse only when enabled. Add acceptance scenarios for disabled existing account at readiness and completion.

### [S-1] The assembly gate section still drops the stream-collector and hard-coded-null-fallback mechanisms that the draft itself discovered

Owning sources:

- Requirements identifies `Collectors.joining` and hard-coded null fallback in contract at `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:169-177`.
- Requirements gate section later says the assembly gate must cover only Java `+` / `String.join` / `String.format` / `StringBuilder` and SQL `||` / `string_agg` / `concat` / `format` at `:326-329`.
- Current source has user-visible examples in `PlatformContractOverviewController.java:127-146` and `:153-174`: `phaseName == null ? "未设置" : phaseName` plus `Collectors.joining(", ")` for `itemSummary`, while the same response returns structured `items` at `:147-149` and `:175-177`.
- Non-user-visible counterexamples exist and must remain excluded: `CopyPreflightWireShape.java:316-324` builds a diagnostic schema path; `CollaborationOwnerService.java:1218-1222` builds an internal canonical key.

Issue:

The draft discovers the third mechanism in §2.3.1 but fails to propagate it into §6’s gate description and A-2 acceptance criteria. It also calls hard-coded null fallback a separate disease, but no gate/review checklist item is specified for it. This creates a false-green risk: a checker built from §6 can pass the exact contract code that §2.3.1 says violates the principle.

Falsifiable failure condition:

Register `PlatformContractOverviewController` as a zero-assembly file. A §6-only checker that lacks `Collectors.joining` and null fallback detection can pass while `itemSummary` and `"未设置"` remain in a user-visible response.

Same-root set:

Checked Java `+`/join/format/StringBuilder, SQL concatenation, stream collectors, and non-human internal collector cases. I did not confirm a fourth assembly mechanism beyond Java/SQL/stream collectors; the hard-coded fallback is adjacent but not a two-fact assembly mechanism.

Counterexample boundary:

Collectors are not forbidden universally. Internal canonical keys, diagnostics, cache/idempotency strings, SQL placeholders, and schema-path diagnostics remain within §1.7/non-human-readable boundaries when not returned as business display facts.

Minimum fix:

Update §6 and A-2 to include `Collectors.joining`/stream collectors when the target field is user-visible. Add a separate review/gate criterion for user-visible hard-coded fallback text in owner/edge responses, with explicit exclusions for problem messages parked in §1.6 and non-human diagnostics.

### [S-2] Requirements and routed memory conflict on enum dictionary placement

Owning sources:

- Requirements says code-defined closed sets get frontend dictionaries, no backend operation/interface, at `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:150-164` and `:423-435`.
- Routed memory still says the measured fix has a prerequisite: “先建词汇表再退役 DisplayName” at `project-memory/decisions/owner-read-model-and-lifecycle-standard.md:48-54`, after listing 41 display fields.
- `CLAUDE.md:55` warns the run-level operation verifier still exists, so adding backend dictionary operations would collide with the operation-count controls the requirements are trying to avoid.

Issue:

The current requirements likely has the better/current decision: frontend dictionaries for code-defined static closed sets. But routed project memory still says “先建词汇表” without saying frontend-only. An executor following routed memory can reasonably create backend vocabulary endpoints before retiring DisplayName fields, directly contradicting requirements lines 427-431.

Falsifiable failure condition:

Implementation adds one backend dictionary operation per non-catalog domain to satisfy routed memory. It then triggers `BUDGET_PROJECTION_OPERATION_MISSING` or operation-count drift, despite requirements saying “工作全在前端,不新增 operation”.

Same-root set:

Checked current requirements, owner-read routed memory, CLAUDE operation-budget boundary, and catalog manifest precedent. The conflict is between two repository authority surfaces, not between source code and a reviewer preference.

Counterexample boundary:

Business-defined labels/entities are not frontend dictionaries; they remain backend business facts/associated entities per requirements §2.3. This finding only covers code-defined static closed enum labels.

Minimum fix:

Synchronize the routed memory wording or add an explicit override note in the requirements: “词汇表 = frontend/app dictionary or generated enum-derived map; no backend operation.” Include the 12 code-defined fields exact list before implementation.

### [N-1] §1.3 calls aggregate facts an “exception” to §1.1, which blurs the three retained exception taxonomy

Owning sources:

- Requirements defines §1.1 as “响应字段的值不得由拼接产生” at `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:50-68`.
- §1.3 says aggregate facts must return and are “1.1 的例外” at `:76-90`.
- Backend coding standard §2-H says outside-response facts must be returned as structured facts, not sentences, at `doc/platform/backend-coding-standard.md:273-284`.

Issue:

`accountCount`, `blockingReferenceCount`, `skuSummary`, and similar aggregate facts are not display-assembly exceptions. They are backend-owned structured business facts because the frontend cannot compute them from the current response. Calling them a §1.1 exception can be misread as a fourth retained “display field” class beyond snapshots/privacy/non-human composites.

Falsifiable failure condition:

An implementation reviewer sees “聚合事实是 1.1 例外” and permits a backend sentence like `仍有 3 个商品引用`, or an implementer sees “exceptions are exhaustive” and deletes a required aggregate not named in the examples.

Same-root set:

Checked requirements §1.1/§1.3/A-10 and backend standard 2-H. The requirement’s examples are substantively right; the taxonomy wording is the problem.

Counterexample boundary:

The aggregate fields themselves should stay when they depend on outside-response data and are structured. This finding does not ask to delete them.

Minimum fix:

Rename §1.3 to “backend-owned aggregate facts, not an assembly exception” and state that aggregate facts remain only as numeric/boolean/structured fields. Keep A-10 but remove “1.1 的例外” phrasing.

### [N-2] Exact member matrices are repeatedly deferred; this is acceptable for a requirements draft but blocks implementation-facing design

Owning sources:

- Requirements explicitly says the 41 display fields are split by heuristic and must be opened one by one before implementation at `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:142-165`.
- Requirements fixes GET denominator to 22 for catalog inventory at `:306`.
- Requirements gives lifecycle denominator classes at `:310-318`.
- Review/design templates require declaration-transfer-consumption and full sync matrices for implementation-facing design inputs.

Issue:

The document is honest that it is a requirements draft and not implementation authorization at `:437-439`. Under that boundary, missing exact matrices are not by themselves a defect in the requirements artifact. They become a blocker only if this document is used as implementation-facing design. The current text already contains concrete counts that can look implementation-ready, but it does not enumerate exact members for the 12 code-defined DisplayName fields, 15 ARCHIVED/dead-value/lifecycle holders, 22 GET interfaces, Java/SQL/stream assembly file list, or acceptance scenarios.

Falsifiable failure condition:

An executor starts implementation from the counts and examples alone. A fourth `ARCHIVED` consumer, a `Collectors.joining` response field, or one of the 12 enum display fields is missed because no exact member matrix exists.

Same-root set:

Checked current requirements, implementation-design template, backend standard, and sampled source denominators. The current artifact’s “需求稿 / 不授权实施” line prevents this from being the same severity as an implementation design omission.

Counterexample boundary:

For requirements approval only, the draft may remain at count-plus-example level if the next artifact is explicitly an implementation-facing design that produces the matrices before code.

Minimum fix:

Add a pre-implementation deliverable list: exact member matrices for display-field classification, lifecycle/ARCHIVED migration and source consumers, operation-count consumers/confirmation, read-interface GET convergence, and acceptance scenarios. State these matrices are mandatory before any code change.

## Confirmed non-findings / evidence notes

1. Invitation target store/node ENABLED checking appears to exist for current create/complete paths. `WorkspaceInvitationService.java:260-262` calls `requireEnterable`; `:981-997` checks STORE/HEAD_COMPANY/GROUP/REGION/PROJECT. Store/node backing queries include `status='ENABLED'` in `OrganizationTaskPathService.java:773-781`, `:946-956`, `:1046-1049`, and invitation candidate lookup goes through enabled candidate rows in `OrganizationAssignmentCandidateService.java:121-128`, `:230-248`, `:251-270`.
2. I did not confirm a fourth real field category beyond the draft’s retained classes. The real risk is taxonomy: aggregate facts are backend-owned structured facts, not display-assembly exceptions.
3. I did not confirm a fourth assembly mechanism beyond Java/SQL/stream collectors. The separate hard-coded null fallback issue is real but not “two facts joined into one string.”
4. The removal of the backend-acceptance 80-scenario cap is consistent with `CLAUDE.md:55` and `project-memory/pitfalls/acceptance-scenario-count-freeze.md:17-23`.

## review-standard §5 block

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M/S/N=3/2/2
L1_ENGINEERING=M-1 operation-count single-owner denominator incomplete and explicit-confirmation gate undefined; M-2 ARCHIVED lifecycle dead-value lacks exact member matrix across DB/source/contract/UI/test; M-3 disabled-account invitation typed rejection lacks owner-level status detection contract; S-1 assembly gate omits stream collectors and null fallback propagation; S-2 requirements conflict with routed memory on frontend-vs-backend enum dictionary placement.
L2_USER_VISIBLE=M-2 can leave archive UI/API behavior alive after DB lifecycle migration; M-3 can present invitation success/readiness for a disabled account and then fail login or fail generically; S-1 leaves backend-decided contract display text/item summaries in user-visible responses.
L3_UNVERIFIED=No runtime, tests, DB contents, generated freshness, HTTP, browser, DEV, seed, L2, UAT, or data/deploy evidence was produced. Static-only source and document evidence.
SAME_ROOT_SCAN=M-1 scanned budget generator, binding generator, Testcontainers runner, CP05 report, operation reconciliation; missing reconciliation owner confirmed. M-2 scanned migrations, owner API/facts, frontend model/controllers/modal, manifest, contract text; catalog_composite_component is a narrow dead-value counterexample, not the whole ARCHIVED denominator. M-3 scanned invitation create/complete/accountExists, account unique keys, password recovery comparator, and organization target enabled resolvers. S-1 scanned Java/SQL/stream collector patterns plus non-human collector exclusions. S-2 compared current requirements with routed memory and CLAUDE budget boundary.
DESIGN_GAPS=The requirements draft needs exact pre-implementation matrices for operation count confirmation, ARCHIVED/lifecycle consumers, disabled-account invitation typed problem contract, assembly/no-fallback mechanisms, enum DisplayName classification, and read-interface convergence before it can safely become implementation-facing design.
EVIDENCE_TIER=STATIC_REPOSITORY_SOURCE_ONLY
```

## Recommendation

NO-GO for implementation-facing use. It can proceed only as a requirements draft if the next step is explicitly to produce the missing implementation-facing matrices and synchronize the routed memory conflict before any code change.
