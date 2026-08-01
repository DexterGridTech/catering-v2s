---
title: R5 whole-scope design round-2 independent findings author intake
status: POST_ROUND_2_REMEDIATED_FOR_CLAUDE_REVIEW
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewCycleId: R5-W3-DESIGN-20260725
reviewTarget: DESIGN
reviewRound: 2
reviewRoundLimit: 2
roundFinalDecision: SELF_DECIDED
furtherCodexAdversarialRoundAllowed: false
implementationAuthority: false
---

# R5 whole-scope design round-2 findings intake

## 1. 边界与结论

第二轮 fresh 独立子 agent 在其冻结输入上给出 `NO_GO(3 M / 4 S / 0 N)`；该 verdict 与
其输入 hash 保持历史原样。作者逐条重开 owning source、catalog、fixture contract、Journey
和开发蓝图后，七项均确认为局部、真实、无需产品裁决的确定性缺口。

本文件只记录作者辩证 intake 和修复。`REVIEW_ROUND_LIMIT=2` 已用尽，不开启第三轮、
不改写第二轮 verdict，也不宣称独立 reviewer 审过修订后的新字节。post-round-2 包直接交
Claude 与 Dexter 审查；R5 implementation 仍未授权。

## 2. 逐项 disposition

| Finding | Intake | 反例/适用边界 | 更小替代与成本 | 已完成处置 |
| --- | --- | --- | --- | --- |
| `R5-DESIGN-R2-M-001` | `CONFIRMED` | 104 operation 各自带 scenarioId 不能证明某个 scenario 所需 operation 无缺漏 | 不建 trace DB；在同一 catalog 加 32 行反向表最小 | `scenarioOperationCrosswalk` 固定 32 行 `orderedSteps`，每步绑定 operation/face/owner/page/disposition/正负 proof；双向数据校验 104/32 PASS |
| `R5-DESIGN-R2-M-002` | `CONFIRMED` | U06 文本禁止公开 guard，但 baseline component 仍会给 codegen 一条合法生成路径 | 不增加新授权系统；删三项 ref 并冻结 forbidden symbol closure | 删除 `WorkspacePageEntryGuard`、`WorkspacePageEntryGuardRequest`、`WorkspaceRoleCandidateCatalog`；`componentOverrides` 固定 forbidden symbols 与零引用范围 |
| `R5-DESIGN-R2-M-003` | `CONFIRMED` | 同一个 business-entity definition GET 无 selector 时，BRAND/TENANT/HEAD_COMPANY 无法确定读哪份 | 不拆三个同义 endpoint；一个闭集 query 参数更小 | operation 增加必填 `entityType=BRAND|TENANT|HEAD_COMPANY`，pageKey 改为 `OPERATIONS-BUSINESS-ENTITY`；STORE/CONTRACT 继续独立 endpoint |
| `R5-DESIGN-R2-S-001` | `CONFIRMED` | “32 个前提都会解析”没有 32 行数据，两个 seed runner 可自行选择不同正负事实 | 不建 fixture DSL；显式 JSON 行足够 | `scenarioPrerequisites` 固定 32 行，每行至少一个 positive 与 negative fixture ref |
| `R5-DESIGN-R2-S-002` | `CONFIRMED` | 只列 env 名不能说明 pa-support、disabled、OTP/reset 分别消费哪项 secret、为何消费 | 不写 secret 值；只绑定 ref+purpose | `secretBindings` 固定 15 个 platform/operations/invitation/reset fixture 的 `secretRef + purpose` |
| `R5-DESIGN-R2-S-003` | `CONFIRMED` | 泛称 explicit allowlist 允许两个 runner 接受不同 host/db/schema/root | 不建设环境平台；一个版本化 allowlist object 足够 | 固定 `r5-dev-remote-v1`：host value+immutable digest binding、database 名、namespace→schema 公式、asset prefix 与六类 fail-closed negative |
| `R5-DESIGN-R2-S-004` | `CONFIRMED` | `CURRENT/FUTURE/ENDED` 随系统日期漂移 | 不引入 time service；固定 clock + exact LocalDate 足够 | 固定 `2026-07-25T00:00:00+09:00` / `1784905200000`，五合同写明 exact `effectiveFrom/effectiveTo`，系统 wall clock 禁止 |

## 3. 第二轮后新增 Dexter 设计要求

Dexter 在冻结前补充两项不改变业务范围的实现约束，已进入 owning decision、总详设、开发
蓝图与 manifest：

1. 所有后台时间点使用 wire `integer/int64`、Java `long/Long`、PostgreSQL `BIGINT`
   epochMillis；纯合同业务日期明确保持 `date/LocalDate/DATE`，防止把业务日误作时间点；
2. contract source 按 face+capability 与 owner+schema family 分类；根入口只保留引用，手写
   YAML 单文件非空行最多 500，禁止先堆成单体大文件再等末端整理。

Dexter 随后要求重新核验 v2 有价值资产和 v2s 约束。审计发现并补实：

- 后端只搬运/适配 v2 `platform-foundation` 中 correlation、safe logging、Problem、pagination、
  DB observation 与 advisory-lock primitive；OTP policy 移到 workspace-IAM；旧 messaging、
  proof、internal security、downstream translator 和 generated wire 不搬；
- v2s 已复制的 frontend foundation 中 `contextScopedQueryArgs.ts` 和 `foundation.test.ts`
  必须先完成 `workspaceKey → groupWorkspaceKey`，不得只在 app 页面改名。

完整对账见
`doc/review/platform/2026-07-25-v2s-r5-v2-value-and-v2s-constraint-audit-codex.md`。

## 4. post-remediation 自主核验

作者以只读数据核验重新解析三个 JSON，并验证：

- 104 个唯一 operation、32 个唯一 scenario、双向 operation 集合与
  face/owner/page/disposition 完全一致；
- 三个删除 component ref 不在 baseline，business-entity selector 闭集准确；
- 32 行 scenario prerequisite 均有 positive/negative；
- 15 个 secret binding、精确 allowlist、固定 clock 与五个 exact date 合同存在；
- 19 个 frontend surface 与两个 foundation required adaptation 存在。

该核验不是第三轮对抗审查，也不是 implementation evidence。第二轮 review 绑定的是修订前
manifest hash；post-remediation manifest/hash 漂移是诚实结果，不能通过回填旧 review 制造
“独立 reviewer 已审新字节”。下一判断者是 Claude/Dexter。

