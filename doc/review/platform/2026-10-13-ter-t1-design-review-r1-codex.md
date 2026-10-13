# TER T1 实施详设与计划 · 第一轮独立静态审查

由主agent保存 `/root/t1_design_blind_r1` 返回的独立结论、findings和实际读取披露；作者不以本文件替代自己的后续intake。reviewer未写文件。

```text
REVIEW_CYCLE_ID=TER_T1_IMPLEMENTATION_DESIGN_20261013
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-13-ter-t1-design-review-r1-inputs-codex.md
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/3/2
L1_ENGINEERING=S-1/S-2/S-3
L2_USER_VISIBLE=STATIC_DESIGN_ONLY；未发现新增用户操作；既有行为保真尚未运行
L3_UNVERIFIED=C/F/W/D、真实UI、native classpath、business与cleanup均NOT_RUN
SAME_ROOT_SCAN=见各finding
DESIGN_GAPS=HTTP context身份来源与native reload依赖闭包；其余见N项
TEMPLATE_COVERAGE=见模板对照
EVIDENCE_TIER=当前源码与文档静态读取
IMPLEMENTATION_AUTHORITY=false
AUTHOR_INTAKE_READ=false
PER_CHANGE_PREWRITE_POSTPROOF=N/A_WITH_REASON:本轮是设计审查，无实施变更
```

盲审声明：本轮从 v2s 仓根以 fresh 独立上下文开展，先证伪需求、设计对象和真实源码接缝，再形成本报告。没有读取作者 intake、采信历史 verdict、委托其他 agent、写入任何文件或执行生成、编译、测试、verify、动态环境。本报告也不是未来 TEST_CHAIN_PREFLIGHT 的完成证据。

## 1 · 冻结对象

| 对象（doc/plans/platform/） | 亲算 SHA-256 |
|---|---|
| 2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md | b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e |
| 2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md | 8d3537359bd2f0ff838a65c4f5d25d14e9bb097a56a8f68d4512c9ceee9457ed |
| 2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md | 8c088ebc94a04e00294c8b1c3411b20ea9bb2cc2fcb122085d23c54063bc80d1 |
| 2026-10-13-ter-key-code-structure-t1-owner-and-source-appendix-codex.md | 28b37417a22d7bf2c6e51176dee665ca4767f2b850cf712e8187aceb8a926809 |

## 2 · 方案合理性

真正任务是降低维护者跨App补名单、追踪行为和辨认事实owner的成本。只搬actors.ts无法解决装配双写、API集中归属和固定地址集合；增加自动扫描、全局catalog或新module DSL会制造隐含加载与第二真相。

显式加载concrete definitions、沿现Runtime/State派生描述、UI包提供自身贡献、业务owner使用私有generated client，是合理方向。包内资源仍由一个安装闭包持有、资格与readiness分离、地址按名字整组替换，符合需求。

更小替代：保持上述目标，只复用现有凭证revision、Runtime context和原生reload owner，补齐接缝，不引入新的身份计数器或宿主框架。三个S均可这样修；不要求回退为仅搬文件，也不要求SDK、容量或极端故障专项。

UI贡献有批准Journey来源；active-success不加按钮或计时，integration仍决定阶段，安装邀请仍PRIMARY，副机断链保留admin。新UI三模板有据N/A，既有回归非N/A；真实渲染/输入/一致性未运行。

## 3 · Findings

### S-1 · 同步资格使用不存在的方向枚举

