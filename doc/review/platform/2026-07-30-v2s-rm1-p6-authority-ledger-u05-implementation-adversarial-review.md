---
title: RM1 P6-2 U05 authority ledger 独立实施对抗审查
REVIEW_CYCLE_ID: RM1P6-AUTHORITY-LEDGER-U05-IMPLEMENTATION-20260730
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
scope: RM1P6-AUTHORITY-LEDGER-U05 static reconciliation of ST-2, ST-8 and ST-11 only
verdict: NO-GO
findings: M=0 / S=1 / N=1
createdAt: 2026-07-30
---

REVIEW_CYCLE_ID=RM1P6-AUTHORITY-LEDGER-U05-IMPLEMENTATION-20260730
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-07-30-v2s-rm1-p6-authority-ledger-u05-implementation-adversarial-review.md#checked-inputs

# RM1 P6-2 U05 authority ledger 独立实施对抗审查

## 用户任务

业务用户需要平台治理与 carry-over 证据的当前树可复验：ledger 只能把确实存在的 consumer、trace 和
authority source 当作真相，不能因过期 hash 或已迁移路径给出假绿或假红。这个 U05 只处理静态证据
一致性；它不实现或验证任何页面操作、账号、权限或运行期业务用户行为。

## Dexter 立场

Dexter 已授权 RM1 P6-2 内的最小静态修复，并明确要求动态 L2、seed/reset 与 business PASS 不得被
静态证明替代。U05 允许的 production 面是 ledger、checker 和 package evidence；P6-3 UI 与 38-screen
IA/L2 仍是后继串行工作。

## 替代方案

替代方案一是只更新 ST-11 hash，二是让全局 checker 暂时忽略 ST-3，三是把当前前端改回旧 literal
调用形状。第一种遗漏同源 ST-8 及已迁移 ST-2；第二种掩盖全局 control failure；第三种为了测试形状
反向扭曲 production source，均不选。选定方案是 selected-row exact proof 加全局 fail-closed readback，
但必须如实披露未选中行的 global failure。

## 方案合理性

问题本身成立：ST-2、ST-8、ST-11 的 selected-row validator 可机械比较 authority、consumer existence
与 trace exact set，且 scratch 变异确实会失败。代价应止于这些有限证据 bytes。把另一个行的 global
control drift 伪装成 P5 ST-9 debt，或把它修在无授权的 U05 内，都会把边界变复杂并失去归因。

## UI 与交互

NOT_APPLICABLE：理由是 U05 不允许 UI consumer、router、visible copy 或交互 production 写入，也未启动 runtime。
IA-01/02/03 和 38-screen baseline 仅作为边界 readback；本轮不能把 ledger selected-row PASS 说成 Journey、
L2、业务用户行为或 business PASS。

## 审查意见复核

NOT_APPLICABLE：理由是本轮是 fresh independent verdict，未收到 U05 作者 self-review 或 finding disposition，
也没有代写作者 intake。后续作者必须对下列 CONFIRMED finding 重开 owning source、反例与更小修复成本。

## 实施代码核验

已重开实际 production 源码 `authority-ledger.json`、`tools/authority-source-ledger/cli.mjs`、U05 amendment/problem-family/
package input/active package 与 baseline。fresh `check-rows ST-2,ST-8,ST-11` 为 PASS；scratch copy 中将
ST-11 hash 改为 64 个 0 后精确失败 `P1_LEDGER_ROW_INVALID:ST-11`，恢复它并从 ST-2 trace expected set
删除一个路径后精确失败 `P1_LEDGER_CONSUMER_SET_DRIFT:error-code-detail-renderers`。这证明 selected-row
mechanical evidence，而不是业务用户行为。没有编译、L2、DEV、seed 或动态业务运行；业务结果和 cleanup
均为 `NOT_REQUIRED_CONTROL_ONLY`，绝非 PASS。

## 闭环核验

- `node tools/authority-source-ledger/cli.mjs check-rows ST-2,ST-8,ST-11`：PASS。ST-2 当前两个
  workspace-user consumers 与 error-detail trace 一致；ST-8 和 ST-11 authority hash 均为当前 carry-over
  manifest `6b531d3bba676f5cc24e3121f482f7920abfe0b4c476081c1ce0478a17ee3974`；ST-11 两个 trace exact sets
  不变。
- `node tools/authority-source-ledger/cli.mjs self-test-rows`：PASS，包含 selected ST-11 invalid-row red
  mutation 与 scratch cleanup。它是 U05 可用的 red proof。
- `node tools/authority-source-ledger/cli.mjs check`：FAIL，首败为 `P1_LEDGER_ROW_INVALID:ST-3`。
  `WorkspaceAdministrationPage.tsx` 仍从 generated catalog 取得 `workspaceOverviewPage.title`，但经
  `workspaceOverviewTitle` 常量传递；checker 的 ST-3 direct closure 却只接受 source 中的
  `title={workspaceOverviewPage.title}`，所以这是 U04/catalog-consumer 与 ledger-control 的旧形状漂移。
  它不是 ST-2/ST-8/ST-11 failure，也不是 P5-owned ST-9 debt。
- `node tools/authority-source-ledger/cli.mjs self-test` 同样在 initial full validate 先被上述 ST-3 阻断，
  因而不能作为 U05 PASS evidence；其失败没有被掩盖。

## Findings

