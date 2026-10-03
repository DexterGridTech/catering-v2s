# 终端激活交互与双机拓扑优化专项 · CP-04 intake / focused evidence

```text
CP=CP-04 当前peer readiness、断链mask与本机恢复
STEP_RECONCILIATION=MATCHED
AUTHORITY=已授权批次实施
EVIDENCE_TIER=包级focused unit/component tests、lint、typecheck；Expo Web/VM/adapter NOT_RUN
```

## 1 · CP-04具体职责与实现

- required projection 完整集合由两个 integration composition 分别声明；SLAVE 遮罩只在 current peer、transport connection 与每个 required slice 的 current connection revision 全部就绪后解除。MASTER 不遮罩。selector 来自 CP-02/03 的 topology state-sync readiness owner，不新增 poller 或独立缓存。
- `PairReadinessInterlock` 由两个 integration composition 注入 `LayerStack`：业务层保持挂载但在遮罩时从 accessibility tree 隐藏；业务遮罩在业务层之上、本机 admin 层之下；遮罩加入 focus-boundary signature；关闭 admin 不会改变 readiness selector。Android hardware back 在mask激活且顶部不是admin layer时消费该事件，admin自身仍可关闭。
- 复用 `LayerStack` 与本机admin launcher；只增加 `admin` layer tier，避免用 `openedAt` 偶然决定遮罩/admin 前后。admin console与power confirmation均登记为该tier。
- 调用的第三方现有 API：RN lock 解析 `0.86.3`（`yarn.lock`）；官方 0.86 `View`/`BackHandler` 依据已补到详设 §7。其官方说明仅界定属性/事件API语义；Web绘制、VM触摸、键盘/屏幕阅读器业务体验仍须后续真实执行。

## 2 · 测试矩阵与真实命令输出

本次执行使用Yarn 4.17.0；下列 run suffix 来自仓内owned-test runner创建的临时结果目录。结果目录由runner执行后回收；表中保留终端真实摘要。各命令均在当前字节上执行。

| 执行面 | 命令 | 真实结果 |
| --- | --- | --- |
| render | `yarn workspace @catering-v2s/ui-base-render test` | PROD `PASS files=19 tests=118 allowedDevSkips=3`（run `LsI8jQ`）；DEV `PASS files=19 tests=118 allowedDevSkips=0`（run `XCSKyi`） |
| admin shell | `yarn workspace @catering-v2s/ui-base-admin-shell test` | PROD `PASS files=19 tests=61 allowedDevSkips=0`（run `4paXVz`） |
| integration assembly | `yarn workspace @catering-v2s/ui-base-integration-assembly test` | PROD `PASS files=7 tests=20 allowedDevSkips=0`（run `xIWXGR`） |
| sample console composition | `yarn workspace @catering-v2s/ui-integration-sample-console test` | PROD `PASS files=9 tests=61 allowedDevSkips=0`（run `k3DuqB`） |
| sample wallpaper composition | `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test` | PROD `PASS files=5 tests=29 allowedDevSkips=0`（run `nRuwaw`） |
| staff auth | `yarn workspace @catering-v2s/ui-feature-sample-staff-auth test` | PROD `PASS files=2 tests=13 allowedDevSkips=0`（run `rH0ZTF`） |
| member desk | `yarn workspace @catering-v2s/ui-feature-sample-member-desk test` | 修复后 PROD `PASS files=2 tests=33 allowedDevSkips=0`（run `UBtVrV`） |
| wallpaper picker | `yarn workspace @catering-v2s/ui-feature-sample-wallpaper-picker test` | PROD `PASS files=3 tests=18 allowedDevSkips=0`（run `PAMrWg`） |
| affected static checks | 对render/admin-shell/integration-assembly/two integration packages及member/staff/wallpaper feature运行各自`lint`、`typecheck` | 所有命令退出码0；包lint输出`expectedFiles=actualFiles`、0 errors、0 warnings |
| topology readiness | topology package focused suite（本CP-04拓扑源码/测试此后无字节变更） | 已有当前阶段输出 `PASS 1 file / 40 tests`；复用本CP既有证据，不重复运行 |

