# 前后台结构优化 · 独立 DESIGN R2 报告归档

原报告由fresh只读子agent /root/structure_design_blind_r2形成；主agent归档，不改原verdict、SHA、证据限制。以下记录原报告全部finding、关闭表、模板与阅读范围；不把后续修订算在本轮。

REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
ACTION_1_VARIANT=1-B
INPUT_CHECKLIST=doc/review/platform/2026-10-14-backend-frontend-structure-design-review-inputs-r2-codex.md
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=BLOCKED_BY_S01;OTHER_REVIEWED_DESIGN_BOUNDARIES_STATICALLY_SUPPORTED
L2_USER_VISIBLE=NOT_RUN
L3_UNVERIFIED=COMPILE,F,H,L2,UI,SDK_ROOM,ACTUAL_RESOURCE_CLEANUP
DESIGN_GAPS=S01_FIXTURE_STATE_AND_ROOM_ORACLE_MISMATCH
SAME_ROOT_SCAN=COMPLETED_WITHIN_DECLARED_BATCH
TEMPLATE_COVERAGE=SECTION_RECONCILIATION_COMPLETED;EXECUTABLE_ORACLE_HAS_S01
EVIDENCE_TIER=STATIC_CURRENT_SOURCE_ONLY
IMPLEMENTATION_AUTHORITY=false

## 1 · 独立性/字节

v2s-rooted fresh，只读，无文件/Git/.runtime或测试/生成/编译/构建/verify/环境/设备动作。先读输入/需求/三工件及相关规范/source，独立证伪形成S01和初步NO-GO后才读R1/intake。**部分适用交互/sourceRefs/source闭包在初步verdict与R1/intake后补读，不宣称全部最小输入均先于intake完成。** 后补阅读没有改变反例，主agent核实消息不作独立证据。补读末期亲算四SHA仍同首次。

| 输入 | SHA-256 |
|---|---|
| 正式需求 | 378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47 |
| 详设 | 00651d29bd13f23597612c9c0fea9fc607dba482279cf864de6c75b4da217113 |
| 计划 | 32b11d3ad0dd6fcef9c404019f00f6d96954ff3963639c1870c2c0dc56f225d6 |
| 附件 | fc2a8fb2b78d5b27477d4a3d6ad150dee2342f6157501bf98265465c3ff6d74c |

## 2 · S01 CONFIRMED · receive-only STARTING fixture不能产生真实Room oracle

位置：附件157同段定义wire仅接收start/stop、不执行/不返回假actor/ACTIVE，仍要求LiveKit可达和真实Room连接/关闭；计划79把它列准入；详设76/215/233本来只承诺L2 STARTING/拒绝/结束/焦点和focused mock Room。

源码：CBS/modules/terminal-control/src/main/java/com/catering/v2s/terminalcontrol/application/TerminalRemoteControlOwnerService.java:80–138 start验grant/binding/在线事实，insert STARTING并投命令，无description；156–172 controllerGrant在description为空时NOT_READY；176–220真实terminal credential register才写description；373–378 readback返回现description。OPS/src/features/remote-control/ui/RemoteControlWorkspace.tsx:538–633先等description再grant再Room；744–762 STARTING仍能close/end/deadline结束。

反例：真实wire ready使在线→CBS start返回空description→receive-only不register→grant拒、Workspace不建Room→用户能真实end但没有Room disconnect事实。影响：case无法达oracle，诱使实施者假description、注册actor/媒体并扩范围。最小修正：L2仅在线资格/start拒绝/STARTING/end-close/同session ENDED/手动再发/焦点，删真实Room oracle和新增LiveKit前提；Room A→B→late A、精确end/listener/keepalive/track/失败反馈留focused；保留TDS/heartbeat/identity/首败/父run cleanup。未创建Room不能冒称媒体释放。此缩减已满足需求V11与本批设计，不改变用户操作；若坚持真实Room才需Dexter裁定扩fixture/注册链。severity最终归Dexter。

## 3 · 方案合理性/同根

目标是明确能力事实/行为/边界/资源住址，不是按长度拆类、搬TER actor或全迁DTO。现Protocol canonical比新registry小；asset合流保留wrapper与stage；catalog纯值留owner IO/公开构造/事务/promotion，优于Bean/容器；icon registration取消隐藏成员有真实收益；五窄出口不全仓barrel；十Drawer十四variant对象与typed owner list分开；四hook六资源与launcher单session边界合理；现L2 suite/policy/producer/TDS复用合理但未实现。除S01外未发现有源依据额外M/S。

六case同根已扫描：remoteControl.launch-and-end命中；rules/read-and-status、reports/history由真实工件/HTTP owner，不依赖Room；store/contract delta是request/readback/Drawer；menu registration是授权入口。**其余5个case已核对。** focused Room有不同前提，不升级L2；最小解是状态与oracle一致，不增加框架。

## 4 · R1关闭表（独立结论后）

