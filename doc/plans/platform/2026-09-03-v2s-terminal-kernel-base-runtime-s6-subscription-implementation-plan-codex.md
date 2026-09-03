# V2S TER `kernel.base.runtime` S-6 实施计划（Codex）

> 状态：`IMPLEMENTATION_SELF_VERIFIED_COMPLETE`
>
> 详设：`doc/plans/platform/2026-09-03-v2s-terminal-kernel-base-runtime-s6-subscription-implementation-design-codex.md`
>
> 本计划只执行 S-6；不进入 render，不实现 S-7，不新增 Runtime stop/dispose，不做 DEV/seed/L2/UAT/deploy。

## 1 · 目标与完成定义

把 Runtime 的既有 `status`/`getState` facade 补成一个可供后续 render 适配的窄只读订阅源：

- `Runtime.subscribe(listener)` 同步覆盖 store dispatch 与 status transition；
- `starting → started` 和 `starting → failed` 的写入—通知顺序可观察；
- 退订幂等，failed 终态在最终通知后关闭，started 终态由调用方或 test resource release 结束；
- `getState`/`getStore` 非 started 抛错不变；
- 根级 public exports 从 63 精确变为 64，只新增 `RuntimeSubscriptionListener`；
- runtime focused/full tests、typecheck、static/model 与 production unsubscribe mutation 的 baseline/red output 齐备。

“实现完成”不等于 render 已可运行，也不等于 React、native、设备或动态环境证明。

## 2 · 原子 CP 顺序

| CP | 主题 | owner | 输出 | 依赖 |
|---|---|---|---|---|
| S6-CP0 | 当前材料与复用能力复核 | Codex | 本详设/本计划、源码锚点、contract decision | Dexter 的 S-6 授权 |
| S6-CP1 | Runtime 订阅原子实现 | Codex | types/index/invariant、`createRuntime` facade subscription、focused tests、public typecheck | CP0 |
| S6-CP2 | production red vector 与包文档同步 | Codex | `check-behavior.mjs` baseline/red/cleanup、README、focused/full regression | CP1 |
| S6-CP3 | 全批对账与交付 | Codex + fresh independent verifier | 三维对账、静态/type/test 输出、GO/NO-GO 自评、Claude review brief | CP2 |

CP-1 与 CP-2 在源码上作为一个原子变更组落地：不得先让 public type 进入根导出、再以旧 facade 中间态交付；不得建立只通知 status 但不接 state 的中间公共契约。CP0/CP1/CP2 的阶段性复核只在下一 CP 开始前完成；CP3 前另做全批重新对账。

## 3 · CP-0：实施前双读与问题族分母

### 3.1 必须重开的输入

1. `doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md` §4.0a、§4.0b：七条 S-6 运行语义与 snapshot gate。
2. `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-runtime-requirements-claude.md` §4.5、§4.5b：启动阶段、资源/订阅持有与无停机出口。
3. `project-memory/decisions/deterministic-context-only.md`、`project-memory/operations/terminal-coding-standard.md`、`doc/platform/terminal-coding-standard.md` TR-01/TR-03/TR-06/TR-10/TR-11。
4. `project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/decisions/terminal-build-order-and-batches.md`。
5. owning source：`src/application/createRuntime.ts`、`src/types/runtime.ts`、`src/index.ts`、`src/foundations/createStateSubscription.ts`、`src/foundations/createRuntimeResourceRegistry.ts`、`src/testing/releaseRuntimeForTest.ts`、`test/lifecycle.test.ts`、`test/public-surface.typecheck.ts`、`terminal-invariants.json`。
6. 可复用测试/工具：`test/testSupport.ts`、`tools/terminal-runtime/check-static.mjs`、`tools/terminal-runtime/check-static.test.mjs`、`tools/terminal-ui-state/check-behavior.mjs`。

### 3.2 问题族完整分母

