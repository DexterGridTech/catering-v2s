# TER `kernel.base.runtime` 单元 B DESIGN review Round 1

> 本文件由主 agent 将 fresh 独立子 agent 已完成的只读 verdict 原样落盘；reviewer 因只读边界未自行写仓库。
> 本文件不构成作者自审，也不重开 review round。

```text
REVIEW_CYCLE_ID=TER_RUNTIME_UNIT_B_DESIGN_2026_09_01
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW=TRUE
VERDICT=NO-GO
M=2 S=1 N=0
```

## 输入清单与边界

独立 reviewer 只读重开：

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/review-standard.md`
- `doc/decisions/templates/implementation-design-template.md`
- `doc/platform/terminal-coding-standard.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`
- `project-memory/operations/terminal-coding-standard.md`
- `project-memory/operations/verification-governance.md`
- runtime 需求文档指定章节
- Unit A 详设
- Unit B 详设
- runtime、contracts、state 与 tools 的当前关键源码接点

本轮未运行动态、DEV、seed、reset、browser、L2、UAT、deploy 或仓级 normal verify。

## 结论摘要

- Clarity：FAIL，核心 selector public API 出现互斥签名。
- Verifiability：FAIL，runtime rule 数量、owner rule 数量、最终证据口径互相冲突。
- Completeness：FAIL，route context 合同收窄遗漏当前 runtime tests 的真实 invalid fixture 改造面。
- Big Picture：MOSTLY_FIT，A/B 单写 slice、lifecycle seam、role cleanup seam、state sync debt、test-only sync seam 方向基本正确。

## Findings

### M-1 `selectRequestExecutionCommands` public API 签名互斥

- 位置：Unit B 详设 §4.4、§4.9.5、§17.2。
- 证据档位：`CONFIRMED / STATIC_SOURCE_ONLY`。
- 事实：设计一处定义为 `selectRequestExecutionCommands(view, displayMode?)`，并说明“不重新计算、只过滤 command view”；owner API/consumer 表又写成 `selectRequestExecutionCommands(state, requestId, displayMode?)`。
- 后果：executor 可以实现任一版本并让部分测试通过，但 public export、README、consumer 示例与 selector memo 边界会分裂。
- 最小修复：在 §4.4、§4.9.5、§8、§17.2 与测试矩阵统一一个签名。reviewer 推荐更小的 `selectRequestExecutionCommands(view, displayMode?)`，由 request selector 负责 state/request 聚合。
- 更小替代不足：让实现者任选会改变 public contract；只加注释不能消除根签名冲突。

### M-2 `CommandRouteContext` 收窄遗漏 runtime 真实夹具

- 位置：Unit B 详设 §3.1、§8.2、§9.1、§17.3；当前源码 `apps/terminal/kernel/base/runtime/test/roleAndRoute.test.ts`、`visibility.test.ts`、`peerGateway.test.ts`。
- 证据档位：`CONFIRMED / STATIC_SOURCE_ONLY`。
- 事实：需求把 route context 收窄为闭合集合；当前 runtime tests 仍使用 `workspace:'east'/'west'`。详设列出了 contracts 与 platform-ports fixture，却没有把这些 runtime fixtures 纳入同步改造面。
- 后果：CP-B1 可声称 contracts/platform-ports 已完成，而 runtime typecheck 或后段 package test 才暴露旧 fixture，违反 full-chain sync 要求。
- 最小修复：在 §8.2、§9.1、§17.3 逐文件加入三个 runtime fixture，并写明旧值到 `MAIN/BRANCH` 的映射或不依赖旧字面的等价断言。
- 更小替代不足：只写“三包 fixture”过泛，已知具体非法值会直接造成编译/断言断层。

### S-1 gate/rule 数量与最终证据口径互斥

- 位置：Unit B 详设 §7.2、§15、§17.1、§17.6。
- 证据档位：`CONFIRMED / STATIC_SOURCE_ONLY`。
- 事实：§7.2 写 runtime static rules 从 4 增至 6 并列 2 道新 rule；§17.6 写只新增 1 道；最终证据写 5 道；owner rules 又出现 20 与 21 两种口径。
- 后果：executor/reviewer 无法判断验收 denominator，少建、多建或少跑 gate 都可能被解释为符合设计，red mutation 也失去稳定分母。
- 最小修复：统一 runtime 当前 4 + 新增数 = 总数，并统一 owner rule 总数；保留的每道门必须有对应定向 red mutation。
- 更小替代不足：这是验收口径，不是局部文案，改单一数字仍会留下漂移。

## Representative simulation

- A/B 五个接点：当前 A 源码支持 lifecycle 单入口、`displayMode:null` 单点、dispatch identity options、role effects、command aggregate 复用；Unit B 总体方向可落地。
- 双 slice、role flip、sync direction debt：设计匹配当前 state sync 识别方式；该部分未见 blocker。
- Public `58→63`：5 个新增 root export 大体右尺寸，未见明显零消费者噪音。
- test-only StateRuntime sync seam：当前 Runtime 不公开 StateRuntime，测试侧已有类似非 root testing accessor 模式；该 seam 本身不过重。

## 授权边界

本轮只读静态 DESIGN review 不授权实施、源码修改、动态运行、设备、DEV、seed、reset、browser L2、UAT、deploy、数据操作或仓级 normal verify。
