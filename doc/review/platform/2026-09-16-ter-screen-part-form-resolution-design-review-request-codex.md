# TER screenPart 机型解析 · 详设与实施计划评审交接

```text
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=NOT_APPLICABLE_RETIRED_CONTROL
ADVERSARIAL_REVIEW_REPORT=NOT_RUN_DOC_ONLY_TURN
REMEDIATION_SOURCE=doc/review/platform/2026-09-16-ter-screen-part-form-resolution-design-review-claude.md
REVIEW_TARGET=DESIGN
REVIEW_ROUND=N（Dexter↔Claude 评审通道；不是独立子 agent cycle）
DESIGN_STATUS=READY_FOR_REVIEW
IMPLEMENTATION_AUTHORITY=false
```

## 背景

TER screenPart 机型解析需求已经定稿到第 9 版，需求规定了 partKey-only 调用、装配期按机型过滤、过滤前冲突检测、容器内 content failure、system/content/transition 分层、目标 PRIMARY ready，以及 admin console 的 laptop/mobile 双形态拆分与重排。

本次交付是实现详设、配套 IA 和两批实施计划，不是源码实施。详设与计划没有运行构建、测试、Web、Metro、Android、设备、DEV、seed、UAT 或部署；没有把任何 evidence 档位宣称为 PASS。按当前项目约束，`DESIGN_GRANULARITY_MANIFEST` 与旧 compliance-control checker 已退役，本交接不创建或引用那套控制面。

本交接同时承接 Claude 对上一版产物的 DESIGN 复评：结论为 `NO-GO`、`M/S/N=2/5/3`。本轮只修订文档：M-1 采用 R-9 允许的单一不可呈现 reason/文案分支并移除跨层 declaration metadata；M-2 增加 content-ready 后再 system-failure 的独立 focused 时序执行体；S-1 至 S-5 与 N-1 至 N-3 均已在详设/IA/计划的逐条处置表中落点。未把这些文档修订、作者 readback 或历史 review 当作新的独立子 agent verdict。

本交付同时包含对需求明确要求同步的权威文档：TR-13 第 2 条改为检查未过滤装配输入，新增 TR-14 规定单机型 renderer basename 显式标出 `Laptop`/`Mobile`；旧需求的 R-S1、R-S7、U8、§8 v3.7 第 1 项同步到“content failure 可 ready、system failure 才走 failure page”的口径。

## 评审目标

请 Dexter 与 Claude 独立判断：

1. 详设是否逐项回答 D-1～D-15，且没有把已定需求重新改写成另一种产品语义；
2. 采用的机制是否仍是最小可维护方案：单一 assembly pre-filter、typed failure category、hydrated container prune、现有 LayerStack/PrimitiveGrid 复用，而不是新 catalog index、第二 popup、horizontal scroll 或通用 sibling-aware `definePart`；
3. R-15/R-16 的类型、失败传播、ready input、唯一 startup writer、两个 integration payload/log 是否形成闭环；
4. R-10a 先同组件声明拆分、R-10b 再组件分化的两批顺序，是否足以阻止 admin 版式变更掩盖机制回归；
5. U-1～U-15 的执行体、red mutation、focused/static 与未来 native/Web/visual 档位是否能够逮住需求列出的自然捷径；
6. IA 的可见/不可见维度、a11y/focus、错误/空态、集合分母和负载行为，是否与详设逐字一致且可实施；
7. 文档中的 OPEN/UNSET/NOT_APPLICABLE 是否真实，是否还有应在需求层交 Dexter 的产品/Journey/权限问题。

## 本轮复评 finding 闭合重点

请优先逐条核对 `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md:19` 的处置表，而不是只看作者总结：

