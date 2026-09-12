# TER terminal admin console implementation-facing design independent review — round 2

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B document extraction
REVIEW_CYCLE_ID=TERMINAL_ADMIN_CONSOLE_DESIGN_20260911
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=NO-GO
M/S/N=6/1/0
L1_ENGINEERING=FAIL
L2_USER_VISIBLE=FAIL
L3_UNVERIFIED=focused/Web/Android/native/release/visual evidence
SAME_ROOT_SCAN=PASS_WITH_FINDINGS
EVIDENCE_TIER=静态设计与当前源码对账；未执行动态验证
```

本报告由第二轮 fresh、独立、只读 Codex reviewer 形成。它先重开仓根入口、授权、项目记忆、需求、讨论稿、POC 与 owning source，再读当前 Journey/IA/交互/详设/计划，最后才对照第一轮报告及处置输入。未修改文件，未构建，未运行测试、Web、Android、native、DEV、seed、UAT、部署或 Git。报告是独立审查输入，不是 Dexter 产品裁决，也不授权实施。

## M findings

### M-01 — `AdminSectionMetadata` 契约仍未冻结到可实现形状

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:16-25,61-94; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:252-269`
`DEXTER_DECISION_REQUIRED=否`

详设要求 `UiCatalogEntry` 增加 `adminSection`，但只写了名称、owner/order 语义，没有冻结精确类型、可选规则、非 section 条目的缺省形态或验证形态。当前 catalog 对 entry 字段集合存在严格 exact-key 校验。恶意合规实现可以把任意对象当 section，或让非 section 也携带该字段而不被明确拒绝，导致 A-18/A-20 的对象身份、排序与 projection 不可确定。

最小修复：在详设和计划中冻结完整 `AdminSectionMetadata` union、owner/order 的类型与边界、非 section 条目的缺省/禁止规则、不可变校验和排序 tie-break；然后把同一形状写入 catalog/renderer/sample 注入路径。仅补一段“有 owner/order”不足以指导 exact-key 校验；不需要新 registry 或更大的元数据系统。

### M-02 — command-owner admission 仍缺少 `surfaceForm`

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts:99-104,138-144,176-196; apps/terminal/kernel/base/ui-state/src/features/commands/openLayer.ts:6-16; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:186-189`
`DEXTER_DECISION_REQUIRED=否`

当前 `createOpenLayerActor` 只能从 runtime state 推导 workspace，既有 `openLayer` payload 也没有 `surfaceForm`。详设虽然要求 actor 在 state write 前调用完整 availability predicate，但没有定义完整 admission context 如何到达 command owner。于是 mobile-only layer 在 laptop 上可能在 admission 阶段缺少维度，或只能用错误的默认值放行；render 过滤仍不能修复已写入 state 的无效 layer。

最小修复：明确由 command payload 或 owner context 传入完整的规范化 admission context（至少 form、displayMode、workspace、instanceMode 及 null layer placement），并冻结其构造点、归一化规则、typed rejection 与 no-state-write 断言。沿用现有 actor/command owner；不要把 context 读取搬到 UI，也不要增加第二个 selector。

### M-03 — `SurfaceIdentity` 命名了 token，但生命周期触发仍不可执行

`STATUS=PARTIALLY_CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:10-22,61-79; apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:119-129,207-240; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:203-209`
`DEXTER_DECISION_REQUIRED=是（若业务 layer 去留继续与生命周期绑定）`

详设已补充 `SurfaceIdentity={surfaceKey,displayIndex,surfaceForm,displayMode}`，但“keyed/remounted by token”仍可能被实现成整棵 `SurfaceRoot` remount，也没有冻结 identity 的比较点、effect 顺序、旧/新 snapshot 的可见时序和 admin-only cleanup 的先后。整棵 remount 可能错误丢失业务状态，与“保留业务内容/业务 layer”的目标冲突；只依赖 `displayMode` 仍漏掉同 mode replacement。

最小修复：在详设中明确 identity 比较发生在 SurfaceRoot/host lifecycle 的哪个 effect 或 owner 边界，先后顺序必须是 snapshot/geometry 更新 → blur 旧 field → 仅关闭已知 `admin.console` → 清除 admin-local auth/selection/scroll/focus → 再渲染新 surface；禁止用整棵 remount 代替该顺序。业务 layer 是否保留必须先由 Dexter 决定，否则该条继续阻断。

### M-04 — 需求声称无待裁决，但设计仍依赖业务 layer 去留裁决

`STATUS=DEXTER_DECISION`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md:610-619; doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md:117-126; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:33,204`
`DEXTER_DECISION_REQUIRED=是`

