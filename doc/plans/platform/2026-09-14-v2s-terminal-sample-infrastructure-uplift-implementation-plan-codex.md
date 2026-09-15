# TER sample 基础设施上收 base · B1–B4 实施计划

DOC_KIND=IMPLEMENTATION_PLAN
AUTHOR=Codex
PLAN_VERSION=2026-09-15-v3.7-current-implementation
BUSINESS_SOURCE=doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md
BUSINESS_SOURCE_SHA256_PREFIX=628d84c09c47
DESIGN_SOURCE=doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md
AUTHORIZED=Dexter 一次性授权：修订详设/计划、实施 B1-B4、运行获准的动态验证、准备 implementation review 交接
NOT_AUTHORIZED=Git 控制动作；超出需求的产品/权限裁决；未由本任务需要的 seed/reset、部署或其他范围外变更
IMPLEMENTATION_PERFORMED=true
DESIGN_STATUS=IMPLEMENTED;CURRENT_CODE_RECONCILIATION_MATCHED;EXTERNAL_IMPLEMENTATION_REVIEW_PENDING
CODEX_INDEPENDENT_SUBAGENT_EVIDENCE=CP0_CURRENT_PLATO_NO_GO_OPEN;CP1_CURRENT_AQUINAS_MATCHED;CP2_CURRENT_EULER_MATCHED_WITH_OPEN_EVIDENCE;CP3_CURRENT_SOCRATES_MATCHED_WITH_OPEN_EVIDENCE;CP4_CURRENT_HUBBLE_MATCHED_WITH_OPEN_EVIDENCE;WHOLE_CURRENT_MAIN_FALLBACK_MATCHED_WITH_OPEN_EVIDENCE;CODE_DESIGN_CURRENT_MAIN_MATCHED;CLAUDE_REVIEW_PENDING
REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE
EVIDENCE_TIER=static_PASS;focused_PASS;native_SUPPORTING_PASS;Android_SUPPORTING_PASS;release_SUPPORTING_PASS;Web_NOT_RUN;visual_NOT_RUN;cleanup_PASS

> 本文是受控实施顺序和当前证据索引；已完成 Dexter 一次性授权内的源码实施与已执行的
> 动态验证。运行结果只以当前源码、原始命令输出、日志、设备记录和对账记录为准；Web、
> visual、完整 sample2 acceptance 与外部 implementation review 仍保持 OPEN。

## 0. 入口、范围和不可变前提

### 0.1 先读什么

实施会话从仓库根重新打开以下材料，并以当前字节为准：

1. AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、当前 program 的 Roadmap
   授权字段；
2. project-memory/index.md 全部 kernel 与六维路由命中的原文；
3. scripts/README.md；
4. 本计划、实现详设、需求 v3.7、sample1 冻结旅途与 sample2 需求/详设；
5. 实施中每一个变更点对应的 owning source、当前可复用能力、适用 UI interaction
   template 和 observability/acceptance 标准。

计划不是授权来源。本轮 Dexter 已明确一次性打开 B0–B4、对应动态验证和 review handoff；
仍不打开 Git 控制动作或未列入本任务的外部范围。

### 0.2 已定案而不重开

以下直接沿用需求 v3.7，不在实施中重做产品裁决：

- R-E1：base 禁止依赖 feature、integration 和 App；adapter 方向是
  assembly.base.<platform> 的合法接线。
- R-E2/R-E3/R-S7：native 注册在 super.onCreate(null) 之前；PRIMARY 是被 splash
  覆盖的物理 Activity 主表面；六种 RenderFallbackReason 都不是 ready；永久不 ready
  时终态收起 splash 并显示失败页。
- R-E4：picker 入口 command → actor → kernel child command 两跳结果必须闭合，写入前、
  写入后失败必须区分。
- system notice 冷重启按请求已结束处理，不恢复成 sample2 持久浮层；sample1 身份不改。
- U8/D-5：按裁定④，先实际运行 `tools/terminal-sample2/run-a9-runtime.mjs` 作探针；
  只有当当前源码绑定的实跑结果证明其不能驱动 release、双 App、真实双屏和 splash/ready/
  failure 观察时，才升级为新的 record-only release cold-start runner。探针和升级理由
  必须由当前 evidence 记录，不能沿用旧结论。

### 0.3 工作边界

B1–B4 只解决需求 §3、§4、§5、§7 的基础设施上收、picker 丢弃结果和验收闭环。
不引入新的业务 Journey，不改 sample1 frozen partKey、layerId、testID、testID
前缀或 sample2 已冻结的 waiting/welcome key；不把历史 handoff、作者自报数字、旧 review
或已有局部日志当成当前源码真相。

Dexter 控制 Git；计划不要求、提示或执行任何 Git 动作。

## 1. 前置条件、状态门和实际批次顺序

### 1.1 B0 必须先收口

B1–B4 不得在以下任一项未满足时开工：

1. sample2 实施验收已在其冻结版本上通过。该证明只证明原 sample2 已批准范围；
   它不能替代本批 B4 的 picker child-result/U13，也不能把 picker 缺陷重复计入
   sample2 acceptance。
2. terminal static baseline 全绿。当前已知首败是 picker package.json 的
   devDependencies 与 graph/package declaration 不一致；实施时必须保存真实首败、最后
   已知好点和 broken boundary。按需求 v3.7 R-E6，B0 从 picker package.json 删除错误
   的 `@catering-v2s/kernel-base-platform-ports` devDependency；graph 与
   `src/dependencies.ts` 不声明这个 test-only target，但保留真实的
   `@catering-v2s/ui-base-test-support` dev edge，不把 platform-ports type import 伪装成生产依赖。
   不能只改 dependencies.ts，也不能把红推迟到 B1。

若无法找到 sample2 acceptance 的冻结证据，或 static baseline 仍红，B0 为
BLOCKED，B1–B4 不得开始。不能以等待、延长 timeout、重新命名失败或把本批 U13
改写为 sample2 acceptance 来绕过。

### 1.2 逻辑依赖和执行顺序

| 层次 | 顺序 | 依赖事实 | 说明 |
| --- | --- | --- | --- |
| 前置 | B0 | sample2 acceptance、static baseline | 不是新增业务批次；R-E6 只删除 picker package.json 错误 `kernel-base-platform-ports` devDependency，graph/dependencies.ts 不声明该 target，合法 test-support edge 保留 |
| runtime/base | B1 | B0 | 自声明 runtime subset、五个 factory、feature exclusion 和依赖门先稳定 |
| native/base | B2 | B1 的可复用 contract 可读 | 新 node batch=2；native provider、required capability 和 App thin shell |
| console/render | B3 | B1；运行顺序上消费 B2 的 native capability contract | 新 node batch=2；console-assembly、single writer、sample-console module、ready |
| feature | B4 | **逻辑图只依赖 B1** | 依赖字段不得因 U10 最终旅途而扩成 B2/B3；feature module/assembly、requestOutcome、notice、picker |

实际落地采用 B0 → B1 → B2 → B3 → B4，因为 B2 的 native capability 必须先有明确
的 consumer contract，B3 才能把 required capability 接进 render。这个执行顺序不是
给 skeleton graph 偷加 B3→B2 或 B4→B2/B3 边：B4 在 graph/package 依赖上只写 B1。

### 1.3 graph 和批次计数不漂移

- 两个新 base 节点分别在 B2 和 B3 建立，均写 batch: 2。
- 因此 B2、B3 各自按需求硬编码计数增加 1；实际最终值由当前 graph 源码和 checker
  运行结果确认，不能在计划中预报一个未经运行的总数。
- 保留当前已有真实边；实现后应出现并核对三条跨批次边：
  assembly.android.sample-terminal → assembly.base.android；
  assembly.android.sample-wallpaper-terminal → assembly.base.android；
  ui.integration.sample-console → ui.base.console-assembly。
- 默认完整 graph 才是证据。batch=1 投影会静默滤掉投影外依赖，任何由 batch=1
  projection 得出的“无缺边/无反向依赖”都标为无效，不得写入 gate 结论。

## 2. B0：前置复核和静态首败根因

### 2.1 输入与构造步骤

主 Codex 在获得 implementation 授权后按以下顺序执行：

1. 读取 sample2 冻结 acceptance 的版本、范围和 evidence；将 picker defect 标为本批
   B4 的新增范围，避免双计数。
2. 按 scripts/README 的当前入口运行 terminal static sequence；首个动作只建立
   run-scoped log、命令、版本、开始结束时间和 cleanup 记录，不启动任何 DEV 或动态
   环境。
3. 实际重开 tools/terminal-skeleton/graph-model.mjs、apps/terminal/skeleton-graph.ts、
   picker package.json 与其 source import，确认首败的 broken boundary。
4. 按需求 v3.7 R-E6 删除 picker package.json 的错误
   `@catering-v2s/kernel-base-platform-ports` devDependency；graph 节点和
   `src/dependencies.ts` 均不得声明这个 target。保留当前真实的
   `@catering-v2s/ui-base-test-support` dev edge；不能把 platform-ports test-only type import
   补成生产 graph/dependencies 声明，也不能误删合法 test-support edge。
5. 运行真实 terminal skeleton static test/check sequence，并保存首败、修复后的绿控制、
   red mutation 和 cleanup；通过后才写 B0 CLOSED。

计划只规定使用仓库现有的 static 入口，例如
node tools/terminal-skeleton/verify-static.mjs 及其实际调用的各包 check-static
入口；不另造平行 runner，不在本次计划阶段执行。

