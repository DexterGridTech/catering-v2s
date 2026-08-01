# U06 static implementation independent-review input checklist

```text
REVIEW_CYCLE_ID=RM1-P6-2-U06-STATIC-IMPLEMENTATION-2026-07-30
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_SCOPE=RM1P6-UI-IA-CONFORMANCE-U06 static delivery only
```

## Blind declaration

Fresh v2s-rooted subagent context. I tried to falsify the implementation and formed findings and
verdict before reading any author self-review, author finding disposition, or author-session
summary. `authorMaterialReadAfterIndependentVerdict=false`.

Missing per-change prewrite/post-proof semantic reread is a finding; general preparation, static
controls, and the deferred L2 do not substitute for it.

## All-read context and hashes

| input | SHA-256 | result |
| --- | --- | --- |
| `AGENTS.md` | `82564a7b8eb617958c6f93c8cbdf69c980ad856f9d53ab774f91f1439fd56c2f` | READ |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | READ |
| `PLATFORM-BLUEPRINT.md` | `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` | READ |
| `doc/platform/README.md` | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` | READ |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | READ; active program selected |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `dde1ef52a134bcb4134ce5b1c42886576a58853bae2593b8b0bb35ad38b8a2cd` | READ; `CURRENT_STEP=RM1-P6-2` |
| `project-memory/index.md` and all six `project-memory/kernel/*.md` | `a619f39092f8548c923784aa8f632884572504f04d2dc31906b4c7646137466a` | READ_ALL |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` | READ |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` | READ |
| `project-memory/operations/verification-governance.md` | `0e786e55f19470b96a4dcc132d0a6e8ee889b2bac07c9ce86202879e6e2a7f01` | READ |
| `project-memory/operations/implementation-source-reread-discipline.md` | `82bcb60c31a1779c03a2e0bdec84efc35d5b3de1145016b677591dc0c679a8e8` | READ |
| `contracts/policy/standards-coverage-matrix.json` | `7f59478c3b52aeef571f44a1b8e5e11ab2ddf8038d480fa1d7ac837901fdca70` | READ; phase-R5 PASS |
| IA02 | `doc/decisions/2026-07-28-v2s-rm1-ia-02-operation-context-interaction.md@8d3821c8deaa5a7c0fa460e570b96247842d305daf387d6c59298d2fea442813` | READ_FULL |
| IA03 | `doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md@88a26ba14ad8f0f4d314eab85f8848f49eb32592dae908edaca932f0fdc45d17` | READ_FULL |
| U06 amendment/input/baseline/conformance/reconciliation | `e5e2aa8e2924eb047b2e15f6350832612fa5700d9ccd6d3344f41b1b45df8325`, `20740ad44ddb0ffa1e0d2db75c5a9bf74e87e3cf76e522abf65cec198b418b13`, `eea9dafc68b32af4cc9f06cfb76743f965accd85b251640b701d897ebfbe50cb`, `4c521efb097cf1ff43ca635a695fbdeb7452d480253c311a7e6e602d55d5b511`, `2ffa952c58ba2cb714b1c636e82a76d4493f58a9ae17c03f6008f111067f21e9` | READ_FULL |
| U09 manifest/physical roster/final roster | `cdb3612e11977383e33dfb11f6aff362412d2cd6b88402adbe9881461833a32f`, `7687ed3d7e4d0bddeaac7e5781eaa19cff58be1f379191be1b0f89fa115717a7`, `4f6e108b7241fee586b00408e256bdcb24e29bcc291dcc150e96f90c60efee4e` | READ_FULL |
| `contracts/catalog/admin-catalog.json` | `649e116e8f37664276330f4b3602d8a445a95b7f10d031cb3ce66a34c84bb922` | READ_FULL |
| `.runtime/compliance-control/active-package.json` | `92262c8ac4b76f8f73ae00ef7aabf3b8b138eb4dea2d09716711fdfbc52138e5` | READ_FULL at verdict formation |

## Route and corpus search

`scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner platform --impact evidence --trigger review` was run. Every routed memory and owning source was opened, including verification, business-corpus, source-reread, independent-review, and problem-family governance anchors.

Corpus terms: `groupWorkspaceKey`, `集团空间`, `运维管理后台`, `任职`, `扩展字段`, `操作列`; reopened matches: G-01, G-05/G-07, G-10 in `project-memory/decisions/confirmed-business-language-corpus.md@51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503`.

## Independent commands

| command | result |
| --- | --- |
| `scripts/check/standards-coverage --phase R5` | PASS, 150 rules |
| `scripts/check/remediation-compliance static-scan` | PASS, 30 rules |
| `scripts/check/remediation-compliance validate-source-map` | PASS, 155 rows |
| `scripts/check/remediation-compliance historical-receipt-recovery-self-test` | PASS; red controls and cleanup PASS |
| 36 exact U06 focused Vitest files | 36 files / 36 tests PASS |
| 16 `PLATFORM_ADMIN_OPERATION_IDS` test mapping scan | each maps to screen ID, IA, consumer and physical contract; semantic pre/post read records absent |

