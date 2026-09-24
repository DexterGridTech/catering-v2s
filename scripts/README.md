# catering-v2s 标准动作

本目录是 v2s 仓内动作的唯一入口。R1 与 R2 已关闭并达到 `V2S_FOUNDATION_READY`；Dexter 已暂停 `R3-J02` implementation-facing design，其历史资产为 `PENDING_RECOVERY`，不得继续 handoff 或作为 implementation 输入。第一批、`DESIGN_GOVERNANCE_BATCH_1_5` 与 Batch 2 inventory 已由 Dexter 接受；R3-C01 的低保真线框已经 Dexter 接受。R3 全范围详设与实施计划已接受，且 R3 implementation 已授权：C-01 是唯一业务 Journey，整体覆盖 R3-TECH、契约、脚本、后端、数据库、双 app 边界、测试与证据。U01 Gate 0、U02 skeleton、U03 contract/codegen 与 U04 backend owner/migration 已完成，当前按 U05-U07 继续。后端保持并列的 `catering-business-server`（R3 当前唯一业务 deployable）与 `terminal-data-server`（未来 TDP 空占位）；后者在 R3 不提供 runtime、endpoint、database、migration、generated wire、seed 或业务行为。不得恢复 J02/C-02。旧 `R3-J01` 保留为历史 `NO_GO`，`R3-C02` 在 R3 的运营用户真实登录保持删除。

获批 UI-bearing Journey 的交互设计先执行 `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md`：逐屏盘点 all-v2 对应页并以带 `path@hash` 的静态摹本/截图为线框基线；仅当没有对应页才新画。未来实现才按 manifest 显式搬运页面、组件、shell/foundation，generated wire 始终按 v2s edge OpenAPI 重生成。本条不授权任何实现，也不允许 Heritage runtime/build fallback。

## 开始任务

```bash
scripts/context/agent-context health
scripts/context/recall-memory \
  --task-kind review --domain platform \
  --consumer-face backend --owner platform \
  --impact governance --trigger task-start
```

必须逐个打开 recall 返回的 kernel/routed 原文。代码结构只用：

```bash
scripts/context/recall-code --query '<exact symbol or text>'
```

## R1 检查

```bash
scripts/check/project-memory
scripts/check/agent-lifecycle
scripts/check/provider-free-context
scripts/check/foundation-standard-actions
scripts/check/roadmap-program-registry
scripts/check/module-dependency-registry --require-empty
scripts/check/handoff-debt
scripts/check/heritage-registry
```

以上 R1 checker 只用于读取冻结的历史记录，不构成当前会话的 evidence/package/hash 准入。

## R4 verification

`scripts/verify` 聚合编译、类型、既有测试、契约生成与架构边界检查。它不启动 DEV、seed、reset 或浏览器；静态通过不能冒充动态业务验收。

### 门店终端规则单源

`contracts/catalog/store-terminal-rules.json` 是门店终端功能、场景、范围、纸规格、连接方式、打印机品牌与型号的唯一规则住址；JSON Schema 校验结构并按连接方式校验参数语义，生成器再校验闭集引用与跨表关系。修改正本后执行：

```bash
node scripts/generate/store-terminal-rules.mjs --write
node scripts/generate/store-terminal-rules.mjs --self-test --check
```

该生成器输出后端 Java、运营后台 TypeScript 与 OpenAPI enum sidecar；`scripts/verify --validate-only` 的 `store-terminal-rules` 静态门执行红变异与生成物漂移检查。生成文件不得手改。

## R5 remote Testcontainers

When the local host has no Docker daemon, execute focused R5 Testcontainers from the remote development host with the JVM and Docker daemon on the same network plane:

```bash
node scripts/test/r5-remote-testcontainers.mjs :apps:backend:catering-business-server:modules:asset:test
```

可用 `node scripts/test/managed-run-summary.mjs [managed-evidence-root]` 对受管 run manifest 做只读汇总。它报告有记录时长、墙钟跨度、run 总时长、中位数、最大值、run 间未归因间隙、business/cleanup/status/failureCategory 与阶段（无显式阶段时按 verification mode、operation 或 task）统计；无效 manifest 会使汇总为 `INCOMPLETE`，不会静默忽略。

The entry creates a per-run temporary source and Gradle snapshot on that host, reuses only a fixed remote dependency cache, returns the test report under `.runtime/r5/evidence/remote-testcontainers/`, compares Testcontainers resources before and after the run, and deletes its exact temporary directory. Before source sync it rejects identity-matching prior managed processes, prior RSS above 2048 MiB, or any stale `org.testcontainers=true` container/volume; those observations are written into the run manifest. It neither starts DEV nor uses the DEV database as a Testcontainers substitute.

