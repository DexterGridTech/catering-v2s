# TDP 数据变化通知与远程运维 · round 2 finding intake

```text
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_DESIGN_2026-10-04
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
INTAKE_OWNER=主agent
EVIDENCE_TIER=当前正式需求/详设/计划/owning source静态核验；无构建、测试、verify或动态验收
ROUND_FINAL_DECISION=SELF_DECIDED
INDEPENDENT_VERDICT=NO-GO M/S/N=1/3/1
```

该表是作者对独立 findings 的处置，不替代 round 2 独立 verdict，也不把未来实施证据标成当前通过。

| Finding | 主agent分类 | 核验、反例与最小处置 | 结果/剩余项 |
| --- | --- | --- | --- |
| M-1 数据库跨进程路由 | `CONFIRMED` | CBS 与 TDS 是独立进程，单纯调用模块command不能穿进程。Dexter已明确数据库中介，因此去掉先前待裁决的HTTP候选；详设改成CBS事务保存意图并NOTIFY operation identity、TDS listener唤醒后执行terminal-control具名SQL认领command、结果经具名SQL command原子落库、CBS调用方按需主动read。TDS DB角色不获owner表DML；NOTIFY不携带参数/结果；不重派未知操作。 | 设计通路已闭合。SQL授权红例、原子认领和结果写入仍须在CP-06实现并证明。 |
| S-1 实际依赖解析/官方依据 | `UNVERIFIED_REQUIRES_EVIDENCE` | build声明或lockfile不能证明本次解析class path；不据此推断API行为。保留实施计划进入每个相关CP前生成真实runtime/test依赖报告，并按精确版本核官方依据；未核前相关focused proof不得报PASS。 | 证据为`NOT_RUN`，明确列为CP前置；本轮不运行依赖任务。 |
| S-2 cache重启与listener重建场景 | `CONFIRMED` | 原来并发rollback场景不能证明重启时保留“已有空集合且时间非零”，也不能证明PG listener重建后重新读权威cache。新增`tdp.cache.restart.readback`及`tdp.listener.rebuild.current-cache`，并映射到R-06、V-06；场景明确区分cache row存在与完全不存在。 | 文档映射已补；场景均`NOT_RUN`。 |
| S-3 容量/留存混合 | `PARTIALLY_CONFIRMED` | reviewer指出原CBS 256条上限与留存决策混合；用户明确CBS不删除历史，因此删除CBS 256条与满额拒绝，不另加TTL/归档/删除。CBS单条遵守有限schema及65,536字节，整体由既有PostgreSQL卷自然容量约束；容量耗尽时typed写失败，保留原纪录。终端仍按R-16设置本地64条/4MiB容量、单条65,536字节；失效binding事实按原身份保留、永不由新binding发送，并继续占用该容量，满额拒绝新操作。 | 产品决策已闭合；TDC数值的资源依据与DB满额失败路径在CP-06验收。该边界使旧binding记录累计后可能占满终端容量，详设已明示，不增清理机制。 |
| N-1 CP-01门映射 | `CONFIRMED` | 补全terminal GET 8项身份全集，并逐类映射canonical输入、首个生成/校验入口、直接与verify执行模式、红夹具及错误标记；列出protocol generator、r5-edge-materialize、edge-codegen/openapi-contracts、capability-invariants、terminal-client-api与frontend-architecture面。counts从operation数据派生，不沿用旧数字。 | 作为拟实施门闭包写入详设；门/红例未运行，状态`NOT_RUN`。 |

## 收口说明

第二轮为本DESIGN cycle最后一轮；不发起第三轮。作者以`ROUND_FINAL_DECISION=SELF_DECIDED`关闭内部轮次，独立review原始NO-GO仍保留。当前修订文档可交外部Claude复评；这不等于作者或独立review给设计包GO，也不改变动态证据状态。剩余OPEN仅是实施CP的版本解析/官方依据及容量/SQL红例验证，不要求新的产品裁决；TDP实现、构建、测试、verify、DEV均未授权并仍为`NOT_RUN`。
