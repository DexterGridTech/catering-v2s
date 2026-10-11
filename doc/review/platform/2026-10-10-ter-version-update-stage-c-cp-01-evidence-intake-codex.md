# TER 更新阶段 C CP-01 实施证据与复核输入

DATE=2026-10-10
CP=CP-01
AUTHOR_DISPOSITION=READY_FOR_FRESH_INDEPENDENT_RECONCILIATION
INDEPENDENT_RESULT=MATCHED
BROADER_DYNAMIC_ACCEPTANCE=NOT_RUN

本记录由主 agent 汇总 CP-01 当前实现与 focused proof，供 fresh 独立三维对账使用。它不是独立 reviewer verdict，不代替 CP-01 对账、整批 6b、Expo Web/DEV/Android 验收或交付前 13c。

## 前轮 OPEN 与主 agent 处置

Fresh reviewer `/root/stagec_cp01_reconcile` 此前结论为 `OPEN/PARTIAL`，指出缺少 CP-01 对账记录、真实 Runtime 并发接缝 proof、canonical/generated→TDC caller 闭环证据，并指出 store-basic 测试仍有 `terminalReadStoreOrganizationPath` 引用。

- 旧引用核验：`apps/terminal/kernel/feature/store-basic/test/storeBasic.test.ts:322-333` 的唯一命中是负向断言，要求 store initialization 不再请求组织路径；`apps/terminal/kernel/feature/store-basic` 无该旧操作的正向读、fixture handler 或 production caller。project-basic 当前确实拥有组织路径读取。该测试保留为 owner 边界的反例，不删除。
- Runtime proof：新增 `apps/terminal/kernel/feature/project-basic/test/projectBasicRuntime.test.ts:171-343`。它用真实 `createRuntime` 安装 store-basic、project-basic 两个真实模块与真实 dispatcher；TDC 读命令测试 actor 只作为 HTTP/协议适配 fixture。组织路径 read 被 deferred gate 确定性扣住；测试等待合同/服务点三类 follow-up read 并确认 selector 与持久化中 `contract-1`、`point-1` 已完成，随后断言组织读取仍未返回。测试使用独立 plain/protected storage fixture，记录 Runtime 启动失败细节和 journal。
- TDC/TDS/CBS 配对：TDS 缺失/非法 `deviceId` 的协议反例已加入 `TerminalConnectionFrameCodecTest`；CBS `BusinessCredential` 本身不含 device 字段，service 测试证明无设备输入核验，edge controller 测试证明实际调用 `verifyBusinessCredential`。
- Generated chain：canonical edge materialize、terminal client API 与 identity-only edge codegen 的 CP-01 检查均已在本批运行通过。正常 edge codegen 的预算投影因 `BUDGET_PROJECTION_OPERATION_MISSING: stagePlatformTerminalUpdateArtifact` 停止；详设/计划未把 CP-05 calibration 列为本批门，C 也不新增 operation identity。该默认预算门保持 `NOT_RUN/OPEN`，identity-only 输出不代表默认预算门通过。

## 当前字节的 focused 结果

