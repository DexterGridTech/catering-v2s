---
title: RM1 P5 implementation independent adversarial review, round 1
reviewType: IMPLEMENTATION_ADVERSARIAL_REVIEW
REVIEW_CYCLE_ID: RM1-P5-IMPLEMENTATION-20260729
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
reviewerInputChecklist:
  path: doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md
  sha256: 4a02e5d802a65b49e0e94b3eb2c33b6c75707a42b1e8eef94c8b6de4d09459c9
blindReviewDeclaration: I received this checklist in a fresh subagent context, tried to falsify the reviewed implementation, and wrote my findings and verdict before reading author self-review or author finding disposition.
authorMaterialReadAfterIndependentVerdict: NOT_APPLICABLE_NO_AUTHOR_SELF_REVIEW_OR_DISPOSITION_PRESENT
scope: RM1-U08 / RM1-P5 current implementation bytes
authorizationBoundary: This review assesses only the approved P5 frontend reliability and consistency implementation. It neither authorizes a package exit, P6, P3-D, a Journey/UI change, backend/contract/data work, DEV, seed, reset, nor a dynamic environment.
---

# RM1 P5 implementation independent adversarial review — round 1

## Verdict

**GO (M=0 / S=0 / N=2).**

The approved P5 correction is proportionate. The former page-owned reload mechanism could not
turn a mutation into an active read-model refetch. The current smallest viable replacement keeps
the two app stores, sessions, routers and transports app-owned, while generator-owned operation
requests prevent a feature from inventing an operation ID, method or route. I found no P5-scoped
counterexample to generated GET/query and write/mutation construction, tag-driven active-list
refetch, the finite consumer denominator, async-generation ownership, raw-API isolation, or the
controlled generated-output chain.

This is an implementation review verdict, not a package-exit claim. `RM1-U08` remains
`ACTIVE_NOT_EXIT` until its author completes the separately required package-exit evidence and
finding intake.

## Reviewer input checklist

