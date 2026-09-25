SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 门店终端管理 · 实施计划（CP-07 设计纠偏后按 Dexter 授权实施）

## 0. 范围、事实与交付门

来源：需求正本 `2026-09-23-v2s-store-terminal-management-requirements-claude.md` 的 D-28 至 D-35、§4.9、V-29，以及已确认 IA、交互工件和详设。业务语义直接以需求正本为唯一来源，本计划不另立裁决桥。Dexter 已授权按 R2 修订后立即实施，并授权契约/生成、迁移、构建、全部测试、backend-acceptance、Browser L2、reset、DEV、seed；UAT、部署、真机激活/打印与 TDP 不在范围。所有未来结果在实际执行前均标记 NOT_RUN，不冒称 PASS。

### 0.1 · CP-05 性能基线选择（实施期已固化）

本批采用 `doc/decisions/2026-09-25-v2s-store-terminal-cp05-baseline-293.md` 的
`DEXTER-2026-09-25-V2S-STORE-TERMINAL-CP05-BASELINE-293` 决定：以三次受管运行的
`293` operation exact-set 作为当前 CP-05 基线，逐 operation 取最大值，不取平均值。
这不是 operation-scoped budget exception，也不删除生产标签作废引用保护分支；
`transitionOperationsProductionTagStatus` 的 `9` 次预算保留，因为其中两次是该分支的
权威引用事实读取。校准报告必须带非空 `budget.baselineDecisionRef`，缺失时校验器拒绝消费
三次报告；报告仍是唯一 build-time budget input，目录/库存契约只能由生成器产生。
不可从当前字节恢复的 `286` 报告不重建、不推算、不作为本批输入。

实施时按 AGENTS.md、backend-coding-standard.md、frontend-coding-standard.md；每 CP 主 agent 负责全部写入与运行，fresh 独立子 agent 仅只读三维审查。问题不能单点补丁：先扫同根族，找反例边界，再修可复用最小解。任何 CP 的静态/focused 结果与受管 business、cleanup 分开记录。

## 1. CP 顺序、产物、验证与明确 stop

| CP | 实际动作与文件分母 | focused 验证 | 步骤级三维门 |
|---|---|---|---|
| CP-01 合同单源 | contracts/catalog/store-terminal-rules.json/.schema.json；scripts/generate/store-terminal-rules.mjs；Draft 2020-12 schema 实际验证；生成 Java、TS、OpenAPI；生成登记与 --check；D-35 的 3 具体＋9 通用型号、每型号纸规格与允许连接方式及厂商来源一并冻结；schema 绑定五种连接方式与参数语义（NETWORK→ipAddress/IPV4、CLOUD→deviceId/IDENTIFIER、USB/BLUETOOTH→deviceIdentifier/IDENTIFIER、BUILT_IN→null）。官方规格已区分 Epson 标称卷纸宽、Zebra 介质宽与可打印宽，ZD411D 60 mm 只表示介质宽 | 完整 6×2、17×7、12×7 型号×纸规格手写矩阵（每型号行固定连接方式）；独立 12×5 型号×连接方式集合做 60 格逐关系检查并由 owner focused 验证；schema 空闭集/错引用/错误关系 red mutation，五种连接方式各有语义错配 red mutation（NETWORK 改成合法 IDENTIFIER 形状仍必须失败）；品牌不匹配/未登记型号/内置型号配网口/通用型号配设备内置四类 HTTP 负例；Java/TS/OpenAPI hash 一致。型号×介质规格按 CP-01 来源证据冻结；矩阵变化同步 V-29 并在本 CP 重跑 | 需求 H/R-C、D-35/V-29、已确认 IA、合同生成规范逐点 MATCHED |
| CP-02 owner/DB | settings.gradle.kts、app/module build；modules/store-terminal/api/application/domain/persistence；organization StoreServicePointOwnerApi 与同源 persistence 的 readAreasByRefs/searchTerminalAreaCandidates；三表 Flyway migration（terminal、command_receipt、store_terminal.audit_event）；owner `StoreTerminalAuditEventWriter`；lifecycle 主数据登记、全仓迁移矩阵与 cleanup 清单 | 手填与自动两路共用精确 activation 唯一目标；三表共享 REQUIRED 事务、审计后提交前故障全回滚；create/replace/status 各恰一事件；手填重复不换码、receipt 仅 ref/version/status 且 hash 不含码；状态/unique/lifecycle 与 12×5 型号×连接矩阵 | 需求 R1–8、详设 §4/§10、owner-read-model/coding standard §1-L/§1-M |
| CP-03 edge/权限/审计读取 | contracts `getOperationsEntityAuditHistory.entityType` 单源及生成物（STORE_TERMINAL 与三个既有漏登值）；operation-handler-bindings、M1 三个真实消费者 adapter、admin-catalog、edge/generated route/grants/RTK；`AuditEntityTypes`、owner policies、audit-read variant/build/controller dispatch；角色 seed | 七个真实 HTTP operation 均经授权；三写经过 controller→generated M1 binding→owner-specific operation adapter→StoreTerminalOwnerApi；V-25 真实 HTTP：签发事实无码、摘要差异、状态事件、VOIDED 仍可读、门店可见性 403/缺 ref 404；审计写不得落 organization 表；终端页不新增历史入口 | 需求 R8/9、详设 §5/7/V-25、权限与审计标准 |
| CP-04 六屏 | feature 的 Page、read model、commands、Create/Edit Drawer、Printer/Function/Scene editor、testIds、pageRegistry；foundation 对接 | 逐 IA-ID 控件位置/样式/行为、创建激活码选填/清空/重复原位错而编辑无此字段、中文字典全值、范围候选、三种 close、版本冲突、迟到详情不闪码、同功能两场景各自打印机 | IA 六屏＋frontend 3-K＋详设 §3a/4 |
| CP-05 全测试/seed | HTTP acceptance 登记 V-1..25、V-28、V-29；V-26/27 归非 HTTP 专项且不登记 catalog；fixture 正本八台、post-step、validators/executors、脚本及 tests；静态门 | V-1..29、12×7 手写型号矩阵、seed 8 样例 readback、缺省可选属性、红变异、全量 acceptance；检查运行日志与 cleanup | 需求所有 V、详设 §10b/11、backend-acceptance 标准 |
| CP-06 全批收口 | 整体三维对账、以实际变更文件为分母纳入 CP-05 决策/报告/36 个目录库存输出的逐代码对详设、完整动态顺序/证据 | P9 仅 MATCHED/OPEN；任何 OPEN 停；business 与 cleanup 都 PASS 才称动态完成 | 全需求、IA、规范复核；独立 implementation review 另行 |
| CP-07 交互与范围语义纠偏 | 需求 §15.13、IA/交互、详设 §16、本计划；规则正本/生成物；`TerminalConfigurationCodec`；Form/Function/Printer/Scene/model/testId/static/render；acceptance/seed/L2 控制面 | generator check/red mutation；owner/HTTP Queue 空范围与既有 function ref 换类型负例；前端 focused/render/static/type；L2 C02 真实新增 `QUEUE_CALL`/`KDS` 并断言范围组与无场景选择器缺席，再跑受影响 case→六场景；seed dry-run/readback（仅当实际 seed 载体变更） | 设计自审后 fresh 三维对账；CP-07 结束再做全批整体对账；任何 OPEN 停 |

