# P4 验收判定规格独立评审（Claude）

评审对象：`doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-judgment-spec-codex.md`
（状态 `DESIGN_ONLY_AWAITING_P4_AUTHORIZATION`）

会话出处：fresh v2s-rooted 评审会话。Dexter 2026-08-07 就本文件授予评审授权。
本评审为静态设计评审，未执行任何 runtime、seed、API、L2、数据库或 cleanup 动作。
本文不构成 P4 启动授权。

---

## 0. 结论

**NO-GO — M=0 / S=2 / N=1**

方向正确，§3（seed 装载器）**今天就可实施**，§4 的交付顺序与退出判定也站得住。
NO-GO 只卡在一处：**§2 的核心机制引用了两个尚不存在的结构化输入**——
`conditionId` 在 assertion matrix 中没有，负向 fixture 的极性标记在 fixture catalog 中也没有。
按现文实施会立刻卡住，且规格在同一节里禁止了唯一可用的替代方法。

两处修复都很小，且我已验证了可行路径（见 S-01、S-02）。补完即可 GO。

---

## 1. 我独立复算通过的部分

以下均为我自己重算，未采信文中数字：

- **6 条结构阻断**：`parameter.outcome == "STRUCTURAL_BLOCK"` 精确得到
  `CI-API-018-10 … CI-API-018-15`，恰为 6 条，与 §2.2 一致。
- **`CI-API-022-02`** 存在于 100 条用例中。
- **5 个 seed dataset 的 ID** 与 §1 表格逐字一致：
  `SEED-LATTE`、`SEED-DINNER-SET`、`SEED-CAESAR`、`SEED-MATERIALS`、`SEED-WEIGHED`。
- **§3.2 的 DAG 有结构化依据**：`SEED-DINNER-SET` 的 fixture 里声明了
  `relations: [{from: "DINNER-SET-001", to: "LATTE-001", refKind: "SKU", refCode: "LATTE-SKU-M"}]`,
  与"套餐依赖 Latte 的 SKU 引用"的判断吻合，**不是拍脑袋排的顺序**。
- **§3.4 的 r5-full 描述属实**：`scripts/dev/profiles/r5-full.json` 的
  `scenarioDenominator` 确为 32。
- **§5 对 `IA-INV-001` 的表述准确**：端到端缺口确实精确为 `materialRole` 未回填，
  与我 round-3 与 N-01 复核的结论一致，未夸大也未缩小。
- **§2.3 的红变异清单选得好**：删绑定、negative 改 positive、把 `CI-API-022-02` 指向另一条件、
  把 condition key 改成数组下标——四种都直击该机制的失效模式。

## 2. Findings

### S-01｜`conditionId` 在 assertion matrix 中不存在，且规格自身的举例违反了自身规则

**依据类型**：仓内事实，穷举复算。

`contracts/policy/catalog-inventory-assertion-matrix.json` 的 42 个 operation 共
**213 个 `conditionToProblem` 条目**，我逐条统计字段分布，结果恒为
`{precedence, problemCode, conditions}` 三个键——
**不存在 `conditionId` / `id` / `key` / `conditionKey` 中的任何一个**。

而 §2.1 规定 case 必须写
`conditionToProblemRef: {operationId, conditionId}`，且"`conditionId` 必须是 assertion matrix 中
稳定的 machine key；**禁止**用条件数组下标、自然语言片段或重复写 `problemCode` 作为引用"。

**当前 matrix 里能用的只有这三样，而三样都被这条规则排除了**：
`precedence` 是序数、`conditions` 是英文散文、`problemCode` 被明令禁止。
也就是说 §2.1 要求引用一个不存在的东西。

两处佐证这不是我读错：

- §2.1 自己给的例子 `"conditionId": "CONSUMPTION_UNIT_INCOMPATIBLE"`，
  我核实 **`CONSUMPTION_UNIT_INCOMPATIBLE` 本身就是一个 `problemCode`**——
  规格的示例正好违反了它自己"禁止用 problemCode 作为引用"的规则。
- §2.2 让 `CI-API-022-02` 指向 `OWNER_COMMAND_FAILED`，
  我全表检索 **该字符串不是任何 operation 的 problemCode**（文中"以实际 stable key 为准"的
  括注是诚实的，但也说明写规格时并未核对过 matrix 的真实取值）。

**影响范围**：§2 是整份规格的主体，也是我此前指出"100 条全绿等于 100 次请求没崩"的补救措施。
按现文进入实施会在第一步卡住，进而很可能退回用 `precedence` 下标或散文匹配——
那正是规格想避免的。

**最小修复（我已验证可行，不需要新增契约结构）**：改用
`conditionToProblemRef: {operationId, problemCode}` 作为引用键。依据是我复算的两个事实：

1. **同一 operation 内 `problemCode` 唯一**——42 个 operation 中重复者为 **0**；
2. **213 个条目的 `conditions` 数组长度全部为 1**——不存在"一个 problemCode 对应多条条件"
   需要再细分的情况。

因此 `(operationId, problemCode)` 今天就是对该条件的 **1:1 稳定外键**。
门只需断言该二元组在 matrix 中存在即可，**不构成 §2.3 所担心的"第二份自由字符串"**——
外键与副本的区别在于前者被机械校验、无法漂移。
若日后出现同 problemCode 多条件的情形，再给这 213 条补 `conditionId` 也不迟；
现在补是为不存在的问题付成本。

