---
title: catering-v2s R4 whole-scope design acceptance and implementation authorization
status: DEXTER_ACCEPTED_AND_IMPLEMENTATION_AUTHORIZED
createdAt: 2026-07-25
acceptedBy: Dexter
programId: V2S_W0_W4_EXECUTION
roadmapStep: R4
implementationAuthority: true
runtimeAuthority: true
seedResetAuthority: false
---

# R4 whole-scope design acceptance and implementation authorization

## 1. Accepted packet

Dexter accepts the R4 whole-scope implementation-facing design, including its Claude
`GO(0 M / 0 S / 2 N)` review and the completed N-1/N-2 resolutions:

- `doc/plans/platform/2026-07-25-v2s-r4-machine-gates-and-verification-implementation-design.md`;
- `doc/review/platform/2026-07-25-v2s-r4-design-granularity-manifest.json`;
- `doc/review/platform/2026-07-25-v2s-r4-design-adversarial-review-round-2.json`;
- `doc/review/platform/2026-07-25-v2s-r4-whole-scope-design-review-claude.md`.

## 2. Exact implementation authority

Codex is authorized to implement and verify the accepted R4-U01 through R4-U08 package in
the approved serial order. This includes approved production validators, scripts, schemas,
test source, controlled Testcontainers/scratch execution, true red mutations, evidence and
the R4 review packet. It does not authorize new business Journey/UI behavior, restoration of
J02/C-02, operations-admin login, TDP runtime/contract/schema/migration/generated wire,
MQ/outbox/polling/new deployable, DEV start, seed or reset.

```text
R4_DESIGN_ACCEPTED=true
R4_IMPLEMENTATION_AUTHORIZED=true
R4_RUNTIME_AUTHORIZED=true
R4_SEED_RESET_AUTHORIZED=false
R4_SCOPE=R4-U01..R4-U08_ONLY
```

## 3. Completion boundary

R4 is not complete merely because a validator exists. Completion requires every due
machine-enforceable matrix row to be backed by its real gate/ArchUnit/negative fixture,
`scripts/verify` to be minute-scale with behavior-changing red evidence, the required
business/cleanup distinctions, an independent-subagent `REVIEW_TARGET=IMPLEMENTATION`
review, Claude review, and Dexter acceptance. `MIGRATION_GATES_READY` remains false until
that sequence closes.
