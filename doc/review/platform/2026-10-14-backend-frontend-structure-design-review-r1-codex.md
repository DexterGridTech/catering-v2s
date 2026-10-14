# 前后台结构优化 · 独立 DESIGN R1 原报告存档

以下为fresh子agent `/root/structure_design_blind_r1` 已独立形成报告的归档；主agent转录，不改写原verdict。逐项内容保留原判据、源码位置、反例和阅读限制，原输入字节不等于后续修订字节。

REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-14-backend-frontend-structure-design-review-inputs-r1-codex.md
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/5/2
L1_ENGINEERING=S01–S05
L2_USER_VISIBLE=N01、N02；优化后的真实用户行为 NOT_RUN
L3_UNVERIFIED=菜单准入/导航；更新列表与详情的迟到响应、分页和刷新；Drawer dirty/关闭；远控start/restart/end、焦点与资源关闭；扩展字段对象提交及持久化
SAME_ROOT_SCAN=见逐项扫描记录
DESIGN_GAPS=无须在规范内新立判据；具体接线缺口见S01–S05/N01–N02
EVIDENCE_TIER=只读静态；生成/编译/测试/H/L2/DEV/seed/reset/cleanup均NOT_RUN
IMPLEMENTATION_AUTHORITY=false
blindReviewDeclaration=先证伪被审设计并形成本报告；未读本cycle作者self-review/intake/dispositions或需求历史review/intake
authorMaterialReadAfterIndependentVerdict=false

## 1 · 原输入 SHA

| 输入 | SHA-256 |
|---|---|
| implementation-design | 2eb4cc5c2131f81539b72d53e276cffd8854908dcc4ec632b81c4c8dca32cf98 |
| implementation-plan | 31066ecc691000a12b46ef678d91ff045ad1d081198ea123e9bfd6d320d232d1 |
| source-and-verification-appendix | 67b7233dbc9ffbe8c002a90117bdde9a5550752d9ae5e7e4e9d5c517c93c76df |
| 正式需求 | 378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47 |

三份被审文件在doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-*-codex.md。审查开始与收束亲算相同。

## 2 · 阅读范围与独立性

顺序：独立输入表→仓内cs-review/cs-memory-recall→入口/kernel/确定性路由→被审全文与需求→模板/规范/既有交互→owning source与直接测试接缝→同根扫描→verdict。

实际执行两route：design/backend/backend/backend/architecture/task-start；design/admin-ui/operations-admin/frontend-platform/architecture/task-start。全部kernel及命中memory逐批打开；G02/03/04/05/05A/05B/08/09/10/11/12/CIPG01已读。领域规范、四模板、治理/日志/浏览器L2已打开。生产接缝核TDS/双目标生成、asset两流与stage、catalog纯闭包/ItemRow、十Drawer/edge/seed、registry/六资源/remote/foundation、三suite/准入/bootstrap/Java/TDS/wire/builder/report。

**不声明READ_ALL。** 大型source/test按接缝读取，PlatformAssetServiceTest.java和CatalogCategoryOwnerIntegrationTest.java全文阅读未完整闭合；组织/合同/销售菜单及部分historical sourceRefs只读适用章节，未完成全部适用原文全文。报告足以提出阻断，**不构成全部最小输入关闭的全包GO资格**。主agent不得保存成READ_ALL。工具有截断与两处未匹配/不存在路径，关键finding源已重读。无写入/运行，不读.runtime。

## 3 · 方案合理性

目标是减少隐藏名单、重复规则、跨feature内部泄漏及分散资源身份。owner纯提取/foundation/窄入口/canonical派生成立；全面facade/Bean/registry或泛型加载器成本不匹配。更小方案是补明确事实与既有控制面接线，不重画页面、不扩大设备媒体矩阵。

## 4 · Findings（原编号与分级）

### S01 · DetailAssembler输入遗漏sourceScopeRef — CONFIRMED

详设§8.3:155明确ItemFacts不带sourceScopeRef，但迁sourceFact。源码CatalogItemService.java#sourceFact:4473–4477、itemDetail:4708–4709、ItemRow:5824–5834；同根CatalogWorkbenchReadService.java#sourceFact:1354–1358（均CBS/modules/catalog/src/main/java/com/catering/v2s/catalog/application）。相同sections、null/非null来源必须分别SELF_MANAGED/COPIED，不能从hydrate恢复。影响：来源丢失或临场加IO/回调。最小修正：ItemFacts带该已读字段或owner预计算来源，写定一项，保留AUTO_SYNC/TEMPORARY优先级，不新查询；V06加成对反例。Item/Workbench两路径及temporary/source-denied/detail已扫描；其他字段已对照未发现同类遗漏。无需Dexter产品裁决。

### S02 · L2控制面漏admission policy — CONFIRMED

