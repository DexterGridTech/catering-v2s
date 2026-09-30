# TER 第三方库用法整改 · 实施结果复核（Claude）

- 评审对象：`doc/review/platform/2026-09-29-ter-third-party-usage-remediation-implementation-review-request-codex.md` 所述整批实施的当前字节，对照需求 `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`、详设 `...-implementation-design-codex.md`、计划 `...-implementation-plan-codex.md`。
- 会话出处：v2s 仓根发起，**续接会话**（上下文经一次压缩），非 fresh 会话。按 Dexter 本次授权边界，**本轮未运行任何构建、测试、Web、Android、设备或拓扑**；全部结论来自重开源码、配置、既有 `.runtime` 日志与 manifest 的静态亲验，以及 Turborepo 官方文档。本文不是 fresh acceptance，也不把 Web、focused 或 JVM 结果升级为 native、拓扑、视觉或业务验收。
- 作者此前两份复核（`GO_WITH_UNVERIFIED_UI` 0/0/0 与 0/0/3）非 fresh 独立盲审，本轮未援引其结论。

## 方案合理性

1. 问题对不对：本批目标是纠正第三方库误用与由此带来的错误边界、持久化、拓扑关闭语义与测试入口缺口，属于已接受需求 v3.4 的范围。实现方向与需求一致，没有发现"精确做 1+1、用户要 5-4"式的方向偏离。
2. 方案优不优：错误边界选 `react-error-boundary`、TP-A9 锁外 I/O 加本端意图优先、dev-matrix 双态唯一入口，均是比自造机制更简单的选择。两处偏离最优：
   - 调试注入用运行期开关（S5），而不是编译期剔除；
   - surface 外层边界只包了 content、没包 LayerStack（S4）。
   两处的更简替代都很小，见对应 finding。
3. 代价配不配：Web runner 与拓扑 evaluator 的复杂度偏高。W4 runner 超过 1000 行，并用源码文本断言约束自身（S1）。这类"用 checker 约束 checker"的做法已经反过来锁死了一个回归。建议修复时删掉文本断言，而不是再加一层。

## UI 与交互自问

本批 UI-bearing 项：TP-B1、B3、B4、B5，以及只同步语义色键的 A6。

- 操作来源：唯一"知道了"按钮与管理入口 5 连点手势都来自已裁定需求 §1.1 与 TP-B1，本批未新增入口或文案（详设 :122）。
- 路径合理性：出错后只保留"知道了"与管理入口，已是最短路径。
- 不合理之处的来源：
  - S4 来自实现对详设 :129 的取舍：为了让 admin console 在内容失败后仍可达，把 LayerStack 留在边界外，却同时让 LayerStack 本身失去兜底。
  - S1 是历史实现惯性，runner 与生产手势常量脱钩。
  两者都不是产品语义未裁决，不需要 Dexter 裁定 Journey。
- 视觉：57 个语义色键没有全量视觉验收，列入 L3。

## Findings（M/S/N = 0/6/5）

### S1 · Web runner 失败后管理入口只点 1 次，与生产 5 连点手势不符，且被源码文本测试锁死

- 仓内事实：
  - 生产端：`apps/terminal/ui/base/admin-shell/src/foundations/adminLauncher.ts:24-26,112-124` 要求 `ADMIN_GESTURE_REPETITIONS=5`，并在 `WINDOW_MS=1_800` 内完成，越界即重置。
  - 当前 runner：`scripts/test/ter-admin-display-web.mjs:162-165` 的 `observeAdminLauncherAfterFailure` 在非 admin-layer 分支只执行一次 `page.mouse.click`，随后等待 `terminal.admin:login` 出现（10 s）。
  - 该函数有 4 个调用点：:402 screen、:507 secondary、:622 layer、:990 admin-runtime。
  - `scripts/test/ter-admin-display-web.test.mjs:713-724` 断言 helper 源码里恰有 1 个 `page.mouse.click(`，且不含 `for`/`while`。这正好把回归冻结下来。
