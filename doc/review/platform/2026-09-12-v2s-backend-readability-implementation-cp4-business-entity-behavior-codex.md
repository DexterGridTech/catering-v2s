# Backend 可读性整改 · CP-4 BusinessEntity 当前结构与行为证据

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
REVIEW_TARGET=IMPLEMENTATION
CP=CP-4
OWNER=BUSINESS_ENTITY
STRUCTURE_MOVE=BUSINESS_ENTITY_FACADE_TARGETS_PRESENT
BEHAVIOR_PIN=REMOTE_FOCUSED_TEST_TASK_PASS
CURRENT_STATUS=STEP_REVIEW_MATCHED_REMOTE_FOCUSED_TESTS_PASS_BACKEND_ACCEPTANCE_OPEN
BUSINESS_MODE=REMOTE_FOCUSED_TEST_TASK_PASS_BACKEND_ACCEPTANCE_NOT_RUN
```

## 1. 写入前双读与范围

本记录写入前重新读取：

- `doc/plans/platform/2026-09-11-v2s-backend-readability-requirements-claude.md`；
- `doc/plans/platform/2026-09-11-v2s-backend-readability-implementation-design-codex.md` 的 BusinessEntity family、事务边界、公开面与测试段；
- `doc/plans/platform/2026-09-11-v2s-backend-readability-implementation-plan-codex.md` 的 CP-4、CP-7 与固定双读段；
- `doc/review/platform/2026-09-11-v2s-backend-readability-implementation-cp0-matrices-codex.md` 的 BusinessEntity 方法族、调用方、事务/持久化与测试矩阵；
- `doc/platform/backend-coding-standard.md` §2.5 的 `R-READ-01`、`R-READ-03`、`R-READ-05`、`R-READ-06`、`R-READ-07`、`R-READ-08`；
- `project-memory/operations/backend-readability-refactor.md` 与 `project-memory/operations/implementation-source-reread-discipline.md`；
- 结构移动前的 `BusinessEntityService`、organization owner/task-read 测试、`ContractProblemAdvice` 与生产 caller；
- 当前 CP-4 target 源码、当前受管 focused run manifest、Gradle 日志和独立步骤审查结果。

本 CP 只重组 organization owner application 的 BusinessEntity 结构，不改变公开 API、HTTP operation、契约、数据库结构、跨 owner 写入、测试文件拓扑或前端。`BusinessEntityService` 仍是既有 owner facade；目标 bean 使用能力命名，不新增产品语义或新的事务协议。

## 2. 当前目标拓扑

| source | current responsibility | boundary |
| --- | --- | --- |
| `BusinessEntityService.java` | 稳定 facade、既有接口、兼容构造器、公开 nested record/exception FQCN、forwarding | 不承载 entity JDBC mutation、事务策略或业务 mutation 实现 |
| `BusinessBrandService.java` | BRAND lifecycle、generic BRAND command、CAS/status、extension/audit/readback | 只写 brand owner facts |
| `BusinessTenantService.java` | TENANT lifecycle、generic TENANT command、CAS/status、extension/audit/readback | 只写 tenant owner facts |
| `HeadCompanyService.java` | HEAD_COMPANY lifecycle、generic head command、brand authorization、CAS/status、extension/audit/readback | 只写 head-company 与其授权事实 |
| `StoreService.java` | STORE lifecycle、generic STORE status、store references、operations grant、CAS/status/readback | 只写 store owner facts；不把 store task read 重新塞回 facade |
| `BusinessEntityCommandRouter.java` | `BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE` generic dispatch 的闭集适配 | 无 JDBC、SQL、`@Transactional`、receipt 或 owner mutation |
| `BusinessEntityTaskReadService.java` | organization list/page/path/scope、Contract/Catalog/SalesMenu eligibility、task read 与 authoritative lookup | 不直接变更 entity facts；要求 `FOR UPDATE` 的 create-contract read 保留其写事务语义 |
| `BusinessEntityValueSupport.java` | 纯值校验、canonical、JSON/audit value helper | 无 JDBC、锁、receipt 或事务 |

目标文件均留在既有 organization `application` package。包内可见的 `CatalogTemporaryPromotionOwner` 仍由 facade 实现；没有把该接口迁入子包造成 package-private 解析断裂。

## 3. Facade、公开面与 Spring 边界

`BusinessEntityService` 保留既有 `StoreAssignmentLookup`、`OrganizationEntityLookup`、`StoreContractLookup`、`CatalogScopeLookup`、`OperationsBusinessEntityCommandApi`、`OperationsStoreCommandApi` 与 `OrganizationOwnerApi` 实现。对结构移动前 source 与当前 source 的 public method signature 做了同口径解析：68 个 public method signature 集合一致；既有 4 参数与 5 参数 legacy constructor 保留，新增 6 参数 constructor 仅用于 Spring 注入六个 concrete collaborator。

当前 facade 的 public command/read 方法是对 target/router 的 forwarding。公开 `StoreUpdateFacts`、页面 records 以及 `OrganizationNotFoundException`、`OrganizationDuplicateException`、`OrganizationConflictException`、`OrganizationValidationException` 等 nested FQCN 仍留在 `BusinessEntityService`，`ContractProblemAdvice` 仍直接按这些 FQCN 做 failure mapping。目标类复用这些既有类型，没有用同名的新异常替代。

生产 facade constructor 使用显式 `@Autowired`。没有增加 `@Primary`、fallback bean、反射注册或新的注入配置；target-to-facade reverse reference 未发现。直接测试仍可通过 legacy constructor 组成同一组 target，未改变 production wiring path。

静态重读确认：

- facade 没有 `@Transactional` method、`jdbc.query/update` mutation、receipt 执行、锁或 `executeWrite` 实现；
- generic router 不导入 `JdbcTemplate`，不声明事务，不直接写 owner；
- Brand/Tenant/HeadCompany/Store target 各自保留 JDBC、receipt、CAS、audit 与 authoritative readback；
- task-read target 的读取事务属性保留；包含 `FOR UPDATE` 的 create-contract path 仍使用写事务，不能被误改成 `readOnly=true`；
- `BusinessEntityValueSupport` 只承载纯值 helper，不承载 owner fact 或事务。

## 4. 事务、自调用与失败边界

本 CP 按 CP-0 事务/持久化矩阵重新核对 generic dispatch 与 self-call 边界：

- 既有 direct/generic transition 的 transaction attributes 由具体 target public entry 承接，facade/router 不靠自调用获取代理事务；
- generic create/update/status 仍按既有 closed entity type dispatch，未知类型在 router fail closed；
- Store 与 HeadCompany 的 owner grant、scope、CAS、receipt、audit 与 readback 仍在实际事实 owner 中完成；
- public nested exception 的类型与 advice mapping 不变；
- `REQUIRES_NEW`/编程式 `TransactionTemplate` 若属于既有 target family，随该 family 保留，不由 facade 重包一层；
- 目标类之间的调用是显式 bean-to-bean 调用，未添加事务传播、锁顺序或跨 owner write 协议。

这些是结构事实与源码对账结论，不以方法名 token、文件存在、public 数量、注解存在或 DB operation 数作为行为证明。

## 5. 受管 focused 测试证据

最后一次 CP-4 focused run 通过 approved remote Testcontainers runner 执行：

```text
node scripts/test/r5-remote-testcontainers.mjs \
  :apps:backend:catering-business-server:modules:organization:test \
  --tests com.catering.v2s.organization.application.OrganizationOwnerServiceTest \
  --tests com.catering.v2s.organization.application.OrganizationSalesMenuOwnerTest \
  --tests com.catering.v2s.organization.application.BusinessEntityStoreContractQueryTest \
  --tests com.catering.v2s.organization.application.OperationsOrganizationTaskReadServiceTest \
  --tests com.catering.v2s.organization.application.OrganizationOverviewTaskReadServiceTest
