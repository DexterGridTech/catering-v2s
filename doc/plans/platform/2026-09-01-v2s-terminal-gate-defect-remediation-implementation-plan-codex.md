# V2S TER 门缺陷整改与 workspace scoping 实施计划（Codex）

## 0. 状态、review cycle 与授权边界

```text
REQUIREMENTS=doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md
DESIGN=doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md
DESIGN_REVIEW_CYCLE_ID=TER_GATE_DEFECT_REMEDIATION_DESIGN_2026_09_01
NEXT_DESIGN_REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
IMPLEMENTATION_AUTHORITY=UNIT_A_ONLY
UNIT_B_AUTHORITY=false
```

本计划覆盖 D-1…D-14、D-20…D-24 与 workspace scoping；D-15…D-19 不进入任何 CP。Dexter 当前只授权单元 A（D-8、D-1…D-4）实施；单元 B 仍未授权。仓级 normal `scripts/verify`、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署始终不在本计划内。

第一轮建议“切小”按以下方式落地：

- 本次详细设计仍属于同一 DESIGN cycle，修订后只进入 ROUND=2，不因切批重置 cycle；
- 后续实施切成独立冻结的单元 A、单元 B；A 验收并完成独立 `REVIEW_TARGET=IMPLEMENTATION` 后，B 才能冻结并开始；
- 每个 CP 后的 fresh 三维对账继续保留，因为它是 `AGENTS.md` 硬约束；它不产出整单元 GO/NO-GO，也不消耗正式 review 轮次。

## 1. 两个独立实施单元

| 单元 | CP | 范围 | 单元出口 |
|---|---|---|---|
| A：下一 owner 包通路 | A1 | D-8 迁移基础 + D-1/D-2 | invariant 迁移当刻零差；kind 不再硬编码 runtime |
| A | A2 | D-3 + D-4 | 任意 owner actor 合法写；task owner/REAL 动态派生 |
| A | A3 | 单元 A 全范围对账与验收 | `NEXT_OWNER_PACKAGE_GATE_BLOCKERS=PASS` |
| B：其余能力与门 | B1 | D-5 + workspace scoping | role effect 迁移；workspace 真 store 隔离；合法 invariant delta |
| B | B2 | D-6 单独退役 | 重启行为接管后才删除 heuristic |
| B | B3 | D-7 | storage symbol 与四态行为 |
| B | B4 | D-20…D-23 | public/type/union/record 约束复用 A 的 invariant |
| B | B5 | D-9 软规范 + D-14 | 零 D-9 机制；production/test seam 隔离 |
| B | B6 | D-10…D-13 + D-24 | fail-closed census、统一 vocabulary/collector |
| B | B7 | 单元 B 全范围对账与验收 | `TER_GATE_REMEDIATION=PASS` |

D-5 不在单元 A，也不阻塞任何包；它在 B1 优先完成只是为了避免后续消费者二次迁移，并把 D-3 exception 从 6 减到 5。

## 2. CP-A1：D-8 迁移基础与 D-1/D-2

### 2.1 前置只读冻结

在任何真实写入前打印：

```text
A1_MIGRATION_INPUT tables=12 exports=312 keys=25 members=120 scalars=457
A1_CLOSED_UNION_INPUT unions=9 consumers=22
A1_DEPENDENCY_INPUT importType=15 productionImportType=10 workspaceExportFrom=0
```

这些数字只说明当前迁移输入。若与真实源码不同，先解释漂移并修订迁移输入；禁止把期待值写入新门压过当前事实。

### 2.2 D-8 首先迁移

1. CP-A0 先用 TypeChecker 逐行解析 §2.2 的 22 个 `sourceFile + declarationId + member` 绑定；绑定以当前真实声明 `DefineErrorInput`、`RequestLifecycleSnapshot` 等为准，任何不存在符号、重复解析或 union 不匹配立即 STOP；
2. 新增 `package-invariants.mjs` 与四个 package-local `terminal-invariants.json`；
3. 旧 12 表与新 invariant 同时求值，逐表双读而非只比总数；
4. 四个 checker 全部切到 owning invariant 后才删除旧表；
5. 删除一次性 `312/25/120/457` 生产断言；
6. 单侧改 root export 或 invariant 必红，双侧合法改动工具零代码改动可绿；`owned` 不计入 legacy 零差，在 A2 单独加入并对拍。

### 2.3 D-1/D-2

1. 当前真实树只有 runtime 已落 owner slice；只给 runtime 固化 `moduleKind`，第二个已落 kind 包只在 scratch 构造；
2. TypeScript helper 解析 alias、namespace、barrel 与 symbol origin；
3. graph model 只接受 `plannedKind xor realized moduleKind`；
4. runtime internal module 的 kind 解析到本包正本，不读相同文本；
5. 第二包 fixture 覆盖：realized kind、planned 并存、两者皆无、正本移位、相反注释、owner/toolkit 与 slice 冲突。

