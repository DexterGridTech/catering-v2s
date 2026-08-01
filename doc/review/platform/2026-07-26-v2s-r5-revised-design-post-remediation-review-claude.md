---
title: R5 修订 implementation-facing design POST_REMEDIATION_V1 Claude 独立复核
type: review
status: DELIVERED
reviewer: Claude
createdAt: 2026-07-26
reviewTarget: R5_REVISED_IMPLEMENTATION_FACING_DESIGN
reviewCycleId: R5-REVISED-DESIGN-20260726
verdict: NO-GO
counts: {M: 3, S: 11, N: 10}
reviewTargets:
  - path: doc/plans/platform/2026-07-26-v2s-r5-revised-implementation-design-and-plan.md
    sha256Prefix: 290a61f44499ba9b
  - path: doc/review/platform/2026-07-26-v2s-r5-revised-design-granularity-manifest.json
    sha256Prefix: 78f2022a7e11fdb5
  - path: doc/review/platform/2026-07-26-v2s-r5-revised-design-adversarial-review-round-2.json
    sha256Prefix: bf29bf3982e2b476
  - path: doc/review/platform/2026-07-26-v2s-r5-revised-design-post-remediation-intake.md
    sha256Prefix: 068fa24777122379
  - path: doc/plans/platform/2026-07-26-v2s-r5-revised-carryover-execution-inventory.md
    sha256Prefix: d37454e5b5c31854
  - path: doc/decisions/2026-07-26-v2s-r5-operation-history-journey-decision.md
    sha256Prefix: e280fca4f7b1e662
  - path: doc/decisions/2026-07-26-v2s-r5-operation-history-interaction-design.md
    sha256Prefix: 9601576cb41ff6c5
authorizationBoundary: DESIGN_ONLY；不授权 implementation、runtime、DEV、seed/reset、contract、migration、app、test、脚本或任何业务源码写入
---

# R5 修订详设 POST_REMEDIATION 复核

## 0. 结论

```text
VERDICT=NO-GO
M=3  S=11  N=10
```

**终轮三条 M 我逐条亲验,全部真实关闭**;修订质量高,carry-over 执行清单尤其扎实(22 个源 hash 我拿到 v2 真实文件上重算,22/22 相符零漂移)。但另有三条新的 M 拦住 GO,其中一条是**本设计的招牌数字 105 在当前流水线里造不出来**,一条是**刚修掉的缺陷在隔壁两章原封未动**,一条是**新引入的永久留存审计缺少任何脱敏机制而其范围直连凭据与手机号**。

三条 M 全部可在设计层闭合;**只有一条需要 Dexter 裁决**(105 vs 106)。

## 1. 会话出处与方法

续接会话,如实声明。派三路独立守门 agent(审计边界、分母与 carry-over、Part C/U08/声明合规),均证伪立场、双仓只读;**全部 M 级与决定性主张由我本体重开源码亲验后才写入**。本仓零写入(除本文件)。未启动 DEV、未 seed/reset。

## 2. 终轮四条 finding 的独立 closure 判定

| finding | 判定 | 我的亲验依据 |
|---|---|---|
| **M-001** Part C 引用非真实 rule id | **PARTIAL** | Part C 已改为 `C.T01`~`C.T23` **23 个逐条真实 id**,区间写法清零,与 `standards-coverage-matrix.json` 逐字对上、零缺失——**这一半是真修了**。但同类缺陷在 Part B/D 原封未动,且 disposition 要求的 checklist/anchor 映射缺失。见 M-2 |
| **M-002** 无 carry/adapt 执行清单 | **PASS(本轮最实的一项)** | 新增逐 surface 执行表:22 行,每行带 v2 源路径 + 完整 sha256 → v2s 目标、route、generated slice、必消费 foundation、focused evidence,disposition 三值闭集。**22 个 source hash 在 v2 真实文件上重算 22/22 相符,0 drift**;25 pageDesignKey crosswalk 逐条一致(8 同名 + 17 映射);frontmatter 绑的 manifest hash `5ccaa520…` 与实测一致 |
| **M-003** U08 锚点使 validator 关闭失败 | **PASS** | 锚点已从不存在的 `# V2S 验证治理` 改为 `## 1. 目标与总原则`(冻结文档第 13 行真实存在且唯一);生产门 fresh 复跑 PASS;**反向控制变异**(scratchpad 拷贝改回旧锚点)→ `UNIT_SOURCE_R5-U08_2_ANCHOR_NOT_UNIQUE:0`,与终轮记录的红因逐字一致 |
| **N-004** validator 不能证明 Part C/carry-over | **PASS,且实测风险高于 N** | 见 §5 的 N-3 |

