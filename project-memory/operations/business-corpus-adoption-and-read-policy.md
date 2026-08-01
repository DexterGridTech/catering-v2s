---
id: operations.business-corpus-adoption-and-read-policy
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["task-start","implementation","review"]
assertions: ["BUSINESS_CORPUS_MEMORY_PROMOTION_AUTHORIZED","BUSINESS_CORPUS_READ_POLICY"]
sourceRefs: ["doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md"]
---

# Business corpus adoption and read policy

## Before related work

For a business design, Journey, contract, UI, implementation, review or test, first run the normal
six-dimension memory recall. Read `decisions.confirmed-business-language-corpus` and this policy
when the task has a candidate business object, actor, relation, action, state, historical alias or
forbidden inference from G-01 to G-12. Use the corpus head index only to find entries; it does not
make a semantic decision and an index miss does not waive this policy.

For cross-domain work, read every matching entry. A task document records the relevant `G-xx`/
`TERM_ID` and source reference, rather than scattering boilerplate through each code line. Purely
mechanical formatting, tooling, logs and link-only work do not require the corpus.

## What the corpus constrains

- Business terms, prohibited inferences and explicitly recorded pending decisions constrain design
  language and user-facing text before technical names, schemas, APIs or old UI are chosen.
- A corpus term does not materialize a schema/API/contract, approve a Journey, authorize a UI,
  determine an owner or grant R3/W1/runtime authority.
- When current higher authority conflicts, stop, reopen sources and record the conflict; agent
  convenience cannot select a product meaning.
- Future materialization reopens the relevant full G entry, including its explicit revisions such
  as `workspaceKey → groupWorkspaceKey`, contract goods-code pair, assignment revocation and
  product-price boundary.

## Review discipline

Business review tests the user task and alternatives, not merely name consistency. “不得推导” is a
required counterexample: for example, brand authorization is not Store visibility, inventory hint
does not directly change a menu, and Store enablement is not operating status. Semantic judgment
remains fresh adversarial review and Claude/Dexter decision; do not create a keyword checker.

## Authority boundary

This policy was promoted only by the 2026-07-25 Dexter decision. It does not authorize new grill
questions, G-13+, R3/W1 implementation, contract/database/code/runtime work or Git writes.
