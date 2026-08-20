# 统一列表分页需求分析 · 独立对抗式复核

- 日期:2026-08-18 · 评审:Claude · 会话:续接(非 fresh,已声明)
- 被审:`doc/plans/platform/2026-08-18-v2s-unified-list-pagination-requirements-analysis-codex.md`(406 行)
- 前轮 subagent 因工具超时未形成 verdict,本轮从当前源码与契约重新核验,未采信作者数字
- 结论:**GO** · **M=0 · S=1 · N=2**

---

## 0 · 先答:这份分析要解决什么,解决对了没有

**问题抓对了。** 它抓的不是「某个表格少一个页大小下拉」,而是**同一个集合在 contract、owner、
前端三层的边界表达互相矛盾**:契约声明 cursor 而 owner 忽略输入并固定截断;owner 声称 page
而实际全量读取后内存切片;前端标准表格、手工 cursor、无分页元数据混在一起。

这是真问题,不是凑出来的。我独立复核了它的两条 M,**全部成立**,而且实情比它写的更具体。

**方案方向也对。** §7.4 明写「基于仓内已采用的 AntD/ProTable,而不是再造分页控件」,
§7.6 明写「Relay 只采 opaque cursor 概念、不引入 GraphQL;OData 只借语义、不整体迁移」,
§10 明写「不应把所有数组统一改成分页,也不应把所有 cursor 统一改成 page」——
Codex 问的「是否过度设计」「foundation 是否试图统一所有列表」,文档**自己已经挡住了**。

§7.5 的查询复用边界与 `project-memory/practices/read-model-granularity` 的判据一致
(同 scope 同 freshness 同字段闭包才可共享;字段闭包不同不得因为「也包含 X」而复用)。
§9 把两项产品语义单列并声明不代裁(审计 Modal 的 pageSize、`StoreCandidates` 的处置),
**产品判断与技术事实已分离**,未混入详设。

**不是为了凑 GO。** 全文没有把静态复核说成运行期验证,§10 明写「本报告没有代码修改,
也没有动态验收结论」。

## 1 · 独立复算结果

| 项 | 文档 | 我独立复算 | 判定 |
|---|---:|---:|---|
| `ProTable` 物理实例 | 15 | **15** | 一致 |
| `Table` 物理实例 | 14 | **14** | 一致 |
| 表格实例合计 | 29 | **29** | 一致 |
| 独立 `Pagination` | 2 | **2** | 一致 |
| 数组响应候选 | 63 | **73**(任意层口径) | 口径差,见 N-2 |
| 主分母成员 | 45 | **45 条唯一值,反向差集为空** | 一致 |
| 45 内分布 | 25/9/9/2 | 17+8=25 / 9 / 9 / 2 | 算术自洽 |

前端计数为两个 app 的 production `.tsx`,已排除 `__tests__`、`.test.`、`generated`。

**§5 清单无编造成员**:45 条逐一能在当前契约中定位,反向差集为空。

## 2 · 文档两条 M 的独立复核 —— 均 `CONFIRMED`

### M-1(4 个伪 cursor)`CONFIRMED`,且实情更明确

**契约侧**(解引用后逐个确认,首次未解引用是我的假阴性,已更正):

| operation | 请求参数 | 响应 `data` 字段 |
|---|---|---|
| `getOperationsCatalogDictionary` | `dictionaryKind,dataNodeRef,parentEntryRef,cursor,pageSize` | `dictionaryKind,entries,cursor,total,generation` |
| `getOperationsProductionTags` | `dataNodeRef,cursor,pageSize` | `entries,cursor,total,generation` |
| `getOperationsLocalCatalogCopyCandidates` | `dataNodeRef,keyword,cursor` | `sourceScope,targetScope,items,cursor,total,generation` |
| `getOperationsBrandCatalogCopyCandidates` | `dataNodeRef,keyword,cursor` | `sourceScope,targetScope,copySourceAvailable,items,cursor,total,generation` |

四者**请求接受 cursor、响应声明 cursor 与 total**,伪 cursor 的前提成立。

**owner 侧**:

- `ProductionTagOwnerService.read` 形参含 `ObjectNode request`,却调用
  `readTags(dataNodeRef, brandRef, requestId)` —— **request 整个丢弃**;`readTags` 的 SQL 为
  `... ORDER BY code LIMIT 100`,**硬编码**,是该文件唯一的 `LIMIT`。
