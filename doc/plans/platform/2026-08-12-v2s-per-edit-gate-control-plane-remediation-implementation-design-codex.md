---
implementationAuthority: false
---

# per-edit 门控制面自锁整改：整体详设与单批实施计划

`DESIGN_KIND=IMPLEMENTATION_FACING_DESIGN`  
`STATUS=PROPOSED_REVIEW_ONLY`  
`REVIEW_CYCLE_ID=PER_EDIT_GATE_CONTROL_PLANE_REMEDIATION_DESIGN_20260812`  
`REVIEW_ROUND=1 / REVIEW_ROUND_LIMIT=2`  
`DEXTER_SCHEDULED_CLAUDE_DESIGN_ROUNDS=1`

## 1. 目标、事实与设计裁决

### 1.1 用户任务与成功结果

权威需求是 `doc/review/platform/2026-08-12-v2s-per-edit-gate-deadlock-remediation-requirements-claude.md`。本设计只解决同一个系统问题：门失败可以被审计而不锁死继续修复的路径；最终状态仍必须过门；六类 package 不再错误共用后端 SQL gate；可替代的源码文本锚点迁到稳定事实，不能替代的实现纪律继续保留或下沉为行为测试。

成功结果必须同时成立：

1. 当前 `readActivePackage()` 因 gate hash 漂移而失败时，有一个不复用该失败校验链、只触达 exact control-plane surface 的 P0 激活通道；
2. 对启用 mandatory gate 的 package，`deltaState(root)` 中每条最终 changed path 都有同一 package 的合法 PRE 与 terminal POST（PASS 或 FAIL），FAIL receipt 被 ledger 绑定且不能在不触发 exit 红灯的情况下误删或误改；
3. 六种 archetype 恰好映射到一个 profile，profile 的 command、hash、适用面和 exit 重跑入口均闭合；
4. P3 先冻结源码锚点分母，再逐项 `MIGRATE_DUAL_SOURCE / MOVE_TO_BEHAVIOR_TEST / RETAIN_SOURCE_DISCIPLINE`，没有覆盖真空；
5. 全部工作是一个 package 内的 P0→P1→P2→P3 串行实施，一次实施后 review；静态设计或静态 gate 不能被表述为动态、业务、cleanup 或性能成功。

### 1.2 已复证现状

- closure 声明 gate SHA 为 `cdffd9264c0f99286b445e0faff247966f1f89062c7c98735e479087d2f85a1e`，真实 `scripts/check/backend-performance-sql-merge-coverage` SHA 为 `9e2696527b35df2c86a7f6c4566f25076ae0d7fc61d99a00d21f274c884b0573`。
- `mandatoryGateProfiles()` 在 `readActivePackage()` 路径中先比 command hash；`print-delta` 因 `ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID` 失败。
- `readActivePackageRecoveryRequest()` 对 target 调 `validateActivePackageShape()`，所以既有 recovery 同样撞 mandatory gate 校验。
- `hookPost()` 当前 gate FAIL 直接 `postBlock`，post receipt 只可能写字面量 PASS。
- `validatePackageExit()` 当前不校验 hook receipt，且 trim 分支提前返回。
- 当前一个 profile 用 `compatiblePackageArchetypes` 同时覆盖六类 archetype；`scripts/verify` 不运行该 gate，也不调用 package exit。

### 1.3 方案比较

| 方案 | 裁决 |
|---|---|
| 只同步 closure SHA | 拒绝：只能暂时解锁，不能防止再次自锁、FAIL 无痕、分区漂移或 exit 漏跑。 |
| 永久关闭 hook / 放宽 package scope | 拒绝：把自锁换成无审计写入。 |
| 用后续 PASS 覆盖历史 FAIL | 拒绝：覆盖关系可被构造且会丢失审计；最终态 gate PASS 才是发布判据。 |
| 恢复全局 after-hash exact-set | 拒绝：该机制已由 Dexter 明确退役。 |
| 本设计 | 采用：首次 exact bridge 只解除鸡生蛋问题；随后由 durable bootstrap、独立 ledger、六类 exact partition 与 anchor disposition 完成根因闭环。 |

## 2. 总体状态机与唯一实施节奏

