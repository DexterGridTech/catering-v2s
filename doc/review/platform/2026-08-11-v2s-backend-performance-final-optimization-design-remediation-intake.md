# Final optimization DESIGN — Claude recheck remediation intake

`REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN`  
`REVIEW_STATUS=POST_REMEDIATION_AWAITING_CLAUDE`  
`implementationAuthority: false`

This intake records verified corrections to Claude's 2026-08-11 recheck. It does not
reopen the completed two-round independent subagent cycle, create an implementation
package, or authorize runtime, DEV, reset, seed, Testcontainers, L2/UAT, deployment,
manual SQL or SSH.

| Claude finding | Disposition | Evidence and bounded correction |
| --- | --- | --- |
| M-01, 45 non-M1 `cur` extraction may select arbitrary trailing references | `CONFIRMED` | The 45-row deterministic rederivation report applies `EDGE_DECLARED_OWNER_PROTOCOL_FIELD_CALL_V1`: it selects the declared injected owner/protocol field call in the edge method. Result: 45/45 rederived, 4 current `cur.tx`/`cur.chain` mismatches, 41 matches, zero `app/edge/**` and zero out-of-owner/protocol results. The four catalogue rows are corrected. BPF-U01 permanently rederives this surface and rejects absent, ambiguous, edge or out-of-owner anchors; ORIGIN/JOIN classification remains separate. |
| M-02, mandatory gate evaporates when a later package omits it | `CONFIRMED`; `DEXTER_DECISION=OPTION_2` | BPF-U01 makes `mandatoryPerEditGate` globally required in compliance-control and resolves only a finite independently reviewed profile closure. The command closure prevents arbitrary/weak package commands; compatibility fixtures cover active and future template archetypes so unrelated packages are not silently broken. Loader-once is explicitly runtime-only immutable-snapshot proof; static admission only controls source/caller registration. |
| S-01, core source-inventory/shape files can be marked update while absent | `CONFIRMED` | First creation remains `create`; later BPF-U04 update is legal only because it serially depends on BPF-U01 creation. The granularity tool receives the inverse check: update must already exist or have an earlier serial creating unit, with a real red mutation. |
| S-02, duplicate/adjacent existing performance gates and red controls were unmentioned | `CONFIRMED` | Gate topology now explicitly disposes `database-operation-budget`, `backend-performance-gate-dispositions`, `authority-source-ledger`, `backend-performance-read-budget`, and `backend-performance-final-fixture-catalog`; no control is assumed green or silently masked. The three new controls are registered through the finite dispositions ledger. |
| Mechanism-C fold can be semantically guessed under broad implementation delegation | `CONFIRMED` | Every fold declaration now requires `foldedJudgment`, `originalObservableSemantics`, `failingCounterexample`, and source/outcome preservation evidence. Any missing field rejects the fold; semantics remain review-owned. |
| 87 idempotency and 45 readback GAPs; 45 ORIGIN/JOIN choices could be guessed during edits | `CONFIRMED` | BPF-U01 has an explicit pre-source catalogue amendment and a one-time independent review receipt. Missing/ambiguous row blocks BPF-U02+; implementation agents may not decide these while changing adapters. |

## Boundary reconciliation

Claude's stricter examples `initializeCommercialGroup` (interface dispatch) and
`stagePlatformAsset` (delegating overload) are not extra mismatches under Dexter's
specified direct owner/protocol **field-call** rule: both edges dispatch their
declared public field. The rederivation report makes this distinction explicit and
requires BPF-U01 to classify their concrete `ORIGIN` or
`JOIN_EXISTING_REQUIRED_PARTICIPANT` separately. This neither suppresses a concrete
origin error nor invents a rule that rejects a valid API dispatch.

## Recheck conditions

Claude should recheck the current design, manifest, command catalogue, 196-row ledger
and rederivation report as one byte-bound set. A GO is still design-only: until that
GO, no static implementation package or dynamic environment may be created or run.