- `CatalogOwnerService.copyCandidates` 读取 `keyword` 但不读 cursor/pageSize;SQL 以
  `ORDER BY code LIMIT ` + `"100"` 结尾,硬编码,一个方法同时服务两个 operation。
- `CatalogOwnerService.loadDictionaryListing` 无 `LIMIT`/`OFFSET`,
  `data.putNull("cursor").put("total", entries.size())`。

**后果比文档写的更具体**:客户端拿到 `total: 100` 与 `cursor: null`,得到的结论是
「一共 100 条、没有下一页」,而真实成员可能是数千。这不是缺控件,是**契约在撒谎**。

### M-2(2 个内存分页族)`CONFIRMED`,并追加一条连带事实

- `StoreCandidateTaskReadService.candidatePage`:`List<Candidate> all` 全量物化 →
  `pageSlice(all, safePage, safeSize)` Java 切片 → `all.size()` 作 total,
  `selectedId` 保留逻辑再次 `all.stream()` 全量扫描。
- `WorkspaceUserService.candidates`:`ORGANIZATION` 分支 `visible.size()` + `pageSlice(visible, …)`;
  `ROLE` 分支 `enabledRoles.size()` + `pageSlice(enabledRoles, …)`。

**文档未写的连带后果**(我主动发现):`StoreCandidateTaskReadService` 中
`if (slice.size() == safeSize) slice.set(safeSize - 1, selected);` —— 当选中项不在本页时,
**直接顶掉本页最后一条**。这是内存分页逼出来的补丁,真 SQL 分页不需要它,
代价是该页静默少一个成员。建议详设把它列为 M-2 的验收反例。

---

## S-1 · 5 个无界 `*ExtensionDefinition` 被排除在分母外,与同族处理不一致

- **严重度**:S · **状态**:`CONFIRMED` · **需要 Dexter 裁决**:否
- **文档位置**:§3.2 排除口径「固定配置」、§5 成员清单、§9 主动排除项

**当前契约事实**(我独立扫描 33 个契约文件、240 个 operation、99 个 GET 得出):

以下 5 个 GET 返回无界数组且**无任何边界参数**,均不在 45 之内、也不在 §9 的排除说明里:

| operation | path 参数 | 返回数组 |
|---|---|---|
| `getOperationsOrganizationStoreExtensionDefinition` | `groupWorkspaceKey,expectedContextVersion` | `definitions` |
| `getOperationsOrganizationHierarchyExtensionDefinition` | 同上 | `definitions` |
| `getOperationsOrganizationBusinessEntityExtensionDefinition` | 同上 | `definitions` |
| `getOperationsContractExtensionDefinition` | 同上 | `definitions` |
| `getExtensionDefinition` | `groupWorkspaceKey,entityType` | `definitions` |

**不一致点**:同族的 `getExtensionEntityCatalog`(同样返回无界 `items`)**被收进 §5.4**,
并被要求「contract/owner 应明确这是闭集,而不是普通 `Page`」。
上述 5 个是**同一类东西**(管理员自定义的扩展字段定义),却被完全排除。

**技术后果**(推论):§8 判据 7「所有非分页反例必须有 owner-side 上界或业务形状证据」与
判据 10「任何『全量返回』必须写出上界、消费者闭包和长期增长责任人;没有这些内容不得标为
bounded」是本文最有力的两条守门判据 —— 但它们只作用于 45 个成员。这 5 个在分母外,
**详设按 §8 逐条执行也永远触及不到它们**。扩展字段定义的条数由管理员行为决定,
仓内没有声明上界。

**最小替代方案**:把这 5 个并入 §5.4「无分页但需要单独边界判定」(该节由 2 个变为 7 个),
或在 §9 明写排除理由与其上界依据。**二选一即可,不需要改任何代码或契约。**

## N-1 · 四模式中 Tree/Detail 在 45 分母上恒为空集

- **严重度**:N · **状态**:`CONFIRMED` · **需要 Dexter 裁决**:否
- **文档位置**:§2.3 四模式划分、§8 判据 1

§8 判据 1 要求「45 个主分母成员逐一标为 Page、Cursor、Bounded 或 Tree/Detail」。
但 tree 与 detail 类 operation(如 `getOperationsOrganizationHierarchy`、
`getPlatformOrganizationHierarchyTree`、各 `*Detail`、各 `*UserAccount`)**在 §3.2 阶段就已被
排除出 45**。因此「Tree/Detail」这个分类项在 45 上恒为空集。

**后果**:分类法与分母错位。不影响正确性,但会让详设的分类工作产生一个永远用不到的桶,
也让读者以为 45 里包含树形集合。

