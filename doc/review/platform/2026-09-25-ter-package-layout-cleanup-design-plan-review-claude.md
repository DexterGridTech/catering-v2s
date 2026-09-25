# TER 包布局整理 · 详设与实施计划评审（Claude）

```text
REVIEW_TARGET=DESIGN（implementation-facing 详设 + 实施计划）
VERDICT=NO-GO
M/S/N=0/5/2
```

```text
评审对象（SHA-256 前 16 位）：
  doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md  9d1fff6907c93b36
  doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md    8dd03c71751782d4
  doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-adversarial-review-codex.md  21f4207fe0711c44
硬输入：需求 v5、方案 v5（均为 Claude 所写；本评审对“详设是否落实需求”做独立核验）
EVIDENCE_TIER=仅静态：Claude 回读源码、检查器与 runner；未运行任何命令、门、构建或设备
GRANULARITY_MANIFEST=按 CLAUDE.md，design-granularity 属已退役的 compliance-control，不作为评审输入或 GO 条件
SESSION=CONTINUED_SESSION（v2s 仓根，经上下文压缩续接，不是 fresh acceptance）
AUTHORITY=本评审不授权实施、安装、构建、Web、设备或任何数据操作
```

## 1. 结论

方向与主体都对：
- CP-0 到 CP-4 的分步合理；锁文件“普通安装 → 按允许差异比对 → `--immutable` 复验”的协议写实了。
- AC-8 的快照与六种红变异、AC-9 的每 App 构建后读取加 APK 内 dex 核对，都已落实。
- PrimitiveForm 与现有 StaffLoginForm 语义一致：Web 下 form 包一层并 `preventDefault`，没有回调。
- 两轮 fresh 独立盲审与 SELF_DECIDED 收口合规。

挡住 GO 的是 5 处局部缺口，都不涉及方向。修法是在文档里补写，不需要重新设计。

## 2. Findings

### S-1 · AC-10 的绝对期望值缺前置状态，证据格式与入口有错 · CONFIRMED · 需 Dexter 裁决：否

**仓内事实**
- 详设第 623–624 行、计划第 627–628 行把期望值冻结为冷启动首屏 `primaryReadyPartKey=sample.auth.login`、SECONDARY `sample.wallpaper-console.waiting`。
- 这两个值只在会话恢复为匿名时出现：
  - 登录页由 `sample-staff-auth/src/features/actors/actors.ts:36-41` 放置；
  - SECONDARY 等待页由 `sample-wallpaper-console/src/features/actors/actors.ts:84-87` 在 `sessionRestoredAnonymousCommand` 时放置。
- 设备端与 Web 端都有持久化会话。上一批键盘设备运行的首败，正是 wallpaper App 已处于登录态。
- 详设与计划都没有写“如何进入并确认匿名态”：计划全文检索不到匿名、logout、清数据之类的步骤。
- Web 入口参数没有冻结：如何选 mobile 形态（此前的 Web 证据用过 `?surfaceForm=` 查询参数），如何进入双屏预览，都没有写。
- 详设第 630 行的 JSON 示例字段类型与源码不符：
  - 示例写的是 `groups:[]`、`primaryDeclared:{}`、`primaryMeasured:{}`；
  - 源码 `startupDiagnosticsWriter.ts:13-20` 中，`groups` 是六个布尔值组成的对象，`primaryDeclared`、`primaryMeasured`、`primaryRealReady` 都是布尔值。
- 详设第 634 行、计划第 616 行把 readiness 来源写成 `startupReady.ts`。实际来源是 `consoleAssembly.tsx:374-385` 的 `getStartupReadiness`；`startupReady.ts` 是 startup-ready 的 actor 与 payload。

**影响**
- 设备或浏览器留有登录态时，AC-10 必然误报失败；
- 执行者可能临时用清数据之类未授权的破坏性手段绕过；
- 按错误的类型实现证据校验器，会校验错字段。

**验收判据**
- 每行冷启动前都有一个写死的“匿名态”准备与确认步骤，并记录进入前的状态：
  - 优先走产品内登出；
  - Web 端清除该 integration 的持久化键，或使用全新浏览器配置；
  - 确需清除设备 App 数据时，列为单独授权项，不得默认执行。
