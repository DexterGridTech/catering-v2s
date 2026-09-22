# TER UI 业务包可读性重构 · DESIGN review closure

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
REVIEW_ROUND_LIMIT=2
FINAL_DESIGN_VERDICT=GO
FINAL_M/S/N=0/0/0
FINAL_DECISION=SELF_DECIDED_AFTER_ROUND_2
IMPLEMENTATION_AUTHORITY=false

## 1. 结果

详设、实施计划和 IA preservation reconciliation 已完成，并经过同一 DESIGN cycle
两轮 fresh 独立只读对抗审查：

| 轮次 | reviewer | verdict | M/S/N | 处置 |
| --- | --- | --- | --- | --- |
| Round 1 | fresh independent critic | NO-GO | 1/1/1 | 两个文档问题回源确认并做最小修订；分母 finding 以源码证据驳回 |
| Round 2 | 另一 fresh independent critic | GO | 0/0/0 active | 两项修订 MATCHED_AFTER_REPAIR；无新 finding；最终轮次已用完 |

Round 2 明确确认：
- tracked command 直接使用现有 kernel CommandDefinition；没有 execute/requestLabel 幽灵字段；
- SystemFailureNoticePresentation 冻结为 rootStyle、cardStyle、actionsOrientation、
  dismissButtonStyle 四项，并能表达六个当前 system notice renderer 的静态 profile；
- base 不知道 feature、operation、phase、laptop/mobile，不接任意 props spread；
- 14 logical part、28 paired renderer、14 wrapper、3 common 的当前字节分母真实；
- 旧 wrapper、suffix renderer、聚合 hook、part helper、默认 laptop alias、重复
  parser/startup/state-sync、模糊 public export 均被列入实施时必须关闭的负向 ledger；
- IA/interaction/wallpaper 可见事实、owner 和 integration adapter 边界没有被本轮设计
  改写。

## 2. 交付文档

- 需求文档：
  doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md
- IA 保持与对账：
  doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md
- implementation-facing 详设：
  doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md
- implementation plan：
  doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md
- Round 1 输入：
  doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-inputs-round1-codex.md
- Round 1 原文：
  doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-round1-codex.md
- Round 1 作者 intake：
  doc/review/platform/2026-09-22-ter-ui-business-readability-design-intake-round1-codex.md
- Round 2 输入：
  doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-inputs-round2-codex.md
- Round 2 原文：
  doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-round2-codex.md

## 3. 旧代码不得残留的实施闸门

详设 §15、计划 §2.2 和 §6 明确：旧代码残留不是 warning，而是 CP-5 OPEN。未来
实施必须逐项关闭：

1. 三个 feature 的 14 个无后缀 wrapper；
2. 28 个旧 Laptop/Mobile suffix renderer；
3. useMemberDesk、useAuthNotices 和旧 wallpaper 聚合内容；
4. createFormPart/createPart、ComponentType<any>、默认 laptop alias；
5. 两个 integration 的重复 surface parser、startup-ready actor、state-sync reduce；
6. WaitingLaptop/WelcomeLaptop 旧文件/import；
7. wallpaper 重复 labels/catalog、模糊 exports 和所有旧路径/import/token 引用；
8. README、package entry、terminal-invariants、tests 和 public exports 的迁移残留。

不得以 deprecated export、fallback wrapper、re-export、test-only alias、注释或改名
掩盖残留。当前文档阶段只冻结了判据，不能宣称这些源码残留已关闭。

## 4. 当前证据边界

本轮只做静态源码回源和 DESIGN review：

| 档位 | 状态 |
| --- | --- |
| static/source reconciliation | REVIEWED |
| focused/typecheck | NOT_RUN |
| Web/Metro | NOT_AUTHORIZED、NOT_RUN |
| Android/native/device | NOT_AUTHORIZED、NOT_RUN |
| visual | NOT_AUTHORIZED、NOT_RUN |
| DEV/L2/UAT | NOT_AUTHORIZED、NOT_RUN |
| cleanup | NOT_AUTHORIZED、NOT_RUN |
| 源码/测试/依赖/脚本/构建产物 | NOT_CHANGED |

因此 FINAL_DESIGN_VERDICT=GO 只表示“详设和实施计划已通过两轮 DESIGN review，
可进入后续实施授权/实施阶段”，不表示源码已实施、不表示旧代码残留已关闭、不表示
focused/typecheck/dynamic/visual/验收通过。

## 5. 后续边界

后续若 Dexter 另行授权实施，必须从计划 CP-0 开始，先冻结当前字节分母，再按 CP-1
至 CP-5 执行；每个 CP 结束进入下一 CP 前做 fresh 三维对账，CP-5 先做全批逐代码与
详设对账，再做 focused/typecheck/static。实施完成后另开 REVIEW_TARGET=IMPLEMENTATION
复核，不能复用本轮 DESIGN GO。
