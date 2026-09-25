REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-granularity-manifest-codex.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-adversarial-review-codex.md

## 背景

本轮交付单元是 TER 包布局整理 v5 的 implementation-facing 详设与实施计划。Dexter 已冻结并授权的范围为：
`apps/terminal/assembly` → `apps/terminal/application`、`ui/base/console-assembly` →
`ui/base/integration-assembly`、三个空壳包线下移出、`ui/base/test-support` 并回
`kernel/base/platform-ports`，以及 D-6 的 TER 产品 darkMode 语义删除。v5 的 PL-R00 至 PL-R05、AC-0 至
AC-13、D-1 至 D-6 均作为硬输入；本轮没有实施授权。

详设和计划已完成两轮 fresh 独立 DESIGN 盲审；该 DESIGN cycle 已到轮次上限，不重开第三轮。Claude 的后续
独立评审指出 7 处 implementation-facing 缺口（AC-10 匿名态/入口/JSON/readiness、AC-3 唯一 gate 与报文、
assembly 逐处分母、记忆同步分流、11 处 readability 目标、绝对路径、SECONDARY UI tree 读取）。本文件已按
当前源码逐条修订并回读；本次是 Claude 中转的 follow-up review，不改变原 DESIGN 盲审轮次。独立审查记录和
design-granularity manifest 仍随本 handoff 提供，作者状态为 `READY_FOR_CLAUDE_FOLLOWUP_REVIEW`。

## 评审目标

请独立确认详设和实施计划是否真正把 v5 的硬输入冻结为可执行、可证伪、可恢复的实施顺序，尤其确认：