| 根因族 | 本批全集 | 处置 |
|---|---|---|
| 只存在 store 级订阅、不存在 facade lifecycle 通知 | `createStateSubscription`、`Runtime` facade、status 三处赋值 | 统一 Runtime registry；不复制 store |
| facade 订阅资源无法由 test release 观察 | `createRuntimeResourceRegistry`、`releaseRuntimeForTest`、module/actor 既有 `subscribeState` | 新 facade removal 注册到同一 registry；既有 module/actor 形态不改 |
| public surface exact-set 容易漂移 | `src/index.ts`、`terminal-invariants.json`、`public-surface.typecheck.ts`、static support | 只增 listener type 一项，并复算 64 |
| 行为 proof 可能只改测试而未证明生产实现 | runtime focused tests 与新 behavior harness | sandbox 对 unsubscribe、pre-start notify、state attach、failed close、failed-subscribe 五处 production 实现分别 mutation；baseline/red 均执行；failed close 与 late subscribe 使用不同 release 断点 |
| 生命周期误读成停机能力 | README、runtime requirements、详设、计划 | 明确 started 无 stop/dispose；本批不加公共停机 |

## 4 · S6-CP1 原子实现步骤

每一处写入前重新打开第 3.1 的对应正本与 owning source；该 CP 的 focused proof 完成后，以同一清单再次回读源码和输出。

### Step 1：公共类型、接口与 exact-set

修改：

- `src/types/runtime.ts`：在 `Runtime` interface 前增加 `RuntimeSubscriptionListener = () => void`，加入 `subscribe` 方法；不改已有成员。
- `src/index.ts`：只追加该 type export。
- `terminal-invariants.json`：只追加 `RuntimeSubscriptionListener`。
- `test/public-surface.typecheck.ts`：导入并引用该类型，增加 `Runtime['subscribe']` 的形状引用。

失败条件：根级 actual export 不是 64、extra/missing 不是唯一 listener type、`getState`/`getStore` 签名或非 started 语义被改动。

最小 proof：runtime typecheck + runtime public support/static；若此时只能通过再增加第二个根导出，立即停止，不自行扩大面。

### Step 2：统一 Runtime listener registry

修改 `src/application/createRuntime.ts`：

1. 在 `resources` 附近建立 private subscription record 集合与共享 `stateSubscription`。
2. `subscribe` 在 `created`/`starting`/`started` 建立 active record；同一 listener 的两次订阅保持两个 record；`failed` 返回 no-op。
3. record removal 首次执行时置 inactive、从 Set 移除、取消自身 resource registration；最后一个 record 移除时取消共享 store subscription。
4. state runtime 建成后调用 attach seam；attach 只使用 `createStateSubscription(stateRuntime.getStore(), notifyAll)`，不把 store 传给 public caller。
5. 把 `created → starting`、`starting → started`、`starting → failed` 的直接 assignment 改为设计规定的“写入后同步 notify”；failed 先 detach state subscription，发一次最终 failed 通知，再关闭/注销所有 facade records。
6. listener 异常按设计落 scoped safe diagnostic，不改变 status、failure 或其它 listener 的通知顺序。
7. runtime object 增加 `subscribe`，保留现有 `getState`、`getStore`、`dispatchCommand` 与两个 test accessor 注册。

失败条件：

- `getState` 在 non-started 仍会被 S-6 自己调用，或 status 尚未写入就回调；
- store listener 需要消费侧传入 store/dispatch；
- 一个 listener 退订会误删另一个相同函数的订阅；
- failed 后仍收到 state/status callback，或 failed callback 看不到 failure；
- module/actor `subscribeState` 的注册与释放路径被改动。

focused proof：`runtimeSubscription.test.ts` 的六个 before-start/order、state synchronous、failed final（含 failed 后 late subscribe）、unsubscribe、release、snapshot 场景；read-only shape 由 `public-surface.typecheck.ts` 单独闭合。

### Step 3：CP-1 阶段三维对账

在开始 CP-2 前，fresh 独立子 agent 以 `REVIEW_TARGET=IMPLEMENTATION_STEP`、`reviewerKind=INDEPENDENT_SUBAGENT` 对 CP-1 当前字节做三维逐点对账：需求 §4.0a/b、S6 详设/计划、项目记忆与 TER standard。核对行为、形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、数据来源/失效边界；任一 OPEN 由主 agent 修复后重新复查，不能带入下一 CP。

## 5 · S6-CP2 red vector、文档与回归

### Step 4：behavior harness

新建 `tools/terminal-runtime/check-behavior.mjs`，仿照 `tools/terminal-ui-state/check-behavior.mjs`：

