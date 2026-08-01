# R3-J02 fresh independent Codex adversarial review

REVIEW_CYCLE_ID=R3-J02-DESIGN
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1/2
REVIEWER=independent fresh reviewer

## Verdict

`NO_GO (3 M / 3 S / 0 N)`。

The reviewer independently concluded that J02 is a real, necessary user task: an empty GroupWorkspace may remain legal and CommercialGroup code/name must be independently entered, so it must not happen automatically during space creation. The platform/operations split, 9-operation denominator (6+3), and four owner modules are proportionate to the current slice.

## Findings

| id | severity | finding | evidence and counterexample | minimum correction |
| --- | --- | --- | --- | --- |
| IR3J02-M-001 | M | U06 orders Claude and Dexter authorization after GATE_0/evidence. | R3 authorization §4 requires Claude GO and Dexter implementation authorization before GATE_0; the manifest ordered the reverse. Following it would create production surfaces before authority exists. | Order design review → Claude GO → Dexter implementation authorization → GATE_0 → implementation/evidence. |
| IR3J02-M-002 | M | Workspace eligibility recheck contradicts the owner boundary. | The design says organization must not query workspace but also says organization final-rechecks eligibility. Heritage says platform-workspace confirms ENABLED and organization does not reverse-query. A naked coordinator boolean would also race a subsequent disable. | platform-workspace linearizes its own status/revision in the REQUIRED transaction and passes a typed trusted grant; organization validates grant provenance and its own invariant only. |
| IR3J02-M-003 | M | Single-column workspace FK violates the frozen composite-FK rule. | Service-shape ADR §3.7 requires `(workspace_key, referenced_id)` for strong cross-schema references. A single id can leave an isolation-coordinate mismatch unblocked. | Use a composite key/FK and uniqueness at the referencing owner; otherwise obtain an explicit ADR exception with proof. |
| IR3J02-S-001 | S | `V001`–`V004` violates UTC-millisecond Flyway version policy. | ADR §3.7 gives `V<UTC秒_毫秒>__...`; sequential placeholders invite parallel collision. | Keep semantic placeholders or the UTC-millisecond naming rule until authorized GATE_0. |
| IR3J02-S-002 | S | Platform action authorizer has no assigned surface/evidence unit. | Design assigns it to platform-identity/U02, while manifest U02 did not include it and U04 could duplicate it. | Place surface and L1 ownership in U02; U04 only consumes typed ExecutionContext/capability. |
| IR3J02-S-003 | S | Initialization action was represented as its own page key. | D01-S05 defines one GroupWorkspace management page and an action in a detail Drawer; a fake page key could produce a fake menu/route/grant. | Use the real management page key, and keep initialization as an action/capability identifier. |

## Negative attacks that did not find a defect

- Creating CommercialGroup automatically during GroupWorkspace creation conflicts with G-01 and Dexter’s J02 decision.
- An operations organization page would exceed the explicit session-only boundary.
- The 6 platform + 3 operations denominator contains no invented operations; four owners avoid conflating identity, workspace lifecycle and CommercialGroup facts.
- No business implementation, dynamic environment, database action, seed/reset or Git write was observed in the design review scope.

