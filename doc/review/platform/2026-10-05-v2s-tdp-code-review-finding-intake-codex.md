# TDP 生产代码静态 Review Finding Intake 与处置

```text
DATE=2026-10-05
REVIEW_TARGET=IMPLEMENTATION_CODE_STATIC_INTAKE
REVIEWER=Codex main agent
INPUT=用户转交附件 12157771-f273-4337-89aa-81aacaf27af9/已粘贴的文本.txt
SCOPE=正式需求、详设、生产源码及直接相关测试核验；后续最小修正见文末
RUNTIME_EVIDENCE=NOT_READ_BY_REQUEST
INITIAL_INTAKE_TESTS=NOT_RUN
INITIAL_INTAKE_WRITES=NONE
```

## 结论边界

Claude 的 13S/1N 是待核输入，本文件记录主 agent 的 intake 与后续最小修正，不是新的独立整批 verdict，也不重新评定原 reviewer 的严重度。最初的静态 intake 判断和当时“未改、未运行”状态保留在下文；后续修复与检查以文末处置更新为准。未读取 `.runtime/`、manifest、日志或历史运行 evidence。

原始判据以 [TDP 正式需求](../../plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md) 为准；实现边界以 [TDP 详设](../../plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md) 为参照。以下均为静态代码推导，不声称运行时故障已发生。

## S-1 — 合同集合读取额外按自然日期筛选

**Disposition：`CONFIRMED`**

- **依据：** 需求 R-05 第 137–138 行规定集合按当前 `ACTIVE` 状态定义，不按自然有效日期筛选。`TerminalDataReadController.activeContracts` 第 189–200 行调用 `fixedStoreContracts`；该 owner 查询的 `FIXED_STORE_VIEW_CURRENT` 在 `ContractTaskReadServiceSql.java` 第 17–18 行同时要求 `effective_from <= today` 与 `effective_to >= today`。
- **反例与影响：** 状态仍为 `ACTIVE`、但尚未到自然生效日或自然到期日已过的合同，会被终端 GET 排除；需求定义的集合及对应 snapshot 却仍包括它。正文、成员订阅与集合摘要因此可以分叉。
- **最小修正：** 在 contract owner 暴露受 scope 限定、只按 `workspace/group/store/status='ACTIVE'` 查询完整终端合同集合的 task read；保留运营查询的日期视图，不改其业务语义。
- **更小替代为何不足：** 在 edge 过滤现有分页结果无法找回 owner 查询已排除的合同；改 snapshot 条件则会把错误扩散到 TDS。
- **剩余不确定性：** 本轮未运行 HTTP 与 PostgreSQL 场景，失配是源码与规范对照结论。

## S-2 — 服务点集合受父区域启用状态过滤

**Disposition：`CONFIRMED`**

- **依据：** 需求 R-12 第 325、328 行定义全门店 `point.status=ENABLED` 集合，并明确不加父区域可用性。`TerminalDataReadController.readPoints` 第 343–359 行逐区域读取；第 345–346 行遇到非 `ENABLED` 区域就跳过。相反，snapshot 迁移 `V20261004_000000_000__terminal_topic_snapshots.sql` 第 44–51 行按服务点自己的状态聚合，不以父区域状态过滤。
- **反例与影响：** 区域 `DISABLED`、服务点自身仍 `ENABLED` 时，HTTP 集合不返回该点，snapshot 集合仍含该点，客户端会产生错误退订或成员变化。
- **最小修正：** organization owner 提供按完整门店 scope、只按 point 自身 `ENABLED` 条件的集合读取；edge 不再通过区域列表构造服务点全集。
- **更小替代为何不足：** 仅删除 `continue` 仍会遗漏不属于当前可见区域页的成员，且继续依赖按区域分页拼接。
- **剩余不确定性：** 没有动态证据证明某当前 DEV 门店具有此组合状态。

## S-3 — 精确区域/服务点详情拒绝仍存在但已停用的实体

**Disposition：`CONFIRMED`**

