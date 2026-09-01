# TER kernel.base.state 实施证据（Codex）

## 0 · 范围与结论

REVIEW_TARGET=IMPLEMENTATION

本次只实施 `apps/terminal/kernel/base/state`、`tools/terminal-state` 四道门与 TER-local verifier 接线。
另按 implementation review 的 N-1 补充 `apps/terminal/kernel/base/contracts/README.md` 的 `AppError`
适用范围说明；未修改其他 21 个 TER 包的生产源码；未运行仓级 normal `scripts/verify`；未做设备、Gradle、DEV、seed、reset、浏览器 L2、UAT 或部署。

结论：本包实现、测试、四门、README 与 TER-local `verify:static` / `verify` 均已通过新鲜验证。

## 1 · review finding 落点

| finding | 处置落点 |
|---|---|
| S-1 `getState` 与读侧例外表述 | 详设已改为：`getStore()` / `getState()` 暴露 Redux 原生根，读侧受 TR-03 门约束；本包未导出 `readSlice(name)` 之类具名便捷读取入口 |
| S-2 blocked backend 无恢复路径 | 实现为一次性 `#tryRebaseline`：blocked 后端第一次后续 flush 尝试 `listKeys` + `readMany`，成功解除 block，失败本进程内不周期重试；H-3/H-4 覆盖 |
| N-1 `valueHash` 不是 hash | `SyncStateSummaryEntry.valueHash` JSDoc 与 README 均声明它是完整 canonical serialization；S-1 测试名与断言覆盖 |
| N-2 health subscription 未覆盖 | F-1 订阅后触发写失败，断言 listener 收到 degraded 且 revision > 0 |
| N-3 field value 类型不受 JSON 约束说明 | `StateRuntimePersistenceFieldDescriptor.shouldPersist` JSDoc 说明 field 保持 owner 字段类型，JSON safety 在 codec 边界执行 |
| N-4 需求 P/X 组 `writeMany` 旧措辞 | 需求 §9 P/X 两行已指向详设 §5.4，当前实现生产路径零 `writeMany` / `removeMany` / `clear` |
| S-1 内部 persistence registration 可选字段袋 | `RegisteredStateRuntimePersistence` 已改为 field/record 判别式联合；回调与归一化 key 必填，引擎不再使用可选链或字面量兜底 |
| S-2 `PersistenceHealth.lastFailure` 语义 | 类型 JSDoc 与 README 明确 `lastFailure` 是历史诊断值，当前健康状态只由 `status`、`dirtyKeys` 与 `blockedStorageKinds` 判定 |
| N-1 contracts 错误协议适用范围 | `contracts/README.md` 明确 `AppError` 面向跨包边界的运行期/业务错误；构造期程序员错误直接抛 `Error` 以保留栈并炸掉装配 |
| N-2 `lastFailure` 粘着 | 同 S-2，类型与 README 明确这是历史诊断值，不作为当前健康判据 |
| N-3 `persistenceEngine.ts` 拆分阈值 | `state/README.md` 的“在这个包上迭代时”登记本文件已接近拆分阈值；新增第四类持久化粒度时先拆 |

## 2 · 公开面与文件形态

- `src/index.ts` 显式导出 56 个名字，`tools/terminal-state/check-static.mjs` 的 expected list 为手写常量。
- `StateRuntimeSliceRegistration` 由未导出的 unique symbol brand + internal WeakMap backing；外部对象 literal 伪造在类型层与运行期均被拒绝。
- `src/**` 未调用 `createSlice`，未导出具体 descriptor/registration value instance。
- `README.md` 已按 TR-10 补齐定位、作用、结构、用法和“在这个包上迭代时”。

## 3 · 行为实现摘要

- descriptor：六字段 descriptor、四条双向一致性、重复 slice 名拒绝、空 registration 拒绝。
- key grammar：namespace 为 `catering-v2s.terminal.state.v1/<persistenceKey>/`；entry key 用 `encodeURIComponent` 可逆编码；字段 key 与 record prefix 冲突会报错。
- hydrate：每个物理后端最多一次 `listKeys` + `readMany`；在 store 对外可见前用 `preloadedState` 注入。
- flush：逐 key `write` / `remove`；cache 只在该 key 成功后推进；失败 key 留 dirty 并在下一次 flush 重试。
- blocked：启动读失败的后端 blocked；第一次后续 flush 做一次 re-baseline；current protected backend blocked 时不从 legacy plain fallback hydrate。
- migration：先写新 storage kind，再删旧 key；旧明文删除失败仍返回 failed，且旧值保留。
- reset：按 namespace 前缀逐键删除；持久层删除全部成功后才 dispatch 私有 root reset action。
- codec：拒绝 NaN、Infinity、undefined、bigint、function、symbol、Date、Map、循环引用、稀疏数组等非 JSON-safe 值。
- sync：authoritative full/partial diff；无 receiver ledger、sequence、latest-wins、重传或 CRDT；sync apply 的值进入正常落盘路径。
- workspace：只提供 `MAIN` / `BRANCH` 一轴。
- 内部 persistence registration：field/record 判别式联合；公开 descriptor 的可选 storage key 只在注册时归一化为必填值（field 默认 `stateKey`，record 默认 `entries`）。

