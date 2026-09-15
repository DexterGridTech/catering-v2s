# sample1 双屏 normal 冻结旅途（当前 release）

```text
EVIDENCE_TIER=release/android/cleanup
BUSINESS=PASS
CLEANUP=PASS
FIRST_FAILURE=null
LAST_KNOWN_GOOD=S1-11
BROKEN_BOUNDARY=null
```

## 运行

```sh
node tools/terminal-sample2/run-sample1-frozen-journey.mjs \
  --serial emulator-5554 \
  --shape dual \
  --case normal \
  --age 37 \
  --output doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/sample1-frozen-current-dual-normal-after-main-reconciliation-v3-20260915
```

release APK binding 与当前 sample-terminal APK 一致：sha256 为 `9fe47967bb5824ee63e19f565af7a3218d3d116f3cbf31472b62dc21eec04077`，bytes 为 `87920433`。

## 结果

runner 的 `result.json` 为 `business=PASS`、`cleanup=PASS`、`firstFailure=null`、`lastKnownGood=S1-11`。步骤记录覆盖：

- `s1-01-anonymous`：登录页；
- `s1-02-invalid-login`：既有 sample1 notice 的 partKey、文案与 dismiss 控件；
- `s1-03-member-list`、`s1-04-member-form`、`s1-05-customer-confirm`；
- `s1-06-confirmed`：member-list 与 Alice/手机号 row；
- `s1-06-authenticated-cold-restart`：冷重启后仍为 authenticated member-list；
- `s1-12-logout` 与 `s1-11-cold-restart-anonymous`：登出后冷重启回到 login。

每个步骤都断言 primary/secondary 的预期 partKey 与文案/业务状态，并记录 logical `displayId=0/2`、logical secondary 的 `FLAG_PRESENTATION`、本次发现的 SurfaceFlinger primary/virtual ID。副屏每一步均用发现的 SF ID 截图，`file` 产物为 `1280 x 720` PNG；主屏为 `2560 x 1600` PNG。SF virtual block 未提供 activeMode 时的尺寸未知不影响 identity 配对，物理尺寸由 logical DisplayInfo 与 display-scoped PNG 共同证明。

原始 `result.json`、`progress.log`、逐步 UI、display/SF dump、截图、APK binding、command actions 和 cleanup 产物均保留在本目录。该文件只关闭当前 sample1 dual normal supporting evidence，不代表 U10 全矩阵、Web、visual 或整体 implementation acceptance 已关闭。