- **依据：** 需求 R-12 第 324、326 行要求精确详情返回实体自身状态与原始更新时间。区域 GET 第 253–256 行要求集合中匹配且状态为 `ENABLED`；点 GET 第 295–297 行在 owner 读取后再次拒绝非 `ENABLED`。owner 的底层精确读取 `StoreServicePointService.requireArea/requirePoint` 第 974–989、1005–1024 行可以读取非 `VOIDED` 行。
- **反例与影响：** 已订阅实体由 `ENABLED` 转为 `DISABLED` 后，精确 topic 可指示刷新，但 GET 把实体当作不存在返回 404，无法同步其退出状态。
- **最小修正：** 保留当前 binding、门店与完整 scope 核验，精确读取允许读取实体自身 `DISABLED` 状态；只对不存在、`VOIDED` 或越权 scope 返回拒绝。
- **更小替代为何不足：** 将 404 映射成成功或空对象会隐藏实体事实，不能令终端知道其真实状态。
- **剩余不确定性：** 直接 controller test 目前仅覆盖 owner DB 失败到 503 的映射（`TerminalDataReadControllerTest.java:34–61`）；本轮未执行测试。

## S-4 — 终端 DTO 包含原始 `updatedAt` 未覆盖的管理派生值

**Disposition：`CONFIRMED`**

- **依据：** 需求 §4.1a 第 367–370 行明确禁止将 `effectiveAvailable`、`qrUrl`、移动能力等管理派生字段当成自身原始时间已覆盖。`TerminalDataReadController.area/point` 第 482–520 行把 `canMoveUp/Down`、`effectiveAvailable`、`qrUrl` 投影进终端 DTO。`StoreServicePointService.pointReadback` 第 920–943 行显示 `effectiveAvailable` 来自 point 与 area 状态；point 读取第 273–280 行另读 QR 配置并计算移动能力。
- **反例与影响：** 父区域状态、二维码配置或邻接顺序发生变化时，派生值可变化而该 point 自身 `updatedAt` 不变；本期没有对应 topic 能令终端发现这些变化。
- **最小修正：** 终端 canonical DTO 与投影只含需求列出的实体自身事实，删除这些管理派生字段；不增加新 topic、联动或终端业务判断。
- **更小替代为何不足：** 保留字段但不发通知仍让客户端依赖无法及时失效的值；新增派生字段 topic 扩大正式需求。
- **剩余不确定性：** DTO 消费端和生成契约的实际影响范围需在获授权修复时同根盘点；本轮不作修改。

## S-5 — 完整集合使用可变游标分页拼接，源码未建立一致快照

**Disposition：`PARTIALLY_CONFIRMED`**

- **依据：** 需求 R-06 第 154–157 行要求完整范围结果来自一致快照。edge 第 331–360 行循环获取区域分页并逐区域拼接点分页。`StoreServicePointService.listAreas` 第 86–124 行先 count 再 select，游标按可变的 `(display_order, area_ref)`；`listPoints` 第 234–286 行同样分开 count/page，游标按 `(display_order, point_ref)`。这些方法只标 `@Transactional(readOnly=true)`；本轮在 CBS 源码中未找到该路径显式声明 `REPEATABLE_READ` 或等效快照设置。
- **静态反例：** 多个 SQL statement 之间若合法重排或成员状态变化，后续页按旧游标继续读可能重复或遗漏成员。只读事务本身没有表达跨语句固定 snapshot 的代码约束。
- **影响：** terminal GET 的 ref 集合与 max timestamp 可能不是一个一致全集，后续 hash/订阅差量无法可靠闭合。
- **最小修正：** 由 organization owner 提供一次完整、稳定、有序的集合 task read，在一个明确的一致快照内返回成员与其时间；edge 不拼接运营分页。
- **更小替代为何不足：** 只延长分页或改 page size 不会消除游标字段变动导致的集合漂移。
- **适用边界/未核实：** 这是源码缺少显式快照保证的确认；未核实部署数据库是否通过连接/事务配置强制更高隔离级别，也未执行并发实验。因此具体部署隔离及实际发生频率保持 OPEN，不能说已动态复现。

## S-6 — TDS 在原始时间回退时不发非在线唤醒

**Disposition：`CONFIRMED`**

- **依据：** 需求 R-04 第 111 行要求订阅和重连按“不相等”触发刷新。`TdsTerminalSessionActors.sendTopicChange` 第 716–736 行在非在线唤醒路径用 `currentTime <= lastAcceptedTime` 早退。
- **反例与影响：** 本地接受时间为 100、服务端权威原始时间回退到 90 时，重连/订阅读取被当作无需刷新，违反不相等语义。在线真实变化路径不受该条件影响，不能据此扩大到“同值在线通知被丢”。
- **最小修正：** 非在线只在时间相等时跳过；在线变化仍按现行机制通知。覆盖初始订阅、接受后重读、listener 重建的倒退值。
- **剩余不确定性：** 本轮仅静态核对；是否存在实际倒退数据未调查。

