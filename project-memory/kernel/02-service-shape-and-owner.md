---
id: kernel.service-owner
status: active
layer: kernel
taskKinds: ["all"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["all"]
assertions: ["ONE_BUSINESS_DEPLOYABLE","MODULE_OWNER_SOVEREIGNTY","COORDINATOR_NO_ASSET"]
sourceRefs: ["doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md"]
---
# Service shape and owner kernel

- `ONE_BUSINESS_DEPLOYABLE`: 初始只有一个业务 deployable。
- `MODULE_OWNER_SOVEREIGNTY`: 每个模块独占自己的事实、表与命令语义。
- `COORDINATOR_NO_ASSET`: coordinator 只编排，不拥有、复制或直接修改参与模块的业务资产。
