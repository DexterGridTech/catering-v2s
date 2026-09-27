# 批次一实施步骤 4 · CP-02 对账记录

```text
STEP=IMPLEMENTATION_PLAN_STEP_4
SCOPE=terminal-binding owner, store-terminal target judgment, operations edge coordination, audit and revocation
AUTHOR=MAIN_AGENT
STEP_STATUS=RECONCILED_MATCHED
STEP_RECONCILIATION=MATCHED
REVIEW_TARGET=STEP_RECONCILIATION
CURRENT_REVIEWER=/root/step4_cp02_reconcile
REVIEW_MODE=FRESH_INDEPENDENT_READ_ONLY
```

## 范围与原文输入

本步按实施计划 Step 4 落绑定 owner、跨 owner 编排、后台取消激活授权复核、审计与通知。真实 HTTP operation identity 与 handler 属于 Step 5；真实 TDS/故障注入属于 Step 7。未改需求正本或已接受 decision。

本步用到的直接判据：

- 需求正本 R-1.1：设备激活是公开接口，不需要登录会话；R-1.4～R-1.7、D-38、D-40：激活按凭证摘要识别同一次操作；绑定有效时校验 deviceId，结束后按当前/最近结束摘要判定；不得退化成通用幂等回放。
- 需求正本 R-3.2：**只有运营后台取消激活**要求页面权限及按门店范围的 `EDIT_STORE_TERMINAL`；复用同一代次、审计与成功回执规则。
- 需求正本 R-4.7/D-40：绑定结束后不比较 deviceId；正确摘要返回已取消激活，错误摘要返回凭证无效且不写入。
- 详设 §5a、§8、§9 与实施计划 Step 4：`activateTerminal` 为 terminal face / `NONE` / `requiresSession=false`；运营取消激活由 edge 持有跨 owner 编排，授权在 receipt 之前复核，store-terminal 不依赖 terminal-binding，terminal-binding 不依赖 organization/store-terminal。
- 六维 memory route：`implementation / backend / backend / backend / owner / implementation`。首个调用误传了路由词汇表不支持的 `consumer-face=terminal`，读取词汇表后改用本仓 backend owner 对应的 `consumer-face=backend`；修正后的 route 查询通过。本步复用 `project-memory/practices/backend-capability-lookup.md`、六个 kernel 与 `doc/platform/foundation-charter.md` 的 `1-K`，以及计划引用的 `G-05A`。

输入与当前生产源 SHA-256：

