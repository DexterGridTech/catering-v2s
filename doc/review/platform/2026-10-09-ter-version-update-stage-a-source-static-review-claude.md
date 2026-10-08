# TER 版本更新阶段 A · 当前源码静态评审与阶段 B 影响

- 日期：2026-10-09。
- REVIEW_TARGET=IMPLEMENTATION；EVIDENCE_TIER=STATIC_SOURCE_ONLY。
- 结论：**NO-GO，M/S/N=0/4/0**。
- 范围：Dexter 本次收敛后的普通有效发布、两 App 的 FULL/HOT、跨启动续接、实际版本/任务状态及成功清理调用链；同时检查并同步阶段 B 接缝，审视极端情况是否导致过度设计。
- 本会话为续接的 Claude 外部复评，会话历史包含设计作者工作，不宣称作者会话 fresh。两位只读独立子 agent 分别审查 kernel/装配、Android/工件；第三位只读子 agent 仅审查 B 复杂度。主 agent 重开 owning source、核验反例并汇总去重；不继承历史 GO/MATCHED，也不重开已结束的 DESIGN cycle。
- 无测试、构建、verify、生成、DEV、Web、设备或数据操作；未读取 .runtime/ 或运行 evidence。测试和 Journey 只作为源码阅读，未将其写为运行 PASS。缺少动态 evidence 不作为 finding。
- 写入仅限本报告与三份 B 设计文档；未修改 A 源码、测试、A 设计、需求、规范、项目记忆或依赖。

## 1. 方案合理性与职责判断

主干职责合理：更新选择和固定任务在 kernel/base/terminal-update，Android 的下载、加载、安装、系统事实读回在 adapter/android/update；两 integration/application 只装配，并向 Runtime 转发通用 primarySurfaceReady，未发现其自行选择更新或读取 update slice 决定阶段。关键接线分别见 sample-console/src/application/module.ts:219、sample-wallpaper-console/src/application/module.ts:247。

不需要新增通用恢复中心、第二任务账本或另一个 HOT 通道。四项阻断均是现有输入/状态/身份闭包缺口，普通有效更新即可触发。修法应复用现有 embedded 身份、固定 action、PRIMARY-ready 和既有 ZIP/安装能力。撤回 Commons Compress 及专用极端归档 seam 的方向符合本轮范围；FULL ZIP 的普通封装与消费仍是产品定义，不能一并撤掉。

## 2. Findings

### S-1 · 把当前 HOT publication 当作已安装 FULL 身份，拒绝合法后续 HOT

**判据。** 正式需求 R-06：doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md:111、116–121；已满足 native 下界和 runtime 时跳 FULL，按当前 JS 决定 HOT。阶段 A 详设 §8.1、§8.5：doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:145、184–187。

**源码事实。** apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:99–103 在 nativeBuildNumber 相等时，将 actual.publicationId 与 FULL publicationId 比较。actual 的 publication 是当前选中的 JS；实际已安装 embedded 身份另由 apps/terminal/kernel/base/platform-ports/src/types/update.ts:37–45 的 UpdateFacts.embedded 提供。原生 readFacts 在 TerminalUpdateRuntime.kt:272–288 分别表达 selected publication 与 embedded。

**普通反例/推论。** APK2 内嵌发布 F，已成功运行 HOT H；新规则为同一最小 FULL F＋更高 HOT H2，native/runtime 均满足。H 不等于 F，被 FULL_IDENTITY_CONFLICT 提前拒绝。已达到同一 HOT 的零动作判断亦可能先被此比较阻断。两 App 共用该函数。

**测试源码。** terminal-update/test/terminalUpdate.test.ts:1317 的较高 APK 测试使用更高 native，绕过这个相等分支；不能据该测试断言同 APK 先有 HOT 的链正确。

**影响。** 合法后继 HOT 无法应用；B 若复用该身份判断，无法正确消费配对更新规则。