```text
LOCKED_CURRENT_STATE
  -> P0_BRIDGE_AUTHORIZED
  -> P0_CONTROL_PACKAGE_ACTIVE
  -> P0_DURABLE_BOOTSTRAP_PROVEN
  -> P1_LEDGER_AND_FAIL_RECEIPT_PROVEN
  -> P2_SIX_PROFILE_PARTITION_PROVEN
  -> P3_ANCHOR_DISPOSITIONS_CLOSED
  -> PACKAGE_EXIT_FINAL_GATE_PASS
  -> IMPLEMENTATION_REVIEW_READY
```

这是一个 implementation package 的内部状态机，不是四个可独立宣布完成的 package。任一步 red mutation、focused proof 或 source readback 未闭合，后一步不得开始。实施 agent 在每一步写入前后都必须重开本需求、对应本节、项目记忆与 owning source；不得从名称、旧 helper 或聊天摘要推断。

## 3. P0：首次 exact bridge 与 durable bootstrap

### 3.1 为什么必须有首次 bridge

durable command 要写进 `cli.mjs`，但当前 `hookPre` 在读到它之前已经因 active package mandatory gate 无效而拒绝；因此不存在“完全由当前控制面内部安装其自身逃生口”的方案。第一次实施必须显式使用一个一次性外部信任动作，且只能做解除鸡生蛋问题所需的最小写入。该事实必须写进实施证据，不能伪装为普通 package edit。

### 3.2 P0-B0 一次性 exact bridge

Claude DESIGN GO 且 Dexter 另行授权实施后，由主实施 agent 在仓库外的 `mktemp -d` 隔离目录生成一个**一次性、无仓内 import 的 Node executor** `per-edit-gate-bootstrap-bridge.mjs` 和 `per-edit-gate-bootstrap-activation-request.json`；当前控制面锁死时不得先假设能把 request 写进仓库。executor 只能接受 request 的绝对路径和其 SHA-256：以 Node 标准库复算 request、repo realpath、两个 before hash、candidate bytes hash 与 target exact-set，执行第 75 行规定的原子写入顺序，不能接受 CLI 选项、目录、glob、额外 target 或 repo-local module。它运行后立即退出，隔离目录随即删除；**不得**写入、复制或遗留在仓库内成为常驻入口。request 绑定：repo realpath、request nonce、生成时间、原因、以下**恰好两个** target、每个 target 的 before/after SHA-256 与完整 candidate bytes SHA：

1. `contracts/policy/mandatory-per-edit-gate-command-closure.json`：只把 bootstrap profile 的 command hash 同步到已经复证通过的真实 gate bytes；
2. `.runtime/compliance-control/active-package.json`：激活唯一 `control-plane` implementation package，其 allowed surfaces 是本设计 P0–P3 的逐文件 exact list。

外部 bridge 必须一次读取 request 后再写：先校验 realpath、request hash、两个 before hash、target exact-set；再验证 candidate closure 指向的真实 gate hash；先原子替换 closure，再原子替换 active package；立即调用正常 `readActivePackage()` 与 bootstrap profile，均 PASS 才写 no-replace activation receipt。第二个 target 之外任何路径、通配目录、symlink escape、before hash 漂移或 candidate hash 不符均在零写入状态失败。closure 先写的崩溃窗口会让旧 active package恢复有效，不会扩大允许面；active package candidate 只有在 closure candidate 已验证后才写。

P0-B0 是仅此一次的外部 trust anchor，不是常规 bypass。激活成功后，再由已恢复的普通 package 把**executor 原字节及其 SHA-256**、request 原字节及其 SHA-256、receipt 和完整 stdout/stderr 脱敏摘要归档到下列逐文件 evidence：`doc/evidence/platform/2026-08-12-v2s-per-edit-gate-bootstrap-bridge-source.txt`、`doc/evidence/platform/2026-08-12-v2s-per-edit-gate-bootstrap-bridge-source.sha256`、`doc/evidence/platform/2026-08-12-v2s-per-edit-gate-bootstrap-activation-request.json` 与 `doc/evidence/platform/2026-08-12-v2s-per-edit-gate-bootstrap-activation-receipt.json`。归档只是审计副本，不得被任何 runtime/CLI/hook 发现或执行。不得用“hook 已关闭”代替这份 exact transaction。

### 3.3 P0-B1 durable bootstrap

解锁后在普通 `control-plane` package 内新增：

- `contracts/policy/per-edit-control-plane-bootstrap-closure.json`：固定 durable command、CLI SHA、request/receipt path、可激活 package 的 exact surface、唯一允许的 failure code；
- `.runtime/compliance-control/per-edit-control-plane-bootstrap-request.json`：一次性 request；
- `.runtime/compliance-control/per-edit-control-plane-bootstrap-receipt.json`：atomic no-replace receipt；
- CLI 命令：`node tools/compliance-control/cli.mjs bootstrap-per-edit-control-plane --request-sha256 <64hex> --bootstrap-closure-sha256 <64hex>`；
- self-test 与 production current-state health check。

