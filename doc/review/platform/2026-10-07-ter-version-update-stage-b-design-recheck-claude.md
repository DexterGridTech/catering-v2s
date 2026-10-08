# TER 版本定义、完整更新与热更新：阶段 B 当前完整设计包外部独立静态复核（Claude）

## 0 · 结论块（review-standard §5）

```text
REVIEW_TARGET=DESIGN（阶段B完整设计包当前字节；Journey/IA/UI-interaction/implementation-design/plan/source-and-api-appendix）
ACTION_1_VARIANT=1-B（仅设计文档＋静态源码读回）
VERDICT=NO-GO
M/S/N=0/1/6
L1_ENGINEERING=STATIC_ONLY：设计↔源码锚点读回；无生成/编译/测试/verify
L2_USER_VISIBLE=NOT_RUN：两个内容页、右Tab、报告Drawer、审计Modal均无浏览器/HTTP/L2证据
L3_UNVERIFIED=非空（见 §9），因此即使 S-1 关闭也只能到 GO_WITH_UNVERIFIED_UI
SAME_ROOT_SCAN=已做，逐条见各 finding 的“同根”
DESIGN_GAPS=3（见 §7）
TEMPLATE_COVERAGE=见 §6
EVIDENCE_TIER=STATIC_DOC_AND_SOURCE_READBACK；无 TEST/HTTP/L2/DEV/设备层证据
reviewerKind=EXTERNAL_CLAUDE
```

本批证据边界：只有文档与静态源码读回；A 最终交接仍 OPEN，阶段 B 的生成、编译、测试、verify、HTTP/L2、DEV、Web/Android、seed 与 cleanup 全部 NOT_RUN。本文不把计划或历史运行称为当前 PASS。

## 1 · 会话来源披露

本会话 **不是 fresh**。它是同一 Claude 会话的压缩续接；上一轮外部 NO-GO 0M/3S/8N（`2026-10-07-ter-version-update-stage-b-design-review-claude.md`）以及随后的“转给 Codex 的修复话术”都出自本会话。为降低继承偏差，本轮按当前字节重新提取，不沿用上轮结论；上轮条目的现状单列在 §8，只作对账用。本轮没有读取 `.runtime/`。

## 2 · 评审对象字节

| 文件 | SHA-256 |
| --- | --- |
| doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md | 89803db2849b18c48f515640c53088f90ca05f645beec8732b6f62cb92676d09 |
| doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md | d9078bf8eb7b4d674d870ea61ef3f72acf909855454f86a93ae9d4d6c19925f6 |
| doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md | 2528d5845609ce307669f452c68a297fb37fbe381c43c6629e2cda98e9677cdf |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md | 42de671aa776e75c29ec210ba6156729681ccf2d42975e47c9a359aaf5a1a7bd |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md | 0ddf05e0c4f315debe46472e6c1ecf1b90268c155bae5442d540253b60c3683a |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md | 087e4aa0e0322d5f3461ae8ea97a6c114119dcf48f479bb4a1876082e05e11a7 |
| doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md | f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22 |

以上字节与作者 intake 声明一致。三份 review/intake 是最后读的，只用于 §8 对账，不作为证据来源。

## 3 · 独立预期（读 intake 之前写下）

六项裁决落地后，一个合格设计至少应满足以下几点：

1. 报告分母是 organization 的“启用门店 × 启用终端”，page、detail、history 三处共用同一资格判断，NO_REPORT 走 LEFT JOIN。
2. 报告 PG 每任务一行，按 UPSERT 写入；无任务的 observation 不进入历史。
3. 主机侧 pending 归升级 owner，并且对每一类 HTTP 结果都有闭合处置：可重试、终态拒绝、身份失效分开，不能用一句“保留重送”统一带过。
4. PONG 广播复用 Runtime 的多 handler 分发，不用 `dispatchBackgroundCommand`。
5. 审计复用既有 audit-history 全链：contract enum、controller switch、sealed query、gradle 依赖、前端 Modal。
6. 分钟到秒的换算只在 UI 边界做一次。
7. L2 报告生产者是同 run 激活加 CBS HTTP，不依赖 TDS。

当前字节在第 3 项和第 5 项上与预期不符，其余基本符合。

## 4 · 方案合理性

