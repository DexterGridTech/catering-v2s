# TER React UI selector 订阅边界 · implementation 代码评审

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=**仅代码逻辑**(Dexter 本轮明确:只做代码逻辑 review,不做 evidence 检查)
  未核验:七条命令结果、.runtime 日志、B0–B4 步骤级/全批对账留痕、F-1～F-12 的证据声明、
  red mutation 执行记录、证据分档。这些本轮一律不构成本结论的依据,也未被本结论背书
reviewerKind=CLAUDE_DIRECT(按项目记忆"分析类任务主 agent 自己做,不派子 agent")
EVIDENCE_TIER=static;只读源码,**未执行任何命令**
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`doc/`、`tools/` 从仓库根写。行号为评审时当前字节。

## 0. 结论

```text
VERDICT=GO(仅针对本批已实施源码的代码逻辑)
M/S/N=0/1/2
DEXTER_DECISION=无
GO 只表示代码逻辑层面可交 Dexter 决定;由于本轮未检查任何 evidence,它**不构成**
  implementation acceptance,也不背书任何测试、静态门或命令结果
```

代码实现与详设的契约逐项吻合,两个生产分母由我自己重扫确认为空。唯一的 Significant 是一处**潜伏**的契约缺口——当前不发作,但会在第一个使用默认 placement 能力的人身上静默生效。

## 1. 我自己核过的字节

| 核验项 | 结论 | 依据 |
|---|---|---|
| 公私 context 拆分 | 成立 | `ui/base/render/src/contexts/RenderContext.ts:9-23` 的 `RenderContextValue` 已无 `stateSource`/`snapshotReader`;二者移入 `:25-28` 的 `RenderSubscriptionContextValue`,由 `:39-43` 的私有 hook 取用 |
| Provider 同时挂两个 context | 成立 | `components/RenderProvider.tsx:80-83` 构造订阅值、`:84` 另构造公共值、`:115-117` 嵌套挂载;`:34` 保留 provider 自身 status 订阅(详设 §5.2 允许) |
| `useUiStateSelector` | 与 §5.1 逐条一致 | `hooks/useUiStateSelector.ts:33-39` 用 `useSyncExternalStoreWithSelector`;`:26` 走私有 context;`:28-30` root 不可用时不调业务 selector;`:27-32` 按 `[selector]` 记忆化,identity 变即重算;`:38` 透传 equality;`:15-21` JSDoc 写明 `undefined` 契约 |
| `useRenderStatus` | 成立 | `hooks/useRenderStatus.ts:5-8` 只订阅 `getStatus`,**全程不触碰 root** |
| `useUiCatalogContext` | 成立 | `hooks/useUiCatalogContext.ts:10-20` 是 `Object.is` 快路径 + undefined 守卫 + 四字段 `===`,常数时间浅比较;`:24-27` selector 按 `[displayMode, selectSurfaceForm]` 完整依赖记忆化 |
| `useUiVariable` 迁移 | 成立 | `hooks/useUiVariable.ts:13-18` 改走 `useUiStateSelector`,依赖 `[declaration, selectUiVariable]` 完整;从**公共** context 取 reader,未误用订阅 context |
| 旧 hook 在生产中清零 | 成立 | 我对 `apps/terminal/ui` 生产代码(排除 test)grep `useRenderSnapshot`,**零命中**;`src/index.ts:72-74` 只导出三个新 hook,`terminal-invariants.json:64,79,80` 一致 |
| admin raw state 清零 | 成立 | 我对 `ui/base/admin-shell` 生产代码 grep `stateRoot\|stateSource`,**零命中** |
| 依赖闭合 | 成立 | `ui/base/render/package.json` 增 `use-sync-external-store: ^1.6.0` 为运行依赖、`@types/use-sync-external-store: ^0.0.6` 为 devDependency;React/RN 仍留 devDependencies 未被改成运行依赖;`apps/terminal/package.json:5,8` 有 workspace 层 anchor |
| 静态规则清单 | 成立 | `tools/terminal-ui-render/check-static.mjs:13-24` 为 10 条(原 7 + 三条新);`:26` 的 `RENDER_STATIC_RULE_GATES` 由 `RULE_NAMES.length` 派生;self-test `:60-65` 以 `deepEqual` 锁住完整清单 |
| owner selector 零分配 | 成立 | `kernel/base/ui-state/src/selectors/selectContent.ts:41` 的 `selectLayers` 与 `:31` 的 `selectScreen` 都是直接属性读取,不分配。因此 `LayerStack` 与 `ScreenContainer` 的**持久化**路径订阅相等性真实有效 |
| admin 消费者 selector 形态 | 成立 | `AdminLauncher.tsx:68-73` 用 `useMemo([surface.displayMode])` 且返回 boolean;`sections/DisplayContextSection.tsx:10-11` 用模块级 owner selector 返回 scalar;`sections/RuntimeSection.tsx:9` 已换 `useRenderStatus()`;`AdminShellLaptop.tsx:46-47`、`AdminShellMobile.tsx:33-34` 为 status + catalog 两个 hook |

