---
title: TER 版本更新阶段 A 外部设计评审处置
status: AUTHOR_SMALL_REVISION_COMPLETE_PENDING_API_AND_IMPLEMENTATION_AUTHORITY
implementationAuthority: false
---

# 外部评审 finding intake

阅读边界：§1～6 保留首轮文档处置的历史输入、行号、哈希和当时状态；其“当前/本轮/等待复核/UI=UNSET”只指该次处置字节。2026-10-06 后续外部差量复核、小修订和 Dexter 界面确认以新增 §7 为准，不改历史评审 verdict。

## 1. 来源、作者与结论边界

来源：`doc/review/platform/2026-10-06-ter-version-update-stage-a-design-review-claude.md` §3、§8，以及 Dexter 本轮明确裁决。
外部原 verdict=NO-GO，M/S/N=0/3/5，只对应下表原始 SHA；原报告保留不改。
本文件是续接作者会话的逐项复核与文档处置，不是 fresh/独立 verdict。内部 DESIGN cycle 已关闭，未重开，未召集第三轮。当前修订字节等待另一位 Claude 的外部差量复核。
本次只改六份设计工件及本 intake/交接记录；需求、规范、记忆、源码、依赖只读。UI=UNSET；新增能力、生成、编译、测试、verify、DEV/Web/设备与 cleanup 全部 NOT_RUN。
CLOSED 仅表示本条静态文档修订已完成；不表示规范已落地、代码已实现或运行已通过。

## 2. 当前字节与历史输入

| 文件 | 原审阅 SHA256 | 本轮修订 SHA256 |
| --- | --- | --- |
| `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md` | `1fa3f3eb70237ba346b64a712929eed88cd16f926a9c59979a55282f83b02588` | `19a52bddfac1f56bc5d921f1ab309af49a29879f51590778aa81e4c699f7228e` |
| `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md` | `8d3f8e7d9f12b229c012e3971ab25da58a4e3795ed563708f061262ae1ffe022` | `ab6431d1db2333ead5b176c956014cfa5b541c2c7927b4288863f3083112b2c7` |
| `doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md` | `760529efaefbc43ba61bf00f9d403ed98453b6b4bf7bb43a8d5081dc68e698af` | `aeec76715ab37cc88367874b7c58f218bed734f5ed66e07e9c7a42896870919f` |
| `doc/decisions/2026-10-06-ter-local-update-journey-claude.md` | `12573920fd97b4c4ec5a67516a748f3e973d0dd435ae028b83b6ecfe9d337faa` | `65a37335a5a2148854dd2ddb3a35e0a348395f9e5c4b80a3716ddcd09c1cda7e` |
| `doc/decisions/2026-10-06-ter-local-update-ia-claude.md` | `ed422efd4a13e1e131b570cd976d7af9ac23f4a382888b243144d6eb5df06025` | `be12f8536b0759f21b07c7dc2a0b8b4596d71cda839277974bb77b07e2130a78` |
| `doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md` | `61a4e6692893f23275c0e51c3912f69109d2539ee25c153d1e23b7e215c357f7` | `769ef2a87a2532942f6e84f1e446a4256e847893bb07f11fd4fc63e392de235f` |

