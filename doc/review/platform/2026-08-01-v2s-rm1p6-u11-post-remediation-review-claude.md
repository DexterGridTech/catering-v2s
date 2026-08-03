---
title: RM1 P6-3 U11 NO-GO 修复后复核（Claude）
reviewTarget: IMPLEMENTATION
scope: U11 修复后当前实现与最终受管 L2 证据（本机 Spring Boot/Vite/Playwright + 隔离远端非生产中间件）
verdict: NO-GO
findings: M=1 / S=1 / N=1
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅覆盖 U11 当前实现与本次受管 L2/package evidence；不构成 UAT、DEV seed/reset、Roadmap 状态变更或 Git 操作授权；本文件是独立静态/证据复核，不是第三轮对抗审查
createdAt: 2026-08-01
---

# U11 NO-GO 修复后复核

## 0. 结论

**NO-GO — `M=1 / S=1 / N=1`。**

**上一轮我报的 2M/3S/5N，逐条复核后 9 条已真实闭合**，其中 M1/M2 的根因拆分做得干净，
`S2`（红控制不执行）我用 scratchpad 变异实测确认现在真的会红。**唯一的 `M` 是本轮修复自己引入的回归**：
`N3` 的那处改动把一个此前 PASS 的强制门改红了，而交付物仍声明 PASS。它是一处单值修改即可清除的问题。

本文件是 Dexter 委托的独立静态/证据复核，**不是第三轮对抗审查**；我也没有改写任何历史 verdict。

## 1. M1 ｜`N3` 的修复把 `affected-l2` 门改红，而交付仍声明 PASS

**owning source**：`contracts/policy/affected-l2-registry.json` 的
`phaseBusinessL2Obligations[RM1P6-U03].implementationState`。

本轮把它由 `PENDING_FUTURE_UNIT` 改为 **`ACTIVE_CURRENT_EVIDENCE`**。
但 `tools/verify-gates/cli.mjs:513` 的封闭词表只接受两个值：

```js
|| !["ACTIVE_REQUIRED", "PENDING_FUTURE_UNIT"].includes(obligation.implementationState)
```

**实测（本会话 fresh）**：

```
./scripts/check/affected-l2
R4_GATE=FAIL
REASON=R5_AFFECTED_L2_PHASE_OBLIGATION_INVALID
exit code: 1
```

该门**在 `scripts/verify` 之内**（`tools/verify-gates/verify.mjs:19`，条目 `U10-affected-l2`），
因此 `scripts/verify` 当前是红的。

**这是本轮引入的回归**：我在今天 `12:00` 前后实测同一门为 `R5_AFFECTED_L2=PASS`，
registry 当时是 `PENDING_FUTURE_UNIT`。其余七道门本轮 fresh 复跑**全部仍 PASS**
（`capability-invariants` / `frontend-architecture` / `security-boundaries` / `openapi-contracts` /
`code-layout` / `standards-coverage --phase R5` / `edge-codegen --check`，exit 均为 0），
所以这是一处孤立回归，不是面上的问题。

**与交付表述的冲突**：
`post-remediation-author-resolution.md:25` 把 `N3` 记为 `CONFIRMED_CLOSED`；
`rm1p6-u11-joint-remote-l2-package-exit.json` 声明 `status: "PASS"`、`fullComplianceScan: "PASS"`。
`validate-package-exit` 之所以仍然通过，是因为它本身不运行 `affected-l2`——
**这正是「门红但包绿」的假绿形状**。

**最小根因修复**：把该值改回封闭词表内的 **`ACTIVE_REQUIRED`**。
这在语义上现在恰好是对的——那十个 operations spec 已经是**当前必须执行**的义务，且本轮确实执行了
（10/10 PASS）。**不需要改门、不需要新词表。**
若确实想引入 `ACTIVE_CURRENT_EVIDENCE` 这个新状态，那是扩大方案：必须同时改
`cli.mjs:513` 的词表并补一条真红变异证明，本阶段没有收益。

