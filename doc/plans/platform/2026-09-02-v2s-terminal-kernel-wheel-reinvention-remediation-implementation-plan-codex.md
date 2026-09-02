# TER kernel 重复造轮子整改 · 串行实施计划

```text
PLAN_ID=TER_KERNEL_WHEEL_REINVENTION_REMEDIATION_20260902
DESIGN_REF=doc/plans/platform/2026-09-02-v2s-terminal-kernel-wheel-reinvention-remediation-implementation-design-codex.md
SOURCE_REF=doc/plans/platform/2026-09-02-v2s-terminal-kernel-wheel-reinvention-remediation-claude.md
AUTHORIZED_NOW=implementation within approved design/plan scope
IMPLEMENTATION_AUTHORITY=true (Dexter selected fixed-window B-1b)
FORBID_NOW=DEV, reset, seed, L2, UAT, deployment, and any scope expansion
DESIGN_REVIEW=GO (M=0,S=2,N=2); S-1 revised, S-2 fixed-window selected by Dexter
IMPLEMENTATION_STATUS=ACTIVE_CP0
```

## 1. 实施总原则

- 先做每项的同根问题族扫描，再动 owning source；报告中的圆圈行数不得成为范围或收益依据。
- 每个 CP 的 focused proof 后必须先独立步骤对账，发现 OPEN 即修复并接受新的独立复查，才进入下一 CP。
- C-12/A-1 是同一原子单元；state generic core 可先完成，但 requestLedger 只有一次最终迁移，绝不经过“旧分区 + createSlice”的临时形态。
- 不新增 runtime/test 名称中的流程 ID；不添加 Git、环境、动态验证或 UI/HTTP/数据库范围。

## 2. CP 顺序

| CP | 实施主题 | 主要路径 | 退出条件 |
|---|---|---|---|
| CP-0 | 每项写前的回读与有限分母确认 | 报告、详设、state/runtime/display source、static fixtures | 每个 finding 有 owning source、反例、retain/change 判定；圆圈结论未亲验的不实施 |
| CP-1 | 小而确定的第一批 | display-context dependency；state hydrate；runtime dispatcher；C-1…C-11 | 内部 helper 收敛、B-2 闭合、无 public surface 漂移 |
| CP-2A | C-12 state generic core | state `types/supports/workspace`、state tests/invariant | generic 无 runtime union，workspace wrapper 行为不变 |
| CP-2B | C-12 + A-1 最终 requestLedger/slice 原子迁移 | runtime/display slices/actors/selectors/tests；package manifests；invariants；TR-01 fixture | final partition + createSlice 同时存在；所有台账和 red control 正确 |
| CP-3 | A-2 与 §5 精确删除 | runtime selector；state sync/index/tests/invariant | default weakMap memoization 证明多 requestId 命中；只删两个 sync export |
| CP-4 | B-1/B-1b | state runtime/persistence tests | 两个镜像错误和 bounded window 各有稳定 proof |
| CP-5 | B-4、R3 与 B-2 回读 | runtime lifecycle/cleanup/dispatcher tests | 新请求扫描、无 timer、真实祖先拒绝/兄弟允许、reset Map 不泄漏 |
| CP-6 | B-5/B-6 record correctness与热路径处置 | state persistence/codec/tests | 坏 key 典型化；未测量优化明确不实施 |
| CP-7 | 整批设计对账、静态/type/focused test、独立 implementation review 准备 | 全批 change surface | 每个保持条件/红控/台账有 readback；后续 review 前不声明实施完成 |

CP-1 的 C-1…C-11 不是一次盲目大改：同 CP 内仍按 owner/package 独立完成 focused proof 和步骤级对账。CP-2A 与 CP-2B 在同一个 C-12/A-1 原子单元内连续完成；CP-2A 不迁 requestLedger，CP-2B 是唯一迁移点。

## 3. CP-0：实施前固定输入

1. 重开 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、当前 Roadmap 授权字段、`scripts/README.md`、本详设和修订报告。
2. 以六维 memory route 读取命中原文；对每个实际改点运行 `scripts/context/recall-code --query '<symbol>'` 后重开返回 source。
3. 形成仅供实施会话使用的 change matrix：路径、owner、保留事实、错误形状、focused proof、static gate。不得创建 retired compliance 台账。
4. 对 C-1…C-11、B-5/B-6 逐条确认同根 sibling 和反例；若当前源码不再满足报告条件，记录 `NOT_APPLICABLE_WITH_REASON`，不为了“完成表格”重构。

