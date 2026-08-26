# catering-v2s 平台规范入口

本仓是 successor execution 仓。每次新会话从仓根开始，先读取 `AGENTS.md` 与
`PLATFORM-BLUEPRINT.md`，再按显式 program 解析当前 Roadmap；不得从其他仓库或历史
Roadmap 推导当前状态。

1. `AGENTS.md`：执行入口、授权边界与不可突破红线；
2. `PLATFORM-BLUEPRINT.md`：服务形态、模块 owner、数据、契约与运行边界；
3. `doc/platform/roadmap-program-registry.json`：唯一 program resolver；
4. `doc/platform/active-document-index.json`：当前 active document 与 ownership 导航；
5. `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：当前 program 的 state/authorization owner；
6. `project-memory/index.md` 与 `scripts/memory/query`：确定性 memory 路由和原文入口；
7. `scripts/README.md`：仓内标准动作和可复验命令；
8. `doc/platform/browser-l2-execution-standard.md`：受管浏览器 L2 的唯一项目级执行、证据与调用规范；
9. 当前批准的 decision、plan、contract 与 review：具体 Journey、实施范围和验收依据。

`standards-coverage`、manifest/hash/package traceability 已退役，不作为会话、设计、实施或
评审入口；仍须亲验当前原始材料和真实源码。

`catering-all-v2` 及其他旧仓只作为 Heritage 只读来源；不得作为 runtime/build fallback，
也不得把旧仓状态复制为本仓当前状态。当前 R3 交付保持一个业务 deployable、一个 PostgreSQL
数据库、两个独立 admin app；未来 TDP placeholder、R3-J02/C-02 和未批准 Journey 不得被
实现或作为 R3 验收依据。
