# TER React UI selector 订阅边界 implementation review 交接

```text
REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_AUTHORITY=true
REVIEW_STATUS=OPEN
IMPLEMENTATION_PASS=NOT_CLAIMED
ACCEPTANCE_PASS=NOT_CLAIMED
CLAIM_BOUNDARY=static、focused、源码回读与三维对账已留证；native/Android、Web、release/visual、managed cleanup 与性能结论不在本轮范围
```

## 背景

本轮依据 Dexter 已批准的 selector 订阅详设与实施计划完成 TER React UI 的实现和限定验证。Claude
round2 design review 为 `GO, 0M/0S/3N`；N-1、N-2、N-3 已在实现批同步处置。当前交付对象是
implementation review，不把 design review 或本地命令结果当作 implementation/acceptance 结论。

实施目标是把 React UI 的状态读取收口到 selector-aware framework hook：业务组件使用
`useUiStateSelector`，生命周期使用 `useRenderStatus`，catalog context 使用窄 equality；删除生产
`useRenderSnapshot` 入口，收窄 public context，补齐 TR-15、静态门、focused oracle 与 red mutation。
`ScreenContainer` 的失败分类、ready 分支、业务命令和用户 Journey 没有在本批改变。

实施证据总表：
`doc/evidence/platform/2026-09-17-ter-selector-subscription-implementation-codex.md`

## 评审目标

请独立从当前源码和原始输出核验：

1. B0 direct dependency、React peer-resolution anchor、public export/invariant 与 package whitelist 是否
   真正闭合，而不是以传递依赖或测试通过替代直接契约；
2. `useSyncExternalStoreWithSelector`、status-only subscription、catalog equality、selector identity、
   unavailable/`undefined` 语义和 unsubscribe 行为是否与详设一致；
3. render/admin 的所有生产 full-snapshot 与 raw state pass-through 是否已迁移，public context 是否
   仍可能被外部 UI 读取 raw source；
4. F-1 至 F-12 的执行体是否验证对应性质，尤其是 render-count/value oracle，而非 selector call count；
5. 每条新增 static rule 和 behavior contract 是否有真实 production-like red mutation，mutation 真发生
   时是否会红，fixture cleanup 是否单独可见；
6. 步骤级三维对账、全批三维对账和逐代码与详设对账是否按顺序完成，是否存在 scope drift、遗漏或
   把未授权档位升格为 PASS 的说法。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md`：实现契约、TR-15、F-1–F-12、§9a 变更分母与证据边界；
- `doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-plan-codex.md`：B0–B4 顺序、red mutation、计划 §7 逐代码对账与交付闸门；
- `doc/evidence/platform/2026-09-17-ter-selector-subscription-implementation-codex.md`：实际改动、首败与根因、命令结果、对账和证据分档；
- `doc/review/platform/2026-09-17-ter-selector-subscription-design-review-round2-claude.md`：此前 design review 的 GO 与三条 Note；
- `doc/review/platform/2026-09-17-ter-selector-subscription-b3-step-reconciliation-codex.md`：B3 首次 OPEN 的修复与 fresh MATCHED；
- `doc/review/platform/2026-09-17-ter-selector-subscription-b4-pretest-reconciliation-codex.md`：全批三维对账与测试前主 agent readback；
- `doc/platform/terminal-coding-standard.md`：TR-03 与新增 TR-15 的规范正本；
- `apps/terminal/ui/base/render/package.json`、`apps/terminal/package.json`、`yarn.lock`：direct dependency、类型依赖和 workspace peer-resolution；
- `apps/terminal/ui/base/render/src/contexts/RenderContext.ts`、`apps/terminal/ui/base/render/src/components/RenderProvider.tsx`：public/private context boundary 与 source owner；
- `apps/terminal/ui/base/render/src/hooks/useUiStateSelector.ts`、`useRenderStatus.ts`、`useUiCatalogContext.ts`、`useUiVariable.ts`：订阅实现与 equality；
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`、`LayerStack.tsx`、`src/index.ts`、`terminal-invariants.json`：生产消费者和 public surface；
- `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx`、`AdminShellLaptop.tsx`、`AdminShellMobile.tsx`、`AdminSectionContent.tsx`、`src/types/adminSection.ts`、`src/components/sections/DisplayContextSection.tsx`、`RuntimeSection.tsx`：admin 迁移与 raw pass-through 收口；
- `apps/terminal/ui/base/render/test/renderState.test.tsx`：F-1–F-6、catalog 字段 equality 与 selector contract focused oracle；
- `tools/terminal-ui-render/check-behavior.mjs`、`check-static.mjs`、`check-static.test.mjs`：行为/static red mutation 与真实生产 static 规则；
- `.runtime/ter-selector-subscription/2026-09-17/`：所有本轮原始命令、首败和重验日志。

