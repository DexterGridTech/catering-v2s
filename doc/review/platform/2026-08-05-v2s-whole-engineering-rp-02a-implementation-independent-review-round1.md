---
title: RP-02a-U01 实施独立对抗审查 Round 1
status: PRELIMINARY_NO_GO
createdAt: 2026-08-05
packageId: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
unitId: RP-02A-U01
REVIEW_CYCLE_ID: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
reviewerInputChecklist: '{"path":"doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-independent-review-input.md","sha256":"8ef86ea97773728bb87520296e06f1f6ec87800059f7ca62af27b61a68c4d8be"}'
blindReviewDeclaration: '先以原始业务、设计、active package、生产源码和测试证伪；但全仓 exact-search 的返回意外含有禁读 author/Claude 文档的命中行元数据，故本轮不得作为严格盲审 GO 依据。'
authorMaterialReadAfterIndependentVerdict: false
---

# 结论

`PRELIMINARY NO-GO — M=0 / S=1 / N=0`。

实施对象本身没有发现会破坏 RP-02a 业务/契约静态目标的实体缺陷：物化 catalog、154 个
route-face、source-bound facts、payload/query 边界、recovery 顺序和两个 N 项处置均有独立静态
证据。NO-GO 仅来自本轮审查过程的独立盲审完整性：定位源码时执行的全仓精确检索输出了
`design-intake-codex`、Claude request/review 等禁读作者材料的**命中行片段**。我没有打开、
读取或引用这些材料，也没有读取 focused static proof 或 package exit；但既然已接触片段，就不应
将这份 verdict 伪装为无泄漏盲审。必须由一个新鲜上下文的 reviewer 仅按 input checklist 的白名单
路径重新执行 Round 1，才可给本 cycle 的有效 GO/NO-GO。

本次只做静态 Node/script 检查；未启动 DEV、HTTP、浏览器 L2、远端 Testcontainers、seed/reset
或任何仓库控制动作。

## 输入、业务语义与范围

- 已按 `doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-implementation-independent-review-input.md@8ef86e…4d8be`
  回读 checklist 所列实施输入；`AGENTS.md@4d64bf…9fda`、`CLAUDE.md@8b12b3…c50f`、Registry 的
  current、六维 memory recall、全部 kernel、`G-02/G-05/G-05A/G-07/G-09/G-10` 命中语料、
  standards matrix 与 R5 static coverage 均已复核。
- 业务判断：这不是新 Journey。它修复已有 platform-admin、operations-admin、public 三个 face 的
  静态消费者闭环；不得由 registry 反推 owner/task，也不得把关系候选的 `projectId` 删除为“全部
  删除”。`projectId` 保留在 owner 允许的 candidate/overview query 及内存 scoped state，而不再进入
  store/contract create body。
- active package 仅授权静态 catalog/projection、diagnostic/fixture consumer、wrapper、测试与证据；
  禁止 contracts/OpenAPI/generated wire、backend/frontend runtime、数据库、DEV/UAT/HTTP/L2、seed/reset。

## 独立核验结果

| 分母/风险 | 独立方法与结果 | 判定 |
| --- | --- | --- |
| 154 的具体集合 | 直接加载 generated registry、materialized catalog 和 scenario facts，按 `operationId/method/path/face/owner` 建 set；catalog-minus-registry=0、registry-minus-catalog=0。三者都是 `154 = platform-admin 50 + operations-admin 92 + public 12`。 | PASS |
| materialized catalog identity | catalog `projectionState={MATERIALIZED,R24_P3C,sourceOperationCount:121,operationCount:154}`；`projectEdgeCatalog(catalog).catalog === catalog`。generic R24 id 和 8 个 P3C 模板 id 均不存在。 | PASS |
| R24/P3C 元数据 | 两个 head-company authorization operation 的 path/face/owner、error augmentation（add=REQUIRED；remove=IN_USE+REQUIRED）、退役 component baseline 删除，以及 invitation request/action 的 P3C property removal 都仍在 source catalog。 | PASS |
| 十条补齐 facts 的 owner/source | 平台 invitation 的 create/get/list/candidate/cancel/reissue 均精确指向 `PlatformWorkspaceInvitationController` 的对应方法和 `WorkspaceInvitationService`/`WorkspaceUserService`；platform/operations candidate、hierarchy extension、commercial group update 分别重新对照其 controller 与 owner service。没有以 operation 名代替 source。 | PASS |
| 四个 body 边界 | workload 的 store create 仅 `{brandId,tenantId,code,name}`，contract create 仅 `{storeId,phaseName,contractNo,effectiveFrom,effectiveTo,items}`；fixture 的两类 body 不含 `projectId`，各有 source-text negative assertion。 | PASS |
| 五个 unsupported query 与三项 allowlist | workload 只实际发送 platform overview 的 `projectId`；operations store candidates、contract extension/candidates/list、store list 均不发送。catalog 的 contract-declared allowlist 精确为 `getOperationsOrganizationCandidates`、`getPlatformOrganizationCandidates`、`getPlatformOrganizationOverviewPage`。 | PASS |
| 两个 state record | 仅 private runtime state 保留 `PROJECT_SCOPE={projectId,dataNode}`、`SCOPED_STORE_FACTS={projectId,brandId,tenantId,headCompanyId,dataNode}`；测试精确断言字段集。 | PASS |
| recovery 与 public 反例 | `executeOperationsRecoveryWorkload` 顺序为 start → send OTP → verify OTP → complete，测试 exact-match 四个 id；public invitation 的七步链仍是单独 workload，没有被 recovery 误替换。 | PASS |
| N1 / N2 | N1 的 catalog crosswalk 为 `PASS`，记录同一个 registry/placement/catalog/facts exact-set hash `cc892b…b047f`、42 个具体 replacement、9 个退役 generic id 和 `genericAliasesRetained=0`；N2 是窄 wrapper，只接受 `--check|--self-test` 并转发 materializer。`scripts/check/r5-edge-materialize --check` 输出 154/50/92/12 PASS。 | PASS |
| hook/out-of-surface | 当前 package 的 post-hook 变更记录覆盖 catalog、projection、wrapper、facts、workload/fixture/RM1 tests、review/evidence 和 active package；列出的实际路径均在 `allowedChangeSurfaces`。未观察到 contracts/openapi、apps、db 或 runtime 启动类 path。此为 hook receipt 的静态 readback，不替代 package exit。 | PASS（有限） |

