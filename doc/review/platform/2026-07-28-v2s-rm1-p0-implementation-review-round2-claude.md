---
title: RM1-P0 整改后实现复评（Claude，第二轮）
reviewTarget: IMPLEMENTATION
scope: RM1-P0 ONLY
verdict: GO
findings: M=0 / S=0 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅 P0 implementation review；不授权源码修改、DEV、seed、reset、migration、Roadmap 状态变更或后续 P 启动
createdAt: 2026-07-28
---

# RM1-P0 整改后实现复评

## 0. 结论

**GO**，`M=0 / S=0 / N=3`。

前次 NO-GO 的 **M1、M2、M3、S1 全部真实关闭**，且关闭方式经本会话独立复现与变异验证，
不是"文档改了字"。三条 N 均为观察项，**不阻塞 P0 出包**。

**会话出处**：fresh v2s-rooted 只读会话，非续接、非它仓。仓库零写入（本文件除外）；
全部变异实验在 scratchpad 拷贝上进行，用后即弃。
仓根按本机挂载为 `/Volumes/idea/catering-v2s`（与来件 `/Users/dexter/…` 为同一仓不同挂载）。

**授权边界**：仅 P0 implementation review。不授权源码修改、DEV、seed、reset、migration、
Roadmap 状态变更或后续 P（含 P3-A）启动。

---

## 1. 五个指定核验点的直接回答

| # | 核验点 | 结论 |
| --- | --- | --- |
| 1 | runner 是否对每条 production ref 独立记录并累计非零 exit；首条失败、末条成功仍必须 FAIL | **是**，已独立复现 |
| 2 | `affected-l2` 是否只对 18 个 legacy L2 用 `DEFERRED → RM2`，且三类红具名 | **是**，6 类变异全部精确红 |
| 3 | package-exit 与 manifest 的五条 `controlRefStatus` 是否 exact-set equality 且全零 | **是**，且由 checker 强制 |
| 4 | `business=NOT_APPLICABLE` 与 `standardsExecution=PASS` 是否语义分离 | **是**，且两者**都**被强制 |
| 5 | 是否因复评提前启动 P3-A；P2 aggregate/Flyway 是否仍不属 P0 | **未提前启动**；**仍不属 P0** |

---

## 2. M1 关闭核验 —— runner 判定语义

**owning source**：`scripts/run/rm1-p0-standards-execution:18-33`（`run_checked`）、`:113-133`（逐 ref 调用）、
`:135-140`（累计判定）、`:34-45`（self-test fixture）。

**当前实现**：

```bash
run_checked() {
  local kind="$1" ref="$2"; shift 2
  set +e
  "$@" 2>&1 | tee -a "$log_path"
  local statuses=("${PIPESTATUS[@]}")
  set -e
  local exit_code="${statuses[0]}"                       # 取被测命令，不取 tee
  if [[ "$exit_code" -eq 0 && "${statuses[1]}" -ne 0 ]]; then exit_code="${statuses[1]}"; fi
  execution_results+=("$kind|$ref|$exit_code")
  printf '%s|%s|%s\n' "$kind" "$ref" "$exit_code" >> "$execution_results_path"
  if [[ "$exit_code" -ne 0 ]]; then execution_failed=1; fi   # 累计，不覆盖
  return 0                                                # 不触发 set -e 中断
}
```

四处关键修正逐条成立：
1. `set +e` / `set -e` 包裹，**逃出了 `if` 条件抑制 `set -e` 的语境**；
2. 取 `PIPESTATUS[0]` 而非管道末位（`tee`）的退出码；
3. `execution_failed` 是**累计**变量，后续成功不会清零；
4. 每条 ref **独立一行**写入 `execution_results_path`，并逐条进 manifest。

且 standards refs 改为**逐个** `--execute-active --refs "$standards_ref"`（`:116-118`），
不再一次传入四个——单条失败不会被同批的其他条掩盖。

**独立复现（本会话，scratchpad，未写仓库）**：

```
$ ./scripts/run/rm1-p0-standards-execution --self-test
RM1_P0_RUNNER_FIRST_FAILURE_RED=PASS
RM1_P0_RUNNER_LAST_FAILURE_CONTROL=PASS
RM1_P0_RUNNER_SELF_TEST=PASS          REAL_EXIT=0
```

不采信 self-test，另以等价最小脚本独立重跑同一语义：

```
结果行: FIXTURE|first-failure|1
结果行: FIXTURE|mid|0
结果行: FIXTURE|last-success|0
execution_failed=1  → FAIL
```

