---
title: v2s W0 冻结输入完成后的新会话交接
status: ACTIVE_HANDOFF
date: 2026-07-24
sourceRepository: catering-all-v2
targetRepository: catering-v2s
gitOwner: DEXTER
implementationAuthority: false
---

# v2s W0 新会话交接

## 1. 当前结论

本轮完成了 v2s 服务形态的讨论、独立评审和两份 W0 输入冻结。当前没有 active goal，也没有 v2s 建仓或实施授权。

已冻结：

1. `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md`
   - `status: active`
   - `freezeStatus: W0_FROZEN_INPUT`
   - `acceptedBy: Dexter`
   - Claude 评审原结论 `GO(0 M / 0 S / 3 N)`，三条 N 已关闭；
2. `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md`
   - `status: active`
   - `freezeStatus: W0_FROZEN_INPUT`
   - `acceptedBy: Dexter`
   - Codex 独立评审 `GO(0 M / 0 S / 0 N)`；
3. `doc/plans/platform/2026-07-24-v2s-architecture-action-plan.md`
   - W0 第 1-3 项已关闭；
   - W0 第 4-7 项尚未实施。

manifest 与 ADR 冲突时，以 ADR 为准。两份冻结输入都明确写着 `implementationAuthority: false`。

## 2. 两个仓库的当前事实

当前权威源仓：

```text
/Users/dexter/Documents/workspace/idea/catering-all-v2
```

目标仓已经由用户侧建立为一个干净的初始 Git 仓库：

```text
/Users/dexter/Documents/workspace/idea/catering-v2s
branch: main
HEAD: 5b08350 Initial commit
remote: origin/main
tracked content: .idea/* + catering-v2s.iml
worktree: clean（本交接生成前只读核验）
```

“目录/仓库存在”不等于已经授权 Codex 写入。新会话必须先取得 Dexter 对 v2s W0 建仓入口的明确授权，才可修改该仓。

`catering-all-v2` 当前是大型脏工作区，包含大量用户和既有任务的修改、删除与未跟踪文件。本轮只新增/修改 v2s 架构文档；不得清理、回滚、覆盖或整理无关改动。全部 Git stage/commit/push 仍由 Dexter 负责。

## 3. 新会话必须先读

从 `catering-all-v2` 根开始：

1. `AGENTS.md`
2. `PLATFORM-BLUEPRINT.md`
3. `doc/platform/roadmap-program-registry.json`
4. 为本任务显式选择 `AI_FIRST_FOUNDATION` 程序，只读该程序的 `CURRENT_*`
5. `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md`
6. `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md`
7. `doc/plans/platform/2026-07-24-v2s-architecture-action-plan.md`
8. `doc/plans/platform/2026-07-24-v2s-architecture-grilling-working-notes.md`
9. `doc/review/platform/2026-07-24-v2s-service-shape-claude-review.md`
10. `doc/review/platform/2026-07-24-v2s-service-shape-claude-review-resolution.md`
11. `doc/review/platform/2026-07-24-v2s-carryover-manifest-codex-review.md`
12. `project-memory/index.md` 的 always-read kernel，以及 `cs-memory-recall` 对当前任务返回的全部原文
13. `scripts/README.md`

历史召回只走仓库内确定性路径：

```bash
scripts/context/recall-memory \
  --task-kinds review --domains platform \
  --consumer-faces all --owners product \
  --impacts governance --triggers all-v2
```

OpenViking/VK、codegraph/codebase-memory provider 已退役，不带入 v2s。代码结构查询走 `rg`、编译器和未来 v2s 自己的确定性 project-memory；不要恢复 provider、daemon 或第二套索引真相。

## 4. 已冻结的核心架构边界

1. 边缘使用标准基础设施反向代理，不自研 Java/Spring gateway deployable。
2. 后端只有一个业务 deployable；bounded context、owner、术语和不变量仍按模块保留。
3. PostgreSQL 单库、多 schema；一个 Flyway lifecycle、一份全局 history、UTC 秒+毫秒版本。
4. 跨模块写只经目标模块公开 command API；默认加入同一 `REQUIRED` 事务，禁止 `REQUIRES_NEW`。
5. coordinator 归发起用例模块 application 层，零资产、无表、无 repository、无独立不变量。
6. 页面任务读允许发起模块持有显式跨 schema join；禁止 DML、`FOR UPDATE`、`SELECT *` 和逐模块 API 拼装。
7. 写事务内的跨模块判断只走目标 owner 的窄 judgment API；不得跨 schema join，也不得返回实体载荷。
8. 强引用使用 `(workspace_key, id)` immediate 跨 schema FK；禁跨 owner CASCADE、禁 DEFERRABLE；FK 边必须登记且不得引入 command/schema 环。
9. `ExecutionContext` 在命令事务内作为首批读解析一次；目标 owner 不重复查询 IAM，但必须复查对象范围、状态、来源和 revision。
10. 单体业务主链禁止事件编排。`AFTER_COMMIT` 只允许具名传输/遥测副通道，永不修改业务状态；审计同事务直写。
11. 初始基线不带 MQ、通用 outbox、投影补偿、内部 OpenAPI client、TDP 或搜索服务。TDP 只有 Dexter 明确提出时才重新设计。
12. OpenAPI operation 的 `x-consumer-faces` 是 consumer 暴露面的唯一声明，同时驱动服务端安全面和两个 admin 的 generated 切片；face 不是授权。
13. 两个 admin 各自拥有 app policy/read model；foundation 不反向读取 app，也不承载 wire generated model。
14. 角色新建/更新、页面准入与动作授权等需要原子完成的业务，在单体同事务内显式完成，不保留旧的分离维护接口/页面/测试。
15. 不合理的常态轮询是设计红线。正常路径用同步事务或提交后直接触发；recovery/maintenance job 只补失败与崩溃，不作常态 dispatcher。
16. DEV `start/restart` 正常执行 Flyway schema migration，但绝不自动 seed；`seed` 仅在 Dexter 明确要求时运行；`reset` 是独立破坏性入口并按 allowlist 处理数据库和开发资产。