## 实际改动清单

完整清单及每项目的见 evidence §1。核心实际改动为：

- `apps/terminal/package.json`、`apps/terminal/ui/base/render/package.json`、`yarn.lock`；
- `apps/terminal/ui/base/render/src/contexts/RenderContext.ts`、`src/components/RenderProvider.tsx`、
  `src/hooks/useUiStateSelector.ts`、`useRenderStatus.ts`、`useUiCatalogContext.ts`、`useUiVariable.ts`、
  `src/components/ScreenContainer.tsx`、`LayerStack.tsx`、`src/index.ts`、`terminal-invariants.json`；
- 删除 `apps/terminal/ui/base/render/src/hooks/useRenderSnapshot.ts`；
- `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx`、`AdminShellLaptop.tsx`、
  `AdminShellMobile.tsx`、`AdminSectionContent.tsx`、`src/types/adminSection.ts`、
  `src/components/sections/DisplayContextSection.tsx`、`RuntimeSection.tsx`；
- `apps/terminal/ui/base/render/test/renderState.test.tsx`；
- `tools/terminal-ui-render/check-behavior.mjs`、`check-static.mjs`、`check-static.test.mjs`；
- `doc/platform/terminal-coding-standard.md`、`apps/terminal/ui/base/render/README.md`；
- 详设、实施计划、B3/B4 对账记录与本 implementation evidence。

## 独立核验重点

### 1. 订阅与公共面

- `RenderContextValue` 不应包含 `stateSource`/`snapshotReader`；只有 framework-private accessor 可供
  selector/status hook 使用，`console-assembly` 的注入是基础设施边界，不得下传到业务 UI。
- `useUiStateSelector` 必须订阅 selector 结果而不是完整 root；selector identity、完整依赖、
  `undefined` 业务值和 runtime status 必须保持各自语义。
- `useUiCatalogContext` 的 equality 必须覆盖 `displayMode`、`workspace`、`instanceMode`、`surfaceForm`；
  equality 必须是通知路径上的常数时间浅比较。
- `useRenderSnapshot` 的生产 caller、public export、旧文件和 invariant 条目都应为空/删除；请检查
  `apps/terminal/ui/**/src`，不要只检查 render 包。

### 2. 真实 red mutation

行为 harness 最终记录 36 个 red vectors，重点核验
`SELECTOR_FULL_SNAPSHOT`、`SELECTOR_NO_EQUALITY`、`SELECTOR_IDENTITY_STALE`、
`STATUS_READS_ROOT`、`MISSING_UNSUBSCRIBE`、`CATALOG_EQUALITY_ALWAYS_TRUE` 及四个 catalog 字段遗漏；
每项 mutation 应实际造成 focused assertion 非零退出。

static self-test 最终记录 31 个 red mutations，重点核验缺 direct runtime/type dependency、恢复旧 hook、
恢复 public raw context、恢复 admin raw pass-through、删除静态规则等变异；不要以字符串存在/退出码
单独当作业务 oracle。`b3-static-production.log` 与 `final-07-terminal-static.log` 应显示 10 条 render
static rule、support 和 terminal static 的正常基线通过。

### 3. 失败与边界

- render typecheck 的首败是 `renderState.test.tsx` catalog fixture 的重复 `selectSurfaceForm` binding
  与 unknown props；请核对 first-failure、最小修复和 focused 重验，而不是只看最终绿日志。
- terminal static 的首败是 `AdminLauncher.tsx` 的 `measureInWindow` 四测量值回调触发既有 TR-R04；
  修复应保留 RN callback contract，不应删除 readability gate。
- B3 首次 reviewer 的外部 raw-context fixture 缺口已补真实变异并由 Banach fresh 复查；不能把首次
  `OPEN` 隐去。