- 详设:157：资格类型使用`main-sync|branch-sync`。
- 源码：`apps/terminal/kernel/base/state/src/types/sync.ts:4`真实枚举`isolated|master-to-slave|slave-to-master`；`topology/src/application/createTopologyStateSyncController.ts:139/172/204/304`直接消费真实方向；TDC `features/slices/terminalDataClient.ts:343`。
- 事实：签名没有转换规则或canonical变更。按字面施工类型不合；cast绕过则发送比较不命中、接收方向不成立。MAIN/BRANCH是workspace，不能替换同步方向。
- 同根：检查State定义/registration、Topology收发、TDC credential registration和两App名单；新literal仅详设157，其余要求保持方向。
- 影响：CP02资格→投影/readiness断链。
- 最小修正：`Exclude<SyncIntent,'isolated'>`从实际registration派生，字段同controller；focused验证registration→qualification→wire。防再犯落既有State/Topology tests＋review清单，不新增catalog。
- reviewer建议`CONFIRMED`；无需Dexter产品裁决。

### S-2 · HTTP context 的Runtime ID来源未闭、重复凭证epoch

- 详设:173/175，计划:37：纯selector只有state/businessServerName，却输出runtimeId及新authRevision。
- 源码：runtime `application/createRuntime.ts:353`ID由closure产生，`types/module.ts:73`及`foundations/createRuntimeLifecycle.ts:60`通过Context传递；runtimeInstanceMode slice只有mode。TDC `features/slices/terminalDataClient.ts:118/144/318/338`已有sync/替换/解绑递增的非persist/non-sync credentialRevision；actor:1350/1492/1586已有HTTP fence。
- 事实：纯selector输入没有Runtime closure的ID来源，可能逼实施者增加全局getter/closure/第二状态。现credential epoch已有真实用途，新authRevision没有证明不同事实必要性。
- 边界：把现revision投影为无secretcontext合法；若要相同credential重投也失效必须说明来源，否则不改产品语义。Runtime ID可由actor/module context显式组装，不存业务slice。
- 同根：已查TDC替换/sync/解绑/readiness/HTTP、Runtime ID定义/传递/状态；设计未引用现credentialRevision。
- 影响：五APIowner依赖接缝无法保持selector纯度和身份单源。
- 最小修正：selector只读现revision/身份/角色/config；executor从ActorExecutionContext.runtimeId组装请求，TDC对自己context比对；删除第二epoch。明确reset/unbind/samecredential/replacement反例。防再犯HTTP context清单及TDCfocused。
- reviewer建议Runtime来源`CONFIRMED`，新epoch必要性未证应优先复用；无需Dexter，除非要改变相同credential行为。

### S-3 · app-control迁包未关闭update reload依赖

- 详设:195–197，附件:106，计划:46–49：新app-control adapter迁TS/Kotlin。
- 源码：`application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalAppControlModule.kt:7/16`→`adapter.android.update.TerminalUpdateProcess.reload`；原build.gradle显式update项目依赖；`adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateProcess.kt:13`转同Runtime；`tools/terminal-skeleton/check-static.mjs:888`adapter图只允许platform-ports。
- 事实：reset是现受控reload/后继Runtime观察的复用，迁包需要真实adapter→adapter classpath。未决定合法绑定/归属；“同步Gradle”不回答责任。未运行Gradle，不声称实测失败或必然循环。
- 同根：三新native能力、两Apploading；特定update reload边只有app-control，network/topology无相同reload边。
- 影响：CP04被迫自由选择加依赖/复制reload/改归属。
- 最小修正：有限选择保留reload owner，由application窄基础设施绑定；或保留App生命周期协作于application/base，只迁真正独立资源。明确Kotlin/Gradle/Expo consumers/旧文件。不要通用host-runtime/第二ReactHost/第二boot。防再犯核真实Kotlin/classpath的review清单。
- reviewer建议依赖闭包`CONFIRMED`，必然循环不成立；无需新产品裁决。

### N-1 · payload cache 的apply失效粒度

