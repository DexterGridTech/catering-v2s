# TER third-party usage remediation implementation review input checklist

REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-09-29-ter-third-party-usage-remediation-implementation-review-input-checklist-codex.md
blindReviewDeclaration=first falsify implementation and form findings/verdict before reading author review or dispositions

| Required input | Path, command, or session input | Read / result |
|---|---|---|
| Codex entry | `AGENTS.md` | READ by independent reviewer |
| Claude entry | `CLAUDE.md` | READ by independent reviewer |
| Current assignment and authorization | This round: review the implemented TER third-party-library remediation against requirements v3.4 and the accepted design/plan. W5, W7, W8, W10 are Dexter-waived. Remaining dynamic validation is Web-only; do not run Android/device/VM, L2, DEV, seed, reset, UAT, install, or build. Review only; do not write workspace files. | READ; reviewer followed review-only and no-device boundary |
| All kernels | `project-memory/kernel/*.md` (all files) | READ; reviewer reported all six kernels |
| Six-dimension route | Attempted `scripts/context/recall-memory --task-kind review --domain platform --consumer-face terminal --owner frontend-platform --impact evidence --trigger implementation` | READ_FAIL: `consumer-face=terminal` is not a vocabulary value; command returned `unknown or non-specific route: consumerFaces:terminal` (exit 2). See intake record; failed route is preserved. |
| Every routed hit and applicable source ref | Record every path returned by the route above; include TER coding standard, architecture/build rulings, input/keyboard practice, third-party usage standard and any additional returned refs | Supplemental valid platform-admin/operations-admin routes plus direct TER source references were used; these are not represented as a dedicated TER face. |
| Per-change prewrite reread, when applicable | Review the plan's CP change inventory and the recent runner repair in `scripts/test/ter-admin-display-web.mjs` against the relevant requirement/design, owning sources and reusable runner behavior | Reviewer inspected plan, runner, and owning sources; prior CP prewrite reads remain represented by existing pointwise records, not newly re-performed. |
| Per-change post-proof reread, when applicable | Inspect the resulting runner source plus `node --check` and final-byte managed Web run manifests listed in the handoff; do not infer device/native proof | READ: runner direction selection at lines 30–41, mobile admin navigation at lines 593–598, runtime assertions at lines 600–610; node syntax and final manifests reviewed. No device/native inference. |
| Corpus search | Search confirmed-business-language corpus for `third-party`, `TER`, `keyboard`, `terminal`, and `runtime`; record matched entries or `NO_CORPUS_ENTRY_MATCHED` | Reviewer reports search completed; no product-language contradiction was reported. |
| Reviewed object | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md` (v3.4), `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`, `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md` | READ; independent verdict formed before author disposition materials. |
| Applicable source inputs | The implementation source/file inventories in the design and plan, all corresponding current source/tests/configuration, and `scripts/test/ter-admin-display-web.mjs` | Read-only source review; non-empty source-facts inventory returned. |
| Relevant decisions | List all `doc/decisions/*.md` titles, then read the applicable third-party, TER architecture, verification, TR-16/17, runtime and package decisions in full | Reviewer reports applicable decisions and standards read; no design mismatch finding. |
| Applicable standards | `doc/platform/implementation-task-template.md`; `doc/platform/terminal-coding-standard.md` including TR-08/TR-10/TR-11/TR-16/TR-17/§7.1; `doc/platform/third-party-library-usage-standard.md`; `doc/platform/review-standard.md`; `doc/decisions/2026-07-24-v2s-verification-governance.md`; applicable templates and routed coding standards | READ, per independent reviewer report. |
| Author materials excluded until verdict | Do not read Codex self-review/intake/disposition or Claude review files until the independent findings and verdict are formed | Blind-review declaration: satisfied; `authorMaterialReadAfterIndependentVerdict=false`. |

The reviewer must first try to falsify the implementation, extract a non-empty source-facts inventory, reconcile it against the approved design, perform same-root scans for any finding, and list user-visible facts in static/test/verified-by-nobody tiers. The independent verdict must follow `doc/platform/review-standard.md` §5, including `L2_USER_VISIBLE`, `L3_UNVERIFIED`, `SAME_ROOT_SCAN`, and `DESIGN_GAPS`.

## Independent result received

`REVIEW_TARGET=IMPLEMENTATION`; `ACTION_1_VARIANT=1-A`; `VERDICT=GO_WITH_UNVERIFIED_UI`; `M/S/N=0/0/3`; `reviewerKind=INDEPENDENT_SUBAGENT`. No blocking code or same-root false-green issue was reported. The three N findings and main-agent intake are recorded in `2026-09-29-ter-third-party-usage-remediation-implementation-independent-review-codex.md`.
