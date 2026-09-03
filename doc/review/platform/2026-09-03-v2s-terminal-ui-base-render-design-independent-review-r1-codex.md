# ui.base.render DESIGN 独立对抗审查

REVIEW_CYCLE_ID=2026-09-03-TER-UI-BASE-RENDER-DESIGN-01
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist={path:doc/review/platform/2026-09-03-v2s-terminal-ui-base-render-design-review-input-checklist-codex.md,sha256:73f0159545a02572257ee2105d8e13e23304e2f2f51d29270ad19ec5d7ba8f18}
blindReviewDeclaration=先独立读取 checklist 第1-4节并形成 provisional verdict，后读取第5节作者材料
authorMaterialReadAfterIndependentVerdict=true
VERDICT=NO-GO
M=2 S=4 N=2

## 审查边界与独立阶段声明

本轮严格按 checklist 第1-4节执行：先以 `sed -n '1,92p'` 读取 checklist；在本段写入前没有读取第93行及以后，也没有读取第5节或第5节列出的作者材料。随后按第1-4节逐项重开了 `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、活动 Roadmap 授权、六个 project-memory kernel、相关 TER/frontend/review/foundation 决策与标准、render 需求全文、requirements analysis、ui-state requirements、IA/详设模板、当前 skeleton graph、runtime/ui-state/render owning source、当前 unit tests 与 runtime/static harness。独立阶段未修改任何源码、需求、IA、详设、计划、测试或依赖；未运行动态命令。

独立阶段采用 `REVIEW_TARGET=DESIGN` 的文档提取路径：逐份文档对照模板寻找缺项，逐项对比同一事实在需求/模板/当前 owning source 的表达，再扫描 T-1..T-13、R-1..R-20 的反例与生产 red mutation。结论依据是当前仓内字节与规范；文档中的历史修订叙述不作为作者结论或既有 reviewer 结论采信。

## Corpus 与可见性边界

当前输入没有发现 `ui.base.render`、`SurfaceRoot`、`LayerStack`、`ui-state`、`RendererCatalog` 等对应的产品 Journey 或用户操作 corpus 条目。记录：`NO_CORPUS_ENTRY_MATCHED`；`JOURNEY_INPUT=NOT_APPLICABLE_WITH_REASON:本包是机制型 toolkit，不承载产品 Journey`；`UI_INTERACTION_INPUT=NOT_APPLICABLE_WITH_REASON:没有产品 screen、actor、用户动作或业务文案可供推导`。因此不能仅凭 POC/API 将 “alert 不能被对话框盖住”升级为产品用户意图；它必须被降为已批准的技术约束，或交 Dexter 作产品/架构裁决。

L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON:当前 scope 是无产品 Journey 的 toolkit，且本轮授权不含 L2、浏览器、设备或 UAT；本轮只审静态设计与可证伪边界。

## Provisional findings（先于作者材料）

### M-1 [CONFIRMED] S-7 的当前事实与设计前置条件相反

- 静态事实：需求将当前 `UiCatalogEntry` 描述为单数 `containerKey`，并将 `containerKeys` 标为 S-7 后目标态，且宣称 S-7 未落地时 render 不得进入详设（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:46-56,354-391,514`）。
- 当前 owning source 事实：实际类型已经是 `containerKeys: readonly ContainerKey[]`（`apps/terminal/kernel/base/ui-state/src/types/catalog.ts:8-17`）；批准键、数组校验、空数组语义和 `.includes` 过滤已经落地（`apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:16-25,27-45,61-94,124-138`）。真实 catalog 测试也覆盖列表、空数组、ownKeys 与多容器过滤（`apps/terminal/kernel/base/ui-state/test/catalog.test.ts:8-17,32-52,69-109`）。
- 反例：实施者按需求先等待或重复实施 S-7，会把一个已经存在的契约当成未完成前置；实施者按当前代码推进，又会直接违反需求中“render 不得进入详设”的叙述。同一设计无法导出唯一实施顺序。
- 最小修复：重新读取当前 owning source 后，删除/改写所有“当前仍为单数”“S-7 未落地”“render 不得进入详设”的陈旧表述，明确 S-7 的实际状态；保留仅适用于当前 bytes 的 T-9a/T-13/R-19/R-20 约束，并重新核对 IA、详设、计划的引用分母。
- 适用边界：本 finding 只针对当前 ui-state catalog 契约与 render 设计前置；不要求在本轮修改源码。

