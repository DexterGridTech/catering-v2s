# TER sample 基础设施上收 base · implementation-facing 详设

DOC_KIND=IMPLEMENTATION_FACING_DESIGN
AUTHOR=Codex
DESIGN_VERSION=2026-09-15-v3.7-current-implementation
BUSINESS_SOURCE=doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md
BUSINESS_SOURCE_SHA256_PREFIX=628d84c09c47
JOURNEY_REFS=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md;doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md;doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md
IA_REF=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md
AUTHORIZED=Dexter 一次性授权：修订详设/计划、实施 B1-B4、运行获准的动态验证、准备 implementation review 交接
NOT_AUTHORIZED=Git 控制动作；超出需求的产品/权限裁决；未由本任务需要的 seed/reset、部署或其他范围外变更
IMPLEMENTATION_AUTHORITY=true
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0;cs-spec-to-plan
DESIGN_STATUS=IMPLEMENTED;CURRENT_CODE_RECONCILIATION_MATCHED;EXTERNAL_IMPLEMENTATION_REVIEW_PENDING
CODEX_INDEPENDENT_SUBAGENT_EVIDENCE=CP0_CURRENT_PLATO_NO_GO_OPEN;CP1_CURRENT_AQUINAS_MATCHED;CP2_CURRENT_EULER_MATCHED_WITH_OPEN_EVIDENCE;CP3_CURRENT_SOCRATES_MATCHED_WITH_OPEN_EVIDENCE;CP4_CURRENT_HUBBLE_MATCHED_WITH_OPEN_EVIDENCE;WHOLE_CURRENT_MAIN_FALLBACK_MATCHED_WITH_OPEN_EVIDENCE;CODE_DESIGN_CURRENT_MAIN_MATCHED;CLAUDE_REVIEW_PENDING
REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE
EVIDENCE_TIER=static_PASS;focused_PASS;native_SUPPORTING_PASS;Android_SUPPORTING_PASS;release_SUPPORTING_PASS;Web_NOT_RUN;visual_NOT_RUN;cleanup_PASS

> 本文定义实现面对的结构、接口、验证、批次和当前证据状态；实施结果只以当前源码、命令
> 输出、日志、设备记录和对账记录为准。当前实现已落地，主 agent 的逐代码对账为 MATCHED；
> external implementation review、Web、visual 以及需求要求之外的完整 acceptance 仍由
> 评审方按证据边界决定。

## 0. 结论、边界与已定案事项

### 0.1 本批真正要解决的问题

问题不是两个 sample 的文本相似度，而是复制后同一基础设施事实出现多个住址、多个写入
入口或无验证边界：

1. runtime module 依赖把 workspace 依赖和运行期依赖混成手抄排除表；新包可能静默漏注
   或被 optional 绕过。
2. sample2 的 console 复制了 surfaces 代码却丢掉消费方需要的字段和启动发射；picker
   的两个生产入口又丢弃了第二跳 kernel 命令结果。
3. App 仍拥有 adapter 接线、assembly 骨架和私有根配置，原生真实读取入口与 app.json
   可能不一致。
4. App 壳只能知道 assembly 是否返回，不能知道被开机画面覆盖的物理主表面已经渲染真实
   part 并完成首次布局；release 也没有现成的 ready 观察。
5. system-failure notice 的共性 body 被复制，feature 身份、生命周期和失败恢复却没有
   一个可核对的单向边界。

这些问题都有实际失败面：静态绿但启动缺依赖、诊断不完整、冷启动过早收起或永久停留、
picker 失败无提示或把已经写入的事实说成未写入。只修 sample2 某个页面是更小的改动，
但保留了同根问题，不能作为本批替代。

### 0.2 已由 Dexter 决定、本文不重开

以下内容直接按需求 v3.7 引用，不再重新论证：

- R-E1：base 禁止目标是 feature、integration 和 App 包；adapter 不在禁止集合中。
  assembly.base.android 依赖同平台 adapter 是 §3.1 的接线本体，D-1 必须放行。
- R-E2：SDK 57 原生注册在 super.onCreate(null) 之前；Theme.SplashScreen 与
  postSplashScreenTheme 的要求按需求 §3.2 执行。
- R-E3/R-S7：PRIMARY 是被开机画面覆盖的物理 Activity 表面；六种
  RenderFallbackReason 都不算 ready；永远等不到 ready 时收起开机画面并显示失败页。
- R-E4：picker 是入口 command → picker actor → kernel child command 的两跳；必须处理
  child result，写入前失败和写入后失败不得使用同一不真实的提示。
- system notice 冷重启按“请求已结束”处理，不恢复为 sample2 的持久浮层；不同 feature
  的 notice 独立存在，不合并、不覆盖。
- U8/D-5：最终使用 release、手机和双屏冷启动的设备观察。按裁定④，本轮先实际运行
  `tools/terminal-sample2/run-a9-runtime.mjs` 作能力探针；只有确认它不能驱动目标观察
  后，才升级为新的 record-only release cold-start runner。探针结果和升级理由必须与
  当前源码绑定后写入 evidence，不能用旧 probe 或作者自报结果代替。

### 0.3 设计状态

本详设已进入实现 intake，但不能自报 implementation acceptance GO。round2 的文档侧
处置已写入历史 intake；CP-B1/B2 的 fresh stage 记录已经可定位。B2 首个 mismatch 是详设
残留旧 failure-page testID/文案，已登记为本轮必须先修的文档 finding。旧 whole-scope、
code↔design 和动态记录不能覆盖当前源码，必须在最终源码完成后重新留存。U8 release
冷启动、sample1/2 release 旅途、U13 完整 runtime 和 Web、visual、cleanup 均保持 OPEN，
直到当前 runner 实际产生相应档位证据。stage/whole/code↔design 三类记录不是作者自检，
也不能由 Claude review 替代；它们必须在仓库中有可定位记录，动态证据也必须按档位独立保存。

## 1. 方案比较

| 方案 | 结果 | 取舍 |
| --- | --- | --- |
| A：继续在两个 App、两个 integration 和 picker 各自复制 | 静态可暂时变绿，但新包仍需手抄排除、每个 feature 仍可能复制 notice，R-S1 和 R-E4 不能被结构性证明 | 拒绝：短期改动小，长期仍保留已确认根因 |
| B：把所有内容搬进一个超级 App/base 包 | 可能消除重复，但 feature 配置、integration 主题、App 身份和 adapter 物理绑定被吞掉，违反薄壳、owner 和 R-E1 | 拒绝：边界过宽且改变现有产品归属 |
| C：依赖集合由包自声明推导；native 能力在 assembly/base/android；ready 事实在 ui/base/render；console 诊断和 notice body 各自单一落点，App 只投影配置 | 改动跨 B1-B4，但每个事实有一个 owner，既保留 App/integration 自主配置，又能给出静态、focused、native、release 证据 | 采用 |

我选 C 而不是 A/B，因为它只上收已经证明为基础设施的事实，保留真实的业务身份、
主题和 native 资源自主权，同时给自然捷径一个可执行的反例门。

## 2. Claude 9M/22S/12N 逐条处置表

状态含义：

- FIXED_IN_DESIGN：本文已经把 finding 改成可对账的设计；实现/动态证据仍 OPEN。
- ACCEPTED_BY_DEXTER：需求层已由 Dexter 裁定，本文只引用，不重开。
- OPEN_BLOCKER：设计不能宣称 ready，必须先有指定独立审查或未来证据。
- NOT_FOUND_OPEN：评审指出的证据在当前仓库没有找到。

