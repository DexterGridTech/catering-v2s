# 「门店桌台与二维码管理」需求正本 · Codex 第 2 轮独立静态 DESIGN 对抗评审

REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B  
REVIEW_CYCLE_ID=2026-09-17-store-service-point-qr-requirements  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_MAIN_AGENT  
VERDICT=NO-GO  
M/S/N=0/1/2  
EVIDENCE_TIER=STATIC_REPOSITORY_REOPENED_ONLY

## 1. 评审边界与输入

本轮只评审需求正本当前字节，不把需求正本 §12 的作者自审处置、讨论稿、上一轮 verdict 或历史 evidence 当作事实正本或授权。没有执行构建、测试、契约生成、migration、reset、DEV、seed、UAT、部署或浏览器验证。

需求正本：

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md`
- 评审开始时 SHA-256：`a74c96e3efc69c56a147d9c4efc881f468e041c14f181dd81c3ee3c615e811eb`

讨论稿（仅工作材料，不是事实正本）：

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-discussion-claude.md`

本轮重开的主要 owning source：

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businessChannel/OperationsBusinessChannelController.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelService.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTaskReadService.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelTaskReadPersistence.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelQuerySupportSql.java`
- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelQuerySupport.java`
- `contracts/openapi/components/business-channel/business-channel.schemas.json`
- `project-memory/practices/business-channel-list-scope-and-validity-display.md`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_000__base1_three_state_lifecycle.sql`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260827_010000_001__base1_business_channel_derived_facts.sql`
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java`
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java`
- `contracts/catalog/admin-catalog.json`

## 2. 动作 1-B：当前需求正本的事实提取

### 2.1 文档内已冻结且彼此一致的输入

- D-10 与 R-6.9b 至 R-6.9e 一致：目标模板 URL 规则可以为空或不合法；不在候选层或配置保存层拦截；在每个服务点生成二维码时判定；不合法显示固定文案「暂未生成二维码」。
- R-6.4 至 R-6.4c 已把候选读取与保存复核分开：owner 服务端落实当前门店和四维模板谓词，采用二维码专用读取，保存时重新校验。
- R-1.5 至 R-1.9、R-2.3 至 R-2.4 已把非启用祖先、作废子项、历史类型保留、未作废范围唯一和新建默认状态写出。
- V-1 至 V-16 已增加固定非空正例、合法/非法互补、四类角色、四维 red mutation、D-10 反例以及权威 readback。

### 2.2 当前字节仍未闭合或相互牵连的事实

1. 需求在 R-6.5 只把“渠道自身状态 + 模板状态”定义为候选/失效条件，但 R-6.7a 又要求从 owner 的 `blockers` 或 `statusDimensions` 取失效原因；当前 owning source 的这两个列表包含更多组织、目标和协作维度。文档没有冻结这些维度中哪些会使已选二维码停止。
2. V-9 要求“前三种原因”都对应具体状态维度，但“未开启”和“未选渠道”并没有已选渠道的状态维度；V-16 也没有把渠道自身状态与模板状态分别构造反例。这不是 D-10 的候选过滤问题，而是二维码可用性与原因 oracle 的层次没有闭合。
3. 正本第 237、425 行声称 `dineInForm` 在渠道模块只出现在命令与审计路径。当前读取投影 `BusinessChannelQuerySupportSql.java:15` 明确选择了 `t.dine_in_form AS template_dine_in_form`；“当前没有 SQL WHERE 谓词过滤它”才是成立的半句。
4. R-6.4b 与 §5.4 只冻结“bounded read + 固定来源上限”，把上限值和超限呈现交给详设；这是下一层必须闭合的具体行为。当前共享 bounded read 的实际上限是 100，且超限抛出 owner invariant，而不是静默截断。
5. R-6.12 已列出本需求要求的 URL 形态，但没有在需求层决定同名参数是追加还是覆盖、同时存在 query 与 fragment 时的组合样例、以及“合法地址”的允许 scheme。这些属于详设需落位的细节，本轮不把它们升级为新的 Significant。

## 3. 结论摘要

