---
title: R4 design Codex adversarial self-review round 2
status: FINAL_SELF_DECIDED
createdAt: 2026-07-25
reviewTarget: DESIGN
reviewCycleId: R4-W2-DESIGN-20260725
reviewRound: 2
reviewRoundLimit: 2
roundFinalDecision: SELF_DECIDED
---

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=R4-W2-DESIGN-20260725
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

# R4 design Codex adversarial self-review round 2

## 用户任务

业务用户不直接使用 R4；此用户任务服务于 Codex/Claude 的工程验证任务：在业务迁移前，以一次 deterministic
`scripts/verify` 和少量真实 Testcontainers 负例，发现结构、契约、数据库、安全、
生成面、日志和旧路径退出的回归。R4 没有业务 Journey，不能生成业务 PASS。

## Dexter 立场

Dexter 要一次性完成 R4 详设和实施计划，后续 R4 实施仍需单独 exact authorization。
推荐的八单元允许按证据边界并行阅读、按依赖串行落地；它避免把每条规范做成独立仪式，
也避免把 R5 业务迁移提前塞入 R4。成本主要是一次真实 validator + red fixture +
Testcontainers baseline，预期低于 R5 返工成本；`scripts/verify` 必须分钟级，否则优先
移除低判别力门。

## 替代方案

更小替代是继续保留已有 R3 focused gates，把完整边界留到 R5；它无法及时发现错误
dependency/FK/generated closure，拒绝。更大替代是 CI 平台、统一验证服务或为每条规则
建立独立脚本；它增加生命周期和第二真相，拒绝。八个内部单元、一个 orchestrator、
真实 red mutation 和人审 checklist 是当前阶段的最小完整方案。

## UI 与交互

NOT_APPLICABLE：R4 不涉及新的 UI 或交互，理由是它不是业务 Journey；当前 R3 UI
只作为回归/traceability 输入。未来 UI 设计必须先对照 all-v2 对应做法并优先消费
`libraries/frontend/admin-ui-foundation`，不得重复实现已有基础能力。

## 审查意见复核

逐项重开 Roadmap、冻结 source、standards matrix、现有脚本与 R3 evidence 作为证据，
并以“status-only 激活”和“新增 UI 却未对照 all-v2”作为反例检查适用边界。更小修复是
只补缺失 binding/traceability；不因 finding 增建平台或扩张业务范围，避免过度设计成本。

- `CONFIRMED`：R4 当前标准 matrix 的 R4 planned enforcement 到期会由
  `scripts/check/standards-coverage --phase R4` fail closed；设计保留该红灯并把激活
  推迟到真实 implementation validator 存在后。
- `CONFIRMED`：R4 是 `NOT_A_BUSINESS_JOURNEY`；设计未添加 actor、登录、页面或业务结果。
- `CONFIRMED`：每个新门都声明 production path、self-test、行为变异 red fixture、
  evidence 五账和 cleanup；`scripts/verify` 只编排，不复制 owning 规则。
- `REJECTED_WITH_EVIDENCE`：把当前 R3 UI traceability 算作 R4 新 UI 的风险不成立；
  manifest 和 chapter map 明确它只作为回归输入，R4 不创建新 interaction artifact。
- `UNVERIFIED_REQUIRES_EVIDENCE`：R4 实现后的分钟级耗时、具体 ArchUnit/Testcontainers
  API 和 exact dependency versions 当前不能凭设计断言，必须留给实现期 spike/编译/真实测试。

## 方案合理性

`GO_FOR_DESIGN_REVIEW`。范围完整覆盖 Roadmap R4 交付物和 Part B–D 章节，且没有把
设计完成当作实施完成。没有发现需要 Dexter 作产品/Journey 决策的未决项。

问题是迁移前缺少统一且可失败的回归网；方案是八个 owning validator 加一个编排入口，
而非第二平台。其实施代价限定为真实 gate、red fixture 与真库测试，复杂度和预期返工
收益相称。

## 闭环核验

本轮未创建/修改 app、contract、database、Flyway、测试源码或业务代码，未运行 DEV、
seed/reset 或动态 R4。设计期 R4 standards coverage 仍会因 planned enforcement 返回
FAIL，这是当前实现未获授权的真实状态，不是 closure evidence。

`REVIEW_ROUND=2`、`REVIEW_ROUND_LIMIT=2`、`ROUND_FINAL_DECISION=SELF_DECIDED`；本 cycle
不再召集第三轮 Codex review。

## 结论

VERDICT=GO

R4 implementation-facing design 可进入 Claude/Dexter 全范围 review；未授权实施保持不变。
