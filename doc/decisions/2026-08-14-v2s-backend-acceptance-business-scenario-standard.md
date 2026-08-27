# Backend acceptance 真实业务场景扩展规范

- status: `ACTIVE`
- decisionOwner: Dexter
- effectiveDate: 2026-08-14
- machineId: `backend-acceptance`

本文是当前 backend-acceptance 的主动设计规范。它替代已经标记为 `SUPERSEDED` 的
2026-08-13 backend-acceptance 标准、实施详设与历史迁移口径；历史文档只保留为审计背景，
不得重新启用 provider、registry、package-exit、hash-chain 或旧四维模型。

## 1. 当前能力边界

`backend-acceptance` 是后台统一测试的唯一能力。它在真实远端 Testcontainers 中启动真实
业务应用，通过真实 HTTP 串行执行当前已实现的业务场景。当前场景覆盖 IAM、ORG、商业合同、asset
与 Catalog；Catalog 组已完成其全部真实场景验证并计入当前能力。后续按业务价值逐条扩展，
**场景总数不设上限**(Dexter 2026-08-27 裁定去除原 80 条上限)。

一次场景结果必须分开表达：

- `CONTRACT`：真实 HTTP 调用、状态码和通用响应/Problem 形状是否符合预期；
- `BUSINESS`：手写的、面向当前 operation 业务语义的真值断言是否通过；
- `DB_OPERATIONS`：生产 interceptor 统计的数据库调用数；在单条业务 scenario 内仍只作信息项，
  不参与 `CONTRACT`/`BUSINESS` verdict。Dexter 2026-08-22 另行恢复的是**独立 run-level operation
  budget verifier**：它消费同一 production interceptor 的 run-scoped completion events，对 generated
  operation registry 全集判 DB/connection/transaction-begin/section 预算；不得把该 verifier 塞回
  scenario 的 `performanceCriterion`，也不得改变业务 scenario 的真实 oracle 义务。

`CLEANUP` 不再是场景业务维度，也不需要为每条 scenario 编写 cleanup oracle；但受管 runner
仍必须回收它实际创建的 JVM、Testcontainers 容器、卷和临时工作区，并将资源回收作为运行安全
条件单独判定。资源 cleanup PASS 不能替代 CONTRACT/BUSINESS，业务 PASS 也不能掩盖资源未回收。

## 2. 唯一代码布局

生产测试入口和共享支撑只保留在：

`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java`

该类负责 JUnit/Testcontainers 生命周期、真实 HTTP 上下文、共享 fixture/helper、DB 计数和结果
写入；不得继续向其中堆积业务 scenario 方法。

业务 scenario 按 owner 业务域放在以下当前 catalog 已登记的 domain group 中：

- `IamAcceptanceScenarios.java`
- `OrganizationAcceptanceScenarios.java`
- `CommercialContractAcceptanceScenarios.java`
- `AssetAcceptanceScenarios.java`
- `CatalogAcceptanceScenarios.java`
- `AuditAcceptanceScenarios.java`
- `ExtensionAcceptanceScenarios.java`
- `CollaborationAcceptanceScenarios.java`（本批新增）
- `BusinessChannelAcceptanceScenarios.java`（本批新增）

`BackendAcceptanceScenarioCatalog` 显式持有已验证的 domain group，通过 `@AcceptanceScenario`
发现方法并按稳定 ID 排序。新增 scenario 必须放入正确的 domain group，使用唯一的
`module.operation` ID，并让 catalog 自动发现；不得新增 provider 壳、共享 SPI、JSON registry、
按接口数量生成的目录或中央巨型 workload。

## 3. 每条真实业务场景必须写什么

新增场景不是“声明一个路径”，而是同时完成以下三件事：

1. **Fixture**：通过现有 owner service/command/helper 造出场景所需的完整业务事实，使用本次
   run 的隔离命名空间；fixture 必须能让 oracle 识别 owner、角色、状态和关联对象。
2. **Request**：通过 `ScenarioContext` 使用真实 route identity、真实 HTTP method/path、真实
   认证上下文和必要请求体；不得通过直接调用 controller/service 代替 HTTP。
