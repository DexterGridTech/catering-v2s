---
title: catering-v2s R3 walking skeleton implementation-facing design
status: IMPLEMENTATION_DESIGN_IN_AUTHOR_REVIEW
createdAt: 2026-07-24
programContext: V2S_W0_W4_EXECUTION
roadmapRef: doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md
authorizationRef: doc/decisions/2026-07-24-v2s-r3-specialized-design-authorization.md
implementationAuthority: false
---

# catering-v2s R3 walking skeleton implementation-facing design

## 0. 结论与授权边界

R3 推荐建立一条可证明而不过度迁移的真实链：

```text
platform-admin 登录并恢复当前 session
  -> 标准 Nginx 反向代理
  -> 单一 Spring Boot 业务 app
  -> platform_identity / platform_workspace owner schema
  -> 按已知 workspaceKey 核验工作区
  -> 只读确认注册状态与基础事实
```

`operations-admin` 同期只建立独立 app、独立登录/session 恢复面、独立 generated slice 与独立 session guard；不增加第二个业务页面。这样同时证明两个 consumer face 非空且不交叉，又把“一个真实页面”的业务范围锁在单一候选 Journey。

本设计不授权任何实现。开始 `GATE_0_READINESS` 前仍必须同时得到：

1. Claude 对本设计 `GO(0 M / 0 S / N*)`；
2. Dexter 明确接受 `R3-J01` 的产品入口；如改选其他入口，先修订并重审受影响设计；
3. Dexter 对 R3/W1 implementation exact scope 再授权；
4. Java/Spring 与前端版本 spike decision；
5. `GATE_0_READINESS` 先于第一行业务代码真实 PASS，真实 artifact 后续仍必须通过 production conformity。

## 1. 方案合理性与替代

| 方案 | 收益 | 代价/风险 | 结论 |
|---|---|---|---|
| A. platform-admin 按已知 workspaceKey 核验工作区；operations-admin 仅独立登录 | 一个真实查找/详情任务能证明登录、face、生成、owner readback、查询与真库；业务分母最小 | 需要三个 owner module，operations 尚无业务页；具体任务仍需 Dexter 接受 | **推荐** |
| B. 两个 admin 各做一个业务页 | 两端都能做完整 L2 | 直接把 R3 从一条 skeleton 扩为两个 Journey，scope 翻倍 | 拒绝 |
| C. 只做 `/me` 或 health 页面 | 最快 | 不是真实业务页，容易产生静态假绿；还可能偷建第二套 readiness | 拒绝 |
| D. operations-admin 零角色空工作台 | 与冻结规则一致 | 不足以证明真实 lookup/detail read model；平台 app 仍需非空 slice | 仅作备选，需 Dexter 改选 |
| E. 复制 all-v2 workspace/iam 页面与服务 | 代码现成 | 把 Heritage 拓扑、内部 client、投影与旧生成面带回 | 拒绝 |

`R3-J01` 是设计候选，不是已批准产品真相：

```text
Actor=platform principal
Entry=/sign-in
Task=登录后按已知 workspaceKey 找到工作区，并确认其注册状态与基础事实
PageKey=PLATFORM_WORKSPACE_REGISTRATION_CHECK
OwnerReadback=platform-workspace
Mutations=NONE
```

候选的最小交互语义是：一个精确 `workspaceKey` 查询框；提交后只返回 0 或 1 条匹配结果；命中后由名称打开只读详情，确认 `name / workspaceKey / status / createdAt / revision`；未命中明确显示“未找到”，不回退成模糊全量目录。Dexter 若要“浏览全部工作区”或“按名称发现工作区”，会改变查询、分页、空态和 L2 分母，必须先裁决并重审。

Operations 登录只证明独立 principal/session/security/client slice；登录或刷新后通过自身 current-session operation 恢复 principal，再落到 app-owned 的明确“本阶段未开放业务页面”状态。不伪装业务完成，不共享 platform 页面、session、store、router 或文案。

## 2. 冻结边界与模块

### 2.1 runtime topology

```text
browser
  -> nginx (only public ingress)
  -> backend:8080 (private network, X-Edge-Auth required)
  -> one PostgreSQL database
       public.flyway_schema_history
       platform_identity.*
       platform_workspace.*
       operations_identity.*
```

