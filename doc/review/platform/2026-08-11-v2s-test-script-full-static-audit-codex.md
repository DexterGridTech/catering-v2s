# 测试脚本全面静态问题发现报告（Codex）

```text
AUDIT_KIND=TEST_SCRIPT_STATIC_DISCOVERY
AUDIT_DATE=2026-08-11
REPOSITORY_ROOT=/Users/dexter/Documents/workspace/idea/catering-v2s
CURRENT_STEP=BACKEND_PERFORMANCE_FINAL_CLOSURE
SCOPE=unit;testcontainers;seed;managed-dev;l2;verification-aggregation
EXECUTION=STATIC_READ_ONLY
DYNAMIC_ENVIRONMENTS_STARTED=0
VERDICT=NO-GO_FOR_DYNAMIC_TEST_ADMISSION
FINDINGS_SUGGESTED=M6/S7/N1/P1
```

## 1. 结论与边界

本报告是对测试脚本能否真实证明其宣称目标的静态问题发现，不是对业务实现、196 条动态结果或性能的结论。建议在下列 M 级问题关闭前，不把 Testcontainers、seed 或 L2 的失败/成功作为可信的动态准入证据：入口参数会把“L2”扩大为 API+L2；新运行会停止既有受管 DEV；196 HMAC 只验格式；跨进程首败被抹平；`--validate-only` 实际会触发动态命令；远端 Testcontainers 忽略持续 heartbeat 而误判 stall。

本轮没有启动 Testcontainers、DEV、seed、reset、L2、浏览器、UAT、部署或手工 SQL；也没有改动任何测试实现。所有结论均来自权威 Roadmap、测试治理、脚本、测试源和静态语法检查。

## 2. 审计分母、方法与已证实正项

| 审计面 | 有限清单 | 静态核验方法 |
| --- | ---: | --- |
| 测试面文件（前端测试、后端测试、脚本、fixture、runner） | 158 | 入口可达性、命令分母、断言/报告字段、失败/cleanup 分支 |
| 后端 `src/test` Java 源 | 116 | Testcontainers workload、跨进程结果读取、fixture 协议 |
| `scripts/test` 与 `scripts/dev` 脚本入口 | 65 | `node --check`、参数→stage、受管资源、报告与诊断生命周期 |
| Node 脚本单测 | `scripts/test` 15 + `scripts/dev` 10 | 发现是否被权威执行入口覆盖 |

已执行的机械检查为：所有顶层 `scripts/test/*.mjs` 与 `scripts/dev/*.mjs` 的 `node --check`，结果 `NODE_CHECK_EXIT=0`。这只证明可解析，不能证明命令分母、协议、失败诊断和 cleanup 符合目标。

下列情况经核验，不列为问题：

| 核验项 | 结果 |
| --- | --- |
| 当前 joint L2 runner 对 Playwright 显式传入 `--workers=1` | 通过；operations Playwright config 未单独声明 worker 不是当前 runner 的并发问题。 |
| `catalog-inventory-l2.spec.ts` 只消费其 L2 fixture，不把 API/seed 报告当成 L2 证据 | 通过；真正问题在其上游入口选择了错误 stage。 |
| Testcontainers reaper 对容器、卷、已拥有进程树和 scratch 有实际 cleanup 检查 | 通过；下文 S-02 是“报告将 terminal manifest 写成已验证”的证据绑定缺口，不是声称没有 cleanup。 |
| Java 测试未发现以 `@Disabled` 或 focused 测试绕过的当前问题 | 通过。 |

## 3. 发现总表

严重级别为建议分级，最终整改范围与 severity 由 Dexter 裁决。`CONFIRMED` 表示已在本轮直接重开 owning source 验证；`PARTIALLY_CONFIRMED` 表示发现模式和静态事实成立，但是否影响某次运行仍须将来有授权时以受管日志确认。

