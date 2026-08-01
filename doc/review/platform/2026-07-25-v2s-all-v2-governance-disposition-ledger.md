---
title: all-v2 执行治理逐条 disposition 对账
status: READY_FOR_CLAUDE_IMMEDIATE_CONFIRMATION
createdAt: 2026-07-25
scope: "治理恢复；不授权 implementation、contract、database、DEV、动态运行或 Git"
allV2AgentsSha256: 331ad53e5000cbb757f680f339fb779e24c0ada6f881cfe4fcb01b214dd241b4
allV2ClaudeSha256: ac0e4844c8e39d441f8cf2b53039f69fd30fa3e4ec3490760461ed64e2af3b37
---

# all-v2 执行治理逐条 disposition 对账

## 目的、范围与判定法

本表对 `../catering-all-v2/AGENTS.md` 的每个开工条目、不可突破规则、协作/进度/结束规则与
完成规则逐条作最终 disposition；同时列出 `../catering-all-v2/CLAUDE.md` 的清单级职责，以及
`../catering-all-v2/doc/platform/*standard*.md` 的标题与一句用途。读取时点的源 hash 如 front
matter。不是把 all-v2 变成 v2s 当前真相，也不把任何 `CARRIED_ASSET` 当 runtime/build fallback。

四种值严格定义如下：

| disposition | 含义 |
| --- | --- |
| `CARRIED_DISTILLED@<v2s 落点>` | 规则在 v2s 仍有效，但以 v2s 拓扑、授权和当前文档结构压缩/改写；落点是当前真相。 |
| `CARRIED_ASSET@<heritage hash>` | 不把旧规则直接激活；冻结一个可回读、hash-bound Heritage 原文/脚本，后续仅按新裁决适用。 |
| `OBSOLETE_BY_TOPOLOGY(<理由>)` | all-v2 多服务/多程序或旧迁移拓扑所需；v2s 单 deployable、单数据库和当前 Roadmap 下不适用，理由必须明确。 |
| `MISSING` | 没有现行落点。本文最终没有遗留 `MISSING`：每个初始缺口均在“缺口补齐”中有明确落点；这不表示未来 R4 gate 已实现。 |

## AGENTS.md 逐条 disposition

