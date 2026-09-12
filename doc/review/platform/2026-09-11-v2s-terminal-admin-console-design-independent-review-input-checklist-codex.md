# TER terminal admin console implementation-facing design independent-review input checklist

`REVIEW_TARGET=DESIGN`
`REVIEW_CYCLE_ID=TERMINAL_ADMIN_CONSOLE_DESIGN_20260911`
`REVIEW_ROUND_LIMIT=2`
`reviewerKind=INDEPENDENT_SUBAGENT`
`STATUS=INPUT_PACKAGE_ONLY_NOT_RUN`
`IMPLEMENTATION_AUTHORITY=false`

## 1. Use and independence boundary

This file is a future input checklist, not a review verdict. It must be given to a fresh independent read-only reviewer only after the design bundle is stable. The reviewer must form findings from the minimum source set below before reading any author self-review or historical conclusion. The author may perform only post-verdict dialectical intake; the author cannot write the independent verdict.

Run exactly two rounds for this design cycle:

- round 1: `REVIEW_ROUND=1`, find every reason the design does not hold;
- round 2: `REVIEW_ROUND=2`, targeted recheck of round-1 dispositions and new-byte regressions, with `ROUND_FINAL_DECISION=SELF_DECIDED`;
- `REVIEW_ROUND_LIMIT=2`; a renamed reviewer, renamed file, or local wording revision does not open a third round.

## 2. Minimum input set

The reviewer must read the current bytes of all of the following:

1. `AGENTS.md`;
2. `PLATFORM-BLUEPRINT.md`;
3. `doc/platform/README.md`;
4. `doc/platform/roadmap-program-registry.json` and the selected Roadmap authorization fields;
5. `project-memory/index.md`, all six-dimensional routed memory entries relevant to terminal/display/input/render/admin/design governance, and `scripts/README.md`;
6. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md` in full, including §9.2 and version history;
7. `doc/review/platform/2026-09-11-v2s-terminal-admin-console-poc-analysis-and-design-discussion-claude.md`;
8. the exact read-only POC paths named by the discussion document, if present; absence is a finding, not permission to invent equivalence;
9. `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md`;
10. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ia-design-codex.md`;
11. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md`;
12. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md`;
13. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md`;
14. `doc/platform/frontend-coding-standard.md`, `doc/platform/foundation-charter.md`, and the terminal coding standard;
15. the current owning source named by design §9b, not the requirements fact table; at minimum: catalog/selector/render/SurfaceContext/SurfaceHostController/input/primitives/vendor/platform-ports/Android device/sample assembly/dev-host/runtime/admin-shell paths;
16. the latest current static evidence, if it exists. Do not treat focused, welcome-text, or historical review material as complete visual acceptance.

## 3. Blind-review stance

Start from “find why this design does not hold”. Do not accept any of these without reopening the source:

- author-reported coverage counts, no-dangling claims, or red-fixture counts;
- any prior GO/NO-GO or “already fixed” statement;
- a type/field definition as proof of implementation behavior;
- a comment as proof of runtime behavior;
- a static/focused result as Web, Android, native, release, or visual PASS;
- a test that reaches a direct state setter instead of a real control action.

Recheck especially: physical-index host/source chain, Web host bool and pending snapshot, layer empty-container semantics, focus 0→1 edge, startup device-info call count, method-level capability descriptors outside DEV, IME truth-table, vendor keyboard suppression, PROD debug state, fallback password, dynamic canvas lifecycle, explicit host loading, same-catalog injected section, and all 59 criteria/parked §9.2 obligations.

## 4. Required finding format

Each finding must contain:

```text
ID=<stable reviewer id>
STATUS=CONFIRMED | PARTIALLY_CONFIRMED | REJECTED_WITH_EVIDENCE | UNVERIFIED_REQUIRES_EVIDENCE | DEXTER_DECISION
SEVERITY=M | S | N
PATH_OR_SYMBOL=<repo-relative path + line or unique symbol>
FAILURE_SCENARIO=<malicious but otherwise compliant implementation or concrete broken path>
IMPACT=<user/owner/evidence/sequence impact>
MINIMUM_FIX=<smallest repair and why a smaller repair fails>
DEXTER_DECISION_NEEDED=yes|no
EVIDENCE_TIER=static|focused|Web|Android|native|release|visual|missing
```

“Correct”, “consistent”, “covered”, or “works” without naming the comparison object is not a finding closure. A proposed fix that adds a second registry, overlay stack, input pipeline, or unnecessary consumer gate must be called out as over-design.

## 5. Round-2 prompt

Round 2 must receive the current design bytes and round-1 findings/dispositions only after it has independently reopened the minimum source set. For every round-1 item, verify the byte-level disposition, attempt the previous malicious implementation again, and scan the same-root sibling surface. Then scan for new regressions introduced by the disposition. Round 2 must end with `ROUND_FINAL_DECISION=SELF_DECIDED`; unresolved product/Journey/wireframe choices remain `DEXTER_DECISION`, not an invented GO.

