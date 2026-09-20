# 前后端复用性与一致性收敛 · 正式需求稿（第 4 版）

```text
DATE=2026-09-18
DOC_KIND=REQUIREMENTS
STATUS=REQUIREMENTS_DRAFT
VERSION=4（经一轮独立子 agent 对抗审查（三个并行 reviewer）与三轮 Codex 需求 review 后重写；第 4 版为结构性修改，见 §5.0）
AUTHOR=Claude（外部评审位）
SCOPE=apps/backend、apps/frontend，以及规范与模板载体
BASIS=当前仓库字节静态核验
AUTHORIZED=只写本需求稿与只读源码核查
NOT_AUTHORIZED=生产代码、契约生成、迁移、构建、测试、reset、DEV、seed、Browser L2、UAT、部署
IMPLEMENTATION_AUTHORITY=false
```

## 0. 版本说明与自我校正

第 1 版被一轮独立对抗审查（三个并行 reviewer，三个攻击面）判为 `FACT_CHECK=FAIL`（17 条）、`SOLUTION=UNSOUND`（6 条）、`COVERAGE=INCOMPLETE`（16 条）。我逐条重开源码核验，**多数指控成立**。本版的主要修正：

| 第 1 版的错误 | 实测更正 |
| --- | --- |
| 回执服务 13 个 | **10 个**。第 1 版用 `*Receipt*.java` 检索，把 Persistence、ServiceSql 与测试文件混入 |
| 含 `response_json` 的表 8/15 | **10/15**。第 1 版的 `grep -A6` 截断了表体 |
| 「一个月里被又违反了五次」 | 服务增量 **+2**、表增量 **+4**。「五次」无对应实测，该句删除 |
| 回执载荷「第三种形态」 | 共 **4 种**：`response_json`(10)、`response`(3)、`readback_json`(1)、无载荷(1) |
| 同名异类异常是「当前就存在的实际缺陷」 | **不是**。`ContractProblemAdvice` 第 438–454 行的同一个 `@ExceptionHandler` 同时列了两个类，映射是全的。它是**命名陷阱** |
| 台账 FE-076「弹窗错误不可见」是真实缺陷 | **已修复**。三处均已在 Modal 内渲染 Alert |
| 三份模板「只提规范的名字」 | 实施详设模板第 47–71 行**已有一张 17 行的横切机制对账表**并逐行点名规范条目。真实缺口是**表里没有 §3-K 那一行** |
| D-1「作废」是新裁决 | **不是**。§3-K-7 状态表早已定义「作废 / 错误红」。本轮是既有规则被违反后的重申 |
| 「标记删除」分母 = 2 个文件 | 前端 **19 个生产源文件**、后端 **2 处**直接发出该用户文案。其中 `operations-admin/src/app/api/operationsProblemFeedback.ts:149` **不在 `features/**` 下**，第 2 版的判据范围会漏掉它 |
| 三态硬编码「至少 10 处」 | `src/main` 下 `"ENABLED"` 129、`"DISABLED"` 52、`"VOIDED"` 95，**21 个文件硬编码全三值** |
| 续行常量 1815 个 / 61 文件 | 那是 `*ServiceSql` 子集。**声明**处实测为 **2194 个常量 / 76 个文件**（第 2 版一度写成 148 个文件，那是把引用点也算进去了，已再次更正） |
| foundation 前置「已满足，不再是阻塞项」 | 文件是 `build.gradle.kts`；JDBC 用的是 `implementation` 而非 `api`，**不向下游传递导出**，前置只满足了一半 |
| keyset 9 个文件 | 严格 `(order, ref)` 谓词 **6 个**，放宽口径 **8 个** |
| 上一批评审「两轮 DESIGN、三轮 implementation」 | DESIGN **5 轮**；implementation 独立 reviewer 至少 5 位 |

**另有一条重要的时效性更正**：第 1 版引用 `StoreServicePointService` 作为 N+1 与偏移分页的例证。该文件**已被修复**——现用 keyset 谓词，`readQrSnapshot` 提到循环外，上移下移可用性改为纯算术。**它现在是正例，不是反例。**

这一连串错误本身说明一件事：**评审位在没有通读规范、没有逐条复算的情况下，同样会把旧账当新发现、把历史台账当当前缺陷。** 实施位当然更容易。这强化了本稿的结论，但不能用它来掩盖第 1 版的不严谨。

## 1. 问题的真正形态

### 1.1 根因是分域的，不是一个

第 1 版把根因统一写成「规范存在但无约束力」。对抗审查用三组字节反证了它，我接受部分反驳并改为**分域判定**：

**后端横切机制 —— 根因是「缺目的地」。**
`backend-coding-standard.md` 第 292–294 行已经写明：「根因不是纪律，是位置……一个尽职的工程师在这个约束下唯一能做的就是复制」。三组新鲜字节支持这个判断而不是「约束力」假说：

- 规则写下后新增的两张回执表（`sales_menu.sales_command_receipt`、`organization.store_service_point_command_receipt`）**根本没有建对应的 `*CommandReceiptService`**——逻辑直接内联。若是「复制更便宜」，应该看到第 9、10 份拷贝；实际看到的是**另起炉灶写更小的东西**，这是「没有可插入的家」的特征。
- 凡 foundation 已有家的地方，同一批交付在**零机器门**的情况下自觉接入了（`AdminDetailActionMenu` 16 个消费点，foundation 被 199 个文件 import）。约束力假说预测这里也该漂移，实际没有。
- 前置只满足了一半：`modules/foundation/build.gradle.kts:18` 的 JDBC 是 `implementation`，而同文件第 15–17 行的其他依赖是 `api`。若底座在公开签名上暴露 `JdbcTemplate`，当前形态不足。

**前端交互一致性 —— 根因是「强制引用无人检查」。**
`frontend-coding-standard.md` §3-K-8（第 545–547 行）要求「每份 UI-bearing Journey、交互稿和 implementation-facing design 都必须逐字引用本节」。实测上一批三份 UI 工件对 `3-K` 与「管理后台交互一致性」的命中数**全为 0**，且该批全部 10 份评审件同样 0 命中。

而缺口的精确形状是：**实施详设模板第 47–71 行已有一张 17 行的横切机制对账表**，逐行点名 `前端规范 §3-B/§3-E/§3-D/§3-G/§3-F`、`后端规范 §2-D/§2-B/§1-D`、`charter §5-C`，并在第 83–84 行写明「后一类没有任何机器会替你检查，**是本表存在的主要理由**」。上一批确实填了这张表——**表里没有 §3-K 这一行，所以 §3-K 从未被引用。**

**这个诊断可以被证伪**：若下一批在「已有目的地」的地方仍然绕过，则「约束力」假说成立，再补门不迟。本稿据此把元治理收到最小。

### 1.2 增长的事实（已复算）

§2-E 在 2026-08-16 登记：8 个服务 / 11 张表 / 6 种 scope-key。
本轮实测：**10 个服务 / 15 张表 / 4 种回执载荷形态**。

新增的 4 张表里，**2 张连服务都没建**（sales_menu、store_service_point），**1 张用了第四种载荷形态**（store_service_point 无载荷列，改用 `target_kind` 加 `target_ref`）。

这不是「违反了五次」，而是**在没有目的地的情况下，每一批都按自己的方便另起一份**。

## 2. Dexter 本轮裁决与既有规则的关系

| 编号 | 裁决 | 与既有规则的关系 |
| --- | --- | --- |
| D-1 | VOIDED 对用户叫**「作废」** | **覆盖了一条更早的 Dexter 裁定**：`project-memory/decisions/owner-read-model-and-lifecycle-standard.md:66`（base-1 裁定）原文写的是「启用 / 停用 / **标记删除**」。而 `frontend-coding-standard.md` §3-K-7（2026-08-23）写的是「作废」。两条既有裁定互相冲突，D-1 选定「作废」并覆盖前者。**这解释了仓内「标记删除」的来历——它不是疏忽，是在遵守 base-1 裁定** |
| D-2 | foundation 承担状态呈现 | 推翻 `validityStatus.tsx` 第 3–9 行的旧决策 |
| D-3 | 一律弹窗 | 与 §3-K-6「普通确认用于可恢复的状态或关系变化」一致，本稿据此从「可选」收紧为「必须」 |
| D-4 | catalog 的 Modal 编辑保留 | 范围由 C-4 收窄为只保留 Modal 承载形态 |
| D-5 | receipt 都存响应 | §2-E 实例 S-10 曾标注「需单独裁定」，D-5 已裁；存量处置由 C-5 定为随 reset 重建 |

### 2.1 补充裁决（Dexter 2026-09-18 授权 Claude 决策）

