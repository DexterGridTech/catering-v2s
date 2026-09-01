# v2s sales-menu DESIGN review Round 1 · 作者 intake

REVIEW_CYCLE_ID=SALES-MENU-DESIGN-2026-09-01  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
INDEPENDENT_VERDICT=NO-GO  
INDEPENDENT_M_S_N=2/1/0  
INTAKE_KIND=AUTHOR_SOURCE_FIRST_DISPOSITION

本文件在独立 reviewer 完成 verdict 后编写。独立 artifact 由只读 reviewer 产出正文、主 agent 逐字机械转录；其 input checklist SHA 已回填。以下处置均重新打开 owning source，不把 reviewer finding 当新权威。

## F-M-001 · canonical template 路径

- 处置：`CONFIRMED`。
- 亲验证据：`doc/plans/platform/implementation-design-template.md` 不存在；`.agents/skills/cs-review/SKILL.md` 与仓内目录均指向 `doc/decisions/templates/implementation-design-template.md`。
- 最小修复：详设元数据和实施计划 SM-00 显式写 canonical path，并明确不存在的旧路径不得使用；Round 1 checklist 如实保留旧路径 `MISSING`。
- 同根范围：设计、计划、作者对账、两轮review输入和最终Claude handoff；未创建兼容副本，因为那会制造第二模板住址。
- 修复后可证伪条件：任一后续review/实施输入仍把旧路径标为可读或canonical即失败。

## F-M-002 · INTERNAL 渠道 seed 前置事实

- 处置：`CONFIRMED`，并按同根扫描扩大到 reviewer 未完全点明的 DINE_IN instance 缺口。
- 亲验证据：`external-collaboration-business-channel-seed-plan.mjs` 的三条真实channel均为 EXTERNAL TAKEAWAY/GROUP_BUY；INTERNAL DINE_IN 只有template，没有channel instance；INTERNAL TAKEAWAY 连template和channel都没有。
- 最小修复：business-channel owner seed plan新增真实 INTERNAL DINE_IN 与 INTERNAL TAKEAWAY template/channel实例和enabled/disabled分支；保留现有EXTERNAL TAKEAWAY、project和其他order kind作为负例。executor用真实owner HTTP物化/readback；sales-menu seed只解析前置真实refs，不创建channel。
- 拒绝更小替代：复用EXTERNAL TAKEAWAY会混淆外部平台承接；只补TAKEAWAY而仍把DINE_IN template当instance同样无法建立activation；由sales-menu造channel破坏owner主权。
- 修复后可证伪条件：plan里没有两类INTERNAL真实channel、INTERNAL/EXTERNAL未并存、或sales-menu seed出现channel create均失败。

## F-S-001 · complete seed parent位置耦合

- 处置：`CONFIRMED`。
- 亲验证据：`r5-complete-seed-executor.mjs` 在exact stage order校验后仍使用`const catalog = stages[1]`；新顺序中index 1将是external-collaboration-business-channel。
- 最小修复：exact order验证后建立`stageById`，四个owner-specific validator只按稳定id取自己的plan/report；删除所有`stages[n]`业务假设。tests覆盖缺stage、换位、同数量错owner report shape、run mismatch、business/cleanup failure。
- 拒绝更小替代：只更新数组会把catalog validator绑错stage；删除catalog readback会削弱现有正确性。
- 修复后可证伪条件：生产parent仍存在`stages[n]`业务读取，或交换stage/report shape不能使静态test红，即未关闭。

## Round 1 修复分母

已同步修改：

1. `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`；
2. `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`；
3. `doc/review/platform/2026-09-01-v2s-sales-menu-design-author-reconciliation-codex.md`。

没有修改生产代码、contract/generated、Testcontainers、L2、Seed脚本或运行环境。Round 2 需由另一名 fresh 独立 reviewer在不先读本intake的前提下重新审当前详设/计划；独立 verdict 后才可读取本轮finding ledger做定向核验。
