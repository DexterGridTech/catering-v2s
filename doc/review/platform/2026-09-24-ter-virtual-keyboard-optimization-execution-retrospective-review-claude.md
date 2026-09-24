# TER 虚拟键盘优化执行复盘 · 独立评审（Claude）

```text
REVIEW_TARGET=EXPERIENCE_RETROSPECTIVE
ACTION_1_VARIANT=1-A 代码提取（对象是复盘所依据的 runner 源码、测试与运行记录；键盘 UI 本身无任何渲染观察）
VERDICT=NO-GO（针对复盘报告质量）
M/S/N=1/1/2
原实施目标状态：未完成、暂停（与报告第 6、11 行一致；本评审不改变、也不授权恢复）
```

```text
本 verdict 只针对下列当前字节，不沿用此前任何设计或实施 verdict。
reviewTargetSha256（前 16 位）:
  execution-retrospective-codex          98df298c9c97e3eb
  retrospective-claude-request-codex     47d59e17aacf24a1
  runner scripts/test/ter-virtual-keyboard-android.mjs        5e898913dca35232
  tests  scripts/test/ter-virtual-keyboard-android.test.mjs   9ae1f40ca498a930
EVIDENCE_TIER=静态：复盘报告、runner/测试源码、五个 run 的 manifest/events/commands（doc/evidence 与 .runtime 两处）、
  两份项目记忆，以及 AOSP adb 官方源码（外部事实）。未运行任何构建或测试，未访问、启动或清理任何设备，未截图。
SESSION=CONTINUED_SESSION（续接会话，从 v2s 仓根发起）
WRITES=仅本文件
AUTHORITY=只评审复盘；不授权改源码或测试、构建、测试、GUI、设备访问与清理、重试，也不代表实施验收通过
```

## 1. 结论

复盘在态度上是诚实的：它承认 0/19 帧、承认进度指标偏向工程活动、保留了 mobile 的 `cleanup=NOT_RUN`,
也没有宣称 app crash 或键盘缺陷。它对两个 runner 假失败(ADB 空格解析、APK mtime)的定性，我回源核对后成立。

但它对真正阻断的定性错了方向。报告把"进程读回为空"写成"进程消失、原因未知"，并把"进程为什么消失"
定为唯一的下一条诊断问题。已落盘的证据却指向第三个 runner 假失败：runner 所有经 `adb shell sh -c`
的进程读回，无论设备状态如何都必然返回空；而进程表在启动 60 秒和 10 分钟后都还列着被启动的应用。按报告的
建议走，下一步会用同一个失效的读回，去追查一次很可能没有发生的进程死亡(M-1)。同一个缺陷还让前几次
`cleanup=PASS` 对应用进程成了空证明(S-1)。

## 2. 核实成立的部分

- **两个已修的 runner 假失败定性正确。** 063057 的 `adb devices` 原始输出是空格分隔
  (`.runtime/ter-virtual-keyboard-android/tervk-20260924-063057/logs/commands.jsonl`,21:31:04),当前
  `parseAdbDeviceList` 按 `\s+` 切分(runner 第 1326-1333 行)。recovery01 的首败是
  `VK_ANDROID_BUILD_ARTIFACT_NOT_REFRESHED`,064800 的 Gradle 日志为 `BUILD SUCCESSFUL`。
- **19 帧与业务分母如实。** 五个 manifest 的 `frameMatrix` 都是 19 帧 `OPEN / NOT_OBSERVED`,
  `controlledHarnessEntries`、`controlledHarnessCaptures`、`businessChecks` 都为空。
- **CP-4 证据过期如实。** CP-4 证据 §18 记录 52/52,对应旧 hash `d32258f…`/`b74a51f…`(证据文件第 372、380 行);
  当前字节是 `5e89891…`/`9ae1f40…`;§19 是最后一节，没有覆盖 mobile run。
- **mobile `cleanup=NOT_RUN` 保持 OPEN,且没有拿 `ownedRemoteProcesses=[]` 充当通过。**(报告第 71 行)
- **`.runtime` 与 `doc/evidence` 的差异如实。** 063057 的 `commands.jsonl`、064800 的两份构建日志只在 `.runtime`。
- **方法偏差中的"指标偏向工程活动"、"同族失败冻结太晚"两条有证据，也没有过度归责。**