hook 只在 `readActivePackage()` 精确失败为 `ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID` 时允许写 request 或执行该 exact command；active package 健康、其他 package 结构错误、普通源码写入或额外 argv 一律拒绝。bootstrap 校验链只解析 request/closure、realpath、exact set、before/after hashes、candidate package基本结构和 candidate mandatory profile引用；**不得调用当前失败的 `mandatoryGateProfiles(root)`**。候选 closure 必须对真实 gate bytes 校验成功，候选 package 的 allowed surfaces 必须与 bootstrap closure 的 exact surface 双向相等。写入顺序、最终正常校验与 no-replace receipt同 P0-B0。

durable bootstrap 本身是纪律边界，不是抗特权攻击的安全边界；其授权来自 Dexter 对 request digest 的显式实施授权。正常 package 健康时调用它必须红，防止把恢复口变成 scope bypass。

### 3.4 P0 red mutations 与退出判据

- 少/多/替换任一 target、非 control-plane 路径、通配 surface、path escape 必红；
- request/closure/CLI/current gate/before/candidate 任一 hash 漂移必红；
- active package 健康时调用、错误 failure code 时调用必红；
- candidate closure 未绑定真实 gate、candidate package surface 与 closure 不 exact 必红；
- 重放同一 request、覆盖已有 receipt 必红；
- 真实仓 current-state check 必须复算 closure→command SHA；scratch self-test 绿但真实仓漂移时整体仍红。

P0 只有在 bridge receipt、durable positive self-test、全部真实 red mutation 与正常 `readActivePackage()`/profile PASS 后完成。

## 4. P1：独立 entry ledger、FAIL receipt 与全 exit mode

### 4.1 数据模型

每个启用 mandatory gate 的 package 使用 `.runtime/compliance-control/package-entry-ledgers/<packageId>/`。ledger 采用 atomic no-replace 的单事件文件而非可重写 JSON 数组：

- `000001-<invocationId>-PRE.json`：`packageId, invocationId, path, beforeSha256, previousEntryHash, entryHash, recordedAt`；
- `000002-<invocationId>-POST.json`：同上，加 `postStatus=PASS|FAIL, preEntryHash, receiptPath, receiptSha256`；
- `head.json`：只由 append helper 原子推进 `sequence/tailHash`，不得人工编辑。

多路径一次 edit 对每个 path 各写 PRE/POST event，但共享 invocationId。PRE 在合法 pre receipt no-replace 成功后追加；POST 必须在 terminal receipt 写成功后追加。event 的 `entryHash` 对 canonical JSON（不含 entryHash）做 SHA-256，并链到前项。ledger 的 changed-path 分母始终来自 `deltaState(root).changed`，绝不从 receipt 或 ledger 反推。

该链能防误删、误改和尾序列漂移；由于全部锚点都在 `.runtime`，它不承诺抵抗拥有仓库写权限的恶意一致重写。这是纪律/事故边界，不是安全边界。

### 4.2 terminal POST 与结构化 FAIL

一旦 hookPost 已成功读取合法 pre 且确认 exact paths，之后任何 terminal failure 都先写 FAIL post receipt、再追加 FAIL ledger event、最后 `postBlock`。固定结构：

```json
{
  "status": "FAIL",
  "failure": {
    "profileId": null,
    "command": null,
    "errorCode": "STABLE_CODE",
    "exitStatus": null,
    "signal": null,
    "stdoutExcerpt": "",
    "stderrExcerpt": ""
  }
}
```

mandatory gate failure时 `profileId`、`command` 必须非空；其他 post validation failure 保留同名 key 为 null。stdout/stderr 分开收集，统一换行、先按 observability redaction 删除 secret/token/cookie/Authorization/手机号/登录名/IP/raw payload，再按 UTF-8 每项最多 2048 bytes 截断；`errorCode` 不包含动态输出。PASS receipt 同样带 profileId、command、exitStatus=0 和 paths。

### 4.3 package exit 算法

normal 与 `TRIM_OBSERVATION_PATH_LIST_ONLY` 共用同一个前置 validator，顺序固定：