第 1 轮的七条处置中，二维码专用读取、服务端保存复核、三态生命周期、区域改型后的历史行、扩展宿主集合、未作废编码唯一、D-10 和验收判据的大部分互补性均已真实改善。第 1 轮的 M-01 不再成立，不能因为仍存在“operation 或 usage dimension”的实现选择就回退为旧 finding。

但当前需求仍然 `NO-GO`：同一份 owner readback 的 `statusDimensions/blockers` 明确包含 11 类状态维度，需求却没有冻结二维码生成到底只看 R-6.5 的两项状态，还是看除内部 binding 之外的全部 blocker。这个缺口会同时改变候选、已保存配置的二维码显示和失败原因，不能留给详设自由发挥。

### L1_ENGINEERING

- `S-01`：二维码候选状态、已选配置的停止条件、`blockers/statusDimensions` 原因范围和 V-9/V-16 oracle 没有形成同一个状态矩阵。
- `N-01`：一处承重仓内事实把读取投影误写成“只在命令与审计路径出现”。
- `N-02`：V-13 没有覆盖“区域非启用 + 服务点自身 VOIDED”的状态组合，不能独立证伪 R-1.5 的“无论服务点自身处于什么状态”。

### L2_USER_VISIBLE

静态可推导的影响是：当集团空间、项目、门店、经营主体、品牌或外部协作维度停用时，二维码可能被错误地继续展示、被错误地停止，或显示无法对应真实原因的文案；而未开启/未选渠道的配置态可能被错误要求提供“渠道状态维度”原因。这些不是运行结果，本轮未将其升级为动态 PASS/FAIL。

### L3_UNVERIFIED

未运行实现、契约生成、构建、测试、migration、backend acceptance、reset、DEV、seed、UAT、部署或 Browser L2。当前 verdict 只说明需求与静态 owning source 的设计闭合性，不说明实现或环境可用性。

## 4. Findings

### S-01｜Significant｜CONFIRMED：二维码可用性没有定义 `blockers/statusDimensions` 的适用范围

