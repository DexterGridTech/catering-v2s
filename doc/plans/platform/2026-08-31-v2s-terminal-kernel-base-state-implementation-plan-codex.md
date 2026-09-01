# TER `kernel.base.state` · 实施计划

> 输入：`doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-requirements-claude.md` 与
> `doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-design-codex.md`。
> Dexter 已授权按本文顺序实施 state 包及其门与 TER-local 接线；不包含端口、其余 TER 包、设备或仓级 normal verify。

## 0 · 执行纪律与证明边界

```text
IMPLEMENTATION_AUTHORIZED=true
AUTHORIZED_BY=DEXTER_2026_08_31_STATE_IMPLEMENTATION
IA=NOT_APPLICABLE_WITH_REASON（React-free toolkit，无 UI/Journey）
STEP_RECONCILIATION=fresh independent subagent after every CP
WHOLE_SCOPE_RECONCILIATION=fresh independent subagent before CP-4 verification
TER_ONLY_VERIFY=true
WAREHOUSE_NORMAL_VERIFY=false
```

每个写点前重新打开需求最终条款、详设对应类型/测试/门、六维路由命中的 TER memory 与 owning source；focused proof
后用同一组原文回读。每个 CP 完成后必须先 fresh 独立三维对账，`OPEN` 修复并经新的 fresh reviewer 复查后才能下一 CP。
测试不能替代对账。全 CP 后、整体测试前再做一次全范围对账。

## 1 · 逐文件清单

### 1.1 新增

| 文件 | 唯一职责 |
|---|---|
| `apps/terminal/kernel/base/state/src/types/value.ts` | recursive JSON value |
| `.../src/types/persistence.ts` | persistence descriptor、timeout、health、operation result |
| `.../src/types/slice.ts` | 六字段 descriptor 与 opaque registration |
| `.../src/types/sync.ts` | authoritative summary/diff/full payload |
| `.../src/types/runtime.ts` | async factory、runtime、reset actor、sync result |
| `.../src/types/workspace.ts` | MAIN/BRANCH 单轴 |
| `.../src/foundations/defineStateRuntimeSlice.ts` | 四条双向校验、typed closure registration |
| `.../src/foundations/keyspace.ts` | grammar、parse、冲突检测 |
| `.../src/foundations/persistenceCodec.ts` | JSON validate/canonical encode/decode/hash |
| `.../src/foundations/createStateStore.ts` | preloaded store、两个私有 root action |
| `.../src/foundations/persistenceEngine.ts` | enumerate/read/cache/queue/flush/migration/reset/health |
| `.../src/foundations/createStateRuntime.ts` | async 装配与唯一 facade |
| `.../src/supports/sync.ts` | pure summary/diff/full/apply/tombstone |
| `.../src/supports/workspace.ts` | workspace key/action/descriptor expansion |
| `.../test/descriptor.test.ts` | D 组 |
| `.../test/persistence.test.ts` | P/R/F/H/C/M/X 组 |
| `.../test/sync.test.ts` | S 组与 sync→persist |
| `.../test/workspace.test.ts` | workspace 行为 |
| `.../test/public-surface.typecheck.ts` | T 组与反控 |
| `.../vitest.config.ts` | node test 匹配 |
| `.../README.md` | TR-10 中文包内说明 |
| `tools/terminal-state/check-static.mjs` | 4 rules + exact-export support |
| `tools/terminal-state/check-static.test.mjs` | 定向 red mutation 与 cleanup |
| `doc/evidence/platform/terminal-kernel-base-state/implementation-codex.md` | 实施完成后的新鲜证据 |

### 1.2 修改

| 文件 | 唯一变更 |
|---|---|
| `apps/terminal/kernel/base/state/src/index.ts` | 56 名逐项显式导出 |
| `apps/terminal/kernel/base/state/package.json` | RTK 2.12.0、Vitest 4.1.10、test marker |
| `apps/terminal/kernel/base/state/tsconfig.json` | include src/test/vitest config |
| `tools/terminal-skeleton/verify-static.mjs` | state model/real 接在 platform-ports 后 |
| `tools/terminal-skeleton/verify.mjs` | owner 8；REAL 3；state 必须 REAL |
| `tools/terminal-skeleton/verify.test.mjs` | owner/marker 正反模型 |
| `yarn.lock` | 仅由 Yarn 派生 |

