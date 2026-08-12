---
implementationAuthority: false
---

# 测试健康闭环整改：详细设计与单批实施计划

`DESIGN_KIND=IMPLEMENTATION_FACING_DESIGN`  
`STATUS=PROPOSED_REVIEW_ONLY`  
`REVIEW_CYCLE_ID=TEST_DELIVERY_PROCESS_REMEDIATION_DESIGN_CLAUDE_REMEDIATION_20260811`  
`REVIEW_ROUND=1 / REVIEW_ROUND_LIMIT=2`  
`DEXTER_SCHEDULED_ACTUAL_DESIGN_ROUNDS=1`

## 1. 目标、取舍与边界

### 1.1 用户任务

本包只让测试健康闭环：C1 写了的测试会执行；C2 红了是真的坏；C3 绿了是真的好；C4 失败看得懂。它不追求自动化发现所有问题，也不把日常 verify、静态检查或 Testcontainers 冒充 L2/DEV/seed/UAT 成功。

权威需求是 `doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-requirements-claude.md` 的 C1–C4、B0a–B5、§7–§10；本设计授权记录是 `doc/evidence/platform/2026-08-11-v2s-test-delivery-and-process-remediation-design-authorization.md`。

| 可选方案 | 裁决 |
|---|---|
| 新建 execution-map/gate/测试治理体系 | 拒绝：既有 catalog 已是唯一映射，超出零新门和最小闭环范围。 |
| jsdom/静态渲染覆盖所有 UI | 拒绝：复杂 AntD+RTK+Redux+router 组件不能伪装为行为测试；日常 verify 不跑 L2 已裁决。 |
| 仅修当天红测试或靠重试 | 拒绝：不能修复文本断言、假绿和命令分母等问题族。 |
| 本设计 | 采用：复用现有 runner/catalog/checker，按有限分母修执行 receipt、断言 oracle 与诊断；无法真实证明的 UI 行为登记欠账。 |

禁止：修改 matrix `rules[]`、新增 gate/jsdom/Testing Library、宽 Node glob、动态 child 混入 `--validate-only`、提前删 legacy fixture、timeout/retry/轮询掩盖首败、把静态 PASS 写成业务或 cleanup PASS。

## 2. 设计分母与问题族

| 分母 | 当前重新核对的基线 | 实施时唯一可接受的判据 |
|---|---|---|
| C1 test entry | 27 `scripts/**/*.test.mjs`、3 foundation tests、8 未接线 Java module/34 `@Test` file、4 orphan feature `.test.mjs` | 显式 discovered 集与实际 success receipt 集双向相等；8 个无 `@Test` Java fixture 明确排除。 |
| C2 tests | 72 Vitest；65 读取被测源码；features=58（33 pure+25 mixed）；app=7（含 1 mixed） | B1 先产 assertion ledger；features 的 25/33 与全仓 syntactic mixed=26/pure=32 不得混用。删除集只能从 ledger 导出。 |
| C3 enforcement | 46 条 ACTIVE non-`UNENFORCEABLE_BY_MACHINE` rules（43 `GATE` + 2 `ARCHUNIT` + 1 `NEGATIVE_FIXTURE`）→17 unique refs；`VERIFY_ROOT=1`；`VERIFY_CHILD=15`；`ARCHUNIT_SELECTOR=1` | catalog 与 matrix 的 17-ref 全集双向精确相等；child receipt 只覆盖 15 个 child，root 和 selector 单列，三类不得互相替代。 |
| C4 runners | remote Testcontainers、workload、managed DEV、joint L2、fixture materializer/executor、legacy L2 chain | 同根扫描后的每个 admitted failure family 都有 owning source、stable typed code、正常路径和真实 red mutation。 |

通用失败模式：`GREEN_BY_EXISTENCE_OR_SELF_DEFAULT`（文件存在或默认值被错当执行事实）、`TEST_SOURCE_TEXT_FALSE_RED`（实现写法被错当 oracle）、`COMMAND_DENOMINATOR_DRIFT`（flag/stage/discovery 与实际 child 漂移）、`FAILURE_CONTEXT_ERASURE`（wrapper 改写 child 首败）、`LEGACY_FIXTURE_DELETION_BEFORE_MIGRATION`（仍被 gate 消费的 fixture 先删除）。每个问题族的最小预防去向是既有 checker/runner 的真实 red mutation、两条新 project-memory 和记载于本包 exit 的 finite disposition；不新建平行体系。

## 3. 目标结构

### 3.1 唯一 execution map 与 receipt

