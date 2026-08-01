---
title: R5 修订 implementation-facing design POST_REMEDIATION 第二次 Claude 独立复核
type: review
status: DELIVERED
reviewer: Claude
createdAt: 2026-07-26
reviewTarget: R5_REVISED_IMPLEMENTATION_FACING_DESIGN
reviewCycleId: R5-REVISED-DESIGN-20260726
verdict: NO-GO
counts: {M: 5, S: 11, N: 9}
supersedes: doc/review/platform/2026-07-26-v2s-r5-revised-design-post-remediation-review-claude.md
reviewTargets:
  - path: doc/plans/platform/2026-07-26-v2s-r5-revised-implementation-design-and-plan.md
    sha256Prefix: e27dad9ede5b00bb
  - path: doc/plans/platform/2026-07-26-v2s-r5-revised-carryover-execution-inventory.md
    sha256Prefix: 409c040c3e232c47
  - path: doc/review/platform/2026-07-26-v2s-r5-revised-design-granularity-manifest.json
    sha256Prefix: 51df9c9567538847
  - path: doc/review/platform/2026-07-26-v2s-r5-revised-design-post-remediation-intake.md
    sha256Prefix: be3d6b592839c99f
authorizationBoundary: DESIGN_ONLY；不授权 implementation、runtime、DEV、seed/reset、contract、migration、app、test、脚本或业务源码写入
---

# R5 修订详设 POST_REMEDIATION 第二次复核

## 0. 结论

```text
VERDICT=NO-GO
M=5  S=11  N=9
```

**上一轮三条 M 中的两条真实关闭,第三条只关闭了三分之一。** 修订量很大且方向正确——审计的白名单机制、AuditActor 在 IAM owner 内构造、6 个 owner 窄 API、Part B/C/D 的 150 条真实 rule id,都是实打实的补强。但四条 M 拦住 GO,其中两条是新暴露的**入口条件不成立**问题:audit 表的 DROP 前提按当前字节必然失败,且其中一张的读取者直连**冻结契约的 required 字段**。

## 1. 先更正我自己上一轮的一处事实错误

上一轮我的 S-5 写:「这 8 张表**零写入者、是空表**,precondition + DROP 重建成本近乎为零」。**写入者部分是错的**,我采信了守门 agent 的说法而没有自己验证写入路径。

本轮亲验:**5 张表有活跃 INSERT 写入者**——`OrganizationCommandService.java:83`(commercial_group_audit)、`BusinessEntityService.java:280`(organization_audit)、`ContractCommandService.java:123`(contract_audit)、`PlatformAuthenticationService.java:172`(platform_audit)、`WorkspaceRoleService.java:49`(workspace_audit);仅 `platform_workspace.workspace_audit`、`extension.extension_audit`、`platform_asset.asset_audit` 确无写入者。

这个错误直接导致本轮设计把「legacy audit 表是干净空壳」当成了免费前提(见 M-3)。**这是我的守门失误**:我对 agent 的"零消费"结论做了采信而未亲验,而亲验写入路径只需一条 grep。

## 2. 三个门(fresh 复跑)

| 门 | 结果 |
|---|---|
| `implementation-design-granularity --manifest … --review …round-2.json` | **PASS**;`UNITS=8 / FINDINGS=4 / VERDICT=NO_GO / REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` |
| `standards-coverage --phase R5` | **PASS,RULES=150** |
| `claude-review-handoff --file …post-remediation-claude-review-request.md` | **PASS** |

四个评审对象哈希相对上轮全部变化,证实为新字节。

## 3. 上一轮 findings 的 closure 判定

