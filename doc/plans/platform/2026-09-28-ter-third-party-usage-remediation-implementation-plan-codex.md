# TER 第三方库用法整改实施计划

> `SOURCE_REQUIREMENT=doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`（v3.4，唯一需求输入）
> `DESIGN=doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`
> `IMPLEMENTATION_AUTHORITY=true`，来源：Dexter 2026-09-28 会话授权——修订 S-1..S-3 后无需复评，立即按 v3.4 计划实施并完成验收。
> `REVIEW_CYCLE_ID=TER-THIRD-PARTY-REMEDIATION-DESIGN-V3-4-2026-09-28`；阶段 A→B→C→D 是同一原子批次的顺序，不单独交付或 review。

## 1. 目标、范围与完成条件

按 v3.4 完成 TP-A1 至 TP-A11、TP-B0 至 TP-B5、TP-C1 至 TP-C3、TP-D1 至 TP-D4、TP-X1 至 TP-X3。不得添加产品语义、替换已接受风险或扩大验证环境。最终验收分为两部分：全部非拓扑场景在单机双屏真机与 mobile 虚拟机上完成；拓扑场景在两台单机单屏 laptop 虚拟机上完成。开发期其他设备不替代最终验证。

本计划把阶段落实为五个实施 CP：CP-0 新鲜基线/冻结；CP-A 检测器与高价值修复；CP-B UI 正确性；CP-C 原生正确性；CP-D 测试迁移、TS 门与格式化；最后是同一批次的非拓扑 Web→双屏真机/mobile 动态验证、拓扑 JVM→两台 laptop VM 验收及整批交付。拓扑 VM run 同时占用两台 laptop VM，禁止与任一其他受管运行并行。CP 名称只用于执行排序，不是独立交付单元。

整批完成必须同时满足：TP-A1..TP-D4、TP-X1..TP-X3 全有当前字节证据；每 CP 三维对账均 `MATCHED`；全批测试前整体三维对账 `MATCHED`；非拓扑 Web 场景先于双屏真机/mobile 对应场景并基于同一源码字节；拓扑 JVM 真 socket 判据先闭合，再在两台 laptop VM 完成拓扑场景；四台最终目标设备上的所有适用场景已观察，条件不具备的按 v3.4 状态说明；全部新增/修改文件逐代码对详设 `MATCHED`；fresh 独立 `REVIEW_TARGET=IMPLEMENTATION` 与最终 Claude 全范围评审完成。任何未闭项只能如实报 OPEN/实施未就绪，不得降级为未测即完成。

## 2. 执行纪律与安装协议

### 2.1 每 CP 的固定节奏

1. 重开该 CP 对应的需求原文、详设段落、六维 memory 路由命中的全部规范，以及 owning source；比对并冻结本 CP 文件清单、当前字节摘要、focused proof 和红变异分母。
2. 主 agent 逐点写入前后双读并运行 focused proof。仅主 agent 写文件；子 agent 只做只读审查/对账。
3. CP 内工作完成后、开始下一 CP 前，由 fresh 独立子 agent 对完整 CP 做需求＋详设/IA＋项目记忆三维证伪对账；有 OPEN 先由主 agent 根因修复，再由另一 fresh reviewer 复核同一 CP。
4. 所有 CP 完成后、整体测试前，再作一次全批三维对账；它不是 CP 结论汇总。
5. 整体静态、focused、typecheck、format 与各 package 测试闭合后，才进入唯一最终证据阶段。此前 CP 可运行 focused、静态与 JVM 测试，不得执行正式 Web/设备证据场景。最终阶段先完成所有适用非拓扑 Expo Web；随后在双屏真机与 mobile VM 上，对每个 App/设备组合第一次安装最终源码字节时必须先执行 W10 的 release 升级观测并确认旧 marker 保留、新 namespace 迁移成功。W10 完成前，这两台设备禁止安装任何最终字节 APK；W1–W9、W11 所需的 debug 或 release APK 安装都排在 W10 之后。TP-A11 改前 APK 建旧 namespace 是 CP-A/A6 授权的唯一预备安装，不是最终字节。之后用同一源码字节完成 W1–W9、W11 的双屏真机与 mobile VM 场景。拓扑只在 JVM TP-A7/A8/A9 通过后由两台 laptop VM 执行。设备运行同一时间只允许一个受管 run；拓扑 run 占用两台 laptop VM，不与非拓扑设备/Web 运行并行；运行期间不改源码；双屏真机/mobile 始终禁止清数据。
6. 同一失败族第二次出现，只冻结该失败族之后的推进；从首败日志定位 owning source，以同一 focused proof 关至零复发后继续，不等 Dexter。设备离线、虚拟机无法启动等硬前置缺失，或需要改变产品/Journey 的偏离，才停止并报告。
7. 每次动态状态均并列报告“当前字节上的最新运行”与“最后一次通过”；首败、恢复、business 与 cleanup 分开记录。静态/Focused/Web/Android/native/device/visual 证据不得互相升格。

### 2.2 资源、现场与锁文件

- CP-0 在会清理/覆盖的具体受管输出目录上做只读存在性与 owner 检查；不做全仓 ignored-file census。只清本批新建且 manifest 明确拥有的产物；不删除既有 `.runtime`、`build/`、keystore、APK 或其他历史用户现场。
- 每个受管运行前执行 `scripts/env/check-runtime-resource-budget <repo>/.runtime`。已有同一场景/源码字节的 run 不重复启动；只处理拥有身份可证明的进程树。

设备身份、AVD 输入、形态阈值与 role dispatch 的唯一规则见详设 §4；计划各动态阶段只调用该协议，不另设选择规则。serial 是运行时从设备 inventory 映射出的临时连接句柄，不固化任何编号。
- Yarn 为仓库解析到的 `yarn@4.17.0`。每个引入或改变 JS 依赖的 CP，先只改获准 manifest，再在仓库根运行 `yarn install`；保存安装前后 `yarn.lock`，逐 hunk 核对只包含该 CP 明确新增依赖及其解析闭包。差异若包含无关包、版本漂移或无法归因，停止该 CP，不接受锁文件；只在差异合规后执行 `yarn install --immutable`。不得通过删除锁文件或重生成全量锁来“修复”。本批依赖仅限 v3.4 授权的 `react-error-boundary@6.1.6`、RNTL v14 POC 解析的 `@testing-library/react-native@14.0.1` 与 `test-renderer@1.2.0`，及 TP-A4 明示的测试侧 `org.json`；不得以 TP-X1 扩大依赖范围。
- Android/Gradle 修改不触碰 Gradle wrapper、生产依赖版本、签名配置或 `applicationId`，除非 v3.4 明确授权；锁文件门也比较 `gradle/libs.versions.toml`、各 `build.gradle` 与 resolution 输出的实际差异。
- TP-D3 格式化开始前，先确认 TER 无其他在途写入；格式化分母仅含已跟踪、且本批计划触及的 TER 文件，不包含未跟踪的用户文件。格式化 red mutation 只在干净临时副本上执行，不在工作区原文件注入后回滚。

## 3. CP-0：新鲜基线、影响面分母与归档/设备准入

### 3.1 执行顺序与命令