### 2.2 B0 收口

| 必须成立 | 失败即停 |
| --- | --- |
| sample2 acceptance evidence 可定位且范围不吞掉 B4 | 无 evidence、版本不匹配、或把 U13 算成旧 acceptance |
| graph 与 package.json 的 picker 声明与源码使用一致 | 只改 dependencies.ts、只改 graph、或只改 package |
| 当前 static baseline 全绿 | 首败仍是同一边界、只看 exit code、或把未运行写成 PASS |
| first failure/last known good/broken boundary/log/cleanup 可回放 | 无日志、无 cleanup、作者摘要替代原始输出 |

B0 只允许在本批范围内修复 static prerequisite。任何业务或产品偏差另停在 Dexter
裁决，不擅自扩大 B0。

## 3. B1：runtime 自声明、依赖门和可取消运行期模块

### 3.1 B1 落点

B1 处理 D-1、D-2、D-4 的可复用机制，但不把 B3 的 sample-console 功能提前假装
完成：

- tools/terminal-shared/import-capabilities.mjs：复用并扩展 TypeScript AST collector，
  覆盖 import、import type、export/re-export、dynamic import、require 和 import-equals；
  解析相对路径与 workspace root 入口，明确 test-support/dev-host 是否属于运行期门的
  scope，不能用字符串关键词做语义判定。
- tools/terminal-skeleton/graph-model.mjs：以真实 package/source census 生成默认完整
  graph；不以 batch=1 过滤作为完整性证明；保留 source import 与 graph declaration
  两个可区分的事实面。
- tools/terminal-skeleton/check-static.mjs 及其 test：检查 self-declared runtime
  factory、依赖 subset、root workspace 枚举、graph/package 对账、边界方向和 entry
  reachability；每个新增规则有真实 red mutation。
- 五个现有 dependencyModuleNames factory 同批改为声明自身实际 runtime module 所需
  的 subset：display-context、ui-state、sample-member-registry、sample-staff-session、
  sample-wallpaper。不得把整个 dependencyModuleNames 数组当作自身份伪造。
- 三个 feature exclusion module 不再作为“缺少 runtime module”的补丁：
  sample-member-desk、sample-staff-auth、sample-wallpaper-picker。
- package.json、apps/terminal/skeleton-graph.ts、相关 dependencies.ts、README 和
  workspace declaration 必须以同一个真实包 census 原子更新。

B1 不把 sample-console 的最终 runtime module factory 写成“已存在”。该包在 B3
才成为可取消的真实运行期模块；B1 只提供它必须遵守的自声明/解析规则。

### 3.2 B1 逐步动作与中间错误

| 步 | 真实动作 | 预期中间失败/红变异 | 收口 |
| --- | --- | --- | --- |
| B1.1 | 先建立 AST/source census 与完整 graph model；另做 root workspace/Turbo dry-run | 删除一个 root workspace declaration 时 graph census 本身不一定红，必须由 workspace enumeration/Turbo dry-run 或 fresh review 发现；用 batch=1 作为 full graph 输入无效 | census 与 full graph 可复算，workspace 观察独立留痕 |
| B1.2 | 在每个 owner consumer 的 `src/dependencies.ts` 建 `runtimeModuleDependencyNames` self declaration；checker 从 package.json 与 target `moduleKind` 独立推导 regular/runtime 期望，并确认生产 factory 消费该声明 | 删除 regular 或 runtime 数组项而不改 package/graph；owner 缺声明；factory 继续消费 whole array；optional/opaque/spread 伪造，均必须红 | regular/dev/runtime 三层集合分离，五个 factory 与三类 feature/integration factory 均消费同一包内声明 |
| B1.3 | 迁五个 factory，删除三类 feature exclusion | 只删除 exclusion 会触发 Missing required runtime module dependency 或 array mismatch | 每个 factory 有真实生产 module factory |
| B1.4 | 建 boundary checker 与 red tests | import-equals、type-only、re-export、dynamic import、relative App adapter 任一被漏扫时对应 mutation 不红 | AST predicate 全部 mutation 红 |
| B1.5 | 写 README 和 package/graph/dependency 对账 | 漏 package 或 workspace root 未枚举时默认 static 红 | package、graph、workspace、README 一致 |
| B1.6 | 由 fresh 独立子 agent 做 B1 stage reconciliation | 作者自审、缺输入清单或缺三维双读即 BLOCKED | 独立记录 MATCHED，才进入 B2 |

### 3.3 B1 测试/证据清单

- U1：先以真实缺少 runtime module 的 red mutation 证明 dependency checker 会红；再在
  B3 sample-console factory 完成后跑 full graph、resolver、entry reachability 和
  package/workspace 对账，U1 **只在 B3 收口**。
- U2：fixture 必须是可以取消注册的真实运行期模块 factory；从真实 assembly/module
  registry 注入并撤回，验证 resolver 缺失、重新注册成功和单 client sink。不能使用
  createRuntime 永远强制 prepend 的 kernel.base.runtime 作为 fixture。
- U11：五个 factory、自声明 subset、optional/whole-array 反例、三类 feature exclusion、
  package/graph/workspace README 漏项。
- U5 的 base→feature/integration/App 负向边和 assembly.base→adapter 正向允许边在
  B1 建模；native App wiring 的实际完整覆盖在 B2。

## 4. B2：native base、App thin shell、身份资产和 splash provider

### 4.1 B2 落点

B2 只建 provider 和原生真实读取入口，不在 App 壳中实现 ready 语义：

- 新的 assembly/base/android package 与 skeleton node：batch=2；其公开 capability
  contract 由 assembly/base/android 提供，adapter 只作为 R-E1 放行的接线方向。
- assembly/base/android 的 module/assembly 结构、native-loading capability provider、
  Android registration 和两个 App 的薄壳接线。
- 两个 App 的 committed native projects、MainActivity 注册顺序、styles.xml、
  themes、Android manifest、Gradle 依赖和原生资源。原生 source 是 splash 的权威读取面；
  app.json 仅作镜像/漂移检查，不得反向冒充原生事实。
- App identity/assets/loading copy/color/testID/persistenceKey/integration factory 等
  需求 §3.1 允许的 App 投影差异；除此之外六个 root config 文件逐字相同。
- sample-terminal/assets/splash-icon.png 必须由 cleanup/source census 确认不存在；当前
  字节已确认它不存在，因此不重复删除。不能删除 wallpaper assets/README.md 的内置壁纸
  资产表。native splash logo 纳入
  res/drawable/splashscreen_logo 的 registry。
- 中文 README：所有新增 package 和受影响 public surface 按 TR-10 更新。

开机画面 ready consumer 不在 B2 伪造。B2 交付 required capability 与 native provider；
B3 才把它接入真实 render part/layout。这样 D-5 的选定机制决定 B2 先于 B3，但不改变
graph 里的 B4→B1-only 约束。

### 4.2 B2 原生实施步骤与反向证据

| 步 | 落点 | focused/red | 收口 |
| --- | --- | --- | --- |
| B2.1 | package、graph、dependencies、module/assembly skeleton | 删除 node/package 任一声明或改 batch=1 时 full graph red | node/count/deps/README 对账 |
| B2.2 | capability contract、assembly/base/android provider、App thin shell 与 typed render failure callback | 移除 provider 或改成 no-op 时类型/assembly focused red；App 壳直接决定 ready 或自绘 failure page 时 design/source review red | required capability 与 `StandaloneStartupFailurePage` 可由真实 consumer 注入 |
| B2.3 | MainActivity 与 native Gradle/manifest/styles/theme/resources | 把注册移到 super 之后、删 Theme.SplashScreen/post theme 或删 Gradle 依赖时 native/static red | 两 App 原生读取链完整 |
| B2.4 | identity/assets/config projection checker | 只改 app.json 不改真实 native input，或新增未允许 root config 差异时 red | D-6/D-11 closed-form check |
| B2.5 | focused native negative tests and docs | 用 fallback 或 outer root layout 触发 ready 时 ready focused red | PRIMARY/fallback boundary ready |
| B2.6 | fresh B2 stage reconciliation | 缺 fresh record 或 dynamic 先于 reconciliation 即 BLOCKED | stage MATCHED 后进入 B3 |

### 4.3 B2 测试/证据清单

- U5：完整 graph 的禁止方向、source import 形式和 App-side adapter wiring；R-E1 的
  assembly.base→adapter 是 green control，不当成负例。
- U6：native package/build/link/manifest/theme/assets source；无 capability、no-op、
  App 直持有实现和手工未登记资源的反例。
- U7：资产引用双向闭合；验证配置引用的资产存在、assets/ 下无未引用且未登记文件，
  两个 App 使用同一封闭规则。只做“引用→存在”时，孤儿资源的 red mutation 必须失败。
- U8 supporting：B2 只保存 provider/native 输入和 PRIMARY/fallback focused negative。
  逐一注入 runtime-unavailable、container-empty、missing-catalog-entry、
  incompatible-catalog-entry、missing-renderer、invalid-props，六种都不能被称作 ready；
  `container-empty` 在 started + resolved physical PRIMARY host 上还必须显示 render-owned
  failure page 并收起 splash，host `pending` 只有收到 owner 的 terminal `unavailable` 才可
 进入同一失败路径。
  旧 tools/terminal-sample2/run-a9-runtime.mjs 必须在本轮先实跑一次；只有当前 probe
  证明其不能驱动 release、双 App、真实双屏和 splash/ready/failure 观察，才按详设升级为
  新的 record-only release cold-start runner。B2 只收口 provider/native build input 与
  focused red；不在 B2 子章节提前声称 release/mobile/dual evidence。