### M-2 [CONFIRMED] S-6/runtime/stateSource 接缝未与当前 Runtime 形成唯一可实现契约

- 静态事实：需求的快照示例仍直接使用 `runtime.getState()`，并声称 Runtime 没有 `subscribe`、只能经 `getStore()`，据此把 S-6 写成待补接缝（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:173-195,505-515`）。
- 当前 owning source 事实：`Runtime` 已公开 `readonly status`、`subscribe`、`getState`、`getStore`（`apps/terminal/kernel/base/runtime/src/types/runtime.ts:41-79`）；实现已保留 pre-start listener、同步状态订阅、failed 通知、关闭订阅与幂等退订（`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:220-265,325-385`），且非 `started` 的 `getState()` 会抛错（`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:391-399`）。
- 设计缺口：RenderProvider 另宣称只接收 `{getStatus,getState,subscribe}` 的窄 `stateSource`，但未给出该适配器的具名类型、由谁创建、`getStatus` 如何从当前 `Runtime.status` 转移、failed/starting 时 `getState` 的禁止调用如何在 hook/provider 层闭合（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:224-246,463-483`）。这不是简单的命名差异：错误接线会在 Provider 早于 start 或 failed 后让 `useSyncExternalStore` 的 snapshot 抛异常。
- 反例：集成层把完整 Runtime 当 `stateSource` 传入，render 获得 `dispatchCommand`；或 adapter 的 snapshot 无条件调用 `getState()`；或只监听 store、不监听 `created/starting/failed → started`，分别违反 toolkit 只读边界或导致不可用/可用状态不重渲染。
- 最小修复：在设计正本中唯一化 `stateSource` 的具名只读类型、适配器创建位置、status-first snapshot 算法、生命周期通知顺序和 failed 后行为；把当前 Runtime 已实现的 S-6 行为与 render 侧新增职责分开，逐项绑定到 T-10 及对应 focused proof。
- 适用边界：只判 render/runtime 读侧接缝；不要求修改当前 runtime。

### M-3 [CONFIRMED] runtime-unavailable 诊断与 diagnostic schema 互相不可满足

- 静态事实：五种 fallback 要求 runtime 非 started 时在状态转变上记录诊断（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:304-320`）；但同一需求又把每条诊断的 `event` 限定为三选一 `missing-catalog-entry | missing-renderer | invalid-props-shape`，并要求 `data` 至少含 `partKey`、`displayMode`（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:463-483`）。
- 反例：Provider 在 runtime 尚未 started 时没有可读取的 root/placement，因而没有可确定的 `partKey`；若发 runtime-unavailable 诊断，则三选一 event 集不含该事件，且“至少含 partKey”无法满足；若不发，则违反五种 fallback 的状态转变诊断要求。把 `containerKey` 冒充 `partKey` 会改变字段语义。
- 最小修复：二选一并在需求、IA/详设/计划逐处一致化：要么将 runtime-unavailable 纳入独立、具名、可序列化的 diagnostic schema 并允许其无 partKey；要么撤回它的诊断要求，只保留 fallback 语义变体。不能通过 logger 被调用过来规避字段闭集。
- 适用边界：只针对 diagnostic contract 与 runtime unavailable fallback；container-empty 无诊断的正常态不属于本 finding。

### M-4 [DEXTER_DECISION] 将 POC 的 alert 层级提升为产品需求，但没有产品 corpus

