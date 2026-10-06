# 阶段 A 独立 DESIGN R1

REVIEW_CYCLE_ID=TER-UPDATE-A-DESIGN-20261006
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/update_design_r1
INPUT_CHECKLIST=doc/review/platform/2026-10-06-ter-version-update-stage-a-design-review-r1-input-checklist-codex.md
BLIND_REVIEW=true

主agent转录reviewer的结论、finding与有限同根检查，保留原severity；位置均指R1冻结旧字节。静态阅读完整输入后形成反例；未读作者intake、未运行或读取运行evidence。原结论不因后续作者处置改写。

## 结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=3 / 2 / 1
L1_ENGINEERING=findings:M1,M2,S1,S2,N1
L2_USER_VISIBLE=findings:M3,S1
L3_UNVERIFIED=系统安装/取消及来源权限界面；同Activity reload后的加载与双屏呈现；原生保护失败面及可访问性；Dexter线框接受
SAME_ROOT_SCAN=各finding有限分母与下表
DESIGN_GAPS=DG1 每次React实例的不可变boot身份/确认归属协议；DG2 installer action-session持久化与commit崩溃窗协议
TEMPLATE_COVERAGE=四模板适用槽位对照
EVIDENCE_TIER=STATIC_SOURCE_ONLY；动态/业务/cleanup均NOT_RUN
```

## Findings

| ID/性质 | 位置（R1字节）与事实/反例 | 影响/最小修正 | Dexter决策 |
| --- | --- | --- | --- |
| M1 CONFIRMED | 计划45–46原CP-02真实native探针，而最终owner在55、保护在69；详设251要求最终command；需求380/391要求首次HOT同步保护与正式owner | native探针可能绕过最终执行核；把owner、flush/sourceprovider和candidate保护提前到首次真实更新前。typed-port/纯原生focused可直测技术类，安装App不得旁路 | 无新增产品裁决 |
| M2 CONFIRMED / DG1 | 详设103/126/140/172–176只声明boot；204只列topology reset。Expo factory125–127 onWill仅cached Host初建，143–149 onDid在load后；Runtime失败、topology、TDC取消三个reset族 | 无法保证reload新token、旧context迟到不冒名和加载前期限。写定冷启/所有reload的前置、getter幂等、ReactContext不可变关联及PRIMARY确认协议 | 工程修正，无产品裁决 |
| M3 CONFIRMED | 详设63–69的§3a只有原则；UI53–54系统安装/取消/来源，88–89原生failure。适用模板要求action/control及准入 | 无法复验真实UI动作；逐case节点/owner/来源/display/driver通路/NOT_RUN，全控制面与变更复核。OS不强配TER TestId，允许最新agent R10的系统UiAutomator窄例外 | 界面看图仍待Dexter |
| S1 CONFIRMED | 详设47–56非固定横切组，197–224同步清单不完整；Journey11–13/23–29/40–44缺metadata/source三类/corpus槽；IA32–40共享不可见表，46–52缺全错误映射；UI25地图仅prose、93–105缺state/action合理性/faceowner | 设计不能完整实施/验收。补四模板适用槽位与精确N/A，不新增功能/控制台账；UI UNSET保持真实 | 不需新增产品裁决 |
| S2 CONFIRMED / DG2 | 详设140–148/156–168未明确sessionId与action持久化顺序及commit崩溃窗，计划43–46同根 | action无法回读，可能重复commit或清仍需APK。添加create/persist/commit/callback逐窗口恢复表，不建第二任务账本 | 无新增产品裁决 |
| N1 CONFIRMED | 详设209的fixture/scenario目录不符当前tools/terminal-automation；计划101缺Android serial；246角色仅稍后确认；runner481仅journey有DEV父流程 | 计划入口无法直接执行。使用现有fixtures/journeys、精确CLI与环境名，update需要DEV的case显式接父流程，其余不启动DEV | 执行授权另给 |

## 方案、同根与模板

主干版本、FULL/HOT配对、两App同发布树、一个本机owner、单Host及唯一automation driver成立；不需要另换架构。M1覆盖两种原生探针及其后继CP；M2覆盖cold/HOT/recovery和三个既有reset族；M3覆盖INSTALL/BOOT/FAILURE全部控制/观察。S1逐四模板与三个面，S2完整安装动作窗口，N1两个平台/两个App/mobile与dual及DEV/local分支。其余成员检查没有新增问题。

implementation模板的授权/目标/CP、写owner、声明传递消费、规则、fixture、场景、OPEN、停机、节奏、13c、交付总体存在；缺口为§3固定组/§3a/§9a完整同步和§9b定位。Journey缺元数据/精确前提类型/corpus表；IA缺逐面不可见五维/全错误/具体交叉对账；UI缺map表/state/action rationale/faceowner及适用完成槽。退役manifest不恢复。

已核实仅文档、当前API源码及公开接缝。系统安装、离线资源、同Host重载、boot deadline/迟到/回退、持久数据兼容及资源预算均未运行。L3未验证不能以静态说明闭合。
