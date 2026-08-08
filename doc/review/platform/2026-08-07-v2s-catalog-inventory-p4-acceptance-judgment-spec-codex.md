# 商品目录与门店轻库存 P4 验收判定规格（Codex，设计准备稿）

状态：`DESIGN_ONLY_AWAITING_P4_AUTHORIZATION`

本文件把 P3 收口后必须先冻结的两项准备工作写成可执行的判定规格：

1. 100 个 API case 的边界极性与结构化期望绑定；其中业务边界负例仍为 38 条，但只有明确产生 typed failure 的 case 才绑定 `condition → problem`；成功事实/派生事实负例不得伪造错误码；
2. 真实 seed 装载器的一页执行约束、依赖、重跑与 profile 边界。

本文件不是 P4 授权、不是契约修改、不是 seed/reset 实现，也没有执行 API、L2、DEV/UAT 或远端运行。当前只读来源是：

- `contracts/policy/catalog-inventory-api-scenarios.json`（26 scenarios / 100 cases）；
- `contracts/policy/catalog-inventory-assertion-matrix.json`（42 operations，含 operation 级 `conditionToProblem`）；
- `contracts/policy/catalog-inventory-fixture-catalog.json`（5 seed datasets / 39 test datasets / seed execution plan）；
- `contracts/policy/catalog-inventory-fixture-catalog.schema.json`；
- `contracts/policy/catalog-inventory-copy-policy.json`；
- `scripts/dev/seed`、`scripts/dev/r5-dev-environment.mjs`、`scripts/dev/r5-seed-plan.mjs`、`scripts/dev/owner-command-seed-executor.mjs`；
- `doc/review/platform/2026-08-06-v2s-catalog-inventory-p4-scope-registry-claude.md`。

## 1. 分母与边界

| 分母 | 当前事实 | P4 判定要求 |
|---|---:|---|
| API scenarios / cases | 26 / 100 | 100 条各有一条 case-level `polarity`；业务边界集合恰为 38/62；另有独立 `expectationKind` 集合，当前 typed failure 13、fact/readback 87 |
| operation assertion matrix | 42 | 每个 operation 的 condition key 与 problem code 仍由 assertion matrix 唯一声明；case 只能引用，不能复制错误码文字 |
| seed datasets | 5 | `SEED-MATERIALS`、`SEED-LATTE`、`SEED-DINNER-SET`、`SEED-CAESAR`、`SEED-WEIGHED` 全部装载；不是把五个代表样本误当成 73 商品/34 资产的最终对齐分母 |
| test datasets | 39 | API 与 L2 各自在自己的受管运行中按 `fixtureRef` 构造；不得读取对方报告、共享对象 ID，且不得把测试异常数据写入 DEV seed 初始状态 |
| heritage parity | 73 source products / 34 assets | 73 条 v4 source 必须全部进入静态计划；运行时按已冻结的形态准入执行 72 条可创建商品，`BENEFIT_SHELL` 的 1 条 source 只做 `excludedSourceItems` 具名留痕（原因“权益域尚未开放”），不得伪造实例或放宽 create guard；34 张真实媒体仍全部经 multipart stage/readback |

P4 的运行边界仍遵守 P4 scope registry：HTTP-only owner command、真实 multipart 字节、readback、run-scoped cleanup；禁止直写数据库、SQL fallback、把静态 fixture PASS 当作 HTTP/L2 PASS。业务结果与 cleanup 结果分开记账，cleanup 非 PASS 不得收口。

## 2. 38 条否定 case 的绑定规则

### 2.1 为什么需要 case-level 字段

当前 `expected` 只有 `assertionKey`、`fixtureRef`、`parameter`；`conditionToProblem` 在 operation 层已有，但 case 没有指出自己走哪一个条件。仅检查“problem code 在闭集”会把错误的判定顺序、错误的错误码或漏报都判成绿。与此同时，业务边界负例不等于 HTTP 失败：例如停用 SKU 仍派生 `HAS_SKU=true`、`SERVICE/BENEFIT_SHELL` 的准入事实、无来源时返回 `copySourceAvailable=false` 都是成功读回，不能为了凑负例分母伪造 problem code。

P4 实施时给每个 case 增加结构化绑定（字段名可在 P4 详设时定，但语义不可变）：

```json
{
  "polarity": "NEGATIVE",
  "expectationKind": "TYPED_FAILURE",
  "conditionToProblemRef": {
    "operationId": "executeOperationsBrandCatalogCopy",
    "problemCode": "STALE_COPY_PREFLIGHT"
  }
}
```

