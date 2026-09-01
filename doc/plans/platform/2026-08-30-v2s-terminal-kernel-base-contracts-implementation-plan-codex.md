# TER `kernel.base.contracts` · 实施计划

> 输入：`2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md` 与
> `2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md`。本计划只执行 Dexter 授权的
> contracts 与一键测试收口，不运行仓级 normal verify、设备或任何业务环境。

## 0 · 执行纪律与证据

```text
IMPLEMENTATION_AUTHORIZED=true
IA=NOT_APPLICABLE（无用户界面/Journey）
STEP_RECONCILIATION=fresh independent subagent after every CP
WHOLE_SCOPE_RECONCILIATION=fresh independent subagent before CP-4 tests
TER_ONLY_VERIFY=true
```

每个写点前重开需求对应条目、详设对应 CP、六维命中的 TER memory 与 owning source；focused proof 后用同一组
原文回读。每个 CP 完成后先独立对账，OPEN finding 修复并由新的 fresh reviewer 复核，之后才能进入下一 CP。
原始长日志写 `.runtime/terminal-contracts/<run>/`，实施摘要写
`doc/evidence/platform/terminal-kernel-base-contracts/implementation-codex.md`。业务结果与 scratch cleanup 分开。

## CP-1 · 共享语言、公开面与本包测试

### 1.1 RED：先让批准行为可失败

1. 修改 contracts `tsconfig.json`，让 `src/**/*.ts`、`test/**/*.ts`、`vitest.config.ts` 进入唯一 typecheck。
2. 新建 `vitest.config.ts`，node 环境，只匹配 `test/**/*.test.ts`。
3. 新建 `test/public-surface.typecheck.ts`：从包根导入详设 74 名并落 F-1…F-4；先确认缺实现时 typecheck 红。
4. 新建 `test/contracts.test.ts`，按 T-1…T-9 写行为断言；先确认缺实现时 Vitest 红。
5. `package.json` 只增加 `test` 与 `vitest@4.1.10`，不增加 production dependency/peer；随后从仓根运行一次
   `yarn install`，让 Yarn 生成本次 contracts 测试依赖的 lock/install 状态，再取得有意义的 RED。

focused RED：

```sh
yarn workspace @catering-v2s/kernel-base-contracts typecheck
yarn workspace @catering-v2s/kernel-base-contracts test
```

记录首个有意义失败；不得把“模块不存在”之后的连锁错误逐条当 finding。

### 1.2 GREEN：按共享语言边界实现

实现顺序固定：

1. `types/ids.ts` + `foundations/time.ts` + `foundations/runtimeId.ts`；kind 决定 brand，九前缀 exact-set。
2. `types/error.ts` + `foundations/errorTemplate.ts`；模板缺参保留 `${key}` 并传播 missingKeys；假时钟覆盖。
3. `types/parameter.ts` + `foundations/definition.ts`；unknown type guard 使参数定义可安全擦除；定义 key 派生。
4. `types/module.ts`；`kind` 必填、版本字段可选、parameterDefinitions 无 any。
5. `types/request.ts` + `types/command.ts`；三个 result 泛型，route context 只留 workspace/instanceMode 且写 local-only 注释。
6. `types/transport.ts`；只留已证字段，无 metadata。
7. `src/index.ts` 逐项显式导出 74 名；保留三个骨架符号；不建 barrel `export *`。

每组完成即跑包 typecheck/test，最后执行：

```sh
yarn workspace @catering-v2s/kernel-base-contracts typecheck
yarn workspace @catering-v2s/kernel-base-contracts test
yarn workspace @catering-v2s/kernel-base-contracts exec tsc --noEmit --listFilesOnly
```

`--listFilesOnly` 输出必须包含 `test/public-surface.typecheck.ts`。

### 1.3 4c 反向控制

用 `mktemp -d` 创建仓外 scratch，复制本包与 `apps/terminal/tsconfig.base.json` 所需闭包，删除 F-2 中一行
`@ts-expect-error`，使用仓内 TypeScript binary 对 scratch config 执行 `--noEmit`：必须非 0 且报 brand 不可赋值；
真实树随后再次 typecheck 0。删除 scratch 并记录 `TYPE_NEGATIVE_CONTROL_CLEANUP=PASS`。

### 1.4 CP-1 完成条件

- 74 名 exact list 人工对账；dependencies/peer 为空，源码无 workspace/React/RN/Expo import；
- T-1…T-9 绿；F-1…F-4 真进编译；4c 红/真实树绿；
- TR-05 14 行与详设 A=7/B=7/C=0 对得上；
- POC 排除项与 wire 类型均未进入。