- Nginx 删除外部 `Forwarded`、`X-Forwarded-*`、`X-Correlation-Id`、`traceparent`、`tracestate`、`X-Edge-Auth`，再覆盖写入可信值；禁止 append。
- backend 第一层 `EdgeCredentialFilter` 常量时间校验 `X-Edge-Auth`；缺失/错误时在 session/security/filter 之前拒绝。
- backend 只有一个进程；不引入 gateway app、Spring Cloud、MQ、outbox、Redis、TDP、搜索或内部 HTTP/OpenAPI client。
- DEV 与 L2/L3 都经同一 Nginx 模板；backend 端口不发布到宿主公共入口。

### 2.2 owner modules

| module | schema | 主权 | 对外窄 API |
|---|---|---|---|
| `platform-identity` | `platform_identity` | platform principal、credential、session、rate limit/audit | `OpenPlatformSession`, `ReadCurrentPlatformSession`, `ClosePlatformSession` |
| `platform-workspace` | `platform_workspace` | workspace 状态与 exact lookup/详情 read model | `JudgeWorkspaceLoginAvailability`；task query 自有 |
| `operations-identity` | `operations_identity` | operations account、workspace employment、session、rate limit/audit | `OpenOperationsSession`, `ReadCurrentOperationsSession`, `CloseOperationsSession` |

依赖登记：

- `COMMAND operations-identity -> platform-workspace / JudgeWorkspaceLoginAvailability`；
- `SCHEMA_FK operations-identity -> platform-workspace / (workspace_key, workspace_id)`；
- 无 TASK_READ 跨 schema；R3-J01 的 exact lookup/详情只读 `platform_workspace` 自有 schema；
- 三图均无环。`operations-identity` coordinator 开启 `REQUIRED`，目标 workspace judgment 加入同一事务。预期凭证/工作区拒绝返回 typed denial 而不是抛异常：同一事务提交脱敏失败计数与 security-denial audit，但绝不创建 session 或 success audit；非预期基础设施异常整体回滚并 fail closed。禁止用 `REQUIRES_NEW` 绕过 owner 事务。

### 2.3 security and session

- 两种 login request 物理分开：platform 为 `account + password`；operations 为 `workspaceKey + account + password`。
- 两类 cookie 名、path、session table、filter chain 与 owner 完全分开；禁止 union login DTO 或按可选字段猜 principal。
- 两个 app 都必须通过自身 `GET .../sessions/current` 在刷新后恢复 HttpOnly-cookie session；open-session response 不能成为唯一 session 真相。
- platform current-session `200` 只返回 guard 所需的 `principalId / displayName / expiresAt`；operations current-session `200` 只返回 `principalId / workspaceId / workspaceKey / displayName / expiresAt`。R3 不把 role、page、capability 或通用 scope 字段塞进 bootstrap response。
- missing、expired、revoked 与 cross-face cookie 对当前 face 返回不可区分的 `401`，并由该 app 清除本地 session state 后回到自身 sign-in；网络失败或 `5xx` 显示可重试的“服务暂不可用”，不得冒充未登录。业务 endpoint 的 `403/409` 仍是登录后的独立状态。
- unknown account 与 wrong password 同 Problem code、同 dummy-hash 路径；账号/来源双桶 fail-closed；HMAC 指纹，不存明文 account/IP。
- cookie 固定 host-only（不写 `Domain`）、face-specific name/path、`HttpOnly; Secure; SameSite=Strict`；DEV 只通过 TLS 终止代理或专用 loopback secure profile，不因方便关闭 Secure。
- admin 与 API 只走同源代理；不注册 CORS mapping、`@CrossOrigin` 或 credentialed CORS。两个 face 的 canonical origin 只来自 server-managed `security.browser-origin.platform` / `security.browser-origin.operations`，启动时规范化为 exact `scheme + host + effective port`；配置缺失、含 userinfo/path/query/fragment 或无效时启动失败。不得从客户端 `Host`、`Forwarded` 或 `X-Forwarded-*` 推导目标 origin。
- filter 顺序固定为 `EdgeCredentialFilter -> BrowserForgeryFilter -> session/auth -> owner adapter`。所有 unsafe browser request 都要求与 face 配置 exact-match 的非 `null` Origin；有 body 时只接受 `application/json`。若浏览器发送 `Sec-Fetch-Site`，值必须是 `same-origin`；兼容客户端未发送时以 strict Origin 校验作为 fallback，不因 header 单独缺失而拒绝。cross-site/`null`/缺失 Origin、form content type、跨源 OPTIONS 均拒绝且响应不得出现 `Access-Control-Allow-Origin` 或 `Access-Control-Allow-Credentials`。
- R3 选择这一条 custom origin/fetch-metadata 防线替代 Spring synchronizer token；`SecurityFilterChain` 只有在 `BrowserForgeryFilter` bean 存在且 production validator/L2 绑定时才允许关闭 framework CSRF，缺 filter 必须 context/gate 失败，禁止裸用 `.csrf().disable()`。授权后的 browser spike 若无法覆盖批准浏览器矩阵，只能由一条新 decision 单线改用 Spring CSRF token，并重算 operation/generated/L2 denominator；禁止双实现。
- consumer face 只控制 route 可见性；owner 仍从服务端 session 解析 actor 并 default-deny。
- secret、cookie、password、完整认证头、edge credential 不进日志、evidence 或错误 body。

