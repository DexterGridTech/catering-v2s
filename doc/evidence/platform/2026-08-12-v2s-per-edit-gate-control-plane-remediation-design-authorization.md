# per-edit 门控制面自锁整改详设授权记录

- 授权人：Dexter
- 日期：2026-08-12
- 原始问题：mandatory per-edit gate 的 closure `commandSha256` 与真实 gate 漂移，使 `readActivePackage()` 失败；普通包不能修改 gate/closure，既有 recovery 又复用同一校验链，形成控制面自锁。
- 授权内容：一次性形成覆盖 P0、P1、P2、P3 的完整 implementation-facing 详设与顺序实施计划；完成一次 Codex 独立设计审查后，交 Dexter 与 Claude 做唯一一轮外部设计评审。
- 固定节奏：一份整体详设 → 一轮 Claude DESIGN review → GO 后一个串行实施批次（P0→P1→P2→P3）→ 一轮 IMPLEMENTATION review。

implementationAuthority: false

本授权不允许实施 P0–P3，不允许修改控制 CLI、closure、gate、hook、active package 或生产/测试源码，也不允许 Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署或手工 SQL。设计 GO 不自动授权实施。
