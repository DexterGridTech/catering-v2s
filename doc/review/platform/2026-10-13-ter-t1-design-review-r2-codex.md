# TER T1 详设与计划 · 第二轮独立静态审查

主agent保存fresh reviewer `/root/t1_design_blind_r2` 返回的独立结论、findings及读取披露。以下为其报告整理，保留判定、证据及范围；作者修订另见intake，不属于本verdict。

```text
REVIEW_CYCLE_ID=TER_T1_IMPLEMENTATION_DESIGN_20261013
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-13-ter-t1-design-review-r2-inputs-codex.md
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=NO-GO
M/S/N=0/2/0
evidenceTier=STATIC_CURRENT_BYTES
IMPLEMENTATION_AUTHORITY=false
authorMaterialReadAfterIndependentVerdict=true
DYNAMIC_EXECUTION=NOT_RUN
```

盲审：先独立检查完整对象、适用原材料和真实源码，形成NO-GO并报告主agent，随后才打开R1和作者intake。没有采信CLOSED作为证明；无写入、委托、运行或.runtime读取。本轮不是未来TEST_CHAIN_PREFLIGHT。

## 1 · 冻结对象

以下SHA由reviewer亲算，结论只对应这些审阅字节，不覆盖其后修订。

| 对象 | SHA-256 |
|---|---|
| 正式需求 | b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e |
| implementation-design-codex | cedd80d0fc7f98dff28f3bc5c88913921d92c8ad3be8dd63b245681e50cddd2b |
| implementation-plan-codex | 7933db27973d4ce589d1fb4a919d950498de4ec2a9fe05f7391ac212fb8b0c01 |
| owner-and-source-appendix-codex | 8eb8bf83f138dc0cdbfe81208ffe03d170b1c679893f4b251877d142e2cd1f36 |
| doc/platform/terminal-coding-standard.md | 94b0fcbccb82564b0c50cf5cce19cf7826ef99424f854ee926e07740f0173689 |
| project-memory/operations/terminal-coding-standard.md | a127b502d244c1c495255a91fefc461b6bec54f3f140fc09ac3ef536d22f7da7 |

## 2 · Findings

### S-1 · UI关闭贡献丢失partKey关联

- 详设§8.2:168/170；计划CP02:27–28。拟议layerDismissals为readonly RenderLayerDismissal[]。
- 事实：`apps/terminal/ui/base/render/src/types/props.ts:55–61`定义的是函数，没有partKey；`:142`真实输入是Readonly<Record<string,RenderLayerDismissal>>。`components/LayerStack.tsx:221`按topLayer.partKey查表，`:264–290`有owner回调则调用，缺失则通用closeLayerCommand。
- 生产者：`ui/feature/sample-staff-auth/src/parts/parts.ts:89–92`、`sample-member-desk/src/parts/parts.ts:262–265`、`sample-wallpaper-picker/src/parts/parts.ts:108–111`，均绑定系统失败part到本owner恢复命令。两integration当前收集的是这些带键表。
- 反例/影响：用户back/backdrop关闭失败层，函数数组无法恢复partKey关联；类型失败、cast旁路可能绕过owner恢复，App重新补关联表又违反消除双写目标。为当前生产路径，不是未来假设。
- 最小修正：保留现Readonly<Record<string,RenderLayerDismissal>>，收集时重复键fail closed，与catalog/Runtime/uiState整bundle替换。条目数组亦可但现Record成本更小；不要新DSL/registry。focused沿现LayerStack/integration证明三feature关闭恢复、back/backdrop、retry新bundle关联。
- 同根：render定义/消费者、三个feature、两integration与integration-assembly均检查；DefinedPart/variable本身有身份，不据此判所有数组错误。
- 判据：R08/R10/R16/R17；源码事实支持CONFIRMED；Dexter裁决：不需要。

### S-2 · Web更新夹具的固定publication与真实候选不相容

