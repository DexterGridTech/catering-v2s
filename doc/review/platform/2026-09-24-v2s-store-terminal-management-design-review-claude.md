# 门店终端管理 · 详设与实施计划 DESIGN review（Claude）

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=经 Dexter 中转的 Codex↔Claude review，第 1 轮（轮次由 Dexter 决定）
AUTHOR_CYCLE=TER-DESIGN-20260924-OPTIONAL-CODE（作者两轮子 agent 审查记录只作作者材料，未当作已验证事实）
VERDICT=NO-GO
M/S/N=1/5/8
SESSION_PROVENANCE=续接会话（非 fresh v2s-rooted）；Claude 主会话评审，不是独立子 agent；本会话同时是需求正本的作者
VERIFICATION_MODE=静态只读（Read、grep、sed、python 只读解析）；未执行任何生成、构建、测试、reset、DEV、seed、Browser L2、UAT
AUTHORIZATION=本结论不授权实施、契约或代码改动、DEV、seed 或任何动态动作
```

评审对象（当前字节）：

- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md`（163 行）
- `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md`（443 行）
- `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md`（306 行，下称「详设」）
- `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-plan-codex.md`（132 行，下称「计划」）
- 作者审查记录 `doc/review/platform/2026-09-24-v2s-store-terminal-management-design-review-codex.md`（只在形成本文 findings 后对照）

---

## 0 · 独立预期（读作者结论前写定）

依据需求正本 D-1 至 D-27 与本次转来的新增（手填或自动生成激活码、DEV seed 固定码、列表无码、逐场景无序打印机集合），我预期详设至少要答清五件事：

1. 激活码两条创建路径：手填码撞重要报给用户、绝不替换；自动码撞重要静默换码；两条路都不能在 PostgreSQL 已失败的事务里继续。
2. 幂等回执：回执里的响应原文或请求摘要，会让激活码（尤其是手填的低熵码）进入其他持久化产物，违反 R-8.9。
3. seed 的固定码必须和运行时两条路径走同一唯一约束；seed 正本自身的计数与阶段分母要同步。
4. 无序打印机集合推翻了 D-1 的「主备」，需要有 Dexter 的依据，并贯穿 contract、DB、DTO、审计与测试。
5. 整终端一次保存时，同一请求里新建的子项（打印机、厨打）如何被场景引用，以及 ref 如何稳定。

对照结果：第 1、2、4 项详设答得好（见 §4）；第 3、5 项有缺口（S-4、S-1）；另有我没预期到的一项 M 级问题（M-1）。

---

## 1 · 方案合理性判断

**问题对不对：对。** 四份工件做的就是 Dexter 要的规则管理：主从页、独立写权限、整终端配置、激活码、硬约束单一住址；没有偷带激活、TDP、派发中心、真实打印或订单路由。D-1 至 D-27 与本轮新增的方向都被遵守，我没有发现「用户要 5-4、作者在做 1+1」式的偏离。

**方案优不优：骨架对，两处不是最优。**

- 新建业务 owner、整终端一次保存、终端级版本 CAS、contract 单一住址加生成器、跨 owner 只读公开 API，都是最小且职责清晰的形态，我认同。
- **打印机型号清单**（M-1）：设计把「品牌型号进 contract」落成「只登记三个经厂商资料核实的示例型号，型号必选」。这会让 Dexter 自己在 D-12 里举的「服务员手持＋内置打印机」无法如实配置，也让绝大多数国内门店在用的打印机录不进来。
- **存储形态**（S-5）：一个永远整体读、整体写的配置聚合，被拆成 7 张表，并在每次保存时「整替换所有子表」。详设没有和「一行终端＋一份 JSONB 配置文档」比较；后者在本仓有先例，也更符合 Dexter 对业务数据模型「偏简单」的一贯偏好。

**代价配不配：** 18 行横切机制、28 个场景、seed 八样本的分量与本批相称。但 7 表形态额外带来子表整替换、ref 保持、同 owner 外键与去重主键的实现和测试面，这部分代价没有对应的收益论证（S-5）。

