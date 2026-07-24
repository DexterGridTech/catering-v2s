---
title: catering-v2s R1 W0 第 4-7 项实施计划
status: IMPLEMENTATION_DESIGN
createdAt: 2026-07-24
programContext: AI_FIRST_FOUNDATION
roadmapRef: doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md
authorizationRef: doc/decisions/2026-07-24-v2s-r1-authorization.md
implementationAuthority: R1_ONLY
---

# catering-v2s R1 W0 第 4-7 项实施计划

<!-- GRANULARITY_MANIFEST_SHA256=8fd9063a48c4efb76270f5eb6da7fd55be8527e6864199ebc3d2e2de73e6da4b -->

## 0. 全局边界

- 只写与 all-v2 同级的 `catering-v2s` R1 allowlist，以及 all-v2 中本 Roadmap、授权/设计/review/closure 文档；
- 不进入 R2/W1，不创建 `apps/**`、业务 contract、migration、runtime 或业务测试；
- 不启动 DEV，不 seed/reset，不执行 Git stage/commit/push/branch/worktree；
- all-v1/v4/v6 始终只读；all-v2 在 transfer PASS 后不再接收 R2-R6 状态；
- 所有工具只用 Node.js built-ins、Bash、`jq`、`rg` 和 Git 只读命令，不引入 package manager 或外部 provider。

## R1-U01 — 仓根入口、skills/hooks 与确定性 project-memory

<!-- GRANULARITY_MANIFEST_UNIT=R1-U01 -->

目标是让未来 fresh v2s-rooted 会话只靠仓内入口恢复身份、Roadmap、memory 和标准动作。

精确创建：

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`.gitignore`；
- `.agents/skills/{cs-memory-recall,cs-code-structure-recall,cs-failure-recall,cs-spec-to-plan,cs-managed-runtime-execution}/SKILL.md`；
- `.claude/skills -> ../.agents/skills`；
- `.codex/hooks.json`、`scripts/hooks/{session-start,prompt-route,stop}`；
- `tools/agent-context/cli.mjs`、`scripts/context/{agent-context,recall-memory,recall-code,recall-failure,working-set}`；
- `tools/project-memory/cli.mjs`、`scripts/memory/{build-index,query}`、`scripts/check/{project-memory,agent-lifecycle,provider-free-context,foundation-standard-actions}`；
- `project-memory/routing-vocabulary.json`；
- 六份 always-read kernel 与五份 routed memory，随后生成 `project-memory/index.json` 和 `project-memory/index.md`。

算法：

1. memory build 解析受控 YAML-like frontmatter，验证 active ID、layer、封闭词表、sourceRefs 和 kernel 预算，生成带原文 SHA-256 的 JSON/Markdown index；
2. memory query 必须提供六维封闭 route，返回全部 kernel 与精确交集 routed refs；未知 route fail-closed；
3. code recall 只执行 `rg --fixed-strings`，failure recall 组合 project-memory failure route 与精确 code query；
4. Prompt hook 只输出一个仓内 skill 相对路径，不查询 memory/code；SessionStart 只输出固定读序；Stop 只检查当前 session goal marker 与 managed-run cleanup；
5. provider-free gate 拒绝 provider/daemon/index-service 可执行路径和配置，但允许决策文档以否定语义记录退役边界。

数据、UI、migration 均不适用；本单元只产生仓内治理文本、索引和 CLI。

### U01-A. project-memory 封闭分母

build 不能从目录扫描结果自行决定分母；以下 11 个 stable ID/path 是独立批准的完整 R1 分母。每项 `sourceRefs` 只允许来自其 assertionSources 的真实 owning path 去重集，不要求、也禁止机械追加无关 ADR/manifest；kernel 必须逐条包含表内 assertion key。缺文件、少 assertion、额外 active entry、无关 source 或 route 元数据漂移都失败。

