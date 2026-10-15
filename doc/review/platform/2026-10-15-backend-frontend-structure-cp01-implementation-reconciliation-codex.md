# 前后台结构优化 CP-01 实施与对账记录

## 范围与状态

- CP：01，协议单源与保护基线。
- 当前状态：早期 CP-01 曾获 `MATCHED`，其后 generator 差量被 fresh review 指出问题。零输出目标假绿已修复并由直接 red test 关闭；较早修复复核审查顺序不合规，不作为当前 verdict。fresh blind reviewer 发现 parser focused proof 缺少 POINTER `cancel` 携带合法 `u/v` 的正例；主 agent 补入该正例并运行 parser focused test 3/3 通过。新的完整 fresh CP-01 三维复核 `/root/cp01_review_after_test` 最终判定 `MATCHED`。DEV/Web/Android/UAT 未运行。
- 判据：正式需求 R-01～R-04、R-07；详设 §3、§4、§8.1；计划 CP-01；源码与验证附件 §1、§2、§6。
- 未改变业务协议值、公开入口、授权、绑定 scope、SQL 路由、事务或数据持久化语义。

## 主 agent 逐点双读记录

本节为主 agent 实施记录，不替代 reviewer 独立判断。实施前已重开正式需求、详设、计划、附件、终端协议正本、remote-control 协议正本、当前 generator/outputPaths、TDS Protocol/Codec、operations-admin parser/workspace、scope/grant/事务路径及直接测试；按六维记忆路由读取了适用 kernel 和命中原文。focused proof 后重新读取同组判据与最终源码，确认修改仍处于 CP-01 范围。此记录整理于实施后，不伪造逐点时间戳或独立 review verdict。

| 变更点 | 写前重开的 owning source 与判据 | focused proof 后读回 | 当前结论 |
|---|---|---|---|
| TDS topic allow-list | R-01～R-04/R-07；D §8.1；P CP-01；`contracts/protocol/terminal-connection-protocol.json` 的 `topicKeys`；`TerminalConnectionProtocol`、`TerminalConnectionFrameCodec`、绑定 scope/SQL 分类消费者及其测试 | `TerminalConnectionProtocol` 由 `readUniqueTextArray` 读取 canonical topic 集，非空且 `Set.copyOf` 不可变；Codec 的 `topicKey` 使用同一 `protocol.topicKeys()`；绑定资格及 repository 分类源码未修改 | 手写 Codec topic 集已移除；合法 key 正本仍为 canonical；未将 schema 合法性扩成绑定授权 |
| 远控 enum 生成与 Web parser | R-04；D §8.1；P CP-01；当前 `terminal-remote-control-protocol.json`、generator 的 `outputPaths`/`renderContract`、两个消费者 generated 文件、workspace parser 与测试 | generator 对每个 message body enum 字段派生 readonly runtime array 和对应 TS union；两个现有输出由同一 renderer 生成；workspace 从 operations-admin generated API 导入六组 enum；parser 保留 reason null、必填/shape/UUID/seq/bytes/坐标判据；`POINTER cancel` 缺省双坐标与携带合法 `u/v` 均有正例，非 cancel 缺省坐标仍拒绝 | 未新增 registry、第二 generator、TER hand-coded consumer 或协议 enum 值 |

### 当前字节 hash

| 文件 | SHA-256 |
|---|---|
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/protocol/TerminalConnectionProtocol.java` | `bc956e059f8652c6b26f863e5c7c8a99f824189cadc901588ee5e903dd150667` |
| `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/protocol/TerminalConnectionFrameCodec.java` | `e20bc0556b2eb64f841534836a297ec57e54c75c35c2ce959e38cea76ec46d4b` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/protocol/TerminalConnectionProtocolTest.java` | `b528ec8493d273b1e04c4ef5c3af53c0f3464ecab94825014922e9ab8083bd61` |
| `apps/backend/terminal-data-server/src/test/java/com/catering/v2s/terminaldataserver/protocol/TerminalConnectionFrameCodecTest.java` | `c91f79f93889e0b529b9beb9e031d824c3b657eb68baf094c20db254f38cdefb` |
| `scripts/generate/terminal-remote-control-protocol.mjs` | `2141eb0e7f6471dbb3983e067c03dc23236286aa11c7793484758aa2bb38e720` |
| `apps/terminal/kernel/base/remote-control/src/generated/terminalRemoteControlProtocol.ts` | `cbf928106a8b0302247840c202a526b5e4b327733ad437fcfbe49ba06944e1bc` |
| `apps/frontend/operations-admin/src/app/api/generated/terminalRemoteControlProtocol.ts` | `cbf928106a8b0302247840c202a526b5e4b327733ad437fcfbe49ba06944e1bc` |
| `apps/frontend/operations-admin/src/features/remote-control/model/parseRemoteControlMessage.ts` | `62bf996815c059410ffad30be14c093fc80b66206891cf1e0a5a87df07fa37f2` |
| `apps/frontend/operations-admin/src/features/remote-control/model/parseRemoteControlMessage.test.ts` | `d6b0a16662e5ef41ad8432ad5c5753bc591d42a7d2ffbbdecaf1481fd46b09ac` |
| `apps/frontend/operations-admin/src/features/remote-control/ui/RemoteControlWorkspace.tsx` | `0cfa72725c40e8c9c62be86cd8a165bcd30b46b8810d91cd2270baa6d6ef6d45` |

