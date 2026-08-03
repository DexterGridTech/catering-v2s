---
title: RM1 P6 U01 contract-face 与 backend test 对齐修复复核（Claude）
reviewTarget: IMPLEMENTATION
scope: U01 contract-face 分母派生、两个 focused test 对齐、U11 package 一致性与受管 backend 验证
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅覆盖 U01/U11 静态与受管 backend 验证；不构成 UAT、DEV、seed/reset、Roadmap 状态变更或 Git 操作授权
createdAt: 2026-08-01
---

# U01 contract-face 与 backend test 对齐复核

## 0. 结论

**GO — `M=0 / S=1 / N=2`。**

五个核验点逐项独立复核通过。`contract-face` 的修复**是真派生，不是改数字止血**——
我用 git diff 看到硬编码被**删除**，并在 scratchpad 镜像上做了四类红变异，**四类全红**。
唯一的 `S` 是上一轮 `S1` 的残留：`resolveCommandTarget` 的 owner 内部分支仍未执行，
而本轮已两次动用远端受管 Testcontainers 跑别的模块——**给出的理由已不再是该缺口的实际原因**。

## 1. contract-face 是否真派生（核验点 1）—— CONFIRMED，非止血

`git diff -- tools/platform-boundary-gates/cli.mjs` 的实际改动：

```diff
-  if (report.operations?.length !== 106 || JSON.stringify(report.closure?.faceCounts)
-      !== JSON.stringify({ "platform-admin": 39, "operations-admin": 56, public: 11 }))
-    fail("R5_CONTRACT_FACE_OPERATION_CLOSURE_INVALID");
+  const reportFaceCounts = Object.fromEntries(faces.map((face) =>
+      [face, reportOperations.filter((operation) => operation.face === face).length]));
+  const catalogFaceCounts = Object.fromEntries(faces.map((face) => [face, catalog.denominator?.faces?.[face]]));
+  if (!Number.isInteger(catalog.denominator?.operations)
+    || catalogOperations.length !== catalog.denominator.operations
+    || reportOperations.length !== catalog.denominator.operations
+    || JSON.stringify(reportOperationIds) !== JSON.stringify(catalogOperationIds)
+    || JSON.stringify(report.closure?.faceCounts) !== JSON.stringify(reportFaceCounts)
+    || JSON.stringify(reportFaceCounts) !== JSON.stringify(catalogFaceCounts)) { fail(...); }
```

**止血式修复会是把 `106` 改成 `114`、把 `{39,56,11}` 改成 `{43,56,15}`。做的恰恰相反：字面量被整体删除。**
`grep -nE "\b(39|56|11|106|114|147)\b" tools/platform-boundary-gates/cli.mjs` → **零命中**。

新逻辑对两份独立工件做三重交叉：operation 总数、**operationId exact-set**、
以及**由 operations 数组重算**的 faceCounts（而不是采信 report 自报的 `closure.faceCounts`）。

**我独立重算三个分母**（不采信任何自报值）：

| 分母 | 来源 | 我的重算 | 声明值 |
| --- | --- | --- | --- |
| U01 operation closure | catalog + placement report | **114 = 43 / 56 / 15** | 一致；`operationId` 双向差集为空 |
| generated route registry | `edge-route-face-registry.json` 的 `consumerFaces` | **147 = 43 / 89 / 15** | `closure` 声明一致 |
| error-code closure | `edge-codegen.mjs:299` | 106 | 一致 |

注意 `39 + 56 + 11 = 106` ——**旧门是把 error-code 总数当成了 operation face 总数**，
problem-family 的根因判断（"conflating the error-code closure with the U01 operation-face closure"）
由这三个数字独立印证。

**红变异实测**（scratchpad 镜像，`scripts`/`tools` 用真实拷贝以保证 `dirname $0/../..` 落在镜像内；本仓零写入）：

| 变异 | 结果 |
| --- | --- |
| baseline | `R5_CONTRACT=PASS` |
| MUT-A：catalog `faces.public` 15 → 11 | **RED** `R5_CONTRACT_FACE_OPERATION_CLOSURE_INVALID` |
| MUT-B：report 少一个 operation（114 → 113） | **RED** |
| MUT-C：**改一个 operationId（数量不变，只有身份漂移）** | **RED** |
| MUT-D：**篡改 report 自报的 `closure.faceCounts`** | **RED** |

`MUT-C` 证明它不是只数个数，`MUT-D` 证明重算优先于自报值。

> **披露一次我自己的近失**：第一次红变异 baseline 与 MUT-A **都是 PASS**，我一度以为门是装饰的。
> 原因是我的镜像把 `scripts` 做成了符号链接，而 `scripts/check/contract-face` 用
> `cd "$(dirname "$0")/../.." && pwd` 解析根目录，会穿透链接回到真实仓库——**是我的实验无效，不是门无效**。
> 改用真实拷贝后四类变异全部变红。

## 2. 106 是否仍只属于 error-code closure（核验点 2）—— CONFIRMED

