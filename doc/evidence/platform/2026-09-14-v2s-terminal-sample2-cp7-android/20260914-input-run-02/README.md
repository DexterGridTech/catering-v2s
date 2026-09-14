# sample2 mobile input-boundary run

- `RUN_ID`: `ter-sample2-cp7-input-boundary-20260914-02`
- `DEVICE`: `emulator-5556`, physical `720x1280`, logical `360x640 portrait`
- `PACKAGE`: `com.catering.v2s.terminal.samplewallpaper`
- `SOURCE`: current `VirtualKeyboard` stop-propagation patch

动作顺序：五击打开 admin 并保存键盘可见状态；点数字键 1 并保存键盘仍可见且首位已填写；点
admin 标题并保存键盘消失、login 与首位状态保留；关闭 admin 后真实 swipe 并保存前后 XML。

承重文件：`mobile-key-boundary-before-current.xml`、`mobile-key-boundary-after-key.xml`、
`mobile-key-boundary-after-surface-tap.xml`、`mobile-input-boundary-log-current.txt`、
`mobile-scroll-before-current.xml`、`mobile-scroll-after-current.xml`，以及对应 PNG。

日志脱敏且只保留事件名/几何/状态信号；未记录密码原文、token 或 raw payload。此目录只证明
输入事件边界与 ScrollView supporting behavior，不升级为完整 Android、Web、release 或 visual
acceptance。