- 详设§11b:340–344；计划CP03:41、验证顺序:93。只关fixture.sourceProvider，不足以闭合指定真实W正常链。
- `apps/terminal/kernel/base/terminal-update/src/testing/automationFixture.ts:24–29`新场景落默认fixed；`:42–54/69–72`artifact/target固定全a publication；`:129–130`prepare返回真实source.artifact，但`:131–141`apply不消费prepared artifact、`:138`仍返回targetArtifact.publicationId；`:143–154`readAction延续该身份；`:163`release没有对应prepared身份。
- 生产`terminalUpdateActor.ts:943–949`传preparedId，`:987–995`核task/action/publication；真实CBS候选与全a不同即ACTION_PUBLICATION_IDENTITY_MISMATCH/unknown。
- 反例/影响：真实候选、固定目标、grant成立，平台替身仍报合成publication，正常链变拒绝链。是静态组合推论，不是实际Web失败。不能削弱生产校验、让CBS使用全a或恢复synthetic sourceProvider规避。
- 最小修正：修改现fixture，prepare记录preparedId→source.artifact，apply按preparedId取实际artifact，readAction保持task/action/publication；release精确对应，未知身份typed failure。原synthetic provider仅旧场景使用，owner-flow禁止注入。现direct tests用非全a及FULL/HOT不同身份证明关联及错误拒绝，然后W；不新增fixture工厂/Runtime/native boot模拟。
- 同根：两test-expo消费者、生产apply/readAction检查；原synthetic成套使用有成立范围，native Android port不属此问题。Web不证明PackageInstaller/boot。
- 判据：R16/R17/V07/V17及§11b；CONFIRMED；Dexter裁决：不需要。

## 3 · R1后读对照

| 原项 | 独立核验 |
|---|---|
| S1 SyncIntent | §8.3改为真实Exclude<SyncIntent,'isolated'>，资格/ready分开，旧反例未再成立 |
| S2 RuntimeID/revision | 从ActorExecutionContext取ID并复用credentialRevision，旧反例未再成立 |
| S3 AppControl依赖 | 与既有update唯一reload共址，新network/topology仅ports，旧反例未再成立 |
| N1 全apply清cache | changed目标slice才失效，无关/no-op不清其他，旧歧义未再成立 |
| N2 W落点 | 具体suite/helper已补，但现fixture真实身份未闭，形成本轮S2 |

先形成独立verdict再对照R1与作者intake，不用旧CLOSED证明当前可运行。

## 4 · 方案合理性与其他反证

现Runtime/State派生、资格/ready分离、owner私有API、TDC窄认证执行、按名字完整地址集合及原生资源共址，方向合理。39功能包与未来新增panel区分；没有第二凭证、同步revision、reload或HTTP执行器。UI收集方案成立，但带键贡献需修；真实W接缝成立，但fixture需按真实artifact关联。两修法均是现能力的小修，不改变主干方案。

新增规范§7.1/TR-R06/§8与memory只指针已静态核验，未来接口/模板/门未实现边界清楚，未新增阻断finding。没有须增加产品/Journey/权限裁决才能解决的DESIGN_GAPS；两S已有需求和源码判据。

## 5 · 模板与证据边界

| 模板/档位 | 核验 |
|---|---|
| 原需求/授权/替代/范围 | COVERED；需求GO不代表详设GO或运行权 |
| Journey/IA/UI/控件 | COVERED_WITH_RELEVANT_SOURCE_READ；没有新screen，既有保真仍须验证，S1影响关闭 |
| owner/机制/持久/身份/39包 | COVERED_STATIC；非目录搬家清单 |
| API/生成器/TDC/transport | COVERED_STATIC；实现期仍需真实生成/类型/HTTP |
| driver/W→D/focused | PARTIALLY_COVERED；S2阻断指定W正常链 |
| CP/6b/13c/实施review | COVERED_AS_PLAN，不是proof |
| 标准/memory/third-party | COVERED_STATIC，无新增依赖、无安装/编译/SDK运行结论 |

L1工程/三维：STATIC_CURRENT_BYTES；L2用户行为：UNVERIFIED；L3实现/运行：NOT_RUN。原reviewer使用L1/L2/L3作来源与证明区分，不能读成L2用户可见PASS。C/F/W/D、HTTP、真实UI、native解析图、business/cleanup皆NOT_RUN，NOT_RUN本身不是finding。无生成、编译、测试、verify、动态授权。

## 6 · 收口

本轮冻结字节NO-GO 0/2/0保持；ROUND_FINAL_DECISION=SELF_DECIDED由本reviewer给出，作者只能处置不能改写GO。cycle第二轮硬停止；改文件、换reviewer或局部修订不重置。后续作者最小文档修订仍需外部Codex对当前字节复核。本只读reviewer完成，无文件/环境cleanup责任。