## 3. Findings

### M-1 · "进程消失"不成立的可能性更大：`adb shell sh -c` 读回必然为空，是第三个 runner 假失败 · CONFIRMED

**报告位置**:第 11 行"Android 真实应用……都未保持为可操作的前台进程";第 13 行"当前证据尚未解释进程为何消失";
第 68 行把"进程读回 absent"记为 CONFIRMED、把"为什么消失"记为未知；第 57 行把 PID 2239 解释为"约 0.3 秒后
`/proc/2239/stat` 为空，故没有宣称该 PID 身份有效";第 92 行称"真实阻断是应用进程稳定性/归属证据不足";
第 99 行建议把"进程为什么消失"作为唯一下一条诊断问题，并再做候选 PID 的 `/proc/stat` 回读。

**仓内事实(runner 当前字节)**:
- 查进程(第 1546 行):`['shell', 'sh', '-c', 'pidof <pkg> 2>/dev/null || true']`;
- 读 stat 和 cmdline(第 1563、1565 行，复查路径第 2192 行):`['shell', 'sh', '-c', 'cat /proc/<pid>/stat 2>/dev/null || true']`;
- 录屏启动(第 1806 行):`['shell', 'sh', '-c', 'screenrecord … & echo $!']`。

这 5 处都把 `sh -c` 的脚本作为独立参数交给 adb。runner 以 `stdio: ['ignore', …]` 启动 adb(第 1195 行)。

**外部事实(AOSP 官方源码)**:`packages/modules/adb/client/commandline.cpp` 的 `adb_shell` 写着
`// We don't escape here, just like ssh(1). http://b/20564385.`,随后 `command = android::base::Join(…, ' ')`。
也就是说，参数按空格直接拼接、不转义，再交给设备端 shell 重新解析。

**推论**:
- 设备端实际执行的是 `sh -c pidof <pkg> 2>/dev/null || true`。内层 `sh -c` 只执行字符串 `pidof`,包名被当成 `$0`,
  所以 `pidof` 没有收到任何参数；报错被 `2>/dev/null` 吞掉，`|| true` 再把退出码改成 0。
- `cat /proc/<pid>/stat` 同理：实际执行的是不带参数的 `cat`,它读 adb 的 stdin,拿到 EOF,输出为空。
- 录屏：实际执行的是不带参数的 `screenrecord`;`echo $!` 拿到的是外层后台 sh 的 PID。

**落盘观察完全吻合**:
- 三个 run 中 12 次 `*-remote-process` 全部是 exit 0、0 字节，包括 `am start -W` 已返回
  `Status: ok … LaunchState: COLD … Complete` 之后(例如 mobile 01:06:58.573);
- 2 次 `*-stat-<pid>` 同样是 exit 0、0 字节；
- 不经过 `sh -c` 的 `ps -A -o PID,NAME` 每次都返回数千字节，`cat /proc/sys/kernel/random/boot_id` 每次都正常。

**反证"进程消失"的落盘证据**:
- runner 只对进程表里 NAME 等于包名的行读取 stat(第 2222-2233 行，匹配规则见第 1335-1349 行)。
- mobile run 在 01:07:57.536 执行了 `mobile-com.anonymous.sampleterminal-stat-4500`,说明启动约 60 秒后，进程表里
  还有 `com.anonymous.sampleterminal`,PID 4500,正是启动标记里的 `startupPid`(manifest 的 `launchDiagnostics[0]`)。
- recovery02 在 23:07:03.503 执行了 `…samplewallpaper-stat-2239`,说明壁纸 app 在 22:57:05 启动约 10 分钟后仍在进程表里。
  报告第 57、70 行自己也写了这两个候选。
- 所有日志检查的 `processDied` 都是 false,而过滤条件包含 `ActivityManager:I`。
- 一个进程存活了 60 秒或 10 分钟，却恰好在 ps 之后 0.3 秒内死亡，而且两次都是这样，不合理；更合理的解释是
  stat 读回本身失效。

