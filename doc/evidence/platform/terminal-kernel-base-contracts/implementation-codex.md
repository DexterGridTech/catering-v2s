# TER `kernel.base.contracts` · 实施证据

```text
EVIDENCE_OWNER=CODEX
IMPLEMENTATION_SCOPE=TER_KERNEL_BASE_CONTRACTS
IA=NOT_APPLICABLE
IA_REASON=本包只有零依赖共享类型与纯函数，没有用户可见界面或 Journey 操作
TER_ONLY_VERIFY=true
CURRENT_CHECKPOINT=FINAL_IMPLEMENTATION_REVIEW_R1_GO
```

本文件按 CP 追加。原始命令输出保存在 `.runtime/terminal-contracts/`；本文只记录可复核摘要，不能替代原始日志。
仓级 normal `scripts/verify`、设备、DEV、reset、seed、浏览器 L2、UAT、部署与 EAS 均未运行。

## CP-1 · 共享语言、公开面与本包测试

### 1. 前读与后读留痕

写入前先重开：

- 需求：`doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md`
  的 §2、§4.1、§4.2、§5、§6.1～§6.4、§7、§8.2～§8.4、§9；
- 详设：`doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md`
  的 §3、§4、§5、§6、§8、§10、§11、§12；
- 计划：`doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-plan-codex.md`
  的 §0 与 CP-1；
- 规范：`doc/platform/terminal-coding-standard.md` 的 TR-05、TR-06、TR-09；
- 路由记忆：`project-memory/decisions/terminal-architecture-and-stack-rulings.md`、
  `project-memory/operations/terminal-coding-standard.md`、
  `project-memory/decisions/deterministic-context-only.md`；
- owning source：contracts 现有骨架三符号、`apps/terminal/tsconfig.base.json`，以及只读 POC contracts 的
  `types/{ids,error,parameter,module,request,command,transport}.ts` 与
  `foundations/{runtimeId,time,error,definition}.ts`。POC 只提供事实输入，未复制文件或回写 Heritage。

逐写点的前后双读如下。`后读` 均重新对照同一行列出的需求/详设与当前源码，不以测试绿替代边界判断。

| 写点 | 前读决策 | 当前 owning source | 后读结论 |
|---|---|---|---|
| test/config | 需求 §8.2～§8.4；详设 CP-1；唯一 tsconfig 必须包含 test | `package.json`、`tsconfig.json`、`vitest.config.ts`、`test/**` | F-1～F-4 在 `--listFilesOnly` 中；Vitest 只匹配 `*.test.ts`；production dependency/peer 未增加 |
| ID/时间 | 需求 §4.1/§6.1；TR-06；详设 §4.2 | `types/ids.ts`、`foundations/{time,runtimeId}.ts` | kind 到 brand 由私有映射决定；九前缀闭合；不含 `INTERNAL_REQUEST_ID` 与 `formatTimestampMs` |
| 错误协议 | 需求 §6.2/§6.4；TR-05/TR-06；详设 §4.3 | `types/error.ts`、`foundations/errorTemplate.ts` | 缺参保留原 `${key}` 并传播 `missingKeys`；`createAppError` 精确取时；三个 args 点泛型化 |
| 参数/定义工厂 | 需求 §4.1/§6.4；详设 §4.4/§4.5 | `types/parameter.ts`、`foundations/definition.ts` | validate 从 unknown 收窄；工厂 key 派生；`listDefinitions<T extends object>` 保留 value union |
| 模块描述符 | 需求 §6.3/§6.4；TR-09；详设 §4.6 | `types/module.ts` | `kind` 必填；`packageVersion`/`protocolVersion` 可选；parameterDefinitions 使用无 any 的具名擦除视图 |
| request/route | 需求 §4.2/§6.4；详设 §4.7 | `types/request.ts`、`types/command.ts` | 三个 result 点泛型化；route 只留 workspace/instanceMode，并明确 local-only |
| transport | 需求 §4.1/§6.4；详设 §4.8 | `types/transport.ts` | 六处无 reader 的 metadata 均未进入；只保留有界 string/override 映射 |
| 公开入口 | 需求 C-8/判据 3；详设 §4 的 74 名 | `src/index.ts` | 保留三个骨架符号；74 个 module symbol exact-set；无 `export *`、wire、protocol 二次出口或额外 helper |