- U12：native identity/assets/config projection，与六个 root config 的 closed form。

## 5. B3：shared console、single writer 和 rendered ready

### 5.1 B3 落点

B3 处理 B1/B3 在 ui/integration 的重叠，但把两者拆成先后责任：

1. B1 只建立 integration 目录、package、graph 和依赖 census 所需的结构约束；
   不宣称 sample-console 已是 runtime module。
2. B3 在 ui/base/console-assembly 建立 console assembly skeleton 和唯一写入 owner；
   将 ui/integration/sample-console 接入共享 admin console，并补成真实可取消的
   runtime module factory。sample-console 不能继续只靠 descriptor/whole array。
3. 为 ui/base/render 接入 D-5 required native-loading capability；ready 观察位于
   真实 ScreenContainer resolved part 的 layout/geometry boundary，不是 SurfaceRoot
   外壳或 runtime startup。
4. 将 run identity 在第一次写入之前由 console-assembly 直接生成并隔离于 platform
   ports/client override，统一写入端为 console-assembly；oracle 只读单客户端 sink。
   不要把所有失败路径声称已经有 terminal state：resolver 可能在 startup.failed 前
   抛错，必须先定义并测试实际覆盖范围。
5. SurfaceRoot 的两处 mount/layout observation 当前由 __DEV__ return 挡住；实现要
   分离 production 必需的 ready/diagnostic path 和 dev-only detail，不能把 __DEV__
   tracker 当 release 证据。

### 5.2 B3 逐步动作与中间错误

| 步 | 真实动作 | 预期中间失败/红变异 | 收口 |
| --- | --- | --- | --- |
| B3.1 | 建 ui/base/console-assembly package、graph/deps/README | 删除 assembly node 或反向引入 feature/integration 时 graph/layering red | assembly 只有允许方向 |
| B3.2 | single writer、run identity、single-client sink、structured log schema，以及 real-part navigation 的 per-runtime primary-ready promise gate | 保留第二 writer、允许 duplicate run、oracle 改写 sink、HMR 旧 run 混入，或登录后 picker remount 再写 complete 时 focused/red mutation fail | first-write uniqueness 与导航后的单次 complete 可证伪 |
| B3.3 | 转换 sample-console 为 runtime module factory 并从 integration 调用 | 先删 descriptor 再启用 consumer 时 Missing required runtime module；不可取消 fixture 时 U2 red | 可取消真实 module 注册/撤回 |
| B3.4 | 接 native capability 与 ScreenReadyBoundary | 删除 required prop、让 fallback layout 或外 root layout 触发 ready 时类型/focused red | resolved real part + geometry + physical PRIMARY |
| B3.5 | 完成 SurfaceRoot production observation 与 event boundaries | 恢复 __DEV__ guard 或只记录 startup event 时 focused red | ready 与 diagnostics 可分档 |
| B3.6 | U1 final static and stage reconciliation | B1 仅 green、B3 sample-console 未 runtime 化时 U1 保持 OPEN | U1 full static/fixture/entry MATCHED |

### 5.3 B3 测试/证据清单

- U1：完整 graph/package/workspace/entry/runtime resolver；五 factory、sample-console
  factory、integration shared admin console 和 cross-batch edge。
- U2：真实运行期 display-context/module factory 注入、取消注册、重注册和缺失错误；
  不用 kernel.base.runtime fake。
- U3：run identity duplicate/missing/old HMR run、first-write uniqueness，以及登录成功后真实
  picker remount 不得再次写 `startup.complete`；该 navigation regression 必须通过
  console-assembly 的 runtime promise gate 真实触发。
- U4：single-client sink、single writer、structured log、resolver failure boundary；
  单 client oracle 不能写入。
- U9：sample-console shared admin console 使用单 catalog、单 openLayer、单 input
  pipeline；不创建 app 私有第二 console。
- U8 final：计划顺序要求在 B4 closure 且全批三维对账完成之后运行 release/手机/双屏冷启动记录；
  本轮因 fresh reviewer 连续失败由主 agent 接管并继续完成当前 evidence，实际顺序偏差在
  §9.4.1 和 fallback record 中保留。
  记录必须同时包含：ready 前的 Activity/native splash 仍可见；`t0` 首个 RN 内容的
  设备侧 UIAutomator 观察及同一设备 log snapshot；required runtime capability、
  resolved real part/geometry/physical PRIMARY 的 `ready-candidate`；`startup.complete`
  与 `ready-hidden` 均在同一 device log 中位于 candidate 之后；settled 时 splash 不再
  可见。UIAutomator 的 t0 可能在 ready/hide 之后返回，因此不以 t0 snapshot 仍见 splash
  作为独立失败条件，也不比较 host `Date.now()` 与 device log epoch；必须明确记录
  `firstContentObservedAfterReadyCandidate/Hidden`，并以 render-owned candidate 的
  源码语义和同一 device log 顺序区分早收起与就绪后收起。若实现真的在 candidate 前
  hide，或 settled 仍见 splash，则 FAIL；观察边界不是生产超时。还要有 no-ready
  observation-bound/final failure page record，证明 R-S7。双屏每个目标形态必须记录
  physical primary surface mapping，不能以 logical 360×640 或 screenshot size 单独
  冒充 ready。当前 U8 正常与 wrong-primary 结果见对应 current-source evidence；它们是
  supporting release/Android 记录，不把 B2/B3 前置或整体 acceptance 自动写成 PASS。

## 6. B4：feature module/assembly、sample1 notice 和 picker 两跳结果

### 6.1 B4 落点和依赖

B4 的逻辑依赖、package.json dependencies 和 graph edges **只写 B1**。U10/U13 的最终
旅途可能实际使用 B2/B3 已提供的运行期能力，但这不是 B4 的包依赖，不得借旅途需要
扩边或把 B4 批次改写成依赖 B2/B3。

B4 必须补回评审指出的骨架上收，并按详设 D-13A 建立专属 shared target：

- apps/terminal/ui/feature/sample-member-desk/src/application/module.ts 与
  assembly.ts；
- apps/terminal/ui/feature/sample-staff-auth/src/application/module.ts 与 assembly.ts；
- apps/terminal/ui/feature/sample-wallpaper-picker/src/application/module.ts 与
  assembly.ts；
- 共享 feature module/assembly factory `ui.base.feature-assembly` 的实际 owner、依赖
  subset、可取消注册和 feature identity；D-13（App 壳）不作为本项落点。

### 6.2 requestOutcome 与 system notice

1. D-12 不能从分类名称推导。实现先读取当前两个 feature 的现行逻辑
   `apps/terminal/ui/base/render/src/foundations/requestOutcome.ts` 与其
   `apps/terminal/ui/base/render/test/requestOutcome.test.ts` 现行实现/测试，
   再以该 source oracle 逐行维持到 `apps/terminal/ui/base/render/src/foundations/requestOutcome.ts`
   并测试：

   | 当前结果 | actor error 集合 | outcome |
   | --- | --- | --- |
   | result.status=completed | 任意 | completed |
   | result.status=running | 任意 | running |
   | 非 completed/running | 非空且所有 category 属 BUSINESS、VALIDATION、AUTHENTICATION | business-failure |
   | 非 completed/running | 空集合 | system-failure |
   | 非 completed/running | 任一 category 不在上述三类 | system-failure |

   AUTHORIZATION、NETWORK、DATABASE、EXTERNAL_API、SYSTEM、UNKNOWN 均属后一类。
   这张表是现行实现的闭合投影，不增加“看起来像业务”的新类别，不把
   AUTHENTICATION 改为 system。
2. notice body 上收到 ui/base/render 或其确定 owner；feature 只保留独立 identity、
   command/actor/lifecycle。sample.auth.system-notice:* 与 sample.desk.system-notice:*
   五项 testID、partKey、layerId 不改；三条 close path（button/backdrop/back）都需
   经过同一个 layer close contract。冷重启不恢复 notice。
3. 如果实现中发现 R-P4 的 owner/触发路径无法在不改 sample1 identity 的前提下落地，
   立即保留证据并向 Dexter 上报，不自行改名或改成 sample2 persistence。

### 6.3 picker 两跳和写入相位

picker 实施必须同时修正 actor 和两个 UI dispatch 入口：

1. 入口 command 等待 picker actor；actor 继续发 kernel child command，并在成功处理完成
   后才可返回 `null`，但绝不能在 child dispatch 前或未检查结果时无条件 return null；必须
   读取其 CommandDispatchResult。
2. child result rejected/non-completed 时，actor 以现有 contracts 的安全
   AppError/normalized error 表达失败，不泄漏 raw payload。父 request 的最终
   requestOutcome 不得被伪造成 completed。
3. UI 在失败收口时读取 authoritative wallpaper state：
   - 写入前失败：旧 wallpaper 仍在，state=selection-failed-before-write，按 PF-01
     冻结提示“操作没有完成，请重试”；
   - 选择写入后失败或 readback 发现已写入：新 pending wallpaper 已成立，
     state=selection-failed-after-write，提示“已选中该壁纸，但系统未能确认，可继续操作”，
     不得提示“未写入”；
   - 确认写入后失败或 readback 发现已写入：新 confirmed wallpaper 已成立，
     state=confirmation-failed-after-write，提示“壁纸已更换，但系统未能确认，无需重复操作”，
     不得提示“未写入”；
   - 无法确认写入相位：state=selection-failed-unknown-write-phase，提示“操作结果
     未能确认，请以当前画面为准”，不得编造成功或未写入。