| stable ID | path | layer | route tuple | required assertion keys |
|---|---|---|---|---|
| `kernel.workspace-roadmap` | `project-memory/kernel/01-workspace-and-roadmap.md` | `kernel` | 六维均为 `all` | `PROGRAM_SCOPED_CURRENT_ONLY`,`R1_ONLY`,`GIT_BY_DEXTER`,`NO_R2_W1` |
| `kernel.service-owner` | `project-memory/kernel/02-service-shape-and-owner.md` | `kernel` | 六维均为 `all` | `ONE_BUSINESS_DEPLOYABLE`,`MODULE_OWNER_SOVEREIGNTY`,`COORDINATOR_NO_ASSET` |
| `kernel.transaction-data` | `project-memory/kernel/03-transaction-data-and-dependencies.md` | `kernel` | 六维均为 `all` | `ONE_DB_MULTI_SCHEMA`,`ONE_FLYWAY_HISTORY`,`COMMAND_REQUIRED_TRANSACTION`,`TASK_READ_JOIN`,`NO_NORMAL_POLLING` |
| `kernel.contract-admin` | `project-memory/kernel/04-contract-consumer-and-admin.md` | `kernel` | 六维均为 `all` | `X_CONSUMER_FACES_ONLY`,`TWO_ADMIN_APPS`,`OWNER_RECHECKS_COMMAND` |
| `kernel.evidence-runtime` | `project-memory/kernel/05-evidence-runtime-and-git.md` | `kernel` | 六维均为 `all` | `LOG_FIRST_RETRY`,`BUSINESS_CLEANUP_SEPARATE`,`DEV_START_NO_SEED`,`NO_GIT_WRITE` |
| `kernel.heritage-change` | `project-memory/kernel/06-heritage-and-change.md` | `kernel` | 六维均为 `all` | `HERITAGE_READ_ONLY`,`NO_RUNTIME_FALLBACK`,`NEW_DECISION_FOR_DRIFT` |
| `decisions.deterministic-context-only` | `project-memory/decisions/deterministic-context-only.md` | `routed` | `taskKinds=memory-recall,review; domains=platform; consumerFaces=all; owners=platform; impacts=memory,session; triggers=session-start,task-start` | `NO_PROVIDER`,`NO_DAEMON`,`PROMPT_RECOMMENDS_ONLY` |
| `decisions.distributed-topology-is-not-current` | `project-memory/decisions/distributed-topology-is-not-current.md` | `routed` | `taskKinds=design,implementation,review; domains=backend,platform; consumerFaces=backend; owners=backend,platform; impacts=architecture,transaction; triggers=implementation,review` | `NO_MQ_OUTBOX_TDP`,`NO_INTERNAL_OPENAPI_CLIENT`,`NO_DISTRIBUTED_DEFAULTS` |
| `operations.dev-command-separation` | `project-memory/operations/dev-command-separation.md` | `routed` | `taskKinds=runtime-management,testing; domains=platform,backend; consumerFaces=all; owners=platform; impacts=runtime,database,cleanup; triggers=runtime,failure` | `START_RESTART_MIGRATE`,`START_RESTART_NO_SEED`,`RESET_SEPARATE_DESTRUCTIVE` |
| `operations.roadmap-control-transfer` | `project-memory/operations/roadmap-control-transfer.md` | `routed` | `taskKinds=review,memory-recall; domains=platform; consumerFaces=all; owners=product,platform; impacts=roadmap,governance,heritage; triggers=session-start,status-question,cutover` | `PREPARED_IS_NOT_ACTIVE`,`ONE_STATE_OWNER`,`SOURCE_NO_POST_PASS_WRITE` |
| `pitfalls.log-first-failure-retry` | `project-memory/pitfalls/log-first-failure-retry.md` | `routed` | `taskKinds=diagnostics,testing,runtime-management; domains=platform,backend,contract,admin-ui; consumerFaces=all; owners=platform,backend; impacts=evidence,runtime,cleanup; triggers=failure,runtime` | `READ_FIRST_FAILURE_LOG`,`SECOND_RETRY_REQUIRES_DIAGNOSIS`,`NO_TIMEOUT_OR_POLLING_PSEUDOFIX` |

每个 assertion 的 owning source 必须 exact 等于下表 `repository-relative-path#literal heading`；同一 memory entry 的 `sourceRefs` 必须 exact 等于其 assertionSources 去重后的 path 集合，不能用 ADR/manifest 兜底替代真实 owner：

