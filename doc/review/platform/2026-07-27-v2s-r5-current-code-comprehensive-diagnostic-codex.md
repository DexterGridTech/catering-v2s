---
title: R5 当前代码、设计与红线全范围只读诊断（Codex）
status: DIAGNOSTIC_COMPLETE_REPAIR_NOT_AUTHORIZED
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
reviewTarget: CURRENT_IMPLEMENTATION_READONLY_DIAGNOSTIC
scope: R5 current bytes, frozen revised design, project-memory, v1/v2 reference redlines, DEV/seed scripts
authorizationBoundary: 只读诊断；不构成 whole-scope implementation review，不授权修复、构建、DEV、seed/reset 或动态运行
---

# R5 当前代码、设计与红线全范围只读诊断

## 1. 结论与边界

结论：**NO-GO（M=12 / S=7 / N=2）**。

这不是 R5 的正式 `REVIEW_TARGET=IMPLEMENTATION` 对抗审查，也不是对既有设计的重新裁决；它是
Dexter 要求的“先停下、完整扫描、再与 Claude 合并”的当前字节诊断。所有 finding 均来自当前仓内
源码、冻结输入或静态 checker；没有运行构建、DEV、seed/reset、远端中间件或动态测试，也没有修改业务
源码、契约、迁移、测试或脚本。

当前 Roadmap 的 `CURRENT_*` 仍是 R5 implementation in progress；本诊断只将后续实施暂停为“先决定
修复设计”，不自行改变该授权。当前冻结分母是 **106 operation（39/56/11）、32 scenario、22 surface、
25 pageDesignKey、7 owner schema**。

## 2. 审查方法与可信范围

- 按 `AGENTS.md` 恢复：Registry→现行 Roadmap `CURRENT_*`→全部六个 memory kernel→四条六维路由命中
  原文→`scripts/README.md`→R5 revised design、acceptance、authorization、problem discovery 与 matrix。
- fresh 运行 `scripts/check/standards-coverage --phase R5`：`PASS / RULES=150`。这只证明 matrix 的 trace/
  enforcement 元数据闭合，不证明 current implementation 满足对应语义。
- 四个 fresh 只读子 agent 分别覆盖前端/契约、后端/持久化、DEV/seed/runner、设计/记忆/历史红线；作者
  对其 M 项重新打开 owning source。一个子 agent 的“3 M”标题与其列出的四条 M 不一致，未直接采信该
  计数，以下以本报告归并后的分组为准。
- 额外运行的静态 checker：`contract-face`、`openapi-contracts`、`edge-codegen`、`backend-boundaries`、
  `frontend-architecture`、`security-boundaries` 通过；`code-layout`、`logging-boundaries`、
  `database-boundaries`、`affected-l2` 失败（见 M-08）。

## 3. 已确认的 M 级阻断项