CP-01 型号来源不足或冲突、CP-02 PostgreSQL 唯一冲突不能在原事务恢复或自有审计不能与终端/回执原子提交、CP-03 审计读取越权/错误或任一 HTTP 响应泄漏码、CP-04 foundation 能力被重造、CP-05 seed 阶段或测试分母不闭合，均须停对应 CP 报告，不用临时兼容层绕过。动态执行当前已授权，但仍须使用受管入口与资源预检，并遵守各验证前置门。

## 2. 逐链技术与代码布局约束

新 backend 模块 store-terminal 只一个 owner，api/application/domain/persistence 四层；不得在 app edge 写 SQL，不得用无消费者 Component operation wrapper 凑形态。三写命令使用三个实际由生成 M1 binding 注入并经 controller 调用的 owner operation adapter（create/replace/status），不得将 controller 改成绕过 M1 直调 owner，也不得保留零引用 adapter。organization 的区域新窄 read 包含作废；catalog 复用 readTags 的 BINDABLE_CANDIDATE 和 readTagReferencesByRefs。以 store 的持久 brand 判标签，不以客户端 brand 或编码判。全部/具体 refs 永不展开成当前清单存储。存储采用 terminal 聚合行＋JSONB configuration＋独立 receipt 行，不建 printer/function/scene 子表；数据库只约束终端级集团激活码、门店名称唯一性，聚合内部关系由 owner 校验。创建与编辑改名按排序后的旧名/目标名取得同一事务级名称锁，并由唯一索引兜底，冲突使用类型化领域错误；每条场景 printer refs 是无序 set，不存 ordinal/primary/backup。激活码全状态 group unique，创建 receipt 无明文，列表 API/DOM 无明文，详情唯一返回；已知 ref 的作废终端详情仍只读可读。上述各项都要以源码与测试双重核验。

前端禁止把页面做成一个巨文件：Page 只组合左右 Card 与 Drawer；read model 管当前 ref/游标/失效；commands 管提交流程；PrinterEditor、FunctionEditor、SceneEditor 只持业务表单字段，不自管 dirty/close 提示。所有共同行为用 admin-ui-foundation；不把一个页面的主从 grid 提升为新共享 primitive。场景配置的身份为功能实例 ref（创建态稳定 client key）＋scene key，不能因切换或重排行而串值。幂等键按 §3-G 实施：编辑与状态变更由请求内容派生，新建自动激活码同样由请求内容派生；新建手填激活码因不得进入持久摘要而保留 foundation 意图键，详设/实现对账登记 `MANUAL_ACTIVATION_CODE_IDEMPOTENCY_EXCEPTION`，且所有分支均不得把原码写入 receipt、摘要或日志。

## 3. R 子项 → 实施/测试/seed 同步 ledger

每格写的是未来责任，不是通过记录。符号 T 表示 StoreTerminalAcceptanceScenarios 的真实 HTTP fixture/request/oracle；O=owner/DB focused；F=前端 focused/render；G=generator/static/red mutation；S=seed fixture/executor/readback。N/A 必须说明原因。以下逐个列出编号，禁止只测代表项。

