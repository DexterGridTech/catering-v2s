# TER sample 基础设施上收 · 详设与 B1–B4 实施计划评审

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_KIND=Codex 与 Claude 经 Dexter 中转的独立对抗评审(轮次由 Dexter 决定,见 AGENTS.md:72)
REVIEW_ROUND=1(仅作序号)
reviewerKind=INDEPENDENT_SUBAGENT(5 个 fresh 子 agent 分维度盲审)+ 编排会话合并与亲验
EVIDENCE_TIER=static;外部事实取自官方一手资料;未执行任何项目门、测试、构建、Metro、Web、Android、设备或 git
被审输入(sha256 前缀):
  详设  doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md  93f82be07973
  计划  doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md  46e2728f601a
  需求  doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md  848873032bd2(Dexter 已 GO)
评审请求:doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-review-request-codex.md(只在最后用于核对覆盖声明)
```

下文【详设】【计划】【需求】指上列三份文档,冒号后为行号;owning source 用仓库相对路径。

## 0. 结论块

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=9/22/12
L1_ENGINEERING=findings:M-01、M-04、M-05、M-06、M-07、M-08、M-09;S-04 至 S-15、S-20 至 S-22
L2_USER_VISIBLE=findings:M-02、M-03;S-01、S-02、S-03、S-16、S-17、S-18、S-19
L3_UNVERIFIED=见 §7「无人验证」
SAME_ROOT_SCAN=见 §4
DESIGN_GAPS=见 §9(需求侧勘误)与 §8(需 Dexter 裁决)
EVIDENCE_TIER=static + 官方一手资料;本评审不构成 implementation acceptance,也不构成 visual、Web 或 release PASS
```

## 1. 评审方式与独立性

- **分维度盲审**:5 个 fresh 子 agent 各负责一个维度——A 依赖图与运行期依赖(D-1 至 D-4、D-10);B 开机画面与 release 证据(D-5、D-13、U8);C 身份、资产、根配置与启动诊断(D-6、D-7、D-11);D picker 与回归矩阵(D-9、D-12、D-14);E 计划完整性、证据纪律、授权与整体方案合理性。
- **阅读顺序**:每个子 agent 先读 CLAUDE.md、评审规程、严重度规则、需求全文与本维度 owning source,在自己的笔记里写下"合格的详设必须写出什么",之后才读详设与计划;评审请求只在最后用于核对覆盖声明。全程只读,未运行任何项目门、测试、构建、设备或 git。
- **编排与亲验**:编排会话在子 agent 返回后,重开被审文档与 owning source 的对应位置逐条核实;外部事实经 Expo、androidx 与 Android 官方资料核实。重复 finding 合并时保留较高严重度。
- **利益披露**:编排会话是需求稿的作者。需求侧问题(M-01、S-01、S-02 等)的判定来自独立子 agent,作者只在 §9 做处置,不代写 verdict。

## 2. 动作 1-B 提取

**模板缺项**
- 模板 §4 的每 CP 门控整节缺失:FORBID、RECALL、不变量、形态理由在详设与计划中均 0 命中(S-22)。
- 模板 §5 operation 表、§6 跨 owner 矩阵没有独立 N/A 节;详设 §8 缺"日志与脱敏"机制行。

**文档间矛盾**
- B4 依赖:【需求】:434"依赖 B1";【详设】:131、【计划】:366 为 B1 + B3 + B2(S-14)。
- 批次顺序与裁决点:【计划】§1.1 与 §1.2 互相矛盾(S-04)。
- 唯一写入端住址:【需求】§3.3、【计划】:190 与【计划】:221、【详设】:593、:677 互相矛盾(S-10)。
- 分类表:【详设】§4.8 与自己的 WP-07、PF-07 冲突(M-02)。
- 基线修复:B0 已清首败,B1 又修一次(S-13)。
- 执行体:D-8 声明的 `check-base-boundaries`、`check-diagnostics` 在计划各批无建造步骤(M-09)。
- sample-console:【需求】:433 要求补齐为运行期模块,【详设】:274、【计划】:257 把"无 factory"固化成反例(S-07)。

**无出处数值**
- `~57.0.9`(【详设】:283)、`icon_preferred`(【详设】:105)无引用;360×640 / 720×1280 出处在 sample2 需求但文中未引;"本文保留 18 行"实为 17 行;`scripts/terminal/acceptance.mjs` 所在目录不存在。

## 3. Findings

### M-01 需求 §3.0 与 §3.1、U5 硬冲突,阻断 B2

- **状态**:CONFIRMED;来源 A.M1、E.N1;需 Dexter 一句话确认需求勘误(不是产品裁决)。
- **位置**:
  - 【需求】:247 禁止 base 依赖"android 层级",:256-263 的核验脚本按 moduleName 第二段取层级;§3.1 表把 adapter 接线放进 `assembly/base/android`;U5 :471 要求接线只在 base。
  - `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts:11-13` 必须 import adapter 工厂,而 `adapter.android.device` 的第二段恰为 `android`。
  - 【详设】§0.3 :53-71 如实上报,但 A/B/C 三选项有误导(B 违反 U5,C 违反需求"adapter 实现 → assembly 绑定"的既有通道),缺最窄修订与推荐项;【详设】:224 把字面禁令冻结进 D-1 规则。
- **失败场景**:按字面实施,D-1 检查器使 B2 永远红;按 B 或 C 实施,违反 U5 或扩大范围。
- **最小修复**:需求勘误——禁止目标限于 feature / integration 层级与 App 包(`assembly/android/*`);`assembly.base.<平台>` 依赖 `adapter.<平台>.*` 属 §3.1 接线本体。D-1 用通用谓词放行(源层 = assembly、目标层 = adapter、目标层级 = 源名称),不写包名。既有分层门已允许 assembly → adapter(`tools/terminal-layering/check-static.mjs:135-140`)。详设 §0.3 改为只求这一条勘误。

### M-02 D-12 分类表反转现行语义,sample1 必然回归