| 路径 | SHA-256 |
|---|---|
| `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` | `35ef15fd0b0844426e30da43649a2cfa28136806b326c8b694205c34d1cf238a` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md` | `28989220cdbf9cb7ed96b99eb96b7215bf3c8d163a601ca98e9ff5ef413d58a2` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md` | `ea115d203d792edf9f9d2a7078540a383a5d5dfd07ec53742a77e73cb3a41d47` |
| `project-memory/practices/backend-capability-lookup.md` | `5c5eeb1bf24a3605135d586e58c74f23411cc676c82b8193e6044b389e69c235` |
| `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/api/StoreTerminalOwnerApi.java` | `2a3465260bbd43e9052d62d5a02dab06e8ca29f8843b1e8dd5261e14dd16a4d3` |
| `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerService.java` | `6a16908e68471ae0d1c14f9de0eff54affc1bd9ff7b5e86a26b356b96641ee33` |
| `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/persistence/StoreTerminalOwnerPersistence.java` | `ec9cd192d64504fef1fe1bfcdf76c85ecf3d65a964f5d67dd02e630f2aa5ab27` |
| `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/persistence/StoreTerminalOwnerPersistenceSql.java` | `dd5c99f59e5c896e2f142ed79f1db225dd420e9fc666c4d4f88df06d2b31d7f5` |
| `apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/api/TerminalBindingOwnerApi.java` | `e79e07afdd041b04491df1d8b3aad0e6bf7e30939d35f995c3b75ecb5761fa80` |
| `apps/backend/catering-business-server/modules/terminal-binding/src/main/java/com/catering/v2s/terminalbinding/application/TerminalBindingOwnerService.java` | `a9894ddd618866156d569577bb6b6fdc0e75bbdcd419d5c54a49a0bf7a7825fa` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreTerminalActivationCancellation.java` | `ea68d725df5b88a08f65a25548795458e33843d32bbf7db8ff6be73cea7991dd` |

These hashes bind the current author readback, not a pre-edit revision. The pre-edit source and governing clauses were reopened before the corresponding edits as recorded in the implementation turn; the independent reviewer must reopen all listed current sources and the original clauses rather than treat these hashes as a verdict.

## 前后双读与实现形态

| Change point | 写入前的约束/现成能力 | 当前源码回读与判据 |
|---|---|---|
| 设备激活与权限边界 | R-1.1 要求公开且无登录；`StoreTerminalOwnerApi.lockActivationCandidate` 是既有事实 owner 入口；`TerminalBindingOwnerApi.ActivationCommand` 只承载候选事实、deviceId、摘要和 actor。 | store-terminal 候选解析和 terminal-binding `activateOrReplay` 都不接收会话、权限 grant 或 workspace capability。激活 HTTP identity/handler 仍待 Step 5；届时必须沿用 terminal face、`authorizationMode=NONE`、`requiresSession=false`，不得因后台取消激活的授权要求而给激活加权限门。业务状态/激活码/设备凭证校验仍照 R-1.3～R-1.9 执行。当前只有源码/详设结论，不声称 HTTP 动态证据。 |
| 运营后台取消激活授权 | R-3.2 要求页面写权限、门店范围 `EDIT_STORE_TERMINAL`，门店停用时不可用；`OperationsOwnerScopeGrant`、`WorkspaceCapabilityScopeResolver`、owner `requireStore` 可复用。 | edge 只解析精确 requirement/capability/STORE target；store-terminal 再验 grant、当前 context、门店启用状态及 terminal 实际 store；terminal-binding 的本地 grant 再验 workspace/group/purpose/capability/target/context 后才锁/读 receipt。新操作 requirement 仅对应运营取消激活。拒绝路径测试断言不触达 binding owner/receipt。 |
| 跨 owner 事务与边界 | 单一业务 deployable；跨 owner 写由 edge 调公开 command 并加入同一 REQUIRED 事务；禁止 owner 间反向调用。 | 新 edge coordinator 标记 `Propagation.REQUIRED`，先取 store-terminal owner 的窄非秘密 target，再调 terminal-binding command。store-terminal 只依赖 organization grant 类型和自身 owner 查询；terminal-binding 没有 organization/store-terminal import。没有新增 SPI/provider。 |
| D-40、审计与回执 | 当前绑定设备 id 仅在有效期有判定意义；绑定结束后的正确摘要允许 ALREADY_CANCELLED；凭证和原始 deviceId 不入审计/回执。 | D-40 classifier 及 ended binding 清除 deviceId 的生产路径保持不变；本步新增后台取消路径用当前代次作 CAS，成功后才写审计、发撤销通知和存成功 receipt。单测覆盖 wrong purpose/target/context 在 receipt 前拒绝、成功只写一次以及重新授权后的回放不重复副作用。 |

实现选择登记：我选用“app edge 一次编排 + store-terminal 窄 target judgment + terminal-binding 本地 grant 值”，没有让 owner 直接调用另一 owner，也没有把 organization grant 类型引入 terminal-binding，因为既有模块图要求单向 COMMAND 依赖且该模块不应依赖 IAM/门店事实 owner。

## 聚焦证据与未覆盖范围

| Proof | 当前结果 | 限定 |
|---|---|---|
| terminal-binding `spotlessJavaCheck` | PASS | 格式检查 |
| `:apps:backend:catering-business-server:modules:terminal-binding:test` | PASS；XML 共 22 tests、0 failures、0 errors、0 skipped | 本机 owner 单测；不证明 PostgreSQL/HTTP/TDS |
| store-terminal 与 business app `compileTestJava` | PASS；出现 4 条既有 Spring/Jackson removal/deprecation warnings | 只证明生产及测试源码可编译 |
| store-terminal / app 测试执行 | NOT_RUN | 两个模块的测试源码包含 Testcontainers，必须走受管远端 runner；整批动态准入/拓扑预检尚未完成，未启动远端测试 |
| backend-acceptance、TDS、SSH/tunnel、DEV、L2、reset、seed | NOT_RUN | 按本批动态进入条件保留在后续阶段 |

首次格式检查失败保留在本轮任务输出；随后只调用三个相关 Gradle 子项目的 `spotlessJavaApply`，再执行检查通过。最新编译前没有再改源码。首败修复没有延长 timeout、切换场景或伪造 PASS。

| Run | UTC 时间 | 命令/结果 |
|---|---|---|
| `LOCAL-CP02-SPOTLESS-2026-09-26T1649Z` | 16:49 | 受影响 Java 子项目 `spotlessJavaCheck` PASS |
| `LOCAL-CP02-BINDING-TEST-2026-09-26T1651Z` | 16:51 | terminal-binding `test` PASS，22/22 |
| `LOCAL-CP02-COMPILE-2026-09-26T1652Z` | 16:52 | store-terminal 与 business app `compileTestJava` PASS |

## 下一检查点

## Fresh 独立步骤级三维对账

- Reviewer：`/root/step4_cp02_reconcile`，fresh、只读；`STEP_RECONCILIATION=MATCHED`。
- 三维输入：需求 R-1.1、R-1.4～R-1.7、R-3.2、R-4.7/D-40、R-8.4、D-38；详设 §5a/§8/§9 与计划 Step 4；本步适用的门店终端 IA 边界、service-shape 决策及 project-memory owner/auth/transaction 规则。
- Reviewer 逐一核对并确认：激活 owner 命令不带 session/role/capability；workspace capability requirement catalog 没有给激活加权限，只给运营取消激活登记精确 `STORE`/`EDIT_STORE_TERMINAL`；运营 grant、store target、context 与启用门店/终端归属在 binding receipt 前复核；两 owner 在 edge `REQUIRED` 事务编排、依赖保持单向；D-40 结束绑定的摘要判断、deviceId 清除、审计与撤销通知/receipt 顺序和敏感字段边界符合设计。
- Reviewer source anchors：需求 `:85, :143-152, :203-210, :275-278`；详设 `:245-247, :256, :266, :348`；计划 `:29-30`；owner/edge 对应源码及测试行号见 reviewer 原 verdict（当前线程子 agent `/root/step4_cp02_reconcile`）。记录中的生产源码 SHA-256 与 reviewer 当前字节核验相符。
- 未覆盖：Step 5 HTTP operation identity/handler，真实 PostgreSQL/HTTP、TDS/WebSocket、Testcontainers/DEV/L2/reset/seed；本次不声称这些动态结果 PASS。

当前 `STEP_RECONCILIATION=MATCHED` 只关闭 Step 4 的需求/设计/记忆与当前源码匹配检查，允许继续到实施计划 Step 5；不代替批次整体三维对账、动态准入或批次交付审查。
