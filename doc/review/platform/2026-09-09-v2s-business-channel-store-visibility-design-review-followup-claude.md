---
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BUSINESS_CHANNEL_STORE_VISIBILITY_DESIGN_2026_09_08
REVIEW_ROUND=FOLLOW_UP_AFTER_CLAUDE_NO_GO
REVIEW_ROUND_LIMIT=NOT_APPLICABLE_CLAUDE_FOLLOW_UP
reviewerKind=CLAUDE
SOURCE=USER_PROVIDED_CLAUDE_FOLLOW_UP_REVIEW
VERDICT=GO
M/S/N=0/0/2
IMPLEMENTATION_AUTHORITY=DEXTER_AUTHORIZED_IN_CURRENT_TASK
---

# 经营渠道模板门店可见范围 · Claude follow-up DESIGN review

## 1. 结论与边界

Claude 对当前设计字节完成 follow-up DESIGN review，结论为 `GO`，`M/S/N=0/0/2`。上一轮的 M/S findings 已闭合；剩余两条为实施期一并处理的 note：

- `N-01`：补充三种门店状态门槛的维护期取舍说明，但不统一行为：列表计数与只读详情按非 `VOIDED`，候选与建渠道按当前可用的 `ENABLED`，编辑抽屉按可维护的 `ALL`。
- `N-02`：幂等场景将“same key different diff”改为“same key different final set”。

本 follow-up review 不新增产品语义。Dexter 已在当前任务中明确授权进入实施、全量验收、受管 reset/DEV/seed；授权仍严格限于本 Journey 的 STORE 经营渠道模板门店可见范围、相关读取和候选门禁，不包括其他 owner、UAT、部署或切流。

## 2. 已核实的固定形态

1. 保存请求只提交最终 `visibleStoreRefs`，canonical request 采用排序后的最终集合；owner 在同一 CAS/`REQUIRED` 事务内完成 scope、关系、version、audit 和权威 readback。
2. `SELECTED_PROJECT_STORES` 允许空集合；保存不因门店状态拒绝，`VOIDED` ref 可以被保留。
3. 整体替换与编辑抽屉 `storeStatusFilter=ALL` 成对存在；编辑读取不得隐藏 `VOIDED` 关系行，并须展示状态标注。
4. visible-store 读取的三种消费口径固定为：列表 count `NON_VOIDED`、只读详情 `NON_VOIDED`、编辑 `ALL`；候选与建渠道必须显式复核目标门店当前 `status=ENABLED`，`DISABLED`/`VOIDED` 必须 fail closed。
5. 既有门店渠道 list/detail 不加门店可见范围过滤；范围变更只影响下一次新建，不回收已有渠道。
6. acceptance/seed 必须保留至少两家同项目 `ENABLED` 门店，并覆盖 `DISABLED`/`VOIDED` 候选负向、VOIDED 关系“全量读取并标注→无关保存保留→主动剔除后删除”闭环。
7. UI 控件 roster 已按真实动作节点、唯一 `*TestIds.ts`、参数化业务身份和 `COMPOSITE_OPTION_ANCHOR` 约束；不得把 foundation 原语名、label、placeholder、行号、CSS/XPath 或 Modal wrapper 当作实现证据。

## 3. 实施后仍需证明

- fresh `INDEPENDENT_SUBAGENT` 的 `REVIEW_TARGET=IMPLEMENTATION` 盲审，不由本 follow-up 或作者会话替代；
- 所有代码改动完成后的全量 backend acceptance，不能由 focused runs 拼接；
- 无 HMR 的受管 browser L2：全部 case business PASS，join `COMPLETE`，missing/unexpected control 为零，business 与 cleanup 分开且均 PASS；
- 测试全绿后执行受管 reset、DEV、seed，并以产物与 readback 证明新关系与 fixture；
- 静态事实、backend business、L2 business、seed business、cleanup 与未执行项分开交付，无法复算的分母写 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 4. 当前 review 状态

`CLAUDE_FOLLOW_UP_DESIGN_REVIEW=GO`

`CLAUDE_FOLLOW_UP_M/S/N=0/0/2`

`IMPLEMENTATION_AUTHORITY=true` 仅因 Dexter 当前任务的明确授权成立；本文件本身不扩展授权。