## 3. 机械门与治理边界(fresh 复跑)

- `implementation-design-granularity --manifest … --review …round-2.json` → **PASS**,`UNITS=8 / FINDINGS=4 / VERDICT=NO_GO / REVIEW_ROUND=2 / REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`。
- `standards-coverage --phase R5` → **PASS,RULES=150**。矩阵分母独立重算 B=85 / C=23 / D=42 = 150,与 `expectedCounts` 一致。
- **POST_REMEDIATION 声明合规**:9 个字段齐备;**20 个 hash 我方逐个复算全部相符**;`reviewedManifestSha256=ae8b8bdc…` ≠ 当前 `78f2022a…`,与 `currentBytesNotReviewedByAdversarialReviewer:true`、`claudeRecheckRequired:true`、`implementationAuthority:false` 自洽——**诚实**。
- **两轮盲审治理合规**:两轮均 fresh `INDEPENDENT_SUBAGENT`、均带 `reviewerInputChecklist`(path+sha256,实测逐字相符)与 `blindReviewDeclaration`;round-2 `SELF_DECIDED`、`furtherCodexAdversarialRoundAllowed=false`;manifest 链 `50f2b418`→`ae8b8bdc`→`78f2022a` 单调且各自被声明;reviewCycleId 全程未换;**无改 hash 重置 cycle 的痕迹**。
- **分母**:`contracts/openapi/paths` 实测 **104 operation、104 唯一、23 个 paths 文件**,face 分布 38/55/11;审计端点尚未创建,与"设计态未实施"一致。32 scenario、7 owner schema、22 surface、25 pageDesignKey 均未漂移。

## 4. M 级 findings(3 条)

### M-1 招牌数字 105 在当前契约流水线里造不出来 —— **需 Dexter 裁决**

- **owning**:详设 §4 `:112`(「创建 `contracts/openapi/paths/shared/audit-history.paths.yaml`」「x-consumer-faces 为 platform-admin + operations-admin」)
- **反例(四处,我逐条亲验)**:
  1. `scripts/generate/r5-edge-materialize.mjs:121` —— `"x-consumer-faces": [operation.face]`。catalog 的 operation 模型只有**单数** `face` 字段,`x-consumer-faces` **由构造保证只有一个元素**,生成器写不出第二个 face。
  2. `scripts/generate/edge-codegen.mjs:207` —— `consumerFaces: [face]`,同构;同行 `closure: { operations: 104, … }`。
  3. **placement 规则**:`target path is paths/<face>/<capability>.paths.yaml`,且 `unresolved: FAIL`。**`shared` 不是 face**,该路径不可解析。
  4. `tools/platform-boundary-gates/cli.mjs:81` —— 硬断言 `operations.length !== 104` **且** `faceCounts !== {platform-admin:38, operations-admin:55, public:11}` 即 fail。**faceCounts 模型本身容不下跨 face operation**:计一次则 38+55+11=104≠105,计两次则 =106≠105。
