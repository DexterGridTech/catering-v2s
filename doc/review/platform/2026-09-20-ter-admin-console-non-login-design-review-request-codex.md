# TER Admin console 非登录区详设与实施计划评审请求

```text
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
DESIGN_GRANULARITY_MANIFEST=RETIRED_NOT_APPLICABLE_BY_CURRENT_AGENTS
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-09-20-ter-admin-console-non-login-design-adversarial-review-codex.md
REVIEW_STATUS=READY_FOR_CLAUDE_RE_REVIEW
REVIEW_RESPONSE=doc/review/platform/2026-09-20-ter-admin-console-non-login-design-review-response-codex.md
PRIOR_REVIEW=doc/review/platform/2026-09-20-ter-admin-console-non-login-implementation-design-review-claude.md
INDEPENDENT_ROUND2=doc/review/platform/2026-09-20-ter-admin-console-non-login-design-adversarial-review-round2-codex.md
```

## 背景

Dexter 已确认 TER Admin console 非登录区的 IA，要求现在把 IA 变成 implementation-facing 详设与实施计划，再交独立 review；本轮不进入实施、不改源码、不运行测试或设备。前置需求已经把用户面收口为三个页面：平台端口、运行状态（合并 runtime 与 display context）、双机拓扑；mobile 为竖屏单列并使用唯一顶部下拉 selector，mobile 不提供任何双机拓扑角色/配对交互。

当前源码存在两个必须在设计阶段诚实处理的公共面差距：

1. `DisplayInfo`/`DisplayInfoRead` 公开事实目前只有 `displayCount`，而 IA 要求真实逐 surface 的逻辑/物理分辨率、角色和状态；不能从 Android 日志或当前 surface 推导。
2. `TopologyAdminCapability` 目前没有 page-level availability，`pair` 需要先查询 identity；需求要求整页 gate由 owner 提供、用户输入 IP 后直接配对，不能由 UI 读取 raw facts/代表性 operation reason 拼装。

详设把这两条列为 CP-0 admission blocker，给出最小 owner contract、停机条件和不允许的替代；如果当前授权不能闭合 owner，不会把设计伪装成已有能力。

## 评审目标

请独立审查：

1. 三页 user page registry 是否正确地聚合了现有 internal parts，是否保留 feature part/console layer/power confirmation 边界；
2. laptop/mobile 交互是否真的是两种信息优先级，mobile 是否只有一个真实 dropdown、没有横向换行 tabs 或拓扑动作；
3. ports capability-unit 分母、五类映射、synthetic undeclared、summary/ratio/category detail 是否守恒且可证伪；
4. runtime/display all-surface read model、current/non-current 不对称、真实 aspect ratio、物理分辨率未知值的 owner 与反例是否完整；
5. topology page gate、主机/副机动作差异、direct pair、host close、两侧 unpair、reconnect 和 failure/recovery 状态机是否与需求及当前 topology contract 一致；
6. shared primitive/token 设计是否过度或越过 owner 边界，两个 integration theme 是否有完整同步分母；
7. selector 订阅、testID、日志脱敏、focused/static/visual/device 证据档位、CP-0 至 CP-5 门控和“逐代码与详设对账”是否足够可实施；
8. 文档内任何“当前已有能力”的表述是否能由当前字节支持，尤其是 display facts、topology page availability/direct pair 和 `PrimitiveSelect` 的真实语义。

## 需阅读文件

请从 catering-v2s 仓库根打开：

- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md`：已确认的需求、用户旅途、业务/owner 边界；
- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md`：全部 IA frame、状态分母与 laptop/mobile 清单；
- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md`：视觉几何、token、surface map 与逐控件对账正本；
- `doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md`：implementation-facing 详设；
- `doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-plan-codex.md`：CP 顺序、停止条件、测试与对账计划；
- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts`、`src/components/AdminShellFrame.tsx`、`src/components/AdminShellLaptop.tsx`、`src/components/AdminShellMobile.tsx`、`src/components/AdminSectionNavigation.tsx`、`src/hooks/useAdminSections.ts`：现有 shell、raw catalog 与导航；
- `apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSection.tsx`、`RuntimeSection.tsx`、`DisplayContextSection.tsx`、`TopologySection.tsx`：当前页面 owner/事实/动作；
- `apps/terminal/ui/base/primitives/src/components/PrimitiveForms.tsx`、`PrimitiveContainer.tsx`、`PrimitiveData.tsx`、`PrimitiveFeedback.tsx`、`PrimitiveIcon.tsx`、`src/types/types.ts`、`src/theme/tokens.ts`：现有 primitive 能力及其真实语义；
- `apps/terminal/kernel/base/platform-ports/src/types/platformPorts.ts`、`apps/terminal/kernel/base/display-context/src/foundations/displayDevice.ts`、`apps/terminal/kernel/base/contracts/src/types/topology.ts`、`apps/terminal/kernel/base/topology/src/foundations/createTopologyAdminCapability.ts`、`evaluateTopologyOperation.ts`：public facts/capability/eligibility；
- `apps/terminal/ui/base/render/src/types/runtimeFacts.ts`、`contexts/RenderContext.ts`、`apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`：facts transfer 与 assembly boundary；
- `apps/terminal/ui/integration/sample-console/theme/global.css`、`tailwind.config.cjs`、`apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css`、`tailwind.config.cjs`：两个 integration 的 theme owner；
- `doc/platform/terminal-coding-standard.md`：TER shared admin、selector、owner、primitive 与日志规范；
- `project-memory/decisions/deterministic-context-only.md` 及 memory 中本任务命中的 admin-shell、selector、display-facts、UI IA 与 owner-boundary 正本：项目级设计约束。

