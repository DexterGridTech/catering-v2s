# CP-2/CP-3 stage reconciliation · fresh Plato

REVIEW_TARGET=IMPLEMENTATION_STAGE_RECONCILIATION
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=Plato
REVIEW_SCOPE=CP-2 native/render implementation and CP-3 diagnostics/console implementation
REVIEW_MODE=FRESH_READ_ONLY_BLIND
DYNAMIC_BOUNDARY=NOT_RUN
VERDICT=PARTIAL_NO_GO_FOR_UNQUALIFIED_MATCHED
ACTIVE_M_S_N=1/2/1

## 结论

- CP-2：PARTIAL。B2 static/focused 支持当前为绿，但在 native/release U8 evidence 出现前不能标为无条件 `MATCHED`。
- CP-3：OPEN。sample2 生产启动 surface diagnostics 缺少 tracker 要求的 `kind` 字段。

## 输入与可复核命令

本轮先读当前源码，再对照既有作者/评审材料；只读，没有动态执行。输入包括 AGENTS、平台蓝图、平台 README、Roadmap、project-memory、scripts README、终端规范/架构/验证治理、v3.6 需求、当前详设/计划，以及 CP-2/CP-3 源码与 evidence。

fresh safe commands：

- `yarn --cwd apps/terminal verify:static`：PASS，`TERMINAL_STATIC=PASS`。
- `node tools/terminal-sample2/check-native-projection.mjs`：PASS。
- `node tools/terminal-sample2/check-native-projection.test.mjs`：PASS，native projection red mutations 与 cleanup PASS。
- `node tools/terminal-sample2/check-startup-diagnostics.mjs`：PASS，duplicate guard、surface identity、run ID propagation red checks PASS。
- `node tools/terminal-sample2/check-production-bundle.test.mjs`：PASS，automation/U13 injection token red checks PASS。
- `node tools/terminal-sample2/check-behavior.mjs`：PASS，sample2 focused baseline/red controls PASS。
- relevant package tests/typechecks：platform-ports 18 passed/1 skipped；console-assembly 3 passed；render 49 passed；sample-console 35 passed；sample-wallpaper-console 13 passed；picker 14 passed；B2/B3/U13 typecheck exit 0。

## 首败、broken boundary、last known good

首个发现的当前字节失败：

- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:92-130` 写入 `startup.surfaces.declared` 与 `startup.surfaces.measured`，其 `data` 缺少 `kind: 'declared'` / `kind: 'measured'`。

broken boundary：

- `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts:100-113` 只接受 `kind` 为 `declared` 或 `measured` 才记录 surface；因此 sample2 日志虽然有事件名，当前 tracker 不会把它计入完整性。

last known good comparator：

- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:116-156` 已提供这两个 kind 字段。
- B2 native source/projection：MainActivity 在 `super.onCreate(null)` 前调用 `SplashScreenManager.registerOnActivity(this)`，主题包含 `Theme.SplashScreen` 与 `postSplashScreenTheme`，projection checker 通过。

## Finding

### M-1 · CONFIRMED

sample2 startup surface producer 与 tracker contract 不完整，阻断 CP-3 U3/U4 的完整匹配。

复现：

```bash
rg -n "kind: 'declared'|kind: 'measured'|category: 'startup.surfaces'|readSurfaceKind|recordStartupSuccess" \
  apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx \
  apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx \
  apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts

rg -n "startup\\.surfaces|startup\\.complete|startupRunId|kind" \
  tools/terminal-sample2/check-behavior.mjs \
  apps/terminal/ui/integration/sample-wallpaper-console/test \
  apps/terminal/ui/integration/sample-console/test
```

现已由主 Codex 在 sample2 两个 producer payload 中补齐 `kind`；focused test 的 vitest 配置将 `__DEV__` 定义为 false，故不把 dev-only logger 事件误报成已观察事实。修复后需重跑 sample2 package test、static/diagnostic checker，并在后续 CP-3 对账中重读 source 与 evidence。

### S-1 · PARTIALLY_CONFIRMED

CP-2 的 native source/projection 与 focused 支持为绿，但 full CP-2 还需要 U8 release/mobile/dual cold-start timing evidence。当前未运行 Android/release/device，不能把 static/focused 提升为完整 native/release closure。

复现：

```bash
node tools/terminal-sample2/check-native-projection.mjs
node tools/terminal-sample2/check-native-projection.test.mjs
rg -n "U8|release|手机|双屏|OPEN_NATIVE_AND_RUNTIME|CP-2" \
  doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md \
  doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md
```

### S-2 · UNVERIFIED_REQUIRES_EVIDENCE

focused render tests cover host unavailable/fallback-not-ready,但本轮没有 native/release 证据证明 host snapshot 长期缺失时的终态失败路径。未在缺少动态证据时武断升级为代码 finding。

复现：

```bash
rg -n "splash-failure|surface-host-unavailable|runtime-failed|container-empty|missing-renderer|hideOnce|startup-ready" \
  apps/terminal/ui/base/render/src \
  apps/terminal/ui/base/render/test
```

### N-1 · PARTIALLY_CONFIRMED_SUPPORTING

TR-08/U13 seam 当前在 source/fixture 维度干净：生产 picker actor chain 是 UI dispatch → actor → kernel child → readback/classification → notice；test injection token 只在 test/和 checker fixture；production-bundle checker 的 red fixture 能抓 automation/U13 token。但还没有真实 release APK bundle scan。

复现：

```bash
rg -n "test\\.ui\\.sample-wallpaper-picker-failure-injection|ui\\.base\\.automation|TerminalAutomation|adbSocketDebugConfig|uiautomator|wrong-primary-display" \
  apps/terminal tools/terminal-sample2 -g '!node_modules'
node tools/terminal-sample2/check-production-bundle.test.mjs
```

## 未覆盖与风险

- 未运行 native Android build、release APK、production bundle scan、U8 设备冷启动、Web/Metro/DEV/seed/deploy/Computer Use。
- 当前 sample2 surface `kind` 缺口已被主 Codex修复，但该修复在新的 CP-3 fresh 对账前仍不能自封闭。
- 在 CP-3 动态前若 producer 仍缺 kind，日志看似存在但不会进入 surface completeness oracle。