`contracts/policy/standards-enforcement-execution-catalog.json` 继续是唯一 map；其 schema 在本 package 原子升级为 `schemaVersion=2` 并为**每个** entry 声明显式 `kind`。receipt 不是第二份 map，而是 root 本次实际执行的不可变事实。先以 matrix ACTIVE non-`UNENFORCEABLE_BY_MACHINE` 规则派生的 17-ref 全集校验 catalog，再按 kind 取可执行分区；任何改成子集、豁免或仅校验 child 的实现都是 forbidden：

- `VERIFY_ROOT` 恰为 `scripts/verify` metadata：必须有 dependency hashes，必须**不存在** `command` 与 `successMarkers`，仅由 top-level verify 产 root receipt；不能被 `executeActive` spawn。
- `VERIFY_CHILD` 恰为 15 个 `GATE` ref 去掉 `scripts/verify`：必须有非空 `command[]`、`successMarkers[]`、dependency hashes；exit=0 且全部 marker 精确命中才进入 `successfulChildRefs`。
- `ARCHUNIT_SELECTOR` 恰为一个 matrix `ARCHUNIT` ref：必须有非空 Java `command[]`、`successMarkers[]`、dependency hashes，并产生独立 selector receipt，不进入 GATE-child exact set。

`validateExecutionCatalog` 必须先断言 entry ref 集与 17-ref matrix 全集 exact equality（少 root、少 child、少 selector、任意额外 ref 都红），再断言 kind 覆盖互斥、`VERIFY_ROOT` 的 ref/无 command、以及其余两类 command/marker 必填。`executeActive` 只能接收 `VERIFY_CHILD` 分区；请求 root 或 selector 必须 typed fail，且 `scripts/verify` 不得调用它。selector 由 root 的独立 selector path 正好执行一次，U12 只核验两份 receipt，不重新执行任一分区。

唯一执行/运输契约如下，防止 `verify` 与 `standards-coverage` 分别跑出两套事实：

1. `tools/verify-gates/verify.mjs` 是唯一 `VERIFY_CHILD` executor。它按 catalog 顺序只执行一次 **15 个** child，逐项先复算 dependency digest、再运行 command、再逐 marker 验证；第一项非零/漂移/marker 缺失立即停止，后续 child 不执行。当前命令表内已存在的 `backend-boundaries`、`database-boundaries`、`frontend-architecture`、`openapi-contracts` 四项也必须迁为由 catalog 驱动并纳入同一份 root receipt，禁止保留为独立命令表条目或第二套执行事实。
2. root 在执行任何 child 前只以 `node:crypto.randomUUID()` 生成一次不可预测 `rootRunId`；禁止时间戳、递增序号、环境变量或 receipt 自报值派生。它唯一导出 receipt path，并以 atomic no-replace 创建：若该 path 已存在（包括旧 receipt），在执行任何 child 前 typed fail `VERIFY_RECEIPT_PATH_EXISTS`，绝不覆盖。receipt 只含 schemaVersion、rootRef、rootRunId、sequence、ref、dependencyDigests、exitStatus、markerResults、completedAt；不含输出正文、secret 或虚假的 cleanup 状态。success receipt 只能在全部 child 成功后生成。
3. root 只以同一次 invocation 的两个值调用 `scripts/check/standards-coverage --validate-active-receipts <receipt-path> --expected-root-run-id <rootRunId>`；validator 必须要求 receipt `rootRunId` 与 expected 值精确相等，并验证 path identity 一致，且绝不 spawn command。它以 matrix ACTIVE refs 重算 `VERIFY_CHILD` exact set，单列核验 `ARCHUNIT_SELECTOR` receipt，且拒绝 root-as-child、duplicate、missing、extra、substituted、有效旧 receipt、dependency hash drift 与任一 marker/exit 失败。`--execute-active` 不得由 `scripts/verify` 调用；若保留为维护入口，必须显式标为非 root admission，不能产出 U12 receipt。
4. `--validate-only` 首先应用同一 selection 规则，只选 static `VERIFY_CHILD`；不选择 Testcontainers、seed、DEV、L2 或其他动态命令。它输出真实 `EXECUTED=n/m` 和上述 receipt，不再输出未发生的 `CLEANUP=PASS`。

所有真实 red mutation 均针对这份控制面：root 带 command、root 缺失、child 缺 command、selector 缺 command、unknown kind、重复 ref、少 ref、额外 ref、将 exact catalog set 改成 subset 接受、root-as-child、以结构有效的旧 root receipt 替换当前路径、expected rootRunId 不相等、同一路径已存在、hash drift、exit 非零、marker 缺失。`successfulChildRefs` 只能从 root receipt 的 15-child partition 导出。