## focused proof

| 范围 | 执行 | 结果及适用边界 |
|---|---|---|
| remote protocol generation | `node scripts/generate/terminal-remote-control-protocol.mjs --write` | 退出码 0；写出当前两个 outputPaths。生成过程未手改 generated 文件。 |
| generated drift | `node scripts/generate/terminal-remote-control-protocol.mjs --check` | 退出码 0；两个当前目标与同一 renderer 一致。 |
| generator self-test | `node --test scripts/test/terminal-remote-control-protocol.test.mjs` | 退出码 0，1/1 test pass。 |
| operations-admin parser | `yarn workspace @catering-v2s/operations-admin vitest run src/features/remote-control/model/parseRemoteControlMessage.test.ts` | 退出码 0，3 tests pass；覆盖六个 enum 字段的合法成员、未知/非字符串拒绝、nullable reason、`cancel` 缺省双坐标与携带合法 `u=0.25/v=0.75` 的通过，以及非 `cancel` 缺少坐标的拒绝。主 agent 针对 fresh reviewer 指出的遗漏补入坐标正例后，重跑该 focused 命令，仍为 3/3 pass。 |
| operations-admin types | `yarn workspace @catering-v2s/operations-admin typecheck` | 退出码 0。 |
| TDS Java protocol tests | 受管命令：`V2S_RUNTIME_DIR=.runtime/r5 node scripts/test/r5-remote-testcontainers.mjs :apps:backend:terminal-data-server:test --tests com.catering.v2s.terminaldataserver.protocol.TerminalConnectionProtocolTest --tests com.catering.v2s.terminaldataserver.protocol.TerminalConnectionFrameCodecTest` | run `r5-tc-1792030917661-16779`，Gradle `BUILD SUCCESSFUL`；保留的 JUnit XML 位于 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1792030917661-16779/test-results/apps/backend/terminal-data-server/build/test-results/test/`：`TerminalConnectionProtocolTest` 5 tests、`TerminalConnectionFrameCodecTest` 11 tests，均 failures/errors/skipped 为 0。manifest `testExecution=PASS`、Testcontainers before/after query PASS、owned containers/volumes 为 NONE、runner cleanup PASS。未启动或恢复 DEV。 |
| Generator 当前字节 proof | `node scripts/generate/terminal-remote-control-protocol.mjs --check`；`node --test scripts/test/terminal-remote-control-protocol.test.mjs` | 当前字节退出码均为 0；generated drift `TERMINAL_REMOTE_PROTOCOL_CHECK=PASS FILES=2`；Node 1/1 pass。 |
| configured output count closure | 在 `outputPaths` 临时增加第三个仓内生成目标后运行 `node scripts/generate/terminal-remote-control-protocol.mjs --self-test`，随后恢复源文件 | 退出码 0，`CONFIGURED_OUTPUTS=PASS`；自测把同一 renderer 结果写到每个配置目标并逐个比较。临时目标仅位于 self-test 的 tempRoot，finally 已清除；两个正式目标未改变。 |
| 空输出目标 `--check` 红例 | Node 测试复制脚本与 canonical 到仓内 `.runtime` 自包含临时根，删除临时副本中的所有 outputPaths 后执行真实 `--check` | 退出非零，输出 `TERMINAL_REMOTE_PROTOCOL_OUTPUT_PATHS_EMPTY`，不出现 PASS；finally 删除临时根。 |

首次 focused 运行因移除 Codec `Set` import 后仍有既有 `Set` 用法、以及 workspace 提取 parser 时遗漏保留 `remoteControlProtocolMaxMessageBytes` 导入而失败。已恢复这两个现有依赖后，Node、parser tests、typecheck 均通过。该次首败是 CP-01 内修复的编译遗漏，未改变业务语义。Gradle 守门失败是独立执行边界；未重复同一失败命令。

## 未运行与边界

- TDS 其余 Java tests 与真实 PostgreSQL/业务数据库测试：未运行；本次只执行以上两个计划指定的 protocol test 类。
- TDS 真实 PostgreSQL/业务数据库测试、DEV、Web、Android、UAT：本 CP 未运行。
- 源码证明 topic parser 使用 canonical 集合；现有 codec tests 保留 STORE 与 TERMINAL_UPDATE_RULES 合法样例及 FUTURE_TOPIC 拒绝。SQL binding scope 与 topic 到 repository 分类的测试/源码未修改。本记录不把测试源码或编译结果升级为数据库/DEV 行为证明。

## 独立 CP 对账

- reviewer：fresh 只读子 agent `/root/cp01_reconcile_readonly`；先形成未读作者 review 材料的初始判定，再读取作者材料作差异核对；未运行测试或命令。
- CP-01 三维对账结果：`MATCHED`。Reviewer 逐项重开正式需求、详设/计划、规范、canonical、owner 与消费者源码；确认 12 项 topic loader + Codec 同集合校验、现有 binding/SQL scope 保持独立、六个 enum 双目标同 renderer、OPS parser 的合法 nullable/cancel 语义及可运行 focused proof 记录符合 CP-01。缺少逐 topic Codec round-trip 不构成 OPEN：计划要求 canonical 集合加载、共享校验、正例与 typed unknown 拒绝，没有逐枚举 round-trip 判据。
- 原 fresh CP-01 reviewer 对受管 Java run 的 source-to-run 字节追踪提出 OPEN。manifest 记录 run ID、命令、`sourceSync=PASS`、JUnit 与 cleanup；runner 源码显示它把本地仓库打包上传至同一 remote staging workspace 再执行 Gradle，但 manifest 没有源码树 digest。因此现证据证明上传/执行/cleanup 链与测试 XML，不证明 manifest 可密码学比对当前源码 SHA。当前本地 SHA 与 mtime 仅是本地读取记录，不能写成“与运行记录 SHA 一致”；不新增计划外通用 hash 门。
- 首轮 fresh 差量 reviewer `/root/cp01_fresh_delta` 判 `OPEN`：发现自测把 `outputPaths.length` 写死为 2，并指出上述 manifest 边界表述应收窄。主 agent 已删除精确数量约束，改为要求配置非空且每一配置输出均与 renderer 结果一致；self-test 和 Node test 断言统一使用 `CONFIGURED_OUTPUTS`。当前 `--check`、`--self-test`、Node 1/1 均通过；另在临时增加第三配置目标时 self-test 通过，临时目标随 self-test tempRoot 清除。新的 fresh CP-01 差量复核仍待完成。
- 后续 reviewer `/root/cp01_fresh_afterfix` 先读取作者对账记录再核查源码，已披露审查顺序偏差，故其意见仅作 finding 输入、不算当前独立 verdict。其零输出目标发现经主 agent 复核为真：原非空检查只位于 self-test，`run('--check')` 在零配置目标时会循环零次并报告 `FILES=0`。已新增共用 `requireOutputPaths`，使 self-test 与实际 write/check 入口都拒绝空目标；直接 `--check` 红例及 generator Node 2/2、生产 `--check`、`--self-test` 均通过。generator 当前 SHA 为 `2141eb0e7f6471dbb3983e067c03dc23236286aa11c7793484758aa2bb38e720`，test SHA 为 `3b031fa8d6600f6ad70565d79512794e94f1f7029580e898710e667afac2aa16`。
- `PARTIALLY_CONFIRMED / CLOSED_WITH_EXISTING_RUN_OUTPUT`：CP-01 自身的 TDS Java protocol run 未归档 classpath 文件。计划要求的实际受管依赖解析报告可由同批 run `r5-tc-1792015371644-84064` 的 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1792015371644-84064/backend-runtime-classpaths.txt` 补读；包含 `businessTestRuntimeClasspath`、`tdsRuntimeClasspath` 与 `tdsTestRuntimeClasspath`，显示实际 CBS Spring 模块版本 `7.0.8`。该报告随受管 run manifest 保存，run/sourceSync/cleanup 均 PASS。Gradle依赖声明没有被本批改动；复用此解析报告，不重跑 Java 测试、不声称 CP-01 run manifest 绑定源码 digest。
- 最新 fresh 独立 reviewer `/root/cp01_review_after_test` 先盲审需求/详设/计划/附件/命中规范与 owning source，再读取本记录及指定证据；最终 CP-01 三维对账为 `MATCHED`。其核对包括当时输入的十项源码 SHA、直接测试 hash、TDS Java JUnit XML 与 classpath 报告；reviewer 读取的作者记录 SHA-256 为 `64fdd581fc435478d8e989cb0e894df3cba3cf999108649c4e8befecdf19d7da`，之后主 agent 只追加独立 verdict 和审查结果。审查确认 generator self-test 对 canonical 六个 enum 字段分别做合法值变异并核双输出，parser 直接测试消费生成数组；这两段证明闭合了 producer/consumer 判据，无需新增临时协议端到端框架。parser 合法 `cancel u=0.25/v=0.75` 正例和其他坐标规则通过当前 source/test 对账。reviewer 未写文件、未运行命令或测试。
- CP-02、CP-03 已有各自历史 `MATCHED`；CP-04/CP-05 的本轮差量复核未闭合，CP-06 差量已有独立 `MATCHED`。全批 6b、DEV 动态、13c 与整批 IMPLEMENTATION review 尚未完成。

