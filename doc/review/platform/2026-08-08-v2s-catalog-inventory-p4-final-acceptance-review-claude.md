# P4 最终实施与受管验收独立评审（Claude）

会话出处：fresh v2s-rooted 评审会话。本轮为 implementation/runtime **evidence** review，
未启动任何 reset、seed、数据库/migration、UAT、部署动作；
唯一的执行是只读的静态门 fresh 复跑（`tools/catalog-inventory-p4/cli.mjs --self-test`）。

历史全部保留：两轮 independent-subagent 对抗复核、我的六份 P3 review、
P4 范围登记、P4 验收判定规格两轮评审、P4 执行链路诊断。

---

## 0. 结论

**GO — M=0 / S=1 / N=2**

我上一轮诊断的三条（M-01 L2 仍跑 API、M-02 四处 `ON CONFLICT`、S-01 无 fail-fast）
**逐条亲验确认闭合**，且是行为修复。七个核验点全部通过，
关键数字我一律打开产物独立重算，未采信 evidence 自报。

唯一的 S 是**冻结契约未跟上已被裁决的行为变更**（seed cleanup 语义），
行为正确且已声明，但契约留在旧口径上，存在被后人"修回去"的风险。

---

## 1. 七个核验点

### ① API-only 与 L2-only 真正独立 —— **通过**

`scripts/test/r5-joint-remote-l2-fixture.mjs` 第 463 行已改为
`if (catalogStage !== 'L2') { … }`，包住第 465 行的 `CATALOG_INVENTORY_API`；
第 508 行 `if (catalogStage === 'L2')` 收尾。**我上轮 M-01 指出的"L2 仍跑满 100 条 API"已闭合。**

两层是**两次独立运行**，runId 不同（API `…60959-f538d843`、L2 `…78393-092a363f`），
各自 `businessStatus=PASS` 与 `cleanupStatus=PASS`；
`l2Only.apiRuntimeDependency=false`、`seedRuntimeDependency=false`，
`apiOnly.l2RuntimeDependency=false`、`seedRuntimeDependency=false`——
这次这些字段与源码事实一致（上轮该字段是与事实相反的）。

### ② 43 个 L2 case 的 START/终态日志 —— **通过，独立重算**

我打开 `catalog-inventory-l2-progress.log` 自行统计：
**总行 86 = START 43 + PASS 43，FAIL 0，去重 caseId 43**，
末行 `completed=43/43 current=CI-L2-018-01 status=PASS`。
每个 case 恰好一条 START 加一条终态，无缺漏无重复。
静态门侧另有 `P4_RED_MUTATION=L2_PROGRESS_REPORTING` 机械保障该不变量。

### ③ 四类红变异能否拒绝错误行为 —— **通过**

fresh 复跑 `node tools/catalog-inventory-p4/cli.mjs --self-test`，
**13 个红变异全部触发**，exit=0，`CATALOG_INVENTORY_P4_PRE_L2_SELF_TEST=PASS`。
提问点名的四类逐一对应：
native input → `NATIVE_CONTROL_LOCATOR`；
错误恢复 → `L2_ERROR_SCENARIO_TRIGGER`；
复制来源 → `BRAND_COPY_FIXTURE_SOURCE`；
品牌范围 → `BRAND_COPY_JOINT_SCOPE_ENV`。
另有 `API_CONDITION_REF`（对应我在验收判定规格评审中要求的 `(operationId, problemCode)` 外键）、
`CONTROL_EXACT_SET`、`CONTROL_STATUS`、`SESSION_WIRE_FIELD` 等。

### ④ BOM option-value 幂等键避免 stage collision —— **通过（一处窄残留见 N-01）**

`scripts/dev/catalog-inventory-seed-executor.mjs`：
第 220 行 `bomStageKey = ({optionValueCode, skuCode}) => optionValueCode || skuCode || "ITEM"`；
第 517 行分组键为三段复合 `${ownerCode}|${skuCode||"ITEM"}|${optionValueCode||""}`；
第 533–534 行 stage 标识为 `${scopeType}-canonical-bom-${item.code}-${stageKey}`；
第 694–696 行有对应红变异。第 531–532 行的注释准确说明了旧缺陷
（"several legitimate groups collapse to the same key and the second write is rejected as a replay mismatch"）。
**分组已完全消歧，旧 collision 已消除。**

### ⑤ 真实 multipart、73/72/1、34 图与回读 —— **通过，独立重算**