| all-v2 来源 | 规则摘要 | disposition |
| --- | --- | --- |
| L3 | 程序/授权从显式 Registry 与当前状态解析 | `CARRIED_DISTILLED@AGENTS.md#开工读序-2` |
| L5 | 未授权程序不得 preflight/实施 | `CARRIED_DISTILLED@AGENTS.md#开工读序-5` |
| L9 | 保留根因、证据、资源清理与 Dexter 管 Git | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线` |
| L10 | 项目 memory 是当前实施真相 | `CARRIED_DISTILLED@AGENTS.md#开工读序-3` |
| L11 | 不复活巨型 codegen/graph/DSL/重复 skill | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-16、26` |
| L12 | 只有 v2-rooted 会话才可证明项目 skill/hook | `CARRIED_DISTILLED@AGENTS.md#开工读序-1、26` |
| L13 | `.agents/skills` 是唯一项目 skill 根 | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-26` |
| L14 | 仓内 `project-memory` 不可被系统 memory 替代 | `CARRIED_DISTILLED@AGENTS.md#开工读序-3、28` |
| L18 | 先读 AGENTS | `CARRIED_DISTILLED@AGENTS.md#开工读序-1` |
| L19 | 先读 Blueprint | `CARRIED_DISTILLED@AGENTS.md#开工读序-1` |
| L20 | 先读 platform README | `CARRIED_DISTILLED@AGENTS.md#开工读序-2` |
| L21 | Registry 解析 current unit 及 active 文档 | `CARRIED_DISTILLED@AGENTS.md#开工读序-2、5` |
| L22 | 业务先 Journey/packet/批次设计再派生实现 | `CARRIED_DISTILLED@doc/decisions/templates/journey-decision-template.md、doc/decisions/templates/ui-interaction-design-template.md、doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md` |
| L23 | 当前 OpenAPI contract 是 wire 读序项 | `CARRIED_DISTILLED@AGENTS.md#开工读序-4（当前步骤明确引用的 contract）` |
| L24 | kernel、六维路由与 Journey Heritage 原文必须回读 | `CARRIED_DISTILLED@AGENTS.md#开工读序-3、doc/heritage/README.md` |
| L25 | 标准 scripts 入口 | `CARRIED_DISTILLED@AGENTS.md#开工读序-4` |
| L26 | receipt/obligation 是旧 MDB 实施前置 | `CARRIED_DISTILLED@contracts/policy/standards-coverage-matrix.json（memoryRefs + enforcement）；未来 R5 按现行 Roadmap 决定最小 receipt 形态` |
| L28 | hook 只推荐 project skill，记忆/代码分别确定性回读 | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-26` |
| L32 | 先设计/交互/计划，偏差先改设计 | `CARRIED_DISTILLED@doc/decisions/2026-07-25-v2s-design-governance-batch-1.md#3 强制管线` |
| L33 | Scenario/Packet/JG/旧 derivation permit | `CARRIED_DISTILLED@doc/decisions/2026-07-25-v2s-design-governance-batch-1.md#3 强制管线（Journey 裁决、交互工件、Dexter 看图和 implementation-facing design；不授权实现）` |
| L34 | Step/MDB/Pack 的旧实施闭环 | `CARRIED_DISTILLED@doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md#实施单元（单 deployable 的获批 Journey/稳定模块分界，不复制旧四域分母）` |
| L35 | contract 只承载 wire truth | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-17；doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#3.10` |
| L36 | wire→binding→owner→consumer→readback 的有限闭环 | `CARRIED_DISTILLED@doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md#实施单元` |
| L37 | 多服务横向扩展、outbox、投影与内部 client | `OBSOLETE_BY_TOPOLOGY(v2s 是单 deployable、同库同事务；AGENTS.md 明确不引入 MQ/outbox/TDP/内部 OpenAPI client)` |
| L38 | 根因、旧路径退出、fresh evidence、cleanup 同时成立 | `CARRIED_DISTILLED@doc/decisions/2026-07-24-v2s-verification-governance.md` |
| L39 | 完整日志先行与 `LOG_NOT_AVAILABLE` 修复 | `CARRIED_ASSET@597a87741247b7abf600486087539d614f501e7b53ff031a635f387213b2e03b` |
| L40 | 阶段反思、系统性扫描、memory delta 与 phase gate | `CARRIED_DISTILLED@project-memory/operations/phase-retrospective-and-systemic-repair.md` |
| L41 | 可并发的读/审计与必须串行的共享写面 | `CARRIED_DISTILLED@doc/decisions/2026-07-24-v2s-verification-governance.md#5` |
| L42 | UI 按任务/interaction；L2/L3 证据 | `CARRIED_DISTILLED@doc/decisions/templates/ui-interaction-design-template.md；R3 whole-scope plan` |
| L43 | 双 admin 的独立 consumer profile/chrome | `CARRIED_ASSET@98bb944a029e41caa84b95517bf021c0e4809e1725c5ad532e84e685131ddd1f` |
| L44 | 长运行受管、30 秒汇报、business/cleanup 分账 | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-36、协作进度与结束闸门` |
| L45 | 只按 run manifest 回收资源 | `CARRIED_DISTILLED@project-memory/kernel/05-evidence-runtime-and-git.md` |
| L46 | 成熟 ProComponents 优先；已验证组合先复核继承 | `CARRIED_DISTILLED@doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md` |
| L47 | 列表/详情 Drawer/表单 Drawer 的动作分层 | `CARRIED_ASSET@3d036edb2b3ea4ef5f96ccca464669a5f1f309f4c4ca448aba5cddd92d92fe4d（owning source: business-entity-list-detail-action-standard.md）` |
| L48 | 搜索、排序、单元格三矩阵 | `CARRIED_ASSET@3d036edb2b3ea4ef5f96ccca464669a5f1f309f4c4ca448aba5cddd92d92fe4d（owning source: business-entity-list-detail-action-standard.md；AntD 标准为消费方）` |
| L49 | 用户界面只用业务语言 | `CARRIED_ASSET@087b537d57c1839315f886bc9e3bb294ed10ed719b53b590e39cadfa9374b6bb` |
| L50 | overlay、Content Tab 与上下文切换规则 | `CARRIED_ASSET@fc5585aa0ce198614b0f5223edf88dd458eeef91796d6b3fc3732dec6d9d12af` |
| L51 | Drawer dirty guard、提交/反馈状态机 | `CARRIED_ASSET@0154be1d75078d6996d3a6edbaf3c1f6457a96e0760875296762dfea06bf435f` |
| L52 | 角色能力/菜单页面准入矩阵 | `CARRIED_ASSET@2604180320cbdc473e80da5b056867e05c1a8e720658df0dc1ca39b5d1ca983b` |
| L53 | 双后台 page catalog owner boundary | `CARRIED_ASSET@2604180320cbdc473e80da5b056867e05c1a8e720658df0dc1ca39b5d1ca983b` |
| L54 | 术语来源、边界、禁词和 runtime traceability | `CARRIED_ASSET@93e7ccb66e70627b4d3aeec4dcc21a1a12b2ae44eb0f3bccc6797b6e91a43053` |
| L55 | runtime 目录不得按 Journey/Step 组织 | `CARRIED_ASSET@f88855cc3583026ad6edf7afb3e729c46705ea5f30fa7d635acd6784db9c236a` |
| L56 | 横切 foundation 的准入与等价重构 | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-14、doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#3.2` |
| L57 | 简单优先、旧路径物理退出与 closure 证据 | `CARRIED_DISTILLED@doc/decisions/2026-07-24-v2s-verification-governance.md` |
| L58 | 双 app 状态/路由/context 生命周期归属 | `CARRIED_ASSET@7db367e97931fe2f1292e620e8364f667ed9663a5fbb1e09f6d48a03448f41c6` |
| L59 | Git 只归 Dexter | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-21、协作进度与结束闸门` |
| L60 | 命中不等于已读；按任务重建 memory receipt | `CARRIED_DISTILLED@AGENTS.md#开工读序-3、28` |
| L61 | receipt 不等于执行；每条 memory 要落 obligation | `CARRIED_DISTILLED@contracts/policy/standards-coverage-matrix.json（memoryRefs + enforcement）` |
| L62 | no provider/daemon，memory 与 code 的确定性入口 | `CARRIED_DISTILLED@project-memory/decisions/deterministic-context-only.md` |
| L63 | Stop 只看活跃受管 run/当前 cleanup | `CARRIED_DISTILLED@scripts/hooks/stop、scripts/README.md#Stop` |
| L64 | Claude handoff 的可复制中文 brief 与检查 | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-22；project-memory/operations/claude-review-handoff-standard.md` |
| L65 | implementation-facing manifest + 独立对抗审查 | `CARRIED_DISTILLED@doc/decisions/2026-07-25-v2s-design-governance-batch-1.md#3 强制管线、#4 机械门与人工判断的边界` |
| L66 | DESIGN/IMPLEMENTATION 两轮对抗审查必须由与作者不同 session 的 fresh 独立子 agent 盲审，作者只做辩证 intake，不得代写 verdict | `CARRIED_DISTILLED@doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md#1 裁决、#2 独立盲审与最小输入、#3 机械边界与留痕（恢复 v2 原强度；NEXT_REVIEW_CYCLE 生效）` |
| L69 | Codex 在批准范围自主修复；Dexter 保留产品/外部/Git | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-21、30-34` |
| L71–82 | 六行持续汇报格式与频率 | `CARRIED_DISTILLED@AGENTS.md#协作进度与结束闸门` |
| L84 | final 仅在三种可审计结束状态发送 | `CARRIED_DISTILLED@AGENTS.md#协作进度与结束闸门` |
| L88 | closure 的 traceability、术语与证据条件 | `CARRIED_ASSET@173c7d5e9b036dd38da71e0cd53965d52639a02ea8dbd67c071fd314c6608e5d；CARRIED_ASSET@93e7ccb66e70627b4d3aeec4dcc21a1a12b2ae44eb0f3bccc6797b6e91a43053` |