只读需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` 当前 SHA256=`f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22`，与本轮输入 `f4ae511b8691710f` 前缀一致。

## 3. 逐项处置与当前准确位置

| finding | 核验分类 | 文档处置 | 当前位置与可验收修正 | 尚未完成/是否需 Dexter |
| --- | --- | --- | --- | --- |
| S-1 APK 替换后旧 HOT 仍可加载 | CONFIRMED：需求 R-06/V-10 明确需先运行新 embedded；原设计缺安装身份绑定 | CLOSED | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:163、171、198、206、209、330`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:61、75`。selection/previous/candidate 绑定 applicationId+实际 versionCode+签名 embedded publicationId；beginBoot 比较后复位并报 APK_CHANGED_SELECTION_RESET。§11a 纳入同 runtime FULL 与外部更高 APK 两反例，旧 token 无效、实际首 boot 为新 embedded | native 实现及反例 NOT_RUN；不需新产品裁决 |
| S-2 session 消失后永久 UNKNOWN | CONFIRMED：原详设 COMMITTING 无出口；R-10 不禁止已终结会话后的再次安装邀请 | CLOSED | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:190、216、219、232、234、235、331、334`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:62`。成功查询证明旧 session 消失且实际未安装→ENDED_NOT_INSTALLED→WAITING_USER；下次新 action/session 邀请原工件，旧 action 不再 commit。BUSY_UNKNOWN 经生命周期/session 事件读回，占用结束后有出口；查询失败与仍存不可判定分别 UNKNOWN | 真实 session/foreground 时序 NOT_RUN；不需产品裁决，不新增手工重试/N 调度 |
| S-3 embedded 整树复制扩大普通启动失败面 | CONFIRMED：本仓与精确版本官方 loader 同时支持 asset/file，复制不是身份要求 | CLOSED | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:141、148、150、209、333`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:30、61、64`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md:33、35、47`。选择推荐 a，embedded 默认 assets://+res；HOT/文件型恢复 file；embedded 恢复仍用 asset。构建树生成签名 metadata 身份，不复制或重哈希 AAPT 转换资源 | embedded/HOT 两路 HBC/图片/字体离线 F-LOAD NOT_RUN；不需产品裁决 |
| N-1 TR-09 精确例外与理由 | DEXTER_DECISION 已作出；源码复核 CONFIRMED：角色切换只是 flush+reload | CLOSED | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:16、168、268、345`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:15、41、47`；`doc/decisions/2026-10-06-ter-local-update-journey-claude.md:75`。状态改 APPROVED_PENDING_CP02_IMPLEMENTATION_SYNC，仅取消激活原因，未来实施授权下 CP-02 前同步唯一 TR-09 正本与保留/清除 focused/red | 规范落地 OPEN，未改正本；原裁决无需重问，不扩大其他 owner/orphan/ephemeral/TDC 凭证 |
| N-2 Web fixture 构建边界 | CONFIRMED：原文只写用途，未限定注入面 | CLOSED | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:170`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:49`。生产 unavailable；只有 automation-enabled Web 测试构建显式 fixture，与 source provider 同形；production 导入 fixture 的包/构建 red，不依据缺 native 自动 mock | red/构建 NOT_RUN；不需产品裁决 |
| N-3 native failure 窄例外与 UI 相反 | CONFIRMED：automation R-10 明确允许非 React 界面；原 UI 最后一句遗漏 native Text | CLOSED | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:82、283`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:88`；`doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md:142`。安装、来源设置、native failure Text 三类可走最新 driver 内 uiautomator，失败 Text 只读；React 节点仍 agent | UI 看图 UNSET、设备 NOT_RUN；不需产品裁决 |
| N-4 官方 RN 链接组织名 | PARTIALLY_CONFIRMED：需要亲验精确 tag 链接；“旧组织必错/失效”未成立 | CLOSED | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md:35`。按要求列 facebook/react-native v0.86.3，实际访问重定向 react/react-native 同 tag；补同 tag AssetSourceResolver 原文。保留重定向事实，不把原 URL 宣称为假链接 | 已核验官方链接/静态语义；native API/资源可用性仍 NOT_RUN；不需产品裁决 |
| N-5 F-LOAD 更早证伪（可选） | PARTIALLY_CONFIRMED：降低返工成本合理，不构成必须改路线 | CLOSED（可选计划项已写明） | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:96`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:42`。CP-02 端口冻结前可单列受管、用后即弃探针，不进入产品代码、不写产品任务/selection、不替代 CP-03 正式保护链；UI 观察仍最新 driver | 本轮 NOT_RUN；未来若实施该探针须单独运行授权，不把可选项转为本轮新闸门 |

S/N 共八项文档处置已完成；无 PARTIALLY/OPEN 文档 finding 遗留。工程 OPEN 独立保留，不能用上述表覆盖。

## 4. 最小方案与同根扫描

选择保持 Expo 公开 Host handler+同 Host reload，不引入另一 loader、版本账本、安装恢复队列、任务看板、手工 retry 或常态轮询。
S-1 只在现有三类记录增加 APK 事实绑定；不以 runtime 比较代替身份，也不预下载 HOT 跳过 FULL embedded。S-2 只精确化已有 session readback 结果与允许的新 action；不把“没有 callback”当作 session 结束。S-3 删除整树复制步骤，降低普通启动 I/O 与空间失败面；共同构建内容身份仍成立。Web fixture、原生非 React 例外均限定现有边界，不新造 runner。
全部六份工件回读 APK/selection/previous/candidate、UNKNOWN/BUSY/取消、asset/file、reset/角色、fixture、uiautomator 与官方链接的同根条款；Journey/IA/UI 的等待与 readback 表同步修正。仍出现 BLOCKED_FOR_DEXTER_DECISION 的 Journey 前提是企业签名/设备/API/执行授权，不是已经批准的 TR-09 决定；不删除真实外部操作前置。

## 5. 通用失败模式与防再犯落点

主要落点：本 intake 的明确 review checklist；本轮不写项目记忆/标准/源码。未来 focused/red 已落在详设与计划对应 CP，不声称测试已存在。

| 问题族/根因层 | 有限适用集 | 反例边界与最小复用解 / review checklist |
| --- | --- | --- |
| 工件缓存身份未绑定宿主；native selection 层 | selection/previous/candidate 与 boot/readFacts | 同 APK reload 保留；任意 APK identity 变化失效。逐一追踪声明→beginBoot→loader→actual/confirm，不能只检查回退目标 |
| 未观察到结果被误当永久未知；native installer/owner 转移层 | INTENT/STAGED/COMMITTING、BUSY_UNKNOWN、session/包读回 | 查询失败≠空 session；仍存不可判定保持 UNKNOWN；确证结束未安装→等待新邀请。检查新 action flush 与旧回调隔离，不盲重 commit |
| 为统一封装而扩大正常启动成本；publisher/loader 层 | 两 App 的 INSTALL/FULL/HOT 与 embedded/file恢复 | 内容身份共同来源≠相同 runtime 文件布局。分别证明 asset/res 和 file/offline，不引入 embedded 复制；缺 HOT 不隐式 fallback |
| 重载与根级清除混淆；规范/调用链层 | 根级取消原因、topology 与系统 reload | 沿真实调用区分 requestApplicationReset 与 resetRuntime；只按本轮裁决更新 future 正本前置 |
| 测试事实进入生产默认；composition/build 层 | Web unavailable/fixture 与 source provider | 显式 automation-enabled 注入；production 夹 fixture 打包红，不能缺能力自动 mock |
| 技术 UI 归属漏列；driver/交互层 | installer/settings/native failure 与 React 节点 | 非 React 窄例外只覆盖登记三类，Text 只读；React 始终 agent，不复活旧入口 |
| 从组织名猜官方来源；第三方依据层 | RN v0.86.3/Expo 固定 commit | 查实际重定向和 tag 内容，不把看似异常 URL 升级成失效事实；静态官方语义≠设备 proof |
| 证伪成本后移；阶段安排层 | 可选一次性 F-LOAD/CP-03 正式 proof | 提前探针仅技术证伪、另行授权、用后移除；最终 owner+保护链仍不可省 |

## 6. 未验证与外部差量交接

规范同步/focused red、实际 Gradle/Maven/native Hermes/ZIP/API/签名/系统安装、APK identity 复位、两路径资源、boot/context 时序、数据兼容、预算、automation update phase 与全部新 case、business/cleanup 都未运行。UI 看图仍 UNSET。
本轮静态检查了文档、相应本仓源码及精确官方来源，没有新 implementation proof，不能给作者独立 GO。
差量外部请求：`doc/review/platform/2026-10-06-ter-version-update-stage-a-design-delta-review-request-claude.md`。只读复核当前字节，不重开内部 cycle、不授予实施/动态或 B/C 权限。

交接前仅运行该请求文件的只读结构检查 `scripts/check/claude-review-handoff --file doc/review/platform/2026-10-06-ter-version-update-stage-a-design-delta-review-request-claude.md`，结果 CLAUDE_REVIEW_HANDOFF=PASS；这是文档结构检查，不是 scripts/verify、应用测试或动态 proof。纯读取重新核对六份 SHA256 与本表一致，需求完整 SHA256 未变；没有新增独立 DESIGN verdict。

## 7. 外部差量复核后三条注记与界面确认（最新）

### 7.1 来源与证据范围

来源：`doc/review/platform/2026-10-06-ter-version-update-stage-a-design-recheck-claude.md` §4，外部 verdict=GO_WITH_UNVERIFIED_UI、M/S/N=0/0/3，对应详设19a52bdd…、计划ab6431d1…等六份旧字节；旧报告不修改、不升级为本轮新字节的独立 verdict。前三项S与五项N在该外部报告中全部关闭，链接重定向事实仍按该 reviewer 的 UNVERIFIED 边界保留。

Dexter 随后明确“界面内容我都确认”，已在 Journey、IA、UI、详设与计划登记三个面内容为 ACCEPTED；这是内容接受，UI/设备行为仍 NOT_RUN。当前作者为续接会话，只作获授权的小范围文档修订，不产独立 GO。内部 cycle 未重开，没有第三轮或新增外部完整复核请求。

本轮实际操作为仓内文档/源码纯读取、官方一手资料核实、六份设计文档与本 intake 写入和 SHA-256 重算；未运行任何安装、生成、编译、测试、verify、DEV、Web、Android/设备、reset/seed、L2、UAT、部署或 cleanup。需求、规范正本、项目记忆、源码与依赖未修改。

### 7.2 逐项处置

| finding | 核验分类 | 文档处置 | 当前准确位置与最小修正 | 剩余项/是否需 Dexter |
| --- | --- | --- | --- | --- |
| N-a metadata 不能代替 APK 实际入口字节 | CONFIRMED：原打包门未明确 RN Gradle 另一轮 Metro 产物的反例；是设计判据缺口，未声称实际打包已出错 | CLOSED | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:142、277、328`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:31、36`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md:51`。从最终签名APK解真实入口，摘要等于compiled发布树入口；资源清单与assets/res名称映射核对；保留metadata却替换入口的红例必须失败。AAPT转换drawable不作原始字节相等比较，实际离线可用性另由F-LOAD证明 | 打包门与红例尚未实现/运行；无产品裁决 |
| N-b 低 API 未提交 session 可能长期 UNKNOWN | CONFIRMED：官方isCommitted是API29新增；固定Android7/9 AOSP在启动读session时使用三天年龄阈值，没有三天必回收保证；其他API/OEM不外推 | CLOSED（设计分支补齐） | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:222、337、351`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:22、64`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md:38、39、51`。最低FULL设备API二选一，实施前交Dexter；≥29明确未commit且可合法续接才继续；低API无法判定时UNKNOWN直到实际回收/明确结果读回，不猜TTL、不建恢复机制。update.interruption按获批范围验收，未选分支不得写PASS | 最低FULL API产品选择 OPEN/DEXTER_DECISION；具体设备/系统行为与focused/native proof NOT_RUN；未修改minSdk |
| N-c retain 不是按 reset 原因过滤 | CONFIRMED：`apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts:80–84`按slice.resetIntent；当前生产调用仅`apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:199`，Runtime测试调用排除在生产集合外 | CLOSED | `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:170、349`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:43`；`doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md:66`。TR-09未来同步同时说明slice机制、唯一生产触发点和新增调用前重评义务；采用明确文字与CP-02 review checklist，保留字段focused/red，不加原因过滤/独立扫描门 | 规范正本同步仍待实施授权、须CP-02前完成；focused/red NOT_RUN；原例外已批准，无需重问 |