随后派 fresh reviewer 对需求、详设/计划、TER memory、当前源码与 focused evidence 做 CP-1 三维对账。

## CP-2 · contracts 静态门与 TER-local 验证接线

### 2.1 checker 实现

新增：

```text
tools/terminal-contracts/check-static.mjs
tools/terminal-contracts/check-static.test.mjs
```

checker 用 TypeScript AST/TypeChecker 实现：

1. C-2 零 adapter 能力；
2. C-4b exported boundary + 全 src 双重 cast；
3. C-5 RuntimeIdKind/prefix exact-set + prefix 唯一；
4. C-6 七个闭集的 literal exact-set；
5. support：74 名 module symbol exact-set + 零 `export *`。

不能用单行正则解析 import/type；此前 POC 消费面漏抓就是多行 import 反例。

### 2.2 model test

在 temp 最小副本逐个运行以下 mutation，每次只允许目标门/support 红：

| mutation | 预期 |
|---|---|
| 增加 `fetch('/x')` | C-2 红 |
| 增加 exported `Record<string, unknown>` 成员 | C-4b 红 |
| 泛型改成 `extends Record<string, unknown>` | C-4b 红 |
| 增加 `value as unknown as string` | C-4b 红 |
| 删除一个 prefix key | C-5 红 |
| `ErrorCategory = string` | C-6 红 |
| 删除一个 index export | support 红 |
| 增加一个 index export | support 红 |

所有 temp 运行后 cleanup PASS；最后真实树输出：

```text
CONTRACT_RULE_GATES=4
CONTRACT_SUPPORT_CHECKS=1
TERMINAL_CONTRACTS_STATIC=PASS
```

### 2.3 TER-local 接线

1. `tools/terminal-skeleton/verify-static.mjs` 在既有 skeleton model/real 后运行 contracts model/real；任一步失败
   不打印 `TERMINAL_STATIC=PASS`，既有 `RULE_GATES=6` 不改口径。
2. `tools/terminal-skeleton/verify.mjs` 的 test owner exact-set 固定为 contracts + 五 adapters。
3. dry-run 验集合后，typecheck 之后实际执行 filtered `turbo run test`，再执行 Expo export。
4. 明确解析 1 个 REAL marker 与 5 个 NO_TEST_FILES marker；缺任一 marker 或多 owner 都失败。

focused proof：

```sh
node tools/terminal-contracts/check-static.test.mjs
node tools/terminal-contracts/check-static.mjs
yarn workspace @catering-v2s/terminal verify:static
```

CP-2 不先跑完整 `verify`，因为五个 adapter runner 尚在 CP-3 修复；记录这一预期未闭合边界，不把它报成回归。
随后 fresh reviewer 做 CP-2 三维对账。

## CP-3 · 五个 adapter 的 zero-test 与 SDK 57 devDeps

### 3.1 保留真实首败

已有首败：在 `persist-kv` cwd 执行 `node internal/module_scripts/test.js`，Node 24.13.0 因 `type: module`
拒绝 CommonJS `require`，exit 1。实施时先读取该 runner 和 util，再把五包同根问题一次性收口；不得只在一个包加
`--passWithNoTests`。

### 3.2 ESM runner

逐包把 `internal/module_scripts/test.js` 与 `util.js` 转为 ESM：

- 无 CLI 额外参数时按现有 Jest roots 与默认/testRegex 规则查 `src` 测试文件；当前五包未声明
  `testMatch`。若未来 manifest 出现 `testMatch`，当前轻量 runner 必须 fail closed，输出结构化
  `UNSUPPORTED_TEST_MATCH` 配置错误并退出非 0，不得把未匹配文件报告为 `NO_TEST_FILES`；
- 零文件打印 `TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=<name>` 并 exit 0；
- 有文件必须 spawn 原 Jest 并传播 exit/signal；
- 不使用 `--passWithNoTests`，不改变 native、package exports 或 peerDependencies。

先完成并核对 persist-kv，随后机械同步其余四包。逐包直接运行 runner，五个均明确 NO_TEST_FILES。

### 3.3 三类版本证据与命令

1. 建立同批 template-keyed 证据：精确 template 版本 + raw manifest 集合 A 值；若 latest 漂移，全单元重取。
2. 对每包保存 package.json before，cwd 依次为：
   `persist-kv`、`device`、`app-control`、`logger`、`dual-screen`。
3. 每包执行：

