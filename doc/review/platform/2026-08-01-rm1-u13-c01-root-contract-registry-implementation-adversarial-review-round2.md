REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=RM1-U13-C01-ROOT-CONTRACT-REGISTRY-IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerInputChecklist=embedded-in-this-artifact
blindReviewDeclaration=Fresh reviewer re-derived the failure hypotheses from the C01 authorization, current control source and executable proofs before using Round 1 or the author resolution as historical comparison; their conclusions were not accepted as evidence.
authorMaterialReadAfterIndependentVerdict=true

# RM1 U13 C01 root-contract/registry implementation adversarial review — round 2

## Scope and authorization boundary

This final round reviews only the C01 successor-admission bootstrap correction in
`tools/compliance-control/cli.mjs`, plus a regression check of the already-approved root
OpenAPI/generated route-registry exact-set guard.  C01 permits one existing staged-asset release
root reference, the exact-set guard, and the narrowly necessary control-plane admission repair.
It does not authorize a controller, owner, shard-operation, generated-output, UI, DEV, seed/reset,
managed L2, business result, cleanup result, performance claim, or Roadmap mutation.

The root cause is real and bounded: a successor must create a delivery manifest before its package
input can hash-bind and activate that manifest.  The former three-path bootstrap therefore could not
legally create the fourth prerequisite.  Allowing exactly the declared delivery manifest fixes that
deadlock; broadening a document directory or admitting a production path would not be a minimal
repair.

## 用户任务

业务用户需要一个可信的全 HTTP operation contract denominator，且后续 delivery 能在不绕过
审查和 evidence 的前提下合法建立自身 manifest；该用户任务不包含修改现有 staged-asset
release 的业务行为。

## Dexter 立场

Dexter 将 C01 授权限定为最小静态契约 closure 和必要的 control-plane deadlock repair：保留
既有三项 evidence 输入，只允许一个精确 manifest 例外，不能把它变为新的 production、运行或
业务授权。

## 替代方案

替代方案是允许整个 `doc/review/platform/` 或任意文档根作为 bootstrap，或取消 manifest
先于 activation 的绑定。不选：前者扩大可写面，后者丢失审查分母；四个具名路径的 exact set
是以更小代价保留取舍和可验证约束的方案。

## 方案合理性

问题是 successor manifest 的创建死锁，而非 release route 或业务流程的问题。方案只在
admission exact set 增加一个具有独立 review-root 限制的 manifest，复杂度低、收益是恢复
hash-bound activation，代价没有扩展到目录、activation surface 或 production source。

## UI 与交互

NOT_APPLICABLE：理由是本轮不涉及 UI、用户交互或 Journey；仅复核控制面与静态 contract
denominator，不能从此推导用户行为或业务结果。

## Independent attack and result

`successorPackageAdmission()` now requires all four named paths in an exact, duplicate-free set:
the execution binding, implementation amendment, problem-family evidence, and delivery manifest.
Every non-manifest entry must be below `doc/evidence/platform/rm1/p6/`; only the manifest may be
below `doc/review/platform/`; absolute and `..` paths are rejected.  `allowed()` grants bootstrap
write access only by exact membership, not by either directory root.  The subsequent activation
must have the exact predeclared `allowedChangeSurfaces`, the same package ID/execution binding and
RM1 implementation authority; then `currentRM1ExecutionBinding()` reopens and hash-verifies the
input, manifest and amendment.  Thus the new manifest exception neither admits a directory nor
widens the successor's activation surfaces.

The input and amendment remain required, hash-bound activation inputs.  Problem-family evidence
also remains a required fourth-class admission input under the evidence root; it is not itself an
activation surface or an authority grant.  Its semantic suitability stays subject to the existing
problem-family disposition and package-source review rather than being inferred from a path string.

Fresh executable evidence:

