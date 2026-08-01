---
REVIEW_CYCLE_ID: RM1P6-U03-FINAL-IMPLEMENTATION-REVIEW
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
blindReview: true
authorMaterialReadAfterIndependentVerdict: true
verdict: NO-GO
---

# RM1P6-U03 implementation adversarial review

Dexter，本轮是 fresh `INDEPENDENT_SUBAGENT` 的实现盲审。我先以证伪为立场核验生产源码、用户交互和 owner/edge/generated 链，形成下列 findings 与 NO-GO，再对照作者 evidence。没有修改生产源码或执行 Git 操作。

## Immutable input checklist

Checklist: `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md` (`0ef12f041bae6b4411bb4b4b3f15f2860796b31f3dab5894738fdd17441b63fe`).

读入清单及 hash：

- `AGENTS.md` `82564a7b8eb617958c6f93c8cbdf69c980ad856f9d53ab774f91f1439fd56c2f`
- `CLAUDE.md` `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f`
- `doc/platform/roadmap-program-registry.json` `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8`
- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3`
- `contracts/policy/standards-coverage-matrix.json` `7f59478c3b52aeef571f44a1b8e5e11ab2ddf8038d480fa1d7ac837901fdca70`
- `doc/decisions/2026-07-24-v2s-verification-governance.md` `c9632a65f9eac7678a4be919d980894e3f1e71e5e2e1ddce70ea3c7091d829dc`
- `doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md` `98b58f61d113a61cf1aad367d3cde812b8e6689fca465a0197fdb2e1bd280f6c`
- `doc/evidence/platform/rm1/p6/rm1-u09-implementation-facing-design-and-three-phase-plan.md` (reviewed in full)
- `doc/evidence/platform/rm1/p6/rm1p6-u03-package-input.json` `5ee6721c9845578ca0743629e27d6ac6561286fb6caf72bf8a5e6db52cb52ddc`
- `doc/evidence/platform/rm1/p6/rm1p6-u03-final-ui-ia-control-alignment.json` `8283585fd7d36254ff00c4b8709d2c2c94b8a0bed0db7bc89678e0530d7f8bc5`
- `doc/evidence/platform/rm1/p6/rm1p6-u03-source-compliance-disposition.json` `b2a30b39c3f18fbb6f32d67b77d7716936d60873e4382a4df01bfb1f5acbc21c`

All project-memory kernels and the six-dimension `scripts/context/recall-memory` route were read. Confirmed business corpus terms G-06/G-07/G-09/G-10/G-11 were reopened with their non-derivation boundaries. Per-change pre/post reread was checked against the active implementation design, IA04, owner sources, generated consumers and focused proofs; absent receipt/source-compliance rows are treated as findings rather than inferred PASS. The review prompt used the required declaration: “first try to falsify the reviewed design/implementation; form findings and verdict before reading author self-review or dispositions.”

## Findings

### F1 — Store detail/update/status do not re-authorize visible project scope (M, CONFIRMED)

`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreManagementController.java:52-65` resolves task scope only when an optional `projectId` is supplied for list and does not resolve the store's current project for `detail`, `update`, or `transitionStatus`. A caller with a valid workspace session and a known `storeId` can therefore read, mutate, or transition a store outside the session's assignment/visible data-node scope; omitting `projectId` also sends an unscoped store query. This contradicts IA04's project-scoped store task and the owner revalidation requirement.

Minimal root fix: derive the current store/project first, call `WorkspaceUserService.resolveTaskScope` (and context-version check) before every detail/update/status owner call, and make an unfiltered list use the same visible-project predicate rather than workspace-wide rows. Add negative tests for a known out-of-scope store and for list omission of `projectId`.

### F2 — Organization status action bypasses required confirmation Modal (M, CONFIRMED)

`apps/frontend/operations-admin/src/features/organization-structure/ui/OrganizationStructurePage.tsx:391-397` calls `transition(selected)` directly from the detail Drawer button. IA04 requires `IA04-ORG-STATUS` to open a confirmation Modal with cancel/confirm, `useOverlayLock`, and fixed copy (`doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md:45`). This is a direct user-journey violation even though the command includes expected version/idempotency.

Minimal root fix: close/retain detail context, open the foundation-backed confirmation Modal, and invoke the existing transition only from confirm; add focused cancel/confirm and overlay-lock proof.

### F3 — Head-company business status action bypasses required confirmation Modal (M, CONFIRMED)

`apps/frontend/operations-admin/src/features/head-company-management/ui/HeadCompanyManagementPage.tsx:343-350` likewise invokes `transition(selected)` directly. IA04 `IA04-BUSINESS-STATUS` requires `确认启用/停用“<名称>”？ [取消][确认]` with `useOverlayLock` (`...ia-04...md:49,53`). The existing direct mutation is not an acceptable substitute for the required interaction.

Minimal root fix: use the same foundation-backed status confirmation pattern as Store, with explicit cancel/confirm and focused interaction evidence.

### F4 — Package cannot claim implementation GO or L2 (M, CONFIRMED)

`doc/evidence/platform/rm1/p6/rm1p6-u03-package-input.json` is `ACTIVE_NOT_EXIT`; `rm1p6-u03-source-compliance-disposition.json` contains no rows; and `rm1p6-u03-final-ui-ia-control-alignment.json` is `PENDING` and explicitly says no L2 is authorized while the physical denominator remains unfinished. The package's business obligation is `REQUIRED_CURRENT_BYTE_DYNAMIC_HIERARCHY_AND_CAPABILITY`, but no package-exit receipt equality, source-compliance disposition, current-byte dynamic run, or separate business/cleanup L2 result is present. Static typecheck cannot close this obligation.

Minimal root fix: complete every declared source-compliance denominator and non-empty incremental receipt set, make final UI IA alignment PASS for the full physical denominator, then run the separately authorized managed L2 with business and cleanup conclusions reported independently.

### F5 — Operations static checks are green but are not dynamic evidence (S, CONFIRMED)

Fresh commands in `apps/frontend/operations-admin` returned `yarn typecheck` success and `yarn test` 10/10. This confirms the generated RTK read/write consumers, retired bulk-operation boundary tests, and TypeScript graph compile. It does not prove Store scope denial, the missing status Modals, owner readback under conflict, or the required current-byte business/cleanup run; those remain covered by F1–F4.

## Independently confirmed positive chains

- Brand candidate pagination is owner-owned and uses one predicate for count and page in `BusinessEntityService.pageBrands`; the Operations edge passes the exact query through and returns owner metadata. The typed in-use problem mapping has an explicit handler and focused test.
- Contract list/candidate queries retain project scope and shared count/page predicates; create/update/invalidate use owner commands, expected-version CAS and readback; dynamic extension definitions are resolved from the owner. Contract invalidate has the required confirmation Modal and no operation column.
- Generated `operations-edge`/`operations-edge.rtk` clients are the operations read/write path; the static boundary test rejects the retired bulk brand-replace operation. Store and Contract list surfaces use identifier links/detail Drawers without operation columns.
- `apps/frontend/operations-admin` typecheck and architecture tests are green as reported above.

These positives are static/focused proof only and do not offset F1–F4.

## Verdict

`NO-GO` for RM1P6-U03 implementation closure and any joint P6-2/P6-3 L2 start. F1–F3 are confirmed user-data authorization/interaction defects; F4 is a confirmed package-evidence gate failure. A second review round may only be a fresh, targeted verification after the owner-scope and two confirmation-Modal fixes plus complete receipt/IA evidence; no third round is implied.

