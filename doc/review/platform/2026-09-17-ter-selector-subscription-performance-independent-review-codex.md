# TER selector 订阅性能优化 · Codex 侧独立审查记录

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_SELECTOR_SUBSCRIPTION_PERFORMANCE_20260917
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
盲审=是；审查者未参与详设/计划写入
执行边界=只读源码/文档审查；未执行构建、测试、动态运行、Web/Metro/Android/DEV/设备/部署/Git
```

## 输入清单

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `project-memory/index.md` 与本任务命中的 TER memory
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md`
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-plan-codex.md`
- `apps/terminal/ui/base/render/src/contexts/RenderContext.ts`
- `apps/terminal/ui/base/render/src/foundations/createRenderSnapshotReader.ts`
- `apps/terminal/ui/base/render/src/components/RenderProvider.tsx`
- `apps/terminal/ui/base/render/src/hooks/useRenderSnapshot.ts`
- `apps/terminal/ui/base/render/src/hooks/useUiStateSelector.ts`
- `apps/terminal/ui/base/render/src/hooks/useUiVariable.ts`
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`
- `apps/terminal/ui/base/render/src/components/LayerStack.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellMobile.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionContent.tsx`
- `apps/terminal/ui/base/admin-shell/src/types/adminSection.ts`
- `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSection.tsx`
- `apps/terminal/ui/base/render/test/renderState.test.tsx`
- `apps/terminal/ui/base/render/test/renderProps.test.tsx`
- `apps/terminal/ui/base/render/test/renderSurface.test.tsx`
- `apps/terminal/ui/base/render/test/layerStack.test.tsx`
- `apps/terminal/ui/base/admin-shell/test/adminLauncher.test.ts`
- `apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts`
- `apps/terminal/ui/base/admin-shell/test/adminSections.test.tsx`
- `apps/terminal/ui/base/render/package.json`
- `apps/terminal/ui/base/render/src/index.ts`
- `apps/terminal/ui/base/render/terminal-invariants.json`
- `tools/terminal-ui-render/check-static.mjs` 及其 self-test
- `doc/platform/terminal-coding-standard.md`
- `doc/decisions/templates/implementation-design-template.md`
- `doc/platform/review-standard.md`

## 独立结论

两名 fresh 只读审查者均认为主方向成立，但认为设计/计划在关键 proof 边界仍可被最省力实现伪绿，Round 1 结论为：

```text
VERDICT=NO-GO
M/S/N=3/1/1
EVIDENCE_TIER=static/readback only
```

### M-1 · stale closure red mutation 未列入硬清单

`useUiStateSelector` 的 selector identity 语义与详设要求已经写出，但计划 B1/B4 原始 mutation 列表没有明确把参数变化、root 不变、缺少 `useMemo/useCallback` 依赖的旧闭包变异跑红。只测 selector identity 变化不能证明参数闭包没有 stale 值。

状态：`CONFIRMED`。

依据：详设 §7.1 已声明 stale dependency case；计划 B1/B4 mutation 表第一轮未明确该 mutation。最小修复是把 parameter-change/stale-closure mutation 加入 B1 的 focused 硬清单和 B4 对账表。

### M-2 · equality 过宽导致真实字段变化被吞的反向证明缺失

原计划有“没有 equality/总 false/新对象多 render”的方向，但没有硬性要求 `() => true` 或漏比较字段的变异必须红。`useUiCatalogContext` 若漏掉 `displayMode`、`workspace`、`instanceMode` 或 `surfaceForm`，字段变化可能被静默吞掉。

状态：`CONFIRMED`。

依据：详设 §5.3 定义 context 字段，原计划 §7.1 只要求字段变化应更新，未将总 true/漏字段列为必红 mutation。最小修复是逐字段反向变异并在 F-5/F-6 断言更新。

### M-3 · public `stateSource` escape hatch 未封口

当前 `apps/terminal/ui/base/render/src/contexts/RenderContext.ts` 的 `RenderContextValue` 公开 `stateSource`，且 `src/index.ts` 公开 `useRenderContext`/类型。只删除 `useRenderSnapshot` 不能阻止未来 admin-shell 或 feature 直接写 `useRenderContext().stateSource.getStatus()`；原计划的 render package 静态门与 admin raw pass-through 不能覆盖所有 `apps/terminal/ui/**/src` production consumer。

状态：`CONFIRMED`。

反例：实现者在一个新的 admin section 中直接从 `useRenderContext()` 取得 `stateSource.getStatus()`，不导入 `useRenderSnapshot`，也不经过 admin section raw prop，因此旧 import 禁令和 section prop 检查均可绿。

处置选择：采用较强但仍窄的 public/private context 分离——public `RenderContextValue` 不暴露 `stateSource`/`snapshotReader`，只在 render framework private accessor 中使用；若 source readback 证明该收窄不可行，再退回 exact-set scan + typecheck/review，不得只扫 render 包就声称全仓闭合。

