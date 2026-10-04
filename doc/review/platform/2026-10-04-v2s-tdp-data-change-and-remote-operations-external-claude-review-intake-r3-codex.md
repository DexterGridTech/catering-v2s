# TDP 数据变化通知与远程运维 · Claude 外部复评 Intake R3

```text
DOC_KIND=REVIEW_INTAKE
DATE=2026-10-04
AUTHOR=Codex
REVIEW_TARGET=DESIGN
SOURCE_REVIEW=Dexter-relayed Claude external review findings in the current user message
INDEPENDENT_VERDICT=NOT_PRODUCED
```

## 结论边界

Claude 转交结论为 `NO-GO, M/S/N=0/4/2`。这是 Claude 对其审阅字节的独立结论。本记录是主 agent 对六条 finding 的独立 intake 与获准范围内的文档修订，不是新的 DESIGN verdict，不重开已关闭的内部 cycle，也不抹去历史 verdict。

六条均确认存在文档或设计闭合缺口。S-1～S-4 及 N-1～N-2 已修订当前详设、计划；没有修改正式需求、生产源码、测试、依赖或生成物。未执行生成、编译、构建、测试、verify、DEV、reset/seed 或其他动态运行。修订后的设计包仍须 Dexter 与 Claude 外部复评；当前不声称 GO。

## Finding dispositions

### S-1｜TDS 独立数据库账户权限与阶段依赖

- **分类：`CONFIRMED`（设计闭包缺失；运行时权限未验证）。**
- **评审位置 / 当前文档落点：** 修订详设 §2:49-56、§5.1a:149-162、CP-03:95-98；修订计划 CP-03:50-54、步骤4:91。
- **仓内事实：** `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/state/TdsConnectionStateRepository.java:24-56,59-67` 使用自有 `terminal_connection.session_sequence`、向 `terminal_connection.latest_state` 开启/覆盖 session 并更新 heartbeat；`:69-` 还有断开状态写入。详设旧权限说明只覆盖 owner snapshot 和 terminal-control SQL command，未把 TDS 自有 session 表/sequence 权限及认证读取列按对象闭合。正式需求 `doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:342-346` 要求精确 topic 读取权威实体原始时间；原 snapshot 只能服务集合 topic。计划又把 terminal-control command 的 `EXECUTE` 放在 CP-03 验证，而其对象实际由 CP-06 创建。
- **推论与边界：** 只授权两张 snapshot `SELECT` 和尚未创建的 claim/report 函数不足以支持认证、session 状态维护与八类精确 topic 读取；将 TDS 改用 CBS 账号虽可绕过缺权，却违反独立 principal 的权限边界。尚无权限运行结果，不能断言部署必然失败。
- **最小修正/当前落点：** 详设 §5.1a 与 CP-03、计划 CP-03/阶段步骤现分别规定：认证与当前 binding 仅授实际 SQL 所需列的 `SELECT`；TDS 自有 sequence 仅 `USAGE`、自有 `latest_state` 仅 `SELECT/INSERT/UPDATE`；两张 collection snapshot 仅 `SELECT`；八类精确时间通过 CP-02 由 organization、store-contract 各自提供的窄 `read_terminal_topic_time(...)` owner SQL 函数读取，TDS 仅 `EXECUTE`。函数按 `SECURITY DEFINER`、固定安全 `search_path`、撤销 PUBLIC 执行限定，且只返回原始时间或 typed missing/denied，不读业务正文。terminal-control 记录表禁止 TDS 直接 `SELECT/INSERT/UPDATE/DELETE`；具名 claim/report 函数仅在 CP-06 创建后授予并验证 `EXECUTE`。两个独立 principal 分别用于 DEV 与 acceptance，不回落 CBS 账户。实施验证区分允许读取/写入的正例与未授权 direct access 拒绝反例。
- **证据位置：** 修订详设 §2、§5.1a、CP-02/CP-03，修订计划 CP-03 与步骤4；仓内实现证据见上列 `TdsConnectionStateRepository`。
- **更小替代：** 继续共用 CBS 账号可少建角色，但无法验证或执行最小权限承诺，因此不采纳。新增权限矩阵和两个 owner 窄查询入口已是满足当前读取职责的最小闭合形态；不增加 CBS HTTP、第二数据副本或 TDS owner-table 写入。
- **剩余 OPEN：** 角色创建、列级 grant、函数签名/权限以及远端 DEV/acceptance 正反权限验证均未实施、未运行；实际解析 PostgreSQL/JDBC 版本及官方依据仍按未来 CP 记录，当前不得标 PASS。
- **Dexter 产品裁决：** 不需要；若实施发现必须开放 owner 表写权限或改变业务读取语义，再报告。