| Required input | Reopened source / command | SHA-256 or result | Result |
| --- | --- | --- | --- |
| AGENTS | `AGENTS.md` | `f179f36e0c…3384414` | READ |
| Claude entry | `CLAUDE.md` | `8b12b36e0c…aec50f` | READ |
| Current Roadmap | Registry-selected `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`, `CURRENT_STEP=R5`, `CURRENT_ACTIVITY=R5_CR05_WRITE_PATH_AND_UI_CONSISTENCY` | `5476287821…31c938` | READ |
| Exact P5 authorization | `doc/decisions/2026-07-28-v2s-rm1-implementation-facing-design-authorization.md`; current RM1-U08 binding `doc/evidence/platform/rm1/p5/rm1-u08-package-input.json` | `441a885541…033bd3`; `1eb37f26bd…0bec6` | READ |
| All kernel | `project-memory/kernel/01-workspace-and-roadmap.md`, `02-service-shape-and-owner.md`, `03-transaction-data-and-dependencies.md`, `04-contract-consumer-and-admin.md`, `05-evidence-runtime-and-git.md`, `06-heritage-and-change.md` | `f8add1ef…2bd63`, `45a26072…c032`, `f01d8e4e…5c44`, `1f6d9efb…a88d`, `101a8d99…a8d`, `5c52b17a…566c` | READ_ALL |
| Six-dimension route | `scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face platform-admin --owner frontend-platform --impact evidence --trigger review` | returned six kernels plus `verification-governance`, business corpus/read policy, systemic repair, parked-domain intake and incremental-hook memory | RUN |
| Routed hits | `project-memory/operations/verification-governance.md`, `decisions/confirmed-business-language-corpus.md`, `operations/business-corpus-adoption-and-read-policy.md`, `operations/phase-retrospective-and-systemic-repair.md`, `operations/business-corpus-parked-domain-intake.md`, `decisions/incremental-compliance-hook.md`, plus required `decisions/deterministic-context-only.md` and `decisions/independent-subagent-adversarial-review.md` | `090e9ce7…b577`, `51415f7…4503`, `04d93294…28353`, `0d84a50d…9e35`, `739473d0…ee9e`, `0e017902…f94d`, `4c98ed79…7e20`, `891fc8de…4daf` | READ_ALL |
| Applicable owning sources | relevant headings in `2026-07-24-v2s-verification-governance.md`, `2026-07-27-v2s-identified-finding-generalization-and-prevention.md`, `2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md`, `2026-07-25-v2s-frontend-foundation-consumption-rule.md`, and `2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | reopened at literal headings | READ_ALL |
| Corpus search | `operations user`, `role-matched home`, `context switch`, `platform-admin`, `operations-admin`, `URL` | G-03, G-05, G-10 read in full; P5 does not add a Journey or UI task | READ |
| Reviewed object | `doc/review/platform/2026-07-29-v2s-rm1-p5-implementation-review-request.md`, `doc/evidence/platform/rm1/p5/rm1-u08-implementation-amendment.md`, `doc/evidence/platform/rm1/p5/rm1-u08-review-remediation-problem-family.json` | `a383ffe3…f3965`, `25165de0…5bb`, `911c214d…8a8d` | READ_FULL |
| Frozen plan / manifest | `doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md` §RM1-P5; `doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json` RM1-U08 | `8ea5d20a…384e3c`; `50984c38…30fd1` | READ_ALL |
| Decisions directory | all 48 `doc/decisions/*.md` titles listed and relevant decisions reopened | title list reviewed; relevant full texts above | TITLES_REVIEWED |
| Standards / verification | `contracts/policy/standards-coverage-matrix.json`; `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6a9f7a70…101c5`; `c9632a65…829dc` | READ_CHECKLIST / READ |
| Current source and receipts | generator, both app API/transport layers, all three `*-edge.rtk.ts`, listed 15 consumer pages, `active-package.json`, controlled pre/post receipts | production bytes reopened; receipt hashes below | READ_ALL |

No author self-review or author finding-disposition file for this review round was read or available
before this verdict.

## Independent attacks and results

| Attack | Independent evidence | Result |
| --- | --- | --- |
| A generated read could still be a Promise-only client or a feature could handwrite the HTTP operation | `scripts/generate/edge-codegen.mjs` emits `build.query` for every GET, `build.mutation` for every write and a generated typed request helper. `node scripts/generate/edge-codegen.mjs --check` passed with 221 files; `--self-test` passed and reported red controls for a missing endpoint and missing request helper. | REJECTED_WITH_EVIDENCE |
| A write could not refetch an active list | Each generated GET provides `{wire, LIST}` and every mutation invalidates `{wire, LIST}`. The feature-facing generated client dispatches the same RTK mutation endpoint, so RTK performs its normal active-query invalidation rather than requiring a page reload. All 15 named list consumers subscribe through generated `use*Query` hooks. | REJECTED_WITH_EVIDENCE |
| `RefreshSignal + local load()` might still be the P5 list freshness authority | Same-root scan found `platformRefreshSignal` and `operationsRefreshSignal` only in the two app API/transport layers; no feature subscribes to it or invokes a local `load()`. The signals are therefore inert compatibility residue, not an authority for a listed read model. | REJECTED_WITH_EVIDENCE |
| The 15-list or five-target-hook denominator might have an omitted or conditionally-called hook | Seven platform consumers and eight operations consumers are active generated query subscribers. `WorkspaceUserPage.tsx` invokes all five target hooks unconditionally with `skip`; `WorkspaceInvitationPanel.tsx` does the same for five invitation and five candidate hooks. No conditional hook call was found. | REJECTED_WITH_EVIDENCE |
| A retained non-list async state writer might accept a stale success/failure | The finite discovery denominator was reopened. Candidate/detail/definition reads use `useAsyncGenerationGuard`; the stated audit modal counterexamples instead use a lifecycle cancellation flag and do not overlap the list denominator. No unowned success/failure state write was found in the listed P5 surface. | REJECTED_WITH_EVIDENCE |
| A feature could bypass its app transport or HTTP/error policy | Same-root imports show features consume transport facades plus generated types/request constructors, not `PlatformApi` or `OperationsApi`. App-owned transport dispatches RTK endpoints; 401 calls app recovery, local cleanup aborts requests before cache reset, multipart values are converted to `FormData`, and transport failures are `Error` instances (`PlatformApiFailure` / `ApiFailure`). | REJECTED_WITH_EVIDENCE |
| Generated-output evidence could jump from placeholder to final, or default generation could silently write | The three generated RTK files have per-file receipt paths `ABSENT → 2f37…596e → final` using `exec-cee…`, controlled `edge-codegen-rm1-u08-rtk-replay-001`, and `exec-6b…`; final hashes exactly match current bytes: platform `3c2a…b928`, operations `d540…b8a3`, public `c083…ff84`. `validate-delta-receipts` passed (`PACKAGE_ID=RM1-U08`, `CHANGED=52`, `RECOVERED=5`). A default generator invocation fails with `R5_EDGE_CODEGEN_CONTROLLED_WRITE_REQUIRED`; only `--write-receipt <id>` can write. | REJECTED_WITH_EVIDENCE |
| P6/P3-D retired R-24 work might be silently widened into P5 | Operations typecheck fails exactly at `HeadCompanyManagementPage.tsx:216,231` and `:239,45` for the retired `replaceOperationsOrganizationHeadCompanyBrandAuthorizations` reference. The P5 request, P5 plan, and P6/P3-D plan placement all identify that replacement as downstream work. P5 adds no replacement command or UI behavior. | REJECTED_WITH_EVIDENCE |

## Fresh static evidence

| Command | Result |
| --- | --- |
| `node scripts/generate/edge-codegen.mjs --check` | PASS (`FILES=221`) |
| `node scripts/generate/edge-codegen.mjs --self-test` | PASS; real red fixtures include missing RTK endpoint/helper and invalid controlled-write receipt |
| `yarn --cwd apps/frontend/platform-admin typecheck` | PASS |
| `yarn --cwd apps/frontend/operations-admin typecheck` | EXPECTED_DOWNSTREAM_FAILURE: only the two retired P6/P3-D API references above |
| `yarn exec eslint "apps/frontend/*/src/**/*.{ts,tsx}" "libraries/frontend/admin-ui-foundation/src/**/*.{ts,tsx}" --max-warnings=0` | PASS |
| `yarn --cwd libraries/frontend/admin-ui-foundation test` | PASS (7 tests) |
| `yarn --cwd apps/frontend/platform-admin test` | PASS (2 tests) |
| `yarn --cwd apps/frontend/operations-admin test` | PASS (6 tests) |
| `scripts/check/frontend-architecture` | PASS |
| `node tools/compliance-control/cli.mjs validate-delta-receipts` | PASS (`CHANGED=52`, `RECOVERED=5`) |
| `node tools/compliance-control/cli.mjs static-scan` | PASS (`RULES=28`, `MODE=RM1_STATIC_ADMISSION`) |
| `scripts/check/standards-coverage --phase R5` | PASS (`RULES=150`) |