- **状态**:CONFIRMED;来源 D.M2、E.M1;不需 Dexter(AUTHORIZATION 归类除外,见 N-08)。
- **位置**:【详设】§4.8 :410-411 规定只有 `partial-failed` 可判业务失败,`error` 一律判系统失败;【计划】§6.2 :382 要求"严格执行"。现行 `requestOutcome.ts` 在非 completed / running 时按错误类目判定、不看状态;`apps/terminal/kernel/base/runtime/src/foundations/aggregateCommandStatus.ts:26-31` 在全部 actor 失败时返回 `error`。
- **失败场景**:口令错误(AUTHENTICATION,单 actor → `error`)变成系统提示且口令不重置;未选壁纸就确认(BUSINESS)也弹系统提示;与详设自己的 WP-07、PF-07 矛盾;S1-02 只断言"错误 notice 打开",漏检。
- **最小修复**:分类表与现行函数逐行等价;PF-07、S1-02 断言 PRIMARY 的精确层集合。

### M-03 picker 两跳派发未分析,入口修复不闭合缺陷

- **状态**:CONFIRMED(写入后账本失败的运行期场景为推论,UNVERIFIED_REQUIRES_EVIDENCE);来源 D.M1。
- **位置**:【详设】§4.10.2 :453-462 只修入口;【详设】U13 :508、§7.3 :565 与【计划】§6.4 :416-418 的注入点可由假 dispatch 满足。`apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts:27,34` 用 `await context.dispatchCommand(...)` 派发 kernel 子命令后直接 `return null`,子命令结果被丢弃;父命令只按自己的 actor 结果聚合。
- **失败场景**:① kernel 子命令失败 → picker actor 仍返回 null → 入口拿到 completed → 用户无反馈,缺陷换一跳复现;② 子命令已写入后父命令终态失败 → 入口提示"操作没有完成",壁纸却已改变,R-P5"已确认壁纸不变"不成立。
- **最小修复**:补"失败点 × 结果形态"表,每格写期望 state 与提示;写明 picker actor 如何处理子命令的非 completed 结果(向上传播,或证明不可达);U13 至少一例经真实 runtime + ui-state + sample2 catalog 注入。
- **Dexter**:若写入后失败的呈现需要改 R-P5 字面,见 §8。

### M-04 D-6 身份权威源与所选原生集成方式矛盾,投影漏掉 Android 真实入口

- **状态**:CONFIRMED;来源 C.M1。
- **位置**:【详设】:292-295 推荐沿用已提交原生工程,:338-344 却仍以 `app.json` 为名称、图标与包名权威;【详设】:501 与【计划】:324-325 的检查输入只有 app.json、Gradle、Kotlin package 与 manifest。两个 App 的 `android/app/build.gradle:90,92` 手写 namespace / applicationId;`AndroidManifest.xml:14` 取 `@string/app_name`、`@mipmap/ic_launcher`、`@mipmap/ic_launcher_round`,没有 `package=`;`strings.xml:2`、`settings.gradle:34`(rootProject.name);gradle 与 settings 对 app.json、resValue、manifestPlaceholders 的引用为 0。
- **失败场景**:App 按"权威源"改 `app.json` 的名称或图标——恰是 Dexter §0.1 点名保留的自主权——检查器全绿,APK 不变;把 `strings.xml` 的 app_name 改成与另一 App 相同,无人检查。
- **最小修复**:在已提交原生工程前提下,逐项声明原生构建实际读取的唯一入口(名称、图标、adaptive 背景色、开机画面)并纳入投影;或改选 CNG 让 `app.json` 真正生成原生工程。二者择一且须与 D-5 一致,属详设权限(见 S-04)。

### M-05 D-11 / U12 共享投影:允许差异被自行扩大、判定未定义、文件集开放、机制是占位

- **状态**:CONFIRMED;来源 C.M2、C.S4。
- **位置**:【详设】:390-392 给 babel 留"确有差异的 entry"、给 tsconfig 留"App-specific include"、给 global.d.ts 留"App-only ambient declaration";:397、:507 只写"semantic helper projection for exactly six files"。【需求】§3.1 只允许 integration `global.css` 路径、tailwind content 与主题取值(含 darkMode)。两个 App 的 babel、tsconfig、global.d.ts `diff` 退出码均为 0。
- **失败场景**:App 往 babel 加私有 plugin 即算合规;在六个文件之外另起配置面(`.babelrc`、package.json 的 babel 键、`app.config.*`),检查看不见;metro 的 `NODE_PATH` / `Module._initPaths` 补丁须早于 `require('expo/metro-config')`,详设 0 命中;nativewind-env.d.ts 已漂移而处置未定;根配置不进包图,漏声明构建依赖时没有门会红。
- **最小修复**:允许差异登记表 = 需求 §3.1 所列,三个相同文件登记为"无差异";判定写成封闭形态(顶层只调用 base helper、实参只含登记键;tsconfig 只允许 extends);加根目录封闭 census;逐文件写明机制与构建依赖声明位置。

### M-06 D-7 / U4 的 oracle 以不唯一的 startupRunId 为键,日志来源未定义

- **状态**:CONFIRMED(HMR 成因细节为推论);来源 C.M3。
- **位置**:【详设】:361-367 按 runId 判"complete 恰好一次、无旧 run 串入",:372-379 把成因推给 B3 并列 5 个假设。`apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts:49-53`:runId = 毫秒时间戳 + 模块级计数器,仅 `__DEV__` 下创建;sequence 逐条自增;写过 complete 即封口。日志 `apps/terminal/ui/integration/sample-console/.expo/dev/logs/start.log` 中重复 run `terminal-startup-1789204021803-8` 共 22 条,sequence 1–11 各出现两次,即两个 tracker 共用同一 runId;日志含 112 行 web 客户端事件,是多客户端汇总流。详设假设 1、2 已被源码证伪。
- **失败场景**:验收时 Metro 挂着两个客户端,"每个 runId 恰好一次"误红,或诱导实施方去重(需求禁止);旧 run 串入无法判定。
- **最小修复**:B3 契约使每个 tracker 的 run 身份唯一并携带客户端 / App 归属;oracle 读单客户端 sink,不读 Metro 汇总日志;显式处理 HMR。

