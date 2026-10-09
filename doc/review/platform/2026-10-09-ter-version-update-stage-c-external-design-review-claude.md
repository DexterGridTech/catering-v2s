# TER 版本定义、完整更新与热更新：阶段 C 完整设计包外部独立静态评审（Claude）

## 0 · 结论块（review-standard §1 动作 5）

```text
REVIEW_TARGET=DESIGN（阶段C六份工件当前字节）
ACTION_1_VARIANT=1-B（设计文档提取＋owning source静态读回）
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/5
L1_ENGINEERING=STATIC_ONLY：设计↔源码锚点读回一致，无生成/编译/测试/verify
L2_USER_VISIBLE=NOT_RUN：本机安装邀请、焦点/admin优先、双屏/双机呈现均无运行证据；IA内容已获Dexter确认
L3_UNVERIFIED=非空（§8），故只能 GO_WITH_UNVERIFIED_UI
SAME_ROOT_SCAN=逐条见各 finding 的“同根”
DESIGN_GAPS=3（§7）
TEMPLATE_COVERAGE=§6
EVIDENCE_TIER=STATIC_DOC_AND_SOURCE_READBACK
reviewerKind=EXTERNAL_CLAUDE
```

5 条 N 都是简化或一致性问题，不会在按原文实施后产生功能缺陷，所以不阻断 GO。建议在 CP-01 开工前改文档关闭，其中 N-3 需要 Dexter 一句话裁决。

本文只做静态评审。A、B 最终出口仍然 OPEN。C 的实现、生成、编译、测试、verify、Web、设备、DEV、pair、cleanup 全部 NOT_RUN。本文不把任何计划或静态事实写成 PASS。

## 1 · 会话来源与独立性

本会话 **不是 fresh**。它是压缩续接的会话，之前做过阶段 B 的两轮外部评审。本会话没有起草阶段 C 的任何工件，也没有写 C 的 R1 至 R4 评审。

阅读顺序如下：先读需求、A/B 设计、C 六份工件和 owning source，形成全部候选 finding；之后才读 R3、R4、intake，以及 R1 S-03 的原文，用于 §9 的对账。

本轮没有读取 `.runtime/`。

## 2 · 评审字节

| 工件 | SHA-256 |
| --- | --- |
| Journey `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md` | 0ed55be74354f05bcbae9ae5691f368822c017b98bfb7f585b12c635cd55ad05 |
| IA `…-ia-claude.md` | 167c08d0752028513a836a453ddbeae721e34862983865357b36665fb8ae360b |
| UI `…-ui-interaction-claude.md` | 115ab84603d6f628aceecde16a61de114ad12aad9cf70d970cc682e06cc5b4ef |
| 详设 `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md` | 15f790d1901a06f28e3e1a5e4cadb223bd0e203996b167332740fd1056a19fe1 |
| 计划 `…-implementation-plan-claude.md` | 09674c2a8359263c17b65b1e7a6c9e1ed3a642f5df28051af541c95dda3597f6 |
| 附件 `…-source-and-api-appendix-claude.md` | 90260a49a8290533f14fa0d5c18d120333beccc23a2add06fae85498d62dfb7e |

这六份与 R4 §9 的最终交付 SHA 一致。

上游输入方面，正式需求 SHA 为 fd8813d2…，A 详设为 8b8b98b6…。B 详设在本轮读取期间发生变化：开始时是 d9c46725…，结束时是 739c4280…，B 计划结束时是 c4922f6b…。这说明 B 正在被并行修改。本文对 B 的引用只作为当前截面，与 C 详设 §0.1 的 B_*_OPEN 口径一致。

## 3 · 方案合理性

**总体判断：方案对路，规模基本克制。** C 只在 A 的固定任务核、B 的规则、grant 和报告上增加以下几样东西：

- 选择函数；
- 固定 N/M；
- Runtime 本机点击事实；
- 单 deadline timer；
- presentation 技术桥；
- 同 slice 的规则 record 投影；
- compact grant；
- 一个本机邀请。

