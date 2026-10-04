# TDP 数据变化通知与远程运维 · Claude 外部复评 Intake R2

```text
DOC_KIND=REVIEW_INTAKE
DATE=2026-10-04
AUTHOR=Codex
REVIEW_TARGET=DESIGN
SOURCE_REVIEW=doc/review/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-external-claude-review-intake-codex.md
INDEPENDENT_VERDICT=NOT_PRODUCED
```

## 结论边界

Claude 外部复评原结论仍为 `NO-GO, M/S/N=0/6/2`，对应其审阅时的文档字节。本记录是主 agent 对该 finding 清单的逐项 intake 与已授权文档处置，不是独立 DESIGN verdict，也不改写历史复评结论。当前仅修改详设、实施计划及本 intake；未运行生成、编译、测试、verify、DEV 或其他动态验证。

Dexter 对“合同、区域、服务点集合/订阅是否需要业务数量上限”的最新明确指示是：**不新增业务上限；业务入口与业务事实负责控制数量，TDP 不自设条数或 HTTP 响应字节限制。** 该决定覆盖先前设计草稿中关于按全合法集合估算上限的提案。WS 单消息 65,536 UTF-8 bytes 与远程执行本地未终态事实的既有限额仍适用，两者不约束 CBS 完整 HTTP 集合。

## Finding dispositions

### S-1｜11类 topic 与订阅实例数量

- **分类：`PARTIALLY_CONFIRMED`；数量上限建议按 Dexter 决定不采纳。**
- **评审位置：** 详设旧稿 §9a、§12 与计划 CP-03。评审正确指出 11 个 topic 类型并不等于一个门店只有 11 个订阅 identity；完整集合可对应多个详情身份。
- **独立证据：** 正式需求 §3 的完整集合读取要求见 `doc/plans/platform/2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md:162-164`；R-16 明确要求有界的是注册/通知/远程 inflight/单记录/补报/持久记录，并将具体数值交详设，见同文件 `:490-497`。现有 area page schema 是分页 API（`contracts/openapi-source/store-service-point-qr.schemas.json:43-50`），但这不是本专项 terminal 完整集合 contract；现有 store_contract、service-point migration 定义状态、scope、唯一性与实体字段，没有本专项每店数量 cap（`apps/backend/catering-business-server/src/main/resources/db/migration/V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql:140-141`、`V20260917_000000_000__store_service_point_qr.sql:13-42`）。
- **反例/边界：** 固定 11 种 type 仍可有 12 个或更多合法详情 identity；把 11 当容量会拒绝合法业务。反过来，数量任意并不意味着把集合正文塞入 WebSocket：WS 仍只发送 topic/time 等有限通知，完整集合由 HTTP owner read 返回。
- **影响：** 按业务规模推导并拒绝合法全量响应或第 N 个订阅，会新增业务限制并破坏“返回完整集合”的要求；截断/分页也会让 TDC 把部分集合误认成全集。
- **最小修正/当前落点：** 已删除“已证明全合法集响应上界”、超界 typed reject、每店身份容量推导及其拒绝反例。详设现明确完整集合由 owner 在一致快照中无分页、无截断返回，不加 `maxItems`、HTTP 响应字节或每 session 身份上限；订阅只登记当前有效 identity，退订、binding 失效、connection disposal 时移除，dirty identity 是 active set 的去重子集。WS 65,536 字节只管单条 WebSocket 消息。见详设 §5、§5.1、§5.2、CP-03、§9a、§12；计划 CP-02/CP-03/CP-06 与相应阶段入口/出口已同步。
- **验收边界：** 12+ 合法 identity 的用例只证明 type 闭集不是实例限制；验证完整集合、不截断、退订释放和重复 dirty 合并。不以该测试数字推导业务上限，也不拒绝更大合法集合。
- **剩余 OPEN：** 实际数据量带来的运行资源成本需在实现/运行中如实观察；不得借此在本期自行引入业务上限。若未来要改变完整集合语义或加产品数量限制，再由 Dexter 裁决。

### S-2｜Runtime 晚到结果桥

