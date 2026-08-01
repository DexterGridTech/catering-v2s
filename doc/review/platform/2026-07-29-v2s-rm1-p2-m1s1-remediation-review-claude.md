---
title: RM1 P2 的 M1/S1 整改定向复核（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1-P2 / RM1-U06 的 M1（Flyway 迁移安全）与 S1（证据诚实性）整改
verdict: GO
findings: M=0 / S=0 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅评审与只读/受管验证；不进入 P4-P8，不做 DEV、seed、reset、迁移写入或产品范围裁决
createdAt: 2026-07-29
---

# RM1 P2 的 M1/S1 整改定向复核

## 0. 结论

**GO**，`M=0 / S=0 / N=3`。

M1 与 S1 **均已真实关闭**。六个指定核验点全部 CONFIRMED，其中：

- **迁移安全是被运行时证明的，不是被文档声明的**——六次受管 Testcontainers 运行的
  `TEST-*.xml` 显示实际执行了 **22 个用例、0 失败**；若 Flyway 路径仍断，
  这些测试会在 migration 阶段直接失败。
- **首次失败没有被抹除**——失败 run 的目录完整保留，`gradle.log` 是 `BUILD FAILED`，
  `TEST-…WorkspaceInvitationPublicFlowTest.xml` 里 `failures=2`。
- **修复是真收窄不是弱化**——计数改为 `WHERE source_invitation_id=?`，
  断言仍是 `assertEquals` 严格相等，没有降级为 `>=` 或删除。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）；
全部变异在 scratchpad 完整拷贝上进行，用后即弃。未重开任何既有独立子 agent review cycle。

**授权边界**：仅评审与只读/受管验证。不进入 P4–P8，不做 DEV、seed、reset、
迁移写入或产品范围裁决。

---

## 1. 点 1 ｜Flyway 分母与路径解析 —— `CONFIRMED`

**owning source**：`apps/backend/catering-business-server/modules/*/src/test/**/*.java`

**反例搜索范围**：`apps/` 与 `libraries/` 全部 `*.java` / `*.kt`，排除 `**/build/**` 与 `node_modules`。

```
含 filesystem: 的 active test 文件 : 8
旧 ../../../ 前缀残留             : 0
新 ../../src/main/resources/db/migration : 8
```

8 个文件与上一轮点名的 8 个完全一致（`OrganizationOwnerServiceTest`、
`ExtensionDefinitionServiceTest`、`PlatformAssetServiceTest`、`ContractCommandServiceTest`、
`PlatformAuthenticationServiceTest`、`WorkspaceRoleServiceTest`、
`WorkspaceInvitationPublicFlowTest`、`WorkspaceUserTaskScopeTest`）。

**六个 module projectDir 下的解析，逐个实测**（`cd <module> && cd ../../src/...`）：

```
规范 root: apps/backend/catering-business-server/src/main/resources/db/migration
asset / extension / organization / platform-admin-iam / store-contract / workspace-iam
  → 6/6 全部解析至同一唯一 root
```

（上一轮同一实测为 **6/6 全部失败**，形成完整前后对照。）

---

## 2. 点 2 ｜`flyway-test-locations` 门与红变异 —— `CONFIRMED`

**owning source**：`scripts/check/flyway-test-locations`；`tools/verify-gates/cli.mjs:502-522`

**实跑**：

```
scripts/check/flyway-test-locations            → R5_FLYWAY_TEST_LOCATIONS=PASS / DENOMINATOR=8 / EXIT=0
scripts/check/flyway-test-locations --self-test → R5_FLYWAY_TEST_LOCATION_RED=PASS
                                                  R5_FLYWAY_TEST_LOCATION_SELF_TEST=PASS / EXIT=0
```

**门的形状（逐行读）**：`expected` 是硬编码的 8 条路径**锚点**，
`candidates` 由扫描 `modules/**/src/test/**` 中同时含 `Flyway.configure()` 与 `filesystem:` 的文件**派生**，
两者做 exact-set；随后逐文件要求「恰 1 个 location」且
`path.resolve(base, moduleRoot, location) === expectedRoot` 且该 root 存在。

> 此处硬编码 8 条**不是** ST-7 那类会静默变陈旧的分母——
> 增删任一 Flyway 测试都会立即 `DENOMINATOR_DRIFT` 红，强制有意识更新。锚点方向正确。

**独立红变异（scratchpad，四类，不采信 self-test）**：

| 变异 | REASON | EXIT |
| --- | --- | --- |
| A 把 organization 路径回退为 `../../../` | `R5_FLYWAY_TEST_LOCATION_RESOLUTION_INVALID:<该文件>` | 1 |
| B 新增第 9 个 Flyway 位置 | `R5_FLYWAY_TEST_LOCATION_DENOMINATOR_DRIFT` | 1 |
| C 删掉一个既有 Flyway 测试 | `R5_FLYWAY_TEST_LOCATION_DENOMINATOR_DRIFT` | 1 |
| D 某文件写两个 `filesystem:` 位置 | `R5_FLYWAY_TEST_LOCATION_RESOLUTION_INVALID:<该文件>` | 1 |

