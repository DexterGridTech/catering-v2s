# 前后台重点代码结构优化：外部设计评审 intake

日期：2026-10-14；作者=Codex主agent。本文件是作者辩证处置，不是独立verdict。外部原报告 doc/review/platform/2026-10-14-backend-frontend-structure-design-external-review-claude.md 的 NO-GO 0M/2S/2N 对应旧四文件字节，原文/计数/SHA保持不变。

## 1 · 当前授权与阅读

Dexter转交外部报告要求复核处置；主agent先读报告与当前被审四文档、AGENTS/BLUEPRINT环境矩阵、全部kernel、deterministic-context及六维review/platform/operations-admin/platform/evidence/review命中，再亲自重开下表owning sources。两名只读source研究者仅提供定位，未代判finding或写文件。主agent独自核事实/反例/更小替代并写入。

Dexter答复“ A：复用现有 Web Journey（推荐）”。问题已明确此选择改变V09/V10/V11/V14，因此按该直接裁决同步四V及档位定义，不动其他产品要求。修改范围只有需求文档、三设计工件、review/intake/话术；没有生产、测试、脚本、规范、记忆或依赖diff，不读取.runtime，不执行生成/编译/测试/构建/DEV/Web/L2/seed。一次文档批改命令在Python解析阶段失败；SHA确认四文件未写入，改为小批命中断言/回读后完成，不把执行返回当内容正确证明。

## 2 · 原四项逐条处置

| 项 | 主agent classification / closure | 核实事实/反例 | 最小修正/成本比较 |
|---|---|---|---|
| S-1 | PARTIALLY_CONFIRMED；验证路线为DEXTER_DECISION，Dexter选择A后CLOSED_DESIGN_ONLY | update Web确有真实CBS候选→固定task→报告→运营读回；remote Web确有真实LiveKit但track是synthetic。历史翻页原while仅task不在第一页才执行，原Journey并不等同全部旧L2 oracle；F本来已承担资源竞态。新隔离TDS/wire/report/artifact移交是额外失败面 | 需求V09/10/11/14、详设§3a/11a、计划CP06/§9、附件§4/5同步A：三隔离L2＋四现W run。保留全部F，现Journey只补读/控件主流程，不新producer/runner。首次L2仍有完整seed dry-run及两App工件源成本，不声称“省去TER构建” |
| S-2 | CONFIRMED → CLOSED_DESIGN_ONLY | AGENTS/BLUEPRINT明确TDS节点远端loopback不经tunnel；原附件父run WS tunnel越线。wire接受localhost不能创设网络授权 | 随A删除整个隔离TDS/wire路径及其Node测试/资源登记；W只沿现DEV HAProxy，不留本机node tunnel。比另建远端wire mode更小，不另申请ingress |
| N-1 | CONFIRMED → CLOSED_DESIGN_ONLY | canonical六enum字段：SCREEN_READY.screen、POINTER.screen/phase、INPUT_RESULT.status/reason、SESSION_END.reason；原Web parser六处均手写。INPUT_RESULT.reason另nullable，不把null加进字符串集。String(array)会把数组误转合法值 | 详设§8.1/§7、计划CP01、附件§1按message＋field遍历六组，双目标同renderer additive；成员先核string。nullable、optional/cancel、UUID/seq/bytes/gesture/participant保留；TER手写同根只记录为本批反例，不越T1改接入 |
| N-2 | CONFIRMED → CLOSED_DESIGN_ONLY；真实seed证明OPEN | complete-seed dryRun调用base/catalog与各plan-only，未执行owner-command-seed-executor七处extension请求 | 详设§10b与附件§5.3/计划CP06说明dry-run只准入，helper对象化F/真实ExtensionAcceptance H分别证明自身，真实seed运行/持久化仍L3/NOT_RUN；不为消除证据差异偷偷跑seed或扩大dry-run写库 |

所有CLOSED仅指当前设计处置；生成物/consumer/Node登记和执行能力尚未实施，不能写成实现关闭或动态PASS。

## 3 · 主agent重新核实的源接缝

