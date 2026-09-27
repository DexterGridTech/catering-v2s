---
title: v2s 独立子 agent 对抗性 review 治理修订
status: DEXTER_ACCEPTED
createdAt: 2026-07-25
acceptedAt: 2026-07-25
acceptedBy: Dexter
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
effectiveFrom: NEXT_REVIEW_CYCLE
implementationAuthority: false
reviewStatus: CLAUDE_GO_0M_0S_1N_RESOLVED
---

# 独立子 agent 对抗性 review 治理修订

## 1. 裁决

恢复并强化 all-v2 `AGENTS.md` 的独立性强度：从**下一个**
`REVIEW_CYCLE_ID + REVIEW_TARGET + 批准范围` 起，所有
`REVIEW_TARGET=DESIGN` 与 `REVIEW_TARGET=IMPLEMENTATION` 的对抗性 review 必须由
独立子 agent 执行。作者会话不得自审自判、不得代写对抗审查 verdict；作者只负责：

1. 在送审前提供问题、Dexter 意图、替代方案、范围和证据索引；
2. 在子 agent 独立 verdict 产生后，逐 finding 重开 owning source/代码/evidence，完成
   辩证 intake、最小修复比较与处置；
3. 需要下一轮时提交修订后的对象给另一个 fresh 子 agent 定向盲审。

轮次上限按 Dexter 2026-09-14 裁定区分：

- `REVIEW_TARGET=DESIGN`（agent 自己的需求、详设或实施计划）最多两轮。第二轮仍是 hard stop，但
  `ROUND_FINAL_DECISION=SELF_DECIDED` 只能由第二轮独立子 agent 写入其 own review artifact；它表示该
  reviewer 对本 cycle 的最终综合，不表示作者会话自判。
- 实施完成后对整批做的 `REVIEW_TARGET=IMPLEMENTATION` 对抗审查不设轮次上限，但必须依据详设文档：
  每条 finding 写明依据的详设位置与对应实现位置；详设中找不到判据的问题按
  `doc/platform/review-standard.md` §2 记入 `DESIGN_GAPS`、交回设计侧，不得在审查里就地立标准。
  `NO-GO` 时修复后交新的 fresh 子 agent 复审，不由作者 `SELF_DECIDED` 收口。
- 实施过程中「实施结果 ↔ 需求、详设」的对账（CP 阶段级独立对账、整体三维对账、交付前逐代码与详设对账）
  不设轮次上限，`OPEN` 修复后交 fresh 子 agent 复查，直到 `MATCHED`。
- Codex 与 Claude 之间经 Dexter 中转的 review 不设轮次上限，做几轮由 Dexter 决定。

不设上限的审查只把 `REVIEW_ROUND=N` 当序号，不写 `REVIEW_ROUND_LIMIT` 或 `ROUND_FINAL_DECISION`。
Claude review 继续是该流程之后的独立外部 review，不得替代独立子 agent 审查。

## 2. 独立、盲审与最小输入

每一轮 reviewer 必须是 fresh 上下文的 `INDEPENDENT_SUBAGENT`，不继承作者会话状态、
不读取作者的自审结论或 finding 处置，直到先独立写出 findings 与 verdict。之后才可
对照作者材料写差异说明。prompt 必须以“找出设计/实现为什么不成立”为立场，不得使用
确认式措辞。

prompt 中必须逐项显式列出并要求回读以下最小输入；缺任一适用项，该轮无效：

1. `AGENTS.md`、`CLAUDE.md` 全文；
2. Dexter 本轮明确指派与授权原文、批准范围（随 reviewer prompt 提供）；
3. 全部 project-memory kernel；按六维路由执行 recall，并逐条打开全部命中原文与其
   applicable source refs；
4. confirmed business corpus 的命中条目及其“不得推导”边界；没有业务词干命中时，
   明记 `NO_CORPUS_ENTRY_MATCHED` 与检索词；