附件§5:129–133、计划CP06:78/82漏policy。当前browser-l2-runtime.mjs:199–206缺strategy拒绝；store-terminal-l2-admission.mjs:6–17固定policy/case源；l2-suite-admission.mjs:113–132/144–148加载验证；现contracts/policy/store-terminal-l2-admission.json先例。反例：其他source齐但policy缺失L2_ADMISSION_POLICY_MISSING，借其他suite亦身份不匹配。影响实施者临场加文件/改准入。最小新增admin-ui-l2-admission.json，复用createL2SuiteAdmissionStrategy，写政策身份/六case/设计与review/UI目录/全集，并写定适配器住址，不造框架。三个suite其余2已核。无需Dexter产品裁决。

### S03 · 有效工件与builder受管身份未接通 — CONFIRMED

附件:113/135–139、计划:80“本run builder”不闭合。scripts/build/terminal-update-artifact.mjs#readManifest:309–316/main:914–925只认.runtime/terminal-automation/<runId>/run-manifest.json、kind=terminal-automation-run-manifest、execution.phase=update。现terminal-automation.mjs/runner/update.test.ts有update.artifacts。L2 manifest传builder必拒；held期间另开run违反同时间一个运行；借历史与设计冲突。影响规则/报告fixture没可执行工件源。最小优先现update.artifacts在L2 readiness前完成，交接本次批准产物身份/摘要/文件集，各自资源精确清理。不造builder/runner；若扩父run接口须列精确改点/红例。六case中规则/报告消费工件，remote消费绑定，余3无工件不强加工件义务。无需Dexter产品裁决。

### S04 · L2前未强制真实H — CONFIRMED

计划:21先L2后fullH、CP04“适用时获授权”，附件:96。verification-governance:66–80 API未通过不进L2；V12/V13对象SET/CLEAR/omission/重放须HTTP持久化。最终fullH放最后正确，但不能是L2后第一份API证明。反例F通过真实CLEAR错误先在L2发现。最小：受影响对象及必要asset/catalog具名focused H business/cleanup PASS先于对应L2，fullH仍晚于全部最终改动；不同run不共DB/session/asset。六CP已扫；仅frontend项不机械加H。无需Dexter产品裁决。

### S05 · seed dry-run缩为仅reset — CONFIRMED

计划:86、详设10b.5–6。implementation-task-template:215–226首次L2/reset/seed四项含当前完整seed dry-run。反例改seed helper无reset直接L2跳过完整试运行。最小恢复原准入，dry-run与真实reset/seed授权分开；无明确例外不能自缩。计划§9/设计10b/13/CP06已扫，本轮无越权。无需Dexter产品裁决。

### N01 · 控件分母仍有漏项 — PARTIALLY_CONFIRMED

附件:108右Tab，119–123无Tab切换行；现terminalUpdateTestIds.rulesTabLabel/reportsTabLabel及原UI anchor可复用。Date双input/DATE clear/编辑入口/候选仍组内描述。最小现表补逐action、具名符号与真实节点，不另roster；六组已扫，不能说全节点错误。无需Dexter产品裁决。

### N02 · launcher与workspace会话身份owner未写定 — UNVERIFIED_REQUIRES_EVIDENCE

详设:166 launcher currentSession；现workspace:220 currentStart，729–736 restart setState。未写旧state删除/受控/唯一owner。不能武断未来一定重复；最小选定唯一owner并写restart/end传递，A→restart B→A迟到关闭F证明不end B，不加第二框架。无需Dexter产品裁决。

## 5 · 其余攻击与模板

CP前向export已写实际能力先建，不成立。catalog IO除S01均留原owner；seed七数组/十Drawer/十四operation截面一致，平台/服务点对象为反例，fixture不是兼容理由。六资源guard与保留PlatformRead/SalesMenu有源依据。DOM focused基础已存在，不能列新增基建finding。ONLINE/REPORT禁止SQL伪造合理，但wire heartbeat/REMOTE_COMMAND须写定，SESSION_READY不证明全case在线。媒体/TER不在范围。Java/antd新接口仍OPEN，不宣称运行。

| 模板 | 逐节coverage |
|---|---|
| implementation | 0/1/2/3有；3a表有N01、全集S02/S03；4/5/6/7有；8有S01；9/9a/9b有；10 N/A；10b S05；11/11a映射有、H顺序S04；12/13/13b/13c有；14不能自称全闭 |
| Journey | 1–7既有复用；S03属验证前提，不新产品Journey |
| IA | 1/2.1/2.2/2.1.1/3/4已有锚点；5还须回读；6 NOT_RUN |
| UI | 1/1.1/1.2/1.3/2/3既有来源；4 roster N01；5/6/7/8原规则；9高保真N/A；10原批准是输入、优化后UI NOT_RUN |

无新产品操作，复用合理；不能用“全复用”豁免精确验证输入或重复建立同义工件。

## 6 · 证据/后续

没有生成/编译/测试/verify/运行或资源清理，business/cleanup NOT_RUN。主agent应个人核源intake/修确认项，补阅读缺口，按同cycle R2定向审查，不授权实施。
