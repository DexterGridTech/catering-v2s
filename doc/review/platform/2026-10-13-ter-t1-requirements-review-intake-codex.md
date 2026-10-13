# TER T1 正式需求 · 独立审查 intake

作者：Codex。日期：2026-10-13。`AUTHOR_DISPOSITION_ONLY`，不是独立 verdict。

`REVIEW_CYCLE_ID=TER_T1_REQUIREMENTS_20261013`；`REVIEW_TARGET=DESIGN`；批准范围为完整正式需求；本cycle两轮上限，不因修订重置。

## 1 · R1 独立输入与结果

fresh reviewer：`/root/t1_requirements_r1`，`fork_turns=none`，只读。独立结论已由 reviewer 返回：`NO-GO，M/S/N=0/1/0`。完整报告与输入清单由主agent保存为同目录 `2026-10-13-ter-t1-requirements-review-r1-codex.md`、`2026-10-13-ter-t1-requirements-review-r1-inputs-codex.md`，不是作者代判。

R1 被审正式稿 SHA-256：`b6c2cb34bbe220938d2cf4bb744b336885042f9f98e94ff697662e2babe56023`。其结论仅对应该字节。

## 2 · S-1 辩证处置

| Finding | 分类 | 当前处置 | 需 Dexter 裁决 |
|---|---|---|---|
| V-15 把合法恢复和取消激活根reset混成“不丢task/credential” | CONFIRMED | CLOSED_BY_AUTHOR_CHANGE / WAITING_R2：拆清各生命周期事件的原有保留/清除预期 | 否，TR-09和既有凭证清理判据已明确 |

主agent亲读：

- `doc/platform/terminal-coding-standard.md:365–375`：root reset 默认清 owner；retained仅server-config/terminal-update descriptor持久字段，TDC credential照常清。
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:259–260,1973–1985`：取消成功/离线取消进入 `TERMINAL_ACTIVATION_CANCELLED` root reset。
- `apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts:333–349`：credential持久化，无retain声明。
- `apps/terminal/kernel/base/state/src/foundations/persistenceEngine.ts:437–479`：删除非retain键后派发reset。
- `apps/terminal/kernel/base/state/src/foundations/createStateStore.ts:39–50`：非retain回owner初始状态。

反例成立：按旧V-15验收会把正确取消后凭证清空判为失败，或者错误推动实施保留已取消凭证。

最小修正比较：不新增“重构期间保留凭证”的例外，不改源码/reset机制；只修改正式稿 V-15:223，分别验正常恢复、角色切换、解绑/换主、取消激活根reset。原R-12:159“不得因移动静默丢数据”继续成立，无需扩大为禁止合法清理。标题状态也改成结论引用独立报告，避免作者字段追认GO。

同根扫描：正式稿 R-01 的语义保持、R-09 的 sync/reset、R-12 的持久身份保持、V-12 的配对恢复、V-15、§7未运行边界已逐项回读；其余5处没有“所有事件无条件保留凭证”的预期。通用防再犯落点为 V-15 的逐事件oracle，未来测试按此分开；不在当前写规范/记忆/源码。

修订稿 SHA-256：`b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e`。

## 3 · R2 边界

第二位 fresh reviewer `/root/t1_requirements_r2`，`fork_turns=none`，对修订完整正式稿先独立证伪，形成GO后才读R1/intake；不以作者CLOSED标签判定。其完整报告与输入清单已经由主agent逐字保存：`2026-10-13-ter-t1-requirements-review-r2-codex.md`、`2026-10-13-ter-t1-requirements-review-r2-inputs-codex.md`。

R2 独立最终结论：`GO，M/S/N=0/0/0`；`ROUND_FINAL_DECISION=SELF_DECIDED`由R2 reviewer给出。原S-1为 `CONFIRMED_RESOLVED_IN_REVIEWED_BYTES`，没有新增finding；不追加第三轮。

R2 起读/结束以及主agent交付读回的正式稿SHA均为 `b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e`。正式稿在R2后未修改，结论只覆盖该字节的需求可接受性。R1旧字节NO-GO保留，不改写为GO；作者不另立独立verdict。

## 4 · 证据与授权

当前仅文档修订和源码只读核验。生成、编译、测试、verify、DEV、Web/设备、reset/seed、L2、UAT、cleanup全部NOT_RUN。未改任何生产源码、测试、规范或项目记忆；此intake不授权后续实施。
