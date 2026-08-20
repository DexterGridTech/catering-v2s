# 统一列表分页 · implementation-facing 详设与实施计划 · 独立复核

- 日期:2026-08-18 · 评审:Claude · 会话:续接(非 fresh,已声明)
- 被审:`doc/plans/platform/2026-08-18-v2s-unified-list-pagination-implementation-design-codex.md`(585 行)
- 结论:**GO** · **M=0 · S=1 · N=2**
- **本轮全部为静态复核**:未运行 backend-acceptance、Testcontainers、DEV、reset、seed、HTTP、L2、UAT

---

## 1 · 数字复测结果(逐个独立复算,未采信话术)

| 声称 | 我的复算 | 判定 |
|---|---|---|
| registry/path shard 唯一 GET = **83** | **83** | `CONFIRMED` |
| 根级数组机械候选 = **64** | **72** | `REJECTED_WITH_EVIDENCE`,见 S-1 |
| 语义受审 = **50** | 45 + 5 = 50 | `CONFIRMED`(算术) |
| 主集合分母 = **45** | 43 + 2 = 45 | `CONFIRMED`(算术) |
| 分页成员 = **43** | 矩阵 **43 个 operationId,全唯一,无重复** | `CONFIRMED` |
| Page **25** / candidate **9** / Cursor **9** | P01–P25 = 25、C01–C09 = 9、U01–U09 = 9 | `CONFIRMED` |
| 主集合边界 = **2**(B01/B02) | §3.3 B01、B02 在列 | `CONFIRMED` |
| 整体聚合 Detail = **5**(B03–B07) | §3.3 B03–B07 在列 | `CONFIRMED` |
| 边界矩阵行数 = **7** | 7 行,B01–B07 齐 | `CONFIRMED` |
| B01 固定宿主类型 = **8** | **源码亲验:8 个** | `CONFIRMED`,见下 |
| ProTable **15** / Table **14** / Pagination **2** | 15 / 14 / 2 | `CONFIRMED` |

**83 的更正说明**:我在上一轮需求分析 review 中报的 **99** 是**按文件计数、未去重**的结果。
本轮以 operationId 去重后为 **83**,含与不含 `catalog-inventory.openapi.json` 根均为 83。
**83 正确,我上轮的 99 作废。**

**B01 = 8 的源码依据**(`ExtensionDefinitionService`):
`MANAGEMENT_HOST_TYPES = List.of(BRAND, TENANT, HEAD_COMPANY, STORE, CONTRACT, COMMERCIAL_GROUP,
REGION, PROJECT)` —— 源码固定闭集,恰好 8 个。B01 的「上界是 8 个固定 host type」成立。

## 2 · 业务裁定的源码前提 —— 我独立验证,成立

Dexter 裁定「凡数据库中整体保存、业务中整体读取/编辑/原子替换的聚合按非分页 Detail 处理」。
该前提在 `ExtensionDefinitionService` 中**逐条成立**:

- **整体保存**:`SELECT definitions::text, revision, updated_at_epoch_millis FROM
  extension.extension_definition ...` —— 整组定义存放在**单一列**中,不是行集合;
- **原子替换 + CAS**:`@Transactional public ExtensionDefinitionReadback replace(workspaceUuid,
  groupWorkspaceKey, hostType, expectedVersion, fields, ...)` —— 整体替换并带 `expectedVersion`;
- **revision 参与审计**:`AUDIT_FIELDS = Set.of("fieldDefinitions", "revision")`。

⇒ 这五个 operation **在物理上无法分页** —— 它是一个被整体读写的值,不是可切片的成员序列。
详设 §3.3 判为 Detail 聚合、明写「不伪造 Bounded」「不要求人为上界」,并写明
「若未来 Journey 变为逐行浏览,必须新开列表 operation,而不是偷偷复用这五个 Detail operation」
—— **与裁定逐条一致,没有错误要求分页,也没有人为设上限。** `CONFIRMED`

**我上一轮的 S-1 就此更正**:我当时观察到的「同族不同命」是对的,但我给的最小修法
(并入需求分析 §5.4、要求声明上界)**是错的** —— 那会把一个整体聚合按有界列表处理。
Dexter 的裁定给出了更正确的解。该条以本轮结论为准。

## 3 · 攻击面逐项结论

### 一 · 四个伪 cursor —— 详设的当前事实与我亲验的源码完全吻合

我打开源码复核(静态):

- `ProductionTagOwnerService.read` 形参含 `ObjectNode request` 却调用
  `readTags(dataNodeRef, brandRef, requestId)`,**request 被整个丢弃**;`readTags` 的 SQL 以
  `ORDER BY code LIMIT 100` 结尾,硬编码,且是该文件唯一的 `LIMIT`;
