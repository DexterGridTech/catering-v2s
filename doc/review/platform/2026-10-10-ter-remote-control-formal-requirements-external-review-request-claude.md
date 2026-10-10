# TER应用内远程控制：正式需求外部评审交接

## 背景

本稿记录Dexter的远程协助目标、四种终端拓扑、成熟LiveKit能力和TER既有owner通路。当前正式稿SHA256为 `4fa449bfc45adb6c64ae229ad09bf3a01ac23550e0d070a3611c11fc49cd1730`。R1为NO-GO 0M/4S/1N，R2为NO-GO 0M/1S/0N，各自对应旧字节。确认项修订后，经Dexter“直到GO”的明确追加授权，同cycle R3 fresh独立结论为GO_WITH_UNVERIFIED_UI、0M/0S/0N；作者修订不改写历史verdict。

新增裁决已逐字写入：遵循TER整体用法，不自创机制；保密不是本专项需求，不为其过度设计。入房grant沿既有command/request及普通peer传递，不增加私密channel或结果框架。Codex仍在做阶段C，未联系或干扰该工作。

## 评审目标

从原话、适用项目规范、当前源码和官方依据出发，判断本需求是否完整、合理、可作为详设输入。重点为普通四拓扑远控、唯一owner、明确控制协议及无额外保密机制；不要继承作者分类或历史verdict。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`：仓规与执行边界。
- `project-memory/index.md`全部kernel、`project-memory/decisions/deterministic-context-only.md`及六维命中原文：治理与架构来源。
- `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md`：本次被审对象。
- `doc/plans/platform/2026-10-10-ter-remote-control-requirements-discussion-claude.md`：原始需求、逐字裁决、源码与官方研究导航；讨论稿历史推演不覆盖正式稿与新裁决。
- `doc/platform/review-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/frontend-coding-standard.md`、`doc/platform/backend-coding-standard.md`、`doc/platform/third-party-library-usage-standard.md`：适用判据。
- 正式稿引用的CBS terminal-control、TDC认证HTTP/root结果、Runtime actor/request ledger、Topology peer/selector、server-config、Android Window owner、operations-admin与admin-ui-foundation当前源码：核实实际复用接缝。
- `doc/review/platform/2026-10-10-ter-remote-control-requirements-r1-review-codex.md`、`doc/review/platform/2026-10-10-ter-remote-control-requirements-r2-review-codex.md`、`doc/review/platform/2026-10-10-ter-remote-control-requirements-review-intake-claude.md`：在独立形成判断后读取，核对旧SHA及处置，不作为结论来源。
- `doc/review/platform/2026-10-10-ter-remote-control-requirements-r3-review-codex.md`及输入checklist：当前字节的独立结论与实际静态读取边界。

## 独立核验重点

1. 新列和详情入口属于运营管理后台现有项目终端面；权限、点击时占用反馈、全屏一/双视频、无语音、终端无感与本地同时操作是否落实。
2. CBS独占/在线operation、TDC凭证与认证HTTP、remote-control command/actor/selector、platform-ports、Android SDK/Window/输入和Topology peer是否各守owner。grant使用普通非持久request和peer，不另建秘密或业务状态体系。
3. R07描述/端点/grant、R08 start/stop/副机join及confirm command、R13八类控制消息和R14–17握手/手势/存活/结束是否字段完整，sender/receiver及坐标/stream归属可编码。副机不连接TDS，不创建CBS独立终端；任屏断连结束整会话，手动重新发起。
4. MASTER初始HTTP与续约、副机普通peer初始/持续确认、join后独立确认、正常持续超过30s和几何重握手的有界停止是否闭合；不能用JWT/心跳替代当前应用有效期，也不能为此引入恢复框架。
5. T01–04与V01–15只为后续设计/验证判据：候选依赖没有解析，Window视频桥、输入、SDK兼容、真实网络与cleanup未证明。评审需求合理性，不要求现在运行，也不把计划写成PASS。

## 期望结论

明确GO或NO-GO及M/S/N；无实质阻断且只剩UI/技术未验证时，按review-standard给出GO_WITH_UNVERIFIED_UI。每项finding附精确路径/行号、事实或推论、影响、最小修复及是否需Dexter裁决；区分静态已确认、设计缺口、官方依据与OPEN/NOT_RUN。

## 可直接复制给 Claude 的话术

```text
Dexter 转交：

您好 Claude，烦请独立评审《TER 应用内远程控制》正式需求。

背景：本稿已记录完整链路和控制协议。Dexter明确要求遵循TER现有架构，并确认“保密根本不是我的需求，请不要过度设计”。当前SHA256为4fa449bfc45adb6c64ae229ad09bf3a01ac23550e0d070a3611c11fc49cd1730。已按“直到GO”的明确授权完成三轮fresh独立需求审查，当前结论GO_WITH_UNVERIFIED_UI、0M/0S/0N；前两轮NO-GO仅对应各自旧字节。旧verdict和作者intake只是核验线索，不是本轮结论。Codex在途阶段C未被修改或打扰。

目标：从原话、项目规范、当前源码和官方依据独立判断需求是否完整、合理、可实施，以及是否忠实复用TER command/actor/request/selector、peer和port/adapter；主动寻找普通主流程反例，避免额外保密机制与极端情况框架。

请从catering-v2s仓库根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md；
- project-memory/index.md的全部kernel、project-memory/decisions/deterministic-context-only.md及六维路由命中原文；
- doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md：被审对象；
- doc/plans/platform/2026-10-10-ter-remote-control-requirements-discussion-claude.md：原始需求、裁决与官方/源码导航；
- doc/platform/review-standard.md、doc/platform/terminal-coding-standard.md、doc/platform/frontend-coding-standard.md、doc/platform/backend-coding-standard.md、doc/platform/third-party-library-usage-standard.md；
- 正式稿引用的CBS terminal-control、TDC、Runtime、Topology、server-config、Android Window、operations-admin和admin-ui-foundation源码；
- doc/review/platform/2026-10-10-ter-remote-control-requirements-review-intake-claude.md及其引用的独立报告：先形成自己的判断，再作历史对照。
- doc/review/platform/2026-10-10-ter-remote-control-requirements-r3-review-codex.md：当前字节独立报告，同样仅供后续对照。

请重点独立核验：运营项目列表与权限入口；四拓扑的屏幕/participant归属；CBS→TDP→MASTER→普通peer副机→LiveKit画面与输入全链路；R07/R08的描述、授权及command结果，R13的八类消息与R14～17的握手、坐标、正常触摸、断连全结束和手动重发；MASTER与副机有效期来源及持续确认。grant沿现有request/peer，不增私密通道或第二状态体系。副机不连接TDS、不创建独立业务终端。请同时检查方案是否简单、有轮子可复用，以及是否有不必要的复杂度。

T01～04仍OPEN，V01～15、UI、实现、依赖解析、部署与cleanup全部NOT_RUN。官方API存在与静态审查不等于SDK组合、连续视频或真实输入已通过；请不要把未来计划写成当前PASS。

烦请给出明确GO或NO-GO与M/S/N；已知阻断全部关闭、只剩未验证UI/技术项时，按评审规范给GO_WITH_UNVERIFIED_UI。每项finding请列精确文件/行号、事实或推论、影响、最小修正及是否需Dexter裁决，并单列方案合理性、静态核实与未验证项。

授权边界：本次仅为正式需求的独立静态评审，不授权详设定稿、生产实现、规范/记忆修改、依赖安装、生成、构建、测试、verify、DEV、reset/seed、Web/设备、L2、UAT或部署，也不涉及Codex在途阶段C。谢谢。
```
