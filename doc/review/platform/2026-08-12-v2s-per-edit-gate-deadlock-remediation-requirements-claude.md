# per-edit 门控制面自锁：整改需求（第二版 · Claude）

- 结论：接受 Codex 的 `NO-GO（M=3 / S=2 / N=1）`，三条 M 我**逐条独立复算，全部成立**。本版按其修订。
- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行任何动态环境。
- 亲验声明：本文机制部分由我直接打开 `tools/compliance-control/cli.mjs`、`contracts/policy/mandatory-per-edit-gate-command-closure.json`、`tools/verify-gates/verify.mjs` 得出并标注行号。

---

## 0. 最要紧的事：控制面**现在**就是锁死的，不是将来会锁

第一版把这当成"会发生的设计缺陷"。**它已经发生了。**

我实测 `contracts/policy/mandatory-per-edit-gate-command-closure.json` 的 SQL merge gate：

```
声明 commandSha256   cdffd9264c0f99286b445e0faff247966f1f89062c7c98735e479087d2f85a1e
实算                 9e2696527b35df2c86a7f6c4566f25076ae0d7fc61d99a00d21f274c884b0573
门文件修改时间        Aug 11 22:01
```

`cli.mjs:1094` 校验该 hash，不符即抛 → `validateMandatoryPerEditGate` → `validateActivePackageShape` → **`readActivePackage()` 失败**。于是 `hookPre` 对任何路径 `preDeny`。

**逃生口同样是堵的**：`recoveryOnlyPaths` 只放行 `activePackageRecoveryPath` 一个文件；而 `:1249` 的 `validateActivePackageShape(request.targetPackage, …)` **内部同样校验 mandatory gate**，恢复目标也撞同一个漂移 hash。

**这不是推断，是实测**：

```
$ node tools/compliance-control/cli.mjs print-delta
ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID
```

**推论**：第一版的"第 0 步：改 `cli.mjs` 写 FAIL receipt"**本身够不着**——改它要过 `hookPre`，而 `hookPre` 现在过不去。**任何整改方案必须先有一个能在 `readActivePackage()` 失败时仍可用的入口。**

### 0.1 附带发现：self-test 全绿而生产锁死

```
$ node tools/compliance-control/cli.mjs mandatory-per-edit-gate-self-test
MANDATORY_PER_EDIT_GATE_SELF_TEST=PASS
RED_COMMAND_HASH=PASS
```

`RED_COMMAND_HASH` 用**自己的夹具变异**证明"hash 检查会红"，但**从不比对当前 closure 与当前门文件**。于是出现：**self-test 全绿，生产已锁**。

这是本仓反复出现的同一形态——self-test 证明的是判据能红，不是当前状态健康。**P0 应顺带补一条：closure 声明的 `commandSha256` 与实际门文件必须在真实仓状态下比对，不符即红。** 这条比 P0 的其余部分更便宜，且能让下一次漂移在发生当天就暴露，而不是等到有人被锁住。

---

## 1. 机制复核（保留第一版正确部分）

### 1.1 一个门套六类 archetype

profile `BACKEND_PERFORMANCE_TOPOLOGY_BOOTSTRAP` → `scripts/check/backend-performance-sql-merge-coverage`，`compatiblePackageArchetypes` 六项：`backend-performance-static` / `backend-source` / `control-plane` / `design-only` / `frontend-source` / `runner-evidence`。改设计文档、改前端文件都要跑这个后端门。

### 1.2 门失败 → post receipt 不写；系统里没有"失败"状态

`cli.mjs:2704` 门失败即 `postBlock`，不写 post receipt；`:2709-2710` 写 receipt 时 `status` 是**字面量 `"PASS"`**。

### 1.3 第一版我说错的一环（保留更正）

我曾说"缺 post receipt 会让下一次 pre fail-closed"。**不成立**。`hookPre`（`:2602-2658`）只检查 `readActivePackage`、`allowed(...)`、UI-IA admission，全仓无 dangling / orphan pre 检查。**路径在允许面内则写入照常成功。**

### 1.4 真正的锁

`hookPre:2640` `if (!allowed(packageState, entry.path)) return preDeny('UNAUTHORIZED_CHANGED_PATH:…')`。而门本体 `scripts/check/backend-performance-sql-merge-coverage` 与 closure 文件**都不在典型包的允许面内**——修门被拒。叠加 §0 的 hash 漂移，现在连 `readActivePackage` 都过不去。

### 1.5 现状表述更正（Codex N-01，采纳）

第一版写"receipt 缺失使 exit 无法诚实收口"。**当前 `validatePackageExit` 根本不检查 receipt**：`:919-931` 的 `TRIM_OBSERVATION_PATH_LIST_ONLY` 分支在校验 `allowed(...)` 与三个 retired 标记后**提前 PASS**，完全不触 `deltaState`；主分支也只做 changedPaths ⇄ delta 的申报相等，不查 receipt。