| ID | 建议级别 | 状态 | 问题族 | 影响测试面 |
| --- | --- | --- | --- | --- |
| TSA-M01 | M | CONFIRMED | `RUNNER_STAGE_ARGUMENT_NON_CLOSURE` | catalog L2 / joint runner |
| TSA-M02 | M | CONFIRMED | `PREEXISTING_RUN_TREATED_AS_BOOTSTRAP` | managed DEV / API+L2 runner |
| TSA-M03 | M | CONFIRMED | `EVIDENCE_AUTHENTICITY_FORMAT_SUBSTITUTION` | Testcontainers 196 DB evidence |
| TSA-M04 | M | CONFIRMED | `FIRST_FAILURE_CROSS_PROCESS_ERASURE` | Testcontainers Java workload / remote runner |
| TSA-M05 | M | CONFIRMED | `CLI_MODE_DOES_NOT_FILTER_COMMAND_DENOMINATOR` | verification aggregation |
| TSA-M06 | M | CONFIRMED | `LIVENESS_SIGNAL_NOT_INCLUDED_IN_STALL_DISCRIMINATOR` | remote Testcontainers monitoring |
| TSA-S01 | S | CONFIRMED | `STATIC_TEST_DISCOVERY_EXECUTION_DENOMINATOR_OPEN` | Node script/unit tests |
| TSA-S02 | S | CONFIRMED | `TERMINAL_EVIDENCE_CLAIM_PRECEDES_ARTIFACT` | Testcontainers report |
| TSA-S03 | S | CONFIRMED | `ACTIVE_MANIFEST_CONFUSED_WITH_TERMINAL_EVIDENCE` | managed DEV lifecycle |
| TSA-S04 | S | CONFIRMED | `EVIDENCE_LIFECYCLE_STARTS_AFTER_PREFLIGHT` | catalog/owner seed |
| TSA-S05 | S | CONFIRMED | `CHILD_TEST_STAGE_NOT_TERMINAL_EVIDENCE` | L2 fixture / legacy L2 runner |
| TSA-S06 | S | CONFIRMED | `READINESS_POLLING_WITHOUT_PROGRESS_EVIDENCE` | DEV and L2 readiness |
| TSA-S07 | S | CONFIRMED | `JSON_PAYLOAD_CONTENT_TYPE_NOT_MATERIALIZED` | final performance workload executor |
| TSA-N01 | N | CONFIRMED | `DOCUMENTED_COMMAND_SURFACE_DRIFT` | scripts README |
| TSA-P01 | P | PARTIALLY_CONFIRMED | `ASYNC_FIXTURE_BRIDGE_OBSERVABILITY_GAP` | owner-fixture bridge |

## 4. M 级发现：动态结果目前不应作为准入证据

### TSA-M01 — “catalog L2” 参数未映射到 L2-only stage

- **事实与证据**：批准的 BPF 设计调用 `node scripts/test/catalog-inventory-l2.mjs --managed`；该 wrapper 在 `scripts/test/catalog-inventory-l2.mjs:17-19` 原样转发 `--catalog-inventory`。但 `scripts/test/r5-joint-remote-l2.mjs:26-29` 只识别 `--catalog-api-only` 与 `--catalog-l2-only`，其它参数一律落入 `BOTH`。`BOTH` 会走 API 预检/既有 DEV 操作（约 `:375-381`）并执行全部 browser suites（约 `:406-409`）。
- **目标偏差**：名称、设计调用与实际 command denominator 不闭合；一次意图为 catalog L2 的调用会扩大为 API+L2，失败归因、资源、fixture 与报告分母随之漂移。
- **最小根因修复**：以唯一 source-derived argument map 将 wrapper 显式映射为 `--catalog-l2-only`，或拒绝未知 catalog stage 参数；不要靠调用者记忆参数。
- **验收/红变异**：机械断言 `入口参数 → stage → child commands → Playwright spec set` 精确相等。删除任一映射、将 L2-only 降回 BOTH、或加入未知参数，均必须红。

### TSA-M02 — 新 runner 会停止既有 managed DEV，未 fail-closed admission

- **事实与证据**：`scripts/test/r5-joint-remote-l2.mjs:145-152` 调 `r5-dev-runner stop` 处理既有 managed DEV；其 self-test 把 `STOPPED_PREEXISTING_MANAGED_DEV` 视作成功（约 `:366-369`）。
- **目标偏差**：现行运行资源预算要求发现历史受管 tree 或超预算时拒绝新 run，且只有当前 runner 明确拥有的 process tree 可被停止。停止前一运行既可能破坏证据，也会把所有权错误伪装成 bootstrap 成功。
- **最小根因修复**：在启动前读取 manifest、PID start token、资源预算和运行 ownership；发现既有受管 run 时以稳定错误码拒绝。仅保留当前 run 自己的 cleanup；不把“停止历史 run”当作正常路径。
- **验收/红变异**：预置同一 runtime 的活 manifest/正确 start token，新的 runner 必须拒绝且不调用 stop；伪造过期 token 也必须拒绝而非按 PID/端口猜测。