4. 同一 shared system notice body 可复用，但 picker 的 feature identity、
   persistence/lifecycle 与 sample1 notice 不合并。系统失败冷重启后按请求结束，重新
   进入正常 picker/welcome path。
5. U13 至少一例要由真实 runtime child-command injection 触发，不得只测试 promise
   rejection 或手工调用 presenter。记录入口 requestId、child result、state、
   user-visible notice、readback、retry 和 cleanup。

### 6.4 B4 逐步动作与中间错误

| 步 | 真实动作 | 预期中间失败/红变异 | 收口 |
| --- | --- | --- | --- |
| B4.1 | 先建 `ui.base.feature-assembly` shared factory，再建三组 feature module.ts/assembly.ts 薄适配并登记 B1-only deps | 缺 shared/feature module/assembly、写 B2/B3 dependency 或仍全数组伪造时 graph/focused red | 三组 skeleton 可取消且 identity 明确 |
| B4.2 | 上收 requestOutcome，加入 exact table tests | AUTHENTICATION 改 system、空 error 或 mixed category 误分时 focused red | 逐行等价 |
| B4.3 | 上收 notice body，保留 feature identities and five testIDs | 改 sample1 identity、少 close path、冷重启恢复时 UI/focused red | three close paths and restart semantics |
| B4.4 | picker actor 消费 child result，UI 加相位 readback | actor 丢弃 child result、在 child dispatch 前无条件 return null、只改 void dispatch、写入后提示未写入时 PF red | write phase states truthful |
| B4.5 | 真实 runtime injection、U10/U13 focused matrix | 仅 mock rejection、无 retry/readback/cold restart 时 U13 OPEN | U13 evidence sufficient |
| B4.6 | B4 stage reconciliation；随后在所有批次静态/focused 收口后、任何动态之前做 whole-scope reconciliation | fresh reviewer 缺失、whole-scope 缺失或 dynamic 先跑时 BLOCKED | 两类 fresh record MATCHED 后才允许动态 |

### 6.5 B4 测试/证据清单

- U10：按详设 D-9 的 sample1 frozen journey 和 sample2 frozen journey 逐行执行；
  任何 partKey/layerId/testID 改名都是红。
- U12：所有 notice feature identity、五项 testID、button/backdrop/back close、冷重启
  request-ended 和 shared body。
- U13：按详设 §8.2 的 PF-01 至 PF-10 执行：select/confirm 的 write-before、write-after、
  readback unknown、normal result、notice 冷重启、button/backdrop/back 三种关闭、
  business/no-pending、duplicate in-flight、关闭后 retry。至少 PF-01 或 PF-02 必须由
  真实 runtime injection，而非只靠 unit mock；编号和语义不得在计划中另行定义。

## 7. U1–U13 执行体、批次与红夹具总表

以下是计划层的执行安排；执行体在实施时必须按详设 §7 的语义判定实现并有真实
red mutation。一次性 evidence 不等于常驻 verify，二者在结果中分栏。

| 判据 | 常驻执行体与落点 | 建造批次 | 一次性产出 | 必须打红的捷径 |
| --- | --- | --- | --- | --- |
| U1 | terminal-skeleton full static/resolver/entry checker | B1 建门，B3 收口 | B3 static + stage record | 删 sample-console descriptor、缺 node/package、batch=1 projection |
| U2 | real cancellable runtime-module fixture + resolver | B1 contract，B3 fixture | B1/B3 focused record | kernel.base.runtime 永久 fixture、不可取消 fake |
| U3 | run identity validator and ready tracker | B3 | focused mutation record | duplicate/missing/old HMR run |
| U4 | single-client read oracle + console-assembly writer/log schema | B3 | focused/log record | oracle write、第二 writer、多 client |
| U5 | AST boundary + graph/layer predicate including App wiring | B1/B2 | static/red record | type-only/re-export/dynamic/import-equals/relative import 漏扫；adapter 放行错误 |
| U6 | native package/link/manifest/theme/assets source checker | B2 | static/native supporting record | no-op bridge、只改 app.json、漏 styles/Gradle/res |
| U7 | bidirectional native asset-reference closure checker | B2 | static/native supporting record | reference-only check、孤儿或未登记资源、两个 App 不同规则 |
| U8 | new record-only release cold-start runner and device observer; old run-a9 is supporting probe only | B2 provider，B3 ready，B4 closure + whole-scope reconciliation | release mobile/dual cold-start record | dev-only、single form、源码 mutation secondary、ready/timing/failure page 无法区分 |
| U9 | shared admin-console assembly/integration checker + focused | B3 | static/focused record | app 私有 console、第二 catalog/openLayer/input |
| U10 | sample1/sample2 literal journey matrix | B4 | focused/native/Android/Web as authorized | 改 sample1 identifiers、漏手机/双屏/冷重启 |
| U11 | source/package/graph/workspace/README census | B1/B2/B3 | static census/red record | new node/package/root workspace/README 漏项 |
| U12 | notice identity/testID/close/lifecycle checker + UI focused | B2/B4 | focused/UI record | identity drift、三 close path 缺失、冷重启恢复 |
| U13 | picker two-hop runtime injection + readback oracle | B4 | runtime/Android or authorized focused record | void dispatch、return null、write phase 误报、只 mock rejection |

常驻门必须保持分钟级、机械、可解释；业务语义和 UI 形态仍由 fresh independent review
与 Claude review 复核，不能把关键词匹配或字段存在当作语义判定。

## 8. D-9 回归和每批测试用例对账

### 8.1 sample1 U10 不可变清单

本计划不重新发明旅途编号；执行时按详设本节与冻结 sample1 需求/交互设计逐行核对。
详设 §8.1 是本批矩阵唯一权威，计划只列相同编号和验证入口：

| case | 入口与操作 | 双屏预期 PRIMARY / SECONDARY | 手机预期 PRIMARY | state / layer / identity |
| --- | --- | --- | --- | --- |
| S1-01 | 冷启动，未登录 | sample.auth.login / sample.desk.customer-welcome | sample.auth.login | anonymous；无业务层；真实 screen part |
| S1-02 | sample.auth.login 输入错误工号或密码，点 sample.auth.login:submit | sample.auth.login + layer sample.auth.notice / sample.desk.customer-welcome | sample.auth.login + sample.auth.notice | session 未 authenticated；auth notice 的 partKey/layerId 保持既有；message、actions、dismiss 五类节点保持 |
| S1-03 | 用正确凭据再次 submit | sample.desk.member-list / sample.desk.customer-welcome | sample.desk.member-list | staff session established；auth notice closed |
| S1-04 | 点 sample.desk.member-list:add | sample.desk.member-form / sample.desk.customer-welcome（不派 SECONDARY showScreen） | sample.desk.member-form | empty local draft；副屏保持 welcome |
| S1-05 | 填 name、phone，点 sample.desk.member-form:submit | sample.desk.member-list + layer sample.desk.waiting-confirm / sample.desk.customer-member props mode=confirm | sample.desk.customer-member props mode=handheld-confirm | pending 有 name/phone；确认态同时存在；双屏 primary waiting |
| S1-06 | 顾客在双屏点 sample.desk.customer-member:confirm；手机点同一确认 | sample.desk.member-list / sample.desk.customer-welcome | sample.desk.member-list | members 增一；pending=null；waiting closed；confirmation 完成 |
| S1-07 | 顾客点 reject/cancel | sample.desk.member-list + waiting-confirm + registry-notice / sample.desk.customer-welcome；mobile sample.desk.member-form + registry-notice | sample.desk.member-form + registry-notice | pending 仍在；双屏 standard+alert 层并存且 alert 在上；手机无 waiting |
| S1-08 | 在 registry-notice 选 sample.desk.registry-notice:retry | sample.desk.member-form / sample.desk.customer-welcome | sample.desk.member-form | registry-notice/waiting 按形态关闭；form 用 pending 的 name/phone 回填 |
| S1-09 | form 放弃动作先打开 sample.desk.discard-confirm，再确认放弃 | sample.desk.member-list / sample.desk.customer-welcome | sample.desk.member-list | discard-confirm 只在确认中存在；确认后 pending 清除；草稿不进业务 store |
| S1-10 | 双屏 waiting-confirm 点 withdraw，确认 sample.desk.withdraw-confirm | sample.desk.member-list / sample.desk.customer-welcome | N/A | withdraw-confirm 关闭；pending 清除；顾客离开 confirm；不得残留年龄 |
| S1-11 | 冷重启已确认后再进入列表；冷重启未确认 pending 后复核 | sample.desk.member-list / customer-welcome；按 frozen persistence rule | same PRIMARY only | members、operator-name 真实持久化恢复；request ledger 的过期记录不恢复；不得把未提交 local draft 当 store 事实 |
| S1-12 | 退出并先制造两屏残留 layer 后点 logout | sample.auth.login / sample.desk.customer-welcome | sample.auth.login | PRIMARY/SECONDARY 层都清空；session cleared；不能从干净态断言 vacuous pass |
| S1-13 | 顾客补充年龄：双屏点 age，手机点 age | customer-member mode=confirm，键盘在 SECONDARY | mode=handheld-confirm，键盘在 PRIMARY | S-30/S-31；同一 component/代码；纯数字，最多 3 位 |
| S1-14 | S-32 不填 age 直接 confirm；S-33 填 age 再 confirm | 双屏 | 手机 | 空 age 正常登记且 age undefined；填写值在 members.age 等于输入；不得阻塞或静默丢失 |

