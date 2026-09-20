# TER feature 端主副屏状态与命令归属评估 · review

- 评审人:Claude｜日期:2026-09-18
- 对象:`doc/review/platform/2026-09-18-ter-feature-topology-ownership-evaluation-codex.md`(328 行)及其规范落点与当前源码事实
- 方式:**先独立回源核验,再对照报告结论**;POC 机制亲自读过

## 0. 结论

```
VERDICT=GO
M/S/N=0/1/2
```

**报告的三条 Major 我逐条独立复核,全部成立**;`NO-GO` 的定性正确,可作为整改基础。我的 1 条 Significant 是**修法方向**问题(照字面执行会过度设计),2 条 Note 是根因精度与我的覆盖边界。

⚠️ 本轮只读,零写入(本文件除外);未运行任何构建、测试、gradle、设备或网络动作。**不代表 Android、Web、release 或 acceptance PASS。**

## 1. 先把原则本身读准

Dexter 在本轮评审过程中给出了**更利落的正式表述**(原话):

> **MAIN 只能主机的 actor 执行 command 写入 slice。BRANCH 只能副机的 actor 执行 command 写入 slice。**

这不是"内容怎么到副屏"的机制描述,而是一条**按 workspace 的写入归属规则**。它比"主机 actor 写 MAIN 的 SECONDARY 段、state 驱动副屏"更强也更好用,因为:

- 它把合规性变成**单一可判定命题**:每一次内容 slice 写入,`workspace` 与执行方的 `instanceMode` 必须配对(MAIN↔MASTER、BRANCH↔SLAVE);
- 投影方向由它自然导出:MAIN 主→副(副机只读不写)、BRANCH 副→主(主机只读不写);
- 它可以**机械设门**,不必依赖逐 feature 的人工约定(见 §3 S-1)。

⚠️ **一个必须先澄清的界定**:本原则**不是**在说 TER 的写入机制本身不对。`showScreenCommand`(`ui-state/src/features/commands/showScreen.ts:14`)→ actor(`contentActors.ts:232`)→ `contentActions.showScreen(payload)` 写的确实是 **workspace 内容 slice 的对应 displayMode 段**,`dispatchContentAction`(`:220`)按 `currentWorkspace(context)` 取片。⇒ **单机双屏本来就合规**;偏差**只在跨机那一段**:谁在写。这个界定把整改面从"重做 feature 层"收窄到"管住写入归属 + 补跨机投影"。

**一个必须先澄清的事实,报告没有明说**:单机双屏**本来就合规**。`showScreenCommand`(`ui-state/src/features/commands/showScreen.ts:14`)→ actor(`contentActors.ts:232`)→ `contentActions.showScreen(payload)`,写的是 **MAIN workspace 内容 slice 的对应 displayMode 段**,再由 state 驱动两个 surface。所以偏差**不在"写不写 state"**,而**只在跨机那一段**。这个界定很重要:它把整改面从"重做 feature 层"收窄到"补跨机投影"。

## 2. 三条 Major 的独立复核

### 2.1 M-1 双机 secondary 靠命令而非 state 投影 —— **CONFIRMED**

我亲验的源码事实:

- `topology/src/foundations/resolveCommandTarget.ts:30-37`:`displayMode === 'SECONDARY'` 且 `MASTER` 且 `paired` 且 `displayCount` 为 `null` 或 `1` 时 **`return 'peer'`** ⇒ 命令被派给副机,由**副机**执行 `showScreen` 并写**它自己**的内容 slice。
- `ui-state/src/foundations/workspaceSlices.ts` 的 `createContentDescriptor` 对 MAIN 与 BRANCH 内容 descriptor 一律 `syncIntent: 'isolated'` ⇒ **内容 slice 从未被声明为跨机投影源**。
- `topology/src/application/createTopologyStateSyncController.ts` 只有 `sendMembersSnapshot`,slice 名硬编码为 members ⇒ 没有 feature 内容的投影通道。

**按 Dexter 的表述,违规形状可以说得更精确**(以下链条我逐环读过):

- `display-context/src/foundations/displayDerivation.ts:11-14` `resolveWorkspace`:`SLAVE && CHIEF → 'BRANCH'`,**其余一律 `'MAIN'`**;
- ⇒ 已配对副机处于 **VICE**(双机副屏的正常态)时,`currentWorkspace` = **`MAIN`**;
- `contentActors.ts:220-223` `dispatchContentAction` 按 `currentWorkspace(context)` 选片并写入;
- ⇒ `resolveCommandTarget` 把 SECONDARY 的 `showScreen` 派给 `'peer'` 后,**副机的 actor 执行命令,写的是副机的 `MAIN` 内容 slice**。

⇒ **这是"MAIN 只能主机的 actor 写"的直接违反**,不是"机制不够优雅"。主机与副机各写各的 MAIN,**两个独立事实源**;重连、恢复、主机内容变更后无权威 state 可投影,画面会漂移。**报告定性正确,且按新表述其性质比报告所写更硬。**

