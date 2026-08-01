---
title: R5 合规整改 Roadmap 与详设 Claude recheck request
status: READY_FOR_CLAUDE_RECHECK_AFTER_NO_GO
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
reviewTarget: DESIGN
reviewCycleId: R5-COMPLIANCE-REMEDIATION-DESIGN-20260727
implementationAuthority: false
---

# R5 合规整改 Roadmap 与详设 Claude recheck request

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-granularity-manifest.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-adversarial-review-round-2.json

## 背景

R5 当前实现经 Codex 与 Claude 双审合并为 NO-GO（19M/14S/8N）。本轮没有逐 bug 修复，而是把
W00–W08 建成九个严格串行实施包、W09 作为唯一 whole-scope review，并将“做一点、验一点”
落实为 source-derived hook、测试前全量扫描与 red-first。

Codex 设计对抗审查两轮已 hard stop：round 1 NO_GO（3M/2S/3N）；round 2 最终
NO_GO（1M/0S/2N）。最终 M 的 canonical unit route 与 22/25 package ownership 已做
post-remediation。Claude 首次 recheck 随后给出 `NO-GO(M=1/S=1/N=2)`：唯一 M 为 hook
“引擎会红”但没有“客户端实际触发”的证明，S 为硬编码 15 条回放，N-2 要求厘清
`provider-free-context` 与测试前扫描。当前修订已逐项吸收；Dexter 另明确委托 Codex 全权裁决
D-1～D-7。当前字节仍未被最终独立 reviewer 审过，只送 Claude recheck，不开第三轮。

## 评审目标

请判断这份候选 Roadmap、详设、实施计划是否完整承接合并诊断，是否能在不硬编码分母的前提下
逐文件、逐 package 对账项目记忆与设计要求，并确认 Dexter 委托后的 D-1～D-7 裁决是否被
忠实、无越界地传导。重点不是实现是否完成；本轮只审设计可实施性与治理闭合。

## 需阅读文件

- `doc/decisions/2026-07-27-v2s-r5-compliance-remediation-design-authorization.md`：精确 design-only 授权；
- `doc/decisions/2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md`：Dexter 委托后的 D-1～D-7 裁决；
- `doc/roadmaps/platform/2026-07-27-v2s-r5-compliance-remediation-roadmap.md`：候选 step 与串行拓扑；
- `doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md`：详设与实施计划；
- `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-granularity-manifest.json`：10 单元、150 rule、10×6 package-exit 分母与 post-remediation 声明；
- `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-manifest-chapter-hit-map.md`：Part B/C/D 章节命中；
- `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-adversarial-review-round-1.json`：第一轮独立 findings；
- `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-round-1-intake.md`：第一轮 intake；
- `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-adversarial-review-round-2.json`：第二轮最终 verdict；
- `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-post-remediation-intake.md`：hard-stop 后最小修订披露；
- `doc/review/platform/2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-claude.md`：范围分母。

## 独立核验重点

1. active Roadmap 已同步为 design-only 等待评审，旧 implementation authorization 不再可执行；
2. 10 个 unit 每个都有六维 route 与六类 package-exit denominator；memory occurrence applicability
   必须六维匹配，不能动态 count、手选 predicate；
3. source-to-predicate mapping 是否以 exact manifest resolver、stable SHA ID、set equality、
   source/predicate drift red 真正 fail-closed；
4. 22 surface 与 25 pageDesignKey 是否 exact set equality、全部最终归 U06、CR05 不重复拥有；
5. W00–W08 是否无并行口，前包 exit 真绿才进后包；
6. 106/32/22/25/7、七 schema、150=104 human+46 machine、OpenAPI 50/742/88、远端 runner
   path/hash/host/task/source/receipt/cleanup 是否闭合；
7. CR00 是否用真实 Codex client invocation canary 证明触发，并在不支持事件时以
   `CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED` fail-closed，而不是只直调引擎；
8. `actualChangedPaths` 是否由 package-input baseline 与 exit 独立枚举，且与非空
   `incrementalChecks` exact set equality，能兜底检出 hook 完全未触发；
9. forbidden 回放是否由 source-derived 当前树重扫得到，诊断的 15 只作差异交叉核对；
10. `provider-free-context` 是否前移 CR00，测试 admission 是否明确为 compliance aggregate
    与既有独立静态门两层均绿；