**最小可验收修正。** FULL 同 build 身份比较使用实际已安装/embedded publication；当前 selected publication 只参与 HOT 内容判断。复用现有 UpdateFacts，不加身份账本。在现有 owner 测试覆盖同 APK 的已成功 HOT→更高 HOT，以及已经达到目标的零动作分支。

**Dexter 裁决：不需要。** 既定规则闭合，非新产品语义。

### S-2 · FULL 经 UNKNOWN/等待后成功，会丢失固定 HOT 并误报整任务成功

**判据。** 正式需求 R-09/R-10/R-11：需求正本:162–168、174、188；A 详设 §8.3/§8.5:160、184–186。系统状态未知应读回同 action；FULL 成功后必须续接固定 HOT，不能直接宣称整规则成功。

**源码事实。** terminalUpdateActor.ts:370 仅在 task.phase 为 applying-full 且 action 成功时回 fixed 续 HOT；:396–426 把 unknown/waiting-user 写入 task.phase。后来同 FULL action 成功，因 phase 已变而落入一般分支，直接写 succeeded。生产 adapter TerminalUpdateRuntime.kt:405–418 对存在但不能分类的 session 返回 unknown；:375–381 在安装身份达到目标后返回 succeeded。

**普通反例/推论。** 固定 FULL＋HOT 的 action 先被读为 unknown，再于下一次真实读回确认 FULL 已安装。owner 将整 task 终结，固定 HOT 未执行。waiting-user→同 action 成功具有同根判别问题，是否走到该路径取决于系统当次结果，修正不能只硬编码 unknown 特例。

**测试源码。** terminalUpdate.test.ts:1201 附近的跨启动测试保留 applying-full；现有直接续接测试未证明 phase 被普通观察状态覆盖后的成功闭包。

**影响。** 用户停留在 FULL 内嵌 JS，尤其可能是比原 HOT 更旧的中间 JS；B 的报告可能收到不真实的整任务成功。

**最小可验收修正。** 以固定 action 的 FULL 工件/执行段身份识别成功，而非以可变观察 phase 识别；同一个 FULL action 从 applying-full、waiting-user 或 unknown 成功均回到既有固定 HOT 续接，不重派已成功 FULL。扩展现有 owner 测试断言 HOT 的一次续接与最终状态。

**Dexter 裁决：不需要。** 普通未知/等待读回是已批准能力。

### S-3 · 成功 HOT 普通冷启动后缺 boot 确认，后继 HOT 被拒绝

**判据。** 正式需求 R-06/R-09：需求正本:117、168；A 详设 §8.5:184–187 要求正常后继启动可执行不同目标。

**源码事实。** apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateRuntime.kt:206 每次 beginBoot 设置 bootConfirmed=false；:820–822 要求当前 boot 已确认或为 embedded 才能切换 HOT。terminalUpdateActor.ts:333–342 在新 boot 释放旧终态 task；:436–437 只接受 applying-hot task 的确认；:492–505 无 task 时 PRIMARY-ready 不补确认。TerminalUpdateModule.kt:78 的确认调用仍由该 owner 通路消费，未找到普通已成功 HOT 冷启动的其他准确确认路径。

**普通反例/推论。** APK3/R2 已成功运行 HOT JS5，正常退出再打开；新目标为最小 FULL2/R2＋HOT JS6。native 更高，跳 FULL，避开 S-1；准备 HOT6 后却因 CURRENT_BOOT_UNCONFIRMED 被拒绝。无需构造坏包、并发或异常设备故障。

**影响。** 一次成功 HOT 后的普通应用重启使后续 HOT 主流程不可达。

**最小可验收修正。** 清楚区分“发布已经成功确认”和“本次 boot 已就绪”，或让既有 PRIMARY-ready 对普通已选 HOT boot 作精确确认；不能把未确认 candidate 自动标为成功。补现有 owner/native 策略测试，覆盖成功 HOT→普通冷启动→下一 HOT，并保留迟到 boot/candidate 不能误确认的原保护。

**Dexter 裁决：不需要。** 既定更新能力闭合。详设的同根缺口另列 DG-1，不重复计 severity。