### 2. RED、GREEN 与原始日志

原始日志目录：`.runtime/terminal-contracts/cp1-20260830T015837Z/`。

第一次有意义的 RED 在会话命令输出中取得：
`yarn workspace @catering-v2s/kernel-base-contracts typecheck` exit 2，首因是包根尚未导出批准 API；
该次 stdout/stderr 当时未同步写入 `.runtime`。这是 CP-1 reviewer 确认的证据保存缺口，不能伪称原始日志已存在。
为证明当前夹具仍能抓住同一缺失实现，随后在仓外 scratch 删除实现文件并把入口还原为三个骨架 export，执行等价控制：

- `red-replay.log`：scratch tsc exit 2，signal=`has no exported member`，`RED_REPLAY=PASS`；
- `red-replay-vitest.log`：scratch Vitest exit 1，signal=缺少 `createAppError` 等公开 API，
  `VITEST_RED_REPLAY=PASS`；
- 两个 scratch 均单独记录 cleanup PASS。

GREEN 与形态证据：

| 日志 | 命令/观察 | exit / 结果 |
|---|---|---|
| `yarn-install.log` | 仓根 `yarn install`，物化 Vitest 与 lock/install state | 0；adapter 旧 SDK peer warning 保留给 CP-3，不把 warning 写成 contracts PASS |
| `typecheck.log` | `yarn workspace @catering-v2s/kernel-base-contracts typecheck` | 0 |
| `test.log` | `yarn workspace @catering-v2s/kernel-base-contracts test` | 0；1 file、18 tests passed |
| `list-files.log` | package `tsc --noEmit --listFilesOnly` | 0；包含 `test/public-surface.typecheck.ts` |
| `exact-exports.log` | TypeScript module symbol 与消费者夹具 exact-set 对拍 | 74/74；missing=0；extra=0；duplicate=0 |
| `tr05-scan.log` | `src/**` 的 `Record<string, unknown>` / `any` / double-cast focused scan | PASS |
| `root-shape.log` | dependencies/peer 与 exports 根形态 | PASS |
| `type-negative-control.log` | scratch 删除 F-2 的 `@ts-expect-error` | 内部 tsc exit 2；RequestId 不能赋给 CommandId；cleanup PASS |

### 3. TR-05 十四行处置

| 原 POC 位置 | 处置 | TER 落点与理由 |
|---|---|---|
| `AppError.args` | A | `AppError<TArguments>`；placeholder key 由 writer 决定，值域由 primitive union 收窄 |
| `CreateAppErrorInput.args` | A | 与 `AppError` 贯穿同一 `TArguments` |
| `renderErrorTemplate(args)` | A | 函数泛型保留每个调用点的确切 args 形状 |
| `CommandResultPatch.result` | A | `TResult extends object` |
| `CommandResultSnapshot.result` | A | `TResult extends object` |
| `RequestCommandSnapshot.result` | A | `TResult extends object`，由 request snapshot 向内贯穿 |
| `listDefinitions` 约束 | A | `TDefinition extends object`，返回仍为 value union |
| `CommandRouteContext.metadata` | B | 删除；无实际 reader，不能回答开放槽的读者 |
| `TransportRequestContext.metadata` | B | 删除；只有透传/日志，无键级 reader |
| `TransportServerAddress.metadata` | B | 删除；无键级 reader |
| `TransportServerDefinition.metadata` | B | 删除；无键级 reader |
| `TransportServerAddressOverride.metadata` | B | 删除；无键级 reader |
| `TransportServerOverride.metadata` | B | 删除；无键级 reader |
| `AppModule.parameterDefinitions<any>` | B | 收窄为 `readonly ParameterDescriptor[]`；validate 从 unknown 做 type guard |

结论：`A=7 / B=7 / C=0`。F-4 对七个 A 点提供负编译夹具；C-4b 机器门留在 CP-2 实现。

### 4. POC 显式差异与状态边界