### M-07 需求 B4 的 ui/feature module.ts / assembly.ts 骨架上收整项丢失

- **状态**:CONFIRMED;来源 E.M2。
- **位置**:【需求】:373、:434;【详设】:131 与【计划】§6 :362-421 只有 requestOutcome、notice、picker;检索"组装骨架、骨架上收、feature module、assembly.ts 的形状"无落点,也不在【详设】§15 未决项或【需求】§6 不做清单。
- **失败场景**:按计划交付即少一项批准范围;对账分母不含它,对账也查不出。
- **最小修复**:补落点(目标包、API、3 个消费者、U 映射、测试、对账范围),或明确请 Dexter 删去该范围。

### M-08 三类对账由作者执行,且排在动态运行之后

- **状态**:CONFIRMED;来源 E.M3。
- **位置**:【计划】§9.1 :494-507、§8 :448-449 与【详设】§16.1 :743-750 的执行者均为主 Codex,没有"修复后交另一 fresh 子 agent 复查"的回路;B2 批内的 release 冷启动与 B4 批内的 U10 全旅途都早于全批对账。`AGENTS.md:59` 规定步骤结束、下一步骤开始前必须由 fresh 独立子 agent 做三维对账,全部步骤后、整体测试前再做全批对账;`project-memory/operations/execution-economics-and-failure-family-closure.md` 登记了 `RECONCILIATION_BEFORE_FIRST_DYNAMIC_RUN`。逐代码对账分母是预设领域清单,漏了 app.json、splash 依赖、terminal-invariants、verify-static 接线、README 与 M-07 那项。
- **最小修复**:三类对账改由 fresh 独立子 agent 执行并留痕;动态运行移到对应对账之后;逐代码对账分母取实施实际触及的文件全集。

### M-09 D-8 有 5 个执行体既不存在也无建造步骤,且无动态授权路径

- **状态**:CONFIRMED(U8 判别观察的可行性为 UNVERIFIED_REQUIRES_EVIDENCE);来源 E.M4、D.S1。
- **位置**:
  - `check-base-boundaries`(【详设】5 处、【计划】0 处)、`check-diagnostics`(【详设】3 处、【计划】0 处);U8 的 `scripts/terminal/acceptance.mjs`,其目录 `scripts/terminal/` 不存在;U10 的 journey runner 与 U13 的失败注入矩阵同样无建造步骤。
  - 【计划】头 `DYNAMIC_AUTHORIZATION=NONE` 且无申请步骤,【计划】§10 收口条件 6–8 不可达;未引先例 `tools/terminal-sample2/run-a9-runtime.mjs`。
  - U13 双形态注入无 seam:两个 `test-expo/App.tsx` 没有注入口,TR-08 又禁止生产代码保留调试面。
  - U8 未写如何区分"就绪前被自动收起"与"就绪后收起"。
- **最小修复**:每个执行体落到具体批次的建造步骤;runner 写清受管入口、日志与 cleanup、判别观察和 red mutation,并前置【详设】§3a 的 UI / testID 复核;U13 写明编译期剔除的注入 seam 与必须跑真实形态的用例。
- **Dexter**:动态 / 设备运行授权;受管 runner 与复用先例二选一(§8)。

### S-01 SDK 57 原生注册顺序写反(源头在需求 §3.2)

- **状态**:CONFIRMED(崩溃后果为推论,UNVERIFIED_REQUIRES_EVIDENCE);来源 B.S1。
- **位置**:【详设】:106-108、:285-286 与【计划】:312 写"在 super.onCreate(null) 后注册",源自【需求】:329 的事实行。外部事实:`@expo/config-plugins` 的 `generateCode.ts` 中 `addLines` 执行 `lines.splice(lineIndex + offset, 0, newLine)`,`offset` 为 0 时插在锚点行之前;Android 迁移文档原文 "Call `installSplashScreen` in the starting activity before calling `super.onCreate()`" 与 "Create a theme with a parent of `Theme.SplashScreen`"。
- **失败场景**:注释掉 setTheme 后在 super.onCreate 之后注册,推论冷启动崩溃;保留 setTheme 则 postSplashScreenTheme 链失效。
- **最小修复**:改为在 super.onCreate 之前注册、注释 setTheme、由 postSplashScreenTheme 切回 AppTheme;需求侧勘误见 §9 R-E2。

### S-02 R-S1 就绪定义不完整:"PRIMARY" 未消歧、fallback 只排除 2 / 6

- **状态**:CONFIRMED;来源 B.S2。
- **位置**:【详设】:301-304、【计划】:316,源自【需求】R-S1 :306。`apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts:5-9` 在 VICE + SLAVE 时把 0 号屏判为 SECONDARY,:57-62 让 SLAVE 单屏随电源翻转角色;`SurfaceRoot.tsx:29` 无 host 快照时 isHostPrimaryDisplay 恒为 false;`resolvePart.ts:13-19,80-125` 另有 missing-catalog-entry、incompatible-catalog-entry、missing-renderer、invalid-props 四种 fallback。
- **失败场景**:单屏 SLAVE / VICE 设备冷启动时开机画面永不收起;冷启动恢复出的 placement 引用已删除的 part 时,开机画面收起到空白屏上。
- **最小修复**:PRIMARY 定义为开机画面覆盖的主 Activity 表面,并写明 render 如何取得;任何 RenderFallback 都不算就绪。需求侧勘误见 R-E3。

### S-03 就绪永远到不了时的行为未定义

