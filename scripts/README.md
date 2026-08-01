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

每个 checker 的 `--self-test` 运行其 clean/red controls。R1 聚合：

```bash
scripts/check/baseline-closure --pre-transfer
scripts/check/baseline-closure --final
```

`--pre-transfer` 只证明 implementation 与 prepared transfer 输入就绪；`--final` 还必须看到 Registry-last owner、immutable receipt 与 post-transfer closure。两者均不授权后继步骤。

初始 baseline aggregate 的 exact path allowlist 只裁决 immutable R1 baseline。R2 或后续步骤产生新路径后，不得把 `baseline-closure --final` 对当前 worktree 的预期失败误报为 R1 历史 evidence 失效；当前步骤必须验证 immutable R1 hash 链、`roadmap-control-plane-transfer` 与本步骤自己的 denominator。

## Standards coverage

```bash
scripts/check/standards-coverage --phase R2
scripts/check/standards-coverage --self-test
```

以上命令是 R2 closure 的已接受 baseline。任何后继 design、implementation、review 或 testing 会话必须按 Roadmap 的 `CURRENT_STEP` 传入 phase；进入 R3/R4 closure 时，到期仍未接线即 FAIL。

`contracts/policy/standards-coverage-matrix.json` 精确覆盖冻结 manifest Part B-D 的 150 个结构单元。R2 允许尚未到期的 `PLANNED`；active gate/fixture 引用必须真实存在，机器不能判定的规则必须绑定矩阵内 review checklist。

## R4 verification

`scripts/verify` is the sole R4 aggregate entry. It runs phase-R4 standards coverage, each production validator, the native Gradle suite, and the disposable Testcontainers PostgreSQL proof. It derives the active Docker context only for that test process, does not start DEV, seed, or reset, and fails if Testcontainers resources remain after the suite. Business output is deliberately `NOT_APPLICABLE_R4_TECHNICAL_STEP`; cleanup is reported separately. Every R4 validator has a scratch-copy `--self-test` mutation using the same production path.

## R5 remote Testcontainers

When the local host has no Docker daemon, execute focused R5 Testcontainers from the remote development host with the JVM and Docker daemon on the same network plane:

```bash
scripts/test/r5-remote-testcontainers.mjs :apps:backend:catering-business-server:modules:asset:test
```

The entry creates a per-run temporary source and Gradle snapshot on that host, reuses only a fixed remote dependency cache, returns the test report under `.runtime/r5/evidence/remote-testcontainers/`, compares Testcontainers resources before and after the run, and deletes its exact temporary directory. It neither starts DEV nor uses the DEV database as a Testcontainers substitute.

## 环境执行矩阵

- **DEV**：本机启动 Spring Boot、`platform-admin` 与 `operations-admin` Web；只经受管 tunnel 使用远端非生产 PostgreSQL、对象存储等中间件。start/restart 可 additive Flyway，绝不 seed。
- **当前受管浏览器 L2**：同样在本机启动 Spring Boot、两个 Web 和 Playwright；远端只承载每 run 隔离的中间件命名空间。runner 必须保留本机 PID/日志、tunnel identity、远端数据库/资产 namespace readback，并分别证明业务结果与两侧 cleanup。
- **后续 UAT**：仅在 Dexter 单独授权后，应用与浏览器执行面均部署并运行在远端；本机 runtime、DEV 数据库或静态检查不能替代 UAT。

远端 Testcontainers 保持其 JVM/Docker 同平面的技术验证边界，不能被解释为上述浏览器 L2 或 UAT。

## 验证工作的通用规则

R3–R6 及后续步骤遵循 `doc/decisions/2026-07-24-v2s-verification-governance.md`：机器门只处理可机械判定的事实，且必须驱动 production 并以真实 red mutation 证明会失败；业务语义留给 fresh 独立对抗审查和 Claude review，不做关键词式伪语义 checker。新门须同时满足“反复发生、纯机械、维护成本低于未来返工”三问；交付超过半小时审阅量先切小，`scripts/verify` 保持分钟级，变慢先砍最弱门。

## 对抗式 review

自下一个 review cycle 起，每次 design/implementation 交付前必须由 fresh 独立子 agent 先作对抗盲审，从业务用户与 Dexter 立场以“找出它为什么不成立”为目标形成 findings 与 verdict；作者只在此后写辩证 intake。从设计使用 `REVIEW_TARGET=DESIGN`；实现代码完成后必须重新使用 `REVIEW_TARGET=IMPLEMENTATION`，回读实际生产源码、可执行 evidence 与真实用户行为，不能用设计审查替代。独立子 agent prompt 必须逐项列出 `doc/review/platform/independent-subagent-adversarial-review-input-checklist-template.md` 的最小输入。运行：

```bash
scripts/check/codex-self-review --file <repository-relative-self-review.md>
scripts/check/codex-self-review --self-test
```

production gate 会拒绝缺少上述必要内容的 reviewer verdict 或作者 intake，closure-only red fixture 证明“只验代码/报告完整”不能通过，blind-finding-acceptance red fixture 证明“因为 reviewer 说了所以全盘接受”也不能通过。Claude 独立 review 继续遵守同一质量底线，但不能替代独立子 agent 审查。规则 owner 为 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`。

Implementation-facing design handoff 还必须运行：

```bash
scripts/check/implementation-design-granularity --manifest <manifest.json> --review <adversarial-review.json>
scripts/check/implementation-design-granularity --self-test
```

production validator 复算 design/authorization/reviewer/source/checker hash，要求唯一 source/design anchor，逐 delivery unit 检查 path、ordered/serial boundary、data/UI applicability、L1/L2/L3/business/cleanup、forbidden pseudo-fix 与 discriminator，并双向核对 review finding↔unit verdict、severity count 和最多两轮。对声明独立盲审 policy 的新 cycle，它只机械验证 `reviewerKind`、输入清单 path+hash、盲审声明和清单文件存在；不判断清单语义。self-test 的 design-hash drift、missing business evidence、severity-count mismatch、round-three、missing finding-unit link、错误 reviewerKind 与缺失输入清单必须真红。
第二轮 hard stop 后若作者按 finding 修复 manifest，禁止回填历史 review hash；可按
`2026-07-26-v2s-post-remediation-review-binding-governance.md` 声明
`postRemediationDeclaration`。checker 只验 review/intake path+hash 与诚实字段，并输出
`DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`；这不表示 current bytes 已被子 agent review，
也不产生实施授权。self-test 另含无声明漂移与缺 intake 两个真红。

收到任何 reviewer finding 后，Codex 不得全盘接受或直接拒绝：逐条重开 owning source/代码/evidence，对外部漂移事实查官方一手资料或做可复现实验，主动寻找反例与适用条件，并写明 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`。只有已确认部分能驱动修订；修复还要与更小方案比较，避免审查诱发过度设计，信息不全不得武断扩范围。

同一 `REVIEW_CYCLE_ID + REVIEW_TARGET + 批准范围` 的独立子 agent 对抗审查最多两轮。每轮声明 `REVIEW_ROUND=1|2`、固定 `REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、输入清单 path+hash 与盲审声明；第二轮声明 `ROUND_FINAL_DECISION=SELF_DECIDED` 后由作者基于独立 finding 的处置证据收口，不得继续召集第三轮。换 reviewer/模型/文件/hash/措辞或局部修订不重置；只有 DESIGN→IMPLEMENTATION 或 Dexter 实质改变 Journey、范围、授权/目标才建立有触发记录的新 cycle。`--self-test` 包含 round-three、round-two-without-self-decision、错误 reviewerKind 与缺失输入清单 red fixtures。

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
