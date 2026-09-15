# TER sample 基础设施上收 base · implementation 静态代码评审

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_KIND=Codex 与 Claude 经 Dexter 中转的 review(轮次由 Dexter 决定,AGENTS.md:72)
REVIEW_ROUND=1(仅作序号)
SCOPE=仅代码静态检查(Dexter 2026-09-15 会话裁定);未对 doc/evidence 逐项求证,未审对账治理与证据档位
reviewerKind=INDEPENDENT_SUBAGENT(5 个 fresh 子 agent 分维度盲审)+ 编排会话逐条重开源码核实
EVIDENCE_TIER=static;未执行任何构建、测试、Metro、Web、Android、设备或 git 命令
输入(sha256 前缀):
  需求 v3.6 doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md 40dcb600ca75
  详设    doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md 01bc8ad38d7f
  计划    doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md 118328ad1319
评审请求:doc/review/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation-review-request-codex.md
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`tools/` 与 `doc/` 从仓库根写。行号为评审时当前字节。

## 0. 结论

```text
VERDICT=NO-GO
M/S/N=2/12/8
L2_USER_VISIBLE=S-1、S-2、S-7
DELEGATED_DECISION=Dexter 2026-09-15 授权 Claude 按最优、长期、用户体验最好的方向代为裁定原待决项(S-1、失败页内容、S-7、M-1 完成语义、N-7),结论见 §2.1,已写入需求 v3.7 §8
本结论只针对代码;不构成 static/focused/native/Android/release/Web/visual/cleanup 或整体 acceptance 的 PASS
```

## 1. 评审方式与出处

- 分维度 fresh 子 agent 盲审:A 依赖图与运行期契约、B 开机画面与失败页、C console 装配与诊断/身份资产、D picker 与冻结旅途、F 旧文件去留;E(对账治理与证据档位)按 Dexter 缩小范围后中止。子 agent 在范围变更前读过部分证据文件,结论只以源码为依据。
- 编排会话对下列全部 M、S 重开源码逐条核实;标注"子 agent 报告"的行未经编排复核。
- 利益披露:编排会话是需求稿作者与前两轮设计评审的编排者,且为续接会话,不是 fresh 会话。

## 2. Findings

### M-1 `startup.complete` 与启动组脱钩,U4 与 D-7 在现有构造下无法成立

- 状态:CONFIRMED
- 事实:
  - `kernel/base/platform-ports/src/foundations/createPlatformPorts.ts:102-112` 只往 tracker 的 `completedGroups` 与 `surfaces` 写;全文件没有任何读取点,也不再据此写 complete。
  - complete 由 integration 的 startup-ready actor 直接写:`ui/integration/sample-console/src/application/module.ts:28-44` 调 `writer.writeComplete()`,wallpaper console 的 `module.ts` 同构。
  - 触发链:`ui/base/render/src/components/ScreenReadyBoundary.tsx:206-211` 先 hide 再调 `onPrimarySurfaceReady`,经 `ui/base/console-assembly/src/foundations/consoleAssembly.tsx:275-296` 派发 startup-ready。complete 实际等于"渲染就绪",与六个启动组是否完成无关。
  - `consoleAssembly.tsx:179,202` 写的 `kind` 只被上面的死 tracker 消费。
- 影响:
  - 需求 U4(:512)要求"完成由各启动组真实完成所致",D-7 要求"缺一个必需启动组则无 complete";详设 §6.7(:526-572)的 oracle 也按"每个 required group 恰好一次"判定。按现构造这些都不可能成立。
  - U3 的因果红变异(破坏字段契约则失去完整性)无从证明。
- 最小修复:writer 写 complete 前核对本 run 的必需启动组与 PRIMARY 的 declared+measured,删除 platform-ports 里无人读取的记录。只删死代码不够,完成语义仍然错。
- 裁定:完成语义见 §2.1 决策四。