1. 先完成 §2.2 只读产物盘点，生成本批 run/baseline 清单；读取现有受管运行的 manifest 与进程身份，只判定占用，不停止陌生进程。
2. 从仓库根先后运行并完整保存 stdout/stderr、exit code、时间、源码 SHA：
   - `yarn --cwd apps/terminal verify:static`
   - `yarn --cwd apps/terminal typecheck`
   - `yarn --cwd apps/terminal test`
   - `scripts/check/handoff-debt`
   - `scripts/check/project-memory`
   - 逐个读取 29 个当前 package 的 `package.json`、`terminal-invariants.json`、Vitest 配置、native Gradle test source set 与 test report 位置；不在 CP-0 运行安装/build/device。
   - 原始门输出与路径分母统一落在 `doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/cp-0/`，当前实际文件包括 `yarn-verify-static.log`、`yarn-typecheck.log`、`yarn-test-first-failure.log`、`handoff-debt.log`、`project-memory.log` 及各 `*-paths.txt` census。缓存命中必须原样记录，不能称为当前字节重新编译。
3. 基线判定以“测试标识＋首个失败特征”为键，冻结失败清单。既有材料提到 wallpaper-console 的 800/720 差异只作待核输入；本轮 fresh run 若仍出现，按测试标识与首个失败特征记录为基线失败，不改产品尺寸，也不构成等待 Dexter 裁决的前置条件；若消失或变化，按当前字节报告实际结果。
4. 按 AST/import 与 `rg` 现取实施分母：RNTL imports 与 renderer `.d.ts`、Vitest configs、`*.dev.test.*`、带测试源集的 Kotlin modules/测试类与 `@Test` 方法、全部 TextInput consumer、全部 `__DEV__` 分支、vendor 候选、color-key consumers、N finding owner。保存命令与计数；不为每个分母单独冻结摘要或绝对测试数。
5. 所有设备身份与 serial 均在实际使用阶段现取。按详设 §4 的唯一协议，topology run 每次显式提供本轮期望 `master-avd-name`、`slave-avd-name`，由当前 AVD inventory 映射 serial 并判定 laptop 形态；双屏/mobile 目标也按当前物理/AVD 身份与实时形态唯一分类。serial 只写本次 run manifest。CP-0 只用授权 adb 只读查询确认目标类别与 runner 参数形态，不安装/启动/清数据，CP-0 的 serial 不供后续运行复用。
6. TP-A11 的 CP-0 准备只确认双屏真机/mobile 的受管入口与 APK 输出位置，不构建、不安装、不清数据。CP-A 的 A6 在任何 persist-kv 改动之前重新发现并确认两台目标设备，再由受管 build 生成两 App 改前 APK 并留存源码/APK 摘要；两台设备对两个 App `adb install -r` 覆盖安装且不清数据，启动后由 App 自身脱敏日志确认旧 namespace marker 已建立，日志必须匹配 `event=persist-kv operation=<operation> mode=protected status=<status>`。之后两台设备锁定，不安装中间 APK，直到最终 TP-A11 观察；缺任一前置则 TP-A11 为 OPEN。
7. D1 POC 状态按详设 §2.1 记为 API 可行性 `PASS`：RNTL 14.0.1、`test-renderer@1.2.0`、Vitest 4.1.10 与 TER RN stub 下 4/4 focused 通过；临时测试文件、node_modules 与独立缓存已移除。已跟踪 `.yarn/install-state.gz` 仍处于 modified，来源/归属未确认，cleanup 记 `OPEN` 且不回滚用户文件。依赖在阶段 A 正式引入；v14 setup/lifecycle 按详设 §2.1 与 POC 结构，不启用全局 globals。POC 不等于正式 lock resolution 或迁移完成。

### 3.2 CP-0 冻结物和判定

CP-0 输出：新鲜失败基线、必要影响面分母及生成命令、受影响设备 runner 能力表、设备身份/形态读取方式、依赖解析事实、TP-A11 迁移前置方案与 POC 清理确认。只检查本批将使用的受管输出目录及其 owner，不盘点全仓 ignored 产物或逐分母哈希。任何目标设备身份不唯一或 runner 不接受动态 serial，都记最终动态阶段 OPEN；CP-0 仍可完成静态工作。

## 4. CP-A：裁决/检测器与高价值修复（阶段 A）

### 4.1 完整改动面（由 CP-0 分母具体化后锁定）

- 裁决登记：`doc/decisions/2026-09-28-ter-third-party-usage-remediation.md`（文件名以 CP-A 创建前路径冲突检查为准）；`HANDOFF.md` TER 表及引言；`project-memory/decisions/terminal-architecture-and-stack-rulings.md` T-3 指针；`project-memory/decisions/terminal-build-order-and-batches.md` 路径修正。保留 HANDOFF 十项正本表与其 approved list 不变。
- Lint：仓根 `eslint.config.mjs`、`apps/terminal/package.json`、参与的 package manifests/invariants 与 lint fixtures。执行包集合由 `expectedTaskOwners('lint')` 与 Turbo dry-run 核对；每包 lint 输出的实际检查文件数必须 >0 且等于该包按 eslint config 解析出的生产源文件分母。红夹具写在 lint 实际覆盖的 production source copy，不能写在被忽略的 test source。frontend/foundation `--print-config` 基线在 CP-0 先取。
- CP-0 baseline oracle repair：将两个 integration 包中明确断言 laptop 逻辑画布的过期 `height: 800` 同步为各自 `package.json` 的 `height: 720`，并同步 wallpaper-console README；不改表示设备物理/逻辑显示事实的测试夹具。以 owning tests 证明通过，然后冻结该 failure family 的首次失败、恢复结果和当前字节。
- Kotlin runner/test：`apps/terminal/application/base/android/android/src/test/.../TerminalTopologyServerTest.kt`、3 个模块的 Gradle test 配置与源集、`tools/terminal-android-dual-screen/check-behavior.mjs` 及其 test/调用者、TER verify orchestration/tests 和 `run-owned-tests.mjs`（仅必要处）。现有 in-place mutator 改为临时副本执行或删除且所有引用同步移除；绝不让测试直接改写 checkout 的生产源。
- DEV 分支：CP-0 枚举出的 `.dev.test.*` 源及其实际所属 Vitest config。每个 package 仍只经 `run-owned-tests.mjs` 这个唯一入口；入口新增顺序执行的 `--dev-matrix`，对四个 `.dev.test.*` 文件分别用 compile-time `__DEV__=false` 与 `true` 两个 Vitest project/config 运行，输出分别带 DEV/PROD 标识，不并行、不通过运行时改全局变量模拟编译常量。`tools/terminal-shared/run-dev-branch-red-fixtures.mjs` 在独立临时 package 副本反转每个有生产 `__DEV__` 守卫的条件，并由对应原测试判红；无 `__DEV__` 分支的 input measurement 文件仍在两态运行。原 PROD 断言保留且继续执行。CP-0 只冻结当时真实配置与文件分母，不硬编码配置数量。
- Theme registry：`ui/base/primitives` 新增 CJS public config subpath `semantic-color-keys.cjs` 为下层键正本；application 的 `createTailwindConfig` factory 与两个 integration configs 是三个映射 owner，两个 App 的配置 wrapper 继续调用该 factory。两个 integration 直接依赖 primitives；仅为构建期读取配置的 `application-base-android` 与 `sample-console` 将 primitives 登记为直接 `devDependency`，并同步 `src/dependencies.ts` 的 `devDependencyModuleNames` 与 `apps/terminal/skeleton-graph.ts` 的 `devDependencies`，不增加运行时依赖边。两个 App + 两 integration 四份输出都要重载并校验；`global.css` 继续拥有颜色值。`tools/terminal-shared/check-semantic-color-registry.mjs` 冻结 57 键、核验三个 owner/CSS/content，并在临时副本单键变异判红；focused tests 比较三个 owner 导出与四份实际配置的完整 key/value 集。
- Topology: `kernel/base/contracts/topology-transport.config.json`、`application/base/android` registry/server/module/Gradle/tests、`kernel/base/transport` 解压与配置 owner/tests，及 README/invariants。按需求修读超时、有界解压、锁外发送/关闭/发布与原因码，不替换 NanoHTTPD。拓扑 runner 作为受管 run 登记进程/PID start token、资源预算、互斥、APK hash 与源码摘要；每轮显式提供本次 master/slave AVD 名，由实时 inventory 唯一映射 serial 并按 laptop 形态阈值准入。stage-1 仅在获准的两台 laptop topology VM 上保留一次 `pm clear`，双屏真机/mobile 不清数据。新增仅 sample-terminal opt-in `runMemberJourney`、18 个 Journey 标签及生命周期/窗口首尾聚合诊断；不复用 stage-2 `dual` Virtual Display 形态门。
- React resolution + renderer dependency: 两 Android app `app.json`、Metro/package manifests、resolution/static checks/tests；RNTL v14 + 对应 renderer peer 在阶段 A 按锁文件协议引入，CP-D 再迁移全部测试消费点。明确 single React path and module identity。
- Persist key: adapter persist-kv native/config/runtime owners and tests, app integration wiring/tests. TP-A11 开始前按 §3.1 第 6 步构建/安装改前 APK并确认日志 `event=persist-kv operation=<operation> mode=protected status=<status>` 对应的旧 marker；两台设备锁定不装中间构建，直到最终升级观察。版本化新 namespace、旧 marker 保留，具体比较见详设 §6.2 CP 专项行 6。

