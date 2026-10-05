---
title: TER automation-agent 单批次实施计划
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
implementationAuthority: false
---

# TER automation-agent 实施计划

## 0. 目标、输入与授权

以同日正式需求与 `2026-10-05-ter-automation-agent-implementation-design-claude.md` 为行为判据，完成一个批次：统一 agent/driver、Runtime selector、全部 testID、规范/skill、首旅途、旧 runner 退役。内部 CP 顺序进行，不拆独立产品交付。
Dexter 当前只指派我编写设计与计划，交另一 Claude review。所有下述命令均是未来获授权后的执行计划，本轮 NOT_RUN。依赖安装、源码实施、测试、Web、mobile/双屏VM、DEV、reset/seed、L2、UAT、部署均不从本文件获得权限。
前置：本包 external review、Dexter 两条 admin 常量行看图、产品/治理未决项关闭、Dexter 实施授权；随后重新打开已完成的 Codex 在途批次字节。禁止把目前source inventory当作届时完整分母。

## 1. 固定执行纪律

1. 使用本仓 `.agents/skills/cs-spec-to-plan`、`cs-writing-plans`、实施时 `cs-managed-runtime-execution`，不从全局同名skill取规则。
2. 每点写前与focused proof后，重开需求条款/IA、全部六维命中记忆、详设与当前可复用源码；主agent独自写全部文件。子agent只读、独立、证伪。
3. 每个CP第一次动态运行前，fresh独立做需求、详设/IA、记忆规范三维静态对账；这不是CP退出MATCHED。同CP后续动态运行不重复，除非字节变化影响已对账范围，此时补差量。完整CP的proof/根因修复完，fresh子agent做整个CP三维对账，MATCHED才进入下一CP。
4. 各CP已经MATCHED且字节/依赖判据未受影响的内容不重复对账。修复只重开受影响CP范围；整体6b是跨CP新检查，不能用已有CP结果的汇总代替。13c另有职责，不是重复的6b。
5. 同时只跑一个受管运行；运行前冻结源码与构建输入；运行期间不改源码。无源码/环境变化且无新未决反例，不重跑相同proof。
6. 日志/诊断/首败、last known good、broken boundary、business与cleanup分列；受管dynamic超过30秒按规范报告，其他持续工作不超过60秒。报告必须区分「当前字节上的最新运行」「最后一次通过」。
7. 同失败族第二次出现只冻结该族后续业务，根因修复+相同focused proof关闭后继续；不靠sleep/延长timeout/换场景重置计数。硬约束或实质设计偏离需要Dexter时才停。
8. F闸不成立时停止下一CP；允许CP内最小根因修复，不擅自换输入技术/缩水判据。VM缺双display不能用mobile结果代替双屏。

## 2. 实施范围与具体产出

| 范围 | 产出 | 不做 |
|---|---|---|
| agent | `apps/terminal/ui/base/automation-agent`，三标识、README、module与protocol subpath | 无feature依赖、adapter port、业务slice、eval |
| driver | `tools/terminal-automation`独立workspace；root只登记该tools路径 | 不进入App依赖图，不借hoisted依赖 |
| Runtime | selector定义/登记/求值，descriptor元数据 | 不重写现有request ledger/command实现 |
| primitives/render | 无依赖接缝、surface上下文、真实ref、唯一ID构造器 | 不创建多余布局View/注入业务回调 |
| assembly/admin | 两integration/two application全部装配一次；两条常量行 | 不加runtime开关、连接状态slice或新Tab |
| 识别/门/规范 | inventory全部ID、selector/testID两门、TR-08/T12修订、skill、HANDOFF | 不恢复compliance-control或生产扫描接线 |
| 退役 | 详设§9a.1全部判别为旧runner与独占辅助的文件及引用 | 不删检查器、协议验收、历史review/evidence |

新增路径按能力命名，不把CP/Journey编号放进runtime/test文件名。driver命令计划：

```text
scripts/test/terminal-automation --phase feasibility --platform web|android --shape mobile|dual
scripts/test/terminal-automation --phase capabilities --platform web|android --shape mobile|dual
scripts/test/terminal-automation --phase journey --platform web|android --shape mobile|dual --case normal|reject-retry|abandon|withdraw|render-smoke --age empty|37
scripts/test/terminal-automation --phase skill --platform web|android --shape mobile
```

上述是待实现的单一受管入口，不是假装已经存在的命令；JSON manifest/control参数指向仓根内文件，realpath校验。CLI拒绝非法shape/case组合，业务测试跑Vitest，平台差异留在driver。

