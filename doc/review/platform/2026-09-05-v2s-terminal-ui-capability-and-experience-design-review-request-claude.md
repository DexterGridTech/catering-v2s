REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=NOT_APPLICABLE_RETIRED_CONTROL
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-independent-design-review.md

## 背景

本轮是 TER sample UI 能力建设专题的 implementation-facing 详设交付，不是实施授权。
需求与交互裁定已由 Dexter 2026-09-05 收口；本交付补齐四段设计、逐屏交互矩阵、
IA、owner/命令/失败恢复边界与分段实施计划。

本轮的第一性目标是让 `ui/base/primitives` 以 NativeWind + React Native Reusables
提供统一、必经、可寻址的控件路径，降低业务组件依赖人工注册 automation 的覆盖率衰减；
视觉不是本轮的独立目标。RNR 采用 copy-in，既有八项 primitive public contract 不变，
主题保留在 `ui/integration/<app>/theme/`，feature 侧不得泄漏 `className`。

独立对抗审查已按 `REVIEW_CYCLE_ID=TER-UI-DESIGN-20260905` 完成两轮；报告见
`doc/review/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-independent-design-review.md`。
四份设计工件当前可供静态 review，但实现准入仍被冻结输入文字闸门阻塞，且本交付不构成
生产代码、测试、依赖或运行授权。

## 评审目标

请独立确认：

1. 四段边界、依赖顺序、每段停止条件和 CP-1 至 CP-4 的可证伪验收是否能支撑后续实施；
2. 15 个 IA-ID 的 screen/layer、可见文案、布局、动作分母、testID、状态/失败恢复、
   owner 与 single/double surface 边界是否逐项一致；
3. layer semantic type=6 与正式 layer partKey=7 的双分母是否计算正确，
   `noticeDismissedCommand` 删除裁定是否比复用给 `system-notice` 更符合 owner 边界；
4. `CommandDispatchResult` 的 resolved non-completed 与 Promise rejection 是否均被分类，
   且业务失败不会重复升级为 system notice；
5. `useTrackedRequest.finish(requestId)` 的请求身份保护、loading 清理、失败观察命令、
   递归保护与日志脱敏是否形成一致的详设接缝；
6. §9 比例静态门保持 `DEXTER_DECISION`、未提前建门是否正确；
7. 设计工件状态是否正确区分“可静态 review”与“可进入实施”。

## 需阅读文件

- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-requirements-claude.md`：冻结需求正本；
- `doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md`：交互裁定与理由；
- `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md`：v13 受影响基线；
- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-ia-design-codex.md`：15 个 IA-ID 与不可见维度观察；
- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md`：逐屏 surface contract、动作、testID 与 mutation；
- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-implementation-design-codex.md`：owner、契约、失败分类、CP 详设；
- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-implementation-plan-codex.md`：四段实施顺序、停止条件、红向量与交付证据；
- `apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts`：现有 member-desk actor 的拒绝与 display API 事实；
- `apps/terminal/ui/base/render/src/hooks/useRequest.ts`：`useTrackedRequest` 的 requestId 生命周期；
- `apps/terminal/ui/base/render/src/hooks/useDispatchCommand.ts`：Promise rejection 日志与重新抛出边界；
- `apps/terminal/kernel/base/runtime/src/types/execution.ts`：`CommandDispatchResult` 状态契约；
- `doc/review/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-independent-design-review.md`：两轮独立审查与作者处置留痕。

## 独立核验重点

- 重新从正式 partKey 计数：既有 3 个 layer + discard-confirm 1 + withdraw-confirm 1 + 两个 feature-owned system-notice 2，确认 semantic type=6、partKey=7；不要被源文案“六个”带偏。
- 逐项核对 `sample.auth.system-notice` 与 `sample.desk.system-notice` 的 owner、开关命令、dismiss 行为和互不 import 约束；确认 member-desk 的 `noticeDismissedCommand` 删除不会误删 ui-state 通用 `closeLayerCommand` 或 auth 自有 dismissal。
- 复核单屏 customer reject：设计主体是 `reject → member-form + registry-notice → retry/abandon`，源交互文案仍登记为 source input gate；请判断这是必须先回改需求，还是允许以详设作为 superseding input。
- 复核系统失败不只看 Promise rejection：`CommandDispatchResult.status=error/timed-out/partial-failed` 与真正 reject 都必须可区分；已产生领域事件的认证/业务失败不能重复开 system notice；观察命令失败只能记录诊断，不能递归派发。
- 复核 loading 顺序与 `finish(requestId)` 的 stale completion 保护，确保失败观察不放进 finally，且不吞掉原 rejection。
- 复核四份文档的状态字段：它们现在应表达“READY_FOR_STATIC_REVIEW_WITH_*_INPUT_GATE”，同时保持 `IMPLEMENTATION_AUTHORITY=false` 与 `IMPLEMENTATION_ADMISSION=BLOCKED_BY_SOURCE_INPUT_GATE`。
- 复核 §9 比例门没有被详设或计划偷偷建 checker/red vector；模型 red mutation 与未来真实树 PASS 必须分开。
- 复核单屏没有 SECONDARY 隐藏列，所有“副屏回……”都落在 `hasSecondarySurface` 分支；主题仍 app-local；feature 生产源码不泄漏 `className`。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并给出 `M/S/N` 计数。每项 finding 请标注
`CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，给出仓根相对路径、精确行号、
影响面、最小修复建议，并区分需求/产品裁决与详设可自主修复项。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 TER sample UI 能力建设的 implementation-facing 详设、交互详设、IA 与实施计划。

