# TER UI 业务包可读性重构 · DESIGN review Round 2 input

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_MODE=FRESH_TARGETED_ADVERSARIAL
AUTHOR_AUTHORITY=只写文档；不实施源码、不改测试/依赖/脚本、不启动 runtime

## 1. reviewer 任务

这是同一 DESIGN cycle 的第二轮也是最后一轮。必须使用 fresh 独立只读子 agent；不得
假定 Round 1 findings 已经正确，也不得把 Round 1 report 当成作者结论。先独立判断
修订是否真的消除了原 failure，再寻找新的反例。禁止修改任何文件、禁止运行会改变状态
的命令、禁止启动 Web/Metro/Android/native/device/DEV/L2/UAT。

Round 2 必须定向核验：

1. implementation-design §5.2 与 implementation-plan CP-2 的 useTrackedCommand
   精确 API 是否同口径，definition 是否明确复用现有 CommandDefinition，是否没有
   execute/requestLabel 的幽灵字段，diagnosticsLabel 是否被限制为中性机械字段；
2. implementation-design §5.3、§13 与 implementation-plan CP-2 的
   SystemFailureNoticePresentation 四项 exact shape 是否同口径；
3. rootStyle、cardStyle、actionsOrientation、dismissButtonStyle 是否足以表达当前
   六个 system notice renderer 的真实差异，且不会把 feature、operation、phase、
   laptop/mobile、token override 或任意 props spread 引入 base；
4. 六个 renderer 的 copy、testID、role、dismiss action、root/card/actions/button
   profile 是否逐项可回源；
5. Round 1 修订是否意外破坏 14/28/14/3 分母、旧代码不得残留 ledger、IA preservation、
   base owner boundary、integration adapter boundary 或计划的 CP gate；
6. 当前设计是否仍有未冻结的类型、错误路径、旧文件处置、测试映射或同名重写歧义；
7. 是否存在一个更小且更安全的替代，或必须明确交 Dexter 的产品/范围决策。

输出必须包含：

- REVIEW_TARGET=DESIGN、REVIEW_CYCLE_ID、REVIEW_ROUND=2、REVIEW_ROUND_LIMIT=2、
  ROUND_FINAL_DECISION=SELF_DECIDED、reviewerKind=INDEPENDENT_SUBAGENT；
- fresh 盲审声明和完整输入清单；
- 对 Round 1 两项 finding 的逐条状态：CONFIRMED、PARTIALLY_CONFIRMED、
  REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION；
- 新 finding 也必须精确到路径/章节/符号，包含 severity M/S/N、证据、最小修法和
  影响面；
- 总体 VERDICT=GO、GO_WITH_OPEN 或 NO-GO 与 M/S/N。

第二轮结束后不得召集第三轮。不要把设计结果写成源码实现、测试通过或验收通过。

## 2. 必读入口、记忆和规范

- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md
- doc/platform/roadmap-program-registry.json 及当前显式 Roadmap 授权字段
- project-memory/index.md 和本任务六维路由命中的原文
- scripts/README.md
- doc/platform/frontend-coding-standard.md
- .agents/skills/cs-spec-to-plan/SKILL.md
- .agents/skills/cs-writing-plans/SKILL.md
- doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md

## 3. 当前作者材料和 Round 1 处置

- doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md
- doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-round1-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-design-intake-round1-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-design-review-inputs-round1-codex.md

原始正本继续有效：

- doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md
- doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md
- doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-ia-design-codex.md
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md

## 4. Round 2 源码核验范围

- apps/terminal/kernel/base/runtime/src/types/command.ts
- apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx
- apps/terminal/ui/base/primitives/src/types/types.ts
- apps/terminal/ui/feature/sample-member-desk/src/components/DeskSystemNoticeLaptop.tsx
- apps/terminal/ui/feature/sample-member-desk/src/components/DeskSystemNoticeMobile.tsx
- apps/terminal/ui/feature/sample-staff-auth/src/components/AuthSystemNoticeLaptop.tsx
- apps/terminal/ui/feature/sample-staff-auth/src/components/AuthSystemNoticeMobile.tsx
- apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperSystemNoticeLaptop.tsx
- apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperSystemNoticeMobile.tsx
- apps/terminal/ui/feature/sample-member-desk/src/hooks/useMemberDesk.ts
- apps/terminal/ui/feature/sample-staff-auth/src/hooks/useStaffLogin.ts
- apps/terminal/ui/feature/sample-staff-auth/src/hooks/useAuthNotices.ts
- apps/terminal/ui/feature/sample-wallpaper-picker/src/hooks/useWallpaperPicker.ts
- 三个 feature 的 src/parts/parts.ts、package.json、terminal-invariants.json、test
- 两个 integration 的 application/terminalSurfaces.ts、application/module.ts、
  assembly/assembly.tsx、parts/parts.ts、package.json、terminal-invariants.json、test
- apps/terminal/ui/base/render/src/foundations/definePart.ts、
  src/hooks/useRequest.ts、src/foundations/dispatchWithRequestId.ts、
  src/foundations/requestOutcome.ts、terminal-invariants.json、test
- apps/terminal/ui/base/console-assembly/src、test、terminal-invariants.json

## 5. 证据边界

当前回合仍只做静态文档/源码审查；static、focused、Web、Android/native/device、
visual、cleanup 均不得虚报。作者在 Round 2 后不能再以 review 轮次替代后续实际
implementation review。