- 历史证据：0929 的 13 个非 admin PASS run，原始 `expo-web.log` 均在 `reset-unavailable` 之后出现 5 条 `admin.launcher-gesture-progress`，再接 `launcher-open-requested` 与 `open-result status=completed`。例如 member-list 的日志序号为 reset@167、progress@184-188、open@189、result@200。这些 run 出自旧 runner 字节（5 连点）。0930-02、0930-03 走的是 `admin.console.layer` 分支，不经过单击路径。
- 推论（未运行验证）：
  - 当前字节下，7 个 screen owner、非 admin 的 layer owner 以及 admin-runtime 失败路径重跑时，都会假 FAIL（超时）。
  - 这不会造成假 PASS。但本批唯一获授权的剩余动态手段在当前字节上不可复现 W4 结论。
  - 文本断言属于 `PRODUCTION_RED_MUTATION_REQUIRED` 意义上的伪语义门。
- 最小修复：
  1. helper 在同一 bounds 点击 `ADMIN_GESTURE_REPETITIONS` 次（从 admin-shell 导出常量，或在 runner 内与其对齐）；
  2. 删除 :713-724 的源码文本断言。若需要保留防回归，改为 fake page 计数 click 直到 login 出现的行为测试。
  不需要新增门。
- Dexter 裁决：不需要。

### S2 · Turbo `test` 可缓存，而所有 TER 包的测试执行体位于包外，改共享 runner 会回放旧 PASS

- 仓内事实：
  - `turbo.json:7` 为 `"test": {}`，可缓存，且没有 `globalDependencies`/`inputs`。
  - `apps/terminal` 下 27 个包的 `test` 脚本均为 `node ../../../../../tools/terminal-shared/run-owned-tests.mjs`，例如 `apps/terminal/ui/base/render/package.json:11`。`tools/terminal-shared` 不是 workspace 包。
  - `tools/terminal-skeleton/verify.mjs:326` 执行 `yarn turbo run test` 时不带 `--force`。`assertTurboDryRun`（:231 起）不检查 cache 状态。
- 外部事实：按 Turborepo 官方缓存文档（turborepo.dev → Caching），默认 inputs 是包目录内受版本控制的文件；缓存命中时回放首次运行的日志。
- 推论：若只改动 `run-owned-tests.mjs` 或 `run-dev-branch-red-fixtures.mjs`（例如 dev-matrix 或失败判定逻辑坏掉），各包 hash 不变，verify 会回放旧日志，其 marker 正则同样通过，形成假 PASS。
  - 反例：无缓存的新环境。作者自报的"无缓存单 Turbo 全量 27/27"不受影响。
- 最小修复：在 `turbo.json` 加 `"globalDependencies": ["tools/terminal-shared/**"]`，保留缓存速度；或将 `test` 设为 `cache:false`，与 lint 一致。推荐前者。
- Dexter 裁决：不需要。

### S3 · TP-A5 红夹具只覆盖 5 个 `*.dev.test.*` 中的 3 个，且只覆盖 DEV 态

- 依据：
  - 需求 :265-273 要求"每个 `__DEV__` 分支（DEV 与 PROD 各算一个）……每个分支各有红夹具"。
  - 详设 :59、:182 把分母定为当前 5 个文件、"every `*.dev.test.*` file"。
- 仓内事实：`tools/terminal-shared/run-dev-branch-red-fixtures.mjs:9-57` 的 5 个夹具只落在 3 个文件上：
  - platform-ports `startupDiagnostics.dev.test.ts`
  - runtime `startupDiagnostics.dev.test.ts`
  - render `startupDiagnostics.dev.test.tsx`
  并且全部以 `TERMINAL_TEST_DEV_MODE:'true'` 运行（:131）。`InputSurfaceFrame.measurement.dev.test.tsx` 与 `systemFailureInjection.dev.test.tsx` 没有红夹具；PROD 态没有任何红夹具。
- 影响：dev-matrix 确实会跑两态（`run-owned-tests.mjs:120,137`）。但对这两个文件与 PROD 分支，"分支确实被执行且断言会红"缺乏证据。
- 最小修复：为两个缺失文件各补 DEV 夹具；为每个文件补一个 `TERMINAL_TEST_DEV_MODE:'false'` 的 PROD 夹具，复用现有 fixture 结构。
- Dexter 裁决：不需要。