- M-1：确认 R-9 的免费“改写文案”分支已被一致采用；不能出现 assembly→ui-state 的全量 declaration metadata，也不能保留独立的 `hydrated-container-other-form` problem code。
- M-2：确认 U-5b 有真实的 focused 顺序断言：目标 PRIMARY 先以可见 content failure 完成 ready，再不重置/不重新挂载地触发 system failure，运行期标题与 testID 必须不同于 ready 前启动期 variant；只读 `failureStage` 不足。
- S-1：确认 U-4b 点名的既有 layer 文件和精确用例；既有护栏应保持 diff 为空；由于当前没有直接挂载 `LayerStack` 的测试，新增 `apps/terminal/ui/base/render/test/layerStack.test.tsx` 的计划是否确实补足渲染过滤、backdrop 与关闭语义。
- S-2：确认旧需求 R-S1 续段保持两空格缩进，而非新的顶层列表项。
- S-3：按当前源码核对默认清单：两个 integration assembly 无显式 default；`sample.auth.login` 是 actor placement；wallpaper 匿名 PRIMARY 的 `container-empty`/`readyPartKey=null` 是真实路径，不是作者臆测。
- S-4：确认 A-2 只覆盖结构无效/未知段，A-3 在 filter 已生效后追加真实 cross-form hydrated recheck；U-7b 不得在 A-2 假绿收口。
- S-5：确认 TER 机制表没有把 Web admin 前端规范当作 owning source；不适用项必须明确说明，并指向终端实际 owner。
- N-1/N-2/N-3：确认新 DESIGN 对象仍要求 fresh 只读独立审查且当前状态诚实为 OPEN；IA 的对账状态统一为“作者自证；独立复核 OPEN”；`RenderSurfaceReadyInput` 的公共面变更及两个 integration `createStartupReadyPayload` 消费者已单列。

## 需阅读文件

- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md`：第 9 版冻结需求、R-1～R-16、U-1～U-15、D-1～D-15 与 Dexter 裁决；
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md`：实现详设、方案比较、CP 门、typed failure/ready/default/冲突/layout 契约、验收执行体与逐条 D 结论；
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md`：IA-01～IA-06，两种形态的可见/不可见维度、a11y/focus、容器负载行为和错误映射；
- `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md`：机制批/ admin 批的实施步骤、入口条件、红夹具、三维对账与逐代码对账门；
- `doc/platform/terminal-coding-standard.md`：TR-12、修订后的 TR-13 和新增 TR-14；
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md`：本批同步修订的 R-S1、R-S7、U8 与 §8 v3.7 第 1 项；
- `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md`：既有 admin layer、入口、可见动作与交互基线；
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-implementation-feasibility-review-codex.md`：上一轮 Codex 可行性 findings，详设第 16 节说明当前承接；
- `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-design-review-claude.md`：本轮 Claude DESIGN 复评及 2M/5S/3N findings，详设第 19 节逐条处置；
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`：assembly 汇总、catalog/renderer 构建、startup writer owning source；
- `apps/terminal/ui/base/render/src/components/resolvePart.ts`、`ScreenContainer.tsx`、`ScreenReadyBoundary.tsx`、`contexts/RenderContext.tsx`、`types/props.ts`：解析失败、可见 fallback、ready boundary 与状态来源；
- `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts`、`application/createUiStateModule.ts`、`features/actors/contentActors.ts`：容器水合、持久化、失效记录和既有 layer prune owner；
- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts`、`components/`、`foundations/adminTestIds.ts`、`terminal-invariants.json`：admin part、renderer binding、真实动作 testID 与公共面；
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`、`apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`：真实 integration assembly、既有 frozen journey 与测试分母；
- `project-memory/index.md` 及本任务命中的 project-memory 原文：设计/证据/owner/对账/失败处理的仓内约束。

## 独立核验重点

请以当前源码为真相，先证伪后对照文档，重点核验：

