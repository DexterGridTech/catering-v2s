# TDP 数据变化通知与远程运维 · 需求讨论稿

```text
DOC_KIND=REQUIREMENTS_DISCUSSION
AUTHOR=Claude
STATUS=DISCUSSION_NOT_APPROVED_FOR_IMPLEMENTATION
BUSINESS_SOURCE=Dexter 2026-10-03 本会话需求、原始更新时间、范围结果集 A/B、主副机数据归属、更新接受确认与 terminal-control owner 裁决
EVIDENCE_TIER=当前仓内静态源码、历史 POC 分析及官方资料；动态 NOT_RUN
AUTHORITY=需求讨论、统一术语和规范/记忆指针维护；不授权源码实施或动态运行
```

## 0 · 目标与讨论边界

本专项建设两项基础能力：CBS 业务事实变化后，终端 feature 能知道哪些本地数据需要更新；
CBS 能向在线终端发送 command，并取得关联 request 的执行结果。用户界面、业务工作台、
订单/会员等新业务模块不在本次范围。基础设施必须有实际端到端消费者证明，不能只建协议空壳。

标记约定：**已明确**来自 Dexter；**静态事实**来自当前源码；**建议**为讨论方案；
**待裁决**尚未获产品/范围确认。本文不是正式需求、详设、实施计划或 DESIGN verdict。

统一命名的唯一正本为 `doc/platform/terminal-coding-standard.md` **§4-F**：
CBS 为业务后台；TDP 为 Terminal Data Platform，即 TDS + TDC 长连接整体；TDS 为服务器侧，
TDC 为终端侧。A 是双方在线情况，B 是数据变化通知，C 是远程指令。本专项聚焦 B/C，
沿用 A 的激活、鉴权、ready、心跳和跨节点会话权威，不重建在线状态机制。

新称呼不增加 deployable，不启用旧 TDP placeholder，不增加业务数据库、MQ、通用 outbox、
持久消息队列或常态轮询。Doris 继续仅保存连接历史，不作为 topic 数据或运维指令事实库。
正在实施的终端激活交互/双机专项独立推进；本次不修改其源码、授权或交付状态。
本期远程 command 记录由计划新增的 CBS terminal-control owner 持久化到现有 PostgreSQL；
这是已明确的能力范围，不是离线执行队列，不改变只有一个业务 deployable 的约束。
终端也保存本次远程操作的执行过程与结果，重连后补报；这项具名记录回传是本期已裁决范围，
不扩展为通用持久消息队列，也不允许补发或重新执行command。

## 1 · 已确认输入

1. topic 的类型、范围参数和数据约束在 contracts 定义，并生成到 TDC；不在各 feature 手抄字符串。
2. CBS 根据 topic 发布变化；feature 拥有订阅意图、业务数据、持久化与 HTTP 更新行为。
   TDC 只提供协议、订阅与通知基础服务，不实现门店、菜单、用户等业务逻辑。
3. 多个 feature 可以订阅同一 topic，不强迫单消费者。启动步骤以本轮后续明确的 §3.2 为准：
   激活成功先 HTTP，更新数据后登记 topic 与版本；TDP ready 后发送已登记订阅。
4. topic 版本使用 long 更新时间，不使用自然数 version。Dexter 本轮进一步指定：
   **“只用业务记录原始更新时间，讨论其限制”**。不得另建严格递增水位、逻辑时间戳，
   或把现有自然数 version 伪装成时间戳。CBS 原有乐观锁 version 与发布 revision 不因此删除。
5. TDC 广播 topic 最新更新时间；订阅该 topic 的 feature 调用自己的刷新 command，经业务 HTTP
   请求取数据并保存，随后用 command 确认“该 topic 更新已接受”；TDC 使用对应服务端通知时间，
   不再要求 feature 重新算时间覆盖。TDC 不替 feature 请求业务数据。
6. feature 可动态订阅、退订；登录 X 后可订阅 X 的变化，登出后退订，不保留失效用户意图。
7. 支持精确订阅和范围订阅；范围用于发现集合及成员变化，feature 可再订阅成员详情。
   门店合同为当前范围例子；未完成订单范围及精确订单是未来例子，当前不新增订单业务。
8. 通用 TDS/TDC 通道不按业务类别限制 command；CBS 实际管理和下发的 command 由 contract 定义。
9. 调试闭环使用无业务副作用的 `helloWorldCommand`，通过 request 返回终端信息。
10. TER 发业务指令只用 command，读业务数据/状态只用 selector；沿用现有 runtime。
11. Dexter 对通知规则补充：“如何通知，取决于 feature 包订阅不订阅，以及 feature 包发送的本地版本”。
    未订阅不通知；已订阅以 TDC 的 topic 本地时间参与判断，该时间首次来自业务数据计算、
    后续来自已接受的服务端更新，不把所有终端作为广播目标。
12. 本期消费范围以 §3.7 的两个新 kernel/feature 包为准，包含门店、项目、大区、集团、经营规则、
    valid 合同范围/详情及服务点区域/服务点目录与详情。其余 topic 为候选，不做所有业务 consumer。
13. CBS 各业务实体的原始更新时间须重新盘点，评估统一字段、单位、时钟来源及写入语义；
    统一方案仍处于讨论，不因本条直接授权全仓迁移或改变业务生命周期。
14. 范围 topic 是依据一项或几项明确状态属性查询得到的**无序 refIds 结果集**，缓存该结果集。
    不用自然过期作为合同搜索条件；例子为 valid 合同、status != completed 的未来订单。
15. 相关已登记条件发生变化，A 为触发实体的原始更新时间；重算结果集，B 为新集合成员
    原始更新时间的最大值。refIds 相同不更新；空→非空用 B；非空→空用 A；
    **两边均非空且 refIds 不同也用 A**（Dexter 补充确认）。
16. TER 副机不连接 TDS；TDC 的 topic/ready 广播仅在主机。所有 feature 业务数据从主机同步到副机。
    撤回此前“副机 feature 自行登记 topic 或收到通知后独立拉取”的建议，不增加副机订阅机制。
17. 本期新增 `apps/terminal/kernel/feature/store-basic` 与
    `apps/terminal/kernel/feature/store-service-point`，确切消费清单见 §3.7；本轮登记需求，不创建源码包。
18. feature actor 接收激活成功 command 后，不论原本地版本是否为空，先 HTTP 获取业务信息，
    更新业务 slice，再经 command 通知 TDC 登记 topic/初始时间；收到 topic 广播后复用同一刷新 command。
19. **最新修正**：首次 HTTP 数据由 feature 自己计算 topic 初始时间；精确实体取原始更新时间，
    结果集取成员原始更新时间最大值，空结果集取 **0**。服务端通知 100 后，再次 HTTP 即使仍为空，
    feature 也只确认该更新已接受，TDC 自己把 **100** 作为 topic 本地时间，不用再次计算的 0 覆盖。
    本条取代此前“多包反复上报时间、最后接收覆盖并 WARN”的规则，不再建设该时间冲突检查。
20. 范围 topic 的消费 feature 根据最新 refIds 管理成员详情订阅。合同集合 `{A,B}` → `{A}` 时
    取消 B 详情订阅、保留 A；新增成员先读取详情及其时间再登记，不订阅范围外成员。
21. store-service-point 的区域目录和服务点目录均为 **全门店仅启用集合**：分别按实体自身
    `status=ENABLED` 搜索；服务点范围不按区域拆分，其详情的 areaRef 表达所属区域。
22. 远程 command **仅在线执行，无离线补发**；超时/断链允许执行结果未知，不把未知写成未执行。
23. CBS 新建纯能力 owner **terminal-control**，拥有并持久化发送记录、执行过程、执行结果；
    后续由其他业务模块集成。本期不涉及前台管理或权限模型，不选择 platform-admin/operations-admin
    作为调用面，不新增管理页面或 capability。
24. 接受原始时间戳无法发现所有同值漏通知的限制；在线收到真实变化时，即使时间相同也通知
    当前订阅者，重连核对用“不相等”而非仅“大于”。不改变原始时间或宣称绝不漏更新。
25. X确认成功而Y刷新失败时，由Y自己处理失败和后续刷新，不上升为TDP统一恢复/重试机制，
    不要求全包确认屏障、服务端per-feature版本或统一重试次数。
26. 终端也**持久化远程执行过程与结果，恢复连接后补报**；CBS terminal-control接收并持久保存。
    补报只传已有执行事实，不重发command，不因恢复记录而再次执行actor。
27. 范围缓存直接持久保存于**PostgreSQL**，内容为topic身份/scope、`refIds + topic时间`，
    保留集合变空后的A；不以可丢弃的纯内存缓存替代。

## 2 · 当前源码能够证明什么

本节依据 2026-10-03 只读源码核对。相关 TER 源码正在并发实施，后续详设必须再次重开当时字节。