## 4. CP-1：第一批

### 4.1 依赖卫生与 B-2

- `display-context/package.json` 补 RTK 直接 dependency；同步 readback 其已有 `UnknownAction` import。
- 在 `createCommandDispatcher` 完成 B-2 的 root finally Map 清理和脱敏 warn；保留 timeout actor 继续运行的现有边界。
- focused：正常 root reset、root failure discard、late actor request-after-release 三种分支；不得记录 raw reset reason。

### 4.2 hydrate dead code 与 C-1…C-11

- 删除仅由 constructor 立即禁止、无可达分支的相同 physical-storage-kind bookkeeping；保留不同 port 的失败条件。
- 对 C-1…C-11 按详设 §5.1 的逐项 protection condition 进行包内提取；C-7a 只做 display-context local guard，不引 runtime edge。
- 每一 owner package 后运行其 focused test/typecheck；每次抽取后重读 callers，确认 error text、discriminant、listener/cleanup、JSON reject shape 不漂移。
- 本 CP 不新增 state/runtime/display root export，不更新 publicExports；若实际需要新增 root export，停止该子项并回到详设 review，不静默扩面。

## 5. CP-2：C-12 + A-1 原子单元

### 5.1 CP-2A：generic core（尚不迁 requestLedger）

1. 创建 state generic partitioned type/support files，完整实现 keys、action factory dispatch、read 和 descriptor enumeration；类型参数只允许 `K extends string`。
2. 将现有 workspace public wrappers 改为 thin adapter，但 wrapper 自己保留 `requireActionType`、最后一个 `/` 的切分与 `type` 重写；只把“选 workspace 分区并 dispatch”交给 generic core，重写逻辑放在传给 core 的 action factory 中。保持其现有 public types、MAIN/BRANCH reject message 和 descriptor-name validation。
3. 新增 state focused tests：generic arbitrary key set、factory 获得 selected key、read 返回 selected value、descriptor key/name mismatch reject；并以 `workspace.test.ts` 中“rewrites action type at the final slash and preserves action fields”和“rejects missing workspace and invalid action types”两条既有测试保持绿作为 wrapper 行为不变的硬判据。
4. 更新 state root exports 与 `publicExports` exact list；只要 wrapper declarations/name 未变，state closedUnionConsumers 和 count 不应改变。若 TypeScript declaration 实际变形，再以 checker 结果精确更新，不能猜 count。
5. 用 static dependency-direction red fixture/源码 readback 证明 state 无 runtime import，也不加入 `RuntimeInstanceMode`/`DisplayRole` 知识。

### 5.2 CP-2B：唯一 requestLedger 迁移点

1. runtime 使用 generic core 创建 MASTER/SLAVE keys、per-mode slices、registrations 和 private action map；每个 mode 的 syncIntent 在 runtime descriptor 内明写。
2. 一次将 requestLedger 的 upsert/delete/clear、current/peer lookup、dispatcher、role-change actor、cleanup actor 和 selectors 改到 final shape；不保留 payload.sliceName router 或旧 action type 常量。
3. 同批迁 runtimeInstanceMode/displayRole 到 createSlice；actor 使用最终 feature-private slice actions。
4. 同批台账：runtime manifest RTK dependency、display-context manifest RTK dependency、runtime closed-union old creator consumer 删除/count 精确重算、state generic publicExports、所有五个 package static check 重跑。
5. 同批 TR-01 red fixture：新 anchor 四种变异均真实命中；anchor 失配要 fail，不许仅把 old literal 换名。
6. 同批 test migration：old creator imports 改最终 feature-private source；补三 slice set/upsert/delete/empty-clear 行为；补 §3.4 四项 runtime semantic tests。

CP-2B 失败条件：任何一项出现 old payload slice router、state import runtime union、MASTER/SLAVE 同 syncIntent、role clear 错分区、peer 被 cleanup、root export 扩张或红夹具 anchor 静默失配，均不得进入 CP-3。