- **状态**:DEXTER_DECISION(入口事实 CONFIRMED);来源 B.S3。
- **位置**:`App.tsx:26-30` 的 `void getAssembly(...).then(...)` 无 catch;`sample-wallpaper-console/src/assembly/assembly.tsx:216-217` 在 runtime 未启动时 throw;host 快照迟迟不到;持久 fallback 与 S-02 情形。详设、计划与需求 R-S1 均未规定。
- **失败场景**:`preventAutoHideAsync` 已调用,开机画面永久停留,用户无任何反馈。
- **候选**:① 严格永不收起;② 终态失败时收起并显示失败面(评审推荐);③ 有上限的超时。见 §8。

### S-04 D-5、D-10 与原生集成方式本属详设决定却转交 Dexter,计划两分支且裁决点顺序自相矛盾

- **状态**:CONFIRMED;来源 B.S4、E.S1。
- **位置**:【需求】R-S6 已写"具体走哪条由 D-5 定",§8 写"待 Dexter 裁决:无"。【详设】:133-136、:478、:483、:728 与【计划】§1.1 :50-67(B3 → 裁决 → B2)、§1.2 :70-79(选 port 则 B2 必须先于 B3,且"不能先按 direct injection 修改 render")矛盾。开机画面收起只依赖 npm 包,与 §0.3 的 adapter 接线冲突无关,【详设】:315-316、:429 却把两者绑在一起。
- **最小修复**:详设直接定 D-5 = 能力注入(详设已论证),D-10 按 §3.1 硬约束 2 处置,原生集成方式与 M-04 一致地择一;计划收成单一序列。

### S-05 就绪机制无批次落点,也无 focused 执行体

- **状态**:CONFIRMED;来源 B.S5。
- **位置**:【计划】B3 落点与测试 :182-264 没有就绪条目;B2 §5.4 只是目标,§5.7 的负向时序观察在真机上不可靠;【详设】U8 :503 只有 release run 与原生静态检查;能力贯通路径没有文件清单。
- **最小修复**:指定一个批次承担就绪观察与能力贯通;为 host pending、6 种 fallback、外层 root、非主屏表面、SLAVE / VICE、幂等各写 focused 反向变异(render 包已有 vitest 与 react-test-renderer);release 真机作最终时序证据。

### S-06 base 边界检查器:形态覆盖缺口、App 侧无执行体、计划无建造步骤

- **状态**:CONFIRMED;来源 A.S1、A.S5。
- **位置**:【详设】:217-223 的扫描集是目录白名单,缺 `import('pkg').T`、`import x = require()`、非字面量说明符判红与 .js / .cjs / .mjs;现有 `tools/terminal-shared/import-capabilities.mjs:14-63` 已覆盖类型位置导入、`import()`、`require()`,只缺 `import x = require()`。D-1 只扫 `*/base/*`(:217),U5 行(:500)却称其扫 App 全源;现有门对 App 出边放行。
- **失败场景**:共享 helper 放在 `config/metro.cjs` 里 `require` 集成包,不在扫描集;App 经 `../../../adapter/android/device/src` 相对路径,或经 base 转导出的 adapter 工厂接线,全绿。
- **最小修复**:扫描改为包全树减构建产物;扩展既有收集器,不另写第三个;为 `assembly.<非 base>.*` 加"不得指向 adapter"与"base 不得转导出 adapter 符号"两条;计划写明 B3 建检查器、B2 补 `assembly.base.android` 夹具。

### S-07 D-4 消费者全集不全,sample-console 契约与需求 B3 反向

- **状态**:CONFIRMED(删 descriptor 后启动抛错由 resolver 源码推出,未运行);来源 A.S2。
- **位置**:
  - 以下 5 个工厂直接 `dependencyModuleNames.map`,依赖含 contracts / platform-ports / state,全靠两份伪造 descriptor 才通过:`apps/terminal/kernel/base/display-context/src/application/createDisplayContextModule.ts:28`、`apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts:128`、`apps/terminal/kernel/feature/sample-member-registry/src/application/module.ts:38`、`apps/terminal/kernel/feature/sample-staff-session/src/application/module.ts:39`、`apps/terminal/kernel/feature/sample-wallpaper/src/application/module.ts:16`。
  - 【计划】B1 :138-141 只删 3 个 feature 排除清单,B3 :210 删 descriptor,全程未把这 5 个工厂切到派生子集。
  - 【需求】:233、:433 要求 sample-console 在 B3 补齐为运行期模块,【详设】:274、【计划】:257 却把"sample-console 无 factory"固化成反例;"声明为非运行期却导出工厂"没有 oracle。
- **失败场景**:按计划做完 B3,两个 console 启动抛 `Missing required runtime module dependency`;新运行期包照抄 `false` 样板时,依赖被静默丢弃。
- **最小修复**:列出全集并入 B1 原子组;检查器加"导出工厂 ⇔ 声明为运行期模块"及翻转红夹具;删掉 sample-console 反例,补其 module 与 placement actor 落点。需求侧勘误见 R-E5。

### S-08 U2 夹具首选的包无法被取消注册

- **状态**:CONFIRMED;来源 A.S3。
- **位置**:【详设】:271、:497 首选 `kernel.base.runtime`;`apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:186-196` 以 `[internalModule, ...input.modules]` 无条件注册内部模块。
- **最小修复**:改为从 console 的 modules 中移除 `createDisplayContextModule()` 这类可取消注册的真实运行期模块,断言 createRuntime 抛 missing required。

### S-09 D-2 缺"遗漏 → 门"映射,计划声称的红路径不存在

- **状态**:CONFIRMED;来源 A.S4、E.S4、B.N4。
- **位置**:【详设】:475 只写"每项遗漏由 checker/实施 review 明示";【计划】:352 称"漏加 workspace → census/entry 红",不成立——census 遍历文件系统(`tools/terminal-skeleton/graph-model.mjs:199-222`),漏 root workspace 只在 Turbo dry-run 暴露;turbo 在详设与计划中 0 命中;entry 可达性名单硬编码在 `tools/terminal-skeleton/check-static.mjs:172-175`,【详设】:200 未给判定谓词,若按 `assembly.*` 全集遍历,`assembly.base.android` 会被 entryFile 判红。
- **最小修复**:补"登记 → 首个红门 → 抓不到由谁兜"逐项表并配 red mutation;可达性谓词定为"层 = assembly 且层级 ≠ base",以随机名的第三个 App 作红夹具。