**是否需要 Dexter 产品裁决**：否。

## 2. S1 ｜`resolveCommandTarget` 没有任何**执行过**的证据，而 resolution 引用了不覆盖它的证据

`M2` 的写入侧根因修复我读过，**代码本身是对的**：

`WorkspaceUserService.java:71-77`

```java
public OrganizationTaskPathLookup.TaskPath resolveCommandTarget(WorkspaceSessionReadback session, String expectedTargetType, UUID requestedTargetRef) {
    if (... || expectedTargetType == null || requestedTargetRef == null) throw new SessionInvalidException();
    var assignment = assignments.requireActiveScope(...);
    var target = taskPaths.requireTaskPath(..., expectedTargetType, requestedTargetRef);
    if (!taskPaths.isScopeAllowed(..., assignment.serviceNodeType(), assignment.serviceNodeId(), target)) throw new SessionInvalidException();
    return target;
}
```

显式目标必填、按**真实类型**解析、再对 assignment 做 `isScopeAllowed`——fail-closed，
且 `OperationsWorkspaceInvitationController.java:60` 已改为调用它。**这条我认可。**

**但它一次都没有跑过**：

- 唯一覆盖它的是 `WorkspaceUserTaskScopeTest.java:62`
  （`service.resolveCommandTarget(session(group, UUID.randomUUID()), "HEAD_COMPANY", headCompany)`），
  而该测试类是 `@Testcontainers` / `PostgreSQLContainer`；**本机 `docker info` 失败，Docker 不可用**。
- fixture **没有**调用 `POST /api/operations/.../user-management/{type}/invitations`：
  它用受管 owner bootstrap 建邀请，再走 `/api/public/invitations/{ws}/{token}/...` 公共接受流程
  （`r5-joint-remote-l2-fixture.mjs:166/182/205/218/240`）。这条路径不经过 `resolveCommandTarget`。
- 19 个 L2 spec 里**没有一个创建运营端邀请**；`user-management.spec.ts` 只读 `邀请` tab。

而 `post-remediation-author-resolution.md:19` 的 `M2` 行写的是
"最终 fixture 与 operations L2 PASS"——**这两样都不经过该代码路径**。

**这与我上一轮 `S1` 是同一个形状**：修复正确，但引用了不覆盖它的证据当收口。
区别在于上一轮那条 finding 当时**还是活的缺陷**，这次缺陷已修，只剩证据口径。故判 `S` 不判 `M`。

**最小修复（二选一，都不需要新基建）**：
(a) 在 resolution 里把 `M2` 的证据如实写成「`resolveCommandTarget` 由 Docker 受限的
`WorkspaceUserTaskScopeTest` 覆盖，本机未执行」，并在有 Docker 的环境跑一次
`:apps:backend:catering-business-server:modules:workspace-iam:test`；
(b) 若要浏览器级红控制，需给 L2 补一条完整的「选总公司 → 选角色 → 发出邀请」用例——
这需要新增手机号/OTP/角色 fixture，**属于扩大范围**，我不建议在本轮做。

**是否需要 Dexter 产品裁决**：否。

## 3. N1 ｜finding 编号在两份文档间错位

`post-remediation-author-resolution.md` 的 `S1` 对应我文件里的 `S2`（两个 App 的 test 接线），
其 `S2` 对应我 `S2` 的另一半（Drawer 红控制），而我原来的 `S1`
（`S2-R2` 收口证据未执行）被并进了它的 `M1` 行。**实质内容都覆盖到了**，
但后续会话对照两份文档时会错配。建议在 resolution 顶部加一行编号映射。

## 4. 已复核为真的闭合（逐条，均为本会话 fresh 实测）

**M1（scope 与 command target 分离）—— CLOSED**

- `WorkspaceUserService.java:51` 的 `requiredDataNodeType(expectedTargetType)` 由
  `:79-85` 从 `WorkspaceAuthorizationCatalog`（生成投影）解析，**不是手写映射**。