| Finding | 状态与处置 | 仓内事实 / 外部事实 / 推论 / 假设 | 精确锚点 | 本文落点 | 证据与反例 |
| --- | --- | --- | --- | --- | --- |
| M-01 | ACCEPTED_BY_DEXTER；删除原三选项，按 R-E1 重写 predicate | 仓内事实：旧文字把 adapter 也算非 base；需求 v3.6 已改禁止集合 | requirements §3.0 R-E1；tools/terminal-layering/check-static.mjs#isInvalidDirection | §0.2、§5、D-1、B2 | 旧反例是 base→App 或 base→feature；assembly.base→同平台 adapter 不再是红例，跨平台仍是红例。实施 checker 必须以闭合 predicate 复验 |
| M-02 | FIXED_IN_DESIGN；D-12 逐行等价现行 base classifier，不按 aggregate status 猜业务 | 仓内事实：现行 requestOutcome.ts 先处理 completed/running，再按 error.category；aggregateCommandStatus.ts 的全 actor 失败返回 error | apps/terminal/ui/base/render/src/foundations/requestOutcome.ts#classifyRequestResult；apps/terminal/kernel/base/runtime/src/foundations/aggregateCommandStatus.ts#aggregateCommandStatus | D-12、U13、U10 S1-02 | 反例：单 actor AUTHENTICATION 返回 error 仍须 business-failure；测试覆盖 9 类、空错误、混合类目和 3 个终态 |
| M-03 | IMPLEMENTED；picker actor 必须先 await/检查 child result，再用写前/写后状态 readback 选择提示；成功处理完成后返回 `null` 不构成丢结果 | 仓内事实：当前 actors.ts 两处均在 `dispatchWallpaperChild` 完成检查后才 return null；U13 focused 已用真实 runtime child injection 覆盖写入前/后失败 | apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts#createWallpaperPickerActor；WallpaperPicker.tsx#selectOption/confirm | D-14、U13、B4、§9.3 | 反例：在 child dispatch 前无条件 return、或 await 后不检查 status/rejection，PF-01 才会得到父级 completed；当前 16-test runtime evidence 已覆盖核心路径，完整 PF 设备矩阵仍 OPEN |
| M-04 | FIXED_IN_DESIGN；手工提交 native 工程为权威，app.json 是镜像 | 仓内事实：build.gradle、Kotlin、manifest、styles、strings、mipmap 是构建真实输入；app.json 不被这些文件反向读取 | apps/terminal/assembly/android/sample-terminal/android/app/build.gradle#namespace；MainActivity.kt#onCreate；AndroidManifest.xml#application | D-5、D-6、U6/U7 | 反例：只改 app.json 名称而 APK native label 不变；checker 必须覆盖每个真实入口 |
| M-05 | FIXED_IN_DESIGN；六文件允许差异改成封闭登记表，不留自由槽位 | 仓内事实：六个根配置中 babel/tsconfig/global.d.ts 当前逐字相同；metro/tailwind/nativewind-env 有有限差异 | 两个 App 根目录六文件；requirements §3.1/U12 | D-11、U12、B2 | 反例：在 babel 加私有 plugin、另建 .babelrc 或 package.json babel 键；根 census 与语义 helper projection 必须红 |
| M-06 | FIXED_IN_DESIGN；先换唯一 run 身份，再做 exactly-once；oracle 只读单客户端 sink | 仓内事实：createPlatformPorts.ts 用时间戳+模块计数器；start.log 是多客户端汇总 | apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts#createStartupTracker；.expo/dev/logs/start.log | D-7、U3/U4、B3 | 反例：两个 tracker 共享旧 runId，或 parser 去重后绿；唯一性、旧 run 串入和 duplicate complete 各有 red |
| M-07 | FIXED_IN_DESIGN；B4 纳入三种 ui/feature module.ts 与 assembly.ts 的骨架上收 | 仓内事实：三个 feature 各有重复 application/module.ts 与 assembly/assembly.ts；需求 B4 明列骨架上收 | apps/terminal/ui/feature/sample-staff-auth/src/application/module.ts；sample-member-desk；sample-wallpaper-picker | D-13A、B4、§9.2 | 反例：只迁 requestOutcome/notice 而保留三份重复骨架；公共 helper 与每个 feature consumer 均进 code↔design 分母 |
| M-08 | IN_PROGRESS；三类对账由 fresh 独立子 agent 执行，并把动态运行排到对应对账之后 | 仓内事实：CP0-CP4 与 whole-scope 已有可定位记录，但部分记录在修复前，当前 stage/code↔design 仍需复核 | AGENTS.md 协作进度与步骤级对账；project-memory/operations | §13、plan §8-§10；当前动态仍 BLOCKED | 不能用作者自检、Claude 后续或动态绿替代；任何缺记录或记录未收口即 OPEN |
| M-09 | FIXED_IN_DESIGN，proof OPEN；每个执行体有建设步骤，U8 由新 runner 执行 | 仓内事实：旧计划没有 5 个执行体建设步骤；旧 run-a9 当前只做 dev/mobile/sample2 | tools/terminal-sample2/run-a9-runtime.mjs；S-3 probe；新 runner 计划 | D-8、plan B2/B3/B4 | 反例：把未来文件当已存在或只写“跑 runner”；计划列出构建动作、red mutation、日志、cleanup，当前不执行 |
| S-01 | ACCEPTED_BY_DEXTER R-E2；按需求写 before-super | 外部事实：官方 Android/Expo plugin 要求 install/register 在 super.onCreate 前 | requirements §3.2 R-E2；developer.android.com splash migration；Expo sdk-57 source | D-5、B2、U8 | 旧反例是 setTheme 后 super 再 register；实施静态检查和 native 构建共同验证 |
| S-02 | ACCEPTED_BY_DEXTER R-E3；PRIMARY 按物理表面，六 fallback 全排除 | 仓内事实：displayMode 在 VICE/SLAVE 可反映逻辑角色而非启动物理表面；resolvePart 有六种 fallback | requirements §3.2 R-E3；resolvePart.ts#RenderFallbackReason | D-5、U8、ScreenReadyBoundary | 反例：outer root、host pending 或任一 fallback 布局触发 hide；focused 反向变异红 |
| S-03 | ACCEPTED_BY_DEXTER R-S7；终态失败收起并显示失败页 | 仓内事实：assembly/runtime/host/part failure 可能在当前树中抛错或长期无 ready；产品处置已定 | requirements §3.2 R-S7 | D-5、D-13、U8 | 反例：prevent 后无限停留或自动收起到空白；failure page 与 splash hide 必须同一 release 观察 |
| S-04 | FIXED_IN_DESIGN；D-5/D-10 由详设直接选择，不再留两分支 | 仓内事实：splash npm 能力不依赖 adapter wiring 冲突；AppControlPort 现语义是 container loading 且无实现 | appControl.ts；requirements §3.2/D-5/D-10 | D-5、D-10、plan §1 | 采用 dedicated required capability；不同时保留 AppControl 与新 bridge，避免双路径 |
| S-05 | FIXED_IN_DESIGN；B2 建 native provider，B3 建 render consumer，focused negative 后才做 U8 | 仓内事实：SurfaceRoot.tsx 两处现有观察均被 __DEV__ 挡住 | SurfaceRoot.tsx#reportLayout/useEffect；ScreenContainer.tsx#resolved part | D-5、§6、plan B2/B3 | 反向变异覆盖 no prevent、outer layout、pending、六 fallback、非目标物理表面、重复 hide |
| S-06 | FIXED_IN_DESIGN；复用并扩展 AST collector，另有 App adapter-wiring predicate | 仓内事实：import-capabilities 已覆盖 import type/export/dynamic import/require，缺 import equals；旧扫描范围窄 | tools/terminal-shared/import-capabilities.mjs#collect; tools/terminal-skeleton/graph-model.mjs#projectSkeletonGraph | D-1、U5/U11、plan B1/B2 | 反例：.cjs root config、relative adapter、export type、import equals；AST 语义解析而非 keyword |
| S-07 | FIXED_IN_DESIGN；五个 fake-descriptor factory 纳入 B1；sample-console 在 B3 成为 runtime module | 仓内事实：五个工厂直接依赖完整 dependencyModuleNames；两个 console 有 descriptor | 五个 factory 路径见 D-4；sample-console/src/assembly/assembly.tsx#modules | D-4、U1/U2、plan B1/B3 | 反例：删 descriptor 后 Missing required runtime module dependency；每个 factory 真实 module 注册红/绿 |
| S-08 | FIXED_IN_DESIGN；U2 改用可移除的 display-context 实例 | 仓内事实：createRuntime 总是追加 kernel.base.runtime，不能取消 | apps/terminal/kernel/base/runtime/src/application/createRuntime.ts#186-196 | D-8 U2、plan B1 | 反例：用 runtime 做夹具只测到内部自注册；真实 createDisplayContextModule 缺注册必须触发 resolver 错 |
| S-09 | FIXED_IN_DESIGN；D-2 给 13 项登记→首红门→兜底表 | 仓内事实：census 文件遍历不能发现 root workspace 漏项；entry 与 count 有硬编码/未覆盖项 | tools/terminal-skeleton/graph-model.mjs#199-222；check-static.mjs#172-175,#285-286 | D-2、U1/U5/U6/U7/U9/U11/U12、plan B0-B3 | 反例：随机命名新包不进 root/entry/README/identity；每条必须有 checker 或 fresh review 兜底 |
| S-10 | FIXED_IN_DESIGN；唯一生产写入端归 ui/base/console-assembly | 仓内事实：createPlatformPorts 是消费/跟踪端；platform-ports 测试存在 helper 直写 | requirements §2.1/§3.3；startupDiagnostics.dev.test.ts#42-56 | D-7、U3/U4、plan B3 | 反例：删共享 helper 但第二 writer 仍完整；writer source inventory + 两 App 真实触发必须同时过 |
| S-11 | FIXED_IN_DESIGN；不声称失败路径已有终态，只以缺 complete/明确 startup.failed 判失败 | 仓内事实：startup.failed 只在 createRuntime.ts:432；resolve order 可早于任何 startup event | createRuntime.ts#418-439；resolveModuleOrder.ts#37-43 | D-7、U4、B3 | 反例：failure/finally 自动补 complete 或 parser 猜终态；若需新生产终态超出本批，必须另获授权 |
| S-12 | FIXED_IN_DESIGN；native authority、输入全集、空守卫、asset 登记格式全部封闭 | 仓内事实：styles/manifest/strings/mipmap 等是 native 输入；ST 有 orphan splash-icon；WP README 有登记表 | 两个 Android 工程；assets/README.md | D-6、U6/U7、plan B2 | 反例：只查目录或 reference→exists；双向 closure、两个 App 同 oracle、逐文件 Kotlin package 均红 |
| S-13 | FIXED_IN_DESIGN；按 v3.6 R-E6 从 picker package.json 删除错误的 `kernel-base-platform-ports` devDependency；graph 与 dependencies.ts 不再声明该目标，合法的 `ui.base.test-support` dev edge 保留 | 仓内事实：当前首败是 package.json 多声明；该 platform-ports type-only import 仅在 test，graph source census 不收 test；test-support 是当前 picker test 的真实 dev 依赖 | skeleton-graph.ts#ui.feature.sample-wallpaper-picker；该包 package.json/src/dependencies.ts；graph-model.mjs#272-274 | D-2、plan B0 | 反例：把 test-only platform-ports 补入 production graph/dependencies 会使 declared-vs-source 门继续红；反向删除 test-support 会使真实测试依赖与 checker/安装形态漂移；B0 只以 target declaration absent + static green 收口 |
| S-14 | ACCEPTED_BY_DEXTER R-E5/S-14；B4 只依赖 B1，跨批回归不变成 B4 graph dependency | 仓内事实：需求明确 B4 depends B1；U10 是最终回归，不是依赖声明 | requirements §4.1；skeleton-graph.ts | §4、plan B4 | 反例：把 native B2/B3 完成设成 picker 开工条件；计划不这样做 |
| S-15 | FIXED_IN_DESIGN；新包和受影响公共面均建中文 README | 仓内事实：TR-10 门检查每个 workspace package README 且中文内容由 review 核对 | doc/platform/terminal-coding-standard.md#TR-10 | D-2、plan each batch、§10 | 反例：只有文件名、空 README 或只登记资产；README 内容对账 OPEN 即不收口 |
| S-16 | ACCEPTED_BY_DEXTER；system notice 不冷启恢复，多 feature 独立 | 仓内事实：旧 serializeLayers 会序列化全部层，重复 layer 会抛 duplicate；需求 v3.6 已明确例外 | requirements §3.5/D-14；workspaceSlices.ts#serializeLayers；contentActors.ts#duplicate | D-14、D-9 PF-05/PF-06 | 旧恢复行为是反例，不是目标；新 evidence 断言冷启无 notice、不同 feature 可同时存在 |
| S-17 | FIXED_IN_DESIGN；3 个 notice × 5 个 testID、文案/a11y/layout 全冻结；删错误的 *TestIds.ts 说法 | 仓内事实：sample1 两组件各有 root/title/message/actions/dismiss；现有 notice 没有对应 *TestIds.ts | DeskSystemNotice.tsx#render；AuthSystemNotice.tsx#render | D-14、§9.3、U10/U13 | 反例：只保留 message/dismiss、把 raw error 塞进 body 或复用 auth identity；15 个身份逐个核 |
| S-18 | FIXED_IN_DESIGN；先 start、任何非 running/rejection 都 finish；sample1 保留既有 rethrow 语义，picker 消费 rejection | 仓内事实：sample1 四个入口 catch 后 rethrow；PrimitiveButton 丢 return；picker 需失败→关闭→重试成功 | StaffLogin.tsx#submit；MemberForm.tsx#submit；PrimitiveButton.tsx#onPress | D-14、U13、§9.3 | 反例：只在 resolved error finish、或用 global observer；in-flight guard 和 retry success 都是 focused proof |
| S-19 | FIXED_IN_DESIGN；D-9 改为逐步、非委托，补冷启、撤回/放弃、年龄 S-30–S-33 和 sample2 literal keys | 冻结事实：sample1 §4/§9.2、sample2 §9；计划不得用“all frozen keys”代替 | 两份冻结旅途文件；见 D-9 | D-9、plan test list | 反例：只点一个按钮、只断言存在、同步改名 sample1 IDs；每行写精确集合与 state |
| S-20 | FIXED_IN_DESIGN；删除 MATCHED 自检表，所有未执行 proof 显示 OPEN | 仓内事实：旧文将 D-1..D-14 全写 MATCHED，且“18 行”数错 | 旧详设 self-check；requirements §0.3/§8 | §0.3、§13、plan §11 | 反例：计划文件、未来 runner 或作者数字不能成为 PASS；本稿只列 static facts 和 OPEN |
| S-21 | FIXED_IN_DESIGN；五个 atomic group 写顺序、预期中间报错、整组收口 proof | 仓内事实：foundation charter §5-C 强制中间态报错必须真实核验 | doc/platform/foundation-charter.md#5-C | §10、CP cards、plan batches | 反例：只删 descriptor 后看到未预期错误；先做最小 focused 锚点再完成原子组 |
| S-22 | FIXED_IN_DESIGN；每个 CP 均有 FORBID、RECALL、不变量、形态理由、可证伪失败 | 模板事实：implementation-design-template.md §4 要求这些字段 | doc/decisions/templates/implementation-design-template.md#4 | §11 | 反例：空壳包、白名单、漏写 root 配置、错误启动时序均有 falsifiable failure |
| N-01 | FIXED_IN_DESIGN；列出新增跨 batch 边，不清理既有残留边 | 仓内事实：两个 App 和 sample-console 会指向 batch2 新节点；现有 batch1→batch2 边已存在 | apps/terminal/skeleton-graph.ts#assembly.android.*、ui.integration.sample-console | D-3、§8、plan §1 | 反例：将 batch1 投影当证据或擅自清理旧边；默认 activeSkeletonBatch=2 全图 |
| N-02 | FIXED_IN_DESIGN；D-10 选择 dedicated capability，未使用 app-control/logger 声明删除 | 仓内事实：两 adapter 只在 dependencies.ts 声明，无生产消费者；AppControlPort 是 container loading | appControl.ts；两个 assembly/android/src/dependencies.ts | D-5/D-10、plan B2 | 反例：以 dependencies.ts import 伪装 binding；checker 要求实际 consumer 或删除 |
| N-03 | FIXED_IN_DESIGN/OPEN_RUNTIME；先例已实跑并确认不足，改建新的 record-only release cold-start runner | 仓内事实：run-a9 实际只启动 Metro/debug/mobile，并以源码 mutation 伪造 secondary；探测结果有独立输出 | tools/terminal-sample2/run-a9-runtime.mjs；doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-android/20260914-a9-runtime-probe-01 | D-5/U8、plan B2/closure | 旧先例只能作为 supporting probe；新 runner 必须覆盖 release、两 App、真实双屏映射、splash timing、失败页和 cleanup |
| N-04 | FIXED_IN_DESIGN；capability 为 required，不提供 no-op production default | 推论：no-op 会让 Android 漏传静默永久停留；需实现/测试证实 | RenderProviderProps#platform capability；D-5 | D-5、U8 | 反例：缺 provider 应在类型/assembly focused test 失败，而不是开机画面不动 |
| N-05 | FIXED_IN_DESIGN/OPEN_NATIVE_LINK;模块作用域导入、sideEffects/exports、App→base 链、release link proof | 外部事实：Expo 自动隐藏依赖 prevent 调用与 native registration；transitive autolinking 仍需构建核实 | sdk-57 SplashScreenManager.kt；两个 settings.gradle；package exports | D-5、plan B2 native proof | 反例：只在 JS 里 import 但 native 未链接；release 构建/静态 resolved dependency 不通过即 OPEN |
| N-06 | FIXED_IN_DESIGN；U3/U4 证据环境限定 development build，release 仅做 U8 | 仓内事实：tracker 由 __DEV__ 控制 | createPlatformPorts.ts#createStartupTracker | D-7、D-8、U3/U4/U8 | 反例：拿 release “无日志”判 startup complete；证据档位分开 |
| N-07 | FIXED_IN_DESIGN；保留现有 startup.* / sample.* 事件名，变更 writer owner 不变命名 | 仓内事实：既有 sample1 consumers 依赖事件语义；无需求要求重命名 | 两个 integration assembly 的 logger calls；requirements §2.1/§2.3 | D-7、B3 | 反例：为上收而改名，导致 sample1 drift；source schema 与 single writer 一起核验 |
| N-08 | FIXED_IN_DESIGN；9 类目逐项列出，AUTHORIZATION 保持 system-failure | 仓内事实：error.ts 明确 9 类；现行 classifier 只把 3 类列 business | apps/terminal/kernel/base/contracts/src/types/error.ts#ErrorCategory；requestOutcome.ts | D-12 | 反例：AUTHENTICATION 改成 system 会破坏输错密码；不改变需求既有 semantics |
| N-09 | FIXED_IN_DESIGN；按钮、遮罩、返回键三条 close path；同 feature 重复不抛未处理错误 | 仓内事实：LayerStack.tsx 有三条关闭入口，content actor 当前 duplicate 会抛 | LayerStack.tsx#175-181；contentActors.ts#duplicate | D-14、U13 PF-06/PF-08 | 反例：只测 dismiss 或用异常吞掉 duplicate；三条路径和不同 feature 并发均验 |
| N-10 | FIXED_IN_DESIGN；全部锚点改成路径+唯一 symbol，foundation consumer 只写实际消费者 | 仓内事实：projectSkeletonGraph 在 graph-model.mjs:161；apps/terminal 当前没有 admin-ui-foundation consumer | tools/terminal-skeleton/graph-model.mjs#projectSkeletonGraph；libraries/frontend/admin-ui-foundation/src/index.ts | §12、handoff read list | 反例：描述句或不存在路径不能作为对账锚点；计划不声称已有 consumer |
| N-11 | FIXED_IN_DESIGN；IA_REF 用真实 IA 路径，review target=DESIGN，无绝对路径，D-7 改为先查成因 | 仓内/规范事实：handoff template 和 AGENTS.md 禁止绝对路径与 DESIGN_AND_PLAN | doc/platform/claude-review-handoff-template.md；scripts/check/claude-review-handoff | review request 全文 | 反例：把“保持未核实”当目标或把 tools 写成 apps/terminal/tools；最终 checker 必须过 |
| N-12 | IN_PROGRESS；CP0-CP4、whole-scope 与 code↔design 的 fresh 记录已开始落库，修复后需以新记录收口 | 仓内事实：当前目录已有多份独立记录，其中修复前记录明确标注 superseded；本轮授权要求每 CP、全批动态前、交付前分别留痕 | doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/；AGENTS.md fresh review rule | §0.3、§13、plan §9、implementation handoff | 关闭方式：每份当前记录都含 fresh reviewer、三维输入、证伪 finding、结论；作者自审和 Claude review 不替代 |

### 2.1 历史 Round2 3M/6S/5N intake（基于 v3.6，已被当前源码状态 supersede）

下表逐条处置 `doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-plan-review-round2-claude.md` §2；状态只表示当前设计/实施处理度，不把未运行证据写成 PASS。

