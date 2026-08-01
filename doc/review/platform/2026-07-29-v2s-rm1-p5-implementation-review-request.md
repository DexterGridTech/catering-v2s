---
reviewType: IMPLEMENTATION_ADVERSARIAL_REVIEW_REQUEST
REVIEW_CYCLE_ID: RM1-P5-IMPLEMENTATION-20260729
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
---

# RM1 P5 implementation independent-review request

## Business purpose and approved boundary

P5 repairs reliability of existing platform-admin and operations-admin management work; it does not add a Journey, UI task, server API, data model, DEV, seed, or reset. The business owning sources are `G-03`, `G-05`, and `G-10` in `project-memory/decisions/confirmed-business-language-corpus.md`: an operations user enters the role-matched home after login, may switch appointment/context, and the two admin applications remain distinct. The approved P5 source is `### RM1-P5｜前端基础架构` in `doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md`; it assigns genuine RTK `build.query`/tag consumers, write/read convergence, 401/abort/recovery, generation protection, failure retention, and ST-9 to this package.

## Reviewed current implementation

The reviewer must independently reopen, before reading any author conclusion:

1. `scripts/generate/edge-codegen.mjs` and generated `*-edge.rtk.ts` outputs: every generated GET must be a typed `build.query`, each write a `build.mutation`, and a page must be able to construct an operation request without handwritten operation id, method, or URL.
2. `PlatformApi.ts`, `PlatformTransport.ts`, `OperationsApi.ts`, and `OperationsTransport.ts`: endpoint binding, tag invalidation, app-owned 401/abort/reset behavior, multipart encoding, and the rule that feature imports only the transport facade rather than raw API source.
3. The exact 15 P5 list consumers named by `doc/evidence/platform/rm1/p5/rm1-u08-review-remediation-problem-family.json`: all must be active generated RTK query subscribers; no `RefreshSignal + local load()` can remain as its list freshness authority. Dynamic user-management target hooks must obey hook call order and use `skip` rather than conditional hook calls.
4. The finite non-list asynchronous read denominator in the same discovery evidence: success and failure state writes must be owned by `useAsyncGenerationGuard` or the stated lifecycle-cancellation counterexample.
5. Generated-output receipt integrity: the P5 replay receipt `edge-codegen-rm1-u08-rtk-replay-001.{pre,post}.json` must form exact hash edges from the package baseline through the controlled placeholder replay to the final generated files; default generator invocation must fail closed and `--write-receipt` must validate its own exact changed set.

Known out-of-scope condition: `HeadCompanyManagementPage.tsx` still references the retired `replaceOperationsOrganizationHeadCompanyBrandAuthorizations` API. It is P6/P3-D-owned; reviewers must report whether any P5 change worsens it, but must not require its implementation here.

## Required review method and evidence

Use `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md` in full. First try to falsify the reviewed implementation and write a verdict before reading author self-review or disposition. Reopen all current bytes, run/inspect the static commands below, search same-root counterexamples, and classify each finding `CONFIRMED`, `PARTIALLY_CONFIRMED`, `REJECTED_WITH_EVIDENCE`, `UNVERIFIED_REQUIRES_EVIDENCE`, or `DEXTER_DECISION`.

Required static evidence:

- `node scripts/generate/edge-codegen.mjs --check`
- `node scripts/generate/edge-codegen.mjs --self-test`
- `yarn --cwd apps/frontend/platform-admin typecheck`
- `yarn --cwd apps/frontend/operations-admin typecheck` (separate the known P6/P3-D error from P5)
- `yarn exec eslint "apps/frontend/*/src/**/*.{ts,tsx}" "libraries/frontend/admin-ui-foundation/src/**/*.{ts,tsx}" --max-warnings=0`
- `yarn --cwd libraries/frontend/admin-ui-foundation test`
- `yarn --cwd apps/frontend/platform-admin test`
- `yarn --cwd apps/frontend/operations-admin test`
- `scripts/check/frontend-architecture`
- `node tools/compliance-control/cli.mjs validate-delta-receipts`
- `node tools/compliance-control/cli.mjs static-scan`
- `scripts/check/standards-coverage --phase R5`

The result must be saved as `doc/review/platform/2026-07-29-v2s-rm1-p5-implementation-review-round1-codex.md`, with the required front matter, source path+hash checklist, blind-review declaration, M/S/N counts, explicit `GO`/`NO-GO`, and no author-written verdict.