全仓 `106` 的出现位置（排除 node_modules/.runtime）：

- `scripts/generate/edge-codegen.mjs:299`
  `if (codes.length !== 106 || errors.closure.totalActiveTargetCount !== 106) fail("R5_EDGE_CODEGEN_ERROR_COUNT");`
  —— error-code closure，**归属正确**；
- `rm1p6-u01-contract-face-denominator-problem-family.json` 的叙述行（描述根因，非断言）。

`tools/platform-boundary-gates/cli.mjs` 中**已无 106**。职责已分离。✓

## 3. 两个 focused test 与当前 owner/source 语义（核验点 3）—— CONFIRMED

**`OperationsWorkspaceInvitationServerScopeTest`**

- `createUsesOnlyOwnerResolvedTaskPathForAssignmentIntent` 现在 stub 并 **`verify(fixture.user).resolveCommandTarget(session, "STORE", scopeRef)`**，
  且断言 intent 为 `(roleId, "STORE", targetId)`——**`targetId` 是 owner 解析出的 id，不是客户端传入的 `scopeRef`**。
  这正是当前 `OperationsWorkspaceInvitationController:60` 的语义；若有人回退到 `resolveTaskScope`
  或把 `scopeRef` 直接透传，该断言都会失败。
- 列表与候选两个用例仍走 `managementPageForOperations` / `candidatesForOperations`（读取路径），
  与 owner 侧「读取用 scope、写入用 command target」的拆分一致。**没有残留对已退役签名的 stub。**
- 该测试类在本轮远端 aggregate run 中**实际执行**（见 `§5`）。

**`PlatformAuthenticationServiceTest.administratorPageAcceptsOmittedOptionalFilters`**

```java
PlatformAdminPage page = service.pageAdministrators(null, null, null, 1, 50, "USER_NAME", "ASC");
assertTrue(page.total() >= 1);
assertTrue(page.items().stream().anyMatch(item -> item.displayName().equals("Dexter")));
```

- **三个 null 的可选过滤调用被保留**——这正是 amendment `§3.3` 那个 PostgreSQL 空值绑定缺陷的触发路径；
  该缺陷会让调用**抛异常**，因此测试仍然会红。
- 去掉的只是 `total() == 1` 这个**顺序依赖**：同类内
  `disabledPlatformAdministratorCannotExecuteAnyAdministratorGovernanceCommand` 等用例会向共享
  `@BeforeAll` 库新增管理员，`== 1` 依赖执行顺序，是真实的脆弱点。
- **owner SQL 未被放宽**：我实读
  `PlatformAuthenticationService.java:263`，`§3.3` 的显式类型转换仍在：
  `WHERE (CAST(? AS text) IS NULL OR a.display_name ILIKE ...) AND (CAST(? AS text) IS NULL OR a.login_name ILIKE ...) AND (CAST(? AS text) IS NULL OR a.status=CAST(? AS text))`。

**结论：两处都是与当前 owner 语义对齐，不是把测试改松以迁就代码。** ✓

## 4. manifest / active package / package-input / package-exit 一致性（核验点 4）—— CONFIRMED

| 绑定 | 结果 |
| --- | --- |
| `packageId` | active-package / package-input / package-exit **三处一致**：`RM1P6-JOINT-REMOTE-L2-U11` |
| `active.executionBindingPath` | 指向 package-input，路径存在 |
| `deliveryManifestSha256` | 声明 `ffb579ea…` vs 实算 `ffb579ea…` **一致**（上一轮的 `RM1_DELIVERY_MANIFEST_HASH_DRIFT` 已消除） |
| `predecessorExitSha256` | 声明 `c40a053e…` vs U10 exit 实算 `c40a053e…` **一致** |
| `dynamicEvidence` report | 声明 sha 与实算**一致** |
| `currentSourceHashes` | **44/44 与当前字节一致，0 漂移** |
| `PACKAGE_EXIT` | **`PASS`**，`CHANGED=294`，本会话直跑通过 |

**其余门 fresh 复跑**：`R5_CONTRACT=PASS; STATE=POST_GATE_0`、`R5_AFFECTED_L2=PASS`、
`R5_EDGE_CODEGEN_CHECK=PASS`、static-scan `MODE=RM1_STATIC_ADMISSION`，exit code 均为 0。
我上一轮的 `M1`（`ACTIVE_CURRENT_EVIDENCE` 打红 `affected-l2`）**已闭合**：
两个 obligation 现均为封闭词表内的 `ACTIVE_REQUIRED`，未扩展 `verify-gates` 词表。

## 5. 本机 Docker 失败是否被说成业务失败（核验点 5）—— CONFIRMED，表述正确

- 本机 Docker **确实不可用**：我实跑 `docker info` 失败。
- `scripts/test/r5-remote-testcontainers.mjs` **未被修改**（git 干净、无 diff），
  也**没有**任何 `skip` / 绕过 docker 的分支。