**UI 与交互强制自问（UI 适用）：**

- 操作是否来自明确要求：是。主从页、左头新建、详情头「更多」加「编辑」、两步新建、编辑抽屉、状态确认都来自 Dexter 的主从裁决与已接受线框（IA 与交互工件均记 `DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-24`）；手填激活码是 Dexter 的新增要求。
- 此时这样操作是否合逻辑：合逻辑。先选设备类型，再配打印机，再配功能与场景，符合依赖关系；状态变更先看详情再操作，不会点错对象。
- 有没有更短、更自然的路径：有一处实质障碍。每台打印机必须先选到契约里登记的品牌型号，未登记的型号不能创建（交互工件第 227 行「型号不进入可创建候选」）。对手持内置打印机和国产常见机型，这不是「路径长」，而是「走不通」（M-1）。
- 不合理之处来自哪里：来自 contract 单一住址（D-10）与「型号→纸规格须经厂商资料核实」这两条正确原则的叠加，再加上首批型号只放了三个示例。缺的是产品层面的「未登记型号怎么办」，不是技术限制。

---

## 2 · ACCEPTED_REQUIREMENT_DELTA 核对与需求正本同步

我逐条对照详设 §0（第 11 至 24 行）、交互工件 §8、IA 头部与需求正本原文：

- **八行覆盖关系都成立**：列表无码、手填或自动生成激活码、DEV seed 固定码的狭窄例外、编辑顺序与不做默认绑定、逐场景无序打印机集合（及对 V-12、V-25 的替换）、USB 与蓝牙各一个字符串标识。它们在交互工件 §8 都记为 Dexter 的裁定，而且 Dexter 转来的评审请求里再次确认了手填码、固定码、列表无码与无序集合。Claude 手里没有这些裁决的一手原话，以上述记录为据。
- **覆盖表不完整**（N-1）：详设 §0 引言（第 9 行）列出的「品牌、型号及型号允许的纸规格进 contract」，以及交互工件第 219 行的「同一终端同一连接方式下标识不得重复」，都没有进入覆盖表。前者新增了一条硬约束，影响需求 R-4.2、R-5.4、§3.7 与 §4。
- **同步决定与结果**：由需求作者（Claude）把以上全部已接受变更写回需求正本，记为 D-28 至 D-34；「首批型号清单的覆盖面」交 Dexter 裁决，Dexter 选定「通用型号」，记为 D-35（见 M-1）。已写回，改动位置与出处见需求正本 §15.9；同时新增 §4.9（H8 品牌与型号）与 V-29（型号 × 纸规格全表）。写回后需求正本重新成为唯一依据，详设 §0 的「规范桥」可以改为直接引用 D-28 至 D-35。写回发生在需求两轮对抗审查之后，未经独立复核。

---

## 3 · Findings

### M-1 · 打印机必须选到契约里的型号，而首批只登记三个示例，核心场景无法如实配置

- **位置**：详设第 103 至 111 行（「型号与纸型先冻结为下表的三个示例」：Epson TM-T88VII、Zebra ZD421D、Zebra ZD411D）；交互工件第 219 行、第 227 行（「无已核实的本批可用项｜型号不进入可创建候选」）、第 354 至 355 行（品牌与依赖型号为必选 Select）；计划第 103 行（「若云端/内置未由八台覆盖，则在其中一台增第二打印机」）。
- **性质与证据**：文档内部事实加产品判断。品牌型号进 contract 是 Dexter 在线框中确认的；但只登记三个型号是详设的选择，没有 Dexter 裁定。
- **影响**：
  - D-12 情况 1、2 的「服务员手持＋内置打印机」无法如实配置：三个型号都不是手持内置机，要配只能选「TM-T88VII＋内置」这种假组合，而这正违反交互工件自己写的「不编造型号与纸规格的兼容关系」。
  - 国内门店常见的热敏、标签、云打印机型号都不在清单里，实现后大多数门店录不进自己的打印机，功能在真实门店里不可用。
  - seed 要覆盖「内置」「云端」两种连接方式（计划第 103 行），在现有清单下只能造假数据。