| ID | 当前事实（路径） | 冻结要求 / 红线 | 影响 |
| --- | --- | --- | --- |
| M-01 | 两个 app 对 generated edge 的非生成源码 import 为 **0**；`OperationsApi.ts:11-20`、`PlatformApi.ts:11-20` 建立的是 `path:string` 通用 mutation，22 个前端文件手写 `/api/` path；`OperationsPageRegistry.tsx:12-23` 直接持有 page key、route、entity type 与 status path。 | R5 §4 的 contract/codegen source truth、§6.1 的 generated endpoint、不得手写 feature HTTP client。 | 你指出的问题成立：operation、path、参数、typed Problem 与模型不能从契约消费面自动传导，前端可静默漂移。 |
| M-02 | `OperationsPageRegistry.tsx:19-23,214` 将五个用户页汇为裸 `/membership`，没有 OpenAPI 要求的 `pageDesignKey` 与 `expectedContextVersion`；`OperationsApp.tsx:15-21` 与 registry 也没有 `PG-STORE-PROFILE`、五个 `HOME-*` 的运行时承载。 | operations workspace-access path 的 required query；22 surface / 25 pageDesignKey frozen closure；五类首页 carry-over。 | 五个用户页不能表达各自页面/节点语义，至少六个冻结 page key 不可达，R5 UI 分母不成立。 |
| M-03 | `Problem.detail` 直接进入用户可见 `Alert.description`，包括 `OperationsAuditHistoryModal.tsx:34`、`PlatformAuditHistoryModal.tsx:44`、登录、上下文和 registry；全局静态命中 43 处。 | R5 §4 Problem、§6.1 明定“服务端 detail 不直接展示”；总册 D-4。 | 诊断/约束文字可直接泄露给两个后台用户，feedback contract 未落地。 |
| M-04 | `OperationsAuditHistoryController.java:35-45` 只验证 workspace session，随后按请求给出的 type/id 分派；没有宿主 detail page、capability 或数据节点授权。`OrganizationAuditHistoryService` 只检查 workspace tuple。 | R5 §4 audit path、§5.3 owner task read、已接受操作历史交互的“继承宿主详情 read 权限”。 | 同集团空间但无该实体读取权限的运营会话可能读取审计行动者与字段变更。 |
| M-05 | 合同仍读写 `contract.store_contract_item`：`ContractCommandService.java:79,112,134`、`ContractTaskReadService.java:87,115`；全部 migration 中 `items_json` 无命中。 | R-6 与 R5 §4/§5.1：host-table `{code,name}` JSONB array、受控迁移后退役关联表。 | 货号持久化形状仍是被新设计取代的旧形状，不能证明已规避大小写/并发/错误映射问题。 |
| M-06 | `PlatformWorkspaceService.java:65-75` 在 organization command 返回后无条件写 `platform_workspace.audit_event`；organization receipt 重放会在 :52-58 返回既有结果。生产源码没有 revised design 要求的 `CommercialGroupInitializationAuditReader`。 | R5 §5.1 “duplicate receipt 不多写 audit”；§5.3 要求 organization owner 初始化事实经窄 TASK_READ 合并。 | coordinator 复制持有组织事实，并可能把一次幂等重放记成新的业务审计事件。 |
| M-07 | `WorkspaceMembershipService.java:29,33` 直接查询 `organization.organization_node/head_company/store`，即使该类已注入 `OrganizationNodeLookup`、`OrganizationEntityLookup`。 | 模块 owner、公开 task API 与 R5 §3.1 显式任务读取边界。 | workspace-IAM 绕开 organization 的 owner API；读取规则与 owner 演进会分叉。 |
| M-08 | 当前控制基线并未达到详设要求的全量 active：`scripts/check/code-layout` 因空 `platform-admin/src/app/api/client` FAIL；`logging-boundaries` 对 `WorkspaceLoginRateLimitService` FAIL；`database-boundaries` 的 15 migration 常量无法接受当前 16 个 migration；`affected-l2` 声明了不存在的 operations authentication spec。 | R5 §7 / P1：所有控制必须 `ACTIVE_RED_VERIFIED`，不可用 PENDING 跨越受守卫工作。 | standards matrix 虽 PASS，但四个实际 production checker 已红，不能把控制先行宣称为完成。 |
| M-09 | `scripts/dev/seed` 在确认后仍固定输出 `OWNER_COMMAND_EXECUTOR_NOT_IMPLEMENTED`；dry-run 只数 16 个局部计数，且 fixture 引用的四个 `fixtures/assets/*.png` 在仓内不存在。 | R5 P6、§10：owner-command seed、邀请接受链、asset stage/claim、32 scenario owner readback。 | 当前没有可执行的完整 seed；“数据丰富、真实、可测试”仍只是 fixture 文本，不能作为 DEV 可测环境。 |
| M-10 | seed plan 直接加载 `status=PROPOSED_REVIEW_ONLY` 且 `implementationAuthority=false` 的旧 fixture contract；它不是 revised authorization 列出的冻结输入。 | revised implementation authorization §1-2 的冻结输入与不可变执行边界。 | seed 的事实分母未被当前接受设计绑定；即使未来执行，也不能直接作为 revised R5 evidence。 |
| M-11 | `r5-reset.mjs` 仅 drop/create database 后 PASS，未清 object namespace、未做 Flyway/七 schema readback；`r5-dev-runner.mjs` start 在 spawn/unref 后立即 PASS、stop 在 SIGTERM 后删除 manifest，远端 MinIO 又不在 manifest；没有 readiness/cleanup 闭合。 | R5 §10、P6 managed DEV、business/cleanup 分账。 | start/reset/stop 的 PASS 不能证明环境可用或已清理，不能承载后续 DEV/seed evidence。 |
| M-12 | `verify.mjs` 在前序失败时不会进入 Testcontainers cleanup；remote runner 在 Gradle 首败路径不产生 after-resource 比对和可保留的首败报告，同时关闭 Ryuk。 | logging/debugging foundation、R5 §10 first-failure 与 cleanup 规则、scripts README 的 Testcontainers 声明。 | 失败时既不能可靠复核首败，也不能证明容器/网络/卷 cleanup；当前 Testcontainers 结论不能升级为 R5 全链证据。 |

## 4. S 级已确认偏差

| ID | 当前事实 | 影响 |
| --- | --- | --- |
| S-01 | asset stage 服务/契约实际只接受 `GROUP_WORKSPACE_LOGO` 与图片，`PlatformAssetService.java:107` 拒绝视频；public read 形状却出现 `video/mp4`。 | 已接受的 image+video static owner 只有读侧半形状，写侧无法产生视频。 |
| S-02 | 审计 wire 将 `actionSummary` 直接等于技术 `action`，两个 Modal 原样展示；`AuditHistoryWireMapper.java:12`，两侧 Modal 的 list/detail。 | 操作历史会显示技术码而非 app-local 业务文案，未达到“谁在何时改变了什么”的可读性。 |
| S-03 | `actionCapabilityKeys` 在 `OperationsPageRegistry.tsx:207-222` 只展示，不参与创建/状态动作可见性；多个管理页仍在列表“操作”列发命令。 | 不符合页面准入与动作能力分离、详情右上动作的已接受交互。 |
| S-04 | 详情 Drawer 没有 foundation overlay lock；app 未向 lifecycle 传 `onDiagnosticEvent`。 | foundation 强制消费、overlay 行为与生命周期可观测性没有完全落地。 |
| S-05 | implementation evidence assembly 仍写 104 / 38 / 55 / 11，而 accepted closure 是 106 / 39 / 56 / 11。 | 后续五账汇总会漏两条审计 operation。 |
| S-06 | logging checker 不覆盖 `scripts/dev`/`scripts/test`，而 DEV/remote runner 持久原始 stdout/stderr / Gradle log；`scripts/dev/check` 只做字符串环境校验，也不复用 remote test 的目标绑定。 | 动态证据的脱敏与远端可达性未被现有静态 PASS 覆盖。 |
| S-07 | Roadmap `CURRENT_*` 已授权 R5 implementation，但同文件 :129-136 仍叙述 revised design 未授权；revised design/manifest 的 frontmatter 也保留 review-only 状态，尽管其 hash 与 acceptance 完全一致。 | fresh 会话可能读到相反状态；接受 decision 目前是唯一可消歧来源。 |

