---
id: kernel.transaction-data
status: active
layer: kernel
taskKinds: ["all"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["all"]
triggers: ["all"]
assertions: ["ONE_DB_MULTI_SCHEMA","ONE_FLYWAY_HISTORY","COMMAND_REQUIRED_TRANSACTION","TASK_READ_JOIN","NO_NORMAL_POLLING"]
sourceRefs: ["doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md","doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md"]
---
# Transaction, data and dependencies kernel

- `ONE_DB_MULTI_SCHEMA`: 一个 PostgreSQL 数据库，按 owner 使用多个 schema。
- `ONE_FLYWAY_HISTORY`: 全库只有一条 Flyway history。
- `COMMAND_REQUIRED_TRANSACTION`: 跨模块写必须调用目标模块公开 command API，并加入同一 `REQUIRED` 事务。
- `TASK_READ_JOIN`: 跨 schema 读取只用于显式任务型 join。
- `NO_NORMAL_POLLING`: 禁止用常态轮询补偿跨域同步。
