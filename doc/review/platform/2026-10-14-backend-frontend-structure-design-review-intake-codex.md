# 前后台结构优化设计 · 主agent finding intake

AUTHOR_DISPOSITION_ONLY=true。不是独立verdict，不改R1原结论。当前授权只文档；主agent本人重开owning source/规范、对反例与更小方案后修订设计/计划/附件。需求及生产/测试/规范/记忆/依赖均未改，未读.runtime，未执行生成/编译/测试/verify/环境/数据/设备。

## 1 · R1范围与处置

R1原输入及报告见同目录2026-10-14-backend-frontend-structure-design-review-r1-codex.md：NO-GO 0M/5S/2N。R1如实披露大型测试/适用历史材料阅读不足，不能写成全部READ_ALL或独立全包GO。R2是同cycle第二轮，须补最小输入，先形成自己的结论再参考本表；本表CLOSED只指设计文字和接线已写定，不是实现/运行通过。

| 原项 | 本人classification / 文档状态 | 个人核源、反例与最小方案 | 当前修订住址 |
|---|---|---|---|
| S01 | CONFIRMED / CLOSED_DESIGN_ONLY | CatalogItemService#sourceFact:4473–4477与ItemRow:5824–5834、Workbench#sourceFact:1354–1358：sections同值仍受持久sourceScopeRef影响。传原已读字段最小，优于新query/owner回调。保持来源优先级 | 详设§8.3:155；计划CP02:39；V06现assembler真实接缝test |
| S02 | CONFIRMED / CLOSED_DESIGN_ONLY | browser-l2-runtime suiteAdmissionStrategy、store-terminal策略、l2-suite-admission validatePolicy:113–132均须具名policy。本人另核其已支持uiSourceDirectories数组，因此不用扩大成全App目录或新框架。补本suite policy/adapter/红例 | 附件§5:149；计划CP06:78 |
| S03 | CONFIRMED / CLOSED_DESIGN_ONLY | builder#readManifest只认自己的manifest，不能让L2冒名。更小方案已存在：update.test.ts#exportSeedArtifacts:196–247、runner#cleanupManagedRunArtifacts:502–636、terminal-update-seed-plan#buildTerminalUpdateSeedPlan:75–247、scripts README:161–174。源run先完成且显式导出10文件，原cleanup保留seed-inputs；只读校验后交接给L2父manifest精确回收。不扩builder/另建runner/并行run/安装设备 | 附件§4:113、§5:161–165；计划CP06:80及§9:96–97 |
| S04 | CONFIRMED / CLOSED_DESIGN_ONLY | verification-governance:66–80与R12/V12/13：F不能替真实HTTP闭包。先受影响focused H，再对应L2，最终full H仍晚于最终修改；不要求L2前不相关全量 | 详设§11:215；附件§3:96；计划§2:21、CP02:41、CP04:63 |
| S05 | CONFIRMED / CLOSED_DESIGN_ONLY | implementation-task-template 6c:215–226覆盖首次L2，不仅reset；seed公开入口scripts/dev/seed:19，r5-complete-seed-executor#dry-run。先本次源run→当前完整seed dry-run→L2，真实reset/seed仍独立授权，不把dry-run当数据写入 | 详设§10b:211；计划§9:86/97 |
| N01 | PARTIALLY_CONFIRMED / CLOSED_DESIGN_ONLY | 现两个Tab label可直用；rc-picker#useInputProps:80–99 data-*及id透传、antd RangePicker components.input、foundation CursorPagination现prefix-next/previous、dirtyGuardTestIds已有原按钮接缝。补各定点action，不新locator协议/组件/第二确认层 | 附件§4:115–143 |
| N02 | UNVERIFIED_REQUIRES_EVIDENCE → DESIGN_CLARIFIED / CLOSED_DESIGN_ONLY | 原workspace#currentStart:220/restart:729–736确有局部identity。原评审没证明未来必重复，拒绝将其升级当前实现缺陷；设计写定launcher唯一currentSession、Workspace受控currentStart并删镜像，保留其Room呈现态，A迟到不end B | 详设§8.5:166；计划CP05:70；V11 tests |

无需新产品裁决：修订都保留原用户任务/权限/行为/事实。未改S/N原始计数，未用R1阅读限制否定其已确认反例。

## 2 · 本人同根补充（不冒充R1 findings）

