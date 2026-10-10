# TER 阶段 C：project-basic 职责追加与作者处置

AUTHOR_SESSION=续接作者会话
IMPLEMENTATION_AUTHORITY=false
REVIEW_CYCLE_ID=TER-UPDATE-C-PROJECT-BASIC-OWNERSHIP-2026-10-10
INDEPENDENT_R1_VERDICT=NO-GO 0M/1S/1N（旧SHA）
INDEPENDENT_R2_VERDICT=GO_WITH_UNVERIFIED_UI 0M/0S/0N（当前六SHA）
AUTHOR_FINAL_DECISION=SELF_DECIDED GO_WITH_UNVERIFIED_UI
REVIEW_CYCLE_STATUS=CLOSED_AFTER_R2

## 1. 原话与变更范围

Dexter 2026-10-10 要求：在 C 新建 project-basic；项目版本规则属于业务数据，移入feature；原store-basic的项目、大区、集团资料一并搬入；project-basic有升级候选时发送terminal-update公开command，由其actor执行。随后明确要求对抗review，确保各包不越界。

同scope追加原话：“store-basic有了具体的store信息后，project-basic才去加载project信息，有先后顺序”。亲读TDC generated/terminalApi.ts确认OrganizationStore含id、groupWorkspaceKey、project.id；project前提必须包含具体门店值及当前保存成功资格，不能只凭激活、空值或hydrated标签首查。

R1报告返回后的同scope精确裁决：“store-basic有了具体的store信息后，发送自身的command，自身再去加载其他信息，project-basic收到这个command才去加载project信息，有先后顺序”。当前修订用同一个store成功command的两个owner listener；store自己的后续放进listener，project收到后才首查组织。最新裁决不在R1旧SHA verdict内。

只修订C六份工件及本轮review输入/报告/作者处置；不修改需求、规范、记忆、A/B文档、源码、测试或依赖，不读.runtime。旧C审查周期及其SHA/verdict不变。本次实质新增owner与搬移范围，单独建立上述限定cycle；不是第三轮旧cycle。没有实施或动态授权。

## 2. 亲读依据与最小方案

| 问题族/当前源码 | 已确认事实 | 文档最小处置 |
| --- | --- | --- |
| store-basic types/actors/slice/selectors/module | organizationPath、三个组织topic、projectStatus/projectRef仍在store；组织与合同共用loadOrganizationAndContracts | 搬资料及三个topic到project；合同留store，独立于项目成功；旧selector/descriptor删除 |
| terminal-update actor/module/types/slice | 全规则HTTP分页/hash/topic与ruleSnapshot仍在base | 搬业务链及测试到project；base仅一候选command→actor→实际比较/固定/执行/报告 |
| 两integration src/assembly/assembly.tsx | 当前读store组织/项目门给update，尚无project-basic | 新包安装与两个record同步，selector身份复核装配；不在integration选规则/HTTP/effect更新 |
| state persistenceHydration.ts、persistenceEngine.ts | 只hydrate已注册descriptor；普通启动不物理删除orphan，root reset清理 | 不读取旧键，真实HTTP重建；不为了搬移reset、不建回填层；已有fixed任务保持 |
| TDC slice与topic actor | topicSubscriptions不持久，accepted times持久 | 新Runtime按feature身份重订，复用逐通知接受，不建订阅迁移框架 |

可替代方案是只增project-basic规则包、组织仍在store，或把规则留base再注入featuregetter。两者与Dexter最新归属或command/selector约束不符，拒绝。采用搬移现有读取/校验/接受逻辑，不另造协议、HTTP、调度、候选账本或兼容层。

## 3. 六工件修改位置

- Journey：§1/§2/§3/§4新增数据owner、前提与local command链。
- IA：§1/§2.2补不可见资料加载、指令与投影；可见邀请不变。
- UI：§7补feature→base actor，其他可见交互不变。
- 详设：§0、CP表、§6/§7、§8.0/8.1/8.5/8.6、§9/9a.7、§10/§11。
- 计划：§0、CP-01/03/04/05/06、§10/§12。
- 附件：§2/2.1、§4、§6，列新包/旧字段与导出删除、测试搬移、两assembly同步。

## 4. 独立审查及处置

输入：2026-10-10-ter-version-update-stage-c-project-basic-review-input-codex.md。R1 fresh reviewer=/root/project_basic_ownership_design_r1，独立报告design-review-r1-codex为NO-GO 0M/1S/1N。作者亲读store actor:328–443/813–822、Runtime Promise.all:653–660及actor reentry:102–104，确认根因。报告和旧SHA保留，以下只是作者处置，不是独立GO。此前源码影响面agent仅定位，无DESIGN verdict。