## 3. edge OpenAPI 与生成闭包

唯一 wire 真相为 `contracts/openapi/edge.openapi.json`。R3 denominator 精确为：

| operationId | method/path | face | owner/result |
|---|---|---|---|
| `openPlatformSession` | `POST /api/platform/sessions` | `PLATFORM_ADMIN` | platform-identity |
| `getCurrentPlatformSession` | `GET /api/platform/sessions/current` | `PLATFORM_ADMIN` | platform-identity current principal |
| `closePlatformSession` | `DELETE /api/platform/sessions/current` | `PLATFORM_ADMIN` | platform-identity |
| `lookupPlatformWorkspaceByKey` | `GET /api/platform/workspaces?workspaceKey=...` | `PLATFORM_ADMIN` | platform-workspace exact lookup view |
| `getPlatformWorkspaceDetail` | `GET /api/platform/workspaces/{workspaceId}` | `PLATFORM_ADMIN` | platform-workspace detail |
| `openOperationsSession` | `POST /api/operations/sessions` | `OPERATIONS_ADMIN` | operations-identity |
| `getCurrentOperationsSession` | `GET /api/operations/sessions/current` | `OPERATIONS_ADMIN` | operations-identity current principal |
| `closeOperationsSession` | `DELETE /api/operations/sessions/current` | `OPERATIONS_ADMIN` | operations-identity |

每个 operation 的 `x-consumer-faces` 必须为非空闭集；未知或缺失 face、额外手写 allowlist、不可达 schema、跨 app generated import 均失败。生成链：

1. OpenAPI Generator `spring` + `library=spring-boot` + `interfaceOnly=true` + `useSpringBoot4=true` + `useJackson3=true` 生成 backend interface/type；
2. 仓内 Node generator 从同一 JSON 生成 server route-face registry；
3. 同一 generator 为两个 app 生成各自的 RTK Query `injectEndpoints` 与 reachable type closure；
4. `--check` 在临时目录生成并逐字节对比；count 断言为 `server=8 / platform=5 / operations=3`；
5. `libraries/frontend/admin-ui-foundation` 已按 Dexter 要求原样复制为 v2s shared foundation inventory；R3 不接入两个 App、不以它证明 C-01 业务行为，也不因复制目录推导两个 App 已共享。后续任何 UI 功能实现必须优先对接其中已有能力；只有 foundation 未覆盖且完成设计说明、focused test/evidence 后，才可保留 App-local 实现。

## 4. 页面与 read model

`PLATFORM_WORKSPACE_REGISTRATION_CHECK` 是一页、两个独立 decision surface：

- lookup：提交 exact `workspaceKey` 后返回 0 或 1 条，列只含 `name / workspaceKey / status / createdAt`，无操作列；name 打开详情；不做未获批准的模糊搜索、默认全量列表或客户端过滤；
- detail：右侧 Drawer，`Descriptions bordered` 只读展示 `name / workspaceKey / status / createdAt / revision`，无业务动作；
- list/detail 分别有 loading、真空、查询无结果、401、403、409、网络/依赖失败与未知错误；
- detail body 可滚动，footer 不存在；关闭后焦点回到触发名称；
- databaseOperationCount：session context 1 + exact lookup 1，lookup `<=2`；detail context 1 + detail query 1，`<=2`；
- SQL 显式列、显式 status/revoked 谓词；不使用 `SELECT *`、DML、锁、通用 `PageResponse<T>` 或字段袋。