## 3. CP-01：最小连接、注册与几何

### RECALL

正式需求R-01～04、R-08～10、F-1/F-2；详设§4.1；SurfaceRoot/SurfaceHostController/AdminLauncher；primitives nativeSlots；Runtime resetRuntimeAfterSystemFailureActor；旧runner的display与process identity；第三方标准。

### 工作顺序

1. 先核对拟用库实际版本与精确tag；补精确API读法与测试；按owner直接声明，不把RxJS/Zod扩散给primitives或kernel。
2. scaffold新agent/toolworkspace，固定protocol v1、错误闭集、token/wss校验与JSON容量边界；同步skeleton graph/三重标识/publicExports计数。
3. 构建配置与assembly初始通路（此CP先落最小启动接线；CP-03补两App全集装配/可见行/F4）；一个Runtime一个agent。
4. primitives无依赖sink与render surface scope，先旧testID；注册/卸载/press真实事件、bounds+revision、Web真实input。
5. driver迁移当前受管身份/build/install/launch/reverse/cleanup，Android多display映射；只迁需要的通用能力。在本步完成新运行根 .runtime/terminal-automation/<runId>/run-manifest.json 与 kind=terminal-automation-run-manifest，启动前调用 ter-validation-with-dev；DEV侧 admin-validation-with-ter 登记该根+精确kind并验证错kind/alias/旧live tree/startToken红例，之后才允许本CP首次动态。同步 health/format 登记本CP新文件，以后各CP随新增文件登记；旧路径/根豁免留到CP-06删除。
6. F-2 Android JS reload经既有Runtime `resetRuntimeAfterSystemFailureCommand`（正常actor也能调用当前appControl.resetRuntime），不新增agent reload方法、platform port或测试后门。disconnect是预期重载边界，等待新runtime/session；失败或unavailable不能冒充reload已成功。
7. 先Web F-1/F-2，再Android双屏F-1/F-2，mobile单屏补充。两VM F-2只验证两连接互不影响，不涉及副机TDS。

### proof与退出

unit/component：错误token/wss、旧session、node卸载/ambiguous、双重缩放、关闭不注册、readonlyref不抢占、normal complete与error恢复、dispose不恢复。
受管F：四角中心/非零scroll/非等比缩放/offset；重启/reload/断网身份差异；reverse清理。first failure和cleanup必读。
首次运行前静态对账；F proof修复完成后CP整体三维MATCHED；不提前宣告退出。

## 4. CP-02：Runtime读取、订阅与request跟踪

### RECALL

R-05～07、R-11～12、R-19；详设§4.2；RuntimeModule/RuntimeDescriptor/RuntimeJournal/CommandDispatcher/ActorDispatcher/late peer路径；附件42selector的root exports及原函数。

### 工作

1. type checker重扫当前全部root导出；逐项参数tuple、JSON返回分析；纯helper/factory/hook明确排除。
2. defineStateSelector preserving callable与selectorDefinitions登记，同步全部11个所属RuntimeModule包和publicExports；新增state selector同规则。
3. Runtime按名求值+简单参数descriptor；重复名/参数数错/JSON非法显错；server-config公开defaults参数仍要求完整结构，不私读defaults。
4. agent initial+state合并/dequal/trailing、读一次/退订、全部元数据与controls订阅；每流绑定sessionEnd；无getState/无slice string。
5. journal真实订阅先于dispatch；requestId自动生成；同步拒绝、complete、mixed timed-out/late完成与error、peer终态与有限期限；不建新账本，不重发command。
6. selector机械门及red：删登记/多登记/非select命名漏登/误登helper；接现有skeleton静态流程。

### proof与退出

所有selector有参数有效/无效、empty/非JSON分支；特别验证NON_JSON值状态不退订、随后JSON与再次NON_JSON正常推送，抛错/预算超限明确结束；simple input schema不依赖Zod。可订阅同一selector不同参数，断链清零。多actor首个完不能提前结束；实际late事件继续推。
F+W，再M/D适用能力受管focused；stageproof和cleanup后fresh整CP三维MATCHED。

## 5. CP-03：全集装配、admin与F-4

### RECALL

R-02/04/15/19/20、F-4a/b；本包Journey/IA/UI及Dexter看图结论；四package.json、integrationAssembly、两个RuntimeSection。

### 工作与proof

