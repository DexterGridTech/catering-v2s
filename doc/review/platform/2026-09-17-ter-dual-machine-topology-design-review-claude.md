# TER 双机拓扑 · DESIGN review(详设 + 实施计划)

- 评审人:Claude｜日期:2026-09-17
- REVIEW_TARGET=DESIGN
- 评审对象:
  - `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md`
  - `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md`
- 需求正本:`doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md`

## 0. 结论

```
VERDICT=NO-GO
M/S/N=2/4/2
```

NO-GO 的两条 Major 分别是**未声明的跨批次范围并入**(需 Dexter 裁决)与**验证夹具建立在源码中不存在的状态名上**。其余为可由详设自行闭合的项。

⚠️ **本评审的独立性边界**:需求正本由本评审人(Claude)撰写,**因此本文对需求稿本身的判断不是独立评审**。其中 S-3 是需求稿自身的缺陷,owning source 在我方,已如实记录而非记在详设账上。对详设与实施计划的评审是独立的。

⚠️ 本轮只读。未运行任何构建、测试、Android、设备、Web、DEV 或部署动作;无动态、native、visual、cleanup evidence。DESIGN review 的 GO/NO-GO 不等于 implementation acceptance。

## 1. 先记录做得对的部分

以下是我在需求稿里反复标为高风险、而详设确实接住的点,**实施时不要因本文的 findings 而动摇它们**:

- **D-17 正交性**:`secondary = 物理双屏 ∨ (MASTER ∧ paired)`,**明确不含 reachable**;12 个调用点全切;既有 `resolveSecondarySurfaceAvailable` 物理语义与四个测试原样保留。与需求一致。
- **D-19 边界层**:策略落在 UI 与 actor 共同汇入的 runtime dispatch boundary,按每次 payload 求值而非静态命令名单,并明确 **receiver 丢弃入站 target/routeContext、以 origin=peer 标记执行 local** 以防回环。这正是需求 R-9a 的形态。
- **D-21 字段级**:§10.2 给出 framing 字段约束、HTTP identity 形状、八类 WS frame 的必填字段、`sliceName` 只允许 members、未知字段 fail closed。达到"可执行契约"的门槛。
- **U-7 因果性**:runner **不持有 `TopologyHostPort.start`**,host 必须经 enable actor 链路起来;red 包含"fixture 直接 port.start"与"单进程假双机"。这条我在需求评审里被 Codex 指出过"禁令不是 oracle",详设此处是按因果写的。
- **双设备执行体**:§11.1 与计划 CP-5 要求两个真实 emulator/device 进程、run-scoped manifest、business 与 cleanup 分离、不按端口猜进程。
- **三层对账**:步骤级三维、全批三维、逐代码与详设对账,并明确三者不可互替、动态结果不能把前置 OPEN 改成 MATCHED。

## 2. Major findings

### M-1 未声明的跨批次范围并入(R-10a / R-10b / 就绪与内容失败改造)

```
状态=CONFIRMED
严重度=M
处置=DEXTER_DECISION
```

**仓内事实**

- 需求正本中 `R-10a`、`R-10b` **零命中**;`contentFailure` / `ScreenReadyBoundary` / `readyPartKey` / 「内容失败」**零命中**;catalog「冲突检测 / pre-filter / 机型相交」**零命中**。
- 详设头部 `JOURNEY_REFS` 只列 `R-1..R-14, R-2a, R-5a, R-9a, U-1..U-22`,**不含 R-10a/R-10b**,但正文与计划多处以它们为执行步骤(详设 §2 CP-3、计划 §3.1、§4.4 第 7 步、§4.5 第 7 步)。
- 两份文档搜 `screen-part` / `form-resolution` / `sample-infrastructure` / `uplift` / `2026-09-16` / `2026-09-14` **零命中** ⇒ **借用来源未在任何位置声明**(此为对本 finding 的证伪尝试,未能证伪)。
- R-10a/R-10b 的 owning source 是另一批:`doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md` 第 461、465、466 行。该稿第 465 行明写「之后再进 **admin 重排批(R-10b 至 R-14)**」,第 466 行明写「admin 重排批不得在机制批零回归未证前开工」。
- **R-10a 已实现**:`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-implementation-review-handoff-codex.md` 头部 `IMPLEMENTATION_STATUS=IMPLEMENTED_PENDING_DEXTER_CLAUDE_REVIEW`、`CODE_DESIGN_RECONCILIATION=MATCHED`;`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp4-execution-codex.md` 第 5 行 `STEP=A-4 R-10a admin declaration split with same-component siblings`,第 103 行有对应 red fixture。
- 就绪/内容失败主题的 owning source 是 `2026-09-14-v2s-terminal-sample-infrastructure-uplift-*`。

**反例**

