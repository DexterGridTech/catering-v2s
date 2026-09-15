# 扩展字段列表展示与类型化搜索需求 · Claude 第一轮结果作者处置

```text
REVIEW_KIND=AUTHOR_INTAKE
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=CODEX_AUTHOR_INTAKE
SOURCE_REVIEW=USER_PASTED_CLAUDE_REVIEW
EXTERNAL_VERDICT=NO-GO
EXTERNAL_M_S_N=2/4/3
AUTHOR_VERDICT=NOT_A_REVIEW_VERDICT
EVIDENCE_TIER=STATIC_SOURCE_READ
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NONE
```

## 1. 处置原则

本文件是作者对 Claude 第一轮独立静态 review 的逐条 intake，不替代 Claude 的 verdict，也不把 Claude 的结论当作授权。每个 finding 都重新打开当前需求正本、当前源码、OpenAPI、当前 active performance policy 和本轮命中的项目 memory；只接受有当前字节支撑的部分，区分需求缺口、事实错误、产品语义和仍未验证的运行事实。

本轮只修改需求正本和 review 材料，不修改代码、契约、数据库、测试、脚本、依赖，不启动 DEV、reset、seed、backend acceptance、browser L2、UAT 或部署。需求正本已更新为 `STATUS=REQUIREMENTS_REVISED_FOR_DESIGN_REVIEW_ROUND_2`，实现授权仍为 false。

本轮已执行并读取四条六维 recall 的命中原文及 sourceRefs：

```text
scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger review
scripts/context/recall-memory --task-kind design --domain contract --consumer-face operations-admin --owner contract --impact contract --trigger review
scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger review
```

## 2. 当前同根扫描与事实复核