- **真实字节**：执行器第 302–303 行 `fs.readFileSync(file)` 读取
  `profile.mediaDirectory` 下的实际文件，构造 `FormData` 并以
  `new Blob([content], {type: asset.mediaType})` 作为 `content` 字段发送，
  同时携带 `contentDigest`。**是真实字节的 multipart，不是占位或 base64。**
- **34 张图**：我从 seed report 的 468 条 stage 中按 operationId 自行计数，
  `stageOperationsCatalogAsset` **恰为 34 次**。
- **73/72/1**：`sourceCatalogItems=73`、`createdCatalogItems=72`、`excludedCatalogItems=1`。
  被排除的一条在 report 中有完整可追溯记录：
  `{catalogItemCode: "BENEFIT-MEMBER-VOUCHER-001", shapeKey: "BENEFIT_SHELL",
  sourceFile: "store-combos-services.json", reason: "权益域尚未开放"}`。
  **这与 Dexter 的 C-16 裁定完全一致**（权益商品壳可见但禁用、原因"权益域尚未开放"），
  属有据排除而非静默缩减——契约 `reductionIsNotFinalSeedPolicy: true` 的警戒点在此被正确处理。
- **回读**：`getOperationsCatalogItem` 105 次、`saveOperationsCatalogItem` 187 次、
  `createOperationsCatalogItem` 96 次、`createOperationsCatalogCategory` 24 次、
  `createOperationsProductionTag` 8 次；HTTP 状态分布为 **459 次全部 200**，无非 2xx。

### ⑥ `PASS_PRESERVED_DEV_STATE` 与 reset 职责 —— **语义自洽，但契约未跟上（见 S-01）**

evidence 的 `cleanupPolicy` 明写
「DEV facts remain for experience; r5-reset owns destructive database/media cleanup」，
seed report 的 `SEED_CLEANUP` 阶段亦记 `policy: PRESERVE_DEV_EXPERIENCE_*`。
职责划分是对的：DEV 体验 seed 的价值就在于数据留存，销毁由 `r5-reset` 拥有；
本轮 reset 确有独立 runId 且 `status=PASS`，managedRun 的 `freshDatabase=true`。
**与 Dexter「catalog-inventory seed 只服务最终 DEV 体验，不是 API/L2 前置」的裁决一致。**

### ⑦ 三层 business/cleanup 分账 —— **通过**

apiOnly、l2Only 各自独立 runId 且 business 与 cleanup 分别记 PASS；
devExperience 下 reset、r5FullSeed（cleanup `PASS_NO_PERSISTENT_SEED_PROCESS`）、
catalogInventorySeed（cleanup `PASS_PRESERVED_DEV_STATE`）三者分列。
`boundaries` 显式声明五条：`apiAndL2DoNotUseDevSeed`、
`apiAndL2DoNotReadEachOthersRuntimeReports`、`noUatOrProductionClaim`、
`persistentDevDataIntended`、`cleanupStatusIsSeparateFromBusinessStatus`，均为 true。
**没有把 business 与 cleanup 混记，也没有把 DEV 体验冒充 UAT 或生产。**

---

## 2. Findings

### S-01｜冻结契约的 seed cleanup 口径未跟上已被裁决的行为变更

- **路径**：`contracts/policy/catalog-inventory-fixture-catalog.json` 的
  `seedExecutionPlan.cleanup`，当前仍为
  `{strategy: "MANAGED_RESET_RUN_SCOPED_REVERT", mediaPurgeRequired: true,
  mediaNamespace: "run-scoped", readback: "asset namespace absence", businessAndCleanupSeparate: true}`。
- **证据类型**：仓内事实（契约当前字节）对比 runtime evidence
  （`cleanup: "PASS_PRESERVED_DEV_STATE"`、`cleanupPolicy: "DEV facts remain for experience…"`）。
- **影响范围**：**行为是对的，契约是旧的。** 契约要求"运行域回滚 + 媒体必须清除 +
  回读资产命名空间为空"，而实际（且正确）行为是保留 DEV 数据、由 `r5-reset` 负责销毁。
  差异只声明在 evidence 里，契约本身没有更新。风险有二：
  一是日后若有人按契约建门，会把正确行为判成违规；
  二是更糟的情况——有人"照契约修"运行器去清除媒体，直接摧毁 DEV 体验数据。
  这与我们前几轮反复清理的"两份真相"是同一类问题。
- **最小修复**：把 `seedExecutionPlan.cleanup` 改写为两角色分工的口径——
  seed 负责 business 与非破坏性收尾并保留 DEV 事实，`r5-reset` 拥有破坏性数据库/媒体清理；
  保留 `businessAndCleanupSeparate: true`。不需要改代码。
