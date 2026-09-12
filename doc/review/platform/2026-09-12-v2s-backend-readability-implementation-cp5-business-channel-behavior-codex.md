# CP-5 BusinessChannel 实施对账

```text
REVIEW_TARGET=IMPLEMENTATION
CP=CP-5
STEP_REVIEW=MATCHED
REVIEWER=INDEPENDENT_SUBAGENT:Turing
M/S/N=0/0/0
```

## 范围与当前字节

CP-5 将 `BusinessChannelOwnerService` 的 owner facade 拆为模板、渠道和组合读取三个 target。facade 仍实现既有 `BusinessChannelReadApi`、`BusinessChannelCommandApi` 与 `BusinessChannelOwnerApi`，不改变 HTTP/API 公开边界。`ExternalCollaborationBusinessChannelCoordinator` 不在本 CP 的模块 application 候选范围内，未被迁移。

当前 target 文件为：

- `BusinessChannelOwnerService.java`：只保留 API 转发与 package-private 查询构造入口；
- `BusinessChannelTemplateService.java`：承接模板、scope、visible-store relation、provider validation、CAS/audit/readback；
- `BusinessChannelService.java`：承接 channel lifecycle、binding/status、template revalidation 与 channel readback；
- `BusinessChannelTaskReadService.java`：承接组合 read、binding projection 与 SalesMenu eligibility；
- `BusinessChannelQuerySupport.java`：package-private projection SQL builder，不拥有事务或业务写入事实。

## 逐点静态对账

1. facade 的 20 个公开 override 全部保留，调用方继续依赖既有 API；未发现生产代码直接注入新 target 或遗留 concrete owner 的调用路径。
2. visible-store membership、enabled-store gate、relation count 与 relation write 只位于 `BusinessChannelTemplateService`。`BusinessChannelService` 创建门店渠道时通过 package-private `templateService.requireStoreChannelCreateEligibility(...)` 复用模板 owner 事实，没有复制校验。
3. `BusinessChannelService` 保留 channel create/update/status/detach 的事务边界；facade 不增加事务。三个 target 的 public read/write 方法保留原 `@Transactional`/`readOnly` 语义。
4. `BusinessChannelTaskReadService` 只提供组合读取和销售菜单资格判断，不写模板关系或渠道事实。
5. 没有引入 `@Primary`、fallback 或隐藏 bean；Spring production constructor 显式注入 target service。旧 direct-construction compatibility constructor 仅供既有 focused test fixture，未改变生产注入。

## Focused 动态证据

受管远端 Testcontainers run：`r5-tc-1789172471209-83250`。

- 远端 task：`:apps:backend:catering-business-server:modules:business-channel:test`；
- `sourceSync.status=PASS`，`testExecution.status=PASS`，远端 Gradle status 为 `0`；
- targeted tests：`BusinessChannelOwnerContractTest`、`BusinessChannelSalesMenuOwnerTest`、`BusinessChannelPolicyTest`、`BusinessChannelCommandQueryTest`、`BusinessChannelCommandReceiptServiceTest`；
- `cleanup.status=PASS`，remote process/workspace、Testcontainers containers/volumes 均 PASS；
- `devLifecycle.wasRunning=false`，没有联动停止或重启 DEV；
- `business=NOT_APPLICABLE`、`backendAcceptance=null`：这是 module focused test proof，不是 full backend acceptance。

## 独立步骤复查

Turing 以 fresh read-only verifier 对当前 CP-5 source、详设/计划、S-1 修复和 run manifest 逐项复查，返回：

```text
REVIEW_TARGET=IMPLEMENTATION
CP=CP-5
STEP_REVIEW=MATCHED
M/S/N=0/0/0
```

其结论同时确认：目标职责与设计匹配；visible-store 事实没有跨 target 重复；facade/API 公开面完整；构造器无歧义；事务传播未见改变；focused 证据没有被过度声明。

## 尚未关闭的整批证据

CP-5 不关闭 CP-7 的全量 compile、full backend acceptance、最终整体三维对账、reset、DEV、seed 或实施后独立 review。上述项目在所有 CP 与测试代码完成后按实施计划统一执行。
