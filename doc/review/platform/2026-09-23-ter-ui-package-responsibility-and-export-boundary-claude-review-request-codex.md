# TER UI 包职责与公共导出边界：给 Claude 的诊断性设计评审请求

REVIEW_KIND=DESIGN_DIAGNOSTIC_HANDOFF
REVIEW_TARGET=DESIGN
DESIGN_REVIEW_ADMISSION=NO-GO
REVIEW_STATUS=READY_FOR_CLAUDE_DIAGNOSTIC_ONLY
IMPLEMENTATION_AUTHORITY=false
EVIDENCE_TIER=STATIC_SOURCE_READING_ONLY

## 背景

Dexter 要求厘清三个 TER UI feature、两个 integration 的职责和公共导出边界。Claude 对需求初稿曾给 `NO-GO, M/S/N=0/3/2`；Codex 已逐条回源修订需求，并形成详设及实施计划。Dexter 后来额外授权两轮 DESIGN 对抗审查。第一轮因必读 sourceRefs/模板缺口无效；第二轮虽然先报告内容 `GO,0/0/0`，但 reviewer 自查承认 verdict 前没有完成 DESIGN Action 1-B 的三类事实提取，最终也无效。两轮上限已满，**不能宣称设计独立审查 GO**。本交接是供 Claude 独立诊断设计内容及审查失效原因，不是用 Claude 取代缺失的有效前置门。

本批未实施，也未运行 focused、构建、Web、Metro、Android/native/device、visual 或 cleanup。`Q5`（并入旧 CP-3/CP-5 或另立）和所有仓外消费者继续 `OPEN`；任何 public export 删除/收窄均未获准。

## 评审目标

请 Claude 从原需求和当前真实源码独立判断：五包职责与 public API 方案是否解决 Dexter 的问题；逐符号、逐 export-map 子路径分母与消费者分类是否真实完整；旧计划第 97/231/350/360–362 行的删除判据是否被准确限定；实施计划的 CP-0 停机、五方原子合同、Android 宿主不可回退清单和行为红变异是否足够可执行。同时审查两轮无效记录，区分内容 finding 与方法缺口，不把静态阅读、结构检查或 Claude verdict 升格为实施授权。

## 需阅读文件

- `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md`：修订后需求与原始目标；
- `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md`：逐符号/路径分母、方案、停机条件；
- `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md`：CP、原子组、红变异及逐代码详设对账门；
- `doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-review-claude.md` 与 `doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-claude-intake-codex.md`：上一轮 finding 与作者处置；
- `doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-extra-round1-codex.md`、`doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-extra-round2-codex.md` 及相邻 `-input-checklist-codex.md`：额外两轮的无效原因和真实读取清单；
- `doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/review-standard.md`：冲突基线、TER 规范和审查动作判据。

## 独立核验重点

1. 从五包 `src/index.ts` 与 `package.json exports` 重算 `6+6+16+20+23=71` 个 root 符号、`5+2=7` 个路径；不要以详设表自证分母。CSS `./theme/global.css` 两条非根路径和两个 Android `App.tsx`/`platformPorts.ts`/`dependencies.ts`/`metro.config.js` 消费不可漏。
2. 仓外消费者未知是否对**每项**保持 `OPEN`；没有任何收窄只凭仓内零命中；`Q5 DEXTER_DECISION=OPEN` 是否在两份计划间真正阻断并行互斥命令。
3. 五方 README/index/export-map/invariant/publicSurface 是否是同一原子变更；member/staff 尚无 publicSurface test 的事实是否写成未来补强而非已完成；CSS key/target deep equal 与 Android 真实 consumer 解析是否会在改错时红。
4. command owner、module identity、part metadata、失败/恢复、平台配置、双形态目录及 MemberForm alpha/financial sample 探针是否有可失败的不回退判据；dismissal helper 的 TR-01/TR-06 张力是否被限制在本批之外且未偷改 base。
5. 两轮 review 的失效是最小输入/Action 1-B 方法问题，还是掩盖了设计内容缺口；按 `doc/platform/review-standard.md` DESIGN 动作 1-B 独立列模板缺项、跨文档矛盾、无出处数值/形态三类事实。不要把审查文件自报 `0/0/0` 当独立依据。

## 期望结论

请分别给出内容层面的 `REVIEW_TARGET=DESIGN, VERDICT=GO|NO-GO, M/S/N=...` 与前置审查准入状态；每条 finding 写精确路径/行号、事实与推论、影响、最小修订、反例和是否需要 Dexter 裁决。即使内容层面 GO，也不得据此把两轮无效审查改写为有效、关闭 Q5/仓外 `OPEN`、授权实施或任何动态验证。是否另开有效审查 cycle 由 Dexter 决定。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER UI 五包职责与公共导出边界做一次独立、诊断性的 DESIGN 评审。

背景：你此前对需求初稿给出 NO-GO、M/S/N=0/3/2。Codex 修订需求并完成详设与实施计划。Dexter 额外授权的两轮子 agent 审查均因方法/输入缺口无效：第一轮缺适用 sourceRefs 和模板完整读取；第二轮没有在 blind verdict 前完成 DESIGN Action 1-B 的模板缺项、文档矛盾、无出处数值/形态三类事实提取。因此目前设计独立审查准入仍是 NO-GO，不能把内容观察 0/0/0 当作通过。

目标：请从原需求、TER 规范和当前源码独立判断方案本身是否合理、完整、可执行，并核实两轮失效是否遮住实质问题。请先形成自己的事实清单和判断，再看作者处置。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md
- doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md
- doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md
- doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-extra-round1-codex.md
- doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-extra-round2-codex.md
- doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-review-claude.md
- doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-claude-intake-codex.md
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md
- doc/platform/terminal-coding-standard.md 与 doc/platform/review-standard.md。

请重点独立核验：五包 71 个 root 导出及 7 个 export-map 路径是否与真实字节相符；两个 Android 宿主的 root 符号与 CSS 子路径消费是否完整；仓外消费者是否逐项保持 OPEN；旧计划 97/231/350/360–362 行与本计划 CP-0 是否无互斥执行；五方原子同步、key/target deep equal、行为不变和红变异是否真的可失败；MemberForm 探针和 dismissal helper 是否守住跨批/owner 边界。也请按 DESIGN Action 1-B 独立列出模板缺项、跨文档矛盾和无出处数值/形态，不依赖前两轮自报结果。

烦请分别给出设计内容的 REVIEW_TARGET=DESIGN、明确 GO 或 NO-GO、M/S/N 数量，以及独立审查准入状态。每项 finding 请列精确文件行号、影响、最小修复、反例/适用边界和是否需 Dexter 产品裁决。

授权边界：这是诊断性评审请求，不用 Claude 结果替代已失效的子 agent 前置门；不授权实施、public export 删除/收窄、构建/测试或 Web/Android 设备验证。Q5 与仓外消费者仍 OPEN，是否新增有效审查授权由 Dexter 决定。谢谢。
```