### S-10 U3 唯一写入端住址前后矛盾,既有测试以 helper 直写

- **状态**:CONFIRMED;来源 C.S1、E.S5。
- **位置**:【计划】:190(console-assembly)与【计划】:220-222、【详设】:677(createPlatformPorts.ts)、【详设】:593("each App writer")互相冲突;【需求】§3.3 归 `ui/base/console-assembly`。真实写入在两份 `assembly.tsx`,`createPlatformPorts.ts` 只是消费端;`apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts:42-56` 直接 `ports.logger.info` 写 surfaces 事件,正是需求点名的 helper 捷径,文档未处置。
- **最小修复**:统一为 console-assembly 单写入端;定义事件归属字段;指定 onLayout 会真实触发的 harness。

### S-11 "failure / finally 有明确终态"无生产依据

- **状态**:CONFIRMED;来源 C.S2。
- **位置**:【详设】:368、:713 与【计划】:262;`startup.failed` 全仓只在 `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:432` 发射;resolveModuleOrder 在任何 startup 事件之前抛出;assembly 的各 throw 点与 `App.tsx` 都不写终态。
- **最小修复**:写死"没有 complete 即判 FAIL",按实际发射点列失败夹具;若要新增终态发射点,超出【需求】§6"不新增诊断面",须 Dexter 授权。

### S-12 身份 / 资产检查器作用域不可执行

- **状态**:CONFIRMED;来源 C.S3。
- **位置**:【详设】:349 未写 App 发现规则、空输入守卫与排除 `assembly/base/android`;:352"README 登记"无格式;WP 的 `assets/README.md` 自身在 assets/ 下如何处理未写;:354 选定删除 ST 孤儿资产,:502 又写"或登记";"被原生资源引用"是空类别;未写逐个 .kt 文件检查;【需求】D-6 追问的"原生 drawable 是否由资源编译兜底"未回答。
- **最小修复**:写明发现规则与守卫、登记格式、孤儿的唯一处置、逐文件检查范围,并回答 drawable 兜底问题。

### S-13 B0 修错对象,静态基线不会变绿

- **状态**:CONFIRMED;来源 D.S6、E.S3。
- **位置**:【计划】§0.1 :31-36、§2.1 :95-96、§2.4 :119 只对齐 `src/dependencies.ts`。首败比较的是 package.json 与 graph(`tools/terminal-skeleton/check-static.mjs:233-237`):picker 节点 `apps/terminal/skeleton-graph.ts:163` 的 devDependencies 为空,package.json 却声明了 `kernel-base-platform-ports`;该包只在 `test/` 被导入,门只扫 `src/` 与 `test-expo/`(`graph-model.mjs:272-274`),只补 graph 则 `:251-252` 仍红;B1 :154 又重复修一次。
- **最小修复**:B0 以默认静态检查通过为收口,修复对象按根因确定(graph 与 package.json 的该条声明须一并处置);删除 B1 的重复修复。需求侧勘误见 R-E6。

### S-14 B4 依赖被扩大,picker 修复被原生工作阻塞

- **状态**:CONFIRMED;来源 E.S2。
- **位置**:【需求】:434"依赖 B1";【详设】:131、【计划】:366 为 B1 + B3 + B2。
- **最小修复**:B4 只依赖 B1;U10 全回归作为跨批最终门。

### S-15 TR-10 README 未进计划

- **状态**:CONFIRMED;来源 E.S6。
- **位置**:`doc/platform/terminal-coding-standard.md:401` 要求每个包有中文 README;两个新包无 README 步骤;B1 改动 31 个包的公开面也未列 README 同步;【计划】中 README 仅出现 1 次(资产登记)。
- **最小修复**:两个新包建 README,受影响包同步,并纳入对账分母。

### S-16 system notice 冷重启恢复与多次失败呈现未裁决

- **状态**:DEXTER_DECISION(事实 CONFIRMED);来源 D.S2。
- **位置**:【详设】PF-05 :574 只写条件句;【需求】D-14 要求写清。`apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts:265-272` 的 serializeLayers 不按 part 过滤,三个 system notice 重启后必然恢复(含 sample1 两个);同一 layerId 再次打开在 `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts:258` 抛 duplicate,入口只吞 rejection,第二次失败被静默吞掉。
- **最小修复**:按 §8 的裁决写死恢复规则,并补叠放与去重规则。

### S-17 notice 身份与可见行为钉得不全,详设 §3a 陈述不属实

- **状态**:CONFIRMED;来源 D.S3。
- **位置**:【详设】§7.1 :537-540、【计划】§6.4 :414 只钉 `:message` / `:dismiss`。sample1 两个 notice 各有 5 个 testID,"系统提示""知道了""关闭系统提示"文案、alert role 与 card 布局,part description 各不相同;【详设】§3a :174 称 sample1 已有 `*TestIds.ts`,全仓实际只有 picker 与 admin-shell 各一份;【详设】:435 让 base body 负责"原因文本",与 sample1 交互设计"props 不得带原始 error"冲突;picker notice 缺 tier、surfaceForm、title、description 与 3 个 testID。
- **最小修复**:以测试内字面量冻结 3 × 5 个 testID、文案、a11y 与 part 元数据;删掉 §3a 的错误陈述。

### S-18 入口请求生命周期未定义,与 sample1 参照冲突

- **状态**:CONFIRMED;来源 D.S4。
- **位置**:【详设】PF-02 :571 要求 rejection 不冒泡;sample1 四个入口在 catch 后 `throw error`(如 `apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLogin.tsx:86-90`),测试断言 `.rejects`;`apps/terminal/ui/base/primitives/src/components/PrimitiveButton.tsx:53-54` 丢弃 onPress 返回值;守卫粒度未定义;没有"失败 → 关闭 → 重试成功"这一步。
- **最小修复**:写定上抛还是吞掉、守卫粒度、在途可用态与文案;U13 加"重试成功"一步。