`operations-admin` 只有独立 sign-in 与登录后显式 scope boundary；无业务 menu/page/read model，不建立空 feature 目录或假工作台。

## 5. GATE_0 readiness 与 production conformity

### 5.1 两段式先后顺序

```text
G0-00 freeze denominator and version candidates
  -> G0-01 create production validators
  -> G0-02 validator shared-core self-tests on canonical fixtures
  -> G0-03 external discriminating red fixtures
  -> G0-04 GATE_0_READINESS on current tree:
       D.1 layout clean + business-source inventory empty
  -> record GATE_0_READINESS_PASS_AT and exact empty inventory/tree hash
  -> only then create build/contract/migration/application sources
  -> PC-01 contract/generated PRODUCTION_CONFORMITY after R3-U02
  -> PC-02 Flyway/module PRODUCTION_CONFORMITY after R3-U03
  -> PC-03 full conformity rerun before implementation closure
```

`businessSource` 机械定义为 `apps/**`、`contracts/openapi/**`、`contracts/catalog/**` 与 migration 文件；GATE_0_READINESS 在这些路径仍为空时只证明 validator wiring、自测、red fixtures 与 D.1 当前树约束，不冒充真实 contract/migration 已通过。时间 oracle 必须绑定 Gate 0 evidence hash、空 inventory 与 Dexter 所有的 Git baseline；若无法证明 baseline 先于业务 source，R3 直接 NO-GO，不能用删除/重建文件、mtime 或 R4 补门追认。

Gate 0 的最小 checkpoint 协议：

1. `GATE_0_READINESS` PASS 后立即硬停止，evidence 记录 validator/denominator hash、red-fixture 结果、精确空 business-source inventory 与 tree hash；
2. Dexter 作为 Git owner 创建包含 validators、readiness evidence 与空 inventory 状态的不可变 checkpoint commit，Codex 不代做 Git 写入；
3. Codex read-only 重算并记录 `GATE_0_CHECKPOINT_COMMIT=<full sha>`，只有 commit tree 与 evidence tree/hash 一致才解除 U02-U05 的串行阻断；
4. 后续每次 production conformity 与 closure evidence 都记录 target commit，并用 `git merge-base --is-ancestor "$GATE_0_CHECKPOINT_COMMIT" "$TARGET_COMMIT"` 证明 descendant；
5. 当前 dirty worktree、`HEAD`、mtime 或聊天时间均不得充当 checkpoint；Dexter 未发布可验证 commit 时保持 NO-GO。

### 5.2 gate set

| gate | R3 scope | 必须红的错误 |
|---|---|---|
| `scripts/check/code-layout` | D.1 四条完整到期分母 | root pages/shared/utils；Scenario 包名；错 contract 分类；空源码/红夹具目录 |
| `scripts/check/walking-skeleton-contracts` | 上述 8 operation、face registry、两 app slice、reachable schema、count/bytes；Gate 0 先用 canonical fixture 自测，U02 后才对 production tree 要求存在 | 缺 face；缺 current-session；platform operation 漏/多生成；operations 引入 platform type；手改 generated |
| `scripts/check/flyway-layout` | 一份 history、UTC 毫秒唯一单调、模块 DDL owner、引用方 FK 例外 | 第二 history；重复/倒序版本；跨 owner DDL；CASCADE/DEFERRABLE |
| `scripts/check/gate-0` | 聚合 validator wiring/self-test/red fixtures、D.1 current-tree clean 与业务 source 空 inventory；不在空树上要求 production contract/migration 存在 | helper 绿但 production `run()` 未接线；空树被误报为 contract/Flyway conformity |
| `scripts/check/r3-production-conformity` | U02/U03 后依次把真实 8/5/3 contract/generated 与三 owner migration 交给同一 production validator | artifact 缺失仍绿；canonical fixture 代替 production tree |

