# TER UI 业务包可读性重构 · DESIGN review Round 1 input

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_MODE=FRESH_BLIND_ADVERSARIAL
AUTHOR_AUTHORITY=只写文档；不实施源码、不改测试/依赖/脚本、不启动 runtime

## 1. reviewer 任务

这是 implementation-facing 详设和实施计划的第一轮独立对抗审查。reviewer 必须只读，
不得写入任何仓库文件、不得运行会改变状态的命令、不得启动 Web/Metro/Android/native/
device/DEV/L2/UAT。

先不接受作者的结论，先以证伪为立场形成自己的风险假设，再逐条打开下列材料核验：

1. 目录方案是否真的实现“laptop 一个目录、mobile 一个目录、通用 component 留在
   common”，而不是换名、复制或保留默认 laptop wrapper；
2. 14 logical part、28 paired renderer、14 old wrapper、3 common 的分母是否与当前
   源码字节一致；
3. hook 拆分是否会改变 selector、command、requestId、busy、rejection、clear-password、
   pending race、wallpaper write phase 或日志边界；
4. base 抽取是否满足至少两个真实消费者且不反向知道 feature 业务；是否有更小的替代；
5. integration parser/startup/state-sync 的抽取是否保留 package.json、errorPrefix、
   startup owner、sync slice、theme、asset、placement 和 app-specific facts；
6. “旧代码不得残留”是否可逐文件、逐符号、逐 import/export、逐重复事实地证伪；
7. IA/interaction/wallpaper 正本是否保持所有 visible fields、surface、partKey、mode、
   copy、action、failure layer、scroll ancestor、testID 和双端差异；
8. 计划中的 CP gate、三维对账、逐代码与详设对账、focused red mutation 和证据分档
   是否可执行而不是泛化承诺；
9. 是否存在遗漏文件、错误路径、同名重写语义不清、测试映射不存在、旧 alias 仍需
   兼容、public export 未收口或把后续 implementation review 误当本轮 DESIGN review。

输出必须包含：

- REVIEW_TARGET、REVIEW_CYCLE_ID、REVIEW_ROUND、REVIEW_ROUND_LIMIT、reviewerKind；
- 输入清单和“先证伪后对照”的盲审声明；
- 每条 finding 的 classification：
  CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、
  UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION；
- 精确到文档章节和源码路径/符号的证据；
- severity M/S/N，说明是否阻止下一轮；
- 更小替代和影响面；
- 总体 VERDICT=GO、GO_WITH_OPEN 或 NO-GO 及 M/S/N。

不得因为作者已经写了“完成条件”就默认满足；不得以 testID/import existence 替代
形态、owner、失败和旧代码残留核验。

## 2. 必读仓库入口与规范

- AGENTS.md
- PLATFORM-BLUEPRINT.md
- doc/platform/README.md
- doc/platform/roadmap-program-registry.json
- 当前显式 program 的 Roadmap 授权字段
- project-memory/index.md
- 本任务六维路由命中的全部 project-memory 原文，至少包括 deterministic-context-only、
  前端 shared foundation、目录/命名、独立 review、日志与验证边界
- scripts/README.md
- doc/platform/frontend-coding-standard.md
- .agents/skills/cs-spec-to-plan/SKILL.md
- .agents/skills/cs-writing-plans/SKILL.md
- doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md

## 3. 本轮作者材料

- doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md
- doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md
- doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md
- doc/review/platform/2026-09-22-ter-ui-business-readability-requirements-review-round1-codex.md

requirements review 只作为历史输入，不能替代本轮对 implementation-facing 设计的
重新判断。

## 4. 原始正本与当前源码

可见行为正本：

- doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md
- doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md
- doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-ia-design-codex.md

必须独立核对的源码范围：

- apps/terminal/ui/feature/sample-member-desk/src
- apps/terminal/ui/feature/sample-staff-auth/src
- apps/terminal/ui/feature/sample-wallpaper-picker/src
- apps/terminal/ui/integration/sample-console/src
- apps/terminal/ui/integration/sample-wallpaper-console/src
- apps/terminal/ui/base/render/src
- apps/terminal/ui/base/render/test
- apps/terminal/ui/base/console-assembly/src
- apps/terminal/ui/base/console-assembly/test
- apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts
- 三个 feature、两个 integration、两个 base package 的 package.json、
  terminal-invariants.json、README 和现有 tests

重点符号和族：

- definePart、createRendererCatalog、selectPartsForSurfaceForm
- useRequest、useDispatchCommand、dispatchWithRequestId、requestOutcome
- useMemberDesk、useAuthNotices、useWallpaperPicker
- createStartupReadyActor、readTerminalSurfaces、surfaceFormForOrientation
- integration 内的 state sync reduce 和 package.json surface adapter
- ComponentType<any>、createFormPart、createPart、默认 laptop aliases
- WaitingLaptop、WelcomeLaptop、WallpaperBackground 内 wallpaper labels/catalog

## 5. 审查边界

本轮只审查文档设计和实施计划的可实施性、一致性、源码映射和保留行为，不实施任何
修复。发现问题时必须指出最小修法；不要扩大到 feature、登录、keyboard、power、
admin-shell 语义或新的 UI 产品设计。

reviewer 不得把未来 focused/typecheck 的计划写成已经通过，也不得把本轮 DESIGN verdict
写成 implementation PASS。STATIC、FOCUSED、WEB、ANDROID/NATIVE/DEVICE、VISUAL、
CLEANUP 必须按实际证据分别报告。