- `CatalogOwnerService.copyCandidates` 读 `keyword` 但不读 cursor/pageSize,SQL 以
  `ORDER BY code LIMIT ` + `"100"` 结尾,一个方法服务本地与品牌两个 operation;
- `CatalogOwnerService.loadDictionaryListing` 无 `LIMIT`/`OFFSET`,
  `data.putNull("cursor").put("total", entries.size())`;
- 四者的契约(解引用后)**请求接受 cursor、响应 `data` 声明 `cursor` 与 `total`**。

详设 U01/U02/U08/U09 行的「当前边界事实」与上述**逐条一致**,未美化也未夸大。`CONFIRMED`

**CP-02 的处置优于我上一轮给出的指令。** 我曾给「二选一:真实现 or 从契约删 cursor/total
并声明 Bounded」。CP-02 的 FORBID 明写「不删除 cursor/total 作为逃避;不新增 bounded 上界」,
形态理由为「删除会把真实截断变成合法的未知上界」。**这个判断是对的,采纳。**

### 二 · 整体聚合边界 —— 见第 2 节,`CONFIRMED`

### 三 · 内存分页 —— `CONFIRMED`

§6 下线表明确要求删除 `StoreCandidateTaskReadService` 的全量 `all`/`pageSlice`
**以及** `slice.set(safeSize - 1, selected)` 顶替补丁,并要求
`WorkspaceUserService` 的 `visible`/`enabledRoles` 两族 full-list slice 形状归零。
反向 proof 写明「pageSlice 和 slice.set 生产命中为 0;candidate scenario 证明页成员不被替换」。
该补丁是我上一轮主动发现、需求分析未载的连带事实,详设已正确吸收。

### 四 · 旧代码下线 —— `CONFIRMED`

§6 六个下线项均给出**最后消费者 / 删除后承接 / 反向 proof** 三列,
并要求「『删除为 0』必须按具体 token 和路径打印数量;没有条数不得写『全仓/唯一/零』」。
含公共 API 孤儿 record 的检查(「没有孤儿 public record;保留集合反向检查为 PASS」)。

### 五 · 测试覆盖 —— `CONFIRMED`,防假绿措施到位

§5.1 十二条场景,每条给出 identity / 覆盖 / fixture 最小条件 / request / businessOracle,
四要素非空。防假绿的关键点均已写入:

- fixture 明写「**超过单页**」「超过一页」(5 处),这是四个伪 cursor 的病灶 —— 数据量不过页
  场景必然假绿;
- oracle 明写「**total 不等于本页长度**」「total 等于完整匹配 count」——
  直接针对当前缺陷可证伪;
- 「**selected 不顶替当前页成员**」覆盖第三节那个补丁;
- B01 带**负夹具**(注入未知类型)并要求 exact set,且明写「不把 8 当数据库当前行数」;
- B03–B07 要求证明「整体聚合不被改造成分页列表、不重复 HTTP/SQL」。

§5.2 前端 focused test 八项与需求分析判据 9 对齐,且明确在不运行 L2 的前提下完成。
「DB 调用数只做诊断输出,不是 business oracle 或通过门」与 CLAUDE.md 一致。

### 六 · CP 结构与边界 —— `CONFIRMED`

**CP-00 至 CP-16 共 17 个,17/17 五要素齐全**(RECALL、本项失败条件、不变量、FORBID、验证)。
抽查 CP-02,RECALL 给出具体 owning source 与 acceptance identity,失败条件可证伪
(「四个 scenario 不能翻过一页」),另附形态理由。

契约同步边界正确:CP-02 验证写明「先运行 CP-00 场景设计,再成套刷新
OpenAPI/generated/edge/consumer」,符合「场景设计先于 contract 修改」。

两个产品待裁项**均未被代裁**:§1.3 单列;B02 目标边界写「不能代裁;保持 `DEXTER_DECISION`,
不在本批改契约或 owner」;P02 审计 Modal 写「pageSize 选择由 Dexter 待裁,不提前改 UI」。`CONFIRMED`

未发现授权数据库迁移、新数据模型、新 read model、DEV、reset、seed、L2 或 UAT。

### 过度设计 / 变脆 —— `REJECTED_WITH_EVIDENCE`,不存在

§4.1 沿用需求分析的方向,复用 AntD/ProTable 而非再造分页控件;
§4.4 明确「不属于本 foundation 的边界」;§2.1 四模式不试图统一所有集合;
CP-09 专门保留「已经真实合规的 Catalog/Inventory Cursor」,即**不为统一而改动本来就对的东西**。

---

## S-1 · 机械候选清单不完整:64 应为 72,漏掉的 8 条含全部四个伪 cursor

- **严重度**:S · **状态**:`CONFIRMED` · **需要 Dexter 裁决**:否
- **位置**:详设 §3.1「机械判定式…当前得到 64 个根级数组候选」;需求分析第 112 行起的 64 条清单