总体判断：六项裁决落成的方案方向成立，而且比旧 WS 报告方案更简单。

报告改走 CBS HTTP 后，旧方案中的 ACK 帧、TDS SQL 函数、写 principal、ACK timer，以及“报告失败就重连”都一并删掉了。重试改由 PONG 触发，复用的是已有的心跳节奏，没有新造轮询或调度中心。符合 KISS，没有引入新依赖。

静态核过的可行性如下：

- Runtime 本地 command 会对全部 handler 执行 `Promise.all`（`createCommandDispatcher.ts` 约 624–658 行）。每个 actor 的 timeout 用的是 `Promise.race`，不会取消真实执行（`createCommandActorDispatcher.ts` 约 325–371 行）。`allowReentry` 只看祖先链，不提供全局单飞，所以设计要求 owner 自己在首个 await 前置 inFlight（D§8.5 第 297 行），这一点是对的。
- transport HTTP 默认 5s（`createTransportConnectionOwner.ts:378`），远小于 command 的 60s timeout。正常情况下 timeout 先于 IO 结束的概率很低，设计也已经禁止仅凭 timeout 释放 inFlight。
- CBS 在激活插入时 binding 即为 `ACTIVE`（`TerminalBindingOwnerPersistence.java:112`），所以 HTTP 报告不需要 TDS session，L2 用“同 run 激活加 HTTP POST”作为报告生产者可行。

不合理之处只在一点：重试队列没有结果分类（见 S-1）。这会让“标准重试机制”在第一个终态拒绝出现时就停摆。这是机制缺口，不是产品分歧。

UI 自问：

1. 用户能否只靠首列认出行并点进详情？不能完全做到，首列门店名不可点（N-4）。
2. 空、加载、拒绝、错误是否分开？已分开，NO_REPORT、未知、无任务、旧绑定各有文案。
3. 停用以后已打开的 Drawer 会怎样？读回时拒绝并清除旧内容，D§8.5 第 301 行与 IA §2.3 一致。
4. 只读用户能否看报告和操作历史？能，O-P 不要求 W-P。
5. 分钟输入能否产生非法秒数？不能，UI 乘 60，服务端再校验 60 的倍数。

## 5 · Findings

### S-1 · 报告 pending 缺少结果分类，终态拒绝会永久阻塞队列（CONFIRMED，设计缺口）

**位置**

- 详设 §8.5 第 293 行：“失败/响应丢失保留 pending，同正文重送”。
- 详设 §8.5 第 297 行：“每次触发发送一个 pending…按 reportSequence 升序处理”。
- IA §4.1 第 155 行：IDENTITY_CONFLICT 409 时“升级owner保留pending及typed失败”。
- 附件 §11.2 第 254 行：submit 的错误集是“复用credential拒绝”加 409 加 503，receipt 只写了 `TerminalUpdateReportReceipt`，没有列出 `SUPERSEDED` 变体。

**仓内事实**：设计对 HTTP 结果只有两类，成功删除 pending，其余一律保留并原样重送。由于每次只发最小 sequence 的那一条，队首如果被确定性拒绝，后面的任务和 observation 永远轮不到。

**触发反例**（以下全部按现有设计条文推出，未运行）：

1. 低序号报告因为本地序号与 CBS 已存行冲突，收到 409 `REPORT_IDENTITY_CONFLICT`。同正文重送仍然是 409，每次有效 PONG（TDS 默认约 30s）重复一次，永不结束，后续任务报告全部卡住。
2. 主机升级之后，旧版本留下的 pending 正文不再满足新 schema，返回 422 `VALIDATION_FAILED`。结果与反例 1 相同。
3. 终端在 CBS 被停用。credential verification 返回 `STORE_TERMINAL_DISABLED` 409（属于 TERMINAL_DATA_READ 闭集）。设计没有说这类结果是等待绑定变化，还是清空队列。

**影响**：运营右 Tab 会长期显示过时的“最新升级报告状态”，用户却看不到任何失败原因。同时每 30s 产生一次注定失败的 HTTP 请求。Dexter 确认的“标准机制”还要写入 terminal standard §4-F，缺口会随之被后续 owner 复制。

**最小可验收修正**：在 D§8.5 和附件第 254 行冻结 submit 的完整结果闭集，并给每类结果写明处置。

