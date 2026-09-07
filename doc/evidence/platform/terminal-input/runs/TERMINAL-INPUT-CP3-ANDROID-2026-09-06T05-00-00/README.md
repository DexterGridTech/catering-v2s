# CP-3 Android 双屏运行证据

`RUN_ID=TERMINAL-INPUT-CP3-ANDROID-2026-09-06T05-00-00`

环境：`emulator-5554`，应用 `com.anonymous.sampleterminal`，主屏 `2560×1600`，副屏 `1280×720`。
本证据只保留脱敏后的结构化结果；原始 UI dump 与主屏截图曾用于现场核验，已移出仓库到
`/tmp/TERMINAL-INPUT-CP3-ANDROID-2026-09-06T05-00-00-raw`，不作为交付日志，避免记录姓名、电话等原始输入值。

## 主屏输入与提交

- 主屏姓名字段可编辑，录入长度 `5`；电话字段走虚拟纯数字键盘，录入长度 `11`。
- `ui.base.input:virtual-keyboard` bounds=`[0,892][2560,1600]`；输入字段与提交动作均在键盘出现时可达。
- 显式点击“完成”后键盘关闭，点击提交后主屏进入 `sample.desk.waiting-confirm`。
- 等待态显示姓名/电话字段与 `sample.desk.waiting-confirm:withdraw`；本记录只保留字段存在及长度，不保留原始值。

## 副屏年龄输入

副屏通过 `adb shell input -d 2 motionevent` 聚焦年龄字段，再用副屏虚拟按键输入四次；脱敏 UI dump 的关键结果如下：

```text
surface-content bounds=[0,0][1280,361]
customer-member:age bounds=[42,119][1238,207] focused=true
customer-member:actions bounds=[518,235][763,319]
customer-member:confirm bounds=[518,235][630,319]
customer-member:reject bounds=[651,235][763,319]
virtual-keyboard bounds=[0,361][1280,720]
virtual-keyboard:text-1 present
virtual-keyboard:complete present
age text length=3 after four key presses (maxLength=3)
```

这证明比例换算后的 dock 没有遮住年龄字段或确认/拒绝动作；副屏系统 IME 不作为输入路径。

## 确认结果

- 副屏点击确认后，副屏切换到 `sample.desk.customer-welcome`，消息节点存在，虚拟键盘消失。
- 将焦点切回主屏后，主屏 `sample.desk.member-list` 出现一条 member row；不在此文件记录姓名/电话原始值。

## 系统 IME 边界

焦点在副屏年龄字段时，`dumpsys input_method` 记录：

```text
mSelfReportedDisplayId=2
mFocusedWindowClient display=2
mInputShown=false
```

`dumpsys window windows` 只找到 `InputMethod` window 的 `mDisplayId=0`，没有副屏 `InputMethod`
window。结论是：副屏可以获得业务字段焦点，但不依赖系统 IME；虚拟键盘可用。

## 副屏截图边界

已尝试 `adb exec-out screencap -p -d 2`。该模拟器的 SurfaceFlinger 只暴露物理 display 0，命令返回
status `-2`；因此本轮不伪造副屏像素截图。副屏实际树由切换 display 2 后的 `uiautomator dump`
捕获，窗口/节点 bounds 是本证据的布局依据。

## 失败与修复边界

1. 首次比例复验发现直接把声明高度当 RN 数值高度时，副屏虚拟键盘占用 `540` 个物理像素，年龄字段被推出可见区；这是 Android density-normalization 接缝失败。
2. 另一次探路发现 Android `TextInput` 在 `showSoftInputOnFocus=false` 时会发出 native blur，导致虚拟键盘被立即清理；这是 native blur 与键盘 owner 混淆。
3. 修复后 last-known-good 为本文件中的 `361/359` 内容/键盘分区、年龄框可见、动作可点、输入四次仍限长三位、确认后双屏回 welcome。

临时探路组件、临时 production diagnostic log 与 probe assembly 均已清理；仓内 `rg` 不再命中
`TEMP_INPUT_DIAGNOSTIC` 或 CP-0 probe 生产代码。
