---
reviewCycleId: RM1P6-U11-IMPLEMENTATION-POST-L2-20260801
reviewRound: 2
reviewRoundLimit: 2
reviewerKind: INDEPENDENT_SUBAGENT
roundFinalDecision: SELF_DECIDED
furtherCodexAdversarialRoundAllowed: false
---

# U11 NO-GO 根因修复与最终受管 L2 收口

本文件是最终允许的第二轮独立审查之后的作者处置，不是第三轮对抗审查，也不把历史 NO-GO 改写成未发生。

## Finding 编号映射

Claude post-remediation review 的 `M1/M2/S1/S2/S3/N1/N2/N3/N4/N5` 与本文件早先作者表的编号曾发生错位；本次以 Claude 文件为主编号：`M1=NONE scope`、`M2=aggregate read/explicit command target`、`S1=resolveCommandTarget 执行证据口径`、`S2=两后台 test 接线与 Drawer 红控制`、`S3=写后 readback`、`N1=cleanup absence readback`、`N2=ST-11`、`N3=affected-L2 registry`、`N4=IA05 交互映射`、`N5=late-intake cutoff`。

## Findings disposition

| Finding | 处置 | 根因修复与证据 |
| --- | --- | --- |
| M1 | CONFIRMED_CLOSED | `WorkspaceUserService.resolveTaskScope` 现在从 assignment/catalog 解析 NONE scope；GROUP assignment 的 HEAD_COMPANY 聚合不再读取过期 session visibleDataNodeId。`user-management.spec.ts` 先切换 scope 再验证 GROUP 用户与邀请读取；最终 operations 10/10 PASS。 |
| M2 | CONFIRMED_CLOSED_WITH_EVIDENCE_BOUNDARY | 读取 scope 与写入 command target 已拆开：`resolveCommandTarget` 必须接收显式 target，`OperationsWorkspaceInvitationController` 转发 body.scopeRef；邀请聚合读取按目标类型过滤，避免把 GROUP id 当 HEAD_COMPANY id。当前 L2 fixture/operations spec 不经过该写入路径，Docker 不可用导致 `WorkspaceUserTaskScopeTest` 未执行；因此本行只声明源码与 compile proof，不能把当前浏览器 L2 写成 command-target runtime proof。 |
| S1 | CONFIRMED_CLOSED | 两后台 package test 入口均执行 architecture test 与 Vitest；platform 37 files/41 tests、operations 21 files/42 tests PASS；受管 L2 19 spec 全部执行。 |
| S2 | CONFIRMED_CLOSED | 四个 platform read-only detail Drawer focused proof 均明确拒绝 `destroyOnHidden` 与 `destroyOnClose`，并由 package test 实际执行；platform 9/9 L2 PASS。 |
| S3 | CONFIRMED_CLOSED | 写 spec 使用 run-unique mutation，并断言 request body/header、owner response/readback 与可见结果。credential reset 遵循 IA/owner 语义：password_reset 改变 `credentialStatus=RESET_PENDING`，账户 revision 保持 expectedVersion；最终 platform 9/9 PASS。 |
| N1 | CONFIRMED_CLOSED | cleanup 现在 fail-closed：MinIO 不可用即失败；数据库、角色、资产前后状态均显式回读，最终 `databaseAbsentAfterCleanup=true`、`roleAbsentAfterCleanup=true`、`assetAbsentAfterCleanup=true`。 |
| N2 | INHERITED_DEBT | ST-11 authority ledger 仍为外部历史 FAIL；U11 package exit 显式记录 `causedByPackage=false`，本次 business/cleanup PASS 不关闭它。 |
| N3 | CONFIRMED_CLOSED | registry 与 delivery manifest 均固定当前 19-spec evidence；U03 使用既有封闭状态 `ACTIVE_REQUIRED`，不扩展 verify-gates 词表。 |
| N4 | CONFIRMED_CLOSED | IA05 amendment 记录 platform radio-selected fixed target 与 operations row-local revoke 两种 detail-first 交互；均无列表操作列，未引入不符合 IA 的通用操作列。 |
| N5 | RECORDED_CUTOFF | late concurrent intake 属于 package 收口边界，不是业务代码缺陷；按现有 problem-family 记录为 cutoff，不改变最终 run 的 business/cleanup 结果。 |

## Final managed evidence

- Runner: `scripts/test/r5-joint-remote-l2.mjs`
- Run: `.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1785554796000-76279-b2747f8c/evidence/terminal-report.json`
- Report SHA-256: `98b5b14534c01a2c90bef7d315a9c1a200847eafa494a0cc12339b1fd79febb3`
- Platform: 9/9 PASS; operations: 10/10 PASS; exact denominator 19。
- `business=PASS` and `cleanup=PASS`; local Spring Boot、两个 Vite、Playwright 均在本机，SSH 仅连接隔离远端非生产 PostgreSQL/对象存储。
- Cleanup 后数据库、角色、资产前缀均 absent，local process exit PASS，firstFailure=null。

## Boundary

这次收口只覆盖 U11 当前实现与受管本机 L2，不构成 UAT、DEV seed/reset、Roadmap 状态变更或 Git 权限授权。ST-11 仍是继承债务。第二轮是对抗审查硬停止，不再召集第三轮；下一步交 Dexter 与 Claude 做独立静态/证据复核。

## U01 contract-face 对齐补充

后续静态复核发现 `tools/platform-boundary-gates/cli.mjs` 曾把 106 个 active error code 误当作 U01 operation-face closure，并硬编码历史 `39/56/11`。这与 owning source 不一致：U01 accepted catalog/report 是 `114 = 43/56/15`；R24 与 P3-C 是 codegen 的受批准投影，生成 route registry 才是 `147 = 43/89/15`。根因、有限分母、反例与 prevention set equality 记录在 `doc/evidence/platform/rm1/p6/rm1p6-u01-contract-face-denominator-problem-family.json`。

最小根修是让 contract-face 门从 U01 implementation catalog/report 派生 operation-id、总数与 face counts；106 继续只由 `scripts/generate/edge-codegen.mjs` 的 error-code closure 校验。`scripts/check/contract-face`、`scripts/check/edge-codegen --check` 与 compliance static admission 均已 PASS。

同轮全量 backend test 的真实 NPE 也已根修：focused test 仍 stub 已退役的 `resolveTaskScope`，而 controller 已按 IA/owner 设计调用 `resolveCommandTarget`；测试已改为 stub/verify 当前 owner command-target path，focused Gradle test PASS。其余三项失败均在 Testcontainers 初始化边界，原因是本机 `/Users/dexter/.colima/default/docker.sock` 不存在且 Docker daemon 未运行；不能把该环境失败说成业务失败，也未修改 runner 去绕过它。

随后远端受管单模块验证又发现 `PlatformAuthenticationServiceTest.administratorPageAcceptsOmittedOptionalFilters` 把共享 `@BeforeAll` 数据库总数固定为 1，顺序相关。测试已改为保留 null/null/null 可选过滤调用，只验证 seeded `Dexter` 可见且总数至少为 1；owner 查询 SQL 未改。修复后的远端 run `r5-tc-1785557288462-27843` 为 `BUSINESS=PASS; CLEANUP=PASS`；此前 aggregate backend run `r5-tc-1785556947240-20774` 亦为 `BUSINESS=PASS; CLEANUP=PASS`。