```

| runId | execution | source sync | cleanup | boundary |
| --- | --- | --- | --- | --- |
| `r5-tc-1789171446473-63271` | `:apps:backend:catering-business-server:modules:organization:test`，Gradle `PASS` (`remoteGradleStatus=0`) | `PASS` | `PASS`：remote process、remote workspace、Testcontainers containers/volumes 均 PASS | 受管 focused test task；不是 full backend acceptance |

manifest：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1789171446473-63271/run-manifest.json`。该 manifest 的 `testExecution.status=PASS`、`cleanup.status=PASS`、`backendAcceptance=null`、`business=NOT_APPLICABLE`；因此本记录只把它作为远端 focused test execution/cleanup 证据，不把 runner 的 task PASS 冒充为 `CONTRACT/BUSINESS` acceptance PASS。Gradle log 为 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789171446473-63271/gradle.log`。

该 focused selector 覆盖 organization owner mutation、SalesMenu/Contract owner lookup、operations task-read 与 overview projection 的当前调用面。它不能替代最终全量 backend acceptance，也不能独立证明所有七条不变量已在 HTTP acceptance 层闭合。

## 6. 首败与范围外判定

先行的 organization module 全模块 run `r5-tc-1789171329729-61200` 在 `StoreCandidateTaskReadServiceTest.selectedCandidateDoesNotReplaceCurrentPageMember` 失败。重新读取失败日志、当前源码与 `HEAD` 字节后确认：

- `StoreCandidateTaskReadService.java` 当前字节与 `HEAD` 一致；
- `StoreCandidateTaskReadServiceTest.java` 当前字节与 `HEAD` 一致；
- 该测试不构造、不调用 BusinessEntity facade 或本 CP target；
- `StoreCandidateTaskReadService` 在已批准设计中属于 `KEEP_TASK_READ`，不是 CP-4 BusinessEntity 拆分目标。

因此该失败被记录为 CP-4 范围外的既有失败，不修复、不重试同一 signal，也不把它写成 CP-4 business evidence。它同时意味着本 CP 不能宣称 organization 全模块 test suite 全绿；最终 full backend acceptance 仍必须单独执行并单独报告。

## 7. Fresh 独立步骤审查

独立 reviewer `Anscombe` 以只读、证伪式立场重新读取需求、详设、计划、CP-0 矩阵、当前 target source、`ContractProblemAdvice`、focused manifest 与首败日志，返回：

```text
REVIEW_TARGET=IMPLEMENTATION
reviewerKind=INDEPENDENT_SUBAGENT
STEP_REVIEW=MATCHED
M/S/N=0/0/0
```

审查确认 facade public surface、target boundary、generic router、事务/读取语义、异常 FQCN/advice mapping 与 focused run 边界均与当前材料匹配；明确将 `StoreCandidateTaskReadServiceTest` 失败拒绝为 CP-4 finding。该步骤审查不是整批最终 `GO/NO-GO`，也不替代最终 fresh implementation review。

## 8. 当前状态与下一步

```text
CP-4_STRUCTURE=STATIC_COMPILED
CP-4_REMOTE_FOCUSED_TEST_TASK=PASS
CP-4_STEP_REVIEW=FRESH_INDEPENDENT_MATCHED
CP-4_FULL_BACKEND_ACCEPTANCE=OPEN
CP-4_DEV_RESET_SEED=NOT_RUN
NEXT_GATE=CP4_EVIDENCE_RECONCILIATION_THEN_CP5
```

未执行且不在本 CP 关闭范围的项目：full backend acceptance、最终 DEV、reset、seed、UAT、部署与切流。后续 CP 完成后，仍须在所有 production/test code 改动结束后执行最后一次全量 backend acceptance，并按授权顺序完成 reset、DEV、seed。
