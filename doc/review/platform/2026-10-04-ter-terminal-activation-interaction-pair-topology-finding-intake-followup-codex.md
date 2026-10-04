# TER 终端激活交互与双机拓扑 · 补充 finding intake

```text
DOC_KIND=FINDING_INTAKE
DATE=2026-10-04
REVIEW_TARGET=IMPLEMENTATION_STATIC
AUTHOR=Codex 主 agent
EVIDENCE_TIER=当前源码静态核验；受影响包 typecheck 已运行；scripts/verify --validate-only 首次失败
DYNAMIC_RUNTIME=NOT_RUN
```

## 范围与依据

本记录只处置当前转交的 Claude 静态 findings。逐项重读正式需求、当前 TER 详设/计划、owning source 与适用项目记忆；作者建议不是自动修复指令。未运行测试、DEV、Expo Web、Android、VM 或任何受管动态验收。此次补充修正不改变产品语义，也不重开已结束的需求 cycle。

## Finding intake

### S-2 · LMS 会员确认完成时的 VICE 投影与 BRANCH 终态

- **分类：CONFIRMED。** 既有 member registry 的完成事实是 `memberId` 关联的 confirmed member；VICE 展示的是 MASTER 的 MAIN 投影，不能在 slave 本地改写该投影。旧路径若把导航提交到当前 VICE 所投影的 MAIN workspace，owner 的本地所有权检查会丢掉完成导航，返回 CHIEF 时可能仍停在已结束的确认页。
- **判据：** 当前需求的会员操作身份与主副隔离；详设/计划对 LMS 的单机 `MASTER+SECONDARY` 与双机 `SLAVE+VICE` 区分，以及 `branchPending` 不被主机投影覆盖的判据。
- **当前处置：** `sample-member-desk` 的 registry-confirmed actor 先按准确 `memberId` 在确认列表读回事实；SLAVE 分支把完成后的路由写入本机 BRANCH member-list，不改 MASTER MAIN 投影，也不清除/覆盖本地 `branchPending`。单机 MASTER 路径继续走原有 host owner 与 list 返回逻辑。
- **当前源码：** `apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts:226-250`；`apps/terminal/kernel/feature/sample-member-registry/src/selectors/selectors.ts:33-38`；`apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts` 中 host/branch 分离 reducer。
- **更小替代比较：** 单纯在 VICE 放宽 MAIN 写入会破坏投影只读；仅回到列表而不绑定已确认 `memberId` 则无法排除迟到或不匹配完成。现改动只更新该确认路径的 branch 导航终态。
- **验证：** 新增/既有 focused 测试覆盖“VICE 显示 host projection 时确认成功，BRANCH 完成导航留存且本地 pending 不变”；本轮未运行测试，当前字节动态结果 `NOT_RUN`。sample-member-desk typecheck 通过。
- **剩余：** Expo Web / VM 场景按当前原专项授权边界未运行；不将静态与编译证据升级为 UI 行为 PASS。
- **Dexter 裁决：** 不需要。

### S-3 · 激活优先于恢复的店员资格

- **分类：CONFIRMED。** 纯 storage 恢复 `authenticated` 店员资格但 protected storage 无终端凭证时，若业务互锁先于 inactive activation 分支，则配对遮罩可能阻断需求规定的重新激活。此分类不意味着正常取消激活必然遗留店员资格；拒绝的业务 mutation 与路由遮罩是不同边界。
- **判据：** 原专项需求 R-10 的激活优先级：未激活应显示激活流程；业务资格不得代替激活凭证。
- **当前处置：** 两个 integration route selector 均在拓扑修复门与当前 peer 激活状态读取后，先返回 `activation`（status 为 inactive），再评估 staff/business interlock。`activating/cancelling` 仍等待，不被误显示为可交互业务页。
- **当前源码：** `apps/terminal/ui/integration/sample-console/src/application/module.ts:92-103`；`apps/terminal/ui/integration/sample-wallpaper-console/src/application/module.ts:91-102`；资格互锁只约束已激活后的业务路由。
- **更小替代比较：** 不删互锁、不清除恢复出来的 staff state；只调整路由判定顺序，保留后续业务拒绝和资格门。
- **验证：** 两 integration selector 的 focused test 覆盖 inactive + authenticated staff 仍返回 activation；本轮测试未执行。两个 integration 包 typecheck 通过。
- **剩余：** Web/设备运行 `NOT_RUN`。
- **Dexter 裁决：** 不需要。

### S-4 · 跨连接 transfer failure 去重

