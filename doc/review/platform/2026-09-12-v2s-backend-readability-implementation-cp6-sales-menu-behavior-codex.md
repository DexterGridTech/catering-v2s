# CP-6 SalesMenu 结构移动实施证据

## 结论

- `CP=CP-6`
- `REVIEW_TARGET=IMPLEMENTATION`
- `STEP_REVIEW=MATCHED`
- `M/S/N=0/0/0`
- 独立复核者：Erdos，`reviewerKind=INDEPENDENT_SUBAGENT`，只读
- 本文只关闭 SalesMenu 结构移动的静态与 focused module-test 证据；不把 focused test 或 technical Testcontainers run 升级为 backend acceptance business PASS。

## 目标与实际 owning source

CP-6 按实施详设与计划将原 `SalesMenuOwnerService` 的业务族拆到同 module、同 application package 的具体 service，同时保留 owner API facade、事务边界、receipt/canonicalization、锁/CAS、publication readback、人工销售状态和 operation record 语义。

本 CP 的实际 Java source 为：

- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`
- `.../SalesMenuDefinitionService.java`
- `.../SalesMenuSectionService.java`
- `.../SalesMenuItemService.java`
- `.../SalesMenuPublicationService.java`
- `.../SalesMenuManualSaleService.java`
- `.../SalesMenuOperationRecordService.java`
- `.../SalesMenuReadModels.java`

测试仅调整既有排序测试的 target composition / 反射辅助，不切分测试文件：

- `apps/backend/catering-business-server/modules/sales-menu/src/test/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerServiceOrderingTest.java`

## 本次修复与 post-read

CP-6 过程中独立 review 找到并已修复两类结构偏差：

1. Section/Item/Definition 中的 `lockMutationTarget` 曾跨越其它方法族。当前 Definition 仅保留 menu collection lock，Section 只处理 section create/rename/delete/move，Item 只处理 item delete/move；Item 的 `requireSection` 仅服务 `addItems` 的 section 存在性前置校验，不是跨族锁分派。
2. `SalesMenuReadModels` 曾承载锁、preflight、receipt 和 publication/manual flow state。当前它是 package-private 的纯 projection/row-mapper 容器，只保留行记录、页面记录及 mapper；publication state 留在 `SalesMenuPublicationService`，manual receipt state 留在 `SalesMenuManualSaleService`。
3. receipt canonicalization 曾跨命令族重复判断。当前 Definition 只 canonicalize `ScheduleCommand`，Item 只 canonicalize `ItemUpdateCommand`，Section/Publication/ManualSale 的 `receiptRequest` 对本族不需要转换的请求原样返回；不存在跨族 `ScheduleCommand`/`ItemUpdateCommand` 分支。

post-read 的静态结论：facade 只 forward 到对应 target；`SalesMenuCommandApi` overload 直接进入 target bean，不通过 facade public method 自调用借事务代理；`SalesMenuReadModels` 无 JDBC、transaction annotation、lock、preflight、receipt request 或 publication flow state。

## focused proof

本地验证：

```text
./gradlew :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:modules:sales-menu:test --tests com.catering.v2s.salesmenu.application.SalesMenuOwnerServiceOrderingTest --no-daemon
PASS
```

远端受管 Testcontainers focused run：

```text
runId=r5-tc-1789174951440-32041
command=node scripts/test/r5-remote-testcontainers.mjs :apps:backend:catering-business-server:modules:sales-menu:test
```

读取 `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789174951440-32041/` 当前产物所得：

- Gradle `testExecution.status=PASS`，remote Gradle status `0`，目标 task 为 `:apps:backend:catering-business-server:modules:sales-menu:test`。
- JUnit XML 共 6 个 suite、35 个 tests；每个 suite 的 `failures=0`、`errors=0`、`skipped=0`。
- cleanup 为 `PASS`：remote process、remote workspace、Testcontainers containers、Testcontainers volumes 均 PASS。
- `firstFailure=null`。
- `devLifecycle.wasRunning=false`，没有 stop/restore；本次没有 DEV 生命周期副作用。
- manifest 的 `business=NOT_APPLICABLE`。因此本证据只声明 SalesMenu module focused test 与受管资源 cleanup PASS，不声明 backend acceptance BUSINESS PASS。

此前首败 `r5-tc-1789173772963-7827` 暴露旧的 `MoveCurrentRow` nested class 反射名称；修正 target-specific move helper 后，`r5-tc-1789173901032-10230` 通过。随后 receipt canonicalization 修正后使用上面的最新 run 重新验证。

## 独立 step review

- Kepler 首轮发现 Definition/Section/Item 的跨族锁分派与 ReadModels 携带 flow state，已修复。
- Pauli follow-up 发现 receipt canonicalization helper 跨族判断，已修复并重新执行 focused proof。
- Erdos 在最新字节上只读复核上述修复及 facade/API、ordering、事务承接和证据分层，结论为：

```text
REVIEW_TARGET=IMPLEMENTATION
CP=CP-6
STEP_REVIEW=MATCHED
M/S/N=0/0/0
reviewerKind=INDEPENDENT_SUBAGENT
mode=read-only
```

## 边界与未关闭事项

CP-6 不包含也不宣称：全量 backend acceptance 的 CONTRACT/BUSINESS、run-level budget verifier、DEV、reset、seed、browser L2、UAT、部署或切流。上述 focused run 的 `business=NOT_APPLICABLE` 是保留证据等级的明确结论。

CP-7 仍需执行整批逐代码与详设对账、最后一次全量 backend acceptance（CONTRACT 与 `businessMode=REAL` 的 BUSINESS 分开判读、cleanup 单独 PASS、budget verifier 独立取证）、整体 fresh implementation review，以及授权范围内最终 reset/DEV/seed 收口。
