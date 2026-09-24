# 第一轮 DESIGN reviewer 输入清单（补交状态，未达到有效轮要求）

REVIEW_CYCLE_ID=TER_UI_PACKAGE_RESPONSIBILITY_DESIGN_20260923
REVIEW_ROUND=1
reviewerKind=INDEPENDENT_SUBAGENT
reviewerAgentId=01a0cc12-bc16-7682-8e7a-4aa996f33660
CHECKLIST_STATUS=INCOMPLETE

以下状态来自 reviewer 在 verdict 后的主动更正；哈希仅能证明当时文件字节，**不能证明已阅读**。本清单不把补算哈希改写成 verdict 前已读。

| 必需输入 | 仓根相对路径/命令 | SHA-256 / 输出 | reviewer 实际状态 |
| --- | --- | --- | --- |
| AGENTS | `AGENTS.md` | `6e67d157e199a2baee8148fa41073f9421eb48ec34e1dde8b78ac1232a1c2679` | `READ_FROM_PROMPT_BEFORE_VERDICT`，非亲自全文件重开 |
| Claude 入口 | `CLAUDE.md` | `f08b1fc18e5c1ebbb70056a97a8433c7cf7ad229a5987bafcb0b1e3a367a797a` | `HASHED_ONLY/OPEN` |
| registry | `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | `READ_FULL_BEFORE_VERDICT` |
| selected Roadmap | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | `READ_AUTH_FIELDS/OPEN_FULL` |
| exact authorization | 2026-09-23 本轮用户消息 | session directive | 只读到 design/plan/static review，不实施 |
| 全部 kernel | `project-memory/kernel/01..06-*.md` | reviewer 提交了逐文件完整哈希 | `READ_FULL_BEFORE_VERDICT` |
| 六维路由 | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face platform-admin --owner frontend-platform --impact governance --trigger task-start` | output `bb695cacdefc3eb0e03ba9715579b37823015370f8f7640015a8416ad3071697` | `RUN`，16 refs |
| 全部命中原文和适用 source refs | 路由所得 16 refs | 未逐项给路径/哈希 | reviewer 自认 `PARTIAL/OPEN` |
| confirmed business corpus | `project-memory/decisions/confirmed-business-language-corpus.md` | `335fcaff503385b777cab673502f4b343865f47ab1e098c47a139b2bbd374c3d` | 搜索相关词，`OPEN_FULL`；报告 `NO_CORPUS_ENTRY_MATCHED` |
| 被审需求 | `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md` | `9fca0272f326a9ee56b7182e70d512b38c398d09e28d2a219cbbacc55da8d751` | `READ_FULL_BEFORE_VERDICT` |
| 被审详设 | `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md` | `169bebafbcb8d9101fea0dd9f0e6ba1f55ce476c800d5ce46fa97fcc7ba64e05` | `READ_FULL_BEFORE_VERDICT`；仅适用于修订前字节 |
| 被审计划 | `doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md` | `9434bc6ab43011908618076b0410549edec7f11266e925c3a8e19c03d8f61de6` | `READ_FULL_BEFORE_VERDICT`；仅适用于修订前字节 |
| 上游可读性/键盘需求与设计 | `doc/plans/platform/2026-09-22-ter-ui-business-readability-*.md`、键盘 v2/详设 | reviewer 后补完整哈希 | 只读相关节，非全部冻结输入全文 |
| 决策目录及适用全文 | `doc/decisions/` | listing `bcca08d45afcffe6588a3cd973a4909d914f181e7a26ef08472fd1771bc20d19` | 标题已读；若干适用 decision 仅 `HASHED_ONLY/OPEN` |
| TER 编码规范 | `doc/platform/terminal-coding-standard.md` | `595c39dabb72c6f7ec4f4c7579564032ce1ee81ca999113d43801f4e346d7b03` | TR-01/06/12/13 已读，TR-R01/R02/§7.1 `OPEN` |
| verification governance | `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` | `READ_FULL_BEFORE_VERDICT` |
| 前后双读 / design-to-byte | 本轮仅写设计，无代码实施/生成目标 | N/A | 不适用；不能代替上述缺读 |

Reviewer 对五包当前 `src/index.ts`、`package.json`、现有 invariant/publicSurface 和两个 Android host 主要 source 给出 `READ_FULL_BEFORE_VERDICT`，并以 TS AST 复算 71 root、7 path；但硬性入口仍不完整，所以此轮结论不具有治理意义上的 GO 效力。缺失项不是第三轮授权；第二轮须在两轮上限内独立完成。
