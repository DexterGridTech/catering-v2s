# TER React UI selector 订阅性能优化 · 详设与实施计划评审

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN + PLAN;Codex 与 Claude 经 Dexter 中转的 review
reviewerKind=CLAUDE_DIRECT(按项目记忆"分析类任务主 agent 自己做,不派子 agent")
EVIDENCE_TIER=static;只读源码与文档,**未执行任何命令**——没有跑 typecheck、test、static、
  Web、Metro、Android、设备或部署。跑验证是 Codex 的职责
被审输入:
  详设 doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md(411 行)
  计划 doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-plan-codex.md(285 行)
  Codex 侧独立审查 doc/review/platform/2026-09-17-ter-selector-subscription-performance-independent-review-codex.md(150 行)
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`doc/`、`tools/`、`node_modules/` 从仓库根写。

## 0. 结论

```text
VERDICT=NO-GO
M/S/N=1/3/3
DEXTER_DECISION=M-1 的收口方式建议由 Dexter 选(补基线 / 改口径),其余不需要裁决
GO 只会表示详设与计划可交 Dexter 决定是否进入实施;不构成 implementation、性能或任何运行档位的 PASS
```

**机制判断是对的,分母是准的,依赖可行性成立。** 唯一的 Major 不是"方案不对",而是"问题的存在性没有被证明,而文档自己在 §0.1 给这个前提打了折扣"——在此之上删除一个公共 hook、引入包内第一个第三方运行依赖、新立一条框架规范并迁移七处,论证链缺了最底下那一环。

## 1. 我自己核过的字节

按纪律,先从源码独立推导问题与方案,再读作者结论。以下是我自己重算的,不采信文档清单。

**机制事实成立**:`hooks/useRenderSnapshot.ts:7-11` 以 `stateSource.subscribe` + `snapshotReader.getSnapshot` 订阅;`foundations/createRenderSnapshotReader.ts:31-34` 按 root 引用缓存快照。因此 root 一换引用就产生新快照,所有订阅者重渲染。`hooks/useUiStateSelector.ts:16` 是**先**调 `useRenderSnapshot()` **再**缓存计算结果——它位于重渲染的下游,结构上不可能阻止重渲染。详设 §0.1 对机制的描述与源码一致。

**分母与文档逐项吻合**(我用 `rg` 重算,排除 test):

- 直接 `useRenderSnapshot` 生产调用点正好是五个组件 + 两个共享 hook:`components/ScreenContainer.tsx:33`、`components/LayerStack.tsx:107`、`ui/base/admin-shell/src/components/AdminShellLaptop.tsx:46`、`AdminShellMobile.tsx:33`、`AdminLauncher.tsx:68`、`hooks/useUiVariable.ts:13`、`hooks/useUiStateSelector.ts:16`,另加 `src/index.ts:72` 的公共导出与其自身定义。与 §0.1 一致。
- 既有 `useUiStateSelector` caller 八处:MemberForm、WaitingConfirm、MemberList、CustomerMember、WallpaperBackground、WallpaperPicker(两处)、SurfaceRoot、`hooks/useRequest.ts`。与 §6 末段列举一致。

**M-3 的 escape hatch 不是假想,今天就在生产里用着**:`contexts/RenderContext.ts:10` 把 `stateSource` 放在公共上下文;`AdminShellLaptop.tsx:44` 直接解构它、`:78-79` 当 prop 下传;`AdminShellMobile.tsx:31,62-63` 同形;`types/adminSection.ts:10-11` 把 `stateRoot`/`stateSource` 写进 section 契约;`sections/RuntimeSection.tsx:8` 是 `context.stateSource.getStatus()`,`sections/DisplayContextSection.tsx:9-10` 直接对 `context.stateRoot` 跑 owner selector。所以只删 `useRenderSnapshot` 确实封不住口,public/private context 分离的处置方向正确。

**依赖可行性成立**:`node_modules/use-sync-external-store` 为 `1.6.0`,`exports` 含 `./with-selector`,`peerDependencies.react` 覆盖 `^19.0.0`(本仓 React 为 `19.2.3`),`@types/use-sync-external-store` 与 `react-redux` 均已安装。S-1 关于类型现由 `react-redux` 传递带入、应改为 render 包 direct devDependency 的判断成立。