- `AppModule.packageVersion` 从必填改为可选，并新增正本要求的 `kind`；本批不建 package/protocol 版本常量。
- 模板缺参不再静默变空串；原 placeholder 与缺失 key 都可观测，并进入 `AppError.templateMissingKeys`。
- POC 的 13 个 `Record<string, unknown>` 与 1 个 `any` 按上表改为 A/B；不保留无 reader metadata。
- `createRuntimeId` 不允许 caller 自选不匹配的 brand；`INTERNAL_REQUEST_ID` 不进入共享根。
- `formatTimestampMs` 与通用 validators 不进 contracts；展示格式属于 UI owner。
- `CommandRouteContext` 只保留本机字段；所有 wire envelope、topology、compatibility、state-sync、projection 与
  `protocol/` 二次出口继续推迟。

下列档位未升格：参数协议、定义工厂、模块描述符、request 生命周期仍为 `UNVERIFIED_TER_NEED`；
其中组五与组六在 runtime 落地前不视为冻结契约。metadata 的未来 writer/reader、future resolver 的 invalid-remote
行为、`create-expo-module` 的 EALLOWSCRIPTS 完整安装闭包均未由 CP-1 关闭。

### 5. CP-1 business 与 cleanup

```text
CP1_TYPECHECK=PASS
CP1_RUNTIME_TESTS=PASS tests=18 files=1
CP1_PUBLIC_EXPORTS=PASS count=74
CP1_TR05=PASS A=7 B=7 C=0
CP1_TYPE_NEGATIVE_CONTROL=PASS inner_exit=2
CP1_BUSINESS=PASS
RED_REPLAY_CLEANUP=PASS
VITEST_RED_REPLAY_CLEANUP=PASS
TYPE_NEGATIVE_CONTROL_CLEANUP=PASS
CP1_CLEANUP=PASS
```

## 历史 CP-1 收口时点（已被后续章节取代）

以下两行只记录 CP-1 完成当时的状态；随后 CP-2、CP-3、CP-4 均已执行并在本文件后续章节留有证据，
不得把该历史快照误读为当前状态：

`CP1_HISTORICAL_NEXT_CP2_CP3_CP4=NOT_YET_EXECUTED_AT_THAT_CHECKPOINT`
`CP1_HISTORICAL_STATUS=SUPERSEDED_BY_CP4_AND_FINAL_REVIEW`

## CP-2 · 四道静态门、support 与 TER-local 接线

### 1. 前读与首败

写入前重开需求 C-2/C-4b/C-5/C-6、C-8 与判据 5/6，详设 §4.12/§5/CP-2，计划 §0/CP-2，
`doc/platform/terminal-coding-standard.md` 的 TR-05/TR-06/TR-09，及现有
`tools/terminal-skeleton/{check-static,verify-static,verify,verify.test}.mjs`。

第一次 CP-2 集成运行的首败已保留在
`.runtime/terminal-contracts/cp2-20260830T020914Z/terminal-verify-static.log`：
既有 skeleton model-test 检出 Yarn install 生成的五个 adapter package-local `node_modules`，
因此在 contracts checker 执行前退出。该目录是安装生成物，不是源码交付物；按规范删除五个明确路径后
`ADAPTER_NODE_MODULE_CLEANUP=PASS`，未删除未知路径，也未改变 hygiene 规则。之后同一入口重新跑通。

另有一次采集 dry-run 的 shell quoting 失败（未进入 Turbo，未形成验证结论），保留在会话记录；复跑使用
verifier 相同的引号边界并成功。

### 2. 实现形态与门闭包

新增 `tools/terminal-contracts/check-static.mjs`，以 TypeScript AST/TypeChecker 读取 `src/**`：

- `zero-adapter-capability`：拒绝适配器/平台 import、动态导入、fetch/XHR/storage/process/fs/native 标识符；
  `Date.now`、`Math.random`、`crypto` 不在拒绝集；
- `tr05-named-boundary`：导出的 interface/type/function 签名与泛型约束检查
  `Record<string, unknown>`/`any`，全 `src/**` 检查 `as unknown as`/`as any as` 双重 assertion；
- `runtime-id-prefix-exact-set`：`RuntimeIdKind` 与 `runtimeIdPrefixes` key/value 双向 exact-set，且 value 唯一；
- `closed-literal-unions`：TypeChecker 对七处闭集展开并逐值比对；
- support：index module symbol 与详设 74 名 exact-set 对拍，拒绝 `export *`。

