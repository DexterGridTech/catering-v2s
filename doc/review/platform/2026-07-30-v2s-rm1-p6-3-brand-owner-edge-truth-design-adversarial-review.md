---
title: RM1 P6-3 brand owner-edge truth corrective design adversarial review
reviewTarget: DESIGN
reviewerKind: INDEPENDENT_SUBAGENT
reviewCycleId: RM1-P6-U15-BRAND-OWNER-EDGE-TRUTH-20260730
reviewRound: 2
reviewRoundLimit: 2
scope: RM1P6-CP-U15-P6-3-BRAND-OWNER-EDGE-TRUTH design-only correction
verdict: GO
findings: M=0 / S=0 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: Static design review only; no production, contract, generated output, runtime, DEV, seed, reset, Roadmap, or repository-control action.
---

# RM1 P6-3 品牌授权 owner-edge truth 独立对抗审查

```text
REVIEW_CYCLE_ID=RM1-P6-U15-BRAND-OWNER-EDGE-TRUTH-20260730
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=先从业务任务、current owner/edge/contract/frontend 独立证伪并形成 provisional verdict；之后才读取 Claude 复审件作差异对照，未读取作者 intake 或处置结论。
authorMaterialReadAfterIndependentVerdict=true
ROUND_FINAL_DECISION=SELF_DECIDED
```

## 1. 业务任务与方案合理性

IA04 / D02-S03 与 G-06 要解决的不是给旧表单换接口，而是让运营管理后台中具总公司维护资格的用户，在总公司详情 Drawer 内读取 owner 确认的当前授权，逐条添加一个可经营品牌或移除一个当前授权；门店仍使用的品牌必须保留，并收到不泄露门店事实的说明。品牌授权不推导门店可见性或门店写权。

最小正确方案是保留四个 declared operations，以 owner 完成候选分页和 in-use typed projection，再用一个非视觉命令适配器与最终 Drawer 承接逐次 resource command/readback。它优于旧 collection replace 或浏览器 diff/循环命令：后两者分别破坏逐条语义，或使幂等键、部分成功和恢复不可判定。

U15 未改变 P6-1/P6-2/P6-3 串行门，且 `implementationAuthority=false`；本审查只判断 future P6-3 详设能否防止实施走偏。

## 2. 输入清单与独立核验

六维 memory route 为 `review/admin-ui/operations-admin/frontend-platform/contract/review`；命中 G-03/G-06，G-06 的不得推导边界已回读。`scripts/check/standards-coverage --phase R5` fresh result: `STANDARDS_COVERAGE=PASS`。