## 5. 下一任务与授权闸门

行动计划的下一阶段是 W0 第 4-7 项：

4. 重播种 v2s `project-memory`，删除或替换多服务拓扑专属规则；
5. 建立一份模块依赖 registry，以 `COMMAND / SCHEMA_FK / TASK_READ` 标记三类边；
6. 建立 v2s `HANDOFF.md`，登记七项初始生产化欠账与可判定 trigger；
7. 在 v2s 建仓入口被明确确认后，才把 all-v2 冻结为只读 Heritage 来源。

新会话的第一项实际工作只能是**只读 preflight**：

1. 回读第 3 节全部权威材料；
2. 只读核验 `catering-v2s` 当前 HEAD、remote、tracked files 与 clean 状态；
3. 输出 W0 第 4-7 项的 exact create/update/delete/retain 清单、真相来源、校验命令和授权边界；
4. 向 Dexter 只问一个明确问题：

> 是否授权在现有 `/Users/dexter/Documents/workspace/idea/catering-v2s` 仓库中执行 W0 第 4-7 项，并在完成后把 all-v2 记录为只读 Heritage 来源？

在 Dexter 明确授权前：

- 不写 `catering-v2s`；
- 不改变 all-v2 当前 Roadmap、runtime、数据库、契约、测试或冻结状态；
- 不进入 W1；
- 不启动 DEV、不 seed、不 reset；
- 不 stage、commit 或 push。

## 6. W0 第 4-7 项获授权后的完成标准

只有获得明确授权后，才在 v2s 中执行，并至少满足：

1. v2s 自有 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`project-memory/index.md` 和确定性路由入口建立；
2. 只携带 ADR/manifest 批准的 kernel，不复制 all-v2 多服务、MQ/投影、逐 Step permit、OpenViking/codegraph 等已退役规则；
3. 单一依赖 registry 同时登记三种 edge kind，并为 command/schema 无环、read 对账预留机器门；
4. `HANDOFF.md` 七项欠账每项都有可判定 trigger、future acceptance evidence 和 decision link；
5. all-v2 是否转为只读 Heritage 必须有明确状态记录，不能靠口头假设；
6. 所有创建文件通过链接、格式、重复真相和授权边界检查；
7. 不以 W0 文档/治理完成冒充 W1 walking skeleton 或业务实施完成；
8. 不执行 Git 写操作。

## 7. 可直接粘贴到新会话的提示词

```text
你是 catering-all-v2 / future catering-v2s 的续接 Codex。请从
/Users/dexter/Documents/workspace/idea/catering-all-v2
开始，先完整读取：

1. AGENTS.md
2. PLATFORM-BLUEPRINT.md
3. doc/platform/roadmap-program-registry.json，并为本任务显式选择 AI_FIRST_FOUNDATION，只读该程序 CURRENT_*
4. doc/handoffs/2026-07-24-v2s-w0-continuation-handoff.md
5. doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
6. doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md
7. doc/plans/platform/2026-07-24-v2s-architecture-action-plan.md
8. doc/plans/platform/2026-07-24-v2s-architecture-grilling-working-notes.md
9. 三份相关 review/resolution 原文
10. project-memory always-read kernel 与 cs-memory-recall 返回的全部原文
11. scripts/README.md

当前已确认：
- 服务形态 ADR 与 carryover manifest 均已由 Dexter 接受并冻结为 active / W0_FROZEN_INPUT；
- Codex 对 manifest 的独立评审是 GO(0 M / 0 S / 0 N)；
- 行动计划 W0 第 1-3 项 CLOSED，第 4-7 项待办；
- 两份冻结输入都 implementationAuthority: false；
- /Users/dexter/Documents/workspace/idea/catering-v2s 已存在，是 main 分支、HEAD 5b08350 Initial commit、origin/main、只含 .idea/* 与 catering-v2s.iml，交接时 worktree clean；
- catering-all-v2 是大型脏工作区，所有现有修改都属于用户或既有任务，禁止清理、覆盖或回滚；
- Git stage/commit/push 始终由 Dexter 负责。

请先做只读 preflight，不要写任何仓库：
1. 核对上述冻结状态、v2s HEAD/remote/clean 状态与 W0 第 4-7 项；
2. 给出 W0 第 4-7 项 exact create/update/delete/retain 清单、真相来源、校验命令和风险；
3. 明确保持：一个业务 deployable、单库多 schema、模块 owner 主权、同事务 command API、任务型 join、单一 Flyway history、初始无 MQ/outbox/TDP、无常态轮询、x-consumer-faces 单一真相、两个 admin 独立、DEV start/restart 不 seed；
4. 然后只向 Dexter 问一个授权问题：
“是否授权在现有 /Users/dexter/Documents/workspace/idea/catering-v2s 仓库中执行 W0 第 4-7 项，并在完成后把 all-v2 记录为只读 Heritage 来源？”

没有 Dexter 明确授权前，不写 catering-v2s，不改 all-v2 runtime/Roadmap/数据库/契约/测试，不进入 W1，不启动 DEV，不 seed/reset，不执行任何 Git 写操作。
```
