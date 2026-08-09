# 后台性能重构详设｜Claude 定向复核请求

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN_RECHECK  
REVIEW_STATUS=POST_REMEDIATION_BYTES_UNREVIEWED  
IMPLEMENTATION_AUTHORITY=false

## 背景

本轮仅修订后台性能重构的 implementation-facing 详设，不实施代码、不运行环境。Claude 前次设计复核提出 C5、B.6.6、C2/C3、预算门和 scope-kind 的 NO-GO finding；Dexter 同时要求 SQL 合并设计覆盖两份 generated route registry 的全部 196 operation，并明确禁止两个极端：不能为每个接口各设计一份专属 SQL，也不能建立跨 owner 的全局查询总线。

Codex 已将修订限定为：owner-local 的有限 typed fact loader / batch judgment，由各 operation adapter 静态声明适用关系；operation 仍保有自己的业务主查询、revision/CAS、readback 和 owner 边界。当前所有实现、运行、DEV、reset/seed 与 L2/UAT 均未获授权。

## 目标

请判断此版本是否能申请后续 implementation authorization：它应当既能减少已证明的数据库往返，又不能因为“合并 SQL”删除 authorization、对象事实重核、receipt replay、CAS、审计、必要 readback 或 module owner sovereignty。

## 必读输入（仓根相对路径）

- `doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md`：本轮仅 design-only 的授权边界。
- `doc/review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md`：问题现象、计量口径与根因边界。
- `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md`：已接受方向，重点第 14 章 SQL-M1～M6。
- `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md`：当前详设，重点 `BP-U07`、`B=78`、门处置与抽象边界。
- `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-operation-coverage-initial.md`：196 行初版覆盖矩阵和证据状态。
- `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-claude-recheck-intake.md`：本轮所有 finding 的 author disposition。
- `doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json`：7 个 delivery unit、post-remediation binding 与 source hash。
- `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-recheck-claude.md`：前次 NO-GO 原文。

## 独立核验重点

1. **抽象层级是否正确**：SQL-M1～M6 是否只允许 owner-local、typed、有限的事实 loader / 批量 judgment；是否同时明确禁止 endpoint-special SQL、global query bus、service locator、动态 registry 和万能 `RequestFacts`。请特别检查 operation 是否只是静态声明适用抽象与 typed input，而不是运行期按 operationId 查 SQL。
2. **196 行分母是否真实**：矩阵是否仅从两份 generated registry 重建；是否正确区分 `MEASURED_SEED=55`、`MEASURED_HISTORICAL=105`、`UNMEASURED_BLOCKS_OPTIMIZATION=36`；两个 seed report 仅有 54 endpoint group、而第 55 条来自实际 `db-operations.jsonl` 的说明是否诚实；未测 GET 应为 15，且都阻断 B=78。
3. **C5/B.6.6 是否闭合**：两个 session selection POST 是否已进入既有 74 条 normal command baseline、没有新增第 80 条；可见范围 snapshot 是否包含真实 node/store/head-company/scope facts 而非只有 candidate list；B=78 是否固定为 request-scope 计数、一次 ReadContext、内存授权和 primary SQL EXISTS，且永久例外上限为 0。
4. **正确性边界是否保持**：SQL-M1 是否保留 active assignment、ENABLED role、现有密码优先级及命令时 capability recheck；SQL-M3/M6 是否保留 CAS、写后 readback、第一条 BOM failure 的原行序、同一 REQUIRED 和 catalog 不直查 inventory。
5. **门是否可执行且不伪称绿色**：旧 `database-operation-budget` 是否只退出 count enforcement；新的 evidence-driven budget gate 是否承担 B.6/B.3；`code-layout` 是否诚实保留为范围外既存红门；SQL-M5 是否在得到静态 owner applicability map 前保持阻断。
6. **授权与 reviewer 状态**：manifest 是否仍诚实声明 `POST_REMEDIATION_V1`、当前字节未被独立对抗 reviewer 复核、`implementationAuthority=false`。不得把本次设计复核当作运行、DEV、seed/reset 或实施许可。

## 期望输出

请给 `GO` 或 `NO-GO`。Finding 按下列格式：

```text
[M|S|N]-xx
证据：<文件:行号或锚点>
有限影响面：<exact-set / owner / operation 数>
最小修复：<不扩大为全局重构的改法>
Dexter 决策：<需要/不需要，原因>
```

## 可直接复制给 Claude 的话术

```text
你好 Claude，烦请重新评审 catering-v2s 的后台性能重构 implementation-facing 详设。

背景：上轮 NO-GO 后，Codex 只做了定向设计修订；没有实施代码、没有运行任何环境。Dexter 还要求把 SQL 合并覆盖到全部 196 个生成 operation，并明确禁止两个极端：不能为每个接口手写唯一 SQL，也不能建跨 owner 的全局查询总线。当前方案要求复用仅限 owner-local、typed、有限的事实 loader / 批量 judgment；operation adapter 静态声明适用关系，仍保有自己的业务主查询和正确性边界。

请在仓根阅读：
- doc/decisions/2026-08-08-v2s-backend-performance-refactor-design-authorization.md
- doc/review/platform/2026-08-08-v2s-http-performance-problem-description-codex.md
- doc/review/platform/2026-08-08-v2s-backend-performance-refactor-plan-claude.md（重点第14章）
- doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design-codex.md（重点 BP-U07、B=78、门处置）
- doc/review/platform/2026-08-09-v2s-backend-performance-refactor-operation-coverage-initial.md
- doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-claude-recheck-intake.md
- doc/review/platform/2026-08-08-v2s-backend-performance-refactor-design-granularity-manifest.json
- doc/review/platform/2026-08-09-v2s-backend-performance-refactor-design-recheck-claude.md

请重点核验：
1) SQL-M1～M6 的抽象是否既可复用又没有退化成每接口 SQL 或全局 query bus；
2) 196 行矩阵是否自洽：seed 55、historical 105、unmeasured 36，未测 GET 15；第55条 seed 来自真实 db-operations JSONL 而不是误报 seed report；
3) C5 的两个 POST 是否已进入既有 74 条 normal baseline、没有新增第80条，以及 B.6.6 的 request-scope / ReadContext / EXISTS 机制是否完整；
4) SQL 合并是否保留 assignment、ENABLED role、CAS、receipt replay、写后 readback、BOM 首失败行序、同一 REQUIRED 与 owner 边界；
5) 新旧 budget gate 的处置是否可执行，且未把 code-layout 伪报为已绿；
6) POST_REMEDIATION_V1 仍是 design-only，未授权实现、运行、DEV、reset/seed、L2/UAT。

请给明确 GO 或 NO-GO。若有 finding，请按 M/S/N 给出精确文件与行号/锚点、有限影响面、最小修复建议，以及是否需要 Dexter 决策。

授权边界：本次评审只决定是否可申请下一步 implementation authorization；不构成任何代码、环境运行、DEV、reset/seed、L2/UAT 或仓库控制授权。谢谢。
```