3. **Business oracle**：断言真实业务字段和业务后果，而不是只断言“不抛异常”、`response.ok`
   或状态码 2xx。按 operation 语义至少覆盖适用的权限、workspace/owner 隔离、状态迁移、字段
   脱敏、写入结果与幂等/不写入结果；只读 operation 也必须断言返回的业务 identity、归属、
   状态或字段值。

负向场景要同时证明拒绝原因是有类型的，并证明没有泄露或非法写入。写场景要证明写入后的
owner readback、状态/版本或幂等结果；不能把响应码当作写入正确性的替代物。测试中的 OTP、
password、token、cookie、Authorization、手机号、登录名和 raw payload 不得进入日志或报告。

每条场景的 route identity 使用入口类中已有的 operationId/routeTemplate 常量，避免手写路径
漂移。共享 helper 只有在确实跨 domain 复用时才加入入口类；只服务一个业务域的 fixture 或
oracle 保留在对应 domain group，防止业务知识重新集中化。

## 4. 新增场景的固定步骤

1. 动手前重读当前业务需求/分析、适用详设、命中的项目记忆、本规范和 owning production
   source；先确认要证明的业务事实与反例边界。
2. 在当前 catalog 已登记的 domain group 中选择正确文件，新增 `@AcceptanceScenario` 方法及真实 fixture、
   request、business assertions；不要在入口类新增业务测试方法。
3. 先运行单条聚焦验证：

   ```bash
   scripts/test/backend-acceptance --operation <scenario-id-or-operation>
   ```

   核对真实容器、真实 HTTP、`CONTRACT`、`BUSINESS`、`businessMode=REAL`、失败原因和
   `DB_OPERATIONS`；检查受管 runner 的资源 cleanup PASS。一个场景通过不等于其它场景通过。
4. 一个业务批次完成后运行：

   ```bash
   scripts/test/backend-acceptance --operation all
   scripts/verify
   ```

   结果必须能看到发现数、选中数、每条 CONTRACT/BUSINESS、真实断言数、桩数、直接失败数和
   每条 DB 操作数。新增的 Node 静态测试若存在，必须同时登记到
   `scripts/test/test-health-entry-runner.mjs` 的显式测试列表。
5. focused proof 完成后，用第 1 步的同一组原文回读源码和运行结果，确认没有把权限、owner、
   状态或业务字段断言弱化成存在性检查。

## 5. 明确退役的规则

当前新增业务 scenario 不得引入以下旧机制：

- scenario 字段 `performanceCriterion`、accepted-baseline 与旧 QUERY/CONNECTION/TRANSACTION criterion；
- scenario-level `CLEANUP` oracle、calibration、correctnessCases；
- provider/registry、196/197 壳、自动发现分母、双向 exact-set、lane/并行/heartbeat/work
  stealing；
- package entry/exit、P0/W0/P1、receipt、hash-chain、六类 source 分母或 remediation-compliance
  台账。

这些旧 scenario/provider 资产继续退役。2026-08-22 恢复的 generated operation budget 与独立
run-level verifier 不是它们的兼容层：它不新增业务 scenario，不参与单场景 `CONTRACT`/`BUSINESS`，
也不把性能 PASS 写成业务 PASS。真正的业务质量仍只由真实 HTTP 的 `CONTRACT` 与真实业务真值的
`BUSINESS` 共同表达；性能门另报 run-level business/cleanup evidence。

## 6. 最低完成口径

新增场景只有在以下事实同时成立时才可描述为已完成：

- catalog 自动发现且 scenario ID 唯一；
- fixture、request 和 business oracle 都是实际代码，不是路径字符串或桩；
- `CONTRACT` 与 `BUSINESS` 分开报告，`BUSINESS` 标记为 `REAL`；
- 断言覆盖该 operation 适用的业务权限、隔离、状态、脱敏或写入后果；
- focused run 和适用的全量 run 均通过，受管资源 cleanup PASS；
- 代码、设计、项目记忆与 skill 引用使用同一当前口径。
