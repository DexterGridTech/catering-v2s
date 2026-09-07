# TER terminal input CP-2 focused evidence

```text
CP=CP-2
SCOPE=keyboard layout data, geometry, owner preflight, focus-next, and scroll seam
IMPLEMENTATION_AUTHORITY=true
ANDROID_WEB_RUNTIME=NOT_RUN
```

## Focused commands

```text
yarn workspace @catering-v2s/ui-base-input typecheck
PASS

yarn workspace @catering-v2s/ui-base-input test
PASS
Test Files  7 passed (7)
Tests       43 passed (43)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-input

yarn workspace @catering-v2s/ui-base-primitives typecheck
PASS

yarn workspace @catering-v2s/ui-base-primitives test
PASS
Test Files  1 passed (1)
Tests       8 passed (8)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-base-primitives

yarn workspace @catering-v2s/ui-integration-sample-console typecheck
PASS

yarn workspace @catering-v2s/ui-integration-sample-console test
PASS
Test Files  6 passed (6)
Tests       13 passed (13)
TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/ui-integration-sample-console

yarn workspace @catering-v2s/ui-feature-sample-member-desk typecheck
PASS
Tests       17 passed (17)

yarn workspace @catering-v2s/ui-feature-sample-staff-auth typecheck
PASS
Tests       5 passed (5)
```

## Independent stage reconciliation

第一轮 fresh 独立只读对账保留为 first failure：四布局、几何、PrimitiveButton variant、live
registration、local onLayout、scroll 与静态边界共 10 行 `MATCHED`，但 KEY-R8 的 pointer
首击链为 `OPEN`；原测试只直接触发 native focus，不能证明 `onPressIn → preflight → native
focus`。

根因修复在 `apps/terminal/ui/base/input/test/provider.test.tsx`：

- `preserves the first pointer focus when preflight switches system to virtual` 先用 node
  mock 建立 system focus，再实际调用 TextInput 的 `onPressIn`，随后触发 node mock focus，
  观察目标仍 focused、owner 为 virtual、dock 可见；
- `uses the same preflight before programmatic focus-next crosses owners` 从 system 字段调用
  `complete()` 跨到 virtual 字段，观察 native focus、activeFieldId、owner 与 dock。

修复后的 fresh 第二轮只读结果：

```text
CP2_RECONCILIATION=PASS
MATCHED=15
OPEN=0
REVIEW_SCOPE=CP-2 only
ANDROID_WEB_RUNTIME=NOT_RUN
```

15 行覆盖四布局与 financial `-,0,.`、stable key/region IDs、dense/standard geometry、
真实 PrimitiveButton key、呈现-only variant、live `hasNextField`、CP-1 首帧/onLayout、
scroll 不重复扣除、pointer/programmatic preflight、feature 无 `className`、input 无静态
surface 尺寸桥接，以及 sample-console 只保留 `imeInset`。模型红向量与生产 focused 结果
分开；本文件不声明 Android/Web runtime 或真实 pointer rect 已验证。
