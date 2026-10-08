# 阶段 B 项目双 Tab 范围：独立 DESIGN R1

REVIEW_CYCLE_ID=ter-version-update-stage-b-project-tabs-20261007
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER=/root/stage_b_project_tabs_design_r1
INPUT_LIST=doc/review/platform/2026-10-07-ter-version-update-stage-b-project-tabs-design-review-input-claude.md
VERDICT=NO-GO
M/S/N=3/4/0
EVIDENCE_TIER=READ_ONLY_STATIC
IMPLEMENTATION=DYNAMIC=NOT_RUN
CLEANUP=N_A_REASON：未启动任何受管资源。

主 agent 归档 reviewer 的结论与 findings；严重度保留原建议，最终由 Dexter 裁定。这不是作者 verdict。完整原返回保留在上述独立 agent 会话；以下结构化节录不修改 finding 的事实、修法或数量。

## 1 · 读序与输入

reviewer 先读原需求、规范、六维命中记忆与真实 source，后完整读取 B 六工件，未先读作者 intake 或旧 cycle verdict。输入清单类别1～8全部读完；大型源码按完整相关实现单元和调用链读，不宣称仓内无关源码逐字覆盖。没有写文件、运行生成/编译/测试/verify/DEV/设备/浏览器或读取 .runtime。

被审 SHA 以 input list 最终六工件表为准。原返回中的 UI hash 转录少了字符；主 agent 只核对输入清单中的64位摘要，不将其擅改为新审阅字节。原返详设 b5c8efe5…、计划15950c90…与其余输入均对应该冻结截面。

## 2 · 原始 findings

D=doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md；P=同目录 implementation-plan；Apx=同目录 source-and-api-appendix；UI/IA=doc/decisions/2026-10-07-ter-update-supply-and-version-report 对应文件。行号均是 R1 冻结字节。

### M1 二进制 content 与 JSON-only TDC 生成边界

事实：D:125–127分JSON snapshot/grant与binary content；D:133仅grant认证；D:294却将三者放入终端生成消费名单。scripts/generate/terminal-client-api.mjs:100–103、123只提取JSON成功schema，247–258要求完整JSON request/response，252–254只按TERMINAL_CREDENTIAL选既有security，595–625为JSON执行路径。

反例/影响：binary/grant-only进入现有JSON白名单会失败；伪造JSON或credential会改变协议。这是静态消费缺口，不要求现在运行。

最小修法：snapshot/grant进JSON闭集；content不进JSON executor；canonical path/header/error经明确现有生成接缝到native source，点名policy/generator/native改动及误入必红。不建第二HTTP服务。无需Dexter产品裁决。

### M2 16项 operation 缺逐请求设计契约

判据：project-memory/decisions/http-crud-efficiency-design-redlines.md:204–217要求逐operation有序逻辑、条件→typed problem、调用/事务、具名normal fixture准确request-local计数含全部前置；228–246要求operations command的具名REQUIRED handler，context在事务内而非edge构造。

事实：D:112–133只有路径/face/部分错误；Apx:67–84合为8组，73把身份前置另计，71把normal上界留CP01；D:140–144事务原则未逐项绑定handler。

影响：组内operation真实receipt/CAS/readback/身份成本不同，组级声明不能验证遗漏或重复；不要求削弱正确性或现在测量。

最小修法：16行紧凑表，每项具名normal fixture、准确预期count与读写分解、有序错误、调用及事务起点；共用步骤可链接，最终集合/数字/origin可还原。无需产品裁决，除非另外申请预算例外。

### M3 首次 L2 完整 seed dry-run 门被缩成 reset 条件

事实：implementation-task-template.md:214–224约束首次L2/reset/seed四项齐全（含当前完整seed dry-run），backend acceptance豁免。P:90、D:234仅绑定未来reset。

反例：只获L2授权、没有reset授权时可跳dry-run。最小修法：恢复三种动作首次均需四项；dry-run不授权真实seed/reset；backend acceptance保持豁免。本轮不运行。无需产品裁决。

### S1 逐CP RECALL与形态理由缺失

判据：implementation-design-template.md:145–155每CP错误形状/不变量/FORBID/比例验证/形态理由/RECALL。D:104–106统一纪律、P:29–85工作与出口没有精确逐CP RECALL及理由。

影响：实施时临时推导原文与形态，不利阶段独立对账。最小修法：六行现有材料/锚点门控表，不加hook/receipt。无需产品裁决。

### S2 报告仍残留 STORE/旧TestIds/EXPAND

事实：UI:168 STORE detail授权，136 EXPAND；Apx:137既有S组织终端TestIds，160 STORE_TERMINAL_REPORT_FACT。与D:129、288，IA:64–65、Apx:157–158 PROJECT标准Drawer冲突。