The root Gradle build has a fail-closed guard for every test source that imports or constructs Testcontainers. Such a task must receive `V2S_TESTCONTAINERS_EXECUTION_PLANE=remote`, which only the managed remote runner exports immediately before the remote JVM starts. Direct local Gradle execution therefore stops with `V2S_TESTCONTAINERS_REMOTE_REQUIRED` before Testcontainers can invoke `DockerClientProviderStrategy`; no local Colima or Docker socket fallback is permitted.

All local managed DEV/L2 runners must call `scripts/env/check-runtime-resource-budget <runtime-root>` before starting processes. The default checker only recognizes manifest PID plus OS start token, refuses prior live managed work or RSS above 2048 MiB, and never kills a process. When the explicitly authorized TER run is intentionally kept alive during management-backend/frontend validation, the backend acceptance and DEV runners use the narrow `--profile admin-validation-with-ter` profile: it admits only the exact `.runtime/ter-virtual-keyboard-android/` manifest subtree and raises the aggregate RSS ceiling to 4096 MiB; any other live managed tree or an over-budget aggregate still fails closed.

### Backend acceptance（当前真实业务能力）

当前场景扩展的主动设计规范是
`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`；后续新增业务
测试必须先读该规范，再按业务域写入对应的 `*AcceptanceScenarios.java`。

2026-08-14 起，唯一公共入口是
`scripts/test/backend-acceptance --operation all`（也可用同一参数聚焦单个 operation）。性能校准只可使用
`scripts/test/backend-acceptance --operation all --calibration`：它校验 238 个 operation 的 exact-set、正常样本与连接门，
但不把未校准的固定 DB 上限当作已验收预算。普通 `all` 则无条件执行完整预算门；两种模式都在真实远端
Testcontainers 中启动应用，经真实 HTTP 自动发现并串行运行全部已注册的手写 fixture/request/business
assertion，逐条分开打印 `CONTRACT`、`BUSINESS` 和场景内信息性 `DB_OPERATIONS`；结果还明确标记
`businessMode=REAL`，桩断言不得通过。当前场景覆盖 IAM、ORG、商业合同、asset、catalog、audit、extension、
collaboration 与 business-channel 的权限、隔离、状态迁移、字段脱敏、读回和跨域业务规则；本批的绑定查询
过滤/排序/分页、认证类型空值语义以及项目/门店经营渠道状态规则均由真实 HTTP 场景覆盖。原 196 个 provider 壳、
共享 SPI 与 scenario registry 已下线删除，不再作为
测试入口或覆盖依据。`BackendAcceptanceTest.java` 只保留唯一 Testcontainers/HTTP 入口与共享支撑；新增业务断言应按业务域修改
`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/IamAcceptanceScenarios.java`、
`OrganizationAcceptanceScenarios.java`、`CommercialContractAcceptanceScenarios.java`、
`AssetAcceptanceScenarios.java`、`CatalogAcceptanceScenarios.java`、`AuditAcceptanceScenarios.java`、
`ExtensionAcceptanceScenarios.java`、`CollaborationAcceptanceScenarios.java` 或
`BusinessChannelAcceptanceScenarios.java`，由
`BackendAcceptanceScenarioCatalog` 自动发现。

新增场景必须同时写真实 fixture、真实 HTTP request 和真实业务 oracle；不得只断言 response.ok、
状态码或“不抛异常”。报告只把 `CONTRACT`、`BUSINESS` 和信息性 `DB_OPERATIONS` 分开列出，
`BUSINESS` 必须是 `businessMode=REAL`。受管 Testcontainers 资源仍须 cleanup PASS，但 cleanup
不是场景业务维度。

旧 scenario-level PERFORMANCE verdict、accepted-baseline、known-uncovered、provider exact-set、
lane/并行/心跳/work-stealing、scenario calibration 与 correctnessCases 继续退役。下一条业务
scenario 只复制真实 fixture、HTTP request 与业务断言。Dexter 2026-08-22 恢复的 generated
238-operation budget 由独立 run-level verifier 消费同一 HTTP completion events；不写进
`@AcceptanceScenario`、不参与其 `CONTRACT`/`BUSINESS`，不复活旧 provider/性能 lane。

Docker-backed Gradle `:test` tasks are never accepted from `FROM-CACHE`, `UP-TO-DATE`,
`NO-SOURCE`, or `SKIPPED`: the build keeps compile/dependency preparation reusable but disables
reuse for the Test task, and the managed runner reads the target task line from the current Gradle
log and fails closed when it is missing or skipped. This prevents a stale Testcontainers result
from being reported as a fresh technical PASS.

