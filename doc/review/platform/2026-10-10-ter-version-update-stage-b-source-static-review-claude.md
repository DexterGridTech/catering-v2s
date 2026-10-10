# TER 版本更新阶段 B：当前源码整批静态评审

## 1. 结论与边界

**NO-GO，M/S/N=0/13/4。** 结论仅针对当前阶段 B 生产代码及直接测试/runner 源码。测试被阅读，不表示执行通过；没有读取运行 evidence，也没有生成、编译、测试、verify、DEV、Web、Android、reset/seed、L2、UAT 或部署。

REVIEW_TARGET=IMPLEMENTATION；REVIEW_DATE=2026-10-10；AUTHOR_SESSION=续接会话。本报告由主 agent 汇总并亲自核验三个只读子范围（CBS、TER/Android、两后台），不是继承历史 GO/MATCHED，不另造内部 DESIGN cycle 或替代正式整批 fresh implementation verdict。阶段 C 文档修订是 Dexter 本轮明确授权的设计同步，未修改 B 文档、需求、规范、源码或依赖。

### 方案合理性

业务目标是“运维上传可用工件并保存，运营按项目创建/启停 FULL/HOT 配对规则，终端固定正确目标并通过已有安装核执行，运营查询真实版本与历次任务结果”。B 本身只提供规则/工件/报告闭环及显式目标接受；自动择新、闲时/提醒和副机独立执行属于 C，不能据此给 B 添加后台任务按钮或调度平台。

当前主干方向成立：复用 asset stage/bind、owner schema/事务、AdvisoryLock、已有审计、生成协议、TDC 认证 HTTP、A 更新核和唯一 automation driver。无需更换框架。问题主要是既有能力接入不完整：owner 授权落点、报告状态/身份闭包，以及前端绕开统一刷新、提交锁和 dirty lifecycle。最小修复应接回这些现成能力，不新增授权/报告/恢复框架。

下述 S 都有源码反例，不以缺少运行证据阻断；N 不作为本轮主要阻断。Severity 为评审建议，产品取舍仍归 Dexter。

## 2. 判据与阅读范围

- 正式需求：`doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`，尤其 R-03～R-11、R-15 及阶段边界；后续 Dexter 裁决优先：HTTP 报告、每任务一行、仅运营报告、分钟参数、常见工件主流程。
- B 详设/计划/附件：`doc/plans/platform/2026-10-07-ter-version-update-stage-b-{implementation-design,implementation-plan,source-and-api-appendix}-claude.md`。
- 用户任务/可见行为：`doc/decisions/2026-10-07-ter-update-supply-and-version-report-{journey,ia,ui-interaction}-claude.md`。
- AGENTS/CLAUDE、Blueprint、platform/scripts README、review/backend/frontend/terminal 规范及本次六维路由命中的 kernel、owner/read-model、CRUD、collection、Drawer、终端架构和官方版本依据原文。
- CBS terminal-update module/edge/Flyway 与直接测试；TER terminal-update/TDC、Android update 与直接测试；两个后台 terminal-update feature；builder、seed/DEV runner、automation supply/update Journey 和相关 tests。运行产物不在阅读范围。

`L2_USER_VISIBLE=NOT_ASSESSED_BY_AUTHORITY`；不评估设备/浏览器运行是否通过。`TEMPLATE_COVERAGE=N/A_WITH_REASON`：本轮不是重评 B 文档模板；文档只作实现行为判据。`DESIGN_GAPS` 见 §6。

## 3. S findings

### S-1 规则 owner 未承接既有运营授权 grant

