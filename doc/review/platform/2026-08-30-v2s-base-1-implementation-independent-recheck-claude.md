# base-1 实施独立复核(第四次)· GO_WITH_UNVERIFIED_UI(M=0 / S=1 / N=3)

```text
VERDICT=GO_WITH_UNVERIFIED_UI
M=0  S=1  N=3
BLIND_REVIEW=FALSE
```

**会话出处**:fresh v2s-rooted 只读复核。所有 digest 与分母由我重算,未采信任何 report、manifest
或来函正文的自报值。**利益边界**:此前三轮 review 与 base-1 需求稿由我撰写,本文对它们不构成独立审查;
对实现、生成链与运行时证据的核验是独立的。

---

## 结论

**GO_WITH_UNVERIFIED_UI**。上一轮唯一的 M(L2 业务证据与字节绑定分处两个 run)**已彻底闭合**,
且闭合方式是我能想到的最强形式。无 M 级阻断。

唯一的 S 是**证据时效性的结构性缺口**:字节绑定这套机制只建在 browser L2 上,
backend-acceptance 与 CP05 这一类证据没有对应机制 —— 这正是来函第 6 项问的
「会不会重新进入修一个、暴露另一个」。

---

## L1_ENGINEERING

### 上一轮 M-1 已闭合(以最强形式)

`.runtime/browser-l2/l2-1788035759833-23472-fe934b98-fbe8-4869-ada0-f917b17b1a23/` **同一个 run 目录内**同时具备:

- `l2-execution-manifest.json`:`results=24`、`business=PASS`、`cleanup=PASS`、
  `firstFailure=null`、`brokenBoundary=null`、`lastKnownGood=L2_24_CASES_PASS`、`cleanupErrors=[]`;
- `l2-cleanup-manifest.json`:`business=PASS`、`cleanup=PASS`;
- `readiness-manifest.json`:`businessStatus=PASS`、`setupCleanupStatus=PASS`、
  `cleanupStatus=PENDING_HELD`(run 期间正确挂起);
- `repository-byte-binding.json`。

**binding digest 我独立重算并复现**:按 `scripts/test/browser-l2-runtime.mjs` 第 574–576 行的
`sha256(JSON.stringify(descriptor, null, 2) + "\n")`,去掉 `bindingDigest` 后重算得
`69a77827010f9130417d28ee2469d0dfd8c29db3609ea33b9bff84bb03cc9fcc`,**与声明值逐字符相同**。

**并且我做了全量而非抽样的漂移复算**:对 binding 内 **3727 个文件**逐个重算 sha256 并与当前磁盘比对 ——
**漂移 0、缺失 0**。这比时间戳更硬:运行时刻的字节与当前字节相同,不需要依赖 mtime 推断。

### 生成链、CP05、受控例外均保持

- CP05 report 仍为同一份(`generatedAt=2026-08-29T05:01:45.721Z`),
  `blockedCount=0`、`readyCount=238`、`business=PASS`、`cleanup=PASS`;
- `categories.P3` 恰好 **12** 条,**与 Dexter 裁决清单集合相等**(判定 True);
- 受控例外的 scope、`record.to === measuredMax`、`IMPLEMENTATION_AGENT` 单 operation 限制均未松动;
- 事务、幂等、锁、typed problem、审计与 authoritative readback 的 owner 侧机制,
  本轮未见任何削弱迹象(此前已在 `WorkspaceInvitationService` 源码亲验)。

### seed 分母与关联 —— 逐项成立

`.runtime/r5/catalog-inventory/seed/catalog-seed-12682505-.../seed-report.json` 实测:
`sourceItems=73`、`createdItems=72`、`excludedItems` 长度 1、`mediaAssets=34`;
`72 + 1 = 73` 闭合。计划侧 `catalog-inventory-seed-plan.json` 的
`sourceItems(73) / eligibleSourceItems(72) / excludedSourceItems(1) / mediaPlan(34)` 与之一致。

被排除的 1 项是 `BENEFIT-MEMBER-VOUCHER-001`(`shapeKey: BENEFIT_SHELL`),
理由「权益域尚未开放」—— 与语料库「权益类最重、留未来」一致,**是合法排除而非掩盖失败**。

**parent/child 关联成立**:complete-seed、catalog-seed、r5-dev 三份 manifest 携带同一
`managedDevRunId = r5-dev-1788036458177-27711-…`;`planDigest = 0fb7bd85…` 在 plan、
run-manifest、seed-report **三处一致**。

**API/DB completeness 成立**:DEV seed `apiCallCount 205 === reportedApiCallCount 205`、
`outOfScopeDatabaseEventCount 0`、`unmatchedHttpEvents`/`unmatchedDatabaseEvents` 均空、
`nonApiStageIds` 与 `expectedNonApiStageIds` 相等;catalog seed `1265 === 1265`、两个 unmatched 均空。
`noDirectDatabaseWrites = true`,seed 只走 owner command。

