# catering-v2s HANDOFF

本文件只登记当前架构明确推迟、且有客观激活事实的七项生产化欠账；它不是第二份 Roadmap，也不授权 R2/W1。触发事实成立后，必须在 v2s 新建 decision 与实施计划，不能把本表直接当作写入许可。

编码规范唯一正本入口：后台见 [`doc/platform/backend-coding-standard.md`](doc/platform/backend-coding-standard.md)，前端见 [`doc/platform/frontend-coding-standard.md`](doc/platform/frontend-coding-standard.md)。本文件只提供指针，不复制规范内容。

| id | currentBoundary | deferredReason | risk | activationTrigger | futureAcceptanceEvidence | decisionSource |
|---|---|---|---|---|---|---|
| CI_EXECUTION_PLATFORM | `scripts/verify` 由 Codex/Claude 本地显式执行，无 CI 平台 | solo+AI 阶段先保留证据语义 | 人工漏跑验证 | CI_PROVIDER_SELECTED | provider workflow 运行 verify、保存 business/cleanup 与失败红例 | [{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.1 现在就做(仅三件 + 一个顺手项)"}] |
| BACKUP_RESTORE | 仅本地/单服务器开发数据，无恢复演练 | 当前未启用持久生产环境 | 数据丢失后不可恢复 | PERSISTENT_ENVIRONMENT_ENABLED | 加密备份、恢复演练、RPO/RTO 结果与 cleanup PASS | [{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.2 本阶段明确不做"}] |
| SECRET_ROTATION | 仅本地开发密钥边界 | 当前无非本地 secret store | 凭据长期不轮换 | NON_LOCAL_SECRET_STORE_ENABLED | 双版本轮换、撤销旧密钥、应用无中断 readback | [{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.2 本阶段明确不做"}] |
| HEALTH_READINESS | 受管启动复用 walking-skeleton 入口断言，不建第二端点 | 防止漂移探针 | 编排器无法判定接流/摘流 | ORCHESTRATOR_REQUIRES_PROBES | liveness/readiness contract、故障红例、编排器接流/摘流证据 | [{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.1 现在就做(仅三件 + 一个顺手项)"}] |
| DEPLOYMENT_ROLLBACK | 单服务器重启即部署，无独立回滚故事 | 当前无第二部署环境 | 失败发布恢复依赖人工 | SECOND_DEPLOYMENT_ENVIRONMENT_ENABLED | 前后版本部署/回滚演练、schema compatibility 与 cleanup PASS | [{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.2 本阶段明确不做"}] |
| METRICS_ALERTING | run-scoped 结构化日志，无生产指标/告警平台 | 当前无生产流量 | 故障只能被动发现 | PRODUCTION_TRAFFIC_ENABLED | SLI/SLO、告警触发/恢复红绿证据、owner routing | [{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.2 本阶段明确不做"}] |
| RUNTIME_DB_ROLE_ISOLATION | 单 runtime DB role，可访问多 owner schema | solo+AI 单 deployable 暂不拆 credential | 单凭据扩大 schema blast radius | SECURITY_REVIEW_REQUIRES_SCHEMA_SCOPED_RUNTIME_CREDENTIALS | schema-scoped credential design、权限矩阵、跨 schema command/read/FK 回归 | [{"path":"doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md","anchor":"## 11. HANDOFF 初始生产化欠账"}] |
| DIAGNOSTIC_RETENTION_POLICY | S2 诊断事件已结构化输出，但保留期未按部署环境裁定 | 当前仍是本地/受管非生产诊断边界 | 无界增长或过短保留导致缺证 | NON_LOCAL_OBSERVABILITY_DEPLOYMENT_ENABLED | 环境级保留策略、清理证明、故障回放证据 | [{"path":"doc/decisions/2026-08-05-v2s-whole-engineering-d1-d7-rulings-claude.md","anchor":"D1"}] |
| DIAGNOSTIC_ACCESS_SUBJECTS | S2 诊断日志访问主体与权限未按部署环境裁定 | 当前无生产日志平台与访问角色 | 敏感诊断被越权读取 | NON_LOCAL_OBSERVABILITY_DEPLOYMENT_ENABLED | 访问主体、最小权限、审计与撤销证据 | [{"path":"doc/decisions/2026-08-05-v2s-whole-engineering-d1-d7-rulings-claude.md","anchor":"D1"}] |
| DIAGNOSTIC_COST_SAMPLING | S2 诊断成本采样/限流未按部署流量裁定 | 当前无生产流量，静态事件保持常开 | 高流量下日志成本不可控 | PRODUCTION_TRAFFIC_ENABLED | 采样策略、成本基线、关键失败不丢失与恢复证据 | [{"path":"doc/decisions/2026-08-05-v2s-whole-engineering-d1-d7-rulings-claude.md","anchor":"D1"}] |

激活 token 只允许上表 exact 值。`WHEN_NEEDED`、`SCALE_GROWS`、`TEAM_GT_N`、复合 `AND/OR` 或任意自由文本都不具备可验收性，不能通过校验。

## B1 后台健壮性欠账记录

本节是 B1 执行记录，不是新增 Roadmap，也不授权后续批次。它把当前仍存在的欠账与本批已关闭的历史欠账分开，避免把已修复事实冒充为现状。

| item | status | currentBoundary | activationOrEvidence |
|---|---|---|---|
| `CATALOG_NO_TRANSACTION_CONVENIENCE_CONSTRUCTOR` | `DEFERRED` | `CatalogOwnerService` 仍保留供测试/直接构造的无事务便捷构造器，且 `transactions == null` 分支仍存在；本轮不改测试台与构造路径。 | 需要另行批准测试构造路径或 owner 事务边界重构；不得由本表直接实施。 |
| `CATALOG_TRANSITION_TRANSACTION` | `CLOSED_CP18` | `transitionCatalogItemStatuses` 已由 CP-18 补上默认 `REQUIRED` 的 `@Transactional`；`transactions == null` 分支与 item-level `REQUIRES_NEW` 语义按详设保留。 | `CatalogBatchStatusTransitionIntegrationTest` 事务声明断言与受管 runner `r5-tc-1786940645555-23637`。 |
| `ADVISORY_LOCK_REMAINING_13` | `DEFERRED` | 除 B1 已统一的 receipt/replay 与三处 namespace collision 外，仍有 13 处 advisory-lock 形态未迁入 `AdvisoryLock`；本轮不扩大到未批准的横切统一。 | 需要后续对锁语义、namespace 与 owner 边界作明确设计并单独授权；不得由本表直接实施。 |

## P3 已确认的 frontend-architecture baseline 欠账（不属于 catalog/inventory P4）

P3 当前字节复跑 `scripts/check/frontend-architecture` 时，商品与库存新增的两个
`UNREGISTERED_TABLE` 已清零；剩余七条 `REQUIRED_EXPRESSION` 全部来自既有页面，
不是本域新引入的表格或控件。为避免后续 P4 将全仓 baseline 误归因于本域，登记如下：

| page | missing required expression | boundary |
|---|---|---|
| `platform-contract-overview` | `formatNameCode(row.storeRef.name, row.storeRef.code)` | existing platform-admin baseline |
| `platform-contract-overview` | `formatNameCode(row.tenantRef.name, row.tenantRef.code)` | existing platform-admin baseline |
| `operations-stores` | `formatNameCode(row.brand.name, row.brand.code)` | existing operations-admin baseline |
| `operations-stores` | `formatNameCode(row.tenant.name, row.tenant.code)` | existing operations-admin baseline |
| `operations-contracts` | `formatNameCode(row.store.name, row.store.code)` | existing operations-admin baseline |
| `operations-contracts` | `formatNameCode(row.tenant.name, row.tenant.code)` | existing operations-admin baseline |
| `operations-head-company-brand-selector` | `code: queryText` | existing operations-admin baseline |

本登记只保留归因与激活事实，不把 baseline 变成当前 P3/P4 的完成条件，也不授权
修改这些旧页面。若未来要清理，必须另开 owning page 的静态修复与独立证据。

## Test-health closed-loop deferred behavior coverage

本节是测试健康闭环整改的范围交接，不是生产化欠账，也不授权下一 Roadmap step：

- `COMPLEX_UI_BEHAVIOR`：`CatalogItemDrawer`、`StoreCreateDrawer` 等 AntD + RTK Query + Redux + router 业务组件没有被 `renderToStaticMarkup` 冒充行为覆盖。本次不引入 jsdom 或 L2；未来如需关闭，必须另有获批的真实行为证据。
- `L2_UNCOVERED_SURFACES`：audit-history、platform-admin 的密码找回/改密、workspace-administration 的源码文本断言已按本包规则删除；本次不得据此宣称这些 UI 行为已由日常回归覆盖，缺口保留为未来行为验证范围。
- `STATIC_ONLY_BOUNDARY`：本包的静态 checker、Node/Vitest/foundation proof、fixture contract cross-check 和 `--validate-only` 均不等于 Testcontainers、DEV、seed、受管 L2、浏览器、业务、cleanup 或性能成功；这些状态仍须独立授权与各自 runner evidence。

## Backend acceptance 未完成项

- `BACKEND_ACCEPTANCE_NEXT_OPERATIONS`：当前已有 28 条 IAM、ORG、商业合同、asset 与 catalog 的真实 fixture、HTTP 请求与业务字段断言；原 196 个 provider 壳、共享 SPI 与 registry 已下线。下次扩覆盖时，按 `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` 在对应的 `*AcceptanceScenarios.java` 增加真实业务 oracle；DB 操作数只供人工观察，不设预算门。

## 第二部分整改后续项

以下四项是 `doc/review/platform/2026-08-14-v2s-part-two-batches-claude.md` 的明确移出项；本节只保留边界，不构成实施授权。

- `PART_TWO_S12_DEAD_INDEXES`：inventory 与 fulfillment-production 的三条候选死索引尚无覆盖其 schema 的真实 workload，不能以 `idx_scan = 0` 判断。待真实 acceptance 覆盖到相关查询后，结合完整生产 SQL 使用面再判定。
- `PART_TWO_S13_MIGRATION_IF_NOT_EXISTS`：版本化迁移的 `IF NOT EXISTS` 形状漂移在当前可重建的单人阶段库没有可证伪收益；特别关注 `V20260812_130000_000` 对自动生成约束名的 `DROP CONSTRAINT IF EXISTS`，未来必须以第二 workspace 同内容 logo 的失败形态验证。
- `PART_TWO_M02_PLATFORM_ASSET_FULL_SCAN`：裁定甲下的全平台资产引用扫描是纯性能项；任何按 workspace 收窄都须先证明四种 JSONB 引用形态不漏判，且有真实成本数据，不能复用已作废的单一 `GIN + @>` 方案。
- `PART_TWO_RLS`：行级安全仍是这类跨 workspace SQL 风险的结构性解法；本部分点修不关闭“未来新增 SQL 漏加 scope”的风险。
- `INVENTORY_CURSOR_CONTRACT`：保留当前 Inventory 数字 offset continuation token，不在本部分把它改名或伪装为 keyset cursor。只有获批的分页契约修订后，才可设计并实现真正 keyset pagination；本决定对应第二部分 §2.III 的契约裁定边界。
