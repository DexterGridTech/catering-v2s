# 门店终端管理 · 实现向详设

## 0. 输入、授权与口径

DATE=2026-09-24；设计复核=Claude R2 NO-GO（M/S/N=0/3/5），finding 已按逐项处置表修订；状态=IMPLEMENTATION_IN_PROGRESS；实施授权=true；动态验证授权=true；Browser L2/reset/DEV/seed 授权=true；UAT/部署授权=false。

输入：doc/plans/platform/2026-09-23-v2s-store-terminal-management-requirements-claude.md §0–14；同目录 2026-09-23-v2s-store-terminal-management-ia-codex.md 与 ui-interaction-design-codex.md，DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-24。项目规范：AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/backend-coding-standard.md、doc/platform/frontend-coding-standard.md、doc/decisions/templates/implementation-design-template.md、doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md、project-memory/decisions/deterministic-context-only.md 与 owner-read-model-and-lifecycle-standard.md。

权威依据：需求正本 §12 的 D-28 至 D-35、§4.9 与 V-29。本详设仅直接引用这些裁决编号，不另行陈述规范桥或裁决覆盖关系。Dexter 2026-09-24 明确授权按 R2 修订后直接实施，并授权契约/生成、代码/迁移、构建、全部测试与 backend-acceptance、Browser L2、最后 reset/DEV/seed。手填 8 位码不保证“随机、不可预测”，不能把自动分支的密码学保证虚称覆盖全部码；本批仍不做真实激活。DEV 固定码只用于受管非生产环境，不能作为生产凭证。UAT、部署、真实设备连接、打印与 TDP 不在授权内。


## 1. 真实目的、方案比较

一台“终端”是门店点位的功能集合与打印规则，不是物理设备在线事实。本期只保存、校验、展示，绝不做激活、TDP、打印或订单路由。选独立 store-terminal 业务 owner，作为 catering-business-server 内模块，不做第二 deployable。并入 organization 再用 Lookup 反转 catalog 依赖在技术上可做，但组织模块会承担打印规则；并入 catalog 则把门店设备点位误作商品事实。整终端一次保存优于分段命令，因为唯一版本、跨打印机/场景绑定和整体硬约束均须原子判定。新 owner 只通过 organization 与 catalog 的公开 API 读其事实，无跨 schema 写或 FK。

### 存储形态比较（S-5）

| 方案 | 形态与代价 | 结论 |
|---|---|---|
| A：六张规范化业务表＋回执表 | 终端、打印机、功能、范围引用、场景、场景打印机分别存储，回执另表；整终端保存须协调多表删改、稳定子项身份、子表唯一/FK 与多次写入回滚。 | 拒绝：本期没有独立子项查询、子项级更新或跨终端引用查询；为没有消费者的关系增加 DB/事务面复杂度。 |
| B：终端聚合行＋JSONB 配置＋回执＋owner 审计 | `terminal` 行承载 scope、名称、设备类型、生命周期、版本、激活码与 `configuration JSONB`；`command_receipt` 保存幂等结果；`store_terminal.audit_event` 保存 owner 事务内审计。 | **采用**：终端、回执、审计由同一 owner、同一 REQUIRED 事务闭合；不跨 owner 写 organization 审计表，也不增加公共审计写 API。完整聚合仍由 owner 校验。 |

采用 B 而不是 A，因为本期真实读写边界就是一个完整聚合，子项没有独立生命周期或外部 DB 消费者。数据库保留终端级唯一约束：集团空间内激活码全状态唯一、同门店未作废名称唯一；`configuration` 只要求 JSON object。打印机/功能稳定 ref 唯一性、终端内名称与连接标识唯一、场景与 printer 关系、型号/纸规格和全部闭集均由同一事务中的 owner 完整校验；这些判定本来就是请求整体校验，JSONB 不增加另一套验证。不存在需要对子项建立跨聚合 FK 的场景。新聚合 migration 不回填数据，仍按本批 reset 后 seed。

## 2. CP 与先后

| CP | 交付及 owning 范围 | 前置 | focused proof |
|---|---|---|---|
| CP-01 | H1–H8、品牌/型号/纸规格唯一 contract、generator、Java/TS/OpenAPI 产物 | IA ACCEPTED | 源哈希一致、闭集/关系红变异 |
| CP-02 | store-terminal 模块、组织域按 ref 窄读、三表迁移、全聚合事务/CAS/回执/自有审计写入/激活码；`terminal.status` 按后台规范使用三态 CHECK 并登记为 lifecycle 主数据；同步全仓迁移矩阵 | CP-01 | owner/DB focused，三表原子回滚、每命令恰一审计、撞码并发与 lifecycle 约束 |
| CP-03 | operations edge、admin-catalog、审计实体登记与门店授权读取路由 | CP-02 | 生成契约、scope/权限/隐私拒绝；V-25 HTTP 读回 |
| CP-04 | 运营后台六 IA screen，foundation 接线 | CP-01/03 | 逐控件 IA 对账及 focused/render |
| CP-05 | backend acceptance、测试、seed 数据正本和执行器、静态门 | CP-02..04 | V-1..29、red mutation、business/cleanup 分报 |
| CP-06 | CP 级 fresh 三维复核、全批整体复核、逐代码与详设 P9 | CP-01..05 | 只允许 MATCHED/OPEN；OPEN 不交付 |

每个 CP 完成且开始下一 CP 前，fresh 独立子 agent 只读对需求、详设/IA、项目记忆三维证伪；OPEN 由主 agent 修复后再复核。全批另做整体三维，不能用阶段结果相加替代。主 agent 独占写入。任何运行结果都要 business/cleanup 分开。

## 3. 横切机制逐项归属

以下是 `doc/decisions/templates/implementation-design-template.md` §3 的固定 18 行主表；后面的主题表只是展开，不能代替本表。`NECESSARY_NOT_SUFFICIENT` 表示所列观察不能单独证明整体正确；未实施前均为未来判据。

| 机制 | ① 现成能力/规范（精确落点） | ② 可执行观察及档位 | ③ 无现成时的约束形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | `contracts/catalog/admin-catalog.json` 的 page grant；`OrganizationTaskPathLookup` | acceptance 直发四种角色、跨店/停用门店均拒绝（NECESSARY_NOT_SUFFICIENT） | 新页接既有 selected-store scope，不以 URL 自称授权 | 七个 operation 中四个 GET |
| 写授权与 grant 复核 | `EDIT_STORE_CATALOG` 登记形态、edge grant registry | acceptance 三个 mutation 分别测 PG 有而 EDIT 无、跨店（NECESSARY_NOT_SUFFICIENT） | `EDIT_STORE_TERMINAL` 独立于 PG，owner 再核 scope | create/replace/status 三写 |
| 跨 owner 写与事务 | `StoreServicePointService` 的 owner command 与 REQUIRED 模式；backend 规范 §2 | focused 注入审计/子写故障后所有表及 receipt 均回滚（NECESSARY_NOT_SUFFICIENT） | organization/catalog 仅公开窄读，不跨 schema 写 | create/replace/status 与区域/标签 refs |
| 集合形态与分页 | `CollectionRequestSupport`、`OpaqueCollectionCursor` | acceptance 多页/坏 cursor/过滤后不空页（NECESSARY_NOT_SUFFICIENT） | 来源 owner SQL 先过滤后 cursor，详情不假分页 | terminal、area、tag 三种 Cursor；固定字典 Bounded |
| 缓存失效 / 改完刷新什么 | `refreshSignal`、generated RTK invalidation | frontend focused 写后列表及当前详情重读，切换时旧码即时消失（NECESSARY_NOT_SUFFICIENT） | 不全页 reload，不仅刷新左列表 | 三写与列表/详情/候选 |
| RTK 数据读取与加载判定 | frontend 规范 §3-B、generated RTK endpoints | frontend render 迟到响应及 isFetching/currentData 测试（NECESSARY_NOT_SUFFICIENT） | 不把上一门店的 currentData 渲染给新门店 | 三 Cursor、详情、固定字典 |
| 同一事实只有一个住址 | frontend 规范 §3-E、`useStoreServicePointReadModel` 参考形态 | focused 切换门店/终端及重新获取时核对唯一 owner 数据（REVIEW_ONLY） | 组件 state 只持选择/草稿，不镜像服务端终端 | 左列表、右详情、编辑抽屉 |
| 失败可见且原因不得改写 | frontend 规范 §3-D、backend 规范 §2-B/§1-D | acceptance→focused 核 409/422/500 及焦点/草稿保留（NECESSARY_NOT_SUFFICIENT） | 服务端 typed reason 不被 UI 改写成泛成功 | 全写入、两种候选、详情 |
| owner 错误到 HTTP 的映射与注册处 | `ContractProblemAdvice`、`operationsProblemFeedback.ts` | contract/acceptance 枚举 §4 CP-03 problem 表并检查原位错误（NECESSARY_NOT_SUFFICIENT） | 7 个本域领域码进入 disposition；每个 operation 的最终集合严格等于其 `errorSetRef` 基础集加该 operation 的 augmentation；401/403/404 沿用通用处理 |
| 幂等键构成与重放语义 | frontend 规范 §3-G、foundation receipt 协议；`StoreServicePointService` | focused/acceptance 同键同体、同键异码、结果未知重试（NECESSARY_NOT_SUFFICIENT） | 手填/自动两种 canonical 意图分开；receipt 不存原码 | 三写，尤其 create 两分支 |
| 该用生成物的地方不得手搓字符串 | backend 规范 §2-D、`edge-codegen.mjs`、本批规则 generator | generator --check/红变异＋编译类型检验（NECESSARY_NOT_SUFFICIENT） | H 字典 Java/TS/OpenAPI 同源，wire 由 edge 生成 | H1–H8、7 operations、前后 DTO |
| 日志落点与脱敏字段 | AGENTS.md 观测硬约束、observability standard | focused 日志截获与受管 run 实际日志查 code/连接标识/原 payload（NECESSARY_NOT_SUFFICIENT） | 仅稳定 request/run/阶段 ID，不打印秘密或原请求 | owner、edge、seed、acceptance |
| 迁移回填与可逆性 | 单一 Flyway history、`StoreServicePoint` 迁移集成形态 | Testcontainers 检查 terminal/receipt/audit_event、约束/索引及失败回滚（NECESSARY_NOT_SUFFICIENT） | 新 owner additive schema；旧数据为零、不回填；不承诺自动 down migration | 三张表与终端级索引；reset 重建整个目标数据库 |
| 前端共享行为 | `admin-ui-foundation` 的 `useDrawerFormLifecycle`、`useSubmissionLifecycle`、`useCursorCandidates` | focused/render dirty、关闭确认、候选取消与 focus（NECESSARY_NOT_SUFFICIENT） | 单页两 Card 布局留 app，生命周期绝不复制 | Create/Edit Drawer、列表、两类候选 |
| 管理后台交互一致性 | frontend 规范 §3-K-1..10、已接受 IA 六屏 | IA-ID 逐控件位置/样式/行为/失败恢复对照（REVIEW_ONLY）；L2 另授权 | 右侧详情是 Card；不得套不可编辑表单或伪 Drawer | TER-P01/C01/C02/E01/A01/M01 全部触点 |
| 候选/下拉数据源 | `StoreServicePointOwnerApi` 新窄读；`CatalogProductionTagOwnerApi.readTags/readTagReferencesByRefs` | acceptance 多页、旧作废、跨店、开关关闭（NECESSARY_NOT_SUFFICIENT） | 不抽取第一页后在 UI 过滤，不另存候选字典 | 桌台区、标签、规则字典、打印机型号 |
| 编码与名称呈现 | frontend 规范 §3-K；生成规则的中文标签 | render 核列表/详情/选项只显中文名与必要编码（REVIEW_ONLY） | 技术 owner key、内部 ref 不作用户文案 | 六屏、四角色、所有 H 字典 |
| 会同时坏的东西是否已声明为原子组 | `doc/platform/foundation-charter.md` §5-C、计划 CP-01..06 | CP 对账逐项核 contract→owner→UI→test→seed（REVIEW_ONLY） | create 两分支、码隐私、无序场景 printer 须同批收口 | 全七 operation、规则/审计/seed/验收 |

