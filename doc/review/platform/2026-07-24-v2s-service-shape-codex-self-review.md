---
title: v2s 新服务形态 ADR Codex 自审
status: SELF_REVIEW_COMPLETE
createdAt: 2026-07-24
reviewTarget: doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
implementationAuthority: false
---

# v2s 新服务形态 ADR Codex 自审

## 1. 自审范围

本次只审查未来 v2s 的服务形态 ADR，不审查 all-v2 当前代码是否已经实现，也不产生业务实现、Roadmap、Git 或生产授权。

输入：

- `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md`；
- `doc/plans/platform/2026-07-24-v2s-architecture-grilling-working-notes.md`；
- `doc/plans/platform/2026-07-24-v2s-architecture-action-plan.md`；
- 本任务确定性 memory route 返回的 60 项 project-memory 原文；
- `PLATFORM-BLUEPRINT.md`、Roadmap Registry 与 `AI_FIRST_FOUNDATION` P7 当前 spec/plan/decision。

## 2. 独立核验结论

Codex 结论：`GO_FOR_CLAUDE_REVIEW(0 M / 0 S / 3 N)`。

该结论只表示 ADR 已完整表达 D1-D12、替代方案、代价、supersede、trigger、机器门与授权边界，可以交给 Dexter 和 Claude 审查；不表示 ADR 已由 Dexter 接受，不表示 v2s 可以开工。

## 3. D1-D12 追踪

| 决策 | ADR 落点 | 自审结果 |
|---|---|---|
| D1 部署不改变领域 | §3.1–3.2 | `PASS` |
| D2 原子写与 owner 写权 | §3.3 | `PASS` |
| D3 任务型跨 schema 读 | §3.4–3.5 | `PASS` |
| D4 单体内部事件禁令 | §3.9 | `PASS` |
| D5 跨 schema FK | §3.7 | `PASS` |
| D6 三类依赖边 | §3.8 | `PASS` |
| D7 窄 `<module>.api` | §3.2、§3.4 | `PASS` |
| D8 ExecutionContext 与 owner 复查 | §3.6 | `PASS` |
| D9 全局 Flyway | §3.7 | `PASS` |
| D10 真实进程边界与触发制 | §3.1、§3.9–3.11 | `PASS` |
| D11 surface/read model/双 admin/codegen | §3.5、§3.10、§3.12 | `PASS` |
| D12 verify/DEV/HANDOFF | §3.12、§11 | `PASS` |

## 4. 对抗性问题

### 4.1 是否把“单体”误写成“无边界”？

否。ADR 明确保留 bounded context/owner/invariant，并用 module API、ArchUnit、schema owner、dependency registry、typed judgment/command 强制。任务型 read join 只拥有读取任务，不拥有写权或业务解释权。

### 4.2 是否把原子事务变成 coordinator 上帝层？

否。coordinator 归发起模块且零资产，只拥有调用顺序与失败语义；目标模块仍拥有 command、repository、schema 和 invariant。

### 4.3 task read 允许成环是否破坏模块 DAG？

否。ADR 把 command、schema FK 和 task read 分成三类边；前两类必须无环，read 边允许成环但不传播事务、锁、import 或 FK 权限。

### 4.4 单库是否让跨 owner DML 无法阻止？

数据库账号层当前确实不能完全阻止，这是被诚实登记的代价与 HANDOFF 欠账。初始阶段由 package visibility、ArchUnit、migration owner 和 review 强制；ADR 没有假装已实现 schema-scoped credential。

### 4.5 是否以未来搜索/TDP/支付为由预建框架？

否。ADR 要求可判定 trigger、新 decision 和 supersede 链；初始依赖树不含 MQ/outbox/search/TDP。外部搜索引擎本身也不自动产生我方新进程或 MQ。

### 4.6 是否把 consumer face 当成授权？

否。ADR 明确 face 只定义暴露面，page/action/scope 与 owner command 复查仍独立执行。

### 4.7 是否漏掉旧测试退出？

否。物理退役明确包含只验证旧多服务通信、投影追平、分离授权维护和全量 generated 面的旧测试；replacement evidence、零引用与 cleanup 是删除前提。

## 5. Notes

- `N-1`：ADR 使用“模块化单体”语义但标题没有把该标签作为唯一名称，避免把形态标签误当领域设计方法；Claude 可建议是否需要在术语表增加英文 `modular monolith`。
- `N-2`：Java 21 + Spring Boot 4.1 兼容性 spike 属行动计划 W1，不写成 ADR 的永久技术栈裁决；这避免未经实测冻结版本。
- `N-3`：TDP 继续完全退出当前分母；若 Dexter 未来提出，应新开设计讨论，不把本 ADR 的 trigger 表当作 TDP 详设。

## 6. 待 Claude 独立核验

请重点挑战：

- immediate 跨 schema FK 与 coordinator 调用顺序是否存在未覆盖的事务死锁面；
- 一个全局 Flyway history + 模块目录是否有更简单且同样可裁判的组织方式；
- task query 的 owner judgment 纯函数输入是否可能把 owner 规则所需事实泄漏给 query 层；
- `ExecutionContext` 在事务内首批读的线性化论据是否完整；
- `x-consumer-faces` 同源生成服务端与客户端执法是否会让 contract 承担授权语义；
- retirement 清单是否仍遗漏 all-v2 多服务拓扑的隐性运行路径。

