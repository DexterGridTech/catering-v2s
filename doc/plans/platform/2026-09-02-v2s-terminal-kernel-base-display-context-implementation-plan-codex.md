# V2S TER `kernel.base.display-context` 实施计划（Codex）

> 状态：`IMPLEMENTATION_AUTHORIZED / TER_LOCAL_ONLY`
>
> 设计依据：`doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-design-codex.md`

## 1 · 目标与边界

按“窄 runtime 前置 → port 合约 → display owner 包 → 门与证据”的顺序交付 v1。当前已获 Dexter 授权执行
DC-P0 到 DC-P5；不得顺带做 transport activation、UI route 盖章、workspace scoping、
adapter/native、设备或仓级 normal verify。

## 2 · CP 与完成信号

### DC-P0 · runtime TR-11 前置

**RECALL（写前与 focused proof 后使用同一分母）**：

- 需求：display-context §2.3、§6 S-6；gate defect registry D-5 当前正本；
- 规范/记忆：terminal standard TR-01/TR-11；`terminal-architecture-and-stack-rulings.md` 的 TR-11 指针；
- owning source：runtime `setRuntimeInstanceModeActor.ts`、`createInternalRuntimeModule.ts`、`createRuntime.ts`、
  `requestLedgerRoleChangedActor.ts`、`types/module.ts`、`createRuntimeLifecycle.ts`、`releaseRuntimeForTest.ts`、runtime invariant；
- 设计：详设 §1.3、§5.1、§5.2、§10；
- 回读：proof 后逐项重开上述同一清单，核 effect 零残留、post-commit 顺序、ledger 连带、resource exact-set。

**变更**：

- 删除 `RuntimeRoleChangeEffect`/`roleChangeEffects`/request-ledger effect；
- 新增 runtime-owned `runtimeInstanceModeChangedCommand` 与 ledger consumer actor；
- set-mode actor 在 role commit 后 await child command；
- ledger startedAt 跨 role half 取最小值；
- `RuntimeModuleContext.registerResource` 接出现有 registry；
- 更新 runtime invariant、type/focused tests、README/HANDOFF；把门缺陷 D-5 标 superseded。

**focused proof**：

- role rejected/idempotent 不发 changed command；成功提交后才发；
- child consumer failure/timeout 不回滚 role，child 独立可见，父结果仍返回已提交的 role 事实；
- 父子跨 half 后 root、startedAt、完整链与旧 half 清理均正确；
- module 通过 `context.registerResource` 登记 cleanup，test-only release 调一次，重复 release 无效；
- runtime exports 仍 63，module context 10，internal command/invariant exact。

**完成信号**：runtime typecheck/test/static/TER-local affected verify 绿；fresh 三维对账 `MATCHED`。

### DC-P1 · platform-ports `getDisplayInfo`

**RECALL（写前与 focused proof 后使用同一分母）**：

- 需求：§4.0、§4.4a、§4.4b、§7 T-5/T-6；
- 规范/记忆：terminal standard TR-02/TR-05；terminal architecture memory 的端口与单 VM 裁定；
- owning source：platform-ports `types/device.ts`、`defaults/unavailableDevice.ts`、`src/index.ts`、
  `terminal-invariants.json`、default/type tests、terminal-platform-ports checker；
- 设计：详设 §5.3、§6.2；
- 回读：proof 后以同一清单核 count 语义、default reason/capability、125/6 exact-set 与 malformed 边界。

**变更**：device type/default/index/invariant/tests/README；public 125、DevicePort methods 6。

**red**：删 method 只红 required-port-shape；删 DisplayInfo root export 只红 support；默认 capability 写错 focused 红。

**完成信号**：platform-ports typecheck/test/static 绿；default 精确为
`unavailable/device/getDisplayInfo/ADAPTER_NOT_INJECTED`；fresh 三维对账 `MATCHED`。

### DC-P2 · display 基础形态

**RECALL（写前与 focused proof 后使用同一分母）**：

- 需求：§2.3、§4.0–§4.4、§4.7、§8；
- 规范/记忆：TR-01/TR-03/TR-04/TR-09；单 VM 多 surface、一主一副可拆卸副屏裁定；
- owning source：display skeleton package、`skeleton-graph.ts`、state `defineStateRuntimeSlice.ts`、runtime
  `runtimeInstanceMode.ts`、runtime module factory先例、graph-model；
- 设计：详设 §4、§6.1、§8.1；
- 回读：proof 后核 17 exports、四条 workspace 依赖、owner kind、单字段 slice与五纯函数，无第二住址。

**变更**：

- skeleton/package/dependencies 三处加 platform-ports，移除 plannedKind，moduleName 导出 owner kind；
- package 加 vitest、test script；tsconfig 纳入 test；invariant 先落 17 exports/owned REAL；
- 新增四类型、单字段 slice、五纯函数、selector、root index。

