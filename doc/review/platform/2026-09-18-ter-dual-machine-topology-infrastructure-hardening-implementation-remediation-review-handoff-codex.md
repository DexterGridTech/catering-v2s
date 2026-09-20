REVIEW_TARGET=IMPLEMENTATION
REVIEW_KIND=IMPLEMENTATION_REMEDIATION_REVIEW_HANDOFF
IMPLEMENTATION_STATUS=READY_FOR_INDEPENDENT_REVIEW
EVIDENCE_STATUS=REMEDIATION_STATIC_FOCUSED_DEVICE_SUPPORTING_PRE_REMEDIATION
ACCEPTANCE_STATUS=NOT_CLAIMED
INDEPENDENT_SUBAGENT_REVIEW=OPEN_DEXTER_WAIVER

## 背景

本交接对应 TER 双机拓扑基础设施加固 implementation review 的 remediation。上一轮 Claude 代码复核结论为
`NO-GO,M/S/N=1/2/3`：M-1 指出 state payload 被错误的 4,096 项数组限制截断，S-1 指出 transport
复制了 JSON predicate，S-2 指出 TopologySection 通过可选 capability snapshot 而不是 root topology facts
订阅。本轮已按最小根因修复三处，不改变产品语义、wire 形态、双机协议或 dual-screen handler。

本轮 focused 与 static 已在当前字节重验；此前阶段一双机单屏和阶段二单机双屏 evidence 早于本轮 remediation
源码改动，仍只能作为支持材料，不能被表述为本轮 native/device 重验。fresh 独立 adversarial subagent
状态继续为 `OPEN_DEXTER_WAIVER`，不把主 agent fallback 或本 handoff 写成 fresh verdict。

## 评审目标

请独立核验：

1. M-1 的修复是否真正只移除 state payload 的隐藏业务数组上限，同时保留 command-request/result 的
   4,096 项控制面边界、深度/键长/有限数/64 KiB frame/8 MiB encoded-reassembly 约束；
2. S-1 是否已使 contracts 成为 JSON predicate 的唯一 owner，transport 没有语义漂移的本地复制；
3. S-2 是否使 TopologySection 的展示事实只通过 `selectTopologyFacts` 的窄 selector 与 equality 获取，
   而 capability 仍只负责 operation eligibility/action；
4. 新增 focused proof 是否真的能在对应缺陷发生时变红，而不是只检查测试名、退出码或字符串；
5. 本轮 static/focused 结果与历史 device evidence 是否被正确分档，是否存在把历史支持证据升级为当前
   remediation PASS 的越界表述。

## 需阅读文件

### 需求、详设、计划与本轮 evidence

