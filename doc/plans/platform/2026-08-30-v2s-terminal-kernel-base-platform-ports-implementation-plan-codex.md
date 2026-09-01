# TER `kernel.base.platform-ports` · 实施计划

> 输入：`doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-platform-ports-requirements-claude.md` 与
> `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-platform-ports-implementation-design-codex.md`。
> 当前已获 Dexter 授权进入本包实施；本文是已批准详设的执行顺序与证据要求。

## 0 · 执行纪律与证明边界

```text
IMPLEMENTATION_AUTHORIZED=true
AUTHORIZED_BY=DEXTER_2026_08_30_PLATFORM_PORTS_REVIEW_GO
IA=NOT_APPLICABLE_WITH_REASON（无 UI/Journey）
STEP_RECONCILIATION=fresh independent subagent after every CP
WHOLE_SCOPE_RECONCILIATION=fresh independent subagent before CP-4 verification
TER_ONLY_VERIFY=true
REVIEW_REQUIRED_BEFORE_IMPLEMENTATION=false
```

每个实际写点前重新打开需求对应条目、详设对应类型/测试/门、六维路由命中的 TER memory 与当前 owning source；
focused proof 后用同一组原文回读。每个 CP 完成后必须先由 fresh 独立子 agent 三维对账，`OPEN` 由主 agent
修复并经另一 fresh reviewer 复核，之后才能进入下一 CP。测试不能替代对账。

## 1 · 逐文件清单

### 1.1 新增

| 文件 | 唯一职责 |
|---|---|
| `apps/terminal/kernel/base/platform-ports/src/types/result.ts` | 公共 result/unavailable/failure/timeout/accepted 模型 |
| `.../src/types/logging.ts` | logger 公开输入、事件与 recursive LogValue |
| `.../src/types/storage.ts` | string KV 共用接口 |
| `.../src/types/device.ts` | device/system/power 快照与订阅 |
| `.../src/types/appControl.ts` | 六类 appControl 能力与 accepted 终态提示 |
| `.../src/types/script.ts` | script JSON 协议与单一 dispatcher |
| `.../src/types/connector.ts` | call/subscribe/unsubscribe/on typed 契约 |
| `.../src/types/hotUpdate.ts` | package 与 marker typed 契约 |
| `.../src/types/logUpload.ts` | 按日期上传日志 typed 契约 |
| `.../src/types/topologyHost.ts` | host config/address/status/diagnostics |
| `.../src/types/platformPorts.ts` | logger binding、10 键 bindings、PlatformPorts、factory input |
| `.../src/foundations/sensitiveData.ts` | 全环境、key+value+message+error sanitizer；不导出 |
| `.../src/foundations/createPlatformPorts.ts` | central logger wrapper、穷尽装配、冻结 root |
| `.../src/defaults/logger.ts` | `consoleLoggerBinding` |
| `.../src/defaults/processMemoryStorage.ts` | 明示不跨重启的 Map storage |
| `.../src/defaults/unavailablePersistSecure.ts` | persistSecure 全方法 unavailable |
| `.../src/defaults/unavailableDevice.ts` | device 全方法 unavailable |
| `.../src/defaults/unavailableAppControl.ts` | appControl 全方法 unavailable |
| `.../src/defaults/unavailableScript.ts` | script 全方法 unavailable |
| `.../src/defaults/unavailableConnector.ts` | connector 全方法 unavailable |
| `.../src/defaults/unavailableHotUpdate.ts` | hotUpdate 全方法 unavailable |
| `.../src/defaults/unavailableLogUpload.ts` | logUpload 全方法 unavailable |
| `.../src/defaults/unavailableTopologyHost.ts` | topologyHost 全方法 unavailable |
| `.../test/platformPorts.test.ts` | A 组装配与冻结 |
| `.../test/defaultPorts.test.ts` | D 组可用/不可用默认逐方法覆盖 |
| `.../test/successSemantics.test.ts` | S 组 accepted/succeeded/timed-out |
| `.../test/logger.test.ts` | L 组完整禁记清单与非敏感反例 |
| `.../test/public-surface.typecheck.ts` | C/F 组、排除项、ts-expect-error |
| `.../vitest.config.ts` | node 环境，仅匹配 `test/**/*.test.ts` |
| `tools/terminal-platform-ports/check-static.mjs` | 四门 + exact-export support |
| `tools/terminal-platform-ports/check-static.test.mjs` | temp fixture 定向 red/green model test |
| `doc/evidence/platform/terminal-kernel-base-platform-ports/implementation-codex.md` | 未来实施新鲜证据摘要；当前不创建 |

### 1.2 修改

