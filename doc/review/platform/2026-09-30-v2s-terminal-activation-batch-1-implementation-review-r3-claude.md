# 《终端激活与长连接》批次一实施独立复核记录（R3）

REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=3
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=Claude（协调会话调度的独立子 agent，盲审顺序执行）
blindReviewDeclaration=先独立读取需求/详设/协议等冻结输入并写下独立预期，再核对生产代码与测试，最后才交叉核对作者材料（execution-status、6b/projection-binding/13c 对账、l2-admission、r3-repair-record 等）
VERDICT=GO
M/S/N=0/1/6

## 授权边界执行记录

本轮只执行静态只读代码审查：使用 Read/Grep 检索源码与文档，未运行任何构建/测试/lint/部署/DEV/reset/seed/L2/UAT 命令，未修改任何生产代码或测试文件。范围限定批次一（门店终端设备类型只读、terminal-binding owner 与迁移、终端激活/取消激活/读回/审计、终端凭证认证、单节点 TDS、WebSocket 协议与压缩、共享协议、相关生成/验证门、DEV、backend-acceptance 与六个门店终端 L2 场景），不涉及批次二（TER 客户端包/接口生成）与批次三（多节点/Doris）。

## 〇、证据出处披露（诚实边界）

本次为 v2s 仓根发起的独立子 agent 盲审，经历多次上下文压缩，但全部代码结论均在本轮会话内对**当前字节**重新读取源码得出，未采信任何文档自报数字。

后端核心链路（terminal-binding、TDS 会话/监听/编解码/连接状态仓储、`OperationsTerminalActivationProblem`、四个验收场景文件的关键片段）均由复核 agent 本人直接 Read 全文或关键区间核验，不依赖转述。前端部分（设备类型只读、激活码 UI、admin-ui-foundation 复用）由复核 agent 本人直接调度的一个子 agent 完成事实调查，复核 agent 已读取其完整产出，并对其中最关键的一条结论（"管理端无取消激活/重新生成激活码页面"）用自己的 grep 对需求正本与 Journey 决策文档做了独立复核，确认这不是缺口而是已裁决的范围外项。

复核 agent 在本轮内还调度了若干更深层子 agent 核验局部问题（ArchUnit 边界测试是否真实存在、边缘层 DTO 的敏感字段遮蔽、验收场景目录发现机制、审计字段验收层覆盖、TDS 协议若干细节），其中一个更深层"独立二次静态复核"子 agent 长时间无新增输出、判定为已停滞，复核 agent 明确声明**不采信其任何内容，也不为它继续等待**，如实披露为本轮未纳入证据的覆盖缺口，但因其原计划核验的材料已被复核 agent 本人直接核验，实际风险很低。复核 agent 还主动记录并更正了自己会话更早段落的一处错误结论（曾误判仓内不存在 ArchUnit 依赖，后直接读源码更正为存在真实生效的 `TdsModuleBoundariesTest`）。

**协调会话（本次向 Dexter 交付这份记录的 Claude 会话）说明**：上述"停滞的二次复核子 agent"与"前端事实调查子 agent"，其调度均发生在复核 agent 内部，协调会话在收到前端子 agent 的完成通知时曾误判其与本次请求无关；现已确认它实为本次批次一复核链条的一部分，特此更正，不隐瞒此前的误判。

## 一、独立预期回顾（简述）