| finding | 处置 | 当前落点 | 证据/剩余验证 |
| --- | --- | --- | --- |
| M-1 | 按 v3.6 R-E6 删除 picker package.json 的错误 `kernel-base-platform-ports` devDependency；不向 graph 或 dependencies.ts 补该 test-only 类型依赖，保留合法 `ui.base.test-support` dev edge | §0.2、D-2、plan B0 | `cp1-static-red-evidence.md` 的 static green；clean install/typecheck 仍需复核 |
| M-2 | 新增专属 D-13A，确定 `ui.base.feature-assembly`、三 feature 薄适配和可取消 RuntimeModule；D-13 保持 App 壳含义 | §9.5/D-13A、plan B4.1 | 设计已闭合；源码/ focused proof OPEN |
| M-3 | release 双形态证据统一排在 B4 closure、whole-scope 3D reconciliation 之后；实际顺序偏差保留并由 fallback record 解释 | D-5/U8、plan B2.3/B3.3/§9.4 | 当前 U8、sample1、sample2 supporting records 已绑定最新 APK；历史 supporting evidence 不覆盖当前源码 |
| S-1 | D-1 adapter 放行增加 source/target platform equality；跨平台 adapter 是红夹具 | §6.1、U5/U11 | checker focused proof OPEN |
| S-2 | root workspace 漏项不再声称由 graph-comparison/coverage 发现；改由 root manifest/Turbo dry-run 与 fresh review 兜底 | D-2、plan B1.1 | 当前 checker source 已核实；Turbo dry-run OPEN |
| S-3 | 实跑旧 run-a9 后确认其为 Metro/debug/mobile/源码 mutation 先例，升级为新 runner，不再请示是否升级 | D-5/U8、plan U8 | probe record 已存在；新 runner 与 release/dual evidence OPEN |
| S-4 | 给 LayerEntry/catalog 增加 `durable|ephemeral` intent；serialize 过滤，hydrate 对旧 notice 再过滤，sample2 pending/confirmed 保持 durable | D-14、plan B4.3 | 源码实施与冷启验证 OPEN |
| S-5 | 计划 D-9 直接采用详设编号/内容；WP 正常旅途与 PF failure injection 分栏 | §8.1/8.2、plan §8 | 文档已统一；执行 evidence OPEN |
| S-6 | D-6 补确定 App discovery、空输入守卫、`src/main/res`/aapt2/Gradle resource compiler 真实入口 | D-6、plan B2.4 | 设计已回答；checker/build proof OPEN |
| N-1 | 逐点复核新增跨 batch 边及 source/package/graph 对账，不以 projection 代替 full graph | D-3、plan §1.3 | static full graph PASS；后续 code↔design OPEN |
| N-2 | R-S7 增加专属 native/render/failure-page 建造步骤和 release 判据 | D-5、plan B2.3/B3.4/U8 | 设计/计划已补；动态 OPEN |
| N-3 | B0 也纳入 fresh stage 3D reconciliation，CP-0 gate 明列；本轮 CP-1 record 之后按序留存 | CP-0/CP-5、plan B0/B1.6/§9 | fresh record OPEN/PENDING |
| N-4 | M-07/D-13 锚点改为 D-13A，D-13 仅 App shell | §2.1、D-13A、plan B4.1 | 文档已改；source proof OPEN |
| N-5 | 删除无需求依据的 tsconfig “若必须 include integration path”自由句 | D-11、plan B2.4 | 文档已改；逐字 diff OPEN |
| S-NEW-1 | FIXED_IN_IMPLEMENTATION；assembly rejection 改为 App 注入 `ui.base.render` 的 `StandaloneStartupFailurePage`；移除 assembly 自绘 UI 与 `assembly-failure` hide reason | B2.2/B3.4、U8-support、§10 | 当前 render focused 为 12 files / 67 tests，两个 App typecheck 已通过；当前 U8 wrong-primary release/mobile/dual evidence 已绑定最新 APK；旧首败保留 |

### 2.2 当前实现静态评审 2M/12S/8N 逐条处置

本表处置 `doc/review/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation-review-claude.md` §2。
该评审当时只看代码；本表不把历史 evidence、focused green 或作者自报数字升级为
native、Android、release、Web、visual、cleanup 或整体 implementation acceptance。

| finding | 处置 | 代码位置 | 验证方式与边界 |
| --- | --- | --- | --- |
| M-1 | CONFIRMED→FIXED；完成判定收回 console-assembly writer，要求六组、PRIMARY declared/measured/real-ready 同时成立；删除 platform-ports 的死 `completedGroups`/`surfaces` | `apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts`；`apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`；`apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts` | `node tools/terminal-sample2/check-startup-diagnostics.mjs`、writer focused；red 缺组/重复/身份变异仍必须失败；运行期 oracle 尚 OPEN |
| M-2 | CONFIRMED→FIXED；feature-assembly 只接收 identity 与真实 commands/actors/slices 定义并派生描述符；三 feature 只保留薄 adapter；移除私有 Set/unregister 假撤回 | `apps/terminal/ui/base/feature-assembly/src/index.ts`；三个 `apps/terminal/ui/feature/sample-*/src/application/module.ts` | feature-assembly focused、三 feature typecheck/focused、static dependency projection；不以重复字段或私有集合通过 |
| S-1 | CONFIRMED→FIXED；首次就绪前锁存阶段与目标物理 PRIMARY；native recoverable removal 与 terminal unavailable 分开发布；就绪后使用 runtime failure 变体，SECONDARY 只中性 fallback | `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`；`apps/terminal/adapter/android/dual-screen/src/implementations/surfaceHost.ts`；`apps/terminal/ui/base/render/src/components/ScreenContainer.tsx`、`ScreenReadyBoundary.tsx` | dual-screen/render focused；release/mobile/dual 的 R-S7 设备 evidence 尚 OPEN，不能以 focused 代替 |
| S-2 | PLAUSIBLE→FIXED_SOURCE_OPEN_NATIVE；SDK57 本地包源码确认 splash manager 的 process flag 不随 Activity 重新注册而重置，新增按 Activity identity 的 native gate，JS 不持有跨 Activity hide latch | `apps/terminal/assembly/base/android/android/src/main/java/com/catering/v2s/terminal/assembly/base/android/TerminalNativeLoadingRegistry.kt`；`nativeLoadingCapability.ts`；两个 `MainActivity.kt` | native loading focused red/green、Android release build 与 Activity recreation 观察；设备 proof 尚 OPEN |
| S-3 | CONFIRMED→FIXED；logger 透传调用方 startupRunId，writer 写 client provenance；environment mode 不在 release 默认为 DEV | `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`；`apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`；两个 integration assembly；`apps/terminal/assembly/base/android/src/foundations/androidPlatform.ts` | startup diagnostics checker、writer/platform focused、release build；DEV 共享 ports/双 assembly 的动态证据尚 OPEN |
| S-4 | CONFIRMED→FIXED；console-assembly 自行并入 `adminShellAssembly.parts`，对最终 catalog 的 duplicate partKey fail-fast；integration 删除手工并入 | `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`；两个 `ui/integration/*/src/assembly/assembly.tsx` | console-assembly/integration focused、TR-13 static red mutation；不接受只渲染 launcher 的伪绿 |
| S-5 | CONFIRMED→FIXED；`ConsoleSurfaceInputFrame` 改为包内私有，不进入 public export/invariant | `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`、`src/index.ts`、`terminal-invariants.json` | package typecheck、public export census、static checker；外部调用必须编译失败 |
| S-6 | CONFIRMED→FIXED；picker 删除复制的分类表，复用 render base 的 `classifyRequestResult`/business category 能力；error factory 只保留 child failure 的安全细节 | `apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/errors.ts`；`apps/terminal/ui/base/render/src/foundations/requestOutcome.ts` | picker focused、`rg` 单一分类 owner、D-12 exact-table review；不通过关键词替代语义核验 |
| S-7 | CONFIRMED→FIXED_WITH_FOCUSED_OPEN_RUNTIME；真实 kernel actor 先写，后置测试 actor 在同命令抛错；actor 回读决定 phase，UI 消费 resolved/rejected 两跳结果并使用裁定文案 | `apps/terminal/ui/feature/sample-wallpaper-picker/src/features/actors/actors.ts`；`WallpaperPicker.tsx`；`test/pickerSystemFailure.test.ts` | picker focused 已有真实 runtime 注入与 write-before/after 夹具；U13 release/Android 失败恢复仍 OPEN |
| S-8 | CONFIRMED→FIXED；integration 删除 `Test*AssemblyInput` 生产重载和 `??` capability fallback，测试 support 直接传真实能力 | 两个 `ui/integration/*/src/assembly/assembly.tsx` | 两 integration typecheck/focused、static public API census；不保留兼容入口 |
| S-9 | CONFIRMED→FIXED_SOURCE_WITH_OPEN_DEVICE；U8 成功分支断言 settled 时 splash 已消失，t0 是设备侧首个 RN 内容观察后窗口；新增 native prevent 与 ready callback 两个真实 red mutation | `tools/terminal-sample2/run-u8-release-cold-start.mjs`；`tools/terminal-sample2/check-u8-focused.mjs`；`apps/terminal/assembly/base/android/test/nativeLoadingCapability.test.ts` | `node tools/terminal-sample2/check-u8-focused.mjs`；最终仍须 release/mobile/dual 设备时序，未运行前保持 OPEN |
| S-10 | CONFIRMED→FIXED_SOURCE_WITH_OPEN_RUNTIME；sample1/2 runner 每步断言 PRIMARY/SECONDARY partKey 与业务 state，并在已认证状态下冷重启核验恢复 | `tools/terminal-sample2/run-sample1-frozen-journey.mjs`；`run-sample2-frozen-journey.mjs` | `node --check`、当前源码绑定的 mobile/dual runner；business/cleanup 动态 evidence 尚 OPEN |
| S-11 | CONFIRMED→FIXED_STATIC；U5 App→adapter、U2 真实 display-context 缺注册、U6 跨 App applicationId collision、D-1 整包遍历均有执行体和 red mutation | `tools/terminal-skeleton/check-static.mjs`/`check-static.test.mjs`；`tools/terminal-sample2/check-native-projection.mjs`/test；`apps/terminal/kernel/base/runtime/test/moduleSystem.test.ts` | skeleton static、native projection static；仅把机械性质关闭到 static，不外推 native |
| S-12 | CONFIRMED→FIXED_DOC_SOURCE_OPEN_REVIEW；按 TR-10 重写 assembly/base/android、两个 App、console-assembly README，示例回源码 | 四份 `README.md`（见 §10）与对应 source | static/README review；缺 fresh review 的文案或旧结构仍是 finding |
| N-1 | CONFIRMED→FIXED_SOURCE；environmentMode 从 `__DEV__`/显式测试覆盖推导，避免生产默认 DEV | `androidPlatform.ts`、`consoleAssembly.tsx`、两个 integration assembly | affected typecheck 与 release config inspection；Web/设备实际 mode evidence 仍独立 |
| N-2 | CONFIRMED→FIXED；ready callback 先完成 startup writer/command，再调用 native hide；callback 失败时由 failure page 路径负责收起，不先制造“已 ready” | `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx`；`apps/terminal/ui/base/render/test/renderSurface.test.tsx` | focused order assertion `ready-callback` before `hide`；U8 设备时序仍 OPEN |
| N-3 | CONFIRMED→RESIDUAL_RISK；首次测量一直无效且没有既有 entry 时，生产不设置任意超时，开机画面可能持续保留；不在本批改变裁定的 no-timeout 语义 | `TerminalDualScreenActivityHandler.kt` invalid-measurement branch；D-5/U8 observation bound | focused/source review 登记风险；不把验证器上限写成 production timeout，不改需求 |
| N-4 | CONFIRMED→FIXED_SOURCE；写入相位唯一以 actor 在 child dispatch 前后的 owner-state readback 为准，UI 不再自行推导 | `sample-wallpaper-picker/src/features/actors/actors.ts`；`src/foundations/writePhase.ts`；`WallpaperPicker.tsx` | picker focused、写前/写后 red runtime fixture；UI 不以旧 state 或 error message 猜 phase |
| N-5 | CONFIRMED→FIXED_OWNER；D-1 package/tsconfig/source boundary 归 `tools/terminal-skeleton/check-static.mjs`；layering checker 只保留通用 P-5a layer direction | 两个 checker；`tools/terminal-layering/check-static.mjs` | 两套 checker 各自 focused/static：skeleton 承担 base closed predicate，layering 不再复制同一 predicate |
| N-6 | REVIEW_NOTE→BOUNDED_ACCEPTANCE；integration startup-ready actor 的 feature-specific message 与 payload、两个 notice 的 feature identity、surface alias 和 generated NativeWind note 各有 owner/兼容理由；不为少量重复引入跨 feature 超级抽象 | 两 integration `src/application/module.ts`、两个 notice component、两个 App assembly、`nativewind-env.d.ts` | source census/README review；这些小重复不改变 owner、partKey、layerId、testID；若后续复用扩大另立详设 |
| N-7 | CONFIRMED→FIXED_OFFLINE_CLEANUP；删除两个零消费且声明的原生类不存在的 adapter 空壳，同步 graph/count/workspace/README/invariants/census | `apps/terminal/skeleton-graph.ts`、root `package.json`、`yarn.lock`、static tests；线下记录见 `obsolete-file-cleanup-round2.md` | static baseline、workspace census、线下目录存在性；不为过门保留空壳 |
| N-8 | CONFIRMED→FIXED_SOURCE；测试 support 类型统一由 `ui/base/test-support` 转出，feature test 不再隐式跨包导入 platform-ports | `apps/terminal/ui/base/test-support/src/index.ts`、三个 feature `test` 和 `dependencies.ts` | affected typecheck/focused、import census；production dependency 与 test-only type edge 分离 |

本轮不采纳的只有 N-3 的“加生产超时”建议，理由不是缺实现，而是已定案的 R-S7/no-timeout
边界；其余 finding 均已接受并落实，动态/设备证据仍单独保持 OPEN。

### 2.3 本轮实现过程中发现的回归（不改评审计数）