### 3.2 断言 ledger 与保留边界

先创建可读 assertion-level ledger，字段为 `file / assertion anchor / kind(value|source-text|structural) / imported symbol / target / disposition / rationale`。该 ledger 是 package evidence，不是新 gate。

- `value`：直接调用 pure decoder/helper/state transform 并断言输入输出；泛型 `fn<T>()` 也必须识别。保留/迁到相邻模块测试，仍由既有 U08/U09 Vitest 执行。
- `source-text`：改名/等价重排即可红且未改变行为的变量、CSS、JSX、形参字面，按 ledger 删除。
- `structural`：依赖方向、禁止 API、generated consumer、exact-set 等一行机械边界，留在 A-layer。

`CatalogManagementPage.test.tsx` 的 7 条 decoder/scope、`inventoryManagement.test.ts` 的 `shouldRequestInventoryDiagnostics` 与 `envelopeData<T>`、`OrganizationOverviewFilters.test.ts` 的四个 filter/helper 是已知保留入口，但不是最终列表。复杂 UI 不因缺行为保障而保留 source-text test；仅登记 `HANDOFF.md`。

### 3.3 runner 静态正确性

- catalog wrapper 参数唯一映射 L2-only stage，unknown 参数拒绝，不能退到 BOTH。
- 存在且 ownership-valid 的 managed manifest 必须拒绝新 run，不能 stop 历史 run；只清理当前显式拥有的资源。
- 196 HMAC 的唯一 reusable owner 是新抽取的 `scripts/test/backend-performance-evidence-hmac.mjs`：它从 `backend-performance-final-acceptance.mjs` 原样迁出两份 existing canonical byte sequence 与 `timingSafeEqual` verifier，禁止复制实现。completion domain 的 canonical fields 依次是 `runId|managedDevRunId, correlationId, requestId, operationId, performanceFixtureId, performanceArea, databaseOperationCount, logicalStatementCount`；database-operation domain 的 fields 依次是 `runId, correlationId, requestId, operationId, seq, section, kind, action, statementId ?? ""`，分隔符保持 `\u0000`、算法/编码保持 `HmacSHA256/base64url`。`V2S_DB_OPERATIONS_HMAC_KEY` 只在 verifier boundary 解码，最终 report 只保留 non-secret verification receipt。`backend-performance-final-acceptance.mjs` 与 `backend-performance-testcontainers-196.mjs` 都只能 import shared owner；43 字符但伪造内容、错误 key、任一 canonical field 变化，或 `statementId` 缺失时与迁出前 canonical bytes 不同，都必须精确红。
- heartbeat 进入 stall discriminator；readiness progress、terminal/preflight evidence、JSON `Content-Type` materialization 和 firstFailure 原码逐层透传都以 run manifest/report 为唯一事实。
- Docker/Gradle/browser/host/path 缺失为 `ENV_*`，被测失败为 `TEST_*`，编排为 `HARNESS_*`；不得有硬编码本机 Gradle 路径、`assumeTrue`、默认值自证、blind retry 或 magic wait。

### 3.4 退役与沉淀

先让 `scripts/check/backend-performance-sql-merge-coverage` 的 fixture denominator 迁至 `r5-joint-remote-l2-fixture.mjs`，同时有 exact-set/red mutation，再删 `r5-platform-admin-l2.mjs`、`r5-platform-admin-l2-fixture-seed.mjs` 与对应 tests。旧动态 package input/exit 一律 retain，不顺手重写 hash-bound 历史。

新增 `project-memory/operations/test-closed-loop.md` 和 `project-memory/pitfalls/green-by-existence-check.md`；同步 required inventory，生成 index，并只把闭环 review 指针追加到 matrix `reviewChecklists[]`，绝不碰 `rules[]`。`HANDOFF.md` 登记复杂 UI 和已裁决的无 L2 覆盖面。

## 4. 一个 package 内的强制串行实施链

这是一个 implementation package 的内部序位，而不是可各自宣布完成的分包。任何失败必须保留/读取首败、做同根问题族扫描、修根因并通过 focused red/green proof 后才可推进。