- contracts/protocol/terminal-remote-control-protocol.json:22/38/41/56/57–64/94–101；generator:71–105/147–175/222–237；RemoteControlWorkspace.tsx:100–128。六字段五种值集不是共享语义，不能值去重合并screen。
- tools/terminal-automation/src/runner.ts:117–138/946–973/1024–1037/1166及readManagedDevContext；journeys/terminalUpdateSupplyUi.ts#createTerminalUpdateSupplyUi/#assertTerminalUpdateReportInUi、update.test.ts:1000–1211、remote.web.test.ts:506–533/591起。不是隔离L2，不证明原生capture。
- scripts/dev/r5-complete-seed-executor.mjs:409–435；terminal-update-seed-plan.mjs#buildTerminalUpdateSeedPlan；owner-command-seed-executor.mjs#extensionSubmission及七调用。完整dry-run、helper F、真实seed是三种事实。
- 现TDC executeTerminalHttpCommand只鉴权/传输；terminal-update的createTerminalUpdateReportOwner.ts:185–195独占nextReportSequence。过程中曾考虑直接提交21报告作分页fixture，亲验后删除：它会绕开本地序号owner且增加业务写；TerminalUpdateReportRecent canonical也没有taskId。当前方案只用主业务验证后的窄GET route响应fixture，不造任何额外报告/credential/state。
- node_modules/playwright-core/package.json=1.61.1、types/types.d.ts:4072/4747/20933、lib/coreBundle.js:60836–60884亲读。route/fulfill/unroute是既有库能力，unroute不等于取消所有在途handler；设计已写精确pattern/handler及原page owner结束在途的责任。静态官方发行物不是运行证明。
- StoreEditDrawer与ContractEditDrawer的extension控件、DataScopeSelector.tsx#content/trigger及roleHomeTestIds亲读：Contract DATE是Input type=date、Store沿DatePicker；scope含trigger/region/option/project/option/confirm/cancel，按现role可变性与fixture session匹配，不扩权限。

## 4 · 同根与防再犯（主目的地＝明确review checklist）

| 通用失败模式 / 根因层 | 有限分母和同根扫描 | 合法反例 / 最小解 |
|---|---|---|
| 结构整改验证累加成新基础设施 / 执行设计 | 三设计全文、V09/10/11/14、原六UI case、所有control/fixture/资源/Node登记；其余三个隔离case逐一保留，原三个终端依赖case全部迁W | 真需隔离后端的新业务测试另立依据；本批复用已有W，F承接竞态；W_CONTROLLED_UI只证明浏览器控件，不冒称owner分页 |
| 本机工具限制被误作ingress授权 / 环境边界 | 原隔离TDS、wire、WS tunnel、principal、Node test、cleanup全文互查；本批新TDS路径全部删除 | 既有HAProxy获准入口是反例；从原矩阵消费地址，不开新node tunnel |
| 只迁部分闭集 / canonical生成边界 | canonical全部六enum与Web全部六消费者，双输出check/type/runtime，nullable/cancel独立检查；其余消息非enum字段保留原shape | 中文label是呈现事实不是协议闭集；null非字符串枚举；全field派生而不新registry |
| 准入dry-run被升级为业务执行 / proof边界 | dryRun所有child与七owner seed调用、helper测试、真实HTTP/H及source export状态；其余plan-only不当真实写证明 | ExtensionAcceptance H证明HTTP对象接缝但不等于正式seed；只把实际执行标为对应档位PASS |
| 夹具越过事实owner / 测试边界 | report sequence/request/body/receipt/current binding与route独占handler所有权 | 最小只读两页responsefixture，真实主task先证；不写21伪任务、不把fake响应当CBS历史 |

以上进入本批CP06测试链及最终review checklist，未修改memory/规范。机器门不适合裁决验证路线成本，NOT_APPLICABLE_WITH_REASON=语义/产品取舍不能机械判断。

## 5 · 独立审查与未验证

Dexter实质改变批准范围，因此新cycle BACKEND_FRONTEND_STRUCTURE_ROUTE_A_20261014（DESIGN，最多两轮）；不重开旧cycle，不把旧R4绿推到本次。新fresh审查按独立input checklist进行，报告由主agent逐字转录另存。本文件不自授GO；当前独立结果见同前缀route-a-review-r1/r2-codex.md（实际产生后才有效）。

