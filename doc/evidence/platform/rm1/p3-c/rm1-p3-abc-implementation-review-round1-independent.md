---
title: RM1 P3-A+B+C implementation independent review, round 1
reviewTarget: IMPLEMENTATION
reviewCycleId: RM1-P3-ABC-IMPLEMENTATION
reviewRound: 1
reviewRoundLimit: 2
reviewerKind: INDEPENDENT_SUBAGENT
verdict: NO-GO
findings: M=1 / S=1 / N=0
recordedBy: Codex
createdAt: 2026-07-28
---

REVIEW_CYCLE_ID=RM1-P3-ABC-IMPLEMENTATION
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_DECLARATION=Fresh independent reviewer formed falsification-first findings from reopened production sources before author disposition material was considered.

# RM1 P3-A+B+C implementation independent review — round 1 record

This faithfully records the completed independent reviewer verdict; it is not a substitute verdict written by the implementation author.

## Re-opened inputs

- `doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md@8ea5d20a8d614cfc4fd9de0bebe946bee5a240d1b5bcbfe1943c0159aa384e3c`
- `doc/evidence/platform/rm1/p3-a/rm1-u02-package-exit.json@95f92181aaee90e795a143d96e713c49e4a6506870fe540b94fa6f7206294082`
- `doc/evidence/platform/rm1/p3-b/rm1-u03-package-exit.json@1e7efd4155faea2345927b038ccca3143455fb6c609ec5dd587bdb8113dbc1a5`
- then-current `doc/evidence/platform/rm1/p3-c/rm1-u04-package-exit.json@ba57b0755e058df6077ae981bb87117c448e3adf2940b01a55934283bc1eabd5`
- `libraries/backend/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceMembershipService.java`
- `contracts/openapi/components/workspace-iam/workspace-access.schemas.yaml` and `contracts/openapi/paths/operations-admin/workspace-access.paths.yaml`

## Verdict

**NO-GO**, `M=1 / S=1 / N=0`.

- **M1**: `WorkspaceMembershipService` used exact target-node matching rather than the organization owner’s server-derived task-path ancestor set. This incorrectly excluded descendants of selected `GROUP` or `REGION`. Required closure: owner lookup plus ancestor relation, with allowed descendant and peer-branch exclusion proof.
- **S1**: `scopeRef` was still advertised for invitation action and membership detail/revoke operations where it was unused. Required closure: keep it only on genuine selection/list surfaces and remove it from contract, generated outputs, controllers, and focused tests.

The review authorized neither a new package nor DEV, seed, reset, migration, Roadmap-state change, or a third independent-review round.
