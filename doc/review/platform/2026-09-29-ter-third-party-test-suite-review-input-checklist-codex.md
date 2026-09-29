# TER third-party test-suite review input checklist

Review scope: current TER third-party remediation test scripts and test cases only. The reviewer is read-only; do not run tests, start Web/Metro/device processes, use computer/UI automation, or edit files. Form findings and verdict from owning sources before reading author review/disposition material.

| Required input | Path or command | Read / result |
| --- | --- | --- |
| Codex entry | `AGENTS.md` | REQUIRED |
| Claude entry | `CLAUDE.md` | REQUIRED |
| Current assignment and authorization | User's latest task: comprehensively review test scripts/cases, fix before rerunning; remaining dynamic scope is Web only; W5/W7/W8/W10 waived | REQUIRED |
| All kernels | `project-memory/kernel/*.md` | REQUIRED |
| Six-dimension route | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact evidence --trigger review` | RUN and read all hits/source refs |
| Reviewed requirement | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md` v3.4 | READ_FULL |
| Reviewed design | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md` | READ_FULL |
| Reviewed plan | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md` | READ_FULL |
| Applicable standards | `doc/platform/terminal-coding-standard.md` (TR-16/TR-17), `doc/platform/third-party-library-usage-standard.md`, `doc/platform/review-standard.md`, `doc/decisions/2026-07-24-v2s-verification-governance.md` | READ |
| Test/runtime scripts | `scripts/test/ter-admin-display-web.mjs`, `scripts/test/ter-admin-display-android.mjs`, `scripts/test/ter-virtual-keyboard-android.mjs`, `tools/terminal-topology/run-dual-device.mjs`, and their directly related focused tests | READ relevant full files/sections |
| Test cases/owners | Current CP and TP focused test files plus production consumer/registry sources referenced by the W/T matrices | Trace criterion → test/runner assertion → false-green counterexample |
| Corpus search | Search requirement labels and user-facing business terms in `project-memory/decisions/confirmed-business-language-corpus.md` and related corpus | Record exact hits or `NO_CORPUS_ENTRY_MATCHED` |
| Decisions | List `doc/decisions/` titles; read applicable TER, verification, and independent-review decisions | REQUIRED |
| Blind-review declaration | Findings/verdict formed before reading author reports/dispositions | REQUIRED |

Expected output: concise `GO`/`NO-GO`, `M/S/N`, only confirmed or evidenced findings, exact path/line, false-green or wasted-run counterexample, and smallest test/runner-level repair. Do not propose product behavior changes.