| finding | 处置 | 代码位置 | 验证方式与边界 |
| --- | --- | --- | --- |
| REG-01 | CONFIRMED→FIXED；`startup.complete` 的 `ports` 组必须在 `__DEV__=false` 也能看到真实 capability descriptor；descriptor 是运行期完整性元数据，不是 dev-only 日志。自定义 focused fixture 显式保留其 port descriptor，未放宽 writer readiness。 | `apps/terminal/kernel/base/platform-ports/src/defaults/*.ts`；`apps/terminal/adapter/android/device/src/implementations/androidDevice.ts`；`apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts`；两组 integration `test/support.ts`；`platformPorts.test.ts` | platform-ports 18/18、sample-console 37/37、sample2 wallpaper 14/14、两个 integration typecheck 已通过；release/Android 仍须设备证据。首败与边界见 `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/focused-first-failure-n2.md`。 |

## 3. 当前源码事实和证据分档

### 3.1 已静态确认

| 档位 | 当前可说的事实 | 不能推出 |
| --- | --- | --- |
| static | 32 个 graph 节点；activeSkeletonBatch=2；R-E6 错误的 picker package.json `kernel-base-platform-ports` devDependency 已删除，graph 与 `src/dependencies.ts` 不再声明该目标（合法 `ui.base.test-support` dev edge 仍在）；root workspaces 已枚举两个新包；两个 App 已有 SDK57 SplashScreenManager 注册与 Theme.SplashScreen/post theme 链；SurfaceRoot.tsx 的两处旧诊断观察仍受 `__DEV__` 保护，但生产 ready 由 ScreenReadyBoundary 接管；requestOutcome 的三类 business 集合；picker actor 已消费两跳 child result；D-1 base-boundary red/green model 已通过；五个 factory 已改为 runtime subset；platform capability descriptor 已改为运行期元数据，`__DEV__=false` 的 port completeness focused 已通过 | 不能推出新代码已完整、构建可过、native 已链接或用户时序正确 |
| baseline static (before B0) | `graph-comparison` 首败是 picker package.json 多出的 devDependency；首败已保留，当前重验见 `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/static-current-reverification-round2.md` | 不能把 baseline 的旧事实继续当作当前源码状态 |
| external static | SDK57 包源码含 core-splashscreen 1.2.0、SplashScreenManager.registerOnActivity 和 preventAutoHideAsync 的自动隐藏语义；官方 Android 要求 install/register 在 super.onCreate 前，主题用 Theme.SplashScreen 与 postSplashScreenTheme | 不能推出本仓改造后的 APK 已使用该链 |
| focused | runtime/platform-ports/render/feature/console/picker/integration focused 与 static red mutations 已执行；platform-ports 18/18、sample-console 37/37、sample2 14/14，render 67/67，U8 focused mutation 通过 | 不能推出 release/Android/Web/visual/cleanup 或完整 U10/U13 |
| native/Android supporting | native focused、两个 release build、两个 App×mobile/dual U8 normal 与 wrong-primary 设备记录已存在 | 不外推为完整 Android、视觉或整体 implementation acceptance |
| Web planned | 仅可作为辅助的逻辑/readback；不替代 native/release/U10 | 本批没有授权或执行 Web |
| release supporting | 当前 APK build 与文件/设备 hash 绑定见 `release-build-current-source-20260915.md`、U8/sample1/sample2 当前记录 | 不得把 supporting 记录宣称为整体 release acceptance |
| cleanup | 受管 U8/sample1/sample2 runner 的 cleanup 均为 PASS；旧失败和线下废弃文件另有记录 | 不把单次 cleanup 外推为所有环境 cleanup |

### 3.2 未验证事实必须如何处理

1. sample1 “surfaces 有但没有 complete”的根因尚未在本轮动态复现；D-7 只把重复
   complete 的旧身份问题视为已知事实，不用猜测补终态。
2. transitive native autolinking 的最终依赖闭包由两个 App 的串行 release build 与 APK
   安装 hash 绑定 supporting evidence 覆盖；这仍不是完整 Android linker/视觉验收。
3. picker 写入后失败已由 U13 真实 runtime child injection、actor readback 与 16 个
   focused tests 覆盖；PF 全量设备矩阵仍保持 OPEN。

## 4. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | 前置条件、R-E6 静态基线根因 | 主 Codex | baseline record、package-only R-E6 repair | sample2 acceptance、static baseline |
| CP-1 | runtime module self-declaration 与边界 checker | kernel/base runtime + tool | derived runtime subset、U2 red、B1 contract | CP-0 |
| CP-2 | Android assembly/base、App thin shell、native splash | assembly/base/android + two App shells | required capability、native manual equivalent、identity/assets projection | CP-1 source contract |
| CP-3 | ui/base/console-assembly、render ready、console diagnostics | ui/base owner | single console writer、ready consumer、sample-console runtime module | CP-1；执行顺序在 CP-2 后 |
| CP-4 | feature skeleton、classifier、notice、picker two-hop | ui/feature owners | U13、sample1 identity-preserving notice、module/assembly shared skeleton | CP-1；不声明对 CP-2/CP-3 的 graph dependency |
| CP-5 | 逐点对账、U10/U13 与交付阻断 | fresh independent reviewer + 主 Codex intake | three reconciliations、evidence ledger、review handoff | CP-0–CP-4 |

## 5. 横切机制对照表

本批无 backend、HTTP、migration、seed；模板相关行以 N/A 给理由，避免把空白误读为漏项。

| 机制 | 现成能力/规范 | 如何验证 | 无现成时必须符合的形态 | 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | 无 backend 读侧；遵守 owner/module source | N/A：本批不改 HTTP | N/A | none |
| 写授权与 grant 复核 | N/A | N/A | N/A | none |
| 跨 owner 写与事务 | kernel child dispatch 只能调用公开 command；无 DB owner 写 | focused actor result/state proof | child command 结果不可丢弃 | picker select/confirm |
| 集合形态与分页 | N/A | N/A | N/A | none |
| 缓存失效 / 改完刷新 | RenderProvider/context 的既有订阅与 selector | focused state rerender | 不新造第二 store；request readback 从同一 runtime | sample1/sample2 UI |
| RTK 数据读取与加载判定 | N/A；非 RTK | N/A | N/A | none |
| 同一事实只有一个住址 | package self declaration、console-assembly single writer、native identity source | static source inventory + red mutation | 不能在 App/helper/第二 writer 复制事实 | module deps、startup events、native identity |
| 失败可见且原因不得改写 | requestOutcome.ts、kernel AppError/9 categories、sample2 R-P1..R-P5 | U10 wrong password、U13 resolved/rejected/write phase | UI 只能显示安全、固定、truthful copy，不显示 raw error | sample1 auth/desk、picker |
| owner 错误到 HTTP | N/A | N/A | N/A | none |
| 幂等键构成与重放 | runtime requestId、唯一 startupRunId、in-flight guard | focused duplicate/request ledger readback | 不以时间戳+模块计数器当全局身份 | startup、picker |
| 生成物不得手搓字符串 | NativeWind generated d.ts 与 package exports | generation/static projection review | 只改 source/helper，不手改 generated declaration | six root configs |
| 日志落点与脱敏 | AGENTS.md observability；sanitizeLogEvent；single-client sink | startup oracle 读实际 sink，检查禁记字段 | 不用 exit code、测试名、Metro 汇总替代结构化日志 | startup diagnostics、U8 record |
| 迁移回填与可逆性 | N/A：无 DB/schema | N/A | N/A | none |
| 前端共享行为 | ui/base/render、ui/base/console-assembly、既有 primitives | focused component/actor tests | 不把 notice body 或 module skeleton 复制到 feature | three feature notices、three feature skeletons |
| 候选/下拉数据源 | sample2 assetsById 和 kernel wallpaper state | U10 option source/selected readback | picker 不从 integration/global observer 取失败 | none/w1/w2/w3 |
| 编码与名称呈现 | frozen sample1/sample2 business corpus | U10 literal partKey/testID/copy | 不改 sample1 identifiers，不暴露 contract/internal error | all sample screens/notices |
| 原子组 | foundation charter §5-C | intermediate error first, then whole group proof | 顺序、预期 error、恢复方式先写并实际核验 | five groups in §10 |

## 6. D-1 至 D-7：结构与平台详设

### 6.1 D-1 分层通则执行体

#### Predicate

对每个 source package：

1. isBase(source) 只按真实 package path 的 base 段判断，不按文件名关键字。
2. targetForbidden(target) 在 target tier 为 feature、integration，或 target 是
   assembly/android 下的 App 时为 true。
3. adapter target 只有在 target 的 platform 段与 source 的 platform 段相同时才因
   R-E1 放行；跨平台 adapter 仍是红。source 为 assembly/base 且 target 为同平台
   adapter 是明确放行的接线方向。
4. violation = isBase(source) AND targetForbidden(target)。
5. App adapter wiring 单独使用 U5 predicate：任何非 base App assembly package 对
   adapter 的 package dependency、源码 import、export、dynamic import、require 或
   cross-package relative path 都是红；这不把 assembly.base.android→adapter 判红。

#### 扫描全集

扫描所有 base 包的 src、test、test-expo、包根脚本和配置、package.json、tsconfig
references/paths；排除 node_modules、dist、build、.turbo、.expo 等产物。解析器必须
覆盖：

- package.json dependencies/devDependencies 与 graph edges；
- value import、import type、export from、export type；
- dynamic import、require；
- TypeScript import equals require；
- .ts/.tsx/.js/.jsx/.mjs/.cjs 解析；
- tsconfig paths/references 指向另一 workspace package；
- 跨包相对路径按 realpath 归属 package 后再判 target。

实现优先扩展 tools/terminal-shared/import-capabilities.mjs 的 AST collector；若它的
parser 不支持 import equals，则使用同一语义解析入口的 TypeScript AST adapter，不能退
回关键词 grep。输出必须包含 source package、target package、形态、文件和唯一 anchor。

#### 红夹具

- 新建一个实现方事先不知道名字的非运行期 base fixture，依赖一个 feature；checker 必红。
- 将同一依赖改成 type-only、export type、dynamic import、require、import equals、根
  cjs config、test 文件和 cross-package relative path；每个变异必红。
- 将 assembly.base.android 依赖同平台 adapter；必须保持绿，证明 R-E1 放行方向。
- 将 assembly.base.android 依赖 adapter.electron.*；必须判红，证明 platform equality
  不是被“adapter 一律放行”绕过。
- 将 App 的 adapter import 从 platformPorts.ts 移到另一个 App 文件；U5 必红。

### 6.2 D-2 新包接入清单和遗漏映射

两个目标包：

- apps/terminal/assembly/base/android，moduleName assembly.base.android；
- apps/terminal/ui/base/console-assembly，moduleName ui.base.console-assembly。

每个包的接入闭包及首个执行体如下：

| 接入项 | 首个红门/观察 | 未抓到时的兜底 | 变更批次 |
| --- | --- | --- | --- |
| root package.json workspaces | workspace enumeration / turbo dry-run | fresh code↔design review | B2 或 B3 |
| package.json name、kind、deps/devDeps | package census | code↔design review | B2/B3 |
| src/moduleName.ts、src/index.ts exports | package invariant/public-surface test | focused package surface test | B2/B3 |
| src/dependencies.ts 与 graph node | graph-comparison/default static | B0/B1 declaration proof | B2/B3 |
| skeleton graph node、batch、count | graph checker/count mutation | D-3 explicit graph review | B2/B3 |
| turbo task/typecheck/test inclusion | turbo dry-run/typecheck task | plan step record | B2/B3 |
| terminal-invariants.json | invariant/public export check | fresh review | B2/B3 |
| package README.md | TR-10 checker + content review | fresh README↔source review | B2/B3 |
| entry reachability | generic non-base assembly entry predicate | random-name third-App mutation + review | B2 |
| layering/base boundary | U11/D-1 semantic checker | fresh source review | B1/B2/B3 |
| identity/native/assets | U6/U7 checker | native source review and U8 evidence | B2 |
| actual module factory/registration | U1/U2 focused runtime | runtime module source review | B1/B3 |
| shared admin console path | U9 focused/source review | TR-13 review | B3 |

entry predicate 是“source tier=assembly 且 tier segment 不是 base”的所有 first-party
App assembly entry；它不硬编码 App 名单，因此 assembly.base.android 不被错误当成
可启动 App。实现时对发现结果执行非空守卫：少于一个真实 App entry 或发现结果为空都
直接失败，不得以空集合通过；扫描明确排除 `assembly/base/*`，并在 root workspace
manifest 与 Turbo dry-run 各自核实。root workspace 漏项不由文件 census 冒充已发现，
必须由 workspace/turbo 观察或 fresh review 明确兜底。

### 6.3 D-3 graph batch

两个新节点均写 batch: 2。B2 与 B3 各负责一次节点增加和对应计数更新：

- B2：31 → 32，加入 assembly.base.android；
- B3：32 → 33，加入 ui.base.console-assembly。

新增跨 batch 边明确为：

1. assembly.android.sample-terminal(batch 1) → assembly.base.android(batch 2)；
2. assembly.android.sample-wallpaper-terminal(batch 1) → assembly.base.android(batch 2)；
3. ui.integration.sample-console(batch 1) → ui.base.console-assembly(batch 2)。

既有 batch1→batch2 边不在本批清理。默认 activeSkeletonBatch=2，证据必须走全图；
除静态 graph projection 外，B1/B3 的每次 checker 调用都显式记录投影值，任何 batch=1
输出只用于回归而不作为全图证据。显式 batch=1 投影可能静默过滤投影外依赖，绝不能作为
通过证据。该字段的历史语义
清理也不在本批范围。

### 6.4 D-4 运行期模块依赖契约

三层集合严格分开：

1. dependencyModuleNames 的期望集合 = package.json dependencies 中 workspace 包
   moduleName 的去重集合；
2. devDependencyModuleNames 的期望集合 = package.json devDependencies 中 workspace
   包 moduleName 的去重集合；
3. runtimeModuleDependencyNames = regular workspace dependency 中由 target 包自己
   声明为 runtime module 的子集。

期望来源是 package.json 和 target self declaration，不是数组自身、集中白名单或
fake descriptor。既有门继续管 package.json↔graph 和 package.json↔静态 source import
集合；本批新 checker 管 dependencies.ts 数组漂移和 self-declared runtime subset。

