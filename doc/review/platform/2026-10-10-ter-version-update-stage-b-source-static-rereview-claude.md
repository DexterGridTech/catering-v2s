# TER 版本更新阶段 B：当前源码独立静态复评

日期：2026-10-10。范围：阶段 B 当前生产源码及直接相关测试、生成器源码。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
VERDICT=NO-GO
M/S/N=0/4/2
EVIDENCE_TIER=STATIC_SOURCE_ONLY
L1_ENGINEERING=STATIC_FINDINGS_PRESENT
L2_USER_VISIBLE=NOT_ASSESSED_DYNAMIC_OUT_OF_SCOPE
L3_UNVERIFIED=运行行为未核验，不作为本轮阻断理由
SAME_ROOT_SCAN=已检查报告生命周期、生成器分类、snapshot 接受、状态确认及两个子列表
DESIGN_GAPS=本轮六项均有现有详设或交互判据，无须新增产品机制
TEMPLATE_COVERAGE=NOT_APPLICABLE_WITH_REASON：本轮评源码行为，不重新评文档模板完整性
```

## 1. 方法、范围与方案合理性

本会话是续接会话，知道原评审及作者 intake，不声称作者会话为盲审。三个 fresh、只读子 agent 分别先以需求、详设与当前 CBS、TER、后台源码形成判断，再对照原 findings 和作者材料。主 reviewer 对下述反例重开 owning source，合并、去重并独立裁决。作者 disposition、旧 verdict、测试名称与 focused 输出均不是本轮证明。

只使用纯读取命令；没有运行测试、生成、编译、构建、verify 或环境操作，没有读取 `.runtime/`、运行日志、manifest、截图或数据库证据。本文件是唯一新增交付物；没有修改实现或阶段 C。测试源码只说明调用与断言，不代表测试通过。

这项工作的实际目标是：运维保存可用的 FULL/HOT 工件，运营发布项目范围规则，TER 固定正确目标并执行，运营能够查询真实版本和任务报告。当前主干能够承载这个目标：CBS 仍是业务事实 owner；TDC 提供认证 HTTP 通路；terminal-update 保有执行和报告状态；两后台复用既有列表、Drawer、提交与刷新能力。没有理由换路线或增加恢复框架。

剩余阻断来自常见的启动先后、协议失败、刷新和并发修改路径，不是恶意归档或阶段 C 的未来场景。局部复用还有两处遗漏：子列表分页未接 foundation；状态确认没有按具体 problem 区分 CAS。

## 2. 原 findings 关闭情况

以下 CLOSED 是源码反例关闭，不是动态 PASS。

| 原项 | 当前判断 | 静态依据 |
| --- | --- | --- |
| S-1 运营授权先于 receipt 回放 | CLOSED | `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateRuleOwnerService.java:71`、`:109`、`:259`：现行 grant/项目准入先于回放；直接测试覆盖失效授权与重放入口。 |
| S-2 FULL/HOT entry 与实际文件 | CLOSED | 同目录 `TerminalUpdateArtifactParser.java:125`、`:167`：HOT entry 对照文件清单，FULL entry 对照 APK 文件与摘要；不是只验证字符串合法。 |
| S-3 manifest 上限到 grant | CLOSED | `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/api/TerminalUpdateArtifactOwnerApi.java:12`、`:58` 与 application/`TerminalUpdateArtifactOwnerService.java:256`：共享上限，grant 不再截断为 128 个文件。 |
| S-4 报告锁核当前 binding | CLOSED | application/`TerminalUpdateReportOwnerService.java:38`：事务内先锁核当前 ACTIVE binding，再访问报告事实；credential verification 的 binding 行锁与取消路径相接。 |
| S-5 同 binding 序号单调 | CLOSED | `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:435`：仅换 context 保留 nextReportSequence，换 binding 才复位；测试 `test/terminalUpdate.test.ts:969` 覆盖此区别。 |
| S-6 无任务 observation | PARTIALLY | 重复 reconcile 的局部去重存在，但自然启动和旧任务身份仍有缺口，见本轮 S-1。 |
| S-7 报告失败分类 | PARTIALLY | 合法 business-rejection 已分流；真实生成客户端的 schema/非标准 HTTP failure 未闭合，见本轮 S-2。 |
| S-8 HOT/恢复状态 | CLOSED | actor `:275`、`:321`：HOT 应用阶段与恢复入口的未知实际事实分别映射，不把 file-recovery 冒充目标 HOT 成功。 |
| S-9 固定前候选资格 | PARTIALLY | actor `:1624` 有最终重读与 commit slot；同 context 刷新仍保留旧 ready 可接受，见本轮 S-3。 |
| S-10 日期值 | CLOSED | `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:636` 配置 dateFormatter=false；model/`terminalUpdateRuleFilters.ts:23` 按 Dayjs 转换，与仓内 ProComponents 实现相符。 |
| S-11 刷新 | CLOSED | operations 页 `:133`、`:459` 与 platform 页 `apps/frontend/platform-admin/src/features/terminal-update/ui/TerminalUpdatePackagesPage.tsx:140` 使用当前列表/详情刷新路径。 |
| S-12 CAS | PARTIALLY | 具备 readback，但冲突种类与确认动作文字仍不一致，见本轮 S-4。 |
| S-13 上传 Drawer | CLOSED | platform 页 `:78`、`:216`、`:425`：dirty、关闭确认及清理接既有 Drawer lifecycle。 |
| N-1 snapshot 有限重读 | OPEN | 三次循环没有处理真实错误分支，见本轮 N-1。 |
| N-2 64 项 pending 截断 | CLOSED | actor `:843`–`:858` 合并同 task/observation 项，未见原 64 项裁切；这不宣称底层存储无限容量。 |
| N-3 子列表分页 | PARTIALLY | 主列表已接 foundation，两处 Drawer 子列表仍只追加“加载更多”，见本轮 N-2。 |
| N-4 安装提醒文案 | CLOSED | operations 页 `:499`、`:833`、`:1471` 为安装提醒间隔，未继续称为检查间隔。 |

原 13 项 S 中 9 项关闭，4 项部分关闭；当前新增计数按下文六项，避免重复计算。

## 3. 当前 findings

### S-1：无任务报告没有闭合真实就绪时序，且可能重新签入旧任务

- **判据**：正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md:224`–`:240`；B 详设 `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:324`–`:328`：ready 后实际观察、旧 binding 不改签，新绑定无任务 observation 使用 taskId=null。
- **源码事实**：`apps/terminal/kernel/base/terminal-update/src/application/createTerminalUpdateModule.ts:76` 启动先 reconcile；`:83`–`:123` 的后续 context/state refresh 只刷新规则。actor `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:1294`–`:1305` 要求规则 context 已就绪且 nextReportSequence===1，之后 PONG `:1477` 仅发送已有 pending。
- **普通反例/推论**：store/project HTTP 与 flush 尚未完成时，startup/PRIMARY-ready 的 reconcile 已结束。之后 composition 得到有效 context，只 refresh snapshot，没有补建实际 observation。CBS 可以一直没有报告。生产前提可见 `apps/terminal/kernel/feature/store-basic/src/application/module.ts:71`、`src/features/actors/actors.ts:359`、`:450`，及 console assembly `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:189` 的 readiness 门。
- **同根反例**：同 binding 换 context 的 descriptor `actor:435` 保留序号，故“序号等于 1”不能表示当前 context 尚未观察。取消后保留的 recentStatus 若带旧 taskId，当前无任务 reconcile `:1305` 将它送给 `createReportPayload:310`，并在 `:339` 保留旧 rule/artifact 引用；新的 binding descriptor 从 1 起步，可能将旧任务改签为新绑定报告。
- **测试边界**：`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts:1275` 的初始 observation 用例预先提供有效 context 并直接 reconcile，不能关闭上述自然启动先后反例。
- **影响**：当前版本不可见；或历史任务归入错误绑定。不是要求增加报告流水。
- **最小修正**：在现有 owner 的有效 context 就绪/实际事实变化入口生成幂等 observation；去重按当前事实和 binding/context，而非全生命周期计数==1。新 binding 的无任务观察明确 taskId=null，不复制旧 task 引用；保留的旧执行状态仍可用于本机续接。补现有测试的异步就绪屏障与换 binding 反例。
- **性质**：源码事实＋可达时序推论。**Dexter 裁决：不需要**。