- Web 入口写成具体 URL 与参数。
- JSON 的类型与 `StartupDiagnosticsReadiness` 一致；readiness 来源改为正确出处。

### S-2 · AC-3 缺需求要求的一条红测试，另一行 gate 不唯一 · CONFIRMED · 需 Dexter 裁决：否

**仓内事实**
- 需求 AC-3 要求补三条新红测试：ui→application、adapter→application、application 下出现 `node_modules`。
- 详设第 556–558 行、计划第 565 行的三条是“UI feature 指向 automation”、adapter→application、`node_modules`。缺 ui→application，也就是 layering `check-static.mjs:184` 那条规则。换上的“指向 automation”指向的是一个已下线的包，不证明任何层规则。
- 详设第 553 行那一行：
  - gate 写成“planned-dependency/AC-2 residual”，报文写成“`FIRST_FAILURE:planned-dependencies:` 或固定 residual prefix”，不唯一；
  - 它依赖的 `plannedDependencies` 机制在 CP-1 已被删除。需求规定这里由 AC-2(a) 的零命中负责控制。

**验收判据**
- 补上 ui→application 的 layering 红测试，断言具体 gate 与报文；删掉指向 automation 的那条。
- 第 553 行改为 AC-2(a) `plannedDependencies` 零命中及其正控制，或改成一个唯一的 gate 与报文。

### S-3 · 逐处分类只给了原则，没给逐行内容 · CONFIRMED · 需 Dexter 裁决：否

**仓内事实**
- 需求 AC-2(b) 要求“详设逐处分类”，AC-11 要求“详设先列出正本类文件里 assembly 的每一处出现，逐处标类”。
- 详设第 540–544 行只给了 12 个标识符家族与表格字段，没有逐行内容；第 486–497 行的正本表是按文件写原则，例如“按上下文”。
- 唯一有歧义的家族 `assemblyPromises` 没有归类。

**影响**：执行时仍要现场判断，评审无法事先核对。这正是需求要求在详设阶段就逐处列出的原因。

**验收判据**
- 详设附一张逐行表，覆盖当前正控制的全部命中（标识符约 46 处，外加正本散文各处），每行写 `path:line`、token、类别、处置、理由。
- `assemblyPromises` 明确归类并写理由。

### S-4 · 记忆同步方式偏离需求；锚点更新方式写错 · CONFIRMED · 需 Dexter 裁决：否

**仓内事实**
- 需求 §7 与 AC-11 规定两种处理：
  - 描述当前结构的正本直接改为现状，例如 `terminal-architecture-and-stack-rulings` 的层列表；
  - 只有按批次记录的决策文件（`terminal-build-order-and-batches`）才只追加取代条目。
- 计划第 667 行、详设第 494 行对四份记忆一律“只追加”。结果是层列表、TR-16 镜像条文的正文仍写 assembly，与追加的取代条目互相矛盾。详设也没有登记 DESIGN_GAP。
- 计划第 667 行说 `required-inventory.json` 的 TR-16 锚点“由既有生成命令更新”。但 `tools/project-memory/cli.mjs:113-115` 只是逐字核对锚点行是否存在，TR-16 标题一改，锚点必须手工同步。这一处门会报红，不会静默放过，但计划写错了。

**验收判据**
- 按文件区分：
  - `terminal-architecture-and-stack-rulings`、`operations/terminal-coding-standard`、`practices/ter-input-and-virtual-keyboard-usage` 直接改为现状；
  - `terminal-build-order-and-batches` 只追加带日期的取代条目。
- 锚点随 TR-16 标题手工同步；改后 project-memory 检查必须通过。

### S-5 · readability 的 11 处重构没有逐处方案，其中 5 处在刚上线的键盘状态机里 · CONFIRMED · 需 Dexter 裁决：否

**仓内事实**
- 详设第 206–215 行、第 253–254 行，以及计划 §3.4，只写了规则层面的通用做法（“职责对象或拆小 helper”“提前返回”）和文件名，没有逐处写出目标形态。
- 11 处中，`InputSurfaceFrame.tsx:599,666,753`、`InputScrollArea.tsx:193,207` 位于上一批刚上线的呈现与滚动状态机；`topology/actors.ts:58,570,576` 位于拓扑 actor。
- 需求要求在详设中冻结“readability 各条的重构方式”，本轮交接话术也点名了这一项。