1. `deltaState(root)` 取得最终 changed paths（排除 exit 文件的既有规则保留）；
2. 验证 ledger sequence/hash chain/head；
3. 每个 changed path 至少存在一个同 package、合法 linked PRE+terminal POST；
4. 每个 POST 引用的 receipt 必须存在且 hash 相等；FAIL receipt 的任何删除/编辑因此必红；
5. orphan PRE、重复 terminal POST、packageId/path/invocation mismatch 必红；
6. 调 P2 唯一 profile 执行最终态 gate，必须 PASS；
7. 才进入 normal 或 trim 原有业务字段校验并输出 PASS。

历史 FAIL 不要求被后续 PASS 覆盖，也不阻止 exit；最终态 gate 才决定能否发布。ledger 不比较全局 final after hash，也不要求 receipt set 与全部历史 edit exact equality，不以任何形式恢复退役的 `afterSha256AndReceiptExactSet`。

### 4.4 P1 red mutations 与退出判据

trim 跳过 validator、changed path 无 linked receipt、删除 receipt、编辑 FAIL receipt、删 ledger 中间项/改链、orphan PRE、同 invocation 双 terminal POST、FAIL 缺固定字段/未脱敏/超长、最终态 gate FAIL，均须真实红。P1 完成后，中间 edit gate FAIL 能留下可行动证据且下一次合法 edit 可继续，但 package exit 仍 fail-closed。

## 5. P2：六 archetype 的 exact partition

### 5.1 唯一 catalog 形状

升级既有 `mandatory-per-edit-gate-command-closure.json`，不新建平行 profile catalog。顶层声明 exact `packageArchetypes` 六项；每个 profile 使用单值 `packageArchetype`，删除多对多 `compatiblePackageArchetypes`。validator 必须先对六项全集做 exact equality，再验证每个 archetype 恰有一个 profile、profileId 唯一、command+argv+commandSha256 有效、command executable、review binding GO。

### 5.2 固定映射

| archetype | profileId | command | 适用面 / 明确不检查 |
|---|---|---|---|
| `backend-performance-static` | `PER_EDIT_BACKEND_PERFORMANCE_STATIC` | `scripts/check/backend-performance-sql-merge-coverage` | BPF 静态 SQL/shape/source controls；不证明动态性能。 |
| `backend-source` | `PER_EDIT_BACKEND_SOURCE` | `scripts/check/backend-boundaries` | 后端 owner/edge/依赖机械边界；不替代业务测试。 |
| `frontend-source` | `PER_EDIT_FRONTEND_SOURCE` | `scripts/check/frontend-architecture` | 双 app 前端依赖/generated consumer 边界；不运行后端 SQL gate。 |
| `control-plane` | `PER_EDIT_CONTROL_PLANE` | 新增 `scripts/check/per-edit-control-plane` | closure/current command/CLI/bootstrap/ledger/profile schema 与 self-tests；不改业务分母。 |
| `design-only` | `PER_EDIT_DESIGN_ONLY` | 新增 `scripts/check/per-edit-design-context` | 当前 Registry/Roadmap、standards coverage、design-only authority 和已声明 design/manifest引用；不运行源码或动态测试。 |
| `runner-evidence` | `PER_EDIT_RUNNER_EVIDENCE` | 新增 `scripts/check/per-edit-runner-evidence` | 复用 test-health entry self-test 与 logging/first-failure静态控制；不启动 Testcontainers/DEV/L2/seed。 |

三个新增脚本只是 per-edit profile adapter，不创造第二套标准：它们只能调用上表已有 owning checker/CLI，输出所调用控制的真实 marker；adapter 自身有参数/漏调用/假 marker red mutation。其 command bytes 由同一 closure 的 commandSha256 钉住。

### 5.3 执行入口和顺序

`hookPost` 按 active package archetype 唯一选择并执行 profile；`validatePackageExit` 在 P1 ledger validator 之后再次调用同一个 `runMandatoryPerEditGate(root, packageState, {phase:"FINAL_EXIT"})`，receipt 记录 `executionPhase=PER_EDIT|FINAL_EXIT`。exit 必须看到本次 invocation 新生成的 final gate receipt，不能接受旧 PASS。

只有六项 exact partition、四类 red mutation和 final exit新鲜执行全部验红后，才删除旧 bootstrap profile 对 design-only/frontend-source 等六类的兼容数组；该删除与新 closure schema 在同一原子 edit 内完成，不出现无人看守窗口。

红变异：漏任一 archetype、重复映射、错误 profile、把单值改回兼容数组/扩大适用面、command/argv/hash 漂移、final gate 未运行或复用旧 receipt，均必红。