Dexter 原话：「除了 catalog 弹窗外，其他都统一，你来决策。」据此定下以下六条，理由与既有正本一并记录。

| 编号 | 事项 | 裁决 | 理由 |
| --- | --- | --- | --- |
| C-1 | §3-K-3 动词表缺「作废」 | **补入「作废」作为独立动作动词** | 「作废并重建」是复合动作（保留旧身份并建新事实），与单纯作废语义不同。VOIDED 这个状态必须有对应动词，否则确认按钮取不到合法词 |
| C-2 | 三态用户文案 | **统一为「启用 / 停用 / 作废」，不带「已」** | §3-K-7 状态表列的就是这三个词，它是跨批唯一正本且是 Dexter 2026-08-23 裁定；实测短形态也是多数（启用 48、停用 47，对已启用 14、已停用 15）。语料库 G-08/G-09 随之更新。**Dexter 2026-09-18 补充：这类取值「后面我想改也就改一处」——而这恰恰是 R-11 的直接效果**：helper 之前它是 19 个文件的决定，之后是一行 |
| C-3 | catalog 的标签归属 | **按「跨域 vs 域内」拆**：生命周期三态走共享常量；`shapeKey` 等 catalog 专有枚举继续由后端 manifest 拥有 | catalog 不必放弃 manifest，用户看到的生命周期文案又是同一套。跨域闭集的唯一真相在前端共享常量，域内闭集的唯一真相在 owner |
| C-4 | D-4「catalog 保留」的范围 | **只保留 Modal 作为编辑承载形态**；catalog 的状态控件位置、确认文案、Tag 颜色、「标记删除」文案一律照统一口径整改 | Dexter 明确只豁免弹窗形态。catalog 是 R-1/R-2 最大的违例面，全豁免会让统一失去意义 |
| C-5 | 回执存量处置 | **新增列可空、旧行留 null、随 reset 重建，不回填** | 历史回执的响应当时就没有存下来，回填在物理上不可能。回执是短生命周期的幂等记录，DEV 数据由 reset 清除 |
| C-6 | R-4 的范围 | **按全仓声明处取**（2194 个 `CONTINUATION_` 常量 / 76 个文件），baseline 在该批开工时取 | 范围小于判据会让 R-4.2 必红。**实施授权本身仍归 Dexter**，此处只定设计范围 |
| C-7 | canonical timezone | **`Asia/Shanghai`** | 仓内已有 7 处显式钉它，零处钉别的；业务是中国餐饮。沿用既有事实而不是新造。Dexter 可覆盖 |
| C-8 | 字段级空值的统一写法 | **破折号** | 三种现存写法里它最中性：「暂无」「暂未配置」都在陈述原因，而原因应由 §3-K-5 的空态或字段旁说明承担，不该压进一个单元格。Dexter 可覆盖 |
| C-9 | 统一逻辑靠什么保证 | **建 helper 并强制走 helper**，不靠各处重复写对 | Dexter 原话：「统一逻辑都靠各自重复写代码是不可靠的……当前不是 0 基础了，已经有那么多错误示范了，可以抽象统一了」。见 R-11 |
| C-10 | 本稿的范围 | **R-1 至 R-11 全部根本性解决**，不分层、不转 HANDOFF、不留「下次碰到再改」 | Dexter 2026-09-18 原话：「不管几个批次顺序做，我就是要根本性解决所有列出的这些问题」。Claude 自审时提出的「只做用户可感知的三条、其余转 HANDOFF」方案**已被否决并撤回** |

**D-1 暴露的规则缺口**：§3-K-3 的统一动词表有「作废**并重建**」，**没有单独的「作废」**。因此 R-2.3 若规定「确认按钮 = 确认{§3-K-3 动词}」，「确认作废」会取不到合法动词。**已由 C-1 裁定：补入动词表。**

## 3. 需求条目

### R-1 · 前端生命周期呈现底座（范围已收小）

对抗审查指出一个第 1 版没有识别的硬约束：**generated 状态机不都是三态**——`BusinessEntityStatus`/`OrganizationStoreStatus` 三态、`GroupWorkspaceStatus` **两态**、`AccountPresenceStatus` **四态**、`catalog_item` **五态**。而 foundation 不能 import 任一 App 的 generated 类型。

第 1 版的「三份实现全部改为消费底座、不保留本地副本」会删掉每个 surface 用 `satisfies Record<GeneratedStatus, string>` 做的**编译期穷举证明**，并可能在不可作废的对象上显示「作废」。据此改小：

- **R-1.1** foundation 只导出**值与呈现**：一份 `LIFECYCLE_LABELS` 常量（ENABLED 启用、DISABLED 停用、VOIDED 作废，照 C-2）与一个状态 Tag 组件（颜色照 §3-K-7，**只提升 `CatalogLifecycleStatusTag.tsx:6-9` 的颜色映射**，不提升整个组件——该组件还依赖 catalog manifest 与 `ITEM`/`SKU` 类型，catalog 侧保留 wrapper 处理这些域内语义）。**不导出类型断言。** 按 C-3，catalog 的生命周期标签改为消费该常量，其 `shapeKey` 等域内枚举继续由后端 manifest 拥有。
- **R-1.2** 每个 feature 保留自己的 `satisfies Record<自己的 GeneratedStatus, string>`，用 `Pick` 从共享常量取自己需要的键。DRY 的收益全部拿到，穷举证明一条不丢。
  **适用范围直接引用既有判别式**，不另立：`owner-read-model-and-lifecycle-standard.md:68` 的「能不能由人手动在两个状态间来回切换？能 → 主数据，适用三态；不能（单向推进、终态由过程决定）→ 过程或关系记录，保留自有状态机（邀请、OTP、会话、任职、合同有效性、资产上传）」。据此，`GroupWorkspaceStatus`（两态）、`AccountPresenceStatus`（四态）等先按该判据分类，非主数据的不进 R-1 射程。
- **R-1.3** VOIDED 的用户文案统一为**「作废」**（D-1）。**分母**：前端 19 个生产源文件含「标记删除」（扫描根为 `apps/frontend/*/src` 与 `libraries/frontend/*/src`，排除 test 与 generated），其中两份未被第 1 版点名的 VOIDED 字典是 `business-channel/model/businessChannelCodeLabels.ts:43` 与 `platform-admin/.../OrganizationOverviewFilters.ts:48`；**后端 2 处直接发出该文案**——`BusinessChannelService.java:1035` 与 `BusinessChannelTemplateService.java:1066`。
- **R-1.4** 修 §3-K-7 的既有颜色违例：`StoreServicePointPage.tsx:152-156` 把 VOIDED 映射成 `default` 灰（应为 `error` 红）、`CatalogDefinitionLibraries.tsx:968-969` 用 `orange`/`default`。
- **R-1.5** 「已启用/已停用」按 C-2 统一为**「启用/停用」**。`project-memory/decisions/confirmed-business-language-corpus.md:33` 的 G-08/G-09 登记同步更新，并补入 VOIDED 的「作废」条目（该语料全文原本无 VOIDED 条目）。
- **R-1.6** `validityStatus.tsx` 的旧决策按 D-2 撤销；合同 VALID/INVALID 作为独立于生命周期的另一个状态机保留自己的呈现。

**catalog 的冲突（已由 C-3 裁定）**：`CatalogLifecycleStatusTag.tsx` 本地只定义颜色，**标签来自后端 manifest**（`catalogEnumLabel(manifest, …)`）。按 C-3，生命周期三态改走共享常量，`shapeKey` 等 catalog 域内枚举继续由 manifest 拥有。

### R-2 · 状态变更的交互契约

- **R-2.1** 对象生命周期变更统一由行末操作菜单或详情抽屉的「操作」菜单发起，**不得**作为编辑表单字段。连带修正：`StoreServicePointPage.tsx:1409-1416` 的区域状态 `Select` 在编辑 Drawer 内。
- **R-2.2** 一律弹确认（D-3）。可逆用普通确认，作废用危险确认，形态照 §3-K-6。
- **R-2.3** 确认按钮文案统一为「确认+动词」，动词取自 §3-K-3 的统一动词表（该表按 C-1 补入「作废」后即可覆盖全部生命周期动作）。**违例的主流形态是裸「确认」而不是「确定」**——裸「确认」5 处（含三个待收敛的 StatusModal），「确定」仅 2 处。
- **R-2.4** 六个 `*StatusModal`（452 行）收敛到 foundation 的单一原语。**台账 FE-076 登记的「弹窗错误不可见」已修复，不作为本项理由。**
- **R-2.5** `Switch` 只用于配置型开关，不用于对象生命周期。
- **R-2.6** `AdminRowActionMenu` 的当前分母是 6 个消费者：`SalesMenuManagerDrawer.tsx:137`、`SalesMenuPage.tsx:255`、`SalesMenuPage.tsx:352`、`StoreServicePointPage.tsx:1099`、`StoreServicePointPage.tsx:1267`、`CatalogWorkbenchNavigationTree.tsx:215`；`CatalogWorkbenchItemList.tsx:87` 是明确排除的批量菜单，不纳入该分母。foundation 的 `AdminDetailActionMenu` 按 `project-memory/practices/detail-drawer-action-menu.md` 明文**不含行菜单**，两者不合并。