| path | SHA-256 |
| --- | --- |
| `AGENTS.md` | `e4e3c9af4fb0dc46ce5403edadb6704d1d4a60dea186efc9cbe22dd62fddb347` |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` |
| `PLATFORM-BLUEPRINT.md` | `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` |
| `doc/platform/README.md` | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` current block | `5476287821b966d28fb024ac400de7a6e1a86ff61b76c26a4667dd404d31c938` |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `d0d75e547400145ef7e764d735bc86e2fdaa5ea8a0b19ace213170b527d65a05` |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `04d9329413131e369e8c1ea841f172d4c295f953b07b9768a0e597405fd28353` |
| `contracts/policy/standards-coverage-matrix.json` | `7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3` |
| `doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md` | `c75dfad9129e5bcf47de70c7bca46187dd5529cb1ba0b607c687a6aa38d7d899` |
| `contracts/openapi/paths/operations-admin/brand-management.paths.yaml` | `7552a618a656ac4c77afc0661bbb804b64ea8ea7f799a5a3b6e1363abdb08319` |
| `contracts/openapi/paths/operations-admin/head-company-management.paths.yaml` | `1a9d1c85a1f2f3c1d3d6c267651f8eeb543aaf7f9ae2446b8e6915e8133f7f12` |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java` | `ababe80b58bdb79637e88958eae530f670a4afa50cbd7b12882a2adaca96d30d` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsBusinessEntityController.java` | `c803ee86286881b9d2d91410263691da311c32079b2992b995bac4d6aa5707d1` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java` | `4e91dde608ac3217b47bc423a2605a97b61d667e5b0de87854f364a4d7e80283` |
| `apps/frontend/operations-admin/src/features/head-company-management/ui/HeadCompanyManagementPage.tsx` | `9ab94012974b3d98f6fe6244ef26fd8337419d9bc19564a0b6f4a6b3a580a3a1` |
| `apps/frontend/operations-admin/src/tests/architecture/static-boundary.test.mjs` | `8f3bfa8b524442b6e3ef06e2a15940c48eb6dcb2ca5528beaa01faca4e2ced1b` |
| `doc/evidence/platform/rm1/p6/rm1-u09-final-ui-surface-roster.md` | `7cdf232844965ec06cf7dfaf04a6b7fc82ebd276f2096fd34065be2bca0ce652` |
| `doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-granularity-manifest.json` | `3de3c81b2f8f28b679c66ff7958ab01fc9537e1be45d19941fdedccdbaa4bd43` |
| `doc/evidence/platform/rm1/p6/rm1-u09-implementation-facing-design-and-three-phase-plan.md` | `882ab2a51563a1048909c852bb0f34ccd185548b1a965e2d7b8db612b6ed6c5a` |
| `doc/plans/platform/2026-07-30-v2s-rm1-p6-3-head-company-brand-authorization-corrective-design.md` | `de4198f299f2c53b2b15641eb1e3060b17e6166ed1995877e4f626b75d964e71` |
| `doc/evidence/platform/rm1/p6/rm1p6-u15-brand-owner-edge-truth-problem-family.json` | `69de49b9163a8aa3c5f21a45b0855b5ec8746142459c513ef02ba94a3ec0bf5d` |
| `doc/evidence/platform/rm1/p6/rm1p6-cp-u15-p6-3-brand-owner-edge-truth-manifest.json` | `adf517178b3a1da3596ee06903f8f59aceeb94925ed20c88a1fd3ca0d00d1a76` |
| `doc/evidence/platform/rm1/p6/rm1p6-cp-u15-p6-3-brand-owner-edge-truth-amendment.md` | `a460c1b8fbb5c486fe95268ffbed91f4633b17c1200fb5927935c601c25bb0e6` |
| `doc/evidence/platform/rm1/p6/rm1p6-cp-u15-p6-3-brand-owner-edge-truth-package-input.json` | `9ed2eb1739f2a879e59a362668769a9943dcc9c27910760b82ba7b9ca70487e5` |
| `doc/evidence/platform/rm1/p6/rm1p6-cp-u15-p6-3-brand-owner-edge-truth-source-disposition.json` | `d6094c0cb2113f286fff5a64259a92970925a793bb486c08d2bb6665d55adcc3` |

After the independent verdict I read Claude comparison material: `doc/review/platform/2026-07-30-v2s-rm1-p6-frontend-rtk-and-brand-authorization-recheck-claude.md` (`5072c86c40130f7f8e8e601b7189e42ad95c60da7791014bd1609a338fae33e5`).

## 3. Finding

### M1（round 1）— candidate owner-pagination GAP 的 future edge 改动与 focused edge proof 未进 delivery denominator — CONFIRMED，已在 round 2 CLOSED

The corrective design correctly says `GAP-BRAND-CANDIDATE-OWNER-PAGINATION` must close before UI binding: owner returns bounded `items + total`, and edge stops local materialization/filter/sort/page. Yet the corrective slice’s `exactChangeSurfaces` names neither the required edge controller nor a focused edge test:

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsBusinessEntityController.java`;
- a concrete controller test covering the `GET /brands` pass-through.

This is material, not a wording defect. Current `OperationsBusinessEntityController#brands` calls `page(entities.listEntities(...), name, code, status, sort, direction, page, pageSize)`, and its private `page(...)` owns filtering, total and slicing. Changing only the named owner/contract/advice/transport/adapter/Drawer surfaces cannot reach the declared end state. The same manifest identifies this controller as GAP evidence, but omits it from the actual future receipt denominator, so set equality cannot reject its omission.