### 1.3 明确不修改

`moduleName.ts`、`dependencies.ts`、`skeleton-graph.ts`、contracts/platform-ports 生产源码、其余 21 个 TER 包生产源码、
仓级 verifier。发现必须改其中任一项即停机。

## CP-1 · 类型、descriptor registration 与 workspace

### 1.1 写前双读

重开需求 §1.1/§2.1/§4 主张二/§6 第 1、8 条/§7/§8 ST-2/3/4/§9 D/T，详设 §4/§10.3，
当前 `platform-ports` storage/result/logger 类型与 contracts `TimestampMs`。确认：plannedKind toolkit、零 slice、只 workspace。

### 1.2 RED

1. 先将 tsconfig include `test/**`，创建 `public-surface.typecheck.ts`。
2. 写 T-1…T-5 与合法 descriptor compile fixture；当前缺公开类型和值，typecheck 必须以 missing export 为首败。
3. 不用 declaration stub、`any`、double cast 或临时 `export *` 让中间态变绿。

未来命令：

```sh
yarn workspace @catering-v2s/kernel-base-state typecheck
```

### 1.3 GREEN 固定顺序

1. `value.ts`：四类 JSON value。
2. `persistence.ts`：field/record（record get/apply 必填）、三类 timeout、health/result。
3. `sync.ts`：authoritative only、partial/full 由 `replaceMissing` discriminant 区分；value/tombstone 是互斥 union；
   四个 helper 精确使用 descriptor/state/remoteSummary/options 参数，full helper 不接 remote summary 且精确返回 full 分支。
4. `slice.ts` + `defineStateRuntimeSlice.ts`：六字段输入由 persistence/sync 两个 discriminated union 交叉组成；
   reducer 必填，non-empty persistence tuple、四条双向一致性在类型层成立；opaque output 带非导出 unique-symbol brand，内部 WeakMap
   持有 closure。erased persistence 仍是 field/record 判别式联合，回调与归一化 key 必填，不使用可选链或字面量兜底；brand 或 membership
   缺失一律在 I/O 前 fail closed。
5. `runtime.ts`：async factory 与 facade shape；不先写实现桩返回成功。
6. `workspace.ts/supports/workspace.ts`：MAIN/BRANCH；按 action type 最后一个 `/` 拆分并固定改为
   `${sliceType}.${workspace}/${actionName}`，保留其他 action 字段，缺 workspace/非法 type 抛详设固定错误；
   不调用 createSlice、不建其他轴。
7. `index.ts`：按详设 §10.3 56 名逐项导出。

每组完成即 typecheck；发现 `Reducer<TState>` 异构擦除必须用 `any` 或双重 cast 时按停机项上报，不自行扩大公开面。

### 1.4 typecheck 反向控制

在仓外 scratch 复制最小闭包：

1. `tsc --listFilesOnly` 必须命中 `test/public-surface.typecheck.ts`；
2. 删除 T-2 或 T-5 一行 `@ts-expect-error`，预期 non-zero 且出现具体不可赋值/无导出错误；
3. 恢复真实树 typecheck 0；scratch cleanup PASS。

### 1.5 完成信号

- 56 名 exact public surface 可从 package root 导入；
- descriptor 四组合法/非法同时被 type fixture 与 runtime 动态输入校验覆盖；
- reducer 必填；缺失既不能编译，也不能通过动态伪造进入 I/O；不造 POC placeholder；
- 外部五字段 object literal 不能伪造 registration，动态伪造值在 I/O 前 fail closed；
- sync envelope 只能 value/tombstone 二选一，两者皆无或同时存在均不成立；
- 四个 sync helper 参数顺序与 full/partial 返回分支由 T-8 固定；workspace 完整 type 改写与错误分支有 focused tests；
- source public face 无 any/Record<string, unknown>/double cast；
- workspace 只有 MAIN/BRANCH，src 零 createSlice；
- 没有新出边、没有 source implementation 越到 CP-2。