**测试把缺陷写成了期望值**:测试第 997 行 `assert.deepEqual(calls[4].args, ['shell', 'sh', '-c', 'cat /proc/321/stat 2>/dev/null || true'])`。
adb 调用是 mock 的，所以 52/54 全绿恰恰是在认证这个错误的参数形态。

**影响**:
1. 经这个 runner 的每次启动，无论应用实际状态如何，都必然得到 `OWNERSHIP_UNRESOLVED` 或 `PROCESS_ABSENT`。三次启动
   失败因此与解析、mtime 属于同一个失败族：runner 假失败。
2. 就算启动被确认，19 帧所需的录屏也会以同样方式失败，得到 `SCREENRECORD_OWNERSHIP_UNRESOLVED`;启动前"已有录屏
   进程"的安全检查则永远判定没有。
3. cleanup 的问题见 S-1。
4. 报告建议的第 2、4 条会用同一个失效的 stat 读回复现假阴性，把下一轮引向并不存在的进程死亡。
5. 报告第 11 行"未保持为可操作的前台进程"是一条未经观察的用户可见断言；实际情况是，应用有没有渲染出画面没有人
   观察过。

**报告应补的方法教训**:064800 首败的 last known good 恰好就是这条返回空的 `pidof` 命令；项目记忆
`READ_FIRST_FAILURE_LOG` 和"凡能静态确定的必须在第一次动态运行前确定"都能在第一次动态运行前、或首败当时抓住它。
叠加的诊断能力都建在一个从没对照已知存在的进程校验过的读回原语上，所以无论加多少都无法收敛。

**最小修订(报告层)**:
- 把三次启动失败重新定性为"runner 读回缺陷(CONFIRMED)+ 应用实际状态未观察(UNVERIFIED)",并写明 ps 在 60 秒和
  10 分钟时仍列出进程；
- 删去"进程消失、为何消失"作为前提的表述，用"进程是否仍在、界面是否出现"取代；
- 把第 99-101 行的下一步改为：
  - (a) 静态修复 5 处 `sh -c` 调用：要么整条脚本作为单个字符串传给 `adb shell`,要么去掉 `sh -c`,直接用
    `['shell', 'pidof', pkg]`,并把 exit 1 解释为"无进程";
  - (b) 把测试第 997 行的期望改成"按 adb 空格拼接后能被设备端 shell 正确还原的参数";
  - (c) 获授权后，只做一次只读校验，不启动应用：用修好的读回查一个必然存在的进程(如 `system_server`)和三个包名；
- 匹配包名的 ps 行(PID/NAME)不敏感，应保留为证据，不要 omit。

这比报告的方案更小：只修一个读回原语，不新增诊断能力，也不需要先查 exit-info。

**需 Dexter 裁决**:否(报告订正)。是否授权实施上述修复，由 Dexter 决定。

### S-1 · 前四个 run 的 `cleanup=PASS` 对应用进程是空证明，两台虚拟机上可能仍留有 runner 启动的应用 · CONFIRMED

**报告位置**:第 55、57 行"清理后的 manifest=… PASS";第 117 行"前四个 run 的 cleanup `PASS`"。

**事实**:
- cleanup 只对 `ownedRemoteProcesses` 执行 `am force-stop`(runner 第 2054 行)。
- 复查进程用的 `remoteProcessIdentity` 就是上面失效的 `pidof` 读回(第 1537-1539 行)。归属从没建立过，就算建立了，
  复查也看不到进程。
- recovery02 的 ps 在 23:07:03 仍列出壁纸 app(PID 2239),29 秒后的 23:07:32 记为 `cleanup=PASS`。
- mobile 在 +60 秒时仍列出 PID 4500,之后 cleanup 未运行。

**影响**:报告对 mobile 坚持"不得用空的已归属集合充当通过"(第 71 行),对前四个 run 却接受了建立在同一空集合上
的 PASS,两套口径不一致。两台虚拟机当前是否残留应用进程，是 UNVERIFIED。

