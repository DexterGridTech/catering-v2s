---
title: 已确认业务语料项目记忆纳入实施 Codex 自审
status: GO
createdAt: 2026-07-25
implementationAuthority: memory_control_plane_only
---

# 已确认业务语料项目记忆纳入实施 Codex 自审

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=BUSINESS-CORPUS-MEMORY-ADOPTION-IMPLEMENTATION-2026-07-25
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2

## 用户任务

未来业务设计与实施的业务用户需要在任务开始时得到已确认的 G-01–G-12 业务语言，同时在
遇到未确认领域时看到“必须由 Dexter 决定何时 grill”的诚实边界，而不是由旧技术名
或聊天记忆猜测业务。

## Dexter 立场

Dexter 已接受 Unit A/B：只把已确认语料纳入项目记忆和 deterministic route；不扩张为
R3/W1、contract、数据库、业务代码或自动 grill。当前代码改动必须服务这一个控制面
目标，且 Git 仍由 Dexter 负责。

## 替代方案

- 只新增 Markdown、不更新 inventory/denominator：更少改动，但 active memory 会被拒绝或不被 index 路由；不选。
- 将 corpus 置入 always-read kernel：访问更“保险”，但会拖慢无关任务并违背已接受的 right-size 方案；不选。
- 用词干匹配脚本决定是否读取：看似自动，但会把词面误作业务理解；不选。
- 采用三份 routed anchor + inventory 16-entry denominator + 生成 index：推荐。

## 方案合理性

实现准确覆盖接受范围：canonical 只提升 G-01–G-12，read policy 保留 source reopen 和
禁推，parked 表只记录问题与来源；`cli.mjs` 的固定分母从 13 更新为 16，并把输出的
routed 数改为根据实际条目计算，避免 16 条时仍报告 routed=7。复杂度是三份小文档和
两行控制面逻辑，收益是新 memory 会被确定性读取且 index/check 仍 fail-closed。

## UI 与交互

NOT_APPLICABLE：理由是本实现没有用户界面、页面操作或业务 Journey；它只改变 agent
启动任务时可读取的项目记忆。未来 UI 实现仍必须独立验证用户任务、操作路径与服务端
授权，不能以本 memory 改动替代。

## 审查意见复核

NOT_APPLICABLE：本 implementation cycle 未收到新的外部 finding。设计 cycle 中 Claude
的 N-1/N-2/N-3 已在独立的 round-2 resolution 中处置；本次只核验已接受的 memory
落地，没有把 Claude 结论盲目扩张为新的技术或业务范围。

## 实施代码核验

- 重开源码 `tools/project-memory/cli.mjs`：确认 inventory SHA、16-entry envelope 与动态
  `KERNEL/ROUTED` 输出均与新增 entries 对应；没有放宽 source/assertion/route 校验。
- 重开 active memory 文档和 `required-inventory.json`：三份 entry 的 id、route、assertion
  和 source refs 双向一致，canonical 内容只含 G-01–G-12，parked 文件没有产品答案。
- 可执行 evidence：`scripts/memory/build-index` 输出 `ENTRIES=16/KERNEL=6/ROUTED=10`；
  `scripts/check/project-memory` 的 assertion-omission 与 source-substitution red controls
  均真红；design/implementation 的六维 recall smoke 返回预期 anchor。
- 业务用户行为复查：未来相关 design/implementation 会读到 canonical/read policy；仅
  design/review 会读到 parked，且 parked 明说无 Dexter 启动不得 grill，因此不会将“旁支
  存在”误作产品行动或自动排期。

## 闭环核验

- Dexter 接受已写入 `doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md`；
- generated index 由 `scripts/memory/build-index` 生成，未手改；
- 语义仍由 review/Dexter 决定，未新增关键词 checker、provider 或 daemon；
- 未改 Roadmap、业务 contract、数据库、应用代码、DEV/seed/reset、动态运行或 Git。

## 结论

```text
VERDICT=GO
M=0
S=0
N=0
IMPLEMENTATION_SCOPE=MEMORY_CONTROL_PLANE_ONLY
```

本轮实现可接受。未来 grill 仍只在 Dexter 按进展明确启动时恢复；本 conclusion 不改变
R3/W1 的未授权状态。
