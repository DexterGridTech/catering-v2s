---
title: 治理 harness 收缩复审（Claude）
reviewTarget: PROCESS
scope: 治理 harness 收缩 current bytes、退役判据、保留档门与红变异
verdict: GO
findings: M=0 / S=0 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅覆盖治理 harness 收缩与静态验证；不覆盖 P6-3 业务实现、DEV、seed/reset、受管 L2 或 Roadmap 状态变更
createdAt: 2026-07-31
---

# 治理 harness 收缩复审

## 0. 结论

**GO**，`M=0 / S=0 / N=3`。**是净删除，未削弱任何真实缺陷检出来源，未新增等价治理层。**

## 1. 净删除已实测（对照我上轮的基线数字）

| 工具 | 收缩前 | 当前 | 变化 |
| --- | --- | --- | --- |
| `tools/compliance-control/cli.mjs` | 234 133 | **154 932** | **−79 201（−34%）** |
| `tools/implementation-design-granularity/cli.mjs` | 59 834 | **45 682** | **−14 152（−24%）** |
| `tools/capability-invariants/cli.mjs` | 68 946 | 68 946 | **0（保留档未动）** |
| `tools/verify-gates/cli.mjs` | 65 552 | 65 926 | +374（见 `N2`） |
| `scripts/generate/edge-codegen.mjs` | 97 328 | 97 328 | **0（保留档未动）** |
| **合计** | **525 793** | **432 814** | **−92 979（−17.7%）** |

**两个保留档工具字节完全未变**——这是"没有顺手动到真门"的最直接证据。

## 2. 七项核验

**① 退役判据** —— `CONFIRMED`。
`project-memory/operations/verification-governance.md:22`：
`CONTROL_RETIREMENT_AFTER_FIVE_PACKAGES` —— "机器门、分母或记录要求若在**最近五个 package** 中
**一次都没有变红**，必须在下一个 package 显式处置为人工 checklist、最小形态或删除"。
并已进入同文件 `:11` 的 `assertions` 列表。措辞与建议一致。

**② prewrite baseline / correction audit / 逐点记录已出阻断路径** —— `CONFIRMED`。
`prewriteBaseline`、`correctionAudit`、`processCorrectionAudit`、`pointwise`（含大写）
在整个 `tools/` 下**零命中**。
`implementation-source-reread-discipline.md:17` 已降级为
"Pointwise reread remains a **recommended human review habit**" —— 建议而非阻断。

**③ package-exit 只保留 changedPaths** —— `CONFIRMED`。
`compliance-control/cli.mjs:696` 的退出校验现为
`schemaVersion / packageId / status / **changedPaths** / controls` 五项；
`:700` 仅对 `changedPaths` 做唯一性校验。
`actualChangedPaths` 与 `incrementalChecks` **已不出现在退出条件中**。

**④ 六类分母 / afterSha256 / exact-set 不再是当前退出条件** —— `CONFIRMED`。
`rm1RequiredDenominators`（`:256`）**仅有声明、无任何使用点**（见 `N1`）。
`afterSha256` 仍出现于 `:865/:876/:880`（active-package recovery receipt）、
`:1489-1490`（diff 计算）、`:1892-1940`（historical baseline recovery），
**均为恢复/诊断路径，不是 package exit 的退出条件**。

**⑤ 五个保留档门与红变异** —— `CONFIRMED`，全部 PASS：

```
capability-invariants   CAPABILITY_INVARIANTS=PASS
edge-codegen            R5_EDGE_CODEGEN_CHECK=PASS
frontend-architecture   R5_FRONTEND_ARCHITECTURE=PASS
security-boundaries     R5_SECURITY_BOUNDARIES=PASS
openapi-contracts       R5_OPENAPI_CONTRACTS=PASS
```

**红条目数未减少**（验收判据第三条）：
`capability-invariants` self-test **20** 条红全 PASS；
`edge-codegen` 红清单 **25** 条；`frontend-architecture` self-test 红条目 **21** 条。
与收缩前我实测的数量一致或更多。

**⑥ 未误删或削弱真实语义门** —— `CONFIRMED`。
两个保留档工具字节零变化；五门全 PASS；红条目未减少；
`verify-gates` 中未出现任何新的等价治理规则族（`R5_*` 规则名去重 84 条，
命中的 `retirement` 相关项为既有的 `R5_DATABASE_RLS_RETIREMENT_MISSING` 与 `R4_RETIREMENT`）。

**⑦ 无 business/L2 越级表述** —— `CONFIRMED`。
`2026-07-31-v2s-governance-harness-trim-problem-family.json` 与
`rm1p6-u11-joint-remote-l2-delivery-manifest.json` 中
`business=PASS` / `L2=PASS` 式表述**零命中**。

**问题族诊断准确**：`RM1-GOVERNANCE-HARNESS-COST-YIELD-20260731`，
`rootCauseClass = CONTROL_ACCUMULATION_WITHOUT_RETIREMENT_CRITERION`，
`genericProblem` 直书"收据与 prewrite 记录类控制在**未证明拦截过缺陷**的情况下累积，
消耗的工作量与工件体量超过了真正发现缺陷的语义门与 focused proof"。
其 prevention 路由到 `PROJECT_MEMORY` 在此处**是恰当的**——
这是一条"关于规则的规则"，其执行依据（有没有红过）本就有记录，不需要再建机器门。

## 3. N（一般问题，不阻塞）

**N1 ｜`rm1RequiredDenominators` 成为孤儿常量**

`tools/compliance-control/cli.mjs:256-262` 仍声明六类分母数组，但**全文无任何使用点**
（`grep rm1RequiredDenominators` 只返回声明行）。
功能上已失效（这正是 ④ 通过的原因），但净删除应连声明一并删除，
否则下一个读到它的人会误以为六类分母仍然生效。

**N2 ｜`verify-gates/cli.mjs` 增加 374 字节**

保留档理应字节不变（`capability-invariants` 与 `edge-codegen` 都做到了）。
我未在其中发现任何新的等价治理规则族，规则名去重 84 条、无新增家族，
故不判为新增治理层；但请用一句话说明这 374 字节的内容，
以满足"没有新增等价治理层"的可核验性。

**N3 ｜`security-boundaries` 的 `OPERATIONS` 由 149 降为 147**

我上一次测得 149 是在 U04（admin-catalog truth 迁移）**之前**，
其间已知至少 `replaceOperationsOrganizationHeadCompanyBrandAuthorizations` 被退役。
因此 −2 大概率是契约演进而非本次收缩误删，门本身仍 PASS。
建议一句话确认该差值的来源，避免把契约收缩误记进 harness trim 的账。

## 4. 处置

- `N1`–`N3` 均在既有批准边界内，无需 Dexter 裁决。
- **不得回退**：退役判据、`tools/` 的 −93 K 净删除、两个保留档工具的零变化、
  五门 PASS 与 20/25/21 的红条目数。
- **本复审不覆盖**：P6-3 业务实现、DEV、seed/reset、受管 L2、Roadmap 状态变更。
  `active-package.json` 当前为 `RM1P6-JOINT-REMOTE-L2-U11`，其联合 L2 的业务与 cleanup 结论
  不在本次范围内，本 GO 不构成对它的任何结论。