- **位置/事实**：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/terminalupdate/CreateOperationsProjectTerminalUpdateRuleOperation.java:41–55` 正常 HTTP 已 resolve generated capability 并要求 ALLOW；对应 `ChangeOperationsProjectTerminalUpdateRuleStatusOperation.java:41` 同族。但是 `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/api/TerminalUpdateRuleOwnerApi.java:57、78` 的公开 command 不携 ownerScopeGrant。`application/TerminalUpdateRuleOwnerService.java:68–77、104–114` 未重核，且 receipt 在 project fact 之前直接返回。
- **判据/影响**：B 详设 §6/§7（L118、247、259）、附件 §11.3 要求 owner 在 receipt/CAS 前复核 grant。直接调用公开 owner 或重放旧 command 没有该边界；不声称正常 HTTP 已绕过 app 授权。
- **最小修复**：传入 resolver 已产出的 `OperationsOwnerScopeGrant`；在 owner 的 receipt/write 前核 workspace、当前 PROJECT、requirement/capability/context。复用 `modules/store-terminal/.../application/StoreTerminalOwnerService.java:226、916–931` 先例，覆盖 create/status/replay。platform 工件 session 模式不机械改成运营 grant。
- **性质**：仓内事实及直接调用反例；**Dexter 裁决：不需要**。

### S-2 工件入口没有与声明/实际文件树闭合

- **位置/事实**：`apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateArtifactParser.java:118–145、263` 校验 HOT files/hash/publication，却只要求 entry 为文本。保持所有文件摘要合法，entry 改为不存在路径仍能 parse/save。FULL 在 L164–168 未检查实际 bundleEntry 非 null/非目录便交 getInputStream。
- **判据/影响**：R-03、B §8.1/CP-02 要求普通入口与文件缺失拒绝。不可加载的 HOT 会到终端才失败；FULL 普通漏文件不能保证 typed invalid-package。
- **最小修复**：沿现有 safePath/files/ZIP 条目校验，entry 必须指向唯一已声明且实际存在的普通文件，缺失 typed reject。两种包同族核对。不加 symlink/炸弹/恶意归档专项。
- **性质**：源码支持的普通坏包反例；**Dexter 裁决：不需要**。

### S-3 合法 129 文件包在 grant 阶段被另一个上限拒绝

- **位置/事实**：同 Parser `:33、269` 与 B 详设 L143 允许最多 8192 文件；`apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/api/TerminalUpdateArtifactOwnerApi.java:55–56` 却限制 manifest.files≤128。`application/TerminalUpdateArtifactOwnerService.java:224–228、256–265` grant 构造会触发该 constructor。
- **影响**：129 个小文件且满足现有字节预算的正常资源包可保存，却不能取得下载 grant，抛 IllegalArgumentException。FULL/HOT 共用此路径。
- **最小修复**：统一已批准的有限技术预算，保留完整清单，拒绝截断或默默缩小准入。直接源码测试覆盖 129 文件 parse/save/grant；不新增协议分片。
- **性质**：仓内事实；**Dexter 裁决：恢复既定预算不需要；若要改变预算则需要**。

### S-4 报告 owner 缺少当前绑定最终复核

- **位置/事实**：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/TerminalUpdateReportController.java:50–58` 先验凭证后调用 owner；`modules/terminal-binding/.../application/TerminalCredentialVerificationService.java:22–47` 为独立 readOnly。`modules/terminal-update/.../application/TerminalUpdateReportOwnerService.java:33–47` 仅 nonnull/输入校验/report 锁与 facts，并可直接返回精确重放 receipt。
- **反例/影响**：验证 G 后取消/重绑/停用已提交，再进入报告 owner，旧 Verification 仍可写/回 ACCEPTED。报告锁没有核当前绑定事实。
- **判据/最小修复**：B §7/§8.5 短 REQUIRED 和 owner 最终复核；沿现有 binding owner 能力组织验证/写入及 receipt 前复核。`TerminalUpdateArtifactOwnerService.java:204–208、239–244` 已调用 isCurrentActiveBinding 可复用。需审清现有并发闭包，不能声称再加普通 SELECT 就解决全部竞态。首次/更新/replay 同族；合法已存历史仍保留。
- **性质**：源码事实＋可执行交错推论；**Dexter 裁决：不需要**。

### S-5 同绑定 context 变化重置报告序号

- **位置/事实**：`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:420–426` 新 descriptor 从 1 开始；`:460、524–529、768–776、856–869` 把项目更新时间参与 context，同 binding context 变化也重新创建。`test/terminalUpdate.test.ts:957–1084` 当前反而期待从 1 开始。
- **反例/影响**：CBS 接受 sequence=1 后项目名称更新，新报告又用 1；`V20261014_000000_000__terminal_update_report_history.sql:25–26` 及 ReportOwnerService L42–59 对同绑定序号冲突拒绝。后续报告无法正常推进。
- **判据/最小修复**：B §8.5 L324 的“绑定周期持久递增”。清旧 context pending/pause 保留同 binding counter，仅真实 binding 周期改变重置；覆盖上述三处替换及 reset 边界，不建设新计数服务。
- **性质**：仓内事实；**Dexter 裁决：不需要**。

### S-6 没有升级任务的正常终端不产生首次版本 observation