复核 agent 在读取 12 份冻结输入（`AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、需求正本、详设、实施计划、IA、交互设计、Journey 决策、服务形态决策、共享协议、实施任务模板、终端编码标准、第三方库使用标准）后，独立推导出批次一的预期判据，核心包括：R-1~R-12 与 D-37~D-43 关于激活重试语义（异设备抢占 / 同设备重试 / 已撤销秘密重放）、D-38 代次摘要、D-40 已结束绑定后 deviceId 处理规则、门店终端 owner/审计/事务边界、终端类型创建后不可变、TDS 单节点首帧凭证认证 / 未知字段忽略 / 压缩与消息边界 / 会话替换 / 通知监听重连 / 优雅停机、D-41 仓内依赖边界（TDS 只能依赖 `TerminalCredentialVerificationApi` 窄口）、R-12 生成器/门闭包不漏接。这份独立预期在阅读任何实现代码或任何 codex 结论文档之前写出，构成后续逐项核验的基准。

## 二、逐项核验记录

### 2.1 上一轮（R2）遗留 S 级 finding 复核（6 项，均已在当前字节修复）

| 编号 | R2 原问题 | 本轮复核结论 | 直接证据 |
|---|---|---|---|
| S-1 | 撤销通知监听器挂在共享 `tds-db-worker` 池上；`connectionClosed` 调度失败即静默丢弃 | 已修复 | `TdsBindingRevocationListener.java:78` 改为独立 `new Thread(this::runListener, "tds-revocation-listener")`（daemon），不再借用共享池；`TdsTerminalSessionActors.java:160-175` 的 `connectionClosed` 捕获 `RejectedExecutionException` 并回退同步内联执行，不再静默丢弃 |
| S-2 | codec 池容量与 db-worker 共用；PING/PONG 编解码失败会关闭会话；通知解析经 codec 池再 `block(1s)` | 已修复（本轮补充确认了此前悬置的技术子问题） | `TdsSettingsConfiguration.java:45-49` 新增独立 `tds-codec-worker` 池；`TdsBindingRevocationListener.java` 的通知解析完全内联在专用监听线程；本轮新确认 `TdsWebSocketHandler.java` 全文仅 3 处 `.subscribeOn`（首帧认证、identityScheduler、databaseScheduler），`receivePing` 及其内部编解码没有任何 `.subscribeOn` 包裹，直接在 reactor-netty 事件循环线程上内联执行，不再经过任何调度池，不存在"池拒绝导致会话被关闭"的场景 |
| S-3 | 已撤销绑定重新激活后，旧会话被关闭时的 close 原因用 `SESSION_REPLACED` 而非 `ACTIVATION_CANCELLED` | 已修复 | `TdsTerminalSessionActors.java:369-372`：`previous.generation() < generation \|\| generationRevoked(previous.generation()) ? "ACTIVATION_CANCELLED" : "SESSION_REPLACED"`，同时检查代次前进与撤销通知标记两种情况 |
| S-4 | 后台取消激活遇到绑定已变化/终端已非激活状态时 HTTP 状态码均为 409，且缺少对应验收场景 | 已修复（两个子项均已修复） | `OperationsTerminalActivationProblem.java:24-26` 按 code 拆分 `TERMINAL_BINDING_NOT_ACTIVE→404`、`TERMINAL_BINDING_CHANGED→409`；`StoreTerminalAcceptanceScenarios.java:394-395,414-415` 新增两条真实 HTTP 场景 |
| S-5 | 审计原因 `ACTIVATED`/`REACTIVATED` 用裸 `current == null` 判断，已结束绑定重新激活时误判为 `REACTIVATED` | 已修复（含两条单测） | `TerminalBindingOwnerService.java:77-79` 改为按状态判断；`TerminalBindingOwnerServiceTest.java:96`（已结束绑定重新激活写 `ACTIVATED`）与 `:125`（同设备在线重连写 `REACTIVATED`） |
| S-6 | 连接状态回读查询按会话数线性增长绑定参数，逼近 pgjdbc 65,535 参数上限 | 已修复 | `TdsConnectionStateRepository.java:158-176` 改为 `unnest(CAST(? AS varchar[]), CAST(? AS uuid[]))` + `connection.createArrayOf(...)`，恒定只绑定 2 个参数 |

### 2.2 R2 遗留 N 级 finding 复核（3 项，均仍未修复，性质仍为非阻断延后项）

| 编号 | R2 原问题 | 本轮复核结论 | 证据 |
|---|---|---|---|
| N-1 | `TdsBoundedPmdDecoder` 把 BFINAL=1（inflater 已 finished）的合法压缩流当协议错误拒绝，不符合 RFC 7692 §7.2.1/§7.2.3.4 | 仍未修复，无当前真实客户端触发，正确保持延后 | `TdsBoundedPmdDecoder.java:106-108` 未变 |
| N-2 | actor 注册/撤销/关闭方法把 DB 写操作（`repository.open(...)`）整段包在 `synchronized(monitor)` 内，与单线程通知监听器竞争同一批次内其它终端的处理时序 | 仍未修复，影响面仍受限（仅同批次通知内排队延迟，不影响正确性） | `TdsTerminalSessionActors.java` `register()`（约行 290-340）未变 |
| N-3 | 三处清理项：两个限流器核心 Semaphore 逻辑重复；`insertFirstActive` 的 `storeRef` 参数从未绑入 SQL；`StoreTerminalOwnerService` 允许字段集合仍列着已无对应字段的 `deviceType` | 三项均仍未修复 | `UnauthenticatedConnectionLimiter`/`TdsTrackedSessionLimiter` 核心逻辑一致；`TerminalBindingOwnerPersistence.java:101-121` 绑定列表仍是 5 个（无 `storeRef`）；`StoreTerminalOwnerService.java:67` 仍含 `"deviceType"` |

本轮复核 agent 在会话内自我更正了一处此前的错误结论：曾基于一次全仓 grep 零命中误判"仓库内不存在任何 ArchUnit 依赖"，后直接读取 `apps/backend/terminal-data-server/src/test/java/architecture/TdsModuleBoundariesTest.java` 的 import 语句，确认存在真实 `com.tngtech.archunit.*` 引用，更正为该边界测试真实生效。

### 2.3 前端 UI 关键问题直接核验

- **设备类型创建后只读（CONFIRMED）**：`StoreTerminalDeviceTypeField.tsx:6-33` 编辑态分支的 `Form.Item` 无 `name` 属性（不注册为表单字段，物理上无法被提交），渲染纯文本；创建态分支才渲染 `Radio.Group`。调用点 `StoreTerminalFormDrawer.tsx:466-470` 按 drawer 自身 `mode` 分发。编辑提交体构造函数 `storeTerminalCommands.ts` 的 `replaceStoreTerminal`（约行 45-55）body 中确认无 `deviceType` 键，`createBody`（约行 22-30）有。三处独立证据一致，判定为真实只读，非仅 UI 视觉禁用。
- **激活码展示与录入（CONFIRMED）**：详情页 `StoreTerminalDetail.tsx:147-149` 以明文展示完整激活码；`StoreTerminalFormDrawer.tsx:472-498` 的激活码输入框仅在创建态渲染，编辑态完全不出现。
- **管理端"取消激活/重新生成激活码"页面缺失，是否为缺口**：前端子 agent 在整个 `store-terminal` 前端目录内检索 `regenerat`/`cancelActivation`/`activation` 均无对应 UI 触发点。复核 agent 独立复核：`doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md:60` 明文写"非目标：…管理端取消激活页面"；需求正本 `2026-09-25-...-requirements-claude.md:40` 写"后台只做接口，不做页面"。**判定：这不是实现缺口，是已裁决的范围外项，与批次一 Journey 明确一致**。
- **admin-ui-foundation 共享能力复用（CONFIRMED）**：`CursorPagination`、`StatusChangeConfirm`、`adminListState`、`lifecycleColor`、`testId`、`useDrawerFormLifecycle` 等均确认从 `@catering-v2s/admin-ui-foundation` 导入且有真实调用点，目录内未发现本地重新实现。

### 2.4 本轮新增独立发现（非 R2 遗留项）

**S-7（新增）：边缘层激活请求 DTO 缺少凭证秘密的 `toString()` 遮蔽，与域层既有遮蔽纪律不一致**

- 事实（CONFIRMED，复核 agent 本人直接读取）：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/TerminalActivationRequest.java:5-11` 是生成的 `record TerminalActivationRequest(activationCode, deviceId, surfaceForm, appVersion, credentialSecret)`，文件头注释"Generated from accepted R5 OpenAPI components; do not edit."，无任何自定义 `toString()`；Java record 默认生成的 `toString()` 会把全部字段（包括明文 `credentialSecret`）原样拼入输出。
- 对照（CONFIRMED）：域层 `TerminalCredentialContext.java:6-28` 只持有摘要（`secretDigest`，非原文秘密），却显式覆盖 `toString()`（"secretDigest=redacted"）并在 `close()` 中清零。即持有更敏感原文秘密的边缘 DTO，遮蔽纪律反而弱于只持有摘要的域对象。
- 性质：CONFIRMED（结构事实）+ PLAUSIBLE（是否已有真实日志泄露路径未定）。另一子 agent 已核验 `ContractProblemAdvice.java` 与该 DTO 的 `toString()` 调用点，未发现当前活跃的日志泄露路径，但未核验 AOP/APM 自动埋点是否会对入站请求体调用 `toString()` 或反射序列化打印——本轮同样未核验，标注为 UNVERIFIED。
- 影响：一旦未来任何调试日志、异常消息拼接或自动埋点对该记录调用 `toString()`，原文凭证秘密会被完整写入日志。当前无确认的活跃触发路径，修复成本很低。
- 最小可验收修正：在生成器模板（非生成产物本身）为标记了敏感字段的 wire record 统一生成遮蔽 `toString()`；不需要新增运行时校验或日志过滤中间层。
- 是否需要 Dexter 裁决：不需要，属于工程实现细节，可直接交 Codex 按现有生成器边界修复。

