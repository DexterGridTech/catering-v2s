---
title: catering-v2s 跨代业务语料库草稿 Claude 独立评审
type: review
status: DELIVERED
reviewTarget: doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md
reviewTargetSha256: abd4e16c2cc2a31fe1c4b42c75d35d5daf764335f7d17e20385a41f7c3ae07d0
reviewer: Claude
createdAt: 2026-07-24
---

# catering-v2s 跨代业务语料库草稿 Claude 独立评审

## 结论

```text
VERDICT=NO-GO
M=0  S=1  N=4
```

草稿的词条模板、领域边界与冲突纪律质量很高,四处正式文档漂移全部经我按原文行号证实、处置方向正确;**唯一的 S 是:草稿的 all-v2 证据停在 2026-07-14/15 的 Atlas/Journey 基线层,漏掉了同仓更新的现行裁决层**(2026-07-21 术语裁决等),而受影响的恰是 §4 的 IAM"高置信词条"。若按现稿交 Dexter,会请他用**已被自己裁决推翻的旧界面用语**做产品裁决。修订是分钟级(补台账+加注),修完即可转 `GO_FOR_DEXTER_REVIEW`,我可即时复审。

## 评审出处与独立性

fresh v2s-rooted Claude 会话。我在读本草稿前已从四仓独立盲写了自己的语料库草稿(`2026-07-24-v2s-business-glossary-independent-draft-claude.md`),本评审以该独立基准+Heritage 原文回读为据,不以草稿自证为据。草稿哈希与 §9 全部 33 条 ledger 哈希已逐一复算精确一致。所有行号引用均为我本会话在原文中亲验。

## 方案合理性(先于闭环)

1. **问题对不对**:对。R3 暂停的根因是 AI 无来源臆想业务("按 workspaceKey 查登记状态"),草稿把"先统一业务语言再设计"作为恢复条件,并显式保持 R3-J01 无效、设推广门(§10)——正中要害。
2. **方案优不优**:词条模板(§3.1)比单纯名词表优:存在目的/用户任务/界面语言/反例/不可推导五个字段直接瞄准臆想高发点;关系/动作/状态/角色四类独立词条(§3.2)是对的补充。相比更轻方案(只做名词中英对照)能真正约束 Journey/UI/contract;相比更重方案(先写完 22 域全部第二层)分层交付合理。
3. **代价配不配**:第一层先交 Dexter 对齐、第二层按域补齐,匹配当前阶段。配。

## Findings

### S-1:all-v2 现行裁决层缺席,§4 IAM 词条与 Dexter 已作裁决相抵触(需修订后再交 Dexter)

- **证据(全部亲验)**:
  - 草稿 §9(行 393–427)的 all-v2 来源仅三件:07-14 Atlas、07-15 journey-design README、d01-s05。**不含**:`catering-all-v2/project-memory/decisions/four-domain-user-journey-actor-access-and-q01-q12-rulings.md`(其行 93–97 为 2026-07-21 术语裁决:用户文案必须用"当前运营角色/角色切换器/可视数据节点/数据节点切换器",旧词"当前身份""查看范围"仅限历史语境;技术 wire 为 `roleAssignmentRef`/`selectedDataNode`)、`business-user-facing-language-standard.md`(行 30 确认该裁决为已裁定例外)、`doc/specs/platform/modules/`(现行模块规范,如 `workspace-role-administration.md` 行 15/29/41:WorkspaceRole=唯一 organizationType+去重 `capabilityKeys JSONB`,**禁止重建 role-capability join table**)。
  - 已入账的 07-15 README 行 36/176 恰把"当前身份、查看范围"定为界面用语;07-14 Atlas 行 116 甚至禁止界面出现"可视数据节点"。即:**草稿采信的层与最新裁决层方向相反**。