- `"NONE"` 分支（`:52-61`）**完全不读 `session.visibleDataNodeId()`**；
  `:62` 的 `effectiveScopeRef = ... visibleDataNodeId()` 只对 scope-required 页可达。
  这正是「类判断而非逐例分支」，`PG-IAM-GROUP-USERS` 与将来任何 NONE 页都自动正确。
- fail-closed 未被削弱：NONE 分支要求 `expectedTargetType.equals(assignment.serviceNodeType())`
  否则抛 `SessionInvalidException`；`PG-IAM-HEAD-COMPANY-USERS` 的两个可授予类型
  （`GROUP` 走聚合、`HEAD_COMPANY` 走自身路径）都被覆盖。

**M2（读取聚合 / 写入目标）—— CLOSED**

- `WorkspaceInvitationService.invitationPageSql:187-193`：`fixedId == null` 时子句退化为
  `intent.service_node_type=?` **单条件**，即正确的 family 聚合；
  不再出现我上轮报的 `service_node_type='HEAD_COMPANY' AND service_node_id=<groupId>` 这对不可能条件。
- `managementPage:146-155` 的 `organizationQuery` 短路已改为以 `fixedTargetId != null` 为条件，
  聚合态不会被机构筛选误清空；`matchingOrganizationTargets(..., fixedTargetType)` 保留了聚合内搜索。
- 写入侧见 `§2`。

**S1（跨页 stale scope 的执行证据）—— CLOSED**

`user-management.spec.ts` 现在真的按 round-2 要求的顺序走：

```
goto(R5_L2_STORE_ROUTE) → selectOperationsDataScope(page)      ← 真正建立 STORE 数据范围
goto(R5_L2_USER_ROUTE)  → /user-management/group/user  200, targetOrganizationType='GROUP', total>0
tab 邀请               → /user-management/group/invitations 200
goto(head-company-users)→ 200, searchParams.has('scopeRef')===false, scopeRef=null, total>0
```

**这四条正是 `M1` 的红控制**，且在被接受的那次 run 里**实际执行**（operations 10/10 PASS）。

**S2（红控制是否真的会红）—— CLOSED，且我做了变异实测**

- 两个 App 的 `package.json` `test` 现为
  `node --test src/tests/architecture/*.test.mjs && vitest run src --exclude "**/*.mjs" --exclude "**/*.spec.ts"`。
- 实跑：platform **37 files / 41 tests PASS**；operations **21 files / 42 tests PASS**。
- **红变异（scratchpad 拷贝，用后即弃，本仓零写入）**：把
  `WorkspaceDetailDrawer.tsx` 与其 `.test.tsx` 复制到 scratchpad，先跑基线 → `1 passed`；
  在**拷贝**上注入 `destroyOnHidden` 后重跑 → **`1 failed`**。
  控制真实可红，且现在真的会被执行。

**S3（写入是否证明持久化）—— CLOSED，五个 spec 全部变为效果敏感**

| spec | 现在的判别式 |
| --- | --- |
| `platform-admin-management` | `fill(updatedUserName)`（`Date.now()` 唯一）→ 断言 `readback.userName === updatedUserName` **且 `readback.version === body.expectedVersion + 1`** |
| `workspace-management` | 同形状：run-unique 变更 + 版本差 |
| `role-management` | 同形状：run-unique 变更 + 版本差 |
| `workspace-account-management` | 后续 GET 断言 **`readback.credentialStatus === 'RESET_PENDING'`**——这是 owner 从 `password_reset` 表**派生**的字段，不是命令响应里的字面量；并断言 `reset.revision === body.expectedVersion`、`readback.revision === reset.revision` |
| `extension-field-management` | `fill(updatedLabel)` → 断言 `readback.definitions[0].label === updatedLabel` |

我上轮构造的失效场景（owner 丢字段 → 回读等于旧值 = 当前值 → 全绿）**在五个 spec 上都不再成立**。

**N1（cleanup 三项 absence readback）—— CLOSED**