- **影响面**:这是本设计的头号交付物。按字面实施,U02 第一天就会在 `edge-materialize` / `edge-codegen` / `contract-face` 三处同时红;即便强行绕过,两个 App 也只有一个能拿到 generated endpoint,而 §7 的「route registry reverse coverage」控制会看到一条 registry 未声明 face 的活路由。
- **最小修复(两条路,须 Dexter 选)**:
  - **(a) 拆成两个 operation → 106**:`getPlatformEntityAuditHistory` + `getOperationsEntityAuditHistory`,共用同一 owner read 与同一个 Modal 组件。catalog 的 face/security 基数、path 前缀、placement 规则、faceCounts 模型、tsFace 过滤**全部不动**,只改 8 处 `104` 字面量(`edge-codegen.mjs:37,59,207`;`r5-edge-materialize.mjs:219,222,282,300`;`platform-boundary-gates/cli.mjs:81`)。代价:+1 个 operation。
  - **(b) 保持 105 单 operation**:必须把整条流水线的 `face`/`security` 基数从单值改为数组(3 个生成器 + 门 + route registry schema),明显更大。
  - **Claude 推荐 (a)**。但 **105 是 Dexter 已认可的分母**(R-14),改成 106 属显式范围调整,不能由实施悄悄改。
- **需 Dexter 裁决:是**

### M-2 刚修掉的缺陷在 Part B / Part D 原封未动

- **owning**:`…-revised-design-granularity-manifest.json` 的 `standardsCoverage.partB`(6 组)与 `partD`(8 组)
- **反例(我亲验原文)**:Part B 六组全部是区间串 `B.1.N01-B.1.N17`、`B.2.N01-B.2.N15`、`B.3.N01-B.3.N12`、`B.4.N01-B.4.N20`、`B.5.N01-B.5.N15`、`B.6.N01-B.6.N06`;Part D 三组区间串 `D.2.L01-D.2.L04`、`D.3.L01-D.3.L03`、`D.8.L01-D.8.L03`,**另五组是纯通配符 `D.1.*`、`D.4.*`、`D.5.*`、`D.6.*`、`D.7.*` —— 完全没有条目号**。这 14 个 token **没有一个是真实 ruleId**,与终轮 M-001 判定的形态完全相同。
- **加重情节**:①`D.6.*` 掩盖了异构集合(D.6.T01–T05 + D.6.L01–L06 共 11 条),`D.7.*` 掩盖 7 条;②14 章**无一写 `NOT_APPLICABLE`**,全部声称命中,其中 B.5 整段映射到 U07,但 B.5.N01/N08 实为 R4 阶段 `GATE`、其余才是 R5 阶段 review 规则,区间串把这个差别抹平了;③命中表**不在详设里**(详设全文 grep `Part B|Part C|Part D` 零命中),在 review-request 中。
- **依据**:CLAUDE.md 明确「每一章或 Part C 条款组都要写明**命中条目号**与设计落点,或写 `NOT_APPLICABLE` 与理由。缺少该表即评审材料不完整」。通配符与区间串不是条目号。
- **最小修复**:6 个 Part B 串展开为 85 个真实 id;5 个通配符展开为 `D.1.L01–L04` / `D.4.L01–L05` / `D.5.L01–L05` / `D.6.T01–T05+L01–L06` / `D.7.T01–T07`;3 个 Part D 串逐条展开;逐章补 `NOT_APPLICABLE` 与理由(详设 §8 那张 A–H 47 行逐条闭合矩阵带 `NOT_APPLICABLE` 列,质量明显更高,**可直接作为改写样板**)。纯 manifest 文本修复,不改矩阵、不建新门。
- **需 Dexter 裁决:否**

### M-3 新引入的永久留存审计缺少脱敏机制,而其范围直连凭据与手机号

- **owning**:详设 §4 `:113`(要求)、§5.2 `:144`(把 workspace-iam 的角色/账号/邀请生命周期纳入审计范围)、§7(控制清单)
- **反例**:①要求写得很全(`:113`「绝不返回手机号、登录名、账号 id、token/OTP/hash、raw JSON、内部列名」),但**全文 grep `Sanitiz|脱敏|白名单|whitelist|allowlist` 只命中三处:`:113` 的要求本身、`:194/:196` 的 code-layout 与 route registry 控制(与审计无关)、`:277` 的 DEV 日志脱敏(不是审计写路径)**——**零机制**;②被纳入审计范围的 workspace-iam 实体,其表恰好持有 `workspace_credential.password_hash`、`workspace_account.mobile_normalized`、`login_name_normalized`(我逐列亲验);③按设计,审计行有用户面用途、**不能随意裁剪**——**泄露即永久**。
- **影响面**:任何「diff 变更列」式的通用实现会把密码哈希、手机号、登录名写进 `changes_json`,并被「操作历史」弹窗读出。这是新增能力自带的安全缺口,不是既有欠账。
- **最小修复**:`changes_json` 改为**白名单驱动**——每个 owner 对每个 entity type 显式声明可审计的业务字段集,不在白名单的一律不写。白名单比引入 sanitizer 更小、更确定(黑名单会漏),不需要新门;配一条针对 IAM 三实体的 focused red test(尝试审计凭据变更 → 断言 `changes_json` 不含任何凭据/PII 字段)。
- **需 Dexter 裁决:否**