- **位置/事实**：同 Actor `:1243–1245` actual readback 后 task=null 直接返回；PRIMARY-ready `:1378、1436` 仍进该分支；`:801–810` 是 createReportPayload 唯一调用，依赖 writeTask/recent 变化；PONG `:843–884` 仅发送已有 pending。
- **影响**：激活且从未升级的终端没有自然报告构造链，运营列表持续 NO_REPORT；手造 observation 发送测试不能证明该生产入口。
- **判据/最小修复**：R-15、B §8.5 无 task 当前观察；在实际版本/有效报告上下文就绪时，更新 owner 复用现有 descriptor/counter/HTTP 构造去重 observation。首次启动、新 binding、旧 task 已清同族核对；PONG 不造新报告。运营 `ProjectTerminalUpdatePage.tsx:496、535` 同时应按 hasReport 区分“无报告”与“有观察、无最近任务”，不以 recent 空值代替 PG 无行。
- **性质**：仓内事实；**Dexter 裁决：不需要**。

### S-7 HTTP 报告分类与失败持久化违反既定处置闭集

- **位置/事实**：同 Actor `:918–966`。身份拒绝分支 `:942–959` 删除正文再 pause；非法 receipt/其他4xx/本地已完成协议拒绝落 retry-retained；`:961–963` 拒绝 flush 失败恢复旧 descriptor，使当前 Runtime 下一 PONG 又能发送队首。
- **影响**：应暂停保留的身份失败丢正文，应终止的协议失败阻塞后续项；已拒正文在当前 Runtime 重新重发。
- **判据/最小修复**：B §8.5 L332–346 已有完整 code/status/receipt 矩阵，直接实施它：通信未知保留；身份拒绝保留＋暂停；终态输入/协议拒绝移出＋有限失败摘要；flush 失败可见但当前 Runtime 不恢复为可发送。成功 ACK 的 flush 失败保留重送与此不同。直接测试 `test/terminalUpdate.test.ts:1087–1253` 目前只覆盖正常 flush 的 409/422，应按同矩阵检查源码断言。零新队列/第二失败库/主动重连。
- **性质**：源码事实；**Dexter 裁决：不需要**。

### S-8 真实 HOT 应用阶段被报告为 APK 安装

- **位置/事实**：同 Actor `:275–294、329–331` 对全部 applying 返回 INSTALLING，完全未用当前 task.actionKind 区分 HOT；`contracts/openapi-source/terminal-update.schemas.json:954` 已有 APPLYING_HOT。actual.entryKind 的 file-recovery 又在 `:319–327` 变成 UNKNOWN 但 unknownReason=null。
- **影响**：运营得到与实际执行不同的阶段，已知恢复入口信息也被无解释抹去。该问题不依赖未来 C WAITING_IDLE。
- **判据/最小修复**：R-15、B §8.5/附件 §11.4 要求不改写真实事实。以已有同任务 actionKind 映射 INSTALLING/APPLYING_HOT；恢复入口沿明确的现有类型/有限未知原因处理，不仅凭 entryKind 就宣称本次已回退，不新增任务状态框架。覆盖 FULL/HOT/recovery/unknown 同族。
- **性质**：仓内事实；**Dexter 裁决：不需要**。

### S-9 await 后仍固定已失效的未固定候选

- **位置/事实**：同 Actor `:716–750` 先验 snapshot/context；accept `:1509–1517` 取目标后 await readFacts，`:1538–1589` 只核 App/并发任务，没有重核当前资格、原规则/摘要。
- **反例/影响**：等 actual 期间配置/绑定/project context 失效或新快照移除规则，旧候选仍进入 fixed/执行。固定后的“执行到底”不能提前用于尚未固定候选。
- **判据/最小修复**：R-07、B §8.4 的当前资格及旧 context 失效。所有接受前 await 完成后、成功固定前，重读当前身份/资格与原候选摘要；失配拒绝零 port。已成功固定后只按原任务及当前 attempt 的角色/配置/下载授权边界执行，不能因规则后来停用/择新而取消或换目标；本地 A fixture 按明确边界分别处理。复用现有单任务核，不加全局仲裁。
- **性质**：源码支持的异步交错；**Dexter 裁决：不需要**。

### S-10 创建时间查询的真实表单值与 model 类型不匹配

