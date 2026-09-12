# 给 Claude 的 TER terminal admin console 修复后详设与实施计划复审 brief

## 背景

本次请复审 TER terminal admin console 的修复后 implementation-facing 设计包与实施计划。需求正本由 Claude 编写；其作者自组织的盲审不构成你的独立性。历史上已有两轮 fresh 独立设计对抗审查，第二轮在 Dexter 两条裁定后仍为 `NO-GO (6M/2S/2N)`。

本轮不是第三轮独立子 agent 审查，也不重写历史 verdict；它是对历史 `NO-GO` 处置后的当前字节做新的 Claude review。历史第二轮没有读过这些修订后的字节，因此不得把历史计数扩写成当前修订已通过。当前修复 intake 已明确记录了这一边界。

Dexter 已给出的两条后续产品裁定作为本轮输入：

1. 动态 surface replacement 保留全部 business content 与 business layers，只关闭被替换 surface 上的瞬时 `admin.console` layer；kernel state 是恢复来源，admin layer 是 AC-4 下的唯一 targeted exception。
2. section 按单一 `UiCatalog.entries` 过滤后的 list 顺序排列，不再引入独立 order key 或第二套 owner/order metadata registry。

修复仅涉及 Journey、IA、UI interaction design、implementation design、implementation plan 与 review intake；没有修改生产源码，没有构建，没有运行 Web/Android/native/DEV/seed/UAT/deployment，也没有取得任何新的动态或视觉证据。当前仍为 `IMPLEMENTATION_AUTHORITY=false`，wireframe/visual decision 仍未批准。

## 评审目标

请独立判断修复后的设计是否真的消除了历史根因，而不是只检查文档是否换了措辞：

- 判断方案是否解决终端操作员的真实问题，是否存在更简单、复杂度更匹配当前阶段的替代；
- 判断五层批内顺序、owner 边界、数据流、契约和失败/恢复语义是否闭合；
- 判断 catalog、surface form、物理 display index、host bool/source、layer identity、焦点、输入、loading、动态切换与生产 section 注入是否可实施且只有一个事实来源；
- 判断当前修复是否把一个问题从文档层移到了另一个 owner，尤其是 `surfaceForm` state 来源、上一 surface 的 `displayMode` 清理、`partKey` 与 `layerId` 混用，以及 admin-shell 的三节生产 owner；
- 判断判据与 focused proof 是否真的能证伪恶意但合规实现，不能把计划、静态文本、欢迎语或历史记录当作行为证据。

## 需阅读文件

请从 `catering-v2s` 仓库根按以下顺序打开当前字节：

1. `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/roadmap-program-registry.json` 中当前显式程序的授权字段、`project-memory/index.md`、相关六维路由记忆、`scripts/README.md`：恢复约束与授权边界；
2. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md`：需求正本、版本沿革、A/AC/CT/ID/DBG/PR 条款、§9、§9.2、§11.3–§11.5；特别核对 A-19 的当前字面；
3. `doc/review/platform/2026-09-11-v2s-terminal-admin-console-poc-analysis-and-design-discussion-claude.md`：两版 POC 的事实分析与讨论稿；公式以当前设计内联文本为准，不依赖外部绝对路径；
4. `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md`：Journey、入口、退出、动态替换和用户路径；
5. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ia-design-codex.md`：不可见 IA、数据/owner/状态/失败边界；
6. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md`：真实控件、交互路径、可访问性、UI 合理性和证据档位；
7. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md`：修复后的 owner、契约、CP、横切机制表、同步矩阵、场景和 OPEN；
8. `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md`：修复后的五层步骤、代码锚点、依赖边、A-1–A-59 判据、逐代码对账与交付闸门；
9. `doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-remediation-intake-codex.md`：作者对历史 findings 的处置声明；只能当作待核验清单，不能当作质量证明；
10. `apps/terminal/kernel/base/ui-state/src/types/catalog.ts`、`apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts`、`apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts`、`apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts`、`apps/terminal/kernel/base/ui-state/src/types/content.ts`、相关 `openLayer`/`closeLayer` command：核对 catalog exact shape、state owner、准入、layer identity；
11. `apps/terminal/ui/base/render/src/foundations/definePart.ts`、`apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`、`apps/terminal/ui/base/render/src/components/LayerStack.tsx`、`apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`、`apps/terminal/ui/base/render/src/components/RenderProvider.tsx`、`apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts`、相关 host source/snapshot：核对 render、loading、焦点与动态替换；
12. `apps/terminal/ui/base/input/src/types/types.ts`、`apps/terminal/ui/base/input/src/hooks/useInputField.ts`、`apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts`、`apps/terminal/ui/base/input/src/components/InputProvider.tsx`：核对 native-less virtual input、null ref、scope 与 keyboard ownership；
13. `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`、`apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx`、`apps/terminal/skeleton-graph.ts`、相关 terminal `package.json`、`tools/terminal-skeleton/check-static.mjs`：核对物理 index、host source、Web 映射、production section 注入及 graph/package 边；
14. 历史报告 `doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-independent-review-round-2-codex.md`：只用于了解历史结论，不能替代当前字节复核。