三项 CLOSED 仅指文字收敛，不表示最低 API 已裁决、规范已同步、门已实现或任何运行通过。PARTIALLY/OPEN 文档修订项无；实施前的 API 产品决定仍 OPEN。

### 7.3 同根扫描与防再犯

N-a 同根落点是“声明身份不等于实际产物身份”：检查两App INSTALL/FULL/HOT 的共同发布树、最终签名APK实际入口及资源映射，不能只读metadata或只测一个App。最小解复用CP-01原打包门，不新增发布系统。

N-b 同根落点是“平台观察能力受API限制，未见结果不能猜资源已结束”：readback、COMMITTING、BUSY_UNKNOWN、ENDED_NOT_INSTALLED与update.interruption统一遵守成功查询和明确状态；不加应用回收期限、轮询或自动抢占。官方阈值仅作精确版本事实，不升级为目标设备SLA。

N-c 同根落点是“产品限定原因不等于通用机制过滤原因”：CP-02和后续新增生产reset调用的review checklist必须重查调用集合与retain影响。当前一处生产调用可直接审阅，另加门的维护成本不值；测试中的其他合法reset原因不得被误算为生产扩权。标准正文仍只在未来授权后修改TR-09唯一正本，不在本轮复制为生效规范。

界面同根扫描已更新详设§0/§3a/§12、计划§0/§11、Journey§1/§5/§7、IA§1/§5、UI§1/§1.2/§7/§9/§10；六份当前工件不再残留“未看图/未接受/UNSET”前置。历史报告和本 intake §1～6保留原状态。

