# TER sample 基础设施上收 base · Claude 复评请求

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=NOT_APPLICABLE_RETIRED_BY_AGENTS
ADVERSARIAL_REVIEW_REPORT=NOT_FOUND_IN_REPOSITORY
REVIEW_TARGET=DESIGN
REVIEW_STATUS=OPEN_FOR_INDEPENDENT_CLAUDE_REVIEW
SOURCE_REQUIREMENTS_SHA256_PREFIX=03f5fb777582
CODEX_INDEPENDENT_SUBAGENT_EVIDENCE=NOT_FOUND_IN_REPOSITORY
IMPLEMENTATION_PERFORMED=false
AUTHORIZED=仅评审详设、实施计划和本请求
NOT_AUTHORIZED=修改源码/测试/依赖/脚本/构建产物;实施;构建;Metro;Web;Android;native;release;设备;DEV;seed;UAT;部署;Git

> 本请求遵循当前 AGENTS.md 对已退役 compliance-control 的边界：
> implementation-design-granularity 不再作为准入或交付 gate，因此没有创建虚假的 manifest。
> 本轮应以详设、计划、当前 owning source 和真实可执行判据评审；Codex 侧 fresh 独立子
> agent 审查留痕在当前仓库中未找到，不能把 Claude 复评替代为该留痕。

## 背景

需求稿 v3.4 已由 Dexter 确认事实勘误和设计裁决，sha256 前缀为 03f5fb777582。
此前 Claude 对详设与 B1–B4 实施计划作了 5 个 fresh 子 agent 的分维度盲审，结论为
NO-GO，M9 / S22 / N12；评审还发现需求稿事实错误和需求层设计冲突。Dexter 已确认
以下四项，不需要本轮重开：

1. R-E1：base 禁止 feature、integration 和 App，adapter 是
   assembly.base.<平台> 的合法接线方向；
2. R-E2/R-E3/R-S7：native 注册在 super.onCreate(null) 前，PRIMARY 为物理主表面，
   六种 RenderFallbackReason 都不是 ready，永久不 ready 时终态收起 splash 并显示失败页；
3. system notice 冷重启按请求已结束处理，不恢复成 sample2 持久浮层；
4. U8/D-5：复用 tools/terminal-sample2/run-a9-runtime.mjs 的记录式先例观察 release、
   手机、双屏冷启动；只有先证明先例无法驱动目标形态，才向 Dexter 提出新 runner。

Codex 已依据 v3.4 重写实现详设和 B1–B4 实施计划，逐条保留 9M/22S/12N 处置表。
本次没有实施源码、测试或脚本，没有运行任何项目门、构建、Metro、Web、Android、设备、
DEV、seed、UAT 或部署。详设与计划当前仍是 OPEN；不能把文档完成写成 implementation
acceptance、visual/Web/Android/release PASS。

## 评审目标

请独立判断：

1. 上一轮 9M/22S/12N 是否逐条真正闭合；同意的修订要核对 owning source 和判据，
   不同意的 finding 要给反例；
2. D-1 至 D-14 是否回答需求 §7，且 B0–B4 计划是否能按现有边界真实落地；
3. U1–U13 执行体、批次、红夹具、D-9 矩阵和三类 reconciliation 是否能挡住自然捷径，
   而不会把字段/关键词存在冒充语义；
4. 哪些仍是仓内事实、官方外部事实、推论或尚缺证据的假设；不要把 handoff、作者自报
   数字、旧 review 或计划中的 future file 当成源码真相。

若发现需求 v3.4 本身的已定案条款与实现输入仍有不可同时满足的冲突，请明确标为
DEXTER_DECISION；不要在本轮自行放宽约束或改名。

## 需阅读文件

请从 catering-v2s 仓库根打开：

- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md：
  v3.4 需求、R-E1/R-E2/R-E3/R-E4/R-S7、U1–U13、D-1–D-14、批次和范围；
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md：
  本轮实现详设、CP gate cards、D-1–D-14、U1–U13 执行体、D-9 矩阵和处置表；
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md：
  B0–B4 实施步骤、入口条件、中间失败、测试清单、逐代码对账和处置表；
- doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-plan-review-claude.md：
  上一轮 9M/22S/12N findings；只作为待核验输入；
- doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md：
  sample1 frozen journey、partKey/layerId/testID 和状态旅途；
- doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md：
  sample1 interaction baseline；
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md：
  sample2 选择、确认、等待/欢迎、失败和持久化边界；
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md：
  sample2 冻结实现输入；
- doc/platform/claude-review-handoff-template.md、doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md：
  handoff 和独立 review 规则；
- AGENTS.md、scripts/README.md：
  当前授权、证据分档、日志/cleanup、静态入口和 no-Git 边界；