## CLAUDE.md 清单级 disposition

| all-v2 条目 | 用途 | disposition |
| --- | --- | --- |
| L3 | AGENTS 是执行规则唯一真相，Claude 文件不复制红线 | `CARRIED_DISTILLED@CLAUDE.md#评审入口与边界` |
| L5–9 | 给 Dexter 的可复制中文评审话术、六段文件和 handoff checker | `CARRIED_DISTILLED@CLAUDE.md#给 Dexter 的 Claude 评审交接；scripts/check/claude-review-handoff` |
| L11 | Claude 必须从本仓根读 `.agents/skills` 与 `project-memory` | `CARRIED_DISTILLED@AGENTS.md#开工读序-1、26` |
| L13–27 | 独立 review 的 Journey、owner/wire/证据、术语/线框与权限核验清单 | `CARRIED_DISTILLED@CLAUDE.md#独立核验重点` |
| L29 | MDB/Pack 的旧批次评审边界 | `CARRIED_DISTILLED@doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md#实施单元（按当前 Journey 与单 deployable owner 边界评审）` |
| L31 | 反复问题必须做阶段反思并转下一阶段 obligation | `CARRIED_DISTILLED@project-memory/operations/phase-retrospective-and-systemic-repair.md` |
| L33 | PKG-1/1.5 历史 close 不可升格为 cutover | `CARRIED_DISTILLED@project-memory/operations/roadmap-control-transfer.md（v2s 仅以自身 Registry 和 evidence 判定）` |
| L35 | Claude findings 是证据而不是自动扩权；Dexter 决策边界 | `CARRIED_DISTILLED@AGENTS.md#不可突破的红线-30、32、34` |