| 执行面 | 命令/结果 | 证据与边界 |
| --- | --- | --- |
| Runtime owner handoff | `yarn workspace @catering-v2s/kernel-feature-project-basic test`：PROD，2 files、4 tests PASS | 包含上述真实 Runtime deferred-organization proof；只证明本地 Runtime/owner 接缝，不是 Expo Web 或业务环境验收 |
| Store owner | `yarn workspace @catering-v2s/kernel-feature-store-basic test`：PROD，1 file、21 tests PASS | 含“不向 store-basic 组织读取”负向断言 |
| CBS / TDS 调用客户端 | `yarn workspace @catering-v2s/kernel-base-terminal-data-client test`：PROD，8 files、60 tests PASS | 测试在只删除一个未使用 `RuntimeInstanceMode` type import 之前执行；该删除不改运行代码。修订后当前字节的 TDC lint/typecheck 均退出 0 |
| CBS 凭证服务 | `./gradlew :apps:backend:catering-business-server:modules:terminal-binding:test --tests '...TerminalCredentialDecisionTest' --tests '...TerminalCredentialVerificationServiceTest'`：13 tests、0 skipped/failures/errors | 本机模块不含 Testcontainers marker；JUnit XML 时间 2026-10-10T12:40:06Z。覆盖当前设备不匹配仍拒绝及无 device input 的 business credential 入口 |
| TDS protocol | `node scripts/test/r5-remote-testcontainers.mjs :apps:backend:terminal-data-server:test --tests '...TerminalConnectionFrameCodecTest'`：11 tests、0 skipped/failures/errors；run `r5-tc-1791636015327-40969`；2026-10-10T12:40:15Z–12:41:05Z；Testcontainers/卷/进程/workspace cleanup PASS | 真实受管远端 test task，仅 TDS codec 单类；验证正确协议字段与缺失/非法 deviceId 拒绝；不是 TDS/CBS 业务 acceptance |
| CBS edge controller | `node scripts/test/r5-remote-testcontainers.mjs :apps:backend:catering-business-server:test --tests 'com.catering.v2s.app.edge.terminal.TerminalDataReadControllerTest'`：1 test、0 skipped/failures/errors；run `r5-tc-1791636267019-45998`；2026-10-10T12:44:27Z–12:45:45Z；Testcontainers/卷/进程/workspace cleanup PASS | JUnit XML 实际执行 `mapsOwnerDatabaseFailureToTerminalDependencyUnavailable`；测试验证 controller 委托 `verifyBusinessCredential(BusinessCredential)`。business 为 `NOT_APPLICABLE`，不是受管业务场景 |
| TS typecheck | project-basic、store-basic、terminal-data-client 各自 owned `typecheck`：退出 0 | 当前字节；未运行全仓 typecheck |
| TS lint | project-basic、store-basic、terminal-data-client 各自 owned `lint`：最终均 PASS、errors=0、warnings=0 | 当前字节。首败及修复见下节 |
| canonical/codegen | `node scripts/generate/r5-edge-materialize.mjs --check` PASS；`node scripts/generate/terminal-client-api.mjs --check` PASS；`V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY node scripts/generate/edge-codegen.mjs --check` PASS（485 files） | 身份/生成物一致性检查；既存默认预算门保持 `NOT_RUN/OPEN`，本批不安排 CP-05 标定，绝不视为默认绿色基线 |

## 首败及根因修复

`./gradlew :apps:backend:terminal-data-server:test --tests '...TerminalConnectionFrameCodecTest'` 曾被本机受管门拒绝，标记 `V2S_TESTCONTAINERS_REMOTE_REQUIRED`。根因是该 Gradle `test` task 所属测试树含 PostgreSQL Testcontainers 集成测试，项目门刻意禁止本机 Docker 自动发现；没有设置环境变量绕过。主 agent 改走唯一正式入口 `scripts/test/r5-remote-testcontainers.mjs`，同一筛选测试随后 11/11 通过且资源 cleanup PASS。

TDC owned lint 首次报告 `terminalDataClientActor.ts:10` 的 `RuntimeInstanceMode` type import 未使用。全包搜索确认它在该文件没有类型引用；保留 `selectRuntimeInstanceMode` 的实际业务读取，仅删除无用 type import。CP-01 正式裁决确认 device role 的唯一业务读取仍为 selector。修复后同一包 lint PASS（14/14 files、0 error/0 warning）且 typecheck 退出 0。既有 60 项运行行为测试不因这一不发射的 type-only import 删除而重复；其字节差量明确限于 import 行。

预防去向：该通用模式是搬移/重构后遗留 type import；现有每个受影响包的 owned lint 会以 `@typescript-eslint/no-unused-vars` 明确变红，不增加专用脚本或另一套静态门。

## 新鲜 CP-01 对账 OPEN 与主 agent 差量核验