- 可重试：网络错误、503、RESULT_UNKNOWN。保留 pending，等下一次 PONG。
- 终态拒绝：409 IDENTITY_CONFLICT、422。把该项移出发送队列，转成 owner 可见的失败状态，不再阻塞后续项。是否保留诊断由设计写明。
- 身份失效：credential 或 binding 拒绝、`STORE_TERMINAL_DISABLED`。暂停发送，等 binding 或配置变化时按 D§8.5 第 289 行的规则清理。
- `ACCEPTED` 和 `SUPERSEDED` 两种 receipt 都删除匹配的 pending。

还需要补三条 focused 反例：409 不阻塞下一任务、422 不阻塞 observation、停用终端不无限重送。

**同根**：本批终端侧 typed 结果共 5 处，其余 4 处已逐一检查：snapshot 有“有限 3 次”；grant 有“A 有限重取”；content 由 A 处理；heartbeat 广播拒绝只记日志。只有 report 缺分类。

**需 Dexter 裁决**：否。这是机制闭合，产品语义已有裁决。只有当“终态失败是否要在后台展示”需要新增 UI 时，才回到 Dexter。

### N-1 · 审计读取链列举不完整，ARTIFACT 审计没有消费者（CONFIRMED）

**位置**

- 附件 §19.1 列出了 enum、`OperationsAuditTaskReadService`、`TerminalUpdateAuditReadApi` 和前端。
- 详设 §3 第 101 行：“TERMINAL_UPDATE_RULE/ARTIFACT enum”“包平台审计经既有平台读取扩展”。

