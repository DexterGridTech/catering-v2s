# 前后台结构优化 CP-04 实施与对账记录

## 范围与当前状态

- CP：04，扩展字段跨 feature 纯规则、十四个 Drawer operation、edge object mapping 与 shared seed helper。
- 本记录为主 agent 当前字节复读与验证记录。fresh 独立 CP04 三维对账 `/root/cp04_fresh_delta` 结论为 `OPEN`：源码与 focused proof 对齐判据，但实施期间缺少逐变更点同期双读留痕；事后复读不能追溯补齐该流程事实。2026-10-15 Dexter 明确批准透明记录该治理偏差并豁免 CP-04 的此项流程门，允许继续全批 6b；本 CP 状态仍保留 `OPEN`，不改写为 `MATCHED`，也不扩大任何 UAT/真机边界。
- 判据：正式需求 R-09/R-12；详设 §8.4、§8.7、§9a、§10b；计划 CP-04；附件 §1–3；原十个 Drawer IA；`project-memory/operations/implementation-source-reread-discipline.md`。
- 最新权限澄清：必要容器、测试及环境资源可用；UAT 与真机仍不在本批执行面。CP04 未 reset/seed/触碰 DEV 或 UAT。精确 edge mapper focused JUnit 经受管远端入口运行；没有创建 Testcontainers 容器或卷。

## 处置与实现

| 项 | 当前源事实、最小处置与边界 |
|---|---|
| 扩展字段规则和窄入口 | 新增 `apps/frontend/operations-admin/src/features/extension-fields/model/extensionFormValues.ts` 与 `extension-fields/index.ts`。十个 Drawer、组织字段组件及当前详情消费者调用 enabled/hydrate/serialize/detail 纯能力；列表的 `extensionListAndSearchColumns`/`extensionQueryValues` 同入口导出，三个列表页面改从入口消费。表单同 displayOrder 稳定顺序与列表 displayOrder+key 顺序仍各自保留。删除旧 `organizationExtensionValues.ts` 和双 cast；没有导出无外部消费者的 `orderedExtensionFields`，也没有把平台初始化或服务点整体提交改成 delta。状态：`CONFIRMED / CLOSED_IN_CP04_SOURCE`，无新产品裁决。|
| 十四个实际 Drawer payload | `extensionRequestAdapters.test.tsx` 调用十个实际组件渲染出的 `Form.onFinish`，观察 operationsClient 的方法与真实请求 `body.extensionValues`，核十四个 create/update operation 的对象形状；create 覆盖 false、0、DATE 与未变化字段，update 另外覆盖已存在值清除为 null，disabled 字段不发送。测试直接经过各 Drawer 的提交闭包，方法名也逐 operation 核对；它不声称验证每种业务实体的后端持久化，该证明属于全批 DEV 链。 |
| Pure 值规则 | `extensionFormValues.test.ts` 核 enabled/disabled、表单同序稳定、DATE hydrate/规范化、false/0 保留、同值 omission、无原值空值 omission、有原值 CLEAR=null、空对象及详情呈现。`extensionList.test.ts` 保留列表 tie-break 与查询参数原形。`OrganizationExtensionFields.test.ts` 直接核实际字段名、required、BOOLEAN checked、各控件类型、disabled 排除和 TestId 透传。 |
| Edge object mapping | `ExtensionSubmissionWireMapper` 只接受 object/null，object 中非 null 映射 owner typed SET、null 映射 CLEAR；数组或其他非 object 形状以既有 `InvalidEdgeRequestException` 拒绝，沿 edge advice 的 422 `PLATFORM_COMMON_VALIDATION_FAILED` 身份。`ExtensionSubmissionWireMapperTest` 核合法 SET/CLEAR 与 legacy/普通数组拒绝。owner typed list、公开 operation、schema/generator/DB 均未改变。 |
| Seed helper 与既有 fixture | `owner-command-seed-executor.mjs` 的七个 create 均通过 `extensionValuesForRequest` 发送 object，并保留 `assertExtensionValueReadback`；附件 CP04 定位从不存在的 `#extensionSubmission` 更正为当前真实 helper 名。`owner-command-seed-executor.test.mjs` 对 helper 行为核普通值、false、0、DATE 保留，null/undefined omission，以及对象非数组。共享 DEV/UAT executor 的环境 target 分支未改；CP04 未运行 seed，不触碰 UAT。 |
| Legacy caller 同根扫描 | 按附件列出的 frontend、edge 与 host tests/fixtures 复核所有已识别 array caller：测试/fixture 迁到 object 或非法数组红例；未发现需保留的生产 array caller。三个列表页面 deep import 改用窄入口；同 feature 内部 `extensionList` 测试与定义仍允许相对路径。旧纯 helper 已删除。 |

