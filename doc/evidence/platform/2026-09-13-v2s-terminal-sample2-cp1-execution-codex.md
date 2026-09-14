# TER sample2 壁纸终端 CP-1 执行证据

- `RUN_ID`: `ter-sample2-cp1-20260913-01`
- `SCOPE`: 图片比较支持工具、primitives 图片 seam 与透明容器；不启动后台 DEV，不执行
  seed、UAT、部署或数据操作。
- `STATUS`: `MATCHED`
- `EXECUTED_AT`: `2026-09-13`

## 实施与首败

CP-1 首次 typecheck 暴露两个实现接缝错误：`PrimitiveImage` 错把 `ViewStyle` 用作图片
style 类型，且 focused test 没有导入新增的 `PrimitiveImage`。按 owning source 修正为
`ImageStyle` 并补齐测试导入；随后重新执行 typecheck 与测试。首次 test 还暴露 shared
node-only React Native harness 没有 `Image` host，补入同一 harness 的 host shape；测试
随后改为检查真实 `Image` host 节点，而不是依赖 composite 节点存在。

步骤级独立 reviewer 首轮还发现比较工具的 cell 判定与详设不一致（实现按超过半数变化
像素，详设要求 cell 平均 max-channel delta）、缺少 ROI/mask 面积失败关闭，以及 CP-1
证据文件缺失。主 agent 已按这些反馈修复并重新执行；第二次 fresh 步骤级 reviewer 已
逐项复核，除下列边界外全部 `MATCHED`：后续 wallpaper consumer 才能执行的 F-A2a 真机
ROI 变异保持后置，不在 CP-1 冒充证据。

## 当前源码与工具结果

### image compare

`tools/terminal-image-compare/compare.mjs` 当前约束：

- 只接受同尺寸、8-bit、非隔行 RGB/RGBA PNG；坏 signature、截断 chunk、unsupported
  color/interlace/filter、尺寸不同或 metadata 非法均失败关闭；
- `canvasRect` 是唯一 8×8 网格锚点；每格以完整 cell 面积为分母，只有位于 `roiRect` 且
  未被 mask 的像素占比达到固定 `0.25` 才参与，低于该值同时从 changed-cell 分子/分母
  剔除；参与格子按平均 max-channel delta `>4` 判 changed；
- `roiRect` 至少覆盖 canvas 的 20%，mask 与 canvas 的并集交面积最多占 canvas 的 80%；
  metadata 的 `minUnmaskedFraction` 必须精确为 `0.25`；
- 不拥有截图、Android 生命周期或 TER runtime graph。

### primitives

- `RnrImage` 是唯一新增 RN image seam；`PrimitiveImage` 缺 source 返回 null，thumbnail
  默认 `contain`，background 默认 `cover` 且只消费 `imageBackground`；
- `PrimitiveContainer layout="transparent"` 只移除 `bg-canvas`，保留填充/间距；默认、
  card、content、centered 形态不改；
- `PrimitiveImage`、`PrimitiveImageProps` 已同步 public export 与 invariant；shared
  focused harness 提供 `Image` host，未恢复 `showSoftInputOnFocus`。

## 实际命令结果

| 检查 | 命令 | 结果 | 原始记录 |
|---|---|---|---|
| image-compare self-test | `node tools/terminal-image-compare/test/compare.test.mjs` | exit `0`; `IMAGE_COMPARE_RED_THRESHOLD_MUTATION=PASS`、`IMAGE_COMPARE_SELF_TEST=PASS`、`IMAGE_COMPARE_CLEANUP=PASS` | `/tmp/ter-sample2-cp1-image-compare-final4.log` |
| primitives typecheck | `yarn --cwd apps/terminal/ui/base/primitives typecheck` | exit `0` | `/tmp/ter-sample2-cp1-primitives-typecheck-after-grid.log` |
| primitives focused tests | `yarn --cwd apps/terminal/ui/base/primitives test` | exit `0`; 1 file、15 tests passed；真实测试 owner 为 `@catering-v2s/ui-base-primitives` | `/tmp/ter-sample2-cp1-primitives-test-final2.log` |
| primitives behavior baseline/mutation | `node tools/terminal-ui-primitives/check-behavior.mjs` | exit `0`; baseline PASS、theme token mutation PASS、cleanup PASS | `/tmp/ter-sample2-cp1-primitives-behavior-final.log` |
| package invariant model | `node tools/terminal-shared/package-invariants.test.mjs` | exit `0`; `TERMINAL_PACKAGE_INVARIANT_MODEL_TEST=PASS` | `/tmp/ter-sample2-cp1-package-invariants-final.log` |

image-compare self-test 使用既有 sample-terminal PNG：
`android-icon-background.png` 与 `android-icon-foreground.png` 作同尺寸 changed pair，
`android-icon-background.png` 自身作 unchanged pair，`favicon.png` 作尺寸不一致
fail-closed pair；8×8 cell 反例覆盖稀疏大差值与密集小差值，面积与 metadata 变异也会
失败关闭。测试还用同一确认阈值 oracle 断言原始 changed pair 通过、threshold=255 mutation
不通过；临时文件在测试结束删除，mutation 恢复不写回生产文件。

## 尚未在 CP-1 声称的内容

完整 `F-A2a` 需要 sample2 wallpaper consumer 与真实 wallpaper ROI，安排在后续 CP-5/CP-9
首次可运行后执行；本证据不把它提前写成 PASS。CP-1 只关闭工具自身的 self-test、
primitives seam 与 unit-level transparent token 证据；真机合成、Web/Android、壁纸选择
与双屏可见性仍未验证。最后一次 fresh 步骤复核由 `01a09a6d-2d9e-7e71-84e8-f412db2e30d4`
完成，结论为 `CP1_STEP_VERDICT=MATCHED`；它复核了 `PrimitiveGridProps` 已与
`terminal-invariants.json` exact 同步、README/source 一致性和上述实际输出。该结论只关闭
CP-1 步骤，不提升后续 wallpaper consumer、Web、Android 或视觉档位。

## 清理

本 CP 没有创建受管长运行进程或 Android runtime；image compare 测试的临时目录已清理。
没有使用后台 DEV、seed、UAT、部署或数据操作。
