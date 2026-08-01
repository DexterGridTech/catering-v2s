---
title: RM1-P0 实现闭环独立复核（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1-P0 ONLY
verdict: NO-GO
findings: M=3 / S=1 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅 P0 独立实现复核；不授权修改代码、动态业务环境、DEV、seed、reset、migration 或 Roadmap 状态；findings 仅作待验证输入
createdAt: 2026-07-28
---

# RM1-P0 实现闭环独立复核

## 0. 结论

**NO-GO**，`M=3 / S=1 / N=3`。

三条 M 同源于**一个机制缺陷**：P0 的 standards 执行 runner 会吞掉非末位命令的失败，
导致 `business.status=PASS` 被写入，**而该假绿已经实际发生**——
`scripts/check/affected-l2` 当前真红（`REAL_EXIT=1`），它正是 P0 自己声明的 `requiredControlRefs`。

P0 的其余部分质量高：standards 分母顺序、compliance-control 六维强制、历史 intake recovery 的边界、
predicate map overlay、源码修复手法、P3-A/P4 skeleton 不越权——**逐项亲验通过**（见 §3）。

**会话出处**：fresh v2s-rooted 只读会话，非续接、非它仓。仓库零写入（本文件除外）。
仓根按本机挂载为 `/Volumes/idea/catering-v2s`（与来件给出的 `/Users/dexter/…` 为同一仓的不同挂载路径）。

**授权边界**：本次仅为 P0 独立实现复核。不授权修改代码、运行动态业务环境、DEV、seed、reset、
migration 或 Roadmap 状态变更；所有 findings 仅作为待验证输入。

---

## 1. M（必须修复）

### M1 ｜`scripts/run/rm1-p0-standards-execution:79-91` —— runner 吞掉非末位命令的失败

**问题**：

```bash
if {
  "$root_dir/scripts/check/standards-coverage" --phase R5      # 79-80
  "$root_dir/scripts/check/standards-coverage" --self-test
  "$root_dir/scripts/check/standards-coverage" --phase R5 --execute-active --refs "$standards_refs"
  while ... "$root_dir/$control_ref"; "$root_dir/$control_ref" --self-test; done
  while ... "$root_dir/$standards_ref" --self-test; done
} 2>&1 | tee "$log_path"; then                                  # 90
  business_status="PASS"                                        # 91
```

脚本首行虽有 `set -euo pipefail`，但 **POSIX/bash 规定 `set -e` 在 `if` 条件内被抑制**。
因此 `{ … }` 组内任何一条失败都不会中止，组的退出码 = **最后一条命令**的退出码。
`pipefail` 只能把组的退出码传出管道，救不了组内已被吞掉的失败。

**反例（本会话在 scratchpad 实测，未写仓库）**：

```
if { false; true; true; } 2>&1 | tee /dev/null; then echo PASS; fi   → PASS
if { true; true; false; } 2>&1 | tee /dev/null; then echo PASS; fi   → FAIL
```

即：**只有末位命令的失败会被捕获**。首位的 `standards-coverage --phase R5`
（恰恰是"先验证完整 R5 matrix/catalog 分母"这一条）失败时，
只要末尾的 self-test 通过，`business_status` 仍写 `PASS`。

**为何违反 P0/计划**：计划 §1 明令「任何包内新增/修复门先在 scratchpad 真实变异验红」，
§2 闸口 2 明令「aggregate 的 PASS **不得覆盖**独立门的 FAIL」。
P0 是"控制先行/控制真实化"包，其**自身的执行 harness 存在假绿**，是最不可接受的一类缺陷。

**最小修复**：把 `if { … } | tee` 改为先执行、后判定，例如
`set +e; { … ; } 2>&1 | tee "$log_path"; rc=${PIPESTATUS[0]}; set -e`，
或在组内每条命令后显式 `|| { business_status=FAIL; exit 1; }`，
或将命令列表放入数组逐条执行并累计退出码。
**并补红夹具**：构造"首位命令失败、末位通过"的 fixture，`business_status` 必须为 `FAIL`。

---

### M2 ｜`affected-l2` 当前真红，而 run manifest 记为 `business: PASS`；R-26 的 `DEFERRED` 机制未实现

**实测（fresh 复跑）**：

| 调用 | REAL_EXIT |
| --- | --- |
| `scripts/check/affected-l2` | **1** |
| `scripts/check/affected-l2 --all-tree` | **1** |
| `scripts/check/affected-l2 --self-test` | 0 |