sample1 sample.auth.system-notice:*、sample.desk.system-notice:* 和冻结的
partKey/layerId/testID 不得在 system notice 上收过程中同步改名。

### 8.2 sample2 U10 正常旅途与 U13 失败注入

WP 编号只描述 U10 正常/恢复旅途；PF 编号只描述 U13 failure injection。两组不得
互换、重复或让计划自行改写详设编号；详设 §8.2 是唯一权威。

| case | 入口与操作 | dual 预期 part/layer | mobile 预期 part/layer | state/oracle |
| --- | --- | --- | --- | --- |
| WP-01 | 冷启动、登录成功，进入 picker | sample.wallpaper.picker on PRIMARY；sample.wallpaper-console.waiting 或 welcome 按 frozen auth state on SECONDARY | sample.wallpaper.picker on PRIMARY；无 SECONDARY | logical 360×640 / physical 720×1280；真实 surfaces |
| WP-02 | 分别选 none、w1、w2、w3 的 radio | picker | picker | pending 只反映选择；confirmed 不提前改变；每个 option、thumbnail、label testID 可寻址 |
| WP-03 | confirm 有 pending | picker + wallpaper background / waiting 或 welcome | picker + background | confirmed=chosen；pending cleared；两屏 asset identity 相同；两个 ROI 各变化 |
| WP-04 | 冷重启已确认 wallpaper | picker/background；SECONDARY frozen state | picker/background | confirmed 恢复；pending empty；system notice 不恢复 |
| WP-05 | 冷重启未确认 pending | sample.wallpaper.picker；SECONDARY exact frozen key | picker；无 SECONDARY | confirmed 不变；pending 按 sample2 §9 冻结规则恢复 |
| WP-06 | confirm 无 pending | picker | picker | typed no-pending failure；confirmed 不变；不显示 system notice |
| WP-07 | 资产 unavailable/unknown/close | exact existing part set | exact existing part set | unknown installation entry dropped；known unavailable render-filtered；close cleanup；无 availability-only flush |
| WP-08 | logout/login and theme | sample.wallpaper-console.waiting / welcome literal keys | PRIMARY exact frozen auth/picker keys | session/layer identities unchanged；theme remains integration/App config |
| WP-09 | full sample-terminal regression | all frozen sample1 keys on both surfaces | all frozen sample1 primary keys | no sample1 identifier drift；U1/U5-U12 static outputs match |

| case | 入口与注入 | 预期身份 | 预期 state 与恢复 |
| --- | --- | --- | --- |
| PF-01 | select w2；child resolved with write-before SYSTEM | sample.wallpaper.system-notice、:title、:message、:actions、:dismiss | request 结束；confirmed、pending 和有效选中态与尝试前相同；message=操作没有完成，请重试 |
| PF-02 | select w2；child dispatch rejects before write | same | rejection 被 picker 消费；无 unhandled；request 结束；state 不变；notice visible |
| PF-03 | select w2；child resolved failure after pending write | same | pending=w2 的变化真实保留；提示“已选中该壁纸，但系统未能确认，可继续操作”；不得说 state 没变 |
| PF-04 | confirm w2；child resolved write-before SYSTEM | same | confirmed 保持旧值；pending=w2 保留；request ended；generic retry notice |
| PF-05 | confirm w2；child rejection/write-after injection | same | confirmed 已变为 w2、pending 按 kernel readback 清理或保持的真实状态；提示“壁纸已更换，但系统未能确认，无需重复操作”；不得回滚伪造 |
| PF-06 | notice open 后冷重启 | no system-notice layer after restart | request 已结束；system notice 不恢复；confirmed/pending 按 sample2 wallpaper rule 处理 |
| PF-07 | notice dismiss button、backdrop、back key 分别关闭 | same five IDs | layer closed；request state unchanged；三条 close path 都不抛 |
| PF-08 | business failure / no pending confirm | no sample.wallpaper.system-notice | business failure 保持 kernel/sample2 既有呈现；no-pending typed failure 不混成 system failure |
| PF-09 | duplicate in-flight select/confirm and two feature notices | picker identity plus independent sample.auth/desk identity | second same request 被 guard 拦截；不同 feature notice 不合并、不覆盖；同 identity 不抛未处理 duplicate |
| PF-10 | system failure 后关闭 notice，再 retry same action with success | picker notice then picker | request ledger 从 failed/ended 进入新的 success；confirmed/pending 按成功语义收口；notice closed |

手机形态使用 sample2 的逻辑 360×640、设备 720×1280；双屏必须同时记录物理 primary
surface 映射。不能只截一张 screenshot 或只跑 development/mobile 充当矩阵完成。

### 8.3 每批用例与 D-8/D-9 对账

| 批次 | 必跑 focused/static | 与 D-8 对应 | 与 D-9 对应 |
| --- | --- | --- | --- |
| B0 | graph/package first-failure and green control | U1/U11 precondition | none |
| B1 | self declaration、五 factory、exclusion、AST forms、resolver fixture | U1/U2/U5/U11 | none |
| B2 | native source、asset/config projection、PRIMARY/fallback negative、required capability | U5/U6/U7/U8-support/U12 | S1-01 startup support |
| B3 | sample-console runtime module、single writer/sink/run、ready timing focused | U1/U2/U3/U4/U8-support/U9/U11 | S1-01 and WP-01 startup support |
| B4 | feature skeleton、exact outcome、notice, picker child result/readback | U10/U12/U13 | all S1-01–S1-14, WP-01–WP-09, PF-01–PF-10 |

每批开始前必须由 fresh independent subagent 完成该批三维对账；每批 focused/static
只在该记录 MATCHED 后开始。U8/U10/U13 任何 dynamic evidence 都排在相应 reconciliation
之后。

## 9. 三类独立对账、执行体建造和动态顺序

### 9.1 stage reconciliation

每个 B1、B2、B3、B4 完成后，主 Codex 停止写入，交 fresh 独立子 agent 只读执行：

- 需求原文；
- 本详设/本计划；
- 项目 memory 设计标准；
- 实际源码、测试、package、graph、配置、证据。

逐点比较行为、形态、动作、关系、位置、文案、限制、状态/控制、失败/恢复、焦点、
可访问性、数据来源、失效边界。记录必须含输入清单、盲审声明、first failure、
finding、源码位置、详设位置、修复/反例、复查结果和 reviewer kind；作者自己写的
checklist 不能冒充 fresh record。没有记录，阶段为 BLOCKED。

### 9.2 whole-scope reconciliation

B4 完成后且任何动态运行前，再由新的 fresh 独立子 agent 对 B0–B4 全批做三维对账。
它不是四个 stage record 的汇总，要专门寻找跨批次偏移：B1/B3 integration overlap、
B4 B1-only graph dependency、D-5 provider/consumer 顺序、sample1 identity drift、
U8/U13 证据是否覆盖全部绕过方式。

### 9.3 code↔design ledger

动态前和交付 Claude 前，主 Codex 先按实际文件 census 与设计/计划逐项对账；每个
实际变更 path 必须能指向设计章节、计划步、U/CP gate 和 evidence。新发现未在设计
中定义的行为不得默默实现，需记录 DESIGN_GAP，必要时交 Dexter。

### 9.4 dynamic order

在本轮 Dexter 已给出的一次性动态授权内，顺序为：

1. B0 sample2 frozen acceptance（同时确认 static baseline 已 PASS）；
2. U8 supporting/native prerequisites and release cold-start record；
3. U10 sample1 normal frozen journey；
4. U13 sample2 failure injection and recovery；
5. Web/Android/release/cleanup 按各自授权分档；
6. 业务与 cleanup 分开判定，cleanup 非 PASS 不得收口。

任何动态失败都先保存 log、first failure、last known good、broken boundary、business
和 cleanup，再定位根因、最小修复、focused re-test；不得把失败改写成 PASS。即使某一
动态档位失败，也不能跳过诊断去执行下一档位，或将 supporting evidence 升级为 PASS。

#### 9.4.1 当前实际执行顺序与偏差

当前仓内实际记录显示：B0/B1/B2/B3/B4 的 fresh stage 记录已留存；B0 仍明确记录
sample2 完整 acceptance 前置没有被本批 focused 结果替代，旧“所有 dev 声明为空”的文字
也已按 R-E6 纠正为“只禁止 platform-ports target，保留合法 test-support edge”。并发
mutation race、Vitest cache hygiene、SF virtual identity、picker confirmation viewport
和旧 APK binding 的首败均分别保留，之后按根因修复并重验。

全批 fresh reviewer 在同一范围连续失败/未完成后，按主 agent fallback 规则由主 agent
完成当前源码—需求—详设—计划对账；记录为
`whole-scope-reconciliation-main-agent-fallback-round14.md`，结论是源码/设计
`MATCHED`，动态/外部 review 边界仍 `OPEN`。当前已经有真实动态 supporting 记录：U8
正常与 wrong-primary、sample1 mobile/dual normal、sample2 mobile/dual normal，以及
U13 真实 runtime focused injection；对应索引见 `u1-u13-current-red-green-20260915.md`。
这些记录不回写 B0 full acceptance，也不把历史 APK、Web、visual 或 Claude verdict 改成
PASS。