- 静态事实：需求把 `alert 恒在普通层之上`称作“真实产品需求”，并以此支撑 `layerTier='standard'|'alert'` 的跨装配稳定性（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:108-113,280-286`）。
- corpus 边界：本轮输入未匹配产品 Journey、业务 actor、用户任务或已确认业务语言；POC 的树结构/API 只能证明历史实现形态，不能单独证明用户意图。
- 反例：某个非产品诊断 overlay 被错误标为 `alert`，或未来出现第三个需要置顶的技术层；若把 POC 直接当产品裁决，实施者无法知道是技术层级契约还是用户可见业务优先级，也无法知道谁有权改变它。
- 最小修复：在设计中明确 `NO_CORPUS_ENTRY_MATCHED` 与 `NOT_APPLICABLE_WITH_REASON`；若保留两级，只将其表述为已批准的技术渲染树顺序并写出 owner/变更裁决；若其确实是产品语义，补充 Dexter 的明确裁决及适用边界。不得从 POC/API 推导用户 Journey。
- 适用边界：只针对产品语义归因与 layerTier 的裁决来源；不否定按树顺序测试 z 分组的技术可测性。

### S-1 [CONFIRMED] T-3 的行为正文遗漏相同 openedAt 的确定性排序

- 静态事实：LayerStack 正文只规定按 `openedAt` 升序（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:288-300`）；T-3 又要求相同 `openedAt` 时按 `layerId` 字典序（同文件 `:548-553`）。
- 反例：两个 layer 同时打开且 `openedAt` 相同，按实现插入顺序会使不同运行/集合遍历得到不同树；只读正文的实施者无法唯一实现稳定顺序。
- 最小修复：把 `openedAt asc, layerId lexicographic asc` 写入 LayerStack 唯一行为定义，并在 T-3 与计划/详设逐字一致；若 tie-breaker 非要求，删除 T-3 的额外条件并说明不保证稳定顺序。
- 适用边界：只针对同一 tier 内同一时间戳的渲染树顺序；真实视觉 z-order 仍是 L2 未验证。

### S-2 [CONFIRMED] rendererBinding 的可选 layerTier 与 ownKeys 判据未收敛

- 静态事实：RendererBinding 将 `layerTier` 声明为可选且默认 standard（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:262-271`）；T-9b 又要求 ownKeys 精确等于 `{rendererKey, component, layerTier?}`（同文件 `:559-560`）。
- 反例：`layerTier` 缺席、显式为 `undefined`、或由 `definePart` 规范化为 `'standard'` 时，`Reflect.ownKeys` 分别得到不同集合；测试和实现会对“可选字段的精确集合”产生不同答案，且跨装配稳定性无法从同一 binding 形状读取。
- 最小修复：明确 `definePart`/catalog 是否总是物化 `layerTier:'standard'`，或明确缺席是唯一合法 standard 表示；同步类型、ownKeys 反例、冻结行为和 `tierOf` 的返回契约。
- 适用边界：只针对 rendererBinding 的对象形状与默认值；不涉及 catalogEntry 的 ui-state ownKeys。

### S-3 [CONFIRMED] R-14 的“公共导出精确集”没有说明骨架导出是否计入分母

- 静态事实：需求将 §4.8 的业务 API 列为 exact public set，并要求 R-14 对增删符号变红（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:432-441,570-593`）；当前 `src/index.ts` 已公开 `moduleName`、`dependencyModuleNames`、`devDependencyModuleNames`（`apps/terminal/ui/base/render/src/index.ts:1-2`），这些也是当前包 skeleton 的结构导出。
- 反例：若 R-14 把包的全部 export 作为分母，当前骨架就已违反 §4.8；若只把业务 API 作为分母，则“公共导出精确集”不是一个可直接执行的 exact set，且测试必须另有基础导出白名单。
- 最小修复：在设计中将 infrastructure/skeleton exports 与业务 public surface 分成两个明确集合，分别列出 owner、验证方式和允许的当前骨架例外；不得让实现者猜测是否删除既有骨架导出。
- 适用边界：只针对 R-14 与当前 render package index 的公共面；不主张删除任何现有文件。

### S-4 [CONFIRMED] T-10 没有覆盖 S-6 所列的全部 snapshot/lifecycle 反例