## 5. S 级 findings(6 条)

| # | owning | 一句话 |
|---|---|---|
| S-1 | 详设 §5.1;`platform-access/PlatformExecutionContext.java:11-16` | **actor 快照的来源未定义**。设计三处正确禁止读时 lookup(Journey `:78-81`、详设 `:136`、interaction `:96`),机制上也做得到(两条 session→display_name 链都在各自 IAM owner 内部)。但 `PlatformExecutionContext` 只有 `externalSubject/consumerFace/expiresAt/correlationId`,**没有 actor id 也没有显示名**;唯一既有先例 `commercial_group_audit.platform_subject` 存的正是那个不透明主体串。实施者照抄先例,`actor_display_snapshot` 就会退化成一串标识符——正是硬要求点名禁止的「UUID 而非人可读名字」。修复:详设写明 AuditActor 由**会话解析阶段在 IAM owner 内部**产出 `{actorType, actorId, displaySnapshot}` 并向下游传入,下游 owner 不得自行解析 |
| S-2 | 详设 `:86` vs §3.1 `:84-85` | 审计读取被描述为「显式任务型 **union/join**」,而同文禁止 edge/controller 直连 JDBC 与跨 owner 直查。按字面在 platform-access 写跨 6 schema 的 SQL 会直接撞 `backend-boundaries`/ArchUnit。**实际不需要 union**:12 个 entity type 每一个都唯一落在一个 owner。修复:改为「按 entityType 分派到该 owner 的 audit read API」,并补上**目前完全缺失的 6 个 owner 侧 audit read API 清单**(一个 edge operation 背后的 owner 接口分母现在是空的) |
| S-3 | Journey §4.1 `:55` vs 详设 §5.2 `:145` | **GROUP_WORKSPACE 的审计事实分散在两个 owner**:Journey 把其 owner 定为 platform-workspace,但「商业集团初始化」的审计表是 `organization.commercial_group_audit`,详设自己也把该 audit 记在两家。只读 platform-workspace 就看不到集团初始化——而 Journey 明文承诺「包含已初始化商业集团的可读状态」 |
| S-4 | 详设 §5.1 审计读路径 | **审计查询自身无 workspace 过滤要求**,隔离完全依赖宿主实体授权。本仓其它每张业务表都带 `(workspace_uuid, group_workspace_key)` 复合 FK 做纵深防御,审计读应对齐 |
| S-5 | 详设 §5.2 `:136` | 「additive 统一 audit record 形状」**实际不是 additive**。8 张既有 audit 表的实体 id 列有五种命名(`subject_ref`/`definition_id`/`entity_id`/`account_id`/`contract_id`),`platform_workspace.workspace_audit` **根本没有实体 id 列**,`commercial_group_audit` 是 `BIGINT` 主键 + `TIMESTAMPTZ`(违反 §3.2 的 epochMillis-only)。纯 additive 补齐后每张表会同时有两个时间列、两个 payload 列、两个动作列——**正是本文件 `:225` 声称要关闭的 C-2 缺陷**。而这 8 张表**零写入者、是空表**,precondition + DROP 重建成本近乎为零。同表其它行(contract items `:133`、asset `:134`)都写了 DROP 条款,唯独 audit 行没有。另:`entity_id` **类型未定**——`GROUP_WORKSPACE` 的实体 id 是 `BIGINT`,其余 11 类是 UUID,单一 UUID 列装不下 |
| S-6 | manifest `standardsCoverage.partC`(41–44 行) | 终轮 M-001 的 disposition 原文要求「map each to the applicable delivery unit **and its review checklist/source anchor**」。现在只有 `designUnits`,**缺 `reviewChecklistRef`(应为 `REFERENCE_PATTERN_APPLICABILITY_REVIEW`)与 source anchor**。23 条 C.T 的 enforcement 全是 `UNENFORCEABLE_BY_MACHINE`,checklist 引用正是它们唯一的执法途径 |

