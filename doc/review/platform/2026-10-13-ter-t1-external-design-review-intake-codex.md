# TER T1 外部设计复核 · 作者辩证处置与实施交接

## 1 · 来源、结论和授权

Dexter转交外部静态评审文本，仅供参考。其独立盲审NO-GO、0M/2S/0N与后读增补一项保持，不把增补计入盲审、不由作者改写GO。作者亲自重开正式需求、模板、详设/计划和生产源码，以下是作者disposition，不是新独立verdict。已关闭的内部两轮cycle不重开；只读路径定位子agent仅提供现有文件和oracle导航，不承担finding裁决或写入。

Dexter随后明确：“改完之后，即可按照项目话术要求组织话术，授权codex进入实施阶段，按照项目实施要求完成T1详设和实施计划的所有目标，并最终将实施结果交付Dexter和Claude做review”。该指派已写入详设/计划§0与实施进入条件；授权来自Dexter，非作者CLOSED或设计GO。当前编写会话仍仅文档，无源码/测试/脚本/依赖/正式需求修改，无动态运行。

## 2 · 逐项核验与最小处置

| 项 | 主agent事实、边界和classification | 最小修正/当前位置 | 状态与Dexter裁决 |
|---|---|---|---|
| 外部S-1 BRANCH关闭 | PARTIALLY_CONFIRMED：member parts.ts:75/193有两个partKey，:262只映射MAIN；LayerStack.tsx:264缺键落通用关闭。actor actors.ts:342–362将失败表示为layer，owner dismiss本身也调用closeLayerCommand；systemFailureDismissal.ts:4和useDeskSystemNotice.ts:7的按钮走同command。没有源码证据支持另一个业务失败slice残留，拒绝将该推论当已证实后果 | 详设§8.2:170、计划CP02:33、附件§11:242。两key映射同owner命令，layerId不改；MAIN/BRANCH分别验证按钮/back/backdrop层关闭且pending/list不误清 | CLOSED（设计覆盖）；无需新产品裁决/恢复状态 |
| 外部S-2 执行文件泛称 | CONFIRMED：模板§11a明确判据/场景/档位/文件四列；原表确有runtime/state等泛称，未来实施会猜落点。旧test存在不证明新机制覆盖 | 详设§11a:317–340逐V01–18写具体文件、扩例/拟新增、oracle及档位；计划§1:11设其为唯一表，并落实CP03旧13op测试迁15op。4个能力测试、环境wiring及owner-flow等明确拟新增，不开新runner | CLOSED（文档）；运行全NOT_RUN |
| 后读增补 panel归属 | 当前独立新包方案确存在，设计决定撤回。历史“不要新包、指定放admin-shell”原始指示本轮未定位，故不把转述当已证实历史违规；此部分UNVERIFIED。但当前实现/需求R08/R10与讨论§2已有充分证据采用更小方案：section自身无独立资源/事实，保持admin-shell内部module贡献可完成自闭环。结构合理性CONFIRMED | 详设§3a/8.6/8.7、计划CP02:29、附件§1:33/53、§2:81、§6:182。保留组件/section/TestId于admin-shell，配置读写仍kernel command/selector；撤新panel依赖/模块/测试迁包；目标仅新增两个实际native能力包，39当前→41目标 | CLOSED（方案修正）；不改正式需求、不增owner/registry，无需新产品裁决 |

更小替代：S1不加错误slice/恢复框架；S2复用现tests，只补确无落点的能力测试，不复制完整fixture；panel不新增workspace，目录内具名分责任即可。三个方向均减少实施自由猜测或多余接线，不扩业务。

## 3 · 同根核对与防再犯

- 三sample UI共4个逻辑失败partKey、每个laptop/mobile变体已核。会员branch缺键；MAIN已有，staff/wallpaper其余2组均已有映射。按钮/helper/owner/back/backdrop链一并读回，不将所有fallback推为残留业务状态。有限review清单：变体全集按真实partKey核lookup，不按feature数量或只查MAIN。
- 18个V行已逐项填写，所在文件纯读取核对。不存在的8个路径全部明确拟新增/迁移目标/未来review交付物；没有把路径存在当PASS。机械门只覆盖结构，owner/README语义仍独立review。有限清单：每行区分现文件覆盖能力与仍须扩例，避免旧单例factory/显式名单测试冒充新派生机制。
- panel同根覆盖控件表、TestId、module、cp02、地址add按钮、附件职责/迁移/新包数。当前设计中仅保留“撤回/不新增”字样，不残留要求新workspace的执行指令；旧R1/R2及历史intake不改写，按原字节理解。
- 生成tests当前单输出/13op与T1五owner/15op形状不同，CP03明确同步；source不修改。本轮没有新增业务API/规范或替代controller。

防再犯落现直接tests及以上有限review清单，未来实施再产生真实focused proof；不增加全局台账、变更receipt、hash门或动态registry。

## 4 · 当前交付字节

| 对象 | SHA-256 |
|---|---|
| implementation-design-codex | 276e0421b550b255234e4cec12c4f6ba79ecc3f37f1517dd2eb917d25bed03e7 |
| implementation-plan-codex | 37f08f6b674f11d00f698c4e41c376e32a301006da389749a2d919107c4e2fca |
| owner-and-source-appendix-codex | 87094d32b07f9449afe6653ecc667708e4acac56296b3f46d709293f0f517530 |
| formal-requirements-codex（未改） | b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e |
| terminal-coding-standard（本轮未改） | 94b0fcbccb82564b0c50cf5cce19cf7826ef99424f854ee926e07740f0173689 |
| terminal memory指针（本轮未改） | a127b502d244c1c495255a91fefc461b6bec54f3f140fc09ac3ef536d22f7da7 |

S1后果收窄、S2闭合、panel更小归属已文档修正；作者没有对修订字节发独立GO。实施与本批必要C/F/W/D、DEV由Dexter明确授权，不重复索取同一授权；reset/seed、后台L2/UAT/部署非自动附带。设备/有效fixture缺口才按具体事实求裁，不猜serial或账号。

生成、编译、类型检查、测试、verify、Web、Android、DEV、cleanup全部NOT_RUN。只读路径存在核对/摘要不属于运行proof。最新实施话术在同目录`2026-10-13-ter-t1-implementation-authorization-handoff-codex.md`。