## S-7 — 合法新门店的空合同集合缺少 snapshot 行，导致关闭订阅连接

**Disposition：`CONFIRMED`**

- **依据：** `TdsTerminalTopicRepository.readTime` 第 60–61 行将无 snapshot 行返回 `OptionalLong.empty()`。订阅流程对无时间值作拒绝并关闭的逻辑见 `TdsTerminalSessionActors.java:597–615`。Flyway 第 53–70 行只为迁移时已有 `organization.store` 插入合同集合 snapshot；后续创建门店的 owner 初始化位置 `StoreService.java:497` 仅初始化服务点区域/点集合，不插入合同集合 snapshot。
- **反例与影响：** 新门店尚无合同且没有合同 mutation 时，空合同集合是合法业务状态，但该 topic 无行；TDS 将合法订阅误判为非法并关闭整条连接。
- **最小修正：** 在合法 store scope 下，将首次缺少的集合 snapshot 作为初始空集合基线处理；精确实体缺失继续按 typed 拒绝，不混为一谈。优先选不增加跨 owner 初始化桥的实现。
- **更小替代为何不足：** 仅在初次启动读取时绕过一次，后续 listener 重建仍会再次读到缺失行；迁移也不能预知未来新店。
- **剩余不确定性：** 未跑新店无合同的 TDS 场景；测试 `TdsTerminalTopicRepositoryTest.java:42–55` 只验证存在行的路由。

## S-8 — TDS 报告同时要求原目标 session 和当前 session，且未复核当前 binding

**Disposition：`CONFIRMED`**

- **依据：** TDS `TdsWebSocketHandler` 第 559–577 行用当前连接的 `sessionId/nodeId` 填报告。owner 函数 `accept_terminal_report` 在 `V20261004_020000_000__terminal_control_online_operations.sql:109–118` 要求报告 session/node 等于操作创建时 target session/node；该函数片段没有读取当前 `terminal_binding.latest_binding` 复核有效绑定。对应 claim 路径另有 active binding/session 校验。
- **反例与影响：** (1) 同一有效 binding 正常重连后，新连接 session 与原 target session 不同，合法旧操作报告无法通过；(2) 旧 socket 尚未处理撤销时，原 target session 仍匹配，但 binding 已结束，报告路径缺少当前 binding 复核。
- **最小修正：** 保留 operation/request/原 binding 身份；owner 核验报告来自当前仍有效的 binding 与当前连接，同时允许同一 binding 的新 session 补报其原操作事实。不可简单去掉 session 条件。
- **剩余不确定性：** 本轮未运行 SQL 权限/报告场景，也未声称已观察到错误接纳。

## S-9 — peer 命令终态丢 actor 结果，且普通调用 timeout 后的迟到结果通道不交付结果

**Disposition：`CONFIRMED`**

- **依据：** `createCommandPeerDispatcher` 第 127–141 行接到 gateway 的 completed `actorResults`，但 `emitActorTerminal` 第 162–173 行将 record `result` 固定为 `null`。peer promise 在本 Runtime 自身 timeout 后才完成的路径，第 174–220 行只写 late diagnostic，不调用 `lateOutcome` 传实际结果；另一条 gateway `onLateResult` 路径第 107–125 行则确实会传 record。
- **反例与影响：** 在 peer 在本地普通 timeout 前完成时，终态 actor record 丢实际值；若 gateway promise 先于 Topology 对端期限返回但已晚于此 Runtime 的 actor deadline，迟到实际结果只进诊断而没有交给业务 handoff。不是每一条迟到路径都丢失：第 107–125 行的显式回调是反例边界。
- **最小修正：** completed 终态保留实际 `actorResults`；将本地 timeout 后收到的实际结果送入同一有界 observer/handoff，并防止重复交付。
- **测试现状：** `runtime/test/actorResult.test.ts:129–177` 覆盖本地 actor 的 late observer 与 TTL，不覆盖 peer dispatcher 的两种路径。
- **剩余不确定性：** 未执行 peer 两端动态时序。

## S-10 — 单个迟到 actor 被误当成整个命令终态

**Disposition：`CONFIRMED`**

