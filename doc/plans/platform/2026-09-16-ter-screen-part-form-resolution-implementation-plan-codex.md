# TER screenPart 机型解析 · implementation plan

`SKILL_USED=cs-spec-to-plan`

```text
PLAN_KIND=IMPLEMENTATION_PLAN
BUSINESS_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md
DESIGN_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md
IA_SOURCE=doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md
AUTHORIZED=按 Dexter 当前任务进入本计划范围内的实现、测试、README/文档同步与计划内验证；不扩大需求范围
IMPLEMENTATION_AUTHORITY=true（Dexter 当前任务直接授权；Git 仍由 Dexter 控制）
NOT_AUTHORIZED=超出本计划的需求、构建拓扑、seed/UAT/部署或未列出的源码改动；不得以本计划扩展授权
DESIGN_REVIEW=INDEPENDENT_PRECHECK_COMPLETED_AND_FINDINGS_INTAKED；implementation review 仍未进行
```

本文件是实施顺序与执行记录的约束载体。当前任务已授权进入实施；实际结果、原始输出、失败边界与证据档位必须在实施过程中追加，不能由计划文字预报。

## 1. 业务目标、替代方案与批次策略

业务目标是让 screenPart 的调用方永远只传 `partKey`，让装配 owner 吸收 laptop/mobile 差异，并让真实 admin console 在两种形态下都可读、可达、可恢复。实现必须同时保留既有 part/layer identity、admin launcher、登录边界和 sample journey。

选择机制批先行、admin 批后行：机制批先让同一 partKey 的双形态声明、冲突检测、过滤、失败分类、content-ready、默认/水合恢复闭合；admin 批只在这些语义稳定后分化组件和改布局。这样 R-10a 两边暂时指向同一组件，可以用“拆分前后行为逐字不变”做最强的零回归基线。

不采用三条更大的替代：

- 不把 catalog 改成 `(partKey, surfaceForm)` 双键，因为它会改 show/open、layer、持久化和 selector 的身份；
- 不把冲突/过滤分散到 feature/integration，因为漏接一处无法被单一装配事实发现；
- 不把 content failure 伪装成 system failure 或加第二个 popup/横向 scroll，因为那会把业务配置问题误报为设备故障，并扩大现有 owner 边界。

我选两批的顺序而不是一批到底，因为错误分类/ready 边界是版式实施的上游事实；如果先改 admin 组件，测试看到的 failure/page/ready 结果会随基础机制漂移，无法知道是版式回归还是分类回归。

## 2. 开工前置与绝对边界

开工前必须同时满足：

1. Dexter 与 Claude 对本详设、IA、计划给出 DESIGN `GO`；
2. 主 agent 重新打开当前需求、详设、IA、TR-12/TR-14、TR-13、interaction artifact、命中的项目记忆和 owning source；
3. `apps/terminal` 当前 typecheck/focused baseline 的首败被记录并定位。不能把已有 baseline 红当成实现失败，也不能在 baseline 未恢复前改业务；
4. 旧需求的 R-S1、R-S7、U8、§8 v3.7 第 1 项与 TR-13/TR-14 已经是本设计引用的同步版本；若字节漂移，先停在 CP-0；
5. 实施前 source search 建立两组完整分母：未过滤 admin 8 条、每 integration 的 production section 集合；若发现仓外公共消费者或新产品语义，暂停交 Dexter。

当前回合已获 Dexter 的一次性实施授权；CP-1 已由 fresh 独立步骤对账收口 `MATCHED`，CP-2 已由 fresh 独立步骤对账收口 `MATCHED`，CP-3 已完成 focused 与主 agent 兜底三维对账 `MATCHED_FOR_CP3_SCOPE`，CP-4 已由 fresh 独立步骤对账收口 `MATCHED`，机制批全范围三维对账首轮发现 ready identity 丢失并已按 owning source 修复，复核后收口 `MATCHED`，CP-5a/CP-5b/CP-5c 均已完成 focused 重验并由 fresh reviewer 收口 `MATCHED`，B 批全范围 fresh 三维对账由 Jason 收口 `MATCHED`；随后已完成 release U8 四场冷启动与 sample1/sample2 冻结旅途四场动态运行，结果分别记录在 implementation evidence，当前只剩逐代码对账、cleanup 汇总与 handoff 组装。CP-3 的 fresh reviewer 无响应、受控关闭与兜底边界见 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp3-three-dimensional-reconciliation-main-fallback.md`；该记录不冒充 fresh verdict。CP-4 的 fresh 对账见 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp4-three-dimensional-reconciliation-anscombe.md`；机制批复核见 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-mechanism-batch-reconciliation-gibbs.md`，首轮 `OPEN` 与修复边界见 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-mechanism-batch-reconciliation-fermat-open.md`。CP-5a 的首次 scope finding、hook finding、修复后 fresh 复核分别在 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-three-dimensional-reconciliation-bacon.md`、`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-three-dimensional-reconciliation-confucius.md`、`doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5a-three-dimensional-reconciliation-hooke.md`；B 批全范围复核见 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-b-batch-reconciliation-jason.md`。Git 全程由 Dexter 控制，计划不包含任何 Git 操作。

## 3. 未来验证入口

仓内各包现有脚本由 `package.json` 定义：

