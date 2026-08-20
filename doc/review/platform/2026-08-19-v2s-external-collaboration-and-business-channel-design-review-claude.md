# 外部协作与经营渠道 · 三份设计交付 · 独立复核

- 日期:2026-08-19 · 评审:Claude · 会话:续接(非 fresh,已声明)
- 被审:Journey ×2、UI 交互工件、IA 详设、implementation-facing 详设、串行计划(CP-00~09)、盲审输入清单
- 结论:**NO-GO** · **M=1 · S=4 · N=5**
- ⚠️ **模型、架构与 IA 的实质全部成立**;NO-GO 的原因是一族契约字面量漂移与四处机械缺口,
  **无一需要返工模型**。修完 + 补跑盲审即可转 GO。

---

## 0 · 这批设计到底解决什么,解决了没有

**要解决的两个结构性错位**(详设 §0.1 自述,与冻结规格一致):
① 三层外部协作焊死在渠道上 → 团购/权益/订单同步会复制同构三层;
② 渠道需要项目自建四维模板、多实例、绑定有效才生效。

**解决了(设计层)。** 亲验依据:
- 详设 §0.2 有真实方案比较(A 扩旧结构 / B 巨型 integration 模块 / C 两 owner + edge 编排),
  取舍理由登记 —— 不是唯一方案自证;
- `collaboration` 只拥有 enablement + binding,`business-channel` 只拥有模板 + 渠道,
  依赖单向、⛔ 反向 import,跨域写由 edge policy 列**有限两条 owner command** 同一 `REQUIRED`
  事务(§5.4 矩阵四行,含回滚事实)—— 与 blueprint「跨 owner 的 whole-save 只能由 operation
  policy 明确列出有限 owner command」逐字吻合;
- §8 的 **34 条 BR 逐条落到 owner 判定点**(BR-33 空号显式声明),实测 34 行零缺;
- E-33 全链路:契约(PLANNED 仅信息)→ CP-01 红 mutation(PLANNED 被拒即失败)→ BR-35 判定点
  → IA P1/P2/O2 → 两条 acceptance 场景 → 红夹具表首行。**七个触点齐**;
- 六项 C 全部保持依赖态:§10 每项有「允许/禁止」两列,每个 CP 有单条停机规则,
  未发现任何 C 被固化成 contract/DB 约束。

## 1 · IA 是否复用用户旅途、是否站在用户视角(Dexter 点名)

**是,且证据充分。**

- 两份 Journey 与**记录 001 你的逐字口述**逐段吻合:platform 侧「左侧树 → 右侧详情 → 档案两
  Tab → 绑定列表可搜索分页 → 首列开抽屉 → 需授权者仅删除」;operations 侧「项目页上模板下实例、
  门店页只选上级项目的门店主体模板」。**没有发明新流程,没有从接口反推任务**;
- IA 九维度以 `businessTask`/`actorAndScenario` 开头,每屏先写用户任务再写控件;
- 15 个 typed problem 每个都有**用户可见处理**列(「留在草稿并引导维护绑定」「不说 PLANNED
  不可用」)—— 错误语义是从用户读到什么出发写的;
- §1.3 通用禁止 UI 站在保护用户的立场:不显示 UUID 当文案、置灰不隐藏、
  `NO_MAPPING` 无输入框、无手工"标记已授权";
- 编辑态单独覆盖(P6/O2 的只读/编辑分列,`EXTERNAL_GRANT` 创建不要求店铺号)。

## 2 · 符合项目记忆/设计规范吗

| 对象 | 结论 |
|---|---|
| G-01/02/03/05A/08 | 节点路径、页面准入、写授权、门店停用不阻断 —— 全部对上 |
| **G-10** | ❌ **一处违反**,见 S-1 |
| E-33 / 六项 C | 全链路成立 / 全部保持未决 |
| `ordering-only-for-consumer-facing` | 六份文档 `displayOrder` **零命中** |
| 能力命名红线 | operationId/路径/场景 ID 全部能力命名,无 BR/OP/Journey 编号入 runtime |
| foundation 强制对接 | §6.3 逐项指向既有 export;`FieldDescriptor` 用 **adapter** 而非照搬类型,`dataPath/tabKey/admittedShapes` 三个不适用字段由 adapter 固定映射,理由已登记 —— 与上一轮 S-3 的裁定完全一致 |
| 退役机制 | 未复活:无 provider 壳/SPI/registry/package-exit/compliance-control;§12.3 明写不重引 |
| §12 引用的 6 个 check/generate 脚本 | **全部真实存在**(逐个 ls 验过) |

## 3 · 是不是凑 GO

**不是,反凑 GO 的标记密集**:六项 C 每 CP 停机规则、`DEXTER_WIREFRAME_REVIEW=UNSET`、
UI admission 标 `WAITING`、验证命令明写「设计意图,不执行」、分母 44 现数并**自行揭发**
`scripts/README.md` 与一条 project-memory 里过期的 28、盲审 agent 无 verdict 时**如实记
`UNVERIFIED_REQUIRES_EVIDENCE` 而不是假装通过**。