| 需求子项 | 代码落点 | 验证/seed 连带 |
|---|---|---|
| R-C.1, R-C.2, R-C.3, R-C.4, R-C.5, R-C.6 | 单源合同/生成；修改登记须有既有数据处置；deviceType 与终端 SurfaceForm 同值但本期不接入终端 App；UI 中文 | G 全闭集、删除/重命名红变异；F 每值中文；S 型号/功能样例；V-26 由 G/source review、V-27 由 F/render 承载，均不登记 HTTP acceptance catalog |
| R-1.1, R-1.2, R-1.3, R-1.4, R-1.5 | terminal store/name/device/code；未作废名称唯一、设备改型整体验证 | O DB unique/改型；T V-1/14/21；S 同店/跨店、台式/手持 |
| R-2.1, R-2.2, R-2.3, R-2.4, R-2.5 | function stable ref、单例与多厨打、范围/场景随功能删除 | O/T V-2/3/22/23；F 多实例隔离；S 两厨打/零打印机 |
| R-3.1, R-3.2, R-3.3, R-3.4, R-3.5 | TABLE_AREA “全部/指定”互斥、跨 owner 旧引用按 ref、候选不看经营开关 | O/T V-5/6/7/8/20；F 同框多选/空候选/旧状态；S 全部/指定/历史区 |
| R-3.6, R-3.7, R-3.8, R-3.9, R-3.10, R-3.11 | 无桌台/外卖轴、生产标签全部/指定、旧标签状态 | O/T V-4/5/6/7/8；F 功能各自范围；S 厨打标签与排队号票；R-3.10 运行路由不在本批，T 仅证存储语义 |
| R-3.12, R-3.13, R-3.14 | 空范围与重叠允许、ref 身份 | O/T V-8/23；S 空范围/重叠；F 无解释性软约束提示 |
| R-4.1, R-4.2, R-4.3, R-4.4, R-4.5, R-4.6 | printer 稳定 ref、名称、连接与型号纸型、无独立生命周期；新增项 clientKey，场景引用 ref/clientKey | O/T V-10/11/12/21/22/23/29；F 品牌/型号/纸型/条件参数；S D-35 型号与五连接方式 |
| R-5.1, R-5.2, R-5.3, R-5.4, R-5.5, R-5.6 | 所属功能内 scene、订单类型及无序 printer set；R-5.3 以新 IA 覆盖旧顺序 | O/T V-9..13/22/23；F 两场景互不改写；S 多场景不同 printer sets |
| R-6.1, R-6.2, R-6.3, R-6.4, R-6.5 | 三态、停用可编辑、作废终态与停用门店阻断；运行含义 N/A 本期不实现 | O/T V-19/21；F 状态/空态；S 停用/作废 terminal |
| R-7.1, R-7.2, R-7.3, R-7.4 | aggregate validator、CAS/事务、跨店/跨终端 ref、软约束不拦 | O/T V-4/6/12/23/24/28；F 原位失败；S 允许软约束样本 |
| R-8.1, R-8.2, R-8.3, R-8.4, R-8.5 | create 可选手填 8 位数字字符串，不填由 owner 安全随机；group 全态 unique、不可更换；Dexter 新裁决覆盖 R-8.1 自动唯一分支 | O/T V-14/15/16/21 加手填成功/重复/格式/幂等；S 八个固定 DEV 码经 create 手填分支，测试装配可控自动源 |
| R-8.6, R-8.7, R-8.8, R-8.9 | 详情明文、列表无码、自动分支安全换码而手填重复 409、无激活接口、审计/诊断脱敏；R-8.6/8.9 的 DEV fixture 明码例外按新裁决 | O/T V-15/17/25＋手填失败无残留；F 列表 DOM 无码；G DTO 泄漏 mutation；S 正本固定码但报告不输出原码 |
| R-9.1, R-9.2, R-9.3, R-9.4, R-9.5, R-9.6, R-9.7 | page/action registry、四角色、selected store、全部写操作 | T V-18/28；F 四角色 UI；S 角色授权正本含写/只读；G operation registry |
| R-9.8, R-9.9 | 无经营开关 gate；audit change whitelist/summary/签发事实 | T V-20/25；F 无未开通 surface；S 准备店关 table 开关照可用 |

H1–H8 的所有取值及相互关系必须由 G/O/T/F 四层各自证明：G 证明单源/输出，O 证明 owner 拒绝，T 证明 HTTP 与读回，F 证明中文与控件。S 只覆盖代表性可用配置，不承担 12/24/119/84 全格。V-29 的 12×7 期望格表由人工固定在详设/fixture 中，逐个 HTTP 尝试；另有独立手写的 12×5 型号×连接方式期望，generator 测试逐关系比较、owner focused 对 60 格逐一验证，不把 60 格都扩为 HTTP acceptance。品牌与型号不匹配、未登记型号各一个拒绝用例。R-9.9 的场景差异摘要按无序集合前后变化，不保留“主备顺序”遗留 oracle。

## 4. V-1..29 的 fixture、request、oracle 分母

| V | 后端和前端的真实反例 |
|---|---|
| V-1/V-2/V-3/V-4 | 手写 12 格设备功能、五单例重复、三厨打、零功能新建/更新、24 格功能范围；逐格 request、typed problem、成功逐字段 readback |
| V-5/V-6/V-7/V-8 | 全部+指定、扫码区/单桌、跨店、停用/作废新引用；旧失效同次新增启用 ref 仍可保存；同编码新 ref 不劫持原引用 |
| V-9/V-10 | 17 场景逐一合法及非法归属、119 格纸型；oracle 的期望表手写，不从生成定义计算 |
| V-11/V-12/V-13 | 五连接方式，USB/BT 单字符串与混入错字段；printer 无序去重、跨终端拒绝、改名身份稳定、移除须同次修绑定；订单类型空/子集 |
| V-14/V-15/V-16/V-17 | 手填八位含前导零、格式错/同集团已启用或作废重复原位 409、跨集团同码成功；空值自动生成走 SecureRandom、两个并发同候选的栅栏、作废不复用；两种来源均改/状态不变码，只在详情有完整码，列表没有 |
| V-18/V-19/V-20/V-21 | 四角色含项目/门店两方向，直发拒绝；停用门店同既有页面；关闭经营开关仍可读/写/选候选；非法状态操作返回 `STORE_TERMINAL_STATUS_TRANSITION_INVALID`、作废终端编辑返回 `STORE_TERMINAL_VOIDED_IMMUTABLE`，均断言未写入；三态/唯一 |
| V-22/V-23/V-24 | 稳定厨打、软约束不拦也不提示、子配置部分写后故障整事务回滚、双版本只能一胜 |
| V-25/V-26/V-27/V-28 | V-25 经审计 HTTP 读取核签发事实、前后摘要、三态事件、VOIDED 可读、门店授权与无码；V-26 单源 review 与 V-27 中文呈现是非 HTTP 专项、不登记 acceptance catalog；V-28 跨店读写拒绝 |
| V-29 | 12 型号×7 纸规格的 84 格手写表逐格 HTTP，每型号行明确连接方式；支持格成功读回，不支持格 422 且版本与配置不变；独立 12×5 连接方式期望在 owner focused 中逐格验证；品牌不匹配、未登记型号、内置型号配网口、通用型号配设备内置均拒绝且未写入；每种规格通用型号成功 |

