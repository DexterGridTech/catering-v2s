# CP-05 · 远端 Node wire runtime 预检步骤对账

**STEP_RECONCILIATION=MATCHED**  
**范围**：仅确认 backend-acceptance 在启动 TDS 与 wire client 前拒绝不满足设计的远端 Node 环境，并证明设备激活保持公开、无用户权限要求。  
**reviewerKind=INDEPENDENT_SUBAGENT**：fresh 独立只读 reviewer；主 agent 记录 verdict 与处置，本文件不是 reviewer 原稿。

## 目的与选择

Node raw-frame client 需要固定版本、`net`/`crypto`/`zlib` 与 Linux Unix-domain socket。预检在受管 remote runner 准备远端 workspace 前执行；backend-acceptance 必须在缺失或错配时 fail closed。选择在既有 `r5-remote-testcontainers` runner 里加一个窄的 Node probe，而不是安装依赖或另建预检命令：它沿用唯一受管远端入口，且不改变其他 Testcontainers runner 的要求。

Dexter 本轮明确：设备激活接口没有用户权限限制。核对结果与现行需求/实现一致，本步骤不改激活授权或认证行为：

- 需求 R-1.1 明确激活是公开接口、不需要登录会话。
- OpenAPI `activateTerminal` 使用 `security: []` 与 `x-authorization-mode: NONE`；operation binding 使用 `PUBLIC_PROTOCOL_CONTEXT`。
- `TerminalActivationController` 仅注入 `ActivateTerminalOperation`，没有 session、IAM 或 permission 依赖。
- store-terminal acceptance 激活请求在 `StoreTerminalAcceptanceScenarios.java:122-148` 传 `cookie=null` 和空 headers，成功后断言没有 `Cookie`、`Authorization` 或 `Idempotency-Key`。
- `TerminalActivationProblem.java:33-40` 的 403 表达集团空间/门店状态拒绝；它不引入用户权限要求。

## 实现与判据

`scripts/test/r5-remote-testcontainers.mjs` 的 `remotePreflightScript({requireTerminalWireRuntime})` 仅当本次是 backend-acceptance 时执行 Node probe。它上报 `process.execPath`、平台、Node 与 bundled Undici 版本、核心模块和 Unix-domain socket bind 结果；probe 结束会关闭 server 并删除临时目录。既有 Testcontainers 容器/卷空集检查仍在同一预检中。

同文件的 `parseRemotePreflightResult` 对 Node 结果执行闭集验证：Linux、Node `24.13.0`、Undici `7.18.2`、`net`/`crypto`/`zlib`、UDS bind 全部匹配才接受。缺结果、重复结果、坏 JSON 或任一条件不满足均报错。acceptance run 在 `manifest.resourcePreflight` 调用点传 `requireTerminalWireRuntime: backendAcceptanceRunId !== null`；普通远端 Testcontainers run 不被额外要求 Node runtime。

`scripts/test/r5-remote-testcontainers.test.mjs` 的聚焦用例覆盖：Docker 查询失败不伪装成空资源；有效 runtime 接受；脚本由 `bash -n` 解析；Node/Undici 版本、平台、核心模块、UDS、可执行路径缺失/错配和重复记录拒绝；Node runtime 缺失时 acceptance 拒绝；调用点只对 acceptance 要求此 runtime。

## 前后双读与项目记忆路由

实施前运行并重开：

```text
scripts/context/recall-memory --task-kind implementation --domain backend --consumer-face backend --owner backend --impact runtime --trigger implementation
scripts/context/recall-memory --task-kind implementation --domain platform --consumer-face backend --owner platform --impact runtime --trigger implementation
```

两条路由都包含六个 kernel、backend-acceptance、business-corpus adoption、phase retrospective、test closed loop、execution economics 与 confirmed-business-language-corpus；platform 路由另含 terminal architecture rulings、terminal Android capture、TER input practice。另按 AGENTS 明确读取 `decisions.deterministic-context-only`。完整路由命中文件与 SHA-256：