### S-19 U10 矩阵不是逐步,存在委托

- **状态**:CONFIRMED;来源 D.S5。
- **位置**:【详设】§7.1 没有 sample1 冷重启行,缺撤回确认、放弃草稿确认、顾客年龄 S-30~33 与 S-9,S1-08"form abandon"对不上冻结出口;§7.2 的 WP-05 / 09 / 13 以"与 sample2 §9""all frozen keys"代替 state,缺 `sample.wallpaper-console.waiting` / `welcome` 字面量;全表只断言存在,不断言精确层集合。
- **最小修复**:按冻结权威逐步补齐,每步写字面 partKey、层集合与 selector 值。

### S-20 自检表过度声称

- **状态**:CONFIRMED;来源 E.S7。
- **位置**:【详设】:779 称"D-1 至 D-14 全覆盖 MATCHED",实际 D-12 完备性延后、D-14"多个 feature 同时失败"0 命中、notice 恢复只写条件句、D-7 成因延后,另见 S-02、S-05;:778"本文保留 18 行"实为 17 行。
- **最小修复**:按实际状态改为 OPEN 并列出缺口。

### S-21 原子组缺组内顺序与预期中间报错

- **状态**:CONFIRMED;来源 E.S8。
- **位置**:【计划】§1.3 :81-89;`doc/platform/foundation-charter.md` §5-C(:383、:390)要求原子组写出中途预期报错原文且必须验证过;runtime 原子组在 B1 改 resolver 与 31 个包,integration 侧排除清单与伪造 descriptor 却留到 B3,中间态未定义(与 S-07 同根)。
- **最小修复**:逐组写顺序、预期报错原文与验证方式。

### S-22 模板 §4 每 CP 门控缺失

- **状态**:CONFIRMED;来源 E.S9。
- **位置**:`doc/decisions/templates/implementation-design-template.md:129-134` 要求 FORBID 与 RECALL;详设与计划的命中数均为 0,不变量与形态理由同样缺失。
- **最小修复**:每个 CP 补 FORBID、RECALL、不变量与形态理由。

### Notes

- **N-01**:【需求】D-3 要求详设列出新增跨 batch 边,【详设】:203-205 推迟到实施记录。按本设计必然新增 3 条:两个 `assembly.android.*`(batch 1)→ `assembly.base.android`(batch 2),`ui.integration.sample-console`(batch 1)→ `ui.base.console-assembly`(batch 2)。(A.N1)
- **N-02**:D-10(【详设】:483)把 logger 绑到 D-5 的桥上;两个 adapter 包的 `src/index.ts` 只导出 moduleName 与依赖清单,选"接线"等于新写原生实现,成本未披露;【需求】§3.1 硬约束 2"不得只声明不使用"无核验,`src/dependencies.ts` 的 import 被门当作使用。(A.N2)
- **N-03**:U8 未写明"两个 App × 两种形态";观察手段未定——API 31+ 下开机画面视图转入 App 窗口,`dumpsys window` 未必看得到,应先以"删除 prevent"的反向变异证明所选手段可观测。(B.N1)
- **N-04**:能力为可选注入、缺省 no-op(【详设】:306-307):Android 路径漏传不会报类型错,而是开机画面永久停留;缺"唯一生产者是 `assembly/base/android`、下游只透传"的不变量。(B.N2)
- **N-05**:`preventAutoHideAsync` 的模块与导入链未落定(【详设】:284),缺 sideEffects / tree shaking 约束;原生模块未链接时 prevent 与 hide 会静默失效;MainActivity 直接 import `SplashScreenManager` 而依赖只声明在 base 包,autolinking 能否传递解析为 UNVERIFIED。(B.N3)
- **N-06**:U3 / U4 的证据只能取自开发构建——`__DEV__` 为假时不建 tracker(`createPlatformPorts.ts:49`),release 零启动事件;文档未写证据环境。(C.N1)
- **N-07**:上收到 base 的事件仍叫 `sample.*`,命名去留未定(【计划】:225-229)。(C.N2)
- **N-08**:D-12 完备性推迟到实施期:`apps/terminal/kernel/base/contracts/src/types/error.ts:3-12` 共 9 个类目,AUTHORIZATION 等归类未回答,也未要求按类目穷尽映射。若要把 AUTHORIZATION 归为业务失败,属 Dexter 裁决。(D.N1)
- **N-09**:每个 notice 有三条关闭路径(`:dismiss`、遮罩与返回键,见 `apps/terminal/ui/base/render/src/components/LayerStack.tsx:175-181`),PF-06 只覆盖第一条;【详设】:151 的"actor dedup"实际是抛 duplicate。(D.N2)
- **N-10**:锚点与引用错误:`projectSkeletonGraph` 在 `tools/terminal-skeleton/graph-model.mjs:161`,不在 skeleton-graph.ts(【详设】:670);§12 的锚点多为描述句而非逐字唯一锚点;【详设】:155 引用 admin-ui-foundation,但 apps/terminal 中 0 个消费者。(E.N2)
- **N-11**:元数据与评审请求:IA_REF 指向实施设计而非 IA,JOURNEY_REFS 不是路径;评审请求含本机绝对路径(违反 CLAUDE.md 交接规范),把 `tools/*` 写成不存在的 `apps/terminal/tools/*`,`REVIEW_TARGET=DESIGN_AND_PLAN` 不是标准值,:262 把"保持未核实根因"当核验目标(与【需求】D-7"先查明成因"相反);多处覆盖声明不属实(见 S-07、S-20)。(E.N3、C.N3 与各维度核对)
- **N-12**:按项目名检索 `doc/review` 与 `doc/plans`,只找到本评审请求与此前的需求复评请求,未见 Codex 侧对本详设的独立子 agent 对抗审查留痕;按 `AGENTS.md:68`,Claude 复核不能替代该留痕。若另有留痕,请补充路径。(编排会话)

