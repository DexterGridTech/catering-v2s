---
id: pitfalls.per-edit-gate-self-lock
status: draft
layer: routed
taskKinds: ["implementation", "review", "testing"]
domains: ["platform", "backend", "contract", "admin-ui"]
consumerFaces: ["all"]
owners: ["platform", "backend", "contract", "frontend-platform"]
impacts: ["governance", "evidence", "cleanup"]
triggers: ["implementation", "review", "failure"]
assertions: ["PER_EDIT_ARCHETYPE_PROFILE_EXACT_PARTITION", "PER_EDIT_GATE_EXACT_SET_NOT_WEAKENED"]
sourceRefs: ["doc/plans/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-implementation-design-codex.md", "project-memory/pitfalls/per-edit-gate-self-lock.md"]
---
# Per-edit gate self-lock pitfall

Do not bind unrelated archetypes to one backend gate merely because that gate currently passes. Do not repair a gate or its command closure by weakening exact-set checks. The durable fix is an exact archetype-to-profile partition with command hashes and a narrowly scoped, fail-closed bootstrap for the hash-drift recovery case.