- **是否需 Dexter 裁决**：否。这是把你已经做出的裁决写回契约，不是新决策。

### N-01｜`bomStageKey` 仍是扁平单值，同名 skuCode/optionValueCode 理论上仍会撞

- **路径**：`scripts/dev/catalog-inventory-seed-executor.mjs:220`
  `optionValueCode || skuCode || "ITEM"`，用于第 534 行的
  `${scopeType}-canonical-bom-${item.code}-${stageKey}`。
- **证据类型**：仓内事实。
- **影响范围**：**当前数据不可达**——实际 SKU 编码（如 `LATTE-SKU-M`）与选项值编码
  （如 `DRESSING-CLASSIC`）分属不同命名习惯，不会同名。分组键（第 517 行）已是三段复合、
  完全消歧，所以本轮 collision 确已消除。但 stage 键把两个维度压成一个值，
  是刚修掉的那个缺陷的窄残留；一旦将来某商品的 SKU 码与选项值码字面相同即复发。
- **最小修复**：把第 220 行改成与第 517 行同构的复合式
  （如 `${skuCode || "ITEM"}|${optionValueCode || ""}`），一行改动，
  并让第 694–696 行的红变异覆盖"同名 sku/optionValue"这一形态。
- **是否需 Dexter 裁决**：否。

### N-02｜`fullCatalogParity.requiredIn` 仍写 `"P2"`

- **路径**：`contracts/policy/catalog-inventory-fixture-catalog.json` 的
  `seedExecutionPlan.fullCatalogParity.requiredIn`。
- **证据类型**：仓内事实。
- **影响范围**：73/34 的全量对齐实际是在 P4 交付的（本轮 evidence 已证），
  契约仍标 `requiredIn: "P2"`。纯元数据陈旧，不影响任何行为或判定，
  但会让后续读者误判该义务的归属包。
- **最小修复**：改为 `"P4"`，或改成已交付的表述并附本轮 evidence 路径。
- **是否需 Dexter 裁决**：否。

---

## 3. 我上一轮诊断三条的闭合确认

- **M-02（四处 `ON CONFLICT`）**：全部改为与索引逐字一致的表达式推断——
  `stock_bom` ×3 为 `(data_node_ref, brand_ref, item_code, (COALESCE(sku_code,'')), (COALESCE(option_value_code,'')))`，
  `stock_target` ×1 为 `(…, (COALESCE(sku_code,'')))`；第 123 行的裸 `DO NOTHING` 保持不变（本就合法）。
  **API 100/100 全绿即是该修复的运行时证明。**
- **M-01（L2 仍跑 API）**：见 §1.①，已闭合，且 phase 字段与事实一致。
- **S-01（无 fail-fast）**：API 本轮 `failed=0`、`firstFailure=null`，
  未出现噪声放大；`implementationFixesClosedInThisRun` 亦记录了相应改造。
  **注意**：本轮全绿，所以 fail-fast 路径未被真实触发，
  其有效性属 `UNVERIFIED_REQUIRES_EVIDENCE`——下次出现真实失败时才能验证。
  这不构成 finding，只是如实标注背书边界。

## 4. 方案合理性

- **问题对不对**：对。P4 收的是 P2/P3 因无 runtime 授权而收不了的验收，加上 seed 实跑，
  没有虚构工作，也没有把静态 PASS 冒充业务 PASS。
- **方案优不优**：本轮几处取舍都对。
  两层完全独立运行（不同 runId、不同 namespace、各自 cleanup）比"一次跑完再拆报告"更可诊断；
  DEV seed 保留数据而把销毁交给 `r5-reset`，是正确的职责划分；
  排除唯一的 `BENEFIT_SHELL` 商品并留下四要素可追溯记录，
  比为了凑满 73 而制造一个权益域尚不支持的对象要诚实得多。
- **代价配不配**：配。上轮诊断的三条修复都是小改动，
  但把墙钟从十小时量级压回可迭代范围——`httpCalls: 459` 全 200、
  L2 43 条串行完成，说明链路已经稳定。

## 5. 授权边界

本评审仅覆盖 P4 implementation 与 runtime evidence 的独立核验。
**不授权**新的 reset、seed、数据库/migration、UAT、部署动作。
本轮 GO 基于：静态门 fresh 复跑、evidence 与其引用产物的独立重算、源码逐条亲验。
`noUatOrProductionClaim: true` 我确认属实——本轮**不构成任何 UAT 或生产就绪结论**。
S-01、N-01、N-02 均在既有批准边界内可自主处置，不需要 Dexter 裁决。
