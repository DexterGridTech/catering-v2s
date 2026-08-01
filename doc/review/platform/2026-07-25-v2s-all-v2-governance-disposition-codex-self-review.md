---
title: all-v2 执行治理 disposition Codex 对抗自审
status: SELF_REVIEW_ROUND_1
reviewTarget: doc/review/platform/2026-07-25-v2s-all-v2-governance-disposition-ledger.md
createdAt: 2026-07-25
---

# all-v2 执行治理 disposition Codex 对抗自审

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=V2S-ALLV2-GOVERNANCE-DISPOSITION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
RESET_TRIGGER=Dexter changed the priority from C-01 wireframe follow-up to a complete all-v2 governance disposition and authorized the listed governance-only remediation.
```

## 用户任务

业务用户不直接操作本批产物；其受保护的用户任务是后续 Journey 不会因 agent 从错误的旧拓扑、旧 UI
或不完整日志规则推导出多余页面、错误权限或不可诊断的实现。对业务用户的价值是：已批准 Journey
仍是意图真相，历史资产只能作为可核验的设计/实现参照，不能回流为产品真相。

## Dexter 立场

Dexter 要的是逐条对账，而不是“v2s 已有大概类似规则”的泛化声明；已知缺口要一次补齐，但不允许把
all-v2 多服务迁移治理、旧 MDB/Step 许可和运行脚本偷带进单 deployable 的当前范围。R4 只能登记真实
future obligation，R3 更不能借 Heritage 脚本伪称已经接线。

## 替代方案

1. **只列若干相似文档链接。** 成本最低，却无法证明每个 AGENTS 条目已经处理，也掩盖拓扑不适用；不选。
2. **整份复制 all-v2 AGENTS/standards。** 表面完整，却会复制旧 package、MDB、outbox 和多服务预设；不选。
3. **只登记 hash，不冻结脚本或标准。** 减少副本，但以后无法在 v2s 进行 source/copy 漂移核验；不选。
4. **逐条四态 disposition；只冻结三项明确需要的资产；R4 只记录两个 future gate 与一个原生 phase-retrospective 设计义务。** 复核成本可控，并且保留拓扑差异；采用。

## 方案合理性

本批问题是旧治理如何在不复制旧拓扑的前提下继续保护用户任务；方案的主要代价是维护 26 项可复算
冻结输入与一张逐条台账，收益是消除“似乎已有规则”的盲区。相较整份搬运或立即建门，该复杂度与
当前治理风险相称。

| 发起的攻击 | 复核事实、反例与边界 | 结论 |
| --- | --- | --- |
| “26 项 Heritage 破坏了 R1 的 23 项冻结分母” | 旧 checker 把 23 写死；本批同时改独立 inventory、registry 与 validator，并用 26 项 baseline、少项、源漂移和副本漂移红夹具证实。反例是只改 registry 让 checker 继续接受 23 项 | `CONFIRMED`：这是有界的 governance denominator 扩展，不是隐性 fallback；新三项都 copy/source hash 绑定 |
| “直接把 all-v2 traceability 脚本复制到 scripts/check 才算承接” | all-v2 脚本绑定旧四域 Batch、registry、runtime path；v2s 没有这些当前输入。直接运行会产生假绿或假红 | `CONFIRMED`：冻结作 Heritage，matrix 记为 R4 `PLANNED`，先按 v2s 语义重建才合理 |
| “phase retrospective 必须立刻新建 checker” | 规则含失败模式、有限分母、设计取舍和 obligation，不能由关键词理解；当前没有反复回归证据说明一个机器门的维护成本值得 | `CONFIRMED`：先作为 routed operation memory；R4 先过建门三问和 red mutation，避免伪语义门 |
| “carry-over-first 是 v2s 新约束，会压过业务设计” | 重新打开 all-v2 AGENTS L46 与 v2s decision：来源是先复核/继承已验证组合；decision 明定 Journey/corpus/Dexter 裁决优先 | `CONFIRMED`：将其标为恢复规则，且只规定先盘点、差异可见和 future manifest，不授予搬运 |
| “六行进度/结束闸门会妨碍用户及时得到回答” | 该规则只在 active goal/current task 仍可推进时阻止伪结束；明确产品/外部授权、受控阻断和完全闭环三种 final 出口 | `CONFIRMED`：它提升可审计性，且不改变 Dexter 的终裁与 Git 边界 |

## UI 与交互

`NOT_APPLICABLE`：本批不新增或改动任何用户可见页面、线框、动态 demo、contract 或 app。它只登记
future UI traceability 的 Heritage 参照与 R4 待接线项。理由是把旧页面/旧 locators 当成当前 UI 会违反
carry-over-first 的“先批准 Journey，再盘点差异”次序；下一份 UI-bearing interaction artifact 仍必须
证明每个操作来自批准用户任务并经 Dexter 看图。

## 审查意见复核

`NOT_APPLICABLE`：本轮是本批冻结前的第一轮 Codex 自审，尚未收到 Claude finding。已主动以“全量
复制”“直接运行旧 checker”“R4 提前接线”“历史 UI 覆盖新 Journey”作为反例复核，并以 source reopen、
hash 与现行 matrix/roadmap 证据作出最小处置；Claude 的后续 finding 只能触发本 cycle 的第二轮定向核验。

## 闭环核验

- disposition ledger 覆盖 all-v2 AGENTS 的开工、规则、协作、进度/结束与完成条目，并覆盖 CLAUDE
  清单和八份 standard 的标题/用途；每项只有四态之一；
- 26 项 Heritage registry/required inventory 完全相同，新增脚本与日志标准均为 byte-for-byte 冻结；
- log-first kernel 保持压缩，并已路由回指完整 Heritage 标准；phase retrospective 已成为 active
  operation memory，且明确 gate 尚未实现；
- `B.5.N01` 与 `B.5.N08` 仅为 R4 `PLANNED`，R3 coverage 保持 PASS；没有新增业务实现、contract、
  数据库、DEV、动态运行或 Git 写入。

## 结论

```text
VERDICT=GO
SCOPE=GO_FOR_CLAUDE_REVIEW_OF_ALL_V2_GOVERNANCE_DISPOSITION_AND_MISSING_REMEDIATION
M=0
S=0
N=2
N-01=R4 must build v2s-native UI/terminology traceability gates and prove red mutations; frozen all-v2 scripts are reference only.
N-02=R4 must apply the gate-admission three questions before creating a v2s phase-retrospective checker; current operation memory is not an executable gate.
NEXT=freeze this governance batch and request Claude fresh review; C-01/R3 implementation work remains outside this batch.
```