完成后 fresh reviewer 做 CP-1 三维对账；未闭合不得 CP-2。

## CP-2 · async bootstrap、持久化与同步 runtime

### 2.1 写前双读

重开需求 §1.2、§5、§6 全部、§7、§11，TR-01/02/03/04/09 state 例外六条，详设 §5/§6/§11；
读回 POC `store.ts/createStateRuntime.ts/supports/sync.ts` 只作反例，不复制 manifest/latest-wins/void flush。

### 2.2 RED：先写行为测试

按顺序写 D → P/R → F/H → C/M/X → S。首批预期失败是 `createStateRuntime`/codec/keyspace 不存在，
不能是依赖未安装或 test 未发现。test script 固定：

```json
"test": "vitest run --config vitest.config.ts && node -e \"console.log('TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-state')\""
```

### 2.3 GREEN-1 · validate/keyspace/codec

1. validate timeout 正有限数、persistenceKey/name/descriptor identifier 非空；duplicate slice、伪造 registration 与 canonical key/prefix 报错。
2. key grammar 只用固定 namespace、`/`、encodeURIComponent；parse exact segment count。
3. codec 递归拒绝详设 X-5 全集，canonical object key sort；sync valueHash 固定为 `json:<canonical-json>`，
   tombstone 固定为 `tombstone`，不引入碰撞型短 hash 或新依赖。
4. 先过 D、T-6/T-7、X-2/3/5、S-1，不写 storage I/O；X-6/7 在 store 配置完成后补绿。

### 2.4 GREEN-2 · hydrate/preloaded store

1. 先拒绝 `plainStorage === protectedStorage` 的物理 port identity alias（任何 I/O 前）；其余输入按 port identity 一次 `listKeys` + 一次 `readMany`；current protection 优先、old-only 登记 migration。
2. 成功 decode 合成 owner initial state 上的 field/record preloadedState。
3. list/read 整体失败标 backend baseline unknown；plain/protected 独立，不可用 protected 不 fallback plain。
4. store 仅在 hydrate 完成后构造/返回；DEV/TEST checks 开、PROD 关。
5. 初始化 confirmed cache、health、slice reference；逐方法断言 read/write/reset 三类 timeout；
   过 P-1/2/5/7、R-1/2、H 全组与 X-6/7；同一物理 port alias 的 D-9 反例必须在 I/O 前失败。

### 2.5 GREEN-3 · flush/migration/health

1. 一个串行 queue；subscribe 只在 persistable slice 引用变化时调度；immediate 选择只 flush immediate descriptors，debounced 选择由 timer flush 全部 descriptors；两支都接 Promise handler，源码无 `void flush`。新任务入队前 catch 前一任务 rejection，确保意外异常不永久阻塞后续 flush/reset。
2. 导出 canonical entries；只处理 changed/dirty keys；blocked backend 先执行一次有界 re-baseline，失败仍不写，成功才继续。
3. writes/removes stable sort，全部逐键；失败继续后续键；成功单键前移 cache，失败保持 dirty。
4. migration 固定 write new → remove old；任一失败 operation failed。
5. health 冻结 snapshot、revision、lastFailure/dirty/block，订阅/unsubscribe；F-1 先订阅再触发失败，listener 必须收到
   至少一次 revision 递增快照；日志无 raw value。
6. 过 P-3/4/6、F、H-4/H-5、M、X-1 与 C-2b；明确生产源码零 writeMany/removeMany/clear，blocked recovery 每后端/runtime 仅一次；混合 immediate/debounced 只在对应 timer 到点后写入 debounced descriptor；migration 首键失败仍继续后续键；前一任务意外 rejection 后下一次 flush/reset 仍执行。

### 2.6 GREEN-4 · reset actor 与 sync

