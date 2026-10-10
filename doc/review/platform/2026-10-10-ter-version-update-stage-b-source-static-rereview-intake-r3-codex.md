# TER 版本更新阶段 B 源码静态复评 finding intake（R3）

## 范围与证据边界

本记录由主 agent 依据 Claude 当前源码复评逐项重开正式需求、阶段 B 详设/计划、IA、owning source 和直接测试后形成。Claude 原结论 `NO-GO, M/S/N=0/4/2` 保留在其被审字节边界；以下处置不是独立 verdict。本记录完成后当前修订字节的独立 verdict 仍为 `NONE`，不将作者核验写成 GO。

本轮只运行生成检查、受影响的终端/前端 focused tests、typecheck 与终端 update owner 的 focused Gradle test。没有运行完整动态验收、DEV、真机、Stage C、reset/seed、L2、UAT 或部署。CBS app 中 `ContractProblemAdviceTypedOwnerMappingTest` 未执行：本机 Gradle guard 要求 Docker-backed 测试经远端 `scripts/test/r5-remote-testcontainers.mjs` 运行，当前未绕过该 guard。不得把模块单测、编译或静态读取升级为整批/HTTP acceptance PASS。

## Findings 处置

| Finding | 主 agent 分类与处置 |
| --- | --- |
| S-1 无任务版本报告未闭合自然启动就绪顺序 | `CONFIRMED，已修复`。`createTerminalUpdateModule.install` 先 reconcile 的确可能早于 store/project 的有效 context；状态订阅原本只刷新规则，不能保证该之后再观察当前版本。新增条件是完整 snapshot 成功读回、context 身份仍匹配且没有执行任务时，沿既有 `reconcileTerminalUpdateCommand` 补一次 observation。actor 的 initial-observation 写入不继承旧 task/recentStatus 的 `taskId`、rule/artifact 引用；新 binding 明确生成 `taskId=null`。同一 report descriptor 的已有 observation 继续按当前幂等与 binding/context 身份去重，没有新流水或报告 owner。直接测试覆盖安装后 context 才就绪、观察被调度，以及新 binding 不携带旧 task 引用。源码：`createTerminalUpdateModule.ts:33,86-153`、`terminalUpdateActor.ts:804-865,1301-1325`；测试：`terminalUpdate.test.ts:320-399,1530-1650`。 |
| S-2 生成 HTTP 失败分类到 TDC/更新 owner 丢失 | `CONFIRMED，已修复`。generated client 原先将坏 2xx body、未知 4xx 与非 business HTTP failure压成没有状态的 failure；TDC 原样返回该结果，owner 因而可能把身份拒绝误当可重试。生成模板及其正常产物现为 HTTP 已完成的 failure 保留安全 `status`；网络未送达 failure 不伪造状态。TDC 的 report command 返回 generated typed result；owner 按现有矩阵暂停未带合法 problem 的 401/403、结束无效 200/协议结果和其他完成的 4xx，并保留无状态网络失败与 5xx 重试。直接测试覆盖 generated 坏 200/未知 4xx/裸 403、TDC 真实生成调用形状和 owner 的暂停/终态/重试分支；未新增队列或 retry framework。源码：`scripts/generate/terminal-client-api.mjs:586-624`、生成产物 `terminalApi.ts:390-393,799-817`、`terminalDataClientActor.ts:293-320,1143-1210`、`terminalUpdateActor.ts:884-1030`；测试：`generatedTerminalApi.test.ts:66-165`、`terminalUpdate.test.ts:874-1137,1293-1370`。 |
| S-3 同 context 刷新期间仍可固定旧规则 | `CONFIRMED，已修复`。生产规则消费路径会保留上一次完整 ready snapshot；在同 context HTTP refresh 尚未完成时，固定前重读仍可能读到旧 snapshot。复用 actor 已有的 `ruleSnapshotRefresh` in-flight promise，在 `targetFromRuleSnapshot` 拒绝刷新期间的新 target。刷新成功后接受新完整值；已固定任务不撤回。focused 测试挂起刷新并验证旧候选不可接受，之后再放行刷新；不新增调度器或第二状态副本。源码：`terminalUpdateActor.ts:421,505-507,762-777,1542-1700`；测试：`terminalUpdate.test.ts:539-672`。 |
| S-4 CAS 冲突后标题、按钮与命令意图不一致 | `CONFIRMED，已修复`。此前全部 409 进入 readback，且标题随最新状态而变、按钮/command 仍使用用户原 intent；幂等冲突可能被误报为版本竞争。现只接受 `(409, PLATFORM_COMMON_VERSION_CONFLICT)` 为 CAS。readback 后标题、按钮与再次提交均仍绑定原 intent，并使用最新 revision；若最新状态已等于 intent，则说明已由其他操作完成并关闭确认。其他 409 沿原错误路径显示，不重置为 CAS。model test 覆盖精确码、相邻 409 与 intent 文案，页面接线由 focused static test 检查。源码：`terminalUpdateRuleStatus.ts:3-15`、`ProjectTerminalUpdatePage.tsx:337-404,1050-1069`；测试：`terminalUpdateRuleStatus.test.ts:9-21`、`ProjectTerminalUpdatePage.static.test.ts:6-22`。 |
| N-1 SNAPSHOT_CHANGED 未走完整快照有限重读 | `CONFIRMED，已修复`。owner 原来将 hash 改变映射为通用 version conflict；消费者只对成功页 hash 改变重读。owner 现在抛精确 `TerminalUpdateRuleSnapshotChangedException`，edge advice 返回 canonical `TERMINAL_UPDATE_SNAPSHOT_CHANGED`；actor 将该精确 typed rejection 纳入已存在的最多三次整快照重启，不对其他错误重试。snapshot API 的 canonical/generated error code 已存在，没有新增协议语义。owner test 和 actor direct-command test覆盖映射及有限重试。源码：`TerminalUpdateRuleOwnerService.java:205-222,388`、`ContractProblemAdvice.java:321-325`、`terminalUpdateActor.ts:653-756`；测试：`TerminalUpdateRuleOwnerServiceTest.java:301`、`ContractProblemAdviceTypedOwnerMappingTest.java:112-125`、`terminalUpdate.test.ts:740-870`。CBS app 的 advice mapping JUnit 因远端 Testcontainers guard 未执行，保持 `NOT_RUN`。 |
| N-2 规则门店与报告历史详情未复用 cursor pagination | `CONFIRMED，已修复`。两处子表原先追加式加载；报告历史没有页内同步忙锁，快速点击可使同 cursor 页重复追加。两处现改用 foundation `useCursorStack` 与 `CursorPagination`，逐页替换当前 rows；detail/context/request 身份失效会丢弃迟到结果，页加载使用同步 ref 防止重复请求。只增加本页两个 testId 常量，不增加 arbitrary page、total 或第二分页缓存。foundation 源码：`libraries/frontend/admin-ui-foundation/src/list/useCursorStack.ts:17-45`、`cursorPagination.tsx:1-38`；接线：`ProjectTerminalUpdatePage.tsx:420-554,945-970,1020-1046`；测试：`ProjectTerminalUpdatePage.static.test.ts:6-22`。 |