## 6. P3：源码锚点换基

### 6.1 有限分母

实施开始 P3 前，先对进入 P2 时 hash-bound 的 `scripts/check/backend-performance-sql-merge-coverage` 建 `doc/evidence/platform/2026-08-12-v2s-per-edit-source-anchor-disposition.json`。分母是该 gate 中所有直接读取 production `.java/.ts/.mjs` bytes 后用 `includes`、regex 或固定 signature 判断实现写法的条件；排除 JSON/OpenAPI schema 的结构化字段检查和 self-test 对错误码/marker 的检查。每项记录 `anchorId, gateFunction, sourcePath, sourceAnchor, protectedFact, disposition, replacementOwner, redMutation`。checker 以 gate function+source path+anchor digest 双向 exact，少项、虚报或 PENDING 必红。

### 6.2 三种且仅三种 disposition

- `MIGRATE_DUAL_SOURCE`：存在两个独立产出的权威产物。先加结构化解析与 deep equality，再对任一产物做真实 substitution mutation 验红，最后才删旧文本锚点。generator 与其单一输出不算双源。
- `MOVE_TO_BEHAVIOR_TEST`：事实可由真实 owner/adapter/serialization 行为证明。先加 focused behavior test 和反例，再删锚点。
- `RETAIN_SOURCE_DISCIPLINE`：事实是实现纪律且无独立契约，例如跨 owner canonicalJson 消费必须 `readTree → data object assertion → typed treeToValue` 且不接受空值。保留源码锚点和真变异，承认其重构脆性；不得为整洁而删除。

已知 canonicalJson fail-closed family 默认进入 `RETAIN_SOURCE_DISCIPLINE`，除非实施时先存在等价行为测试并证明同族全覆盖。Host extension/OpenAPI/generated wire、query envelope 等具有独立结构化产物的 family 优先评估 `MIGRATE_DUAL_SOURCE`；transaction/owner composition 可行为化的 family 评估 `MOVE_TO_BEHAVIOR_TEST`。这些是分类入口，不代替逐行 ledger。

### 6.3 P3 顺序与红变异

每项严格 `freeze denominator → add replacement → mutate independent source/behavior → observe exact red code → remove old anchor → rerun green`。任何先删锚点、单源自证、把 generator 与自身输出当双源、删除 retained discipline、ledger 少/多/PENDING 均必红。

## 7. 实施文件面与 create/update/retain/delete

### 7.1 create

- `contracts/policy/per-edit-control-plane-bootstrap-closure.json`
- `scripts/check/per-edit-control-plane`
- `scripts/check/per-edit-design-context`
- `scripts/check/per-edit-runner-evidence`
- P0 activation request/receipt、P1 ledger evidence、P3 anchor disposition、focused self-test/implementation evidence文件（逐文件列入 active package，禁止目录通配）
- `project-memory/operations/per-edit-gate-failure-and-bootstrap.md`
- `project-memory/pitfalls/per-edit-gate-self-lock.md`

### 7.2 update

- `tools/compliance-control/cli.mjs`
- `contracts/policy/mandatory-per-edit-gate-command-closure.json`
- `scripts/check/backend-performance-sql-merge-coverage`
- `tools/compliance-control/cli.mjs` 的 `mandatory-per-edit-gate-self-test` 与 `active-package-recovery-self-test` **子命令**：两者不是独立 `scripts/check/*` 文件；其 fixture 和 production current-state health 变更均由上述 CLI update 覆盖。`active-package-recovery-self-test` 只纠正既有 fixture 使其符合 mandatory profile，不把既有 recovery 冒充 P0。
- `scripts/README.md`、`project-memory/index.*`、required inventory、standards matrix 的 review checklist 指针（不改冻结 rules）
- `.runtime/compliance-control/active-package.json`（仅 P0 bridge activation 与最终 package closure）

### 7.3 retain

- 既有 `recover-active-package`：继续处理普通 malformed package，不承担 mandatory gate hash drift；
- `harnessTrimObservation.afterSha256AndReceiptExactSet = NOT_USED_RETIRED_BY_DEXTER_DECISION`；
- 无契约替代的源码实现纪律与对应真 red mutation；
- `scripts/verify` 的现有职责，不声称它替代 final package gate。

### 7.4 delete

本设计不预先批准删除任何生产、测试、fixture 或历史 receipt 文件。P3 只允许删除 disposition 已闭合且 replacement 已验红的**旧文本断言语句**；文件删除若实施时出现，必须重新进入问题族与详设变更，不得顺手做。