## 4 · 测试覆盖

`yarn workspace @catering-v2s/kernel-base-state test`

```text
Test Files  4 passed (4)
Tests  67 passed (67)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-state
EXIT_CODE=0
elapsed=0.472s
Duration  232ms
```

覆盖分组：

- D：9 条 descriptor/registration 断言，含 duplicate、forged registration、empty registration 与物理 port alias 拒绝。
- P/R/F/H/C/M/X：45 条持久化断言，含 hydrate 多 record entry、hydrate→flush 零写、失败键重试、跨 runtime 重启、blocked rebaseline、混合 immediate/debounced flush、reset 删除失败不重置内存、reset 意外异常后队列恢复、迁移失败后独立键继续、key grammar round-trip、codec 拒绝非法值、RTK DEV/TEST/PROD 检查边界与 runtime 未声明同步边界。
- S：9 条 sync 断言，含 full serialization summary、partial diff、tombstone、replaceMissing、无 latest-wins、runtime malformed envelope 拒绝、partial apply 保留未列键与 tombstone apply。
- workspace：4 条 MAIN/BRANCH action/type/context 断言。

`yarn workspace @catering-v2s/kernel-base-state typecheck`

```text
exit=0
output=<empty>
elapsed=0.751s
```

`tsconfig.json` include `src/**/*.ts`、`test/**/*.ts`、`vitest.config.ts`，因此 `public-surface.typecheck.ts` 的 `@ts-expect-error` 夹具进入 tsc。

## 5 · 四门与 support

`node tools/terminal-state/check-static.test.mjs`

```text
STATE_MODEL_CLEANUP=PASS
TERMINAL_STATE_STATIC_MODEL_TEST=PASS
exit=0
elapsed=1.164s
```

定向 red mutation：

- ST-2：scratch 中加入 `createSlice` 调用，目标门红；另加 exported registration value，目标门红。
- ST-3：`src/types/sync.ts` 将 diff entry value 改成 `any`，TR-05 门红。
- ST-5：插入裸 `await this.#storagePorts[storageKind].write(...)`，storage result 门红。
- ST-6：插入 `StateStoragePort.clear(...)`，no-clear 门红。
- support：`src/index.ts` 增加 `unexpectedStateExport`，support 红。

`node tools/terminal-state/check-static.mjs`

```text
STATE_RULE_GATES=4
STATE_SUPPORT_CHECKS=1
STATE_RULE_TOOLKIT_ZERO_SLICE=PASS
STATE_RULE_TR05_NAMED_BOUNDARY=PASS
STATE_RULE_STORAGE_RESULT_CONSUMED=PASS
STATE_RULE_NO_STORAGE_CLEAR=PASS
STATE_SUPPORT_EXPORTS=PASS
TERMINAL_STATE_STATIC=PASS
exit=0
elapsed=0.304s
```

## 6 · TER-local 接线

`node tools/terminal-skeleton/verify.test.mjs`

```text
TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS
exit=0
elapsed=18.377s
```

`tools/terminal-skeleton/verify.mjs` 的 test owner 固定为 8 个：

- REAL_TESTS：contracts、platform-ports、state
- NO_TEST_FILES：5 个 adapter android 包

`expectedTaskOwners('test', 2)`、marker count、platform-ports REAL、state REAL、extra marker 均有模型断言。

## 7 · TER-local 验收命令

`yarn workspace @catering-v2s/terminal verify:static`

```text
TERMINAL_STATE_STATIC_MODEL_TEST=PASS
TERMINAL_STATE_STATIC=PASS
TERMINAL_STATIC=PASS
exit=0
elapsed=16.684s
```

`yarn workspace @catering-v2s/terminal verify`

```text
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=8
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
Tasks: 22 successful, 22 total
Tasks: 8 successful, 8 total
TERMINAL_TEST_MARKERS=PASS real=3 noTests=5
Expo Autolinking module resolution enabled
Android Bundled 2060ms apps/terminal/assembly/android/pos-desktop/index.ts (677 modules)
Exported: dist
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
exit=0
elapsed=28.708s
```

