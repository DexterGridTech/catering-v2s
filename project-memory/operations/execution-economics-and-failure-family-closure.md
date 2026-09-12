---
id: operations.execution-economics-and-failure-family-closure
status: active
layer: routed
taskKinds: ["implementation","backend-acceptance","testing","review"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","frontend-platform"]
impacts: ["evidence","governance","runtime"]
triggers: ["implementation","failure","review"]
assertions: ["RUN_COUNT_NOT_RUN_COST_DOMINATES","FAILURE_FAMILY_CLOSED_BEFORE_NEXT","AUTHORIZED_FAILURE_DRIVES_REPAIR_AND_CONTINUATION","GOAL_HAS_NO_TOKEN_BUDGET_OR_EARLY_STOP","BROAD_RUN_IS_REGRESSION_NOT_DISCOVERY","PASS_WITHOUT_REVIEWED_FIXTURE_DENOMINATOR_IS_NOT_COMPLETION","RECONCILIATION_BEFORE_FIRST_DYNAMIC_RUN"]
sourceRefs: ["doc/review/platform/2026-09-02-v2s-sales-menu-execution-diagnosis-claude.md"]
---
# 执行经济学与失败族关闭

来源:2026-09-01 至 09-02 销售菜单实施的实测复算。本文的每条断言都带实测,不是经验之谈。

- `RUN_COUNT_NOT_RUN_COST_DOMINATES`:**受管运行的成本在次数,不在时长。** 实测该批 92 次受管运行,
  墙钟跨度 16.4 小时,而全部运行时间合计仅 2.2 小时(中位 66 秒,最长 4.1 分钟)——
  **运行只占墙钟 13%,约 86% 的时间在两次运行之间**(定位、编辑、重新推导、决策)。
  因此"跑得太多太慢"是错误的问题定义;提速的唯一杠杆是**提高单次运行的信息产出以减少次数**,
  不是优化运行速度或简单地少跑。⛔ 不得把优化方向定为缩短单次运行时长。

- `FAILURE_FAMILY_CLOSED_BEFORE_NEXT`:**同一 `failureCategory` 第二次出现,立即停止业务推进,
  先把该族关闭到零复发。** 实测反例:`BUDGET_PROJECTION_OPERATION_MISSING` 在 09:15、11:40、
  12:42、13:15、14:39、17:27×2、20:41、20:48 复发 **9 次,跨越 11.5 小时** ——
  一个结构性、可一次关闭的条件被反复撞击。
  这里的“停止业务推进”只冻结当前失败族之后的业务场景，**不停止实施 task 或 active goal**；
  主 agent 必须保留 first failure，重开日志、owning source 与 broken boundary，做最小根因修复，
  先用同一 focused proof 关闭该族，再继续剩余授权范围。该规则是阶段准入条件，不是遇败即停的建议。

- `AUTHORIZED_FAILURE_DRIVES_REPAIR_AND_CONTINUATION`:**在授权范围内，失败必须驱动修复与继续。**
  一次测试、构建或动态运行失败本身不是 task/goal 的完成条件，也不是停止理由；它必须先被保留为证据，
  分类为可修复失败、硬约束失败或设计意图偏离。可修复失败走“日志 → 根因 → 最小修复 → 同档复验 →
  继续”的闭环；硬约束（例如网络确实不可达、虚拟机无法启动）或下一步会实质偏离已批准设计且需要产品裁决时，
  才允许停止并报告精确边界。不得用延长 timeout、盲目重试、换场景或改写状态把未解决失败包装成 PASS。
  本规则不扩大授权、不取消 cleanup/隐私/证据档位，也不允许越过产品或设计裁决。

- `GOAL_HAS_NO_TOKEN_BUDGET_OR_EARLY_STOP`:**goal 不设置 token budget；未完成 goal 不得因预算、一次失败或阶段性报告而结束。**
  只有批准范围已经完成并且 business/cleanup evidence 关闭，或上一条规定的硬约束/设计意图偏离确实成立，
  才能结束；资源、授权、破坏性动作和证据边界仍按各自规范执行。

- `NATIVE_SEMANTIC_PROP_MUST_BE_PLATFORM_SUPPORTED`:**跨平台 primitive 的原生语义属性必须以目标平台实际支持集为准。**
  类型包装器允许传入字符串、Web 语义或源码注释都不能证明 Android/iOS 原生可接受；在目标平台上，
  不支持的 accessibility role 可能在属性更新阶段直接让运行时失败。最小防线是由 primitive 去掉目标平台不支持的值，
  保留控件本身已有的原生语义，并为每个新增原生语义在目标平台做 focused smoke；不得用重试、静默 catch 或另造兼容层遮蔽。

- `BROAD_RUN_IS_REGRESSION_NOT_DISCOVERY`:`all` 或大范围 calibration **只做回归确认,不做发现手段**。
  在多个失败族未隔离时跑 broad,会同时暴露 405/403/409/422/500/budget 等多类问题,
  单次运行的信息量被噪音稀释,无法判断首个业务根因。
  实测该批 `REMOTE_GRADLE_EXIT_NONZERO` 38 次中 30 次集中在 11:00–17:00,转 focused 后显著下降。

- `PASS_WITHOUT_REVIEWED_FIXTURE_DENOMINATOR_IS_NOT_COMPLETION`:**PASS 的证明力必须分级。**
  一次 CONTRACT/BUSINESS 双 PASS,若其 fixture 分母未经 fresh 独立复核,不构成完成证据。
  实测反例:某次运行双 PASS,事后发现只构造了 TAKEAWAY,缺 DINE_IN、PROJECT 级不合格、
  STORE GROUP_BUY 不合格、EXTERNAL TAKEAWAY 不合格四类反例 —— 属**不完整 oracle 造成的 false green**。
  最小做法:PASS 记录附"fixture 分母是否已被独立复核"的状态位;未复核的不计入完成度。
  与 `pitfalls/green-by-existence-check.md#EXISTENCE_IS_NOT_EXECUTION` 是两件事:
  那条讲"存在不等于执行",本条讲"执行通过也不等于分母完整"。

- `RECONCILIATION_BEFORE_FIRST_DYNAMIC_RUN`:**fresh 独立三维对账必须前移到第一次动态运行之前。**
  实测该批两个 false green(ordered 场景把"先加了重复 item"的 section 断言成 itemCount=0;
  BusinessChannel fixture 只构造 TAKEAWAY)**都是纸面上可发现的**,却等到动态运行后才由后置 verifier 抓到。
  纸面复核一次的成本远低于一次动态运行的间隙成本。

## 推论:静态优先的经济学判断

由 `RUN_COUNT_NOT_RUN_COST_DOMINATES` 直接得出:
**凡能静态确定的,必须在第一次动态运行前全部确定完。**
即使静态复核花两小时,也比再来 20 次"跑—失败—改—再跑"便宜。
这条是本仓"先 focused 后 all""对账前移""denominator 冻结"等要求的共同经济学依据。