V-4/5/7/8/10/15/24 各自独立场景和 oracle，不用别的 V 的 PASS 推定。T 的所有“保存成功”均读回业务值而非只读版本。fixture builder 允许省略可选字段；否则停机改 builder 与 test case，而非给每个 fixture 强塞默认值。测试中的码只用于断言，不能写日志/报告。

下表列出 HTTP acceptance 场景身份和最小 fixture/request/oracle；HTTP 场景 V-1..25、V-28、V-29 登记到 `BackendAcceptanceScenarioCatalog`。V-26 与 V-27 是非 HTTP 专项，不在该 catalog 注册：前者由 generator/source review，后者由 frontend render test 承载。全表驱动行逐格发真实请求且逐格读回/拒绝，不能用生成合同反算期望。

| V | 独立 scenario ID | fixture → request → oracle（含负例） |
|---|---|---|
| 1 | `storeTerminalDeviceFunctionMatrix` | 两类设备×六功能手写 12 格；逐格 create，10 成功读回、手持 KDS/出餐 422；台式含 KDS 改手持拒，同次移除 KDS 再改成功 |
| 2 | `storeTerminalFunctionCardinality` | 台式五单例分别双份 422；三厨打 create 成功且读回三 ref |
| 3 | `storeTerminalRequiresFunction` | 空功能 create 与删除最后功能 replace 均 422，无残留变更 |
| 4 | `storeTerminalFunctionRangeMatrix` | 六功能×四范围手写 24 格逐格 create/422，成功逐范围读回；空范围另由 V-23 |
| 5 | `storeTerminalRangeSelectionIdentity` | service point/扫码区/全部+指定拒；两个桌台区、全部桌台区、全部标签成功；新增子桌台/区域/标签后读回仍是原 ref 或 ALL sentinel |
| 6 | `storeTerminalNewReferenceEligibility` | 跨店区域/标签、停用/作废各两类分别 422；合法同店启用 ref 成功读回 |
| 7 | `storeTerminalHistoricalReferences` | 先引用启用区域/标签再停用/作废/改型；改名及同轴保留旧 ref＋新增启用 ref 成功读回当前状态；混入新停用 ref 422 |
| 8 | `storeTerminalReferencesUseRef` | 作废被引用区域/标签，原编码新建 ref；读回仍旧 ref/作废状态，绝不劫持 |
| 9 | `storeTerminalSceneOwnershipMatrix` | 17 场景逐个在所属功能成功、异功能拒；KDS/接单任一场景拒 |
| 10 | `storeTerminalScenePaperMatrix` | 17 场景×7 纸型手写 119 格逐格成功/422；已绑热敏改标签不改绑定 422 |
| 11 | `storeTerminalConnectionParameterMatrix` | 五方式合法写/逐字段读回；网口/云端缺错字段及 USB/蓝牙/内置混 IP/ID 拒；USB/蓝牙单标识缺失/重复/控制字符拒 |
| 12 | `storeTerminalScenePrinterSet` | 单场景重复/跨终端打印机拒；`{P2,P1,P3}` 无序集合读回相等；P1 改名身份不变；同请求新 printer 以 `clientKey` 被 scene 引用，写入与详情读回对应同一 owner ref；receipt 仅回终端 ref，新增/既有子项 ref 通过详情读取确认；相同键重放不产生新 ref；删 P1 未同步解绑拒、同次解绑成功；两个场景绑定互不影响 |
| 13 | `storeTerminalSceneOrderTypes` | 未知订单类型拒，合法子集读回相等，空集合及排队号票带类型成功 |
| 14 | `storeTerminalActivationInputs` | create 缺字段/null/空串自动生成八位，测试源前导零保留；手填 `01234567` 逐字读回；7/9 位或非数字 422，失败无实体/receipt 占用 |
| 15 | `storeTerminalActivationUniqueness` | 自动源栅栏两并发同候选换码，同集团跨门店仍唯一、作废码不复用，跨集团可同码；手填同集团启用/作废码重复均 409 且不换码；同键异手填码冲突 |
| 16 | `storeTerminalActivationImmutable` | replace/status 带码拒；改名/改型/改功能/停启作废逐次详情码不变；作废后通过已知 ref 的 GET 仍为 200 只读详情、列表过滤且写操作拒绝 |
| 17 | `storeTerminalActivationReadFace` | 只读角色列表 HTTP JSON 无码，详情有完整八位；前端 render 另证列表 DOM 无码、详情可见 |
| 18 | `storeTerminalPageAndWriteGrants` | GROUP/REGION/PROJECT/STORE 四角色，PG 有无 EDIT 的 GET/三写直发；项目和门店两个方向拒绝/允许 |
| 19 | `storeTerminalDisabledStoreParity` | 同一停用门店/actor、桌台二维码页及终端页读写逐项比较准入，桌台开关开启以去混杂 |
| 20 | `storeTerminalIgnoresOperatingSwitch` | 先建合法来源后关闭所有经营开关；终端 GET/POST、区域/标签候选仍可用 |
| 21 | `storeTerminalLifecycleAndNames` | 默认启用、停用编辑再启用、作废终态；非法状态操作返回 `STORE_TERMINAL_STATUS_TRANSITION_INVALID`，编辑作废终端返回 `STORE_TERMINAL_VOIDED_IMMUTABLE`，全局版本冲突复用 `OWNER_COMMAND` 基础码 `PLATFORM_COMMON_VERSION_CONFLICT`；三类失败均确认 version/configuration 未写入；合法状态转换仅校验转换、scope 与 version，不重验未变更的完整配置/跨 owner refs；店内活跃重名/同终端打印机重名拒，跨店同名与作废后复用名允许但旧码不复用；换店拒 |
| 22 | `storeTerminalFunctionRemovalIdentity` | 移除厨打①，其范围/场景消失、厨打②与既有 printer refs 不变；同请求新增 printer 后以 clientKey 绑定厨打②场景，修改①不改②；重放保持所有 owner refs，既有子项 ref 不变 |
| 23 | `storeTerminalSoftConstraintsAllowed` | 重叠厨打/终端、同 IP、空场景打印机/范围、手持 USB、结账单外卖类型全部成功、各自原样读回且无软提示；前端 focused 另证无提示 |
| 24 | `storeTerminalAtomicReplaceAndCas` | 子配置至少一段写入后注故障，全部 readback 与旧快照一致；同版本双写一胜一 409；DB 集成证明同事务 |
| 25 | `storeTerminalAuditSafeDiff` | 真实 HTTP `/api/operations/audit-history?entityType=STORE_TERMINAL`：手填/自动创建各只记“已签发”，响应页不含对应 8 位码；改名含 before/after；场景打印机增删含前后集合；启用、停用、作废各恰一条；VOIDED 历史仍可读；门店不可见 403、缺失 ref 404。focused 另断言三表事务回滚、每个命令恰一事件、白名单拒绝及 audit_event/receipt/log 均无码 |
| 26 | `storeTerminalSingleRuleSourceReview` | review-only：逐字核 contract→Java/TS/OpenAPI 生成及 owner/UI 无手写副本；generator test 是必要非充分，不伪装 acceptance scenario |
| 27 | `storeTerminalAllLabelsRendered` | frontend focused 遍历每个设备、功能、场景、纸型、连接、订单类型生成字典，断言业务中文名；非 HTTP 场景 |
| 28 | `storeTerminalCrossStoreIsolation` | 仅店 A grant 直发店 B 列表/详情/三写/候选，全部拒且不泄漏对象存在性 |
| 29 | `storeTerminalPrinterModelPaperMatrix` | 按详设 §11 的手写 12×7 矩阵用同一 printer ref 逐格 HTTP 替换；每个允许组合成功读回、每个不允许格 422 且当前 version/configuration 不变；另测品牌不匹配、未登记型号、内置型号配网口、通用型号配设备内置四类拒绝且无写入；所有 H3 纸规格均以对应 D-35 通用型号成功 |

