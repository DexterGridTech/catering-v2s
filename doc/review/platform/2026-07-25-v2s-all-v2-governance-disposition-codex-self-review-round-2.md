---
title: all-v2 执行治理 disposition Codex 对抗自审（第 2 轮定向核验）
status: SELF_REVIEW_ROUND_2_FINAL
reviewTarget: doc/review/platform/2026-07-25-v2s-all-v2-governance-disposition-ledger.md
createdAt: 2026-07-25
---

# all-v2 执行治理 disposition Codex 对抗自审（第 2 轮定向核验）

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=V2S-ALLV2-GOVERNANCE-DISPOSITION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
```

## 用户任务

业务用户不直接操作本台账；其被保护的用户任务是后续 agent 能从真实、可打开的现行治理落点恢复
约束，而不会从死链接、错误的 UI 参照或仅做 memory 路由的 inventory 误推实现与权限。修复这些
导航事实不会增加任何业务 Journey、页面、账号、契约或运行能力。

## Dexter 立场

Dexter 要“v2 有价值的东西搬全”，但只接受在 v2s 单 deployable、当前 Roadmap 与逐条 disposition
之内的恢复。Claude 的三项 N 是可定位的治理资料错误；最小目标是恢复台账的可追溯性，不创建一份
重复的整合管线 decision，也不把 R4 enforcement 提前声称为 active。

## 替代方案

1. **新建 `design-delivery-pipeline.md`。** 表面兼容旧引用，却重复 Batch 1 已冻结管线并扩大治理面；不选。
2. **保留 template 作为 L48 的来源。** 路径存在但不含三矩阵，造成假可追溯；不选。
3. **继续引用 required inventory。** 它只登记 memory 路由，不表达 enforcement/evidence；不选。
4. **把六处死引用回指 Batch 1 §3/§4，L48 回指已冻结 AntD/组件选择资产，L26/L61 回指 matrix 的
   `memoryRefs + enforcement`。** 改动最小且每个落点有 owning source；采用。

## 方案合理性

本轮问题是台账可追溯性失真；采用的方案只修正其现行来源。代价是逐处重开 source 与复跑治理门，
收益是后续 agent 不会按错误导航恢复约束，且不需要引入重复治理文件。

| 攻击 | 复核事实、反例与适用边界 | 结论 |
| --- | --- | --- |
| Batch 1 是否足以替代不存在的整合 pipeline？ | 重开 Batch 1 §3：它逐项规定 Journey→交互→Dexter 看图→implementation-facing design→两轮自审→Claude review；§4 区分 granularity 机械门与人审。反例是另建重复 decision 导致两个管线真相 | `CONFIRMED`：回指 Batch 1 是更小且正确的修复 |
| L48 的 hash 是否真承载 UI 组件/列表纪律？ | 重开冻结 `admin-component-selection-precedence`（`deba…d9fe0`）：它规定 ProTable、DrawerForm/ProForm、交互 Step 与 L2，且引用正式 AntD 使用标准。反例是模板状态表，它不包含三矩阵 | `CONFIRMED`：改为 `CARRIED_ASSET`，不伪称模板覆盖 |
| receipt/obligation 的 current truth 是否在 required inventory？ | 重开 deterministic-context-only：inventory 只负责路线；matrix 为每条 frozen rule 绑定 `memoryRefs + enforcement`。反例是把 inventory 当 gate/evidence contract | `CONFIRMED`：L26/L61 回指 standards matrix，保留 R5 最小形态待决 |

这些修复只消除错误导航，没有引入新门、hash、Heritage 资产或产品语义；成本低于继续留着让后续
agent 误读 current truth 的风险。

## UI 与交互

`NOT_APPLICABLE`：本批只修治理台账引用，没有新增或改变用户可见 UI、交互、线框、静态 demo 或
业务文案。L48 的修正只是将 UI 设计参照指向正确冻结 Heritage；它不授权从 Heritage 搬运 UI。理由
是当前 UI 必须先由批准 Journey 与 interaction artifact 决定。

## 审查意见复核

- **Claude N-1（死引用）=`CONFIRMED`。** 已重新打开 ledger、文件系统与 Batch 1 §3/§4；不存在的
  `design-delivery-pipeline.md` 在全部六处改为真实现行落点。反例是补一个重复 decision，因会制造
  两个管线真相而被拒绝；更小修复是回指既有 Batch 1。
- **Claude N-2（L48 错误 UI 模板）=`CONFIRMED`。** 已重开 template 和 `deba…d9fe0` frozen asset；
  L48 改为 `CARRIED_ASSET` 并限定其只作未来含列表 Journey 的 Heritage 参照。反例是从 hash
  推导运行时组件或产品操作，已明确排除。
- **Claude N-3（L26/L61 enforcement 落点）=`CONFIRMED`。** 已重开 required inventory 与 standards
  matrix；两行改为 matrix 的 `memoryRefs + enforcement`，而非把 inventory 夸大为 enforcement 机制。
  更小修复是两处引用替换，不新增 R4 gate 或 R5 receipt 形态。

每项 finding 均重开 owning source、查看反例和适用边界后采纳；没有将 Claude finding 全盘升级为
新范围。该 cycle 已到第 2 轮，之后禁止第三轮 Codex 对抗审查。

## 闭环核验

- `rg` 已确认 ledger 中不再出现不存在的 pipeline、错误的 L48 template 落点或 L26/L61 inventory
  enforcement 落点；
- heritage registry 与 self-test、R3 standards coverage、project-memory 和 diff whitespace 已 fresh PASS；
- 本批仍无 implementation、contract、数据库、DEV、动态运行、seed/reset 或 Git 写入。

## 结论

```text
VERDICT=GO
SCOPE=GO_FOR_CLAUDE_QUICK_CONFIRMATION_OF_ALL_V2_GOVERNANCE_DISPOSITION_N1_TO_N3
M=0
S=0
N=0
ROUND_FINAL_DECISION=SELF_DECIDED
NEXT=Claude quick confirmation, then Dexter acceptance; no implementation authority follows.
```
