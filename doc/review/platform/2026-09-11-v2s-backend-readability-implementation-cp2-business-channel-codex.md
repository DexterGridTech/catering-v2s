# HISTORICAL PROCESS RECORD — BusinessChannel initial extraction (originally mislabeled CP-2)

> 本文件保留早期恢复阶段的原始过程记录。BusinessChannel 在正式实施计划中属于 CP-5；其 CP-1
> “先行为钉住、再结构改动”前置也确实未在本次恢复中先于结构提取完成。请以
> `2026-09-11-v2s-backend-readability-implementation-cp5-business-channel-codex.md` 与
> `2026-09-11-v2s-backend-readability-implementation-cp1-business-channel-behavior-codex.md`
> 作为当前 canonical 对账记录，不得把本文件的历史状态追认成顺序合规。

- CP: CP-2
- REVIEW_TARGET: IMPLEMENTATION
- scope: BusinessChannelOwnerService 的稳定 owner facade、template/channel/task-read target 拆分
- authorization: Dexter 已依据 implementation-facing 详设与实施计划授权；本记录不扩大到契约、迁移、前端、L2 spec、测试文件切分或部署
- status: READY_FOR_STEP_REVIEW

## 当前字节与 owning source

- facade: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`
- template target: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTemplateService.java`
- channel target: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelService.java`
- task-read target: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTaskReadService.java`
- API owning sources: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java`, `BusinessChannelReadApi.java`, `BusinessChannelCommandApi.java`

## 方法族与事务归属

| 稳定 owner 方法族 | target | 方法数 | 事务边界 |
| --- | --- | ---: | --- |
| template page/candidate/visible-store/read/context + create/update/transition | BusinessChannelTemplateService | 8 | 原有 readOnly/read/write 注解保留在 target |
| channel page/read/context + create/update/transition/detach | BusinessChannelService | 7 | 原有 readOnly/read/write 注解保留在 target |
| sales-menu eligibility + binding/task projections | BusinessChannelTaskReadService | 5 | 原有 readOnly 注解已补回 target |
| stable public owner boundary | BusinessChannelOwnerService | 20 API methods | facade 不持有业务事务/SQL，只转发到 target |

计数依据：对三个 target 与 facade 的当前字节使用 `rg -n '^    public '`，构造器单独排除；API 方法以三个接口当前源码为准。

## 保留的兼容面

- BusinessChannelOwnerService 继续实现 BusinessChannelOwnerApi、BusinessChannelCommandApi、BusinessChannelReadApi。
- 保留原八依赖构造器，focused tests 无需改变构造调用。
- 保留包内测试所需的 `BOUNDED_READ_LIMIT` 与 `channelCommandSelect(String)`，后者转发到 channel target。
- ContractProblemAdvice 与其他 production caller 继续依赖原 facade/API FQCN；未改契约或 generated source。

## 行为与结构 focused proof

- `./gradlew :apps:backend:catering-business-server:modules:business-channel:compileJava --no-daemon`: BUILD SUCCESSFUL。
- `./gradlew :apps:backend:catering-business-server:modules:business-channel:test --no-daemon`: BUILD SUCCESSFUL。
- 既有 BusinessChannelOwnerContractTest、BusinessChannelSalesMenuOwnerTest、BusinessChannelCommandQueryTest 与 policy/receipt tests 均在现有测试文件中执行；未拆分测试文件。
- target 的原始 SQL、owner 校验、幂等、锁与 readback 方法体来自原 owner source 的对应方法族；本 CP 未改变 API 形态或 SQL 语义。
- TaskRead 初版提取曾遗漏五个 readOnly 事务注解，已通过当前 source 对账补回；补回后重新 compile/test 通过。

## 调用方核对

- production 代码对 BusinessChannelOwnerService 的具体类依赖未发现；业务入口继续通过原 API/facade。
- 既有 tests 直接构造 BusinessChannelOwnerService，原构造器保持。
- target beans 使用原八依赖构造器，由 facade 使用三 target bean 的构造器注入；未增加 primary/fallback。

## 过程状态与剩余复核

CP-1 的“先行为钉住、再结构改动”前置在本次恢复中未先于 CP-2 结构提取完成；不能将其追记为已满足。当前只以既有 focused tests 和 target 对账证明本 CP 的行为未见回归，尚需 fresh 独立 step review 确认，并在后续 CP-1/整体行为证据中补齐正式风险维度闭合。该事实不扩大实施范围，也不把静态/模块测试提升为 backend acceptance。