### R-3 · 后端横切底座

- **R-3.1** 在 `modules/foundation` 建立统一的命令幂等回执底座。**owner 边界必须写死**：foundation **只提供**幂等协议、请求哈希、claim 语义与序列化 SPI；**每个 owner 保留自己的回执表、persistence 与 readback**，foundation 不拥有任何业务回执表，也不执行业务表 DML。这是 `AGENTS.md`「模块 owner 保有事实与命令主权」红线的直接推论。
  **前置补齐**：JDBC 依赖需从 `implementation` 改为 `api`，否则底座的公开签名无法向下游传递 JDBC 类型。抽取起点是 `modules/collaboration/.../application/CollaborationCommandReceiptService.java` 的泛型 `execute`（注意：它在 collaboration 模块，foundation 当前没有 `command` 包）。
- **R-3.2** 回执载荷统一为 `response_json`（D-5）。当前 4 种形态：`response_json`(10)、`response`(3)、`readback_json`(1)、无载荷(1)。**存量按 C-5 处置**：新增列可空、旧行留 null、随 reset 重建，不回填——历史回执的响应当时就未存下，回填不可能。
  **必须同时写明 null 载荷的重放语义**：仓内已有 `OrganizationReceiptCorruptException`、`BusinessEntityReceiptCorruptException` 等在载荷空或非法时抛出的路径，若不显式规定「`response_json` 为 null 的旧回执按 claim-only 处理、不进入 corrupt 分支」，升级后旧回执会在重放时报错。**C-5 的「随 reset 重建」只适用于可重置的 DEV 数据，不得默认为生产历史清理。**
- **R-3.3** 并发语义统一。§2-E 已登记 catalog 有 `ON CONFLICT DO NOTHING` 而 inventory 与 production 没有，导致用户拿到 500。
- **R-3.4** 跨界闭集统一。**不止三态**：`ServiceNodeTypes` 定义了 GROUP/REGION/PROJECT/HEAD_COMPANY/STORE。
  **数字只作 discovery 分母，不作验收分母**——同一个字面量在不同扫描根下我实测为 204（`modules/*/src/main`）与 209（全后端非测试），Codex 复核得 211/217。数字随扫描根摆动，因此详设必须**冻结扫描根、扩展名、排除项与计数命令**，把它当作发现起点而不是收敛目标。
  **必须先按语义分桶再谈替换**：`ServiceNodeTypes.STORE`（服务节点）、`ExtensionHostTypes.STORE`（扩展宿主）、`AuditEntityTypes.STORE`（审计实体）是**三个不同的闭集共用同一字面量**，盲替换会把不该统一的 owner 语义合并。详设须逐 bucket 指定 owner、声明处、消费方与可替换范围。
  判别式**直接引用** `project-memory/practices/cross-boundary-string-agreement.md`，不另起一条。
- **R-3.5** 业务失败的类型收敛。**降级说明**：`OrganizationValidationException` 同名双份**不是当前缺陷**（映射侧已同时注册两者），是命名陷阱。真正的大分母是**六个模块各有一份结构相同的嵌套 `Problem` 类**（catalog / sales-menu / fulfillment-production 三者逐字节相同，business-channel / collaboration 仅多 `serialVersionUID`，inventory 多一个 `details`），代价落在 `ContractProblemAdvice.java:83-122` 的两条三分支 `instanceof` 链上（该文件已 826 行）。
- **R-3.6** catalog 与 business-channel 用 `IllegalStateException`(16) / `IllegalArgumentException`(11+4) 表达业务失败，逐步换为闭集内类型。
- **R-3.7** owner 请求参数解析三件套重复：`parsePageSize` 8 处、`optional` 7 处、`parseCursor` 4 处，函数体一致，唯一差异是抛出的 Problem 类名。**且 catalog 模块内已有为共享而建的 `CatalogOwnerValueSupport`，同模块五个 service 仍各抄一份**——这是「缺目的地」之外的第二种失败模式：目的地有了也没人用。
- **R-3.8** `AdvisoryLock` 底座被绕过 4 处，其中 `CollaborationOwnerServiceSql:93` 与 `PlatformAssetServiceSql:110` 是**业务锁不是回执锁**，做完 R-3.1 仍在原地。

### R-4 · SQL 可读性

- **R-4.1** 把被行宽切碎的 SQL 片段合并为 Java text block。**分母已精确到声明处**：`CONTINUATION_` 常量**声明** 2194 个、分布 **76 个文件**（此前写的 148 个文件把消费者也算进去了，那是引用点不是声明处）。范围按 C-6 取全仓声明处。
- **R-4.1a** **必须区分三类常量**（第 2 版只分了两类，漏掉第二类，现予更正）：
  1. **纯物理换行片段**——为满足 120 列行宽被机械切开的，**可合并**。这一类里有触目惊心的实例：`CatalogWorkbenchReadServiceSql.java:108-109` 把一个 SQL 字符串字面量 `'EXTERNAL_ORDER_TEMPORARY'` 从词中间劈成了 `"…='EXTE"` 与 `"RNAL_ORDER_TEMPORARY'), "` 两个常量。
  2. **静态但有 SQL 语义的片段**——没有插入 Java 变量，但本身是 `FILTER` / `WHERE` / `GROUP BY` / `ORDER BY` 等子句单元，**必须逐条人工确认后再决定**。
     **第 3 版曾把「含占位符 `?`」当作这一类的判别器，那是错的，现予撤回。** 它只能识别第二类的一个**子集**（实测 661 个），识别不了两种同样危险的形态：
     - **词中间被劈开的片段**：`CatalogDefinitionFactsSql.java:31-32` 把 `LIMIT ?` 劈成 `" … LIM"` 与 `"IT ?"`，**前半截不含 `?` 却同样参数顺序敏感**；
     - **不含占位符的子句单元**：`CatalogWorkbenchReadServiceSql.java:107,110,112-115` 的 `FILTER` / `WHERE` / `GROUP BY` / `ORDER BY` 片段，合并时改位置会改变 SQL 语义。

     因此这一类**没有安全的机械分类器**。占位符信号的等级是 `NECESSARY_NOT_SUFFICIENT`：用它先圈出必审的 661 个，但**其余部分不得据此推定为第一类**。第二类的完整识别须由结构判别（是否为独立子句单元、是否参与顺序敏感拼接）加逐消费点确认完成，并至少配一条「无占位符子句被错误合并或重排即红」的 mutation。关键风险是**参数绑定顺序**：同文件第 111 行的 `…FILTER_UPDATED_AT_EPOCH_MILLIS` 含占位符 `?`，而 `CatalogWorkbenchReadPersistence.java:371-384` 按常量顺序拼接后传入 `new Object[]{recentlyUpdatedSince, dataNodeRef, brandRef}`——**合并时改变顺序会让参数错位，而 SQL 仍然合法**。
  3. **运行时或条件式拼装片段**——为在中间插入运行时变量而存在，**保留结构，单独做行为验证**。仓内 `Sql.常量 + 运行时变量` 的混合拼接共 **93 处**（例如 `OrganizationTaskPathPersistence.java:1089`），其中动到 `CONTINUATION_` 常量的有 **27 处**。

  **字节码等价门覆盖不到第三类**——运行时拼接的结构变化可能仍产出等价的最终字符串。第二类的参数错位也未必被它发现。因此 R-4 的验证不能只靠该门。
- **R-4.2** 合并后不得再出现续行常量，也不得出现名字与语句类型不符的常量（现存实例：`StoreServiceSql.java:12` 的 `STORE_SERVICE_UPDATE_UPDATED_AT_EPOCH_MILLIS_ENABLED` 实为 INSERT 尾巴，消费点 `StorePersistence.java:93`）。
- **R-4.3** 等价性由 `scripts/check/backend-sql-relocation-equivalence.mjs` 以字节码等价证明。**承重前提（第 1 版遗漏）**：该脚本第 11–17 行强制要求 `--baseline` 参数指向改造前的源码树，即**必须先有改造前的源码快照，并对两棵树各跑一次 Gradle 编译**。它不在常规 verify 门列表里，是离线比对工具。
- **R-4.4** 因此 **R-4 必须排在其他会改写 SQL 的批次之前**——否则 baseline 会被前序批次污染。