本批采用的 self declaration 形态是包内 `src/dependencies.ts` 的
`runtimeModuleDependencyNames` literal array，并由生产 `RuntimeModule` factory 的
`dependencies` property 直接消费。checker 不把这个数组当期望来源：它先从每个
workspace package 的 `dependencies` / `devDependencies` 得出 regular 与 dev 集合，
再读取每个被依赖包自己在 `src/moduleName.ts` 中直接声明的 literal
`moduleKind='owner'`；只有 owner 目标才进入 consumer 的 runtime 期望子集。toolkit
或没有 `moduleKind` 的目标不得进入该子集。checker 同时要求 owner consumer 声明
`runtimeModuleDependencyNames`、数组无重复且只含 regular workspace dependency，
并用 AST 确认生产 runtime module 的 `dependencies` property 消费该声明；不得以
集中 allowlist、fake descriptor、optional dependency、数组 spread 或 opaque
expression 代替。这样删除 `dependencyModuleNames` 或 runtime subset 任一数组项而
不改 package/graph 都会在同一 gate 变红。

B1 必须逐一迁移以下五个直接消费完整 dependencyModuleNames 的 factory：

- kernel/base/display-context/src/application/createDisplayContextModule.ts；
- kernel/base/ui-state/src/application/createUiStateModule.ts；
- kernel/feature/sample-member-registry/src/application/module.ts；
- kernel/feature/sample-staff-session/src/application/module.ts；
- kernel/feature/sample-wallpaper/src/application/module.ts。

原有三处 feature 手抄 exclusion 和 integration 的两份 baseModuleDescriptors 也按
批次清除。sample-console 在 B3 增加自己的 runtime module declaration/factory；它
不是“无 factory 反例”。

U1 的未知 non-runtime base 包必须仍然出现在 regular package dependency 中，但不进入
runtime subset；U2 使用真实 createDisplayContextModule 实例：让一个仍需它的真实
ui-state module 保留，故意从 modules registration 移除 display-context，断言
resolveModuleOrder 返回/抛出 Missing required runtime module dependency。不得使用
kernel.base.runtime 作为唯一夹具，因为 createRuntime.ts 会无条件把它注册。

dependencyModuleNames 只改数组而不改 package.json/graph 必须由本批 drift test 判红。
不做三处声明合并；那是范围外，但本批明确增加数组漂移保护。

### 6.5 D-5 splash 原生集成和 ready

#### 选型

选择“已提交 native 工程 + 手工等价接入 SDK57”，不选 CNG：

- 两个 App 的 native 工程、App-specific identity、resource 和手工改动已提交；
- CNG 会引入 prebuild 覆盖/生成边界，不能替代本批要核的 native authority；
- 两个 App 使用同一种手工集成，只把 name/icon/asset/theme content 等配置留在 App；
- Expo JS/native package 仍由 assembly/base/android 作为能力 owner 提供。

#### native contract

assembly/base/android 提供一个 required NativeLoadingCapability，契约放在现有
kernel/base/platform-ports 的 port contract 中，至少包含：

- targetPhysicalSurface：开机画面覆盖的物理 surface identity/display index；
- preventAutoHide 已在 module scope、首个 RN view 出现前触发；
- hideOnce(reason) 返回可观察的成功/失败结果，重复调用幂等；
- failure page 由 `ui/base/render` 拥有。正常 runtime/host/part 分支使用上下文内的
  `StartupFailurePage`；assembly 在 `RenderProvider`/`SurfaceRoot` 建立前被拒绝时，App
  只注入一个 typed `renderFailurePage({reason, displayIndex})` callback，由它渲染同包的
  `StandaloneStartupFailurePage`。该 standalone page 复用固定 testID、文案和 alert 语义，
  只在物理 `displayIndex` 命中 capability 的 PRIMARY target 时调用
  `hideOnce('startup-failure')`；capability 本身不写 runtime state、不派 command、不让业务消费。

不复用 AppControlPort.hideNativeLoading：它的 containerKey/message 语义是应用内 loading，
而且当前 adapter 没有生产实现。也不提供 no-op default；漏传 capability 必须在类型、
assembly focused test 或静态检查中失败，不能在设备上无限挂起。

assembly/base/android 的 module-scope JS 入口负责 expo-splash-screen 的
preventAutoHideAsync；两个 Activity 均手工接入 registerOnActivity，并在
super.onCreate(null) 之前完成注册，不再在此之前用 setTheme(R.style.AppTheme) 抢先切换。
主题必须由 Theme.SplashScreen 链接到 AppTheme 的 postSplashScreenTheme。实际 package
link/autolinking 由 B2 的 native/build proof 确认；若 transitive workspace dependency
没有进入 APK，证据状态保持 OPEN，不得用 JS import 假装完成。

#### ready owner

ui/base/render 新增 ScreenReadyBoundary，挂在 ScreenContainer 的“resolved real part”
分支内部，而不是 App outer root、App assembly loading、SurfaceHostController 的
spinner、host pending 或 fallback branch。它同时要求：

1. 当前布局是被 splash 覆盖的物理 Activity surface，按 explicit physical identity
   或 displayIndex 判断，不用 logical displayMode；
2. host geometry 已 resolved；
3. resolvePart 已得到真实 catalog part，且六种 RenderFallbackReason 全部排除：
   runtime-unavailable、container-empty、missing-catalog-entry、incompatible-catalog-entry、
   missing-renderer、invalid-props；
4. 该 real part 的首次 onLayout 已完成；
5. NativeLoadingCapability 存在且目标 identity 匹配。

这条边界是 release 可执行代码，不得由 SurfaceRoot.tsx 当前两处 __DEV__ 观察替代。
现有 reportLayout 与 mount useEffect 均以 if (!__DEV__) return 开头；它们只能保留
development diagnostics，不能成为 U8 ready 信号。

#### R-S7 failure page

首次就绪前，只有裁定所列终态事实才由 base shell 调用 hideOnce('startup-failure') 并呈现
render-owned failure page；首次就绪后，runtime failure 或 PRIMARY 终态 fallback 使用同一
组件的运行期变体，可恢复宿主移除保留当前画面并等待恢复，SECONDARY 永不显示全屏失败页。
启动期和运行期分别使用 `ui.base.render:startup-failure` 与
`ui.base.render:runtime-failure`，标题分别为“终端启动失败”与“终端运行异常”，说明统一
为“请重启终端，如仍失败请联系管理员”。页面的 code 只含内部 reason 与 error name，
不得含错误消息或敏感值；不添加页内重启按钮。它不伪造业务 part，也不自动恢复 system
notice。

`pending` 本身不是失败事实，不能用一个任意 UI timeout 冒充 native host 的结论；host
owner 必须在已知无法提供 host 时发布 `unavailable`，而 render 在 runtime 已 started、
PRIMARY host 已 resolved 但 `container-empty` 时直接进入失败页。U8 的 no-ready observation
上限只是验证器的 fail-closed 观察边界：达到上限仍没有 ready 或 terminal failure 就 FAIL，
不是生产代码的超时收起策略。

#### U8 时序证据

按裁定④，本轮必须先实际运行 `tools/terminal-sample2/run-a9-runtime.mjs` 作能力探针。
只有把该探针的真实输出与当前源码绑定后，才能确认它是否能驱动 release、两个 App、
真实双屏和 splash/ready/failure 观察；若其扩展成本接近重写，则升级为新的 record-only
release cold-start runner。探针尚未在本轮重新执行前，不能把历史目录当作当前结论。无论
选哪条路，最终执行体都必须具备两个 App、mobile 与真实 dual display、release APK 冷启动、
native splash 可见性、physical PRIMARY 映射、real-part ready、R-S7 failure page 和
时序记录，并复用既有 manifest/PID/serial/screenshot/log/cleanup 约定。

记录必须包含：

- process start 后、ready 事件之前 splash 仍可见的设备 observation；
- `t0-first-rn-content` 的首个 RN 内容 UIAutomator 设备观察，以及同一时刻读取的
  device log snapshot。该观察是“内容已出现后的观察点”，不强行声称 splash 在延迟的
  UIAutomator 返回时仍可见；UIAutomator 返回可能晚于 ready/hide；
- native preventAutoHide 已完成；
- physical primary target、host geometry resolved、real part onLayout 的记录；
- hide request 的时间和返回；
- hide 前后截图/可见 readback；
- 同一 device log 内 `startup.ready-candidate` 先于 `startup.complete` 与
  `startup.ready-hidden` 的顺序。ready-candidate 的生产语义必须仍是 resolved real part
  首次布局，不得用 host `Date.now()` 与 device log epoch 直接比较；
- failure mutation 下 splash 收起和 failure page 出现；
- cleanup、owned PID/serial、log path 和 first failure。

正常成功记录的时序 oracle 是：pre-ready device snapshot 仍见 splash；render-owned
`ready-candidate`（其语义已由源码/ focused gate 证明）后才允许 complete 与 hide；t0
记录首个 RN 内容和其观测时的 splash 状态；settled snapshot 不再见 splash。若 t0 的
UIAutomator 观察已经晚于 hide，必须把 `firstContentObservedAfterReadyHidden` 留在
记录中作为观察延迟事实，不能反向把它报成生产“早收起”；也不能用跨设备/跨时钟的
时间戳比较制造因果关系。

“早收起”反向变异：删除/延后 preventAutoHide，或让 outer root/loading layout 先报告，
设备必须能看到 hide 早于 real part marker；该变异不得通过。
“晚收起”变异：保留 prevent，移除 real-part ready，设备不能在 ready 前自然消失；
达到 R-S7 terminal failure 后才 hide 并显示 failure page。development build 只能辅助
判断 JS 顺序，最终 U8 只接受 release/native device evidence。新 runner 不得通过
debug/Metro、源码 mutation、固定 display index 或单一逻辑尺寸冒充真实双屏冷启动。

### 6.6 D-6 identity authority 和 assets

选择 manual native authority：

- authority：每个 App 的 committed Android 工程；
- mirror：app.json 和 App package metadata；
- App-specific configurable values：name/slug、App label 文案、icon/adaptive asset、
  splash resource 内容/颜色、loading copy/color/testID、persistenceKey、integration
  factory；
- base-owned values：native registration method、SDK dependency、prevent/hide capability、
  shared config helper、identity/asset closure checker。

U6/U7 的完整输入如下，不得只查 app.json 或 Kotlin 目录：

- app.json 的 name/slug/android.package/icon/adaptive icon/web favicon；
- package.json name、workspace dependency 与 package exports；
- android/app/build.gradle 的 namespace/applicationId；
- android/settings.gradle 的 rootProject.name 和 Expo module linking；
- 每个 MainActivity.kt、MainApplication.kt 的逐文件 package 声明；
- AndroidManifest.xml 的 label、icon、roundIcon、activity theme；
- values/strings.xml 的 app_name、values/colors.xml；
- values/styles.xml 的 Theme.SplashScreen、windowBackground、
  postSplashScreenTheme；
- Android resource compiler 的真实入口：每个 splash drawable 必须位于被
  `src/main/res` 编译的 drawable/mipmap 资源集合中，并由 `aapt2`/Gradle 资源编译和
  manifest/theme 引用共同证明；仅存在于 JS assets 或 README 登记不算 native splash
  资源。缺少 drawable、无 consumer 或未进入 APK 的资源都判红。
- mipmap-anydpi-v26、mipmap-* 的 ic_launcher/ic_launcher_round adaptive XML 和
  真实 bitmap/vector 引用；
- App assets/ 下所有 first-party 文件和 README 登记。

封闭 asset 规则：

1. app.json 引用→文件存在；
2. assets/ 每个非 README 文件→必须被 app.json 引用或被明确登记；
3. 登记格式为单独表格行：relative path、owner=app-config 或 owner=native-resource、
   consumer file、reason、dimensions、sha256；
4. README.md 本身是文档，不算 image asset，但必须有合法中文内容；
5. sample-terminal/assets/splash-icon.png 不被 app.json 或 native styles 使用，必须在
   source census 中确认缺失；当前字节已确认该文件不存在，因此不重复删除。不得把
   native `res/drawable-*/splashscreen_logo.png` 误当成 App JS asset；不得同时声称
   “删除或登记”。清理记录见
   `doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/obsolete-file-cleanup.md`；
6. sample-wallpaper-terminal/assets/README.md 的五张 PNG 保持现有登记格式；native
   res/splashscreen_logo 另按 native-resource 登记，不把 app.json 未引用的 native
   drawable 偷塞进 app asset 清单；
7. 两个 App 使用同一 checker 和同一双向 closure 规则。

App discovery 是确定性的：从 root workspace 的 `apps/terminal/assembly/android/*`
目录读取 package.json、app.json 和 Android 工程三者交集，只接纳同时具备 App assembly
入口、`android/app/src/main` 与 app.json 的目录；`assembly/base/*`、node_modules、
build、dist 和空目录显式排除。发现结果少于两个或任一输入集合为空立即失败，不能把
空集合当作“没有漂移”；每个发现的 App 必须逐项进入同一 identity/asset projection。

### 6.7 D-7 startup diagnostics

当前 production console assembly 每次创建 assembly 都直接以
`createRuntimeInstanceId()` 生成 startupRunId；它不接受 platform ports 或其他 client
传入的 override，避免两个 client 复用外部 id。release 中 platform-ports 不建立 DEV
tracker，因此生产 `startup.complete` 的 emitted id 来自 console writer；在 `__DEV__`
focused harness 中，platform-ports logger 会用自己的 per-client tracker id 覆盖 startup
事件字段，这是开发诊断关联的权威值，不能把测试里看到的 tracker id 误称为 writer
入参。该 identity 仍需由 U3 的双实例/旧 run/缺失 mutation 证明，不能把随机后缀的源码
形态直接当作 exactly-once 证据。run record 还携带 app、client、display/surface
provenance，避免 HMR 或第二客户端串入。

唯一生产写入端是 ui/base/console-assembly 的 shared startup writer。两个 App 的
assembly 只调用它；platform-ports 负责消费/跟踪端，不直接成为第二个 production
writer。platform-ports 的 startupDiagnostics.dev.test.ts 直写 logger 是测试 helper
捷径，必须改为通过真实 writer/真实 assembly trigger；不能用测试 helper 代替生产入口
触发证据。