| 上轮 | 判定 | 亲验依据 |
|---|---|---|
| **M-1** 105 双 face 不可实现 | **1/3 CLOSED** | path 层真修了:两个 scalar-face operation 落 `paths/platform-admin/` 与 `paths/operations-admin/`,`shared/` 例外已删除,与生成器的 scalar `face` 模型相容。**但 capability 与 component 两层同类缺陷原封未动**——见 M-1 |
| **M-2** Part B/D 非真实 rule id | **CLOSED** | 我独立提取全部引用 token:**150 个,零区间串、零通配符、零悬空**;分部计数 B=85 / C=23 / D=42 精确等于矩阵分母;三部分**各自**补齐 `reviewChecklistRef` 与 `sourceAnchor`(顺带关闭上轮 S-6) |
| **M-3** 审计无脱敏机制 | **CLOSED** | 新增 §5.3;`changes_json` 明写「从不是 entity/request body/JDBC row/`detail_json`/reflection diff 的序列化」,每 owner 每 `entityType/action` 声明封闭 `AuditChangePolicy`、**默认拒绝**;允许集与禁止集逐项列全(禁止集含 credential hash/algorithm、OTP、token/grant、mobile、login name、session、internal id,并明写不得以 before/after、label 或嵌套对象绕过);配套 red test 指定为「注入敏感候选字段 → 断言持久 `changes_json`、owner readback、Modal fixture 三处均不出现,同时断言允许字段仍完整显示」 |
| S-1 AuditActor 来源 | **措辞 CLOSED / 机制 PARTIAL** | §5.3 明写「不是 `PlatformExecutionContext.externalSubject` 的别名」,在各自 IAM owner 内解析后作为 immutable value object 下传,下游「严禁自行从 session、credential 或 account 表再解析身份」。残留见 S-5 |
| S-2 union/join + owner API 清单 | **CLOSED** | 改为「按 `entityType` 分派的 owner task read」;6 个窄 API 逐个列出并带隔离规则 |
| S-3 GROUP_WORKSPACE 分散 | **PARTIAL** | 方向已裁(跨 owner 窄 API 聚合,非合并、非 SQL join);残留见 S-6 |
| S-4 workspace 过滤 | **措辞 CLOSED / platform-iam 不成立** | 见 S-4 |
| S-5 audit 表 additive | **形状 CLOSED / 前提 NOT_CLOSED** | 形状部分做得好:precondition + DROP 重建、`entity_ref_text` 解决 BIGINT/UUID 冲突、双时间列问题随 DROP 消失。前提部分见 M-3 |
| S-9 审计 Modal 登记 | **PARTIAL** | 新增 §1.1,10 行覆盖 12 个 entity type、12 个宿主 surface 全部点名。残留见 S-7 |
| S-10 route/slice 有损 | **PARTIAL** | route 大幅改善(22 行中 19 行逐字一致,散文占位已消除);残留见 S-7 |
| N-5 中文 label 归属 | **PARTIAL** | `fieldKey` 的 label 归 App 已裁定且四处一致;残留见 N-3 |

## 4. M 级 findings(4 条)

### M-1 解析层只修了三层中的一层——capability 与 component 仍会 `unresolved: FAIL`

- **owning**:`doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`;详设 §4 `:123`
- **反例(我亲验)**:该 placement catalog 中 **`audit` 出现 0 次**;`pageKeyToCapability` 无 `AUDIT-HISTORY-MODAL` 项;`familyToOwner` 的 13 个 family(`common/group-workspace/commercial-group/asset/platform-identity/contract/extension/business-entity/organization-overview/organization-hierarchy/store/workspace-session/workspace-access`)**没有 `audit`**。而该 catalog 自订规则是 `components/<familyToOwner[family]>/<family>.schemas.yaml` 且 `unresolved: FAIL`——**详设要落的 `contracts/openapi/components/audit/audit-history.schemas.yaml` 中 `audit` 既不是 family 也不是 7 个 owner 之一,按其自订规则解析不出来**。两个 audit operation 同理:无 capability 映射则 `paths/<face>/<capability>` 不可解析。
- **这与上一轮 M-1 是同一形态**:上轮是 `paths/shared/` 的 `shared` 不是 face,本轮是 `components/audit/` 的 `audit` 不是 owner。**path 层修对了,component 与 capability 层照抄了同一个错误。**
- **最小修复**:①audit schema 归 `components/common/`(审计是跨 owner 共享形状)或在 `familyToOwner` 显式声明其归属;②`pageKeyToCapability` 或 `operationOverrides` 增加两个 audit operation 的 capability 映射(建议 `audit-history`)。纯 catalog 文本修复。
- **需 Dexter:否**

### M-2 授权文件与被授权的设计互相矛盾,且被 manifest 哈希锁定