### S 级补充(第四路守门 agent 发现,我方复核采信)

| # | owning | 一句话 |
|---|---|---|
| S-7 | `frontend-asset-carryover-manifest.json` 的 `PLATFORM-WORKSPACE-OVERVIEW` vs catalog | **8 个 platform key 中唯一无契约承载者**。104 条 operation 的 `x-page-key` 只有 21 个取值,**不含它**;32 个 scenario 无一落在该 surface;该 key 在 catalog JSON 中出现 **0 次**。而 catalog `crosswalkInvariants.reverseEquality` 要求 pageKey 等于 operation 的 canonicalPageKey,例外表 `sharedOperationPageKeyExceptions` **只有 `getPublicAssetContent` 一条**。U07 实现该 surface 时,要么违反不变量、要么无操作可接。修复:在例外表增补绑定,或明确该 surface 的操作归属 |
| S-8 | 详设 §4 / catalog `denominator.faces` | **105 之后的 face 分布无任何工件声明**。双 face 后逐 face 计数为 39/56/11,和 = 106 ≠ 分母 105;详设、authorization、journey decision、manifest 均未给新三元组,也未声明"face 计数和不再等于 operation 数"这一约定变化。实现者无从判断 `R5_EDGE_CODEGEN_FACE_COUNT` 该改成什么(与 M-1 同源,但即便选 106 也必须单独声明) |
| S-9 | 详设 §6.2 `:177-180` vs carry-over inventory | **审计 Modal 在被自己称作"执行分母"的 inventory 里零条目**。§6.2 明文"实施者不得自行推导",但 inventory 22 行的 focused evidence **无一提及 audit**,从未登记哪几个 surface 要加「操作历史」按钮、`AUDIT-HISTORY-MODAL` 属于谁、该 Modal 必须消费哪些 foundation primitive(foundation 只导出 Drawer 系 `adminDrawerSurfaceProps`,**无 Modal surface primitive**;`overlayLock` 是否必消费未写)。而 U07 的 changeSurfaces 明确要交付这 12 个 Modal——**执行分母与交付单元在同一件事上不闭合** |
| S-10 | carry-over inventory 的 route / generatedSlice 两列 | **声称是唯一执行输入的文件,比它引用的 manifest 更不精确**。**10/22 行的 route 是散文占位**(`invitation URL`、`drawer`、`five home routes`…)而非可执行路由;**22/22 行的 generatedSlice 被截短或变义**(`workspace+asset+organization` 实为 `platform-workspace+platform-asset+organization`、`session` 实为 `workspace-iam-session`…)。与 §6.2「不得自行推导」直接冲突 |
| S-11 | manifest `foundationRequiredAdaptations` | **只登记 2 项,实际有 5 项差异**。已登记的两项(`contextScopedQueryArgs.ts`、`foundation.test.ts`)**其实已经落地**,而 `requiredChecks` 仍表述为待办、详设 §2.2 已完成盘点表**无 foundation 行**(已完成漏登);**未登记的 3 项**:`src/behavior/useSubmissionLifecycle.ts`(v2 中不存在的新文件)、`index.ts` 多出的 export、`package.json`(改名 + 新增 RTK/react-redux)。CLAUDE.md 记的是「R3 仅保留 foundation 原样复制」,实际并非原样 |

