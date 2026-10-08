# TER 阶段 B · Dexter 裁决修订 intake

```text
ACTION=AUTHOR_DOCUMENT_DECISION_INTAKE
AUTHORITY=DEXTER_CURRENT_CONVERSATION
CURRENT_INDEPENDENT_VERDICT=NOT_ISSUED
IMPLEMENTATION_AUTHORITY=false
CYCLE_STATE=CLOSED_NOT_REOPENED
EVIDENCE_TIER=AUTHOR_STATIC_DOCUMENT_AND_SOURCE_READBACK
UI_NEW_DETAILS_AND_ALL_DYNAMIC=NOT_RUN
```

## 1 · 当前裁决及覆盖关系

本记录承接外部参考评审处置，但不改写旧评审 verdict、SHA 或旧 intake。当时六项待决现有 Dexter 直接答复。原“未作废，包含启用和停用”随后被“我说错了，仅包含启用”明确覆盖；当前报告查询只含项目下启用门店中的启用终端。此限制是页面查询资格，不删除已持久化历史，不改变规则固定 refs 的回显逻辑。

| 输入 | 当前处置 | 最小落点与边界 |
| --- | --- | --- |
| CBS 报告列表/最新/历史 | DEXTER_CONFIRMED / CLOSED_DOC | 详设§8.5、§14.1；IA报告Tab与标准Drawer；仅启用双方、NO_REPORT保留，按实际版本查询；每任务一行，阶段更新原行，任务历史分页 |
| 上传和解析成功才保存 | DEXTER_CONFIRMED / CLOSED_DOC | UI§1.1/§14，详设§17；唯一保存按钮随当前file/stage/context成功解析和HOT配对生效，后台独立复核 |
| HTTP上报和心跳触发补发 | DEXTER_CONFIRMED / CLOSED_DOC | 详设§8.5；计划CP-01/CP-04；移除WS报告帧、TDS报告写、ACK timer及报告触发重连；业务owner持久pending，匹配PONG广播只作补发唤醒 |
| N/M分钟 | DEXTER_CONFIRMED / CLOSED_DOC | UI分钟输入、API秒显式乘除60；候审整数1..1440分钟不是用户或官方给定上限，DEV 5/10分钟，边界只进验收fixture |
| 运维保留技术信息 | DEXTER_CONFIRMED / CLOSED_DOC | 包版本/APK/JS/runtime/身份/摘要保留；秘密、raw异常仍不展示 |
| 规则操作历史 | DEXTER_CONFIRMED / CLOSED_DOC | 标准OperationsAuditHistoryModal及通用audit GET；PROJECT task read、实体type/封闭query扩展，创建/启停同事务审计，幂等不重复 |
| 每个更新任务一条报告 | DEXTER_CONFIRMED / CLOSED_DOC | report key=(workspace,terminal,binding,taskId)，同task UPSERT；无task当前观察不冒充任务历史，HTTP重送及心跳不新增历史 |
| 仅启用范围更正 | DEXTER_CONFIRMED / CLOSED_DOC | 详设§8.5启用范围反例、计划末段、附件page/detail/history；单侧/双方停用及任一作废均排除，历史存储仍保留 |

CLOSED_DOC仅表示裁决已写入设计；不表示源码实现、独立设计GO或动态通过。原外部S-1所指A实际拒绝/回退readback、A最终交接、依赖/资源/API部署仍按原工程前置保留OPEN，不由字典关闭。

## 2 · 源码依据及方案取舍

- TDC当前heartbeatTick是internal/local；actor有效PONG匹配路径在terminalDataClientActor.ts:1741–1770。拟新增public/local广播只在合法PONG后异步发出，不把PING和PONG都当两次tick。当前dispatchBackgroundCommand:240–254失败会invalidate transport，因此不能复用于业务补发广播；新增路径安全记录失败，不破坏存活。
- Runtime createCommandDispatcher.ts:624–658已有多actor分发，不造第二总线。createCommandActorDispatcher.ts:325–329、362–371的timeout不取消实际IO；升级owner inFlight在首await前设置并直到实际IO结束释放，不能把dispatch超时当成可再发送。
- TDC readTerminalDataCommand当前只提供GET；新增typed POST复用generated executor/transport，凭证仍归TDC，HTTP返回后校验当前绑定/配置身份。升级owner保存失败业务正文，TDC不反向依赖升级业务。
- 标准审计Modal现消费getOperationsEntityAuditHistory；AuditEntityTypes和OperationsAuditTaskReadService当前没有TERMINAL_UPDATE_RULE，计划明确扩闭集和真实PROJECT任务读，不仅添加前端按钮。
- 不新增第二报告写通道、中心失败缓存、通用调度器、人工重试或逐阶段历史流水。报告pending按task保存最新内容；持久化失败可见，不承诺本地存储不可写时仍能保证落盘。CBS HTTP receipt只证明owner commit，不证明更新成功。

## 3 · 文档自审与未来测试义务

六份正文已交叉读回最新裁决：HTTP roster18项（platform5/operations9/terminal4）；审计读取复用既有operation；TestId附件§9.1唯一命名；两内容页内原九交互面加标准审计附属面，不新增第三内容页。表格新增行保持同表，模板矩阵补标准审计surface；旧16项/ACK重连/未决产品候选不作为当前方案。

测试计划包含：每task阶段覆盖、两task保留、重复/乱序、HTTP及flush失败、响应丢失、identity变化、timeout与inFlight、有效/未知PONG、多actor故障隔离、标准audit、分钟换算、Save gate及启用资格四种组合。列表断言具体返回身份而非仅数量；detail/history与page同资格，已开Drawer停用后拒绝读回并清旧内容。上述全部PLANNED/NOT_RUN。

标准心跳机制及新报告语义需在未来明确实施授权下同步正式需求R-15、terminal-coding-standard§4-F唯一正本与适用项目记忆；本轮不越权修改这些文件。尚未冻结的新HTTP错误code/status与正常预算须CP-01按canonical和实际owner链核实。仅已MATCHED且未受本次变化影响的A内容不重复对账，新增影响仍必须focused proof及对应CP/整批检查。

本轮没有新的fresh独立审查。此前R6因thread limit未执行的记录保留，不伪造独立结论、不重开关闭cycle。新增产品裁决已落实为设计输入，但当前字节仍须交Dexter与外部Claude评审。

## 4 · 只读/写入范围与摘要

只写阶段B六份文档及本intake。未改需求、标准、项目记忆、阶段A、源码、测试、依赖，未联系Codex；未运行生成、编译、测试、verify、DEV、Web、设备、reset/seed、L2/UAT或部署，未读取.runtime。纯读取与文档结构回读不构成产品运行PASS。

| 当前文件 | SHA-256 |
| --- | --- |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md` | `89803db2849b18c48f515640c53088f90ca05f645beec8732b6f62cb92676d09` |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md` | `d9078bf8eb7b4d674d870ea61ef3f72acf909855454f86a93ae9d4d6c19925f6` |
| `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md` | `2528d5845609ce307669f452c68a297fb37fbe381c43c6629e2cda98e9677cdf` |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md` | `42de671aa776e75c29ec210ba6156729681ccf2d42975e47c9a359aaf5a1a7bd` |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md` | `0ddf05e0c4f315debe46472e6c1ecf1b90268c155bae5442d540253b60c3683a` |
| `doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md` | `087e4aa0e0322d5f3461ae8ea97a6c114119dcf48f479bb4a1876082e05e11a7` |
| `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` | `f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22` |
