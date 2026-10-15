# 前后台重点代码结构优化 · 当前源码与 DEV-only 设计处置

日期：2026-10-15。Dexter本次要求按当前前后台代码更新设计/计划，后续仅DEV动态、允许受管reset/seed、不碰UAT；补充TER验证不得用真机双屏，使用安卓虚拟机。此前话术尚未给Codex，不能推导已实施。

本次主agent仅修改正式需求的验证/授权说明、详设、计划、附件及本轮review/处置记录；没有改生产源码、测试、生成器、脚本、规范、记忆、依赖，没有运行任何生成、编译、测试、verify、DEV、reset/seed、Web、设备、UAT或cleanup。纯读取/文档编辑和文件摘要不是工程或动态PASS。未来Codex实施授权来自Dexter及转交话术，而非review verdict。

## 1 · 当前源码适用性与有限修订

两名fresh只读源码研究者分别检查后端/seed和前端/DEV接缝，无写入；不把研究意见作为整包独立verdict。主agent按当前源码核实：

| 源码事实 | 当前设计处置 | 文件落点 |
|---|---|---|
| TDS Codec仍有TOPIC_KEYS；Protocol现有集合加载helper；asset两物化循环、catalog重复skuPreparationDiffers、十Drawer/十四请求与seed七create仍数组适配、Page六资源counter/remote双session住址仍存在 | 原六CP整改仍有效，不取消主体范围或引入新owner/容器/执行器 | 详设§8、计划CP01–05、附件§1–3 |
| OPS remote-control/index.ts已导出workspace/Target/UUID，Page已消费；Page也已消费terminalUpdateRuleFilters/CandidateQuery/ActualUnknownReason | CP03 RETAIN现入口，CP05才additive补launcher；复用现helper而非重建 | 详设§0.3/8.4、计划§1/CP03、附件§1 |
| scripts/uat/uat-environment.mjs:1755–1758→scripts/dev/seed:25→r5-complete-seed-executor.mjs:479→owner-command-seed-executor；shared managed-seed-target识别DEV/UAT | 只改共同extensionSubmission对象形状和测试，保留null/undefined omit与环境身份分支；只静态核UAT消费兼容，不改/运行UAT | 详设§0.3/10b、计划§1/CP04/9、附件§5 |
| seed STORE只有is24Hour/storeArea/floorLabel等，没有DATE；CONTRACT有renewal/depositRate/signedDate；原seed PROJECT角色无合同edit、无专用reader | 使用现真实字段与host；两个run-owned PROJECT角色经现owner HTTP邀请既有账号、两个同browser的Context，不改seed角色、不造字段或定义fixture | 附件§4.1–4.2、计划CP06 |
| console现update在真实报告accepted/CBS读回/UI历史确认之后才business PASS；supply尚未返回platformPage/projectRef/contextVersion | 仅新增普通adminStructureDevUi helper及focused test，supply返回事实小幅增加；接console同run，保留两个sample update/remote共四Web run | 附件§4–5、计划CP06/9 |
| start拒绝参数；reset先dry-run并核DEV资源再清DEV DB/Doris；seed须profile及confirmation | 计划给实际无--profile的reset/start与明确seed命令；显式.runtime/r5和DEV kind/DB/namespace/host身份，UAT不动 | 计划§9、详设§10b、附件§5 |

本批DEV证明限定正常对象SET(false/0/DATE)、CLEAR、omission、同键重放、菜单/dirty/读回、更新/远控主链及有界响应fixture分页。required/disabled、wrongscope/stale/CAS/rollback等保护仍按原F/owner源码/编译核验；依赖容器的运行NOT_RUN，不为结构优化另造负向DEV fixture。原scope与业务断言不删；通用R-READ-07不改，只记录Dexter本批验证档位例外。

## 2 · 独立审查与 finding disposition

REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_DEV_ONLY_20261015；旧已关闭cycle不重开。轮次上限2。reviewer fresh、只读、先独立判断后对照作者材料；主agent唯一写入。历史/初次采样verdict保留，不以作者处置代写独立GO。第二轮SELF_DECIDED按治理第1节仅由reviewer给最终综合。

