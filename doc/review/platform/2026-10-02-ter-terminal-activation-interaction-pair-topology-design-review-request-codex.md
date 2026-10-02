# 终端激活交互与双机拓扑优化专项 · Claude 设计评审请求

## 背景

本专项已完成 Journey、IA、26 屏交互线框、implementation-facing 详设与实施计划。Dexter 已接受整体交互方向，不代表逐屏细节、实现或动态行为通过。内部 `REVIEW_TARGET=DESIGN` cycle 的第 1 轮流程不完整；第 2 轮独立复核对当时字节给出 `NO-GO, M/S/N=0/1/2`。唯一阻断 finding 是 Journey 缺 corpus 槽位、UI 工件缺模板 §1.1/§1.2 canonical 槽位。主 agent 已按第二轮最终 intake 最小修复，并修正交互工件和详设中 `SAMPLE-08-LMP` 的同根错误 TestId 交叉引用。

第 2 轮 review 针对修订前 SHA-256，不是对当前字节的 verdict。内部 DESIGN cycle 已到两轮上限，不再重开或增加第三轮。本请求是 Dexter 转交 Claude 的独立文档评审，不授权实现。

## 评审目标

请以当前仓库字节为准，独立判断本专项是否已形成可实施、可验收、无产品语义漂移的设计输入。重点检查 screen、actor、owner、command/selector、state/projection、测试执行面、实施 CP 和授权边界能否从正式需求贯通到计划；拒绝把任何静态设计、历史证据或用户对整体方向的接受升级成动态 PASS。

当前五份主要输入 SHA-256：