## 5. N 级登记与审查边界

| ID | 事实 | 处置边界 |
| --- | --- | --- |
| N-01 | DEV fixture 的业务命名和关系本身不是“乱码”：3 个空间、2 个商业集团、2 大区/3 项目、3 品牌/租户/总公司、5 门店、5 合同、5 role、6 account、7 assignment、14 invitation state，且覆盖经营中/待开业/未经营、停用、取消、失效等语义。 | 这只能说明**拟议**数据集的业务可读性与覆盖意图合理；没有 executor、asset 文件和 owner readback，不能称为已构建/足量/真实 seed。 |
| N-02 | `root/root` 是 Dexter 已明确指定的 DEV bootstrap 行为；当前脚本会把该值写入受管运行凭据并强制要求该值。 | 本报告不把 Dexter 的产品/DEV 决定改判为缺陷；仅登记它与旧 fixture“plaintext secret evidence”文字不一致，后续修复设计必须明确这一 DEV-only 边界和日志/evidence 脱敏方式。 |

## 6. 你点名的 OperationsPageRegistry 结论

你的判断是对的，而且问题不止“字符串多”：该文件把本应由契约生成或受集中 descriptor 约束的
`pageDesignKey`、HTTP path、query、entity/audit type、字段名、状态转换和 response shape 全部手写在一个
generic registry 内。它同时造成 M-01、M-02、M-03、S-03，并让 `frontend-architecture` 的 PASS 不能代表
真正的 contract consumption。可保留的是中文业务文案与 approved interaction 的 app-local 映射；不能继续由
feature 自行拥有的是 wire route、operation/parameter、error code、generated model 和 capability/page metadata。

## 7. 与 v1/v2 问题及 project-memory 的对照

- **已避免且本次未发现正向引入**：MQ/outbox/TDP、内部 OpenAPI client、Heritage runtime/build fallback、第二业务 deployable、多个数据库/Flyway history；两个独立 app 目录也仍存在。
- **已重现或未真正关闭的历史问题**：v2 式“生成物存在但消费者另写一套”、详情/列表动作跳过用户任务路径、错误 detail 直出、审计事实无宿主授权、owner API 旁路、empty/old evidence denominator、runner 对失败与 cleanup 的假绿风险。
- **memory / 设计未满足处**：`X_CONSUMER_FACES_ONLY` 在 frontend consumption 未闭合；`MODULE_OWNER_SOVEREIGNTY`/`TASK_READ_JOIN` 受 M-07 破坏；`BUSINESS_CLEANUP_SEPARATE` 受 M-11/M-12 破坏；`DEV_START_NO_SEED` 仍保持（本次没有发现 auto-seed）；G-01/G-05/G-07/G-08/G-09/G-10 的语义分别在商业集团、任职、门店、合同和双后台路径被用作审查标准。

## 8. 静态命令记录

```text
PASS  scripts/check/standards-coverage --phase R5  (RULES=150)
PASS  scripts/check/contract-face
PASS  scripts/check/openapi-contracts
PASS  scripts/check/edge-codegen (FILES=152)
PASS  scripts/check/backend-boundaries
PASS  scripts/check/frontend-architecture
PASS  scripts/check/security-boundaries
FAIL  scripts/check/code-layout          EMPTY_SOURCE_DIRECTORY:apps/frontend/platform-admin/src/app/api/client
FAIL  scripts/check/logging-boundaries   R4_LOGGING_SENSITIVE_LITERAL:WorkspaceLoginRateLimitService.java
FAIL  scripts/check/database-boundaries  R5_DATABASE_SINGLE_HISTORY_DRIFT
FAIL  scripts/check/affected-l2          missing operations authentication L2 target
```

## 9. 下一步（不在本件执行）

先将本报告与 Claude 的独立全范围扫描按 finding→owning design→当前字节合并，确定一份新的 correction
design/plan；在 Dexter 接受该计划前，不恢复实现、DEV、seed/reset 或动态验证。本件不提供具体修复方案，
避免在双审合并前由单方诊断替代设计裁决。