### S4 · LayerStack 位于 surface-content 边界之外，且 `resolvePart` 在 LayerStack 自身 render 中求值，per-layer 边界接不住它的异常

- 依据：详设 :129 写明"外层 ErrorBoundary 是 surface-owned wrapper，包住 `SurfaceRoot` 子树"，:140 写明"screen/layer 之外的 surface-owned sibling 与最外 surface boundary"。
- 仓内事实：
  - `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:18-24` 只让 `surface-content` 包住 `children`/`ScreenContainer`，`<LayerStack />` 是边界外的 sibling。
  - `LayerStack.tsx:210-222` 在 `<SystemFailureBoundary ownerId="layer:…">` 的 JSX children 位置直接调用 `resolvePart({... catalogContext: catalogContext! ...})`。该调用发生在 LayerStack 的 render 期。
  - :103/:112 显示 `catalogContext` 可能为 `undefined`。
  - `AdminLauncher` 包住整个 content（`integrationAssembly.tsx:790`），`admin.console.layer` 经 LayerStack 渲染。
- 外部事实：React 错误边界只捕获其后代组件在 render/lifecycle 中抛出的错误，不捕获父组件自身 render 中的错误（react.dev → Component → componentDidCatch / Error Boundaries）。
- 推论：
  - LayerStack 自身的 hooks、selector、`resolvePart` 同步逻辑抛出的异常不进入任何 `SystemFailureBoundary`，会冒到根，整面崩溃且没有"知道了"。
  - 真实触发频率 UNVERIFIED。`resolvePart` 对已知失败返回 `RenderFallback` 而不是抛出。
  - 实现把 LayerStack 放在外面，大概率是为了在内容失败后仍能打开 admin console。这一点合理，所以不应简单地把 LayerStack 挪进 `surface-content`。
- 最小修复：
  1. 把 `resolvePart(...)` 包进一个极小的子组件（如 `<ResolvedLayer .../>`），让 per-layer 边界真正覆盖它；
  2. 给 `<LayerStack />` 单独套一个 surface-owned 边界（如 `ownerId="surface-layers"`）。
  两者都不改变 admin 可达性。
- Dexter 裁决：不需要。详设 :129 的措辞缺口列入 DESIGN_GAPS。

### S5 · 调试失败注入是运行期开关，违反详设硬不变量 4 与 TR-08

- 依据：
  - 详设 :46"调试注入按 `TR-08` 编译期剔除"；
  - `doc/platform/terminal-coding-standard.md` TR-08（约 :278-290）要求"production 构建产物里必须不存在"，并以"运行期分支，代码照常编进产物"为反例。
- 仓内事实：
  - `apps/terminal/ui/base/render/src/components/SystemFailureBoundary.tsx:20-27` 以导出函数 `isDebugFailureInjectionEnabled(__DEV__, process.env.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION)` 求值。
  - :63、:67、:112 是运行期分支。
  - `parseDebugFailureInjectionUrl`、Linking 订阅与 `throw new Error('TER_DEBUG_FAILURE_INJECTION')` 都在同一生产模块中。
  - 两个 App 的 `build.gradle:118-131` 只约束 debug 内嵌 bundle 必须带开关，对 release 不做剔除校验。
- 缓解事实：
  - release 构建不设该变量，运行期结果为 false；
  - 在 `apps/terminal` 的 xml/json 中未检索到 `ter-failure` scheme 注册。
  推论：release 端很可能无法被外部 URL 触发。
- UNVERIFIED：release bundle 里是否仍含注入代码。本轮未构建，也未检查产物。经过导出函数包装后，Metro 常量折叠能否消除这段代码没有依据。
- 最小修复：
  - 改为模块级内联条件 `if (__DEV__ || process.env.EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION === 'true')`，并把注入实现拆到仅在该分支内 `require` 的独立模块；
  - 在既有 release 构建路径上，对产物 bundle 断言不含 `TER_DEBUG_FAILURE_INJECTION`。这是产物事实，不是语义关键词门。
- Dexter 裁决：不需要。

