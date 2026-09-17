# 门店桌台与二维码管理 implementation-facing 设计评审处置

```text
DATE=2026-09-17
REVIEW_TARGET=DESIGN
REVIEW_SCOPE=implementation-facing 详设与实施计划
INPUT=Claude 经 Dexter 转交的静态 review 文本；仅作 finding 输入，不作事实正本或授权
ORIGINAL_VERDICT=NO-GO
ORIGINAL_M_S_N=4/3/3
DISPOSITION=REPAIRED_READY_FOR_NEXT_REVIEW
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NOT_AUTHORIZED
```

## 1. 处置边界

本记录不是新的独立 reviewer verdict。主 agent 重新打开需求正本、Journey、IA/交互、详设、实施计划、project-memory 命中原文和 owning source，对 Claude 的每条 finding 做事实核验、反例检查和最小修复；确认成立的设计问题已修入详设/实施计划，产品裁决没有被擅自改变。

Claude 建议删除 R-5.9 要求的 token 按开关键泛化，但需求正本 R-5.9 明文要求该机制补齐。因此本次只接受其“新 organization operation 不在当前 token/resolver 链”的事实，并把两条链的适用边界写死：新组织 owner 直接调用 keyed gate；上一批 52 条 gate 分母由既有 token gate=true 的 33 条和 sales-menu owner 直调的 19 条组成，其中 token 闭集共 36 条（另有 3 条 preflight=false），按键泛化只作用于 token 侧，sales-menu 保持 owner 直调并传递原 `catalogManagementEnabled` 语义。

## 2. Finding 逐条处置