1. 两integration+两application allbuild装配，application配置作为Android权威，Web取integration；HOT开关只由bundle输入变化，不增加下载/更新系统。
2. admin只显示「自动化」「连接地址」；一次注入只读常量。PrimitiveFactGrid item增valueTestID挂实际value文本，保留item外框ID；组件测试不能用wrapper ID冒充文本。layout/长URL/可访问性focused。
3. F-4a两个构建同条件Playwright DOM截图，不依赖agent；动态mask单列，pixelmatch红例：多一个可见像素差/错误mask/尺寸不一致要失败。
4. F-4b release VM最重生产page、100次query、1000state bursts、最大128订阅负载；测量口径/60Hz依据按详设§4.3，分别报告同步flush与query的P95/max。长驻30min账本的真实条数/完整bytes/求值与编码成本也纳入，无条数上限假设；超消息/时间预算红例须明确失败；独立测agent/RxJS/Zod/dequal总bundle增量；预算不达先优化，改预算必须报Dexter。
5. release/debug两端完整能力一致；开/关产物都包含包；关不connect/register/measure。不能以默认off隐藏额外debugUI。
F-4a/b与ownedproof后CP退出MATCHED。

## 6. CP-04：旧ID首旅途与mobile执行面

### RECALL

R-17及冻结需求§4.3～4.5、sample interaction原文；当前activation/staff/member路由、store-basic启动；`terminal-data-client/acceptance/devScenarios.test.ts#operationsSession`、`operationsTerminal`、`prepareFixture`、`cancelByOperations`及其HTTP路径；原冻结runner全部case/age。

### 前提准备（不能隐式授权）

先迁 scripts/test/terminal-business-fixtures.mjs 的顾客生成能力到 tools/terminal-automation/fixtures/member.ts，首次顾客输入前完成共享消费/敏感数据内存边界的 focused；同步新文件 health/format 登记，旧独占 helper/入口在 CP-06 最后删除。
先从 TDC acceptance 抽取 acceptance/operationsFixture.ts，共享五函数及所需HTTP能力，输入化常量，owner保留；devScenarios.test.ts与新driver共同消费，不import测试文件或复制。新增operationsFixture.test.ts的TDC focused、原acceptance owned typecheck/lint、driver共享消费验证；未受影响整旅途不重跑。
driver复用真实operations登录→PROJECT身份→STORE数据节点→terminals列表/详情→合法fixture terminal/code的既有链。账号r5-account-multi-role、密码env V2S_SEED_OPERATIONS_DEFAULT_PASSWORD，现有受管DEV环境变量名与角色核验按详设§10b.6，禁止落值/账号到日志。仅在已获当前实施授权的受管DEV执行，不运行Node E1整旅途，也不读取旧运行结果当fixture。
Web使用受管deviceId/process-memory protectedStorage；Android在专用可回收测试VM与自己的sample App持久化namespace激活。终端按唯一 seed 契约 stableFixtures.organization.storeTerminals 选取：dual=term-front、mobile=term-handheld；activationCode 只从该契约内存读取，不在受管 JSON 另存。manifest 仅记 seedKey/terminalRef/storeRef/本机deviceId 等非秘密身份；不新增终端、不改 seed。与 TDC 五 fixture 共享，依同一时间仅一个受管运行防争用，不与 TDC acceptance 并行；CBS及受管readback唯一匹配后先确认INACTIVE。未知ACTIVE拒绝。上次本driver ACTIVE仅在其manifest同DEV/空间/store/terminal的预存deviceId与binding读回一致（已有generation也匹配）时，用当前generation既有cancel CAS并readback INACTIVE；身份缺失不猜、不cancel他人。完整规则见详设§10b.4；HTTP detail当前没有deviceId，复用已有managed readManagedTerminalBindingByName远端只读readback并最小增projection/parse字段和 scripts/dev/r5-dev-runner.d.mts 两函数声明及 parser 红例（跨 owner 改动，未来实施授权须单独点名）；bound_device_id原值只内存核验、不落盘，错manifest/deviceId/store拒绝，取消仍走HTTP owner，无新产品API/PG tunnel。若可用fixture不足，不自动创建产品数据/reset/seed。
真激活由TDC现有command完成，标semantic准备；真实binding selector/readback一致后才开始店员/顾客真实操作。sample staff凭据来自当前本地常量，落盘不记录。prepared阶段失败不执行business步骤。driver.fixtures.ensureActivated({shape}) 是 skill/业务旅途共同使用的显式普通Promise入口，返回非秘密身份；不在纯连接proof隐式激活。真实点击 request 关联复用详设 §4.4 的 requests.observeUiAction 薄封装，不复制账本。

