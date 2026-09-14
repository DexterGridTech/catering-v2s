# TER sample2 壁纸终端 CP-0 执行证据

- `RUN_ID`: `ter-sample2-cp0-20260913-01`
- `SCOPE`: 仅验证 workspace 包内 `.jpg` 的 TypeScript/Metro 可达性；未启动后台 DEV，未执行 seed、UAT、部署或数据操作。
- `STATUS`: `MATCHED`
- `EXECUTED_AT`: `2026-09-13 19:36-19:37 +09:00`

## 输入与临时接线

临时 probe 复制了现有仓内资产 `contracts/policy/catalog-inventory-p1-media/mushroom-soup.jpg`，源文件元数据来自 `contracts/policy/catalog-inventory-media-assets.json`：`contentType=image/jpeg`、`sha256=768369872abbd757eccb222862227a0269f1d4da3063148dd86689105b490643`、`sourceLicense=CC0`、`sourceProvider=Wikimedia Commons`。

probe 曾短暂加入既有 `ui-feature-sample-staff-auth`，由既有 `ui-integration-sample-console` 经 `apps/terminal/assembly/android/sample-terminal` 的 Expo Web consumer 静态导入。`*.jpg` 声明分别放在库侧与 consumer 侧的 TypeScript program 中；仅放库侧时，consumer typecheck 真实失败，说明声明不能只依赖 workspace library 自身的 include。

probe 已在本次 CP-0 结束时删除，既有 package、assembly 与 sample-console 恢复到 probe 前字节；输出目录保留在 `/tmp/ter-sample2-cp0-20260913-01/web-export` 作为本次运行的只读产物。

## 实际命令结果

| 检查 | 命令边界 | 结果 | 原始记录 |
|---|---|---|---|
| 库侧 TypeScript | `yarn --cwd apps/terminal/ui/feature/sample-staff-auth typecheck` | exit `0` | `/tmp/ter-sample2-cp0-20260913-01/staff-auth-typecheck.log` |
| consumer 首次 TypeScript | `yarn --cwd apps/terminal/ui/integration/sample-console typecheck`，仅库侧声明 | exit `2`，`TS2307 Cannot find module './probe.jpg'` | `/tmp/ter-sample2-cp0-20260913-01/sample-console-typecheck.log` |
| consumer 修正后 TypeScript | 同上，增加 consumer program 内声明 | exit `0` | `/tmp/ter-sample2-cp0-20260913-01/sample-console-typecheck-rerun.log` |
| 实际 Metro consumer | `CI=1 yarn --cwd apps/terminal/assembly/android/sample-terminal exec expo export --platform web --output-dir /tmp/ter-sample2-cp0-20260913-01/web-export` | exit `0`，`Web Bundled ... (671 modules)`，`Assets (1)` | `/tmp/ter-sample2-cp0-20260913-01/expo-export.log` |

Metro export 实际产物包含：

`assets/___ui/feature/sample-staff-auth/src/__metro_probe__/probe.a41d6e60b3a908e57f138fa698a64c56.jpg`

产物 `file` 识别为 `JPEG image data`、`960x720`；产物 SHA-256 为 `768369872abbd757eccb222862227a0269f1d4da3063148dd86689105b490643`，与源资产完全一致。bundle 中同时出现该资源 URI，证明不是仅靠声明通过而是进入 Metro 资源图。

## 结论与边界

1. Metro 对 workspace 包内静态 `.jpg` 的解析在当前 sample-terminal Web consumer 上已实测成立。
2. 图片类型声明的最小可靠落点是最终 TypeScript consumer 的 include 范围；未来 picker 库若自身源文件直接 import 图片，应在库侧保留声明，同时在实际 assembly/consumer 的 TypeScript program 可见范围内提供同一声明，避免跨 workspace 源解析时出现 `TS2307`。
3. 本证据只关闭 CP-0 的 Metro/JPG 与类型声明问题，不证明图片在 Android/Web 运行时的视觉可见性，也不替代后续 A2、A2d、A3、A8、A9 证据。
4. 清理检查：probe 源文件、声明、库导出和 sample-console import 均已移除，`find` 未发现 `__metro_probe__` 残留。