### M-2 D-13A 的 feature 骨架没有真正上收,`unregister` 只是名义存在

- 状态:CONFIRMED
- 事实:
  - `ui/base/feature-assembly/src/index.ts:3,44-58` 的入参类型就是完整 `RuntimeModule`,工厂只做校验和冻结。
  - 依赖、命令、actor 描述符的 9 行推导在三个 feature 里逐字重复:`ui/feature/sample-wallpaper-picker/src/application/module.ts:22-32`、`ui/feature/sample-member-desk/src/application/module.ts:46-56`、`ui/feature/sample-staff-auth/src/application/module.ts:30-40`。
  - `index.ts:60-70` 的 `unregister` 只从私有 Set 删除。两个 integration 只在 `ui/integration/sample-console/src/assembly/assembly.tsx:113-114`、`ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:93-94` 调一次 `modules()`,`consoleAssembly.tsx:253-257` 用完即不再读取,撤销对已启动 runtime 无效。
- 影响:详设 D-13A(:763)要求"可从真实 module registry 移除,不能伪造 runtime ownership",(:764)写明"保留三份骨架判红"。现在多了一个 base 包,重复一行没少。
- 最小修复:工厂改为只接收身份与 commands/actors 定义,描述符由 base 派生;删除无效的本地注册。只删 unregister 不收推导,重复仍在。
- Dexter:不需要。

### S-1 R-S7 失败页不分启动期、不分表面;原生可恢复的移除也发布 Unavailable

- 状态:机制 CONFIRMED;实际可达性 UNVERIFIED
- 事实:
  - `ui/base/render/src/components/ScreenContainer.tsx:47-53`:`surfaceHostAvailability==='unavailable'` 时,在任意表面、任意时刻渲染 `StartupFailurePage`。
  - `:101-119`:四种终态 fallback 同样不限表面和阶段。`:69-87` 的 container-empty 虽限定了 PRIMARY,但没有"首次就绪前"锁存。
  - `StartupFailurePage` 挂载即 `hideOnce('startup-failure')`(`ScreenReadyBoundary.tsx:72-81`)。
  - 原生侧:`adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt` 在 `:350-362` 测到无效布局时调 `remove`。`:441-457` 与 `:242-266` 表明,只要此前已有 entry,就发布 `Unavailable`;`:906-909` 的 primary-destroyed 同样如此。`adapter/android/dual-screen/src/implementations/surfaceHost.ts:263` 一律映射为 unavailable。
- 影响:
  - 就绪前若出现一次"有效后又无效"的布局,开机画面会被提前收起,并闪出"终端启动失败",违反 R-S1。
  - 就绪后,重新布局、Activity 重建或导航到空容器,都会在使用中弹出"终端启动失败"。
  - 详设 §6.5(:429-431)写的是"持续、PRIMARY"的启动期规则。
- 最小修复:
  - render 内加"首次就绪前"锁存,失败页只在开机画面覆盖的物理表面、且就绪前生效。
  - 原生把可恢复的移除与终态不可用分开发布。
  - 只改文案仍会提前收起开机画面。
- 裁定:见 §2.1 决策一、决策二。

### S-2 hide 锁存与 JS 运行期同寿,原生开机画面与 Activity 同寿

- 状态:PLAUSIBLE;原生重复注册的语义 UNVERIFIED
- 事实:
  - `assembly/base/android/src/foundations/nativeLoadingCapability.ts:5` 的 prevent 在模块作用域只调一次;`:11-20` 的 `hidden` 锁存对整个 JS 运行期生效。capability 由两个 App 的 `src/assembly/platformPorts.ts` 在模块作用域创建。
  - 每个新 Activity 实例都会在 `MainActivity.onCreate` 里重新注册开机画面。
  - `ScreenReadyBoundary.tsx:208` 把 `alreadyHidden` 视为成功。