`tools/terminal-contracts/check-static.test.mjs` 建临时副本，每次只改一个目标，验证八个正负控制：
fetch、Record、generic extends、double assertion、缺 prefix、ErrorCategory=string、删 export、加 export。
每次目标门/support 以外保持 PASS，最后 fixture cleanup PASS。

### 3. 新鲜命令证据

原始日志目录：`.runtime/terminal-contracts/cp2-20260830T021019Z/`。

| 日志 | 命令/结果 |
|---|---|
| `contracts-model.log` | `node tools/terminal-contracts/check-static.test.mjs`，exit 0；model cleanup 与 marker PASS |
| `contracts-real.log` | `node tools/terminal-contracts/check-static.mjs`，exit 0；4 gates + support PASS，`TERMINAL_CONTRACTS_STATIC=PASS` |
| `terminal-verify-static.log` | `yarn workspace @catering-v2s/terminal verify:static`，exit 0；skeleton `RULE_GATES=6`/hygiene PASS，contracts 4/1 PASS，`TERMINAL_STATIC=PASS` |
| `verify-model.log` | `node tools/terminal-skeleton/verify.test.mjs`，exit 0；`TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS` |
| `turbo-test-dry.log` + `turbo-test-dry-assert.log` | quoted `yarn turbo run test '--filter=./apps/terminal/**' '--filter=!@catering-v2s/terminal' --dry=json`，exit 0；22 packages/22 tasks，6 executable owners，exact-set PASS |

### 4. test marker 接线

`tools/terminal-skeleton/verify.mjs` 现在把 test owner 固定为
`@catering-v2s/kernel-base-contracts` + 五个 adapter；`run()` 返回 stdout/stderr，typecheck 后实际执行
filtered `turbo run test`，并由 `assertPackageTestMarkers` 要求恰好 6 个 marker、恰好 1 个
`REAL_TESTS`（contracts）、5 个 `NO_TEST_FILES`（adapter）。marker 缺失、重复、多余、类型错或 owner 错均
以 `TERMINAL_VERIFY_FIRST_FAILURE:test-markers` 失败；未打印 `TERMINAL_VERIFY=PASS`。
contracts package `test` 在 Vitest 成功后打印
`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-contracts`。
该实际 test 执行仍留给 CP-3 的五个 adapter runner 收口后验证；CP-2 没有把完整 `verify` 误报为已闭合。

### 5. CP-2 business 与 cleanup

```text
CONTRACT_RULE_GATES=4
CONTRACT_SUPPORT_CHECKS=1
CONTRACT_RULE_ZERO_ADAPTER_CAPABILITY=PASS
CONTRACT_RULE_TR05_NAMED_BOUNDARY=PASS
CONTRACT_RULE_RUNTIME_ID_PREFIX_EXACT_SET=PASS
CONTRACT_RULE_CLOSED_LITERAL_UNIONS=PASS
CONTRACT_SUPPORT=PASS
TERMINAL_CONTRACTS_STATIC=PASS
TERMINAL_STATIC=PASS
TURBO_TEST_DRY_OWNER_EXACT=PASS executable=6
CP2_BUSINESS=PASS
CP2_CLEANUP=PASS
```

CP-3 的 ESM zero-test runner、五个 adapter SDK 57 devDeps、统一 Yarn lock 生成与真正一键 test 尚未执行。

### 6. CP-2 C-4b directed recheck and repair

CP-2 的 fresh 独立三维复核发现一个已复现的假绿：原先 C-4b 只按 AST 扫描带 `export` modifier 的
顶层声明，内部 unsafe interface/type 经 `export type Public = Internal` 或 source/index 的 alias/re-export
暴露时，门可能只看到 alias 语法而不展开其成员。该 finding 为 `CONFIRMED`，因此在进入 CP-3 前停机修复。

修复后的 `tools/terminal-contracts/check-static.mjs` 增加 TypeChecker public-boundary traversal：

- 从每个 `src/**` 模块的 exported symbol 出发，并解析 alias 链；因此 source export、index re-export 与别名链都会进入同一检查面；
- 对解析后的 type alias/interface/value 递归检查成员类型、函数参数/返回值、call/construct signature、泛型约束与 alias type arguments；
- 只递归 contracts root 内的成员/签名声明，避免把标准库 `Array` 等实现细节的 `any` 误报为 contracts 公开边界；
- 保留原有全 `src/**` 的双重 assertion 扫描与直接 AST boundary 检查；`Record<string, unknown>`、`any` 仍分别被识别。

