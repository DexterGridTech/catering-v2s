---
title: R5 范围与顺序独立分析(Claude 盲写版)
type: review-draft
status: DRAFT_FOR_CROSS_COMPARE
programId: V2S_W0_W4_EXECUTION
author: Claude
createdAt: 2026-07-25
independence: 未读取 Codex 侧任何 R5 产出;基于四路只读盘点(后端/前端/契约/场景依赖)独立综合
---

# R5 范围与顺序独立分析(Claude 盲写版)

## 0. 结论摘要

**推荐采纳 Dexter 的"三大批"宏观顺序(契约→后端→前端),但每批内部按域/波切冻结-评审片**。在"需求已冻结、前端搬运、语料与 R4 门网齐备"的条件下,三大批优于纯场景波次;大批量的两个真实风险(单批评审超纲、回归定位难)分别用"批内切片"与"每波 R4 verify+fresh L2"化解。范围分母修正为 **32 场景**(v2 README 的 30 已漂移),后端零缺口,前端有一张明确的**补做清单**(不是搬运)。

## 1. 范围分母(v2 已实现范围的精确定义)

### 1.1 场景层:32 个(30 正式 + 2 已实现未登记)

- `IMPLEMENTED_WORKING`:31(含 D04-S12P/S12O 平台/运营自助改密——已实现但 v2 README 分母未回写);
- `PARTIAL`:1——**D01-S07O 扩展字段值**:定义端闭集 8 类实体,值端宿主只有 5 类(COMMERCIAL_GROUP/REGION/PROJECT 无 extension_values 列与 owner 代码);
- `DESIGN_ONLY`:0;
- 13 个旧 Step ID 是 supersession 不是缺口(台账在 v2 carry-forward ledger)。

### 1.2 后端:8 服务全实现,迁移单位是"模块",不是"服务"

216 契约 operation 实现覆盖 100%,零 TODO;21 个 MDB closure 全 PASS。**约 34 张投影/outbox/receipt/repair 表(88 张的 39%)在单库化后整体消失**;7 库→单库多 schema,除 contract 外 6 服务需重落 schema 前缀,迁移历史按 ADR 从 V1 重开。

### 1.3 前端:搬运为主,附五项"补做清单"(这些不是搬运,是新工作)

1. operations 的 **5 个角色首页**(HOME-*)是纯占位——**v2 从来没做过**,属新 UI-bearing 设计,须走 Journey 裁决+线框+你看图;
2. platform role-management 的 L2 只有 1 个用例,`getWorkspaceRoleCandidates` 端点未接;
3. operations 侧 Drawer lifecycle 未开幂等键与日志(与 platform 不对齐);
4. operations `package.json` 缺 `test:l2` 入口;
5. 两 app 的 generated slice 需按 face 收窄重新生成(v2 两份 3681 行文件不一致,operations 是超集)。

### 1.4 契约:105 edge + 111 internal;internal 全部不带

v2s R3 已覆盖 3 个 operation(platform-workspace 域读+初始化子集);同域剩 3 个(create/update/status)恰好是把幂等/乐观并发/资产绑定三套惯例全部拉进来的操作。四件契约基建整体继承:wire-model 单一聚合源、problems 运行时语义目录(retryClass/recoveryActionKey/safeDetail)、http-headers 协议、跨 owner 读的 SourceStatus/AsOf/Unresolved 降级三元组。

## 2. 依赖事实(三层)

### 2.1 场景依赖链(L0→L11,主脉络)

平台登录 → 空间生命周期/平台管理员治理 → 商业集团根+角色定义 → 组织层级+页面准入 → 平台邀请+扩展定义 → 邀请接受(首个运营账号原子产生)→ 空间登录 → 上下文/账号治理/恢复(可并行)→ 运营邀请+经营主体 → 门店/门店资料/组织概览 → 轻合同 → 扩展值+合同概览。
两条易错边:D01-S04.S04(停用阻断运营入口)在 L6 不在 L1;D01-S07P 扩展定义**不依赖**运营入口(v2 曾纠正过这条错边)。

### 2.2 后端合并硬约束(实现态推导,非设计推测)

- **organization ↔ workspace-iam 是唯一双向 MQ 环 → 必须同一波合并,不可一前一后**;
- **contract 同时消费三方投影 → 必须最后**;
- extension、platform-iam 零依赖叶子 → 最先;platform-workspace+asset 单向 outbox → 同批第二;
- gateway 不迁移:其 22 个编排 service(尤其"proof 签发→owner 调用"两步舞)坍缩为模块内 coordinator+judgment API;4 个 Signer/2 个 HMAC secret/Ed25519 proof 全链随之删除;
- Redis 仅 workspace-iam 投影缓存使用,随投影消失,v2s 不引入。