它没有新造 scheduler、队列、账本、协议版本、跨 App 矩阵或恢复框架。第二调度器和 React effect 驱动两条路线被正确拒绝（详设 §1）。

以下判断都已对照源码确认：

1. **S3 纯确认不占执行名额：成立。** `terminalUpdateActor.ts:900–911` 只在 `task.bootId !== actual.bootId` 时释放终态任务。但 `:1006` 在 action succeeded 时把 bootId 覆写成确认时的 boot，`:710` 同样覆写。结果是 S3 确认完 HOT 后，任务要到 S4 才释放。详设 §8.2 L167 准确识别了这一点，并把“执行 boot”与“确认 boot”分开，方向正确。字段落法见 N-4。
2. **FULL 单 APK 与 HOT 清单分源：成立。**
   - `TerminalUpdateArtifactPreparer.kt:267–301` 中，`extractFull` 要求 ZIP 只含一个 APK，且 APK 的 path/sha256 来自 artifact JSON 的 `apk` 字段；`:304–322` 中，`validateFull` 再核 package、版本和签名。
   - `:172–240` 中，`extractHot` 读取 ZIP 内的 `terminal-update-publication.json`。
   - 所以 FULL 需要通过 summary 携带 `apk{path,sha256,certificateSha256}`，HOT 从 ZIP 自身清单取 files，这个分源判断正确。多出的 APK 内嵌元数据核对见 N-1。
3. **known pending-user 恢复同 session、零 commit：可行。**
   - `TerminalUpdateRuntime.kt:438–449` 在 PENDING_USER_ACTION 时持久化确切的确认 Intent URI。
   - `:500–599` 的 `resumePendingInstallerConfirmation` 只 `startActivity` 原 Intent，不调用 `commit`，并且有 session committed/sealed 和 sessionId 匹配校验。
   - 现有恢复只覆盖“从来源设置页返回”这一种情况（`TerminalUpdateInstallerPolicy.kt:63–75` 要求 `awaitingSourcePermission`）。C 把它推广到 owner 的 N 再邀请，并把 native 前台自主呈现收归 owner 调度，消除了双源调度。
   - 用户取消（ABORTED）时 preparedId 保留，因为 `terminalUpdateActor.ts:995–1005` 只在 succeeded/failed 时释放。所以“结束未安装→用户确认→同工件新 action”有现成基础。
4. **本机 PRIMARY 邀请与 admin 优先级：可行。**
   - `LayerStack.tsx:124–137` 中，SLAVE/VICE 只合并 MAIN 业务层和本地 admin 层，确实需要一个有限的 local-primary scope。
   - `:273–275` 的渲染顺序是业务层→遮罩→admin。C 把本机 alert 移到遮罩之上、admin 之下，这是一处明确的 render 增量，已写入 CP-05。
   - `workspaceSlices.ts:283–285` 的 `serializeLayer` 对 ephemeral 返回 undefined，持久化与 `serializeContentSyncEntries`（`:321–330`）都走它，所以 ephemeral 邀请既不落盘也不同步。
5. **规则投影与本地 task 隔离：可行。** update slice 当前是 `syncIntent:'isolated'`（`terminalUpdate.ts:73`）。master-to-slave 的 record sync 有现成先例：store-basic、server-config、TDC status projection。只导出 rule entry、`applyEntries` 只改该 entry 的设计与现有 record 机制相符。
6. **同父 run 供给链：与 B 现行合同一致。**
   - B 详设 §15.2a L511–523 规定：在同一父 run 内，后台 DOM 由 Playwright 操作，TER React 控件由 agent 操作；browser/context 由 run 自有；DEV 的 Vite/tunnel 只借用。
   - `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts:145–293` 自行 `chromium.launch`/`newContext`/`close`。
   - `runner.ts:140–146,474–477` 限定 supply-chain 只在 android+dual 下运行。
   - C 详设 §3a L103 与之一致。
