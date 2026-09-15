# sample2 双屏冻结旅途证据

## 范围

这是当前 sample2 wallpaper release APK 的双屏记录式运行证据，覆盖登录、三张壁纸的 pending/confirmed、pending 冷重启恢复、确认后冷重启恢复。它支持 U10 的 sample2 冻结旅途，不单独宣称 sample2 全量验收或完整 A1–A9 关闭。

## 当前成功运行

命令（仓库根）：

```text
node tools/terminal-sample2/run-sample2-frozen-journey.mjs --serial emulator-5554 --shape dual --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample2-frozen-journey-dual-rerun-07
```

结果文件：

```text
sample2-frozen-journey-dual-rerun-07/result.json
```

结果：`business=PASS`、`cleanup=PASS`、`firstFailure=null`。设备显示枚举为 `[0, 2]`；SurfaceFlinger 读回一条 physical primary 和一条 virtual secondary。十个步骤全部落盘：

```text
anonymous
picker-after-login
w1-pending
w1-confirmed
w2-pending
w2-confirmed
w3-pending-before-restart
w3-pending-after-restart
w3-confirmed
w3-confirmed-after-restart
```

关键读回：登录后默认 `none` 选中；w1、w2、w3 的 pending 与 confirmed 选中状态分别读回；pending w3 冷重启后仍选中且已有 confirmed background；confirmed w3 冷重启后 pending confirm 已清除。每个步骤均包含 primary/secondary 截图、UI XML、window/activity snapshot 与 logcat。

## 首败与边界诊断

此前双屏尝试未被改写：

- `dual-01`：系统 `Select input method` overlay 抢焦点，`sample.auth.login:submit` 不可见，`CLEANUP=PASS`。
- `dual-rerun-01` 至 `dual-rerun-03`：同一系统输入法选择器/系统 ANR 残留，应用自身已记录启动完成或冷启动日志，`CLEANUP=PASS`。
- `dual-rerun-04`：关闭 overlay 后，runner 的虚拟键盘路径误把第一字段 `complete` 当作自动聚焦第二字段；首败为找不到第二阶段虚拟键盘按键，`CLEANUP=PASS`。
- `dual-rerun-05`：物理 `adb input text` 再次触发输入法选择器，提交按钮不可见，`CLEANUP=PASS`。

根因修复在 record-only runner：使用应用已有 `VirtualKeyboard` 按键输入，完成第一字段后显式点击密码框；未修改业务源码。`dual-rerun-06` 在临时关闭硬键盘软输入设置后通过；为排除设置依赖，`dual-rerun-07` 在恢复 `show_ime_with_hard_keyboard=1` 后再次 `PASS/PASS`。当前 dual 设备的设置读回、目标包 PID absence 和未归属 reverse 现状记录在 `device-settings-and-cleanup.md`；该记录只证明当前值，不把 mobile 的未知历史值写成已恢复。

## 证据边界

本记录不替代 release 冷启动 U8、sample1 U10、U13 系统失败注入、Web、完整 Android/native、视觉或 sample2 全量 acceptance；这些仍按各自 evidence 记录单独收口。
