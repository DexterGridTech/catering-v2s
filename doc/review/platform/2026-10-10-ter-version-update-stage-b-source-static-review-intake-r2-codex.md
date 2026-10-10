# TER 版本更新阶段 B 源码静态评审 finding intake（R2）

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

## 范围和证据边界

本记录由主 agent 按 Claude 2026-10-10 当前源码评审逐项重开正式需求、阶段 B 详设/计划及 owning source 后形成。Claude 原结论 `NO-GO, M/S/N=0/13/4` 保留在原评审输入字节边界，不继承为当前字节 verdict；本记录不是独立 review，当前修订字节的独立 verdict 为 `NONE`，等待 Claude 复评。

本轮未运行默认全仓 verify、DEV、设备或动态 acceptance。已运行的 focused package test、Gradle module tests 和后台 typecheck 列在“本轮局部验证”；不能据此推导完整阶段 B 动态 PASS。没有读取历史 `.runtime/` evidence。

## S findings

| Finding | intake | 当前源码核验与处置 |
| --- | --- | --- |
| S-1 运营授权 grant 未在 owner 复核 | `CONFIRMED，当前已闭合` | `TerminalUpdateRuleOwnerService.create/changeStatus` 在 receipt 查找前调用 `requireGrant`，再锁 project 并调用 `organization.requireTaskPath`；HTTP operation 将 resolver 得到的 grant 传入 owner。旧 receipt 不能绕过当前 scope。最小接法已在当前 owner 实现；无需增加权限层。 |
| S-2 FULL/HOT entry 未与归档文件闭合 | `CONFIRMED，当前已闭合` | `TerminalUpdateArtifactParser.parseHot` 要求 entry 属于 manifest 文件集且归档中存在同名普通文件；FULL 要求 entry 对应 manifest fact 和实际 APK ZIP 普通文件。缺失文件进入既有 typed invalid-package 路径。直接证据在 `TerminalUpdateArtifactParser.java:120-141,164-179` 与 `TerminalUpdateArtifactParserTest.java`。 |
| S-3 parser 8192 与 grant 128 不一致 | `CONFIRMED，当前已闭合` | `TerminalUpdateArtifactOwnerApi.MAX_MANIFEST_FILE_COUNT=8192` 是 API 与 parser 共用的上限，owner grant 构造不再把合法 manifest 缩到 128；focused 测试断言共享上限。没有新增协议分片或降低既定预算。 |
| S-4 报告 owner 未最终核验当前绑定 | `CONFIRMED，当前已闭合` | `TerminalUpdateReportOwnerService.record` 在持有事务内先调用 `credentials.lockCurrentActiveBinding(binding)`，失败立即拒绝，之后才进入报告锁、receipt/facts 查询和写入；直接 owner 测试覆盖绑定失效拒绝。该结论依赖现有 binding owner 的行锁/事务实现，不把普通只读 SELECT 当并发闭包。 |
| S-5 同 binding context 变化重置 report sequence | `CONFIRMED，当前已闭合` | `terminalUpdateActor.ts:435-445` 对同一 binding 的 context 切换清掉失效 pending，但沿用 `previous.nextReportSequence`；只有 binding identity 改变才从 1 开始。测试覆盖项目/context 变化后的序号延续。 |
| S-6 无更新任务终端没有初始实际版本 observation | `CONFIRMED，当前已闭合` | `reconcile` 在无 task 时要求有效绑定、对应 rule context、实际 application/version 且首次 sequence，调用现有持久化报告构造排队 observation；重复 reconcile 不重复排队。`terminalUpdate.test.ts` 的“active terminal without an update task”用例验证单次排队和幂等。 |
| S-7 报告失败处置不遵循矩阵 | `CONFIRMED，当前已闭合` | `sendPendingReport` 区分身份拒绝（保留 pending 并 pause）、终态 4xx/协议拒绝（移除可发送项并记录失败摘要）、未知/通信失败（保留并 retry）；终态失败写入失败后仍不会在当前 Runtime 重新变成可发送项。成功回执持久失败仍保留重送，以区别“服务端已接受但 ACK flush 失败”。 |
| S-8 HOT applying 映射为 APK INSTALLING，恢复原因丢失 | `CONFIRMED，当前已闭合` | `toReportState` 按 task action/phase 将 HOT 映射为 `APPLYING_HOT`；`createReportPayload` 对 `file-recovery`/unknown actual 使用契约允许的 `OTHER`，不伪造成已知安装状态。 |
| S-9 await 后固定已失效规则候选 | `CONFIRMED，当前已闭合` | `acceptTerminalUpdateTargetCommand` 在读取实际版本后，通过 `targetCommitPending` 序列化，并在写 fixed task 前重新读取当前 source 与身份、context 和原候选摘要；不把“固定后继续执行”的规则错误前移到固定之前。相关并发测试已补足最终 eligibility read 的第三个读屏障。 |
| S-10 日期选择实际提交 string 与 Dayjs model 不匹配 | `CONFIRMED，当前已闭合` | operations `ProTable` 明确设置 `dateFormatter={false}`，保留 model 当前接受的日期值形状。此次 typecheck 差量将 refresh effect 中由 ref 取得的 UUID 通过 `wireUuid` 转为 generated client 要求的 branded type，没有更改 wire 值。 |
| S-11 查询刷新未接统一 signal、第二页刷新可卡 loading | `CONFIRMED，当前已闭合` | 两个后台 feature 均消费现有 `useRefreshVersion`/content-tab signal；运营刷新当前规则 cursor 时显式传 `rulePager.cursor`，避免旧 guard 丢弃第一页结果却遗留 loading。运维包列表使用现有 RTK invalidation，包详情订阅平台刷新 signal。没有新建刷新总线。 |
| S-12 启停确认缺提交锁、错误提示和 CAS 冲突读回 | `CONFIRMED，当前已闭合` | 运营页使用 `statusSubmittingRef` 阻止重复提交，StatusChangeConfirm 获得 submitting/problem；409 时读取当前规则并更新 revision/status，提示用户核对后重试，不自动重派 command。 |
| S-13 上传 Drawer 绕过唯一 dirty lifecycle | `CONFIRMED，当前已闭合` | 运维上传 Drawer 使用 `useDrawerFormLifecycle`、`requestClose`、确认丢弃、after-close 清理；表单变更和文件选择/移除均调用 `setDirty(true)`。确认放弃后再走既有 stage release。未发现需要第二套 close guard 的边界。 |

