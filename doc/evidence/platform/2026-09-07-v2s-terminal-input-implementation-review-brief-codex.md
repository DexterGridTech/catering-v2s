# TER terminal input v2 implementation review brief

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TERMINAL_INPUT_V2_IMPLEMENTATION_2026-09-07
IMPLEMENTATION_SELF_GATE=PASS_STATIC_FOCUSED
CP5_RECONCILIATION=PASS_MATCHED_76_OPEN_0
CODE_TO_DESIGN_RECONCILIATION=MATCHED_68_OPEN_0
DELIVERY_TO_DEXTER_AND_CLAUDE=ALLOWED
```

## 给 Dexter 与 Claude 的审查请求

请以当前仓库 bytes 对照以下需求、详设、实施计划和证据，做 `REVIEW_TARGET=IMPLEMENTATION`
的独立静态 review，返回 `GO` 或 `NO-GO`，以及 `M/S/N` 数量。本文不是 Claude verdict，
只是交付前置证据与边界说明。

## 目标与范围

本批实现 TER `ui/base/input` 的本地 surface 测量、虚拟键盘四种布局、输入 owner 互斥、
焦点滚入可见区、原子输入快照，以及 sample-only 的 alpha/financial 能力验证字段。

本批不改变 App 的 landscape 锁定策略；input 只从自己的 `InputSurfaceFrame` 根 View 读取
`onLayout`，并消费既有 adapter 提供的 `imeInset` 平台事实。Android orientation、
Presentation 拓扑、host/VM/process、设备策略、Kiosk/Lock Task 与真实 POS 不在本批。

## 必读材料

- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-form-requirements-codex.md`
- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`
- `doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md`
- `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md`（S-30..S-39）
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md`
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-plan-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp0-boundary-audit-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp1-focused-and-reconciliation-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp2-focused-and-reconciliation-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp3-focused-and-reconciliation-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp4-focused-and-static-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp5-whole-batch-reconciliation-codex.md`
- `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp6-code-to-design-reconciliation-codex.md`

## 已实施的主要内容

### input base

- `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx`：真实 frame 根 View 的
  `onLayout`、首帧未测量、内容与键盘 sibling、unsupported recovery。
- `apps/terminal/ui/base/input/src/components/InputProvider.tsx`：local metrics、capacity、
  system/virtual owner、双向 none、LayerStack suspend/restore、原子 snapshot、complete/focus-next。
- `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx`：row/zone 布局、真实
  `PrimitiveButton`、稳定 region/key testID。
- `apps/terminal/ui/base/input/src/model/keyboardLayout.ts`：full、alpha、numeric、financial
  四种唯一行列数据源。
- `apps/terminal/ui/base/input/src/model/keyboardHeight.ts`：按轴容量公式、dense 32px 横向
  token、48px 纵向 hit target、270/320 dock 高度边界。
- `apps/terminal/ui/base/input/src/hooks/useInputField.ts` 与
  `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx`：共享 preflight、真实
  焦点、程序化 focus-next、收缩后滚入可见区及 no-ancestor no-op。
- `apps/terminal/ui/base/input/src/model/snapshot.ts`、`types.ts`、`index.ts`：同步冻结快照、
  token 注销、system 字段禁止 layout、删除 `InputSurfaceSize` 公共面。

### 共享与 sample 接缝

- `apps/terminal/ui/base/primitives/src/theme/tokens.ts` 与 `components.tsx`：新增经批准的
  `PrimitiveButton` `key`/`key-action` 呈现 variant；automation/testID/onPress 仍走原路径。
- `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`、`LayerStack.tsx`、
  `contexts/SurfaceFocusBoundaryContext.tsx`：保持 render→input 单向接缝，context 只传
  suspend/restore。
- `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx`：增加 alpha 与
  financial 两个 sample-only registry 字段；submit/cancel 仍只读 name/phone。
- `apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx` 与 actor：
  age 为可选 numeric、`maxLength=3`，确认时才进入业务命令，撤回/拒绝/迟到确认不留残值。
- `apps/terminal/ui/integration/sample-console/src/assembly.tsx`：只保留 InputSurfaceFrame
  与既有 `imeInset` 传递，不传静态 surface 尺寸。
- `apps/terminal/ui/base/dev-host/src/testExpoApp.tsx`：SurfaceCanvas 使用响应式、无
  transform 的交互树。

## CP 证据与独立对账

| CP | 结果 | 证据 |
| --- | --- | --- |
| CP-0 | PASS：input-only boundary audit | `doc/evidence/platform/2026-09-07-v2s-terminal-input-cp0-boundary-audit-codex.md` |
| CP-1 | fresh 独立对账 PASS，10 MATCHED / 0 OPEN | `...cp1-focused-and-reconciliation-codex.md` |
| CP-2 | fresh 独立对账 PASS，15 MATCHED / 0 OPEN | `...cp2-focused-and-reconciliation-codex.md` |
| CP-3 | fresh 独立对账 PASS，6 MATCHED / 0 OPEN | `...cp3-focused-and-reconciliation-codex.md` |
| CP-4 | fresh 独立对账 PASS，12 MATCHED / 0 OPEN | `...cp4-focused-and-static-codex.md` |
| CP-5 | fresh whole-batch PASS，76 MATCHED / 0 OPEN | `...cp5-whole-batch-reconciliation-codex.md` |
| CP-6 | fresh code↔design PASS，68 MATCHED / 0 OPEN | `...cp6-code-to-design-reconciliation-codex.md` |

CP-6 是独立交付闸门，不是 CP-5 的别名；68 行逐代码 ledger 已全部由 fresh reviewer
重新打开当前源码核对，结论只有 `MATCHED`，因此允许交 Dexter 与 Claude 做实施后 review。

## Fresh focused/typecheck 输出

当前 bytes fresh 复跑结果：

| package | typecheck | real tests |
| --- | --- | --- |
| `@catering-v2s/ui-base-input` | exit 0 | 8 files / 44 tests PASS |
| `@catering-v2s/ui-base-primitives` | exit 0 | 1 file / 8 tests PASS |
| `@catering-v2s/ui-base-render` | exit 0 | 8 files / 37 tests PASS |
| `@catering-v2s/ui-feature-sample-member-desk` | exit 0 | 1 file / 24 tests PASS |
| `@catering-v2s/ui-feature-sample-staff-auth` | exit 0 | 1 file / 7 tests PASS |
| `@catering-v2s/ui-integration-sample-console` | exit 0 | 6 files / 15 tests PASS |
| `@catering-v2s/ui-base-dev-host` | exit 0 | 3 files / 5 tests PASS |
| `@catering-v2s/kernel-feature-sample-member-registry` | exit 0 | 1 file / 9 tests PASS |

Static gates：

- `node tools/terminal-layering/check-static.mjs` → `TERMINAL_LAYERING=PASS`。
- `node tools/terminal-ui-render/check-static.mjs` → `TERMINAL_RENDER_STATIC=PASS`。
- `node tools/terminal-skeleton/verify-static.mjs` → `TERMINAL_STATIC=PASS`。
- primitives behavior：baseline PASS，theme-token mutation `mutation_exit=1`，cleanup PASS。
- render behavior：baseline 37 tests PASS，26 个 model red vectors 均预期非零，cleanup PASS。

model red vector 的 FAIL 是沙箱变异的证据，不是生产源码 FAIL；真实树结果与模型红结果已
分开记录。

## 未取证边界（不得在 review 中升级为已验）

- 未运行 Web `getBoundingClientRect`、`elementFromPoint` 或真实 pointer hit-region 观察。
- 未运行 Android 模拟器/真实设备副屏虚拟输入、竖屏设备、物理 DPI、厂商 ROM、性能或
  Presentation 行为验证。
- 未运行 PF-7 的 Expo Web/真实设备快速连打观察。因此 PF-1～PF-6 只能称为架构/聚焦保护，
  不能写成“UI 性能已达标”。
- 未声明真实 POS 硬件已验；所有设备边界仍是未取证。

## Review 结论格式

请返回：

```text
REVIEW_TARGET=IMPLEMENTATION
GO 或 NO-GO
M=<n>
S=<n>
N=<n>
逐条 finding：CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION
```

重点核验：local `onLayout` 是否真为唯一布局输入、owner/首击/complete 是否由行为证据
证明、S-30..S-39 尤其 S-38 三条 oracle、sample-only 是否污染业务、公共面与 `imeInset`
边界、Web/Android/PF-7 是否被误报，以及 CP-6 逐代码对账是否确实逐行 MATCHED。

授权边界：本 brief 授权范围内已完成源码与 focused/static 证据收集；后续 Web/Android/
真实 POS/PF-7 动态验证需另按计划和受管边界执行，不由本 brief 自动授权。