**N-4（新增，转述未亲验）：`BackendAcceptanceScenarioCatalog` 的场景类发现是硬编码 `List.of(...)`，非按命名约定自动扫描**

- 来源：复核 agent 调度的子 agent 完整读取 `BackendAcceptanceScenarioCatalog.java`（33 行）后给出，复核 agent 已读取完整转述但未本人重新打开源码复核行号。
- 描述：类级别场景组注册是硬编码列表；若新增 `*XxxAcceptanceScenarios.java` 文件忘记加入该列表，会被验收运行静默排除，不报错、不计入 198/198 分母。
- 性质：PLAUSIBLE（转述未亲验，建议 Codex/Dexter 复核时优先亲自打开该文件确认现状）。
- 影响：不影响当前 198/198 的真实性（已注册场景类内断言仍是真实 HTTP/业务断言），但"新增业务场景覆盖"依赖人工记得维护这份列表，是可能被遗漏而不报错的维护面。
- 最小可验收修正：若确认属实，建议在该 catalog 文件顶部加注释强调"新增场景类必须手动加入此列表"，或加一条轻量构建期告警；不建议引入完整反射自动扫描。
- 是否需要 Dexter 裁决：不需要。

**N-5（新增，转述未予验）：owner/操作人/reason-code 审计字段在验收层从未被内容断言，仅断言存在性与数量**