**M-1 的补强证据**(第四路独立复核):硬编码 104 / 38-55-11 的生产判定共 **11 处、4 个文件**(`edge-codegen.mjs:37,45,59,207`;`r5-edge-materialize.mjs:219,222,282,300`;`platform-boundary-gates/cli.mjs:81`;`verify-gates/cli.mjs:137,216`)。更严重的是:**`tools/platform-boundary-gates/` 在 8 个 unit 的 changeSurfaces 中出现 0 次**,`…-edge-contract-file-placement-catalog.json`(`status: NORMATIVE_DESIGN_INPUT`,`unresolved: FAIL`)同样**不属于任何 unit**。也就是说,**必然会红的两个 fail-closed 判定点没有任何交付单元认领**。

## 6. N 级 findings(10 条)

| # | 一句话 |
|---|---|
| N-1 | `postRemediationDeclaration` 缺 `reviewedDesignSha256`。详设字节在终轮后也变了(round-2 inputs 声明 `0d768875…`,当前 `290a61f4…`),但声明只记 manifest hash。补一个字段即可 |
| N-2 | **治理气味**:round-2 review 第 106–110 行有 `clericalCorrection`——**有人事后编辑了独立 reviewer 的 verdict 产物**(把失效的 `R5-R2-N-003` 换成 `R5-R2-N-004`,并从 U08 移除)。severity 计数我复算与声明一致、findings↔unitVerdicts 双向链现已零悬空,语义中性;**但 checker 有 `MISSING_FINDING_UNIT_LINK` 红控,这次编辑直接改变了生产门的判定结果,却没有记录修订前 hash**,原始 reviewer 字节不可复核。补 `preCorrectionSha256` |
| N-3 | **门覆盖的诚实披露**:我方 agent 在 scratchpad 拷贝上实测——把 Part C 改成伪造的 `C.T99`、Part B 改成 `B.9.N42`、Part D 改成 `D.99.*`,**甚至整个删除 `standardsCoverage` 字段,生产门仍然 PASS**(对照组 U08 锚点变异正确 FAIL)。即本轮最被强调的「真实 Part C rule ids」处在**零机器覆盖区**,这次是作者手工做对的,不是门保证的。`standards-coverage --phase R5` 只校验矩阵分母,不读 manifest→matrix 引用关系。**这不影响本次判定(23 个 id 我已逐条查证为真),但应如实登记** |
| N-4 | manifest `redFixtures` 自报 8 项,self-test 实际输出 13 项;其中 `REVIEWER_INPUT_CHECKLIST_MISSING` 是真实 fail code 但**不是** fixture 名(真名 `..._NOT_FOUND`);漏列 5 项。checker 只校验 `redFixtures.length >= 4`,名字对错无人管 |
| N-5 | 审计变更字段的**中文 label 由谁产出未裁**:interaction §5 `:80` 读作服务端出 label,而 CLAUDE.md 规定业务文案属两个 App。若服务端出 label,业务文案就进了 contract/owner 层。**属边界语义,建议 Dexter 明确一句** |
| N-7 | **8 个 unit 的 detailDesign 锚点不覆盖 §1、§2(含已完成盘点)、§3、§8、§9、§11**。后果具体:§8 的 48 行闭合矩阵里有 **7 行落在 §9 的 phase 0/1/7**,而 §9 无 unit——其中 **H-1(方案 GO 后被静默修订)与 H-2(Roadmap 自相矛盾)没有任何交付单元**;U01 标题写「修订来源」但其 3 条 approvedAssertions 与 §7 锚点内容全是控制门,零 provenance 内容。另 U03 的锚点 `## 5.` 在文档意义上**完全包含** U04(`### 5.2`)与 U05(`### 5.1`),三者边界靠散文而非锚点区分 |
| N-8 | **已完成盘点漏登 15 张既有表**:8 张 audit 表与 7 张 `*_command_receipt` 表已存在(全库共 55 张),§2.2 只字未提。而 §5.1 只说「additive 统一 audit record 形状」,**未说明是 ALTER 这 8 张还是新建**,也未裁决 `commercial_group_audit` 与 `organization_audit` 是否合并——这直接决定 S-5 的成本。同时 U06 的 `currentDeviation` 写「omit … generated API」不准确:generated 产物已存在(前端三份 operation descriptor 数组条数实测恰为 38/55/11、后端 `edge/generated/` 143 个文件),缺的是 RTK Query endpoint |
| N-9 | manifest line 53 把 `contracts/policy/route-face-registry.json` 列为重生成 6 个 frontend catalog 的 `v2sSources`,**该路径不存在**;实际生成物在 `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`。冻结 manifest 指向空路径 |
| N-10 | carry-over inventory §3 散文清单与自己的表不一致:散文列了 `safe-logger` 而表中 0 行要求,表中用了 `adminDrawerSurfaceProps`(13 行)而散文未列;`observedBaseQuery`→`createObservedBaseQuery` 的别名未进 `foundationPrimitiveNormalization`(该表只登记了 `useOverlayLock`) |
| N-6 | 审计 operation 会产生**第 22 个 `x-page-key`**(`AUDIT-HISTORY-MODAL`,manifest `:170`)。详设声称「不新增 pageDesignKey」**是对的**(x-page-key 21 项与 pageDesignKey 25 项是两套词表),但该声明未覆盖 x-page-key。目前无 checker 引用 pageKey 故不炸,属未登记的隐含约定,建议写明 |

