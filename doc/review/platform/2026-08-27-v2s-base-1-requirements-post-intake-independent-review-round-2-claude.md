# base-1 requirements post-intake independent review round 2

## Metadata

- REVIEW_CYCLE_ID: `BASE1-REQUIREMENTS-2026-08-27-POST-INTAKE-CODEX-INDEPENDENT`
- REVIEW_TARGET: `DESIGN`
- ACTION_1_VARIANT: `1-B`
- REVIEW_ROUND: `2`
- REVIEW_ROUND_LIMIT: `2`
- reviewerKind: `INDEPENDENT_SUBAGENT`
- ROUND_FINAL_DECISION: `SELF_DECIDED`
- reviewerInputChecklist: `{path: "doc/review/platform/2026-08-27-v2s-base-1-requirements-post-intake-independent-review-round-2-input-checklist-claude.md", sha256: "cd0f7747701d311b5225a888a52e2a9e5de71f30ba651600ac35566a19e2068f"}`
- blindReviewDeclaration: targeted Round 2; the main-agent intake was read as claims to verify, not as truth.
- authorMaterialReadAfterIndependentVerdict: `true` for Round 1 disposition only; each Round 2 intake point was source-checked before final classification.
- Evidence boundary: static repository/document/source review only. No tests, runtime, DEV, reset, seed, L2, UAT, data/deploy, Git action, or source edit was run.
- Hard stop: this is Round 2 of 2. Do not open Round 3 for this same `REVIEW_CYCLE_ID + REVIEW_TARGET + scope`.

## Final verdict

NO-GO.

M/S/N: `6/3/1`

Round 2 strengthens the Round 1 NO-GO. The requirements draft has several corrected decisions, but the active authority graph and exact execution denominators are still inconsistent enough that an implementation agent could make a locally plausible change and still miss live behavior, false-green a gate, or create a user-visible regression.

## Round 1 finding disposition

| Round 1 item | Round 2 decision | Reason |
| --- | --- | --- |
| R1 M-1 operation-count single owner incomplete | MAINTAINED_AND_STRENGTHENED | `backend-performance-cp05-reclassification.mjs` is an additional literal-239 live consumer beyond operation reconciliation. Minimum fix narrowed: require a clearly named, manually maintained canonical count source consumed by production/generator/test consumers; do not invent operation-id digest or decisionRef unless the owner design explicitly decides it. |
| R1 M-2 ARCHIVED lifecycle/member matrix incomplete | MAINTAINED_AND_RESCOPED | Broad catalog item/SKU matrix gap remains. Additionally, the narrow `catalog_composite_component` “only lives in CHECK” claim is statically false because production reads filter `component.status <> 'ARCHIVED'`; data existence remains runtime/DB-unverified. |
| R1 M-3 disabled-account invitation typed rejection incomplete | MAINTAINED_AND_STRENGTHENED | Must cover invitation create, public readiness/accountExists shape, and complete; complete-only protection misses state drift between creation and completion. |
| R1 S-1 assembly gate omits stream collectors/null fallback | UPGRADED_TO_M | Workspace-IAM has user-visible `Stream.reduce` lambda concatenation, so requirements line 182 “workspace/iam:0” and §6/A-2 are materially false. |
| R1 S-2 requirements vs routed memory enum dictionary conflict | MAINTAINED_AND_BROADENED | Conflict is wider than enum dictionary: backend standard and backend-acceptance routed memory also carry stale facts. |
| R1 N-1 aggregate facts called “1.1 exception” | MAINTAINED | Aggregate fact is not an assembly exception; wording remains misleading but the substantive rule is mostly correct. |
| R1 N-2 exact member matrices not produced | MERGED_INTO_M_FINDINGS | Missing exact matrices now appear as concrete blockers in operation counts, ARCHIVED/component lifecycle, assembly mechanisms, invitation semantics, and BusinessChannel VOIDED guard. |

## Findings

### [M-1] Operation count single-owner plan still misses live literal-count consumers and does not name the canonical count source

Classification: `CONFIRMED`.

Facts:

- Requirements裁定 17 says `239` and `reads:102` move to one source and names `operation-handler-bindings.mjs`, CP05 report validation, and `r5-remote-testcontainers.mjs` as consumers: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:260-264`.
- Existing live literals also exist in operation reconciliation: `scripts/test/backend-performance-operation-reconciliation.mjs:146-163`, `:218-223`, `:256-261`, `:297-302`, `:327-332`.
- Existing live literals also exist in CP05 reclassification: `scripts/test/backend-performance-cp05-reclassification.mjs:63-70`, `:320-331`, `:417-430`.
- The current generator source literal remains `scripts/generate/backend-performance-budget.mjs:10`, with validations at `:210`, `:440-443`, `:473-491`, and output at `:674`.
- Binding generator has its own count object at `scripts/generate/operation-handler-bindings.mjs:19-25`, checked at `:406-416`.
- Testcontainers runner has its own defaults and checks at `scripts/test/r5-remote-testcontainers.mjs:343-369`.

Inference:

The “single owner” denominator is not closed by naming three consumers. The minimally correct gate is not “operation-id digest” or “decisionRef” unless a separate owner design decides that; the sourced requirement only supports one explicit, manually maintained canonical count source plus fail-closed consumer wiring.

Falsifiable failure condition:

Change the canonical count and update the three consumers named by requirements line 260, but leave `backend-performance-cp05-reclassification.mjs` or `backend-performance-operation-reconciliation.mjs` untouched. A live run/reclassification path still rejects 239 drift, proving the requirements denominator was incomplete.

Same-root scan:

Checked `backend-performance-budget.mjs`, `operation-handler-bindings.mjs`, `r5-remote-testcontainers.mjs`, `backend-performance-operation-reconciliation.mjs`, `backend-performance-cp05-reclassification.mjs`, and CP05 calibration report JSON. Test files with 239 fixtures exist too, but are not the primary production/generator/runtime consumer set for the canonical source decision.

Counterexample boundary:

Field/schema-only changes that do not alter operation identity remain outside this count gate, as requirements lines 251-258 correctly separate.

Minimum fix:

Add a named canonical count source artifact/module and list every consumer above as required to import/read it. Keep explicit confirmation scoped to “human-edited canonical count changes”; do not require new digest/decisionRef unless the design explicitly introduces that mechanism with a red counterexample and owner.

### [M-2] `catalog_composite_component` ARCHIVED is not “only in CHECK”; production read logic still gives it semantics

Classification: `CONFIRMED` for static source contradiction; `UNVERIFIED_REQUIRES_EVIDENCE` for actual stored rows.

Facts:

- Requirements line 415 says `catalog_composite_component` `ARCHIVED` “只活在 CHECK” and owner never writes it: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:413-421`.
- `CatalogCompositeFacts` reads and writes the component `status` field, though it has no literal `ARCHIVED`: `CatalogCompositeFacts.java:36-48`, `:300-312`, `:366-371`, `:442-448`.
- `CatalogItemCompositeEditor.tsx:464-467` exposes only `ENABLED` and `DISABLED` options, supporting that users cannot select `ARCHIVED` through that editor.
- But `CatalogOwnerService.java:5448-5460` and `:5514-5530` both filter `component.status <> 'ARCHIVED'`.

Inference:

The static claim “only lives in CHECK” is false. Even if no current UI writes `ARCHIVED`, production read/reference logic treats it as a meaningful excluded state. Because DB contents were not inspected and DB/data operations are forbidden, “no stored ARCHIVED rows exist” remains unproven.

Falsifiable failure condition:

Remove `ARCHIVED` only from the CHECK constraint. If any existing row has `component.status='ARCHIVED'`, the source behavior changes because the read/reference filters currently exclude it. If no rows exist, this must be proven by an authorized data precheck, not by static review.

Same-root scan:

Checked requirements §7.3, `CatalogCompositeFacts`, catalog composite editor, and the two `CatalogOwnerService` component reference queries. This is narrower than the broader catalog item/SKU ARCHIVED matrix; both must be handled.

Counterexample boundary:

The editor evidence supports “user cannot select ARCHIVED in this UI”; it does not support “owner/source never observes ARCHIVED semantics.”

Minimum fix:

Replace “只活在 CHECK” with a narrower statement: no current writer/UI literal was found, but read/reference filters still exclude `ARCHIVED`; implementation requires an authorized stored-data precheck and explicit disposition for those filters before CHECK removal.

### [M-3] Workspace-IAM has a fourth user-visible assembly mechanism: `Stream.reduce` lambda concatenation

