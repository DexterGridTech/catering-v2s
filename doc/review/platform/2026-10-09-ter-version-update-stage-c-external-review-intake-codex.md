# TER 版本更新阶段 C：外部评审作者处置

## 0. 来源、状态与授权

AUTHOR_SESSION=续接作者会话；DOCUMENT_KIND=FINDING_INTAKE；INDEPENDENT_VERDICT=NONE。
REVIEW_CYCLE_ID=ter-version-update-stage-c-design-2026-10-09；本轮不召集内部子 agent、不重开 R1～R4。此前外部报告 `doc/review/platform/2026-10-09-ter-version-update-stage-c-external-design-review-claude.md` 是 **GO_WITH_UNVERIFIED_UI、0M/0S/5N**，仅对应 §1 的旧 SHA，不能转成当前修订字节的独立结论。本文件只记录作者重新核验及文档处置。

Dexter 仅授权六份 C 设计工件及本 -codex intake。需求/规范/项目记忆、A/B 文档、生产源码/测试/依赖未写；不读 `.runtime/`，不执行生成、编译、测试、verify、Web、真机、虚拟机、DEV、seed/reset、L2/UAT/部署。实际 UI、全部 C 实现/运行与 cleanup **NOT_RUN**；A/B 出口 **OPEN**。

Dexter 新裁决：console 真机单机双屏、wallpaper mobile 安卓虚拟机，单机2 run；每 App 各一组同 App 双安卓虚拟机配对2 run；共4设备run。非 adapter 先两个 integration Expo Web，后上述四个设备run，最后13c。该清单是设计输入，不是运行授权。

## 1. 历史输入与当前六份字节

| 工件（仓根相对路径） | 外部评审旧 SHA-256 | 当前 SHA-256 |
| --- | --- | --- |
| `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md` | `0ed55be74354f05bcbae9ae5691f368822c017b98bfb7f585b12c635cd55ad05` | `6b404d181b47957fa7da864b43ca7d1017cce6a55e148d5c2c0b50a4f889bc04` |
| `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md` | `167c08d0752028513a836a453ddbeae721e34862983865357b36665fb8ae360b` | `b1e0ca56f1773afa120f5a24243782acb49e9e259b2f48b7d5bae95c85fd6c96` |
| `doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md` | `115ab84603d6f628aceecde16a61de114ad12aad9cf70d970cc682e06cc5b4ef` | `dfcfede3b8dc6af519f37d890bd5db1b5c67cc78b4354587407317545c11412a` |
| `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md` | `15f790d1901a06f28e3e1a5e4cadb223bd0e203996b167332740fd1056a19fe1` | `dc33c7b5038cbe2b79ea644b8b805507b49e1c1befdc70d2822f0df8c7e6deae` |
| `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md` | `09674c2a8359263c17b65b1e7a6c9e1ed3a642f5df28051af541c95dda3597f6` | `0cb95ebd9372da3cad0c3105a758804853e0a1f95b45ee14785b16d4a6570787` |
| `doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md` | `90260a49a8290533f14fa0d5c18d120333beccc23a2add06fae85498d62dfb7e` | `774f37c4bc7d42775f118b5982aa18b0f394e14f470bac2c436d4a4b72b4be8a` |

## 2. 逐项核验、最小替代与处置

CLOSED 表示文档源头闭合，**不表示实现/动态已通过**；运行证明单列为 OPEN/NOT_RUN。

| 输入 | 作者分类／状态 | owning source／反例 | 最小修订与当前位置 | 是否还需 Dexter 产品裁决 |
| --- | --- | --- | --- | --- |
| N-1 | CONFIRMED／CLOSED | TerminalUpdateArtifactPreparer.kt:267–301 extractFull＋304–322 validateFull 只用 APK path/digest/package/version/signer；未安装 APK metadata 是额外分叉。安装后 metadata 是不同职责，不能误删。 | 删除额外解析，summary 只重建同既有字段；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:230`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md:69`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md:61` | 否 |
| N-2 | CONFIRMED／CLOSED | webPlatform.ts:147 topologyHost unavailable；Android TerminalTopologyServer.kt:122–130 承载真实 HTTP/WS；未改 HELLO/moduleName 检查不应进入设备新分母。 | pair 仅 F双Runtime codec/apply→双虚拟机 P＋H，TR-16 adapter 适用性理由；Web移除projection，异App拒绝静态/既有focused；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:348`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md:109`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md:112` | 否 |
| N-3 | DEXTER_DECISION／CLOSED（已选交叉覆盖） | 不需要两 App×两形态4个单机run；已裁单机2＋pair2，仍保留两个App各一组同App配对。 | 设备矩阵、顺序与预计run数同写；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:322`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md:112`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md:85`；`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md:38`；`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ia-claude.md:60`；`doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-ui-interaction-claude.md:131` | 无剩余矩阵待决 |
| N-4 | CONFIRMED／CLOSED | types/terminalUpdate.ts:51 已有bootId；actor:710、1006 的确认覆写会占继任boot；:969也需回读，:677执行、:1194初始、:900–905释放要一起处理。 | 复用task.bootId，不新增字段；五写点及读点全表，prepare/directapply前更新并flush，确认不写；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:128`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:171`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md:54`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md:66` | 否 |
| N-5 | CONFIRMED／CLOSED（实现准入仍OPEN） | canonical TerminalUpdateReportRecent.state/reason 当前未包含C新增值；B仍并行实施，不能从当前canonical推测最终terminal_report约束或null-task合法性。 | CP-01读最终列/约束/null-task recent；优先B final，缺约束时C唯一具名差量Flyway；无约束则零SQL并说明；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md:15`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:250`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:286`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-source-and-api-appendix-claude.md:68` | 否；真正产品/数据冲突才另交Dexter |
| 执行面／网络／资源 | CONFIRMED（版本前提部分确认）／CLOSED_DOC，能力OPEN | 既有driver仅reverse；normalizePairHost actors.ts:124–130及pairByHost:500–503 固定port，仅裸host；直接tcp:0后传URL不成立，SLAVE拓扑端口reverse还会与配对前本机host冲突。 | 唯一driver增加MASTER固定端口forward，SLAVE裸10.0.2.2；现有reverse不改，显式四role/serial、单屏laptop注入、预算/首败/cleanup；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:101`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:326`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md:81`；`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md:83` | 否；能力不符停CP-01，不能改方案/减分母 |