1. 私有 root reducer 只有 APPLY_AUTHORITATIVE_SYNC/RESET_TO_OWNER_INITIAL_STATE 两支。
2. reset actor 先 exact prefix 逐键 remove；任一失败不 dispatch；全成功才 reset owner reducers。
3. pure sync summary/diff/full/apply/tombstone 按详设 §4.3 精确签名；partial 固定 `replaceMissing:false`，
   full 固定 `replaceMissing:true`；无 latest-wins/ledger/session。
4. runtime 只对 registered+sync slice 读写；unknown/undeclared skipped + warn。
5. sync apply 改引用后经 subscribe 落盘；过 C、S、R-3。

### 2.7 focused proof 与完成信号

```sh
yarn workspace @catering-v2s/kernel-base-state typecheck
yarn workspace @catering-v2s/kernel-base-state test
```

必须读取原始输出。完成信号：D/P/R/F/H/C/M/X/S 全绿；type fixture 真进 tsc；自动失败无成功；hydrate baseline
失败不发生破坏写；三条路径最终形态唯一；零 adapter/native/其他包源码改动。

完成后 fresh reviewer 做 CP-2 三维对账；未闭合不得 CP-3。

## CP-3 · 四道门与 TER-local 验证接线

### 3.1 checker 实现

`tools/terminal-state/check-static.mjs` 复用 `tools/terminal-contracts/check-static.mjs` 已导出的 TR-05 analyzer，
不得修改 contracts analyzer 或其输出。state 自有三道 AST 门 + exact exports support。

### 3.2 每道门的具体 red

| 顺序 | mutation | 期望目标错误 | 其他门/support |
|---|---|---|---|
| ST-2a | fixture `src/foundations/createStateStore.ts` 加 `createSlice(...)` | `toolkit source calls createSlice` | 必须绿 |
| ST-2b | fixture `src/types/slice.ts` 加 exported registration const | `toolkit exports descriptor instance` | 必须绿 |
| ST-3 | `src/types/sync.ts` diff value 改 explicit any | `TR-05 any` | 必须绿 |
| ST-5 | `persistenceEngine.ts` 一处改裸 `await storage.write(...)` | `storage result discarded` | 必须绿 |
| ST-6 | reset 改 `await storage.clear(...)` | `StateStoragePort.clear forbidden` | 必须绿 |
| support | `src/index.ts` 加 `unexpectedStateExport` | `public export exact-set mismatch` | 四门必须绿 |

每次从干净 scratch 副本开始；finally 删除 temp，打印 cleanup PASS。真实树输出固定：

```text
STATE_RULE_GATES=4
STATE_SUPPORT_CHECKS=1
TERMINAL_STATE_STATIC=PASS
```

### 3.3 TER-local 接线

1. `verify-static.mjs` 在 platform-ports model/real 后串 state model/real；失败时无 `TERMINAL_STATIC=PASS`。
2. `terminalTestOwners` 加 state，exact total 8。
3. `assertPackageTestMarkers` 固定 contracts、platform-ports、state 都 REAL；`real.length===3`、`noTests.length===5`。
4. `verify.test.mjs` 新增：缺 state owner、state 标 NO_TEST_FILES、extra owner、REAL 仍等 2 四个红向量。
5. Turbo dry test executable owner exact-set 为 8；禁止从目录动态派生放宽。

### 3.4 focused commands

```sh
node tools/terminal-state/check-static.test.mjs
node tools/terminal-state/check-static.mjs
node tools/terminal-skeleton/verify.test.mjs
yarn workspace @catering-v2s/terminal verify:static
```

不运行仓级 normal。完成信号：每门定向 red + real green；support red + real green；TER static marker 只在全链绿出现；
owner 8 = REAL 3 + NO_TEST_FILES 5。

完成后 fresh reviewer 做 CP-3 三维对账；未闭合不得 CP-4。

## CP-4 · README、全范围对账、TER-local 验收与实施证据

### 4.1 README 固定内容

参考 contracts README 的形，不逐字复制。必须有：