| 能力 | 当前事实与准确入口 | 本专项缺口 |
| --- | --- | --- |
| TDS/TDC 协议 | `contracts/protocol/terminal-connection-protocol.json:10–53` 只有 AUTHENTICATE、SESSION_READY、PING、PONG | 尚无订阅、topic 更新、远程 command/result 帧 |
| TDC 业务 ready | `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:640–680` 收合法 SESSION_READY 后更新连接状态与心跳 | 尚无通知 feature 的 ready 广播 command；socket open 不等于业务 ready |
| 激活成功通知 | 当前 `terminalDataClientCommands.ts` 仅有激活动作等命令；actor 成功分支持久凭证后返回 activated | 尚无公共成功事实广播；不能把 activateTerminalCommand 发起动作当成成功通知 |
| 公共 command 广播 | `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:610–631` 支持同一 command 多 actor；`defineCommand.ts:26–34` 已有 allowNoActor | 可直接复用，不需要 event bus、空 actor 或第二 dispatcher |
| 按名执行 command | `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:299–311` 解析已注册 command；dispatcher 校验定义 | 可执行已安装、已注册的 command；不支持远程创建定义或执行脚本 |
| request/结果读取 | runtime `src/types/execution.ts:17–44`、`src/selectors/selectRequestExecutionView.ts:37–71,111–122` | 尚无 CBS/TDS/TDC 的完整业务结果回传桥 |
| 跨节点当前会话 | TDS `state/TdsConnectionStateRepository.java:26–56`、`session/TdsBindingRevocationListener.java:125–159` 以 PG 权威会话和通知恢复 | 新能力需复用真实当前 session，不按过期 nodeId 或内存 socket 猜路由 |
| CBS 通知 | `modules/terminal-binding/.../TerminalBindingOwnerPersistence.java:264–274` 发绑定撤销 PG 通知 | 不等于已有通用 topic 发布与运维路由 |
| CBS terminal-control owner | 当前 CBS modules 文件定位未见 terminal-control；TER runtime 已有 request/actor 执行记录，但 ledger 明确不持久化（E17） | 本期计划新增纯能力 owner 和 CBS 持久化链；不能把终端内存 ledger 或日志当作发送/过程/结果的持久记录 |
| 业务 HTTP | CBS operations controller 有门店、合同、菜单等读 API；terminal face 目前为激活/取消入口 | operations session/context 不能直接充当 terminal HTTP 鉴权；需补终端 consumer 读取链 |
| 出站容量 | TDS `websocket/TdsWebSocketConnection.java:30–32,88–101` 当前有界队列容量为 1，写入可能失败 | topic 突发与运维消息不能假定全部可排队；需有限容量及显式失败/恢复语义 |

上表 TDS 路径前缀为 `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/`；
CBS module 全路径及业务证据见 §8。表内简称仅便于阅读，不构成新增目录。

现有 topology peer command controller 可参考关联、超时、容量和断链清理，但其 wire
`result:null`、调用方 `actorResults:[]`（`apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:49–59,88–106`）。
它不是已有的 helloWorld 数据返回通路，也不能把服务器连接装成主副机 peer。

## 3 · B：职责、状态与 command/selector 链路

### 3.1 · 事实只有一个 owner

| 层 | 拥有的事实/运行态 | 写入动作 | 读取入口 |
| --- | --- | --- | --- |
| contract | topic 类型、参数闭集、scope、更新时间来源及 HTTP 快照语义；wire 消息 | owning generator 生成类型与校验；不写 feature 数据 | 生成类型和协议定义 |
| CBS 业务 owner | 原始业务记录、原始更新时间、集合成员及授权事实 | 既有公开业务 command，在同一业务事务内完成变更与通知触发 | owner 公开任务型 read；terminal HTTP 由 contract 明确暴露 |
| CBS 范围 topic 缓存 | PG持久保存topic/scope对应的refIds集合与A/B时间；仅派生元数据 | 业务 owner 条件变更后重算、比较并一致提交；不保存第二份业务实体 | TDS 的有限任务读；物理owner/schema待详设，不由每个TDS各算一份 |
| TDS | 当前会话的 wire 订阅、投递运行态 | 协议处理订阅/退订；CBS 通知唤醒后读取权威实体时间或范围缓存并投递 | 当前绑定/session 与有限任务读，不拥有业务写入 |
| TDC | 本会话ready、topic订阅/接受时间与关联；本终端远程操作的有界持久执行记录及补报状态 | 订阅/确认/退订及记录保存/补报command；事实广播command | 公共连接/订阅/记录状态selector；不保存feature业务数据副本 |
| 主机 feature | 业务数据、记录原始时间、订阅意图、更新状态/错误；首次 topic 时间由数据计算 | 自己的业务 command 发起 HTTP；actor 应用和持久化后确认对应更新，再走既有同步 | feature 公开 selector；副机读取主机同步的业务投影 |

command 名称暂为能力示意，正式命名需依据 moduleName 与当前注册目录：
`terminalActivationSucceededCommand`、`terminalDataSessionReadyCommand`、`subscribeTerminalDataTopicCommand`、
`unsubscribeTerminalDataTopicCommand`、`terminalDataTopicUpdatedCommand`、`acceptTerminalDataTopicUpdateCommand`。
不在本轮声明实际 API 已存在；业务指令/读取不得以 callback、snapshot 或 service 替代公开 command/selector。

### 3.2 · 连接与初次订阅

1. **激活成功**：TDC 完成凭证应用/必要持久化后发送成功事实 command；主机 feature actor 接收后
   调用本包刷新 command。监听的是成功事实，不是 activateTerminalCommand 的发起动作；
   同一成功通知不改变服务端已激活的事实，也不把 feature HTTP 失败改报成激活失败。
2. **先 HTTP**：feature 不论已有本地版本是否为空，按当前激活身份获取本包业务信息；成功后
   更新业务 slice、对应时间并持久化。取消激活/换门店后迟到的旧 HTTP 不得写入新身份的数据。
3. **首次登记**：feature 通过 TDC 订阅 command 登记 topic 与自行计算的初始时间。
   精确实体取原始更新时间；结果集取成员原始更新时间最大值，空结果集为 0。
   不能因为启动时旧版本为空而跳过拉取或登记；加载成功但为空与尚未加载/加载失败须区分。
   HTTP 失败仍保留可观察错误，不声称已获取新数据、不推进版本，是否保留既有缓存遵循当前身份。
4. **连接先后均可**：TDC 未 ready 时只登记订阅意图和版本，不发送业务协议帧；合法 SESSION_READY
   后提交全部有效登记。若已 ready 则即时提交。TDS ready 与 feature HTTP 可并行完成，
   不要求用所有 feature 的网络调用阻塞心跳或成功鉴权；尚未登记的 topic 不提前通知。
5. **接收更新并确认**：初次登记/重连用“不相等”核对服务器时间与TDC本地时间；
   在线有真实变化时，即使时间相同也通知当前订阅者（范围仍须refIds实际改变）；
   TDC 在主机广播。feature actor 对当前已订阅的 topic 调用与第 1 步相同的刷新 command，
   HTTP 更新 slice/持久化后，以公开 command 确认本次 topic 更新已接受，不再上报自行计算的时间。
   TDC 从本次通知关联中取得服务端时间并更新 topic 本地时间，再提交 TDS。
   不是组件直调 HTTP，不新增 event bus，不以重读本地缓存代替本次刷新。
6. **重连/迟安装**：建议 TDC 重发已有效登记，不复用旧 session 确认；已激活应用重启或 feature
   迟安装时，依据公开激活 selector 走同一个初始化刷新 command，补齐“一次成功广播已错过”的情形。
   具体 install/hydration 接线须在详设核对，不要求用户每次启动重新输入激活码。

无监听者事实广播使用已有 allowNoActor。登出/模块释放/失效身份撤销的订阅不能复活，旧 session
回包及旧身份结果须拒绝。退订一个包不得退订仍在使用该 topic 的其他包；最后一个包离开才发 wire 退订。

**业务原始时间与更新接受时间分开（最新裁决）**：首次计算时间只用于初始订阅；以后 TDC
记的是已接受通知中的服务端 topic 时间，feature 保存的实体原始时间仍如实保留，不被该通知时间改写。
例如空集合首次登记 0 → 收到通知 100 → HTTP 仍为空且保存成功 → feature 确认接受 → TDC 记为 100。
后续重新计算出的 0 不覆盖 100；重连需报告同身份有效的已接受时间，不能退回空集合计算值。
TDC 的接受时间与 feature 业务缓存需保持可解释的重启边界，具体持久化接线在详设核对。

**确认必须关联具体更新（最小正确性约束）**：feature 仍通过 command 表达“已接受”，无需报告
新的业务时间，但须能定位当前 topic/绑定及具体通知；可使用 TDC 广播中提供的关联标识，wire 细节待详设。
收到 100 后刷新期间又收到 200，旧刷新仅确认 100，不能把尚未处理的 200 自动标为已接受。
重复确认不重复订阅；旧身份/已退订/失效会话的确认不改变当前时间；原始时间可能倒退，不能简单取 MAX。
已接受较后通知后，迟到的较早确认也不能回滚时间；以通知关联判断先后，不以时间数值大小代替。
HTTP 或持久化失败不确认成功；确认 command 失败可观察，不把收到通知本身当作更新完成。

**多包订阅**：多个 feature 仍各自刷新业务数据、保留订阅身份并确认对应通知；不再反复上报
各自计算时间，因此撤销此前跨包时间冲突 WARN/覆盖要求，也不引入版本仲裁或等待全部包一致的屏障。
一包确认只证明该包本次刷新成功，不代表其他包已成功；其他包失败仍由各自状态/selector 如实暴露。
X已确认而Y失败时，Y自行决定并执行后续刷新/重试，不等待TDS必然再次提醒；TDP不管理Y的
业务HTTP恢复，不引入统一重试策略或要求X撤销确认。既有真实通知仍正常广播给有效订阅者。
首次多包或迟加入包的登记必须覆盖其首次数据与服务端现状的核对，不能因共享 topic 已接受就跳过
新包的数据更新；具体使用既有通知关联的最小方式留给详设，不新增 per-feature 服务端版本事实。

### 3.3 · 业务写入到 feature 更新