- 影响:同一进程内 Activity 重建(例如根 Activity 退出后 JS 运行期仍在、再次启动)时,`hideOnce` 直接返回 alreadyHidden,新开机画面可能常驻不收;也可能因为 prevent 没重新调用而提前自动收起。
- 最小修复:先确认 SDK 57 `SplashScreenManager` 对重复注册的行为,再把锁存绑定到原生开机画面实例而不是 JS 运行期。
- Dexter:不需要。

### S-3 DEV 下 platform-ports 覆盖 writer 生成的 run id;详设承诺的 client 溯源缺失

- 状态:CONFIRMED;HMR 下出现同号重复的推论为 PLAUSIBLE
- 事实:
  - `consoleAssembly.tsx:243-252` 每个 assembly 生成自己的 `createRuntimeInstanceId()`,`ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts:26-31` 把它写进 data。
  - 但 `createPlatformPorts.ts:154-160` 对所有 `startup.*` 事件用 tracker id 覆盖 `startupRunId`。tracker 由 `:45-54` 每个 platformPorts 实例建一个,两个 App 的 platformPorts 都是模块级单例。
  - writer 的 data 里没有详设 §6.7 承诺的 client 字段。
  - `ui/integration/sample-console/vitest.config.ts:8`、`ui/integration/sample-wallpaper-console/vitest.config.ts:8`、`ui/base/console-assembly/vitest.config.ts:4` 都定义 `__DEV__:'false'`,覆盖分支从未被测到。
- 影响:tracker id 已随机,跨客户端撞号已解决。但 DEV 发出的 id 按 platformPorts 区分而不是按 runtime 区分:同一 ports 上的第二个 assembly(例如 Fast Refresh 重建 assembly 而 ports 保留)会发出同号 complete。U3/U4 取证恰恰在 DEV,R-E7 的"每 run 恰好一次"在结构上没有闭合。
- 最小修复:logger 采纳调用方已给出的 `startupRunId`,只在缺失时补;writer 补齐 client 溯源;加一个 `__DEV__=true`、共享 ports、双 assembly 的 focused 用例。只改测试不够。
- Dexter:不需要。

### S-4 TR-13 不是构造性成立

- 状态:CONFIRMED
- 事实:
  - catalog 只来自 `input.parts`(`consoleAssembly.tsx:236`)。
  - admin parts 由各 console 手工并入:`ui/integration/sample-console/src/assembly/assembly.tsx:40-46`、`ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:71-76`。
  - `AdminLauncher` 由骨架无条件渲染(`consoleAssembly.tsx:434`)。
- 影响:需求 §3.3(:404)要求"一个完全不写 admin 相关代码的 console 也须满足 TR-13"。新 console 只要忘记并入,就恰好落进 TR-13 反例"只渲染 launcher、admin parts 不在 catalog"。
- 最小修复:骨架自行并入 `adminShellAssembly.parts` 并拒绝重复 partKey;两个 integration 删掉手工并入。
- Dexter:不需要。

### S-5 `ConsoleSurfaceInputFrame` 公开导出,由调用方传 `hostSourceAttached`,且会写 `startup.surfaces`

- 状态:CONFIRMED
- 事实:
  - `ui/base/console-assembly/src/index.ts:5-11` 导出该组件。
  - 其 props 含 `hostSourceAttached`(`consoleAssembly.tsx:134-150`),组件本身在 `:172-217` 写 `startup.surfaces.declared/measured`。
  - 当前 integration 与 assembly base 的 src 里没有外部使用者。
- 影响:需求 §3.3(:402)规定 `hostSourceAttached` 是能力,"若下放成参数,调用方可在未挂 host source 时传 true";U3(:511)把"第二写入端保留但本次从不触发"列为绕过形态。这是一个公开的休眠第二写入端。
- 最小修复:取消导出,改为包内私有。
- Dexter:不需要。

### S-6 picker 复制了一份分类表

