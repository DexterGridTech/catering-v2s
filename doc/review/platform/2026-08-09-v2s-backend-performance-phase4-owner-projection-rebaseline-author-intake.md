# BP-U05 owner-projection rebaseline Round 2 作者处置

Review cycle: `OVERALL_PHASE_4_U05_OWNER_PROJECTION_REBASELINE_DESIGN_20260809`  
Review target: `DESIGN`  
Independent round: `2/2` (`ROUND_FINAL_DECISION=SELF_DECIDED`)  
Reviewed manifest: `064941a233295496ffa4742fa0a88cdbc02d9a4c133e9576eda3a99673c672dd`

本处置只处理最终独立设计审查的两个 finding；不伪造第三轮 Codex 审查，不进入 BP-U06、运行环境、数值优化、DEV、reset/seed、L2/UAT、部署或仓库控制。

## 辩证复读与处置

| finding | disposition | 复读结论与最小修复 |
| --- | --- | --- |
| `BP-U05-OPRB-R2-M-01` | `PARTIALLY_CONFIRMED` | 根因成立：`OperationsAuditHistoryController#history` 目前先走 `requireHostAuthorization`，其中会触发 organization detail、contract view 或 workspace-IAM authorization lookup，之后才按 owner 读审计；把它标为 cap=1 会是假绿。审查文字称“8 个 branch”，但实际 source 的有限类型为 9 个：`WORKSPACE_ACCOUNT`、`WORKSPACE_INVITATION`、`COMMERCIAL_GROUP`、`ORGANIZATION_NODE`、`BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`STORE_CONTRACT`。修复不接受更大 cap 或跨 schema SQL：建立 `OperationsAuditTaskReadService#read(OperationsAuditReadQuery)`，由 typed query 携带既有 read facts、canonical type、UUID/page；静态九分支分别调用 owner-local projection，每个将 target/host scope/typed failure/window count/page 合为一 logical statement。edge 只能映射结果。控制在实现转 `TASK_READER` 时验证 exact reader/method/query/result/edge call、九分支、无 legacy lookup 与 window-count，并以 production source mutations 验红。 |
| `BP-U05-OPRB-R2-S-01` | `CONFIRMED` | 未来 reader 的 path 未被 manifest/package 承认，不能产生可追溯 receipt。已把 Operations audit、Platform audit、Platform group-workspace coordinator 及其 tests 逐条加入 exact surface，并修正 policy 中不存在的 `modules/audit` 路径为仓内实际可承载 coordinator 的 `app/application/audit`。它们仍是 `SOURCE_NOT_IMPLEMENTED_BLOCKED`，没有被计入已完成 readers。 |

## 更小替代比较

- 保留旧 controller 逻辑、仅把 cap 改为 2：改动更小，但会把实际的多段 authorization chain 永久留在 B=78 之外，且隐去每个 owner 的 target/scope predicate；拒绝。
- 新建跨 schema audit SQL：能压计数，但越过事实 owner；拒绝。
- 将 platform audit coordinator 放进不存在的 `modules/audit`：无法提供真实 source/test path；拒绝。
- 采用 app application 层的静态 typed coordinator：不拥有表、没有字符串 operation dispatch，owner SQL仍在各模块；是满足现有模块拓扑的最小解。

## 当前事实与后续门槛

- 10 个 `primaryQueryCap>1` 例外分母不变；operations audit 保持 cap=1、未实施、未测量。
- `BP_U05_READ_BUDGET_STATUS=BLOCKED_UNMEASURED` 与 `BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED` 不变；没有 SQL 数值优化成功结论。
- 当前字节在本 cycle 的 Round 2 后才产生；它们未经独立对抗 reviewer 审阅，必须 Claude 定向 recheck。在该 recheck 前，BP-U05 implementation authority 保持 false。