### R-5 · 集合读

- **R-5.1** **范围收窄**：凡按 `project-memory/practices/collection-boundary-modes.md` 判定为 **Cursor 形态**的集合读，必须使用 keyset（排序列加 ref）。**Page 形态（用户要跳到任意页）天然使用页号/偏移，不在本条范围**——第 1 版的「一律 keyset」会把合法的 Page 形态判成违例。
  实测：OFFSET 27 个文件、严格 keyset 6 个文件（放宽口径 8 个）。**该分母必须先按 Page/Cursor 形态重新分类**才有意义。
- **R-5.2** 「集合读的行投影不得发起查询」**不新写规则**，指向 `PLATFORM-BLUEPRINT.md:39` 的既有红线（它还带了「单对象 detail lookup 与已批量化读取不是 N+1」的反例边界，比第 1 版的复述更完整）。
- **R-5.3** 游标 identity 的编解码目前有三套形态：五处 `cursorIdentity(String, String...)` 逐字节相同（长度前缀）、`OperationsExternalCollaborationController.java:120` 用单元分隔符连接、`SalesMenuCursorIdentity.java:29-43` 用竖线 join 且 `filter` 为用户输入**不转义**。identity 相等是拒绝跨查询游标的唯一防线，不应有三种安全性。

### R-6 · 规范约束力闭环（范围大幅收小）

第 1 版的 R-6 被判为「刚退役的 compliance-control 的最小可识别复制品」。我接受该判断，收到最小：

- **R-6.1** 在实施详设模板第 47–71 行的**既有对账表里加一行**：「管理后台交互一致性 | 前端规范 §3-K-1..§3-K-10」。`ui-interaction-design-template.md` 与 `ia-design-template.md` 同样加这一行。
  **`journey-decision-template.md` 需要的不是「加一行」**——它只有前提链表（第 35 行起），没有同形的横切机制对账表，必须新增一个字段或小节。§3-K-8 点名的第一个就是 UI-bearing Journey，这是最上游的口子。
  **三份模板的该行都必须有非空约束**：引用要精确到 `§3-K-1` 至 `§3-K-10` 的具体子节、列出本批适用 surface 与例外理由；只留空行不算完成。
- **R-6.2** 建 §1-L 声明但未建的 `scripts/check/lifecycle-vocabulary`。判据照 §1-L 第 138 行已写好的反向形态：**任何带 `status` 列的表，不在主数据清单也不在豁免清单，门必须红。**
  **更正**：该门的对象是 migration 的**表**，从设计上就不拦 Java 字面量。第 1 版把「三态硬编码无一被拦」归因于此门缺失，因果不成立。Java 字面量归 R-3.4。
- **R-6.3** 只建三条**禁止句**形态的门（照 §1-0「门只写禁止句」，不建存在性断言门）：禁止 `features/**` 出现「标记删除」字面量；禁止 `features/**` 出现内联生命周期颜色三元；R-6.2 的反向表判据。
- **R-6.4**（已删除）第 1 版提议在 project-memory 新增失败模式条目。该条目服务于一个尚未被证明的根因，且 §1.1 已改为可证伪的分域判定，不再需要。

### R-7 · 时间与空值呈现底座（新增）

**这是本轮用户可感知度最高的一条，第 1 版完全没有。**

- **R-7.1** 时间呈现收敛到 foundation 的单一格式化函数。**必须冻结四项**：canonical timezone、locale、格式档位、以及 `null`/`0`/空字符串的处理规则。只要求「显式钉定时区」而不指定用哪个，不足以消除分叉。canonical timezone 按 C-7 定为 `Asia/Shanghai`。
- **R-7.2** **字段级空值**（Descriptions、表格单元格中的 null）兜底按 C-8 统一为**破折号**，替换当前三种写法。
  **本条不覆盖空态**：列表与页面的**空态**（§3-K-5）仍须按既有规则给出「缺什么、会怎样、下一步做什么」，不得被本条压成一个通用文案。二者是不同的东西，详设不得混用。
  另须区分「未配置」「无数据」「不适用」「无权限不可见」四类，不得压成同一文案。

实测：`toLocaleString` 不钉时区 22 处、钉 `Asia/Shanghai` 7 处。审计弹窗按上海时区（`OperationsAuditHistoryModal.tsx:53`、`PlatformAuditHistoryModal.tsx:38`），而商业实体列表（`BusinessEntityManagementPage.tsx:352`）、库存列表（`InventoryManagementPage.tsx:257`）按浏览器时区。**同一个 `updatedAt`，运营用户在两个页面会看到互相矛盾的两个值。** 另有六份逐字节相同的 `time()` 函数，以及空值兜底的三种写法（破折号 / 暂无 / 暂未配置）。

住址：`libraries/frontend/admin-ui-foundation/src/presentation`。

### R-8 · 审计词表唯一注册表（新增）

- **R-8.1** 审计字段标签与动作码文案收敛为唯一注册表，两个 App 消费同一份。
- **R-8.2** `auditChangePresentation` 的共享部分下沉，两个 App 不各留一份。

实测：两个 App 的 `auditChangePresentation.ts` 函数体逐字节相同；字段字典分叉（`notes` 在 ops 是「说明」、在 platform 是「备注」）；动作码分叉（同一个 `WORKSPACE_INVITATION_CREATED`，运维看到「已发出邀请」、运营看到「已创建邀请」）。而两侧读的是**同一批 owner**。

`AuditChange.forNullableScalar` 把 `fieldLabelSnapshot` 置 null，所以前端兜底字典在实际路径上一定会被用到，不是死代码。

### R-9 · 跨 App 闭集词表与共享展示（新增）

**必须按三层拆，不能整体搬**——两份 `extensionList.tsx` 虽外观相似，却分别依赖不同的 generated API、不同的 testId 与不同的 `extensionValues` 可空性；两个 Transport 依赖不同的 problem-code 闭集。整体上移会让 foundation 反向依赖 app 的 generated 类型。

- **R-9.1** **foundation 层**：只收纯值与纯逻辑——闭集词表（如 `collaborationCodeLabels`）、通用 HTTP 解析。不含任何 app generated 类型。
- **R-9.2** **app adapter 层**：generated 类型适配与 feature projection 留在各自 app，消费 foundation 的纯值。
- **R-9.3** **app 私有层**：`*TestIds.ts` 与各自的 problem-code 映射**继续留在 app**，不跨 App 共享——automation 身份不应越过 app 边界。
- **R-9.4** 两个 App 逐字节相同的 transport helper（`readCurrentDefinitionRevision`、`transportResponseStatus`）下沉 `foundation/http`；`ApiFailure` 与 `PlatformApiFailure` 的能力差异（前者不设 `this.name`）一并抹平。`problem()` 骨架因两侧 problem-code 闭集不同，**不整体合并**。

实测成对复制的文件：`collaborationCodeLabels.ts`（143/139 行，diff 仅 20 行且已开始按位置漂移）、`extensionList.tsx`（各 104 行，diff 8 行）、`extensionListTestIds.ts`（各 11 行，**diff 0**）。两个 `problemFeedback` 另有 20 条共有错误码。transport 层的 `readCurrentDefinitionRevision` 与 `transportResponseStatus` 两个 helper 逐字节相同，且 `ApiFailure` 不设 `this.name` 而 `PlatformApiFailure` 设了——按 `error.name` 分流的上层逻辑在两个 App 行为不同。

### R-10 · 测试脚本与 seed 数据是交付分母的一部分（Dexter 2026-09-18 要求）

**规则**：后续任何一批的详设，其同步变更分母**必须同时包含测试脚本与 seed 数据**。只改生产代码、把测试与 seed 留到最后，交付不了。

**这不是预防性条款，是这个仓刚发生过的事**：

- 上一批「门店桌台与二维码管理」的 M-01（建桌台在默认输入下必被 owner 拒绝）之所以穿过了三轮独立 implementation review 与 P9 逐代码对账，直接原因是**测试与 seed 双重掩盖**——seed fixture 的每个 TABLE 服务点都带齐了容纳人数与形态，而 acceptance 的 `createTablePoint` 签名**强制**传这两个参数，九处调用无一例外。「不填属性」这条路径在验收里分母为零。
- 同一批还差点停在 seed：`scripts/dev/r5-seed-plan.mjs:39` 与 `scripts/dev/owner-command-seed-executor.mjs:87` 各硬编码了 `definitions.length !== 8`，新增一个扩展宿主会让 seed 在写入任何数据之前抛错。这两处当时不在详设的同步清单里。
- 还有一次是顺序：`scripts/dev/r5-complete-seed-executor.mjs:18` 的四阶段被冻结且顺序被机械校验，二维码配置一度被排在渠道创建之前，seed 必然失败。

