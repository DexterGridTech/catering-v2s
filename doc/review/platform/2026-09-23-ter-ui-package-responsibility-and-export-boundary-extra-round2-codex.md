# TER UI 公共导出边界新增授权 DESIGN 对抗审查第 2 轮

REVIEW_CYCLE_ID=TER_UI_PACKAGE_RESPONSIBILITY_DESIGN_20260923_DEXTER_EXTRA_TWO_ROUNDS
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
reviewerAgentId=01a0cc37-48d1-7e30-978f-56762d1ee3c1
reviewerInputChecklist=doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-extra-round2-input-checklist-codex.md
reviewerInputChecklistSha256=96128739342eb5303f2cee4cae3a5d95b1000cb6755b53610ac4e8a81aa4ffa6
blindReviewDeclaration=先独立 verdict 后读取同题作者材料；盲审顺序成立，但 DESIGN Action 1-B 未完成
authorMaterialReadAfterIndependentVerdict=true
INITIAL_REPORTED_VERDICT=GO,M/S/N=0/0/0
EFFECTIVE_VERDICT=INVALID_ACTION_1_B_INCOMPLETE
DESIGN_REVIEW_ADMISSION=NO-GO
EVIDENCE_TIER=STATIC_SOURCE_READING_ONLY

## 用户任务

业务用户要厘清 TER 五包的职责、assembly 与 package public API 的边界；本轮任务是对需求、详设、实施计划独立审查，不是实施。Dexter 仅额外授权两轮设计对抗审查，之后准备给 Claude 的话术。

## Dexter 立场

Dexter 要求在五包逐符号消费者事实和仓外未知边界上明确责任；不能凭仓内零命中删除 public export，也不能把静态设计阅读说成实施/动态验收。当前 `Q5` 与仓外消费者仍 `OPEN`。

## 替代方案

“直接删零命中项”没有仓外证据，不选；“只保留所有入口而不补契约”不能解决职责混淆，不选。当前设计的最小方向是先补 public contract 与可失败判据，之后只对逐项裁定的入口收窄。审查方法上，事后补一张 Action 1-B 表比重新完成一次盲审成本更小，却不能恢复前置动作的独立时序，故不作为有效替代。

## 方案合理性

第二轮 reviewer 的静态内容观察：三份文档的问题定义、方案复杂度与收益匹配；从当前字节复算五包 `6+6+16+20+23=71` 个 root 符号及 `5+2=7` 条 export-map 路径，核对两个 Android 宿主消费和键盘探针/失败 helper 的边界，未提出新的实质 M/S/N finding。但 reviewer 在最后的独立自查中确认：其在 blind verdict **之前**没有按 `doc/platform/review-standard.md` §1 的 DESIGN 动作 1-B 先产出三类事实清单。故初步内容判断不能升级为有效 DESIGN GO。

## UI 与交互

NOT_APPLICABLE_WITH_REASON：理由是本批不新增 UI 或用户操作，不改 MemberForm 探针、双形态 renderer 或失败交互；现有标题差异仍 `OPEN`，不能借本批公共面设计写成已满足。

## 审查意见复核

`CONFIRMED` 方法 finding：Reviewer 自述 verdict 前只读了 implementation-design template 并作结论性判断，没有列“模板要求项 → 三份对象覆盖/缺失”事实表；旧计划冲突、71/7 分母等有核对，但没有先列独立的矛盾清单和数值/形态/枚举出处清单。回源 `doc/platform/review-standard.md` §1-B，三类提取是 DESIGN 先行事实动作，空清单也不能自动当 PASS。反例边界：相关输入和源码确已阅读，且未发现作者材料提前污染；失败在方法顺序，不等于证明设计本身有内容缺陷。更小的事后补表无法让既成 verdict 获得前置证据；两轮上限已到，不能由作者换 reviewer 或改名启动第三轮。

## 闭环核验

审查者完整输入清单见上述 `reviewerInputChecklist`：入口、六个 kernel、适用 routed sourceRefs、三份对象、上游标准、五包源码和双 Android 宿主均有 path/64 位 SHA；不适用的 catalog/Drawer/IA 模板均有理由。盲审 verdict 后才读取 Claude requirements review、作者 intake 和历史失效记录；对照后确认旧 S-1/S-2/S-3/N-1/N-2 在当前文档有落点。其原 `L3_UNVERIFIED=空` 仅针对本批无新增用户可见 UI 事实；`Q5_DEXTER_DECISION=OPEN`、`EXTERNAL_CONSUMERS=OPEN`、实施/动态 `NOT_RUN_BY_AUTHORIZATION` 必须另外明列。此处都是静态设计证据，不构成可执行测试结果。

## 结论

VERDICT=NO_GO
EFFECTIVE_VERDICT=INVALID_ACTION_1_B_INCOMPLETE
CONTENT_FINDINGS_M/S/N=0/0/0_UNCHANGED_AS_OBSERVATION_ONLY
L1_ENGINEERING=INPUT_READ_COMPLETE_BUT_REVIEW_ACTION_INCOMPLETE
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON:本批不增改屏幕和交互
L3_UNVERIFIED=空，仅指新增用户可见 UI 事实；Q5 与仓外消费者仍 OPEN
SAME_ROOT_SCAN=五包 71 root、7 export-map、两个 Android 宿主与键盘/失败 helper 同根静态扫描已做；Action 1-B 事实提取未做
DESIGN_GAPS=Q5 和逐项仓外消费者仍需 Dexter 裁决；MemberForm 既有标题差异及 dismissal 目录纯度继续 OPEN
EVIDENCE_TIER=STATIC_SOURCE_READING_ONLY

`NO_GO` 在这里是**设计审查准入未通过**，不是第二轮 reviewer 发现了三份设计的实质 M/S/N 缺陷。`ROUND_FINAL_DECISION=SELF_DECIDED` 为 reviewer 对本 cycle 的最终有效性更正：`INVALID_ACTION_1_B_INCOMPLETE`。本 cycle 两轮已满，不再发起第三轮；Claude 后续只能做诊断性复核，不能被写作独立子 agent 前置门的替代。没有实施授权，没有任何 public export 收窄授权。
