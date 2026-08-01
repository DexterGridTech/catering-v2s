---
title: RM1 P6-2 U06 静态收尾复审（Claude）
reviewTarget: IMPLEMENTATION
scope: U06 静态 source-to-IA conformance、package exit、correction audit current bytes
verdict: NO-GO
findings: M=0 / S=2 / N=1
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态 P6-2 审查；不授权 P6-3 实现、DEV、seed/reset、L2、业务 PASS 或 Git 操作
createdAt: 2026-07-30
---

# P6-2 U06 静态收尾复审

## 0. 结论

**NO-GO**，`M=0 / S=2 / N=1`。

**技术上可验证的部分，我逐项复算，全部干净。** 唯一未闭合的是一项**治理决定**，
按 package 自身的 `knownExitObligation` 就是 Dexter 的裁决，不是我能替他给的。
我确认独立 round-2 的 `S1`，并**追加一条 `S2`**：对"复发"的预防路由回到了刚刚失效的同一类手段。

**这不是凑 GO。** 见 `§3` 的判断。

## 1. 五项核验（独立复算，不采信自报数字）

**① 38 screen / 36 consumer 与 IA、physical contract 一致** —— `CONFIRMED`

- `screenRecords` = **38**，`screenId` 去重 **38**。
- 38 个 screen 展开 **42 条 binding** → 去重 **36 个** focused-test 文件名、
  **36 个** baseline index（0–35，连续无洞）。
- 磁盘上 `platform-admin/src/**/*.test.tsx` 实测 **36 个**；
  与记录声明的 36 个**双向零差**（记录声明但磁盘无 = 0；磁盘有但未被绑定 = 0）。
- 我从 `rm1-u09-physical-screen-import-contracts.md` 独立抽取 consumer 路径含
  `platform-admin/src` 的行并展开 slash 简写，得 **38** 个 platform screen，
  与记录的 38 个 **exact-set，双向差集为空**。
- `basis.prewriteBaselineSha256` 复算 `eea9dafc68b32af4…` **一致**；
  baseline `consumerBindings` n=**36** ✓。

38→36 的多对一是正确形状（4 处两屏共用一个 consumer，故 42 条 binding）。

**② 静态 PASS 未被升级为 business/cleanup** —— `CONFIRMED`，四处独立拒绝

- record `business` = `"NOT_RUN; this record is a static focused conformance admission, not a business result."`
- record `cleanup` = `"NOT_RUN; no managed runtime was started by this record."`
- `bindingInterpretation.focusedProofKind` = "…**it does not claim browser business behavior**"
- `postProofReview.status` = `PASS_FOR_CURRENT_STATIC_SOURCE_CONFORMANCE_ONLY`
- package exit：`business = NOT_APPLICABLE`、`cleanup = NOT_APPLICABLE`，
  `businessReason` 指明 Dexter 的联合 L2 顺序裁决，
  `deferredBusinessEvidenceObligation = JOINT_MANAGED_L2_AFTER_P6_3_IMPLEMENTATION_BY_DEXTER_SEQUENCE_DECISION`

**③ package-exit 闭合** —— `CONFIRMED`

```
actualChangedPaths 89 == incrementalChecks 89   exact-set: True   non-empty: True
acp-only: []   inc-only: []
afterSha256 与当前字节不符: 0（89 条逐条复算）
sourceComplianceDisposition sha256: OK
fullComplianceScan: PASS
controls: CR05-WC-01 / CR05-WC-02 / CR05-HISTORICAL-RECEIPT-RECOVERY /
          U06-38-SCREEN-SOURCE-TO-IA-CONFORMANCE  —— 四条均 ACTIVE_RED_VERIFIED
```

**④ 18 点 correction audit 的诚实性** —— `CONFIRMED`

- `status = CURRENT_SOURCE_REREAD_COMPLETE_NOT_RETROACTIVE`
- `reason` 直书起因："Dexter reported that the author had not followed AGENTS.md pointwise reread discipline.
  The original broad post-proof assertion is therefore **qualified, not silently preserved**."
- `historicalRecordLimit`："It **does not assert a nonexistent historical prewrite or immediate post-proof record**."
- `postProofReview.processDisciplineStatus = HISTORICAL_BATCH_PREWRITE_POST_PROOF_RECORD_INCOMPLETE`，
  并绑定 problem-family id，明写"later current-source reread **does not retroactively create a prewrite record**"
- `points` 实测 **18** 条 ✓

**没有伪造缺失记录，也没有把后补重读说成当时就做过。** 这一点做得对。

**⑤ 是否接受该例外** —— 见 `§4`。

## 2. S1（确认独立 round-2）｜历史逐点双读记录不可被后补证明

**owning source**：`postProofReview.processDisciplineStatus`；
problem-family `F-U06-POINTWISE-REREAD-APPLICATION-RECURRENCE`。

我确认该 S 的**分类正确且不可由技术手段消除**：任何后补工件都只能证明"现在读过"，
无法证明"写之前读过"。当前记录已按此边界如实降级，未越界主张。

## 3. 这项工作解决了什么真问题（Dexter 指令）

**问题是真的**：P6-2 写了 36 个 platform-admin consumer。在此之前，IA 层有 38 个已接受 platform screen，
physical contract 把它们绑到路径——但**没有任何工件证明落地的 `.tsx` 与已接受 IA 相符**。
U06 关的正是这一环，而且是可复算的：38↔36↔36 三向 exact-set，我独立复算全部命中。

**证据不是自证的**：`focusedProof.redEvidence` 记录该 proof **最初是失败的**——
它断言了一个**不存在的** `platformPasswordOtpLogin` operation，重读源码后改为真实的
`sendPlatformLoginOtp` + `verifyPlatformLoginOtp`。
一份能在自己身上抓出错误的 proof，说明它确实在读源码，而不是照抄声明。