影响：旧授权/旧组织组件/不存在的展开动作可能重新消费。最小修法：唯一PROJECT task-read、TITLE(ref)→标准详情Drawer、O TestIds；六工件同根扫旧STORE/EXPAND/Card，仅保留说明禁旧方案的文字。无需产品裁决。

### S3 输入/command fact/搜索动作矩阵仍分组

判据：UI模板252–265每输入来源依赖状态再核验；267–292每variant每fact分类；308–370每搜索条件/候选协议；378–392每visible action任务。

事实：UI:152–156全局搜索；IA:61、75、81已有重要依赖；Apx:141–158动作DOM已较充分，但162–170多fact在一格；UI:164只有三任务族，N/M/说明/日期/名称等无完整逐输入槽位。

影响：FULL/HOT条件字段清除、省略、启停对象/action/revision/proof不能逐项验完整。最小修法：现有roster补逐输入、逐request fact分类、每搜索来源及每visible action任务链接；共用分页/关闭理由但显式映射。不加新表单。无需产品裁决；默认状态仍候Dexter看图。

### S4 全链同步/方法消费者/验收映射精度不足

判据：design模板207–220每事实全链、控制面/seed角色各行；200–205方法到精确caller；302–312及task模板70–72逐V→具名ID→执行面。

事实：D:215四组摘要、D:211 API族；Apx:106–117部分V写适用差量/HTTP/focused未具名。seed测试路径也只及其tests。

影响：无法沿同一表核对测试/fixture/generated同步或逐场景回填。最小修法：事实同步、API caller、逐V具名测试三张紧凑表；无B行为精确N_A_REASON且归A/C，不新增业务或重跑不受影响A。无需产品裁决。

## 3 · 模板覆盖（reviewer原判断节录）

| 模板 | PASS_STATIC 实质内容 | PARTIALLY/MISSING |
| --- | --- | --- |
| implementation-design | 元数据/目标/CP总览/第三方OPEN/准入状态/声明消费/owner规则/迁移/seed状态角色父链/具名HTTP场景/未决/停机/双读/CP与6b/13c | 每op契约与budget、binary；逐CP门控RECALL；逐控件；方法caller；9a事实分母；seed精确tests；部分V具名ID；9b锚点 |
| implementation-task | 原需求source先读、批次范围、逐点/阶段/6b/13c、唯一写入、首败/cleanup、Web先设备/同清单、UI先L2scripts | 同上述缺槽，首次L2/reset/seed四项准入 |
| Journey | 元数据/用户任务/前提/边界/corpus/交互工件与层级 | Dexter接受仍UNSET，不作缺陷 |
| IA | 可见/不可见/容器/来源/集合/两页标准控件 | 完整error按M2；交叉对账受S2冲突 |
| UI | 标准槽/两页surface/语汇/Heritage/线框/搜索统一协议/状态边界 | 输入依赖、mutation fact、逐搜索、逐动作；旧report残留；DOM未运行UNVERIFIED |

所有 PASS_STATIC 仅文本静态可接受，不是工程/用户行为PASS。旧compliance manifest/high-fidelity/definition-driven字段均有N_A理由。

## 4 · 已认可方向与同根范围

B供给/观察不偷做C；A交接条件化；非持久STORE/PROJECT各HTTP/flush门与晚composition方案、typed query接缝方向、PROJECT读/写分离、snapshot/time、报告有限ACK、短期grant/privateasset/事务外stream、标准容器、真实四工件八规则seed、CP→6b→整体→13c及唯一driver/Web先Android方向均静态成立。

同根分母：snapshot/grant/content三consumer；16HTTPop及WS报告；全部首次动态门；六工件STORE/PROJECT/EXPAND/TITLE/Card/Drawer；四模板与task模板逐槽。最小解为有限设计表与反例，不新建台账/hook/registry/runner/兼容层。

## 5 · 收口

L1_ENGINEERING=findings M1/M2/M3、S1/S4。
L2_USER_VISIBLE=findings S2/S3；只有两个内容页，九个页内交互surface。
L3_UNVERIFIED=DOM/TestIds/焦点dirty/layout/scope权限/完整供给/native下载/实际生成编译/完整dry-run与cleanup均NOT_RUN。
DESIGN_GAPS=M1二进制消费；M2逐op；M3首次L2门；S1/S3/S4有限模板分母。S2为已明确判据下的矛盾。

已知静态must-fix存在故NO-GO；关闭后仅UI未验证应GO_WITH_UNVERIFIED_UI，不能裸GO。独立review本轮已完成，无资源剩余，不授予实施权限。