## 全批 6b 差量处置：canonical topic codec 行为证明

- 主 agent disposition：`CONFIRMED`（证明缺口；未确认生产 codec 有 topic 闭集回归）。详设 §8.1/V-02 要求 canonical topic 集共享校验，附件 §2 与 §3 明确逐个 canonical topic 经 subscribe/unsubscribe/accept/changed，unknown 仍 typed 拒绝。
- 修复前实际测试只以 `STORE`、`TERMINAL_UPDATE_RULES` 为合法样例，未覆盖 `TOPIC_UNSUBSCRIBE`；unknown 只在 subscribe 路径证明。生产 `TerminalConnectionFrameCodec` 已统一调用 `protocol.topicKeys()`，因此这是已批准判据的 proof gap，不是静态证实的生产行为错误。
- 最小修正：仅扩展现有 `TerminalConnectionFrameCodecTest`，从生产加载的 `protocol.topicKeys()` 遍历四种 codec 操作，并在同四个操作拒绝 `FUTURE_TOPIC`；没有另建允许列表或测试框架。
- 当前 focused 证据：受管远端 Testcontainers run `r5-tc-1792036812402-74189` 执行 `TerminalConnectionFrameCodecTest`，JUnit 13 tests、0 failures/errors/skipped；manifest `sourceSync=PASS`、`testExecution=PASS`、container/volume before/after queries PASS、runner cleanup PASS、owned containers/volumes NONE。`business=NOT_APPLICABLE`；此结果仅证明该定向 codec 测试和 run cleanup，不证明 DEV 或业务 acceptance。
- 修复后 CP-01 当前源码及本差量仍待 fresh 独立 CP-01 reviewer 复核；本段不是独立 verdict。较早“缺少逐 topic round-trip 不构成 OPEN”的判断仅描述其当时的作者对账结论，本次按附件中更具体的场景判据补齐，不伪造历史记录。
- 当前文件 hash：`TerminalConnectionFrameCodecTest.java` SHA-256=`c91f79f93889e0b529b9beb9e031d824c3b657eb68baf094c20db254f38cdefb`；此处内容对应上列受管 run 实际上传并执行的测试输入，runner manifest 记录 `sourceSync=PASS`，不提供整树 cryptographic digest。

### 全批 6b 差量的 CP-01 fresh 复核

- fresh 独立 reviewer `/root/cp01_delta_reconcile` 在主 agent 补充 V-02 codec 矩阵后重新完整复核 CP-01，结论 `MATCHED`，无新增 finding；只读，未运行测试/构建/DEV/UAT。
- reviewer 先读入口、kernel/适用记忆、R-01～R-04/R-07、D §3/4/8.1、P CP-01、附件及 canonical，再检查当前 Protocol/Codec、session/repository、generator、generated outputs、Web parser/消费者与直接测试，最后读取本记录和指定运行归档。
- 独立核实 12 个 canonical topic 均由同一生产集合逐一覆盖 subscribe、unsubscribe、accept、changed；合法帧真实解析/序列化，未知 topic 四路径均拒绝。权限与 SQL owner scope 保持独立。受管 XML 为 13 tests，0 failures/errors/skipped；cleanup 及 sourceSync 记录符合既有边界，且未把 sourceSync 写成当前源码树 digest。
- 本 CP 差量现为 `MATCHED`；此 verdict 仅关闭 CP-01，不代表全批 6b、动态或整批交付通过。
