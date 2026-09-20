# TER 虚拟键盘视觉设计 · fresh 独立 DESIGN review round 2

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_TERMINAL_INPUT_KEYBOARD_VISUAL_DESIGN_2026-09-19
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER_KIND=INDEPENDENT_SUBAGENT
BLIND_REVIEW=true
EVIDENCE_TIER=STATIC_SOURCE_AND_DESIGN_READBACK_ONLY
VERDICT=NO-GO
M/S/N=0/1/1
```

本轮由 fresh 只读独立审查 agent 定向复核 round-1 处置后的当前详设、计划、粒度清单、
IA 与 owning source；未修改仓库，未运行构建、测试、Web、Android、设备、Git。

## Findings

### S-01 · comparator 的 exact RGBA 合同此前未闭合

此前详设要求记录 `exact RGBA mismatch count`、最大通道差和 geometry，但计划直接复用
现有 `tools/terminal-image-compare/compare.mjs`，该工具当前只输出阈值化 RGB 指标：
`changedFraction`、`P95`、`meanAbsDiff`、`changedCellFraction`，且 `pixelDelta` 不比较
alpha channel。

处置：当前详设与计划把 keyboard metadata 的 `comparisonMode=exact-rgba` 写成既有工具的
新增分支，保留旧 `legacy-threshold` 调用方；CP-0 必须扩展工具并补 exact 分支 red test，
输出 `exactRgbaMismatchCount`、`maxChannelDiff`、`alphaMismatchCount` 与 geometry
readback。若实施后该工具扩展不能满足契约，CP-0/CP-5 必须保持 `OPEN`。

### N-01 · 计划头部历史来源命名

计划头部原来把 2026-09-06 旧需求写成 `IA_SOURCE`，虽然正文已经正确将最新 IA 图设为
视觉正本，但元数据容易误导。

处置：当前计划改为 `HISTORICAL_REQUIREMENTS_SOURCE`，`IA_ASSET` 保留为 approved IA
来源；粒度清单同步改为 `historicalRequirementsSource`。

## Round-2 targeted result

round-1 的 numeric 优先级、mobile inset 隔离、alpha CAPS inventory、selected modifier
consumer、Web/native event proof、theme owner、renderer 热路径与 no-performance-claim
均已被 round-2 复核为关闭。round-2 的 S-01 已由主 agent 修入当前详设/计划，N-01 已修正
命名。由于 DESIGN cycle 的两轮上限已用完，本文件保留 round-2 原始 `NO-GO`，不将文档
修订伪装成独立 GO；Claude DESIGN review 仍需独立作出结论。
