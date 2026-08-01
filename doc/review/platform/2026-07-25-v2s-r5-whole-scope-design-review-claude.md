---
title: R5 全范围 implementation-facing 设计 Claude 独立评审(含 post-remediation 复核轮)
type: review
status: DELIVERED
reviewer: Claude
createdAt: 2026-07-26
updatedAt: 2026-07-26
currentVerdict: NO-GO
currentCounts: {M: 2, S: 9, N: 12}
recheckRound: POST_REMEDIATION_RECHECK_1
recheckTargets:
  - path: doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md
    sha256Prefix: dcbca82c0aee557e
  - path: doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json
    sha256Prefix: 81b554561e30ba4f
  - path: doc/plans/platform/2026-07-25-v2s-r5-development-agent-execution-blueprint.md
    sha256Prefix: b17e507043e6728c
  - path: doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json
    sha256Prefix: c98daf1c453b2815
  - path: doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json
    sha256Prefix: 97f2089967df07c4
  - path: contracts/policy/frontend-asset-carryover-manifest.json
    sha256Prefix: ee2003abd0a832a3
  - path: doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json
    sha256Prefix: 65ff5d11803361bc
  - path: doc/review/platform/2026-07-26-v2s-r5-whole-scope-design-review-claude-resolution.md
    sha256Prefix: f1c6382ffb1b652e
  - path: doc/decisions/2026-07-26-v2s-r5-claude-review-five-point-resolution.md
    sha256Prefix: e0c311365393a9ac
  - path: doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-granularity-manifest.json
    sha256Prefix: 597ec953450c3890
programId: V2S_W0_W4_EXECUTION
reviewCycleId: R5-W3-DESIGN-20260725
reviewTarget: DESIGN
reviewTargets:
  - path: doc/plans/platform/2026-07-25-v2s-r5-whole-scope-implementation-design.md
    sha256Prefix: 6175099151063e2d
  - path: doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json
    sha256Prefix: 6d0314e2dacd299d
  - path: doc/plans/platform/2026-07-25-v2s-r5-development-agent-execution-blueprint.md
    sha256Prefix: b11977c12d37cd93
  - path: doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json
    sha256Prefix: 294a42e4a8123e08
  - path: contracts/policy/frontend-asset-carryover-manifest.json
    sha256Prefix: f44d9f86f166e4dd
  - path: doc/decisions/2026-07-25-v2s-r5-whole-scope-interaction-design.md
    sha256Prefix: f4edc0b806bf6ebe
  - path: doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md
    sha256Prefix: 0a2388a51d5af53d
  - path: doc/review/platform/2026-07-25-v2s-r5-design-round-2-finding-intake.md
    sha256Prefix: b2522a5346b2a8ec
authorizationBoundary: DESIGN_REVIEW_ONLY_NO_IMPLEMENTATION
---

# R5 全范围 implementation-facing 设计 Claude 独立评审

> **当前有效结论见 Part R2(第二次 post-remediation 终验轮,2026-07-26):`NO-GO(0 M / 2 S / 4 N)`。**
> Part R(NO-GO 2M/9S/12N)与以下 §0–§11(首轮 NO-GO 23M/36S/10N)均为历史记录,不再单独有效。

---

# Part R:post-remediation 复核轮(2026-07-26)

## R.0 结论

```text
VERDICT=NO-GO
M=2  S=9  N=12
```

一句话:**这是一次高质量、大面积真实闭合的修订——首轮 69 项中 62 项 CLOSED、7 项 PARTIAL、0 项未动,全部机器分母(104/38/55/11/32、22/180/7、89 码、18 hash-lock、Asia/Shanghai epoch)经我方独立重算零偏差,五项 Dexter 授权裁决对语料全部忠实且传导基本到位。** 挡住 GO 的只有两个 M:① 错误码修复只做了"词表登记"没做"可达接线"——89 项 disposition 中 64 个 active 目标码不在任何 errorSet/augmentation 内,wire 永不可达,具名码事实上仍坍缩为通用码,恰违反该目录自订的 `genericBusinessCollapse: FORBIDDEN`;② 前端 manifest 修订留下双列残迹,`foundationPrimitives` 与 `r5Required` 在 11/22 个 surface 上互相矛盾,实施 agent 按就近字段读会精确复现刚修完的 M-11 漂移。两个 M 均为表格级修复(补 augmentation 行/删冗余列),不动任何分母,**无一项需要 Dexter 新裁决**。9 个 S 均为单点残留或修订边缘完备性(RLS 处置、列名跨文档不一致、storeStatus 传导等),12 个 N 为措辞/登记瑕疵。

## R.1 会话出处与方法

- 续接会话(压缩延续)中执行,如实声明;复派 4 路独立守门复核 agent(契约、语料/裁决传导、前端、后端/DEV/seed/蓝图),均以证伪立场对当前字节逐项核验并强制 v2 对照;四路结论经我辩证 intake,**全部 M 级与决定性主张由我本体重算命中后才采信**。
- 本仓零写入(除本文件);变异实验仅在 scratchpad 拷贝(用后销毁)。

## R.2 亲验记录(本体独立重算,fresh)

1. **机械门**:`implementation-design-granularity --manifest … --review …round-2.json` → PASS,`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`;checker 源码通读确认零语义判定,无声明时仍 `REVIEW_MANIFEST_HASH_DRIFT` 红;self-test 13 红夹具 PASS,scratchpad 拷贝上三个独立变异(design 追加字节/删声明/改 intake hash)全部真红且失败原因精确命中(S-35 CLOSED)。`standards-coverage --phase R5` PASS(150)。`claude-review-handoff --file …whole-scope-design-review-request.md` PASS(上轮 `MISSING_SECTION:背景` 已修,S-36 CLOSED)。
2. **分母零漂移**:104 唯一 operation、38/55/11、owner 41/33/10/10/5/3/2、crosswalk 32 行双向零悬空、GET 43 全 FORBIDDEN/写 61 全 REQUIRED_16_128、`groupWorkspaceKey` 178 处零残留、105−2+1=104 集合级成立。
3. **契约层机制**:`PLATFORM_COMMON_*` 10 码闭集;错误码目录 83 heritage+6 R3=89 与我从 v2/v2s enum 独立提取的集合精确相等;`operationErrorAugmentations` 使 `initializeCommercialGroup` 逐字节保留 6 个 R3 码(含 `COMMERCIAL_GROUP_ALREADY_INITIALIZED`);18 个 schema 源文件 sha256 逐个复算 18/18 吻合;`Problem`(RFC7807+errorCode+correlationId 必填)与 `EpochMillis` 字段级完整;`componentReferenceClosure` 140=138+2 重算吻合;`globalRenames` 7 条、`forbiddenProperties` 10 项在案。
4. **数据/DEV**:one-database-per-namespace 派生公式单射性核验;`Asia/Shanghai` + `1784908800000` 手算精确(=2026-07-25T00:00:00+08:00),Seoul 全 R5 工件零残留;`devFixedOtpIssuer` 三条件 fail-closed + 默认 profile must-fail;R3→R5 逐列迁移决议表与 R3 migration 实字节逐列对照成立;蓝图 §13 命令抽验全部真实存在于 scripts/,§14 七条禁伪修复在案。
5. **前端**:22 surfaces、180=133+2+45 与 v2 真实文件树独立枚举吻合,五个聚合 hash+33 具名 hash 全量复算零偏差;7 条 `notCarriedAssets` 四字段齐全 hash 全中;25 pageDesignKeys↔22 surfaces 双向互逆程序验证;零裸 CARRY。
6. **残留 M 的本体复算**:64/84 active 目标码不可达(`CONTRACT_ITEM_CODE_DUPLICATE`、`PLATFORM_IAM_SESSION_EXPIRED` 在列);`WORKSPACE_AUTH`/`PLATFORM_AUTH_LOGIN` 集合均无幂等冲突码而 `preAuthenticationIdempotencyPolicy` 承诺返回它;manifest 双列 11/22 不一致;R3 migration 含 16 行 RLS 相关语句而两份 R5 设计文档对 RLS/policy/current_setting 零命中。
7. **五项裁决忠实性独立判断**:D-07~D-11 对 G-01~G-12 零冲突、零过度推导、零借裁决扩范围;D-09 是对过度推导的净回退;D-10 邀请/合同分任务处置严格遵守 G-08/G-09 互不推导。

## R.3 首轮 69 项 closure 汇总

| 域 | CLOSED | PARTIAL(残留见 R.4) |
| --- | --- | --- |
| 契约层(M-01~07, S-01~09, N-01/03/05) | M-01、M-03、M-05、M-06、M-07、S-01~S-06、S-08、S-09、N-01、N-03、N-05 | **M-02**(可达性)、M-04(→S 残留)、S-07(→S 残留) |
| 语料/裁决(S-10~14, N-02/04/06/07 + D-07~11 传导) | S-10、S-11、S-12、S-13、N-02、N-04、N-06、N-07;D-07/08/09/11 全传导 | S-14/D-10(→S 残留:storeStatus 未进 wire) |
| 前端(M-08~17, S-15~19, N-08) | M-08、M-09、M-10、M-13、M-14、M-15、M-17、S-15~S-19、N-08 | M-11(→S)、M-12(→S)、M-16(→S) |
| 后端/DEV/seed/蓝图(M-18~23, S-20~34, N-10)+ 流程(S-35/36)+ N-09 | 全部 CLOSED(M-18~M-23、S-20~S-34、N-10、S-35 含红夹具真红、S-36、N-09 按 PARTIALLY_CONFIRMED 接受) | — |

