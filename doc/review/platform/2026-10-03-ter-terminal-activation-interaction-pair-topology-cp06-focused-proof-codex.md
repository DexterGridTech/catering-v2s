# CP-06 Focused Proof — Integration Stage Routing

日期：2026-10-03 KST

状态：`CP06_FOCUSED=PASS`；`CP06_STEP_RECONCILIATION=MATCHED`（fresh independent reviewer `/root/cp06_reconciliation_r5`）；全批 `6b=NOT_RUN`；Expo Web、VM、adapter、DEV 与 V-01～V-20 动态验收均为 `NOT_RUN`。

## 变更点与证明

| 范围 | 当前证明 | 判定 |
| --- | --- | --- |
| 已持久化的 authenticated session 不得越过 terminal activation gate（sample-console） | `yarn workspace @catering-v2s/ui-integration-sample-console typecheck`（exit 0，无输出）；`yarn workspace @catering-v2s/ui-integration-sample-console test`；完整输出见 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-sample-console-test.log`，10 test files / 63 tests / 0 skips，`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS`。regression 先以正式 staff login command 写入持久化，等待 storage 中 session owner 的 status 与 operatorName 两个键真实出现，再释放旧 runtime，以相同 storage 与 persistence key 创建新 runtime，验证恢复 authenticated 事实后当前 screen 仍为 `terminal.activation.lmp`。 | PASS |
| 已持久化的 authenticated session 不得越过 terminal activation gate（sample-wallpaper-console） | `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console typecheck`（exit 0，无输出）；`yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test`；完整输出见 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-sample-wallpaper-console-test.log`，6 test files / 32 tests / 0 skips，`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS`。同样通过真实 login command、storage 键读回与 runtime 重建验证 gate。 | PASS |
| 相同 stage 的 client RTT 更新不得清除表单 | 上述两个真实 integration 包的 owner-stage regression：console 在已路由的 member form 输入 `Alice pending` 后派发 TDC `recordRtt` reducer action，断言 screen 仍为 member form、输入仍在；wallpaper console 在 login form 输入 `A001 pending` 后派发相同 action，断言 screen 与输入均保留。使用各 integration 的真实 assembly/surface，不 mock stage actor。 | PASS（integration/store/render 边界；未模拟真实 TDS PONG frame） |
| 同包持久化重启/投影用例观察真实 owner 写入 | 两 integration 的既有 persistence/cold-start 测试内四处 350ms 等待改为读回持久化内容。focused 两命令原始输出见 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-persistence-focused.log`：console 1 file / 2 passed；wallpaper 1 file / 2 passed。 | PASS |
| managed Expo Web 通用 runner 场景与 test-expo 入口的分母 | `node --test scripts/test/ter-admin-display-web.test.mjs`，退出码 0：23 tests / 23 pass / 0 fail；原始输出见 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-web-runner-test.log`。`WEB_SCENARIOS` 闭集及完整 integration/surface/failureOwner 准入矩阵通过；无效 app/scenario tuple 在 runner 启动前被拒绝。新增 contract test 逐个读取两个 `test-expo/App.tsx`，确认 runner 的 integration root、appName 与 assembly factory 一一对应。 | PASS（通用 runner 契约；非 V-01～V-20 业务 Web 运行） |

## 首败与根因处置

- 首次将 stage regression 直接加入既有大型 assembly suite 后，测试夹具未提供 `deviceInfo`；另一个路径没有 runtime event receiver。按真实依赖补齐设备 fixture，并改用真实持久化 login 后 runtime 重建。此后大型 suite 仍出现渲染树相互影响；将新 regression 独立到 `ownerStageRegression.test.tsx`，原有 suite 随后通过。新增 surface 测试需满足 admin launcher 的 `measureInWindow` host 契约，补上最小 RNTL host shim 后两个 integration 包完整测试通过。首败没有改写为 PASS。
- Web runner contract 首次运行有一条过时字面检查：测试要求年龄、会员表单 testID 在组件源码中以常量字面出现，而 owning source 已使用 `ageFieldId(prefix)` / `` `${prefix}:field` `` 动态绑定。检查器同族还包含 age ID 工厂的旧字面期望；逐项对照当前 hook、field source 和 testID denominator 后，将 gate 改为断言实际动态绑定表达式。中间 focused 复验继续暴露成员表单与 age factory 两个同根旧断言，均已修正。最后 focused 项 PASS，随后完整 Node contract suite 23/23 PASS。