### 4.2 CP-A 工单顺序与门

| 子步骤 | 需求/能力与实现形态 | 可失败验证 | 完成门 |
|---|---|---|---|
| A0 基线 oracle | 仅把 CP-0 已冻结的两个 wallpaper-console 测试高度期望从 800 改为 owning landscape surface 的 720，不改产品配置 | 先运行两个指定 focused tests；两项都 PASS；其余 failure family 未再次运行 | CP-0 失败族关闭，最后一次通过写入 CP 记录 |
| A1 裁决 | TP-A1 原话/选项/影响范围写入单一 decision；HANDOFF TER 表用七列；T-3 与失效路径各按需求仅改指定 memory | `scripts/check/handoff-debt`、`scripts/check/project-memory` PASS；十项表行数/approved 原文不变 | 满足 TP-A1；文件清单逐项相符 |
| A2 eslint 接线 | ESLint 9.39.5 bulk suppressions；TER-only config 与 `expectedTaskOwners` | 每包实际 files>0 且 = resolved production-source denominator；copy-based red fixture 放入 linted production source，验证具体 lint rule；frontend/foundation print-config 不变 | `apps/terminal verify` 中明确执行 lint，不以 Turbo dry-run 代执行；lint 实测耗时写入 run report，静态总门保持分钟级 |
| A3 Kotlin runner | JUnit 4.13.2 与 `org.json` 仅 test scope；逐 module `./gradlew :<module>:testDebugUnitTest --no-daemon --console=plain` | 修正 moduleName fixture；每个带 `@Test` 类有 XML；source `@Test` 动态发现数=executed+skipped，skip/failure/error=0；copy-based compile-fail 与 assertion-fail 两红夹具；A9 deterministic race 每次独立 JVM | shell task 挂进 `apps/terminal verify` 的 owned gate；记录每模块首次和最终实测耗时；`check-behavior.mjs` 不在 checkout 改源 |
| A4 DEV branch & colors | TP-A5 每个 `*.dev.test.*` 中的 DEV/PROD 分支分别进入唯一 run-owned test entry；TP-A6 shared registry | `run-owned-tests.mjs --dev-matrix` 顺序执行两个 compile-time modes；`run-dev-branch-red-fixtures.mjs` 对生产守卫做隔离副本反转。`check-semantic-color-registry.mjs` 冻结 57 键并检查 CSS/content，单键副本变异判红；application factory 与两个 integration 三个 owner maps、两个 App wrappers 与两 integration 四份输出均逐键断言 | DEV/PROD 原有断言与反变异后各自恢复 PASS；正本、三个 owners、四份输出与 CSS gates PASS |
| A5 topology / compression / lock | TP-A7 timeout、A8 1024-byte push 上限、A9 锁外 I/O 与原因表 | 生产 Registry + `java.net.Socket`；read timeout ∈ `[heartbeatTimeoutMs, heartbeatTimeoutMs + heartbeatIntervalMs)`，`interval+ε` 必红；心跳存活对端每 `0.9 × heartbeatTimeoutMs` 发 control Pong（不是 text 帧），另设完全静默 half-open；20 次连接循环至少 5 次 half-open；线程基线在 Registry 运行首轮前与末轮后、stop 前采集。A8 全量一次 push 变异红。A9 在 registry/server 锁等待边界安装 test-only 同步钩子，先在未修复字节上各以独立 JVM 有界判红 10 次，再修复；test scope 引入 `org.json` 以真实构造 rejection frame | 三项 JVM gate 与单项实测耗时记录；A7/A8/A9 全 PASS 后才启动两台 topology laptop VM；TP-A9 原因表逐行断言 |
| A6 React + persist-key | TP-A10 `experiments.autolinkingModuleResolution=true`、解析版 `@expo/cli` 依据与 RN 桩入口 hook 静态守卫；TP-A11 key derivation + namespace version | TP-A10 AST gate 变异 RN 桩入口加入 hook 后对具体 gate 判红；A11 的旧 APK build/install/marker 前置先于任一 persist-kv 改动，完成后禁止向双屏真机/mobile 安装中间 APK；最终观察开始先断言新 namespace 尚不存在 | A10 config/AST negative fixtures PASS；A11 旧 marker 存在、新 namespace 初始不存在、迁移后可用且无 mismatch |

CP-A 每完成一个会改 JS manifest 的安装点，执行 §2.2 的普通安装→精确锁差异→immutable；安装前只对相关受管输出目录做只读 owner/存在性检查。随后本 CP 所有 focused tests、静态门与 fresh 三维对账 MATCHED 才进入 CP-B。依赖安装只能在本批取得实施授权后进行；未获授权前本计划不执行任何 CP。

## 5. CP-B：UI 正确性与两端一致（阶段 B，UI_BEARING）

### 5.1 完整改动面

`ui/base/primitives/src/vendor/` 六文件逐字上游归属核对与迁出自写文件；`ui/base/render` 的 ScreenContainer、ScreenReadyBoundary、LayerStack、SystemFailureNotice、SurfaceRoot 与 tests；`ui/base/input` InputProvider/focus controller/InputSurfaceFrame/InputScrollArea 与其 tests；`ui/base/admin-shell` AdminLauncher 与 tests；`ui/base/feature`/input contracts；`ui/feature/sample-staff-auth`、`sample-member-desk` 所有 CP-0 census 命中的输入 consumer；两 integration 的 assembly/part registration/README/tests；两个 App 的 debug harness 仅当 CP-0 证明为实际 consumer。使用阶段 A 已引入的 `react-error-boundary@6.1.6` 与 RNTL v14；新增组件测试使用 `tools/terminal-shared/rntl-vitest-setup.ts`：顶层设置 `globalThis.expect=expect` 与 `IS_REACT_ACT_ENVIRONMENT=true`，`beforeAll` 重设 act 标志、`afterEach` 动态导入 RNTL 并调用 `cleanup()`、`afterAll` 恢复 act 环境；删除 cleanup 后跨用例残留测试必须判红。

