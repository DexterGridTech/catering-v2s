# TER `kernel.base.contracts` DESIGN review input checklist · Round 2

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | DESIGN |
| REVIEW_CYCLE_ID | TER_KERNEL_BASE_CONTRACTS_DESIGN_20260830 |
| REVIEW_ROUND | 2 |
| REVIEW_ROUND_LIMIT | 2 |
| ROUND_FINAL_DECISION | SELF_DECIDED |
| reviewerKind | INDEPENDENT_SUBAGENT |
| review artifact | `doc/review/platform/2026-08-30-v2s-terminal-kernel-base-contracts-design-review-r2-claude.md` |
| baselineRefresh | YES: parent notified during review that `§4.11` status labels were mechanically normalized; R2 verdict uses refreshed current design SHA below, not the earlier observed design hash. |
| blindReviewDeclaration | PARTIAL_DISCLOSURE: before the final R2 independent verdict, one broad `rg` output accidentally exposed a few `§12` intake lines. I did not read Round 1 review before forming the refreshed R2 judgment; full Round 1 review and full `§12` were read only after the refreshed independent judgment for difference notes. |
| authorMaterialReadAfterIndependentVerdict | true |

## 1. 读取完整性声明

本轮为指定文件写入的 design review；未修改需求、详设、计划、源码、配置、脚本或其他仓内文件。未执行 Git、DEV、reset、seed、L2、UAT、deployment 或动态运行。

## 2. 仓库入口、skill、授权与治理输入

| path | SHA-256 | read status | 用途 |
|---|---:|---|---|
| `.agents/skills/cs-review/SKILL.md` | `5533b184854b47441e41f549a10724cc3ec5b0eea76a7fbf907a4022e34b3c42` | YES | DESIGN 走 Action 1-B；五项 review 动作、verdict block、同根扫描。 |
| `AGENTS.md` | `5caa9b1724eb678dfe5ebb48a96a8290ae8747d36920c072fdc404fa9009dcc6` | YES | v2s entry、授权边界、review hard stop、进度与 Git/Dexter 边界。 |
| `CLAUDE.md` | `5d6ca2f45578c8664b3e8f3743be17c99c1de9c67f764a1382cb89e2219e26c5` | YES | 独立 review、方案合理性、Claude entry 与不可用仓库控制动作。 |
| `PLATFORM-BLUEPRINT.md` | `b5b9b5110c9e7d8642b81ea885cbe8580aef2e1f042c710dc5bce590538f6fe7` | YES | 根契约、owner、运行边界与工程证据分层。 |
| `doc/platform/README.md` | `b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80` | YES | platform entry 与 Roadmap resolver。 |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | YES | `V2S_W0_W4_EXECUTION` active program。 |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | PARTIAL: 授权字段与 current-scope warning | Roadmap 只作授权记录；当前任务以 parent/Dexter 指派为准。 |
| `project-memory/index.md` | `549818b4e90dd17b054710c29f7f3b2e0d2c81cb262e7f624c53e095a25c63e5` | YES | kernel/routed memory navigation。 |
| `scripts/README.md` | `2b950eaf6e508c67406d7a012610a8763b743553c1438e7fb6f300f4a4462a6a` | YES | TER-local/static/managed runner boundary。 |
| `doc/platform/review-standard.md` | `0fbd59cbec9b849b232b522fde390c97867efb17d5d4815e01f9cbfcc7578aaf` | YES | Action 1-B、same-root scan、unverified inventory、verdict shape。 |
| `doc/platform/terminal-coding-standard.md` | `bb0dee642294a141a9fa423d72cd5195f47acd8b009d80d916e5b6b57c05f30c` | YES | TR-05/T-6/TER boundary/gate criteria。 |
| `doc/decisions/templates/implementation-design-template.md` | `7b1b2da048c7761540e58666986382476bc50273e9964f871c21f13f2293ac03` | YES | implementation design required sections and gate shape. |
| `doc/platform/foundation-charter.md` | read | YES | foundation boundaries, gate/scope discipline. |
| `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` | read | YES | solution reasonableness first, UI N/A declaration. |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | read | YES | mechanical gates only; red mutation required. |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | read | YES | Round 2 hard stop, checklist fields, author material ordering. |

## 3. project-memory recall

### 3.1 Kernel 全量读取

| path | SHA-256 | read status | 用途 |
|---|---:|---|---|
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | YES | program/Roadmap/Git boundaries. |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | YES | owner/service boundary; mostly N/A for pure contracts. |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | YES | dependencies and no hidden runtime fallback. |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | YES | independent review, two-round limit, finding intake. |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | YES | evidence tiers, no Git/write/runtime expansion. |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | YES | Heritage read-only; no runtime/build fallback. |

### 3.2 六维 recall 与命中原文

Executed route:

```text
scripts/context/recall-memory --task-kind review --domain platform --consumer-face backend --owner platform --impact governance --trigger task-start
```

Rejected route attempts were recorded for non-supported `consumer-face=terminal` and `owner=terminal`; they were not treated as absence of memory.