1. **复用排序不等于语义相同。** 旧organizationExtensionValues.ts:10表单只有displayOrder稳定排序，foundation typedExtension.ts:139–150另加key排序。直接复用后者会改变同序表单顺序。保留两个原具名策略，共享enabled筛选，F钉同序反例；没有为少量重复加通用排序框架。详设§8.7:175、计划CP04:60。
2. **fixture能力必须沿真实入口。** 现wire client只有hello-world remote-command模式、SESSION_PROBE PING不分流remote指令。本suite要持续在线且不伪造执行，应在同文件增加具名fixture模式，实际认证/heartbeat/仅接收两个remote owner命令、保持UNKNOWN，STARTING真实end。现LiveKit不可达不得用mock当实际L2。附件§5:157–159、计划CP06:79。仅fixture源码未来改点，TER/TDS业务契约不变。
3. **第三方接缝不猜接口。** CursorPagination没有任意Button props入口，已有testIdPrefix派生；策略已支持目录数组，实际契约优于先例单目录。附件将确切API写清；RangePicker透传按本地发行物确认，未来仍须实际解析图/节点F。不以本次只读确认当编译或DOM PASS。

## 3 · 通用失败模式、适用范围与防再犯

| 模式 / 根因 | 有限适用范围与反例边界 | 最小复用解 / 计划中的真实测试与review动作 |
|---|---|---|
| 纯提取只传界面可见字段，漏持久事实 | 本批catalog来源，不从纯helper回去读DB；其他无此事实不强加 | assembler成对值test；review遍历可达闭包的所有row字段/输入/优先级 |
| 列了新入口却漏其既有policy/producer身份 | 本suite，不重构三个已可用suite，不假manifest | admin-ui admission/P1/fixture真实red；review逐声明→传递→消费者/cleanup |
| 最终证明被误用为前置准入 | 有真实API变化的extension/asset/catalog，不给纯前端套无关H | 计划先focused H后L2、full H最后；review核档位/字节/执行顺序 |
| 简化准入丢适用条件 | 首次L2/reset/seed，不等于现在有运行授权 | complete seed dry-run及公开入口；review分别看静态证明与实际数据权限 |
| 合并同名状态/算法后改变observable行为 | session identity单源、表单与列表tie策略；不把临时Room呈现当事实副本 | 实际hook/Workspace deferred和排序F；review两相同输入不同事实的反例 |

防再犯落点是上述拟修改的既有真实tests与本批明确review checklist，不新增治理台账或在本intake立新规范。本轮文档已写，所有测试/实现还NOT_RUN。

## 4 · 当前字节（R2输入）

| 文件 | SHA-256 |
|---|---|
| 详设 | 00651d29bd13f23597612c9c0fea9fc607dba482279cf864de6c75b4da217113 |
| 计划 | 32b11d3ad0dd6fcef9c404019f00f6d96954ff3963639c1870c2c0dc56f225d6 |
| 附件 | fc2a8fb2b78d5b27477d4a3d6ad150dee2342f6157501bf98265465c3ff6d74c |
| 需求（未改） | 378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47 |

该表是R2原输入，不是后续修订。R2原独立报告已归档；静态作者处置不代替独立verdict，所有新能力/compile/F/H/L2/DEV/seed/cleanup NOT_RUN，UI控制面准入OPEN/BLOCKED，不能据本表实施。

## 5 · R2个人处置与本次追加审查

R2原NO-GO 0M/1S/0N保持不变。R2披露部分最小材料后读才补齐，不能将其称为全部适用输入先于intake的整包盲审GO资格。

R2-S01=CONFIRMED / CLOSED_DESIGN_ONLY。本人重开TerminalRemoteControlOwnerService start:80–138、controllerGrant:158–172、register:176–220和startReadback:373–378，以及Workspace:538–633：receive-only未register，无description就不能Room。EndCoordinator#end先owner ENDED再请求stop/best-effort room终止；LiveKitRemoteControlRoomTerminator明确允许未配置/失败诊断，不能因此把媒体释放当已成功。

更小方案选择删**多承诺的oracle**：详设§3a:76、附件§5:157–159、计划CP06:79写定只有真实STARTING/拒绝/end/close/同session ENDED/焦点；Room/listener/keepalive/track与A→B→late A身份留原focused F。删本suite新增LiveKit连通门，不新增register fixture/假description/actor/媒体/部署。六case其他5项仍不依赖Room；workspace真实媒体义务并未取消，只是本批证明档位不混称L2。