- 状态:CONFIRMED
- 事实:`ui/feature/sample-wallpaper-picker/src/foundations/errors.ts:28-47` 自带 `{AUTHENTICATION, BUSINESS, VALIDATION}` 与分类逻辑,和 `ui/base/render/src/foundations/requestOutcome.ts:5-15` 重复。
- 影响:违反 R-P3,也是 U13 列出的"在 picker 内复制分类表";两份表日后会漂移。
- 最小修复:actor 选类目时复用 base 的分类能力(必要时由 base 导出类目判定函数),删除这份拷贝。
- Dexter:不需要。

### S-7 写入后失败在生产中不可达,测试靠外部模块代写他人 slice 制造;写入后与未知相位的文案给出无效指令

- 状态:CONFIRMED;生产可达性 UNVERIFIED
- 事实:
  - kernel actor `kernel/feature/sample-wallpaper/src/features/actors/actors.ts:19-33` 写完即 return,自身没有写后失败点。
  - `ui/feature/sample-wallpaper-picker/test/pickerSystemFailure.test.ts:20` 用跨包相对路径导入 kernel slice 的 `wallpaperActions`;`:74-97` 由注入模块代写 owner slice 后再抛错。
  - 真实 runtime 的派发 reject 用例缺失:reject 只出现在 mock 派发的 `sampleWallpaperPicker.test.tsx:241`。
  - 文案在 `ui/feature/sample-wallpaper-picker/src/components/WallpaperSystemNotice.tsx:14-21`:
    - 选择写后失败提示"请重试",但重选同一项会被 `src/features/actors/actors.ts:71` 拦成空操作;
    - 确认写后失败提示"重新打开选择器核对";
    - 未知相位提示"重新打开终端确认"。
- 影响:详设(:835-838)要求写后路径要么证明生产可达,要么记 UNVERIFIED 交 Dexter。现在是用违反唯一写者的夹具证明了一条生产走不到的路径,并为它配了用户无法执行的提示。
- 最小修复:
  - 给出写后失败的生产可达路径;给不出就按详设上报 Dexter,并删掉代写 slice 的夹具。
  - 补真实 runtime 的派发 reject 用例,以及"确认写入前失败:pending 保留、已确认壁纸不变"用例。
  - 文案去掉无效指令。
- 裁定:见 §2.1 决策三。

### S-8 integration 公共面保留测试专用重载与 `??` 回退

- 状态:CONFIRMED
- 事实:`ui/integration/sample-console/src/assembly/assembly.tsx:64-78` 与 `ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:39-53` 导出 `Test*AssemblyInput` 重载,并用 `input.nativeLoadingCapability ?? platformPorts.nativeLoadingCapability` 取值,两份逐字相同。
- 影响:必传能力有两个入口,测试形态进入生产公共面。这正是 CLAUDE.md 架构原则明确不要的兼容层与回退。
- 最小修复:测试 support 直接传 `nativeLoadingCapability`,删除重载与 `??`。
- Dexter:不需要。

### S-9 U8 runner 的判定不可证伪

- 状态:CONFIRMED
- 事实:
  - `tools/terminal-sample2/run-u8-release-cold-start.mjs:229-276`:
    - "就绪前开机画面可见"取的是最后一次轮询快照。
    - 首轮前已就绪时,退回 `am start` 刚返回的快照(`:255-259`)。
    - 250ms 轮询加 adb 往返,通常长于 content→ready 的间隔。
  - `:377` 的先后判定用两条 JS 日志的时间:`startup.ready-hidden` 是 `hideAsync` resolve 后的 JS 记录,不是设备侧开机画面消失。
  - 成功分支 `:359-389` 不断言 settled 时开机画面已消失,`:322-328` 只记录;只有失败分支 `:344` 断言。
  - 详设 §6.5(:465-468)要求的"去掉 prevent""去掉 ready"红变异没有执行入口。
