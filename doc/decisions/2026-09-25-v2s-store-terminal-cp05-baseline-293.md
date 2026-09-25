---
title: 门店终端 CP-05 三次运行 293 操作基线选择
status: IMPLEMENTATION_ACCEPTED
createdAt: 2026-09-25
decisionOwner: Dexter
decisionRef: DEXTER-2026-09-25-V2S-STORE-TERMINAL-CP05-BASELINE-293
implementationAuthority: true
---

# 门店终端 CP-05 三次运行基线选择

## 1. 决策

Dexter 已授权本次由 Codex 按长期可追溯、业务事实优先的方向决策并实施。本批选择当前
字节可复核的三次受管 CP-05 运行作为基线：

- `expectedOperations=293`；
- `runCount=3`；
- 分类规则为逐 operation 取三次最大值，不取平均值；
- 三次运行的业务与 cleanup 均为 `PASS`，操作闭集均为 `293/293`，缺失、额外与漂移均为空；
- 该选择不是 operation-scoped budget exception，不删除、合并或弱化任何业务事实。

不可从当前仓库字节恢复的旧 `286` 报告不被重建，也不作为当前基线输入。历史材料中出现的
`286` 只保留其历史语义，不替换当前报告的实测闭集。

## 2. 证据

唯一输入为 `contracts/policy/backend-performance-cp05-calibration-report.json`，其三次来源为：

| runId | manifestDigest | eventsDigest |
| --- | --- | --- |
| `r5-tc-1790242049278-98426` | `43c9a103ff0b77c6a419803e92cd0c316b2e4b217de0c47f0e96bddacbe538b1` | `0cf99b1982a670435a7af50d9638c76ce96cad75ef7ae2b1c9cc5ef42669262c` |
| `r5-tc-1790241202555-53818` | `9f351bbcdb94d76546b26c014fae063065714cc0832f4a966e29a6c86136eb09` | `966b667791b139e5ad7504770ca9025073a7a4c5d201de0cb37e253045e31048` |
| `r5-tc-1790241588769-69115` | `2fe3af1f32fbf213447e8049488f647f0a43bb7667484e52291518975d687b1f` | `de7264712a41e305e4797c3a78bed6f112a0d0c0d8401206535e117cb5013069` |

报告的 `replayIdentity.contentDigest` 为
`06138adb5cb2b1d478eda213534474ac0182076e4a78220e52cc9aac7f18b065`；三次完整 run identity、
操作闭集与业务/cleanup 证据仍以报告为唯一可审计住址。

`transitionOperationsProductionTagStatus` 的最大数据库操作数保留为 `9`。现有 `7` 次是正常
状态流转路径；`9` 次出现在作废引用保护分支，额外读取
`CatalogProductionTagOwnerPersistence#findByCode` 与
`CatalogItemReferenceFacts#referenced`，用于阻止仍被商品引用的生产标签进入作废状态。
该分支是生产标签生命周期的权威业务事实，不属于测量噪声或可删除的冗余查询。

## 3. 机器约束与单一住址

三次报告必须带非空 `budget.baselineDecisionRef`，并由 `backend-performance-budget.mjs` 在
消费报告前拒绝缺少该字段的三次报告。三次重分类命令必须显式接收
`--baseline-decision-ref`；单次当前程序结果继续使用既有的
`CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF`，两种形态不可混用。

本决定的 ref 是：

`DEXTER-2026-09-25-V2S-STORE-TERMINAL-CP05-BASELINE-293`

报告仍是唯一 build-time budget input；本决定只解释并授权其三次来源，不成为第二份预算表。
契约输出继续由 `scripts/generate/catalog-inventory-p1.mjs` 从报告读取并生成，禁止手工改写
36 个输出文件。

## 4. 选择理由与边界

选择可从当前字节复核的 293 而不是猜造 286，是因为后者无法提供完整的 run manifest、事件、
操作闭集和 replay digest；伪造旧基线会让当前契约预算失去来源。接受 293 也不等于全局放宽：
每个 operation 仍由三次最大值、既有分类规则和现有校验器决定，未准备好的 operation 仍阻断。

如果将来要更换基线，必须新增明确的 Dexter decision ref、完整受管来源和新的报告 digest；不得
仅改 `expectedOperations`、预算数字或生成时间。