**62 CLOSED / 7 PARTIAL / 0 NOT_CLOSED;上一轮全部 PASS 项零回退。**

## R.4 本轮 findings

### M(2 项)

| # | 位置#锚点 | 反例 | 最小修复 |
| --- | --- | --- | --- |
| R-M1(M-02 残留) | catalog#`errorSets`/`operationErrorAugmentations`(仅 1 key)vs 错误码目录#`policy.genericBusinessCollapse=FORBIDDEN` vs 主设计 §2.1:152-153 | 89 项 disposition 的 84 个 active 目标码中 **64 个不在任何 errorSet/augmentation 内**(我重算证实),按主设计"未列码禁止出现在 wire"即永不可达:`CONTRACT_ITEM_CODE_DUPLICATE`(RETAIN)在 `updateOperationsContract` 上只能回 `PLATFORM_COMMON_VALIDATION_FAILED`——具名码事实上仍坍缩,恰是目录自订禁止的行为;`PLATFORM_IAM_SESSION_EXPIRED`(日常主路径)同样不可达。附内部矛盾:`preAuthenticationIdempotencyPolicy` 承诺 replay 返回 `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT`,而 `WORKSPACE_AUTH`/`PLATFORM_AUTH_LOGIN` 两集合均不含该码(4 个 pre-auth 写受影响) | 纯表格扩充,不动 104 分母:为 RETAIN/RENAME 目标补 augmentation 行(per-operation 或 per-owner)挂到至少一个可达 operation;确实要坍缩的码改 disposition 为 NOT_CARRIED/MERGE 并写明目标通用码;两个 pre-auth 集合补幂等冲突码 |
| R-M2(修订引入) | `contracts/policy/frontend-asset-carryover-manifest.json#surfaces[*].foundationPrimitives` vs `#foundationConsumptionBySurface[*].r5Required` | 同一 normative 工件对同一事实存两套,**11/22 个 surface 不一致**(我程序比对证实):如 PLATFORM-ORGANIZATION-OVERVIEW r5Required 含 adminDrawerSurfaceProps+overlayLock 而 foundationPrimitives 无;5 个 ops 列表页 foundationPrimitives 漏 adminDrawerSurfaceProps+contextScopedQueryArgs(v2 实测均在消费)。requiredChecks 只指向 r5Required,但实施 agent 按更就近的 per-surface 字段读会精确复现刚修完的 M-11 漂移 | 删除 `foundationPrimitives` 冗余字段,或改为由 r5Required 机械生成并加一条一致性 requiredCheck |

### S(9 项)

| # | 来源 | 位置 | 一句话反例与最小修复 |
| --- | --- | --- | --- |
| R-S1 | M-04 残留 | placement catalog#`componentFamilyRules` | `SortDirection`(5 op 直引)、`ServiceNodeType`、`ProjectPhaseNames` 无解析规则,按自订 `unresolved: FAIL` U01 首日即停;且 family→owner 目录映射缺失,约 120 个组件完整落位路径机器不可导出。修复:补 3 条规则/exact 行 + 13 行 familyToOwner 表。fail-closed 保底故 S 不升 M |
| R-S2 | S-07 残留 | catalog#两个 select-context command(`WorkspaceSelectContextRequest/DataNodeRequest`) | heritage 体字段就是必填 `expectedContextVersion`,而该名在 forbiddenProperties——baseline 与禁令互斥,fail-closed 会拒掉自己;`REQUIRED_CONTEXT_VERSION` 的实际载体字段未裁决。修复:两 schema 补 override(改名或显式豁免行) |
| R-S3 | 修订引入 | catalog#`componentFieldBaseline.Brand/Tenant/HeadCompany`+3 个列表 op 的 `source` query 参数 | 经营主体 `source`/`BusinessEntitySource(EXTERNAL_SYNC)` 原样保留零 override,与 forbiddenProperties 含 `source`、ORGANIZATION-02 宣布 EXTERNAL_SYNC NOT_CARRIED 互斥(门店侧已修,经营主体侧漏)。修复:同款 override 移除或收窄 MANUAL 单值 |
| R-S4 | S-14/D-10 残留 | catalog#无 `StoreContractStoreCandidate` override(v2 基线 `{store,tenant}` 无状态字段) | D-10"合同候选必须返回门店启停状态"未进 wire schema,冻结契约上不可表达——正是裁决 §3"只改一处不算关闭"的失败模式。修复:`requiredAdditions:["storeStatus"]`(enum ENABLED/DISABLED, readOnly) |
| R-S5 | M-11 残留 | manifest#PLATFORM-PASSWORD/OPERATIONS-PASSWORD | 两密码抽屉在 v2 实际消费 `adminDrawerSurfaceProps`(源码 :2,39/40 亲验),v2Consumed/r5Required 均漏。修复:两行各补该 symbol |
| R-S6 | M-12 残留 | manifest#`browserRoutePolicy` | v2 `organization/store-contracts` → r5 `/operations/:groupWorkspaceKey/contracts` 是移段+改名双重变更,`store-contracts` 三处零出现,ADAPT 规则未落。修复:browserRoutePolicy 增一条显式 rename 记录 |
| R-S7 | M-16 残留 | manifest#OPERATIONS-STORES/STORE-PROFILE `textAssertions.forbidden` | 语料明文"禁用已停业"而该词未入 forbidden(其余四词均已覆盖)。修复:补"已停业" |
| R-S8 | 修订引入(M-19 边缘) | 主设计 §4.1 决议表 vs R3 migration L57-79(16 行 RLS) | R3 对 workspace/commercial_group FORCE RLS 且 policy 要求 `consumer_face='platform-admin'`,决议表只覆盖列、对 policy 零处置(两文档 RLS 零命中);R5 operations 面 JUDGMENT 读 workspace 将被静默过滤为零行,登录报"空间不存在"且不触发 typed error。修复:决议表加一行 policy disposition(建议 additive DROP/改写,并声明授权唯一来源是 §5.3 owner 校验) |
| R-S9 | 修订引入(M-19 边缘) | 蓝图 §2.3 `group_workspace_id UUID` vs 主设计 §4.1 `workspace_uuid` | 新 owner 表 workspace 引用列名两文档不同值,触发其自设"同一事实不同值即停";且复合 FK 需要的 `UNIQUE(workspace_uuid, group_workspace_key)` 决议表只写了单列 unique。修复:统一列名各改一行+补复合 unique |

### N(12 项)

| # | 位置 | 一句话 |
| --- | --- | --- |
| R-N1 | catalog#`operationErrorAugmentations` | `initializeCommercialGroup` 闭集同时含 R3 码与 `PLATFORM_COMMON_*` 同义对,无选取规则,byte-identical 承诺可被合法绕过;加一句"该 op 上同义新码禁用" |
| R-N2 | 错误码目录 | 42 个 wire 可达码中 22 个净新码(`PLATFORM_COMMON_CONTEXT_STALE` 等)无 disposition 行——active code 全集缺单一机器可读登记处(与 R-M1 同根,修 R-M1 时一并收口) |
| R-N3 | resolution 文档 | 两处陈述与字节不符:S-02"8 个"实为 12;N-03"使用真实 $ref"实为符号编码+发射约束(owning 工件本身正确) |
| R-N4 | resolution 文档 S-34 行 | 引用不存在的类名 `Ed25519ProofSigner/Verifier`;蓝图用的真实类名正确,仅 resolution 失实 |
| R-N5 | seed#contracts(5 份全无 `phaseNameSnapshot`) | D-09 正向路径(录快照、改名不回写)seed 零演练;给 1 份合同补快照 fixture |
| R-N6 | manifest#OPERATIONS-CONTRACTS | 分期相关文案零断言;forbidden 可补"分期编码" |
| R-N7 | seed#D03-S01/S02 `negativeFixtureRefs` 含 `store-disabled` | 与"negative=denied 分支"规则并读有歧义(D-10 下合同创建不因停用而拒);加一句用途注记 |
| R-N8 | seed#roles `actionCapabilityKeys` 含 `WORKSPACE_MEMBER_READ` | READ 语义 key 放动作能力(写功能面)集合与 G-05 划分相抵,且两组 key 闭集无 owning 落位;改写语义 key 并指明闭集 owning 文档 |
| R-N9 | manifest#`policy.generatedCatalog.heritageFiles` | 无逐文件 hash,与 notCarriedAssets 不对称 |
| R-N10 | manifest#枚举规则限 src 根 | 两 App vite/playwright 配置共 4 文件在 180 外,app 脚手架搬运无登记(规则自洽,登记缺口) |
| R-N11 | manifest#v2Consumed 用 `useOverlayLock` vs r5Required 用 `overlayLock` | 两列词表不同名,妨碍机械对账(修 R-M2 时一并统一) |
| R-N12 | seed#`resetFailClosedPredicates` "asset root does not end with the exact namespace" | 与 key 派生(namespace 在 root 之后的固定后缀中)自相矛盾;对齐 negativeMatrix 的正确表述 |

## R.5 方案合理性(复核轮)