7. **PROJECT 权限与 seed：成立。**
   - seed 契约中，`role-group` 含 `MANAGE_PROJECT_TERMINAL_VERSION` 和页面 `PG-PROJECT-TERMINAL-VERSION-RULES`。`asg-multi-group` 是 account-multi-role 在 cg-aurora 上的 GROUP 任职。`role-project` 有页面但无写 cap，由 `scripts/dev/r5-fixture-contract.mjs:202–209` 强制。
   - `term-front` 是 laptop/ENABLED，`term-handheld` 是 mobile/ENABLED，都属于 store-operating。
   - 我额外核了一个风险：上线后，DEV 中 seed 已启用的规则会不会被普通终端自动执行？结论是不会。seed 工件来自 update.artifacts run，构建时带 run 级 applicationId 后缀（`journeys/update.test.ts:146–155`、`scripts/build/terminal-update-artifact.mjs:312–338`），不会匹配其他 run 或真实包名。

**请 Dexter 知悉一个已接受的后果。** 正式需求 R-10 规定，有限下载重试耗尽即进入失败终态，并把工件记入 failedArtifact（`terminalUpdateActor.ts:803–810`）。C 选择“只取最新一条，不回退次新”。两者叠加后，门店网络的一次持续抖动就可能让这条最新规则在该机上永久不可执行，只能由运营上传新 publication 再建规则。这是需求已确认的语义，不是本设计的缺陷。C 已经用 ADMISSION_REJECTED/FAILED_ARTIFACT 把这种情况报到运营右 Tab，可见性足够。

## 4 · Findings

### N-1 · FULL 副机路径额外读取 APK 内嵌 publication 元数据，属于冗余的新解析分支（CONFIRMED，可简化）

**位置**

- 详设 §8.6 L215：“再从已校验 APK 的既有 `assets/terminal-update-publication.json` 读取有界发布 metadata…”。
- 计划 CP-04 L69。
- 附件 §4 第 4 条（L54）。

**事实**

- 主机现有 FULL 路径不读 APK 内嵌元数据。`validateFull`（`TerminalUpdateArtifactPreparer.kt:304–322`）只核 package、native build/version、签名和 APK sha256。
- 内嵌元数据目前只在已安装后的 boot 读取（`TerminalUpdateRuntime.kt:1079` `readPublicationMetadata` 读的是已安装包的 assets）。
- 副机路径中，ZIP sha256 来自固定任务（CBS→MAIN 投影），APK sha256 来自 summary.apk。外层和内层都已被 CBS 侧身份钉死。

**推论**：再解开未安装 APK 去读 assets JSON，不会增加信任，反而要在 Kotlin 中新写一段“从 APK 文件取 zip entry→JSON 校验”的代码。附件 §4 自述“不加 parser”，这与它相矛盾。

**反例**：实施者照写这段代码，会让主机和副机的 FULL 校验逻辑分叉，多出一个 focused 测试面。真实错误包的情况（CBS 上传时已解析）则不会被它额外拦下。

**最小修正**：

- FULL 的 summary 只用来重建现有 `extractFull/validateFull` 所需的 artifact JSON 字段：`platform/applicationId/nativeVersion/nativeBuildNumber/apk`，主机和副机走同一校验；
- 删除 L215 的“再从…读取”半句，以及计划 L69、附件 L54 对应的半句；
- HOT 分支保持不变。

**同根**：trusted summary 有 3 处消费者（副机 FULL、副机 HOT、主机“可复用”）。只有 FULL 这一处增加了冗余步骤，其余已逐一检查。

**需 Dexter 裁决**：否。

### N-2 · update.pair 写了 Expo Web 阶段，但 Web 没有拓扑主机；同时把未改动的“不同 App 拒绝”放进设备分母（CONFIRMED）

**位置**

- 详设 §11 L316：update.pair “F→W模拟shared清单→D/P＋H”。
- 计划 §10.2 L109：“非adapter…投影逻辑先两integration ExpoWeb”。
- 计划 §10.5 L112：设备上测“不同App拒绝”。
- 详设 §3a L101 的控制面全集只有 `update.pair.android.test.ts`，没有 Web pair suite。

**事实**

- Web 平台的 `topologyHost` 是 `unavailableTopologyHostPort`（`apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts:147`）。
- 拓扑服务端只存在于 Android（`application/base/android/.../TerminalTopologyServer.kt`）。
- 现有 automation 也没有任何 Web pair journey。

