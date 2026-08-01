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
assertions: ["BOUNDED_PREPARATION_FOR_CURRENT_CHANGE"]
sourceRefs: ["doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md"]
---
# Implementation source reread discipline

- `BOUNDED_PREPARATION_FOR_CURRENT_CHANGE`: preparation is limited to the minimum executable and reviewable input for the pending change point; generic preparation never substitutes for corrective implementation.
- Pointwise reread remains a recommended human review habit: before and after each focused change, reopen the smallest applicable IA, business, memory, owning source and design slice. It is advisory only; no receipt, baseline, correction audit or package-exit blocking evidence is required.