修订方向与我首轮判断一致:不换方案形状,把 override/登记层补齐到与语料裁决等厚——本轮验证该补齐**基本完成且没有过度工程**(新增三个目录均为最小机器可读表格,未复制 schema、未恢复废弃端点、未动分母)。残留的两个 M 是同一根因的最后一米:R-M1 是"词表登记了但没接到 wire 可达面",R-M2 是"新增权威列后旧列没删"。五项裁决(D-07~D-11)我独立判断全部忠实语料、取舍得当,特别是 D-09/D-10 是对更简单方案的正确回退与拆分。**本轮无需 Dexter 任何新裁决**;全部残留由 Codex 在既有边界内表格级修复即可。

## R.6 章节命中对照(复核轮 delta)

首轮 §9 的 Part B/C/D 对照仍有效,本轮残留映射:B.1(R-S2 语义、R-N8);B.2(R-S8 RLS、R-S9 列名);B.3(R-M1 错误码可达性、R-S1 落位、R-S3);B.4/B.5(R-M2、R-S4~R-S7、R-N9~R-N11);B.6 无残留;Part C typed Problem 由 R-M1 收尾;Part D(R-N5/R-N7/R-N12 seed 侧)。十维度逐章 sweep 复执行,含对五份修订工件的全文阅读与四路守门的逐节覆盖,无采样跳章。

## R.7 授权边界(复核轮)

本 NO-GO(2M/9S/12N)针对 DESIGN;两个 M 与九个 S 均为表格级/行级修复,不动 32/104/22/180 任何分母,不需要 Dexter 新裁决,修复后按 POST_REMEDIATION_V1 机制再次交付即可(不重开第三轮盲审)。本复核不授权 R5 implementation、任何 contract/app/数据库/Flyway/测试/业务源码、DEV、远端连接、seed/reset 或动态运行;即便后续转 GO,implementation exact authorization 仍由 Dexter 另行记录。

---

# Part R2:第二次 post-remediation 终验轮(2026-07-26)

## R2.0 结论

```text
VERDICT=NO-GO
M=0  S=2  N=4
```

Part R 的 23 项(2M/9S/12N)全部经 Codex 表格级/行级修复,本轮复派四路独立守门 agent(契约、前端、后端/数据、语料/裁决传导)+ 我本体对全部决定性主张重算,**23/23 全部 CLOSED,零遗留、零回退**:错误码可达性 84+22=106 与 reachable 精确相等(64/84 不可达已归零,我独立重算证实);`initializeCommercialGroup` 恰六个 R3 兼容码且无同义新码;140 组件 = 139 resolved + 1 NOT_CARRIED 零歧义(SortDirection/ServiceNodeType/ProjectPhaseNames 均已获解析规则);前端 manifest `foundationPrimitives` 双列字段已彻底删除(不是"改派生",是整列消失),两密码 Drawer/route/text/hash/scaffold 五项全部闭合,180=133+2+45 与 39 个具名 hash 独立复算零偏差;R3 四项 FORCE RLS 已由新增 additive compatibility migration 处置(先校验 policy 字节 byte-identical 再 DROP,不改写 R3 文件,与 D-11 无新矛盾);`workspace_uuid` 复合列名与 `UNIQUE(workspace_uuid, group_workspace_key)` 两文档统一;`storeStatus` 字段语义(非仅存在性)与 D-10 原文吻合;`phaseNameSnapshot` 正向路径已在 seed 中演练且值真实取自所属项目分期集合;34 类 v2 foundation disposition 零遗漏零回退;五项裁决(D-07~D-11)全部零回退传导。

**挡住 GO 的是本轮独立复核过程中新发现的 2 个 S(均为修订副作用,非用户点名的 23 项之一)**,不需 Dexter 裁决,均为行级修复:

1. **契约错误码"整族清理"漏了一个成员**:`Brand/Tenant/HeadCompany.source` 已删除(呼应 R-S3),但同一 organization 域的 `getPlatformOrganizationOverviewPage` 仍保留 `source` query 参数(`ref: OrganizationOverviewSource`,历史枚举 `[MANUAL, SYSTEM]`,对照仓 v2 侧曾有文档记录其与已删的 `[MANUAL, EXTERNAL_SYNC]` 是同类枚举分裂旧账)——本轮设计未置一词,既未同款清理也未显式声明"二者是独立概念"。这正是仓内已知 pitfall("同类要闭集扫描,漏一类就是没修")的复现。
2. **crosswalk 自订不变量被自己违反**:`crosswalkInvariants.reverseEquality` 明文承诺"每个 orderedSteps 与 operations[] 同 face/owner/**pageKey**/disposition",但 `getPublicAssetContent` 在 `operations[]` 中 `pageKey=PLATFORM-WORKSPACES`,而 crosswalk 里三处步骤(D01-S01/D01-S02/D04-S08)给出三个不同 pageKey(`PLATFORM-LOGIN-OR-PASSWORD`/`PLATFORM-WORKSPACES`/`OPERATIONS-LOGIN`)。语义可以理解(该 operation 被多页复用),但文本没有为此开例外,机械读取该 invariant 的任何后续脚本会误判。我已亲验此反例(query params、pageKey 字段、crosswalk 三步逐一读取确认)。

## R2.1 会话出处与方法

续接会话,如实声明。复派 4 路独立守门 agent(契约错误码可达性、前端 manifest 残留、后端 RLS/迁移/数据形状、语料裁决传导/seed 残留),四路结论全部经我辩证 intake;**两个残留 S 与全部关键 CLOSED 判定我均本体独立重算/亲验**(可达性 84+22=106 精确匹配、140=139+1 拆分、双列字段确认已整体删除而非改派生、RLS 处置文本、storeStatus rule 文本、phaseNameSnapshot 取值真实性、`OrganizationOverviewSource` 反例、crosswalk pageKey 三步反例——均为本轮亲手执行的 Python/grep 独立重算,非采信 agent 或 Codex 自报)。本仓零写入。

## R2.2 亲验记录(本体独立重算,fresh)

1. **哈希变更确认**:全部 10 个复核对象文件 sha256 相对 Part R 复核时已变化,证实真实被修订(非重复审阅同一字节)。
2. **机械门**:`implementation-design-granularity` PASS(`DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`);`standards-coverage --phase R5` PASS(150);`claude-review-handoff` PASS。
3. **契约错误码可达性**(重点复算):`errorSets ∪ operationErrorAugmentations` = 106 唯一码;disposition 中 RETAIN/RENAME/RETAIN_R3_WIRE_COMPATIBILITY 的 target 并集 = 84;`v2sNativeCodes` 独立登记 22 项与 84 无交集;`unreachable = active − reachable = ∅`。`initializeCommercialGroup` augmentation 恰 6 项(R3 六码原样,`COMMERCIAL_GROUP_ALREADY_INITIALIZED` 在列,零 `PLATFORM_COMMON_*` 同义码)。`WORKSPACE_AUTH`/`PLATFORM_AUTH_LOGIN` 均含 `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT`。
4. **组件解析**:`componentReferenceClosure` = 140 baseline = 137 direct + 2 supporting-only(139)+ 1 unreachable(`BusinessEntitySource`→`NOT_CARRIED_NO_EXTERNAL_SYNC_SOURCE`),与 placement catalog 声明的 closure(139 resolved/1 explicit-not-carried/0 unresolved/0 ambiguous)一致。`SortDirection`/`ServiceNodeType`/`ProjectPhaseNames` 均在 `exactComponentOverrides` 命中,`familyToOwner` 映射新增。两个 select-context command 的 `expectedContextVersion` 已 override 为 `requiredContextVersion`。
5. **Brand/Tenant/HeadCompany**:`removeProperties:["source"]` 三个 override 在案,三个列表 operation query params 已确认不含 `source`。**但**同域 `getPlatformOrganizationOverviewPage` 的 query params 仍含 `source`(我亲验列出全部 13 个参数名),且 `OrganizationOverviewSource` 无任何 override——此为本轮唯一新增契约层 S。
6. **crosswalk pageKey 矛盾**:`getPublicAssetContent` 的 `operations[].pageKey = PLATFORM-WORKSPACES`;crosswalk 中 D01-S01 步骤 pageKey=`PLATFORM-LOGIN-OR-PASSWORD`、D01-S02=`PLATFORM-WORKSPACES`、D04-S08=`OPERATIONS-LOGIN`,与 `reverseEquality` 文本承诺的"同 pageKey"矛盾——我逐行读取原始 JSON 亲验此三步。
7. **前端**:`grep -c foundationPrimitives` 在 manifest 中仅命中 `requiredChecks` 一处散文断言,`surfaces[*]` 全部 22 条均无该字段(不是"值相等"而是"字段消失",比我预期的最小修复更彻底)。两密码 Drawer 的 `v2Consumed`/`r5Required` 均含 `adminDrawerSurfaceProps`。`browserRoutePolicy.explicitRenames` 含 `store-contracts→contracts` 显式记录。`OPERATIONS-STORES`/`OPERATIONS-STORE-PROFILE` 的 forbidden 均含"已停业"。
8. **后端**:R3 migration 16 行 RLS 语句字节未变;主设计与蓝图均声明"新增 additive compatibility migration,先校验四个 policy 名称/定义与 R3 冻结字节 byte-identical,再逐表 DROP POLICY/NO FORCE/DISABLE RLS,不改写 R3 文件"——按用户本轮给定的判据(新增文件执行 DROP 不算改写旧文件),与 D-11 无新矛盾。两文档统一为 `workspace_uuid` 列名,`UNIQUE(workspace_uuid, group_workspace_key)` 已声明。`StoreContractStoreCandidate.storeStatus`(readOnly enum ENABLED/DISABLED)的 `rule` 文本与 D-10 原文"响应必须返回门店启停状态供 UI 如实展示"近乎逐字对应。
9. **语料/裁决**:`phaseNameSnapshot="一期"` 出现在 `contract-current-a`,其 store 所属 project 的 `phases` 数组含"一期"——快照值非任意字符串,是真实的"当时项目分期成员"。`WORKSPACE_MEMBER_READ` 全仓零正向残留(仅存于历史 review 文档);现用 `BC-IAM-*` 系列写语义 key,`actionCapabilityCatalog.activeKeys` 闭集 34 项已声明。D-07~D-11 七处工件(主设计/蓝图/catalog/seed/Journey/交互/manifest)传导零回退,唯一缺口是 Journey/交互两份工件对业务日历时区无任何文字提及(D-07 无 Journey 可见行为差异,纯文档完备性缺口)。

