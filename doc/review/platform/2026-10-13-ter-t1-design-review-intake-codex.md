# TER T1 详设与计划 · 作者辩证 intake

REVIEW_CYCLE_ID=TER_T1_IMPLEMENTATION_DESIGN_20261013；REVIEW_TARGET=DESIGN；两轮上限。需求cycle已结束不重开；本文件不是独立verdict。

## 1 · R1 输入与处置

fresh reviewer `/root/t1_design_blind_r1` 独立NO-GO，0M/3S/2N；原SHA/verdict见r1报告，不改写为当前GO。作者收到后重开各owning source和更小替代，以下只标文档处置，不是实现PASS。

| 项 | 亲核事实/反例与classification | 最小修正、当前位置 | 处置 |
|---|---|---|---|
| S-1 | CONFIRMED；State真实SyncIntent，controller直接比较，MAIN/BRANCH并非方向 | 详设§8.3:176用Exclude<SyncIntent,'isolated'>；不转换协议；registration→qualification→wire的现State/Topology focused防再犯 | CLOSED（文档） |
| S-2 | CONFIRMED；Runtime ID不在state，现TDC credentialRevision/readiness已用于替换/sync/unbind/fence | 详设§8.4:192与计划CP03；selector只现scope，ActorExecutionContext.runtimeId另组expectedContext；删第二epoch、同credential字段比较；现TDC/五owner并发/迟到tests | CLOSED（文档） |
| S-3 | CONFIRMED；nativeAppControl确调updateprocessreload，独立新包不满足ports-only真实图 | 详设§8.6:214–218、附件§2.3/§10；更小选择同资源归既有update adapter，两个真正network/topology包；网络/peer纯类型迁ports，不隐藏nativeclasspath、不复制reload | CLOSED（文档） |
| N-1 | PARTIALLY_CONFIRMED；“apply全清”解释可破坏去重，但尚无新代码bug | §8.3:178写只changed目标slice/no-op保留/无关slice不失效，reset/dispose才全清；保留force；不建deepcompare/newrevision | CLOSED（文字歧义） |
| N-2 | CONFIRMED；Webartifact仅构建、runner现没有Web业务updatecase | §11b:338及CP03/05/06具名updateOwnerFlow.ts和现update.owner-flow注册；真实CBS/候选/grant/report，fixture只port、不sourceProvider；W→D共享步骤 | CLOSED（设计，不是已实现case） |

同根：真实方向全部收发/registration已核；TDC credential replace/sync/unpair/ready与HTTP fence、Runtime context全组已核；native network/topology/AppControl的Kotlin/Gradle依赖已核，不误称其他两类有同reload边。资格与required、scope与Runtime ID、platform raw接口与业务gateway均保持独立，不借修订合并身份。各项采用**既有测试或明确review清单**一个主防再犯目的地，未新增万能门。

## 2 · 作者同根补漏（非独立finding）

- 原ServerConfigPanel.tsx:364仍有add按钮 `<4`，与R11同根：详设§8.7/附件§6/CP04一并删除，测试真输入1/2/10，owner合法性不放宽。
- ErrorCategory真实闭集没有DOMAIN：详设§8.5/11a改BUSINESS/VALIDATION/AUTHORIZATION，构造Error/PortResult分别保持。
- HTTP空body与JSON null不能同形：§8.4明确empty/json discriminator、not-delivered只能确定发送前；超时未知不盲写重试。
- 业务session/helper不迁到application业务实现：放actors/shared，Runtime/State基础设施生命周期是合法入口；UIfactory明确三个UI层prefix及实际kind，无真实贡献不造module。
- 当前无server-config-panel workspace：附件标它是目标新增；原39功能包不混入目标计数。App目录和seed路径按当前源码纠正；规范TestId namespace按逻辑screen保留，不另copy字符串表。
- 全15operation方法/path/status已从当前canonical读回并附§9。typedUpdateFixture sourceProvider会绕project，因此新Webcase只port、仍生产candidate绑定。

这些补漏全是CONFIRMED静态source/类型事实；不因此声称已改生产代码。共同防再犯是现配置/类型/source-owner review清单，不新增恢复框架。

## 3 · Dexter补充规范/记忆授权

在R1返回后，Dexter明确要求“把此次优化的内容形成记忆和规范，后续新建包必须遵守”。只修改`doc/platform/terminal-coding-standard.md` §7.1/TR-R06/§8和既有routed memory指针；不复制正文到memory、不开新动态catalog/registry，不手改generated memory index。T1目标/产品语义未变，R15原已包含正本同步；本次增加允许文档写入与R2审阅对象，不重置cycle或规避两轮。

规则生效与现代码分开：新包遵守已确认目标，但检查器/脚手架/factory尚未实施，交付新包前必须闭合真实能力/机械红例，不把规范当编译PASS或留下永久legacy。没有修改源码/测试/脚本/依赖/正式需求，所有生成/运行NOT_RUN。

## 4 · 送R2的冻结当前字节

| 对象 | SHA-256 |
|---|---|
| implementation-design-codex | cedd80d0fc7f98dff28f3bc5c88913921d92c8ad3be8dd63b245681e50cddd2b |
| implementation-plan-codex | 7933db27973d4ce589d1fb4a919d950498de4ec2a9fe05f7391ac212fb8b0c01 |
| owner-and-source-appendix-codex | 8eb8bf83f138dc0cdbfe81208ffe03d170b1c679893f4b251877d142e2cd1f36 |
| doc/platform/terminal-coding-standard.md | 94b0fcbccb82564b0c50cf5cce19cf7826ef99424f854ee926e07740f0173689 |
| project-memory/operations/terminal-coding-standard.md | a127b502d244c1c495255a91fefc461b6bec54f3f140fc09ac3ef536d22f7da7 |