## CP-04 focused proof

| Proof | 当前字节结果 | 证据边界 |
|---|---|---|
| `yarn vitest run src/features/extension-fields/model/extensionRequestAdapters.test.tsx src/features/extension-fields/model/extensionFormValues.test.ts src/features/extension-fields/model/extensionList.test.ts src/features/organization-structure/ui/OrganizationExtensionFields.test.ts`，cwd `apps/frontend/operations-admin` | 退出码 0；4 files / 10 tests passed。 | 证明 pure、组织表单控件和十四个 Drawer 的实际客户端 payload；不证明 CBS 持久化/HTTP。 |
| `yarn eslint ...extensionRequestAdapters.test.tsx ...extensionFormValues.test.ts --max-warnings=0`，cwd `apps/frontend/operations-admin` | 退出码 0。 | 精确改动的两份新表单/请求测试。 |
| `yarn typecheck`，cwd `apps/frontend/operations-admin` | 退出码 0。 | 当前 feature、Drawer 与窄入口类型闭包。 |
| `node --test src/tests/architecture/public-entry-boundary.test.mjs`，cwd `apps/frontend/operations-admin` | 3 pass、0 fail、1 个既有 TODO。 | public-entry 越界/合法边界，不是整仓架构证明。 |
| `node --test scripts/dev/owner-command-seed-executor.test.mjs`，仓根 | 28/28 pass。 | seed helper 静态行为测试；没有写入数据库或实际 seed。 |
| 受管远端 focused Java：`V2S_RUNTIME_DIR=<repo>/.runtime/r5 node scripts/test/r5-remote-testcontainers.mjs :apps:backend:catering-business-server:test --tests com.catering.v2s.app.edge.extension.ExtensionSubmissionWireMapperTest` | Run `r5-tc-1792015371644-84064`：Gradle `BUILD SUCCESSFUL`，runner PASS；manifest cleanup PASS，`DEV_WAS_RUNNING=false`，无本次容器/卷残留。 | 实际提交的命令含精确 `--tests com.catering.v2s.app.edge.extension.ExtensionSubmissionWireMapperTest` 选择器。现存 manifest 只记录模块 `:apps:backend:catering-business-server:test` 为 PASS，没有持久化选择器；因此 manifest 独立证明模块任务与 cleanup 结果，选择器来自本次受管命令调用记录。该 mapper 测试不创建 Testcontainers 容器；没有运行 backend-acceptance、PG/Testcontainers integration、DEV HTTP 或完整 owner persistence。准确 manifest：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1792015371644-84064/run-manifest.json`。 |

未执行 cp04 seed/reset、DEV HTTP、D_BROWSER、UAT、真机或设备验证。真实 owner SET/CLEAR/omission/幂等重放与独立 GET 仍留在全部 CP/6b 后的计划 DEV 动态阶段，不能以本节 focused proof 推断通过。

## 当前字节读回

前序修改没有逐变更点即时落盘表。本节记录现在对最终字节与原判据执行的真实复读；不倒填写入时间，也不把当前复读冒称为此前的同期记录。fresh CP04 reviewer 又依据主线程原始操作顺序确认：此前所有 CP04 写入点并未逐点重开同组判据、记忆与 owning source；这属于实际历史执行偏差，不能通过补写文档追溯修复。本次仅记录当前字节的复读与直接 proof，不声称追溯补齐历史。复读范围：R-09/R-12；详设 §8.4/§8.7/§9a/§10b；计划 CP-04；附件 §1–3；原十个 Drawer IA；命中 memory `implementation-source-reread-discipline.md` 和 `deterministic-context-only.md`；对应 owning source 与上述 focused proof 输出。

| 当前复读点 | 原文与最终源码核对 | Proof 对应和范围 |
|---|---|---|
| feature 公共入口及三处列表消费 | R-09 与详设 §8.4 当前要求 feature 自有 public entry 集中 extension-fields 声明能力，并由 organization/catalog/contract 三列表消费者通过同一 feature 入口取列表投影；当前三个消费者从 `features/extension-fields` 入口导入，测试与同根扫描没有发现退回组织 feature 私有 helper 的生产路径。 | `public-entry-boundary.test.mjs`、typecheck 与列表 focused test；不证明运行时数据加载或 owner 持久化。 |
| serialize/object 语义 | 当前 `extensionFormValues.ts` 仍先过滤 DISABLED；DATE 规范为 YYYY-MM-DD；原值存在的空值生成 null，无原值的空值省略；相同 JSON 值省略，false/0 保留；index 的 export 是具名窄集合。十 Drawer 的生产引用均由 `rg serializeExtensionFormValues` 核实，列表/详情与三个列表 consumer 的窄入口由 `rg extension-fields/model/extensionList` 核实；旧 helper 路径无命中。 | 四文件 Vitest、typecheck、payload case；当前读回不增加运行声称。 |
| 表单/列表显示边界 | 当前 `enabledExtensionFields` 保持表单同 displayOrder 输入稳定排序；`extensionList.tsx` 仍调用原 `orderTypedExtensionFields` 实现 displayOrder+key 排序；组织字段组件只保留 query/控件宿主职责。 | pure/list/OrganizationExtensionFields tests。 |
| owner mapper 与 error identity | 当前 mapper object/null 分支映射现 typed list，其他 shape 统一抛 `InvalidEdgeRequestException`；直接 mapper test 检查数组拒绝；existing advice 对该异常映射 422 validation problem。 | 受管指定 JUnit 类 PASS；没有测持久化 owner 事务。 |
| shared seed 请求及附件定位 | 当前七个 create 的 payload 均调用 `extensionValuesForRequest`；同 helper 对 DATE/false/0 保留，null/undefined 省略；成功 create 后仍对 owner readback 调 `assertExtensionValueReadback`；DEV/UAT target 选择逻辑不变。来源附件 locator 已由过时概念名更正为真实 helper 名。 | 28/28 Node tests；实际 r5-full seed仍 NOT_RUN；定位修正只改变文档。 |
| 原子迁移与依赖范围 | 当前 source appendix 的 CP04 operation/fixture清单与上述消费者一致；原 IA 的十 Drawer行为、host scope、required最终复核与owner幂等仍留在各 owner。未发现schema/generated DB迁移或业务scope迁移。 | 以上所有 focused proof；动态owner readback保留至6b。 |

## 独立对账与剩余状态

- CP04 fresh 独立只读 reviewer `/root/cp04_fresh_delta` 逐项核对需求/详设/项目记忆、owning source 与直接 proof；结论 `OPEN`。OPEN 的具体原因是实施期间缺少逐点同期双读记录，不是当前发现业务源码偏离。该历史过程证据无法由本次文档补写或重读伪造。
- Dexter 于 2026-10-15 明确批准将上述不可追溯的历史留痕缺口作为治理偏差透明保留，并豁免其阻止全批 6b 的流程门。豁免仅允许继续后续对账/验收，不构成 CP-04 `MATCHED`、整批通过或任何未运行行为的证据。
- CP04 内 6b、DEV、reset/seed、真实持久化、浏览器与 UAT/设备：`NOT_RUN`，按现计划分别在全批阶段处理；UAT/真机整个批次不触碰。
- 全批 6b、13c 与整批 `REVIEW_TARGET=IMPLEMENTATION`：尚未完成。