### TSA-M03 — 196 条 HMAC 仅作正则格式检查

- **事实与证据**：`scripts/test/backend-performance-testcontainers-196.mjs:250-258` 及 `:327-330` 仅验证 `hmacValue` 满足字符串格式；其 self-test（约 `:417-438`）使用格式合法但任意的重复字符作为正样本。远端 runner 会读取 key（`scripts/test/backend-performance-testcontainers-remote-runner.mjs:294-299`），但向 `buildBackendPerformance196Report` 传递的入参/产物未把该 key 用于验证（约 `:500-527`）。
- **目标偏差**：报告可接受任意格式正确、内容伪造的数据库操作 HMAC，无法证明 196 evidence 来自报告所称 runtime。
- **最小根因修复**：在唯一持有非秘密 key 的远端受管边界做 `timingSafeEqual` 验证，仅向上输出不含 secret 的验证 receipt/commitment；最终 report 必须绑定该 receipt。
- **验收/红变异**：格式正确但 MAC 错误、替换 key、替换 operation payload 三种 mutation 必须失败；禁止把 regex check 重新当作真实性证明。

### TSA-M04 — 首败在 Java workload → remote runner 边界被泛化丢失

- **事实与证据**：远端 workload 的 catch 已写结构化 `firstFailure`（`scripts/test/backend-performance-testcontainers-remote-workload.mjs:295-299`）。但 Java 测试先在读取结果前断言 child `exitCode`（`BackendPerformance...Test.java:170`，结构化结果读取约 `:176-184`）；父 runner 在 Gradle 非零时仅发出泛化 `REMOTE_TEST_OR_CONTAINER_CLEANUP_FAILED`（`r5-joint-remote-l2.mjs:568-571`），而读取 workload result/build report 在成功路径（约 `:584-595`）。
- **目标偏差**：首败、last-known-good、broken-boundary 不能可靠跨进程保留，后续修复会面对泛化失败而非根因。
- **最小根因修复**：无论 child 成败，都先读取并验证最小结构化结果；Java 把安全的 `firstFailure` 映射为 assertion/receipt，父 runner 把三项写入 terminal manifest。读取失败本身应成为明确 boundary failure。
- **验收/红变异**：构造 child 失败且含唯一安全错误码的 fixture；顶层 report/manifest 必须保留该码，替换为泛化错误或跳过 result 读取必须红。

### TSA-M05 — `scripts/verify --validate-only` 实际包含动态 Testcontainers 与 seed dry-run

- **事实与证据**：`tools/verify-gates/verify.mjs:7` 接受 `--validate-only`，但 command list 仍包含 remote Testcontainers（`:14-18`）与 `scripts/dev/seed --profile r5-full --dry-run`（`:22`）；执行循环只排除 U12（`:34`），并没有按 mode 过滤命令。
- **目标偏差**：CLI 名称承诺 validate-only，却可触发远端/容器/seed 相关动态操作；这会越过静态审计或 package 的授权边界，也让“验证失败”不能定位到预期分母。
- **最小根因修复**：声明 source-derived mode→command denominator；`--validate-only` 只能包含零动态 child 的静态检查，动态聚合使用另一个显式授权 mode。不要把 dry-run 当作天然无副作用的豁免。
- **验收/红变异**：用 spawn fake 断言 validate-only 的 child set 内不含 remote、Testcontainers、seed；普通全量 mode 则作为反例允许其显式出现。

### TSA-M06 — 远端 Testcontainers 有 heartbeat，但 stall 判定未消费 heartbeat