## 4. 同族全集扫描

- **M-01**:§3.0 与其他条款的交叉共 5 处(§3.1 接线、R-S6、§3.3、D-11、D-14),只有接线冲突,其余 4 处已核对。
- **M-02**:分类函数消费点 6 个(sample1 现有 4 个 + picker 计划 2 个),全部受影响;status 共 5 值,2 行偏离,其余 3 行等价。
- **M-03**:picker 两跳派发 2 处(本批范围);sample1 同形态 3 处(`apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts:131-134`、`:180-183`、`:196-197`)不在 R-P1 范围,记为设计缺口;`ui/**` 下 `void dispatch` 共 6 处:picker 2、LayerStack 1、admin-shell 3。
- **M-04**:每个 App 约 12 个身份位置,详设覆盖 6 个,其余已逐个核对。
- **M-05**:12 个根配置文件(6 × 2 App)中 3 类被加了自造的 App 槽;额外配置面一个都没覆盖。
- **M-06 / S-10 / S-11**:startup 契约 7 个发射点共用同一 runId 机制;约 9 个失败出口中只有 1 个有终态。
- **M-07**:需求 B1–B4 共 15 项落点,只缺这 1 项,其余 14 项已核对。
- **M-08**:3 类对账的执行者均非独立子 agent;动态运行点 2 处早于对账。
- **M-09**:U1–U13 共 13 个执行体,5 个缺失,其余 8 个在计划中有落点。
- **S-01**:注册顺序断言共 4 处(需求 1、详设 2、计划 1),全部有误;其余 6 处 `registerOnActivity` 提及为现状描述,已核对。
- **S-02**:PRIMARY 用语 6 处均未定义;fallback 原因 6 种只列了 2 种。
- **S-04**:顺序表述共 8 处,只有【计划】:270-275 与两个分支都相容。
- **S-06**:需求列举的 8 种形态与 6 个扫描位置详设逐项覆盖,漏的是列举之外的 5 种等价形态;App 侧接线途径 5 条,有执行体的 0 条。
- **S-07**:运行期模块生产者 12 个(10 个工厂 + 2 份 descriptor),设计覆盖 6 个,漏 5 个工厂与 sample-console。
- **S-08**:真实运行期包 10 个,只有 `kernel.base.runtime` 不可用作夹具。
- **S-09**:接入项 13 个,workspace、reachability、README 三项今天无静态红。
- **S-13**:31 个节点只有 1 处不一致,其余 30 个已核对。
- **S-16**:持久化浮层 8 个,其中 system notice 3 个。
- **S-17**:3 个 notice × 5 个 testID = 15 个身份,文档只钉了 6 个。
- **S-18**:上抛 rejection 的入口 4 个,picker 计划 2 个。
- **S-21**:原子组 5 个,全部缺顺序与预期报错。
- **已核对、不构成问题**:详设与计划未要求或暗示 Dexter 执行 git;未引用已退役控制;未把未来执行体写成 PASS(自检表问题见 S-20);D-13 保留了薄壳文件与运行期导入;"picker 缺陷不计入 sample2 验收"已在计划落实,未发现重复处置。

## 5. 方案合理性

- **问题对不对**:对。sample 靠复制扩张,基础设施事实失去唯一住址,已经造成 sample2 启动诊断缺失、picker 失败无反馈等真实缺陷。"上收能力、下放配置项"方向正确;就绪事实归 render、原生能力归 `assembly/base`、notice body 上收而身份留在 feature 的划分都成立。
- **方案优不优**:整体方向优于"只修 sample2 局部"或"picker 自持第三份 notice"这类更小但继续复制的替代。但详设在几处关键点做浅了(M-02、M-03、S-01、S-02),又把本属详设权限的决定上交(S-04),还扩大了批次依赖(S-14)。评审构造的更简单替代:详设直接定 D-5 = 能力注入、D-10 与原生集成方式;§0.3 只向 Dexter 求一条窄勘误;B4 只依赖 B1;三个本就相同的根配置直接要求等于 base 模板并做封闭形态检查;启动诊断先让 run 身份唯一(一行生产修改)再判定,而不是先做 5 个假设的受控复现;release 验证放在全批对账之后只跑一次。该替代少两个分支、少两次 Dexter 往返,release 构建从两次降为一次。
- **代价配不配**:受管的 release / 双屏时序 runner 是本批最重的基建,却既无设计也无排期(M-09),与"分钟级、零基建"的阶段标尺冲突;是否建设由 Dexter 裁决(§8)。

## 6. UI 强制自问

**开机画面(B2 / U8)**
- **操作来源**:Dexter 明确要求"收起时机应该是主屏加载完毕后"。
- **此时合不合逻辑**:正常路径合逻辑——开机画面遮住 loading 与 spinner,直接进入真实主屏。不合逻辑的两处:收起到空白屏上(S-02),失败时永久停留(S-03)。双屏时副屏 Presentation 不受开机画面遮挡,可能先单独显示 loading 文案(观察项,不计数)。
- **更短更自然的路径**:用户无需操作;失败时收起并显示失败面更自然,待 §8 裁决。
- **不合理之处来源**:注册顺序错误来自需求事实行;PRIMARY 歧义来自需求用词与 display-context 的逻辑 / 物理双重语义;永不就绪属于产品语义未裁决。

**picker 失败提示(B4 / U13)**
- **操作来源**:并入缺陷是 Dexter 2026-09-14 的明确裁定;提示层形态沿用 sample1 已批交互,picker 专属呈现未经 Dexter 单独确认。
- **此时合不合逻辑**:写入前失败时,"系统提示 / 操作没有完成,请重试"合逻辑;写入后失败(M-03)与重启后恢复出旧提示(S-16)不合逻辑。
- **更短更自然的路径**:保留 pending 再点确认已是最短恢复路径;行内提示更短,但会与 sample1 分叉,若在意属 Dexter 裁决,不计 finding。
- **不合理之处来源**:两跳 actor 设计、runtime 账本语义与 sample2 全局浮层持久化裁定,不是产品语义缺失。

