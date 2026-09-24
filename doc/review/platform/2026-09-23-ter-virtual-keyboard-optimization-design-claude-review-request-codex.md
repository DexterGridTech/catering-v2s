# TER 程序虚拟键盘优化 DESIGN Claude 评审请求

> REVIEW_TARGET=DESIGN；REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23；独立第 1 轮 `NO-GO,M/S/N=1/1/1`，第 2 轮 `GO,M/S/N=0/0/1`；第 2 轮是本 cycle 上限轮，`ROUND_FINAL_DECISION=SELF_DECIDED`。这不是 Claude verdict，也不是实施授权。

## 背景

Claude 对正式需求旧字节曾判 `NO-GO,M/S/N=0/2/2`。Dexter 裁定异布局交接采用方案 (b)，并授权修订需求后连同交互设计、IA、详设、实施计划一并交审。本轮已修 S-1 的逐帧可见遮挡上限、S-2 的平移后按可见性触发内部滚动、N-1 的焦点会话定义；N-2 维持原稿口径。两轮 fresh 只读子 agent DESIGN 盲审及作者处置已记录；未改生产源码、测试或依赖，未做动态验证。

## 评审目标

请 Claude 独立判断需求修订是否确实解决旧评审反例，五份设计文档能否在不猜测 owner/API/几何的前提下指导后续实施，并在本轮完成交互设计的视觉审阅。尤其复算异布局交接逐帧路径、上/下缘裁切与 PIN 测量、URL 键位和容量边界，而不是沿用子 agent 的 GO。

## 需阅读文件

- `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-review-claude.md`：上轮独立反例与旧 verdict。
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md`：修订后的需求与 AC。
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md`：交互路径、低保真视觉与操作合理性。
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md`：20 个 IA 帧、逐键语义及视觉对照。
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md`：owner/API、遮挡时钟、滚动/PIN/容量详设。
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md`：CP-0–CP-4、红变异及逐代码—详设对账门。
- `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-round1-independent.md` 与 `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-round1-disposition-codex.md`：首轮 M/S/N 与回源修复。
- `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-round2-independent.md` 与 `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-round2-disposition-codex.md`：最终独立 verdict 与 Note 处置。

## 独立核验重点

1. 对 S-1(b) 重算 `246→190`、`190→246`、`246→246`：新键盘先从旧键盘下层上升、旧键盘再退出，`K(t)` 为当时实际可见遮挡，内容位移连续、单调且逐帧不超 `K(t)`；复核测量时机、owner 延迟提交和同布局不重弹。
2. 对 S-2 复算上缘裁切、未饱和下缘裁切、focus-next/程序化聚焦到屏外、字段过高：先按中心规则平移，若完整框仍不可见才在固定尺寸内部视口滚动；滚动不重复计入平移，既有上/下缘 scroll 能力未丢失。
3. 核查 full Shift 数字行的十个字符加 `@/#`，十二项均有键位、实际插入与返回路径；空插入不消耗 Shift。全宽、直角、五行外框的容量用最终渲染宽度、真实 padding/gap 计算，覆盖模型下不用退役的 208 常量作 oracle。
4. 复核 input→assembly→render 的 presentation bridge、固定 backdrop/遮罩、keyboard 高于弹窗的层序及命中边界；`nativeLess` PIN 的真实六格 anchor、同代测量与无 scroll capacity fail。请对当前 owning source 核对路径与 owner。
5. 审阅交互设计/IA 中四种键盘、普通页/弹窗/PIN、Shift、focus-next 的视觉与操作路径是否合理；`UNSET` 的视觉裁决请直接提出。20 帧、9 个生产字段、两套 integration 与 field harness 不得混算。
6. 区分设计证据与运行证据；本批没有源码实施或 Web/Android/device/visual/cleanup 结果。`NO_CORPUS_ENTRY_MATCHED` 不得被说成语料裁定键盘产品事实。

## 期望结论

请给 `REVIEW_TARGET=DESIGN` 的独立 `GO` 或 `NO-GO` 和 `M/S/N`；每项 finding 附精确路径/行号、事实与推论、影响、最小修订及是否需要 Dexter 产品裁决。设计 GO 只授权后续由 Dexter 决定是否实施，不代表源码或动态验收通过。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审 TER 程序虚拟键盘优化的需求修订、交互设计、IA、implementation-facing 详设与实施计划。

背景：您对正式需求旧字节曾给出 REVIEW_TARGET=DESIGN,VERDICT=NO-GO,M/S/N=0/2/2。Dexter 裁定 S-1 采用方案 (b)，授权修订需求后直接形成设计全套并一并送审。本轮修订了异布局交接逐帧遮挡上限、平移后以完整可见性触发内部滚动、virtual owner 焦点会话定义；N-2 维持原口径。Fresh 子 agent 第 1 轮为 NO-GO,M/S/N=1/1/1，修复 presentation bridge 与 PIN anchor 后第 2 轮为 GO,M/S/N=0/0/1；这是设计 verdict，不是运行结果。请不要沿用这些 verdict，独立复核当前字节。
目标：独立判断需求修订是否解决旧反例，并审查交互设计、IA、详设及计划能否无猜测地指导未来实施；本轮一并完成交互视觉与操作合理性审阅。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-review-claude.md：上轮反例；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md：修订需求与 AC；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md：低保真交互与本轮需审的视觉；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md：20 帧、逐键与可见状态；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md：owner、API、几何与失败边界；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md：CP、红变异、逐代码对账；
- doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-round1-independent.md 与 doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-round1-disposition-codex.md：第 1 轮及处置；
- doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-round2-independent.md 与 doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-round2-disposition-codex.md：第 2 轮及处置。

请重点独立核验：246→190、190→246、246→246 三种交接的逐帧可见遮挡 K、连续单调位移与上限；上缘裁切、未饱和下缘裁切、focus-next 到屏外字段的平移/滚动分工；十二个 URL 字符的键位、标签与实际插入/返回、零插入不消耗 Shift；最终外框宽度与真实 padding/gap 容量；input→assembly→render 的 exact presentation bridge、固定遮罩/弹窗和 nativeLess PIN 的真实测量锚点；20 IA 帧、9 个生产字段与两套 integration 的分母。请同时完成交互视觉与操作合理性审阅，核对文档引用的 owning source。业务语料没有键盘专项命中，不可假借其权威。

烦请给出 REVIEW_TARGET=DESIGN 的明确 GO 或 NO-GO 及 M/S/N。每项问题请附精确文件行号、事实/推论、影响面、最小修订建议，以及是否需 Dexter 产品裁决。

授权边界：本次仅需求、交互设计、IA、详设、实施计划及静态 DESIGN 审查；不进入实施，不改源码、测试、依赖或构建产物，不运行 Web、Metro、Android、设备验证。静态设计结论不等于动态或视觉运行通过。谢谢。
```
