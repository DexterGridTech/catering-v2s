# catering-v2s 平台规范入口

CBS/TDP/TDS/TDC 命名统一见 `doc/platform/terminal-coding-standard.md` §4-F（Dexter 2026-10-03）。
本文旧「不增加 TDP」指未批准的旧平台能力扩张；TDP 作为 TDS + TDC 的整体称呼已生效，
数据通知/远程运维仍为需求讨论，不因此获得实现或运行授权。

本仓是 successor execution 仓。每次新会话从仓根开始，先读取 `AGENTS.md` 与
`PLATFORM-BLUEPRINT.md`；当前任务与授权只来自 Dexter 在会话中的明确指派，不得从其他
仓库、历史材料或仓内过期状态推导。

1. `AGENTS.md`：执行入口、授权边界与不可突破红线；
2. `PLATFORM-BLUEPRINT.md`：服务形态、模块 owner、数据、契约与运行边界；
3. `doc/platform/active-document-index.json`：当前 active document 与 ownership 导航；
4. `project-memory/index.md` 与 `scripts/memory/query`：确定性 memory 路由和原文入口；
5. `scripts/README.md`：仓内标准动作和可复验命令；
6. `doc/platform/browser-l2-execution-standard.md`：受管浏览器 L2 的唯一项目级执行、证据与调用规范；
7. 当前批准的 decision、plan、contract 与 review：具体 Journey、实施范围和验收依据。
8. `doc/platform/third-party-library-usage-standard.md`：设计或实现依赖第三方库 API/行为时的官方资料、版本与验证要求。

`standards-coverage`、manifest/hash/package traceability 已退役，不作为会话、设计、实施或
评审入口；仍须亲验当前原始材料和真实源码。

`catering-all-v2` 及其他旧仓只作为 Heritage 只读来源；不得作为 runtime/build fallback，
也不得把旧仓状态复制为本仓当前状态。当前交付保持一个业务 deployable、一个 PostgreSQL
业务数据库、两个独立 admin app。已接受的 terminal service-shape decision 准许辅助 TDS WebSocket runtime；按 D-44，批次二 DEV 可运行三个独立实例并通过两个 HAProxy 入口接入。2026-10-02接受的批次三 amendment 将跨节点会话取代/恢复核验与TDS连接历史写入远端Doris列入批次三；Doris仅是具名telemetry store，绑定/审计仍留PostgreSQL，不增加业务deployable、TDP、MQ、通用outbox或轮询。未批准 Journey 和 TDP placeholder 不得被实现或作为验收依据。