- 影响:未阻止默认自动收起(早收起)在快速启动下检不出,就绪后不收起完全不检。U8 列出的核心绕过形态都会 PASS。
- 最小修复:成功分支断言 settled 时开机画面已消失;t0 取首个 RN 内容出现后的设备侧观察;补两个红变异。
- Dexter:不需要。

### S-10 冻结旅途 runner 只采集、不判定

- 状态:CONFIRMED
- 事实:
  - `tools/terminal-sample2/run-sample1-frozen-journey.mjs:261-280` 的 `readState` 只断言主屏 resource-id 存在;`secondaryExpectation` 只写入记录(`:277`),全文件没有比对。
  - `:427-439` 的冷重启发生在登出之后,只证明回到登录页,没有核验已认证状态与业务数据的恢复。
  - `tools/terminal-sample2/run-sample2-frozen-journey.mjs:150-169` 的 `readState` 不做任何断言。
- 影响:需求 U10(:518)列出的"漏持久化或双屏"就是现状;这两个 runner 证明不了"不回归"。
- 最小修复:每步断言 PRIMARY/SECONDARY 的 partKey 与业务 state;在已认证状态下冷重启并核恢复。
- Dexter:不需要。

### S-11 三条判据没有执行体;D-1 扫描集是目录白名单

- 状态:CONFIRMED(执行体缺失限于已检文件)
- 事实:
  - U5:`tools/terminal-skeleton/check-static.mjs:672` 对非 base 源直接返回 null,App→adapter 没有任何判红路径。
  - U2:唯一的缺失依赖用例 `kernel/base/runtime/test/moduleSystem.test.ts:28-31` 用的是不存在的 `'missing'`,正是需求 U2(:510)列出的绕过形态。
  - U6:`tools/terminal-sample2/check-native-projection.mjs:258-331` 只在单个 App 内比对,没有跨 App 包名去重,也没有撞号红夹具。
  - D-1:`tools/terminal-skeleton/graph-model.mjs:264-277` 只扫 `src/test/test-expo/scripts` 与包根文件;`assembly/base/android/config/index.cjs` 含 `require`/`require.resolve`(`:1-3,42,47,68-69,103`)不在扫描内。需求 §3.0(:277)要求扫全部源文件。
- 影响:这些性质今天成立,但一旦回归没有红路径;D-1 的下一个新目录照样漏。
- 最小修复:
  - 加"非 base assembly→adapter 即违规"并补"把 import 挪到 App 另一文件"的夹具。
  - U2 改用真实但未注册的运行期包,例如只注册 ui-state 不注册 display-context。
  - U6 断言 applicationId 跨 App 去重并补撞号夹具。
  - D-1 改为整包遍历并排除产物目录。
- Dexter:不需要。

### S-12 README 仍描述上收前的结构(TR-10)

- 状态:CONFIRMED(base 包已核;其余三份为子 agent 报告)
- 事实:`assembly/base/android/README.md:5-7` 写"不拥有…failure page",结构节(`:9-15`)漏了 `src/components/AndroidTerminalApp.tsx`、`src/foundations/androidPlatform.ts` 与 `config/`。子 agent 另报 `assembly/android/sample-terminal/README.md:5,28-29,49-50`、`assembly/android/sample-wallpaper-terminal/README.md:11,43-44`、`ui/base/console-assembly/README.md:5-7` 仍按 App 自行接线的旧结构描述。
- 影响:下一次迭代容易照 README 在 App 侧再造一套。
- 最小修复:重写这四份 README 的定位、结构、用法,示例回源码核对。
- Dexter:不需要。

### Notes