## 7. 方案合理性(先于闭环)

**问题对不对——对。** 用一次重写把"问题总册"的八档缺陷、Dexter 的 14 条裁决与既有冻结分母合并成一份可执行详设,是正确的收敛方式;8 个单元的划分覆盖了总册全部八档,无遗漏章。

**方案优不优——总体优,一处选错。** 审计选"统一一个 read operation + owner-local append + 宿主权限继承"是我推荐的形状,比逐实体开 12 个端点小得多;actor 用写入时快照而非读时 lookup 是正确且必要的 owner 边界判断;Master–Detail Modal 只用当前页数据、不再发请求、不解析 `detail_json`,同时避开了裸 JSON 反模式与 N+1。**选错的一处是 M-1**:把"一个 operation 服务两个 face"当成了免费的简化,而当前流水线的 face 基数是单值——这个简化的真实代价是重建三个生成器,比多一个 operation 大得多。

**代价配不配——配。** carry-over 执行清单把 22/25 变成逐行可执行输入而不重画线框,是低成本高杠杆;P1–P7 的阶段划分把控制先行写进了 exit 条件。

## 8. 章节命中对照(Part B / C / D)

**Part C**:23 条 `C.T01`~`C.T23` 逐条真实、逐条有 designUnits——**本项 PASS**,唯缺 checklist/anchor 映射(S-6)。

**Part B / Part D**:**不合格**,见 M-2。14 个 token 无一为真实 ruleId,5 组纯通配符无条目号,14 章无一 `NOT_APPLICABLE`。按 CLAUDE.md,这张表在 B/D 两部分尚不构成"完整的章节级命中对照表"。

**本评审自身的命中对照**:B.1/B.2/B.3(owner/事务/数据/后端结构)→ M-1、M-3、S-1~S-5;B.4/B.5(前端架构与 UI)→ M-2 的表位置问题、N-5、N-6,carry-over 清单 PASS;B.6(性能)→ S-4 的过滤缺失与审计索引(详设 `:136` 已给复合索引,`NOT_APPLICABLE` 之外无新增运行时语义);Part C 规范性条款 → M-1(契约与生成物一致性)、M-3(typed Problem 与安全边界)、S-2(owner 主权);Part D → M-2、N-1~N-4(交付流程与门纪律)。

## 9. 授权边界

本 NO-GO 只裁定 R5 修订 implementation-facing design **尚不可交 Dexter 接受**。三条 M 全部可在设计层闭合,**仅 M-1 需 Dexter 裁决**(105 保持 vs 拆为 106);M-2、M-3 与全部 S/N 由 Codex 在既有批准边界内自主修复。修订后按 POST_REMEDIATION_V1 机制再次交付即可,**不重开第三轮盲审**。

本评审不授权 implementation、runtime、DEV、seed/reset、contract、migration、app、test、脚本或任何业务源码写入;即便后续转 GO,也仅可交 Dexter 接受,implementation exact authorization 由 Dexter 另行记录。
