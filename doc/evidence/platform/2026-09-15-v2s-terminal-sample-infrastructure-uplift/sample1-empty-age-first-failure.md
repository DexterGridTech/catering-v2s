# sample1 空年龄 run 首次诊断记录

## 首败与受控停止

`sample1-frozen-mobile-empty-age-rerun-01/` 与
`sample1-frozen-dual-empty-age-rerun-01/` 曾并行运行当前 release APK。两条 run 在约
两分钟内没有返回终态，但现场并非无信息：输出目录已经落盘 `S1-01` 与 `S1-02` 的
primary/secondary、window/activity、logcat 和 display/SF 文件，目标 App 仍在登录页，
无应用崩溃。首个未闭合边界是完成错误登录后的下一次输入，不是空年龄业务断言。

现场诊断期间曾对同一设备上的 runner 临时 UI dump 路径
`/sdcard/ter-sample1-frozen-journey.xml` 发起人工 dump。该路径是 runner 的临时文件，
因此人工读回与 runner 的 dump 存在竞争，不能把这次运行当作干净业务证据。通过 PTY
发送 Ctrl-C 受控停止两条 runner，随后只对确切 package 执行 force-stop：

```text
adb -s emulator-5554 shell am force-stop com.anonymous.sampleterminal
adb -s emulator-5554 shell pidof com.anonymous.sampleterminal  # empty
adb -s emulator-5556 shell am force-stop com.anonymous.sampleterminal
adb -s emulator-5556 shell pidof com.anonymous.sampleterminal  # empty
```

这两条 run 不计入 U10 PASS/PASS；已有的 `sample1-frozen-mobile-normal-rerun-03/`、
`sample1-frozen-dual-normal-rerun-06/` 等干净 run 仍按各自 result.json 判定。

## 处置

本记录本身是 first failure/broken-boundary 证据，不是业务 PASS。后续若继续扩展空年龄
矩阵，必须避免外部复用 runner 临时 dump 路径，并在每个关键阶段写出可观察的进度或
使用已落盘 step 作为推进信号；超过预期时先读取现有产物、PID 和目标 UI，再决定继续
或受控停止，不能盲等。