### S6 · T4 七来源证据无生产者，计划要求的拓扑受管 wrapper（构建双 APK 并绑定源摘要）不存在；evaluator 另有三处自信任

- 依据：计划 §8.1a T4 行要求七种来源逐一触发、有界完成、原因码合表；计划 :179 要求 wrapper "builds both target APKs, and binds APK SHA-256 to source digest"。
- 仓内事实：
  - `closeOriginEvidence` 在全仓只有 `tools/terminal-topology/run-dual-device.mjs:4461` 一处读取，没有写入点。请求文件 :23 引作 :4385，行号已漂移。
  - runner 使用预置的 `.../apk/release/app-release.apk`（:85、:95）。它只比较已安装与本地 APK 的 sha（:674-703），scripts/tools 中没有调用 `run-dual-device` 并构建 APK 的 wrapper。
  - evaluator 的三处自信任，位于 `tools/terminal-topology/journey-acceptance.mjs`：
    - :246-248 的时间上限与 `expectedReason` 取自证据行自身，而不是源码常量或 TP-A9 表；
    - :22-28 的 `remote-close` 接受任意 5 种原因；
    - :274-277 单个 profile 也可 PASS。
- 现状判定：今天 fail-closed，T4 永远 OPEN，不会假 PASS。作者在请求中如实披露了生产者缺口。上述自信任是"生产者补上之后"的潜在假 PASS 面。
- 最小修复（补生产者时一并做）：
  - 时间上限取自 `topology-transport.config.json`；
  - 每个来源的原因码取自 TP-A9 表的单值；
  - profile 集合与两个 App 严格相等；
  - wrapper 复用 `tools/terminal-sample2/run-u8-release-cold-start.mjs` 已有的 assemble 路径。
- Dexter 裁决：**需要（DEXTER_DECISION）**。在 Web-only 授权下，是本批就实现生产者与 wrapper 但不运行，还是把 T4 与 T1..T5 一起登记为拓扑运行前的准入欠账。

### N1 · 请求文件漏列 0930 的首败与中间运行

请求 :7 自述"不得抹去首败"，但只列出 `...w4-layer-console-laptop-20260930-03`，没有列出以下运行：

- `-20260930-01`：FAIL，digest c6c4ffe9，firstFailure 为等待 `terminal.admin:login` 超时；
- `-20260930-02`：PASS，digest f7a9d750；
- 5 个 `ter-review-w1-*-20260930-*` 运行。

修复：在请求中补列。另外"此修复只改 runner"（:7）仅指 SECONDARY 几何修复，表述成立；cea7823f 的 Kotlin 改动已在 :13 披露。

### N2 · 0929 的 51 个 manifest 没有 `sourceStable` 字段

只有 0930 的 run 记录了 before/after 摘要稳定性，因此 51 次旧运行的证据档位应标注为"未记录运行期间源码稳定"。只需补标注，不需要重跑。

### N3 · 默认并发失败的定性

- 仓内事实：失败落在 `kernel-base-transport` 两个大载荷编码上限测试上；runner 已删除原始报告（请求 :11）。
- 推论：两者都是 CPU 密集的同步编码，默认并发下容易撞上 vitest 默认 5 s `testTimeout`，属环境性超时的可能性大。但它**未证实**，不得写成 PASS，也不得写成产品缺陷。
- 最小修复：让 runner 在失败时保留原始报告；为这两个测试显式设定 `testTimeout`，或缩小载荷而不改上限语义。

### N4 · W4/W9 标注还可以更精确

- W4 的 per-owner 判据中，"siblings 仍挂载"在 Web 上可观察，但 runner 没有断言；"native 保留 / 仅 JS 重启"在 Web 上不可观察。
- 请求 :17 只按 owner 列 PASS/OPEN，没有按判据列出哪些未覆盖。
- W9 的 `startup.complete → ready-hidden` 顺序在 Web 上只验了一半。请求 :19 已如实说明 native 部分未证明。

修复：在请求里按判据列出 `NOT_OBSERVABLE_ON_WEB` / `NOT_ASSERTED`。

### N5 · README/注释漂移线索（UNVERIFIED）