### S-2｜八个 terminal GET 的凭证输入与错误契约

- **分类：`CONFIRMED`（设计缺口）。**
- **评审位置 / 当前文档落点：** 修订详设 §5.1:132-147、CP-01:95-96；修订计划 CP-01:29-37。
- **仓内事实：** `apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/api/TerminalCredentialParser.java:25-34` 从序列化凭证解析 generation 与 secret digest；同模块 `TerminalCredentialVerificationApi.java:21-29` 的 `Credential` 同时要求 `groupWorkspaceKey`、`terminalRef`、`generation`、`secretDigest`、`deviceId`。生成错误枚举 `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/EdgeProblemCode.java:71-79,125-135` 已含本闭集除 PLATFORM_DEPENDENCY_UNAVAILABLE 外的所列六类 common/terminal code；`contracts/openapi-source/r5-baseline/contracts/openapi/components/platform-errors.schemas.yaml:20` 有 PLATFORM_DEPENDENCY_UNAVAILABLE。仅写“现有凭证”没有闭合两个额外身份字段如何抵达 edge 核验 API；“既有 typed outcome/同上”也不能代替 operation contract 的 errorSet 与条件映射。
- **反例：** 生成客户端只发送 Authorization 时，parser 能解析 generation/digest，但 verification API 无法构造其完整 Credential。若实施者自行把 terminalRef/deviceId 编入凭证、URL 或新增身份来源，会越过 TDC 唯一凭证 owner/现有核验边界。
- **影响：** canonical、generated client、edge 和 terminal-binding 核验之间缺少可实施的输入与拒绝契约。
- **最小修正/当前落点：** 详设 §5.1 与计划 CP-01 现规定共用输入：TDC credential state 提供 `Authorization: Terminal <generation>.<secret>`、`X-Terminal-Ref`、`X-Terminal-Device-Id`；path 提供 `groupWorkspaceKey` 和该 operation 的业务 ref。edge 复用 `TerminalCredentialParser` 解析 generation/digest，并以 path/header 身份构造既有 `TerminalCredentialVerificationApi.Credential`；不得从客户端业务 ref 授权。8 项共用 `TERMINAL_DATA_READ` 闭合错误集：`PLATFORM_COMMON_VALIDATION_FAILED/422`、`TERMINAL_BINDING_CREDENTIAL_INVALID/403`、`PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED/403`、`STORE_TERMINAL_DISABLED/409`、`PLATFORM_COMMON_ACCESS_DENIED/403`、仅详情的 `PLATFORM_COMMON_RESOURCE_NOT_FOUND/404`、`PLATFORM_DEPENDENCY_UNAVAILABLE/503`；详设逐 operation 标明适用条件，集合为空是 200 空集合。前六个 code 均存在于当前生成的 `EdgeProblemCode`；503 code 存于canonical platform error schema，须由新 terminal errorSet明确引用。secret 只放 Authorization 且不记录日志。
- **更小替代：** 另建 terminal-only 凭证解析器或从 body 复制凭证字段会造成第二入口/事实源，不采纳。共用既有 parser 与 verification API，加显式 headers/path 来源是更小的闭合。
- **剩余 OPEN：** 新 operation schema、edge request mapping、generated client 及错误目录均未实施/生成/运行；503 映射须在 terminal errorSet中引用canonical `PLATFORM_DEPENDENCY_UNAVAILABLE`，并确认edge向终端暴露该code/状态一致。此项是待实施契约接线，不改变当前已有业务产品语义。
- **Dexter 产品裁决：** 不需要。