### 7.4 当前六份设计工件 SHA-256

| 文件 | 本轮小修订后 SHA-256 |
| --- | --- |
| `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md` | `6bf13303624f146ea989d6e7f46b4b06758f766a02b9b11874f1e23a8734b5cd` |
| `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md` | `99e368ecd6ac20f16e0d0f2e5694514fb201e5203485bbcf1badeb7ee62f11c0` |
| `doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md` | `587702fb6164ba970a3913b8dc2e1383a774900f15af9c9e6b7b42c43e69a777` |
| `doc/decisions/2026-10-06-ter-local-update-journey-claude.md` | `bd44a2b3865f8a5a8ff2a0421e3ad3a33f96e042e9b2bc28bc04544508dc904f` |
| `doc/decisions/2026-10-06-ter-local-update-ia-claude.md` | `7649f91f272d20fc00a018b7efe1625c560ce0a37bbe7c06e5374c09c316c61d` |
| `doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md` | `c7bd2dd1dff343297005c78b4e2fc3664c888bc533471f5d729f33278d7db59e` |

只读需求完整SHA-256仍为`f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22`，与上一轮相同。

### 7.5 后续边界

无需再交外部完整复核；若Dexter要求，仅复核这三处差量。三个面内容确认已获得，尚须Dexter确定最低FULL API及后续实施授权。授权须涵盖CP-02前TR-09正本同步；本轮不代为授予，不开始阶段A源码或任何动态运行，也不进入B/C。全部新能力、F/V、设备行为及cleanup继续NOT_RUN。
