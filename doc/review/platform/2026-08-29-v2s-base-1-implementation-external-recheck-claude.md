# base-1 实施外部复核(第三次)· NO-GO(M=1 / S=0 / N=3)

```text
BLIND_REVIEW=FALSE
VERDICT=NO-GO
M=1  S=0  N=3
```

**会话出处**:fresh v2s-rooted 只读复核。所有门在本会话内新鲜复跑,所有 digest 由我自己重算,
未采信任何 report、artifact 或请求正文里的自报值。**利益边界**:上一轮 NO-GO 与 base-1 需求稿由我撰写,
本文对它们不构成独立审查;对实现、生成链与运行时证据的核验是独立的。本文不属于
independent-subagent 两轮对抗审查流程,未使用该流程的任何字段。

---

## 结论

**NO-GO**,唯一 M 是**运行时证据与当前字节不绑定**:没有任何一次 browser L2 run
同时具备「24/24 业务通过」与「repository byte binding」。

上一轮的 M-1(生成链漂移)**已真实闭合**,A、C、D 三项全部通过且我独立重算复现。
B 项的**机制**做对了,但**用在了没有跑业务的 run 上**。

---

## M-1 · 24/24 的 L2 业务证据早于本轮生成物重生成,且与字节绑定分处两个 run

**等级** M · **CONFIRMED**

**owning source**:`.runtime/browser-l2/` 下的 run 目录集合;
`scripts/test/browser-l2-runtime.mjs` 的 readiness / execution / cleanup 三段产物划分。

**仓内事实(全量清点 106 个 L2 run 目录,非抽样)**:

- 带 `repository-byte-binding.json` 的只有 **3 个**目录,其中两个是真 run
  (`l2-1787985035050-60601-…`、`l2-1787985390871-64861-…`),另一个是 focused 夹具目录;
- **这两个 run 都没有 `l2-execution-manifest.json`**,其 `l2-cleanup-manifest.json` 均记录
  `business = NOT_RUN`、`firstFailure = L2_RUNTIME_CLEANUP_RECOVERY`、
  `brokenBoundary = L2_RUNTIME_INTERRUPTED_BEFORE_NORMAL_CLEANUP`;
- 最近一次 `results=24 / business=PASS / cleanup=PASS` 是 `l2-1787982130397-11538-…`,
  该目录**没有** `repository-byte-binding.json`,`finishedAt = 2026-08-29T05:52:03.929Z`;
- 本轮修复 M-1 的 `edge-route-face-registry.json` 重生成于 **2026-08-29T06:16:07Z**,
  **晚于**上述 24/24 证据 24 分钟;两次带字节绑定的 readiness 分别创建于 06:34:33Z 与 06:40:18Z。

**推论**:当前树的 browser L2 业务证据产生于**本轮生成物变更之前**,而唯一能证明"绑定当前字节"的
两个 run **没有跑业务**。二者不能相互替代 —— 字节绑定证明的是环境,不是业务结果。
这正是字节绑定机制被引入时要防的情形。

**可证伪的失败条件**:存在一个 run 目录,同时满足 (a) `l2-execution-manifest.json` 的
`results=24 && business=PASS && cleanup=PASS`,(b) 同目录存在 `repository-byte-binding.json`
且其 `bindingDigest` 覆盖当前字节、抽验零漂移。当前**不存在**这样的目录。

**最小修复**:在当前字节上重跑一次完整 browser L2(readiness → 24 cases → cleanup),
使字节绑定与业务结果落在同一个 run。这是一次执行动作,不是设计改动。

**为什么更小的替代不足**:把两个 run 的产物"并列引用"不成立 ——
24/24 是在 registry 重生成之前的树上得到的,无法证明重生成后的树仍然通过;
把字节绑定文件复制进旧 run 目录则是伪造绑定。**二者都不能替代一次真实重跑。**

**是否需要 Dexter 裁决**:否,但需要他授权一次运行(本文无此授权)。

---

## 独立确认成立(逐项亲验,数字均由我重算)

### A · CP05 digest 三者一致 —— 成立,且我独立重算复现

我按 `scripts/generate/backend-performance-budget.mjs` 第 833–856 行的规则
(`stableValue` 递归键排序 → 去掉顶层 `generatedAt` 与 `replayIdentity.contentDigest` → sha256)
**自己重算**,得到:

```
① 我独立重算的 canonical digest      0c427edd94b857404f023fe2c9ed8fb12fedd5983ed5507dd02ff9aee0a33211
② report.replayIdentity.contentDigest 0c427edd94b857404f023fe2c9ed8fb12fedd5983ed5507dd02ff9aee0a33211
③ registry.calibrationReportDigest    0c427edd94b857404f023fe2c9ed8fb12fedd5983ed5507dd02ff9aee0a33211
```

**三者逐字符相同。** 原始文件 SHA256 为 `74b2f5e0…`,与 canonical 不同**确属设计**:
第 850–854 行的 `reportDigestPayload` 明确排除 `generatedAt` 与 `replayIdentity.contentDigest`。
另 `readCp05CalibrationReport` 第 882–883 行**重算并在不等时 fail closed**
(`BUDGET_CP05_REPLAY_DIGEST_MISMATCH`),report 不可能带着过期的自我 digest 通过。

`catalog-inventory-edge-route-registry.json` 的顶层键为
`schemaVersion / kind / revision / generatedFrom / contractDigest / operations` ——
**没有 `calibrationReportDigest` 字段**,属其自身 owning generator 的 `contractDigest` 语义,
不应被要求等于 CP05 digest。

**本会话新鲜运行**:`scripts/check/edge-codegen` → `R5_EDGE_CODEGEN_CHECK=PASS FILES=313`,退出码 0;
`scripts/check/openapi-contracts` → `R5_OPENAPI_CONTRACTS=PASS`,退出码 0。**上一轮 M-1 已闭合。**

### C · 12 个 status pointer 逐项对照 —— 成立

`node scripts/check/base1-catalog-unit-status-pointer-reconciliation.mjs --check` 本会话运行:
`BASE1_STATUS_POINTER_RECONCILIATION=PASS; POINTERS=12`,退出码 0。

artifact 实测:12 条,`status` 全为 `PASS`,`allExactSetComparisons: true`;
before 值集 12 条全为 `(ENABLED, DISABLED)`,after 值集 12 条全为 `(ENABLED, DISABLED, VOIDED)`。
**after 的 provenance 是 `CURRENT_REPOSITORY_BYTES`**,并给出生成器与生成 TS 的文件与 sha256。
我把这两个 sha256 与磁盘实际文件比对,**逐字符相同**:
`scripts/generate/catalog-inventory-p1.mjs` = `c93245d9…`;
`apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts` = `3a704171…`。
**after 侧确实来自当前生成器、契约与生成 TS,不是人工字符串。**

⚠️ 一处需明示但不构成缺陷:before 侧的 provenance 自我标注为
`APPROVED_DESIGN_BASELINE_NOT_HISTORICAL_BYTE_SNAPSHOT` —— 即 before 取自设计文档基线,
不是历史字节快照。artifact **自己写明了这一点**,属诚实标注,不是伪装。

### B · 字节绑定的机制正确(但用错了 run,见 M-1)

`readiness-manifest.json` 实测:`credentialsFile`、`ownerFixturePath`、`repositoryByteBinding.path`
**三者均为仓库根相对路径**(上一轮 N-2 的绝对路径问题已修);
`repositoryByteBinding` = `{bindingDigest: 2b084448…, fileCount: 3729, byteCount: 65586191,
scope: repository-input-files-excluding-managed-runtime-and-build-output}`;
`runBinding` 的 runId / namespace / database / assetPrefix 与该 run 一致。

**我独立抽验了 `repository-byte-binding.json`**:3729 条目,随机抽 40 个文件重算 sha256,
**漂移 0**。`repositoryRoot` 为 `.`,含 9 项 `excludedDirectories`,路径全部相对。
`l2-cleanup-manifest.json` 的 `cleanup = PASS`、`cleanupErrors` 为空。

### D · 受控例外 —— 与裁决清单完全一致,边界未松动