- 未执行 native/Android、Web、release/visual、managed long-running cleanup 和真实性能研究必须保持
  `NOT_APPLICABLE_WITH_REASON`/`OPEN`；不接受把 static/focused 结果写成整体 implementation 或 acceptance GO。

### 4. 七条整体命令

| 命令 | 结果 | 原始输出 |
|---|---|---|
| `yarn workspace @catering-v2s/ui-base-render typecheck` | `PASS` | `.runtime/ter-selector-subscription/2026-09-17/final-01-render-typecheck.log` |
| `yarn workspace @catering-v2s/ui-base-render test` | `PASS`，13 files / 82 tests | `.runtime/ter-selector-subscription/2026-09-17/final-02-render-test.log` |
| `yarn workspace @catering-v2s/ui-base-admin-shell typecheck` | `PASS` | `.runtime/ter-selector-subscription/2026-09-17/final-03-admin-typecheck.log` |
| `yarn workspace @catering-v2s/ui-base-admin-shell test` | `PASS`，7 files / 17 tests | `.runtime/ter-selector-subscription/2026-09-17/final-04-admin-test.log` |
| `yarn workspace @catering-v2s/ui-base-console-assembly typecheck` | `PASS` | `.runtime/ter-selector-subscription/2026-09-17/final-05-console-assembly-typecheck.log` |
| `yarn workspace @catering-v2s/ui-base-console-assembly test` | `PASS`，2 files / 7 tests | `.runtime/ter-selector-subscription/2026-09-17/final-06-console-assembly-test.log` |
| `yarn --cwd apps/terminal verify:static` | `PASS` | `.runtime/ter-selector-subscription/2026-09-17/final-07-terminal-static.log` |

### 5. fresh 对账留痕

- B1：Sagan，agent `01a0ab3d-0067-7863-b4a2-853acec3162c`，`MATCHED`；
- B2：Hubble，agent `01a0ab44-b0a3-7e02-98c5-1f9feece38f5`，`MATCHED`；
- B3：Banach，agent `01a0ab51-2c4b-77f1-a737-541d91f3bb25`，`MATCHED`；
- 全批：Lorentz，agent `01a0ab53-4ccd-78a1-8a35-fbf62f2f2b9d`，`MATCHED`，发生在整体命令前；
- 主 agent 逐代码/详设：`.runtime/ter-selector-subscription/2026-09-17/b4-line-readback.log`，全部
  `MATCHED`。步骤级、全批三维对账与逐代码对账不可互相替代。

### 6. 本轮 round2 Note 处置

- N-1：计划不存在的 `§9.3` 引用已改为计划 `§7`，必要处并列详设 `§13c`，属真修复；
- N-2：文件名保留既有 `performance` 以保持引用稳定，三份当前交付文档以 `PATH_NOTE` 显式声明正文
  口径，属部分接受而非假称改名；
- N-3：详设明确 design Round 2 已完成且轮次封顶，当前 handoff 是独立 implementation review，属真修复。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。每条 finding
请写明：当前源码的精确相对路径与 symbol/行号、被违反的详设或计划条款、影响面、可复现核验方式、
最小修复建议，以及是否需要 Dexter 的产品/范围裁决。请区分 confirmed、partially confirmed、
rejected with evidence 和 unverified；不要采信作者自报数字，不要把未授权证据档位升格。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER React UI selector 订阅边界的 implementation 做独立复评。

背景：本轮依据已获批准的详设与实施计划完成 selector-aware subscription、public context 收窄、生产消费者迁移、TR-15、static/focused red mutation 与限定验证。design round2 结论是 GO(0M/0S/3N)，N-1/N-2/N-3 已在本批同步处置。当前只交 implementation review，不能把 design GO、命令全绿或作者对账表直接当作 implementation/acceptance GO。