### 2.4 focused proof 与出口

- shared TS/invariant helper corpus；
- skeleton、contracts、platform-ports、state、runtime checker model/real；
- D-8 双读零差原始输出；
- D-1/D-2 每个 mutation 目标门红、其它门绿。

完成信号不携带未来硬常量：

```text
A1_INVARIANT_MIGRATION=PASS comparison=ZERO_DIFF
A1_KIND_SOURCE=PASS
```

随后 fresh 子 agent 对 D-8/D-1/D-2、TR-09 与真实 public/kind source 三维对账。

## 3. CP-A2：D-3 与 D-4

### 3.1 D-3

1. 建 terminal TS Program，以真实 dispatch 表达式的 Redux Store/EnhancedStore symbol origin 识别写入；
2. 合格 actor 同时满足 `features/actors/**` 与 actor definition 事实；
3. Unit A invariant 登记 6 项 exception：state 2、runtime dispatcher/bridge 3、request-ledger role effect 1；workspace convenience 的普通 `input.dispatch` 不登记为 exception。每一项用 `sourceFile + declarationId + dispatchExpression + reasonCategory` 固定，并由一个真实调用点恰好消费，文件级导出 wrapper 不得获得豁免；
4. test 不进入生产写入门；helper/object/multihop 进入 review checklist；
5. 非 actor alias 写入红，任意 owner 包合格 actor 写入绿。

### 3.2 D-4

1. task owner 从 batch projection 的 package scripts 派生；
2. Vitest/Jest 两个 owned runner 以真实发现与进程 exit 产生 marker，package script 不自行 echo kind；每个包 invariant 的 `owned` 与 package script、实际 marker 三方双向对拍；
3. `passWithNoTests=false` 显式化；零测试打印 `NO_TEST_FILES`；删除 runtime `test` script 或清空 runtime 测试目录都必须使 owned-kind 对拍红，而不是让 runtime 从分母消失；
4. 删除 frozen test/REAL owner、四段 kernel 身份和 lint/clean 恒空特判；verify 只读取各包 invariant 的 `owned`，并把 marker 的 `kind` 与 `package` 和该字段双向对拍；
5. 新 package、新 test owner、新 lint/clean 只改 owning package即可演进。

### 3.3 focused proof 与出口

- skeleton/runtime checker model/real；
- runtime test/typecheck；terminal test；verify marker tests；
- D-3 固定 AST corpus完整 failure vector；
- D-4 新 owner 两拍：任意 marker script 红，合法 owned runner 后工具零改动绿；删除 runtime `test` script 与清空 runtime 测试目录分别为唯一目标红。

```text
A2_TR01=PASS exceptions=6
A2_TASK_OWNERS=PASS
```

随后 fresh 子 agent 核全部九个旧写点、6 项 exception、Redux Store 类型判据、runner fact source 与 fail-closed 分支。

## 4. CP-A3：单元 A 验收

先由 fresh 子 agent 对单元 A 全范围重新建基线，不把 A1/A2 的步骤报告拼成整体验收。重点构造：第二个 owner package 落 kind、owner actor 写入、新 package/test script 演进、同步篡改 invariant 与源码等反例。

修复全部 OPEN 后运行单元 A shared helper corpus、五组 checker model/real、四个 kernel typecheck/test、TER-local `verify:static` 与 `verify`，并重跑 A 的全部 red mutations。

出口：

```text
NEXT_OWNER_PACKAGE_GATE_BLOCKERS=PASS
UNIT_A_RED_MUTATIONS=PASS
UNIT_A_LOCAL_VERIFY=PASS
```

该 marker 只证明任何“下一个 owner 包”不会再被 D-1…D-4 的 runtime/名单硬编码阻断，不指向 display-context，也不授权下一个包。单元 A 随后进入自己的 `REVIEW_TARGET=IMPLEMENTATION` cycle；未收口前不得冻结单元 B。

## 5. CP-B1：D-5 与 workspace scoping

### 5.1 单元 B baseline

从单元 A 收口后的 `terminal-invariants.json` 求值当前 public exports、union definitions、consumer bindings 与 exception；只记录当前值，不沿用迁移时的 312/20 硬常量。

### 5.2 D-5

1. effect 保留现有 `context` 入参，不构造权限 facade；effect 返回 readonly action arrays；
2. actor 逐 effect 收齐 actions，再按 effect/action 顺序 dispatch，最后写 role state；
3. request-ledger effect 返回 clear action，不再自己 dispatch；第三方 effect 在自身包直接调 `dispatchAction` 仍必须被 TR-01 判红；
4. `previousMode/nextMode` 绑定 `RuntimeInstanceMode`，invariant 记录合法 consumer `+2` delta；
5. D-3 exception 从 6 删除 role effect 一项，变成 5；保持 action 顺序 focused test。