## 环境执行矩阵

### 完整 DEV seed

“seed” 的唯一公开入口是：

```bash
scripts/dev/seed --profile r5-full --dry-run
R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full
```

它依次装载 R5 基础 owner facts 与 catalog/inventory 体验数据，不能选择或宣称单独的
catalog/inventory 部分 seed。父 receipt 在 `.runtime/r5/seed/complete/`，有序链接两个子报告；
任一组件的 business、cleanup、同一 managed DEV run 或 readback 不通过，完整 seed 即失败。
`start/restart` 永不隐式 seed，seed 也不会自动 stop/reset/start；失败的部分体验数据只由下一次
显式 reset 清理。

每次真实 `r5-full` 执行都由 `scripts/dev/r5-complete-seed-executor.mjs` 自动写出同一 run 目录下的
`seed-report.json`（机器校验真相）和 `seed-report.md`（可读报告），并在最终 stdout 同时打印
`REPORT=<.../seed-report.json>` 与 `MARKDOWN=<.../seed-report.md>`。Markdown 会自动展开两个子报告的
endpoint 分组、API 调用数、HTTP/数据库 average/min/max、关联缺口、非 API 阶段和 Catalog 数据计划；
不得再手工拼接父报告或把两个子报告的计量重新合并。仅需修复已有 JSON 报告的展示时，可使用
`node scripts/dev/r5-complete-seed-executor.mjs --render-existing <.../seed-report.json>` 重生成同目录
Markdown，不会重新执行 seed。

- **DEV**：受信远端非生产主机启动 Spring Boot，与 PostgreSQL/对象存储同侧；本机只启动 `platform-admin` 与 `operations-admin` Vite，经受管 tunnel 转发 Java HTTP 与资产端口。禁止 PostgreSQL tunnel、本机 Java fallback、远端 Vite/浏览器。start/restart 可 additive Flyway，绝不 seed。
- **当前受管浏览器 L2**：Spring Boot 在受信远端非生产主机运行；远端先为本 run 预检独立 HTTP 端口；本机只启动两个 Web Vite 与 Playwright，tunnel 仅转发该远端 Java HTTP 端口和资产端口。每 run 使用隔离的远端数据库/资产 namespace；runner 必须保留远端 Java HTTP port、PID/PGID/boot id/start ticks/command digest、远端日志与 readiness，以及本机 Vite/Playwright/tunnel identity，并分别证明业务结果与两侧 cleanup。不得启动本地 Spring、不得建立 PostgreSQL tunnel。
- **后续 UAT**：仅在 Dexter 单独授权后，应用与浏览器执行面均部署并运行在远端；本机 runtime、DEV 数据库或静态检查不能替代 UAT。

远端 Testcontainers 保持其 JVM/Docker 同平面的技术验证边界，不能被解释为上述浏览器 L2 或 UAT。

### 受管浏览器 L2 的唯一调用顺序

L2 框架、单一真相、fixture、进度、join、cleanup 与失败纪律以
`doc/platform/browser-l2-execution-standard.md` 为唯一正本。仅在获得浏览器 L2 动态授权后，按
`readiness → same-run P1 activation → generated-chain check → same-run byte-binding finalize → managed run` 运行；catalog 当前入口为：

```bash
node scripts/test/browser-l2-runtime.mjs readiness
CATALOG_INVENTORY_L2_READINESS_MANIFEST=<readiness-manifest.json> node scripts/generate/catalog-inventory-p1.mjs --write --check
# 此处继续执行专题批准的完整生成链；finalize 会先刷新同一 run 所拥有的两个 Vite，再绑定当前仓库字节。
node scripts/test/browser-l2-runtime.mjs finalize
node scripts/test/browser-l2-runtime.mjs run
```

如果 readiness 在 held run 建立前失败且 cleanup 未通过，仍只能由同一受管入口按同一 run 的失败 manifest
恢复：

```bash
node scripts/test/browser-l2-runtime.mjs cleanup <same-run-readiness-manifest.json>
```

该 recovery 只接受当前 run 目录中 `status=FAIL` 且 `cleanupStatus=FAIL` 的 readiness manifest；cleanup
失败会保留 `CLEANUP_REQUIRED`，在 cleanup PASS 前不能启动新的同类 run。

