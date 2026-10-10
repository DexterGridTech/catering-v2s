# Stage C project-basic：独立 DESIGN R1 报告

以下为主 agent 转录独立只读 reviewer 的结果；作者处置另见同日 design-intake-claude。此报告仅对应下列六份旧 SHA，不适用于随后修订字节。

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER-UPDATE-C-PROJECT-BASIC-OWNERSHIP-2026-10-10
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER=/root/project_basic_ownership_design_r1
INPUT_LIST=doc/review/platform/2026-10-10-ter-version-update-stage-c-project-basic-review-input-codex.md
BLIND_REVIEW=true
AUTHOR_INTAKE_READ=NONE
VERDICT=NO-GO
M/S/N=0M/1S/1N
EVIDENCE_TIER=READ_ONLY_STATIC
IMPLEMENTATION/TESTS/DYNAMIC=NOT_RUN
FILE_WRITES=NONE
```

## 1. 范围与方案合理性

Dexter实质增加project-basic建包、组织/规则搬移和command→actor链的新限定cycle。旧C周期保持closed，不继承旧verdict。R1已纳入“具体store成功之后才查project”的澄清；更晚的同command两listener裁决及修订由作者intake另记。

分包方向合理：project-basic拥有组织路径、三类组织资料、完整项目规则及业务候选选择；store-basic保留门店、经营规则、合同和服务点；terminal-update拥有本机actual比较、准入、固定任务、N/M、执行与报告。feature→base单向依赖，两assembly只装配公开selector身份适配。固定task.target是已接受执行事实，不能误删为第二规则cache。store DTO的project关联标签可以保留，不能冒充权威项目详情。

已静态核实具体store写入及flush门、Runtime等待全部handler、descriptor-only hydration及root reset orphan清理、TDC订阅不持久、topology apply/readiness。读取测试只证明断言存在，不证明测试通过。

## 2. S1：广播等待链仍耦合门店后续与项目HTTP

**性质：仓内事实＋普通反例推论；S；无需Dexter产品裁决。**

设计：`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:174–176`；计划`:32–33、41`。

源码：

- `apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts:425–434` await自身loaded command，返回后`:436–442`才派发服务点，`:443`才进入组织/合同helper。
- `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts:632、653–660`收集所有handler并await Promise.all。
- `createCommandActorDispatcher.ts:302–317、325–329、362`等待handler Promise；timeout只限制等待期限，不把业务广播自动变成后台工作。

旧详设规定project actor收到loaded后组织HTTP→flush→topic→规则HTTP，又承诺合同和服务点不等project，但未定义listener返回边界或搬移广播后工作。普通反例：门店已flush，组织HTTP未返回；project listener返回长Promise，广播不完成，原广播之后的服务点/合同不启动。组织最终失败也不能证明此前没有阻塞。

影响：业务资料分包后仍有执行耦合，不能满足组织慢查询/失败不挡合同和服务点。

**reviewer在该旧字节上的最小建议**：loaded listener完成前提核验后安排project自有initialize command并立即返回；每runtime/binding的in-flight不让广播等加载；复用既有PRIMARY-ready异步command模式（terminalUpdateActor.ts:1412–1457及terminalUpdate.test.ts:1771–1843），不用新调度器/账本。真实Runtime反例保持组织Promise未settle，观察广播完成、合同/服务点已启动，再释放组织验证flush/topic顺序。当前storeBasic.test.ts:177–270只调用单包handler，不能证明多listener等待。topic接受仍须等待成功flush，不能泛化成异步接受。

本建议保留为历史review输入。随后Dexter明确同一command两owner listener，作者应比较并采用该更直接方案，而不是把review建议升级成新权威。

## 3. N1：base职责表“筛选”歧义

**性质：文档事实；N；无需Dexter裁决。**

详设`:171`称base“消费ready规则和资格后按本机actual筛选、比较”；`:180、184、192`则规定feature选一条业务候选，base不读整个列表或主动选择规则。其余位置正确，没有证据证明作者有意保留第二个业务择规则者。

影响：实施可能据总表回到旧base业务规则provider。

最小修正：消费feature提交的一条候选及当前资格，读actual、比较、准入、固定和执行；项目/门店/App/排序属于project。无需新机制。

## 4. 同根扫描与未验证

S1已核正常广播、initialize/晚装、Runtime重启/非持久readiness、门店失败旧helper、topic接受、固定任务PRIMARY-ready负控制。门店读失败分支`actors.ts:378–379`的旧组织/合同调用须随搬移删除，不能原样成为project首查许可。

N1已核职责表及详设180/184/192、计划34–35/58、Journey20/48、附件43–47；只有171措辞需要收窄。

**同connection主机失败保留旧正文的投影**：不新增第二S，现详设182/258及计划70已有禁止旧规则择新、blank/tombstone要求。最低实现落点为project getEntries按业务资格导出value/tombstone；副机同时核entry有效性、值身份和connection apply。topology sync controller:168–205、355–395和readiness selector:19–27不自行判断业务ready；store slice:132–146没有通用失败自动tombstone。加入同连接已成功→MAIN刷新失败→SLAVE新boot不能择旧规则、fixed目标保持的focused观察即可；不新增第三状态entry或同步协议。

旧cycle措辞不列finding：Journey:13已分开新owner scope；计划11/131的“不重开”可明确指旧Ccycle。

新包、搬移源码、类型/测试/编译、Web、Android/pair、真实UI、business/cleanup全部NOT_RUN；不以未运行作为新增阻断。

## 5. 四模板覆盖

| 模板 | 实际逐节结果（存在≠通过） |
| --- | --- |
| Journey | §1元数据、2任务、3前提、4边界、5corpus、6后续工件、7裁决存在；6.1后台引用继承B，TER提示不适用AntD Drawer |
| IA | §1元数据、2.1九可见、2.2五不可见、负载/UI、3资源权限、4错误、5交叉引用、6完成条件存在；真实UI NOT_RUN |
| UI | §1 canonical槽、2 map、3资产、4线框/控件/TestId/焦点、5状态、6合理性、7owner、8B4/B5、10看图存在；表单/动态明细/候选N/A，有非表单理由；9高保真可选N/A |
| 详设 | §0授权、1方案、2CP、3横切、3a准入、4门、5操作规模、6owner事实、7传递、8行为、9API、9a同步、9b正本、10迁移、10b.1–6数据角色权限资源、11/11a判据、12OPEN、13/13c对账、14自查存在；S1属已有行为节缺口，没有整节缺项 |

## 6. 实际输入声明

reviewer全文读取输入、AGENTS/CLAUDE/BLUEPRINT/platform README/scripts README、index全部六kernel及deterministic原文、六C工件、正式update/TDP需求、四模板、implementation-task/terminal/review/foundation/third-party规范、verification/governance/corpus decision及本仓review/memory skills。未读作者intake。

六维：`scripts/memory/query --task-kind design --domain platform --consumer-face backend --owner frontend-platform --impact architecture --trigger task-start`。22命中原文全部读：六kernel及corpus、http-crud-redlines、owner-read-model、corpus-adoption/parked、conversation-not-system、invisible-dimension、platform-detail-reverse-inference、backend fixture oracle、collection-boundary、consumer-ordering、terminal规范/architecture/build-order、input、third-party官方依据。verification-governance原文补读。corpus检索项目/大区/集团/终端/版本，不反推新模型。

适用源码：store types/actors/slice/selectors/module/commands/index/deps/invariants/package全文；test1–481、731–925。update公共形状全文，actor430–762、1080–1593直接规则/固定/handler范围，test301–692、1263–1350、1610–1879。两assembly/deps/package全文，ownerStageRegression console1–414/wallpaper1–241，projection测试923–942/826–845及console2307–2336。Runtime dispatcher/actor等待完整相关链，TDC topic函数1635–1995及generated DTO，state hydration/reset、topology sync/readiness相关函数。

A/B仅读本scope owner/规则供给/command/事实固定/生成接缝；不重评未改native和后台Drawer。frontend读3D–F及设计review，backend读owner/API/事实/集合/R-READ。路由Heritage TER建设/skeleton/base1适用原文读回；邀请/catalog/backend性能无本scope改动，N/A。无逐点实施/focused证据，因为本次无源码写入。所有未读范围明确排除，不冒充全仓逐行覆盖。

reviewer补充身份事实：最新“同command两listener”在原R1 final之后收到，不在该verdict内。全局 `/Users/dexter/.codex/memories/MEMORY.md:119–121`只用作源码/规范导航，对应registry127的rollout id为01a0bcbd-ea7b-7120-8e4d-6794514eae63；未打开该rollout原文，未引用历史PASS。判断仍依当前仓内原文。

## 7. 被审SHA与结论

```text
ec3c5c747d8ee34b4a5d5a9f49bd874865d2bcb4bc57eb1456e3642921c06b4c Journey
50754082315ff7ffd33063e7d74eee2e03a8f0ccdea135b552655f2ec893c357 IA
d4bffe9fbd198ee0cdc38e4ee837afb62894ad817d898dadf3200ea47e31f461 UI
e719e44f1ad9267c4309828757fa8ed10e0801e8b57f1c52724e57ee91ddeabf 详设
eafa2fc1585c68f148584d96f585a5fe0da055bd6e707fee379278bc95212440 计划
4928293c1c9818301be7fc0d0b181b58d19c7d5059a84bd6d89b1f5cbd3a2072 附件
```

```text
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0M/1S/1N
L1_ENGINEERING=S1 awaited广播与项目加载独立性未闭合；N1 base筛选措辞
L2_USER_VISIBLE=组织慢查询可能推迟门店合同/服务点；真实UI NOT_RUN
L3_UNVERIFIED=新增实施/测试/动态/cleanup NOT_RUN
DESIGN_GAPS=S1缺listener返回边界及真实dispatcher反例；无新增整节模板缺口
EVIDENCE_TIER=READ_ONLY_STATIC
```

S1是明确设计阻断，不能以UI未验证标签改为GO。报告交作者intake，不授予实施或运行权限。
