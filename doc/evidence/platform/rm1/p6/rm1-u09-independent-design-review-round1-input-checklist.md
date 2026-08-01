# RM1 P6 implementation-facing design：独立对抗审查输入清单（Round 1）

`REVIEW_CYCLE_ID=RM1-P6-IMPLEMENTATION-FACING-DESIGN-20260729`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=1`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

审查者必须先以证伪为目标独立形成 verdict；不得先读作者自评、处置或 Claude handoff。以下文件均为
repository-relative、hash-bound 的必读输入；其中 Roadmap 仅读取 `CURRENT_*`，review 不授权实现。

| 类别 | path | SHA-256 | 已读要求 |
| --- | --- | --- | --- |
| 执行规则 | `AGENTS.md` | `f179f36d8aade8e4cb01def3637aef3a41dc031f79720c4fa13c1a58e3384414` | 全文 |
| Claude handoff 规则 | `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | 全文 |
| 平台边界 | `PLATFORM-BLUEPRINT.md` | `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` | 全文 |
| Registry 入口 | `doc/platform/README.md` | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` | 全文 |
| Registry | `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | 选择 current Roadmap |
| current Roadmap | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `5476287821b966d28fb024ac400de7a6e1a86ff61b76c26a4667dd404d31c938` | 只读 `CURRENT_*` |
| memory index | `project-memory/index.md` | `7b23fa36286900f8d83e892cbc826796d5504fa3406da723456dde52bffbb650` | 全部 kernel |
| deterministic context | `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` | 全文 |
| 独立 review 规则 | `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` | 全文 |
| 业务语料 | `project-memory/decisions/confirmed-business-language-corpus.md` | `51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503` | 检索 P6 词干，记录无命中 |
| 业务语料使用规则 | `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `04d9329413131e369e8c1ea841f172d4c295f953b07b9768a0e597405fd28353` | 全文 |
| 验证治理 | `project-memory/operations/verification-governance.md` | `090e9ce7b6907404103353d69474071b9dc12048f9956e3c05a7847f1397b577` | 全文 |
| review governing decision | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `95b79f7c74a3f867e9fdfef6b9f0d63d9e51e50cb08abc905056307d9423d508` | 全文 |
| P6 design authorization | `doc/decisions/2026-07-28-v2s-rm1-implementation-facing-design-authorization.md` | `441a8855412d29b41dd2e3356fc43430686f3166b727b707aa340e288a033bd3` | 全文 |
| IA-01 | `doc/decisions/2026-07-28-v2s-rm1-ia-01-platform-otp-and-invitation-interaction.md` | `7e2ae73f810b8a7ad75a8f0a8800f873b5ea0c9f582648b8002d5258f6bb3a67` | 全文 |
| IA-02 | `doc/decisions/2026-07-28-v2s-rm1-ia-02-operation-context-interaction.md` | `8d3821c8deaa5a7c0fa460e570b96247842d305daf387d6c59298d2fea442813` | 全文 |
| IA-03 | `doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md` | `88a26ba14ad8f0f4d314eab85f8848f49eb32592dae908edaca932f0fdc45d17` | 全文 |
| IA-04 | `doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md` | `c75dfad9129e5bcf47de70c7bca46187dd5529cb1ba0b607c687a6aa38d7d899` | 全文 |
| IA-05 | `doc/decisions/2026-07-29-v2s-rm1-ia-05-operations-users-recovery-and-home-interaction.md` | `7f2a8f2447eb7b0e40f2556b5f4361e68197e74713c5f5220e8dace7742ad960` | 全文 |
| P6 preparation/ledger | `doc/decisions/2026-07-29-v2s-rm1-p6-interaction-preparation-and-refreeze-design.md` | `d12503842fb9e86afb7688fcdbfab7f54312e7f5ecfa5506e96f6b4e5a06db30` | 全文 |
| 被审详设 | `doc/evidence/platform/rm1/p6/rm1-u09-implementation-facing-design-and-three-phase-plan.md` | `03c8f8005ecd81ed4886f577835b41a8b741bc088fe19a367a57ccc7270ffb85` | 全文 |
| granularity manifest | `doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-granularity-manifest.json` | `f15e38fece98ae01b0213ed1f6ae27008e45adc4988e56144c7fd27f8f39274d` | 全文 |
| standards matrix | `contracts/policy/standards-coverage-matrix.json` | `7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3` | 对应 R5 checklist |
| surface/page-key denominator | `contracts/policy/frontend-asset-carryover-manifest.json` | `6b531d3bba676f5cc24e3121f482f7920abfe0b4c476081c1ce0478a17ee3974` | 22 surface / 25 key 全量对账 |

审查问题：三步边界是否真能避免先画 UI 再猜 owner；P6-1 是否只含契约/后端并先有单测；P6-2 与
P6-3 是否完整覆盖 25 page key 和非 catalog surface；每个停检闸门、六分母与禁止伪修复是否可执行；
是否存在更小且不损失业务语义的替代。任何 finding 须重开 owning source，找反例，分为 M/S/N。