| Memory path | SHA-256 |
| --- | --- |
| `project-memory/kernel/01-workspace-and-authorization.md` | `38f06c5a5c003947f2f5a052386f593beef4d23634d9c1d2e02525c987f4e50b` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `b4cc00b51fd0a2679d168ee347aa584ba0d28fa78777f61b16e6bf3ba761edfd` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `4c68d6154af8edaf54fc2069f6cdd111433c231ae9df701b3bf94408337dc8bc` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `85964b6b5aaec31453f321d990bff54f2ad76f8a5427174a9e2b6c7fe7ff6025` |
| `project-memory/kernel/06-heritage-and-change.md` | `f0fbf34400c0a1d89dfabe52c031e0688a169279423eb5de70dc3154b0915896` |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `335fcaff503385b777cab673502f4b343865f47ab1e098c47a139b2bbd374c3d` |
| `project-memory/decisions/deterministic-context-only.md` | `0137a797b55c18455b9f76ad2b9a54eb299e57f06c3afed5d1764c7f5fcefbca` |
| `project-memory/operations/backend-acceptance.md` | `0e26f815d6988f8f975d4c82513bf25539c16970a6d0ac9c60fde9925a4fc54b` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` |
| `project-memory/operations/phase-retrospective-and-systemic-repair.md` | `ee7eacfb2724946a139046119becc3ebe171e17282abfb846559fea7730fc1a9` |
| `project-memory/operations/test-closed-loop.md` | `0459c5bd0d0e69366e3d8234fe16033f086ee137cccba7862adefb3fcfc65dc7` |
| `project-memory/operations/execution-economics-and-failure-family-closure.md` | `d51110be04a71d3e637d6ec62f41d5072464d0d3adb00aba2e0f8da654698412` |
| `project-memory/decisions/terminal-architecture-and-stack-rulings.md` | `4641352c0f1ff3bb6976938facda4524c91b90234a4eea92f9a32991d16eda87` |
| `project-memory/operations/terminal-android-display-screenshot-capture.md` | `b177d1746fbee2eddd864c1b356cce11aab448fb7b13a4bb7027a682f38b0e38` |
| `project-memory/practices/ter-input-and-virtual-keyboard-usage.md` | `0f79bbbaaa60db408fcd1aea96eeca977047df1d95c37f5241ded975869d853c` |

实施后按同一路由重开上述 memory，并重读 requirement R-1.1、详设 V-S14/§10、计划 Step 7/首次动态运行门、Backend Acceptance 主动规范、`scripts/README.md`、runner 与测试源码。结论：Node probe 不引入包安装、外部项目输入、业务场景或 production hook；也没有放宽任何远端拓扑、资源归属或 cleanup 约束。与设备激活权限有关的前后双读未发现偏移。

关键输入当前 SHA-256（本步骤未修改这些输入）：

| Path | SHA-256 |
| --- | --- |
| `AGENTS.md` | `b5fd425f96ae99fa565d81cb66acb4f65f2fafd6645f66736c9a2cd861114ad6` |
| `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md` | `35ef15fd0b0844426e30da43649a2cfa28136806b326c8b694205c34d1cf238a` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md` | `59c44016280d209aedd98a246292c534b9ac231738402386d9a56a9b3b52459f` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md` | `6cf1ce0dd00ec674fbde0d9956ee6e81fddbca84f53219ff7a1bb898b2efbc5f` |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | `588e5263960ca0fedc1d6621ea8462e72140d4ac4d6f89beb4327be2234ece5e` |
| `scripts/README.md` | `12d0a83625c5d9b67b5419dbb81253135fd432fbbac6c20a0a6971508a456aa5` |
| `scripts/test/r5-remote-testcontainers.mjs` | `c7aef2decf219c55f2f6c270f926fa4a25adc9bd934b15c65ae1fa038892bc32` |
| `scripts/test/r5-remote-testcontainers.test.mjs` | `4e083c20aafdb457dbc153ee5b41765ffe8f786991163dd01e622227d766693b` |
| `contracts/openapi/paths/terminal/activation.paths.json` | `4cfefe7c1a332dd79635b782a1d7c98aa70e825f1adc3ecf065c1481fe2f8b7d` |
| `contracts/registry/operation-handler-bindings.json` | `98597d1b7d505f10467e056b048f2d105a87114c47be1e74f538a8f3bd2049f0` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/terminal/TerminalActivationController.java` | `baee436b92b4f0bf22be4b151d628a9b94a3764e89dcf997023f49d472c98c25` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java` | `0a76a86b30f7364e9b2c54738916c61cdad7afad75b386f77993c5f3221547a9` |

## 聚焦验证与证据边界

执行命令：

```bash
node --test --test-name-pattern='remote resource preflight|backend acceptance remote preflight' scripts/test/r5-remote-testcontainers.test.mjs
```

结果：3/3 PASS；其中一例对生成的远端 Bash 仅执行 `bash -n` 语法解析。运行时间在本地测试 stdout 中未输出；记录时间为 2026-09-26 22:54 UTC（2026-09-27 07:54 Asia/Seoul）。这是短时本地 focused test，无受管 runtime manifest / managed run id。它没有连接 SSH、启动 Docker/Testcontainers/TDS、创建隧道、触碰数据库或运行 DEV/L2/reset/seed。

因此，本记录只证明脚本生成与 parser 的本地聚焦行为。远端 Node/Undici/UDS 的实际能力、远端 resource preflight、TDS 进程拓扑、真实 HTTP/WebSocket、运行日志及 cleanup 均为 `NOT_RUN`，不能由本地 PASS 升级。

## Fresh 独立步骤对账

- Verdict：`STEP_RECONCILIATION=MATCHED`，`M/S/N=0/0/0`，证据档位为只读源码、测试与报告/hash 核对。
- Reviewer 检查了需求 R-1.1/R-12、详设 §10.5/V-S14、计划 Step 7 与首次动态运行门、Backend Acceptance 主动规范、AGENTS/project-memory、当前 runner、测试及公开激活契约；没有发现需主 agent 修复的 finding。
- Reviewer 未编辑文件，也未运行测试、SSH、远端、Docker/Testcontainers、DEV、L2、reset 或 seed。
- Reviewer 确认 `scripts/test/test-health-entry-runner.mjs:52` 已将该 Node suite 纳入显式测试入口。
- 对账后主 agent 复算了 runner、测试与激活 contract/controller/scenario 的 SHA-256，均与上表一致；对账期间没有非主 agent 写入。
- 本 verdict 只关闭本步骤三维一致性，不证明任何远端 Node/TDS/WebSocket/cleanup 动态结果。

## 当前运行状态

- 当前字节上的最新运行：run id=`N/A`（无受管 manifest 的本地 focused Node test）；记录时间 `2026-09-26 22:54 UTC`；结果 `PASS 3/3`。
- 最后一次通过：同一 focused run；`PASS 3/3`；与记录时当前字节一致。远端受管验收仍 `NOT_RUN`。