### 2.3 前端搬运依赖(含第三类生成物)

foundation(530 行,零反向依赖)→ **三个生成物**(admin-catalog/problem-semantics/presentation-catalog——壳与页面的共同前置,归属契约批)→ 双壳(platform 壳依赖 4+1 端点;operations 壳依赖 6 端点+后端驱动导航)→ 页面按证据厚度:合同组(唯一 owner+L2+L3 三层齐备)>工作空间组>实体大页组(business-entity 一组件 3 页 18 端点、user-management 一组件 5 页)。

## 3. 顺序方案对比

### 方案甲:Dexter 三大批 + 批内切片(推荐)

契约批 A → 后端批 B → 前端批 C;每批内部按 §4 切冻结-评审片,每片半小时可核。

**优势**(在本场景成立的前提:需求冻结、搬运为主、R4 门网已建):①契约一次定稿消灭 §8 的 8 项两仓冲突,后端/前端各自只面对一份稳定 wire 真相;②后端重构的上下文(ADR 坍缩模式)一次装载连续使用,避免 12 次波次间的语境切换;③前端搬运保持整体性(壳→页面组),不被垂直切片打碎;④与"接口批"天然对齐 x-consumer-faces/codegen/三方对账门(R4 已建)。
**风险与防护**:单批评审超纲→批内切片逐片冻结送审;回归定位难→每片过 R4 `scripts/verify`+affected-L2 选择;后端批完成前无端到端业务证据→保留 R3 walking skeleton 每波回归,后端每波以 owner Testcontainers+L3 managed run 自证,不等前端。

### 方案乙:纯场景波次(L0→L11 垂直切)

每波契约+后端+前端一起交付一个场景组。**优势**:每波都有端到端业务结果。**劣势**(本场景):契约惯例裁决被迫分散在 12 波反复重开;前端搬运被垂直打碎(壳与 foundation 无法归位到某个业务波);上下文切换成本×12;评审轮次约多 60%。**结论:在"迁移已知系统"场景不占优;它是"探索新需求"场景的正确形态,而那不是 R5。**

## 4. 具体批次划分建议

### 批 A:契约定义(全部半小时片)

- **A0 惯例裁决包**(先行,需 Dexter 逐项拍板,见 §8):幂等信封、分页信封、Problem 形状与错误码命名空间、路径参数名、OpenAPI 版本与可空表达、edge/internal 命名(v2s 无 internal,自然消解)、状态变更形态(POST /status)、时间(EpochMillis);
- **A1–A6 逐域契约切片**(每域一片,含 x-consumer-faces 闭集、schema、错误码、candidates/分页):platform-workspace+asset / platform-iam / workspace-iam+session / organization+hierarchy / contract / extension;
- **A7 契约基建**:wire-model 聚合、problems 目录、http-headers、catalog(admin/presentation)三生成物管线;
- 分页原语与 `WorkspaceOrganizationType` 上提 L0(修 v2 的寄居问题);R3 已有 3 op 按 A0 裁决对齐(分页信封/幂等移正/Problem 补 correlationId)。

### 批 B:后端重构(四波,每波=冻结+盲审+Claude review+fresh 证据)

- **B0** 骨架:schema 布局、foundation 搬运(平迁 platform-foundation 可复用件)、judgment API 样式与 coordinator 模式定稿(拿 gateway 编排清单当规格);
- **B1** extension + platform-iam(叶子,两个最小闭环练手坍缩模式);
- **B2** platform-workspace + platform-asset(同批;asset binding 坍缩为同事务 claim;补两服务的薄单测);
- **B3** organization + workspace-iam(**同批,最大波**;删双向投影环 ~14 张表;proof 全链→judgment API;org 拆 ≥5 schema;判死 invitation-targets 端点);
- **B4** contract(最后;3 条入站投影→跨 schema join;12 张投影表删除);
- 每波:owner Testcontainers+L3 managed run+`scripts/verify` 全绿+R3 骨架回归;**不搬清单**(§5)波内执行。

### 批 C:前端搬运(四组)