- **N-1** release 下 `environmentMode` 写死为 `'DEV'`:`assembly/base/android/src/foundations/androidPlatform.ts:30`;`consoleAssembly.tsx:227` 与两个 integration 的默认值同样是 DEV。影响面 UNVERIFIED,建议由构建期事实或 App 配置决定。
- **N-2** 就绪回调失败时,已经收起开机画面,再把真实 part 换成粘滞失败页(`ScreenReadyBoundary.tsx:227-251`),诊断写入失败会变成用户可见的启动失败。`onPrimarySurfaceReady` 作为导出回调派发命令,是否符合 R-S5/TR-11,请在详设写明。
- **N-3** 原生首次测量无效且尚无 entry 时不发任何事件(`TerminalDualScreenActivityHandler.kt:350-362` 经 `:248-253`)。若始终无效,开机画面会永久停留,对应 R-S7"host 快照长期不到"的残余风险,需要登记。
- **N-4** 写入相位有两处计算:UI 在 `WallpaperPicker.tsx:109-120` 自算,actor 放进 error details 的 phase(`errors.ts:74-80`)被丢弃。建议以 actor 为准。
- **N-5** D-1 在 `tools/terminal-skeleton/check-static.mjs:668-684` 与 `tools/terminal-layering/check-static.mjs:214-233` 实现了两份(子 agent 报告),同一盲区两份都有,建议保留一个 owner。
- **N-6** 上收后残留的小重复:两个 integration 的 startup-ready 命令与 actor 逐字重复;`DeskSystemNotice.tsx:9`、`AuthSystemNotice.tsx:9` 重复 base 默认文案;两个 integration 仍转出 `createSurfaceForDisplayIndex` 别名;`assembly/android/sample-terminal/nativewind-env.d.ts:2-3` 残留生成注释。
- **N-7** `adapter/android/app-control` 与 `adapter/android/logger` 已零消费者,且声明的原生模块类不存在(编排复核)。裁定见 §2.1 决策五。
- **N-8** picker 的两个测试文件未声明就导入 `kernel-base-platform-ports`(`test/pickerSystemFailure.test.ts:7`、`test/sampleWallpaperPicker.test.tsx:8`),靠 hoisting 解析;member-desk、staff-auth 同族。

## 2.1 代为裁定(Dexter 2026-09-15 授权)

Dexter 授权 Claude 按"最优、最长远、用户体验最好"的方向,代为裁定本评审中原标注需 Dexter 裁决的事项。以下结论已同步写入需求 v3.7 §8,Codex 直接执行,不再回传。

**决策一:失败页只管启动期,就绪之后按运行期规则处理(S-1)**
- 首次就绪前,只有终态事实才显示启动失败页并收起开机画面。终态事实包括:
  - assembly 创建被拒、surface 被拒、runtime 启动失败;
  - 应用启动在错误的物理屏上;
  - PRIMARY 主屏落入终态 fallback(missing-catalog-entry、incompatible-catalog-entry、missing-renderer、invalid-props);
  - runtime 已启动而 PRIMARY 无主屏。
- 可恢复的原生移除不算终态:有效后又无效的布局、Activity 销毁重建、暂时无效的密度。此时保持开机画面,等下一次有效快照;原生须把"可恢复移除"与"终态不可用"分开发布。
- 首次就绪后永不显示"终端启动失败":
  - 可恢复的宿主不可用:保留当前画面,下一次有效快照自动恢复,只记诊断;
  - runtime 失败或 PRIMARY 主屏落入终态 fallback:同一失败页组件显示运行期变体。
- SECONDARY 在任何阶段都不显示全屏失败页,只显示中性 fallback。
- 理由:启动失败页的价值是让用户知道终端没有卡死;使用中弹"启动失败"语义错误,还会打断正在进行的操作。暂时性状态自动恢复,对用户最无感。

**决策二:失败页只给用户能执行的指引,并附错误代码**
- 两个变体:
  - 启动期:标题"终端启动失败",说明"请重启终端，如仍失败请联系管理员";
  - 运行期:标题"终端运行异常",说明相同。
