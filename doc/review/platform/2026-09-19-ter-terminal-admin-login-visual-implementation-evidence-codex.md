# TER terminal admin login 主题化视觉实施证据

```text
REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_AUTHORITY=DEXTER_GRANTED_2026-09-19
IMPLEMENTATION_STATUS=CODE_AND_FOCUSED_EXECUTION_COMPLETE_REVIEW_PENDING
INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN
WEB=OPEN_NOT_RUN
METRO=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
DEVICE=OPEN_NOT_RUN
VISUAL_ACCEPTANCE=OPEN
RELEASE=OPEN_NOT_APPLICABLE_TO_THIS_RUN
CLEANUP=NOT_APPLICABLE_STATIC_AND_FOCUSED_ONLY
```

## 实际改动

- `apps/terminal/ui/base/primitives/src/types/types.ts`：新增 `elevated` 与 `PrimitivePinInput` 公共类型，事件只透传结构化 `stopPropagation`。
- `apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx`：只在调用方显式传 `elevated` 且 `layout="card"` 时追加 elevated recipe，默认 card 不变。
- `apps/terminal/ui/base/primitives/src/components/PrimitivePinInput.tsx`：新增无状态六格/可变长度 PIN 呈现 primitive，支持 `*` mask、focus/error/disabled 和 native/browser owner 事件透传。
- `apps/terminal/ui/base/primitives/src/theme/tokens.ts`、`src/index.ts`、`terminal-invariants.json`、`README.md`、`test/primitives.test.tsx`：同步 token、公共导出、说明与 focused 覆盖。
- `apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx`：改用 `PrimitivePinInput`，保留既有 field、认证、错误、关闭、debug password 与 testID；显式传 `elevated`，同时传 native `onTouchEnd` 与 browser `onClick` surface-dismiss 守卫。
- `apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts`：约束只有 AdminLogin card 使用 elevated，并确认两个守卫仍由 login owner 提供。
- `apps/terminal/ui/integration/sample-console/theme/global.css`、`tailwind.config.cjs`、`test/theme.test.ts`：增加 integration-owned `surface-elevated`、`surface-inset`、`focus`，并证明 focus 值与 wallpaper theme 不同。
- `apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css`、`tailwind.config.cjs`、`test/theme.test.ts`：同步三项语义 token 与本 integration 的主题值。
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`：将既有已填 PIN 断言从 `•` 对齐到批准的 `*`。

未改：两个 Android `App.tsx`/Metro、两个 `test-expo/App.tsx`、console assembly、input controller/virtual keyboard、认证算法、业务 feature、wallpaper/member/topology、已认证 admin section、splash、application icon、依赖与脚本。

## 验证结果

| 命令 | 结果 | 档位 | 备注 |
| --- | --- | --- | --- |
| `yarn --cwd apps/terminal/ui/base/primitives typecheck` | PASS | focused/typecheck | 公共类型与组件编译通过 |
| `yarn --cwd apps/terminal/ui/base/primitives test` | PASS | focused | 1 file / 17 tests |
| `yarn --cwd apps/terminal/ui/base/admin-shell typecheck` | PASS | focused/typecheck | AdminLogin 与 admin-shell 类型通过 |
| `yarn --cwd apps/terminal/ui/base/admin-shell test` | PASS | focused | 9 files / 21 tests |
| `yarn --cwd apps/terminal/ui/integration/sample-console typecheck` | PASS | focused/typecheck | theme test 与 assembly 类型通过 |
| `yarn --cwd apps/terminal/ui/integration/sample-console test` | PASS | focused | 8 files / 44 tests |
| `yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console typecheck` | PASS | focused/typecheck | theme test 与 assembly 类型通过 |
| `yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test` | PASS | focused | 4 files / 18 tests |
| `yarn --cwd apps/terminal verify:static` | PASS | static | `TERMINAL_STATIC=PASS`；既有 model red mutation 输出为预期 FAIL，real static 全部通过 |

本轮没有命令失败，因此 `first failure` 为无、`last known good` 为上述全部命令、`broken boundary` 为无。原始命令输出保留在本次 Codex 执行记录；本文件只登记可复核摘要，不把退出码单独当业务 oracle。

## 判据对账

| 判据 | 结果 | 证据 |
| --- | --- | --- |
| primitive public surface | MATCHED | index、invariants、README、typecheck/test 同步 |
| 六格、方形、`*`、可变长度 | MATCHED | PrimitivePinInput focused render test + sample assembly `*` 断言 |
| focus/error/disabled | MATCHED | primitive render test 与 token 分支；视觉可读性仍属 visual OPEN |
| elevated card isolation | MATCHED | PrimitiveContainer 默认 card exact class 未变；admin layout test 只允许 AdminLogin 显式 elevated |
| surface-dismiss native/browser 双入口 | MATCHED | primitive test 分别核对 `onTouchEnd` 与 browser `onClick`；AdminLogin owner test 核对两处传递 |
| 单一 input owner | MATCHED | AdminLogin 仍只读 field value、调用既有 `field.focus()`，primitive 无 state/controller |
| 两个 integration theme | MATCHED | 三个新 token 的 CSS/Tailwind mapping 与两个主题 focus 差异 test |
| 既有 auth/failure/close/debug 行为 | MATCHED | sample-console 现有 assembly/admin tests 全绿 |
| package boundary / no business scope drift | MATCHED | static readback 与 terminal static PASS |
| Web / Android / device / visual | OPEN | 本轮没有启动对应 runtime；不得由 focused/static 代替 |
| independent fresh DESIGN review | OPEN | 按 Claude 复评要求保留 `OPEN_NOT_RUN_IN_THIS_TURN`，没有冒充已完成 |

逐代码与详设对账：`MATCHED`（本结果是主 agent 的逐行 readback，不等同于 Claude implementation review）。

## 实际 red mutation

- 将 `PrimitiveContainer` 的 elevated recipe 改成所有 `layout="card"` 自动追加：`ui-base-primitives` test 以默认 card class 多出 `bg-surface-elevated shadow-lg` 首败，随后恢复并重验 `17/17`。
- 将 `sample-console` 的 `focus` 改成与 `sample-wallpaper-console` 相同：sample-console theme test 的 focus 差异断言首败，随后恢复并重验 `44/44`。
- 删除 `PrimitivePinInput` 的事件透传：primitive test 的 native `onTouchEnd` 断言首败，随后恢复并重验 `17/17`；同一实现保留 browser `onClick` 分支。

以上是验证判据的真实反变异记录，不是 production 交付状态；正式源码已恢复为详设规定的形态。
