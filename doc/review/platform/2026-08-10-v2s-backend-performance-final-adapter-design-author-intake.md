# Final adapter design — POST_REMEDIATION_V1 author intake

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_ADAPTER_DESIGN_20260810`  
`REVIEW_ROUND=2/2`  
`ROUND_FINAL_DECISION=SELF_DECIDED`

## Reopened findings and disposition

| finding | disposition | evidence and bounded repair |
| --- | --- | --- |
| M-00 design-only authority input absent | CONFIRMED | The adapter design package input now declares `implementationAuthority: false` as a top-level authority field. The design manifest binds its new digest. |
| M-01 dynamic fixture authority uses obsolete spelling | CONFIRMED | The future dynamic package input now has only `minimalFixtureAuthority: true`; `minimalSeedAuthority` is removed. This remains a future package declaration, not a runtime authority grant. |
| M-02 fixture catalog lacks a mechanical source contract | CONFIRMED_CLOSED_IN_ROUND_2 | The reviewed design already freezes all 396 rows to source anchor plus hash, closed materializer kind, typed path parameters and prerequisite/readback. No change in this remediation. |
| M-03 nested Testcontainers ownership incomplete | CONFIRMED_CLOSED_IN_ROUND_2 | The reviewed design already requires parent run identity, fixed task, host fingerprint, child manifest and independent child business/cleanup PASS. No change in this remediation. |
| Mechanical manifest shape | CONFIRMED | The delivery-unit id is normalized from `FINAL-ADAPTER` to `FINAL-U01`, matching the checker’s capability-unit grammar. This does not alter the single unit, its 16 implementation surfaces, its 396 fixture denominator, authority, or runtime boundary. |
| Claude M-01 trim-exit predicate | CONFIRMED | The design required an impossible `afterSha256AndReceiptExactSet=PASS` for the active trim mode. It now requires a current-package successful trim `validate-package-exit` result and binds its stdout/log digest; `changedPathsWithinApprovedSurface=PASS` is derived only from that evidence and is explicitly a subset, not equality, claim. |
| Round-2 report retention | CONFIRMED_UNRECOVERABLE | The original Markdown SHA `7cc6220f…` was searched across the workspace, tracked history, and all reachable/unreachable Git blobs with zero match. No transcript is reconstructed. The current JSON is an author-created checker serialization, explicitly not an independent original. |
| Authority artifact extension | CONFIRMED | The live design authority artifact is renamed from `.json` to `.md` without content change because the checker intentionally reads it as text for the standalone authority literal. Round 1 retains the historical `.json` path it actually reviewed. |
| Compliance tombstone vocabulary | OUT_OF_SCOPE_PROGRAM_CONTROL | Claude N-02 is valid: retirement fields should be forbidden rather than required. It is a separate compliance-tool program change and is not folded into this adapter design package. |

## Why this is the smallest repair

The bounded repairs resolve conflicting authority vocabulary, a manifest grammar issue and an
impossible trim-exit predicate. They do not add a delivery unit, implementation surface, runtime
capability, fixture, denominator, or dynamic command. The trim validation is intentionally weaker
than retired set equality: it proves the declared changed-path list is a subset of the approved
surface, and the design now says exactly that.

## Post-remediation boundary

The current bytes have **not** been independently reviewed after the bounded repairs. The original
Round-2 Markdown cannot be recovered; its JSON form must not be represented as the independent
original. The only permitted next review is a fresh Claude design recheck. This declaration grants
neither the static adapter implementation package nor a dynamic environment run.
`implementationAuthority`, `runtimeAuthority`, reset, browser L2, UAT, deployment, manual SSH and
manual SQL all remain out of scope here.
