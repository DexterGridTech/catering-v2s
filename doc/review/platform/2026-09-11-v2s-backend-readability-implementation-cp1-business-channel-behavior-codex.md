# Backend owner 可读性整改 · CP-1 BusinessChannel 行为钉住 remediation

```text
REVIEW_TARGET=IMPLEMENTATION_CP1
REVIEW_CYCLE=2026-09-11-backend-readability
AUTHORITY=DEXTER_IMPLEMENTATION_AUTHORIZED
REMEDIATION_KIND=POST_STRUCTURE_BEHAVIOR_PROOF
PRECONDITION_ORDER=NOT_SATISFIED
CURRENT_STATUS=READY_FOR_STEP_REVIEW
```

## 1. 边界与过程事实

本记录只关闭 BusinessChannel 三个 target 在结构移动后的行为风险证据，不扩大到契约、迁移、前端、L2 spec、测试文件切分或部署。

实施恢复时先完成了 BusinessChannel 结构提取，随后才补做 CP-1 行为钉住。因此本记录是
`POST_STRUCTURE_BEHAVIOR_PROOF`，不能把这些结果追记为“结构移动前已满足 CP-1 前置”。该顺序偏差保留为过程事实，交由本 cycle 第二轮独立审查复核；后续 CP 不得复制这一顺序。

## 2. 风险维度与 focused backend evidence

每个 run 都通过受管 `scripts/test/backend-acceptance --operation <operation>` 执行：Spring/Java、PostgreSQL 与 Testcontainers 在受信远端，本机未启动 Spring 或 PostgreSQL tunnel。每个结果同时检查 CONTRACT、BUSINESS、真实 business oracle、Testcontainers cleanup 与远端 workspace cleanup。

| 风险维度 | focused operation | runId | business | cleanup | 事实闭合 |
| --- | --- | --- | --- | --- | --- |
| visibility create/update、scope 与权威回读 | `storeVisibilityCreateUpdate` | `r5-tc-1789135762815-87124` | PASS | PASS | scope、最终名单与回读事实保持 |
| 已有渠道在可见性变更后保留 | `storeVisibilityExistingChannelRetained` | `r5-tc-1789136057605-93204` | PASS | PASS | 既有 channel 未被 visibility 更新删除或过滤 |
| 幂等 replay 与 CAS conflict | `storeVisibilityIdempotencyAndCas` | `r5-tc-1789136167302-96214` | PASS | PASS | replay/conflict 的业务结果与版本事实保持 |
| VOIDED 关系保留后主动剔除 | `storeVisibilityVoidedRelationRetainedThenRemoved` | `r5-tc-1789136279287-99104` | PASS | PASS | ALL 编辑读取、无关保存、主动剔除三步闭合 |
| provider 不存在/不可用 fail closed | `storeExternalDineInProviderMissing` | `r5-tc-1789136393485-2395` | PASS | PASS | provider revalidation 未被 facade 拆分削弱 |
| external DINE_IN 模板候选与保存 | `storeExternalDineInTemplate` | `r5-tc-1789136508533-5313` | PASS | PASS | provider、模板与 `dineInForm=null` 事实保持 |
| external DINE_IN 渠道与模板 revalidation | `storeExternalDineInChannel` | `r5-tc-1789136620416-8178` | PASS | PASS | 渠道创建与目标模板复核保持 |
| SalesMenu candidate fail closed | `salesMenuEligibleCursor` | `r5-tc-1789136728005-11028` | PASS | PASS | external DINE_IN 不进入销售菜单候选 |
| 渠道/模板状态、草稿与绑定组合 | `cascadeAndDraft` | `r5-tc-1789136854325-14211` | PASS | PASS | 状态与 draft/cascade 事实保持 |
| 双来源与人工停用独立事实 | `doubleSourceAndManualStop` | `r5-tc-1789136966493-17217` | PASS | PASS | source、manual stop 与状态回读保持 |
| typed invalid input 与无部分写入 | `storeVisibilityInvalidInputs` | `r5-tc-1789137077609-20455` | PASS | PASS | 非法 scope/ref/重复输入的失败事实与写入边界保持 |

上述 11 个 run 均为 focused，不代表全量 backend acceptance；本记录不以 focused 结果替代 CP-7 全量验收。

## 3. 静态与模块 focused proof

- `BusinessChannelOwnerService` 继续实现既有 `BusinessChannelOwnerApi`、`BusinessChannelCommandApi`、`BusinessChannelReadApi`，facade 不持有业务事务或 JDBC。
- `BusinessChannelTemplateService`、`BusinessChannelService`、`BusinessChannelTaskReadService` 保留各自原有事务属性；TaskRead 的 read-only 注解已回读确认。
- 共用 projection SQL 只由 package-private `BusinessChannelQuerySupport` 提供；该 support 不持有 JDBC、事务、owner command、lock、receipt、CAS 或 mutation。
- `BusinessChannelService` 与 `BusinessChannelTaskReadService` 的重复 channel projection/select builder 已删除并改为调用该 support；`BusinessChannelTemplateService` 复用同一 bounded-read 常量。
- 原模块 focused compile/test：`business-channel` compileJava 与 test 均 BUILD SUCCESSFUL；现有 5 个 XML test result、32 个测试通过，未新建测试拆分框架或改变测试文件拓扑。
- 目标 facade/target/support 当前未发现超过 120 字符的行。

## 4. CP-1 退出判定

| 判定项 | 结果 | 证据边界 |
| --- | --- | --- |
| visibility relation | PASS | 4 个对应 focused run 的业务 oracle 与 cleanup |
| provider revalidation | PASS | provider missing、template、channel focused run |
| binding/status/readback | PASS | cascade、double-source、existing-channel 与 invalid-input focused run |
| SalesMenu fail-closed | PASS | `salesMenuEligibleCursor` focused business oracle |
| structure support deduplication | PASS | 当前源码与 module compile/test |
| CP-1 前置“先行为后结构” | NOT_SATISFIED | 结构先行的过程偏差已保留，不能追认 |
| CP-1 remediation | READY_FOR_STEP_REVIEW | 等待同 cycle 第二轮 fresh independent review |

## 5. 后续约束

在第二轮独立审查完成前，不进入下一个 owner 的结构 CP。后续 CP 必须先完成对应行为钉住，再移动结构；任何新的风险缺口必须回到当前 CP 的同一三维来源核对，不以本记录的 focused 结果泛化到其他 owner。
