# 阶段 B reset 授权与真实端到端链修订处置

## 1 · 当前任务、授权与结论边界

Dexter 2026-10-09 明确要求：阶段 B 实施 agent 可按需 reset 数据库，无需再次索取授权；核对版本打包→运维后台上传→运营后台规则→TER真实升级→运营后台结果的完整路径，问题直接修订。本轮只改设计文档，不启动实施或动态验证。规范、需求正本、项目记忆、源码、依赖不改。

本文是主 agent 的源码/文档核验与处置记录，不是 fresh 全包 DESIGN verdict；不重开已结束的内部 cycle，不继承旧 GO/NO-GO。两位只读子 agent 分别审查实际调用链/权限fixture及差量反例，未写文件、未运行、不读 .runtime；主 agent 核验后落实。CLOSED_DOC 仅表示本轮文字缺口修订，不表示功能已实现、验收通过或新 GO。

## 2 · 确认问题与最小修订

| 问题族／静态事实 | 最小修订与当前位置 | 处置／产品决策 |
| --- | --- | --- |
| 授权漂移：旧D15.2/P10还要求再询问reset，违背本轮明确授权 | D0.2:70–76、D10b.6:386；P1.1:46–48/P10:132–137；附件20、Journey9：未来实施期按需受管非生产reset已获授权；保留机械确认、身份及CP/6b/准入，不当成现在执行 | CLOSED_DOC；Dexter本轮已裁决，无待重复授权 |
| 分段证明冒充完整链：旧隔离L2直接HTTP报告fixture与TER另一个DEV本地供包run，无法关联同UI保存规则/真实更新 | D15.2a:497–528明确同DEV链，真实UI上传保存/新建启用/TER任务/HTTPreceipt/运营查询历史；P CP05:106/P10:134/P12:147、附件4.4/20及Journey9同步；隔离L2保持独立，DEV主线不冒称L2 | CLOSED_DOC；满足新增验收目标，无额外产品操作 |
| 供给接缝不明：A provider接development/runId，本地fixture target不是CBS真实规则 | D8.4:292–296：同selectionContext加ruleRef；同owner验证当前完整snapshot/context/scope/app并物化target，复用唯一A command；固定后不重新选，B无C自动调度 | CLOSED_DOC；类型与所有消费者在CP04实施，当前未落地 |
| 任职/节点猜测：激活fixture用PROJECT/STORE，规则写需要GROUP/PROJECT及版本写cap | D15.2a:508–509/516/524固定账号、真实登录/任职/节点/路径；IA原权限有效，无新增模型；seed不代替UI动作 | CLOSED_DOC；无新产品决策 |
| 资源归属：DEV已启动两Vite/tunnel，不能TER再起同端口或回收借用资源 | 主agent与只读差量核验后修D501/522，P106、附件20：借用DEV-owned前端和tunnel，TER只拥有新增browser/session/设备资源，独立budget与cleanup | CLOSED_DOC；不引入第二runner |
| 构建与地址：A本地target输入/TDS sink不能沿用；host loopback端口与device reverse端口不必相同 | D505/507：三产物同run suffix/签名、真实版本差异；保留driver、移除target/revisionfixture；Web用hostmanifest URL，Android用device reverse URL映射同DEV host localPort | CLOSED_DOC；仅现有接缝的明确输入，不扩框架 |

## 3 · 独立只读差量核验与同根取舍

两位子 agent 对需求/现文/owning source形成判断，不依作者声明给新GO。均确认原分段链和重复reset授权问题；差量又找出Vite归属与host/device地址反例，主agent再次重开源码并修订。最终build输入、Vite借用义务已由只读回读确认；host/device最后一句由主agent按原生reverse与DEV manifest URL源码修订。

静态依据：`tools/terminal-automation/src/runner.ts:40–94,1061–1075`（case/suite/DEV注入）；`tools/terminal-automation/journeys/update.android.test.ts:612–645,783–889`（本地fixture、device reverse、sink）；`apps/terminal/kernel/base/terminal-update/src/types/terminalUpdate.ts:15–23,62–65` 与 `apps/terminal/kernel/base/terminal-update/src/features/commands/commands.ts:5–8`（正式selectionContext及唯一command）；`scripts/dev/r5-dev-runner.mjs:2403–2432`（DEV-owned Vite/tunnel）；`doc/platform/browser-l2-execution-standard.md:36–40`（隔离L2不得借DEV）；`scripts/dev/reset`、`scripts/dev/r5-reset.mjs`与`scripts/dev/seed`（受管确认/准入）。所有路径均仓根相对。

同根防再犯落在D15.2a/P CP05实际验收义务：不同数据面的通过不能拼成同一链；fixture只提供前提不得替代被测UI或真实报告；actor任职/数据节点分开；host/device地址与借用/owned资源分开。新增case必须接闭集、suite、budget、context及cleanup，不准仅建文件冒充可运行。

成本收敛：两App各一条FULL→HOT真链，不额外重跑完整A或为历史分页重复升级；FULL-only、多task/分页、只读/撤权等沿现有适用focused/backend/隔离L2具名case。无新任务账本、C调度器、MQ、旧runner或删除历史API。未受影响已MATCHED对账不重复。

## 4 · 未实施／未运行

新case、真实B provider、typed消费者、两后台UI及报告接线尚为计划；A交接仍按当前实际验收/差量处置关闭，未继承A已通过。生成、构建、测试、verify、DEV、reset/seed、L2、Web/Android、business与cleanup本轮均NOT_RUN；没有读取或复核运行evidence。未来实施agent按计划完成这些能力，不能把本轮文字修订作为运行证明。

## 5 · 本次受影响文件 SHA-256

- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md`：`bb9387e9a40a883752001593093b026070600ef0294e064dad6e68dd7738333b`
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md`：`acc1fa6524708aa71d7031f6bb7d1e35ee9d8abcda10050b2bf8377ae78787cf`
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md`：`7b082ff295fc8ec7e077451faf5f7d7e5c507972c0199774ac68a010c4490b75`
- `doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md`：`24d397539c15018c7979194116b12ac75ebb22bd06608f57bcdd8553b5502017`