- sandbox 只复制 runtime package，symlink contracts/platform-ports/state 与现有 node_modules；
- baseline 运行同一 runtime subscription focused test；
- 五个 mutation 分别只改 sandbox 的 `createRuntime.ts` production 实现：
  - `RED_UNSUBSCRIBE`：把 `if (!subscription.active) return` 变成错误的 active guard；
  - `RED_PRE_START`：移除 `status = 'starting'` 后的 `notifyRuntimeSubscribers()`；
  - `RED_STATE_ATTACH`：阻止共享 `createStateSubscription(...)` 建立；
  - `RED_FAILED_CLOSE`：移除失败路径的 `closeRuntimeSubscriptions()`；
  - `RED_FAILED_SUBSCRIBE`：移除 `status === 'failed'` 的 early-return，使 failed 后 late subscribe 进入资源注册表；
- 每个 mutation 运行它对应的 focused test，必须非零；failed close 的第一个 release 与 failed subscribe 的第二个 release 分别负责各自 oracle，不能只靠 repeat-start 计数；
- 每次 finally 删除精确 sandbox，输出 cleanup PASS。

不得改测试夹具让 mutation 失效；不得只检查 mutation anchor 存在而不执行 focused proof。每个 mutation 都必须有唯一锚点计数检查，并在 finally 清理精确 sandbox。当前 harness 的 `spawnSync` 若未来引入可能挂起的错误 mutation，必须补受控 timeout；baseline marker 不得继续用与 suite 脱节的硬编码测试分母。

### Step 5：README 与详设/计划 readback

在 `apps/terminal/kernel/base/runtime/README.md` 的 facade/lifecycle/iteration 位置补充：

- `Runtime.subscribe` 是同步只读 invalidation，不是业务事件总线；
- `created → starting → started` 与 failed final callback 的顺序；
- `getState` status gate 与 snapshot 责任；
- started 无 production stop/dispose，调用方退订/test release 的边界；
- public surface 仅新增 listener type，test helpers 不进 root。

用 `rg` 扫 README、详设、计划与 runtime requirements 中的 `subscribe`/`getStore`/`stop`/`dispose`，确认没有把 S-6 写成 render 已实施、没有把 getStore 写成推荐消费路径。

### Step 6：CP-2 阶段三维对账

CP-2 完成后、整体测试前，fresh 独立子 agent 重新对照第 3.1 清单，专门核 behavior harness 是否真的改 production unsubscribe、README 是否与源码一致、四类公共面是否同步；同一 review cycle 第二轮达到硬上限后停止，不召第三轮。

## 6 · CP-3 全批验收顺序

1. 用同一源清单做全批三维对账；先静态读回，再执行测试，避免以 green test 替代设计对账。
2. 运行 focused runtime subscription test。
3. 运行 runtime package full test。
4. 运行 runtime typecheck。
5. 运行 `node tools/terminal-runtime/check-behavior.mjs`，保留 baseline、mutation red、cleanup 输出。
6. 运行 `node tools/terminal-runtime/check-static.test.mjs` 与 `node tools/terminal-runtime/check-static.mjs`；确认 actual public export 64、expected 64、差集为空。
7. 复读 `getState`/`getStore` 既有 lifecycle proof、public surface typecheck、README 与 invariants；确认 no render/S-7/其它包变化。
8. 生成最终结果与 Claude 可复制 review brief：变更路径、契约答案、fresh outputs、静态/行为证据分层、未证明边界、`GO/NO-GO` 与 `M/S/N` 自评。

## 7 · 验收矩阵

| 判据 | 最低证据 | 预期错误实现 | 红向量/观察 |
|---|---|---|---|
| pre-start subscribe + status order | focused test | 订阅不保留或 status 写入后不通知 | before-start callback sequence |
| started availability | focused + existing L-2 | 先 callback 后写 started | callback reads status/getState |
| failed final + closure | focused test | failure 后无 callback或继续 state callback | failure callback and repeat-start count |
| sync state notice | focused test | `queueMicrotask`/timer 延迟 fan-out | actor `inActionDispatch` flag |
| idempotent unsubscribe | focused test | delete wrong record/no-op unsubscribe | count unchanged after real command |
| test release | focused test | facade resource 未注册 | release then real command count |
| snapshot unchanged | existing lifecycle + focused | 改 getState gate/clone root | throw and `toBe` assertions |
| narrow public type | typecheck/source | listener receives store/dispatch or payload | parameter/return type closure |
| exact public export | static support | missing/extra root export | actual/expected 64 exact |
| production mutation proof | behavior harness | unsubscribe、pre-start notify、state attach、failed close 或 failed-subscribe implementation broken but tests still green | 每个 sandbox mutation 必须 exit nonzero；baseline 与 cleanup 均 PASS |
| README contract | source review | README 推荐 getStore 或声称有 stop | exact source/doc readback |

