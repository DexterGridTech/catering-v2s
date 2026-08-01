---
title: catering-v2s R3 hash evidence checkpoint
status: ACCEPTED
createdAt: 2026-07-25
acceptedBy: Dexter
scope: R3-U01 and R3 closure evidence
---

# R3 hash evidence checkpoint

本决定落实 R3 implementation review 的 N-3，并由已接受的
`doc/decisions/2026-07-25-v2s-agent-coordination-and-control-boundary.md` 作为上位边界：
任何仓库控制动作都不是设计、实现、测试、评审、动态验证或 closure 的前置条件。

因此，R3 的 checkpoint 采用仓内、run-scoped 的 hash evidence，而不是外部仓库控制动作：

- `scripts/run/r3-walking-skeleton` 在动态业务动作前生成 `hash-checkpoint.json`；
- checkpoint 对 R3-U01 validator wiring 与 Gate 0 empty-source evidence 记录 SHA-256；
- `run-manifest.json` 记录 checkpoint 路径、checkpoint hash 和 `activeManagedResources`；
- cleanup 只有在 `activeManagedResources=0` 时才写 `cleanup=PASS`；
- checkpoint 自身不纳入自身 hash，避免循环；它证明 evidence/validator 输入的内容，不冒充业务完成。

该 checkpoint 只替代旧文档中与外部仓库控制动作相关的不可变 checkpoint 语义，不扩大 R3 范围，
不恢复 J02/C-02，不实现 TDP，也不改变 operations-admin 的静态边界。