第二步与第三步之间必须继续执行该专题批准的完整生成链，不能手工编辑 active execution、fixture、
locator bindings 或 generated output。每个 case 必须输出开始、完成、完成数和剩余数；动态证据只在
discovered/selected/results exact、join 完整、business PASS 且本机/远端 cleanup 全 PASS 时成立。

### Testcontainers 运行前后的 DEV 联动

某次 `scripts/test/backend-acceptance` 或其他受管 Testcontainers 入口一经授权，runner/orchestrator 必须先读取 DEV manifest：

- 若受管 DEV identity 有效，记录 `DEV_WAS_RUNNING=true`，经 `scripts/dev/stop` 关闭；只有 stop cleanup PASS 才继续测试；
- 若没有 DEV，记录 `DEV_WAS_RUNNING=false`，不得按端口或进程名猜测并停止任何进程；
- 只有 Testcontainers `business=PASS` 且 `cleanup=PASS`，并且 `DEV_WAS_RUNNING=true`，才经 `scripts/dev/start` 恢复 DEV，使其运行当前最新代码；
- 测试失败不自动重启，原先没有 DEV 也不补启动；restart 不 seed，且 restart 自身的 business/cleanup/first-failure 证据必须单列。

该隐含授权只覆盖受管 DEV stop/start，不覆盖 reset、seed、浏览器 L2、UAT 或任何数据动作。

### DEV 拓扑显式读回（必须先确认）

DEV 的固定拓扑标记是：

```text
TOPOLOGY=REMOTE_JAVA_LOCAL_VITE_REMOTE_NON_PRODUCTION_MIDDLEWARE
JAVA_APPLICATION=REMOTE_TRUSTED_NON_PRODUCTION_HOST
WEB_APPLICATIONS=LOCAL_HOST
MIDDLEWARE=REMOTE_NON_PRODUCTION
TRANSPORT=MANAGED_HTTP_AND_ASSET_SSH_TUNNEL
```

具体映射由 `scripts/dev/r5-dev-runner.mjs` 的受管 runner 建立：Java 的 JDBC/对象存储 endpoint
指向远端同机地址，不经过本机；本机只有 Java HTTP 与资产两个受管 forward，供 Vite proxy 和浏览器
资产访问。manifest 必须记录远端 Java 的 trusted host、boot id、PID、start ticks、command digest、
日志/readiness，以及本机两个 Vite 和 tunnel 的 PID/start token。若 runner 仍 spawn 本机 Gradle 或
建立 PostgreSQL forward，start 必须以拓扑不匹配失败，不得 fallback。
本段是执行入口约束；后续获批的 runner 变更还必须把上述四个字段、remote host binding
与 tunnel identity 同时写入 run-scoped manifest 和启动 stdout，不能把本段文档存在误报成
runtime 已经输出拓扑字段。

`reset` 不依赖本机 `psql`、`V2S_DEV_DATABASE_ADMIN_URL` 或管理员秘密。它先复用
`r5-dev-environment` 的远端 host hash、非生产检查和精确 namespace 数据库派生，再以
`ssh -o BatchMode=yes` 在已绑定远端主机执行 `docker exec catering-postgres psql -U catering -d postgres`。
受管顺序固定为 terminate connections → drop 精确数据库 → 远端 readback 确认不存在；reset
不会在本机连接数据库、启动临时 tunnel、使用本机 Docker 或自行 create 数据库。随后 `scripts/dev/start`
复用既有远端 provision 路径创建业务库。实际 reset 写入独立 `reset/<run-id>/run-manifest.json`
和脱敏事件日志；如有当前 DEV，只能先核验其 own manifest 与 start token，再委托既有 runner stop。

## 验证工作的通用规则

R3–R6 及后续步骤遵循 `doc/decisions/2026-07-24-v2s-verification-governance.md`：机器门只处理可机械判定的事实，且必须驱动 production 并以真实 red mutation 证明会失败；业务语义留给 fresh 独立对抗审查和 Claude review，不做关键词式伪语义 checker。新门须同时满足“反复发生、纯机械、维护成本低于未来返工”三问；交付超过半小时审阅量先切小，`scripts/verify` 保持分钟级，变慢先砍最弱门。

## 测试健康闭环

- `scripts/test/test-health-entry-runner.mjs --self-test` 只验证显式 Node 测试入口的分母与红变异；`--node` 才执行这份有限清单，并要求 `DISCOVERED_TEST_FILES` 与 `EXECUTED_TEST_FILES` 精确相等。新增目录必须作为显式入口加入，禁止用宽 glob 掩盖空匹配。
- 旧 performance、HTTP diagnostic、baseline 与 lane 资产已退役；历史文档不能被当作当前执行入口。
- 静态/本机单元与契约检查的 PASS 只证明对应静态范围；不得写成 Testcontainers、DEV、seed、受管 L2、浏览器、业务、cleanup、UAT 或性能 PASS。动态状态必须由独立授权的受管 runner、business evidence 和 cleanup evidence 关闭。

