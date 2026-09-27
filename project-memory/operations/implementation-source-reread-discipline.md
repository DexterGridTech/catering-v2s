---
id: operations.implementation-source-reread-discipline
status: active
layer: routed
taskKinds: ["implementation","review","testing"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","contract","frontend-platform","product"]
impacts: ["governance","evidence","architecture"]
triggers: ["implementation","review"]
assertions: ["BOUNDED_PREPARATION_FOR_CURRENT_CHANGE", "INDEPENDENT_3D_RECONCILIATION_AT_CP_BOUNDARY"]
sourceRefs: ["doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md", "doc/platform/backend-coding-standard.md", "doc/platform/review-standard.md"]
---
# Implementation source reread discipline

- `BOUNDED_PREPARATION_FOR_CURRENT_CHANGE`: preparation is limited to the minimum executable and reviewable input for the pending change point; generic preparation never substitutes for corrective implementation.
- `INDEPENDENT_3D_RECONCILIATION_AT_CP_BOUNDARY`: the independent three-dimensional reconciliation unit is the complete CP explicitly listed by the implementation plan. Finish all work items, edits, focused proofs and repairs in that CP, then have a fresh independent reviewer reconcile the whole CP before starting the next CP. Files, individual edits, focused tests, and fixes inside the CP do not create separate reconciliation gates. For a task without CP labels, use only a complete separately approved stage stated in its plan; do not invent a stage from an edit or test.
- Each actual change point still requires the main agent to reopen its applicable requirement/IA, routed memory, design constraint and owning source before writing, then reread the same inputs and resulting source after focused proof. This pointwise readback is required implementation evidence; it is not an independent review.