```bash
yarn workspace @catering-v2s/kernel-base-ui-state typecheck
yarn workspace @catering-v2s/ui-base-render typecheck
yarn workspace @catering-v2s/ui-base-console-assembly typecheck
yarn workspace @catering-v2s/ui-base-admin-shell typecheck
yarn workspace @catering-v2s/ui-base-render test
yarn workspace @catering-v2s/ui-base-console-assembly test
yarn workspace @catering-v2s/ui-base-admin-shell test
yarn workspace @catering-v2s/ui-integration-sample-console test
yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test
```

这些是本次已授权的 focused/typecheck 入口；已执行的 CP-1/CP-2 结果分别记录在对应 `doc/evidence/platform/` evidence 中，后续每条命令也必须保留原始输出位置。失败时先记录 `first failure`、`last known good`、`broken boundary`，按 owning source 修复后再做最小 focused 重验。不得增加 timeout、盲目重跑或把失败改写成 PASS。

## 4. 批次 A：机制批（R-1～R-9、R-15、R-16、R-10a）

批次 A 必须在任何 admin 组件分化、版式重排或视觉运行前完成。它包含四个 CP，按依赖顺序执行。

### A-0：权威同步与事实分母

落点与动作：

1. 复核并保留 `doc/platform/terminal-coding-standard.md` 的 TR-13 第 2 条“未过滤装配输入”与 TR-14 review-only 命名规则；
2. 复核并保留 `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md` 的 R-S1、R-S7、U8、§8 v3.7 第 1 项修订；
3. 以当前 source search 冻结 `adminShellAssembly.parts` 8 条、sample-console 的共享 3 + sample section、sample-wallpaper-console 的共享 3；冻结现有 partKey/layerId/testID。同步记录默认清单事实：两个 integration assembly 与 `console-assembly` 都没有显式 `defaultContainerPartKeys` 或其他 PRIMARY 默认字段；共享 `sample-staff-auth` 的 `apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts:32-37,51-60` 在两个 integration 的匿名恢复/退出旅途都向 PRIMARY 放置 `sample.auth.login`，sample-member-desk 仅在 sample-console 的认证旅途向 PRIMARY 放置 member list，sample-wallpaper-console 本地 actor 的匿名分支仅向 SECONDARY 放置 waiting；因此当前没有真实稳定的 integration anonymous `readyPartKey=null` 路径，U-6 的 null 只使用显式 synthetic fixture，不冒充当前旅途；
4. 清查 v1/obsolete orchestration source、旧 hand-built production-name test 和公共出口。只有确认无消费者的源文件才进入第二批 cleanup；不为通过门而保留空壳，不在不确定时盲删。
5. 若 A-0 的既有 `verify:static` 基线在当前源码上首败，先按首败所属 owner 做最小基线修复，再进入 A-1；这不是新增 screenPart 机制，也不改变本批产品行为。实际本轮首败链与修复边界记录在 `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-static-focused-codex.md`：platform-port descriptor 的 `__DEV__` 诊断边界、hydration prune 的 helper 结构、test-support 类型目录边界、ui-state catalog predicate owner，以及 render public invariant 同步。任何未列出的行为性改动仍按 scope drift 处理。

入口条件：设计 GO、文档四处无矛盾、当前 source 可读。

建造步骤：只创建本计划的实施清单和测试分母，不改变生产源码；实际实施时先完成 A-0，再开始 A-1。

收口判据：

- `CP-0= MATCHED`：权威文本的 ready/failure/TR-13 口径与详设逐条相同；
- 三维对账者在下一步前确认需求、详设/IA、项目记忆三维均 matched；
- 任何旧口径、未闭合分母或外部消费者发现即 `OPEN`，不得进入 A-1。

### A-1：typed failure 与 render ready（CP-1）

落点：

- `apps/terminal/ui/base/render/src/types/props.ts`：引入 `ContentFailureReason`、`SystemFailureReason`、`TransitionFailureReason` 与 `RenderFailure` discriminated union；ready input 增加 `readyPartKey:string|null` 与 `contentFailure`；
- `apps/terminal/ui/base/render/src/components/resolvePart.ts`：将 overloaded `runtime-unavailable` 拆为 transition/system values；每个 fallback 返回带 category 的 failure；
- `apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`：按 `failure.category` 分流；四种 content failure 使用容器内可见内容；system page 只在 target PRIMARY；transition 只 loading/neutral；
- `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx`：只在目标 PRIMARY 物理表面、resolved 或可见 content failure 完成 layout 后上报 ready；SECONDARY/Web 不参与；
- `apps/terminal/ui/base/render/src/contexts/RenderContext.tsx` 及其 types：保持 `hasPrimarySurfaceReady` 的唯一 ready 事实，不复制 form；
- `apps/terminal/ui/base/render/src/foundations/diagnostics.ts`：content error 使用 category/reason/key/form/container identity，`container-empty` 也写入 `partKey:null` 的 typed diagnostic，`invalid-props` 只记录脱敏 `valueType`；禁止原始 props/message/sensitive value；system/transition 不伪造 content 定位字段。

建造步骤：先定义 union 和 exhaustiveness helper，再迁移 resolver 分支，再迁移 ScreenContainer/ReadyBoundary，最后迁移 testID 与旧 fallback assertions；任何消费者不得以 reason 字符串决定 readiness/page。

