# sample1 U10 record-only runner 首败与修复

## 范围

这是 U10 sample1 冻结旅途执行器自身的首败记录，不把 runner 失败改写为业务 PASS，也不改变生产源码。

## 首败

首次 mobile normal 命令：

```text
node tools/terminal-sample2/run-sample1-frozen-journey.mjs --serial emulator-5556 --shape mobile --case normal --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample1-frozen-mobile-normal-final
```

首个业务已知良好点为 `S1-01` anonymous login；随后填充错误登录凭据时，输入值包含 `-`，runner 将其当作虚拟键盘资源 `ui.base.input:virtual-keyboard:text--`。sample1 的生产虚拟键盘没有该键，因此结果为 `business=NOT_RUN`、`cleanup=PASS`。原始 `result.json`、`first-failure-logcat.txt`、window/activity 快照和 `S1-01` 证据均保留在该目录。

## 根因与最小修复

这是 runner fixture 输入不在当前虚拟键盘字母/数字闭集内，不是 sample1 生产路径失败。修复为使用无连字符的非法凭据 `invalidoperator` / `invalidpasscode`；同时在关闭 auth notice 后增加“notice 必须消失”的断言，避免 notice 仍在树上时向被遮挡的登录表单继续输入。

另给 `uiautomator dump` 受管调用增加有限超时。一次重验曾在 notice 关闭后的 Android accessibility dump 调用上无 stdout 地挂住；该进程已受控终止，runner `finally` 保持 package `force-stop` 后 PID 缺失，cleanup 为 PASS。后续结果必须以新 output 目录保存。

## 重验边界

```text
node --check tools/terminal-sample2/run-sample1-frozen-journey.mjs
```

之后的 mobile/dual 与分支 case 只引用各自新的 output 目录；本记录不将首败、旧 `/tmp` 回归或仅截图结果升级为 U10 全矩阵 PASS。