- 页面显示错误代码,只含内部 reason 与错误名,不含错误消息或任何敏感数据,供运维定位;两个变体使用不同 testID。
- 本批不做页内"重新启动"按钮。进程内重试需要先释放失败的 runtime(避免持久化双写)并具备原生重启能力,这两样今天都不存在;硬做一个按钮反而可能损坏状态。正式终端的启动体验设计时再立项。
- 理由:"请重试"没有对应动作,是在误导用户;重启终端对所有失败原因都有效;错误代码让运维不必再去拿日志。

**决策三:picker 保留写入后分支,文案去掉无效指令(S-7、N-4)**
- 保留写入后处理。R-E4 要求它;当前生产里每个命令只有一个 kernel actor,所以走不到,但将来同一命令挂上第二个 actor 失败时就会真实出现。
- 夹具改为:真实 kernel actor 先写,测试模块在同一命令上注册一个排在它之后的 actor 再抛错。不得由外部模块代写 kernel slice,不得用跨包相对路径导入。
- 写入相位以 actor 回读的结果为准,UI 不再自算。
- 文案(标题"系统提示"、按钮"知道了"不变):
  - 写入前失败(选择或确认):"操作没有完成，请重试"(不变,重试有效);
  - 选择写入后失败:"已选中该壁纸，但系统未能确认，可继续操作";
  - 确认写入后失败:"壁纸已更换，但系统未能确认，无需重复操作";
  - 未知相位:"操作结果未能确认，请以当前画面为准"。
- 理由:写入后用户看到的状态已经是新的,提示应承认结果已生效,并告诉用户不必重复;画面总是反映回读后的真实 state,所以"以当前画面为准"成立。

**决策四:startup.complete 的完成语义(M-1)**
- complete 必须三项同时满足,缺一不写:
  - 本 run 的六个必需启动组(startup.modules、startup.slices、startup.commands、startup.actors、startup.ports、startup.parts)全部真实完成;
  - PRIMARY 的 declared 与 measured 都已发生;
  - PRIMARY 真实 part 首次就绪。
- 判定与写入的唯一 owner 是 console-assembly 的 writer;DEV 与 release 使用同一判定,不依赖 `__DEV__` 日志是否输出。
- platform-ports logger 只做 sink:不判定完成,不覆盖调用方给出的 startupRunId(与 S-3 合并处置)。
- 不新增生产诊断事件(需求 §6);缺组时不写 complete,由 oracle 判失败。
- 理由:这与需求 U4、D-7 一致,不是改需求。把"主屏真实就绪"补为必要条件后,complete 同时代表"启动链路完整"和"用户可以用了",只保留一个有意义的里程碑。

**决策五:删除两个 adapter 空壳包(N-7)**
- 删除 `adapter/android/app-control` 与 `adapter/android/logger`,并同步 graph 节点、节点计数、root workspaces、invariants、census 与相关 README。
- 编排复核事实:
  - 两包没有 README;
  - `android/` 下只有 build.gradle 与 AndroidManifest.xml,`expo-module.config.json` 声明的 Kotlin 模块类在包内不存在,一旦被自动链接会直接编译失败;
  - `src/index.ts` 只导出元数据,本批已无任何消费者。
- 若既有门要求保留这两个节点,按删除同步修改门,不得为过门保留空壳。将来需要原生 app-control 或原生日志时,连同真实实现与消费者一起重建。
- 理由:为未来预留的空壳违背需求 §6"不为未来预建扩展点"与 CLAUDE.md 的架构原则,还埋着一个编译期地雷。

## 3. 已核实成立的部分(供对照)

