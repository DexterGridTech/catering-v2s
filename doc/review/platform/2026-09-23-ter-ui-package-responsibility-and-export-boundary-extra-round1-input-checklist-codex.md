# TER UI 公共导出边界新增授权轮次 1 输入清单

REVIEW_CYCLE_ID=TER_UI_PACKAGE_RESPONSIBILITY_DESIGN_20260923_DEXTER_EXTRA_TWO_ROUNDS
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
reviewerAgentId=01a0cc2d-f3a4-71e3-bc9d-8969e71878f9
CHECKLIST_STATUS=INCOMPLETE

本表记录审查者在独立 verdict 后自审确认的实际输入，不将哈希视为已读。完整原始路径清单保留在该子 agent 第二阶段输出；本表列出准入项和关键缺口。

| 输入 | path@SHA-256 | 实际状态 |
| --- | --- | --- |
| AGENTS | `AGENTS.md@6e67d157e199a2baee8148fa41073f9421eb48ec34e1dde8b78ac1232a1c2679` | READ_FULL |
| Blueprint | `PLATFORM-BLUEPRINT.md@19ad18338bb6e4b5a443d205db06e80113993dda295a10c2bb10715764dfe396` | READ_FULL |
| Claude entry | `CLAUDE.md@f08b1fc18e5c1ebbb70056a97a8433c7cf7ad229a5987bafcb0b1e3a367a797a` | READ_FULL |
| Registry | `doc/platform/roadmap-program-registry.json@f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | READ_FULL |
| Roadmap | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md@a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | READ_AUTH_FIELDS_ONLY；符合本题入口要求，不冒充全文 |
| Memory index | `project-memory/index.md@2e73aabb4afc18d5f74eb7c9d58ea799303855d09c0a999295e319c362e0d029` | READ_FULL，六个 kernel 已读 |
| Deterministic context | `project-memory/decisions/deterministic-context-only.md@c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | READ_FULL |
| Six-dimension recall | `scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner frontend-platform --impact governance --trigger task-start` | RUN；命中 routed 原文已读；适用 sourceRefs 未全部回读 |
| Requirements | `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md@9fca0272f326a9ee56b7182e70d512b38c398d09e28d2a219cbbacc55da8d751` | READ_FULL |
| Design | `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md@9fde426ae6a691376d16f32f0c302dbfadaeb31361dba7490c4b76cb6ba20508` | READ_FULL |
| Plan | `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md@70c01400cbef108366894778b836daafd27bfaf1f4e3f335962473ad9324da06` | READ_FULL |
| Old plan | `doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md@1d88cf9960863a98a1877acb46403a1af0227b9cf82986b8fd545b6a8e1da60f` | READ_FULL |
| Keyboard v2 requirements | `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md@f2f4868ceb291c792b01d23b373914b338cd027cf5c1bcef479fcf7ca5c6d74f` | READ_FULL |
| Terminal standard | `doc/platform/terminal-coding-standard.md@595c39dabb72c6f7ec4f4c7579564032ce1ee81ca999113d43801f4e346d7b03` | READ_SECTIONS_ONLY；指定条款已读 |
| Review standard | `doc/platform/review-standard.md@6e12ca56b08bb8bd6f47506635986b02ea1de0b1d6753a1db09c5757792766e6` | READ_FULL |
| Verification governance | `doc/decisions/2026-07-24-v2s-verification-governance.md@6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` | READ_FULL |
| Implementation design template | `doc/decisions/templates/implementation-design-template.md@ecd088315feef1048d10ecb699e2939aebbcf72f2fb8aeb926d1a74c5b87d14b` | PARTIAL_TRUNCATED |
| IA template | `doc/decisions/templates/ia-design-template.md@f93c9edf545fc458fd933a5cba97f31e1272b7ae6e428ae6d6695f0cf92c5c6a` | PARTIAL_TRUNCATED |
| Interaction template | `doc/decisions/templates/ui-interaction-design-template.md@87e78e6e7db1cf01e6d0bd073d91321b5a604576a2cfdf347544cd70b603d781` | PARTIAL_TRUNCATED |
| Journey template | `doc/decisions/templates/journey-decision-template.md@66c57c114333d072fab29f17bff9ad40345a6ae1e8ba96de2bf959aa23996da6` | PARTIAL_UNCERTAIN |
| Related decisions | `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md@ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568` | HASHED_NOT_FULL_READ；相关性未充分裁定 |
| Five packages and Android hosts | 五包 `src/index.ts`、`package.json`、`terminal-invariants.json`、`README.md`、现存三份 `publicSurface.test.ts`；两 Android 宿主 `App.tsx`、`platformPorts.ts`、`dependencies.ts`、`metro.config.js` | READ；审查者原始回复有逐文件 64 位 SHA；member/staff publicSurface 文件不存在 |
| Corpus | `project-memory/decisions/confirmed-business-language-corpus.md@335fcaff503385b777cab673502f4b343865f47ab1e098c47a139b2bbd374c3d` | READ_FULL；词干检索结果 `NO_CORPUS_ENTRY_MATCHED` |
| Author materials | 同题 Claude requirements review/intake 与历史两轮 review/checklist | 仅在独立 verdict 后读取；不补足 verdict 前缺失的输入 |

First failure：适用 sourceRefs 未逐项回读，部分模板输出截断；审查者在第二阶段主动更正。Last known good：盲审顺序成立、三份被审对象和五包主要源码已读。Broken boundary：最小输入完整性。不得把初步 `GO_WITH_UNVERIFIED_UI` 当有效结论。