**所以这不是"现有基线被破坏"，而是"基线本来就缺"**——是第 0 步要补的东西，不是要恢复的东西。

---

## 2. 实施前置表（Codex 要求，按依赖顺序）

| 阶段 | 名称 | 前置 | 交付物 | 未做则后续不可执行的原因 |
|---|---|---|---|---|
| **P0** | control-plane bootstrap activation | 无 | 独立、hash-bound、最小 exact surface 的激活通道 | `readActivePackage()` 现已失败，无此通道则**任何**控制面改动都写不进去 |
| **P1** | entry ledger 基线 | P0 | 独立于 post receipt 的 changed-path 台账 + 全 exit mode 通用校验 | 无 ledger 则"每条路径有 receipt""FAIL 未被删"都没有分母可证 |
| **P2** | archetype → profile exact partition | P0、P1 | 六类 archetype 的唯一映射与最终态 exit 重跑入口 | 无此闭集则拆掉 design-only/frontend-source 的兼容关系后**无人运行该门** |
| **P3** | 锚点换基 | P2 | 加法优先的替代断言 + 真红变异 | 锚点是重构必红的根源，但不先有 P2 就会失去覆盖 |

**FAIL receipt（原第 0 步）落在 P1**，因为它要写进 ledger 才可证。

---

## 3. P0 · control-plane bootstrap activation

### 3.1 要求

定义一个**独立于普通业务包**的激活通道，满足：

- **在 `readActivePackage()` 失败时仍可用**——这是它存在的唯一理由
- **hash-bound**：其自身的允许面清单与每个文件的 sha256 都被钉住，不可临时扩张
- **最小 exact surface**：只允许 control CLI、closure、相关 gate 与其 self-test、以及设计/证据文件。**逐条列名，不用通配符**
- **不得**假设普通业务包可以先扩自己的 scope
- **不得**要求先放宽任何现有门

### 3.2 与既有 recovery 的关系

既有 `recover-active-package` **不能复用**：它的 target 经 `validateActivePackageShape`（`:1249`），内部仍校验 mandatory gate profile，撞同一个漂移 hash。

P0 必须是**另一条通道**，其校验链**不得**包含 mandatory gate 的 `commandSha256` 比对——否则它无法解决它要解决的问题。

### 3.3 红变异

- 通道允许面外的路径必须红
- 通道自身文件 hash 漂移必须红
- 用该通道写入非 control-plane 文件必须红
- 通道被用于绕过正常包的 scope 限制必须红

---

## 4. P1 · entry ledger 与 receipt 完整性（Codex M-02，采纳）

### 4.1 问题：现有分母是循环的

当前 scope 内新增路径是**从现存 post receipt 反推**的。删掉一条 FAIL post receipt，该路径**同时离开分母**——于是"每条 changed path 都有 receipt"无法证明，"历史 FAIL 未被删改"更无法证明。

**必须有一份独立于 post receipt 的台账。**

### 4.2 ledger 要求

- **独立来源**：changed-path 集合从 `deltaState(root)` 派生，不从 receipt 反推
- **append-only**：条目只增不改；每条记 `invocationId` / `path` / `beforeSha256` / `postStatus`（`PASS` | `FAIL`）
- **全 exit mode 通用**：包括 `TRIM_OBSERVATION_PATH_LIST_ONLY` 分支。**trim 不得再提前 PASS 而跳过 receipt 校验**

### 4.3 明确的边界（防止范围蔓延）

**本控制只解决一个有限问题**：对**启用了 mandatory per-edit gate 的包**，证明「每条实际变更路径都留下了 pre/post 记录，且失败记录未被抹除」。

**不解决、也不试图解决**：
- 全局 after-hash exact-set —— 该机制已由 Dexter 退役（`harnessTrimObservation.afterSha256AndReceiptExactSet: "NOT_USED_RETIRED_BY_DEXTER_DECISION"`）。**本设计不得以任何形式悄悄恢复它**
- 未启用 mandatory gate 的包
- 内容正确性（ledger 只证"有记录"，不证"记录的内容对"）

### 4.4 信任边界（Codex S-02，采纳，诚实写明）

`.runtime/` 是本地目录，任何有仓库写权限的进程都能改。**append-only 与 hash-chain 只能抵抗"误删/顺手改"，不能抵抗有意篡改**——因为链的锚点若也在 `.runtime` 内，则整条链可被一致地重写。

**因此本设计明确声明**：ledger 是**纪律边界与事故边界，不是安全边界**。若将来需要抗特权篡改，锚点必须放在 `.runtime` 之外的、本流程不可写的位置——**那是另一个议题，不在本需求内**。

不写这一条，就是在用一个安全承诺换取信任，而它兑现不了。

### 4.5 红变异（Codex 要求的五条，全部采纳）