```text
CBS 公开业务 command
  → 业务 owner 提交业务记录及其原始更新时间
  → 若涉及范围条件，重算并比较 refIds，按 A/B 规则更新范围缓存
  → 提交后变化唤醒（topic + 合法 scope；不发送业务数据全文）
  → 有连接的 TDS 节点查询/核对业务权威并通知订阅会话
  → TDC 校验当前 session 和消息，广播 topic-update command
  → 主机订阅 feature actor 调用刷新 command，请求 CBS terminal HTTP
  → CBS owner 返回业务快照与其原始更新时间
  → feature 核对当前身份/订阅，原子应用并持久化数据 + 对应时间戳
  → feature 经接受更新 command 确认对应通知；TDC 采用其服务端时间，再提交 TDS
  → 主机 feature 经既有 owner 同步把业务数据与对应时间同步到副机
  → selector 提供结果、更新中或失败状态
```

**建议实现方向**：参照已有同事务 PG NOTIFY 作唤醒，业务事实仍由 CBS owner 保存；TDS 不做业务写。
PostgreSQL 通知在事务提交后才投递，但不为离线 listener 保存消息；启动监听后再读取当前状态，
是官方给出的初次监听竞态处理方式。依据 [PostgreSQL 16 NOTIFY](https://www.postgresql.org/docs/16/sql-notify.html)
与 [LISTEN](https://www.postgresql.org/docs/16/sql-listen.html)。仓内 acceptance 声明 `postgres:16-alpine`
（`BackendAcceptanceTest.java:663`）；本轮未读取远端实际 patch 版本，也未验证新 topic listener。

这只是复用方向，不表示 PG NOTIFY 自动提供可靠送达。listener 重建需重查当前订阅范围；
在线漏通知/投递队列失败需要明示恢复动作。若要求在线状态下保证最终纠正，必须另外确认其准入，
不能悄悄加入轮询、MQ 或持久队列。topic 变化可有界合并；远程执行命令不能照搬“只保留最新 topic”的合并规则。

feature 更新失败不推进本地更新时间；新通知在 HTTP 过程中到达时，不能用旧响应覆盖较新结果。
HTTP 更新和持久化成功后才确认对应通知；失败不发送“更新已接受”。确认不增加一份订阅。
TDS 据 TDC 的 topic 本地时间决定后续通知；确认丢失时可能重复通知，不推导业务数据已丢失。
每 feature 可合并重读需求、限制同一 topic 的并发 HTTP，不建设通用恢复框架。
HTTP 返回的数据与记录原始时间须对应同一快照；接受通知 T1 只证明已处理该通知，不把 T1
写成实际 T2 业务记录的原始时间，也不要求空集合从业务记录推导出服务端的成员退出时间 A。
分页范围需定义完整快照边界，不能将不同时间的页面拼完后声明整集合最新。

### 3.4 · 原始更新时间：接受输入与无法消除的限制

已裁决仅使用业务记录原始更新时间。建议统一为 UTC epoch milliseconds 的 long；TS 必须校验
整数安全范围。终端收包时间、TDS 心跳时间、自然数版本都不是业务更新时间。
**相等仅表示时间戳相等，不能无条件证明内容相同**；采用 `remote > local` 更不能覆盖时间倒退。

| 情况 | 仓内事实或反例 | 在当前裁决下的限制 / 候选处理 |
| --- | --- | --- |
| 同毫秒连续修改 | `SystemTimeProvider.java:8–9` 用 System.currentTimeMillis；合同写更新时间来自 time provider | 已接受同值漏通知无法靠时间核对发现；在线真实变化即使同值也通知/刷新，不承诺所有漏失最终补齐 |
| 时钟回拨/提交倒序 | 原始时间不保证单调，赋值先后也不等于提交顺序 | 不用 `>` 宣称最新；值不同触发重读可以发现部分倒退，同值仍无法辨别 |
| 范围成员退出 | 新集合 MAX(updatedAt) 不一定变，甚至下降 | 已按 §3.5 改用触发退出的原始时间 A；这是范围缓存时间，不伪造业务记录时间 |
| 软失效 | 合同 INVALID 行保留并更新原始时间 | valid 范围需重算 refIds，用 A 记录成员退出；不能再用仅剩成员的最大时间代替 |
| 自然到期/排期切换 | 合同 CURRENT/PENDING/HISTORY 读时用 businessDate，没有必然 DB 写入 | 已裁决不作为范围搜索条件；日期变化不改变 valid refIds，也不制造范围更新。具体有效期使用仍由 feature 处理 |
| 硬删除 | 菜单 item/section 等存在 DELETE，删除后无法读取该行时间 | 不能假装删除必有新的实体原始时间 A；主数据 VOIDED/合同 INVALID 等状态退出复用现有路径，硬删除子项的聚合根时间与本批外范围另作明确盘点 |
| 聚合没有原始时间 | 菜单 readback 只有 version/draftRevision/latestPublishedRevision；多项写无统一更新时间 | 该 topic 当前不能宣称具有可比较原始时间；不能硬把 revision 当时间，须确认数据范围或先不启用 |
| 有效权限 | 角色、assignment、账号等变化均影响权限 | account.updatedAt 不能代表全部权限；需明确 topic 涵盖哪些原始记录及 HTTP 授权读回，不复制权限事实到 TDC |

**精确 topic**指明实体原始时间字段；**范围 topic**采用 §3.5 的派生时间，仍只取真实记录 A/B，
不新增人工递增水位。范围成员变化与原始时间是否不同是两个事实；同毫秒 A 等于旧缓存时间时，
即使服务器发现 refIds 已变，单一时间戳比较仍可能识别不了。这个残余限制继续列明，不偷换版本机制。
没有原始时间的实体需先完成 §3.6 的 owner 盘点，不能填入虚构时间。

### 3.5 · 精确、范围与双机边界

topic identity = contract 的 topic 类型 + 类型明确的 scope 参数；不可只凭 entity UUID 判断租户。
scope 的集团、门店、品牌、数据节点、业务渠道等必须由服务器依据绑定和 owner 权限核对。
范围条件是 contract 定义的有限状态属性闭集，不允许任意 SQL/自由过滤表达式；租户/门店等 scope
是结果集身份的一部分。实体创建、显式状态变化，以及移入/移出登记 scope 的写入都会影响成员资格，
不得只监听字段名恰好叫 status 的更新。具体条件来源由业务 owner 解释，TDS 不拼业务搜索条件。

**范围算法（已裁决）**：旧集合 S0，新搜索集合 S1；比较无序 refIds，忽略返回顺序、不允许重复 id。
A 是本次触发实体已生效的原始更新时间；S1 非空时 B = max(S1 各实体原始更新时间)，
无排序查询不影响最大值计算，不需要按时间排序后取最后一条。

| S0 / S1 | refIds 是否改变 | 范围 topic 更新时间 | 缓存动作 |
| --- | --- | --- | --- |
| 任意 / 任意 | 无变化（包括空→空、同成员不同返回顺序） | 保持旧值 | 不制造范围变化 |
| 空 / 非空 | 有变化 | B | 原子替换 refIds 与范围时间 |
| 非空 / 空 | 有变化 | A | 保留空 refIds 与范围时间 A |
| 非空 / 非空 | 有变化 | A | 原子替换 refIds 与范围时间 |

范围 topic 只反映**集合成员变化**，不是成员内容更新的替代。成员仍 valid，但名称、金额、权限等
内容变化使 B 改变而 refIds 不变时，范围缓存时间不变；精确 topic 通知该成员的新原始时间。
范围 HTTP 发现 id 后，主机 feature 必须依本期消费清单登记成员精确 topic，移出后退订；
其他 feature 的订阅不受影响。具体集合差量与迟到详情处理见 §3.7。
首次没有缓存不等于“已有空集合”：非空初始结果可按 B 初始化，初始空结果的表示仍待确认，见 Q-6。

合同范围明确为“门店状态 valid 的合同”，源码当前以 `status='ACTIVE'` 表达未失效，
失效为 INVALID（`ContractCommandServiceSql.java:12–22,40–45`）。这里 valid 是业务筛选语义，
不授权把数据库值改名为 VALID。不得复用带有效期过滤的 CURRENT/PENDING/HISTORY 列表，
不得因自然到期排除 ACTIVE 合同；日期流逝不会自行改变本范围。未来订单的 status != completed
亦按其真实状态机定义，本批不增加订单模块。

**缓存存储（已裁决）**：CBS侧在PostgreSQL唯一持久保存 `(topic 定义 + scope, refIds, 范围更新时间)`；
派生缓存不保存业务正文、不成为新的业务 owner。原始写入与缓存更新必须有一致的提交/失败语义，
并发重算不能让旧集合覆盖新集合；先保证 owner 事务/提交可观察，再由通知唤醒 TDS。
具体owner/schema与并发更新接线由详设给出最小方案；不能用每个TDS的独立缓存或纯内存缓存
冒充唯一范围事实。重启读取已保存的空集合与A，不从空S1重算成0。无需为此引入
MQ/outbox/持久消息队列或通用搜索引擎。

范围读取/缓存必须得到完整 refIds；不得以既有列表第一分页的 id 作为全集，不做内存伪分页，
不为“无排序”偷偷引入业务排名。全量缓存的规模、查询/更新成本与 wire 传输方式由详设明确，
不能把无限 id 集合直接塞入 65,536 字节 WebSocket 消息；通知仍只发送 topic 与时间。
HTTP 返回 refIds 与成员原始时间需对应同一次可观察快照；feature 首次以成员最大时间计算，
空集合取 0。CBS 的范围缓存 A/B 与 TDC 的已接受时间保留各自含义，不要求 feature 从空集合算出 A。
HTTP 鉴权继续复核当前身份；缓存或订阅成功不是之后读取/写入授权的凭据。

**主副机数据链（已裁决）**：MASTER TDC 接收 TDS 通知，只在 MASTER runtime 广播 command；
MASTER feature 订阅、HTTP 拉取、应用及持久化后，把业务数据与相应更新时间经既有 owner 同步到 SLAVE。
SLAVE feature 通过 selector 消费同步数据，不向 TDS/TDC登记订阅，不接收 TDC 广播、不独立 HTTP
刷新同一份 TDP 业务数据。副机业务操作若需要改变主机事实，仍走其 owner 的既有公开 command 链。
本条只定义 feature **业务数据**来源，不把副机本地 BRANCH UI、输入草稿或独立壁纸偏好改成主机事实；
这些界面/本地状态继续按已批准双机专项规则执行。本批不改写正在实施专项的源码。
业务记录原始时间作为同步数据的字段携带；TDC 的 topic 接受时间仍由 TDC 拥有，
不复制进 feature 充当业务记录时间，不替换 topology 已有的会话/revision 准入；
原始业务时间可能同值或倒退，不能拿它另造“副机只接受更大时间”的同步协议。

### 3.6 · CBS 原始更新时间统一：盘点与最小方向

统一目标是：同一业务实体的业务保存、状态变化和聚合子内容变化，都能读取到 owner 写入的原始
更新时间，方便精确 topic 消费。它不追求严格单调，不代替 CAS/version、发布 revision、审计事件时间。
各 module 的静态盘点与例外见 §9；本轮仅评估，不执行全仓字段改名、迁移或生产写路径修改。

建议统一**对外语义与实际更新责任**，先复用现有 `TimeProvider` 和已有
`updated_at_epoch_millis` / updatedAt 字段，不造通用基类、数据库全表触发器或第二时间服务。
精度建议 UTC epoch milliseconds 的 long。创建时可复用 createdAt；成功更新由事实 owner 提供业务时间，
失败/回滚不留下新时间；不能把 audit.occurredAt、receipt 时间、登录 lastSeen 或通知发送时间当更新时间。

聚合根保存的 JSON/子项属于该实体时，在同一 owner 保存中维护根的原始时间；独立子实体仍有
自己的时间，不要求所有子项因父实体变化而被无意义 touch。关联派生权限和可售状态应列出真正
变化来源，不凭一个 account/menu 的字段假装覆盖全体依赖。只读操作不得为了 TDP 方便修改原始时间。
不可变账本/审计/发布快照只保留既有发生/创建/发布时间，不强加可修改更新时间。

已有门店保存即使字段值相同也会执行更新，增加 version/时间；当前不能宣称已有 no-op 不更新时间。
是否改变同值提交语义不是 TDP 接线的必要前提，最小方案先保留当前 owner 行为与幂等回放事实。
新方案仍需逐 operation 核对更新、状态转换、扩展值、排序/关联改动和 authoritative readback，
不能靠统一字段名或一个 UPDATE helper 就声称全量覆盖。

### 3.7 · 本期两个 feature 包、数据模型与初始化闭环

本期新增的实际消费 owner 为 `apps/terminal/kernel/feature/store-basic` 与
`apps/terminal/kernel/feature/store-service-point`，不是 UI 包；本轮仅更新讨论稿，尚未建立源码。
TDC 不依赖或 import 这两个业务 feature。feature 依赖生成 topic 类型、TDC 公开 command/selector
以及既有 runtime/state/transport 基础能力；HTTP 请求采用该业务 feature 的 command/actor，
业务数据写入本包 slice，组件/其他业务包读取公开 selector。

#### 3.7.1 · store-basic 的七类订阅

| 订阅内容（已明确） | 类型及 scope | 业务数据/时间来源 |
| --- | --- | --- |
| 门店基础信息 | 精确：当前绑定 storeRef | organization store root 原始 updatedAt；与经营规则共用 root 时间不等于合并 topic 身份 |
| 项目基础信息 | 精确：门店当前 projectRef | organization PROJECT 节点原始 updatedAt |
| 大区基础信息 | 精确：当前项目的 regionRef | organization REGION 节点原始 updatedAt |
| 集团基础信息 | 精确：已校验集团空间所属 commercialGroupRef | organization commercial_group 原始 updatedAt，不是 group_workspace 配置 |
| 门店经营规则 | 精确：当前 storeRef 的经营规则 | store.operating_rule_switches 与门店同一 root 更新时间；可与门店资料一次 HTTP 取回，不新增规则水位 |
| 门店 valid 合同结果集 | 范围：storeRef + status=ACTIVE | CBS 无序 contractRef 集合与 A/B 时间；feature 首次按成员时间计算，空集合 0，后续确认服务端更新；排除 INVALID、不按自然到期筛选 |
| 合同详情 | 精确：上述集合中每个 contractRef | 合同 owner 的详情模型与各自原始 updatedAt；不是用范围时间标记所有合同正文 |

HTTP 数据链必须来自真实关系：TDC 激活 selector 提供不含秘密的 storeRef/绑定摘要；CBS 每次以
凭证验证结果解出权威 workspace、groupWorkspaceKey、storeRef。客户端提交 store/project/contractRef
仅用于定位，不构成权限。feature 不读取或复制 credentialSecret；通用认证接线须由 TDC 凭证 owner
和现有公开 command/composition/adapter 能力闭合，不为业务包导出秘密 selector。

当前真实组织链为 `store.projectId → PROJECT.parentId(REGION) → REGION`；REGION.parentId 为 null，
集团由已校验 workspace/groupWorkspaceKey 解析 commercialGroupRef，不能沿 region.parentId 猜一个 GROUP 节点。
若门店改项目关联，需要刷新这条关系链并取消旧 project/region 精确订阅，登记当前相关实体。
一次 HTTP 可以复用 owner 的任务型组合读取，但各实体保留自己的原始时间，不能用门店时间代表集团/大区。

建议本包业务 slice 保存门店、项目、大区、集团、经营规则、validContractRefs、contractDetailsByRef
及各记录原始时间；命名和 schema 留待详设。TDC 另拥有已接受的 topic 时间。当前加载状态/错误与绑定身份用于防止旧结果污染，
不把 HTTP “正在加载”状态当作已下载业务数据。业务数据与版本由主机持久化并同步到副机。

#### 3.7.2 · store-service-point 的四类订阅

| 订阅内容（已明确） | 类型及 scope | 原始时间/尚待明确边界 |
| --- | --- | --- |
| 服务点区域目录 | 范围：当前 storeRef + area.status=ENABLED | CBS 全门店无序 areaRefs 与 A/B 时间；feature 首次计算，空集合 0，后续确认更新；停用/作废移出 |
| 服务点区域详情 | 精确：目录中每个 areaRef | Area 原始 updatedAt；当前已有私有详情实现，公开 typed read/terminal HTTP 尚需补齐 |
| 服务点目录 | 范围：当前 storeRef + point.status=ENABLED | CBS 全门店无序 pointRefs 与 A/B 时间；feature 首次计算，空集合 0，后续确认更新；不按area划分范围；停用/作废移出 |
| 服务点详情 | 精确：目录中每个 pointRef | Point 自身原始 updatedAt；displayOrder 是详情字段，不作为范围排列或版本 |

本包按与 store-basic 相同的激活成功→HTTP→slice→首次登记时间、广播→同一刷新 command→确认对应更新
流程执行，scope 来自 TDC 当前激活摘要，无需等待 store-basic 成为另一业务入口。
目录只使用上述显式状态与门店 scope；不使用当前 operations 页的非 VOIDED 谓词，不把派生
effectiveAvailable 或区域自然/级联可用性偷偷加进服务点范围条件。point.areaRef 改变但仍属于
同店启用集合时，refIds 不变，范围时间不变，归属变化由 point 精确详情通知；区域自身停用
引起区域目录成员退出，不因此伪造服务点自身状态变化。
建议 slice 保存区域 refIds/详情、服务点 refIds/详情与各自时间；不重复拥有门店或集团基础资料。
二维码配置是其他候选，不因 Point 读模型当前包含 qrUrl/effectiveAvailable 就自动增加整套二维码 topic
或假装 Point 原始时间覆盖所有关联配置变化；terminal DTO 须明确本期事实边界。

#### 3.7.3 · 集合变化驱动详情订阅（已明确）

```text
收到范围 topic 更新
  → 本 feature 刷新 command 通过 HTTP 取最新完整 refIds 与成员原始时间
  → 核对当前绑定/请求身份，应用新集合
  → removed = 旧 refs - 新 refs：取消本 feature 对这些成员的详情订阅
  → added = 新 refs - 旧 refs：HTTP 获取详情，成功应用/持久后登记详情及其版本
  → unchanged：保留已有详情订阅；按刷新 command 的事实需求更新，不重新叠加注册
  → 首次登记计算时间（空集合 0），或确认本次范围更新已接受；把业务集合、有效详情与原始时间同步到副机
```

合同 `{A,B}` → `{A}`：退订 B 详情，A 继续；`{A}` → `{A,C}`：取得 C 详情并订阅 C。
集合变空时取消本包全部成员详情订阅，仍保留范围 topic 等待后续加入；本包退订不影响其他包。
从当前 valid 集合移出的详情不再由 selector 当作当前成员提供；是否保留历史缓存是存储策略，
不能把缓存仍有 B 正文当作 B 仍 valid。移出后晚到 B 的详情 HTTP/通知不得重新加入集合或恢复订阅。

同一流程适用于区域/服务点目录。范围数据可以先成功更新，而某个新增成员详情 HTTP 失败；
要明确该成员“详情未取得/错误”，不能把它的正文或版本标成成功，也不能因此把范围事实回滚成旧集合。
退订 command 失败可观察并保留待完成意图，不能报清理完成或让旧订阅被重连无声复活。
只需本包的当前集合与请求身份校验，不建设全局实体仲裁、通用离线队列或另一份订阅恢复框架。

#### 3.7.4 · 一个业务刷新入口与可观察状态

建议公开 `refreshStoreBasicDataCommand`、`refreshStoreServicePointDataCommand` 作为各包唯一刷新能力；
激活成功 actor 与 topic 更新 actor 都派发对应同一 command，读数据/加载结果仍通过包的 selector。
TDC 的 subscribe command 用于登记 topic/首次计算时间，接受更新 command 用于确认指定通知；
二者语义分开，不另造“版本确认 callback”，feature 的 HTTP 刷新仍复用同一 command。
具体调用哪些 HTTP 由包的刷新需求决定，详设应保持单一接线，避免首次加载与后续更新各造一套实现。

| 状态/路径 | HTTP 与 slice 行为 | TDC 登记/版本与副机 |
| --- | --- | --- |
| 未激活/非 MASTER | 不发初始化 HTTP，不沿副机投影资格拉取 | 不登记主机业务 topic；副机只读同步数据 |
| 激活成功，旧版本有值或为空 | 一律启动本包 HTTP 刷新，成功后写业务数据/原始时间 | 首次登记全部有效 topic/计算时间，空集合 0；TDC未ready则暂存 |
| TDP ready 早于 feature 首次 HTTP 完成 | 首次 HTTP 正常继续，不凭 ready 宣称数据已取得 | 成功登记后发送TDS并核对当前版本，不能漏掉建连期间变化 |
| topic 更新广播 | 对当前订阅触发同一刷新 command，通过HTTP取数据 | 成功持久后确认指定通知；TDC采用对应服务端时间，不用重新计算值覆盖 |
| HTTP/持久化失败 | 错误可观察，不推进失败数据版本；同身份旧数据保留情况明确 | 不报告该项“已最新”；已经接受的新范围事实不因成员详情失败变回旧集合 |
| 取消激活/绑定或门店切换 | 旧身份结果不能应用，新身份不得复用旧业务资格 | 解除旧scope订阅；同步投影不能继续充当旧门店当前事实 |
| X/Y 订阅同topic | 各 feature 业务 slice 仍由各 owner写，各自处理广播 | 确认同一次通知，不提交各自重算时间；不做时间冲突仲裁 |

首次 HTTP 成功且范围为空时登记时间 0，不表示未订阅；尚未加载/失败则保留加载状态，不能用 0
冒充读取成功。收到服务端 100 后即使仍为空，成功确认后 TDC 记为 100。服务端从未建立过范围
缓存的空态及恢复仍见 Q-6；本地初始空 0 已裁决，不再列为待定。wire 与关联细节由 contract 明确。

## 4 · 当前 CBS topic 候选全集与未来项

以下为业务消费族候选，不是已批准的 topic 名称或全量实施清单。不逐数据库表建 topic。
“已有业务事实”不代表已有 terminal HTTP、原始时间闭包或订阅实现。证据编号见 §8。

| 候选 topic 族 | 精确/范围与必要 scope | CBS owner / 静态证据 | 原始更新时间与范围注意点 |
| --- | --- | --- | --- |
| 门店基础信息（本期） | 精确 storeRef | organization / E1 | entity 有原始 created/updated；终端不必取完整集团树 |
| 项目基础信息（本期） | 精确 projectRef，关联当前门店 | organization / E13 | PROJECT 自身原始 updatedAt，门店移项目时重接订阅 |
| 大区基础信息（本期） | 精确 regionRef，关联当前项目 | organization / E13 | REGION 自身原始 updatedAt，不是推导业务排名 |
| 集团基础信息（本期） | 精确 commercialGroupRef | organization / E13 | 商业集团原始 updatedAt，不与集团空间配置混用 |
| 门店经营规则（本期） | 精确 storeRef 的经营规则 topic | organization / E1、E10 | 已保存于门店 root JSON，与 store.updatedAt 同次更新；可同次HTTP读，不必再建时间 |
| 门店 valid 合同结果集 | 范围 storeRef + 显式 ACTIVE 状态 | store-contract / E2 | 缓存无序 refIds，集合变化按 A/B；不使用自然到期筛选 |
| 合同详情 | 精确 contractRef + 授权门店 | store-contract / E2 | 采用合同原始 updatedAt，保留乐观锁 version |
| 服务点区域目录/详情（本期） | 范围 storeRef+area.status=ENABLED / 精确 areaRef | organization / E3、E14 | 全门店无序范围；状态退出用A；排序只改变精确详情 |
| 服务点目录/详情（本期） | 范围 storeRef+point.status=ENABLED / 精确 pointRef | organization / E3、E14 | 全门店无序范围；areaRef/排序变化走精确详情，不按区域拆范围 |
| 服务点二维码配置 | 精确 storeRef | organization / E3 | 有 updatedAt；建议并入服务点快照，是否独立 topic 待定 |
| 门店业务渠道目录/详情 | 范围 storeRef / 精确 channelRef | business-channel、collaboration / E4 | 模板和协作绑定也影响可用结果，不能只看 channel 行 |
| 可销售菜单目录 | 范围 storeRef + channelRef | sales-menu / E5 | 不等于草稿目录；原始时间来源未闭合 |
| 已发布菜单内容 | 精确 storeRef + menuRef + channelRef | sales-menu / E5 | 有发布时间，但不覆盖全部可售状态变更 |
| 菜单停售/沽清状态 | 精确 menu/item 与渠道 scope | sales-menu / E5 | changed time 为局部事实；可独立轻状态 topic 或并入快照，避免无必要的大菜单重取 |
| 商品/规格 | 精确 dataNodeRef + brandRef + itemRef | catalog / E6 | 只在 feature 直接消费商品时纳入，不强迫菜单消费者订阅所有源数据 |
| 商品字典/单位/属性/加料/生产标签 | 范围 dataNodeRef + brandRef | catalog / E6 | 可按同一下载快照组合，范围删除限制需明确 |
| 库存目标及可用性 | 精确 scope + targetRef 或有限业务聚合 | inventory / E6 | balance 原始 updatedAt 已有；历史 ledger 不默认订阅 |
| 当前登录人员信息/有效权限 | 精确 workspace + accountRef + assignment/context | workspace-iam / E7 | 登录示例需要真正 terminal 店员身份；有效权限不是 account.updatedAt 单字段 |
| 终端业务配置/状态 | 精确 terminalRef | store-terminal | 仅在有业务配置消费者时纳入；激活撤销继续用既有专门机制 |
| TER 使用的扩展字段定义 | 精确 hostType / 范围 workspace+hostType | extension | 仅真实 feature 需要的字段；不是全部后台元数据自动下发 |
| 渠道协作绑定有效状态 | 精确 channel/bindingRef | collaboration | 可并入渠道结果；不下发外部系统凭据/adapter 秘密 |

未来候选：未完成订单范围/精确订单、会员/顾客、交易/支付/退款、权益、厨房任务等。
它们需要真实 CBS owner 和业务需求，不把 sample 本地 member list 当作已有 CBS 会员模型。
audit、invitation、OTP、session 内部表、资产上传 staged 状态及平台控制面不自动成为 TER topic。

**已裁决本期范围**：基础设施 + store-basic 的七类 topic + store-service-point 的区域/服务点目录与详情
真实闭环，另包含原始需求中的 helloWorld 远程 request；准确 feature 清单以 §3.7 为准。
不以 store.updatedAt 冒称能覆盖集团/项目/大区或品牌/租户等其他实体变化。
合同范围为显式 valid 搜索结果，集合成员必须登记详情订阅，移出成员取消本包订阅。
其余族完成 catalog 语义盘点，不在本批实现所有业务消费者，不把候选列表视为交付全集。

## 5 · C：远程 command/request 链路

### 5.1 · 通用执行与 CBS 管理范围

```text
CBS 业务模块调用 terminal-control 公开 command API（本期以 helloWorld 能力闭环）
  → terminal-control 核对 contract 内允许下发的 command 定义、目标和期限
  → 读取目标终端绑定与权威当前在线 session，建立本次操作/request 关联
  → terminal-control 持久化发送记录/本次意图；失败则不下发
  → 通知当前 owning TDS 节点，投递有界 command envelope
  → TDC 校验 session/关联/JSON payload，解析已安装注册的 command
  → 普通 runtime dispatcher 创建 request，执行已有 actor/业务 owner 逻辑
  → 读取 request执行状态/结果selector；TDC保存本次远程操作过程与结果到终端持久化
  → 在线按contract回传；断链保留待补报记录，SESSION_READY后补报既有过程/结果
  → TDC → TDS → terminal-control 公开 command，按操作关联持久化执行过程/结果
  → 调用方通过 owner 公开 read API 取得已记录状态；TER 读取仍使用 selector
```

**terminal-control 的责任闭包（已明确）**：计划位置为
`apps/backend/catering-business-server/modules/terminal-control`，本轮不创建源码目录。
该 owner 拥有远程操作身份、发送记录、执行过程、执行结果与查询能力，使用现有 PostgreSQL 的
owner schema 和单一 Flyway history；不拥有终端凭证、业务实体或 TDS 当前会话事实，不写 Doris。
未来业务模块通过其公开command/read API集成，不直接写它的表；TDS只做协议转发与关联，
不另建发送历史或结果事实库。TDC按下述裁决保存本终端执行记录。既有CBS API规则
不因本期新增模块而变成内部HTTP client。
终端TDC持久记录是本终端执行事实及尚待补报的具名保存，CBS terminal-control拥有服务器侧
操作记录；不属于复制feature业务事实，也不能据此把TDS升级成业务写入owner。

TDS 转发和关联，不在 Java 侧“执行 TER command”。TDC 使用现有 dispatcher，不复制 command
定义、不加载远程脚本，不绕过现有实例角色、激活、owner、内部公开边界和 payload 规则。
“任意 command”理解为通用管道能承载任意已注册 command；CBS 可发的集合由 contract 决定，
不在 TDS/TDC 按业务类别再建一套白名单。如何受控解析当前 runtime internal/public 注册定义需详设核实，
不能为通用性公开所有 private owner 写 seam。

远程目标首先为连接 TDS 的 MASTER 终端 runtime；`target:peer` 在当前 runtime 中指配对副机，
不代表服务器。若某 command 自身按批准拓扑路由到副机，应由其已有 owner 规则决定；服务器不得伪造
routeContext、SLAVE/MASTER 资格或本地准入事实。服务器和终端双侧都按 contract/注册定义验证输入。
未知 command、未安装能力、不支持协议、非法参数和失效身份给出可区分结果，不算成功执行。

**本期不建设管理面或权限模型（已裁决）**：terminal-control 是供 CBS 内部业务模块调用的纯能力，
不新增 admin 页面、管理 HTTP 暴露面、角色/capability 或“谁能点下发”的产品流程。
未来调用业务自行拥有其业务准入；本期仍核对真实目标绑定、在线 session、消息来源/关联和 contract
输入，不因“无权限功能”绕过已有终端鉴权或允许跨身份回包。helloWorld 验证走受管能力链，
不为测试制造一个未授权的公开管理 endpoint。

### 5.2 · 结果与失败语义

本地 request 有 started/completed/partial-failed/timed-out/error，结果读取复用既有 selector。
wire requestId 与本地 requestId 保留明确映射/关联，避免覆盖已有 request；重复 wire 消息不重复执行
同一仍在运行的 command。以会话内有限关联去重即可讨论，不默认跨重启 exactly-once 持久框架。
子 command 维持 parent/root request 关系；回传按批准 schema 取结果，不导出整份 ledger 或 owner state。

**执行语义（已裁决）**：仅在线下发；离线明确未送达，不排队补执行；任意有副作用 command
不自动重放。已经送达但断链/超时/结果丢失，标为“执行结果未知”，不能声称未执行。
本地 actor 的 Promise.race timeout 不会保证底层动作已停止（runtime
`createCommandActorDispatcher.ts:289–294,326–345,389–401`），因此远程 timeout 也不表示回滚。
取消激活、重启等会切断自己的结果通道，必须允许结果未知，不能保证每种 command 必有最终回包。

本地requestLedger当前的 `persistIntent:'never'`、`syncIntent:'isolated'`
（`apps/terminal/kernel/base/runtime/src/features/slices/requestLedger.ts:145–153`）不能满足新增终端持久记录。
本期应由TDC保存与远程操作关联的过程/结果，复用现有持久化能力，不将全部本地runtime ledger改为持久化。
**持久化要求（已明确）**：发送记录、执行过程和执行结果均保存在CBS terminal-control；终端
也保存本次远程执行的过程/结果并在重连后补报。不能只留最终response、日志或TER内存ledger；
两端重启后须能读回各自已成功持久保存的记录。

| 记录类别 | 最小可核验内容/来源 | 失败及边界 |
| --- | --- | --- |
| 发送记录 | 操作身份、command 定义、contract 允许保存的参数、目标/绑定/session、关联 request、期限、创建/发送时间及发送状态 | 发起意图先保存；在线检查失败/投递失败也记录实际状态。“提交到通道”不等于终端收到或执行 |
| 执行过程 | TDC 从现有 request 执行观察/selector 取得的接收、开始、执行中、结束/失败阶段及时间；按需保留已存在的 actor/子 command 关联 | 只保存实际观测/收到的事实，不伪造断链期间进度；重复/乱序回包不覆盖较新阶段，父/root 关联不能丢失 |
| 执行结果 | contract 允许返回并保存的结构化结果、终端错误/超时事实，以及 CBS 截止/断链的结果未知状态 | 终端明确失败与 CBS 未获结果分开；结果未知须作为可查记录保存，不能填默认成功或宣称动作已回滚 |

“执行过程”至少覆盖现有 request/actor 生命周期，不要求每个业务 command 新增百分比进度或
任意业务日志流；具体有限阶段、字段和 wire 由 contract/详设确定。不能只在结束时保存快照就
宣称已经保留执行过程，也不能为该要求持久化全部 runtime ledger、业务 state 或 raw 日志。
保存参数/结果需按 contract 的有限 schema，现有凭证/隐私脱敏规则继续适用，日志不是记录的替代。

持久记录不是待执行队列。CBS/TDS/TDC 重启或恢复连接不会扫描旧记录补发 command；
已中断且不能取得执行事实的操作如实保留已知阶段并标结果未知，既有业务事实不因此回滚。
晚到且关联有效的结果保存为晚到事实，不抹除曾超时/未知的过程，不自动重新执行；
**终端保存与补报（已裁决）**：TDC对远程操作关联的执行过程/结果走现有终端持久化能力，
在线发送和重连补报复用同一事实回传command链。持久记录保留原操作身份、目标绑定、wire/local
request关联及执行发生时间；补报采用当前有效连接，不能把旧记录重新绑定到新的门店/操作。
具体失效绑定的历史记录接纳规则由contract/详设明确，不能静默丢弃或冒充新身份。

补报接收必须幂等并能识别重复/乱序的过程记录，不能让旧阶段覆盖完成阶段；CBS确认已持久保存
后，终端才能把相应记录标成已补报，不能以WebSocket发送成功代替持久接收确认。
确认丢失时重报同一份事实，不再次派发原command。TDC应用重启只恢复记录/补报状态，
不恢复actor执行；崩溃时未能保存的阶段不能凭空重建，CBS仍可保留未知直到收到真实后续事实。
终端持久化失败必须可观察，不能报“过程已可靠保存”。容量、单记录上限、保存期限与释放条件
由正式需求/详设明确，不允许静默删除未确认的记录；仅保存本次远程request相关事实，不建设
通用消息队列、完整日志流或全部本地command历史。补报不得饿死心跳、topic通知和新在线操作。
保存期限/清理策略在正式需求与详设中明确；本轮未裁决一个天数，不将未裁决期限作为删除记录授权。

### 5.3 · helloWorld 与有限容量

建议在合适 kernel/base owner 中定义无副作用 helloWorld command，经 request 返回结构化 appVersion、
机型、当前实例角色和允许公开的能力摘要等终端信息。确切字段由 contract 决定；不返回凭证、
代理密码、人员信息、raw payload 或整个状态。它不改业务状态、不操作 UI、不承担升级/日志上传/重置。

消息、结果、inflight 与计时器必须有界；沿用现有 JSON-safe 与 actorResult 上限，并符合共享协议
65,536 字节完整消息/解压上界，不凭空扩大或以压缩后小于限制绕过。超限明确失败，不能截断结果后报成功。
topic 突发、HTTP 失败或远程慢 command 不能阻塞原有 PING/PONG、绑定撤销和会话接管。
诊断关联 topic 类型/脱敏 scope、session、request、阶段和失败原因，禁止打印原始 payload/凭证。

## 6 · 旧分析中保留与不搬运的内容

本轮回顾的是本仓历史分析，不重新运行或接入 newPOSv1：

- `doc/review/platform/2026-08-27-v2s-terminal-poc-analysis-and-ter-design-discussion-claude.md`：
  旧 TDP 用 WS 推送和 HTTP 拉取；后续放弃 SSE，不能复活旧 RTKQuery 建议。
- `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/k-10-tdp-sync-runtime-v2-claude.md`：
  保留 command 广播解耦经验；其全量 projection、分块快照、scope 优先级、cursor/hash 与旧 catalog
  不适合本次“时间提示 + feature HTTP”的轻量目标，不搬。热更新、日志上传挤进同包的 owner 混杂应避免。
- 同目录 `k-09-tcp-control-runtime-v2-claude.md`：动作与事实广播可复用；空 actor 不必造。
  旧“副屏持凭证”“取消 server-config”已被当前裁决取代。

旧 Terminal Data **Plane** 的英文展开也由本次 Terminal Data **Platform** 命名取代。
历史 POC 的成功、失败和当时设计建议均不是本专项当前实现或动态证据。

## 7 · 待讨论决定与后续验收目标

| 编号 | 问题与最小候选 | 当前状态 |
| --- | --- | --- |
| Q-1 | 范围按A/B；在线真实变化即使同值也通知，初次/重连按不相等核对；接受同值漏通知不能全部发现的限制 | 已裁决；不改原始时间、不承诺绝不漏更新 |
| Q-2 | 首次用 feature 计算时间；后续成功刷新只确认指定更新，TDC采用该通知的服务端时间。空集合 0→通知100→仍空→确认→TDC100 | 最新裁决取代跨包覆盖/WARN；不建时间冲突机制 |
| Q-3 | 本期新增 store-basic 与 store-service-point，订阅全集见 §3.7；激活成功先HTTP，更新广播复用刷新command；合同集合驱动详情订阅/退订 | 已裁决，替代旧“少量门店/合同”范围建议 |
| Q-4 | command仅在线执行/不补发；CBS terminal-control持久保存发送/过程/结果，终端也保存过程/结果并重连补报；本期无管理面/权限模型 | 已裁决；补报事实不重新执行command，保存期限等留待正式需求/详设 |
| Q-5 | MASTER TDC 本机广播，主机 feature 接收/订阅/下载/持久，业务数据同步到 SLAVE；副机不另订阅或刷新 TDP 数据 | 已裁决，撤回旧副机独立 consumer 建议 |
| Q-6 | feature首次空0；CBS范围refIds与A/B时间持久保存到PG，重启保留成员退出时间；从未建过的初始空态仍需明确 | PG存储已裁决；服务器初始空表示尚待明确，不再讨论纯内存恢复方案 |
| Q-7 | 同一业务事务改变多个成员时 A 的归属：建议本次真实修改共用一个业务 now，或取真正触发成员变化实体的原始时间最大值；不得取当前系统时间或人工递增 | 批量触发时间待明确，单实体 A 已裁决 |
| Q-8 | 两个目录均为全门店仅启用集合，分别使用 area/point 自身 status=ENABLED，服务点不按区域拆范围 | 已裁决；不沿用 operations 的非VOIDED谓词或派生可用性 |
| Q-9 | X确认/Y失败由Y本包处理业务刷新/失败；不由TDP建立统一恢复、全包屏障或统一重试次数 | 已裁决；各feature自己的状态与command负责 |

正式需求的验收需覆盖以下反例，但本轮 **全部 NOT_RUN**：

1. 激活成功后，无论旧版本有值/为空都 HTTP→slice/持久→登记；ready 先/后于 HTTP 均不漏订阅，
   已激活重启/迟加载的初始化、身份更换、旧 session 回包、退订后迟到 HTTP。
2. 首次空集合登记0；收到服务端100后HTTP仍为空，确认使TDC记100而非0；重复/迟到确认与
   100刷新期间收到200不能误确认200。多包各自刷新/确认，不上报重算时间、不做冲突WARN；
   一包失败不冒充全部成功，失败包自行处理；不验证或建设TDP统一业务HTTP重试。
   迟加入包不漏核对，退订一方另一方继续，重连不退回初始0。
3. 精确更新、同毫秒、倒退时间；范围无序 set 相等、空→非空 B、非空→空 A、非空变更 A，
   scope 移动影响前后范围；内容变化不更新范围；自然到期不改变本次显式状态搜索结果。
4. 先订阅后查询与并发变化、listener 重建、多 TDS 节点、通知漏失/队列满的明确恢复或限制。
5. terminal HTTP 真实授权、跨门店拒绝、权限撤销、数据/时间一致快照、失败不推进本地时间。
6. helloWorld 真正 CBS terminal-control→TDS→TDC→actor→request过程/结果→terminal-control；
   三类记录可在CBS重启后读回；终端过程/结果持久化、断链期间保存、终端重启及重连补报读回，
   未知command、非法payload、超限结果可区分。
7. 离线拒绝/无补发、持久化失败不发送、在线检查后断链、重复下发、过期绑定/session、
   过程回包乱序/重复、执行中断链、actor timeout 后实际完成；未知记录及晚到结果可查，
   不能把未知写成未执行，恢复连接/服务重启不得补发旧操作。
   补报重复/乱序、CBS持久接收确认丢失、换绑定旧记录、终端持久化失败/容量达到边界，
   均不能触发原command再次执行、静默丢记录或假报已持久接收。
8. topic/command 压力不破坏心跳与撤销；资源释放、计时器/inflight 清理、脱敏日志均需真实证据。
9. 双机只 MASTER 订阅和广播，主机 feature 业务数据及时间经既有同步到 SLAVE；副机本地草稿不被覆盖，
   无独立 TDS、订阅或 TDP HTTP 刷新；非 adapter 行为先 Expo Web 再 VM/device，
   按 TR-16 同场景验证。没有 UI 交付不免除 infrastructure 的实际运行证明。
10. store-basic 的七类事实分别带自身时间；门店→项目→大区→真实集团引用链、移项目退旧订阅。
    合同 `{A,B}`→`{A}` 退 B、`{A}`→`{A,C}` 拉取/订 C、空集合退全部详情但保留范围，迟到 B 不能恢复。
11. store-service-point 的全门店ENABLED区域/服务点目录与详情、成员新增/停用/作废退出、区域归属变更，按 Q-8 验证；
    reorder 不改无序范围版本，但精确详情更新。新增详情失败、退订失败及恢复可观察，不报全成功。

当前仅形成讨论稿和术语维护；未生成、编译、测试、verify、backend-acceptance、DEV、reset/seed、
L2、UAT、部署，也未验证业务、adapter 或 cleanup。后续确认需求后再制定详设与受管验证计划。

## 8 · 静态证据索引

下列路径均相对仓根；controller 已存在不代表 terminal consumer 已可用。

| 编号 | owning source 与定位 |
| --- | --- |
| E1 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationEntityReadback.java:6–23`；同目录 `StoreOperatingRuleReadback.java:7–12`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreProfileController.java:69–103` |
| E2 | `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractCommandService.java:242,803–835`；同目录 `ContractTaskReadService.java:119–134`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/contract/OperationsContractController.java:119–173` |
| E3 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/StoreServicePointOwnerApi.java:61–110`；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreServicePointController.java:107–276` |
| E4 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java:161–213` |
| E5 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java:98–124,167–208`；`apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/api/SalesMenuReadback.java:23–53`；同 owner `application/SalesMenuPublicationService.java:103–138`、`application/persistence/SalesMenuManualSaleServiceSql.java:5–23` |
| E6 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java:147–218,241–406`；`apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/persistence/InventoryTargetServiceSql.java:63,239,295,342` |
| E7 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/context/OperationsWorkspaceUserController.java:100–292`；`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceAccountService.java:85–110,137–150`；同目录 `WorkspaceRoleService.java:203–237` |
| E8 | `apps/backend/catering-business-server/modules/foundation/src/main/java/com/catering/v2s/platform/foundation/time/SystemTimeProvider.java:8–9` |
| E9 | `apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/persistence/TerminalBindingOwnerPersistence.java:264–274` |
| E10 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/persistence/StoreServiceSql.java:16–33`；同 owner `application/StoreService.java:481–495,562–605,619–634`；经营规则列迁移 `apps/backend/catering-business-server/src/main/resources/db/migration/V20260916_090000_000__store_operating_rule_switches.sql:1–4` |
| E11 | `apps/backend/catering-business-server/modules/store-contract/src/main/java/com/catering/v2s/contract/application/persistence/ContractCommandServiceSql.java:12–22,40–45`；同目录 `ContractTaskReadServiceSql.java:17–21`；后者 CURRENT/PENDING/HISTORY 有日期筛选，不直接用作本次 valid 范围 |
| E12 | `apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts:51–81` 已有 master-to-slave 与本地分支状态保留；`apps/terminal/kernel/base/state/src/types/sync.ts:4–16,40–64`、`apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts:160–166,272–289,303–314` 为已有同步方向/会话准入 |
| E13 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/CommercialGroupLookup.java:5–15`、同目录 `CommercialGroupReadback.java:6–16`、`OrganizationNodeReadback.java:7–22`；同 owner `application/OrganizationHierarchyService.java:28–29,1178–1188` 为集团/节点区分及 parent 规则 |
| E14 | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreServicePointService.java:74–109,225–264,288–289,914–928`：operations 目录谓词/分页为参考，不是 TER 产品裁决；Area 详情方法当前 private |
| E15 | `apps/terminal/kernel/base/terminal-data-client/src/types/client.ts:21–28`、`src/selectors/selectTerminalDataClientState.ts:16–33`（同包）提供 credential/不含秘密的激活摘要；`apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/api/TerminalCredentialVerificationApi.java:53–68` 提供服务端权威绑定scope |
| E16 | `apps/terminal/kernel/base/terminal-data-client/src/features/commands/terminalDataClientCommands.ts` 尚无成功事实command；同包 `src/features/actors/terminalDataClientActor.ts:493–529` 激活成功路径、`src/application/createTerminalDataClientModule.ts` 初始化接线只作为当前事实，不宣称本期启动链已实现 |
| E17 | `apps/terminal/kernel/base/runtime/src/types/execution.ts:17–44` 定义 actor 执行阶段/结果；同包 `src/foundations/createCommandDispatcher.ts:169–190` 写生命周期观察到 ledger；`src/features/slices/requestLedger.ts:145–153` 明确不持久化。静态定位 CBS modules 未见 terminal-control，新增位置只是已裁决需求 |

静态能力复用依据：`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/terminal-coding-standard.md`、
`doc/platform/backend-coding-standard.md`、`project-memory/decisions/deterministic-context-only.md`、
`doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`、
`doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md`。
记忆路由使用 `design / platform / backend / platform / architecture / task-start`，本轮 CBS 时间盘点另用
`design / backend / backend / backend / database / task-start`；命中原文与当前 owner
是定位依据，不能推导实施授权。两名只读 source audit 的结果由主 agent 汇总；不构成独立 DESIGN verdict。

## 9 · CBS 更新时间全模块静态盘点

覆盖当前 18 个 modules 的迁移与生产 SQL 定位，并重点重开门店、合同、菜单、终端、商品状态、
权限和扩展写路径；**不是全部生产文件逐行审查**。考虑后续迁移删除/搬运，旧表不计作当前实体。
例如旧 contract_item 已删除；经营规则在 store JSON；生产标签当前 owner 为 catalog。
以下“复用”只表示具备可用原始时间事实，不代表新 topic 或 terminal HTTP 已实现。

| module | 原始时间现状 | 统一判断 / 明确例外 |
| --- | --- | --- |
| organization | 组织节点、品牌、租户、总公司、门店、服务点/区域/二维码配置有 created/updated | 可复用；门店经营规则/扩展归 root 时间，不据子表字段缺失误判聚合缺时间 |
| store-contract | root created/updated；失效另有 invalidatedAt；items/扩展同事务归 root | 首批直接复用 root updatedAt；状态时间仍保留其独立含义 |
| workspace | workspace created/updated/statusChanged | 实体 updatedAt 与状态发生时间不可互换 |
| workspace-iam | account/role/assignment updated；credential changed；session/invitation 有专门生命周期时间 | 可变实体复用；用户有效权限需列多实体依赖，不取 account 时间代替全部 |
| platform-admin-iam | admin created/updated；凭证、session/recovery/OTP 的专门时间 | admin 可复用；不为安全支撑表强加业务 updatedAt |
| extension | 当前 definition root updatedAt + revision，字段子表已退役 | 可复用定义 root；不恢复已退役表或人工逐字段时间 |
| catalog | item/category/dictionary/属性定义/unit/productionTag 有 created/updated；SKU 后补 updated | 根与独立 SKU 按实际消费边界使用；图片/组合/标识等关系变更须核对 root 覆盖，不复制时间账本 |
| inventory | stock_target created/updated、BOM updated；ledger 为 occurredAt | 可变目标/BOM 复用；不可变账本为事件例外 |
| business-channel | template/channel created/updated；visibility 无独立时间 | 原生 root 可复用，visibility 属其 root；协作有效性仍需声明真实依赖 |
| collaboration | enablement/binding created/updated，另有 statusChanged/unbind/revoked/deleted 时间 | 保留实体时间与生命周期时间区别，不统一成单个 MAX |
| sales-menu | 多数可变 collection/version/activation/section/item 无通用 updatedAt；publish occurredAt、manual sale changedAt 局部已有 | 当前主要缺口；未来纳入时补真实聚合 updatedAt，不能用 revision 或发布时间冒充全部修改时间 |
| store-terminal | terminal created/updated；receipt created、audit occurred | 实体复用，receipt/audit 不当业务版本 |
| terminal-binding | activatedAt/endedAt/mostRecentEndedAt，无 generic updatedAt | 保留绑定专门机制与生命周期事实，不为本批门店/合同闭环强改 |
| asset | staged/activation/release/cleanup/consumed 等生命周期时间 | 不为 TDP 统一改资产技术表；业务图片引用变更归消费聚合 |
| audit-model | 不可变事件 occurredAt | 不适用可变实体更新时间 |
| audit-read | 只读查询 | 没有新的实体更新时间 |
| execution-context | grant/context/token 等类型与校验 | 没有持久化业务实体，N/A |
| foundation | TimeProvider / SystemTimeProvider | 复用真实时间来源与单位，不引入逻辑递增时钟 |

**关键可验源码（路径相对 CBS 根 `apps/backend/catering-business-server/`）**：

- 门店/合同：E2、E10、E11；首批无需为了 TDP 新建原始时间字段。
  HTTP 时间来源须继续复用 owner task-read：合同写命令的
  `modules/store-contract/src/main/java/com/catering/v2s/contract/api/StoreContractReadback.java:7–21`
  本身没有时间字段，不能仅凭这个返回值就认为整条读取链无时间；已有 task-read
  `modules/store-contract/src/main/java/com/catering/v2s/contract/application/ContractTaskReadService.java:193–201,268–269`
  提供原始 createdAt/updatedAt。新 terminal face 仍须显式传导该事实并核对生成物，不能从 HTTP 收包时间补值。
- 菜单缺口：`modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/persistence/SalesMenuCollectionPersistenceSql.java:37–40`
  的 CAS 仅 version++；同目录 `SalesMenuDefinitionServiceSql.java:48–81` 及 E5 不构成全修改更新时间闭包。
- owner no-op 差异：`modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java:2868`
  可同状态 no-op；`modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerService.java:405–407,969–972`
  拒绝同状态迁移；门店同值 save 仍写 root（E10）。统一时间不授权统一这些业务接受/拒绝语义。
- 定义更新时间：`modules/extension/src/main/java/com/catering/v2s/extension/application/persistence/ExtensionDefinitionPersistence.java:49–81`；
  审计时间另取于同文件 `:133`，不能代替实体时间。
- 渠道与绑定：`modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelServiceSql.java:45–69`；
  `modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/persistence/CollaborationOwnerServiceSql.java:189–210`。

**盘点结论（建议）**：可以统一可订阅可变实体的原始更新时间语义；复用已有字段、补真正缺口，
保留不可变事件与具名生命周期时间。先把规范与消费映射统一，首批使用门店/合同已有 root 时间；
不把“先改造全仓每张表”设为本基础设施专项的前置。其余实体的实施范围待需求/设计授权，
并保留同毫秒、物理时钟倒退及赋值/提交顺序不同的限制。

## 10 · 当前需求的实现难度与合理性复查

本节是需求讨论中的可行性分析，**不是正式 DESIGN verdict**，不开启或替代独立对抗审查 cycle。
主 agent 重开本稿与当前源码，一名只读分析者补充反例；下面的建议未获裁决部分不改写已明确输入。
本轮未编译、测试或运行环境，不能据静态可复用能力宣称新增行为已经通过。

### 10.1 · 可实现性与主要工作量

整体可实现，工程工作量中等偏大；难点是完整的失败/并发链，而不是建立 WebSocket 本身。
已有激活、在线会话、心跳、跨节点会话权威、command/request、业务数据主副机同步可复用。
本期仍须新增 topic contract/生成、CBS 发布与范围缓存、TDS/TDC 订阅/确认、两包 terminal HTTP
读取和初始化，以及 terminal-control 的发送/过程/结果持久化；不能表述成只添加几种消息。
最新裁决另包含终端远程过程/结果的持久化与重连补报，工作量须如实纳入本期。

静态依据：当前 `contracts/policy/terminal-client-generation.json:7–15` 的生成输入与目标只覆盖
terminal-binding/TDC；区域/服务点当前 owner 目录为非VOIDED和按area分页，见 E14，不等于
本期全门店ENABLED集合。runtime已具备执行记录/selector（E17），但并未具备远程过程持久化链。
TDS现有出站队列容量为1，`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketConnection.java:30–32,88–101`
投递失败会返回false并记录诊断；新topic突发不能假定已具备自动补齐，需要有限合并/失败处理。

### 10.2 · 真正需要讨论的行为边界

| 项目 | 最短反例 | 建议与需确认的取舍 |
| --- | --- | --- |
| 时间戳与通知可靠性 | 两次业务修改都为100，终端已记录100；第二次通知未到，重连时间比较仍相等 | Dexter已接受限制；在线真实变化即使同值也通知，初次/重连按不相等核对，不增加人工版本或承诺绝不漏更新 |
| 同topic多包中部分刷新失败 | X/Y收到100，X成功确认使共享时间为100，Y HTTP失败，之后没有新变化 | Dexter已裁决由Y自己处理；撤销统一有限重试要求，不增加TDP恢复机制、全包屏障或服务端per-feature版本 |
| 执行过程的完整程度 | TER上报started后断链，actor继续完成，但CBS未收到completed | Dexter已选终端也持久保存过程/结果，重连补报。只补报真实保存的事实，不重新执行command；已丢失/未持久成功的事实不能伪造 |

首条的无监听历史边界参见 [PostgreSQL 16 LISTEN](https://www.postgresql.org/docs/16/sql-listen.html)：
通知针对当前监听会话，会话结束会清除注册；建立监听后需要查询当前状态再依赖后续通知。
这支持“listener重建后核对订阅”，不证明WebSocket投递失败或feature刷新失败已自动恢复。

### 10.3 · 留给技术设计解决，不扩大产品范围

- **范围缓存PG持久化已裁决**：最后成员退出后A=100、结果为空；直接持久保存有限派生
  `refIds + topic时间`并与相关业务变更一致提交，重启不丢100，不建设内存缓存恢复框架。
  从未建过缓存的初始空集合可建议0（CBS空态仍未裁决），不恢复消息队列或第二业务数据副本。
- **初次MAX与服务端A/B不同是允许的**：首次订阅可能多一次HTTP核对，再接受服务端时间即可；
  不要求feature猜出成员退出时间，也不改A/B裁决。
- **确认关联及旧请求隔离**：确认100不确认后来的200；一包确认不清除另一包失败；
  取消激活/换门店/退订后迟到响应不应用。使用当前身份、通知关联与本包刷新状态即可，避免通用仲裁。
- **远程持久化不需要事务包住网络**：先保存发送意图，再做在线投递，逐条保存实际阶段；
  中途服务崩溃保留已知事实并记未知，不扫描旧操作补发。不要求跨PG与WS exactly-once。
- **记录保留期限尚未裁决**：本期可建议不自动删除，不先建设清理调度/归档平台；
  正式需求仍需写明是否采纳。保存范围应为本次远程request相关记录，不是全部本地command历史。

以上建议的最终验收必须覆盖正常、并发、重复、乱序、断链、持久化/HTTP失败与重启，
本节没有新增实施授权，也未将这些计划验证标为PASS。