ready consumer 的生命周期还必须覆盖真实部件导航：ScreenReadyBoundary 位于当前
resolved real part 内部，登录成功后切换到 wallpaper picker 会重新挂载 boundary，但
同一个 console runtime 只能接受一次 primary startup-ready/complete。该边界由
console-assembly 的每-runtime promise gate 负责：首次 dispatch 的 promise 在进行中或
已完成时被后续 boundary 复用；只有首次 dispatch 真正失败才清除 gate 并允许重试。
writer 自身继续保留 duplicate-complete 的严格诊断，不把重复写入静默去重。这样既不
把部件导航误判成第二次 cold start，也不会掩盖两个 writer 或两个 runtime 身份的错误。
实现核验是 `sample2Assembly.test.tsx` 的 anonymous login → real picker remount 测试，
并须有一次真实 Metro supporting readback：picker 的 `startup.ready-candidate` 后为
`startup.ready-hidden`，无 `startup.ready-failed`，且该 runtime 只出现一个 complete。

U3/U4 使用单客户端、development build、独立 sink。不得读
.expo/dev/logs/start.log 这样的 Metro 多客户端汇总流。oracle 按唯一 run 关联：
declared/measured surfaces、writer、六个 startup group、complete、startup.failed
和异常。规则是：

- 每个 required group 恰好一次；
- 每个 run 恰好一个 complete 或一个明确 failed；
- duplicate complete、missing complete、旧 run surface/complete 串入均失败；
- 没有 complete 不能被“出现过日志”替代；
- 当前生产只有 createRuntime.ts:432 的 startup.failed，不声称所有 failure/finally
  出口已有终态；缺 complete 的 failure 直接是 oracle FAIL；
- 若为了覆盖早期 resolve failure 新增生产终态发射，超出需求 §6 的“不新增诊断面”，
  必须停止并另请 Dexter，不在本文偷偷增加。

sample1 中重复 complete 的已知事实按 R-E7 处理：两 tracker 共用旧 runId，不能
parser 去重。16 个有 surfaces 无 complete 的根因未在本轮动态核清，先保留为诊断
failure，B3 只在真实 single-client sink 上修复/复验。

## 7. D-8 判据执行体总表

常驻 = 进入默认 verify/focused test 的执行体；一次性 = 本批 acceptance/review 必须
产出的 evidence。表中 planned 路径在实现前都不是当前存在性证明。

| U | 执行体 | 批次 | 必须 red 的最小变异 | 绕过闭合与证据档位 |
| --- | --- | --- | --- | --- |
| U1 | runtime dependency checker + self-declaration focused test | B1 contract，B3 close | 新 non-runtime base dependency；集中 exclusion；optional:true；新 integration runtime package | target self declaration、opaque package、array/graph/package drift；常驻 static/focused |
| U2 | resolveModuleOrder runtime focused test + package contract checker | B1/B3 | 移除真实 display-context registration；optional:true；fake module name | 断言真实 Missing required runtime module dependency；数组漂移和 package/graph 也红；常驻 focused |
| U3 | check-diagnostics + two App real writer triggers + single-client sink + navigation remount regression | B3 | 删除 kind、writer skeleton、一个真实 writer trigger；保留第二 writer；让 real-part navigation 再次 dispatch complete | 每个生产 writer 都触发；shared helper alone 不算；navigation 后仍单次 complete；dev focused/acceptance |
| U4 | startup oracle + failure/duplicate red mutations | B3 | early complete、duplicate、缺 complete、旧 run 串入 | 先唯一 run，再 exactly-one；不 parser dedupe；dev focused/acceptance |
| U5 | base boundary/App adapter-wiring AST checker + review | B1/B2/B3 | App 移 adapter 到另一个文件、relative/type/export/dynamic/require | base→feature/integration/App 红；assembly.base→same-platform adapter 绿；static/review |
| U6 | two-App native identity projection checker | B2 | 只改 app.json、只改 directory、Kotlin package/manifest/Gradle 不同、两 App 撞名 | 逐文件 native inputs、两 App、mirror relation；static/native supporting |
| U7 | asset closure checker + orphan/reference mutation | B2 | 删除 referenced asset；增加 orphan；README 登记缺字段；两 App 不同规则 | 双向 closure、native drawable separate registry、ST orphan unique deletion；static |
| U8 | new record-only release cold-start runner + device observation（旧 run-a9 仅 supporting probe） | B2 provider/build, final acceptance after B4 + whole-scope reconciliation | remove/delay prevent；outer/loading/pending/fallback ready；force R-S7 | 两 App×mobile/dual×release cold；timeline distinguishes early/late and failure page；native/release one-time |
| U9 | both integration focused tests + TR-13 source review | B3 | second catalog/openLayer/input；launcher without admin parts；admin code in console | one shared admin-shell catalog/openLayer/input; no new machine gate; focused/review |
| U10 | frozen sample1/sample2 journey acceptance | B4 final | skip login/confirm/restart/shape; rename sample1 IDs; omit exact layer sets | D-9 literal row-by-row, dual/mobile/cold restart；one-time acceptance |
| U11 | D-1 semantic source/package/graph checker | B1/B2/B3 | all AST forms, root/test scope, indirect base edge | no keyword-only; R-E1 adapter direction explicit；常驻 static |
| U12 | closed six-file projection checker + projection mutations | B2 | private Babel plugin/.babelrc；private tsconfig/generated d.ts；only 3 files | exact allowed-key schema and root census；static |
| U13 | picker real production dispatch focused/runtime injection + recovery matrix | B4 | keep void；only confirm/resolved；integration/global observer；write-before/after confusion；stuck request | real actor child propagation, select+confirm, resolved+rejected, state readback, notice and retry success；focused then acceptance |

所有新 checker 必须在实现时有真实 red mutation。checker 文件存在、关键词命中、测试
名字、字段出现次数或 exit code 单独不能作为语义判定。常驻门与一次性 evidence 必须
在记录中分开。

## 8. D-9 回归矩阵

以下是实现目标，不是当前 evidence。每行的 partKey、layerId、testID 和 state 均须
从冻结文件 readback；不能由实施者把矩阵改名来适应实现。

### 8.1 U10 sample1 正常旅途

双屏和手机分别跑冷启动；双屏必须额外 readback SECONDARY，手机必须证明没有第二棵
surface。sample1 既有 notice identity 不改。

| case | 入口与操作 | 双屏预期 PRIMARY / SECONDARY | 手机预期 PRIMARY | state / layer / identity |
| --- | --- | --- | --- | --- |
| S1-01 | 冷启动，未登录 | sample.auth.login / sample.desk.customer-welcome | sample.auth.login | anonymous；无业务层；真实 screen part |
| S1-02 | sample.auth.login 输入错误工号或密码，点 sample.auth.login:submit | sample.auth.login + layer sample.auth.notice / sample.desk.customer-welcome | sample.auth.login + sample.auth.notice | session 未 authenticated；auth notice 的 partKey/layerId 保持既有；message、actions、dismiss 五类节点保持 |
| S1-03 | 用正确凭据再次 submit | sample.desk.member-list / sample.desk.customer-welcome | sample.desk.member-list | staff session established；auth notice closed |
| S1-04 | 点 sample.desk.member-list:add | sample.desk.member-form / sample.desk.customer-welcome（不派 SECONDARY showScreen） | sample.desk.member-form | empty local draft；副屏保持 welcome |
| S1-05 | 填 name、phone，点 sample.desk.member-form:submit | sample.desk.member-list + layer sample.desk.waiting-confirm / sample.desk.customer-member props mode=confirm | sample.desk.customer-member props mode=handheld-confirm | pending 有 name/phone；确认态同时存在；双屏 primary waiting |
| S1-06 | 顾客在双屏点 sample.desk.customer-member:confirm；手机点同一确认 | sample.desk.member-list / sample.desk.customer-welcome | sample.desk.member-list | members 增一；pending=null；waiting closed；confirmation 完成 |
| S1-07 | 顾客点 reject/cancel | sample.desk.member-list + waiting-confirm + registry-notice / sample.desk.customer-welcome | sample.desk.member-form + registry-notice | pending 仍在；双屏 standard+alert 层并存且 alert 在上；手机无 waiting |
| S1-08 | 在 registry-notice 选 sample.desk.registry-notice:retry | sample.desk.member-form / sample.desk.customer-welcome | sample.desk.member-form | registry-notice/waiting 按形态关闭；form 用 pending 的 name/phone 回填 |
| S1-09 | form 放弃动作先打开 sample.desk.discard-confirm，再确认放弃 | sample.desk.member-list / sample.desk.customer-welcome | sample.desk.member-list | discard-confirm 只在确认中存在；确认后 pending 清除；草稿不进业务 store |
| S1-10 | 双屏 waiting-confirm 点 withdraw，确认 sample.desk.withdraw-confirm | sample.desk.member-list / sample.desk.customer-welcome | N/A | withdraw-confirm 关闭；pending 清除；顾客离开 confirm；不得残留年龄 |
| S1-11 | 冷重启已确认后再进入列表；冷重启未确认 pending 后复核 | sample.desk.member-list / customer-welcome；按 frozen persistence rule | same PRIMARY only | members、operator-name 真实持久化恢复；request ledger 的过期记录不恢复；不得把未提交 local draft 当 store 事实 |
| S1-12 | 退出并先制造两屏残留 layer 后点 logout | sample.auth.login / sample.desk.customer-welcome | sample.auth.login | PRIMARY/SECONDARY 层都清空；session cleared；不能从干净态断言 vacuous pass |
| S1-13 | 顾客补充年龄：双屏点 age，手机点 age | customer-member mode=confirm，键盘在 SECONDARY | mode=handheld-confirm，键盘在 PRIMARY | S-30/S-31；同一 component/代码；纯数字，最多 3 位 |
| S1-14 | S-32 不填 age 直接 confirm；S-33 填 age 再 confirm | 双屏 | 手机 | 空 age 正常登记且 age undefined；填写值在 members.age 等于输入；不得阻塞或静默丢失 |

既有 notice 每个固定五个 testID：

- sample.auth.system-notice、sample.auth.system-notice:title、:message、:actions、
  :dismiss；
- sample.desk.system-notice、sample.desk.system-notice:title、:message、:actions、
  :dismiss。

其 title 是“系统提示”，message 是现有“操作没有完成，请重试”，dismiss 的
accessibilityLabel 是“关闭系统提示”，button 文案是“知道了”，message role 是
alert；迁移 body 不得改变它们。

### 8.2 U10 sample2 wallpaper 正常旅途

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

sample2 literal secondary keys are sample.wallpaper-console.waiting and
sample.wallpaper-console.welcome. 不以 success text 替代 part/layer/state；state 以
sample2 requirements §9 和其 acceptance-approved design version 为准。

### 8.3 U13 picker system-failure 注入

注入必须发生在真实 production dispatch boundary：WallpaperPicker → picker command
actor → kernel child command。不能只调用 reducer、纯 classifier 或模拟父级 promise。
每个 PF case 先在 focused runtime dual fixture 跑，再在获准 acceptance 的 dual/mobile
形态复验。system notice 冷重启不恢复，故 PF-05 用于证明“无恢复”，不是 sample2
持久层恢复。

| case | 入口/注入 | 预期身份 | 预期 state 与恢复 |
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

写入 phase 判定使用 action 前快照和 child 结束后的同一 runtime state：
select 的 pending 从 old→requested 是 write-after；confirm 的 confirmed 从 old→requested
是 write-after。没有 state mutation 就是 write-before。若 child result 和 state readback
矛盾，测试必须失败，不允许让 UI 自己猜。

## 9. D-10 至 D-14：owner、配置、分类与 picker 详设

### 9.1 D-10 assembly 只声明依赖

采用 dedicated NativeLoadingCapability，所以 adapter-android-app-control 和
adapter-android-logger 如果仍无真实 production consumer，必须从 assembly/base/android
和两个 App 的 package declarations 删除；不能用 dependencies.ts 中的 import 充当使用。
persist-kv、device、dual-screen 以及实际 logger/platform binding 仍保留实际消费者。

若实施发现已有 adapter 包存在其他真实 assembly consumer，按 source census 绑定到该
consumer，不为本批 splash 新建第二条 bridge。不得同时实现 AppControlPort branch 和
NativeLoadingCapability branch。

### 9.2 D-11 六个根构建配置文件

两个 App 都保留六个文件，但共享部分通过 assembly/base/android 的 helper/exports
提供；helper 的调用契约是封闭的：

| 文件 | shared helper | App 允许保留的差异 | 禁止 |
| --- | --- | --- | --- |
| babel.config.cjs | createBabelConfig({appDir}) | 无；两边 projection 等价 | 私有 plugin/preset、第二 preset 面 |
| tsconfig.json | shared base extends/projection | 无 private compilerOptions；两 App 必须逐字相同 | 私有 tsconfig、额外 path alias、无依据的 integration include 自由槽位 |
| global.d.ts | shared declaration reference | 无 | App-only ambient declaration |
| metro.config.js | createMetroConfig({appDir, globalCssPath}) | 仅 integration global.css path | 私有 resolver/Module._initPaths 行为 |
| tailwind.config.cjs | createTailwindConfig({appDir, content, theme, darkMode}) | 仅 content、theme 取值、WP 需求允许的 darkMode | private preset、未登记 key |
| nativewind-env.d.ts | generator output | 只能由同版本生成链产生 NOTE/路径差异 | 手写声明或私有 generated file |

checker 同时发现 App 根目录的额外 .babelrc、.config.*、package.json 配置键和
私有 generated declaration。允许差异集合是需求 §3.1 的闭合集合，不接受“实现需要”
作为新自由槽位。每个 helper 传入 appDir，避免把 ../../../node_modules 写死成
共享深度；Metro 的 global.css 差异仍归 integration/App。

### 9.3 D-12 requestOutcome 完备分类

当前实现语义必须逐行保留：

| 输入 | 输出 |
| --- | --- |
| result.status === completed | completed |
| result.status === running | running |
| status 为 partial-failed、timed-out 或 error，且过滤 null 后 errors.length=0 | system-failure |
| 上一行状态且 errors 非空，所有 category 属于 AUTHENTICATION、BUSINESS、VALIDATION | business-failure |
| 上一行状态且 errors 中任一 category 不属于上述三类 | system-failure |

因此 9 个 kernel category 的闭合取值为：

- business-failure：AUTHENTICATION、BUSINESS、VALIDATION；
- system-failure：AUTHORIZATION、NETWORK、DATABASE、EXTERNAL_API、SYSTEM、UNKNOWN；
- 空 error、混合 business+system、任一未知 category 防御性归 system-failure。