Fresh reviewer `/root/stagec_cp01_reconcile_final` 对先前字节给出 `OPEN`。主 agent 逐项重开需求、CP-01 详设/计划、项目记忆、package/graph/module/actor/tests 后，判定如下：

| finding | intake | 根因与最小修复 | 当前字节 proof |
| --- | --- | --- | --- |
| package graph / selector registry 未闭合 | `CONFIRMED` | project-basic 实际读取 topology 与 server-config，但 package graph、terminal skeleton graph 及公开 selector 注册有缺口；补 workspace 依赖、skeleton graph 节点及三个已导出 selector 的 registry 定义，未移除公开能力。 | project-basic `test`、`typecheck`、`lint`；terminal skeleton focused static/model gates |
| topic accept 只检查 dispatch 完成 | `CONFIRMED` | dispatch 成功不表示 child accept 已接受；改为检查 child 结果，只把 `accepted`/`accepted-locally` 视作成功，其余写入可观察失败并返回失败。 | 新增非 accepted child-result 反例；project-basic `test` |
| snapshot 变化耗尽后没有失败状态 | `CONFIRMED` | 三次已有尝试耗尽后，旧路径只返回失败而留下 loading/旧状态；在不加重试的前提下写入 `SNAPSHOT_COLLECTION_CHANGED` 和 topic failed。 | 新增三次变化耗尽反例；project-basic `test` |
| 默认 edge-codegen 预算门无 CP-05 关闭步骤 | `PARTIALLY_CONFIRMED` | 默认模式已知在 `BUDGET_PROJECTION_OPERATION_MISSING:stagePlatformTerminalUpdateArtifact` 停止，不能声称通过；“应安排 CP-05 标定”的建议不符合当前本批计划范围。详设、计划及本文现明确不安排 calibration，identity-only 只证明身份/生成字节，默认预算门继续 `NOT_RUN/OPEN`。 | 未重跑默认模式；既有默认失败保留其原证据边界。identity-only PASS 不替代默认模式 |

上述代码修复后，当前字节执行：

- `yarn workspace @catering-v2s/kernel-feature-project-basic test`：2 files、7 tests PASS。
- `yarn workspace @catering-v2s/kernel-feature-project-basic typecheck`：退出码 0。
- `yarn workspace @catering-v2s/kernel-feature-project-basic lint`：9 files、0 errors、0 warnings。
- `node tools/terminal-skeleton/check-static.mjs`：11 个规则门 PASS，含 `RULE_TR01_REDUCER_BOUNDARY`；
- `node tools/terminal-skeleton/check-static.test.mjs`：`TERMINAL_SKELETON_MODEL_TEST=PASS`，包括未登记 reducer dispatch 反例；
- 完整扫描 30 个 `apps/terminal/**/src/features/actors` 源文件后，仅为 TDC `reconcileCredentialReadiness` 的两处既有 reducer 归一化 dispatch 增加精确 TR-01 例外；terminal-update 的既有例外也按实际 AST 调用点补齐。未更改这些 actor 的业务逻辑。

## 差量范围与当前门状态

- CP-01 的四项 OPEN 已由主 agent逐项定位和修复；上表命令只证明当前字节的 focused source/static 结果，不预先宣称独立 CP-01 `MATCHED`。
- `node scripts/generate/edge-codegen.mjs --check` 默认预算模式仍是明确既存失败，本文不重复运行、不伪报通过；详设 §12 OPEN-GLOBAL-BUDGET 与计划 CP-01 已明确本批处置边界。
- 动态诊断链 R1/R2 对抗评审通过只覆盖日志、诊断和执行入口源码，不等于 CP-01 对账或任何 Expo Web/DEV/Android 场景证据。
- 下一步是 fresh 独立 reviewer 对完整 CP-01 做需求、详设/计划、项目记忆三维复核；只有其结论 `MATCHED` 才进入后续 CP。

## 阶段边界与未闭合项

