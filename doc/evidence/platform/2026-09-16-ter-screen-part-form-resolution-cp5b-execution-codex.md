# TER screenPart 机型解析 · CP-5b execution evidence

```text
SCOPE=CP-5b / B-2 / R-11
AUTHORIZATION=DEXTER_DIRECT_IMPLEMENTATION_AUTHORIZATION
STEP_STATUS=CLOSED_MATCHED
```

## Owning source changed

- `apps/terminal/ui/base/render/src/components/LayerStack.tsx`
- `apps/terminal/ui/base/render/test/renderSurface.test.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellMobile.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigationLaptop.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/SampleSection.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSection.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSection.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx`
- `apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx`
- `apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx`
- `apps/terminal/ui/feature/sample-staff-auth/src/components/AuthNotice.tsx`
- `apps/terminal/ui/feature/sample-member-desk/src/components/{DiscardConfirm,RegistryNotice,WaitingConfirm,WithdrawConfirm}.tsx`
- `apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts`
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`

## 实现事实

- `LayerStack` 的全屏 layer wrapper 保留 absolute fill、遮罩、层级和返回/关闭语义，移除
  `alignItems:'center'`、`justifyContent:'center'` 与 `padding:24`。
- admin root 使用 `PrimitiveContainer layout="fill"` 与 `{flex:1,width:'100%',minWidth:0}`；
  laptop 在同一 workspace 父节点内使用明确 row 的 navigation/detail；mobile 使用已有
  `PrimitiveGrid` 的 wrap 导航与一个 bounded content frame。
- 原先由 LayerStack 提供的通用内缩/居中不再影响所有 layer；7 个 floating card 组件
  各自使用 `PrimitiveCenter` 的 `{flex:1,minHeight:0,padding:24}` frame，并在内部以
  `PrimitiveContainer layout="card" bounded` 持有 card 内容。admin login 同样逐点处理；
  admin shell 自身改为 full canvas。
- 四个内容 section 保留 bounded scroll-owner contract，并显式持有
  `{flex:1,minHeight:0,minWidth:0}`，避免 content frame 变更后高度基准漂移。

## Focused results

```text
COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell test
RESULT=PASS
TEST_FILES=6 passed
TESTS=15 passed

COMMAND=yarn workspace @catering-v2s/ui-base-render typecheck
RESULT=PASS
OUTPUT=(empty)

COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=PASS
TEST_FILES=13 passed
TESTS=76 passed

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console test
RESULT=PASS
TEST_FILES=8 passed
TESTS=38 passed

COMMAND=yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console test
RESULT=PASS
TEST_FILES=4 passed
TESTS=16 passed
```

## Red mutations

```text
MUTATION=LayerStack.styles.layer.padding=24
COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=RED; 1 test failed / 75 passed
ORACLE=renderSurface.test.tsx 精确断言拒绝 layer padding
RESTORED=YES; subsequent render test returned 13 files / 76 tests PASS

MUTATION=AdminShellFrame root layout="card"
COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell test
RESULT=RED; adminLayout.test.ts root contract failed (`layout="card"` != `layout="fill"`)
RESTORED=YES; subsequent admin-shell test returned 6 files / 15 tests PASS

MUTATION=AdminLogin inner card removes bounded
COMMAND=yarn workspace @catering-v2s/ui-base-admin-shell test
RESULT=RED; adminLayout.test.ts card denominator failed for AdminLogin
RESTORED=YES; subsequent admin-shell test returned 6 files / 15 tests PASS

MUTATION=LayerStack.styles.stack.alignItems=\"center\"
COMMAND=yarn workspace @catering-v2s/ui-base-render test
RESULT=RED; renderSurface.test.tsx outer layer-stack style assertion failed / 75 passed
RESTORED=YES; subsequent render test returned 13 files / 76 tests PASS

MUTATION=AdminShellFrame rootStyle.maxWidth=480
COMMAND=yarn workspace @catering-v2s/ui-integration-sample-console test
RESULT=RED; sampleAssembly.test.tsx root style assertion failed / 37 passed
RESTORED=YES; subsequent sample-console test returned 8 files / 38 tests PASS
```

The mutations were temporary and are not left in production source. The structural tests do
not claim pixel layout or visual coverage; true canvas fill, no mask, and overflow behavior
remain the D-13 visual/native obligations.

## Evidence boundary

```text
STATIC=PASS_FOR_CP-5b_SOURCE_AND_TEST_SHAPE
FOCUSED=PASS_FOR_CP-5b
NATIVE=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
WEB=OPEN_NOT_RUN
VISUAL=OPEN_NOT_RUN
RELEASE=OPEN_NOT_RUN
CLEANUP=NOT_APPLICABLE
STEP_LEVEL_THREE_DIMENSIONAL_RECONCILIATION=MATCHED; fresh recheck record: doc/review/platform/2026-09-16-ter-screen-part-form-resolution-cp5b-three-dimensional-reconciliation-planck.md
```