失败模式抽象为“状态可产生，不等于下游资源已建立”；限定本suite的wire-only前提。最小防再犯是admin-ui fixture/P1测试与review checklist逐项核oracle所需状态、缺前提时拒给该oracle；已具名focused Room tests仍覆盖资源关闭。不能从服务可达、CBS ENDED或命令接收推实际capture/Room释放。

R2原建议作者按SELF_DECIDED收口=REJECTED_WITH_EVIDENCE：治理正本§1明确SELF_DECIDED只由第二轮独立reviewer声明，不允许作者自写GO。保留其报告建议，不采用。Dexter最新直接任务另明确“完成对抗式review，直至go”；据该本次追加授权，修确认项后送fresh R3，原cycle/轮次不重置，需求cycle不重开，不将本次例外扩成长期治理。见计划§11和R3输入中的授权原文；不是用换reviewer偷偷绕上限。

## 6 · R3当前输入

| 文件 | SHA-256 |
|---|---|
| 详设 | e594677956d12c8fd9b4db3a5db6a9d18d7a55a3b71a1c7b90002fb2b8361227 |
| 计划 | 220859274527dcd4b109ebd9c99f7d58750a98610f216bb14869862857ec2035 |
| 附件 | 7b86405936d1b24fd415c20a1ec6c342f78b1187b1110f70411cc97f9ac9aac6 |
| 需求未改 | 378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47 |

此表是R3原输入，非后续字节。R3独立结论NO-GO 0/1/0已归档，旧报告不改。所有实现/运行/cleanup仍NOT_RUN。

## 7 · R3个人处置

R3-S01=CONFIRMED / CLOSED_DESIGN_ONLY。本人重开backend-acceptance-business-scenario-standard:108–110、scripts README:299、test-health-entry-runner.mjs#nodeTestFiles/#validateExplicitTestSet:91–106、其test.mjs的runNodeTests默认真实root测试。四个新Node文件不会自动成为执行项，分别单跑不能证明现入口消费。最小方案在原nodeTestFiles追加、原验证函数和red复用，不建新的test registry/checker。

计划CP06第7项:82、附件§5:153、详设§14末:267写定四新增路径和同组登记/重命名/删除、controlPlaneFiles纳入runner/test、相关focused与入口self-test。本人又核现五missing真实路径：scripts/dev/r5-fixture-contract.test.mjs、r5-livekit-resident.test.mjs、terminal-update-seed-{plan,executor}.test.mjs和scripts/test/terminal-remote-control-protocol.test.mjs。原health直接测试读取真实目录，故不能给五项留缺口又说该focused PASS；未来同组**只补共享入口元数据**，不改其业务测试，不把既存差异叫新回归，不默认--node全集合/完整verify或运行seed/LiveKit。实现写前复核当前发现集，其他在途变化协调owner、不掩盖漂移。

通用失败模式“测试存在/能单跑≠正式入口会执行”；限scripts显式Node目录，TS/Vitest/Gradle为反例；原validateExplicitTestSet/red与本批CP06 source review防再犯。所有四新增逐一登记，既存五项只源现状登记，未声称现在PASS。没有增加新业务/权限/运行目标。

## 8 · R4差量当前输入

| 文件 | SHA-256 |
|---|---|
| 详设 | 87e382793739557ad3ef524c59d9ec5d04fde7bad66abf56fcc1b59c339eb921 |
| 计划 | 64fbf23fe057ab867728b57d6d29f14d8cf04c2a734142cd98d72de24b5855f0 |
| 附件 | 2872ac8713ca0e48edb1dfa1560d8b317cd94b4aa0bd798fac418cf9de4e30ce |
| 需求未改 | 378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47 |

R4只复核此Node入口设计差量及同根，完整回读三文档一致性；不是重审未改整批production，也不重跑。旧整包R3报告+当前独立差量分别保留，不能把R4冒称从零整批代码GO。

R4已先读足全部适用输入、独立形成GO_WITH_UNVERIFIED_UI 0M/0S/0N，再读R3/intake；current SHA与上表一致。核现health真实发现/执行、test只mock spawn未mock root，四新增+五既存metadata登记/红例/禁止扩大运行范围在三文档一致。没有新的confirmed finding需修，故送审工件不再改字节。当前已确认设计阻断全部CLOSED_DESIGN_ONLY，内部审查收口，交Dexter/外部Claude对当前完整设计包再独立评审；不能将此收口当实现GO。所有实施/运行/cleanup仍NOT_RUN。
