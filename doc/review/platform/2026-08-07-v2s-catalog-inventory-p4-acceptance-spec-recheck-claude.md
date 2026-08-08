# P4 验收判定规格整改复核（Claude）

评审对象：`doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-judgment-spec-codex.md`
（状态 `DESIGN_ONLY_AWAITING_P4_AUTHORIZATION`）
整改记录：`doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-spec-disposition-codex.md`
首轮结论：`doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-spec-review-claude.md`
（`NO-GO — M=0 / S=2 / N=1`，原样保留不改写）

会话出处：fresh v2s-rooted 评审会话。本轮为静态设计复核，
未执行任何 runtime、seed、API、L2、数据库、migration、部署或 cleanup 动作。
本文不构成 P4 启动授权。

---

## 0. 结论

**GO — M=0 / S=0 / N=2**

首轮三条（S-01 / S-02 / N-01）全部真实闭合。两条 N 均为设计输入层的细节，不阻断。

**本轮我需要先更正自己首轮的一条修复建议：S-02 我给的"给 39 条 testDatasets 加单值
`polarity`"是错的，Codex 的反驳成立且方案更优。** 见 §2。

---

## 1. 七项核验

### ① `conditionToProblemRef` 改为真实外键 —— **通过**

规格 §2.1 示例已改为
`{"operationId": "executeOperationsBrandCatalogCopy", "problemCode": "CONSUMPTION_UNIT_INCOMPATIBLE"}`,
并明写「当前 assertion matrix 的真实键只有 `precedence/problemCode/conditions`，
因此不得虚构 `conditionId`，也不得使用 precedence 下标、英文 conditions 散文或自由复制的错误码文本」。
我复算该二元组**确实存在于 matrix 中**。
`OWNER_COMMAND_FAILED` 已从引用位置移除，§2.2 改为「不得把 `OWNER_COMMAND_FAILED`
当作不存在的 problemCode」，disposition 第 23 行进一步写明未来绑定必须选一个**已存在**的
matrix problemCode。我复算确认该字符串**不是任何 operation 的 problemCode**，处置正确。

### ② 负向分母改为 case-level `polarity` —— **通过**

polarity 已落在 API case 层（`catalog-inventory-api-scenarios.json` 的 case 行），
§2.3 明确「fixture catalog 的 `purpose` 只保留人读说明，不参与极性推断」。

### ③ 38 negative / 62 positive exact-set —— **通过，逐项独立复算**

- 规格给出的 31 条 predicate（`^FIXTURE-(VOID-|INVENTORY-NEGATIVE$|ARCHIVED-ONLY-SKU$|
  DISABLED-SKU$|SHAPE-ADMISSION$|UNIT-GRAM-EACH$|REFERENCE-MAPPING-MISSING$|STALE-|
  MISSING-HEAD-COMPANY$|NO-COPY-SOURCE$|OWNER-SCOPE$)`）我实跑复算，**精确得到 31 条 caseId**。
- `parameter.outcome == "STRUCTURAL_BLOCK"` **精确得到 6 条**：`CI-API-018-10` … `CI-API-018-15`。
- **两个集合零重叠**，不存在重复计数。
- `CI-API-022-01` 与 `CI-API-022-02` 共用 fixture `FIXTURE-REPLAY-ROLLBACK`；
  该 fixture 的 `expected` 结构化声明了 `replaySameResult: true` 与 `ownerFailureRollback: true`
  （且 `catalog-inventory-fixture-catalog.schema.json` 有对应 schema），
  **规格引用的这两个字段是真实结构化字段，不是散文**。
- 合计 31 + 6 + 1 = **38 negative / 62 positive**，与 100 条全集 exact-set 相等。

### ④ 213 条 `conditionToProblem` 作为外键目标 —— **通过**

