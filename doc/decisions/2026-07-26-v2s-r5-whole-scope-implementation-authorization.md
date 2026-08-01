---
title: R5 全范围 implementation 精确授权
status: DEXTER_AUTHORIZED
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
decisionOwner: Dexter
---

# R5 全范围 implementation 精确授权

## 1. 授权事实

Dexter 已明确授权：完成 R5 implementation，并在全范围实施、验证完成后交付 Dexter 与
Claude 做一次 R5 whole-scope implementation review。

本授权以当前已接受的 R5 implementation-facing design 为唯一范围边界：

- `32 scenarios / 104 operations`，含 `38 platform-admin / 55 operations-admin / 11 public`；
- 一个业务 deployable、七个 owner schema、同一 Flyway history、两个独立 admin app；
- 已冻结的 edge contracts、backend modules、数据库迁移、生成物、测试、远端 DEV、`r5-full`
  rich seed、managed scripts 与 L1/L2/L3/business/cleanup evidence；
- `doc/decisions/2026-07-26-v2s-r5-whole-scope-design-final-acceptance.md`、R5 Journey、交互、
  实施设计、执行蓝图、contract catalogs、frontend manifest 与 seed fixture contract。

## 2. 许可与限制

```text
R5_IMPLEMENTATION_AUTHORIZED=true
R5_RUNTIME_AUTHORIZED=true
R5_SEED_RESET_AUTHORIZED=true
R5_IMPLEMENTATION_REVIEW_REQUIRED=true
```

本授权不扩大任何产品、Journey、operation、数据模型或 UI 范围。`terminal-data-server` 仍只可
作为空占位；不得引入 MQ、通用 outbox、TDP、内部 OpenAPI client、常态轮询、默认身份或未冻结
的业务能力。所有动态动作仍须使用已接受设计指定的 managed scripts，并分别闭合业务与 cleanup
evidence。

## 3. 完成条件

R5 不按 unit 形成局部交付或独立 review。十二个 unit 只用于严格依赖顺序、失败定位和 evidence
分账；全部范围完成后，才建立新的 `REVIEW_TARGET=IMPLEMENTATION` cycle，依独立子 agent 两轮
盲审治理形成一个 whole-scope review packet，再交 Dexter 与 Claude。
