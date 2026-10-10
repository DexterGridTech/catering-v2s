# TER 版本更新阶段 B：R3 修复差量独立静态复评

日期：2026-10-10。范围：上一轮 S-1～S-4、N-1～N-2 的当前生产源码、生成器与直接测试源码；不代表阶段 B 整批交付。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=findings：无任务版本观察的同绑定上下文变化路径仍未闭合
L2_USER_VISIBLE=findings：合法当前终端可能持续显示 NO_REPORT
L3_UNVERIFIED=HTTP、浏览器、设备时序均未运行；按 Dexter 本轮边界排除，不作为 finding 或放行前置
SAME_ROOT_SCAN=启动/完整上下文/同绑定变化/重启/PONG；HTTP 分类；snapshot 刷新与固定；CAS；两个 cursor 子列表
DESIGN_GAPS=NONE_WITHIN_THIS_DELTA
TEMPLATE_COVERAGE=NOT_APPLICABLE_WITH_REASON：本轮评源码修复差量，不重新评文档模板
EVIDENCE_TIER=STATIC_SOURCE_ONLY
```

## 1. 方法与授权边界

本会话是续接会话，知道原 findings；不声称主会话为 fresh 盲审。三个 fresh 只读子 agent 分别检查 CBS/生成器、TER owner、后台 UI：先以需求、详设和当前源码形成判断，再对照旧评审与 R3 intake。主 reviewer 重开下述 owning source，合并并独立裁决。作者分类、历史 verdict 和局部输出不是本轮独立证明。

仅用纯读取命令和一份评审文件写入。没有运行测试、生成、构建、verify、DEV 或设备操作，没有读取 `.runtime/`、日志、manifest、截图或数据库运行证据，没有修改需求、设计或源码。本轮不扩展到阶段 C。测试源码只说明调用与断言，不代表执行通过；CBS advice mapping JUnit 的 `NOT_RUN` 保留，不据此增加 finding。结论采用 Dexter 指定的源码 `GO/NO-GO`，不因排除的动态验证要求补交 evidence。

## 2. 六项关闭情况

`CLOSED` 均表示当前源码关闭了原反例，未表示动态 PASS。

| 上轮项 | 当前状态 | 当前源码依据 |
| --- | --- | --- |
| S-1 晚就绪实际版本 observation、旧任务身份隔离 | PARTIALLY | `apps/terminal/kernel/base/terminal-update/src/application/createTerminalUpdateModule.ts:126–136` 在完整 snapshot 与当前 context 匹配后补现有 reconcile；`src/features/actors/terminalUpdateActor.ts:814–843` 的 initial observation 不继承旧任务关联。剩余计数门反例见 §3。 |
| S-2 HTTP failure 分类贯穿生成器、TDC、更新 owner | CLOSED | `scripts/generate/terminal-client-api.mjs:600,614,622,624` 为完成 HTTP 的 failure 保留 status；`apps/terminal/kernel/base/terminal-data-client/src/generated/terminalApi.ts:803–816` 同形；其 actor `src/features/actors/terminalDataClientActor.ts:311–315,1143–1210` 保留、返回 typed result；更新 actor `:1017–1027` 将裸 401/403 暂停、schema/完成的其他协议拒绝结束、网络/5xx 保留重试。 |
| S-3 同 context 刷新期间拒绝固定旧 snapshot | CLOSED | 更新 actor `:770` 直接检查现有 refresh in-flight；生产候选初读与固定前重读共用 `targetFromRuleSnapshot`。旧完整值可留作显示，刷新挂起时不可新固定；已固定 task 仍按原任务执行。 |
| S-4 精确 CAS 与原用户 intent | CLOSED | `apps/frontend/operations-admin/src/features/terminal-update/model/terminalUpdateRuleStatus.ts:3–15` 区分精确 VERSION_CONFLICT 并按 intent 产生文案；`ui/ProjectTerminalUpdatePage.tsx:370–397` 只对该码 readback，已达 intent 时告知并关闭；`:1054,1057,1067–1068` 的标题、按钮、提交使用同一原 intent。 |
| N-1 SNAPSHOT_CHANGED 与三次预算 | CLOSED | `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateRuleOwnerService.java:217–219,388` 专用异常；`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java:321–325` 精确 typed409。更新 actor `:653–740` 将此拒绝和成功页 hash 变化纳入同一个三次预算，其他错误直接失败。 |
| N-2 两个子列表 cursor 复用及迟到隔离 | CLOSED | `ProjectTerminalUpdatePage.tsx:151–152` 接 foundation `useCursorStack`，`:964–968,1041–1045` 接 `CursorPagination`；`:444,489` 同步忙锁阻止重复请求；`:458–474,504–520` 核对 context、对象/页请求代次及目标身份，`:465,511` 替换当前页，不追加。 |

上述 `src/`、`ui/` 简写只在同一行已明确的包内解析。六项中五项 CLOSED，一项 PARTIALLY；本轮按独立问题族计数，不重复统计旧 finding。

## 3. 当前唯一 finding

### S-1：绑定周期序号仍被当作当前版本观察的去重标志

- **性质**：`CONFIRMED`；源码事实及可达的普通时序推论。原 S-1 为 `PARTIALLY`，不是另加产品要求。
- **判据**：正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md:226–240` 的实际版本观察、失败保留/补报；B 详设 `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md:324–328` 的新完整上下文清旧 pending、绑定周期序号只作乱序保护、observation 保存当前无任务观察。
- **准确实现位置**：`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:435–444` 同 binding 换 context 清空 pending、保留 `nextReportSequence`；`:542–550` 在 snapshot refresh 中持久执行此路径；`:866–871` 首次 observation 落盘后递增序号；`:1318` 却仍要求 `descriptor.nextReportSequence === 1` 才生成 observation。模块 `apps/terminal/kernel/base/terminal-update/src/application/createTerminalUpdateModule.ts:126–136` 虽补 reconcile，无法越过这个门。
- **普通反例**：当前有效绑定在 context A 形成 taskId=null 的实际观察，序号变成 2；HTTP 暂时失败，正文尚未被 CBS 接受。项目普通信息更新使 `projectUpdatedAt` 变化，context 转为 B。刷新按详设清除 A 的旧 pending、保留绑定周期序号 2；完整 B snapshot ready 后模块调用 reconcile，却因计数不是 1 不生成 B 的观察。后续心跳 handler `actor:1494` 只调 sender，sender `:915–919` 发现空集合直接返回。没有更新任务时，这台合法终端可以持续 `NO_REPORT`。
- **触发来源**：context 字符串确实包含项目更新时间（actor `:478`、模块 `:33–34`）；两个生产 composition 都传入此事实：`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:244`、`apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:212`。不依赖移店、移区、恶意输入或阶段 C。
- **影响**：当前合法配置下实际版本缺失；旧 pending 被正确清理后没有新观察接替。后台不能据此了解终端实际版本。计数递增与当前事实去重是两个不同职责。
- **测试边界**：`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts:320–399` 验证晚 context 的调度；`:1527–1648` 验证初始序号 1、taskId=null、清旧引用和重复 reconcile；`:1256–1264` 验证换 context 清 pending 且保留序号。分开覆盖不关闭“保留序号后再形成新 observation”这个交叉反例。这里只分析测试断言，没有要求运行 evidence。
- **最小可验收修正**：保留同 binding 序号单调，不将它复位为 1。沿现有 owner slice/reconcile，以当前 binding/context 与 actual 观察事实判断是否需生成 observation，移除“计数等于 1”作为生命周期去重的依据。新完整 context 的无任务观察可生成；未变化事实的重复求值/PONG 不新增报告；旧任务关联不改签。用现有直接测试声明上述交叉反例及重复观察边界，不增加第二队列、报告历史或恢复框架。
- **Dexter 产品裁决**：不需要；既有需求与详设已决定行为。