- **事实与证据**：remote workload 每 15 秒写 `RUNNING HEARTBEAT`（`backend-performance-testcontainers-remote-workload.mjs:313-314`）。runner 会收集 heartbeat（`backend-performance-testcontainers-196.mjs:404-415`），但 stall observation 仅比较 log bytes、workload SHA-256 与 test-result bytes（`:553-564`），连续两次不变便 terminate；heartbeat 进展不重置该判断。受测 Java workload 本身允许长达 15 分钟（约 `:59`）。
- **目标偏差**：在三项观察量静止、但 heartbeat 持续推进时，健康的长运行可能在约 20 秒观察窗口内被当作 stall 终止，造成假失败。
- **最小根因修复**：将单调 heartbeat/phase sequence 纳入 liveness observation，并在 manifest 记录每次判定依据；保留无 heartbeat 时的受控诊断/终止。
- **验收/红变异**：固定 worker/log/result 内容而推进 heartbeat，必须不终止；停止 heartbeat 时才允许进入诊断/终止路径。

## 5. S 级发现：证据、分母与诊断不完整

### TSA-S01 — Node 测试被发现但未纳入权威执行分母

- **事实与证据**：发现 `scripts/test` 15 个与 `scripts/dev` 10 个 `.test.mjs`。`tools/verify-gates/verify.mjs:12-23` 未运行这些测试；仓内已发现的 package test 命令只运行前端 architecture `.test.mjs`，并明确从 Vitest 排除 `.mjs`。platform-admin 另有四个非 architecture `.test.mjs` 同样不在该路径。
- **目标偏差**：存在测试源不等于会被日常验证执行；红变异可能永远不进入任何命令分母。
- **整改方向**：维护由实际入口派生的静态测试清单，或在一个明确静态 test command 中执行全部有限集合；新增未登记 `.test.mjs` 必须使 denominator control 红。

### TSA-S02 — Testcontainers report 在 terminal manifest 落盘前声明已验证

- **事实与证据**：`backend-performance-testcontainers-196.mjs:512-517` 在 report builder 中把 `terminalManifestVerified: true` 写死；真正的 manifest 最终写入发生在约 `:599` 之后。
- **目标偏差**：report 对尚未存在/未重读验证的工件预先作出真实性声明。
- **整改方向**：先持久化并重读 terminal manifest，再生成含 manifest digest、cleanup receipt 与验证结果的报告。缺失、hash drift 或重读失败必须失败。

### TSA-S03 — managed DEV 只保留 active manifest，停止后删除而无 terminal receipt

- **事实与证据**：`scripts/dev/r5-dev-runner.mjs:245` 仅写 active run manifest；`stop()` 在 `:256-266` 完成停止后删除该 manifest，未持久化包含 business/cleanup、first failure、进程 readback 的 terminal artifact。失败启动也在未完整 manifest 前清理（`:247-253`）。
- **目标偏差**：L2/seed 的前置 runtime 无法从 durable terminal evidence 判定其运行结局与 cleanup，而不是仅凭终端输出。
- **整改方向**：active 和 terminal manifest 分离；启动失败、正常停止、cleanup 失败均写最小 terminal receipt，且保留受控 PID identity。

### TSA-S04 — seed 在 preflight 被拒绝时尚未创建 run-scoped 证据

- **事实与证据**：`scripts/dev/catalog-inventory-seed-executor.mjs:308-316` 先做 confirmation、静态 plan、managed run 与 profile 检查；直到 `:317-327` 才创建 run directory/manifest/report。故前述任一失败没有本 run 的 first-failure/phase/cleanup report。
- **目标偏差**：seed 是明确破坏性、受管的动态步骤；拒绝前置条件同样是可诊断业务入口，不能只留 stdout 异常。
- **整改方向**：在读取外部前置条件前生成最小安全 run receipt；成功后扩展为完整 manifest。不得记录 secret/原始 payload。

### TSA-S05 — L2 fixture 与仍可调用的 legacy runner 缺少统一 terminal 证据字段

- **事实与证据**：`catalog-inventory-l2-test-fixture.mjs:348-353` 成功只写 `status/calls/events`，失败只写短 `reason`；无 `firstFailure`、`lastKnownGood`、`brokenBoundary`、business/cleanup 的成对字段。`scripts/test/r5-platform-admin-l2.mjs:45-47` 的 legacy result 也只含 `business/cleanup/phases/terminalManifest`，未满足当前统一诊断字段，并仍是可执行文件。
- **目标偏差**：子阶段或遗留入口失败时，根因字段与 current joint runner 不兼容，容易在聚合后丢诊断；legacy 可执行入口还会诱导旧标准复用。
- **整改方向**：为 fixture 写统一的 terminal receipt schema；对 legacy runner 做显式 retire/fail-closed 或迁移到 current runner，不能静默保留第二条可执行规范。

