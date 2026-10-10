# TER remote-control DESIGN Round 1 作者 intake

REVIEW_CYCLE_ID=TER_REMOTE_CONTROL_DESIGN_2026-10-10；REVIEW_TARGET=DESIGN；REVIEW_ROUND=1；REVIEW_ROUND_LIMIT=2。
作者会话为续接会话，不是独立reviewer。R1原始verdict NO-GO 0M/2S/4N对应其记录的六份旧SHA，保留不变。本文件只记录主agent亲自读回source和文档的处置；本修订字节INDEPENDENT_VERDICT=NONE，等待fresh Round 2。不继承其他专项结果。

## 逐条辩证处置
| finding | 归类/关闭 | 源头反例、最小替代与当前修正 | 当前准确位置 |
| --- | --- | --- | --- |
| S-01 | CONFIRMED / CLOSED（文档） | Blueprint GET与corpus G-05A不附写cap；原projectReadSession可复用。3运营POST保持live grant，GET纯read scope/creator/terminal归属，无token；GET过期只导出事实不写库/audit。拒绝新增read capability、授权fallback或过期扫描器 | doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:78、:93；doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:75 |
| S-02 | CONFIRMED / CLOSED（设计声明） | AdminDetailActionMenu.triggerTestId要求真实Button；原terminal Drawer没有该菜单。新增detailActions和start分开，14逐动作/观察行、4列roster、exact L2/runner/资源文件。旧reset/pager仅同值迁入常量；拒绝通用selector兜底、第二runner或新台账。focused/binding/fresh实施准入仍OPEN | doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:62；doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:118、:139；doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md:84 |
| N-01 | CONFIRMED / CLOSED | 正式R13唯一wire名KEEPALIVE_ACK，六文档统一；无新ACK别名/兼容codec | doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:94；doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:175 |
| N-02 | CONFIRMED / CLOSED | 当前ReportPersistence真实锚点为detail而非readCurrent；附件导航改detail，不为错误source导航新增method | doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:13 |
| N-03 | CONFIRMED / CLOSED | 正式要求page/detail顶层connectionStatus/observedAt/evaluatedAt；删除nested state别名。schema→generated→UI/fixture同形，无第二DTO副本 | doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md:95 |
| N-04 | CONFIRMED / CLOSED（fixture设计） | seed原role-project/role-group并不等于有权/无权；明确仅role-project加PROJECTcap，role-group不加。具名account/assignment/project和两独立acceptance角色；GROUP_SEED_CAPABILITIES不含新PROJECTcap，不加新DEV账号或终端 | doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md:165～:168 |

## 同根扫描与防再犯
- S-01：六HTTP逐一核对，其余5项已检查；三个运营写、一个运营读、两个terminal credential command分开。同步Journey corpus/IA/UI owner/design机制和传递矩阵/计划/附件；GET读行为无旁路write。
- S-02：§3a五case、§4a十四行全部核对，剩余13行已逐行检查真实动作或observation语义；所有新UI控件键均有唯一常量和节点，old rule菜单不误借；精确控制面列表分create/update/retain。owner fixture现有最终STORE scope不能直接复用作PROJECT，写明只抽公共登录段而保留TDC原STORE行为。
- N-01：六消息其余5个已检查；未知type不当兼容名；方向、body与真实sender不另定义第七消息。
- N-02：附件已列source锚点逐行读回，剩余10项已核对其source/拟建属性，第三方私有track桥仍OPEN，不说现成。
- N-03：page item/detail/schema消费共4处声明已核对，不新造online权威。
- N-04：4角色行全部核对，剩余3行已检查；seed归属/expectedCounts/fixture/执行operator在详设与计划一致。
通用失败模式是把业务意图当成已有授权/节点/生成字段。最小防再犯落点为本文件同根review checklist与原模板九列，不新增机器框架，不修改规范/项目记忆。

## 补充的作者完整性读回
补R01～20 owner/V映射和UI mutation隐藏事实来源；main path使用5设备run交叉覆盖而非8组合，符合需求V执行面允许设计定义分配，未跑App×shape明确NOT_COVERED。没有扩大产品或进行运行。L2 isolated只证明合法UI/HTTP，actual ACTIVE/input在DEV/device，禁止fakeRoom冒绿。profile来源纠正为预算入口inline定义，非不存在profiles目录。

## 当前六份SHA
- `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md`：`45629570d53cf1d3a243db993f64ff731d388c3c4f4633f105bfe8483eb8a923`
- `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md`：`87fdf43bf7e8ec6833e9938bdf022808f23345ae8942e128b5236fc7b357115c`
- `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md`：`b1555e6fcfdc6c26fb5249861f3019d279f39ec0421efed8349e7bf9d5211ac8`
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md`：`2667675c89f8ef76afa46e6228a8df27ff767aaef7d002e5f71913a8d4006de4`
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md`：`8cb4484c8f6747bcd1e92da317c07076302b90349020e32ace3ac0ddff2fd4fa`
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md`：`7a87e8db88993c289cdd92ac77094bf7a2708ea6b21b801ae9dc860b063111d9`

## 证据与授权边界
亲验仅文档/生产source/官方导航的静态读回。没有实施、依赖解析、生成、编译、测试、verify、DEV、Web、设备、L2、seed/reset或cleanup运行。T01～04、阶段C最终出口OPEN；UI UNSET；所有新能力NOT_RUN。静态处置不授予实施、不提前给动态或fresh verdict。
