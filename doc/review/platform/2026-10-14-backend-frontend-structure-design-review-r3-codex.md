# 前后台结构优化 · 独立 DESIGN R3 报告归档

原报告为fresh /root/structure_design_blind_r3；主agent转录其结论、全部finding、源证据与阅读边界，不改原SHA或verdict。

REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014
REVIEW_TARGET=DESIGN
REVIEW_ROUND=3
ROUND_AUTHORITY=DEXTER_EXPLICIT_UNTIL_GO
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-14-backend-frontend-structure-design-review-inputs-r3-codex.md
blindReviewDeclaration=先读全部适用输入/源码并独立锁findings/verdict，之后读R1/R2/intake
authorMaterialReadAfterIndependentVerdict=true
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=S01新增scripts Node测试未接既有显式入口
L2_USER_VISIBLE=原交互静态无新增阻断，真实UI NOT_RUN
L3_UNVERIFIED=优化后菜单/分页/异步/Drawer提交dirty/远控焦点及全部F/H/L2/cleanup
SAME_ROOT_SCAN=四新增逐项；五既存missing单列不计新回归
DESIGN_GAPS=无，S01已有正本
TEMPLATE_COVERAGE=四模板适用槽位；同步/验收落点S01
EVIDENCE_TIER=STATIC_ONLY

## 1 · 原输入SHA（亲算两次一致）

| 文件 | SHA |
|---|---|
| 需求 | 378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47 |
| 详设 | e594677956d12c8fd9b4db3a5db6a9d18d7a55a3b71a1c7b90002fb2b8361227 |
| 计划 | 220859274527dcd4b109ebd9c99f7d58750a98610f216bb14869862857ec2035 |
| 附件 | 7b86405936d1b24fd415c20a1ec6c342f78b1187b1110f70411cc97f9ac9aac6 |

## 2 · S01 CONFIRMED · Node新测试缺既有入口同步

设计：附件149 admission test、151 P1/fixture test、155 transport test；计划76–82 CP06漏test-health-entry-runner.mjs。
正本：backend-acceptance-business-scenario-standard:108–110规定新增Node静态测试同时登记；scripts README:299发现/执行集；runner:12–15显式列表、91–101扫描发现.test.mjs比nodeTestFiles，缺项THCL_NODE_TEST_ENTRY_DENOMINATOR_MISMATCH；tools/verify-gates/verify.mjs:371现入口使用runner。

反例：新4文件focused分别通过，现正式入口仍拒执行；文件存在/能单跑不等于原入口消费。源码推导，未动态复现。四新增全集：scripts/test/{admin-ui-l2-admission,admin-ui-l2-p1,admin-ui-l2-fixture,browser-l2-terminal-transport}.test.mjs，四项均漏。最小：CP06/附件处置/原子同步加nodeTestFiles创建同步与原机制red，不新registry/checker/runner，不要求整体verify；无需产品裁决。

纯读取现五missing为scripts/dev/{r5-fixture-contract,r5-livekit-resident,terminal-update-seed-executor,terminal-update-seed-plan}.test.mjs及scripts/test/terminal-remote-control-protocol.test.mjs。不是本批新增回归，不另计finding，不要求全面整改/整体verify，也不能称现入口PASS。

通用模式：测试单跑不等于正式执行入口消费；根因是显式发现/执行接线；范围仅scripts Node，Vitest TS/Java/已登记为反例；复用validateExplicitTestSet/red防再犯。

## 3 · 其他证伪与同根

| 责任 | source核验/结论 |
|---|---|
| wire/Room | owner80–138仅STARTING、158–172 grant拒空description、176–220 register；Workspace547–588取description/grant再Room。附件159缩减准确；其余5case无Room。V11 focused还含A→B→late A及资源释放，未取消义务 |
| ENDED | EndCoordinator34–47先owner后best-effort资源；设计不能冒称媒体释放 |
| catalog | Item4473–4477/Workbench1354–1358来源用sourceScopeRef已传；assembler其他值已读，IO/锁/owner保留 |
| asset | PlatformAssetService201–245/1389–1434实际双流、限值prefix/decode区别；一private helper两wrapper最小 |
| extension | mapper21–41对象SET/CLEAR与legacy不同层；十Drawer十四variant/七seed/fixture同步，typed owner不搬；表单displayOrder与列表tie策略分别保留 |
| feature/Page | 现能力先export，六独立资源不同fence，迁走counter/result，无镜像；PlatformRead/SalesMenu正确反例保留 |
| TDS fixture | r5-dev-runner602–673固定DEV，设计不借DEV/用父隔离DB/principal/identity |
| 工件 | update.test196–247导10文件、runner504–646保留exports、seed-plan75–150源run/路径/摘要验证；明确移交不同时开run |
| 验证 | focused H先对应L2，CP/6b/准入/dry-run/L2/最终fullH/13c顺序；未来均NOT_RUN |

没有因未来文件/运行尚不存在造缺陷，没有建议假description/register/actor/media/新LiveKit门。

## 4 · 四模板coverage

Journey1–7含6.1全部原任务复用，新actor/Journey N/A；IA1/2.1/2.2/2.1.1/3–6原权限/刷新/集合/容器有锚点；UI1/1.1/1.2/2–8/10及字段/搜索矩阵来自原screen，附件动作roster；新线框/高保真等N/A无新增surface；implementation0–3/3a/4–10/10b/11/11a/12/13/13b/13c/14均有，9a/11测试消费/14收口S01遗漏。新owner审计/DB migration N/A，OPEN/BLOCKED与NOT_RUN如实。

## 5 · 阅读/独立性

实际顺序：输入→入口仓skill→两route/kernel/命中原文→需求原话/三工件→四模板/领域规范/适用sourceRefs/corpus/IA/UI→变更责任production/test fixture闭包→同根/四SHA→独立锁NO-GO→才R1/R2/intake。doc/decisions顶层标题已列。route为design/backend/backend/backend/architecture/task-start及design/admin-ui/operations-admin/frontend-platform/architecture/task-start。

适用memory包含corpus/两政策、deterministic-context、HTTP redlines、独立review、owner read-model/lifecycle、六kernel、readability、execution economics、conversation/不可见维度/reverse inference、fixture oracle、能力lookup、collection/ordering/dirty/copy/detail menu/第三方。真实变更责任source和所调用helper已读，不宣称整个CBS/历史tests逐行审计，测试源码不升级PASS。

N/A有理由：邀请恢复历史、历史性能SQL/index/字节码、parked domains、未改平台适配、退役compliance/roadmap、Heritage巨型分母、TER媒体/触摸/设备矩阵不消费本批变更。五现missing单列，不冒称新责任。

## 6 · 合理性/未验证

协议/规则/适配住址清楚，按资源身份持有；纯提取/窄出口/foundation比Bean/facade/loader/registry/第二builder小；有限L2接线需要，不扩产品。无确认产品歧义。只读来源/边界，不运行测试/生成/build/verify/环境/.runtime。DOM/SDK/Spring/F/H/L2/cleanup全NOT_RUN、L3非空，后续无S静态最多GO_WITH_UNVERIFIED_UI。

旧R1五S设计落点已核，R2 Room反例亲验关闭；原verdict不改。本报告只供主agentintake，不授实施/动态。