## R2.3 Part R 23 项复核汇总

**23/23 CLOSED,0 遗留,0 回退。** 逐项判定见四路 agent 报告(契约:R-M1/R-S1/R-S2/R-N1/R-N2 CLOSED;前端:R-M2/R-S5/R-S6/R-S7/R-N9/R-N10/R-N11 CLOSED,0/0/0;后端:R-S8/R-S9/storeStatus/phase-snapshot/34-action-catalog/asset-reset/迁移决议表全量重查 CLOSED,0/0/1N;语料:R-N5/R-N6/R-N7/R-N8/D-10 CLOSED,0/0/1N)。

## R2.4 本轮新增 findings(2 S / 4 N)

| # | 位置#锚点 | 反例 | 最小修复 |
| --- | --- | --- | --- |
| R2-S1 | catalog#`operations[getPlatformOrganizationOverviewPage].queryParameters` + `componentFieldBaseline.OrganizationOverviewSource`(无 override) | `Brand/Tenant/HeadCompany.source` 已删,同域总览页的 `source` 参数与 `OrganizationOverviewSource`(历史枚举 `[MANUAL,SYSTEM]`)未同款处理——未声明是否与已删字段同概念 | 显式裁决:若同概念则同款清理/重定义来源;若独立概念则加一句声明+数据来源说明(不动分母) |
| R2-S2 | catalog#`crosswalkInvariants.reverseEquality` vs `scenarioOperationCrosswalk` 三步(D01-S01/D01-S02/D04-S08 for `getPublicAssetContent`) | 文本承诺"同 pageKey"与三步给出三个不同值矛盾,机械读取该 invariant 的后续脚本会误判 | 放宽 invariant 文本为"canonical pageKey 仅供分类,跨页复用 operation 允许 per-step pageKey 不同",或改 `operations[].pageKey` 为"主 owner 页面"并显式登记复用例外清单 |
| R2-N1 | error-code-disposition-catalog#`heritageCodes`+`r3CompatibilityCodes` | `COMMERCIAL_GROUP_ALREADY_INITIALIZED` 在两张表各登记一次(同码同 disposition),数学上因去重不影响 84/106,但属脆弱非规范化数据 | 从 heritageCodes 移除该行,只保留 r3CompatibilityCodes 一处 |
| R2-N2 | error-code-disposition-catalog#`closure.activeTargetCodeCount` | 字段名 `activeTargetCodeCount`(=106)与设计文档"84 Heritage/R3 + 22 native"表述不直接对应,易被后续脚本误当作 84 | 拆为 `heritageR3ActiveTargetCount:84` + `v2sNativeActiveTargetCount:22` + `totalActiveTargetCount:106` 三字段 |
| R2-N3 | 后端 agent 观察 | `StoreContractStoreCandidate` 与宿主 `StoreContractCandidatePage` 的 wrapping 关系未在 catalog 中以显式 `items ref` 字段直接可见(仅间接确认非孤儿) | U01 落地时在 file-placement/component 生成报告中显式核验一次,非当前设计层缺陷 |
| R2-N4 | `doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md`、`…-interaction-design.md`(业务日/时区零命中) | D-07"同步责任"点名 Journey/交互工件为同步目标,但两工件对 `Asia/Shanghai`/业务日历时区无任何文字提及;无 Journey 可见行为差异,纯文档完备性缺口 | 两工件各加一句"业务日边界依据 D-07 固定时区"引用即可 |

## R2.5 章节命中(delta)

R2-S1/R2-N1/R2-N2 属 Part B.3(错误/契约字段);R2-S2 属 Part B.5(UI/信息架构,pageKey 是 UI 路由锚点);R2-N3 属 B.3;R2-N4 属 Part D(seed/DEV 同步责任的文档面)。十维度 sweep 复执行,四路 agent 各自读取五份以上修订工件全文,无采样跳章。

## R2.6 授权边界

本 NO-GO(0M/2S/4N)针对 DESIGN。两个 S 与四个 N 均为行级修复,**其中一项(R2-S1)需要 Dexter 就"OrganizationOverviewSource 是否与已删字段同概念"给一句确认**,其余五项 Codex 可在既有边界内自主修复,不构成再授权门槛。不动 32/104/22/180/84/22/106 任何分母。本复核不授权 R5 implementation、任何 contract/app/数据库/Flyway/测试/业务源码、DEV、远端连接、seed/reset 或动态运行;即便后续转 GO,implementation exact authorization 仍由 Dexter 另行记录。

---


一句话:**operation 层是真金,字段/错误/时间/文件落位层是空壳,DEV/seed 与既有工具链有三处纸面即断的硬互斥。** 32↔104 双向 crosswalk、38/55/11 分组、105→104 账目、G-07 邀请链、G-10 全量改名、五类首页处置、禁物零残留——这些经机器全量对账全部成立,质量很高。但契约目录以「heritage 基线 + override + 未列即禁」承载分母,而 override 层只有 1 条改名 + 3 条禁用属性,导致 v2 旧语义(旧错误码词表、旧日期字段、旧组织类型命名、EXTERNAL_SYNC、双并发字段)**经继承默认值成建制回流**;三态、Problem 信封、epochMillis 在契约分母层零锚点;既有 verify-gates/codegen 硬编码与三 face 拆分结构互斥,把开发 agent 最省力路径恰好推向设计明令禁止的单体大文件;reset allowlist 与 owner schema 拓扑互斥使 clean rebuild 链在纸面上就跑不通。这些不是边角,是主干,故 NO-GO。

全部 M 均为设计层可闭合(补 override、补裁决、补落位表),不动 32/104 分母;仅 5 处需 Dexter 裁决(见 §7)。

## 1. 会话出处与方法披露

- 本评审在 v2s 仓根会话中进行,**续接会话**(上下文经压缩延续,非单次 fresh 会话),按亲验纪律如实声明,不冒充 fresh acceptance。
- 按 Dexter 指示派出 **4 路独立守门 agent**(契约分母、语料语义、前端 carry-over、后端/DEV/seed/蓝图),每路均以证伪立场并强制对照 `/Volumes/idea/catering-all-v2` 原始内容;四路结论我逐一做辩证 intake,**关键 M 级主张全部由我本体重新抽验命中后才采信**(抽验记录见 §2)。
- 评审期间本仓零写入(除本交付文件);变异/重算均在会话 scratchpad 或只读命令中完成。

## 2. 亲验记录(本体独立重算)

1. **fresh 机械门复跑**:
   - `scripts/check/implementation-design-granularity --manifest … --review round-2` → **FAIL `REASON=REVIEW_MANIFEST_HASH_DRIFT`**。这是 post-remediation 字节与第二轮 review 绑定 hash 的诚实漂移(治理禁止回填旧 review),但治理缺一个合法收口机制 → 记 S-P1。
   - `scripts/check/claude-review-handoff --file doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-review-request.md` 对本次 review-request → **FAIL `MISSING_SECTION:背景`** → 记 S-P2。
   - `scripts/check/standards-coverage --phase R5` → PASS。
2. **盲审治理边界核验**:两轮均为 fresh `INDEPENDENT_SUBAGENT`、带 `reviewerInputChecklist`(path+sha256)与 `blindReviewDeclaration`;第二轮 `NO_GO(3M/4S)` 后 `SELF_DECIDED` 收口、不开第三轮、不回填 hash——**全部合规**。intake 文件如实声明 post-remediation 字节未经独立 re-review,诚实。
3. **契约目录关键主张本体重算**(python 全量解析,非抽样):
   - `initializeCommercialGroup.errorSetRef=OWNER_COMMAND`,该闭集 10 码中**无** `COMMERCIAL_GROUP_ALREADY_INITIALIZED`,且该码在全部 errorSets 中零出现;
   - `componentOverrides.globalRenames` 仅 `{workspaceKey→groupWorkspaceKey}` 一条,`forbiddenProperties` 仅 3 项;
   - `componentFieldBaseline.OrganizationStore = {"ref":"OrganizationStore"}`(空壳);`contractDerivedStatus` 与 `OPERATING` 在 218KB 目录中**零出现**;`epochMillis` 零出现;
   - 对照仓 `contracts/openapi/components/contract.schemas.yaml:69-70` 确为 `startDate/endDate: {type: string, pattern: '^\d{4}-\d{2}-\d{2}$'}` 且 `required` 含 `itemCodes`。