**符合项目记忆与设计规范**：`business/cleanup` 四处拒绝升级，与 Dexter 的联合 L2 裁决一致；
problem-family 的九条 finding 各有 owning source 与 prevention destination；
`F-U06-DEFERRED-JOINT-L2-CLOSED-VOCABULARY` 甚至把"延期 L2 的封闭词表"路由到
`compliance-control` 的 `DEFERRED_JOINT_L2_EXIT_DECLARATION_INVALID` 真红——
这是把一次性豁免变成机器可判的词表，方向正确。

**结论：不是凑 GO。** 工作实、证据可复算、越界主张为零。

## 4. S2 ｜对"复发"的预防路由回到了刚刚失效的同一类手段

**owning source**：`rm1p6-ui-ia-conformance-u06-problem-family.json` 的
`findings` 与 `preventionDispositions`。

**反例（同一族三次出现，预防级别未升级）**

| finding | 性质 | preventionDestination |
| --- | --- | --- |
| `F-EXECUTION-CADENCE-AND-POINTWISE-REREAD` | 首次 | **PROJECT_MEMORY**（`implementation-source-reread-discipline.md`） |
| `F-U06-POINTWISE-REREAD-APPLICATION-RECURRENCE` | **复发** | **REVIEW_CHECKLIST** |
| `F-U06-PROGRESS-FORMAT-APPLICATION-RECURRENCE` | **复发** | **PROJECT_MEMORY**（`AGENTS.md` + 同一份 discipline） |

问题在于 problem-family 自己的 `genericProblem` 已经把结论写出来了：

> **A written reread/process rule is not itself evidence that the author applied it to a later remediation batch.**

既然已判定"写下来的规则不构成已执行的证据"，把复发的预防再次路由到
**写下来的规则**（project memory / review checklist），就是用刚被证伪的手段去防同一件事。
按仓内 `verification-governance` 的三问（反复发生、纯机械、维护成本小于返工），
这一条**已经满足"反复发生"**，且其可机械化的那一半并不难。

**最小修复（用已有机制，不新建基建）**：
仓内 `.codex/hooks.json` 的 `PreToolUse` 已对所有工具触发，
`tools/compliance-control/cli.mjs hook-pre` 已在每次写入前落 receipt。
只需让 pre-receipt **额外记录"自上次写入该 path 以来读过哪些 IA/design 文件"**，
即可把"写前是否重读"从**断言**变成**证据**——
既不需要人守纪律，也不需要事后审计去证明一件无法证明的事。
这同时会让 `S1` 在**未来**不再发生（对本次仍不可追溯）。

**是否需要 Dexter 裁决**：否，属既有批准边界内的控制升级；但**建议与 `§5` 的例外一并处置**。

## 5. N1 ｜例外的归属

package 自己的 `knownExitObligation` 写得很清楚：

> Static delivery also remains **NO_GO unless Dexter explicitly accepts** the round-2 historical-process exception.

因此本轮的唯一未闭合项**不是技术问题，而是治理决定**，由 Dexter 持有。

**我的建议：接受该例外**，理由是——
(a) 结果风险已由独立复算闭合（38/36/36 三向 exact-set、89 条 receipt、四条 red-verified control）；
(b) 逐点预读纪律的价值在**预防**，而其预防目标（照记忆/照旧页写）**确实被抓到过一次**
（`redEvidence` 里那个不存在的 operation），说明补偿性控制起了作用；
(c) 该记录**没有伪造**缺失的历史，边界表述准确。

**但建议附两个条件**：
1. 记为**一次性、不构成先例**的例外，并挂到
   `F-U06-POINTWISE-REREAD-APPLICATION-RECURRENCE` 上；
2. **先落 `S2` 的 pre-receipt 升级再进入 P6-3**。这已是同族第三次；
   若这次仍只用文字预防，第四次几乎是可预期的，届时再谈例外就没有依据了。

## 6. 处置

- **`S1`** 分类正确、不可技术消除，**需 Dexter 裁决**（见 `§5`，我建议接受并附条件）。
- **`S2`** 在既有批准边界内，Codex 可自主处置，**建议在 P6-3 开工前完成**。
- 已复算为真的部分**不得回退**：38/36/36 三向 exact-set、baseline hash、
  89 条 changed-path/receipt exact-set 与逐条 afterSha256、四条 ACTIVE_RED_VERIFIED control、
  以及 `business/cleanup` 的四处拒绝升级。
- **本复审不授权**：P6-3 实现、DEV、seed/reset、L2、业务 PASS 或 Git 操作。
  `deferredBusinessEvidenceObligation` 仍然开着，联合 L2 未执行。

---

## 7. Dexter 裁决（2026-07-30，本文件发出后）

Dexter 复核代码后裁定：**代码 OK，P6-2 静态收尾 GO**。

- `S1`（历史逐点双读记录不可追溯）：**Dexter 明确接受该例外**，本文件 `§5` 的建议按其裁决执行。
  按 `§5` 建议，仍记为一次性、不构成先例，并挂在
  `F-U06-POINTWISE-REREAD-APPLICATION-RECURRENCE` 上。
- `S2`（预防路由回到已失效的同一类手段）与本轮其余边界：Dexter 指示
  **"等进入 P6-3 的时候就需要完整的各项约束"**，即 P6-3 开工前须完整满足，
  不再以 P6-2 的静态 GO 顺延。
- 未变更：`business` / `cleanup` 仍为 `NOT_APPLICABLE`；
  `deferredBusinessEvidenceObligation` 的联合 P6-2/P6-3 受管 L2 **未执行**，
  本 GO **不构成** business PASS、L2 PASS 或 P6-3 授权。