- author-resolution `§52` 明写「不能把该环境失败说成业务失败，也未修改 runner 去绕过它」——与事实一致。
- **失败的 run 被如实保留**，没有删除或改写：
  `r5-tc-1785557174487-25463` 仍记录
  `business: {status: FAIL, reason: REMOTE_TEST_OR_CONTAINER_CLEANUP_FAILED}`。

**两次远端受管 backend 验证我独立复核**（权威文件是 `run-manifest.json`，不是 `control.json`）：

| run | task | business | cleanup | JUnit |
| --- | --- | --- | --- | --- |
| `r5-tc-1785556947240-20774` | `:apps:backend:catering-business-server:test` | **PASS** | **PASS**（`reaped:true`） | **19 files / 66 tests / 0 failures / 0 errors / 0 skipped** |
| `r5-tc-1785557288462-27843` | `…:modules:platform-admin-iam:test` | **PASS** | **PASS**（`reaped:true`） | **2 files / 13 tests / 0 failures** |

两者 `firstFailure` 均为 `null`。`OperationsWorkspaceInvitationServerScopeTest` 与
`PlatformAuthenticationServiceTest` 分别在其中**实际执行**。

## 6. S1 ｜`resolveCommandTarget` 的 owner 内部分支仍未执行，而给出的理由已不成立

author-resolution `§23` 把 `M2` 记为 `CONFIRMED_CLOSED_WITH_EVIDENCE_BOUNDARY`，
理由是「Docker 不可用导致 `WorkspaceUserTaskScopeTest` 未执行」。
**边界表述本身是诚实的**（比上一轮明确改进），但那个理由现在不再是缺口的实际原因：

- `scripts/test/r5-remote-testcontainers.mjs:12` 接受任意 gradle task 作为
  `process.argv[2]`，`:340` 只要求匹配 `/^:[a-z0-9:-]+:test$/`；
- 本轮**已经两次**用它在远端跑 Testcontainers 模块测试
  （`:modules:platform-admin-iam:test` ×2），7 月 31 日还跑过 `:modules:organization:test`；
- 但 **`:modules:workspace-iam:test` 本轮一次都没有远端执行**，
  而 `WorkspaceUserTaskScopeTest`（含 `:62` 唯一覆盖 `resolveCommandTarget` 的用例）就在该模块。

**影响面**：`resolveCommandTarget` 的 controller 接线现在有执行证据
（aggregate run 里 `OperationsWorkspaceInvitationServerScopeTest` 通过，且用 mock 严格 verify 了方法与目标）；
**缺的是 owner 内部那段** ——「显式 target 必填 + 按真实类型解析 + `isScopeAllowed`」。
该段代码我逐行读过，是 fail-closed 的，但仍属未执行。

**最小修复（一条命令，用既有 runner，不新增基建）**：

```
node scripts/test/r5-remote-testcontainers.mjs :apps:backend:catering-business-server:modules:workspace-iam:test
```

跑通后把 `§23` 的理由由「Docker 不可用」改为实际执行结果即可。
**是否需要 Dexter 产品裁决**：否。

## 7. N

**N1 ｜两次远端 backend run 未被 package-exit 绑定**

它们只出现在 author-resolution `§54` 的散文里；`package-exit.json` 的 `dynamicEvidence`
只有 19-spec L2 一条，也没有 `staticEvidence` 字段。相比该包对 L2 的绑定标准
（reportPath + reportSha256 + 44 条 currentSourceHashes + log sha256），这两次 run
**既无路径也无 hash**。我能在几分钟内定位并从 `run-manifest.json` 独立复核为真，故只判 `N`。
**建议**：exit 补一条 `{runId, manifestPath, manifestSha256, task, business, cleanup}`，
避免后续会话只能靠散文取信。

**N2 ｜`control.json` 的 `phase` 停在 `PROCESS_STARTED`，权威状态在 `run-manifest.json`**

两次 run 的 `control.json` 都是 `phase: "PROCESS_STARTED"`，终态并未回写；
真正的 `business`/`cleanup`/`firstFailure` 在 `run-manifest.json`。
这是个诱导性陷阱——我在 U04 复核时就差点据 `control.json` 误报「无证据」。
**建议**：终态回写 `control.json`，或在证据引用处显式标注权威文件名。
（该性质早于本轮，不由本轮引入。）

## 8. 处置

- **`S1`** 在既有批准边界内，Codex 可自主处置；建议与下一次远端验证一并完成。
- **`N1`/`N2`** 均为记账/可追溯性建议。
- **不得回退**：contract-face 的派生式校验与其四类红变异能力、106 的职责分离、
  两个 focused test 与当前 owner 语义的对齐、`§3.3` 的显式类型转换、
  完整的 hash 链一致性、以及两次远端 backend run 的 PASS/CLEANUP PASS。
- **本复核不构成**：UAT、DEV、seed/reset、Roadmap 状态变更或 Git 操作授权。
  ST-11 仍是未关闭的继承债务；第二轮对抗审查的硬停止我予以尊重，本文件不开启第三轮。