- **依据：** TDC late callback `terminalDataClientActor.ts:621–634` 只从 late callback 收到的 `records` 计算 `every(completed)`，随即报告整条 command `COMPLETED/FAILED`。它未合并首次 timeout 结果中已经完成的 actor，也没有等待所有超时 actor。对端 `createTopologyPeerCommandController.ts:295–305` 每收到一个 late record 就释放整条 active request 并只发 `[record]`，后续 actor record 没有对应槽位。
- **反例与影响：** 多 actor 命令中，A 迟到成功时 records 只有 A，`every` 为真；B 后续失败/迟到时整条 request 已释放，CBS 可能先被报告成功或收不到 B。及时完成的 actor 结果亦不在晚到子集中。
- **最小修正：** 在现有 request 关联槽中按 actor 身份合并首次结果与后续迟到记录；仅所有预期 actor 均有终态时报告完整终态，观察期限结束仍保持 `UNKNOWN`。不新增第二 ledger。
- **测试现状：** `terminalDataClientActor.test.ts:2867–2900` 覆盖单 actor 迟到成功；未覆盖多 actor 混合及时/迟到成功/失败。
- **剩余不确定性：** 未做多 actor peer 运行证明。

## S-11 — 断线后的旧 callback 可按重用 commandId 释放新连接的槽位

**Disposition：`PARTIALLY_CONFIRMED`**

- **依据：** `createTopologyPeerCommandController.clearActiveRemoteCommands` 第 162–165 行清空 active map；`releaseActiveRemoteCommand` 第 287–294 行之后只按 `message.commandId` 查找并删除当前 map 值；`sendRemoteCommandResult` 在 `createTopologyModule.ts:261–269` 发送时读取当下 `currentSession`，并非捕获 callback 所属 session。Runtime `createCommandDispatcher.ts:526` 接受调用者提供的 `options.commandId`，类型在 `runtime/src/types/command.ts:78–89` 公开。
- **已确认影响边界：** 若连接 A 的旧 callback 到达时，连接 B 已以相同 commandId、不同 requestId 登记新槽，旧 callback 可删除新槽，并尝试通过 B 的当前 session 发送 A 的旧 message。现有代码未在 callback settle/late/expiry 时比较 active 对象身份或连接代次。
- **反例与适用边界：** Runtime 默认会自动生成 commandId；本轮没有证明正常生成器会自然重复。风险依赖显式重用 commandId 或上游复用，并非声称随机碰撞已经发生。公开 API 允许传入 commandId，未找到不可绕过的唯一性校验。
- **最小修正：** callback 仅可释放其创建的 active 对象，并绑定所属连接身份；不匹配时静默丢弃旧回调，不动新槽。
- **剩余不确定性：** 是否存在高层业务调用方显式复用 commandId 未作全调用点排查；当前实现本身没有防护。

## S-12 — 迟到 observer 的 TTL 可缺省，peer request 槽释放晚于期限且不检查到期

**Disposition：`PARTIALLY_CONFIRMED`**

- **依据：** Runtime options `types/command.ts:78–89` 允许 observer 存在而 `lateResultTtlMs` 缺省；`createCommandActorDispatcher.ts:129–143` 只在两者同时存在时安装 observer expiry timer。Topology wire parser `contracts/src/foundations/topologyWire.ts:184–210` 对有传 TTL 的 wire 值限制 1–7,200,000ms。Topology receiver `createTopologyPeerCommandController.ts:259–285` 先设普通 call timeout；到它超时后才设置基于 `expiresAt` 的 timer，第 295–305 行收到 late record 时不检查 `expiresAt`。发起端 pending 槽第 373–402 行亦先等普通 timeout 才设期限 timer。
- **反例与影响：** API 调用方如传 observer 不传 TTL，Runtime observer 无自动到期；对端传入短于普通 call timeout 的 TTL，receiver/pending 槽仍至少保留到普通 timeout，且期限之后、该 timeout 到来之前收到的 late record可被接受。wire 的两小时硬上限不是按调用方 Runtime 配置计算出的有效上限。
- **反例边界：** 当前 TDC 生产调用 `terminalDataClientActor.ts:636` 确实传入 `remoteResultResidenceMs`，因此不能说该条 TDC 调用遗漏 TTL。Runtime 局部测试 `runtime/test/actorResult.test.ts:164–177` 已覆盖“显式 TTL 过期后丢弃”；未覆盖 observer 缺 TTL 与跨普通 timeout 的 Topology 槽。
- **最小修正：** observer 注册要求有限 TTL，wire 与收发两侧按同一有效上限校验；从槽创建时就安排 expiry，处理 late result 前再次检查期限；普通 command timeout 与 observer residence 分开。保留单一现有槽，不建 ledger。
- **剩余不确定性：** 当前业务是否只通过 TDC 带 TTL 需要进一步排查；结论不扩展为其已发生泄漏。