| assertion keys | owning source |
|---|---|
| `PROGRAM_SCOPED_CURRENT_ONLY` | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md### 0. Roadmap 身份与当前状态` |
| `R1_ONLY`,`NO_R2_W1` | `doc/decisions/2026-07-24-v2s-r1-authorization.md## catering-v2s Roadmap R1 实施授权` |
| `GIT_BY_DEXTER`,`NO_GIT_WRITE` | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md### 2. 不可突破的全程红线` |
| `ONE_BUSINESS_DEPLOYABLE` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.1 部署拓扑` |
| `MODULE_OWNER_SOVEREIGNTY` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.2 领域与模块边界` |
| `COORDINATOR_NO_ASSET`,`COMMAND_REQUIRED_TRANSACTION` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.3 跨模块原子写` |
| `ONE_DB_MULTI_SCHEMA`,`ONE_FLYWAY_HISTORY` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.7 单库、多 schema 与完整性` |
| `TASK_READ_JOIN` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.5 任务型读取` |
| `NO_NORMAL_POLLING` | `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md### Part G. 跨域同步的前端补偿清单——v2s 一律不再做` |
| `X_CONSUMER_FACES_ONLY` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.10 边缘、安全面与 OpenAPI face` |
| `TWO_ADMIN_APPS` | `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md#### B.4 前端架构与状态` |
| `OWNER_RECHECKS_COMMAND` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.6 授权与事务线性化` |
| `LOG_FIRST_RETRY`,`READ_FIRST_FAILURE_LOG`,`SECOND_RETRY_REQUIRES_DIAGNOSIS`,`NO_TIMEOUT_OR_POLLING_PSEUDOFIX` | `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md#### D.8 日志与诊断` |
| `BUSINESS_CLEANUP_SEPARATE` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.12 前端与工程证据` |
| `START_RESTART_MIGRATE`,`START_RESTART_NO_SEED`,`RESET_SEPARATE_DESTRUCTIVE` | `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md#### H.1 现在就做(仅三件 + 一个顺手项)` |
| `DEV_START_NO_SEED` | `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md#### H.2 本阶段明确不做` |
| `HERITAGE_READ_ONLY`,`NO_RUNTIME_FALLBACK`,`NEW_DECISION_FOR_DRIFT` | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md#### 7.2 旧仓只读策略` |
| `NO_PROVIDER`,`NO_DAEMON`,`PROMPT_RECOMMENDS_ONLY` | `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md#### D.7 AI-first 底座迁移(v2s 仓内开会话的前提)` |
| `NO_MQ_OUTBOX_TDP` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.1 部署拓扑` |
| `NO_INTERNAL_OPENAPI_CLIENT` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.2 领域与模块边界` |
| `NO_DISTRIBUTED_DEFAULTS` | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md#### 3.11 真实进程边界与触发制` |
| `PREPARED_IS_NOT_ACTIVE`,`ONE_STATE_OWNER`,`SOURCE_NO_POST_PASS_WRITE` | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md#### 7.1 Roadmap 控制面移交协议` |

封闭 vocabulary：

- `taskKinds`: `all,memory-recall,review,design,implementation,testing,diagnostics,runtime-management`
- `domains`: `all,platform,backend,contract,admin-ui`
- `consumerFaces`: `all,backend,platform-admin,operations-admin`
- `owners`: `all,product,platform,backend,contract,frontend-platform`
- `impacts`: `all,architecture,roadmap,governance,memory,session,owner,transaction,database,contract,evidence,runtime,cleanup,heritage`
- `triggers`: `all,session-start,task-start,implementation,review,failure,runtime,status-question,cutover`

`project-memory/required-inventory.json` 的每项 exact shape 为 `{id,path,layer,route,requiredAssertions,assertionSources,sourceRefs}`；`assertionSources` 是 `{assertionKey,path,anchor}` 数组，`anchor` 保存原文 literal heading（包含开头 `#`），不从上表字符串猜分隔；`sourceRefs` 必须等于 assertionSources path 的排序去重集。index builder 只能消费它，不能以生成后的 index 反向定义完整性。它逐个 reopen source path 并查找 literal heading；红夹具从 `kernel.transaction-data` 删除 `COMMAND_REQUIRED_TRANSACTION` 时必须失败，保留 assertion 文本却把 owning source 换成非 owner ADR heading 也必须失败。

### U01-B. lifecycle process contract

`.codex/hooks.json` 只允许以下生产注册，command 均从仓根解析，timeout 固定 `5` 秒：

| event | command |
|---|---|
| `SessionStart` | `scripts/hooks/session-start` |
| `UserPromptSubmit` | `scripts/hooks/prompt-route` |
| `Stop` | `scripts/hooks/stop` |