- `doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md`：本批需求与 U-1～U-18；
- `doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-design-codex.md`：D-1～D-15、U-14 与边界设计；
- `doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-plan-codex.md`：U-14 落点、red mutation 与 remediation intake；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/implementation-review-remediation-codex.md`：本轮 finding 处置、首败、focused/static 结果和证据分档；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/stage1-dynamic-validation-codex.md`：历史阶段一双机单屏 supporting evidence；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/stage2-dynamic-validation-codex.md`：历史阶段二单机双屏 supporting evidence；
- `doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/final-implementation-reconciliation-codex.md`：此前 CP/U 总矩阵，需结合 remediation evidence 读取，不得忽略时间边界。

### 当前源码与 focused tests

- `apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts`：state JSON predicate、command payload predicate 与 wire frame boundary；
- `apps/terminal/kernel/base/contracts/test/topologyWire.test.ts`：4,097 项 state JSON 与 command array bound 的 focused proof；
- `apps/terminal/kernel/base/transport/src/foundations/createTopologyStateTransfer.ts`：解码 state payload 对 contracts predicate 的复用；
- `apps/terminal/kernel/base/transport/test/stateTransfer.test.ts`：4,097 条 members state round-trip 与 encoded overflow proof；
- `apps/terminal/ui/base/admin-shell/src/components/sections/TopologySection.tsx`：TopologySection 的 root facts selector 与 capability operation boundary；
- `apps/terminal/ui/base/admin-shell/test/topologyInput.test.tsx`：selector owner focused proof；
- `apps/terminal/kernel/base/topology/test/topology.test.ts`：既有真实 module proof 与 R-15 冻结测试，不应因本轮 remediation 被偷偷改写。

## 独立核验重点

1. 阅读 `topologyWire.ts` 的递归 helper：确认 `isTopologyJsonValue` 对 state payload 不再有 array length cap，
   但 `command-request` 与 `command-result` 仍走有 4,096 cap 的 private predicate；确认其他安全边界未被放宽。
2. 运行并检查 contracts 24 tests：将 state array 恢复 4,096 上限应使 4,097 state assertion 变红；将 command
   predicate 改为无上限应使 command rejection 变红。注意测试输入必须保持在 64 KiB frame guard 以内。
3. 阅读 transport import 和 decoded-value check，确认没有第二份 local `isJsonValue`；检查 transport 23 tests
   的 4,097 条 members round-trip 是真实 codec/reassembly 路径，不是单独调用 predicate。
4. 阅读 TopologySection：确认 facts 来自 `useUiStateSelector(selectTopologyFacts, areTopologyFactsEqual)`，
   不再用 capability `getSnapshot()` 作为展示数据；确认 operation eligibility/action 仍通过 capability。
5. 复跑并检查当前命令结果：

   ```text
   yarn workspace @catering-v2s/kernel-base-contracts test
   yarn workspace @catering-v2s/kernel-base-transport test
   yarn workspace @catering-v2s/kernel-base-topology test
   yarn workspace @catering-v2s/kernel-base-platform-ports test
   yarn workspace @catering-v2s/ui-base-admin-shell test
   yarn workspace @catering-v2s/kernel-base-contracts typecheck
   yarn workspace @catering-v2s/kernel-base-transport typecheck
   yarn workspace @catering-v2s/kernel-base-topology typecheck
   yarn workspace @catering-v2s/kernel-base-platform-ports typecheck
   yarn workspace @catering-v2s/ui-base-admin-shell typecheck
   yarn --cwd apps/terminal verify:static
   ```

   当前主 agent 结果分别为 contracts `24/24`、transport `23/23`、topology `30/30`、platform-ports
   `24 passed/2 skipped`、admin-shell `21/21`，五包 typecheck 退出 0，terminal static 为
   `TERMINAL_STATIC=PASS`。这些是当前 remediation 的 static/focused 结果，不是 Claude acceptance。
6. 读取 remediation evidence 的 first failure：contracts 首败是测试数据先触发 64 KiB frame guard，admin-shell
   首败是可空 selector 返回值未显式给 hook 泛型；确认两者分别在测试输入边界和 TypeScript owning source
   修复，而不是延长 timeout、盲重跑或放宽生产约束。
7. 将历史 stage1/stage2 result、timeline、UI XML、cleanup 与当前 remediation 时间分开核对；如果认为当前
   三处修复需要重新做 device/native proof，请将其列为 evidence finding，不要把历史结果自动升级。
8. 保留 `INDEPENDENT_SUBAGENT_REVIEW=OPEN_DEXTER_WAIVER`；不得把 Claude 的本轮复评、主 agent 对账或历史
   device evidence 写成 fresh independent adversarial verdict。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。每条 finding
请区分仓内源码事实、当前 focused/static 实际结果、历史 device supporting evidence、推论和尚缺证据的
假设，给出仓库相对路径、symbol/行号、影响面和最小修复建议；如需 Dexter 产品或范围裁决请单独标注。

本轮 `GO` 只代表 remediation implementation review 覆盖的源码与证据边界，不等于整体 implementation
acceptance、release PASS、Web PASS、visual PASS 或产品验收 PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER 双机拓扑基础设施加固 implementation remediation 做独立复评。

背景：上一轮 implementation review 结论为 NO-GO，M/S/N=1/2/3。M-1 指出 state payload 错误继承 4,096 项数组上限，S-1 指出 transport 复制了 JSON predicate，S-2 指出 TopologySection 用 capability snapshot 而不是 root topology facts 订阅。本轮已按最小根因修复三处，不改变双机协议、产品语义、dual-screen handler 或受管 runner。当前 focused 与 terminal static 已在当前源码重验；此前阶段一/阶段二设备证据早于本轮 remediation，只能作 supporting evidence，不能当成本轮 native/device 重验。fresh 独立 adversarial subagent 仍为 OPEN_DEXTER_WAIVER，未被改写为完成。

目标：请独立确认三条 finding 是否真正关闭，新增 focused test 是否能在对应缺陷发生时变红，以及 static/focused/历史 device supporting evidence 的分档是否诚实。请特别验证 state payload 没有隐藏业务数组项数上限、command payload 仍有 4,096 控制面上限、transport 只复用 contracts predicate、TopologySection 只从 selectTopologyFacts 订阅展示事实。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md：本批需求与 U-1～U-18；
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-design-codex.md：D-1～D-15、U-14 与边界设计；
- doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-plan-codex.md：实施落点、red mutation 与 remediation intake；
- doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/implementation-review-remediation-codex.md：本轮处置、首败、当前 focused/static 结果与 evidence boundary；
- apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts：state/command JSON predicate 与 frame boundary；
- apps/terminal/kernel/base/contracts/test/topologyWire.test.ts：4,097 state/command boundary focused proof；
- apps/terminal/kernel/base/transport/src/foundations/createTopologyStateTransfer.ts：transport 复用 contracts predicate；
- apps/terminal/kernel/base/transport/test/stateTransfer.test.ts：4,097 members round-trip 与 overflow proof；
- apps/terminal/ui/base/admin-shell/src/components/sections/TopologySection.tsx：facts selector 与 capability 操作边界；
- apps/terminal/ui/base/admin-shell/test/topologyInput.test.tsx：selector owner focused proof；
- doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/stage1-dynamic-validation-codex.md：历史阶段一设备 supporting evidence；
- doc/evidence/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening/stage2-dynamic-validation-codex.md：历史阶段二设备 supporting evidence。

请重点独立核验：
1. `isTopologyJsonValue` 是否只用于 state/decoded payload 且不再限制数组项数，command-request/result 是否仍通过 private predicate 限制 4,096 项，并且深度、键长、有限数、64 KiB frame 与 8 MiB reassembly 边界没有被放宽；
2. transport 是否不存在本地重复 JSON predicate，4,097 条 members state 是否经过真实 codec/reassembly round-trip；
3. TopologySection 是否调用 `useUiStateSelector(selectTopologyFacts, areTopologyFactsEqual)`，而 capability 只负责 operation eligibility/action；
4. 五个 focused test、五个 typecheck 与 `yarn --cwd apps/terminal verify:static` 的结果及首败记录；
5. 本轮 remediation 没有重新运行 native/device，历史阶段二 evidence 不得被升级为本轮 device PASS，`OPEN_DEXTER_WAIVER` 不得被写成 fresh independent verdict。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请给出精确仓库相对路径与 symbol/行号、影响面、最小修复建议，并区分源码事实、当前验证事实、历史 supporting evidence、推论和尚缺证据的假设。若需要 Dexter 产品或范围裁决请单独标注。

授权边界：本次只请求对上述三处 implementation remediation 做独立 review；不授权扩大双机拓扑需求、改变既有裁决、修改未列出的生产机制、Web/Metro/Android 构建、设备重跑、部署或 release 验收。review 结论不等于整体 implementation acceptance。谢谢。
```

## 授权边界

本交接只请求 `REVIEW_TARGET=IMPLEMENTATION` 的 remediation 复评。当前修改限定在 contracts wire predicate、
transport predicate 复用、TopologySection selector 及对应 focused tests；不授权扩大产品范围或改变既有
双机拓扑裁定。历史 device evidence、fresh independent review waiver 与 overall acceptance 继续按文中档位
处理，由 Dexter 和 Claude 根据当前源码与证据定论。