V-26/27 的验收身份保留在本计划/详设，但不登记 `BackendAcceptanceScenarioCatalog`；分别通过源审阅与前端 focused/render 证明，不造空 HTTP 场景充数。V-14/15/29 所用可控生成源只在测试装配存在，手填分支不得调用它。每个 HTTP scenario fixture builder 的 optional 字段必须有“完全省略”调用点；有值默认 fixture 不可替代空输入反例。

## 5. seed 数据与执行载体的闭包

fixture 正本在新 `storeTerminals` 数据集中新增八个有名样本，固定 DEV 激活码依次为字符串 `62000001` 至 `62000008`，逐条明示并经 owner create 手填分支写入。不得复用已有的 `terminalFixtureBoundary`（邀请到期终态）。八个样本的打印机型号与连接冻结如下：

| seed key | 打印机型号/纸型/连接/参数 | 重点覆盖 |
|---|---|---|
| term-front | `BUILTIN_THERMAL_58` / `THERMAL_58` / BUILT_IN / 无参数 | 点餐收银、设备内置热敏 |
| term-kitchen-multi | `EPSON_TM_T88VII` / `THERMAL_80` / NETWORK / `10.20.0.21`；`GENERIC_THERMAL_80` / `THERMAL_80` / USB / `USB-KITCHEN-THERMAL-02`；`GENERIC_LABEL_40_30` / `LABEL_40_30` / USB / `USB-KITCHEN-LABEL-01` | 双厨打；“制作单”同场景绑定两台 `THERMAL_80` 热敏打印机，“标签制作单”绑定标签机；涵盖具体型号与新项 clientKey 引用 |
| term-kds | 无打印机 | KDS、全部生产标签、零打印机软约束 |
| term-handheld | `GENERIC_THERMAL_58` / `THERMAL_58` / BLUETOOTH / `BT-HANDHELD-QUEUE-01` | 手持排队号票与蓝牙标识 |
| term-label | `GENERIC_LABEL_40_60` / `LABEL_40_60` / CLOUD / `CLOUD-LABEL-STORE-01` | 云端设备 ID 与通用标签型号 |
| term-preparing | 无打印机 | 门店经营开关关闭时仍保存终端 |
| term-disabled | `GENERIC_THERMAL_80` / `THERMAL_80` / NETWORK / `10.20.0.27` | 停用终端规则保留 |
| term-history | `BUILTIN_THERMAL_80` / `THERMAL_80` / BUILT_IN / 无参数 | 作废终态、详情读回原码与配置 |

