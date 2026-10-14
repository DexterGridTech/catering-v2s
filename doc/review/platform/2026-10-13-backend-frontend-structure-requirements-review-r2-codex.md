# 前后台结构正式需求 · fresh 独立对抗审查 R2

主agent保存readonly `/root/bf_requirements_blind_r2` 的独立verdict、finding及输入记录；无改写计数。reviewer未写文件。

```text
REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_REQUIREMENTS_20261013
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-13-backend-frontend-structure-requirements-review-r2-codex.md
ROUND_FINAL_DECISION=SELF_DECIDED
ACTION_1_VARIANT=1-B
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=S-01：资产来源事实与正向验收要求不一致
L2_USER_VISIBLE=PASS（仅需求静态保真边界；不代表现UI或未来实现PASS）
L3_UNVERIFIED=空（本阶段没有新增、未决的用户交互要求）
SAME_ROOT_SCAN=R05/V04两处同根；其余13族、R01–17及V01–18已核对
DESIGN_GAPS=无新增正本判据缺口
EVIDENCE_TIER=READ_ONLY_STATIC_REQUIREMENTS_REVIEW
authorMaterialReadAfterIndependentVerdict=false
```

## 1 · 字节与盲审

对象`doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md`，开始/结束亲算SHA均为`dd865fea25517586e654ab8e372ba8c13c2bbaa849404d7ba1a8f1422149c336`。

本reviewer在fresh上下文收到最小输入清单，先证伪、形成独立finding/verdict，未读本cycle作者intake、自审或前轮verdict。逐点实施前后双读/focused留痕N/A：本轮正式需求无实施。报告由主agent保存。

## 2 · S-01（独立finding）

**将视频保留分支写成当前合法物化消费者，造成验收与范围冲突。CONFIRMED；不需Dexter裁决。**

- 需求R05:84“现消费者包括video/mp4”、V04:169“现有效ZIP/图片/video/mp4”正向等价验收。
- `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java:480–497`先用途/type准入再选物化；`:1319–1327`只准四现用途及PNG/JPEG/WebP；`:1330`起privatePackage只准终端更新ZIP。
- `:1366–1386/1524–1555`视频大小/后缀/magic存在，不等于能通过公共stage；validContentType无调用者。
- `contracts/openapi/components/platform-asset/asset.schemas.json:30–38` staging result只有图片；`:99–106`读引用包含video/mp4，不证明上传准入，DB约束同样不证明。
- 同根扫描前后台手写生产/测试video/mp4，找到保留分支/DB约束，没找到当前正向视频stage消费者。需求两处已定位，现ZIP/图片路径核对。
- 反例/影响：详设按正向视频安排验收必遭准入拒绝，若为了变绿而放开用途/type违背R01；测试私有分支又不能证明合法入口。
- 最小修正：区分当前可达ZIP/图片与保留视频底层/读引用。V04正向只覆盖可达消费者，视频公共准入仍拒绝，保留分支不误加图片decode。无需删除视频分支或新增用途/schema/框架。
- 根因是把不同能力层次混为一事；文字修正足够，不应扩视频上传或专项测试。

## 3 · 方案及其余攻击

目标符合维护原因/事实住址/真实复用要求。只修名单/cast不能完成已接受的职责与资源闭环；当前方案在现owner/support/foundation和窄入口内，不做registry、每feature执行器或强制Bean，代价相称。

B4/B5延期贯穿§0/§2/R07/非目标；B7保留构造。R06保护facade/self-call/事务；R12真实JSON/null/omission/false/0/DATE与现edge对象到SET/CLEAR一致，十Drawer/十四operation包含复用Drawer多命令。R10保留独立resource/query/context/finally fence；R13不使用foundation raw未知fallback覆盖“状态未知”。

R17:138明确R-READ-07最终全量acceptance晚于生产/测试全部改动，focused不可替代；§5:162的F不豁免整体义务。NOT_RUN不计本轮finding。

## 4 · TEMPLATE_COVERAGE

| 模板 | 逐节适用性 |
|---|---|
| Journey | §1元数据/授权、§2目标、§4禁推、§5语料、§7裁定有需求层对应；§3逐actor前提、§6/6.1新UI N/A：不建新Journey |
| IA | §1元数据、§2可见/不可见/负载、§3规则、§4错误、§5对账、§6完成判定：新IA制作N/A；现交互保真由R/V约束 |
| UI | §1/1.1/1.2、§2map、§3旧页、§4线框/testId/roster/依赖/字段/search、§5状态、§6合理性、§7owner、§8出处、§9demo、§10看图新工件N/A；现入口/全屏/互斥/焦点已静态核对 |
| 详设 | §0/1需求层有；§2 CP、§3/3a、§4门、§5操作、§6owner、§7传递、§8规则、§9/9a/9b、§10/10b、§11/11a、§12、§13/13b/13c、§14具体工件N/A，R16/R17约束未来义务 |

1-B非空：阶段适用、延期边界、S01有记录。计数是导航，不是新增上限；没有因未来CP、测试或动态缺失判需求缺项。

## 5 · 真实输入清单

- READ_FULL：AGENTS、CLAUDE、对象、来源分析、TER T1正式需求。Dexter原任务/本次全部建议+正式需求+直至GO与§0/分析§7比对。
- READ：PLATFORM-BLUEPRINT、doc/platform/README、scripts/README适用；index/全部六kernel；cs-memory-recall/cs-review及独立input模板。
- ROUTE_RUN：design/backend/backend/backend/architecture/task-start（23命中）；design/admin-ui/operations-admin/frontend-platform/architecture/task-start（22命中）；去重27原文全读/亲算hash。路径集合与R1 inputs文件的27项同一集合，此处引用只为列名，不引用其read声明或verdict。
- CORPUS：全文/读取政策，G02–05/05A/05B、08–12/CIPG01及禁推，不据此加业务。
- 适用sources：四模板全文、review/backend§2/2.5/frontend§3弹层状态L2/charter/第三方/实施模板/验证治理；相关服务形态、review、foundation、corpus、extension、日志、原子范围与协作决定。decision标题已看。
- current source/interaction：对象§4TDS/asset/catalog/IAM/Page/remote/generator/menu/extension canonical/generated/edge/owner/foundation关键接缝；更新供给/报告和远控Journey/IA/UI、catalog工作台相关原文。无关历史性能/控制面/完整旧详设不作新增判据。
- N/A：实施proof、依赖运行、CP对账、动态日志与cleanup；没有测试/生成/构建/verify/环境/数据动作。
- REMAINING：独立只读审查完成。reviewer原文按默认两轮规则硬停止、不召集第三轮、不授权详设/实施；主agent须处置S01。本报告保留这一原始声明，任何后续由主agent另按Dexter当前授权记录，不改写本结论。