## 独立核验重点

- 以当前字节复核所有源码事实，不以本 handoff 的转述代替 source read；特别检查 `PrimitiveSelect` 当前是否真实 dropdown、`TopologyAdminCapability` 是否已出现新 public method、display facts 是否仍只有 displayCount。
- 逐 frame 对照 IA-01 至 IA-29 与 IA-32，确认新文档没有增加第二 selector、移动端横向 tabs、mobile topology action、obsolete recovery page 或 non-current surface 的分辨率/就绪字段。
- 复算五类 port 映射和 capability-unit 守恒；找一个缺 descriptor/空 capability、新 port 未归类、category 展开后 unit 丢失的反例。
- 反向验证 display-facts owner 与 topology page/direct-pair blocker：若 current public contract 不能支持，确认 CP-0 停机而不是接受 UI 推导。
- 反向验证主机/副机 action matrix：host 可启停服务，slave 只直接配对，双方可解除配对，reconnecting 保持 paired，switch-role 不得因 evaluator 的 `allowed` 变成按钮。
- 核验 primitive 是否只呈现、不持 store/command/业务状态；主题值是否只在两个 integration；`admin-*` token 与 Tailwind/CSS mapping 是否是原子组。
- 核验每个 CP 是否先有主 agent focused proof，再有 fresh 只读三维对账；全批对账是否发生在整体测试前；逐代码与详设结论是否只允许 `MATCHED`/`OPEN`。
- 核验当前文档是否诚实标示 `IMPLEMENTATION_AUTHORITY=false`、dynamic/visual/device 未执行和 independent review 尚未完成。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。每条 finding 请给出：

- `CONFIRMED` / `PARTIALLY_CONFIRMED` / `REJECTED_WITH_EVIDENCE` / `UNVERIFIED_REQUIRES_EVIDENCE` / `DEXTER_DECISION`；
- 仓内事实、外部事实（如有）、推论与尚缺证据的假设；
- owning source 与当前字节位置；
- 反例、适用条件、影响面和最小修复；
- 是否需要 Dexter 对产品/范围/owner contract 做裁决。

本轮 review 只覆盖 DESIGN：详设和实施计划是否成立、可实施、可证伪。它不构成 implementation、runtime、visual、Web、Android、device、release、cleanup 或 acceptance PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审 TER Admin console 非登录区的 implementation-facing 详设与实施计划。

背景：Dexter 已确认 IA，本轮只授权设计与计划 review，不授权实施。用户面收口为平台端口、运行状态（runtime/display 合并）、双机拓扑三页；mobile 为竖屏单列且只有一个 dropdown，mobile 不提供拓扑角色/配对交互。当前源码的 display public facts 只有 displayCount，topology capability 没有 page-level availability，pair 还需先查 identity；详设已将这些列为 CP-0 blocker。

目标：请以当前源码字节为准，核验三页 registry/feature 边界、laptop/mobile 信息架构、capability-unit 端口守恒、all-surface display facts 与 current/non-current 不对称、topology gate/direct pair/主副机动作/解绑/重连状态机、primitive/token owner、selector 订阅、红变异、CP 门控和逐代码与详设对账是否可实施且可证伪。

重点反证：PrimitiveSelect 是否只是循环选择；mobile 是否出现第二 selector/换行 tabs；五类 port 是否覆盖所有当前 port且 summary/category/detail 守恒；non-current surface 是否混入分辨率/就绪；topology gate 是否只来自 owner；pair 是否隐藏 query identity；主副机是否有不同动作且双方可解绑；switch-role 是否被错误画成按钮；新 primitive 是否越过 store/command/input owner；两个 integration 的 token 是否同步；CP-0 至 CP-4 的 fresh 三维对账和全批对账是否可执行。

请给出明确 GO 或 NO-GO，并报告 M/S/N。每条 finding 标注 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，给出 owning source、适用条件、反例、影响面、最小修复及是否需要 Dexter 裁决。

授权边界：只做 DESIGN review，不修改源码/测试/依赖/脚本，不构建、不运行 Web/Metro/Android/device/DEV/L2/UAT，不做 seed/deploy/release/acceptance。设计 GO 不等于 implementation/runtime/visual/device PASS；owner blocker 无法闭合时请保持 OPEN 并交 Dexter 裁决。谢谢。

请从仓库根阅读：doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md、doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md、doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md、doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md、doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-plan-codex.md、apps/terminal/ui/base/admin-shell、apps/terminal/ui/base/primitives、apps/terminal/ui/base/render、apps/terminal/kernel/base/display-context、apps/terminal/kernel/base/platform-ports、apps/terminal/kernel/base/topology、apps/terminal/kernel/base/contracts、apps/terminal/ui/integration/sample-console、apps/terminal/ui/integration/sample-wallpaper-console、doc/platform/terminal-coding-standard.md 与本任务命中的 project-memory 正本。
```
