# 终端激活交互与双机拓扑专项 · 外部复评补充 intake

```text
REVIEW_ORIGIN=DEXTER_RELAYED_EXTERNAL_REVIEW
SOURCE_REVIEW=doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-rereview-claude.md
SOURCE_VERDICT=NO-GO；M/S/N=0/1/1（仅绑定该评审列出的输入字节）
INTAKE_OWNER=CODEX_MAIN_AGENT
INTAKE_VERDICT=不构成独立复评；仅记录主agent对新增finding的核验与处置
EVIDENCE_TIER=原始需求/规范/当前IA与交互工件/owning source静态核验；无动态验证
DESIGN_CYCLE=沿用已关闭的内部DESIGN cycle；未重开、未增加轮次
```

## 1 · S-1：LMS承载与壁纸数据来源

**Classification：CONFIRMED。**

- 原始需求 R-09a `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md:224-234` 将“LMP有LMS时”的会员确认交给LMS；它没有把MMP/LMP本页确认归给LMS。R-09b `:236-` 规定LMS显示主机已确认壁纸、LSP保持本地独立壁纸。
- `doc/platform/terminal-coding-standard.md:951-966` 定义两个合法承载：单机LMS由MASTER+SECONDARY承载，双机LMS由SLAVE+VICE承载；双机LMS数据是主机内容投影。实际`instanceMode`不能由内容简称推导。
- 当前IA的SAMPLE-04/05行把LMS投影路径混入MMP/LMP本页确认规则；IA第3节原规则曾把LMS一概归为host同一runtime。UI工件SAMPLE-09-LMS曾把唯一入口固定为host runtime / PRIMARY同runtime selector。它们排除真实双机SLAVE+VICE反例，故finding成立。
- 当前owning source还显示壁纸slice使用`syncIntent: 'isolated'`：`apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts:30-44`。因此本轮只是将批准的双机host-confirmed projection写成正确设计输入；同步实现仍是后续CP工作，不能写成已有实现或测试通过。
- **影响**：按旧IA/UI实施会使双机VICE读错实例状态，或漏掉其host wallpaper投影来源；把LMS路径留在MMP/LMP则错误地改变本页确认责任。
- **最小修正**：IA分别限定SAMPLE-04 MMP本地host pending、SAMPLE-05 LMP无LMS本页确认及有LMS时转SAMPLE-06；SAMPLE-06写明MASTER+SECONDARY本地读取与SLAVE+VICE读取绑定当前peer的hostPendingProjection并显式回MASTER的两条形态。SAMPLE-09壁纸写明MASTER+SECONDARY同runtime host confirmed selector，以及SLAVE+VICE读取绑定当前peer的host-confirmed projection selector。IA总则列全MMP/LMP/LMS/LSP的内容承载与实例区别。UI SAMPLE-09同步双形态；不新增owner、协议、仲裁或同步框架。
- **更小替代**：只改SAMPLE-09技术边界而保留IA总则和SAMPLE-04/05旧路径，仍会让renderer筛选和确认路径互相矛盾，故不足以关闭同根问题。
- **处置**：已修订IA与UI交互工件；实现仍待CP-04/05，未执行测试。
- **Dexter裁决**：不需要；规范和需求已经给出两种承载及归属。

## 2 · N-1：当前testId与提案区分

**Classification：CONFIRMED。**

- 当前常量位于`apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperPickerTestIds.ts:3-12`，包含root、title、optionsScroll、options、confirm和由wallpaperId生成的option id；没有logout或exit。
- 交互工件SAMPLE-07汇总行把logout列入“当前常量”；SAMPLE-08列出exit/logout却没有标记为提案。控件定义正文将logout/exit标成未实现提案，是反例：该语义已有区分，但汇总行仍足以误导后续实现/绑定。
- **最小修正**：SAMPLE-07/08 roster分别列出现有源码常量与待新增的logout、exit；不改源码、不新增checker。
- **处置**：已修订交互工件的两条roster；回读当前常量确认边界，未运行动态测试。
- **更小替代**：只修一行会留下LMP设计提案被读成现有字面量的歧义，因此同步标注两行是最小完整修正。
- **Dexter裁决**：不需要。

## 3 · 修订范围与证据边界

本轮finding的最小修订涉及：

- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md`
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md`
- 本 intake 记录。

Journey和正式需求未修改。另将详设/计划顶部授权状态同步为当前Dexter授权；这不改变历史review输入字节边界或产品语义。原外部review和既有intake保留其历史字节与结论，不把作者处置冒充独立GO。当前产品授权进入实现；设计文字修正和源码实现仍是不同证据阶段。本文件不声称CP对账、全批6b、实现review、Web、VM/device、adapter、DEV业务或cleanup已通过。