四类均**具名**红并还原后回到 PASS。

> **披露**：变异 B 首次构造失败（我把探针文件放在 `src/test/` 而非 `src/test/java/`，
> 且未含 `Flyway.configure()`，因而不进 `candidates`）。**那是我的构造错误，不是门的缺陷**；
> 更正构造后 B 正确变红。记录以免后续会话误判。

---

## 3. 点 3 ｜六次受管运行的动态证据 —— `CONFIRMED`

**owning source**：`doc/evidence/platform/rm1/p2/rm1-u06-flyway-relocation-dynamic-evidence.json`；
`doc/evidence/platform/rm1/p2/rm1-u06-package-exit.json` 的 `dynamicEvidence`

**六条逐项复算**（`currentSourceHashes` / `log.path` 存在性 / `log.sha256` / `result` / `cleanup`）：

| suite | result | cleanup | source hash 不符 | log 存在 | log.sha256 |
| --- | --- | --- | --- | --- | --- |
| `…:asset:test` | PASS | PASS | 0 | 是 | 一致 |
| `…:extension:test` | PASS | PASS | 0 | 是 | 一致 |
| `…:organization:test` | PASS | PASS | 0 | 是 | 一致 |
| `…:platform-admin-iam:test` | PASS | PASS | 0 | 是 | 一致 |
| `…:store-contract:test` | PASS | PASS | 0 | 是 | 一致 |
| `…:workspace-iam:test` | PASS | PASS | 0（3 个 hash） | 是 | 一致 |

**不接受静态 hash 替代动态证据 —— 故另行抽验 log 实体内容**：

```
r5-tc-1785249839449-9478（organization）  : BUILD SUCCESSFUL, 2 个 TEST xml, 用例 5, 失败 0
r5-tc-1785250133978-14863（workspace-iam）: BUILD SUCCESSFUL, 4 个 TEST xml, 用例 17, 失败 0
```

**测试确实执行了。** 这也是 M1 修复有效的**运行时证明**——
若 Flyway 路径仍断，这些测试会在 migration 阶段失败而非通过。

`validateRequiredDynamicEvidence`（`cli.mjs:598-605`）还机械要求每条含
`runner` / `suite` / `result === "PASS"` / `cleanup === "PASS"` /
非空 `currentSourceHashes` / `log.path` / `log.sha256` 为 64 位十六进制。

---

## 4. 点 4 ｜首次失败未被抹除，且修复是真收窄 —— `CONFIRMED`

**owning source**：动态证据的 `failedAttemptDisposition`；
`.runtime/r5/evidence/remote-testcontainers/r5-tc-1785250000184-12399/`；
`…/modules/workspace-iam/src/test/java/…/WorkspaceInvitationPublicFlowTest.java:109`

**失败被如实登记**：

```json
{"run": "r5-tc-1785250000184-12399",
 "status": "DIAGNOSED_NOT_RETAINED_AS_PASS",
 "reason": "Class-global assignment assertion was narrowed to source_invitation_id; replacement run passed.",
 "cleanup": "PASS"}
```

**失败证据实体完整保留**（本会话核验，非只读声明）：

```
r5-tc-1785250000184-12399/
  gradle.log                  → BUILD FAILED
  TEST-…WorkspaceInvitationPublicFlowTest.xml → failures=2 errors=0
  TEST-…WorkspaceRoleServiceTest.xml / …WorkspaceUserTaskScopeTest.xml /
  …WorkspaceCapabilityScopeResolverTest.xml
  cleanup-result.txt / runner-result.txt / test-result-collection.txt / uncollected-container-ids
```

**修复本身是收窄，不是弱化**（`WorkspaceInvitationPublicFlowTest.java:109`）：

```java
private static int assignments(UUID invitationId) {
    return jdbc.queryForObject(
        "SELECT COUNT(*) FROM workspace_iam.role_assignment WHERE source_invitation_id=?",
        Integer.class, invitationId);
}
```

计数被限定到**该邀请**，消除 class-level DB fixture 的全局计数带来的测试顺序依赖。
断言侧仍为严格相等（`assertEquals(0, assignments(...))`、`assertEquals(1, assignments(...))`），
**未见** `>=`、未见注释掉、未见删除断言。替代 run（`r5-tc-1785250133978-14863`）
`BUILD SUCCESSFUL`、17 用例 0 失败。

---

## 5. 点 5 ｜业务声明诚实且被机械强制 —— `CONFIRMED`

**owning source**：`rm1-u06-package-exit.json`；`rm1-u06-package-input.json:22`；
`tools/compliance-control/cli.mjs:585-605`

```
business                   = "NOT_APPLICABLE"
businessReason             = "P2 changes no end-user task, API, data shape or migration semantics;
                              six current-byte managed Testcontainers suites are mandatory
                              technical relocation evidence."
dynamicEvidence            = 6 条
businessEvidenceObligation = "REQUIRED_CURRENT_BYTE_TECHNICAL_RELOCATION"（声明于 package-input）
```