- 静态事实：需求为 S-6 列出 pre-start 订阅、failed 通知、同步/批处理、幂等退订、生命周期结束、退订 oracle、snapshot 生命周期与 selector root 引用记忆化七项（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:197-246`）；T-10 只要求 store 变化触发重渲染及卸载后不再触发（同文件 `:561-563`）。
- 反例：实现可以通过 T-10 的“store 变化/卸载”测试，但在 Provider pre-start、failed 或 snapshot 不稳定时仍崩溃/永久停帧；现有 runtime 订阅测试证明 runtime facade 的既有行为（`apps/terminal/kernel/base/runtime/test/runtimeSubscription.test.ts:19-171`），不能替代 render 的 status-first/provider/snapshot 接线证明。
- 最小修复：把七项拆成 render 可执行的 focused cases，明确哪些由 runtime 既有测试承担、哪些必须由 render 真实 React 测试承担；每项绑定失败实现与生产 red mutation，不把既有 runtime 测试名称当作 render 证据。
- 适用边界：只针对 render 接线的测试设计完整性；不要求重复测试 runtime 内部所有实现细节。

## 独立阶段反例覆盖与证据边界

- Provider/RendererCatalog/SurfaceRoot/ScreenContainer/LayerStack/definePart 的 toolkit owner 边界、无具体 part/container key、无 dispatch/command/slice、两跳解析、五种 fallback、props 缺席与非法对象、hook 顺序、React peer dependency、diagnostic schema、T-1..T-13 与 R-1..R-20 已逐项对照需求与当前骨架；上列 findings 是其中确认的不成立或未收敛项。T-13/R-19 的要求本身包含真实调用链 `definePart → createUiCatalog → selectAvailableParts` 与 ui-state production mutation；该反例方向是可执行的，但须在详设中保留跨包真实调用而不得 mock 或改夹具输入。
- 当前 render package 仍是骨架：`package.json` 只有 typecheck 且无 Vitest/react-test-renderer，`tsconfig.json` 只 include `src/**/*.ts`，`terminal-invariants.json` 的 test kind 为 ABSENT（`apps/terminal/ui/base/render/package.json:8-24`、`apps/terminal/ui/base/render/tsconfig.json:1-4`、`apps/terminal/ui/base/render/terminal-invariants.json:1`）。这是静态基线，不是测试失败或动态通过证据。
- 未运行任何 render test、TypeScript gate、React renderer、L2、浏览器、设备、DEV、seed、reset、UAT 或部署命令；不得把未来计划中的命令写成已运行证据。
- `UNENFORCEABLE_BY_MACHINE`：fallback 的视觉“不可用外观”、layerTier 应归属哪一层、业务方指定显示时机、`containerKeys:[]` 是否等价 layer-only，必须留在设计审查/裁决边界；T-13/R-19 只能证明空数组不进入容器枚举。真实视觉 z-order 是 `L2_UNVERIFIED`，本轮不宣称。

## Provisional verdict

`VERDICT=NO-GO`。四条 M 使当前需求与实现面对的事实、stateSource/Runtime 接缝、诊断字段闭集及 layerTier 的裁决来源无法收敛到唯一实现；四条 S 使稳定排序、binding exact shape、public export denominator 与 snapshot/lifecycle 反例仍不具备唯一可执行定义。N=2 表示本轮未运行与明确不适用的动态/可见证据，不把它们伪装成实现通过。

以下内容是在本独立 provisional verdict 写入后才允许追加：读取 checklist 第5节及其中指定的作者材料，并逐条记录与本独立判断的差异、确认、反驳或仍未验证项。

## 作者材料阶段（在独立 verdict artifact 写入后）

本阶段随后读取了 checklist 第5节列出的五份材料：

- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md`（checklist SHA-256 `ce10dd1eb29c22e5b831ab77c486090f96807ad1e2149155bd4626b408e1148b283962`）
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md`（checklist SHA-256 `2b2c4d6fc450ab7c22177215414c8a0daa56b0be1f270becf6b1783c9b9923b9`）
- `doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md`（checklist SHA-256 `af37cb63b4c04d1ed086c9b62af78870510589b1aa10274c0b1fbe38c8e51b55`）
- `doc/plans/platform/2026-09-03-v2s-terminal-kernel-base-runtime-s6-subscription-implementation-design-codex.md`（checklist SHA-256 `c0b17fbb8f8478b0b5f29af3630f73f8c2e27c184a6f1cbb4c09cfff50cadb2d`）
- `doc/plans/platform/2026-09-03-v2s-terminal-kernel-base-runtime-s6-subscription-implementation-plan-codex.md`（checklist SHA-256 `600db1dd0a123a5257998178fad215cfe164cff8d3f662a7bc19acf099329e17`）

作者材料阶段未读取其它作者材料，也未把其自评或未来命令输出当作本轮独立动态证据。

### 与独立 findings 的差异与最终处置

#### M-1：仍为 [CONFIRMED]，最终保留 M

作者详设承认需求仍含“当前单数 / S-7 未落地”旧文，并把它列为 CP0 文档对齐前置（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:20-28,380-388`）；实施计划也要求实现前对齐（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:21-39,43-54`）。这确认作者看到了独立 finding，但没有让当前需求、IA、详设、计划在设计交付时形成一致正本；IA 仍把需求/IA 关系记为 `PARTIAL`（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md:61-79`）。把对齐推入未来 CP0 不能消除当前 implementation-facing input 的双事实。最小修复仍是独立阶段所列的全量陈旧口径清理与分母重读。