11. D-1～D-7 是否精确传导为 `B/A/A/A/A/B/B`，同时未产生 implementation authority。

已运行：

```text
scripts/check/implementation-design-granularity ... => PASS
REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
scripts/check/standards-coverage --phase R5 => PASS / RULES=150
scripts/check/roadmap-program-registry => PASS
scripts/check/project-memory => PASS
surface ownership 22/22；pageDesignKey ownership 25/25；unit routes 10/10
scripts/check/provider-free-context => FAIL / REASON=skill denominator is not five
```

最后一项是本设计明确前移 CR00 的当前红事实，不以文档改字在 design-only 阶段伪绿。当前绑定：

```text
delegated decision sha256 = 3624fe4f319b21d04ef8b6953eed9f049667ed2c857850bbe520176d8609dd56
design sha256             = 56a6fcaf8e42d80de04693940624f27071fcc2303b18b6826805637c07ed68ab
manifest sha256           = e05265666c82c40398b0c991e285cda6a56183807196ce65e85364df334dea0d
post-remediation intake   = 15c544a7b20203f1f5b1776d55e2ab7b947659d478e29e29e19d7f6765443020
```

## 期望结论

请给明确 `GO` 或 `NO-GO`，并按 `M/S/N` 给精确文件/行号、影响面与最小修复。D-1～D-7 已按
Dexter 委托由 Codex 决定，不再等待产品裁决；仍请核验其传导是否忠实且没有扩大授权。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请即时复核 R5 合规整改候选 Roadmap、implementation-facing 详设与实施计划的 NO-GO 修订。

背景：您首次 recheck 给出 NO-GO（1M/1S/2N）。Codex 已重开 owning source 并完成受限 post-remediation：M-1 增加真实 Codex client invocation canary，不能用 schema/direct script/self-test 代替触发证明；package-input/exit 独立枚举 actualChangedPaths，并要求与非空 incrementalChecks exact set equality，hook 完全不触发时也必红；若 client 不支持 Pre/PostToolUse，CR00 以 CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED 失败。S-1 改为从 accepted source 重扫当前树派生 forbidden 违反集合，原 15 仅交叉核对。N-2 将 provider-free-context 订正前移 CR00，并明确测试 admission 必须同时通过 compliance aggregate 与 catalog 派生的独立静态门。Dexter 已把 D-1～D-7 全权委托 Codex，裁决为 B/A/A/A/A/B/B；未产生实施授权。两轮独立盲审已 hard stop，本次不启动第三轮。
目标：确认您上轮唯一 M、S 与 N-2 已真实关闭，委托裁决传导无越界，设计包可交 Dexter 接受。

请从 catering-v2s 仓根阅读：
- doc/decisions/2026-07-27-v2s-r5-compliance-remediation-design-authorization.md：design-only 授权；
- doc/decisions/2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md：七项委托裁决；
- doc/roadmaps/platform/2026-07-27-v2s-r5-compliance-remediation-roadmap.md：候选 Roadmap；
- doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md：详设与计划；
- doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-granularity-manifest.json：10 单元、10×6 分母、150 rule 与 post-remediation；
- doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-manifest-chapter-hit-map.md：Part B/C/D 命中；
- doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-adversarial-review-round-2.json：最终轮 verdict；
- doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-post-remediation-intake.md：最终轮后最小修订；
- doc/review/platform/2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-claude.md：原范围分母。

请重点独立核验：①真实 client invocation canary 证明的是触发而非引擎，且 unsupported event 必须阻断 CR00；②actualChangedPaths 独立于 hook 自报，并与非空 incrementalChecks exact set equality，空/缺/多/越界均具名红；③forbidden 回放不再硬编码 15；④provider-free-context 前移 CR00，测试前是 compliance aggregate + 独立静态门双层准入；⑤D-1～D-7 精确为 B/A/A/A/A/B/B，106/32/22/25/7 与九包串行拓扑不漂移；⑥当前仍为 design-only，implementation/runtime/seed-reset 全 false。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M/S/N 标注精确文件与行号、影响面、最小修复建议及是否需要 Dexter 产品裁决。

授权边界：本轮只复核 DESIGN。GO 只表示候选 Roadmap、详设、计划及委托裁决传导可交 Dexter 接受；不授权 implementation、业务源码、契约、migration、测试、scripts、构建、DEV、数据库、远端运行或 seed/reset。谢谢。
```