- apps/terminal/kernel/base/runtime/src/application/requestOutcome.ts：
  D-12 的现行 requestOutcome owner；
- apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts、
  apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx：
  picker 两跳 child result 和两个 void dispatch 入口；
- apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx、
  apps/terminal/ui/base/render/src/components/ScreenContainer.tsx、
  apps/terminal/ui/base/render/src/resolution/resolvePart.ts：
  ready 观察、真实 part 和六种 fallback；
- apps/terminal/skeleton-graph.ts、tools/terminal-skeleton/graph-model.mjs、
  tools/terminal-skeleton/check-static.mjs、tools/terminal-shared/import-capabilities.mjs：
  graph、批次、源码 import 覆盖和静态门；
- tools/terminal-sample2/run-a9-runtime.mjs：
  U8 要复用并扩展的记录式观察先例。

## 独立核验重点

请以当前源码为准，并报告精确仓库相对路径和行号：

1. 逐条检查 M-01 至 M-09、S-01 至 S-22、N-01 至 N-12 的处置是否闭合。尤其检查
   M-02 的 D-12 是否与现行 requestOutcome 逐行等价；AUTHENTICATION、空 error 集合、
   mixed categories 是否被正确归类。
2. 核验 M-03/U13：picker actor 是否真正消费 kernel child result，失败是否区分写入前、
   写入后和无法确认；至少一例是否要求真实 runtime injection，而不是只测 rejection
   mock；父 request 是否可能被错误完成。
3. 核验 M-04/M-05/S-12：native authority 是否覆盖实际构建读取的 styles.xml、
   mipmap/drawable、manifest、Gradle、Kotlin/MainActivity 等入口；D-11 是否是需求
   §3.1 允许差异的封闭集合；是否会被只改 app.json、漏真实 native input 的实现绕过。
4. 核验 M-06/S-10/S-11：run identity 是否先唯一再谈每 run 一次；oracle 是否单客户端
   只读；唯一写入端是否为 console-assembly；是否错误声称 resolver 失败已有统一
   terminal state；HMR/多 client/重复写入是否有反例和红夹具。
5. 核验 M-07/S-14：B4 是否补回三组 ui/feature module.ts 与 assembly.ts skeleton；
   B4 的 graph/package 依赖是否严格只含 B1，而没有因 U10/U13 旅途偷偷扩成 B2/B3。
6. 核验 M-08/M-09/S-22：每个执行体是否都有真实建造步骤、批次内落点、红 mutation
   和一次性 evidence；stage、whole-scope、code↔design 三类对账是否由 fresh 独立
   子 agent 执行且排在 dynamic 之前；CP gate 是否有 FORBID、RECALL、INVARIANT、
   SHAPE_RATIONALE、FALSIFIABLE_FAILURE 五项。
7. 核验 S-01/S-02/S-05：native registration 是否在 super 前；PRIMARY 是否为物理主
   表面并排除 runtime-unavailable、container-empty、missing-catalog-entry、
   incompatible-catalog-entry、missing-renderer、invalid-props 六种 fallback；
   ready 是否有 batch 落点和 focused 反向变异。
8. 核验 S-07/S-08/S-13：B1 是否纳入五个依赖伪造 descriptor 的 factory；B3 是否将
   sample-console 变为可取消的真实运行期模块；U2 是否不再使用永远强制 prepend 的
   kernel.base.runtime fixture；B0 是否同时处理 graph 与 package.json 的首败根因。
9. 核验 U8/D-5：run-a9 先例的扩展计划是否真的能记录 release、手机、双屏冷启动，
   并用 t0 splash visible、t1 real part/geometry/physical PRIMARY ready、t2 splash
   hidden 和 t1≤t2 区分“就绪前收起”与“就绪后收起”；R-S7 失败页是否有可证伪判据。
10. 核验 D-9：sample1 的 partKey、layerId、testID 是否完整保留；是否覆盖 mobile/dual、
    cold restart、normal frozen journey 和 U13 failure/recovery；system notice 三种
    close path 和冷重启 request-ended 是否不误接 sample2 持久化。
11. 核验 D-10/D-11/D-13/D-14：App thin shell、native projection、shared admin console、
    notice body/feature identity、request lifecycle 和 picker failure copy 是否有更小
    且不降低事实性的替代；如果设计只在计划中声称未来文件存在，请将其作为 finding。
12. 只读核验文档中的命令、路径、行号和 evidence 分档；不要实施、改文件、启动运行资源、
    构建、设备、DEV、seed、UAT、部署或执行 Git。

## 期望结论

请给出明确的 GO 或 NO-GO，并报告 M、S、N 各自数量。每条 finding 请写明：

