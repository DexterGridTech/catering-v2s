# TER Web surface preview scale 运行证据

```text
REVIEW_CYCLE_ID=TER_WEB_SURFACE_SCALE_2026-09-07
EVIDENCE_TIER=FOCUSED_AND_WEB_REAL_DOM
RUN_SCOPE=LOCAL_WEB_PREVIEW_ONLY
ANDROID_EVIDENCE=NOT_RUN_IN_THIS_CORRECTION
REAL_POS_EVIDENCE=NOT_RUN
CODE_TO_DESIGN_RECONCILIATION=MATCHED
RECONCILIATION=PASS
INDEPENDENT_REVIEW=ROUND_2_NO_GO_FINDING_CLOSED
AUTHOR_CLOSURE=PASS
```

本记录只覆盖 2026-09-07 Dexter 指派的 Web 预览缩放修复。它不把浏览器证据扩大为
Android/真实 POS 证据，也不改写 `doc/evidence/platform/terminal-input/` 下旧的
CP-0..CP-3 运行记录。

## 修复锚点

- `apps/terminal/ui/base/dev-host/src/testExpoApp.tsx#SurfaceCanvas`：canvas `onLayout`
  只测宿主自己的预览宽度；logical stage 固定组合尺寸；surface box 固定自己的声明尺寸。
- `apps/terminal/ui/base/dev-host/src/surfacePreview.ts#calculateSurfacePreviewGeometry`：
  按 `row`/`column`、当前是否挂载 SECONDARY、声明尺寸和 gap 计算共同倍率；
  `scaleToFit=true` 只缩小不放大，`false` 保持倍率 1。
- `apps/terminal/ui/base/dev-host/test/testExpoApp.test.tsx` 与
  `apps/terminal/ui/base/dev-host/test/surfacePreview.test.ts`：首帧未测量、单/双屏、
  row/column、resize、禁用缩放和固定逻辑尺寸断言。
- `apps/terminal/ui/integration/sample-console/test/testExpoApp.test.tsx`：先发送宿主
  layout 事件再观察 surface，避免旧的“未测量即渲染/aspectRatio”假设。

## focused/typecheck 结果

执行位置均为对应包根目录，输出为真实当前运行结果：

```text
apps/terminal/ui/base/dev-host
  yarn typecheck
  exit=0
  yarn test
  Test Files 4 passed (4)
  Tests 11 passed (11)
  TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-dev-host

apps/terminal/ui/integration/sample-console
  yarn typecheck
  exit=0
  yarn test
  Test Files 6 passed (6)
  Tests 15 passed (15)
  TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console

root formatting check
  yarn prettier --check [5 affected TypeScript files]
  All matched files use Prettier code style!
```

## Web real DOM 观察

页面：`http://localhost:8082/`，sample-console，双屏模式。浏览器原始窗口在本次观察前为
`innerWidth=1920`、`innerHeight=872`；单屏和双屏在宽度足够时均保持声明尺寸。

为验证 resize，在同一个 Chrome tab 上临时设置 `800 × 900` viewport，观察后已调用
`Emulation.clearDeviceMetricsOverride` 恢复原始窗口尺寸。窄窗口下真实 DOM 读数如下：

```text
canvas              width=744       height=818.046875
scaled-stage        width=740       height=814.046875
logical-stage       width=720       height=794.053650
                    offsetWidth=1157 offsetHeight=1276 style=1157px × 1276px
                    computed transform=matrix(0.622299, 0, 0, 0.622299, 0, 0)
PRIMARY surface     width=720       height=449.922242
                    offsetWidth=1157 offsetHeight=723 style=1157px × 723px
SECONDARY surface   width=598.651733 height=336.663818
                    offsetWidth=962 offsetHeight=541 style=962px × 541px
```

该倍率由 `(744 - 2×2 - 2×10) / 1157 = 0.622299...` 得到。因而：

- PRIMARY 的真实 rect 宽高比约为 `1.6003`，与声明 `1157 × 723` 的宽高比一致；
- SECONDARY 的真实 rect 宽高比约为 `1.7782`，与声明 `962 × 541` 的宽高比一致；
- 两棵 surface 共用同一倍率，但没有共用尺寸，也没有被 flex 拉成相同宽度；
- `logical-stage` 的 layout/offset 宽度仍为 `1157`，浏览器可见 rect 才是缩放后的 `720`，
  两者没有被混作 input 的尺寸事实。

## 虚拟按键命中观察

在真实 sample `MemberForm` 中点击“电话”后，读取
`ui.base.input:virtual-keyboard:text-5`：

```text
getBoundingClientRect:
  left=283.318939
  top=479.354370
  width=232.739899
  height=29.870362
center=(399.688889, 494.289551)
elementFromPoint(center): descendant DIV of
  BUTTON[data-testid="ui.base.input:virtual-keyboard:text-5"]
same action tree: true
```

祖先 computed transform 观察结果：`ui.base.input:surface-frame` 及其内部键盘节点为
`none`；唯一的非 `none` 变换是宿主的
`[data-testid="sample-console:test-expo:canvas:logical-stage"]`，值为上述共同 preview
scale。该结果证明真实 Web pointer 中心落在同一个按键动作树内；缩放后的 Web rect
不作为 Android 48dp 证据。

## 首帧与清理

- focused test 在发送 canvas `onLayout` 前观察到 `canvas:measure-pending`，且 PRIMARY
  尚未挂载；没有用猜测尺寸先画一版。
- 本次未新增临时 probe；已有 alpha/financial 是详设批准的 sample-only 字段，不是
  CP-0 探路代码。
- 浏览器 resize 使用的临时 CDP viewport override 已清除；页面仍保持用户要求的本地
  Web 预览可体验状态。

## 当前证据边界

```text
PRODUCTION_SOURCE_TYPECHECK=PASS
FOCUSED_TESTS=PASS
WEB_REAL_RECT_AND_HIT=PASS_FOR_LOCAL_WEB_PREVIEW
ANDROID_RUNTIME=NOT_RUN
ANDROID_IME=NOT_REASSESSED
REAL_POS=NOT_RUN
```

## 独立复核收口

fresh 独立子 agent 在本 review cycle 第二轮发现 active brief 仍有一条旧 Web 口径；主
agent 已更新该 brief 的 fixed logical stage、local Web DOM 命中和未取证边界，并重新核对
当前代码与本记录。两轮上限已用完，不创建第三轮；本记录的 `AUTHOR_CLOSURE=PASS` 不等同
于把第二轮独立 verdict 改写为 GO。