## `doc/platform/*standard*.md` 清单级 disposition

| 标题 | 一句用途 | disposition |
| --- | --- | --- |
| Admin Consumer Chrome 规范 | 固定每个 admin app 的唯一 theme/token/shell 归属，避免跨 app 混用。 | `CARRIED_ASSET@98bb944a029e41caa84b95517bf021c0e4809e1725c5ad532e84e685131ddd1f` |
| Admin UI 交互与 Ant Design 使用标准 | 规定先任务、后成熟 ProComponents、再受控 AntD fallback 的 UI 组合和 L2 设计纪律。 | `CARRIED_ASSET@25e3ec016b39801147219b726ddc9162f266af0e9b60cb4ecead7ebdaf8f731e（owning source: admin-ui-interaction-and-ant-design-usage-standard.md）` |
| 业务设计完整性与统一交付标准 | 用 C0–C3 分级和统一 owner/evidence 防止不完整需求被局部实现掩盖。 | `CARRIED_DISTILLED@doc/decisions/2026-07-25-v2s-design-governance-batch-1.md#3 强制管线` |
| 代码质量、简单性、复用与旧路径退出标准 | 要求 root-cause、简单优先、旧路径退出和真实 closure。 | `CARRIED_DISTILLED@doc/decisions/2026-07-24-v2s-verification-governance.md` |
| Implementation-facing 详设粒度与独立对抗性审查标准 | 要求 manifest 逐单元完整、fresh 独立子 agent 盲审且 M/S 为零才可 handoff。 | `CARRIED_DISTILLED@doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md#1–#3（NEXT_REVIEW_CYCLE 生效）` |
| 阶段反思与系统性修复标准 | 把阶段问题提升为有限分母的失败模式、controls 与下一阶段 obligation。 | `CARRIED_DISTILLED@project-memory/operations/phase-retrospective-and-systemic-repair.md` |
| 用户场景到交付追踪标准 | 让批准用户任务到 spec/plan/contract/test/evidence 的派生链可追踪。 | `CARRIED_DISTILLED@doc/decisions/2026-07-25-v2s-design-governance-batch-1.md#3 强制管线` |
| 用户场景优先设计标准 | 要求非平凡功能先定义真实用户路径和 owner fact，不让 contract/page 反向创造业务。 | `CARRIED_DISTILLED@doc/decisions/templates/journey-decision-template.md` |