- **R-10.1** 详设的同步分母必须逐项列出下列载体，缺项即详设未完成：

- `scripts/dev/r5-seed-plan.mjs` 与 `scripts/dev/owner-command-seed-executor.mjs` 等各 seed executor 中的**闭集与数量断言**（本批 R-1.3 的文案、R-3.4 的闭集都会命中）；
- `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` 这类 **fixture 数据正本**——改校验器不等于改数据；
- `scripts/dev/r5-complete-seed-executor.mjs` 的**阶段清单与顺序**（被机械校验，不能临场对调）；
- 各 `*AcceptanceScenarios.java` 的 **fixture 构造函数签名**——签名强制传参会让「不传」这条路径无法被覆盖；
- 前端的 static/render 测试与 red mutation；
- `scripts/check/` 下受本批影响的门。

- **R-10.2** 每条需求都要写明它的测试与 seed 连带面。**下表只是已知起点，不是完整分母**——详设阶段必须逐个 R 子项（R-1.1 至 R-10.3）补全对应的 fixture、seed executor、AcceptanceScenarios、前端 static/render test、red mutation 与 check gate，并机械证明无 missing / extra。本批的已知连带：

| 需求 | 测试与 seed 连带 |
| --- | --- |
| R-1.3（文案统一为「作废」） | seed fixture 与 acceptance 断言中的状态文案、前端 static 测试中的文案断言 |
| R-3.2（回执统一 `response_json`） | seed executor 读回执的路径、各域 receipt 的 focused test |
| R-3.4（跨界闭集） | seed plan 的闭集校验（已有先例即 host set 的硬编码数量） |
| R-4（SQL text block） | `backend-sql-relocation-equivalence` 的 baseline 快照必须在该批开工前取 |
| R-7（时区） | 前端测试中的时间断言会随时区钉定而变化 |

- **R-10.3** 详设交付时，其同步分母表若不含 seed 与测试载体，或含了却未逐项写明连带改动，该详设判为未完成，不进入实施。


### R-11 · helper 层与「走没走 helper」的强制检查（Dexter 2026-09-18 要求）

**规则（C-9）**：统一逻辑**不靠各处重复写对**，靠把逻辑收进 helper 并强制所有调用方走它。Dexter 原话：「统一逻辑，都靠各自重复写代码统一，是不可靠的……我们当前不是 0 基础了，已经有那么多错误示范了，可以抽象统一了」。

这句话同时解除了后端规范 §2-F「过度设计」与「不要为假设中的未来需求提前设计」对本批的约束——**本批要抽象的每一项都有仓内实测的错误示范作为证据基础，不是假想需求**。

- **R-11.1** 建立 helper 的判据：某段逻辑在两处以上出现、且**写错时用户或数据会受影响**，就建 helper。
  **下表是 helper 归属矩阵，不只是清单**——每项必须写明 helper 承担什么、feature 保留什么，否则实施者会把 feature 专属逻辑错误下沉。第 2 版的表缺这一列，已补：

| helper | 覆盖的逻辑 | 错误示范（实测） | 对应需求 |
| --- | --- | --- | --- |
| 生命周期状态 | helper 只承担**标签常量与状态 Tag 呈现**；**状态推导与 generated 类型穷举仍留在 feature**（见 R-1.2） | 三份实现函数体逐字相同、VOIDED 文案分叉成两个词 | R-1 |
| 状态确认交互 | 确认弹窗、危险确认、错误呈现 | 六个 `*StatusModal`，452 行 | R-2.4 |
| 行末操作菜单 | 行级动作菜单 | 6 个 `AdminRowActionMenu` 消费者；批量菜单明确排除 | R-2.6 |
| 时间格式化 | helper 承担时区、locale、格式档位。**与字段级空值分开，不是同一个 helper** | **前端 30 处直接用 `toLocaleString` / `Intl.DateTimeFormat`，foundation 当前没有任何时间 helper**；22 处不钉时区对 7 处钉上海时区 | R-7.1 |
| 空值呈现 | 字段级 null 兜底 | 破折号 / 暂无 / 暂未配置三种 | R-7.2 |
| 审计词表 | 字段标签、动作码文案 | 两个 App 函数体逐字相同、同一动作码两种中文 | R-8 |
| 闭集词表与 transport | helper 只承担**纯闭集词表与通用 HTTP 解析**；**`*TestIds.ts` 明确不共享、留在各 App**（见 R-9.3）；`problem()` 骨架因两侧 problem-code 闭集不同不合并 | `extensionListTestIds.ts` 两份 diff 为 0；两个 transport helper 逐字节相同 | R-9 |
| 命令幂等回执 | 幂等协议、哈希、claim | 10 个服务、15 张表、4 种载荷形态 | R-3.1 |
| owner 请求参数解析 | `parsePageSize` / `optional` / `parseCursor` | 8 处 / 7 处 / 4 处逐字节相同 | R-3.7 |
| advisory lock | 锁取得 | 4 处绕过既有 `AdvisoryLock` | R-3.8 |
| 游标 identity | 编解码与防碰撞 | 三套形态，其中一套不转义用户输入 | R-5.3 |
| 审计写入 | helper 承担 `audit_event` 写入 | organization 一个模块内 7 份 SQL 常量加一处内联 | R-3 |
| 业务失败 envelope | **详设决策项（非产品未决）**：六个 owner 各有一份结构相同的嵌套 `Problem` 类，`ContractProblemAdvice.java:83-122` 为此写了两条三分支 `instanceof` 链。落点由详设在共享 envelope、app adapter、`NOT_SHARED_WITH_REASON` 三者中选定，但**必须遵守三条冻结约束**：不得跨 App 混用 problem-code 闭集、不得引入 generated 类型反向依赖、用户可见错误结构与状态码语义不得漂移 | 见 R-3.5 | R-3.5 |

- **R-11.2** helper 存在之后，可以建「禁止直接用底层 API」的文本门——**但它是必要的绕过检查，不是闭包证明**。

  第 2 版把这条写成了「就是一条合格的机器门」，**那个推论不成立，现予更正**。文本门只能拦住字面形态，拦不住改名后的本地实现、别名调用、拆分字符串拼接、间接 wrapper；反过来它还会误伤合法实现——实测 `modules/foundation/.../persistence/AdvisoryLock.java:20-30` 自己就含 `SELECT pg_advisory_xact_lock` 字面量，**「禁止 advisory lock SQL」的门会把 helper 本身判红**。

  因此每条门必须同时满足四项，缺一即为假门：
  1. **冻结扫描根、排除项与合法例外**——至少排除 helper 自身定义处、测试与 generated；
  2. **对直接调用与 import 走调用点检查而非任意文本匹配**，文本匹配只作为兜底。**两端都有现成能力，但落点程度不同，第 3 版把这两件事混为一谈了，现予更正**：前端 `tools/verify-gates/cli.mjs` 第 8 行已 `import ts from 'typescript'`，AST 能力与落点都在；后端 `build.gradle.kts` 第 85 行已引入 ArchUnit，但 `src/test/java/architecture/BackendModuleBoundariesTest.java` 现有规则**全是 `noClasses()`/`classes()` 的类依赖约束，一条方法级规则都没有**——**能力存在不等于落点存在**，方法声明与调用点规则需要新增；
  3. **对静态门覆盖不到的改名与间接实现，保留 focused 行为测试**——这部分不可能由文本门证明；
  4. **每条门配一条真实 red mutation**，证明它确实能先于编译器抓住目标绕过形态。

  **但即使补齐这四项，也不构成闭包证明。** 改名后复制一份等价逻辑的情形，普通行为测试同样会全绿——它验证输出，不验证是否经过 helper。因此每条门必须按下表逐项写明证明形态，**「改名或间接实现」一列不得留空，只能填三种之一：helper 变异（改坏 helper 后该路径必须红）、可观测调用断言、或诚实写明「只能靠逐代码 review」**：

| 门 | 机械检查对象 | 合法例外 | 直接绕过的 red mutation | 改名或间接实现的证明形态 |
| --- | --- | --- | --- | --- |
| 时间格式化 | 前端 AST：调用点 | helper 自身定义处 | 在 feature 里直接调用 | helper 变异 |
| 生命周期颜色 | 前端 AST：内联三元与 map 字面量 | helper 自身 | 新增内联映射 | helper 变异 |
| 参数解析 | 后端 ArchUnit **方法级规则（需新增）** | helper 自身 | owner 内自建同名方法 | helper 变异 |
| advisory lock | 后端 ArchUnit 加文本 | **`AdvisoryLock` 自身定义处必须排除** | 直接写 `pg_advisory_xact_lock` | 逐代码 review（改名后的等价 SQL 无法由结构规则穷举） |
| 三态字面量 | 前后端文本 | helper 常量定义处 | 重新引入中文字面量 | helper 变异 |

  据此，下列条目建立「必要绕过检查」门：

