# TER third-party usage remediation implementation review input checklist

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=3
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-09-29-ter-third-party-usage-remediation-implementation-review-round3-input-checklist-codex.md
blindReviewDeclaration=first extract current-source facts and form findings/verdict; only then inspect author status and prior reviews
authorMaterialReadAfterIndependentVerdict=true
```

## Authorization and boundary

- Scope: TER third-party usage remediation requirements v3.4, implementation design, and implementation plan; review current implementation against the accepted design.
- Dexter has limited remaining dynamic validation to Web. W5, W7, W8, and W10 are explicitly waived and must not be treated as PASS. No Android/native/device/VM/topology/L2/DEV/seed/reset/UAT execution is authorized in this review.
- Review is read-only. Do not edit files. Do not start or stop services or managed runs. Static source inspection and already-existing manifests/logs are in scope.
- The review must independently classify `L1_ENGINEERING`, `L2_USER_VISIBLE`, `L3_UNVERIFIED`, `SAME_ROOT_SCAN`, `DESIGN_GAPS`, and `EVIDENCE_TIER`; if L3 is non-empty, do not issue bare GO.

## Required inputs

| Input | Required source / action | Reviewer record |
|---|---|---|
| Repository entry | Read `AGENTS.md`, `CLAUDE.md`, `PLATFORM-BLUEPRINT.md`, `doc/platform/README.md`, and `scripts/README.md` | Record completion |
| Project memory | Read every kernel in `project-memory/index.md`; run a valid six-dimension `scripts/memory/query` for TER implementation review; read every hit and applicable source ref | Record query dimensions and all hits |
| Business corpus | Search the confirmed business-language corpus for relevant TER terms; record matched entries or `NO_CORPUS_ENTRY_MATCHED` plus searched terms | Record result |
| Original task and requirement | Read the user-provided implementation authorization in the active conversation and `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md` v3.4 | Record exact scope and waivers |
| Accepted design and plan | Read `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md` and `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md` in full | Record applicable TP and W/T criteria |
| Standards and decisions | Read `doc/platform/implementation-task-template.md`, `doc/platform/terminal-coding-standard.md` (TR-08/TR-10/TR-11/TR-16/TR-17/§7.1), `doc/platform/third-party-library-usage-standard.md`, `doc/platform/review-standard.md`, `doc/decisions/2026-07-24-v2s-verification-governance.md`, and relevant TER decisions | Record clauses used |
| Current source | Extract non-empty user-visible/source facts first, then inspect all production/test/config/native files named by TP-A1/A3..A11, TP-B0..B5, TP-C1..C3, TP-D1..D4, TP-X1..X3; scan same-root siblings for each finding | Read-only; record exact paths/lines |
| Existing static evidence | Read CP-A..D and whole-batch reports in `doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/`; independently verify relevant source-level claims | Do not present author-reported output as independently run |
| Web dynamic evidence | After source findings are frozen, inspect `.runtime/ter-admin-display/ter-remediation-webonly*/run-manifest.json` and the exact referenced logs/screenshots; check source digests, business, cleanup, first failures, recovery, and applicable scenario coverage | Do not infer native/device/topology/full-visual results from Web |
| Review standard | Perform all five actions in `doc/platform/review-standard.md` §1 and reproduce its §5 verdict block; for code-present implementation use action 1-A | No empty extraction |
| Author material | Only after independently forming and freezing findings/verdict, read `doc/review/platform/2026-09-29-ter-third-party-usage-remediation-implementation-review-request-codex.md` and prior Codex/Claude reviews/dispositions | Record differences; do not inherit their verdicts |

## Review output

Return a read-only verdict in the agent response, not a file write. Include `REVIEW_TARGET=IMPLEMENTATION`, `REVIEW_ROUND=3`, `reviewerKind=INDEPENDENT_SUBAGENT`, this checklist path, blind-review declaration, `authorMaterialReadAfterIndependentVerdict=true`, `GO` / `GO_WITH_UNVERIFIED_UI` / `NO-GO`, and `M/S/N=x/y/z`. Each finding must cite the design and implementation locations, impact, minimum repair, evidence classification, and whether Dexter's decision is required. Include same-root scan counts and exact unverified inventory.