- 详设:159写同引用稳定且reset/apply/dispose清cache；controller:183/184/186引用去重，Topology module:709每次state变化发送，controller:364调用apply。
- 推论：若每次apply全清，未变反方向payload引用改变，会绕开无变化/失败引用抑制；新实现尚不存在，不声称已发生反馈循环。
- 最小修正：按slice缓存，apply仅影响对应slice，reset/dispose全清；无关入站apply不改未变出站引用。force/reconnect为允许重发反例；不需deep compare/new revision。
- reviewer建议`PARTIALLY_CONFIRMED`范围未明；无需Dexter。

### N-2 · Web更新业务步骤所属CP和落点概括

- 计划:78/90，详设:269；runner.ts:101当前Web update只支持update.artifacts，supply-chain/pair是Android。
- 事实：文档正确区分artifact≠W业务，但“缺必要步骤就补当前suite”没有精确共享步骤与oracle。
- 最小修正：在CP03/05写定当前suite/sharedhelper证明project candidate→fixed、grant/report状态/receipt，F/preflight→W→同清单D。installer/capture/pair适用adapter例外，仍唯一runner，不扩矩阵。
- reviewer建议`CONFIRMED`步骤落点，不是未运行finding；无需Dexter，环境/数据权限仍另定。

## 4 · TEMPLATE_COVERAGE

| 模板槽位 | 判定 |
|---|---|
| 详设§0/1/2 | 有元数据/授权、真实任务/替代、完整6CP |
| §3/3a | 固定机制/有据N/A；既有任务与driver清单，真实节点待未来proof |
| §4/5/6 | 反例/15JSON与binary排除/生命周期；S2/S3未闭 |
| §7/8/9 | 传递/17R18V定位/API，但新增来源需修 |
| §9a/9b/10/10b | 同步面/symbol定位/持久保留/seed角色齐全 |
| §11/11a/12 | 有，N2细化W；native actual graph诚实OPEN |
| §13/13b/13c/14 | 日志未来门、完整CP、全批、所有改动行、selfcheck有 |
| Journey§1～7 | 新工件N/A无新用户任务；原三组Journey保真输入 |
| IA§1～6 | 新工件N/A无新交互权限集合；不能因移包删旧判据 |
| UI§1～10/控件表单搜索mutation | 新工件N/A无newscreen动作；节点/TestId/文案/焦点仍保持 |

结构槽位齐全不能覆盖3S/2N，不据存在宣称GO。retired compliance不恢复。

## 5 · 静态支持与未验证

支持concrete派生、UI在UI、bundle原子替换、资格≠required、五owner API、canonical单源、地址具名替换、持久/native身份、现runner/完整CP顺序。亲枚举39功能包＋根，与附件一致；新增panel/三adapter是目标非现成。计数不是逐分支审计。CLI与parser相符但Webartifact按N2受限。设备serial/data/DEV/seed/readiness/classpath为未来前提。

C/F/W/D/DEV/L2/UAT/生成/编译/测试/verify/business/cleanup全部NOT_RUN；本身不计finding、不授权运行。不读.runtime，不升级旧proof。

## 6 · 读取披露

真实读取清单在同轮inputs文件；入口与6kernel、全部26 routed hits、适用sourceRefs、四模板、原需求/讨论/三份对象及当前production/driver接缝均读取。Corpus搜T1/终端/主副机/主机/副机/terminal/TER，TER宽词MATERIAL_ITEM子串不算命中；终端结构术语NO_CORPUS_ENTRY_MATCHED，组织/后台/空间按G01/02/03/05/10读回。

原激活/配对、更新C、远控Journey/IA/UI适用部分读回；不以旧凭证/日志约束覆盖后续裁决。没有逐个UI叶子/native所有分支全量语义审计，无运行classpath/控件画面/cleanup；附件能力组不是这种证明。不读作者intake/外部POC运行输入。

## 7 · 收口范围

本轮仅绑定上述SHA，NO-GO 0/3/2。作者逐条重开source辩证intake、比较更小修正，第二位fresh做同cycleR2。不得换文件/hash重置cycle、加第三轮或推导实施授权。目前无需新产品裁决，运行授权仍缺。