八台同时覆盖空范围、全部/指定、多场景无序 printer set；样本只从已 seed 的区域/标签 owner readback 解 refs。旧失效引用、跨 scope 与撞码负例用隔离 acceptance fixture，不改共享区域状态。固定码仅是非生产受管 DEV fixture 例外；任何终端创建冲突都立即使本次 seed 失败，不做详情比对、幂等对账或自动换码；run report 明确标记“需先 reset 后重跑”。成功创建后的 seed readback 在内存逐字比较码；报告/日志/审计/receipt 不记码。终端详情读回分母为八台（含作废终端）；列表读回按 owner 的可见性语义只包含七台未作废终端，且两处都不返回激活码。store-not-operating 保持零终端为空态；store-preparing 保持经营开关关闭但有终端。角色授权正本及断言为：`role-group` 与 `role-project` 均有 `PG-STORE-TERMINALS` 和 `EDIT_STORE_TERMINAL`（沿用桌台页项目层授权先例）；`role-store` 仅有页面权限、明确无 EDIT。后置执行器使用 `inv-completed-multi-a` 建立的 GROUP session 后切换目标门店；seed readback 验证 group/project 可写、store 只读。另由 acceptance 覆盖四角色与项目/门店 scope。

同步的精确文件与 `N/A_WITH_REASON` 见详设 §10b：fixture JSON、`r5-fixture-contract.mjs`/test、`store-terminal-seed-executor.mjs`/test、`r5-complete-seed-executor.mjs`/test、run manifest/report/readback 必须改；不存在独立 `store-terminal-seed-plan.mjs`，因为 executor 的 `buildStoreTerminalSeedPlan` 与 `--plan-only` 已是唯一 plan 住址，拆出第二文件会复制校验逻辑。JSON 正本中的固定 owner schema 数量描述改为整库重建语义。`r5-reset.mjs` 对受管目标执行整库 DROP DATABASE。`COUNT_KEYS` 与 `expectedCounts` 必须新增 `storeTerminals:8`，从唯一 fixture 正本计数；不能只在执行器单独写死。`r5-seed-plan.mjs`、`owner-command-seed-executor.mjs` 及 tests 必须同步 `role-group`/`role-project` 的页面与写权限断言、GROUP seed capability 和 post-step 的 GROUP session 语义；`role-store` 仅有页面权限且无 EDIT。其余 catalog seed executor/tests 与标签 fixture 仅核不改；extension `definitions.length === 9` 与 hostCount=9 保持。完整 seed 四阶段/四组件顺序冻结，不增第五组件或新 stage；在第四组件校验之后、父 `business=PASS` 之前，用父流程独立 `postSteps` descriptor 执行 terminal post-step（STATIC_PLAN 仍是前置检查）。post-step 有独立 run identity、`planned=created=readback=8`，其中详情逐台读回八台（含作废终端），列表读回按状态过滤后预期七台，business/cleanup，并纳入父结果；上游失败不执行，post-step 失败父 business=FAIL。任何终端 create 冲突立即 fail，report 标记需先 reset 后重跑，禁止详情协调或自动换码。红变异：删样本、重复/错格式固定码、错型号/连接样本、错 ref、漏 `storeTerminals` count key、post-step 次序错误、码出现在报告/日志、配置 readback 不符、group/project 失去写授权或 store 获得 EDIT，均须失败。只改校验器不改数据、只改数据不改执行器、只断言执行数不读回业务事实，均不闭合。

## 6. 测试能力清单与动态顺序（当前已授权，按前置门执行）

| 层 | 载体与关键 oracle | 证据档位 |
|---|---|---|
| generator | 新 generator 的 --check/test；H 闭集、引用关系、源 hash、真实红变异 | static/focused；不是 owner PASS |
| backend owner | store-terminal/src/test 的规则/幂等/CAS/隐私/失败恢复；organization 按 ref 旧引用 focused | focused；不是 HTTP PASS |
| Flyway/DB | Testcontainers 真实 migration/约束/索引/transaction rollback、并发撞码 | DB integration；不是验收全量 |
| backend acceptance | StoreTerminalAcceptanceScenarios，真实 HTTP CONTRACT/BUSINESS/DB_OPERATIONS；catalog 显式登记，全 V | 真实业务；cleanup 单列 |
| frontend | store-terminal 的 model、Page、Create/Edit Drawer、Printer/Function/Scene editor、testId 的 focused/render/static；现有脚本列表接入 | UI focused；不是 L2 |
| seed | fixture/parser/plan/executor/post-step，8 样本与五连接方式 readback、角色/跨店 | 本轮已授权；必须通过受管 reset→DEV→seed 路径执行，business/cleanup 分列 |
| L2 | 先 IA 控件位置/样式/行为逐项比对，脚本静态对账真实 testId 触点，再全六屏 L2；browser-l2-runtime.mjs/locator binding/blueprint 同步 | 已授权；UI_DESIGN_REVIEW、TESTID_REVIEW、focused/static 任一未通过则 BLOCKED，不进入 L2 |
| UAT/设备 | 真机激活、打印、TDP、订单路由均不在本期 | NOT_AUTHORIZED/OUT_OF_SCOPE |

### 动态前整体准入（进入 L2、reset、seed 的共同硬门）

在任何 Browser L2、reset 或 seed 之前，必须完成并记录一次当前字节的整体准入：

1. CP-01 至 CP-06 的步骤级复核均为 `MATCHED`，且已经完成一次独立的全批三维对账；
2. 详设 §3a 的六个 L2 case 分母、candidate/blueprint/scenario/timing/fixture 五份 case 来源 exact 集合、operation 覆盖并集、控制面文件全集、UI 源目录、`UI_DESIGN_REVIEW=PASS`、`TESTID_REVIEW=PASS` 与 `L2_SCRIPT_ADMISSION=PASS` 均齐全；fresh 独立准入复核记录必须存在，并绑定控制面/UI 的同一字节摘要；
3. `node scripts/dev/r5-complete-seed-executor.mjs --dry-run` 必须成功，且包含终端后置计划、八台终端和父流程首败回传；
4. `scripts/test/browser-l2-runtime.mjs` 在 readiness 和 run 两个入口都必须重新读取准入并校验摘要；缺记录、`BLOCKED`、准入后控制面或 UI 任一字节改变，均拒绝启动。相同 case、相同失败族、相同准入摘要且上次 business=FAIL/cleanup=PASS 时，禁止无变更重跑。