- **最小修法（需 Dexter 裁决）**：在 CP-01 之前定一条「未登记型号怎么办」的产品规则。候选：
  - (a) Dexter 提供首批目标型号清单（至少包括常用手持的内置打印机与常见国产热敏、标签、云打印机），逐一核实纸规格后登记；
  - (b) 为每种纸规格增加一个「通用」型号（例如通用热敏 58 毫米、通用标签 40×30 毫米，外加设备内置 58 与 80 毫米），不声称厂商兼容，只声明纸规格；具体型号照旧可选；
  - (c) 品牌型号只作描述、不约束纸规格，纸规格由用户在 H3 全集中选。
- **为什么不是更小的修法**：零散地多加几个示例型号，仍会留下「任何未登记型号都录不进来」的死路；必须先定规则。
- **Dexter 裁决（2026-09-24）**：选 (b)「通用型号」，记为需求正本 D-35（§4.9）。Codex 需要据此修订：详设 §2 的型号表加入每种纸规格的通用型号与设备内置 58、80 毫米两个通用型号；交互工件的型号候选与「型号不进入可创建候选」一行；seed 八样本的打印机型号；S-3 的全表判据（需求 V-29）。本条在上述修订落地前仍计为 M。

### S-1 · 整终端一次保存的请求里，新建子项的临时身份没有定义

- **位置**：详设第 166 行（「准确 DTO/property 由 CP-03 schema 与本节逐字段对账」）；详设第 93 行与计划第 26 行（client key 只用于 testId 与草稿定位）；交互工件第 372 行（「前端不能自己生成 ref」）；详设第 117 行（「整替换所有子表」）。
- **性质与证据**：文档内部事实加推论。场景的打印机集合必须引用同一请求里刚新增、还没有 ref 的打印机；新增的厨打实例同理。三份工件都没有定义请求里怎样表达这种引用、服务端怎样分配 ref，也没有定义「整替换」时如何保住既有子项的 ref。
- **影响**：实现者只能临场发挥，按数组下标或名称引用；或者在整替换时删行重插，生成新的 ref。这会直接打破 V-12（打印机改名后绑定仍在原位）与 V-22（修改厨打①后厨打②与全部打印机的 ref 不变），幂等重放时也可能得到不一致的结果。
- **最小修法**：在 CP-03 的 schema 里冻结一条规则：
  - 既有子项带 `ref`，新增子项带请求内唯一的 `clientKey`；
  - 场景打印机集合里的元素写 `printerRef` 或 `printerClientKey` 二者之一；
  - owner 为新增子项分配 ref，更新时按 ref 原地保留既有子项，不删行重插；
  - `clientKey` 计入幂等请求摘要；
  - V-12、V-22 补「新增打印机当场被场景引用」和「重放不产生新 ref」两例。
- **为什么不是更小的修法**：只在实施时「逐字段对账」，没有可以对账的规则。
- **需 Dexter 裁决**：否。

### S-2 · 错误码不合仓内命名口径，而且把选码推迟到了「设计复核中」