### 5.2 TP-B0 至 B5 与验证

- **B0 vendor**：比对上游所用版本逐字来源；只有完全原样的 vendor 内容留在 vendor；所有 TER 改写内容搬到 owning component/foundation。验证每个受影响 import 的包内/跨包消费者、公共导出与包图；README 同步原有不变量“RN `TextInput` value API 只经唯一 slot 接触”，并指向迁移后的 owning slot；旧 vendor 路径残留为红。
- **B1 boundaries**：逐个真实 `ScreenContainer` screen 与 `LayerStack` layer 按 §3a 清单设置 boundary，唯一 fallback 是现有 `SystemFailureNotice` 与唯一“知道了”按钮。按钮发出 command→actor→`appControl.resetRuntime`，重启 JS 而非原生；不做局部重挂，不新增“重试”控件。首屏失败由 startup readiness 报 `contentFailure` 并释放 startup overlay，但 `primaryRealReady=false`。surface outer boundary 包住 SurfaceRoot 内容子树，AdminLauncher 留在其外可用；Web 若没有 resetRuntime port，则保留 notice、记录不可用而不伪装成功。debug 注入只由受管 debug build 载入，正式 release 构建无注入；打包产物反向检查确保剔除。
- **B2 render purity**：对 F-5/N-1/N-2/N-4/N-5 和 TP 触及的每个 ref/effect/log/resource census 做最小根因修复。现有 `react-hooks/refs`, `purity`, `rules-of-hooks`, `exhaustive-deps`, `no-floating-promises` 为 owner; `StrictMode` render double-invoke、true unmount/remount、cleanup 次数、日志脱敏做 focused proof。行为规则的 `ui/*`、`kernel/*` lint 清零。
- **B3 layer/input**：通过现有 `notifyFocusBoundary`/input owner seam；覆盖 pointer、hardware Tab、scanner suffix、长按/关闭 layer、被遮挡字段输入、native focused node 与 owner identity。被覆盖字段不得值变；关闭后 owner 与 native focus 均清空；不加 focus trap/accessibility modal、关层不恢复旧焦点。真实生产消费者全量来自 CP-0。
- **B4 AdminLauncher**：复用实测 layout/measure owner；viewport、host scale、祖先位移变更后触发几何刷新；当前真实坐标一次手势触发一次入口，未刷新几何的反例必须失败。不开新 admin flow。
- **B5 TextInput long press**：只在共享 `PrimitiveInput`/`PrimitiveCodeInput` 的 RN slot 对所有消费者阻止系统 selection/paste menu，保留其它 paste paths。按 resolved RN `0.86.3` 与 RNW `0.21.2` 实际能力；真机 UI/window dump 逐路径证明无浮窗，Web 只报告可验证差异，不把属性静态存在算通过。B0 完成后方可改该 slot。

### 5.3 CP-B 验证门

CP-B 只做 focused tests、typecheck、lint 与 CP 三维对账，不运行正式 Web/设备场景。全部生产字节在 CP-D 与全批三维对账冻结后，才进入计划 §8 的单一最终证据阶段。CP-B 不以截图存在性通过：每项 focused proof 必须断言控件/owner 状态。行为 lint 在 `ui/*` 与 `kernel/*` 清零并移除相应 package-rule suppression 条目。

## 6. CP-C：Android/native 正确性（阶段 C）

### 6.1 文件与步骤范围

- TP-C1：`application/base/android` native loading module/registry and tests; app native activity/bridge call-sites only when census ties them to beginHide/releaseHide; Gradle module config, README and scoped native lifecycle tests.
- TP-C2：两个 Android app `MainActivity.kt` and Expo splash resolution/API consumer, `application/base/android` capability bridge, startup diagnostics tests/README. 只保留共享 helper 内一处 `SplashScreenManager.preventAutoHideCalled` 未文档成员引用，并在 owning README 的迭代节登记升级复核；禁止 Activity 初始化时调用未文档的 `SplashScreenManager.hide()`，因为它会提前释放 Expo 启动画面。仅在 `NativeLoadingCapability.hideOnce` 已释放 Activity-owned gate 后调用公开的 `SplashScreen.hide()`；focused 检查要求该调用顺序且对重新加入 native `hide()` 的单点变异判红。JS 注释写明实际语义，不引入 fallback。
- TP-C3：`adapter/android/dual-screen` display handler/module/tests and app activity/display consumers, plus package README/Gradle. Filter presentation category, maintain existing surface creation lifecycle, secondary real display proof on physical dual-screen device. In CP-C also update `scripts/test/ter-virtual-keyboard-android.mjs` shape admission to recognize a real physical presentation secondary without requiring a SurfaceFlinger `Virtual Display`, and add the managed debug build variant required for TR-08 failure injection. Runner focused tests cover both accepted shapes: emulator dual with its declared virtual display and physical dual with two physical displays; release remains injection-free.
- Stage C lint files: all CP-0 inventoried `adapter/*` and `application/*` TS packages affected by the runtime lint set, and their package suppressions. Cross-platform project behavior stays unchanged.

### 6.2 Validation/phase gate

Run only CP-0-enumerated per-module unit tasks, Gradle XML/source-report integrity, source focused tests and typecheck in CP-C. Native main-thread tests prove no blocking wait on JS thread; a controlled over-budget callback yields typed code `TERMINAL_NATIVE_LOADING_MAIN_THREAD_TIMEOUT` from the `application/base/android` Expo module boundary and a sanitized structured diagnostic with `operation`, `failureCode`, `timeoutMs`, and `elapsedMs`. Lifecycle tests cover callback delivery and reload/owner destruction. Device cold-start ordering (display selection→JS start→PRIMARY real part first layout→startup hide), `contentFailure` without real-ready, both physical display IDs/categories and part/surface association, and mobile lifecycle are final-stage device observations only; CP-C does not start a device run. Before the final device phase, same UI-bearing/non-adapter Web rows must PASS on the same source SHA per TR-16.

阶段 C lint clear: `adapter/*` and `application/*` behavioral rules; remove each cleared file×rule suppression entry. CP-C full focused/static proof and fresh tri-dimensional MATCHED precede CP-D.

## 7. CP-D：测试渲染器、TS 门、格式化与 lint 收尾（阶段 D）

