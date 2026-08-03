REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=RM1-U13-C01-ROOT-CONTRACT-REGISTRY-IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=embedded-in-this-artifact
blindReviewDeclaration=Fresh independent reviewer formed findings before any author self-review or disposition.
authorMaterialReadAfterIndependentVerdict=false

# RM1 U13 C01 root contract/registry implementation adversarial review — round 1

## Scope and authorization boundary

Reviewed only `RM1-C01-ROOT-CONTRACT-REGISTRY-U13`: the existing staged-asset release route's root OpenAPI reference and the generator's root-to-route-registry exact-set guard. The permitted outcome is static contract-denominator closure only. This review does not authorize or assert controller/owner/UI behavior, generated-artifact hand edits, DEV, seed/reset, L2, business/cleanup, performance, or Roadmap state.

The selected active program is `V2S_W0_W4_EXECUTION`; its Roadmap reports `CURRENT_STEP=RM1-P6-3`. C01's exact authorization is the amendment and package input listed below. Its source mutation receipt is `exec-efc33815-438f-4785-8e88-3a4b2c020656`: the two only production paths were recorded as `contracts/openapi/edge.openapi.yaml` and `scripts/generate/edge-codegen.mjs`, with current after hashes matching this review.

## 用户任务

业务用户需要一个可信的全 HTTP operation denominator，才能开展后续 coverage/diagnostic 工作，而不能让一个已实现的 platform-admin staged-asset release route 因 root OpenAPI 漏引而从契约分母消失。

## Dexter 立场

Dexter 已将授权严格限定为 C01 的静态 root-contract closure；不得把修复扩大为 handler、owner、UI、运行、seed 或性能改造。

## 替代方案

替代方案是退役 release route 或只把 registry 计数改成 146；均不选。前者无已批准业务依据，后者保留 root/registry 失真。选择单一 root `$ref` 加 tuple exact-set guard，取舍是最小变更且能以真实 red mutation 防回归。

## 方案合理性

问题是契约分母缺口，不是 asset 命令的业务语义。方案直接校验 operationId/method/path/face/owner，复杂度低、收益明确，并且不以减少代码或伪造性能收益为代价。

## UI 与交互

NOT_APPLICABLE：本包无 UI、无用户交互或 Journey 路径变更；它只闭合现有 API 的静态契约分母，不能据此声称 UI 或业务结果。

## 实施代码核验

已重开源码：root OpenAPI、platform workspace shard、`PlatformAssetController`、物理 generated registry 与 `edge-codegen.mjs`。新鲜测试/运行证据为 `scripts/check/edge-codegen`、`scripts/check/openapi-contracts`、`scripts/check/edge-codegen --self-test` 和独立 tuple 重算；业务用户行为不变，故 business result 为 `NOT_APPLICABLE_STATIC_CONTRACT_DENOMINATOR`。

## 审查意见复核

NOT_APPLICABLE：未收到作者 self-review 或 finding disposition；本轮为首个独立 verdict。N-01 仅基于复核 Roadmap、package input、standards matrix 与命令输出的证据；其反例是 package-pinned `R5` coverage PASS，适用边界为 current-phase 证据命名，不建议以更大治理修复或额外成本扩大 C01。

## 闭环核验

静态 closure 已按本报告“Fresh verification”复核；package exit 的 changed-path/incremental-receipt set equality 尚不属于本次独立 review verdict，不能被本报告替代。

## Independent attack result and solution-reasonableness judgment

The smallest viable repair is correct. The shard already declares `releasePlatformStagedAsset`; the controller maps the same POST route; and the generated registry already carries the platform-admin/platform-asset tuple. Retiring or changing this route would alter an approved existing operation without business authority. Adding the one missing root reference plus checking the full tuple set is smaller and directly prevents the confirmed failure family.

I attacked: missing root reference, root reference to the staging (rather than release) fragment, duplicate tuples, root-only/registry-only tuples, stale generated output, and accidental claim that this static gate proves HTTP coverage or performance. The first two mutations are exercised by the generator's scratch self-test and both fail with `R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT`; the current independent recomputation is `147 == 147`, no duplicates, with empty two-way differences.

## Findings

### M — 0

None.

### S — 0

None.

### N — 1

- `N-01` — `scripts/check/standards-coverage --phase RM1-P6-3` fails `UNKNOWN_PHASE`, while this C01 package explicitly binds its standards phase to `R5` and `--phase R5` passes (`RULES=150`). This is a current-control-plane phase naming mismatch, not a defect in the root tuple closure; it must not be used to claim current-phase standards evidence for C01 until the owning scope reconciles it. No governance redesign is proposed here.

## Fresh verification

| Command / independent recomputation | Result |
| --- | --- |
| `scripts/check/edge-codegen` | `PASS`, `FILES=246` |
| `scripts/check/openapi-contracts` | `PASS` |
| `scripts/check/edge-codegen --self-test` | `PASS`; its real red list includes `R5_EDGE_ROOT_ROUTE_REGISTRY_DRIFT` for both missing-root and wrong-fragment mutations |
| `scripts/check/remediation-compliance static-scan` | `PASS`, `MODE=RM1_STATIC_ADMISSION` |
| `scripts/check/standards-coverage --phase R5` | `PASS`, `RULES=150` |
| independent JSON-pointer expansion of root vs physical generated registry | root tuples `147`, registry tuples `147`, duplicate counts `0/0`, `onlyRoot=[]`, `onlyRegistry=[]` |