#### M-2：由 [CONFIRMED] 调整为 [PARTIALLY_CONFIRMED]，不再单独计 M

作者材料给出了当前 Runtime 到窄 adapter 的明确解释：`getStatus: () => runtime.status`、闭包调用 `runtime.getState()` 与 `runtime.subscribe()`，并禁止把完整 Runtime 交给 render（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:55-64,103-147`；实施计划 `:103-124`）。这修正了独立阶段发现的“方案方向未定”，并且方案 D 相对 react-redux、完整 Runtime/store、polling 复制状态的比较是合理且复杂度匹配 toolkit 边界（同文件 `:30-53`）。但需求正本的相反历史事实仍未对齐，且本轮未运行 React snapshot/adapter proof；因此不把它改判为动态已证。按设计阶段处理，剩余部分并入 M-1 的文档一致性阻断。

#### M-3：由 [CONFIRMED] 调整为 [PARTIALLY_CONFIRMED]，不再单独计 M

作者详设明确拆分 `RenderRuntimeObservation` 与三项 `RenderPartDiagnostic`，runtime observation 使用 `runtime-status-changed` 且不带 `partKey`，三项 part error 保持各自 data 形状（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:357-372`）。这解决了独立阶段指出的 schema 不可同时满足问题；IA 也采用 lifecycle observation 与三项 error 分离（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md:24-29,50-59`）。仍有一个设计输入边界：详设自己把需求对齐标为 `DESIGN_ALIGNMENT_REQUIRED`（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:380-388`），所以在正本实际统一前不能宣称 IA/requirements/design 已闭合。作为独立 finding 的原阻断已降级并并入 M-1。

#### M-4：仍为 [DEXTER_DECISION]，最终保留 M

作者 IA 明确没有 Journey，但仍把 layer stack 的目的写成“使 alert 不被 standard 层盖住”（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-ia-design-codex.md:17-22`）；详设又将“某个业务 renderer 应属 standard/alert”列为不可由机器判定，并在 open 表中写“没有需要 Dexter 重新裁决的产品取舍”（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:374-391`）。这是作者材料内部仍未解决的归因矛盾。没有 corpus 时可以保留技术树顺序，但不能同时把它写成产品需求又拒绝产品裁决。最终仍需把它改成明确的技术约束 owner，或交 Dexter 裁决；本轮不替代该决策。

#### S-1：由 [CONFIRMED] 关闭，不计入最终 S