### S-01｜U05 的全局 ledger/self-test 归因不完整，当前不能把它写成仅 ST-9 的 external debt

**状态：CONFIRMED；阻断 U05 static GO，直到 package evidence 诚实限定。**

U05 amendment/manifest 说 full ledger 保留 P5-owned ST-9 debt，并要求 checker self-test；current bytes
实际先失败 ST-3。ST-3 的 owner 是 U04 catalog-consumer/control compatibility，而非本 U05 selected denominator
或 P5 ST-9。最小修复不是抹平 checker，也不是为 U05 改 UI：在 U05 amendment、manifest/evidence 与 package
exit 明记 global `P1_AUTHORITY_SOURCE_LEDGER=FAIL / P1_LEDGER_ROW_INVALID:ST-3`、`self-test` 因此不可用，
只将 `check-rows` 加 `self-test-rows` 作为 U05 行级 static proof；同时把 ST-3 control compatibility 列为
明确的 U04/后继 owner debt。反例是 selected-row checker 已对 ST-11 hash 与 ST-2 trace mutation 真红，故不应
把 global failure 错归到 U05 rows 或废除其 row proof。

### N-01｜checker 输出的 DIRECT_CLOSURES 标签不能证明本次 selected rows 实际执行了 direct closure

**状态：CONFIRMED；不阻断 selected-row proof。**

`check-rows ST-2,ST-8,ST-11` 固定打印 `DIRECT_CLOSURES=ST-3,ST-4,ST-8`，但 implementation 只有 selected
包含 ST-3 或 ST-4 才调用 `validateDirectClosures`。当前 U05 selected set 不含二者。应在 package evidence
把该行当作 static label，不当作 ST-3/ST-4 direct closure executed 的证据；更小方案是在 receipt 文本中澄清，
无需为一个展示标签扩大 checker 或 package scope。

## 结论

VERDICT=NO_GO。

M=0 / S=1 / N=1。ST-2/ST-8/ST-11 行级当前树 proof 和 red mutation 是成立的，但 U05 当前设计把 global
ledger failure 不完整地归为 ST-9，且要求了被 ST-3 阻断的 full self-test。修正该 evidence boundary 后，
同一 cycle 可进行一次 targeted round 2；不得把 selected-row static PASS 提升为 full P1 PASS、business PASS、
cleanup PASS 或 P6-2 overall closure。

## checked-inputs

| Input | SHA-256 / result | Read result |
| --- | --- | --- |
| `AGENTS.md`; `CLAUDE.md`; `PLATFORM-BLUEPRINT.md` | `e4e3c9af4fb0dc46ce5403edadb6704d1d4a60dea186efc9cbe22dd62fddb347`; `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f`; `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` | READ_FULL |
| Registry + current Roadmap CURRENT_* | `doc/platform/roadmap-program-registry.json` = `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a`; Roadmap = `dde1ef52a134bcb4134ce5b1c42886576a58853bae2593b8b0bb35ad38b8a2cd` | READ_CURRENT |
| Exact authorization | Roadmap CURRENT block: `RM1_P6_2_AUTHORIZED_BY=Dexter`, isolated L2/minimal seed only, reset false | READ |
| All kernels | `project-memory/kernel/01..06` = `f8add1ef`; `45a26072`; `f01d8e4e`; `1f6d9efb`; `d0d75e54`; `5c52b17a` | READ_ALL |
| Six-dimension route | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner platform --impact evidence --trigger review` | RUN; all returned paths reopened |
| Routed memory + source refs | deterministic, independent-review, verification, phase-retrospective, incremental-hook, corpus/read policy and applicable owning decisions | READ_ALL; no provider/daemon |
| Corpus search | `authority ledger`, `carry-over`, `group workspace` | G-01/G-10 read; no business inference used |
| Reviewed U05 object | amendment `f893b063afdd1f482c051c50199447eddaf70ab44b0834cd878763fa6521bd75`; problem family `be5fee23d773916e3c760b59a66af0e646d91ef3f2ab4302fa18f07d3d1a4591`; input `76e15df23bd324fa32bcad13dd58d6075ae9a8e2a312c9edab74a1430bdc0627` | READ_FULL |
| Current source/evidence | ledger `6d97e7a09e5b65aec2fd6de0e05016a1a9341fc032860c99177a08fb7dafafa5`; checker `90ab968ac6b6b5f0db3748fd1f2a49c50b423d0e81c6b251757809e11c70d059`; active package and U05 baseline reopened | READ_FULL |
| IA + upstream frozen inputs | IA-01/02/03, U02 UI baseline, U09 manifest and carry-over manifest `6b531d3bba676f5cc24e3121f482f7920abfe0b4c476081c1ce0478a17ee3974` | READ_BOUNDARY |
| All decisions | `rg '^title:' doc/decisions/*.md` full title inventory; relevant verification, IA and independent-review decisions reopened | TITLES_REVIEWED |
| Standards | matrix `7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3`; `scripts/check/standards-coverage --phase R5` PASS (150) | READ_CHECKLIST |

`BLIND_REVIEW_DECLARATION=Fresh independent subagent first tried to falsify U05 production bytes and formed the above findings before reading any U05 author self-review or disposition; none existed.`

`authorMaterialReadAfterIndependentVerdict=true`: amendment/input/problem-family are scope inputs, not an author verdict;
this artifact does not write author intake.