需求 §11.1 写明“无”待裁决，但 Journey、详设和计划仍把“动态 surface replacement 是否保留已打开业务 layers”写成 Dexter 决策。该语义直接改变 cleanup command：当前 `clearLayers` 会按 display mode 清掉所有 layer，admin-only close 与 clear-all 的结果不同。不能以需求的“待裁决为零”覆盖设计阶段重新暴露的 owner/产品歧义。

最小修复：Dexter 明确保留或关闭业务 layers，并同步 requirements 解释、Journey、IA、交互、详设、计划及生命周期 focused oracle；在裁决前不实现、不声称设计闭环。修复不应新增 overlay stack，只应选定一个已有 owner 的最小 cleanup 语义。

### M-05 — native-less focus 的具体 option/result/registration 链仍未闭合

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/ui/base/input/src/types/types.ts:56-62,89-99; apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts:122-160; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:149-161`
`DEXTER_DECISION_REQUIRED=否`

详设提出 nullable native ref、`focusScopeId` 和虚拟输入，但未冻结 native-less field 的具体 option/result/registration 形状、`focusField`/`completeField` 的行为、scope 切换时谁保存/恢复目标，以及虚拟按键如何写入唯一 password string。当前 controller 仍默认通过 native ref focus；因此可以出现“设计声称 admin 可聚焦，但实现只能拒绝 null ref”的静默失败。

最小修复：逐字段冻结 `InputFieldOptions`、registration、result 的新增/保留字段，明确 null-ref 分支、`focusScopeId` 默认值、`activateFocusScope`、`focusField`/`blurField`/`completeField` 和 virtual-key dispatch 的调用顺序，并让 step-3 pre-probe 与 step-8 A-15 使用同一接口。仍复用现有 `InputController`，不新建键盘或输入管线。

### M-06 — 三个内建 section 的生产注册/组合 owner 未定义

`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:148-168; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md:211-220; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:331-350`
`DEXTER_DECISION_REQUIRED=否`

文档宣称四个 section 都来自同一 `UiCatalog`，并明确了 sample section 的生产 `definedParts` 注入；但三个内建 section 的 part/renderer owner、生产 exports、注册入口和 assembly 合并顺序没有冻结。这样可以有一个测试 catalog 里出现四项，而真实 assembly 只有 sample 注入，或 admin-shell 自己另建列表；A-18/A-20 的同一 catalog 生产路径仍不闭合。

最小修复：明确 admin-shell 内建三节的 production part/renderer exports、其 admin metadata、sample-console 的组合/合并入口及顺序；四项都必须由 assembly 形成同一不可变 catalog projection。仍不需要第二 registry，也不要求把 admin-shell 依赖倒灌到 feature 包。

## S findings

### S-01 — loading 方案依赖 render→primitives 的 package 边界未落笔

`STATUS=CONFIRMED`
`SEVERITY=S`
`PATH_OR_SYMBOL=apps/terminal/ui/base/render/package.json; apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx:1-12; doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md:303`
`DEXTER_DECISION_REQUIRED=否`

计划要求 host loading 使用 `PR-3 Spinner`，但当前 render package 未显示 primitives 依赖，且详设/计划未写明 render→primitives 的导入边界、是否由 vendor 提供 Spinner、如何避免 package cycle。实现者可能直接从 `react-native` 加一个指示器，违反 vendor/primitive 纪律，或把 loading 依赖绕入错误 owner。

最小修复：在详设与计划中明确 render→primitives 的依赖与导入路径、循环检查和 loading testID owner；若当前 package 拓扑不能安全引入，则明确一个已存在的 terminal owner 并说明原因。只补 package dependency/owner 边界即可，不需要新的 loading framework。

## 证据与边界

- static：本报告只使用当前源码、需求、模板、详设、IA、交互和计划的静态对账；无静态门运行结果。
- focused：未执行。所有 focused test、红夹具和真实控件动作仍是计划，不是通过证据。
- Web：未执行；不能把 dev-host 设计输入当作 Web PASS。
- Android：未执行；不能把双屏模拟器可用性或历史截图当作 Android PASS。
- native：未执行；Kotlin/adapter 只完成源码核对。
- release：未执行；不能证明 PROD 包调试态或系统键盘退役。
- visual：Dexter wireframe review 仍未设置/接受；交互文档的低保真线框不等于完整视觉验收。

## 结论

第二轮是本 `REVIEW_CYCLE_ID` 的最终独立轮次，`ROUND_FINAL_DECISION=SELF_DECIDED`。设计包为 `NO-GO (6M/1S/0N)`。在 M-01、M-02、M-03、M-05、M-06、S-01 修复并经后续授权复核前，以及 M-04 的业务 layer 去留裁决完成前，不得进入源码实施；本轮 review 不授权任何实施。