## 独立核验重点

请先从需求和 owning source 自己推导预期行为，再对照修复文档。至少核验以下阻断项：

### 已修复但必须重新证伪

- M-1：`UiCatalogEntry` 的最终 exact-key set 是否统一为 `partKey`、`rendererKey`、`containerKeys`、`displayModes`、`workspaces`、`instanceModes`、`surfaceForm`、`title`、`description`；`approvedEntryKeys`、`assertEntryKeys`、`canonicalEntry`、`definePart` 和 fixtures 是否都被覆盖，是否仍有可选 admin metadata 偷渡；
- M-2：`surfaceForm` 是否真的由每个 assembly/module 一次初始化的 `ui-state` slice 持有，`persistIntent=never`、`syncIntent=isolated`、无 setter；准入与 render context 是否都读 `selectSurfaceForm(root)`，而不是另加 React prop/open-layer payload；
- M-3/M-5：动态替换是否保留 React `SurfaceRoot` identity、保留所有 business layers，仅按生命周期顺序 blur → 用上一 surface 的 `displayMode` 关闭 targeted admin layer → 丢弃 admin local state；是否仍有 whole-root remount、`clearLayers` 或错误 display-mode no-op；
- M-4：`partKey` 与 `layerId` 是否使用四个单一常量区分，open/close/focus/renderer 是否一致，A-57 是否真的检查 admin layer count 为零而 business layer IDs/state 不变；
- M-6：`InputFieldOptions`、`InputFieldRegistration`、`InputFieldResult` 与 `InputController.activateFocusScope(scopeId)` 是否冻结了 native-less 形状；null native ref 时 virtual focus/complete 是否仍成功，是否没有静默变成 no-op 或第二套键盘；
- M-7：三节内建 section 与 console layer 是否由 `admin-shell` 的一个 production assembly 负责，`sample-console` 是否按 admin-shell → feature → title-only sample 的顺序合并，是否仍存在 fixture-only section/hard-coded list/feature 反向依赖；
- S-1：密码向量是否带 `localDate=2026-09-10`，local time 构造是否明确，是否没有把外部 POC 绝对路径当实施依赖；
- S-2：`render → primitives`、`admin-shell → display-context`、`admin-shell → input`、`sample-console → admin-shell` 是否在 skeleton graph、package dependencies/plannedDependencies 和 checker 预期中同步，且无环；
- 新增交互：导航是否真的切换内容，关闭是否真的移除 layer，重新打开是否回登录态，所有动作是否经过真实控件而非 setter。

### 当前仍可能阻断的 OPEN