| 序位 | unit | exact scope | completion / red discriminator |
|---:|---|---|---|
| 1 | THCL-01 / B0a | `verify.mjs`、execution catalog、`standards-coverage` 与 focused tests | 17-ref catalog 全集先 exact；root metadata 无 command；15 child 与一 selector 各自按 kind 可执行；atomic root receipt 后才调用 pure U12 validator。root command/缺 root/少 child/额外 ref/动态 child/少 marker/重复执行均红。 |
| 2 | THCL-02 / B0b | receipt transport、exact-set、ArchUnit selector、orphan disposition | 15-child exact set 与 selector receipt 分开；root UUID/no-replace path 先于执行；每 orphan 为 wire/retain/retire，retire 要五 package 无触发证据。subset 取代 exact set、缺/多/substitute/stale receipt ref、path collision 与 marker/hash drift 均红。 |
| 3 | THCL-03 / B0c+B1 | ledger、mixed/tests/app/A-layer | 先重扫 25 feature mixed 和 app mixed；迁 value、删 source-text；两个 app 绿且 declared source-text set 清零。恢复 CSS/JSX/variable spelling assertion 必须被 ledger/scan 拒绝。 |
| 4 | THCL-04 / B2+B3 | explicit Node/foundation/Java entry，env/seed marker/HMAC | `EXECUTED_TEST_FILES == DISCOVERED_TEST_FILES`；空 glob不可能绿；仅 shared HMAC owner 在 key boundary 验证，缺 env、伪造 HMAC、错误 key、canonical payload drift 都精确红。verify duration 仅事后测量。 |
| 5 | THCL-05 / B4 | remote workload/runner、DEV runner、joint L2、fixture/executor reports/tests | stage→child exact mapping、historical run rejection、heartbeat/readiness/terminal/content-type/firstFailure evidence；外层保留 child 原码。 |
| 6 | THCL-06 / B5 | SQL merge checker/test、joint fixture、legacy L2 chain、memory/HANDOFF/README | predecessor fixture exact-set/red proof后才删；全仓 source absence；memory index deterministic rebuild；范围外欠账不得伪装 PASS。 |
| 7 | THCL-07 / package exit | changed-path list、Pre/Post receipts、source/ledger/red proof、implementation review input | 无 PENDING；所有实改路径有 receipt/readback；动态状态全为 `NOT_RUN_AWAITING_SEPARATE_AUTHORIZATION`，然后才可做唯一 implementation review。 |

### THCL-01｜static-only selection 与 root receipt

Owning sources: `tools/verify-gates/verify.mjs`、`contracts/policy/standards-enforcement-execution-catalog.json`、`scripts/check/standards-coverage`。先将 mode selection 建成可测试的纯数据集，再原子迁 catalog schema：17-ref exact set 不变，按 kind 生效的 command/marker rule 替代“一律 command 必填”。root 是唯一 15-child executor，先以 `crypto.randomUUID()` 生成本 invocation 唯一 `rootRunId`、以 no-replace policy 导出 receipt path，child receipt 由 root 在 dependency/exit/marker 全部检查后生成，再 atomic-write 成 root-owned immutable transport。selector 由独立 path 正好一次执行；U12 只能以该 path 与同一 `--expected-root-run-id` pure-read 两份 transport，不能重新 spawn 或信任 receipt 自报 identity。不可接受把 root 隐式 skip、放宽全集相等、用 child marker 冒充 root、独立 U12 re-run，或仅在 normal mode 过滤动态命令。

### THCL-02｜ACTIVE 执行 exact-set 与 orphan disposition

Owning sources: standards matrix、catalog、`scripts/check/standards-coverage`。先从 matrix 重算 17-ref 全集、15-child partition 与单一 selector，再验证 catalog 的 exact set/kind partition；不得由 child 集反推或缩窄 catalog。U12 将 receipt 的 rootRef/rootRunId/ref/sequence/dependency digest/exit/marker 与 caller-provided expected rootRunId 逐项绑定 exact-set，并拒绝同一 ref 的第二次 receipt、任意旧 receipt、或 path collision。orphan 清单逐项给出 wiring、retain 或 retirement；不存在调用方不是 retirement 理由。任何 proposed retirement 必须带连续五个 package 未触发证据，否则 retain 并说明预期拦截模式。

### THCL-03｜assertion-level 保真与假红删除

Owning sources: 58 feature、7 app、12 architecture test files及其 imports。先生成 ledger，再迁移真正的 value assertion，最后删除 ledger 标明的 text assertion。不能按 file import、旧 25/33 粗筛或当天红色文件替代判据。对于每个被删除的整文件，ledger 必须显示无 value/structural assertion；对于每个留下的 structural assertion，写明它的机械事实。

### THCL-04｜测试入口与自满足假绿

