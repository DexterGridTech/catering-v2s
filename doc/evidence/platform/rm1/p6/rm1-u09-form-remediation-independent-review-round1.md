# RM1 P6 form-remediation independent adversarial review — round 1

```text
REVIEW_CYCLE_ID=RM1-P6-FORM-REMEDIATION-20260729
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist={path:doc/evidence/platform/rm1/p6/rm1-u09-form-remediation-reviewer-input-checklist.md,sha256:a00af391698acea0b4047c0cf84a78f87ccff4ec22bed07e0a4deff43aa135c9}
blindReviewDeclaration=Independent owning-source falsification and verdict were formed before any old audit report, author finding, disposition, or hand-off was read.
authorMaterialReadAfterIndependentVerdict=false
```

## 用户任务

业务用户（平台人员和运营人员）应只修改其业务任务允许修改的事实；业务 owner 必须在同一命令内复核当前对象、关系、版本、状态与授权。G-01/G-02/G-04/G-06/G-07/G-08/G-09 分别排除了把空间推成商业集团、把项目分期当组织节点、把品牌授权推成门店权限、把任职/可见范围混同，或从门店启停推导合同状态。

## Dexter 立场

Dexter 已限定本轮为 P6 详设整改的独立 DESIGN review，目标是以最小改动让既有 R5 形状可审计，而非借整改扩张 Journey、contract、运行或实现范围。Dexter 保有产品语义和 severity 的最终裁决；本 review 只报告可由当前 source 证实的缺口。

## 替代方案

替代方案是继续沿用“24/7/2”的文字计数，只在 IA 表格旁补注释；不选它，因为不能把真实 command、请求、owner 与确认动作逐项对应，仍会漏审。选择一份 source-derived ledger 的取舍是多一份静态表，却避免为凑数新增产品功能或制造更多 gate。

## 方案合理性

字段事实矩阵本身是正确且较小的方向：它比“给现有 Drawer 补字段”更能暴露 immutable fact、动态 items、owner candidate 与未实现 contract。已登记的 Logo、extension、store、contract GAP 没有被 UI 隐藏字段规避，这一点成立。

但该方案的前提是分母能逐个映射到真实 command variant，且每一项所谓 owner recheck 都能由 owner source 证实。当前两项反例使其尚不能作为完整 remediation closure。更小修复不是扩大新功能：重建一个唯一 variant ledger，并把角色编辑的状态事实从通用 update 的请求可写面移除或在 owner 内作 latest equality recheck。

## UI 与交互

`APPLICABLE`。本轮审查的是 platform-admin 与 operations-admin 的创建、编辑、状态确认及本人改密表单。用户操作来自已列明的 Journey/IA，而不是从接口反推；统一分母和状态不可借通用编辑绕过，才能保证用户在详情后的确认路径没有隐含的第二条状态变更路径。未发现需要 Dexter 新裁决的页面语义，但 M-01/M-02 未修复前不得把 UI interaction 标为可实施。

## 审查意见复核

下列 disposition 均以当前源码和设计 source 复核；每条保留反例、适用边界与更小修复，避免把既有 GAP 扩张成无关范围。

### M-01 — `CONFIRMED`: stated 24/7/2 denominator has no exact, internally consistent variant ledger

The reviewed record claims `24 core create/edit variants + 7 status/void confirmations + 2 adjacent security mutations` at `rm1-u09-create-edit-form-remediation-design.md:17`. The current governed matrices instead state:

- IA02 §14: `3 core form variants + 1 status confirmation`;
- IA03 §10: `5 core variants + 2 adjacent security/status variants`;
- IA04 §10: `15 core create/edit variants + 7 status/void confirmations`.

Even under the most charitable reading, the three core counts are `3 + 5 + 15 = 23`, not 24; confirmations are not a seven-item whole-P6 denominator because IA02 separately has one, and IA03 groups two distinct owner paths under one “管理员/角色状态确认” row. The template requires one *real command variant per row*, so that grouping is not a valid substitute. The two self-password operations are separately present in platform and operations edge controllers, whereas IA03 only puts platform self-password in its matrix; the reviewed record never names which two security mutations are in its claimed denominator.

**Why it matters.** A remediation whose finite review denominator cannot be reproduced cannot prove that every form/confirmation/security command was checked. This is a design-governance failure, not merely a count typo.

**Minimal repair.** Add a single source-derived ledger to the reviewed design: one row per actual create/update/status/invalidate/self-password command, with IA anchor, wire request, edge controller, owner method, field-matrix row and disposition. Its exact set must declare whether the target is 23/10/2 or a different count, then update the summary to match. Do not add product functions to reach a preferred number.

**Counterexample boundary.** A visual screen that has no mutation remains out of the ledger. A shared visual status Modal still requires separate rows when it reaches different owner commands.

### M-02 — `CONFIRMED`: IA03 falsely treats role status as a latest owner fact during profile/authorization update

IA03 §10 says the role edit request must return the latest status and that the owner verifies status. Current production sources contradict that assertion:

- `WorkspaceRoleUpdateRequest` exposes `status` in the update request;
- `PlatformWorkspaceRoleController.update` forwards `body.status().name()`;
- `WorkspaceRoleService.update` validates only that the submitted status is `ENABLED` or `DISABLED`, then writes it in the generic update SQL. It does not compare that submitted value to `current.status()`.

Thus a direct update request can alter a role status without the dedicated `transitionStatus` command. The presence of an expected version protects concurrency, not the claimed immutable/latest-status invariant. This is precisely the distinction the form template requires the design to preserve.

**Minimal repair.** Choose one of two bounded designs: (a) remove `status` from the generic update contract and have the controller/owner use the latest owner value internally; or (b) add an owner equality check that rejects any update whose submitted status differs from `current.status()`. Preserve the dedicated status operation for transitions. The former is simpler at the UI boundary; the latter is a smaller immediate contract change if generated wire cannot yet be altered.

**Applicability.** This finding is about role profile/authorization update only. It does not reject the already honest GAPs for contract scope, store immutability, extension keys/definitions or logo staging; those remain correctly declared open conditions.

### N-01 — `CONFIRMED`: the recorded contract/owner GAPs are appropriately honest, but are not closure evidence

Independent reopening confirms that the contract controller calls `ContractCommandService` without a current assignment/data-node authorization input; the service checks store/project coherence but cannot re-evaluate that absent scope. It also confirms that the store edge adapter re-reads relations before calling an owner method whose public signature still accepts and writes those relations, and that the extension controller requires a technical key. Therefore the reviewed design correctly keeps the corresponding GAPs open. They must remain blocking implementation-facing conditions; no new finding or broad redesign is necessary for this round.

## 闭环核验

- Matrix/static governance: `scripts/check/standards-coverage --phase R5` returned `PASS`, `RULES=150` in this review session. It is mechanical trace evidence only.
- Owner-source counterexamples were reopened directly; no dynamic environment, implementation, contract edit, IA edit or old audit/author hand-off was read.
- Business corpus terms and do-not-infer boundaries were applied; no new Journey or product ruling is requested.

## 结论

`VERDICT=NO_GO` — `2 M / 0 S / 1 N`.

This verdict is limited to RM1 P6 form-remediation DESIGN round 1. It does not authorize implementation, runtime, data action, contract change, or a new Journey. A round-2 reviewer may only verify the two bounded repairs after the author has produced source-linked dispositions; it must not reopen scope or create a third review round.

## Blind-review disclosure after verdict

This independent verdict was completed without reading an old audit report, author finding, author disposition, or hand-off. `authorMaterialReadAfterIndependentVerdict=false` is intentional and records that no such material was needed or consulted after the verdict.