Classification: `CONFIRMED`.

Facts:

- Requirements says workspace/iam has `0` assembly occurrences: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:178-182`.
- Requirements §6/A-2 lists only Java `+`/`String.join`/`String.format`/`StringBuilder` and SQL mechanisms for the assembly gate: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:326-329`, `:341-342`.
- `PlatformWorkspaceInvitationTaskReadService.java:85-94` maps task paths, `distinct()`, then `.reduce((first, second) -> first + " ; " + second)` into a management invitation view path.
- `WorkspaceInvitationService.java:1190-1204` performs the same path concatenation for invitation target path.
- Requirements §2.3.1 already recognizes stream collectors as a third mechanism for contract: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:169-177`.

Inference:

`Stream.reduce` with a string-concatenating lambda is a fourth mechanical assembly pattern beyond the named Java/SQL/collector set. It is not an enum mapper and not an aggregate fact. It takes multiple path facts and returns a semicolon-delimited display string, so it meets the requirements’ own “two or more facts joined/formatted into one user-visible field” predicate.

Falsifiable failure condition:

Build the §6 assembly checker from the current mechanism list. It can pass workspace/iam as “0” while both invitation management/public target paths still contain backend-chosen ` ; ` delimiters.

Same-root scan:

Targeted scan found the two workspace-iam `reduce((first, second) -> first + " ; " + second)` occurrences and the existing contract `Collectors.joining` occurrences. Non-human `String.join` placeholders and canonical keys remain excluded by §1.7.

Counterexample boundary:

An enum mapper that maps one enum value to one label is not two-fact assembly. Aggregate facts are also not assembly exceptions when returned as structured numbers/booleans.

Minimum fix:

Amend §1.1, §2.4, §6, and A-2 to cover stream collectors and `Stream.reduce`/lambda string concatenation when the result is a user-visible response field. Correct the workspace/iam denominator and add the two invitation path occurrences to the exact assembly member matrix.

### [M-4] Ruling 16 must cover invitation create, readiness/accountExists, and complete; the current draft only names the symptom

Classification: `CONFIRMED`.

Facts:

- Requirements states invitation must reject disabled accounts with a typed problem: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:376-391`.
- Invitation create proceeds through `createForOperations` and `createWithFacts`: `WorkspaceInvitationService.java:150-170`, `:220-272`; this path normalizes mobile and inserts an invitation before any account-status distinction is visible in the shown path.
- Public readiness returns `accountExists(invitation)`: `WorkspaceInvitationService.java:836-846`, `:849-888`.
- `accountExists` checks only count by mobile: `WorkspaceInvitationService.java:1323-1331`.
- Complete selects account by mobile without status: `WorkspaceInvitationService.java:1064-1072`; when null, it inserts an ENABLED account: `WorkspaceInvitationService.java:1073-1089`.
- Current account uniqueness is on mobile/login in `V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql:132`.

Inference:

The minimum design must reject disabled existing account at create time so the inviter gets immediate feedback, and must recheck at complete time because account status can change while an invitation is pending. Public readiness/accountExists also needs a typed shape, otherwise disabled is indistinguishable from enabled existence or absence.

Falsifiable failure condition:

If only complete is fixed, an invitation can still be created for a disabled account and remain apparently actionable until finalization. If only create is fixed, an account disabled after invitation creation can still be reused or collide during completion. If `accountExists` stays boolean, public flow cannot represent “existing but disabled, ask admin to enable.”

Same-root scan:

Checked invitation create, readiness, credentials save readiness, completion, accountExists, and current unique-key shape. Password recovery remains the positive comparator because it selects account status before deciding behavior.

Counterexample boundary:

Login/OTP can use ENABLED-only lookup. Invitation cannot, because disabled must be a user/admin-visible typed rejection, not absence.

Minimum fix:

Define a single account-by-mobile owner lookup returning `{state: ABSENT|ENABLED|DISABLED|VOIDED, accountId?}`. Use it at create and complete, and expose readiness as a typed state/problem rather than a boolean-only `accountExists`. Add exact problem code/status and acceptance scenarios for disabled-at-create and disabled-after-create-before-complete.

### [M-5] BusinessChannel removal of `requireEditable` lacks the required `VOIDED` guard

Classification: `CONFIRMED`.

Facts:

