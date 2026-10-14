# 前后台结构优化设计 · R1 独立输入

REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT

Dexter 当前指派：按项目规范与修订需求编写详设/实施计划，对抗审查至无阻断，交另一个Claude；仅设计文档，不实施/运行。fresh审查者只读、不写文件、不运行生成/build/test/verify/环境、不读.runtime、不做Git。主agent在verdict后保存原报告与处置，不代写独立结论。

| 必须输入 | 精确位置 | reviewer记录 |
|---|---|---|
| 双入口 | AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md | 实际阅读后声明 |
| kernel/路由 | project-memory/kernel/*.md、decisions/deterministic-context-only.md；design/backend/backend/backend/architecture/task-start；design/admin-ui/operations-admin/frontend-platform/architecture/task-start | query只导航，所有命中原文/适用sourceRefs重开 |
| 原始任务 | 本表Dexter授权；正式需求§0、分析讨论稿用户原话 | READ |
| 被审对象全文 | doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md、implementation-plan-codex.md、source-and-verification-appendix-codex.md（同前缀目录） | READ_FULL，亲算SHA |
| 正式判据 | doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md | READ_FULL，当前字节不是旧GO |
| 适用模板/规范 | doc/decisions/templates/implementation-design-template.md、journey-decision-template.md、ia-design-template.md、ui-interaction-design-template.md；doc/platform/implementation-task-template.md、backend-coding-standard.md、frontend-coding-standard.md、foundation-charter.md、review-standard.md、third-party-library-usage-standard.md | 按全批检查覆盖/实际适用，不把旧源码正确当新行为PASS |
| 治理/授权 | doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md；六维命中规范sourceRefs | READ |
| 既有交互 | 详设§0精确既有Journey/IA/UI，组织/合同IA04、平台IA03、销售菜单9/7修订 | 重开适用章节，验证没新增交互语义 |
| owning source | 附件§1/2/3全部对应生产调用链与直接测试；两个生成目标、owner/事务/private pure闭包、seed实际array、foundation、当前L2 config/DEV TDS固定profile | 以源码反证作者前提；不信摘要或计划自述 |
| per-change前后双读 | 本次仅文档设计，未实施source/未运行proof | N/A实施proof；设计每项仍必须有可复验source判据 |
| corpus | G02/03/04/05/05A/05B/08/09/10/11/12/CIPG01原文与当前已接受术语 | 路由重开，不从词汇创造业务 |

盲审要求：first try to falsify the reviewed design; form findings and verdict before reading author self-review or dispositions。不得读取本cycle尚未形成的intake，也先不读需求历史review/intake。设计附件是被审对象，不是独立证明。

报告必须：原输入SHA、阅读顺序/独立性声明、用户真实目标/更小方案与成本、逐finding详设/源码精确位置、事实/推论、触发反例、最小修正/Dexter裁决；GO/GO_WITH_UNVERIFIED_UI/NO-GO、M/S/N、L1_ENGINEERING/L2_USER_VISIBLE/L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS、TEMPLATE_COVERAGE四模板逐节、EVIDENCE_TIER。没运行不是代码问题，但L3非空不得裸GO。