`polarity` 是业务断言的边界极性，不等同于 HTTP 成功/失败；它必须逐 case 显式写出，不得从 fixture purpose 推断。`expectationKind` 只有 `TYPED_FAILURE` 与 `FACT` 两值：前者必须带 `conditionToProblemRef`，后者必须省略该字段并由 fixture 的结构化 expected/本 case parameter 说明要读回的事实。复制预检中的兼容阻断、形态准入、`HAS_SKU`、无来源等都是成功响应中的事实，必须标为 `FACT`，不得伪造异常引用。`conditionToProblemRef` 的外键为 `(operationId, problemCode)`；门必须在 `catalog-inventory-assertion-matrix.json` 中查到这个二元组，且同一 operation 的 `problemCode` 不重复。当前 assertion matrix 的真实键只有 `precedence/problemCode/conditions`，因此不得虚构 `conditionId`，也不得使用 precedence 下标、英文 conditions 散文或自由复制的错误码文本。`POSITIVE` case 与业务边界 `NEGATIVE` 但成功读回的 `FACT` case 都不得携带错误码引用。

### 2.2 否定集合的可复算构成

当前历史分母仍保留 38 条业务边界 case / 62 条普通 case，但它只是 `polarity` 的诊断集合，不再冒充 typed failure 分母。对当前字节按 case 级语义复算，`expectationKind=TYPED_FAILURE` 为 13 条、`FACT` 为 87 条；前者的 condition ref 才是错误条件分母。31 条旧 fixture-candidate、6 条结构阻断和 `CI-API-022` replay/owner-failure 分组继续保存，供迁移与审计使用，不能再直接生成错误码引用。负库存 fixture 作为额外 focused API proof 使用，不把 count/config 成功读回误标为负库存异常。

31 条 fixture predicate 的当前 exact-set 是：

```json
["CI-API-006-01","CI-API-006-02","CI-API-006-03","CI-API-006-04","CI-API-006-05","CI-API-006-06","CI-API-006-07","CI-API-006-08","CI-API-006-09","CI-API-006-10","CI-API-012-01","CI-API-012-04","CI-API-013-01","CI-API-013-02","CI-API-013-03","CI-API-014-01","CI-API-014-03","CI-API-014-05","CI-API-019-01","CI-API-019-02","CI-API-020-01","CI-API-021-01","CI-API-021-02","CI-API-023-01","CI-API-024-01","CI-API-024-02","CI-API-024-03","CI-API-024-04","CI-API-025-01","CI-API-025-02","CI-API-025-03"]
```

其 predicate 是 `fixtureRef` 匹配 `^FIXTURE-(VOID-|INVENTORY-NEGATIVE$|ARCHIVED-ONLY-SKU$|DISABLED-SKU$|SHAPE-ADMISSION$|UNIT-GRAM-EACH$|REFERENCE-MAPPING-MISSING$|STALE-|MISSING-HEAD-COMPANY$|NO-COPY-SOURCE$|OWNER-SCOPE$)`；该 predicate 只用于复算和审查，不应在 runtime 中作为业务分类器。

待 Dexter 裁决前，表格只能写成：

| 子集 | 数量 | 选择规则 | 绑定要求 |
|---|---:|---|---|
| 历史 fixture 候选集 | 31 | 上述 exact-set | 仅作诊断分组；是否为 `FACT` 或 `TYPED_FAILURE` 由 case-level 结构化字段决定 |
| 兼容矩阵结构阻断 | 6 | `CI-API-018-*` 中 `parameter.outcome = STRUCTURAL_BLOCK` 的六条 | 逐条指向自己的结构条件，不允许共享一个泛化“复制失败”键 |
| replay / owner failure | 1 negative + 1 positive | `CI-API-022-01` 显式标记 `POSITIVE` + `FACT`（replaySameResult），`CI-API-022-02` 显式标记 `NEGATIVE` + `TYPED_FAILURE`（ownerFailureRollback） | 仅 `CI-API-022-02` 需要 condition ref；不得把 `OWNER_COMMAND_FAILED` 当作不存在的 problemCode |
| **业务边界合计** | **38 negative / 62 positive** | 由 case-level `polarity` exact-set 计算，不从 fixture regex 直接写入 | 仅 `expectationKind=TYPED_FAILURE` 的 13 条进入 condition-ref 分母 |
| **typed/fact 合计** | **13 typed failure / 87 fact** | 由 case-level `expectationKind` exact-set 计算 | typed failure 必须有合法 `(operationId, problemCode)`；fact 必须没有该字段 |

这里的 31 是“由 fixture 引用选择后再由生成器落出 caseId”的历史候选集，但最终 `polarity` 与 `expectationKind` 都必须由 API case 自身显式声明。不能给 fixture dataset 粗暴增加一个单值 polarity 作为唯一真相，因为多个 fixture 被正向与边界 case 共同引用。P4 生成器第一次运行必须打印并保存 `fixtureCandidateCaseIds`、`structuralBlockCaseIds`、`replayRollbackCaseIds`、`negativeCaseIds`、`positiveCaseIds`、`typedFailureCaseIds`、`factCaseIds` 七组集合；后一对 polarity 集 exact-set 为 38/62，typed/fact 集 exact-set 为 13/87。

