---
id: practices.preflight-execute-failure-parity
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","contract","platform"]
consumerFaces: ["backend"]
owners: ["backend"]
impacts: ["architecture","contract","database"]
triggers: ["implementation","review"]
assertions: ["PREFLIGHT_EXECUTE_FAILURE_PARITY"]
sourceRefs: ["project-memory/practices/preflight-execute-failure-parity.md"]
---

# 预检与执行必须保持失败语义一致

**触发时刻**：实现带有预检/预览与正式执行两阶段的复制、迁移或批量写命令，并且源事实具有生命周期状态、引用身份或版本约束。

## 规则

预检必须用 owner 的批量 typed read 解析源事实，并在规划目标 CREATE/REUSE 之前对缺失、作废、重复、作用域不匹配等不可执行状态给出与执行阶段一致的 typed failure。执行阶段仍必须重新读取事实并做 fresh recheck；不能把执行阶段的兜底拒绝当成预检已经正确。

## 根因与最小解

同一个源集合若只在执行阶段拒绝，预检会向用户展示一个可执行的目标计划，随后正式提交才失败；这会造成错误的 UI 选择、错误的幂等/回执预期和不一致的审计语义。最小解是保留 owner-local 的集合读取，在预检循环内显式处理生命周期状态，并用真实 PostgreSQL 场景覆盖预检与执行之间的边界；不要求把不同 owner 的实现合并成一个抽象。

## 边界与反例

该规则只适用于确有两阶段预检/执行和可判定源状态的写路径。没有生命周期列的库存目标不能臆造 VOIDED 分支，应继续用其已有的 missing、身份、作用域和版本失败语义；Catalog 等在源集合查询阶段排除 VOIDED 的 owner 仍须保留该过滤和其余 typed failure。任何 owner 仍需执行阶段 fresh recheck，预检通过不能替代并发期间的再次校验。
