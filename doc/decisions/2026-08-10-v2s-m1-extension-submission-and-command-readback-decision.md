---
status: DEXTER_ACCEPTED_CLAUDE_DECISION
scope: SQL-M1 typed owner boundary and command response composition
---

# M1 extension submission and command readback decision

## Decided owner-boundary pattern

Dynamic extension input crossing a typed public owner command uses only
`ExtensionSubmission(List<ExtensionFieldValue>)`.  Each entry contains a `fieldKey`, canonical
JSON text `valueJson`, and explicit mode `SET` or `CLEAR`.  Absence is not submitted, `SET` never
uses `null` or literal `"null"`, and `CLEAR` is expressed only by its mode.  The extension owner
alone validates the canonical JSON against the current definition.  Definition revision remains
owner-generated persistence/readback evidence and is not a request CAS.  New public owner APIs,
generated bindings and composition adapters do not expose `Map`, `JsonNode` or `ObjectNode` for
extension values.

## Decided response composition

HeadCompany, Store and Contract command successes retain their current HTTP response shapes.  The
command-following owner readback is produced inside the same `REQUIRED` transaction.  Store
composition is one operation-specific producer: it calls only declared typed organization and
contract readbacks and reuses the existing
`StoreWireMapper.store(ownerReadback, organizationDetail, contractDerivedStatus)` signature.  It
does not add a mapper, convenience BFF, repository/JDBC access, a follow-up GET or a copied contract
fact.  HeadCompany retains organization-owned authorized brands, and Contract returns its
contract-owned complete task view before the transaction ends.

## Guard and boundary

The registry-derived M1 command gate must reject generic extension data, mode/null ambiguity,
extra composition queries, mapper drift, changed command response field shape and attempts to move
required readback out of the command transaction.  These decisions authorize no dynamic runtime,
DEV, reset, seed, L2, Testcontainers, deployment, direct SQL, or numerical performance claim.