**前次反例已被消灭**：`{ false; true; true; }` 的形态现在返回 FAIL。

**反例边界**：`run_checked` 恒 `return 0`，故 `set -e` 不会在中途中止——
这是**有意的**，保证所有 ref 都被执行并记录，而非首个失败即退出。
判定完全依赖 `execution_failed` 累计，逻辑自洽。

**判定：M1 CLOSED。**

---

## 3. M2 关闭核验 —— `affected-l2` 的 DEFERRED 机制

**owning source**：`contracts/policy/affected-l2-registry.json`（`legacyDeferredTestCount`、
`legacyTestDebts`）、`tools/verify-gates/cli.mjs:429`、`:434`、`:444`、`:455-469`。

**registry 现状（本会话独立重算）**：
`legacyDeferredTestCount = 18`，`legacyTestDebts` 实际条数 **18**（相等）；
全部 `(state, deferredUntilPhase)` 集合恰为 `{("DEFERRED","RM2")}`；
**18 个 target 逐个 `os.path.exists` 验证：18/18 确实不存在**——
即 DEFERRED 只用于真实缺失的既有 legacy 项，未覆盖任何已存在目标。

**生产态实跑**：`scripts/check/affected-l2` → `R5_AFFECTED_L2=PASS`、`PHASE=RM1`、
`LEGACY_DEFERRED` 恰列出 18 个，`REAL_EXIT=0`。

**独立变异（scratchpad 拷贝，六类，逐条实跑）**：

| 变异 | 期望 | 实测 reason | EXIT |
| --- | --- | --- | --- |
| A 清单**外**新增缺失 target | 必红，不得被 DEFERRED 吞 | `R5_AFFECTED_L2_TARGET_MISSING:…/NOT-IN-DEBT-LIST.spec.ts` | 1 |
| B `--phase RM2`（到期） | 必红 | `R5_AFFECTED_L2_DEFERRED_EXPIRED:…/authentication.spec.ts` | 1 |
| C 为 deferred target 造空壳文件 | 必红（禁空壳替身） | `R5_AFFECTED_L2_DEFERRED_TARGET_NOW_PRESENT:…` | 1 |
| D 篡改某条 debt 的 `deferredUntilPhase→RM1` | 必红 | `R5_AFFECTED_L2_LEGACY_DEBT_INVALID` | 1 |
| E 删除一条 debt（清单缩水） | 必红 | `R5_AFFECTED_L2_LEGACY_DEBT_INVALID` | 1 |
| F **非** deferred target 变空壳 | 必红 | `R5_AFFECTED_L2_EMPTY_STUB:…/access-recovery.spec.ts` | 1 |

**代码路径完整性**（`cli.mjs:455-469`）——五分支覆盖，无漏网：

```js
if (exists) {
  if (debt) fail("R5_AFFECTED_L2_DEFERRED_TARGET_NOW_PRESENT", test);   // 禁空壳替身
  assertFile(...); isRealL2Test(...); realTargetCount += 1; continue;   // 非 deferred 空壳红
}
if (!debt) fail("R5_AFFECTED_L2_TARGET_MISSING", test);                 // 清单外缺失红
if (phase === debt.deferredUntilPhase) fail("R5_AFFECTED_L2_DEFERRED_EXPIRED", test);
if (changed.length > 0) fail("R5_AFFECTED_L2_DEFERRED_SELECTED_FOR_CHANGE", test);  // 本轮改动选中红
...
if (realTargetCount === 0) fail("R5_AFFECTED_L2_REAL_TARGET_SET_EMPTY");
```

`REAL_TARGET_SET_EMPTY` 是超出要求的一道兜底——**防"全部 deferred 导致零分母空绿"**，
这一条候选 Roadmap 未要求，作者自行加上，登记为优点。

**"当前改动选中"未能在本会话动态验证的边界**：`DEFERRED_SELECTED_FOR_CHANGE` 需要非空
`changed` 集合触发；本会话不做 git 操作，故该分支**以代码路径核验为准**，
标 `VERIFIED_BY_SOURCE_NOT_BY_RUN`。其余五类均为实跑。

**判定：M2 CLOSED。**

---

## 4. M3 关闭核验 —— exit 的生产态记录与断言诚实性

**owning source**：`doc/evidence/platform/rm1/p0/rm1-u01-package-exit.json`（`controlRefStatus`）、
`tools/compliance-control/cli.mjs:476-508`、`tools/verify-gates/cli.mjs:479-495`。

**(a) exact-set equality 与全零 —— 本会话独立复算**：