每门支持 `--self-test`，且 self-test 与生产入口调用同一 validator。外部 discriminator 在 scratch copy 注入貌似合理错误并验证精确 failure reason。

R3 不把 R4 的完整 ArchUnit、现实边对账、全量 query SQL、真库跨 workspace/revoked、reachable wire 全仓、retirement 与 affected-L2 mapping 偷前置成完成声明；但 R3 实际写到的 Java module imports、8 个 operation 与三个 owner migration 文件必须在各自创建后通过 production conformity。

## 6. 版本 spike 与依赖白名单

设计时一手资料候选快照：

| item | candidate | freeze rule |
|---|---|---|
| Java | 21 | 固定 toolchain 21 |
| Spring Boot | 4.1.0 | spike 决策后冻结；不凭 3.x API 记忆 |
| Spring Framework | Boot BOM，至少 7.0.8 | 不手工 override |
| OpenAPI Generator | 7.22.0 | server generator 必须同时启用 `useSpringBoot4=true` 与 `useJackson3=true` |
| Flyway | Boot 4.1.0 BOM 的 12.4.0 | 不追随独立最新 13.x |
| Testcontainers | Boot 4.1.0 BOM 的 2.0.5 | 使用新 artifact/package，不按 1.x 记忆 |
| PG driver / Jackson | Boot BOM | 禁手工版本 |
| ArchUnit | **DEFERRED_EXACT_VERSION** | spike decision 必填后才可开工 |
| Gradle wrapper | **DEFERRED_EXACT_VERSION**，满足 Boot 4.1 的 8.14+ 或 9.x | spike decision 必填 |
| Node/pnpm/React/AntD/ProComponents/RTK | **DEFERRED_EXACT_VERSION_SET** | 前端 spike decision 必填且 API 由锁定版本 CLI/官方文档核对 |

允许后端依赖仅限 Spring web/security/JDBC/transaction/validation、Flyway、PG、Jackson、OpenAPI generated compile needs、JUnit 5、Testcontainers、ArchUnit。JPA/Hibernate、Lombok、Spring Cloud、Redis/MQ/search client、Resilience4j、Quartz 均由 dependency gate 拒绝。

spike evidence 必须同时证明：compile、Spring context、SecurityFilterChain、JdbcClient/JdbcTemplate、Flyway 从零 migrate、Testcontainers PostgreSQL、OpenAPI generated binding、cookie login、Nginx ingress、cleanup。任一硬阻塞写新 decision，只保留一条版本线；禁止兼容双线。

## 7. DEV、seed/reset 与 evidence

五命令精确分权：

- `scripts/dev/start`：创建唯一 active DEV manifest，启动 PG→backend→两个 admin→Nginx；Flyway additive migrate；不 seed；
- `scripts/dev/restart`：复用同一 manifest/volume，重启进程并 migrate；不 seed/reset；
- `scripts/dev/stop`：只按 manifest 身份停止，逐资源 readback，禁止 kill-by-port；
- `scripts/dev/seed`：显式调用各 owner 的 dev-only fixture loader，创建两类账号与 workspace；不得成为生产 route；
- `scripts/dev/reset`：二次显式确认 runId + allowlist，清 dev database/volume 与已登记 asset；前后计数；不自动 seed。

walking skeleton runner 使用 run-scoped 临时资源，不复用 DEV。business 至少包括：

1. start/restart 后 seed marker 仍不存在；
2. forged forwarded/internal/correlation/edge headers 未进入 trusted context；
3. 缺失/错误 edge credential 直连 backend 被拒；
4. 两个登录面 cookie/principal 不能互认；
5. platform login 经代理成功，刷新后 current-session 恢复，exact workspaceKey lookup 与详情 readback 匹配 seed owner fact；
6. operations login 经代理成功，刷新后 current-session 恢复，generated slice 非空且不含 platform operation/type；
7. 两个 current-session 分别覆盖 valid `200` 最小字段、missing/expired/revoked/cross-face 不可区分 `401`、网络/`5xx` 不冒充未登录；
8. expected denial 提交脱敏失败计数/audit 但无 session/success audit；unknown/wrong/inactive 不可区分；
9. missing/null/cross-site Origin、present-but-cross-site Fetch Metadata、form login、跨源 OPTIONS 与 credentialed CORS 均被拒绝；missing Fetch Metadata + exact Origin 的兼容路径通过；
10. 401/403/409/网络失败 UI 不互相冒充；
11. stop 后 cleanup PASS、active resources=0。