`r5-reset.mjs` 在任何受管 DEV 停止或 `DROP DATABASE` 之前再次调用父 seed dry-run；dry-run 失败时不得停止 DEV、不得 DROP，父报告必须携带终端子阶段的 `FIRST_FAILURE`。完整 seed 只能由同一父流程在 reset 后执行终端 post-step；不得把独立 terminal executor 的成功冒充完整 seed。该阶段的状态报告固定包含两行：`当前字节上的最新运行（run id、时间、结果）`；`最后一次通过（run id、时间、是否与当前字节一致）`。

按已授权顺序执行：合同生成 check 与 red mutation→backend/frontend focused、render、static、类型检查→迁移集成→真实 HTTP backend-acceptance（V-1..25、V-28、V-29；V-26/V-27 各按非 HTTP 专项）→run-level budget 与 `scripts/verify`→IA 六屏逐控件位置/样式/行为比对及 testId 真实触点核对→动态前整体准入与 seed dry-run→全部前置通过后 Browser L2→受管 reset→DEV start→完整 seed post-step 与八台 readback/角色权限验证→P9/独立实现审查/交付。每次受管执行先预检资源身份，Testcontainers 与 DEV 联动按 AGENTS.md 关闭/恢复；保存 first failure、last known good、阶段日志、business 与 cleanup。DEV start 本身绝不 seed；reset 与 seed 显式分开。

## 7. 全链同步与不遗漏判据

所有新增/修改测试都加入 scripts/test/test-health-entry-runner.mjs 适用显式列表；operation/path/face、admin-catalog、generated bindings、角色 seed、Flyway migration、OpenAPI source/component、前后端 generated client/route、audit entity、fixture 正本、每个 executor/plan/阶段、frontend static/render/red mutation、acceptance catalog/fixture builder 必须以实际变更文件表逐项记录。reset 整库 DROP DATABASE；仅对实际存在且适用的源/生成清单登记检查。无变化项写 N/A_WITH_REASON，不能留空。“能找到一份测试”不是闭包：每 R 子项须有 owner 判定＋反例＋至少一个合适层的动态 oracle；seed 不承担所有负例，acceptance 不代替 seed 数据。

## 8. 逐代码与详设 P9 的固定步骤

在交付 review 前，先列实际全部变更文件与新增符号，不按章节抽样。每一行回答：本文件/符号对应详设 §、需求 R/V、IA-ID、适用规范、测试/seed/生成同步、真实结果档位、是否存在零引用新增类或设计点名未产出文件。再从详设 §3–11 反向逐项找 owning source；漏一边即 OPEN。P9 只允许 MATCHED 或 OPEN，禁止 PARTIAL、PASS_WITH_EXCEPTION、ASSUMED。OPEN 不交付，不以多跑一次测试遮掩。步骤级与整体三维对账各自留结论，reviewer 只读，不由作者自审代替。

## 9. 静态自查与 review 边界

执行前状态为 NOT_RUN；实际完成后逐项替换为真实档位和 evidence，失败项保留 NOT_RUN/OPEN 而非 PASS。实现中如发现厂商证据冲突、既有契约生成链/受管 seed 无法保序、审计泄漏激活码或原始需求新冲突，停 CP 报告根因，不能绕过。需求 §11 十二项在详设 §14 逐项定位。实施完成另由 fresh 独立 reviewer 依据详设重开生产源码与行为证据。

## 10. CP-07 交互纠偏批次实施计划

CP-07 是对当前已实现终端管理的整体纠偏，不拆成“先改几个控件、再由 L2 找问题”的点状工作。其业务目标、有效 UI 语义和后端不变量以需求正本 §15.13、IA/交互工件当前版本和详设 §16 为准。

### 10.1 执行单元与精确分母