压缩前的子 agent 线索包括：

- primitives、application-base-android、transport 的 README 与实现不一致（TR-10）；
- transport 注释写 4×258，详设写 8×258。

续接后未逐字复核，交 Codex 核对后自行处理或驳回。

## 专项结论（对应 Dexter 的四问）

- 假 PASS：
  - 现存路径有一条，即 S2 Turbo 缓存回放。
  - S6 的 evaluator 自信任是潜在路径，今天 fail-closed。
  - Web runner 的 digest 绑定与 OPEN/cleanup fail-closed 成立；当前的单击回归只会造成假 FAIL（S1）。
- 默认并发失败：未证实的疑似环境性超时（N3），保持 OPEN。
- Web digest 不一致：当前摘要 0a58979e 与 W4 最新 run 的 1666cc1a 之间，差异只有 Android Kotlin registry、一个 TS 测试和一个新 JVM 测试。这不改变 Web 可见行为，因此不影响已有 Web 证据的范围。但"整清单同摘要"条件与 TR-16 设备侧同摘要仍为 OPEN，请求 :13 的表述属实。
- W4 六项 OPEN、W9 native、T1–T5、T4 `closeOriginEvidence`：请求如实标为 OPEN / NOT_RUN / 豁免，没有冒充 PASS。需要补充的只有 N1 与 N4。

## 收口

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/6/5
L1_ENGINEERING=findings: S2 Turbo 缓存假 PASS 面；S3 TP-A5 红夹具分母不足；S5 硬不变量 4/TR-08 未满足；S6 T4 生产者与受管 wrapper 缺失（fail-closed）；TP-A9 锁外 I/O 与本端意图优先原因码已亲验成立
L2_USER_VISIBLE=findings: S4 LayerStack 异常无兜底会整面崩溃且无"知道了"；S1 当前 runner 无法复现 W4 管理入口可操作结论（0929 旧字节日志支持 13 个 owner 的 5 连点后 completed）
L3_UNVERIFIED=W5/W7/W8/W10（Dexter 豁免）；W4 6 个 layer owner OPEN；W4 native 保留/JS 重启（Web 不可观察）与 siblings 未断言；W9 native callback/splash/resetRuntime 时序；57 个语义色键全量视觉；W2 mobile NOT_COVERED_BY_PRODUCT_CONSUMER；T1–T5 NOT_RUN_BY_WEB_ONLY_AUTHORIZATION；TR-16 设备侧与同摘要；release bundle 是否含调试注入；默认并发失败根因
SAME_ROOT_SCAN=S1: observeAdminLauncherAfterFailure 4 个调用点全受影响，失败前 5 连点循环（:581,:692,:891,:1003,:1071）正确；S2: 全部以 tools/terminal-shared 为执行体的 TER 包；S3: 5 个 *.dev.test.* × DEV/PROD；S4: SurfaceRoot 下 ScreenContainer 已在边界内，LayerStack 是唯一边界外的渲染 sibling；S5: 仓内 TER 生产源码中唯一的 EXPO_PUBLIC_TER_DEBUG_* 运行期开关；S6: 7 个来源 × 2 profile
DESIGN_GAPS=详设 :129 "包住 SurfaceRoot 子树" 与 "AdminLauncher/admin console 在失败后可操作" 未写清层级取舍；详设 T4 行（:198）比计划 §8.1a T4 窄（未列全七来源与 wrapper 绑定）；remote-close 允许原因集合缺判据；evaluator 时间上限/原因码的来源缺判据
EVIDENCE_TIER=静态亲验（续接会话，本轮零运行）；Web 证据为作者既有受管 run 的原始日志复读；JVM/focused 数字未复跑，仅作作者自报
```

授权边界：本结论只是实施后静态复核，不授权任何构建、测试、Web、Android、设备或拓扑运行，也不授权扩大实现范围。S1–S5 与全部 N 由 Codex 在既有批准边界内自主修复；S6 须等 Dexter 裁决。修复后需要按 IMPLEMENTATION 口径再做独立复核；在 L3 非空的前提下，届时的上限是 `GO_WITH_UNVERIFIED_UI`。