背景：需求与交互裁定已由 Dexter 2026-09-05 收口。本轮只交付设计，不授权生产代码、测试、依赖、Android/Web 运行、DEV、seed、UAT 或部署。设计的第一性目标是由 ui/base/primitives 提供统一且必经的可寻址控件路径；RNR 为 copy-in，既有八项 primitive public contract 不变，主题只放 ui/integration/<app>/theme/，feature 生产源码不得出现 className。独立对抗审查已完成两轮，留痕在 doc/review/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-independent-design-review.md。

目标：请独立核验四段边界与停止条件、15 个 IA-ID 的逐屏/逐层交互矩阵、owner 与命令契约、system failure 的 resolved status 与 Promise rejection 双路径、useTrackedRequest 的 requestId 清理顺序、single/double surface 分支以及实施计划的红向量和证据边界。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-requirements-claude.md：冻结需求正本；
- doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md：交互裁定与理由；
- doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md：v13 受影响基线；
- doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-ia-design-codex.md：IA 与不可见维度观察；
- doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md：逐屏交互工件；
- doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-implementation-design-codex.md：implementation-facing 详设；
- doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-implementation-plan-codex.md：四段实施计划；
- apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts：拒绝链与 display owner 事实；
- apps/terminal/ui/base/render/src/hooks/useRequest.ts：requestId 生命周期；
- apps/terminal/ui/base/render/src/hooks/useDispatchCommand.ts：rejection 观察；
- apps/terminal/kernel/base/runtime/src/types/execution.ts：CommandDispatchResult 状态契约。

请重点独立核验：正式 layer partKey 是否应为 7（semantic type 为 6）；member-desk 的 noticeDismissedCommand 是否应删除而不复用给 system-notice；resolved error/timed-out/partial-failed 是否与 Promise reject 一样不静默且不递归；单屏 reject 的 source 文案与 owning actor 是否需要先由 Dexter 修正；以及四份工件是否正确区分 static-review readiness 与 implementation admission。§9 比例静态门仍是 DEXTER_DECISION，未授权前不得要求建门。

烦请给出明确 GO 或 NO-GO，并按 M/S/N 标注每条 finding，附精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：本轮只请求四份设计工件的静态 review；不授权任何源码、测试、依赖、Android/Web 运行、浏览器自动化、DEV、seed、UAT、部署或 §9 比例静态门实施。即使设计 GO，也不等于实施授权；CP-1 及后续步骤必须由 Dexter 另行授权。谢谢。
```
