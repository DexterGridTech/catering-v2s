# catering-v2s AI 执行入口

`catering-v2s` 是 successor execution 仓，不是 `catering-all-v2` 的状态副本。任何会话都必须从本仓根开始，并按以下顺序恢复上下文：

1. 读取本文件与 `PLATFORM-BLUEPRINT.md`；
2. 从 `doc/platform/roadmap-program-registry.json` 选择显式 `programId`，只读取该程序 Roadmap 的 `CURRENT_*`；
3. 读取 `project-memory/index.md` 的全部 kernel，再用 `scripts/memory/query` 按六维路由读取全部命中原文；
4. 读取 `scripts/README.md` 和当前步骤明确引用的 decision、plan、contract 与 evidence；
5. 只有当前 Roadmap 的显式授权可以开始对应步骤。

## 不可突破的红线

- 一个业务 deployable；一个 PostgreSQL 数据库、多 owner schema、单一 Flyway history。
- 模块 owner 保有事实与命令主权；跨模块写只调用目标模块公开 command API，并加入同一 `REQUIRED` 事务。
- 跨 schema 读取只允许显式任务型 join；不得由 read edge 推导写入、锁、事务或 FK 权限。
- 初始不引入 MQ、通用 outbox、TDP、内部 OpenAPI client 或常态轮询。
- `x-consumer-faces` 是 HTTP 暴露面的单一真相；`platform-admin` 与 `operations-admin` 是两个独立 app。
- DEV start/restart 可执行 additive Flyway，但绝不 seed；reset/seed 是独立、显式、破坏性动作。
- Heritage 仓只读，禁止 runtime/build fallback；偏差在本仓新增 decision，不回写旧仓。
- 不 stage、commit、push、建分支或 worktree；Git 写操作始终由 Dexter 负责。
- R1 已关闭；Dexter 仅授权完成 standards coverage、R1 review resolution 与相应 current-truth 导航修订，完成后停在 R2 `IN_REVIEW`。除此以外，fresh R2 acceptance 与 W1 均未授权，禁止业务代码、DEV、seed/reset、数据库或动态运行。

项目 skill 的唯一真相根是 `.agents/skills/`；`.claude/skills` 只是同仓适配链接。禁止读取全局同名 skill 代替本仓 skill。Prompt hook 只推荐 skill，不查询或注入 memory/code；源码影响面只走 `rg`、源码和编译器。

任何 design、implementation、review 或 testing 会话还必须读取 `project-memory/decisions/deterministic-context-only.md` 与 `contracts/policy/standards-coverage-matrix.json`，回读其中命中的冻结 manifest 原文，并运行 `scripts/check/standards-coverage --phase <CURRENT_STEP>`。矩阵是 trace/enforcement 分母，不复制规则正文，也不替代 source reopen；`project-memory/index.md` 是生成导航，不是规则 memory anchor。

所有长运行与动态环境必须使用未来受管 `scripts/` 入口；业务结果与 cleanup 分开，cleanup 非 PASS 不得完成。首败先保留并读取日志，同一 signal 第二次尝试前必须完成边界诊断，禁止用延长 timeout、轮询或魔法等待冒充修复。

Git 仍由 Dexter 负责。