| finding | 核验与反例 | 最小修正/同根范围 | 状态 |
|---|---|---|---|
| R1 S-01：活动表仍要求范围外H和无caller的DEV负向case | CONFIRMED：需求§0.1/计划§2已取消，但详设§3/4/6/7仍有4处活动H和6处负向DEV義务，执行与对账会冲突 | 统一实际proof栏为CP内F/源码/编译、整体后正常DEV链；负向保持保护判据/NOT_RUN；横切、CP门、事务、声明传递、V表和附件全文读回，不碰原实现 | CLOSED_DESIGN_ONLY；无需新Dexter裁决 |
| R2初次采样S-01：计划CP04 step5残留“拒绝后独立owner GET” | CONFIRMED：计划:65仍扩大DEV分母，附件§4.1与详设§6/V13明确不新增该fixture | 仅删该句“/拒绝后”，补required/disabled F/源码、容器NOT_RUN；其余三输入无改动，同族已核。由R2 reviewer作最终差量核验，不召集第三轮 | CLOSED_DESIGN_ONLY：R2 reviewer已独立回读修订后单句/同族并确认关闭；无需新Dexter裁决 |

R1原始结论见`2026-10-15-backend-frontend-structure-dev-only-design-review-r1-codex.md`；R2初次采样与最终综合见对应r2报告。两轮均不是实施/动态证明。

## 3 · 当前授权与未验证范围

- 当前作者任务仅文档与静态核查，NOT_RUN不是本轮缺陷。
- 后续Codex可按新版六CP实施与必要定向F，全部CP/6b及真实日志/两轮动态前fresh查漏后，完整seed dry-run→必要DEV reset→start→完整seed→正常DEV HTTP/UI/四Web链；同范围无需重复申请reset/seed。
- 若TER需要设备验证，只用显式serial安卓虚拟机、最新automation-agent；非adapter先Web。禁止真机双屏、不新增完整设备矩阵、不复活旧runner。
- UAT不停止、重启、部署、reset/seed、写数据或修改环境配置；不能因同host/资源不足停UAT。sharedseed静态兼容不等于UAT动态通过。
- 不运行全仓verify、全量backend-acceptance/Testcontainers或新隔离L2。容器测试fixture仍迁移/编译，运行OUT_OF_SCOPE/NOT_RUN。
- 首败读日志定位，只复查/定向验证真实影响面，不重复未改对账/矩阵。business与cleanup分别输出，精确回收自有Context/assignment/role/临时物与恢复所改seed值；保留DEV体验服务/完整数据，邀请/审计历史不删除。
- 全部新能力、控件、依赖解析、F/D/W/VM与cleanup仍NOT_RUN；实际UI为L3_UNVERIFIED。静态设计无阻断只能GO_WITH_UNVERIFIED_UI，不是实施交付。

## 4 · 当前交付字节

R2 reviewer在同一最终轮次内保留初次采样NO-GO 0/1/0，再独立核验唯一单句修订；当前综合为GO_WITH_UNVERIFIED_UI，M/S/N=0/0/0。这是reviewer最终综合，不是作者自判；不增加第三轮。实现/动态/cleanup仍NOT_RUN。

| 当前文件 | SHA-256 |
|---|---|
| `doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md` | `376c560b4c75dec4d08cb77c60bfa1654fc5b2b4e83d3961a08fa15669c5e55f` |
| `doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md` | `9c1914c1c2ab351b5151c142a948b19a9ba87b7bac134ef234ac9d07da020e69` |
| `doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-plan-codex.md` | `d3c9ed25f73c695c29e02a512e378680cb7173d6ff943d193e8a1c8549a15e79` |
| `doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md` | `ed704cfa82987d52c02daf5f7f899708278805f6154180d7857e9111fd4dfa41` |

当前落点：需求§0.1及设备补充裁定，详设§0.3/3/3a/4/6/7/8.4/10b/11a/13，计划§1–2/CP03–06/§9，附件§1/3/4/5。四文件已交叉读回，同一授权、tier、角色/fixture、先后顺序及cleanup写法一致；唯一生成物输入摘要与当前正式需求SHA一致。
