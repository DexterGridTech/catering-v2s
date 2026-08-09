# 后台性能重构详设｜Claude 复核请求

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN_RECHECK  
REVIEW_STATUS=POST_REMEDIATION_BYTES_UNREVIEWED  
IMPLEMENTATION_AUTHORITY=false

## 背景与目标

本轮只完成详设，不实施代码、不运行环境。第四轮复核后的关键收口是 SQL-M4 的适用边界：它不再把所有 `group_workspace` 读取、平台后台 `requireEnabled` 或“38 个 service 入口”误当作可删除的后认证状态门。Dexter 已裁定工作区商业停用后，既有 **operations** workspace session 在现有 TTL（最多 8h）内继续读写，不再创建新 operations session；未来安全紧急停用应改为工作区级 session revoke，而非恢复每命令状态查询。故 SQL-M4 只退役 5 个 post-auth `WorkspaceStatusLookup.isEnabled` call-site group（6 个 expression），保留 5 个 pre-auth expression；平台后台既有 selected-workspace enabled fact 仍保留。live DB JSONL hash 已从 discovery 输入移除；legacy allowlist 改为可审计 exact-set；M5 placeholder 已从 196 行矩阵物理删除；BP-U07 使用 owner-local typed facts / batch judgment，仍不允许每接口一条 SQL 或跨 owner 全局查询总线。

当前设计将复用严格限制为 **owner-local、typed、有限的事实 loader / batch judgment**；operation adapter 只静态声明它采用的抽象与 typed input，仍保有自己的业务主查询、revision/CAS、readback 与 owner 主权。读侧改为静态 `ReadContextKind` 选择 owner facts，而不是每个接口定义 SQL；预算以 request-scope 闭集 component 对账。请判断它是否能安全申请后续 implementation authorization。

## 必读输入（仓根相对路径）

- `doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md`
- `doc/review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md`
- `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md`（重点第 14 章）
- `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md`（重点 `BP-U07`、`B=78`、门处置）
- `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-operation-coverage-initial.md`
- `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-claude-recheck-intake.md`
- `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json`
- `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-recheck-claude.md`
- `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-recheck-round2-claude.md`
- `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-recheck-round3-claude.md`
- `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-recheck-round4-claude.md`

## 独立核验重点

1. SQL-M1～M6 是否只允许 owner-local、typed、有限的事实 loader / batch judgment；`factImplementations[]` 是否足以拒绝复制 loader、每 operation 一份 SQL、动态模板与全局 query bus，同时不误伤 allowlist 的 legacy typed-failure 读取。
2. SQL-M4 是否严格等于 5 个 post-auth `WorkspaceStatusLookup.isEnabled` call-site group（6 expression）退役，且 5 个 pre-auth expression（7 个 credential-flow operation）完整保留；`completePublicInvitation` 没有被无证据加入 retain set。核验 §9 的自然过期仅适用于 operations session 的既有读写；平台后台的 `WorkspaceAdministrationService.requireEnabled` 及 `PLATFORM_WORKSPACE` 的 `EnabledSelectedWorkspaceFact` 是否仍保留，15 条固定 B task read 与 audit 的 5 个 conditional branch 是否未被误并入 `PLATFORM_GLOBAL`。
3. `ReadContextKind` 是否保持最小 source-bound fact set：`OPERATIONS_SCOPED` 不得平白加载 group-workspace；components 是否闭集精确相加、任何 `UNCLASSIFIED` 失败，并仍保留 B.6.6 的内存授权与 primary SQL `EXISTS`。
4. 196 行矩阵是否真实且可机械重建：`MEASURED_SEED=55`、`MEASURED_HISTORICAL=105`、`UNMEASURED_BLOCKS_OPTIMIZATION=36`；两个 seed report 只有 54 endpoint group，而第 55 条来自实际 DB JSONL 的说明是否诚实；未测 GET 是否为 15 且均阻断 B=78。矩阵是否已物理移除第 11 列 M5 placeholder，SQL-M5 是否只在六表 mapping/applicability registry 中存在。
5. BP-U01 的 content-addressed evidence snapshot 是否足以阻断 live JSONL 追加篡改 coverage；本设计没有假装已产生 snapshot。
6. SQL-M5 六张表是否均有明确 owner/operation/typed I-O/保留语义/正反 fixture，且 project phase/category 的拒绝理由不被伪装为合并成功。
7. C5 两个 selection POST 是否已进入既有 74 条 normal command baseline、没有新增第 80 条；SQL-M1 是否保留 active assignment、ENABLED role、密码优先级与命令时 capability recheck；SQL-M3/M6 是否保留 CAS、写后 readback、BOM 首失败原行序、同一 REQUIRED 和 catalog 不直查 inventory。
8. live evidence digest 是否仅在 BP-U01 snapshot 记录；legacy allowlist 是否为 exact-set 而非可增长黑洞；read kind strict-superset 是否有真实 red mutation；BP-U07 的 M3/M4/M5 path denominator 是否完整。`app/application` 退役与 `code-layout` 处置是否可执行且没有伪报全仓绿；manifest 是否仍诚实声明 `POST_REMEDIATION_V1`、当前字节未经独立对抗 reviewer 复核且 `implementationAuthority=false`。

