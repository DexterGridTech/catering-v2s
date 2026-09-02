# TER `kernel.base.display-context` DC-P0～DC-P5 实施证据

## 1. 范围与输入

- `REVIEW_TARGET=IMPLEMENTATION`
- 授权范围：`DC-P0`～`DC-P5`、display-context 本包、为 `DevicePort.getDisplayInfo` 所需的
  platform-ports 端口与 invariant 变更、TER-local static/verify。
- 未授权且未执行：仓级 normal verify、单元 B、其它 owner 包、workspace scoping、native、Gradle、
  真实设备、DEV、seed、reset、browser L2、UAT、部署与数据操作。
- 需求正本 SHA-256：
  `e29965294f465d139e920ac8aefad524e50a9716bd25a03838c81cf84e989684`。
- 详设 SHA-256：
  `f6bc30d400a5aa64af09d77b5352d7e98893a0f1cd24961cbe8bde5d044bf310`。
- 实施计划 SHA-256：
  `b7f3dbfe41c09ff8e3e3f43ea88b898700f5b1ef38f558f00c327a19e3ea9acf`。

## 2. 实施结果

### DC-P0 runtime 接缝

- runtime 改为 post-commit 的 runtime-owned `runtimeInstanceModeChanged` command；display-context
  作为第二消费者，不再使用 role-change effect/action-array 接缝。
- child command 使用私有 5 秒 timeout，继承 parent command/request/route；child 非 completed 只记录
 诊断，不回滚已经提交的 runtime role，也不把父 command 的 role commit 改报失败。
- `RuntimeModuleContext.registerResource` 为必填并接入既有 runtime resource registry。
- 当前 runtime public invariant 为 63；P0 fresh 独立静态对账：GO，M/S/N=0/0/0，动态证明未执行。

### DC-P1 platform-ports

- 新增 `DisplayInfo { readonly displayCount: number }`。
- `DevicePort.getDisplayInfo(DeviceCall): Promise<PortResult<DisplayInfo>>` 已加入类型、默认端口、
  root export 与 platform invariant。
- 平台端口公开面为 125；`DevicePort` 方法数为 6。
- P1 fresh 独立静态对账：GO，M/S/N=0/0/0，动态证明未执行。

### DC-P2～DC-P3 display-context

- 建立 displayRole owner slice、四条 command、五个 actor、五个派生函数、selector、display info
  读取与持久化路径、电源 bridge、module factory、README 与 HANDOFF。
- 所有写入 `VICE` 的路径实时读取并校验 `displayCount === 1`；目标 `CHIEF` 不查询设备屏数。
- hydrate 校验在 install 内 await，启动期 `getDisplayInfo` Promise 未完成时 runtime 不得先进入 started。
- 电源首事件仅播种，同值去重，跃迁由串行 dispatch tail 按接收顺序转换成 command。
- `onApplicationReset` 不定义；生产 unsubscribe 依赖未来 Runtime stop/dispose，test-only release 仅证明
  本地资源失活与 unsubscribe 调用发起。
- display-context 公开面为 17；测试分组为 A14、B8、D8、E9、P5、R5、T2、W4，共 55 条。
- 修复后的 P3 fresh 独立静态对账：GO，M/S/N=0/0/0，动态证明未执行。

## 3. P4 修复项

- `createPowerStatusBridge.ts` 对 `subscribePowerStatus` Promise reject 做受控捕获，记录不含 raw error
  message 的 typed 诊断并保持 install 成功。
- 对 subscribe/unsubscribe 的 `failed`、`timed-out`、`unavailable` 分支保留原始 `status`、
  `capability` 及对应的 `errorCode/retryable`、`timeoutMs` 或 `reason`；reject 分支记录受控
  `errorType`，避免 unhandled rejection。
- B-5 增加 unavailable reason 与 subscribe reject 的观察；B-8 增加 unsubscribe failed、timed-out、
  unavailable、reject 诊断的观察；总测试数保持 55。
- P4 修复后 focused proof：typecheck 退出 0；4 files、55 tests 全部 PASS。
- P4 修复后的 fresh 独立静态对账：GO，M/S/N=0/0/0；该对账允许只读 shell，未运行 build/test/typecheck/verify。

## 4. 已执行的 focused proof

### display-context package

命令：

```text
yarn workspace @catering-v2s/kernel-base-display-context typecheck
yarn workspace @catering-v2s/kernel-base-display-context test
```

结果：退出码 0；4 个 test files、55 个 tests 全部通过；
`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-display-context`。

### runtime 与 platform-ports packages

命令：

```text
yarn workspace @catering-v2s/kernel-base-runtime typecheck
yarn workspace @catering-v2s/kernel-base-runtime test
yarn workspace @catering-v2s/kernel-base-platform-ports typecheck
yarn workspace @catering-v2s/kernel-base-platform-ports test
```

结果：runtime 13 files、78 tests PASS；platform-ports 4 files、16 tests PASS；两个 package test marker
均为 `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS`，命令退出码 0。

### display-context static model 与 red vectors

