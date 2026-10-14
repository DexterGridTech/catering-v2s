# 前后台结构优化 · 最终Node入口设计差量独立输入

REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014
REVIEW_TARGET=DESIGN
REVIEW_ROUND=4
ROUND_AUTHORITY=DEXTER_EXPLICIT_UNTIL_GO
reviewerKind=INDEPENDENT_SUBAGENT
APPROVED_REVIEW_SCOPE=NODE_TEST_ENTRY_DESIGN_DELTA_AND_SAME_ROOT_WITH_COMPLETE_CURRENT_DOCUMENT_READBACK

Dexter最新直接指派是根据规范/需求生成详设计划并“完成对抗式review，直至go，最后…给另一个Claude做review”；仅文档，按此追加到R4，同cycle不重置。R3全包独立读足/先verdict后intake，唯一S是新Node tests登记；此次只改测试入口同步文字，没有源码/业务方案变化。因此不重新把未改的全部production/helper造全量复查分母，外部Claude仍独立整包review。

只读，可读取命令/hash/memory query，不写任何文件，不生成/编译/test/verify/环境/DEV/数据/设备，不读.runtime，不Git。

## 必须在独立verdict之前读足

1. AGENTS/CLAUDE全文，BLUEPRINT/platform README/scripts README适用入口/Node纪律；本仓cs-review/cs-memory-recall。用户授权原文如上。
2. 全部kernel、deterministic-context；review/platform/operations-admin/platform/evidence/review六维route，全部命中原文和适用sourceRefs，具名无关N/A；business corpus有命中读完整条目/禁推，无命中记词与理由。doc/decisions标题与此差量相关原文。
3. 当前正式需求全文doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md，当前三工件全文同目录2026-10-14-backend-frontend-key-code-structure-{implementation-design,implementation-plan,source-and-verification-appendix}-codex.md，亲算4 SHA。核R15–17/V16–18及其他方案未被登记修订改变；不继承作者分类。
4. 四设计模板适用同步/测试/计划槽位原文；review-standard、backend-acceptance-business-scenario-standard§4、scripts README测试健康；implementation-task-template的对账/日志/动态准入、verification-governance、独立治理。其他没有被差量消费的领域机制具名N/A，不另对20modules逐行审。
5. 现scripts/test/test-health-entry-runner.mjs全文、其.test.mjs、tools/verify-gates/verify.mjs调用接缝；新增4个计划路径；既存5个路径由纯文件读源核实，按发现/登记差异判断不能猜名字。四新Node都是此机制适用面，TS/Vitest/Java是反例；读其相关入口/生成/测试源是否另有漏项。检查Node集合red、真实root直接test、只补元数据的边界，不能要求完整verify、seed或LiveKit运行。

先完成这些输入并形成当前独立findings/verdict，再读R3报告/作者intake（同目录2026-10-14-backend-frontend-structure-design-review-r3-codex.md/...-intake-codex.md）；此前R1/R2无需当authority。报告必须精确限定差量范围，不假称从零对未改production再整批审计。

返回完整只读报告：current SHA/实际read范围/顺序，GO/GO_WITH_UNVERIFIED_UI/NO-GO M/S/N，精确详设/计划/附件/规范/source行号、反例/影响/最小修正/Dexter裁定；三文档一致性、same-root、四模板适用coverage、合理性及L1/L2/L3/DESIGN_GAPS/STATIC_ONLY。无阻断但UI未运行故GO_WITH_UNVERIFIED_UI，未来不存在文件或旧批次未测不构成此设计差量finding。结束后不写、不续审。