### 旅途

same `sampleConsole.test.ts` 顺序执行normal空age、normal37、reject-retry、abandon、withdraw、render-smoke；每case隔离sample本地成员/会话，必须经已有owner command准备/清理，不能state injection。具体用户步骤回指冻结交互逐项，以当前真实按钮和part参数实施，不能因接口缺失改用户流程。
每次click/submit前先建node/selector/request观察；按可见part、member pending/list、request结果分别断言；reject/abandon/withdraw不能有新增member，normal有唯一member及age对应值。
先W（dual），再D（dual）。增加同一agentCapabilities与适用sample mobile行为在W mobile→M VM的对照；mobile只跑normal（age空/37）、reject-retry、abandon，不冒充withdraw/render-smoke dual；hand-back/keyboard-alpha-probe列HANDOFF待重写，不新增“返回”case。mobile/双屏VM真实安装、启动、虚拟键盘逐键输入，不做APK-only冒充动态通过。
旧ID两端focused全部通过与CP三维MATCHED之后，才进入重建ID。DEV只消费受管tunnel，不开PG tunnel/本机Java fallback。

## 7. CP-05：全部testID重建

### RECALL

R-14、详设§4.5、完整source inventory、各包实际testID消费者与历史/现行文档分类。

### 工作与proof

1. createTestId唯一构造器+validate，动态key稳定业务ref且编码，不拼surface。每包唯一 *TestIds.ts；内部derived节点同规则。
2. 附件全部生产/测试、639 TSX动作或只读节点及其他testID定位逐项同步；不是只改首旅途用到的ID。
3. createTestId返回唯一品牌TestId；全部项目testID props/转发/nativeSlots收窄为TestId，现有typecheck检查传递。literal/模板拼接/旧string传品牌prop必须编译失败；隔离红夹具覆盖正常构造与编译失败。对所有TER生产TSX的每个testID/testId属性，checker在属性处取表达式类型，不可赋给唯一TestId即门红，覆盖直接RN元素55处/12文件（实施重扫新增）；直接 `<View testID="x">` 即使RN类型允许仍须门红，品牌值传View须绿。窄AST门禁止构造文件外as TestId（含别名/尖括号和定点any绕过），不自写符号流分析；测试消费者导入同源常量。
4. 同步当前规范/memory/README/现行design引用；历史review/evidence不改。
5. 同一script的新ID回归W dual→D dual、W mobile→M；map变更仅常量源，不留第二套旅途。stage静态/退出MATCHED。

## 8. CP-06：skill、规范、最后退役

### RECALL

R-15/16/18；详设§9a.1、§4.6；所有旧runner imports/scripts/README实际消费者；TR-04/08/T12；三维与main-only治理。

### 工作

1. skill随真实协议/命令定稿；fresh仅读skill在只读报告给完整旅途全文和完整W/M命令，main逐字转录执行，不改一个字符。任一修改即skill缺口：修skill后换新的fresh从头生成，不能main补齐。执行结果交回同一fresh核对，保存全文/命令相等检查。selector订阅+command跟踪+realclick、W→M及cleanup均须通过；无唯一写入规则豁免。
2. 起草并同步norms、记忆与required-inventory及索引（仅实施授权后）；精确TR-08例外、T12、禁用词；ter-failure/安全生产化/非首旅途空窗写HANDOFF。
3. 按详设§9a.1执行最终退役：删除旧运行根豁免、旧入口及独占helper（含旧顾客fixture、wallpaperCatalog），清理 health/format 的旧路径。新driver资源准入/根/kind/红例已在 CP-01 完成，新顾客fixture已在 CP-04准备完成，不延后重做。同步production门/required-inventory/索引/test-closed-loop/README退役引用；索引仅由既有build-index生成。静态判别式同时覆盖导入旧入口和按路径登记旧入口，保留新根精确kind验证。
4. **最后**删除旧UI runner/独占helper/tests/ter-vk hooks/imports及所有调用入口。保留两个check-*的focused mutation检查能力，保留TDC协议验收。不能整目录删除共享process/identity能力。
5. static引用搜索＋remainingcheckerownedproof＋新的manageddriver启动/真实input smoke；删除harness改App必须freshfocused重验证，不能继承此前bundle proof。
6. CP-06整CP退出MATCHED，无旧UI入口/转发壳、旧ownedrun资源残留，cleanup明确。