模型夹具新增三类只目标失败的控制：

1. 内部 unsafe interface 经 exported `ErrorDefinition` alias 暴露；
2. 内部 alias 经 `export type {Alias as ErrorDefinition}` 再由 package index 转出；
3. exported const 指向内部带 unsafe `Record<string, unknown>` 参数的函数。

最新日志目录：`.runtime/terminal-contracts/cp2-20260830T0224Z-alias-recheck/`。

| 日志 | 命令/结果 |
|---|---|
| `contracts-model.log` | `node tools/terminal-contracts/check-static.test.mjs`，exit 0；直接 boundary、alias、re-export、exported-const 三类负夹具与 cleanup PASS |
| `contracts-real.log` | `node tools/terminal-contracts/check-static.mjs`，exit 0；四道 contracts rule gate 与 support PASS |
| `terminal-verify-static.log` | `yarn workspace @catering-v2s/terminal verify:static`，exit 0；skeleton 六门、hygiene、contracts 四门/support 全 PASS |

CP-2 directed recheck 之后，alias/re-export 假绿已由 TypeChecker 展开与正负控制覆盖；CP-3 仍未开始，
完整 TER `verify` 仍未执行。

## CP-3 · 五个 adapter 的 ESM zero-test runner 与 SDK 57 devDeps

### 1. 前读与首败

写入前重开需求 §8.1、§8.4 判据 5/5b、§11，详设 CP-3 与计划 CP-3，及五个 adapter 当前
`package.json`、`internal/module_scripts/test.js`、`internal/module_scripts/util.js`。五包均为
`type: module`，但脚手架脚本使用 CommonJS `require`。在 `persist-kv` cwd 实跑：

```text
CI=1 node internal/module_scripts/test.js
ReferenceError: require is not defined in ES module scope
COMMAND_EXIT=1
```

完整 stdout/stderr 保存在 `.runtime/terminal-contracts/cp3-20260830T0237Z/runner-red-persist-kv.log`。
一次错误的相对日志路径在真正 runner 启动前即被 shell 拒绝，未形成运行结论；随后用正确的
仓根相对路径重跑并保存了上述首败。

### 2. Runner 实施与模型/真实结果

五个 adapter 的 `internal/module_scripts/test.js` 与 `util.js` 已按同一形态转为 ESM，未增加根级共享
runner，未改 native、exports、dependencies 或 peerDependencies。runner：

- 读取当前 package manifest 的 Jest `roots`（当前五包均为 `<rootDir>/src`），按 Jest 默认
  `__tests__`、`*.test.*`、`*.spec.*` 文件规则发现测试；显式 `testRegex` 仍可由 manifest 约束；
- 无匹配文件时不启动 Jest，打印 `TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=<name>` 并 exit 0；
- 有测试文件时才 spawn `jest`，传播非零退出/信号；只有 Jest exit 0 才打印 `REAL_TESTS` marker；
- 不使用 `--passWithNoTests`，因此配置/发现异常不会被静默吞掉；保留原有 subtarget 参数形态与非 CI TTY watch 行为。

先写的模型夹具 `tools/terminal-contracts/adapter-test-runner.test.mjs` 首次运行因当前 CommonJS runner
获得 RED（`.runtime/.../adapter-runner-model-red.log`）；runner 改为 ESM 后同一夹具 GREEN：

```text
ADAPTER_TEST_RUNNER_MODEL_CLEANUP=PASS
TERMINAL_ADAPTER_TEST_RUNNER_MODEL_TEST=PASS
COMMAND_EXIT=0
```

五包直接执行均 exit 0，且每包各自只打印一条 `NO_TEST_FILES`：

```text
@catering-v2s/adapter-android-persist-kv
@catering-v2s/adapter-android-device
@catering-v2s/adapter-android-app-control
@catering-v2s/adapter-android-logger
@catering-v2s/adapter-android-dual-screen
```

对应原始日志为 `.runtime/terminal-contracts/cp3-20260830T0237Z/runner-{persist-kv,device,app-control,logger,dual-screen}.log`。

