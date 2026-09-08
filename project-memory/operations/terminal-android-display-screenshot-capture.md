---
id: operations.terminal-android-display-screenshot-capture
title: TER Android 主屏与副屏截图必须先发现 SurfaceFlinger display ID
type: operation
status: active
layer: routed
scope: every TER Android screenshot, secondary-surface visual verification, and display evidence capture
createdAt: 2026-09-08
taskKinds: ["memory-recall", "implementation", "review", "testing", "diagnostics"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["platform", "frontend-platform"]
impacts: ["runtime", "evidence", "memory"]
triggers: ["task-start", "implementation", "review", "runtime", "failure", "status-question"]
assertions: ["TER_ANDROID_SCREENSHOT_SURFACEFLINGER_ID", "TER_ANDROID_SCREENSHOT_LOGICAL_VS_SURFACE_ID", "TER_ANDROID_SCREENSHOT_DIMENSION_CHECK", "TER_ANDROID_SCREENSHOT_FAILURE_BOUNDARIES"]
sourceRefs: ["doc/evidence/platform/terminal-input/runs/TERMINAL-INPUT-CP3-ANDROID-2026-09-06T05-00-00/README.md", "doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md"]
---

# TER Android 主屏与副屏截图方法

## 核心规则

Android 这里有两套不能混用的 display ID：

- `adb shell dumpsys display` 里的 Android `logical displayId`（当前副屏通常是 `2`）。它用于
  `adb shell input -d 2 ...` 与 `uiautomator dump --display-id 2` 这类逻辑显示操作。
- `SurfaceFlinger` 的 display ID。`screencap -d` 要的是这个 ID，不是上面的 logical
  `displayId`。它可能是很长的物理/虚拟显示标识，并且可能随模拟器重启变化。

因此每次截图都必须先发现 SurfaceFlinger ID，不能把 `displayId=2` 直接传给
`screencap -d`，也不能把上一次运行的长 ID 当成永久常量。

## 可复制的发现与截图命令

先用 `dumpsys display` 确认哪一个 logical display 是目标副屏（核对名称、分辨率、
`FLAG_PRESENTATION` 和 `uniqueId`），再用 `dumpsys SurfaceFlinger --displays` 发现用于像素
截图的 ID：

```sh
ADB=/Users/dexter/Library/Android/sdk/platform-tools/adb
SERIAL=emulator-5554

SF_DUMP="$("$ADB" -s "$SERIAL" shell dumpsys SurfaceFlinger --displays)"
printf '%s\n' "$SF_DUMP" | awk '/^Display / || /^Virtual Display / {print}'

PRIMARY_SF_ID="$(printf '%s\n' "$SF_DUMP" | awk '/^Display / {print $2; exit}')"
VIRTUAL_ROWS="$(printf '%s\n' "$SF_DUMP" | awk '/^Virtual Display / {print}')"
VIRTUAL_COUNT="$(printf '%s\n' "$VIRTUAL_ROWS" | awk 'NF {count++} END {print count + 0}')"
test "$VIRTUAL_COUNT" -eq 1
SECONDARY_SF_ID="$(printf '%s\n' "$VIRTUAL_ROWS" | awk '{print $3; exit}')"
test -n "$PRIMARY_SF_ID"
test -n "$SECONDARY_SF_ID"

"$ADB" -s "$SERIAL" exec-out screencap -p -d "$PRIMARY_SF_ID" > /tmp/ter-primary.png
"$ADB" -s "$SERIAL" exec-out screencap -p -d "$SECONDARY_SF_ID" > /tmp/ter-secondary.png
file /tmp/ter-primary.png /tmp/ter-secondary.png
```

如果 `VIRTUAL_COUNT` 大于一，必须按 `dumpsys display` 的名称、分辨率和
`uniqueId` 与 SurfaceFlinger 输出逐个匹配后再截图，不能静默取第一个虚拟显示。
如果目标副屏是物理外接显示而不是 virtual display，则在 `SF_DUMP` 中按对应的
`Display <id>` 条目匹配，不得套用 `Virtual Display` 的取法。

## 当前模拟器的已验证样例

一次成功的动态发现输出是：

```text
Display 4619827259835644672
Virtual Display 11529215047789101945
PRIMARY_SF_ID=4619827259835644672
SECONDARY_SF_ID=11529215047789101945
/tmp/ter-primary.png: PNG image data, 2560 x 1600, 8-bit/color RGBA, non-interlaced
/tmp/ter-secondary.png: PNG image data, 1280 x 720, 8-bit/color RGBA, non-interlaced
```

这两个长 ID 只是该次运行的样例，不是下一次的输入。当前 `dumpsys display` 同时显示
logical `displayId=0` 的主屏（`2560 x 1600 @ 320 dpi`）和 logical `displayId=2` 的
副屏（`1280 x 720 @ 213 dpi`、`FLAG_PRESENTATION`）。这正是两套 ID 的对应关系，
不是同一个 ID 命名方式。

## 常见失败与证据边界

- 当前 emulator 上直接执行 `screencap -d 2` 会返回 `Status: -2` / `Capturing failed`；
  这只说明把 logical ID 当成 SurfaceFlinger ID 是错误的，不能写成“副屏截图成功”。
- `dumpsys SurfaceFlinger --display-id` 在当前设备可能只列物理默认屏，不能替代
  `dumpsys SurfaceFlinger --displays` 的虚拟显示发现。
- `screenrecord --display-id 2` 在当前 emulator 返回 `Invalid physical display ID`；
  录屏参数与 `screencap -d` 的虚拟显示捕获能力不能互相推定。
- `screencap -a` 在当前设备不能作为可靠的虚拟副屏像素证据；不要把唯一的主屏 PNG
  当作副屏截图。
- `uiautomator dump` 是 UI hierarchy，不是像素截图；`input -d 2 tap` 是真实逻辑副屏
  点击，也不能替代副屏 PNG。

每次交付截图证据至少同时保留：设备 serial、`dumpsys display` 与
`dumpsys SurfaceFlinger --displays` 原始输出、logical displayId、SurfaceFlinger ID、
surface/window identity，以及 `file` 返回的 PNG 尺寸。若 `file` 显示 ASCII 错误文本、
尺寸不匹配或 ID 未能从本次 dump 发现，该截图证据必须记为失败/OPEN。

## 记忆入口

后续 TER 的 Android 双屏视觉核验、主副屏截图或“副屏 ID 不对”故障排查，先读本文件，
再执行上面的动态发现命令；不要从聊天历史、旧证据或固定数字猜 ID。
