# catering-v2s HANDOFF

本文件只登记当前架构明确推迟、且有客观激活事实的七项生产化欠账；它不是第二份 Roadmap，也不授权 R2/W1。触发事实成立后，必须在 v2s 新建 decision 与实施计划，不能把本表直接当作写入许可。

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
