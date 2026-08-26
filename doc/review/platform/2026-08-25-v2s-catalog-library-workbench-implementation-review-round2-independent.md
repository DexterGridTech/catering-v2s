# 商品库工作台实施独立对抗复核（Round 2）

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=2026-08-25-catalog-library-workbench-implementation
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=REQUEST_CHANGES_NO_GO
M=0
S=2
N=1
SCOPE=STATIC_SOURCE_AND_FOCUSED_PROOF_ONLY
L2_USER_VISIBLE=UNVERIFIED_CURRENT_ROUND_STATIC_ONLY
```

本件由 fresh 独立子 agent 在只读边界内完成；作者会话未代写 verdict。输入为已批准的正式需求、Journey、IA、implementation design、serial plan、P1 生成源、工作台生产源码、locator bindings 与静态测试。结论仅记录源码核验，不把静态材料表述为 browser L2 或受管运行证据。

## 首败与已知正常

- **FIRST_FAILURE：** P1 生成源仍把 option preparation effect 的 `tagOperation=ADD_ONLY` 作为运行时契约规则输出。
- **LAST_KNOWN_GOOD：** 单一生产标签在商品级存储、owner 和数据库 partial unique 的正向链已收敛为 singular。
- **BROKEN_BOUNDARY：** P1 contract generation；已裁定的选项 effect 只允许非负时长增量与制作说明，却仍向运行期输出标签操作语义。
- **BUSINESS：** 未执行动态动作，本轮不判定。
- **CLEANUP：** `NOT_APPLICABLE_STATIC_ONLY`。

## Findings

### S-01 CONFIRMED：选项 effect 的已退役标签操作仍被 P1 输出

`preparationRules.effect.tagOperation` 与 schema 的 `x-tagOperation` 仍在生成源和生成产物出现。它们不是恶意输入拒绝或仅测试红夹具，而是对外契约的有效规则；这会使未来实现者误以为选项可改变生产标签。修复必须删除运行期声明，并在 P1 self-test 中把重新输出任一字段作为明确失败条件；不得改成忽略、兼容或默认 ADD_ONLY。

### S-02 CONFIRMED：工作台仍需完成真实职责拆分

旧 `CatalogWorkbenchController` 仍混有树层级展示、工具栏/列表形态和多个 Drawer/Modal 任务面。设计要求的“宿主只装配与生命周期、状态三层各一住址”不能只靠文件改名关闭。至少应将树导航、内容装配、任务 surface 与各业务 controller 分离，使新增列表列或筛选不改宿主；抽取后的 presenter 不得复制 server facts、草稿或 action state。

### N-01：locator bindings 的 sourceFiles 要与 testId 实际定义对齐

scope/problem/retry 四个 testId 实际由 `catalogTestIds.ts` 定义，bindings 只列 controller 会形成迁移后的来源漂移。将定义模块加入 sourceFiles 即可，勿复制 literal。

## 复核通过的范围

- 三层分类在创建、挪动与拒绝第四层的 owner 入口闭合；树候选不自行计数。
- SKU 父商品有真实展开控件，无 SKU 商品不出现伪入口；父/子行共用列表边界。
- 商品列 240、父图 72、SKU 图 60、单标签全宽和 Tooltip 的静态断言已存在。
- 新 GET 的只读连接作用域与全量 acceptance 的默认性能门已有静态闭合；动态预算与 borrow evidence 仍待受管 Testcontainers。

## 最终轮处置要求

Round 2 已用尽本 review cycle 的独立轮次。作者只能逐项源码回读、修复并以既有静态/动态门验证；不得把修复后重新召集 reviewer 当作新的同 cycle 轮次，也不得降级业务、扩大预算或以 fallback 遮蔽该两项 finding。
