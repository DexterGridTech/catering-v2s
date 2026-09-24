# TER UI 包职责与公共导出边界需求评审请求

REVIEW_STATUS=CODEX_EVIDENCE_INCOMPLETE; DEXTER_AND_CLAUDE_REVIEW_PENDING
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_UI_PACKAGE_RESPONSIBILITY_20260923

## Codex 内部审查留痕状态

一名 fresh 独立 critic 返回实质意见 `GO_WITH_OPEN_GOVERNANCE`、`M/S/N=0/0/0`；但其强制 reviewerInputChecklist 未生成，原始六维 memory query 的逐条 ref/source-ref 映射与完整读取留痕也未保留。故该意见仅记录为审查者的实质判断，**不接受为治理完整的独立 DESIGN GO**；正式审查证据状态仍为 OPEN。更早的尝试同样未形成完整有效的输入清单，不据此重置 review cycle 或声称完成了合规的 Codex 独立审查。Claude 尚未评审，Dexter 的裁定也待进行。

## 背景

Dexter 在审阅 `src/assembly/assembly.ts` 及多个导出入口后，希望先从整体代码关系出发，厘清 package 内定义导出、assembly 聚合、package root API、app integration 和共享 `ui/base` 的职责，再决定是否需要调整 public surface。仓内已有 TER UI 可读性需求、详设、实施计划及已收口 DESIGN review；新稿是增补式需求评估，不修改或重开旧工件。当前实现计划已包含 public surface 收口目标；本轮补充按“符号—消费者—公开理由—owner”逐项审查的要求。

Codex 已静态读取三组 feature、两组 integration、相关 ui/base API、package root exports、terminal invariants、public-surface tests 与 Android imports。未运行测试、构建、Web、Metro、Android/native/device 或动态验证。仓内消费者检索不能证明仓外消费者不存在，因此文档对 wallpaper-picker 的 raw `parts` / standalone module export 及 integration 内部符号只列为待裁定候选，不预设删除。

## 评审目标

请判断需求稿是否准确区分各层职责，并是否有足够源码证据把真实重复入口与有意的模块边界分开；确认建议能否在不改变业务 owner、UI/双形态、应用组合、startup/topology/state-sync 语义的前提下表达；检查它是否与既有需求/详设/实施计划冲突或造成重复范围。

## 需阅读文件