- 八类宿主仍由 `ExtensionHostTypes.VALUES` 与 OpenAPI `ExtensionEntityType` 共同确认：`BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`CONTRACT`、`COMMERCIAL_GROUP`、`REGION`、`PROJECT`。
- 平面消费面分母为十个：运营后台品牌、经营租户、总公司、门店、合同五页；平台组织概览品牌、经营租户、总公司、门店四页；平台合同概览一页。
- 树消费面为两个：运营组织架构树和平台组织架构树；三类树宿主不生成表格动态列。
- 候选选择器已单独扫描：运营 `useOrganizationCandidates` / `getOperationsOrganizationCandidates`、合同 `useContractStoreCandidates` / `getOperationsContractCandidates`、邀请目标候选、平台 `usePlatformOrganizationCandidates` / `getPlatformOrganizationCandidates`、品牌目录复制候选。它们是命令输入或关系选择，不是实体列表/搜索页；候选控件被排除，但所在实体列表页仍在分母内。
- 当前树路径是完整快照模式：运营 `OperationsOrganizationTaskReadService.hierarchy()` 调用 `OrganizationHierarchyService.list()`；两个前端当前均对已加载树做名称/编码本地筛选。`OrganizationHierarchyService.page()` 是已有分页 owner 能力，但不是当前树 endpoint 的集合模式。
- 当前 active `contracts/policy/backend-performance-cp05-calibration-report.json` 已逐 operation 列出并标记 `READY`：`getOperationsOrganizationHierarchy`、`getOperationsOrganizationStores`、`getOperationsContracts`、`getPlatformOrganizationOverviewPage`、`getPlatformOrganizationHierarchyTree`、`getPlatformContractOverviewPage`。因此“这些目标 operation 没有登记/覆盖”的子结论被当前字节否定；该报告的数据库操作计数仍不能证明 JSONB 扫描、延迟或规模成本。
- `ExtensionDefinitionService.validJsonValue()` 与 `BusinessEntityValueSupport.validJsonValue()` 均以 `field.options().contains(json.asText())` 校验 `SELECT`，而当前 OpenAPI `options` 是字符串数组，没有 option key/label 分离。

## 3. 逐条 finding 处置

### M-01：SELECT 选项值与显示文本混淆

判定：`CONFIRMED`。

当前证据：`contracts/openapi/components/extension/extension.schemas.json` 的 `options` 是字符串数组；`ExtensionDefinitionService.java` 的 `validJsonValue()` 在 `SELECT` 分支按字符串包含校验；`BusinessEntityValueSupport.java` 重复同一规则。原需求正本旧文字把“选项值”和“选项文本”写成两个概念，确实会让实现者分叉成稳定 key/label 契约或字符串即值。

处置：已修改需求正本第 5.2、6.2、7、9、11.5、13 节：明确一个 `options` 字符串同时是持久化值、显示文本和当前搜索身份；修改既有选项字符串按删除旧字符串加新增新字符串处理，不迁移历史实体值；历史值在可见动态列按原始字符串保留，当前 SELECT 搜索只允许当前选项，不能命中已移除字符串。稳定 option key/label 分离被明确为未来独立数据契约需求，不在本需求隐式扩展。

通用失败模式：把可变显示文本误当稳定身份。根因层是定义契约与存量值语义未分层。有限适用范围是当前 `SELECT` 字符串数组模型；反例是未来引入稳定 option key 的新契约。最小修复是文档冻结字符串即值并显式接受改名后的历史孤立；防再犯落点是需求正本第 7、9、13 节与第二轮 review 的 SELECT 历史值核验项。

### M-02：`searchable => listDisplay` 耦合

判定：`CONFIRMED`。

当前证据：原需求第 4.1 节称两个配置独立，第 8 节又规定树宿主的 `listDisplay` 不产生列；如果用定义层规则强制 `searchable=true` 同时 `listDisplay=true`，三类树宿主会出现没有消费面的“列表展示=是”，且配置状态与实际行为不一致。搜索表单本身已是当前条件的可见承载。

处置：已修改需求正本第 2、4.1、6.4、8、11、13 节：两个开关完全独立，允许 search-only；平面结果通过既有名称、编码、详情动作和结果集承载，不虚构摘要列；树只消费 `searchable`，忽略 `listDisplay`。这采用当前需求的最小、可解释语义；未来若产品改变搜索结果承载方式，应另立产品语义，不在实现中自行耦合。

通用失败模式：把定义配置规则强行套到没有同一消费面的异构宿主。根因层是配置语义和呈现语义耦合。有限适用范围是八类宿主跨平面/树的动态消费；反例是一个只有平面表格列消费的单一宿主。最小修复是独立开关加宿主消费矩阵；防再犯落点是需求正本第 3.1、4.1、6.4、8、13 节与第二轮 review 的树反例核验项。

### S-01：树集合形态与本地筛选前提缺失

判定：`PARTIALLY_CONFIRMED`。

确认部分：原需求把“平面分页的当前页本地过滤风险”直接推广到树，并绝对禁止当前完整快照的本地筛选，缺少 collection boundary；这会与当前树 endpoint 的完整快照形态冲突。当前运营 owner 的 `hierarchy()` 明确组装完整 `HierarchySnapshot`，平台树 persistence 也构造完整树；两端前端当前均在快照内本地筛选。`OrganizationHierarchyService.page()` 确实存在，但不能据此把当前树 endpoint 事实改写成分页树。

不确认部分：不存在足够证据证明本需求现在必须新增树 owner 搜索接口；复用 `page()` 是未来有界树的可选载体，不是当前完整快照模式的必需实施方案。

处置：已修改需求正本第 2.4、3.2、8、10.1、11.4、13 节：冻结当前树为一次完整授权快照，允许在这一完整集合内本地筛选/导航，禁止逐节点请求和把不完整快照当完整集合；当前树不使用 `total/page` 语义。未来若树变为分页/有界返回，必须由 owner 计算命中集合并返回祖先闭包，不能对部分页面本地筛选后宣称完整搜索。

通用失败模式：未声明集合形态就把分页规则或全量规则绝对化。根因层是 collection boundary 未进入需求。有限适用范围是组织树读取；反例是五类平面分页列表。最小修复是按当前完整快照与未来有界快照分支写清 owner/consumer 责任；防再犯落点是需求正本第 8 节和第二轮 review 的集合完整性反例。

### S-02：候选选择器未明确排除

判定：`PARTIALLY_CONFIRMED`。

确认部分：原需求第 1 节的“所有列表或搜索消费面”措辞确实可能把候选控件纳入，原第 12 节也没有逐面给出边界。

不成立部分：按用户已经明确的实际范围“所有有扩展字段实体的列表和搜索页”，候选下拉、Autocomplete、关系选择器和命令抽屉对象选择不是实体列表/搜索页，不应扩展成十余个命令输入面；候选接口的搜索是挑选已知关系目标，不是按扩展属性查询实体记录。因此 Claude 提议“排除候选并写理由”成立，不需要把候选加入功能分母。

处置：已修改需求正本第 1、3.3、12、15 节：列出当前候选来源和 operation/symbol，排除候选控件本身，明确合同列表页面仍在 `CONTRACT` 平面分母中。该处置不会漏掉实体列表中的核心候选筛选，也不会改变候选 owner 契约。

通用失败模式：按接口词面或“支持搜索”把关系选择误计为实体查询页面。根因层是页面任务边界未冻结。有限适用范围是当前候选/命令输入控件；反例是合同实体列表自身。最小修复是按页面任务而非 endpoint 名称定义分母；防再犯落点是需求正本第 3.3、12 节与第二轮 review 的候选反例核验项。

### S-03：定义漂移没有恢复路径

判定：`CONFIRMED`。

当前证据：实体列表 readback 携带的 `extensionRuleRevision` 是实体写入时采用的规则版本；扩展定义本身另有当前定义 `revision`。两个 app 分别消费定义，当前需求旧文字只有错误提示和重试入口，没有处理“重试仍携带已停用/不可搜索条件”的闭环。

处置：已修改需求正本第 10.2、10.3、11.5 节：要求以同一当前定义快照生成列、搜索项和 owner 查询；响应或等价页面 metadata 标识逻辑 `definitionRevision`，不得用实体 `extensionRuleRevision` 替代；发生定义漂移时重读定义、重建列/搜索项、清除失效动态条件、保留有效核心条件和重新验证通过的动态条件，回到第 1 页并显示可见提示，禁止带旧条件死循环重试。

通用失败模式：把写入时规则版本当作查询时定义版本。根因层是跨 app 定义快照和实体事实版本未区分。有限适用范围是动态定义驱动的列表/树读；反例是没有动态定义的纯核心列表。最小修复是 query/render 共用定义版本并给出一次性重建恢复；防再犯落点是需求正本第 10.3 节与第二轮 review 的禁重试循环核验项。

### S-04：缺少规模与查询成本锚点

判定：`PARTIALLY_CONFIRMED`。

确认部分：原需求确实没有要求 implementation-facing 详设写预期规模、增长、JSONB 谓词计划、投影成本或适用验证记录；现有 DB operation-count 基线不能代表 JSONB 扫描成本、延迟或任意规模均可接受。

被当前字节否定的子结论：Claude 称目标列表/树 operation 没有在预算中单独登记。当前 `contracts/policy/backend-performance-cp05-calibration-report.json` 已按 operationId 列出上述六个读取 operation，且均为 `budgetReadiness.status=READY`，分别有 `maxDatabaseOperationCount`；因此这部分为 `REJECTED_WITH_EVIDENCE`。`contracts/policy/backend-performance-operation-counts.json` 是总量/面计数源，不是逐 operation 的预算明细，不能据此反推未覆盖。

仍未验证的事实：真实数据规模、无索引 JSONB 谓词在目标规模下的代价、查询计划和时延影响仍属 `UNVERIFIED_REQUIRES_EVIDENCE`，本轮没有运行动态验证，也没有为需求臆造数值阈值。

处置：已新增需求正本第 5.4 节，并在第 11.5 节加入验收锚点：详设必须逐读取面写规模/增长、查询计划和成本方案比较；focused/backend acceptance 分别比较核心与动态条件并记录适用证据；现有 operation-count budget 只作既有机械基线，不升级为扫描/延迟通过结论。

通用失败模式：用调用次数代理扫描成本。根因层是非功能维度没有进入设计输入。有限适用范围是动态 JSON/多表 read；反例是固定小集合且无 JSON 谓词的读取。最小修复是增加规模/计划/成本记录要求而不提前指定索引或阈值；防再犯落点是需求正本第 5.4、11.5 节与第二轮 review 的 nonfunctional inventory。

### N-01：树无关分支表述不清

判定：`CONFIRMED`。

处置：已改为“树搜索只展示命中节点；命中节点的祖先仅作为路径保留；不得因保留祖先而将无关分支当作命中结果”，并在树验收中重复该边界。

### N-02：IA-03 历史基线与当前八类事实漂移

判定：`CONFIRMED`。

处置：未改写历史 IA-03；已在需求正本第 15 节注明 IA-03 仅作为历史交互基线，其旧五类宿主清单和旧 `displayOrder` 表不覆盖当前八类源码事实，也不得恢复旧列；只复用与当前源码不冲突的生命周期、owner、并发和交互原则。

### N-03：`Select/开关式布尔控件` 二义

判定：`CONFIRMED`。

处置：已改为两个独立的 `Select（是/否）`，与 BOOLEAN 搜索的三态 Select 明确区分。

## 4. 尚未升级为通过的证据

以下事实仍是 `L3_UNVERIFIED`，不因需求修订或静态源码阅读变成用户体验或运行通过：

- 动态列和动态搜索项尚无新的批准 IA/交互工件，实际渲染、折叠、横向布局和可见文案仍待 implementation-facing design/UI review。
- 动态 JSONB 条件在代表性规模下的查询计划、扫描成本和延迟尚未测量。
- 运营合同/门店列表扩展条件的最终 HTTP query 参数名、平台组织树后端扩展值 read shape 尚未冻结；本需求只冻结业务语义，不伪造 URL/字段契约。
- 当前 active operation-count report 的 READY 事实不等于新增动态条件后的预算或性能通过；实现后仍需按适用授权执行 focused/backend acceptance，业务与 cleanup 分开判读。

## 5. 第二轮硬停止边界

本处置仍属于同一 `REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914` 的 DESIGN review，Claude 第一轮已经消耗 `REVIEW_ROUND=1`；下一次只能是 `REVIEW_ROUND=2`，`REVIEW_ROUND_LIMIT=2`。第二轮只核验本处置后的真实当前字节和上述未决/未验证边界，不得以换 reviewer、改文件名或局部措辞启动第三轮。

第二轮需要重点证伪：

1. SELECT 字符串即值、改名历史值保留但不匹配当前选项的语义是否与当前契约闭合；
2. `listDisplay`/`searchable` 独立且树忽略 `listDisplay` 是否仍存在跨宿主矛盾；
3. 当前树完整授权快照、本地筛选、祖先闭包以及未来有界树分支是否表达准确；
4. 候选控件排除是否没有误排除实体列表自身的核心候选筛选；
5. definition revision 与 entity `extensionRuleRevision` 的恢复关系是否闭合，是否仍可能死循环；
6. active performance report 的 operation 覆盖与“规模/扫描成本仍未证实”是否被准确区分；
7. N-01、N-02、N-03 的文字修复及八类宿主、十个平面面、两个树面的 same-root scan 是否仍完整。

若第二轮仍有未决产品语义或新增设计歧义，应按 `DEXTER_DECISION` 报告，不得由 review 文案自行扩展范围；不得再召集第三轮。