1. **trim 绕过**：走 `TRIM_OBSERVATION_PATH_LIST_ONLY` 而跳过 receipt 校验必红
2. **scope-only 路径无 receipt**：路径在允许面内、被写过、但无 receipt 必红
3. **删除 receipt** 必红
4. **编辑 FAIL receipt 内容** 必红
5. **最终态 gate FAIL** 必红

### 4.6 FAIL receipt 的结构化字段（Codex S-01，采纳）

**不得存拼接错误字符串。** 固定字段：

| 字段 | 说明 |
|---|---|
| `profileId` | 触发的 profile |
| `command` | 实际执行的命令 |
| `errorCode` | **稳定错误码**，不随输出变化 |
| `exitStatus` / `signal` | 进程终止状态 |
| `stdoutExcerpt` / `stderrExcerpt` | **脱敏且有限长度** |

**并规定**：凡已取得合法 pre 的 terminal post failure，**都必须写 FAIL receipt**——不只是 mandatory gate 失败这一种。否则"每条路径有 receipt"仍有缺口。

---

## 5. P2 · archetype → profile exact partition（Codex M-03，采纳）

### 5.1 问题：第一版的"verify 会兜底"不成立

我复核 `tools/verify-gates/verify.mjs`：静态 root 只跑 execution catalog 的 15 个 child 与 ArchUnit selector，**既不运行 SQL merge gate，也不调用 `validatePackageExit`**。

当前 admission 只检查"主动选择的 profile 与 archetype 兼容"（`validateMandatoryPerEditGate` 的 `compatiblePackageArchetypes.includes(...)`），**没有 archetype → profile → command → 最终态 exit 调用的唯一闭集映射**。

**所以第一版"拆掉 design-only/frontend-source 的兼容关系"是危险的**：拆完之后没有任何入口会运行该门。

### 5.2 要求

为六类 archetype 给出 **exact partition**，每类唯一确定：

| 要素 | 要求 |
|---|---|
| profile | 每个 archetype **恰好一个**，不得多对多 |
| command + `commandSha256` | 钉死 |
| 适用面 | 该 profile 检查什么、不检查什么 |
| 最终态 exit 重跑入口 | 该 profile 在 exit 时由**哪个具体入口**重新运行 |

### 5.3 红变异

- **遗漏 archetype**（六类中任一无映射）必红
- **错误 profile**（archetype 映射到不该它跑的 profile）必红
- **扩大兼容集**（把一个 profile 的 `compatiblePackageArchetypes` 加宽）必红
- **final gate 未运行**（exit 时未重跑该 archetype 的 profile）必红

### 5.4 顺序约束

**只有该控制上线并验红之后**，才能拆掉 design-only / frontend-source 对 SQL merge gate 的兼容关系。**顺序颠倒等于制造一段无人看守的窗口。**

---

## 6. P3 · 锚点换基（保留第一版，Codex 未质疑）

- **加法优先**：先加替代断言 → 用真变异证明它会红 → **才**删旧锚点。顺序反过来出现覆盖真空
- **双源对账**：替代断言必须断言两个独立产出的产物相等，而不是断言"符合某个生成器的输出"。仓内范式：`scripts/test/catalog-inventory-query-envelope.test.mjs` 用 `deepEqual` 对账 matrix / `edge.ts` / `rtk.ts`
- **无契约替代物的实现纪律不得删除**：例如"跨 owner 消费必须 fail-closed 解析"是实现纪律不是契约事实。这类只有两个诚实选项——保留源码锚点并接受脆性，或下沉成行为测试。**不得为了消灭源码锚点而删掉它**

---

## 7. Dexter 已裁决：允许 FAIL receipt 存在

配套四条约束不变，但**落点从"第 0 步"改为 P1**（因为它需要 ledger 才可证）：

1. **中间态可失败，最终态必须过门**——exit 时重跑该 archetype 的 mandatory gate 针对最终状态必须 PASS。**不要**改成逐条判断"某个 FAIL 是否被后续 PASS 覆盖"，那种逻辑难写对且易被构造绕过
2. **每条 changed path 必须有 receipt**，`PASS` / `FAIL` 皆可，缺失不行
3. **FAIL receipt 不可删不可改**（信任边界见 §4.4）
4. **必须带结构化失败详情**（字段见 §4.6）

---

## 8. 本版结论

**对第一版：接受 `NO-GO`。** 三条 M 我逐条复算全部成立，其中 M-01 已是**现状故障**而非设计缺口。

**对本版：`需 Codex 复核`。** 我不为自己的修订自判 GO。

**建议 Dexter 关注的一点**：§0 的 hash 漂移意味着控制面**此刻**处于不可写状态。P0 不是流程整洁问题，是**当前阻塞的唯一解**，其优先级高于本文其余全部内容。

---

## 9. 授权边界

本文档是需求分析，不是实施授权，也不是评审结论。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器 / UAT / 部署。机制结论为直接读源码所得并标注行号。§4.4 的信任边界结论是**设计声明**，不是已实现的保证。