## S-13 — 清理 map 与阶段写入/失败回滚交错时可重新插入旧 operation

**Disposition：`CONFIRMED`**

- **依据：** `persistRemoteFact` 第 440–450 行先无条件 put，再 `await flush`；flush 失败时又按捕获的 `previous` 无条件 remove/put。远程命令路径第 598–617 行在 RECEIVED 与 STARTED 写入之间有 await，STARTED 完成后才 dispatch。配置切换路径第 1601–1621 行清 map 并 await flush；Runtime reset 也可异步清除状态。Runtime 的 actor handler由 `Promise.all` 调用（`createCommandDispatcher.ts:631–644`），源码没有跨独立 root 的全局串行锁。
- **反例与影响：** 旧 operation 的阶段 flush 尚未完成时，配置切换/root reset 清空 map；旧 await 恢复后仍可写入 STARTED，随后以闭包中的旧 credential dispatch。若旧 flush 失败，其回滚也可能把被清理的 prior fact 放回。现有身份检查不在每个 await 之后、每个 map mutation 之前执行。
- **最小修正：** 每个 await 返回后、阶段提交/回滚及 dispatch 前检查原 map 项仍存在且 operation、binding、address/config revision 身份相符；被清除的旧 operation 不得 put 回。无需全 Runtime reset 仲裁。
- **测试现状：** `terminalDataClientActor.test.ts:2905–2967` 已测命令结束后再清理、再送 late callback 不复活；没有测 RECEIVED/STARTED 持久化 pending 时发生清理。
- **剩余不确定性：** 未运行交错测试或真实持久化失败场景。

## N-1 — typed REGION/PROJECT 创建漏发 topic 通知

**Disposition：`CONFIRMED`**

- **依据：** 正式需求 R-18 的 `NODE-PROJECT`、`NODE-REGION` 接线表第 388–389 行要求创建成功后登记对应节点精确变化。typed `createRegion(CreateRegionCommand)` 与 `createProject(CreateProjectCommand)` 第 91–153 行经过 receipt 后进入 typed 私有 create，第 314–356 行完成 INSERT、phase、readback、audit 后直接返回，无 topic hook。旧 map-shaped create 第 241–285 行在相同写入闭环后调用 `persistence.notifyTerminalTopic` 第 283 行。
- **反例与影响：** 新节点创建成功但已有订阅方持有该精确节点身份时，typed 路径无通知。新 UUID 通常尚未被订阅，降低常见路径概率，但不满足需求列出的 owner command 闭环，也可能影响已知 ref 的重新创建/调用边界。
- **最小修正：** 在 typed create 的真实新建成功路径复用相同 owner hook；receipt replay 不重复触发，因为只在新命令 callback 执行时调用。
- **剩余不确定性：** 本轮未运行并发订阅或 receipt replay 场景。

## 方案合理性与同根范围

以上确认项共用两类根因：

1. **终端读模型复用运营分页/派生 DTO：** S-1～S-5。最小方向是让 owner task read 按需求精确条件返回完整原始事实与一致集合；不另建 business owner，不改变管理读路径。
2. **异步结果闭包缺少同一操作及 actor 集合的身份生命周期：** S-8～S-13。最小方向是在现有 operation/request 槽保留身份、所需 actor 结果和有限期限；不引入 MQ、outbox、第二 ledger 或通用恢复框架。S-6、S-7 与 N-1 是独立的规则落地遗漏。

逐项搜索的范围限于所列 owner、TDS、Runtime/Topology 与 TDC 当前调用链及测试；未做全仓穷举“所有调用方/所有部署配置”。因此 S-11 的 ID 重用调用者、S-12 的其他 observer 调用方、S-5 的运行时隔离设置仍列为需进一步静态查明或运行验证的范围，不能标成已实测问题。

## 验证状态

- 当前字节上的最新运行：`NOT_RUN`（本任务按授权只做静态代码 review）。
- 最后一次通过：未读取历史运行 evidence；不适用本轮结论，也不引用旧 PASS。
- 生产代码、测试、需求、详设、计划：未修改。
- 动态证据、日志、manifest、DB readback、DEV、真实设备：未读取/未运行。