| path | SHA-256 | read status | 用途 |
|---|---:|---|---|
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | YES | current bytes over provider/daemon/author claims. |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `9d2903a17c1d71738f530fe00f0abdedf99b2d5370ce6219e63ce1fc082381f1` | YES | independent blind review discipline. |
| `project-memory/operations/verification-governance.md` | `3094cf61cea315208323f7d3f9266f719ea6ca9d828094378ede375dfe9f3005` | YES | severity and gate review discipline. |
| `project-memory/operations/terminal-coding-standard.md` | `a73c18c29f8013e7bedae46c1e39f533a216718d75a5cebe60b0097a8e591a35` | YES | TER standard pointer-only memory. |
| `project-memory/decisions/terminal-architecture-and-stack-rulings.md` | `65e544c180c1b84e8b7d9c9da12f2fd06f8a480be00225179df2b72bcf29ab39` | YES | TER architecture/rulings. |
| `project-memory/decisions/terminal-build-order-and-batches.md` | `1a658ab71001980bd3f1c973cd73a08610e508a9294fbf778cc01e53b8692856` | YES | contracts-first, foundation batch, skeleton limits. |
| `project-memory/pitfalls/analysis-ruler-and-scope-discipline.md` | read | YES | use product-stage ruler and verify only conclusion-changing facts. |

Memory registry quick-pass used `/Users/dexter/.codex/memories/MEMORY.md` lines covering TER skeleton/contract risks: source/declaration exact-set false green, terminal route vocabulary, CP-4 CommonJS/ESM runner failure, and seed/runtime distinction. Those notes were used as risk prompts only, not as verdict authority.

## 4. 被审对象与 refreshed R2 baseline

| path | SHA-256 | read status | 备注 |
|---|---:|---|---|
| `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md` | `6d9614a6bd448120d47d074a16403b72a1a067cbf91688ba4fc6299368a7b0be` | YES | current requirements after T-6 synchronization. |
| `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md` | `31f2da6756b0ac8df91330acbbe26d33c1e2885bf8f99a00e64e615b18bfc886` | YES | **R2 refreshed baseline** after parent notice; verdict uses this hash. |
| `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-plan-codex.md` | `c4ae97a6be4826067180d517b9662fc7df8797d8b1fdb0a0749ed1b25602923d` | YES | implementation sequence and commands. |

## 5. Owning source, tooling, adapters

| path | SHA-256 | read status | 备注 |
|---|---:|---|---|
| `apps/terminal/kernel/base/contracts/package.json` | `636ef3278c373f5c8962378486e9e5ad7c0ee18b23d7023458c92f6392ef800a` | YES | current skeleton package; no target 74 exports yet. |
| `apps/terminal/kernel/base/contracts/src/index.ts` | `b7480428e0003f95ea3c03b84a1c5a5da1e2149155bd4626b408e1148b283962` | YES | current skeleton exports only. |
| `apps/terminal/kernel/base/contracts/src/moduleName.ts` | read | YES | `kernel.base.contracts`. |
| `apps/terminal/kernel/base/contracts/src/dependencies.ts` | read | YES | dependency/devDependency arrays empty. |
| `apps/terminal/kernel/base/contracts/tsconfig.json` | read | YES | current include only `src/**/*.ts`; design plans CP-1 change. |
| `apps/terminal/skeleton-graph.ts` | read | YES | contracts has no outgoing dependencies and is depended on by terminal graph. |
| `tools/terminal-skeleton/check-static.mjs` | read | YES | existing skeleton exact-set/static checker. |
| `tools/terminal-skeleton/check-static.test.mjs` | read | YES | existing red fixture shape. |
| `tools/terminal-skeleton/verify-static.mjs` | `da6681cb697e2e33c9c78870a632f6a0aa7fb897cc28d491a89efa994da7b3f0` | YES | design CP-2 extends this with contracts checks. |
| `tools/terminal-skeleton/verify.mjs` | `30b68c8ca2b259c6a886e80eb942b708faa89c80c1dc18db6f3d556dfe5d88e2` | YES | current test is dry-run; design CP-2 requires true execution. |
| `apps/terminal/adapter/android/{persist-kv,device,app-control,logger,dual-screen}/package.json` | read | YES | CP-3 exact five adapter set. |
| `apps/terminal/adapter/android/{persist-kv,device,app-control,logger,dual-screen}/internal/module_scripts/{test.js,util.js}` | read | YES | CommonJS-in-ESM runner family targeted by CP-3. |

## 6. POC and corpus/sourceRefs

| path | read status | 用途 |
|---|---|---|
| `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/k-01-contracts-claude.md` | YES | POC contracts public surface, errors, params, request, transport and risks. |
| `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/k-03-definition-registry-claude.md` | YES | POC parameter resolver owner and why TER does not add it to contracts now. |
| `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` | YES | definition-registry cancellation, build order, terminal package boundaries. |
| `doc/review/platform/2026-08-27-v2s-terminal-poc-findings-ledger-claude.md` | YES | POC KEEP/FIX/CON ledger. |
| `doc/decisions/` title list | YES | inspected complete title list; only terminal/review/governance entries were relevant for full-text reading. |

Corpus result: `NO_CORPUS_ENTRY_MATCHED` for user/business vocabulary specific to TER `kernel.base.contracts`; business-contract corpus hits are not applicable to this technical root package.

## 7. R2 targeted extraction after baseline refresh

| Check | Fresh result |
|---|---|
| `§4.11` rows | 74 rows |
| `§4.11` unique symbols | 74 unique |
| duplicate symbols | 0 |
| status values | 48 `CONFIRMED`, 25 `UNVERIFIED_TER_NEED`, 1 `UNVERIFIED_TER_NEED · LOCAL_ONLY` |
| empty reason / consumer / status / coverage cells | 0 |
| T-6 current requirement/design/plan | closed discriminant only; invalid-remote resolver behavior future owner; no resolver added to contracts |
| TR-05 A/B/C | 13 `Record<string, unknown>` + 1 `any` mapped to A=7/B=7/C=0 |
| T/F/gates/adapters | unchanged from current design/plan except `§4.11` status-label normalization; no drift found |