4. **工具链硬编码亲验**:`tools/verify-gates/cli.mjs:36`(`JSON.parse` 单文件 `edge.openapi.yaml`)、`:57`(`face !== "platform-admin"` 即 fail)、`scripts/generate/edge-codegen.mjs:53,64`(同构硬编码)逐字在案。
5. **数据/DEV 关键主张亲验**:seed `profile.resetAllowlist.database` 确为 `schemaDerivation: replace('-','_',V2S_DEV_NAMESPACE)` + `schemaPattern ^v2s_dev_…$` + `forbiddenSchemas` 含 `public`;`controlledClock.zoneId="Asia/Seoul"`;R3 migration `V20260725_170000_000__*.sql` 确为 `BIGINT GENERATED BY DEFAULT AS IDENTITY` + `TIMESTAMPTZ` + `revision` + `VARCHAR(120)`;v2 `ProblemDetailSupport.java` 第 3 行确为 `import com.cateringall.v2.platform.wire.model.PlatformErrorCode`;蓝图对 `scripts/verify|scripts/check|gradlew|npm run` 与 `伪修复|@Disabled|放宽断言` **双零命中**;6 个 `inv-completed-*` 在 seed JSON 中各仅 1 次命中(被引用、未定义)。
6. **哈希登记**:八个评审对象 sha256 前缀见 frontmatter,均为本会话内新鲜计算。

## 3. 方案合理性判断(先于闭环)

1. **问题对不对——对。** 以 32 场景↔104 operation 的闭集契约先行、后端按 owner 拓扑序、前端 carry-over-first,正是双盲收敛与 D-01~D-06 裁决的忠实执行;未发现"精确地做 1+1 而用户要 5-4"的方向错位。
2. **方案优不优——形状优,执行厚度不足。** 「heritage 基线 + 显式 override + 未列即禁」是我会给出的同构方案(比逐字段手抄 134 个 schema 更小、比自由发挥更紧)。失败点不在方案形状,而在 override 层只做了约 1% 的必要量:凡语料/D-02 推翻了 v2 的地方(错误码词表、日期字段、组织类型、并发字段、source 枚举、三态字段),都必须有对应 override,否则「未列即禁 + 继承默认」这对机制会**机械地把被推翻的 v2 语义原样运回来**——这正是本次 23 个 M 中契约层 7 个的共同根因。修复不需要换方案,只需要把 override 层补齐到与语料裁决等厚。
3. **代价配不配——配,无过度工程。** 12 unit 串行、r5-full seed、五账证据与当前阶段匹配;唯一"轻过度推导"是分期 `phase_key` 轻主数据化(S-14,需 Dexter)。反向的"工程不足"更突出:蓝图缺机械自检命令与禁伪修复条款(M-23),对一个由 agent 长程执行的 12-unit 交付,这两根支柱比任何新门都便宜且必要。

## 4. M 级 findings(23 项)

每项含 owning 位置#锚点 / 反例 / 最小修复;标注【Dexter】者需产品裁决,其余 Codex 在既有边界内自主修复。

### 4.1 契约目录层(M-01~M-07)

| # | 位置#锚点 | 反例(按字面执行会发生什么) | 最小修复 |
| --- | --- | --- | --- |
| M-01 | catalog#`errorSets.AUTHZ_READ/OWNER_COMMAND` vs 主设计 §2.2:134 域前缀规则 | 两集合全部 10 码(`ACCESS_DENIED`、`VALIDATION_FAILED`、`VERSION_CONFLICT` 等)无域前缀,被 88/104 operation 引用——设计主干 100% 违反自订规则 | 为通用码统一加域(如 `PLATFORM_COMMON_`)或在 §2.2 显式登记"跨域通用码豁免前缀"并列闭集;二选一,不得留默认 |
| M-02 | catalog#`errorSets`(36 码)vs 对照仓 `components/platform-errors.schemas.yaml`(83 具名码);`contracts/openapi/components/problem.schemas.yaml:10`;`scripts/run/platform-commercial-group-skeleton:171` | ① 83 个 v2 具名码坍缩为 `VALIDATION_FAILED/OWNER_INVARIANT_VIOLATION` 两笼统码,`v2sOverrides` 无任何 ERROR-xx 声明此次词表重写;② G-01 强制拒绝码 `COMMERCIAL_GROUP_ALREADY_INITIALIZED` 丢失,R3 已上线断言与前端文案随之失效;③ R3 现网码(`INVALID_EDGE_CONTEXT` 等)被静默改名无迁移表 | 增 ERROR-xx override:保留业务可分辨的具名码(至少语料/断言/文案已消费的),`initializeCommercialGroup` 单列或追加 operation 级错误码;U01 补 R3→R5 错误码迁移表(含前端文案键) |
| M-03 | catalog#`componentFieldBaseline`(134 条中 128 条为 `{"ref":"X"}` 空壳)、无 `Problem` 条目、`correlationId` 仅 1 次、`epochMillis` 零出现;`source.sha256` 只锁零字段的 `platform-admin-edge.openapi.yaml` | 主设计 §2.1 声称该结构是"DTO 字段分母",实际字段全在未锁 hash 的 `platform-wire-model.openapi.yaml` + 15 个 `components/*.yaml` 里——分母**不可冻结、不可验证**;错误响应体形状零定义 | baseline 逐条落实字段级内容或把 15 个真实来源文件全部纳入 `source` hash 锁;新增 `Problem` 信封 schema(RFC7807+errorCode+correlationId)与时间字段 `format:int64` 的机器可读登记 |
| M-04 | catalog#`operations[*]`(104 行无 `capability`/目标 paths 文件字段)vs 主设计 §2.1:100-104 拆分规则 | face+owner 不足以唯一定位文件(operations-admin×organization 一组 30 op 必须再拆而拆法无处可查);500 行上限只是散文 | 每 operation 增 `capability` 与目标 `paths/<face>/<capability>.paths.yaml` 落位字段,schema 同理落到 `components/<owner>/<family>` |
| M-05 | `tools/verify-gates/cli.mjs:36,57`;`scripts/generate/edge-codegen.mjs:53,64`;主设计 §8 U01:415-424 | 既有 gate/codegen 硬编码「单一 JSON 根文件 + 内联 paths + face 只能是 platform-admin」;R5 三 face + `$ref` 拆分一落地即全红。开发 agent 最省力路径恰是先堆单体 `edge.openapi.yaml` 过现有门——设计 §2.1 明令禁止的行为被工具链反向激励 | U01 显式指名改写这四处(多 face 闭集、`$ref` 解析或以 bundle 产物为 gate 输入),并写明改写仍属"分母现实更新、不新增语义 gate" |
| M-06 | catalog#`componentFieldBaseline.OrganizationStore`+`componentOverrides`(无三态字段)vs 主设计 §4.2:251-252、D-04 | `OPERATING/PREPARING/NOT_OPERATING` 在 218KB 目录零出现,heritage `OrganizationStore` 无该字段而"未列字段被禁"——三态在 wire 层**不可实现**,D03-S04/D02-S07 无法验收 | `componentOverrides` 新增只读必填枚举字段(如 `OrganizationStore.contractDerivedStatus`),并同步主设计 §2.2 表 |
| M-07 | catalog#`globalRenames`(仅 1 条)vs 对照仓 `contract.schemas.yaml:69-70,14`、主设计 §2.2:135、蓝图 §9.2:577 | 契约按 heritage 生成 `startDate/endDate`(string+pattern)与 `START_DATE` 排序键,后端/DB 是 `effective_from/effective_to DATE`——契约与数据模型互相打架,且 pattern-string 违反 D-02 `format: date` | `globalRenames` 增 `startDate→effectiveFrom`、`endDate→effectiveTo`、`START_DATE→EFFECTIVE_FROM`,旧名进 `forbiddenProperties`,声明 `format: date` |

### 4.2 前端 carry-over manifest 层(M-08~M-17)

owning 文件均为 `contracts/policy/frontend-asset-carryover-manifest.json`(下称 manifest),对照 v2 事实全部经守门 agent 实测、关键项我复核。

