---
title: catering-v2s R4 implementation-facing design authorization
status: DEXTER_AUTHORIZED_DESIGN_ONLY
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
roadmapStep: R4
decisionOwner: Dexter
implementationAuthority: false
---

# R4 implementation-facing design authorization

## 1. Decision

Dexter authorizes Codex to open and complete the single, whole-scope R4/W2
implementation-facing detailed design and implementation plan. R4 is the
verification-infrastructure step described by the current Roadmap, not a new
business Journey. The design may specify exact implementation units, paths,
validators, red mutations, runtime isolation and evidence, but it does not
authorize R4 implementation.

```text
R4_DESIGN_AUTHORIZED=true
R4_IMPLEMENTATION_AUTHORIZED=false
R4_RUNTIME_AUTHORIZED=false
R4_SEED_RESET_AUTHORIZED=false
R4_STATUS=DESIGN_READY_FOR_INDEPENDENT_REVIEW
```

## 2. Problem and stage intent

Before R5 business migration, Dexter needs a cheap and trustworthy answer to
“did this change break the frozen module, transaction, database, contract,
consumer-face, generated-wire, frontend-boundary, logging or retirement
rules?” The intended cost is a single minute-scale local verification command
plus focused true-database tests, without a CI platform, a second production
runtime, a browser run, a persistent DEV database or seeded data.

The recommended shape is one `scripts/verify` orchestrator over small native
validators. Each machine rule is accepted only when it is mechanical,
recurring and cheaper than the rework it prevents; semantic user-task and
solution-reasonableness judgments remain Codex/Claude/Dexter review work.

## 3. Explicit exclusions

- no R4 business Journey, login product, session model or UI feature;
- no restoration of R3-J02/C-02 and no operations-admin real login;
- no TDP runtime, contract, schema, migration, generated wire or business code;
- no MQ, generic outbox, polling, search service or new deployable;
- no DEV start, dynamic R4 run, seed/reset or application source change in this
  design-only authorization;
- no change to the R3 closure decision or its accepted implementation scope.

## 4. Acceptance boundary

This authorization is satisfied only by a complete R4 design packet whose
manifest covers all Roadmap R4 deliverables, maps Part B.1–B.6, Part C
normative groups and Part D chapters, declares exact paths and serial order,
defines business/cleanup evidence applicability, and passes the design
granularity and handoff checks. It must remain visibly separate from the later
R4 implementation and from the final `MIGRATION_GATES_READY` acceptance.

R4 implementation requires a later, separately recorded exact authorization.