### TSA-S06 — readiness 轮询没有过程日志/heartbeat

- **事实与证据**：`r5-dev-runner.mjs:158-168`、`r5-joint-remote-l2.mjs:249-262`、`r5-platform-admin-l2.mjs:34-43` 均每秒轮询到固定 120 秒；循环内没有阶段 heartbeat、最后一次健康信息或日志摘要，失败后才诊断。
- **目标偏差**：固定等待本身不是诊断；当 readiness 卡住时，无法从 run evidence 区分进程、Flyway、tunnel、HTTP 或 UI 边界。
- **整改方向**：保留受控总 deadline，但周期性写入脱敏进度、最近可用 log/readiness 状态与 identity；不以延长 timeout 或重试取代原因定位。

### TSA-S07 — final workload executor 对 218 个 JSON body 未 materialize `Content-Type: application/json`

- **事实与证据**：`scripts/test/backend-performance-final-fixtures.mjs:121-125` 对有 request body 的 fixture 只 materialize Cookie/body；`scripts/test/backend-performance-workload.mjs:63` 对 body 统一 `JSON.stringify`，但 headers 未加入 `Content-Type: application/json`。静态从 fixture catalog 重算，396 条中有 218 条 `requestBodyRequired=true`（PATCH/POST/DELETE/PUT）。单测的 fake fetch 恒返回成功，且只断言两个 performance attribution header（`backend-performance-workload.test.mjs:35-43`）。
- **目标偏差**：该脚本是 fixture catalog 声明的 source procedure，不是可退役冗余脚本；它将成为后续 managed performance run 的 HTTP 发射器，却不能证明 218 个 JSON 负载会按 HTTP JSON 契约交付。
- **整改方向**：当且仅当 body 存在时，由 materializer/唯一 request builder 显式生成并断言 `Content-Type: application/json`；对无 body 请求禁止伪造该 header。单测须覆盖至少一个有 body 和一个无 body 的真实 catalog row。

## 6. N/P 级发现

### TSA-N01 — README 与实际 verification command surface 漂移

`scripts/README.md:58-60` 将该验证面描述为 R4 静态/验证脚本，未反映当前 `verify.mjs` 已在 R5 聚合 remote Testcontainers 与 seed dry-run。整改 M05 时同步把 CLI mode、动态授权和命令分母写明，避免文档把危险入口呈现为普通 verify。

### TSA-P01 — owner fixture bridge 的 heartbeat/首败尚未成为 runner 可消费 receipt

owner fixture wait loop 与 Java bridge 各自有超时/日志，但当前静态读取未证实其进度与首败被稳定带入最终 runner manifest。此模式与 M04 同根：异步边界的诊断不可只依赖 child stdout。建议在 M04 修复设计中把 bridge receipt 纳入同一 `firstFailure/lastKnownGood/brokenBoundary` 契约；是否曾导致实际失败需在未来获授权的受管运行中以日志验证。

## 7. 建议整改批次（按根因，不按单文件）

1. **先关运行权属与命令分母**：M01、M02、M05、S01、S05、N01。产出统一入口表、mode/stage 精确集、legacy disposition 和红变异。
2. **再关证据真实性与跨进程诊断**：M03、M04、S02、S03、S04、P01。产出统一 terminal receipt schema、HMAC verification receipt、跨进程首败保全和 preflight receipt。
3. **最后关受管 liveness/readiness 与 workload HTTP protocol**：M06、S06、S07。产出 heartbeat-based liveness 判别、readiness progress evidence、fixture-protocol control。

每批应遵循：先重开当前 Roadmap/测试目的/operation line/owning source，再建立该根因族的有限分母和反例；不能只改报告字段、放宽断言、加 timeout、添加 retry，或将失败脚本从入口中删除。

## 8. 本次整改必须下线删除的脚本

