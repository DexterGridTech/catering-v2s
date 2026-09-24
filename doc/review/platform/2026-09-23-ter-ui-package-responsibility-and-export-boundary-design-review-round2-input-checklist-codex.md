# 第二轮 DESIGN reviewer 输入清单（无效盲审）

REVIEW_CYCLE_ID=TER_UI_PACKAGE_RESPONSIBILITY_DESIGN_20260923
REVIEW_ROUND=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerAgentId=01a0cc17-90c9-7d93-ac6e-503d6e8c7b15
CHECKLIST_STATUS=INCOMPLETE_AND_BLINDNESS_FAILED

Reviewer 明确区分 `READ_FULL` 与 `PARTIAL/OPEN`；以下只转录其报告，不补造未提供的路径/哈希或“阅读完成”。

| 必需输入 | 仓根相对路径 | SHA-256 / 证据 | 实际状态 |
| --- | --- | --- | --- |
| AGENTS | `AGENTS.md` | `6e67d157e199a2baee8148fa41073f9421eb48ec34e1dde8b78ac1232a1c2679` | READ_FULL |
| Claude 入口 | `CLAUDE.md` | `f08b1fc18e5c1ebbb70056a97a8433c7cf7ad229a5987bafcb0b1e3a367a797a` | READ_FULL |
| 当前授权 | 2026-09-23 直接用户消息 | design/plan/static only | READ |
| registry / Roadmap | `doc/platform/roadmap-program-registry.json` / `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | reviewer 未逐项提供完整哈希/阅读状态 | OPEN_CHECKLIST |
| 六个 kernel | `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | READ_FULL |
| 同上 | `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | READ_FULL |
| 同上 | `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | READ_FULL |
| 同上 | `project-memory/kernel/04-contract-consumer-and-admin.md` | `4c68d6154af8edaf54fc2069f6cdd111433c231ae9df701b3bf94408337dc8bc` | READ_FULL |
| 同上 | `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | READ_FULL |
| 同上 | `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | READ_FULL |
| 六维 recall + 全部 routed hit/source refs | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner frontend-platform --impact governance --trigger task-start` | reviewer 未逐条给路径/哈希 | 原文有读，适用 source refs `PARTIAL/OPEN` |
| 被审需求 | `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md` | `9fca0272f326a9ee56b7182e70d512b38c398d09e28d2a219cbbacc55da8d751` | READ_FULL |
| 被审详设 | `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md` | `9fde426ae6a691376d16f32f0c302dbfadaeb31361dba7490c4b76cb6ba20508` | READ_FULL |
| 被审计划 | `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md` | `70c01400cbef108366894778b836daafd27bfaf1f4e3f335962473ad9324da06` | READ_FULL |
| 旧可读性与键盘上游 | `doc/plans/platform/2026-09-22-ter-ui-business-readability-*.md`、键盘 v2 需求/详设 | reviewer 未列逐文件完整哈希 | `PARTIAL/OPEN` |
| TER 编码规范 | `doc/platform/terminal-coding-standard.md` | `595c39dabb72c6f7ec4f4c7579564032ce1ee81ca999113d43801f4e346d7b03` | READ_FULL |
| 决策标题与相关 decision | `doc/decisions/` 及 solution-reasonableness、independent-subagent、verification-governance、service-shape、business-corpus adoption | reviewer 未逐文件给完整哈希 | 标题/相关全文已读，但 checklist 缺精确记录 |
| 当前五包与两 Android 宿主 owning source | 详设 §4、§5.1 所列 | reviewer 未逐文件列完整哈希 | 核心消费已静态核对，checklist 不完整 |
| 盲审隔离 | 先 verdict，后 Claude review / 作者 intake | 不适用哈希 | **FAILED**：reviewer 自报 verdict 前读到关键行 |

前后双读、design-to-byte 生成物对账在本轮无代码实施/生成物变更，记 `NOT_APPLICABLE_WITH_REASON`；这不豁免盲审或其他硬性输入。本清单不由主 agent 将缺读补成 READ。