### 5.3 workspace scoping

1. 新增纯 `createWorkspaceScopedAction`，dispatcher 唯一委托；
2. state root export 与 invariant 同 CP 记录合法 `+1` delta；
3. 10 条错误逐项断言精确 message；`toWorkspaceStateDescriptors` 接收 RTK `Slice` 并断言 `slice.name === workspaceKey`，不再检查函数刚生成的名字；
4. 真实 `createStateRuntime` + RTK store 注册 MAIN/BRANCH，两次派发只改目标 slice；
5. 只建 workspace 一轴，不新增注册检查、依赖、edge 或生产消费者；真实 store 用 `createSlice` 为 MAIN/BRANCH 生成可区分 reducer，并同时做正向隔离与反向错误写入断言。

### 5.4 focused proof

runtime/state typecheck/test、两个 checker model/real、action-order red、9 条 throw mutation、第三方 effect dispatch 回归、真实 store isolation。输出只报 delta 与当前求值，不写预设总数：

```text
B1_D5=PASS exceptionDelta=-1 consumerDelta=+2
B1_WORKSPACE=PASS publicExportDelta=+1 axes=1 errors=10
```

随后 fresh 子 agent 核 D-5 非阻塞定位、顺序语义、workspace 空真风险与当前 invariant 求值。

## 6. CP-B2：D-6 单独退役

本 CP 不与 D-4 或其它规则迁移混写。D-4 的 owned runner 已在单元 A 稳定，D-6 的行为证据只经该 runner执行。

1. scratch 同时把 instance-mode `persistIntent` 改 `never` 并删 persistence；
2. 两种独立重启行为用例必须红，且失败原因正是第二 runtime 未恢复；
3. scratch 同时停用这两类用例后 mutation 必须绿；
4. 恢复真实字节；把 field/stateKey/persistIntent 结构并入 owner-kind并补 red；
5. 最后删除 `restart-positive` heuristic，runtime rule count 5→4；
6. 真实重启行为、runtime test/typecheck/checker 全绿。

本 CP 的出口还必须复跑 A2 的 owned/marker 对拍：分别删除或停用任一 D-6 接管用例，确认只出现预期的行为失败，不把它表现为 owner 消失、marker 缺失或 D-4 任务归属失败；随后恢复两条接管用例再确认 A2 runner 关系全绿。

任何一步形状不符立即保留现役门并停机。完成信号：

```text
B2_RESTART_BEHAVIOR_TAKEOVER=PASS shapes=2 runtimeRules=4
```

随后 fresh 子 agent 重新判断退役是否净损失。

## 7. CP-B3：D-7 storage 类型与四态

state 两规则共用按 `StateStoragePort` method symbol 识别的 collector；receiver 名字只作显示，不作判据。direct discard 有限覆盖 await/naked/void/empty catch；return、赋值、具名 consumer 只说明已接住，处置语义由四态 tests 证明。

`clear` 保持 platform-ports 公开能力，state 内调用仍红。四态固定为 succeeded/failed/timed-out/unavailable。

focused proof：state typecheck/test/checker、alias+void mutation、非 StateStoragePort 同名方法正例、四态行为。完成信号 `B3_STORAGE_RESULT=PASS states=4`。随后 fresh 子 agent 逐真实调用点核失败/恢复语义。

## 8. CP-B4：D-20…D-23

复用单元 A invariant/helper，不新建第二 owner；B4 的 D-22 baseline 必须包含 §2.2 的 9/22，不能只复用旧 8/20：

1. D-20 从 root public symbols 扫 TR-05，cast 扫全 src，只增加有限相邻 const形态；
2. D-21 prefix entries order-independent，并以 factory brand type fixtures证明关联；
3. D-22 从当前 invariant 求 consumer 分母，不内置 20/22；每包 `closedUnionConsumerCount` 只拒绝删行漂移，当前每行逐一改 string 与删除任一 row 均必红；
4. D-23 从 root public symbol 解析 member/type/readonly/optional，同名诱饵不影响。

focused proof 输出当前动态分母及每个 mutation 的完整 failure vector。完成信号只用 `comparison=EXACT`，不携带 exports/consumer 固定数字。随后 fresh 子 agent 独立从源码复算而不采信 invariant 总数。

## 9. CP-B5：D-9 软规范与 D-14 seam

### 9.1 D-9

不修改 `createStateRuntime`、`StateRuntime`、`getStore/getState` 或两个同步方法，不建 companion、unique-consumer 门、负类型夹具或结构停机。

只做：

