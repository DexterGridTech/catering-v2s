---
title: 商品目录与门店轻库存三阶段实施详设 · Claude 最终独立复核
reviewTarget: DESIGN
scope: implementation-facing 三阶段详设（P1 定义 / P2 后台 API / P3 前端 L2）
verdict: NO-GO → GO（10. 整改后定向复核，hash fc52e190…）
findings: M=1 / S=1 / N=1（N-01 值已确认，剩可调整性设计）
reviewedArtifact: doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md
reviewedSha256: 0d56d535c2e3154441c6f942c1423a7d708a33f9317de0cd0f3dc8d36f77dd9f
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅 implementation-facing 设计复核；不授权实现、OpenAPI/policy/generated 实改、schema/migration、seed/reset、DEV/UAT/L2、runtime 或 Git
priorRound: Round 2 独立对抗审查 NO-GO（M=2/S=1/N=0），已达两轮硬上限；本复核不重置也不冒充第三轮
createdAt: 2026-08-06
---

# 三阶段实施详设 · 最终复核

## 0. 结论

**`NO-GO` — `M=1 / S=1 / N=1`。**

**Round 2 的三项 post-remediation 全部真实关闭**，我逐项独立复算而非采信自报；
42 operation 的两个 membership exact cover、26/100、18/43、17 差异、89 IA-ID、8 IU
全部复算一致。**就 Round 2 的分母而言，这份设计是合格的。**

判 `NO-GO` 的原因是 Dexter 本轮提出的一条**设计限定**当前不满足，且缺口面覆盖 40/42 个 operation：
每个接口该做什么逻辑、什么条件抛什么异常、调用链路如何、正常路径几次 DB 完成——
这四项在本设计中只有 2 个 operation 有部分（仅链路，无 DB 次数），其余皆无。
详见 `M-01`。**这不是"做错了"，是这份文件按 Dexter 的标准还没写完。**

## 1. 这份设计到底解决什么问题，解决了没有

Dexter 要求先回答业务问题再看清单，我先独立判断。

**要解决的问题**：把已收口的需求与 IA 变成**三个阶段各自可执行、且相互之间无法漂移**的施工图。
真正的难点不是"写清楚要做什么"，而是**防止三阶段各自发明自己的真相**——
契约阶段定的形状被后台私自加字段、后台定的错误被前端重新解释、
前端到最后才发现读模型不够用。这是分阶段交付最常见的失败模式。

**解决得如何**：我认为主体解决了，有三个设计决定是真正起作用的。

**其一，两维交付模型（§2.1）。** IU 纵轴不重切，三阶段横轴各自声明对每个 IU 的义务。
这解掉了我在话术里提的最要紧一条——IA 的 `IU-01..08` 是按 surface 纵切、
而 Dexter 的三阶段是按层横切，两者不对齐就无法回答"这一阶段交付了哪些 IA-ID"。
Codex 没有重编 IA，而是加了一根横轴做多对多，代价最小。

**其二，assertion 的单一 primary verifier（§2.1 末）。**
「一个 IA-ID 可产生多个 assertion，每个 assertion 只有一个 primary verifier
（`CONTRACT_STATIC`/`API`/`L2`），同一需求可跨层出现但不得由 API 和 L2 对同一 assertion
重复声称完成」，并由 P1 checker 对 `(iaId, assertionId, primaryVerifier)` 做 exact-set 与 orphan 检查。
这精确解决了我提的"同一需求点不该两层重复验、也不该两层都不验"。

**其三，seed 与 test 数据严格分层（§3.1 第 4 项、§3.6）。**
我在话术里指出"很多阻断场景用 seed 根本造不出来"（无 `headCompanyRef` 的门店、
同编码但单位一克一个的物料、能触发闭包超限的商品）。设计把测试数据定为
**独立于 seed 的异常/边界 fixture**，并让 API 与 L2 共享同一 canonical catalog、
两阶段记录同一实际 SHA。这条落实了。

**是不是只为了凑 GO？** 我判断不是，最硬的反证是 §7 line 682-683：

> 兼容矩阵中三类"无结构判别位"不是产品决策缺口，而是明确 `NOT_APPLICABLE`；
> 禁止把它们改成人为结构阻断。若 Dexter 仍要求九类各有真正结构阻断，
> **必须先改变需求兼容矩阵，不能由测试倒逼业务语义。**