**该 obligation 的强制语义（新增分支，直接回应上一轮 S1）**：

```js
const requiresTechnicalRelocationEvidence = obligation === "REQUIRED_CURRENT_BYTE_TECHNICAL_RELOCATION";
if (requiresTechnicalRelocationEvidence) {
  if (exit.business !== "NOT_APPLICABLE" || typeof exit.businessReason !== "string"
      || exit.businessReason.length === 0) throw new Error("TECHNICAL_RELOCATION_BUSINESS_DECLARATION_INVALID");
}
if ((requiresTechnicalRelocationEvidence ? exit.business !== "NOT_APPLICABLE" : exit.business !== "PASS")
    || !Array.isArray(exit.dynamicEvidence) || exit.dynamicEvidence.length === 0) {
  throw new Error("BUSINESS_EVIDENCE_REQUIRED_DYNAMIC_EVIDENCE_MISSING");
}
```

即：技术搬迁分支下 `NOT_APPLICABLE` **必须**配非空 `businessReason` **且**非空 `dynamicEvidence`，
**且不得升格为 `business PASS` 来绕开理由要求**——这正是点 5 要求的"不能伪装为 business PASS"。

**独立红变异（scratchpad，四类，各自具名且互不相同）**：

| 变异 | REASON |
| --- | --- |
| A 清空 `dynamicEvidence` | `BUSINESS_EVIDENCE_REQUIRED_DYNAMIC_EVIDENCE_MISSING` |
| B 改为 `business: "PASS"` | `TECHNICAL_RELOCATION_BUSINESS_DECLARATION_INVALID` |
| C 清空 `businessReason` | `TECHNICAL_RELOCATION_BUSINESS_DECLARATION_INVALID` |
| D 某 run 改 `result: "FAIL"` | `BUSINESS_EVIDENCE_DYNAMIC_SCHEMA_INVALID` |

四类均红，还原后 PASS。

---

## 6. 点 6 ｜exit 一致性与三条机械复跑 —— `CONFIRMED`

```
actualChangedPaths : 330      incrementalChecks : 330      exact-set 相等 : True
afterSha256 与当前字节不符 : 0
```

| 命令 | 结果 |
| --- | --- |
| `validate-delta-receipts` | `INCREMENTAL_RECEIPT_COVERAGE=PASS` / `PACKAGE_ID=RM1-U06` / `CHANGED=331` / `RECOVERED=0` |
| `validate-package-exit`（干净基线） | `PACKAGE_EXIT=PASS` / `CHANGED=330` / `SOURCE_DISPOSITION_ROWS=31` / `REAL_EXIT=0` |
| `static-scan` | `REMEDIATION_COMPLIANCE=PASS` / `RULES=31` / `MODE=RM1_STATIC_ADMISSION` |

`CHANGED=331` 比 exit 的 330 多 1，为本评审 prompt 自身的 intake（见 N3）。

---

## 7. N（观察项，不阻塞）

**N1 ｜`businessEvidenceObligation` 仍由 package-input 声明，而非从变更面派生**

`REQUIRED_CURRENT_BYTE_TECHNICAL_RELOCATION` 写在
`rm1-u06-package-input.json:22`，由作者填写；`cli.mjs:587` 对
`obligation === undefined` 直接 `return`。
故未来某个包仍可通过**省略该字段**跳过全部动态证据要求。

**本轮 U06 的声明是正确的**（六条动态证据齐备且实测有效），故不构成 finding。
但这与 P1 复核记录的 N1 是同一形状——建议在 P8 前统一为「从 `actualChangedPaths`
是否触及模块 `src/main` 派生 obligation」，或补一条交叉控制。
**适用边界**：仅影响未来包的自我豁免可能性，不影响 U06 当前结论。

**N2 ｜`gradlew` 仍不存在，本会话未独立重跑六个 suite**

本机 `./gradlew` 不可执行（P0 遗留欠账）。故点 3 的核验方式为：
逐条复算 `currentSourceHashes` 与 `log.sha256`、确认 log 目录存在、
并**抽验 `gradle.log` 与 `TEST-*.xml` 的实体内容**（构建结论、用例数、失败数）。
这比只核 hash 强，但**不等同于本会话重跑**。
标 `VERIFIED_BY_ARTIFACT_INSPECTION_NOT_BY_RERUN`。

**N3 ｜真仓 `validate-package-exit` 会因本评审 prompt 而红**

与前几轮同型：`.runtime/compliance-control/current-problem-intake.json` 是本次评审 prompt，
无 disposition 即触发 `PROBLEM_FAMILY_DISCOVERY_REQUIRED`。
本会话在 scratchpad 完整拷贝中仅移除该 intake 后取得干净基线 `PACKAGE_EXIT=PASS`。
**不构成 finding**，仅作出处披露。

---

## 8. 处置

**M=0 / S=0 / N=3。** 无需 Dexter 产品裁决。

**RM1 P2 的 M1/S1 整改可 GO。**

**本复核不授权**：进入 P4–P8、DEV、seed、reset、迁移写入、产品范围裁决，
也未重开任何既有独立子 agent review cycle。