### 3. Latest template 与三类版本证据

以同批 latest template 为 key 的 scratch tarball 复核结果：

```text
template=expo-template-blank-typescript@57.0.20
dependencies.expo=~57.0.18
dependencies.react-native=0.86.3
devDependencies.@types/react=~19.2.2
devDependencies.typescript=~6.0.3
```

scratch 只下载并解包 `package/package.json`，随后用 Node `fs.rmSync` 删除明确的临时目录；不把
scratch 产物放入仓库。第三类 `jest-expo` / `babel-preset-expo` 由每个 adapter cwd 执行的精确命令
解析，不手写第三类值：

```text
npx expo install --yarn --dev jest-expo babel-preset-expo -- --mode=update-lockfile
```

执行顺序严格为 `persist-kv → device → app-control → logger → dual-screen`，五次均 exit 0；每次
Expo 输出相同的解析请求：`jest-expo@~57.0.5`、`babel-preset-expo@~57.0.0`。后者是 CLI 返回的
SDK-aware range，而安装后物化包的精确版本为 `babel-preset-expo@57.0.9`；不把需求表的预期
`~57.0.9` 反写成命令证据。

五包当前 devDeps 目标完全一致：

```text
expo=~57.0.18
react-native=0.86.3
@types/react=~19.2.2
jest-expo=~57.0.5
babel-preset-expo=~57.0.0
jest=^29.7.0 (unchanged)
typescript=~6.0.3 (unchanged)
```

四个非首包的完整 before manifest 与 after 对账保存在 `*-before-install.json` 及
`manifest-diff.log`；四包均显示顶层只有 `devDependencies` 改变，`dependencies` 与 `peerDependencies`
保持 PASS。首包保存的是 devDependencies/dependencies/peerDependencies 选定基线，语义对账同样 PASS；
未将未保存的字节级历史快照冒称为完整非 dev 字段证据。

Expo/Yarn 输出含已有 peer warning：adapter 未提供 `@react-native/jest-preset`、`react-refresh` 与
宿主 `react`。这不改变本批要求的五个 devDeps 目标，也不影响零测试 runner（本批没有 adapter Jest
测试），但将来 adapter 加真实测试/能力时仍需重新验证 peer 闭包，当前保持
`UNVERIFIED_REQUIRES_EVIDENCE`。未添加计划之外的 peer/dev 依赖。

五个显式 Expo install 后，从仓根统一执行一次 `yarn install`，exit 0；完整输出在
`.runtime/terminal-contracts/cp3-20260830T0237Z/yarn-install-final.log`。安装物化在共享
`apps/terminal/node_modules`，未发现五个 adapter 下的 package-local `node_modules`。

### 4. CP-3 状态与边界

```text
CP3_RUNNER_MODEL=PASS
CP3_ADAPTER_RUNNERS=PASS packages=5 no_test_markers=5
CP3_TEMPLATE_RAW=PASS version=57.0.20
CP3_EXPO_INSTALL=PASS packages=5 exit=0
CP3_YARN_INSTALL=PASS exit=0
CP3_REAL_TEST_PACKAGES=1
CP3_NO_TEST_PACKAGES=5
CP3_CREATE_EXPO_MODULE_INSTALL_CLOSURE=UNVERIFIED_REQUIRES_EVIDENCE
CP3_ADAPTER_TEST_PEER_CLOSURE=UNVERIFIED_REQUIRES_EVIDENCE
CP3_BUSINESS=PASS
CP3_CLEANUP=PASS
```

## 当前收口状态

最终独立 `REVIEW_TARGET=IMPLEMENTATION` 第 1 轮为 `GO`（`M=0/S=0/N=1`）；第 2 轮按 review cycle
硬停止规则定向复核，仍为 `GO`（`M=0/S=0/N=1`），唯一 N 是本文件早期 checkpoint 与追加顺序的
陈旧状态描述。历史段落已明确标为 superseded，且 header 与正文 current checkpoint 已统一；当前状态为：

```text
CURRENT_CHECKPOINT=FINAL_IMPLEMENTATION_REVIEW_R1_GO
IMPLEMENTATION_READY=YES
OPEN_FINDINGS=0
FINAL_REVIEW_N1_STALE_CHECKPOINT=RESOLVED_BY_THIS_SECTION
CP4_BUSINESS=PASS
CP4_CLEANUP=PASS
```