**仓内事实**:我以详设自述的同一判定式(「200 响应 `$ref` 解引用后,root object 的直接属性中
至少有一个 `type: array`」)独立扫描 33 个契约文件,得 **72 个**。文档清单为 **64 条、唯一、
无重复**,且**反向差集为空** —— 即它是真实集合的**真子集**。漏掉的 8 条全部来自
catalog-inventory:

`getOperationsBrandCatalogCopyCandidates` `[items]`、`getOperationsCatalogDictionary` `[entries]`、
`getOperationsLocalCatalogCopyCandidates` `[items]`、`getOperationsProductionTags` `[entries]`、
`getOperationsCatalogItems` `[items]`、`getOperationsInventoryTargets` `[items]`、
`getOperationsCatalogItem`、`getOperationsCatalogNavigation`。

**根因(技术推论,非仓内明文)**:catalog-inventory 的响应 schema 只能经
`contracts/openapi/catalog-inventory.openapi.json` 完成解引用;仅走 `paths/` shard 扫描时
这些 `$ref` 解不开,根级数组因而检测不到。我用两种扫描口径对照复现了这个差异
(含根 72 / 仅 shard 58)。

**后果**:§3.1 明写该数「只用于证明扫描覆盖」,需求分析第 112 行明写清单「只证明根级数组扫描
没有丢成员」。**它恰好在最关键的成员上丢了** —— 前四条正是 CP-02 的全部对象。
任何依据这份清单复核覆盖的人,会得出「四个伪 cursor 不是根级数组 operation」的错误结论。

**⚠️ 工作清单不受影响**:§3.2 的 43 成员矩阵**包含全部四个伪 cursor**(U01/U02/U08/U09),
当前边界事实准确,CP-02 覆盖完整。因此**不会漏做**,缺陷限于取证件本身。故判 S 不判 M。

**最小替代方案**:以含 catalog-inventory 根的口径重跑该扫描,把 64 更正为 72 并补全 8 条;
43/45/50 与全部 CP **保持不变**。不需要改代码、契约或实施计划。

## N-1 · 同根提示:shard-only 扫描口径可能影响仓内其他普查

- **严重度**:N · **状态**:`CONFIRMED`(仅就本次现象) · **需要 Dexter 裁决**:否

S-1 的根因不是笔误,是**扫描口径的系统性盲区**:凡以 `contracts/openapi/paths/` 为唯一入口的
静态普查,都会看不见 catalog-inventory 的响应形状。建议在 S-1 修正时**顺带记录该口径陷阱**,
避免后续普查重复踩。本轮未扫描其他普查脚本,不主张影响范围。

## N-2 · 上一轮 review 的 S-1 已被裁定取代,且其修法有误(自我更正)

- **严重度**:N · **状态**:`CONFIRMED` · **需要 Dexter 裁决**:否

`doc/review/platform/2026-08-18-v2s-unified-list-pagination-requirements-review-claude.md` 的 S-1
建议把 5 个 ExtensionDefinition 并入需求分析 §5.4「需单独边界判定」。
经本轮源码亲验(第 2 节),它们是**整体读写的聚合**,按有界列表处理是错的。
Dexter 裁定与本详设 §3.3 的处理正确。**该条以本轮为准,原修法作废。**

---

## 证据边界

| 档位 | 本轮 |
|---|---|
| 契约静态解析 | 33 文件,operationId 去重后 83 个 GET,逐个 `$ref` 解引用 |
| 源码静态亲验 | 4 个伪 cursor 的 owner 实现、`ExtensionDefinitionService` 的整体读写与 CAS、`MANAGEMENT_HOST_TYPES` |
| 文档结构核验 | 17 个 CP 的五要素、43 成员矩阵去重、7 行边界矩阵、12 条场景四要素、6 项下线反向 proof |
| 运行期 | **零**。未运行 backend-acceptance、Testcontainers、DEV、reset、seed、HTTP、L2、UAT |

⚠️ **本报告全部结论均为静态证据。** 「四个伪 cursor 会静默截断」是基于源码与契约的技术推论,
不是观测到的生产故障;「详设能解决它」是对设计文本的判断,不是对实现结果的验证。

## 授权边界

本结论仅评价该详设与实施计划可否作为实施输入。
`GO` 的含义是:分母(除 S-1 的取证件外)可复算、聚合边界与裁定一致、四个伪 cursor 与两个内存
分页族的处置可执行、测试设计足以防假绿、下线项带反向 proof、两个产品待裁项未被代裁。
S-1 建议在实施前顺手修正取证件,不构成实施阻断。

**不授权**实施、契约修改、生成物修改、迁移、DEV、reset、seed、HTTP、L2、UAT 或下一 Roadmap step。
按操作模型,实施前仍需完成 fresh 独立子 agent 的两阶段设计期盲审。