`cleanupStatus` 语义分层正确:reset 为 `PASS_NO_PERSISTENT_RESET_PROCESS`,
DEV 为 `PASS_NO_PERSISTENT_SEED_PROCESS`,seed 为 `PASS_PRESERVED_DEV_STATE` ——
三者含义不同且各自贴合其生命周期,没有用一个笼统 PASS 糊过去。

---

## S-1 · 字节绑定机制只建在 L2,backend-acceptance 与 CP05 这一类证据没有对应机制

**等级** S · **CONFIRMED** · **这是来函第 6 项问的那个结构性缺口**

**owning source**:`scripts/test/browser-l2-runtime.mjs` 第 578 行起的 `writeRepositoryByteBinding`
(只被 L2 调用);`.runtime/r5/evidence/remote-testcontainers/*/run-manifest.json` 无对应字段。

**仓内事实**:

- 三次 CP05 calibration run(`r5-tc-1787978821050-31610` 等)目录内**均无** `repository-byte-binding.json`;
- 其 run-manifest 只有 `sourceSync = {status: PASS, workspace: /tmp/…}` —— 记录"同步发生过",
  **不是源码字节摘要**;`replayIdentity.sourceManifestDigests` 摘的是 run manifest 与事件文件,不是仓库源码;
- 按 mtime 统计,**晚于 CP05 测量时刻(05:01:45Z)被修改的后端主源码 Java 有 335 个**,
  含 `OrganizationCommandService.java`、`BusinessEntityService.java` 等直接执行 DB 操作的 owner。

**⚠️ 我不据 mtime 断言内容已变**(mtime 变不等于字节变)。我能断言的是:
**没有任何机制能判定 CP05 的测量是否仍绑定当前字节** —— 而同一个问题在 L2 上已经有了解法。

**影响面**:CP05 的 `blockedCount=0` 与 12 条受控例外的实测上限(26/29/28/30…)是整个预算门的承重证据。
若重测后任一 P3 成员超过其记录上限,门应当变红。当前无法判定该结论是否仍成立。

**可证伪的失败条件**:在当前字节上重跑三次 CP05 calibration;
若 `blockedCount` 仍为 0 且 12 条上限与现记录一致,则本条消解;若任一项不同,则现记录已过期。

**最小根因修复**:把 `writeRepositoryByteBinding` 复用到受管 Testcontainers run 的产物里
(它已是现成能力,不是新建基建),使该类证据也能被"当前字节可重算"判定。
**为什么更小的替代不足**:只重跑一次 CP05 能让今天的数字变新,但**下一次源码变更后同样的问题会再次发生**
—— 那正是"修一个、暴露另一个"。补机制才是根因修复;只重跑是止血。

**是否需要 Dexter 决策**:补机制不需要;重跑 CP05 需要一次运行授权(本文无此授权)。

---

## SAME_ROOT_SCAN

我按"字节绑定缺失"这一根因做了跨证据类扫描,结果如下:

- **browser L2** —— 已有绑定,全量 3727 文件重算漂移 0。**已修复。**
- **受管 Testcontainers / CP05** —— **无绑定**。见 S-1。
- **backend-acceptance 业务运行** —— 最近一次带 business 判定的是 `r5-tc-1788031506396-60760`,
  `2026-08-29T19:25:06Z`,`business=PASS`、`status=PASS`、`mode=ACCEPTANCE`。
  晚于它被修改的后端主源码 Java **只有 2 个**
  (`CatalogInventoryWorkspaceCommandTokens.java` 20:40:08Z、
  `InventoryCatalogReferenceDeclarations.java` 20:40:03Z),另有 7 个测试 Java、44 个契约 JSON。
  **风险面很窄**,见 N-1。
- **DEV / seed / reset** —— 三者以 `managedDevRunId` 与 `planDigest` 互绑,时序在 20:48 之后,
  晚于全部源码变更,**无同类缺口**。

⚠️ **口径更正(我自己的)**:我在核验中先算出"335 个后端主源码变更",那是相对 **CP05 测量时刻**;
相对**最近一次 backend-acceptance 业务运行**只有 **2 个**。两类证据时效性不同,不可混用同一个数字。

---

## L2_USER_VISIBLE

browser L2 的 24 个 active case 覆盖 8 个 workbench 场景 ×(success / failure / recovery):
`catalog-find`、`catalog-view`、`catalog-create`、`catalog-edit`、`catalog-config`、
`catalog-batch`、`catalog-copy`、`catalog-governance`。**失败与恢复路径都在分母内**,
不是"页面能打开"。该 run 同时具备 HTTP 事件、DB 事件与 join artifact,业务与 cleanup 分层记录。

分母未被偷换:`denominators` 仍为 `scenarios 26 / policyCases 65 / activeCases 24`;
`scripts/verify` 本会话输出 `API_SCENARIOS=26/99`、`L2_SCENARIOS=26/65`,与之一致。

---

## L3_UNVERIFIED