| 文件 | 唯一变更 |
|---|---|
| `apps/terminal/kernel/base/platform-ports/src/index.ts` | 逐项显式导出详设 §10.2 清单；保留三个骨架元数据 |
| `apps/terminal/kernel/base/platform-ports/tsconfig.json` | include src/test/vitest config |
| `apps/terminal/kernel/base/platform-ports/package.json` | 新增 `test` script 与 `vitest: 4.1.10`；production dependency 仍只有 contracts |
| `tools/terminal-contracts/check-static.mjs` | 导出可复用 TR-05 AST/TypeChecker analyzer；contracts 自身四门/输出不变 |
| `tools/terminal-contracts/check-static.test.mjs` | 证明重构后 contracts 原有 red vectors 不漂移 |
| `tools/terminal-skeleton/verify-static.mjs` | contracts real/model 后串接 platform-ports model/real |
| `tools/terminal-skeleton/verify.mjs` | test owner exact-set 从 contracts+5 adapters 改为 contracts+platform-ports+5 adapters；期望 2 REAL + 5 NO_TEST_FILES |
| `tools/terminal-skeleton/verify.test.mjs` | 对应 owner/marker 正反模型更新 |
| `yarn.lock` | 后续仅由 Yarn 安装派生；不得手改 |

### 1.3 明确不修改

`moduleName.ts`、`dependencies.ts`、`skeleton-graph.ts`、其余 21 包生产源码、五个 adapter manifest/native、
assembly、workflow/runtime、仓级 verifier。发现需要修改其中任一项即停机。

## CP-1 · 类型、公开面与消费者编译夹具

### 1.1 写前双读

重开需求 §3、§5.1–5.6、§7 P-1/P-2/P-3/P-5/P-7–P-12、§8 C/F、详设 §4–7/§10/§12，
以及 POC 对应 Kotlin/TS owner。确认 `localWebServer=不建`、actual port count=10、connector 分类未冻结。

### 1.2 RED

1. 先改 tsconfig 使 test 真实进编译面；新增 `public-surface.typecheck.ts`。
2. 从 package root 写 C-1…C-4、C-6、F-1、F-2、F-4；C-5/F-3 依赖 CP-2 才出现的运行时
   `createPlatformPorts`，在 CP-2 factory 完成后补齐；此时缺类型，typecheck 必须红。
3. 首败只记录第一个“public export 不存在”或“接口不完整”，不把连锁错误当多项缺陷。

未来 focused command：

```sh
yarn workspace @catering-v2s/kernel-base-platform-ports typecheck
```

### 1.3 GREEN 顺序

顺序固定，后一步不得反向改变前一步 discriminant：

1. `types/result.ts`：五态 union 与 10 值 `PlatformPortName`；无 localWeb/display/automation。
2. `types/logging.ts`、`types/storage.ts`。
3. `types/device.ts`、`types/appControl.ts`。
4. `types/script.ts`、`types/connector.ts`；connector 只允许 opaque channelKey。
5. `types/hotUpdate.ts`、`types/logUpload.ts`、`types/topologyHost.ts`。
   `HotUpdateMarkerInput` 与 `HotUpdateMarker` 均保留可选 `resetRequestId: RequestId`，为
   `resetRuntime` accepted 后 successor-runtime 的同请求关联提供唯一 typed 载体；这是现有类型字段的补充，
   不新增公开导出名。
6. `types/platformPorts.ts`：10 键 exact record 与 environmentMode 输入。
7. `src/index.ts`：按详设 §10.2 逐项导出，禁止 barrel `export *`。

每一组完成即跑 typecheck；不得用临时 `as unknown as`、`any`、open Record 让中间态变绿。

### 1.4 typecheck 反向控制

在仓外 scratch 复制最小闭包，先确认 `--listFilesOnly` 命中 type fixture。删除 C-6 或 L-12 一行
`@ts-expect-error`，预期 non-zero 且分别出现 brand 不可赋值或 `LoggerPort` 无 `emit`；随后真实树 typecheck 0，
scratch cleanup PASS。

### 1.5 完成信号

- package root 能构造 10 个完整端口与 10 键 binding；C-5/F-3 的 factory 调用在 CP-2 完成后补入，
  不把未存在的运行时符号用声明桩掩盖；
- 本批实际构建端口数固定为 10：需求中的 11 个候选由详设 §4 五问覆盖，`localWebServer` 判定为不单建；
- localWeb/display/automation/emit 负夹具有效；
- `Record<string, unknown>`、any、双重 cast 搜索为 0；
- type fixture 真进 tsc，反控红、真实树绿；
- 无任何生产 dependency/出边变化。

完成后 fresh reviewer 做 CP-1 三维对账；未闭合不得开始 CP-2。

## CP-2 · 默认实例、factory 与运行时单测

