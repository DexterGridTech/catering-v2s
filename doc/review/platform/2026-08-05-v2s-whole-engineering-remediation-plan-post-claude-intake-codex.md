---
title: 全工程修复程序计划的 Claude S/N post-remediation intake（Codex）
status: CURRENT_BYTES_UNREVIEWED_BY_CLAUDE
binding: POST_REMEDIATION_V1
reviewPath: doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-plan-review-claude.md
reviewRound: claude-current-byte-recheck
implementationAuthority: false
---

# Claude S/N post-remediation intake

## 边界与方法

独立子 agent 的 DESIGN cycle 已在两轮后 hard-stop；本文件不创建第三轮、也不改写任何历史 verdict。Claude 的 `M=0/S=3/N=2` 是 current plan 的语义 review。本 intake 只对确认部分作最小程序计划修订，当前字节明确未被 Claude review，必须 recheck 后才可称当前计划通过；这也不授权实施。

## 处置表

| Finding | 核验与处置 | 状态 |
| --- | --- | --- |
| S1 分母单位混用 | **PARTIALLY_CONFIRMED。** Claude 正确指出 occurrence、physical line 与全业务 enum 不能相减。独立源码复扫证实五个完整 Java 节点 token 为 477 occurrences / 320 lines；但 Claude 采用的 `SQL 4 + logic 316` 亦无法按当前源码复现（单引号 node token 至少 11 occurrences / 8 lines）。因此计划不写入另一组未经复现数字，而改为 477/320 可复现发现面、SQL 独立处置、分类后导出 `SERVICE_NODE_LOGIC_LINES`；673 只有 vocabulary 后才是独立 discovery。 | CONFIRMED_WITH_NUMERIC_CORRECTION |
| S2 D4 阻塞恢复 | **CONFIRMED。** 将原 RP-02 拆为不依赖 D4 的 RP-02a（facts/dispositions、147、projectId、placement/catalog、4-vs-7 assertion）和依赖 D4 的 RP-02b（request validator）。 | CONFIRMED_AND_REMEDIATED |
| S3 防复发缺口 | **PARTIALLY_CONFIRMED。** 防复发需要补齐，但“全部门进 verify”“立即建三条 memory”会违反真实 gate 三问、单一真相和分钟级约束。采纳 registry relationship completeness + 四类 red mutation；复用既有 observability 标准；closed-set memory 延后到分类完成；typed failure 采用 owner checklist；R-close 改 classification readback。 | CONFIRMED_WITH_NARROWER_REMEDY |
| N1 enterable 优先级 | **ACCEPTED。** 新增 RP-12-pre 安全微单元，独立于收敛集合实施。 | ACCEPTED |
| N2 五集合起点 | **ACCEPTED。** 计划列出当前已知集合和值，同时明确其不能替代逐行语义归类。 | ACCEPTED |

## 复核证据与反例

- S1 的可复现命令分母是 `apps/backend/catering-business-server/**/src/main/java/**/*.java` 内五个完整 Java token；`GROUP_WORKSPACE`、`STORE_CONTRACT` 等复合枚举是明确反例。
- S2 的 RP-02a 不得将 registry 派生为 scenario；每条 fact 仍须真实业务 task/sourceRef/readback/oracle。`r5-joint-remote-l2-fixture.mjs` 已无 `projectId`，是两处陈旧 payload 的对照而非“所有 runner 已修”的证明。
- S3 registry 的语义只检查 wrapper/registry/aggregate 引用关系；它不判定产品层面豁免正确性。全量运行 parameterized、closed-phase 或远程控制将违反受管验证边界和分钟级目标。

## 后续约束

Claude current-byte recheck 若 GO，仅表示程序级计划可作为逐单元 implementation-facing 详设的输入。RP-02a、RP-12-pre 等单元仍必须各自重开原始业务材料、IA（如 UI-bearing）、六维 memory、owner source、granularity manifest、独立 DESIGN review 和 Claude handoff；D1--D7 未被本 intake 解除。
