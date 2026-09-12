---
id: operations.backend-readability-refactor
title: 后台 owner 可读性整改的规则召回锚点
type: operation
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["backend","platform"]
consumerFaces: ["backend"]
owners: ["backend","platform"]
impacts: ["architecture","database","evidence","governance","transaction"]
triggers: ["task-start","implementation","review","failure"]
assertions: ["BACKEND_READABILITY_RULES_SOURCE","BACKEND_READABILITY_RECALL_ANCHOR"]
sourceRefs: ["doc/platform/backend-coding-standard.md","project-memory/operations/backend-readability-refactor.md"]
---
# Backend owner 可读性整改：项目记忆召回锚点

本条是后台 owner 可读性整改的**召回入口**,不是第二份规范正文。规则唯一正本是
`doc/platform/backend-coding-standard.md` 的 `2.5` 节；项目记忆、详设和 review 记录只应引用规则编号，
不得复制规则正文。

## 适用时机

当任务涉及 owner service/coordinator 的职责拆分、facade 保留、事务边界迁移、private helper 归属、行为钉住、
focused/full backend acceptance 或实施步骤对账时命中本条。纯格式化、纯 bug 修复和没有结构变化的只读检查不是本条
的完整适用场景，但若发现同根失败，仍需回读 `R-READ-08` 的测量边界。

## 本次整改沉淀的失败族

以下名称用于 recall 和 review checklist，具体判据全部回到标准 `2.5`：

- 样本扫描或旧报告冒充当前全集：`R-READ-01`、`R-READ-08`；
- 以行数、public 数、SQL/JDBC 数决定职责边界：`R-READ-01`；
- facade、公开异常或 Spring 注入边界被结构清理破坏：`R-READ-02`；
- self-call、代理、`REQUIRES_NEW` 或编程式事务在移动后语义漂移：`R-READ-03`；
- coordinator、task-read、adapter 或带 owner 语义的 helper 被错误共享/归类：`R-READ-04`；
- 先搬结构后补行为证据，或用状态码/DB 操作数冒充业务 oracle：`R-READ-05`、`R-READ-07`；
- CP 间缺少同输入双读或独立三维对账：`R-READ-06`。

## 实施 agent 的最小回读集

先按当前 task 的六维 route 重开本条与全部命中 memory，再读取 `doc/platform/backend-coding-standard.md` §2.5、
`doc/platform/implementation-task-template.md` 的实施话术、当前详设/计划和 owning source。发现规则与源码或详设
冲突时，以当前 governing source 和用户授权边界为准，保留 `OPEN`/`UNVERIFIED_REQUIRES_EVIDENCE`，不要用新抽象、
fallback、静态门或旧 evidence 绕过冲突。
