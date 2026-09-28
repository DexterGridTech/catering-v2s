# Independent subagent adversarial review input checklist — v3.3 round 1

REVIEW_CYCLE_ID=TER-THIRD-PARTY-REMEDIATION-DESIGN-V3-3-2026-09-28  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT

Reviewer instruction: first try to falsify the reviewed v3.3 requirements/design/plan; form findings and a verdict before reading the author’s OPEN/design-gap section, prior v3.2 reviews, or any author disposition. Do not implement or edit files. Return read-only findings with exact path/line, evidence, counterexample, severity, and executable acceptance criterion.

| Required input | Path, command, or session input | Read / result |
|---|---|---|
| Codex entry | `AGENTS.md` | REQUIRED — read full |
| Claude entry | `CLAUDE.md` | REQUIRED — read full |
| Platform entry | `PLATFORM-BLUEPRINT.md` | REQUIRED — read full |
| Platform docs entry | `doc/platform/README.md` | REQUIRED — read full |
| Current assignment and authorization | Main-agent prompt includes Dexter’s v3.3 assignment, design-only boundary, and final acceptance supplement | REQUIRED |
| All kernels | `project-memory/kernel/01-workspace-and-authorization.md`, `02-service-shape-and-owner.md`, `03-transaction-data-and-dependencies.md`, `04-contract-consumer-and-admin.md`, `05-evidence-runtime-and-git.md`, `06-heritage-and-change.md` | REQUIRED — all six |
| Six-dimension route A | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner platform --impact architecture --trigger task-start` | Run; `platform-admin` is only the accepted retrieval proxy, not TER’s product consumer-face; reopen all hits and applicable `sourceRefs` |
| Six-dimension route B | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner frontend-platform --impact runtime --trigger task-start` | Run; reopen all hits and applicable `sourceRefs` |
| Six-dimension route C | `scripts/context/recall-memory --task-kind testing --domain platform --consumer-face platform-admin --owner platform --impact evidence --trigger implementation` | Run; reopen all hits and applicable `sourceRefs` |
| TER-specific routed memory | `project-memory/operations/terminal-coding-standard.md`; `project-memory/decisions/terminal-architecture-and-stack-rulings.md`; `project-memory/decisions/terminal-build-order-and-batches.md`; `project-memory/practices/ter-input-and-virtual-keyboard-usage.md` | REQUIRED — read full |
| Applicable operating/model memory | Every route hit and applicable owning `sourceRefs` | REQUIRED — all applicable hits |
| Confirmed business corpus | `project-memory/decisions/confirmed-business-language-corpus.md`; search `TER`, `terminal`, `topology`, `display`, `input`, `keyboard`, `runtime`, `member`, `staff` | Record matched entry or `NO_CORPUS_ENTRY_MATCHED` with terms |
| Applicable decisions | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`; `doc/decisions/2026-07-24-v2s-verification-governance.md`; applicable T-3/T-4 source and project-memory ruling | REQUIRED — read applicable sections/full source |
| Third-party standard | `doc/platform/third-party-library-usage-standard.md` | REQUIRED — read full |
| TER standard | `doc/platform/terminal-coding-standard.md` | REQUIRED — read TR-08, TR-10, TR-11, TR-16, TR-17 and §7.1 |
| Implementation/task standard | `doc/platform/implementation-task-template.md`; `doc/decisions/templates/implementation-design-template.md`; `doc/decisions/templates/ia-design-template.md`; `doc/decisions/templates/ui-interaction-design-template.md`; `doc/decisions/templates/journey-decision-template.md` | REQUIRED — check each template’s applicability/completeness |
| Architecture and review standards | `doc/platform/foundation-charter.md` §§1-J/1-K; `doc/platform/frontend-coding-standard.md`; `doc/platform/backend-coding-standard.md`; `doc/platform/review-standard.md`; `doc/platform/agent-operating-model.md` §3 | REQUIRED — applicable sections |
| Skills | `.agents/skills/cs-spec-to-plan/SKILL.md`; `.agents/skills/cs-writing-plans/SKILL.md`; `.agents/skills/cs-third-party-library-usage/SKILL.md` | REQUIRED — verify design/plan follows them |
| Sole requirements input | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md` | READ_FULL — verify v3.3, F-32, TP-A7/A8/A9 two-machine acceptance, and final two-part acceptance |
| Detailed design | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md` | READ_FULL; defer §12 OPENs and §13 disposition until independent findings/verdict are recorded |
| Implementation plan | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md` | READ_FULL |
| Current topology runner/source | `tools/terminal-topology/run-dual-device.mjs` and its direct imports/helpers | Inspect `parseArgs`, stage-1 shape/serial/output, both profiles, `runProfile` calls, `pairDevices`, `runMemberJourney`, reconnect/unpair flows, event/log/cleanup evidence; independently assess each proposed harness extension |
| Current transport/runtime source | `kernel/base/contracts/topology-transport.config.json`; production registry/server/transport owners and their focused JVM tests | Verify heartbeat production values, same-registry socket test feasibility, payload and close-event observability, and that VM scenarios do not substitute for JVM proof |
| Current device runner/source | `scripts/test/ter-virtual-keyboard-android.mjs`; `scripts/test/ter-admin-display-android.mjs`; read-only device inventory evidence if needed | Assess serial-specific managed-entry readiness claims; do not launch, install, build, or mutate device state |
| Prior material, only after verdict | v3.2 round-1/round-2 checklists and reports, prior Claude/design reviews, and author disposition sections | Compare only after independent findings/verdict are written; do not inherit verdict or cycle count |

## v3.3 topology acceptance focus

- Treat final acceptance as two required halves: all applicable non-topology scenes on the single-machine dual-screen physical device and mobile VM, with TR-16 Web-first on matching source bytes; topology scenes on two single-display laptop VMs. Both halves are required.
- Verify the complete topology denominator includes TP-A7, TP-A8, TP-A9 two-machine acceptance plus every existing managed stage-1 pairing/synchronization/recovery scenario; identify any omitted current runner path or overclaimed scene.
- For TP-A7, verify heartbeat-only duration is at least `3 ×` production `heartbeatTimeoutMs` on each required app profile; throughout it there must be no disconnect/reconnect or non-heartbeat traffic. Confirm the planned event/readback evidence is actually obtainable from the managed entry or is explicitly designed as a harness extension with focused proof.
- Confirm two laptop serials are sampled immediately before topology run, each device is a one-logical-display/no-Virtual-Display laptop, and the run uses stage 1 plus explicit output path; do not use stage-2 `dual` as physical dual-screen proof.
- JVM real-socket tests remain an independent prerequisite and are not replaced by laptop-VM runs. Topology device runs occupy both VMs and cannot overlap other managed runs.
- Check all non-topology scenes remain Web-before-device and that OPEN/NOT_COVERED distinctions are not used to erase missing hardware, credentials, or runner capability.

## Blind-review declaration

`I received this checklist in a fresh subagent context, attempted to falsify the v3.3 requirements/design/plan, and wrote findings and verdict before reading the deferred author disposition or prior review verdicts.`  
`I treated missing or substituted required inputs as findings; I did not modify files or perform implementation, installation, build, Web, Android, or device runs.`
