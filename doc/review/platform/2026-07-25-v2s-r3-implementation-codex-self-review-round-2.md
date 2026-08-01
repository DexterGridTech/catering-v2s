REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=R3-C01-IMPLEMENTATION-20260725
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

## 用户任务

业务用户是受部署期外部身份控制的系统服务提供者，必须在既有集团空间中独立录入商业集团编码和名称，并从 owner readback 确认唯一结果；operations-admin 仍不属于真实业务闭环。

## Dexter 立场

Dexter 要求本轮一次性完成 R3-C01 与 R3-TECH，不把未来 TDP 或 J02/C-02 带入；backend 必须物理保留并列 App，但只有 catering-business-server 进入当前运行范围。

## 替代方案

更小的修复是只在单空间 runner 中验证同 key replay；该方案无法证明幂等 scope 规则。更大的修复是引入统一幂等基础设施；不选。当前最小正确修复是在 organization owner 的 fingerprint 中加入 groupWorkspaceKey 与固定 operation，并在 existing receipt 复核空间 scope。

## 方案合理性

第二轮发现的问题是 implementation 与已接受的“fingerprint=范围+操作+规范化请求”条款不一致：原实现只 fingerprint 编码/名称，跨空间复用同一幂等键可能返回错误 owner readback。修复只改 owning command service 和 walking skeleton 的反例，不引入新表、缓存或基础设施；阶段成本低，且真实 DB 运行证明跨空间同 key 返回 typed `IDEMPOTENCY_CONFLICT`。

## UI 与交互

APPLICABLE：platform-admin 仍严格执行 list → detail → 初始化 Drawer → owner readback；此次修复不改变用户路径，只强化提交边界。operations-admin 仍只有静态边界页，不增加登录、session 或业务操作。

## 审查意见复核

CONFIRMED：重新打开 `doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md` §R3-C01 幂等条款、`OrganizationCommandService.java` owning 源码与真实 PostgreSQL runner evidence，确认 scope omission。修复后用第二个既有集团空间、相同 idempotency key、相同 payload 构造反例，fresh run 真实得到 `409 IDEMPOTENCY_CONFLICT`。没有发现需要扩大范围的其它 confirmed finding；并发唯一约束仍由 DB 保护，未引入过度设计。

## 实施代码核验

已重新运行仓根 Gradle 多项目源码编译/测试/bootJar、fresh PostgreSQL/Flyway walking skeleton、跨空间幂等负向分支、双前端 architecture test/build、contract/codegen、Flyway、production conformity、module dependency、frontend boundary、Heritage 双侧 hash 与 code layout。仓根 project path 为 `:apps:backend:*` 与 `:libraries:backend:*`，`apps/backend` 不再是独立 Gradle 根。business 与 cleanup 均 PASS；C-01 业务用户行为、libraries/backend 共享模块边界和 TDP placeholder 边界保持不变。

## 闭环核验

当前 evidence 已更新到最新 fresh run `20260725T074601Z-69293`，U04/U07 artifact hash 已更新；organization fingerprint 现在包含空间、操作和规范化字段。仓根 Gradle 多项目已与 all-v2 对齐，R3 仍只有一个业务 deployable，terminal-data-server 仍无运行时或业务代码；未恢复 J02/C-02。

## 结论

VERDICT=GO