### S-2：报告结果分类在真实 generated HTTP 边界被丢失

- **判据**：B 详设 `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:334`–`:342`，特别是无合法 problem 的 401/403 暂停、无效 200/协议结果退出发送集合。
- **源码事实**：`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:986`–`:1002` 仅正确分流 business-rejection；failure 分支 `:1004`–`:1010` 只识别 INVALID_TERMINAL_UPDATE_REPORT，其余保留重试。TDC `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:1143`–`:1210` 返回 generated 结果。
- **真实结果来源**：`scripts/generate/terminal-client-api.mjs:600` 的 failure 没有 HTTP status；`:614` 将无效成功 body 变为 TERMINAL_RESPONSE_SCHEMA_INVALID；`:622` 将未知 4xx 变为 unknown-business-rejection；`:624` 将其他 HTTP 变为 HTTP_DELIVERED_FAILURE。当前消费者 `apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts:804`–`:816` 同形。
- **反例/推论**：HTTP200 的坏 receipt 被 schema 拒绝后，不进入 owner 的 success-body 校验，而被永久保留在队首；不带合法 problem 的 401/403 也无法按 status 暂停。心跳重复发送，后续报告被堵。合法 409/422 mock 测试不等价于这条生成器→TDC→owner 链。
- **最小修正**：在既有生成器结果中保留完成 HTTP 所需的安全 status/协议失败分类，并由 owner 接现有处置表；区分网络/5xx 可重试与完成后的参数/schema/非标准 4xx 终态或身份拒绝。按正常生成链更新产物，不手改 generated 文件，不新增失败队列。用现有直接测试覆盖真实 generated 返回形状。
- **性质**：源码事实＋确定分支推论。**Dexter 裁决：不需要**。