- B0 按 R-E6 二次勘误删除了 picker 的 package.json 声明,graph 与 `dependencies.ts` 维持不声明。
- 5 个 R-E5 工厂、3 个 feature、2 个 integration 共 10 个工厂,全部从 `runtimeModuleDependencyNames` 派生;子集由被依赖包自己的 moduleKind 判定。伪造 descriptor 与手抄排除清单已清零,没有引入 `optional`。sample-console 已注册为运行期模块。
- base 分层谓词(`tools/terminal-skeleton/check-static.mjs:668-684`)禁止 base→feature/integration/App,并校验 assembly→adapter 的平台段。
- 原生接入:两个 `MainActivity` 在 `super.onCreate(null)` 之前注册并去掉了抢先 `setTheme`;`expo-splash-screen` 只在 `assembly/base/android`;prevent 在模块作用域调用;薄壳里没有 `require(`、`import(` 或 bootstrap。
- 就绪只在 resolved 分支观察,排除 6 种 fallback 与 host pending,不依赖 `__DEV__`;失败注入走 `am start --display`,生产包没有调试开关(TR-08)。
- picker actor 真实读取子命令结果,两个入口处理 resolved 失败与 reject,有在途守卫并结束请求。
- `requestOutcome` 只剩 base 一份,5 个消费者都改为 import base。
- sample1 两个 notice 的 partKey 与 layerId 不变。
- system notice 以 `persistence:'ephemeral'` 打开,序列化时跳过、hydrate 时丢弃,不影响 sample2 的 pending/confirmed。
- run id 已改为随机的 `createRuntimeInstanceId()`,跨客户端撞号的旧问题已解决(剩余问题见 S-3)。

## 4. 方案合理性

- **问题对不对**:对。owner 与桥的选型、由被依赖包自声明推导运行期依赖、ephemeral 浮层、手工原生接入,都直击需求要解决的复制漂移。
- **方案优不优**:偏差在深度。
  - feature-assembly、integration 的测试重载、两份 startup-ready actor 都是透传或二次复制;新增一个 sample 仍要抄几段骨架,而这正是本立项要消灭的。
  - 两处语义漂移:complete 从"启动组完成"悄悄变成"渲染就绪"(M-1);R-S7 从启动期规则扩成整个运行期的 UI 行为(S-1)。
  - 更直接的做法:base 工厂从定义派生描述符;render 内设单一的"首次就绪前"锁存;writer 作为 run id 与完成判定的唯一 owner,tracker 只采纳不覆盖;admin parts 归骨架。
- **代价配不配**:以上改法都不增加抽象层,代价与收益匹配。验证执行体(S-9、S-10、S-11)目前只采集不判定,这部分必须补,否则实现正确与否无法被证明。

## 5. UI 与交互强制自问

- 开机画面停留到主屏就绪、终态失败收起并显示失败页,来自 Dexter 裁定(R-S1、R-S7),手机与双屏都合逻辑。
- 就绪后在使用中弹出"终端启动失败"不合逻辑(S-1),根因是实现把启动期规则扩到了运行期,不是接口限制;处置按 §2.1 决策一。
- 失败页写"请重试",但没有重试入口;处置按 §2.1 决策二。
- picker 写入前失败提示"操作没有完成,请重试"合理;写后与未知相位的提示要求用户执行做不了或做了无效的动作(S-7),文案按 §2.1 决策三。
- system notice 冷重启不恢复,符合 Dexter 裁定,合逻辑。

## 6. 未验证与不在本轮范围

- 按 Dexter 裁定未审:doc/evidence 下的全部运行记录、三类对账的真伪与时序、证据档位表述。
- 所有门、测试、构建与设备行为均未运行。
- S-1 的瞬时状态是否实际出现、S-2 的原生重复注册语义、N-1 的影响面、HMR 下是否真出现同号 complete,均需动态证据。
- 子 agent 报告而编排未复核的行已在各条中标注。

## 7. 授权边界

本评审只读、只针对代码,不授权修改源码、测试、依赖、脚本或构建产物,不授权任何构建、Metro、Web、Android、设备、DEV、seed、UAT 或部署动作,不构成任何档位的 PASS 或整体 implementation acceptance。findings 交 Codex 在既有一次性实施授权内修复;原待决项已由 Claude 经 Dexter 授权代为裁定(§2.1),按裁定执行。
