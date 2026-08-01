---
title: R5 修订 implementation-facing design POST_REMEDIATION_V1 recheck（round 3）
reviewCycleId: R5-REVISED-DESIGN-20260726
reviewTarget: DESIGN
reviewKind: IMPLEMENTATION_FACING_DESIGN
verdict: GO
counts: {M: 0, S: 0, N: 2}
supersedes: doc/review/platform/2026-07-26-v2s-r5-revised-design-post-remediation-review-round2-claude.md
reviewSessionProvenance: FRESH_V2S_ROOTED_THIS_SESSION
reviewTargets:
  design: {path: "doc/plans/platform/2026-07-26-v2s-r5-revised-implementation-design-and-plan.md", sha256: "255ba4f1d48cd5bdae8cbbedcc5b1d5d52db1f57d3fe0ffaad77ae61d97ca98f"}
  manifest: {path: "doc/review/platform/2026-07-26-v2s-r5-revised-design-granularity-manifest.json", sha256: "6d42e73101d9c08c1e13e61253fae70fc3de87f8e9008a51a01657b60e09e325"}
  intake: {path: "doc/review/platform/2026-07-26-v2s-r5-revised-design-post-remediation-intake.md", sha256: "586e5360424c1dd18731687bf849ff8e91d89b4690056e65860d2139bd193c9a"}
  reviewRequest: {path: "doc/review/platform/2026-07-26-v2s-r5-revised-design-post-remediation-claude-review-request.md", sha256: "81cb11a9fa7e3312e645ae8e2f5424357e361f8c7891f8e9e7fc67243b67758c"}
  authorization: {path: "doc/decisions/2026-07-26-v2s-r5-revised-design-authorization.md", sha256: "45d91fc8e7c947b1e5f21418e838577c74c59b336b8a26806a5311e7f0d25eac"}
---

# R5 修订 implementation-facing design：POST_REMEDIATION_V1 recheck（round 3）

## 0. 出处披露

本次是 fresh、v2s-rooted 的独立会话内评审，本轮全部核验均在当前会话内亲验完成（源码/JSON/矩阵读取、
grep、独立 Python 交叉比对、三条门 fresh 重跑）。上一轮（round-2，`...review-round2-claude.md`）由本会话
的更早阶段完成，判定 `NO-GO(M=5/S=11/N=9)`；本轮是对该 5 项 M 的第三次受限修订之后的独立复核，不是同一
份文档的续写——本文件是新文件，round-2 文件原样保留供追溯。

## 1. 三条门 fresh 结果

```
IMPLEMENTATION_DESIGN_GRANULARITY=PASS  UNITS=8  FINDINGS=4  VERDICT=NO_GO  REVIEW_ROUND=2
REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
STANDARDS_COVERAGE=PASS  PHASE=R5  RULES=150
CLAUDE_REVIEW_HANDOFF=PASS
```

`VERDICT=NO_GO`/`FINDINGS=4` 是 granularity checker 对**终轮独立盲审**（round-2 adversarial review json，
`NO_GO M=3/S=0/N=1`）字节的机械复现，不是对当前 design 字节的语义判断——`REVIEW_BINDING_MODE=
DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` 正是这个意思：证明 provenance 链完整，且明确当前字节从未被
第 2 轮 reviewer 语义审过，必须由 Claude 亲验。以下核验即该亲验。

## 2. 上一轮（round-2）5 项 M 的逐项复验结果

我逐条重新打开 owning source，不采信 round-2 文档的结论，只信当前字节。

### M-1（placement catalog 只解析 path 层，audit 在 capability/component 层不可解析）→ **CLOSED**

- `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json:57-63`：`operationOverrides`
  显式列出 `getPlatformEntityAuditHistory`→`paths/platform-admin/audit-history.paths.yaml`、
  `getOperationsEntityAuditHistory`→`paths/operations-admin/audit-history.paths.yaml`，capability 均为
  `audit-history`，不再依赖 `familyToOwner` 反查。
- 同文件 `componentFamilyRules` 新增一条：`^(NoBody|NoContent|Problem|EpochMillis|AuditHistory|AuditChange|
  AuditEntity|AuditActor|AuditTarget)$` → `family: "common"`（第 67 行），component 层不再落空。
- 两层（path + capability/component）现在都能对 `audit` 精确解析，不再有 `unresolved: FAIL`。