作者详设与计划都补充了 `tier → openedAt → layerId` 的确定性排序（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:308-326`；`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:126-146`）。该项已在作者材料内部对齐；仍未运行行为测试。

#### S-2：仍为 [CONFIRMED]，最终保留 S

作者计划只说 `layerTier` 可省略、canonical binding 默认 `standard`（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:76-97`），没有明确 `definePart` 是否始终物化该字段、显式 `undefined` 是否非法、或 exact ownKeys 的合法集合。详设的 T-9b 仍只写 renderer fields ownKeys（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:319-326`），不足以消除独立阶段的对象形状歧义。

#### S-3：仍为 [CONFIRMED]，最终保留 S

作者详设明确“实现后 expected public named export 精确为 13 个”，并把当前 `src/index.ts` 的 skeleton export 块列为变更锚点（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:227-242,272-289`），但没有说明当前 `moduleName`、`dependencyModuleNames`、`devDependencyModuleNames` 是否属于 R-14 分母，或是否必须保留为 skeleton infrastructure export。实施计划则直接要求 `src/index.ts` 只导出详设 §9.1 的 13 个符号（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:76-101`）。这仍不能导出唯一实现；最小修复是分列 infrastructure export 与业务 toolkit export 的 exact set，并为二者分别绑定 invariant/typecheck。

#### S-4：由 [CONFIRMED] 调整为 [PARTIALLY_CONFIRMED]，不计入最终 S

作者详设/计划把 status sequence、failed、root identity、selector identity、unmount unsubscribe 纳入 CP2 focused proof（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:138-147`；`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:103-124`），并把 S-6 的七项语义归入 runtime 已有材料。该设计覆盖已指出的主要反例；但作者提供的 S-6 计划包含历史执行自评与未来 render 命令，均不是本轮 render proof，本轮仍只记录为未运行边界，不把它们计作 render 动态证据。

#### S-5 [CONFIRMED]：render package 的 TR-10 README 未进入实施闭包

- `doc/platform/terminal-coding-standard.md:377-390` 要求每个 `apps/terminal/**` workspace package 在实施收口交付中文 `README.md`，包含定位、作用、结构、用法和迭代说明。
- 当前 render package 没有 `apps/terminal/ui/base/render/README.md`；作者 render 详设的实施前变更分母/锚点清单只列 source、package config、tests、tools（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:259-289`），实施计划 CP0–CP5 也没有 render README 交付项（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:21-54,58-75,183-203`）。
- 反例：render implementation 结束后 package 有新的 public API，但下一个维护者没有该 package 的中文定位/结构/真实用法/迭代边界，且 CP5 的 change denominator 无法证明文档与源码同步。
- 最小修复：把 render package README 加入 implementation design/plan 的 change denominator 与 CP5 readback，按 TR-10 写真实 public surface；不在本轮创建 README。
- 适用边界：仅针对 TER package contract；不是要求本轮实现或补文档。

#### S-6 [CONFIRMED]：公共 RendererBinding 直接使用 `ComponentType<any>`，未回答 TER contract 的 typed boundary