“当前已闭合”表示重开后的源码现在含对应最小闭包，并非声称本轮每项均由此次新 diff 实现；Claude 应按当前文件独立判断。已知本轮直接写入的差量见下文。

## N findings

| Finding | intake | 当前源码核验与处置 |
| --- | --- | --- |
| N-1 snapshot 变化未作有限完整重读 | `CONFIRMED，当前已闭合` | `terminalUpdateActor.ts` 对 `SNAPSHOT_CHANGED` 从第一页重读，最多三次；旧完整 snapshot 在成功前保留，超出次数走明确失败状态，无后台轮询。 |
| N-2 pending report 额外 64 上限丢新任务 | `REJECTED_WITH_EVIDENCE（当前字节）` | 当前 `writeTask` 将新报告放入既有 descriptor map，没有 `slice(0,64)`、`MAX_PENDING=64` 或同类截断。bounded task/action 与报告队列行为不能等同于该被报告的额外 pending-cap。当前源码未复现此 finding。 |
| N-3 分页、Drawer、详情入口未充分复用标准控件 | `PARTIALLY_CONFIRMED` | 当前两页主列表使用 foundation `CursorPagination`；所有五个相关 Drawer 使用 `adminDrawerSurfaceProps`、统一 720 宽度；详情标题是键盘可操作的 `Button type="link"`。剩余规则固定门店与报告历史是按 opaque cursor 的“下一页/加载更多”append 交互。它不计算任意页码且保留 owner cursor；改成 page-stack 会新增每个子列表的页状态/请求竞态，而本轮没有发现数据正确性故障。先保留简单交互，请 Claude 判断其是否违反该具体 UI 判据；不声称所有细节完全统一。 |
| N-4 FULL N 文案写成检查间隔 | `REJECTED_WITH_EVIDENCE（当前字节）` | operations 页面表格、详情和编辑表单均为“安装提醒间隔”；全局 `rg -n '检查间隔|安装提醒间隔' apps/frontend/*/src/features/terminal-update` 未发现当前页面仍显示“检查间隔”。 |

## 本轮直接修改及局部验证

本轮为稳定既有已批准边界而修正了三个直接相关的测试/类型问题：

- `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`：并发 accept 测试新增确定性最终 eligibility-read 屏障；首次失败根因是新增生产复核后的第三次 source read 未由旧测试屏障释放。修后 `yarn workspace @catering-v2s/kernel-base-terminal-update test` 通过。
- `apps/backend/catering-business-server/modules/terminal-update/src/test/java/com/catering/v2s/terminalupdate/application/TerminalUpdateArtifactParserTest.java`：`fullApk(entryPath)` 同步使用 entryPath 生成文件事实；首次失败是 fixture 仍声明旧路径，导致测试提前命中 metadata 缺失。修后 focused parser test 通过。
- `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx`：refresh effect 对 generated client 所需 UUID 加 `wireUuid` 品牌转换，不改变请求值。修后 operations-admin typecheck 通过。

已通过的真实命令：

```text
./gradlew :apps:backend:catering-business-server:modules:terminal-update:test --tests com.catering.v2s.terminalupdate.application.TerminalUpdateRuleOwnerServiceTest
  PASS
yarn workspace @catering-v2s/kernel-base-terminal-update test
  PASS（2 files；45 tests；allowedDevSkips=0）
./gradlew :apps:backend:catering-business-server:modules:terminal-update:test --tests com.catering.v2s.terminalupdate.application.TerminalUpdateArtifactParserTest
  PASS
yarn workspace @catering-v2s/operations-admin typecheck
  PASS
yarn workspace @catering-v2s/platform-admin typecheck
  PASS
```

首败全部保留并定位：TER package test 是并发测试未释放最终 source read；Java parser test 是 fixture 声明路径与目标 entry 不一致；operations-admin typecheck 是 string 与 generated branded UUID 不匹配。各根因仅修正对应测试屏障、fixture 或类型边界后，以同一 focused command 复验。未跑默认 `scripts/verify`、全量 acceptance、DEV、浏览器、Android、reset/seed、L2、UAT 或部署。

## 当前处置结论

- S：13 项当前源码均已具备最小闭包；本轮独立复评尚未发生。
- N：N-1 已闭合；N-2/N-4 对当前字节不成立；N-3 保留为有界 UI 一致性注记，不为此新增分页状态架构。
- 旧 Claude verdict 保留其原字节结论；本 intake 不声称 `GO` 或整批 `PASS`。请求 Claude 对当前源码静态复核，未执行动态证据比较。
- Stage C 未实施、未授权；阶段 A/B 历史运行与当前 focused proof 分开。设备、DEV、完整 acceptance 和默认 verify 均 `NOT_RUN`（本轮）。
