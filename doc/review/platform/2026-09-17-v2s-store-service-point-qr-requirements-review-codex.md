# 「门店桌台与二维码管理」需求正本 · Codex 独立静态 DESIGN 对抗评审

REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B  
REVIEW_CYCLE_ID=2026-09-17-store-service-point-qr-requirements  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_MAIN_AGENT  
VERDICT=NO-GO  
M/S/N=1/4/2  
EVIDENCE_TIER=STATIC_REPOSITORY_REOPENED_ONLY

## 1. 评审边界与输入

本记录只评审需求正本，不评审实现，也不把作者自审记录当作独立证据。先重开冻结输入、仓内 owning source 与项目 memory，再以当前字节对照需求正本，讨论稿最后只用于识别是否存在同根陈旧口径。没有执行构建、测试、契约生成、migration、reset、DEV、seed、UAT、部署或浏览器验证。

正本：

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md`
- 评审开始时 SHA-256：`bcdcc37b7dd0ea05c99684e998daa118ebdfa62356ba6c0d270ee44f0b437301`

工作材料（非事实正本）：

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-discussion-claude.md`

主要 owning source：

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businessChannel/OperationsBusinessChannelController.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelService.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTaskReadService.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelTaskReadPersistence.java`
- `contracts/openapi/paths/operations-admin/business-channel.paths.json`
- `contracts/openapi/components/business-channel/business-channel.schemas.json`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_001__base1_business_channel_derived_facts.sql`
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java`
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java`
- `contracts/catalog/admin-catalog.json`

## 2. 结论摘要

`NO-GO` 成立。需求正本的核心二维码消费者目前无法由现有“经营渠道”读取面同时满足精确候选谓词与游标分页要求；即使绕开这一点，渠道状态语义、生命周期清空后的冗余类型、验收反例、目标模板空 URL 等仍有实现分歧空间。因此不能仅把作者自审的“已修复”记录视为收口。

### L1_ENGINEERING

- `M-01`：`BUSINESS_CHANNEL` 读取分支拒绝游标，而带游标的 `SALES_MENU` 分支又没有二维码精确谓词；需求要求的同一读取形态在当前仓内不存在。
- `S-01`：正本仍把当前渠道状态写成 `DRAFT / EFFECTIVE / DISABLED` 并依赖 `stop_reasons`，与当前三态迁移、契约和独立维度读法冲突。
- `S-02`：允许所有子服务点作废后修改区域类型，但未冻结“清空”的生命周期动作以及历史服务点冗余类型如何与新区域类型共存。
- `S-03`：V-1 至 V-16 有多处只有单向负例、未覆盖互补角色/状态/谓词，存在“永远拒绝”或“只返回空结果”假实现通过的路径。
- `S-04`：目标二维码模板的 URL 规则允许为空但未定义保存、候选、启用和展示行为。

### L2_USER_VISIBLE

静态可推导的用户影响是：二维码渠道选择可能报错、列出错误的外卖/非扫码渠道、把有效渠道显示为不可用，或允许用户打开二维码开关却没有可派生 URL；区域类型修改和作废历史服务点也可能出现“界面允许但数据含义不一致”。这些不是运行结果，本轮未把它们升级成动态 PASS/FAIL。

### L3_UNVERIFIED

未运行任何实现、契约生成、migration、focused test、backend acceptance、reset、DEV、seed、UAT、部署或浏览器 L2。上述未运行项是证据边界，不作为额外代码缺陷计数。

## 3. Findings

### M-01｜Major｜确认：经营渠道读取形态与二维码候选/分页要求互相不成立

