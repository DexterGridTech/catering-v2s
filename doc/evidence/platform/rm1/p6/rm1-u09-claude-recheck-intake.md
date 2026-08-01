---
title: RM1 P6 Claude implementation-facing design recheck intake
status: POST_REMEDIATION_AWAITING_CLAUDE_RECHECK
reviewTarget: DESIGN
implementationAuthority: false
---

# RM1 P6 Claude recheck intake

`REVIEW_CYCLE_ID=RM1-P6-IMPLEMENTATION-FACING-DESIGN-20260729`  
`REVIEW_ROUND=2` (the independent-subagent cycle remains exhausted)  
`EXTERNAL_RECHECK=Claude 2026-07-29 implementation-facing design NO-GO`  
`CURRENT_BYTES_NOT_REVIEWED_BY_ADVERSARIAL_SUBAGENT=true`

## Independent disposition

| Claude finding | classification after source reopen | bounded remediation |
| --- | --- | --- |
| M1 non-export import names | `CONFIRMED` | Replaced all 88 implementation-facing occurrences of `overlayLock`/`observedBaseQuery` with `useOverlayLock`/`createObservedBaseQuery`, both reopened from foundation `index.ts`. |
| M2 IA/physical primitive drift | `CONFIRMED` | Selected the non-invasive rule: every accepted IA `FOUNDATION_PRIMITIVE` is a lower bound; physical rows can only add exported primitives. Removed the two invalid password-result `NONE_WITH_REASON` claims and restored the cited login/Drawer bindings. No accepted IA byte, interaction, copy or control changed. |
| S1 platform authenticated shell absent | `CONFIRMED` | Added a supporting `IA02-PLATFORM-AUTHENTICATED-SHELL → PlatformApp.tsx` contract with its exact IA lower bound, focused test, and `NOT_APPLICABLE_WITH_REASON` that it is host chrome rather than an invented 23rd frozen catalog surface. |
| S2 P6-1 frontend root too broad | `CONFIRMED` | Limited U01 to each app's `src/app/api/generated` root; the target now says no UI path is permitted, making D4 enforce the no-UI phase boundary. |
| S3 REGION→PROJECT discriminator | `CONFIRMED` | Rewrote it as peer-REGION negative plus same-REGION positive control, matching catalog eligibility and `OrganizationTaskPathService.isScopeAllowed` ancestor containment. U01/U02 discriminators were reopened and are not analogous: both describe denied stale/cross-context state rather than legal type containment. |
| N concrete paths/count prose | `CONFIRMED` | Reconciled roster recovery paths to the physical step files and corrected P6-3 non-catalog count from four to five. |

The smaller alternative—editing individual rows while retaining two competing primitive authorities—was rejected. It
would leave a future implementer free to erase an accepted safety/lifecycle primitive. The lower-bound rule makes
the complete 94-screen denominator executable without rewriting accepted IA interaction bytes.

## Boundary and remaining review

This is static implementation-facing design remediation only. It does not authorize implementation, contract,
production source or test changes, dynamic execution, DEV, seed/reset, Roadmap state changes or repository-control
actions. It does not claim historical independent-review green; the two-round independent-subagent limit is retained.
Claude recheck is the remaining admission evidence.
