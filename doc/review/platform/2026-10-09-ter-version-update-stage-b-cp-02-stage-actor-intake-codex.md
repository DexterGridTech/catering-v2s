# Stage B CP-02：stage 创建者身份 finding intake

## Finding

**分类：CONFIRMED。** 这是 CP-02 内实际存在的 owner 授权缺口，不需要产品裁决。

阶段 B 附录 §5 的 `registerPlatformTerminalUpdateArtifact` 与 `releasePlatformTerminalUpdateArtifactStage` 行规定：stage 非创建者使用 `TERMINAL_UPDATE_STAGE_NOT_OWNED/403`；跨空间或缺失资源仍须隐藏。附录 §9a 的 stage/release 还把当前 actor 与 space 列为请求事实。原实现的 `TerminalUpdateArtifactOwnerService.register` 和 `releaseStage` 只核对 workspace/group 与 bind grant，不把当前 actor 同 stage 创建者比对；`artifact_stage` 也没有创建者列，只有创建时写入的审计事件保存 actor。控制器此前将 `StageNotOwned` 映射成通用 404，和已接受的同空间 403 判据不一致。

风险不要求假设 grant 可猜：同 workspace 的其他平台 actor 若得到 stageRef/grant，owner 仍会允许其注册或释放该 stage。更实际的同根影响是 asset 暂存幂等键原先不含 actor；重放可能复用同一 staged asset 并轮换 bind grant，使 stage owner 检查失败后的通用清理触及原有资产。

## 最小修正

- `artifact_stage` 在原 stage 行保存 `owner_actor_type` 与 `owner_actor_id`。stage insert 与既有 stage readback 同 SQL 次数、同事务边界，不增加操作预算或第二 ownership store；现有 STAGE 审计仍由同一 actor 写入。
- `StageTerminalUpdateArtifactOperation` 将 workspace、group、actor type/id 与客户端幂等键用现有 `CommandReceiptSupport.requestHash` 派生 asset-stage key。同一 actor 的重试稳定，不同 actor 不会重放或旋转同一 asset 的短期 grant。
- register/release 先隐藏不存在或异 workspace stage 为 `PLATFORM_COMMON_RESOURCE_NOT_FOUND/404`；同 workspace 的非创建者拒绝为 `TERMINAL_UPDATE_STAGE_NOT_OWNED/403`，拒绝发生在 asset claim/release 和 artifact/audit 写入之前。
- 修订了阶段 B 详设、计划及 source/API appendix。未改变 asset owner、stage API、业务数据、事务数、SQL 往返数或阶段范围。

## 当前实现位置

- `apps/backend/catering-business-server/src/main/resources/db/migration/V20261010_000000_000__terminal_update_artifact_owner.sql`：stage 创建者两列。
- `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/api/TerminalUpdateArtifactOwnerApi.java`：`ValidatedStage` 的 owner actor facts。
- `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/StageTerminalUpdateArtifactOperation.java`：actor-scoped asset idempotency key 与创建者传递。
- `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/persistence/TerminalUpdateArtifactPersistence.java`：原 insert/readback 读写 actor 字段。
- `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateArtifactOwnerService.java`：stage accept/register/release actor 判定。
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/terminalupdate/PlatformTerminalUpdateArtifactController.java`：区分同空间非创建者 403 与资源隐藏 404。
- `apps/backend/catering-business-server/modules/terminal-update/src/test/java/com/catering/v2s/terminalupdate/application/TerminalUpdateArtifactOwnerServiceTest.java`：不同 actor 的 register/release 与 stage 重放拒绝、actor-scoped 幂等身份稳定性。

## 验证与边界

**实际 focused 运行：**

```text
./gradlew :apps:backend:catering-business-server:modules:terminal-update:test --no-daemon
BUILD SUCCESSFUL
```

JUnit XML：此前全模块测试记录 owner service 5 tests 与 parser 7 tests，合计12、0 failures、0 errors。随后本次针对 receipt actor 缺口的定向运行再次执行 owner service，结果6 tests、0 failures、0 errors；parser代码未变，沿用此前7项结果。该证明覆盖 owner 分支、actor-scoped key、普通 manifest 路径/尺寸边界及签名命令失败，不证明 PostgreSQL DDL/SQL 动态执行、真实 HTTP 状态映射或完整 backend acceptance；这些按 CP-02/批次验收计划执行，当前 `NOT_RUN`。

## 后续独立对账发现：register receipt 必须绑定 actor

**分类：CONFIRMED。** 第一轮 CP-02 独立三维对账发现：stage存在时已校验创建者，但register成功后stage被删除；若另一个actor取得同一请求事实和幂等键，原`requestHash`不含actor，会在owner读取stage之前命中已提交receipt并得到原actor的artifact readback。这违反appendix §9a“幂等写key绑定operation、actor、space、canonicalpayload”的明确约束。该反例与stage创建者字段缺失是同一owner身份边界，但发生在完成回放，因此分别封闭。

**最小修正：** register现有canonical request hash新增`actorType`和`actorId`；沿用同一receipt行/键、锁和事务，不增加表、SQL或恢复机制。同actor精确重放仍得到原artifact；不同actor同key/同body得到现有`TerminalUpdateIdempotencyConflictException`，控制器沿既有幂等冲突映射拒绝，不泄露原actor结果。stageBindGrant仍只以摘要参与hash。

**当前实现与直接反例：** `TerminalUpdateArtifactOwnerService.requestHash`包含请求actor身份；`TerminalUpdateArtifactOwnerServiceTest.registerReceiptReplayIsBoundToTheOriginalActor`先证明原actor读回已提交artifact，再证明另一actor不能复用该receipt；另断言两次均走同一receipt锁路径，未继续读stage或claim asset。

**实际 focused 运行：**

```text
./gradlew :apps:backend:catering-business-server:modules:terminal-update:test --tests 'com.catering.v2s.terminalupdate.application.TerminalUpdateArtifactOwnerServiceTest' --no-daemon
BUILD SUCCESSFUL
```

该次JUnit XML：owner service 6 tests、0 failures、0 errors。未重跑parser和未受影响生成检查。HTTP acceptance仍为`NOT_RUN`，不把此service focused proof升级为真实HTTP PASS。
