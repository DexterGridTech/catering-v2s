# TER 固定逻辑画布 CP-0A 第 2 轮独立复核输入清单

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-0A
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_REQUIRED=true
MAIN_SESSION_FRESH=false

本轮是同一 CP-0A cycle 的定向第 2 轮，也是该 cycle 的最后一轮；不得召集第 3 轮。
审查者必须在形成判断前只读打开当前文件与列出的源码/文档，先证伪本轮处置是否真正闭合，
不得运行 Android、Web、DEV、seed、UAT 或部署，不得修改任何文件。不得把 CP-0 尚未运行
或既有设备日志写成 CP-0A 的证明。

## 必读输入

| 输入 | 路径 | 核查目的 |
| --- | --- | --- |
| 入口与边界 | `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md` | 只读、主 agent 写入、CP 顺序与证据边界 |
| 详设与计划 | `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md`、`doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md` | 核对 S-1/S-2/S-3 处置、CP-1/CP-3 后续闭合点与 Web/portrait OPEN |
| 旧实施计划 | `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-plan-codex.md` | 核对 `HISTORICAL_SUPERSEDED`、superseding plan、旧 Web policy 不再是当前有效输入 |
| CP-0A 证据 | `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md` | 核对 round1 finding、残留命中分类、CP-0A 状态没有冒充运行证据 |
| 残留源码 | `apps/terminal/kernel/base/platform-ports/test/startupDiagnostics.dev.test.ts`、`apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts`、`apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx`、`apps/terminal/ui/base/input/test/keyboardHeight.test.ts`、`apps/terminal/ui/integration/sample-console`、`apps/terminal/ui/base/dev-host` | 核对每个旧尺寸命中都有明确后续 CP 分类，且没有遗漏当前有效的第二套基线 |

## 定向证伪问题

1. 旧 `2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-plan-codex.md` 是否
   已明确是历史 superseded；其 §6.2 的 `scaleToFit=true`、uniform preview scale 与旧 shape
   是否明确不得作为当前实现指令；当前 Web policy 是否仍是 OPEN。
2. `apps/terminal` 的旧尺寸命中是否逐项登记为 CP-1/CP-3 后续分类，而不是用“不在三包”
   作为漏扫理由。特别核对 staff-auth 的 PRIMARY、member-desk 的 SECONDARY/PRIMARY、
   platform-ports 的 synthetic startup payload，以及 input 的平台无关 fixture。
3. CP-1 的“全部源码与入口”是否包含 `sample-console/src/index.ts` 与
   `sample-console/test-expo/App.tsx`，并且新增的直接业务 fixture 不会在计划中失去归属。
4. `CP-0A_STATUS` 是否仍为 OPEN，是否明确 CP-0 的 P-01 至 P-05、编译、Web/Android
   运行尚未取证；是否错误地把静态 `MATCHED` 写成整体 CP-0 PASS。
5. 是否出现未经授权的公共 TS 契约、第二 bridge、fallback、兼容层或 CP-0A 后提前实施。

## 输出约束

只对 CP-0A 给 `MATCHED` 或 `OPEN`，每条 finding 标注
`CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`。报告必须声明：

```text
REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
```

## Blind-review declaration

I will form a fresh, read-only, falsification-first judgment from the frozen inputs and current
bytes before relying on the author's disposition. I will not modify files or run dynamic checks.
