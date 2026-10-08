# 阶段 B 项目双 Tab 设计独立对抗审查 R5

```text
REVIEW_CYCLE_ID=ter-version-update-stage-b-project-tabs-20261007
REVIEW_TARGET=DESIGN
REVIEW_ROUND=5
REVIEW_ROUND_LIMIT=6
DEFAULT_REVIEW_ROUND_LIMIT=2
EXTENSION_NUMBER=2
ADDITIONAL_REVIEW_INDEX=1
ROUND_EXTENSION_AUTHORITY=DEXTER_EXPLICIT_SESSION
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-07-ter-version-update-stage-b-project-tabs-design-review-r5-input-claude.md
blindReviewDeclaration=原始需求/规范/路由/source→六工件→独立NO-GO→最后R4/intake
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=S1 候选响应的展示装配职责违反读模型规范
L2_USER_VISIBLE=PASS_DESIGN_ONLY 大致IA已确认，实际UI未验证
L3_UNVERIFIED=A交接/依赖解析/生成编译/HTTPPGMinio/组件/TERWebAndroid/adminL2/resetseed/businesscleanup OPEN或NOT_RUN
SAME_ROOT_SCAN=六工件/16HTTP/九交互面及候选、响应显示、输入、错误、CP与seed链
DESIGN_GAPS=无新增产品判据缺口；S1有既有规范
TEMPLATE_COVERAGE=四模板实际槽位读取核验；有内容不等于运行PASS
EVIDENCE_TIER=READ_ONLY_STATIC_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false
BUSINESS=NOT_RUN
CLEANUP=NOT_APPLICABLE_READ_ONLY
FILE_WRITES=0
DYNAMIC_EXECUTIONS=0
RUNTIME_READS=0
```

归档性质：主agent对 `/root/stage_b_extra_design_r5` 完整FINAL_ANSWER的结构化摘录，非逐字全文。原始NO-GO、severity、位置、事实与最小建议保留，原全文在本会话。审查者已completed、全程只读，无子agent写入。冻结SHA见r5-input，复算六项MATCHED；该结论仅对应修订前冻结字节。

## S1：后端返回最小FULL候选的装配标题

静态事实＋职责冲突，S；无Dexter产品/范围决策。附件§17原421明确“返回对应五事实及artifactRef/展示标题”；D95、Journey68规定标题由应用/类型/版本形成，并没有独立维护的工件名称事实。backend标准1-K115–119及owner-read规范45–59禁止taskread由两个以上事实拼接响应；此处非时点冻结、脱敏或机器复合串例外。

实际反例：operations StoreEditDrawer296–298以name/code结构化事实在前端NameCodeText形成label，foundation presentation/nameCode16–20同形；候选实体及分页不要求服务端label。其它B文字“标题”只是UI呈现合法，不能把所有标题或SQL内部搜索误报违规。

影响：将应用/版本呈现固化owner/canonical/generated返回，冗余事实并使前端排版牵动后端，设计与规范不能同时满足。

最小修正：响应仅工件identity及结构化app/kind/native/bundle事实，标题/label由feature生成。保留五事实server过滤、space、cursor、register重验、queryText既有搜索及16op，不加列/API/formatter/权限。CP01核canonical/generated无装配字段，CP05实际前端label与两页/回显/严格过滤反例。问题族为候选查询把消费者呈现写成owner字段；现review checklist逐响应来源核验，不加关键词门。

## 方案合理性与全批静态核验

主干合理；B只供给观察，无自动accept/prepare/NM调度/副机对象；A条件前置保留。两后台任务/PROJECT读写cap/NO_REPORT、stage解析/receipt重放及私有asset、16op/app事务/module边界、完整DB预算、锁/time/hash/完整snapshot/currentboot门、grant32锁保护、actual/reportACK和一次恢复、标准UI/唯一dirty/真实动作TestId、四工件八规则及seed父链、CP→6b→准入→13c均有设计。grant与门店scope疑问按原R05/07/09证据不足未报越权，不扩大要求。

四模板每槽实际读取：Journey1–7/6.1/actor/corpus/任务禁推；IA元数据/九面可见不可见/负载规模/权限观察/全错误；UIcanonical/九线框ownership/v2盘点/roster/输入依赖/每variant事实/搜索恢复/action理由/face看图；D0–14含19横切/第三方/3a/CPRECALL/逐op/跨owner/9a/10b.1–6seed/逐V/停机/13b/13c。owner动态字段、高保真demo均N_A有理由；不由作者自查表决定PASS。

独立verdict后完整读R4/intake：R4-S1按P105–114/D375、382确认CLOSED_DESIGN；API及两后台L2后另授权当前seed，再TER。dryrun/准入/历史seed不替代；缺授权保持OPEN。该修订未解除附件421，故原verdict不变。

## 实际读取与未验证

入口AGENTS/Blueprint/CLAUDE/两README；六kernel/deterministic，六维design/platform/backend/frontend-platform/architecture/task-start及operations补路由全部原文；本仓cs-review/cs-spec-to-plan/automation入口；四模板、适用coding/foundation/review/task/第三方/governance/acceptance/L2标准；正式需求/讨论全文、A三设计、六B全文。长输出已小段补读，不把截断当完成。

source限定owning函数与调用链：schema/builder/UpdatePort/updateowner/selectors/module/actor/nativeprovider/preparer；asset stage/claim/storage/public；IAM/read/context/scope/cap及terminal credential/controller；TDS topic/session/control/principal、TDC HTTP/ready/topic、storebasic loading/flush；foundation/cursor/真实两后台consumer、automation/runnerDEV分支、L2入口。未宣称全仓全文覆盖。

第三方只核给定静态官方依据与仓内声明，未安装/解析/联网验证；依赖/资源容量仍OPEN。实际UI布局/焦点/dirty/fileinput/TestId、HTTP/PG并发、撤权/报告恢复/分页/安装均NOT_RUN，未以此报finding。若已知问题关闭且UI仍未验证，只能GO_WITH_UNVERIFIED_UI，不能裸GO。原始本task已完成；主agent拥有intake/修订责任，不授予实施或运行权。
