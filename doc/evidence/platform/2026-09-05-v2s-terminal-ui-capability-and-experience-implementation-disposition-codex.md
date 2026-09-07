# TER sample UI 能力与体验实施复核处置

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=2026-09-05-v2s-terminal-ui-capability-and-experience
REVIEW_DISPOSITION=GO_M0_S0_N2
CURRENT_BATCH_ACTION=仅关闭 N-2；N-1 登记为下一批候选

## N-1：feature-local 重复下沉候选

状态：`NEXT_BATCH_CANDIDATE`，不是本批欠账，本批不改源码。

复核证据：

- `apps/terminal/ui/feature/sample-staff-auth/src/components/controls.tsx` 与
  `apps/terminal/ui/feature/sample-member-desk/src/components/controls.tsx` 当前逐字相同；
- 两个 feature 的 `src/components/requestOutcome.ts` 当前逐字相同；
- 两组代码均不含业务领域字段，满足“先在两个 feature 真实看见重复，再评估下沉”的候选条件；
- 当前仍保留 feature-local 形态，符合 J-1 的 feature 互不直接 import 边界。

下一批若处理，必须重新读取两份实际源码并单独裁定归属：

- `controls.tsx` 可评估下沉到 `ui/base/primitives`，下沉后的公共控件按约定使用
  `Primitive` 前缀；
- `requestOutcome.ts` 是依赖 `CommandDispatchResult` 的纯分类函数，应评估归入能承载该
  runtime 类型的共享 owner（更可能是 render），不得因为“重复”直接放入 primitives。

## N-2：`PrimitiveContainer.layout` 公共面记录

状态：`CLOSED_BY_README`。

`PrimitiveContainer` 的可选 `layout` 只表达呈现形态，默认 `fill` 保持原有
surface-filling 行为。本批已授权的公共面加法仅限这一可选字段；它不新增业务语义、业务
控件或 automation 后端，也不改变既有调用点的默认行为。该说明已写入
`apps/terminal/ui/base/primitives/README.md`。

## 保持不变的边界

- 不实现 N-1 的下沉；
- 不建立 §9 比例静态门；
- 不把模型红向量与真实树结果合并表述；
- 本处置不产生 Android、Web、UAT 或部署证据。