### 首败与根因修复

首轮 `member-desk` 包测试（run `ES0kFw`）输出四个测试清理失败：

```text
TERMINAL_PACKAGE_TEST_FAILURE package=@catering-v2s/ui-feature-sample-member-desk mode=PROD error=VITEST_EXIT:1
VITEST_FAILED_TEST file=memberDesk.test.tsx test=sample member desk UI feature uses the topology secondary fact for member navigation on a paired single-screen master detail=Error: ASYNC_RUNTIME_RESOURCES_REQUIRE_RELEASE_ASYNC
VITEST_FAILED_TEST file=memberDesk.test.tsx test=sample member desk UI feature keeps the customer surface on a paired single-screen slave before staff login detail=Error: ASYNC_RUNTIME_RESOURCES_REQUIRE_RELEASE_ASYNC
VITEST_FAILED_TEST file=memberDesk.test.tsx test=sample member desk UI feature reconciles the customer surface after a recovered members state transfer detail=Error: ASYNC_RUNTIME_RESOURCES_REQUIRE_RELEASE_ASYNC
VITEST_FAILED_TEST file=memberDesk.test.tsx test=sample member desk UI feature treats a repeated system failure observation as an idempotent existing notice detail=Error: ASYNC_RUNTIME_RESOURCES_REQUIRE_RELEASE_ASYNC
```

- **Classification：CONFIRMED。** `createTransportModule` 启动时调用 `context.registerAsyncResource`（`apps/terminal/kernel/base/transport/src/application/createTransportModule.ts:225-235`）；`releaseRuntimeForTest` 对仍有异步资源的runtime按设计抛`ASYNC_RUNTIME_RESOURCES_REQUIRE_RELEASE_ASYNC`，async seam 会 await `registry.releaseAsync()`（`apps/terminal/kernel/base/runtime/src/testing/releaseRuntimeForTest.ts:11-15`；`createRuntimeResourceRegistry.ts:24-43`）。上述四个 member-desk 测试均组装并启动 transport/topology runtime，却在`finally`同步释放（原`memberDesk.test.tsx:587,638,698,1607`）。
- **最小根因修正**：只在这四个含异步生命周期资源的测试 teardown 改用已公开的 `releaseRuntimeForTestAsync` 并`await`；没有改生产生命周期/transport，也没有另建 cleanup helper。
- **反例与范围**：同文件其余同步释放的 runtime没有触发该错误；搜索的同仓同步释放调用包含运行时/状态纯测试和不启动异步资源的夹具，未批量替换。含transport且需要releaseAsync的四个调用全部已改。
- **复验**：以同一Yarn workspace命令重新完整运行member-desk package，33 tests PASS；关闭该failure family。初始失败为首败，未删除或改写其结论。

最初尝试用错误workspace名称`@catering-v2s/sample-console`和`@catering-v2s/sample-wallpaper-console`，Yarn立即返回`Workspace ... not found`，没有启动测试；随后从各package.json确认workspace名，并用上表真实名字运行。该解析错误不计为测试运行。

## 3 · 对照原文与仍未验证

