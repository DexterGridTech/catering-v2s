# TER 固定逻辑画布设计独立盲审报告（第二轮）

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_20260908
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
blindReviewDeclaration=审查者在读取第二轮清单后重新打开原始需求、项目记忆、当前源码与当前详设/计划，以证伪为立场核验第一轮修复；未修改文件，未运行构建、测试、设备、浏览器或动态 probe。

## 独立结论

VERDICT=GO
M=0 / S=0 / N=0

本轮真实盲审结论：第一轮提出的设计缺口已在 2026-09-08 详设与实施计划中闭合；剩余项目是后续 CP-0/CP-7 必须采集的动态、设备与 Web 证据，不是当前设计缺陷。不得把本报告写成这些动态证据已经通过。

## 定向核验

- CP-0A 已真正前置：计划明确它是 CP-0 前的材料前置，任何代码变更、测试基线更新或运行 probe 前必须完成；出口要求旧材料只剩 superseded 或新语义，否则不进入 CP-0。
- 1280×800 / 1280×720 的权威链已明确：详设记录来源为 Dexter 2026-09-08 最新裁定，旧 1157×723 / 962×541 被退役并标为待同步材料；CP-0 仍要求实际设备/模拟器记录，未把裁定数字伪装成运行事实。
- portrait OPEN 一致：详设明确没有可核验硬件 profile，不转置横屏数字；F 只有在 Dexter 确认 profile 后才可完成。计划不拿 landscape manifest 当竖屏证据。
- previewViewportRect owner 已补足：owner 是 dev-host SurfaceCanvas 内部无 border 的 preview-viewport 节点，排除 canvas border、stage padding、surface gap，并要求正常/短高 viewport 记录 rect、可用宽高和 scale。
- P-01 至 P-05 是硬门：计划要求五项原始记录，包含 fresh/session、surfaceKey、display/window identity、scaleX/scaleY、原始输出路径和 MATCHED/OPEN；任一不成立即 IMPLEMENTATION_NOT_READY，不进入 CP-1。
- 依赖方向成立：设计禁止扩展 DevicePort/PlatformPortBindings、第二 React host、第二单位系统或向 input 下发 scale；adapter → JS source → render host → assembly → input/business 的边界保持清楚。
- 未运行证据边界清楚：计划区分 static/focused/Web/Android，CP-7 才允许生产/端到端证据；预期数字不得写成运行结果。

## 第一轮 finding 处置核验

| finding | 本轮状态 | 核验结论 |
| --- | --- | --- |
| F1 portrait scope | REJECTED_WITH_EVIDENCE | portrait 未被伪造为完成，profile 缺失时保持 OPEN；后续需要 Dexter profile，但不是本轮设计缺陷。 |
| F2 1280 数字来源 | REJECTED_WITH_EVIDENCE | 详设记录 Dexter 2026-09-08 裁定，并要求 CP-0 另证运行事实。 |
| F3 旧材料并存 | REJECTED_WITH_EVIDENCE | CP-0A 已前置为 supersede/sync 门，旧材料不能与新画布并存进入代码。 |
| F4 Web viewport owner | REJECTED_WITH_EVIDENCE | owner、排除规则、短高 fixture 已落位。 |
| F5 RN public path / measure / PixelUtil | REJECTED_WITH_EVIDENCE | 仍是 CP-0 动态硬门，停机条件明确，没有把设计写成已证事实。 |
| F6/F7/F8 | REJECTED_WITH_EVIDENCE | 未引入 DevicePort 扩张；IME 除 scaleY 与 scroll 坐标风险均被硬门覆盖。 |
| F9 red fixture 假绿风险 | REJECTED_WITH_EVIDENCE | P-01 至 P-05、H-01 至 H-08、CP-7 证据分层阻止静态/模型证据冒充动态事实。 |

## 未验证边界

L3_UNVERIFIED：后续 CP-0/CP-7 的 Android/Web/RN 真实 probe、tap、scroll、DisplayMetrics、cleanup 证据均未运行；它们是实施前/实施期 OPEN，不阻断本设计 GO，也不得在后续报告中写成已通过。

SAME_ROOT_SCAN：scope、数值来源、旧基线同步、Web viewport owner、RN public path、DevicePort/IME/scroll/red fixture 九类同族风险已逐项复核，未发现新的同族设计 finding。

EVIDENCE_TIER=static design/source review only
DYNAMIC_EVIDENCE=NOT_RUN_BY_BOUNDARY