| 原项 | R2处置 | 当前输入位置/边界 |
|---|---|---|
| S01 sourceScopeRef | 设计关闭 | 详设155、计划39；ItemRow5824–5852/sourceFact及list同根、V06成对反例；实现/F/H未运行 |
| S02 admission | 设计关闭 | 附件149 suite/kind/五case源/六case/标记/review/UI目录；现strategy113–175支持数组；未来未实施 |
| S03 builder身份 | 设计关闭 | 附件161–165原update.artifacts/export；builder309–317/914–925，runner502–638/seed-plan真实已读；清理待实现 |
| S04 H先L2 | 设计关闭 | 详设215、计划21/41/60/86–101；focused H先L2、fullH最后符合§8与R-READ07 |
| S05 dry-run | 设计关闭 | 详设211/计划86/97/附件163首次L2前，和真实reset权限分开 |
| N01 roster | 说明补齐，动态未证 | 附件119–143实际Tab/input/分页/dirty接缝已核；DOM/F NOT_RUN |
| N02 会话owner | 设计关闭，行为未证 | 详设166/计划69删Workspace镜像，原source已读，late A的F NOT_RUN |

## 5 · 四模板槽位

四模板全文已读，槽位不代表实现PASS。

| 模板 | 逐节结论 |
|---|---|
| implementation | 0需求/授权/来源；1目标三方案；2六CP；3固定行与第三方解析缺口；3a六case/控制面有S01；4失败/FORBID/RECALL；5 operation/集合；6事务rollback；7声明传递消费；8逐R；9 source/retain；9a同步组；9b符号；10 DB N/A；10b1–4七seed/测试，5–6 dry-run权限；11四要素S01，11a逐V；12依赖；13日志双review，13b CP/6b，13c逐代码，14限制均有 |
| Journey | 1/2/3原工件元数据/任务/前提；4/5边界corpus；6/6.1无新UI/媒体、菜单需F/L2；7无新产品裁定 |
| IA | 1原引用；2.1可见保持；2.2范围刷新集合迟到、2.1.1容器保持；3 foundation/dirty；4错误；5交叉S01；6未来行为未证 |
| UI | 1原screen/face；字段/依赖/mutation与十Drawer十四variant；搜索/候选保持；testId现表OPEN；2交互原路径；3 Heritage、4原线框；5 loading/dirty/CAS/ENDED；6六case来自任务；7 owner/权限；8退役台账不准入；9高保真N/A；10原批准不替未来真实UI |

## 6 · 实际阅读范围

全文：R2输入、需求、三工件、后读R1/intake、四模板、仓skill/入口、全部kernel、两route命中memory原文。backend/frontend规范、charter/review/第三方/治理/日志/browser-L2适用正文分块重开。

原交互：IA04 REGION/PROJECT/ORG183–248、BUSINESS327–390、STORE474–519、CONTRACT580–634及搜索/表单689–785；IA03 ORG/CONTRACT296–411及搜索682–698；更新Journey全文、IA/用户UI规则/报告/创建/详情及最新修订；remote Journey/IA全文、UI1–178；Menu任务/入口/候选/失败焦点及9/7修订；Catalog Journey全文、IA状态/编辑刷新及交互查看/制作/单位/库存引用矩阵。无关SKU编辑不扩义务。

R1测试缺口已补：PlatformAssetServiceTest1–323和1424–1727所有相关MemoryObjects/BlockingMemoryObjects/SHA/PNG/tempfile helper；CatalogCategoryOwnerIntegrationTest相关productiontag/unit、derivedSKU、BOM/stale receipt/promotion/snapshot/inbound/dictionary/preparation/matrix/DBdigest、所有所调用variant/sku/composite/unit/tag/promotion/context/navigation/RecordingJdbc/Flyway helper；CatalogCommandContextFixture全文。**未声称巨型类全文READ_ALL，无关测试不增分母。**

生产闭包：Protocol/Codec/test/JsonMapper/topic分类；双目标generator；asset wrapper/stage；catalog纯校验/详情/ItemRow/构造/promotion；十Drawer十四command/mapper/七seed/字段渲染；registry/Page六资源/Workspace/foundation；admission/bootstrap/Java/DEV TDS固定profile/wire/builder/export/cleanup/seed-plan。picker发行源码确认components.input/id/data接缝；没运行DOM/Spring，不把作者官方访问声明当本轮运行证据。

N/A有理由：历史性能SQL预算、邀请状态机、退役台账、无关模块整文件、Heritage全部source、TER原生/media/设备矩阵不消费本批修改；未来全链仍须自己的TEST_CHAIN_PREFLIGHT。

## 7 · 原报告收束与保留

L1多数边界有静态源支持但S01阻断；L2原任务静态对齐，优化后行为未运行；L3全部F/H/L2/compile/cleanup未证，不另计N。修订后也不能改写这组冻结字节NO-GO。

原reviewer另建议“作者可据处置按第二轮SELF_DECIDED收口，不能召集R3”。这是其治理建议，不是产品finding；主agent对该建议的独立处置另在intake记录，不更改其原报告。该建议不授权实现或动态。