### 2.3 机器门与反例

P4 门只做机械事实，不替代语义审查：

- 100 个 case 恰好各出现一次 `polarity`；
- `negativeCaseIds` 与 `positiveCaseIds` 的集合恰为 38/62；`typedFailureCaseIds` 与 `factCaseIds` 的集合恰为 13/87；`conditionToProblemRef` 的键集合必须恰等于 `typedFailureCaseIds`，不得要求所有业务边界负例都携带错误码；`CI-API-022-01` 必须是 POSITIVE + FACT，`CI-API-022-02` 必须是 NEGATIVE + TYPED_FAILURE；
- case-level `polarity`、`expectationKind` 与必要的 `conditionToProblemRef` 必须在 API scenario catalog 的 case 行上落地，fixture catalog 的 `purpose` 只保留人读说明，不参与极性或失败类型推断；
- 引用的 operation/condition 存在，且 operation 的 `problemCode` 在契约声明的闭集中；
- 禁止 case 内出现第二份自由字符串 `problemCode`；
- `expectedBusinessResult` 与结构化字段同时存在时，`polarity`、`expectationKind` 与 condition ref 是测试执行依据，fixture/ case 的结构化 fact expected 承载成功读回断言，散文仅作业务解释。

红变异至少包括：删一条 typed failure 绑定、把一个 negative 改 positive、把一个 `TYPED_FAILURE` 改成 `FACT` 但保留错误码、把一个成功事实伪造为 `TYPED_FAILURE`、把 `CI-API-022-02` 指向另一个 `problemCode`、把 `problemCode` 改成 assertion matrix 不存在的值、把 `(operationId, problemCode)` 偷换成数组下标；每种变异都必须使门失败。条件是否真的对应业务事实，留给独立 reviewer 与 API runtime proof。

## 3. Seed 装载器一页设计

### 3.1 传输与 owner 边界

1. 资产先经 `stageOperationsCatalogAsset` 的 multipart `content` 字段上传，必须使用真实文件字节；seed 只保存返回的 `assetRef`，不持久化 URL，也不把文件路径当业务事实。
2. 商品与库存只经各自 owner 的公开 command API 创建或配置；入口使用生成的 HTTP operation，不直写数据库、不写 migration、不使用 SQL fallback。
3. 每个代表 dataset 至少做三个 readback：商品详情、商品导航/字典事实、库存 targets；readback 失败立即停止，不进入下一个 dataset。
4. 所有请求带 run-scoped correlation、脱敏结构化日志和可回放的 fixtureId；日志不能记录 token、cookie、Authorization、raw payload 或原始图片字节。

### 3.2 五个 seed dataset 的依赖 DAG

执行顺序必须由 seed fixture 的 `entities.relations` 生成，再写入 loader manifest；不能由对象数组排列隐式推断，也不能在 manifest 中另写一套未校验的 DAG。当前已知依据是 `SEED-DINNER-SET.entities.relations` 中的 `DINNER-SET-001 → LATTE-001 / LATTE-SKU-M`。

```text
真实媒体 stage
      |
      v
SEED-MATERIALS
   /     |      \
  v      v       v
SEED-LATTE  SEED-CAESAR  SEED-WEIGHED
  |
  v
SEED-DINNER-SET
```

- `SEED-MATERIALS` 先于所有引用咖啡豆、物料或称重单位的商品；
- `SEED-LATTE`、`SEED-CAESAR`、`SEED-WEIGHED` 之间无业务依赖，可并行设计，但为了可诊断的 first failure，首版 loader 采用固定串行顺序；
- `SEED-DINNER-SET` 依赖 Latte 的 SKU/商品引用已完成并 readback 成功；
- 每个 dataset 的 `dependsOn`、owner scope、必需 assetRef 和 readback selector 必须落到 run manifest，缺项 fail closed。
- loader 在生成 manifest 时对所有 seed dataset 的 `relations` 做拓扑排序；关系指向不存在的 dataset/object、循环或无法归属的 `refKind/refCode` 直接 typed failure，不得靠手工补顺序继续执行。
- 如果为了可读性把生成后的 DAG 快照也提交到 manifest，必须有机器门断言快照与 `relations` 推导出的偏序完全一致；删除 `DINNER-SET-001 → LATTE-001` 的红变异必须使门失败。`relations` 是唯一真相，manifest 只是派生执行计划。

### 3.3 重跑与漂移

seed 不是“重复 POST 直到成功”：