```
declared manifest : .runtime/managed-runs/rm1-p0-standards-20260728T070240Z-809/manifest.json
declared sha256   : e10a221750061630b2563dcb52ce76a13410933f84c59699ece9c60e247cac1f
actual   sha256   : e10a221750061630b2563dcb52ce76a13410933f84c59699ece9c60e247cac1f   ← 一致
exact set equal   : True   (5 == 5)
全零              : True
```

五条恰为：4 个 `STANDARDS_REF`（`database-operation-budget`、`frontend-architecture`、
`logging-boundaries`、`security-boundaries`）+ 1 个 `CONTROL_REF`（`affected-l2`），exitCode 全 0。

**(b) 由 checker 强制，而非仅写在证据里**（`compliance-control/cli.mjs:487-507`）：
`expected` 从 `rm1.binding.requiredStandardsRefs` / `requiredControlRefs` **派生**（非硬编码）；
`validateEntries` 三重把关——不在 expected 内 / 重复 / **`exitCode !== 0`** 任一即抛；
再做 `receivedByKey.size !== expectedByKey.size` 与逐 key 存在性检查，构成真正的 exact set equality；
最后 exit 与 manifest 两侧交叉比对 `RM1_CONTROL_REF_STATUS_DRIFT`。
manifest 本体的 path + sha256 亦被绑定并做漂移红。

**(c) P-C3 断言已更正为诚实表述**：

> `affected L2 production execution has exact RM1 zero statuses; missing-target, empty-stub,
> RM2-expiry, and selected-change red fixtures passed without creating production target paths`

与前次「all-tree gate … passed」（当时生产门实为 EXIT=1）相比，
现表述**分别陈述生产态与红夹具**，且与本会话实测一致。

**(d) self-test 不再向生产路径写空壳**（`verify-gates/cli.mjs:479-495`）：
`prepareSelfTestClean("affected-l2")` 现在写入**完全合成的 fixture registry**（24 个 `FIXTURE-*` surface）
与一个**真实**的 fixture spec（含 `test(...)`），全部落在 scratch base；
全仓检索 `self-test fixture only` 命中 **0**。M3 的根因（self-test 自造绿）已消除。

**(e) fresh 复跑整链**：

```
$ node tools/compliance-control/cli.mjs validate-package-exit doc/evidence/platform/rm1/p0/rm1-u01-package-exit.json
PACKAGE_EXIT=PASS   PACKAGE_ID=RM1-U01   CHANGED=40
SOURCE_DISPOSITION_ROWS=33   PROBLEM_INTAKES=96   PROBLEM_FAMILIES=19   EXIT=0
```

**判定：M3 CLOSED。**

---

## 5. S1 关闭核验 —— 语义分离

manifest（`schemaVersion: 2`）现为：

```json
"business":            { "status": "NOT_APPLICABLE" },
"standardsExecution":  { "status": "PASS" },
"cleanup":             { "status": "PASS" }
```

package-exit 的 `business` 亦为 `"NOT_APPLICABLE"`，两侧一致。
且 `compliance-control/cli.mjs:484` **同时强制两者**：

```js
|| manifest.business?.status !== "NOT_APPLICABLE" || manifest.standardsExecution?.status !== "PASS"
```

即：把 standards 执行结果误写回 `business` 会红，把 `business` 谎报 PASS 也会红。
前次的"同名两义"已消除。

**判定：S1 CLOSED。**

---

## 6. 边界核验 —— 未提前启动 P3-A；P2 聚合仍在 P0 之外

| 核验 | 实测 |
| --- | --- |
| P0 binding 的 refs | `requiredStandardsRefs` 恰 4 个、`requiredControlRefs` 恰 1 个；`scripts/verify` 出现 **0**，`gradle`/`Flyway` 出现 **0** |
| package-exit 的 controls | 仅 8 条：`P-C1 P-C2 P-C3 P-C5 P-X2 P-X5 P-X6 ST-7`；`P-D0` / `P-E9` / `P3-A` 出现 **0** |
| P3-A skeleton 现状 | `scripts/check/capability-invariants` REAL_EXIT=**1**，输出 `P3_A_NOT_READY:CAPABILITY_REQUIRED_MISSING:*` —— 明示未就绪，**未被本轮推进** |
| P4 skeleton 分母 | `canonical-performance-ledger` 输出 **369 行** derived ledger —— 其绿**不是空扫描**（前次 N3 观察已澄清） |

**判定：边界正确。P2 的 `affected-l2` POST 修正与 `scripts/verify` 聚合仍属 P2，未被 P0 吸收。**