## 10. 逐代码与详设对账表

| 实际变更范围 | 计划步 | 详设落点 | 必须证明 |
| --- | --- | --- | --- |
| graph/package picker baseline | B0 | 详设 §6、§11.1 CP-0 | R-E6 删除错误 `kernel-base-platform-ports` package.json devDependency；graph/dependencies.ts 不声明该 target，合法 test-support edge 保留；baseline green |
| AST import collector/graph model/static checker | B1 | §6 D-1/D-2、§7 U1/U5/U11、CP-1 | semantic forms、full graph、red mutations |
| 五个 dependency factory | B1 | §6 D-4、§7 U1/U2/U11 | self subset、无 whole-array fake |
| 三类 feature exclusion | B1/B4 | §6 D-4、§6 D-13A | removal only after real factory |
| assembly/base/android package/node | B2 | §6 D-3/D-5、§7 U5/U6 | batch=2、count +1、native capability |
| assembly/base/android module/assembly | B2 | §6 D-5/D-6、§7 U6/U8/U12 | allowed adapter wiring、native owner |
| two App thin shells/root configs/failure callback | B2 | §6 D-5/D-6/D-11/D-13 | closed projection、six config files、no ready owner/no duplicate failure UI |
| MainActivity/Gradle/manifest/styles/theme/res | B2 | §6 D-5/D-6、§7 U6/U8 | SDK57 native order and real reads |
| splash icon/native asset registry/README | B2 | §6 D-6、§9 D-10 | unique orphan handling and asset authority |
| ui/base/console-assembly package | B3 | §6 D-7、§7 U3/U4/U9 | single writer/sink/run |
| ui/integration/sample-console module/assembly | B3 | §6 D-4/D-7、§7 U1/U2/U9 | real runtime module, shared admin console |
| ScreenReadyBoundary/SurfaceRoot/ScreenContainer | B3 | §6 D-5/D-7、§7 U8 | real part/geometry/PRIMARY, production path |
| five event/log/diagnostic surfaces | B3 | §6 D-7/D-10、§7 U3/U4/U9 | structured redacted logs, no multi-writer |
| shared feature factory plus three feature module.ts/assembly.ts | B4 | §6 D-13A、§7 U1/U11/U12 | B1-only deps, identity, cancellable factory |
| requestOutcome classifier/tests | B4 | §9 D-12、§7 U10/U12 | exact current table |
| shared notice body and feature notice | B4 | §9 D-14、§12 | frozen identity/testID, 3 close paths, restart |
| picker actors/commands/dispatch/readback | B4 | §0.2 R-E4、§9 D-14、§8 PF | two-hop result, phase truth, retry |
| U10/U13 fixtures and evidence schema | B4/closure | §7 D-8、§8 D-9、§13 | real runtime injection, no mock-only closure |
| new release cold-start runner (old run-a9 supporting probe) | B2/B3/closure | §0.2 U8、§7 U8、§9 D-5 | release/mobile/dual/cold timing record |
| standalone render-owned failure page and App callback | B2/B3 | §6 D-5、R-S7、§7 U8、§9 S-NEW-1 | assembly rejection uses fixed render testIDs/alert and only PRIMARY hides splash |
| stage/whole/code↔design review records | each/closure | §13、CP-5 | fresh independent evidence before dynamic |

若实际文件不落在上表，先暂停 code↔design ledger；不能用“实现细节”解释新增 owner
或新依赖，也不能以该表代替实际 source census。

## 11.1 当前静态实现评审 2M/12S/8N 逐条处置

本表对应 `doc/review/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation-review-claude.md` §2。
“FIXED”只表示源码/夹具已按 finding 处理并有相应 focused/static 证据；未运行的
native、Android、release、Web、visual、cleanup 和整体 implementation acceptance 仍为
OPEN。不同意的项保留反例或边界，不以一句“已处理”替代。

| finding | 处置 | 代码/计划落点 | 验证与仍开放的边界 |
| --- | --- | --- | --- |
| M-1 | CONFIRMED→FIXED；六组与 PRIMARY declared/measured/real-ready 由 console-assembly writer 同时判定；platform-ports 不再保留 dead completion state。 | `apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts`、`consoleAssembly.tsx`、`apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`；B3.2 | `node tools/terminal-sample2/check-startup-diagnostics.mjs` 与 focused 通过；release startup oracle 尚 OPEN。 |
| M-2 | CONFIRMED→FIXED；feature-assembly 只接收 identity 和真实定义并派生 module descriptor；三 feature 保留薄 adapter，移除私有 Set/unregister。 | `apps/terminal/ui/base/feature-assembly/src/index.ts`、三 feature `src/application/module.ts`；B4.1 | feature focused/typecheck/static 通过；真实 runtime U1/U2 仍须 closure evidence。 |
| S-1 | CONFIRMED→FIXED；首次 ready 前锁存目标物理 PRIMARY，native recoverable removal 与 terminal unavailable 分开；ready 后使用 runtime failure，SECONDARY 只中性 fallback。 | dual-screen host、`ui/base/render/src/components/ScreenContainer.tsx`、`ScreenReadyBoundary.tsx`；B2.5/B3.4 | render/dual focused 通过；设备 release 时序 OPEN。 |
| S-2 | CONFIRMED→FIXED_SOURCE_OPEN_NATIVE；SDK57 本地包源码核实 manager flag 语义，native gate 按 Activity identity 绑定，JS 不持有跨 Activity latch。 | `apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalNativeLoadingRegistry.kt`、`nativeLoadingCapability.ts`；B2.2/B2.3 | native loading focused/red 通过；Android Activity recreation/device evidence OPEN。 |
| S-3 | CONFIRMED→FIXED；logger 透传调用方 startupRunId，writer 写 client provenance，release 不默认 DEV。 | `createPlatformPorts.ts`、`consoleAssembly.tsx`、两 integration assembly、`androidPlatform.ts`；B3.2 | startup checker/platform/integration focused 通过；release/双 assembly evidence OPEN。 |
| S-4 | CONFIRMED→FIXED；console-assembly 合并 `adminShellAssembly.parts` 并拒绝 duplicate partKey，integration 删除手工 merge。 | `ui/base/console-assembly/src/foundations/consoleAssembly.tsx`、两 integration assembly；B3.1 | console/integration focused 与 static 通过；真实 catalog/device evidence OPEN。 |
| S-5 | CONFIRMED→FIXED；`ConsoleSurfaceInputFrame` 包内私有，不进 public export/invariant。 | console-assembly `consoleAssembly.tsx`、`src/index.ts`、invariant；B3.1 | typecheck/public-surface/static 通过。 |
| S-6 | CONFIRMED→FIXED；picker 删除复制分类表，复用 render base classifier。 | picker `foundations/errors.ts`、render `foundations/requestOutcome.ts`；B4.2 | picker focused 与单一 owner census 通过；U10/U13 动态 OPEN。 |
| S-7 | CONFIRMED→FIXED_WITH_FOCUSED_OPEN_RUNTIME；真实 kernel actor 先写，后置 actor 抛错；phase 由 actor readback，UI 消费 resolved/rejected 并用裁定文案。 | picker actors、`WallpaperPicker.tsx`、`test/pickerSystemFailure.test.ts`；B4.4 | picker 16 focused tests 通过；release/Android U13 recovery OPEN。 |
| S-8 | CONFIRMED→FIXED；删除两个 integration 的 `Test*AssemblyInput` overload 与 `??` capability fallback，测试 support 直接传真实能力。 | 两 integration assembly/support；B3.3 | 两 integration focused/typecheck 通过。 |
| S-9 | CONFIRMED→FIXED_SOURCE_OPEN_DEVICE；U8 settled 检查 splash hidden，t0 来自设备侧首个 RN 内容观察；prevent/ready 两 red mutation。 | `tools/terminal-sample2/run-u8-release-cold-start.mjs`、`check-u8-focused.mjs`、native test；B2.5/B3.4 | U8 focused/red 通过；release/mobile/dual device timing OPEN。 |
| S-10 | CONFIRMED→FIXED_SOURCE_OPEN_RUNTIME；sample1/2 runner 每步断言 PRIMARY/SECONDARY partKey 与 state，并覆盖认证后 cold restart。 | `run-sample1-frozen-journey.mjs`、`run-sample2-frozen-journey.mjs`；B4 closure | `node --check` 通过；business/cold-restart/cleanup OPEN。 |
| S-11 | CONFIRMED→FIXED_STATIC；U5 App→adapter red、U2 真实未注册 runtime 包、U6 App ID collision、D-1 整包遍历与产物排除均有 red mutation。 | skeleton/native projection checkers、runtime module test；B0/B1/B2 | static red/green 通过；不外推为 native/release PASS。 |
| S-12 | CONFIRMED→FIXED_DOC_SOURCE_OPEN_REVIEW；按 TR-10 重写 assembly/base/android、两个 App、console-assembly README，示例回源码。 | 四份 package README；B2.1/B3.1/B3.5 | type/static 通过；fresh README/source 对账仍是当前 OPEN 项。 |
| N-1 | CONFIRMED→FIXED_SOURCE；`environmentMode` 从 `__DEV__` 或显式测试覆盖推导，生产不默认 DEV。 | Android/console/two integration assembly；B2/B3 | affected typecheck 与 focused 通过；设备 config OPEN。 |
| N-2 | CONFIRMED→FIXED；ready callback 先完成 startup command/writer，再 hide；失败才走 failure page，不提前制造 ready。 | `ScreenReadyBoundary.tsx`、render test；B3.4 | callback-before-hide focused 通过；设备时序 OPEN。 |
| N-3 | CONFIRMED→RESIDUAL_RISK；首次测量永久无效且无既有 entry 时不设生产任意超时，splash 可能持续；保留需求 no-timeout 裁定。 | dual-screen invalid-measurement branch、D-5/U8；B2/B3 | source/focused 登记风险；不把 verifier 上限变成生产 timeout。 |
| N-4 | CONFIRMED→FIXED_SOURCE；phase 只由 actor child dispatch 前后 owner-state readback 决定，UI 不猜。 | picker actors、`writePhase.ts`、`WallpaperPicker.tsx`；B4.4 | picker focused 通过；runtime injection OPEN。 |
| N-5 | CONFIRMED→FIXED_OWNER；base boundary 由 skeleton checker 负责，layering checker 不复制同一专用谓词。 | `tools/terminal-skeleton/check-static.mjs`、`tools/terminal-layering/check-static.mjs`；B1.4 | 两 checker focused 通过。 |
| N-6 | REVIEW_NOTE→BOUNDED_ACCEPTANCE；feature-specific message/identity、surface alias、generated note 均由各自 owner 保留，少量重复不扩成超级抽象。 | 两 integration module、notice、App assembly、generated note；B3/B4 | source census/focused 通过；复用扩大时另立设计。 |
| N-7 | CONFIRMED→FIXED_OFFLINE_CLEANUP；删除两个空壳 adapter 包，同步 graph/count/workspace/invariant/census/README，线下可恢复目录留存。 | graph/root `package.json`/`yarn.lock`/static tests；B0 | static 与线下目录核对通过；Git 仍由 Dexter 控制。 |
| N-8 | CONFIRMED→FIXED_SOURCE；test support 类型由 `ui/base/test-support` 转出，feature test 不隐式跨包导入 platform-ports。 | test-support、三 feature test/dependencies；B1/B4 | affected typecheck/import census 通过。 |

