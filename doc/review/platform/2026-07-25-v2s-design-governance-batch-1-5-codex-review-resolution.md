---
title: v2s 设计法治 Batch 1.5 Claude finding 辩证处置
status: SELF_DECIDED_GO_FOR_DEXTER_ACCEPTANCE
reviewTarget: doc/decisions/2026-07-25-v2s-design-governance-batch-1-5.md
createdAt: 2026-07-25
---

# 设计法治 Batch 1.5 Claude finding 辩证处置

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=DESIGN-GOVERNANCE-BATCH-1-5
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

## 用户任务

未来业务用户需要其交互设计能由 Dexter 看图、由审阅者回溯到可靠出处；不能因本机路径、
遗漏的 demo 台账或表面自测绿而让治理工件失去可复核性。

## Dexter 立场

Dexter 只授权本批设计法治收口，目标是质量与效率兼得：修复真实缺口，但不把 Heritage、
模板或 review checklist 发展成业务语义 checker，更不借此进入 R3–R6 inventory、J02 或
任何实现面。

## 替代方案

1. 保留绝对路径和泛化夹具：改动最少，但跨机复核和夹具错误分支不可靠，取舍后不选。
2. 为 demo 台账另建 checker：表面更强，但需要理解“按需”产品判断，属于伪语义门，不选。
3. 只做三条 Claude finding 的文字修补：更短，但会留下本轮重开模板发现的重复看图结论，
   容易造成未来用户/审阅者误填；不选。
4. 采用语义 vendor 来源、补一条人审证据、修正内存夹具路径并删除重复条目：推荐。

## 方案合理性

问题与方案一一对应，复杂度限制在 manifest 的三个字符串、一个已有 checklist 文本、已有
checker 的 self-test clone 与模板六行删除。收益是跨机可读、按需 hifi 不漏审、红夹具能
证明命名的错误边界；代价远小于以后把假绿或重复结论当作治理事实的返工。没有新依赖、
新运行时、业务逻辑或语义 gate。

## UI 与交互

NOT_APPLICABLE：理由是本轮只处置治理模板和静态校验 finding，不交付用户页面、Journey
操作或 demo。删除重复的看图结论只消除模板歧义，未来实际 UI 仍必须依据批准 Journey
完成任务合理性与两级看图。

## 审查意见复核

使用 cs-failure-recall 重开 HERITAGE_REGISTRY_DENOMINATOR_MISMATCH 的首败与 checker
源码；last-known-good 是 production registry 校验 PASS，破损边界仅是 in-memory self-test
先让 registry 偏离 required inventory，导致目标断言不可达。

- N-1=CONFIRMED：重开 Claude review、vendor manifest 和本仓路径纪律后，绝对 sourcePath
  确实不可跨机复核。最小修复是改为 codex-plugin-cache 语义出处并保留完整 SHA-256；
  反例是把本机 cache 再复制到项目，成本更高且会制造第二个 vendor 真相。
- N-2=CONFIRMED：重开 JOURNEY_INTERACTION_REVIEW 与 UI 模板后，B.4/B.5、低保真和
  SKILL_USED 已被列出，但按需 hifi ledger 与 DEXTER_HIFI_REVIEW 未列。最小修复只追加
  人审短句；反例是建 checker，它无法判断“何时按需”，不适用。
- N-3=CONFIRMED：重开 self-test 证实 writeBack/runtime/build 与 hash-drift 夹具均先触发
  denominator mismatch。最小修复是 required inventory 与 registry 同步变异，再以
  verifyFiles=true 到达 source hash 分支；新红码分别为 WRITE_BACK_FORBIDDEN、
  RUNTIME_FALLBACK_FORBIDDEN、BUILD_FALLBACK_FORBIDDEN 与 SOURCE_HASH_MISMATCH。
  反例是只改 EXPECTED code，会把假绿改成假红。
- C-1=CONFIRMED：重开 UI 模板发现 `9 后残留旧版四行通用看图结论；它与已加入的两级
  结论重复，可能让审阅者忽略 hifi。最小修复是删除旧四行；不改变页面或产品选择。

没有新的 DEXTER_DECISION：四项都不涉及业务语义、Journey 取舍或授权边界。

## 闭环核验

- heritage registry 正常校验 PASS；self-test 的每个 fixture 都命中其具体失败码；
- vendor 三份冻结原文 SHA-256 仍与 manifest 相符，manifest 不再含本机绝对路径；
- R3 standards coverage PASS（150），B.4/B.5、两级看图与 adapter 均仍是人审项；
- UI 模板仅保留一组两级 Dexter 看图结论；未创建 mockup/app/contract/DB/DEV/runtime 产物；
- 本 cycle 已达第二轮硬上限，不再发起第三个 Codex 审查。

## 结论

VERDICT=GO
M=0
S=0
N=0
ROUND_FINAL_DECISION=SELF_DECIDED
DEXTER_ACCEPTANCE_REQUIRED=true
NEXT=等待 Dexter 接受第一批与 Batch 1.5；接受前不得启动第二批或恢复 J02。