- A-19：需求正本当前仍写 `owner` 与 order key，而修复设计依据后续 Dexter 裁定删除 order key，并把 owner 降为 assembly provenance。请判断这是必须由需求 owner 先协调的真实 requirements/design contradiction，还是 owner 仍有未说明的独立语义；不要静默选一边；
- N-2：`maxMounted=24` 目前只有设计约束，没有 100-row、逐次 scroll transition 的 focused 证据。请保持 `UNVERIFIED_REQUIRES_EVIDENCE`，不要因为公式 `16+4+4` 看起来成立就把它报成 PASS；同时判断这是否足以阻断设计交付；
- 当前修订字节未经历史第二轮复审；不得报告“历史 reviewer 已确认修复”。本次 Claude review 也不替代同一 cycle 已达到上限的第三轮独立子 agent；
- wireframe/visual review、focused、Web、Android、native、release 均未在本轮取得；必须逐档报告，不能把静态设计或计划升级成视觉/运行验收；
- 检查五层顺序是否有隐含倒置：形态来源 → 系统键盘原子退役/契约 → 设备标识/调试态 → foundations/loading/dynamic → admin-shell/section/注入；焦点前置探针在第 3 步，A-15 在第 8 步之后；
- 检查 §9.2 是否仍停放了本应有行为判据的条款，A-1–A-59 是否逐项有真实红夹具；不要采信作者的覆盖数字。

### 方案与交互合理性

请单独回答：

1. 这个方案是否真正解决“在 host display 上打开本机只读诊断而不破坏业务 surface”的用户问题；
2. 为什么单一 catalog projection、既有 LayerStack/InputController、物理 index 边界和一次性 state fact 比 hard-coded admin list、route/menu、独立 registry、persisted session 或整根 remount 更合适；有没有更简单替代；
3. 当前全量 primitives 的已知代价是否被诚实记录，A-36 兜底是否足够，是否出现为了审查而过度工程；
4. launcher、keypad、section navigation、close/reopen、dynamic replacement 是否来自明确 Journey，用户在该时点操作是否自然，是否有更短路径；若不合理，请归因于 product/Journey 未裁决、owner/contract 限制、旧文档模糊或历史惯性，并在必要时标 `DEXTER_DECISION`。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并提供 `M/S/N` 三档数量。每条 finding 必须包含：

```text
ID
STATUS=CONFIRMED | PARTIALLY_CONFIRMED | REJECTED_WITH_EVIDENCE | UNVERIFIED_REQUIRES_EVIDENCE | DEXTER_DECISION
SEVERITY=M | S | N
仓根相对路径 + 行号或唯一符号
失败场景（优先构造恶意但合规实现）
影响面
最小修复方向，并说明为何更小修复不够
是否需要 Dexter 产品裁决
证据档位=static | focused | Web | Android | native | release | visual
```

另请单列：

- 被你推翻的作者结论清单；
- 当前修复文档仍漏掉、但本批必须回答的问题；
- 区分仓内事实、推论、产品判断与尚缺证据假设；
- 不要把历史 review、作者 remediation intake、focused 计划、欢迎语完整或静态结果扩写成完整视觉验收 PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER terminal admin console 修复后的 implementation-facing 设计与实施计划做一次独立复审。

背景：历史两轮 fresh 独立设计对抗审查在 Dexter 两条后续裁定后仍为 NO-GO（6M/2S/2N）。作者已据此修订 Journey、IA、UI interaction design、implementation design 和 implementation plan，但历史第二轮没有读过修订后的当前字节。本次请复审修复后的当前字节，不把历史 verdict 或作者 remediation intake 当作修复证明；这不是第三轮独立子 agent 审查，也不重置历史 cycle。