### S-1 · `@types/use-sync-external-store` direct devDependency 未写入原计划

当前 `use-sync-external-store@1.6.0` 有 `./with-selector` export 和 MIT license，但类型来自 `@types/use-sync-external-store@0.0.6`，现状由 `react-redux` 传递带入。runtime direct dependency 不能保证类型依赖长期存在。

状态：`CONFIRMED`。

最小修复是将 `@types/use-sync-external-store` 纳入 render 包 direct devDependency 和 exact dependency proof；不依赖 `react-redux` 的传递安装。

### N-1 · 路径口径

用户语境中的 `terminal-invariants.json` 必须在交付证据中写完整实际路径 `apps/terminal/ui/base/render/terminal-invariants.json`。

状态：`CONFIRMED` 为表达风险，非方案阻断；计划已使用完整路径，交付时保持一致。

## 处置状态

主 agent 已逐条重开源码后确认以上 M-1、M-2、M-3、S-1，已在详设与计划中修订：

| finding | 处置 | 详设/计划落点 | 状态 |
|---|---|---|---|
| M-1 | 加入 stale-closure focused case 与缺依赖 red mutation | 详设 §7.1；计划 B1、§6 | 已修订，待 Round 2 独立复查 |
| M-2 | 加入总 true/逐字段漏比较 equality red mutation | 详设 §7.1；计划 B1、§6 | 已修订，待 Round 2 独立复查 |
| M-3 | public/private context 分离；外部 source 访问由 public type 封口，private accessor 仅限 framework | 详设 §§4、5、8、9、9a；计划 B1/B3 | 已修订，待 Round 2 独立复查 |
| S-1 | `@types/use-sync-external-store` 纳入 direct devDependency 与 B0/B3 exact proof | 详设 §9a；计划 §§1.2、3.1、4、6 | 已修订，待 Round 2 独立复查 |
| N-1 | 交付路径固定为仓库相对路径 | 详设/计划/handoff 全部实际路径 | 已确认 |

Round 1 未产生 implementation、运行期或性能数字证据；所有 static/focused/native/Android/Web/release/visual/cleanup 结果仍按详设标为 `OPEN` 或 `NOT_APPLICABLE_WITH_REASON`。

## Round 2 · 修订后复查

```text
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
```

一名 fresh 只读审查者完成了指定材料的定向复核，结论为：

```text
VERDICT=GO_WITH_OPEN_VERIFICATION
M/S/N=0/0/0
```

其核对确认：

- stale closure：详设 §7.1、计划 B1 和 §6 已明确参数变化/root 不变/缺依赖闭包的 focused 与 red mutation；
- equality too broad：详设 §7.1、计划 B1 和 §6 已明确总 `true` 以及 `displayMode`、`workspace`、`instanceMode`、`surfaceForm` 逐字段漏比较的反向 mutation；
- public `stateSource` escape：详设 §§4、5、7.2、9a 与计划 B1/B3 已改为 public safe context + framework-private subscription accessor，并要求外部 source 访问由类型或静态边界捕获；
- 类型依赖：`@types/use-sync-external-store` 已纳入 direct devDependency 及 exact proof；
- 跨包分母：计划要求扫描完整 `apps/terminal/ui/**/src/**/*.{ts,tsx}`，若 checker 无法稳定跨包则不得宣称机械全包覆盖；
- `useUiCatalogContext`：当前源码的 context 字段为 `displayMode/workspace/instanceMode/surfaceForm`，保留该 adapter 不构成过度抽象，实施时需 exact 对齐。

该 reviewer 明确所有未执行的 static、focused、typecheck、owned tests、terminal static、native/Android、Web、release/visual、dynamic performance、cleanup 档位仍为 `OPEN` 或 `NOT_APPLICABLE_WITH_REASON`，没有把设计 GO 升格为 implementation/acceptance PASS。

另一名 Round 2 reviewer 只读到部分材料后提前返回过程性 `NO-GO 1M/1S/0N`，其 finding 内容是“尚未完成指定全文/源码核验”，没有提出与修订内容相反的事实。主 agent按项目约定接管未完成的只读核验，重新打开了 `RenderContext.ts`、selector/snapshot source、admin consumers、`terminal-invariants.json`、`check-static.mjs`、详设和计划相关段落；确认该过程性结果不能构成新的设计 finding，但将其作为“reviewer 未完成、由主 agent接管”的审查过程留痕保留。没有再召集第三轮；本 cycle 的 DESIGN review 轮次上限为 2。

### Round 2 收口

```text
CODEX_SIDE_REVIEW=ROUND_2_COMPLETE_WITH_ONE_SUBSTANTIVE_GO_AND_ONE_INCOMPLETE_REVIEWER
CODEX_SIDE_FINAL_DESIGN_STATUS=READY_FOR_CLAUDE_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false
```

这只是 Codex 侧设计复核收口，最终 DESIGN verdict 仍交 Dexter/Claude；实现与动态验证仍未授权、未执行。