- **C0** foundation+协议生成物+三个 catalog 生成管线+双 generated slice 按 face 重生成;
- **C1** 双壳(SessionBoundary/ContextShell/Tab/上下文生命周期,含 401 登出机制);
- **C2** 页面组按证据厚度:合同组→工作空间组(workspace-management/账号治理/概览)→实体大页组(business-entity/user-management/hierarchy/store)→公开三页(邀请接受/找回/keyed 登录);
- **C3** 补做清单(§1.3;其中 5 个角色首页走完整 Journey 裁决+线框+看图管线——这是 R5 里唯一的新产品设计)。

## 5. 不搬清单(硬边界)

全部投影/outbox/repair migration(org V12–V19、contract V4–V8、wsiam V21/24/25/26、ext V3/V4);Ed25519 proof 体系;8 份 internal OpenAPI;gateway 本体;RocketMQ/Redis;已退役物(page_grant 矩阵、历史 capability key、oneTimeUrl、Hierarchy 分页模型、`SYSTEM` 枚举值);常态轮询;v2 已删除的历史 client。org→IAM 一条链留作只读阅读样板(Heritage)。

## 6. v2 坑清单处置(不把坑搬进 v2s)

- **K-01/K-02(DAER 状态矛盾与证据失鲜)**:对 v2s 影响有限——R5 每波自产 fresh v2s 证据,v2 证据只作"搬什么"参考;但**引用 v2 证据做取舍依据时须注明失鲜风险**;是否回 v2 补账由 Dexter 定(建议:不补,只登记);
- **K-04(扩展宿主缺 3 类)**:需 Dexter 裁决——补齐 3 宿主 or 收窄闭集(注意:收窄与已入 project-memory 的 corpus 8 类闭集冲突,若收窄须同步修正语料并留 decision);
- **K-05(分母 30→32)**:本分析已按 32;建议在 v2s 侧 decision 登记,不回写 v2;
- **K-03(Drawer 两项无自动化)**:v2s 沿用同 foundation,两项进 HANDOFF 欠账或 R4 门补;
- **K-08(门扫描面<承诺面)**:v2s R4 已重建门网,携带清单里的"带+修缺口"项在批 C0 生成管线落地时逐项核销;
- **K-10(方法论)**:R5 盘点欠账一律读 evidence JSON/HANDOFF,不 grep TODO。

## 7. 需 Dexter 裁决清单(按时间顺序)

1. **顺序形态**:方案甲(三大批+批内切片)是否采纳;
2. **A0 契约惯例 8 项**(§8——建议 Codex/Claude 各自提案后你选,多数项 v2 惯例明显更成熟,可预期快速通过);
3. **K-04 扩展宿主**:补齐 or 收窄(牵动语料);
4. **分母确认**:32 场景(含 D04-S12P/O)即"R5 业务范围=v2 已实现范围"的权威清单;
5. **5 个角色首页的产品语义**(C3 阶段,走看图);
6. **每批完成的验收节奏**:建议 A 批一次验收、B 批四波各验、C 批四组各验。

## 8. 契约最小裁决清单(两仓已实际冲突,逐项待 A0 定稿)

①幂等:v2 body 字段 `idempotencyKey`(required,min16,仅写操作)vs v2s header 且错放 GET——**建议采 v2**;②分页:v2 `{items,page,pageSize,total,sortKey,sortDirection}` 信封 vs v2s 裸数组——**建议采 v2 并抽 L0 原语**(消 15 份重复);③Problem:v2 RFC7807+errorCode+correlationId 必填+problems 目录 vs v2s 3 字段——**建议采 v2 形状**,错误码命名空间待定(85 值扁平 vs 域前缀);④路径参数:`{workspaceKey}` vs `{groupWorkspaceKey}`——G-10 裁决过技术拼写统一 `groupWorkspaceKey`,**但 v2 全域用 workspaceKey,此处需你复裁**(改 105 op 的成本 vs 语料一致性);⑤OpenAPI 3.0.3 vs 3.1.0 与可空表达;⑥乐观并发三套命名(expectedVersion/expectedRevision/expectedContextVersion)是否归一;⑦排序参数 sortKey/sortDirection vs sort/direction;⑧状态变更统一 POST /status(v2 惯例,建议采)。

## 9. 业务语料(project-memory G-01–G-12)与 v2 实现的分歧对照

搬运的最大暗雷:**v2 实现凝固的是裁决之前的语义,照搬会把已修订语义搬回来**。逐条对照结论(处置:ALIGNED=照搬安全 / CARRY_DELTA=搬运时必须改 / NEW=语料有 v2 无、须新做 / VERIFY=波内核对项 / PENDING=语料本身待裁决,保持 v2 行为+标记):