- **分类：CONFIRMED。** 即使失败诊断应去重， readiness 状态失效也必须先发生。连接 A 与新的连接 B 可以重复使用 slice、revision 与错误码；若去重键不含连接身份，B 的失败会被 A 的诊断记录压制，且 readiness 事件若在早退之后就永远丢失。
- **判据：** topology readiness 只接受当前 peer/connection 的有效 slice；诊断去重不能抑制权威业务状态变化。
- **当前处置：** failure key 纳入 `connectionId`；对具备有效 slice/revision 的每次回调，先发 `state-sync-slice-apply-failed` 使当前连接 readiness 失效，再对确定性诊断日志去重。重复的同连接错误仍去重诊断，不去重状态修正。
- **当前源码：** `apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts:568-594`。
- **更小替代比较：** 单独增加“连接重置清除全局去重 key”的旁路会把正确性绑定到另一个生命周期动作；把权威事件放在日志去重之前并纳入连接身份，更局部且覆盖换连接反例。
- **验证：** focused 测试通过实际 peer transfer callback 驱动同 revision 的失败，验证新 connection 仍产生 readiness invalidation；本轮测试未执行。topology typecheck 通过。
- **剩余：** 真正 VM 网络切换未运行。
- **Dexter 裁决：** 不需要。

### S-6 · 删除地址行后的字段草稿错位

- **分类：CONFIRMED。** `useInputField` 只在挂载时从 `initialValue` 初始化；地址以数组索引作字段身份。删除 `[A,B]` 中 A 后，旧挂载状态可能仍显示 A，但 draft payload 已是 B。
- **判据：** 管理员屏幕显示的地址字段必须与实际提交的有效配置相同；地址结构修改不能意外丢弃独立代理密码草稿。
- **当前处置：** `ServerConfigPanel` 仅对地址行引入 `addressRowsVersion`；新增/删除地址改变 key，使地址输入按当前结构重新初始化。代理密码 draft key 不引用该版本，故不随地址行重挂而丢失。
- **当前源码：** `apps/terminal/ui/base/server-config-panel/src/components/ServerConfigPanel.tsx:140-142,296-307,340-353`；输入挂载初始化见 `apps/terminal/ui/base/input/src/hooks/useInputField.ts:63`。
- **更小替代比较：** 索引改成内容 key 对新增空行无法稳定唯一；统一 remount 整个配置表单会丢失代理密码草稿。局部地址结构版本只影响地址字段。
- **验证：** focused test 覆盖 `[A,B]` 删除 A 后 B 成为显示值和保存 payload，代理密码草稿保持；本轮测试未执行。server-config-panel typecheck 通过。
- **剩余：** Expo Web UI 运行未授权于本次修正阶段，标 `NOT_RUN`。
- **Dexter 裁决：** 不需要。

### S-7 · 专项 Android 薄 runner 的代码义务

- **分类：CONFIRMED（未交付残项）。** 原详设 §11 与计划 §9.2 明确列出 `scripts/test/ter-terminal-interaction-android.mjs` 薄入口；当前路径不存在。禁止 Android 动态运行并不会自动满足计划中的源码交付义务。
- **当前处置：** 本次不实现该 runner，也不将原专项表述为完整交付。保留为 TER 专项未交付项，等完整 UiAutomator/Android 包具备后再按原计划接续。此残项不扩张本次 TDP 设计授权，也不要求先运行 Android 才能编写 TDP 详设/计划。
- **证据：** `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md:273-274`；`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md:172,222-223`；仓内 `scripts/test/ter-terminal-interaction-android.mjs` 不存在。
- **更小替代比较：** 删除计划义务会改写原专项批准范围；现在准确记录 residual 比在当前任务中追加设备自动化工作更符合边界。
- **验证：** 静态路径存在性检查为“不存在”；未运行 Android。
- **Dexter 裁决：** 暂不需要；未来若要删掉该专项义务则需单独裁决。

## 本轮允许的编译与 verify 证据

- `yarn workspace @catering-v2s/kernel-base-topology typecheck`：退出码 0。
- `yarn workspace @catering-v2s/ui-feature-sample-member-desk typecheck`：退出码 0。
- `yarn workspace @catering-v2s/ui-integration-sample-console typecheck`：退出码 0。
- `yarn workspace @catering-v2s/ui-integration-sample-wallpaper-console typecheck`：退出码 0。
- `yarn workspace @catering-v2s/ui-base-server-config-panel typecheck`：退出码 0。
- `scripts/verify --validate-only`：**未通过，且未完成全部静态门**。命令首先在 `backend-spotless-check` 停止，Gradle 报告 terminal-data-server 的 `TdsTerminalSessionActors.java`、`TdsDorisStreamLoadClientTest.java`、`TdsTerminalSessionActorsTest.java` 格式差异；verify 输出 `R5_VERIFY=FAIL`、`REASON=R5_VERIFY_STATIC_FIRST_FAILURE:backend-spotless-check`。该失败位于本轮 TER finding 之外，未擅自格式化 unrelated TDS 文件；后续门为 `NOT_RUN`。
- 当前无可确认的通用生产 build 命令覆盖以上 TS workspace；`typecheck` 是实际编译检查。没有运行 test、完整默认 verify、远端环境或动态验收。

## 结论

S-2、S-3、S-4、S-6 的最小修正已写入当前工作树，源码事实层面符合对应判据；新增 focused 测试尚未运行。S-7 仍为 residual。因此不能宣称 TER 专项整批交付或当前全量 PASS。当前任务按用户授权继续进入 TDP 详设与实施计划编写；本 finding intake 不把 `--validate-only` 的失败升级为完整 verify 结论。