正式需求SHA仍b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e。当前行号随文档可漂，章节/精确symbol为锚点，不能维护第二源码哈希真相门。

以上是送R2时的冻结记录，彼时尚无结论；R2返回及后续修订另见下节。五项作者CLOSED不代表独立GO；C/F/W/D/native actual graph/真实UI/business/cleanup全NOT_RUN，实际运行授权OPEN，不伪造历史green。

## 5 · R2最终独立结论与作者处置

fresh reviewer `/root/t1_design_blind_r2`先形成NO-GO，0M/2S/0N，后读R1/intake，正式报告与inputs均由主agent保存。ROUND_FINAL_DECISION=SELF_DECIDED由reviewer给出；作者不以此自判GO。同cycle两轮已关闭，不换reviewer重开第三轮；下列修订后的字节尚无独立verdict，交Codex外部静态复核。

| 项 | 主agent重开事实、classification与更小替代 | 当前文档位置/处置 |
|---|---|---|
| R2 S-1 | CONFIRMED；render props.ts:55函数无partKey、:142是Record，LayerStack:221按partKey查，三个feature均有真实owner dismissal map。保留已有Record比新条目DSL小；不由App重补名单 | 详设§8.2:168/170；计划CP02:27/31；附件§11:242。贡献保留带键map、逐键重复拒绝、整bundle替换、真实back/backdrop/retry focused。CLOSED（文档） |
| R2 S-2 | CONFIRMED；automationFixture.ts:129prepare返回source但:138action固定targetArtifact，update actor:993/:1443准确拒绝publication mismatch。只修改现fixture；正常串行准备只需当前prepared记录，不新工厂/任务账本 | 详设§11b:342；计划CP03:41；附件§11:243。prepare→实际artifact→apply/readAction→精确release，kind/task/action/publication一致，非全a/FULL-HOT正反focused；真实sourceProvider不注入。CLOSED（设计，非已实现） |

两项均无需Dexter产品裁决。同根已逐一回读render/三个UI producer/两integration/assembly、fixture两test-expo消费者/UpdatePort类型/生产apply及readAction；DefinedPart和variable有自身identity不是同根错误，native真实port不属于synthetic身份问题。新版类型/合并/步骤在三设计文件一致；规范/memory不因此另设规则正本。

防再犯review清单（有限技术适用范围）：
1. **迁移声明丢关联键**：把owner贡献搬到包内时，核生产lookup的键住址和失败fallback；别因函数可放数组就丢part身份。最小解是保留现带键形状；合法反例是成员本身已携带identity的数组。实施期落现LayerStack/integration focused。
2. **把成套假fixture拆一半接真owner**：平台替身的prepared/action/readback必须来自实际输入artifact，不能沿旧synthetic target。最小解是现fixture一个当前prepared记录；不修改生产身份校验。合法反例是旧synthetic sourceProvider与其fixture成套运行。实施期落现fixture/direct tests；Web不证明nativeboot。

这份清单是设计/后续review判据，不是测试执行证据。无源码、测试、脚本、依赖或需求正本修改。

## 6 · 两轮内部审查收口时的交付SHA-256

| 对象 | 当前SHA-256 |
|---|---|
| implementation-design-codex | d0de84daa9fca5aacc4a1d91f9f7e5aebed3a3da27f9cc8fb175b086b31939c4 |
| implementation-plan-codex | 284164bd74721a3b2ef50cd4da84032b5dd1d42db7cad9ea805de5ad1a12a13c |
| owner-and-source-appendix-codex | c75f3071440c4079ce33715a30b88673273aab9b818483f515d7014b3368028a |
| doc/platform/terminal-coding-standard.md | 94b0fcbccb82564b0c50cf5cce19cf7826ef99424f854ee926e07740f0173689 |
| project-memory/operations/terminal-coding-standard.md | a127b502d244c1c495255a91fefc461b6bec54f3f140fc09ac3ef536d22f7da7 |

规范§7.1:1195、TR-R06:1263、§8:1282与memory:42–45已同步，新包义务明确；R2对这些字节未形成finding，三设计文件修订后不据此宣称整个设计GO。需求SHA保持b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e。

已完成：详设/计划/责任附件、两轮fresh审查与处置、明确授权的规范/memory维护、当前字节整理。待Codex独立静态复核；实施授权未提供。生成/C/F/W/D/DEV/reset/seed/L2/UAT/部署及cleanup全部NOT_RUN。

## 7 · 后续外部复核与最新授权

上节状态/SHA是该次交付历史，不是最新字节。Dexter后续转交外部NO-GO 0/2/0及一条后读增补，作者核验并作最小修订；详见`2026-10-13-ter-t1-external-design-review-intake-codex.md`的classification、当前位置和SHA。其后Dexter明确授权修订完成即可由Codex实施全部T1目标并交Dexter/Claude review，已同步详设/计划§0。本内部cycle仍关闭，作者不以修订或授权改写独立GO；所有实施/运行当前NOT_RUN。最新交接见`2026-10-13-ter-t1-implementation-authorization-handoff-codex.md`。