**focused proof**：D8/W4/E9/P5/type tests 绿；公开面 17；workspace edge exact 4；slice
owner-only/immediate/isolated；没有 displayIndex/displayCount/displayMode/workspace state。

**完成信号**：typecheck/focused/static 绿；fresh 三维对账 `MATCHED`。

### DC-P3 · commands、actors、启动校验

**RECALL（写前与 focused proof 后使用同一分母）**：

- 需求：§4.3–§4.6、§8 v1 required；
- 规范/记忆：TR-01/TR-02/TR-04/TR-11；失败原因不改写与确定性上下文规则；
- owning source：runtime `defineCommand.ts`、`defineActor.ts`、actor/command context、`createRuntime.ts` startup 顺序、
  state persistence result、platform PortResult；
- 设计：详设 §6.2–§6.5、§8.2–§8.3、§10；
- 回读：proof 后核三条 live guard、startup await、typed result、两跳 options 与 role-changed 只发生在 commit 后。

**变更**：四 command、五 actor、module factory；三条 VICE 写路径；AppError definitions与 typed logger。

**focused proof**：

- switch role 四支、switch instance 四支、power 三支、role changed 三支；
- startup 三个跨 runtime 场景 + invalid 分支；
- startup port Promise 悬起时 start 不得 resolve；
- 两跳继承 requestId/parent/route；
- 每次状态写后 flush 结果进入 actor result/diagnostic。

**完成信号**：actor/end-state/port call 三维 oracle 全绿；fresh 三维对账 `MATCHED`。

### DC-P4 · power bridge

**RECALL（写前与 focused proof 后使用同一分母）**：

- 需求：§3.2(0b)、§4.5、§4.5a、§8 bridge cases；
- 规范/记忆：TR-02/TR-11；AGENTS 日志/脱敏与长资源边界；
- owning source：DevicePort subscription types/default、RuntimeModuleContext、runtime lifecycle resource registry、
  test-only release、POC power bridge cited files；
- 设计：详设 §5.2、§7、§8.3；
- 回读：proof 后核 seed/dedupe/tail、所有 Promise 有归宿、resource one-shot/idempotent、typed diagnostic 无 raw payload。

**变更**：install 先 startup validation 后 subscribe；closure 持 last/id/active/tail；resource cleanup。
不定义 `onApplicationReset`：reset 不重跑 install，订阅只由 install 建立；生产释放路径依赖后续 Runtime teardown，
本批仅用 test-only release 证明本地失活与 unsubscribe 调用已发起。

**focused proof**：seed、same、transition、快速 external→battery 顺序、unavailable/rejected install、onError、release（含
failed/timed-out/unavailable/rejected unsubscribe 诊断）、idempotent release 八支；所有 Promise 有 reject 观察。

**完成信号**：bridge tests 绿且 runtime release 无新增活跃 listener；fresh 三维对账 `MATCHED`。

### DC-P5 · 四门与整体验收

**RECALL（写前与 focused proof 后使用同一分母）**：

- 需求：§8 四门与 v1 required、§9 已知风险；
- 规范/记忆：TR-04/TR-09/TR-10；verification governance 与 Claude handoff standard；
- owning source：terminal-shared invariant loader/test runner、terminal-skeleton graph/check/verify-static、
  terminal-platform-ports/runtime/state checker先例、各包 invariant、verify tests；
- 设计：详设 §8、§15–§17；
- 回读：proof 后核四个独红向量、55 cases、10/5/5、README/HANDOFF 和所有未证明边界；
  全批对账必须重新走 P0–P5 这六组分母，不得用各 CP 报告汇总代替。

**变更**：new checker/test；verify-static model+real；verify fixtures；README/HANDOFF。

**focused proof**：四个 gate red vectors各自 `FAIL/PASS/PASS/PASS`；八个关键 behavior red controls；真实树绿。

**整体测试前**：fresh 全批三维对账，不得用各 CP 报告拼接替代。

**最终命令（仅实施获授权后）**：

```text
yarn workspace @catering-v2s/kernel-base-runtime typecheck
yarn workspace @catering-v2s/kernel-base-runtime test
yarn workspace @catering-v2s/kernel-base-platform-ports typecheck
yarn workspace @catering-v2s/kernel-base-platform-ports test
yarn workspace @catering-v2s/kernel-base-display-context typecheck
yarn workspace @catering-v2s/kernel-base-display-context test
node tools/terminal-display-context/check-static.test.mjs
node tools/terminal-display-context/check-static.mjs
yarn workspace @catering-v2s/terminal verify:static
yarn workspace @catering-v2s/terminal verify
```

最后两条只能是 TER-local；不得调用仓级 normal `scripts/verify`。

**最终分母**：display tests 55；root exports display 17/platform 125/runtime 63；commands 4；actors 5；slice 1；
test owners 10、REAL 5、NO_TEST 5。

