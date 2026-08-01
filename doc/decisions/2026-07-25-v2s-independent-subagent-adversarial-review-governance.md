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
`REVIEW_TARGET=DESIGN` 与 `REVIEW_TARGET=IMPLEMENTATION` 的两轮对抗性 review 必须由
独立子 agent 执行。作者会话不得自审自判、不得代写对抗审查 verdict；作者只负责：

1. 在送审前提供问题、Dexter 意图、替代方案、范围和证据索引；
2. 在子 agent 独立 verdict 产生后，逐 finding 重开 owning source/代码/evidence，完成
   辩证 intake、最小修复比较与处置；
3. 需要第二轮时提交修订后的对象给另一个 fresh 子 agent 定向盲审。

两轮上限不变。第二轮仍是 hard stop，但 `ROUND_FINAL_DECISION=SELF_DECIDED` 只能由
第二轮独立子 agent 写入其 own review artifact；它表示该 reviewer 对本 cycle 的最终综合，
不表示作者会话自判。Claude review 继续是该流程之后的独立外部 review，不得替代这两轮。

## 2. 独立、盲审与最小输入

每一轮 reviewer 必须是 fresh 上下文的 `INDEPENDENT_SUBAGENT`，不继承作者会话状态、
不读取作者的自审结论或 finding 处置，直到先独立写出 findings 与 verdict。之后才可
对照作者材料写差异说明。prompt 必须以“找出设计/实现为什么不成立”为立场，不得使用
确认式措辞。

prompt 中必须逐项显式列出并要求回读以下最小输入；缺任一项，该轮无效：

1. `AGENTS.md`、`CLAUDE.md` 全文；
2. Registry 解析出的 current Roadmap `CURRENT_*` 及本任务的 exact authorization；
3. 全部 project-memory kernel；按六维路由执行 recall，并逐条打开全部命中原文与其
   applicable source refs；
4. confirmed business corpus 的命中条目及其“不得推导”边界；没有业务词干命中时，
   明记 `NO_CORPUS_ENTRY_MATCHED` 与检索词；
5. 被审对象全文、全部上游冻结输入（Journey decision、交互工件、granularity manifest），
   以及 `doc/decisions/` 全目录标题列表逐条复核，并打开全部相关 decision 全文；
6. standards matrix 对应 checklist 与 verification-governance decision。

每轮必须创建一个 reviewer input checklist，逐项记录 repository-relative path、
SHA-256、是否已读及 corpus 检索结论。review artifact 必须包含：

```text
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist={path,sha256}
blindReviewDeclaration=<先独立 verdict、后对照作者材料>
authorMaterialReadAfterIndependentVerdict=true
```

## 3. 机械边界与留痕

`scripts/check/implementation-design-granularity` 只做机械校验：当 manifest 声明
`INDEPENDENT_SUBAGENT_V1` policy 时，检查上述四个 review fields 存在、checklist 的
path/hash 字段存在且 checklist 文件存在。它不得读取清单正文来判断是否真的读完，
不得判断 reviewer 是否独立，也不得裁决 findings 的语义；这些由 Claude 与 Dexter
独立核验。

每个未来 implementation-facing manifest 必须声明：

```json
"adversarialReviewPolicy": {
  "version": "INDEPENDENT_SUBAGENT_V1",
  "reviewerKindRequired": "INDEPENDENT_SUBAGENT",
  "blindReviewRequired": true
}
```

旧 manifest/review artifact 没有此声明时保持历史可读，不得通过事后补字段伪造独立性，
也不得因此重开已收口 cycle。

## 4. 生效与 supersede

本修订 supersede：

- `doc/decisions/2026-07-25-v2s-design-governance-batch-1.md` §3 中“作者 Codex 对抗自审
  产生 verdict”的部分；
- `.agents/skills/cs-spec-to-plan/SKILL.md`、`.agents/skills/cs-writing-plans/SKILL.md`
  中作者 self-review 作为对抗 verdict 的表述；
- disposition ledger L66 的“作者两轮自审”注记。

它不追溯重开任何已经收口的 cycle，包括 R3 及已启动的 R4 design cycle；也不授权实现、
数据操作、动态运行或任何新业务范围。

## 5. 2026-07-30 逐点实施与复核纪律

Dexter 要求避免以过度泛化准备挤占实际实施。作者对每个实际变更点只准备该点可执行、
可复核所需的最小输入；写入前必须重开对应 IA/原始业务条目、六维路由命中的全部
project-memory 及 owning source、适用详设/设计约束和当前可复用源码。该点完成 focused
proof 后，作者必须用同一输入逐项回读实现与证据，确认用户任务、交互、owner、约束和
复用判断没有漂移。

独立 reviewer 的 prompt 与 immutable checklist 必须包含每个变更点的前读和后读留痕；
reviewer 必须以这些原文逐点核验，而不是用总览阅读、静态通过或后续 L2 推定一致。
缺失任一变更点的双读、或以不相干的泛化准备取代它，必须作为 finding。该纪律只强化
实施和 review 质量，不授权新范围，也不要求 prompt hook 查询或注入上下文。