5. 被审对象全文及所有适用的原始需求、已接受设计与交互输入；列出
   `doc/decisions/` 全目录标题并打开所有相关 decision 全文；
6. 适用的设计模板、领域规范、`doc/platform/review-standard.md` 与
   `doc/decisions/2026-07-24-v2s-verification-governance.md`。

每轮必须创建 reviewer input checklist，逐项记录输入路径或命令、是否已读及 corpus 检索结论。
review artifact 必须包含：

```text
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=<repository-relative-path>
blindReviewDeclaration=<先独立 verdict、后对照作者材料>
authorMaterialReadAfterIndependentVerdict=true
```

## 3. 生效与 supersede

本修订 supersede：

- `doc/decisions/2026-07-25-v2s-design-governance-batch-1.md` §3 中“作者 Codex 对抗自审
  产生 verdict”的部分；
- `.agents/skills/cs-spec-to-plan/SKILL.md`、`.agents/skills/cs-writing-plans/SKILL.md`
  中作者 self-review 作为对抗 verdict 的表述；
- disposition ledger L66 的“作者两轮自审”注记。

它不追溯重开任何已经收口的 cycle，包括 R3 及已启动的 R4 design cycle；也不授权实现、
数据操作、动态运行或任何新业务范围。

## 4. 2026-07-30 逐点实施与复核纪律

Dexter 要求避免以过度泛化准备挤占实际实施。作者对每个实际变更点只准备该点可执行、
可复核所需的最小输入；写入前必须重开对应 IA/原始业务条目、六维路由命中的全部
project-memory 及 owning source、适用详设/设计约束和当前可复用源码。该点完成 focused
proof 后，作者必须用同一输入逐项回读实现与证据，确认用户任务、交互、owner、约束和
复用判断没有漂移。

独立 reviewer 的 prompt 与 checklist 必须包含 CP 内每个变更点的前读和后读留痕；
reviewer 在 CP 全部工作、focused proof 与必要修复结束后，以这些原文逐点核验整个 CP，
而不是用总览阅读、静态通过或后续 L2 推定一致。逐点留痕是 CP 阶段审查的输入，不意味着
每个变更点都要单独等待 reviewer 或形成新的三维对账关卡。缺失任一变更点的双读、或以
不相干的泛化准备取代它，必须作为 finding。该纪律只强化实施和 review 质量，不授权新范围，
也不要求 prompt hook 查询或注入上下文。

## 5. 2026-09-15 Dexter 补充裁决：重复失败后的主 agent 接管

正常路径仍必须优先由 fresh、独立的子 agent 完成对抗式 review，以及任务要求的独立实施对账。
若同一 review 任务的 fresh reviewer 因工具错误、进程/运行失败、明确越界，或经诊断确认的卡死，
连续至少三次均未能产出可用 verdict 或对账结论，则由主 agent 接管完成同一审查范围，结果对当前任务
与 fresh reviewer 结果同样有效。这里的“失败”不包括 reviewer 已产出的 `NO-GO`、`OPEN` 或 findings；
它们是有效审查结果，必须进入正常的辩证 intake、修复与复查流程。

每次失败尝试必须保留真实 status、实际已读范围、first failure、last known good phase、broken boundary
和诊断原因；不得用盲等、增加 timeout、重复轮询、吞错或把失败改名为成功来满足阈值。主 agent 接管前
必须在交接记录中列出失败尝试的 reviewer/session 标识与证据，并重新读取该任务的完整最小输入和 owning
source。接管结果必须标记
`REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE`，不得冒充 `INDEPENDENT_SUBAGENT`，
不得伪造 fresh checklist 或独立 verdict；不能核实的输入仍保持 `OPEN`。

该例外不重置 review cycle、不取消 Claude/Dexter 的外部 review、不扩大授权范围，也不把主 agent 接管
变成默认审查人。若 Dexter 后续要求 fresh reviewer，必须按新的指令继续派发，并将本次回退记录作为已知
上下文，而不是隐藏子 agent 失败。