## 对抗式 review

自下一个 review cycle 起，每次 design/implementation 交付前必须由 fresh 独立子 agent 先作对抗盲审，从业务用户与 Dexter 立场以“找出它为什么不成立”为目标形成 findings 与 verdict；作者只在此后写辩证 intake。从设计使用 `REVIEW_TARGET=DESIGN`；实现代码完成后必须重新使用 `REVIEW_TARGET=IMPLEMENTATION`，回读实际生产源码、可执行 evidence 与真实用户行为，不能用设计审查替代。独立子 agent prompt 必须逐项列出 `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md` 的最小输入。运行：

```bash
scripts/check/codex-self-review --file <repository-relative-self-review.md>
scripts/check/codex-self-review --self-test
```

production gate 会拒绝缺少上述必要内容的 reviewer verdict 或作者 intake，closure-only red fixture 证明“只验代码/报告完整”不能通过，blind-finding-acceptance red fixture 证明“因为 reviewer 说了所以全盘接受”也不能通过。Claude 独立 review 继续遵守同一质量底线，但不能替代独立子 agent 审查。规则 owner 为 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`。

收到任何 reviewer finding 后，Codex 不得全盘接受或直接拒绝：逐条重开 owning source/代码/evidence，对外部漂移事实查官方一手资料或做可复现实验，主动寻找反例与适用条件，并写明 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`。只有已确认部分能驱动修订；修复还要与更小方案比较，避免审查诱发过度设计，信息不全不得武断扩范围。

轮次上限按 Dexter 2026-09-14 裁定区分（正本见上述治理决定第 1 节）。`REVIEW_TARGET=DESIGN` 同一 `REVIEW_CYCLE_ID + REVIEW_TARGET + 批准范围` 最多两轮：每轮声明 `REVIEW_ROUND=1|2`、固定 `REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、输入清单路径与盲审声明；第二轮声明 `ROUND_FINAL_DECISION=SELF_DECIDED` 后由作者基于独立 finding 的处置证据收口，不得继续召集第三轮；换 reviewer/模型/文件/措辞或局部修订不重置，只有 Dexter 实质改变 Journey、范围、授权/目标才建立有触发记录的新 cycle。`REVIEW_TARGET=IMPLEMENTATION` 不设轮次上限但必须依据详设文档：`REVIEW_ROUND` 只作正整数序号，不得声明 `REVIEW_ROUND_LIMIT` 或 `ROUND_FINAL_DECISION`。`--self-test` 包含 DESIGN round-three、DESIGN round-two-without-self-decision、IMPLEMENTATION 声明轮次上限、closure-only 与 blind-finding-acceptance red fixtures，并证明 IMPLEMENTATION 第三轮可通过。

## Codex hooks 客户端兼容性

`CODEX_CLI_VERSION_CHANGED` 是重跑原生 hooks parser probe 的精确触发事实。触发后必须从 v2s 根执行一次 `codex exec --ephemeral --json --dangerously-bypass-hook-trust` 的只读入口 probe，扫描完整 event stream 是否出现 `failed to parse hooks config`，并记录 client version、命令、错误信号与退出码；客户端可能在 event 中报告解析失败但进程仍退出 `0`，禁止只看 exit code。`scripts/check/agent-lifecycle` 继续承担确定性 schema、命令与 red-fixture 门，不能代替客户端 probe。

该触发器是 AI 控制面兼容性维护规则，不是生产化欠账；`HANDOFF.md` 继续只保存冻结的七项生产化欠账，不得为此扩成第二 Roadmap。

## Roadmap

只从 `doc/platform/roadmap-program-registry.json` 按显式 `programId` 解析。`PREPARED_NON_AUTHORITATIVE` 不得被当作 current owner；只有 `ACTIVE` 且 transfer receipt/current hash readback 全部通过时才可发现。

## Runtime 与 Git

- R1/R2 均未启动受管或非受管动态资源；R3 专项设计不改变该事实，R3/W1 未获实现授权前继续禁止；
- 若未来存在 `.runtime/agent-sessions/<sessionId>.json`，Stop 只检查该 session 与其显式 `managedRunIds`；
- `start/restart` 未来必须迁移 schema 但不得 seed；`seed/reset` 始终独立；
- 不执行 Git stage、commit、push；Git 归 Dexter。