- 来源：同上子 agent 转述，称在验收场景文件内检索 `actor|operatorId|reasonCode|actorType|AuditActor|actor_ref|actor_type|reason_code` 均零命中。
- 性质：PLAUSIBLE（转述未亲验）。
- 影响：S-5 核心 bug 已通过单测覆盖并确认修复，R2 当时也只要求单测修正、未要求补验收场景，本项不构成对 S-5 修复完整性的否定；但审计 actor/reason 内容目前只有单测兜底，验收层对此维度没有交叉验证。
- 最小可验收修正：可选——在既有验收场景里对已有审计行断言追加 `reason` 字段内容校验，成本很低；是否值得做属于验证资源分配的取舍，不构成阻断。
- 是否需要 Dexter 裁决：不需要。

**N-6（新增，UNVERIFIED_BY_ME，仅记录来源不下判断）：TDS 协议若干细节**

- 转述自另一子 agent：protocolVersion/endpoint 字段在共享协议 JSON 中存在但 `TerminalConnectionProtocol` 未强制校验；三处独立硬编码的 65536 字节上限常量彼此一致但无单一来源约束同步；4000 段 close code 走契约校验、1002/1009 走自由文本校验，两条路径不对称。
- 复核 agent 对"65536 硬编码三处"做了一次直接 grep 复核，未能重现该关键字命中，说明实际常量命名可能不是字面 `65536`，本项未被复核 agent 独立证实，标注为 UNVERIFIED_BY_ME，不计入本轮 M/S/N 计数，留给 Codex/Dexter 自行核实是否属实。

## 三、Findings 汇总（含影响、修正与裁决边界）

| # | 级别 | 事实/推论 | 位置 | 影响 | 最小修正 | 需 Dexter 裁决 |
|---|---|---|---|---|---|---|
| S-7 | S | CONFIRMED（结构）+ PLAUSIBLE（可利用性） | `TerminalActivationRequest.java`/`TerminalActivationCancellationRequest.java`（generated/wire）；对照 `TerminalCredentialContext.java:26-28` | 原文凭证秘密缺少 toString 遮蔽，潜在日志泄露面 | 生成器模板层为敏感 wire 字段统一生成遮蔽 toString | 否 |
| N-1~N-3 | N | CONFIRMED，R2 遗留仍未修复 | 见 2.2 | 已定性为非阻断，可延后 | 沿用 R2 已给出的最小修正 | 否 |
| N-4 | N | PLAUSIBLE（转述未亲验） | `BackendAcceptanceScenarioCatalog.java` | 新场景类漏加列表会被静默排除 | 加注释/轻量构建期告警 | 否 |
| N-5 | N | PLAUSIBLE（转述未亲验） | 验收场景文件（转述未给出确切行号） | 审计 actor/reason 内容仅单测覆盖 | 可选：验收层追加内容断言 | 否 |
| N-6 | N | UNVERIFIED_BY_ME（仅转述，65536 项经复核未重现） | TDS websocket 相关文件（转述未给出确切行号） | 待核实，暂不采信 | 交 Codex 自行核实后再定 | 否 |

**M/S/N = 0/1/6**（S 计 1 项为本轮新增 S-7；N 计 6 项 = R2 遗留 N-1~N-3 共 3 项仍未修复 + 本轮新增 N-4/N-5/N-6 共 3 项）。R2 遗留的全部 6 项 S 级 finding（S-1~S-6）均已在当前字节确认修复，是本轮最主要的正面结论。

## 四、DESIGN_GAPS