### S-4 · 普通 FULL ZIP 发布与消费未闭合，实际链只接受裸 APK

**判据。** 正式需求 R-02/R-03：需求正本:68、71、79–81，FULL ZIP 是清单＋完整签名 APK，TER 校验后解出 APK；A 详设 §8.1/§8.3:139–144、157–163。

**源码事实。** scripts/build/terminal-update-artifact.mjs:800–827 的两个 FULL 分支输出 APK＋独立 full.json 后返回，未生成 FULL ZIP。TerminalUpdateArtifactPreparer.kt:57–60 仅对 HOT 解包，FULL 下载为 candidate.apk 并直接进入 :261–277 的 PackageManager/签名/APK 摘要校验。adapter/android/update/src/automationUpdateTargetSourceProvider.ts:31 固定 /full.apk；tools/terminal-automation/journeys/update.android.test.ts:659–680 同样以 APK 字节和 APK 摘要作为来源。

**普通反例/推论。** 一份符合正式定义的有效 FULL ZIP 进入现有 prepare，会被当作 APK 解析，不能得到待安装 APK。现有裸 APK Journey 源码绕过正式封装，不构成所要求链路。此项与恶意 ZIP/symlink/炸弹无关。

**影响。** 开发交付物与 CBS/B 的 FULL 上传、授权下载格式不一致；无法直接接入普通正式更新包。

**最小可验收修正。** 使用已有能力将同一次构建的 APK 与清单封装成 ZIP，不重建 APK。FULL prepare 校验外层来源摘要和清单，取出声明 APK 后复用现有 APK 摘要、签名与身份检查。既有来源 provider/Journey 用实际生成的完整 ZIP；ZIP 摘要、APK 摘要、publicationId 三者分别使用。不引入极端归档专用库、测试 seam 或解析框架。

**Dexter 裁决：不需要。** 若改为裸 APK 才需变更产品定义，本轮未请求这一变更。

## 3. DESIGN_GAPS

**DG-1（同 S-3，不另计 finding）：** A 详设 §8.7:201 将确认限定为当前 applying-hot task，却没有定义已成功 HOT 普通冷启动的就绪确认，与 §8.5 的后继更新要求不能共同闭合。回设计侧补上同一 PRIMARY-ready 的身份语义即可，不需要新框架。本轮未获授权改 A 设计，故在此交回。

其余三 S 均有明确需求/详设判据，不以缺少详设细节制造新增产品要求。

## 4. 静态已核实项及未采用候选

- 两 App 复用同一个更新 owner、adapter 与通用 PRIMARY-ready，integration/application 没有重新拥有更新业务；见 §1 接线位置。
- HOT 确认后/失败 action 的 native 事实由 owner 回读；失败工件使用现有 failedArtifactIds，不需要第二失败记录机制。markBootConfirmed 的 ReactContext/boot token/publication 匹配位于 TerminalUpdateRuntime.kt:305–326；S-3 不允许弱化它。
- FULL 的 waiting/unknown 不等同于坏包；现有 adapter 具备系统安装身份与 session 读回，问题在 S-2 的 owner 消费分支，而非缺通用恢复框架。
- 有效工件准备保留来源摘要、APK 身份/签名、HOT 文件路径/实际大小等既有检查，参见 TerminalUpdateArtifactPreparer.kt:42–70、261–277。此处仅核实代码存在，不宣称任何输入通过运行验证。
- 未把 releasePrepared 缺少局部防护直接立为 finding：沿实际 owner 释放消费者检查，未证实普通路径会删除当前 active HOT，不能以假设中的未来调用增设框架。
- readFacts 的 ReactContext/全局 record 来源仍作为 B 实际 boot 接缝检查项；本轮未建立额外普通 A 失效反例，未增加独立 finding。

## 5. 阶段 B 影响与已同步内容

仅修改以下三份文档，未改变已接受的两后台页面/Tab、权限、控件或 Journey 产品语义：

1. doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md。
2. doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md。
3. doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md。

| A 接缝事实或复杂度问题 | B 当前修订位置 | 最小处置 |
| --- | --- | --- |
| S-1 native/embedded 与 HOT selected publication 不同 | 详设 §0.1:47、§12:401；计划 CP-01:58；附件 §2 | 改正旧 readback 截面，CP-01 验证真实身份来源，不用字段存在冒充接缝就绪 |
| S-2 FULL UNKNOWN 后应续固定 HOT；S-3 成功 HOT 冷启动应允许后继 HOT | 详设 §12:401；计划 CP-01:58 | 保留具体 OPEN_A_HANDOFF；不自行修 A 源码、不重跑未受影响 A 整批 |
| S-4 当前 FULL 为 APK＋独立清单，B 需要完整 ZIP | 详设 §0.1:44、§8.4:284；计划 CP-04:91；附件 §2 | 来源摘要为 ZIP，APK 用 manifest.apk.sha256，publicationId 只表达内容身份；不造裸 APK fallback |
| 新 boot 清终态 task 后 recentStatus 缺规则/工件关联 | 详设 §0.1:50、§8.5:294、§12:402；计划 CP-04 退出:95 | B 在同 owner 原 recentStatus 最小保留显式关联；有合法原绑定时 task 释放前持久化 pending。无合法旧绑定不改签补报；HTTP 不可达不阻塞本机释放，不建第二任务账本 |
| A 当前 FixedUpdateTarget.strategy 只有技术参数，未含 N/M 调度 | 详设 §0.1；计划 CP-01:58 | 区分当前接缝与 B 保存/C 执行的参数，不以当前类型声称调度已实现 |
| Commons/Unix 属性、恶意归档专项链额外成本 | 详设 2026-10-09 修订:32–36、依赖:121、解析:251；计划:50–52、61、69；附件 §3:48 | 改 JDK ZipFile，撤掉新增依赖、专用 seam 和极端归档测试。保留普通路径、摘要、实际读取预算、资源关闭/owned cleanup；D-41 仓根输入逃逸门仍保留 |

APK 内部 metadata/res/签名读取复用现有成熟工具，不再为双层展开总计额外全量解 APK 建扫描框架；工具本身仍有期限、输出与资源预算。规范要求的实际解析版本及官方依据仍是未来 CP-01 的具体工作，当前只读核实 Java 21 ZipFile 官方 API，不把部署/测试写成 PASS。

### B 其余机制的复杂度判断

| 机制 | 是否保留及理由 | 不增加的东西 |
| --- | --- | --- |
| 短期下载 grant 与原子上限 | 保留：隔离 TDC 凭证并处理普通并行下载授权；复用 owner advisory lock/短事务 | 不复制凭证，不新增签名 token 的密钥生命周期 |
| 每任务持久 pending 与匹配 receipt | 保留：Dexter 要任务历史，普通响应丢失/重启不能丢正文；同任务合并不同任务保留 | 不缩成单条最新值，也不造第二恢复库 |
| 409/422 拒绝退出、身份拒绝暂停、单份失败摘要 | 保留：避免普通确定性拒绝永远堵队首，已获裁决的最小修复 | 不增加失败中心、人工重试或任务看板 |
| PONG 广播与真实 IO single-flight | 保留：复用现有 command，timeout 不证明 handler 已结束；不让 HTTP 失败破坏 TDS 连接 | 不加轮询、中心调度器或通用重试引擎 |
| collectionHash 分页与当前 boot flushed 门 | 保留：普通后台编辑/分页和 hydration 就会触发；保护完整快照和真实门店/项目身份 | 不加第二正文 hash、冻结历史快照、统一启动恢复队列 |

因此，除 ZIP 专项链外，没有确认第二项应删除的极端恢复机制。此结论只是本次复杂度与 A 接缝同步，**不是新一轮完整 B DESIGN GO**，不宣称已关闭历史 B 全部 finding。之前“只看 S”的其他 N 未借本次顺手扩大修复。