Owning sources: verify command table、app/foundation package scripts、module Gradle tasks、`r5-dev-environment.mjs`、seed plan、`backend-performance-final-acceptance.mjs`、new shared HMAC owner、196 verifier 及两侧 tests。Node 的 explicit list 同时是 discovery denominator，新增目录必须显式加入。shared owner 的 canonical bytes 必须与 existing final-acceptance 完全相同；HMAC 只在 `V2S_DB_OPERATIONS_HMAC_KEY` key boundary 重算，任何输出/receipt 不保留 secret。dry-run marker 只说 fixture contract cross-check，不能说 seed executed。

### THCL-05｜受管 runner 的失败可诊断性

Owning sources: remote Testcontainers workload/runner、managed DEV runner、joint L2 runner、fixture materializer/executor及其 tests。每个 wrapper 只追加 stage/run context，保留最深 child `firstFailure`；preflight、heartbeat、last-known-good、broken boundary 与 terminal state 必须可由同一 run manifest/readback 复证。当前单元只跑 static/focused proof，不运行受管入口。

### THCL-06｜fixture 迁移、退役与欠账

Owning sources: SQL merge coverage、joint fixture、legacy platform runner/fixture/tests、memory inventory、HANDOFF、README。迁移 checker 的 fixture source 和真实 red mutation是删除前置；source-absence只是随后验证。两个 memory 解释闭环的适用范围，HANDOFF 明确记录复杂 UI 与无 L2 面未被本包关闭。

## 5. 变更面与证据

| scope | disposition |
|---|---|
| `tools/verify-gates/verify.mjs`; catalog; `scripts/check/standards-coverage` and tests | update |
| explicit `scripts/**/*.test.mjs`, foundation package command, 8 Java module task mapping | retain tests / update entry |
| feature/app/A-layer source-text tests | ledger-derived update/delete; value tests create/update adjacent to module |
| `r5-dev-environment.mjs`, seed-plan marker, `backend-performance-final-acceptance.mjs`, new `backend-performance-evidence-hmac.mjs`, 196 contract/report and final-acceptance tests | update/create; retain one canonical HMAC implementation |
| `r5-remote-testcontainers*`, workload, `r5-dev-runner`, joint L2, fixture materializer/executor and their tests | update only after source re-open per family |
| SQL merge checker/test and joint fixture | update before delete |
| legacy platform L2 runner/fixture/tests | delete last |
| two project-memory entries, required inventory/index, verification-governance pointer, permitted matrix checklist text, HANDOFF/README | create/update/generated as declared |

Package evidence must include: ledger plus retained/deleted exact sets; root/child/selector receipts; orphan disposition; entry discovery/execution report; every red mutation; legacy source-absence; measured verify duration; changed-path/Pre/Post receipt list. Static results never use business/cleanup/performance/L2/Testcontainers PASS vocabulary.

## 6. Review schedule and authorization

1. Claude 独立 DESIGN review 对此前详设给出 `NO_GO (M=1,S=0,N=2)`：catalog kind/command 规则与 frozen matrix 全集冲突。Dexter 已授权本 `TEST_DELIVERY_PROCESS_REMEDIATION_DESIGN_CLAUDE_REMEDIATION_20260811` 新 cycle，仅核验按 kind 的 command rule 与 17-ref exact set、root UUID/no-replace policy、以及 `statementId ?? ""` canonical 明确化；该新 cycle 仍受 `REVIEW_ROUND_LIMIT=2` 约束，且作者 intake 不能把任何 NO-GO 变为 implementation authority。
2. After Dexter accepts the reviewed design, THCL-01→07 run once as a single implementation package. An M/S stops implementation rather than spawning an additional planned design round.
3. After package exit, exactly one fresh `REVIEW_TARGET=IMPLEMENTATION` review reopens real bytes, receipts and every changed path before Claude handoff.

The present document authorizes none of step 2/3, dynamic environments, schema/contract changes or Roadmap transitions.

## 7. Standards applicability

| Part | disposition | landing |
|---|---|---|
| B.1/B.2/B.3 | NOT_APPLICABLE | no business owner/transaction/persistence change |
| B.4 | APPLICABLE | true module tests and two-app runner boundaries (§3.2/THCL-03/04) |
| B.5 | APPLICABLE | HMAC, environment, remote-host/run ownership (§3.3/THCL-04/05) |
| B.6 | APPLICABLE | receipts, exact-set, first failure, red controls (§3.1/§5) |
| Part C/D | APPLICABLE | existing mechanical controls only; future dynamic evidence explicitly separate |