**类型**：仓内事实 + 需求内部约束不完整；不是把 D-10 重新解释成候选层过滤。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:232-245,249,258-265,312-321`。

当前需求写了三层语义：

1. R-6.4/R-6.5/R-6.6 将候选集合冻结为当前门店、四个模板维度满足、渠道自身和模板均 `ENABLED`；R-6.9c 又明确 URL 空或非法不影响候选与保存。
2. R-6.7 只说“已选渠道后来不再满足 R-6.5”时二维码停止。
3. R-6.7a 却要求停止原因从 `blockers` 或 `statusDimensions` 映射到具体状态维度；V-9 把前三种原因都要求“对应到具体状态维度”。

当前 owner readback 的实际维度不是只有这两项：

- `BusinessChannelTaskReadService.java:219-241` 加入 `GROUP_WORKSPACE`、模板、模板项目、模板项目祖先、目标节点、目标项目及祖先、目标门店项目、目标门店；
- `BusinessChannelTaskReadService.java:243-260` 再加入目标租户、目标品牌、`COLLABORATION_BINDING` 以及外部 provider/system 维度；
- `BusinessChannelTaskReadService.java:261-263,343-346` 把除 `COLLABORATION_BINDING` 外所有非 `ENABLED` 维度都放进 `blockers`；通用 `BusinessChannelService.java:811-855,965-968` 使用同一算法；
- 契约在 `contracts/openapi/components/business-channel/business-channel.schemas.json:297-335` 也明确声明了这组多维度闭集，`bindingStatus` 则在 `:599-605` 独立为 `NOT_REQUIRED/UNBOUND/BOUND`。

因此存在一个可以直接构造的反例：渠道自身和模板都为 `ENABLED`，四维模板谓词也满足，但目标门店或其项目、集团空间、租户、品牌中的一维为 `DISABLED`。此时 R-6.5 仍成立，候选不应被 R-6.6 的谓词排除；但 owner 的 `blockers` 已非空。当前需求没有回答已保存二维码是继续生成，还是因该 blocker 停止；若停止，R-6.7 的“只在不满足 R-6.5 时停止”又不完整。

V-9 还有第二个直接矛盾：未开启和未选渠道没有“已选渠道状态维度”，却被放进“前三种原因必须对应具体状态维度”的句子。它们应当使用配置状态原因；只有“已选渠道不再满足条件”才有资格从 `blockers/statusDimensions` 取原因。V-16 的“状态为停用与作废”也没有分别覆盖渠道自身和模板两条状态维度。

**影响**：

- 用户可见的二维码位置会因详设如何解释 `blockers` 而出现相反行为；
- 候选层如果误用全量 blocker，会违反 R-6.6 的候选谓词；生成层如果完全忽略 blocker，又会让 R-6.7a 的原因字段失去事实来源；
- 失败文案可能把“开关关闭/未选渠道”伪装成某个渠道状态，或者在渠道/模板/组织维度之间丢失真正原因；
- V-9/V-16 不能阻止“只按渠道自身状态”或“任何 blocker 都过滤”的两种相反假实现。

**最小修复建议**：在需求正本冻结一张两层矩阵，而不是只补一个词：

- **候选层**：固定为 R-6.4 四维 + 渠道自身 `ENABLED` + 模板 `ENABLED`；URL 合法性继续按 D-10 留在生成层；内部 `NOT_REQUIRED` 不构成阻塞；其他 `statusDimensions` 不得被候选查询隐式过滤。
- **已选配置/生成层**：由 Dexter 明确选择“只看 R-6.5 的渠道/模板两维”或“R-6.5 两维之外，所有非 binding blocker 都停止”。若选择后者，必须逐项列出当前 owner 返回的维度，并规定原因按维度顺序或完整列表返回；若选择前者，必须明确忽略其他 blocker，R-6.7a 不得笼统引用全量 `blockers`。
- **配置态原因**：未开启、未选渠道各自使用固定配置原因，不要求映射到渠道状态维度；只有已选渠道不再满足条件才使用具体 `statusDimensions`。V-16 分别构造渠道自身 `DISABLED/VOIDED` 与模板 `DISABLED/VOIDED`，并按最终矩阵补充关联维度反例。

不能更小的理由：只把 R-6.7 的“R-6.5”改成“blockers”会把候选层与生成层混在一起；只修 V-9 文案则不会决定真实二维码是否继续生成；只补模板状态测试也不能解决组织/目标/协作维度的适用范围。必须先冻结“候选谓词”和“已选二维码停止谓词”这两个层次，才不会让详设自由选出相反行为。

**是否需要 Dexter 裁决**：需要。它改变已有渠道关联维度失效时二维码是否可见，属于 D-10 之外的用户可见产品语义；本轮不代替 Dexter 选择。

### N-01｜Note｜CONFIRMED：`dineInForm` 的承重事实表述错误

**类型**：仓内事实；不等于当前代码缺陷。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:237,425`。

正本把事实写成“`dineInForm` 在整个渠道模块只出现在命令与审计路径”。但 `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/persistence/BusinessChannelQuerySupportSql.java:10-16` 的公共读取投影在第 15 行明确选择 `t.dine_in_form AS template_dine_in_form`；`BusinessChannelPersistence` 也在投影映射中读取该列。当前没有发现它作为 SQL `WHERE` 谓词的事实仍成立，销售菜单查询的过滤在 `BusinessChannelTaskReadPersistence.java:39-43` 也确实没有堂食形态条件。

**影响**：实现者可能误以为读取投影不存在堂食形态，或把“没有 SQL 谓词”误读成“读取层不应消费该字段”。这会污染 R-6.4 的 owner 过滤设计，但不改变 D-10 或当前候选行为本身。

**最小修复建议**：把正本两处改成“`dineInForm` 已在命令、审计和读取投影中存在，当前渠道模块的既有 SQL 没有用它作过滤谓词；二维码专用 owner read 必须在自身谓词中落实 `dineInForm=QR`”。只改这一处事实即可，不需要新增字段、查询层或迁移。

**是否需要 Dexter 裁决**：不需要；这是可由 owning source 直接纠正的事实。

### N-02｜Note｜CONFIRMED：V-13 漏掉服务点自身 `VOIDED` 组合

