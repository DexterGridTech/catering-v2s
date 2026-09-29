# TER third-party usage remediation final implementation review input checklist

REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-09-29-ter-third-party-usage-remediation-final-implementation-review-input-checklist-codex.md
blindReviewDeclaration=first falsify current implementation and form findings/verdict before reading prior reviewer verdicts or author dispositions

| Required input | Path / instruction | Read / result |
|---|---|---|
| Repository entry | `AGENTS.md`, `CLAUDE.md`, `PLATFORM-BLUEPRINT.md`, `doc/platform/README.md`, `scripts/README.md` | Reviewer completes independently |
| Project memory | Read `project-memory/index.md` kernels and use a valid `scripts/memory/query` six-dimension route; inspect every hit and owning source | Reviewer records exact route and source paths |
| Requirements | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md` (v3.4, sole requirement input) | Reviewer completes independently |
| Design and plan | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`; `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md` | Reviewer completes independently |
| Applicable standards | `doc/platform/implementation-task-template.md`; `doc/platform/terminal-coding-standard.md` (TR-08/TR-10/TR-11/TR-16/TR-17/§7.1); `doc/platform/third-party-library-usage-standard.md`; `doc/platform/review-standard.md`; applicable third-party and TER decisions/memory | Reviewer records applicable clauses and source facts |
| Current implementation | Current files named by the design/plan, tests, config, Gradle/native test entry, manifests, and `scripts/test/ter-admin-display-web.mjs`; include same-root sibling scan for findings | Read-only source review; no edits |
| Dynamic evidence boundary | Latest implementation review request and the explicitly listed Web manifests/logs only after initial source findings are formed | W5/W7/W8/W10 are Dexter-waived; remaining dynamic authorization is Web-only. Do not infer Android/native/device/topology or full visual PASS |
| Current W4 Web follow-up | `.runtime/ter-admin-display/ter-remediation-webonly-w4-*/run-manifest.json` and corresponding logs, especially waiting runs `01`–`04` and the three successful secondary-screen journeys | Reviewer checks business/cleanup, failure-family repair, owner-specific observations, source digests |
| Author material exclusion | Do not read earlier Codex implementation verdicts, review intake/disposition, or Claude findings until independent findings/verdict are formed | Reviewer confirms blind order |
| Execution boundary | Static review only; no computer use, writes, builds, installs, Web/Metro, Android/device/VM, L2/DEV/seed/reset/UAT | Reviewer confirms compliance |

The reviewer first extracts non-empty source facts, checks the accepted design against current implementation, and records `L1_ENGINEERING`, `L2_USER_VISIBLE`, `L3_UNVERIFIED`, `SAME_ROOT_SCAN`, `DESIGN_GAPS`, and `EVIDENCE_TIER`. Findings must identify precise design and implementation locations, impact, minimum repair, and whether Dexter's decision is required. Use `GO`, `GO_WITH_UNVERIFIED_UI`, or `NO-GO` with `M/S/N=x/y/z`; non-empty `L3_UNVERIFIED` forbids bare `GO`.