**主动拒绝把 6 类阻断凑成 9 类**，宁可让数字看起来"不整齐"——这是反向操作，不是凑数。
同样的自律还见于 §2.2「P1 的 `DEFINED` 只表示形状冻结，不冒充业务实现」。

**但这条自律恰好卡住它自己的一处**，见 `S-01`。

## 2. 我的独立复算（不采信任何自报值）

| 复算项 | 结果 |
| --- | --- |
| 三份文件 SHA-256 | 主设计 `0d56d535…`、IA `db7e622a…`、granularity manifest `11f5aea0…`，**三份逐字符一致** |
| 绑定输入是否陈旧 | 需求稿 `dd4232e2…`、我的 IA 评审 `3f2a7bbb…` **均与当前字节一致**；且我确认该 hash 下我的评审**已含 §9 的 C-16/17/19 裁决**，绑定不陈旧 |
| operation exact-set | 42 |
| pageKeys/capabilityKeys membership | 5 行 → 展开 **42 项、唯一 42、零重复零缺失零越界**，对 `1..42` **exact cover 成立** |
| problemCodes membership | 15 行 → 展开 **42 项、唯一 42、零重复零缺失零越界**，**exact cover 成立** |
| API 分母 | case vector `[1,7,1,1,9,10,1,3,2,1,6,4,3,6,2,2,2,18,2,2,2,2,1,4,3,5]` → **26 definitions / 100 cases**，与声明一致 |
| L2 分母 | case vector `[6,1,1,1,4,2,7,2,2,2,2,2,2,2,2,2,2,1]` → **18 definitions / 43 cases**，与声明一致 |
| 17 条差异 | 设计列出的 17 个 D 编号与需求稿 §5.9 的实际章节标题**exact-set 一致**（含 `D-13b`/`D-13c`），无多无少 |
| 89 IA-ID / 8 IU | 均有归属；`IU-08` 持 89 IA-ID→assertion→scenario exact-set；三阶段全完成才可判 `CLOSED`，`PENDING`/悬空 source/未绑定 assertion 一律 fail closed |
| C-16/17/19 转录 | §7 三行与我评审 §9 记录的裁决**逐字一致**（左树恒列 0 + 新建可见置灰且原因为"权益域尚未开放"；create 必填即时校验、update 无 code、零引用整体作废重建；StockTarget 无自身 code 且 tuple 为 `(targetType,itemCode,skuCode?)`） |

**语义约束抽验**（设计自己声明的四条，我逐条验算）：
create 组不含 void error **成立**；create 组不含 `VERSION_CONFLICT` **成立**；
普通 GET 组不含 version error **成立**；asset 组不继承 catalog lifecycle error **成立**。

## 3. Round 2 三项 post-remediation 的复核

### 3.1 42 个 operation 是否逐项冻结 —— **真实关闭**

Round 2 的指控是"以宽泛错误 superset 冒充契约真相"。当前设计的解法是：
prose 表保留 `PR/EW/DR` 与 `E-R/E-W` 作人读摘要，但**规范源是
`contracts/policy/catalog-inventory-assertion-matrix.json`，每行必须直接存展开后的
`pageKeys[]`/`capabilityKeys[]`/`problemCodes[]`，不得存摘要别名**（§3.3.1）。

**关键问题是：读这份设计能不能唯一确定每个 operation 的五项取值？** 我的判断是**能**：

- `request/response`：42 行逐行给了 component 名，且声明这就是 P1 component exact-set；
- `primary scenario`：42 行逐行给了 `API-xxx`；
- `capabilityKeys`：membership 表 + `EW→EDIT_CATALOG_LIBRARY`、`DR→READ_INVENTORY_ADVANCED_DIAGNOSTICS`、GET 为空，**可唯一展开**；
- `pageKeys`：5 行 membership，**可唯一展开**；
- `problemCodes`：15 行 membership，每行给的是**完全展开的确切码表**，不是 profile 别名。

两个 membership 我都独立验了 exact cover（见 §2 表），成立。
所以"JSON 尚未存在"不构成缺口——**设计已经把 JSON 的内容唯一确定了**，
P1 只是把它落成机器可读形式并加 checker。这是 implementation-facing 设计应有的形态。

### 3.2 四个 GET 的 typed `voidAvailability` —— **真实关闭**