## 同根扫描与剩余不确定性

- `S-1` 扫描 `primarySurfaceReadyCommand`、启动安装、context/connection 状态触发 refresh 与无任务 reconcile 路径；新 observation 仍写在 terminal-update 单一 owner slice，TDC 仍是凭证与传输 owner。
- `S-2` 扫描生成模板、生成结果 union、TDC generated call/return、report HTTP handler 与 pending-report consumer。完成的 HTTP response 保留 status；transport 未送达结果没有 status，仍走可重试分支。
- `S-3` 扫描规则通知、HTTP refresh 与 target accept 的共同 in-flight 状态；已固定目标不受新 snapshot 的撤回。
- `S-4` 对照后端 `ContractProblemAdvice` 的 VERSION_CONFLICT 与 IDEMPOTENCY_CONFLICT 映射，页面只对精确版本错误执行 readback。
- `N-1` canonical error code 沿 owner exception→edge advice→generated contract→actor consumer闭合；仍需受管 HTTP acceptance 才能证明线上序列化/路由行为，本轮没有此证据。
- `N-2` 核对两个详情子表、上下文重置、请求身份、上一页 cursor 取回及重复点击防护。focused UI test 是源码结构断言，不声称浏览器行为通过。

## 本轮局部验证

| 命令 | 结果 |
| --- | --- |
| `node scripts/generate/terminal-client-api.mjs --write` | PASS；按生成器更新 terminal API 产物。 |
| `node scripts/generate/terminal-client-api.mjs --check` | PASS。 |
| `yarn workspace @catering-v2s/kernel-base-terminal-update test` | PASS；2 files、50 tests、0 allowed skips。首次断言误读报告字段层级（`taskId` 在报告顶层）；修正测试断言后以同一 focused suite 通过。 |
| `yarn workspace @catering-v2s/kernel-base-terminal-data-client test` | PASS；8 files、55 tests。 |
| `yarn workspace @catering-v2s/operations-admin typecheck` | PASS。 |
| `yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck` | PASS。 |
| `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` | PASS；首次新测试的局部 fixture 类型不匹配，收窄 state fixture 类型并显式 cast 测试 port 后通过。 |
| `node_modules/.bin/vitest run --root .../apps/frontend/operations-admin --config .../apps/frontend/operations-admin/vite.config.ts src/features/terminal-update/ui/ProjectTerminalUpdatePage.static.test.ts src/features/terminal-update/model/terminalUpdateRuleStatus.test.ts --reporter=verbose` | PASS；2 files、2 tests。第一次配置路径误指不存在的 `vitest.config.ts`，未启动测试；改用仓内实际 `vite.config.ts` 后运行通过。 |
| `./gradlew :apps:backend:catering-business-server:modules:terminal-update:test --tests com.catering.v2s.terminalupdate.application.TerminalUpdateRuleOwnerServiceTest :apps:backend:catering-business-server:test --tests edge.problem.ContractProblemAdviceTypedOwnerMappingTest` | terminal-update owner focused test PASS；CBS app advice test `NOT_RUN`。CBS app 测试被 `V2S_TESTCONTAINERS_REMOTE_REQUIRED` fail-closed，禁止本机 Docker discovery，要求受管远端 Testcontainers runner；未绕过。Gradle 已完成相关 `compileJava`、`compileTestJava`、`testClasses` 后在该保护处退出。 |

本轮没有运行默认 `scripts/verify`、完整阶段 B 动态矩阵、DEV、真机、Stage C 或无关全量回归。后端 advice 的 HTTP 行为、全部历史动态结果与完整交付 verdict 仍按各自原始证据范围；本记录不将 focused PASS 扩写为整批 PASS。

## 当前处置

- 六项 finding 均为主 agent `CONFIRMED`；当前代码已包含最小修正与可用 focused proof。
- Fresh 独立只读差量审查：`REVIEW_TARGET=IMPLEMENTATION`，`VERDICT=GO`，`M/S/N=0/0/0`。范围仅为这六项与直接同根链路；reviewer 未运行测试、构建或动态环境。该 verdict 不替代阶段 B 整批动态交付，也不关闭未运行的 CBS app advice JUnit。
- 历史 Claude NO-GO 保留，不覆写；当前修订字节仍待 Claude 外部复评。
- 建议 Claude 对本记录列明的当前源码差量作静态复评；不要求重跑或索取运行 evidence，不将未执行的 CBS HTTP mapping JUnit、完整动态矩阵、DEV、设备或 Stage C 结果推成 PASS。