### S-3：同 context 刷新期间仍能固定已过期候选

- **判据**：B 详设 `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:299`–`:301`：刷新中的旧完整值不能作为当前可接受规则；固定前核验当前 context 和候选。
- **源码事实**：`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:554`–`:569` 只有 context 改变才清 snapshot；同 context refresh 等待订阅和 HTTP 的全过程仍保留旧 ready。`:754`–`:768` 按 ready 取目标；`:1633`–`:1636` 生产未注入 sourceProvider 时，最终重读仍从这个旧 snapshot 取值。
- **普通反例/推论**：规则停用通知触发同 context refresh，HTTP 尚未返回；此时接受旧规则，初读和固定前重读都获得旧 ready，遂固定原本已停用候选。现有 target commit slot 防并发固定，但不能令旧 snapshot 变新。
- **测试边界**：`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts:1786` 的 provider 第二读改变目标，未覆盖生产 snapshot refresh 屏障。并发 accept 的屏障修正本身没有推翻该反例。
- **最小修正**：复用当前 ephemeral refresh 状态或已有 in-flight 标记，刷新期间禁止新的 accept；旧数据可保留供显示，成功完整 flush 后恢复可接受。已经固定的任务不撤回。补同 context 订阅触发刷新、HTTP 挂起时的直接反例，不增加调度框架。
- **性质**：源码事实＋可达竞态推论。**Dexter 裁决：不需要**。

### S-4：CAS 后确认标题与真实提交动作相反，且所有 409 被当作 CAS