### 2.1 RED

1. 新建四个 Vitest 文件，逐条写详设 A/D/S/L 表；不先写实现。
2. package test script 固定：

```json
"test": "vitest run --config vitest.config.ts && node -e \"console.log('TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-platform-ports')\""
```

3. 增加 `vitest: 4.1.10` 后由 Yarn 从仓根生成 lock/install state；不得手改 lock。
4. 先取得有意义 RED：缺 default/factory/sanitizer，而不是依赖未安装噪音。

### 2.2 GREEN 顺序

1. `sensitiveData.ts`：写死完整禁记类别；先过 L-1/L-2/L-11，再逐类过 L-3…L-10；合法热更新 hash、版本串与余额字段必须保留，`LogContext.commandName` 也走同一 value sanitizer。
2. `defaults/logger.ts` + factory 中 central logger：console/sink 两种 binding 都只收到 sanitized event；console 的 debug/info/warn/error 四级在 DEV/TEST/PROD 均实际写出，禁止无声级别抑制。
3. `processMemoryStorage.ts`：8 方法；JSDoc 精确含 `PROCESS_MEMORY_ONLY: data is not persisted across process restart`。
4. 八个 unavailable 文件：逐方法返回自身 port/capability、`ADAPTER_NOT_INJECTED`，不调用 callback。
5. `createPlatformPorts.ts`：构造 central logger，保留其余实例 identity，返回 `Object.freeze` 根对象；不返回 environmentMode。
6. S 组 fake 只放 test；不得在 production 提供 pending tracker、registry 或假 host lifecycle。

### 2.3 focused proof

```sh
yarn workspace @catering-v2s/kernel-base-platform-ports typecheck
yarn workspace @catering-v2s/kernel-base-platform-ports test
```

读取原始 test 输出；D-1 必须逐环境逐 level 断言对应 console spy 收到 sanitized event，每个 D-3…D-10 必须逐方法覆盖，
S-2 必须由 fake observer 的 successor signal 驱动 pending→succeeded，S-4 必须由超出预算的 fake 方法产出 timed-out，
L-2 必须明确三环境。测试 marker 只在 Vitest exit 0 后打印。

### 2.4 完成信号

- A=3、D=10、S=4、L=13 全部绿；
- 10 键 root 真冻结；2 个可用默认真的能用；8 个不可用默认逐方法 typed；
- raw sensitive fixtures 在 sink/event 全部零命中，合法诊断字段保持，普通值不被全抹；
- `REAL_TESTS` marker 恰好一次。

完成后 fresh reviewer 做 CP-2 三维对账；未闭合不得开始 CP-3。

## CP-3 · 静态门与 TER-local 验证接线

### 3.1 复用 TR-05 analyzer

从 `tools/terminal-contracts/check-static.mjs` 提取/导出 generic analyzer，但不得改变 contracts 的四门名、support
计数、真实树输出或既有 red vectors。先跑 contracts model/real 证明零回归，再给 platform-ports checker 使用。

### 3.2 四门与具体红夹具

| 顺序 | 改哪里 | 改什么 | 目标错误 | 其它门 |
|---|---|---|---|---|
| 1 | fixture `src/types/connector.ts` | 给 exported response 加 `payload: Record<string, unknown>` | `TR-05 Record<string, unknown>` | 必须绿 |
| 2 | fixture `src/types/connector.ts` | `ConnectorPort.on` 改 `on?` | `optional port method ConnectorPort.on` | 必须绿 |
| 3 | fixture `src/defaults/unavailableConnector.ts` | 加 `import type {Store} from 'redux'` | `default import outside allowlist: redux` | 必须绿 |
| 4 | fixture `src/types/device.ts` | 加 `import type {NativeModules} from 'react-native'` | `platform import react-native` | 必须绿 |
| support | fixture `src/index.ts` | 加 `export const unexpectedPortExport = 1` | `public export exact-set mismatch` | 四门必须绿 |

每次 mutation 从未改副本开始；finally 删除 temp，固定打印 cleanup PASS。全部 red 向量完成后，同一 checker 对真实树
输出 `PLATFORM_PORT_RULE_GATES=4`、`PLATFORM_PORT_SUPPORT_CHECKS=1` 和 PASS marker。

### 3.3 TER-local 接线

1. `verify-static.mjs` 在既有 skeleton、contracts 之后运行 platform-ports model/real；失败时不得打印
   `TERMINAL_STATIC=PASS`。
2. `verify.mjs` 的 `expectedTaskOwners('test')` 精确为 contracts、platform-ports、5 adapters；禁止用目录数量动态
   放宽 owner 集合。