- **分类：`CONFIRMED`。**
- **评审位置：** 详设 CP-06、§9 与 §11a；计划 CP-06。
- **仓内事实：** `apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts:347-367` 的 root 已结束后 actor 完成分支只构造不带 `outcome.result` 的 lifecycle transition；`createLifecycleEmitter.ts:390-430` 先更新 observation、写 journal，再通知 observer；`createRuntimeJournal.ts:28-39` 的 listener 只能收到 journal event。当前这条路径没有将晚到 actor 的真实 result 暴露给 TDC。
- **反例：** root command 先 timeout，注册 actor 后续成功。journal 可报告 `actor.late-completed`，但它不含成功 result；仅订阅 journal 或读取执行摘要无法让 CBS 获得真实业务结果。local actor 与 peer actor 都需要覆盖。
- **影响：** 若声称 TDC 可保存并回传晚到实际结果，当前公开 Runtime 能力并不能支撑该声明；用 UNKNOWN 冒充成功或重派 command 均违反既定语义。
- **最小修正/当前落点：** 详设补为精确 local `requestId` 的 request-scoped 一次性 handoff：dispatch 前订阅；Runtime 将晚到实际 outcome 放入有限请求槽后再发诊断 journal event；TDC 收到后先持久化该结果，再释放该槽；journal 仍不承载 payload；handoff 失效或尚未收到时仍保持 UNKNOWN 且不重派。Owner consumer 与 local/peer 场景已写入详设 §9、CP-06、`tdp.remote.runtime-late-result`；计划 CP-06 同步。
- **剩余 OPEN：** 这是设计形态，不是源码能力已实现的证明；本轮没有实现或动态验证。

### S-3｜取消激活、配置变化与 root reset 的 TDC 本地结果缓存

- **分类：`DEXTER_DECISION`（已由本轮用户澄清收口）。**
- **评审位置：** 详设旧稿 §9a、§12。
- **仓内事实：** `apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts:437-479` 在 reset 时只保留声明 `resetIntent: 'retain'` 的 owner 条目并删除其他 namespace 键；`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:335-347` 是 reset 顺序入口。现行 `doc/platform/terminal-coding-standard.md:363-384` 将 server-config 列为唯一 `retain` 窄例外，并禁止新增第二份凭证/配置存储。
- **决策与反例：** Dexter 明确区分业务历史与 TDC 本地缓存：CBS 已提交历史永久保留；TDC 结果是当前配置上下文内的本地缓存，配置/binding 不变的普通断线重连可保留；server-config 改变或 root reset 后可清除，不能把旧 operation 带到新配置补报。故 reviewer 建议为 TDC 增加第二 `retain` 例外，会与现行规范及用户本轮澄清冲突。
- **最小处置：** 详设与计划保留默认 reset 清理；只同步说明普通同配置断线重连保留、配置变更/root reset 清除，CBS 历史不清除。不改需求、不改 `TR-09`、不新增 reset retain 例外。
- **剩余 OPEN：** 无产品待决事项；该生命周期将在获准实施后验证。

### S-4｜CP-05 标定执行完整业务场景

- **分类：`CONFIRMED`。**
- **仓内事实：** `scripts/test/backend-acceptance:210-233` 在 calibration 模式仍从完整 `:apps:backend:catering-business-server:test` task 启动，并选择 `BackendAcceptanceTest`，不是预算专用单场景入口。详设旧顺序把标定放在 CP-05，与全批 6b/整体验收边界产生矛盾。
- **影响：** 在全部 CP 和批次级对账之前跑 `--operation all --calibration` 会提前运行完整业务场景，且可能造成重复整批验收。
- **最小修正/当前落点：** CP-05 只输出本 CP focused 结果；计划现明确普通 `--validate-only` 的当前预算阻断及 `IDENTITY_ONLY` 的适用边界。全目录三次 calibration 移到全部 CP MATCHED 与独立全批 6b MATCHED 之后，再补预算红例、validate-only 与默认 verify。详设静态门安排及计划 §5 已同步。
- **剩余 OPEN：** 尚未执行；仅修正执行顺序。

### S-5｜TDS 独立 PostgreSQL principal

- **分类：`CONFIRMED`。**
- **仓内事实：** DEV runner 两处均回退使用 CBS 数据库账户（`scripts/dev/r5-dev-runner.mjs:384-390,531-535`）；acceptance TDS process 将 Testcontainers 的同一用户名密码注入（`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TdsAcceptanceProcess.java:207-215`）。因此现状不能证明详设宣称的 TDS owner-table 最小权限。
- **影响：** 共用凭证下的成功查询不能证明 TDS 被限制为 snapshot read 与具名 terminal-control SQL command；TDS 进程一旦误写也可能借 CBS 权限直接操作 owner 表。
- **最小修正/当前落点：** 详设 CP-03、CP-06 已要求 DEV 与 acceptance 分别 provision 并注入专属 TDS principal；只授权两张 snapshot 表 SELECT 和具名 SQL commands EXECUTE；禁止 owner 表直接 SELECT/INSERT/UPDATE/DELETE。计划已要求以独立账户正向授权与逐项反向 permission-denied 验证，不回落 CBS 凭证。
- **剩余 OPEN：** role/bootstrap、函数执行权限与拒绝断言尚未实现/运行；不能声称当前权限已隔离。

