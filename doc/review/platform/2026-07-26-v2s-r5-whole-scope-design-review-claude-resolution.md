---
title: R5 全范围详设 Claude NO-GO finding intake 与修订闭环
status: CLOSED_BY_DEXTER_FINAL_DISPOSITION
createdAt: 2026-07-26
reviewCycleId: R5-W3-DESIGN-20260725
reviewTarget: DESIGN
sourceReview: doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-review-claude.md
sourceVerdict: NO-GO(23 M / 36 S / 10 N)
implementationAuthority: false
---

# R5 全范围详设 Claude finding intake 与修订闭环

## 1. Intake 方法与边界

Codex 将 Claude finding 视为待验证输入，逐项重开其 owning design、Heritage source、
business corpus、现有工具源码与冻结标准。每项均比较“只改散文”的更小方案与“让开发
agent 得到唯一可执行形状”的方案；凡散文不能闭合字段、路径或运行前提的，选择最小的
机器可读目录/表格补充，不扩大 R5 业务范围。五项产品事实由 Dexter 授权 Codex 裁决，
统一落在：

`doc/decisions/2026-07-26-v2s-r5-claude-review-five-point-resolution.md`

本文件只记录 DESIGN 修订。它不重开第三轮对抗审查，不把历史 NO-GO 改写成 GO，也不
产生 contract、app、数据库、测试、DEV、seed/reset 或任何 implementation authority。

## 2. M 级逐项处置

| finding | intake | owning 修订与 closure |
| --- | --- | --- |
| M-01 | `CONFIRMED` | contract catalog 将跨域通用码收敛为显式 `PLATFORM_COMMON_*` 闭集；不采用散文豁免。 |
| M-02 | `CONFIRMED` | 新增 83 个 Heritage 码 + 6 个 R3 码逐项 disposition 的 error catalog；operation error set、R3 兼容码与文案消费显式承接。 |
| M-03 | `CONFIRMED` | contract catalog hash-lock 18 个真实 schema source，并补 `Problem`、`EpochMillis` 与 component 字段 override；不再把裸 `ref` 叫字段分母。 |
| M-04 | `CONFIRMED` | 新增 edge file-placement catalog，按 face/capability 与 owner/family 唯一解析 104 operations 和 components。 |
| M-05 | `CONFIRMED` | 主设计 U01 精确点名 `tools/verify-gates/cli.mjs` 与 `scripts/generate/edge-codegen.mjs` 的多 face、外部 `$ref`、bundle 输入改造；只更新既有分母工具，不新增语义门。 |
| M-06 | `CONFIRMED` | `OrganizationStore.contractDerivedStatus` 成为只读必填三态枚举，进入 component override 与主设计 wire 表。 |
| M-07 | `CONFIRMED` | 合同字段统一为 `effectiveFrom/effectiveTo`、`format: date`，排序键为 `EFFECTIVE_FROM`，旧名进入 forbidden properties。 |
| M-08 | `CONFIRMED` | frontend manifest 分母改为 22 surfaces；冻结 180 个文件，其中 133 handwritten runtime、2 generated wire、45 tests，并给出归属策略。 |
| M-09 | `CONFIRMED` | 两条错误 `CARRY` 均改为 `ADAPT`；当前 surface 无裸 `CARRY`。 |
| M-10 | `CONFIRMED` | 7 类退役资产逐项 `NOT_CARRIED`，均含 source path/hash/reason/replacedBy。 |
| M-11 | `CONFIRMED` | 22 surface 全部拆为 `v2Consumed` 与 `r5Required`，按 source import 重算；新增能力不再伪称 Heritage 已消费。 |
| M-12 | `CONFIRMED` | operations browser route 全带 `:groupWorkspaceKey`；浏览器 route 与 API path 独立声明。 |
| M-13 | `CONFIRMED` | 五类首页 source 改为 Seed/router/pageRegistry/approvedPageDesignKeys 四文件 hash 集，不再伪指单文件。 |
| M-14 | `CONFIRMED` | operations Drawer wrapper 必须注入 idempotency 与 diagnostic logger，manifest、主设计和蓝图三处同源。 |
| M-15 | `CONFIRMED` | required check 改为禁止 wrapper reimplementation，显式允许纯参数注入薄壳，并正向断言两个注入项。 |
| M-16 | `CONFIRMED` | 每个 surface 补 required/forbidden text assertions，并要求 L2 正向词与禁用词验证。 |
| M-17 | `CONFIRMED` | generated admin/presentation/problem catalogs 定义为 v2s 生成物；Heritage 生成物列入 `NOT_CARRIED`。 |
| M-18 | `DEXTER_DECISION`，已解决 | 采用“一 namespace 一 database、七个固定 owner schema、public 单 Flyway history”；reset 精确销毁目标 database，禁止跨 namespace 共库。 |
| M-19 | `CONFIRMED` | 主设计与蓝图加入 R3→R5 additive 列级迁移表：新 UUID/version/epoch 列、回填/readback、旧列过渡保留、长度收窄后置。 |
| M-20 | `CONFIRMED` | foundation 只保留 Problem 骨架与 correlation 注入；generated error→HTTP 映射归 business app advice。 |
| M-21 | `DEXTER_DECISION`，已解决 | 业务时区定为 `Asia/Shanghai`；新增 `TimeProvider`/`BusinessDateProvider` 与 DEV-only fixed clock 三条件 fail-closed。 |
| M-22 | `CONFIRMED` | 固定 OTP 登记为 `DEV_FIXED_OTP_ISSUER`，仅 namespace 匹配 + `r5-full` + non-production marker 三条件同时成立时装配。 |
| M-23 | `CONFIRMED` | 蓝图 §13 给出逐 unit 可执行命令/输出/失败即停；§14 明禁改断言、禁用测试、stub owner、篡改 gate 分母和伪造 evidence。 |