## 实际静态执行与红变异

1. `scripts/check/standards-coverage --phase R5`：PASS（`RULES=150`）。
2. `node --test scripts/test/http-diagnostic-scenarios.test.mjs scripts/test/http-diagnostic-workload.test.mjs scripts/test/r5-platform-admin-l2-fixture-seed.test.mjs`：18/18 PASS。
   其中 facts test 实际构造缺失、重复、source-less、敏感字段和 generic-reintroduction 的红变异；
   workload/fixture test 对 body/query/state/recovery 的精确字段集做断言。
3. `scripts/check/r5-edge-materialize --check`：PASS，实际从 source catalog 重物化并与已提交
   OpenAPI/report 字节对比。
4. `scripts/check/r5-edge-materialize --self-test`：PASS。它实际在临时副本注入无法解析的 page key，
   期望并捕获 `R5_EDGE_CAPABILITY_UNRESOLVED`；同时验证 JSON pointer、嵌套禁字段和相对 component
   引用三种 red mutation。

这些是静态形状与生成一致性的证据；不能宣称 HTTP/L2/seed 的业务 PASS 或 cleanup PASS。

## Findings

### S-01：本 Round 1 盲审输入被工具返回的作者材料片段污染

- **状态：CONFIRMED（审查治理 finding，不是实施代码 defect）**。
- **证据**：治理要求 reviewer 在独立 verdict 前不得读取 author self-assessment、finding disposition
  或 Claude material；全仓 `recall-code` 的命中列表却返回了这些禁读文档的行片段。虽然没有主动打开、
  后读或作为技术证据使用，片段已足以破坏“fresh blind review”的可审计性。
- **影响**：本报告的技术核验可作为下一轮的候选线索，却不能充当本 cycle 的有效独立 Round 1 verdict；
  若仍据此给 GO，将违反 `INDEPENDENT_SUBAGENT_REQUIRED` 与 `BLIND_REVIEW_FIRST`。
- **最小修复**：不要修改实施代码。由新的 fresh reviewer 使用白名单式 file list（禁止全仓 `rg` 输出
  author/evidence 路径）重新运行同一静态核验；其报告须保留同一 `REVIEW_CYCLE_ID`、`REVIEW_ROUND=1`
  而不是以换 reviewer 重置轮次。新 reviewer 若为 GO，则作者再做辩证 intake；需要修复时才进入 Round 2。

## 被否决的反例与未发现的问题

- **REJECTED_WITH_EVIDENCE**：仅把旧的 144/147 常量改成 154。当前 facts 与 registry 是 exact-set
  校验，且 source-less/duplicate/missing mutation 均失败，不能只靠总数假绿。
- **REJECTED_WITH_EVIDENCE**：直接把 generic catalog 重新投影。materialized state 缺失或 generic id
  被插回时 `projectEdgeCatalog` fail closed；R24/P3C 的 component/query/error 元数据在 current catalog
  仍存在。
- **REJECTED_WITH_EVIDENCE**：把所有 `projectId` 视为过时字段。三个 contract query 与两个 private
  state record 保持，且 owner controller 表明 candidate/overview 的 project narrowing 仍有业务用途。
- **REJECTED_WITH_EVIDENCE**：把 public invitation 的七步流程塞入 recovery。两条链由不同 owner protocol
  与测试分别守护，当前 recovery 只有四步。

## 下一步

先补一个完全无 author-snippet 泄漏的新鲜 reviewer Round 1。它应复用同一 approved scope 和
`implementation-independent-review-input.md`，但采用逐文件白名单读取和明确的 scratch red mutation；
在其有效 GO/NO-GO 产生前，不应把本报告视为可关闭的 implementation review。