## 期望输出

请给 `GO` 或 `NO-GO`。若有 finding，请使用：

```text
[M|S|N]-xx
证据：<文件:行号或锚点>
有限影响面：<exact-set / owner / operation 数>
最小修复：<不扩大为全局重构的改法>
Dexter 决策：<需要/不需要，原因>
```

## 可直接复制给 Claude 的话术

```text
你好 Claude，烦请复核 catering-v2s 的后台性能重构 implementation-facing 详设。

本轮只修订设计，不实施代码、不运行环境。第四轮后请重点核验 SQL-M4 的**收缩**是否正确：只退役 5 个后认证 `WorkspaceStatusLookup.isEnabled` call-site group（6 个 expression），保留 5 个预认证 expression（对应 7 个 credential-flow operation）；不要把 `WorkspaceAdministrationService.requireEnabled`、session display join 或其他 group_workspace 读取误归为 M4。`completePublicInvitation` 当前没有直接 isEnabled 调用，不应无证据塞入保留集。

Dexter 已裁定商业停用的现有 **operations** session 至多 8h 自然过期，在窗口内读写均可继续、不得新建 operations session；未来紧急停用应在 status transition 做工作区级 session revoke，而非复原每命令状态检查。这个裁定不授权改变 platform-admin 的既有 disabled-workspace 403：`PLATFORM_WORKSPACE` 必须保留 `{workspaceUuid,key,status=ENABLED}` 的 owner-local fact，固定 15 条平台 B task read 加 audit 的 5 个 conditional branch 使用它；详情/列表反例不得被强行加门。

请同时确认 SQL-M1～M6 的复用是否限定为 owner-local、typed、有限事实 loader / batch judgment：不能退化为每个接口手写 SQL，也不能形成跨 owner 全局查询总线。请核验 196 行覆盖矩阵（seed 55、historical 105、unmeasured 36、未测 GET 15；M5 placeholder 已物理移除）、C5 的两个 POST 没有新增第80条 baseline、B.6.6 的 request-scope/ReadContext/EXISTS 机制、SQL 合并保留的授权/CAS/readback/BOM 语义、live evidence digest 仅由未来 snapshot 冻结、以及 budget kind 不可升格逃逸。

请从仓根阅读：
- doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md
- doc/review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md
- doc/review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md
- doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md
- doc/review/platform/2026-08-09-v2s-backend-performance-refactor-operation-coverage-initial.md
- doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-claude-recheck-intake.md
- doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json
- doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-recheck-claude.md
- doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-recheck-round3-claude.md

请给明确 GO 或 NO-GO；finding 请按 M/S/N 给出精确文件与行号/锚点、有限影响面、最小修复建议，以及是否需要 Dexter 决策。若建议将“禁用工作区”扩展为已认证 operations task read 的拒绝，请将其作为独立产品/安全行为变更审查，不要与性能优化合并。

授权边界：本次评审只决定是否可申请下一步 implementation authorization；不授权代码实施、运行环境、DEV、reset/seed、L2/UAT 或仓库控制。谢谢。
```