未授权/未验证边界仍为：`create-expo-module` 完整闭包、adapter 未来真实 Jest peer closure、首次
`persist-kv` 历史完整 before 快照、Android 设备/Gradle/Kotlin、仓级 normal verify、DEV/reset/seed、
浏览器 L2、UAT、部署与 EAS。TER-local 静态、typecheck、test 与 Metro export 的当前证据见 CP-4 章节，
不再用历史「尚未执行」句子覆盖它们。

### 6. CP-4 前全范围对账发现的 runner testMatch 假绿路径

CP-4 全范围独立对账构造了一个真实反例：当 adapter manifest 设置 `jest.testMatch` 而文件名不符合
runner 的默认正则时，旧实现会误报 `NO_TEST_FILES` 并 exit 0。该反例不影响当前五包（当前 manifest
均未声明 `testMatch`），但属于 runner 的可达假绿路径，不能留在实现中。

最小修复是 fail closed，而不是在本批引入一个不完整的 glob 实现：五个同形 runner 在发现 manifest
含 `jest.testMatch` 时输出
`TERMINAL_PACKAGE_TEST_CONFIGURATION_FAILURE package=<name> code=UNSUPPORTED_TEST_MATCH` 并 exit 1，
不启动 Jest、不打印任何 PASS marker；实现计划与详设已同步写明该边界。模型夹具新增
`runner.check.ts` + `testMatch` 反例并断言上述失败，避免把它降级成人工约定。

当前五包仍只有 `roots: ["<rootDir>/src"]`，因此实际分母继续由 Jest 默认命名规则覆盖；未来需要
`testMatch` 时必须先实现并独立复核 glob 语义，不能把 `UNSUPPORTED_TEST_MATCH` 当作测试通过。

### 7. CP-4 全范围验收（TER-local）

CP-4 测试前 fresh 全范围三维对账为 `GO`（M=0/S=0/N=0）。随后按授权只运行 TER-local 命令，
不运行仓级 `scripts/verify`、设备/Gradle/Kotlin 或任何 DEV/seed/L2。所有原始 stdout/stderr 与退出码
保存在 `.runtime/terminal-contracts/cp4-final-20260830/`。

单包与合同门结果：

```text
yarn workspace @catering-v2s/kernel-base-contracts typecheck       exit 0
yarn workspace @catering-v2s/kernel-base-contracts test            exit 0 (18 tests, REAL_TESTS)
node tools/terminal-contracts/check-static.test.mjs                exit 0
node tools/terminal-contracts/check-static.mjs                     exit 0
```

`yarn workspace @catering-v2s/terminal verify:static` exit 0，输出 `RULE_GATES=6`、
`SUPPORT_CHECKS=1`，六道骨架门、SCAFFOLD_HYGIENE、四道 contracts 门及两个 model test 全部 PASS，
最终打印 `TERMINAL_STATIC=PASS`。

为排除缓存重放，随后用 `TURBO_FORCE=1` 重跑完整入口：

```text
TURBO_FORCE=1 yarn workspace @catering-v2s/terminal typecheck exit 0
  Turbo: 22/22 successful, Cached: 0, Time: 6.335s
TURBO_FORCE=1 yarn workspace @catering-v2s/terminal test exit 0
  Turbo: 6/6 successful, Cached: 0, Time: 682ms
```

强制重跑的 test 输出只有一个 contracts `REAL_TESTS` 与五个 adapter `NO_TEST_FILES`，
`TERMINAL_TEST_MARKERS=PASS real=1 noTests=5`。

完整 TER-local `verify` 也以 `TURBO_FORCE=1` exit 0：dry-run 报告为 typecheck 22/22、test 22 包中
6 个 executable owner、lint/clean 0 executable；静态门全绿；Android Metro export 成功，入口
`apps/terminal/assembly/android/pos-desktop/index.ts` 打包 651 modules；最终
`TERMINAL_VERIFY_CLEANUP=PASS` 与 `TERMINAL_VERIFY=PASS`。导出产生的 assembly `dist/.expo` 已由 verify
清理，命令后残留数为 0。