- **`scripts/verify --validate-only` 我无法在本会话跑完** —— 首败是 `backend-archunit`,
  但根因是评审主机报 `Unable to locate a Java Runtime`,**这是我的机器缺 JRE,不是仓库缺陷**。
  在此之前的门(UI wireframe、business terminology、code layout、catalog-inventory-p1、
  runtime environment keys 等)在我的运行里均为 PASS。
  **我不能独立确认"verify 在测试前 PASS"**,标记 `UNVERIFIED_REQUIRES_EVIDENCE`;
  请提供实施侧那次 verify 的完整输出与其时间戳。
- **24 个 L2 case 之外的 UI 未审**:两个 App 的其余页面、三态治理页、四个新 transition 的操作路径,
  本轮无证据也未审,标记 `UNVERIFIED`。这是 `GO_WITH_UNVERIFIED_UI` 中 "UNVERIFIED_UI" 的确切含义。
- **UAT 未执行也未被声称** —— 本轮所有产物均未把 DEV、L2 或 Testcontainers 称作 UAT,正确。

---

## N 级

**N-1 · 2 个后端主源码晚于最近一次 backend-acceptance 业务运行** ·
`UNVERIFIED_REQUIRES_EVIDENCE`。
`modules/execution-context/.../CatalogInventoryWorkspaceCommandTokens.java`(20:40:08Z)与
`modules/inventory/.../InventoryCatalogReferenceDeclarations.java`(20:40:03Z)。
二者从命名看是 token/declaration 类,**我不推断其是否影响 DB 操作数**。
最小修复:一次 backend-acceptance 复跑即可判定;若确认无影响也应留下该判定记录。

**N-2 · `.runtime/r5/run-manifest.json` 仍含本机绝对路径** · `CONFIRMED`。
`portLock`、`seedEventsPath`、`dbOperationsPath`、`credentialsFile`、`readinessProgressPath`
等字段均为 `/Users/dexter/Documents/workspace/idea/catering-v2s/…`。
L2 侧的同类问题上一轮已修为仓库根相对,**DEV run manifest 这一类未同步修**。
不影响业务正确性,但仓规禁止交付物含本机绝对路径,且它使该产物在别的工作副本上不可复核。

**N-3 · `outOfScopeDatabaseEventCount` 只报不设门** · `PARTIALLY_CONFIRMED`。
catalog seed 报 205,恰等于父 DEV run 的 `apiCallCount` 205,按 correlation 分域归因是自洽的;
且 `scripts/test/seed-report.mjs` 第 194 行的 `complete` 判据不含该字段,属**有意只报不判**。
风险在于:若某个本应在域内的事件被错判为域外,该计数会静默吸收它。
建议至少对"域外事件是否全部可归属到某个已知 parent run"加一条断言。

---

## DESIGN_GAPS

1. **证据类之间的绑定能力不对称**(S-1)。同一条"运行时证据必须绑定当前字节"的规则,
   在 L2 有可执行机制,在 Testcontainers/CP05 只有口头约束。规则若只在一处可执行,
   它在别处就不是规则而是期望。
2. **`outOfScopeDatabaseEventCount` 缺归属断言**(N-3)。分域是对的,但"域外"目前是终点而非可追溯集合。
3. **绝对路径在产物中的处置不统一**(N-2)。L2 已改相对,DEV 未改;同一约束应一次性覆盖同类产物。

以上三条都不需要 Dexter 的产品或 Journey 决策,属工程一致性。

---

## EVIDENCE_TIER

| 层 | 本轮状态 |
| --- | --- |
| static / generated / focused | 生成链 PASS(edge-codegen、openapi-contracts 上一轮已验);`verify` 因主机缺 JRE 未跑完,`UNVERIFIED` |
| 受管单元/应用测试 | `catalog-inventory-backend-unit-tests.json` `status=PASS`、`business=PASS`、`cleanup=DELEGATED_TO_MANAGED_RUN_MANIFESTS` |
| 真实 HTTP / backend-acceptance | 最近一次业务运行 19:25:06Z,`business=PASS`、`status=PASS`;晚于它有 2 个主源码变更(N-1) |
| browser L2 | 同 run 内 24/24 + business PASS + cleanup PASS + 字节绑定,3727 文件重算零漂移 |
| reset / DEV / seed | reset、DEV、complete-seed、catalog-seed 四段均 PASS,以 `managedDevRunId` 与 `planDigest` 互绑 |
| UAT | **未执行,未声称** |

**分层未被跨越**:business 与 cleanup 逐层分开;静态 PASS 未被写成运行时 PASS;
HTTP 状态码未被当作业务通过;历史 run 未被当作当前证据(S-1 恰恰是我据此提出的)。

---

## 授权边界

本文只是独立外部复核结论。`GO_WITH_UNVERIFIED_UI` **不构成**产品或 Journey 变更、Roadmap 推进、
UAT、部署、数据操作或任何仓库控制动作的授权,也不等于对 24 个 L2 case 之外 UI 的接受。
S-1 的机制修复不需要 Dexter 决策;CP05 重跑需要一次运行授权,该授权不在本文范围内。
