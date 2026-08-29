# TER 骨架批一详设与实施计划 · fresh 独立对抗审查 R1

```text
REVIEW_CYCLE_ID=TER_SKELETON_BATCH1_DESIGN_20260829
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/ter_batch1_design_review_r1
BLIND_REVIEW=true
VERDICT=NO-GO
M=0
S=3
N=1
```

本文件由主 agent 将 fresh reviewer 的最终消息机械转录入仓；未改写 verdict、severity 或 finding。
reviewer 角色为只读，因而没有自行写文件。

## 输入清单

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `CLAUDE.md`
- `doc/decisions/templates/implementation-design-template.md`
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md`
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-design-codex.md`
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-implementation-plan-codex.md`
- `doc/platform/terminal-coding-standard.md`
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`
- `project-memory/decisions/terminal-build-order-and-batches.md`
- `project-memory/operations/terminal-coding-standard.md`
- `package.json`
- `tools/verify-gates/verify.mjs`

## Reviewer verdict

**REJECT / NO-GO**

The plan is close, but executors would still have to guess around moving scaffold inputs, an unresolved Turbo
recursion branch, and a blocker that the requirements mark `UNVERIFIED` but the design re-labels `VERIFIED`
without repository evidence.

Clarity is mostly sound, but two execution paths still branch without a final command. Verifiability has a good
structure, but one upstream blocker is over-promoted. Package count/path graph is mostly reconciled; scaffold
reproducibility is not. The overall scheme is right-sized and does not form a second governance plane. Principle /
option consistency and alternatives depth pass; scaffold and Turbo verification rigor do not.

`NO_CORPUS_ENTRY_MATCHED`：`TER/terminal/skeleton/终端/骨架` 无 confirmed business corpus entry；`POS`
仅在 G-08/G-11 旁路语境命中，不是 TER 业务条目。

## Findings

### S-1 · `create-expo-module` 阻断被从 requirements 的 `UNVERIFIED` 提升成 design 的 `VERIFIED`

- Evidence：需求仍将完整可复跑闭包列作 adapter 动工前阻断；详设却把临时 scratch exit 0 与 raw closure
  写成 `VERIFIED`，计划也把它写成 baseline fact。
- Classification：`PARTIALLY_CONFIRMED`，仓内事实与外部 package 存在性已核。
- Falsifiable failure：实施跳过 CP-0 作为真实阻断，从没有仓内 artifact 的临时 scratch 声称直接进入
  CP-1/CP-4。
- Consequence：adapter 可能从不可复核或不可复跑的 scaffold 做规范化。
- Minimum fix：在 CP-0 产出仓内证据前降回 `UNVERIFIED_REQUIRES_EVIDENCE`；命令只作为候选。

### S-2 · assembly scaffold 仍使用移动的 `create-expo-app@latest`

- Evidence：需求固定 Expo `~57.0.18` 与 RN `0.86.3`，计划却使用 dist-tag `latest`；fresh npm readback
  当时为 `create-expo-app@latest=4.0.0`，但 dist-tag 仍会移动。
- Classification：`CONFIRMED` moving-input risk。
- Falsifiable failure：`latest` 或 template 推进后，产物不再是 SDK 57 形态。
- Consequence：批一可复跑性依赖 registry 时点。
- Minimum fix：固定 app CLI 与官方 template/source，并记录最终 SDK/RN 版本。

### S-3 · Turbo recursion 分支没有精确最终排除命令

- Evidence：详设和计划都说若聚合包进入自身任务就“显式排除”，但没有给出最终 script；当前仓也没有
  `turbo.json` 或现成 TER task 可供推导。
- Classification：`CONFIRMED` design gap。
- Falsifiable failure：dry-run 含 `@catering-v2s/terminal`，实施者选择不同排除语法或递归 script。
- Consequence：aggregate typecheck 递归，或静默漏包。
- Minimum fix：写死 fallback command/script 与两个分支的 dry-run JSON 判据。

### N-1 · implementation-design template 固定 metadata key 未原样保留

- Evidence：模板要求 `IMPLEMENTATION_AUTHORITY=false`；详设改成了
  `BATCH1_IMPLEMENTATION_AUTHORITY=true`。
- Minimum fix：恢复固定 key，另加 `BATCH1_IMPLEMENTATION_AUTHORIZED_BY=DEXTER_2026_08_29`。

## Stop condition

reviewer 已打开或按相关节过滤所有引用的 plan/source 路径，枚举 `doc/decisions` 标题，并模拟
CP-0、CP-1、CP-5、CP-6 的代表路径；达到本轮 stop condition。