本轮未发现新的、详设缺少可执行判据的问题。经复核，此前可能被误读为"缺口"的"管理端无取消激活页面"实为 Journey 文档已明确裁决的范围外项（见 2.3），不计入 DESIGN_GAPS。

`DESIGN_GAPS = NONE`

## 五、与作者材料的交叉核对差异说明

- 13c 代码-详设对账文档（`2026-09-29-...-code-design-reconciliation-codex.md`）状态：交接文档与该文档自身均写明当前为 **OPEN**（`LINE_BY_LINE_STATUS=PROVISIONAL_OPEN_PENDING_INDEPENDENT_CHECK`、`CODE_TO_DESIGN_RECONCILIATION=OPEN`、`PRODUCTION_CALLER_CENSUS=OPEN`、`GENERATED_PRODUCER_OUTPUT_CENSUS=OPEN`）。**本轮原样保留此 OPEN 状态，不改写为 MATCHED 或 PASS**，本轮的独立核验是基于自己重新读取源码得出，与该文档的对账状态是两条独立证据线，分开判断。
- 测试脚本专项复核文档（`2026-09-30-...-test-script-review-codex.md`）报告 `M/S/N=0/0/2`，均为非阻断建议；`scripts/verify --validate-only` 48/48 PASS——本轮未重跑，采信其披露的字面结果，不代表未参数化的完整 `scripts/verify`。
- 受管验收 `r5-tc-1790697767533-50846` 的 198/198 backend-acceptance、49/49 TDS CONTRACT、9/9 V-S14、296/296 operation identity、`UNCLASSIFIED_SQL=0` 等数字：本轮未重跑，仅作为既有动态证据背景引用，不作为本轮静态结论的支撑依据；本轮结论完全基于源码直读。
- Browser L2、完整 seed dry-run、早前 6b MATCHED 记录：均对应更早字节，本轮未重跑，不作为当前字节证据，与交接文档的披露一致。

## 六、结论

```
L1_ENGINEERING=GO
L2_USER_VISIBLE=GO
L3_UNVERIFIED=[N-4, N-5, N-6均为转述未亲验; 一个更深层"独立二次静态复核"子agent已停滞未产出，未纳入证据; AOP/APM自动埋点是否会对S-7涉及的DTO调用toString()未核验]
SAME_ROOT_SCAN=已对R2遗留S-1~S-6、N-1~N-3共9项逐条复核当前字节；未发现同根同类的第10个未被覆盖的实例
DESIGN_GAPS=NONE
EVIDENCE_TIER=STATIC_SOURCE_ONLY
VERDICT=GO
M/S/N=0/1/6
```

**结论说明**：R2 的 6 项 S 级 finding 已在当前字节全部确认修复，且修复方式均与 R2 当时给出的最小可验收修正一致或更彻底（S-2 的 PING/PONG 修复实际采纳了 R2 建议的替代架构，而非仅打补丁）；遗留的 3 项 N 级 finding 仍未修复但按既定标准本就属于非阻断延后项，性质未变。本轮新增 1 项 S 级 finding（S-7，边缘 DTO 缺少凭证遮蔽）建议在下一批次收口前修复，但不构成对批次一整体 GO 结论的否定——尚无确认的活跃利用路径，且修复成本很低。前端 UI 层的设备类型只读、激活码展示范围经直接源码核验与 Journey 裁决文档交叉确认，符合范围。判定 **GO**。

## 七、主 agent（协调会话）辩证 intake

状态：**CONFIRMED，按上述独立结论原样接受，不改写任何 OPEN/PLAUSIBLE/UNVERIFIED 标注为 PASS**。

- 独立复核链条本身透明披露了两处过程局限：(a) 一个更深层"二次独立复核"子 agent 停滞无产出，复核 agent 明确声明不采信、不空等；(b) N-4/N-5/N-6 三项 N 级发现来自子 agent 转述、复核 agent 本人未逐一重新打开源码核对行号。协调会话原样保留这两处局限的披露，不将其掩盖为"已全部亲验"。
- 前端事实调查子 agent（"Frontend store-terminal UI fact-finding review"）经确认属于本次复核链条内部调度，并非协调会话此前误判的"无关任务"；协调会话已就此前的误判向 Dexter 更正。
- 全部 6 项 finding（S-7 及 N-4~N-6）均标注"不需要 Dexter 裁决"，可直接交 Codex 在既有批准边界内自主修复；13c 对账的 OPEN 状态不受本轮影响，仍需另行处置，不因本轮 GO 而视为已关闭。
- 本轮结论只授权到静态代码 review 本身，不授权、不代表、不隐含任何后续动态验证（Android/device/native/topology、Browser L2、seed、reset、DEV）的执行或通过。