证明边界：Expo export 只证明 assembly 对新公开面的 Metro 消费闭包；不证明 native、Gradle、设备、adapter 或业务能力。

### 7.1 · 本回合复跑（2026-08-30，KST）

本回合再次执行了 TER-local `yarn workspace @catering-v2s/terminal verify`；命令退出码为 0。
关键原始输出为：

```text
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=8
Tasks: 22 successful, 22 total
Tasks: 8 successful, 8 total
TERMINAL_TEST_MARKERS=PASS real=3 noTests=5
Android Bundled 1544ms apps/terminal/assembly/android/pos-desktop/index.ts (677 modules)
Exported: dist
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

该复跑仍只证明 TER-local 的静态、跨包 typecheck/test 与 Metro export；没有运行仓级 normal
`scripts/verify`，也没有把结果升级为 native、Gradle、设备、adapter、DEV、seed、reset、浏览器 L2、UAT 或部署证明。

## 8 · TypeScript 反向控制

在 state 包的 scratch 副本中先运行未突变的 `tsc --project <scratch>/tsconfig.json --noEmit`，再删除
`test/public-surface.typecheck.ts:65` 的一行 `@ts-expect-error` 并重跑；确认变异红后删除 scratch：

```text
BASELINE_OUTPUT=<empty>
BASELINE_EXIT=0
MUTATED_OUTPUT=.../test/public-surface.typecheck.ts(65,9): error TS2305: Module '"../src/index"' has no exported member 'applyAuthoritativeSyncActionType'.
MUTATED_EXIT=2
SCRATCH_CLEANUP=PASS
```

这证明 test 目录确实进入 typecheck；真实树随后以 exit 0 通过。

## 9 · 项目记忆

`scripts/memory/build-index`

```text
PROJECT_MEMORY=PASS
ENTRIES=75
KERNEL=6
ROUTED=69
```

本轮曾发现 project-memory assertion drift；已修复 `project-memory/required-inventory.json` 后重建索引通过。

`scripts/context/recall-memory --task-kind implementation --domain platform --consumer-face backend --owner platform --impact architecture --trigger implementation`

```text
exit=0
route.taskKinds=implementation
route.domains=platform
route.consumerFaces=backend
route.owners=platform
route.impacts=architecture
route.triggers=implementation
```

## 10 · 未授权与未证明边界

- 未运行仓级 normal `scripts/verify`。
- 未做设备、Gradle、Android、native、adapter 能力验证。
- 未做 DEV、seed、reset、浏览器 L2、UAT 或部署。
- sync 的 topology 传输协议、业务 slice 真实体量、display/container scope 仍属于后续包。

## 11 · 收口判断

本包达到当前授权范围内的 implementation review 输入状态。下一步应由 Dexter 与 Claude 对真实源码与本证据执行 `REVIEW_TARGET=IMPLEMENTATION`。

## 12 · 独立全范围对账

Claude 已完成 `REVIEW_TARGET=IMPLEMENTATION` 独立静态 review 并给出 `GO`、`M/S/N=0/1/3`。
本节记录其后四条 finding 的闭合状态，供 Dexter 与 Claude 定向复核：

```text
POST_REVIEW_FINDINGS_CLOSED=YES
M=0
S=0
N=0
```

闭合范围包括 S-1 的内部 persistence registration 类型边界、N-1 的 contracts README 适用范围、
N-2 的 health 判据说明、N-3 的 README 拆分阈值，以及本文件上述本机新鲜命令输出。
本节不扩张 native、设备、仓级 verify、DEV、seed、reset、浏览器 L2、UAT 或部署证明。

## 13 · 修复后 fresh 独立对账

`/root/state_post_fix_reconciliation` 以 fresh 独立上下文完成只读全范围对账，未修改仓库、未运行命令、未改写本证据：

```text
WHOLE_SCOPE_RECONCILIATION=PASS
S-1=PASS
S-2=PASS
N-1=PASS
N-2=PASS
N-3=PASS
NEW_FALSE_GREEN_PATH=NOT_FOUND
```

该独立对账确认：内部 persistence registration 的必填判别式联合与引擎消费已一致，
`lastFailure` 的历史语义已在类型与 README 收口，contracts/state README 的说明已落地，
且当前证据未越界主张 native、设备或仓级 normal verify。`persistenceEngine.ts` 中保留的
`next !== undefined` 是对 `applyEntries` 返回值的防御性运行时检查，不是已移除的可选回调或键兜底路径。
