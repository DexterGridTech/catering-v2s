# TDP 数据变化通知与远程运维 · DESIGN review round 2

```text
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_DESIGN_2026-10-04
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER=/root/tdp_design_round2
BLIND_REVIEW=reviewer先读需求、规范、详设/计划与owning source形成判断，再对照作者材料
VERDICT=NO-GO
M/S/N=1/3/1
EVIDENCE=静态只读；未运行生成、构建、测试、verify、DEV或动态验收
ROUND_FINAL_DECISION=SELF_DECIDED
```

## 第二轮 findings 摘录

本记录保留独立 reviewer 原结论。主 agent 的 intake 与最终处置另见 `2026-10-04-v2s-tdp-data-change-and-remote-operations-finding-intake-round2-codex.md`。

| Finding | Reviewer结论 | 位置 | 问题摘要 |
| --- | --- | --- | --- |
| M-1 | `CONFIRMED` | 详设数据库通路、CP-03/06；计划CP-03/06 | 跨进程投递/结果回写需具名、可执行的数据库中介接线，不能以“owner DB API”空泛带过；最终状态与查询语义要闭合。 |
| S-1 | `UNVERIFIED_REQUIRES_EVIDENCE` | 详设第三方版本段；计划各CP前置 | 仓内声明版本不等于当前运行/测试依赖解析；需在实施相关CP前保存实际依赖图并按精确版本核官方API。 |
| S-2 | `CONFIRMED` | 详设V-06/R-06、§11a | cache重启读回和listener重建读回缺独立可执行场景；空cache row与不存在row需区分。 |
| S-3 | `PARTIALLY_CONFIRMED` | 详设§9a、CP-06、容量表；计划CP-06 | 终端容量值、旧binding永久保留和CBS历史清理被混在一起；不确定产品选择不应作为CP退出条件。 |
| N-1 | `CONFIRMED` | 详设CP-01门闭包 | 新增操作的输入、首个读取门、执行模式和红夹具映射仍有缺项。 |

### Reviewer 标示的未验证边界

- 实际 Gradle/Yarn 依赖解析版本及对应版本官方API依据未核；本轮无依赖报告。
- cache/listener、数据库投递、终端容量与清理行为没有动态证据。
- 全部新需求场景仍为 `NOT_RUN`；不得将设计计划表述成通过。