## 8. 实现单元与精确路径

### R3-U01 — GATE_0 readiness 与版本冻结（必须最先）

创建：

- `contracts/policy/walking-skeleton-denominator.json`
- `tools/code-layout/cli.mjs`
- `tools/walking-skeleton-contracts/cli.mjs`
- `tools/flyway-layout/cli.mjs`
- `scripts/check/code-layout`
- `scripts/check/walking-skeleton-contracts`
- `scripts/check/flyway-layout`
- `scripts/check/gate-0`
- `scripts/check/r3-production-conformity`
- `doc/decisions/<implementation-date>-v2s-r3-version-and-dependency-spike.md`
- `doc/evidence/platform/<implementation-date>-v2s-r3-gate-0.json`

更新：`contracts/policy/standards-coverage-matrix.json` 仅在 `code-layout` 的 clean/red/self-test 全部真实存在后，把 `D.1.L01-L04` 从 `PLANNED` 改为 `ACTIVE`。保留 D.2/D.3 为 R4，不伪装完整门已到位。

### R3-U02 — build、contract 与 generated closure

创建：

- `settings.gradle.kts`, `build.gradle.kts`, `gradle/libs.versions.toml`, Gradle wrapper 四件套
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- `contracts/openapi/edge.openapi.json`（精确 `8/5/3` operation closure，含两类 current-session bootstrap）
- `contracts/catalog/pages.json`, `contracts/catalog/problems.json`
- `tools/openapi-face/cli.mjs`, `scripts/generate/openapi-face`
- `build.gradle.kts`
- `apps/platform-admin/package.json`, `apps/operations-admin/package.json`
- 三个 target 的 app-owned generated 输出（backend build-generated；两个 admin 位于各自 `src/app/api/generated/`）

不创建全局 generated model、shared wire、frontend allowlist 或 consumer graph；`admin-ui-foundation` 仅按明确迁移请求作为未接入的 shared foundation inventory 保留，不进入本 R3 walking skeleton 的运行闭环。

### R3-U03 — backend owner、schema 与 edge

创建：

- `apps/backend/src/main/java/com/catering/v2s/CateringV2sApplication.java`
- `apps/backend/src/main/java/com/catering/v2s/edge/security/{EdgeCredentialFilter,BrowserForgeryFilter,TrustedRequestContext,SecurityConfiguration}.java`
- `apps/backend/src/main/java/com/catering/v2s/platformidentity/{api,application,domain,infrastructure}/...`
- `apps/backend/src/main/java/com/catering/v2s/platformworkspace/{api,query,domain,infrastructure}/...`
- `apps/backend/src/main/java/com/catering/v2s/operationsidentity/{api,application,domain,infrastructure}/...`
- `apps/backend/src/main/resources/application.yml`
- 三个 owner migration 文件，版本名在 spike 当时生成并按 UTC 毫秒严格递增
- focused module/security/migration/integration tests

更新 `contracts/policy/module-dependency-registry.json`：登记三个 module、一个 COMMAND edge、一个 SCHEMA_FK edge。不得创建 coordinator module、repository/domain cross-import、event listener、outbox 或内部 client。

### R3-U04 — 两个独立 admin

每个 app 分别创建：

- `src/app/{main,router,pageRegistry,store}.tsx|ts`
- `src/app/api/{baseApi,generated/...}.ts`
- `src/app/session/...`
- `src/tests/{architecture,l2,traceability}/...`

platform 另建 `src/features/workspace-registration-check/{ui,model,automation}/...`；operations 仅建实际使用的 session feature，不建空业务 feature。两个 app 不互相 import，不共享 Shell/router/store/session/context/theme/page/read model/文案/L2。

### R3-U05 — proxy、受管 runtime 与五命令

创建：

- `infra/reverse-proxy/nginx.conf.template`
- `scripts/dev/{start,restart,stop,seed,reset}`
- `scripts/runtime/run-managed`
- `scripts/test/run-r3-walking-skeleton`
- `doc/evidence/platform/<implementation-date>-v2s-r3-walking-skeleton.json`
- `doc/handoffs/<implementation-date>-v2s-r3-runtime-handoff.md`