42 个 operation 共 **213** 条；**同一 operation 内 `problemCode` 重复者为 0**；
**`conditions` 数组长度非 1 的条目为 0**；
`(operationId, problemCode)` 去重后为 **213**，与条目数相等——
即该二元组对 213 条条件构成**严格 1:1 外键**，可安全作为引用目标。

### ⑤ seed DAG 由 `entities.relations` 派生 + 删边必红 —— **通过**

§3.2 已改为「执行顺序必须由 seed fixture 的 `entities.relations` 生成，再写入 loader manifest；
不能由对象数组排列隐式推断，也不能在 manifest 中另写一套未校验的 DAG」，
并给出当前依据 `SEED-DINNER-SET.entities.relations` 的 `DINNER-SET-001 → LATTE-001 / LATTE-SKU-M`
（我核实该关系确实结构化存在）。
新增约束：loader 对所有 dataset 的 `relations` 做拓扑排序，
指向不存在的 dataset/object、循环或无法归属的 `refKind/refCode` 直接 typed failure；
若提交可读 DAG 快照，必须有机器门断言其与 relations 推导的偏序完全一致；
**删除 `DINNER-SET-001 → LATTE-001` 的红变异必须使门失败**；
并明确「`relations` 是唯一真相，manifest 只是派生执行计划」。
这一条比我首轮建议的更完整——我只提了对账，作者补上了拓扑排序与悬空引用的 fail closed。

### ⑥ §3 与 §4 关键约束保持 —— **通过**

HTTP-only、真实 multipart 字节、readback（全文 11 处）、
`SEED_EXISTING_OBJECT_DRIFT` 漂移停止、「不得用 `DUPLICATE_CODE` 当作重跑成功」、
`catalog-inventory` 独立 profile 与 `r5-full` 隔离、§4 的「B 必须先 PASS，API 失败不进入 L2」
均在现文中保留，未因本轮整改被削弱。

### ⑦ 未执行任何 P4 动作 —— **通过**

规格状态仍为 `DESIGN_ONLY_AWAITING_P4_AUTHORIZATION`，
末段明写「当前不执行任何 runtime、seed、reset、API、L2、数据库、迁移、部署或 cleanup」；
disposition 的 evidence boundary 亦声明本次修复只改设计文档与处置记录，
未向 runtime scenario catalog 添加 case bindings、未新增 seed loader、未改 `r5-full`、
未发起任何 HTTP 请求、未上传资产、未创建数据库行、未主张 API/L2/business/cleanup PASS。
我未发现任何与此相悖的痕迹。

---

## 2. 我对首轮 S-02 修复建议的更正（如实记录）

首轮我在 S-02 中建议：「给 39 条 `testDatasets` 各加一个结构化字段
`polarity: POSITIVE | NEGATIVE`」。

**这个建议是错的。** Codex 在 §2.2 指出：不能给 fixture dataset 粗暴增加单值 polarity 作为唯一真相，
因为部分 fixture 被正向与负向 case 共同引用。我据此实算了全部 100 条 case 与其 fixtureRef 的
正负归属，结果是**确有 3 个 fixture 被正负 case 共用**：
`FIXTURE-SKU-STRUCTURE-CONFLICT`（3 负 / 6 正）、
`FIXTURE-COMPATIBILITY-MATRIX`（3 负 / 6 正）、
`FIXTURE-REPLAY-ROLLBACK`（1 负 / 1 正）。

若按我首轮的建议在 fixture 上打单值 polarity，**这 13 条正向 case 会被误分类**，
38/62 的分母将从源头失真。**作者把 polarity 放在 API case 层是正确解，也优于我的建议。**

这是我在本项目中第二次因"只看结构存在、未看语义分布"而给出偏差判断
（上一次是 IA-INV-001 的"键存在≠有值"）。特此记录，并作为我后续评审的自我校准点。

## 3. Findings

### N-01｜§2.2 举证的三个共用 fixture 中有一个不成立

**依据类型**：仓内事实。