**类型**：仓内事实；需求与当前读取契约组合不成立是工程推论。  
**状态**：`CONFIRMED`。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:228-232,236-238`。

正本同时冻结了三件事：候选必须是当前门店、模板为 `INTERNAL + STORE + DINE_IN + QR`；用途必须是“经营渠道”而不是“销售菜单”；选择器必须游标分页且每页固定 20。当前仓内没有一个现成读取面同时满足它们：

1. `getOperationsStoreBusinessChannels` 的 controller 在 `OperationsBusinessChannelController.java:182-186` 对 `usage=BUSINESS_CHANNEL` 直接拒绝 `cursor` 与 `pageSize`，然后走 `channels(...)`；该方法在 `:455-462` 调用普通 `BusinessChannelService.pageChannels`。
2. 普通 owner 的 `BusinessChannelService.java:127-178` 只按 owner/status 做 bounded read，返回的 `nextCursor` 永远为 `null`；其 SQL 仅把可选状态拼到 `BusinessChannelServiceSql.java:20-25`，没有二维码三维模板谓词。
3. controller 的 `SALES_MENU` 分支在 `OperationsBusinessChannelController.java:191-204` 才使用游标；固定 20 的校验位于 `:632-636`。但它的 SQL 在 `BusinessChannelTaskReadPersistence.java:39-43` 只限制 `INTERNAL + STORE + (DINE_IN 或 TAKEAWAY)`，没有 `dine_in_form=QR`，也没有排除 `TAKEAWAY`；其 `:66-74` 只是按游标取这组更宽的结果。
4. 这不是只差一个前端参数。合同本身把 `usage` 枚举冻结为 `BUSINESS_CHANNEL / SALES_MENU`，见 `contracts/openapi/paths/operations-admin/business-channel.paths.json:1335-1363`。因此页面要么以 `BUSINESS_CHANNEL` 携带游标而被 400 拒绝，要么改用 `SALES_MENU` 而拿到非二维码/外卖候选，或者用普通经营渠道而无法保证候选谓词。

同一根因还暴露出写入侧的需求缺口：`R-6.4` 描述候选集合，`R-6.5` 描述选择状态，却没有单独冻结二维码配置保存时 owner 必须重新读取 `channelRef`，验证当前 workspace、当前门店归属、`INTERNAL + STORE + DINE_IN + QR` 以及可选择状态。不能把“候选列表曾经返回过”当作写入授权；现有 `BusinessChannelTaskReadService.java:120-128` 与 `BusinessChannelTaskReadPersistence.java:77-85` 的 `requireSalesMenuChannel` 也只校验到 `INTERNAL + STORE + DINE_IN`，并不证明 QR 形态。

**影响**：二维码配置可能无候选、请求被拒，或把非二维码/外卖渠道保存为二维码入口；V-16 只测“翻页可达”时仍可能对错误集合通过。跨门店 `channelRef` 若没有 owner 复核，还会造成错误归属或越权引用。

**最小修复**：把 R-6.4a/b 改为一个二维码专用的 bounded owner read（可以是同一资源下独立的 `usage`/operation，但不能改变既有 `BUSINESS_CHANNEL` 与 `SALES_MENU` 的既定语义），固定游标页大小 20，服务端一次性落实当前门店、模板 `INTERNAL + STORE + DINE_IN + QR` 与当前有效状态的精确谓词；保存命令沿同一 owner 边界重新校验 `channelRef`。复用现有的游标、状态维度和门店 scope 复核能力，不新建第二套渠道事实。只在既有 `BUSINESS_CHANNEL` 语义上强行加游标和二维码过滤会影响现有渠道页，因此不是更小的修复；若坚持修改该既有字面用途，须由 Dexter 单独确认契约兼容性，否则按上述 bounded 专用读取推进不需要产品范围裁决。

### S-01｜Significant｜确认：渠道状态与失效原因仍沿用已退役语义

**类型**：仓内事实；需求缺少当前状态维度映射是设计推论。  
**状态**：`CONFIRMED`。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:234-240`。

正本第 234 行把当前渠道表写成 `DRAFT / EFFECTIVE / DISABLED` 并称有 `stop_reasons`，第 236、238 行继续使用“生效/非生效”作为选择与失效条件。当前有效事实相反：

- 三态迁移在 `apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql:120-132` 把旧值转换为 `ENABLED / DISABLED / VOIDED` 并建立当前约束。
- `stop_reasons` 已在 `apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_001__base1_business_channel_derived_facts.sql:1-5` 删除；该迁移明确要求各相关状态作为独立维度读取，而不是物化合并原因。
- 当前契约的渠道自身状态与状态维度都使用 `ENABLED / DISABLED / VOIDED`，见 `contracts/openapi/components/business-channel/business-channel.schemas.json:289-295,297-335`；owner 策略的主数据常量也在 `BusinessChannelPolicy.java:15-24`。
- `BusinessChannelTaskReadService.java:343-346` 把非 `ENABLED` 的相关维度作为 blocker，但 `:456-459` 明确内部渠道的 binding 状态是 `NOT_REQUIRED`；`BusinessChannelPolicy.java:177-178` 中的 `EFFECTIVE` 是 collaboration binding 的有效态，不是业务渠道自身状态。

