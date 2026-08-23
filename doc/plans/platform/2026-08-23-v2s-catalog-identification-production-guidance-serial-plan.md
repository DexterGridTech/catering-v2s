# 商品条码与标识、制作信息优化串行实施计划

> `PARTIALLY_SUPERSEDED_BY`：`doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-serial-plan-codex.md`。
> 后续生产标签收敛只按新计划执行；不得从本历史计划恢复商品/SKU/选项多值标签。

<a id="catalog-identification-production-guidance-serial-plan"></a>

状态：`ACTIVE_IMPLEMENTATION_AUTHORIZED`

实施工单：`doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-implementation-design-codex.md`

执行纪律唯一正本：`doc/platform/implementation-task-template.md`。每个 CP 写前与 focused proof 后均按该 CP 的 RECALL 逐点双读；上游数字、finding 和建议形态都是待验证输入。Dexter 已授权本批 CP-00 至 CP-12 实施（共 13 个 CP）；真实 migration 执行、DEV start/restart、reset、seed、browser L2、UAT、部署和数据操作仍需单独授权。

## 1 · 目标与完成定义

在一次完整实施批次内，把商品与具体规格的识别码、商品默认制作信息、规格完整覆盖和点单选项制作变化落实为 contract、owner、持久化、operations-admin、acceptance 与 seed 同一模型，并删除旧自由三元组、`skuBarcode`、generic profile、错误 owner 字段与所有 fallback。

完成必须同时满足：

1. 用户界面只出现已批准的业务语言，IA 禁止技术词在可见 DOM/aria/placeholder/error 中零命中；
2. contract 声明结构/枚举/范围/capability/problem/locator，UI 声明 copy/layout/draft/accessibility，owner 事务内复核，三层不互相替代；
3. P1→tokens→M1→P3 全生成链、静态门、模块编译/测试与受权后的 managed Testcontainers business+cleanup 均 PASS；
4. backend acceptance 仍 `discovered=selected=results=80`，不新增 provider/registry；
5. seed 只改唯一生成源与 executor，generated fixture 不手改；
6. browser L2/UAT 若未授权，明确留在未验证清单，不能由 focused test 冒充。

## 2 · 串行顺序

### CP-00 · 恢复与分母预检

RECALL：AGENTS/Blueprint/授权 Roadmap、project memory 六维命中、正式需求、Journey、交互、IA、implementation design、backend/frontend coding standard、backend acceptance standard、scripts README。

动作：

1. 现跑 generator operation/field exact-set、全仓 acceptance annotation、test-health denominator、最新 migration 文件名与设计 §9b 16 个锚点；
2. 记录旧字段全仓命中：`identifiers kind/code/value`、`skuBarcode`、`productionProfiles`、`stationTags`、`printTags`、`allergens`、opaque `materialRole` promotion；
3. 形成 migration 激活前只读 preflight SQL 与安全报告 schema；nested/top-level `materialRole` 等值折叠、冲突停止必须各有 red case。没有数据读取授权时只验证 SQL 结构，不声称真实 DEV 分布；
4. 保存 first failure、last known good、broken boundary，不修改生产代码。

出口：当前树与设计数字相符；否则按 §13 单条停机，不改设计数字来迎合代码。

### CP-01 · 生成源契约与 red self-test

RECALL：详设 CP-01、正式需求 §3–5、IA §3/§4、P1 generator 三个 schema patch anchor。

动作：

1. 在 `scripts/generate/catalog-inventory-p1.mjs` 单一声明 identifier rules、42 格准入、preparation 三层 schema、effective source 与 new problem/locator；识别值 1..160 且拒绝控制字符，BARCODE/PLU 大小写敏感、MNEMONIC 比较不区分大小写；制作单显示名称最多 120 个字符、两类说明分别最多 1000 个字符、时长为无业务上限的非负整数；本批明确不加入 resolve operation；
2. 机器约束不含用户中文 copy；删除 affected field descriptor 的 label/helpText 消费，用户 copy 留 operations-admin；
3. self-test 增加真实 red mutation：放开 service BARCODE、允许 option remove、恢复 additionalProperties、漏删 skuBarcode、预算 null 等均应红；
4. 任何 operation 都不得使用 null、`CALIBRATION_PENDING`、无限或默认预算；operation exact-set 保持 238，不生成零消费者 route 或预算。

出口：P1 self-test 的 red/green 均可复现，旧字段在生成 schema exact-set 为零。

### CP-02 · 生成链闭合

RECALL：详设 CP-02、P1/token/M1/P3 generator README/self-test、backend performance budget validator。

固定顺序：

1. `catalog-inventory-p1.mjs --write --check`；
2. `catalog-inventory-workspace-command-tokens.mjs --write --check`；
3. `backend-performance-m1-command-execution-bindings.mjs --emit --check`；
4. `catalog-inventory-p3-frontend.mjs` 与 `--self-test`；
5. HTTP resolve 已裁定延期，exact-set 必须保持 238；任何 239 或新 resolution operation 都是范围漂移并停机。