## 4. 方案合理性、同根核对与未验证项

用户要解决的是可用更新工件供给、项目范围规则、正确固定目标及实际更新结果可见。本次修复继续复用 CBS owner/typed problem、正常生成链、TDC 凭证 HTTP 接缝、terminal-update 原 slice、foundation Drawer/cursor 能力，路线成立。精确 CAS、单一三次重读和页替换都是更小的修法，没有理由引入轮询、第二任务账本或通用恢复机制。唯一遗留是当前事实观察与技术序号混用，修正该条件即可，不需换架构。

同根全集已核对：

- observation：首次晚就绪、同绑定新 context、普通重启/无任务实际事实、旧任务引用、重复 reconcile 与 PONG 六条入口/边界；除 §3 的同一计数门外，其余成员已逐一核对，无独立新增 finding。相同事实重启无需重复报告。
- HTTP：schema-invalid 2xx、裸 401/403、未知 4xx、合法业务拒绝、5xx、网络未送达六类；其余五类与命中的分类链均已核对。
- snapshot：同 context 与换 context 刷新、候选初读/固定前重读、typed changed 与成功页 hash 变化、第三次失败、相邻拒绝均已核对；transport 的 HTTP response 分支直接返回，409 不另套地址重试。
- UI：启用/停用、CAS/幂等冲突、读回已达 intent、两个子列表的上一页/下一页、重复请求、关闭/换对象/context 变化与旧 finally 释放均已核对。源码中可提取的标题、按钮及真实提交意图一致；两个子列表复用既有上一页/下一页容器，没有自行引入页码总数或任意跳页。

`DESIGN_GAPS=NONE_WITHIN_THIS_DELTA`。本轮不核验文档处置措辞与局部运行覆盖，也不把 intake 的测试覆盖声明当证明；因此未将仅涉及 intake 的描述差异计入代码 finding。当前直接测试能证明哪些分支被声明，不能证明浏览器/真实 HTTP/设备行为。

所有动态行为、cleanup、CBS advice mapping JUnit 均未由本轮执行或核验；保持 `NOT_RUN/NOT_ASSESSED_IN_THIS_REVIEW`。这些事项由 Dexter 排除，既不作为缺口阻断，也不借静态 CLOSED 推成阶段 B 整批 PASS。

## 5. 当前字节锚点

```text
terminalUpdateActor.ts = 0d603150aefa94455e30f1d9b819bfcef2141b621a2b6ac6ae1d96790600a34c
createTerminalUpdateModule.ts = 9a0d77953164194157caca7f7ef2ea2ce3ee87c6f4d85143bf2f3e07833a26f4
ProjectTerminalUpdatePage.tsx = 6d147f0a77020b38b0f03840e4760b6207e1e74e09ac2fa251ae3e2bc3153927
scripts/generate/terminal-client-api.mjs = 1c282cf49f1fdcc6f865b13955b50fa993f346df76c616bee00fc0dd7515b3d0
B implementation-design = 619b8f0327ba24f5b4ace1dd1e0fc2dca0f7751df37a07b5781e375e3f9c40ee
```

本结论只对应上述当前 R3 修复差量的静态源码范围，不授权修改、运行或扩大阶段范围。