- **D1 React Native Testing Library**: v14 POC already `PASS`; exact RNTL `14.0.1` + `test-renderer@1.2.0` dependency pair is formally introduced in CP-A under the lock protocol, before CP-B component tests consume it. CP-D uses the frozen current-source denominator in `doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/cp-d/cp-d-renderer-denominator-20260929.md`: all 31 renderer-importing files, all 10 hand-written renderer declarations, and all 10 owning package manifests. CP-0 originally had 29 importing files; CP-B added `adminLayerFrameLifecycle.test.tsx` and `adminSectionBinding.test.tsx`, so the CP-D denominator expands by two and contains no baseline removals. The shared setup at `tools/terminal-shared/rntl-vitest-setup.ts` runs before test modules in all 10 packages with the POC-proven minimum: top-level `globalThis.expect=expect` and `IS_REACT_ACT_ENVIRONMENT=true`; `beforeAll` reasserts the act flag; `afterEach(async () => (await import('@testing-library/react-native')).cleanup())`; `afterAll` restores the prior act flag. Keep Vitest `globals=false`. A focused two-case residue test must pass with setup and fail under the single mutation removing cleanup. Preserve each file’s assertions/test count and user-facing queries. Replace `createNodeMock` with an injected fake component/module boundary; `UNSAFE_root` with render-result public queries/container; `update` with `rerender`. Use v14 async `render`/`fireEvent`/`act`, public render-result query APIs and `rerender`. Delete hand-written renderer `.d.ts` only after imports and typecheck pass. TER `react-test-renderer` imports and manifest dependency declarations must be zero; `test-renderer` remains only the v14 peer as required. If resolution differs from POC or requires React/RN override, stop; do not keep both APIs.
- **D2 TypeScript Compiler API**: update `tools/terminal-shared/typescript-analysis.mjs` to supported resolved TS 6.0.3 API, remove `baseUrl`, consume diagnostics and use package resolution; prove with syntactically malformed fixture → named check fails with concrete diagnostic and correct exit code. Test that no `parseDiagnostics` private API references remain.
- **D3 formatter**: first confirm TER has no other in-flight writes. Use only tracked, in-scope files already frozen by CP-0; do not include untracked user files. With Prettier 3.9.6, record pre-format AST/format baseline, format only explicit TER paths, and compare AST-equivalence. Run red mutation on a disposable copy, never in the checkout. After formatting, rerun TER static/typecheck/tests; format check must be wired into the routine TER entry. Record actual elapsed time for the formatter command.
- **D4 lint zero**: clear behavior-neutral rules in all TER packages; per package×rule suppression set empty, then delete bulk suppression file. At end the TER suppression file is absent/empty, no line disables without reason, and every package in the freshly resolved lint task set has run. Verify exact Turbo task set and negative controls.

### 7.2 执行耗时记录（入口固定，数值以实施实测为准）

以下四项在实施报告中分别记录命令/受管入口、开始与结束时间、`elapsed_ms`、退出码和业务结果；不得用配置值或预计时长代替实测：

| 项 | 固定入口 | 计时与报告字段 |
|---|---|---|
| TER lint | `yarn --cwd apps/terminal lint`，由 `expectedTaskOwners('lint')` 覆盖的实际 package tasks | 总耗时及逐 package 耗时；每包文件数同时满足 >0 且等于生产源分母 |
| TER format | CP-D 新增的 `yarn --cwd apps/terminal format:check`，对 CP-0 冻结的 tracked/in-scope 清单执行 Prettier 3.9.6；不得纳入未跟踪文件 | 全命令 `elapsed_ms`；记录文件分母与退出码 |
| 原生单测 | CP-0 确认的三个 Kotlin source-set 对应 `testDebugUnitTest` owned tasks，通过 `apps/terminal verify` 的受管单测入口逐模块顺序执行 | 每模块分别记录 Gradle task、JUnit XML 路径、source/report 测试数、`elapsed_ms` 与退出码 |
| TP-A7 90 秒长窗口 | JVM production-Registry 真 socket test；最终拓扑另由 T2 双机场景复验 | JVM 和 VM 分开记录 `started_monotonic_ms`、`ended_monotonic_ms`、`elapsed_ms`、实际 `heartbeatTimeoutMs` 与窗口长度；VM 窗口不得少于 `3×timeout`（生产配置至少 90,000ms） |

### 7.1 dependency/lock gate for D1

POC is complete and Dexter authorized implementation; this is the CP-A installation gate, not a pending design-review gate. Add exact `@testing-library/react-native@14.0.1` and `test-renderer@1.2.0` to the owning test manifest; run root `yarn install`, inspect only the attributable lock hunk and peer graph, confirm resolved React/RN stay 19.2.3/0.86.3, then run `yarn install --immutable`. Keep RNTL as the direct test dependency; `test-renderer` is present only as the declared peer needed by RNTL, not a TER test import/API. The shared setup at `tools/terminal-shared/rntl-vitest-setup.ts` runs before test modules: top-level `globalThis.expect=expect` and `IS_REACT_ACT_ENVIRONMENT=true`; `beforeAll` reasserts the act flag; `afterEach` dynamically imports RNTL and calls `cleanup()`; `afterAll` restores the prior act flag. Keep Vitest `globals=false`. The focused cross-case residue test must fail when the cleanup hook is removed. No peer override, forced resolution, framework upgrade, or vendoring.

## 8. Dynamic verification plan (TR-16; not run in this design phase)

### 8.1 Scene denominator and Web→device sequence

Non-topology scenario manifest is frozen after all CPs and before first Expo Web run, with one row per scene and exact production consumer/testID, precondition, action, expected visible/state oracle, evidence file, SHA-256, run ID. It includes the v3.4-approved outcomes below; CP-0 consumer census expands, never contracts, the applicable rows. Every applicable non-topology row is observed on both final device targets (dual-screen physical and mobile VM), not just one convenient target:

| Scene | Requirement surface | Web integration / device app | Device & display | Managed entry / build | Injection or key action | Primary observable |
|---|---|---|---|---|---|---|
| W1 | TP-A6 semantic colors; TP-B1 recovery; TP-B4 geometry | `sample-console` → `sample-terminal` | dual-screen physical PRIMARY + SECONDARY; mobile | `ter-virtual-keyboard-android.mjs`; final release for production behavior, debug variant only for injected error | debug-only screen/layer failure injection; tap “知道了”; separately change viewport/host scale and execute launcher gesture at current position | semantic keys/colors; sole notice/button; JS reset result; persistent error leaves AdminLauncher reachable; geometry-triggered gesture fires once |
| W2 | TP-B3 overlay input ownership | `sample-console` → `sample-terminal` | dual-screen physical PRIMARY; mobile | managed Android runner; debug where controlled input injection is needed | ADB text input into covered StaffLogin name/passcode; send Tab, Shift-down/Tab/Shift-up, Enter suffix; write into overlay host-address field as positive control | covered values unchanged; overlay field value changes; logical owner equals native focused node; close clears both |
| W3 | TP-A6; TP-B1/B3/B5 wallpaper consumers | `sample-wallpaper-console` → `sample-wallpaper-terminal` | dual-screen physical PRIMARY + SECONDARY; mobile | managed Android runner, same release/debug rule as W1/W2 | only scenario-owned TR-08 injection; same input/long-press actions where a production consumer exists | second integration’s actual color, boundary, focus and TextInput behavior; no assumed consumer where absent |
| W4 | TP-B1 all listed screen/layer boundaries | both integrations → corresponding app | each real mounted PRIMARY and SECONDARY consumer | managed debug build; release for persistent-entry behavior | inject one listed screen or layer failure; tap its only “知道了” button; keep failure active while opening AdminLauncher | unique notice; command→actor→`resetRuntime`; JS restarted, native process retained; unaffected sibling regions stay mounted; admin entry remains operable |
| W5 | TP-B1 startup `contentFailure` and outer boundary | both integrations → both apps | PRIMARY and SECONDARY only where the listed screen is mounted; dual physical + mobile | managed debug build injection, plus release cold-start for normal readiness | fail first real screen render and separately a surface-owned child outside screen/layer; observe startup and outer notice | `contentFailure`, loading released, `primaryRealReady=false`; outer errors use same notice/reset action; AdminLauncher outside outer boundary remains available |
| W6 | TP-B4 AdminLauncher scaled/moved geometry | `sample-console` → `sample-terminal` | physical PRIMARY and mobile display 0; SECONDARY only if launcher consumer is mounted | existing managed admin-display runner; release | use standard launcher gesture after host scale/viewport/ancestor position change; run stale-geometry negative control in focused/Web harness | refreshed geometry produces one entrance; stale geometry action rejected; no duplicate open |
| W7 | TP-B5 seven TextInput paths from §5 | both integrations → both apps, only production-reachable paths | dual-screen physical + mobile; record each unavailable consumer as not covered with path proof | two Expo Web integration entries, then managed Android runner; release | ensure OS clipboard non-empty; for each of seven paths test empty and existing-text states; long-press each field | no selection/paste system menu on Android `ReactEditText`; values and actions unchanged; Web behavior reported separately against RNW |
| W8 | TP-C3 physical presentation-display selection | Web N/A: adapter-only native display fact | dual-screen physical, PRIMARY and actual presentation SECONDARY | managed admin-display entry with newly admitted physical-dual shape; release | no UI injection; enumerate physical display IDs/categories and launch app on each | selected secondary is a real presentation display; distinct secondary part renders on the physical external screen |
| W9 | TP-C1/C2 lifecycle and splash | both integrations → both apps | dual-screen physical (both displays) + mobile | managed release cold start and managed debug failure case | observe lifecycle; for C2 call `resetRuntime` and record JS reload/splash ordering | native callback does not block JS; readiness precedes hide; `contentFailure` releases loading without real-ready; resetRuntime timing is ordered and bounded |
| W10 | TP-A11 protected-key compatibility | Web N/A: native storage owner | dual-screen physical + mobile; each of both Apps | managed pre-change APK preparation and final release upgrade, same device remains build-frozen between | For each of the four App×device pairings, the first installation of any final-source APK is the W10 release upgrade. Before it, establish old marker before any key change and assert new namespace absent; install only that final release APK. Complete W10 for both Apps on both devices before any W1–W9 or W11 final-byte debug/release APK is installed on either device | old namespace marker remains; new namespace is initially absent then usable; no mismatch; no app-data clear |
| W11 | TR-17 input/virtual-keyboard regression | each integration → only its CP-0-confirmed production consumers | dual-screen physical PRIMARY/SECONDARY where mounted + mobile | Expo Web first per consumer, then managed Android entry; release except separately scoped debug-only failure injection | reach each production `full`/`alpha`/`numeric`/`financial` layout that has a consumer; tap the visible key bounds from the UI hierarchy to test focus, insertion/label-value, applicable Shift and `full` URL layer (`: / . ? & = - _ % +`), next-field/handoff, dismissal and scroll/visibility; do not substitute `adb input text` for virtual-key delivery | input owner and native focus agree; key label equals inserted value; overlay and non-keyboard geometry remain correct; a missing production consumer is OPEN with its exact path/condition |

W8 and W10 are adapter/native-specific and may bypass Web proof only for those exact adapter facts; they do not excuse adjacent UI behavior from Web-first. W1–W7, W9 and W11 have a scene-specific Web entry in every integration that owns a production consumer; each exact Web scene must PASS before its device observation, with identical source digest. W8 physical display selection is the sole display-adapter exception. All W acceptance evidence runs only in the final evidence stage. W10's earlier old-namespace setup is a required migration precondition, not acceptance evidence. W10 is the first final-byte installation on both target devices: finish all four App×device release upgrades before installing any other final-byte build. Missing credentials/state/runner is `OPEN`, never “unreachable”.

### 8.1a Topology scene denominator (no Web substitution)

Topology final acceptance is a separate scenario set and runs only on **two single-display laptop VMs** after JVM TP-A7/A8/A9 proof. The sole identity, dynamic-serial, shape, AVD-name and role-dispatch protocol is in design §4. Each run requires the operator’s current explicit master/slave AVD-name inputs; no serial or AVD default is persisted. Ambiguous identity, shape mismatch or changed mapping fails closed.

| Scene | Source/requirement | Device action and oracle | Evidence |
|---|---|---|---|
| T1 | F-32, current stage-1 `pairDevices` | Run both `sample-terminal` and `sample-wallpaper-terminal` profiles; perform fresh single-screen shape checks, start host and pair master/slave; both sides read back `pair-state=已配对`, reachability `可达`, and opposite master/slave roles | per-device UI hierarchy, progress/event logs, screenshots, exact serials and run manifest |
| T2 | TP-A7 new two-machine acceptance | After first sync settles, each app profile enters an immediate UI-idle window of ≥`3 × heartbeatTimeoutMs`; production timeout 30,000ms means ≥90,000ms. Only automatic heartbeat is allowed; runner performs no UI/sync/recovery action. The JVM TP-A7 proof separately confirms control Pong throughout the equivalent production-configured window. VM evidence uses window start/end paired+reachable status and unchanged connection lifecycle, and confirms there was no non-heartbeat business action; do not add production frame counters or claim JS control-frame visibility. A reconnect, lifecycle change, or business action during the window fails. No raw payload/address/identity is logged | monotonic start/end, production config, dual-endpoint state/lifecycle snapshots and final UI readback |
| T3 | TP-A8 new two-machine acceptance + existing cross-device sync journey | On `sample-terminal`, execute current `runMemberJourney` with exact 18 labels listed in its function body. Static exact-set applies only to those 18 labels; runtime verifies each appears, not that the whole run has no other labels. The journey is Alice pending→slave restart→withdraw/cancel→no stale popup→Bob resubmit/confirmation→SECONDARY confirm→PRIMARY persistence/master cold restart. Both directions must transfer at least one state using `codec=zlib-base64` (read existing `state-full-transfer-planned` log); after receipt, each receiver’s state readback must match the sender. If production operations cannot create a qualifying state in either direction, record OPEN, no synthetic production claim. Runner opt-in only for sample-terminal; wallpaper/default unchanged | per-label UI trees and transfer codec/readback records in both directions; all 18 labels required |
| T4 | TP-A9 new two-machine acceptance | Trigger each origin in the TP-A9 table: role-occupied rejection, half-open/heartbeat timeout, host-stop, closePeer, unpair, remote close, and network loss. Both endpoints complete within bounded source timeout without hang; reason code equals the table, preferring local intent when present and valid peer reason only when no local intent exists | bounded timestamps, per-endpoint close/reason events, pair/reachability readback; each row cites the same source/JVM mapping |
| T5 | existing dual-device managed-entry regression | For both app profiles, run the full current `runProfile` sequence: `pairDevices` (host-occupant failure/retry, host restart, direct-pair failure/recovery, successful pair, opposite roles and role-occupancy rejection), `runDisconnectRecovery`, `runSlaveUnpairCoverage`, `rePairAfterSlaveUnpair`, and `runUnpairAndStop`; sample-terminal `runMemberJourney` is separately enumerated in T3. This function set is the denominator; CP-0 maps every existing `record.steps`/timeline entry to it and cannot remove a scenario | runner's per-step result and both devices' UI/event readbacks |

Run existing `tools/terminal-topology/run-dual-device.mjs` stage 1 through its managed wrapper with the current explicit master/slave AVD names; the wrapper passes the freshly resolved serials, `--app all`, a run-scoped `--output`, and `--include-member-journey`. It registers the process tree, checks budget/exclusivity, builds both target APKs, and binds APK SHA-256 to source digest. The opt-in enables only sample-terminal’s existing Journey. Stage-1 cold launch may `pm clear` only after §4 identity/shape admission and only on the two topology laptop VMs; one clear per app install sequence. A focused negative proves role admission happens before the clear command and rejects physical dual-screen/mobile roles. This permission does not extend to TP-A11 targets. Cleanup remains run-owned only. Do not use stage-2 `dual` for topology laptops or physical secondary-display hardware. T1–T5 are native adapter/topology scenes: no Web substitution, with JVM proofs as prerequisite rather than substitute.