**推论**

- 双机投影的被测行为依赖真实拓扑承载，按 TR-16 第二段属于“依赖这类能力的被测行为可以直接在设备上验证”。
- 计划 L109 要求先在 Web 验证，这在仓内无法执行。实施者只能二选一：新造一个 Web 拓扑模拟（过度设计），或者在执行时违背计划。
- “不同 App 拒绝”依赖 HELLO/pairByHost 现有的 moduleName 相等检查，详设 §8.7 明确不改它。在设备上重测，属于重跑与本批无关的旧验证。

**最小修正**：

- update.pair 改为 F（双 runtime 下的 codec 与投影 apply focused）→D/P＋H，写明这是 TR-16 的 adapter 例外；
- 计划 L109 的“投影逻辑”移出 Web 列表；
- “不同 App 拒绝”改为静态读回加既有 focused，说明这段源码未变，不进入设备分母。

**同根**：其余 9 个场景的 W 阶段已逐一核对。auto-selection、fixed、idle、install-reminder（策略部分）、full-hot（非 native 部分）、report（F）都不依赖拓扑，W 可执行。grant 写的是 F/codec＋H＋D，没有 W，也正确。只有 pair 有此问题。

**需 Dexter 裁决**：否。

### N-3 · 设备矩阵大于覆盖所需（CONFIRMED，DEXTER_DECISION）

**位置**：计划 §10.5 L112：“mobile及laptop单机双屏分别两App；pair两个App各自sameApp…”。按此计算，单机需要 4 次真实安装 run，pair 需要 2 组双设备 run。

**事实**

- C 的单机逻辑全部在共享 kernel/ui-base：update owner、Runtime 点击、render local-primary、邀请组件。两个 App 只在 composition reader 上有差异（§9a 第 3 组）。
- 邀请布局只有 mobile/laptop 两种响应式形态。
- 正式需求 §20 的要求是“每阶段包含其两个App”，没有要求 App 与形态逐格交叉。

**最小修正**：单机设备改为交叉覆盖，例如 console 跑 laptop 双屏（覆盖双屏共享点击、只在 PRIMARY 邀请），wallpaper 跑 mobile（覆盖窄屏邀请）。两个 App 的 composition 和两种形态各被真实执行一次。pair 保留每个 App 一组。

**影响**：可以省下两次 FULL→HOT 真机全链。按 B 的经验，一次约需数十分钟到小时级。

**需 Dexter 裁决**：是。只需回答一句：接受交叉覆盖，还是坚持 2×2。

### N-4 · executionBootId 应改写现有 bootId 的语义，而不是并列新增一个字段（CONFIRMED，可简化）

**位置**

- 详设 §6 L127：“executionBootId | currentTask 内执行事实”。
- 详设 §8.2 L167：“沿 A currentTask…task 保存 executionBootId”。
- 计划 CP-03 L50。

**事实**

- `TerminalUpdateTask` 已有 `bootId`（`types/terminalUpdate.ts:51`），并且已经是 A 用来释放任务的唯一依据（`terminalUpdateActor.ts:900–905`）。
- 它在首次执行前写入（`:673–677`），在 FULL→HOT 衔接时更新为 S2（`:969`）。这两处已经符合“执行 boot”的语义。
- 只有 `:710`（target 已达到）和 `:1006`（action succeeded）把它覆写成确认 boot。

**推论**：如果并列新增 executionBootId，task 上就会有两个 boot 事实。这违反详设 §3 “同一事实只有一个住址”，还要为既存 durable task 回填新字段。

**最小修正**：

- 在 §6 和 §8.2 写明“现有 `bootId` 即执行 boot”；
- 删除 `:710` 和 `:1006` 的确认时覆写；
- 在每次本 boot 首次 prepare/apply 前，如果 bootId 不等于当前 boot，先更新并 flush；
- 释放判定沿用 `:900–905`；
- 不新增字段，不需要迁移。

**同根**：bootId 的全部写点已逐一检查（`:677/:710/:969/:1006`、`:1194` 置 null）。读点有 `:673/:904`。`:1019/:1084` 用的是 actual.bootId 或 bootToken，与此无关。

