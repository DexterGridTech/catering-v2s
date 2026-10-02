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

`terminal-data-server` 的 WebSocket transport runtime 是已接受的辅助进程（见 `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`）；按 D-44，批次二 DEV 可运行三个独立实例并通过两个 HAProxy 入口接入。实例拓扑不增加业务 deployable；跨节点会话协调仍属批次三，业务事实和迁移仍由唯一业务应用及其 owner 管理。

2026-10-02 accepted batch-3 amendment 为TDS连接历史指定远端Doris telemetry store，并允许跨节点session replacement/reconciliation；Doris不成为业务数据库或owner，binding/audit、业务事实和Flyway仍由唯一业务应用及其owner管理，也不引入MQ、outbox、持久队列或轮询。