- CP-0 先盘点 ignored 产物、再实跑三道门/全部子门并按根因修复；StaffLoginForm primitive、readability、harness、transport、darkMode 的文件集和行为边界是否具体；
- CP-1/2/3 的完整 file set、归档/恢复、锁文件“普通 install → allowed diff → immutable”协议、每步全部子门与逐步停门是否可执行；
- AC-2 的 active file list、正控制、PCRE、D-2 旧 console symbol 禁用集、`assembly` 语义逐处分类，以及 AC-8 共用的允许差异表是否能防止空过；
- AC-3 四处夹具换靶与三条新增 red mutation 是否指向具体 gate 和报文；
- AC-3 是否把 plannedDependencies 复用 AC-2(a) 的唯一 gate，且三条新增 mutation 分别断言 `p-5a-direction`/`SCAFFOLD_HYGIENE` 的固定报文；
- AC-8 snapshot、锚定 token、未登记改动 fail-closed；AC-9 ExpoModulesPackageList、APK dex、keystore/certificate 命令和期望值；
- AC-10 W-1/D-1、W-2/D-2 是否写死匿名态进入与确认步骤、两个 Web URL/双屏 testID 选择、与 `startupDiagnosticsWriter.ts:13-20` 一致的六布尔 groups/三布尔 readiness，以及 `getStartupReadiness` 的真实 owner；
- SECONDARY 是否使用 `uiautomator dump --windows` 后按 `<display id>` 分段、按仓内 parser 语义读取 testID→partKey，而不是未证实的 `--display`；
- AC-11 是否有覆盖当前 50 个代码 token 与全部 active prose 命中的逐行表；`terminal-build-order` 是否只追加取代条目，三份 active memory 是否直接改现状，`required-inventory.json` 是否手工同步而不是声称由 cli 生成；
- S-5 的 11 处 readability 是否各有目标参数对象/helper、既有测试与新增 focused 边界；所有命令和 archive root 是否不含本机绝对路径；
- AC-11 是否覆盖全部 active `doc/decisions/**`、AGENTS/CLAUDE、coding standard、skills、project-memory，且第 974 行 `src/assembly/` 目录词表保留；
- CP 级三维对账和最终“逐代码与详设对账”是否足以阻止任何 OPEN 进入后续 implementation review；TR-08 是否仍如实 OPEN/OUT_OF_SCOPE；
- 详设、计划与 v5 需求/方案是否存在遗漏、矛盾、无法运行的命令或未经 Dexter 裁定的产品/Journey 变化。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`：v5 正式需求、PL-R00 至 PL-R05、AC-0 至 AC-13、D-1 至 D-6；
- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`：已定稿方案、影响面、取舍与既有评审处置；
- `doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md`：本轮 implementation-facing 详设；
- `doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md`：本轮 CP-0 至 CP-4 实施顺序、命令、门和交付对账；
- `doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-granularity-manifest-codex.json`：CP 输入、输出、gate、证据路径和 OPEN 条件分母；
- `doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-adversarial-review-codex.md`：两轮 fresh 独立盲审、finding、证据与作者处置；
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/implementation-task-template.md`：仓库执行入口、TER 规范与计划边界；
- `project-memory/index.md` 及其路由命中的 `project-memory/operations/terminal-coding-standard.md`、`project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/decisions/terminal-build-order-and-batches.md`、`project-memory/practices/ter-input-and-virtual-keyboard-usage.md`：项目记忆约束；
- `doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-codex.md`、`doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-v4-codex.md`、`doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-intake-claude.md`：此前 Codex/Claude 评审与 v5 处置链。

## 独立核验重点

请以当前仓库字节重新核验，不把本 handoff 或作者的“已修订”描述当作事实。重点复验：

1. 详设/计划的 CP-0 当前 baseline 事实、命令与 root-cause 文件集；任何“已实跑”是否有真实源码/门输出支撑。
2. CP-1/2/3 每步是否有完整受控文件集、正确锁文件流程、预期 workspace-only diff，以及安装后同一套三道门和全部 AC-6 子门；CP-4 前置门是否只约束 CP-4 expensive stages，不形成自引用循环。
3. 四包 `.turbo` ignored 产物是否先被盘点，CP-0 精确清理和 CP-1 archive manifest/restore 是否不会遗漏、扩大或误删 `.runtime`/keystore/node_modules。
4. AC-2/AC-8/AC-11 是否同一分母；正控制命中数是否可重算；D-2 旧 Console symbol、`assembly` 语义反向控制、TR-08 automation token 和 darkMode guard 是否不会互相空过或误报。
5. AC-10 冻结的 `sample.auth.login`、`sample.wallpaper-console.waiting` 及 testID/source anchors 是否与 current `actors.ts`、`parts.ts`、component 真实字节一致；W-2 的 SECONDARY 证据是否确实通过 UI tree/testID→partKey，而不是臆造日志。
6. AC-9 的 ExpoModulesPackageList、APK dex、keystore hash 与 APK certificate digest 命令是否可执行并 fail closed；AC-13 是否没有把 TR-08 写成已关闭。
7. 最终逐代码与详设对账是否逐条覆盖源码、测试、README、index、exports、invariants、工具、runner、正本、memory、skill、lock、native/Expo 配置和 archive manifest，任一 OPEN 是否明确阻断交付。

## 期望结论

请给出 `REVIEW_TARGET=DESIGN`、`VERDICT=GO|NO-GO`、`M/S/N=x/y/z`。每条 finding 请带：级别、`CONFIRMED`/`PARTIALLY_CONFIRMED`/`REJECTED_WITH_EVIDENCE`/`UNVERIFIED_REQUIRES_EVIDENCE`/`DEXTER_DECISION`、精确仓根相对路径与行号、事实/反例、影响、最小修复建议。涉及产品/Journey 取舍的事项请明确标 `DEXTER_DECISION`，不要由评审者替 Dexter 裁定。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 TER 包布局整理 v5 的 implementation-facing 详设与实施计划。

背景：Dexter 已冻结并授权的范围是：apps/terminal/assembly 改为 apps/terminal/application；ui/base/console-assembly 改为 ui/base/integration-assembly；ui/base/automation、kernel/base/workflow、kernel/base/test-support 三个包线下移出；ui/base/test-support 并回 kernel/base/platform-ports；D-6 删除 TER 产品运行/配置/透传中的 darkMode 语义。v5 的 PL-R00 至 PL-R05、AC-0 至 AC-13、D-1 至 D-6 都是硬输入。本轮只交详设和实施计划，不授权实施。此前两轮 fresh 独立 DESIGN 盲审已完成且不重开；Claude 后续复评指出的 7 处 implementation-facing 缺口已按当前源码逐条修订并回读。本次是 Claude 中转的 follow-up review，不改变原 DESIGN 盲审轮次。

目标：请独立核验详设与计划能否照 v5 执行并证明做对，重点检查 CP-0 基线根因修法与 ignored 产物边界；CP-1/2/3 完整文件集、普通 yarn install → allowed lock diff → yarn install --immutable 协议和每步全部子门；AC-2 正控制/PCRE/旧 Console symbol/assembly 逐处分类；AC-3 的 AC-2(a)、p-5a-direction、SCAFFOLD_HYGIENE 唯一 gate/报文；AC-8 快照与允许差异；AC-9 ExpoModulesPackageList、APK dex、keystore/certificate；AC-10 的匿名态、固定 Web URL/双屏选择、真实 getStartupReadiness、六布尔 groups/三布尔 readiness、uiautomator --windows display 分段及 W-1/D-1、W-2/D-2 具体 primaryReadyPartKey、SECONDARY partKey/testID JSON；AC-11 的 50 个代码命中与全部 active prose 逐行表、记忆同步分流、required-inventory.json 手工 anchor；S-5 11 处目标形态/测试表和相对路径；逐代码与详设对账、TR-16 Web→设备和 TR-08 OPEN 口径。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md：v5 正式需求和全部硬性验收条件；
- doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md：定稿方案和评审处置；
- doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md：implementation-facing 详设；
- doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md：CP-0 至 CP-4 实施计划、命令和对账门；
- doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-granularity-manifest-codex.json：详设分母和 CP gate；
- doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-adversarial-review-codex.md：两轮 fresh 独立盲审及处置；
- AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/terminal-coding-standard.md、doc/platform/implementation-task-template.md：仓库和 TER 执行规范；
- project-memory/index.md 以及 operations/terminal-coding-standard.md、decisions/terminal-architecture-and-stack-rulings.md、decisions/terminal-build-order-and-batches.md、practices/ter-input-and-virtual-keyboard-usage.md：项目记忆；
- doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-codex.md、doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-v4-codex.md、doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-intake-claude.md：此前评审链。

请重点独立核验：所有结论以当前源码和文档字节为准；7 处修订是否真的落在详设/计划现行行号；AC-2(a) plannedDependencies 是否有正控制且唯一报文；50 个代码 token 与全部 active prose 是否逐行覆盖且第 974 行仍保留；三份 active memory、build-order 追加、required-inventory 手工 anchor 和 index 生成口径是否分开；AC-10 匿名态与两个 URL 是否可执行、JSON 是否与 writer 类型一致、readiness owner 是否为 getStartupReadiness；SECONDARY 是否按 --windows/display 分段；S-5 是否正好覆盖 11 处；所有命令/归档是否没有本机绝对路径；CP-2 是否显式跑全量 AC-6 子门；CP-4 前置门是否没有阻断 CP-1/2/3 自身安装；任一 OPEN 是否阻断后续 implementation review。

烦请给出明确 REVIEW_TARGET=DESIGN、VERDICT=GO 或 NO-GO、M/S/N=x/y/z。每条 finding 请给精确路径、行号、事实/反例、影响、最小修复建议和是否需要 Dexter 产品裁决；不要把实现授权边界之外的事项自行扩展。

授权边界：本轮 GO/NO-GO 只代表详设与实施计划是否可进入 Dexter/Claude 设计评审，不授权修改源码、测试、依赖、脚本、构建配置、正本或 project-memory，不授权安装、构建、Web/Metro、Android、虚拟机、真机、DEV、L2、UAT、seed 或实施。谢谢。
```