§3.3.2 line 286-290 明写：`CatalogItemDetail` 的 action availability、
`CatalogNavigationView` 的每个 category node、`CatalogDictionaryView` 的每个 entry、
`ProductionTagPage` 的每个 row **携带同一 typed
`voidAvailability={canVoid,blockingReferences[],dependentFacts[]}`**，
由各 owner **批量**判断，**禁止前端计算、逐行 N+1 或新增第 43 个 endpoint**，
且 transition 仍在事务内重算而不信任读时结果。

四项要求（点击前有具体原因、无第 43 端点、无前端判断、无 N+1）**逐条对上**。
`CI-API-006` 的 10 个 case 与 `CI-L2-010` 的 2 条浏览器责任也与之配套，
且明确 L2 "不重复 owner 判断算法"。

### 3.3 CRUD policy 只有 P1 一个写入阶段 —— **真实关闭**

§5.1 line 619：「CRUD policy 的两个互斥 surface 分母和反例由 **P1 单一写入**；P3 只能只读核验其
entry」；§8 line 687：「P1 **第一项**登记 CRUD policy 设计例外」；
`IU-01` 横轴（line 63）：P1「定义并落 policy 例外」、P3「**只读核验** P1 policy entry；落 admin catalog」。
三处一致，无第二写入点。

这同时闭合了我上一轮 IA 评审的 `N-04`（policy 文本与已批准 IA 的窗口期矛盾）——
它被排到了 P1 的第一项，窗口最短。

## 4. Findings

### S-01｜SKU 结构指纹是对冻结需求矩阵的实质增补，但未按设计自己立的规矩登记

**位置**：§3.6 line 439-441。**依据类型**：仓内事实（需求稿原文 vs 设计原文）+ 内部一致性。

设计写：

> 商品的结构判别位包含 shape 与 **SKU 结构指纹**，后者是排序后的
> `skuCode -> sorted(attributeCode,valueCode)` 映射；它不新增第十类对象，也不改变 SKU 判同 tuple。

而**需求稿 §5.6.6 的九类兼容矩阵中，「商品」的结构判别位只有「商品形态」一项**
（`| 商品 | 商品编码 | 商品形态 | 名称、短名、说明、图片、标签、所属分类 |`）。

**增补本身我认为是正确的，且填补了需求稿的真实漏洞。** 反例：
总公司「拿铁 / LATTE-01」的 `SKU-001 = (CUP_SIZE, SMALL)`，
门店同编码同形态的「拿铁」其 `SKU-001 = (CUP_SIZE, LARGE)`。
按冻结矩阵，同编码 + 同形态 → 判定可复用门店版本；
而总公司 BOM 行「`SKU-001` 消耗 14 克咖啡豆」会被重写指向门店的 `SKU-001`——
**14 克挂到了大杯上**。这与"消耗单位不一致把 10 克变成 10 个"是同一类静默损坏，
而九类矩阵**没有任何一类能拦住它**（`ProductSku` 本身不是九类之一）。

**问题在于它没有被登记。** 设计在同一节 line 683 对自己立过规矩：

> 若 Dexter 仍要求九类各有真正结构阻断，**必须先改变需求兼容矩阵，不能由测试倒逼业务语义**。

这条纪律它对"三类无结构位"守住了（拒绝伪造阻断），
**却在「商品」这一处越过了同一条线**——新增了一个冻结矩阵里没有的结构判别位，
而没有走"先改需求兼容矩阵"这一步。需求稿 §5.9 亦有明文：
「后续任何一轮讨论若再产生新差异，**必须追加到本表**，不得只写在正文里」。

**影响**：需求稿与详设对「商品」的结构判别位说法不一致。
后续任何按需求稿实施或评审的人会少一个判别位；
而按详设实施的人多一个——两边都自认为合规。同时 `CI-API-018` 的
"六类真实 structural block（商品负例使用同 SKU 编码但属性组合冲突）"
这条 fixture 的业务依据在需求稿中找不到出处。

**最小修复**：把它当作**设计期发现的需求缺口**处理，二选一——
① 回写需求稿 §5.6.6 商品行（结构判别位改为「商品形态 + SKU 结构指纹」）并在 §5.9 追加登记；
② 若 Dexter 认为不必回写，则在本详设中显式标注
「本项为设计期对冻结兼容矩阵的增补，已获 Dexter 确认」，不要以既有矩阵的口吻陈述。
**建议 ①**，因为需求稿是"唯一需求真相"，让它与详设不一致会持续产生歧义。
**这条需要 Dexter 确认是否回写需求稿。**

