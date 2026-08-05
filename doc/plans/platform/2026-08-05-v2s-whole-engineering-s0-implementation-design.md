---
title: 全工程修复 S0 implementation-facing 详设：分母、控制关系与底座决策输入
status: PROPOSED_REVIEW_ONLY
programId: V2S_W0_W4_EXECUTION
goalId: WHOLE_ENGINEERING_REMEDIATION_20260805
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
reviewCycleId: WHOLE-ENGINEERING-S0-DESIGN-20260805
reviewRoundLimit: 2
---

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# S0 设计范围

本阶段只冻结四类实施输入，不修改生产源码、契约、脚本行为或运行环境：

1. RP-00：`scripts/check` 38 个顶层 wrapper 的真实分类与 source map；
2. RP-00b：check registry 的最小机械关系完整性设计；
3. RP-01/RP-02a：154 operation 消费者对账与 workload 恢复的 implementation-facing 详设；
4. RP-03：常驻可观测性架构决定输入与 backend/frontend/bootstrap 三层边界；
5. RP-12：节点 token 477 occurrences / 320 lines 的分类 inventory 与 RP-12-pre 的安全微单元准入。

RP-02b 的 D4 validator、RP-04/05/06 的实现、RP-12a..n 集合替换均不在本阶段写入源码；它们只接收本阶段的 source map 和决策依赖。

## 0.1 S0 package-exit source-compliance 分母

以下是本阶段每个 unit 的完整六类 denominator；后续 implementation manifest 必须保留这些 source/hash，不得改成目录泛称或延后补齐。

| unit | memory/assertion | original/standard source | approved assertions | forbidden pseudo-fixes | exact source/change surface | detail-design/incremental criteria | due standards |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S0-A | `project-memory/kernel/01..06`、`decisions/deterministic-context-only.md`、`operations/verification-governance.md` | `scripts/README.md`、`doc/decisions/2026-07-24-v2s-verification-governance.md` | 38-wrapper is discovery denominator; 23 verify units and 16 catalog refs remain separate | registry-only hash edit; all no-arg gates; double-count alias; dynamic check as static | `S0 baseline.S0-A.sourcePaths/sourceHashes`：38 个 wrapper 文件、`scripts/verify`、`tools/verify-gates/verify.mjs`、catalog 与治理 decision | wrapper↔registry 字段、executionClass/aggregate 谓词、四类 red mutation、每个实际变更点的 Pre/Post receipt | standards coverage, verification governance, deterministic context |
| S0-B | `kernel/03/04/05`、`decisions/http-crud-efficiency-design-redlines.md`、`operations/implementation-source-reread-discipline.md` | `S0 baseline.S0-B.sourcePaths/sourceHashes`：root OpenAPI、引用的 paths/schemas、generated registry、U01 evidence/catalog/problem-family、diagnostic facts/workloads/tests/fixtures 与 owner controllers | 154 registry equality; 144 facts; 121 catalog crosswalk; four recovery calls | replace 147 with 154 blindly; derive facts from route; remove allowed query projectId; seed/runtime proof | 同上 exact finite path set；no runtime change | 154↔144↔121 crosswalk、10 missing fact dispositions、create-body/query-context 边界、四步 recovery 与七步 invitation 的静态 red proof | contract-face, source coverage, logging/managed-run rules |
| S0-C | `kernel/05`、`decisions/observability-and-acceptance-standard.md`、`pitfalls/log-first-failure-retry.md` | `S0 baseline.S0-C.sourcePaths/sourceHashes`：backend interceptor/bootstrap、registry/controller/session/cookie/owner、两个 App、foundation logger/ErrorBoundary、runner 与 observability standard | one architecture contract; three implementation faces; no sensitive fields | controller-local logger; memory-only sink; console/stdout; payload/secret logging | 同上 exact finite path set；不得以目录或“public OTP/recovery sources”占位 | source-map path/hash set equality、三实现面与 completion-event criteria、敏感字段 red proof、每个 source reread receipt | observability acceptance, managed resource/log proof |
| S0-D | `kernel/01/02/04/05`、`decisions/identified-finding-generalization.md`、`confirmed-business-language-corpus.md` | `S0 baseline.S0-D.sourcePaths/sourceHashes`：五集合 owner sources、generated enums 与 service authentication source | 477 occurrences/320 lines; 673 independent discovery; same-name different semantics | global replace; inferred SQL classification; inventing a fail-closed bug | 同上 exact finite path set；SQL literal 另行扫描 | 五集合 membership/disposition、477/320 与 673 分母隔离、NOT_APPLICABLE 互斥、逐点双读与 incremental set equality | code-layout, source reread, semantic review checklist |

## 1. 业务任务、替代方案与边界