3. marker 判定改为 `real.length===2`、`noTests.length===5`，并逐名确认两个 REAL owners。
4. `verify.test.mjs` 加缺 platform-ports marker、把 platform-ports 伪成 NO_TEST_FILES、多 extra owner 三个红向量。

未来 focused commands：

```sh
node tools/terminal-contracts/check-static.test.mjs
node tools/terminal-contracts/check-static.mjs
node tools/terminal-platform-ports/check-static.test.mjs
node tools/terminal-platform-ports/check-static.mjs
yarn workspace @catering-v2s/terminal verify:static
```

### 3.4 完成信号

- contracts 原门/输出零漂移；platform 四门每道 red + real green；support red + real green；
- TER static marker 只有全链绿才出现；
- Turbo dry test owners 精确 7；expected REAL=2、NO_TEST_FILES=5；
- 未运行仓级 verifier。

完成后 fresh reviewer 做 CP-3 三维对账；未闭合不得开始 CP-4。

## CP-4 · 全范围对账、TER-local 验收与交付

### 4.1 整体测试前 fresh 全范围对账

独立 reviewer 不汇总前三次结论，重新从需求、详设/计划、项目记忆和真实树逐条核：

- 11 候选处置=10 build + localWeb 不建；无 display/automation；
- 10 port shapes、逐方法平台归属/成功五问、2 可用 + 8 不可用；
- exact exports、无 open boundary、无 optional ports/methods；
- A/D/S/L/C/F 与反控；四门/support；
- test owners 2 REAL + 5 NO_TEST_FILES；
- `UNVERIFIED_REQUIRES_EVIDENCE` 与 `DEXTER_DECISION` 未被升级。

任一 `OPEN` 先修复并由另一 fresh reviewer 复核，才运行整体命令。

### 4.2 未来 TER-local 整体命令

```sh
yarn workspace @catering-v2s/kernel-base-platform-ports typecheck
yarn workspace @catering-v2s/kernel-base-platform-ports test
node tools/terminal-contracts/check-static.test.mjs
node tools/terminal-contracts/check-static.mjs
node tools/terminal-platform-ports/check-static.test.mjs
node tools/terminal-platform-ports/check-static.mjs
yarn workspace @catering-v2s/terminal verify:static
yarn workspace @catering-v2s/terminal verify
```

只用 TER-local 两个入口；不运行仓级 normal。读取每条新鲜 stdout/stderr、exit、marker、elapsed 与 scratch/export
cleanup。Expo export 只证明 assembly 对新公开面的 Metro 消费闭包，不证明任何 native adapter 已实现。

### 4.3 实施证据必填

未来 `implementation-codex.md` 必须记录：

1. 11 候选逐项处置与 localWeb 五问失败事实；
2. 10 端口 exact methods/exports 与 POC 15 条差异；
3. 逐方法平台矩阵、五问与默认档位；
4. A/D/S/L/C/F 每条 case 的命令、exit、断言；
5. type fixture listFiles、去 `@ts-expect-error` red、真实树 green、cleanup；
6. 四门/support 各自 red、真实树 green、cleanup；
7. test owner exact-set、`REAL_TEST_PACKAGES=2`、`NO_TEST_PACKAGES=5`；
8. persistKv `PROCESS_MEMORY_ONLY` 风险；
9. connector taxonomy、app exit/kiosk owner、四平台 adapter、topology/hot-update 的未验证边界；
10. business/result 与 cleanup 分开，不把 static/typecheck/Metro 升格为设备或 native 证明。

### 4.4 实现 review

整体证据全绿后，才发起 fresh 独立 `REVIEW_TARGET=IMPLEMENTATION`。reviewer 必须重开真实源码和新鲜证据；
“按已批设计实现”不能豁免方案合理性复判。Claude review 结论仍由 Dexter intake，不自动授权下一包。

## 5 · 不得自行决定 / 停机清单

本节复用详设 §13 的停机条件；两份材料不得各自维护一套重复清单。除详设清单外，本计划只增加
TER-local 测试 owner 的固定收口约束：`contracts` 与 `platform-ports` 必须各有且仅有一个
`REAL_TESTS` marker，五个 adapter 必须各有且仅有一个 `NO_TEST_FILES` marker，总测试 owner 精确为七。

不得用“按需设计”“选择合适类型”“视情况而定”替代停机；没有本文唯一答案的事项必须上报。

## 6 · 当前实施完成条件

当前实施任务的完成条件：CP-1 至 CP-4 按本文顺序完成；五处 finding 均有源码/文档落点；
TER-local typecheck、test、四门/support、`verify:static` 与 `verify` 的新鲜输出和 cleanup 均留证；
整体测试前完成 fresh 全范围三维对账；随后交 Dexter 与 Claude 做 `REVIEW_TARGET=IMPLEMENTATION`。