### M-01｜逐接口的逻辑、条件→异常、调用链路与正常路径 DB 次数缺失（覆盖 40/42 个 operation）

**位置**：§3.3.1 的 42 行 assertion matrix、§4.3 写事务、§4.4 查询与性能。
**依据类型**：仓内事实（全文清点）+ Dexter 2026-08-06 明确要求。

Dexter 的要求原话是：

> 每个接口应该做什么逻辑，什么情况下抛出什么样的异常，调用链路应该是怎么样的，
> 正常情况下应该通过几次 DB 可以完成操作，**不是 DB 预算，而是设计限定**。

这四项是**设计限定**，属于本文件的职责，不是 P1 的产出，也不是运行期的阈值。
逐项清点当前状态：

**其一，接口内部逻辑步骤：42 行 matrix 只给了 `owner/coordinated owners`、
`auth`、`request→response`、`errors`、`primary scenario` 五列，没有任何一行说明"这个接口依次做什么"。**

**其二，调用链路：只有 2/42 有，且是散文级。** §4.3 给了
`saveOperationsCatalogItem`（同一 `REQUIRED` 内 catalog 复核/写、inventory 复核并写
StockTarget/BOM、各 owner 写 audit、任一步失败全回滚）与
`executeOperationsBrandCatalogCopy`（三 owner 各自重建判断切片、协调器合并重算 plan/digest、
依次创建/复用 production tags→catalog 字典/商品/SKU→inventory StockTarget/BOM、逐对象重写 refs）。
**其余 40 个 operation 没有调用链路。**

**其三，条件→异常的映射全文没有。** 设计给的是每个 operation 的
`problemCodes[]` **集合**，但没有说**在什么条件下抛其中哪一个**。
对多数 GET 这不要紧，但对 `27`/`28` 这类带 9–12 个错误码的复制 operation，
"什么时候是 `STRUCTURE_INCOMPATIBLE`、什么时候是 `REFERENCE_MAPPING_UNRESOLVED`、
什么时候是 `OWNER_REFERENCE_LEAK`"**完全没有定义**。
实现者只能自己发明判定顺序，而**判定顺序会改变用户看到的错误**：
同一次失败的复制，先判引用映射还是先判结构不兼容，报出来的原因是不同的。

**其四，正常路径 DB 次数：0/42。** 全文只有 4 处定性的"避免 N+1"，
以及 §4.4 的"日志记录 `database operation count`/duration"——**记录而非限定**。

**为什么这构成 M 而不是 S**：

1. **这份文件自称 implementation-facing。** 它把 request/response、错误集合、
   scenario、owner 都冻结到了 exact-set 级别，却把"接口内部怎么做"整块留空——
   实现者在最容易分歧的地方反而拥有最大自由度。
2. **API 测试抓不住链路与次数。** 26/100 个 case 验的是**行为**（给定输入得到什么输出/错误），
   不验调用链路与 DB 往返。两个实现者可以同时通过全部 100 个 case，
   而一个用 3 次 DB、另一个用 30 次，一个先判结构、另一个先判映射。
3. **需求侧本就有这个目标却无人承接。** 需求稿 §4.1 引 v1 真库分析：
   v4 商品详情触及 ~9 张表、新模型降到 ~4 张，"详情查询触及表数 9→4"是被写进需求的收益。
   详设不写正常路径 DB 次数，这条收益就没有落点，也无法在 P2 验证。
4. **跨三 owner 的写路径尤其危险。** `saveOperationsCatalogItem` 与
   `executeOperationsBrandCatalogCopy` 虽有散文链路，但没写清 owner 调用顺序对失败语义的影响
   （例如 asset claim 在 catalog 写之后失败会怎样），也没写 DB 次数。

**最小修复**：在 §3.3.1 的 assertion matrix 上**为每个 operation 增加四列**（或新增一节逐行给出）：

- **逻辑步骤**：该接口依次做什么（校验 → 载入 → owner 判断 → 写 → readback 这一级粒度即可）；
- **条件→异常**：`problemCodes[]` 中每个码的触发条件，并**明确判定顺序**
  （尤其 `22/23/27/28` 这四个多错误码的复制 operation）；