## 3. S 级逐项处置

| finding | intake | owning 修订与 closure |
| --- | --- | --- |
| S-01 | `CONFIRMED` | catalog 新增 machine-readable `renamedOperations` 与 `105−2+1=104` 算术闭包。 |
| S-02 | `CONFIRMED` | 12 个 pre-auth endpoint 逐项登记幂等策略；credential/OTP 请求不以 receipt 回放敏感结果。 |
| S-03 | `CONFIRMED` | public asset content 同时 trace D01-S01、D01-S02、D04-S08，覆盖 platform 与 operations/public 消费。 |
| S-04 | `CONFIRMED` | U01 将 R3 required GET idempotency、`code`、缺 correlationId 列为具名校正输入。 |
| S-05 | `CONFIRMED` | 140 components 分成 138 direct refs 与 2 supporting-only，零引用 closure 可重算。 |
| S-06 | `CONFIRMED` | `StoreContract*` 逐 schema 声明 `items: array<StoreContractItem>`、required、`minItems:1`。 |
| S-07 | `CONFIRMED` | command 只用 `expectedVersion`；旧 revision/context version 被禁，context version 只留 query/cache。 |
| S-08 | `CONFIRMED` | organization wire 统一 `ServiceNodeType`，不再把 head company/store 塞入组织树枚举。 |
| S-09 | `CONFIRMED` | 删除无 owning fact 的 `OrganizationStore.source` 与 `EXTERNAL_SYNC`。 |
| S-10 | `DEXTER_DECISION`，已解决 | project phase 降为有序唯一名称集合；合同只存 `phaseNameSnapshot`，无 `phase_key`。 |
| S-11 | `CONFIRMED` | store 的 head-company 关联 nullable，仅提供时校验品牌授权。 |
| S-12 | `DEXTER_DECISION`，已解决 | 保持 104 分母：一个 authorization command，`pageAccessKeys`/`actionCapabilityKeys` 独立校验并原子替换；Journey/interaction 同步。 |
| S-13 | `CONFIRMED` | DB 设计加入具名 `UNIQUE(contract_id,item_code)`。 |
| S-14 | `DEXTER_DECISION`，已解决 | invitation candidate 排除停用门店；contract candidate 不过滤，返回状态供用户判断。 |
| S-15 | `CONFIRMED` | frontend closure 拆 platform、operations shell/business/public、auth 与 home bootstrap 计数。 |
| S-16 | `CONFIRMED` | foundation adaptation 逐符号登记，含 `ContextScopedQueryResult` 条件类型。 |
| S-17 | `CONFIRMED` | platform auth 的新 foundation 消费升为具名 ADAPT，不声称 v2 已使用。 |
| S-18 | `CONFIRMED` | affected-L2 registry 改为 22 个 per-surface 精确行，另保留 shared/backend/edge。 |
| S-19 | `CONFIRMED` | 25 pageDesignKeys 与 22 surfaces 建双向表，7 个非 catalog surfaces 单列，双向零缺口。 |
| S-20 | `CONFIRMED` | extension value 统一为 owner-local 独立关系表；不使用 JSONB。 |
| S-21 | `CONFIRMED` | asset 统一为 metadata/usage 形状；不存在 `asset_content`/`asset_claim`。 |
| S-22 | `CONFIRMED` | asset key 精确为 `/catering-v2s/dev/<namespace>/...`，seed 与蓝图同字节规则。 |
| S-23 | `CONFIRMED` | 补齐 6 个 completed invitations，assignment 引用零悬空。 |
| S-24 | `CONFIRMED` | seed 覆盖任职、页面、动作、可视节点四维，并补 unknown extension value 负例。 |
| S-25 | `CONFIRMED` | 正负例 identity 使用独立 secret source，避免一处泄漏覆盖全部 DEV 身份。 |
| S-26 | `CONFIRMED` | 每 seed stage 都要求 dry-run planned count 等于正式执行后的 owner readback count。 |
| S-27 | `CONFIRMED` | L1/L2/L3/business/cleanup 五账均给出边界、字段与落盘 schema。 |
| S-28 | `CONFIRMED` | 12 unit 严格串行；同 owner/shared-write 不并行，仅读取分析可并行。 |
| S-29 | `CONFIRMED` | unit 进入、材料完成、失败、退出均要求结构化进度；动态运行仍按 30 秒规则。 |
| S-30 | `CONFIRMED` | `AdvisoryLock` 降为 `NOT_CARRIED`；`PagedQuery` 绑定明确分页 query 用例。 |
| S-31 | `CONFIRMED` | v2 foundation 全类逐项 CARRY_ADAPT/NOT_CARRIED；`SafeLogEvent` 依赖与 crypto 归属明确。 |
| S-32 | `DEXTER_DECISION`，已解决 | Flyway 不从 V1 重开；沿 R3 单 history 追加迁移，保留生产演进语义。 |
| S-33 | `CONFIRMED` | 蓝图加入两份设计事实冲突时 fail-stop，禁止 agent 自选其一。 |
| S-34 | `CONFIRMED` | 明确 `OwnerCommandAuthorizationProofCanonicalizer`、`OwnerCommandAuthorizationProofTransport`（Ed25519 owner proof）的确切 disposition；R5 不搬 owner proof crypto。 |
| S-35 | `CONFIRMED` | 新增 `POST_REMEDIATION_V1` 声明机制、checker 机械校验及真实红夹具；不改旧 review hash、不做语义判定。 |
| S-36 | `CONFIRMED` | review request 增加独立 `## 背景`，交付前以 handoff checker fresh 验证。 |