本轮新增的 REG-01（release `__DEV__=false` 下 descriptor 缺失导致 writer 不写 complete）不
改变上述评审计数；它已由运行期 descriptor 元数据与真实 fixture descriptor 修复，首败
及重验记录见 `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/focused-first-failure-n2.md`。

## 11.2 既有设计/计划 findings 逐条处置表

状态含义：FIXED_IN_DESIGN 表示已在本次详设/计划中写出闭合机制，但实现/evidence
仍 OPEN；ACCEPTED_BY_DEXTER 表示按已定案直接保留；BLOCKED 表示缺 fresh evidence
或未获 implementation/dynamic 授权，不是 PASS。

| finding | 处置 | 计划落点 | 证据/反例 |
| --- | --- | --- | --- |
| M-01 | ACCEPTED_BY_DEXTER；按 R-E1 删除 A/B/C | B1、B2 | assembly→adapter green；base→feature/integration/App red |
| M-02 | FIXED_IN_DESIGN；D-12 exact table | B4.2/U12 | AUTHENTICATION business；empty/mixed system |
| M-03 | FIXED_IN_DESIGN；两跳 child result + phase readback | B4.4/U13 | PF-01/PF-02 runtime injection；unconditional-return/ignored-result red |
| M-04 | FIXED_IN_DESIGN；native authority and all real inputs | B2.3/B2.4/U6/U12 | styles/Gradle/manifest/res mutation |
| M-05 | FIXED_IN_DESIGN；D-11 closed allowed differences | B2.4 | six root config closed form；extra diff red |
| M-06 | FIXED_IN_DESIGN；unique identity before write/single client | B3.2/U3/U4 | duplicate/missing/HMR and oracle-write red |
| M-07 | FIXED_IN_DESIGN；D-13A shared factory plus three feature module/assembly skeletons | B4.1 | missing skeleton/B2 dependency red |
| M-08 | FIXED_IN_DESIGN；fresh stage/whole/code↔design records | §9/CP-5 | absent/author-run/late dynamic blocked |
| M-09 | FIXED_IN_DESIGN；five executors have build steps/red/dynamic path | §7、B1–B4 | future files not claimed existing |
| S-01 | ACCEPTED_BY_DEXTER；pre-super registration | B2.3 | native mutation |
| S-02 | ACCEPTED_BY_DEXTER；PRIMARY physical surface | B2.5/U8-support | six fallback reasons red |
| S-03 | ACCEPTED_BY_DEXTER；R-S7 failure page | B3/U8 | no-ready final failure record |
| S-04 | FIXED_IN_DESIGN；selected D-5 path direct | B2→B3 | no alternative branch invented |
| S-05 | FIXED_IN_DESIGN；ready batch/focused negative | B2.5/B3.4/U8-support | fallback/outer layout mutation |
| S-06 | FIXED_IN_DESIGN；AST forms/App wiring | B1.4/B2/U5 | import-equals/type/re-export/dynamic red |
| S-07 | FIXED_IN_DESIGN；five factories + sample-console B3 | B1.2/B3.3 | descriptor-only red |
| S-08 | FIXED_IN_DESIGN；cancellable real U2 module | B1.3/B3.3/U2 | kernel runtime fake red |
| S-09 | FIXED_IN_DESIGN；omission→gate mapping | §7/§10 | each omitted surface has U or CP |
| S-10 | FIXED_IN_DESIGN；single writer console-assembly | B3.2/U4 | second writer red |
| S-11 | FIXED_IN_DESIGN；only claim covered failure paths | B3.2/U4 | resolver pre-event remains explicit OPEN |
| S-12 | FIXED_IN_DESIGN；identity/assets all native entrances | B2.3/B2.4/U6/U12 | app.json-only mutation red |
| S-13 | FIXED_IN_DESIGN；graph + package root cause in B0 | B0 | dependencies-only mutation red |
| S-14 | FIXED_IN_DESIGN；B4 graph/package depends only B1 | §1.2、§6.1 | no B2/B3 edge despite U10 |
| S-15 | FIXED_IN_DESIGN；README in B1/B2/B3/B4 census | B1.5, B2.1, B3.1, B4.1 | missing README red |
| S-16 | ACCEPTED_BY_DEXTER；cold restart request ended | B4.3/U12/PF-10 | no persistence restoration |
| S-17 | FIXED_IN_DESIGN；notice identities/behavior/testIDs | B4.3/U12 | three close paths and five IDs |
| S-18 | FIXED_IN_DESIGN；request lifecycle owner and child result | B4.2/B4.4/U13 | parent cannot completed on child failure |
| S-19 | FIXED_IN_DESIGN；literal stepwise D-9 | §8 | no screenshot-only closure |
| S-20 | FIXED_IN_DESIGN；self-check never PASS without evidence | metadata/CP-5 | current status OPEN |
| S-21 | FIXED_IN_DESIGN；atomic order/intermediate errors | B1–B4 tables | descriptor-first/runtime-missing red |
| S-22 | FIXED_IN_DESIGN；CP gate cards with five required fields | 详设 §11.1; plan §1/§9 | missing field or no fresh record blocks |
| N-01 | FIXED_IN_DESIGN；explicit three cross-batch edges | §1.3 | full graph record |
| N-02 | FIXED_IN_DESIGN；D-10 chooses real consumers/remove declarations | B2/B3 | declared-only bridge not retained |
| N-03 | FIXED_IN_DESIGN；旧 run-a9 已实跑确认不足，升级为新建 release cold-start runner | B2/B3/closure U8 | supporting probe 保留；新 runner 覆盖 release、双 App、真实双屏、splash timing、failure page、cleanup |
| N-04 | FIXED_IN_DESIGN；required capability/no-op forbidden | B2.2/U6 | no-op provider red |
| N-05 | FIXED_IN_DESIGN；native import/sideEffects/linking review | B2.3/B2.4 | preventAutoHide mutation |
| N-06 | FIXED_IN_DESIGN；production path not __DEV__-only | B3.5/U3/U8 | restore guard red |
| N-07 | FIXED_IN_DESIGN；existing sample.* names preserved | B4.3/U12 | event rename red |
| N-08 | FIXED_IN_DESIGN；nine categories and AUTHENTICATION table | B4.2/U12 | category mutation red |
| N-09 | FIXED_IN_DESIGN；button/backdrop/back unified close | B4.3/U12 | any path missing red |
| N-10 | FIXED_IN_DESIGN；real graph-model and actual foundation consumers only | B1/B3/handoff | nonexistent anchor is invalid |
| N-11 | FIXED_IN_DESIGN；review metadata and relative paths | metadata/handoff | no absolute path; exact REVIEW_TARGET |
| N-12 | CURRENT_INTAKE_COMPLETE；按每 CP、全批动态前、交付前留存 fresh 独立对账记录，并附 Nietzsche/Aristotle/Banach implementation review intake | §9.1/CP-5 | 当前 intake 已留存；Claude review 不替代 Codex fresh subagent，最终整批结论仍 OPEN |

### 11.2.1 历史 Round2 3M/6S/5N intake（基于 v3.6，已被当前源码状态 supersede）

本小节只保留历史 intake 轨迹；其中旧 release/cleanup 数字和旧 APK 记录不覆盖当前
源码，也不构成本轮 dynamic PASS。

下表逐条处置 `doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-plan-review-round2-claude.md` §2；它是实施顺序和证据责任的补充，不把计划文字当作源码或运行结果。

