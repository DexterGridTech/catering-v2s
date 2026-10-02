# 正式需求 R2 无效尝试 · 输入越界记录

```text
REVIEW_CYCLE_ID=TER_ACTIVATION_INTERACTION_PAIR_TOPOLOGY_REQUIREMENTS_2026-10-02
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
REVIEW_STATUS=INVALID_INPUT_BOUNDARY_VIOLATION
VERDICT=NOT_ISSUED
reviewerKind=INDEPENDENT_SUBAGENT
reviewerSession=/root/activation_formal_requirements_r2
AUTHOR=Codex（仅保存状态与 reviewer 原文）
```

## 实际状态与处置

该 reviewer 主动报告明确输入越界，并停止形成 verdict；最终状态 completed，零写入、零动态。
last known good 为冻结 SHA 匹配、入口/kernel/recall 及部分原文读取；first failure 为跨章节
sed 读取到 §8 作者分析；broken boundary 是独立 verdict 之前不得读取作者结论。
不是超时中断，不作有效审查通过或失败结论，不计为新增有效审查轮次。

主 agent 以 fresh `/root/activation_formal_requirements_r2_replacement` 接替同一 R2，同一 cycle、
目标、范围与 SHA 不变。不得继承无效尝试分析；禁止第三轮。

## Reviewer 最终消息原文

Dexter，本 reviewer 因输入越界停止，不能提供有效第二轮 verdict。

- 被审文件 SHA-256 复算为 `43c8c0b56fe009b42512fddbf2513e339483dc7f5daafee49998c4e044c78dfb`，与冻结值一致。
- 已读入口链、仓内 review/memory skills、6 kernel、确定性 recall 输出和部分 routed 原文、正式需求全文、原讨论用户输入。
- 读取原讨论稿 `347～602` 行时，误包含 `§8`（484～507 行）作者静态盘点，发生于独立 findings/verdict 形成之前，违反明确盲审边界。
- 未读取第一轮报告、作者处置或讨论稿 §10；仍不足以消除上述越界。
- `REVIEW_STATUS=INVALID_INPUT_BOUNDARY_VIOLATION`
- `VERDICT=NOT_ISSUED`
- `authorMaterialReadAfterIndependentVerdict=false`
- `authorMaterialReadBeforeIndependentVerdict=true`
- 零文件写入、零动态、零 Git 操作、零子 agent 派发。

应由其他 fresh reviewer 接替同一 `REVIEW_ROUND=2`；本报告不算有效审查轮次，也不能据此声称独立需求审查通过。已停止任务。

## 有限防再犯检查

失败模式：产品原文与作者分析位于同一文件，相邻行的粗范围读取使盲审输入被污染。
根因层：review 输入选择；适用范围为有明确禁止章节的文档盲审，非所有源码读取。
最小解：先只列标题和行号，再对每个允许章节单独读取，不跨禁止章节；截断输出补读，不能追认已读。
反例：本稿的 347～602 行不得作为原用户输入片段；§0 12～70、§7 469～483、§9 509～605
在标题复核后各自独立读取。本次 replacement prompt 已明确这些边界。

交付检查：有效 R2 必须声明未读 §8/§10/首轮报告/作者处置、目标 SHA 与实际输入清单。
本记录只作 review checklist，不建设 hook、机器门或新的审查轮次。