| 机制 | 本批落点 | 已有能力/不可复制的部分 | 判据等级与漏检边界 |
|---|---|---|---|
| owner/deployable | store-terminal 新模块，单个 catering-business-server | settings.gradle.kts 模块制式；TDP 保持空占位 | NECESSARY_NOT_SUFFICIENT；编译不证明业务归属 |
| 硬约束单源 | contracts/catalog/store-terminal-rules.json→Java/TS/OpenAPI | 对照 scripts/generate/store-operating-rule-catalog.mjs；不在两端另写清单 | NECESSARY_NOT_SUFFICIENT；hash 不证明语义 |
| 集合 | 终端/区域/标签 Cursor，详情 Detail，H 字典 Bounded | CollectionRequestSupport、OpaqueCollectionCursor、useCursorStack/useCursorCandidates | NECESSARY_NOT_SUFFICIENT；需跨页真值 |
| 权限 | PG-STORE-TERMINALS、EDIT_STORE_TERMINAL、SELECTED_STORE_SCOPE | admin-catalog 现有 page/action/scope 链 | NECESSARY_NOT_SUFFICIENT；需直发负例 |
| 回执/版本 | 三写分别持幂等意图，终端单版本 CAS | foundation 回执协议、AdvisoryLock；owner 自有表；不经 catalog token | NECESSARY_NOT_SUFFICIENT；需并发证明 |
| 生命周期 | ENABLED/DISABLED/VOIDED | owner-read-model；foundation 生命周期 Tag | NECESSARY_NOT_SUFFICIENT；需状态迁移真值 |
| 跨 owner | organization 区域、catalog 标签公开读 | CatalogScopeLookup、CatalogProductionTagOwnerApi；不跨 schema 写 | NECESSARY_NOT_SUFFICIENT；需旧引用/跨店反例 |
| 激活码 | create 可选 8 位数字字符串；空值走 SecureRandom；group 全状态唯一 | 不套人起编码的作废释放惯例；DEV seed 固定码仅在 fixture source | REVIEW_ONLY＋动态；静态不证随机质量和并发 |
| 审计/隐私 | AuditChangePolicy 新实体/字段白名单；只记签发事实 | AuditChange、audit-read；本批 IA 未批准历史弹窗入口，不新增该控件 | NECESSARY_NOT_SUFFICIENT；需搜索所有输出 |
| Drawer | useDrawerFormLifecycle、useSubmissionLifecycle、adminWideDrawerSurfaceProps | 子控件不自管 dirty，Shell 只消费锁 | NECESSARY_NOT_SUFFICIENT；真实焦点仍需 L2 |
| 状态确认/反馈 | StatusChangeConfirm、原位错误 | 不另建 confirmation/Toast 体系 | REVIEW_ONLY；文案需 UI 比对 |
| 刷新/旧详情 | refreshSignal 重读列表和当前详情，切换立即清旧码 | OperationsTransport、useStoreServicePointReadModel 的组合方式 | NECESSARY_NOT_SUFFICIENT；需迟到请求反例 |
| 日志 | run/request 关联、脱敏 | 观测规范；不得记录码/raw payload | REVIEW_ONLY；需运行日志检查 |
| seed/test | fixture 正本、既有四阶段与 scenario catalog | 不新建第二 seed/验收框架 | NECESSARY_NOT_SUFFICIENT；需实际 readback |
| UI/testId/L2 | storeTerminalTestIds.ts 的真实动作节点 | frontend 3-K-9；不以文字/CSS 定位 | NECESSARY_NOT_SUFFICIENT；本轮 L2 已授权，仍须先过 IA 逐控件 preflight |
| P9 | 实际变更文件逐项对 R/V/IA/设计 | 不复活 compliance-control | REVIEW_ONLY；抽样会漏死代码 |

本 implementation-facing design 逐字引用 doc/platform/frontend-coding-standard.md §3-K-8：“每份 UI-bearing Journey、交互稿和 implementation-facing design 都必须逐字引用本节”。TER-P01/C01/C02/E01/A01/M01 的 3-K-1..10 适用/排除按交互工件 §7；右侧是页面 Card，3-K-10 的详情 Drawer 专规不适用，不因此复制 AdminDetailActionMenu。

## 3a. 六屏 UI/testId 前置

TER-P01：左头新建、ref 选中、前后页、右详情编辑/更多；列表 DTO/DOM 无码。TER-C01：两设备 Radio、下一步、取消。TER-C02：基本信息新增“激活码（选填）”Input 与“不填写则自动生成”，为空/清空不预览随机码；手填重复在该项原位报错。TER-C02/E01：三区段导航，终端名/设备，每台打印机的名/品牌/型号/纸规格/连接方式/单字符串条件参数/移除，添加打印机，每功能实例增删/选中，范围同框“全部/指定”与远程候选搜索翻页，无桌台/外卖，每实例每场景勾选/订单类型/打印机多选，保存/取消/上一步；E01 不出现码的输入。TER-A01/M01：菜单项、确认/取消。testId 挂真实触点；动态 key 为稳定功能实例 ref＋场景 key＋打印机 ref，创建 draft 用本次稳定 client key，不用数组下标或可编辑名称。

逐控件记录 IA-ID、surface/container、位置、样式、行为、失败恢复、焦点与触点；不符先修 UI，UI_DESIGN_REVIEW、TESTID_REVIEW、focused 任一不通过即 L2_SCRIPT_ADMISSION=FAIL。Browser L2 已获本轮授权，但必须在上述前置核对全部通过后才执行；真实位置/焦点/叠层以 L2 证据验证，不能用静态 testId 升格。

## 4. CP 技术设计

### CP-01：规则单源

contracts/catalog/store-terminal-rules.json 与同目录 Draft 2020-12 schema 包含 deviceTypes、functions（设备支持、单例/多厨打、允许范围）、ranges、17 scenes（通过 `functionKey` 唯一归属功能并列出允许纸型；功能的场景列表由此关系派生，不在 functions 重复存储）、paperSpecs（2 热敏＋5 标签）、connectionMethods（条件参数与互斥）、orderTypes、printerBrands/models（modelKey、brandKey、可见名、paperSpecKeys、`allowedConnectionMethodKeys`、厂商来源 URI）。Schema 按连接方式 key 绑定参数语义：NETWORK→必填 `ipAddress/IPV4`，CLOUD→必填 `deviceId/IDENTIFIER`，USB/BLUETOOTH→必填 `deviceIdentifier/IDENTIFIER`，BUILT_IN→无参数；标识长度与控制字符边界也由 schema 校验。generator 读取并实际以 JSON Schema 验证源文件，再做跨表闭集与语义校验；它在 scripts/generate 生成 store-terminal/domain/generated/StoreTerminalRules.java、operations-admin/app/api/generated/storeTerminalRules.ts、contracts/openapi/components/store-terminal/store-terminal-rules.generated.json，支持 --check 和 sourceSha256；结构、非空关系/唯一 key/引用闭包、五种连接方式各自的错配 red mutation、6×2、17×7、型号×纸规格 12×7 与独立型号×连接方式 12×5 全表 red mutation。生成物不作第二事实源。Java owner 遍历生成定义作语义校验；TS 只作输入便利。

型号表按需求 D-35 冻结为 3 个已有具体型号＋9 个通用型号（每种纸规格一个通用型号，再加内置热敏 58/80）。通用型号只声明纸规格，不声称厂商兼容；“通用设备”是可选品牌值，具体品牌型号仍照常可选，之后按需增补。所有纸规格仍由所选型号决定，不允许用户自由输入。具体型号的纸规格必须有厂商依据；不承诺耗材 SKU、驱动、打印范围或真实连接。

