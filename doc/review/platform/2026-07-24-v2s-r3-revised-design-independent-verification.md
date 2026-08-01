---
title: catering-v2s R3 修订设计 fresh-context 独立复核
status: NO_GO
createdAt: 2026-07-24
programContext: V2S_W0_W4_EXECUTION
reviewerTask: /root/r3_revised_design_verification
reviewerContext: fork_turns=none
reviewCycleId: R3-SPECIALIZED-DESIGN
reviewTarget: DESIGN
reviewRound: 2
reviewRoundLimit: 2
roundFinalDecision: SELF_DECIDED_BY_CODEX_AFTER_RESOLUTION
repositoryWritePerformed: false
implementationAuthority: false
---

# catering-v2s R3 修订设计 fresh-context 独立复核

## 独立性与输入

reviewer 以新的无父会话上下文只读启动，没有被告知作者希望关闭哪些 finding。它从仓根入口、当前 Roadmap、冻结 memory/ADR/manifest 与 standards 独立恢复标准，再核验修订设计、首轮 review/resolution、granularity manifest、作者 review packet 与真实 checker 结果；未编辑仓库，未运行 runtime、数据库、容器、浏览器或 Git 写操作。

```text
REVIEWED_DESIGN_SHA256=50f136d1c852b4ac974f8855bdb63fc04f07edc0a4cac3290593619f3bfc3ecd
REVIEWED_MANIFEST_SHA256=beb3a48ddcfafbad3b12c9d7d763ab9d510da516b5b6086904f8d10fa7c68932
```

## 原 finding 复核

| Finding | 独立状态 | 结论 |
|---|---|---|
| `IR3-M-001` | `DEXTER_DECISION`，开放 | `R3-J01` 仍只是候选，设计与 manifest 均诚实保留 Dexter 接受门。 |
| `IR3-M-002` | `CONFIRMED`，开放 | checker 确实不存在；handoff 实跑失败。没有绕过或推导 implementation authority。 |
| `IR3-M-003` | `PARTIALLY_CONFIRMED` | 两个 current-session operation 和 `8/5/3` 关闭了“刷新无入口”；但没有冻结两个 app 恢复 guard/scope 所需最小字段及 revoked/expired/401 语义，计数闭合不等于 refresh-safe 语义闭合。 |
| `IR3-M-004` | `PARTIALLY_CONFIRMED` | readiness 与 production conformity 两段式已消除逻辑循环；但 `Dexter-owned Git baseline` 没有定义不可变 commit/tree、发布时点或 descendant 证明。当前 dirty worktree/HEAD 不能作时间 oracle。 |
| `IR3-S-001` | `CONFIRMED_CLOSED` | expected denial 同一 `REQUIRED` 正常提交脱敏计数/security audit，不建 session/success audit；unexpected exception 整体回滚且禁止 `REQUIRES_NEW`。 |
| `IR3-S-002` | `UNVERIFIED_REQUIRES_EVIDENCE` | Origin/Fetch Metadata/JSON/default-deny CORS 方向合理，但 canonical origin 来源/规范化、filter 顺序、Spring CSRF 替代形态、OPTIONS/CORS response oracle 与缺失 Fetch Metadata 的兼容性未冻结。 |
| `IR3-N-001` | 设计修订确认；运行兼容性未验证 | `useSpringBoot4=true` 与 `useJackson3=true` 已写入；实际 generated compile 仍须获授权 spike，文档不能代证。 |
| `IR3-N-002` | `CONFIRMED_CLOSED` | 设计已统一为三个 owner migration 文件、一份 global history。 |

## 新增与残余 findings

### R3-VERIFY-S-001 — current-session schema 未冻结

最小修复：只冻结两个 app-owned guard/scope 实际需要的最小字段，以及 valid/expired/revoked 的 `200/401` 行为与 refresh L2；不增加业务 Journey、角色或 capability 模型。

### R3-VERIFY-S-002 — Gate 0 ordering oracle 不够可执行

最小修复：Gate 0 PASS 后硬停止，由 Dexter 创建包含 validators、readiness evidence 与空 business-source inventory 的不可变 checkpoint commit；后续 U02-U05 必须证明目标 commit 是该 checkpoint 的 descendant。无需新增平台或时间服务。

### R3-VERIFY-S-003 — browser-forgery policy 尚未形成确定性实施契约

最小修复：per-face canonical origin 只来自服务端配置，不得从 Host/Forwarded 推导；冻结 `edge credential -> browser-forgery -> session/auth` 顺序；明确 custom filter 替代 Spring token 的唯一配置；补 foreign/missing/null Origin、missing/cross-site Fetch Metadata、form、OPTIONS 与无 CORS allow headers oracle。若授权 spike 失败，再单线改用 Spring CSRF token，不做双实现。

### R3-VERIFY-N-001 — manifest 残留旧名

manifest 仍写 `six-operation` 和 `workspace-directory feature`，与现行 `8/5/3` 和 registration-check 冲突。

### R3-VERIFY-N-002 — 旧 review 输入无法重开 bytes

首轮 review 记录旧 design/manifest hash，但路径当时未跟踪且已被修订；仓内没有旧 snapshot/commit/blob，无法独立重算 resolution 所称 reviewed input。禁止用事后重建文件冒充原字节。

### R3-DESIGN-N-003 — 版本集合尚待 spike

Gradle、ArchUnit 与前端版本集合仍需一条获授权 spike decision；不能提前扩成兼容双线。

## 独立 verdict

```text
VERDICT=NO_GO
M=2
S=3
N=3
```

作者当时的 `NO_GO(2 M / 0 S / 1 N)` 偏乐观：两个 M 的确仍开放，但六个技术 finding 中 current-session、checkpoint 和 browser-forgery 尚未达到可执行粒度。

## 只读证据

```text
scripts/check/standards-coverage --phase R3
  FAIL: PLANNED_ENFORCEMENT_OVERDUE:D.1.L01
scripts/check/heritage-registry
  PASS
scripts/check/project-memory
  PASS
scripts/check/codex-self-review --file ...r3-design-codex-self-review.md
  PASS / REVIEW_TARGET=DESIGN
scripts/check/claude-review-handoff --file ...r3-design-review-request.md
  FAIL: missing scripts/check/implementation-design-granularity
```

standards denominator、冻结 source anchors/hash、`implementationAuthority=false`、`R3_IMPLEMENTATION_AUTHORIZED=false` 与 `W1_AUTHORIZED=false` 均保持。

## 授权边界

本复核不授权 checker 修补、`R3-J01` 产品接受、Gate 0、业务源码、contract、migration、DEV、seed/reset、动态 evidence 或 Git 操作。