这会让详设自由选择错误的事实住址：查询名为 `EFFECTIVE` 的渠道行、把 binding 的 `EFFECTIVE` 当成内部渠道准入、重新依赖已删除的 `stop_reasons`，或把模板/门店/协作维度压成一个不可解释的“渠道失效”。R-6.7 说“已选渠道后来转为非生效”也没有区分渠道自身状态与相关维度状态，无法稳定生成“准确原因”。

**影响**：有效候选可能被过滤为空；已保存渠道失效时，用户看不到是哪一维导致二维码停止；内部渠道可能被错误要求有 binding；与“既有选择不自动清空、历史事实仍可读”的取向不一致。

**最小修复**：在正本中把当前状态语义冻结为：渠道与模板自身状态使用 `ENABLED / DISABLED / VOIDED`；候选读取只按明确的当前有效条件过滤；既有已选渠道始终保留 `channelRef` 和自身/相关维度的独立状态读回，不使用 `stop_reasons`，也不把 binding 的 `EFFECTIVE` 用作内部渠道条件；R-6.7 的原因必须指向具体维度与状态。只改一个文案为“启用”不够，因为候选 SQL、状态过滤、内部 binding 和失效原因仍会各自取不同事实。该修复不需要 Dexter 产品裁决；若 Dexter 要求新增一个聚合的“二维码可用状态”，才是新的产品判断。

### S-02｜Significant｜部分确认：区域改型后的历史服务点类型没有语义边界

**类型**：仓内需求语义推论，建立在正本已冻结的三态与冗余存储之上。  
**状态**：`PARTIALLY_CONFIRMED`（未实现，确认的是需求未冻结完整后置语义）。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:120-124,136-146`。

R-1.2 要求有服务点时不可改区域类型，但允许“先清空”后修改；R-1.6 又明确只计算未作废服务点，全部作废后允许修改。与此同时，R-2.2 要求服务点冗余保存自己的类型，R-2.3 却没有限定“类型一致”只适用于未作废服务点。若桌台区下的服务点全部转为 `VOIDED`，再把区域改成扫码区，历史服务点必然还保存原来的桌台类型。此时有四种可能实现：物理删除、把历史类型改写、继续按全量类型一致拒绝，或接受作废历史行与新区域类型不一致。前两种违反 R-1.4/R-2.6/R-2.9 的历史保留方向，第三种违反 R-1.6，正本没有选择第四种的明确边界。

**影响**：V-5/V-14 可能显示“修改成功”，但后续按冗余类型读取、审计或恢复时无法判断历史行是否应参与一致性校验；实现方可能为了让约束通过而删除或改写历史数据。

**最小修复**：冻结“清空服务点”只表示在同一事务内把该区域下所有未作废服务点转为 `VOIDED`，不物理删除；类型一致性只约束未作废服务点；作废服务点保留原类型、扩展值与图片引用，并排除在当前区域类型校验和活动分组之外。V-14/V-5 增加修改后的权威 readback，证明历史行未被改写。这个边界是由已裁决的三态、冗余类型和“只计未作废”直接推出的最小解；若“清空”另有删除含义，则与已裁决生命周期冲突，需要 Dexter 重新裁决。

### S-03｜Significant｜确认：V-1 至 V-16 存在可被假实现蒙混的互补覆盖缺口

**类型**：需求验收判据缺口。  
**状态**：`CONFIRMED`。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:284-305`。

正本已经正确要求不能抽样，但仍有多个判据只覆盖一边，不能证明相反方向和精确事实。具体矩阵见第 4 节；最重要的缺口是：V-1 没有固定非空正向 fixture，空页面可通过；V-4 只有两个非法组合，没有合法组合，永远拒绝可通过；V-7 没有片段情况，未验证参数编码；V-8 只有一个外卖负例，不能证明三维闭集的互补边界；V-9 的“原因准确”没有原因到状态维度的 oracle；V-10 只验证门店层与项目层，漏掉 R-5.2 明确包含的集团、大区；V-13 只构造停用区域，漏掉作废区域和子服务点状态组合；V-15 没有分别证明区域编码与服务点编码；V-16 只证明翻页可达，没有断言 QR 精确谓词和有效状态。

**影响**：一份只返回空列表、所有写入都拒绝、只实现一条负例、只支持两类角色或把 `SALES_MENU` 的宽候选当二维码候选的实现，可能在局部测试中“通过”。这会把 M-01、S-01 和 S-02 的真实偏差延迟到运行验收甚至用户操作才暴露。

