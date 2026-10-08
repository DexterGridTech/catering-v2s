---
title: TER 版本更新阶段 A 实施计划
status: IMPLEMENTATION_IN_PROGRESS
implementationAuthority: true
---

# 阶段 A 实施计划

## 0. 任务、来源与授权

目标：完整完成 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` §20.3，以及 `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md` 的全部A判据。
Dexter 于 2026-10-06 明确授权 Codex 按本计划完成阶段 A 实施及适用验证，包括生产/测试源码、生成器、两 App/native/build/签名配置、TR-09 正本与既有门同步、automation driver、构建/verify、受管 Expo Web/Android/DEV 运行和计划中的一次性 F-LOAD 探针。本批不含阶段 B/C、reset/seed、Browser L2、UAT、生产部署或商店发布。
同一批次按CP-01→06顺序推进，单批交付；不提前实现B/C、不并行干扰 Codex 的 automation-agent 工作，其运行交付状态本轮未核验。
2026-10-08 Dexter layering instruction：更新状态判断、策略、command处理、boot确认与续接逻辑只能位于`kernel/base`或`adapter`。`ui/integration`及application代码不得实现目标读取/校验、读取update slice、判断update phase或调用update-specific command；Android automation descriptor provider实现于`adapter/android/update`，application只调用该adapter工厂并装配base owner/UpdatePort。两App UI assembly仅负责装配base owner。PRIMARY页面路由完成后，integration只转发Runtime通用`primarySurfaceReadyCommand(contentReady)`，由`terminal-update` owner消费并决定是否确认/续接。
按此边界，automation用的UpdatePort/source-provider假实现及scenario fixture现集中在`apps/terminal/kernel/base/terminal-update/src/testing`；integration `test-expo` 只组合并注入测试对象，不拥有更新策略或状态判断。生产integration/application仍限于模块/port/provider装配与通用PRIMARY-ready事实转发。
模板正本 `doc/platform/implementation-task-template.md`；IA/交互/第三方附件是设计输入。Dexter 已确认三个面的界面内容；实现和行为证据仍须按本计划完成。
STANDARD_DEPENDENCY=APPROVED_PENDING_CP02_IMPLEMENTATION_SYNC：Dexter 已批准详设§12所述仅取消激活根级清除的精确 TR-09 例外；须在本次授权下 CP-02 之前落地唯一规范正本并完成 focused/red，不能把批准当实现完成。

### 0.10 · 2026-10-08 Android 验收设备范围

Dexter 明确指定：本目标 Android 验收全部只在当前连接的一台双屏真机上执行；不要求其他设备、机型或已关闭的虚拟机，双机配对拓扑不属于本阶段验收。受管 run manifest 必须记录该设备精确序列号。设备验收使用 `shape=dual`；同机 `shape=mobile` preflight 因设备暴露四个逻辑显示而不适用，本次不再尝试该形态。此前已取得且未受当前改动影响的 Expo Web 结果按原 run 证据引用，不用 Web 结果替代真实设备判据。

### 0.1 · 2026-10-07 执行状态补充

Dexter 已指示：Android 系统“允许从此来源安装”当前不可操作时，不得让该系统设置阻断 CP-04～CP-06；继续完成可独立验证的工作，最终将真实 FULL 安装留作待解决项。此指示不构成安装成功证据，也不允许绕过 PackageInstaller 或授予系统权限。

当日早期状态（历史，已由§0.2更新）：当时系统授权读回为 `granted=false`，未能进入安装确认；Dexter 指示不得因此阻断后续CP。该历史记录不表示当前设备状态。

### 0.2 · 2026-10-07 最新动态状态

当前字节上的最新运行：run=`9a9e1eb4-2caf-4aba-822c-f8967ee9be49`（2026-10-07T13:05:37Z）；Android `update.full-hot` business=FAIL，cleanup=PASS。系统 driver 已完成来源授权读回、PackageInstaller `Update`点击、安装成功回调及 APK 变化读回；后续因 FULL→HOT 续接未发出 owner readback，命中 `TERMINAL_AUTOMATION_HOT_SOURCE_REQUEST_NOT_OBSERVED`。之前同族首败为 `dd55ef86-b100-4656-a243-7ba1a5ed66d7`，cleanup=PASS；第二次后已冻结后续动态场景并以集成 focused proof 关闭根因。

根因修正及 focused proof：Runtime安装阶段只重读native事实和已提交action；FULL已成功但仍有HOT阶段的task持久回到`fixed`后立即返回。integration完成PRIMARY hydration、无content failure并完成路由后，经terminal-update既有internal reconcile command续接HOT。首次集成反例进一步确认：PRIMARY-ready actor 用显式新 `requestId` 派发子命令，Runtime 要求活动父命令的子命令继承其 requestId，导致 dispatch 被拒；同时 owner 将仍为 `accepted` 的 action 错误写成 `unknown`，使下一次成功读回无法进入 `applying-full` 分支。已移除子命令自造 requestId，并在 `accepted` 时保留原阶段和 action identity、将最近状态记为 `applying`。集成反例确认首次 accepted 后 task/action 保留，PRIMARY-ready 重读 succeeded 并开始 HOT。driver 现由统一 `AndroidJourneyUiPort` 承载 App 与 Android 系统操作：App 只用注册 TestId；系统 UI 用对象参数的等待/点击/设定开关/返回/屏幕摘要 helper，点击前重读系统层级并校验 package/context/bounds，动作发出 start/complete/failed 步骤事件。没有 raw system API 暴露给 journey，也不通过系统文本搜索定位 TER 页面。

2026-10-08 分层复核后续修正：上段记录的是当时的根因处理路径，其中 integration 曾消费更新专用 reconcile 命令。Dexter 随后明确要求更新策略、状态判断、确认和续接全部位于 base/adapter；当前实现已改为 integration/application 仅完成 PRIMARY 路由并发送 Runtime 通用 `primarySurfaceReadyCommand({contentReady})`。该事实由 Runtime 生命周期信号转交 `kernel/base/terminal-update` owner；owner 自行核对 task/action/native facts 并决定确认或续接。上段保留为历史修复经过，不代表当前 integration/application 仍承载更新逻辑。

最后一次通过：driver typecheck 与36个测试文件/209个测试、sample-console integration 的10个文件/68个测试、sample-wallpaper-console 的6个文件/37个测试、terminal-update owner 的12个测试均在本次修正字节上通过。Android 真实 `update.full-hot` 尚未在修正字节重跑；两次修正前动态运行仍记录为FAIL，不把 focused 单测提升为 Android PASS。其余跨启动 HOT 判据仍 NOT_RUN。

### 0.3 · 2026-10-07 原生版本 selector 修复与 Android 复验

根因：`TerminalUpdateRuntime.selectedFacts()` 原先总以签名 APK embedded manifest 的 `bundleVersion` 作为 actual，即使实际 `entryKind=hot`。现已由原生选择记录保存经过校验的 HOT/file-recovery 版本，并由 selector 按当前 selection 读取；embedded 仍以实际 APK embedded manifest 为准，无法确认 selection 时不伪报版本。`TerminalUpdateBootPolicyTest` 覆盖 embedded、HOT、file-recovery、缺失和未知 selection；受管 Kotlin runner `ter-a3-15716-1791380677603`（2026-10-07T13:44:37Z 起）五模块、10测试类、46测试方法 PASS，cleanup PASS；其中更新 adapter 生产 Kotlin 编译及3项测试通过。

当前字节上的最新运行：run=`472e8b28-426e-4988-bb0f-4ff14f7a6d69`（2026-10-07T13:50:24Z）；Android `update.full-hot` runner=FAIL、cleanup=PASS。实际完成 API 36 设备来源授权读回、PackageInstaller Update 点击、FULL callback `status=0`、APK变更与embedded启动、HOT真实 HTTP 200、HOT新Runtime启动；最终 actual selector、task `succeeded` 与 recentStatus `succeeded` 均已通过场景断言。失败在最后一条测试断言要求 `full.publicationId != hot.publicationId`。本run的INSTALL/FULL/HOT bundle摘要相同、publicationId相同，而bundleVersion分别为1.0.0/1.0.0/1.0.1；详设§8.1定义publicationId为文件内容身份，要求HOT版本高于FULL，但允许相同内容身份，因此“publicationId必须不同”是过度断言，不是安装、加载或owner失败。该run原始manifest仍保留FAIL，不改写为PASS。

已将该场景产物前置检查改为明确断言FULL=`1.0.0`、HOT=`1.0.1`，删除publicationId必须不同的断言；HOT selector仍须精确等于受管HOT工件的bundleVersion、publicationId与`entryKind=hot`。修订后 `yarn workspace @catering-v2s/terminal-automation typecheck` PASS。设备业务流程与production字节在该run中已完成全部上述真实行为与最终owner读回；本次唯一失败是最后一条不受需求支持的测试断言，故依“不重跑没有业务失败场景”的执行纪律不重跑安装链。该场景的受管runner结果仍记录为FAIL（测试契约失败），修订后Android runner当前字节PASS尚未取得，不扩大表述。Android单测先于该Android场景运行并使用同一production selector字节；场景结束后只修改了测试源码断言。其他跨启动、回退与两App拓扑仍按各CP状态记录，未被本run覆盖的维持NOT_RUN。

### 0.4 · 2026-10-08 HOT 图片路径修复与 Wallpaper Android 复验

当前字节上的最新运行：run=`7fb31307-e7c9-4afb-9ebd-1dcdfb62e2db`（2026-10-07T16:32:16Z 至 16:36:54Z）；受管 Android API 36 `emulator-5560`，Wallpaper `update.offline-assets`，business=PASS、cleanup=PASS。INSTALL、FULL、HOT 产物构建/结构/签名检查均 PASS；driver 读回安装来源权限已启用，点击系统安装器 `Update`，收到成功 callback `status=0` 且确认 APK 已变化。更新后 FULL 图片 selector 为 `loaded`；HOT ZIP 通过真实 HTTP 200 下载，HOT 图片 selector 亦为 `loaded`；本次受管 Vitest 输出为 1 file / 1 test PASS。manifest 与 runner log 保存在该 run 目录，run 结束后临时构建/安装产物清理，目录剩余约 788 KiB 运行证据；没有运行中的该 run 进程。

根因已由修复前后字节区分：CBS/API/descriptor/APK/HOT ZIP 的 HTTP 请求都成功，因此两 App 共用 HTTP 配置不是这次失败点。FULL 图片由签名 APK 的 `res/drawable-*` 资源承载；HOT 图片由已下载的文件 bundle resolver 从 `assets/index.android.bundle` 相邻的 `assets/drawable-*` 读取。修复前 builder 把 HOT 图片放在 `res/drawable-*`，React Native 0.86.3 文件 bundle resolver 找不到它们。`scripts/build/terminal-update-artifact.mjs` 现将 HOT 发布资源放在 `assets/drawable-*`，INSTALL/FULL 仍放 `res/drawable-*`；`HOT_RESOURCE_PATH_LAYOUT=PASS` focused builder self-test 验证两种布局。该场景的真实设备结果证明 Wallpaper 当前字节 FULL 与 HOT 图片均加载；不外推至其它 Android 设备/拓扑。

Dexter 要求的 transport 诊断已补到 owning package：`createTransportConnectionOwner` 记录 connect candidate、socket、HTTP 各地址尝试与最终失败、配置读回拒绝、ready timeout、close/send 失败和重连计划，携带安全阶段/配置 revision/地址名/重试与耗时等字段；不记录 URL 查询、请求/响应正文、认证头或代理密码。`createTransportModule` 将 timer command 非 completed/rejected、网络观察失败和资源释放失败写入结构化脱敏 warning。当前字节 focused test `yarn workspace @catering-v2s/kernel-base-transport test` 输出 8 files / 51 tests PASS，真实stdout归档在 `.runtime/review/ter-stage-a-transport-logging-focused-20261008.log`；typecheck已在本次源修改后通过。日志字段与敏感信息排除由 `connectionOwner.test.ts`、`moduleCommands.test.ts` 覆盖。本项测试没有重跑本场景未涉及的其它业务验收。

### 0.5 · 2026-10-08 Android dual 形态防呆与受管复验

静态复核发现 update Android runner 接受 `shape=dual`，但 APK surface form、Android connection 和 activation fixture 曾有路径硬编码为 `mobile`；manifest 因而可能与实际测试形态不一致。现由 `parseMainSampleShape` 统一校验 runner 输入，`mainSampleSurfaceForm` 映射 `dual→laptop`、`mobile→mobile`；connection、双屏 surface preflight、activation fixture 均消费同一形态。Android secondary display 检查在 build/install 前执行，缺失时测试 fail closed。`mainSampleJourneyConfig.test.ts` 对 update journey 源码加窄防回归：禁止硬编码 `shape: 'mobile'`，并断言运行消费点都来自 runner shape。runner tests 同时断言两个 Android update case 在 mobile 与 dual 都登记。

当前字节 focused 输出：`yarn workspace @catering-v2s/terminal-automation test runner.test.ts mainSampleJourneyConfig.test.ts`，2 files / 35 tests PASS；`yarn workspace @catering-v2s/terminal-automation typecheck` exit 0。受管 Android dual run=`e570c0c3-ff08-48e6-9776-a53b57bbf4de`（2026-10-07T17:34:38Z 起，API 35，device=`emulator-5554`，`shape=dual`，Wallpaper `update.offline-assets`）business=PASS、cleanup=PASS。真实安装 callback `status=0` 且 APK identity changed；FULL embedded image 与 HOT file image selector 均 `loaded`，HOT 通过 HTTP 200；Vitest 1 file / 1 test PASS。Console 同形态 run=`21fe8455-7190-411b-b4cb-7973ab0bcb8d`，Android API 35，`update.full-hot`，business=PASS、cleanup=PASS，FULL embedded 与 HOT readback 通过，Vitest 1 file / 1 test PASS。两次安装器均出现一次等待系统完成按钮未匹配，随后 driver 依据成功 callback `status=0` 和 APK 身份变化闭合安装；不得把该中间提示单独记为场景失败。

本项只关闭 update runner 的形态传递差量。此前 mobile 的 Console/Wallpaper `update.full-hot` 与 Wallpaper `update.offline-assets` PASS 继续按其 run manifest 适用；本次 dual proof 不替代其它 CP、6b、13c、完整 `scripts/verify` 或 fresh 整批 IMPLEMENTATION review。未运行项仍按 §11a 分别标记。

### 0.6 · 2026-10-08 Wallpaper FULL→HOT 状态探针装配修复

失败族 `TERMINAL_AUTOMATION_WALLPAPER_ASSET_LOAD_TIMEOUT_FULL` 第三次复现前，按运行纪律冻结其后动态场景；保留前两次失败及本次修复前 run `9afdee1e-b81e-4c12-94e7-ed5930e88bd4`（Android API 36 mobile，business=FAIL、cleanup=PASS）。该次真实安装 callback=`status=0`、APK identity changed；画面图片已加载，但 automation registry 返回22个节点且探针节点为0，故判定为测试观察接线缺陷，不能将可见图片推成selector PASS。

根因：Android `App.tsx` 曾把 `TerminalUpdateAssetLoadProbe` 放在 `createSurfaceForDisplayIndex()` 外侧兄弟节点，不在 integration assembly 提供的 `AutomationNodeProvider`/`AutomationSurfaceProvider` 子树内。最小修正是移除兄弟节点渲染，在 `sample-wallpaper-terminal/src/assembly/platformPorts.ts` 仅对受管 probe 环境设置 `renderAutomationChildren`，复用 wallpaper assembly 已有的内容插槽；integration focused test 直接断言 assembly surface 树中存在 probe testID。没有改变生产壁纸行为，也没有新增自动化registry机制。

修复后 focused 输出：wallpaper integration typecheck 与全部6个测试文件/38个测试 PASS；Android wallpaper app typecheck PASS；Prettier三文件检查 PASS。随后同一 API 36 mobile `update.full-hot` run=`655922a2-ada9-469a-a6e3-dcde697d7c44`：INSTALL/FULL/HOT artifacts PASS；真实 PackageInstaller callback=`status=0` 且 APK changed；FULL selector=`loaded=3/3;failed=0`；HOT selector=`loaded=1/3;failed=0`；runner 1 file/1 test PASS；business=PASS、cleanup=PASS。该同场景结果关闭此前失败族；不覆盖其它设备形态、跨启动、回退或阶段 A 全批。

### 0.7 · 2026-10-08 CP-03 installer异常出口补全

按 CP-03 复核发现，`BUSY_UNKNOWN` 记录没有 foreground 读回出口；当未知 PackageInstaller session 后续结束时，持久状态可能永久停在 `unknown`。旧 `OnActivityEntersForeground` 入口只继续处理 `pending-user` 授权恢复。

最小修正复用现有 foreground hook 与 AtomicFile 记录：BUSY_UNKNOWN 前台恢复读取 `PackageInstaller.mySessions`，查询失败或仍占用时维持 UNKNOWN；明确为空后再读实际安装身份，精确匹配本 action 的 applicationId/nativeBuild/publicationId 则记录 succeeded，否则记录 `ENDED_NOT_INSTALLED`，由 owner 现有映射回到 WAITING_USER。BUSY记录现在同时保存该目标身份。没有删除或认领未知 session，没有轮询，也没有重提原 action。包名、task/action 迟到callback匹配，以及确认恢复要求“同包、committed、sealed”提取为被生产分支调用的纯策略函数并有正反例。

新增 `TerminalUpdateInstallerPolicyTest` 覆盖busy仍未知/目标已安装/确认未安装、迟到callback不匹配新action、错误包或未提交/未sealed session不可续接。受管 `tools/terminal-shared/run-owned-android-tests.mjs` run=`ter-a3-94919-1791405200194`（2026-10-07T20:33:20Z至20:37:04Z）读取本次Kotlin源码 SHA-256=`306f095fa2e51b00d937390a9167d0f69ffb5e2e46dda6be27096a58420f1f50`，5模块、11类、49方法 PASS，Android build/.cxx清理及runner cleanup均PASS；adapter-update 6方法PASS。最终 application-base-android 阶段2分08秒，其中已有 production heartbeat 测试按需求运行三个30秒窗口；不是进程卡死。该focused证明未覆盖真实系统权限被拒与PackageInstaller故障设备场景。

本轮由CP-03 fresh reviewer复核：FULL→HOT Android成功路径与HOT资源selector已闭合；installer focused证明已新增。CP-03是否MATCHED以该reviewer当前字节最终复核记录为准；未获该记录前不得进入CP-04。

### 0.8 · 2026-10-08 CP-03 installer callback 身份闭合

CP-03 fresh 复核指出 `onInstallerStatus` 只校验 task/action/kind，未核对回调的 sessionId 与固定目标身份。现复用同一 AtomicFile action 记录：创建 FULL action 时一并保存目标 `applicationId/nativeBuildNumber/publicationId/apk.sha256`；PendingIntent携带相同身份和系统 `EXTRA_SESSION_ID`；receiver 仅当 callback 的 task/action/session 与记录一致，且应用、目标版本、publicationId、APK SHA-256 全部一致时才写状态。BUSY_UNKNOWN 不拥有新 session，记录其 sessionId 为 INVALID_ID，因此任何 session callback 均不能误认领该状态。错配只记录脱敏 stale 事件，不改 action。

`TerminalUpdateInstallerPolicyTest` 覆盖同 task/action 但 session、APK摘要、publicationId、应用包或 native build 不同，以及缺失 session ID、错误 action/kind 的拒绝反例。受管 runner `tools/terminal-shared/run-owned-android-tests.mjs` run=`ter-a3-6375-1791405747649`（2026-10-07T20:42:27Z至20:46:08Z），source SHA-256=`29835780ad473a955247f2b920dfa0ce6e717f6e4e9d6e5bb67fd394b36373fb`，5模块/11类/49方法PASS；update adapter 6方法PASS，生产 Kotlin 编译通过；本 run 创建的10个 Android `build` 中间目录逐项清理且 readback 为空，owned process与runner cleanup均PASS。该 proof 是 Android Kotlin focused test，不声称真实 PackageInstaller 错配回调设备场景已经运行。

CP-03 fresh 独立三维对账已于 2026-10-08 以当前 callback 身份修正字节给出 MATCHED（`/root/stagea_cp03_reconciliation`）；依据包括实现与详设逐项一致、session/hash 错配 focused 反例，以及 run `ter-a3-6375-1791405747649` 的 5模块/11类/49方法 PASS 与 cleanup PASS。现进入 CP-04；此记录只关闭 CP-03，不替代全批6b、整体验收或13c。

### 0.9 · 2026-10-08 installer 用户取消后的同目标重试

CP-03 focused Android `update.install-result` 暴露出 owner 对 `applying-full` 中保留 `actionId` 的再次接受请求只返回 `already-fixed`，没有读取 PackageInstaller 原 action；真实设备取消后这会阻止同一目标重新邀请。最小修正是对任何仍保留 `actionId` 的当前任务先走既有 `readAction`：读回为 `user-cancelled` 时清除该 action 并继续同一固定目标；仍未知、查询失败或其他状态不新建 session，也不重放提交。focused owner 测试覆盖初次 `INSTALLER_AWAITING_READBACK`、未决 action 不重复提交、确认取消后新 action 使用相同 task/target，以及新 action 仍未决时再次接受不重复提交；`yarn workspace @catering-v2s/kernel-base-terminal-update typecheck && yarn workspace @catering-v2s/kernel-base-terminal-update test` PASS（16/16），`yarn workspace @catering-v2s/terminal-automation typecheck` PASS。

修复后受管真实 Android API 36 mobile run=`f186def2-9537-4486-b71e-45910e78f508`（2026-10-07T23:08:18Z～23:12:54Z，设备`emulator-5560`，样本Console，case=`update.install-result`）：INSTALL/FULL/HOT artifact 的 Gradle、结构、签名与读回均PASS；真实 PackageInstaller 来源设置被启用并读回，Cancel由系统UI driver点击；owner在重试时读回用户取消并对同一task/target创建不同action，真实 `Update` 再次点击，随后收到 callback `status=0`、APK身份变化且FULL embedded nativeBuild=2读回；HOT工件返回HTTP 200并进入 `PREPARING-HOT`。等待系统 Done/Open 的一个短等待记录 `wait-button.failed`，之后既有成功callback与APK变更观察闭合安装；它不是场景失败。受管Vitest 1 file/1 test PASS，manifest business=PASS、cleanup=PASS，run-owned Android build/install产物已由runner回收。该case只覆盖Console mobile的取消→重邀请→FULL安装闭环，不替代Wallpaper、双屏、跨启动与CP-04/05其他场景。

当前字节上的最新运行：run=`f186def2-9537-4486-b71e-45910e78f508`（2026-10-07T23:08:18Z～23:12:54Z），Console Android API 36 mobile `update.install-result`，business=PASS、cleanup=PASS。
最后一次通过：同一run及当前owner/runner修正字节一致；仅证明本段列出的安装取消与重邀请路径，未证明整批阶段A完成。

### 0.11 · 2026-10-08 FULL工件清理与action身份差量

实施静态复核确认，FULL 终态 action 结束后仍可能遗留本任务的 prepared APK；unknown/waiting-user 仍引用它时不能清理。owner 现只在 task.preparedId 存在且 action publicationId 等于固定 FULL target 时调用既有 `releasePrepared`；FULL 终态读回、即时 apply 终态以及确认取消后用户显式重邀均按此身份释放，UNKNOWN/WAITING_USER 保留，HOT publication 不得触发 FULL 文件释放。释放失败写入 `unknown/PREPARED_RELEASE_FAILED`，保留原 task/action/preparedId，下一次既有 readback/显式重邀可重试。

同根核验还发现即时 `applyPrepared` 成功响应未校验返回的 taskId/actionId。现在 mismatch 以 `ACTION_IDENTITY_MISMATCH` 保留已经持久化的 applying task 与 action/prepared 身份，不消费错误结果；后续 readAction 仍按其既有身份校验。没有增加第二账本或恢复框架。

focused 证明（当前字节）：

- `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck`：PASS。
- `yarn workspace @catering-v2s/kernel-base-terminal-update test`：PASS，1 file / 22 tests；覆盖终态释放、释放失败状态与保留、成功后重试、非 FULL publication 拒绝及 apply immediate-return 身份错配。
- `yarn workspace @catering-v2s/kernel-base-terminal-update lint`：PASS，9/9 files，无 warning/error。
- `yarn workspace @catering-v2s/adapter-android-update typecheck`、`test`（1 file / 4 tests）、`lint`（3/3 files）此前在本轮 adapter 测试名修正后 PASS；此后未改 adapter 字节。

本轮一次新增身份用例的首败来自 fixture 把当前 HOT publication 与已安装内容设成同一身份，owner 正确走了“无需更新”；没有形成生产业务失败。修正 fixture 为 native build 2 且仅 FULL 后，同一包测试通过。尝试向封装 runner 传 Vitest `--testNamePattern` 得到 `unknown-argument`，未重试该参数；随后按仓内支持的包入口完成相关 package proof。

当前字节上的最新运行：`yarn workspace @catering-v2s/kernel-base-terminal-update typecheck && yarn workspace @catering-v2s/kernel-base-terminal-update test && yarn workspace @catering-v2s/kernel-base-terminal-update lint`，2026-10-08；package runner 未生成受管 run ID，Vitest 临时 JSON 在退出时清除；终端输出为 typecheck 成功、22 tests PASS、lint PASS。
最后一次通过：同一命令、同一当前字节；它只证明 terminal-update owner 的本地类型/单测/lint，不是 Android、DEV、全批 scripts/verify 或阶段 A 全部通过。

差量独立只读复核确认：FULL publication 匹配、release 失败状态与身份保留、immediate `applyPrepared` 返回身份校验及反例均静态闭合；复核未运行测试。该结论只覆盖上述 owner 差量，不关闭 CP-03 全阶段、其它 CP、全批6b、13c或整批 IMPLEMENTATION review。

### 0.12 · 2026-10-08 更新逻辑分层修正

按 Dexter 最新要求，更新状态读取、阶段策略、installer/boot 确认、续接及更新专用 command 处理只能由 `apps/terminal/kernel/base/terminal-update` 或 `apps/terminal/adapter/android/update` 实现。修正前，两个 integration 的 `src/application/module.ts` 在 PRIMARY ready 时调用更新专用 reconcile command；该实现虽能工作，但把更新续接决策放进 integration，违反当前分层要求。

当前接线为：integration/application 先完成原有 PRIMARY 路由，再发送 Runtime 通用 `primarySurfaceReadyCommand({contentReady})`；`kernel/base/runtime` 将信号登记为通用生命周期 command，`terminal-update` base owner 读取当前 task/native facts、执行 boot 确认与固定任务续接。内容失败只传 `contentReady=false`，owner 不确认、不启动续接。`src/assembly/assembly.tsx` 与 `dependencies.ts` 中保留的 `createTerminalUpdateModule` 装配和模块登记仅用于组合 base owner/provider，不包含更新业务判断；Android `MainApplication` 对 adapter `TerminalUpdateProcess.begin` 的调用也只是原生进程启动接线，行为实现仍在 adapter。

本差量当前字节 focused 证明：Runtime typecheck PASS；terminal-update typecheck 与 23 tests PASS；Console integration typecheck 与 68 tests PASS；Wallpaper integration typecheck 与 40 tests PASS。Console integration 反例验证 `contentReady=false` 不确认、ready 后由 owner 读回并续接；Wallpaper 包测试和两包生产路径检索未发现更新专用 selector/phase/command 的 application actor 引用。integration 测试对 owner 的断言仅验证通用路由接线，不改变生产逻辑归属。测试通过不代表 CP03/CP04 独立对账或 Android 动态结果通过。

本段写入时，Console/Wallpaper `update.interruption` PASS 均先于此分层改动；这些 run 保留为历史事实。该段的 `NOT_RUN` 已由 §11.4 所列当前字节 interruption 运行取代；`update.compatibility` 仍需在分层/readiness/provider 修正后补证。

`TerminalUpdateAssetLoadProbe` 是 wallpaper `test-expo` 的测试观察组件，只读取图片加载回调并显示加载计数，不读取更新状态、不选择目标、不发更新 command。Android application 在自动化专用 composition flag 下装配该观察组件以完成 F-LOAD；这项测试观测不承载更新策略或产品行为。更新逻辑仍仅由 base owner 与 adapter 实现。

## 1. RECALL 与开始条件

每个实际变更点重开需求条款、详设对应段、IA/交互、六维命中记忆和owning source；focused后用同组回读。
全部kernel和deterministic-context-only；路由词来自scripts/memory/query合法词汇，不把navigation当规则。
本次授权已明确覆盖 native/两 App/build/automation 扩展及受管 Web/Android/DEV 验证。企业签名/目标设备/解析依赖仍须按 CP 证据核实，不得冒称具备条件。
FULL 最低 Android API=29；API24～28 分支不属于本批。API≥29 的公开 `SessionInfo.isCommitted` 只回答是否已提交，不代表 session 一定合法可续接，CP-03 仍须读回验证。
CP-01/CP-03 按计划早期核实当前依赖解析、构建链和原生公开接缝；该核验属于已授权实施工作，不等待整体验收首次发现。

## 2. CP-01 · 单源版本、工件与自动化登记

RECALL：R01/02/03；详设§8.1/9a/9a.1；两App package/Gradle/Hermescompiler、canonical生成惯例。
允许修改：artifact schema/能力生成器/Node打包器、两App package/Gradle/签名发布配置；当前automation CLI与资源/health/format登记。
步骤：

1. 建立四字段单源/严格比较/内容身份，不手写Gradle另一值；冻结生产三脚本。
2. 同 compiled 发布树生成 embedded INSTALL 及 FULL，同次 APK 字节；embedded 保持 assets:// bundle+res，不复制整树；构建 publicationId/实际 asset 名写入签名 APK metadata。从最终签名 APK 解出实际 embedded bundle，SHA-256 必须等于发布树入口摘要，不允许 RN Gradle 另一轮 Metro 产物替换。资源核对发布树清单与实际 assets/res 名称及尺度/限定符映射；AAPT 会转换 drawable，故不比较转换后的 drawable 与原始字节，实际可用性由 F-LOAD 证明。HOT 使用自身发布时的编译树，须显式最小 FULL；更高 bundleVersion 可携带不同内容，相同 bundleVersion 内容身份必须相同，版本降低拒绝。
3. 生产版本源与受管测试descriptor副本隔离；真实APK包名/签名/版本读回校验；所有路径realpath仓内，包括子文件symlink红例。
4. 记录实际Expo/RN/compiler版本与Gradle解析，不能把compiler NPM号当nativeHermes；新候选依赖官方同版依据。
5. 现有automation runner增phase=update和有限case解析、复用同run根/profile/kind；health/format/预算门红例同时做；不先建场景后补资源登记。
6. 当前 runner 对 journey/skill 接 DEV，给新增 update.flush/compatibility/rollback真实业务子断言明确requiresManagedDev=true并接既有managedActivation父流程；技术子断言false。合法fixture/context缺失fail closed；不只增加phase枚举。沿用详设§9a.3的 transport/fixtures/selector 真实接口与 TestId options 形状。重开 automation 静态评审中修复后的公共 helper，不假定旧 selector 等待、session 隔离或设备 cleanup 已闭合，也不另建 driver；未受影响的已完成 CP 不重复对账。
   PROOF：schema/generator check+self-test；owned typecheck；builder 二进制读取必须覆盖大于 Node 默认捕获上限的 embedded bundle，且失败诊断不得输出 bundle 正文；两App三产物打包检查及非法版本/identity/根外red；合成fixture证明 bundleVersion 1.0.9→1.0.10 的不同内容可发布、同版本改内容与降版被拒；真实受管产物链让HOT使用高一个patch的bundleVersion并验证摘要为有效SHA-256。INSTALL、FULL、HOT由同一应用源码构建，不要求相同源码下的HOT字节与INSTALL不同；HOT ZIP内每个文件必须与HOT发布清单摘要一致。ZIP 对预期文件闭集允许其必要目录项、拒绝额外目录/文件及缺项；保留metadata/版本而替换实际embedded入口的红夹具必须报摘要不符，资源缺项/错映射同样拒绝。结果以当前字节实际运行记录为准。
   CP出口：全部工作/必要修复与focused完毕，fresh独立完整CP三维对账MATCHED。不声称设备可用。

## 3. CP-02 · UpdatePort契约、最终本机owner与Web先行

RECALL：R06/09/10/15；详设§8.3～8.6；runtime initialize/flush/resource、state persistence/sync约束。
进入前：Dexter 已批准的精确例外由本次实施授权覆盖；CP-02 前完成唯一 TR-09 正本修改及 focused/red。只覆盖取消激活原因 TERMINAL_ACTIVATION_CANCELLED；未满足前置时不得实现 retain，不以通用 state 能力或第二存储绕过。
规范同步同时写明 retain 按 slice.resetIntent 生效、不读取原因；当前唯一生产根级触发点是 TDC 取消激活。任何新增 requestApplicationReset 生产调用点必须重新评审例外，CP-02 review checklist 核查这一调用点集合。选择文字义务加既有字段 focused/red，不另增扫描门；当前单生产调用点可直接复核，Runtime 测试中的其他原因不属生产集合，新增独立门的维护成本不值。
同步既有 skeleton 的 runStateResetRetentionOnly：当前精确允许 server-config 且声明数量为1；随已批准例外接纳 terminal-update 自有持久 descriptor，更新精确 owner/source 与数量判定。保留其他 owner/非持久字段/orphan 清除的 focused/red，不扩大通用 retain、不新建机械门。规范与既有门修改均在本次实施授权内。
可选前置：本次授权覆盖一次性、不进入产品代码的 F-LOAD 技术探针，可在 CP-02 冻结端口形状前，证伪公开 Host handler 的 embedded asset/HOT file 加载与离线资源布局。若执行，须使用受管所有权及 cleanup，用后移除；UI 观察复用最新 automation driver，不建旧 runner，不写产品 selection/任务、不提供应用内更新旁路，且不替代 CP-03 最终 owner+启动保护链验收。当前仍 NOT_RUN，是否采用由 CP-01/02 的真实源码与早期 native 证伪结果决定。
本次授权覆盖的修改范围：platform-ports契约及默认实现/所有消费者；kernel/base/terminal-update及测试；两integration composition/selector registry；tools/terminal-skeleton/check-static.mjs 中上述精确 retain 门与直接 red。
步骤：

1. 换六项UpdatePort、删除旧七方法/descriptor及fixture消费者；TR-05类型边界；Android暂时默认unavailable，不先暴露无保护HOT。
2. 在两个 UI integration 的 `src/assembly/assembly.tsx` composition 中创建最终 owner 并注入具名 source provider；`src/application/module.ts` 保持路由职责。建立最终owner固定target/currentTask/recentStatus/failedArtifactIds；串行claim/await后重读，isolated+owner-only。
   仅在上述规范前置闭合后采用resetIntent=retain，并测试只保留update持久字段、其他owner/ephemeral/orphan不扩保留；来源授权失效禁止借新凭证替换target。生产A无来源则拒绝，run-owned允许工件只进入automation-enabled profile；正式owner不分测试执行分支。
3. task.actionId与target持久化屏障；应用前业务dirty slice flush；typed失败零提交；两屏/冲突/旧action/原始JS下限与UNKNOWN。
4. initialize 在 hydration 后续接；Web 生产构建始终用 unavailable UpdatePort，只有 automation-enabled Web 测试构建显式注入 typed fixture port（与来源 provider 同边界），测试 facts 不冒充真实 APK。包/构建 red 证明 production 夹入 fixture 被拒，缺 native 不能自动切 mock。
5. Web通过automation正式command/selector验证fixed/full-hot/compatibility/install-result/flush/recent；`update.fixed` 分别以 `--sample console` 与 `--sample wallpaper` 运行，确保两个 integration composition 都实际加载各自 run-scoped fixture；`update.compatibility` 在 Web 从 APK1/HOT JS5 owner facts 接收 FULL2/embedded4+HOT6 target，断言 owner 进入 `applying-full` 且 actual 仍为 APK1/HOT JS5。Web 只证明 owner 选择，不代替安装、boot 或设备数据保留证明；candidate保护协议做focused，Android首次真实触发等待CP-03完整接线。
   PROOF：owner/契约owned typecheck与focused；automation Web 对两个 sample 分别执行单场景。native纯单元测试可直接port，安装App内不能用run-onlyport旁路作为更新触发。
   CP出口：完整owner与Web行为闭合，完整CP三维MATCHED；尚无native加载proof，不宣称具备真实更新能力。

## 4. CP-03 · Android执行者与保护同时交付

RECALL：R03/11/13/14；详设§8.2/8.6/8.7/8.8；公开ExpoPackage/Host接口、nativeLoading、现有reset三族、network配置provider。
允许修改：adapter/android/update、application/base/android装配与loading/PRIMARY确认桥、两App autolink/native签名配置。
步骤：

1. 常见主路径：流式下载→摘要校验→发布清单与声明文件对应→生成完整资源树；保留现有相对路径、重复路径与声明大小检查。HOT发布树中的`assets/drawable-*`与JS bundle同目录，匹配RN文件bundle resolver；INSTALL/FULL仍将资源放`res/drawable-*`供AAPT。不得新增归档专用库、symlink/恶意 entry 专项解析或独立测试框架；预算/取消资源仍按现有 owner 与 composition provider。
2. 在任何真实HOT触发前完成native selection/boot/action原子记录与独立T、不可变ReactContexttoken、同Activityreload和三个reset消费者、获准一次恢复/失败文本。
3. Host handler getter 只读同 attempt；embedded assets://+res，HOT/获准文件恢复目标 file root，同 Host reload。selection/previous/candidate 均绑定创建时 applicationId+actual versionCode+embedded publicationId；beginBoot 先比较当前 APK，变化则作废旧资格、显式选新 embedded 并读回 APK_CHANGED_SELECTION_RESET。同 runtime FULL 与外部更高 APK 都不能沿用旧 HOT；缺失 HOT 不默退 assets。最小 FULL 与原始 JS 版本约束由 CP-02 最终 owner 裁决。
4. Session INTENT→create→sessionId/STAGED→COMMITTING→系统 callback/readback 完整窗口；FULL最低API=29。`isCommitted=false`仅证明未commit，还须session合法可续接；未知状态不重复commit、不抢占或删除未知session。成功读回确认 session 消失且未安装→ENDED_NOT_INSTALLED→WAITING_USER，下次呈现以新 action/session 邀请同固定工件，不标坏/FAILED、不重 commit 旧 action。仍存不可判定或查询失败保持 UNKNOWN；BUSY_UNKNOWN 有事件读回、占用结束后的成功/等待出口，不清未知资源、不轮询抢占。取消/迟到 callback 精确隔离；不做 N 提醒。
5. F-LOAD/F-INSTALL/F-BOOT第一场景走automation→最终accept command→真实UpdatePort，不能直调port或测试私有装配；类型及纯原生focused可直接调用技术类。Startup reconcile必须有两条focused反例：已持久化`fixed` task在Runtime install只读native facts、不开始网络/工件操作；已提交FULL action读回成功时也只持久化为`fixed`并返回。页面primary-ready事件经Runtime通用command进入base `terminal-update` owner；owner核对hydration/native facts、确认HOT boot并续接固定task。integration只按顺序完成路由和转发ready事实，不持有任何更新策略。Android UI通过单一`AndroidJourneyUiPort`操作：App控件经注册TestId；系统等待、点击、开关回读、返回和屏幕摘要分别经`waitForSystemButton`、`clickSystemButton`、`setSystemChecked`、`pressSystemBack`、`readSystemScreenSummary`，按钮等待使用命名参数，点击受系统package/context约束且点击前重新读层级与bounds。各系统动作均向driver步骤日志报告start/complete/failed；APK权限、Installer Update/Install/Done由Android实际场景使用这些helper，不能只在底层单元测试定义而runner仍直接tap旧坐标。
   PROOF：实际Gradle/Hermes/ZIP/SDK解析，embedded asset/res 与受保护 HOT file 的 HBC+图片/字体各自离线、真实installer、故障boot/旧token拒绝；非adapter逻辑已有CP-02 Web同case；Android driver测试覆盖统一 app/native Journey port、系统包限定与点击前fresh bounds。
   CP出口：第一次真实HOT已同时有有效保护；F-LOAD/F-INSTALL/F-BOOT、focused/cleanup及完整CP MATCHED。关键public接缝失败先修本CP，不留到all。

## 5. CP-04 · 兼容发布与完整跨启动反例

RECALL：R13/14及V21～26；详设§8.7；nativeLoading/Runtime generic primary-surface-ready、terminal-update owner与failure、持久数据读取。
允许修改：adapter native boot/selection 与 automation source-provider、Runtime 通用 PRIMARY-ready 信号与 terminal-update base owner、application platform/owner 装配；发布 compat 测试和 driver 原生观察。application/integration 只装配 base/adapter 能力并转发通用就绪事实，不得实现更新目标读取/校验、更新策略或更新阶段处理。
步骤：

1. 回读CP-03保护链，扩展中断/迟到/failure的完整反例；新candidate、PRIMARY/hydration、failure-hide规则不另建第二保护机制。
2. identity精确匹配、旧boot迟到、多屏确认幂等；原生错误/期限有界恢复到获准previous；恢复包有独立60s确认期限，失败后持久进入失败终态，不重选同一包；没有安全目标显示原生失败文本。
3. 新native不加载旧runtimeHOT；确认后普通HTTP/断链不回退；进程退出记录unconfirmed不假称代码BUG。
   `update.rollback` 是 Android managed-DEV 场景；成功HOT已实际确认后，通过现有 generated `terminalReadStoreBasic` GET 触发run内唯一一次 HTTP 503，再断开TDC。两次读回均要求actual仍指向同一HOT publication、task仍`succeeded`，并要求proxy确实只拦截一次完整路径`/api/terminal/group-workspaces/{space}/stores/{storeRef}/basic`；不得以连接成功替代结果断言。
4. 两 App 真实 fixture 证明同 runtime APK1/HOT JS5 写入→FULL2 首次只能 embedded4 读回→HOT6；另覆盖外部安装更高 APK 后三类旧记录失效、实际 embedded 与复位事实、旧 token 拒绝。HOT 候选确认前写入→上一成功包读取；坏迁移发布不被“声明兼容”掩盖。
   兼容case的Android执行限于Dexter指定的同一双屏真机 `shape=dual`：先以APK1/HOT JS5写入持久owner数据，FULL2首次boot只读embedded4与原数据，再完成HOT6；随后由同一受管设备对run-owned签名FULL3 APK执行包替换，重新启动后selector读回nativeBuild3/embedded7、owner任务释放、原数据仍在。Console以持久UI layer selector读回；Wallpaper通过公开 `kernel.feature.sample-wallpaper.select-wallpaper` 与 `confirm-wallpaper` command写入owner slice，再以 `selectWallpaperId` 读回。设备native诊断须记录 `APK_CHANGED_SELECTION_RESET` 且previous/candidate均不可加载；focused boot-policy测试用旧context/token断言无法确认新reservation。Web同名case只覆盖owner从APK1/HOT5优先选择FULL2。双屏真机以外的机型、mobile形态和双机配对均不属于本次验收范围。
5. 原生T及资源预算单场景测量；T=60s覆盖HOT候选和唯一一次恢复包，普通已确认启动不启动该期限；不为PASS盲延timeout；保留firstfailure/lastknown good。
   `update.interruption` 是一个真实端到端carrier case，同一受管run依次覆盖两个相邻边界，避免为同一安装链另建完整runner：PackageInstaller确认待处理时强停并重启本run应用，selector读回同一task/action/target、native log的`installer-commit`计数不增加，再继续真实安装；随后HOT候选在确认前写入一条owner durable UI-state，触发已有`surface-content` build-time失败保护，最终由上一成功embedded包的selector读回同一值。该run同时映射V-22及V-25“候选确认前写入由恢复目标读回”子判据；V-25其它发布兼容和无安全恢复目标子判据按各自focused/native proof映射，不外推。`update.boot-guard`仍单独证明PRIMARY真实ready、内容失败未确认、期限恢复和`HOT_BOOT_TIMEOUT`。
   仅受管 `update.boot-guard` 与 `update.interruption` 的 HOT Release bundle 设置 `EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION=true` 与固定 owner `surface-content`，其他产物显式清除此开关；真实 `SurfaceRoot` 边界必须先记录 `source=build-time outcome=matched`，随后记录该 owner 的 `render-failed`，场景从 Android Runtime 诊断中核对两项后才继续，不发送 PRIMARY 确认。Expo 官方说明 Metro 在 bundle 构建时内联显式引用的 `EXPO_PUBLIC_` 变量（https://docs.expo.dev/guides/environment-variables/）。所有release/debug Metro bundle task把`EXPO_PUBLIC_*`环境快照SHA-256（不保存原值）纳入Gradle task inputs；artifact builder复制前核验boot-guard编译标记，漏注入或旧缓存均fail closed。场景读取实际embedded身份、`HOT_BOOT_TIMEOUT`与原生日志恢复事件；受管runner缺最终断言marker时fail closed。此前boot-guard结果见§11.1；新增carrier当前字节结果见§11.3。
   PROOF：`update.interruption`同run承载V-22及V-25数据读回子判据；`update.boot-guard`覆盖V-23/24；兼容发布、无安全恢复目标和图片/字体分别使用对应focused/真实native证据；共享Host单机双屏。
   已执行的 V-26 普通 HTTP 失败/主动断开设备 carrier 为 Wallpaper `update.rollback`；Console 同类人工故障注入按 2026-10-09 范围收敛不追加运行。V-25 无安全恢复目标的选择规则由 adapter focused 测试覆盖。native失败文字的设备可见性仍按§11a单独记证据，未运行前不得据focused策略测试标为设备PASS。
   CP出口：F-BOOT/F-COMPAT/预算关闭，完整CP MATCHED；有未解释native失败不推进全体验收。

## 6. CP-05 · 统一automation完整场景

RECALL：全部A范围§11a；automation正式需求/已交付设计/current接口；TR08/TR16/受管资源、日志/cleanup。
允许修改：当前driver fixture/scenario/Android adapter及测试；两App自动化run配置；业务fixture只复用既有共享helper，不复制TDC acceptance。
步骤：

1. 受管静态文件HTTP根只供本run构建/可信工件；source/expectedhash由fixture登记，关闭后cleanup，不用第二业务mockserver。
2. automation连接→selector baseline+动作前订阅→command dispatch/requestId；语义触发使用 driver.transport.request，新 UI 动作使用现有 requests.observeUiAction({server, sessionId, workspace, displayMode, commandName, action})。reload后重新取得当前应用 session，重建固定 sessionId 的 Web/Android UI port、selector 与 request 观察，不复用旧对象；runtimeId/bootToken区别明确。业务 fixture 使用 ensureActivated({shape, deviceId, runId})，Android deviceId 从新会话 runtime.info 的生产 DevicePort 读回，Web 使用本 run 注入。
3. 同runapplicationId/signature/storage稳定；现有androidBuild新run后缀机制只用于第一次安装，不每FULL另起新run。FULL成功后等待当前package actualfacts/新agent，而非等待旧request完成。
4. 系统install真实点击及native失败读取走同driver扩展；安装、来源设置与原生启动失败文本三类非 React 界面按 automation R-10 用同 driver 内 uiautomator 窄例外（失败文本只读），注明来源；不启动旧 ter-*-android/Web/UiAutomator runner，TER React 节点仍走 agent。
5. 两App 的适用 Android case 均在 Dexter 指定的同一双屏真机以 `shape=dual` 执行；不要求其他设备/机型或 `shape=mobile`。非adapter 行为先以 Expo Web 执行同场景断言，再在该双屏真机验证；双机更新规则/投影不属A。
6. cleanup：退订/HTTP server/agent/ports/process trees/prepared/installer引用均按identity；别删除active/previous或未知session文件；cleanup失败先修。设备 APK/reverse 清理失败及 setup 中部分创建后的释放失败，必须进入当前受管 runner 的 cleanup 判定，不能仅将 Vitest 非零记为 business FAIL、同时以本机目录/进程清空记 cleanup PASS。复用修复后的现有清理通路与设备身份，不新增恢复服务。
   Android Kotlin focused runner `tools/terminal-shared/run-owned-android-tests.mjs` 也必须在启动前拒绝已有 Android `build`/`.cxx` 中间产物，结束时只清理由本次 run 创建的目录、逐项读回，并将清理路径与结果写入本 run manifest；共享 `.gradle` 依赖缓存不属于清理目标。扫描遇到符号链接或根外目标必须 fail closed，不跟随或删除目标。
   若 Android 场景以 `cleanup=FAIL/UNKNOWN` 结束，同设备的新场景必须先停止；通过 `scripts/test/terminal-automation.mjs --recover-failed-android-run <runId> --device-serial <serial>` 仅回收失败 run 可证明拥有的 APK 与 ADB reverse。新 run 在事件日志记录每条 driver/service reverse 的 attached/released 及 serial/remote/local；旧 run 仅可按该场景的 driver/installer 原日志识别固定受管 remote port，且仅当对应 host local port 无监听时回收。恢复入口核对原 manifest 路径、失败状态、device serial、packageId 派生关系、run 进程身份和 reverse 所有权，逐项做设备读回并生成独立 cleanup manifest；不改写首败，不触碰其它 service reverse 或未知 PackageInstaller session。所有身份缺失、歧义、host port 仍活跃或设备未就绪均 fail closed。
   PROOF：driver focused、Web→AND精确case，不运行all做发现；R18相关fresh skill试跑只在已批准automation能力要求内复用，不本批重做全部agent验收。
   CP出口：整套场景源码与focused/必要动态完成、完整CP MATCHED；未受影响已MATCHED内容不再重做。

## 7. CP-06 · 批次收尾和整体验收

先完成本CP的必要源码/脚本收尾、focused、入口清理与文档同步，再做本CP退出三维对账MATCHED及全批6b MATCHED。
随后执行批次整体场景回归；实际修复按受影响CP/6b差量复查，不循环要求所有无关CP重对。
交付前13c逐代码设计对账MATCHED；fresh独立REVIEW_TARGET=IMPLEMENTATION整批审查；NO-GO确认部分最小修复后fresh复评，不受DESIGN两轮上限。
最终给Dexter/Claude提供每条§11a的当前字节结果及firstfailure/lastknown good，分清Web/native/business/cleanup；计划不提前填PASS。
本阶段只执行对阶段A修改有直接验证价值的检查，不为满足全仓默认入口而运行未修改、与阶段A无关的模块测试。若 `scripts/verify` 的固定运行表包含此类无关项，则不要求为本阶段完成整仓verify；已执行的相关静态门、focused测试和受管运行分别报告。任何实际启动但未完成的 `scripts/verify` 均标记 `INTERRUPTED/NO_VERDICT`，不得包装为完整通过；`--validate-only` 也不替代其未执行的检查。

## 8. 未来命令与执行面

打包入口：两 application 均通过 `yarn package:install`、`yarn package:full`、`yarn package:hot` 调用同一 Node builder。三个命令必须在同一个受管 `update.artifacts` run 内顺序执行；FULL 与 HOT 默认读取该 run 下本应用的 `update/<app>/install.json`、`update/<app>/full.json`，不得传入任意 APK 路径。FULL传输物为单APK ZIP，`expectedSha256`覆盖外层ZIP，artifact `apk.sha256`覆盖内层APK，`publicationId`覆盖compiled发布内容；解包后复用既有APK验证及PackageInstaller路径。该入口与 `tools/terminal-automation/journeys/update.test.ts` 一致。
受管产物场景：`scripts/test/terminal-automation.mjs --phase update --case update.artifacts --sample console --platform web --shape mobile`，先在同一 run 执行 builder self-test、canonical generator `--self-test` 与 `--check`，再按每个 application 顺序执行 INSTALL→FULL→HOT 并在本 run 内读回摘要与同字节 APK；最终 APK 由 `aapt dump permissions` 确认包含 `android.permission.REQUEST_INSTALL_PACKAGES`，缺少权限时拒绝产物。该权限是发起安装来源授权页的必要条件之一，不代表设备已允许安装；系统限制导致设置项禁用属于设备策略边界，不能通过绕过 PackageInstaller 达成测试。该run不要求 DEV。两 App 的 Gradle root、application 与所有 Android library project build tree 均位于本 run 的 `android-build/<application>`；项目输出目录按 Gradle project path 的分段身份映射，不能共用 app 输出路径。AGP CMake `.cxx` staging 位于同一 run 的 `android-build/native/<application>/<gradle-project>`，在各临时 `build/` 目录之外，满足 AGP 不允许 staging 位于临时 build 子目录的约束。Gradle settings 写入 `android/build` 的 autolinking 输出通过仅在单次 Gradle 调用期间存在的链接映射到本 run 的 `android-build/<application>/root`。RN/Expo codegen 的 Android library `sourceDir/build` 由 Gradle 依据真实 projectDir/buildDirectory 建立临时链接；每个 run-owned target 先创建为实际目录，再建立符号链接，避免 Expo 配置期写入时跟随悬空链接失败；链接身份在 run 内 registry 先登记，正常退出由 builder 清理，异常退出由 runner 按 manifest/registry 精确校验并清理。Gradle 调用固定附加 `--info --stacktrace`，受管日志保留失败任务、外部命令上下文及异常栈，避免只留下“node exit 1”而无法确定 owning task。RN 0.86.3、Expo Modules Autolinking 57.0.12 的官方源码路径依据及机制见详设 §3；不得把当前两个首败模块写成固定白名单。AGP 8.12.0 的 `Cmake.buildStagingDirectory` 将 native staging 从默认源码树 `android/<module>/.cxx` 指向本 run；关闭 Gradle Problems HTML 报告。runner 退出清除临时链接、完整 Gradle build/native 树及两 App 的 publication/staging/embedded metadata、APK 与 HOT ZIP，只保留 INSTALL/FULL/HOT 小型 JSON 摘要、日志和 manifest；cleanup 前扫描 `apps/terminal` 下 Android 项目的 `build` 与 `.cxx`，发现 run 外产物则 cleanup FAIL，文件系统 readback 必须确认链接与产物均清理完成。共享 Gradle 依赖缓存（`.gradle`）不属于清理目标。AGP 官方 API：https://developer.android.com/reference/tools/gradle-api/8.12/com/android/build/api/dsl/Cmake。业务场景沿用 `--case update.flush|update.compatibility|update.rollback` 并由 runner 校验 managed DEV identity；其余 update cases 走各自计划入口。Android 场景再加 `--platform android --device-serial <本run登记serial>`，双屏用 `--shape dual`。当前命令以 `tools/terminal-automation/src/runner.ts` 的闭集及对应已存在 suite 为准；未实现的 case 由入口 fail closed，不以计划文本冒充可运行。
真实执行用仓内包管理器/解释器和script shebang；具体现有runner语法重新读源码，发现参数不符修本计划/adapter，不发明旁路。Android 的全部剩余设备验收绑定§0.10指定的同一台双屏真机及其 run manifest serial；不得要求其他设备或双机配对拓扑。
不涉及adapter的判据使用W同一case；native安装/loader/断进程不写“Web已证明”。系统用户动作是真实点击，而正式owner command是能力trigger；两类不混用。

## 9. 动态准入、fixture和cleanup

所有首次动态前：当前CP静态三维准入、fixture/actions/assertions审查、资源所有权预算预检；focused后阶段退出独立对账。
整体动态前：全CP MATCHED、全批6b、适用UI/testId、manifest资源预检；reset/seed/BrowserL2均N/A，不能对它们作空分母通过。
本地case不需DEV；业务数据恢复case复用当前automation既有DEVfixture（term-front/term-handheld、REQUIRE_INACTIVE、manifestdevice身份才cancel），须相应执行授权；不隐式reset/seed。
resources：本机PID+OSstarttoken，远端若有DEV则host/boot/ticks；只停本run拥有资源。长运行manifest+heartbeat、脱敏日志、business与cleanup分开。
本批A不新增Testcontainers需求；若未来选用已授权backendacceptance则遵守既有DEV stop/test/restart联动，不能自行扩张本地Java/PGtunnel。
未知installer是业务UNKNOWN，不允许通过清文件或杀系统进程拿cleanupPASS；可释放本run服务连接但保留安装仍需内容，明确native资源仍owned/awaiting并阻止新冲突run。

## 10. 停机与失败处置

首次失败保留并读日志/owning source，修同根路径，再同casefocused；同failureCategory第二次冻结该族推进。
只在确有硬约束或需改变产品/授权时交Dexter；不因脚本失败结束整个已授权实施批次。
没有手工失败工件重试、恢复框架、延timeout掩盖、旧runner或跳过nativeproof的捷径。

## 11. 交付清单和当前状态

未来交付：两App真实三产物、生产源码/生成输入输出、阶段/6b/13c、逐case proof、source binding、完整verify、freshimplementationreview、business/cleanup与外部handoff。
阶段 A 当前实现已进入交付复核。适用双屏设备场景与focused验证以§11.1为准；全批6b、13c和fresh整批IMPLEMENTATION review尚未关闭。完整 `scripts/verify` 本轮在U03启动后为 `INTERRUPTED/NO_VERDICT`，不记完整通过；U04及之后未启动。用户已明确要求避免无关测试，后续只运行对阶段A当前修改有直接覆盖价值且尚无当前字节证据的验证。
UI_CONTENT=ACCEPTED；DEXTER_WIREFRAME_REVIEW=ACCEPTED（2026-10-06，三个面内容均已确认）。FULL_MIN_ANDROID_API=29。历史 review 只适用于其原输入字节，不作为当前实现 verdict；本次实施授权来自 Dexter 2026-10-06 会话指派。

当前字节上的最新运行：run=`r5-verify-66543-1791436533811`（2026-10-08T14:15:33+09:00），默认 `scripts/verify` 在 `U03-platform-iam` 启动时被停止；其为 `INTERRUPTED/NO_VERDICT`，不是完整verify PASS。U04及后续未启动。
最后一次通过：run=`r5-tc-1791438253561-20609`（2026-10-08T14:44:13+09:00开始），U03平台IAM远端测试与Testcontainers清理PASS；该项不属于阶段A。阶段A最后一次业务场景PASS为run=`78384df1-5555-414f-aa69-c527f2f757c8`（2026-10-08T04:59:12Z～05:04:01Z），Wallpaper Android `update.install-result`，指定双屏真机 `D409P5C2J0285`、`shape=dual`，business=PASS、cleanup=PASS。每项只证明各自范围，详细场景清单见§11.1。
CP-03 本轮差量由 fresh 独立只读 reviewer `cp03_cancel_retry_delta` 核对为 MATCHED；该结论仅覆盖 retained action 的读回与用户取消后同目标重邀，不替代既有 CP-03 全阶段记录或全批6b。

### 11.1 · 2026-10-08 当前范围、场景与验证收口

Dexter 将本轮Android执行面限定为当前连接的一台双屏真机，不要求其它设备、机型、已关闭虚拟机或双机配对拓扑。所有下列设备manifest均记录同一设备 `D409P5C2J0285` 与 `shape=dual`。此前对该设备尝试的 `shape=mobile` preflight 因其暴露四个逻辑显示而拒绝；该形态为 `NOT_COVERED`，没有重试或换设备。

| 样本      | 场景                    | run id                                 | business | cleanup |
| --------- | ----------------------- | -------------------------------------- | -------- | ------- |
| Console   | `update.compatibility`  | `09160a18-f3b0-423f-bd68-4a96368f2e42` | PASS     | PASS    |
| Console   | `update.full-hot`       | `0ba7d975-520f-43c4-8f3e-3cf987b1a2f9` | PASS     | PASS    |
| Console   | `update.offline-assets` | `b85875a5-5c8c-4cb7-83ea-4f40253955ee` | PASS     | PASS    |
| Console   | `update.boot-guard`     | `d142d95b-bace-44ad-9b00-57a2948db316` | PASS     | PASS    |
| Console   | `update.install-result` | `97fbf94b-6d59-4766-b8c7-5dd9f7484c47` | PASS     | PASS    |
| Wallpaper | `update.compatibility`  | `11f8b8ff-7272-4c65-9c03-a31b3c4b3195` | PASS     | PASS    |
| Wallpaper | `update.full-hot`       | `57f9417b-5402-4cfd-9062-bbece665e1ba` | PASS     | PASS    |
| Wallpaper | `update.offline-assets` | `4ca28e1c-7b13-49b7-a378-277d3954aafe` | PASS     | PASS    |
| Wallpaper | `update.boot-guard`     | `7760adda-1766-499e-a337-e39127c1c915` | PASS     | PASS    |
| Wallpaper | `update.install-result` | `78384df1-5555-414f-aa69-c527f2f757c8` | PASS     | PASS    |
| Console   | `update.interruption`  | `90931f94-eaf9-4cbb-bcf9-cae810c7d2e5` | PASS     | PASS    |
| Wallpaper | `update.interruption`  | `acaa3d2e-1862-4891-ae37-4e53d6f4d3be` | PASS     | PASS    |

这些manifest均为 `FINISHED`，且记录独立业务与清理结果。对应场景断言覆盖真实安装/版本读取、FULL→HOT续接、离线资源读取、启动保护与安装结果处理。未由表格覆盖的受管设备case不得推定PASS；以详设§11a逐判据状态为准。

本轮默认 `scripts/verify` 的静态阶段通过，执行到的TDS/终端相关远端门、Node测试、foundation测试、U02业务后端测试/Flyway及U03平台IAM测试均在各自运行记录中为PASS；U03不是本专项变更范围。为避免继续运行与阶段A无关的后端模块测试，verify在U03启动后停止，U04及之后没有启动，所以完整verify保持 `INTERRUPTED/NO_VERDICT`。不重跑已经有当前字节PASS的验证，也不将单项PASS合并声称为完整verify PASS。

本轮仅为结束执行状态而引用已有manifest和日志；未因本段新增测试运行。剩余交付门：全部CP及全批6b独立三维对账、交付前13c逐代码与详设对账、fresh整批IMPLEMENTATION review。没有记录的判据保持 `NOT_RUN/OPEN`，不以历史运行或作者声明代替。

### 11.2 · 2026-10-08 重启后交付差量

CP-02 的生产 fixture 边界由 `apps/terminal/ui/integration/sample-wallpaper-console/test/publicSurface.test.ts` 扫描两套 integration `src` 与两个 Android application 的 `App.tsx`/`src` 导入图。测试通过向同一生产图校验器注入生产文件的 fixture import 做红夹具，断言违规项被拒；实际图的绿检查覆盖真实生产文件。该范围只阻止 Web typed fixture 进入生产图，保留 wallpaper 的独立 F-LOAD asset probe。执行 `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test` 得 `PROD files=6 tests=40 PASS`，`VITEST_RUN_END unhandled=0`；包 runner 清理临时 JSON 与 Vitest 缓存，没有生成受管 run id。此项是 CP-02 当前字节 focused package proof，不替代其他 CP 或整体验收。

§11.1 Console Android `update.install-result` 的 manifest 身份更正为 `97fbf94b-6d59-4766-b8c7-5dd9f7484c47`；该路径存在且 `runId` 一致，manifest 记录 `business=PASS`、`cleanup=PASS`。仅修正文档引用，没有重跑场景。

### 11.3 · 2026-10-08 CP-04 interruption carrier 准入

`update.interruption` 是本轮新增的 CP-04 Android carrier，执行面为当前唯一指定双屏真机 `D409P5C2J0285`、`shape=dual`，Console 与 Wallpaper 各执行一次。它依次验证 PackageInstaller pending 时强停/重启后同 task/action/target 与 installer commit 次数不变，再完成安装；随后 HOT 候选确认前写入 durable UI-state，注入已有 `surface-content` failure，由上一成功 embedded 包读回该值及 `HOT_BOOT_TIMEOUT`。该 carrier 覆盖 V-22 与 V-25 的“候选确认前写入由恢复目标读回”子判据，不替代 V-25 其余发布兼容/无安全恢复目标判据。

执行入口（每个样本单独一个受管 run）：

```sh
node scripts/test/terminal-automation.mjs --phase update --case update.interruption --sample console --platform android --shape dual --device-serial D409P5C2J0285
node scripts/test/terminal-automation.mjs --phase update --case update.interruption --sample wallpaper --platform android --shape dual --device-serial D409P5C2J0285
```

运行前置：CP-04 fresh 三维准入 MATCHED；driver 从 `.runtime/r5/run-manifest.json` 校验当前 managed DEV 身份；runner manifest 绑定上述设备与场景。生产代码和测试脚本在两个受管 run 间冻结；business 与 device/process/artifact cleanup 分开判定。`update.interruption` 的 final assertion marker 必须出现在受管日志中，否则 runner 将 business 判 FAIL。

当前字节 focused proof：`yarn workspace @catering-v2s/terminal-automation typecheck` PASS；`yarn workspace @catering-v2s/terminal-automation test runner.test.ts androidCleanupRecovery.test.ts` 2 files/39 tests PASS；Prettier 对修改的 automation 文件检查 PASS。结果证明 case/managed DEV/marker/失败后受管恢复 allowlist 的静态执行门和类型，不证明设备行为。`update.interruption` 只可从 manifest 已证明的本 run 设备/包身份恢复；未登记场景仍由红例拒绝。

动态结果边界：此前 Wallpaper `125b1ea5-008e-4ccf-89fc-3b8f29f720f8` 与 Console `5c34d34d-6afd-495b-b9c1-bf7bb2a2f0a1` 的 `update.interruption` 运行在本段分层变更之前，仅为历史证据。该段的 `NOT_RUN` 是当时状态，已由 §11.4 的当前字节运行取代。

### 11.4 · 2026-10-08 更新逻辑分层与 CP-04 当前字节结果

按 Dexter 最新要求，更新策略、目标校验与运行时更新行为只允许位于 `apps/terminal/kernel/base` 或 `apps/terminal/adapter`。当前生产边界核对结果：更新决策、任务/阶段状态与启动续接由 `kernel/base/terminal-update` owner 承担；Android automation descriptor 的读取和来源路径校验由 `adapter/android/update` 承担。两个 Android application 只装配 adapter 工厂和 `UpdatePort`；两个 UI integration 只装配 base owner 并在正常页面就绪后发送通用 Runtime 生命周期事实，不读取更新 state、不判断更新阶段、不调用更新专用 command。`test-expo` 中的 target provider 是测试 fixture，不进入生产依赖图，也不承担生产更新逻辑。

定位到的先前阻塞是 base owner 在 PRIMARY 内容就绪处理期间同步等待 FULL→HOT artifact preparation，造成主屏 TestId 尚未注册。最小修正是在现有通用 `primarySurfaceReadyCommand` 后快速确认生命周期事件，再由 base owner 通过既有 `confirmTerminalUpdateBootCommand` / `reconcileTerminalUpdateCommand` 完成异步续接；策略没有移入 application 或 integration，也未新增更新旁路。聚焦回归由 `terminalUpdate.test.ts` 的未完成 artifact preparation 屏障断言 readiness 不等待下载关闭。

当前字节运行（同一批准双屏设备 `D409P5C2J0285`，每个样本独立受管 run）：

| 样本 | 场景 | run id | UTC 时间 | business | cleanup | 断言标记 |
| --- | --- | --- | --- | --- | --- | --- |
| Console | `update.interruption` | `90931f94-eaf9-4cbb-bcf9-cae810c7d2e5` | 2026-10-08T09:37:30.251Z 起；完成约 09:43:03Z | PASS | PASS | `TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS` |
| Wallpaper | `update.interruption` | `acaa3d2e-1862-4891-ae37-4e53d6f4d3be` | 2026-10-08T09:31:39.156Z 起；完成约 09:37:18Z | PASS | PASS | `TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS` |

两次运行均观察到 installer 中断后仍为同 task/action/target、未重复 commit；用户完成安装后 APK identity 改变，应用以实际 FULL native build 读回并继续 HOT；随后读回实际 HOT boot failure 和持久 UI-state。各自 manifest 均记录业务与清理 PASS、受管反向端口释放、运行产物清理及设备清理 PASS。Android 系统最终转场的短暂按钮等待失败随后由安装器成功回调、APK identity 变化和最终场景断言闭合，不单独记为业务失败。

当前字节上的最新运行：Console `update.interruption`，run `90931f94-eaf9-4cbb-bcf9-cae810c7d2e5`，business=PASS、cleanup=PASS。最后一次通过：同一最新 run；Wallpaper 对应 run `acaa3d2e-1862-4891-ae37-4e53d6f4d3be` 亦为 PASS/PASS。历史首败 `a5d42ed8-217a-4011-ad30-1ee9dc48638a` 保留为修复前 `TERMINAL_AUTOMATION_NODE_NOT_READY_TIMEOUT`，不覆盖为通过。以上是 CP-04 受影响 carrier 的当前证据，不替代全部阶段 A 判据、全批 6b、13c 或整批实现 review。

### 11.5 · 2026-10-08 HOT reload 协程取消与 compatibility 当前字节复验

CP-04 在 PRIMARY readiness 与 adapter provider 分层后，必须重新证明 FULL→HOT 跨 Runtime 路径。首次 Console compatibility run `2b0ccc32-ea12-4d96-9f7c-9fef0a936b15` 保留为首败，business=FAIL、cleanup=PASS：native 日志显示 HOT 选择与 UI-state 写入成功，随后 Expo module 被销毁时模块作用域的 suspend operation 抛出 `ModuleDestroyedException`；新 Runtime 启动后持久 action 仍为 `applying`，owner 无法确认 HOT boot。该失败不是连接或下载失败，也不通过延长等待修复。

根因核对实际解析的 `expo-modules-core@57.0.14` Android module coroutine 生命周期：Expo 官方 [Module API](https://docs.expo.dev/modules/module-api/) 说明模块销毁会取消其作用域中的挂起函数。最小修正没有把策略移入 integration/application，也未重发旧 command：adapter 的纯 `hotActionReadbackState` 仅在当前 boot token、HOT entry kind 与 selected publication 三者精确匹配时，将持久 `applying` action 投影为 `accepted`；之后新 Runtime 发出的通用 `primarySurfaceReady` 仍由 `kernel/base/terminal-update` owner 确认并完成任务。token、entry 或 publication 任一不匹配时保持原状态，不确认。Android adapter focused Kotlin 测试 `node tools/terminal-shared/run-owned-android-tests.mjs --module adapter-android-update` PASS：1 module、2 classes、11 methods；runner manifest 记录源码 SHA-256 `35bcdbfc334bbc0c2a565fa85c197cf2f4b7c33cce011f93d9ca91270102cc22`，Android 中间产物与 runner cleanup PASS。Web/integration/application 没有新增更新业务逻辑。

当前字节下两 App 的真实 compatibility 结果：

| 样本 | 场景 | run id | UTC 时间 | Android | business | cleanup | 断言 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Console | `update.compatibility` | `d58d206e-fd36-434d-91b6-0e52f36bc62c` | 2026-10-08T10:11:05.658Z 起；结束约 10:16:14Z | API 34 / `D409P5C2J0285` / dual | PASS | PASS | `TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS` |
| Wallpaper | `update.compatibility` | `f3c08db9-c7ee-4b82-a0b3-46e656ce8ac4` | 2026-10-08T10:16:21.706Z 起；结束约 10:21:40Z | API 34 / `D409P5C2J0285` / dual | PASS | PASS | `TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS` |

两次 run 均读回 APK1/HOT JS5 写入的业务数据；完成 FULL2 后首次启动读取 embedded4；随后 HOT6 被实际下载、应用并由 owner selector 读回 succeeded；再次进行 run-owned FULL3 替换后，新启动从 embedded7 读回同一业务数据，且记录 `APK_CHANGED_SELECTION_RESET`。Wallpaper 另外由生产资产 selector 证明 FULL 与 HOT 图片均 `loaded=3/3; failed=0`。每次都通过同一受管设备执行 installer 来源设置与 `Update` 点击；runner manifest 均为 `FINISHED`，设备包卸载读回、ADB reverse 关闭、临时APK/HOT/Gradle中间物清理与runner cleanup均PASS。各 run RSS 峰值约 500 MiB，低于 2 GiB run 预算；没有留下本次构建产物。

当前字节上的最新运行：Wallpaper `update.compatibility`，run `f3c08db9-c7ee-4b82-a0b3-46e656ce8ac4`，business=PASS、cleanup=PASS。最后一次通过：同一 run；Console `update.compatibility` run `d58d206e-fd36-434d-91b6-0e52f36bc62c` 为 PASS/PASS。首次失败 `2b0ccc32-ea12-4d96-9f7c-9fef0a936b15` 仍保留为修复前失败，不被当前通过覆盖。以上证据仅关闭 CP-04 compatibility 这条受影响路径；CP-04 MATCHED 仍须由 fresh reviewer 核对完整 CP 的实现、focused proof、分层要求及场景映射。

### 11.8 · 2026-10-09 Claude源码评审修复差量

主 agent 重新核验 S-1～S-4，四项均 `CONFIRMED`。S-1 在 `terminalUpdateActor.ts` 用 `UpdateFacts.embedded` 对比安装APK身份，避免把当前HOT selected JS发布当成FULL身份。S-2 在持久task中把`actionKind`绑定到`actionId`，FULL读回成功仅当action publicationId与固定FULL工件一致才续接HOT；不会因观察phase变更重做FULL。S-3 将确认视为当前PRIMARY boot生命周期事实，通用ready命令由base owner读取当前boot身份并调用adapter确认；Android仍按准确boot token、publication及installed APK身份拦截迟到确认；详设DG-1已同步。S-4 builder将FULL传输物改为只含同次INSTALL APK字节的ZIP：ZIP摘要用于下载校验、内层APK摘要用于解包校验、publicationId仍表示APK内容发布身份；原生解包后复用现有APK签名/版本和PackageInstaller链。runner清理单测改为覆盖FULL ZIP和随包descriptor。

当前字节 focused 验证：`yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` PASS；同包测试 `2 files / 30 tests` PASS；`yarn workspace @catering-v2s/adapter-android-update typecheck` PASS，同包 `2 files / 8 tests` PASS；`yarn workspace @catering-v2s/terminal-automation typecheck` PASS；runner清理单测 `1 file / 38 tests` PASS；`node scripts/build/terminal-update-artifact.mjs --self-test` 与 `node --test scripts/test/terminal-update-artifact.test.mjs` 均PASS（2项）；终端automation journey文件由typecheck覆盖，受管Android/Web journey本轮未启动。曾用不匹配Vitest include的过滤参数尝试该journey文件，入口报告`No test files found`；未把该结果当业务失败，也未重复错误命令。

Android Kotlin focused test 命令 `node tools/terminal-shared/run-owned-android-tests.mjs --module adapter-android-update` 在Gradle启动前由资源门拒绝：存在四个node_modules下既存Android `build`目录（Expo Modules Core、Expo、Reanimated、Worklets），没有匹配本run的清理身份，故本次未创建Android test run manifest、未运行编译或Kotlin测试。未删除这些未知所有权目录，也未绕过受管入口。Kotlin focused proof=NOT_RUN；此项为当前静态修复的剩余验证OPEN。

当前字节上的最新运行：格式化后定向检查链退出码0：terminal-update typecheck + 2 files/30 tests、adapter-android-update typecheck + 2 files/8 tests、terminal-automation runner 1 file/38 tests + typecheck；测试源码与当前修复字节一致。最后一次通过：同一检查链；builder self-test与artifact Node测试此前也通过，相关字节未改变。Android Kotlin受管runner最近尝试在Gradle前被资源准入拒绝（`PREEXISTING_INTERMEDIATES`），无run id、无Gradle任务启动；runner report未创建受管run。该Kotlin focused proof仍OPEN。无本轮完整动态运行、Expo Web、Android设备、DEV、完整`verify`，均保持NOT_RUN。

fresh 独立只读 reviewer 对 S-1～S-4 修复差量给出 `REVIEW_TARGET=IMPLEMENTATION, VERDICT=GO, M/S/N=0/0/0`。其核查了9个相关文件及两项 typecheck，没有运行测试或读取 runtime evidence；本轮 focused tests 由主 agent 单独执行。该 verdict 仅覆盖四项静态修复差量，不关闭 Android Kotlin focused proof，也不替代阶段 A 全批复核。

### 11.6 · 2026-10-08 Runtime 请求观察器超时根因修复

本轮针对 `27f3fc69-94f4-4ac2-8530-69cbad6b9a32` 暴露的 `SELECTOR_SERIALIZATION_BUDGET_EXCEEDED` 做了全链静态和反例审查。旧 driver 为发现新请求订阅完整 request execution view，把 actor result、error 与 observations 一并序列化；但该观察点只需要 request 身份。最小修正是在 Runtime base 增加紧凑的 `selectRequestExecutionCandidates`，只返回匹配 workspace/command/displayMode 的 requestId；精确业务结果仍由原 `selectRequestExecutionView(requestId)` 检查。automation-agent 对 selector 失败新增脱敏结构化诊断字段 `selectorName`、`failureCode`、`phase`、`elapsedMs`、`budgetMs`，不记录 selector 参数、状态正文或业务值。更新 owner、integration 和 application 的策略/状态边界未改变。

本次相关静态检查：Runtime、automation-agent 与 terminal-automation typecheck 均 PASS；Runtime PROD/DEV 为各112项 PASS，automation-agent 43项 PASS，terminal-automation 253项 PASS。Runtime 候选 selector 的回归覆盖大型 result 正文、workspace 与 displayMode 筛选，并断言候选结果不携带 actor result/observation；诊断回归断言超时元数据存在且正文缺失。此前的初次 DEV 失败是 startup inventory 测试漏列既有 `runtime.primary-surface-ready` command，已修正测试期望为8并用112项 DEV 测试复验通过。未运行全仓 `scripts/verify`；该项是否需要在阶段收尾执行，按计划与当前授权做相关性判断，不把历史中断记录改成 PASS。

受管 Android 双屏 Wallpaper `update.rollback` 当前字节运行：run=`a7a12427-8cd6-4abf-94f3-46427534c220`，device=`D409P5C2J0285`，Android API 34，`shape=dual`，business=PASS、cleanup=PASS。运行实际构建并核验 INSTALL/FULL/HOT 工件；真实 PackageInstaller 请求来源设置、读回启用、点击系统 `Update` 并收到 `status=0`；APK identity 变化后 FULL 应用重新启动，随后完成 HOT 阶段。最终业务断言验证 HTTP 503 被一次性注入后 read command 返回 typed failure，task 保持 `succeeded` 且仍选中 HOT；设备包、ADB reverse、runner 进程树与临时构建/更新工件均按 manifest 清理通过。该运行复现并关闭此前的请求观察器超时路径，不替代其它场景。

运行中安装页出现一次系统 `wait-button.failed`，但随后 PackageInstaller callback `status=0`、APK identity changed、FULL 应用重启以及最终 `TERMINAL_AUTOMATION_UPDATE_CASE_ASSERTIONS_PASS` 均成立；它是系统页短暂转场观察结果，不覆盖成功安装证据，也不被单独改写成安装失败。此前首败 `27f3fc69-94f4-4ac2-8530-69cbad6b9a32` 仍保持 FAIL/PASS 原始记录。

当前字节上的最新运行：run=`a7a12427-8cd6-4abf-94f3-46427534c220`，2026-10-08T13:45:28Z 起，Android `update.rollback`，business=PASS、cleanup=PASS。最后一次通过：同一 run，结果与当前修复字节一致。全批6b、交付前13c及 fresh 整批IMPLEMENTATION review仍未由本段关闭。

### 11.7 · 2026-10-09 §11a 当前字节逐项证据映射与范围收敛

为避免从已运行场景推断未运行判据，下表逐项对应详设 §11a 的 14 行。`PASS` 只表示该行注明的判据范围已有当前源码测试或适用运行；`PARTIAL/OPEN` 明确表示该行全部判据尚未闭合，不升级为整行通过。

| §11a 判据 | 当前证据 | 当前处置 |
| --- | --- | --- |
| `update.artifacts` | Web 受管 run `18f1bebe-f400-4679-8d3d-3b326412e087`，Console，2026-10-07，business/cleanup PASS；覆盖受管三产物构建与最终 APK 读回。本轮只改 Android HOT 解包内部实现和测试 helper，未改生成器、版本单源或 APK 权限合并。 | PASS（产物链判据；不声称本轮重新构建） |
| `update.baseline` | 当前 `terminalUpdate.test.ts` 的兼容基线、未知身份、拒绝 HOT 与不调用 apply/select 的断言；本轮 `yarn workspace @catering-v2s/kernel-base-terminal-update test`，2 files/27 tests PASS，随后 `typecheck` PASS。 | PASS（base owner focused；修复后的 HOT boot failure 与失败发布物禁止重入包含在 27 项内） |
| `update.archive` | 本阶段范围于 2026-10-09 收敛为有效发布物主路径；Android `update.full-hot`/`update.compatibility` 历史受管运行包含真实 HOT 准备、安装和状态读回。 | 有效发布物主路径沿用 full-hot/compatibility 的已记录结果；归档恶意输入专用测试已从本阶段范围移除。移除后没有新的 Android archive focused run；相关极端反例保持 NOT_RUN，不声称通过。 |
| `update.fixed` | 两个 sample 的 Web 受管 run `cb2fc92a-5875-4054-80cd-ef79d725b8c5` 与 `552273c5-7aaa-4f46-a212-fa305a62ed42` 均 PASS/PASS；base owner focused 测试覆盖固定目标、慢准备、冲突和迟到结果。 | Web/base 主路径已有证明；人工并发/迟到组合的 Android 双屏 carrier 属 2026-10-09 收敛范围外，保持 NOT_RUN，不作为当前主路径交付阻断。 |
| `update.full-hot` | Console `0ba7d975-520f-43c4-8f3e-3cf987b1a2f9`、Wallpaper `57f9417b-5402-4cfd-9062-bbece665e1ba`，指定双屏设备，PASS/PASS。 | PASS |
| `update.compatibility` | Console `d58d206e-fd36-434d-91b6-0e52f36bc62c`、Wallpaper `f3c08db9-c7ee-4b82-a0b3-46e656ce8ac4`，指定双屏设备，PASS/PASS；Web 两个 sample 亦有 PASS/PASS 受管运行。 | PASS |
| `update.install-result` | Console `97fbf94b-6d59-4766-b8c7-5dd9f7484c47`、Wallpaper `78384df1-5555-414f-aa69-c527f2f757c8`，指定双屏设备，PASS/PASS。 | PASS |
| `update.flush` | 当前 base owner 测试覆盖持久化失败零提交、重启后恢复声明字段；两个 sample 的双屏 `update.full-hot` 与 `update.compatibility` 读回跨 FULL/HOT 持久数据。 | PASS（owner 持久化与已运行续接范围） |
| `update.offline-assets` | Console `b85875a5-5c8c-4cb7-83ea-4f40253955ee`、Wallpaper `4ca28e1c-7b13-49b7-a378-277d3954aafe`，指定双屏设备，PASS/PASS。 | PASS |
| `update.interruption` | Console `90931f94-eaf9-4cbb-bcf9-cae810c7d2e5`、Wallpaper `acaa3d2e-1862-4891-ae37-4e53d6f4d3be`，指定双屏设备，PASS/PASS，均有本 run 断言标记。 | PASS |
| `update.boot-guard` | Console `d142d95b-bace-44ad-9b00-57a2948db316`、Wallpaper `7760adda-1766-499e-a337-e39127c1c915`，指定双屏设备，PASS/PASS。 | PASS |
| `update.rollback` | Wallpaper `a7a12427-8cd6-4abf-94f3-46427534c220`，指定双屏设备，PASS/PASS。 | Wallpaper 的真实 rollback 证据保留；Console 同类人工故障注入属于收敛范围外，保持 NOT_RUN，不阻断两 App 常见 FULL/HOT 主线交付。 |
| `update.recent` | base owner 26 项 focused 测试检查 recent status 成功/失败/unknown 及持久化读回；两个 sample 的双屏 full-hot、compatibility 与 install-result 运行检查真实 recent 状态。 | PASS（所列状态投影与读回范围） |
| `update.cleanup` | 上表各受管 Android run 均记录 `business=PASS`、`cleanup=PASS`；runner cleanup ownership、设备完成标记和未知资源 fail-closed 由当前 driver 测试覆盖。 | PASS（受管 run 清理）；故障注入清理失败分支另由 runner focused proof 覆盖，不声称独立业务场景。 |

2026-10-09 范围收敛后，删除了为归档恶意输入新增的 Commons Compress 依赖、可见性扩展、测试 seam 和专用测试文件，恢复生产 `extractHot` 的原有 JDK `ZipFile` 主路径；没有改写现有有效工件的清单、摘要与相对路径校验。此前针对专用测试 seam 的 4 项 Android focused 结果不再代表当前字节，当前不为已移出范围的极端归档反例重跑验证。有效 HOT 准备与安装继续由已有双屏 `update.full-hot`/`update.compatibility` 受管运行覆盖。

当前字节上的最新运行：`yarn workspace @catering-v2s/kernel-base-terminal-update test`，2 files/27 tests PASS；随后同 workspace `typecheck` PASS。此次本地 focused 命令没有受管 run id。最后一次通过：同一 owner test/typecheck，使用当前对应源码字节。最近的受管设备业务运行仍为 Console `update.interruption` run `90931f94-eaf9-4cbb-bcf9-cae810c7d2e5` 与 Wallpaper `update.interruption` run `acaa3d2e-1862-4891-ae37-4e53d6f4d3be`，均 PASS/PASS；仅覆盖各自原始判据。

以上证据映射关闭 §11a 的记录缺口，不将 `PARTIAL/OPEN` 改写为 PASS。全批 6b、13c 和 fresh 整批 IMPLEMENTATION review 仍须分别完成；`scripts/verify` 仍为 INTERRUPTED/NO_VERDICT，U04 以后未运行。

### 11.9 · 2026-10-09 D-S-1～D-S-4 修复差量

Claude 差量复评的四项均由主 agent 重开需求、详设和 owning source 后判为 `CONFIRMED`。仅修复当前四条，不重跑完整设备矩阵：

| Finding | 最小修正与可证伪判据 | 本轮局部结果 | 未覆盖 |
| --- | --- | --- | --- |
| D-S-1 FULL-only boot 占位 | owner 终态使用权威 `readFacts.actual.bootId`，不使用可能为空的 action.bootId；缺权威 boot 保持 UNKNOWN。测试让 action.bootId=null，成功 boot 保留占位、同 boot 不领取第二目标，下一 boot 释放并接受新目标。 | `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` PASS；同 workspace test，2 files/31 tests PASS。 | Android 原生 FULL-only 安装及真实重启 NOT_RUN。 |
| D-S-2 合法 APK 超 32 MiB | APK 摘要以 1 MiB 文件流计算；unzip 输出落入 run-owned 临时文件再流式摘要，不缓存整 APK。builder self-test 以 40 MiB 输出验证写文件与摘要。 | `node scripts/build/terminal-update-artifact.mjs --self-test` PASS；`node --test scripts/test/terminal-update-artifact.test.mjs` 2 tests PASS。 | 完整 Android APK 构建未重跑。 |
| D-S-3 FULL staging 遗留 | runner 清理集合加入两 App `update/<app>/full-staging` 与外部 FULL 解包 APK；既有清理测试检查文件删除、目录 readback 与清理字节数。 | `yarn workspace @catering-v2s/terminal-automation test runner.test.ts` 1 file/38 tests PASS；该 workspace typecheck PASS。 | 真实 runner 中断后恢复清理 NOT_RUN。 |
| D-S-4 external FULL3 输入 | compatibility Journey 对已登记 ZIP 和内层 APK 分别校验 SHA-256、检查唯一预期 entry，解出到独立 run-owned APK 路径后使用既有 `connection.install`。不覆盖 INSTALL APK。 | `yarn workspace @catering-v2s/terminal-automation typecheck` PASS；Prettier selected-file check 与 `git diff HEAD --check` PASS。 | Android 安装替换后的 FULL3 行为 NOT_RUN。 |

最近一轮局部链顺序执行，源码未在运行期间修改：terminal-update typecheck + 31 tests；artifact self-test + 2 Node tests；automation runner 38 tests + automation typecheck；定向 Prettier 与 `git diff HEAD --check` 均 PASS。此前 owner 测试夹具曾因把 `UpdateFacts.actual.bootId` 设为非法 null 而 typecheck 失败；这是新测试形状错误，未触发产品代码运行，已按真实类型改为非空权威 boot，随后同一 owner proof 通过。未运行完整 `scripts/verify`、Android/Kotlin、Expo Web、DEV 或完整设备验收；不能据这些局部结果宣称阶段 A 全量 PASS。fresh 独立静态差量 review 尚待完成，交付结论以其后的 disposition 为准。