- **调用链路**：edge → coordinator → 哪些 owner、按什么顺序、事务边界在哪；
- **正常路径 DB 次数**：happy path 的往返次数与构成（例如"1 次分页主查 + 1 次库存摘要批量 + 1 次计数"）。

**不必对 42 个都写同样详细**：GET 类可以按族给出（如"单资源 GET = 1 次主查 + 1 次 availability 批量"），
但**列表、详情、六区、四个写动作、两类复制、whole-save 这些必须逐个给**。

同时建议把"正常路径 DB 次数"写进 P2 exit 断言（复用既有 `databaseOperationCount`），
使设计限定成为**可失败的门**而不只是文档里的数字。

### N-01｜两个复制上限：值已由 Dexter 确认，但"方便调整"需要设计成单一真相

**Dexter 2026-08-06 裁决**：「复制上限先按照这个来（`selected=20` / `closure=500`），
**后续如果要调整，也要方便调整**。」

**值的部分就此确认**，`§7` 的"阻断 P1 数值冻结"可以解除，`§10` 第 3 项确认清单可以关闭。

**但"方便调整"是一条新的设计要求，当前设计还不满足。** 现状是：
`§4.5` 说 P2 loader"两个 limit 从 contract 动态取值"，
而 `CI-API-016`/`CI-API-017` 的 fixture 是"边界值成功 + `limit+1` 触发 typed failure"。
如果这两个数字进入冻结契约形状，改值就等于契约变更——要重新生成、重新字节比对、
并重做这两组 fixture。**那不叫方便调整。**

**仓内既有惯例正是反面教材。** 我实测同一个分页上限 `100`
**硬编码散落在至少 4 个 owner 文件**：`AuditHistoryPage.java:8`、
`ExtensionAuditHistoryService.java:14`、`OrganizationAuditHistoryService.java:19` 与 `:30`。
复制上限若照此办理，值会同时出现在 owner 校验、fixture、UI 提示文案与错误消息四处，
改一次要动四处且没有门守着。

**最小修复（建议的可调整形态）**：

1. **契约冻结的是"结构"而不是"数值"**——两个错误码
   `COPY_SELECTED_ITEMS_TOO_LARGE`/`COPY_CLOSURE_TOO_LARGE` 存在、
   以及响应携带 `{actual, limit}` 这个形状，进契约；
2. **数值只有一个声明点**，owner 校验、UI 提示文案、fixture 生成三方**都从它读**，
   不得各自内嵌字面量；
3. **fixture 与 case 断言写成值无关的形式**——"取当前 limit 成功、`limit+1` 返回 typed failure
   且回报实际计数"，这样改值不触发 fixture 重做；
4. 在 P1 exit 加一条机械检查：**这两个数字在生产源码、fixture 与文案中的字面量出现次数为 0**
   （全部经声明点读取）。这条是纯计数，不涉及业务语义。

这样改值就是改一处配置，其余自动跟随——才真正满足 Dexter 的"方便调整"。

## 5. 我确认正确、不应回退的部分

- 两维交付模型：IU 纵轴不重切 + 三阶段横轴声明义务，解决了 IU 与阶段的对账口径；
- 每个 assertion 单一 primary verifier + `(iaId, assertionId, primaryVerifier)` exact-set/orphan 检查；
- seed 与 test 数据严格分层，共享同一 canonical fixture catalog 且两阶段记录同一实际 SHA；
- 42 operation 的两个 membership exact cover，以及"create 无 void error / GET 无 version error /
  asset 不继承 catalog lifecycle"三条语义约束；
- `voidAvailability` 随既有 GET 批量返回，不新增端点、不前端计算、不 N+1，transition 仍在事务内重算；
- CRUD policy 例外为 P1 第一项、单一写入，P3 只读核验；
- 复制逻辑在 P2 完全闭环、P3 只验交互，不用浏览器穷举算法；
- §7 拒绝把 6 类阻断凑成 9 类，并明写"不能由测试倒逼业务语义"；
- `APP_COORDINATOR` 不写 `x-owner-module`、不解释 capability，三 owner 各自判断。

## 6. 授权边界