## 8 · 失败与恢复纪律

- 任一命令首败保留原始输出；先分类源码/test/harness，再决定修复，不延长 timeout 冒充修复。
- 同一 failure signal 第二次出现前，先完成问题族诊断并更新唯一 owning source；不得靠测试删例或放宽 exact-set。
- behavior sandbox 清理失败不得报完成；business/test PASS 与 cleanup PASS 分开记录。
- 本批无 managed runtime、PID、远端容器、DEV 或浏览器资源，因此不调用 DEV/L2 管理脚本；这不是跳过动态环境，而是该授权范围不适用。

## 12 · 实施与自验收 readback（2026-09-03）

当前实现已按本计划完成并自验收：

- `runtimeSubscription.test.ts`：1 file / 6 tests PASS；六个 runtime 行为场景与 failed 后 late-subscribe resource-release oracle，以及 `public-surface.typecheck.ts` 的只读形状证明共同闭合七项契约。
- listener 异常诊断只写固定安全消息，不记录消费侧原始 error message；该 S-6 日志边界修订后重新通过以下全部代码与 mutation 验收。
- `yarn workspace @catering-v2s/kernel-base-runtime test`：14 files / 89 tests PASS，输出 `TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime`。
- `yarn workspace @catering-v2s/kernel-base-runtime typecheck`：exit 0。
- `node tools/terminal-runtime/check-static.mjs`：5 rule gates、1 support check 全部 PASS，输出 `TERMINAL_RUNTIME_STATIC=PASS`。
- `node tools/terminal-runtime/check-static.test.mjs`：`RUNTIME_MODEL_CLEANUP=PASS`、`TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS`。
- `node tools/terminal-runtime/check-behavior.mjs`：baseline 6 tests PASS；`RED_UNSUBSCRIBE`、`RED_PRE_START`、`RED_STATE_ATTACH`、`RED_FAILED_CLOSE`、`RED_FAILED_SUBSCRIBE` 五个 production mutations 均 exit 1，故对应 focused proof 真红；`TERMINAL_RUNTIME_BEHAVIOR_CLEANUP=PASS`。
- `terminal-invariants.json` 当前 `publicExports` 为 64 个且唯一；新增项只有 `RuntimeSubscriptionListener`，与 `src/index.ts` 的解析结果由 static support 对齐。

第二轮 fresh 独立整批对账（`REVIEW_TARGET=IMPLEMENTATION`、`REVIEW_ROUND=2/2`）先指出详设把七项都写成 `runtimeSubscription.test.ts` 场景的 N-1 文档口径偏差；已将其改为“六个 Vitest runtime 行为场景 + public-surface typecheck 形状证明”，并在改文档后重新执行上述代码、静态与 mutation 证据。没有第三轮独立审查，以遵守本 review cycle 两轮上限。

本批未执行也未声称执行 React/render、native、Hermes、DEV、seed、L2、UAT 或部署验证；S-6 仍需 Dexter/Claude review 后，render 才可获得单独授权。

## 9 · 交付格式

最终交付必须包含：

- 详设链接与实施计划链接；
- 实际修改文件清单；
- 七条 S-6 契约的最终答案；
- focused/full/typecheck/static/model/mutation baseline-red-cleanup 的原始新鲜摘要；
- `getState` 抛错未变、public 63→64、无 dispatch 能力下沉、无 render/S-7 扩面说明；
- `GO` 或 `NO-GO`，`M=<n> / S=<n> / N=<n>` 自评；
- 可直接转交 Claude 的中文 review brief，含背景、仓根相对路径、独立核验重点、授权边界。