**上一批语义未被侵蚀**(我在授权话术里写的硬约束):`components/ScreenContainer.tsx:64-77` 的 host 不可用 → `system`/`surface-host-unavailable`(仅目标主表面出失败页,否则中性 fallback)、`:78-80` 的 `runtimeStatus !== 'started'` → `runtime-start-failed`,判定逐条未变,只是把 `snapshot.status` 换成 `useRenderStatus()`。`components/LayerStack.tsx:114-120` 的过滤与排序语义同样保持。

## 2. Findings

### S-1 默认 placement 在 selector 内分配新对象且未配 equality,该分支的订阅契约失效(当前潜伏)

- **状态**:CONFIRMED(源码事实 + 推论)
- **源码事实**:`ui/base/render/src/components/ScreenContainer.tsx:35-40` 的 placement selector 在"无持久化记录但配了默认 partKey"分支上返回 `{partKey: defaultPartKey}` —— **每次执行新建一个对象字面量**;`:41` 的 `useUiStateSelector(placementSelector)` **没有传第二个参数**,因此走默认 `Object.is`。
- **推论**:一旦该分支被走到,任何一次 root 变化都会让 selector 重跑、产出新对象、`Object.is` 判不等,`ScreenContainer` **每次状态变化都重渲染**——正是本批要消除的全量订阅行为,而且落在每个 surface 都会挂载的组件上。
- **详设要求未兑现**:§6 对这一处写的正是"默认 placement 用 `useMemo`/模块级常量稳定引用"。实现把 **selector** 记忆化了(`:35-40` 依赖完整),但没有把 **selector 返回的默认对象**稳定化。
- **同一问题在别处处理对了**:`hooks/useUiCatalogContext.ts:25` 同样在 selector 内 `createCatalogContext(...)` 新建对象,但 `:28` 传了 `areUiCatalogContextsEqual` 把分配丢弃掉。所以这是**漏了一处**,不是理解偏差——修法在本仓已有现成范例。
- **当前是潜伏的,不是正在发作**:我追了 `defaultContainerPartKeys` 的全部生产者——`ui/base/console-assembly/src/foundations/consoleAssembly.tsx:175,586`、`ui/integration/sample-console/src/assembly/assembly.tsx:56,83`、`ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:35,62` —— **每一处都只是可选入参的透传,没有任何一处真正赋值**。因此今天 `defaultContainerPartKeys?.[containerKey]` 恒为 `undefined`,selector 返回 `undefined`(primitive),`Object.is` 成立,不产生重渲染。缺陷会在**第一个启用上一批 R-6 默认 partKey 能力的人**身上静默生效。
- **没有判据能逮住它**:`ui/base/render/test/renderState.test.tsx` 的 render-count 探针用的是 primitive(`:347-399`)与带窄 equality 的派生对象(`:401-445`),都天然引用稳定;全文件没有针对默认 placement 的 render-count 用例。⚠️ 我读完了这一个文件,未逐个打开其余 render/admin 测试文件(本轮不查 evidence)。
- **最小修复**:把默认 placement 提到 selector 之外做成稳定引用——例如以 `useMemo` 按 `[containerKey, defaultContainerPartKeys]` 预先构造一个 `defaultPlacement`,selector 直接返回同一引用;或给 `:41` 传一个只比较 `partKey`/`instanceId` 的窄 equality。任选其一,一处改动。
- **建议在本批内修,而不是留到启用时**:本批的全部交付物就是"订阅契约成立",而这是唯一一条它不成立的生产路径;等到有人配了默认值才发现,那时既没有判据也没有人记得这条约束。
- **Dexter**:不需要。

### N-1 `DisplayContextSection` 以 `undefined` 推断生命周期,与本批刚立的 TR-15 第 1 条口径相抵