业务任务是让后续修复能回答“哪些 operation、哪些 runner、哪些 check、哪些节点类型和哪些日志边界必须闭合”，并使 AI 能从稳定的日志、契约和 source-owned 分母中诊断失败。Dexter 的阶段意图是先低成本冻结事实和决策，再将可执行单元分批实施；本阶段不以静态绿色冒充业务 PASS。

备选方案是直接修 RP-02 的数字、把 38 个 checker 全接入 verify、或全局替换节点字符串。该方案拒绝，因为它无法区分 owner/phase/dynamic cleanup，且会把 673 次全业务枚举与节点类型语义混算。采用本设计可保留反例、降低共享写冲突，并让后续每个 package 有自己的 business/cleanup 分母。

## 2. S0 单元

### S0-A · RP-00 / RP-00b 控制面分类

分母是 `scripts/check/` 下 38 个顶层可执行 wrapper，精确枚举命令为 `find scripts/check -maxdepth 1 -type f -perm -111 -print | LC_ALL=C sort`，当前排序清单 hash 为 `ace401e9267b7dd36cc5f5b3e193211d728e04b6468658655f3a9d8acff3389d`；另行记录 `scripts/verify` 的 23 个顺序执行单元和 standards execution catalog 的 16 个 ACTIVE ref；三者不能相加。每个 wrapper 同时记录两个互斥轴：调用形态 `classification=TRUE_GATE|REPORT|PARAMETER_GATE|PHASE_MODE|ALIAS`，执行关系 `executionClass=VERIFY|PACKAGE_ONLY|CLOSED_PHASE|REPORT|NOT_RUN|ALIAS`，以及 canonical ref、phase applicability、参数契约、owner/source anchor、动态类型、cleanup、success marker、red proof。

当前必须保留的边界：`query-boundaries` 与 `database-operation-budget` 是同一 production budget path 的别名；`gate-0` 是空源前置；`standards-coverage` 在现有 verify 实现中必须显式 `--phase R5`，这不是从当前 RM1-P6-3 推导的 phase 规则；`scripts/verify --validate-only` 仍会触发远程 Testcontainers、前端构建和 seed dry-run，不能标为静态轻量门；`canonical-performance-ledger` 是报告；参数门不得猜默认参数。

RP-00b 的未来 production control 只验证机械关系。`classification` 与 `executionClass` 必须分别满足上面的值域；`VERIFY` 必须是 `classification=TRUE_GATE`、`phaseApplicability=ELIGIBLE`、`canonicalRef=self` 且恰有一个 `scripts/verify` 引用；`PACKAGE_ONLY|CLOSED_PHASE|REPORT|NOT_RUN` 禁止 verify 引用且必须有 source-bound 非空 reason；`ALIAS` 必须是 `classification=ALIAS`、只指向一个 canonical entry，永不独立执行或聚合。`aggregate` 是派生布尔值：仅当 `executionClass=VERIFY` 且上述五个条件全部成立时为 true，否则为 false。另记录参数、phase、动态/cleanup 和 red proof。最少四个可复现 red mutation 固定为：新增 wrapper 未登记、登记路径不存在、VERIFY 未被 verify 引用、非 VERIFY 被错误引用或缺理由；`aggregate-reference-missing` 作为第五个关系红例。它不判断豁免在产品语义上是否合理。

### S0-B · RP-01/RP-02a 契约消费者与工作负载恢复

source-owned 分母为 `S0 baseline.S0-B.sourcePaths/sourceHashes` 的有限文件集合：root OpenAPI 及其引用的 paths/schemas、generated registry（154 = platform 50 + operations 92 + public 12）、U01 placement report（154）、U01 catalog（当前 121，另建 121↔154 crosswalk）、scenario facts（144 unique operation IDs / 84 groups）、历史 assertions、诊断 workload、RM1 workload、platform-admin L2 fixture、joint fixture、owner controllers 及其测试。

缺失 facts 的 10 个 operation 为：`cancelWorkspaceInvitation`、`createWorkspaceInvitation`、`getOperationsOrganizationCandidates`、`getOperationsOrganizationHierarchyExtensionDefinition`、`getPlatformOrganizationCandidates`、`getWorkspaceInvitation`、`getWorkspaceInvitationCandidates`、`getWorkspaceInvitations`、`reissueWorkspaceInvitation`、`updateOperationsCommercialGroup`。每个必须补真实 task/sourceRefs/ownerReadback/prerequisite/oracle，或有 owner/source 支撑的显式 disposition；不得从 route/name/method 生成业务事实。

RP-02a 只做恢复：删除旧 `147` 断言、移除两个 store/contract create body 中的废弃 `projectId`、补齐 10 个 fact/disposition、修复 placement/catalog/assertion 对账。`projectId` 在允许的 query/read context 中保留。Recovery workload 的实际四个 operation 是 start/send/verify/complete operations password recovery；测试中 `recovery.calls.length===7` 只应改为四项精确顺序，邻近的 public invitation 七步保持不变。此阶段不得运行 HTTP/L2/seed。