- `session-start`：stdin 可为空或任意 JSON，内容不参与路由；exit `0`；stdout 必须恰为固定 key 行 `STATUS,CONTEXT_MODE,ENTRY_1..ENTRY_6`，不写文件、不查询 memory/code。
- `prompt-route`：stdin 是 `{"prompt":string,"sessionId"?:string}`；空 prompt/未知 route/malformed JSON 都 exit `0` 且输出 `STATUS=PASS,RECOMMENDED_SKILL=NONE,CONTEXT_QUERY_PERFORMED=false`；命中时只增加一个 `RECOMMENDED_SKILL=<stable name>` 与一个仓库相对 `RECOMMENDED_SKILL_PATH=.agents/skills/<name>/SKILL.md`。stdout 禁止 `MEMORY=`,`SOURCE=`,`CODE=`,`REF=`；永不调用 recall/query/rg。
- `stop`：stdin 是 `{"sessionId":string}`；只读 `.runtime/agent-sessions/<sessionId>.json` 与该文件 `managedRunIds` 指向的 `.runtime/managed-runs/<runId>/manifest.json`。session marker schema 固定为 `{schemaVersion:1,sessionId,goal:{status:"NONE"|"ACTIVE"|"COMPLETE"|"BLOCKED"},managedRunIds:string[]}`；manifest 最小 schema 为 `{schemaVersion:1,runId,status:"STARTING"|"RUNNING"|"STOPPED",cleanup:{status:"PENDING"|"PASS"|"FAIL"}}`。goal=`ACTIVE`、run status 非 `STOPPED` 或 cleanup 非 `PASS` 时 exit `2` 并逐项输出 `BLOCKER=`；否则 exit `0 / STATUS=PASS`。路径越界、未知 run 或 schema 错误一律 exit `2`。
- marker 只由未来显式 goal/managed runner 动作拥有；hook 不创建、不修复 marker。R1 fixture 放在临时目录，通过真实 `.codex/hooks.json` 解析出的 command 调用生产脚本，覆盖：无 marker、`NONE`、`ACTIVE`、clean run、cleanup fail、Prompt source injection。

## R1-U02 — v2s-native Roadmap 控制面

<!-- GRANULARITY_MANIFEST_UNIT=R1-U02 -->

精确创建：

- `doc/platform/roadmap-program-registry.json`；
- `doc/platform/active-document-index.json`；
- `tools/roadmap-registry/core.mjs`；
- `scripts/check/roadmap-program-registry`；
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`；
- `doc/evidence/platform/2026-07-24-v2s-roadmap-control-plane-transfer.json`；
- `scripts/check/roadmap-control-plane-transfer`。

算法：

1. Registry 只含 `V2S_W0_W4_EXECUTION`，state/authorization owner 同指 target Roadmap，`batchIds=[]`；entry state 只允许 `PREPARED_NON_AUTHORITATIVE|ACTIVE`，普通 resolver 只能返回 `ACTIVE`；
2. target Roadmap identity 固定为 `roadmapId=v2s-w0-w4-execution / programId=V2S_W0_W4_EXECUTION / kind=SUCCESSOR_EXECUTION / stateOwner=self / authorizationOwner=self`；
3. source 最后一次状态写入为 `R1_STATUS=EVIDENCE_READY / CURRENT_STATUS=TRANSFER_PENDING`，计算 `sourcePreparedHash` 后永久停止 source 写入；source 不预写 GO；
4. prepare snapshot 固定三件套：
   - Registry entry=`PREPARED_NON_AUTHORITATIVE`；
   - target Roadmap=`LAST_CLOSED_STEP=R0 / CURRENT_STEP=R1 / CURRENT_STATUS=EVIDENCE_READY / V2S_SESSION_ENTRY_READY=false`；
   - receipt=`phase:PREPARED`，记录 sourcePreparedHash、prepared target/Registry/Heritage hashes、business PASS、cleanup PASS、activeManagedResources=0；
5. `roadmap-control-plane-transfer --prepare` 验证 R1 evidence、hash 和“若激活则唯一 owner”，但 resolver 必须仍返回 `NO_ACTIVE_PROGRAM`；
6. prepare PASS 后在 `.runtime/transfer-candidates/<runId>/` 生成完整 final Roadmap、final receipt 与 expected ACTIVE Registry bytes；candidate receipt 记录 final target hash、`expectedActiveRegistryHash`、Heritage hash、pre-transfer implementation closure hash、`candidateVerifiedAt`、`phase=CANDIDATE_VERIFIED`，明确不含/不预填 `transferredAt`，且之后不再改字节。`--candidate-root` 对这套非 current bytes执行全部 final oracle；
7. candidate PASS 后先把已验 Roadmap/receipt bytes发布到 current path，Registry 保持 `PREPARED_NON_AUTHORITATIVE`；因此普通 resolver 仍返回 `NO_ACTIVE_PROGRAM`，不会暴露 current R1 GO/R2；
8. owner switch 的唯一写是把已验 ACTIVE Registry bytes通过同目录 temp + fsync + atomic rename 最后发布；随后只读 post-publish check 拒绝双 owner、旧 program state、hash 漂移、R1→R2 断档、source current owner、Heritage writeBack/runtimeFallback；
9. candidate 或 publish 失败时：Registry-last 前只恢复 Roadmap/receipt prepared snapshot；Registry-last 后先原子恢复 PREPARED Registry，再恢复 Roadmap/receipt。恢复后 `--prepare` 必须证明 resolver 无 active target、source 仍为临时 owner；不回写 source；
10. transfer receipt 如实记录 target git HEAD=`5b083504f6687ca6be832171c79a4e1234078937` 与 worktree=`DIRTY_R1_AUTHORIZED_UNCOMMITTED`，禁止冒充 commit；Registry-last readback PASS 后由独立 post-transfer closure 记录真实 `activationObservedAt`，不回改 receipt。

状态机唯一合法边：

```text
SOURCE_IMPLEMENTING
  -> SOURCE_EVIDENCE_READY__TARGET_PREPARED
  -> NON_CURRENT_CANDIDATE_VERIFIED
  -> FINAL_BYTES_CURRENT__REGISTRY_PREPARED
  -> REGISTRY_ACTIVE__POST_PUBLISH_PASS