**最小修复**：不是泛泛增加测试，而是为每个缺口添加一个互补的最小 oracle：固定已知非空数据的 V-1 正例；桌台→桌台与扫码区→非桌台的合法正例；V-7 的 query/无 query/fragment 与编码值；V-8 的合法 QR tuple 加逐字段 red mutation；V-9 的维度到文案映射；V-10 四类角色；V-13 的 `DISABLED` 与 `VOIDED` 区域及子状态；V-15 分拆两个实体；V-16 断言 exact tuple、状态与游标连续性。每一项对应不同的补集，不能用一句“增加覆盖率”替代，也不能以 V-2/V-4 的单一负例推导正向能力。无需 Dexter 产品裁决。

### S-04｜Significant｜部分确认：目标二维码模板 URL 为空时没有产品行为

**类型**：产品语义缺口；不是当前代码缺陷。  
**状态**：`PARTIALLY_CONFIRMED`（文档允许该状态，但用户行为尚未定义）。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:228,236-245,259-266,295-296`。

R-6.4 的目标模板条件只约束接入方式、经营主体、下单场景和堂食形态；R-6.5 只约束“生效”状态；R-6.9 只说非目标模板必须为空，却没有要求目标模板 URL 规则非空、合法或可派生。于是“目标类型 + 有效状态 + 空 URL 规则”的模板既可以成为候选，也可以被保存为已选渠道，而 R-6.10/R-6.14 又把开启后的二维码描述成可查看。V-9 只覆盖未开启、未选渠道、已选渠道失效，没有覆盖目标 URL 为空。

**影响**：用户可能看到二维码开关已开启、渠道也已选择，但无法查看二维码；页面无法区分“没有渠道”与“渠道配置不完整”，候选和保存行为会由详设自行选择。

**最小修复**：需要 Dexter 在以下两种最小产品语义中选一条：

1. 目标类型模板的 URL 规则必须非空且通过 URL 校验；空值模板不进候选，模板保存时由 owner 拒绝；或
2. 允许模板先保存为空，但候选/保存后的二维码配置明确标为不可用，给出“渠道 URL 规则未配置”的原因，并禁止查看二维码，直到模板补齐。

两者都不需要新建 provider config；但它们改变保存与候选交互，不能由 reviewer 代替 Dexter 选定。仅在详设里随意选择会把一个用户可见的失败状态伪装成实现细节。

### N-01｜Note｜URL 拼接的边界仍未完全冻结

**类型**：设计细节缺口；部分事实尚缺新实现证据。  
**状态**：`CONFIRMED`（正本未覆盖这些边界）。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:259-264,294`。

R-6.12 只冻结“已有查询串”和“片段之前插入”，V-7 甚至还没有覆盖片段。没有写死空查询 `?`、尾部 `&`、参数值 percent-encoding、参数同名时追加还是拒绝、非法 base URL 的处理。空 URL 的产品行为已单列为 S-04，不在本 Note 重复。

**最小修复**：在详设中冻结有效 URL 的范围、参数名和值的编码、插入片段前的 delimiter、重复参数策略，并把 fragment 与编码值加入 V-7。只要明确“仅接受合法 URL，重复键按追加，统一使用 URI 编码”或另一个有理由的最小规则即可，不需要引入 URL DSL。是否允许目标 URL 为空由 S-04 的 Dexter 决策解决。

### N-02｜Note｜新实体和 QR 单例的初始状态未冻结