必须跑的 focused 集合：render 的 resolver、ScreenContainer、ReadyBoundary、fallback、surface-root/host focused tests，以及 ui-base-render typecheck。测试要覆盖 4 content、3 system、1 transition、target PRIMARY/SECONDARY/Web 四种 surface 条件；在 `apps/terminal/ui/base/render/test/renderSurface.test.tsx` 点名 `treats a missing catalog entry as visible content failure and PRIMARY readiness`、`reports an incompatible catalog entry as visible content failure and PRIMARY ready`、`keeps a content failure visible on SECONDARY without reporting PRIMARY readiness`、`keeps content failure visible without native readiness when no physical host is attached`、`keeps a system failure neutral on the SECONDARY physical surface` 与 `keeps a content failure ready before a later system failure uses the runtime variant`，分别闭合 missing/incompatible/empty/invalid-props 内容分支、SECONDARY content/system no-ready、无物理 host 的 Web/preview boundary proxy 与 R-16 时序；后者明确先 content failure ready、再不重置 ready state 地触发 system failure，并比较启动期/运行期 testID。

红夹具：

- 把 `missing-catalog-entry` category 改成 system，content visible/ready/no-system-page 断言必须红；
- 把 `runtime-not-started` 当 system，loading/no-ready 断言必须红；
- 删除 `contentFailure` 或将 `readyPartKey:null` 强制成字符串，container-empty ready payload 断言必须红；
- 把 system page 放到 SECONDARY，surface matrix 必须红；
- 恢复 `reason !== 'x'` 字符串分支，focused category mutation 必须红或 typecheck 阻止。
- 删除时序用例的首次 content-ready、在第二次 system failure 前清零 `hasPrimarySurfaceReady`，或将运行期断言改成启动期 testID，时序断言必须红；只依赖现有 `failureStage` 的默认结果不算通过。

CP-1 的实际 mutation 输出统一记录在 `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp1-execution-codex.md`；未记录真实失败的 mutation 不得作为 CP-1 收口证据。

收口：CP-1 focused/typecheck 证据与原始输出保留；随后由 fresh 独立子 agent 做步骤级三维对账，结果只能 `MATCHED` 或 `OPEN`。CP-1 未 MATCHED 不得进入 A-2。

### A-2：默认、hydration/prune、startup payload（CP-2）

落点：

