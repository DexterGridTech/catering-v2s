---
id: decisions.distributed-topology-is-not-current
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","platform"]
consumerFaces: ["backend"]
owners: ["backend","platform"]
impacts: ["architecture","transaction"]
triggers: ["implementation","review"]
assertions: ["NO_MQ_OUTBOX_TDP","NO_INTERNAL_OPENAPI_CLIENT","NO_DISTRIBUTED_DEFAULTS"]
sourceRefs: ["doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md"]
---
# Distributed topology is not current

- `NO_MQ_OUTBOX_TDP`: 初始不引入 MQ、通用 outbox 或 TDP。
- `NO_INTERNAL_OPENAPI_CLIENT`: 单 deployable 内模块协作不走内部 OpenAPI client。
- `NO_DISTRIBUTED_DEFAULTS`: 不预建分布式边界；真实触发条件出现后另作 decision。
