# TER 虚拟键盘正式需求：独立对抗审查第二轮

> 本文件由主 agent 转录独立 reviewer `01a0cd97-a43e-74e2-b9aa-3a8da13a03ed` 的 verdict 与 finding；不是主 agent 代写的 verdict。被审需求 SHA-256：`0fc5a2483e81dbe61673d87a58737be3098032d8ae6ee656f49095aa9045241c`。第二轮是本 cycle 的最终独立审查轮次。

## 独立 verdict

```text
REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_REQUIREMENTS_2026-09-23
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
ACTION_1_VARIANT=Action1-B
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=PASS_WITH_S1_REQUIREMENTS_GAP
L2_USER_VISIBLE=FAIL_REQUIREMENTS_AMBIGUITY_ON_SHIFT_FOCUS_SWITCH
L3_UNVERIFIED=Web/Android/device/动画/真实视觉/触控命中均未运行
SAME_ROOT_SCAN=旧宽度、CAPS、shrink、field placement、PIN、same/different layout 的同根冲突已扫描；Shift focus-switch 生命周期未闭合
DESIGN_GAPS=S-1
EVIDENCE_TIER=STATIC_SOURCE_REVIEW + REQUIREMENTS_DOC_REVIEW
```

## S-1 · 一次性 Shift 的焦点切换生命周期未冻结

reviewer 逐项指出：正式需求 VK-R03 原第 42 行要求下一次成功插入才消费 Shift，却未说 A 已 armed 后切到 B 或返回 A 时，Shift 清除、留在 A、还是转移到 B；VK-R07 原第 71–72 行只规定键盘与避让几何，§6 未列该语义。`useInputField.ts:28–33` 的现状是每字段 `editState`，`editText.ts:96–107` 的 Shift/complete 路径也不会在焦点转换时清理。三种解释会产生不同可见行为与验收 oracle。最小修订为在 VK-R03 与 AC-06/AC-08 明确焦点切换语义，并覆盖 A-Shift→B、A-Shift→B→A、maxLength 零插入反例。reviewer 的推荐选项为“每字段局部保留”或“任何焦点／scope 切换清除”，未代 Dexter 选择。

其余定向核查：窄宿主 `field` placement、scope 关闭、PIN 锚点／滚动、旧 shrink 正本优先级、Shift modifier 与异布局、A–D 与 Q1–Q6 均未发现新增 finding；动画位移上限与完整可见也未发现内在冲突。作者第一轮处置在 reviewer 形成独立 NO-GO 后才被读取；未改变其结论。

## 输入与盲审留痕

- 先按 `AGENTS.md` 启动顺序读入口、选定 Roadmap 授权字段、全部 kernel/命中 memory、原分析、旧需求/详设、owning source、审查规范，并自行形成 NO-GO；**其后**才读取第一轮 verdict 与作者处置。无写入、构建、测试或动态验证。
- 被审正本 `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md@0fc5a2483e81dbe61673d87a58737be3098032d8ae6ee656f49095aa9045241c`；分析稿 `@2e9ab88137099ae0559050a7e8ae566841fe0d8c9253344867a3ac3aa2cbddd9`。
- 原正本：2026-09-05 输入需求 `@da226a30bc519355a3c2182732b904dbf9a161ab916fe8da6e47b94c9aaa147d`；2026-09-06 键盘视觉 v2 `@f2f4868ceb291c792b01d23b373914b338cd027cf5c1bcef479fcf7ca5c6d74f`、surface 需求 `@cb38b009fe838a5ac11a260bf6d74fd5064c3b603d2d2130a9b798bd9f764469`；2026-09-19 视觉详设 `@67558141f0c006e33fc4ea8b5ee8ed6a3da903486c0faa9861853d58bba9d5c6`。
- 审查规范：`doc/platform/review-standard.md@6e12ca56b08bb8bd6f47506635986b02ea1de0b1d6753a1db09c5757792766e6`，独立审查治理 `@bb6b02257b1a1413480b7138d943972c6e189a651095eaddc8940684983d489e`；关键源码 `editText.ts@e531a0fc4abbbe642f9bc5bc6ecb7a5c0c2aff06934f6e1ce079ebd7b41cccfd`、`useInputField.ts@aed4c9d3f181d87c7acb1952dacfcef6ebd21eb5da3c5f334bd057a2d53ee444`。
- 后读作者材料：第一轮记录 `@bfdfc739b0c1c9dd1ef1f92de84d5a4a81e3940c75349b3a089eb29888706dd0`、作者处置 `@9fbf1b8dcede65b26cd4c42efe3516a3653e7d042c0805e99a69abd450617e77`。reviewer 明确不要求第三轮。