- 禁止 `features/**` 直接出现 `toLocaleString` / `Intl.DateTimeFormat`（当前 30 处即应变红）
- 禁止 `features/**` 出现内联生命周期颜色三元
- 禁止 `features/**` 与 `app/api/**` 出现三态中文字面量（须走 helper 常量）
- 禁止 owner 模块内自建 `parsePageSize` / `optional` / `parseCursor`
- 禁止绕过 `AdvisoryLock` 直接写 advisory lock SQL

- **R-11.3** 后续每个功能模块的详设与实施，必须逐项检查「相应逻辑有没有走 helper」。这是交付门，与 R-10 并列：

- **详设阶段**：横切机制对账表中，凡本批触及 R-11.1 清单里任一逻辑的，必须写明走哪个 helper；若确实不能走，必须写明理由与边界，不得留空。
- **实施阶段**：逐代码对账时逐项确认调用点真的走了 helper，而不是复制了 helper 的实现。
- **判据**：详设中存在 R-11.1 清单内的逻辑却未声明 helper 归属，该详设判为未完成；实施中存在绕过 helper 的调用点，该批判为未就绪。

- **R-11.4** helper 新增或移动后，必须同步登记进 `project-memory/practices/frontend-capability-lookup.md`（前端）与对应的后端能力索引。否则实施者查不到它，会继续重复实现——这正是本稿 §1.1 诊断的「缺目的地」在 helper 层的重演。


## 4. 规范载体同步清单（已补全）

| 载体 | 变更 |
| --- | --- |
| `doc/platform/frontend-coding-standard.md` | §3-K-3 动词表补「作废」（C-1）并把「标记删除」列入禁用同义词；§3-K-7 指向 R-1.1 的共享常量；状态文案按 C-2 统一为不带「已」的短形态；§3-F 候选清单更新。**不新起「生命周期唯一住址」条**——内容已分散在 §3-K-6/7/10 与 §3-F，照 §4-D「查到已有的就改那一处」 |
| `doc/platform/backend-coding-standard.md` | §1-L 的门状态更新；§2-E 更新实测数字（8→10 服务、11→15 表、4 种载荷）并记录「前置已解除一半」；新增 D-5 的载荷统一裁定 |
| `PLATFORM-BLUEPRINT.md` | 第 39 行是 R-5.2 的正本，**第 1 版漏列**。本稿不复述它，只在模板表里指过去 |
| `doc/decisions/templates/implementation-design-template.md` | 既有对账表加 §3-K 一行 |
| `doc/decisions/templates/ui-interaction-design-template.md` | 同上 |
| `doc/decisions/templates/journey-decision-template.md` | 同上。**第 1 版漏列**，而 §3-K-8 点名的第一个就是它 |
| `doc/decisions/templates/ia-design-template.md` | 同上 |
| `project-memory/decisions/confirmed-business-language-corpus.md` | 按 C-2 更新 G-08/G-09 为「启用/停用」；**全文无 VOIDED 条目**，按 C-1/C-2 补入「作废」 |
| `project-memory/practices/collection-boundary-modes.md` | R-5.1 的形态判定以它为准，本稿不另立 |
| `project-memory/practices/cross-boundary-string-agreement.md` | R-3.4 的判别式正本 |
| `project-memory/practices/detail-drawer-action-menu.md` | R-2.6 需重划行菜单分母 |
| `project-memory/practices/ui-visible-business-language-and-dynamic-aggregate-layout.md` | R-1.3 落地后须回读 |
| `project-memory/operations/backend-readability-refactor.md` | R-4 会作废其中登记的字节证据 |
| `project-memory/operations/` 下两份 coding-standard anchor | routed anchor 的断言随正本更新，否则下一轮仍召回旧断言 |
| `project-memory/decisions/owner-read-model-and-lifecycle-standard.md` | **第 66 行的「标记删除」被 D-1 覆盖为「作废」，必须同步改写**；其第 68 行的主数据判别式被 R-1.2 直接引用，保持不动 |
| **后端 problem detail 的用户可见文案** | 新增一类载体。R-1.3 的分母跨到后端 |
| `project-memory/practices/frontend-capability-lookup.md` | **新增或移动的 foundation 符号必须登记进这张表**。它是 routed practice，触发时刻是「准备描述一个控件、列表、抽屉、表单或渲染行为」，明写「描述之前先查」。规范改了而它不改，实施者仍然找不到新符号，重复实现会继续发生 |
| `doc/platform/implementation-task-template.md` | 其能力预检要求纳入交付检查 |
| **seed 正本、seed executor、acceptance fixture、前端测试、受影响的门** | 按 R-10 纳入每批的同步分母，不是交付后补 |

## 5. 验收判据

### 5.0 闭包等级标注制度（第 4 版结构性修改）

**为什么要加这一节**：本稿经三轮独立复审，每轮的 Major 都是**同一个根因**——把一个形式上可扫描的信号，当成了机制已经闭合的证明。第 1 轮是判据用存在性断言，第 2 轮是把文本门当闭包证明，第 3 轮是把占位符 `?` 当完整分类器。三次都不是某一条写错，而是**在需要证明「全都覆盖到了」时，总会伸手抓一个代理信号，然后忘记它只是代理**。

逐条修补已证明无效，因此改为结构性约束：

**本稿及后续详设中的每一条判据，必须显式标注闭包等级，三选一：**

| 等级 | 含义 | 强制要求 |
| --- | --- | --- |
| `PROVES_CLOSURE` | 确实证明属性在全集上成立 | **必须能回答「它在什么情况下会漏」。答不出来的，就不是这一级。** |
| `NECESSARY_NOT_SUFFICIENT` | 只能抓住子集，不构成证明 | **必须写明它抓不到什么**，并指出剩余部分由什么补 |
| `REVIEW_ONLY` | 无法机械判定 | 必须写明由谁、对照什么材料、在哪个时点检查 |

**元规则**：稿中不得出现未标注等级的判据；标 `PROVES_CLOSURE` 而说不出漏检情形的，一律降级。

**诚实的结果是：本稿没有任何一条判据够得上 `PROVES_CLOSURE`。** 这不是缺陷，而是把原本隐藏的事实显式化——语义属性本来就不可能由文本门单独证明。写出来比假装闭合有用。

### 5.1 机械门（全部为 `NECESSARY_NOT_SUFFICIENT`）

| 需求 | 判据（禁止句形态） | 抓不到什么 | 必须被抓住的反例 |
| --- | --- | --- | --- |
| R-1.3 | 全部生产 `src/**`（排除 test 与 generated）与后端 problem detail 中禁止出现「标记删除」 | 拼接生成的文案；从后端透传而未硬编码的文案 | `app/api/operationsProblemFeedback.ts:149` 当前即应变红 |
| R-1.4 | `features/**` 禁止内联生命周期颜色三元 | 改用 map 或 switch 写法的等价内联 | 新增内联映射 |
| R-2.3 | 生命周期确认按钮禁止裸「确认」与「确定」 | 用变量拼出的按钮文案 | 裸「确认」5 处、「确定」2 处当前即应全红 |
| R-3.2 | 新建回执表禁止缺少 `response_json` | 列名不同但语义相同的第五种载荷 | 新表用第五种形态 |
| R-4.2 | 全仓禁止续行常量声明 | 改名后不带该前缀的等价切分 | 按 ServiceSql 子集施工则此判据必红 |
| R-6.2 | 带 `status` 的表不在两处清单即红 | Java 侧的三态字面量（归 R-3.4） | 新建未登记的表 |
| R-7.1 | `features/**` 禁止直接调用 `toLocaleString` / `Intl.DateTimeFormat` | 自建 wrapper 后再调用；改用 dayjs 等第三方格式化 | 当前 30 处即应全红 |
| R-7.2 | `features/**` 禁止「暂无」「暂未配置」作为空值兜底 | 第四种新造的兜底文案 | 新增兜底写法 |
| R-8.1 | 禁止在 `features/**` 定义审计字段或动作码的中文字典 | 把字典搬到 `app/api` 或 `model` 目录 | 任一 App 重新本地定义 |
| R-9.1 | 禁止两个 App 存在同名的闭集词表文件 | 改名后内容仍重复的副本 | 新增成对副本 |
| R-11.2 | owner 模块禁止自建 `parsePageSize` / `optional` / `parseCursor` | 改名后的等价私有方法 | 当前 19 处即应变红 |
| R-11.2 | 禁止绕过 `AdvisoryLock` 直接写 advisory lock SQL | 拼接或参数化构造的同义 SQL；**必须排除 `AdvisoryLock` 自身定义处，否则误报 helper** | 当前 4 处即应变红 |

