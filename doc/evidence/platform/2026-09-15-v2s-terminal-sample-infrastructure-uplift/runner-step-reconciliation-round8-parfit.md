# sample2 runner 确认控件可见性修复步骤对账

```text
REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=8
reviewerKind=INDEPENDENT_SUBAGENT
reviewerThread=01a0a500-2c6e-7480-a566-162df0264068
STEP_RECONCILIATION=MATCHED
REVIEWER_M_S_N=0/0/0
DYNAMIC_STATUS=NOT_RUN_BY_REVIEWER
```

## 输入

- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md`
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md`
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-plan-codex.md`
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md`
- `tools/terminal-sample2/run-sample2-frozen-journey.mjs`
- `apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperBackground.tsx`
- `apps/terminal/ui/base/primitives/src/components/PrimitiveImage.tsx`
- `apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx`
- `project-memory/pitfalls/review-checked-existence-not-rendering.md`
- `project-memory/operations/terminal-android-display-screenshot-capture.md`
- 当前首败目录：`sample2-frozen-current-mobile-after-main-reconciliation-20260915`、
  `sample2-frozen-current-dual-after-main-reconciliation-20260915`

## 独立核验结论

Parfit 只读重开了当前 runner、picker 控件布局、`WallpaperBackground`、`PrimitiveImage`、
需求、详设、计划和上述首败 evidence。结论如下：

- `readState` 先读取当前 UI；只有当 PRIMARY 是 picker 且命名确认节点不在当前树中时，才
  通过 `sample.wallpaper.picker:options:scroll` 的 bounds 执行 `swipeToBottom()`，再重新
  `readUi()` 并断言确认节点。确认节点仍缺失时仍然抛出 `confirm control missing`。
- 该修复没有删除或弱化 PRIMARY partKey、主屏文案、选中项唯一性、确认 enabled、
  SECONDARY partKey/文案、logical/SF pairing 稳定性、背景存在性、背景 asset identity、
  observed effective/confirmed wallpaper 或冷重启 pending/confirmed 断言。
- `WallpaperPicker` 的确认按钮确实位于同一个 `optionsScroll` 之后；mobile 首败 XML 说明
  它只是超出当前视口，不是控件从树中缺失。
- 当前 `WallpaperBackground` 只读 confirmed `selectWallpaperId`，将动态
  `accessibilityLabel` 交给 `PrimitiveImage`；runner 用该 label 判资产身份，release runner
  另用本地/已安装 APK 的 bytes 与 sha256 绑定，二者互补。

## 边界

本记录只证明当前源码与需求、详设、计划的步骤级一致性。Parfit 未运行构建、Android、
设备、动态或部署命令；sample2 动态仍由主 agent 在该记录之后执行。旧 release bundle
曾由 source map 证实仍含通用 `当前壁纸` 标签，因此重建 release APK 是后续必要动作。