目标：请从当前源码核验 useUiStateSelector/useRenderStatus/useUiCatalogContext 的订阅与 undefined/status 契约、useRenderSnapshot 与 raw state/source 的生产逃逸、public export/invariant/direct dependency/React peer-resolution 闭包、admin consumer 迁移、F-1–F-12 执行体、真实 red mutation，以及步骤级/全批三维对账和逐代码与详设对账是否闭合。请特别验证 mutation 真发生时对应判据会红；不要用 selector call count、退出码或字符串命中冒充业务 oracle，也不要产生任何性能改善结论。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md：实现契约、TR-15、F-1–F-12、变更分母与证据边界；
- doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-plan-codex.md：B0–B4 顺序、red mutation、计划 §7 对账与交付闸门；
- doc/evidence/platform/2026-09-17-ter-selector-subscription-implementation-codex.md：实际改动、首败根因、七条命令、red mutation、fresh 对账和证据分档；
- doc/review/platform/2026-09-17-ter-selector-subscription-design-review-round2-claude.md：上一轮 design GO 与三条 Note；
- doc/review/platform/2026-09-17-ter-selector-subscription-b3-step-reconciliation-codex.md 与 doc/review/platform/2026-09-17-ter-selector-subscription-b4-pretest-reconciliation-codex.md：步骤级/全批 fresh 三维对账；
- doc/platform/terminal-coding-standard.md：TR-03/TR-15 正本；
- apps/terminal/package.json、apps/terminal/ui/base/render/package.json、yarn.lock：直接依赖与 peer-resolution；
- apps/terminal/ui/base/render/src/contexts/RenderContext.ts、src/components/RenderProvider.tsx、src/hooks/useUiStateSelector.ts、useRenderStatus.ts、useUiCatalogContext.ts、src/index.ts、terminal-invariants.json：framework seam 与公共面；
- apps/terminal/ui/base/render/src/components/ScreenContainer.tsx、LayerStack.tsx、test/renderState.test.tsx：生产订阅消费者与 focused oracle；
- apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx、AdminShellLaptop.tsx、AdminShellMobile.tsx、AdminSectionContent.tsx、src/types/adminSection.ts、src/components/sections/DisplayContextSection.tsx、RuntimeSection.tsx：admin 迁移与 raw pass-through；
- tools/terminal-ui-render/check-behavior.mjs、check-static.mjs、check-static.test.mjs 以及 .runtime/ter-selector-subscription/2026-09-17/：red mutation、static 与七条命令原始输出。

独立核验重点：
1. B0 direct dependency 必须是源码和 package.json 的直接声明，不能用传递依赖替代；确认 use-sync-external-store 与 terminal React peer-resolution 的真实解析。
2. full snapshot、无 equality、总 true/漏字段 equality、旧 selector identity、status 读 root、缺 unsubscribe、旧 public hook、public raw context、admin raw pass-through 等 mutation 是否真实使对应 focused/static 判据变红。
3. 生产 source exact scan 是否没有 useRenderSnapshot caller；业务 UI 是否不能从 useRenderContext 取得 stateSource/snapshotReader；console-assembly 例外是否仍只停留在基础设施接线。
4. B1/B2/B3 步骤级对账、全批 fresh 对账和主 agent 逐代码与详设对账是否分别完成且均为 MATCHED；请保留首次 OPEN 与最小修复，而非只看最终状态。
5. 七条命令的结果只作为 static/focused 支持证据；native/Android、Web、release/visual、managed cleanup 和性能研究保持 N/A/OPEN。
6. 核对首败日志：renderState catalog fixture 的 TS2783/TS2571，以及 AdminLauncher measureInWindow 触发 TR-R04 的根因、修复和 focused 重验。

当前 evidence：
- render owned test 13 files/82 tests、admin owned test 7 files/17 tests、console-assembly owned test 2 files/7 tests 均有原始输出；
- behavior harness 36 个 red vectors，static self-test 31 个 red mutations，production render static 10 条规则与 terminal static 有原始输出；
- fresh B1/B2/B3 与全批三维对账均为 MATCHED，主 agent 逐代码与详设对账为 MATCHED；
- 这些结果不等于 implementation 或 acceptance PASS，也不包含任何性能结论。

请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请给出精确仓库相对路径、symbol/行号、影响、可复现核验方式、最小修复建议，并标明是否需要 Dexter 产品或范围裁决。

授权边界：本轮实现授权仅覆盖详设/计划列出的 selector 订阅、消费者迁移、测试/静态门、TR-15、README、依赖和限定 typecheck/test/static。未授权 Web、Metro、Android、native/device、DEV、release、visual、seed、UAT、部署、真实性能研究或扩大范围；最终 implementation/acceptance 结论由你与 Dexter 评审决定，Codex 不预先宣称 PASS。
谢谢。
```

