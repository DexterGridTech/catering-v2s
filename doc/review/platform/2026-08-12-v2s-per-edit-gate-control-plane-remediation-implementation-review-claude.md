# per-edit 门控制面自锁整改：IMPLEMENTATION review（Claude）

- 结论：**GO（M=0 / S=0 / N=2）**
- 会话出处：fresh v2s-rooted 会话，本文件为唯一写入。未运行 Testcontainers / DEV / L2 / reset / seed / 浏览器；仅执行只读命令与 `validate-package-exit`。
- 亲验声明：不采信任何自报数字。ledger 链、六 archetype 分区、六类分母 hash、17-ref catalog、P3 分母均由我独立重算。**过程中我自己的三处判据错误在报出前被纠正**，见 §4。

---

## 1. P0 · bridge 与 durable bootstrap —— **闭合（经验证实）**

最硬的判据是控制面到底解没解锁。实测：

```
$ node tools/compliance-control/cli.mjs print-delta
{ "packageId": "PER-EDIT-GATE-CONTROL-PLANE-REMEDIATION-20260812", "changedPaths": [ … ] }
```

**不再是 `ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID`**，`readActivePackage()` 已恢复。P0 的鸡生蛋确实被解开了。

closure 的六个 `commandSha256` 我**逐个独立复算，全部相符**：

| archetype | command | hash |
|---|---|---|
| `backend-performance-static` | `scripts/check/backend-performance-sql-merge-coverage` | ✓ |
| `backend-source` | `scripts/check/backend-boundaries` | ✓ |
| `frontend-source` | `scripts/check/frontend-architecture` | ✓ |
| `control-plane` | `scripts/check/per-edit-control-plane` | ✓ |
| `design-only` | `scripts/check/per-edit-design-context` | ✓ |
| `runner-evidence` | `scripts/check/per-edit-runner-evidence` | ✓ |

设计评审时这三个 `per-edit-*` adapter 尚不存在，现已建成且带可执行位。

---

## 2. P1 · ledger 与 FAIL receipt —— **闭合**

ledger 目录 `.runtime/compliance-control/package-entry-ledgers/PER-EDIT-GATE-CONTROL-PLANE-REMEDIATION-20260812/`：

| 核验点 | 我的独立重算 |
|---|---|
| 事件总数 | 107 |
| `head.sequence` == 事件数 | ✓ 107 |
| `head.tailHash` == 末条 `entryHash` | ✓ |
| `entryHash` 逐条复算（按实现口径 `JSON.stringify(删 entryHash 的副本)`） | **107/107 相符** |
| `previousEntryHash` 断链 | **0** |
| `postStatus` 分布 | PRE 54 事件 / PASS 50 / FAIL **3** |
| （invocationId, path）配对 | 53 PRE 键 / 53 POST，**孤儿 0、双 terminal POST 0、无 PRE 的 POST 0** |

**FAIL receipt 是真实产生的，不是空设计**——3 条落在 `impl-p2-atomic-001`（2 条）与 `impl-p2-fix-002`（1 条），且都带 `receiptPath`。这正是本次整改要证明的能力：**中间态失败留下可行动证据且流程可继续**。

`validate-package-exit` 实跑：

```
PACKAGE_EXIT=PASS
PACKAGE_ID=PER-EDIT-GATE-CONTROL-PLANE-REMEDIATION-20260812
CHANGED=17
PROBLEM_INTAKES=1  PROBLEM_FAMILIES=1
```

---

## 3. P2 / P3 / hash 绑定

### P2 · 六 archetype exact partition —— **闭合**

- `compatiblePackageArchetypes` 残留 **0**——多对多兼容数组已完全退役
- 顶层 `packageArchetypes` 恰六项；`profileId` 唯一；**archetype 一对一且与全集相等**（我双向验过）
- **17-ref catalog 未被本包破坏**：`standards-enforcement-execution-catalog.json` 17 条与 matrix 的 17 个 ACTIVE ref **双向精确相等**，kind 分区仍为 `VERIFY_CHILD` 15 / `ARCHUNIT_SELECTOR` 1 / `VERIFY_ROOT` 1

### P3 · source-anchor disposition —— **闭合**

- 17 条 anchor，字段齐（`anchorId` / `gateFunction` / `sourcePath` / `sourceAnchor` / `protectedFact` / `disposition` / `replacementOwner` / `redMutation`）
- 分布：`RETAIN_SOURCE_DISCIPLINE` 7 / `MOVE_TO_BEHAVIOR_TEST` 6 / `MIGRATE_DUAL_SOURCE` 4，**无 `PENDING`**
- **我在 DESIGN review 特别要求保住的 canonicalJson fail-closed family，确已保住**，且是三条独立 anchor 全部判 `RETAIN`：
  - `SRC-SAVE-READBACK`：cross-owner canonical readback is parsed fail-closed
  - `SRC-COPY-PREFLIGHT`：copy preflight uses typed canonical readback
  - `SRC-CANONICAL-TRANSPORT`：canonical JSON remains opaque transport

### final gate receipt 绑定 —— **正确**

