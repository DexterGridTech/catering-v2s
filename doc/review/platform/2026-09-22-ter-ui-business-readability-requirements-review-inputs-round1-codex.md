# TER UI 业务可读性需求 · 独立审查输入（第一轮）

```text
REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
SCOPE=需求分析文档；非详设、非实施计划、非 implementation 验收
```

## 1. 原始指令与审查顺序

Dexter 点名 `apps/terminal/ui/feature/sample-member-desk`、`sample-staff-auth`、`sample-wallpaper-picker`，要求仔细分析 UI 可读性：组件按 laptop/mobile 目录组织，通用组件留 components，文件不用机型后缀；`ui/feature` 与 `ui/integration` 聚焦业务，把真实重复的工具化能力收进 base，使业务代码更少、更清楚。交付需求文档，解释初衷、详细分析和优化方案，**暂不详设与实施计划**。最新指令取消 Claude 评审，改由 Codex 调度独立对抗审查后交 Dexter。

fresh reviewer 先读以下原始要求、约束与当前源码，独立推导最小合理方案，再读需求稿。first try to falsify the reviewed design; form findings and verdict before reading author self-review or dispositions。不得依赖作者数字或源码摘要作为事实。

## 2. 最小输入清单

| 输入 | 仓根相对路径/范围 | 本轮用法 |
| --- | --- | --- |
| 执行入口 | `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`CLAUDE.md` | 最新用户取消外部 review 优先；主 agent 唯一写入 |
| 授权 | `doc/platform/roadmap-program-registry.json`，选择 `V2S_W0_W4_EXECUTION` 对应 Roadmap 的授权字段；本文件 §1 | 不恢复已删除 CURRENT 字段；只做需求 review |
| 项目记忆 | `project-memory/index.md`、全部 `project-memory/kernel/*.md`、`project-memory/decisions/deterministic-context-only.md` | 规则入口 |
| 六维命中 | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger task-start` | 读取全部命中原文，适用 sourceRefs 回源；该词表没有 terminal，不能据此把 TER 当后台 |
| 任务标准 | `doc/platform/terminal-coding-standard.md`（尤其 §0、TR-12/13/14/15、§7），相关 frontend 通用职责/唯一住址约束及 foundation charter | 识别 TR-14 与本轮目录指令冲突；不得将 Ant Design Drawer 要求套到 RN |
| 评审动作 | `.agents/skills/cs-review/SKILL.md`、`doc/platform/review-standard.md`、`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`、`project-memory/operations/verification-governance.md` | DESIGN 动作 1-B、同根全集与固定 verdict；两轮上限 |
| 原有基础设施目标 | `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md` §0、§3.3–3.5；同日前缀 `implementation-design-codex.md` §9.6 D-14 | 既有复用与失败语义，不重做已存在能力 |
| 原有用户交互 | `doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md` §2–6；`doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md` 中选择/确认/双端/背景语义 | 不新增、删除或改写用户操作 |
| 全部 feature 来源 | 三个点名包的 `src/components/`、`src/hooks/`、`src/parts/parts.ts`、`src/foundations/`、`src/features/commands/commands.ts`、`src/features/actors/actors.ts`、`src/index.ts`、README | 自行核对文件/part/hook 分母与真实业务差异 |
| 全部 integration 来源 | `apps/terminal/ui/integration/sample-console/src/`、`sample-wallpaper-console/src/` | 自行核对重复与应该保留的 composition/placement |
| 可复用 owner | `apps/terminal/ui/base/render/src/foundations/definePart.ts`、`dispatchWithRequestId.ts`、`requestOutcome.ts`，`src/hooks/useRequest.ts`、`useDispatchCommand.ts`，`src/components/SystemFailureNotice.tsx`；`ui/base/feature-assembly/src/index.ts`、`ui/base/console-assembly/src/foundations/consoleAssembly.tsx` | 先有能力再谈抽取；不能反向依赖或抹平类型 |
| 被审对象（最后读） | `doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md` | 完整读取；形成独立 findings/verdict；不是作者处置稿 |

既有 checklist 中标准矩阵、granularity、manifest 台账等已被 AGENTS 退役，不作为输入。当前没有获批的本轮详设/计划，也没有实施与 focused proof：这些为 `NOT_APPLICABLE_WITH_REASON=用户明确要求停在需求阶段`，不得以缺少它们迫使扩展阶段。代码读取用于验证需求里的现状描述，不把本轮 review 偷换成历史实现验收。

## 3. 必查问题与回报

- 需求是否覆盖两点初衷，是否将“业务包少写机制”误解成“业务规则进 base”？
- 三个 feature 的组件/part/hook 分母是否准确，是否混淆注册与运行可达？
- 真实共享 UI 是否被旧 laptop 别名混淆，目录/公开导出/props 类型能否保持明确？
- 五处 request 编排是否有不可抹平差异，已有 `SystemFailureNotice` 是否真的被业务消费？
- integration 是缺共同框架还是仅有残留重复；是否误动同步输入、主题或 placement？
- 候选是否有更小替代；是否提前冻结详设、过度设计或静默扩大到 base/admin-shell？
- 原始要求/标准/源码与需求写入后的建议逐点对读；若概览替代关键条目核验，记 finding。

返回：实际读取清单/遗漏、盲审声明、1-B 缺项/矛盾/无出处数值清单、独立方案合理性分析、逐条 findings（精确位置、影响、同根全集、最小替代）、三档证据与未验证项、review-standard 固定 verdict 全部字段。只读返回文本，**不得写文件、执行测试/构建、运行设备或改任何源码**。主 agent 负责保存原始报告与逐条 intake，不可替代 reviewer 下 verdict。