- 类型：仓内事实、外部官方事实、推论、或尚缺证据的假设；
- 精确的仓库相对路径、行号和影响面；
- 可复现的核验命令/静态路径/反例；
- 最小修复建议；
- 是否需要 Dexter 产品、范围或设计裁决。

本轮 GO 仅表示“详设与 B1–B4 计划可以交给 Dexter 决定是否进入实施”；NO-GO 表示
至少有一个阻断性 finding 未闭合。无论 GO 或 NO-GO，均不授权修改源码、测试、依赖、
脚本或构建产物，不授权任何构建、Metro、Web、Android、native、release、设备、DEV、
seed、UAT、部署或 Git 操作。Codex 侧 fresh 独立子 agent 留痕当前未找到，请不要
把本次 Claude 评审冒充该留痕；若你认为它本身阻断 review closure，请单列 N-12 或更高
严重级别并说明依据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立复评 TER sample 基础设施上收 base 的实现详设与 B1–B4 实施计划。

背景：需求稿已由 Dexter 确认为 v3.4，sha256 前缀为 03f5fb777582。此前你方对详设/计划的独立评审为 NO-GO，M9 / S22 / N12；作者侧已逐条修订，并在详设与计划中附了完整处置表。Dexter 已定案 R-E1 的 adapter 放行、R-S7 的永久失败收屏、system notice 冷重启按请求结束处理，以及 U8 复用 tools/terminal-sample2/run-a9-runtime.mjs 的记录式观察，本轮不要重开这四项。Codex 本轮没有实施源码，也没有运行项目门、构建、Metro、Web、Android、设备、DEV、seed、UAT 或部署。仓库中目前未找到 Codex 侧 fresh 独立子 agent 对抗审查留痕。

目标：请独立核验上一轮 M9/S22/N12 是否真正闭合，D-1 至 D-14 是否回答需求 §7，B0–B4 是否可按真实依赖和授权落地，以及 U1–U13、D-9、red mutation、native/release evidence 和三类 fresh reconciliation 是否能挡住自然捷径。请以当前 owning source 为真，不把 handoff、旧 review、作者自报数字或计划中的 future file 当源码事实。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md：v3.4 需求、U1–U13、D-1–D-14、R-E/R-S 约束；
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md：修订详设、CP gate、执行体、矩阵和处置表；
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md：B0–B4 步骤、测试、对账和处置表；
- doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-plan-review-claude.md：上一轮 findings，只作待核输入；
- doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md、doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md：sample1 frozen journey 和 interaction；
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md、doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md：sample2 冻结输入；
- AGENTS.md、scripts/README.md、doc/platform/claude-review-handoff-template.md、doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md：当前边界和 review 规则；
- apps/terminal/kernel/base/runtime/src/application/requestOutcome.ts、apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts、apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx：分类和 picker 两跳；
- apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx、apps/terminal/ui/base/render/src/components/ScreenContainer.tsx、apps/terminal/ui/base/render/src/resolution/resolvePart.ts：ready/fallback；
- apps/terminal/skeleton-graph.ts、tools/terminal-skeleton/graph-model.mjs、tools/terminal-skeleton/check-static.mjs、tools/terminal-shared/import-capabilities.mjs、tools/terminal-sample2/run-a9-runtime.mjs：graph、源码导入、静态门和 U8 先例。

请重点独立核验：D-12 是否与现行 requestOutcome 逐行等价；picker actor 是否消费 child result 并按写入相位给出真实 state/提示且至少一例真实 runtime injection；native identity 是否覆盖所有真实读取入口且 D-11 是封闭允许差异；run identity、single-client sink、console-assembly single writer 和 resolver failure boundary；B4 是否只依赖 B1；五个 factory、sample-console 可取消 runtime module、三组 feature skeleton 和 B0 graph/package 双点修复；PRIMARY/六种 fallback/ready focused negative；U8 release 手机/双屏冷启动时序和 R-S7 失败页；sample1 identity 与 D-9 mobile/dual/cold-restart 矩阵；以及 fresh stage、whole-scope、code↔design reconciliation 是否先于 dynamic。请给每条 finding 的精确仓库相对路径、行号、影响、复现方式、最小修复和 Dexter 决策需求。

烦请给出明确 GO 或 NO-GO，并报告 M / S / N 数量。这里的 GO 只代表详设与实施计划可交 Dexter 决定是否进入实施，不代表 implementation、visual、Web、Android、release 或 cleanup PASS。

授权边界：本次只请求对详设、B1–B4 实施计划和其判据作只读独立评审；不授权修改源码、测试、依赖、脚本、文档以外的构建产物，不授权实施、构建、Metro、Web、Android、native、release、设备、DEV、seed、UAT、部署或 Git 操作。谢谢。
```

