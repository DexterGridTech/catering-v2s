# TER 终端激活交互与双机拓扑专项 · 静态 finding intake

## 范围与证据边界

按 2026-10-04 外部静态评审中的七项 finding 重开正式需求、详设、计划及 owning source。评审清单是待核输入；本记录只处置已核实部分。没有读取 `.runtime/`，没有运行 DEV、Expo Web、Android、VM 或受管 runner。包级 lint、typecheck、单元测试是当前源码的本地检查，不代表 UI/设备/业务环境验收。

## Finding 处置

| Finding | Intake | 当前判断与处置 |
|---|---|---|
| S-1 LSP 决定误发 peer | `CONFIRMED` | 需求 R-09a 与详设 §6 将 LSP branch-local pending 和 LMS host pending 分开。`apps/terminal/ui/feature/sample-member-desk/src/hooks/useCustomerMember.ts` 现仅在 `mode=confirm`、pending 来源为 `host` 且实例为 `SLAVE` 时发往 peer；LSP/branch 决定走 local。kernel 的 `registerBranchConfirmedMemberCommand` 仍由既有 owner actor 处理。`memberDesk.test.tsx` 更新断言验证 local target。未增加第二业务入口。 |
| S-2 主机成员投影先到后确认页悬空 | `CONFIRMED` | 原因是同步投影可能早于命令响应，branch pending 与 host authoritative member list 被错误耦合。`apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts` 保留 branch-local pending；`src/features/actors/actors.ts` 按完全相同的 operationId 识别已登记成员并结束本地 pending；`src/application/module.ts` 在 SLAVE 中观察到同 operationId 后，通过原有 `confirmMemberCommand` 排队收敛，并在派发前复核 pending 与成员身份。测试覆盖权威列表先到及一次性收敛。未增加通用恢复框架。 |
| S-3 TDS connected 被加为业务资格 | `CONFIRMED` | 需求 R-10 区分激活资格与 TDS 连接状态；配对断链仍由 peer/projection interlock 管。两个 integration 的 `hasCurrentActivatedTerminal` 仅检查当前身份及 active activation，不再要求 TDS `connected`；既有 SLAVE required-projection 与 repair gate 保留。`businessInterlock.test.ts` 覆盖凭证 active、TDS backoff 时允许主机店员流程，且业务命令仍按资格判定。 |
| S-4 当前投影传输失败未使 readiness 失效 | `CONFIRMED` | `apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts` 的当前连接 payload failure 回调，对已知 slice/revision 发出现有 `state-sync-slice-apply-failed` 事件；事件沿用 topology connection identity，旧连接失败不能污染新连接。`test/topology.test.ts` 覆盖当前连接失败、旧连接失败隔离和后续有效 revision 恢复。没有新增 ACK 或同步协议。 |
| S-5 server-config defaults 恢复/hydration 漏字段 | `CONFIRMED` | `apps/terminal/kernel/base/server-config/src/features/actors/serverConfigActor.ts` 的 restore 判据纳入 `syncedHostDefaults`，hydration 的 changed 判据比较规范化后的该字段。`test/serverConfig.test.ts` 覆盖退配后恢复本机 defaults，以及畸形持久值归一化为 null。 |
| S-6 配置切换后输入显示值与提交值错配 | `CONFIRMED` | 根因是 `useInputField` 仅在挂载时采用 initialValue，而新服务 draft 由 effect 随后设置。`apps/terminal/ui/base/server-config-panel/src/components/ServerConfigPanel.tsx` 现将 config source、space、service、draft source 合成为 draft identity；仅 identity 匹配时允许编辑，切换期显示 effective read-only 值，字段容器 key 随 identity 改变而重挂载。测试使用保留内部状态的输入替身，切换服务后同时断言显示和提交 payload 属于 B。 |
| S-7 Android 专项业务编排入口缺失 | `CONFIRMED`，未修复 / `OPEN` | 详设 §11、计划 §9.2 明确要求 `scripts/test/ter-terminal-interaction-android.mjs`；仓内当前没有该文件。既有 `ter-virtual-keyboard-android.mjs` 是受管设备动作底座，`run-dual-device.mjs` 只覆盖自身拓扑行为，均不能证明专项有限场景编排。用户已明确本轮不要求 Android 动态运行，但没有撤销该计划中的代码交付项。未添加一个只包装命令、却不具备场景业务断言/首败/清理闭环的空壳，以免制造假完成；应由 Claude 静态判断该项是否必须保留为本轮阻断，或是否需要改由 Dexter调整批准计划。 |

## 本地检查

针对本轮修复涉及的七个 TER 包，当前字节上：

- `yarn lint`：7/7 PASS。
- `yarn typecheck`：7/7 PASS。
- `yarn test`：7/7 PASS，共 205 项：sample-member-registry 15、sample-member-desk 36、sample-console 65、sample-wallpaper-console 34、topology 40、server-config 11、server-config-panel 4。

以上均为包级本地检查。未执行 `scripts/verify`、构建、Expo Web、Android、VM、DEV 或业务/cleanup 验收；未读取 `.runtime/`。不把上述检查升级为动态业务 PASS。

## Fresh 独立静态复核

按治理要求由 fresh 独立只读 reviewer 对 S-1～S-7 做 `REVIEW_TARGET=IMPLEMENTATION` 复核。其 verdict 为 `NO-GO`、`M/S/N=0/1/0`：S-1～S-6 在当前源码中的原始问题均 `REJECTED_WITH_EVIDENCE`（问题已修复，reviewer 未发现残留阻断）；S-7 `CONFIRMED` 且 OPEN，原因是计划明确要求的 Android 专项编排入口仍不存在。该 reviewer 没有运行测试、构建、verify、DEV/Web/Android，也没有读取 `.runtime/`。

## 当前状态

S-1～S-6 已按最小范围修正并有对应包级检查；S-7 的代码义务仍 OPEN。因此当前不宣称整批 GO，也不把独立 verdict 包装成 Claude 的结论。已准备将当前源码交 Claude 独立静态代码复核；本次请求不要求其比较运行证据。是否将 S-7 保留为本专项交付阻断，由 Claude 结合计划与代码独立判断；若确认阻断，仍需补齐薄入口后再收口。
