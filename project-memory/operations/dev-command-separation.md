---
id: operations.dev-command-separation
status: active
layer: routed
taskKinds: ["runtime-management","testing"]
domains: ["platform","backend"]
consumerFaces: ["all"]
owners: ["platform"]
impacts: ["runtime","database","cleanup"]
triggers: ["runtime","failure"]
assertions: ["START_RESTART_MIGRATE","START_RESTART_NO_SEED","RESET_SEPARATE_DESTRUCTIVE"]
sourceRefs: ["doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md"]
---
# DEV command separation

- `START_RESTART_MIGRATE`: start/restart 允许 additive Flyway migration。
- `START_RESTART_NO_SEED`: start/restart 永不 seed。
- `RESET_SEPARATE_DESTRUCTIVE`: reset/seed 必须是单独、显式、破坏性且受授权的动作。
