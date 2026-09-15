# sample1 双屏 normal 重验首败（当前 runner）

```text
EVIDENCE_TIER=Android/cleanup
BUSINESS=NOT_RUN
CLEANUP=PASS
FIRST_FAILURE=activeSecondarySurfaceId is not defined
LAST_KNOWN_GOOD=null
BROKEN_BOUNDARY=before-first-known-good
```

## 运行

```sh
node tools/terminal-sample2/run-sample1-frozen-journey.mjs \
  --serial emulator-5554 \
  --shape dual \
  --case normal \
  --age 37 \
  --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample1-frozen-current-dual-normal-after-main-reconciliation-v2-20260915
```

release APK 安装成功并与当前 APK binding 一致；runner 在首个 known-good 之前失败，未进入登录或业务步骤。`cleanup=PASS`，包括受管包停止与诊断产物收口。

## 根因与处置

当前源码的 dual 初始化块只需要锁定 logical secondary display；`activeSecondarySurfaceId` 没有声明，也没有任何读取点，属于 runner 自身的未使用赋值。主 agent 已删除该赋值，并通过两个 runner 的 `node --check` 与引用清零检查。原始 `result.json`、`progress.log`、command actions、display/SF/UI/logcat/window 诊断均保留在本目录，不以本次修复前的失败改写为 PASS。

该文件只记录首败；修复后的 dual dynamic 结果另行写入新目录。