## 3 · 逐文件清单

### 3.1 新增

| 路径 | 唯一职责 |
|---|---|
| runtime `features/commands/runtimeInstanceModeChanged.ts` | runtime-owned post-commit command |
| runtime `features/actors/requestLedgerRoleChangedActor.ts` | 清 previous role ledger half |
| display `src/types/display.ts` | 四个 root types |
| display `features/slices/displayRole.ts` | 唯一 slice/action |
| display `features/commands/*` | 四 command definitions |
| display `features/actors/*` | 五 actor definitions |
| display `foundations/displayDerivation.ts` | surface/workspace/power pure functions |
| display `foundations/displayEligibility.ts` | 两种 eligibility |
| display `selectors/selectDisplayRole.ts` | 唯一 selector |
| display `application/createPowerStatusBridge.ts` | seed/dedupe/tail/release |
| display `application/createDisplayContextModule.ts` | module declaration/install |
| display `test/*`、`vitest.config.ts` | 55 focused/type cases |
| display `README.md`、`HANDOFF.md` | TR-10 与欠账 |
| `tools/terminal-display-context/*` | 四道门及定向 red fixtures |

### 3.2 修改

| 范围 | 文件/锚点 |
|---|---|
| runtime | role actor、internal module、createRuntime、module type/lifecycle/test registry、commands/index、root index、invariant、role/ledger/lifecycle/type tests、README/HANDOFF |
| runtime 删除 | `createRequestLedgerRoleEffect.ts` |
| platform | device type、unavailable default、root index、invariant、default/type tests、README |
| display | package、tsconfig、index、moduleName、dependencies、invariant |
| topology/verify | skeleton graph、verify-static、verify tests、yarn lock |

## 4 · red fixture 矩阵

| ID | mutation | 预期 |
|---|---|---|
| RED-P0-ORDER | role action 前发 changed command | post-commit behavior test红 |
| RED-P0-LEDGER | startedAt 沿用 child | parent/child ledger case红 |
| RED-P0-RESOURCE | 不向 ModuleContext暴露 registerResource | context exact/type/release红 |
| RED-P1-METHOD | 删除 getDisplayInfo | platform required-port-shape 独红 |
| RED-P1-EXPORT | 删除 DisplayInfo root export | platform support 独红 |
| RED-P2-PUBLIC | 增 unexpected root export | display public gate 独红 |
| RED-P2-KIND | moduleKind 改 toolkit | owner-kind 独红 |
| RED-P2-SLICE | 加 displayIndex | no-display-index 独红 |
| RED-P3-RESTART-ID | 删除 required restart case | restart-positive 独红 |
| RED-P3-LIVE-1/2/3 | 三路径任一路复用旧 count | 对应 actor/startup focused 红 |
| RED-P3-NO-AWAIT | install 不 await startup command | pending-start case红 |
| RED-P4-SEED | 首事件直接派发 | bridge seed case红 |
| RED-P4-DEDUPE | 同值重复派发 | dedupe case红 |
| RED-P4-TAIL | 去串行 tail | burst final-state case红 |
| RED-P4-RELEASE | 不登记 cleanup | release case红 |

机器 gate 的四个 red vector必须只红目标门；behavior red 不冒充 machine gate。

## 5 · 不得自行决定

以下一律停机：

- 找不到本文指定的 runtime lifecycle/command/port/state 接缝；
- 要保留 role effect 兼容层；
- 要扩大 DisplayInfo、17 exports、4 commands、5 actors或依赖边；
- 要引入新依赖、event bus、callback registry、运行期 schema或配置引擎；
- 要替 transport 实现 activation；
- 要修改 UI/adapter/native/assembly 生产源码；
- typed diagnostic 无法保留原 status/reason/capability；
- red fixture 不红/多红或真实树不绿；
- test owner 不等于 10/5/5；
- 需要跑仓级 normal verify 或任何未授权动态动作。

## 6 · 实施记录与 review 交付

实施记录必须逐项给：

1. 冻结输入 hash与六维 recall PASS；
2. P0/P1/P2/P3/P4/P5 每步前后双读与 fresh 对账；
3. exact exports/methods/commands/actors/slice/test owners；
4. 55 cases分组及新鲜输出；
5. 四门真实树与四个独红向量；
6. 关键 behavior red controls；
7. TER-local static/verify marker、耗时与 cleanup；
8. README/HANDOFF 欠账；
9. 未证明的 native/route/activation边界；
10. 与需求差异：reason 扩一值、失败域分开、bridge 串行、resource registration；`timed-out` 保留为
    PortResult 的非 succeeded 分支；生产订阅释放与 `onApplicationReset` 均作为已知边界登记。

完成后发起 fresh `REVIEW_TARGET=IMPLEMENTATION`，重开真实源码与新鲜输出；“按设计实现”不构成豁免。