**最小修订**:
- 把 064800、recovery02 的 cleanup 改写为"PASS(只覆盖本地进程、临时文件与已归属集合；应用进程因读回失效既未被
  检查也未被停止)";
- 在未闭合项中加入"两台虚拟机的遗留应用进程状态 UNVERIFIED";
- 恢复工作时的第一步，是用修好的读回做一次只读核查；是否执行 force-stop 由 Dexter 授权。

### N-1 · 时间线与首败字段的几处不准

1. 报告第 69 行说 recovery02 在启动后"约 38 分钟"重读日志。实际启动在 2026-09-23T22:47:13Z,重读在
   2026-09-24T01:01:09Z,相隔约 2 小时 14 分。
2. 报告第 54 行说 063057"LKG 未记录"。实际嵌套的 `firstFailure.lastKnownGood` 为 null,顶层 `lastKnownGood` 是
   `adb-device-list`。
3. 三次启动失败的嵌套与顶层 LKG 都不一致，报告只指出了 064800 这一处。例如 mobile 的
   `firstFailure.lastKnownGood=mobile-sample-terminal-launch-failure-logcat`,报告第 58 行只写了顶层值。
4. 三次启动失败的 `brokenBoundary` 都是 `INSTALL_<shape>_<app>`,但安装和 hash 校验都成功了，真正失败的是归属读回。
   报告原样照抄，没有说明这是阶段名，不是破损的步骤。
5. mobile 在 01:07:22、recovery02 在 22:47:46 读到的"0 个标记、0 字节",用的是 `logcat -d -t 500`(runner 第 2106-2110 行),
   只取最后 500 条再按标签过滤；60 秒后改用 `-t 2000`,就读到了全部 10 个标记。推断这些空读数很可能是窗口太小
   造成的(未逐字核对 logcat 实现，属推论),至少不能证明标记不存在；报告没有说明这一点。

### N-2 · "机器资源不是已证实阻断"的论据不相干

报告第 92 行用"两种授权 VM 在后续 run 中均可 inventory/build"来支撑这一判断。但构建在宿主机 Gradle 上完成，
inventory 只是几次 adb 读取，两者都与虚拟机运行时资源无关。结论"未证实"本身没错，论据应改为"现有证据不涉及
虚拟机运行时资源";有了 M-1,这个问题也不再是主线。

## 4. 按评审标准收口

```text
REVIEW_TARGET=EXPERIENCE_RETROSPECTIVE
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO（复盘报告质量）；原实施目标：未完成、暂停
M/S/N=1/1/2
L1_ENGINEERING=M-1（sh -c 读回缺陷使启动归属、录屏与 cleanup 必然失效，测试第 997 行认证了该缺陷）；S-1；N-1；N-2
L2_USER_VISIBLE=无任何用户可见事实被观察；报告第 11 行"未保持为可操作的前台进程"是未观察断言（M-1）
L3_UNVERIFIED=19 个 IA 帧全部；双屏 PRIMARY/SECONDARY 与 mobile 上两个应用是否渲染出任何画面；键盘外观与交互；
  两台虚拟机当前是否残留应用进程
SAME_ROOT_SCAN=runner 中 'sh','-c' 拆参 5/5 处同根（第 1546、1563、1565、1806、2192 行），测试 1/1 处（第 997 行）；
  仓内其它脚本 0 处；受影响路径：启动归属、录屏归属与"已有录屏"检查、cleanup 复查、复查 stat
DESIGN_GAPS=实施计划缺"观测原语对已知存在进程的正向自检"门：任何进程/文件读回原语进入动态运行前，
  须对必然存在的对象（如 system_server）得到非空结果
EVIDENCE_TIER=静态：PASS（源码、日志与官方 adb 源码回读）；focused：未运行（记录的 52/54 与本缺陷相关的 oracle 无效）；
  Android/native/device：未运行（仅读取已落盘命令记录）；visual：0/19；business：NOT_RUN；
  cleanup：mobile NOT_RUN，其余 PASS 对应用进程为空证明（S-1）
```

本结论只评审复盘，不授权任何修复、构建、测试、设备访问或清理，也不代表原实施目标验收通过；是否恢复原目标由
Dexter 决定。