## 处置更新：最小修正及当前静态代码交审

以下是后续获准修正后的状态；上面的“验证状态”描述的是初始 intake 时点，不代表此处仍未修改。

| Finding | 主 agent disposition | 当前修正落点 | 结论边界 |
|---|---|---|---|
| S-1 | `CONFIRMED`，已修 | store-contract 的 terminal ACTIVE task read 与 `TerminalDataReadController` | 精确 terminal 集合只按需求状态定义，不改变运营日期读模型；仅编译检查，不声称 HTTP/DB 验收。 |
| S-2 | `CONFIRMED`，已修 | organization 的完整 enabled-service-point task read 与 edge controller | 按点自身状态读全集，不以父区域可用性过滤；未运行并发 DB 场景。 |
| S-3 | `CONFIRMED`，已修 | organization 精确实体读取与 `TerminalDataReadController` | 精确详情能表达仍存在的退出状态；scope/门店校验保留。 |
| S-4 | `CONFIRMED`，已修 | terminal canonical DTO/schema 与 edge 投影 | 移除本期 topic 时间不能覆盖的管理派生字段；generated 链已更新，未声称运行期联调。 |
| S-5 | `PARTIALLY_CONFIRMED`，已作最小收口 | organization 完整集合 task read、edge 直读映射及其测试 | 运营分页不再由 edge 拼接。需求侧完整读取在 owner 一次 task read 中完成；实际部署隔离级别与并发 DB 行为仍 `NOT_RUN`，不扩张为额外隔离机制。 |
| S-6 | `CONFIRMED`，已修 | TDS 非在线 topic timestamp 比较与 session tests | 仅相等时跳过，倒退值也触发刷新；未做真实 listener 恢复验收。 |
| S-7 | `CONFIRMED`，已修 | 合法集合缺行的零基线读取、门店初始化及 TDS tests | 空集合与精确实体不存在分开处理；未运行新店场景。 |
| S-8 | `CONFIRMED`，已修 | terminal-control SQL、TDS report identity 与相关 tests | 当前有效 binding 由 owner 重核；同 binding 新 session 可报告旧操作，已结束 binding 被拒；未运行 PostgreSQL 验收。 |
| S-9 | `CONFIRMED`，已修 | `createCommandPeerDispatcher.ts` 与 runtime tests | 保留 peer 实际 actor results，并将 peer 多 actor 结果作为单个聚合 late outcome 传递；迟到通知过期时在消费点按绝对期限拦截。 |
| S-10 | `CONFIRMED`，已修 | Topology active request 聚合与 TDC `lateRemoteResults` | 初始及迟到 actor 结果按 actor key 聚合，全部预期 actor 终结后才报告；没有建立第二个持久 ledger。 |
| S-11 | `PARTIALLY_CONFIRMED`，已作局部防护 | Topology active/pending 槽捕获 session 与对象身份、send guard、identity-safe expiry/remove | 报告/回调只影响原 session 和原槽；默认生成 ID 的重复风险未扩大。未穷举业务调用方显式重用 commandId，也未做真实换连接竞态运行。 |
| S-12 | `PARTIALLY_CONFIRMED`，已作有限 TTL 收口 | Runtime dispatch 校验、Topology 接收/发送期限检查及槽计时、wire TTL 上界 | observer 必须带有效 TTL；绝对期限到达后不再消费结果。普通调用槽仍可等至自身 5 秒 timeout 后释放，这是调用等待期限，不延长 late observer；未增加 TTL 缺省兼容层。 |
| S-13 | `CONFIRMED`，已修 | TDC remote operation epoch、身份/原项校验、flush 后校验与阶段竞争测试 | 配置切换/root reset 删除的 map 项不会被旧 await、回滚或迟到结果重新创建；未声称真实设备持久化验收。 |
| N-1 | `CONFIRMED`，已修 | `OrganizationHierarchyService` typed region/project create 与 owner tests | 仅新建成功调用 topic hook，receipt replay 不重复通知。 |

### 当前允许范围内的代码检查