**"扩展现有门"属实**:`tools/terminal-ui-render/check-static.mjs:13-21` 现有七条规则,其中 `render-public-surface`、`render-package-boundary` 确实存在;`:126-144` 已有 runtime dependency 白名单与"react/react-native 不得为运行依赖"的检查。§7.2 要加的是规则而不是新 checker,口径准确。

**Codex 侧两轮独立审查是真实的**:Round 1 的 M-1/M-2/M-3/S-1 我逐条复核后都成立,处置也落到了详设 §5/§7.1/§9a 与计划 B1/B3。Round 2 的"一名 GO、一名未完成并由主 agent 接管"如实登记,没有把未完成写成 MATCHED。

## 2. Findings

### M-1 这是一次"性能优化",但问题的存在性没有被证明,而详设自己给这个前提打了折扣

- **状态**:CONFIRMED(文档事实 + 源码推论)
- **文档事实**:详设 §0.1 在陈述问题后写道——"根 store 不是说每一笔数据变化必然重绘所有组件:**如果外部源没有发布、root 引用没有变化或 React 最终能 bailout,可能不会重绘**"。§11 又明确"本批可证明的是订阅语义和静态闭包,不是设备帧率、内存、CPU 或用户感知性能改善"。
- **推论**:于是本批既没有**改前**的基线证明问题真的发生,也不会有**改后**的数字证明问题被解决。F-1 至 F-12 证明的全是新机制**自身**的语义(选中值相等时 render count 不增),而不是"TER 原来会多渲染、现在不会了"。换句话说,论证链最底下那一环是空的:我们只知道机制上可能重渲染,不知道它在本仓真实旅途里是否发生、发生多少。
- **为什么这次要卡**:这不是吹毛求疵的闭环问题。本批要付的代价是实打实的——删除一个公共 hook 且不留兼容出口(§5.4)、给 render 包引入**它今天还一个都没有的**第三方运行依赖、新立一条会约束全部 `ui/**` 的框架规范 TR-15、迁移七处生产调用点、收窄公共 context 类型。按仓内"闭环正确不构成 GO 的充分条件、先问问题对不对"的要求,付这个代价之前应当先证明问题存在。
- **最小修复(很便宜,二选一)**:
  1. **补一条改前基线**:在**现有**代码上加一个 render-count probe,证明一次无关的状态变化(例如确认壁纸)确实会让一个不相关组件(例如 `MemberList`)重渲染。用现有 `react-test-renderer` + fake `stateSource` 即可,不需要新依赖、不需要设备、不需要动态授权,约二十行。有了它,F-1 的"改后不增"才有对照,整批的 before/after 才闭合。
  2. **或者改口径**:不再把本批称作"性能优化",而是按 Dexter 原话的后半句定位为**框架级 selector 调用规范与订阅边界收窄**(TR-15 是主产物,render 隔离是顺带收益),并在 §0.2 明确"本批不主张任何性能改善,只主张订阅边界正确"。
  - 我倾向 1:它几乎不花钱,而且顺手把"以后谁再改坏了会不会被发现"也一起锁住了。
- **Dexter**:建议由 Dexter 选 1 或 2。这关系到这批的定性与验收口径,不是纯实现取舍。

### S-1 迁移后每个宿主从一个订阅变三个,每次通知要跑三个 selector 并分配新对象;详设没有做这笔账

- **状态**:CONFIRMED(源码事实 + 推论)
- **事实**:`ScreenContainer.tsx:33-44` 今天是**一次** `useRenderSnapshot()`,随后从同一个 root 派生 `catalogContext`(`:34-36`)与 `placement`(`:38-44`)。§6 要把它拆成 `useRenderStatus` + 参数化 `useUiStateSelector` + `useUiCatalogContext` 三个订阅;`LayerStack.tsx:107` 同形。
- **推论**:`useSyncExternalStoreWithSelector` **不减少通知量**——store 仍在每次 root 变化时通知每个订阅者,减少的只是重渲染。因此迁移后,每次状态变化,单个宿主要跑三个 selector 而不是读一次快照;五个宿主合计从五次快照读变成约十五次 selector 执行。其中 `useUiCatalogContext`(§5.3)每次都会 `createCatalogContext(...)` **分配一个新对象**,再靠 `areUiCatalogContextsEqual` 丢弃它。
- **影响**:这笔交换大概率仍然划算(React 重渲染 + 协调远贵于几次属性读取),但详设从头到尾没有承认它的存在,也没有对 equality 的开销提出"必须廉价"的约束。一个"性能优化"方案不讨论自己新增的每次通知开销,是论证上的缺口。
- **最小修复**:在 §1 或 §5.3 补一段取舍说明:说明通知量不变、每宿主 selector 执行次数上升、`useUiCatalogContext` 每次通知分配一个对象并比较四个字段,并给出"equality 必须是常数时间的浅比较"这一约束。不需要做基准。
- **Dexter**:不需要。