## Web 场景边界与 N-1 intake

Claude N-1 的前提部分成立：仓内有 `WEB_SCENARIOS` 共享目录、app-specific scope validator、穷举 admission matrix 和两个真实 test-expo 入口；因此“完全没有场景集/入口”的绝对说法不成立。问题在于这组通用目录覆盖屏幕错误、键盘、admin shell 与 platform-ports，不等于专项 V-01～V-20 业务场景。原计划“复制同一 webscenario set 到两 app”会把 app-specific 功能错误地当成两个 integration 都承载。

最小修正已同步到详设 V-20 和计划 CP-06：通用 runner 按完整 admission matrix 执行每个 app 实际承载的行；产品验收分母仍为 V-01～V-20，每个 V-ID、业务 oracle 与 cleanup 按详设 §11a 逐项先 Web 后同 ID 的适用 VM topology；adapter 行在对应 VM 单独证明。现有 runner contract test 只证明通用目录准入，不证明专项 V 场景已执行或其 runner 已具备所有交互。V-01～V-20 与双机动态结果继续 `NOT_RUN`，交 CP-06 reviewer 核实文档与实施证据的闭合程度，未获 MATCHED 前不开始全批 6b。

## 当前字节指纹

```text
33c5dfa5a8ea1b99c3e7c356fe02954dea3173e03a77b36a39a1fa5a550c86dc  apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx
6935fc30ad40c376c0155cb51bfad5e579dcefa127236637e7d644a6320cfa95  apps/terminal/ui/integration/sample-console/test/ownerStageRegression.test.tsx
15f02415c052f57df866f9776c455327f1942980dc4da1ce79088760c90ef72a  apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx
775fb9cc4f2c4b486adb8ac26b1373e5f96e45423924704f4114e9c7c19a1962  apps/terminal/ui/integration/sample-wallpaper-console/test/ownerStageRegression.test.tsx
7b5797d3a4a5e0ae7f3b58c8e857531d80e5661bbd5d9ed7aa123285a00f437e  scripts/test/ter-admin-display-web.test.mjs
44050706f5004f30be6e650c8793f2f96d2fb10add0abfb70d9d79876ee651d3  scripts/test/ter-admin-display-web-contract.mjs
30d4ff28888ac9d89fb78727ebf50399a8dff5e087e2d71439aa0ec1432712f4  scripts/test/ter-admin-display-web.mjs
3f649b8fa1ce2cda6a43ad3e21b94e1efdec87e41fca7488c7bd3fc963b48587  apps/terminal/ui/integration/sample-console/test-expo/App.tsx
64562d4a961ae18250b22613b9e4c11e3603d6e265b7db11e56b3207487dcfa0  apps/terminal/ui/integration/sample-wallpaper-console/test-expo/App.tsx
24f17e51e05e6b252ba55daf922c361c0a0880ba6573e3aeb0015c91d4a655ab  doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md
786bb5f8f02f5b9e2e26063aedf7099ea3e08d1270cfae8a18e813c2e292b591  doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md
deb4a736d8d4989f13feeaeb47e0777402d4ee624eb2ab346779924fa4ee9306  doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-sample-console-test.log
f4c658b173e97363e8bde8fa44423b1da485c247518bcef6fb27e2ab3474b8ca  doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-sample-wallpaper-console-test.log
36d84703fc35ac28984fea989d0b4d68e1c0b35e71b5e9cb13ef421a02898b78  doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-web-runner-test.log
0ae55dba230cb9035af4d2389eede81f862047ad5078c505870a69c5637b4550  doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-persistence-focused.log
```

## Remaining CP-06 work

Fresh independent whole-CP reconciliation: `STEP_RECONCILIATION=MATCHED`, no findings; see `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-cp06-reconciliation-codex.md`. The verdict verifies CP-06 source/doc/test/log consistency and does not claim that the current Web runner executes all V-01～V-20. Next obtain independent whole-batch 6b MATCHED, then implement/execute the scoped managed V scenarios in the approved Web→VM order, with two distinct device identities for dual-machine cases. Business and cleanup must be recorded separately.