**是否需 Dexter 裁决**：否。

### S-02｜38 中的「31」没有结构化选择依据，而规格在同一段禁止了唯一可用的方法

**依据类型**：仓内事实。

§2.2 说这 31 条"由 fixture catalog 中**明确表示**失败、阻断、漂移、越权或数据保护的
test fixture 引用得到"，并在同段强调"不允许用 `expectedBusinessResult` 的中文关键词猜测"。

我核了 `contracts/policy/catalog-inventory-fixture-catalog.json` 的 39 条 `testDatasets`：
每条的字段为 `fixtureId / class / purpose / scenarioIds / ownerScopes / objects / edges /
generatorRecipe / setupChannel / readbackSelectors / expected / cleanupPolicy / entities`，
其中 **`class` 的取值 39 条全部是 `"TEST"`**，
**没有 `polarity` / `outcome` / `negative` / 任何等价的结构化极性标记**。
唯一承载"失败/阻断/漂移"语义的是中文 `purpose` 散文
（如"同编码物料消耗单位不一致，双向均阻断"、"预检后来源版本漂移"）。

**所以 selector 只能读中文 purpose 做关键词匹配——正是同段明令禁止的做法。**
规格要求的"明确表示"在数据里并不存在。

**影响范围**：38/62 的 exact-set 是 §2.3 机器门与 §4 退出判定的分母基础。
分母的来源若不可机械复算，"38"就变成一个需要人工维持的魔数——
这与我们前三轮在 IA 对账上刚清理掉的"人工名单"是同一类风险。

**最小修复**：给 39 条 `testDatasets` 各加一个结构化字段
（`polarity: POSITIVE | NEGATIVE`，或语义更强的 `expectedOutcome`）。
这是对一份**已在被消费**的契约做一次性字段补充，不新增文件、不新增实体；
补完后 31 即可机械派生，生成器输出的 `negativeCaseIds` 也才具备可复算性。
补的时候按 `purpose` 逐条人工判定一次即可——**人工判定发生在冻结契约时、且只发生一次**，
与"每次运行都靠关键词猜"有本质区别。

**是否需 Dexter 裁决**：否。

### N-01｜seed DAG 应由 fixture 的 `relations` 派生并交叉对账，不要在 loader manifest 里手写第二份真相

**依据类型**：仓内事实 + 本项目已有教训。

§3.2 要求"执行顺序必须显式写入 loader manifest，不能靠对象数组当前排列隐式推断"——
这个方向是对的。但我发现依赖关系**已经结构化存在于 fixture 里**：
`SEED-DINNER-SET` 声明了 `relations: [{from: "DINNER-SET-001", to: "LATTE-001",
refKind: "SKU", refCode: "LATTE-SKU-M"}]`。

若 manifest 里的 DAG 是**手写**的，就会与 `relations` 构成两份真相。
本项目刚用三轮复核处理完 IA 对账"人工名单与源码脱节"的问题，
同一模式不宜在 P4 重新引入。

**最小修复**：manifest 的 DAG 由 `relations` 生成；若为可读性保留显式声明，
则加一条门断言"manifest DAG 与 fixture `relations` 推导出的偏序一致"，
并配一个红变异（删掉 DINNER-SET→LATTE 这条边应使门失败）。

**是否需 Dexter 裁决**：否。

## 3. 方案合理性

- **问题对不对**：对。§2 解决的正是我此前指出的"100 条全绿只证明请求没崩"，
  §3 解决的是 seed 装载器无执行体。两件都是 P4 真实前置，没有虚构工作。
- **方案优不优**：§3 明显优——传输与 owner 边界、依赖 DAG、重跑与漂移、profile 选择四段都落到了
  可执行约束；尤其 §3.3 把"重跑"定义为"先查 receipt、digest 相同则 REUSED、
  不同则 typed `SEED_EXISTING_OBJECT_DRIFT` 停止"，而不是"重复 POST 直到成功"，
  并明确"不得用 `DUPLICATE_CODE` 当作重跑成功"——这条我特别认可，
  它堵住的正是 seed 脚本最常见的假成功。§3.4 主张新建 `catalog-inventory` profile
  而不动 r5-full 的既有分母，边界感是对的。
  §2 的**意图**同样正确，只是落点悬空，见 S-01/S-02。
- **代价配不配**：配。全文没有要求新建实体、新建表或改 OpenAPI；
  两处修复也都是对既有契约做小幅字段补充。没有过度设计。

## 4. 对 §4 交付顺序的一点确认

§4 把顺序定为「准备包（静态）→ B(seed) → A+F(共享 runner) → 收口」，
与我在 P4 范围登记里指出的排期依赖一致：
fixture 的 `consumerBindings` 把 `P3_L2` 绑在同一份 catalog 上，
L2 预期有真实种子数据可用，所以 B 必须先于 F。此处无异议。

"API 失败不进入 L2"这条也合理——L2 在 API 已知失败的前提下跑，只会产生难以归因的红。

## 5. 授权边界

本评审仅覆盖该设计准备稿的静态评审。**不构成 P4 启动授权**，
也不背书其中任何 runtime、seed、API、L2、数据库、迁移、部署或 cleanup 动作。
S-01、S-02、N-01 均为对既有契约的小幅结构补充，在既有批准边界内可由 Codex 自主处置，
不需要 Dexter 裁决；补完后我可再做一次静态复核。