```sh
npx expo install --yarn --dev jest-expo babel-preset-expo -- --mode=update-lockfile
```

4. 第一包 exit 0 后立即核：只当前包两个第三类声明与 Yarn 派生 lock/install state 可变；dependencies、peer、native、
   其他 manifest 字段、其他 package manifest 均字节不变。越界立即停机并保留 diff。
5. 将集合 A 的 `expo`、`react-native`、`@types/react`、`typescript` 与同批 raw 值对齐；其中 TypeScript 当前已同值，
   仍记录 before/after。第三类只能取 Expo 实际解析值。
6. 五包完成后根 cwd 统一执行一次 `yarn install`；保存 exit 与 Yarn 生成 diff，不手改 lock。

若 `--mode=update-lockfile` 未被 Expo/Yarn 接受、CLI 非 0、供应链/网络失败或 latest 单元不一致，CP-3 停止；
不改 gate、不换 package manager、不手写第三类版本。

### 3.4 一键 test

```sh
yarn workspace @catering-v2s/terminal test
```

必须 exit 0，Turbo owner exact-set=6，contracts 真跑断言，五 adapter 各打印 NO_TEST_FILES；报告写：

```text
REAL_TEST_PACKAGES=1
NO_TEST_PACKAGES=5
```

随后 fresh reviewer 做 CP-3 三维对账，重点核五包 semantic write exact-set 与生成 lock 来源。

## CP-4 · 全范围对账、整体测试与交付

### 4.1 测试前 fresh 全范围对账

独立 reviewer 不汇总前三次结论，而是重新从需求、详设/计划、TER memory 和当前树检查：

- 七组/74 名/排除项；
- TR-05 A/B/C 全表；
- T/F/四门/exact export；
- test owner 1+5 与真实执行入口；
- 五 adapter devDeps 来源、写入面与 no-test 诚实性；
- 未冻结/未验证边界是否被升格。

OPEN finding 修复并 fresh recheck 后，才执行整体测试。

### 4.2 整体命令

```sh
yarn workspace @catering-v2s/kernel-base-contracts typecheck
yarn workspace @catering-v2s/kernel-base-contracts test
node tools/terminal-contracts/check-static.test.mjs
node tools/terminal-contracts/check-static.mjs
yarn workspace @catering-v2s/terminal verify:static
yarn workspace @catering-v2s/terminal verify
```

只运行 TER-local 入口。读取每条新鲜 stdout/stderr、exit、marker、elapsed 与 scratch cleanup；不运行仓级
`scripts/verify` normal。若完整 `verify` 暴露既有 Expo export 或 workspace 问题，按首败定位，不能以 contracts focused
测试替代整条闭包。

### 4.3 交付 evidence

`implementation-codex.md` 必须含：

1. 74 名精确导出与每组共享性/消费者理由；
2. POC 显式差异；
3. TR-05 14 行 A/B/C 对账；
4. 四组 `UNVERIFIED_TER_NEED`，组 5/6 未冻结；
5. T-1…T-9、F-1…F-4、4c、四门/support 的命令/exit/marker；
6. test owner exact-set、`REAL_TEST_PACKAGES=1`、`NO_TEST_PACKAGES=5`；
7. 五 adapter 每包 cwd/CLI/命令/exit/before-after devDeps，集合 A/template key 与第三类解析值；
8. `create-expo-module` EALLOWSCRIPTS、metadata future writer/reader、resolver 行为等未关闭边界；
9. 与需求/详设任何偏差及处置；
10. business 与 cleanup 分开。

### 4.4 最终独立实现 review

整体命令全绿后派 fresh 独立子 agent，按
`REVIEW_TARGET=IMPLEMENTATION`、`REVIEW_CYCLE_ID=TER_KERNEL_BASE_CONTRACTS_IMPLEMENTATION_20260830`、
`REVIEW_ROUND_LIMIT=2` 重开真实源码与新鲜 evidence。主 agent 逐条 intake findings，标
`CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`；
只修已确认项。最多第二轮定向复核，之后按规则自行收口并给 Dexter 一份可直接转 Claude 的中文 brief。

## 停机清单

- 设计独立审查尚未 GO；
- 当前 CP 三维对账 OPEN；
- 真实树任一 focused proof 红，或负控制不红；
- Expo/Yarn 非 0、越界写入或 template-keyed 证据混版；
- TER test 不是真实 1 + 明确零测试 5；
- scratch/runner cleanup 非 PASS；
- 继续动作需要超出本批授权的设备、仓级 normal verify、DEV、seed、L2、UAT 或其他包能力实现。