- **受影响条目(草稿行号)**:§4"运营用户"(行 327,把 `WorkspaceUser` 标为"历史名",而 all-v2 现行 spec 以 WorkspaceUser/空间账号为活跃词)、"任职"(行 328)、"角色分配"(行 329,`UserNodeRoleAssignment` 是 v6 模型,all-v2 现行为 RoleAssignment+WorkspaceRole JSONB)、"当前工作上下文"(行 330,未登记 07-21 用户语言裁决);§6"运营账号模型"(行 357)、"角色变化"(行 358,"角色变化走邀请"实为 q01-q12 已裁决项,现稿让 Dexter 重新裁决)、"Region 层级"(行 359,漏 all-v2 `organization-hierarchy.md` 现行"层级固定为商业集团→大区→项目"这一最新证据层);§7 问题 6/7(行 375–376)因此部分是"已裁决待确认",不是开放裁决。
- **影响面**:语料库的"界面语言"字段将驱动未来全部 UI 文案;按现稿冻结会把已废止的用户语言重新固化,或迫使 Dexter 重复裁决/自相矛盾。
- **最小修订**:①§9 增补上述三类 all-v2 现行来源(带 hash);②§4 受影响四行加"最新层:2026-07-21 裁决"注记,`WorkspaceUser` 改标"all-v2 现行活跃词,与 v6 Account/Principal 语言的关系待裁决";③§6 增行"07-15 界面语言基线 vs 07-21 术语裁决"(处置:除非 Dexter 撤销,以 07-21 为准)与"UserNodeRoleAssignment(v6) vs WorkspaceRole capabilityKeys(all-v2 现行)";④"角色变化"行改注"Q01 已裁决,仅请 Dexter 确认沿用"。
- **是否需 Dexter 裁决**:登记本身不需要;07-21 裁决是否沿用由 Dexter 一句话确认。

### N-1:§4 部分证据引用不能在 §9 台账内解析(行 316–331)

"all-v2 D04-S08/D04-S11/D04-S09""v4/v1 组织设计""v4/v1 双后台设计"等引用无对应 ledger 行(台账仅 5 件 v4/v1 文件、3 件 all-v2 文件)。**最小修订**:被 §4 引用的每个来源补入 §9,或在该行改引已入账文件。不需 Dexter。

### N-2:"旧资料常写 workspaceKey"措辞颠倒代际(行 317)

`workspaceKey` 恰是**最新**一代(all-v2 现行契约)的写法,`groupWorkspaceKey` 是 v6/v4/v1 系谱。称其"旧资料"会在框架上预置偏向,削弱 §7-2 留给 Dexter 的中立裁决。**最小修订**:改为"v6/v4/v1 作 groupWorkspaceKey;all-v2 现行契约作 workspaceKey;最终命名待裁决"。

### N-3:漏收的禁用词/易混淆项(建议并入下一层)

我的独立采集中有、草稿未收:①"目录"三义(`SalesSection` 菜单分区 / `CatalogCategory` 商品分类 / `ProductCatalog` 商品目录容器——05/06 域仅各覆盖其一);②`menu_release`(v6 术语表废词);③v4 渠道旧值 `PLATFORM_TAKEOUT`/`OTHER`(仅迁移语境,v4 registry 与 DB check 约束还不一致);④all-v1 裁决"从不存在'首邀/bootstrap 管理员'业务概念";⑤"商户"(指租户)、"客户"(指后台用户)两个口语禁用词(草稿 Tenant 行 322 已含"商户","客户"未收)。不需 Dexter。

### N-4:四处 source drift 建议补精确行号,便于回修 v6(行 364–366)

我已亲验:03 域行 673("旧 HeadCompany/Tenant 只作为历史迁移语义")、16 域行 196/778/1295(`DeliveryTask`/`ExternalFulfillmentActionGateSnapshot`)对 13 域行 1104(删除清单)、19 域行 1080(`PickupCallSnapshot`)、17 域行 1265 对 22 域行 13/621(`ScanEntryDefinition` V6.23 废止)。草稿处置(登记不选边)正确;把行号写进 §6 可让文档维护者分钟级定位。不需 Dexter。

## 按要求格式的逐项判定

