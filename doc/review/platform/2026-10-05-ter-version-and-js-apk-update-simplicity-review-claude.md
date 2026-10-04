# TER 更新需求讨论稿 · 简洁性与成本审查

日期：2026-10-05。范围：需求讨论稿及对应真实能力，非 implementation review。

## 1. 输入、独立性与结论边界

Dexter 要求接受其他收敛建议，重审整稿有无过度设计及小功能大成本。主 agent 读回全文、用户裁决和 owning source；两个只读子 agent 分别负责整稿独立反例审查、原生与复用成本核查。只有主 agent 修改文档，没有联系正在工作的 Codex。

独立整稿 reviewer：`/root/update_simplicity_review`；辅助成本 reviewer：`/root/update_native_cost_audit`。独立 reviewer 在主 agent 修订前形成结论，未读取旧 verdict；辅助 reviewer 不代写整批 verdict。两者均已完成，未写文件。

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=ter-update-requirements-simplicity-20261004
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/2/2
L1_ENGINEERING=S-02 接受状态与文字冲突
L2_USER_VISIBLE=S-01 失败终态与后继规则衔接缺口
L3_UNVERIFIED=空（仅评需求定义，没有宣称已实现UI）
EVIDENCE_TIER=STATIC_DOCUMENT_AND_SOURCE_ONLY
```

上述 verdict 仅对应讨论稿修订前 SHA-256：
`17de7f6f7812112cfa2b31dc71a110a85a9585661a72051639a300c97c86f833`。

文件：`doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md`，旧版612行。主 agent 修订后633行，SHA-256：
`934365fa31296ecd90c278b88ac9e83adf4767bd7042b47743d12b4bef6e3c0b`。

以上为成本收敛修订时的快照；其后 Dexter 同日确认 FULL／HOT 配对及两端校验分工，讨论稿字节再次更新，以上 hash 不代表后续裁决后的当前字节。未取得另一个独立 verdict，不把作者处置或产品确认升级为 GO。此 cycle 是针对 materially revised 更新需求的第一次简洁性审查，不重开 TDP 或激活专项 cycle，也不授权正式详设／实施。

独立最小输入：当前讨论稿全文、当前人类裁决、`AGENTS.md`、`.agents/skills/cs-review/SKILL.md`、`doc/platform/review-standard.md`、`project-memory/index.md` kernel、终端规范的 owner／command／selector／state 条款及以下 source。历史缺口报告不作为本轮结论。

## 2. Findings 与主 agent 辩证处置

### S-01 固定任务缺少失败终态退出边界

- 性质：`CONFIRMED`，文档事实及失效推论。
- 旧位置：讨论稿 §12.3 L357–359、§19.1 L542–546，对照 §19.4 L583。
- 反例：R1坏 HOT已回退且禁止自动再试；每次启动仍优先恢复 R1，则 R2修复工件永远无法进入。
- 影响：固定执行会变成永久占用。直接被新规则抢占则违背裁决。
- 最小修正：未终结时只续接原目标；有限重试耗尽／明确失败／已回退进入失败终态，保留身份和原因；后继启动可选新规则。同工件不因广播／启停自动重试。
- 排除反例：等待用户安装、手动启动、HOT闲时不是失败；installer结果未知不盲目重复提交。
- 主 agent 处置：当前 §12.3 L358–360、§19.1 L547–549已明确。采用现有任务状态，不新增队列／取消界面／重试服务。
- Dexter：本轮已接受有限失败处理建议；无新增产品请求。

### S-02 已接受建议仍被标为未裁决

- 性质：`CONFIRMED`，人类输入与文档状态冲突。
- 旧位置：L37、L65–88、L357、L489、L493、L495、L537、L546、L557、L569。
- 影响：后续重复申请同一裁决，或把产品确认误当技术证明。
- 最小修正：四字段、发布单源、有限失败、启动恢复、点击采集标记为已接受方向；保留真实原生／安装／资源验证 OPEN。
- 主 agent 处置：§3–4、§18.2 L490–497、§19 L538–588已同步；runtime本期选更小的显式标识，自动fingerprint后移。没有写成任何实现 PASS。
- Dexter：“其他要收敛项目，都按你的建议”为产品方向授权，不是运行授权。

### N-01 回退数据兼容须限定适用窗口

- 性质：`CONFIRMED`，有歧义的要求边界；未确认到已有全量迁移框架。
- 旧位置：L148、L555、L585、L607。
- 影响：可能误扩展为所有旧包兼容、整个store快照及无限期兼容维护。
- 最小修正：只检查本次加载到启动确认窗口可能修改的持久字段及一个指定成功恢复目标；无条件不自动加载旧包。
- 主 agent 处置：当前 §19.4 L588、§20.1 L621明确窗口和范围；具体字段留详设。HOT启动已确认后的业务错误不自动回退。
- 更小替代：复用既有字段持久化与flush；不回放Promise／request，不复制store。
- Dexter：无新增产品取舍；不能削弱安全回退条件。

### N-02 启用校验不能依赖不存在的全设备版本事实

- 性质：首次处置为 `PARTIALLY_CONFIRMED / DEXTER_DECISION`；后续 Dexter 明确同意配对及两端分工，现为 `CONFIRMED / CLOSED_BY_DEXTER`。产品文字闭合，不是实施证明。
- 旧位置：L268、L491、L528、L554；副机边界 L371–379、L612。
- 反例：FULL内嵌JS4，主机最后报告JS3，副机实际JS5但不上报。CBS不能据此证明所有设备不需要HOT续接。
- 影响：若设计把该证明加为启用前置，会引入副机登记／全体在线盘点，违背用户边界；若静默改成仅终端拒绝，也改变已确认语义。
- 最小建议：CBS验证声明的固定FULL／HOT及runtime配对，TER依据本机真实版本做执行前准入；各据可得事实拒绝。不新增设备可见性系统。
- 主 agent 初次处置：成本收敛快照 §18.2 L492、§20.3 L629–631列明限制与候选。保留“缺少兼容HOT拒绝启用”原则，没有自行改拒绝时点。
- 后续裁决：Dexter 回复“同意，FULL/HOT 是应该配对的”。讨论稿 §9 第19条、§11.1、D-04及§20.3同步为已确认：CBS拒绝不合规静态配对，TER拒绝与本机实际事实不兼容／主动降级的执行；不新增副机上报或全体设备盘点。FULL-only单段更新仍保留，不把本次确认扩大成所有完整规则强制附带HOT。

## 3. 成本判断与更小替代

本期删除／后移：自动runtime指纹、逐workspace／增量更新、通用依赖图、两机协调／共享下载、复杂忙闲监测、全state快照／所有历史兼容、后台任务进度／永久流水、独立PKI／审批、后台提醒服务、通用恢复队列。§17候选能力表不冻结方法数量。

必要成本不能删除：固定FULL→HOT任务跨启动保存，实际bundle及资源加载，完整文件与runtime核验，系统installer确认／回读，既有持久字段flush，原生有界启动保护。降低这些要求会直接破坏已确认行为。

真实复用缺口：

- `apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalNetworkModule.kt:173-186`将HTTP响应限长读成UTF-8文本。配置／代理／网络底座可复用，但APK／ZIP需要具名流式文件能力。
- `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java:1115-1165`仅允许图像／mp4。复用对象存储生命周期，扩展更新ZIP，不另建存储平台。
- `apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx:247-278`携带contentFailure；`apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx:611-625`区分成功内容与失败内容，失败也可以释放splash。直接“splash已隐藏＝更新成功”不能采用。
- native当前Activity身份不等于JS启动／工件身份；坏JS不能依赖自己的timer救援。PRIMARY成功链＋目标身份＋原生期限T是必要的小闭环，不是全页面健康框架。

主 agent逐项回读以上源码；未把“尚未实现更新”本身升级成讨论稿finding。未删除既有安全审计或必要日志。

## 4. 同根扫描、模板与未验证项

`SAME_ROOT_SCAN`：候选失效、固定续接、暂时下载失败、明确安装失败、等待安装／启动、结果未知、HOT失败回退、修复工件八类；五类接受状态；四处数据兼容；FULL／HOT静态配对和主副版本事实来源。旧待裁决措辞已扫描并同步，不把技术OPEN一起关闭。

`TEMPLATE_COVERAGE`：Journey §1–7、IA §1–6、交互 §1–10、implementation-facing §0–14及附属节全部 `NOT_APPLICABLE_WITH_REASON`。当前是需求讨论稿，任务不要求现在新增这些工件；强行补模板本身会增加无必要工作。

`DESIGN_GAPS`：N-02判据来源已由后续人类裁决收敛；后续详设仍须依据真实API闭合文件／资源加载、installer与恢复，不在需求期冻结七方法接口。

静态已确认：讨论稿裁决、依赖职责、现有首屏成功／失败分离、下载／asset复用的具体缺口。前轮官方来源仍按各自版本和适用范围引用，本轮未新增网上行为证明。

未验证：实际native Hermes解析、HOT资源离线加载、installer目标设备行为、跨启动持久化、点击采集覆盖、启动超时／旧确认隔离／恢复、双屏与配对保护。生成、编译、构建、测试、verify、DEV、reset／seed、Web、Android、VM及cleanup全部 `NOT_RUN`。

主 agent只新增本记录和修订讨论稿，没有修改源码／脚本／测试／依赖，没有读取`.runtime/`，没有发起实现或动态运行。当前任务完成条件是全稿成本审查和文档收敛，不是正式需求批准或技术可用性证明。