## Findings

### N-01 — `RefreshSignal` is now unused compatibility residue

- **Classification:** CONFIRMED
- **Fact:** both app API/transport layers still create, export and publish `RefreshSignal`, while the
  P5 consumer denominator has no subscriber.
- **Impact:** no current list freshness failure; RTK tags own the active read-model refetch.
- **Boundary / counterexample:** removing this signal is not required for P5 correctness, and no
  consumer proves it is needed. Retain or delete it only with a bounded source/re-export audit so a
  future consumer cannot be broken by assumption.
- **Disposition:** N, not a GO blocker.

### N-02 — P5 should not claim a complete package exit yet

- **Classification:** CONFIRMED
- **Fact:** `rm1-u08-package-input.json` states `ACTIVE_NOT_EXIT`; no P5 package-exit artifact is
  present. The successful static commands and this review prove reviewed bytes, not the required
  package-exit/finding-intake closure.
- **Impact:** no implementation defect, but a premature package closure would contradict the
  evidence boundary.
- **Disposition:** N, not a GO blocker for this implementation review.

## Solution reasonableness and UI judgment

P5 fixes existing management-task reliability under G-03/G-05/G-10 without adding an operation,
screen, actor or URL. A per-page retry/load alternative would preserve duplicate request lifecycle
and refresh ownership; moving app session/router/cache state into foundation would violate the two
independent app boundary. Generator-owned operation-shaped RTK hooks plus app-owned transport is
the smaller solution that makes post-write readback converge without feature-written routes.

UI-bearing change is **NOT_APPLICABLE**: no user task or interaction shape changes. Error, 401,
abort and stale-response behavior are reliability semantics of existing tasks and are covered here
by the focused static/test evidence; this review grants no new UI behavior.

## Conclusion and authorization boundary

**GO (0 M / 0 S / 2 N)** for the current P5 implementation bytes. The known operations-admin
type errors are isolated P6/P3-D debt and do not justify P5 scope expansion. This verdict does not
authorize package exit, any next package, product decision, dynamic run, DEV, seed/reset, or
production/data change.