1. TR-09 写明 `createFullSyncPayload/applyAuthoritativeSync` 仅供 runtime/transport 同步基础设施消费；
2. state README/HANDOFF 同步该边界；
3. `UNENFORCEABLE_BY_MACHINE` checklist 全量列出现有及同义 wrapper 的生产调用点；
4. 其它业务包直接消费由独立 review 报 finding；`getStore/getState` 明确不计违规。

D-9 没有 machine PASS 或 red mutation，不能把 public exact-set 绿冒充可见性已受控。

### 9.2 D-14

抽 `createRuntimeCore`；生产 `createRuntime` 不导入 testing、不注 hooks；testing factory 注 release/sync test seam；生产 import closure 不可达 `src/testing/**`。普通 behavior tests继续用 root factory。

focused proof：runtime typecheck/test/checker、production import closure red、TER-local export 后 test seam symbol 零命中。完成信号：

```text
B5_D9_REVIEW_BOUNDARY=RECORDED machineEnforcement=NONE
B5_PRODUCTION_TEST_SEAM=PASS
```

随后 fresh 子 agent 手读 D-9 全量调用点与 D-14 production closure。

## 10. CP-B6：D-10…D-13 与 D-24

1. 先实现五类语法统一 collector；三个既有依赖 consumer 改复用，保留旧真阳性；不实施 D-16；
2. D-10 assembly root 与四类 silent drop 全部 fail closed；
3. D-11 package-root vocabulary unknown fail closed；
4. D-12 vocabulary×AST shape 固定 corpus；
5. D-13 legacy policy、动态 denominator、三段 census、batch projection。

D-13b 必须展示：graph-only 红；graph+package identity 合法增删且 tools/tests 零代码改动绿。D-24 展示五类语法、type-only 分类及 15/10/0 当前输出；未来 D-16 只能消费 `collectWorkspaceDependencyEdges`。

focused proof：四个 shared helper corpus、五组 checker model/real、D-10…D-13/D-24 定向 red。完成信号 `B6_SHARED_ANALYSIS=PASS referenceSyntaxKinds=5`。随后 fresh 子 agent 核无第二 parser、unknown 分类与 D-16 未提前实施。

## 11. CP-B7：单元 B 验收

先做 fresh 全范围三维对账，重点构造：D-5 合法 delta 后仍期待 20、workspace 合法 export 后仍期待 312、D-6 被 D-4 runner 变化误红、D-9 用 exact-set 冒充软规范、D-22 只保 8/33 unions 即宣称全 closed-union、D-24 第二 parser 等反例。尚未交付的第一轮完整 findings 到达后，须在本 cycle ROUND=2 前逐条 intake，不在本计划中预判结论。

全部 OPEN 修复后，运行 shared corpora、五组 checker model/real、四个 kernel typecheck/test、TER-local `verify:static` 与 `verify`、所有 machine-enforceable red mutations；D-9 单独出 fresh 语义 review checklist，不伪造 red。

```text
TER_GATE_REMEDIATION_STATIC=PASS
TER_GATE_REMEDIATION_BEHAVIOR=PASS
TER_GATE_REMEDIATION_RED_MUTATIONS=PASS
TER_GATE_REMEDIATION_REVIEW_ONLY_CHECKS=PASS
TER_GATE_REMEDIATION_LOCAL_VERIFY=PASS
```

单元 B 随后进入独立 `REVIEW_TARGET=IMPLEMENTATION` cycle。以上均不证明 native、设备、adapter 或用户 Journey。

## 12. 通用执行纪律与停机条件

每个 CP 开始前重开需求条目、详设、六维路由记忆、规范与 owning source；focused proof 后用同组材料回读。每个 CP 后 fresh 子 agent 对当前 CP 做三维证伪式对账；每个单元整体验收前另做全范围对账。步骤对账不产出 GO/NO-GO。

以下任一情况停机，不用 fallback、放宽 exact-set 或删测试继续：

- invariant 迁移当刻不能逐表双读零差；
- 单元 B 仍依赖迁移时绝对数而非当前 invariant；
- owned runner 无稳定 test discovery/exit 事实；
- D-5 effect 真实依赖前一 effect 已写 state；
- D-6 mutation 不能只由两种重启行为证伪；
- D-24 出现非字面量模块加载或三个 consumer 无法共享 collector；
- 需要新依赖、新 package、新 graph edge、新端口、新 public capability或实施 D-15…D-19；
- machine red 不定向、真实树不绿或共享 helper 改变非目标规则；
- 需要仓级 normal verify、native、设备、DEV、seed、reset、browser L2、UAT、deploy。

## 13. 当前文档交付条件

本计划已完成同一 `TER_GATE_DEFECT_REMEDIATION_DESIGN_2026_09_01` cycle 的 ROUND=2 定向复核。Dexter 已授权单元 A 实施；单元 B 仍未授权，所有 B marker 只是未来执行协议，不是已取得证据。
