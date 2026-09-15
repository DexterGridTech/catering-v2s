# CP-0/CP-1 stage reconciliation · fresh Dalton

REVIEW_TARGET=IMPLEMENTATION_STAGE_RECONCILIATION
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=Dalton
REVIEW_SCOPE=CP-0 static repair and CP-1 runtime/module/graph implementation
REVIEW_MODE=fresh blind three-dimensional reconciliation; read-only; no dynamic execution
VERDICT=PARTIAL
ACTIVE_M_S_N=1/0/0

## 结论

- CP-0：PASS。静态修复可复跑，先前 TR-R04 blocker 已关闭，platform-ports、ui-state、render inventory contract 相互一致。
- CP-1：NO-GO for stage admission。当前 static/red/model evidence 已可回放并通过，但 B0 的 sample2 frozen/full implementation acceptance 仍是明确入口阻断。

## 可复核证据

- `node tools/terminal-skeleton/verify-static.mjs`：exit 0；输出 `TERMINAL_STATIC=PASS`、`READABILITY_STATIC=PASS`、`TERMINAL_SKELETON_MODEL_TEST=PASS`、`TERMINAL_LAYERING=PASS`、`TERMINAL_PLATFORM_PORTS_STATIC=PASS`、`TERMINAL_UI_STATE_STATIC=PASS`、`TERMINAL_RENDER_STATIC=PASS`。
- `node tools/terminal-skeleton/check-static.test.mjs`：exit 0；覆盖 D-1 value/type/re-export/dynamic/require/import-equals/relative/root-config red mutation 及 model test。
- `node tools/terminal-layering/check-static.mjs`：exit 0。
- `yarn workspaces list --json`：exit 0；列出 terminal base/kernel/ui/assembly 及 sample-console、sample-wallpaper-console 等当前 workspace。
- `node tools/terminal-sample2/check-behavior.mjs`：exit 0；A2/A3/A5/A7/A9 focused red controls 与 cleanup 均通过。

## Findings

### M-1 · CONFIRMED

B0 sample2 frozen/full acceptance 仍未关闭，不能把当前 focused/static evidence 当作该前置条件。

依据：

- 需求 v3.6 §4.0 要求 sample2 implementation acceptance 与 terminal static baseline 均通过后才进入 B1–B4：`doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md:465`。
- 当前 B0 记录明确声明未证明 frozen sample2 implementation acceptance，并列出 Web、release、native-device、complete visual、complete A/F 仍 OPEN：`doc/evidence/platform/2026-09-15-v2s-terminal-sample-infrastructure-uplift/b0-sample2-focused-evidence.md:1`、`:57`。
- 旧 CP7 动态记录仍是 partial：`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-dynamic-evidence-codex.md:115`。
- `check-behavior` 只证明 focused behavior，不能代替上述冻结 acceptance 矩阵。

### 已证伪的旧问题

- `REJECTED_WITH_EVIDENCE`：TR-R04 仍阻断。当前 `WallpaperPicker.tsx` 的 `runAction` 已改为单一 object parameter，静态输出含 `MODEL_TR_R04=PASS`、`RULE_TR_R04=PASS`。
- `REJECTED_WITH_EVIDENCE`：platform-ports / ui-state / render inventory 当前并不 incoherent；各 checker 与 fresh static output 均通过。
- `REJECTED_WITH_EVIDENCE`：CP-1 skeleton red/model evidence 当前并非缺失或不可回放；fresh `check-static.test.mjs` 已通过。

## 首败、边界、last known good

- fresh replay 未观察到新的命令首败。
- 当前阻断不是静态 checker，而是缺少 full/frozen sample2 acceptance proof。
- broken boundary：B0 focused/static evidence 被要求支持一个需要更宽 sample2 acceptance 矩阵的前置条件。
- last known good：terminal static baseline 与 focused sample2 behavior 在 fresh replay 中均为 green。

## 未覆盖与风险

- 本轮按边界未运行 Web、Metro、DEV、Android、设备、seed、deploy 等动态动作。
- 尚无当前 artifact 证明 sample2 frozen/full acceptance 覆盖 Web/release/native-device/complete visual/complete A/F。
- 在该前置证据出现前把 CP-1 标成完全关闭，会把 focused/static green 与更宽的 B0 acceptance 混同。

