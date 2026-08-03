---
name: cs-semantic-source-reconciliation
description: Resolve an apparent missing API, capability, fixture state, or cross-layer behavior from business and owner facts before adding product surface.
---
# cs-semantic-source-reconciliation

Use this skill when a task appears to require a new capability, endpoint, UI control, fixture
write, terminal state, clock change, or direct data access. It prevents a plausible local patch
from silently changing the approved product or owner model. It never grants a new product,
security, runtime, reset, seed, or deployment authority.

## 1. Reopen facts in this order

Before proposing a change, read the original business/Journey and IA entry, its current detail
design, routed project memory and design redlines, the active package boundary, the current
owner's public command/read contract, the face OpenAPI/edge/generated projection, and a working
sibling implementation. For runtime/fixture work also read the fixture contract, runner,
manifest and first-failure logs.

Do not turn a frontend symptom, a seed scenario label, or an absent method name into a business
requirement. Verify the exact fact, lifecycle state and permitted actor first.

## 2. Create a fact-to-source matrix

For each requested fact or scenario, record:

| Needed fact / transition | Business source and IA anchor | Owner and existing lifecycle/command | Contract/edge/generated face | Allowed fixture channel | Readback proving it |
| --- | --- | --- | --- | --- | --- |

Complete the finite scenario denominator before changing code. Distinguish these outcomes:

- **Existing lifecycle path:** wire the existing owner command/readback; no new surface.
- **Fixture mapping gap:** derive the missing role/node/identity/supersession mapping from the
  scenario prerequisites and owner facts; escalate only a genuinely ambiguous row.
- **Terminal-only fixture gap:** use the explicitly approved managed adapter only for a state the
  normal owner lifecycle cannot reach under the fixed test conditions.
- **Owner/contract implementation gap:** extend the owner, transaction, OpenAPI, edge, generated
  client and consumer together, but only when the approved business/IA source actually requires it.
- **Product ambiguity:** stop at the explicit alternatives and ask Dexter; never conceal it behind
  a fixture, a default, or a new permission.

## 3. Search the whole lifecycle before creating an API

Trace creation, acceptance, activation, update, revocation, cancellation, expiry and readback.
The needed final state may be reachable by an existing transition even when no method is named
after that state. For example, an enabled account with no active role assignment should normally
be created through the valid invitation/assignment lifecycle and then have its existing assignment
revoked; it is not evidence for a create-account-without-role command or a direct database insert.

Platform-super-admin operations are governed by the platform authorization model, not workspace
capabilities. Do not project a platform operation into a new workspace capability merely because
it mutates state. Conversely, do not remove an operations capability without reopening the
operations IA, authorization requirement and owner policy.

## 4. Controlled fixture exception is not a product surface

An exception is permissible only when its approved contract fixes all of these: exact profile,
non-production namespace, allowlisted key/state, normal owner-created predecessor, minimal
unreachable mutation, audit actor/event, receipt and owner/edge readback. It must refuse any
other namespace or state and must not expose an HTTP endpoint, capability, UI control, generic
SQL writer, global-clock advance, or reusable production path.

If the contract cannot state those facts, the issue is an unresolved design decision, not a reason
to guess a fixture value.

## 5. Implement and prove the narrowest confirmed solution

1. Compare the smallest existing-path solution with a proposed new product surface.
2. Change every required layer only for a confirmed owner/contract gap; preserve transaction,
   authorization, generated-client and readback ownership.
3. Add a focused proof for the fact-to-source chain and a negative proof for the prohibited
   shortcut where a mechanical one exists.
4. Reread the original business/IA/design source against the changed code. Then scan the complete
   same-root sibling denominator so the named symptom is not the only repaired occurrence.
5. Keep dynamic business and cleanup status separate. A missing terminal runner manifest or
   cleanup readback leaves the run incomplete even if a remote action succeeded.

## 6. Closure record

For each confirmed issue record the generic failure mode, root-cause layer, finite applicability
denominator, counterexample boundary, smallest reusable remedy and prevention destination. Do not
claim that a rule written in memory proves it was executed; preserve the source/readback/focused
evidence appropriate to the approved work.

Use `cs-managed-runtime-execution` whenever the confirmed path is reset, DEV, seed,
Testcontainers, L2 or UAT.