- **状态**:CONFIRMED
- **源码事实**:`ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx:10-11` 取 `useUiStateSelector(selectDisplayRole)` 与 `(selectRuntimeInstanceMode)`;`:14-15` 在任一为 `undefined` 时渲染 `运行状态尚未就绪` —— 这是一句**生命周期**判断。
- **与规范的张力**:TR-15 第 1 条(本批新写)明确"`useUiStateSelector` 的 `undefined` 不代表 runtime 生命周期或业务空值;需要区分时必须同时读取 `useRenderStatus()`"。此处正是仅凭 `undefined` 推断生命周期。
- **今天行为是对的**:这两个 owner selector 只在 root 不可用时返回 `undefined`,所以文案当前不会说错。问题在于这段代码恰好是本批重写的,却示范了新规范禁止的推断形态;将来任一 selector 因 slice 未填充而返回 `undefined`,文案就会把数据缺失说成运行态未就绪。
- **最小修复**:改读 `useRenderStatus()` 判生命周期,`undefined` 只用于"该数据确实不存在"的分支。
- **Dexter**:不需要。

### N-2 `renderProps.test.tsx` 的 full-root 例外未按计划标注

- **状态**:CONFIRMED
- **源码事实**:`ui/base/render/test/renderProps.test.tsx:89` 仍是 `useUiStateSelector(root => root)`,且 `:84-97` 的探针 fixture 周围没有任何说明性注释。
- **计划要求**:计划 §3.1 列 `renderProps.test.tsx` 的写入内容为"full-root 例外明确注释或改为窄 probe";详设 §7.1 第 9 条要求"只允许作为订阅机制专用 test exception,并在用例注释和规范中说明"。两者都未兑现。
- **影响**:仅测试,无生产影响。但该写法是内联箭头(每次渲染换 identity)且选择整个 root 走 `Object.is`,正是 TR-15 第 3 条禁止、且本批要消除的形态;没有注释时它就是一段可被后来者当模板抄走的代码。
- **最小修复**:加一句注释说明它是订阅机制专用例外,或改成窄 probe。
- **Dexter**:不需要。

## 3. 代码质量与实现取舍

- **迁移是逐点做对的,不是整体搬运**:七处生产调用点各自选了合适形态——boolean selector(`AdminLauncher`)、模块级 scalar selector(`DisplayContextSection`)、status-only(`RuntimeSection`)、带窄 equality 的派生对象(`useUiCatalogContext`)、owner 零分配直通(`LayerStack`)。没有出现"所有东西都套一层 `createSelector`"的过度统一。
- **`useUiCatalogContext` 的 equality 写得克制**:`:14` 先 `Object.is` 快路径、`:15` undefined 守卫、`:16-19` 四个字段 `===`,没有深遍历、没有 IO,符合详设 §5.3 加的那条约束。
- **私有 context 的边界是类型级的**,不是靠约定:外部消费者从 `useRenderContext()` 的返回类型上就拿不到 `stateSource`,这比只靠静态门可靠。
- **唯一的不一致是 S-1**:同一种"selector 内分配"的形态,`useUiCatalogContext` 配了 equality,`ScreenContainer` 的默认分支没配。

## 4. 本轮未覆盖的范围(重要)

Dexter 本轮明确只要代码逻辑 review,因此**以下一律未核**,GO 不对它们作任何背书:七条命令的实际结果与首败日志;`.runtime/` 下的全部产物;B0–B4 的步骤级与全批三维对账留痕(包括 B1/B2 是否存在独立 reviewer 记录);逐代码与详设对账;F-1～F-12 的证据声明与 red mutation 执行记录;static self-test 的 31 个 mutation 与 behavior harness 的 36 个 vector 是否真的跑过;证据分档是否被升格。

我读过 `renderState.test.tsx` 全文,那是**测试代码本身**而非证据——其中 `:347-399`(render-count 探针,真计数器而非 selector call count)、`:447-502`(status 与 `undefined` 分离)、`:554-572`(catalog equality 逐字段失效断言)在**代码层面**确实构成可判定的 oracle。但它们**是否被执行过、结果如何**,不在本轮结论内。

## 5. 授权边界

本评审只读,只针对本批已实施源码的代码逻辑,未执行任何命令,未修改任何文件。GO 仅表示代码逻辑可交 Dexter 决定下一步;**不构成 implementation acceptance**,不背书任何测试、静态门、命令结果或证据分档,也不构成 Web、native/Android、release、visual 或性能方面的任何结论——本批按方案二不主张性能。S-1 建议在本批内修复;三条 finding 的处置与是否收口由 Dexter 决定。