## 4. N 级逐项处置

| finding | intake | owning 修订与 closure |
| --- | --- | --- |
| N-01 | `CONFIRMED` | candidate disposition 去重并统一为 internal UX query/read 语义。 |
| N-02 | `CONFIRMED` | Journey 解释 D02-S05、D03-S05、D04-S07 为退役编号洞，不参与 32 分母。 |
| N-03 | `CONFIRMED` | content type 由 placement catalog 精确解析；设计目录保留符号 `ref`，U01 发射 OpenAPI 时必须转换为真实 `$ref`，禁止把符号编码原样写入正式 contract。 |
| N-04 | `CONFIRMED` | 四维明确为任职、页面准入、动作能力、可视数据节点，互不推导。 |
| N-05 | `CONFIRMED` | platform browser route 与带 workspace key 的 API path 分开表述。 |
| N-06 | `CONFIRMED` | Journey 增 D04-S08 对 C-02 业务意图的正向 trace；旧 PENDING_RECOVERY 文件仍不复用。 |
| N-07 | `CONFIRMED` | G-01 独立 commercial group code/name 进入主设计不变量与 U04 evidence。 |
| N-08 | `CONFIRMED` | 交互工件每个 `<a id>` 与 screen id 严格同名；共享线框使用多个同名 alias，不再使用模糊 group anchor。 |
| N-09 | `PARTIALLY_CONFIRMED` | 主设计改为 `cs-writing-plans@local`，本轮 remediation 另记 `cs-spec-to-plan@local`。不新增一条仅防元数据措辞的门，避免违反“门只管一行机械且控制门数量”的既有裁决。 |
| N-10 | `CONFIRMED` | 依赖图补 platform access/session introspection 在 app layer 的组装边，owner 模块仍不反向依赖 app。 |

