# 20 倍底座 · 变更点总账

> 规则见 `00-总纲-claude.md`。**状态**:`未开始` · `进行中` · `已完成` · `已停止-待裁决`
> 每次改状态,同时填「证据产物」与「后读结论」。⛔ 只改状态不填证据 = 该行无效。

---

## 0. 执行顺序

```text
02(D-6,原子组 a→b→c)   ← 与 01 无依赖,可并行,但组内必须按序
01(P-2)                  ← CP-P2-01 迁移先行
03(六项盘点)             ← 产物是后两批的输入,可与 01/02 并行
```

**跨册依赖**:无。三册互不阻塞。

---

## 1. 01 · P-2(7 CP)

| ID | 一句话 | 状态 | 证据产物 | 后读结论 |
|---|---|---|---|---|
| CP-P2-01 | **extension 修 catch + 收尾补行数校验**(今天每次重放都 500,最痛) | 未开始 | | |
| CP-P2-02 | `PlatformAssetService` 同根扫描:先确认事务上下文再定修不修 | 未开始 | | **结论必填** |
| CP-P2-03 | 三个 `replay()` 首行加 advisory lock + 去掉无效的 `FOR UPDATE` | 未开始 | | |
| CP-P2-04 | 三处 `saveReceipt` 不再吞冲突 + 检查受影响行数 | 未开始 | | |
| CP-P2-06 | 三个并发测试类(含测试台事务边界 + 隔离级别前置断言) | 未开始 | | |
| CP-P2-05 | C4 外层 `lockBatchStatusReceipt` 退役 | 未开始 | | |
| CP-P2-07 | 三个 receipt service 的 advisory key 加模块前缀 | 未开始 | | |

**执行顺序**:`01 + 02`(缺陷 A)→ `03` → `04` → `06` → `05`;`07` 与主线无依赖。

⚠️ **无迁移、无新列、无新错误码、无返回契约变更** —— 第四版的 insert-as-claim 方案已废,理由见 01 §7。

⚠️ `CP-P2-02` 的「后读结论」必须写明 `PlatformAssetService` 到底在不在事务内。
只修 extension 而不给本条结论,就是 `AGENTS.md` 第 58 行禁止的单点修补。

---

## 2. 02 · D-6(1 CP)

| ID | 一句话 | 状态 | 证据产物 | 后读结论 |
|---|---|---|---|---|
| CP-D6 | 三个迁移文件按**逐字锚点**删 legacy audit 语句,一次删完一次回放 | 未开始 | | |

⚠️ **原子组已废弃**。第二版声明的中间态预期报错是**错的**(V26 的 policy 计数守卫排在 V27 之前,
首个报错是 `R5_R3_POLICY_PRECONDITION_FAILED: expected 4 policies, got 3`),
而且它自己规定「组内不跑回放」⇒ 那个红在自己的流程下**永不可观察**。
⇒ 三个文件一次改完,只跑一次回放。

⚠️ **定位一律用逐字锚点,不用行号。** 第二版在一个 CP 内先删一行再按原始行号寻址,
全文上移后会删掉**活表** `commercial_group_idempotency` 的 teardown。

---

## 3. 03 · 盘点(6 CP)

| ID | 产物 | 状态 | 交叉校验结果 | 后读结论 |
|---|---|---|---|---|
| CP-INV-1 | `INVENTORY-E2-claude.md` | 未开始 | | |
| CP-INV-2 | `INVENTORY-X-claude.md` | 未开始 | | |
| CP-INV-3 | `INVENTORY-D3-claude.md` | 未开始 | | |
| CP-INV-4 | `INVENTORY-P7-claude.md` | 未开始 | | |
| CP-INV-5 | `INVENTORY-P4-claude.md` | 未开始 | | **DomainControlKind 占比必填** |
| CP-INV-6 | `INVENTORY-TESTID-claude.md` | 未开始 | | **口径声明必填** |

⚠️ 每条的「交叉校验结果」不得填「表已产出」—— 那是存在性判据。必须填 03 各条 `PROOF` 定义的那条独立校验的实际结果。

---

## 4. 需求 28 条覆盖对账(唯一的对账)

| 需求 | 归属 |
|---|---|
| **P-2** | `01`(CP-P2-01…08) |
| **D-6** | `02`(CP-D6-a/b/c) |
| **E-2** · **X 组** · **D-3** · **P-7** · **P-4** · **S-1(前端半)** | `03` 盘点后由 Dexter 切批 |
| **P-3** | **待盘点后决定** —— 已裁定目标是 `CatalogOwnerService` 第 3157/3173/3189 行与 `InventoryOwnerService` 第 3737/3752/3767 行的三个魔数(非 `dictionary_kind` 字符串),但具体动作待 D-3 盘点一并定 |
| **P-5** | 待 `CP-INV-5` 量化后决定(阈值与红名单必须同给) |
| **P-8** · **S-2** · **E-1** · **E-5** · **O-5** · **E-3** · **O-1**…**O-6** · **D-4** · **D-5** · **S-1(后台半)** | **待盘点后切批** |
| **P-1** · **P-6** · **D-1** · **D-2** · **S-3** · **E-4** | **本轮明确不做** |

⛔ **三者之外即为条目静默消失。** 本表是防它的唯一机制。

### 已裁定(2026-08-17 · Dexter 授权 Claude 自裁,方向:坚实底座)