| modelKey / 品牌与型号 | 允许的 H3 paperSpecKeys | 厂商一手依据及推论边界 |
|---|---|---|
| `EPSON_TM_T88VII` / Epson TM-T88VII | `THERMAL_58`, `THERMAL_80` | [Epson 技术参考](https://files.support.epson.com/pdf/pos/bulk/tm-t88vii_trg_en_revg.pdf)列出标称 58/80 mm 纸宽；实际卷纸宽分别为 57.5±0.5 mm、79.5±0.5 mm。H3 按标称规格登记，不把实测宽度当另一纸型 |
| `ZEBRA_ZD421D` / Zebra ZD421 Direct Thermal | `LABEL_40_30`, `LABEL_40_60`, `LABEL_50_30`, `LABEL_60_40`, `LABEL_80_50` | [Zebra ZD421 媒体规格](https://docs.zebra.com/us/en/printers/desktop/zd421-and-zd621-desktop-printers-user-guide/media/general-media-and-print-specifications.html)给出 direct-thermal 介质宽 15–108 mm、标签长度 6.35–991 mm；系列规格给出最大打印宽 104 mm。五种 H3 尺寸均在介质宽/长度范围内是本设计推论，不承诺边到边打印或具体耗材 SKU |
| `ZEBRA_ZD411D` / Zebra ZD411 Direct Thermal | `LABEL_40_30`, `LABEL_40_60`, `LABEL_50_30`, `LABEL_60_40` | [Zebra ZD400 系列规格](https://www.zebra.com/us/en/products/spec-sheets/printers/desktop/zd400-series.html)给出 ZD411 介质宽 15–60 mm、最大打印宽 56 mm、标签长度 6.35–991 mm。`LABEL_60_40` 的 60 mm 是卷材/标签介质宽（首维），处于允许上边界但不表示可打印满 60 mm；`LABEL_80_50` 超出介质宽上限而排除 |
| `GENERIC_THERMAL_58` / 通用热敏 58 毫米 | `THERMAL_58` | D-35 通用型号；只声明纸规格 |
| `GENERIC_THERMAL_80` / 通用热敏 80 毫米 | `THERMAL_80` | D-35 通用型号；只声明纸规格 |
| `GENERIC_LABEL_40_30` / 通用标签 40×30 毫米 | `LABEL_40_30` | D-35 通用型号；只声明纸规格 |
| `GENERIC_LABEL_40_60` / 通用标签 40×60 毫米 | `LABEL_40_60` | D-35 通用型号；只声明纸规格 |
| `GENERIC_LABEL_50_30` / 通用标签 50×30 毫米 | `LABEL_50_30` | D-35 通用型号；只声明纸规格 |
| `GENERIC_LABEL_60_40` / 通用标签 60×40 毫米 | `LABEL_60_40` | D-35 通用型号；只声明纸规格 |
| `GENERIC_LABEL_80_50` / 通用标签 80×50 毫米 | `LABEL_80_50` | D-35 通用型号；只声明纸规格 |
| `BUILTIN_THERMAL_58` / 设备内置热敏 58 毫米 | `THERMAL_58` | D-35 通用型号；仅适用于“设备内置”连接方式 |
| `BUILTIN_THERMAL_80` / 设备内置热敏 80 毫米 | `THERMAL_80` | D-35 通用型号；仅适用于“设备内置”连接方式 |

每个型号的 `allowedConnectionMethodKeys` 与可用 `paperSpecKeys` 同在 contract，由 generator 同时生成 Java 与 TypeScript 校验输入。级联以品牌为根：品牌未选时型号与连接方式均不可选；品牌选定而型号、连接方式均未选时，型号列该品牌全部型号、连接方式列该品牌型号所允许方式的并集；先选型号则连接方式收窄到该型号允许集合，先选连接方式则型号收窄到品牌与连接方式的交集；二者都选后必须是登记的有效组合。切品牌清空型号、连接方式、纸规格和连接参数；切型号仅在旧连接方式不被新型号支持时清空连接方式与参数，旧纸规格不在新型号候选时清空纸规格；切连接方式总清旧方式参数，若现有型号不支持新方式则清空型号与纸规格。UI 不自动替用户补选值，owner 在完整保存时重新校验。

具体型号连接方式按厂商产品系列的原厂连接选项登记，不代表具体设备已安装该选件；通用外接型号只接受 USB/蓝牙/网口/云端四种外接方式，设备内置型号只接受 `BUILT_IN`，不接受网口。三种具体型号纸规格已由 CP-01 官方规格核定并冻结在上表；型号×连接方式独立期望按下表固定，V-29 每行所用的示例连接方式必须属于对应集合。测试把 12 型号×5 连接方式逐格对照，不从 contract 反算期望；Java owner focused 覆盖每格允许/拒绝，HTTP V-29 仅对需求指定的代表请求与负例发请求。任一 contract 关系变更须同 CP 更新手写表、V-29/owner focused 期望并重跑生成与 focused 检查。

| modelKey | 允许的连接方式 | V-29 行示例 |
|---|---|---|
| `EPSON_TM_T88VII` | USB、蓝牙、网口 | 网口 |
| `ZEBRA_ZD421D` | USB、蓝牙、网口 | USB |
| `ZEBRA_ZD411D` | USB、蓝牙、网口 | USB |
| `GENERIC_THERMAL_58` | USB、蓝牙、网口、云端 | USB |
| `GENERIC_THERMAL_80` | USB、蓝牙、网口、云端 | USB |
| `GENERIC_LABEL_40_30` | USB、蓝牙、网口、云端 | USB |
| `GENERIC_LABEL_40_60` | USB、蓝牙、网口、云端 | USB |
| `GENERIC_LABEL_50_30` | USB、蓝牙、网口、云端 | USB |
| `GENERIC_LABEL_60_40` | USB、蓝牙、网口、云端 | USB |
| `GENERIC_LABEL_80_50` | USB、蓝牙、网口、云端 | USB |
| `BUILTIN_THERMAL_58` | 设备内置 | 设备内置 |
| `BUILTIN_THERMAL_80` | 设备内置 | 设备内置 |

纸规格按标签介质宽×长度解释；例如 ZD411D 的 `LABEL_60_40` 允许 60 mm 介质，但其最大打印宽为 56 mm，不承诺满宽打印。每个具体型号均属于其 contract 品牌；通用型号属于“通用设备”品牌，不声明制造商兼容。型号允许纸型只有一项则 UI 只读，多项单选。**不存在无可选型号的死路**：真实型号未登记时可选与纸规格相符的通用型号；内置 58/80 只能选相应内置通用型号。USB/蓝牙分别各一个非空字符串配置标识，同一终端同方式下不得重复；格式/长度/控制字符在 contract 冻结。网口仅 IPv4、云端设备 ID、内置无参数；不允许不相关字段随 request 混入。本期不验证物理连接。

contract 连接方式闭集（厂商证据只说明该系列可选接口，不作现场硬件识别）：`EPSON_TM_T88VII`、`ZEBRA_ZD421D`、`ZEBRA_ZD411D` 各允许 USB/BLUETOOTH/NETWORK；九个 `GENERIC_THERMAL_*` 与 `GENERIC_LABEL_*` 允许 USB/BLUETOOTH/NETWORK/CLOUD；`BUILTIN_THERMAL_58` 与 `_80` 只允许 BUILT_IN。Epson technical reference 说明该系列存在 USB、wired LAN 与 Bluetooth 接口配置；Zebra ZD400 series spec 与 ZD411/ZD421 guides 说明 USB 标准且 Ethernet/无线 Bluetooth 为可选连接配置。contract 只描述可配置方式闭集，现场设备是否具备对应选配不属于本批判定。

### CP-02：聚合、迁移与跨 owner

新模块 apps/backend/catering-business-server/modules/store-terminal 按 api/application/domain/persistence 分层，暴露 StoreTerminalOwnerApi：listTerminalPage、readTerminalDetail、listAreaCandidates、listTagCandidates、createTerminal、replaceTerminal、transitionTerminalStatus。单次写 command 带 store scope grant、actor、幂等键；owner 最终重核。一个 additive Flyway migration 创建 `terminal`、`command_receipt` 与 `audit_event` 三张表；`StoreTerminalAuditEventWriter` 实现 `AuditEventWriter`，由 store-terminal owner 提供，并与命令共用 JdbcTemplate 与同一个 REQUIRED 事务。不得写 `organization.audit_event`，也不新增公共审计写接口。terminal 行含 group/store ref、name、deviceType、status、version、8 位 activation_code 与 `configuration JSONB`。JSON 文档保存 printer/function/scope/scene 的完整规则和稳定子项 ref，不建业务子表、不设子项 FK；区域/标签只存 UUID ref，不跨 owner FK。`status` CHECK 必须恰好为 `ENABLED / DISABLED / VOIDED`，并在生命周期 policy 的主数据集合登记。数据库唯一约束为 group/code 全状态唯一与 store/name 非作废 partial unique；JSONB 只要求顶层为 object。打印机/功能身份、同终端名称与连接标识唯一、场景引用和型号纸规格由 owner 对完整聚合校验；名称锁与终端级唯一索引共同防重。作废保留 code 与整份配置。除本模块的真实 PostgreSQL 反例外，CP-02 必须同步全仓 `MasterDataLifecycleMigrationIntegrationTest` 的 `FINAL_STATUS_CHECKS`、`STATUS_DEFAULTS` 与 `FINAL_ACTIVE_INDEXES`；终端状态登记三态与无状态默认，门店名称 partial index 排除 VOIDED；其 `resetDatabase()` 必须删除本 migration 新建的 `store_terminal` schema，避免同一 Testcontainers 数据库内后续迁移场景重建时与前一测试残留冲突。`DatabaseBoundariesTest` 的临时 schema 清理清单也须覆盖新增 schema。集团空间激活码是永不回收的终端凭证，不加入“作废后可复用”的 partial business-key 索引闭集。

整聚合请求对既有打印机/功能实例携带 `ref`，对新增项携带本请求内唯一 `clientKey`；printer 与 function 新项的 clientKey 在该请求跨类型全局唯一。固定场景不另分配身份，以所属 function 的 `ref` 或 `clientKey` 加 `sceneKey` 标识。scene printer 元素必须且只能携带 `printerRef` 或 `printerClientKey` 之一。场景可在同一请求里引用刚新增打印机。owner 在关系校验前先为新项分配 ref，再解析 clientKey 引用。replace 按 ref 保留既有项身份（既有子项 ref 不变）；未在新完整配置提交的子项才视为本次移除。clientKey 纳入规范化幂等摘要，但不落入 JSONB。owner 在单事务内校验 clientKey 唯一、ref 归属、全部内部唯一性/关系、型号/连接方式/纸规格与规则闭集；JSONB 仅要求顶层 object，不依赖 DB JSONB 约束承担业务校验。

新建先 claim 回执；canonical intent 区分 `MANUAL` 与 `AUTO`，摘要包含所有子项 clientKey 但不含激活码。八位手填码空间过小，普通 SHA-256 摘要可被离线穷举，receipt/request hash 绝不存原码或可离线枚举的码摘要。对已完成 receipt 的手填重放，owner 在同事务用已存 terminal ref 取码，与本次请求码等值比较；同键同体回放返回 terminal ref，子项 ref 由随后读取终端详情确认，异码返回 `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT`，自动分支按 AUTO mode 匹配，不生成第二个码。未完成的同键并发由既有 receipt claim 序列化；失败事务回滚 claim 后可原意重试。edge/body 日志、trace、problem 不输出原码。创建名称用事务级 `AdvisoryLock` 保护规范化 store/name。replace/改名时按排序后的旧名与目标名锁定，防止创建、改名及 A↔B 并发改名绕过锁或死锁；数据库唯一约束是最后防线，冲突映射为 `STORE_TERMINAL_NAME_CONFLICT`，不在失败事务内重试。

手填码必须恰好八位数字字符串（保留前导零），与自动分支一样使用以集团空间全状态 unique 为精确冲突目标的 `INSERT ... ON CONFLICT DO NOTHING RETURNING`：零行即 `STORE_TERMINAL_ACTIVATION_CODE_CONFLICT`（409），绝不换成随机码，也不捕获唯一异常后在已失败事务内继续。省略、null 或空串统一为自动生成意图，每次 SecureRandom 给候选，最多 16 次；零行换码，耗尽报 `STORE_TERMINAL_ACTIVATION_CODE_EXHAUSTED`。回执只存非敏感 ref/version/status，不存 code；测试装配才能替换随机源并栅栏两并发候选。terminal JSONB 整体与 version CAS 在同一 REQUIRED 事务；完整配置文档更新失败必须完全回滚；状态写也 CAS。移除仍被场景引用的 printer，除非同次移除其绑定，否则拒绝；不静默解绑。软约束：空范围、零打印机、空场景订单类型/打印机、重叠厨打/终端范围及同 IP 跨终端均允许。

organization 的 StoreServicePointOwnerApi 增 bounded readAreasByRefs(workspace,group,store,refs)，从同源 persistence 读取当前类型/状态，含作废，不能用 listAreas 分页扫描代替。另增 task-specific searchTerminalAreaCandidates(workspace,group,store,query,cursor,pageSize)：在 organization owner 的 SQL 查询阶段按 ENABLED＋TABLE_AREA＋名称/编码关键字过滤，再做 cursor 分页；现有 listAreas 无 query/type/status 谓词，不能先取一页再在调用者内过滤，否则空页和漏候选。catalog 用 readTags(...usage=BINDABLE_CANDIDATE) 候选、readTagReferencesByRefs 旧引用，brand 由 CatalogScopeLookup.requireCatalogBrand 按持久 STORE 事实取，不信客户端。新 ref 必须本店/同品牌启用且区域为 TABLE_AREA；已存 ref 可保留原样，即使停用/作废/改型；“是否已存”只从数据库当前聚合版判，不能听客户端。不存在或跨 scope fail closed，不泄漏别店名称。经营规则开关不进入终端读写 gate。

三写事务序列冻结为：① edge 做 session、page/action grant 和 selected-store path 准入；② owner 在一个 `REQUIRED` 事务内重核 actor/store scope 并 claim 幂等意图；③ create 取空旧聚合、replace 锁定本终端并读当前 version/完整 JSONB，status 只锁定本终端并读当前 version/status；④ create/replace 才从 organization/catalog 公开 API 取得必要 refs 与持久门店品牌，区分“请求新增 ref”和“原聚合已存 ref”，来源读取失败直接 typed fail/回滚，不能降成空候选；⑤ create/replace 校验完整聚合与 H 规则，status 只校验允许的生命周期转换、scope 与 version，不重验未变更的 JSONB 配置或跨 owner refs；⑥ create 分配手填/随机码并插入 terminal 行，replace 用 expectedVersion CAS 原子替换完整配置文档，status 只改状态与版本；⑦ 同一 REQUIRED 事务内由 owner 的 `StoreTerminalAuditEventWriter` 写脱敏审计，并写不含码且仅含终端 ref/version/status 的 receipt 结果；⑧ 提交后以 owner 读回供 response，结果未知时同键查询 receipt，不再次盲建。任一步失败整体回滚（包括 claim、JSONB 配置和审计）；跨 owner 只有读，不借读边推导目标 owner 的锁或写权。旧 ref 的豁免只对相同身份/同一功能范围轴的原聚合成员成立，不是“此终端曾引用过就任意新增”。来源 owner 在判定后立即变更造成的既有引用失效，按已存 ref 的后续更新语义处理，不建立跨 owner 长期 FK/锁。

### CP-03：edge、权限、审计

OpenAPI source 与 operation catalog 登记七个 operation，paths shard 是 `r5-edge-materialize` 的生成物，不直接编辑。三个唯一源目录分别为 `2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`、`2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`、`2026-07-26-v2s-r5-error-code-disposition-catalog.json`；新领域码在处置目录 `v2sNativeCodes` 登记，operation 的 `errorSetRef` 选基础集合，逐 operation augmentation 仅登记增补项。`r5-edge-materialize` 的闭集结果等于 base set ∪ augmentation（去重、按生成器排序）；不可手改 paths shard。读用 `AUTHZ_READ`，写用 `OWNER_COMMAND`。七项逐 operation 映射为：

| operationId | errorSetRef | augmentation（仅列新增码） |
|---|---|---|
| `getOperationsStoreTerminals` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED` |
| `getOperationsStoreTerminal` | `AUTHZ_READ` | 无 |
| `postOperationsStoreTerminal` | `OWNER_COMMAND` | `STORE_TERMINAL_NAME_CONFLICT`, `STORE_TERMINAL_ACTIVATION_CODE_CONFLICT`, `STORE_TERMINAL_ACTIVATION_CODE_EXHAUSTED`, `STORE_TERMINAL_RULE_INVALID`, `STORE_TERMINAL_REFERENCE_INVALID` |
| `putOperationsStoreTerminal` | `OWNER_COMMAND` | `STORE_TERMINAL_NAME_CONFLICT`, `STORE_TERMINAL_RULE_INVALID`, `STORE_TERMINAL_REFERENCE_INVALID`, `STORE_TERMINAL_VOIDED_IMMUTABLE` |
| `postOperationsStoreTerminalStatus` | `OWNER_COMMAND` | `STORE_TERMINAL_STATUS_TRANSITION_INVALID` |
| `getOperationsStoreTerminalAreaCandidates` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED` |
| `getOperationsStoreTerminalTagCandidates` | `AUTHZ_READ` | `PLATFORM_COMMON_VALIDATION_FAILED` |

每行最终 `x-error-codes` 必须与所选基础集合和增补集合的并集完全相等；不得把常见码复制到 operation 增补中，也不得因 UI 文案需要扩大闭集。读需 PG-STORE-TERMINALS，写另需 EDIT_STORE_TERMINAL，四角色 GROUP/REGION/PROJECT/STORE，SELECTED_STORE_SCOPE；admin-catalog 菜单放 NAV-STORE-OPERATIONS，requiredDataNodeType=STORE。pageRegistry、生成菜单/权限、role seed 同步。集团 key/store ref 必须由 session/owner 范围判，URL 不是授权事实；停用门店与其他门店级页同拒。候选 read 由本页权限准入后调用来源 owner，不强迫用户另有桌台/商品管理页面权限，不复制来源 SQL。

schema 的 create 允许 optional activationCode：字段缺席、JSON `null`、空字符串三者均归一为 `AUTO`，恰好八位 ASCII 数字字符串归一为 `MANUAL`，其余（包括空格、Unicode 数字、7/9 位）422；OpenAPI schema 必须显式表达 `null | "" | /^[0-9]{8}$/`，生成 TS/Java wire 不得把三种自动输入误当成无效。update/status 禁止带 activationCode 或换 store；列表响应无 code，详情有 code，审计/receipt/日志皆无原值。owner 使用不可变 `ActivationCode` 值类型，`toString()` 固定返回脱敏标识；仅 detail response mapper 显式取原值。安全日志的敏感键黑名单加入 `activationcode`（忽略大小写，覆盖 `activationCode`），并以 focused test 验证顶层与嵌套 diagnostic 都不会输出。Problem 使用既有 envelope，错误码逐 operation 冻结如下；401/403/404/基础设施 5xx 仍走既有通用 HTTP/problem 处理，不另造本域码。`AuditEntityTypes` 增加 `STORE_TERMINAL`，store-terminal owner 为 create/replace/status 分别声明 `AuditChangePolicy`，由 owner 自有 writer 写入 `store_terminal.audit_event`。审计读取由 `StoreTerminalAuditHistoryService` 与持久化实现负责：一条 SQL 按终端 ref 找到归属门店（含 VOIDED），仅按已加载的门店可见事实授权，找不到返回 404、不可见返回 403；复用 `AuditHistoryResultSetReader`。`audit-read` 增加 StoreTerminal 变体、构造注入与依赖，`OperationsAuditHistoryController` 增加 `STORE_TERMINAL` 分派；边缘契约 `getOperationsEntityAuditHistory.entityType` 同时补齐已实际使用但漏登的 `STORE_SERVICE_POINT_AREA`、`STORE_SERVICE_POINT`、`STORE_QR_CONFIGURATION`。不新增终端页历史入口或 `OperationsAuditHistoryModal`。基本字段逐字段，打印机/功能/范围/逐场景订单类型与打印机集合按段写前后摘要；连接标识只记“已变更”。新建 activationCode 字段只记“已签发”，不论手填或自动；摘要、回执、日志及任何 HTTP 审计响应不得包含原码。审计在 owner 事务内写，不由 edge 异步补。

| owner reason / 现有 HTTP problem 类别 | HTTP | UI 定位与恢复；不得改变 cause |
|---|---:|---|
| `STORE_TERMINAL_ACTIVATION_CODE_CONFLICT` | 409 | create Drawer 的激活码项原位错误与焦点；保留草稿，手填码不被自动替换 |
| `STORE_TERMINAL_NAME_CONFLICT` | 409 | 创建/编辑名称项原位错误；保留其余配置 |
| `PLATFORM_COMMON_VERSION_CONFLICT` | 409 | 编辑/状态全局版本冲突；保留草稿并提供读取最新版动作，不自动覆写；不复用历史 `VERSION_CONFLICT` |
| `STORE_TERMINAL_STATUS_TRANSITION_INVALID` | 409 | 当前状态不允许该状态操作（含作废终态）；状态命令不写入，重新读取详情后按最新状态判断可用操作 |
| `STORE_TERMINAL_VOIDED_IMMUTABLE` | 409 | 直接编辑已作废终端；不写入，重新读取详情确认只读状态；没有恢复编辑路径 |
| `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT` | 409 | 提交意图冲突提示；不换新 key 静默重试 |
| `STORE_TERMINAL_REFERENCE_INVALID` | 422 | 精确到区域、标签或场景 printer ref/clientKey 的项；来源故障不是此码 |
| `STORE_TERMINAL_RULE_INVALID` | 422 | H 规则对应功能/场景/型号/连接参数项；未知 key 不回退默认值 |
| `STORE_TERMINAL_ACTIVATION_CODE_EXHAUSTED` | 409 | 仅自动分支 16 候选均冲突；保留草稿、允许同意图重试，不回退用户手填 |
| `PLATFORM_COMMON_RESULT_UNKNOWN` | 500 | 服务端明确返回 owner 结果无法确认；先查原幂等意图的 receipt/readback，不盲发新意图 |
| 浏览器传输中断（无 HTTP response/code） | 无 problem code | 保留草稿与原幂等意图；连接恢复后读详情/回执或按原意图重试；不得伪装成服务端 `PLATFORM_COMMON_RESULT_UNKNOWN` |
| `PLATFORM_COMMON_VALIDATION_FAILED` | 400/422 | 输入、cursor 或基础请求形态失败；按字段路径定位，不映射成领域关系错误 |
| 通用未认证/未授权/不存在 | 401/403/404 | 页面级权限/不存在反馈；跨店不得区分 ref 是否真实存在 |
| 来源 owner 不可用/不可判定 | 500 | 页面/Drawer 失败可见且不清草稿；禁止映射为 `REFERENCE_INVALID` 或空列表 |

本表 code 是 owner→`ContractProblemAdvice`→`operationsProblemFeedback.ts` 的同一词，不在前端另造 code 枚举。版本冲突固定复用 `OWNER_COMMAND` 基础集合中的 `PLATFORM_COMMON_VERSION_CONFLICT`；逐 operation 不再增补第二个版本码，不使用历史遗留 `VERSION_CONFLICT`。本域新增的七个领域码（名称冲突、激活码冲突/耗尽、规则无效、引用无效、状态转换无效、作废不可编辑）登记进处置目录 `v2sNativeCodes`。逐 operation 的 `x-error-codes`、HTTP、字段路径与焦点位置同步进入 OpenAPI、IA GAP 表、problem feedback 和 acceptance oracle；禁止留到实现期再选码。

### CP-04：前端文件和行为

新 feature 规划 StoreTerminalPage.tsx、model/useStoreTerminalReadModel.ts、model/storeTerminalCommands.ts、ui/TerminalCreateDrawer.tsx、ui/TerminalEditDrawer.tsx、ui/TerminalPrinterEditor.tsx、ui/TerminalFunctionEditor.tsx、ui/TerminalSceneEditor.tsx、storeTerminalTestIds.ts。StoreServicePointPage 与 OrganizationStructurePage 是各自页面内联的两栏布局，没有已经存在的共享主从 layout primitive；相似的列结构本身不足以证明共享布局 API 有稳定契约与行为。仍不把单行 CSS grid 抽进 foundation：本页不复用共享行为或生命周期，提取只会新增共享 API。两参照页当前没有窄屏堆叠规则；本页在内容区可用宽度不大于 992px 时改为列表在上、详情在下。此处明确不与参照页的固定两栏完全一致：本页右侧有密集打印机/场景资料，堆叠用于避免窄栏横向溢出，且已在 IA 与交互工件标明。共享列表、Drawer、dirty、状态确认、游标、刷新 primitive 必须直接复用。生成 RTK endpoints 供读取/写入，不自建 fetch/第二游标状态机。基本信息→打印机→功能范围，每功能的场景内分别存订单类型和无序 printer refs。移除已绑定打印机先列受影响场景并确认；纸型变更不暗删绑定，错误定位场景。切换门店/终端立即清旧详情与码，迟到响应不得覆盖。无写权限 DOM 无写节点；详情不是不可编辑表单；激活码不是 Form 控件。

### CP-05：测试与 seed

§10b、§11 给全量分母。owner focused、迁移集成、真实 HTTP acceptance、前端 focused/render/static、生成 --check/red mutation、fixture/executor/readback 同批。Browser L2 已获授权，但只有 UI 逐控件前置门通过后才运行；未运行前不标 PASS。

## 5. operation / path / face / 集合形态

统一前缀 /api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}。全部 operation 的 x-consumer-faces=operations-admin；来源区域/标签读是终端页专用 task read，不复用其维护页权限。

| operationId | 方法/后缀 | owner | 形态/授权 |
|---|---|---|---|
| getOperationsStoreTerminals | GET /terminals | store-terminal | Cursor、PG-STORE-TERMINALS、响应无 code |
| getOperationsStoreTerminal | GET /terminals/{terminalRef} | store-terminal | Detail、PG、响应有 code |
| postOperationsStoreTerminal | POST /terminals | store-terminal | 整聚合、EDIT_STORE_TERMINAL |
| putOperationsStoreTerminal | PUT /terminals/{terminalRef} | store-terminal | 整聚合＋expectedVersion、EDIT |
| postOperationsStoreTerminalStatus | POST /terminals/{terminalRef}/status | store-terminal | CAS 状态、EDIT |
| getOperationsStoreTerminalAreaCandidates | GET /terminals/area-candidates | store-terminal→organization | Cursor、PG、启用 TABLE_AREA |
| getOperationsStoreTerminalTagCandidates | GET /terminals/tag-candidates | store-terminal→catalog | Cursor、PG、启用本店品牌标签 |

operation/route 身份必须登记 contracts/registry/operation-handler-bindings.json，经过 scripts/generate/edge-codegen.mjs 生成 Java wire、route/permission registry、前端 RTK/menu；新增 operation budget 必须同步。GET 禁幂等键，三写均要求。Cursor query identity 含 group/store/query/pageSize，坏 cursor 类型化拒绝；详情聚合不设随意上限，固定 H 字典才是 Bounded。准确 DTO/property 由 CP-03 schema 与本节逐字段对账，不接受仅凭路径名推断接口存在。

## 6. 跨 owner 写与只读矩阵

| 终端任务 | organization | catalog | store-terminal 与失败边界 |
|---|---|---|---|
| 终端列表/详情 | store task path；旧区域按 refs（含作废） | 旧标签按 store dataNode+brand+refs（含作废） | owner 读自身聚合；不从读边取得写权 |
| 候选 | searchTerminalAreaCandidates 在 owner SQL 阶段过滤并分页 | readTags BINDABLE_CANDIDATE | 终端页 grant 准入；不走经营开关、不抽干分页 |
| create/replace | 门店可用与新增区域 ref 重核 | 新增标签 ref 重核 | 唯一写 owner；同 REQUIRED 事务验证完整聚合、CAS、审计；跨 owner 只读，不写别家表 |
| status | 门店可用与 actor scope | N/A | 当前状态、目标状态、版本/权限同事务重核；作废终态 |

owner API 消费者：StoreTerminalOwnerApi 的读取由 OperationsStoreTerminalController 调用；三种写命令必须沿既有 M1 生产链进入 owner：OperationsStoreTerminalController → BackendPerformanceM1CommandExecutionBindings → `PostOperationsStoreTerminalOperation` / `PutOperationsStoreTerminalOperation` / `PostOperationsStoreTerminalStatusOperation` → StoreTerminalOwnerApi → store-terminal owner。三个 operation adapter 是 M1 的真实被注入消费者，不是为目录形态预留的无消费者 wrapper；controller 不得绕过 M1 直接调用三写 API。focused/acceptance fixture 也可直接调用公开 owner API。organization 新 readAreasByRefs 由 store-terminal 校验及 detail display 使用；catalog readTags/readTagReferencesByRefs 和 CatalogScopeLookup 由 store-terminal task read/校验使用。不要扩展组织页维护操作来完成终端任务。

## 7. 声明—传递—消费闭环

| 声明 | 传递 | 消费/可证伪失败 |
|---|---|---|
| H1–H8、型号→纸型 | contract→generator→Java/TS/OpenAPI hash | owner 校验、UI 字典；未知值 422，单源 hash 仅 NECESSARY_NOT_SUFFICIENT |
| page/action | admin-catalog→generated grants→session/scope | edge＋owner 直发重核；403 |
| store/brand | OrganizationTaskPathLookup、CatalogScopeLookup | catalog 标签读取；跨店/跨品牌拒绝 |
| refs 当前状态 | organization/catalog task read | 新增须启用、旧失效保留；不存在 fail closed |
| version | detail→request expectedVersion→SQL CAS | 409，不覆盖 Drawer 草稿 |
| idempotency | UI 意图→edge→owner canonical hash/receipt | 同体回放、异体冲突、结果未知先查 |
| code | create 手填精确字符串或空值 SecureRandom→group/code 全状态 unique→详情 | 手填重复 409 不换码；自动撞码安全换候选；列表/审计/log/receipt 禁止原值 |
| audit | owner diff→AuditChangePolicy→audit-read | 只给脱敏摘要/签发事实 |
| testId | *TestIds.ts→动作节点→locator binding | 节点错即 admission BLOCKED；L2 已授权但不得越过 UI 前置门 |
| seed | fixture 正本→四阶段后的终端 post-step→owner HTTP→readback | business 与 cleanup 独立报告 |

以下机制行是本节强制跨层矩阵，与业务行同属施工判据，不能靠 §3 的“已读能力”代替：

| fact | declaration | transfer | consumption | proof/漏检边界 |
|---|---|---|---|---|
| 集合形态 | IA `collectionShapeAndScale`：terminal/area/tag Cursor，详情 Detail，H Bounded | 七个 OpenAPI operation 的 cursor/pageSize/filter 参数和错误 | RTK/useCursorCandidates 消费 nextCursor，不在客户端过滤当前页 | acceptance 多页/坏 cursor＋frontend focused；不能证明未来规模 |
| 授权执行点 | IA `stateAndPermission`：PG 读、EDIT 写、门店 scope | admin-catalog→generated edge grant→`OperationsStoreTerminalController` | `StoreTerminalOwnerApi` 三写复核 actor/store，来源窄读不要求维护页权限 | 四角色直发 7 operation；UI 隐藏不是授权证明 |
| 缓存失效 | IA `navigationAndRefresh` | `storeTerminalCommands` 成功后 refreshSignal/RTK tag invalidation | terminal list、当前 detail 重取；store/ref 切换立刻丢弃旧 detail/code | focused 迟到响应、成功/失败刷新；静态函数存在不证明调用 |
| 错误映射 | §4 CP-03 typed reason/HTTP/定位表 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java` 既有 envelope/registry | `apps/frontend/operations-admin/src/app/api/operationsProblemFeedback.ts`＋Drawer 字段错误 | acceptance 逐 reason、render 焦点/草稿；文本扫描不证明映射精确 |
| 日志与脱敏 | AGENTS.md 及 §4 禁止 activationCode/raw payload/连接标识泄漏 | owner/edge/seed 的 structured request/run/stage 日志点 | 诊断只看关联 ID 和脱敏摘要；审计仅“激活码已签发” | focused 截获日志＋受管日志/审计/receipt/read DTO 搜索；无码静态扫描不证明运行路径 |
| 幂等与版本 | §4 CP-02 MANUAL/AUTO 意图、terminal expectedVersion | edge idempotency key→owner receipt claim/CAS | 同体重放 ref，异手填码冲突；UI 不自动换 key；详情重读 | 并发与结果未知 acceptance；单元模拟不证明 DB 竞争 |

## 8. 每条需求的 owner 判定归属

| 需求范围 | owner 判定点 | 必须构造的反例 |
|---|---|---|
| R-C.1..6 / H1、H5、H6 | generated rules＋aggregate validator | 设备×功能 12 格、范围 24 格 |
| H2、H3、H4、H7 / R-4.1..6、R-5.1..6 | printer/model、scene、connection validators | 17×7 纸型、五连接方式及新 USB/BT 字符串、未知订单类型、场景 printer 身份/去重 |
| R-1.1..5 / R-2.1..5 | create/replace aggregate、stable refs | 跨店、空功能、重复单例、三个厨打不合并 |
| R-3.1..14 | ScopeValidator＋organization/catalog refs | 全部+指定、扫码区、旧失效、同编码新 ref、重叠允许 |
| R-6.1..5 / R-7.1..4 | transition/replace CAS、store path、软约束 allowlist | 作废恢复拒绝、并发双写、软约束不提示 |
| R-8.1..9（Dexter 新裁决覆盖原 R-8.1/8.3/8.6） | create 手填/自动分支、DB unique、详情专有码与隐私 | 手填重复不换码、自动并发撞码、前导零、不可改、列表/审计泄漏 |
| R-9.1..9 | edge grants＋owner scope＋audit | 四角色、停用门店、开关关闭、段落审计 |

该表是详设索引，不准替代实施计划的逐 R/V 分母。R-3.10 的“无生产标签商品不进厨打/KDS”是未来运行规则，本批只存“全部/指定”含义，不引入商品路由代码或伪动态 oracle。

## 9a/9b. 变更载体全集与定位

| 业务事实 | contract/生成 | backend/DB | frontend | 测试、seed、门 |
|---|---|---|---|---|
| H1–H8/型号 | store-terminal-rules.json/schema/generator、生成 Java/TS/OpenAPI | aggregate validator | 所有固定选择和中文名 | generator static/red mutation、owner 全表、seed 样例 |
| 新 owner、读写 | paths/components、operation-handler-bindings、admin catalog | module/build/settings、Flyway、controller、scope/read APIs | pageRegistry、生成 RTK、read model/commands | BackendAcceptanceScenarioCatalog、StoreTerminalAcceptanceScenarios、迁移测试 |
| 审计与码 | `getOperationsEntityAuditHistory.entityType` 补齐三个既有漏登值并新增 `STORE_TERMINAL`（共四个加入项）；由 edge materialize/codegen | `AuditEntityTypes`、owner `AuditChangePolicy`/`StoreTerminalAuditEventWriter`/`store_terminal.audit_event`、audit-read 新变体/SQL/Controller 分派 | 复用现有审计读取面，不新增终端页历史入口；列表无 code | 三表同事务回滚、白名单负例、V-25 HTTP、响应/日志/回执泄漏扫描 |
| 六 IA screen | testId 唯一源 | typed problem/owner readback | 页面与 7 个分工组件 | focused/render/static、IA 控件 roster；Browser L2 已授权，但需先通过逐控件 UI 前置门 |
| DEV 体验 | fixture 正本 | seed executor/post-step/报告 | 样例页面读回 | seed static/red mutation、reset/readback |

上述六行是索引；以下按模板 §9a 冻结每个事实的跨层同步分母，路径为已存在源或待新增目标，实施时以唯一锚点再核实，不得只凭此设计表称完成。

| 变更事实 | 契约/唯一生成源/生成物 | backend owner/edge/migration | frontend model/surface/state | focused/static/HTTP/L2 | fixture/seed 正本/executor | 结论/反例 |
|---|---|---|---|---|---|---|
| H1–H8/型号 | `contracts/catalog/store-terminal-rules.json`→本批 generator→Java/TS/OpenAPI，12 型号×7 纸规格手写期望矩阵 | `modules/store-terminal/domain` generated rules＋aggregate validator | `storeTerminalRules.ts`→Printer/Function/Scene editor | generator red mutation；owner 12/24/119/84 全表；frontend 全中文；L2 前置门通过后六屏验证 | 八样本打印机型号来自 fixture，terminal executor 回读 | 同步；原规则正本没有终端合同，不能 N/A |
| 终端 CRUD/授权 | `admin-catalog.json`；三个 edge 唯一源目录→materialize/codegen，不手改 paths shard | 新模块与 Flyway terminal 聚合表＋receipt＋owner audit 表、`OperationsStoreTerminalController`、scope+grant | `StoreTerminalPage`、read model/commands、RTK/pageRegistry | owner/迁移/HTTP 7 operation、frontend focused；L2 前置门通过后六屏验证 | fixture 八台、角色 seed、terminal post-step | 同步；reset 重建整个目标数据库 |
| 区域/标签候选与旧 refs | OpenAPI 两 GET 及 cursor schema | `StoreServicePointOwnerApi.readAreasByRefs/searchTerminalAreaCandidates`、catalog 公共 tag read | Create/Edit Drawer 的 `useCursorCandidates` 与已选旧 ref 显示 | source owner focused、多页/跨店/旧失效 HTTP，候选 render；L2 前置门通过后验证 | seed 从已建 area/tag readback 解 ref；共享 tag fixture 不改 | 同步；`listAreas` 无服务端过滤，不能 N/A |
| 审计写入与读取 | `getOperationsEntityAuditHistory.entityType` 单源补齐三个既有漏登值并新增 `STORE_TERMINAL`（共四个加入项）；不直接改 paths shard | owner audit_event migration/writer/policies；`StoreTerminalAuditHistoryService` 单 SQL；audit-read variant/controller/build dependency | 复用既有 audit-history surface，不增 IA 控件 | migration constraints、rollback、恰一事件、白名单拒绝；V-25 HTTP 403/404/voided/readback/无码 | 不承载审计 seed；测试只断言 DEV 测试码不泄漏 | 同步；组织审计表无终端写入 |
| 手填/自动激活码与隐私 | create optional 字符串、detail 专有属性、list 不含，typed problem | terminal unique、receipt MANUAL/AUTO 比对、SecureRandom 测试装配、owner 审计/edge/log 脱敏 | Create Drawer 选填/原位错、Edit 无控件、Page 详情而非列表显示 | owner 码竞争/幂等/DB unique、HTTP V14–17/25、frontend 泄漏负例；L2 前置门通过后验证 | fixture 固定八码，executor 手填并逐字详情回读、报告无码 | 同步；生产自动码不可改为 seed 常量 |
| 逐场景无序 printer set | H 场景合同/OpenAPI schema 不含 priority | terminal JSONB configuration 中按 function ref/clientKey＋sceneKey 保存 printer refs；aggregate validator、audit diff | `TerminalSceneEditor` 每场景多选，无功能级打印机控件 | owner/HTTP V9–13/22/25、render 两场景隔离；L2 前置门通过后验证 | 多厨打不同集合样本及 readback | 同步；不建 scene/printer 子表或顺序列；旧需求 V12/25 的顺序断言已被 Dexter 覆盖 |
| DEV 四阶段后置 | fixture contract JSON、非 OpenAPI 生成物 | 本批 owner HTTP seed 写；数据库由既有整库 reset 重建 | 页面体验读回，不另存状态 | seed static/red mutation、受管 readback/cleanup；L2 不承担 seed 正确性 | 新 terminal plan/executor；`r5-complete-seed-executor.mjs` 四组件校验后、business PASS 前的独立 post-step；旧 extension 9 的三个 executor `N/A_WITH_REASON` | 同步；不改四阶段/四组件顺序，不增加第五组件 |

实施前用 `rg --files` 冻结具体文件分母，新增文件是目标而非当前存在。同步检查 contracts/openapi-source、contracts/registry、edge-codegen 生成产物、generated operation count、角色预置、scripts/check、scripts/test/test-health-entry-runner.mjs。不能只改源不改生成物，也不能只改 seed validator 不改数据。frontend foundation 不变更时以 `N/A_WITH_REASON=仅单页主从 grid、共享生命周期直接消费` 明记，不为单页需求抽取无第二消费者的布局。

## 10. 数据迁移

仅 additive schema/table/index/check，不回填旧终端数据（本 owner 目前不存在），不触碰 TDP。`store_terminal.terminal` 是可人工启停/作废的主数据：`status` CHECK 必须恰为 `ENABLED / DISABLED / VOIDED`，并登记进 `contracts/policy/lifecycle-vocabulary.json` 的 `mainDataTables`；现有 lifecycle gate 只闭合 status 表的分类登记，三态 CHECK 值由真实 PostgreSQL 迁移集成断言。数据库同时承担全状态 group/code 唯一、非作废 store/name 唯一以及 configuration 顶层 JSON object 检查。新增 `store_terminal.audit_event`，其列、workspace FK、actor/changes/time 检查和按实体/时间倒序索引与 canonical `organization.audit_event` 定义一致；迁移集成需实际验证表、索引、FK、各 CHECK 与可写事件。`activation_code` 是不可变的设备凭证，不是可重用的业务标签；按 R-6.3/R-8.4，已作废终端仍永久占码。`name_normalized` 才是可重用的业务唯一键，按后台规范 §1-M 排除 `VOIDED`。printer/name、稳定 ref、连接标识、scene/printer 关系和 H 规则均由 owner 对整份 JSONB 聚合校验，不建子项 FK 或 scene/printer 唯一索引。迁移集成必须查 to_regclass、索引定义、三态/未知值真实写入冲突与回滚，不以 SQL 里存在关键词为 PASS。`V20260924_000000_000__store_terminal_owner.sql` 仅在确认只进入可丢弃的临时 DB 或最终整库 reset 的 DEV DB 时修改；若已进入任何不会被 reset 的数据库，则新增后续迁移，不改已发布迁移。reset/seed 已纳入本轮授权，按动态顺序显式执行，不随 DEV start 或 Flyway 自动触发。

## 10b. 丰富的 seed 数据与全链

唯一数据正本：doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json；标签数据正本沿用 contracts/policy/catalog-inventory-fixture-catalog.json。终端样例要引用真实已 seed 的 store-operating、area-table-main、store-operating 品牌下 HOT_KITCHEN/COLD_DISH/BEVERAGE/PACKING 等标签；不能凭编码直接造 ref。最少八台，分别在正本声明稳定 key、门店、状态、设备、功能/打印机/场景预期与读回 oracle：

| 样例 key/门店 | 功能与范围 | 打印机/纸型/连接/场景；目的 |
|---|---|---|
| term-front / store-operating / 62000001 | 台式点餐收银，指定 area-table-main＋无桌台 | `BUILTIN_THERMAL_58` / `THERMAL_58` / BUILT_IN，无参数；结账单；证明内置不需要连接参数 |
| term-kitchen-multi / store-operating / 62000002 | 台式两个独立厨打：HOT_KITCHEN 与 COLD_DISH，可重叠 | `EPSON_TM_T88VII` / `THERMAL_80` / NETWORK / `10.20.0.21` ＋ `GENERIC_THERMAL_80` / `THERMAL_80` / USB / `USB-KITCHEN-THERMAL-02` ＋ `GENERIC_LABEL_40_30` / `LABEL_40_30` / USB / `USB-KITCHEN-LABEL-01`；“制作单”同场景无序绑定前两台同纸型打印机，“标签制作联”绑定标签机 |
| term-kds / store-operating / 62000003 | 台式 KDS，全部生产标签 | 零打印机/零场景；固定 H 功能与软约束 |
| term-handheld / store-operating / 62000004 | 手持接单确认＋排队叫号，空桌台范围 | `GENERIC_THERMAL_58` / `THERMAL_58` / BLUETOOTH / `BT-HANDHELD-QUEUE-01`，排队号票 |
| term-label / store-operating / 62000005 | 台式厨打，指定 BEVERAGE | `GENERIC_LABEL_40_60` / `LABEL_40_60` / CLOUD / `CLOUD-LABEL-STORE-01`，标签制作联；证明云端设备 ID 与通用标签型号 |
| term-preparing / store-preparing / 62000006 | 手持厨打，全部生产标签；该店 tableManagementEnabled=false | 零打印机/空订单类型；关经营开关仍可用，与主店隔离 |
| term-disabled / store-operating / 62000007 | 台式出餐，全部桌台区＋外卖 | `GENERIC_THERMAL_80` / `THERMAL_80` / NETWORK / `10.20.0.27`；停用状态，可查看可编辑但不假定运行行为 |
| term-history / store-operating / 62000008 | 台式点餐收银，指定当前启用的 area-table-main | `BUILTIN_THERMAL_80` / `THERMAL_80` / BUILT_IN，无参数；先建后作废，详情读回保留码与原配置、列表不显示已作废；作废码不复用。旧失效引用只在隔离 acceptance fixture 中证明 |

若要体验无终端空态，保持 store-not-operating 零终端，不能把八台撒到所有门店。另在测试 fixture 中单独造跨集团、跨门店/品牌、作废区域、同编码新 ref、并发撞码；正式 seed 不应为制造所有负例污染可用体验数据。八个固定码只允许作为非生产受管 DEV seed 数据正本里的测试常量，经新建 owner 命令的手填分支写入；不得注入生产配置或替换生产随机源。任何终端创建冲突都立即使本次 seed 失败，不做详情比对、幂等对账或自动换码；run report 明确标记“需先 reset 后重跑”。只读取已成功创建终端的详情供最终 readback，激活码只在进程内与 fixture 逐字比较，禁止输出码；不扫描其他门店，也不记录原码。seed 报告与日志不输出明文，只记计划 key、长度、唯一性及脱敏摘要；DEV fixture 源文件含这些公开测试码，是本次 Dexter 明确允许的唯一非业务数据例外，不扩展到审计/receipt/HTTP 列表。每个终端 seed readback 将详情码与 fixture 固定码作内存逐字相等断言，并核 name/status/device/version、稳定子项 ref、每场景独立无序集合和具体/全部范围；列表绝不可回 code。

seed 文件同步的准确分母如下，区分“需改”和“只核无须改”，避免为了新终端碰已有扩展宿主断言：

| 载体 | 本期动作与判据 |
|---|---|
| `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` | 唯一数据正本新增八个 terminal 对象，逐条固定 `62000001`..`62000008`、完整 configuration 与型号/连接方式；同步 role-group、role-project 页面与写权限及 role-store 页面只读权限（无 EDIT）；将过时的固定 owner schema 数量措辞改为整库重建语义；现有区域/标签仍由原 owner 提供 |
| `scripts/dev/r5-fixture-contract.mjs`＋对应 test | `COUNT_KEYS` 与 `expectedCounts` 加 `storeTerminals: 8`，从唯一正本数据计数并验证八条身份/码格式/集团内全状态唯一/配置关系；原 `extensionDefinitions:9` 保持 9；不得复用正本既有 `terminalFixtureBoundary`（它指邀请到期的终态夹具，不是门店终端实体） |
| 新 `scripts/dev/store-terminal-seed-plan.mjs`、`store-terminal-seed-executor.mjs`＋各自 test | plan 只读 fixture 八条；executor 经 owner HTTP 建立/必要状态转移并逐详情读回；手填码取正本，失败不记录原码；单独计 `planned=created=readback=8`，声明 business/cleanup |
| `scripts/dev/r5-complete-seed-executor.mjs`＋对应 test | `COMPLETE_SEED_STAGE_IDS` 保持四值和原顺序，不新增 stage/component；现有四组件校验与整体 `business=PASS` 之间增加独立 post-step descriptor；上游失败不启动，post-step 任一 count/读回失败让父 business=FAIL，cleanup 独立；manifest 有 parent/child identity 与各计数 |
| `scripts/dev/r5-seed-plan.mjs`、`owner-command-seed-executor.mjs` 及其 tests | 同步 `role-group` 与 `role-project` 的 `PG-STORE-TERMINALS`、`EDIT_STORE_TERMINAL` 校验及 GROUP seed capability；`role-store` 只取得页面只读权且必须断言没有 EDIT。post-step 使用已完成邀请 `inv-completed-multi-a` 建立的 GROUP session 并显式切换到目标门店。extension 定义数量与 host 闭集的现有断言仍为 9，不改 |
| `scripts/dev/catalog-inventory-seed-executor.mjs` 及其 tests、`contracts/policy/catalog-inventory-fixture-catalog.json` | `N/A_WITH_REASON`：已有生产标签为来源事实，终端只在该阶段之后按 readback 解 ref，不复制标签或改 catalog fixture |
| reset 与完整 seed report/manifest、资源预检 tests | `r5-reset.mjs` 对受管目标执行整库 DROP DATABASE；post-step 跟随既有数据库重建和迁移。完整结果分别记 terminal post-step 的业务/清理，敏感码绝不输出 |

当前源码的父流程四组件 `owner-command→external-collaboration-business-channel→catalog-inventory→sales-menu`，且 `STATIC_PLAN` 是前置检查不是第五组件；`r5-complete-seed-executor.mjs` 末段现有四组件校验与 `business=PASS` 赋值之间是最小接点。post-step 不能独立伪装完整 seed；任何上游失败不执行，post-step 失败使整体 seed FAIL。角色 seed 复用现有角色与 `inv-completed-multi-a` GROUP session：`role-group` 必须拥有终端页与写 capability，`role-project` 同样授予并说明沿用桌台页的项目层先例，`role-store` 仅终端页只读且无 EDIT；读回断言必须验证前两者可编辑、后者只读。fixture builder 的可选功能范围、打印机、场景订单类型/绑定参数不得被强制必填，否则负例分母为零。静态红变异至少删一台样例、固定码重复/错格式、删一条场景 printer ref、post-step 提前、把 code 写入日志、count key 缺失/多余、型号/连接配置与正本不一致，均须变红。

## 11. 各类测试能力与 V-1..29

每层都有独立目的，不互相代替：contract generator 的 schema/单源 hash/红变异；Java owner focused 的全聚合规则和事务；Flyway/Testcontainers 集成的约束/索引/rollback；backend-acceptance 的真实 HTTP 权限、请求和读回；前端类型、focused/render/static 的 IA/交互/dirty/错误；seed executor 的数据正本、计划与回读；受管 run 的日志/资源 cleanup；Browser L2 已获授权，在逐控件 UI 前置门通过后验证真实控件、焦点与视觉行为；UAT/真实设备连接不在本批。所有 focused test 都记录 first failure/last known good，运行档位不得混称。

新增 StoreTerminalAcceptanceScenarios.java 并登记 BackendAcceptanceScenarioCatalog。V-1..25、V-28、V-29 是真实 HTTP 场景，每条有手写 fixture、request、非 response.ok 的业务 oracle；负例同时证明 typed problem 与未写入。V-1 设备功能 12 格、V-4 范围 24 格、V-9 的 17 场景合法归属＋非法宿主、V-10 的 119 格纸型、V-29 的 12×7 型号/纸规格全表均由手写期望矩阵驱动，不能用同一生成规则算 oracle。V-26（单源审阅）与 V-27（前端中文呈现）是非 HTTP 专项，明确不登记 `BackendAcceptanceScenarioCatalog`，分别由 generator/source review 与 frontend render 承载，不以空 HTTP 场景充数。大型数据驱动场景逐格报告 case identity 与 readback，不以一条总 PASS 藏失败。V-15 两并发的候选栅栏只在测试装配。V-24 在 terminal JSONB 配置替换已写入事务、提交前注入失败，验证完整旧聚合保持不变。测试 fixtures 不强制可空的打印机/范围/订单类型。

| V 项 | fixture/request/business oracle |
|---|---|
| V-1..4 | 12/24 全格，五单例各重复被拒，三厨打成功，零功能 create/update 均拒；成功逐值读回 |
| V-5..8 | 全部/指定不展开、扫码区/单桌拒绝、跨店与停用新 ref 拒绝、旧失效原样保留并同次新增启用 ref、同编码新 ref 不劫持 |
| V-9..13 | 17 场景归属、119 纸型格、五连接方式加 USB/蓝牙字符串、场景 printer 无序集合身份/去重/解绑、订单类型空与子集；V-12 新增 printer 以 clientKey 被同请求场景引用且同键重放返回 terminal ref，子项 ref 由详情读回确认；V-22 复核既有子项 ref 不变 |
| V-14..17 | 自动分支 SecureRandom 装配、前导零、并发/顺序/作废撞码永不复用；手填八位成功、短/非数字拒绝、前导零保留、同集团含作废重复 409 且不随机替换、跨集团同码成功；两分支创建后均不可修改，只在详情明文、列表 DTO/DOM 禁 code；已知 ref 的作废终端详情仍 HTTP 200 只读可读且不出现在列表 |
| V-18..24 | 四角色写拒绝、门店停用同形、所有经营开关关闭、三态/同名；非法状态操作返回 `STORE_TERMINAL_STATUS_TRANSITION_INVALID`、作废终端编辑返回 `STORE_TERMINAL_VOIDED_IMMUTABLE`，均断言没有写入；合法状态转换只校验转换、scope 与 version，不重验未变更配置；稳定厨打、软约束不拦/不提示、子写失败回滚与双版本冲突 |
| V-25..29 | V-25 真实 HTTP 经 `/api/operations/audit-history?entityType=STORE_TERMINAL` 核手填/自动创建只记“已签发”且响应无码、改名前后值、场景打印机增删集合、启用/停用/作废各恰一条、作废后仍可读、不可见门店 403、缺失 ref 404；V-26 为非 HTTP 单源 review、不登记 acceptance catalog；V-27 为非 HTTP 全字典中文 render、不登记 acceptance catalog；V-28 跨门店拒绝；V-29 为型号×纸规格全表且每行指定连接方式，含品牌/型号、未登记型号及内置/通用型号的连接方式不匹配负例 |

V-29 的手写纸规格期望矩阵固定如下，所有其余型号×纸规格格均为 HTTP 422；每个型号行声明本行请求使用的连接方式，该方式在上方独立的型号×连接方式手写表中必须为允许项。测试按同一 printer ref 依次提交并在每个成功格读回，拒绝格核对 version/configuration 未变。另测品牌与已登记型号不匹配、未登记型号、`BUILTIN_THERMAL_58 + NETWORK`、`GENERIC_THERMAL_58 + BUILT_IN`，均拒绝且无写入。两张期望表均不得由 contract/generator 产物反算：

| modelKey | 本行连接方式 | `THERMAL_58` | `THERMAL_80` | `LABEL_40_30` | `LABEL_40_60` | `LABEL_50_30` | `LABEL_60_40` | `LABEL_80_50` |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `EPSON_TM_T88VII` | `NETWORK` | ✓ | ✓ | × | × | × | × | × |
| `ZEBRA_ZD421D` | `USB` | × | × | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ZEBRA_ZD411D` | `USB` | × | × | ✓ | ✓ | ✓ | ✓ | × |
| `GENERIC_THERMAL_58` | `USB` | ✓ | × | × | × | × | × | × |
| `GENERIC_THERMAL_80` | `USB` | × | ✓ | × | × | × | × | × |
| `GENERIC_LABEL_40_30` | `USB` | × | × | ✓ | × | × | × | × |
| `GENERIC_LABEL_40_60` | `USB` | × | × | × | ✓ | × | × | × |
| `GENERIC_LABEL_50_30` | `USB` | × | × | × | × | ✓ | × | × |
| `GENERIC_LABEL_60_40` | `USB` | × | × | × | × | × | ✓ | × |
| `GENERIC_LABEL_80_50` | `USB` | × | × | × | × | × | × | ✓ |
| `BUILTIN_THERMAL_58` | `BUILT_IN` | ✓ | × | × | × | × | × | × |
| `BUILTIN_THERMAL_80` | `BUILT_IN` | × | ✓ | × | × | × | × | × |

前端 focused 包含六屏正常/空/失败/只读/冲突/结果未知、X/Esc/遮罩统一 dirty、同一厨打两场景分别绑定不同 printer 并只改其中一条、品牌→型号→纸型级联、连接方式清旧参数、旧 detail 请求晚到不闪码、动态 testId 真触点与全部 H 中文名。前后端静态门有真实 red mutation：删一个 H 条目、改模型→纸型关系、漏 operation binding、让列表 schema 返回 code、漏一格矩阵、破坏固定子项 clientKey/ref、让 fixture builder 强制填可选字段都应变红；此类门是 NECESSARY_NOT_SUFFICIENT。运行时记录 business/cleanup；全部动态执行已授权，当前结果尚未运行，保持 NOT_RUN。

新增激活码 focused/acceptance 分母：创建请求分别提交缺字段、null、空串、手填 01234567、七位、九位、含非数字；前三者走自动生成且同幂等意图，手填成功逐字读回，错误不得写入终端或留占用回执；同集团已启用/已作废码重复均返回 `STORE_TERMINAL_ACTIVATION_CODE_CONFLICT`，不得改为随机值；另一集团允许同码。前端还需测输入清空后帮助文案、重复码原位焦点、编辑抽屉没有码控件；seed 的八个固定码逐项在内存与详情对照，不把明文写入报告。不同手填码复用相同幂等键必须是 `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT`；同码同体重试只回同一 terminal/printer/function refs，不能新建第二个。

## 12. 未决、停机与项目边界

产品层暂无待 Dexter 决定项：USB/蓝牙单字符串及线框已确认。三个真实型号的纸型矩阵若与厂商证据冲突，CP-01 停机并报告具体冲突及最小选择，不编造。若生成链不支持 owner key、跨 owner 读缺旧作废行、seed post-step 不能保序、审计会泄漏码、H3 与厂家规格冲突或并发撞码不能安全重试，停对应 CP 报根因，不造 fallback。Browser L2 已获本轮授权，但必须先通过逐控件 IA—实现位置/样式/行为对账与脚本静态准入门；UAT、真实打印和 TDP 仍未获授权。

## 13b/13c. 双读、三维、逐代码对账

每个变更点写前重开需求/IA、六维命中项目记忆、详设及 owning source；focused 后用相同原文逐项回读源码和证据。每 CP 结束 fresh 三维复核，全部 CP 后整体三维复核。P9 以实际变更文件为分母逐文件、逐 R/V/IA-ID 反向比对详设，查零引用新增代码、设计点名却未产出的文件、测试和 seed 漏项；仅 MATCHED/OPEN，任何 OPEN 不交 REVIEW_TARGET=IMPLEMENTATION。动态 PASS 不能遮蔽设计偏移。

## 14. 交付前自查

需求 §11 的 12 项：1→§1/4；2→§4 CP-01；3→§4 CP-02/10；4→§4 CP-03；5→§4 CP-02；6→§4 CP-02；7→§4 CP-02；8→§6；9→§4 CP-03；10→§3a/4 CP-04；11→§11；12→§10b。本文全是设计义务，不冒称目前已有新模块、新 operation 或测试通过。

## 15. 实施期设计修订（Dexter 要求 Claude 定方案）

依据 `doc/review/platform/2026-09-24-v2s-store-terminal-audit-persistence-ruling-claude.md`，将审计持久化明确为 store-terminal owner 自有 `store_terminal.audit_event` 与读取路由：不写 organization 审计表，不建公共审计写 API；写入同 terminal 与 command_receipt 的 REQUIRED 事务，读取沿用 store-contract 的门店可见性单 SQL 模式。同步修改本详设 §1 方案 B、CP-02、CP-03、§9a、§10、§11 V-25；实施计划对应 CP-02/03/05。IA 不变：终端页不新增审计历史入口，V-25 通过已存在审计 HTTP surface 验收。