失败原因：`R5_AFFECTED_L2_TARGET_MISSING:apps/frontend/operations-admin/src/tests/l2/authentication.spec.ts`。

而 `.runtime/managed-runs/rm1-p0-standards-20260728T064252Z-75619/manifest.json` 记录：

```json
"requiredControlRefs": ["scripts/check/affected-l2"],
"business": { "status": "PASS" }
```

**这是 M1 已经实际发生的实例**，不是理论风险。

**并且 R-26 的补救机制未落地**：本会话检索
`contracts/policy/affected-l2-registry.json` 与 `tools/verify-gates/cli.mjs`，
`DEFERRED` / `deferredUntilPhase` 命中均为 **0**。
按计划，18 个缺失 L2 spec 应标 `DEFERRED` + `deferredUntilPhase: "RM2"` 并由到期自动转红——
该机制属 P0 范围（计划 §3 P0 输入含 `P-C3-PRE`），当前未实现，
故 `affected-l2` **不可能合法变绿**。

**最小修复**：
1. 先修 M1（否则任何后续修复的成败都不可信）；
2. 实现 R-26：registry 增 `deferredUntilPhase`，`assertFile` 见 `DEFERRED` 跳过、到期具名红；
   红变异 = 把 phase 调到 RM2，18 条必须全红；
3. 在此之前，P0 的 `business` 不得为 `PASS`——应为 `FAIL` 或显式 `BLOCKED_ON_P-C3-PRE`。

---

### M3 ｜`rm1-u01-package-exit.json` 的 P-C3 redProof 断言与生产门事实不符，且 `affected-l2` 在 exit 中零出现

**问题一（断言不实）**：package-exit 的 controls 中

```json
{"ruleId":"P-C3","state":"ACTIVE_RED_VERIFIED",
 "redProof":{"assertion":"affected L2 all-tree gate and deletion red self-test passed"}}
```

实测 `--all-tree` 与默认调用**均 EXIT=1**；只有 `--self-test` EXIT=0。
即该断言**只在 self-test 侧成立**，在生产门侧不成立。

这正是 **P-C1 所要消灭的 self-test/production 分叉**，
而它出现在 P0 自己的证据里——P0 恰是负责修 P-C1 的包。
（根因已在既往评审登记：`tools/verify-gates/cli.mjs` 的 `prepareSelfTestClean` 为每个缺失 target
写入空壳，使 self-test 自造绿色而生产态为红。）

**问题二（红门不可见）**：`affected-l2` 在整个 `rm1-u01-package-exit.json` 中出现 **0 次**，
而 `status: "PASS"`。一个被声明为 `requiredControlRefs` 的门，当前为红，
却在包 exit 工件中完全不可见——违反计划 §2 闸口 2。

**最小修复**：
1. P-C3 的 `redProof.assertion` 改为**分别陈述**生产门与 self-test 的当前状态，
   生产门为红时必须写红，不得以 self-test 结果概括；
2. package-exit 增加 `controlRefStatus[]`，逐条记录 `requiredStandardsRefs` /
   `requiredControlRefs` 的**生产态**退出码，任一非零则 `status` 不得为 `PASS`；
3. 修 `prepareSelfTestClean` 的空壳自造绿（该项本就在 P0 的 P-C1 范围内）。

---

## 2. S / N

### S1 ｜`business` 字段在两个工件中语义冲突

`rm1-u01-package-exit.json` 的 `business = "NOT_APPLICABLE"`（P0 不改业务代码，语义合理）；
run manifest 的 `business.status = "PASS"`（指 standards 执行是否通过）。
**同名字段两义**，且来件描述亦按后者理解。这会让"P0 business 到底是什么状态"无法机械判定。

**最小修复**：run manifest 的字段改名为 `standardsExecution.status`，
`business` 一词仅保留给"业务域变更"语义；或反之，但**必须二选一并全仓统一**。

### N1 ｜`rm1P0HistoricalIntakeHashes` 是硬编码 34 元素集合

`tools/compliance-control/cli.mjs`。此处**硬编码是正确的**——它是一次性冻结例外清单，
可变才是缺陷，与 ST-7 的"分母硬编码"不同类。
**观察项**：建议在该常量旁加不可增长断言与注释（"此集合只可缩小、不可增长；
新增 intake 必须走 fail-closed 路径"），避免未来被误当作可扩展白名单。

### N2 ｜`scripts/check/capability-invariants` 当前 EXIT=1，属预期但未在 exit 中登记

