# catering-v2s Platform Blueprint

## 当前产品形态

v2s 从一个业务 deployable 起步：单进程模块化单体、单 PostgreSQL 数据库、多 owner schema、单一 Flyway history。模块通过公开 `<module>.api` command API 协作，同步加入同一 `REQUIRED` 事务；coordinator 不拥有业务资产。跨 schema read 只为明确任务型 join 服务。

初始形态不包含 MQ、通用 outbox、TDP、内部 OpenAPI client、搜索平台或常态轮询。只有真实触发条件与新 decision 可以改变该边界。

## HTTP 与管理端

OpenAPI extension `x-consumer-faces` 是 operation 暴露面的单一真相。`platform-admin` 与 `operations-admin` 是两个独立 consumer app，分别拥有 shell、registry、theme、route 和状态生命周期，不能合并为一个后台。

## 数据与开发动作

模块 owner 独占事实写入与最终授权复核。Flyway 是唯一 schema history；DEV start/restart 只做 additive migration，绝不 seed。reset 和 seed 必须是单独、显式、可审计的破坏性动作。

## AI-first 与证据

仓内 `AGENTS.md`、五个 project skills、确定性 `project-memory`、只推荐不注入的 hooks，以及 provider-free 的 `rg`/源码回读构成最小执行底座。每个步骤必须有可失败的 clean/red gate、业务与 cleanup 分离的证据，以及明确的授权边界。

## Heritage

all-v2、all-v1、v4 与 v6 只作为 hash-bound、显式引用、只读 Heritage；禁止写回和 runtime/build fallback。Roadmap 状态只由本仓 Registry 解析出的唯一 active owner 持有。
