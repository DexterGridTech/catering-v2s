# TER sample UI 能力与体验：独立设计对抗审查

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER-UI-DESIGN-20260905
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
BLIND_REVIEW=本文件由独立子 agent 只读审查；审查者未修改文件、未运行源码/测试/Android/Web/Git

## 输入清单

- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-requirements-claude.md`
- `doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md`
- `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md`
- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-ia-design-codex.md`
- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md`
- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-implementation-design-codex.md`
- `doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-implementation-plan-codex.md`
- `apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts`
- `apps/terminal/kernel/base/runtime/src/types/execution.ts`
- `apps/terminal/kernel/base/runtime/src/createCommandDispatcher.ts`

## Round 1

独立 reviewer 结论：`NO-GO · M=3 / S=2 / N=1`。

### 已处理的 finding

1. `M`：IA 的不可见维度只有属性描述，不能重新观察。已改为逐个 IA-ID 给出
   `[静态]`、`[focused]` 或 `[N/A_WITH_REASON]` 的最小可证伪观察。
2. `M`：交互工件缺少逐屏 surface contract、system observed/dismissed mutation、
   搜索分母与无 Heritage 对应物的登记。已补齐，并明确 `L2_SCRIPT_ADMISSION=BLOCKED`。
3. `M`：系统失败只覆盖 Promise rejection，漏掉 resolved
   `CommandDispatchResult.status !== completed`。已在 IA、详设与计划中补齐
   `error`、`timed-out`、`partial-failed` 与业务失败/系统失败的分类边界。
4. `S`：单屏 reject 去向与 owning actor 不一致。四份 Codex 工件的主体已统一为
   `reject → member-form + registry-notice → retry/abandon`，并保留源输入需要修文案的闸门。
5. `S`：L2 admission 误写成 ready。已统一为 `L2_SCRIPT_ADMISSION=BLOCKED`，
   本批只冻结 testID 身份，不授权浏览器自动化。
6. `N`：owner API 行错误使用 `resolveSurfaceDisplayMode`。已改为 actor 使用
   `readDisplayInfo / resolveSecondarySurfaceAvailable`，`resolveSurfaceDisplayMode`
   仅由 integration surface creation 使用。

## Round 2

独立 reviewer 结论：`NO-GO · M=1 / S=0 / N=0`。

唯一 finding：四份 Codex 工件的主体已经统一，但 completion/status 曾同时写成
`REVIEW_PENDING_INPUT_CORRECTION`，没有区分“可以交静态 review”和“可以进入实施”。
这会使执行者无法判断当前阻塞的是 review 交付还是实施准入。

证据位置：

- IA 工件原先的 `IA_STATUS` 与 completion；
- 交互工件原先的 `INTERACTION_STATUS` 与看图结论；
- 详设原先的 `DESIGN_STATUS` 与交付状态；
- 计划原先的 `PLAN_STATUS` 与 `NEXT_REQUIRED_DECISION`。

## 作者处置

该 finding 已按最小范围处置，未修改冻结需求、源码、依赖或运行环境：

- 四份工件统一改为 `READY_FOR_STATIC_REVIEW_WITH_*_INPUT_GATE`；
- 保留明确的 `SOURCE_INPUT_GATE` / `INPUT_CORRECTION_REQUIRED`，继续阻塞 CP-4
  与实施准入，不把设计 review readiness 冒充 implementation authorization；
- IA 的交叉对账将源输入问题标为 `SOURCE_INPUT_GATE`，不再使用含义过宽的
  `OPEN_INPUT_CORRECTION`；
- `IMPLEMENTATION_AUTHORITY=false` 与 `IMPLEMENTATION_ADMISSION=BLOCKED_BY_SOURCE_INPUT_GATE`
  保持不变；
- §9 比例静态门仍为 `DEXTER_DECISION`，未建 checker、未建 red vector。

本处置是第二轮完成后的作者收口，不是第三轮独立 review；不得把它表述为 reviewer
已经重新确认过修订后的状态字段。

## 仍显式保留的输入闸门

1. 交互源 §11.1/§12.1 写“层由三个增至六个”，但正式 partKey 同时包含
   `sample.auth.system-notice` 与 `sample.desk.system-notice`。详设按正式 partKey
   计算 semantic layer type 为 6、layer partKey 为 7；冻结输入文字修正前不得进入 CP-4。
2. 交互源仍有单屏 `reject→list` 的旧文案，而 owning actor 与详设主体要求
   `reject→member-form + registry-notice`，再由 `retry/abandon` 分流。该冲突保留为
   source input gate，未由实现阶段自行改写需求。
3. `noticeDismissedCommand` 的详设裁定是删除 member-desk 旧命令，不复用给
   `system-notice`；底层 `closeLayerCommand` 与 auth feature 自有 dismissal 不受影响。

## 当前设计包状态

本文件只证明两轮独立审查及作者处置留痕，不给四份设计工件追加独立 GO。
四份工件可交 Dexter/Claude 做静态 review；implementation admission 仍为 false，
CP-1/CP-4 以及后续实施必须遵守源输入闸门和 Dexter 另行授权。
