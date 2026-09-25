已由 `doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md` 取代；本文仅保留为历史决定。

---
title: v2s 每个 Roadmap R 的一次性设计实施复核规则
status: ACCEPTED
createdAt: 2026-07-25
acceptedBy: Dexter
scope: all Roadmap R delivery
---

# v2s 每个 Roadmap R 的一次性设计实施复核规则

每个 Roadmap 的 `R` 都是一个完整、不可拆分的交付单元，固定执行顺序：

1. 一次性完成该 R 的整体设计；
2. 一次性完成该 R 的整体实施；
3. 一次性对该 R 的完整范围进行统一复核。

不得把同一 `R` 按 Journey、模块、文件、App 或单项 gate 拆成独立设计确认、独立实施交付或独立复核。单项 gate、unit、Journey 和 evidence 只是该 R 统一交付与统一复核的内部组成部分。

当前 R3 的统一范围是 `R3-C01 + R3-TECH + U01-U07 + 双 App + 契约 + 数据库 + 测试 + evidence`。C-01 是 R3 唯一业务 Journey，但不得因此单独发起 C-01 review。
