# TER `kernel.base.state` 详设与实施计划独立审查

## Round 1 · fresh 独立子 agent 原始结论

```text
REVIEW_CYCLE_ID=TER_KERNEL_BASE_STATE_IMPLEMENTATION_DESIGN_20260831
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=TRUE
REVIEWER=/root/state_design_review_round1
VERDICT=NO-GO
M/S/N=2/1/0
EVIDENCE_TIER=STATIC_DESIGN_SOURCE_REVIEW_ONLY
```

审查者完整读取需求、规范、项目记忆、详设、计划与 owning sources；只读静态核验，未运行实现、动态、设备、
DEV、seed、reset、浏览器 L2、UAT 或部署。

### M-1 · descriptor 结构类型无法兑现 type-level 双向一致性

**事实**：Round 1 字节把 `persistIntent`、`persistence`、`syncIntent`、`sync` 设计成四个互相独立字段，
同时要求 T-3 用 `@ts-expect-error` 证明四种不一致声明不可编译。按该形态，`never + persistence` 与
`isolated + sync` 都是合法 TS object，只能由 runtime 拒绝。

**后果**：删除 T-3 的 `@ts-expect-error` 不会变红；type reverse control 可以全绿但类型契约未建成。

**最小修复**：descriptor 改为 persistence 与 sync 两个 discriminated union 的交叉；`owner-only` 带非空 tuple，
`never` 禁 persistence，非 isolated 带 sync，isolated/省略禁 sync。

### M-2 · 所谓 opaque registration 可由外部五字段 object literal 伪造

**事实**：Round 1 字节的 `StateRuntimeSliceRegistration` 只有五个公开结构字段，
`CreateStateRuntimeInput.slices` 却依赖未在结构中出现的 reducer/persistence/sync closure。

**后果**：外部可构造假 registration；factory 要么拿不到 closure，要么信任假元数据而静默偏离。

**最小修复**：加入不可伪造 nominal shape（非导出 `unique symbol` brand 或等价机制）、内部 resolver/WeakMap，
并让外部 object literal 在类型层红、未知 registration 在运行期 I/O 前 fail closed。

### S-1 · sync envelope 允许既无 value 也非 tombstone 的非法态

**事实**：Round 1 字节同时把 `value` 与 `tombstone` 设为 optional，`{updatedAt}` 可以合法进入 diff。

**后果**：apply 可把没有 upsert/delete 语义的 entry 当作成功同步。

**最小修复**：改为互斥 union；value 分支禁止 tombstone，tombstone 分支禁止 value，并补类型与运行时反断言。

### Round 1 同根扫描

- descriptor 四条一致性、D-3…D-6、T-2/T-3 与 type reverse control 同受 M-1 影响；
- `defineStateRuntimeSlice`、runtime input/getSlices 与 workspace expansion 同受 M-2 影响；
- full/partial 的 `replaceMissing` 区分成立，非法 envelope 是同步形态中唯一新增缺口；
- reset root action/action creator 均为 package-private，未发现通用 reset 后门。

## 作者 intake 与修订

三条均为 `CONFIRMED`，已按最小修复落入当前详设与计划：

1. descriptor 改为两个 discriminated union 的交叉，保留 runtime 动态输入校验；
2. registration 增加非导出 unique-symbol brand、冻结 object、WeakMap identity 与 I/O 前 fail-closed；
3. sync envelope 改为 value/tombstone 互斥 union，新增 T-6/T-7 及对应计划步骤。

## Round 2 · fresh 独立子 agent 定向结论

```text
REVIEW_CYCLE_ID=TER_KERNEL_BASE_STATE_IMPLEMENTATION_DESIGN_20260831
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=TRUE
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER=/root/state_design_review_round2
VERDICT=NO-GO
M/S/N=1/2/0
EVIDENCE_TIER=STATIC_DESIGN_SOURCE_REVIEW_ONLY
```

Round 2 确认 Round 1 三条类型根因均已闭合，同时发现以下三处当前字节仍要求实施者猜测：

### M-1 · 四个 sync helper 仍用省略号，公开签名未冻结

**事实**：§4.3 声称是精确实现契约，四个公开函数却只有 `(...)`；TER 已改变 POC 的 diff/full/latest 形态，
不能靠 POC 补参。

**后果**：实现者可自行决定 descriptor/state/summary/options 的参数顺序与 full/partial 返回，exact-export 门仍会绿。

**最小修复**：逐函数冻结完整泛型、参数名、顺序与精确 full/partial 返回分支。

### S-1 · reducer 可选但缺省语义未定

**事实**：descriptor 的 `reducer?` 允许无 reducer registration；本文又拒绝 POC placeholder，却未说明单项缺 reducer
是跳过还是报错。

**后果**：owner 可声明 persistence 但不进入 store，测试仍可能只覆盖带 reducer 的样例而全绿。

**最小修复**：reducer 改必填，并补类型与动态伪造反断言；明确不建 placeholder。

### S-2 · workspace action type 改写算法未冻结

**事实**：只写“改写 action type”，未定义拆分点、最终 type、字段保留与非法输入。

**后果**：前缀、后缀、替换等互斥实现均可自称正确，future owner reducer 可能收不到 dispatch。

**最小修复**：按最后一个 `/` 拆非空 sliceType/actionName，固定输出
`${sliceType}.${workspace}/${actionName}`，保留其余字段，冻结缺 workspace/非法 type 错误并补 focused cases。

## Round 2 作者 SELF_DECIDED intake

三条均为 `CONFIRMED`，已按上述最小修复同步当前详设与计划：

1. 四个 sync helper 已给出完整泛型、参数和 `Extract<..., replaceMissing>` 返回；T-8 固定调用方式；
2. reducer 改必填，D-7 与类型/动态反向控制共同拒绝缺失，不建 placeholder；
3. workspace 最后一个斜杠拆分、完整输出、字段保留与固定错误已写死并进入 focused tests。

同一 cycle 已到 `REVIEW_ROUND_LIMIT=2`，不再发起第三轮。当前作者收口判断：三条已闭合，设计材料可交
Dexter 与 Claude 做外部 DESIGN review；该判断不授权实施。