1. `consoleAssembly` 是否可以在**汇总全部 parts 后**先做 overlap 分组、再按当前 `surfaceForm` 过滤，并且 U-1 的 identity red mutation 会红；不要以 hand-built `createUiCatalog` 测试替代真实 assembly；
2. R-10a 的真实 admin sibling 是否形成 8 条未过滤输入、4 个稳定 partKey 的非相交 form 集合；U-14 的 input completeness 与 filtered renderability 是否被分别证明；
3. `RenderFailure.category` 是否是唯一分流依据：四种 content failure 可见并可让目标 PRIMARY ready，`runtime-not-started` 是 transition，system page 只在目标 PRIMARY；没有 reason 字符串重枚举；
4. `readyPartKey:string|null`、`contentFailure` 是否从 render 传到 console-assembly writer、两个 integration payload/log，且 `startup.complete` 仍只由唯一 writer 在 six groups + declared/measured/real-ready 全部满足时写入；
5. R-6 选择 hydrated container prune 后，默认值没有写进 container table，跨机型的无效 container/layer 不会留下 backdrop 或不可关闭空层，显式 show-screen failure 不会被默认静默吞掉；确认 unknown/retired 与 other-form 共用 `hydrated-container-not-renderable`，没有为一个日志字段增加 declaration metadata 通道，并确认 A-3 才执行 filter 后的真实 cross-form recovery recheck；
6. D-6 是否真的覆盖 9 个 card callsites/8 个组件、content 层和四个 section 的 `bounded`，并且 LayerStack 的居中/24 padding 是 exact value 变更，不是把居中挪到别处；
7. laptop 是否是共享父节点的 master-detail，display-context 是否成为 section，mobile 是否只用既有 `PrimitiveGrid` wrap、单一纵向 scroll owner 和 360×640 的冻结入口分母；
8. `useAdminSections` 及其本包依赖是否不读 `surfaceForm`，U-12 是否同时具备 hook 行为测试和本包依赖闭包 AST red mutation；跨包 helper 是否诚实保持 review-only；
9. U-5/U-9/U-10 是否把“可见/铺满/真正同屏/未裁剪”标为 `UNVERIFIABLE_BY_MACHINE`，并把未来 native/Web/release 证据写出设备、分辨率、ROI、baseline、判断语句和产物路径；ROI diff 不得被当作 absolute oracle；
10. `terminal-invariants.json`、public surface、README、两个 integration 的 production section 分母以及旧手搓 catalog 测试处置是否完整；是否存在真实公共消费者使计划中的 private/export 处理不安全；
11. 两批之间的 gating 是否是：A-0～A-4 逐步三维对账，A 批全批三维对账 `MATCHED` 后才 B；B 批完成、三维对账和未来授权证据后才做 `逐代码与详设对账`，任一 `OPEN` 不得交 implementation review；
12. 需求同步文件的四处旧口径和 TR-13/TR-14 是否与新详设一致；不要把已裁定的 not-found、system/content、ready 方向重新升为另一个产品决策，若发现真正冲突请精确指出 owner 与授权边界。

本轮还请逐条反证：M-1 的单一 `hydrated-container-not-renderable` 是否真的移除了跨层 metadata 必要性；M-2 的 U-5b 时序在删除 content-ready、清零 ready 或错用 startup testID 时是否会红；S-1 点名的既有 layer 用例是否足够且新增 LayerStack focused test 是否补足缺口；S-2 的 R-S1 续段是否仍为两空格缩进；S-3 的两个 integration 默认清单是否与当前 actor 源码事实一致；S-4 的 other-form 是否只在 A-3 filter 后真实执行；S-5 是否已改用 TER owner；N-1/N-2/N-3 的 review 状态、IA 对账状态和 `RenderSurfaceReadyInput` 公共面影响是否诚实且完整。

本轮文档只声称设计状态 `READY_FOR_REVIEW`。`INDEPENDENT_SUBAGENT_REVIEW=OPEN_NOT_RUN_IN_THIS_DOC_ONLY_TURN`，没有把历史 review、作者自报数字或本交接当作独立 adversarial verdict。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。

每条 finding 请区分：

- 当前仓内事实：精确相对路径和稳定符号/锚点；
- 推论：影响哪个 CP、U/D 判据或用户可见行为；
- 尚缺证据：需要 focused、native、Android、Web、visual、release 或 cleanup 哪一档；
- 最小修复建议：说明为什么不是更小/更大方案；
- 若涉及产品、Journey、权限或默认业务值，标注“需 Dexter 裁决”，不要替 Dexter 改需求。

详设/计划本轮约定的 review-only/Open 项不得被误报为已验收：TR-14 命名、跨包 hook helper、真实布局/视觉、设备冷启动、L2 和 cleanup 都应按证据档位判定。评审 GO 只代表详设/计划可进入后续授权流程，不代表源码 implementation、整体 acceptance、visual、Web、Android 或 release PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 TER screenPart 机型解析的 implementation-facing 详设、IA 与实施计划。