- `node scripts/generate/edge-codegen.mjs --check` 默认模式的预算投影失败 `BUDGET_PROJECTION_OPERATION_MISSING: stagePlatformTerminalUpdateArtifact` 仍未关闭；此前“按详设延至 CP-05 标定”的记录不准确，现已由详设/计划明确更正：本批不安排该既存默认预算门/calibration，保持 `NOT_RUN/OPEN`。`IDENTITY_ONLY` check 仅证明生成身份/字节一致，不可作为默认预算 PASS。
- 全部功能调用者/消费者仍由 fresh CP-01 reviewer 逐项核对；作者记录不提前宣称三维 MATCHED。
- 本记录未开始 Expo Web、DEV、Android、配对或后台供给链动态业务验收；尚无 CP-01 独立 MATCHED，也未完成全批 6b。
- 动态前诊断链两轮审查已完成，详见 `2026-10-10-ter-version-update-stage-c-pre-dynamic-diagnostics-intake-codex.md`；其 GO 仅覆盖诊断链，不豁免 CP/6b。

## 状态

当前字节上的最新运行：`node tools/terminal-skeleton/check-static.test.mjs`，本轮最终源码/门运行 `TERMINAL_SKELETON_MODEL_TEST=PASS`；该本地机械/model 检查没有受管 run ID，不证明业务运行或 cleanup。最新 package-focused `project-basic test` 为 2 files、7 tests PASS，`typecheck` 退出码 0，`lint` 为 9 files、0 errors、0 warnings。

最后一次受管远端通过：`r5-tc-1791636267019-45998`，2026-10-10T12:44:27Z–12:45:45Z，CBS edge controller 单类 JUnit 1/1 PASS，runner/远端进程/临时 workspace/Testcontainers container 与 volume cleanup 全 PASS，business=NOT_APPLICABLE。之后 project-basic、skeleton graph 和 terminal invariant 字节有更新，因此该旧 run 不与当前完整工作区字节一致；本次没有重跑受管后台任务，也没有 Stage C 动态业务运行。

## 2026-10-11 fresh reconciliation 输入后的差量 disposition

本节只记录主 agent 对 fresh reviewer 提出的 CP-01 OPEN 的再次核验及本轮当前字节证据，不替代待完成的 fresh 独立三维对账，也不修改先前 verdict 的字节边界。

| finding | disposition | 当前字节核验与最小处置 | 受影响证据 |
| --- | --- | --- | --- |
| package graph / selector registry | `PARTIALLY_CONFIRMED` | reviewer 的整体判断过宽：project-basic 的 workspace 依赖、模块注册和其余公开 selector 已存在；同根对照发现 `kernel.base.terminal-data-client` package 已真实依赖 topology，而 `apps/terminal/skeleton-graph.ts` 漏列该边；另有已导出的 `selectProjectTerminalUpdateContextFacts` 未登记在 project-basic `publicExports`。补齐 skeleton graph 边、selector invariant 登记，并把全部 10 个导出 selector 纳入模块注册测试。没有删减 API 或扩大运行时依赖。 | project-basic test 2 files/8 tests PASS；typecheck exit 0；lint 9 files、0 errors/warnings；`node tools/terminal-skeleton/check-static.mjs` 11/11 gates PASS；`node tools/terminal-skeleton/check-static.test.mjs` exit 0、`TERMINAL_SKELETON_MODEL_TEST=PASS`。 |
| topic accept 只检查 dispatch 完成 | `REJECTED_WITH_EVIDENCE` | 当前 actor 已核对 child outcome，仅 accepted/accepted-locally 算成功；测试把 `stale-notification` child outcome 作为反例，断言返回 `accept-failed` 且 topic 状态失败。此 gap 在 reviewer 本轮输入之前已关闭，当前字节未复现。 | `apps/terminal/kernel/feature/project-basic/src/features/actors/actors.ts`；`test/projectBasic.test.ts` 的 “does not report a refreshed topic when the notification child result was not accepted”；上述 project-basic tests PASS。 |
| snapshot 变化耗尽后没有失败状态 | `REJECTED_WITH_EVIDENCE` | 当前刷新路径在三次集合变化后写入 `SNAPSHOT_COLLECTION_CHANGED` 的规则与 topic failed 状态，并不保留 ready/candidate 假成功；直接测试断言三次 read、两个失败 selector 和空候选。当前字节未复现。 | 同上 actor；`test/projectBasic.test.ts` 的 “exposes exhausted snapshot-change retries as a failed rule state and topic”；上述 project-basic tests PASS。 |
| 默认 edge-codegen 预算门无 CP-05 处置 | `REJECTED_WITH_EVIDENCE` | 当前详设 §12/OPEN-GLOBAL-BUDGET 与计划 §3/CP-06 明确：本批不新增 operation identity、不安排 CP-05 calibration；`IDENTITY_ONLY --check` 只证明 identity/生成字节，默认预算门仍 `NOT_RUN/OPEN`。建议要求将 calibration 塞入 CP-05 与已批准计划相反。未重跑默认预算门，也未将 identity-only 冒充预算通过。 | 详设 `OPEN-GLOBAL-BUDGET`；计划 CP-01 生成/预算边界及 CP-06 第3项。 |

