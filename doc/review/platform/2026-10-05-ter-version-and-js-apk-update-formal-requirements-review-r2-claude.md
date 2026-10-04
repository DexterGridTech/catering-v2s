# TER 更新正式需求 · 第二轮独立对抗审查

由 `/root/ter_update_formal_r2` fresh 子 agent 只读审查并返回 findings/verdict；主 agent 仅归档。需求结论 GO，M/S/N=0/0/0；按 review-standard 保留 GO_WITH_UNVERIFIED_UI。所有新增能力尚未实现或动态验证，不把需求结论升级为功能 PASS。

```text
REVIEW_CYCLE_ID=TER_VERSION_JS_APK_UPDATE_FORMAL_REQUIREMENTS_2026-10-05
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER=/root/ter_update_formal_r2
reviewerInputChecklist=doc/review/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-review-r2-input-checklist-claude.md
REQUIREMENTS_VERDICT=GO
REQUIREMENTS_M/S/N=0/0/0
authorMaterialReadAfterIndependentVerdict=true
AUTHOR_MATERIAL_USED_AS_PROOF=false
NEW_FUNCTION_DYNAMIC=NOT_RUN
```

正式输入：`doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`，288行；reviewer审查前后自行复算 SHA 一致：`6da24f4e14c6f3a29bf27b57206145961363dbea9e42d576e9ec0a84c37ea04b`。

原始讨论输入：`doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md`，638行，SHA `cbbff3c584c53dce3447227244e610eb0380d3dc2fe0cf5b63d639885ebba3d3`。

盲审顺序：先完整读取正式需求、原始讨论、必要规范与当前 owning source，构造反例并形成独立 GO/0/0/0、向主agent留下结论，之后才全文读取作者 intake，并仅为核验原 finding 阅读 R1 report §§1–2。历史 verdict及作者处置不作为当前正确性的证明。

## 1. 目标、成本与方案合理性

目标是两 application 的安装APK、FULL ZIP、完整HOT ZIP；两后台分别登记包与维护项目规则；每台物理设备根据实际版本独立执行唯一规则，跨启动续接必要FULL→HOT，准确保留失败与实际版本。

| 更小候选 | 独立判断 |
| --- | --- |
| 只APK、不做HOT | 不满足已明确独立JS更新及M策略 |
| 下载后全部人工处理 | 不满足立即/闲时HOT及固定跨启动任务；人工确认仅适用于系统安装边界 |
| 页面effect执行更新 | 副机或未挂载页面会漏执行；复用Runtime常驻订阅更直接 |
| 跨规则图、第五版本、全局JS严增、跨机共同提交、全量备份 | 没有必要收益，正文已排除 |

当前最小方向合理：复用Runtime/state/render/input/topology/asset及Expo/RN，增加更新owner、真实UpdatePort及native最小加载记录。具体工程选型仍OPEN，不能在需求阶段指定未经核实的私有实现。

## 2. 动作1-B/2：非空事实提取与全文交叉对账

| 全集 | 当前正式稿行号 | 核验结果 |
| --- | --- | --- |
| R-01 | 37–52 | 四版本/package单源、JS整数比较及新内容发布版本变化；同App/平台/runtime冲突拒绝，相同工件跨空间/native-only例外不误禁 |
| R-02 | 54–64 | 三脚本、安装APK与FULL同字节、完整HOT资源、旧APK原生基线前提 |
| R-03 | 66–74 | 实际清单/APK解析、完整性来源、固定最小FULL、准备不改active及仅清理本动作 |
| R-04 | 76–82 | platform-admin集团空间/asset复用，ZIP是待扩展能力，不扩成第二平台 |
| R-05 | 84–92 | 新建/启停/不可编辑、createdAt不随启停变化、读写授权分离、无用途/机型筛选 |
| R-06 | 94–116 | 最新适用规则；不提前滤掉可经FULL到达的runtime；不跨规则拼包；更高APK不降级；FULL-only旧JS拒绝，配对中间较旧JS仅限最终不低于原JS |
| R-07 | 118–128 | 完整项目快照、常驻订阅及启动检查；主副不同App独立判断，本机事实不投影覆盖 |
| R-08 | 130–145 | CBS/TER/Runtime/TDP/平台唯一职责；替换旧marker，保留普通appControl |
| R-09 | 147–155 | port前固定持久化，失败零调用；每boot一规则，FULL后优先续HOT，确认后后继boot才可选下一条 |
| R-10 | 157–163 | 等待/未知/确定失败分开、有限重试、同工件续URL、不越权、失败释放且坏工件不自动重试 |
| R-11 | 165–173 | FULL立即/N提醒、系统pending不重复、人工启动不计入T、实际回读、受控flush回指 |
| R-12 | 175–183 | 简单点击M、两屏与双机隔离、到期复核、无轮询；FULL/HOT真实flush失败零提交，不保证临时状态/未来输入 |
| R-13 | 185–191 | 精确入口/资源/离线、Hermes配对；reload/文本HTTP不是更新器，expo-updates未冒称已选 |
| R-14 | 193–201 | PRIMARY成功/hydration/identity确认、失败hide非成功、native T/同Activity新boot/迟到隔离、仅兼容可读有限恢复、不降APK |
| R-15 | 203–209 | 仅主机实际报告，未知不伪造/不阻断、旧binding隔离、两后台最后报告 |
| V-01～30 | 228–265 | 30行全部核验，覆盖15条需求、零动作/拒绝/跨boot/同步隔离/flush/资源/T/恢复/报告/cleanup；全部NOT_RUN |

