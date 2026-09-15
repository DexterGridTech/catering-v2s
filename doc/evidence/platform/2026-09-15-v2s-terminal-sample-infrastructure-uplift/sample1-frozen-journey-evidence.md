# sample1 冻结旅途动态证据

## 范围

这是当前 release APK 的 `U10` 记录式设备观察，不把它提升为整批
implementation acceptance、visual PASS、Web PASS 或 release PASS。sample1 的
`partKey`、`layerId`、`testID` 保持冻结；双屏的顾客确认页面由真实 Android
`Presentation` 挂在 display 2，因当前模拟器的 `uiautomator dump` 只返回最后触摸的
显示，主屏状态以 primary XML、secondary 状态以对应物理截图记录。

运行工具：

```text
tools/terminal-sample2/run-sample1-frozen-journey.mjs
```

它使用当前 release APK、真实 `adb` 输入和自定义虚拟键盘；每个 run 保存
`result.json`、run manifest、display/SF inventory、逐步 primary XML、两侧截图、
window/activity snapshot、logcat，并在结尾对确切 package 做 force-stop/PID absence
cleanup。旧的双屏失败尝试没有覆盖。

## 当前 PASS/PASS runs

| 形态/旅途 | 命令输出目录 | steps | 业务 | cleanup |
| --- | --- | --- | --- | --- |
| mobile normal | `sample1-frozen-mobile-normal-rerun-03/` | S1-01/02/03/04/05/06/12/11 | PASS | PASS |
| dual normal | `sample1-frozen-dual-normal-rerun-06/` | S1-01/02/03/04/05/06/12/11 | PASS | PASS |
| dual reject-retry | `sample1-frozen-dual-reject-retry-rerun-01/` | S1-01/02/03/04/05/07/08 | PASS | PASS |
| dual abandon | `sample1-frozen-dual-abandon-rerun-01/` | S1-01/02/03/04/05/09 | PASS | PASS |
| dual withdraw | `sample1-frozen-dual-withdraw-rerun-01/` | S1-01/02/03/04/05/10 | PASS | PASS |
| mobile reject-retry | `sample1-frozen-mobile-reject-retry-rerun-01/` | S1-01/02/03/04/05/07/08 | PASS | PASS |
| mobile abandon | `sample1-frozen-mobile-abandon-rerun-01/` | S1-01/02/03/04/05/09 | PASS | PASS |
| mobile hand-back | `sample1-frozen-mobile-hand-back-rerun-01/` | S1-01/02/03/04/05/10/09 | PASS | PASS |
| mobile normal, empty age | `sample1-frozen-mobile-empty-age-rerun-03/` | S1-01/02/03/04/05/06/12/11; age empty | PASS | PASS |
| dual normal, empty age | `sample1-frozen-dual-empty-age-rerun-03/` | S1-01/02/03/04/05/06/12/11; age empty | PASS | PASS |

双屏 run 的 display inventory 为 `[0, 2]`，SurfaceFlinger 为一条物理 primary
`4619827259835644672` 和一条 virtual secondary `11529215047789101945`；mobile
run 只枚举 display `0`，没有 virtual secondary。normal 双屏还保存了年龄 `37` 输入
后的 secondary 截图以及确认后 primary member-list/row readback；冷重启后登录页
与 cleanup 均通过。新增的 empty-age runs 在 mobile 与 dual 都保存了确认前的
secondary/primary 截图、确认后的 member-list/row readback、logout 与冷重启登录页；
`age` 在 run manifest 和 progress log 中明确为 empty。

## 首败与修复链

1. dual normal rerun-02 首败是主屏 XML 错误寻找 secondary 的
   `sample.desk.customer-member`；源码确认它来自 display 2 的 Presentation。随后
   增加 secondary screenshot readback，并用真实截图校准 display-scoped 操作。
2. dual normal rerun-05 首败是 secondary 输入后 `uiautomator` 焦点留在 display 2，
   主屏 member-list 查询读到 secondary 的 customer-welcome。随后在 secondary 操作
   后触摸 display 0 的非交互空白点恢复主屏 accessibility；rerun-06 PASS/PASS。
3. mobile abandon 与 hand-back 运行较慢，现场检查显示 PID、uiautomator 子进程、
   输出文件和字段值持续前进（operator、S1-02、S1-04、Alice、电话、S1-05），不是
   无界等待；两者最终均 PASS/PASS。

这些修复均是 record-only runner 的证据边界修复，没有修改 sample1 业务源码或冻结
标识。`retry form` 的值由当前源码真实读回为 `Alice` 与电话，而非把 runner 输入
意图当作结果。

## 尚未关闭的边界

S1-13/S1-14 当前已用 release APK 在 mobile 与 dual 分别记录非空年龄 `37` 和空年龄；
尚未覆盖其它具体年龄值的独立 device ledger，focused member-desk tests 继续覆盖空年龄
语义与边界。
U10 其余 sample2、Web、完整 Android/native、视觉和 sample2 A1-A9 仍按各自 evidence
分档，不能由本记录代替。