- `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md`：本轮需求评估正本。
- `doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md`：前序需求，核对增补关系。
- `doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md`：已接受 IA/交互 preservation 约束。
- `doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md`、`doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md`、`doc/review/platform/2026-09-22-ter-ui-business-readability-design-closure-codex.md`：检查与已有职责/export 目标的关系；历史阶段状态不能替代当前源码。
- `doc/platform/terminal-coding-standard.md` 与 `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：TER 分层、feature 多形态、integration 与 export 边界。
- `apps/terminal/ui/feature/sample-member-desk/src/index.ts`、`apps/terminal/ui/feature/sample-staff-auth/src/index.ts`、`apps/terminal/ui/feature/sample-wallpaper-picker/src/index.ts`：三个 feature 的 root public API。
- `apps/terminal/ui/feature/sample-member-desk/src/assembly/assembly.ts`、`apps/terminal/ui/feature/sample-staff-auth/src/assembly/assembly.ts`、`apps/terminal/ui/feature/sample-wallpaper-picker/src/assembly/assembly.ts`、`apps/terminal/ui/base/feature-assembly/src/index.ts`：feature assembly 与共享机制。
- 三个 feature 各自的 `package.json`、`README.md`、`terminal-invariants.json`、`src/parts/parts.ts` 与 `src/application/module.ts`：核实包入口、parts 和 feature module 的 owner；`publicSurface.test.ts` 当前仅见于 wallpaper-picker。
- `apps/terminal/ui/feature/sample-member-desk/src/foundations/systemFailureDismissal.ts`、`apps/terminal/ui/feature/sample-staff-auth/src/foundations/systemFailureDismissal.ts`、`apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/systemFailureDismissal.ts`：对比通用派发与 feature command identity。
- `apps/terminal/ui/feature/sample-member-desk/src/hooks/useMemberForm.ts`、`apps/terminal/ui/feature/sample-member-desk/src/components/laptop/MemberForm.tsx`、`apps/terminal/ui/feature/sample-member-desk/src/components/mobile/MemberForm.tsx`：sample-only keyboard probe 的职责边界；不以此请求改动键盘行为。
- `apps/terminal/ui/integration/sample-console/src/index.ts`、`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`、`apps/terminal/ui/integration/sample-console/src/application/module.ts`、`apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts`：sample-console 对外 API 与内部组合。
- `apps/terminal/ui/integration/sample-wallpaper-console/src/index.ts`、`apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`、`apps/terminal/ui/integration/sample-wallpaper-console/src/application/module.ts`、`apps/terminal/ui/integration/sample-wallpaper-console/src/application/terminalSurfaces.ts`：wallpaper integration 对外 API 与内部组合。
- 两个 integration 各自的 `package.json`、`README.md`、`terminal-invariants.json`、`src/parts/parts.ts` 与 `test/publicSurface.test.ts`：package exports、app-owned parts、公开清单和 exact-set 核验。
- `apps/terminal/ui/base/console-assembly/src/index.ts`、`apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`：integration 复用的 console 组装契约。
- 两个 integration 的 `terminal-invariants.json`、`test/publicSurface.test.ts` 与三个 feature 的 `terminal-invariants.json` / wallpaper picker `test/publicSurface.test.ts`：当前登记并精确核对的 public surface。
- `apps/terminal/assembly/android/sample-terminal/App.tsx`、`apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`、`apps/terminal/assembly/android/sample-wallpaper-terminal/App.tsx`、`apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts`：真实 Android app consumers。

## 独立核验重点

- `src/assembly/assembly.ts[x]` 是否是本层可供上层消费的组合契约，还是仅与 root index 重复；定义文件 export、assembly 对象、root re-export 与 package export map 不要混为一类。
- 三个 feature 当前 root API 中，`sampleWallpaperPickerAssembly.parts` / `.createModule()` 与独立 root `parts` / `createSampleWallpaperPickerModule` 是否语义重复；仓内生产消费者、测试消费者、未知外部消费者分开报告。
- 两个 integration root 的 `create*Module`、`parts`、startup command、parser helpers、surface helper 等逐项对照实际 Android 与 package consumer；public invariant 的记载是否被误当成保留理由。
- `createSurfaceForDisplayIndex`、`terminalSurfaces` adapter、startup-ready actor、state-sync selector 等是否已由 console-assembly 承接；不要把薄的 app 配置绑定误称底层算法重复，也不要再次建立同类 base abstraction。
- integration 专属 app identity、模块集合、拓扑/sync 参数、wallpaper placement、parts、theme 和平台配置是否继续由正确 owner 持有；`kernel/feature` 与 `ui/feature` 边界是否保留。
- 是否存在本文未覆盖的 package consumer、公开兼容承诺或计划差异；把未经证实项标为 OPEN 并说明最小核验条件。
- 需求稿有没有夹带实现细节、改动步骤或授权；本轮只做需求 review，不进入详设、实施计划或代码修改。

## 期望结论

请明确给出 `GO` 或 `NO-GO`，并按 `M` / `S` / `N` 统计。每条 finding 请列精确仓根相对路径与行号、事实/反例、影响范围、最小修订建议，以及是否需要 Dexter 产品或 public-API 裁决。不要把“仓内无引用”直接推导成“仓外没人用”。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 TER UI 包职责与公共导出边界需求。

背景：Dexter 希望在决定是否继续调整之前，先厘清 feature、integration、ui/base、assembly 和 package root exports 的职责关系。仓内已有 2026-09-22 的可读性需求、详设和实施计划，本次文档是公共 API/消费者归因的增补需求评估，不修改或自动替代既有工件。当前代码已静态检查；仓内未发现某些 raw exports 的生产消费者，但这不能证明仓外消费者不存在。
目标：请独立判断需求稿是否准确区分了定义处导出、assembly 聚合、package root API 与 package export map；逐符号审查重复入口候选、实际消费者和 owner 边界，并指出与既有需求/详设/计划的矛盾或重复范围。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md`：本轮需求稿；
- `doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md`、`doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md`：先前需求与保留的 IA/交互边界；
- `doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md`、`doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md`、`doc/review/platform/2026-09-22-ter-ui-business-readability-design-closure-codex.md`：已完成设计与计划，核查本稿关系但不把旧 review 当当前源码事实；
- `doc/platform/terminal-coding-standard.md`、`project-memory/decisions/terminal-architecture-and-stack-rulings.md`：分层与 TER 规范；
- `apps/terminal/ui/feature/{sample-member-desk,sample-staff-auth,sample-wallpaper-picker}/src/index.ts` 与各自 `src/assembly/assembly.ts`，以及 `apps/terminal/ui/base/feature-assembly/src/index.ts`：feature API/assembly；
- 三个 feature 的 `package.json`、`README.md`、`terminal-invariants.json`、`src/parts/parts.ts` 与 `src/application/module.ts`；实际 `publicSurface.test.ts` 只列 wallpaper-picker；
- 三个 feature 的 `src/foundations/systemFailureDismissal.ts`；以及 member-desk 的 `src/hooks/useMemberForm.ts` 和 laptop/mobile `MemberForm.tsx`；
- `apps/terminal/ui/integration/{sample-console,sample-wallpaper-console}/src/index.ts`、`src/assembly/assembly.tsx`、`src/application/module.ts`、`src/application/terminalSurfaces.ts`：integration exports、组装与 adapters；
- 两个 integration 的 `package.json`、`README.md`、`terminal-invariants.json`、`src/parts/parts.ts` 与 `test/publicSurface.test.ts`；
- `apps/terminal/ui/base/console-assembly/src/index.ts`、`src/foundations/consoleAssembly.tsx`：共享 console 机制；
- 目标包的 `terminal-invariants.json`、`test/publicSurface.test.ts`（适用处）、Android app `App.tsx` 与 `src/assembly/platformPorts.ts`：精确 public surface 与实际宿主消费者。

请重点独立核验：feature/integration root 各导出是否有独立包外语义和实际消费者；assembly 聚合与 raw parts/module 的重复路径是否成立；Android 真正依赖哪些 integration APIs；surface/startup/state-sync 的共享实现是否已在 base；三个 feature `systemFailureDismissal` 的命令 owner、base 派发复用与其 `foundations/` 目录职责是否一致；member form 中 sample-only keyboard probe 是否为需要 Dexter 裁定的边界；未知外部 consumers 如何保留为 OPEN；本文是否应澄清既有 CP-5 要求而不是另造范围。

烦请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、事实依据、影响范围、最小修复建议，以及是否需要 Dexter 产品/API 裁决。

授权边界：本次只 review 需求稿。GO 只表示需求方向可进入 Dexter 决策；不授权修改源码、测试、依赖、脚本、构建产物，也不授权编写或修改详设和实施计划、动态验证或删除任何 public export。后续是否并入已有计划或进入下一阶段由 Dexter 明确决定。谢谢。
```