- 定位：toolkit、依赖 contracts/platform-ports/RTK、被后续 runtime/topology/owners 消费；
- 作用判别式：按 registration 执行，不决定 owner 应声明什么；
- 注释目录树；
- 真实 package-root 用法，展示 define → await create runtime → health/flush/full sync；
- 三条路径：hydrate preloaded、reset lifecycle actor、sync 唯一 external write；
- record entry 独立提交，不承诺整 record 原子；
- 无后续 state change/explicit flush 时不自动恢复；
- 在这个包上迭代时：56 exports、4+1 checker、十组测试、TER-local 命令、禁回潮清单。

README 示例必须逐字对得上真实公开面，否则不收口。

### 4.2 全范围三维对账

fresh reviewer 不汇总 CP 结论，重新从需求、详设/计划、memory、真实树核：

1. descriptor 六字段/四条双向/duplicate；
2. key grammar、list once/readMany、逐键写删、migration 顺序；
3. preloaded hydrate、baseline write fence、reset actor、health；
4. authoritative full only、sync→persist、workspace only；
5. D/P/R/F/H/C/M/X/S/T 与反控；4 rules + support；
6. 56 exports、8 owners/3 REAL/5 no-test；
7. P-a…P-f/S-a…S-e 与 §11 结案无互斥残留；
8. README 与源码一致。

任何 `OPEN` 先修复并由另一 fresh reviewer 复核，才运行整体命令。

### 4.3 未来 TER-local 整体命令

```sh
yarn workspace @catering-v2s/kernel-base-state typecheck
yarn workspace @catering-v2s/kernel-base-state test
node tools/terminal-state/check-static.test.mjs
node tools/terminal-state/check-static.mjs
node tools/terminal-skeleton/verify.test.mjs
yarn workspace @catering-v2s/terminal verify:static
yarn workspace @catering-v2s/terminal verify
```

只运行 TER-local；不跑仓级 normal。读取每条 stdout/stderr、exit、marker、elapsed 与 scratch/export cleanup。
Expo export 只证明 assembly 对新公开面的 Metro 消费闭包，不证明 native、Gradle、设备、adapter 或业务能力。

### 4.4 实施证据十项

未来 evidence 必须记录：

1. 56 exports 与 exact methods/functions 复算；
2. descriptor 四条双向、duplicate/keyspace；
3. listKeys/readMany 调用次数与 key grammar round-trip；
4. field/record 差量、hydrate→flush 0、失败键重试；
5. R 组两个 runtime 同一 storage 正反；
6. port 五态逐调用点处理、baseline fence 与一次性 re-baseline；
7. migration/reset 的顺序和失败边界；
8. authoritative full/tombstone/replaceMissing/no-ledger；
9. 四门/support red+green、type fixture 反控、8 owner marker；
10. P-a…P-f/S-a…S-e、§11 结案与 README 对齐。

每条附命令、exit、marker、elapsed、首败与 cleanup；不能只抄测试名。

## 5 · 不得自行决定 / 停机清单

本节唯一来源是详设 §13；实施者必须逐条遵守。计划只补一条执行特有条件：若 Turbo test owner 不是精确 8，
停止并核 current tree，不得改成动态目录计数。

## 6 · 完成条件与授权边界

本包实施完成必须同时满足：

- CP-1…4 每步完成信号与 fresh 对账闭合；
- D/P/R/F/H/C/M/X/S/T 新鲜全绿，type reverse control 真红；
- state 4 rules + 1 support 每项 red+real green；
- TER-local verify:static/verify 新鲜 PASS，8 owners = 3 REAL + 5 NO_TEST_FILES；
- README/56 exports/implementation evidence 与真实源码一致；
- 全范围对账无 OPEN，随后完成 fresh `REVIEW_TARGET=IMPLEMENTATION` 与 Claude review。

当前文档交付不证明以上任一实现结论。本设计不授权 adapter/native、其他包生产源码、仓级 normal、设备/Gradle、
DEV、seed、reset、浏览器 L2、UAT、部署。
