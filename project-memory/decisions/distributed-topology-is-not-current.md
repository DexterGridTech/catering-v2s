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
sourceRefs: ["doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md", "doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md"]
---
# Distributed topology is not current

- `NO_MQ_OUTBOX_TDP`: 初始不引入 MQ、通用 outbox 或 TDP。
- `NO_INTERNAL_OPENAPI_CLIENT`: 单 deployable 内模块协作不走内部 OpenAPI client。
- `NO_DISTRIBUTED_DEFAULTS`: 不预建分布式边界；真实触发条件出现后另作 decision。

已接受的 `terminal-data-server` WebSocket runtime（见 `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`）是辅助传输进程；按 D-44，批次二 DEV 可运行三个独立实例并通过两个 HAProxy 入口接入。各实例只消费绑定撤销的同事务 PostgreSQL `LISTEN/NOTIFY` 唤醒；此部署拓扑不构成 TDP，不引入 MQ、通用 outbox、持久队列、跨节点会话协调或常态轮询，跨节点会话协调仍属批次三。
