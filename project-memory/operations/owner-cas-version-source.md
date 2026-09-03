---
id: operations.owner-cas-version-source
status: active
layer: routed
taskKinds: ["implementation","testing","review"]
domains: ["backend","admin-ui","platform"]
consumerFaces: ["operations-admin","platform-admin"]
owners: ["backend","frontend-platform"]
impacts: ["runtime","contract","evidence"]
triggers: ["implementation","failure","review"]
assertions: ["COMMAND_EXPECTED_VERSION_MUST_MATCH_OWNER_AGGREGATE","ROW_VERSION_IS_NOT_AGGREGATE_CAS_VERSION","FRONTEND_COMMAND_USES_OWNER_READ_VERSION","VERSION_CONFLICT_IS_NOT_FIXED_BY_RETRY"]
sourceRefs: ["apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java","apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/infrastructure/JdbcSalesMenuRepository.java","apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx","project-memory/operations/owner-cas-version-source.md"]
---

# owner CAS 版本必须来自 CAS 目标聚合

实现带 `expectedVersion` 的命令前，必须沿 owning source 同时核对：owner 的锁定与版本比较、CAS SQL 的目标行、命令的 readback，以及前端当前 read-model 的版本来源。若 CAS 目标是聚合根，命令必须使用该聚合的 owner read-model 版本；子行、版本快照或资源的 `version` 只能用于它们各自的目标，不能代替聚合 CAS 版本。

这个失败模式的典型表现是所有同一聚合的编辑动作稳定返回 `409 VERSION_CONFLICT`，而 owner fixture/直接命令仍能成功：这优先指向前端版本来源或 read-model 映射，不得先修改 owner CAS、删除锁、重试、延长 timeout 或放宽断言。最小修复是把正确聚合版本从已有详情 read-model 传到命令，并记录 item/aggregate version 的标量诊断；必须保留真实 CAS 与 stale-version 失败证明。

反例边界：如果 owning source 明确以子行作为 CAS 目标，则使用子行版本；不能仅凭字段名、页面名称或其他模块形状推断。任何版本语义不清必须先读 owner 实现和同模块 sibling command，再决定修改层次。