- Java 编译：`./gradlew :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:compileTestJava :apps:backend:terminal-data-server:compileJava :apps:backend:terminal-data-server:compileTestJava` — `BUILD SUCCESSFUL`。这证明 Java 生产与测试源码可编译，不等于 acceptance 或数据库业务验收。
- Runtime：`yarn typecheck && yarn test` — 初次修正阶段 PROD 与 DEV package mode 各 19 个文件、106 个测试 PASS；追加 late-error 回归用例后当前 PROD 与 DEV 各 19 个文件、107 个测试 PASS。
- Terminal Data Client：`yarn typecheck && yarn test` — PROD PASS，8 个文件、54 个测试。
- Topology：`yarn typecheck && yarn test` — PROD PASS，1 个文件、43 个测试。
- 这些均为本地编译/包级测试，不是 DEV、Expo Web、Android、VM、PostgreSQL/TDS 或端到端动态验收。默认 `scripts/verify` 未运行；本轮未读取旧运行 evidence。

当前字节上的最新运行：上述 Topology 本地包级测试 PASS；随后没有运行代码或环境验收。
最后一次通过：上述各项的最后运行均对应当前检查时字节；未运行的 backend acceptance、TDS 受管场景、DEV、Expo Web、Android、VM、reset/seed 与生产环境均为 `NOT_RUN` / `NOT_COVERED`。

### Fresh 静态复核追加 finding（仅覆盖 peer late error 与错误投影）

这次只读复核对两个 owning source 提出新的待核输入；主 agent 回到对应分支与 wire consumer 确认后作最小修正。该复核范围仅为 Runtime late peer callback、Topology actor-error 投影及直接测试，不构成整批独立 verdict。

| Finding | Disposition | 事实、影响与修正 | 当前源码/测试 |
|---|---|---|---|
| Peer late error actor results 被丢弃 | `CONFIRMED`，已修 | 本地 timeout 后，peer gateway 的 `error` outcome 即使携带已完成 actor 的真实结果，原分支也只写 late-error 诊断，未调用 late observer，TDC 因此无法结束对应 `UNKNOWN`。现对非空 `actorResults` 复用既有聚合 late-outcome 通道；不改变命令终态、不重派，也不增加结果存储。 | `apps/terminal/kernel/base/runtime/src/foundations/createCommandPeerDispatcher.ts:234–255`；新增 `apps/terminal/kernel/base/runtime/test/peerGateway.test.ts:162–207`。Runtime typecheck 与 PROD/DEV 包测试 PASS，PROD/DEV 各 19 文件、107 tests。 |
| Topology error message 被投影成 code | `CONFIRMED`，已修 | actor error wire projection 将 `message` 填为 `record.error.code`，消费者收到代码而非错误消息。现直接复制既有 typed error 的 `message` 字段；Topology 场景断言部分失败结果保留归一化 message 且不等于 code。 | `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts:115–132`；`apps/terminal/kernel/base/topology/test/topology.test.ts:2238–2267`。Topology typecheck 与 PROD 包测试 PASS，1 文件、43 tests。 |

本次首轮 focused 检查曾失败：Runtime 新测试 fixture 的 category/severity 被 TypeScript 推宽为 `string`；Topology 断言误要求未归一化的原始异常文案。按 owning contract 修正 fixture 字面类型，并依据运行时 error normalization 断言稳定 message 特征后，同一两包 typecheck/test 均通过。失败属于测试编写问题，已保留在本处置记录；未重跑任何运行环境。

第二次 fresh 窄范围静态复核结论为 `COMMENT`：两个确认缺陷在当前源码已闭合；留有一条低风险覆盖注记——未单独构造“wire 收到 late status=error 并经 Topology→Runtime 传到 TDC”的完整集成场景。Topology 同一 pending callback 已有 late completed wire 场景，Runtime late peer error actorResults 有独立 focused test；未发现错误状态分支源码差异。为避免再增加具有双层 timeout 竞态的脆弱测试，本次不加该集成用例；该注记随代码交 Claude 独立判断，不表述为整批 GO。

当前字节上的最新运行：Topology 本地 typecheck 与 PROD 包测试 PASS（1 文件/43 tests）；Runtime 本地 typecheck 与 PROD/DEV 包测试 PASS（各 19 文件/107 tests）。
最后一次通过：与当前 Runtime、Topology 源码和测试字节一致。Java 旧 compile 结果未受本次 TS-only 改动影响；受管 acceptance、DEV、Expo Web、Android、VM、数据库、TDS 场景、reset/seed 与生产运行仍为 `NOT_RUN` / `NOT_COVERED`。