## 8. 六类 package-exit source compliance 分母

| id | owning source | exit 对账 |
|---|---|---|
| `AUTHORITY_REQUIREMENT` | 本需求、Dexter design/implementation authorization、Claude GO | path+hash+anchor；implementation 前 authority 必须从 false 变为独立授权。 |
| `BOOTSTRAP_CONTROL_SURFACE` | bootstrap closure、activation request/receipt、CLI bootstrap branch | exact target/surface/hash/realpath 与 P0 red mutation 全集。 |
| `ENTRY_LEDGER_RECEIPT` | `deltaState`、hook PRE/POST、ledger chain、exit validator | changed path → linked PRE+terminal POST；receipt hash完整；trim 共用。 |
| `ARCHETYPE_PROFILE_PARTITION` | mandatory closure、active package archetype、profile adapters、final exit receipt | 六 archetype/profile exact equality；新鲜 final gate PASS。 |
| `SOURCE_ANCHOR_DISPOSITION` | SQL merge gate hash、anchor ledger、replacement contract/behavior owner | source anchors 与 disposition exact equality；无 PENDING；加法优先证据。 |
| `PREVENTION_AND_HANDOFF` | self-tests、project-memory、README、review checklist、implementation review input | 当前仓 health check、真实 red codes、索引重建与授权边界一致。 |

任一分母缺 source、hash、anchor、owner、disposition、red proof，或出现 `PENDING`，package exit 必须 fail-closed。hook receipt 只证明发生写入，不替代六类语义对账。

## 9. 唯一串行实施计划与验收

| 序位 | unit | 完成条件 |
|---:|---|---|
| 1 | `PEG-CP-U01 / P0` | exact bridge 解锁；durable bootstrap/current-state health/self-tests 全绿；scope bypass 与 hash drift 真红。 |
| 2 | `PEG-CP-U02 / P1` | PRE/POST ledger、结构化 FAIL、全 exit mode validator落地；五类要求 red 加链完整性 red 全绿。 |
| 3 | `PEG-CP-U03 / P2` | 六 archetype/profile/command/final exit exact partition；旧多对多兼容在同一 edit 退役。 |
| 4 | `PEG-CP-U04 / P3` | source anchor ledger 双向精确；每项三选一，无 PENDING；迁移项 replacement先验红后删锚点。 |
| 5 | `PEG-CP-U05 / exit` | 六分母 reconciliation PASS、最终 gate新鲜 PASS、所有 changed paths receipt闭合、静态 `scripts/verify` PASS，形成唯一 IMPLEMENTATION review input。 |

实施期可并行的只有互不写同一文件的只读 inventory/self-test分析；`cli.mjs`、closure、active package、SQL gate、ledger/exit validator 是共享控制根，必须由主 agent 串行落地并逐点回读。不得把四个阶段拆为四次设计或四次外部 review。

## 10. 验证边界与 review 节奏

设计期只运行只读/静态 checker。实施验收包括 focused self-tests、全部真实 red mutation、current repository health check、package exit 与 `scripts/verify`；不启动 Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署或手工 SQL。本整改是工程控制面，不产生业务/cleanup/性能 PASS。

Dexter 于 2026-08-12 明确豁免本轮 Codex 内部 fresh adversarial review，要求直接交 Dexter 与 Claude 做唯一一轮 DESIGN review；本设计不伪造 subagent verdict。Claude GO 后仍须等待 Dexter 明确 implementation authority，随后一个 package 按 P0→P1→P2→P3 实施；完成后只做一轮 IMPLEMENTATION review。

## 11. 禁止伪修复清单

- 只改 closure hash、只扩大 allowedChangeSurfaces、永久关闭 hook；
- bootstrap 在 active package 健康时可用，或使用目录/glob/scope prefix；
- FAIL 不落 receipt、把 stdout/stderr 拼进错误码、记录 secret/raw payload；
- 从 receipt 反推 changed-path 分母、trim 提前 PASS、恢复退役 after-hash exact-set；
- 某次 PASS 覆盖历史 FAIL、复用旧 final gate receipt；
- 六 archetype 多对多兼容、拆旧 profile 后再补新分区；
- 先删 source anchor、generator 与自身输出自证、无替代物时删实现纪律；
- 以 static PASS 宣称 Testcontainers、DEV、L2、seed、业务、cleanup 或性能成功。