- **判据**：B UI `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:339`–`:340`；IA `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md:58`：冲突读回后核对原操作，确认对象、动作与提交一致。
- **源码事实**：`apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:342` 对全部 409 做 CAS readback；`:350` 更新 statusTarget，保留 statusIntent。`:947` 标题反转最新状态，`:950` 和 `:961` 却仍按原 statusIntent 显示按钮、提交 command。
- **普通反例**：用户准备启用停用规则，另一管理员先启用。读回后标题成为“停用…？”，按钮和实际请求仍是“启用”。这不是措辞偏好，而是动作误导。
- **同根事实**：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:310`–`:318` 将 VERSION_CONFLICT、IDEMPOTENCY_CONFLICT 都映射为 409；前端会把幂等冲突也解释为别人修改，并重置提交 key。
- **最小修正**：仅确切 VERSION_CONFLICT 做对应 readback；其他 409 保留自身错误及相应 attempt 身份。标题、按钮和请求统一用明确用户 intent；若最新状态已等于 intent，明确告知该事实，不默默反转操作。不新增确认体系。
- **性质**：源码事实。**Dexter 裁决：不需要**。

### N-1：snapshot 三次重读未接真实错误，CBS 错误码也不匹配 canonical

- **判据**：B 详设 `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:297`：分页 SNAPSHOT_CHANGED 有限重读，保留旧完整快照。
- **源码事实**：`apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateRuleOwnerService.java:218`–`:219` 对 hash 改变抛 TerminalUpdateRuleStaleStateException，经 `ContractProblemAdvice.java:310` 映射为通用 VERSION_CONFLICT，不是 generated snapshot operation `apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts:469` 列出的 TERMINAL_UPDATE_SNAPSHOT_CHANGED。
- **消费者事实**：`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:703`–`:704` 对非 success 直接 fail；`:710`–`:732` 仅对成功 body 中不同 hash 重读。即使先修 CBS 错误码，consumer 仍不会走已写的三次重读。
- **影响/推论**：分页期间普通规则变化令刷新失败；现有测试 `test/terminalUpdate.test.ts:514` 用成功页面换 hash，不代表实际服务端路径闭合。
- **最小修正**：复用 typed snapshot-changed 错误，统一 owner→edge→generated code；actor 只对这一精确错误在现有三次总预算内从第一页重读，其他错误保持原分流。无需轮询、额外计时器或恢复框架。
- **性质**：源码事实＋协议分支推论。**Dexter 裁决：不需要**。

### N-2：N-3 分页残余是明确设计偏差，报告历史还可重复追加

- **判据**：IA `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md:57`、`:60`；UI `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:334`、`:421`；B 详设 `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:469`：两处子列表用标准 Table＋foundation CursorPagination。
- **源码事实**：`apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:426`–`:446`、`:872` 的规则门店追加页，`:398`–`:425`、`:936`–`:939` 的报告历史追加页，均只有“加载更多”，不是既有前/后页控件。opaque cursor 不阻止使用 `libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx:13`–`:38` 与 `useCursorStack.ts:22`–`:45`；它们就是为不暴露任意页跳转的 cursor 分页提供的。
- **普通反例/推论**：历史按钮没有页内 busy 防护，`:401` 不为每次页请求增加 identity，快速点击两次会发相同 cursor；两次返回都通过 guard，`:415` 将同页追加两遍。规则门店路径有增加 requestId，不能把该重复问题无差别归给两处。
- **影响**：批准分页行为缺失，历史报告重复显示。已修的主列表分页不关闭这两处子列表。
- **最小修正**：两处接现有 cursor stack＋CursorPagination，按对象/context 重置，展示当前页而非无限追加；沿现有请求 identity 隔离迟到/重复页请求。不新增 total、任意页码、第二分页缓存。
- **性质**：源码事实＋重复请求推论；设计偏差，不是风格建议。**Dexter 裁决：不需要**，已有明确设计。

## 4. 同根扫描、未验证与交付边界

同根扫描包含：启动、PRIMARY-ready、context 变化、PONG、取消后 retain 与 descriptor 变化；报告合法 problem、schema failure、HTTP fallback 和本地参数拒绝；snapshot 换 context/同 context、最终 accept 重读及并发 commit；规则启用/停用及 CAS/幂等冲突；两个后台主列表、上传 Drawer、规则门店和报告历史子列表。没有把无法由合法当前生产输入到达的 recent=null UI 分支另立 finding，也没有要求新增阶段 C 的自动择新或恶意 ZIP 专项。

当前报告提交 owner 的 binding 行锁、运营 receipt 重放前授权、有效工件清单和摘要、manifest 传递、同 binding sequence、HOT/恢复事实映射、日期值及 Drawer lifecycle 均有当前源码支持。仍然不能从这些静态事实推导实际安装、网络时序、DB commit、后台交互或 cleanup 已通过。

本轮全部运行行为未执行、未核验；这是授权边界，不是 evidence finding。作者 focused 输出和历史结果不被升级为本轮 PASS。本结论只覆盖阶段 B 当前源码静态复评，不代表阶段 A/C、整批动态交付或任何后续执行授权。