**类型**：需求缺口；涉及产品默认行为的判断。  
**状态**：`CONFIRMED`（正本声明了状态集合，但没有声明创建默认值）。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:65-76,119-145,222-238`。

正本冻结了区域/服务点三态，也冻结了二维码配置单例包含“是否开启 + 渠道引用”，但没有规定新建区域/服务点的初始状态、首次创建 QR 配置时 `enabled` 与 `channelRef` 的默认组合，以及“开启但未选渠道”是否允许保存。不能把上一批经营规则开关的默认规则自动套到新实体。

**最小修复**：在需求或详设入口处明确：新建区域/服务点的默认状态，以及 QR 单例的推荐初始组合（通常为 `enabled=false, channelRef=null`），并为该组合补一个正向 readback；若产品希望创建即启用或允许未选渠道保存，由 Dexter 明确裁决。这个 Note 不阻断当前设计，但不能让每个实现者自行决定用户首次进入页面看到的状态。

## 4. V-1 至 V-16 可证伪性逐条判断

| 判据 | 判断 | 原因与关联 finding |
| --- | --- | --- |
| V-1 | 容易被蒙混 | “正常出数据”没有固定非空 fixture/权威行断言；永远返回空列表仍可能满足“不发请求 + 有文案”。见 S-03。 |
| V-2 | 原则上足够 | 已要求本域完整映射、后端拒绝和直连反例；前提是详设真的交付全集映射。当前没有把实现映射当作本轮运行证据。 |
| V-3 | 基本足够 | 有关闭前后行数与内容对照，能够阻止通过删除数据实现关闭。 |
| V-4 | 容易被蒙混 | 两个非法组合都拒绝，但没有合法桌台→桌台、扫码区→非桌台正例；永远拒绝可通过。见 S-03。 |
| V-5 | 部分不足 | 有“清空后可改”的正向方向，但未断言清空如何落成 VOIDED、旧行类型和值是否保留。见 S-02。 |
| V-6 | 基本足够 | 同时有结构与模板规则变更后的行为判据，强于单纯检查没有 URL 列。 |
| V-7 | 容易被蒙混 | 只覆盖有/无 query，遗漏 fragment、编码和空 query 边界；当前要求已有 fragment，但验收没有它。见 S-03/N-01。 |
| V-8 | 容易被蒙混 | 一个外卖类负例不能证明 INTERNAL、STORE、DINE_IN、QR 四个维度逐项生效，也没有合法正例。见 M-01/S-03。 |
| V-9 | 容易被蒙混 | 三种状态没有精确 reason oracle，且遗漏目标模板空 URL；任意通用错误文案都可能被称为“准确”。见 S-01/S-03/S-04。 |
| V-10 | 容易被蒙混 | R-5.2 的四类角色只测了门店层与项目层，集团/大区正向能力未证明。见 S-03。 |
| V-11 | 不属于纯存在性判据 | 包含定义、存取、审计四态、标签快照和截断行为；仍需详设给出具体 readback oracle，但不是只看文件出现。 |
| V-12 | 基本足够 | 同时有保存失败的无孤儿负例和保存成功的资产认领正例。 |
| V-13 | 容易被蒙混 | 只写停用区域，没有作废区域及子服务点 ENABLED/DISABLED/VOIDED 的组合；“一律不可用”无法完整证伪。见 S-03。 |
| V-14 | 部分不足 | 覆盖未作废阻断与全部作废放行，但没有断言修改后的区域类型、历史服务点类型和值未被改写。见 S-02/S-03。 |
| V-15 | 容易被蒙混 | “对象”没有分别指明区域和服务点；只测一类编码即可漏掉另一类。见 S-03。 |
| V-16 | 容易被蒙混 | 只验证游标能到下一页，没有断言用途实际对应的 exact QR predicate、状态与排除 TAKEAWAY；当前读取矛盾见 M-01。 |

## 5. 八个攻击点的处置与同根扫描

### 5.1 R-7.2：自审修正成立，不记 finding

`ExtensionHostTypes.java:5-17` 的宿主全集是 8 类，`FLAT_VALUES` 是 5 类。`ExtensionDefinitionService.java:755-765` 显示该集合只控制 `listDisplay`/`searchable` 的规范化，树宿主得到 `null`；`StoreService.java:629-691` 则通过 STORE 定义与 owner 的扩展值读写处理值存取。因此本批不接入动态列/类型化搜索时，服务点不进 `FLAT_VALUES` 是正确的；能否存值的前提是 R-7.1 所说的宿主定义、值列和 owner 读写，而不是该展示标志集合。

### 5.2 R-1.5/R-1.6：正常状态组合方向合理，但后置历史语义进入 S-02

“祖先非启用不改写后代存储值”与三态生命周期方向一致；问题只在全部子项作废后改变区域类型时，正本没有冻结清空动作、活跃一致性范围与历史冗余值边界。未把这部分扩大成另一个 finding。

### 5.3 渠道选择谓词：M-01/S-01，不接受正本“仓内事实”表述

已打开 controller、普通 owner、游标候选 owner、SQL、OpenAPI 和当前迁移；结论不是“pageSize 事实不存在”，而是 pageSize 20 只属于 `SALES_MENU` 分支，不能与正本指定的 `BUSINESS_CHANNEL` 用途和 QR 谓词同时成立。渠道状态则另由 S-01 处理。

### 5.4 R-5.9：泛化 gate 是较小且正确的方向，不记 finding

现有 gate 与中央 token 硬编码为商品开关，正本要求按开关键泛化并为本域另算写入口闭包，符合共享机制复用和不复制桌台专用实现的最小原则。没有证据表明新增一个专用 gate 会更小或更安全；本轮不进入详设/实施，不替它选择具体 API。

### 5.5 R-6.12：主要求覆盖了 query 与 fragment，但 V-7/N-01 仍不完整

正本的主规则确实要求参数位于 fragment 之前，因此没有把 R-6.12 本身误判为遗漏；缺口是空 query、编码、重复键等边界及验收没有同步覆盖，列为 N-01 与 S-03。

### 5.6 编码唯一性：自审修正成立，不记 finding

当前三态迁移中的部分唯一索引在 `V20260827_010000_000__base1_three_state_lifecycle.sql:384-425` 统一使用 `WHERE status <> 'VOIDED'`；catalog 的相关迁移也采用同一惯例。正本 R-1.3/R-2.4 的“未作废范围唯一、作废后可复用”与仓内事实一致。

### 5.7 去掉区域的替代：否决理由成立，不记 finding

正本 `:51-57` 明确承认“直接挂门店”技术上更小，同时记录了 Dexter 明确要求三个实体、分组/排序/业务惯例等产品理由，并没有把产品要求伪装成技术必需。该产品取舍不由本轮推翻。

### 5.8 角色、扩展宿主和相邻范围扫描

`contracts/catalog/admin-catalog.json:803-828,831-849,852-869,894-912` 证实三个既有门店消费面包含 `GROUP/REGION/PROJECT/STORE` 且以 STORE 为 required data node；正本 R-5.2 沿用这一范围，V-10 只是验证不足。扩展宿主、定义主键、存值 owner、三态编码索引均未发现第二条与本需求同根的未记录问题。

讨论稿 `2026-09-17-v2s-store-service-point-qr-requirements-discussion-claude.md:149-155,180-191,251-255` 仍保留旧的 `DRAFT/EFFECTIVE/DISABLED`、`stop_reasons` 和“服务点必须进 FLAT_VALUES”的工作材料口径；该文件明确是讨论稿，不能作为正本缺陷之外的事实或授权。正本已修正 FLAT_VALUES，但没有修正第 234 行的渠道状态事实，因此 S-01 仍成立。

## 6. 设计层边界、修订优先级与授权

### 6.1 需求层应冻结的内容

本轮认为必须回到需求正本或明确转入详设且不可自由发挥的内容是：

1. 二维码候选读取的真实用途/operation 语义、精确四维模板谓词、当前有效状态维度、游标页大小和保存时 owner revalidation（M-01）。
2. `ENABLED/DISABLED/VOIDED` 与各关联维度的失效原因表示，尤其内部 binding 的 `NOT_REQUIRED`（S-01）。
3. “清空服务点”的生命周期动作、未作废一致性范围、历史冗余类型保留规则（S-02）。
4. 目标模板 URL 规则为空的用户可见行为（S-04，需 Dexter 决策）。
5. V-1 至 V-16 的必要互补 oracle（S-03）。

URL 编码、重复参数和创建默认值可以由详设提出最小实现，但需求/详设之间必须显式冻结，不能由实现者默选（N-01/N-02）。本轮没有把表名、列名、SQL、具体组件位置等 §9 已明确下沉的实现事项重新提为需求缺陷。

### 6.2 授权边界

本记录只授权并完成静态需求评审。它不授权修改需求正本、编写详设、实施代码、契约生成、构建、测试、migration、reset、DEV、seed、UAT、部署或浏览器验证。后续是否修订需求、是否由 Dexter 裁决 S-04/N-02，再决定能否进入详设；`NO-GO` 在 M-01 至少关闭前不能作为实施准入。

## 7. 结论格式

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M/S/N=1/4/2
L1_ENGINEERING=M-01,S-01,S-02,S-03,S-04
L2_USER_VISIBLE=二维码候选/状态/URL行为与区域类型后置语义存在静态风险
L3_UNVERIFIED=实现、契约生成、构建、测试、migration、backend acceptance、reset、DEV、seed、UAT、部署、Browser L2
SAME_ROOT_SCAN=business-channel read/candidate/status/write; extension host/value; lifecycle uniqueness; admin-catalog roles; discussion draft authority
DESIGN_GAPS=N-01,N-02; known pending table shape and 桌台/桌面 wording remain outside findings
EVIDENCE_TIER=STATIC_REPOSITORY_REOPENED_ONLY
AUTHORIZATION=仅需求文档静态评审；未授权详设、实施或任何动态动作
```