目标：独立核验修复是否真正消除了 catalog exact-key/form 单源、物理 display index 到 host source/bool、layerId 精确清理、business-layer retention、native-less input、admin-shell 三节生产 owner、sample-console 生产 section 注入、密码向量日期和 skeleton graph/package 边等根因；同时判断方案合理性、五层顺序、UI Journey 合理性、判据可证伪性和剩余 OPEN。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md：需求正本，特别是 A-19、§9/§9.2、§11.3–§11.5；
- doc/review/platform/2026-09-11-v2s-terminal-admin-console-poc-analysis-and-design-discussion-claude.md：POC 分析与讨论稿；
- doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md：Journey；
- doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ia-design-codex.md：IA；
- doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md：UI interaction；
- doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-design-codex.md：修复后的详设；
- doc/plans/platform/2026-09-11-v2s-terminal-admin-console-implementation-plan-codex.md：修复后的实施计划；
- doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-remediation-intake-codex.md：作者处置声明，只作为待核验清单；
- apps/terminal/kernel/base/ui-state/src/types/catalog.ts、apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts、apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts、apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts、apps/terminal/kernel/base/ui-state/src/types/content.ts 及 openLayer/closeLayer command：核对 catalog、state、准入和 layer identity；
- apps/terminal/ui/base/render/src/foundations/definePart.ts、apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx、LayerStack.tsx、ScreenContainer.tsx、RenderProvider.tsx、SurfaceContext.ts、host snapshot/source：核对 render/loading/focus/dynamic；
- apps/terminal/ui/base/input/src/types/types.ts、useInputField.ts、useInputFocusController.ts、InputProvider.tsx：核对 native-less virtual input 与 scope；
- apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx、apps/terminal/ui/base/dev-host/src/components/testExpoApp.tsx、apps/terminal/skeleton-graph.ts、相关 package.json、tools/terminal-skeleton/check-static.mjs：核对物理 index、Web 映射、生产 section 注入和依赖边；
- doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-independent-review-round-2-codex.md：仅作历史背景，不能替代当前复核。

请重点核验：
1. A-19 的需求字面仍有 owner/order key，而修复设计采用 Dexter 后续裁定的 list-order/no metadata；请不要静默选边，判断是否必须先做 requirements owner reconciliation；
2. N-2 的 maxMounted=24 只有设计约束，100-row scroll-transition focused proof 尚不存在，请保持 UNVERIFIED_REQUIRES_EVIDENCE，不要把 16+4+4 的算术当成行为证明；
3. form 是否只有一个 ui-state source；catalog exact-key/canonical/definePart 是否原子一致；layer-only containerKeys=[] 与 admin.sections 是否共用一个 selector；
4. host bool/source 是否都端到端来自 physical displayIndex，canvas 是否仍按 displayMode，Web 与 host-pending 中间态是否没有硬编码或门禁偷换；
5. 动态替换是否保留 React root/business layers，只按上一 displayMode 关闭 exact ADMIN_CONSOLE_LAYER_ID，并丢弃 admin auth/selection/scroll/focus；是否仍有 clearLayers、whole-root remount、错误 mode no-op 或焦点静默失败；
6. native-less input 的 null ref 是否仍能完成 virtual focus/complete，是否没有第二套键盘；admin-shell 是否真正拥有三节与 console，sample section 是否由 sample-console 通过生产 catalog 注入；
7. render→primitives、admin-shell→display-context/input、sample-console→admin-shell 是否同步存在于 graph、package manifest 与 checker 预期；
8. 导航、关闭、再次打开是否真实改变内容/移除 layer/回到登录态；每条 A-1–A-59 是否有可证伪红夹具，§9.2 是否错误停放行为义务；
9. 方案是否解决真实用户问题，是否有更简单替代，复杂度是否匹配当前阶段；每个 UI 操作是否来自明确 Journey、在当前时点合逻辑且没有更短路径。

请给出明确 GO 或 NO-GO，并给出 M/S/N 计数。每条 finding 必须包含：ID、STATUS（CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION）、SEVERITY（M/S/N）、仓根相对路径与行号或唯一符号、失败场景、影响面、最小修复方向及为什么更小修复不够、是否需要 Dexter 裁决、证据档位（static/focused/Web/Android/native/release/visual）。另请单列被推翻的作者结论和当前文档仍漏掉的问题，并严格区分事实、推论、产品判断与缺证据假设。

授权边界：本轮只评当前详设与计划及其 owning source，不实施、不改源码、不构建、不运行 Web/Android/native/DEV/seed/UAT/deployment；不要把静态、focused 计划、欢迎语完整、历史 review 或作者 intake 扩写成完整视觉验收 PASS。结论只授权本次设计/计划复审，不授权实施、Roadmap 下一步、Git 或任何动态环境操作。谢谢。
```