以下集合不是“暂不调用”或“保留兼容”。它们已被现行 joint runner 完整替代，且没有当前 runtime 执行责任；TSA-D02 仍被一个静态 gate 读取这一事实不构成保留理由，而是要求先在同一整改中完成 gate 分母迁移。保留为可执行入口只会重新引入第二套 L2 生命周期、fixture 和终端报告规范。因此应作为本次整改的**删除对象**，同时删除其专属单测；历史 design/evidence 文档只保留历史引用，不应被改写成活入口。

| 退役 ID | 本次删除路径 | 证据 | 删除后的必要控制 |
| --- | --- | --- | --- |
| TSA-D01 | `scripts/test/r5-platform-admin-l2.mjs` | 仅自身及历史文档引用；当前 BPF/catalog L2 经 `catalog-inventory-l2.mjs` → `r5-joint-remote-l2.mjs`。该 legacy runner 另起 DEV、自己 readiness、自己的 terminal schema。 | source scan 断言无活源码引用；任何旧入口调用应 fail-closed 并指向 current joint runner。 |
| TSA-D02 | `scripts/test/r5-platform-admin-l2-fixture-seed.mjs` | 运行时唯一调用方是 TSA-D01；当前 joint runner 使用 `r5-joint-remote-l2-fixture.mjs`。但 `scripts/check/backend-performance-sql-merge-coverage:398-413` 仍将它作为 host-extension fixture input。 | 同一整改中先把该静态 gate 的有限 fixture 分母迁移为 current joint fixture 并加 exact-set/red mutation，再删除该文件；不得先删文件或把 gate 改成宽松扫描。 |
| TSA-D03 | `scripts/test/r5-platform-admin-l2-fixture-seed.test.mjs` | 仅覆盖 TSA-D02；保留会制造已退役 fixture 的绿色假象。 | 迁移仍有业务价值的 assertion 至 current joint fixture 单测，否则在 TSA-D02 迁移后同批删除。 |

**不得删除的反例**：`scripts/test/backend-performance-workload.mjs` 不是冗余旧脚本；它由 fixture catalog 和静态 reconciliation 直接引用，是 TSA-S07 的修复对象而非删除对象。`scripts/test/catalog-inventory-l2.mjs` 也是现行 wrapper；其问题是 M01 参数映射，必须修复而非删除。

## 9. Claude 合并接口

Claude 应独立从源码重算，不能采信本报告结论。合并时以 `问题族 + 主执行入口 + 有限分母` 为主键：

- 两份报告证明同一根因时，保留双方独立 source/line evidence，不按数量重复计数；
- severity 不取平均；若一方证据支持更高等级，按更高等级保留并由 Dexter 裁决；
- 一方找出反例或入口不可达时，标记 `UNRESOLVED_REQUIRES_EVIDENCE`，不得静默删除；
- 每项必须保持 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE`、测试目的偏差、影响分母、最小根因修复、真实 red mutation 与动态授权边界；
- 合并产物不得把本静态审计表述为 Testcontainers、seed、L2、业务、cleanup 或性能已通过。

## 10. 复核材料

- 当前 Roadmap：`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`
- 测试治理：`project-memory/operations/verification-governance.md`、`project-memory/operations/dev-command-separation.md`、`project-memory/pitfalls/log-first-failure-retry.md`
- 现行 joint runner：`scripts/test/r5-joint-remote-l2.mjs`
- Testcontainers 196：`scripts/test/backend-performance-testcontainers-196.mjs`、`scripts/test/backend-performance-testcontainers-remote-workload.mjs`
- DEV / seed：`scripts/dev/r5-dev-runner.mjs`、`scripts/dev/catalog-inventory-seed-executor.mjs`
- L2：`scripts/test/catalog-inventory-l2.mjs`、`scripts/test/catalog-inventory-l2-test-fixture.mjs`、`scripts/test/r5-platform-admin-l2.mjs`

## 授权边界

本报告仅覆盖测试脚本、测试源、fixture、受管 runner、控制面、文档与静态证据。未运行任何动态负载。它不授权 Testcontainers、DEV、L2、reset、seed、UAT、部署、手工 SQL 或下一 Roadmap step；也不宣称 196 条接口、业务、cleanup、性能或动态环境已通过。