```text
doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md
  e9106f2dcb2dc1e8a12f0b2cac0e44b02aebb661a156a287895902b08e479256
doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md
  3244904f8be1c87f37a8ccf39257afe3137e1b9aae4b31746951f365d6ff986f
doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md
  d17aa25675defd95c57f9062142039b76c1511278b890a961f287d6b526b5a7f
doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md
  1f5d3e9499d0933e7df18f86451463d8af84d2ed9bafca4426b425c8b5fa2eb9
doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md
  929f15a43b26a0e586bf934e0c72cd1f02ebf96f7beb571d61348c42f23666e5
```

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`：仓规、授权与验证边界。
- `project-memory/index.md` 全部 kernel、`project-memory/decisions/deterministic-context-only.md`、六维路由命中的原文及 `project-memory/decisions/confirmed-business-language-corpus.md`：项目记忆、语汇命中及不得推导边界。
- `doc/platform/implementation-task-template.md`、`doc/platform/review-standard.md`、`doc/platform/third-party-library-usage-standard.md`、`doc/platform/terminal-coding-standard.md`：详设、评审、第三方库与 TER 规范。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md`：正式需求 R-01～R-16 与 V-01～V-20。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-discussion-claude.md`：需求讨论，尤其 §9 Dexter/用户原话。
- `doc/review/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-r1-codex.md`、`doc/review/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-intake-codex.md`：需求首轮 review 与 finding intake；只作为来源，不当作实现证据。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md`：Journey、actor 前提、corpus §5 与裁决范围。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md`：26 个 screen 的 IA 维度和跨文档对账。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md`：低保真 ASCII 线框、模板 §1.1/§1.2、逐屏控件/testId、surface、自查与未验证边界。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md`：方案比较、CP、owner/同步、机制、逐条需求和验收映射。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`：步骤、执行面、进入条件、验证顺序、对账与交付步骤。
- `doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-r1-report-codex.md`、`doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-intake-r1-codex.md`：第 1 轮过程不完整记录与包住址 finding 处置。
- `doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-r2-checklist-codex.md`、`doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-r2-report-codex.md`、`doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-intake-r2-codex.md`：第 2 轮输入身份、独立 verdict、模板 finding 和作者修复记录。
- `doc/decisions/templates/journey-decision-template.md`、`doc/decisions/templates/ia-design-template.md`、`doc/decisions/templates/ui-interaction-design-template.md`、`doc/decisions/templates/implementation-design-template.md`：四份适用模板。
- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`：独立 review、轮次上限和外部 Claude review 边界。
- 需求、详设指向的当前 owner 与组件源码：`apps/terminal/kernel/base/terminal-data-client`、`server-config`、`transport`、`topology`、`platform-ports`、`apps/terminal/ui/base/admin-shell`、两个 integration、`sample-staff-session`、`sample-member-registry`、`sample-wallpaper` 与相关 feature assembly/renderer。

## 独立核验重点

1. 主机/副机、MAIN/BRANCH、MMP/LMP/LMS/LSP 与承载设备是否区分清楚；所有 state、selector、command、同步、失效和失败路径是否有唯一 owner，是否出现由屏幕或缓存推权限的路径。
2. 8 位激活码、服务空间名称与 `serverSpaces`、URL 前缀/generated 后缀、代理密码 owner 与明文同步、凭证唯一 owner、副机只读、LSP 独立页与 LMS 主机投影是否忠实于正式需求和 Dexter 裁决。
3. 两个新 `ui/base` 呈现包、admin-shell、integration composition 和 sample feature 的依赖方向是否能按真实 package/API 组装；是否重复创建业务入口或 state/sync 机制。
4. 26 个 screen 的模板字段、单一 surface、用户可见文案位置、容器/滚动、控件与 TestId 提案是否互相匹配；R-01～R-16、V-01～V-20 是否逐条映射到可执行场景、执行面、业务断言和清理。检查 `SAMPLE-08-LMP` 当前 TestId 来源是否与 UI、详设同指 `SAMPLE-07` 的壁纸 picker 源。
5. Journey corpus §5 与 UI canonical §1.1/§1.2 的补齐是否正确且不过度扩展；核对 R2 finding 只针对修订前 hash，不能把第 2 轮的旧字节 verdict 移植为新字节 verdict。
6. 详设、实施计划是否维持设计授权：V-01～V-20、Expo Web、VM/device、adapter、business 与 cleanup 均是未来计划/`NOT_RUN`；L2 按理由标 N/A；没有源码、生成、构建、测试、DEV、reset/seed、UAT 或部署授权。

## 期望结论

请按当前字节给出明确 `GO` / `NO-GO` 与 `M/S/N`。每条 finding 请列精确仓库相对路径及章节/行号、事实与影响、最小可验收修正、是否需要 Dexter 产品裁决；区分确认事实、推论和未验证项。若某处只能在实施或动态环境证明，请标 `NOT_RUN`，不要据设计计划给 PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审《终端激活交互与双机拓扑优化专项》的完整设计包。

背景：本专项已完成 Journey、IA、26 屏低保真线框、implementation-facing 详设与实施计划。Dexter 已接受整体交互方向，不代表逐屏细节、实现或动态行为通过。内部 DESIGN cycle 第 2 轮对修订前字节的结论是 NO-GO，M/S/N=0/1/2；唯一 S 是 Journey 缺 corpus 模板槽位、UI 工件缺 §1.1/§1.2 canonical 槽位。主 agent 已按最终 finding intake 补齐模板槽位，并依当前 wallpaper picker TestId 源修正 UI 与详设中 SAMPLE-08-LMP 的错误交叉引用。R2 的 SHA-256 不等于当前字节；修订后的设计尚无独立 verdict。内部 cycle 已达两轮上限，不重开、不做第三轮；本次是经 Dexter 转交的 Claude 外部设计评审。

目标：请以当前仓库字节独立核验需求到 Journey/IA/线框/详设/计划的闭包、owner/command/selector 边界、四种拓扑语义、26 个 screen 与全部 R/V 验收映射、模板覆盖、实现可行性和授权边界。主动找反例；不要继承作者结论或把计划/历史/静态证据升级为动态 PASS。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md：仓规与授权边界。
- project-memory/index.md 全部 kernel、project-memory/decisions/deterministic-context-only.md、六维路由命中的适用原文、project-memory/decisions/confirmed-business-language-corpus.md：记忆和语汇正本。
- doc/platform/implementation-task-template.md、doc/platform/review-standard.md、doc/platform/third-party-library-usage-standard.md、doc/platform/terminal-coding-standard.md：适用设计、评审、依赖和终端规范。
- doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md：正式需求及 V-01～V-20。
- doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-discussion-claude.md §9、doc/review/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-r1-codex.md、doc/review/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-requirements-review-intake-codex.md：用户原话与需求评审来源。
- doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md：Journey 与 corpus §5。
- doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md：26 screen IA。
- doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md：ASCII线框、canonical §1.1/§1.2、26 screen 声明与 testId roster。
- doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md：方案、owner与CP详设、R/V逐条映射。
- doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md：实施步骤、验证顺序、进入条件和交付对账。
- doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-r1-report-codex.md、doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-intake-r1-codex.md、doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-r2-checklist-codex.md、doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-r2-report-codex.md、doc/review/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-intake-r2-codex.md：两轮内部 review 的输入边界、旧字节 verdict 与修复 intake。
- doc/decisions/templates/journey-decision-template.md、doc/decisions/templates/ia-design-template.md、doc/decisions/templates/ui-interaction-design-template.md、doc/decisions/templates/implementation-design-template.md、doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md：模板和审查治理。
- apps/terminal/kernel/base/terminal-data-client、server-config、transport、topology、platform-ports、apps/terminal/ui/base/admin-shell、两个 integration 及 sample-* owner/feature 源码：核对真实 API、owner 和可复用能力。

请重点独立核验：
1. 主副机、MAIN/BRANCH、MMP/LMP/LMS/LSP 与实际实例角色的区分，以及每项 state、selector、command、同步、失效与失败路径的唯一 owner。
2. 8 位激活码、serverSpaces/服务空间显示名称、URL前缀和generated后缀、代理密码 owner及同步、终端凭证唯一 owner、副机管理只读、LSP独立会员/壁纸及LMS主机投影是否与需求逐项一致。
3. 两个 ui/base 呈现包、admin-shell、integration assembly、sample feature 的真实依赖方向与已有复用依据；是否存在第二业务入口、事实副本或多余同步/恢复框架。
4. 26 个 screen 各自的模板字段、surface、线框可见项、用户文案、控件/testId映射、IA与详设对应关系；R-01～R-16和V-01～V-20是否全部有合适的场景id、执行面、业务断言和cleanup。
5. Journey corpus §5、UI §1.1/§1.2 的模板修复是否充分；SAMPLE-08-LMP 的当前 picker TestId 引用是否在 UI 与详设一致；R2 verdict 是否被正确限定为修订前 hash。
6. V-01～V-20、Expo Web/VM/device、adapter、business、cleanup 当前均为计划/NOT_RUN；本专项无实现与动态运行授权，Browser L2 为 N/A_WITH_REASON。

请给明确 GO 或 NO-GO 与 M/S/N。每条 finding 请给精确仓库相对路径和章节/行号、性质与证据、影响、最小可验收修正、是否需 Dexter 裁决；列明已核实事实和未验证项。

授权边界：本请求仅用于独立设计评审，不授权改需求或Journey产品语义，不授权源码/测试实施、依赖、生成、构建、测试、verify、DEV、reset/seed、L2、UAT、部署或批次外工作。任何实现或动态验证须等待后续明确授权。谢谢！
```