**Finite scan and counterexample.** The same-root scan found all three current `entities.listEntities(...)` calls in this controller: brand, tenant, head-company. The smaller remedy is not to delete the shared helper or pull all three lists into this slice: add an explicit bounded owner page read for the brand branch, pass that result through in the brand branch only, retain the tenant/head-company branches, and name a focused brand-list controller test. `BusinessEntityService#requireEntities` is not a counterexample because it is a caller-supplied identifier task read with no predicate/total semantics.

**Required design correction.** Add the controller and a concrete focused edge test path to the corrective slice’s exact change surface/receipt denominator. The test must prove the edge passes `name/code/status/sort/direction/page/pageSize` to the owner and returns that exact `items/total`; restoring local `page(...)` must fail. Do not claim it currently closed and do not widen the slice to tenant/head-company remediation.

## 4. N notes and preserved facts

### N1 — previously reported truth gaps are now accurately represented — CONFIRMED

The current roster/plan/detail now call both candidate paging and in-use projection explicit GAPs. Owner throws `HeadCompanyBrandAuthorizationInUseException`; current advice maps its superclass fallback to `PLATFORM_COMMON_VERSION_CONFLICT`. The future most-specific mapping plus safe `errorCode`-only state is correct. Retain it; do not regress to raw `Problem.detail`.

### N2 — IA04 §3 has earlier multi-select wording; §12.2 is the superseding final command model — CONFIRMED

IA04 §3 still contains “多选候选/保存” language, while later §12.2 explicitly requires immediate one-at-a-time add/remove and rejects a multi-select draft. The current P6-3 detail follows §12.2. This is not a product ambiguity or a new scope item, but future author intake should cite §12.2 when describing the final command model.

The precise retired-path denominator is valid (`HeadCompanyManagementPage.tsx` and `static-boundary.test.mjs`). The nonvisual adapter is correctly outside the physical-screen table while roster/granularity bind its sole Drawer consumer, permitted `OperationsTransport` generated-client/error-code boundary, forbidden imports/consumers and focused proof. A fake physical screen row would be a pseudo-fix.

## 5. Verdict

## 6. Round 2 定向复核与最终决定

**核验对象。** 仅重开 M1 所涉及的 granularity corrective slice、P6-3 plan、roster、corrective design 和当前 edge controller。没有读取或改动生产、契约、generated、runtime 或 Roadmap 字节。

**处置证据。**

- `rm1-u09-implementation-design-granularity-manifest.json` 的 `exactChangeSurfaces` 现同时枚举 `OperationsBusinessEntityController.java` 与具体 create-path `OperationsBusinessEntityControllerTest.java`；两者因此进入 future P6-3 package-exit receipt denominator。
- 同一 manifest 的 `GAP-BRAND-CANDIDATE-OWNER-PAGINATION` 明定 exact predicate、owner `items + total`、仅 `#brands` pass-through、controller red mutation，且显式排除 tenant/head-company branches。
- plan、roster 与 corrective design 三处同形：只改 brands branch；test 必须证明完整 predicate pass-through 与 exact owner `items/total`；恢复 edge-local `page(...)` 必须红。当前源码仍显示该 local helper，因此没有把未来义务伪称当前已完成。

**反例复查。** 当前 controller 的 tenant/head-company branch 仍调用 shared local `page(...)`，但修订没有把它们误纳入 P6-3；它们是本 corrective slice 的显式范围外反例，而不是遗漏。`BusinessEntityService#requireEntities` 仍不具 general page/total 语义，不能替代 M1 指定的 owner page read。

**最终 verdict：GO — M=0 / S=0 / N=2。** Round-1 M1 已在详设分母、精确 behavior 和 red proof 三处闭合；N1/N2 仍是必须保留的边界说明，不阻塞 design admission。`ROUND_FINAL_DECISION=SELF_DECIDED` 是本 cycle 的硬停止；后续只可由作者依此做 disposition/Claude review，不得在这个 DESIGN cycle 再开第 3 轮。该 GO 仅代表 U15 static implementation-facing design；不授予 P6-3 implementation，也不越过 P6 serial boundary。

