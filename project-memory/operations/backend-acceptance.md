---
id: operations.backend-acceptance
status: active
layer: routed
taskKinds: ["backend-acceptance","design","implementation","testing","review"]
domains: ["backend","contract","platform"]
consumerFaces: ["all"]
owners: ["backend","contract","platform","product"]
impacts: ["database","contract","evidence","runtime","cleanup","governance"]
triggers: ["task-start","implementation","review","failure","runtime"]
assertions: ["BACKEND_ACCEPTANCE_SINGLE_CAPABILITY","BACKEND_ACCEPTANCE_OPERATION_DENOMINATOR","BACKEND_ACCEPTANCE_FOUR_DIMENSION_VERDICT","BACKEND_ACCEPTANCE_SCENARIO_DESIGN_ADMISSION","BACKEND_ACCEPTANCE_MEASUREMENT_CALIBRATION","BACKEND_ACCEPTANCE_FULL_MODE_CAPACITY","BACKEND_ACCEPTANCE_OWNER_MODULE_MAPPING","BACKEND_ACCEPTANCE_CONSUMER_DISPOSITION","BACKEND_ACCEPTANCE_HISTORICAL_SEED_REPLAY","BACKEND_ACCEPTANCE_CHANGE_IMPACT_FAIL_SAFE","BACKEND_ACCEPTANCE_BUG_FIX_RED_PROOF","SEED_IS_DEV_DATA_ONLY"]
sourceRefs: ["doc/decisions/2026-08-13-v2s-backend-acceptance-standard.md"]
---
# Backend acceptance

- `BACKEND_ACCEPTANCE_SINGLE_CAPABILITY`: “完成后台功能测试”与“后台性能测试”都只指向 `backend-acceptance`，不得恢复数量、阶段或功能/性能分立命名。
- `BACKEND_ACCEPTANCE_OPERATION_DENOMINATOR`: 每次从当前 semantic route 与 bindings 派生 operation identity exact set，并把 row equality 与 projection digest freshness 分开验证；测试类数与历史总数不是分母。
- `BACKEND_ACCEPTANCE_FOUR_DIMENSION_VERDICT`: fresh 真实 HTTP 执行必须在同一 correlation 下给出 CONTRACT、BUSINESS、确定性结构 PERFORMANCE 与 CLEANUP；任一维不通过即不得声称后台功能测试完成。
- `BACKEND_ACCEPTANCE_SCENARIO_DESIGN_ADMISSION`: 新增或修改 operation 的详设必须包含 identity、fixture、request、businessOracle、performanceCriterion、cleanup；correctnessCases 为空时必须说明理由。
- `BACKEND_ACCEPTANCE_MEASUREMENT_CALIBRATION`: 每次动态 operation batch、首次结构 baseline 写入及 baseline 下降前，必须由 fixture 定义独立推导 known-cost 校准期望，并 exact 证明 LOGICAL_SQL、QUERY、UPDATE、CONNECTION、TRANSACTION、BATCH；不得从 measured output 回填，少计或 no-op sink 必须红。
- `BACKEND_ACCEPTANCE_FULL_MODE_CAPACITY`: 128/571 的 entry anchor 覆盖意味着 ALL 是常态容量模型；per-edit lane 下界必须按 full denominator 的 fresh scheduling weight 与时间目标反推。提速只允许增加真正隔离 lane 或消除 runner 开销，禁止缩小 operation、四维或 cleanup 面；降低 ALL 频率只能靠提高 source-derived anchor 覆盖率，禁止加豁免。
- `BACKEND_ACCEPTANCE_OWNER_MODULE_MAPPING`: scenario provider 必须使用 execution contract 的封闭 owner→Gradle module→test-fixtures root 映射机械物化；未知 owner、路径碰撞、集中放置或按 owner 同名猜目录均 fail closed。
- `BACKEND_ACCEPTANCE_CONSUMER_DISPOSITION`: route/schema/error 变化的 consumerFace 行必须使用封闭枚举并携带规定证据；自由文本、“稍后处理”、缺证据与 PENDING 都不是合法 disposition。
- `BACKEND_ACCEPTANCE_HISTORICAL_SEED_REPLAY`: 实施必须从 hash-bound catalog 逐 findingId 关闭 6 条 CONNECTION/TRANSACTION/QUERY 联合回归、15 个 HTTP failure family 与 8 个 seed/client/fixture failure family。六条性能行必须新增 route regression，且每调用 QUERY、CONNECTION、TRANSACTION 均不得高于 DBCR 前 baseline；只恢复连接或事务包装不构成闭合，每条 QUERY 必须给出已降低或逐 statement 最小性证据。non-route 行须提供 source-derived affected-route 推导方法与 owning source；其余行即使判 seed-only 仍须 affected route exact set 与 fresh contract/business/cleanup proof；“历史问题已回放”不是证据。
- `BACKEND_ACCEPTANCE_CHANGE_IMPACT_FAIL_SAFE`: 用 package-entry 不可变 `P0/W0` 与 exit `P1` 独立扫描 production surface；`P0 ∪ P1` 中存在性或全文件 hash 变化且不在 entry anchor 集 `W0` 的任一文件都把影响面提升为 ALL，同包重生成 inventory 不得自准入，禁止手写共享路径清单兜底。
- `BACKEND_ACCEPTANCE_BUG_FIX_RED_PROOF`: BUG_FIX 必须有修复前 FAIL、修复后 PASS 的 scenario 红证；无法 route 表达或未受回归保护必须显式进入封闭 disposition，不得沉默通过。
- `SEED_IS_DEV_DATA_ONLY`: seed 只为 DEV 提供完整体验数据，不产生后台功能、性能或 cleanup 验收结论。