**最小替代**:§8 判据 1 改为「逐一标为 Page、Cursor 或 Bounded」,
并在 §2.3 注明 Tree/Detail 是**分母外**的形态说明,不是 45 的子类。

## N-2 · `63` 不可精确复算(口径未写明判定式)

- **严重度**:N · **状态**:`PARTIALLY_CONFIRMED` · **需要 Dexter 裁决**:否
- **文档位置**:§3.2

我以「GET 且 200 响应解引用后任意层级存在 `type: array` 属性」为判定式,
扫描 33 个契约文件(catalog-inventory 根 + `paths/` 下 operations-admin 19、platform-admin 10、
public 3),得 **99 个 GET,73 个含数组属性**,与文档的 63 不符。

差异可解释:我的口径是任意层级,收进了 `getWorkspaceRole [capabilityKeys,pageAccessKeys]`、
`getWorkspaceInvitation [roleNames]`、`getCurrentPlatformSession [capabilities]` 等明显非列表的
嵌套标量数组。文档的 63 应是更紧的判定式(顶层 `data` 数组),但**文档没有写出该判定式**。

⚠️ 这不构成错误 —— **45 那一层是可复算的,而且完全对上**(45 条唯一值、反向差集为空)。
63 只是中间量。但按「分母必须可复算」的一贯要求,建议 §3.2 补一句精确判定式。

---

## 逐项回答评审目标

| # | 目标 | 结论 |
|---|---|---|
| 1 | 正确样板是否被正确抽象 | `CONFIRMED` 是。§2.1/§2.2 从业务含义出发(用户要能看到总数、选页大小、跳页),不是从控件属性出发 |
| 2 | 三层分母是否完整可复算 | `PARTIALLY_CONFIRMED`。前端与 45 完全可复算并对上;63 不可精确复算(N-2);45 本身漏 5 个同族无界成员(S-1) |
| 3 | 四种集合模式划分是否合理 | `CONFIRMED` 合理,但 Tree/Detail 与分母错位(N-1) |
| 4 | 是否过度设计 | `CONFIRMED` 否。明确复用 AntD/ProTable,明确拒绝 OData/GraphQL/新 UI 库,明确拒绝「统一所有列表」 |
| 5 | 是否遗漏会致截断/全量/语义错误的问题 | `PARTIALLY_CONFIRMED`。两条 M 抓得准;遗漏见 S-1;另追加 `slice.set` 顶替一条的连带事实 |
| 6 | 是否混入需 Dexter 裁决的产品语义 | `CONFIRMED` 未混入。§9 已单列两项并声明不代裁 |

**「后端是否被错误抽象成万能 repository」**:`REJECTED_WITH_EVIDENCE` —— 不存在。
§7.3 与 §7.5 明确要求分页 foundation「不由分页 foundation 取得写、锁、事务或 FK 权限」,
且「任何跨 owner 组合必须保留目标 owner 的读取边界」。

**「需求分析是否越界写成详设或实施计划」**:`REJECTED_WITH_EVIDENCE` —— 未越界。
§7 是需求方向与不变量,§8 是验收判据,均未指定实现形态、文件、类名或批次。

**「商品元数据低基数是否足以成为 bounded」**:`DEXTER_DECISION` 的前置已由文档正确处理 ——
§8 判据 5 明写「必须明确是 bounded 还是 Page,不能继续由当前数据量默认为无分页」,
判据 10 要求 bounded 必须写出上界与责任人。**这是正确的处理**:不拿当前基数当结论。

---

## 证据边界

| 档位 | 本轮 |
|---|---|
| 契约静态解析 | 33 文件 / 240 operation / 99 GET,解引用后逐个判定 |
| 源码静态亲验 | 4 个伪 cursor 的 owner 实现、2 个内存分页族、前端控件计数 |
| 运行期 | **未运行任何** DEV/reset/seed/HTTP/L2/UAT/Testcontainers,不作任何运行期结论 |

⚠️ 本轮全部为**静态复核**。文档所述的「数据量增长后截断」是基于源码的技术推论,
不是观测到的生产故障。

## 授权边界

本结论仅评价该需求分析可否作为后续详设输入。**未授权**详设、实施、契约修改、生成物修改、
DEV、reset、seed、HTTP、L2、UAT 或任何范围扩展。
`GO` 的含义是:方向、抽象与两条 M 均成立,可作为详设输入;S-1 应在详设锁定成员表前闭合。