## 用户任务

业务用户是运营管理后台中具总公司维护资格的用户；其用户任务是在总公司详情 Drawer 内维护该公司的可经营品牌：读取 owner-confirmed 当前授权、逐条添加一个品牌、逐条移除一个品牌；若该授权品牌仍被门店使用，保留当前行并得到固定、非敏感的业务说明。该任务来自 IA04 §12.2 与 G-06，不由旧 endpoint 或旧页面反推。

## Dexter 立场

本轮只审 U15 的 P6-3 design-only truth correction。Dexter 已授权纠正详设事实，但没有授权 production、contract、generated output、runtime、DEV、seed/reset 或 Roadmap 变更；P6 的 serial boundary 继续有效。

## 替代方案

不选的较小表面替代是把 edge 当前的全量 `List` + `page(...)` 改称“服务端分页”。它不改变 owner 从未接收 predicate/total 的事实，且会继续在 edge 全量物化。也不选把 tenant/head-company 同时迁入：这会扩大 P6-3 corrective slice。采用的最小方案仅令 brands branch 取得 owner page 结果并原样返回。

## 方案合理性

brands-only owner page pass-through 以最小范围闭合“数据增长时浏览器和 edge 都不全量物化、items/total 同一 owner predicate”的真实业务风险；它不重建前端候选机制、不创建跨 owner 聚合，也不触及其它列表。其复杂度与 IA04 的搜索选择业务收益相称。

## UI 与交互

APPLICABLE：最终交互仍是 IA04 批准的运营管理后台 Drawer：一个 remote searchable enabled-brand Select 加立即添加、现有行的立即移除、关闭。无多选草稿或“保存全部”；owner detail 仍是成功后的真相。页面不显示 technical terms、raw `Problem.detail`、门店标识或数量；typed in-use code 只映射为固定提示。没有更短路径能同时保留逐项幂等、失败恢复和 owner readback。

## 审查意见复核

**Round 1 M1 — CONFIRMED。** owning design source 是 granularity corrective slice：它声明 `GAP-BRAND-CANDIDATE-OWNER-PAGINATION` 必须让 owner 返回 `items + total`、edge 停止 local page，却未把 `OperationsBusinessEntityController.java` 或 GET `/brands` focused edge test 纳入 `exactChangeSurfaces`。反例是当前 controller 的 brands branch：`page(entities.listEntities(...), name, code, status, sort, direction, page, pageSize)`，私有 `page(...)` 仍在 edge 完成 filter/sort/total/slice。最小修法是仅加入 brands controller 及明确的 `OperationsBusinessEntityControllerTest`，并要求 test 证明 exact predicate/items-total pass-through 与 local-page red；不扩 tenant/head-company。

**Round 2 — CLOSED。** 已重开修改后的 manifest、plan、roster、corrective design：四处一致纳入 controller/test，约束仅 `#brands`，且明确 local `page(...)` red 与 tenant/head-company 范围外。M1 因此从 future receipt denominator、精确行为和 red proof 三处闭合。这是较不扩 tenant/head-company 的更小修法，避免为修复单一品牌候选问题引入过度设计和额外成本。

## 闭环核验

静态核验包括：当前 owner/edge/contract/legacy page/test 的 source reopen、同根 `listEntities` 三分支扫描、U15 change-surface 对账、G-06 不得推导边界复读，以及 `scripts/check/standards-coverage --phase R5` 的 `STANDARDS_COVERAGE=PASS`。这是 design-only 结论；尚未、也不声称运行 production 或 dynamic evidence。

## 结论

**GO（M=0 / S=0 / N=2）。** `VERDICT=GO`。Round-1 finding 已在 Round-2 按最小范围关闭。本 review cycle 已由 `ROUND_FINAL_DECISION=SELF_DECIDED` 硬停止；该 GO 仅是静态 implementation-facing design admission，不授予 P6-3 implementation 或跨越 P6 串行门。
