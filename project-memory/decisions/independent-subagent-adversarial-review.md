---
id: decisions.independent-subagent-adversarial-review
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","product"]
impacts: ["governance","evidence","architecture","contract","database"]
triggers: ["task-start","review","implementation"]
assertions: ["INDEPENDENT_SUBAGENT_REQUIRED","BLIND_REVIEW_FIRST","AUTHOR_INTAKE_ONLY","SUBAGENT_INPUT_CHECKLIST_REQUIRED"]
sourceRefs: ["doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md"]
---

# Independent subagent adversarial review

- `INDEPENDENT_SUBAGENT_REQUIRED`: from the next review cycle, both DESIGN and
  IMPLEMENTATION adversarial rounds are performed by fresh independent subagents.
- `BLIND_REVIEW_FIRST`: the reviewer writes findings and verdict before reading author
  self-assessment or disposition.
- `AUTHOR_INTAKE_ONLY`: the author reopens sources and performs dialectical finding intake;
  the author cannot write the adversarial verdict.
- `SUBAGENT_INPUT_CHECKLIST_REQUIRED`: each round records the mandatory entry chain as a
  path-and-hash checklist; absence invalidates that round.

This rule does not reopen already closed cycles. The owning decision is
`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`.
