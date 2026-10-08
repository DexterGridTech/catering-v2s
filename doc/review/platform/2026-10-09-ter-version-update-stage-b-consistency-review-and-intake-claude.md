# TER 更新阶段 B：文档一致性复核与修订处置

日期：2026-10-09。当前任务来源：Dexter 要求检查阶段 B 详设与实施计划的上下文矛盾、实施歧义，并明确“有问题就修改”。

## 1 · 结论与边界

修订前确认 **0M/6S/3N**；本轮确认项均已关闭。修订后文档一致性结论为 **GO_WITH_UNVERIFIED_UI，0M/0S/0N**。这只表示本次已核查的设计/计划矛盾关闭，不表示阶段 B 已实施、运行或取得实施授权。

主会话是设计作者的续接会话，不能冒充 fresh 独立整包 reviewer。两位 fresh 只读子 agent 分别检查合同/owner与计划/执行面，先从需求、规范和六份当前工件形成判断；主 agent 亲验并处置，独占文件写入。修订后的两个子范围差量结论均为 GO、0/0/0；最后发现的 seed 父计数文字冲突也经重新读回确认 CLOSED。这是 Dexter 指派的外部一致性复核辅助，不重开已经关闭的内部 DESIGN cycle，不伪造新轮次。

只读取文档与相关现有源码，并修改下述六份 B 工件及本记录；没有修改需求、规范、记忆、生产源码、测试、依赖或脚本，没有运行生成、编译、测试、verify、DEV、Web、Android、reset/seed、L2、UAT或部署，也没有读取 `.runtime/`。本次没有任何新动态 PASS。

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=本次文档矛盾及实施依赖修订已静态关闭
L2_USER_VISIBLE=空态/标签/查询字段静态一致；看图接受范围仍仅大致IA，实际UI未验证
L3_UNVERIFIED=阶段A最终交接；B依赖/预算及全部新实现、API、后台L2、TER Web/Android、seed与cleanup均NOT_RUN或待实施核验
SAME_ROOT_SCAN=6 CP、12验收场景、12后台L2 case、18 HTTP roster及六份工件的对应条款
DESIGN_GAPS=既有工件审计读取链的定位缺口已补；无新增待产品裁决项
TEMPLATE_COVERAGE=见第4节；不以槽位存在宣称实现或UI通过
EVIDENCE_TIER=STATIC_DOCUMENT_AND_EXISTING_SOURCE_READBACK
IMPLEMENTATION_AUTHORITY=false
```

## 2 · 输入及精确定位

以下路径均从本仓根解析：

- D：`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md`
- P：`doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md`
- A：`doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md`
- J：`doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md`
- IA：`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md`
- UI：`doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md`

判据：正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`，Dexter 最新直接裁决，AGENTS/CLAUDE、项目 kernel 与适用路由原文、review/implementation/TER/frontend/backend 规范及四份设计模板。正式需求较早的双后台报告方案不覆盖 Dexter 后续的“运维只管理包、运营项目页双Tab、报告HTTP及每任务一行”裁决。