**仓内事实**

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java` 第 44–63 行是一个封闭 switch，`default` 直接抛 `InvalidEdgeRequestException`。
- `contracts/openapi/paths/operations-admin/audit-history.paths.json` 的 entityType enum 中，TERMINAL_UPDATE 命中 0 次。
- audit-read 的 `build.gradle` 第 6–15 行没有依赖 terminal-update 模块。
- 以上三处在设计包里 grep 零命中。

**反例**：按当前清单实施 RULE-AUDIT 后，第一次读取就会因为 contract 校验得到 422，或因为 controller 得到 InvalidEdge，审计 Modal 显示失败。

**影响**：CP 拆分和计数会少算三项，实施者容易靠临时补洞完成。

**最小修正**：

- 附件 §19.1 补入 controller、paths.json 和 gradle 依赖三项。
- ARTIFACT 审计二选一：要么从 enum 和 D§3 删除“包平台审计”，要么补上 platform 端读面和 IA 交互。当前 IA 没有 platform 审计面，建议删除。

**同根**：RULE 的 CREATE、ENABLE、DISABLE 三种写入都依赖同一条读链，修一处即可覆盖。

**需 Dexter 裁决**：否。只有在决定保留 ARTIFACT 审计并新增 UI 时才需要。

### N-2 · “最新升级报告状态”的取值来源与跨绑定历史没有冻结（PARTIALLY_CONFIRMED，推论）

**位置**

- 详设 §8.5 第 291 行：“当前终端最新观察按当前绑定中已接受的最大 reportSequence 取”，历史只取 taskId 非空的行。
- 详设第 301 行：page 返回“最新任务报告及状态/时间”。
- UI 第 41、164 行：列为“最新升级报告状态”。

**推论**：“最新观察”可能来自 observation 行，此时 recent 为 null；“最新任务报告”则来自 task 行。两者是不同的行，设计没有说明列值取哪一个。

**反例**：终端先完成任务 T1，随后重启，只产生一条 observation。如果列值按最大 sequence 取，就会显示“未发生更新”，把刚完成的 T1 遮住；如果按最新 task 取，actual 列和状态列又来自两个不同时点。

此外，history 是否跨 bindingGeneration 返回、旧绑定的任务行在 Drawer 中如何标识，第 291 行只覆盖了“新绑定尚无报告”这一种情况。

**影响**：前后端可能各自解读，导致同一终端在列表和详情中显示不一致。

**最小修正**：在 D§8.5 写死三件事：

- actual 列取当前绑定最大 sequence 的报告；
- 状态列取当前绑定 receivedAt 最新的 task 行，没有则显示“未发生更新”；
- history 是否跨绑定，以及旧绑定行的标记文案。

UI §4.2 同步。

**同根**：page、detail、history 三个读面共用同一定义，已全部检查。

**需 Dexter 裁决**：仅“历史是否显示旧绑定任务”一项属于产品可见语义，建议 Dexter 确认，默认值为“显示并标注上次绑定”。

### N-3 · 旧报告模型残留文字（CONFIRMED）

以下是同根全集，本轮 python 扫描逐条命中：

| 位置 | 残留 | 当前裁决 |
| --- | --- | --- |
| 详设 §7 第 235 行 | “reportcommand→TDC→TDS(SQL当前session) / CBS只存最后main值” | CBS HTTP；每任务一行 |
| 详设 §8.2 第 256 行 | N/M“整数1～86400秒” | 第 258 行：60～86400 且为 60 的倍数 |
| 详设第 372 行；附件第 133 行 | “V-29 运营后台最后值”“详情Drawer最后值” | 最新加任务历史 |
| Journey 第 45 行 | “查看最后主机报告…报告过时” | 最新任务报告加历史 |
| Journey 第 93 行 | corpus 行名“最后主机报告” | 同上 |
| Journey 第 98 行 | “运营规则/最后报告” | 同上 |
| UI §7 第 383 行 | “项目全部主机含NO_REPORT” | 仅启用门店下的启用终端 |
| IA 第 185、189 行 | 两个“## 8”标题 | 编号重复 |

**影响**：实施者若按第 235 行或第 256 行编码，会重新引入已删除的 TDS 路径，或放过非 60 倍数的秒值；第 383 行的验收描述会与资格反例（D 第 303 行）冲突。

**最小修正**：逐行改成当前口径，并重编 IA 标题号。

**需 Dexter 裁决**：否。

### N-4 · 报告列表首列与 frontend §3-I 不符，UI §1.2 却声明“无例外”（DEXTER_DECISION）

**位置**

- UI 第 164 行线框：“门店名 / 终端名(可点击) / …”。
- UI §1.2 第 55 行：PROJECT-REPORT“无例外”。
- `doc/platform/frontend-coding-standard.md` §3-I 第 354 行：第一列必须是业务名称，并且点击即进入该行详情。

**事实**：这一行的实体是终端，详情是终端更新状态详情。首列门店名不可点击，可点击的终端名在第二列。

Dexter 原话“显示门店名、终端名、实际版本、最新升级报告状态”可以读作字段清单，也可以读作列顺序，仓内无法判定是哪一种。

**最小修正**（二选一）：

- (a) 终端名作为首列并可点击，门店名放第二列；
- (b) Dexter 明确要求门店名在首列，则在 UI §1.2 把“无例外”改为具名例外，并引用该裁决。

**需 Dexter 裁决**：是，只需回答列顺序是否为有意安排。

### N-5 · L2 报告生产者的执行客户端未具名（CONFIRMED）

**位置**：详设 §3a.1 第 143 行，以及 §3a.2（147–162 行）：“本 run 激活→HTTP report commit”，凭证放在内存头中。

**事实**：设计没有说明是哪个脚本或工具完成激活、持有内存凭证并发出 `submitTerminalUpdateReport`，也没有说明该 run 的 binding 和报告行如何 cleanup。计划第 112 行列出了 backend-acceptance、受管 DEV/TER Web/Android 和 admin L2 三类执行面。backend-acceptance 可以承载这个报告客户端，但计划没有具名它。

**反例**：实施时可能退回 SQL 直写报告，或复用 DEV 现有终端。这两种做法都被 Journey §4.1 禁止，但设计没有给出合法的替代路径。

**最小修正**：在 D§3a.2 具名这个 fixture 客户端：沿用哪个既有激活 acceptance helper、凭证生命周期仅限进程内、run 结束后对 binding 和 report 的 owned cleanup。计划同步写明 CP 落点。

**需 Dexter 裁决**：否。

### N-6 · 报告 detail 与 history 对同一目标的拒绝语义不一致（CONFIRMED）

**位置**

- 附件第 253 行：detail 对“不存在/异project”返回 COMMON404。
- 附件第 255 行：history 写的是“停用目标/异project沿scope/缺失拒绝”，没有给出 code。
- 详设第 303 行要求 page、detail、history“同一资格判断”。

**反例**：已打开的 Drawer 遇到终端被停用后，detail 返回 404，history 可能返回 SCOPE_MISMATCH 403。IA §4.1 两行的恢复文案不同，同一 Drawer 内会出现两种互相矛盾的反馈。

另外，detail 行没有写出“停用目标”这一分支。

**最小修正**：

- 两个 operation 统一为一个 code，建议对停用、作废、缺失、异 project 都返回 COMMON404，避免泄露存在性；
- IA §4.1 第 141 行写明覆盖“报告 detail/history 目标停用”；
- 补一条 focused 反例。

**需 Dexter 裁决**：否。

## 5a · 关注点 1–8 逐项结论

1. **资格一致性：基本通过。**
   - 详设第 301、303 行与 IA §2.3 第 102–103 行一致：启用门店 × 启用终端，VOIDED 一并排除，NO_REPORT 走 LEFT JOIN，actual 在 SQL 侧过滤，不使用 target。
   - 单侧停用的反例已列全。
   - 残留问题有两处：detail 与 history 的拒绝码不一致（N-6），UI 第 383 行仍是旧口径（N-3）。
2. **HTTP 报告链：结构通过，结果闭集缺失（S-1）。**
   - 已通过的部分：
     - credential 由 TDC 唯一 owner 注入；
     - REQUIRED 短事务，按 binding 加 advisory lock；
     - 唯一键 `(workspace,terminalRef,bindingGeneration,reportKey)`，按任务 UPSERT；
     - observation 与任务分离；
     - 乱序处理：同任务低序号返回 SUPERSEDED，不覆盖较新状态；
     - history 是 cursor 分页。
   - latest 的取值语义见 N-2。
3. **pending 持久化与闭合：部分通过。**
   - 已覆盖的情形：
     - 本地 flush 失败时保留 pending，并承认无法承诺落盘；
     - 回包后重验绑定和配置，旧回包不清除新记录；
     - binding、config 或 reset 时清理旧上下文项。
   - 终态拒绝没有闭合（S-1）。
4. **PONG 广播保真：通过（静态）。**
   - PONG 匹配后才发广播，发生在 deadline 和 RTT 更新之后；
   - `allowNoActor` 为 true；不使用 `dispatchBackgroundCommand`；不 await 业务 HTTP；
   - Runtime 会分发给多个 handler；timeout 不取消 IO；owner 在 await 前置 inFlight；
   - 无轮询、无中心存储、不因报告失败重连。
   - 以上只与源码结构对照过，没有运行证据。
5. **两页、审计、保存门槛、字典、分钟换算：大部分通过。**
   - 已通过：两个路由、两个内容页、10 个交互标识；保存门槛与 Dexter 第 2 项裁决一致；UI 4.2 字典覆盖全部闭集（脚本已核）；分钟换算加服务端 60 倍数校验；DEV 值 5/10 分钟。
   - 未通过：审计链缺三项（N-1）；首列不符合 §3-I（N-4）。
6. **18 个 operation 的 canonical→codegen→consumer 链：计数通过。**
   - 计数为 platform 5、operations 9、terminal 4；TDC include 新增 3 个 JSON operation，binary 排除。
   - 报告 operation 的错误集写着“拟新增 TERMINAL_UPDATE_REPORT_WRITE，复用 credential 拒绝”，精确成员推迟到 CP-01。这与 S-1 同根：属于设计层必须冻结的结果闭集，不应推迟到实施阶段。
7. **CP 顺序、A 交接、测试与 fixture：通过，但有一处未具名（N-5）。**
   - A 交接作为前置；
   - L2 报告使用同 run 激活加 HTTP，不依赖 TDS，前提成立（binding 在激活时即为 ACTIVE）；
   - TER 使用当前 automation，并且 Web 先于 Android（计划第 123 行，符合 TR-16 的顺序要求）。
8. **R-15、terminal standard §4-F、记忆同步：已如实声明为未来 CP-01 义务（详设第 299 行，Journey 第 14 行）。** 本轮未修改，也没有冒充已同步。

## 6 · TEMPLATE_COVERAGE

| 模板 | 对应工件 | 覆盖 | 缺口 |
| --- | --- | --- | --- |
| journey-decision-template.md | Journey | 元数据、任务、失败后事实、前提链、非目标、corpus、UI 适用性、裁决、导航都在 | corpus 第 93 行行名仍是旧口径（N-3） |
| ia-design-template.md | IA | 逐交互面后台/入口/控件/权限、可见与不可见维度、错误映射、完成块都在 | §8 标题重复；报告 detail/history 错误码不一致（N-6） |
| ui-interaction-design-template.md | UI | canonical 表、§1.2 规范适用、线框、字典、动作全集都在 | §1.2 的“无例外”与 §3-I 冲突（N-4）；第 383 行旧口径 |
| implementation-design-template.md | 详设、计划、附件 | 18 个 operation、DB 计数、L2 fixtureRef、CP 顺序、seed、cleanup 都在 | 报告 submit 的结果闭集（S-1）；审计链清单（N-1）；L2 报告客户端（N-5） |

## 7 · DESIGN_GAPS（标准侧缺口，本评审不在此造规则）

1. `project-memory/operations/verification-governance.md` 没有 M/S/N 的分级定义，只写了 `DEXTER_OWNS_INTENT_AND_SEVERITY`。本文按上一轮的口径分级：S 表示设计按原样实施会出现真实功能缺陷，N 表示一致性或可维护性问题。该口径需要 Dexter 在正本中确认。
2. 前端规范没有任务阶段状态的颜色与文字标准，PROJECT-REPORT 的状态 Tag 只能由各 feature 自定。
3. terminal standard §4-F 还没有“心跳触发重试”的结果分类条款。S-1 的修正写入详设之后，CP-01 同步正本时应一并写入，避免其他 owner 再复制同一个缺口。

## 8 · 与上一轮及作者 intake 的对账

- 上一轮 S-1 至 S-3（旧 WS ACK、报告范围、保存门槛）均已由 Dexter 裁决和当前字节关闭。旧 TDS 路径只剩文字残留，归入本轮 N-3。
- 上一轮 N 系列中，分钟换算、审计复用、IA §6、UI §5–§7 已补齐。审计链清单仍不完整（本轮 N-1）。
- decision-revision intake 中标为 DEXTER_CONFIRMED/CLOSED_DOC 的六项裁决、任务粒度、启用范围，本轮都在当前字节中逐一找到了落点，与 intake 一致。intake 自述不是独立 verdict，本文不采纳其覆盖声明作为证据。

## 9 · 已核实 / 测试证明 / 无人验证

**静态核实（本轮亲自读取）**：§0 至 §5a 引用的所有文档行，以及以下源码锚点：

- `createCommandDispatcher.ts`、`createCommandActorDispatcher.ts`；
- TDC PONG 处理与 `dispatchBackgroundCommand`；
- `createTransportConnectionOwner.ts:378`；
- `TerminalBindingOwnerPersistence.java:112`；
- `OperationsAuditHistoryController.java:44–63`、`audit-history.paths.json`、audit-read `build.gradle`；
- `terminal-client-generation.json` 的 includeOperationIds；
- seed 中的 store-disabled 与 store-voided。

**测试证明**：无。本轮没有运行任何生成、编译、测试或 verify。

**无人验证**（产品负责人可以据此安排）：

- 右 Tab 实际只显示启用门店下的启用终端，未上报的终端也显示为“尚无报告”；
- 报告 Drawer 中，同一任务更新阶段后历史不增行，两个任务显示为两行；
- 主机断网后报告是否在恢复心跳后补上，以及遇到拒绝时会不会一直重发；
- 操作历史 Modal 能否读出规则的创建、启用、停用；
- 分钟输入保存后读回是否一致；
- Web 与 Android 两端的报告场景结果；
- seed 和 cleanup 的实际效果。

## 10 · 需要 Dexter 回答的问题

1. N-4：报告列表的列顺序“门店名在前”是否为有意安排？是，则记为 §3-I 的具名例外；否，则把终端名放在首列。
2. N-2：终端详情的任务历史是否显示上次绑定的任务（建议显示并标注）？

S-1、N-1、N-3、N-5、N-6 不需要裁决，由设计侧直接修正后复核即可。

## 11 · 授权声明

本文只是静态设计评审。只写了本文件，其余路径均只读。本 verdict 不授权需求、规范或记忆的修订，也不授权源码实施、依赖变更、生成、构建、测试、verify、DEV、设备、reset/seed、L2/UAT、部署或阶段 C。