`r5-joint-remote-l2.mjs` 的远端脚本现在：
删除后重查 `pg_database` / `pg_roles`，并用 `mc ls --recursive` 读资产前缀；
在 `set -euo pipefail` 下有一行硬断言
`[ "$database_present_after" = f ] && [ "$role_present_after" = f ] && [ -z "$asset_present" ]`，
**位于 `REMOTE_NAMESPACE_REMOVED=PASS` 之前**；MinIO 容器不可 inspect 时
`exit 24` 硬失败，不再静默跳过。三个 JS 字段由 stdout 子串派生，不是字面量。
被接受的 run 记录 `databaseAbsentAfterCleanup / roleAbsentAfterCleanup / assetAbsentAfterCleanup` 均为 `true`。

**N2（ST-11）—— 正确标为继承债务**

package-exit 新增 `inheritedDebts`：

```json
{"id":"P1_AUTHORITY_SOURCE_LEDGER","state":"FAIL","rows":["ST-11"],"causedByPackage":false,
 "closure":"...U11 static or browser PASS does not change this state."}
```

我实跑 `node tools/authority-source-ledger/cli.mjs check` → **确实仍 `FAIL / P1_LEDGER_ROW_INVALID:ST-11`**。
声明与事实一致，**没有任何一处声称已关闭** ✓。

**N5（cutoff）—— 未被伪装为业务缺陷**

`rm1p6-u11-joint-remote-l2-problem-family.json:247`：
`classification: CONFIRMED_GOVERNANCE_REPRODUCIBILITY`、
`prevention: PACKAGE_INTAKE_CUTOFF_CHECKLIST`、
`remedy: "...do not alter business code or create a third adversarial round."`
定性为治理可复现性问题、明确禁止改业务代码与开第三轮 ✓。

**最终受管 L2 证据 —— 全部独立复算通过**

| 项 | 结果 |
| --- | --- |
| run | `rm1p6-joint-local-l2-1785554796000-76279-b2747f8c`（`12:30`，晚于全部修复 `12:14–12:26`） |
| report sha256 | 声明 `98b5b145…` vs 复算 `98b5b145…` **一致** |
| `currentSourceHashes` | **44/44 与当前字节一致，0 漂移**（上一轮此处漂移 10 条） |
| log sha256 | 一致 |
| Playwright | platform `Running 9 tests … 9 passed (58.5s)`；operations `Running 10 tests … 10 passed (1.5m)` |
| `exactSpecs` | 19，与 `affected-l2-registry` 的两组 tests **exact-set 相等**（9 platform + 10 operations），双向差集为空 |
| phases | 13 个全 PASS；`firstFailure=null`、`brokenBoundary=null`、`lastKnownGood=CLEANUP` |
| business / cleanup | 各自独立判定，均 PASS |
| `PACKAGE_EXIT` | **`PASS` / `CHANGED=288`**，本会话直跑即通过（上一轮的并发 intake 与 manifest hash drift 均已清除） |

## 5. 处置

- **`M1`** 是单值修改（`ACTIVE_CURRENT_EVIDENCE` → `ACTIVE_REQUIRED`），
  在既有批准边界内，Codex 可自主处置；改后须重跑 `scripts/check/affected-l2` 与 `scripts/verify`。
- **`S1`** 建议按 `§2(a)` 修正证据口径即可，不建议为它扩大 L2 范围。
- **`N1`** 加一行编号映射。
- **不得回退**：`§4` 全部已验证为真的内容——scope/command target 拆分、
  聚合 SQL 的单条件退化、跨页 stale-scope L2 用例、vitest 接线与四个可红的 Drawer 控制、
  五个写 spec 的效果敏感断言、cleanup 三项 absence readback、`inheritedDebts` 的 ST-11 记录、
  以及 44/44 字节绑定的 9/9 与 10/10。
- **本复核不构成**：UAT、DEV seed/reset、Roadmap 状态变更或 Git 操作授权；
  ST-11 仍是未关闭的继承债务。第二轮对抗审查的硬停止我予以尊重，本文件不开启第三轮。