| 顺序 | 变更单元 | 必须修改/核对的路径 | 关键根因与完成证明 |
|---|---|---|---|
| 1 | 设计与准入失效 | 需求 §15.13；IA；interaction；implementation-design §16；本计划 CP-07；`contracts/policy/store-terminal-l2-admission.json` | 旧 Steps/步骤文案不再是有效设计；UI/L2 控制面变更前 `L2_SCRIPT_ADMISSION=BLOCKED`；fresh 只读三维对账后才进代码/动态准入 |
| 2 | contract 单源 | `contracts/catalog/store-terminal-rules.json`、`scripts/generate/store-terminal-rules.mjs`、`scripts/test/store-terminal-rules-generator.test.mjs`、三类生成物 | `QUEUE_CALL.allowedRangeKeys=[]`，`NONE` 不存在于本域规则；`--check`、闭集/交叉引用和删除 NONE 的 red mutation 通过；不得手改生成物 |
| 3 | owner 不变量 | `apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/TerminalConfigurationCodec.java`、`apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/domain/TerminalConfiguration.java`、`apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerService.java` 及 `apps/backend/catering-business-server/modules/store-terminal/src/test/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerServiceTest.java` | prior configuration 的每个既有 function ref 与新请求 key 逐一比较；变更即 typed rule invalid、无 terminal/receipt/audit 写入；新 clientKey 可选任意合法类型；空 ranges 合法，NONE 不合法 |
| 4 | 后端业务分母 | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java` 及同目录 fixture/builder | Queue 空 ranges 成功读回；既有 function ref 换 key 返回 `STORE_TERMINAL_RULE_INVALID` 且 version/configuration 不变；场景为空不产生假配置；每个新增场景按真实 HTTP、CONTRACT/BUSINESS/DB_OPERATIONS 分开记录 |
| 5 | Drawer 结构 | `apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalFormDrawer.tsx`、`TerminalCreateDrawer.tsx`、`TerminalEditDrawer.tsx` | 删除 `Steps`、step/section scroll state、next/back action；使用普通 Tabs；默认“基本信息与打印机”，第二项“功能与范围”；Tab 保留同一 Form store；名称/设备同排；section 全宽、printer card 紧凑；整聚合只由 footer 保存 |
| 6 | 功能/范围/场景 UI | `TerminalFunctionEditor.tsx`、`TerminalSceneEditor.tsx`、`storeTerminalModel.ts`、`storeTerminalTestIds.ts` | 既有 ref 行的 function type 只读；删除仅用于换类型的 `replaceTerminalFunctionConfiguration` 调用/测试；allowed range 为空不渲染范围选择；scenes 为空不渲染 Divider/picker/empty hint；有 scenes 时保持逐场景订单类型/无序 printer set |
| 7 | 打印机与静态门 | `TerminalPrinterEditor.tsx`、`StoreTerminalL2ActionNodes.static.test.ts`、`StoreTerminalPage.static.test.ts` 及 focused/render/type tests | 复用已有 `Space.Compact`，只收紧 section 间距；静态 red mutation 抓到 `<Steps>`、旧 `formNext/formBack/formSectionNav` 或既有 function Select；真实 Tab/readonly function type/conditional scene 有稳定观察 |
| 8 | L2 控制面 | `contracts/policy/store-terminal-l2-case-blueprint.json`、`store-terminal-l2-scenarios.json`、`store-terminal-l2-locator-bindings.json`、`store-terminal-l2-admission.json`、`store-terminal-l2-fixture.json`、`store-terminal-l2-timing-budget.json`、`scripts/generate/store-terminal-l2-p1.mjs`、`apps/frontend/operations-admin/src/tests/l2/store-terminal.spec.ts`、相关 generator/static/admission tests | 旧 section nav/next/back 绑定全部替换为两个 Tab；增加 Queue 无范围、无场景不显示、既有 function type 无 Select 的断言；当前 UI/控制面重新 admission，不能复用旧 PASS |
| 9 | seed 与测试连带 | `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`、`scripts/dev/store-terminal-seed-executor.mjs` 及 test、`scripts/dev/r5-complete-seed-executor.mjs` 及相关 test、报告/读回、acceptance fixture | 所有 Queue 样本由 NONE 改为空 ranges；八台终端 readback 逐台匹配；若载体未实际改动登记 `N/A_WITH_REASON`，不为凑分母复制数据住址；父 dry-run 必须包含 terminal post-step |

### 10.2 逐点双读与停止条件

每个单元写入前重新打开需求 §15.13、对应 IA/交互段、详设 §16、项目记忆命中原文和 owning source；focused proof 后用同一组原文回读。发现以下任一情况立即停在该单元：

- contract generator 无法表达空 `allowedRangeKeys`，或生成物仍需要手工保留 NONE；
- 后端无法区分新 clientKey 与既有 ref，或者改 key 仍能产生写入/回执；
- Tabs 切换会丢 Form draft，或为了模拟“先打印机”而阻断合法零打印机 KDS；
- scene-less 功能仍因共享组件生命周期产生打印场景标题/空提示；
- L2 控制面无法逐文件绑定当前源码，或 seed dry-run 仍会在 reset 后才发现静态失败。

失败不得靠延长 timeout、隐藏控件、保留过期契约值或在 seed 中强塞默认范围绕过。

### 10.3 动态顺序与证据门

CP-07 设计/代码完成后的动态顺序固定为：generator `--check`/tests/red mutation → owner focused/Java compile → frontend focused/render/static/type → 受影响 backend acceptance 再全 V-1..V-29 → L2 控制面准入后先受影响 case 再六场景 → 若 seed 载体实际变更则父 seed dry-run、reset→DEV→seed/readback → CP-07 步骤级三维、全批整体和 P9。每一段保存 run id、当前字节绑定、first failure、last known good、broken boundary、business、cleanup、日志与产物；未运行写 `NOT_RUN`，不把静态或旧运行证据升格为动态 PASS。

### 10.4 CP-07 设计自审结论（实施前）

作者自审检查了需求 §15.13 的 `USER_FEEDBACK_01..11` 逐条分母、六个 IA-ID、交互工件的 Tabs/紧凑 section/逐场景关系、详设 §3a/§16、计划 CP-07 分母，以及 contract→Java/TS/OpenAPI→owner→frontend→acceptance→seed→L2 的同步链。结果：

| 结论 | 含义 |
|---|---|
| `SELF_REVIEW_MATCHED` | 方案已明确去 Steps、名称/设备同排、打印机先于功能、既有功能类型只读、无范围不作为选项、无场景不渲染区域，并给出最小实现与反例 |
| `SELF_REVIEW_OPEN` | 代码、生成物、测试、L2 控制面和 seed 尚未执行；设计闭合不等于实现/动态通过 |
| `L2_SCRIPT_ADMISSION=BLOCKED` | 当前 UI 与控制面将变化，必须在实现后重新核验并生成当前字节准入记录后才能运行 |

本计划不提前宣称 CP-07、reset、DEV、seed、Browser L2 或全量 acceptance 已通过。DESIGN 的两轮独立复核已达到轮次上限；第二轮 finding 已由主 agent 修复，并按详设 §16.6 完成作者最终自审，`ROUND_FINAL_DECISION=SELF_DECIDED`、`DESIGN_SELF_REVIEW=GO_FOR_IMPLEMENTATION`。下一步是进入 CP-07 编码；不再追加第三轮 DESIGN review，代码完成后仍必须做步骤级/全批对账、动态准入与最终 IMPLEMENTATION review。