- Requirements says `requireEditable` is invalid because disabled remains editable, and classifies calls for deletion/retention: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:268-284`.
- `BusinessChannelOwnerService.java:511`, `:736`, `:767`, `:868` currently block DISABLED self-edit/transition through `requireEditable`.
- The helper itself only blocks `DISABLED`: `BusinessChannelOwnerService.java:1465-1469`.
- There is no current `VOIDED` handling in BusinessChannel sources/migrations under the checked paths; targeted `VOIDED` search in business-channel returned no hits.
- The edge helper noted by requirements line 282 exists at `ExternalCollaborationBusinessChannelCoordinator.java:310-314`, but targeted call search shows no caller other than its own definition.

Inference:

The draft correctly identifies that DISABLED self-edit blocks must be removed, but it does not specify the replacement terminal-state guard. When business_channel joins three-state lifecycle, `VOIDED` must become non-editable/non-transitionable. Deleting `requireEditable` without a `VOIDED` guard opens the exact opposite invariant violation: deleted channels/templates remain editable or can transition.

Falsifiable failure condition:

After adding `VOIDED` to business_channel status vocabulary, remove the self `requireEditable` calls as instructed but add no `VOIDED` check. A `VOIDED` channel/template can flow through update/transition paths that previously only rejected DISABLED.

Same-root scan:

Checked all eight named `requireEditable` locations, the helper definition, targeted `VOIDED` absence in business-channel source/migrations, and edge helper call sites.

Counterexample boundary:

The create-path template check at `BusinessChannelOwnerService.java:649` remains a reference/admission check and should not be removed. The edge helper is currently dead code; do not spend implementation effort on it unless a live caller is introduced or discovered.

Minimum fix:

State the replacement rule explicitly: self edit/transition permits ENABLED and DISABLED, rejects VOIDED; new references require ENABLED; unchanged existing references get the 1-N exemption. Add live-call-site classification and remove or mark the unused edge helper as dead-code cleanup only.

### [M-6] Active authority drift remains in standards and routed project memory

Classification: `CONFIRMED`.

Facts:

- Current requirements add security/privacy masking as an exception at `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:95-103`.
- `doc/platform/backend-coding-standard.md:105-107` still says the assembly mechanism has two layers and two exceptions; it omits stream collectors/reduce and security/privacy masking.
- `doc/platform/backend-coding-standard.md:327-328` points 1-J..1-N and 2-H/2-I to the now-retired `2026-08-26-v2s-base-1-overall-refactor-requirements-claude.md`.
- `project-memory/decisions/owner-read-model-and-lifecycle-standard.md:41-54` repeats old two-exception and “先建词汇表再退役 DisplayName” wording.
- `project-memory/operations/backend-acceptance.md:16-19`, `project-memory/operations/dev-command-separation.md:35-36`, and `project-memory/operations/test-closed-loop.md:16-19` still state 28 scenarios/five domains/old controls, while `CLAUDE.md:55` and `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md:14-27`, `:42-57` say current backend-acceptance has no upper limit and now lists more domain groups.
- `project-memory/practices/backend-capability-lookup.md:35` still says scenario total upper limit 80, while `project-memory/pitfalls/acceptance-scenario-count-freeze.md:17-23` says that cap was removed.

Inference:

This is no longer just a draft wording problem. The active sources that agents are instructed to read disagree about exception taxonomy, assembly mechanisms, dictionary placement, and backend-acceptance capacity. An implementation/review session following AGENTS and routed memory can be led away from the updated requirements.

Falsifiable failure condition:

A future agent reads backend-coding-standard as the unique backend standard and builds the assembly gate with only Java/SQL and two exceptions, or reads backend-capability-lookup and refuses/reshapes valid backend-acceptance scenarios because of the stale 80 cap.

Same-root scan:

Checked current requirements, backend coding standard, owner-read lifecycle memory, backend-acceptance memory, backend capability lookup, scenario-count pitfall, CLAUDE, and current backend-acceptance decision.

Counterexample boundary:

The current requirements can still be treated as the more specific current draft for base-1 decisions. The finding is that stale active authority must be synchronized or explicitly superseded before implementation-facing design, not that every old memory sentence is independently authoritative.

Minimum fix:

Patch the active standards/memory pointers or add explicit supersede notes in the requirements and memory: include stream collectors/reduce, security/privacy masking, frontend-only enum dictionary for code-defined static sets, no scenario count cap, and the current backend-acceptance domain group list.

### [S-1] Role ENABLED “7处” fact is substantively right but source attribution is wrong

Classification: `CONFIRMED`.

Facts:

- Requirements line 374 says `WorkspaceAuthenticationService` contains all seven `r.status='ENABLED'` role checks.
- Actual seven checked points are distributed across `WorkspaceAuthenticationService.java:522`, `:901`, `:1282`, `:1303`; `WorkspaceCapabilityScopeResolver.java:409`; `WorkspaceCommandAuthorizationService.java:151`; `WorkspaceAuditAuthorizationService.java:87`.

Inference:

The design conclusion “keep runtime role ENABLED filters” is correct, but the source attribution “inside one service” is false. That matters because implementation could edit only `WorkspaceAuthenticationService` and miss command/audit/capability authorization.

Falsifiable failure condition:

An implementer follows requirements line 374 literally and reviews/locks only four authentication-service checks. Capability, command authorization, and audit authorization behavior can drift unreviewed.

Same-root scan:

Checked all seven named role-enabled filters. No additional role `status='ENABLED'` runtime authorization filter was confirmed in this targeted set.

Minimum fix:

Replace line 374 wording with the exact seven-location table and preserve all seven as runtime authorization filters.

### [S-2] Blocker 5 undercounts assertion-matrix occurrences

Classification: `CONFIRMED`.

Facts:

- Requirements line 290 says `contracts/catalog/catalog-inventory-edge-contract.json` has 7 occurrences and `contracts/policy/catalog-inventory-assertion-matrix.json` has 2 occurrences of `Load exactly the approved detail section with bounded task reads and return its typed read model.`
- Static search found 7 in `catalog-inventory-edge-contract.json`: lines `485`, `5099`, `5241`, `5364`, `5489`, `5624`, `5748`.
- Static search found 7 in `catalog-inventory-assertion-matrix.json`: lines `802`, `6053`, `6249`, `6380`, `6513`, `6656`, `6788`.

Inference:

The blocker is real, but the assertion-matrix count is wrong by five. If implementation updates only two assertion-matrix entries, five stale contract assertions remain.

Falsifiable failure condition:

Update two assertion-matrix occurrences and regenerate/verify; static search still finds five stale assertion entries requiring screen/detail-section task reads.

Same-root scan:

Checked both named contract/policy files for the exact string.

Minimum fix:

Correct line 290 to 7 + 7 and require exact-string zero after the contract source/assertion matrix rewrite, or explain which generated entries derive from a smaller owner source.

### [S-3] Cost section contradicts itself on DB round trips and risks reversing the core principle

Classification: `CONFIRMED` for roundtrip contradiction; `PARTIALLY_CONFIRMED` for target-shape authority risk.

Facts:

- Requirements line 194 says the SKU dimension entity change “可能增加一次查询,先实测再定.”
- Requirements line 196 then says the unified conclusion is “不增加数据库往返.”
- Requirements line 198 says target shape must be inferred from contract and frontend actual consumption.
- The core principle at lines 8-24 says backend returns business facts and frontend decides display.

Inference:

Line 194 and line 196 are directly inconsistent. Also, “from contract and frontend actual consumption” is safe only as a counterexample/source-discovery method; it is unsafe as the authority for target shape. The target shape should be derived from owner business identity and current business facts, then checked against contract/frontend so consumers can render without backend display assembly.

Falsifiable failure condition:

Implementation planning assumes “no extra DB roundtrip” for SKU dimensions and refuses a necessary owner read, or conversely shapes the new read model around what current frontend happens to display, reintroducing view-model-driven owner reads under a cleaner field name.

Same-root scan:

Checked requirements cost section, core principle, backend standard 2-H, and foundation read-granularity rule.

Counterexample boundary:

Using current contract/frontend consumption to falsify invented fields is good; using it as the final authority for the owner model is not.

Minimum fix:

Change line 196 to “known甲/乙 changes do not add round trips; SKU dimension is pending measurement.” Change line 198 to “derive target shape from owner business identity and approved business facts; use current contract/frontend consumption only to detect invented or missing facts.”

### [N-1] Aggregate facts remain misclassified as a §1.1 exception

Classification: `CONFIRMED`.

Facts:

- Requirements §1.3 title says aggregate facts are “1.1 的例外”: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:76-90`.
- Backend standard 2-H says outside-response facts must be returned as structured facts, not sentences: `doc/platform/backend-coding-standard.md:273-284`.