| Verification | Result |
| --- | --- |
| `node tools/compliance-control/cli.mjs successor-package-admission-self-test` | `PASS`; the function executes real negative mutations for an extra source bootstrap path, an omitted delivery manifest, a delivery manifest moved to the evidence root, package/unit mismatch, and empty activation surfaces. |
| missing-manifest mutation | `SUCCESSOR_PACKAGE_ADMISSION_BOOTSTRAP_SET_INVALID` (`RED_BOOTSTRAP_MANIFEST_MISSING=PASS`). |
| manifest-root-escape mutation | `SUCCESSOR_PACKAGE_ADMISSION_BOOTSTRAP_SET_INVALID` (`RED_BOOTSTRAP_MANIFEST_ROOT_ESCAPE=PASS`). |
| `scripts/check/edge-codegen --self-test` | `PASS`; its scratch mutations remove the release root reference and redirect it to the staging fragment, each failing with `R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT`. |
| `scripts/check/edge-codegen`; `scripts/check/openapi-contracts`; `scripts/check/remediation-compliance static-scan`; `scripts/check/standards-coverage --phase R5` | all `PASS` (`FILES=246`, static-admission mode, `RULES=150`). |
| independent current tuple expansion | root `147`, registry `147`, duplicates `0/0`, two-way differences empty. |

## Findings

### M — 0

None.

### S — 0

None.

### N — 1

- `N-01 — manifest route vocabulary mismatch`: the C01 delivery manifest declares
  `complianceRoute.owner=platform-asset`, but the deterministic six-dimension recall rejects that
  owner as unknown.  Recalling under the valid governing owner `platform` succeeds and was used for
  this review.  This is pre-existing route metadata, does not relax the bootstrap exception or the
  C01 contract gate, and needs a separate vocabulary/source decision before it is edited; it must
  not be silently treated as a successful `platform-asset` recall.

## 审查意见复核

Round 1 的 current-phase N-01 已由 author resolution 以 package-pinned `R5` standards evidence
处理，本轮不重作范围外治理修复。新增的 route-vocabulary N-01 为 `CONFIRMED`：证据是对
manifest route 的 fail-closed recall 和上位 `platform` route 的成功复核；反例是 bootstrap
和 activation 的 exact-set 检查并不消费该未注册 owner。其适用边界仅为 recall 元数据，
不构成更大 control-plane 重构理由；更小处理是后续由 owning vocabulary/source 决定，而非
在本 C01 verdict 中扩大变更成本或过度设计。

## 实施代码核验

已重开 `tools/compliance-control/cli.mjs` 的 successor admission、activation 和 RM1 binding
源码，以及 root OpenAPI、generator 和 generated registry。已运行 admission self-test、
edge-codegen self-test/check、OpenAPI contracts 与 remediation static evidence；业务用户行为
和 Journey 业务结果保持不变，因此本包仅为静态 contract/control evidence。

## 闭环核验

控制面 owner、exact bootstrap paths、activation-surface equality、input/manifest/amendment
hash binding、root/registry tuple evidence 和本轮 N finding 的适用边界均已复核。动态 business
与 cleanup 不适用，且未以静态证明替代它们。

## 结论

VERDICT=GO

**GO — M=0, S=0, N=1.** The delivery-manifest bootstrap is the smallest legal root-cause repair:
it preserves the three evidence-root prerequisites, adds exactly one review-root manifest path,
keeps exact-set admission and exact activation-surface equality, and has real missing-manifest and
root-escape red mutations.  The C01 root/registry closure remains green.  This verdict is strictly
for the static C01 contract denominator and bounded control plane; it is not package-exit, business,
cleanup, runtime, performance, or Roadmap closure.

## Reviewer input checklist

All inputs below were reopened from the repository root.  The relevant corpus search was
`platform-admin`, `platform-asset`, `release`, and `GroupWorkspace`; G-01/G-10 were read solely to
avoid deriving business semantics from the pre-existing route.  No UI/Journey semantic change is in
scope.

