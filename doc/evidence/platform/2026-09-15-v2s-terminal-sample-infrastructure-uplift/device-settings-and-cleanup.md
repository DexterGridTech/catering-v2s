# 当前设备设置与运行后清理读回

本记录只保存当前两台受管 emulator 的只读读回，不把设备现状反推成“恢复了历史基线”。

## 运行后读回

命令：

```text
adb -s emulator-5554 shell pidof com.anonymous.sampleterminal
adb -s emulator-5554 shell pidof com.catering.v2s.terminal.samplewallpaper
adb -s emulator-5554 shell settings get secure show_ime_with_hard_keyboard
adb -s emulator-5554 reverse --list

adb -s emulator-5556 shell pidof com.anonymous.sampleterminal
adb -s emulator-5556 shell pidof com.catering.v2s.terminal.samplewallpaper
adb -s emulator-5556 shell settings get secure show_ime_with_hard_keyboard
adb -s emulator-5556 reverse --list
```

截至本记录生成时的 stdout：

```text
emulator-5554
  com.anonymous.sampleterminal PID: <empty>
  com.catering.v2s.terminal.samplewallpaper PID: <empty>
  show_ime_with_hard_keyboard: 1
  reverse: host-8 tcp:8081 tcp:8081

emulator-5556
  com.anonymous.sampleterminal PID: <empty>
  com.catering.v2s.terminal.samplewallpaper PID: <empty>
  show_ime_with_hard_keyboard: 0
  reverse: host-16 tcp:8091 tcp:8091
```

## 解释边界

sample2 双屏冻结旅途曾临时把 dual emulator 的 `show_ime_with_hard_keyboard` 设为
`0`，随后读回并恢复为 `1`；sample1 当前 runner 不写这个设置。mobile emulator
当前读回为 `0`，但本轮没有保存它在 sample1 运行前的历史值，因此这里只报告观测值，
不声称 mobile 设置已恢复或由本任务改变。

目标 App 的 PID 均为空，说明当前 sample1/U8 目标包没有残留运行进程。`8081` 与
`8091` reverse 没有被本轮 sample1 runner 创建或在缺乏 manifest ownership 的情况下
删除；它们保留为非本 runner 所有的外部现状，不能被写成 cleanup PASS 的对象。

本记录不宣称 Web、Metro、完整 Android/native、视觉或整批 implementation acceptance
已通过。
