---
title: S0 Round 2 post-remediation intake
binding: POST_REMEDIATION_V1
implementationAuthority: false
reviewCycleId: WHOLE-ENGINEERING-S0-DESIGN-20260805
reviewRound: 2
---

# S0 Round 2 finding intake

Round 2 已是本 cycle hard-stop；本文件不创建第三轮。对 Round 2 findings 的处置：

| Finding | 状态 | 处置 |
| --- | --- | --- |
| M1 RP-12-pre baseline 仍要求 red proof | CONFIRMED | 删除 redProof，增加 notApplicable 与互斥 predicate。 |
| M2 P6-1 observability source 泛称 | CONFIRMED | 在 S0-C/source baseline 登记 registry/controller/session/cookie/owner/runner/App exact source set。 |
| M3 RP-00b predicate 不可执行 | CONFIRMED | 增加 executionClass 五值、VERIFY canonical 引用、非 VERIFY reason、ALIAS 唯一 canonical 规则与 red mutations。 |
| S1 六类 denominator 有 glob/泛称 | CONFIRMED | 38 wrapper 改为可复算 command+count+sorted hash；S0-B/C/D source table 继续以 exact paths/hash 为准。 |
| N1 | ACCEPTED | RM1-P6-3 与 R5 fixed argv 已显式区分。 |

当前 bytes 未被该独立 reviewer 重审，implementationAuthority 保持 false，需 Claude recheck。P6-1 exact source map 不授权立即实现；D1 仍决定 RP-03 sink/retention/access/edge face。