### M-2（authorization 决策文档仍写 "105"/统一 operation，与 106-拆分设计矛盾）→ **CLOSED**

- `doc/decisions/2026-07-26-v2s-r5-revised-design-authorization.md:21-23` 原文：「Dexter 随后明确裁定按现有
  scalar `face` 模型拆成……104 扩为 **106**，face closure 为 `platform-admin=39`、`operations-admin=56`、
  `public=11`」。与 manifest `candidateJourney.mutations`、design §4、两个 catalog 的 106/39/56/11 完全一致。
- 该文件 sha256 = `45d91fc8e7c9...`，与 manifest `authorization.sha256` 逐字节相等（已核）。

### M-3（legacy audit DROP precondition 对 5 个活跃 writer + 1 个 reader 未处置，`auditSummary` 冻结契约字段无处置）→ **CLOSED**

- 设计文档 `### 5.1` 表格「audit facts」行（design 第 150 行）逐字列出：5 个 writer（
  `OrganizationCommandService`/`BusinessEntityService`/`ContractCommandService`/`PlatformAuthenticationService`/
  `WorkspaceRoleService`）先各自改为 REQUIRED 事务 append 到新建 `audit_event`；`PlatformAuthenticationService`
  的 legacy reader **必须同时改读** `platform_iam.audit_event.action`（排序方式、空值时 `NO_ADMIN_AUDIT_EVENT`
  兜底均写明），以此保持 `PlatformAdminDetail.auditSummary` 的 `required` readback ——**不是删字段，是换 canonical
  数据源**，`contracts/openapi/components/platform-iam/platform-identity.schemas.yaml:106,161` 的
  `auditSummary` required 契约保持不变。
- 精确的失败输出契约：`schema.table,rowCount,writerPath,readerPath`，只有 writer/reader cutover 证实后才允许
  逐表跑 typed precondition，通过后才 drop/recreate；`platform_asset.asset_audit` 因确无 writer/reader 且不在
  12 类浏览闭集内，走 retire 不重建，与我此前的 grep 结果一致。

### M-4（106 不满足 `crosswalkInvariants`，两个 audit operation 无 scenario/pageKey 归属）→ **CLOSED**

- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:6554-6566`：`crosswalkInvariants.
  acceptedNonScenarioOperations` 显式列出两个 audit operationId，各自绑定 `journeyProof`/`interactionProof`，
  理由「adds no thirty-third scenario」；`sharedOperationPageKeyExceptions` 同时给出两者的 `canonicalPageKey:
  "AUDIT-HISTORY-MODAL"` 与各自 `allowedHostPageKeys`（platform 六个宿主详情、operations 六个宿主详情），机制
  与既有 `getPublicAssetContent` 例外一致，不是新发明的漏洞。
- `denominator.operations=106`（该文件第 35 行）、`operationRows=106`（第 6556 行）与两处 face closure 数字一致。

### M-5（`reviewChecklistRef` 字段存在但 13/18 组取值与 matrix 实际 `enforcement.reviewChecklistRef` 矛盾/越权）→ **CLOSED**

我重写了独立 Python 脚本，直接从 `contracts/policy/standards-coverage-matrix.json` 建 `ruleId → enforcement`
查表，逐条核对 manifest 当前 18 组的 `reviewRuleIds`/`notApplicableRuleIds`/`reviewChecklistRef`：

```
total_checked(review)= 104
consistent= 104
mismatches= 0
overclaims(review ids that are machine-kind)= 0
```

104 条被 human-review 的 rule 与 matrix 的 `UNENFORCEABLE_BY_MACHINE.reviewChecklistRef` 完全一致（B.5 组
拆成独立的 `JOURNEY_INTERACTION_REVIEW`，不再是 round-2 发现的、由 Part C 值复制粘贴出来的
`REFERENCE_PATTERN_APPLICABILITY_REVIEW` 误用），`notApplicableRuleIds` 中也无一条被错误标为机器执法。

## 3. 本轮额外抽查（不是 round-2 遗留项，是我这次主动重开的旁证）

- **WORKSPACE_ACCOUNT 双 face 矛盾**（round-2 的 S-2）：`doc/decisions/2026-07-26-v2s-r5-operation-history-
  journey-decision.md:58` 现在明确写 `platform-admin, operations-admin` 双 face；carry-over inventory 第 55/61
  行同步列出两个 face 各自的 audit 挂载。三处一致，**CLOSED**。
- **PLATFORM-WORKSPACE-OVERVIEW 仍未契约化**（round-2 的 S-7 附带项）：implementation catalog 第 6592-6596 行，
  `getPlatformGroupWorkspaceDetail`（既有 104 条之一）通过 `DETAIL_SURFACE_REUSE` 显式复用为该 surface 的落点，
  不新增 operation。**CLOSED**。
- **AuditActor value-only library 边界**：design 第 167-168 行「`AuditActor`、`AuditTarget`、`AuditReadScope`
  与 `AuditChangePolicy` 必须住在新建的 `libraries/backend/audit-contract/` 这个无 schema、无 repository、无
  owner fact 的 value-only API library」；6 个 owner-scoped narrow reader（`readGroupWorkspaceAudit` 等，design
  第 180-185 行）逐条给出宿主鉴权先行、四元组过滤、禁止跨 owner identity join 的约束；`GROUP_WORKSPACE` 的
  merge 边界（第 180 行）具体到 `pageSize+1` 双源探测、内存内 `(occurredAt DESC,sourceRank ASC,eventId DESC)`
  归并、opaque composite cursor，且明确「不以'有界全取'绕过分页」——这是本 cycle 中第一次把 GROUP_WORKSPACE
  的分页归并写到可实施精度。**无新增 finding**。

## 4. N 级（2 条，均为设计卫生问题，不构成 GO 障碍）

| # | 文件/行 | 问题 | 影响 | 最小修复 | 需 Dexter？ |
| --- | --- | --- | --- | --- | --- |
| N-1 | `doc/review/platform/2026-07-26-v2s-r5-revised-design-granularity-manifest.json` — `R5-U03.detailDesign.anchor` 与 `R5-U05.detailDesign.anchor` 均为 `"### 5.1 新增式 migration 规则"` | U03（JSONB/契约项/约束收敛）与 U05（静态资产对象存储）共享同一 detailDesign 锚点；`### 5.1` 一节混排了三类不同 owner 的迁移规则，anchor→unit 不是一一映射，机器可追溯性弱于其余 6 个单元。内容本身不冲突：两个 unit 各自的 `scopeBoundary` 字段已用文字互斥声明。 | 纯追溯精度问题，不影响实施正确性；两个单元的 `changeSurfaces`/`forbiddenPseudoFixes`/`discriminator` 均已按各自范围精确列出。 | 后续可在 `### 5.1` 内拆出 `#### 5.1.1 JSONB/约束`、`#### 5.1.2 静态资产` 子锚点，两个 unit 分别指向子锚点；不需要改内容语义。 | 否，Codex 可在既有授权内自修 |
| N-2 | 本轮未发现新增的第二条 N | — | — | — | — |

（round-2 的其余 N-1~N-9 中，凡我本轮抽查覆盖到的均已随对应 M/S 关闭；未逐条重新复核的历史 N 属已交
Codex 自主处置范围，本轮不重复列出，因为它们从未被判定为 GO 障碍。）

## 5. 方案合理性简评（非闭环正确性）

- **问题对不对**：本轮设计仍然精确对齐 R-11/R-13/R-14 的 Dexter 裁决（106 scalar-face、audit 保留、Modal 而
  非 Drawer），未偏离已确认 Journey。
  **方案优不优**：audit_event 的「先 writer/reader cutover 再 typed precondition drop」相较于「直接假设空表
  硬删」是更保守、更长期正确的方案——这正是 round-2 发现问题后应有的修正方向，而非绕开问题。
  **代价配不配**：`libraries/backend/audit-contract/` 独立 value-only library 是本包新增复杂度中最大的一块，
  但它是防止「audit actor 被下游 owner 重新从 session/credential 解析」这一真实安全风险（问题总册 A 档同类
  风险）的最小必要边界，不是过度设计。

## 6. 授权边界

本次 GO 只裁定 R5 修订 implementation-facing design 是否可交 Dexter 接受；不授权 implementation、runtime、
DEV、seed/reset、contract、migration、app、test、脚本或任何业务源码写入。本 cycle 的两轮独立子 agent 盲审
已达上限，不再召集第三轮 Codex 对抗审查。design 转入实施后，仍需在实施证据完整后做一次 whole-scope
IMPLEMENTATION 复核（R5 红线：不可拆 Journey/模块/文件/App/单项 gate 分别验收）。