**需 Dexter 裁决**：否。

### N-5 · 报告新增状态和原因值依赖 B 尚未落地的持久化形状，但 C 断言“无新 Flyway”（PARTIALLY_CONFIRMED）

**位置**

- 详设 §8.8 L237：新增 WAITING_IDLE、ADMISSION_REJECTED 两个状态，以及 INCOMPATIBLE/WOULD_DOWNGRADE/FAILED_ARTIFACT 三个原因，无任务的拒绝按 taskId=null 上报。
- 详设 §5 L118 和 §10 L273：“不新建…迁移”“无新Flyway”。

**事实**

- 当前 canonical 的 `TerminalUpdateReportRecent.state/reason` 闭集（`contracts/openapi-source/terminal-update.schemas.json:1066–1093`）确实没有上述 5 个值。
- B 的 `terminal_report` 迁移在仓内尚不存在（详设 §0.1 B_REPORT_OPEN）。B 设计（B 详设 L389）只说明“唯一 Flyway 新增…terminal_report”，没有说明 state/reason 列是自由文本还是 CHECK/enum。
- B 附件 L535 只规定“taskId 非 null 必须与 recent/task 关联”，没有写 taskId=null 时是否允许 recent 非空。

**反例**：如果 B 最终用 CHECK 约束 state/reason，或者拒绝“taskId=null 且 recent 非空”的组合，那么 C 的 ADMISSION_REJECTED 观察上报会在 CBS 返回 422/500，运营右 Tab 看不到准入拒绝的原因。

**最小修正**：在 CP-01 准入（计划 §1 第 3 条）增加一项：读回 B 最终的 terminal_report 列形状，以及 taskId=null 时 recent 的合法性。处理方式二选一：

- 优先：把这 5 个值并入 B 出口前的同一 canonical/Flyway；
- 或者：C 列出一条具名 Flyway。

同时删除或条件化“无新Flyway”的绝对表述。

**需 Dexter 裁决**：否。这些值属于 C 的需求承接，只是落点在 B 和 C 之间需要协调。

## 5 · 重点核验项逐条结论

| 项 | 结论 |
| --- | --- |
| S3 纯确认不占本 boot 名额 | 方向正确，源码依据充分；字段落法按 N-4 简化 |
| FULL 单 APK 与 HOT 清单分源 | 正确；FULL 冗余步骤见 N-1 |
| known pending-user 同 session 零 commit | 可行，复用持久化的确切 Intent；native 前台自主呈现收归 owner，消除双源调度 |
| 本机 PRIMARY 邀请、admin 优先、规则投影与 task 隔离 | 可行；render 遮罩次序和 local-primary 是明确增量，ephemeral 不持久也不同步已证 |
| 同父 run、Playwright 与 agent 职责、owned/borrowed 资源 | 与 B §15.2a 及 SupplyUi/runner 源码一致 |
| CP→6b→Web→同场景设备→13c，PROJECT 权限、seed、cleanup | 顺序明确（详设 §2 L58、计划 §9–11）；权限与 seed 已证；pair 的 Web 阶段见 N-2，设备分母见 N-3 |
| 不同 App 不配对、同 App 独立升级 | 保留 moduleName/protocol 检查，没有新增矩阵；规则投影不覆盖本机 task/actual/click |
| MAIN-only HTTP 报告 | TDC submit 有 MASTER/active 门，副机不代报；新增枚举的落点见 N-5 |

## 6 · TEMPLATE_COVERAGE

| 模板 | 工件 | 覆盖 |
| --- | --- | --- |
| journey-decision-template | Journey | 元数据、任务全旅途、三类前提来源、边界与禁推、corpus、UI 适用、裁决：有 |
| ia-design-template | IA | 可见 9 维、不可见 5 维、权限与资源、状态、跨文档、完成块：有 |
| ui-interaction-design-template | UI | canonical 字段、§3-K 对照（N/A 附理由）、查询 N/A、交互地图、资产、线框、状态、控件与焦点、成功链、逐操作合理性、隐藏事实矩阵：有 |
| implementation-design-template | 详设、计划、附件 | §3 固定行、§3a 控制面、§4 门控、§5 face、§6 事实、§7 矩阵、§8 行为、§9/9a 原子组、§10/10b 数据与 seed、§11/11a 场景与 R/V、§12 OPEN、§13/13c：有；pair 执行面见 N-2 |