| finding | 核验状态 | 当前字节事实与处置 | 最小修复与防再犯落点 |
| --- | --- | --- | --- |
| M-01 gate 落点与组织域不在 token 链 | `CONFIRMED_WITH_BOUNDARY_REPAIR` | `StoreOperatingRuleGate.java:11-16` 当前只有商品管理专用方法；`BusinessEntityService.java:1050-1077` 硬编码读取 `catalogManagementEnabled`；`catalog-inventory-workspace-command-tokens.mjs:46,94-96` 的 owner 集合不含 organization；`CommandExecutionContextResolver.java:129-135` 只消费既有 token。详设 §3、§7、§9 和计划 P1/P3 已改为：新增 `requireStoreOperatingRuleForStoreTarget(..., ruleKey)`；新 organization owner 使用 `tableManagementEnabled` 直接 gate；既有 `requireCatalogManagementForStoreTarget` 委托 `catalogManagementEnabled`；既有 36 条 token 中 33 条 gate=true 从 boolean 改为 key，3 条 preflight 保持 null；sales-menu 的 19 条写入口不在 token 链，直接调用 keyed gate；organization 不进入该 token 分母。 | 不在前端绕过、不在公共 resolver 中为 organization 加特例、不复制桌台 gate；详设 §7/§9a 与计划 P1/P3 的两条链边界及既有回归判据，防止再次把机制落点写到不存在的调用链。 |
| M-02 SERVICE_POINT 会被 seed host 校验挡住 | `CONFIRMED` | `scripts/dev/r5-seed-plan.mjs:34-39,64-72` 与 `scripts/dev/owner-command-seed-executor.mjs:39-43,85-124` 各自固定 host 集合/数量并要求 flat flag；当前基线是 8，新增后必须是 9。 | 详设 §9a、§10b.1/§10b.4 与计划 P1/P8 明确 fixture、两个 executor、两个 Java 声明同步为 9，flat 仍为 5，SERVICE_POINT 的 `listDisplay/searchable` 为 null；host-set/length 删除 SERVICE_POINT 或回退 8 的 red mutation 必须失败。 |
| M-03 fixture 正本与双级 gate 未落入 seed | `CONFIRMED` | `scripts/dev/r5-seed-plan.mjs:8` 读取 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`；`owner-command-seed-executor.mjs:166-168` 强制 `catalogManagementEnabled=true`；规则目录中的 `tableManagementEnabled` 是其子开关且默认 false。 | 详设 §9a/§10b.1 与计划 P1/P8 点名 fixture 正本，要求功能 fixture store 显式写入并 readback `catalogManagementEnabled=true`、`tableManagementEnabled=true`，不依赖默认值；seed 仍必须通过 owner command。 |
| M-04 QR config 写入早于渠道 stage | `CONFIRMED` | `scripts/dev/r5-complete-seed-executor.mjs:18,333-353` 固定四阶段及顺序，owner-command 在 external business-channel 之前运行；原详设把 QR config 放在 owner stage。 | 详设 §10b.1/§10b.3/§10b.4 与计划 P8 明确保留四阶段，不增加第五阶段；owner-command 先写区域/点但不写 enabled QR config，渠道阶段完成 channel readback 后在同一既有 stage 执行 organization owner QR config save post-step。 |
| S-01 URL rule 只改模板 PATCH | `CONFIRMED` | `business-channel.schemas.json:4-81,152-180` 的 create/update request 都是封闭对象，原文没有 `urlRule`；当前 schema 表态不完整。 | 详设 §5.2/§9a 与计划 P1/P2 明确两个 request 同时增加 nullable `urlRule`，create/update projection、owner、audit、readback 一起覆盖；目标四维可为空/合法，非目标维度必须为 null，避免创建后强制二次 PATCH。 |
| S-02 本域 gate 分母混入内部 claim | `CONFIRMED` | 详设 §5.4 的 `claimStoreServicePointImage` 没有 HTTP path，但原 §9.1 将其和 stage/release 一并写入 gate 分母，无法逐入口机械核验。 | 详设 §9.1、计划 §9.1 将本域 HTTP 分母冻结为 11：9 个 organization command + 2 个 asset stage/release；claim 仅作为 point owner REQUIRED 事务步骤，在成功/失败/孤儿资产 proof 中单独观察。 |
| S-03 缺 operation→scenario 逐条矩阵 | `CONFIRMED` | 原文只有能力场景和 V-1 至 V-16，不能逐个证明新增/修改 HTTP operation 已挂真实场景。 | 详设 §11.1 新增 20 行精确矩阵：organization 13、candidate 1、template create/update 2、platform extension 既有读写 2、asset stage/release 2；计划 P7 要求逐行重建并绑定已注册 scenario，内部 owner 方法不冒充 HTTP 行。 |
| N-01 catalog key 不一致 | `CONFIRMED` | 详设原 `PG-SERVICE-POINT-QR` 与计划 `PG-STORE-SERVICE-POINT-QR` 不一致。 | 详设 §9b 已统一为 `PG-STORE-SERVICE-POINT-QR`，并注明与既有门店页的域前缀 + STORE 形态一致。 |
| N-02 host 闭集没有同步断言 | `CONFIRMED` | `ExtensionHostTypes.java:15-17`、`ExtensionDefinitionService.java:35-44`、两个 seed executor 各有声明，管理 list 还具有顺序语义。 | 详设 §9a/§10b.4 与计划 P1/P8 增加跨声明 consistency proof：9 个 host 集合相等，管理顺序为既有顺序追加 SERVICE_POINT，flat 数为 5；分别制造缺项/回退 8 的 red mutation。 |
| N-03 区间记法无法机械证明后缀覆盖 | `REJECTED_WITH_EVIDENCE` | 详设 §8 当前已写明区间含两端及中间全部条目，并明确字母后缀按完整 ID 单独计入；本次对当前 mapping 做静态展开复算，结果为 `requirementCount=67`、`mappedCount=67`、`missing=[]`、`extra=[]`。因此当前问题不成立，不新增重复清单或改变 67 的分母。 | 保留详设 §8 的闭区间/后缀规则和现有映射；P0/P9 继续以展开后的全集核对，不把作者说明或抽样当作覆盖证据。 |

## 3. 交叉一致性复核

- R-5.9 与 M-01 已统一：token generic 化仍是需求要求；它只适用于既有 36 条 command token（33 条 gate=true、3 条 preflight=false），上一批 52 条 gate 分母中的另外 19 条 sales-menu 写入口直接调用 keyed gate；新组织 owner 的 11 个 HTTP gate entry 也直接调用 keyed gate。
- 模板 URL rule 已统一为 create/update 两个 request；D-10 的候选不预过滤与生成层 invalid result 边界未改变。
- host 基线已统一为当前 8、实施后 9；flat 基线仍为 5，SERVICE_POINT 不进入 flat host。
- seed 阶段仍为 `owner-command → external-collaboration-business-channel → catalog-inventory → sales-menu`；QR enabled config 只在第二阶段 channel readback 后的 post-step 写入。
- HTTP operation 分母为 20；本域 gate HTTP 分母为 11；两者不是同一分母，内部 owner 方法不计 HTTP 行。

## 4. 动态与授权状态

本轮只做静态源码/文档核查和文档修订。未执行契约生成、构建、测试、迁移、reset、DEV、seed、UAT、Browser L2 或部署；不把静态核验升级为运行证据。`IMPLEMENTATION_AUTHORITY=false` 保持不变，下一步仅请求对新字节进行静态 DESIGN review。
