---
id: kernel.contract-admin
status: active
layer: kernel
taskKinds: ["all"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["all"]
assertions: ["X_CONSUMER_FACES_ONLY","TWO_ADMIN_APPS","OWNER_RECHECKS_COMMAND"]
sourceRefs: ["doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md"]
---
# Contract, consumer and admin kernel

- `X_CONSUMER_FACES_ONLY`: `x-consumer-faces` 是 HTTP operation 暴露面的单一真相。
- `TWO_ADMIN_APPS`: `platform-admin` 与 `operations-admin` 必须是两个独立 app。
- `OWNER_RECHECKS_COMMAND`: owner 在命令事务内复核授权、状态和当前事实。