**注**：第 3 版的 R-7.1 与 R-11.2 各有一条时间门、内容重复，已合并为上表一条。

### 5.2 交付门（`REVIEW_ONLY`）

| 需求 | 检查内容 | 由谁、对照什么、何时 |
| --- | --- | --- |
| R-10.3 | 详设的同步分母表是否含 seed 与测试载体，且逐项写明连带改动 | 详设评审者，对照 R-10.1 的载体清单，详设交付时 |
| R-11.3 | 详设是否为 helper 清单内的逻辑声明归属；实施是否真的走了 helper 而非复制其实现 | 详设评审者与逐代码对账执行者，对照 R-11.1 归属矩阵，详设交付时与实施收口时 |
| R-2.1 | 编辑表单内是否存在生命周期状态控件 | UI 评审者，对照 §3-K，详设与实施 |
| R-5.1 | 集合读的 Page/Cursor 形态判定 | 详设评审者，对照 `collection-boundary-modes.md` |
| R-5.2 | 集合读的行投影是否发起查询 | 逐代码对账，对照 `PLATFORM-BLUEPRINT.md` 第 39 行 |
| R-3.5 / R-9.2 至 R-9.4 | 同一职责判定与分层归属 | 详设评审者，对照 generated 类型边界 |

**判据自检**：§5.1 每条都已把当前已知违例代入验证会红，且都填了「抓不到什么」。任何一条填不出「抓不到什么」的，说明它要么真是 `PROVES_CLOSURE`（须另行论证），要么是作者没想清楚——按元规则，后者更常见。

## 6. 实施批次

**范围裁定（C-10）**：R-1 至 R-11 **全部在本轮范围内**，没有任何一条转 HANDOFF 或降级为「下次碰到再改」。批次只决定顺序，不决定取舍。

**批次划分依据两条硬约束**，不是按用户感知度排：

1. **R-4 的 baseline 依赖**——它的字节码等价 oracle 需要一棵未被其他改写 SQL 的批次污染的源码树；
2. **R-11 的 helper 前置**——helper 不存在时，「强制走 helper」的门无处可挂。

| 批次 | 内容 | 可否与其他批次并行 |
| --- | --- | --- |
| 甲 | **R-4**（SQL text block，已授权） | **可与乙并行**。实测两者文件零重叠：R-4 只动 `apps/backend/**/*.java` 的 `CONTINUATION_` 声明处，而 R-1.3 要改的两处后端文案是内联字符串、所在文件 `CONTINUATION_` 命中为 0 |
| 乙 | **R-1 + R-2 + R-7**（用户可感知的一致性）+ 其所需 helper | **可与甲并行**；必须先于丁 |
| 丙 | **R-3**（后端横切底座）+ 其所需 helper | 必须在甲之后（它会改写 **10 个** `*CommandReceiptServiceSql`——BusinessChannel、BusinessEntity、Collaboration、CommercialGroup、Contract、Extension、OrganizationHierarchy、Platform、**Workspace**、WorkspaceIam；第 2 版写成九个，漏了 workspace owner 那个——先做会污染 R-4 的 baseline） |
| 丁 | **R-8 + R-9**（词表与跨 App 共享） | 依赖乙建立的 foundation 住址 |
| 戊 | **R-5 + R-6**（集合读规则与规范闭环） | R-5 需先按 Page/Cursor 形态重新分类分母 |

**R-11 不是独立批次，而是贯穿每一批**：每批建自己所需的 helper，并在本批内把「禁止绕过 helper」的门一起建起来。R-6.1 的模板加行随甲、乙两批一起落地，否则前面几批的成果会在下一个新功能上重新漂移。

**每一批的完成判据都含 R-10 与 R-11.3**：既要证明测试与 seed 同批交付，也要证明本批触及的逻辑确实走了 helper 而不是又复制了一份。每一批的 helper 新增都必须同步 R-11.4 的能力索引。

**一条依赖提示的更正**：第 2 版写「审计写入 helper 很可能被甲批吸收」，**那是错的**。实测 `StoreServicePointService.java:558` 的 `audit_event` INSERT 是**内联字符串**，该文件 `CONTINUATION_` 命中为 **0**——R-4 根本碰不到它。organization 模块那 7 份 SQL 常量会被 R-4 合并，但**内联那一处不会**，审计写入 helper 仍然需要独立建立。

## 7. 裁决状态

### 7.1 已裁决（可直接进入实施设计）

- **D-1 至 D-5**：Dexter 2026-09-18 直接裁定，见 §2。
- **C-1 至 C-6**：Dexter 授权 Claude 决策，见 §2.1。第 1 版遗留的五条未决项已分别由 C-1、C-3、C-2、C-4、C-5 关闭。

由 C-4 派生的 catalog 具体整改项（纳入本批，不再豁免）：

| 位置 | 违例 | 归属需求 |
| --- | --- | --- |
| `CatalogBatchActionModal.tsx:163` | 把「标记删除」做成表单选项 | R-1.3 加 R-2.1 |
| `CatalogCategoryActionModal.tsx:48,50` | 「标记删除」文案加「确定」确认按钮 | R-1.3 加 R-2.3 |
| `CatalogItemViewDrawer.tsx:133,192` | 「标记删除」文案 | R-1.3 |
| `CatalogWorkbenchNavigationTree.tsx:233` | 「标记删除」文案 | R-1.3 |
| `CatalogDefinitionLibraries.tsx:968-969` | 状态色用 orange/default，违反 §3-K-7 | R-1.4 |
| `CatalogItemIdentifiersEditor.tsx:220`、`CatalogItemProductionEditor.tsx:317` | 「确定」确认按钮 | R-2.3 |
| catalog 生命周期标签 | 改为消费共享常量；shapeKey 等域内枚举保持 manifest 驱动 | R-1.1（C-3） |

`CatalogDictionaryAtomModals`、`CatalogTemporaryPromotionTask`、`CatalogItemCreateDrawer` 等以 Modal 承载编辑表单的形态**按 D-4 与 C-4 保留不动**。

### 7.2 Dexter 2026-09-18 的最终确认

- **R-4 实施授权：已授权**。设计范围按 C-6 取全仓声明处（2194 个常量 / 76 个文件），baseline 在该批开工时取（一次目录拷贝，不是仓库控制动作）。**R-4 排在所有批次之前**，因为它的 baseline 必须是未被其他批次污染的树。
- **C-5：已确认**。DEV 阶段按 reset 重建处理，同时保留「`response_json` 为 null 的旧回执按 claim-only 处理、不进 corrupt 分支」这条前向兼容规则。
- **C-7（`Asia/Shanghai`）与 C-8（破折号）**：Dexter 未提出异议，按同意处理。
- **C-9（建 helper 并强制走 helper）**：Dexter 2026-09-18 明确要求，见 R-11。

**本稿已无待裁决项。**

### 7.3 评审轮次状态

