---
title: R5 design round-1 independent finding intake
status: AUTHOR_DISPOSITION_COMPLETE
createdAt: 2026-07-25
reviewCycleId: R5-W3-DESIGN-20260725
reviewTarget: DESIGN
reviewRound: 1
reviewRoundLimit: 2
implementationAuthority: false
---

# R5 design round-1 finding intake

## 1. Intake discipline

本 intake 只处置独立子 agent 在
`doc/review/platform/2026-07-25-v2s-r5-design-adversarial-review-round-1.json`
中先行形成的 verdict。作者重新打开 Journey、interaction、operation inventory、implementation
design、execution blueprint、granularity manifest、corpus 与 Heritage v2 OpenAPI 后再作判断，
没有把 reviewer 结论直接当成事实。

## 2. Findings

| finding | disposition | owning evidence reopened | smaller alternative / stage cost | action |
| --- | --- | --- | --- | --- |
| `R5-DESIGN-M-001` | `CONFIRMED` | operation inventory 只有 method/path/face；blueprint 只有 group/global 规则；v2 OpenAPI 真实存在逐 operation request/response/query shape | 只补全局规则仍允许 DTO、错误、页面绑定分叉；新增一份紧凑 operation catalog 比拆 face/module review 成本更低 | 新增逐 operation 的 scenario、owner、page、security、request/query/response、status、error-set、test binding，并冻结 schema/error set |
| `R5-DESIGN-M-002` | `CONFIRMED` | Journey 有 32 scenario，inventory 有 104 operation，design 只有 scenario→unit | 只写总数不能证伪 orphan/missing；无需数据库或逐 Journey review，一份双向 checked JSON 足够 | operation catalog 同时承担 scenario→operation 与 operation→scenario 闭合，两项删除与一项新增进入 disposition |
| `R5-DESIGN-M-003` | `CONFIRMED` | seed blueprint 只有 stage；U11/U12 没有 stable IDs/counts/credentials/negative/reset predicates | 不建通用环境平台；一份 versioned `r5-full` fixture contract 足够 | 冻结 namespace 来源、stable keys/counts、credential references、asset keys、stage receipts、32-scenario prerequisite、negative fixtures、business/cleanup predicates |
| `R5-DESIGN-S-001` | `CONFIRMED` | canonical face denominator 为 `38+55+11=104`；manifest U08 错写 40 | 无替代设计成本 | 改为 38，并在 catalog 与 manifest 声明和为 104 |
| `R5-DESIGN-S-002` | `CONFIRMED` | carry-over decision 要求 source/target 清单；U08-U10 只有目录级 surface | 不建视觉资产服务；逐 surface 静态表即可 | 新增 source hash→target→foundation primitive→generated slice→route→focused proof 表 |
| `R5-DESIGN-S-003` | `CONFIRMED` | inventory 明确删除 public page-guard operation，但 U06 使用了模糊的 “page guard” | 不引入 policy engine | 命名 internal `ResolveNavigation`/owner endpoint authorization，明确禁止 page-guard endpoint/read edge，并把 route 与 owner source 绑定 |
| `R5-DESIGN-S-004` | `CONFIRMED` | manifest anchor 与 corpus 当前标题不一致，真实 checker 报 `ANCHOR_NOT_UNIQUE:0` | 只修 literal anchor | 刷新 anchor 后重跑 manifest review check |

## 3. Author-found low-drift defects

以下不是 reviewer verdict 的扩写，而是作者在重开 owning design 时发现的同类确定性错误：

- `PlatformAuthenticationService` 在 class list 重复；
- `HeadCompany` 在 organization domain class list 重复；
- login/OTP/logout 不能仅因使用 POST 就机械套用“business write receipt”；契约 catalog 必须逐
  operation 冻结 idempotency policy，GET 禁止 header，安全 nonce/OTP/session command 使用
  purpose-specific replay policy。

三项均不改变 Journey、104 operation 分母、owner 或授权边界。

## 4. Authorization boundary

本 intake 与后续修订仍是 `REVIEW_TARGET=DESIGN`。`R5_IMPLEMENTATION_AUTHORIZED=false`；
不得创建正式 OpenAPI、应用/数据库/Flyway/测试源码，不运行 DEV、remote middleware、
seed/reset 或业务动态验证。