讨论稿§9原话、§19/20最终裁决及正式稿§19来源表一致。N/M正值及T/重试/资源预算具体工程值明确留后续，未杜撰固定产品阈值；没有借当前接口、旧页面或实现方便改变裁决。

## 3. 当前源码事实与技术OPEN

精确读取范围见checklist；以下均为静态事实，不能证明新增功能可用。

| owning source | 观察与要求 |
| --- | --- |
| `apps/terminal/kernel/base/platform-ports/src/types/hotUpdate.ts`及androidPlatform | 旧marker和unavailable默认；R-08/§16明确待替换 |
| `apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalAppControlModule.kt:11` | 仅ReactHost.reload，不证明选择目标 |
| 同目录 `TerminalNetworkModule.kt:47`、`:183` | 限长UTF-8字符串HTTP，不能冒充流式下载 |
| `apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx:611`、`:625` | realReady/contentFailure分开，视觉结束不是更新确认 |
| `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:253`、`:278` | failure亦可hideOnce，不可仅hide确认 |
| application/base/android内 `TerminalNativeLoadingRegistry.kt:100`、`:203` | Activity gate且同Activity已released；2秒main-thread dispatch不是JS boot的T watchdog |
| Runtime lifecycle/subscription及sample-member-registry module | 可先订阅、再检查、command执行、注册清理；不要求页面挂载 |
| `apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts:143`、`:191`及`persistenceEngine.ts:301` | 异步/延迟flush及明确失败；store改变不等于落盘 |
| `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts` | 显式sync方向/slice/connection/revision隔离；规则可复用，本机任务不能投影覆盖 |
| `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java:1115` | 分类含图像/mp4，approved usage谓词图像，无具名ZIP接收；未证明mp4上传 |
| 两application package/app.json/Gradle/MainApplication | 当前分处版本与默认host，并非已完成单源/更新加载基线 |
| 已安装ExpoReactHostFactory/DefaultReactHost/JSBundleLoader | file loader入口存在、host有缓存；不证明切换/冷启动资源/保护 |

