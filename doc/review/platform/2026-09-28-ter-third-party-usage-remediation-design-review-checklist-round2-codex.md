# TER 第三方库整改详设与计划：独立盲审输入清单 — 第 2 轮

```text
REVIEW_CYCLE_ID=TER-THIRD-PARTY-REMEDIATION-DESIGN-2026-09-28
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
```

Reviewer instruction: 这是本 DESIGN cycle 最后一轮。请以 v3.2 需求、模板、规范与当前 owning source 为准，先独立证伪详设和计划；写定 findings/verdict 后，才可查看 Round 1 的作者处置记录。不要接受上一轮或作者给出的结论作为证据。只读工作，不修改任何文件；不运行安装、构建、测试、Web、Metro、Android 或设备命令。只读设备 inventory 不作为本轮必要输入。

路由值说明：CLI 明确拒绝非具体值 `consumer-face=all`；以下 `platform-admin` 只作为已登记、可执行的 UI-bearing memory 检索代理，不表示本批 TER 的产品 consumer-face。六个 kernel 与 TER 四份正本 memory 仍须直接读取，不由路由代理替代。

## 必读材料与命令

| 输入 | 路径 / 命令 | 必做动作 |
|---|---|---|
| 当前指派与授权 | 当前会话的 Dexter 指派；其 v3.2 范围、设计期 TP-D1 POC 授权与“不得实施”边界 | 以会话授权为准；不得从历史计划推导额外权限 |
| 仓库入口 | `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md` | 按启动顺序读取当前字节 |
| 项目记忆 | `project-memory/index.md` 六个 kernel；六维路由 A/B/C 命令见下；路由命中项及 `sourceRefs` owning source；TER 记忆四份 | 逐项读取，不将 index/query 当规则正本 |
| 路由 A | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner platform --impact architecture --trigger task-start` | 执行并读取全部命中与 `sourceRefs`；本轮当前输出 25 refs |
| 路由 B | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner frontend-platform --impact runtime --trigger task-start` | 执行并读取全部命中与 `sourceRefs`；本轮当前输出 12 refs |
| 路由 C | `scripts/context/recall-memory --task-kind testing --domain platform --consumer-face platform-admin --owner platform --impact evidence --trigger implementation` | 执行并读取全部命中与 `sourceRefs`；本轮当前输出 28 refs |
| TER 正本记忆 | `project-memory/operations/terminal-coding-standard.md`；`project-memory/decisions/terminal-architecture-and-stack-rulings.md`；`project-memory/decisions/terminal-build-order-and-batches.md`；`project-memory/practices/ter-input-and-virtual-keyboard-usage.md` | 全文读取 |
| 当前唯一需求 | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md` v3.2 | 全文读取；其余版本不得取代 |
| 被审详设 | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md` | 全文读取；须独立核对 POC、§3a 控件分母、第三方版本依据、OPEN 与授权，不得先读 Round-1 处置 |
| 被审计划 | `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md` | 全文读取；逐步骤核验能力、验证观察、无规范时的代码先例、安装锁文件纪律、昂贵阶段进入门、最终 Web→设备顺序及交付对账 |
| 设计评审动作 | `doc/platform/review-standard.md` §§1、2、3、5 | 执行 `REVIEW_TARGET=DESIGN` 的 1-B；模板逐节列 `有/缺/NOT_APPLICABLE`；出 L1/L2/L3、same-root scan 与 DESIGN_GAPS |
| 详设派活规范 | `doc/platform/implementation-task-template.md` | 检查每个步骤精确现有能力、可执行观察、无规范时同形代码先例；UI 控件分母和跨文档对账 |
| 必需模板 | `doc/decisions/templates/implementation-design-template.md`、`ia-design-template.md`、`ui-interaction-design-template.md`、`journey-decision-template.md` | 逐节对照；不得把 N/A 留空，须有理由 |
| 领域规范 | `doc/platform/third-party-library-usage-standard.md`；`doc/platform/terminal-coding-standard.md` 的 TR-08、TR-10、TR-11、TR-16、TR-17、§7.1；`foundation-charter.md` §§1-J/1-K；前/后台 coding standards；`agent-operating-model.md` §3 | 读取适用条目并核对详设判据 |
| 裁定与 review 治理 | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`；`doc/decisions/2026-07-24-v2s-verification-governance.md`；T-3/T-4 上游正本及 TER stack rulings | 只核适用裁定；按第二轮 final hard stop |
| owning source | 需求 F-1…F-31 所引当前源码；详设 §3/§5/§6/§8/§11 所引用的实现、测试、配置 | 只读复核支持关键技术判据的路径、精确版本和反例 |

## 本轮定向证伪问题

1. Round 1 四项处置是否真实闭合：TP-D1 POC 是否有会话授权且足以覆盖需求所列 API；第三方来源能否支持对应精确版本与断言；三方案比较完整；checklist 六维路由合法且可复现。
2. POC 与后续正式迁移是否被正确区分；RNTL/Vitest 初始化、正式依赖 peer graph、29 个测试文件和 10 个手写声明的分母能否在实施期落地。
3. §3a UI_BEARING 控件分母能否代表全部受影响 surfaces/controls；如不需要独立 Journey/IA/interaction artifact，需求与现有承载形态是否足以给出这个 N/A。不得发明产品 Journey。
4. 依赖范围是否自相矛盾；`react-error-boundary`、RNTL 和 TP-X1 测试依赖的授权边界是否清楚、是否可能借“测试依赖”扩大依赖范围。
5. TP-A11 设备旧 namespace 前置、最终双屏真机与 mobile 虚拟机、设备数据清除边界是否可执行且不越权。
6. 每个实施步骤的完整文件/消费者集合、能力引用、可失败观察、同形代码先例、CP 与整批三维对账、逐代码与详设对账、静态/聚焦/Web/设备/业务/cleanup 分档是否充分；是否有不能运行或会假绿的条件。
7. `§10b`、L2、UI 模板及详设模板各节是否按模板全部落值；OPEN 是否如实保留，而非被文案改成 PASS。

## 盲审声明

请在 verdict 形成后声明：`I received this round-2 checklist in a fresh independent context, read the current v3.2 requirement and governing sources, formed my findings and verdict before opening the Round-1 author disposition, and performed no writes or dynamic verification.`

第二轮输出须含 `REVIEW_TARGET=DESIGN`、`REVIEW_ROUND=2`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、输入清单路径、`ROUND_FINAL_DECISION=SELF_DECIDED`，并使用 review-standard §5 的完整结论块。该轮之后不派第三轮 reviewer。