实施方按计划 §4.4 第 7 步再做一次「admin 四条 part 声明拆分」。该拆分在 screen-part 批已落地,重做要么与既有实现冲突,要么在"证明拆分前后行为逐字不变"时把**已经拆过的**条目当作未拆基线,零回归证明自我架空。同时 CP-4 的 R-10b 组件分化会绕过 owning 批次「admin 重排批不得在机制批零回归未证前开工」的门槛。

**为什么这是 Major 而不是 Note**

它同时触碰三条边界:① 超出 Dexter 本轮授权("按需求稿完成详设与实施计划");② 违反计划自身 §2「未在详设第 9/13 节对账表出现的生产落点都是 scope drift」;③ 绕过另一批次自带的开工门控。且它显著放大本批体量,而体量正是 Dexter 关注点。

**最小处置**

不是把这些内容写得更细,而是**从本批详设与计划中移除 R-10a/R-10b 与 §12 就绪改造**,改为**声明式依赖**(例如「本批假定 screen-part 批的 R-10a 已落地;若未落地则本批 CP-4 阻塞」)。是否合并批次属范围裁决,**须 Dexter 决定**,详设不得自行并入。

### M-2 D-18 / U-14 的夹具断言建立在源码中不存在的状态名上

```
状态=CONFIRMED
严重度=M
处置=详设与计划自行修正
```

**仓内事实**

- 详设 §0.3 称「requestLedger ... 现有生命周期包含 registered、dispatched、accepted、started、completed/error 等本地事实」;计划 §4.4 第 6 步要求夹具「断言副机本地 lifecycle 有 registered/dispatched/accepted/started/completed/error 记录」。
- 实际取值(当前源码):
  - `apps/terminal/kernel/base/contracts/src/types/request.ts` 第 12-17 行:`RequestLifecycleStatus = 'started' | 'completed' | 'partial-failed' | 'timed-out' | 'error'`
  - `apps/terminal/kernel/base/runtime/src/types/execution.ts` 第 34-39 行:`CommandAggregateStatus = 'running' | 'completed' | 'partial-failed' | 'timed-out' | 'error'`
- ⇒ `registered`、`dispatched`、`accepted` **不在任一 union**;`partial-failed`、`timed-out` **被详设遗漏**。

**反例**

实施方按计划写 D-18 夹具,断言 `registered/dispatched/accepted` 存在 ⇒ 夹具无法通过。此时最省事的"修复"是**往 `kernel/base/contracts` 的 union 里加状态以迎合文档**——那是为了让文档成立而改动跨包契约,属静默契约回归,且不会被本批任何 red mutation 捕获。

**核验方式**

```
rg -n "export type RequestLifecycleStatus" -A6 apps/terminal/kernel/base/contracts/src
rg -n "export type CommandAggregateStatus" -A6 apps/terminal/kernel/base/runtime/src/types/execution.ts
```

**最小处置**

按上述两个 union 的**真实取值**重写 §0.3 的事实陈述与 CP-3 第 6 步的断言集合,并把 `partial-failed`、`timed-out` 纳入 peer 命令的本地生命周期断言(超时路径正是跨机命令最容易出问题的分支)。**不得反向修改 contracts 的 union。**

⚠️ 附带事实(不另记 finding,但实施方须知):`apps/terminal/kernel/base/runtime/src/features/slices/requestLedger.ts` 第 159-160 行当前是 `persistIntent: 'never'`、`syncIntent: mode === 'MASTER' ? 'master-to-slave' : 'slave-to-master'`。即该切片**今天已声明跨机方向**,D-18 改为 topology-local 是一次**既有声明的变更**而非新增,详设 §13 已提及,实施时须有对应 red。

## 3. Significant findings

### S-1 D-16 的 evaluator 同时返回裁决与原始事实,留下"自行重组"的入口

```
状态=CONFIRMED
严重度=S
```

计划 §4.2 第 2 步:evaluator 返回 `allowed、reason、paired、reachable、hasTopologySecondarySurface`。

需求 D-16 明令三个消费方(准入门、`enableSlave` 可用性、tab 内置灰与文案)**只能读本函数的输出,不得各自重新组合布尔条件**。把 `paired`/`reachable` 与裁决一并交出,等于把重组材料递到消费方手上。

**反例**:admin section 拿到 `paired && reachable` 自行推导"开服务"可用性,绕开 operation 维度。三处口径漂移,而 evaluator 的 focused test 全绿——因为没有任何判据禁止消费方这样做。

**最小处置**:operation 调用只返回 `{allowed, reason}`;拓扑事实若必须暴露(状态展示需要),走**独立只读 selector**,并在 CP-4 的 red 中加入"UI 用 facts 自算可用性"这一变异。

### S-2 详设 §9 的 D-1 / D-2 两行答非所问(可追溯性)

```
状态=CONFIRMED
严重度=S
```