**POC 对照(我亲自读过,不采信转述)**

`newPOSv1/1-kernel/1.1-base/ui-runtime-v2/src/features/slices/screenState.ts:77-79`:

```
syncIntent: {
    main: 'master-to-slave',
    branch: 'slave-to-master',
}
```

live spec `ui-runtime-v2-live-screen-master-to-slave.spec.ts:11` 的用例名是 "syncs current screen from master to slave through real dual-topology host flow",断言落在 `syncedScreenState?.[containerKey]?.value` —— **同步的是屏幕状态本身**,不是"派一条 show 命令过去"。

⇒ POC 把 Dexter 这条原则**直接表达成按 workspace 的 slice 同步意图**,并有 live 证据。TER 缺的正是这一层。

### 2.2 M-2 wallpaper 用物理屏数阻断远端副屏 —— **CONFIRMED**

- `ui/integration/sample-wallpaper-console/src/features/actors/actors.ts:29` 用 `resolveSecondarySurfaceAvailable(displayInfo)` —— **物理**显示信息。
- 而 `topology/src/foundations/evaluateTopologyOperation.ts:49-55` 已提供拓扑判据 `hasTopologySecondarySurface`,其第二个分支 `(instanceMode === 'MASTER' && paired)` 正是为"单屏已配对主机"设的。

⇒ 单屏已配对主机跑 wallpaper 时,物理判据为假,远端副屏被挡。**报告定性正确**,且与需求正本里"物理副屏可用性"与"拓扑副屏判据"必须分开的裁定一致。

⚠️ 顺带发现一处**两个 integration 不一致**:`sample-member-desk` 用的是自己的 `hasSecondarySurface`(见 §3.1),wallpaper 用的是物理 helper —— 同一语义三种实现,整改时应一并归一。

### 2.3 M-3 副机切 PRIMARY/BRANCH 后命令仍可能回主机 —— **CONFIRMED(机制部分)**

`resolveCommandTarget.ts:27-29`:

```
if (input.routeIntent === 'peer-intent') {
  return facts.instanceMode === 'SLAVE' && facts.paired ? 'peer' : undefined
}
```

**只查 `SLAVE && paired`,完全不看 `displayMode`、workspace 或操作 owner。** ⇒ 副机已切到 PRIMARY(推导为 BRANCH)后,带 `peer-intent` 的本地操作仍会被送回主机,直接违反 Dexter 第四句。**机制层面报告正确。**

⚠️ 报告的 parts 层断言(sample feature 无 production BRANCH 业务 part)我**未复跑全树扫描**,见 §4 N-2。

## 3. Significant

### S-1 M-1 的修法方向照字面执行会过度设计 —— TER 已经有 POC 同款的词汇与结构

```
状态=CONFIRMED
严重度=S
owning source=报告 §5 M-1 的"建议的最小收口"
需 Dexter 裁决=否(属技术选型,但影响整改规模)
```

**报告写的是**:"先为参与双机副屏的 feature 明确 MAIN secondary content 的 **projection descriptor 与 owner actor**"。这读起来是**逐 feature**新建投影契约。

**但我回源发现整改面可能小得多**:

- `kernel/base/state/src/types/sync.ts:4-7` 的 `SyncIntent` **已经是** `'isolated' | 'master-to-slave' | 'slave-to-master'` —— **与 POC 用的三个值完全一致**,不需要新造词汇。
- `kernel/base/state/src/types/slice.ts:38` 已约定非 `isolated` 的 descriptor 必须带 `sync`(`getEntries`/`applyEntries`),机制齐备;`sample-member-registry` 已在用 `'master-to-slave'`,即**这条通道是通的、有在跑的先例**。
- TER 的内容 slice 结构与 POC **同构**:`workspaceSlices.ts:244-246` 建 canonical / MAIN / BRANCH 三个 content slice,`:574-588` 经 `toWorkspaceStateDescriptors` 注册 MAIN 与 BRANCH。

⇒ 结构上,**MAIN 的 content descriptor 声明 `'master-to-slave'`、BRANCH 声明 `'slave-to-master'`,并为内容 state 提供 `sync` 描述** —— 就是 POC 的做法,而且是在**已有 workspace 分片**上做,不需要逐 feature 的投影契约。

**反例(照报告字面执行会怎么落空)**:实施方为每个参与双机副屏的 feature 各建一套 projection descriptor 与 owner actor ⇒ 契约数量随 feature 增长、topology base 继续膨胀(正是报告 S-3 自己反对的方向),而 workspace 层本来一处就能覆盖全部 feature。

**最小修复(两件,都在 base 层,不逐 feature)**:

1. **写入归属设门**。Dexter 的表述可以直接落成不变量,而且落点只有**一处**:`contentActors.ts:220-223` 的 `dispatchContentAction` 同时握有 `workspace` 与 `context.getState()`。在该 seam 上断言 `workspace === 'MAIN' ⇒ instanceMode === 'MASTER'`、`workspace === 'BRANCH' ⇒ instanceMode === 'SLAVE'`,违反即 fail closed。⇒ 这条门**一次覆盖所有 feature**,并且能把 M-1 与 N-1 的两条违规路径同时逮住,**不需要逐 feature 审人工约定**。
2. **补跨机投影**。在内容 workspace descriptor 层定投影意图(MAIN→`master-to-slave`、BRANCH→`slave-to-master`),feature 层只保留"主机 actor 写 MAIN 的 SECONDARY 段"这一既有行为。仅当某 feature 确有 workspace 层无法表达的投影需求时,才升级为 feature 级契约并说明理由。

⚠️ 两件有顺序:**先设门会让当前 sample 立刻变红**(副机正在写 MAIN),所以门与投影要同批落,否则副屏会从"画面会漂移"退化成"画面不出来"。

⚠️ **未验**:内容 state 的 `getEntries`/`applyEntries` 具体如何写(尤其 layers/variables 的合并语义与 `replaceMissing` 取舍),以及 BRANCH 反向投影是否会与现有 hydrate 冲突 —— 这些属详设,本轮不判。

## 4. Notes

### N-1 M-1 的根因可以更精确:副机自建事实的具体成因是一行刻意的 fallback

报告 M-1 引 `sample-member-desk/src/features/actors/actors.ts:141-183` 说"事件后本地重放"。我把链路走完,成因更具体:

- `actors.ts:60-68` 的 `hasSecondarySurface`:先看 `facts?.hasTopologySecondarySurface === true`,**否则 `return facts?.paired === true`**;
- 注释明写这是刻意的 slave-local 映射:"A paired single-screen slave renders the customer surface on its own physical display…";
- `createTopologyModule.ts:266-267` 的 `markPeerAccepted` 在 `:351`/`:373`/`:383` 三处被调用,**两侧都会派 `peer-accepted`**;
- ⇒ 副机收到 `peer-accepted` 时,`paired === true` 使该 fallback 返回 true,副机遂**本地执行** `show({displayMode: secondary, partKey: 'sample.desk.customer-welcome'})`。

⇒ 第二事实源的开关就是 `:68` 这一行,**而且它是有意为之并写了理由**。按 Dexter 的表述,它的性质是:**副机 actor 自发写 MAIN**,与 M-1 的"主机把命令派过来让副机写 MAIN"是同一条规则的两种违反路径。

整改时不能当成"删掉一行重放代码",必须**正面替换掉那条 slave-local 映射的设计意图**(单屏副机把自己的物理屏映射为 SECONDARY 逻辑面),否则会把副机的"我该显示顾客面"这件事变成无人负责 —— 正确的归属应是:主机写 MAIN 的 SECONDARY 段,副机**投影后渲染**,副机自己不参与决定。建议报告把这一行补进 M-1 的仓内事实清单。

### N-2 我的覆盖边界(如实声明)

- **已亲验**:`resolveCommandTarget.ts` 全文;`workspaceSlices.ts` 的 content slice 建立与 descriptor 注册段;`contentActors.ts:225-240`;`showScreen.ts:14-20`;`createTopologyStateSyncController.ts`;`evaluateTopologyOperation.ts:49-55`;`sample-member-desk/actors.ts:60-68`、`:110`、`:141-168`;`sample-wallpaper-console/actors.ts:5,29`;`state/src/types/sync.ts`、`slice.ts:34-52`;POC 的 `screenState.ts:72-99` 与两个 live spec 的用例名与断言行。
- **未复跑**:报告 §5 M-3 声称的"全树扫描所有 terminal UI part 声明,BRANCH 命中只在 admin-shell 与 sample-console fixture" —— 我只 spot-verify 了 resolver 机制,**未独立重跑该扫描**,故对 parts 层结论**不背书也不否定**。
- **未读**:报告 §8 同根扫描、§9 收口顺序、§11 自审留痕三节未逐行核。

## 5. 证据分档(严格分开,未混写)

- `static` = **已完成**。本文全部结论均为静态源码与 POC 源码核验。
- `focused` = **本评审未运行**。报告 N-2 自陈 member-desk focused test 公共面先验失败且尚未重跑 —— 该状态我**未复核**,按其自陈保留为未完成。
- `native/Android`、`device` = **本轮不涉及,未宣称**。M-1/M-2/M-3 的运行期表现按报告标注仍为 `UNVERIFIED_REQUIRES_EVIDENCE`,我同意该档位。
- `Web` = **不适用**。
- `visual/release` = **不适用,未宣称**。
- `cleanup` = **本轮不涉及**。

## 6. 授权边界

本评审只读,仅针对该评估报告、规范落点与当前源码事实。不授权修改源码、测试、脚本、依赖、构建产物或运行环境;不扩大双机拓扑范围;不改变既有裁决。**GO 表示该报告可作为整改基础**,并不表示报告所列偏差已修复,也不构成 Android、Web、release 或 acceptance PASS。§3 的 S-1 建议在进入详设前先裁定修法层级,以免整改规模被放大。
