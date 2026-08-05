---
title: RP-02a implementation authority binding
status: DEXTER_AUTHORIZED_PENDING_DESIGN_GO
createdAt: 2026-08-05
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# RP-02a implementation authority binding

Dexter has authorized continuation into the RP-02a implementation track after the S0 final design
recheck (`2026-08-05-v2s-whole-engineering-s0-final-recheck-claude.md`, GO M=0/S=0/N=1).
This document records the boundary, not a blanket repository permission.

```text
IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED_PENDING_DESIGN_GO
DESIGN_CYCLE=WHOLE-ENGINEERING-RP-02A-DESIGN-20260805
IMPLEMENTATION_CYCLE=WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
ALLOWED_UNIT=WHOLE-ENGINEERING-RP-02A-U01
RUNTIME_AUTHORITY=false
SEED_RESET_AUTHORITY=false
UAT_AUTHORITY=false
```

## Allowed after design GO

Only a new exact-surface active package may set `implementationAuthority=true`. Its surface must
include the RP-02a catalog, scenario/workload/test/fixture files, the explicit crosswalk evidence,
and package-exit receipts. No backend owner, OpenAPI schema, generated client, frontend, database,
Roadmap, runtime, DEV, UAT, reset or seed path is in this unit.

## Required before activation

1. Fresh independent subagent blind `REVIEW_TARGET=DESIGN` verdict for cycle
   `WHOLE-ENGINEERING-RP-02A-DESIGN-20260805`, with at most two rounds.
2. Author dialectical intake that reopens the original problem, routed memory, owning sources,
   counterexamples and applicability for every finding.
3. Claude design review with the exact granularity manifest and independent report attached.
4. A new implementation package and a new `REVIEW_TARGET=IMPLEMENTATION` independent review cycle
   after code changes; design GO cannot substitute for implementation review.

## Forbidden pseudo-authority

The S0 GO does not authorize HTTP/L2/seed/reset/UAT. Historical run evidence does not upgrade this
static unit to business PASS. If the implementation package needs a path outside the exact RP-02a
surface, stop and create a new Dexter decision rather than widening this document silently.