## 5. 未扩大范围与更小替代

- 未改变已验证的 `32 ↔ 104`、`38/55/11`、owner 分布或五类首页边界。
- 契约修复采用“baseline + 明示 override + 精确 placement”，未复制 104 份 schema，也未恢复
  v2 的废弃端点。
- `POST_REMEDIATION_V1` 只校验声明字段、路径和 hash 存在性；Claude 仍负责当前字节的语义
  复核，checker 不裁决 reviewer 独立性或修复质量。
- R5 仍未获得 implementation authorization；所有 implementation-facing path 都只是未来
  unit 的约束。

## 6. Recheck 期望

Claude 应以当前字节重新核对上述 69 项，输出 `GO` 或 `NO-GO` 与 `M/S/N` 计数。若仍有
finding，必须给 owning path/anchor、可复现反例和最小修复；不得要求第三轮 Codex
adversarial review，也不得把 DESIGN 复核解释为 implementation authorization。

## 7. Claude Part R（2 M / 9 S / 12 N）intake

Part R 仍是同一 DESIGN target 的外部复核，不重置两轮上限。23 项均经 owning source
复核为 `CONFIRMED`；更小的“只补评审说明”不能消除实施 agent 会读到的矛盾，因此只修改
既有机器可读目录、主设计/蓝图和 seed，不改变 `32/104/22/180` 分母。

| finding | intake | owning 修订 |
| --- | --- | --- |
| R-M1 | `CONFIRMED` | 84 个 Heritage/R3 active target 全部接入 operation closed set；两个 pre-auth set 补幂等冲突；22 个 v2s-native 码进入唯一登记；R3 init 采用 replace-base 规则禁同义新码。 |
| R-M2 | `CONFIRMED` | 删除 22 surface 的 `foundationPrimitives` shadow 列；`foundationConsumptionBySurface` 成为唯一真相并增加零 shadow check。 |
| R-S1 | `CONFIRMED` | placement catalog 增 13 项 family→owner、3 个 enum exact placement 与 component closure。 |
| R-S2 | `CONFIRMED` | 两个 select command request 删除 `expectedContextVersion`，明确 `requiredContextVersion:int64`；query/cache 的 expected context 语义不受影响。 |
| R-S3 | `CONFIRMED` | 三个经营主体列表移除 `source` query；Brand/Tenant/HeadCompany 移除 source，`BusinessEntitySource` 显式 NOT_CARRIED。 |
| R-S4 | `CONFIRMED` | `StoreContractStoreCandidate.storeStatus` 为只读 `ENABLED/DISABLED`，停用不筛选、不阻断。 |
| R-S5 | `CONFIRMED` | 两个密码 Drawer 的 `v2Consumed/r5Required` 均补 `adminDrawerSurfaceProps`。 |
| R-S6 | `CONFIRMED` | browser route 显式登记 `organization/store-contracts → /operations/:groupWorkspaceKey/contracts`，pageDesignKey 保持。 |
| R-S7 | `CONFIRMED` | store 与 store profile 禁用词补“已停业”。 |
| R-S8 | `CONFIRMED` | R3 四个 platform-face FORCE RLS policy 由 additive migration 校验后 drop/disable；授权唯一来源仍是 execution context + owner + task query predicate。 |
| R-S9 | `CONFIRMED` | 两份设计统一 `workspace_uuid + group_workspace_key`，并明确具名复合 unique/FK。 |
| R-N1 | `CONFIRMED` | `initializeCommercialGroup` 以 R3 六码替换 base set，列出六个禁用的同义新码。 |
| R-N2 | `CONFIRMED` | error disposition catalog 新增 22 个 `ACTIVE_V2S_NATIVE` 条目，active registry 共 106 码。 |
| R-N3 | `CONFIRMED` | 修正本 resolution：pre-auth 为 12；目录 `ref` 是发射前符号编码，正式 OpenAPI 才是 `$ref`。 |
| R-N4 | `CONFIRMED` | 修正本 resolution 的真实 Ed25519 相关类名。 |
| R-N5 | `CONFIRMED` | `contract-current-a` 增 `phaseNameSnapshot=一期`，覆盖快照正向路径。 |
| R-N6 | `CONFIRMED` | operations contracts 文案禁用“分期编码”。 |
| R-N7 | `CONFIRMED` | seed 对 D03-S01/S02 的 disabled store 分别声明“可见但不筛选/阻断”语义。 |
| R-N8 | `CONFIRMED` | seed 改用 `BC-IAM-*-ROLE-REVOKE/INVITE`；34 个 action key 与 page key 分别绑定 owning catalog。 |
| R-N9 | `CONFIRMED` | 6 个 Heritage generated catalog 逐文件登记 hash。 |
| R-N10 | `CONFIRMED` | 两 app 的 vite/playwright 4 个配置文件作为 src-180 外独立 scaffold inventory 登记 hash/disposition。 |
| R-N11 | `CONFIRMED` | `useOverlayLock → overlayLock` 只保留一条规范化映射，v2Consumed/r5Required 使用同一词表。 |
| R-N12 | `CONFIRMED` | reset fail-closed 改为校验 resolved asset key 是否位于精确 namespace prefix。 |