---

## M-1 · 契约枚举字面量整族漂移,与冻结规格互相矛盾(未登记)

**位置**:详设 §2.2(第 98/116/117 行)、CP-02 动作 4(串行计划第 136 行);IA §1.1.4 vs 详设 §2.2

**仓内事实**:冻结规格的字面量是**规范性的**(§3.3 映射表 + §5.4/§5.8 字段表),详设整族改名:

| 规格(冻结) | 详设 | 备注 |
|---|---|---|
| `GROUP_BUY` | `GROUP_BUYING` | §3.3 表:orderKind `GROUP_BUY` ⇒ capabilityClass `GROUP_BUY`(**同字面量**) |
| `TAKEAWAY` | `TAKEOUT` | 同上;仓内仅 1 处既存 `TAKEOUT`(catalog-inventory **fixture policy**),不构成域先例 |
| `INVENTORY_SYNC` | `INVENTORY` | |
| `TAKEAWAY_DELIVERY` | `DELIVERY` | |
| `LOCAL_ONLY` | `SELF_SERVICE` | unbindKind |
| `COMMERCIAL_GROUP` | `GROUP` | **且批内自相矛盾**:IA §1.1.4 说 subjectType 扩展用 `COMMERCIAL_GROUP`,详设 bindableNodeTypes 用 `GROUP` —— 同一个节点类型在同批两个字面量 |

**后果**:BR-05 的判据是「orderKind 经 §3.3 映射后**等于** capabilityClass」——
规格表里两侧同字面量,详设改名后**该表失效**;实施者面前有两个互相矛盾的规范源,
必然臆造其一。这正是本周反复清除的「两处规范打架」。orderKind 值也被连带改名
(CP-02「TAKEOUT/GROUP_BUYING 不接受 dine-in form」vs 规格 `DINE_IN/TAKEAWAY/GROUP_BUY`)。

**最小整改**:二选一 —— 全部改回规格字面量;或登记改名理由并**同一变更**内更新规格
§3.3/§5.4/§5.8。`GROUP`/`COMMERCIAL_GROUP` 必须与 subjectType 扩展统一为后者
(既有枚举先例即 `COMMERCIAL_GROUP` 族命名)。**不需要 Dexter 裁决**(字面量是工程决定,
但两源必须一致)。状态:`CONFIRMED`

## S-1 · IA-P1 的页面 URL 违反 G-10(且 IA 自称语料冲突「无」)

**位置**:IA 第 64 行 `entryAndSurface=/platform/group-workspaces/:groupWorkspaceKey/external-collaboration`

**仓内事实**:语料 G-10 逐字「**运维管理后台 URL 不携带**(集团空间编码),所选空间是端内
会话上下文」。亲验现有 platform-admin 路由:`/platform/login`、`/platform/workspaces` ——
**无一携带** workspace 段;前端路由 `group-workspaces` 零命中。IA-P1 自己也写
「已在 WorkspaceScope 选择集团空间」—— 与 URL 携带 key 内部矛盾。而 Journey 的语料冲突表
填「无」。(API 路径带 `group-workspaces/{key}` 是既有 API 约定,**不在此列**。)

**最小整改**:页面路由改 `/platform/external-collaboration`,空间取 WorkspaceScope 会话上下文;
Journey 语料表补记该项。状态:`CONFIRMED`,不需 Dexter 裁决。

## S-2 · acceptance 场景放错 domain group,违背现行标准

**位置**:详设 §7.2/CP-08 —— 协作场景放 `OrganizationAcceptanceScenarios`、渠道场景放
`CommercialContractAcceptanceScenarios`

**仓内事实**:现行标准(2026-08-14)第 48 行「新增 scenario **必须放入正确的 domain group**」;
且标准发布后已有**新增 domain 文件的先例**(`AuditAcceptanceScenarios`、
`ExtensionAcceptanceScenarios` 均不在标准原列表却已存在)。经营渠道场景放进商业合同文件
不是「正确的 domain group」。Codex 已自设停机规则(诚实),但标准与先例已经回答了这个问题。

**最小整改**:计划改为新增 `CollaborationAcceptanceScenarios.java` 与
`BusinessChannelAcceptanceScenarios.java`,在 `BackendAcceptanceScenarioCatalog` 登记
domain group(这是常规代码,不是退役机制)。状态:`CONFIRMED`,不需 Dexter 裁决。

## S-3 · seed 设计两处缺陷:放错 plan 文件 + 三族夹具缺失

**位置**:串行计划 CP-07