额外根因修正：当前 package manifest 与 skeleton graph 的 terminal-data-client→topology 依赖不一致，已补齐图边；terminal-data-client 的 topology 调用是本阶段已批准的 TDC↔Topology A/B unpair command 接缝，不移动到 integration。project-basic invariant 中 `writeRuleSnapshot` 的四条失效 TR-01 例外已移除，现存 actor action 归一化仅保留精确到函数与 dispatch 表达式的条目。修正后 terminal skeleton 静态门 `RULE_GATES=11`、全部 11 项 PASS，`RULE_GRAPH_COMPARISON=PASS`、`RULE_TR01_REDUCER_BOUNDARY=PASS`。

本轮 red-control 输出中的 `...RED_...=FAIL` 是被测机械门在故意破坏 fixture 下按预期返回 FAIL；脚本最终断言全部成立并以 `TERMINAL_SKELETON_MODEL_TEST=PASS`、进程退出码 0 收口，不是脚本自身失败。该检查约耗时数分钟，属于 fixture 驱动的重复模型运行；未将其推广成全仓 verify。

**独立 CP-01 verdict 已取得：**fresh reviewer `/root/stagec_cp01_reconcile_fresh2` 对完整 CP-01 逐需求、详设/计划及项目规范三维复核，结论 `MATCHED`。Reviewer核实 selector registry、project-basic public exports/invariants、TDC→topology skeleton graph、child topic accept outcome、snapshot-change failure state、CBS/TDS 凭证分流及 generated caller chain；作者处置记录与其当前字节结论一致。Reviewer 未运行测试、lint/typecheck、codegen 或动态环境，只读取了本记录所列真实 proof 输出。CP-01 可以退出；其结论不代替全批 6b、动态验收或 13c。

Reviewer input checklist：已读 `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`、全部 project-memory kernel、`deterministic-context-only.md` 及六维命中原文；Stage C 正式需求、详设、计划、source/API appendix、IA、review/terminal coding standards；project-basic/store-basic/TDC/terminal-update、CBS terminal-binding/edge、TDS codec 当前源码与相关 focused tests；canonical/materialize/codegen/generation sources、invariants 与 skeleton graph。先独立形成 verdict，再读取本记录比对作者 disposition。其未执行项为所有测试/类型/lint/codegen/受管 DEV/Testcontainers/Expo/Android。

默认 edge-codegen budget gate 仍 `NOT_RUN/OPEN`；Expo Web、DEV、Android、双机和业务/cleanup 仍 `NOT_RUN`。当前字节上的最新运行：`node tools/terminal-skeleton/check-static.test.mjs`，exit 0、`TERMINAL_SKELETON_MODEL_TEST=PASS`。最后一次受管远端通过仍为 `r5-tc-1791636267019-45998`，其适用范围/哈希边界如上，**不与当前全部字节一致**。

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787