另:计划未给 B2、B4 设交互工件准入要求,【详设】§3a 为 OPEN / BLOCKED 却未带入开工条件(纳入 M-09 的前置复核)。

## 7. 未验证清单

**静态已证**(本轮读源码与官方资料):
- 需求 §3.0 与 §3.1、U5 字面冲突;
- 按详设分类表,输错密码与未选壁纸就确认会被当成系统故障;
- picker actor 丢弃子命令结果;
- 两个 App 未集成 expo-splash-screen,官方 plugin 把注册插在 super.onCreate 之前;
- release 构建没有现成的就绪信号,也没有启动诊断事件;
- SLAVE / VICE 单屏会把 0 号屏判为 SECONDARY,真实分支内另有 4 种 fallback;
- 原生构建不读 app.json;
- 日志中的重复 complete 是两个 tracker 共用 runId;
- 系统提示层会被持久化,重复打开同一层会抛错;
- 5 个 module 工厂依赖伪造 descriptor;
- 按计划改法 B0 之后静态检查仍红;
- 5 个执行体无建造步骤,B4 骨架上收整项缺失,对账由作者自做。

**测试已证**:无。本轮未运行任何测试。

**无人验证**(产品负责人可据此决策):
- release 包在手机与双屏上,开机画面是否撑到主屏出现才消失;
- 按详设原文接入,App 会不会冷启动即崩溃;
- 启动失败或 SLAVE / VICE 单屏设备,会不会永久卡在开机画面;
- 删掉伪造 descriptor 后,两个 App 是否确实启动失败;
- 手机与双屏上,真实账本或超时失败时 picker 是否弹出提示,写入后失败时用户看到什么;
- 冷重启后旧的系统提示是否出现;
- 改 app.json 的名称或图标是否真的到不了 APK;
- autolinking 能否从 base 包传递找到原生模块;
- sample2 是否已验收通过。

## 8. 需 Dexter 裁决

1. **确认需求勘误**(§9),尤其 R-E1——它阻断 B2。勘误不改变批准范围与产品语义,只因需求已 GO 冻结而需确认。
2. **S-03 开机画面永远等不到就绪**:① 严格永不收起;② 终态失败时收起并显示失败面(评审推荐);③ 有上限的超时。
3. **S-16 system notice**:冷重启后是否恢复、多次失败如何呈现——sample2 的"浮层必须恢复"是否覆盖已过期的系统提示。
4. **M-09 动态执行**:动态 / 设备运行授权;建受管 release / 双屏 runner,还是复用 `tools/terminal-sample2/run-a9-runtime.mjs` 先例做一次记录式 release 观察。
5. **条件性**:M-03 若写入后失败的呈现需要改 R-P5 字面;S-11 若要新增启动失败终态发射点;N-08 若要把 AUTHORIZATION 归为业务失败。

以下**不需要** Dexter:D-5 的桥、D-10、原生集成方式(见 S-04)。

## 9. 需求侧勘误(需求作者处置,待 Dexter 确认后执行)

- **R-E1 §3.0**:禁止目标限于 feature / integration 层级与 App 包;放行 `assembly.base.<平台>` → `adapter.<平台>.*`;同步 §3.0 核验脚本与 U11 表述。(M-01)
- **R-E2 §3.2 事实行(:329)**:官方 plugin 把 `registerOnActivity` 插在 `super.onCreate(null)` **之前**;补"主题须以 `Theme.SplashScreen` 为父,`postSplashScreenTheme` 指回 AppTheme"。(S-01)
- **R-E3 R-S1**:"PRIMARY" 改为开机画面覆盖的主 Activity 表面;任何 RenderFallback(6 种)都不算就绪;按 §8 第 2 项的裁决补"永远等不到就绪"时的行为。(S-02、S-03)
- **R-E4 §3.5 / R-P5**:识别 picker 两跳派发;"已确认壁纸不变"限定为写入前失败,写入后失败的呈现单列。(M-03)
- **R-E5 §2.2 / D-4**:缺口家族补上 5 个依赖伪造 descriptor 才能启动的 module 工厂;明确 sample-console 在 B3 补齐为运行期模块。(S-07)
- **R-E6 §1.5 / D-4 事实**:当前静态首败比较的是 package.json 与 graph 的 devDependencies,根因包含"platform-ports 只在 `test/` 被导入、门不扫 `test/`",不是 `dependencies.ts` 单点。(S-13)
- **R-E7 §2.1 / D-7**:重复 complete 是两个 tracker 共用不唯一的 runId,日志为多客户端汇总流;D-7 增加"run 身份唯一"约束;U3 / U4 写明证据环境为开发构建。(M-06、N-06)

以上均源自需求稿本身的事实错误或遗漏。本评审会话按规定只写 `doc/review/platform/`,不直接修改需求稿。

## 10. 授权边界与会话出处

- 本评审只判断需求、详设、实施计划与当前 owning source,不授权详设修订以外的任何动作,不构成 implementation acceptance,也不构成 visual、Web 或 release PASS。
- **编排会话**:续接会话(非 fresh),从 v2s 仓根发起,是需求稿作者;只做编排、合并与亲验,verdict 来自 5 个 fresh 独立子 agent。
- **子 agent**:fresh、只读、按规定顺序盲审,未执行任何项目命令或 git。
- **亲验范围**:编排会话对全部 M 与大部分 S 重开了被审文档与 owning source 的对应位置;未逐项重开、采信子 agent 报告的是 S-19 的矩阵逐项缺口、S-20 中"18 行实为 17 行"、M-09 中 `test-expo/App.tsx` 无注入口的细节。删除 descriptor 后的启动报错、冷启动崩溃后果与 release 真机时序等运行期结论均未验证。
- **轮次**:按 `AGENTS.md:72`,Codex 与 Claude 经 Dexter 中转的评审由 Dexter 决定是否及何时复评。