### S-6｜八个 HTTP operation 的实施前事实

- **分类：`CONFIRMED`，已在文档修正。**
- **评审判据：** `project-memory/decisions/http-crud-efficiency-design-redlines.md:204-217` 要求实施前写清逐 operation 逻辑、调用链、typed failure 与 DB 操作数来源，不能事后用 calibration 代替。
- **最小修正/当前落点：** 详设 §5.1 已列出 8 个 terminal GET 的顺序 owner path、成功投影、条件到 typed problem、命名正常 fixture 及 request-local 预期 `2 SELECT / 0 mutation`；明确这是设计值而非实测值，省略安全核验来达预算不允许。CP-01/CP-02 将按 tracker 逐 operation 对照，偏差须说明真实调用路径并回开设计。
- **更小替代：** 共享前置校验和 fixture 定义写一次、八项差异逐行列出；比复制八套伪代码更短且可验收，已采用。
- **剩余 OPEN：** DB 操作数是待测假设，未运行。

### N-1｜TDC ACK 后远程操作 map 项生命周期

- **分类：`CONFIRMED`，已在文档修正。**
- **事实与影响：** 原文把操作事实与 ACK 生命周期分开描述，没有清楚说明连续成功操作后本地状态如何收敛；此前增加的聚合字节容量不是需求要求的限制。
- **最小修正/当前落点：** 按 Dexter 最新澄清，TDC只用持久化slice中的一个普通JSON对象`remoteOperations` map，以`remoteOperationId`为键保存尚未释放的operation事实。阶段ACK更新原map项，终态ACK持久成功后删除该项，ACK丢失则保留原项；map最多64项，只限制map项数，不设缓存字节容量上限。WebSocket消息仍遵守既有65,536字节协议边界。CBS历史永久保留。详设CP-06、§9、§12与计划CP-06已同步；场景覆盖连续终态ACK、ACK丢失、重复ACK与旧binding阻止补报。
- **剩余 OPEN：** 当前字节只定义设计规则，未证明持久化实现。

### N-2｜DEV-DATA 测试表列数

- **分类：`CONFIRMED`，已修正。**
- **事实：** DEV-DATA-01～12 为四列输入/断言表；DEV-DATA-13～16 使用包含 fixture、CBS/TDS 执行面、TER 执行面及 owner 的六列表头。原始衔接缺少清晰表边界，容易将 13～16 误读成接在四列表下。
- **最小修正/当前落点：** 详设已在 DEV-DATA-01～12 表后结束该表，再为 13～16 提供独立六列表头；不改场景分母或执行面。
- **剩余 OPEN：** 无文档列结构问题；场景均未运行。

## 修改清单与验证状态

- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-design-codex.md`：完整集合无人工上限；移除响应/订阅上限草案；更新 R-16 映射、owner API、TDS 权限、late-result handoff、ACK/缓存生命周期和验收边界。
- `doc/plans/platform/2026-10-04-v2s-tdp-data-change-and-remote-operations-implementation-plan-codex.md`：移除完整集合上界拒绝测试；同步 12+ identity 正向测试、专属 TDS principal、CP-05 focused 与整批 calibration 时序、Runtime handoff 与 phase ACK。
- 本文件记录 finding intake；未修改需求、已接受规范、源码、脚本、生成物或依赖。

```text
当前字节上的最新动态运行：NOT_RUN（本轮仅静态核验与文档修订）
最后一次通过：本轮无新的运行通过；既有历史证据不升级为当前字节 PASS
```

当前作者处置状态：八项 finding 均已完成静态 disposition，S-2、S-5、S-6、N-1、N-2 的文档缺口已修订；S-1 按 Dexter 决定明确不设业务上限；S-3 按用户决定遵循 reset 默认清理。仍未验证第三方实际解析版本/官方 API 依据、DB count、独立 TDS role、Runtime handoff、生成/编译/测试/verify/DEV。历史 Claude `NO-GO 0/6/2` 保留；本记录不声称独立 `GO`。
