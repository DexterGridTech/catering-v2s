# TER Admin console 非登录区 r66 IA-13 独立视觉复核

`REVIEW_TARGET=IMPLEMENTATION`
`REVIEW_SCOPE=R66_IA13_RUNTIME_SINGLE_SURFACE_ONLY`
`REVIEW_ROUND=N`
`reviewerKind=INDEPENDENT_SUBAGENT`
`VERDICT=MATCHED_SCOPE_ONLY`
`OVERALL_ACCEPTANCE=NOT_CLAIMED`

## 输入

- IA 正本：`doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md` §4.3、§5.1；
- 深色 integration summary：
  `.runtime/ter-dual-machine-topology/2026-09-22/non-login-implementation/stage1-single-screen-all-r66/sample-terminal/master-display-0-frame-IA-13-runtime-single-surface-summary.png`；
- 浅色/壁纸 integration summary：
  `.runtime/ter-dual-machine-topology/2026-09-22/non-login-implementation/stage1-single-screen-all-r66/sample-wallpaper-terminal/master-display-0-frame-IA-13-runtime-single-surface-summary.png`；
- 两套 integration 各自的 IA-13 `detail-01..08` 截图及同批 XML。

## 独立逐控件结果

| 控件/关系 | 结果 | 观察 |
| --- | --- | --- |
| 全屏 surface | MATCHED | Admin console 覆盖可用 surface，无 shell 外部留白；只保留边框像素。 |
| 运行状态卡 | MATCHED | 运行正常、环境、调试态、设备、显示事实和物理屏数量层级清楚。 |
| 主屏矩形 | MATCHED | 只有当前 PRIMARY surface；主屏/当前 surface 语义清楚。 |
| 物理长/高 | MATCHED | `物理长：2560` 在矩形外上方，`物理高：1600` 在矩形外右下侧，均横向可读。 |
| 逻辑宽/高 | MATCHED | `逻辑高：800` 位于矩形内右侧，横向可读；不再出现竖排拆字。 |
| 就绪/可用状态 | MATCHED | 矩形内显示已就绪、可用状态正常。 |
| 比例 | MATCHED | 矩形为横向 8:5，与 1280×800 逻辑语义一致。 |
| 图例/说明 | MATCHED | 明确当前 surface 显示完整事实、非当前 surface 只表达存在性/角色/信息未提供边界。 |
| 导航 | MATCHED | 平台端口、运行状态、双机拓扑三项，运行状态高亮。 |
| 主题层级 | MATCHED | 深色与浅色/壁纸仅 integration token 颜色不同，结构和语义层级一致。 |

## 结论边界

本复核只关闭 r66 两套 integration 的 IA-13 视觉项；不关闭 IA-03/04/05/06/07/08、IA-14
`display-facts-error` 变体、其余未完成逐控件视觉或整体验收。像素抗锯齿与平台栅格化细节未作为 OPEN。