**裁决 1 · P-7 判据改为「15 → ≤ 10」,不是「< 10」**
亲验 `backend-performance-m1-command-execution-bindings.mjs` 第 53 行 `emitInventoryMutation` 已是参数化 emitter,
第 63、67 行只是三行委托 ⇒ 「引入参数化 emitter」是伪动作,真实残留手改是第 273 行的 `emitters` 注册。
**真实下限 10。** 需求正本 G1 判据二已同步更正,失败判据改为「≥ 12」。
⛔ 不得为凑 9 而把注册藏进别处。

**裁决 2 · markdown 链只断「解析 + 门控」四处,provenance 哈希不进范围;判据措辞同步改**
亲验结论:第 86 / 87 / 89 行的 `requirementsHash` / `iaHash` / `categoryRemediationDesignHash`
只写进生成物的 `sourceBindings`(第 415 / 416 / 449 / 513 / 1145 / 1428-1430 行),
**没有任何 checker 断言它们的 sha256**(第 477 行断的是 `designCoverage.path`,第 605 行断的是 `v4MediaDirectory`)。
⇒ 它们是**provenance 记录**,不是真相源。

| 处 | 性质 | 处置 |
|---|---|---|
| ① 第 97 行 解析设计 markdown 出 operation 行 | **解析派生声明** | **删** |
| ② 第 1359-1361 行 解析 IA markdown + 固定 89 | **解析派生声明** | **删** |
| ③ `design-byte-coverage.json` 第 8 行的 `designSha256`,由 `p1/cli.mjs` 第 476 行与 `p2/cli.mjs` 第 42-43 行**断言** | **门控**(内容漂移即红) | **删** |
| ④ `p1/cli.mjs` 第 671-673 行 解析 IA markdown + 固定 89 | **解析派生声明** | **删** |
| 第 86 / 87 / 89 行 | **provenance 记录,无门断言** | **不动** |
| `build.gradle.kts` 第 16-21 行 `inputs.files` | **构建增量提示,无门断言** | **不动** |

**判据措辞同步改**:从「改任一 markdown,生成物逐字节不变」
改为 —— **「operation / IA 声明不来自 markdown 解析,且无任何门因 markdown 内容漂移而红」**。
⛔ 原措辞在保留 provenance 哈希的前提下永远不成立,**改代码去迁就一句写错的判据才是本末倒置**。

**裁决 3 · `DomainControlKind` 按 `CP-INV-5` 的规则自动落定**
不变。占比过半 ⇒ 拉回范围;不过半 ⇒ 需求正本病因判断有误,如实改判并说明 5174 行的真实成因。

**裁决 4 · D-3 的门缺陷本轮不单修,归入 D-3 批次**
`tools/verify-gates/cli.mjs` 第 569 行硬编码 7 个 schema,不含 catalog / inventory / fulfillment_production。
补上三个 schema 后该门会立刻变红,**而那些红正是 D-3 要做的工作本身**。
⇒ 先修门再做 D-3 = 制造一批无人处理的红;先做 D-3 再修门 = 门无法验证过程。
**正解:把「补齐三个 schema」写成 `CP-INV-3` 的必出项**,与关系族守卫表一起交付,由 Dexter 据实切批时一并排。

**裁决 5(2026-08-17 · 已撤回)· `O-5` 回 HANDOFF,本轮不做**

⚠️ **原裁决「手写 5 行健康端点」撤回。** `HANDOFF.md` 的 `HEALTH_READINESS` 已有裁决:
**「受管启动复用 walking-skeleton 入口断言,不建第二端点」**,理由「防止漂移探针」,
激活条件是 `ORCHESTRATOR_REQUIRES_PROBES` —— 当前无编排器,条件不成立。
⇒ 这不是「用哪个依赖」的技术选型,是一个**已有的产品裁决**。本轮不做,O-5 归 HANDOFF。

<details><summary>原裁决内容(留档)</summary>
`/actuator/health` 需要 `spring-boot-starter-actuator`,而全局禁止清单禁新增依赖。
⇒ **手写一个返回 `{"status":"UP"}` 的 `@GetMapping("/actuator/health")`**,不引 starter。
依据:`EdgeRouteRegistryCoverageTest.java` 第 31 行已把 `/actuator` 列入 `RUNTIME_ROUTE_PREFIX_ALLOWLIST`,
route registry 不会因此变红;`{"status":"UP"}` 是负载均衡器的事实契约。
⛔ **必须在代码注释与文档里写明这是手写端点,不是 Spring Actuator** —— 不得让人以为有 actuator 的全套能力。
⛔ 不得借机引入 micrometer / prometheus / opentelemetry(全仓当前 0 命中,属生产化项,进 HANDOFF)。

**附:需求正本一处事实更正** —— 原写「`actuator` 全仓命中 0」不准,
`EdgeRouteRegistryCoverageTest.java` 第 31 行已有 allowlist 条目。

</details>

---

## 5. 本轮不做(6 条)

`P-1`(推迟至租户键定案)· `P-6`(第 4 个 owner 才痛)· `D-1` · `D-2`(随 P-1)·
`S-3`(明确不契约化)· `E-4`(两条路都零效果,L2 暂缓期间无解)

**进 `HANDOFF.md`**:L2 执行 · 前端 sink 部署 URL · CI 平台 / 备份演练 / 密钥轮换 / 指标监控