- **owning**:`doc/decisions/2026-07-26-v2s-r5-revised-design-authorization.md:21`
- **反例**:该行仍写「R-11/R-13/R-14 已将**统一的 `getEntityAuditHistory`** 纳入范围,operation 分母由 104 扩为 **105**」——正是 Dexter 裁决要取代的版本。而 manifest 的 `authorization.sha256=04b22635…`(我复算一致)正把这一版本哈希锁定。
- **影响面**:授权工件授权 105/统一,设计做 106/拆分。任何后续复核对照授权文件都会判定设计**超出授权**;而实质上 Dexter 已在本轮请求中明确裁决 106/拆分,所以是**工件失鲜**而非越权。但工件失鲜且被哈希绑定,正是本项目反复出问题的形态。
- **最小修复**:更新授权文件为 106 + 两个 scalar-face operation,并同步 manifest 的 `authorization.sha256`。
- **需 Dexter:否**(实质已裁决,只需同步工件)

### M-3 audit 表 DROP 的 precondition 按当前字节必然失败,且其中一张的读取者直连冻结契约 required 字段

- **owning**:详设 §5.2 `:148`;`PlatformAuthenticationService.java:172,176`;`contracts/openapi/components/platform-iam/platform-identity.schemas.yaml`
- **反例(全部我方亲验)**:
  1. `:148` 要求先过「**空表 / 无 active writer / 无 retained reader**」三条 typed precondition 再 DROP。**5 张表有活跃写入者**(见 §1),设计**没有任何一步说先摘除既有 writer/reader**,也没有 precondition 失败后的分支。按字面实施,U03 的 audit 迁移在第一张表就停住。
  2. 更重的一半:`PlatformAuthenticationService.java:176` 是 `platform_audit` 的**活跃读取者**——`coalesce((SELECT p.event_type FROM platform_iam.platform_audit p WHERE p.subject_ref=a.id ORDER BY … LIMIT 1), 'NO_ADMIN_AUDIT_EVENT') AS audit_summary`。它经 `PlatformAdminReadback.auditSummary` 落在**冻结契约的 required 属性**上:`PlatformAdminDetail.required` 含 `auditSummary`,且定义为 `{type: string, minLength: 1, maxLength: 512}`(我逐字复算)。
  3. 因此 DROP `platform_iam.platform_audit` ⇒ 必须删除或改源 `auditSummary` ⇒ **改变既有 operation 的 response schema**,与详设 §4 `:129` 自己写的「已有 104 条的 path/operationId/error code/事务语义不漂移」**直接冲突**。全文(含 manifest、inventory、Journey、interaction、intake)对 `auditSummary` **零命中**,无任何 disposition。
- **最小修复**:`:148` 的 audit 行拆两步——(1)同一 unit 内先移除 5 个 writer 与 1 个 reader(逐条列源路径),(2)再跑空表 precondition 并 DROP;同时在 §4 契约表新增一行 `PlatformAdminDetail.auditSummary` 的显式 disposition,并归入 U02。
- **需 Dexter:是(仅第二半)**。删除或改变一个用户可见的 **required 契约字段**属显式范围调整;R-14 只授权了 operation 分母**扩张**,未授权既有 operation 的 response **收缩**。

### M-4 106 在 catalog 现行不变式下无法闭合