```

红夹具必须包含 source prepared 后 candidate 失败、final Roadmap/receipt 已发布但 Registry 仍 PREPARED、Registry 激活后 readback 失败并“先停用 Registry再恢复其余文件”，以及 candidate target hash 漂移；全部证明普通 resolver 不会在验证前发现 R1 GO。

## R1-U03 — 模块依赖、HANDOFF 与 Heritage

<!-- GRANULARITY_MANIFEST_UNIT=R1-U03 -->

精确创建：

- `contracts/policy/module-dependency-registry.json`；
- `contracts/policy/module-dependency-registry.schema.json`；
- `tools/module-dependency-registry/check.mjs`；
- `scripts/check/module-dependency-registry`；
- `HANDOFF.md`、`scripts/check/handoff-debt`；
- `doc/heritage/{README.md,registry.json}`、`scripts/check/heritage-registry`；
- 冻结 ADR、manifest、行动计划、working notes、评审/处置、Roadmap 接受与 R1 授权的仓内副本。

算法：

1. dependency registry 在 runtime 不存在时保持 `modules=[]/edges=[]`，schema 只允许 `COMMAND/SCHEMA_FK/TASK_READ`；
2. COMMAND 与 SCHEMA_FK 分别做 DAG；TASK_READ 允许环且不授予写/import/FK/锁；
3. HANDOFF 精确七项、七字段，stable ID 唯一，trigger 必须是可判定事实；
4. Heritage registry 统一记录 all-v2/all-v1/v4/v6 的只读角色；all-v2 关键 source asset 逐文件 hash，所有 source `writeBack=false/runtimeFallback=false`；
5. 旧仓漂移只产生 fail-closed 与新 v2s decision，不回写旧仓。

### U03-A. dependency registry closed schema

顶层 exact shape 为 `{schemaVersion:1,kind:"module-dependency-registry",status:"ACTIVE",modules:Module[],edges:Edge[]}`，`additionalProperties=false`。

- `Module={moduleKey,ownerSchema,commandApiPackages}`；`moduleKey` 匹配 `^[a-z][a-z0-9-]*$`，`ownerSchema` 匹配 `^[a-z][a-z0-9_]*$`，`commandApiPackages` 是非重复 Java package 数组且每项匹配 `^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$`。`moduleKey`、`ownerSchema` 与所有 command API package 均全局唯一。
- edge 公共字段：`edgeId,edgeKind,fromModule,toModule,rationale`；`edgeId` 全局唯一，`fromModule/toModule` 必须存在且不同。
- `COMMAND` 额外且仅允许：`apiPackage,operation`。方向是 caller=`fromModule` 调用 owner=`toModule` 的公开 command API；`apiPackage` 必须 exact 属于 `toModule.commandApiPackages` 且不得属于 fromModule，operation 匹配 `^[A-Z][A-Za-z0-9]*$`；semantic key=`COMMAND|fromModule|toModule|apiPackage|operation`。
- `SCHEMA_FK` 额外且仅允许：`referencingObject,referencedObject,constraintName`。方向是 FK 持有者=`fromModule` 的 `referencingObject` 指向 owner=`toModule` 的 `referencedObject`；两对象必须分别以两端 `ownerSchema.` 开头；semantic key=`SCHEMA_FK|referencingObject|referencedObject|constraintName`。
- `TASK_READ` 额外且仅允许：`queryId,initiatingModule,referencedSchemaObject`；`initiatingModule=fromModule`，被读对象必须以 `toModule.ownerSchema.` 开头；semantic key=`TASK_READ|queryId|initiatingModule|referencedSchemaObject`。

只把 `COMMAND` 边投影到 command DAG，只把 `SCHEMA_FK` 边投影到 schema DAG；TASK_READ 不参与任何 DAG。未来 importer/reconciler 必须用上述 semantic key 对齐源码 registration、`information_schema` constraint 或 query manifest，观察值缺失/重复/反向一律失败，不能猜 owner。

R1 green registry 必须严格为空现实 `modules=[]/edges=[]`。独立 fixtures 必须先建立两个拥有不同 `commandApiPackages`/schema 的 module，随后覆盖：正确 COMMAND 方向通过；swapped COMMAND direction、unknown API owner、FK owner inversion、duplicate edgeId、duplicate semantic key、missing target module、COMMAND cycle、SCHEMA_FK cycle 均失败；合法 TASK_READ cycle 通过；TASK_READ 缺 queryId 或额外 kind-specific 字段失败。

### U03-B. Heritage exact inventory

Heritage 顶层 repository 分母固定为四条，不允许额外 current-truth repository：

| repositoryId | relation | selected asset policy | role |
|---|---|---|---|
| `catering-all-v2` | `../catering-all-v2` | 下表 13 项，exact match | `READ_ONLY_HERITAGE` |
| `catering-all-v1` | `../catering-all-v1` | `EXPLICIT_FUTURE_REF_ONLY`，R1 selected assets=`[]` | `READ_ONLY_HERITAGE` |
| `catering-server-v4` | `../catering-server-v4` | `EXPLICIT_FUTURE_REF_ONLY`，R1 selected assets=`[]` | `READ_ONLY_HERITAGE` |
| `requirement-doc-v6` | `../requirement-doc` | `EXPLICIT_FUTURE_REF_ONLY`，R1 selected assets=`[]` | `READ_ONLY_HERITAGE` |

四条均必须为 `writeBack=false,runtimeFallback=false,buildFallback=false`。空 selected assets 只在 policy 明确为 `EXPLICIT_FUTURE_REF_ONLY` 时合法；未来引用必须由新的 v2s decision 增加 exact path/hash，不能隐式遍历旧仓。

all-v2 的 R1 selected asset/copy denominator：

| source path | expected SHA-256 | disposition | owning assertion |
|---|---|---|---|
| `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md` | `ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568` | `COPIED_FROZEN` | service shape |
| `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md` | `84037f1c81ae17ce51ee488723f5e230b4fe3f76c16e690c58c96606793e6c69` | `COPIED_FROZEN` | carryover |
| `doc/plans/platform/2026-07-24-v2s-architecture-action-plan.md` | `fda7be83444fe1d598f85322c3190a72609e0028e9f4138b9e46bb93c1c8f603` | `COPIED_FROZEN` | W0 1-7 |
| `doc/plans/platform/2026-07-24-v2s-architecture-grilling-working-notes.md` | `e7bf78e4d61f68a55f580ed6b039574b6a0bd95e23a53155f2e6e1cc064a0e9a` | `COPIED_FROZEN` | decision trace |
| `doc/handoffs/2026-07-24-v2s-w0-continuation-handoff.md` | `c94afa29234b8e13ae96034091e6cbe7d517852418c997998f635696e20caeba` | `COPIED_FROZEN` | R1 boundary |
| `doc/review/platform/2026-07-24-v2s-service-shape-codex-self-review.md` | `85282177165d35d729a77a931503e1622bf47a4ab306b86df3acee3f992d1980` | `COPIED_FROZEN` | service author review |
| `doc/review/platform/2026-07-24-v2s-service-shape-claude-review.md` | `3247083500608faaca5123876cce11d1662b39741c62609c5da445b4b121c995` | `COPIED_FROZEN` | service independent review |
| `doc/review/platform/2026-07-24-v2s-service-shape-claude-review-resolution.md` | `3049593ee3e93a835bbc12fbb395dfd9aa8314449d7a8f995924fe440405b3b8` | `COPIED_FROZEN` | service findings resolution |
| `doc/review/platform/2026-07-24-v2s-carryover-manifest-codex-review.md` | `bd0dac82b19e19b66cbd065cf71095029921c453728cceac2d451a54aecfd658` | `COPIED_FROZEN` | manifest GO |
| `doc/review/platform/2026-07-24-v2s-execution-roadmap-codex-self-review.md` | `a75caa245c402e81b5bda631c54d6b4df684e267d4267c604923bbe936a9da8c` | `COPIED_FROZEN` | Roadmap author review |
| `doc/review/platform/2026-07-24-v2s-execution-roadmap-review-claude.md` | `afee508e19563fd2b4b81b99c9db3785b737f6d33cbf0d6bd6dff7305fea5882` | `COPIED_FROZEN` | Roadmap independent review |
| `doc/review/platform/2026-07-24-v2s-execution-roadmap-review-resolution.md` | `aae89e1bafcd77a5acc3a0cc1a86623238d8175bebe928fed6add3ad5697a489` | `COPIED_FROZEN` | Roadmap findings resolution |
| `doc/decisions/2026-07-24-v2s-execution-roadmap-r0-acceptance.md` | `3f917b783b7861dc56fd4307f4a6bd3c826e07baaec6ae2b8ea7ae69c6db45a2` | `COPIED_FROZEN` | Dexter R0 acceptance |

R1 authorization、R1 plan/reviews/evidence 是 v2s current control evidence，复制到 target 自有 `doc/decisions|plans|review|evidence` 后由 target 管理，不伪装为 Heritage selected asset。source Roadmap 的 `sourcePreparedHash` 只进入 transfer receipt，不进入上述固定 copy denominator。

### U03-C. HANDOFF exact rows and trigger oracle

七字段内容固定如下；`decisionSource` 单元格是一个 JSON array，元素 exact shape=`{"path":repository-relative-path,"anchor":literal-heading}`。即使只有一个 source 也不得退化为别名或自由文本；checker 必须 reopen path 并 literal 查找 anchor：

| id | currentBoundary | deferredReason | risk | activationTrigger | futureAcceptanceEvidence | decisionSource |
|---|---|---|---|---|---|---|
| `CI_EXECUTION_PLATFORM` | `scripts/verify` 由 Codex/Claude 本地显式执行，无 CI 平台 | solo+AI 阶段先保留证据语义 | 人工漏跑验证 | `CI_PROVIDER_SELECTED` | provider workflow 运行 verify、保存 business/cleanup 与失败红例 | `[{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.1 现在就做(仅三件 + 一个顺手项)"}]` |
| `BACKUP_RESTORE` | 仅本地/单服务器开发数据，无恢复演练 | 当前未启用持久生产环境 | 数据丢失后不可恢复 | `PERSISTENT_ENVIRONMENT_ENABLED` | 加密备份、恢复演练、RPO/RTO 结果与 cleanup PASS | `[{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.2 本阶段明确不做"}]` |
| `SECRET_ROTATION` | 仅本地开发密钥边界 | 当前无非本地 secret store | 凭据长期不轮换 | `NON_LOCAL_SECRET_STORE_ENABLED` | 双版本轮换、撤销旧密钥、应用无中断 readback | `[{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.2 本阶段明确不做"}]` |
| `HEALTH_READINESS` | 受管启动复用 walking-skeleton 入口断言，不建第二端点 | 防止漂移探针 | 编排器无法判定接流/摘流 | `ORCHESTRATOR_REQUIRES_PROBES` | liveness/readiness contract、故障红例、编排器接流/摘流证据 | `[{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.1 现在就做(仅三件 + 一个顺手项)"}]` |
| `DEPLOYMENT_ROLLBACK` | 单服务器重启即部署，无独立回滚故事 | 当前无第二部署环境 | 失败发布恢复依赖人工 | `SECOND_DEPLOYMENT_ENVIRONMENT_ENABLED` | 前后版本部署/回滚演练、schema compatibility 与 cleanup PASS | `[{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.2 本阶段明确不做"}]` |
| `METRICS_ALERTING` | run-scoped 结构化日志，无生产指标/告警平台 | 当前无生产流量 | 故障只能被动发现 | `PRODUCTION_TRAFFIC_ENABLED` | SLI/SLO、告警触发/恢复红绿证据、owner routing | `[{"path":"doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md","anchor":"### H.2 本阶段明确不做"}]` |
| `RUNTIME_DB_ROLE_ISOLATION` | 单 runtime DB role，可访问多 owner schema | solo+AI 单 deployable 暂不拆 credential | 单凭据扩大 schema blast radius | `SECURITY_REVIEW_REQUIRES_SCHEMA_SCOPED_RUNTIME_CREDENTIALS` | schema-scoped credential design、权限矩阵、跨 schema command/read/FK 回归 | `[{"path":"doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md","anchor":"## 11. HANDOFF 初始生产化欠账"}]` |

trigger 语法必须匹配 `^[A-Z][A-Z0-9_]*$` 且 `id -> activationTrigger` 必须等于上表 allowlist；checker 不接受自由文本、`AND|OR` 复合 trigger、`WHEN_NEEDED`、`SCALE_GROWS`、`TEAM_GT_N` 或任何未列 token。七个 approved green controls 逐行通过；模糊、复合、缺阈值/观察事实、未知 token，以及 alias-only、路径缺失、free-text 合并多个 source、anchor 不存在的 red controls 必须失败。

## R1-U04 — R1 聚合证据、自审与 review handoff

<!-- GRANULARITY_MANIFEST_UNIT=R1-U04 -->

精确创建：

- `scripts/README.md`、`scripts/list`、`scripts/check/r1-closure`；
- `doc/evidence/platform/2026-07-24-v2s-r1-allowlist.json`；
- `doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json`；
- `doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json`；
- `doc/review/platform/2026-07-24-v2s-r1-codex-self-review.md`；
- `doc/review/platform/2026-07-24-v2s-r1-claude-review-request.md`；
- `doc/platform/claude-review-handoff-template.md`、`scripts/check/claude-review-handoff`。

聚合顺序固定为：

1. project-memory build/check；
2. agent lifecycle/provider-free/foundation actions；
3. Roadmap Registry；
4. dependency registry；
5. HANDOFF/Heritage；
6. source/target transfer prepare；
7. exact R1 allowlist 与禁建项检查；
8. source Roadmap 最后写 `EVIDENCE_READY / TRANSFER_PENDING` 并冻结 `sourcePreparedHash`；
9. 写 immutable pre-transfer implementation closure，记录 U01/U03/prepared-U02 gates、sourcePreparedHash、business=`PASS`、cleanup=`PASS`、active managed resources=`0`；Codex self-review 只绑定此 closure；
10. target prepared snapshot、prepare gate、non-current candidate gate；
11. verified Roadmap/receipt publish、Registry-last activation、resolver readback 或 Registry-first rollback；
12. 写 post-transfer closure，记录真实 `activationObservedAt` 与 active Registry/target/receipt/implementation-closure hash；此文件不属于 candidate bytes，写后不得改；
13. Claude handoff 结构门只绑定 post-transfer closure、immutable receipt、implementation closure 与 Codex self-review。

R1 allowlist 以 `doc/evidence/platform/2026-07-24-v2s-r1-allowlist.json` 独立列出所有 R1 create path；checker 比较 `git status --porcelain=v1 --untracked-files=all` 相对 `5b083504f6687ca6be832171c79a4e1234078937` 的 path。允许的 contract 只有：

- `contracts/policy/module-dependency-registry.json`
- `contracts/policy/module-dependency-registry.schema.json`

`apps/**`、`libraries/**`、`db/**`、`migration/**`、`migrations/**`、除上述两项外的 `contracts/**`、业务 OpenAPI、DEV/runtime 产物均失败；`.idea/*` 与 `catering-v2s.iml` 是 baseline retain，不计 R1 create。

反向夹具必须至少拒绝：未知 route、缺 frozen assertion/替换 owning source、真实注册 Prompt 注入 source、provider 可执行路径、duplicate Roadmap owner、prepared 状态被 resolver 当 active、source prepared 后 adoption 失败不回滚、R1→R2 断档、swapped COMMAND direction、FK owner inversion、COMMAND/SCHEMA_FK cycle、TASK_READ 缺 query key、HANDOFF 模糊/复合/未知 trigger、Heritage 缺项/多 current truth/writeBack、`apps/**`、migration 或第三个 `contracts/**` 出现在 R1。

## 5. Create / update / delete / retain

| Disposition | 内容 |
|---|---|
| CREATE | 上述 v2s R1 文件；all-v2 的 R1 authority/design/review/closure 文档 |
| UPDATE | all-v2 source Roadmap 在 transfer 前只推进到 `EVIDENCE_READY / TRANSFER_PENDING`；v2s target Roadmap 在 final adoption 时推进到 R1 `GO`、R2 `IN_REVIEW` |
| DELETE | 无 |
| RETAIN | v2s `.idea/*` 与 `catering-v2s.iml` 原样保留；all-v1/all-v2/v4/v6 runtime、Roadmap Registry、数据库、contract、test 均不改 |

## 6. 停止条件

- 冻结 ADR/manifest/hash 漂移；
- v2s baseline 不再是获授权的初始仓状态且无法区分外部改动；
- implementation granularity 或独立对抗审查出现 M/S；
- 任一 checker 的 production path 与 red fixture 不共用逻辑；
- 需要进入 R2/W1、动态环境、破坏性数据或 Git 写操作。