- `categories.P3` 恰好 **12** 条,**集合与裁决清单相等**(判定 True);
- 12 个 `databaseOperationBudget.max` 与清单值**逐个相等**,零偏差;
- `blockedCount = 0`,`readyCount = 238`,合计等于 operation 全集;
- scope 仍取自 `Object.keys(INVITATION_ASSIGNMENT_P3_MEASURED_MAX_BY_OPERATION)`
  (`backend-performance-budget.mjs` 第 79–81 行),与实测值同源冻结,**不可能漂移**;
- 第 438–443 行仍强制 decisionRef 已知且其 scope 必须包含该 operationId;
  第 445 行仍强制 `record.to === to.max === measuredMax`,**不能凭空抬**;
  `IMPLEMENTATION_AGENT` 权限仍限 scope 长度为 1,**不能自授**;
- 未获豁免的 `createOperationsBusinessChannel` 与 `deleteOperationsOwnerBinding`
  仍为 **P5**、预算即实测 **19** 与 **22**,不在任何 decisionRef 的 scope 内;
- **未见新增成员、未见阈值抬高。**

---

## N-1 · 「第一次 readiness 因 App.tsx 字节变化 fail closed」在证据里找不到

**等级** N · **UNVERIFIED_REQUIRES_EVIDENCE**

请求正文称第一次 readiness 曾因 `apps/terminal/assembly/android/pos-desktop/App.tsx`
运行期间字节变化而 fail closed。实测两份 readiness manifest
(`l2-1787985035050-60601-…` 与 `l2-1787985390871-64861-…`)**都写 `status=PASS`、
`firstFailure=None`、`brokenBoundary=None`**;两份 cleanup manifest 记录完全相同,
均为 `business=NOT_RUN` / `L2_RUNTIME_CLEANUP_RECOVERY` /
`L2_RUNTIME_INTERRUPTED_BEFORE_NORMAL_CLEANUP`。该文件名只出现在
`repository-byte-binding.json` 的字节清单里,**不是失败记录**。

我按要求"不要把第一次失败隐藏",但**在字节里找不到那次失败**。
两种可能:该失败发生在未落盘的进程输出里,或叙述与产物不符。请补出处。
这不构成缺陷,但一次 fail-closed 若不落进 manifest,下一个人无从复核。

## N-2 · 更正我上一轮 M-1 的算式基准

**等级** N · **本文自我更正**

上一轮我写「registry 内嵌 digest 与 CP05 report 的 sha256 不等」,用的是**原始文件 SHA**。
按生成器实现,正确基准是**排除 `generatedAt` 与 `replayIdentity.contentDigest` 后的 canonical digest**。
**结论(registry 过期、门红、须按 owning generator 重生成)是对的且已被本轮修复验证,
但那条算式的基准写错了。** 特此更正,以免后续以 raw SHA 作为比较依据。

## N-3 · 21–24 死区仍在(承上轮,未处置)

**等级** N · **DEXTER_DECISION**

分类以 `>= 25` 判 P3,而 P3 ceiling 是 20;落在 **21–24** 的操作被判 P5,预算即实测值、
不受 class ceiling 检验。本轮仍有六条位于该区间:`updateOperationsCommercialGroup` 24、
`transitionOperationsBusinessChannelStatus` 23、`updateOperationsBusinessChannel` 23、
`updateOperationsBusinessChannelTemplate` 23、`createOperationsOwnerBinding` 22、
`deleteOperationsOwnerBinding` 22。按现行 CP05 设计它们**确实合规**,不是 base-1 缺陷,不阻断。
本轮**未见**把该区间固化为默认水位的动作。是否收窄属预算模型的产品判断。

---

## 证据分层声明

static / generated / focused 与真实 HTTP 分开;真实 HTTP 与 browser L2 分开;
`business` 与 `cleanup` 逐层分开记录 —— **本轮 M-1 正是这条分层被跨越的结果**。
本轮**未执行也未声称** DEV、reset、seed、UAT、部署或任何数据操作;
未手工修改任何 generated 文件;未使用任何已退役控制面。

## 授权边界

本文只是外部只读复核结论。`NO-GO` 不构成产品否决,也不构成产品或 Journey 变更、Roadmap 推进、
DEV/reset/seed/UAT/部署、数据操作或任何仓库控制动作的授权。静态与门层面的通过**不等于**动态 GO。
M-1 的修复需要一次运行授权,该授权不在本文范围内。
