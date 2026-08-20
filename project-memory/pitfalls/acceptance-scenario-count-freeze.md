---
id: pitfalls.acceptance-scenario-count-freeze
status: active
layer: routed
taskKinds: ["design", "implementation", "testing", "review"]
domains: ["platform"]
consumerFaces: ["backend"]
owners: ["backend"]
impacts: ["evidence"]
triggers: ["implementation", "testing", "review"]
assertions: ["ACCEPTANCE_DISCOVERY_MUST_NOT_FREEZE_A_STALE_SCENARIO_COUNT"]
sourceRefs: ["doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md"]
---

# 业务验收发现测试不得冻结过期场景总数

- **失败模式**：结构测试把当前业务场景总数写成固定常量。新增合法场景后，结构门先红，
  agent 可能为了恢复绿色删除场景、绕过发现或伪造计数。
- **根因**：场景目录的业务总数是演进数据，不是该结构测试要守的不变量；该测试真正要守的是
  显式 domain group、非空发现和唯一 ID。
- **适用边界**：只适用于不变量是“可发现且唯一”的结构测试。若业务需求明确规定上限，仍由
  受管 acceptance runner 的 `<= 80` 约束负责，不由结构测试冻结当前数量。
- **最小解**：结构测试断言场景集合非空且 ID 唯一；不要断言当前总数等于历史快照。
- **反例**：当前 30 条的硬编码在新增场景后出现 `34 !== 30`，这证明计数门过期，不证明新场景错误。