更新 `.gitignore` 只排除 `.runtime/`、secrets 与 build outputs；不得忽略 evidence 或生成真相。

### R3-U06 — closure

更新 Roadmap、project-memory module anchors、`scripts/README.md`、`HANDOFF.md`（只在 trigger 事实变化时）；生成 Codex self-review、Claude request、business/cleanup evidence。只有 Claude GO、Dexter 接受与 fresh dynamic evidence 全部完成，才可把 R3 写成 GO。

## 9. retain/delete/not-applicable

保留且不改：冻结 ADR、carryover manifest、R1/R2 immutable evidence、Heritage registry/源仓。

R3 新仓当前无旧 runtime 可删除；以下全部 `NOT_APPLICABLE` 且 gate 必须证明未创建：旧多服务 deployable/DB、Java gateway、Spring Cloud、内部 OpenAPI client、projection/repair、MQ/outbox、polling、TDP、全量 generated union、共享 wire/foundation、第二 Flyway history。

## 10. failure behavior

- GATE_0_READINESS 或 production conformity 首败：保留原始输出，停止后继 source/closure；诊断 validator/denominator/production wiring 后才可第二次尝试。
- version spike 失败：停止，不改成 `3.x/4.x` 双线；新 decision 记录唯一替代。
- migration 失败：保留容器与日志供一次诊断；cleanup 仍单独执行并如实记账。
- login/readback 失败：不把 5xx 映射为未登录，不轮询/固定等待/refetch 追平。
- cleanup 失败：business 可单列 PASS，但整次 run 与 R3 均不得完成。
- 产品入口未获 Dexter 接受：设计可审查，implementation 保持阻断。

## 11. 设计期已知红灯

1. `scripts/check/standards-coverage --phase R3` 当前精确失败于 `PLANNED_ENFORCEMENT_OVERDUE:D.1.L01`；这是 GATE_0_READINESS 实现前红灯，不在设计期伪修。
2. `R3-J01` 是推荐候选而非冻结产品 Journey；implementation 前需 Dexter 明确接受。

已关闭的控制面缺口：Dexter 已澄清 Codex 对必需 checker 拥有直接维护权；`scripts/check/implementation-design-granularity` 现以 production validator + shared-core self-test + 五类判别性 red fixture 存在，并由正式 `claude-review-handoff` 调用。该关闭不授权业务实现，也不能靠改 review kind、删字段或文档自洽冒充。

## 12. Codex 对抗自审双门与两轮上限

R3 设计与未来实施代码必须分别通过同一方案合理性标准，不能复用一次结论：

1. design packet 使用 `REVIEW_TARGET=DESIGN`，先审业务用户任务、Dexter 立场、替代方案、复杂度/收益、UI/交互，再审边界闭环；
2. implementation 完成后另写 `REVIEW_TARGET=IMPLEMENTATION`，通过 `scripts/context/recall-code` 重开实际生产源码、配置、contract/generated consumer 与调用链，并运行编译、focused test、L2/L3/受管 evidence；
3. implementation 自审必须重新观察真实用户行为，不能只回答“是否按设计实现”；若实现暴露设计不合理、接口迫使 UI 绕路或文档含糊，重开 design finding；
4. 两次自审均运行 `scripts/check/codex-self-review --file <path>` 与 `--self-test`；closure-only red fixture 必须继续失败；
5. Claude 独立 review 是后继复核，不替代 Codex 自审。
6. 每个 DESIGN/IMPLEMENTATION target 各自建立 `REVIEW_CYCLE_ID`，同一 target/批准范围最多两轮；换 reviewer、模型、文件、hash、措辞或局部修订不重置；
7. round 2 是 Codex 硬停止点，必须声明 `ROUND_FINAL_DECISION=SELF_DECIDED` 并自行给出结论；产品 blocker 直接交 Dexter，不再召集第三轮 Codex reviewer。本 R3 DESIGN cycle 已完成两轮，控制面 checker 已由 Codex 自主关闭，后续只等待 Dexter 对 `R3-J01` 的产品决定与一次 Claude 独立 review。