**仓内事实**:
① 「在 `catalog-inventory-seed-plan.mjs` 中只放契约目录/能力字典的静态输入」——
**契约态数据不是 seed 素材**(它随代码交付,不经 seed 写入),且 catalog-inventory 的 plan
是**别的域**的文件;既有形态是**每域一份 plan**(catalog-inventory-seed-plan 是样板,不是容器)。
② 夹具清单比对派活要求,缺三族:**五类节点各一条绑定**(BR-04 全覆盖)、
**万象城海底捞形态**(一门店三渠道三绑定,E-25 的实例)、**内部渠道 POS/扫码/自助机各一条**
—— 缺内部渠道 seed 意味着**内部链路完全无法手工走通**。

**最小整改**:新建本域 seed plan(照 catalog-inventory-seed-plan 形态);契约目录改为 plan 的
**只读输入引用**;补三族夹具。状态:`CONFIRMED`,不需 Dexter 裁决。

## S-4 · 设计期盲审 Round 1 无 verdict —— 本轮复核不能替代它

**位置**:Codex 交接自述;盲审输入清单(格式合规,hash 齐全)

**仓内事实**:AGENTS.md 明令「**缺少独立子 agent 留痕的该轮不得 GO,也不得把 Claude 后续
复核当作替代**」。agent 无返回 = 无留痕 = **该轮无效**(不消耗轮次)。输入清单本身合格
(REVIEW_ROUND=1/LIMIT=2/盲审声明/逐文件 sha256),可直接复用重跑。

**最小整改**:用同一清单重跑 Round 1(fresh 子 agent);verdict + 作者 intake 齐后,连同本
review 一起构成实施授权的输入。**除非 Dexter 在会话中明示豁免**(他的权限,不是我的)。
状态:`CONFIRMED`

## N 级(5 条)

- **N-1** IA 文档两处自称「十个 IA-ID」,实数 **11**(P1-P6=6 + O1-O5=5;交接话术说的 11 是对的)。
- **N-2** IA-ID 命名未按仓内 `IA0X-面-屏` 形态(如 `IA02-PLATFORM-WORKSPACES-ACTIONS`),
  直接用了 `IA-P1..IA-O5`,且未登记形态理由。对照关系因恒等映射天然成立,故仅 N;
  补一行理由或改编号,二选一。
- **N-3** 两份 Journey 自标 `STATUS=DEXTER_ACCEPTED`。内容确实源自记录 001 的逐字口述 +
  本批授权,且诚实保留 `WIREFRAME_REVIEW=UNSET`/`implementationAuthority:false`;
  但这两个**文件本身** Dexter 未见过。请 Dexter 在看线框时一并确认(`DEXTER_DECISION`)。
- **N-4** collaboration API 列了 `markBindingsCascadeDisabled(command)`,但 §5.4 政策矩阵的
  停用行**不调用它**(只调 disableEnablement + 渠道级联);规格里绑定置灰是**派生显示态**,
  不是存储状态。删除该方法或显式补政策行,二选一。
- **N-5** 两份 Journey 引用交互工件锚点 `#platform-admin-screens`/`#operations-admin-screens`,
  **交互工件中不存在这两个标题**(实际标题是「Screen P1:…」等)。死锚,改为真实标题引用。
- (Codex 已自行登记 `scripts/README.md` 与一条 project-memory 的过期「28」,不另立 finding;
  实施批一并更新即可。)

---

## 数字复测(全部现算,未采信)

| 声称 | 实测 | 判定 |
|---|---|---|
| acceptance 当前 44(IAM10/ORG7/合同4/asset2/Catalog18/Audit1/Ext2) | **44,分布逐文件吻合** | ✅ |
| 新增 14 → 58 ≤ 80 | 场景 ID 实数 **14**;58 ≤ 80 | ✅ |
| BR 落点 34 条(BR-33 空号) | §8 实数 **34 行**,空号已声明 | ✅ |
| typed problem 15 个 | IA §3 表实数 **15**,与规格 §9.2 集合相等 | ✅ |
| 每 route 单一 `x-consumer-faces` | §5.2 表逐行核:platform 与 operations **零共用 operationId**;operations 绑定操作走渠道上下文路由,与 platform 绑定操作分列 | ✅ |
| 双后台独立 | 两 app 各自 feature 目录/generated/store;共享仅 foundation | ✅ |
| CP 数 | CP-00~09 = **10** | ✅ |
| IA screen 数 | **11**(文档自称 10,N-1) | ⚠️ |
| §12 六个脚本 | **全部存在** | ✅ |
| `displayOrder` | 六份文档 **0** | ✅ |

## 授权边界

本结论是**静态设计复核**:未运行任何生产代码、契约生成、迁移、seed、reset、DEV、
Testcontainers、L2、UAT。GO/NO-GO 不构成 implementation authorization,不裁决六项 C,
不授权任何 Git 动作。**NO-GO 针对的是 M-1 + 四个 S 的机械缺口与盲审留痕缺失,
不针对模型与 IA 的实质** —— 修复面全部是文本/计划级,预计一轮可清。
