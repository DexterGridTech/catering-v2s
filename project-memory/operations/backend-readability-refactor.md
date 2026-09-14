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
assertions: ["BACKEND_READABILITY_RULES_SOURCE","BACKEND_READABILITY_RECALL_ANCHOR","BACKEND_READABILITY_SEMANTIC_PERSISTENCE_BOUNDARY","BACKEND_READABILITY_SQL_SEMANTIC_NAMING","BACKEND_READABILITY_PROOF_SCOPE","BACKEND_READABILITY_CURRENT_BYTE_EVIDENCE","BACKEND_READABILITY_LAYOUT_BOUNDARY_DECISION"]
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
- CP 间缺少同输入双读或独立三维对账：`R-READ-06`；
- SQL 文本虽然归位,但 holder 仍以 `SQL_FRAGMENT_<number>` 等无语义编号命名：`R-READ-09`；
- test-only legacy adapter/repository 通过,却被误报为真实 persistence 生产边界已覆盖：`R-READ-10`；
- 把旧 run、focused proof 或局部源码事实当作当前全量证据：`R-READ-07`、`R-READ-08`。

## 本批已接受的通用边界（2026-09-14）

完整规则只读 `doc/platform/backend-coding-standard.md` 的 `R-READ-01` 到 `R-READ-10`，本记忆不复制正文。
后续 agent 需要记住以下决策与适用范围：

- `BACKEND_READABILITY_SEMANTIC_PERSISTENCE_BOUNDARY`：persistence 的最终公开边界按语义判断，必须是具名、类型化的
  业务读写方法；application/domain 不得以参数、record/wrapper 或通用 executor 透传 SQL 文本/fragment，动态条件选择
  与组合归 persistence。只改包名、只移动常量或只把 `String sql` 改名都不能冒充 ownership。
- `BACKEND_READABILITY_SQL_SEMANTIC_NAMING`：SQL holder 的命名必须帮助接手者定位 owner 事实和查询用途；编号式占位名是
  可读性缺陷，即使 SQL 值与执行行为没有变化。
- `BACKEND_READABILITY_PROOF_SCOPE`：测试替身可以保留，但必须声明它只证明哪一层；生产 persistence、事务、代理、注入和
  readback 的主张必须有生产边界证据，不能由 test-only seam 的绿替代。
- `BACKEND_READABILITY_CURRENT_BYTE_EVIDENCE`：任何全量、唯一、零、已闭合和最终 acceptance 结论都必须绑定当前字节、
  明确分母与 run；focused、静态、旧 run、预算 verifier 不能互相升级证据档位，business 与 cleanup 必须分开。
- `BACKEND_READABILITY_LAYOUT_BOUNDARY_DECISION`：本批不把 `application/persistence` 移动为 module 级直接 `persistence`
  peer;目录移动不是 persistence ownership 的充分证明，也不是本批阻断项。该接受决定只覆盖本批既有布局，不授权未来新类
  规避四段职责规范；新增或实际移动的类仍按真实职责选择目录。
- 任一 SQL owner 不明、动态构造无法可靠解析、事务/代理/readback 等价无法证明，必须保持 `OPEN` 或
  `UNVERIFIED_REQUIRES_EVIDENCE` 并按授权边界报告，不能通过保留 fragment/wrapper、静默缩小范围或旧 evidence 收口。

## 实施 agent 的最小回读集

先按当前 task 的六维 route 重开本条与全部命中 memory，再读取 `doc/platform/backend-coding-standard.md` §2.5、
`doc/platform/implementation-task-template.md` 的实施话术、当前详设/计划和 owning source。发现规则与源码或详设
冲突时，以当前 governing source 和用户授权边界为准，保留 `OPEN`/`UNVERIFIED_REQUIRES_EVIDENCE`，不要用新抽象、
fallback、静态门或旧 evidence 绕过冲突。
