---
id: operations.frontend-coding-standard
title: 前端编码规范的唯一内容源在 doc/platform,别处只放指针
type: operation
status: active
layer: routed
scope: every frontend implementation, review, and standards change
createdAt: 2026-08-16
taskKinds: ["implementation", "review", "design"]
domains: ["platform"]
consumerFaces: ["platform-admin", "operations-admin"]
owners: ["platform"]
impacts: ["governance"]
triggers: ["implementation", "review"]
assertions: ["FRONTEND_STANDARD_SINGLE_SOURCE", "FRONTEND_STANDARD_RULES_CARRY_REPO_EXEMPLAR", "FRONTEND_GATE_PROHIBITION_ONLY"]
sourceRefs: ["doc/platform/frontend-coding-standard.md"]
---

前端编码规范的**唯一内容源**是 `doc/platform/frontend-coding-standard.md`。

**本条只是指针,不复述规则内容。**

**三条不变量**:

1. **单一内容源** —— 新增或修改规则只改那份文件。
2. **每条规则必带反例;仓内正例是分级要求,不是准入门槛** ——
   有正例的规则整改指令是「照那一处改」,无正例的规则标注 `未验证`、整改时要**建立**正例。
   ⚠️ 本条以正本 §7 为准。**指针不得复述判据细节** —— 2026-08-16 这一行曾写成
   「找不到正例的规则不进规范」,与正本当天放宽后的口径相反,是本文件自己违反"只放指针"的实例。
3. **门只写禁止句** —— 「某文本不得出现」是门;「某文本必须出现」是假门,
   换个写法就假红、改坏行为保留字符串就假绿。

**⚠️ 与后台规范的一处相反结论**:后台 2-E 是「不接受为消除少量重复而造抽象」,
**前端 foundation 不适用** —— 目的地已存在且被广泛使用(`testId` 104 处、`useOverlayLock` 78 处)时,
该抽的现在就抽。判别口径见 [[dexter-design-preference-longtermism]]。

**为什么建这条**:2026-08-16 前六路逐文件评审前,前端有 44 条断言已是门、却**没有任何规范正本**
(与后台正好相反:后台规范写了但门一道没建)。实测两处的禁止性/存在性比例完全倒置,假门比真门多 —— **具体数字见正本,此处不复述**
(该比例随仓库变化,复述必然漂移;2026-08-16 已发生过一次)。