## 6. CP-3：A-2 和精确删除

1. 以 `@reduxjs/toolkit` 的 default `createSelector` 取代手写 viewCache；必须保留 requestId/current mode/local envelope/peer envelope 为 inputs，禁止 `lruMemoize` 配置。
2. focused proof：同 state 的多个 requestId 经 `selectRequestExecutionViews` 后逐一重读，view identity 仍命中；mode/local/peer 任一变更才重算。
3. 对 `createSliceSyncDiff`/`createSliceSyncSummary` 做全仓 import scan；删除其 state root export、public-surface typecheck/sync test consumer、state exact publicExports 项。保留所有其他 sync API 与 workspace tools。

## 7. CP-4：B-1 / B-1b

1. 从 slice-level `changedSlices` 细化为 descriptor-level changes，分别计算 immediate/debounced。
2. Dexter 已选择 B-1b 固定窗口（无新参数、写更频繁）；不实现 trailing + maxWait。该选择只约束 CP-4，不改变其它 CP 的授权范围。
3. 以首次 debounced deadline 为有界窗口；同一 window 的后续 debounced state 保留最新值但不延后 deadline。
4. fake timer proof：t=0 debounced、t=10 immediate、t=25 flush；错误的 restart 实现必须红。
5. fake persistence engine/module mock proof：debounced-only mutation 对 `flush('immediate')` 为零；原 slice-level 实现必须红。
6. 按 Dexter 已选择的固定窗口策略，对连续 debounced mutation 验证首 deadline 边界，并证明没有无限延迟；不实现 trailing+maxWait。

## 8. CP-5：B-4、R3、B-2 回读

### B-4

- 提取 runtime-private expired-id calculator；cleanup actor 与 lifecycle writer 复用。
- 首次写入当前 mode 的新 request 前扫描并 delete current terminal expired ids；删除 runtime interval/resource registration。
- tests：无新请求不清理、下一新请求清过期 terminal、running/peer-only 不删；peer-running 只在 `max residence` 之内保留，超过该独立 residence 边界时按既有 residence 判据验证其可清理；旧 interval test 改为“无 timer”。

### R3

- 新建 runtime-private actor invocation ancestry，只从 actor dispatch child 传入；不要把 actor key 塞进用于 depth/reset 的 commandChains。
- 删除 `executionStack` 的 reentry 职责；真实祖先 `actorKey + commandName` 才拒。
- tests：保留 D-2 的真嵌套拒绝和其他 actor 完成；新增并行 sibling child 运行且全部完成的反例。

### B-2 回读

在本 CP 再跑 root throw + pending reset case，保证 B-4/R3 改动未改变 Map cleanup/warn 的既有行为。

## 9. CP-6：B-5/B-6

- B-5：对 record key 做 per-entry validation；错误转换为已有 persistence result/failure，不让 `flushPersistence()` 因坏 key rejected。
- B-6：仅处理已由 record focused proof 证实的正确性路径；任何以降低 encode/queue/TextEncoder 成本为目的的更改都等待独立测量授权。不得把“行数减少”或静态阅读当性能证据。

## 10. CP-7：整批验证与审查入口

执行顺序（已获实施授权，按本计划执行）：

```bash
cd apps/terminal && yarn verify:static
cd apps/terminal && yarn typecheck
cd apps/terminal && yarn test
```

每项失败先保留首败、读取 owning test/log，再按相同 signal 的第二次尝试规则诊断；不得用延时、删断言、放宽 exact set 或手改生成物掩盖。

所有 CP 完成后做一次整批三维对账（整改报告、本详设、project memory/terminal standard），然后才可由 fresh independent reviewer 发起 `REVIEW_TARGET=IMPLEMENTATION`。Claude review 和 Dexter 的后续实施决定均不能被本计划替代。

## 11. 计划自评

```text
SELF_ASSESSMENT=GO_FOR_IMPLEMENTATION_AFTER_CP0_RECOVERY
IMPLEMENTATION_VERDICT=BLOCKED_AT_CP0_DETERMINISTIC_MEMORY_ROUTE
M/S/N=0/0/0
DECISION=DEXTER_SELECTED_FIXED_WINDOW
```