- 需求把公共 `RendererBinding` 定义为 `component: ComponentType<any>`（`doc/plans/platform/2026-09-02-v2s-terminal-ui-base-render-requirements-claude.md:262-271`）。
- `TR-05` 禁止对外契约的参数/返回使用 `any` 或开放形状（`doc/platform/terminal-coding-standard.md:175-194`）；RendererBinding 是 render 对外 catalog contract，虽不是端口方法，至少需要在详设中给出为何 `any` 是必要的、或改成安全的泛型/具名 component contract。
- 作者材料只描述 `ComponentType<TProps>` 的 `definePart` 输入和两半 transfer（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:259-270`），没有处理需求层面的 `any` 或 public binding 的类型闭包。
- 反例：组件绑定被当成任意 props 组件，invalid-props 只在运行时兜底；类型系统无法阻止绑定方与 state JSON props 形状不一致，违背“typed contract first”的门目标。
- 最小修复：在详设中明确一个不使用 `any` 的具名泛型/边界类型及其与 `definePart<TProps>`、resolver、React component props 的关系；若必须保留 `any`，记录适用边界与 review-only 风险，不能把它宣称为完整 typed proof。
- 适用边界：只针对 render public contract typing；不扩大为要求业务组件 props 统一成一个产品 schema。

## 作者材料阶段的正向确认与未闭合证据

- 方案合理性：D（窄 `stateSource` + React `useSyncExternalStore` + 两张安装期冻结 catalog）是与当前 toolkit owner、Runtime 唯一状态事实和无 dispatch 边界相匹配的最小候选；A/B/C 的拒绝理由具体且没有引入 polling、store fallback 或第二份 state。证据是静态设计推论，不是 render 实现通过。
- 五种 fallback：IA/详设/计划现在都保留 `runtime-unavailable`、`container-empty`、`missing-catalog-entry`、`missing-renderer`、`invalid-props` 的独立 testID；`container-empty` 无 error diagnostic，三种 part error 有精确事件，runtime 使用独立 lifecycle observation。该设计层边界已对上，但不证明组件真实渲染。
- Provider 三件套与 Runtime adapter：作者材料给出 `getStatus/getState/subscribe` 的窄形状，明确不泄漏 store/dispatch；当前 Runtime 的 `status`、`getState` 非 started 抛错与 `subscribe` 实现路径也已对上。未运行 React `useSyncExternalStore` proof。
- 两跳与 T-13/R-19：作者 plan 明确 screen/layer 的 `partKey → uiCatalog.byPartKey → rendererKey → rendererCatalog.resolve`，并要求 render runner 真实调用 `definePart → createUiCatalog → selectAvailableParts`；同时保留 ui-state filter mutation 与 render `definePart` wiring mutation 两条不同 production red vector（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-plan-codex.md:148-181`）。这是完整的设计要求，当前尚无 render runner/测试文件或 mutation 输出。
- `.tsx` 接线与 L2：作者 plan 要求新建 Vitest config、`.ts/.tsx` include、`react-test-renderer` devDependency 与 `REAL_TESTS`，并明确 L2 不适用；当前 package 仍是骨架且本轮未运行这些未来命令。不能把计划中的 baseline/red/cleanup 当作事实。
- `UNENFORCEABLE_BY_MACHINE`/L2 边界：作者详设明确空态视觉质量、tier 产品选择、业务调用时机、空数组与 layer-only 产品等价性、真实设备视觉 z-order 不伪造 PASS（`doc/plans/platform/2026-09-03-v2s-terminal-ui-base-render-implementation-design-codex.md:374-378`）。但“没有需要 Dexter 重新裁决的产品取舍”与无 corpus/layerTier 产品选择同时存在，仍由 M-4 保留。

## Final review closeout

SAME_ROOT_SCAN=已对 requirements、IA、implementation-facing design、implementation plan、S-6 design/plan、当前 runtime/ui-state/render source、相关 templates/standards 与 T/R 分母做同根复核；S-7、S-6、诊断分类、tie-break、T-13/R-19、`.tsx` 接线、L2/不可机械判定项均逐项覆盖。作者材料关闭了 tie-break 与主要 adapter/schema 方向，但未关闭 M-1、M-4、S-2、S-3、S-5、S-6。

DESIGN_GAPS=M-1 当前需求与 source 的 S-6/S-7 历史口径仍未统一；M-4 无 Journey corpus 时 layerTier 的产品/技术归因未定；S-2 binding optional/default/exact-ownKeys 未唯一化；S-3 R-14 未划分 skeleton infrastructure export 分母；S-5 render README 未进实施闭包；S-6 RendererBinding 的 `any` typed boundary 未处理。

L1_ENGINEERING=findings：当前 source/package baseline 已读；未运行 render typecheck、Vitest、static/behavior harness。未来 plan 命令、S-6 作者自评与历史输出均未转写为本轮 render 证据。
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON:无产品 Journey/用户操作 corpus，当前授权不含 L2；真实视觉 z-order 与设备触摸/无障碍行为不作结论。
L3_UNVERIFIED=render package 尚无实现、`.tsx` 测试、Vitest config、static/behavior harness；React snapshot/selector/fallback/tree-order 未运行；真实视觉 z-order、fallback 视觉质量、设备行为未验证。
EVIDENCE_TIER=静态设计/源码/模板对账；作者材料中的命令、baseline、mutation、cleanup 与 S-6 自评仅作为文档声明，不是本轮实测证据。

VERDICT=NO-GO
M=2 S=4 N=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
本结论不产生任何 render implementation authorization。