- **owning**:`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 的 `crosswalkInvariants`;manifest 的散文绕过
- **反例**:catalog 的 `forwardEquality` + `proofClosure` 要求每个 operation 的 `scenarioIds` 在 32 行 crosswalk 中恰好出现一次并带 positive/negative proofRef(我实测现存 **104/104 全部满足,scenarioIds 无一为空**)。两个 audit operation **无 scenario 归属**(32 已冻结、无审计 scenario),而 manifest 只用一句散文 `"106 operations trace to the frozen 32 scenarios plus the accepted audit Journey"` 绕过,**catalog 侧无任何例外机制**。此外 `reverseEquality` 要求 pageKey 等于 canonicalPageKey,而两个 audit op 的 canonicalPageKey 是 `AUDIT-HISTORY-MODAL`、却要从 12 个宿主 surface 各自的 pageKey 下被消费,例外表 `sharedOperationPageKeyExceptions` 仍只有 `getPublicAssetContent` 一条。
- **最小修复**:在 catalog 显式增加「审计 read 不参与 scenario crosswalk,其 proof 源为已接受的审计 Journey」的具名例外,以及 audit op 的 pageKey 例外绑定。
- **需 Dexter:是**。这触碰 32 冻结分母的不变式语义(是引入第 33 个 scenario,还是扩展例外表),应由 Dexter 确认走哪条。

### M-5 `reviewChecklistRef` 字段补齐了,但 13/18 组的**值绑错**——68 条规则被声称按从未做过的评审纪律核验过

- **owning**:manifest `standardsCoverage` 的 partB/partD 各组;同一错误已传播进 review-request 52–57、72–79 行
- **反例(我自写脚本逐条比对 manifest 声明值 vs 矩阵实际 `enforcement.reviewChecklistRef`)**:

  ```
  一致 36 / 矛盾 68 / 矩阵无 checklist 却声明 44
  涉及 13 / 18 组:B.1 B.2 B.3 B.4 B.6 D.1 D.2 D.3 D.4 D.5 D.6 D.7 D.8
  ```

  只有 5 组正确(partC 四组 + B.5)。矩阵中 `REFERENCE_PATTERN_APPLICABILITY_REVIEW` 恰好出现 **23 次 = 正好是 Part C 那 23 条**——**作者把 Part C 的正确值原样复制到了其余 13 组**。逐组真实值应为:B.1/B.2/B.3/B.4/B.6/D.2/D.8 的 UNENFORCEABLE 部分 → `R4_BOUNDARY_SEMANTICS_REVIEW`;D.4 → `DOCUMENT_GOVERNANCE_REVIEW`;D.5 → `DELIVERY_PROCESS_REVIEW`;D.6 → `DEPENDENCY_AND_VERSION_DECISION_REVIEW`;D.7.T02 → `CLAUDE_ENTRY_INTENTIONAL_REVIEW`。更严重的是 **44 条是 `GATE`/`ARCHUNIT`/`NEGATIVE_FIXTURE`、矩阵中根本没有 checklist**,却被声明有——其中 **D.1(4 条)与 D.3(3 条)整组是 GATE**,本应写 `NOT_APPLICABLE(machine-enforced)`,现在却声称 review 命中。
- **影响面**:矩阵 150 条中 **104 条是 `UNENFORCEABLE_BY_MACHINE`**,checklist 引用是它们**唯一的执法途径**(CLAUDE.md 明文要求按 phase 核验 `UNENFORCEABLE_BY_MACHINE` 对应的 review checklist)。把其中 68 条路由到错误的 checklist,等于**声称做过一种从未做过的评审纪律**。这与上一轮 M-2 是同一形态的下一层:**形式修对了(字段齐、id 真),实质绑错了**。
- **最小修复**:组内是**异构**的(GATE 与 review 规则混在一起),单组一个 `reviewChecklistRef` 结构上就装不下。按 **B.5 已有的正确范式**改写——manifest:37 用 `notApplicableRuleIds` + `notApplicableReason` 把两条 R4 GATE 单独摘出;其余各组按 enforcement kind 拆出 `NOT_APPLICABLE` 子集,剩余绑矩阵真实 checklist。纯 manifest 文本,不动矩阵、不建门。
- **需 Dexter:否**

## 5. S 级 findings(11 条)

| # | owning | 一句话 |
|---|---|---|
| S-1 | manifest R5-U02 `changeSurfaces` | **生产 resolver 的两个实际输入无人认领**:`r5-edge-materialize.mjs` 实读 `doc/plans/…2026-07-26-…file-placement-catalog.json` 与 `…2026-07-25-…implementation-catalog.json`,二者在详设与 manifest changeSurfaces 中**均 0 次**;manifest 认领的是 `contracts/policy/edge-contract-file-placement-catalog.json`(disposition=create)——**该路径不存在**。按字面实施会造出第二份 catalog 而生成器继续读旧值。**我上一条口头判断把"认领了"说早了,在此更正** |
| S-2 | Journey `:58` vs inventory `:61` | **`WORKSPACE_ACCOUNT` 的 face 归属两处矛盾**:冻结 Journey 写 `WORKSPACE_ACCOUNT` → **platform-admin 单 face**(下一行 `WORKSPACE_INVITATION` 才是双 face);而自称"唯一执行输入"的 inventory 第 61 行把 `WORKSPACE_ACCOUNT` 也给了 operations-admin。实施者按哪份都能被判违规。**需 Dexter 一句话**:是 Journey 补上 operations-admin(运营端本就有用户管理页,业务上合理),还是 inventory 去掉 |
| S-3 | 详设 §4 `:123` | **两条 operation 没有各自的 entityType 闭集**。两个 operation 统一写"只接受 12 entity type",face 归属只活在 §5.3 的 owner 散文("platform face only")里。后果:契约允许 operations-admin 请求 `entityType=PLATFORM_ADMIN`,而 `x-consumer-faces`、security self-test、route-face registry 三道机器门**看不见**这条规则,只能靠 owner 代码运行期 403。拆成两个 scalar-face operation 的全部意义就是让 face 规则落在契约上——现在没落 |
| S-4 | 详设 §5.2 `:148`;`platform_admin` 表 | 四元组过滤对 `PLATFORM_ADMIN` **机制上不成立**:`platform_iam.platform_admin` **没有 workspace 列**(平台管理员是全局实体),故 `platform_iam.audit_event` 无法承载可满足的 NOT NULL workspace composite FK,统一索引在全 NULL 前缀下也无选择性。修复:把该表写成显式例外(非 workspace-scoped,过滤退化为 `(entity_type, entity_ref_text)` + platform-face-only,索引不带 workspace 前缀),其余 6 张保持四元组 |
| S-5 | 详设 §5.3;`module-dependency-registry.json` | **`AuditActor` 的宿主模块与调用链未定**。registry 有 8 个 module、无 shared kernel,现有 9 条 edge 中**无任何 owner→IAM 依赖**;若 organization/contract/extension 的 command 签名要收 `AuditActor`,该类型必须住在被它们共同依赖的模块里,设计只字未提,也没说谁调用解析 API 并串下去。会直接撞 §7 的 ArchUnit 单向依赖。且 U04 的 changeSurfaces 不含该 registry。另:旧坏先例 `OrganizationCommandService.java:83`(把 `context.externalSubject()` 直接写进 `commercial_group_audit.platform_subject`)在 §2.2 disposition 表中未登记清除 |
| S-6 | 详设 §5.3 platform-workspace 行 | GROUP_WORKSPACE 聚合的三点未定:①商业集团初始化行的 `entity_type` 取值(填 `GROUP_WORKSPACE` 则违反 organization 声明的闭集,填别的则 dispatch 表不认);②跨两表归并的分页机制(窄 API 签名无分页参数,两表 id 各自独立序列,tie-break 无定义;实际初始化事实有界可全取,但**"有界所以可全取"这个前提没写进设计**);③新 TASK_READ edge 未登记进 registry |
| S-7 | carry-over inventory | 三处残留:①**§1 的 22 行主表 audit 命中数仍为 0**——12 个宿主行的「foundation 必消费」「focused evidence」两列无任何 audit 项,与 §9 P5 完成判定「每 surface 的 route/owner/locator/readback matrix」不咬合;②**3 行 route 仍漂移**(`PUBLIC-ACCESS-RECOVERY` 丢 `:groupWorkspaceKey` 段,与 §6.1「运营 browser URL 第一段带 groupWorkspaceKey」直接冲突;`OPERATIONS-CONTRACTS` 整条不同;`OPERATIONS-PASSWORD` 多 `/*`);③**10 行 generatedSlice 标识符本体变义**(如 `workspace-iam-session-navigation`→`workspace-iam-session`);④`STORE_CONTRACT` 行的 operation 写作散文 `face-local operation`,是 10 行中唯一未点名 operationId 的,而它恰是唯一跨双 face 的 type |
| S-8 | `frontend-asset-carryover-manifest.json` vs catalog | **`PLATFORM-WORKSPACE-OVERVIEW` 仍无契约承载,未动**。该 key 在 implementation catalog 与 placement catalog 中**出现 0 次**,21 个 catalog pageKey 无此项,无任何 operation 的 pageKey 指向它,例外表未补。inventory 仍为其分配 route/slice/evidence |

| S-9 | manifest `deliveryUnits` 锚点覆盖 | **§1(用户任务、方案取舍与最小替代)与 §3(目标架构与不可变边界)仍无任何 unit 认领**。§2/§8/§9/§11 已由新增的 `U01.supplementalDesignAnchors` 认领(上轮 N-7 的一半已闭),但 §3 承载 owner/事务/epochMillis/JSONB/asset 全部不可变边界,仅作为 `sourceAnchor` 出现,**无交付单元拥有** |
| S-10 | 详设 `replaces:` `:7-9`;manifest U01 | **H-1(方案 GO 后被静默修订)仅名义认领,provenance 未实质关闭**。§8:301 的 oracle 是"old/new hash and reason bound in review package",但 `replaces:` 两条**只有路径、没有 sha256**,old/new hash 无处可查;U01 虽题为「修订来源」,其 `approvedAssertions`/`changeSurfaces`/`evidence`/`discriminator` **全部是控制门内容,零 provenance**。修复:给 `replaces:` 两条各补 sha256,或在 U01 增一条 provenance assertion + evidence。**(H-2 Roadmap 自相矛盾已实质关闭**:状态块与 prose 一致,历史段已标 superseded) |
| S-11 | review-request `:48-79`;详设全文 | **章节命中表仍只在 review-request 里**——详设全文 grep `Part B\|Part C\|Part D` 仍零命中(唯一命中是 §8 的 A–H 矩阵表头)。且**组级 `NOT_APPLICABLE` 仍为 0**(全文只有 B.5 的两条 R4 GATE 做了逐条 disposition),而 D.1、D.3 两组纯 GATE 本应整组 N/A。落点粒度仍是章号级 |

## 6. N 级 findings(9 条)

| # | 一句话 |
|---|---|
| N-1 | §5.3 的敏感字段 red fixture **没有进 U04 的交付判定**:U04 的 `discriminator.fixture` 与 `evidence.l2` 只写 receipt/replay/rollback/six-security/"audit transaction",`forbiddenPseudoFixes` 只有 `audit empty JSON`。加进 discriminator 与 forbiddenPseudoFixes 即可 |
| N-2 | §5.3 自述「每个 `entityType/action` 声明封闭 policy」,但枚举是**逐实体**、非逐 action。不影响安全底线(实体级已默认拒绝),但自述与内容不一致,实施者会退化成实体级白名单 |
| N-3 | 「服务端不返回中文文案」这句绝对表述被同文三处推翻:`SYSTEM` 的 `displaySnapshot` 就是中文「系统」且要持久化;operations face 对 `PLATFORM_ADMIN` 固定投影「平台管理员」发生在服务端;`actionSummary`/`target` 的语言归属完全未写(线框画的是中文)。改成有界表述即可 |
| N-4 | `edge-codegen.mjs:47` 的 `106` 是 **error code 计数**,与新 operation 分母同值纯属巧合。实施时建议改名或加注,否则极易被后续复核误判为「常量已改」 |
| N-5 | **U03 与 U05 现在共用完全相同的 `detailDesign.anchor = "### 5.1 新增式 migration 规则"`**。上轮 U03 从 `## 5.` 收窄为 `### 5.1` 修好了与 U04 的包含关系,却引入了与 U05 的重复;U03 有 `scopeBoundary` 散文划界,**U05 无对应字段**。checker 有 `DUPLICATE_UI_INTERACTION_ANCHOR` 但**无** detailDesign 重复锚点红控,故不设防。修复:给 U05 补对称 `scopeBoundary`,或把 U05 锚点改到资产专属小节 |
| N-6 | manifest U06 的 `currentDeviation` 仍写 frontend `omit … generated API`,**不成立**:`platform-edge.ts`(38)/`operations-edge.ts`(55)/`public-edge.ts`(11) 三份 generated descriptor 已存在、合计 104 且逐 face 相符。真正缺的是 RTK Query endpoint / store / router。改为"generated descriptor 已存在但无 RTK endpoint 接线" |
| N-7 | `contracts/policy/frontend-asset-carryover-manifest.json:53` 仍把**不存在的** `contracts/policy/route-face-registry.json` 列为重生成 6 个 frontend catalog 的 `v2sSources`;真实生成物在 `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`。该文件 `status: PROPOSED_REVIEW_ONLY`,可改。(注:上一轮我把此项定位到 granularity manifest,**定位有误,此处更正**) |
| N-8 | round-2 的 `clericalCorrection` 仍无 `preCorrectionSha256`,但 intake:40 明写修订前原字节未保留、**拒绝伪造** pre-correction hash。**姿态正确,可接受**;残留风险是独立 reviewer 的原始字节不可复核,记录备案 |
| N-9 | 已关闭备案:`reviewedDesignSha256` 已补(`0d768875…`,设计字节链 `4cdda492`→`0d768875`→`e27dad9e` 单调且每环被声明);`redFixtures` 自报 **13** 项与 self-test 实际输出**逐字全同**,错名 `..._MISSING` 已改真名 `..._NOT_FOUND`、5 项漏列已补。上一轮 N-1、N-4 关闭 |
| N-10 | 11 处硬编码 `104`/`38-55-11` 在 design-only 阶段未改是合理的,但唯一约束点是 §9 P2 的一句散文;manifest R5-U02 的 `discriminator` 未覆盖「106/39/56/11 常量已全改」,P2 漏改后无红可拒。建议 discriminator 增一条 |

## 7. 方案合理性

**问题对不对——对。** 审计整体形状(两条 scalar-face read + owner-local append + 宿主权限继承 + 写入时 actor 快照 + 白名单 diff)我仍推荐,拆成两个 scalar-face operation 是正确取舍,本轮的白名单与 owner dispatch 是实打实的补强,没有过度工程。Part B/C/D 的 150 条真实 rule id 与三部分的 checklist/anchor 也是干净的闭合。

**方案优不优——一处方向性问题。** M-3 把「legacy audit 表是干净空壳」当成免费前提,而它今天不是:5 个写入者、1 个喂到冻结契约 required 字段的读取者。**这不是措辞瑕疵,是整条 audit 收敛路径的入口条件不成立**——而这个错误前提有我上一轮的一半责任(§1)。

**代价配不配——配。** 四条 M 全部是设计层可闭合的文本/catalog 修订,无一需要重建机制。

## 8. 章节命中对照

**Part B / C / D:PASS。** 150 个 token 全部为真实 matrix rule id,零区间串零通配符零悬空;分部计数 B=85 / C=23 / D=42 与矩阵分母精确一致;三部分各自具备 `reviewChecklistRef` 与 `sourceAnchor`。上一轮 M-2 与 S-6 均关闭。

**本评审自身的映射**:B.1/B.2/B.3 → M-1、M-3、M-4、S-1、S-4、S-5、S-6;B.4/B.5 → S-2、S-3、S-7、S-8、N-3;B.6 → `NOT_APPLICABLE`(本轮无新增运行时性能语义,审计索引已在 §5.2 给出);Part C → M-1(契约与生成物一致性)、M-4(不变式闭合)、S-3(face 规则应落契约);Part D → M-2、N-1、N-4、N-5。

## 8.5 必须披露:整个 `standardsCoverage` 处于零机器覆盖区,且这已是第二次在此处出缺陷

守门 agent 在 scratchpad 拷贝上做的四组变异**全部 PASS 绿**:①Part C 换成伪造的 `C.T99`/`ZZZ.BOGUS`;②18 组 `reviewChecklistRef` 全改成 `TOTALLY_FAKE_CHECKLIST`;③退回上一轮的区间串 `B.1.N01-B.1.N17` + 通配符 `D.1.*`;④**整段删除 `standardsCoverage`**。对照组(U08 锚点改回旧值)正确变红,证明变异手法有效。

`standards-coverage --phase R5` 只校验矩阵自身分母(RULES=150),**从不读 manifest**;granularity checker 全文无 `standards|Coverage|matrix` 引用。所以:**150 个真实 rule id 是作者手工做对的,不是门保证的;而同一次修订里 68 条 checklist 绑错,也正因如此一路绿到交付。**

**这是同一位置连续两轮出缺陷**(上轮 token 形态、本轮 checklist 取值)。按 Dexter 的三问标尺——**反复发生**(两轮)、**纯机械**(字符串存在性与一致性比对,无需理解业务)、**维护成本小于返工**(一次比对 vs 两轮返工)——manifest→matrix 的 `ruleId` 存在性 + `reviewChecklistRef` 一致性 + `enforcement.kind` 与 `NOT_APPLICABLE` 对应关系,是少数确实值得做成机器门的候选,且上述四个变异可直接作为真红 fixture。**建议在 U01 的控制清单中增设这一条**(不新增门类别,并入既有 `standards-coverage`)。

## 9. 授权边界

本 NO-GO 裁定 R5 修订 implementation-facing design **尚不可交 Dexter 接受**。四条 M 全部可在设计层闭合,**两条需 Dexter 裁决**:M-3 的第二半(`PlatformAdminDetail.auditSummary` 这个 required 契约字段的处置,属既有 operation response 收缩)与 M-4(审计 read 在 32 冻结不变式下走"第 33 个 scenario"还是"具名例外");另 S-2 需 Dexter 一句话确认 `WORKSPACE_ACCOUNT` 的 face 归属。其余由 Codex 在既有批准边界内自主修复,修订后按 POST_REMEDIATION_V1 机制再次交付,**不重开第三轮盲审**。

本评审不授权 implementation、runtime、DEV、seed/reset、contract、migration、app、test、脚本或任何业务源码写入。