`exit.finalGateReceipt.sha256` 是字面量 `"RECOMPUTED_AT_VALIDATION"`。**这不是占位漏洞**：`cli.mjs:928` 的 `runFinalExitGate(root, packageState)` **在校验时真实重跑 gate**，`:930` 只比对 `path`。若在 exit 文件里钉死 hash，反而会变成陈旧值。**"不能接受旧 PASS"由重跑保证，不由 hash 保证**，实现与设计 §5.3 一致。

### package authority

`implementationAuthority: true`（本包已获授权）、`runtimeAuthority: false`、`seedResetAuthority: false`、`dynamicEvidence: "NOT_AUTHORIZED_THIS_PACKAGE"`；exit 的 `business` 与 `cleanup` 均 `NOT_APPLICABLE`。**未出现任何动态/业务/性能声明。**

---

## 4. Findings

### N-01｜package-input 的分母 sha256 未标语义，两条与当前字节不符

- **严重度**：N　**状态**：CONFIRMED　**是否阻断**：否
- **owning source**：`doc/evidence/platform/2026-08-12-v2s-per-edit-gate-control-plane-package-input.json`，`sourceComplianceDenominators[]`
- **事实**：单条结构仅 `{id, owner, sha256}`，**无 entry/current 语义字段**。我逐条复算：`AUTHORITY_REQUIREMENT`、`SOURCE_ANCHOR_DISPOSITION`、`PREVENTION_AND_HANDOFF` 相符；**`BOOTSTRAP_CONTROL_SURFACE` 与 `ARCHETYPE_PROFILE_PARTITION` 不符**（二者均在 `changedPaths` 内，包内被合法修改）；`ENTRY_LEDGER_RECEIPT` 的 owner 是 `cli.mjs#validateControlPlaneEntryLedger`——**函数级片段**，整文件 hash 不是其口径。
- **根因**：入口态快照与当前态未分字段，且函数级 owner 的哈希提取规则未声明。
- **反例**：任何遵守「声明 SHA-256 逐个复算」纪律的评审者会撞上两条不符与一条无法复算，**无法区分"包内合法漂移"与"证据陈旧"**——我本轮就撞上了。
- **最小修复**：字段改为 `entrySha256`（或加 `capturedAt: PACKAGE_ENTRY`）；函数级 owner 声明其提取规则（起止锚点或抽取器）。
- **需 Dexter 裁决**：否。

### N-02｜ledger 允许未被引用的 PRE 事件，"orphan PRE 必红"的定义覆盖不到

- **严重度**：N　**状态**：CONFIRMED　**是否阻断**：否
- **owning source**：ledger 目录；`tools/compliance-control/cli.mjs` `findLedgerPreEntryHash`（`:2152`）与链校验（`:2181-2198`）
- **事实**：PRE **事件** 54 个，但唯一 (invocationId, path) 键 **53** 个——`(impl-exit-006, tools/compliance-control/cli.mjs)` 有 **2 条 PRE**。POST 的 `preEntryHash` 只能链到其中一条，**另一条 PRE 不被任何 POST 引用**。
- **根因**：`hookPre` 写 pre receipt 用的是覆盖写而非 no-replace，同一 invocationId 对同一路径二次写入会追加第二条 PRE；而 exit 判据是「每条 changed path **至少存在一个** linked PRE+POST」，故不触发。
- **反例**：设计 §4.4 把「orphan PRE」列为必红项，但其隐含定义是"该 invocation+path 无 terminal POST"；本形态（有 POST，但存在未被引用的 PRE）**逃过该红控制**。
- **影响**：不破坏 exit 不变式，`PACKAGE_EXIT=PASS` 成立；属可观测性与定义精度缺口。
- **最小修复**：把 orphan PRE 精确定义为「`entryHash` 未被任何 POST 的 `preEntryHash` 引用的 PRE」，并补该形态的红变异。
- **需 Dexter 裁决**：否。

---

## 5. 我在本轮自查纠正的三处判据错误（披露，非 finding）

按亲验纪律记录，避免这些误判被当作事实引用：

1. **ledger 链"107 处异常"**——是我用 `sort_keys` 规范化，而实现是 `JSON.stringify(删 entryHash 的副本)` **保插入序**。按真实口径重算后 **107/107 相符、断链 0**。
2. **P3 "canonicalJson family 缺失"**——我按字面 token 检索得 0，实际该族以散文描述记录在三条 `RETAIN` anchor 中。
3. **`finalGateReceipt` 是占位符**——实为校验时重跑，钉 hash 反而错误。

---

## 6. 授权边界

- 本结论仅为**静态 implementation review**，覆盖详设、DESIGN review、控制 CLI、两份 closure、active package、source-anchor disposition、package input/exit 与 entry ledger。
- **静态 `PACKAGE_EXIT=PASS` 不代表动态、业务、cleanup 或性能成功。**
- 未授权也未执行 Testcontainers、DEV、L2、reset、seed、浏览器、UAT、部署、手工 SQL、Git 或产品范围变更。
- 两条 `N` 均在 Codex 既有批准边界内可自主修复，**不阻断本 package 收口**。