| 语料条目 | v2 实现态 | 处置 | 落点 |
|---|---|---|---|
| G-01 空间/集团分离、恰一个、拒绝码 | v2 initialize 语义一致;无解绑/替换/重建操作 | **ALIGNED**(解绑类继续 PENDING) | — |
| G-02 组织树固定三层、大区单级 | v2 hierarchy 即固定三层、全量快照 | **ALIGNED** | — |
| G-03 三类用户主叫法"商场运营方/店铺运营方";总公司不进门店经营查看 | 行为一致;但 **UI 文案层用旧词体系** | 行为 ALIGNED;文案 **CARRY_DELTA**(见 G-05 行) | C2 各页 |
| G-04 分期=聚合内名称数组、合同存名称快照、改名不回写 | 合同侧 string 快照已实现 ✓;项目 phases 数组需核对 v2 是否落地 | **VERIFY**(B3 核对,缺则补做) | B3/C2 |
| G-05 当前运营角色/可视数据节点(07-21 裁决);禁"当前身份/查看范围" | **v2 前端文案大概率仍是旧词**(DAER 07-23 统一的正是"当前身份/查看范围";07-21 裁决未见回写 UI 的证据) | **CARRY_DELTA(高风险)**:搬运每页跑正向词+禁用词 L2 断言(R3 已建),壳的切换器文案改新词 | C1/C2 全程 |
| G-05 物理账号跨空间复用 | v2 为空间隔离账号 | **PENDING**(保持 v2 行为+待裁决标记) | — |
| G-06 品牌授权仅资格、移除被用授权须拒绝+受影响门店摘要 | v2 guard+关系表已实现 | **VERIFY**(B3 抽验拒绝行为与摘要返回) | B3 |
| G-07 任职三动作(邀请新增/直接撤销/无编辑)、角色四要素、归属节点锁定、历史 key 物理清理 | v2 V20 已物理清理 ✓,JSONB bundle ✓,邀请制 ✓;**"运维管理员可撤销任职"是裁决新增**,v2 运维侧无此动作 | 主体 ALIGNED;撤销入运维端为 **NEW** | B3+C2(platform 账号页加动作) |
| G-08 门店启停=主数据候选;**停用阻断"以该门店任职进入后台"** | v2 只实现了**空间**停用阻断入口(D01-S04.S04);门店停用不阻断门店角色登录 | **NEW**(裁决新增行为,B3 实现+C1 会话链路生效+L2 负例) | B3/C1 |
| G-09 货号={编码,名称}二元组、合同内编码唯一 | v2 为 `itemCodes[]` 字符串数组(已被显式修订的历史 schema) | **CARRY_DELTA**:契约 A5 定二元组,B4 建表(v2 有 store_contract_item 行表可承接),C2 合同页表单加名称列 | A5/B4/C2 |
| G-09 衍生状态(经营中/待开业/未经营) | v2 无 | **NEW 但用法待裁决**:仅登记派生定义,不做页面/阻断,待 Dexter 定用法 | A5 备注 |
| G-10 技术拼写统一 `groupWorkspaceKey`;运营端全路由带 key、运维端不带 | v2 全域 `{workspaceKey}`(105 op+前端 locator);路由形态 ✓(运营带/运维不带) | 路由 ALIGNED;拼写 **CARRY_DELTA×105**——即 §8-④,**语料已裁决,除非你复裁,契约批照 groupWorkspaceKey 全量改名** | A0/A1–A6 |
| G-11/G-12 商品/库存语言 | R5 四域范围不触及 | N/A(未来波次) | — |
| (语料外)扩展实体 8 类闭集 vs v2 值宿主 5 类 | K-04;注意 8 类闭集出自 v2 spec/裁决,未入 G 条目 | **PENDING_DEXTER**(§7-3) | A6/B3 |

**综合**:分歧共 4 类 9 处——文案层(G-05,面最大)、货号形状(G-09)、key 拼写(G-10,量最大)、两个裁决新增行为(G-07 撤销入运维、G-08 门店停用阻断)。这张表应成为每波盲审子 agent 的必读输入(其最小输入清单本就含 corpus 命中);建议 Codex 侧方案对比时首先对这张表——**两边若在"搬什么"上一致而在"改什么"上不一致,以语料为准**。

---

*本稿为盲写;与 Codex 方案对比时,重点核对:分母是否同为 32、org↔wsiam 同波与 contract 最后两条硬约束是否一致、契约 8 项裁决清单是否同集、前端补做清单是否被识别、以及 §9 分歧表是否两边同集。*