第 1 版已由三个 fresh 独立子 agent 并行从三个攻击面（事实核验、方案合理性、遗漏完备性）做过**一轮**对抗审查（reviewer 数量不等于 round 数量），39 条已逐条处置（见 §9）。按 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` 的 DESIGN 两轮上限，第 2 版尚可再做一轮定向核验；当前以 `ROUND_FINAL_DECISION=SELF_DECIDED` 收口，若 Dexter 要求则再开一轮。
## 8. 本稿未覆盖

- 未做运行时测量；R-5.2、R-7 的影响均为静态推导。
- R-1.3、R-3.4、R-5.1 的完整分母未穷举，已给出判定式与当前实测量级。
- 上帝类（`CatalogItemService` 5980 行）与两个 Copy 服务（6501 行）不立项。
- 生成物侧的 `extensionValues` 在两个 App 有两种可空性形态，是前端展示分叉的上游成因，本稿按 §8 的豁免不处理，仅登记供 Dexter 判断是否解除豁免。

## 9. 对抗审查处置记录

一轮独立子 agent 对抗审查（三个并行 reviewer）共提出 39 条。处置：

- **接受并据此重写**：第 1 版的 17 条事实错误（全部已在 §0 更正）、R-1 方案改小、R-6 范围收小、R-5.1 范围收窄、R-5.2 改为指向既有红线、R-3.5 降级、批次按 baseline 依赖重排、新增 R-7/R-8/R-9 与 9 处载体遗漏（§4 由 7 行扩为 16 行）。
- **部分接受**：根因判定改为分域（后端缺目的地 / 前端引用无人检查），并给出可证伪的验证方式。
- **不接受（附证据）**：审查方称 keyset 只有 1 个文件，我实测严格谓词 6 个、放宽 8 个，逐个打开确认均为真实分页谓词，非 1 个。

### Claude 合理性自审的处置（Dexter 要求，2026-09-18）

自审提出四类质疑，处置如下：

- **「11 条里只有 2 条用户可感知，建议分层、其余转 HANDOFF」——已被 Dexter 否决并撤回。** 裁定见 C-10：全部根本性解决。
- **「R-4 排第一是为 oracle 方便不是为用户」——成立并已改。** 实测 R-4 与前端批次文件零重叠，改为甲乙并行，用户可感知的改进不必等在后面。
- **「C-2 不带『已』可能让状态 Tag 与菜单动作撞词」——自审后自行推翻，C-2 维持。** 因为菜单给出的动作永远是当前状态的反面：启用态的 Tag 写「启用」而菜单给「停用」，停用态反之；VOIDED 是终态、没有动作（`canManage` 的判据就是 `status !== 'VOIDED'`）。**同一对象上这两个词从不同时出现同一个字**，撞词不成立。
- **「审计写入 helper 可能多余」——降级为依赖提示，不删。** 见 §6 末段：丙批开工前重新核，若已被甲批吸收则移除。

### Codex 需求 review 第 3 轮的处置（NO-GO，2M/0S/1N）—— 以及一次收口方式的更换

我在第 3 轮的交接里问了 Codex 一个问题：前两轮的 Major 是不是同一个根因，如果是，说明我有反复犯的盲区，需要换收口方式而不是继续修条目。

**它的回答是「是」，而且第 3 轮的两个 Major 仍是同一个根因。** 三轮的形态分别是：判据用存在性断言、把文本门当闭包证明、把占位符 `?` 当完整分类器。**共同点是：在需要证明「全都覆盖到了」时，抓一个可扫描的代理信号，然后忘记它只是代理。**

因此第 4 版不再逐条修补，改为结构性约束——新增 §5.0 的**闭包等级标注制度**：每条判据必须标注 `PROVES_CLOSURE` / `NECESSARY_NOT_SUFFICIENT` / `REVIEW_ONLY`，标第一级的必须能回答「它什么情况下会漏」，答不出就降级；标第二级的必须写明抓不到什么。

**应用后的诚实结果：本稿没有任何一条判据够得上 `PROVES_CLOSURE`。** §5.1 的 12 条机械门全部是 `NECESSARY_NOT_SUFFICIENT` 并逐条填了「抓不到什么」，§5.2 的 6 条是 `REVIEW_ONLY` 并写明由谁、对照什么、何时查。这个结果本身就是这次结构性修改的价值——它把原本隐藏的「其实没闭合」变成了纸面上看得见的事实。

两条 Major 的具体处置：

- **M-01**：`?` 信号已从「分类器」降级为 `NECESSARY_NOT_SUFFICIENT`，并写明它识别不了两种形态：`CatalogDefinitionFactsSql.java:31-32` 把 `LIMIT ?` 从词中间劈成 `" … LIM"` 与 `"IT ?"`（前半截不含 `?` 却同样参数顺序敏感）、以及 `CatalogWorkbenchReadServiceSql.java:107,110,112-115` 那些不含占位符的子句单元。**明确写出「这一类没有安全的机械分类器」**，其余部分不得据此推定为第一类。数字上我实测为 661 而 Codex 为 662，差异来自扫描口径，但**该数字已不承载分类职责，差异不影响结论**。
- **M-02**：更正了「后端已有现成落点」这个过头表述——`build.gradle.kts` 第 85 行确有 ArchUnit 依赖，但 `BackendModuleBoundariesTest` 现有规则**全是类依赖约束，一条方法级规则都没有**，**能力存在不等于落点存在**。并按 Codex 要求新增了「门—反例—闭包证明」五行表，其中「改名或间接实现」一列强制三选一，advisory lock 那条诚实填了「只能靠逐代码 review」。
- **N-01**：业务失败 envelope 从「待定」改为「详设决策项（非产品未决）」，并冻结三条约束，消除了与「本稿已无待裁决项」的冲突。

**Codex 已核实无问题的**：丙批 10 个回执 SQL 名单正确无错列漏列；R-4.1a 三类划分不需要第四类。

### Codex 需求 review 第 2 轮的处置（NO-GO，1M/3S/3N）

第 3 版经 Codex 复审，六条**全部核实成立并已修**，其中两条是我的实质错误：

- **M-01（Major）**：我把「禁止直接用底层 API」写成「合格的机器门」，**那是把必要的绕过检查当成了闭包证明**。实测 `AdvisoryLock.java:20-30` 自身就含 `SELECT pg_advisory_xact_lock` 字面量，该门会把 helper 本身判红；而改名的本地实现、别名调用、拆分字符串都能绕过它。R-11.2 已重写为「必要检查 + 四项约束」，并要求每条门配行为测试与 red mutation 补闭包。
- **S-02**：R-4.1a 的两类分法漏了「静态但有 SQL 语义」这一类。实测 `CatalogWorkbenchReadServiceSql.java:108-109` 把字面量 `'EXTERNAL_ORDER_TEMPORARY'` **从词中间劈成两半**；第 111 行的片段含占位符 `?`，而消费者按常量顺序拼接后按位置传参——**合并时改顺序会让参数错位而 SQL 仍然合法**，字节码等价门未必发现。已改为三类。
- **S-01**：helper 清单缺「helper 承担什么、feature 保留什么」这一列，已改为归属矩阵；并更正一条错误的依赖提示——我原写「审计写入 helper 会被 R-4 吸收」，实测 `StoreServicePointService.java:558` 的 `audit_event` INSERT 是内联字符串、该文件 `CONTINUATION_` 命中为 0，**R-4 碰不到它**，该 helper 仍须独立建立。同时补了业务失败 envelope 的归属待定项。
- **S-03**：丙批的回执 SQL 是 **10 个**不是九个，漏的是 workspace owner 那个，已列全名单。
- **N-01 / N-02**：游标 helper 需保留三个 wire adapter、审计标签的历史快照优先级，已作为详设约束采纳。
- **N-03**：标题仍写「第 2 版」而元数据是 VERSION=3，且第 393 行残留「三轮」。我上一轮机械扫描搜的是「三轮对抗审查」这个精确短语，而它写的是「三轮独立子 agent 审查」，**精确短语匹配漏掉了同义变体**；标题则从未检查过。两处已修。

**Codex 明确未推翻的**：C-9 的 helper 化方向、C-10 的全做范围、甲乙并行、R-4 必须先于丙批。

### Codex 需求 review 的处置（NO-GO，1M/8S/3N）

逐条重开源码核验后：

- **CONFIRMED 并已修**：S-07（「标记删除」19 个文件而非 18，且判据范围 `features/**` 会漏掉 `app/api/operationsProblemFeedback.ts:149` 这个用户可见入口）、S-08（载体漏了 `frontend-capability-lookup.md` 这张能力发现表）、S-03（Journey 模板没有同形对账表，「加一行」不可执行）、N-03（轮次元数据自相矛盾，reviewer 数不等于 round 数）、S-04（R-10.2 的表只是起点需声明）。
- **PARTIALLY_CONFIRMED**：M-01 的设计缺口成立并已写死 owner 边界与 null 载荷重放语义，**但它引用的路径是错的**——`CollaborationCommandReceiptService` 在 `modules/collaboration/.../application/`，foundation 下没有 `command` 包。S-05 的实质成立并已改为 discovery 分母加语义分桶，**但三方数字互不相同**（我 210、Codex 211/217、本轮实测 204/209），这恰恰证明它只能当发现起点。S-02 的 canonical timezone 成立（已定 C-7），但它把「字段级空值」与「列表空态」混为一谈，稿中已显式分开。S-06 的担心成立但我原文引的是第 6–9 行的颜色映射，已改写为只提升颜色映射。S-01 的三层拆分已采纳为 R-9.1 至 R-9.4。
- **接受为细化**：N-01（扩展字段历史标签快照与固定注册表的边界）、N-02（cursor identity 的 canonical encoding 需证明或补边界测试）。

**收口前机械自查另抓到 6 处**（该轮三个并行 reviewer 均未发现）：三处「见 §7」在裁决落定后未同步；R-7/R-8/R-9 缺子条目编号导致无法逐条追溯；§5 判据表完全未覆盖新增的 R-7/R-8/R-9；以及最重要的一条——`owner-read-model-and-lifecycle-standard.md:66` 是一条写着「标记删除」的既有 Dexter base-1 裁定，与 §3-K-7 和 D-1 冲突，且原本不在载体清单里。若不同步改写，下一个功能会继续照它写。