| Input path | SHA-256 / readback |
| --- | --- |
| `AGENTS.md`; `CLAUDE.md`; `PLATFORM-BLUEPRINT.md`; `doc/platform/README.md` | `cf6cbf6bf1ec48b6773831b94ab574af0f30b90a9b277fe87888af1de1345f97`; `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f`; `7e0defd87d9e3c9a3fd2e3ce786fb9d89fe73f9ed45bc270f5e4cbe016762547`; `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` |
| registry and selected Roadmap current fields | `doc/platform/roadmap-program-registry.json@f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8`; `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md@d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` (`CURRENT_STEP=RM1-P6-3`) |
| memory index and six kernels | `project-memory/index.md@8c8dd6046a589e90aaa3b51244a9b4fa43429e5d74e3c6f89f5effaf196488c6`; kernels `01@f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63`, `02@45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032`, `03@f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44`, `04@1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d`, `05@d0d75e547400145ef7e764d735bc86e2fdaa5ea8a0b19ace213170b527d65a05`, `06@5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| valid six-dimension recall | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner platform --impact contract --trigger review`; all routed originals read: deterministic context `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20`, independent review `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf`, HTTP CRUD redlines `15dd44b1f4e8c82e282c48c6db1192fd13d210ff201c8b720090875ca8a4dd76`, business corpus `51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503`, adoption policy `04d9329413131e369e8c1ea841f172d4c295f953b07b9768a0e597405fd28353`, parked-domain policy `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` |
| scripts, standards, review governance, decision-title inventory | `scripts/README.md@1b7c83f93fd5d94b54b895dbf752ab83ac113f9844af54da643b0e8f08ef6235`; matrix `contracts/policy/standards-coverage-matrix.json@b0519ea0e8691b204fc41f9a481665eaf381e067c1bf4f002b7913171476b149`; governance `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md@108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3`; full `doc/decisions` title inventory reread |
| U13 design and problem family | design `doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md@6255b509df7b5154788563b1b1932b4874ac27da56f868cea83d35f4ab45ed88`; family `doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-problem-family.json@dfc701c77f42e4ed9a94906c6a177018b71694b78ea5129a636eb02955af3662` |
| C01 manifest, input and amendment | manifest `doc/review/platform/rm1-u13-c01-root-contract-registry-delivery-manifest.json@49854e96e6396e83c7d6fa981f9336c997852631e6daac8b56bbebf5b651a7d1`; input `doc/evidence/platform/rm1/p6/rm1p6-u13-c01-root-contract-registry-package-input.json@18ee0081dbf9d0d54b3ee244f322f4644250322c41243a71107e603d1efec00e`; amendment `doc/evidence/platform/rm1/p6/rm1p6-u13-c01-root-contract-registry-implementation-amendment.md@0971213edeab3088c0173725ba68009f58e5da4b0a8c195ea16dc01df789b326` |
| reviewed control and contract sources | `tools/compliance-control/cli.mjs@62a5e30775e9b5d81a61031b346d3ba8a76c5b0c4c8b691ef4ac8a9fd66ecb52`; root `contracts/openapi/edge.openapi.yaml@c062a4129ce80a38ee735a3109cb6914b6f820593b37b2caadcdc47c76111b18`; generator `scripts/generate/edge-codegen.mjs@eb3070e5deca18663952170fbc61bf23a5c55a37624655483af41407e767837a`; registry `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json@fc1024e91ca289516162aa88fccbc9c3d633cf8844e56f616ea0471b0118babf` |
| Round 1 and author disposition (historical comparison only) | Round 1 `doc/review/platform/2026-08-01-rm1-u13-c01-root-contract-registry-implementation-adversarial-review-round1.md@70bcbf8703c0d0bd5fc6300584c1aa21435b2c9461f819c52b861d93ccf00e5c`; resolution `doc/review/platform/2026-08-01-rm1-u13-c01-root-contract-registry-author-resolution.md@c53e715dd7b9437f006d297aa8e9d0f7a383952df173e498173afacc4d42b5fc` |