### S-2 TR-15 的例外清单漏了 `ui/base/console-assembly`,而它正是 raw source 的合法生产者且在 `ui/**` 之下

- **状态**:CONFIRMED
- **事实**:TR-15 第 1 条(详设 §4)的适用面写的是"`apps/terminal/ui/**` 的生产 React UI 组件",禁止"调用 `stateSource.getState()`、`stateSource.getStatus()` 或**把 raw state root/source 作为业务渲染 prop 向下传递**";第 6 条的窄例外只点名了 `RenderContext.ts`、`RenderProvider.tsx`、`createRenderSnapshotReader.ts`、`useUiStateSelector.ts`、`useRenderStatus.ts` 五个 render 内部文件。
- **仓内反例**:`ui/base/console-assembly/src/foundations/consoleAssembly.tsx:192` 定义 `createStateSource`,`:396` 创建它,`:570` 以 `stateSource={stateSource}` 作为 prop 传给 `RenderProvider`。该文件在 `apps/terminal/ui/**` 之下,按 TR-15 字面即命中"把 raw source 作为 prop 下传"。
- **详设确实想到了这一点,但写错了地方**:§5.1 有一句"`RenderProvider` 仍可接收 `RenderProviderProps.stateSource`,这是 assembly → render 的基础设施输入"。可 TR-15 是要进 `doc/platform/terminal-coding-standard.md` 成为正本并被后续评审逐条引用的,例外必须写在 TR-15 里;写在详设 §5.1 不解决未来评审拿 TR-15 原文判 console-assembly 违规的问题。
- **顺带回答 handoff 的提问**:TR-15 **不会**误伤 kernel actor/foundation——它们在 `kernel/**` 而不是 `ui/**`,且 §4 第 6 条末句已明写不得把它们迁成 React hook。真正被误伤的是 `ui/base/console-assembly`。
- **最小修复**:在 TR-15 第 6 条的例外里加入 assembly 层的装配接线——"`ui/base/console-assembly` 创建并向 `RenderProvider` 注入 `stateSource` 属于基础设施装配,不受本条约束;它不得把 source 继续传给业务组件"。
- **Dexter**:不需要。

### S-3 `useUiStateSelector` 的 `undefined` 同时表示"runtime 未就绪"与"选择结果本身是 undefined",在它成为唯一入口后变成承重歧义

- **状态**:CONFIRMED(源码事实 + 推论)
- **事实**:现状 `hooks/useUiStateSelector.ts:15,18` 返回 `TValue | undefined`,并在 `snapshot.root === undefined` 时提前返回 `undefined`。详设 §5.1 保留该签名,并规定"root 不可用时不调用业务 selector,返回 `undefined`"。
- **推论**:业务 selector 本身返回 `undefined` 是完全正常的——`selectScreen` 对空容器就返回 `undefined`(`ScreenContainer.tsx:40-41` 正依赖这一点来区分"有记录/无记录")。于是调用方拿到 `undefined` 时无法区分"runtime 还没起来"与"这个容器确实没有内容"。
- **为什么这次要提**:歧义今天就存在,不是本批引入的**回归**;但本批把这个 hook 定为**全部 React 状态读取的唯一入口**(TR-15 第 1 条),歧义随之从局部变成框架级。而且它正好压在上一批刚确立的失败分类上:`container-empty` 属内容失败(就绪、可见呈现),`runtime-not-started` 属过渡态(不就绪、不报失败)。若某个消费者仅凭 `undefined` 判断,两者会被混同。
- **缓解已存在但未写成约束**:§6 给 `ScreenContainer`/`LayerStack` 同时配了 `useRenderStatus`,所以宿主能区分。缺的是把它写成契约。
- **最小修复**:在 §5.1 与 TR-15 补一句——"`useUiStateSelector` 的 `undefined` 不表示业务语义;任何需要区分'runtime 未就绪'与'选择结果为空'的消费者必须同时使用 `useRenderStatus`,不得以 `undefined` 单独推断生命周期状态",并在 F-4 增加一条断言覆盖这个区分。
- **Dexter**:不需要。