## 3. 同根扫描、根因与防再犯落点

主要防再犯落点是本节明确的 **实施 review checklist**；本轮没有权限修改规范/记忆或新增机器门，也没有代写测试。未来测试扩展由计划对应 CP 执行。

| 问题族 | 有限扫描范围及其余成员 | 根因／最小复用解／反例边界 |
| --- | --- | --- |
| FULL/HOT来源分叉 | 三个 prepare 消费面：副机FULL、副机HOT、主机复用；修副机FULL后其余2已逐一检查；六工件相关描述其余5已逐一读回 | 勿因trusted summary新造parser。FULL两层digest＋现有validate；HOT仍读其ZIP清单；已安装boot metadata明确保留 |
| Web/adapter执行面 | §11共10场景；pair调整后其余9逐一检查：选择/fixed/idle/邀请策略/full-hot非native先Web；grant原F/HTTP/native；report策略Web＋真实HTTP；supply原helper；cleanup资源检查不伪UI | 以被测行为识别adapter。focused双Runtime不伪Webpair；非adapter部分不借pair跳Web |
| 设备矩阵 | 四设备run＋两个integration Web；six docs其余5均逐一核对；pair两个App分别，非跨App | 覆盖形态与App，不重复2×2；所有serial明确。pair物理单屏和业务laptop分开，不能把driver shape=mobile当mobile业务 |
| 执行与确认身份 | actor五个bootId写点677/710/969/1006/1194、读取673/904，prepare/directapply/FULL→HOT/结束再提交路径；删确认覆写后其余写点逐一处置 | 单字段执行boot，port前持久，纯确认不重新占名额。无权威boot/flush失败零port，不引新账本 |
| 报告枚举持久化 | state2项、reason3项、taskId=null recent；canonical/生成/owner/PG约束/运营呈现/场景及six docs其余5逐一核对 | 条件迁移而非“绝对无Flyway”；无task观察与任务历史区分，不新表/operation |
| 网络资源所有权 | 两device角色/两agent session、MASTER forward、现有reverse、browser/build/APK/staging/fixture；控制表/原子组/CP05/cleanup/附件及其余five docs已核对 | 复用当前driver参数数组ADB和ownership；setup即登记，未知端口/映射冲突failclosed，失败清部分自身资源，不全局remove/kill |

两次交叉读回的统一事实：同App＋副机零TDS/零credential/零报告；规则投影不覆盖本机task；既有task.bootId；FULL无额外APK metadata解析、HOT清单不变；Web非adapter先行、pair adapter例外；4设备run；B报告约束准入/条件Flyway；旧verdict不迁移至新SHA。

## 4. 网络官方依据与证据边界

静态读到 SDK Platform Tools 37.0.1、Emulator37.2.12、根node_modules adbkit3.3.9；没有启动adb/模拟器。详情及官方链接见C附件§3。

外部“模拟器默认互相不可达”只对早期默认隔离网络成立；官方36.5起共享Wi-Fi支持互通。因此该前提为 PARTIALLY_CONFIRMED。C仍采用唯一显式forward＋10.0.2.2路径来避免动态IP/发现，不新增网络方案选择器，也不改变端口/host契约。

ADB main一手命令源码支持no-rebind/list/remove一般语法；37.0.1精确tag本次未取得，不能冒充版本绑定源码。实际ADB_PATH/匹配官方源码、API≥29、PackageInstaller/source设置、设备形态、HTTP/HELLO/投影与映射cleanup都留CP-01/CP-05 **OPEN/NOT_RUN**。adbkit3.3.9既有forward/reverse没有no-rebind分支，新forward沿既有数组子进程，不另写wire。

未进行文档检查脚本、生成、编译、测试、verify、Web/真机/虚拟机、DEV/reset/seed或任何cleanup。哈希计算/文本读回不是动态proof。

## 5. DESIGN_GAPS：只登记，交 Dexter 决定是否补正本

1. `doc/decisions/2026-07-24-v2s-verification-governance.md` 没有 M/S/N 定义，仅将severity决策归Dexter。外部指出的是该文件槽位，不声称全仓无定义；本轮不补标准。
2. `doc/platform/terminal-coding-standard.md:673` TR-16列举adapter真实能力时未点名topologyHost；已存在“等”与按被测行为判定。C只说明这次pair的适用性，不把设计写成新通用例外；是否补显式名称交Dexter。
3. `doc/platform/terminal-coding-standard.md` 缺专门说明“record规则投影与owner-only持久化同一slice共存”的判据；现有state record API支持方案并不等于正本已立规则。C仅设计本批字段隔离，是否补正本交Dexter。

这三条不改规范/需求/记忆，也不以新增正本为本轮文档修订阻断。N-3设备选择已裁，无需再次询问。

## 6. 收口与后续

六工件文档修订及作者intake已完成；本轮不再发起内部review轮次、不写独立GO。未来C实施仍需Dexter单独授权及A/B相关出口核实；UI/全部C新增能力、生成/编译/测试/verify/Web/真机/虚拟机/DEV/seed/cleanup皆NOT_RUN。已完成无变化对账不重做，真有差量按影响scope复核。