本次是针对 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-design-review-claude.md` 的修订复评。上一轮结论为 `NO-GO`、`M/S/N=2/5/3`；本轮不重开已定产品方向，只核对九条 finding 是否真实落到当前三份文档。设计第 19 节是逐条处置表，处置状态是文档状态，不是实现或验收结果。

背景：TER screenPart 机型解析需求已定稿到第 9 版，目标是让调用方只传 partKey，由 assembly 在汇总全部 parts 后统一检查机型冲突并按当前 surfaceForm 过滤；同时把 admin console 拆成 laptop/mobile 双形态并分别优化布局。Dexter 已裁定 not-found 是容器内业务失败、system/content/transition 分层、开机 ready 不看 content failure、无默认 container-empty 的 readyPartKey 允许为空，以及 TR-13 改查未过滤装配输入。本轮交付的是详设、配套 IA 和两批实施计划，不是源码实施；当前没有运行构建、测试、Web、Metro、Android、设备、DEV、seed、UAT 或部署。

目标：请站在实施方立场独立判断详设是否逐项回答 D-1 至 D-15，IA 是否闭合可见与不可见维度，计划是否能按机制批（R-1 至 R-9、R-15、R-16、R-10a）先行、admin 批（R-10b 至 R-14）后行落地；重点核验 typed failure category、runtime-unavailable 拆分、content failure 的可见呈现与目标 PRIMARY ready、readyPartKey:null 的传播、唯一 startup writer、hydrated container prune、pre-filter overlap、真实 assembly 测试、U-1 至 U-15 的 red mutation、9/8 card 计数、laptop master-detail、mobile 360×640 wrap、共享 hook 及逐代码与详设对账门。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md：第 9 版需求、裁决、U/D 清单；
- doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md：实现详设与每条 D/U 的执行体；
- doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md：IA-01 至 IA-06、a11y/focus、错误和负载行为；
- doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md：两批计划、CP gate、三维对账和逐代码与详设对账；
- doc/platform/terminal-coding-standard.md：TR-12、TR-13 与 TR-14；
- doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md：同步修订的旧权威口径；
- doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md：既有 admin 交互基线；
- doc/review/platform/2026-09-16-ter-screen-part-form-resolution-implementation-feasibility-review-codex.md：上一轮 Codex findings 及当前承接；
- doc/review/platform/2026-09-16-ter-screen-part-form-resolution-design-review-claude.md：上一轮 Claude DESIGN 复评的 2M/5S/3N findings；
- apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx、apps/terminal/ui/base/render/src/components/resolvePart.ts、apps/terminal/ui/base/render/src/components/ScreenContainer.tsx、apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx、apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts、apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts、apps/terminal/ui/base/admin-shell/src/parts/parts.ts、apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx：关键 owning source 与测试入口。

请重点独立核验：full unfiltered assembly input 是否先冲突后过滤；真实 assembly 是否替代 hand-built catalog；四种 content failure 与 transition/system 的 typed 分类是否闭合；ready payload 是否带 nullable partKey 和 content state 且只有目标 PRIMARY 参与；R-6 prune 是否保留显式失败事实；R-10a same-component 零回归与 U-14/U-15 分母；9/8 card、content/section bounded 和 LayerStack exact style；laptop 真 master-detail 与 mobile 360×640 可用性；hook 本包依赖闭包 AST；视觉性质是否诚实留到指定设备/分辨率的 future evidence；以及 A 批全范围三维对账在 B 批和动态证据之前的门控。

烦请给出明确 GO 或 NO-GO，并报告 M / S / N 数量。每条 finding 请给出精确仓库相对路径与符号/锚点，区分仓内事实、推论和尚缺证据，说明影响面、最小修复建议及是否需 Dexter 裁决；不同意设计时请给出当前源码反例。不要把本文档状态、历史 review、作者叙述或未执行的证据当作实现/验收 PASS。

授权边界：本轮只请求评审需求对应的详设、IA、实施计划及已同步的文档口径；不授权修改源码、测试、脚本、依赖或构建产物，不授权任何实施、构建、Web、Metro、Android、设备、DEV、seed、UAT、部署或 Git 操作。评审 GO 只表示可以由 Dexter 决定是否进入实施，不代表 implementation、acceptance、visual、Web、Android 或 release GO。谢谢。
```
