---
title: Claude current-byte recheck：全工程修复程序计划
reviewStatus: PENDING
reviewKind: PROGRAM_REMEDIATION_DESIGN_POST_REMEDIATION
binding: POST_REMEDIATION_V1
implementationFacing: false
implementationAuthority: false
---

# Claude current-byte recheck：全工程修复程序计划

## 背景

Claude 已对程序计划给出 `GO, M=0/S=3/N=2`。两轮独立子 agent DESIGN review 已 hard-stop，Codex 不能以修订后的文件伪造第三轮盲审。本次仅以 `POST_REMEDIATION_V1` 诚实绑定 Claude S/N 的最小作者 intake 与 current bytes，要求 Claude recheck；不改变原 review，不授权实施。

## 评审目标

请核验 S1--S3 与 N1--N2 是否被正确处置，尤其是：S1 不以无法复现的 `320-4=316` 取代一个单位混用；S2 让诊断恢复不等待 D4；S3 的防复发既能阻断未接线真门又不建立伪语义 gate/双真相/超时 verify。并确认 current bytes 没有扩大授权。

## 需阅读文件

- `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-plan-review-claude.md`：本次 S/N 的原始 review 与授权边界。
- `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-plan-post-claude-intake-codex.md`：作者逐项证据化处置及未审声明。
- `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md`：current program plan。
- `doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md`：最终 finding 输入与撤回项。
- `doc/decisions/2026-07-26-v2s-post-remediation-review-binding-governance.md`：POST_REMEDIATION_V1 边界。

## 独立核验重点

1. RP-12 的 477 occurrences / 320 lines 是否成为可复现同单位发现分母；是否把 673 全业务枚举与节点集合正确隔离，并保留“分类后导出服务节点 logic lines”的诚实状态。
2. RP-02a/RP-02b 是否只让 D4 阻塞 validator，而不阻塞 facts、147、projectId、placement/catalog 和 workload 首请求恢复；4-vs-7 assertion 是否被重开而非机械修改。
3. RP-00b 的 registry relation check 是否满足 gate 三问和四类 red mutation，同时不把 package-only/report/closed-phase 强行接入 verify。
4. observability/closed-set/typed failure/R-close 的 prevention destination 是否单一、有限且不越权；RP-12-pre 是否只缩短 fail-closed 风险，不偷跑集合收敛。

## 期望结论

请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 写精确文件与行号、影响面、最小修订以及是否需要 Dexter 裁决。GO 仅代表 current program plan 可供逐单元 implementation-facing 详设引用；它不授权实施。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对全工程修复程序计划进行一次限定的 POST_REMEDIATION_V1 current-byte recheck。

背景：你先前对该计划给出 GO（M=0/S=3/N=2）。两轮独立子 agent DESIGN review 已 hard-stop；Codex 仅按你的 S/N 做最小作者修订，并明确当前字节尚未被独立 subagent 或 Claude 重审，不修改历史 review，也不创建第三轮。
目标：请独立核验 S1--S3/N1--N2 的 current-byte 处置是否正确，特别是 RP-12 的可复现分母、RP-02a/RP-02b 的 D4 解耦、以及 gate registry 的机械边界和防复发落点。

请从 catering-v2s 仓库根阅读：
- `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-plan-review-claude.md`：你的原始 S/N 与授权边界；
- `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-plan-post-claude-intake-codex.md`：逐项作者处置与未审声明；
- `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md`：当前程序计划；
- `doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md`：最终 finding 输入；
- `doc/decisions/2026-07-26-v2s-post-remediation-review-binding-governance.md`：POST_REMEDIATION_V1 边界。

请重点独立核验：477 occurrences / 320 lines 与 673 全业务枚举是否没有混算；RP-02a 是否无需等待 D4 即可恢复 workload；RP-02b 是否才承担 validator；registry relation check 是否只检查机械集合/引用关系且有四类 red mutation；已有 observability 标准、closed-set memory、typed-failure checklist 和 R-close readback 是否没有制造双真相或超时 verify。

烦请给出明确 GO 或 NO-GO。如有问题，请按 M / S / N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品或架构裁决。

授权边界：本次 GO/NO-GO 仅对程序级 current plan 的 POST_REMEDIATION_V1 recheck；它不授权任何 implementation-facing manifest、代码、契约/schema、脚本、DEV、seed/reset、动态运行、Roadmap 变更或 gate 接线。即使 GO，每个单元仍须单独获授权、详设、独立对抗审查和证据闭环。谢谢。
```
