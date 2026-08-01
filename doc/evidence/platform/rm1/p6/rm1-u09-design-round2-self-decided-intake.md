---
title: RM1 P6 implementation-facing design round-2 self-decided intake
status: POST_REMEDIATION_AWAITING_CLAUDE_RECHECK
reviewTarget: DESIGN
implementationAuthority: false
---

# RM1 P6 implementation-facing design Round 2 final intake

`REVIEW_CYCLE_ID=RM1-P6-IMPLEMENTATION-FACING-DESIGN-20260729`  
`REVIEW_ROUND=2`  
`ROUND_FINAL_DECISION=SELF_DECIDED`  
`furtherCodexAdversarialRoundAllowed=false`

The second independent subagent verdict was `NO_GO (M=2/S=0/N=0)`.  Its governed two-round limit prohibits a
third independent Codex adversarial review.  The author reopened the owning sources and makes the following
bounded, post-remediation disposition; the current bytes are explicitly **not** represented as historically
reviewed green and require Claude recheck.

| finding | independent source reopened | author classification | bounded current-byte remediation |
| --- | --- | --- | --- |
| `RM1-P6-DESIGN-R2-M-001` | accepted IA01 invitation Drawer/Modal screens; IA05 user/revoke screens; carry-over `foundationConsumptionBySurface`; final roster | `CONFIRMED` | Added `rm1-u09-physical-screen-import-contracts.md`. It breaks every grouped row into physical content page, Drawer, Modal, selector or public step with one final path, one primitive set, generated operation/N-A and sibling focused test. In particular, the five user pages, user detail/revoke, invitation actions/create/detail/action are separate contracts; create includes `useAsyncGenerationGuard`, and both action Modals include `useSubmissionLifecycle`. Accepted interaction/copy/control is unchanged; later Claude remediation corrects and expands the implementation-facing foundation primitive bindings only. |
| `RM1-P6-DESIGN-R2-M-002` | `scripts/context/recall-memory`; `project-memory/index.json`; U01 memory route | `CONFIRMED` | Changed U01 from prohibited `consumerFace=all` to executable `platform-admin`, reopened the resulting ten-source D1 set, and retained its exact path/hash/Assertions bindings. The public and operations consumer obligations remain explicit in the non-catalog phase mapping; D1 is now a reproducible primary contract-owner route rather than a non-specific aggregate. |

The smaller alternative—leave the roster as a broad feature map or weaken recall—was rejected because it would
move foundation and memory-route decisions into implementation.  No product/Journey decision is needed: all
screens, user tasks, copy and serial phases are unchanged.  The remaining recheck is external Claude review of
the declared post-remediation bytes; it does not reopen the exhausted independent-subagent cycle.