### S-3｜清缓存后拒绝迟到结果重建 remoteOperations 项

- **分类：`CONFIRMED`（尚未实现的竞态设计缺口，不是已复现生产故障）。**
- **评审位置 / 当前文档落点：** 修订详设 CP-06:76-79、场景表:309-313；修订计划步骤4:91。
- **仓内事实：** `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:335-353` 表明 root reset 清 state 后再运行 reset hooks，hook input 可取得 `previousState`；reset 并不等同于 Runtime dispose。已裁决的 TDC 行为是单一持久化 slice 中一个 map，普通同配置重连保留，server-config 改变/root reset 清除。旧设计未把“清除后旧 observer 仍返回”写成拒绝重新插入的可执行判据。
- **反例：** 某 operation 的 actor 未结束；配置变化或 root reset 清空 map；清理前注册的 observer 随后收到 stage、result 或 ACK。若 observer 仍以 upsert 写 map，旧配置项会复活并可能补报。普通断线重连不清 map，因此不能把该边界扩大成所有迟到结果都丢弃。
- **影响：** 被清除的远程操作可能重新进入持久状态，违反配置边界与“只更新仍存在原项”的裁决。
- **最小修正/当前落点：** 详设 §9/CP-06 与 `tdp.remote.cache-clear-late-result`、`tdp.binding.old-report` 场景现要求：result、phase、ACK 只有在 map 原项仍存在且 operation、binding、server-config、wire request、Runtime local request identities 全部匹配时才能更新；原项已清除一律丢弃、不重建，并释放对应 observer/handoff。reset hook 使用现有 `previousState` 释放关联观察资源；配置/root reset 清 map，同配置普通重连保留。测试分别覆盖清理后本地/peer 迟到 result 与 ACK、以及普通重连保留。
- **更小替代：** 新增持久关联表、epoch 或通用取消仲裁并非必要；以现有 map 项是否仍存在及已保存身份相等作为更新条件即可，已采用。
- **剩余 OPEN：** observer/handoff 释放时序与持久化失败行为未由源码实现或测试证明；全部是未来实施与动态验收项。
- **Dexter 产品裁决：** 不需要，配置/root reset 清除与正常重连保留遵从已给裁决。

### S-4｜Topology peer 的实际 actor 结果在 Runtime handoff 前丢失

- **分类：`CONFIRMED`（当前源码能力缺口，设计闭环已补；尚未实施）。**
- **评审位置 / 当前文档落点：** 修订详设 CP-06:76-79、场景表:309-310；修订计划步骤4:91。
- **仓内事实：** `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:49-59,88-106,116-122` 构造的远端结果将 `actorResults` 置空，wire `command-result.result` 固定为 `null`，接收端只以状态完成 `CommandDispatchResult`；`:150-183` 的迟到结果还会因超时/cancel 被抑制。`apps/terminal/kernel/base/runtime/src/foundations/createCommandPeerDispatcher.ts:97-114` 再将 peer 完成映射为 `result: null`，错误则规范化到 ledger，丢失 actor result 正文。因此 Runtime 新增槽单独不能恢复已经在 peer→gateway 路径丢掉的结果。
- **反例：** peer 上的已注册 actor 在 root timeout 后成功返回业务结果；当前 gateway 只得到 completed/status 和空 actorResults，Runtime handoff 无实际值可交给 TDC。只测本地 actor 或直接向 handoff 注入 result 不覆盖这条跨 topology transfer 路径。
- **影响：** 本地晚到结果可设计闭合，但 peer 路径不能满足需求要求的 local/peer 实际结果观察；将 UNKNOWN 报成成功或重派都不成立。
- **最小修正/当前落点：** 详设 CP-06、场景 `tdp.remote.runtime-late-result` 与计划步骤4现明确 peer 的实际 actor result/error 必须沿现有 `command-request → command-result → peer gateway → Runtime` 传递；保留原 `requestId`/`commandId`，恢复 `CommandDispatchResult.actorResults`，Runtime 将迟到实际 outcome 放入精确 local requestId 的有限 handoff 后再写不含 payload 的 journal。只对已注册此 handoff 的 TDP 请求，让 root timeout cancel 不抑制该请求的实际迟到回包；其余 command 保留原 cancel 语义。测试必须通过真实 transfer callback，并断言结果/error 正文、两种身份关联、Runtime handoff、TDC 持久化与不重派；槽按既有请求 timeout/expiry/disposal 释放，不建 peer ledger。
- **更小替代：** 仅在 Runtime 增加结果槽或只传 status 都不能恢复 peer 路径的原结果，不采纳；通用 peer 持久账本/恢复框架超出需要。沿现有 wire 与 gateway 补结果透传是满足判据的最窄修改。
- **剩余 OPEN：** Topology wire schema/validator/generator、peer actor result 类型的安全可序列化闭包、超时之后仍允许已注册请求回传、错误脱敏和资源释放都未实现或动态验证；本轮只把它们写为实施判据。
- **Dexter 产品裁决：** 不需要。缩减 peer 实际结果能力才会改变需求范围，应另交 Dexter。