§2.2 写「`FIXTURE-SKU-STRUCTURE-CONFLICT`、`FIXTURE-COMPATIBILITY-MATRIX`、
`FIXTURE-LOCAL-COPY` 等 fixture 被正向与负向 case 共同引用」。
我实算三者的正负分布：前两个确为共用（各 3 负 / 6 正），
但 **`FIXTURE-LOCAL-COPY` 是 0 负 / 3 正，并非共用**。

**影响范围**：结论（polarity 必须在 case 层）不受影响——真正的共用 fixture 是
前两个加上 `FIXTURE-REPLAY-ROLLBACK`，举证已足。
但该文段是本轮驳回我首轮建议的关键论据，举例不准会削弱其说服力，
也可能让后续读者据此得出错误的 fixture 分类。

**最小修复**：把 `FIXTURE-LOCAL-COPY` 换成 `FIXTURE-REPLAY-ROLLBACK`
（它本身就是 §2.2 下一行在讨论的对象），或直接写明"共用 fixture 恰为 3 个"并列出。

**是否需 Dexter 裁决**：否。

### N-02｜24 条 case 的 fixture 声明了 `caseParameterKey`，而该键不在 case 的实际 `parameter` 中

**依据类型**：仓内事实，全量比对。

39 条 `testDatasets` 中有 **27 条**在 `expected.caseParameterKey` 声明了案例参数键
（如 `FIXTURE-WORKBENCH-QUERY` 声明 `queryVariant`、`FIXTURE-SURFACE-STATES` 声明 `surfaceState`、
`FIXTURE-REPLAY-ROLLBACK` 声明 `failurePoint`）。
我逐条比对每个 case 的实际 `parameter` 键，发现 **24 条 case 缺少其 fixture 声明的那个键**——
它们携带的是通用的 `{variant, fixtureRef}`。

**影响范围**：**不影响本轮的 38/62 exact-set**（38 的推导只依赖 fixtureRef predicate、
`parameter.outcome` 与显式的 `CI-API-022-02`，与 `caseParameterKey` 无关），
所以不构成 S。但 P4 准备包在实现 case-level 绑定与生成器时会正面撞上这处不一致：
按 fixture 声明去取 case 参数会取空，只能回落到 `variant` 序号——
而"序号"正是本规格反复禁止的引用形态。这是冻结契约里的既有不一致，不是本次整改引入的，
**但现在指出比实现到一半再发现便宜**。

**最小修复**：在 P4 准备包的静态门里加一条断言——
`caseParameterKey` 声明存在时，引用该 fixture 的每个 case 的 `parameter` 必须含该键；
不一致的 24 条先据实修正 case 参数或撤下该 fixture 的 `caseParameterKey` 声明。
本轮不必改，登记进 P4 准备包范围即可。

**是否需 Dexter 裁决**：否。

## 4. 方案合理性

本轮整改的质量高于首轮：

- S-01 的修复不只是换了个键名，而是**把"matrix 真实键只有哪三个"写进规格正文**，
  从根上堵住了再次虚构键的可能；红变异也相应换成了"problemCode 改为 matrix 不存在的值"
  与"二元组偷换成数组下标"，正对新机制的失效模式。
- S-02 的处置**没有照搬我的建议**，而是先验证了我的建议会误分类，再给出更优解。
  这是我期望的 intake 方式——findings 是独立输入而非新权威，作者有责任证伪它。
- N-01 的落实超出我的建议范围（我只提对账，作者补了拓扑排序与悬空引用 fail closed）。

全文仍未新增实体、未改 OpenAPI、未动 `r5-full` 分母，代价与当前阶段匹配。

## 5. 授权边界

本复核仅覆盖 P4 验收判定设计与静态输入。**不构成 P4 启动授权**，
也不背书 runtime、seed、API、L2、数据库/migration、部署或 cleanup。
N-01 与 N-02 均在既有批准边界内可自主处置，不需要 Dexter 裁决；
N-02 建议登记进 P4 准备包范围，在实现 case bindings 时一并处理。