### N-1 三条新静态规则会改变已导出的规则常量与门计数

`tools/terminal-ui-render/check-static.mjs:13-21` 的 `RENDER_STATIC_RULE_NAMES` 是冻结导出数组,`:414` 打印 `RENDER_STATIC_RULE_GATES=${RENDER_STATIC_RULE_NAMES.length}`。§7.2 提的 `render-selector-boundary`、`render-public-context-boundary`、`render-admin-state-pass-through` 都不在现有七条内,新增后该常量与计数都会变,依赖它的 self-test 需同步。§9a 只笼统写了"checker 与其 self-test",建议点名这两个符号。

### N-2 方案 D 的否决理由被夸大了(但选 C 仍可接受)

§1 表格否决 D(自研 wrapper)的理由是"要自行复制 selector 缓存、订阅一致性和并发边界,容易产生隐蔽 tearing 或 stale 结果"。事实上并发与 tearing 由 **React 19 原生的 `useSyncExternalStore`** 负责,`useSyncExternalStoreWithSelector` 只是它之上的薄封装(记忆化 selector + `isEqual` 比较)。真正的自研成本没有表述的那么高。我仍然同意选 C——包已安装、MIT、peer 覆盖 React 19,且仓内规矩是"优先使用成熟库";但否决理由应改成"避免自己维护记忆化与 equality 的边界情况",而不是把并发正确性算在 D 头上。

### N-3 本批会给 render 包引入它今天的第一个第三方运行依赖

我核过 `ui/base/render/package.json` 的 `dependencies`:当前七项全是 `workspace:*`,**没有任何外部运行依赖**。加入 `use-sync-external-store` 后,该包首次向终端产物引入第三方运行代码(体积很小,不是问题)。这属于边界变化,建议在 §9a 明确写出这一点,并确认 `render-package-boundary` 的白名单更新是精确的而非追加式。

## 3. 方案合理性

- **问题对不对**:机制描述对,但**存在性未证**,见 M-1。这是本轮唯一的阻断。
- **方案优不优**:C 是合理选择。我按仓内要求自己构造了作者没列的更小替代——直接在 render 包用原生 `useSyncExternalStore` + 一个约二十行的记忆化 selector 包装(现有 `useUiStateSelector.ts:17-24` 其实已经写了一半)。结论是:两者都能达成目标,C 少维护边界情况、D 少一个依赖;在"包内零第三方依赖"这条现状下 D 略有吸引力,但不足以推翻 C。**不建议为此返工**。
- **代价配不配**:在 M-1 补上之前无法判断。补上之后,以本批的产物(框架规范 + 订阅边界收窄 + 七处迁移)论,代价是相称的。
- **值得肯定的三处**:①把"selector 计算缓存"与"订阅粒度"明确分成两个问题(§0.1、TR-15 第 5 条),这正是这类优化最常被混淆的地方;②Reselect 被正确定位为派生缓存而非订阅隔离,并明确拒绝"给所有 scalar 套 `createSelector`";③§7.2 的门准入三问如实回答了"哪些能机械判定、哪些不能",没有拿正则冒充语义。

## 4. UI 与交互强制自问

`NOT_APPLICABLE`:本批不改变用户可见行为、布局、文案、焦点、partKey、testID 或 Journey;详设 §3a 已如实标注。唯一需要留意的是 §6 迁移必须保持 `ScreenContainer` 的失败分类与 ready 分支不变——那是上一批刚确立的语义,S-3 的修复正是为了防止它被 `undefined` 歧义侵蚀。

## 5. 证据分档

本轮为 DESIGN review,除阅读外未执行任何命令。static、focused、typecheck 在实施期才有;native/Android、Web、release/visual、cleanup 按详设 §11 标 `NOT_APPLICABLE_WITH_REASON` 或 `OPEN`,本评审不触碰、也不升格。特别地:**本批不存在任何性能数字,GO 与否都不得被解读为性能改善的证据**。

## 6. 授权边界

本评审只读,只针对详设与实施计划,不授权修改源码、测试、依赖、脚本、规范或构建产物,不授权任何动态验证、部署或 Git 操作。NO-GO 表示在 M-1 收口前不宜进入实施;S-1 至 S-3 与三条 N 均可在既有边界内自主修复,是否进入实施由 Dexter 决定。