### N-1｜表格列结构

- **分类：`CONFIRMED`（文档可读性问题，已修订）。**
- **事实：** 详设 CP 总览表为五列；旧稿 CP-03/CP-06 的字段有串列风险。DEV-DATA-13～16 使用 fixture、CBS/TDS执行面、TER执行面、adapter coverage、owner 六个字段，旧表头/内容对不齐。
- **最小修正/当前落点：** 详设 §2:49-56 的CP行逐行对齐五列表头；§11:393-398 的 DEV-DATA-13～16 使用明确七列表头（含独立 adapter coverage 列），每行七项。未新增场景或分母。
- **更小替代：** 删除信息列会降低阶段 owner/执行面可读性；重排到现有列而保留原内容更小且不损信息。
- **剩余 OPEN：** 无待决产品事项；文档结构已静态回读，运行仍 NOT_RUN。
- **Dexter 产品裁决：** 不需要。

### N-2｜旧 binding 验收未区分 root reset

- **分类：`CONFIRMED`（验收边界歧义，已修订）。**
- **事实：** 已裁决允许 root reset 清除 TDC 的 remote operation map；旧 `tdp.binding.old-report` 却只笼统断言 reactivation 后原件可读，会与 root reset 清理发生冲突。
- **最小修正/当前落点：** 详设 `tdp.binding.old-report`（§11:313）现拆成两种前置：同一配置下 binding 失效但没有 server-config 更新/root reset 时，原项保留并标 `BLOCKED_BINDING_INVALID`、不得跨 binding 补报；root reset 时仅清 TDC 本地 map、不补发旧事实，CBS 仍保留最后已提交状态或 UNKNOWN。与普通同配置断线重连继续保留原项的边界分开。
- **更小替代：** 不改持久化策略，只精确说明测试前置和 oracle；不增加状态、存储或 reset retain 机制，已采用。
- **剩余 OPEN：** 当前仅是设计判据，未实现/运行。
- **Dexter 产品裁决：** 不需要；按已裁决缓存清理语义执行。

## 修改清单与验证状态

- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`：细化 TDS 权限/建成时序、terminal GET 凭证与错误契约、清理后迟到结果、peer 实际结果路径、CP 总览与 DEV-DATA 表、reset 前置场景。
- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md`：同步 GET 合约闭集、独立 TDS principal 权限正反验证及 CP-03/06 时序、peer 实际 outcome transfer 断言。
- 本文件：记录逐项 finding intake、证据、反例、最小方案与 OPEN。
- 未修改正式需求、decision、Journey、源码、测试、脚本、依赖或生成物。

当前字节上的最新运行：`NOT_RUN`（本轮只读源码核验与文档修订；依授权未执行运行）。

最后一次通过：本轮无新的运行通过；历史动态证据不升级为修订后当前字节的 PASS。

Claude 原独立 verdict `NO-GO, M/S/N=0/4/2` 保留为其所审字节的结论。当前作者完成文档修订，不代表独立 `GO`；S-1 权限实现、S-2 contract/generated、S-3 map race、S-4 peer transfer、依赖官方依据及所有运行仍为 `OPEN/NOT_RUN`。