**类型**：验收判据缺口；仓内三态事实已成立。  
**需求位置**：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md:123,318`。

R-1.5 的限定是“无论服务点自身处于什么状态”，而 V-13 只要求区域 `DISABLED/VOIDED` 各测一次、服务点自身 `ENABLED/DISABLED` 各覆盖一次。它没有构造区域非启用 + 服务点自身 `VOIDED` 的组合。V-14 证明作废历史行保留并排除当前分组，但不等价于证明 R-1.5 的祖先可用性判定不会对 `VOIDED` 子项走另一条分支。

**影响**：一个只对启用/停用子项执行祖先 gate、对作废子项错误地显示二维码或错误地改写值的实现，可能通过 V-13 的现有组合；这属于验收假绿，不是要求必须让作废行重新可用。

**最小修复建议**：V-13 增加一条固定反例：区域为 `DISABLED` 与 `VOIDED` 时，各自同时带 `ENABLED/DISABLED/VOIDED` 三种服务点状态，全部断言不可用且服务点存储值不改写；现有“停用区域重新启用后原样恢复”只继续适用于 `DISABLED`，不新增作废区域恢复语义。只加这个缺失组合即可，不需要改变 R-1.5 或生命周期模型。

**是否需要 Dexter 裁决**：不需要；这是对已有 R-1.5 的机械补集，不新增产品行为。

## 5. 第 1 轮七条处置的独立复核

### 5.1 R-7.2：CONFIRMED 已闭合

`ExtensionHostTypes.java:5-17` 的宿主闭集为 8 类，`FLAT_VALUES` 为 5 类；`ExtensionDefinitionService.java:755-765` 只用它规范化 `listDisplay/searchable` 两个标志；`StoreService.java:629-691` 通过宿主定义、值列和 owner 读写处理扩展值。服务点本批不接动态列和类型化搜索，因此不进入 `FLAT_VALUES`，不影响存值。

### 5.2 R-1.5/R-1.6/R-1.7/R-1.8/R-2.3：CONFIRMED 已闭合

当前正本明确祖先非启用不改写子项状态，只有未作废服务点阻止区域改型；清空是转为 `VOIDED` 而非物理删除，作废历史保留原类型、扩展值与图片并退出当前校验/分组。它与 `project-memory/decisions/owner-read-model-and-lifecycle-standard.md:64-70` 的三态、作废不可作为新引用候选、编码释放方向一致。V-13 的唯一残留是本轮 N-02 所述的测试补集，不是业务规则本身未定义。

### 5.3 R-6.4 至 R-6.4c：上一轮 M-01 已关闭，但本轮 S-01 仍需处理

`OperationsBusinessChannelController.java:172-204` 证明既有 `BUSINESS_CHANNEL` 与 `SALES_MENU` 的用途形态不同；`BusinessChannelService.java:127-177` 是 bounded read；`BusinessChannelTaskReadPersistence.java:29-75` 的销售菜单候选谓词不含 QR 堂食形态。当前正本已改为二维码专用 owner read、四维服务端谓词和保存时重新校验，没有再要求复用错误的既有用途。新增 operation 或新增用途维度只要不改既有两个用途语义，属于详设形态选择，不构成 finding。

但 R-6.4b 的“固定来源上限”和超限呈现仍必须在详设落位。现有 `BusinessChannelQuerySupport.java:10-12` 的 `BOUNDED_READ_LIMIT` 是 100，`BusinessChannelService.java:157-171` 在超过上限时抛出 typed owner invariant；不得由二维码详设把它改成静默截断。该项是实现前的具体设计落点，不另增 Significant。

### 5.4 R-6.5/R-6.5a/R-6.7/R-6.7a：新 S-01

三态枚举、`NOT_REQUIRED` 绑定语义与多维度 readback 的承重事实均成立，问题不再是旧的 `DRAFT/EFFECTIVE/stop_reasons` 错误；问题是候选谓词与已选二维码停止谓词没有对齐全量 blocker。详见 S-01。

### 5.5 R-6.9b 至 R-6.9e：CONFIRMED 已按 D-10 闭合

R-6.5 负责渠道自身/模板状态，R-6.9c 明确 URL 空/非法不参与候选和保存，R-6.9d 才在逐服务点生成时判定。两条在层次上不冲突；V-9 也明确 URL 不合法渠道仍在候选且配置可保存。本轮不把“URL 空时应在候选层过滤”重新记为 finding。

### 5.6 R-6.12：主形态已覆盖；剩余为详设边界

R-6.12 与 V-7 已列出无 query、已有 query、fragment、尾部 `?/&`、同名参数和百分号编码，并将空/非法 URL交给 D-10 生成层处理，没有发现第 1 轮那种明确遗漏的 URL 形态。详设仍应给出同名参数追加/覆盖、query+fragment 组合和允许 scheme 的确定输出，但本轮不因已有列举而过度设计 URL DSL。

### 5.7 编码唯一性：CONFIRMED 已闭合

`V20260827_010000_000__base1_three_state_lifecycle.sql:384-425` 的区域相关三态唯一索引使用 `WHERE status <> 'VOIDED'`，与 catalog 其他实体的同类迁移一致。R-1.3/R-2.4 的未作废范围唯一与仓内惯例一致，作废后复用不破坏历史。

### 5.8 去掉区域的替代方案：CONFIRMED 论证成立

正本 `:51-57` 已承认“服务点直接挂门店”技术上更小，同时明确 Dexter 要求三个实体、独立区域符合 v4/v6 业务惯例和分组/排序目标；它没有把产品理由伪装成技术必需。本轮不推翻该裁决。

## 6. V-1 至 V-16 逐条可证伪性复核

| 判据 | 当前判断 | 复核结论 |
| --- | --- | --- |
| V-1 | 可证伪 | 固定非空夹具 + 开关关闭不发列表请求，已堵住“列表恒空”的假正例。 |
| V-2 | 可证伪 | 要求完整写入口映射、后端直连拒绝且不接受抽样；完整映射仍需在详设交付，本轮未把它当运行证据。 |
| V-3 | 可证伪 | 关闭前后行数与内容对照，能抓住清空/删除数据的假实现。 |
| V-4 | 可证伪 | 两个非法类型组合 + 两个合法组合，已堵住“永远拒绝”。 |
| V-5 | 基本可证伪 | 有服务点时拒绝、清空后可改；清空后历史保留由 V-14 补强，不能只看这一行孤立判断。 |
| V-6 | 可证伪 | 同时要求无持久化 URL 与修改模板后已有服务点派生结果变化，已堵住一次性快照。 |
| V-7 | 基本可证伪 | 五种 URL 形态、编码、空/非法输入和 D-10 结果均有正反例；同名参数的精确输出仍由详设给出。 |
| V-8 | 可证伪 | 四个模板维度各自 red mutation + 全满足正例，已堵住只测外卖负例。 |
| V-9 | OPEN（并入 S-01） | URL 分支已正确反例化；但“未开启/未选渠道”不应映射到渠道状态维度，已选渠道是否受全量 blocker 影响也未冻结。 |
| V-10 | 可证伪 | 集团、大区、项目、门店四类角色均要求独立验证。 |
| V-11 | 可证伪 | 宿主定义、值存取、审计四态/标签快照/超长截断均有行为要求，不是文件存在性判据。 |
| V-12 | 可证伪 | 保存失败无孤儿 + 保存成功认领并可读回，已堵住“永不认领”。 |
| V-13 | OPEN（N-02） | 覆盖区域停用/作废和子项启用/停用，但缺子项 `VOIDED`，不能完整证明 R-1.5 的“无论状态”。 |
| V-14 | 可证伪 | 活跃子项阻断、全部作废放行，并以权威 readback 检查历史类型/扩展值/图片与当前分组排除。 |
| V-15 | 可证伪 | 区域编码与服务点编码分别验证，作废后分别复用。 |
| V-16 | OPEN（并入 S-01） | 四维 red mutation、合法正例、内部 `NOT_REQUIRED` 已覆盖；渠道自身与模板自身的 `DISABLED/VOIDED` 尚未分开，关联 blocker 的最终适用范围也未冻结。 |

## 7. 同根全集扫描

- **business-channel 候选/状态/保存全集**：已检查 `OperationsBusinessChannelController` 的 `BUSINESS_CHANNEL` 与 `SALES_MENU` 两个分支、普通 `BusinessChannelService`、`BusinessChannelTaskReadService`、`BusinessChannelTaskReadPersistence`、共享 SQL 投影、OpenAPI 状态维度契约及 business-channel memory。未发现第二条读取路径绕过 R-6.4c；唯一同根未闭合项是 S-01，事实表述残留为 N-01。
- **生命周期全集**：已检查区域/服务点三态要求、作废/改型规则、编码部分唯一迁移及 owner lifecycle standard。业务边界已闭合；验收组合遗漏单独记 N-02。
- **扩展宿主/值存取全集**：已检查 8 类宿主、5 类 `FLAT_VALUES`、定义规范化和 Store owner 值读写；R-7.2 不再构成 finding。
- **权限全集**：已检查三个既有门店页面在 `contracts/catalog/admin-catalog.json:803-828,831-849,852-869,894-912` 的 `GROUP/REGION/PROJECT/STORE` 与 STORE scope 形态；没有发现角色范围漂移。
- **V-1 至 V-16 全集**：16 条逐条重开；只有 V-9/V-16 的状态 oracle 与 S-01 同根，V-13 的 `VOIDED` 补集为 N-02。
- **讨论稿 authority**：讨论稿仍含旧状态/旧平面宿主口径，但它是工作材料；不把它扩大为正本 finding，也不回改以制造第二份权威。

## 8. 需求层与详设层边界

### 需求层必须补齐

1. 候选层与已选二维码生成层的状态矩阵，特别是 `blockers/statusDimensions` 的适用范围（S-01）。
2. 未开启、未选渠道与已选渠道失效三类原因的分层规则；前三者不能统一套“状态维度”措辞（S-01）。
3. V-13 的服务点 `VOIDED` 补集（N-02）。

### 可留给详设但必须有具体落点

- operation 与 usage dimension 二选一，只要不改变现有两个用途语义；不构成 finding。
- bounded read 的固定上限、超限 typed failure/no partial result 与用户呈现；当前 shared source 是 100 + owner invariant，不能静默截断。
- URL 同名参数处理、query+fragment 组合样例、合法 scheme 与同一生成/拼接住址；不需要新造 URL DSL。

### 未发现越界实现规定

区域/服务点表名、列名、operation 拼写、组件位置、资产 command API 等仍在正本 §9 正确下沉到详设；本轮没有把这些实现形态误提成需求缺陷。去掉区域的替代方案也已在需求层记录产品理由与技术最小性，边界清楚。

## 9. 证据与授权

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M/S/N=0/1/2
L1_ENGINEERING=S-01,N-01,N-02
L2_USER_VISIBLE=S-01
L3_UNVERIFIED=实现、契约生成、构建、测试、migration、backend acceptance、reset、DEV、seed、UAT、部署、Browser L2
SAME_ROOT_SCAN=business-channel read/candidate/status/write 全路径；11 类 statusDimensions/blockers；区域/服务点三态与唯一索引；扩展宿主/值存取；四类权限；V-1 至 V-16 全集；讨论稿 authority
DESIGN_GAPS=bounded read 上限与超限呈现；URL 同名参数追加/覆盖、query+fragment 组合与合法 scheme；S-01 的候选/生成状态矩阵需回到需求正本
EVIDENCE_TIER=STATIC_REPOSITORY_REOPENED_ONLY
AUTHORIZATION=仅当前需求正本第 2 轮静态评审；未授权修订需求、详设、实施、契约生成、构建、测试、reset、DEV、seed、UAT、部署或浏览器验证
```

第 2 轮 `NO-GO` 不是对 D-10、D-11 或第 1 轮已关闭事项的推翻；关闭 S-01 前不能把本需求当作详设/实施准入。S-01 需要 Dexter 对已选二维码遇到非 R-6.5 关联 blocker 时的用户可见行为作出产品裁决；其余 N-01/N-02 可在本批设计修订中直接收口。