`pairDevices` may also capture platform-ports/runtime pages as existing runner side effects. Those incidental frames are not non-topology acceptance evidence and do not reduce W-scene runs on the dual-screen physical device and mobile VM.

### 8.2 Runner/admission validation

At CP-0 final source census, statically verify `scripts/test/ter-virtual-keyboard-android.mjs`, `scripts/test/ter-admin-display-android.mjs` and `tools/terminal-topology/run-dual-device.mjs` serial handling, package/appId assumptions, clean-state checks, build artifacts, process ownership, logs, cleanup and display-to-surface reporting. A runner that does not cover a requirement must be fixed/extended within its owning test tool and tested without starting devices, or an exact replacement managed runner must be planned. No ad hoc install, manual app launch, unmanaged clear-data command, or unmanaged process; the single authorized managed `pm clear` is limited to the two admitted topology laptop VMs in §8.1a. Before any final acceptance-evidence run: CP-level and whole-batch three-dimensional reconciliations are MATCHED; §3a is complete; all corresponding non-topology Web rows passed on same source SHA before device; both non-topology serials and two topology laptop VMs' current identities/serials were read fresh and each managed entry is confirmed runnable for its assigned shape; resource budget PASS; no overlapping owned run; required old-namespace setup/readback for TP-A11; and no source edits during a held run. Topology VM run owns both laptop VMs and excludes all concurrent managed runs. Resource manifest includes process PID/start token, logs, build/install status, source digest, scenario identity, business status, device evidence and cleanup.

### 8.3 Dynamic device identity; serials are never frozen

Device identity, live-shape thresholds, explicit AVD-name inputs, master/slave dispatch and serial passing are defined once in §2.2 and reused here. Immediately before a dual-screen run, reread physical display IDs. Every VM recreation requires repeating that discovery; never use historical serial/AVD defaults. Stage-1 output must explicitly target `.runtime/ter-third-party-usage-remediation/<runId>/topology`.

The existing stage-1 `coldLaunch` `pm clear` is permitted only for the two topology laptop VMs after managed identity/shape admission, once per app install sequence. The role gate must fail closed before the command; a focused negative mutation proves it rejects physical dual-screen, mobile, and other roles without issuing a clear. It does not apply to TP-A11 targets and does not authorize clearing any other data. Cleanup stops only the manifest-owned process tree. Debug failure injection is compiled out of release/production artifacts per TR-08.

## 9. 静态/整体验证与 CP 复核命令

每个阶段的实际聚焦命令以冻结 package 集为准，并同时记录退出码与报告：

```bash
yarn --cwd apps/terminal verify:static
yarn --cwd apps/terminal typecheck
yarn --cwd apps/terminal test
yarn --cwd apps/terminal lint
scripts/check/handoff-debt
scripts/check/project-memory
```

`apps/terminal test` 的预期可能有当前基线 wallpaper-console 两项失败。它们只有在 CP 完成后同一基线测试 PASS，或经已批准语义修复及双端 evidence 后，才可关闭；不得从基线分母删除。`apps/terminal verify` 是其内置全量/动态入口，不能无条件用它替代 static;先由 `scripts/README.md` 和 terminal verify source 确认它会运行哪些资产/设备命令。只在它不触发未获准 DEV/L2/seed/reset/UAT/设备操作时才作为普通门。

红变异必须真实执行，首次失败输出与恢复后通过输出存档：

| 变异族 | 唯一变化 | 预期具体门/结果 |
|---|---|---|
| TP-A3 | 在 lint 覆盖的生产源临时副本中加入违反 hooks 顺序；另一次加入 render-time ref read | TER ESLint 的对应规则各自非零并指向生产源；丢弃临时副本后原字节 gate PASS |
| TP-A4 | moduleName 缺失、XML 测试执行数与源码 @Test 分母不等、一个 assertion mutation | Gradle gate 编译/结果汇总非零且指向真实 module/test；恢复后报告分母一致 |
| TP-A5 | 删除/反转其中一种 DEV guard/分支 | PROD/DEV 其中一态测试门失败，显示精确 test/branch；恢复双态 PASS |
| TP-A6 | App color registry 少键/新增非法 token | color key static gate 非零，明确指出 key；恢复后 PASS |
| TP-A7 | idle timeout 退化 | 生产配置 socket test 红；按 heartbeat-only 20 cycles、≥5 half-open 和规定 observation window 验证连接不被断开 |
| TP-A8 | bounded decompression max 移除 | 解压 limit test 对超上限输出红、上限内有效 fixture 通过；记录拒绝发生在受界输出构造前 |
| TP-A9 | lock order 反向；barrier lock race 反例 | 两锁顺序门与确定性并发 test 红；旧字节 barrier mutation 连续 10 次红，修复后调用终止且 close reason 正确 |
| TP-A10/A11 | React 路径复制；设备身份丢弃或 marker 变化 | Metro resolver equality / key migration test 精确失败；设备实测不能以 test 代替 |
| TP-B1/B3/B4/B5 | screen boundary 错包；covered-field value mutation；stale geometry; menu flag mutation | 对应 focused owner gate 红；Web/设备各按同场景核对 |
| TP-C1/C2/C3 | JS wait; splash hide early; non-presentation display selected | native tests/log order/display selection each fail with exact assertion |
| TP-D2 | malformed TS fixture / private parseDiagnostics reference | compiler checker exits nonzero with diagnostic; old private API is static-rejected |
| TP-D3/D4 | unformatted TER file / one suppression left | Prettier check / suppression empty gate red |

每个 finding 若需求指定修复前 red，必须在修改生产源之前执行一次；若基线不红，记录为测试缺陷并先补门。变异只在一次性临时副本中做，严格单项并保存首次红输出；丢弃副本后在未变更工作树上重跑同门确认 green，不在工作树原地反改恢复；不能把静态测试自身 expected error logging误记成 runner failure。

## 10. 项目记忆、README、依赖事实与 N 项闭合

- CP-A TP-A1 完成 decision 与 HANDOFF T-3 条目；项目记忆只修改 v3.4 指定的 T-3 状态与失效路径，不扩展到其他 memory。fresh `scripts/check/project-memory` 和 `scripts/check/handoff-debt` 必须通过。
- 每个改动包 README 按 TR-10 四节中文结构和迭代区更新。凡 N finding 指向所触文件，必须于 owning README 逐项登记该 report finding id，或给出已被 focused/static gate 防止回归的精确路径；没有逐条证据不能汇总“已清零”。
- TP-X1 建立包名、当前解析版本、实际 consumer、使用 API、官方同版本依据、稳定性/风险、验证位置的唯一登记；任何用法/默认值在官方资料缺失时用 resolved tag/source 与可复现实验补足。不得凭另一版本官方文档推断。TP-X1 至少覆盖 React/RN/RNW/Expo/splash/error-boundary/NanoHTTPD/NanoWSD/zlib/jszip or fflate/MMKV/TypeScript/ESLint/RNTL/Vitest/renderer/nativewind css interop 这些 CP 真实消费者；最终列表由 CP-0 源码扫描产生，不硬编码成仅举例的“全仓”。
- TP-X2 逐个触及包检查中文 README 定位/作用/结构/用法及迭代节；内容从真实导出与 owner 读取。
- TP-X3 N-1 至 N-37 各行都按详设 §11 处置，CP-0 标定所触文件；未触项只能按需求登记 README iteration，并附 health report id。任何新产生的 N 都归属 owner，不允许无所有者的泛化清单。

