# Independent subagent adversarial review input checklist — v3.3 round 2

```text
REVIEW_CYCLE_ID=TER-THIRD-PARTY-REMEDIATION-DESIGN-V3-3-2026-09-28
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
```

Reviewer instruction: This is the cycle's final targeted round. First attempt to falsify the current requirements/design/plan and form findings plus verdict before opening the deferred author disposition and round-1 report. After recording that independent verdict, compare round-1 findings and check whether each is actually closed. Do not implement or edit files; no install, build, test, Web, Android, emulator, device or data operation.

| Required input | Path / command | Read / result |
|---|---|---|
| Codex entry | `AGENTS.md` | REQUIRED — full |
| Claude entry | `CLAUDE.md` | REQUIRED — full |
| Platform blueprint | `PLATFORM-BLUEPRINT.md` | REQUIRED — full |
| Platform docs entry | `doc/platform/README.md` | REQUIRED — full |
| Dexter assignment and authorization | This reviewer prompt, including v3.3 assignment, no implementation boundary, topology acceptance supplement, and dynamic-serial instruction | REQUIRED — read |
| All kernels | `project-memory/kernel/*.md` | REQUIRED — read all six |
| Six-dimension memory routes | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner platform --impact architecture --trigger task-start`; `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner frontend-platform --impact runtime --trigger task-start`; `scripts/context/recall-memory --task-kind testing --domain platform --consumer-face platform-admin --owner platform --impact evidence --trigger implementation` | REQUIRED — run; open every hit and applicable `sourceRefs`; `platform-admin` is retrieval proxy only |
| TER memory | `project-memory/operations/terminal-coding-standard.md`; `project-memory/decisions/terminal-architecture-and-stack-rulings.md`; `project-memory/decisions/terminal-build-order-and-batches.md`; `project-memory/practices/ter-input-and-virtual-keyboard-usage.md` | REQUIRED — full |
| Corpus | `project-memory/decisions/confirmed-business-language-corpus.md`; search `TER`, `terminal`, `topology`, `display`, `input`, `keyboard`, `runtime`, `member`, `staff` | Record matches or `NO_CORPUS_ENTRY_MATCHED` with terms |
| Applicable decisions | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`; `doc/decisions/2026-07-24-v2s-verification-governance.md`; T-3/T-4 owning sources and applicable decisions | REQUIRED — relevant full sources |
| Applicable standards | `doc/platform/third-party-library-usage-standard.md`; `doc/platform/terminal-coding-standard.md` TR-08/TR-10/TR-11/TR-16/TR-17/§7.1; `doc/platform/implementation-task-template.md`; `doc/platform/foundation-charter.md` §§1-J/1-K; frontend/backend coding standards; `doc/platform/review-standard.md`; `doc/platform/agent-operating-model.md` §3 | REQUIRED — applicable sections/full as specified |
| Templates and skills | `doc/decisions/templates/{implementation-design,ia-design,ui-interaction-design,journey-decision}-template.md`; `.agents/skills/cs-spec-to-plan/SKILL.md`; `.agents/skills/cs-writing-plans/SKILL.md`; `.agents/skills/cs-third-party-library-usage/SKILL.md` | REQUIRED — check completeness/applicability |
| Sole requirement | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md` | READ FULL — v3.3, TP-A7/A8/A9, two acceptance halves, F-32 |
| Reviewed design | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md` | READ FULL; form independent findings first |
| Reviewed implementation plan | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md` | READ FULL; form independent findings first |
| Current topology runner | `tools/terminal-topology/run-dual-device.mjs` and direct helpers/imports | Read-only inspect current serial defaults, discovery/shape binding feasibility, `coldLaunch` data clear, profile/run denominator and evidence handling |
| Current heartbeat owners | `apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalTopology{HostRegistry,Server}.kt`; `apps/terminal/application/base/android/src/foundations/nativeTopology.ts`; `apps/terminal/kernel/base/transport/src/foundations/createTopologySession.ts`; production topology JSON config and focused JVM tests | Verify both NanoWSD control ping/pong and JSON heartbeat are distinct; challenge whether proposed event counters are observable without semantic changes or payload logging; confirm true production registry/socket/thread proof |
| Read-only device runner contracts | `scripts/test/ter-virtual-keyboard-android.mjs`; `scripts/test/ter-admin-display-android.mjs` | Assess dynamic target binding only; do not run commands against devices |
| Deferred author materials, only after verdict | `doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-independent-review-round1-codex.md` and any author disposition sections | Compare after recording independent verdict/findings; do not inherit its verdict |

## Round-2 target checks

- Each runtime invocation rediscovers current connected targets; no `emulator-5554`-style literal/default or list-order selection is used as a target identity. AVD name or physical/emulator properties plus live display shape must uniquely bind the two laptop VM roles; stale serial, ambiguity, or shape mismatch fails closed.
- Stage-1 final topology execution cannot clear app data. Inspect current `coldLaunch` `pm clear` and ensure the plan requires its removal and a red static/focused guard; VM recreation is not treated as authorization to wipe data.
- TP-A7 distinguishes NanoWSD control ping/pong from transport JSON `type=ping/pong` text frames. Verify counters/oracles are truly obtainable on both endpoints, with no raw payload/address logging, and require both families to advance while non-heartbeat text frames and connection churn remain zero over at least 3× production timeout.
- TP-A8 denominator contains all 18 current `runMemberJourney` labels and exact-set failure behavior; no summary replaces per-label observations.
- TP-A7/A8/A9 JVM proof uses real sockets via production registry path, production timeout for the required 3× idle interval, and a testable thread baseline/return oracle; laptop VM proof remains separate.
- Cross-check the five topology device scenarios against the current managed runner's full pair/recovery/unpair functions; no missing existing scenario and no accidental stage-2 virtual-display shape substitution.
- Confirm non-topology Web-before-device ordering, device split (dual-screen physical + mobile VM; topology on two laptop VMs), and no unauthorized install/build/data/device actions during this DESIGN cycle.

## Blind-review declaration

`I received this checklist in a fresh independent-subagent context, attempted to falsify the current design and plan, and wrote findings/verdict before reading author disposition or round-1 verdict.`
`I then compared the independent verdict against round-1 findings. I performed read-only inspection only and did not modify files or run dynamic/build/test actions.`
