# 前后台结构优化设计 · R2 独立输入

REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED（由独立reviewer在其报告自行形成，作者不代写）

## 当前任务/授权

Dexter授权依据规范和当前需求写详设/计划，fresh对抗审查至无阻断后交另一个Claude。当前只设计文档；无实施/修改源测试规范依赖/生成/构建测试verify/环境数据设备L2/runtime/Git授权。本reviewer只读，可读取命令/hash/query，不写文件，不读.runtime。主agent只在独立verdict后保存报告及辩证intake。

## 最小输入与实际阅读

1. 仓根AGENTS.md/CLAUDE.md/PLATFORM-BLUEPRINT.md/doc/platform/README.md/scripts/README.md；本仓cs-review/cs-memory-recall skill，不用全局同名。
2. project-memory/index.md全部kernel、deterministic-context-only；design/backend/backend/backend/architecture/task-start和design/admin-ui/operations-admin/frontend-platform/architecture/task-start两route，全部命中原文及适用sourceRefs。规范长文件可分块读，不把搜索摘要当原文。原业务corpus适用条款必须读。
3. 原始授权是本表用户指派；需求全文doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md，讨论分析稿所引原话。亲算需求与三工件SHA。
4. 被审全文：同目录2026-10-14-backend-frontend-key-code-structure-{implementation-design,implementation-plan,source-and-verification-appendix}-codex.md。
5. implementation-design/journey/ia/ui-interaction四模板全文；implementation-task-template、backend/frontend coding standards、foundation-charter、review-standard、third-party标准的全部本批适用条款；独立review治理、verification-governance、日志和browser-L2正本。
6. 详设§0点名既有交互。完整重开本批适用用户任务/页面/权限/查询/Drawer/刷新/控件/失败条款；不要求无关历史工件全文。给出确切阅读章节，不泛称全读。
7. 附件§1–6逐责任source链和直接测试。最小production输入是对应实际符号及可达纯闭包/调用者、十四扩展提交/mapper/seed、注册/page六资源/remote身份、foundation、generator两个output、L2准入/工件导出/启动/清理。大型source不要只读命中行；必须追调用与输入事实。PlatformAssetServiceTest.java及CatalogCategoryOwnerIntegrationTest.java的相关测试及fixture/被调用helper必须读取完整闭包；按R1已披露缺口补读，不虚称整个巨型类READ_ALL。其他无关实现不作本review最小分母。
8. 当前源码特别关注sourceScopeRef、不同排序tie、createL2SuiteAdmissionStrategy policy支持字段；现update.artifacts/exportSeedArtifacts/cleanupManagedRunArtifacts与buildTerminalUpdateSeedPlan；受控currentStart与restart；实际wire模式/heartbeat；RangePicker/input/现CursorPagination/dirtyGuardTestIds。这些是被审方案，不是作者证明。

先形成独立findings/verdict，然后才读R1报告/author intake（如已存在），核原S01–05/N01–02，不继承分类。R1报告doc/review/platform/2026-10-14-backend-frontend-structure-design-review-r1-codex.md；author intake同目录...-design-review-intake-codex.md。R1不具备全最小阅读闭合的GO资格，不用其结论代替R2阅读。

## 交付

原输入SHA、read order/实际完整范围/不足；独立GO/GO_WITH_UNVERIFIED_UI/NO-GO和M/S/N；每finding精确设计/源码路径行号、事实/推论、反例、影响、最小可验收修正、Dexter裁决；SAME_ROOT_SCAN；四模板逐节coverage；方案合理性/更小替代；L1/L2/L3、DESIGN_GAPS、EVIDENCE_TIER；逐项旧finding关闭表在独立结论后形成。未运行不是阻断，但UI未证不能裸GO。第二轮硬停止，不增R3；不替作者宣布实现或动态PASS。