| # | 位置#锚点 | 反例 | 最小修复 |
| --- | --- | --- | --- |
| M-08 | manifest#`surfaces`/`closure.surfaceCount`;`policy.sourceUse` | ① 漏 3 个 surface:`PLATFORM-WORKSPACE-OVERVIEW`(v2 `pageRegistry.ts:29` 真实注册页)与双 App 密码抽屉——19 应为 22,交互工件已登记三者 hash 而 manifest 漏;② hash 分母只覆盖 19 个页面主文件,v2 前端实为 133 个 ts/tsx,共享组件/model/locators/app 壳全部失管,"逐文件 hash 搬运"名不副实 | 补 3 surface;`sourceUse` 分母扩为全量文件清单(或显式声明非页面文件的归属策略),并与设计正文建 surface 对账表 |
| M-09 | manifest#`surfaces[PLATFORM-ORGANIZATION-OVERVIEW]`、`[OPERATIONS-ORG-STRUCTURE]` 标 `CARRY` | 两文件 `workspaceKey` 各 15-16 处深嵌(持久化快照字段、server 回包断言、列定义、硬编码旧 endpoint 字符串),交互工件对同 screen 标 `PARTIAL_COUNTERPART`——`CARRY` 与已接受工件直接冲突;且 wire 全量重生成本身使任何 `CARRY` 失效 | 两条改 `ADAPT`;鉴于 §6.2 的 ADAPT 规则无差别适用于全部页面,建议从 enum 删除 `CARRY` 取值杜绝复发 |
| M-10 | manifest#`surfaces`(零条 `NOT_CARRIED`) | 退役物均有 v2 真实消费点却无负向条目:`useCheckOperationsPageEntryGuardMutation`(`OperationsContextShell.tsx:117,147`——就写在被标 ADAPT 的壳主文件里,最易被原样带回)、`getWorkspaceRoleCandidates`、`logoBindGrant`+transient-404 retry、direct add/edit、旧 3681 行×2 generated wire——§10.3"零残留"无任何可执行检查点 | 每退役物增 `NOT_CARRIED` 条目(sourcePath+hash+reason+replacedBy) |
| M-11 | manifest#`surfaces[*].foundationPrimitives` | 抽验 3 条错 2 条(`PLATFORM-AUTH` 声明 4 个 primitive 而 v2 登录页零 foundation import;organization-overview 声明与实际 import 不符);`adminDrawerSurfaceProps`/`safeLogger` 全表零出现 | 逐条按 v2 实测 import 重写,拆 `v2Consumed`/`r5Required` 两列 |
| M-12 | manifest#`surfaces[OPERATIONS-*].route` vs 主设计 §2.2 与交互工件 §2 | 壳内 operations 路由不带 `groupWorkspaceKey`,违反自己冻结的"路径统一带 key"规则;`/operations/contracts` 的 UI 路由改名把 API 路径规则误套到 UI route 且未列 ADAPT 规则 | 路由统一为 `/operations/:groupWorkspaceKey/…`;UI 路由变更单列 ADAPT 规则并写明 pageDesignKey 是否随改 |
| M-13 | manifest#`surfaces[OPERATIONS-FIVE-HOME-BOOTSTRAPS].sourcePath` | 指向 19 行的 `OperationsAdminSeed.tsx`(内无任何 route);5 条真实 route 在 `router.tsx:16-20`/`pageRegistry.ts:13-17`,均无登记无 hash——把交互工件诚实的"未定位"压成了具体但错误的单文件路径 | sourcePath 扩为文件集(Seed+router+pageRegistry+approvedPageDesignKeys)各带 hash |
| M-14 | 主设计 §6.1 + manifest(缺失)vs v2 双 App `useDrawerFormLifecycle.ts` 实测 | platform 侧 wrapper 传 `idempotencyKey:true`+结构化日志;operations 侧 10 行 wrapper 只传 `dirtyGuardTestIds`,且 ops 全 App 零 logger——照搬即 6 个写页面全线违反 §2.2"全部写命令带 Idempotency-Key",而 manifest/设计均无此补做项,agent 逐行搬运时无任何触发点会发现 | 显式补做项:ops Drawer lifecycle 与 platform 对齐(idempotencyKey+onDiagnosticEvent→新建 ops safeLogger),进 manifest 与 §6.1 双写 |
| M-15 | manifest#`closure.requiredChecks[6]` | "no app-local duplicate of Drawer lifecycle…"按字面执行会删掉 platform 唯一注入 `idempotencyKey:true` 的薄 wrapper——门自己拆掉幂等机制 | 改为"no app-local **reimplementation**"+豁免纯参数注入 wrapper+正向断言(wrapper 必须注入 idempotencyKey 与 onDiagnosticEvent) |
| M-16 | manifest#`surfaces[*]`(无 `textAssertions`)vs 语料硬禁令与交互工件 §3 差异栏 | "不叫诊断""禁止商户混称""禁用已停业"等已写进交互工件,但下游零承接;`商户/诊断/已停业/当前身份/查看范围` 在 manifest 零出现——文案校正在实施期无检查点 | 每 surface 增 `textAssertions{required,forbidden}` 从语料与交互工件机械导出;requiredChecks 增"每 surface L2 至少断言 1 正向词+1 禁用词零出现" |
| M-17 | manifest#`policy`(无 `generatedCatalog`)| `generatedAdminCatalog.ts`(1023/1587 行)、`generatedPresentationCatalog.ts`、`generatedProblemSemantics.ts` 被每个 surface import、是 pageDesignKey 唯一来源,却无 disposition 无重生成契约——agent 最可能直接从 v2 拷贝,而 v2 版本塞满旧 pageDesignKey 与旧词 | `policy` 增 `generatedCatalog` 条目声明 v2s 产出源与生成脚本,显式 `NOT_CARRIED`(不得从 v2 拷贝) |

### 4.3 数据 / DEV / seed / foundation / 蓝图层(M-18~M-23)

seed 契约 = `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`;蓝图 = `…-r5-development-agent-execution-blueprint.md`。

| # | 位置#锚点 | 反例 | 最小修复 |
| --- | --- | --- | --- |
| M-18 | seed#`profile.resetAllowlist.database` vs 主设计 §4.1:219-233 | 三重互斥:① allowlist 派生 schema `v2s_dev_<ns>` 永不等于七个固定 owner schema → `dev reset` 一张业务表都清不掉,§7.3 证据链首步纸面即断;② flyway history 在 `public` 而 `public` 被禁 → "从清洁 namespace rebuild"前提被自己否掉;③ 固定 owner schema 名使同库并存两个 namespace 不可能,隔离承诺是空的 | 二选一并全文一致:每 namespace 一个 database(reset 精确到库、schema 名不变),或 schema 加 ns 前缀+history 移出 public;同步改 §4.1、schemaPattern、forbiddenSchemas、fail-closed predicates |
| M-19 | 主设计 §4.1:221 + 蓝图 §2.3:58-74 vs 仓内 `V20260725_170000_000__platform_workspace_and_commercial_group.sql` | R3 遗留表 `id BIGINT IDENTITY`/`TIMESTAMPTZ`/`revision`(含 `CHECK(revision=1)`)/`VARCHAR(120)` 与 R5 约定 UUID/epochMillis/`version`/`VARCHAR(64)` 冲突;设计同页既写"R3 migration 永不改写"又写 `retain/alter`——开发 agent 第一天就必须当场发明迁移方案 | §4.1 增"R3 遗留表→R5 目标形状"逐列决议表(id 混用与否、revision→version、TIMESTAMPTZ→BIGINT 的 additive 迁移与回填),同步蓝图 §2.3 |
| M-20 | 蓝图 §2.4:79/86/94 vs v2 `foundation/problem/ProblemDetailSupport.java:3` | 白名单表头声明 foundation"无 generated wire",同表却要求搬入 import 了 `PlatformErrorCode`(generated wire)的类——`CARRY_ADAPT` 后要么违反自身约束,要么映射必须外迁而文档没选 | 拆两项:foundation 只留 RFC7807 骨架+correlationId 注入(零 wire);`GeneratedErrorCode→HttpStatus` 映射落 business server app 层 advice,同步 §3.2 流程图 |
| M-21【Dexter】 | 蓝图 §2.3:64、§9.1:564;seed#`controlledClock.zoneId="Asia/Seoul"`;主设计 §2.2:135 | ① 无全局可注入 clock 抽象(白名单无 clock 项)→ 7 个 owner 写 `created_at/expires_at` 时 agent 会写 `System.currentTimeMillis()`;② seed 要求"全部 seed 时间戳用固定 clock"而五个 stage 走 `REAL_*_COMMANDS`(服务端产时间)→ 规则与通道互斥,需 DEV-only 固定 clock 开关而两份设计都没有;③ 业务日历时区被 seed 单方面绑到 `Asia/Seoul`,与中国购物中心语料(统一社会信用代码)不符,跨日边界三态不可复现 | 增 `platform-foundation/time` 的 `TimeProvider` 并写明与 `BusinessDateProvider` 关系;DEV-only 固定 clock 的配置来源+profile 门禁+fail-closed;**时区裁决属产品事实,需 Dexter 定**后同步 seed |
| M-22 | seed#`credentialSources.V2S_SEED_OTP_FIXED_VALUE`(5 条 binding)vs 主设计 §7.2 直写白名单、蓝图 §12 通道枚举 | access stage 走真实公开链、OTP 只存 hash——seed 要预知 OTP 就必须存在一条**未登记**的服务端 DEV 固定 OTP 通道;实现为无门禁配置开关时,生产构建里就是万能验证码 | 登记为第四通道 `DEV_FIXED_OTP_ISSUER`:namespace 匹配+`r5-full`+非 production marker 三条同时成立才装配 bean,缺一 fail-closed;§11.1 加"默认 profile 下固定 OTP 必拒"must-fail |
| M-23 | 蓝图 §13、§11.3(全文零命中任何可执行命令与伪修复禁令) | ① §13 的"compile/typecheck、L2、affected gates"全是名词——仓内有 `scripts/verify`/`scripts/check` 而蓝图一个不引,agent 逐 unit 自行猜命令,evidence 不可比;② 全文无一句禁止"改断言就绿/@Disabled/stub owner/改 gate 分母/手写未执行的 evidence"——恰是 §11.3 十条 must-fail 最易被糊弄的方式 | §13 改逐 unit 命令表(unit→必跑命令→期望输出→失败即停);新增 §14 禁止伪修复条款(逐条列禁行为+发现 gate 错时唯一动作是停下回设计) |

