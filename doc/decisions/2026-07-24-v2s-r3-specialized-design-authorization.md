---
title: catering-v2s R3 专项设计授权
status: active
createdAt: 2026-07-24
programContext: V2S_W0_W4_EXECUTION
roadmapRef: doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md
implementationAuthority: false
decisionOwner: Dexter
---

# catering-v2s R3 专项设计授权

## 1. 授权

Dexter 在 R2 关闭后明确回复：

> 授权R3 专项设计

该回复只授权 Codex 在 `catering-v2s` 仓内完成 R3/W1 的 spec、plan、implementation-facing 详设、路径级粒度清单、独立对抗审查、自审与 Claude 评审交接。

```text
CURRENT_STEP=R3
CURRENT_ACTIVITY=R3_SPECIALIZED_DESIGN
R3_DESIGN_AUTHORIZED=true
R3_DESIGN_STATUS=IMPLEMENTING
R3_IMPLEMENTATION_AUTHORIZED=false
W1_AUTHORIZED=false
IMPLEMENTATION_AUTHORITY=false
V2S_WRITE_AUTHORITY=false
GIT_OWNER=Dexter
```

## 2. 允许的写入

- 本授权决定、R3 实现面设计、设计粒度 manifest、对抗审查、自审、review request 与当前 Roadmap 导航；
- 为保持 fresh 会话不误读而同步更新的 `AGENTS.md`、仓内 skill 当前边界、`scripts/README.md` 和 project-memory kernel/index；
- 只读检查、静态 source/Heritage 回读与设计期 evidence 记录。

## 3. 明确不授权

- `apps/**`、业务 contract、generated source、migration、测试或任何 runtime 实现；
- Java 21 / Spring Boot compatibility spike 的编译、启动或依赖下载；
- DEV、seed/reset、PostgreSQL、容器、浏览器或其他动态运行；
- 把 R3 design `IN_REVIEW` 写成 `WALKING_SKELETON_READY` 或 R3 `GO`；
- 修改 Heritage source、回写 all-v2/all-v1/v4/v6；
- Git stage、commit、push、branch 或 worktree。

## 4. 后继门

设计必须先由独立 Claude 从方案合理性、owner、transaction、schema、security、contract、双 admin、failure 与 evidence oracle 维度审查。只有 Claude `GO(0 M / 0 S / N*)`、Dexter 接受具体 Journey/页面入口与版本硬阻塞处置，并再次精确授权 R3/W1 implementation，才能开始 `GATE_0`；`GATE_0` 未先绿时仍禁止第一行业务代码。

## 5. Codex 控制面维护权澄清

针对强制 handoff 已引用、但仓内缺失的 `scripts/check/implementation-design-granularity`，Dexter 进一步明确：

> 这个不需要我授权，codex有这个权利，可以直接做

据此，Codex 在已批准的 design/review/evidence 工作内拥有仓内控制面维护权，可以直接创建或修复完成当前交付所必需的 checker、supporting tool、production validator、self-test 与判别性 red fixture，不需要逐文件再次请求 Dexter 授权。该权利也适用于以后同类的必需控制面缺口，但不得借“checker”名义写入业务实现、contract、migration、runtime、数据或 Git。

本澄清只关闭 `implementation-design-granularity` 的权限疑义，不表示 Dexter 已接受 `R3-J01` 产品入口，也不授予 R3/W1 implementation。