- `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts`：让 `parseContainers` 对结构无效记录产生 typed diagnostic，不改变有效记录序列化形状；
- `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts` 与 module install owner：扩展/新增有真实调用者的 hydrated-container prune actor，在 surface 创建前遍历 workspace/display mode；结构无效记录与当前不可呈现记录分开处理，但 unknown/retired 与 other-form 共用 `hydrated-container-not-renderable` reason/message；复用 layer prune 的 owner 边界；不保存或传递 declaration metadata；
- `apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts`：保证 prune 顺序早于 surface/container render；不把默认写成 action；
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`：只传递可选 integration default declaration 和 primary ready facts；当前 assembly 没有默认字段时保持空，不把 actor placement 改写成 default；唯一 writer 写 `startup.complete`；不写业务 partKey literal；
- `apps/terminal/ui/integration/sample-console/src/**`、`sample-wallpaper-console/src/**`：ready payload/actor/log 增加 nullable part 与 content failure typed fields，保留 existing partKey/layerId/testID；
- startup diagnostics writer 与 platform ports logger：writer 判定 six groups + declared/measured/real-ready，logger 只 sink 且保留 caller startupRunId。

默认与恢复规则：integration 只提供可选 default；当前两个 assembly 均无显式 default，不能把 actor placement 写成 default；无有效 container placement 才读 default；显式 `show-screen` 失败仍显示 content not-found；跨机型 hydrated container/layer 记录按各自 owner 裁剪，container stale placement 通过既有 owner-only content write 清除；U-6 以 synthetic fixture 的合法空容器状态表达 `readyPartKey=null`，不声称当前 integration 匿名旅途为空。unknown/retired 与 other-form 不传 declaration metadata，均记录 `hydrated-container-not-renderable`；结构坏记录另记 `hydrated-container-invalid`。

边界修复：当 `input.catalog.entries` 完全没有 `containerKeys` declaration 时，`pruneHydratedContainers` 不猜测既有 container 是否属于 production catalog，保持 layer-only 测试/运行时的历史状态契约；真实 console catalog 含 container declarations 时仍执行全量 workspace/display-mode membership prune。该 no-op 不是 default fallback，也不能用来绕过 A-3 的真实 cross-form filtered catalog。可裁剪的 stale placement 复用 `completeUiStateWrite`，从 owner-only 本地持久化记录中清除，避免下一次冷启动反复恢复同一 not-found；不新增 view-only persistence 通道。

建造步骤：先扩展类型和 writer atomic payload，再扩展 hydration diagnostics/prune，接通 integration payload，最后更新既有 restart/focused fixtures。不要把未完成的 payload 单独先交给某一 integration。

必须跑的 focused 集合：ui-state hydration/persistence/prune tests、console-assembly startup writer tests、两个 integration assembly/ready payload tests，以及四包 typecheck。U-6 的 `readyPartKey=null` 使用显式 synthetic fixture，代表合法的无 placement/无默认状态形状而非当前 integration 匿名旅途；有默认语义的行为另用可选 default fixture 证明，不声称当前 integration 已有 default。

红夹具：

- 删除 prune，跨形态冷启动必须仍有 invalid container/layer；U-6/U-7b 必须红；恢复 declaration metadata 或拆出 `hydrated-container-other-form` 也必须被设计/ focused 对账判红；
- 把 default dispatch 写入 container slice，反序列化后的 key set 必须红；
- 让 writer 在缺一启动组时写 complete，writer test 必须红；
- 让 platform logger 自己判 complete 或改写 startupRunId，focused sink test 必须红；
- 丢掉 `contentFailure`/nullable `readyPartKey` 任一字段，两个 integration payload contract 必须红。

收口：CP-2 的 focused 与 typecheck 已完成，首败、broken boundary、根因与最小修复记录在 `doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution-cp2-execution-codex.md`；fresh 独立子 agent 已确认三维对账 `MATCHED`，因此已解锁 A-3。

### A-3：pre-filter 冲突与 assembly filter（CP-3）

落点：

- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`：在汇总 `[...adminShellAssembly.parts, ...input.parts]` 后，先按 partKey 分组检查 overlap/empty/duplicate，再按 `input.surfaceForm` 过滤；过滤后保留 unique assertions 和一次 catalog/renderer 建立；
- `apps/terminal/ui/base/console-assembly/src/index.ts` 与 tests：不扩展 `createUiCatalog` 为第二生产收口；直接调用该 API 的测试改为真实 `createConsoleAssembly`，或降级命名为非生产 catalog unit；
- `doc` 中已同步的 TR-13/U-14 只检查未过滤 assembly input，不能反推 filtered catalog。

建造步骤：把 overlap check 与 filter 放在同一个 assembly owner 函数中；先建立 full input snapshot，再建 filtered catalog；所有 downstream 继续消费 filtered catalog，不新建 `(partKey,form)` index。A-3 的跨形态恢复夹具必须经 `createConsoleAssembly` 的真实装配路径产生 filtered catalog 与 hydration 输入，不手搓一个 catalog；A-4 的真实 admin sibling 完成后，再用生产 admin 分母重跑同一 overlap/过滤边界。

必须跑的 focused 集合：两个 integration 的 real assembly laptop/mobile tests、console-assembly overlap tests、sample-console 两处 hand-built catalog 测试处置后的 production-path test；U-4b 点名的既有 layer **用例**实现与断言逐字不变（`sampleAssembly.test.tsx` 因 D-1/D-10 其他用例改动而文件级 diff 非空是预期），并新增 `apps/terminal/ui/base/render/test/layerStack.test.tsx` 的直接行为测试；在 filter 已生效的同一批次追加 U-7b 的 cross-form hydrated container recheck，断言 `hydrated-container-not-renderable`、selector 裁剪和 LayerStack 无 backdrop/空层。

红夹具：

- 把 filter 改为 `allParts` identity，U-1 必须红；
- 使用真实 `definePart` sibling input，将只影响另一 form 的 forms 改成 overlap，分别以 laptop/mobile 走 `createConsoleAssembly`，U-2 必须都红且 message 含 key/forms；A-4 完成后再以生产 R-10a admin sibling 重跑；
- 从 unfiltered input 移除一条 admin part，U-14 input segment 必须红；
- 以 filtered catalog 的数量代替输入完整性，缺条目 fixture 必须红。
- 在 filter 生效后删除/绕过 cross-form hydrated recheck，或把它提前到 A-2 并宣称真实 other-form 已执行，U-7b 的 A-3 段必须保持 OPEN/变红。

收口：CP-3 focused/typecheck、真实 sample2 cross-form hydrated-container 复验及 production input 断言完成；fresh reviewer 在受控多次等待与 interrupt 后仍未产出 verdict，按项目既定重复失败规则由主 agent 完成同一范围三维对账，结果为 `MATCHED_FOR_CP3_SCOPE`，记录见 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp3-three-dimensional-reconciliation-main-fallback.md`。该主 agent 兜底只解锁 A-4，不等同于 fresh independent review。

### A-4：admin 声明拆分 R-10a（CP-4）

落点：

- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts`：console、platform-ports、runtime、display-context 各拆成 laptop/mobile sibling；forms 不相交，同 partKey 保持稳定，rendererKey 唯一；两条先指向同一个现有 component；
- admin-shell 的 parts/index/invariant：同步未过滤 8 条分母和 renderer binding 语义；不改变 layerGuard/layerTier 的既有值；
- 两个 integration assembly tests：验证 full input 仍含 8 admin parts，两个 form 的 filtered catalog 各有 4 条可渲染 admin parts。

建造步骤：声明拆分和 fixture 一次完成；先不新建 Laptop/Mobile component；先跑行为对照，证明 same component 下 partKey、testID、layer behavior、section output 逐字不变。

红夹具：一对 sibling forms overlap；漏掉一个 admin input；只注册一 form；将 layerGuard 默认化为 dismissible；每种都必须被 U-2/U-14/U-15 或既有 layer focused test 逮住。

收口：R-10a same-component focused zero-regression、U-1/U-2/U-3/U-7/U-13/U-14/U-15 对应证据齐全；两个 integration 的真实 assembly 已分别覆盖 laptop/mobile 的完整生产分区集合；fresh 独立子 agent 三维对账 `MATCHED`，记录见 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp4-three-dimensional-reconciliation-anscombe.md`。

## 5. 机制批整体门：进入 admin 批的必要证明

A-0～A-4 全部完成后，且仅在此时，主 agent 组织一次**全批三维对账**，不同于每个 CP 的阶段对账。对账者必须 fresh、独立、只读，逐条比较：需求、详设/IA、项目记忆标准；任意一维漏项或任一行为/形态/文案/失败恢复/focus/source 漂移即 `OPEN`。

机制批必须证明：

1. 两 integration 的真实 assembly 在 laptop/mobile 都只得到当前 form；full input 与 filtered catalog 分开证明；
2. 任一 form 都能发现另一 form 的 overlap；错误包含 key/forms；
3. 四种 content failure 都可见，目标 PRIMARY content failure 可 ready，SECONDARY/Web 不参与 ready，system/transition 分流正确；
4. `startup.complete` 只有 six groups + primary declared/measured/real-ready 同时成立才由唯一 writer 写入；payload 和诊断含 content state、nullable ready key；
5. 无默认/失效 hydrated container/layer 在冷启动恢复路径不残留关不掉空层，且默认不写入持久化 container；结构无效与当前不可呈现分别有 typed diagnostic，unknown/retired 与 other-form 共用 `hydrated-container-not-renderable`，其真实跨形态路径在 A-3 filter 后有 focused recheck；
6. existing sample1/sample2 journey 的 partKey、layerId、testID 和 layer behavior 未被机制改动；
7. R-S1/R-S7/U8/§8 v3.7 与 TR-13/TR-14 已同步；
8. U-1～U-8、U-13～U-15 的非视觉部分均有 focused/static `MATCHED`；U-5/U-9/U-10 的视觉部分保持 OPEN，等待 admin 批后 D-13 证据。

若全批三维对账不是 `MATCHED`，不得开始 B-1。当前 A 批复核为 `MATCHED`；首轮 `OPEN` 已保留并由 focused 重验与 fresh 复核闭合。对账不是测试汇总，也不能由后续设备观察替代。

## 6. 批次 B：admin 重排批（R-10b、R-11～R-14）

批次 B 的入口就是 §5 全批三维对账 `MATCHED`，以及 A-4 的 same-component 行为基线已保留。B 批不得回头改变 R-1/R-2/R-15/R-16 的语义；若必须改机制，退回 A 批重新过其 gate。

### B-1：组件分化与 hook（CP-5a）

落点：

- `apps/terminal/ui/base/admin-shell/src/components/`：按 TR-14 为四个 admin key 生成 laptop/mobile renderer 普通文件名；不使用 Metro 未配置的 platform extension；component 负责本机型版式和 selected fallback，不读取/分支 `surfaceForm`。
- `apps/terminal/ui/base/admin-shell/src/hooks/useAdminSections.ts`（或实现前经 source review 确认的同等 capability basename）：一文件一 hook；返回 `sections`、`selectedPartKey`、`selectedSection`、`selectSection`；不读取 form；登录态仍在 `AdminLayer`。
- `apps/terminal/ui/base/admin-shell/test/adminSectionsStructure.test.ts`：用 TypeScript AST 遍历该 hook 及本包相对导入闭包，拒绝 `surfaceForm` 的 property/element/destructuring 读取；不是跨包 checker。
- `apps/terminal/ui/base/admin-shell/src/components/sections/**`：shared hook 输出进入两形态 renderer；四个 section 仍保留稳定 partKey/testID，分化只在视图布局。

建造步骤：先提炼 hook 并用 wrapper 验行为，再拆 component 文件和 part bindings；不先复制 hook 再“以后合并”。hook 的本包依赖闭包 AST 检查与 behavior test 同批加入。

必须跑的 focused/static 集合：admin-shell hook/section tests、public surface/invariant test、U-12 AST check、U-13 integration test、四包 typecheck。

红夹具：hook 读 `surfaceForm`、复制两份 hook、空壳 hook、把 form 分支下沉到本包依赖；行为/AST/review 至少一项必须红；跨包 helper 继续由 implementation review 兜底，不建新 checker。

### B-2：根容器、LayerStack、card 与 section 的版式（CP-5b）

落点全集：

- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx`：两形态共享 root `layout="fill"`，RN style `flex:1,width:'100%',minWidth:0`；`AdminShell.tsx` 只保留既有公共兼容 wrapper，form-specific `AdminShellLaptop.tsx`/`AdminShellMobile.tsx` 分别提供 laptop shared parent row、header、device-context section 与 mobile wrap nav + one content frame；
- `apps/terminal/ui/base/render/src/components/LayerStack.tsx`：全屏 content wrapper 删除旧 `alignItems:'center'`、`justifyContent:'center'`、`padding:24`；保留遮罩、decisive/dismissible、hardware back 和层级语义；
- 原需求的 9 个 callsites / 8 个 components 逐项核对：member-desk 四个 confirm、AuthNotice、SystemFailureNotice、AdminLogin 仍为 7 个 floating card component；原 AdminShell 两分支已由共享 `AdminShellFrame` 改为 full canvas，不再是 card，不能把这两个转换遗漏；
- content 层与四个 section components：`AdminShell` content、`SampleSection`、`PlatformPortsSection`、`RuntimeSection`、`DisplayContextSection` 的 bounded 逐项处理，确保 scroll owner 与 `maxHeight:100%` 的基准不漂移；
- 样式只来自 `ui/base/primitives/src/theme/tokens.ts` 既有 token 或 RN style；不改 primitives token，不加 Tailwind class，不加 horizontal scroll。

建造步骤：先 root/LayerStack style，再逐项 card/content/section 对账，再接 laptop/mobile renderer；每处 style 变更记录唯一 anchor 和预期 exact flattened value。

必须跑的 focused 集合：admin-shell style/structure tests、LayerStack existing tests、U-9/U-10 structure tests、U-11 selection focused；不把 test renderer 的 style 断言升级成真实布局结论。

红夹具：root 恢复 card/maxWidth、LayerStack 任一旧 center/padding 恢复、把 center 挪到别的 wrapper、只改两处 AdminShell 忽略其余 bounded；精确值/全清单 review 必须发现；mask 透明度变化不能冒充铺满。

### B-3：a11y、焦点、返回、README 与公共面（CP-5c）

落点：

- laptop navigation 的 list/listitem/button 语义、detail heading 的可读播报、close/back focus restore；具体复用 `apps/terminal/ui/base/primitives/src/components/PrimitiveHeading.tsx` 的 host header + `accessibilityLiveRegion="polite"`，并由 `apps/terminal/ui/base/primitives/test/primitives.test.tsx` 锁定；mobile navigation 的 `tablist/tab`、selected/accessibility label、close restore；不实现 BackHandler 备选；
- `apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts`：保持动作节点单源；真实 button/tab/list item 挂载稳定 ID；不改 existing partKey/layerId/testID；
- `apps/terminal/ui/base/admin-shell/src/index.ts`、`terminal-invariants.json`、`test/publicSurface.test.ts`：只同步实际 public surface；form-specific renderer/private orchestration 不泄漏为新公共 API；若 source search 发现仓外消费者，OPEN 交 Dexter；
- `apps/terminal/ui/base/primitives/README.md`、`apps/terminal/ui/base/admin-shell/README.md`、两个 integration README、两个 assembly/App README（若本需求影响其说明）：按 TR-10 记录 `PrimitiveHeading` 的 header/polite announcement、装配输入、过滤、partKey-only、basename、layout/focus 语义。

必须跑的 focused 集合：admin launcher/password/focus/section/publicSurface tests；两个 integration real assembly tests；U-11/U-12/U-13。README 示例必须回源码核对。

红夹具：testID 挂在 wrapper 而非真实动作节点、selected 只靠颜色、close 不恢复 scope、public invariant 漂移、README 写出不存在的 API；相应 focused/static/review 必须红。

## 7. B 批后视觉与 native/Web 证据（不由本计划前置伪造）

B-1～B-3 focused/static 完成后，先做一次 B 批范围三维对账，随后才能做任何动态视觉或设备运行。当前 Dexter 实施授权已包含计划内动态验证；执行仍须满足受管 runtime 的授权入口、资源预检、日志、业务与 cleanup 分离规则。

未来 U-5/U-9/U-10/U-11 的证据必须按 `doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md` §14 记录：

- mobile 逻辑 360×640；laptop 采用实际双屏 logical/physical mapping，明确 PRIMARY/SECONDARY；
- release/native/Web 的入口、t0、截图/测量、ROI、改前基线、判定语句、判定人和原始产物路径；
- U-5 证明四种 content failure 的内容非空/可读/未裁剪，并同时证明 content ready 与 system/transition 分流；
- U-9 证明全屏/无 mask；U-10 证明 laptop 真正同屏，不以 shared parent/row 结构冒充；U-11 证明每个 frozen nav entry visible/reachable/tappable/unclipped/selected；
- `tools/terminal-image-compare/compare.mjs` 只作 ROI 辅助，不是 absolute oracle；设备/视觉判定不能由差分退出码替代。

证据计划目录：`doc/evidence/platform/2026-09-16-ter-screen-part-form-resolution/`，至少包括 `static.md`、`focused.md`、`u5-content-failure.md`、`u9-full-screen.md`、`u10-master-detail.md`、`u11-mobile.md`、`cleanup.md`。当前不创建运行证据、不填写 PASS。

## 8. 每批三维对账与逐代码与详设对账

### 8.1 步骤级三维对账

每完成 A-0、A-1、A-2、A-3、A-4、B-1、B-2、B-3 任一步，进入下一步前由 fresh 独立只读子 agent 执行三维对账；若同一对账任务因工具错误、运行失败或经状态诊断确认卡死，连续至少三次未能产出 verdict，则保留真实 status/失败边界并由主 agent 接管同一范围，明确标记 `REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE`，不得冒充独立审查；缺少可核实输入的部分仍为 `OPEN`：

| 维度 | 对账对象 |
|---|---|
| 需求 | 对应 R/U/D、Dexter 已定裁决、明确不做、partKey/layer/testID、用户任务 |
| 详设/IA | 对应 CP、字段、owner、failure/recovery、a11y/focus、容器/形态与 interaction anchor |
| 项目记忆标准 | 六维路由命中的设计标准、TR-12/TR-14、失败/证据/组件 owner 边界与已登记 pitfalls |

逐项检查行为、形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、可访问性/焦点、数据来源/失效边界。结果只有 `MATCHED` 或 `OPEN`；OPEN 必须由主 agent 修复后让新的独立对账者复查。阶段对账不是最终 review verdict，也不由测试汇总替代。

### 8.2 全批三维对账

A 批全部步骤结束、B 批开始前；B 批全部步骤结束、任何动态运行前；各自重新 fresh 对账整个批次，而不是复用步骤结果。全批三维对账不接受“阶段都绿”作为替代，跨步骤漂移必须在这里发现。

### 8.3 逐代码与详设对账（交付前置门）

这是独立于三维对账的最后门，必须在实现源码/测试/README 完成后、发送 implementation review handoff 前执行，步骤名固定为 `逐代码与详设对账`。

- 执行者：主 agent 逐行读取所有实际变更文件；另一 fresh 只读 reviewer 可复核结果，但不代写、不代跑；
- 范围：每一处新增、修改、删除的源码、测试、README、invariant 和同步文档行，不能只抽样；代码锚点逐项映射到详设 §4/§7/§8/§12/§13 与 IA 对应 IA-ID；
- 维度：owner、输入/输出类型、partKey/form、状态、文案、a11y/testID、失败/恢复、持久化/失效、日志脱敏、禁做项；
- 结果：每行只允许 `MATCHED` 或 `OPEN`。任一 OPEN 的交付语句必须是“实施未就绪”，不得发送 review handoff；修复后以同一变更清单重读；
- 不能替代：三维对账证明设计来源一致，逐代码对账证明实现没有偏离详设；focused/native/visual 也不能替代它。

## 9. 每批测试/证据对账矩阵

| 批次/步骤 | 必须覆盖的 U | focused/static | 未来 native/Web/visual | 收口 |
|---|---|---|---|---|
| A-1 | U-4a、U-5、U-5b | resolver/category/target surface/typecheck；含 U-5b content-ready→later-system-failure 时序 | U-5 visible/nonzero visual later | CP-1 + 3D `MATCHED` |
| A-2 | U-5、U-6、U-7b（结构无效/未知段）、ready propagation | hydration, writer, payload, diagnostics, restart-focused；不在此步宣称真实 other-form 分支 | cold-start/restart later | CP-2 + 3D `MATCHED`；U-7b 完整收口延至 A-3 |
| A-3 | U-1、U-2、U-3、U-4b、U-7b（filter 后 cross-form recheck）、U-13、U-14 | real assembly, overlap, production section denominators, post-filter hydration/render tree | none required yet | CP-3 + main-agent fallback 3D `MATCHED_FOR_CP3_SCOPE`; fresh reviewer failure and fallback record retained |
| A-4 | U-1、U-2、U-3、U-7、U-8、U-13、U-14、U-15 | same-component behavior, input completeness, normalized sibling fields | none required yet | CP-4 + A whole-batch 3D |
| B-1 | U-8、U-12、U-13、U-15 | hook behavior/AST, public surface, renderer binding | none required yet | CP-5a + 3D |
| B-2 | U-5、U-9、U-10、U-11 | exact style/structure/selection | U-5/U-9/U-10/U-11 device/visual | CP-5b + 3D |
| B-3 | U-7、U-10、U-11、U-12、U-13 | focus/a11y/testID/README/invariant | user visual if authorized | CP-5c + B whole-batch 3D |
| CP-6 | U-1～U-15 | all static/focused exact results | only authorized future tiers | line-by-line `MATCHED` |

U-4b 是既有 layer behavior regression guard，不被本计划改写为新的 screen not-found behavior；判据按具名用例保持实现与断言逐字不变，`sampleAssembly.test.tsx` 因 D-1/D-10 的其他用例改动而文件级 diff 非空是预期。U-8 命名前半是 review-only；U-5/U-9/U-10 的 visual segment remains a separately labeled evidence obligation。

## 10. 完整改动对账表

| 详设章节 | 计划步骤 | 实际实现时必须触及/明确不触及的路径 | 状态 |
|---|---|---|---|
| §12.1–§12.3 failure/ready | A-1/A-2 | render exported `RenderSurfaceReadyInput`（`readyPartKey:null`/`contentFailure`）、resolver/container/boundary/context/diagnostics、console writer、两个 integration `createStartupReadyPayload` 直接消费者与日志 | MATCHED；见 CP-1/CP-2 与最终逐代码对账 |
| §12.4 default/recovery | A-2/A-3 | optional integration declaration、workspaceSlices、contentActors、createUiStateModule；unknown/retired/other-form 不传 declaration metadata；A-3 追加真实 cross-form filtered hydration；不改 schema/migration/seed | MATCHED；见 CP-2/CP-3 与最终逐代码对账 |
| §12.5 conflict/filter | A-3 | consoleAssembly、real assembly tests；不改 catalog index/createUiCatalog public contract | MATCHED；见 CP-3/CP-4 与最终逐代码对账 |
| §12.6 sibling | A-4/B-1 | admin parts、renderer bindings、normalized focused test；不改 generic definePart | MATCHED；见 CP-4/CP-5a 与最终逐代码对账 |
| §12.7 layout/hook/public | B-1/B-2/B-3 | primitives `PrimitiveHeading`/focused test/README、admin components/sections/hooks/LayerStack/style/testIDs/index/invariant/README | MATCHED；见 CP-5a/CP-5b/CP-5c 与最终逐代码对账 |
| §14 evidence | B-2 后 | future `doc/evidence/...` only after runtime authorization | RECORDED；U8/冻结旅途/cleanup 已记录，Web 与独立视觉判定保持 OPEN |
| §15 D-1～D-15 | A/B/CP-6 | each row mapped in design and U matrix | MATCHED；见最终逐代码对账 |

计划中没有落点却会在实现里出现的改动属于 scope drift，必须回到 Dexter；计划列出的“不要触及”路径发生变化则对应 CP gate OPEN。

## 11. 失败处理与恢复纪律

未来每一条命令按阶段保存原始输出；失败后不盲重跑：

1. 先确定第一条失败、最后一条已知成功和 broken boundary；
2. 按 owning source 的职责追根，搜索同根 sibling 与反例；
3. 只做保持授权范围的最小根因修复；
4. 以 focused 夹具先重验；
5. 重新执行当前步骤级三维对账；
6. 若进入动态阶段，business 与 cleanup 分开，cleanup 非 PASS 不得收口。

content failure 是可见业务失败且可让目标 PRIMARY ready；system failure/transition 不得被默认或内容 fallback 改写；跨形态失效记录只裁剪本次 hydrated view，不用 default 覆盖显式请求。

## 12. 交付前状态格式

只有以下条件全部满足才可准备 implementation review（那仍不代表 review GO）：

- A、B 全部 CP 及步骤级/全批三维对账均 `MATCHED`；
- 逐代码与详设对账每行 `MATCHED`；
- 所有已授权的 static/focused/native/Web/visual/release/cleanup 证据分别标档，未执行档位明确 `OPEN`；
- U-1～U-15 的执行体都有实际结果或明确 `OPEN`，没有测试名称/exit code 冒充业务 oracle；
- obsolete 文件/出口处理有真实 consumer search 结果；确认 obsolete 才删除，未确认则 OPEN；
- handoff 明确 REVIEW_TARGET=IMPLEMENTATION，且不宣称 implementation/acceptance PASS。

```text
PLAN_STATUS=AUTHORIZED_FOR_IMPLEMENTATION_BY_DEXTER
IMPLEMENTATION_STATUS=IMPLEMENTED_PENDING_IMPLEMENTATION_REVIEW
LINE_BY_LINE_RECONCILIATION=MATCHED
CURRENT_EVIDENCE=CP-1_CP-2_CP-3_CP-4_CP-5a_CP-5b_CP-5c_RECORDED; A whole-batch and all CP focused/fresh step reconciliations MATCHED (CP-3 explicitly MAIN_AGENT_FALLBACK after repeated fresh-agent failure); B whole-batch fresh reconciliation MATCHED at doc/review/platform/2026-09-16-ter-screen-part-form-resolution-b-batch-reconciliation-jason.md; release U8 and sample1/sample2 frozen journeys recorded with business=PASS and cleanup=PASS; final line-by-line reconciliation MATCHED at doc/review/platform/2026-09-16-ter-screen-part-form-resolution-code-design-reconciliation-codex.md
```

## 13. 最新复评 finding 处置记录

| finding | 处置 | 落点 | 证据/状态 |
|---|---|---|---|
| M-4 | **真修复**：撤回 wallpaper 匿名 PRIMARY 为空的错误事实；完整清单确认共享 staff-auth 在两个 integration 的匿名恢复/退出时都放置 PRIMARY `sample.auth.login`，因此 U-6 的 `readyPartKey=null` 改用显式 synthetic fixture，不冒充当前旅途。 | A-0 第 3 项、A-2 默认与恢复规则、§9 U-6；详设 §12.4/§13/§15 | `rg -n "showScreenCommand" ... --glob '!**/test/**'` 加 assembly/modules 源码复核；实现前状态已校正，未将 synthetic 证据写成 production journey。 |
| S-6 | **真修复**：U-4b 改为具名用例实现/断言逐字不变；同一 `sampleAssembly.test.tsx` 中 D-1/D-10 点名的 hand-built catalog 用例允许计划内改动，文件级 diff 非空不再冲突。 | A-3 focused 集合、§9 U-4b、§10 对账 | 实施时逐用例保存基线并回读；变更清单只允许具名护栏 `MATCHED`，不能以文件级 diff 代替。 |
| N-4 | **真修复**：统一 `hydrated-container-not-renderable` 的中性文案“该恢复记录在当前 catalog 中不可呈现，已移除本次恢复记录”，不新增 reason 或跨层 metadata。 | A-2、§9 U-6/U-7b、详设 §12.4/IA §6 | 实现后 focused sink/diagnostic 断言；恢复机型归因文案或额外 reason 为 red mutation。 |

本轮 fresh 只读审查已完成并确认 M-4、S-6、N-4 的前置事实与最小修复方向；其原始审查记录由主 agent 以只读报告形式保存。该内部审查不替代最终 `REVIEW_TARGET=IMPLEMENTATION`，也不把实现结果预报为 PASS。