## 7 · DESIGN_GAPS（交设计侧补正本，本文不立规则）

1. `project-memory/operations/verification-governance.md` 仍然没有 M/S/N 的定义。本文按以下口径分级：S 表示按原文实施会产生真实功能缺陷，N 表示简化或一致性问题、不阻断。这个口径需要 Dexter 在正本中确认。
2. TR-16（`terminal-coding-standard.md` L673 起）列举的 adapter 能力只有 device、dual-screen 和 persist-kv，没有写拓扑主机（application/base/android 原生服务端）。N-2 就是由这个歧义引出的，建议正本补一句。
3. 详设 §10 L275 的“规则投影是否独立 descriptor”留给实施时测试后再定。当前默认复用同一 slice，这是合理的；但正本里没有“record 投影与 owner-only 持久化共存于同一 slice”的判据，以后同类 owner 会再问一次。

## 8 · 已核实、测试已证、无人验证

**静态已证（本轮亲自读取）**：§3 与 §4 引用的全部源码行，包括：

- `terminalUpdateActor.ts`、`types/terminalUpdate.ts`；
- `TerminalUpdateArtifactPreparer.kt`、`TerminalUpdateRuntime.kt`、`TerminalUpdateInstallerPolicy.kt`；
- `LayerStack.tsx`、`workspaceSlices.ts`、update slice 注册与 master-to-slave 先例；
- `webPlatform.ts` 的 topologyHost；
- runner、managedRun、SupplyUi；
- seed 契约、`r5-fixture-contract.mjs`、seed 工件来源与后缀；
- canonical 报告枚举；`PrimitiveInlineAlert` 与 `baseTokens.containerCard` 存在。

**测试已证**：无。

**无人验证**（产品负责人可以据此安排）：

- 安装邀请在手机和双屏 laptop 上的实际样子、焦点和按钮，以及本机 admin 是否始终在最上层；
- 店员在任一屏点击后，HOT 是否真的按 M 分钟无操作后才更新；点击是否被吞掉；
- FULL 点“稍后”后，是否 N 分钟后再次邀请；从设置页或系统确认返回后，是否恢复原确认而不重复安装；
- FULL→重启→HOT→重启后，新规则能否在第三次启动时被选中；
- 同 App 两台机器版本不同时，是否各自升级、互不覆盖，副机不出现在运营报告里；
- 运营右 Tab 能否看到“等待闲时”“准入拒绝”等新状态；
- Web 与 Android 的同清单对照、双机 pair，以及全部 run 资源与 DEV 借用资源的清理。

## 9 · 与 R3/R4/intake 对账（独立判断形成之后）

- R3 的 S-01（父 run 与 browser 归属）在当前字节中已关闭，我的 §3 第 6 条独立得到相同结论。
- R4 的 GO_WITH_UNVERIFIED_UI 0/0/0 与我的 verdict 档位相同。差异在于我多出 5 条 N：
  - N-1 和 N-4 是 R1 S-03 和 S-01 修正时引入或保留的冗余；R1 S-03 原文的最小修正并没有要求核对 APK 内嵌元数据。
  - N-2 来自 Web 平台拓扑主机不可用这一源码事实，R4 的反例表没有覆盖 TR-16 在 pair 上的可执行性。
  - N-3 和 N-5 是按“只做主流程”的成本口径，以及 B 当前截面得出的。
- intake 的作者处置不作为证据。本文不继承它的 CLOSED 声明。

## 10 · 授权声明

本文只是静态设计评审。只新写了本文件，其余路径均只读。本 verdict 不授权需求、规范或记忆的修订，也不授权源码、依赖、实施、生成、构建、测试、verify、DEV、reset/seed、Web/设备、L2、UAT 或部署。
