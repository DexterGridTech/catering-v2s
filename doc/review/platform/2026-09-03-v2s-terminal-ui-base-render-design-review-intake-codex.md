# `ui.base.render` DESIGN review findings intake（Codex）

```text
REVIEW_CYCLE_ID=2026-09-03-TER-UI-BASE-RENDER-DESIGN-01
REVIEW_TARGET=DESIGN
SOURCE_REVIEW_ROUND=1
INTAKE_ROLE=AUTHOR_DIALECTICAL_INTAKE
IMPLEMENTATION_AUTHORITY=false
```

本记录只处理 fresh independent reviewer 的 round-1 findings，不把 reviewer 的结论整包接受为事实。
每项都重新打开当前 source、需求/设计/计划与适用规范，区分静态确认、设计推论与未运行证据；不修改
render source，也不把本记录当作 render implementation authorization。

## M findings

### M-1 · requirements 的 S-6/S-7 历史口径

`STATUS=PARTIALLY_CONFIRMED;REPAIR=SOURCE_PRECEDENCE_EXPLICIT`

- 重新确认的静态事实：requirements 仍包含 pre-S-6/S-7 的历史叙述；当前 source 是
  `apps/terminal/kernel/base/ui-state/src/types/catalog.ts`、`apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts`
  与 `apps/terminal/kernel/base/runtime/src/types/runtime.ts`。
- 最小修复：IA、详设、计划统一写明 `CURRENT_SOURCE_WINS`，把历史段标成非当前事实；当前设计只消费
  `containerKeys` 与 `Runtime.status/getState/subscribe`，禁止兼容字段、getStore fallback 或双形状。
  未来实现前由 owner 同步需求稿 wording，但不因文档历史状态在 render 内制造第二契约。
- 适用边界：本轮没有权限改需求稿；因此保留“实现前 owner 同步”作为实施前置，不把它误报为当前 source
  或设计未收敛。

### M-2 · stateSource 形态

`STATUS=REPAIRED_BY_DESIGN;REMAINING=UNVERIFIED_RUNTIME`

- 当前 Runtime 事实：公开的是 readonly `status`、`getState`、`subscribe`，没有 `getStatus()` 方法，且
  `getState` 在非 started 时抛错。
- 最小修复：Provider 只接内联窄对象；集成层以 `getStatus: () => runtime.status`，并闭包调用
  `runtime.getState()`/`runtime.subscribe()`。render 不接完整 Runtime、store 或 dispatch。
- 适用边界：React snapshot/adapter 尚未在 render 运行，因为本轮不授权 render implementation；future T-10
  负责证明运行语义。

### M-3 · 诊断 schema

`STATUS=REPAIRED_BY_DESIGN;REMAINING=REQUIREMENTS_ALIGNMENT`

- 最小修复：将 `runtime-status-changed` 明确为 Provider-level lifecycle observation；三项 part error 继续
  使用 `missing-catalog-entry`、`missing-renderer`、`invalid-props-shape`，不带 partKey 的 lifecycle event
  不塞入 part diagnostic 闭集。
- 适用边界：需求稿的历史文字仍需 owner 在实现前同步；本轮不把诊断设计写回 requirements。

### M-4 · layerTier 的归因

`STATUS=REPAIRED_BY_BOUNDARY;PRODUCT_ASSIGNMENT=UNENFORCEABLE`

- 重新确认的推论边界：本包没有 Journey corpus，不能从 POC 或下游名称推断某个业务 renderer 的产品 tier。
- 最小修复：`standard` 在 `alert` 之前只被定义为已接受的 render 技术树排序约束；具体业务 part 的 tier
  由 renderer binding 提供，render 不替业务选择。空态视觉质量、业务 command 时机与真实设备 z-order
  仍保留 `UNENFORCEABLE_BY_MACHINE`/`L2_UNVERIFIED`。
- 适用边界：如果未来要改变技术排序，或将其提升为产品/Journey 语义，必须重新取得 Dexter 裁决；本轮
  不新增产品决定。

## S findings

### S-1 · layer tie-break

`STATUS=CLOSED`

顺序固定为 tier → `openedAt` → `layerId`，相同时间以字典序收敛；详设与计划都已写入，行为仍待 future
render implementation proof。

### S-2 · RendererBinding canonical shape

`STATUS=REPAIRED_BY_DESIGN`

`RenderComponentProps=object`、`RenderComponent<TProps extends RenderComponentProps>` 与
`RendererBinding<TProps extends RenderComponentProps>` 是具名边界；不使用 `any` 或开放
`Record<string, unknown>`。`definePart` 省略 tier 时只在 factory 内默认 `standard`；自有 `undefined`
非法；输出 binding ownKeys 精确为 `rendererKey/component/layerTier`。catalogEntry 仍由真实 ui-state
ownKeys validator 校验，文案不进入 binding。

### S-3 · public export denominator

`STATUS=REPAIRED_BY_DESIGN`

R-14 拆为 `INFRASTRUCTURE_EXPORTS`（现有且保持不变的 `moduleName`、`dependencyModuleNames`、
`devDependencyModuleNames`）与 `DOMAIN_EXPORTS`（13 项），最终 public total=16。未来 index 与 invariant
分别对账两组，不能把领域 13 项误当成全包 13 项。

### S-4 · render 侧 T-10 覆盖不足

`STATUS=REPAIRED_BY_DESIGN;REMAINING=UNVERIFIED_RUNTIME`

T-10 已扩为 render 消费侧的 focused 观察：pre-start 不调 getState、starting→started 可用重读、started
state change 同步重读、failed 通知并显示 unavailable、failed 后无残留通知、unsubscribe exactly once
且 source 退订幂等、同 root selector 引用稳定/root 变化才重算；fake source 的 listener 集合与调用记录提供
退订与门控 oracle。Runtime 内部仍由 S-6 测试拥有，不重复声称 render 已通过。

### S-5 · package README

`STATUS=REPAIRED_IN_IMPLEMENTATION_DENOMINATOR`

future render implementation 的 §9a denominator、CP0 盘点与 CP5 收口增加 package-root 中文 `README.md`，
按 TR-10 对照定位、作用、结构、真实公开面用法与迭代说明。本轮不创建 README，避免越过 render implementation
授权。

### S-6 · any typed boundary

`STATUS=REPAIRED_BY_DESIGN`

公共 binding 改为具名 generic contract；state JSON props 的普通对象检查仍是运行时安全门，不被错误宣称为
TypeScript 已知业务 props schema。future CP1 若异构 binding 收集无法在该具名边界保持类型安全，必须停步修
类型设计，不能以 `any` 或双重 cast 止血。

## Evidence boundary

- 当前只完成设计文档与计划层修订，以及已授权的 S-6 supplementary runtime evidence；render 尚无实现、Vitest、
  `.tsx` 测试、静态/behavior harness 或 React focused output。
- 不把 S-6 输出转换为 render 实现证据；不把视觉质量、业务 tier 选择、command 时机、产品空态等价性、真实
  设备 z-order包装成机器 PASS。
- round-2 reviewer 必须重新读取当前 source 与本记录引用的修订文档，先盲审再读取本记录与 round-1 artifact。