出口：四段同一轮全部 PASS，generated OpenAPI/Java/TS/fixture 与源一致。首败先根因修复，禁止手改 generated。

### CP-03 · Migration 与 catalog 子事实

RECALL：详设 §10、正式需求 §7、最新 catalog migrations、CatalogItemReferenceFacts。

动作：

1. 新增唯一未占用 migration；先写 fail-closed preflight，再建 `product_identifier`，并在 `catalog_item`、`catalog_sku`、当前 `catalog_item_order_option_value_override` 三个有效 parent 上增加闭合 JSONB、FK/check/unique/index；不得引用或复活已退役 `catalog_order_option_value`；
2. 合法 item/SKU identifier 与 item preparation 做确定性迁移；不确定字段整条 migration 回滚；
3. 新增 `CatalogIdentifierFacts`、`CatalogPreparationFacts`，不新建 profile aggregate/lifecycle；
4. 最后删除旧 column/JSON keys 与兼容读写路径。

出口：migration integration 的合法/unknown/duplicate/cross-item/non-target profile 五族全部可证伪。

### CP-04 · Catalog owner 写入、读回与未来查询边界

RECALL：详设 CP-04、CatalogOwnerApi、CatalogOwnerService save/read anchors、CatalogInventoryCoordinator canonicalSaveRequest。

动作：

1. 扩展 owner API typed record 与唯一 consumer；
2. whole-save 在 CAS 事务内重新派生 shape/grain/target，replace identifiers/preparation/reference rows；
3. BARCODE/PLU 以 trim 后原值生成 normalizedValue；MNEMONIC 以大小写不敏感比较值生成且保留展示原值；三类拒绝控制字符；不接受请求提交 owner/source/normalized；
4. 复核制作单显示名称 120、制作说明/追加说明 1000 字符上限；时长只校验非负整数且不自加 86400 上限；计算 item/SKU effective profile 和 option contribution 顺序；
5. 删除 opaque materialRole promotion 与 generic map null 特判；
6. 只保留唯一索引与未来 task read 的 SQL/owner 边界设计，不创建零调用者生产方法；未来销售 Journey 必须重新声明 dataNode+brand 上下文。

出口：owner integration 覆盖正式需求 R-01..R-24；失败时所有事实和 version 不变。

### CP-05 · Production tag 候选与绑定

RECALL：详设 CP-05、ProductionTagOwnerApi/Service、现有 cursor acceptance、IA 三处候选规则。

动作：

1. 给现有 `getOperationsProductionTags` 增加 `usage=MANAGEMENT|BINDABLE_CANDIDATE` 与 query；管理 consumer 省略 usage，三处候选 consumer 即使空 query 也显式传 `BINDABLE_CANDIDATE`；cursor identity 含 scope+brand+usage+normalizedQuery+pageSize，rows/total 复用同一 predicate；
2. 复用批量 `readTagReferencesByRefs`，一次复核三类 target 的 refs；
3. 区分 existing disabled 与 newly bound disabled；
4. 删除商品页快速创建，不新增 candidate endpoint。

出口：管理全集含 disabled；候选空/非空 query 只含 enabled；21 行两页、跨 usage/query stale cursor、既有停用 readback、新绑定停用拒绝全部通过；无 N+1。

### CP-06 · Frontend wire 与模型

RECALL：详设 CP-06–08、IA 七 screen、catalogModel、generated RTK、前端规范 §3。

动作：

1. 只消费 generated TS/RTK；typed decode/encode identifier/profile/effect/effective source；
2. app-local `catalogBusinessCopy` 与 `catalogIdentificationPreparationFeedback` exhaustive map；
3. 父 Drawer 拥有唯一 draft，两个 Modal 只编辑副本；
4. scope/generation/shape/target 变化清理不再成立的下游草稿。

出口：model/focused tests 证明旧字段不能进入 request，raw code/detail 不可见。

### CP-07 · 条码与标识界面

RECALL：IA-CIPG-01..04、交互文案、accepted SVG、admin-ui-foundation overlay/Drawer primitives。

动作：

1. 普通/称重/物料/套餐/服务商品按业务类型显示行内识别编辑；权益隐藏；
2. SKU shape 只显示规格摘要与规格 Modal，不出现父商品码入口；
3. Modal 确定回写父 draft、不发 HTTP；
4. business copy、keyboard、focus、empty/loading/error/testId 与 IA 逐字一致。

出口：focused tests 覆盖 shape 分支、草稿、错误定位、关闭清理、可达性与技术词 forbidden-set。

### CP-08 · 制作信息界面

RECALL：IA-CIPG-05..07、交互稿、正式需求 §4、production tag cursor behavior。

动作：

1. 商品默认四字段；SKU 显示“使用商品默认/单独设置”并用完整覆盖 Modal；
2. option value 只提供“增加标签/增加时长/追加说明”；
3. 制作单显示名称显示“最多 120 个字符”，制作说明和追加说明显示“最多 1000 个字符”；时长输入只限制零或正整数，不设置客户端最大值；
4. 移除快速创建、自由字符串、打印/过敏原/materialRole；
5. 候选连续加载、disabled 历史回显、失败保留草稿；
6. narrow/scroll/focus/关闭清理按 IA。