需求 D-1 = 拓扑 tab 的**可用性呈现**(第 589 行);D-2 = **主机身份**的字段、端点路径与形状、连接前确认(第 590 行)。

详设 §9 的 D-1 行写的是「完整 declarations 先冲突检测后过滤 / createUiCatalog 公开导出」,D-2 行写的是「category/content、system、transition 的 discriminated outcome / runtime-unavailable 拆分」——两者都是**另一批**的题(与 M-1 同源)。

**内容上并非缺失**:D-1 的真实答案散在 §8.2 与 §8.4,D-2 的真实答案在 §10.2 的 `GET /terminal-topology/status`。问题在**对账表错位**。

**反例**:计划 §6 的逐代码对账按 D 编号逐行核。核到 D-1/D-2 时,核的是另一批的属性,两行被判 MATCHED,而需求真正的 D-1/D-2 无人对账。

**最小处置**:把 §9 的 D-1/D-2 两行改为指向 §8.2/§8.4 与 §10.2 的真实答案。

### S-3 DR-02 的副屏分母冲突 —— owning source 在需求稿(我方)

```
状态=CONFIRMED
严重度=S
处置=DEXTER_DECISION
```

详设 DR-02 指出:需求稿只列了 `sample-terminal` 的两个副屏 part,而 `sample-wallpaper-console` 另有两个,为让两个 app 都能作副机,allowlist 取四项。

**我已回源码核实,详设的事实是对的**:`apps/terminal/ui/integration/sample-wallpaper-console/src/parts/parts.ts` 第 12、15 行 `sample.wallpaper-console.waiting` + `displayModes: secondary`;第 25、28 行 `sample.wallpaper-console.welcome` + `displayModes: secondary`。

⚠️ **这是需求稿的缺陷,不是详设的**:需求 R-5 与 D-3 依〔等价性裁定〕把同步集合与白名单"推导"出来时,只对 `sample-terminal` 逐 part 亲验,**未覆盖第二个 app**,而裁决⑦ 要求两个 app 都跑通。详设没有静默缩减第二个 app 的真实副屏,而是显式记为 OPEN 并交 Dexter——**这是正确处理**。

**待 Dexter 裁决**:第一版副屏分母是四项(两个 app 各两项),还是只含 `sample-terminal` 两项、`sample-wallpaper-terminal` 本批不作副机?

### S-4 固定端口 43172 没有被占用时的行为

```
状态=CONFIRMED
严重度=S
```

详设 §9 D-4 与 §10.3 把端口固定为 43172(裁决② 只输 IP 要求端口是常量,方向正确),并把"端口政策"列入 CP-0 核对。但**没有定义端口被占用时的行为**:§8.4 只有一条 `TOPOLOGY_HOST_FAILED`「服务未能按当前设置启动」。

**反例**:设备上 43172 被其他应用占用 ⇒ `topologyHost.start()` 失败 ⇒ 管理员只看到通用失败文案,既无法判断原因,也没有任何可执行的下一步;而 U-7 只验"起得来",这条路径不会变红。

**最小处置**:为端口占用定义独立 typed reason 与可读指引;或允许一个受控回退区间并把实际端口回写进 identity/locator(后者代价更大,需论证)。

## 4. Notes

### N-1 计划 §4.4 第 4 步是"确认动作",不是可证伪判据

「确认 screen migration 所有 showScreen/openLayer/clearLayers 的 actor 路径都进入同一 boundary」——这是一条要求实施方去看的指令,不是执行体能判红的观察。与我在需求评审中被指出的 U-7「禁令不是 oracle」同类。

建议改为可观察形式:对三条命令各注入一次"只经 render 边界"的变异,断言 CP-3 的 red 能捕获。

### N-2 视觉档位的 OPEN 是诚实的,但 U-9/U-10/U-13/U-18/U-19 的结论全部压在尚未存在的 runner 上

§11 把这些标为 `visual/OPEN`、`native/Android/OPEN`,§15 与计划 §9 也没有把设计描述升格为 PASS。**这一点处理正确**,记为 Note 仅为提示 Dexter:本批的"行为一致"结论在 CP-5 之前没有任何可交付证据,时间风险集中在最后一个 CP。

## 5. 需 Dexter 裁决

1. **M-1**:是否允许把 screen-part 批的 R-10a/R-10b 与 sample-infrastructure-uplift 批的就绪改造并入本批?若不允许,详设与计划须移除并改为依赖声明。
2. **S-3**:第一版副屏分母是四项(两个 app 各两项),还是只含 `sample-terminal` 两项?

## 6. 授权边界

本评审只读,只针对上述两份文档与需求正本,并回当前源码核对 owning source。不授权修改源码、测试、脚本、依赖或构建产物;不授权实施、构建、Android、设备、Web、DEV、seed、UAT、部署或仓库控制动作。**DESIGN review 的结论不构成 implementation、runtime、visual、Android 或 release 的任何 PASS。**
