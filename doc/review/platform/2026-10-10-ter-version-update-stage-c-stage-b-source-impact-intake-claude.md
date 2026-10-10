# 阶段 C：当前阶段 B 源码影响处置

## 1. 范围与状态

2026-10-10；AUTHOR_DISPOSITION_ONLY；INDEPENDENT_VERDICT=NONE。

Dexter 授权本轮静态审查阶段 B，并据其已实现内容调整 C 详设/计划。只修改 C 的详设、计划、源码/API附件，写本记录与 B 静态评审。未改 B 工件、需求、规范、记忆、代码或依赖；未读取 .runtime/运行证据；未执行生成、编译、测试、verify、DEV、Web、设备、reset/seed、L2、UAT或部署。

C 历史外部及内部 verdict 继续只绑定各自输入 SHA；本轮不是新 DESIGN round，不声称修订字节独立 GO。B 当前源码存在不等于 B 已验收。C 全部新增实现/运行/cleanup 仍 NOT_RUN，A/B相关出口仍待获授权的交付审查；Dexter 已确认的 IA 产品方向不因技术 source-impact 退回 UNSET。

## 2. 逐项辩证处置

| 输入/核验 | 分类与本次处置 | 当前落点 |
| --- | --- | --- |
| C 旧截面称规则 createdAt 未贯通 | CONFIRMED：API RuleSnapshotItem、service terminalSnapshot、edge wire、generated 实际已有规则自身时间。删除虚构的待补接口，不用工件时间替代 | 详设 §0.1、计划 §1、附件 §2 |
| C 旧截面称未找到 CBS report POST/表 | CONFIRMED：Controller submit→ReportOwnerService record→ReportPersistence 与 history migration 已存在；taskId 经 createProtocolUuid。将“能力不存在”改为实际行为缺口 | 同上；关联 B source review S-4～S-8 |
| 报告状态扩展假设要先建 policy_states Flyway | CONFIRMED：现有 actual/recent 为 JSONB object，无 state/reason 枚举 SQL CHECK；null-task observation 的 recent object 合法。默认零 SQL，保留实际最终形状变化才据实评审，删具名假设迁移 | 详设 §8.8/§10、计划 §1、附件 §4.1 |
| taskId/sequence“稳定”可能误读为每任务 sequence 永不变 | CONFIRMED：taskId固定，业务阶段变化分配绑定内递增 sequence，同正文重送保持 sequence/reportId。同 binding context 变更不能重置 counter，报告不搬到 feature | 详设 §8.8/计划 §1与CP-01/附件 §4.1 |
| C bootId 行号仍指旧 source | CONFIRMED：以 executeNextArtifact、reconcile FULL→HOT、action updated、accept next task 与 release 当前符号/行号替换。只更新导航，既定执行 boot 策略不变 | 详设 §8.2、计划 CP-03、附件 §4.1 |
| B 当前 accept 与 C request 的关系 | CONFIRMED：B selectionContext 目前为 selectedSpace/contextIdentity/ruleRef；C requestTerminalUpdateCommand 是新增差量，委托同执行核；原规则链搬走后删除旧规则接受路径，不长期双入口 | 计划 CP-01；详设 §8.0/§9已保留分包边界 |
| 首次实际观察/报告分类/当前 binding/counter/候选 await 复核未闭合 | CONFIRMED：写成 B 必要修复依赖，不让 project-basic 另造报告、序号或执行核。快照有限重读随 B 最终规则链一起搬移 | 详设 §0.1/§8.8，计划 §1/CP-01，B评审 S-4～S-9/N-1 |
| 是否改变 C Journey/IA/UI、拓扑/device分母 | REJECTED_WITH_EVIDENCE：这些 B source修复不改变用户任务/可见动作或获批四个设备run；三份保持原字节 | Journey/IA/UI 未修改 |

精确当前导航：

- 详设：### 0.1:L22; | B 规则时间:L30; | B 报告:L31; ### 8.0:L165; | executeNextArtifact：:L221; ### 8.8:L296; ## 10.:L334。
- 计划：3. 按详设 §0.1:L17; 原规则 HTTP/topic:L41; 删除 selected=null:L59。
- 附件：B 当前已存在:L33; ## 4.1:L83。

## 3. 保持的职责与最小方案

store-basic 的具体门店与经营规则成功并 flush，才广播自己已有的 storeBasicInformationLoadedCommand；store actor 与 project-basic actor 收到同一个 command 后各自启动合同/服务点、组织→规则下游，不让合同等待项目，不新建调度器。失败门店零下游首查；晚装通过已成功 store 重发同 command，不重复首查、不递归。

PROJECT/REGION/COMMERCIAL_GROUP、organizationPath与规则HTTP/topic/持久数据全部搬到 project-basic；两assembly只绑定公开selector。project-basic提出业务候选并发 terminal-update公开local command；base owner做最终 actual/当前资格比较、固定、执行、报告，不依赖feature、不保留第二实时规则缓存。固定task.target是已接受执行事实。组织/规则两个entry MAIN→SLAVE；本机update事实isolated，副机零TDS/组织HTTP/topic、零副机报告。

N/M为固定任务策略，现有FixedUpdateTarget只有attempts/T而StoredRule有N/M；C必须在首次固定时保存N/M，不能用当前最新规则补旧任务。无第二boot字段、task账本、report库、统一恢复框架、恶意归档专项或新pair runner。

同根扫描已核：三份C技术文档的过时 B_INTERFACE_OPEN/B_REPORT_OPEN、错误 readSnapshot/mapItem、旧 boot 行号、假设 policy_states migration、sequence固定措辞；剩余Journey/IA/UI逐份读回相关状态/动作，无同根矛盾。保留执行boot、唯一automation、非adapter先Web、console真机双屏/wallpaper mobileVM及每App一组双VM配对（四个设备run）。当前后台实际route `terminal-update/rules` 仅作为B复用事实，不据此改写C用户交互或替B裁定IA。

## 4. 六工件当前 SHA-256

| 仓根路径 | SHA-256 |
| --- | --- |
| `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md` | `a84f9ab406c71c77bf2404f9164a81a575428d1b7ec1c7645688bb0d87b894fd` |
| `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md` | `038dbebbdf1bdcfb0c90733627a04d5f2df13f974c30b1ad93c730f91eaeb5be` |
| `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md` | `f547b1df6a7aeb3ff3d7b74d361fd7465809834595d232bfa1a82cd57bfb49d9` |
| `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md` | `2c3e0cd34bd5d6967637b0651587a09e6c7c8b90d5125f436644db50c4c35609` |
| `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md` | `b4f305bf7a4b3fdd4bb18a49be63ee0a9b3fe8b9390f88b727298cef15644f6f` |
| `doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md` | `c739d214222f054228c57bd0efb56adee8be2c856948db8fcefc40a8e3a35434` |

## 5. 验证边界与后续

本轮仅文件读回与摘要计算，没有调用项目检查脚本或任何运行。C的focused/Web/device/business/cleanup均为计划，不写PASS。B本轮静态结论 NO-GO 0M/13S/4N 是源码finding，非运行/整批交付结论；修复由Codex按现有授权与intake规则核实，不从本记录取得新实施权。已完成且字节未改变的历史对账不要求重做；相关真实变更仍应按适用CP影响范围处置。