`scripts/check/standards-coverage --phase RM1-P6-3` was also run and failed only with `UNKNOWN_PHASE`, as recorded in N-01. No dynamic runtime was started; therefore business and cleanup are `NOT_APPLICABLE_STATIC_CONTRACT_DENOMINATOR`.

## Reviewer input checklist (read before conclusion)

| Input | SHA-256 / result |
| --- | --- |
| `AGENTS.md`; `CLAUDE.md`; `PLATFORM-BLUEPRINT.md`; `doc/platform/README.md` | `cf6cbf6bf1ec48b6773831b94ab574af0f30b90a9b277fe87888af1de1345f97`; `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f`; `7e0defd87d9e3c9a3fd2e3ce786fb9d89fe73f9ed45bc270f5e4cbe016762547`; `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` |
| Registry + selected current Roadmap | `doc/platform/roadmap-program-registry.json@f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8`; `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md@d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` |
| `project-memory/index.md` and all six kernels | index `8c8dd6046a589e90aaa3b51244a9b4fa43429e5d74e3c6f89f5effaf196488c6`; kernels `01@f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63`, `02@45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032`, `03@f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44`, `04@1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d`, `05@d0d75e547400145ef7e764d735bc86e2fdaa5ea8a0b19ace213170b527d65a05`, `06@5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| Six-dimension recall | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact governance --trigger task-start` ran; all returned hits read |
| Routed hits | `deterministic-context-only@4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20`; `independent-subagent-adversarial-review@891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf`; `confirmed-business-language-corpus@51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503`; `business-corpus-adoption-and-read-policy@04d9329413131e369e8c1ea841f172d4c295f953b07b9768a0e597405fd28353`; `business-corpus-parked-domain-intake@739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e`; `incremental-compliance-hook@a75469c7eb945b35f06d95cead2e11c368cc4a47dca851f32652556546985f81` |
| Applicable source refs / review governance | `scripts/README.md@1b7c83f93fd5d94b54b895dbf752ab83ac113f9844af54da643b0e8f08ef6235`; service-shape `@ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568`; verification governance `@c9632a65f9eac7678a4be919d980894e3f1e71e5e2e1ddce70ea3c7091d829dc`; independent-review governance `@108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` |
| Corpus search | `GroupWorkspace`, `platform-admin`, `asset`, `release`; `G-01` and `G-10` read. No business meaning was inferred beyond the already approved existing route. |
| Standards matrix and full decision-title inventory | `contracts/policy/standards-coverage-matrix.json@b0519ea0e8691b204fc41f9a481665eaf381e067c1bf4f002b7913171476b149`; `rg -n '^title:|^# ' doc/decisions -g '*.md'` reviewed, then reopened the applicable decisions above |
| Problem/design/authorization inputs | problem family `@dfc701c77f42e4ed9a94906c6a177018b71694b78ea5129a636eb02955af3662`; remediation design `@6255b509df7b5154788563b1b1932b4874ac27da56f868cea83d35f4ab45ed88`; amendment `@cc6ec07b4411746e9f85aa3a6a4e8a07e478ece220acea524a58ce029425f4cc`; package input `@aad3097d82359d9971ad6f9a87ba736c1a7997a87c8ef396738a4718e31725a2`; manifest `@43e2ec9f3d16bd2c008875955ccb23b7fb6267f9a73d867d3e5be18a62a1e0bc` |
| Reviewed production truth | root `contracts/openapi/edge.openapi.yaml@c062a4129ce80a38ee735a3109cb6914b6f820593b37b2caadcdc47c76111b18`; shard `contracts/openapi/paths/platform-admin/group-workspace-management.paths.yaml@a7a3ff9ae40dc37e21bbb321b91afff9f81177640b8d3edeec32fd3e10586107`; controller `PlatformAssetController.java@e01a6668c22ec43d29f28b4285c590ab854ae5fbc39e7d682c59128ef3739f80`; registry `edge-route-face-registry.json@fc1024e91ca289516162aa88fccbc9c3d633cf8844e56f616ea0471b0118babf`; generator `scripts/generate/edge-codegen.mjs@eb3070e5deca18663952170fbc61bf23a5c55a37624655483af41407e767837a` |
| Per-change pre/post readback | current source and focused proofs above re-read; mutation receipt `hook-events/exec-efc33815-438f-4785-8e88-3a4b2c020656.pre.json@93c731de20b2a92e9d6e61eaeec52c63e6d0bd6cfb604e9b5ce6103de9fff290` and `.post.json@9bf131252d8a61ae881edc19195417e7bf2b73c2e8fdf74398a4417013926665` show the exact two-path set and current after hashes |

## 结论

VERDICT=GO

**GO — M=0, S=0, N=1.** The C01 implementation correctly restores the existing root reference and creates a mechanical, real-red exact-set defense between expanded root OpenAPI and generated route registry. This GO is strictly limited to the reviewed static contract-denominator implementation; it is not package-exit closure and does not grant any broader runtime, business, performance, cleanup, or Roadmap authority.