Part R 修订后 Claude 应复算 error reachability、component placement、frontend 单列、RLS
disposition、seed catalog refs 与所有绑定 hash，并给出终验 `GO` 或剩余 `NO-GO(M/S/N)`。

## 8. Claude Part R2（0 M / 2 S / 4 N）最终处置

Claude Part R2 已确认 Part R 的 23 项全部 `CLOSED`、零回退。Dexter 裁决保留
`getPlatformOrganizationOverviewPage.source`，并明确 Codex 关闭本表六项后直接转
DESIGN `GO`，不再发起复核。最终 owning decision 为：

`doc/decisions/2026-07-26-v2s-r5-whole-scope-design-final-acceptance.md`

| finding | intake | owning 修订 |
| --- | --- | --- |
| R2-S1 | `DEXTER_DECISION` | 保留 overview `source`；catalog 明确它是只读 `MANUAL/SYSTEM` 维护来源维度，与已删除的 `BusinessEntitySource MANUAL/EXTERNAL_SYNC` 独立，当前无 SYSTEM producer 时允许空结果。 |
| R2-S2 | `CONFIRMED` | crosswalk 将 canonical pageKey 与 per-step consumer pageKey 分开，并登记 `getPublicAssetContent` 的 D01-S01/D01-S02/D04-S08 三页复用闭集。 |
| R2-N1 | `CONFIRMED` | `COMMERCIAL_GROUP_ALREADY_INITIALIZED` 仅保留在 `r3CompatibilityCodes`，跨 registry 重复归零。 |
| R2-N2 | `CONFIRMED` | error closure 显式拆成 `heritageR3ActiveTargetCount=84`、`v2sNativeActiveTargetCount=22`、`totalActiveTargetCount=106`。 |
| R2-N3 | `CONFIRMED` | contract catalog 与 placement catalog 均要求 `StoreContractCandidatePage.stores.items → StoreContractStoreCandidate` 的 U01 生成报告 readback。 |
| R2-N4 | `CONFIRMED` | Journey 与 interaction 均引用 D-07，并声明业务日边界固定为 `Asia/Shanghai`。 |

更小替代评估：删除 overview `source` 会违背 Dexter 的保留裁决并丢失 v2 已实现筛选；把旧
external-sync source 原样搬回会恢复已拒绝语义；新增 runtime source owner 又会过度设计。
因此采用只读 provenance 分类、无 active SYSTEM producer 时允许空结果，是当前阶段最小且
不扩范围的方案。

```text
FINAL_DESIGN_VERDICT=GO
M=0
S=0
N=0
R5_IMPLEMENTATION_AUTHORIZED=false
```