L1=静态文档/源读回；L2=三case隔离L2及四W均NOT_RUN；W_CONTROLLED_UI也是NOT_RUN。L3包含优化后菜单/扩展输入保存/更新列表Drawer刷新与分页/remote restart焦点、真实seed对象请求、export cleanup、Java解析与T1最终住址。所有实现、生成、编译、F/H、构建、DEV/Web/设备、dry-run/reset/seed、cleanup均未执行；没有缺证强行升级PASS。UI/TestId/L2 admission仍OPEN/OPEN/BLOCKED。

外部报告提到两项治理DESIGN_GAPS只登记：M/S/N正本缺定义；结构整改UI证明档位缺通用判据。本次Dexter A仅个案裁决，不改治理正本或发明长效豁免。

## 6 · 当前字节清单

- `doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md` SHA-256=a22ecff163d12b6626f67a1e3a0b28ac3e097092e97cebb68213ab03aff8f193
- `doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md` SHA-256=b910c2a48b1295df4052a67b2b44768f885218532da9d7816b6d64223157e768
- `doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-plan-codex.md` SHA-256=e1fa961caddc9d4f6e88b6f9ce1969fa6a0fe818a76a80a4bcce333e2e704809
- `doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md` SHA-256=8d73dfbbe337992355a02cf97f3aa595249bda18f99029505d4e0902adeeb7c3

## 7 · Route A R1 与最小文案修正（当时记录）

fresh R1原结论GO_WITH_UNVERIFIED_UI 0M/0S/1N，完整报告另存route-a-review-r1-codex.md，原SHA/计数保留。其N-01主agent重开DataScopeSelector.tsx:347确认是Popover；附件§4.2确认/取消两行改为Popover内容区Button。其余scope触点、两host表单日期、dirty确认框逐一核对：dirty确认确为foundation confirm，不能因本项把所有Modal字样删掉。CONFIRMED/CLOSED_DESIGN_ONLY，无产品裁决。

主目的地为本批控件source→真实承载→TestId/node→focused检查清单；反例是独立Drawer dirty确认框，仍保留原Modal.confirm语义。R2用新fresh当前字节定向核验，不重复CP01–05生产方案。R2原verdict产生前主agent不自判最终GO。

## 8 · 当前修订精确位置

- S-1/路线裁决：`doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md:177`。
- S-1/L2与W区分：`doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md:74`。
- S-2/删除网络路径：`doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-plan-codex.md:79`。
- N-1/六字段：`doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md:147`。
- N-2/seed证明：`doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md:199`。
- R1 N-01/Popover：`doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md:125`。
- 分页fixture档位：`doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md:163`。

## 9 · R2 独立原 verdict 与同轮收口

R2初始盲审NO-GO 0M/1S/0N，原字节与finding保存在route-a-review-r2-codex.md，不改写为早已通过。S-01主agent重开DataScopeSelector:121–124/200/266/306及admin-catalog:1999–2065确认：PROJECT不能改变PROJECT范围，REGION又不能获目标更新页，不能只修region禁用分支。最小修法为两fixture明确PROJECT role/assignment与page/capability，owner固定PROJECT/父REGION先读回；仅trigger/cancel/menu动作，region/project/confirm只观察disabled，option不入binding。三个page/三个action均来自当前catalog，不新权限、不改产品控件、不换GROUP/REGION增可变范围case。两个extension case同为当前PROJECT授权宿主。

原通用失败模式为“用角色symbol替代真实roleNodeType/候选与固定祖先事实，导致旅途点击禁用控件”；有限分母是三case的actor/assignment/scope与七scope来源，反例是原GROUP多候选选择任务（本批不新增）。防再犯目的地为附件逐控件表与fixture/readback focused/review checklist，不新registry。CONFIRMED/CLOSED_DESIGN_ONLY；主agent回读两处scope描述与计划CP06，其余未改CP不重复对账。

修订后同一R2 reviewer按已独立形成的finding重开最新源与四稿，最终综合ROUND_FINAL_DECISION=SELF_DECIDED，GO_WITH_UNVERIFIED_UI 0M/0S/0N。这是reviewer自己的当前字节结论，主agent只逐字转录，不是第三轮；cycle到两轮硬停止。审查范围是Route A修订与直接同根接缝，不冒称未改CP01–05重新全量源码审查。全部实现/动态仍NOT_RUN，原两个治理DESIGN_GAPS保留为正本问题，非本轮新产品阻断。

进入外部Claude差量复核；不自动进入实施。