出口：focused tests 覆盖三个布局分支、继承/覆盖/清除、add-only、query cursor、stale response、错误定位、精确失效、技术词零可见。

### CP-09 · 静态与 focused 证明

RECALL：详设 §3/§7/§14、node test-health runner 分母、backend/frontend coding standard。

动作：

1. 更新已有 generator/static/architecture tests，不删断言语义；
2. 新增 owner integration 与专题 component tests；
3. 运行 node test-health 总门、模块 compile/test 与 generator check；
4. 文档声称的全仓/唯一/零/只有均重跑计数。

出口：所有门按退出码 PASS；当前红门若重复，第二次前调用 cs-systematic-debugging 做根因链路。

### CP-10 · Backend acceptance

RECALL：backend acceptance 业务场景标准、详设 §11、managed runtime lifecycle rule。

动作：

1. 在详设点名的既有 annotation 内增加同 operation、同业务 oracle 的 subcase，不增加总 annotation：item identifier/default preparation、42 格 save 准入和 whole-save 原子性均放入 operation 为 `saveOperationsCatalogItem` 的 `catalog.inventory-rule-admission-matrix`；production-tag 管理/候选分页放入 cursor 场景；manifest、create、asset 场景不再承载跨 operation oracle；
2. 每个 subcase 走真实 HTTP/DB，断言业务字段、target、effective source/order 与失败后 version/事实不变；
3. 保持 full run `discovered=selected=results=80`；operation verifier 分母固定为 238；
4. 若测试前 DEV 存在且 manifest identity 匹配，按 AGENTS 联动规则受管 stop；只有 business+cleanup 双 PASS 才受管 restart，原先无 DEV 不启动。

出口：business PASS、cleanup PASS、firstFailure=None；不得 reset/seed。

### CP-11 · Seed 源与 executor

RECALL：详设 §10b、P1 `catalogDefinitionSeed`、seed executor、definition seed static test。

动作：

1. 只改 P1 唯一源与 executor；
2. 增加详设新功能覆盖清单，修正 production tag 错误语义；
3. executor 通过 generated HTTP whole-save，item/SKU/option 三族严格 readback；
4. 生成可读且脱敏的 seed report。

出口：static self-test 能把每个缺行、错 target/source/order、营销标签误路由变红。实际 reset/seed 仍需另授权。

### CP-12 · 最终静态/动态收口与独立 review

RECALL：详设 §14、cs-review、独立对抗审查治理、verification governance。

动作：

1. 重跑 P1→tokens→M1→P3、node gate、module compile/test；
2. 若有 Testcontainers 授权，跑 final full 80/80 与固定 238-operation budget，并检查日志和 cleanup；
3. 若另有 reset/start/seed/browser/UAT 授权，分别走受管入口并独立报告；未授权项留 L3 未验证清单；
4. 发起 fresh `REVIEW_TARGET=IMPLEMENTATION` 独立对抗审查，最多两轮，作者做 dialectical intake。

出口：implementation review verdict、first failure、last known good、broken boundary、business、cleanup、预算调高差集、seed 与 UI 未验证清单齐全。

## 3 · FORBID 总表

1. 不手改 generated OpenAPI/Java/TS/fixture；
2. 不保留 legacy 字段、dual-read、dual-write、fallback、compatibility view；
3. 不把用户中文 copy、Drawer/Modal/Tab、testId 或布局塞进 HTTP contract；
4. 不在 UI 复制 shape/owner/唯一/权限/版本规则并把隐藏当防线；
5. 不显示 IA §3.3 技术词、raw problem code/path/detail/exception；
6. 不新增 identifier/profile 独立状态、保存 API、生命周期或任意识别码转换引擎；
7. 不改商品标签、SKU销售属性、点单选择、库存/BOM、单位、菜单、销售入口、打印和过敏原 owner；
8. 不突破 80 acceptance 上限，不新增 provider/registry；
9. 不用静态/focused/Testcontainers 冒充 browser L2/UAT；
10. 不执行未单独授权的 DEV/reset/seed/browser/UAT/deploy/data 动作。

## 4 · 阶段报告与最终交付

持续实施按 AGENTS 六行格式报告。每次报告必须给 first failure、last known good、broken boundary、business 与 cleanup；动态运行每 30 秒，非动态/agent 等待每 60 秒。

最终交付至少包含：

- 变更文件与自行选择的实现形态理由；
- P1→tokens→M1→P3 与 node gate 真实退出码；
- module compile/test、80/80 acceptance 与固定 238-operation manifest（仅在获授权并执行后）；
- identifier 42 格与 preparation shape×target 反例结果；
- 15 个问题业务文案与禁止技术词 focused proof；
- migration preflight/回填/退休 exact-set；
- seed 可读报告或“未授权未执行”；
- business/cleanup 分离结果；
- browser L2/UAT 与其他 L3 未验证清单；
- fresh implementation review 的 `GO/NO-GO` 与 `M/S/N`、作者 intake。
