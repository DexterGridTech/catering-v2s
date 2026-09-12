# Backend owner 可读性整改 · CP-5 BusinessChannel implementation reconciliation

```text
CP=CP-5
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE=2026-09-11-backend-readability
AUTHORITY=DEXTER_IMPLEMENTATION_AUTHORIZED
STATUS=READY_FOR_STEP_REVIEW
```

## 当前 owning source

- facade: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java`
- template target: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTemplateService.java`
- channel target: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelService.java`
- task-read target: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelTaskReadService.java`
- shared pure projection support: `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelQuerySupport.java`
- APIs: `BusinessChannelOwnerApi.java`、`BusinessChannelCommandApi.java`、`BusinessChannelReadApi.java`

## 目标边界与事务归属

| target | 事实范围 | 事务边界 |
| --- | --- | --- |
| `BusinessChannelTemplateService` | template page/candidate/visible-store/read/context、create/update/transition | 保留原 read-only/read/write attributes |
| `BusinessChannelService` | channel page/read/context、create/update/transition/detach | 保留原 read-only/read/write attributes |
| `BusinessChannelTaskReadService` | channel-with-template/provider projection、binding read、SalesMenu eligibility/requirement | 保留原 read-only attributes |
| `BusinessChannelOwnerService` | 稳定 API/FQCN facade 与兼容构造面 | 不持有业务事务、JDBC 或 owner mutation |

`BusinessChannelQuerySupport` 只提供无状态、package-private projection/select builder 与 bounded-read 常量，不承接 owner 校验、receipt、lock、CAS、audit 或写入事实。

## 兼容面

- facade 继续实现三个既有 BusinessChannel API。
- 原八依赖构造器保留，既有 focused tests 的直接构造方式不需要改动。
- 没有新增 Spring `@Primary` 或 fallback；target bean 使用显式依赖。
- 没有改变 HTTP contract、generated source、数据库模型、测试文件拓扑或其他 owner 的调用 API。

## 对账与证据

详细 CP-1 remediation、过程顺序偏差与 11 个 focused backend run 见
[CP-1 behavior record](./2026-09-11-v2s-backend-readability-implementation-cp1-business-channel-behavior-codex.md)。

本记录的 module focused proof：

- `./gradlew :apps:backend:catering-business-server:modules:business-channel:compileJava --no-daemon`：BUILD SUCCESSFUL。
- `./gradlew :apps:backend:catering-business-server:modules:business-channel:test --no-daemon`：BUILD SUCCESSFUL；5 个 XML test result、32 个测试通过。
- 目标文件的行宽检查无超过 120 字符的行。

上述 focused proof 不替代 CP-7 的全量 backend acceptance；CP-7 必须在所有生产与测试代码改动完成后，使用
`scripts/test/backend-acceptance --operation all`，分别报告 CONTRACT、BUSINESS、DB_OPERATIONS、budget verifier 与 cleanup。

## 状态

`CP-5_STATUS=READY_FOR_STEP_REVIEW`

注意：早期恢复记录曾将本 CP 临时写入 `cp2-business-channel-codex.md`。该文件保留为历史过程记录，不能作为官方 CP 编号或“先行为后结构前置已满足”的证明；本文件是 CP-5 canonical record。