「删除最后一步」指实现/迁移最后动作；后续全批6b/最终统一验收/13c必须看删除后的字节。不得把删除放到最终review之后。

## 9. 全批6b、最终验收与昂贵阶段准入

### 9.1 全批6b

全部六CP退出MATCHED后，fresh只读独立审查全批需求＋详设/IA＋记忆规范，检查跨层所有权、注册/配置传递、退役空窗、调用链及focused留痕；结论MATCHED/OPEN。这是新全批交叉检查，不要求对未变CP重复开会。OPEN先根因修复与影响CP/6b差量复查。

### 9.2 最终动态清单（当前全部NOT_RUN）

| 顺序 | 执行面/同一脚本 | 必须关闭 |
|---|---|---|
| 1 | ownedtypecheck/test/lint，skeleton新门red，root scripts/verify | 默认verify与validate-only分别记录；不能相互顶替 |
| 2 | W：agentCapabilities，build toggle/F4a，冻结dual旅途全部case+age | 详设11a全部W行、真实DOM输入、selector/request/parts |
| 3 | M：Android mobile VM，agentCapabilities及适用single-screen旅途 | 所有M行、真实键盘、App/reload/session、admin构建行、F4b |
| 4 | D：Android双屏VM，F1与冻结dual全部case+age同脚本 | 两display id、两屏visible facts、same scripts三断言；完整V-17 |
| 5 | P：两VM短连接场景；远端wss无ADBagent场景 | 独立session/reconnect/cleanup；没有副机TDS |
| 6 | skill fresh报告完整全文/命令的小旅途W→M | V-18，main逐字转录；有改字即修skill换fresh，结果交原fresh核验 |

各表行复用未变化focused proof需注明源字节/执行面/复用理由；最终统一运行不能将历史proof换成新的run标签。配置/ID/装配删除影响结果时做实际focused/终验，不能假称无需测。

### 9.3 条件式昂贵动作

- 当前计划不执行browser L2/reset/seed，不提供这些动作通用授权。
- 如实际需要DEV start，必须当前Dexter实施授权涵盖受管DEV；已有受管DEV仅manifest身份核对，不停止别人的run。所需prepared fixture经既有HTTP owner，不直接写库。
- 若授权要求reset/seed或L2，先全部CP、全批6b、适用UI/testID/§3a与L2_SCRIPT_ADMISSION；reset前当前字节完整seed dry-run。§3a不适用L2时没有空分母「PASS」。本批尚未满足任何准入。
- 不新增backend-acceptance/Testcontainers运行要求；若确有源码影响需获授权，生命周期遵循受管stop→test→条件restart，绝不自动seed。

## 10. 逐代码与详设对账（明确交付步骤）

- **范围**：全批每个新增/修改/删除生产符号、测试/runner、依赖、配置、规范/skill；附件最终重新扫描所得完整范围。不是按章节抽样。
- **执行者**：fresh只读独立子agent；main提供原始需求、详设/IA、规范、真实源码与各自source/run边界，不能代写独立结果。
- **判据**：逐行事实与对应详设；完整调用者；声明—传递—消费；正常/拒绝/竞态/错误/清理；零消费者/幽灵文件/不匹配ID/陈旧proof为OPEN；缺设计判据记DESIGN_GAPS。
- **结论**：MATCHED/OPEN；任一OPEN不能交Dexter/Claude做实施后交付review。与测试前6b不同，不能互相替代。
- 修复后只对影响范围/依赖闭包fresh复查；不要求重做已MATCHED未变化项。

## 11. 整批IMPLEMENTATION review与最终交付

通过13c后fresh独立整批IMPLEMENTATION reviewer重新判断真实生产实现与用户行为，明确GO/NO-GO和M/S/N；按设计找不到判据则DESIGN_GAPS，不因为按设计实现就免合理性审查。NO-GO确认修复后fresh复审，实施review没有两轮上限。
最终交Dexter/Claude：当前设计/计划、源码范围、CP/6b/13c记录、独立review/intake、每条V的source/run/拓扑适用范围、当前最新与最后PASS、首败和修复、business/fixture cleanup/runner cleanup、未运行项与HANDOFF。
不得只报总数，不把没有跑的旧旅途当本期PASS，不保留任何旧UI runner入口。普通两端资源全部回收；DEV是否保留按当前Dexter明确要求，不能自行reset/seed或长期保留新driver。
本轮交付只是设计提案，请另一Claude做DESIGN review；不是以上实施完成报告。