这意味着 aggregate status=error 的单 actor AUTHENTICATION 仍是 business-failure，
不能用 status 名字把输错密码显示为系统提示。D-12 focused test 要覆盖 completed、
running、partial-failed、timed-out、error，空 errors、每个 category、全 business
集合和 mixed 集合；picker 与 sample1 均只调用这个 base classifier，不复制表。

### 9.4 D-13 App 壳

两个 App 保留 index.ts、App.tsx、src/assembly/platformPorts.ts：

- index.ts 运行期 import App；
- App.tsx 运行期 import platformPorts；
- App.tsx 只传 App config、assembly factory、persistenceKey、loading copy/color/testID
  和 required platform capability；
- App 不 import/require adapter，不含 bootstrap，不含动态 import/require；
- App 不判断 R-S1 ready，不调用 hideNativeLoading，不写 runtime state；
- assembly/base/android 提供薄壳共用 assembly cache/loading/failure shell；
- App-specific integration factory 和 theme/config 由 App 保留。

App 负责配置“是什么”，base 负责能力“怎么做”。R-S6 的 ready 观察只能由
ui/base/render 的 ScreenReadyBoundary 完成。

### 9.5 D-13A ui/feature skeleton 上收目标

本节是需求 B4 所要求的 `ui/feature` module/assembly 骨架上收的专属设计目标；它不
是 D-13 的 App 壳，也不改变 D-13 的薄壳约束。三个 feature 的重复骨架只上收结构，
不把业务 operation、part identity、actor、业务文案或 testID 变成共享事实。

| 项 | 设计结论 |
| --- | --- |
| target owner | `apps/terminal/ui/base/feature-assembly`，moduleName `ui.base.feature-assembly`；它是 B4 的 base toolkit，不是 App assembly，也不承载 feature 业务状态 |
| public shape | `createFeatureAssemblyModule(input)` 返回可取消注册的 `RuntimeModule`；`createFeatureAssembly(input)` 只接收 feature-owned descriptors、shared render/dispatch capability 与 runtime module subset；`moduleName.ts`/`dependencies.ts`/`index.ts` 是唯一公共入口 |
| consumers | `sample-staff-auth`、`sample-member-desk`、`sample-wallpaper-picker` 各保留自己的 `src/application/module.ts` 和 `src/assembly/assembly.ts` 薄适配层，调用 shared factory；每个适配层仍声明自己的 operation、parts、actors 和 testID source |
| dependency rule | shared package 只依赖允许的 kernel/base 与 ui/base 包；三个 feature 的 package/graph 只依赖 `ui.base.feature-assembly` 和各自业务 owner；不得反向依赖 feature/integration/App |
| lifecycle | factory 返回真实 `RuntimeModule`，并可从真实 module registry 移除；不能用 descriptor、whole dependencyModuleNames、optional dependency 或静态测试替身伪造 runtime ownership |
| acceptance | U1/U2/U11 检查三份 feature module/assembly 的 actual import、package、graph、README 和可取消 runtime registration；只迁 requestOutcome/body 而保留三份骨架或把业务身份挪入 base 都判红 |

实施先建立 shared factory 与最小真实 module，再逐一改三份 feature adapter；删除重复
骨架前必须先跑中间 resolver failure，确保缺失 registration 会真实失败。该目标与
requestOutcome（D-12）及 notice body（D-14）是不同 owner：前者只复用结构，后两者
分别复用分类函数与展示 body。

### 9.6 D-14 notice 与 picker

#### base notice body

common body 放在 ui/base/render，不放 ui/base/console-assembly，也不放任何 feature。
它只接收安全的 title/message/operation presentation props，不接受 raw AppError、
error payload 或跨 feature command。默认 sample1 文案固定为“操作没有完成，请重试”。

三份 notice：

1. sample.auth.system-notice：partKey/layerId/rendererKey 全保持
   sample.auth.system-notice；
2. sample.desk.system-notice：partKey/layerId/rendererKey 全保持
   sample.desk.system-notice；
3. picker 新 notice：partKey/layerId/rendererKey 固定为
   sample.wallpaper.system-notice。

每份都有 root、title、message、actions、dismiss 五个 testID，实际节点分别是
part root、PrimitiveHeading、PrimitiveText(alert)、PrimitiveActions、真实
PrimitiveButton。sample1 的 10 个既有 ID、文案、card layout、alert role 和
accessibilityLabel 不改；picker 的 5 个新 ID 由 picker 自己的 test ID source 定义，
但不得复用 sample.auth identity。

#### owner 与 close

feature 保留 operation enum、part description、partKey/layerId、observed/dismissed
command 和 feature actor。base 只提供 body/factory。三个关闭入口都要接同一 feature
dismiss intent：dismiss button、LayerStack backdrop、Android back。若同一 feature
identity 已在场，actor 以 idempotent guard 保留一个现有层，不让 content actor 的
duplicate exception 变成未处理 rejection；不同 feature 的 identity 独立 open。

system notice 不参与冷重启 layer persistence。serialize/hydrate 后不应重新出现；
sample2 的 pending/confirmed 选择仍按 sample2 §9 的持久化规则。PF-06 同时断言这两
个事实，避免把 notice 无恢复误做成 wallpaper 无恢复。

#### request lifecycle

每个生产 action 遵循：

1. action-specific in-flight guard；
2. request.start()；
3. dispatchWithRequestId；
4. resolved result：running 继续观察，其余完成 request；
5. rejection：先完成 request，再按 feature policy 处理；
6. classifier=business-failure 走业务既有提示；system-failure 派本 feature 的
   systemFailureObservedCommand；
7. close/retry 成功后再次 readback request/state。

sample1 既有四个入口的 rejection observable contract 继续保留：它们先完成/处理
后按现有 focused contract rethrow，不借此改样例旅途。picker 两个入口必须 catch
并消费 rejection，避免 PrimitiveButton 丢掉返回值造成 unhandled；这不等于吞掉失败，
因为 notice、request state 和 state preservation 都要可见。

#### two-hop child result

picker actor 两处 child dispatch 都必须保留 before snapshot、await child result、
after state readback：

- child completed：父 actor正常返回；
- child resolved non-completed：构造安全的 feature child failure AppError，保留
  category 和 write phase code，抛给父 dispatcher；
- child rejected：同样捕获、readback、构造安全 rejection failure，不 return null；
- phase 只由同一 runtime 的 before/after confirmed/pending state 推出，不显示 raw error。

write-before 和 write-after 的提示以及 state 见 §8.3。没有证据证明 write-after
可达之前，不得把它列为已实现；U13 必须让至少一个真实 injected child path 经过
production actor，若现有 kernel 无法在不破坏业务语义下暴露该路径，记录为
UNVERIFIED_REQUIRES_EVIDENCE 并交回 Dexter，而不是将 PF-03/PF-05 改成假测试。

## 10. 原子组、公共面和 code↔design 分母

foundation-charter §5-C 要求先写实际中间错误，再完成整组。下列五组的中间错误文本
必须在实现时以最小 focused proof 核验；本文没有把它们写成已运行事实。

| 组 | 组内顺序 | 预期中间报错/失败 | 完成条件 |
| --- | --- | --- | --- |
| A runtime contract | self declaration helper → 五 factory derived subset → feature exclusion removal → dependency checker | 只删 exclusion/descriptor 时，真实 resolver 抛 Missing required runtime module dependency 或 array mismatch；错误若不符先停止 | U1/U2 red+green、默认 static、stage reconciliation |
| B native base | workspace/package/graph → port contract → native package/link → Activity/theme → App thin shell | 只换 App import 而 native 未注册时，static/native proof 失败；无 capability 时类型/focused failure | U5/U6/U7/U8 supporting static、stage reconciliation |
| C console/render | console-assembly skeleton → single writer → integrations descriptor removal → sample-console runtime module → ScreenReadyBoundary | 先删 descriptor 时真实 runtime 缺依赖；先启用 render consumer 而未传 required capability 时 focused type/assembly failure | U1/U2/U3/U4/U9、stage reconciliation |
| D feature uplift | shared feature module/assembly factory → requestOutcome → notice body → sample1 migration → picker two-hop | 只迁 body 而 feature identity缺失，package/focused identity fail；只改 void 入口而 actor return null，PF-01 fail | U10/U12/U13 focused、stage reconciliation |
| E evidence/closure | actual implementation file census → code↔design → whole-scope 3D → dynamic authorized evidence | 未来文件/作者自报数字不能闭合；任何 OPEN 阻断下一层 | all three reconciliation records and evidence ledger |

逐代码与详设分母包括：所有实际变更源码、测试、package.json、graph、invariants、
README、六根配置、App/native resource、tool checker、run-a9 extension、U10/U13
fixture 和 evidence schema。不能只列“主要文件”。

## 11. D-1 至 D-14 对账摘要

| D | 结论 | 依据与必须保留的约束 | proof 状态 |
| --- | --- | --- | --- |
| D-1 | semantic AST + package resolver；R-E1 adapter direction allow | 全 base scope、all import forms、App U5 separate | IMPLEMENTED_STATIC_WITH_OPEN_FINAL_REVIEW |
| D-2 | 13 项接入清单逐项 mapping | root workspace、census、graph、turbo、invariant、README、identity、entry 不漏 | IMPLEMENTED_WITH_OPEN_FINAL_REVIEW |
| D-3 | both new nodes batch=2；B2/B3 each +1；default full graph | batch1 projection cannot be evidence；old edges not cleaned | STATIC_DESIGN_MATCHED |
| D-4 | self-declared runtime subset + dependency array drift | 5 factories B1；sample-console B3 runtime module；no optional/fake shortcut | IMPLEMENTED_STATIC_WITH_OPEN_FINAL_REVIEW |
| D-5 | manual native equivalent + required capability injection + real-part ready | Activity before super；Theme.SplashScreen；U8 record release/dual/mobile | IMPLEMENTED_RELEASE_SUPPORTING_WITH_OPEN_FULL_ACCEPTANCE |
| D-6 | native committed files authority; app.json mirror; closed native/asset inputs | strings/mipmap/styles/manifest/Kotlin/Gradle all included；ST orphan unique deletion | IMPLEMENTED_BUILD_SUPPORTING_WITH_OPEN_FINAL_REVIEW |
| D-7 | unique run first, single-client sink, single writer, no invented failure terminal | duplicate/missing/old-run fail；sample1 16 incomplete root remains to verify | IMPLEMENTED_FOCUSED_WITH_OPEN_FINAL_ACCEPTANCE |
| D-8 | U1-U13 table with execution body, batch, red mutation, bypass closure | static/focused/native/Android/release/cleanup separated | IMPLEMENTED_WITH_OPEN_ACCEPTANCE_LEDGER_ITEMS |
| D-9 | U10/U13 separate literal matrices | all forms, cold restart, sample1 identity, sample2 waiting/welcome | OPEN_ACCEPTANCE |
| D-10 | remove declared-only app-control/logger under selected bridge | no two bridge paths；real consumers only | IMPLEMENTED_FOCUSED_WITH_OPEN_FINAL_REVIEW |
| D-11 | six-file closed projection | only requirement-listed differences；no private config surfaces | OPEN_STATIC |
| D-12 | exact current requestOutcome table | 9 categories, AUTHENTICATION business, empty/mixed defensive system | IMPLEMENTED_FOCUSED_WITH_OPEN_FINAL_REVIEW |
| D-13 | App thin shell retains required files, never decides ready | base shell supplies structure；render owns ready | IMPLEMENTED_FOCUSED_WITH_OPEN_FINAL_REVIEW |
| D-13A | ui/feature shared module/assembly factory with three thin feature adapters | shared structure only；feature keeps operations, parts, actors and IDs；real cancellable RuntimeModule | IMPLEMENTED_FOCUSED_WITH_OPEN_FINAL_REVIEW |
| D-14 | base body; feature identity/commands/actors; picker child propagation | no system notice restore；three close paths；write phase truthful | IMPLEMENTED_FOCUSED_WITH_OPEN_ACCEPTANCE |

## 11.1 CP gate cards

The following cards make each CP falsifiable. A card is not a claim that the gate has
run; its status remains OPEN until the named source, red mutation, and independent record
exist. A green command without the card's invariant is insufficient.

### CP-0：前置条件与基线

- FORBID：在 sample2 implementation acceptance or terminal static baseline is red时打开 B1–B4；只改 dependencies.ts 而不处理 graph/package declaration；把历史 handoff 数字当当前基线。
- RECALL：需求 §4.0、R-E6、terminal static checker/graph comparison source、sample2 implementation acceptance source；当前已知首败是 picker package.json 多出的 devDependency。
- INVARIANT：sample2 acceptance 先独立通过（本批 picker defect 不重复计入）；terminal static baseline 的首败被记录，按 R-E6 删除 package.json 中错误的 `kernel-base-platform-ports` 声明，graph/dependencies.ts 同步保持“不声明该目标”（合法 `ui.base.test-support` dev edge 不删除），随后全绿；若前置不成立，所有 B1–B4 gate 都保持 BLOCKED。
- SHAPE_RATIONALE：前置先锁定可工作的 sample2 与可解释的静态依赖图，避免基础设施修复把既有失败混入新批次。
- FALSIFIABLE_FAILURE：缺任一前置记录、picker package.json 仍声明 test-only platform-ports、graph/dependencies.ts 声明该目标、误删合法 test-support edge，或 baseline 仍在同一首败停留，即 CP-0 FAIL/OPEN。
- GATE_RESULT：OPEN_PRECONDITION。

### CP-1：runtime module 依赖与建包

- FORBID：手抄排除表、optional 依赖伪造、只声明 moduleKind、不建真实 runtime factory、把五个 dependencyModuleNames 工厂或三个 feature exclusion 遗漏在清单外。
- RECALL：需求 §2.2、§4.1、U1/U2/U11、D-1/D-2/D-4；kernel runtime resolver、module factory source、graph/package/workspace source。
- INVARIANT：目标包的自声明 runtime factory 产生 dependency subset；五个依赖伪造 descriptor 的 factory 在 B1 纳入；三类 feature exclusion 消失；B3 sample-console 成为可取消的真实运行期模块；resolver、graph、package、workspace 与 README 的边界一致。
- SHAPE_RATIONALE：依赖集合必须从可执行 owner 声明推导，才能同时挡住漏注、假包和“删一个排除项就绿”的自然捷径。
- FALSIFIABLE_FAILURE：任意 factory 仍以 whole dependencyModuleNames 伪造自身、fixture 只能靠不可取消的 kernel/base runtime、或只删 descriptor 便 static/runtime 通过，即 CP-1 FAIL/OPEN。
- GATE_RESULT：OPEN_IMPLEMENTATION。