本 `GO` **仅表示当前 implementation-facing 设计字节通过复核**，可进入 Dexter 的
§10 确认清单与后续实施排期。**不构成任何实施授权**：
不授权实现、OpenAPI/policy/generated 实改、schema 或 migration、seed/reset、
DEV/UAT/L2、runtime 部署或 Git 操作。

两轮 Codex 独立对抗审查已达硬上限，**本复核不重置轮次，也不冒充第三轮 Codex 审查**。
`S-01` 涉及是否回写需求稿，属 Dexter 裁决；`S-02` 属 Codex 可在既有批准边界内自主补充。
两个复制上限初值仍待 Dexter 确认。

---

# 10. 整改后定向复核（2026-08-06 终态）

**复核对象**：主设计 `fc52e190…3272b1d`、operation design contract `7de7028e…438204d1d`、
granularity manifest `1ff48dc7…cbcff5eb85f`、intake `0d0d0b89…8160fded`、
回写后的需求稿 `21cfaa7c…d4c9067a` 与 IA `08be6b7b…3942101354`。
**六份全部逐字符一致。**

## 10.0 结论：`GO — M=0 / S=1 / N=1`

M-01、S-01、N-01 **三条全部真实关闭**，且 N-01 与 M-01 的整改形态**优于我提出的最小修复**。
新增一条 `S` 与一条 `N`，均属"可在 P1 开工前补齐"，不阻断本设计定稿。

## 10.1 M-01 —— 关闭，且落地形态比我建议的更严

新增 `backend-operation-design-contract.json`，42 条记录，每条固定四字段
`logicSteps / callChain / conditionToProblem / normalPathDbOperations`。我的独立复算：

| 复算项 | 结果 |
| --- | --- |
| 四字段非空 | **42/42 通过** |
| `logicSteps` / `callChain` 的 `order` 从 1 连续无缺 | **42/42 通过** |
| **`conditionToProblem` 键 ↔ `problemCodes[]` exact-set** | **42/42 完全相等**，零多零少 |
| 每个 problemCode 均有非空触发条件 | **通过** |
| `precedence` 1..N 连续无重复 | **42/42 通过** |
| `normalPathDbOperations.breakdown` 存在且逐 owner 求和 == `expectedCount` | **42/42 算术自洽** |
| `callChain` 形态多样性 | 42 个 operation 呈 **16 种不同链路**，非单一模板 |

**exact-set 那条正是我在话术里点名的最强机械检查**，它堵住的是我上一轮报的最实质缺口——
`27`/`28` 两个复制 operation 各带 9 至 12 个错误码却没定义触发条件与判定顺序。
现在每个码都有条件与 `precedence`，**判定顺序被钉死**，实现者无从各自发明。

**"设计限定而非通用上限"的定性也做对了**：
`normalPathMeaning` = "Exact normal-fixture design declaration, **not a universal DB budget,
performance claim or runtime ceiling**"；`countUnit` = `REQUEST_COMPLETION_DATABASE_OPERATION_COUNT`
直接绑既有观测字段。这正好调和了我担心的
`MEASURED_PERFORMANCE_NOT_STATEMENT_COUNT` 与既有记忆"不创建全局 SQL 计数门"那句。

**数字本身也经得起业务推敲**（我抽验而非只看自洽）：
商品列表 3 次（context+catalog+inventory，无逐行查询）、
**商品详情 4 次**（context+catalog+inventory+fulfillment-production）——
**恰好落在需求稿 §4.1 引 v1 真库分析的"详情触及表数 9→4"这条收益上，该目标终于有了落点**；
盘点 8 次可完整拆解（读 target/balance/config/幂等 + 写 ledger/balance/audit + context）；
品牌复制执行 22 次为最高，且其假设显式写明
"graph-size variation follows the same breakdown formula"——
**即批量形状不随闭包增大而变**，正面回答了我关于"500 个对象时是否退化为逐对象写"的疑问。

## 10.2 复制语义 —— 五项全部关闭，且语义层面正确而非仅字段存在

- **preflight 以 200 返回 blockers**：`preflightOperationsBrandCatalogCopy` 的 `problemCodes[]`
  **不含** `STRUCTURE_INCOMPATIBLE` / `CONSUMPTION_UNIT_INCOMPATIBLE` / `REFERENCE_MAPPING_UNRESOLVED`
  ——这三者只出现在 execute，证明 blockers 是 200 的内容而非预检的错误；