1. 每个 dataset 先以稳定的 `seedRunId + fixtureId` 查询已有 reconciliation receipt；没有 receipt 才读取 owner 事实。
2. 已存在且 canonical digest 相同：标记 `REUSED`，执行必要 readback，不重复创建或上传。
3. 已存在但 digest 不同：返回 typed `SEED_EXISTING_OBJECT_DRIFT`，停止本次 seed；不得用 `DUPLICATE_CODE` 当作重跑成功，也不得覆盖人工数据。
4. 仅在 owner 明确支持、且请求幂等键相同的情况下允许重放 command；资产 stage、商品创建、关联更新都必须保留各自的 receipt。
5. 任何一个 dataset 失败即停止后续 dataset；不自动回退 SQL。cleanup 在独立阶段依据 run manifest 撤销本 run 创建的对象和媒体，失败要单独报告。

### 3.4 profile 选择

现有 `scripts/dev/seed` 只接受 `r5-full`，该 profile 是四域历史 seed 的固定 32 场景闭集，当前 executor 也不覆盖 catalog/inventory。P4 推荐新增能力命名的 `catalog-inventory` profile：

- 不修改 `r5-full` 的既有分母与行为；
- 复用受管 process identity、manifest、日志、HTTP allowlist、readback 与 cleanup primitives；
- 新 profile 自己声明五 dataset DAG、73 source / 72 creatable + 1 excluded / 34 media 的 parity、asset namespace、owner session、retry/stop policy；
- top-level dispatcher 只允许显式 `--profile catalog-inventory`，未声明 profile 或混用两个 profile 时 fail closed；
- runtime 文件、类名和目录使用能力名，不把 Journey/Scenario ID 作为代码组织名。

这只是 profile 设计建议。未取得 P4 执行授权前，不修改 `scripts/dev/seed`、profile、executor，不启动 DEV/远端数据库，不上传或清理媒体。

## 4. P4 交付顺序与退出判定

1. **准备包（静态）**：落 case-level bindings、seed loader manifest/依赖/幂等规则；机器门确认 100/38/62 exact-set 与 DAG 封闭。
2. **A：API 单独受管运行**：先执行 catalog/inventory owner 模块的后端单元/契约测试，再执行 100 条后台接口用例。HTTP 用例由 API runner 自己通过 owner HTTP fixture setup 准备数据，命令入口为 `scripts/test/r5-joint-remote-l2.mjs --catalog-api-only`，在自己的 fresh namespace 中独立产出业务/cleanup evidence；它不读取 seed 或 L2 report。
3. **F：L2 单独受管运行**：仅在 A 的单元与接口验收通过后执行 43 条前端可见性用例。L2 runner 自己准备浏览器所需事实，命令入口为 `scripts/test/r5-joint-remote-l2.mjs --catalog-l2-only`，在另一 fresh namespace 中独立产出业务/cleanup evidence；它不读取 API report 或 seed。L2 的 Playwright 只消费本次 L2 fixture sidecar 与 private env。
4. **DEV 体验 seed：独立交付**：`catalog-inventory` seed 只在最终 DEV reset→seed 运行中执行，服务人工体验与 readback；它不是 API 或 L2 的前置，也不参与两者的通过判定。
5. **最终收口**：分别确认 API、L2、DEV seed 的业务/cleanup 状态；任何一层失败都不得宣称其自身交付完成，P4 总体交付必须逐层如实报告，不能以 Seed 代替 API/L2，也不能以 API/L2 代替 Seed。

退出条件不是“请求不崩”：

- 100 cases 每条有明确 `polarity` 与 `expectationKind`；13 条 typed failure 各命中指定 condition，38/62 polarity exact-set；
- 5 seed datasets 全部有 owner readback，真实资产和 73/34 对齐；
- 两个复制上限从 policy 读取，边界成功、limit+1 typed failure，改值无需重写 fixture；
- API 与 L2 的业务状态、错误 envelope、readback、日志链路可回放；
- cleanup 独立 PASS，run-scoped 数据库 namespace 与媒体对象均无残留。

## 5. 当前结论与下一步授权

P3 round-3 静态复核已 GO，但 IA-INV-001 仍是 `PARTIAL_STATIC`：端到端缺口精确为 `materialRole` 未由 catalog list projection/coordinator 回填。该事实不阻塞本准备规格，但不应在 P4 runtime evidence 中被误写成完整列表事实。

本文件建议作为 P4 的验收判定输入；下一步应由 Dexter 单独授权 P4 准备包/实现包，先完成 case bindings 与 loader manifest 的静态门，再执行 A（后端单元/契约测试 → API HTTP 接口验收），A 全绿后执行 F（L2），最后单独执行 DEV reset→seed 体验交付。三者共享业务定义与契约 fixture 形状，但每次 acceptance run 都是独立 fresh namespace，不共享运行时对象、报告或通过条件。当前不执行任何 runtime、seed、reset、API、L2、数据库、迁移、部署或 cleanup。
