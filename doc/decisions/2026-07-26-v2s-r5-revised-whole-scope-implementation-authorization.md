---
title: R5 修订全范围 implementation 精确授权
status: DEXTER_AUTHORIZED
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
decisionOwner: Dexter
implementationAuthority: true
---

# R5 修订全范围 implementation 精确授权

## 1. 授权事实

Dexter 已授权 Codex：按已接受的 R5 修订 implementation-facing design 完成全范围 implementation、验证与
evidence 收敛，并在全范围完成后一次性交由 Dexter 与 Claude 作 implementation review。

授权输入固定为：

- `doc/decisions/2026-07-26-v2s-r5-revised-design-final-acceptance.md`；
- `doc/plans/platform/2026-07-26-v2s-r5-revised-implementation-design-and-plan.md`；
- `doc/review/platform/2026-07-26-v2s-r5-revised-design-granularity-manifest.json`；
- 已接受的 R5 Journey、交互和 carry-over inventory。

## 2. 精确范围与顺序

按已冻结的 R5-U01 至 R5-U08 顺序实施：控制先行、106-operation contract/codegen、数据形态、owner command/
security/audit、静态资产、两 app substrate、22 surface 与操作历史 Modal、managed DEV/explicit seed/evidence。
不得改变 32 scenario、22 surface、25 pageDesignKey、7 owner schema；仅已接受的两个 audit operation 使 operation
closure 为 106 / 39 / 56 / 11。

## 3. 边界

R5 只交付一个 `catering-business-server` 业务 deployable；`terminal-data-server` 保持无 runtime、endpoint、
database、migration、generated wire、seed 或业务行为的占位。不得恢复 R3-J02/C-02，不新增 MQ、outbox、TDP、
内部 OpenAPI client 或常态轮询。Heritage 仅作只读/hash-bound 参考，绝不形成 runtime/build fallback。

DEV start/restart 可按设计执行 additive Flyway，seed/reset 仍须使用受管的显式入口；业务结果与 cleanup 分开闭合。

## 4. 交付与 review

本授权不产生逐 Journey review。R5 实施完毕后由一个新的 `REVIEW_TARGET=IMPLEMENTATION` cycle 进行至多两轮
独立子 agent 盲审、作者辩证 intake，并交 Claude 与 Dexter 做唯一 whole-scope implementation review。