- **STALE 与普通 version conflict 区分**：`executeOperationsBrandCatalogCopy` 含
  `STALE_COPY_PREFLIGHT` 且 **不含 `VERSION_CONFLICT`**——两条路径不重叠即是最干净的"区分"；
- **品牌复制含 organization owner**：`coordinatedOwners` 实含 `organization`；
- **`ASSET_NOT_READY`**：`createOperationsCatalogItem` 与 `saveOperationsCatalogItem` 均含；
- **负库存异常归位**：`count`/`increase` **不含** `NEGATIVE_STOCK_NOT_ALLOWED`，`adjust` **含**。
  这在业务上是对的：覆盖式盘点与正数增加不可能造成负库存，只有有向调整可能。

## 10.3 S-01 —— 关闭

需求稿 §5.6.6 商品行已改为「**商品形态**；**SKU 结构指纹**（按 `skuCode` 排序后，
逐项绑定排序后的 `(attributeCode,valueCode)` 组合）」，§5.9 已加 `D-16`。
**18 条差异在需求稿、IA、详设三份文档中是同一套 exact-set**
（我逐份提取并做集合比较，双向零差异），非仅数量相等。

## 10.4 N-01 —— 关闭，形态与我提的四条建议逐条对应

`copyLimitPolicy` 声明：`sourcePath = contracts/policy/catalog-inventory-copy-policy.json`、
`selectedItemLimit=20`、`closureObjectLimit=500`、
`contractShapeOnly = "COPY_*_TOO_LARGE and {actual,limit}"`、
`consumerRule = "Owner validation and fixture generation load this policy; UI uses server readback;
**no consumer embeds 20 or 500**"`。

单一声明点、契约只冻结结构不冻结数值、三方消费者动态读取、字面量零内嵌——**四条齐备**，
避开了我举证的仓内反面惯例（分页上限 `100` 硬编码散落在 4 个 owner 文件）。

## 10.5 测试用例设计是否合理（Dexter 本轮重点）

**方法上是对的：case 数量派生自已知分母，而不是凭感觉给。**
七形态→`CI-API-002` 7 例；九个 surface→`CI-API-005` 9 例；
八类有编码对象→`CI-API-006` 10 例；库存详情六区→`CI-API-011` 6 例；
九类兼容矩阵→`CI-API-018` 18 例（9 可确认复用 + 6 真实结构阻断 + 3 具名 N/A）；
五个代表商品图→`CI-API-026` 5 例。**最高风险项拿到最多 case，比例正确。**

**我逐条追踪了需求里最容易漏、最容易静默出错的九项，全部有归属**：
消耗单位不一致→`CI-API-019`（双向）；无 `headCompanyRef`→`CI-API-023` + `CI-L2-005`（4 例真值表）；
`PRODUCIBLE` 保留不派生→`CI-API-001`；`HAS_SKU` 非归档判据→`CI-API-013`
（启用→HAS、仅停用→HAS、仅归档→NO_SKU，与我在 v4 源码核到的语义逐条对应）；
形态准入反例→`CI-API-014`；两个上限→`CI-API-016/017`；全图重写→`CI-API-020`；
TOCTOU→`CI-API-021`；高级诊断整区不渲染→`CI-L2-013`；权益壳置灰→`CI-L2-007`。

**分层判据是明写的**而非逐条拍脑袋：业务判断/集合/排序分页/owner/事务/幂等/版本/闭包/重写/
typed error 由 API primary verify；只有视觉呈现、入口存在性、局部交互、dirty/overlay/focus、
浏览器状态保持由 L2。配合"每个 assertion 只有一个 primary verifier"，
**既不会两层重复验，也不会两层都不验**。

**三个 delivery unit 的 red fixture 是真变行为的**，不是关键词变异：
U01「删掉一个库存详情区或预检 version vector 必须失败」、
U02「预检后改动源必须在任何写之前 `STALE_COPY_PREFLIGHT`」、
U03「移除诊断权限后证明第六区**与该 HTTP 请求都不存在**」——
最后一条查的是请求不发生，比只查 DOM 缺失强。

## 10.6 三阶段是否自洽

