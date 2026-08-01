---
title: R5 合规整改 manifest Part B/C/D 章节命中对照
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
reviewTarget: DESIGN
implementationAuthority: false
---

# R5 合规整改 manifest Part B/C/D 章节命中对照

## 0. 使用规则

本表供独立子 agent 与 Claude 做章节级 source reopen。`ruleIds` 均为
`contracts/policy/standards-coverage-matrix.json` 的真实 ID，不使用区间 token 或通配符。
机器 enforcement 仍由 matrix 决定；本表不把 machine rule 伪装为 human review，也不复制规则正文。

## Part B

| 章节 | 真实 ruleIds | 设计单元 | 详设锚点 | human checklist |
| --- | --- | --- | --- | --- |
| B.1 | B.1.N01, B.1.N02, B.1.N03, B.1.N04, B.1.N05, B.1.N06, B.1.N07, B.1.N08, B.1.N09, B.1.N10, B.1.N11, B.1.N12, B.1.N13, B.1.N14, B.1.N15, B.1.N16, B.1.N17 | U03/U04 | §4.4–§4.5 | matrix 对应 `reviewChecklistRef`；GATE 项为 N/A |
| B.2 | B.2.N01, B.2.N02, B.2.N03, B.2.N04, B.2.N05, B.2.N06, B.2.N07, B.2.N08, B.2.N09, B.2.N10, B.2.N11, B.2.N12, B.2.N13, B.2.N14, B.2.N15 | U01/U03/U04 | §4.2, §4.4–§4.5 | matrix 对应 `reviewChecklistRef`；GATE/ARCHUNIT 项为 N/A |
| B.3 | B.3.N01, B.3.N02, B.3.N03, B.3.N04, B.3.N05, B.3.N06, B.3.N07, B.3.N08, B.3.N09, B.3.N10, B.3.N11, B.3.N12 | U04/U07/U08 | §4.5, §4.8–§4.9 | matrix 对应 `reviewChecklistRef`；机器项为 N/A |
| B.4 | B.4.N01, B.4.N02, B.4.N03, B.4.N04, B.4.N05, B.4.N06, B.4.N07, B.4.N08, B.4.N09, B.4.N10, B.4.N11, B.4.N12, B.4.N13, B.4.N14, B.4.N15, B.4.N16, B.4.N17, B.4.N18, B.4.N19, B.4.N20 | U02/U05/U06 | §4.3, §4.6–§4.7 | matrix 对应 `reviewChecklistRef`；机器项为 N/A |
| B.5 | B.5.N01, B.5.N02, B.5.N03, B.5.N04, B.5.N05, B.5.N06, B.5.N07, B.5.N08, B.5.N09, B.5.N10, B.5.N11, B.5.N12, B.5.N13, B.5.N14, B.5.N15 | U05/U06 | §4.6–§4.7 | `JOURNEY_INTERACTION_REVIEW`；机器项为 N/A |
| B.6 | B.6.N01, B.6.N02, B.6.N03, B.6.N04, B.6.N05, B.6.N06 | U04/U08 | §4.5, §4.9 | matrix 对应 `reviewChecklistRef`；机器项为 N/A |

## Part C

| 章节 | 真实 ruleIds | 设计单元 | 详设锚点 | checklist |
| --- | --- | --- | --- | --- |
| C.1 owner/transaction | C.T01, C.T02, C.T03, C.T04, C.T05, C.T06 | U03/U04 | §4.4–§4.5 | `REFERENCE_PATTERN_APPLICABILITY_REVIEW` |
| C.2 contract/generated | C.T07, C.T08, C.T09, C.T10, C.T11, C.T12 | U01/U02 | §4.2–§4.3 | `REFERENCE_PATTERN_APPLICABILITY_REVIEW` |
| C.3 frontend/foundation/test | C.T13, C.T14, C.T15, C.T16, C.T17, C.T18, C.T19 | U02/U05/U06 | §4.3, §4.6–§4.7 | `REFERENCE_PATTERN_APPLICABILITY_REVIEW` |
| C.4 run/red fixture | C.T20, C.T21, C.T22, C.T23 | U00/U08 | §2.5, §4.1, §4.9 | `REFERENCE_PATTERN_APPLICABILITY_REVIEW` |

## Part D

| 章节 | 真实 ruleIds | 设计单元 | 详设锚点 | human checklist |
| --- | --- | --- | --- | --- |
| D.1 layout | D.1.L01, D.1.L02, D.1.L03, D.1.L04 | U00/U04/U05 | §4 | 全部 GATE，human N/A |
| D.2 contract governance | D.2.L01, D.2.L02, D.2.L03, D.2.L04 | U01 | §4.2 | matrix 对应 `reviewChecklistRef` |
| D.3 gate discipline | D.3.L01, D.3.L02, D.3.L03 | U00/U08 | §2 | 全部 GATE，human N/A |
| D.4 document governance | D.4.L01, D.4.L02, D.4.L03, D.4.L04, D.4.L05 | U00/U09 | §0, §10 | `DOCUMENT_GOVERNANCE_REVIEW` |
| D.5 process sizing | D.5.L01, D.5.L02, D.5.L03, D.5.L04, D.5.L05 | U00/U09 | §3, §7 | `DELIVERY_PROCESS_REVIEW` |
| D.6 version/dependency | D.6.T01, D.6.T02, D.6.T03, D.6.T04, D.6.T05, D.6.L01, D.6.L02, D.6.L03, D.6.L04, D.6.L05, D.6.L06 | U01/U02/U04/U08 | §4 | `DEPENDENCY_AND_VERSION_DECISION_REVIEW` |
| D.7 AI-first entry | D.7.T01, D.7.T02, D.7.T03, D.7.T04, D.7.T05, D.7.T06, D.7.T07 | U00/U08 | §2, §4.9 | `CLAUDE_ENTRY_INTENTIONAL_REVIEW`；机器项为 N/A |
| D.8 logging | D.8.L01, D.8.L02, D.8.L03 | U00/U03/U07/U08 | §8 | matrix 对应 `reviewChecklistRef`；机器项为 N/A |

## 4. 评审必须特别证伪

1. source-derived hook 是否仍可能通过硬编码 predicate 列表伪造“动态分母”；
2. package exit 是否真逐项覆盖 memory occurrence、design assertion、forbidden、surface 与 matrix；
3. D-1～D-7 是否被 recommendation 偷换成默认决定；
4. strict serial 是否还有 W03 parallel 的旧口子；
5. CR00 是否可在无 Gradle、无本机 Docker 前提下先完成；
6. CR08 是否忠实复用远端 Testcontainers 路径；
7. 106/32/22/25/7 是否被整改名义扩大或收缩。