## 5. S 级 findings(36 项,紧凑表)

标注【Dexter】者需产品裁决,其余 Codex 自主修复。

### 5.1 契约层(9)

| # | 位置 | 一句话 |
| --- | --- | --- |
| S-01 | catalog(无 `renamedOperations` 段) | 3 项改名只在散文,105−2+1=104 的账机器层对不上(集合差 5 vs 4);补机器可读改名表 |
| S-02 | catalog 8 个 pre-auth 端点(login/OTP) | 未认证端点强制 `Idempotency-Key`+receipt 回放与安全立场紧张;逐项声明理由或豁免 |
| S-03 | catalog#`getPublicAssetContent`(pageKey=`PLATFORM-WORKSPACES`,scenario 仅 D01-S02) | 运营壳/登录页同样消费该端点却无 operations 侧场景映射——真实消费未覆盖 |
| S-04 | 仓内现状 `contracts/openapi/edge.openapi.yaml` + `problem.schemas.yaml` | R3 现网 GET 带 required 幂等 header、`code` 非 `errorCode`、无 correlationId——设计已宣告修正,但 U01 evidence 须显式点名这批实证违规 |
| S-05 | catalog#`componentFieldBaseline`(23 条无直接引用) | 引用层级未标注,`zeroReferenceClosure` 不可机器判定 |
| S-06 | catalog#`StoreContract*`(`itemCodes` 已禁但替代未声明) | `items` 的属性名/required/minItems 靠猜;逐 schema 声明 `items: array<StoreContractItem>, minItems:1` |
| S-07 | catalog 继承 heritage 必填 `expectedRevision`/`expectedContextVersion` | 与 `expectedVersion` 并存成双并发形状,违反 D-02;旧字段进 forbidden,`expectedContextVersion` 仅限 query/cache |
| S-08 | catalog 继承 `WorkspaceOrganizationType:[…,HEAD_COMPANY,STORE]` 及同名字段 | 总公司/门店不是组织树节点(G-02);wire 层统一改 `ServiceNodeType`,后端已改而契约未改 |
| S-09 | catalog 继承 `OrganizationStore.source: MANUAL/EXTERNAL_SYNC`(必填)而蓝图 store 表无 source 列 | 契约字段无数据来源+暗示 G-04 明确不做的 ERP 镜像;删除/收窄为单值并写明理由 |

### 5.2 语料 / schema 层(5)

| # | 位置 | 一句话 |
| --- | --- | --- |
| S-10【Dexter】 | 蓝图 §7.2:428 `project_phase(phase_key…)`+§9.2:578 快照引用 | 分期获得稳定 key 并被合同引用=轻主数据,超出 G-04"只存名称快照";降为名称数组或单独提裁 |
| S-11 | 蓝图 §7.3:441-444 store 序列读作 head-company 必填 | 与 G-03"0..1 可选"相悖;改写为可空+仅提供时校验品牌授权,表标 nullable |
| S-12【Dexter】 | catalog `updateWorkspaceRole`(单命令全量替换 page+capability)vs 交互工件"分开读取分开提交"、Journey"批量只追加" | 两份冻结工件互斥:或补两个独立 operation(动 104 分母),或修订 IX/JD 措辞——需 Dexter 选路径 |
| S-13 | 蓝图 §9.2:583-585(`store_contract_item` 无 `UNIQUE(contract_id,item_code)`) | "合同内编码唯一"缺 DB 具名约束,并发下应用层校验失效 |
| S-14【Dexter】 | 蓝图 `ResolveStoreCandidates`/`ResolveContractCandidates` 无状态谓词 | 沿用 v2 过滤 DISABLED=新增一条 G-08 未裁决阻断;显式声明谓词并标"已/待裁决" |

### 5.3 前端层(5)

| # | 位置 | 一句话 |
| --- | --- | --- |
| S-15 | manifest#`closure.operationsAndPublicFeatureSurfaces` | shell/业务/公开三类混装,"壳外公开三页"不可机检;拆三计数 |
| S-16 | manifest#`foundationRequiredAdaptations[0].change` | 改名描述宜逐符号列出(含 `ContextScopedQueryResult` 的条件类型 `Pick`),防漏改 |
| S-17 | manifest#`surfaces[PLATFORM-AUTH]` | v2 登录页零 foundation 消费,令其消费 4 primitive 属新增改造,应升具名 ADAPT 规则 |
| S-18 | `contracts/policy/affected-l2-registry.json`(仅 3 粗粒度 surface) | 无 per-page L2 映射,前端改动只会全量 fallback `ALL_R3_L2`,失去精度 |
| S-19 | manifest#`closure.requiredChecks` | 缺 pageDesignKey 集合↔surface 集合双向闭合(v2 25 key vs 19 surface 无对账) |

### 5.4 DEV / seed / foundation / 蓝图层(15)

| # | 位置 | 一句话 |
| --- | --- | --- |
| S-20 | 主设计 §4.1:232 vs 蓝图 §7.2:430(JSONB 列)vs §9.2:588(独立表) | extension value 三处形状互斥;统一为一种并同步双文档 |
| S-21 | 主设计 §4.1:228 vs 蓝图 §5.3 | asset 表清单不一致(`asset_content`/`asset_claim` 有无);定一版 |
| S-22 | 蓝图 §5.3:336 vs seed#`assetStorage.namespaceKeyPrefix` | asset key 布局差 `/catering-v2s/dev/` 一段,cleanup 判定必打穿;`exactSuffixDerivation` 值含多余空格且命名实为中缀 |
| S-23 | seed#`workspaceIam.assignments[*].sourceInvitation` | 6 个 `inv-completed-*` 被引用未定义(我亲验各仅 1 次命中),business predicate 不可判定、计数对不上 |
| S-24 | seed#`workspaceIam.roles`/`extensionDefinitions` | 四维授权只 seed 两维(缺 capability 列表与 visible data node),且缺 unknown-value 保留样本——"有页面无动作"核心不变量无法证伪 |
| S-25 | seed#`secretBindings`(15 binding→4 source) | 正负例账号共用口令,一处泄漏=全部 DEV 身份可登录;负例账号至少独立 source |
| S-26 | 蓝图 §12 dry-run vs `businessPassPredicates` | 无"dry-run planned count == 正式 seed 后 readback count"断言;补一条 per-stage |
| S-27 | 主设计 §10.1/U12 | L1/L2/L3 三账只有使用性提及,无定义/边界/落盘 schema——五账只有 business/cleanup 可机器判定 |
| S-28 | 主设计 §8:409 | 无并发/并行边界声明(unit 间是否可并行、unit 内可否多 agent 同 owner) |
| S-29 | 主设计 §7.3:403 | 仅 DEV 运行期 30s 日志节律,缺 unit 级进入/退出结构化汇报节律 |
| S-30 | 蓝图 §2.4:87/89 | `AdvisoryLock`/`PagedQuery` 白名单内零消费者、零绑定;指定用例或降 `NOT_CARRIED` |
| S-31 | 蓝图 §2.4 表 | 7 个 v2 foundation 类无显式 disposition,其中 `SafeLogEvent` 是白名单项的编译期依赖、`CryptoSupport` 会被密码 hash 需求推向未裁决使用 |
| S-32【Dexter】 | 主设计 §4.1:221(沿用 R3 时间戳版本号) | 迁移不从 V1 重开——若这不是预期,重开必然 drop 现有 schema(联动 M-18/M-19);保留则须显式写明理由。需 Dexter 裁 |
| S-33 | 蓝图 §1:21 vs 主设计 §8:412 | 蓝图缺"两文件同一事实冲突即停"条款;S-20/21/22 与 M-19 恰是此类,"以主设计为准"会丢掉唯一可执行细节 |
| S-34 | 蓝图 §2.4:91 | `owner proof crypto` 未写确切类名/`Ed25519`,机器 grep 零残留缺锚点 |

### 5.5 流程层(2,来自我的 fresh 复跑)

| # | 位置 | 一句话 |
| --- | --- | --- |
| S-35 | `scripts/check/implementation-design-granularity`(round-2 校验 FAIL `REVIEW_MANIFEST_HASH_DRIFT`) | 治理禁止回填旧 review,但 post-remediation 字节没有任何合法机制转绿——需给 checker 增 `postRemediationDeclaration` 类机制(声明漂移+指向 intake 文件),否则每轮修复后该门永远红 |
| S-36 | 本次 review-request(`claude-review-handoff` FAIL `MISSING_SECTION:背景`) | 交接话术缺"背景"节,未过既有门即交付;下次交付前先跑该 checker |

## 6. N 级 findings(10 项)