自洽，三处机制互相咬合：**IU 纵轴不重切 + 阶段横轴声明义务**解决了对账口径；
**单一 primary verifier + `(iaId, assertionId, primaryVerifier)` exact-set/orphan 检查**防止跨层重复宣称；
**fail-closed 回退纪律**（P2 发现字段或 fixture 缺口必须显式重开 P1，不得在后台私加 DTO）
防止阶段间私自补真相。三阶段全部完成才可对 89 IA-ID 判 `CLOSED`。

## 10.7 新增 finding

### S-02｜`logicSteps` 是 42 个 operation 共用的三步模板，未逐接口体现差异

**位置**：`backend-operation-design-contract.json` 各 operation 的 `logicSteps`。
**依据类型**：仓内事实（我对 42 条做骨架与文本去重统计）。

- **42/42 使用完全相同的三步骨架** `[VALIDATE_TRUSTED_INPUT, LOAD_DECIDE_EXECUTE, COMPLETE_READBACK]`；
- 126 条 `action` 文本**去重后只有 13 条**；第 1 步的文本 **42 个字字相同**；第 3 步只有 2 种；
- 第 2 步有 10 种，其中最大一桶 **15 个写操作共用同一句**
  「Validate immutable/scope/version facts, execute the owner command, audit and return owner readback」，
  另一桶 **4 个库存动作共用一句**。

**复杂操作其实是区分开的**（whole-save 独有、两类复制独有、两个 preflight 独有、两个资产操作独有），
所以这不是全面失守。**但两处共用掩盖了真实差异**：

1. `moveOperationsCatalogCategory` 的 `problemCodes` 含 `HIERARCHY_CYCLE`——
   环检测是独有逻辑，而它的 `logicSteps` 与普通 update 一字不差；
2. 四个库存动作的语义差异（**盘点是覆盖、增加是增量、调整是有向、快捷配置不改余额**）
   被压成一句，而"人工调整必须与库存增加分开、避免把纠错动作伪装成现场新增库存"
   正是需求与 IA 花力气确立的设计点。

**为什么仍判 S 而不是 M**：四个字段中另外三个**确实逐接口区分**——
`conditionToProblem` 42/42 exact-set 且带 precedence（`HIERARCHY_CYCLE` 的触发条件与优先级就在里面）、
`callChain` 有 16 种形态、`normalPathDbOperations` 逐 owner 分解。
**真正的判别逻辑被 `conditionToProblem` 承接了**，实现者读完整条记录仍能正确实现；
风险只在于**只读 `logicSteps` 一栏的人会以为这些操作是同一回事**。

**最小修复**：给上述两桶补齐差异化步骤即可，不必 42 条全部重写——
`moveOperationsCatalogCategory` 增一步"重算祖先路径并拒绝成环"；
四个库存动作各自写明覆盖／增量／有向／仅配置的语义与是否触碰余额。
其余同族共享（七个集合 GET、七个详情区 GET）是合理的，不必拆。

### N-02｜89 个 IA-ID 到 44 个 scenario 的映射，完整性有门、质量无约束

`§2.1` 声明 P1 checker 对 `(iaId, assertionId, primaryVerifier)` 做 exact-set 与 orphan 检查，
**这能保证没有 IA-ID 落空**，但 **89 → 26+18 的具体映射不由本设计确定**，留给 P1。
exact-set 检查挡得住"漏映射"，挡不住"懒映射"——
例如把 40 个 IA-ID 一起挂到 `CI-API-005` 名下，checker 依然全绿。

**影响**：不产生错误行为，但会让"89 IA-ID 全部 CLOSED"这句话的证明力打折。
**最小修复**：要求每条 assertion 写明它验证的**具体业务行为**（而非仅引用 IA-ID），
并在 P1 review 时抽样核对；这一条**只能评审，不要做成 checker**
（判断"assertion 是否真的对应该 IA-ID 的语义"属业务语义，机器无法判定）。

## 10.8 授权边界

本 `GO` **仅表示 implementation-facing 设计终态字节通过复核**。
不授权 implementation、OpenAPI/policy/generated 实改、schema 或 migration、seed/reset、
DEV/UAT/L2、runtime 部署或任何仓库控制动作。
`S-02`、`N-02` 属 Codex 可在既有批准边界内自主处置，不需要新的产品裁决。
两轮 Codex 独立对抗审查已达硬上限，本复核不重置轮次也不冒充第三轮。