```text
TERM=集团空间 / GroupWorkspace(§3.3 完整词条,行 111–136;§4 行 316)
STATUS=CONFIRMED
EVIDENCE=v6 01-平台运行与隔离域 §4.1;all-v2 platform-workspace-lifecycle("集团空间不是商业集团");v4 V001 org_group_workspace;v1 group-workspace.contract
FINDING=隔离/入口语义、创建与集团初始化分离、不可推导清单、反例均与原文一致;"待裁决"两项留白正确
MINIMAL_CHANGE=NONE
DO_NOT_INFER=不得由空间存在推导组织/账号/角色/门店;不得由空间名称/编码推导商业集团资料

TERM=集团空间编码(groupWorkspaceKey / workspaceKey)(§4 行 317)
STATUS=PARTIALLY_CONFIRMED
EVIDENCE=v6 术语表(groupWorkspaceKey 双重语义);all-v2 现行契约 workspaceKey path 参数;v1 /{groupWorkspaceKey}/console
FINDING=双重语义与"URL 只定位不授权"正确;"旧资料常写 workspaceKey"代际颠倒(N-2)
MINIMAL_CHANGE=按 N-2 改措辞;命名裁决继续归 Dexter
DO_NOT_INFER=不得由 URL 中的 key 推导任何授权事实

TERM=商业集团 / CommercialGroup 及组织主干(§4 行 318–321)
STATUS=CONFIRMED
EVIDENCE=v6 02 域 §4.1–4.3;all-v2 commercial-group-root("必须单独输入集团编码和集团名称")、d01-s05;v1 "at most one commercial group"
FINDING=创建/初始化分离、编码不得复制、大区/项目/门店定位均与原文一致
MINIMAL_CHANGE=Region 行的层级冲突见 CONFLICT 块
DO_NOT_INFER=不得由初始化集团推导角色/账号/门店的自动创建

TERM=实际经营租户 / 总公司 / 品牌 三分与授权(§4 行 322–325)
STATUS=CONFIRMED
EVIDENCE=v6 术语表 §4、02 域 §4.5–4.8;v4 tenant-head-company-split(验收禁止 TenantCompany/companyType 残留);all-v2 business-entity-management(三独立实体、授权为关系表)
FINDING=拆分、可见性只经 Store.headCompanyRef、授权非范围推导器,全部正确;03 域"历史迁移语义"残留已被正确登记为文档漂移而非模型变更
MINIMAL_CHANGE=NONE
DO_NOT_INFER=不得由品牌授权推导总公司可见同品牌全部门店;不得把 Tenant 当隔离租户

TERM=门店 / Store(§4 行 321)
STATUS=CONFIRMED
EVIDENCE=v6 02 域 §4.11(换经营者必须新建);all-v2 store-management(项目+租户+品牌锁定;ENABLED/DISABLED 非营业状态);v4 store_registry
FINDING=与原文一致;状态轴分歧已正确进 §6
MINIMAL_CHANGE=NONE
DO_NOT_INFER=不得由主数据启停推导营业/经营资格/合同有效性

TERM=运营用户 / 任职 / 角色分配 / 当前工作上下文(§4 行 327–330)
STATUS=PARTIALLY_CONFIRMED
EVIDENCE=v6 04 域 §4.1–4.8;all-v2 q01-q12 rulings 行 93–97(2026-07-21);all-v2 workspace-role-administration 行 15/29
FINDING=概念分离正确;但缺 2026-07-21 术语裁决层与 WorkspaceRole capabilityKeys 现行模型,详见 S-1
MINIMAL_CHANGE=按 S-1 ①–④修订
DO_NOT_INFER=不得由 v6 的 UserNodeRoleAssignment 推导 v2s 需要 role-capability join table(all-v2 已裁决 JSONB bundle);不得由登录成功推导任何业务权限

TERM=05–07 商品/菜单/库存边界(§3.5 行 192–208)
STATUS=CONFIRMED
EVIDENCE=v6 05 域(行 207 INACTIVE 语义、行 674 状态分离)、06 域(发布≠送达)、07 域(账本为真相)
FINDING=SELLABLE≠可售、发布≠ACK、库存提示须经 06 域转可售控制,均与原文一致;禁用词正确
MINIMAL_CHANGE=补 N-3 之"目录"三义与 menu_release
DO_NOT_INFER=不得由商品可售能力推导已上架;不得由库存提示直接改菜单/订单

TERM=11–14 交易链与 15–22 接入/终端/现场边界(§3.5 行 229–310)
STATUS=CONFIRMED
EVIDENCE=v6 11 域(主/子/行、冻结)、12 域(行为不可改、反向事实)、13 域行 228/1100–1104(动作线主链)、14 域(只解释不打款)、15 域(绑定为最小渠道粒度)、16 域(raw≠内部事实)、17 域(ACK 仅游标;scope 七类)、18 域(终端≠外设)、21 域(规则不绑设备)、22 域行 13/621(扫码码新口径)
FINDING=各域"对象与目的/关键边界/状态与禁用"三段与原文一致,未发现从实现反推业务;漂移登记诚实
MINIMAL_CHANGE=按 N-4 补行号
DO_NOT_INFER=不得由 TDP ACK/KDS ACK/外部已接单推导履约完成;不得由治理/分析改写源事实

CONFLICT=§6 Region 层级(行 359)
STATUS=PARTIALLY_CONFIRMED
EVIDENCE=v6 02 域 §4.2(支持多级);v1 域地图(单级);all-v2 organization-hierarchy("层级固定为商业集团→大区→项目",未入账
FINDING=冲突真实,但缺最新证据层;补全后 Dexter 的裁决对象是"是否沿用 all-v2 固定两层"
DECISION_OWNER=Dexter
WHY=组织层级是产品结构决定,不因实现简单而定

CONFLICT=§6 运营账号模型(行 357)+ 新增"角色能力存储模型"
STATUS=PARTIALLY_CONFIRMED
EVIDENCE=v6 04 域(Account/Principal);v1 workspace-owned isolation;all-v2 modules(WorkspaceUser 活跃、WorkspaceRole capabilityKeys JSONB)
FINDING=草稿保留不裁决是对的;但缺 all-v2 现行层,且"UserNodeRoleAssignment vs capabilityKeys bundle"应单列冲突
DECISION_OWNER=Dexter
WHY=账号归属与角色模型影响隐私、跨空间体验与授权语义,不能由存储便利决定

CONFLICT=§6 角色变化走邀请(行 358)
STATUS=CONFIRMED(但已有裁决)
EVIDENCE=all-v2 q01-q12 rulings Q01(新增用户与角色变化只经邀请)
FINDING=该项并非开放冲突,是已裁决项;现稿让 Dexter 重新裁决属过保守
DECISION_OWNER=Dexter(仅确认沿用)
WHY=产品规则的撤销权在 Dexter,但不应以"未决"面貌重新提交

CONFLICT=新增:07-15 界面语言基线 vs 2026-07-21 术语裁决
STATUS=REJECTED_WITH_EVIDENCE(对草稿隐含采信旧层)
EVIDENCE=07-15 README 行 36/176(当前身份/查看范围为界面用语)与 Atlas 行 116(禁止"可视数据节点"上界面) vs q01-q12 rulings 行 93–97 与 business-user-facing-language-standard 行 30(反转:新文案用当前运营角色/可视数据节点)
FINDING=同仓两层方向相反,草稿只入账旧层;这是 S-1 的根
DECISION_OWNER=Dexter
WHY=用户语言是产品裁决;除非 Dexter 明示撤销,07-21 裁决为现行真相

CONFLICT=§6 三处 source drift(行 364–366:03 历史迁移语义;13/16/19 旧履约对象;17/22 ScanEntryDefinition)
STATUS=CONFIRMED
EVIDENCE=03:673;16:196/778/1295 对 13:1104;19:1080;17:1265 对 22:13/621(均本会话亲验)
FINDING=漂移真实,处置(登记不选边、以最新修订为准)正确
DECISION_OWNER=文档维护者 + Claude(不需产品裁决)
WHY=属 v6 文内未同步,非产品分歧
```

## 对请求 §8 五问的直接回答

1. **是否描述同一业务而非实现反推**:是。未发现从旧代码/接口反推的业务规则;R3-J01 保持无效的处置正确。
2. **遗漏/错误合并**:无错误合并;遗漏项见 S-1(现行裁决层)与 N-3(禁用词五项)。
3. **冲突是否保留不确定性**:是,且总体偏保守(一处已裁决项被当未决,见 CONFLICT 块)。
4. **能否阻止低级混淆**:核心混淆(空间=集团=租户=门店)可被 §3.3/§4 有效阻断;IAM 用户语言层修 S-1 后才可靠。
5. **增删降级建议**:增 S-1 三类来源与两条冲突、N-3 五项;无需删除或降级任何词条。

## 授权边界

本结论仅判定草稿是否可交 Dexter 产品裁决(当前:先修 S-1 再交)。不写入 project-memory,不恢复 R3/W1,不授权业务代码、contract、数据库、DEV/seed/reset、动态运行或任何 Git 操作。Git 归 Dexter。