实测输出为 `P3_A_NOT_READY:CAPABILITY_REQUIRED_MISSING:verifyOperationsWorkspaceOtp` 等，
`--self-test` 输出 `RED_INVALID_REQUIREMENT=PASS`、EXIT=0。
**这是诚实的**——skeleton 明确声明 P3-A 未就绪，未冒称完成。
但 package-exit 未登记"该 skeleton 当前为红且属预期"，
读者需自行推断。建议在 exit 中显式记录其 `NOT_READY` 状态与预期性。

### N3 ｜`scripts/check/canonical-performance-ledger` EXIT=0，与 `capability-invariants` 的 `NOT_READY` 形态不一致

P4 的 ledger scanner 当前直接绿，而 P3-A 的 skeleton 走 `NOT_READY` 红。
两个"仅证红能力"的 skeleton 采用了不同的未就绪表达。
**观察项**：需确认前者的绿不是"空扫描零分母"式的绿；
建议统一为 `NOT_READY` 形态，或在 exit 中说明其绿的分母来源。

---

## 3. 逐项亲验通过的部分（不得在整改中回退）

| 核验点 | 结论 | 证据 |
| --- | --- | --- |
| standards-coverage 先验完整分母再精确执行 | **成立** | `scripts/check/standards-coverage:581-584`：`validateCoverage(...)` 在 `executeActive(...)` **之前**无条件执行；`requestedEntries` 对未知 ref 具名红（`ENFORCEMENT_REQUESTED_REF_UNKNOWN`）。fresh 复跑 `--phase R5` → `PASS / RULES=150` |
| 未误纳 P2-owned 聚合 | **成立** | 执行 catalog 含 `scripts/verify --validate-only` 与 gradle `BackendModuleBoundariesTest`，但二者**均不在** P0 的 `requiredStandardsRefs` 内。fresh 复跑 `--execute-active --refs …` 回显恰为声明的 4 个 |
| 四个 standards 门生产态 | **全 PASS** | `database-operation-budget` / `frontend-architecture` / `logging-boundaries` / `security-boundaries` 逐个实跑 EXIT=0 |
| business/cleanup 分离 | **成立** | runner 用 `trap cleanup EXIT` 独立计算 testcontainers 前后差集，与 business 判定解耦；manifest `cleanup: PASS`、前后集合均空 |
| compliance-control 对 RM1-U01 的六维强制 | **成立** | `tools/compliance-control/cli.mjs:367-401`：六个 denominator **数量精确相等**且逐个存在（`RM1_SOURCE_DENOMINATOR_INVALID`）；D1 空集具名红（`RM1_D1_ROUTED_SOURCE_SET_EMPTY`）；D1 每成员 hash 漂移具名红（`RM1_D1_SOURCE_HASH_DRIFT`）；D4 要求 `EXACT_CHANGED_PATH_AND_RECEIPT_SET` |
| 历史 intake recovery 的边界 | **窄且诚实** | 见下方专段 |
| predicate map 未改写冻结 base | **成立** | overlay 为独立文件 `…-r5-cr05-write-channel.json`，`baseMapSha256` 复算与 `contracts/policy/source-compliance-predicate-map.json` 实际值**一致**（`1cb3a5ca…`）；overlay 内 `implementationSha256` 与 `tools/compliance-control/cli.mjs` 当前字节**一致**（`07f25a85…`）。base map 本体未被修改 |
| P3-A/P4 skeleton 不越权 | **成立** | package-exit 的 controls 仅 8 条（P-C1/C2/C3/C5/X2/X5/X6/ST-7），**不含** P-D0/P-E9 等 P3/P4 业务条目；`capability-invariants` 明确输出 `P3_A_NOT_READY` |
| Spring 循环依赖修复手法 | **无规避** | 全仓检索 `@Lazy` / `allow-circular-references` / `allowCircularReferences` / `setAllowCircularReferences` 于 `apps/backend`、`libraries/backend` 的 `*.java`/`*.yaml`/`*.properties`：**命中 0** |
| 硬编码 secret | **已清除** | `test-workspace-rate-limit-secret` / `test-rate-limit-secret` 全仓命中 **0** |
| asset object prefix | **环境派生** | `MinioAssetObjectStorage.java:28` 用 `@Value("${catering.asset.object-storage.bucket}")`；未见 dev 前缀硬编码 |
| 既往设计评审 S2（create-on-existing） | **已闭合** | manifest 中 `disposition:"create"` 且路径已存在的条目 = **0**（此前 16）；`tools/implementation-design-granularity/cli.mjs:1325` 存在红夹具 `RED_FIXTURE_CREATE_PATH_ALREADY_EXISTS=PASS` |

