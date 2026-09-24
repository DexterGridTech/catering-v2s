SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# TER 虚拟键盘优化执行复盘

> REVIEW_TARGET=EXPERIENCE_RETROSPECTIVE；ACTION_1_VARIANT=1-A（从当前源码提取用户可见事实；此处仅静态提取，不代表实际渲染）；STATUS=CODEX_AUTHOR_REPORT，待 Dexter 与 Claude 独立复核。  
> 原实施目标状态：NO-GO / 未完成。此处 NO-GO 描述交付事实，不是 Claude 的独立评审结论。  
> 更新依据：Claude 复评见 `doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-execution-retrospective-review-claude.md`；Dexter 随后授权修复 runner、订正文档，并在限定双屏/mobile VM 上恢复 CP-4。本文以下区分历史事实与本次修复后的证据。

## 结论先行

这次目标尚未完成，不能验收，也未达到交付 Dexter/Claude 做实现复核的门槛。键盘相关静态实现和大部分 focused proof 已完成，CP-0 至 CP-3 的步骤记录为 `MATCHED`；CP-4 仍未闭合。历史三次应用启动的 `PROCESS_ABSENT` 结论由错误的 ADB 读回调用产生，必须撤销为有效运行事实：修复前的实际应用进程状态没有被该读回观察到。独立 `ps` 证据曾在 mobile 启动约 60 秒后列出 PID 4500，在双屏 wallpaper 启动约 10 分钟后列出 PID 2239；这些记录不能证明当前进程状态，也不能证明 UI 已渲染或可操作。19 个 IA 帧均没有实际画面捕获，键盘 UI、输入交互、动画、焦点避让和视觉符合性仍无动态结论。

直接证实的阻断是 runner 进程读回缺陷：多个 `adb shell sh -c` 命令被拆成参数传入，而 adb 不会转义这些参数；设备实际执行的 `pidof`/`cat` 未收到预期操作数，导致读回稳定地产生空输出。因此撤回“应用进程已消失”的结论，不再以进程退出为诊断前提；应用画面与当前进程状态都属 `UNVERIFIED`。历史 mobile run 的 `cleanup=NOT_RUN` 仍保持 OPEN；此前其他 run 的 cleanup PASS 只覆盖本地进程、临时文件及当时已归属集合，不覆盖未能归属的 app 进程。设备遗留状态须用修复后的读回先核验，再按本轮授权受管清理。

你感受到的“做了很久却看不到产品进展”是准确的：我把测试数、诊断代码和 reviewer 对账进度推进了，却没有把用户最关心的“键盘是否在真实页面按 IA 呈现”推进到一帧。这个衡量方向和失败处置节奏需要作为根因修复对象，而不能再用更多 runner 绿测或汇报次数解释。

## 目标与已裁定范围

原始目标和追加裁定落在以下正式工件中：

- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-analysis-codex.md`
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md`
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md`
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md`
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md`

范围是：全键盘横向填满并去掉外框圆角；四布局维持设计列轨；Shift 为一次性简单功能、取消 CAPS/长按；Shift 层只保留经 Dexter 裁定的十个 URL 常用符号；键盘以覆盖层出现，不挤压普通内容/弹窗；按焦点框、surface 和键盘可见遮挡计算有限上移及必要滚动；键盘进出、布局交接、内容移动和焦点/遮罩遵守详设的同一时序。最终 IA 分母是 19 帧，动态范围限定为单机双屏与 mobile，禁止以结构测试或 testID 代替真实视觉对账。

## 实际实施经过

| 阶段 | 实际完成内容 | 当前可证明状态与边界 |
| --- | --- | --- |
| 需求与设计 | 完成分析稿、正式需求、交互设计、IA、详设和实施计划；经历 Claude 设计复评后，收敛为四行 full、十个 URL 符号、无 CAPS，统一交接遮挡公式、测量坐标、呈现状态与 250ms `Easing.inOut(Easing.quad)`。视觉审阅标记一直是“随实施结果一并审阅（未批准）”。 | 有五份当前设计文档；视觉未获批准，也不应被写成已批准。 |
| CP-0 | 静态冻结 9 个生产 virtual 字段与 19 个 IA 帧；建立 field/part/layout/surface/scroll host 关系。之后 fresh reviewer 发现 6 个 feature 的 hook 虽在返回 JSX 中看似放进滚动区，实际仍在 provider 之外运行；CP-0/CP-2 重开，移动注册组件并加真实 scroll-content 测量断言。 | 修正后 fresh read-only 对账为 `MATCHED`；只证明静态关系，不证明运行中可达或可见。见 CP-0 evidence §1.4–1.5。 |
| CP-1 | 实现 full/alpha/numeric/financial 键位、Shift/十个 URL 符号真实 payload、零插入不清 Shift、外框全宽直角及容量计算；完成计划列出的 5 个红/恢复绿变异。 | 步骤记录 `MATCHED`。证据报告记录 10 个 test files/63 tests 的 focused 结果及五项真实变异；不等于 Android 画面。 |
| CP-2 | 改为固定尺寸 surface + 键盘覆盖；建立 root-local/scroll-content-local 测量规则、presentation offset context、PIN 实际可见 Pressable 锚点；移除旧 `field` placement；修正 scroll-hosted 字段的 hook/provider 祖先关系。 | 步骤记录 `MATCHED`。相关 focused、typecheck 与红变异见 CP-2 evidence；不等于运行中普通页面/弹窗未变形。 |
| CP-3 | `InputSurfaceFrame` 独立持有键盘呈现生命周期与单一动画进度；handoff/exit 快照不因 editable owner 暂时为 none 而卸载；同一个时基驱动键盘/内容，滚动在呈现开始仅发起一次并 readback。 | 步骤记录 `MATCHED`；input package 95 tests 与根 Yarn TypeScript 检查在 CP-3 evidence 中记录为 PASS。全是静态/focused，不是逐帧 Android 验证。 |
| CP-4 静态/测试 | 修复 primitives README 与实际测量/Shift 语义、实施计划状态等静态漂移；增加 primary-only controlled full-keyboard harness；全批审查先后发现并修复 runner parser/诊断边界；本轮修复 ADB 进程读回、screenrecord 参数形态及进程表输出省略，并加 known-present `system_server` 正向预检。 | 当前 runner 全套 58/58、两文件语法检查与 19 帧 `--self-test` 已通过；`pidof` 错误 `sh -c` 红变异实际失败，恢复后focused复绿。新增 CP-4 证据与本轮 fresh 步骤对账仍待完成，因此不把本步骤升级为最终 CP-4 closure。 |
| CP-4 动态/视觉 | 历史上只尝试单机双屏和 mobile；双屏两 app 有构建/安装尝试，mobile 做过 `sample-terminal` 探测；此前 reader 对 app 状态的结论无效。 | 19 帧均无产品画面/键盘截图，无 IA 帧 MATCHED，业务交互 NOT_RUN。当前两台 VM 的遗留 runner app 状态待修复读回核查；mobile 历史 run 的 cleanup 仍待闭合。 |

### 当前源码 1-A 静态提取（不是屏幕观察）

当前 `apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts` 静态定义 full 为四个视觉行、alpha 为三个、numeric/financial 各四个；full 数字位的 `shiftedText` 静态映射为 `1→:`、`2→/`、`3→.`、`4→?`、`5→&`、`6→=`、`7→-`、`8→_`、`9→%`、`0→+`，full 的 action 定义为 Shift、space、backspace、complete。`VirtualKeyboard.tsx` 静态将 Shift 状态用于标签与 selected 状态，字符键 payload 从对应 layout definition 派生。`InputSurfaceFrame.tsx` 静态使用 250ms quad 动画并保存 measure/enter/display/handoff/exit 呈现层。

这只是“代码现在写了什么”，不证明 native view 实际绘出什么。真实运行证据中的 5 个 manifest 都记录 `frameMatrix` 分母 19，但 `controlledHarnessEntries=0`、`controlledHarnessCaptures=0`；19 帧没有一帧完成视觉观察。

## 动态运行时间线与首败

时间以下均为 manifest 中的 UTC 时间。第一次到最后一次 Android 动态尝试跨越约 3 小时 36 分；goal tracker 在暂停时记录约 10 小时 20 分 elapsed，但这不是活跃编码时间，且不能据此分配各阶段耗时。本仓这些 Android manifests 不能单独还原其余时间花在哪里。

| Run | 观察到的过程 | first failure / last known good / broken boundary | business / visual / cleanup |
| --- | --- | --- | --- |
| `tervk-20260924-063057` | 2026-09-23 21:31Z；实际两个 emulator 都在线，但 runner 只识别 tab 分隔的 `adb devices` 行，把空格分隔的真实输出读成无设备。未查 display、未 build/install/launch。 | `VK_ANDROID_DEVICE_NOT_ONLINE`；嵌套 `firstFailure.brokenBoundary=device-shape-preflight`，嵌套 LKG 为 `null`；顶层 `brokenBoundary=null`、LKG=`adb-device-list`。根因是 runner parser，不是 VM 离线；已修 parser 并有 focused proof。 | `NOT_RUN / OPEN / PASS`；没有启动 app。 |
| `tervk-20260924-064800` | 21:47Z；双屏与 mobile inventory 通过；两个 release APK Gradle build 均 exit 0，样本包被安装且 hash 匹配。`am start -W` 对 sample-terminal 返回 `Status: ok`；随后 `pidof` 的 ADB 参数形态错误，空读数不能判定进程状态；没有产品 UI/截图。 | `VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED` (21:50:42Z)；嵌套 failure LKG=`dual-com.anonymous.sampleterminal-remote-process`，顶层 LKG=`dual-sample-terminal-startup-logcat-diagnostic`；两者不同。`INSTALL_dual_sample-terminal` 是安装/启动阶段标签，不是已证实破损步骤；实际未闭合边界为进程读回。原 `PROCESS_ABSENT` 与“无 fatal 信号”只代表失效/受限读回结果，不说明 app 状态。 | manifest `cleanup=PASS` 只覆盖本地进程、临时文件与已归属集合；本次启动的 app 未被正确检查或停止。 |
| `tervk-20260924-recovery01` | 22:39Z；prepare 通过；Gradle 对 sample-terminal 返回 BUILD SUCCESSFUL、目标 APK 存在，但 runner 因 mtime 未变化误报构建失败，未安装/启动。 | `VK_ANDROID_BUILD_ARTIFACT_NOT_REFRESHED`；LKG=`build-sample-terminal`；boundary=`BUILD_sample-terminal`。这是 runner 的 mtime freshness oracle 假失败，不是 Gradle/app build 失败；之后改为非空 APK 字节数与 SHA-256 binding。 | `NOT_RUN / OPEN / PASS`；没有启动 app。 |
| `tervk-20260924-recovery02` | 22:46Z；两 APK 构建/安装/hash 绑定通过。双屏 sample-terminal 和 sample-wallpaper-terminal 均有 `am start -W Status: ok` 及 Activity 启动标记；两次进程读回因 ADB 参数错误而无效，没有实际进程/UI结论。旧进程表证据在 wallpaper 启动约 10 分钟后仍列出 PID 2239；后续 `/proc/2239/stat` 调用本身错误，不能据其空输出判断 PID 不存在。 | 首败 `VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED` (22:47:14Z)；嵌套 failure LKG=`dual-sample-terminal-launch-failure-logcat`，顶层 LKG=`dual-sample-wallpaper-terminal-startup-logcat-diagnostic`，两者不同。`INSTALL_dual_sample-terminal` 是阶段标签，失败归属是 reader。旧 bounded logcat 回读为空不证明标记不存在。 | manifest `cleanup=PASS` 只覆盖本地进程、临时文件与已归属集合；两 app 的进程没有成功建立/复核 ownership，故未被证明已检查或停止。 |
| `tervk-20260924-mobile-diagnostic01` | 2026-09-24 01:05Z；mobile inventory 通过；sample-terminal build/安装/hash 校验通过。`am start -W` 返回 `Status: ok`；采到 10 条同 intent Activity 标记，末尾为 `native.loading-overlay-attached`。错误 `pidof` 回读结果不能判断进程存活；独立 `ps` 在启动约 60 秒后仍列出 PID 4500（与启动标记 PID 一致），但没有画面观察。 | `VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED` (01:06:58Z)；嵌套 failure LKG=`mobile-sample-terminal-launch-failure-logcat`，顶层 LKG=`mobile-sample-terminal-startup-logcat-diagnostic`，两者不同。`INSTALL_mobile_sample-terminal` 是阶段标签，读回边界未闭合。 | `NOT_RUN / OPEN / NOT_RUN`；现有记录不能确认 app 是否仍在，需修复后的只读核查后清理。 |

manifest/event 的交付副本均在 `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/<run-id>/`，但日志副本并不完整：`063057/logs/commands.jsonl` 只在 `.runtime`；`064800` 的两个 Gradle build log 也只在 `.runtime`。因此审阅者要复核这些命令原文必须读运行副本，不能把 doc/evidence 说成每个 run 的完整镜像。旧 manifests 的 `PROCESS_ABSENT` 读回由同一 reader 缺陷污染；cleanup PASS 只代表其实际管辖的本地进程、临时文件及已归属集合，并非对未归属 app 进程的清理证明。CP-4 汇总报告为 `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-cp4-reconciliation-codex.md`。

## 问题分层：哪些已知，哪些仍未知

| 问题族 | 状态 | 事实与边界 |
| --- | --- | --- |
| ADB 空格/tab 输出兼容 | `CONFIRMED，已修复` | 首个 dynamic gate 假红，设备实际在线；用实际输出形态建立 parser 与 red/green 测试。 |
| APK mtime freshness 判据 | `CONFIRMED，已修复` | Gradle 成功且 APK 存在，却被 mtime 不变挡下；改为以 build 成功 + APK 非空字节/hash 绑定。 |
| Android app 进程状态与画面 | 错误 reader `CONFIRMED`；实际状态与 UI `UNVERIFIED` | 三次启动后的 `PROCESS_ABSENT` 都来自错误 `adb shell sh -c` 拆参，不能作为进程退出证据。独立 `ps` 曾在 mobile 启动约 60 秒后列出 sample-terminal PID 4500、在双屏 wallpaper 启动约 10 分钟后列出 PID 2239；配套 `/proc` 读回调用错误，故 PID 详细身份/当前状态未证明。任何 UI 是否渲染均未观察。 |
| 迟到/受限日志读回 | 结果为 `INSUFFICIENT_EVIDENCE` | recovery02 启动于 2026-09-23T22:47:13Z，其 reinspection 在 2026-09-24T01:01:09Z，间隔约 2 小时 14 分。reviewer 核到 mobile 01:07:22 与 recovery02 22:47:46 的 `-t 500` 过滤读数为空；mobile 后续 `-t 2000` 读到 10 条同 intent 标记。recovery02 两小时后的 `-t 2000` reinspection 仍为空。任一空读都不能证明标记从未存在，更不能证明进程退出。 |
| runner 丢失进程候选信息 | `CONFIRMED`（原因已定位并修复） | `ps` 表中确有目标包候选；对应 `/proc/<pid>/stat` 的命令因错误 ADB 参数执行成无操作数 `cat`，空输出导致有效候选被压成 0。现在读回使用直接 argv，保留 stderr/exit code，进程表命令以 sanitized 方式保留匹配行。 |
| 当前 mobile run cleanup | `OPEN` | manifest 为 `cleanup=NOT_RUN`。本轮按用户要求停止后没有调用 cleanup；不得用 `ownedRemoteProcesses=[]` 替代 cleanup 通过，也不从已有片段推断 runner 仍在/已完全关闭。 |
| 键盘用户体验与 19 帧视觉 | `NOT_RUN / OPEN` | 所有 run 均无 controlled harness capture、无 business check。无论 focused 或 typecheck 多绿，都不能证明屏幕上键宽、边距、形状、遮挡、动画或功能与 IA 相符。 |

## 执行方法有无走偏

### 没有发生的范围漂移

- 生产改动按键盘需求与 CP-0 至 CP-3 的所有权/交互边界推进；CP 证据记录了 feature 字段 owner、command/snapshot ownership 与业务 payload 不变。
- 动态范围没有扩大到 Web L2、Metro、真机、其他 VM 或双机拓扑；没有使用 computer use。自动化审查和主 agent 均被明确要求只用 shell 命令/脚本。
- 部分诊断改动只在受管 runner 与测试中，没有据此宣称 UI 通过。

### 确认存在的执行偏差与低效处

1. **进度指标偏向工程活动而非用户结果。** runner test 从 27 到 52（之后本会话报告 54）的通过数、诊断字段与多轮步骤审查不断增加，但用户可见结果始终是 0/19 帧。这是最主要的方法偏差：把“诊断能力更完善”误当成“目标更接近交付”。
2. **首败闭环没能一次收足有用证据。** 首次 dual launch 的即时日志与进程 readback不足；之后的详细 reinspection 延迟，日志已空。后来一轮轮补 marker 关联、PID 关联、native signal allowlist、manifest 约束、输出 sink、process-table 与 exit-info 能力。每一轮本身都有 TDD/独立复核，但把本该一次设计好的“启动失败证据包”拆成多次 runner 扩展。
3. **对同一 runner 读回 failure family 的业务推进冻结得太晚。** recovery02 在 sample-terminal 的进程读回首次失败后，仍继续到 wallpaper 同类启动组合；随后又做 mobile 区分性 probe。该 probe 可区分 VM 形态，但开始前没有发现共同的读回参数缺陷。下一次遇到同族失败，应先校验读回原语本身，再决定是否需要单次区分性 probe；不能把失效测量结果当成 app-exit。
4. **静态 JSX 归属被过度推断为 hook/provider 归属。** CP-0 初始盘点说 hook-bearing field 在 `InputScrollArea` 内；fresh reviewer 证伪后发现六个注册 hook 实际运行在 provider 外，故重开 CP-0/CP-2。此问题最终已修复，但它说明应在最初冻结分母时以实际 React hook ancestry 为 oracle，而不是只看最终 JSX 树的视觉嵌套。
5. **单元/集成测试 fixture 对真实呈现生命周期建模不足。** 多个现存 node-only renderer fixture 停在隐藏 `measure` 阶段，缺少 keyboard `onLayout`、PIN/input 实际节点和 scroll/content readback。它们在变更后连续失败，再逐个补齐测试 harness。主证据称未为迁就 fixture 改生产行为，这是好的；但应把“驱动 measure→enter/display→owner none/exit”的共享 fixture 能力作为 CP-0/CP-1 前置验证，而不是跨多个 package 才发现。
6. **当前实施证据文档没有随最新事实同步。** CP-4 §19 仍把 mobile differential run 写为下一步；现状已有 `mobile-diagnostic01`。Claude 复评确认报告据以推断的旧 `pidof`/`stat` 读回是错误调用，因此历史 `PROCESS_ABSENT`、候选归零和部分 cleanup 结论需要重释。CP-4 文档须明确 supersede 旧解释，并加入本次 58/58、正确参数、正向预检门、新 hash 与 fresh 步骤对账；否则读者会把运行记录误作 app 已退出的证据。
7. **同一 manifest 的证据字段与证据副本没有形成单一可复核视图。** 首个 run 的嵌套 `firstFailure.brokenBoundary` 是 `device-shape-preflight`，但顶层 `brokenBoundary` 为 `null`；另有部分 commands/build logs 只在 `.runtime`。这没有改变首败归因，却提高复核成本，也容易让只读 `doc/evidence` 的人漏掉命令级证据。

所以，结论是“没有改产品目标，但执行路径偏向 runner 诊断工程；更关键的是，基础读回原语未先用必然存在对象做正向校验，就被当成业务失败 oracle”。这是已由源码、ADB 行为与落盘命令共同确认的根因。虚拟机资源是否构成阻断，现有证据没有回答：宿主机 Gradle 构建与少量 inventory 读取并非运行时资源测量，不能用来支持肯定或否定结论。

## 根因修复与恢复执行

Dexter 已授权先修读回、再核查/清理遗留 app 状态，并恢复 CP-4；以下是恢复后的执行顺序和当前进展，不代表设备工作已完成：

1. **修复并证明读回原语。** `pidof`、`/proc/<pid>/stat`、`cmdline` 直接作为 `adb shell` argv；预期 exit 1/文件缺失保留 stderr 和退出码并解释为 absent；screenrecord 后台脚本作为单一 shell 字符串传入。匹配目标包的 `ps` 输出须 sanitized 保留。Focused 58/58、语法和 self-test 已通过，错误 `pidof` 参数红变异已真实触发；恢复后同门复绿与 fresh 步骤对账须另记入 CP-4 evidence。
2. **任何动态操作前先正向自检。** 受管 `prepare` 先在每台获准 VM 读取非空 `system_server`，然后查询本仓 runner 的固定 app 清单。源码中只有两个唯一 app 包名（`com.anonymous.sampleterminal` 与 `com.catering.v2s.terminal.samplewallpaper`）；历史是三个启动组合，不是三个不同包。正向自检和只读基线未完成前不得启动 app。
3. **先读回遗留状态，再限域 cleanup。** 仅处理历史 runner 实际启动过的包/设备组合。若读回不能将当前身份与授权目标可靠绑定，不得停止任意 PID/包；保留 OPEN 并写清证据缺口。mobile `cleanup=NOT_RUN` 只有在只读核查、受管清理和清后读回证据闭合后才能更新。
4. **恢复 CP-4 用户目标。** 仅用单机双屏和 mobile 两类 VM，按固定 IA 19 帧分母逐帧、逐控件完成业务和视觉核对；双屏 PRIMARY/SECONDARY 分开。真实页面未观察前，不把 harness、testID、结构测试或 runner PASS 当视觉结论。
5. **关最终交付门。** 更新 CP-0..CP-4 状态、runner 修复的 fresh 步骤对账、逐代码—详设对账和 OPEN 的 first failure/LKG/broken boundary；整体三维对账与 fresh `REVIEW_TARGET=IMPLEMENTATION` 审查完成后，分列 static、focused、Android/native/device、visual、business、cleanup。当前目标仍未验收。

通用防再犯应落在现有 runner tests/review checklist：受管启动器首次要覆盖真实 ADB 输出格式、Gradle `UP-TO-DATE` 下仍有 APK 的场景、Activity 报 `Status: ok` 但进程快速消失的完整可关联诊断、可读/不可读 `/proc` 候选、退出原因回读、两种输出 sinks 遵从 `omit`；静态测试检查这些证据边界，不能把这组测试的 PASS 升格为真实 UI PASS。所有临时诊断代码合并与否需基于复盘结论，不应在根因不明时继续堆叠。

## 证据分档与 review 状态

| 类别 | 当前报告状态 |
| --- | --- |
| 静态源代码 / 设计对账 | CP-0..CP-3 `MATCHED`；CP-4 有早期 `MATCHED`，但最新增量未完成 fresh 全批对账，整体 `OPEN`。 |
| Focused / typecheck | 既有 package/typecheck 结果见各 CP 证据；当前字节 runner suite 60/60，legacy exact-shape focused 1/1，`node --check` 两文件及 runner `--self-test` PASS。fresh 步骤对账及全批整体门仍未关闭。 |
| Android build/install | 双屏 run 的两个 release build 与 install/hash 成功；mobile run 的 sample-terminal build/install/hash 成功。这只证明 APK 构建/安装路径，不证明应用持续运行或画面。 |
| Android/native/device 启动 | 历史 `am start` 返回 `Status: ok`；错误 reader 产生的 `PROCESS_ABSENT` 无效。正确读回后的双 VM 基线与遗留状态核查待执行；当前 app/画面状态 `UNVERIFIED`。 |
| 业务交互 | `NOT_RUN`。 |
| 逐控件视觉 | `OPEN`；19/19 frame 尚无 captured frame，0 个 visual verdict。 |
| Cleanup | 历史 manifest 的 cleanup PASS 只覆盖本地进程、临时文件与已归属集合；`064800`/`recovery02` 未证明 runner 启动的 app 进程已检查或停止。mobile diagnostic run 为 `NOT_RUN`；遗留状态核查及受管 cleanup/readback 待执行。 |
| Web / Metro / Web L2 / 真机 / 其他 VM | `NOT_RUN`，且不属于本次授权动态范围。 |
| 最终 implementation adversarial review / Dexter 与 Claude review | `NOT_RUN / 待执行`；本报告只请求对复盘诊断本身 review。 |

## 复盘报告自我核验项（供 Dexter/Claude 证伪）

### 最新订正：当前字节 Web 前置门已重新通过

在恢复 Android CP-4 之前，按 `TR-16` 对两个 integration 的 Expo Web 入口做了当前字节重跑。
`sample-console` 真实完成登录、新增会员、alpha probe，并通过虚拟键盘输入 `A z`；
`sample-wallpaper-console` 真实完成登录并进入 wallpaper picker。两次运行无 pageerror 或
console error，仅有预期的 `ADAPTER_NOT_INJECTED` power bridge 警告。Web 不能替代 Android
native/device、逐控件视觉或 19 帧业务验收，但当前 Web prerequisite 已从历史记录重新绑定到
当前源码字节，详见 CP-4 evidence §24。

- `SOURCE_EXTRACTION_1A` 非空，但只是源码事实，不是屏幕观察；请检验是否把静态形态写成了已渲染结论。
- 同根范围包含：两个 dual app launch、mobile sample-terminal launch、五个受管 run、19 个 IA frame、runner 的 parser/build/process/log/cleanup 证据边界。
- 未验证事实已单列：修复后两台 VM 的 app 包状态、完整 19 帧及真实控件形态、mobile diagnostic run 的 cleanup。
- 对键盘全范围可达性、虚拟机 runtime 资源和全部 19 帧是否可达保持未验证；宿主 Gradle 成功与设备 inventory 不构成 runtime 资源证据。

## Fresh 只读复核结果（不是独立 verdict）

两名 fresh 子 agent 分工只读核对 CP/实现方法和 Android run/manifest；均未使用 GUI、CUA、browser、ADB、VM、设备，也未写文件或运行测试/构建，没有代替 Dexter/Claude 给本复盘 GO/NO-GO。复核确认 CP-0..CP-3 的步骤记录与边界描述基本相符，CP-4 仍 OPEN；并要求保留两个报告缺口：首个 manifest 的嵌套/顶层 `brokenBoundary` 不一致，以及 `.runtime` 有未复制到 `doc/evidence` 的命令/build 日志。以上已在本版补明。

复核确认 CP-4 §18 的历史 runner/test hash 只对应当时 52/52；当时另一会话报告的 54/54 未落盘。Claude 随后证明历史 `pidof`/`stat` 参数形态使相关读回结果无效；本次修复后又发现 CP-4 evidence 中记录的 59/59 与 source hash 仍不是当前字节。主 agent 已在当前字节真实完成 legacy exact-shape focused 1/1、runner suite 60/60、两份 syntax 与 self-test；把 legacy key 过滤临时改为完整当前 key 集时，focused 在 validator 行 738 首次变红，恢复后再次变绿。旧进程候选与 `exit-info` 仍不能替代当前设备 readback，也不构成画面观察；当前 hash、红绿记录和新的 fresh 步骤复核将在 CP-4 evidence 记录。

```text
REVIEW_TARGET=EXPERIENCE_RETROSPECTIVE
ACTION_1_VARIANT=1-A 代码提取
VERDICT=<GO | GO_WITH_UNVERIFIED_UI | NO-GO；请区分复盘报告质量与原实施交付状态>
M/S/N=<由独立评审者按正本评定>
L1_ENGINEERING=<PASS / findings>
L2_USER_VISIBLE=<PASS / findings>
L3_UNVERIFIED=<列出所有尚无人真实观察的用户可见事实；非空时不得裸写 GO>
SAME_ROOT_SCAN=<分母与逐项结果>
DESIGN_GAPS=<详设判据缺失项；没有则写 none>
EVIDENCE_TIER=<按静态、focused、Android/native/device、visual、business、cleanup 分档>
```

## 最新订正附录：alpha 布局与当前 CP-4 证据

本附录以当前源码、当前 runner/test 字节和 dynamic05/dynamic06 manifest 为准，订正前文中
“0/19 无 captured frame”、runner `60/60`、alpha 尚未有空格等已经被后续执行 supersede 的
描述；前文的首败、读回缺陷和未验证边界仍保留为历史记录。

- `keyboardLayout.ts` 当前 `alpha` 为三行：`qwertyuiop`、`Shift a…l`、`Space z…m ⌫ 完成`；`full` 采用相同的两个动作位置。
- `keyboardLayout.test.ts`、`virtualKeyboard.test.tsx` 当前 focused `16/16 PASS`；删除 runner alpha roster 的 `space` 后，19-frame roster focused 首次以 `30 !== 31` 变红，恢复后 `1/1 PASS`。
- runner 当前完整 suite `61/61 PASS`，self-test `PASS`，IA 分母仍为 19；当前 runner 与 test SHA-256 分别为 `bd640e679f1134831ffdd1c832d6a4bb9f31c4a16ddd8a12c3f3e77b58988527`、`2db1e530957e61c955516fa6d7266d310b78ed72dc4fdc3006ea0bad6d1400b1`。
- dynamic05 的真实 `sample-terminal` 产品画面已经观察到 `VK-IA-03`（dual alpha）和 `VK-IA-04`（mobile alpha）。mobile 的 `Shift` 位于 `a` 左侧、`Space` 位于 `z` 左侧；双屏同样成立。Shift→`a`→Space→`z` 的实际输入读回为 `A z` 的 digest。
- dynamic05 `cleanup=PASS` 但 `business=NOT_RUN`、`visual=OPEN`，并保留 transition 处的首败 `VK_ANDROID_RESOURCE_NODE_NOT_ACTIONABLE`；dynamic06 到达的是 wallpaper picker，不是 login keyboard，因此不作为键盘帧通过。
- 这次布局修复和 runner roster 修复不改变 19 帧分母；未观察帧、逐控件视觉判定、转场逐帧动画、URL 十符号业务路径及最终 implementation review 仍不能宣称通过。Web、Android/native/device、visual、business、cleanup 分档须以各自证据为准，不能用 focused 或 runner PASS 代替。
