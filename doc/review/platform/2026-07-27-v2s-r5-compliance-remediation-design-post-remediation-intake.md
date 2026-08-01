---
title: R5 合规整改 DESIGN Round 2 hard-stop post-remediation intake
status: POST_REMEDIATION_AWAITING_CLAUDE_RECHECK
createdAt: 2026-07-27
reviewCycleId: R5-COMPLIANCE-REMEDIATION-DESIGN-20260727
reviewTarget: DESIGN
reviewRound: 2
reviewRoundLimit: 2
implementationAuthority: false
---

# R5 合规整改 DESIGN Round 2 post-remediation intake

## 1. Hard stop

第二轮独立 reviewer 已写
`ROUND_FINAL_DECISION=SELF_DECIDED`、`furtherCodexAdversarialRoundAllowed=false`。
本 cycle 不再开启第三轮。以下修订字节未被第二轮 reviewer 审查，必须由 Claude recheck。

## 2. Findings intake

| finding | intake | 处置 |
| --- | --- | --- |
| R2-M-001 | CONFIRMED | 每个 U00–U09 增合法六维 `complianceRoute`；rule applicability 固定六维 all/intersection 算法与 canonical JSON serialization；22 surface + 25 pageDesignKey 全部最终 ownership 精确归 U06，CR05 只作前置能力；manifest 列出 47 个 row mapping，并要求 set equality/no overlap/no unknown 与 route/surface 红夹具 |
| R2-N-001 | CONFIRMED_RETAIN | 保留 round-1 已闭合的授权、数值、七 schema、partition、remote runner 设计 |
| R2-N-002 | CONFIRMED_CURRENT_RED_SUPERSEDED_BY_CLAUDE_N2 | `provider-free-context` 当前红保持如实；Claude recheck 后确认应前移 CR00，详见 §2.1 |

## 2.1 Claude recheck NO-GO intake

Claude 的
`doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-review-claude.md`
给出 `NO-GO(M=1 / S=1 / N=2)`。逐条重开 owning source 后处置如下：

| finding | intake | 处置 |
| --- | --- | --- |
| Claude M-1 hook 顶层触发无证明 | CONFIRMED | 设计新增真实 Codex client invocation canary；静态 schema/direct script/self-test 均不能代替触发证明。`package-input` 独立 snapshot 与 exit 重扫派生 `actualChangedPaths`，要求与非空 `incrementalChecks` set equality；hook 未触发时包尾必以具名原因红。若 client 不支持 Pre/PostToolUse，CR00 以 `CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED` 失败，不降级。 |
| Claude S-1 硬编码 15 条回放 | CONFIRMED | 改为从 accepted source 派生规则集重扫当前树并逐条命中；诊断 15 条只作交叉核对，差异入 receipt。 |
| Claude N-1 诊断计数 | CONFIRMED_ALREADY_CORRECT_IN_DESIGN | 设计继续使用 26 approved、71 occurrences/69 unique；不改写 Claude 历史诊断字节。 |
| Claude N-2 provider-free 与测试前扫描关系 | CONFIRMED | `provider-free-context` 订正前移 CR00；测试 admission 固定为 source compliance aggregate 后串行执行 catalog 派生的独立静态门，独立门 FAIL 不能被 aggregate PASS 覆盖。 |

Dexter 随后明确把所有待决项委托 Codex 全权裁决。D-1～D-7 与包 ID/名称的结果已写入
`doc/decisions/2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md`。该委托不改变
implementation/runtime/seed-reset 均未授权的边界。

## 3. 自引用 hash 处理

manifest 自身 denominator 行不声明不可能成立的自 SHA，而写
`sourceSha256Binding=CURRENT_MANIFEST_BYTES`；checker 在运行时以实际输入 bytes 计算一次 hash，
将同一值写入 package input/exit receipt。外部 source 与 design 仍使用显式 SHA-256。

## 4. 授权边界

本 post-remediation 只修设计。当前字节只能送 Claude 与 Dexter recheck/接受；不授权任何 implementation、
build、DEV、seed/reset、database 或动态运行。