- **位置/事实**：`apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:430–433、611–612` 强转 Dayjs[]；`model/terminalUpdateRuleFilters.ts:23–24` 调 startOf/endOf。仓内实际 pro-components=3.1.12-0 的 `es/table/components/Form/FormRender.js:85` 默认 dateFormatter=string；BaseForm L471、496–504 和 conversionMomentValue L138–149 输出 string[]。
- **影响**：用户选日期查询直接 TypeError，不能发查询。直接 test 手传 Dayjs 未覆盖真实提交形状。
- **判据/最小修复**：IA RULE-LIST；该 ProTable 显式 dateFormatter=false 保持当前 model，或按真实字符串形状解析，选更小者；覆盖真实组件提交值。仅本批一个 dateRange 转换入口。
- **性质**：仓内实现与精确安装版本一手源码；未凭 API 记忆；**Dexter 裁决：不需要**。

### S-11 查询读模型另建刷新体系，并在第二页永久 loading

- **位置/事实**：同运营页 `:147–262、264–351、561` 不消费 operationsContentTabRefreshSignal；运维 `apps/frontend/platform-admin/src/features/terminal-update/ui/TerminalUpdatePackagesPage.tsx:92–115` 详情不消费平台 signal。Shell `OperationsTransport.ts:175–184`/`PlatformTransport.ts:90–93` 只 invalidates RTK＋publish。第二页本地按钮 L561 调 loadRules() 未传当前 cursor，结果/finally 在 L168/186 被 identity guard 丢弃，但 L153 已设 loading=true。
- **影响**：统一刷新仍看旧规则/报告/详情；第二页按钮让列表一直 loading。
- **判据/最小修复**：前端 §3-J、IA 查询/详情。接现有 useRefreshVersion/content signal，刷新当前 query/cursor 与已开详情，借鉴 store-terminal read model；不要新造刷新总线。运维 RTK 包列表本已可失效，不能泛称两个后台全部不刷新。规则 list/detail/store page、报告 list/detail/history、包 detail 同根扫描。
- **性质**：仓内事实；**Dexter 裁决：不需要**。

### S-12 规则启停确认没有提交锁和面内失败反馈

- **位置/事实**：同运营页 `:292–324、874–889` 没有 submitting/inFlight，StatusChangeConfirm 没传 problem/submitting；catch 只把错误放在背后的主页面，409 不读回当前 revision/status。
- **影响**：用户重复点击发送旧 CAS 请求，失败被遮在确认层后；无法按当前事实再选择。
- **判据/最小修复**：RULE-STATUS、前端 §3-D。直接复用既有 StatusChangeConfirm 与 useSubmissionLifecycle，面内禁重入/显示问题；409只读取当前事实，不自动重派。上传已有在途锁、创建已有 lifecycle，不扩成全批统一重写。
- **性质**：仓内事实；**Dexter 裁决：不需要**。

### S-13 上传编辑 Drawer 绕过唯一 dirty owner

- **位置/事实**：运维 `TerminalUpdatePackagesPage.tsx:191–198、391–393、506–518` 取消/X/Esc 直接 reset/清文件/释放 stage，无 useDrawerFormLifecycle/表单 dirty 链。
- **反例/影响**：上传解析成功尚未保存，误关立即丢草稿；违反批准的继续编辑/放弃确认。
- **判据/最小修复**：B UI §6 L293–296、前端 §3-K-2、drawer-form-lifecycle memory；选文件/表单意图交现有 lifecycle，确认丢弃后才执行既有 release。运营创建已接此能力，不重复改。标准 surface/footer 可同修，不另建 close guard。未证实跨空间污染，不能借此新增该问题。
- **性质**：仓内事实；**Dexter 裁决：不需要**。

## 4. N findings（不升级为主流程阻断）

| ID | 位置、事实与影响 | 最小修复与边界 |
| --- | --- | --- |
| N-1 | Actor `:635–684` 首次 SNAPSHOT_CHANGED/hash变化直接 failed；B §8.3 要求三次有限整快照重启。管理员并发启停是普通失效，但不证明所有刷新永久失效 | 在同 refresh 内仅对指定成员变化丢候选、从第一页重读至批准上限；保持旧完整快照，非轮询。C 搬移规则链时必须带最终正确实现 |
| N-2 | Actor `:812–830` 额外64条 pending cap 丢第65个任务正文，附件 §18.1 未授权按业务数量丢弃 | 删除该人为截断，沿已有持久化失败处理。无需无限容量保证、新失败存储或离线压力专项；因触发需要长期累积，列非阻断但真实范围偏差 |
| N-3 | 运维页 `:389` 只有下一页；运营 `:805、870` 手工追加固定门店/历史＋按钮；五个 Drawer 自定宽度，编辑 footer 在正文；标题 `<a onClick>` 运维 `:156`、运营 `:418、471` 缺键盘入口 | 复用已批准 CursorPagination、Drawer surface/footer 与 Button type=link；随该页根因修复处理，别为每个控件建立新 finding/门。不是假设性“所有抽屉会溢出” |
| N-4 | 运营页 `:443、766、1360` 将 FULL 的 N 文案写成“检查间隔”，三处同族；正式需求与 UI定义为安装提醒间隔 | 改为“安装提醒间隔（分钟）”；C 只提醒当前任务，不依此增加规则轮询 |