生成名单既有机制：`scripts/generate/terminal-client-api.mjs:212`，按 includeOperationIds 选消费者接口。平台审计既有机制：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryController.java:43`，`apps/backend/catering-business-server/modules/audit-read/src/main/java/com/catering/v2s/audit/read/PlatformAuditHistoryTaskReadService.java:46`及`:75`，当前都是封闭分派，不能假设新工件类型已自动支持。

## 3 · 逐项 intake、最小修订与反例

所有条目为**仓内文字事实＋具体误实施推论**；主 agent 均重开两端条款确认，不直接采信 reviewer。下表旧位置用于保留反例，当前位置用于实施；本轮均不需 Dexter 新产品裁决。

| ID | 修订前位置与反例/影响 | 最小可验收修订及当前位置 | 处置 |
| --- | --- | --- | --- |
| S-1 | D:242跨层矩阵仍走TDS当前session、CBS只存最后值，与D:292/298/300的HTTP、任务历史冲突；按矩阵接线会恢复退役报告通道 | D:242统一升级owner pending→TDC typed CBS HTTP→CBS owner/PG→匹配receipt；每任务UPSERT与当前观察分开，TDS不写报告 | CONFIRMED / CLOSED |
| S-2 | D:263允许N/M整数1～86400秒，与D:8/265整分钟规则冲突；59/61秒会被错误接纳 | D:263统一API/持久秒60～86400、60倍数，UI整数分钟1～1440，与P:165及A单位说明一致 | CONFIRMED / CLOSED |
| S-3 | D:434只列snapshot/grant两JSON，与A:218/P:59报告POST生成要求冲突；白名单漏report导致无实际消费者API | D:434列明snapshot、grant、report三JSON；POST不进readTerminalDataCommand，binary排除JSON名单；附件与计划一致 | CONFIRMED / CLOSED |
| S-4 | D:324/UI:184断言空历史意味着终端尚未产生任务；真实任务首次HTTP失败留pending时反例成立。UI:215/265对recent空值也越过已收到事实 | D:324/UI:184显示“还没有收到升级任务报告；终端可能尚未上报”；UI:215/265、IA:126、A:341限定recent空值只反映已收到观察，没有额外字段/接口 | CONFIRMED / CLOSED |
| S-5 | D:180要求CP-04先完成Web→Android，但D:173/P:128要求CP退出后才推进，而该受管运行要等CP-05/06、6b与整体准入；形成循环或越门 | D:180/486明确CP内纯逻辑focused与typed fixture；受管同清单Web→Android仍在全部CP/6b及§15.2准入之后，B动态范围不缩减 | CONFIRMED / CLOSED |
| S-6 | D:389真实原生场景还要求运营Tab/Drawer，P:143同样混称；后台L2先完成且隔离，不能消费后续TER/DEV绑定或安装态 | D:389原生证明止于本run实际boot→HTTP receipt→PG/GET；后台Tab/Drawer由独立update-report-current-detail证明；P:143明确对照同契约、不同运行态 | CONFIRMED / CLOSED |
| N-1 | A:247写ENABLE/DISABLE，D:263及A:433/440写ENABLED/DISABLED；实现DTO会取到不同枚举 | A:247统一目标状态ENABLED/DISABLED，动作启停与状态值区分 | CONFIRMED / CLOSED |
| N-2 | D:108/P:72承诺包平台审计读取，A原仅具体列规则审计；平台现有sealed query/edge switch不会自动支持工件 | A:302/539补既有getPlatformEntityAuditHistory→平台封闭映射/query→owner任务读、类型生成与audit-read依赖；D:380/P:59/72补保存/重放/跨空间读回；不增页面或operation | CONFIRMED / CLOSED |
| N-3 | D:369仍把N/M边界写入正常DEV seed；P:168仍“父count不变”，与D:463/P:109新域及实际asset计数同步冲突 | D:369仅正常N5/M10分钟，边界进acceptance；P:168同步新增域/实际asset父子count，既有终端key不变 | CONFIRMED / CLOSED |

同根回读：6个CP其余5个无同类反向依赖；12场景其余11个没有要求原生driver跨控后台；18项合同逐项对照，binary与JSON不混；12后台L2 case使用本run合法HTTP producer。审计扩展是补足已声明标准三件套，不为包增加用户操作页。报告历史仍每任务一行，不把心跳或每阶段变成新的历史行。

附带对齐：A:195查询表补齐actual APK/JS/runtime三过滤字段；D:27/J:25/IA:25的看图标记限定“大致IA，动态未运行”。未将这些文字补全当成新产品范围。对“UI:424五列可能错误”的初步猜测已拒绝：UI:164确实是门店、终端、组合实际版本、状态、时间五列，不增加重复列。

## 4 · 方案合理性与模板覆盖

本期问题仍是两后台的更新包供给、项目规则管理、规则topic供给和CBS升级报告；B不自动选择/执行规则，不提前实施C的闲时/N/M/副机策略。两内容页和现有标准容器保留。HTTP持久pending、匹配receipt、single-flight、确定性拒绝退出与身份暂停解决普通业务失败，不引入通用恢复中心。私有下载身份复核及合法并发锁保留，极端ZIP专项仍不建设。

较小替代已采用：修改矛盾表格和消费名单；用服务器可知的空态文案，避免新增探测；分清现有两个runner责任，避免跨runner复用状态或重复全量运行；审计复用现有GET/封闭query，不新建审计界面。没有新增依赖、runner、任务账本、机器门或恢复框架。

| 模板 | 本次检查 |
| --- | --- |
| Journey §1–7 | 有；任务、前提、动作、边界、失败、corpus和完成块保持；空值事实与接受范围已同步 |
| IA §1–6 | 有；两内容页、页内交互、控件/权限、错误/上下文及完成块；没有把九交互面写成九新增页面 |
| UI §1–10及补充矩阵 | 有对应正文/表格与附件roster；本次修空态/字典，标准控件与TestId来源保持；不是逐屏运行PASS |
| 详设模板§0–14及3a/9a/10b/11a/13b/13c | 有对应内容；本次关闭跨层矩阵/生成名单/审计定位/seed/执行面内容缺口；文件与调用定位仍须实施时重开 |
| 实施任务模板CP/6b/6c/13c | 有；CP退出不等待后续整体验收；全批6b仍是新检查，A未受影响的既有对账不重复 |

## 5 · 未验证与后续实施边界

- A仍在实施/验收收尾；B §0.1的2026-10-09静态截面只是交接定位，不证明后来修复仍未完成，也不证明最终A已验收。CP-01必须重开最终当前字节及有效FULL ZIP、真实版本/readback、跨启动续接等接口；不能借B准备修A或继承旧verdict。
- B新依赖解析、预算数字、工件解析、SQL/权限/审计、HTTP receipt、PONG/pending、真实版本及UI/seed/cleanup全是未来实施计划，没有本轮运行证明。
- B整体验收顺序保留：全部CP与6b→适用准入→API/backend acceptance→两后台隔离L2→仅明确授权后的DEV reset/start/完整seed→TER Expo Web→同清单Android→逐代码对账/整批实施review。纯逻辑focused在各CP内完成，不反向等待此全链。
- Dexter关于“A修复后无需重跑未受影响全量动态”的裁决不扩展为B免验收；B已有未受影响内容不重复对账，也不能把新增差量排除出CP/6b。
- 没有本轮运行，cleanup为NOT_RUN；没有产品/范围新增授权，B IMPLEMENTATION_AUTHORITY保持false。

## 6 · 本轮最终字节

| 文件 | SHA-256 |
| --- | --- |
| D | 1498daacb92fc1eb7f41796cefd8a77ecec8aa0247dd6465438e7b7c0c9030ee |
| P | fa957b59763f1ad0fa395f6bb9dbe7d8dc8257487c237b204a7b3249fa05a3e8 |
| A | ba0a09d0e752a7ec3c8257eb63d3d3ec6ea8fff71582166b99cabd6a77be9041 |
| J | e71d5bcb4e5694642280fe8b412bafcd18e5fbc1fdf0e7db4160d1dfa596b792 |
| IA | 0bf4820bb0c0c98d9d5e02ebca0fa6a61b5e9b58740c9a4870eb10c653a3aac9 |
| UI | de7e36b26e2a628b3ff445480ec3a9212c7edb8091ae583fe815b8ae2f5e0aa0 |

独立子范围首次结论：contract NO-GO 0/4/2，plan NO-GO 0/3/0（含重复问题，未相加）。修订后差量：contract原六项关闭，追加seed计数注记随后关闭，最终GO 0/0/0；plan GO 0/0/0。主agent去重后确认及修订结果见第3节；旧结论保留为旧字节结论，不由作者修订冒充当时已GO。
