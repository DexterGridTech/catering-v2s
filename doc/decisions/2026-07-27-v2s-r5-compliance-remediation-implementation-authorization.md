---
title: R5 合规整改 implementation 精确授权
status: DEXTER_ACCEPTED_AND_IMPLEMENTATION_AUTHORIZED
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
decisionOwner: Dexter
implementationAuthority: true
runtimeAuthority: true
seedResetAuthority: true
---

# R5 合规整改 implementation 精确授权

## 1. 接受的设计包

Dexter 接受 R5 合规整改 Roadmap、implementation-facing 详设、manifest、Codex 委托裁决与 Claude
round-2 `GO(M=0 / S=0 / N=2)`。本授权绑定以下当前字节：

- `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-review-round2-claude.md`
  `@481c16f24decd49d9268ec874ba3c7f2098488e35587dd3027ffda83a7d78fc4`；
- `doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md`
  `@56a6fcaf8e42d80de04693940624f27071fcc2303b18b6826805637c07ed68ab`；
- `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-granularity-manifest.json`
  `@e05265666c82c40398b0c991e285cda6a56183807196ce65e85364df334dea0d`；
- `doc/decisions/2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md`
  `@3624fe4f319b21d04ef8b6953eed9f049667ed2c857850bbe520176d8609dd56`。

## 2. 精确实施授权

Codex 获准从 `R5-CR00` 开始，严格按：

```text
CR00 → CR01 → CR02 → CR03 → CR04 → CR05 → CR06 → CR07 → CR08 → CR09
```

完成已接受 R5 合规整改的源码、契约、migration、测试、scripts、受管 DEV、explicit reset/seed、远端
Testcontainers、evidence 与收口。每包必须先完成其 package input、真实 red mutation、文件级增量核对、
full compliance admission 和 package exit；前包不是 PASS，不得开始后包。

运行与 seed/reset 只在其对应包的前置 package exit 全绿后允许：CR07 才可 reset/seed，CR08 才可
运行远端 Testcontainers、DEV 与全范围验证。`start/restart` 仍只允许 additive Flyway，绝不隐式 seed。

## 3. 不变边界

- 冻结 `106 = 39 platform-admin + 56 operations-admin + 11 public`、32 scenario、22 surface、25
  pageDesignKey、7 owner schema；
- 保持一个 `catering-business-server` 业务 deployable；`terminal-data-server` 仍是无 runtime、endpoint、
  contract、schema、migration、generated wire、seed 与业务代码的占位；
- 不恢复 R3-J02/C-02，不新增 MQ、通用 outbox、TDP、内部 OpenAPI client 或常态轮询；
- 已执行 migration 字节不可改写，只允许新增式演进；Heritage 只读且不得构成 runtime/build fallback；
- D-1～D-7 固定为 `B/A/A/A/A/B/B`，不重新打开产品裁决。

## 4. 唯一 review 入口

CR00–CR08 全部 package exit、business 与 cleanup evidence 关闭后，才进入 CR09。CR09 创建新的
`REVIEW_TARGET=IMPLEMENTATION` cycle，使用 fresh 独立子 agent 至多两轮盲审、作者辩证 intake、Claude
review，并一次性交给 Dexter 接受。中间 package receipt 不构成独立 review 或阶段性 GO。