- **位置**：详设第 129 至 142 行，其中第 142 行写「实际 source registry 若既有拼写不同，CP-03 在设计复核中先选择既有规范码」。
- **性质与证据**：仓内事实。
  - 现有写操作在 OpenAPI 路径文件里用 `x-error-codes` 声明错误码：领域码带前缀，通用码复用 `PLATFORM_COMMON_*`。例如 `contracts/openapi/paths/operations-admin/store-management.paths.json` 第 183 至 196 行，同时列有 `ORGANIZATION_STORE_NAME_CONFLICT` 与 `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT`。
  - `apps/frontend/operations-admin/src/app/api/operationsProblemFeedback.ts` 共 115 个码，已有 `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT`、`PLATFORM_COMMON_RESULT_UNKNOWN`、`PLATFORM_COMMON_VERSION_CONFLICT`、`PLATFORM_COMMON_VALIDATION_FAILED`；第 148 行还有一个历史遗留、不带前缀的 `VERSION_CONFLICT`，文案是通用的「资料已被更新」。
  - 详设的 8 个码（`VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`REFERENCE_INVALID`、`RULE_INVALID`、`NAME_DUPLICATE`、`ACTIVATION_CODE_DUPLICATE`、`ACTIVATION_EXHAUSTED`、`RESULT_UNKNOWN`）都不带前缀，其中三个与现有通用码重复。
- **影响**：不带前缀的 `VERSION_CONFLICT` 会撞上现有的历史码及其通用文案；幂等冲突、结果未知会各多出一套与平台通用码并存的码。这正是 Dexter 要避免的「重复造轮子」。设计阶段不定码，实现时就会各选各的。
- **最小修法**：现在就冻结。
  - 通用语义复用 `PLATFORM_COMMON_IDEMPOTENCY_CONFLICT`、`PLATFORM_COMMON_RESULT_UNKNOWN`、`PLATFORM_COMMON_VALIDATION_FAILED`；
  - 领域语义加前缀，按现有「_CONFLICT」命名习惯：`STORE_TERMINAL_NAME_CONFLICT`、`STORE_TERMINAL_ACTIVATION_CODE_CONFLICT`、`STORE_TERMINAL_ACTIVATION_CODE_EXHAUSTED`、`STORE_TERMINAL_RULE_INVALID`、`STORE_TERMINAL_REFERENCE_INVALID`；
  - 版本冲突按 organization 的先例用 `STORE_TERMINAL_VERSION_CONFLICT`，或复用 `PLATFORM_COMMON_VERSION_CONFLICT`，二选一写死；
  - 逐个操作写进 `x-error-codes`，同步修改 IA 第 129 至 143 行的 GAP 表。
- **需 Dexter 裁决**：否。

### S-3 · 「型号↔纸规格」「品牌↔型号」两条新硬约束没有 HTTP 验收判据

- **位置**：计划第 79 至 80 行（V-10 只测场景 × 纸型的 119 格，V-11 只测连接参数）；详设第 210 行（§8 该行没有型号与纸规格的反例）；计划第 40 行（R-4 行只写「F 品牌/型号/条件参数」）。
- **性质与证据**：文档内部事实。型号只允许某些纸规格、型号必须属于所选品牌，都是本批新增的 contract 硬约束（详设第 101 至 111 行）；28 个场景里没有一个会提交「ZD411D＋标签 80×50」「Epson 品牌＋Zebra 型号」或未登记型号，并断言 owner 拒绝。
- **影响**：一个忘了在 owner 端校验型号与纸规格的实现，能通过全部 28 个场景，唯一的防线变成前端级联下拉，违反 R-7.2「前端不给选只是便利，不是防线」。
- **最小修法**：按需求 V-29 新增一个场景，用手写期望表逐格验证「型号 × 纸规格」（含 D-35 的通用型号），外加品牌与型号不匹配、未登记型号两个负例；规则同 V-10：期望表手写，不从生成定义反算。
- **需 Dexter 裁决**：否。

### S-4 · seed 的同步分母有缺口，而且指向了一个不存在的载体

- **位置**：详设第 238 行、第 263 至 273 行（同步表）、第 275 行；计划第 103 至 105 行。
- **性质与证据**：仓内事实。
  - 种子正本有自己的强校验分母：`scripts/dev/r5-fixture-contract.mjs` 第 27 至 49 行写死 7 个种子阶段及其到四个组件的映射；第 64 至 76 行 `computeFixtureExpectedCounts` 从正本数据计数；第 97 至 110 行 `validateFixtureExpectedCounts` 要求 `expectedCounts` 的键集与 `COUNT_KEYS` 完全一致、数量逐项相等；正本第 471 行的通过判据是「所有 expectedCounts 与 owner 读回相等」。
  - 详设的同步表只写「增 storeTerminals 数据集结构……静态校验」，没说终端数据是否进入 `COUNT_KEYS` 与 `expectedCounts`，也没说它在正本的阶段模型里放在哪里（后置步骤不属于现有 7 个阶段）。
  - 同步表的「reset schema allowlist」（第 238、273 行）在仓内不存在：`scripts/dev/r5-reset.mjs` 第 61 行是整库 `DROP DATABASE`，再由 Flyway 重建。唯一带 schema 数的是正本第 71、485 行的文字「seven fixed owner schemas」，而迁移里已有 12 个 owner schema，这句话本来就过时了（既有问题）；加上 `store_terminal` 就是 13 个。
  - 计划第 103 行对「内置」「云端」两种连接方式的覆盖写成条件句，只读角色的 seed 写成「新增一个或用已有角色」，八样本的正本并没有冻结。
- **影响**：按现在的同步表施工，要么 `validateFixtureExpectedCounts` 因键集不一致直接失败，要么终端游离在正本的计数与阶段模型之外，正本「所有 expectedCounts 与 owner 读回相等」的判据覆盖不到终端；同步表里还有一个根本找不到的修改目标。
- **最小修法**：在详设 §10b 写明四件事：
  - 终端计数进入 `COUNT_KEYS` 与 `expectedCounts`（值为 8），或者写 `N/A_WITH_REASON` 说明只由后置步骤清单计数；
  - 后置步骤在正本阶段模型里的位置，或不纳入的理由；
  - 删去「reset schema allowlist」，改写「整库重建，无 allowlist」，并把正本里过时的「seven fixed owner schemas」改为不写死数目的说法（或登记为既有漂移另行处理）；
  - 冻结八个样本各自的打印机（内置打印机按 D-35 选「设备内置」通用型号；谁带内置、谁带云端）和只读角色的具体做法。
- **需 Dexter 裁决**：否。

### S-5 · 存储形态没有和「一行终端＋JSONB 配置文档」比较

- **位置**：详设第 30 行（§1 只比较了 owner 归属和整存与分段）、第 115 至 117 行（七表与「整替换所有子表」）。
- **性质与证据**：推论加仓内事实。这个聚合永远整体读（详情）、整体写（一次保存），没有局部更新，也没有跨终端的按引用查询需求（D-12 没有派发，D-25 不要引用数）。仓内 JSONB 业务列已有先例（`extension_values`、`changes_json`、`value_json`），`doc/platform/backend-coding-standard.md` 对 JSONB 没有限制。
- **影响**：7 张表加上每次保存整替换子表，要额外处理子表删改、ref 保持（与 S-1 叠加，删行重插最容易让 ref 漂移）、同 owner 外键、去重主键，以及相应的迁移与集成测试。换成一行终端加一份 JSONB 文档，同样的约束由 owner 校验承担（这些校验本来就要写），一次带版本条件的 UPDATE 就完成原子保存，审计按段比较前后文档也更直接。
- **最小修法**：在 §1 补一段存储形态比较。若没有必须由数据库约束承担、而 owner 校验承担不了的理由，就改为「终端行（含 store/name 与 group/code 两个唯一约束）＋JSONB 配置文档＋回执」；若保留 7 表，要写明比较结论与理由。
- **需 Dexter 裁决**：否，属工程取舍；Dexter 若有偏好，一句话可定。

### N-1 · 需求覆盖表漏了两项

详设 §0 覆盖表（第 15 至 24 行）没有「品牌型号与型号→纸规格硬约束」和「同终端同连接方式标识不重复」两行（见本文 §2）。本轮已由需求作者写回需求正本（D-33、D-34，另有 D-35 与 V-29）；详设 §0 改为引用 D-28 至 D-35 即可。

### N-2 · IA 自相矛盾

IA 第 151 行写「IA ↔ 详设 `MATCHED_STATIC_2026-09-24`」，第 160 行又写 `CROSS_CHECK_WITH_DESIGN=NOT_STARTED_BY_AUTHORITY`；第 159 行「0 个 exact code 已冻结」也需要在 S-2 定码后同步。

### N-3 · V-26、V-27 的场景身份口径前后不一

计划第 66 行要求「每行必须在 scenario catalog 有独立 ID 和请求链」，第 99 行又说 V-26、V-27 是非 HTTP 专项、不得造空场景充数。写明这两个 ID 不登记进 `BackendAcceptanceScenarioCatalog` 即可。

### N-4 · 「主从布局尚无第二消费者」这个理由与事实不符

详设第 146 行写「不把尚无第二消费者的主从 layout 提升到 foundation」。但 `StoreServicePointPage.tsx` 第 801 行、`OrganizationStructurePage.tsx` 第 208 行已经各有一个内联的两栏 grid，交互工件第 45 行也把前者列为参照。结论（不为一行 CSS 建共享 primitive）可以保留，理由要改；而且交互工件要求终端页「窄屏改上下排列」，现有两页没有这个行为。要么三页一致，要么写明为什么只有终端页不同。

### N-5 · 激活码防泄漏可以复用现有的脱敏机制

后端对凭证类的值已有「重写 `toString()` 输出已脱敏」的惯例，例如 `WorkspacePasswordRecoveryService.java` 第 333 行、`OperationsSessionCookie.java` 第 21 行；前端 `libraries/frontend/admin-ui-foundation/src/observability/safeLogger.ts` 第 59 行有敏感键黑名单，其中不含激活码。建议：激活码在 owner 里用一个 `toString()` 已脱敏的值类型表示，并把 `activationcode` 加进 safeLogger 的黑名单。这是在已有机制上补一项，比单靠「不要打印」可靠。

### N-6 · 改名路径的名称锁没有写

详设第 117 行只在新建路径写了「持事务级 store/name AdvisoryLock 并检查名称」。编辑改名同样可能与并发新建撞名；要么编辑路径也按新名称加锁，要么写明部分唯一索引冲突一律映射为名称冲突的类型化错误，而不是 500。

### N-7 · seed「写前检测已有同码」没有可用的读取接口

详设第 261 行要求 seed 执行器「写前检测当前集团已有相同码」。但本期没有按码查找的接口（需求 R-8.8），列表也不返回码。改写为：以新建返回的激活码冲突为信号，再读本门店各 seed 终端的详情比对，判断是不是本次 seed 自己的旧数据；不要设计成全集团扫描。

### N-8 · 作废终端的详情能否读取，两处口径不一

详设 §10b 的 term-history 与需求 V-16 都要求作废后读回详情（码与原配置不变）；IA 第 135 行却把「选中对象已作废」归到类似「不存在」的失败。写明：详情 GET 对有权限者照常返回作废终端（只读）；界面发现选中的终端已作废时，从列表移除并切换选择。

---

## 4 · 专项攻击结论（请求点名的几项）

**两条激活码创建路径：成立。** 手填与自动两路都用以集团全状态唯一约束为精确冲突目标的 `INSERT ... ON CONFLICT DO NOTHING RETURNING`（详设第 117 行）。返回零行时，手填报冲突、绝不换码；自动换候选码，最多 16 次。这两种情况下事务都没有中止，不存在「在失败事务里重试」的问题。回执认领与终端写入在同一事务，失败一起回滚，回执不会被占住。唯一留白是改名路径的名称锁（N-6）。

**低熵码泄入回执与日志：设计成立，建议加固。** 请求摘要只覆盖不含码的字段和模式；手填重放时在事务内读出已存码做等值比较，同键异码返回幂等冲突；回执只存 ref、版本、状态（详设第 117 行）。我另外核了现有的旁路：后端没有记录请求体的过滤器，`ContractProblemAdvice` 不回显请求内容；前端 `observedBaseQuery` 只记关联 ID 与状态码；运营后台不向浏览器存储写任何东西。加固建议见 N-5。

**八台固定码的 seed 与四阶段后置执行：插入点成立，分母有缺口。** `scripts/dev/r5-complete-seed-executor.mjs` 第 389 行先校验四个组件，第 391 行才置 `business = "PASS"`，后置步骤插在两者之间可行；`store-preparing` 在正本里是启用门店、桌台开关关闭，term-preparing 样本成立。缺口见 S-4、N-7、N-8。

**18 项横切机制：结构成立。** 详设 §3 的 18 行与 `doc/decisions/templates/implementation-design-template.md` §3 固定行逐一对应、顺序一致；表里点名的现有能力我逐个打开核过都存在（后端 `OrganizationTaskPathLookup`、`CatalogScopeLookup.requireCatalogBrand`、`AdvisoryLock`、`ContractProblemAdvice`、`BackendAcceptanceScenarioCatalog`；前端 `useStoreServicePointReadModel`、`useCursorStack`、`CursorPagination`、`LifecycleStatusTag`、`adminListState`、`useRefreshVersion`、`adminWideDrawerSurfaceProps`、`StatusChangeConfirm`、`AdminDetailActionMenu`、`useCursorCandidates`）。内容上的问题是错误码那一行（S-2）。

**28 项验收场景：基本成立，缺一类硬约束。** 28 个场景身份齐全，V-1、V-4、V-9、V-10 的全表规模与需求一致（12、24、17 加非法宿主、119）；缺型号与纸规格的判据（S-3），V-26、V-27 的口径需澄清（N-3）。

**前后台生成物、测试与 seed 的同步分母：** 契约、生成、路由与权限这一侧的分母清楚。路径前缀与门店桌台一致；字面段与变量段并存的同级路径在仓内有先例（`/contracts/candidates` 与 `/contracts/{contractId}`），生成的路由登记能容纳。seed 一侧有缺口（S-4）。

---

## 5 · 亲核成立的承重事实

- 路径前缀 `/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}` 与 `contracts/openapi/paths/operations-admin/store-service-point-qr.paths.json` 一致；页面路由 `organization/store-terminals` 与 `apps/frontend/operations-admin/src/app/routing/pageRegistry.tsx` 第 183 行的 `organization/store-service-points` 同一命名习惯。
- `StoreServicePointOwnerApi` 只有按门店分页列区域的读取，没有按 ref 读取区域，也没有服务端关键字或类型过滤，详设新增 `readAreasByRefs` 与 `searchTerminalAreaCandidates` 的理由成立。
- 生产标签的 `BINDABLE_CANDIDATE` 用途在 SQL 里强制 `status='ENABLED'`，并在服务端完成关键字搜索（`CatalogProductionTagOwnerServiceSql.java` 第 10 至 14 行）；按 ref 读取不过滤状态，作废的也能读回（第 23 至 24 行）。详设对标签候选与旧引用的复用成立。
- 商品种子按作用域客户端各自创建生产标签（`scripts/dev/catalog-inventory-seed-executor.mjs` 第 1522 行），终端样本从门店作用域读回解析 ref 可行。
- 运营后台门店级页面在门店停用时读写均按启用目标解析（D-26 的平台依据），详设第 125 行沿用成立。

---

## 6 · 结论与授权边界

**VERDICT=NO-GO，M/S/N=1/5/8。** 方向与骨架成立。阻断项：
- M-1：型号清单覆盖面。Dexter 已裁决为通用型号（需求 D-35），待 Codex 落到 contract、交互、seed 与 S-3 的判据；
- S-1 至 S-5：Codex 可在既有授权内修订。

修订后建议再审一轮，重点看 D-35 如何落到 contract、seed 与 S-3（V-29）的判据，以及 S-1 的请求规则与 S-5 的存储取舍。

本结论只是静态设计评审，不授权实施、契约或代码改动、DEV、reset、seed、Browser L2、UAT 或部署。本会话是续接会话，由 Claude 主会话评审；本会话同时是需求正本的作者，所有结论都经过重开源码或当前字节核对。