| Finding | 亲验分类/最小方案比较 | 作者处置与当前位置 |
| --- | --- | --- |
| R1-S1广播等待阻断store后续 | CONFIRMED；原store在await广播后才加载服务点/合同，Runtime等待两handler。review建议安排project异步command可行，但Dexter最新指定同command两下游，将store后续搬入已有no-op loaded handler更直接，不需要后台调度/新增通知 | CLOSED（作者）；详设§8.0:174–183，计划CP-01:33/41，Journey§1/3，IA§2.2，UI§7，附件§2.1。广播可等待两listener，store下游在自己的listener已启动；project首查只在loaded handler。晚装请store现有initialize重发已成功command，双方运行态去重；handler不能回调initialize形成循环 |
| R1-N1 base筛选措辞 | CONFIRMED；171总表与具体feature单候选条款矛盾。仅改文字，比增加策略层小 | CLOSED（作者）；详设§8.0:171明确消费一候选、actual比较/准入，不做业务筛选/排序；§8.1、计划CP-01/03、其余五工件同根均已核 |
| R1投影资格提醒（非新增finding） | 已有失败/tombstone判据需要明确getEntries落点；Topology apply只证明传输，不证明业务ready | 已细化；详设§8.0:193/§8.6，计划CP-04、IA/附件。MAIN失败保留诊断正文但导出对应tombstone，BRANCH核entry身份及当前connection；不增第三状态entry/新协议 |

同根读回：首次store成功/失败、flush失败、具体projectRef校验、重复成功/晚装、Runtime重启、TDC重连、topic更新/接受、same-connection投影失败、fixed任务保持均逐项核对。两assembly只装配，store无project依赖，project→base公开command，base无feature依赖；六工件相同事实交叉读回。future focused写入CP-01/04：真实dispatcher保持组织Promise未返回时store后续可启动/保存；topic仍等待flush接受，不把独立listener规则泛化为ACK提前。当前没有运行这些验证。

R2使用新的fresh reviewer，只审当前新增owner范围及同根影响，限两轮后停止；旧C周期不重开。本作者不代写独立verdict。

R2=/root/project_basic_ownership_design_r2独立完成，未读R1报告/作者intake，重算六SHA一致，给GO_WITH_UNVERIFIED_UI 0M/0S/0N、DESIGN_GAPS=NONE（限定新增职责及同根影响）。报告在design-review-r2-codex；主agent核当前六SHA仍一致，未在报告后改目标工件。R1-S1两个listener修法及N1责任收窄经当前设计重新独立证伪，无剩余finding。两轮止，作者SELF_DECIDED采用当前独立静态结论收口，不宣称整体实施、真实UI或A/B验收通过。

## 5. 同根防再犯与未验证

主要预防落点为本次明确review checklist：逐一核project组织字段/三个topic/规则链、store合同与服务点、update task/actual/report、两个assembly依赖及投影、旧公开导出/descriptor/测试。失败模式是“把业务资料缓存及调度放进执行底层，或通过装配逃逸写权”；最小解是feature数据和候选command、base实际执行、selector只读。固定task.target属于接受后的执行事实，不应误删为事实副本；store DTO的project关联ref/标签也不作为独立项目实体权威资料删除。

R2输入六工件SHA如下（尚非独立GO；report绑定相同字节后才记录结论）：

```text
a84f9ab406c71c77bf2404f9164a81a575428d1b7ec1c7645688bb0d87b894fd Journey
038dbebbdf1bdcfb0c90733627a04d5f2df13f974c30b1ad93c730f91eaeb5be IA
f547b1df6a7aeb3ff3d7b74d361fd7465809834595d232bfa1a82cd57bfb49d9 UI
dff540b1f98daee11acac21a019ce2329eb7149b1e5eb2e2bd072a10bbcf5e26 详设
6335ebff3e4bc259fa10cdab423984a7e51ae6958d4b8b32f830604fc7f040db 计划
f65fd154f62c832e1ad64d9a99514b08985e479f44b9ff690430d3c838cde9e4 附件
```

A/B出口仍OPEN；本次C源码/生成/编译/测试/verify/Web/真机/VM/DEV/reset/seed/cleanup全NOT_RUN；IA内容确认不代表真实UI通过，旧动态或review结果不覆盖新增职责。