```text
CP4_CONTRACTS_TYPECHECK=PASS
CP4_CONTRACTS_TEST=PASS tests=18
CP4_CONTRACTS_STATIC_MODEL=PASS
CP4_CONTRACTS_STATIC_REAL=PASS
CP4_TERMINAL_STATIC=PASS
CP4_TERMINAL_TYPECHECK=PASS packages=22 cache=0
CP4_TERMINAL_TEST=PASS tasks=6 cache=0 real=1 noTests=5
CP4_TERMINAL_VERIFY=PASS metro_modules=651
CP4_EXPORT_CLEANUP=PASS remaining=0
CP4_BUSINESS=PASS
CP4_CLEANUP=PASS
```

本验收仍不扩大主张：`create-expo-module` 完整安装闭包、adapter 未来真实 Jest peer closure、
首次 `persist-kv` 历史完整 before 快照、Android 设备/Gradle/Kotlin 能力与仓级 verify 均按
`UNVERIFIED_REQUIRES_EVIDENCE` 或未授权边界保留；本包仅有最小 contracts 实现，未实现任何 adapter 能力。

以上内容是 CP-3/CP-4 之前的历史追加记录，已由后续的 CP-3 定向修复、CP-4 验收与最终 IMPLEMENTATION
review 取代；当前状态以本文「当前收口状态」节为准。未授权的设备/Gradle/Kotlin、仓级 normal verify、
DEV/reset/seed/L2/UAT/部署边界仍保持未执行，不因历史段落改写而扩大。

### 5. CP-3 定向复核修复与 manifest 重演

CP-3 步骤级独立复核指出两项证据/诊断缺口：runner 将 Jest 的 signal 失败压扁成普通 exit 1，且
`persist-kv` 首次安装前只保存了选定字段而非完整 manifest。两项均按最小范围修复/补证：

- 五个同形 runner 在 `result.signal` 分支先输出
  `TERMINAL_PACKAGE_TEST_FAILURE package=<name> signal=<SIGNAL>`，再以同一 signal 终止父 runner；
  不打印 PASS marker。模型夹具新增 signal（SIGTERM）与 Jest 不可执行（ENOENT）两条负向控制，当前
  `.runtime/terminal-contracts/cp3-manifest-replay-20260830/adapter-runner-model-signal-missing-exec-green.log`
  为 PASS、exit 0。
- 未伪造首次历史快照。以当前目标 manifest 为基线，在受控重演中仅将 `persist-kv` 的两个第三类
  devDependency 暂时恢复为本批安装前值，保存完整 `package.json`，从该包 cwd 原样再次执行
  `npx expo install --yarn --dev jest-expo babel-preset-expo -- --mode=update-lockfile`；命令 exit 0。
  重演完成后逐顶层字段对拍，除 `devDependencies` 外无差异，其他四个 adapter manifest 也未变化，
  且无 package-local `node_modules`：

```text
REPLAY_CHANGED_TOP_LEVEL=devDependencies
REPLAY_NON_DEV_FIELDS_UNCHANGED=PASS
REPLAY_TARGET_JEST_EXPO=~57.0.5
REPLAY_TARGET_BABEL_PRESET=~57.0.0
REPLAY_SIBLING_MANIFESTS_UNCHANGED=PASS
REPLAY_PACKAGE_LOCAL_NODE_MODULES=NONE
REPLAY_CLEANUP=PASS
```

完整 before/after、命令 stdout/stderr、Yarn 最终收敛日志与 diff 位于
`.runtime/terminal-contracts/cp3-manifest-replay-20260830/`。这闭合了同一命令与同一 manifest 形态
的完整写入面证据，但仍不把它表述为首次运行的历史快照；首次运行记录保留为原始证据，任何无法从当时
字节复原的历史事实仍不被倒填。

`yarn install` 重演后的 exit 0 与 peer warnings 记录在同目录；peer closure 仍为
`UNVERIFIED_REQUIRES_EVIDENCE`，不因 zero-test 绿而升格。

```text
CP3_SIGNAL_DIAGNOSTIC=PASS
CP3_MANIFEST_REPLAY=PASS
CP3_FIRST_RUN_FULL_MANIFEST_SNAPSHOT=UNVERIFIED_REQUIRES_EVIDENCE
CP3_BUSINESS=PASS
CP3_CLEANUP=PASS
```