| # | 位置 | 一句话 |
| --- | --- | --- |
| N-01 | catalog#`candidateDispositions` | `getWorkspaceRoleCandidates` union 前字面出现 2 次,replacement 文案两处措辞不一致("internal read" vs "internal UX") |
| N-02 | Journey decision:58-131 | scenario 编号有 D02-S05/D03-S05/D04-S07 三个空洞恰与 3 组 O/P 拆分凑成 32,空洞是退役还是并入无解释,32 的稳定性无出处 |
| N-03 | catalog#`operations[*]` | 无 `contentType` 字段(multipart/binary 靠 schema 名推断);queryParameters 用自定义键 `"ref"` 非 `"$ref"` |
| N-04 | 主设计 §4.2:247 | "四维"只列三项,未含任职;补为"任职、页面准入、动作能力、可视数据节点四维互不推导" |
| N-05 | 主设计 §2.2:130 vs catalog 平台 path 带 `{groupWorkspaceKey}` | "platform URL 不带 key"未区分浏览器 route 与 wire path,agent 可能删掉平台 API 的 path 参数;分开表述 |
| N-06 | 主设计 §12:630 与 JD 全文 | C-02"由新 scenario 重新成立"缺正向 trace,JD 对 C-02 零提及;补一行引用 |
| N-07 | 主设计 §4.2 不变量清单 | G-01"集团编码/名称单独录入、不得借用/回写空间编码名称"未重述;补一条并入 U04 evidence |
| N-08 | 交互工件 §4 各 `<a id=…>` | 锚点命名与 screen id 不严格同名,机器抽链困难 |
| N-09 | 主设计 frontmatter `skillUsed: cs-spec-to-plan@local` | implementation-facing 设计应为 `cs-writing-plans`;R3 N-4 同类问题复发,建议给 skillUsed 与文档类型加一条机械对应检查 |
| N-10 | 主设计 §3.2 依赖 DAG | 缺 platform-access→session 内省类边的显式登记(各 owner 经 access 做 session 校验的依赖未入图);补边或声明经 app 层组装不入 DAG 的理由 |

## 7. 通过项(守门诚实清单——这些经机器全量对账/亲验成立,修复时不要动)

1. **32↔104 双向 crosswalk 机器零缺陷**:104 行 18 字段全存在、零空值零占位;正反向映射、reverseEquality、proofClosure、四条 crosswalkInvariants 逐条成立。本设计最扎实的部分。
2. **38/55/11 分组**与 owner 七类分布(41/33/10/10/5/3/2)实测吻合,face×owner 交叉无异常,security 与 face 自洽。
3. **105→104 账目精确**:2 项裁决不搬(均入 forbiddenSymbols+zeroReferenceClosure)、1 项新增、3 项改名各有依据;3 个"未被前端消费"端点均有显式裁决。
4. **G-07 邀请链**:新增任职无其他 API、complete 原子建全、revoke 双侧入口已设计、无 direct-add 兼容口。
5. **G-10 全量改名**:104 行 path/param `groupWorkspaceKey` 178 处零残留;foundation 侧修订面经全目录 grep 验证为完整全集(仅 2 文件 5 处),有 alias 禁令与时序门。
6. **五类首页处置完全合规**:独立 Journey 行、线框锚点、显式拒绝行(不做 dashboard)、Dexter 裁决原话入档("线框全部以v2为准,不需要我再确认了")、v2 实证吻合、三层机检设防——无降级无偷渡。
7. **禁物零正向出现**:MQ/outbox/投影/repair/轮询/Redis/TDP/RocketMQ/Ed25519 全文仅以"不搬/退役/FORBIDDEN"语境出现;投影/outbox/repair 表在三份 R5 文件全域绝迹。
8. **generated wire 主体口径正确**:按 face 从 v2s OpenAPI 重生成、x-consumer-faces 检查直击 v2 超集问题、19 条 slice 无一指向旧 3681 行文件。
9. **seed 结构主体扎实**:32 行场景前提逐行 positive+negative 且 fixtureRef 零悬空(除 S-23 的 6 条)、15 secretBindings 齐全、无默认 root、start/restart 永不 seed、三态 fixture 按 businessDate 手算自洽、reset fail-closed 意图层充分。
10. **组合 FK 模式**全表贯彻且与 R3 已落地约束兼容;单 deployable+TDP 空占位(`src` 即停)正确。
11. **幂等惯例**:43 GET 全 FORBIDDEN、61 写全 REQUIRED_16_128,GET 上零错置(修正了 R3 的实证违规)。
12. **盲审治理**:两轮独立子 agent 均合规,round-2 intake 七项 CONFIRMED 的修复我抽验(crosswalk 32 行、forbidden symbols、entityType selector、15 bindings、allowlist、固定 clock)均真实存在——问题是这些修复本身又引入了 M-18/M-21 类新互斥,而治理无第三轮,这正是本次 Claude review 的职责所在。

## 8. UI 与交互强制自问

- **操作是否来自批准 Journey**:是——32 场景均锚定已接受的 Journey/interaction 工件;五首页有显式拒绝行防扩权。
- **用户此时这样操作是否合逻辑 / 有无更短路径**:交互层已由 Dexter 看图裁决("线框全部以v2为准"),本轮不重开;但 S-12 暴露一处交互工件与契约互斥(角色页面准入/动作能力分开提交 vs 单命令全量替换),该处哪种更短更自然未裁决,已列 Dexter 裁决点。
- **不合理之处来源**:M-12(路由缺 key)来自登记疏漏;M-16(文案断言缺失)来自交互工件到机检工件的传导断裂;S-12 来自旧接口形状(v2 单命令)与新交互裁决的冲突——属"从现有接口反推用户任务"的典型风险,故不得默认沿用 v2 形状。
- **foundation 优先**:形式满足(19 条逐 surface 声明)、实质有缺(M-11/M-14/M-15);App-local 能力(双 App wrapper)已识别为薄适配层应保留并补正向断言。
- `NOT_APPLICABLE` 项:无——本轮含 UI 范围。

## 9. 章节命中对照(manifest Part B / C / D)

| 条款组 | 命中 finding | 设计落点 |
| --- | --- | --- |
| B.1 安全/session | M-21(clock)、M-22(OTP 旁路)、S-02(pre-auth 幂等)、S-24(四维 seed 缺两维) | 主设计 §5、U03/U06/U09;auth 合取式本身 PASS(通过项 4) |
| B.2 数据/事务 | M-18(reset 互斥)、M-19(R3 表形状)、S-13(UNIQUE 缺失)、S-20/S-21(表形状互斥)、S-32(V1 裁决) | §3–§4、U02/U04–U07 |
| B.3 后端结构/错误分层 | M-01/M-02/M-03(错误码与 Problem)、M-20(foundation wire 泄漏)、S-30/S-31(白名单) | §3、§2.2、蓝图 §2.4 |
| B.4 前端架构/状态 | M-14/M-15(幂等 wrapper)、M-17(catalog 生成物)、S-07(双并发字段与 cache 语义)、S-18(affected-L2) | §6.1/§6.3、U08–U10 |
| B.5 UI/信息架构 | M-08~M-13、M-16、S-15~S-17、S-19;五首页 PASS | 已接受 interaction + §6.2 + manifest |
| B.6 性能/预算 | S-20(JSONB vs join 影响 §10.2 预算结论) | §10.2;其余无新增运行时语义,`NOT_APPLICABLE` |
| Part C 规范性条款(generated→adapter→application→domain;owner command/readback;typed Problem;RTK Query;Drawer lifecycle) | typed Problem 被 M-02/M-03 击穿;Drawer lifecycle 被 M-14/M-15 击穿;generated 链被 M-05(codegen 硬编码)阻断;owner command/readback PASS(通过项 9) | §2/§3.2/§6 |
| Part D(五命令分权/受管运行/日志/DEV) | M-18(reset)、M-21(clock 落点)、M-22(OTP 门禁)、M-23(命令与伪修复)、S-22/S-25/S-26(asset key/secret/dry-run)、S-27(五账)、S-29(节律) | §7、蓝图 §12–§13、seed 契约 |

十维度逐章 sweep 已执行(主设计 §0–§12、蓝图 §1–§13、catalog 全字段、seed 全节、manifest 全节),无采样跳章。

## 10. 需 Dexter 裁决点(仅 5 项,其余全部 Codex 自主修复)

1. **M-21③ 业务日历时区**:seed 单方面绑 `Asia/Seoul`,与中国购物中心语料不符——业务日历时区(与三态跨日判定)是产品事实,需你定一个值。
2. **S-12 角色配置提交形态**:分开提交(补 2 个 operation,104 分母变 106)vs 单命令双组独立字段(修订已接受交互工件措辞)。我倾向后者(不动分母、服务端仍分别校验互不推导),但触及已接受工件,由你裁。
3. **S-10 分期 phase_key**:降回名称数组(我推荐,忠实 G-04)或接受轻主数据化。
4. **S-14 候选集是否过滤 DISABLED 门店**:G-08 明写"停用还阻断哪些新操作逐项待裁决",这是第一个具体案例。
5. **S-32 迁移是否从 V1 重开**:保留 R3 时间戳(联动 M-19 逐列决议)或重开(联动 drop 现有 schema)。

## 11. 授权边界

本 NO-GO 针对 DESIGN 整体;23 M 全部为设计层可闭合项,修复后按治理走 post-remediation 交付(不回填两轮盲审,S-35 的机制缺口宜一并补)。本评审不授权 R5 implementation、任何 app/contract/database/Flyway/test/业务源码改动、DEV、远端连接、seed/reset 或动态运行;即便后续转 GO,implementation 授权仍由 Dexter 另行记录。findings 处置按 CLAUDE.md:除 §10 五项外均交 Codex 在既有批准边界内自主修复,不构成再授权门槛。