**影响**：这几处的重构最容易在不经意间改变行为，而没有逐处方案，评审无法事先判断风险。

**验收判据**：详设加一张逐处表，覆盖全部 11 处，每行写：
- 位置、规则；
- 目标形态，例如新参数对象的类型名、提取出的 helper 名；
- 锁定该处行为的现有测试名；
- 如需新增 focused 测试，写明名称。

### N-1 · 文档里写死了本机绝对路径 · CONFIRMED

- 位置：详设第 145、322、593、595 行，计划第 92、274、590、592 行，均为 `/Users/dexter/...` 形式。与本仓在其它机器上的挂载路径不同，也违反“文档不写本机绝对路径”的约定。
- 其中归档根与恢复命令依赖这个路径，换机器就无法恢复。
- 验收判据：命令改为从仓库根执行、使用仓根相对路径；归档根写成“与仓库同级的 `.ter-package-layout-cleanup-archive/`”这类相对表述，恢复命令同样用相对路径。

### N-2 · 设备端 SECONDARY 的读取命令未经验证 · UNVERIFIED_REQUIRES_EVIDENCE

- 详设第 635 行、计划第 619 行使用 `uiautomator dump --display 1`。
- 仓内已跑通的做法是 `uiautomator dump --windows`（`scripts/test/ter-virtual-keyboard-android.mjs:1993`），再按 XML 中的 `<display id>` 分段解析（同文件第 239–266 行）。
- 验收判据：沿用已跑通的方法；如坚持 `--display`，先给出它在两台虚拟机上可用的证据。

## 3. 核实成立

- **CP-0**：
  - 基线 B-01 至 B-06 的根因与修法与源码一致：transport 夹具补 `moduleName`；App 包图补边；StaffLoginForm 改为 primitive；darkMode 删除，checker 与测试保留反向守卫；先盘点、后清理。
  - 被忽略产物的处理边界清楚：keystore 与 `.runtime/` 不删，四包的 `.turbo` 在归档前清理并记录。
- **CP-1 至 CP-3**：
  - 完整文件集、归档清单字段与恢复约束、每步的锁文件允许差异，以及每步完整的子门清单，都已写实；
  - 死规则第 783 行的删除写明为允许差异。
- **AC-2**：正控制计数、活跃文件清单与各模式都在；darkMode 的零残留只针对运行、配置与业务测试，checker 的守卫另行分类，与 D-6 一致。
- **AC-8**：文件集取全部活跃文件，比对顺序与六种红变异齐全。
- **AC-9**：
  - 每个 App 构建后立即读取共享的 `ExpoModulesPackageList.kt`；
  - APK 内 dex 类核对；
  - 证书摘要与 keystore 比对，基线证书 SHA256 已给出；
  - 不用 `PackageList.java` 代替。
- **AC-13**：`TR-08=OPEN/OUT_OF_SCOPE` 口径正确，后续待办有 owner、输入与首个 gate。
- **治理**：
  - 逐代码与详设对账是交付硬门（计划 §9）；
  - 昂贵阶段前置门写全，包括 TR-16 顺序、同一失败族第二次即停、只一个受管运行、运行中不改源码。

## 4. 方案合理性

问题与方向都对。选 C 方案的理由（逐步可定位、不留旧入口、可恢复）成立，D 方案“一次改完再修门”被正确否决。

5 处 S 都是“写到位”层面的缺口，不是方案错误；修正的代价是补几张表、改几段文字。

UI 自问：详设写 NOT_APPLICABLE 成立。StaffLoginForm 只把 Web 的 form 宿主移到 primitive，用户可见的表单与交互不变。

## 5. 建议

- Codex 在文档内补齐 S-1 至 S-5 与 N-1、N-2 即可，不需要重新设计。
- 这几处都是局部补写，建议 Codex 修完后自行逐条回读确认，然后进入 CP-0；是否需要再交 Claude 复审，由 Dexter 决定。
- 本评审结论不授权实施。