RP-02a 的静态 red proof：缺 fact、重复 fact、sourceRef 不足、catalog 少项、旧分母、create body 重新出现 `projectId`、recovery 四步顺序变化分别红；不包含 RP-02b 的 TS/runtime validator。

### S0-C · RP-03 可观测性架构输入

架构决定仍需 Dexter 明确：生产 sink、保留期、访问主体、成本/采样、是否新增 edge 接收 face。现有 `HttpRequestMetricsInterceptor` 是诊断型 JSONL sink，`SafeLogger` 是前端内存环形缓冲，`AdminErrorBoundary` 尚未由两个 App 接入 `onError`，`ManagedInvitationBootstrap` 仍有自由 stdout；这些是 owning source，不是可直接复用的常驻产品底座。P6-1 exact source set 不是目录或自然语言类别，而是 `S0 baseline.S0-C.sourcePaths` 与 `sourceHashes` 的有限集合：registry、platform authentication controller、operations password recovery controller、platform/operations session resolver、cookie writer、platform/workspace authentication service、两个 App、foundation `safeLogger`/`AdminErrorBoundary`、runner 与 observability standard。P6-1 分母还包含公开 OTP、认证、匿名密码恢复与 runner 的受管 heartbeat/log/process 边界。

设计输出必须定义一条 completion event contract（correlation/request、operation、owner、route、face、status/outcome/error、duration/DB 指标），后端 observer、两个 app sink/ErrorBoundary、bootstrap managed output 三个实现面，以及不可记录的密码、hash、OTP、token、cookie、Authorization、手机号、登录名、原始 IP、raw payload、stack。观测充分性走 review checklist；可机械的 route registration/sensitive-field rejection 才进入现有标准 coverage，不新建同义 memory。

### S0-D · RP-12 节点集合 inventory 与 RP-12-pre

发现面固定为生产 Java 五个完整 token：`NODE_TYPE_JAVA_TOKEN_OCCURRENCES=477`、`NODE_TYPE_JAVA_TOKEN_LINES=320`。每行记录 file/line、次数、token、集合、owner、generated/disposition。SQL 单引号 node literal 另行扫描，不能预填“SQL 4”；`ALL_BUSINESS_ENUM_OCCURRENCES=673` 只有补 vocabulary/排除规则后才可作为独立 discovery artifact，不能与 477/320 相减。

已知集合起点：服务节点 `GROUP,REGION,PROJECT,HEAD_COMPANY,STORE`；组织树 `REGION,PROJECT`；审计 entityType（含 `ORGANIZATION_NODE, BRAND, TENANT, HEAD_COMPANY, STORE, BUSINESS_ENTITY, WORKSPACE_ROLE, WORKSPACE_ACCOUNT, WORKSPACE_INVITATION`）；业务实体 `BRAND,TENANT,HEAD_COMPANY`；扩展宿主 `BRAND,TENANT,HEAD_COMPANY,STORE,CONTRACT,COMMERCIAL_GROUP,REGION,PROJECT`。同名不同义、复合值 `GROUP_WORKSPACE/STORE_CONTRACT`、死 enum 与 generated enum 是反例。

RP-12-pre 的当前 disposition 是 `NOT_APPLICABLE_WITH_REASON`：`WorkspaceAuthenticationService.enterable(...)` 已用 `default -> false`，调用方随即拒绝，未知服务节点不存在可进入的生产路径。不得为了“看起来修复”把等价 false 改成 throw 或只新增重复测试；若未来要区分 typed failure/审计语义，必须另由 Dexter 先裁定。该不适用项从 S0 baseline 的 redProof denominator 排除，并记录 source、反例和未来重新开启条件。

## 3. 六类 package-exit 分母与证据

每个 S0 单元必须在后续 manifest 中声明六类 package-exit source denominator（memory/assertion、original/standard source、approved assertions、forbidden pseudo-fixes、owned source/change surface、due standards）以及独立的 `detailDesign`/incremental criteria 字段；本设计表已显式列出该字段，后续 manifest 不得省略。S0 的 L1 是 source/hash map，L2 是静态 red mutation plan，L3/business/cleanup 对不执行的动态部分标 `NOT_APPLICABLE_WITH_REASON`；不得把静态对账称为 runtime business PASS。

## 4. 串行与后续依赖

RP-00 分类先于 RP-00b registry control；RP-02a 不等 D4，RP-02b 必须等 D4 且等 RP-02a；RP-03 架构决定先于 RP-04/05/06；RP-12 inventory 与独立复核先于 RP-12-pre 及 RP-12a..n。所有源码写入都在 S0 review GO 后另建 implementation package，不共享本设计包。