`node tools/terminal-display-context/check-static.test.mjs` 结果：

```text
DISPLAY_CONTEXT_RED_PUBLIC=display-context-public-surface:FAIL,display-context-owner-kind:PASS,display-context-restart-positive:PASS,display-context-no-display-index-in-slice:PASS;support=PASS
DISPLAY_CONTEXT_RED_OWNER_KIND=display-context-public-surface:PASS,display-context-owner-kind:FAIL,display-context-restart-positive:PASS,display-context-no-display-index-in-slice:PASS;support=PASS
DISPLAY_CONTEXT_RED_RESTART=display-context-public-surface:PASS,display-context-owner-kind:PASS,display-context-restart-positive:FAIL,display-context-no-display-index-in-slice:PASS;support=PASS
DISPLAY_CONTEXT_RED_SLICE_SHAPE=display-context-public-surface:PASS,display-context-owner-kind:PASS,display-context-restart-positive:PASS,display-context-no-display-index-in-slice:FAIL;support=PASS
DISPLAY_CONTEXT_MODEL_CLEANUP=PASS
TERMINAL_DISPLAY_CONTEXT_STATIC_MODEL_TEST=PASS
```

`node tools/terminal-display-context/check-static.mjs` 结果：

```text
DISPLAY_CONTEXT_RULE_GATES=4
DISPLAY_CONTEXT_SUPPORT_CHECKS=1
DISPLAY_CONTEXT_SUPPORT=PASS
TERMINAL_DISPLAY_CONTEXT_STATIC=PASS
```

## 5. TER-local `verify:static`

命令：`yarn workspace @catering-v2s/terminal verify:static`

结果：退出码 0，`TERMINAL_STATIC=PASS`。六条 skeleton rule gates、support、contracts/platform-ports/
state/runtime/display-context 各自 model/real static 均 PASS；display-context 四个 red vector 仍分别
只击穿目标门。该运行的 structured debug 日志显示 skeleton model-test 约 30 秒，其余阶段均有 start/finish
与 duration，不是无输出等待。

## 6. TER-local `verify`

命令：`yarn workspace @catering-v2s/terminal verify`

结果：退出码 0，关键原始输出：

```text
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=10
TERMINAL_TEST_MARKERS=PASS real=5 noTests=5
Android Bundled 3504ms apps/terminal/assembly/android/pos-desktop/index.ts (730 modules)
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

Expo export 在本证据中只表示 Metro/JS 打包与入口消费闭包；不表示 native、Gradle、autolinking、真实
设备或 adapter 能力已证明。此次未运行仓级 `scripts/verify`。

## 7. 独立对账与未证明边界

- P0、P1、P2、修复后的 P3、修复后的 P4：fresh 独立静态对账均 GO，M/S/N=0/0/0。
- 全部 CP 完成后的 fresh 全范围三维对账：GO，M/S/N=0/0/0；确认 CP0～CP5、公开面、测试分母、invariant、TER-local 接线与授权边界无偏移。
- 每个 CP 的 focused proof 后均由 fresh 独立子 agent 进行三维对账；全部 CP 后须再做一次全范围
  对账，确认 requirements、详设、计划、规范/记忆与当前源码一致。
- 本次明确未证明：Android/native adapter 的电源订阅实现、Gradle、真实设备运行、生产 teardown、
  transport activation、routeContext 的生产可信性、跨重启角色留痕、browser L2、UAT、部署。
- 已知设计边界：batch-1 默认 DevicePort 不提供真实 display info，持久化 VICE 在启动校验无法确认
  单屏时纠正为 CHIEF；生产 Runtime 当前没有 stop/dispose，电源订阅依赖进程退出回收。

## 8. Finding 闭合记录

| Finding | 落点 | 状态 |
| --- | --- | --- |
| S-1 registerResource 替代方案比较 | 详设 §5.2：比较 install cleanup 返回值并说明其无消费点、无法统一资源所有权，采用既有 registry | CONFIRMED |
| S-2 生产订阅无 release 路径 | 详设/计划/README/HANDOFF 均登记 production stop/dispose 欠账；test-only release 不升格 | CONFIRMED |
| N-1 不定义 onApplicationReset | module factory 不提供该钩子，README/HANDOFF 与行为测试写明 reset 不重跑 install | CONFIRMED |
| N-3 timed-out 映射 | 详设与 bridge 均将 `PortResult.status === 'timed-out'` 作为非 succeeded，保留 timeoutMs 并进入诊断 | CONFIRMED |
| P4 recheck 的 subscribe reject | bridge try/catch + B-5 reject 场景，install 保持 started | CONFIRMED（静态/包测试） |
| P4 recheck 的 unsubscribe 诊断保真 | helper + B-8 四类失败场景断言 status/capability/details | CONFIRMED（静态/包测试） |

最终 `REVIEW_TARGET=IMPLEMENTATION` 结果须以 Dexter/Claude 的 fresh review 为准；本证据不替代独立
review，也不将任何静态或 TER-local 结果升级为 native/设备/用户行为证明。