| finding | 处置 | 计划落点 | 证据/剩余验证 |
| --- | --- | --- | --- |
| M-1 | 按 v3.6 R-E6 删除 picker package.json 的错误 `kernel-base-platform-ports` devDependency；graph/dependencies.ts 不声明该 target，合法 `ui.base.test-support` dev edge 保留 | B0、§10 | `yarn install --immutable --mode=skip-build`、受影响包 typecheck 与 terminal static 当前均已绿；sample2 full acceptance 仍 OPEN |
| M-2 | 以详设 D-13A 的 `ui.base.feature-assembly` 为目标，三 feature 保留薄适配；不再引用 D-13 | B4.1、§10 | CP4 fresh stage `MATCHED_WITH_OPEN_EVIDENCE`；三 feature package typecheck/focused 已绿 |
| M-3 | 删除 B2/B3 子章节中的提前 release 说法；final release/双屏只在 B4 与 whole-scope 3D 后 | B2.3、B3.3、§9.4 | 历史记录曾有 supporting profile；不覆盖当前源码，当前 U8 release/双屏仍 OPEN |
| S-1 | same-platform adapter 仅作 R-E1 green；cross-platform adapter 进入 U5/U11 red mutation | B1.4/U5/U11 | checker proof OPEN |
| S-2 | 不再声称 graph-comparison/coverage 会发现 root workspace 漏项；独立 root workspace/Turbo dry-run 或 fresh review | B1.1、§10 | checker source 已核实；Turbo dry-run OPEN |
| S-3 | 旧 run-a9 已实跑确认不足，升级新建 record-only release cold-start runner | B2/U8、§10 | 旧 runner 与首败只作历史 supporting 记录；当前新 runner 尚未替当前源码产生 release/双屏结论，完整 sample2 acceptance 仍 OPEN |
| S-4 | `LayerEntry`/catalog 显式 durable/ephemeral；serialize 与旧 hydrate 都过滤 system notice，sample2 selection persistence 不变 | B4.3、U12/PF-06 | 机制已排期；源码/冷启 OPEN |
| S-5 | 计划 §8 直接复制详设 D-9：WP 正常旅途、PF failure injection 分栏且编号一致 | §8 | 文档已统一；动态 OPEN |
| S-6 | D-6 的 App discovery、空输入守卫、native resource compiler/aapt2 入口显式建造和验证 | B2.4/U6/U7 | 设计已补；checker/build proof OPEN |
| N-1 | full graph 与跨 batch edge 单独对账，batch=1 仅回归不作证据 | §1.3、B1.1 | static full graph PASS；独立复核 OPEN |
| N-2 | 增加 R-S7 专属 build/trigger/observed failure-page 步骤 | B2.3、B3.4、U8 | 历史 supporting failure-page 记录保留；当前源码绑定的 release/device evidence 仍 OPEN |
| N-3 | B0 也必须在 B1 前完成 fresh stage reconciliation；CP-0/§9 记录 | B0、B1.6、§9 | `cp0-stage-reconciliation-round4-current.md` 已留存；其结论仍明确 B0 sample2 full acceptance OPEN |
| N-4 | M-07 的错误 D-13 引用改为 D-13A | B4.1、§11.1 | 文档已改；source proof OPEN |
| N-5 | 删除无需求依据的 tsconfig integration-path 自由句 | B2.4、D-11 对账 | 文档已改；逐字 diff OPEN |
| S-NEW-1 | FIXED_IN_IMPLEMENTATION；assembly rejection 不再由 assembly 自绘，改用 App typed callback 注入 `ui.base.render.StandaloneStartupFailurePage`；统一 `startup-failure` hide reason | B2.2/B3.4/U8-support | 当前 render focused 为 12 files / 67 tests，两个 App typecheck；历史 mobile/dual release failure-page 记录不覆盖当前源码，当前 device evidence OPEN；旧首败保留 |

## 12. 交付、停止和最终 gate

### 12.1 实施与交付前

主 Codex 已按 Dexter 的一次性授权进入实现；交付前必须：

1. 检查详设/计划引用 v3.7、固定裁决和实际相对路径；
2. 留存 B0、B1、B2、B3、B4 各自的 fresh stage 3D reconciliation，并留存
   `whole-scope-reconciliation-main-agent-fallback-round14.md` 与
   `code-design-reconciliation-main-agent-current-round15.md`；Lagrange/Planck、Meitner/
   Hypatia 等受控停滞或未完成记录仅作诊断，不作为独立 verdict。按 Dexter 当前指令不再
   追加对抗式 reviewer；主 agent fallback 不冒充 `INDEPENDENT_SUBAGENT`，B0 full acceptance
   缺失边界仍保留；
3. 运行静态、focused、native、Android、release、Web（若实际执行）和 cleanup 各自的
   原始命令/日志，U1-U13 的 red mutation 与控制结果分开记录；
4. 生成 `doc/review/platform/` 下的
   `*-implementation-review-request-codex.md`，按
   `doc/platform/claude-review-handoff-template.md` 结构填写，并通过：
   `scripts/check/claude-review-handoff --file <relative-review-request>`；
5. 检查失败先保留首败和 broken boundary，根因修复后只重跑相应 focused 门；不以
   exit code、作者自报数字、旧 review 或静态绿替代动态/cleanup 证据。

### 12.2 implementation 开始条件

本轮 Dexter 已一次性授权 implementation、对应动态验证和 handoff；实现前置的规范要求
仍是 B0 sample2 冻结 acceptance 与 terminal static baseline，且任何下一 CP 前必须有
对应 fresh stage reconciliation。当前 B0 full acceptance 没有满足，因此本文明确记录
该计划前置未闭合；已经执行的动态仅是授权下的支持性诊断证据，不构成对前置的追认或
implementation acceptance。后续 implementation review 应把该 OPEN 作为硬边界处理。

### 12.3 结论状态

本计划当前为 `IMPLEMENTED;CURRENT_CODE_RECONCILIATION_MATCHED;EXTERNAL_REVIEW_PENDING`。
当前源码对应的 U8、sample1/sample2 normal release/mobile/dual 与 U13 focused 结果已留存，
历史 APK 或旧 runner result 不作为当前证据。sample2 完整 A1–A9/F-A、U13 完整 PF 设备
矩阵、Web、visual 和 Claude/Dexter implementation verdict 仍 OPEN；不能把局部 supporting
记录改写成整体验收。B0/B1/B2/B3/B4 stage 记录、主 agent fallback 全批对账和逐代码与
详设对账均已定位。

本轮实际动态记录是在 B0 focused/static 复核和源码/详设对账后取得的；由于当前记录仍未
覆盖 sample2 要求之外的完整 A1–A9/F-A acceptance，不能声称严格满足“B0 full acceptance
先行”的原始计划前置。该顺序差异和影响在 §9.4.1、fallback record 和最终 handoff 中
明示；所有动态结果按 supporting evidence 解释，不能反向关闭 B0。

## 13. 当前交付索引（2026-09-15）

本节覆盖此前章节中的“尚未运行”历史文字；历史首败不删除，当前字节以本节和所列
evidence 为准。

| 交付项 | 当前结果 | 证据 |
| --- | --- | --- |
| static / focused / red mutation | PASS（串行）；并发 race 与 cache 首败已留痕 | `u1-u13-current-red-green-20260915.md`、`static-current-reverification-round2.md`、`startup-diagnostics-current-round2.md`、`u8-focused-current-round2.md` |
| native projection / Android release build | supporting PASS；两个 APK 均 `BUILD SUCCESSFUL` 并有 sha256/bytes | `release-build-current-source-20260915.md` |
| U8 normal release cold start | 2 App × mobile/dual 均 `business=PASS;cleanup=PASS` | `u8-release-cold-start-current-source-rerun-20260915.md` |
| U8 R-S7 wrong-primary mutation | 两个 App dual 均 `business=PASS;cleanup=PASS`，failure page/splash 记录存在 | `u8-release-wrong-primary-current-source-rerun-20260915.md` |
| sample1 U10 normal | mobile/dual 当前 APK 均 `business=PASS;cleanup=PASS` | `sample1-frozen-current-source-normal-20260915.md` |
| sample2 U10 normal | mobile/dual 当前 APK 均 `business=PASS;cleanup=PASS` | `sample2-frozen-current-source-normal-20260915.md` |
| U13 | 真实 runtime child injection 16 focused tests PASS；四条核心写入相位路径已断言 | `u13-runtime-evidence.md`、`u1-u13-current-red-green-20260915.md` |
| 旧文件线下处理 | 两个空壳 adapter 与生成缓存按日期目录移出，仓内不存在 | `obsolete-file-cleanup-round2.md` |
| whole-scope three-dimensional reconciliation | 主 agent fallback `MATCHED`（不是 independent verdict）；动态/外部 acceptance 仍 OPEN | `whole-scope-reconciliation-main-agent-fallback-round14.md` |
| code↔design | 主 agent `MATCHED` | `code-design-reconciliation-main-agent-current-round15.md` |

### 13.1 交接边界

本计划可以交给 Dexter/Claude 做 `REVIEW_TARGET=IMPLEMENTATION` 复核，但交接文案必须
明确：没有宣称 implementation review GO、Web PASS、visual PASS 或整体 acceptance PASS；
sample2 完整 A1–A9/F-A 与 U13 全量 PF 设备矩阵仍列为 OPEN。交接文件必须使用仓库根相对
路径并通过 `scripts/check/claude-review-handoff`。