Inference:

Aggregate facts are not a two-fact string-assembly exception. They are backend-owned structured facts when they depend on data outside the current response. The current examples are mostly correct; the taxonomy wording is what remains unsafe.

Falsifiable failure condition:

Reviewer permits a backend sentence under the “aggregate exception” label, or implementer deletes a required count because it was not named in the examples.

Minimum fix:

Rename §1.3 to “backend-owned aggregate facts, not assembly exceptions” and keep A-10 as the non-exhaustive structured-fact rule.

## Explicitly rejected or narrowed intake claims

1. `enum mapper` is not itself two-fact assembly. It may be a frontend/backend dictionary placement problem, but mapping one enum to one label is not the same predicate as concatenating multiple facts.
2. `aggregate fact` is not an assembly exception. It belongs under backend-owned structured fact when it depends on data outside the current response.
3. No source-backed basis was found to require an operation-id digest or decisionRef as the minimal count gate. The sourced minimal gate is a named canonical count source plus explicit human edit of that source.
4. Actual stored `catalog_composite_component.status='ARCHIVED'` rows are not statically provable. They require separately authorized data evidence.

## review-standard §5 block

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M/S/N=6/3/1
L1_ENGINEERING=M-1 operation-count canonical source denominator still misses operation reconciliation and CP05 reclassification consumers; M-2 catalog_composite_component ARCHIVED is not only in CHECK because production read filters give it semantics; M-3 workspace-iam Stream.reduce user-visible assembly invalidates workspace/iam:0 and the §6/A-2 gate mechanism list; M-4 ruling16 lacks create+readiness+complete disabled-account contract; M-5 BusinessChannel DISABLED edit-guard removal lacks replacement VOIDED guard; M-6 active standards and routed memory conflict with current requirements on assembly mechanisms, exceptions, dictionary placement, and backend-acceptance caps/domains.
L2_USER_VISIBLE=M-2 can change composite reference visibility for archived component rows without data proof; M-3 leaves invitation target paths backend-delimited with " ; "; M-4 lets a disabled-account invitation look actionable or fail generically; M-5 can make deleted business channels/templates editable/transitionable once VOIDED is added; S-3 can reintroduce frontend/view-shaped owner read models.
L3_UNVERIFIED=No runtime, tests, DB contents, generated freshness, HTTP, browser, DEV, seed, L2, UAT, data/deploy, or Git evidence. Stored ARCHIVED component rows are explicitly UNVERIFIED_REQUIRES_EVIDENCE.
SAME_ROOT_SCAN=M-1 checked budget generator, binding generator, r5 runner, operation reconciliation, CP05 reclassification, and CP05 report. M-2 checked requirements §7.3, CatalogCompositeFacts, CatalogOwnerService component filters, and composite editor. M-3 checked workspace-iam reduce assembly and contract stream collectors with non-human exclusions. M-4 checked invitation create/readiness/accountExists/complete and account uniqueness. M-5 checked all named BusinessChannel requireEditable calls, helper definition, edge helper call sites, and VOIDED absence in business-channel. M-6 checked backend standard, owner-read memory, backend-acceptance memory, capability lookup, scenario-count pitfall, CLAUDE, and current backend-acceptance decision. S-1 checked seven role ENABLED filters. S-2 checked exact contract/assertion-matrix strings. S-3 checked requirements cost/core-principle wording and backend/foundation read-model rules.
DESIGN_GAPS=Before implementation-facing use, synchronize active authority surfaces; produce exact matrices for operation count consumers, ARCHIVED/component lifecycle and data precheck, assembly mechanisms including Stream.reduce, invitation disabled-account typed states, BusinessChannel VOIDED guards, display-field classification, and read-interface convergence; correct blocker counts and cost assumptions.
EVIDENCE_TIER=STATIC_REPOSITORY_SOURCE_ONLY
```

## Recommendation

NO-GO. This Round 2 is final for the cycle and must hard stop. The next safe action is not another review round; it is author-side repair of the current requirements/standards/memory conflicts and exact matrices, followed by whatever downstream process Dexter authorizes.