- IA总则/SAMPLE-04/05/06/09、交互工件SAMPLE-07/08/09/10/MASK-01、详设CP-04/V-15/V-16和计划CP-04已相互回读；LMS承载、mask状态ID与真实源码现状已同步。`doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-rereview-intake-codex.md` 是上一轮外部文档 finding 的主 agent intake。
- focused tests证明：selector状态组合、元素渲染顺序、accessibility隐藏、焦点边界marker、top-admin back-dismiss行为的测试分支，以及两个composition required slice集合。它们没有模拟真实 Expo Web/VM 的 z-order、触摸穿透、键盘、TalkBack/VoiceOver行为；这些仍留给全批 Web→VM。
- 本CP未运行 `scripts/verify`、Expo Web、DEV、VM、adapter、V-01～V-20任何端到端业务场景；这些仍为 NOT_RUN，不由阶段级对账升级。
- fresh reviewer `/root/cp04_reconciliation_r2` 完成需求/详设与IA/项目记忆三维证伪，结论 `STEP_RECONCILIATION=MATCHED`。详细只读依据记录于 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp04-reconciliation-codex.md`。

## 4 · Fresh CP-04 finding intake 与根因修正

首轮 CP-04 fresh reconciliation 为 `STEP_RECONCILIATION=OPEN`。Reviewer 证明composition required set中有切片没有真实 topology sync declaration：staff session 与 wallpaper owner 的 registration 是 `isolated`；两composition又没有把这些 owner registrations 输入 `selectStateSyncSlices`。同时重开同根member路径发现，原 member registry sync payload 发出完整 `{members,pending}`，与 branch-local pending隔离要求冲突。这三处属于同一个根因族：readiness依赖的projection slice 未把“应传的数据”和“本端必须保留的数据”编码在owner registration中。

主 agent 处置：

- staff owner session registration 改为 MASTER→SLAVE 的窄投影 `{status, operatorName}`，apply保存到 `hostQualification`，不覆盖SLAVE本机 session；`selectHostStaffQualification` 按当前 runtime mode返回主机资格或当前 MASTER 本机会话。passcode不进入持久化或sync payload。
- member registration 的 sync payload改成仅 `{members}`；apply更新host list并保留接收端`pending`。
- wallpaper registration发送MASTER确认的 `{wallpaperId}`；SLAVE apply只写`hostConfirmedWallpaperId`投影，保留本机`wallpaperId`与`pendingWallpaperId`。新增`selectHostConfirmedWallpaperId`，MASTER读取本机已确认值，SLAVE缺投影时返回`null`。
- 两个composition把实际staff owner registration加入topology declaration；壁纸composition同时加入wallpaper owner registration。新集合同其required readiness slice names一致。CP-05产生hostPendingProjection后再加入LMS required set，届时独立补focused proof。
- 更新三个owner README、selectors/invariants与本CP计划，说明传输字段和保留字段。未创建通用同步框架或独立 readiness cache。

## 5 · 修复后的当前字节 focused evidence

| 命令 | 真实输出 |
| --- | --- |
| `yarn workspace @catering-v2s/kernel-feature-sample-member-registry test` | 初次断言失败：fixture把`SyncValueEnvelope`当作裸值；源码确认wire entry是`{value,updatedAt}`后修正断言。保留首败；同一命令修后`PASS files=1 tests=10` |
| `yarn workspace @catering-v2s/kernel-feature-sample-staff-session test` | `PASS files=1 tests=8`；含真实owner sync apply后SLAVE本机session仍anonymous、hostQualification authenticated、payload不含passcode |
| `yarn workspace @catering-v2s/kernel-feature-sample-wallpaper test` | 首次失败在publicExports测试，检查发现`wallpaperSliceName`原已从index导出但未列在invariant；补齐后当前字节`PASS files=2 tests=10`；projection测试证明host confirmed值传入独立projection、本机confirmed及pending不变 |
| `yarn workspace @catering-v2s/ui-integration-sample-console test` | 首次失败：实际peer snapshot中没有staff slice；root cause定位为composition未传staff module stateSlices。补入实际module registration后`PASS files=9 tests=61` |
| `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test` | `PASS files=5 tests=29`；composition对peer实际发送session与wallpaper declarations，不声明不存在的member owner |

member-registry、staff-session、wallpaper、两个integration package的typecheck均exit 0；各自lint均PASS、0 errors/0 warnings。第一次wallpaper owner失败与member assertion失败均保留在执行记录：前者为修改公开selector时发现并修正invariant缺项，后者为测试对封套shape的误断言；没有改写first failure或把首次失败算作通过。

当前CP-04实现与focused proof已修复首轮reviewer提出的composition→declaration断点。第二位 fresh reviewer 确认：所需slice逐composition闭合；staff/member/wallpaper投影保留owner与branch-local字段；只有当前peer连接应用的revision可解除mask。CP-04为MATCHED。CP-05新增hostPendingProjection后须扩充承载LMS的required set并在CP-05单独验证、对账。Expo Web、VM、adapter与V-01～V-20继续NOT_RUN。
