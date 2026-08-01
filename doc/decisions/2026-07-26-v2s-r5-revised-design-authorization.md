---
title: R5 修订 implementation-facing design 授权
status: DEXTER_AUTHORIZED_DESIGN_ONLY
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
decisionOwner: Dexter
implementationAuthority: false
---

# R5 修订详设授权

## 1. 授权事实

Dexter 已指示停止当时进行中的 R5 实施，依据
`doc/review/platform/2026-07-26-v2s-problem-discovery-and-direction-claude.md` 重新完成 R5
implementation-facing 详设与实施计划，并在通过既有设计管线后才按新目标实施。

以下输入继续冻结、不得重新推导或改动：32 scenario、22 surface、25 pageDesignKey、7 owner
schema、G-01~G-12、D-01~D-11，以及已经接受的 Journey、交互工件和“线框以 v2 为准”的裁决。
R-11/R-13/R-14 已将操作历史纳入范围。Dexter 随后明确裁定按现有 scalar `face` 模型拆成
`getPlatformEntityAuditHistory` 与 `getOperationsEntityAuditHistory` 两个 operation；operation 分母由
104 扩为 **106**，face closure 为 `platform-admin=39`、`operations-admin=56`、`public=11`。这两个
operation 是同一已接受 Journey 的 face-specific edge declaration，不新增 scenario、surface 或
pageDesignKey。

## 2. 修订范围

修订详设必须逐项覆盖问题总册 §4 的 A–H 八档发现，并为每一项提供明确设计落点或
`NOT_APPLICABLE` 理由；extension/role、资产/视频与合同货号形态以已决新设计为准。已落字节只做
亲验盘点和 `RETAIN / REPLACE_SHAPE / ADDITIVE_EVOLVE` disposition，禁止为“重写”而改写已执行
migration 的字节。

审计“操作历史”是本轮唯一新增 UI-bearing Journey：其 Master–Detail Modal 已由 Dexter 于
2026-07-26 接受，左侧时间优先分页列表，点击项在右侧展示详情；它不新增 pageDesignKey、第二套
权限或逐项详情 operation。

## 3. 精确边界

```text
R5_REVISED_DESIGN_AUTHORIZED=true
R5_REVISED_IMPLEMENTATION_AUTHORIZED=false
R5_REVISED_RUNTIME_AUTHORIZED=false
R5_REVISED_SEED_RESET_AUTHORIZED=false
```

此授权只允许设计、manifest、独立盲审材料、Claude review 请求与相应 evidence 文档写入。它不
允许修改 app、library、contract、database、Flyway、test、脚本或业务源码，不允许 DEV、动态运行、
seed/reset，也不恢复 R3-J02/C-02。

## 4. 后续门槛

修订详设必须先有新的 granularity manifest，再经过 fresh 独立子 agent 盲审（最多两轮）、Claude
review 与 Dexter 接受。任一设计 gate 未完成前，不得把旧 implementation 授权、已完成的局部实现或
本决定本身解释为新的实施许可。