## 11. CP 顺序、逐 CP 交付件

| CP | 固定范围 | 必要证据 | 进入下一项前门 |
|---|---|---|---|
| CP-0 | 新鲜基线/库存/所有分母/serial/POC 状态 | 完整命令日志、当前字节摘要、受管目录 owner 检查、consumer/test/package 清单、失败 ID；注明设计期 RNTL v14 POC 4/4，临时测试工件已清，tracked install-state cleanup OPEN | 基线与分母 MATCHED；POC API 可行性 MATCHED，正式 lock resolution 留 CP-A |
| CP-A | TP-A1、TP-A3、TP-A4、TP-A5、TP-A6、TP-A7、TP-A8、TP-A9、TP-A10、TP-A11 | lint包集合、suppression表、JUnit XML、DEV双态、color/socket/decompress/lock/React/key gates、治理检查 | focused/static/owning docs PASS；CP fresh 3D MATCHED |
| CP-B | TP-B0、TP-B1、TP-B2、TP-B3、TP-B4、TP-B5 | vendor provenance、render purity、错误边界、input/focus、launcher、TextInput focused tests | 全部 focused/static PASS；CP fresh 3D MATCHED |
| CP-C | TP-C1、TP-C2、TP-C3 | native test XML、main-thread/log order、startup/real-ready/display id/category evidence | native focused PASS；CP fresh 3D MATCHED |
| CP-D | TP-D1、TP-D2、TP-D3、TP-D4、TP-X1、TP-X2、TP-X3 | renderer migration census、TS malformed fixture、format denominator/results、empty suppressions、package README/N map | all focused/static/package checks PASS; CP fresh 3D MATCHED |
| Whole batch pre-test | all four CPs | one fresh full requirements + detailed design/IA + project memory 3D report | all rows MATCHED; then full regression only |
| Dynamic & delivery | non-topology: approved Web list then dual-screen physical + mobile; topology: JVM TP-A7/A8/A9 then two laptop VMs | current source SHA, W/T scene reports, native logs, cleanup manifests, final code-design reconciliation | both acceptance halves and all applicable rows closed; every code line MATCHED; then implementation review |

CP 覆盖范围明确为 TP-A1、TP-A3 至 TP-A11、TP-B0 至 TP-B5、TP-C1 至 TP-C3、TP-D1 至 TP-D4、TP-X1 至 TP-X3。TP-A2 不存在于 v3.4；不推导或新增该编号下的工作。每条范围内 TP 均已映射到上表唯一的 CP。

## 12. 逐代码与详设对账（强制显式交付门）

在交 Dexter/Claude 之前，由 fresh 独立只读子 agent 从 CP-0 冻结的 changed-files list 自动生成完整文件/行/符号清单并人工逐行对账；主 agent 只负责提供当前字节和处置 `OPEN`，不得自评替代独立对账。范围包含所有新增/修改/删除的 TS/TSX/Kotlin/Gradle/JSON/config/runner/test/README/decision/HANDOFF/memory/lockfile/证据生成代码。reviewer 必须额外查两项：新增代码是否零调用者；详设点名的产物文件是否逐项存在。表的每行只能 `MATCHED` 或 `OPEN`，列为：

`file:line or symbol | TP/acceptance | design § / IA control | owning source / evidence path | reviewer | result | exact difference`。

README、依赖/lockfile、公共 API、package invariants、runner command/cleanup、安全边界都人工对，不以机器门代替。新增代码需要关联 focused proof 与 red mutation；第三方用法须关联 TP-X1 对应 resolved version 和官方依据。任一 `OPEN` 先由主 agent 修复，再交 fresh 独立 reviewer 对账；未全部 `MATCHED` 只能报告“实施未就绪”，不可邀请 Claude 作实施完成复核。此门与整体测试前的三维对账不同，不得替代。

## 13. 交付清单、状态分档与可能停点

交付包括：

1. CP-0 至 CP-D 每 CP fresh tri-dimensional `MATCHED` 记录与全批整体三维记录；
2. TP-A1..TP-A11、TP-B0..TP-B5、TP-C1..TP-C3、TP-D1..TP-D4、TP-X1..TP-X3 的新鲜证据，红变异首次失败与恢复通过；
3. RNTL v14 POC 的六种迁移能力/4 个 focused test 结果、临时依赖清理确认、正式 lock/peer graph 与共享 setup 的 focused proof（全局 `expect`、act 环境设置/恢复、逐例 RNTL cleanup；去掉 cleanup 后跨用例残留测试真实判红）；POC PASS 不升格为迁移完成；
4. Kotlin 三源集的真实 JUnit XML，逐 `@Test` source/report map；lint 执行 package 集合和 suppression zero；
5. 非拓扑：双 integration Expo Web 先于双屏真机与 mobile VM 的 TR-16 全场景逐项并列矩阵，同场景 SHA/结果/日志/evidence/runID/business/cleanup；双屏两 display 分开；
6. 拓扑：JVM A7/A8/A9 与两台 laptop VM 上 T1–T5 场景矩阵，分别给出两 VM serial、shape、同 run source SHA、heartbeat 生产配置及 ≥3× timeout 观察、双端 pair/sync/disconnect/close reason、evidence/runID/business/cleanup；不得用 Web 或 stage-2 dual shape 替代；
7. TP-A11 双屏真机与 mobile VM 两设备 old namespace precondition + no-mismatch 结果；不得清数据；
8. 全部触及包中文 README、第三方版本/source ledger、N-1..N-37 逐项 disposition；
9. 逐代码与详设对账表全 `MATCHED`；fresh 实施审查报告与处置；Claude handoff 校验通过；
10. 至少两行状态：“当前字节上的最新运行”及“最后一次通过”；并将 static、focused、typecheck、Web、Android/native/device、visual、business、cleanup 分档。

实施可能保持 OPEN 的已知条件：当前 wallpaper-console 高度 800/720 基线归因、双屏物理/mobile/laptop VM 受管 runner 在各自 fresh serial 上可用、双屏真机与 mobile 两台设备旧 MMKV namespace 存在，以及正式 lock resolution 与已 PASS 的 RNTL POC 是否保持同版本/peer shape。两台 laptop VM 在实施开工时现取身份与 serial，不冻结成本文件中的当前值。RNTL 安装授权与 POC 已不再是前置缺口。逐项未满足按原验收报告 OPEN，不删需求；只有 v3.4 §2 明定异常可升级或向 Dexter提交设计偏离裁决。

## 14. 范围外与回裁边界

不做 DEV/L2/seed/reset/UAT/backend/admin app、其他设备、前台 service/Sentry/框架版本升级、NanoHTTPD 替换、焦点陷阱/模态语义、业务操作/文案/Journey 变化、受保护 namespace 删除、无授权数据清除。满足同一产品不变量但需换实现方式时主 agent可在既定范围内选更简单形态并记录；出现新产品/Journey 选择、验收互相矛盾、需要超范围依赖/设备/数据操作时，暂停该子项并交 Dexter，不阻断与其独立的工作。