## 缺口补齐与未来接线

下列条目在对账开始时均是 `MISSING`；本批已经补齐落点。`R4` 一词只表示 standards matrix 的
future enforcement phase，绝不表示当前脚本已实现、已运行或 R3 可借此 closure。

| 初始缺口 | 本批落点 | 当前/未来边界 |
| --- | --- | --- |
| carry-over-first | `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md` | 明记恢复 all-v2 已有复核/继承规则而非新增；仅设计与 future manifest 约束，不授权搬运。 |
| 六行汇报 | `AGENTS.md#协作进度与结束闸门` | 原样保留六行和 `LEFT` 固定模板；Git 权限仍按 v2s。 |
| final 结束闸门 | `AGENTS.md#协作进度与结束闸门` | 仅三种终止状态；未完成 task 只能 commentary。 |
| `ui-wireframe-traceability` | `doc/heritage/frozen/catering-all-v2/scripts/check/ui-wireframe-traceability@173c7…8e5d`；matrix `B.5.N01` | `R4/PLANNED`；R4 需按 v2s current Journey/owner/closure shape 重建并做真红 mutation，禁止直接运行旧仓脚本。 |
| `business-terminology-traceability` | `doc/heritage/frozen/catering-all-v2/scripts/check/business-terminology-traceability@93e7…3053`；matrix `B.5.N08` | `R4/PLANNED`；R4 需连接已确认业务语料和 current runtime evidence，不得复制旧四域 registry。 |
| 阶段反思/系统性修复 | `project-memory/operations/phase-retrospective-and-systemic-repair.md` | `PHASE_RETROSPECTIVE_R4_GATE_PENDING`：R4 先过建门三问并做 native red mutation；当前只要求语义回读与 obligation。 |
| 日志先行完整标准 | `doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md@597a…e03b`；kernel/pitfall 回指 | 当前 kernel 保持压缩；涉及 run manifest、敏感字段、结构化诊断或 `LOG_NOT_AVAILABLE` 必须回读全文。 |

`SYSTEMIC_REPAIR_BEFORE_NEXT_PHASE`、`PHASE_RETROSPECTIVE_FINITE_DENOMINATOR` 与
`PHASE_RETROSPECTIVE_R4_GATE_PENDING` 是本表的明确 source anchors，供 operation memory 的
确定性路由回读；它们均不新增业务 Journey、wire、contract、数据库或运行授权。

## 冻结/复核前核验

1. `scripts/check/heritage-registry` 与 `--self-test`：26 项 denominator、copy/source hash 及 red fixture；
2. `scripts/check/project-memory`：新 operation memory、source anchor 和生成索引；
3. `scripts/check/standards-coverage --phase R3` 与 `--self-test`：R4 的两条 `PLANNED` 不得被当前 R3 当 active；
4. `scripts/check/claude-review-handoff --file <本批 review request>`：交接文本完整；
5. 每轮 solution-reasonableness 对抗审查均由 fresh 独立子 agent 执行；作者只做 verdict 后的辩证 intake，Claude 另做独立复核。
