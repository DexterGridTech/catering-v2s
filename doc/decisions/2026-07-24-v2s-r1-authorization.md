---
title: catering-v2s Roadmap R1 实施授权
status: active
createdAt: 2026-07-24
decisionOwner: Dexter
programContext: AI_FIRST_FOUNDATION
roadmapRef: doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md
implementationAuthority: R1_ONLY
---

# catering-v2s Roadmap R1 实施授权

Dexter 于 2026-07-24 明确指令：

> 授权R1，设定goal，完成R1并交给我和Claude复核

因此当前精确授权为：

```text
R1_AUTHORIZED=true
R1_SCOPE=W0_ITEMS_4_TO_7
TARGET_REPOSITORY=与 all-v2 同级的 catering-v2s
R2_AUTHORIZED=false
W1_AUTHORIZED=false
GIT_WRITE_AUTHORIZED=false
```

允许：

- 在现有 v2s 仓建立仓内 AI-first 入口、确定性 project-memory、最小 skills/hooks/scripts；
- 建立 v2s-native Roadmap Registry/active index、模块依赖 registry、HANDOFF、Heritage registry；
- 复制冻结输入并完成 Roadmap control-plane transfer；
- 运行 R1 静态检查、自测、红夹具、Codex 自审和 review handoff。

禁止：

- 进入 R2 fresh-session acceptance 或 R3/W1；
- 创建 `apps/**`、业务 OpenAPI、数据库 migration、backend/admin runtime 或业务测试；
- 启动 DEV、seed、reset 或其他动态业务环境；
- 修改 all-v2 runtime、contract、database、test、Registry 或 active index；
- 对任何仓库执行 Git stage、commit、push、branch 或 worktree 写操作。
