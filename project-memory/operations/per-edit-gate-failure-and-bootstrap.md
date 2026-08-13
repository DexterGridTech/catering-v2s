---
id: operations.per-edit-gate-failure-and-bootstrap
status: draft
layer: routed
taskKinds: ["implementation", "review", "testing"]
domains: ["platform", "backend", "contract", "admin-ui"]
consumerFaces: ["all"]
owners: ["platform", "backend", "contract", "frontend-platform"]
impacts: ["governance", "evidence", "cleanup"]
triggers: ["implementation", "review", "failure"]
assertions: ["PER_EDIT_FAIL_RECEIPT_PRESERVED", "PER_EDIT_BOOTSTRAP_EXACT_RECOVERY", "PACKAGE_EXIT_FINAL_GATE_FRESH_PASS"]
sourceRefs: ["AGENTS.md", "doc/plans/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-implementation-design-codex.md", "project-memory/operations/per-edit-gate-failure-and-bootstrap.md"]
---
# Per-edit gate failure and bootstrap

When a mandatory per-edit gate fails, preserve a structured terminal FAIL receipt and append-only ledger event. Never retry first, delete the failure evidence, or widen an allowed surface. Diagnose the first failure, repair the root cause, then rerun the gate.

If the active package is blocked by mandatory-gate command-hash drift, only the exact Dexter-authorized bootstrap transaction may recover it. The transaction must validate two targets, candidate hashes, realpath confinement, closure-to-command binding, write closure before active package, and create a no-replace receipt. The bootstrap path is a discipline boundary, not a privilege boundary.

Package exit derives changed paths from the package baseline, requires linked PRE and terminal POST evidence for every changed path, and reruns the final gate freshly. Historical FAIL events remain audit evidence; a later PASS does not rewrite them.