---

## 7. N（观察项，不阻塞）

### N1 ｜`prepareSelfTestClean` 仍保留一处对生产源码的改写路径，当前已是空操作

**owning source**：`tools/verify-gates/cli.mjs:476-477`

```js
const source = "libraries/backend/workspace-iam/.../WorkspaceLoginRateLimitService.java";
writeScratch(base, source, read(source, base).replaceAll('"test-workspace-rate-limit-secret"', 'System.getenv(...)'));
```

**实证**：全仓检索 `test-workspace-rate-limit-secret` 命中 **0**（该硬编码已在 P0 移除），
故此 `replaceAll` 当前是恒等变换，写入的是**未改动的副本**——不构成假绿。

**为何仍值得记**：它是"self-test 改写生产源码"这一形态的**残留通道**，
而 P-C1 的存在理由正是消灭该形态。将来若有人重新引入同名字面量，此处会立刻恢复为真实改写。

**最小修复建议**：删除该 `writeScratch` 分支（改写已无对象），或改为断言式——
若 `replaceAll` 前后内容不等则直接 `fail("SELF_TEST_WOULD_MUTATE_PRODUCTION_SOURCE")`。

### N2 ｜本会话无 Docker，未能端到端复跑完整 runner

`docker info` 不可用，故 `scripts/run/rm1-p0-standards-execution` 的**完整业务路径**
（含 testcontainers 前后集合差分）未在本会话重跑。

已替代验证：`--self-test` 实跑通过；`run_checked` 语义以等价最小脚本独立复现；
五条 `controlRefStatus` 与 manifest hash 独立复算一致；四个 standards 门与 `affected-l2` 生产态逐个实跑。

标记 `UNVERIFIED_BY_FULL_RERUN`——**不构成 finding**，仅作出处披露。

### N3 ｜package-exit 未登记两个 skeleton 的 `NOT_READY` 状态

`capability-invariants` 当前 EXIT=1 属**预期且诚实**（明确输出 `P3_A_NOT_READY`），
intake 亦将此归为 `NOT_A_PROBLEM_FOR_P0_EXIT` 并说明"P3-A 与 P4 skeleton 状态显式非完成、未被本次整改推进"。

**观察**：package-exit 中 `NOT_READY` 出现 **0** 次。
仅读 exit 工件的人无法看出"P0 范围内存在一个已知为红、且属预期的 skeleton"。
建议（可选）在 exit 增一个 `nonBlockingSkeletonStatus[]`，
把两个 skeleton 的当前退出码与预期性显式记录，便于 P8 复核时免于重新推导。

---

## 8. 处置

**无 M、无 S。** 三条 N 均为可选收紧，**不阻塞 P0 出包**，
可在后续包顺带处理或登记 `HANDOFF.md`。

**明确回答三问**：

1. **P0 package exit 可接受** —— `status: PASS` 建立在
   五条生产态 exitCode 全零 + exact-set equality + manifest hash 绑定 + checker 强制之上，
   且 `compliance-control validate-package-exit` 本会话 fresh 复跑 PASS。
2. **历史 intake recovery 边界仍充分** —— 本轮未放宽：`PROBLEM_INTAKES=96`、`PROBLEM_FAMILIES=19`，
   清单外 intake 仍走 fail-closed；intake 将其归为 `NOT_A_PROBLEM_FOR_P0_EXIT` 的理由
   （冻结集合有意不可变）与前次评审判定一致。
3. **仍属后续、不得由本 GO 提前关闭** ——
   **P3-A**：capability 实际绑定（`capability-invariants` 正以 `P3_A_NOT_READY` 明示未就绪）、
   scope resolver、A1/A2 契约不变量、`testCode` 从 3 controller + 3 wire record 移除、
   P-D0b/D2/D6/N1/R7/X4；
   **P3-B**：R-24 的 POST/DELETE 契约与 owner command、receipt 线性化、复合 FK、A3；
   **P3-C**：5 个 `PG-IAM-*` 端点去 pageKey；
   **P4**：canonical N+1 ledger 的**业务分母**、批量 API、索引、运行时查询预算 E-0'——
   369 行 ledger 只是分母产出，**不等于**任何一条 N+1 已修；
   **P2**：`affected-l2` 的 POST 修正（P-C3-POST）、`scripts/verify` 聚合、
   模块搬迁的正分母与 Flyway 前缀对账。

**本评审不授权**：源码修改、DEV、seed、reset、migration、Roadmap 状态变更、
后续 P（含 P3-A）启动。P3-A 的开工需要单独授权。