静态读取Expo57.0.18、RN0.86.3，未执行native依赖解析。reviewer仅以一手资料核验基础边界，不据此指定installer/loader实现：[Android版本](https://developer.android.com/studio/publish/versioning)、[签名](https://developer.android.com/studio/publish/app-signing)、[Expo Hermes](https://docs.expo.dev/guides/using-hermes/)。新增UpdatePort、nativeHermes/SDK、资源/installer/恢复均OPEN。

## 4. 同根全集与被证伪候选

本批全集两application、15条R、30条V全部已对照，剩余未核对需求/场景0；不声称穷举全仓源码。

| 问题族全集 | 反例/判定 |
| --- | --- |
| R-01/02/03/06/09/10/13/15；V-01/02/03/08/09/10/15/17/21/22/27/28 | 新JS沿用旧版本、跨规则拼包、主机旧报告批准副机降级、旧缓存替固定目标；REJECTED_WITH_EVIDENCE，正文已禁止且例外清晰 |
| R-06/09/10/11/12；V-07/09/14/15/16/17/20 | 无规则仍准备、已达到仍reload、waiting误失败、失败永久占位、新规则抢占后半段；REJECTED_WITH_EVIDENCE，零动作与后继boot明确 |
| R-07/08/12/15；V-12/13/14/19/20/27/28/29 | 副机依赖页面、本机事实被覆盖、跨机点击、CBS副机报告；REJECTED_WITH_EVIDENCE，常驻/隔离/不报已明确 |
| R-09/11/12/13/14；V-20～26 | 只HOT flush、失败误确认、同Activity无T、旧boot迟到、恢复不兼容数据/旧APK；REJECTED_WITH_EVIDENCE，受控flush/native T/identity/有限可读恢复明确 |

没有确认的finding，不新增泛化门/控制面或Dexter产品裁决。

## 5. 模板逐节覆盖

四模板全文逐节已读。正式需求不是这四类设计工件，N/A只指本期不交付，不免除后续义务。

- Journey §1元数据、§2任务、§3前提、§4非目标、§5corpus、§6/6.1UI规范、§7裁决：需求事实有来源，正式逐actor Journey工件N/A。
- IA §1、§2.1/2.1.1/2.2、§3共用、§4错误、§5对账、§6完成：IA-ID/控件/错误映射N/A，需求已有actor/scope/owner/选择与失败；未冒称IA完成。
- UI §1/1.1/1.2、§2 interaction map、§3Heritage、§4线框/testId/roster/依赖/动态集合/搜索协议、§5状态、§6逐操作、§7face-owner、§8B.4/B.5、§9demo、§10看图：工件均N/A，§18明确后续义务，未造屏幕或看图记录。
- 详设 §0/1需求层事实有；§2CP、§3/3a机制/控件、§4门、§5 operation、§6跨写、§7传递、§8判定、§9/9a/9b消费/同步/定位、§10/10b及六子节migration/seed、§11/11a验收、§12未决、§13/13b/13c停机/对账、§14自查：工程工件N/A；V分母、OPEN及后续要求明确，不代表矩阵已完成。

本期适用项模板缺节/缺列0；DESIGN_GAPS无已确认需求缺口。后续工程OPEN不构成直接实施授权。

## 6. 证据分层

静态：当前字节/原话/产品边界、15/30分母及上述已有源码。新功能测试已证：无。

无人动态验证：三脚本/单源、ZIP/APK/签名/权限、真实UpdatePort、资源离线加载、安装/N、HOT M/点击、flush实际重启、主副/双屏、native T/迟到/恢复、实际报告、资源与cleanup，V-01～30全部NOT_RUN。

未运行生成/编译/测试/verify/DEV/L2/Android/设备/reset/seed/UAT，未读.runtime；无受管run或待清理资源，不将“未启动”写成cleanup PASS。

## 7. 独立结论后对照作者材料

先独立形成verdict后全文读intake当时1–25行（SHA `beeab8c10c08ee95153d7569f6c9f92721917b2c2138e85290af61fdd7c63b85`）；之后仅读R1 report20–52行核验原finding，不使用其旧verdict证明当前正确。此hash是当时对照快照，不是随后追加R2处置后的intake hash。

| 原finding | reviewer当前核验 |
| --- | --- |
| S-1 | CONFIRMED_CLOSED：R-01:43/52、V-01/03恢复发布变化；同App/平台/runtime范围、重复/跨空间/native-only例外未引入全局严增 |
| N-1 | CONFIRMED_CLOSED：V-07/09/15/17零动作、失败本boot/后继boot区分 |
| N-2 | CONFIRMED_CLOSED：R-11:173、R-12:183、V-20两类受控flush；无全局锁/备份/系统移交后未来输入承诺 |

对照未改变独立结论；R1原NO-GO0/1/2保持原输入真实性。

## 8. 原始固定结论block

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS（需求与既有源码静态核验；新增工程能力OPEN）
L2_USER_VISIBLE=PASS（需求层用户任务/范围/失败恢复核验；没有运行UI）
L3_UNVERIFIED=V-01–V-30全部NOT_RUN；具体清单见§6
SAME_ROOT_SCAN=两application、R-01–15、V-01–30全部核对；需求/场景剩余0；见§4
DESIGN_GAPS=无已确认的需求判据缺口；后续工程OPEN见§3
TEMPLATE_COVERAGE=四模板全文逐节核验；阶段适用性见§5
EVIDENCE_TIER=SOURCE_ONLY_STATIC_REVIEW；NEW_FUNCTION_DYNAMIC=NOT_RUN
ROUND_FINAL_DECISION=SELF_DECIDED
```

第二轮最终综合由该独立reviewer给出：需求GO、0/0/0，新功能可用性未验证。本cycle已达第二轮硬停止点，不召集第三轮；需求GO不授权后续设计、实施或动态执行。运行状态始终正常读取/补截断/整理报告，最终completed；等待timeout未被当异常停止。