上述 N 都是仓内事实；按既定语义修复不需要新增 Dexter 产品裁决。

## 5. 已核实的正面源码事实与同根排除

- 工件上传先 stage/解析，再保存；运维与运营职责分开；运营创建/启停而无规则编辑，FULL 必选/HOT 可选，规则用服务器创建时间排序。
- snapshot 是全项目启用集合；scope=ALL/STORE_REFS；FULL/HOT 摘要贯通；accept 还核实际 applicationId。未发现 console 正常接受 wallpaper 的执行路径，不能因 snapshot 包含两 App 就报串包。
- `terminalUpdateActor.ts:219–253` grant 核 publication/native/runtime/ZIP及独立 FULL APK 摘要、HOT minimumFull 五事实；grant 的秘密通过 header、不会持久到任务或 UI。
- Android `TerminalUpdateRuntime.kt:377–388、532–544` 核 installed FULL/action 身份；实际 APK 摘要由 `:1083–1093` 读已安装 base APK；UNKNOWN成功后 Actor `:1297–1321` 续接固定 HOT。
- builder `scripts/build/terminal-update-artifact.mjs:555–592、1007–1047` 区分 ZIP/APK摘要并读同 FULL ZIP 内 APK；沿 JDK ZipFile 主路径，没有要求恢复已撤回 Commons Compress 或归档攻击专项。
- report 当前/历史 SQL 使用有效（启用）门店/终端，任务每行 UPSERT，observation 不进入 task history，旧绑定历史可标注；状态 producer 缺口不意味着数据库表/查询不存在。
- `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts` 使用真实文件输入、保存/规则启用/审计/报告抽屉；`update.android.test.ts:1683–1795、2725–2819` 读取实际 snapshot 作为正式接受输入并检查实际 HOT及运营报告关联。runner cleanup 源码 `:1272–1334` 不停止借用 DEV。仅说明代码断言/资源所有权，不表示跑过。
- 原始业务更新时间同毫秒限制已经获 Dexter 接受，本轮不要求另建自然数版本、MQ、outbox、轮询或通知恢复框架。
- 未证明平台换空间旧 stage 污染；没有以未来 WAITING_IDLE、不同 App 配对或缺动态 evidence 给 B 定缺陷。

## 6. DESIGN_GAPS 与仍不能由静态源码确认的事项

1. 已找到上述 S 的需求/详设判据，无需将代码错误转回产品重新裁决。当前后台 route/catalog 与批准 IA 的菜单/route描述存在偏差（实际运营 route=terminal-update/rules）；C 按实际复用入口记载，不声称后台 IA已完全对齐。REGION capability 可授予性的整体 IAM路径未在本次有限 source review 证明，不升级为新的越权 finding或要求新权限机制。
2. Android 系统安装、跨启动读回、图像/资源、真实后台/设备 Journey、清理是否成功，本轮全部不评估。缺这些结果不计 finding，也不要求重跑。
3. 本次新增能力/实现结果不标 PASS；未读取历史 run，不作历史与当前运行比较。源码静态正面事实不是整批运行证据。

## 7. 阶段 C 同步

仅改 C 详设/计划/附件，Journey/IA/UI 产品方向无需因这些 B 修复改变；六文件 SHA 与处置见 `doc/review/platform/2026-10-10-ter-version-update-stage-c-stage-b-source-impact-intake-claude.md`。

同步内容：已存在的规则创建时间和 CBS HTTP/report表；当前 JSONB 报告新有限码零 SQL 迁移；更新后的 execution boot 写/读锚点；同绑定 counter/pending留 base；已批准 project-basic 的规则/组织资料搬移单位，store loaded 同 command 两下游先后前提；B 当前接受输入与 C 新 request command 的差量边界。相关 B 缺口先修后读回，不搬出第二报告 owner、第二任务核或后台查询实现。

C 保持未授权实施与运行；当前修订是作者 source-impact 处置，无新的独立 DESIGN verdict，不重开关闭的 cycle。B修复后由Dexter决定后续 review/实施，不由本报告自动授权。