### CP-2：原生集成与开机画面

- FORBID：Activity 在 super.onCreate(null) 后注册；无真实 native capability 的 no-op bridge；把 fallback part 当 ready；用 app.json 或字符串关键词替代原生真实读取入口；把 App 壳当 ready owner。
- RECALL：需求 §3.0/§3.1/§3.2、R-E1/R-E2/R-E3/R-S7、U5–U8/U12、D-5/D-6/D-11；官方 SDK57/Android splash 文档与两个 App 的 native project source。
- INVARIANT：assembly/base/android 是单一 native capability owner，注册位于 super 前；Theme.SplashScreen/postSplashScreenTheme 及实际构建入口完整；PRIMARY 是物理 Activity 主表面且排除六种 RenderFallbackReason；ready 只来自真实 resolved part 的 geometry/layout；无 ready 时进入失败页并收起 splash；U8 由 release 手机/双屏冷启动记录证明时序。
- SHAPE_RATIONALE：原生 splash 的真实读取链与渲染 ready 是两个不同边界，必须分别证明，不能由薄 App 壳的返回值或 development-only 观察代替。
- FALSIFIABLE_FAILURE：删掉 native 注册、改为 no-op、让 fallback 触发 ready、把 capability provider 移除仍 focused 通过、或只能证明 development/mobile 单形态，即 CP-2 FAIL/OPEN。
- GATE_RESULT：OPEN_NATIVE_AND_RUNTIME。

### CP-3：console、render 与诊断闭环

- FORBID：多 writer、客户端猜 run id、全局多客户端 sink、HMR 旧 run 混入、只启用 __DEV__ tracker、在 integration 私藏 console assembly、用启动事件代替 rendered ready。
- RECALL：需求 §2.1/§2.3、R-E5/R-E7、U1/U3/U4/U9、D-4/D-7/D-8；createPlatformPorts、ScreenContainer、SurfaceRoot、console integration source。
- INVARIANT：run identity 在第一次写入前唯一且有断言；唯一写入端为 ui/base/console-assembly；oracle 只读单客户端 sink；sample-console 运行期模块和 integration assembly 对接共享 admin console；focused ready tracker 包含反向变异并不依赖 __DEV__ 才能观察。
- SHAPE_RATIONALE：诊断事实必须有单一写入 owner，读取与写入不可互相伪造；ready 是 rendered surface 事实而不是 runtime lifecycle 事实。
- FALSIFIABLE_FAILURE：两个 writer 同时可写、相同 run id 可被两 client 接受、只有启动失败事件而 resolver 失败无终态、或 production path 不产出可读记录，即 CP-3 FAIL/OPEN。
- GATE_RESULT：OPEN_IMPLEMENTATION_AND_FOCUSED。

### CP-4：feature 语义、sample1 冻结旅途与 picker 失败

- FORBID：requestOutcome 分类表凭记忆重写；把 AUTHENTICATION 当 system；入口 void 就忽略 actor child result；写入后仍提示“未写入”；system notice 冷重启恢复；修改 sample1 frozen partKey/layerId/testID。
- RECALL：需求 §3.4/§3.5、R-E4、U10/U12/U13、D-12/D-14；sample1 frozen journey/design、sample2 requirement/design、current requestOutcome and picker actor/LayerStack source。
- INVARIANT：D-12 与现行 requestOutcome 逐行等价，AUTHENTICATION 属 business；picker 两跳结果被消费并在写入前/后分别由 readback 决定 state/message；U13 至少含真实 runtime injection；sample1 identities and partKey/layerId/testID unchanged；notice 三种 close path 和 cold restart request-ended semantics are explicit。
- SHAPE_RATIONALE：业务语义由现行 owner 和冻结旅途定义，不能用更简单的 UI 文案或 void dispatch 抹掉状态事实。
- FALSIFIABLE_FAILURE：任一分类映射不等价、child result 被丢弃、只做 rejected promise unit test 没有 runtime injection、或 U10 改名 sample1 identity，即 CP-4 FAIL/OPEN。
- GATE_RESULT：OPEN_FOCUSED_AND_ACCEPTANCE。

### CP-5：独立对账、证据分档与交付

- FORBID：作者自己完成三类 reconciliation、动态运行先于对应对账、用 static 代替 native/Android/release、把 cleanup 混入 business PASS、或没有 fresh subagent 留痕仍报 GO。
- RECALL：AGENTS.md、独立对抗审查治理、observability/acceptance standard、设计模板与需求 §4/§5/§7/§8。
- INVARIANT：每个批次先有 fresh stage reconciliation；全批 dynamic 前再有 fresh whole-scope three-dimensional reconciliation；交付前有 code↔design ledger；static/focused/native/Android/Web/release/cleanup 分档，所有 owner/log/first failure/broken boundary 可追溯。
- SHAPE_RATIONALE：阶段性对账发现局部偏移，整体对账发现跨批次偏移；动态证据不能倒过来替代设计与源码一致性。
- FALSIFIABLE_FAILURE：仓库中找不到对应 fresh record、动态证据早于对账、只给 exit code/作者自报数、或 cleanup 缺失而宣布完成，即 CP-5 FAIL/OPEN。
- GATE_RESULT：BLOCKED_UNTIL_INDEPENDENT_RECORDS。

## 12. UI/testID 前置复核

本批含 picker failure notice、sample1 notice migration、splash failure page，因此不是
N/A。当前没有实施或 fresh UI review，结论为 OPEN/BLOCKED：

| screen/action | UI owner | frozen identity | actual action node | foundation | proof |
| --- | --- | --- | --- | --- | --- |
| sample.auth.system-notice dismiss/backdrop/back | sample-staff-auth feature actor + render LayerStack | sample.auth.system-notice:* 五项 | real PrimitiveButton、LayerStack close handlers、back handler | ui-base-primitives、ui-base-render exact exports | OPEN；需 focused + fresh review |
| sample.desk.system-notice dismiss/backdrop/back | sample-member-desk feature actor + render LayerStack | sample.desk.system-notice:* 五项 | 同上 | ui-base-primitives、ui-base-render | OPEN |
| picker option radio | sample-wallpaper-picker/WallpaperPicker.tsx | wallpaperPickerTestIds option/card/thumbnail/label | PrimitiveRadio、真实 thumbnail、PrimitiveButton | ui-base-primitives、ui-base-render selectors | existing source read；new failure lifecycle OPEN |
| picker system notice dismiss/backdrop/back | picker feature actor + render LayerStack | sample.wallpaper.system-notice:* 五项 | real button/backdrop/back | ui-base-primitives、ui-base-render | OPEN；U13 |
| splash failure page | ui/base/render | ui.base.render:startup-failure / ui.base.render:runtime-failure 及各自 title/message/code | actual alert text node | ui-base-render/primitives | OPEN；U8 release |

任何 L2 binding 或 device script 只能消费 app testID source，不能用 text/role/index/CSS
补偿。U10/U13 进入动态前，fresh UI/testID review 必须把形态、位置、文案、失败/
恢复、焦点和真实动作节点逐项标为 MATCHED；本表当前不构成 admission PASS。

## 13. 三类独立对账和停机条件

### 13.1 fresh independent subagent record

本轮实施复核已经有可定位的 fresh 只读记录，且修复前记录没有被复用为当前结论：

- B0：`cp-b0-3d-reconciliation-round-current-plato.md`，`NO-GO`；sample2 完整冻结验收仍 OPEN，且纠正了旧记录把合法 `ui.base.test-support` dev edge 写成“空”的错误；
- B1：`cp-b1-3d-reconciliation-round-current-aquinas.md`，`MATCHED`；两个真实 red mutation 均命中预期 gate；
- B2：`cp-b2-3d-reconciliation-round-current-euler.md`，`MATCHED_WITH_OPEN_EVIDENCE`；source/design matched，native/release/device 仍 OPEN；
- B3：`cp-b3-3d-reconciliation-round-current-socrates.md`，`MATCHED_WITH_OPEN_EVIDENCE`；source/design matched，动态仍 OPEN；
- B4：`cp-b4-3d-reconciliation-round-current-hubble.md`，`MATCHED_WITH_OPEN_EVIDENCE`；source/design matched，当前 APK 绑定动态仍 OPEN；
- 静态当前重验：`static-current-reverification-round2.md` 与 `yarn-install-immutable-current-round2.md`；
- 全批：`whole-scope-reconciliation-round-current-leibniz.md` 是本轮 fresh whole-scope 只读对账，结论 `NO-GO`；它确认当前源码/设计边界，但保持 B0 sample2 完整验收 OPEN，并提出一项已用 owning source 反证的误判。`whole-scope-reviewer-stall-lagrange.md` 与 `whole-scope-reviewer-stall-planck.md` 仅是受控停滞诊断，不是 verdict；旧 whole-scope 记录只作历史开放记录，不覆盖本轮当前源码；
- code↔design：当前主 agent 对账见 `code-design-reconciliation-main-agent-current-round15.md`，结果 `MATCHED`；旧 `code-design-reconciliation-round6-current.md` 只作历史边界，不作为当前结论。

当前动态 supporting record 已补齐：`release-build-current-source-20260915.md`、
`u8-release-cold-start-current-source-rerun-20260915.md`、
`u8-release-wrong-primary-current-source-rerun-20260915.md`、
`sample1-frozen-current-source-normal-20260915.md`、
`sample2-frozen-current-source-normal-20260915.md` 和 `u13-runtime-evidence.md`。
它们不回写历史记录，也不把 B0 full sample2 acceptance、U13 完整 PF、Web、visual 或
Claude implementation verdict 自动改成 PASS。

这些记录的 REVIEW_TARGET 是 implementation reconciliation/code↔design，而不是把
详设作者会话冒充 `REVIEW_TARGET=DESIGN`。每份当前记录必须包含完整输入清单（需求、
详设、计划、memory、owning source）、盲审与先证伪声明、源码/详设/计划锚点、first
failure、broken boundary、last known good、修复/反例和复查结论。fresh 子 agent 只读，
主 Codex 读取报告后做 intake；记录为 PARTIAL/OPEN 时不得改写成 MATCHED，也不得以
Claude review 或后续动态证据替代。

### 13.2 stage / whole-scope / code↔design

每个 CP 完成后，fresh 子 agent 先做 stage 3D reconciliation，之后才可运行对应
dynamic proof。全部 CP 完成后、进入整体测试前，再做一次独立 whole-scope 3D
reconciliation；它不是阶段报告的拼接。

三个维度：

1. 需求：真实业务目标、R-E1/R-S7/R-E4、system notice 冷启例外、U1-U13、明确不做；
2. 详设与 IA：D-1..D-14、owner、field、identity、matrix、failure/recovery；
3. project-memory：命中的 frontend/terminal/verification/failure/coordination
   规则和本仓现有设计标准。

代码↔详设对账是单独的交付前置门，只比较 actual changed code/config/test/tool/evidence
与本文，不由 3D 对账替代。当前主 agent 记录
`code-design-reconciliation-main-agent-current-round15.md` 的结果为 `MATCHED`；它不替代
三维独立审查，也不替代 Dexter/Claude 的 implementation verdict。

停机仅限：

- 发现需求 v3.7 与已定案 R-E1/R-S7/D-14/U8 再有矛盾；
- 发现写入后 failure 无法在保留 R-P5 语义的前提下真实呈现；
- native linker 证明两个 App 无法同时使用同一手工集成；
- 需要新增产品状态、诊断面、持久化规则或 Git/外部授权。

普通测试失败不是停机：后续实施必须先保留 first failure/log、定位 broken boundary、
做最小根因修复，再 focused 重验。本轮实际执行过的 U8/sample1 首败与修复链分别保留在
`u8-release-first-failure-repair.md`、`sample1-empty-age-first-failure.md` 和相关目录；
未把失败重写成 PASS。

## 14. 不在本批范围

- 不把 dependencies.ts、package.json、graph 三处合并成一个新控制面；
- 不建 validator-existence 元门；
- 不清理历史 batch 语义或既有 batch1→batch2 边；
- 不改 sample-terminal 的 com.anonymous 身份；
- 不引入新的通用 outbox、轮询、消息队列或第二日志面；
- 不改变 sample1 partKey、layerId、testID、业务文案和 sample2 已冻结的选择/确认/
  persistence 规则；
- 不执行 seed/reset、UAT、部署或 Git；本轮获准的 sample2 前置、U8/U10/U13 动态只经
  计划列出的受管入口执行，并将 Web、Metro、Android、release、native、visual 与 cleanup
  分档记录，不把任一档位外推为另一档位；
- 不把 sample2 picker defect 重复计入 sample2 precondition acceptance；它只在本批
  B4/U13 处置一次。

## 15. 交付前自检

当前自检结论不是整体 acceptance PASS；已执行档位按真实记录更新：

| 项 | 当前结论 |
| --- | --- |
| D-1..D-14 文档回答 | MATCHED_BY_DESIGN；实现 proof 按当前证据更新 |
| U1..U13 执行体/红 mutation | `u1-u13-current-red-green-20260915.md` 逐条记录当前实际 red/green 结果与边界 |
| U10/U13 矩阵 | sample1/sample2 当前 mobile/dual normal 与 U13 focused 记录已补；PF 完整设备矩阵仍 OPEN |
| static/focused/native/Android/release/Web/cleanup 分档 | static/focused/native/Android/release supporting 与受管 cleanup 已有记录；Web/visual 未执行 |
| fresh Codex independent subagent | B1/B2/B3/B4 stage 记录已留存；全批 fresh 尝试连续失败后按补充规则由主 agent 接管，记录见 round14 |
| code↔design | 主 agent 当前逐代码与详设对账 `MATCHED`；该结果不冒充 fresh independent review |
| implementation acceptance / visual / Web / release | external implementation review、visual、Web 和完整 acceptance 仍由 Dexter/Claude 依证据裁决 |

只有独立 review 留痕、实现后各批 red/green、三类对账以及授权的 evidence 全部闭合，
才可由 Dexter 决定是否进入下一阶段；本文不扩大 Dexter 已给出的实施授权，也不把当前
局部 supporting 证据写成整体 acceptance。
