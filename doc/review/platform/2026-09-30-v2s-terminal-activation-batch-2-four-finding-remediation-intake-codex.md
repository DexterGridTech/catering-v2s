# 批次二四项静态复评 · 主 agent finding intake 与两项残余修正

日期：2026-09-30。本文记录 Dexter 授权的两项残余修正及逐条 owning-source intake；不重开已关闭的 DESIGN cycle，不构成第三轮设计评审或新的设计 GO 门。原独立静态复评及其历史证据保留在 `2026-09-30-v2s-terminal-activation-batch-2-four-finding-static-recheck-codex.md`。

## 1. 处置摘要

| finding | intake 分类 | 证据与反例 | 最小处置及当前结论 | Dexter 裁决 |
|---|---|---|---|---|
| S-1：reset-only 被误免完整 seed dry-run | `CONFIRMED` | 原评审 §3 的模板/需求引文与当前 owning sources 一致：`doc/platform/implementation-task-template.md:212-217` 把完整 seed 当前字节试运行列在 reset 前；`doc/decisions/templates/implementation-design-template.md:280-281` 明确 dry-run 未通过不得 reset。原稿对“仅 reset、不 seed”的分支存在安全反例。 | 已核实 D §4 CP-06、§10b.5、§10b.6 与 P §3、§4、§8 的当前文本均要求：实际动作是 reset-only、seed-only 或组合时，先取得当前字节完整 `r5-full` dry-run PASS；发生 reset 时 dry-run 必须在 reset 之前。无 reset/seed 的 backend-acceptance 与 DEV 仍独立；§3a 无真实 L2 分母时为 N/A；CP 对账、6b、资源身份/预算、日志与 cleanup 条件保留。该修正只恢复既有安全准入，不豁免或添加产品规则。 | 不需要 |
| N-1：CP-06 与批次级验收/交付收口的归属残留 | `CONFIRMED` | D §2 明定 CP-06 只实现场景、runner 与 focused proof；P §3 的 CP-06 退出条款把阶段 `MATCHED` 作为退出条件，整批 6b 在退出后、整体验收前单独完成。残留只在 D §13c 与 P 自查表中，故不构成实现/动态步骤回流的真实依赖环。 | 已核实 D §13c 与 P §11 自查项 265-267 均标为“CP-06 退出后的批次级整体验收与交付收口”。13c、最终 `REVIEW_TARGET=IMPLEMENTATION` 与静态 handoff 保留为批次交付条件，但不进入 CP-06 退出条件。 | 不需要 |

## 2. 同根回读与一致性

- 对照原始需求 D-34、实现任务模板及详设模板：真实 reset 前完整 seed dry-run 是现行准入；豁免空 L2 分母不蕴含豁免 reset 安全门。
- 回读 D §4 CP-06、§10b.5-6、§13c 与 P §3、§4、§8：阶段次序为各 CP 完成并 `MATCHED` → 单独整批 6b `MATCHED` → 整体验收；reset/seed 的 dry-run 只对具体包含该动作的运行要求，且 reset 前完成。
- 授权字段已在 D/P 中同步引用 Dexter 2026-09-30 当前会话的批次二实现、适用动态验证及最终非生产 reset→DEV start→完整 `r5-full` seed 授权；不扩展到需求/Journey 产品语义、批次三、UAT 或生产部署。
- 历史 DESIGN verdict 与原 review 记录仍是当时字节的静态证据；本文只确认当前文档条件，不把未来 generator、动态验收、cleanup、reset 或 seed 标成 PASS。

## 3. 执行边界

本 intake 关闭上述两项文档修正的静态核对，不替代六个 CP 的阶段级对账、整批 6b、动态验收或最终独立 `REVIEW_TARGET=IMPLEMENTATION`。依当前授权继续批次二 CP-01～CP-06；所有代码与文档由主 agent 写入，fresh reviewer 只读。