### 3.1 历史 prompt-intake recovery 专项判定：**边界充分，未放松后续规则**

`tools/compliance-control/cli.mjs:821-864` 逐条亲验：

- **集合精确**：`exactStringSetMatches([...rows.keys()], rm1P0HistoricalIntakeHashes)`，
  少一条或多一条均具名红（`RM1_P0_HISTORICAL_INTAKE_SET_DRIFT`）；
  `rm1P0IntakeRecoverySelfTest()` 同时证明 omission 与 extra 两类红。
- **逐条 hash+file-hash 双绑定**：本会话独立复算 **34/34 全部命中**，missing=0，mismatch=0；
  路径必须恰为 `${problemIntakeDirectory}/${promptSha256}.json`，
  且 intake 内 `promptSha256` 必须自洽（`RM1_P0_HISTORICAL_INTAKE_PROMPT_MISMATCH`）。
- **未伪称 NOT_A_PROBLEM**：recovery 文件与 package-exit 中 `NOT_A_PROBLEM` 命中均为 **0**；
  `status` 为 `ONE_TIME_PRE_BASELINE_HASH_ONLY_UNRECOVERABLE`，
  `reason` 明确写明"hook 只存 prompt hash、旧格式未把 hash 绑到源改动，故无法真实归类"——**是诚实的不可归因声明，不是豁免**。
- **current intake 不得被豁免**：`if (excluded.has(current.promptSha256)) throw RM1_P0_CURRENT_INTAKE_EXCLUDED`。
- **清单内已补 disposition 者仍验**：`if (excluded.has(...) && !fs.existsSync(dispositionPath)) continue;`
  —— 只有"在清单内**且**无 disposition"才跳过；一旦补了 disposition 即恢复完整校验。
- **清单外仍 fail-closed**：磁盘 intake 共 **94** 个，清单内 34、**清单外 60**，
  后者全部走 `validateProblemIntakeDisposition` 校验。

**结论：这是一个窄且诚实的一次性例外，没有为后续 intake 规则开口子。**

---

## 4. 若无 M 时应回答的三问（此处按现状回答）

1. **P0 package exit 是否可接受** —— **否**。`status: "PASS"` 建立在
   `affected-l2` 真红被吞（M1）、run manifest 记 PASS（M2）、
   包 exit 对该门零登记且 P-C3 断言不实（M3）之上。
   三条闭合后可接受。
2. **历史 intake recovery 是否边界充分、未放松后续规则** —— **是，充分**。详见 §3.1，
   本项**不构成 finding**。
3. **仍属后续 P3-A/P4、不应被 P0 提前关闭的事项** —— 已正确留在 P0 之外，逐条确认：
   - **P3-A**：`x-required-capability` 的实际绑定（`capability-invariants` 当前正以
     `P3_A_NOT_READY:CAPABILITY_REQUIRED_MISSING:*` 明示未就绪）、scope resolver、
     A1/A2 契约不变量、`testCode` 从 3 controller + 3 wire record 移除、P-D0b/D2/D6/N1/R7/X4。
   - **P3-B**：R-24 的 POST/DELETE 契约与 owner command、receipt 线性化、复合 FK、A3。
   - **P4**：canonical N+1 ledger 的**业务分母**与批量 API、索引、运行时查询预算（E-0'）。
     P0 只证明 scanner 具备验红能力，**不得**据此声称 P-E9 的枚举已完成。
   - **P2**：`affected-l2` 的 **POST** 修正（P-C3-POST）与 `scripts/verify` 聚合——
     P0 只做 PRE，二者必须是不同 receipt、不可合并。

---

## 5. 处置

M1–M3 与 S1 **全部为仓内可机械修复，不涉及产品语义**，
按既有批准边界交 Codex 自主修复，**不构成再授权门槛，不需要 Dexter 产品裁决**。

**再复核条件**：M1（runner 判定语义 + 红夹具）、M2（R-26 `DEFERRED` 落地或 business 如实转红）、
M3（生产态 controlRefStatus + P-C3 断言更正 + `prepareSelfTestClean` 空壳修复）闭合后即可复评。

**本评审不授权**：修改代码、动态业务环境、DEV、seed、reset、migration、Roadmap 状态变更、
下一包（P3-A）开工。