## 6. 范围差异与运行边界

正式 V-04 比本次主流程范围更宽。恶意 ZIP 条目、Unix symlink、截断中央目录、压缩炸弹等专门输入为 NOT_COVERED/NOT_RUN；不要求新增对应库、实现、测试或 evidence，也不把它们计入本轮 severity。普通有效 FULL ZIP 的封装/消费是 S-4，必须与这些范围外专项分开。

本报告所有运行行为与 cleanup 结果均未执行；静态引用的测试没有本轮 PASS。没有复核旧全量 verify、backend-acceptance、DEV、Web、Android或任何运行档案；不要求重复未受影响场景。最终四项关闭须由获授权主 agent 自行核验并作最小 intake，评审结论不扩大实施或运行授权。

## 7. 源码快照与设计修订摘要

审阅后重新计算下表十项源码摘要，均与初次审查保存的源码截面一致；没有在并发源码漂移后继续套用旧位置。最后三项为本轮修订后的 B 文档摘要，不是修订前截面。

| 路径 | SHA-256 |
| --- | --- |
| apps/terminal/kernel/base/platform-ports/src/types/update.ts | b3965304305067d88ac36094f35de35e19f9cb1c4e3fb63d2bd1dc520d811d60 |
| apps/terminal/kernel/base/terminal-update/src/types/terminalUpdate.ts | f144bfb1826b387145cd6f110ad6c5a809dd9dee51b9e6fa75c95d60e6785082 |
| apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts | af93ec9ebc70000c0f37a96b55898e4b45c7daca537f6f6011fb60f1ca165243 |
| apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts | e8493bcdc6eef5b1c97bd5c8b277bd1ca901d2c04c9078f6a7e6ce5e58a1230b |
| apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateRuntime.kt | 65593a11ae195e2e43a059f330a770eb9d4db4d4bf19a17e7ddd1249acf9caf8 |
| apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateArtifactPreparer.kt | 2fd17d3ed6e32d5c5b32a41c06e5cad8f0f51a911503862b791adfeefea675b7 |
| scripts/build/terminal-update-artifact.mjs | 9de1e8018108cdd05c8fbda907d8f9d819839c9330fb3a017ce1dc253cea2cf1 |
| contracts/terminal/terminal-update-artifact.schema.json | c0f7b889b5078c07d25efa3821b2eeb7e0fc45174d712b63d2173cd359365df8 |
| apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts | 0d5ed481d12fa840dd061afa21fd5792c864c4f315e5d4f7c48d24b55fcd7835 |
| apps/terminal/kernel/feature/store-basic/src/features/actors/actors.ts | ac7361811fe986436949a1adf21e31971d2186b4c1f93d3bfac4486207723f17 |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md | 5131e271d18c07f7fdc7f3b7914f56266046a3f1f27a58765581c641de504b1c |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md | efee595eb6ddec720e4a4d1a685e35c4e3fdc8211ae4bf7fff82cf18cadc85e2 |
| doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md | 37db523402b3e00f2a2f9751caa85e2e7a2d7b46f72d020acf9b140f17409763 |

## 8. 防再犯的有限 checklist

本轮不改规范或项目记忆。问题族与反例落在本报告，未来修复优先扩展既有真实测试：

1. native/embedded 身份与 selected JS 身份分别消费；同 APK 已有 HOT 的正常后继路径必须覆盖，不能仅用 native 较高样例。
2. 观察 phase 不覆盖动作类型事实；waiting/unknown→真实成功仍应以同 action 续接固定剩余段。
3. boot/Runtime 重建后的普通就绪路径与首次应用路径共享准确身份；不能只测试本次 apply→confirm 而遗漏成功包的再次冷启动。
4. 正式产物的封装从生成器到 adapter/场景源一致；验证不同层摘要，不以测试裸 payload 偷换正式输入。

四类 checklist 只适用于当前更新链，未推导通用迁移或恢复框架。后续源码修复及其验证须另按现有授权执行。
