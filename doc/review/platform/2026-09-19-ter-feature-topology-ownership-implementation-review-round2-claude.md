# TER feature 端写入归属整改 · IMPLEMENTATION 复核(第二轮)

- 评审人:Claude｜日期:2026-09-19
- REVIEW_TARGET=IMPLEMENTATION
- 上轮:`doc/review/platform/2026-09-19-ter-feature-topology-ownership-implementation-review-claude.md`(NO-GO,2/2/3)
- 方式:**先独立重开当前字节**,再对照证据文档。所有闭合判定均为我自己回源所得,未采信自报结论。

## 0. 结论

```
VERDICT=GO
M/S/N=0/0/2
```

**上轮 2M/2S/3N 全部实质闭合**,且多处做法优于我给的建议。两条 Note 均不阻塞。

⚠️ **GO 的边界**:仅表示**当前源码逻辑与证据分档**通过 implementation review。**不自动升级为 implementation acceptance**,不构成 Android、Web、release、visual、cleanup 或产品验收 PASS。本轮只读,零写入(本文件除外),未执行构建、设备或部署动作。

## 1. 上轮 findings 的逐条闭合(独立回源)

### M-1 feature 未被教会归属规则 —— **CLOSED,且修法正确**

上轮我明确禁了两条路:不许放宽门、不许给 staff-auth 打个案补丁。实际做法两条都守住了:

- 新增 `kernel/base/ui-state/src/foundations/workspaceOwnership.ts`,提供 `workspaceOwnedByInstanceMode` / `isWorkspaceOwnedByInstanceMode` / `isCurrentWorkspaceOwnedByInstance`,并由 `ui-state/src/index.ts:41-42` 导出 ⇒ **共享判据,不是逐 feature 自制**。
- **全量排查做到了**。我独立枚举了全仓 feature 侧的内容命令派发点,落在**四个**文件;这四个文件**全部**引入了该判据:`sample-staff-auth`、`sample-member-desk`、`sample-wallpaper-picker`、`sample-wallpaper-console`。
- **逐处覆盖而非文件级**:staff-auth 7 派发 / 7 `onCommand`,每个 handler 首行 `if (!isContentOwner(context)) return null`(`:34` 的 `isContentOwner` 只是共享判据的本地别名);member-desk 8 派发 / 17 `onCommand`,每个 handler 首行 `if (!isCurrentWorkspaceOwnedByInstance(context.getState())) return null`(如 `:142`、`:148`)。
- **是 no-op 不是抛错** ⇒ 上轮"结果正确但达成方式是异常"的问题消失,副机不再产出 ownership violation 的 error 命令。

⚠️ 一致性已核:守卫用的 `isCurrentWorkspaceOwnedByInstance` 内部走 `resolveWorkspace`,而 `dispatchContentAction` 取的也是 `currentWorkspace` ⇒ **守卫判定的 workspace 与写入落点始终一致**,不存在"守卫放行但写到另一片"的缝。

### M-2 核心不变量无机器门 —— **CLOSED,四条红变异全部有靶**

我上轮点名的四条反向变异,现在逐条有判据:

| 反向变异 | 承接判据 | 亲验 |
|---|---|---|
| 把归属改回按 `currentWorkspace` | `kernel/base/ui-state/test/content.test.ts:180` "keeps write ownership independent from the render workspace" | ✅ 断言**全部四种组合**:MASTER/MAIN 真、MASTER/BRANCH 假、SLAVE/BRANCH 真、SLAVE/MAIN 假 |
| 删除 feature 守卫 | `ui/feature/sample-staff-auth/test/staffAuth.test.ts:363` "does not issue local content writes when a SLAVE is rendering its projected MAIN workspace" | ✅ 调**真 handler**、喂 SLAVE+VICE 状态、断言 `dispatches` 为空;走的正是配对后 JS reset 必触发的 `sessionRestoredAnonymous` 路径 |
| 恢复双片 prune | `content.test.ts:529` "prunes unknown catalog members **only in the instance-owned workspace**" | ✅ |
| 恢复 member-desk 的 `paired === true` fallback | `ui/feature/sample-member-desk/test/memberDesk.test.tsx:219`(主机)与 `:259`(副机) | ✅ 两侧都有 |

另外 `kernel/base/ui-state/test/module.test.ts:31` 把 `workspaceOwnedByInstanceMode` 纳入公共面清单 ⇒ 删除导出也会被公共面判据抓到。

### S-1 SECONDARY 的 SLAVE 准入 —— **CLOSED**

`ui/base/console-assembly/src/foundations/consoleAssembly.tsx:153-155`:SECONDARY part 若 `!part.catalogEntry.instanceModes.includes('SLAVE')` 则**装配期抛错**,文案 `SECONDARY part must allow SLAVE projection: {partKey}`。

⚠️ 我上轮建议放在 `catalog.ts`,**落在 console-assembly 更对**:catalog 是通用目录能力,不该知道"投影"这件事;console-assembly 才是知道拓扑投影语义的那一层。这是比我的建议更好的归属。

### S-2 topology kernel 硬编码 sample slice —— **CLOSED**

`kernel/base/topology/src/application/*.ts` 检索 `sample-member-registry` **零命中**,两处字面量已清除;注入机制由 `stateSyncSlices` 承接,`kernel/base/topology/test/topology.test.ts:321` 以 `stateSyncSlices: [{name: …, syncIntent: 'master-to-slave'}]` 驱动 ⇒ 声明路径本身有判据。

### 上轮三条 Note

- **N-1 content 投影无测试 —— CLOSED**。`content.test.ts:580` "projects the owner content slice in both declared sync directions":建**两个 runtime**,主机写 SECONDARY → 对 `.content.MAIN` 造全量载荷 → `applyAuthoritativeSync` 到 target → 断言 target 的 SECONDARY 为 `partKey: 'one'`;随后切 SLAVE+CHIEF 验反向。**state 层的端到端投影已被证明。**
- **N-2 规范未记录两个符号的区别 —— CLOSED**。`doc/platform/terminal-coding-standard.md:793-794` 逐字写明 `resolveWorkspace` 答"本机当前渲染哪个 workspace,**刻意允许 SLAVE + VICE → MAIN**",`workspaceOwnedByInstanceMode` 答"执行方可写哪个 workspace,SLAVE 始终只拥有 BRANCH"。
- **N-3 副机 MAIN 只由投影清理** —— 仍成立,属已接受的版本有损,见 §3。

## 2. 证据分档:纪律良好,未发现超发

`doc/evidence/platform/2026-09-19-…-complete-dynamic-validation-codex.md` 的"未升格事项"逐条核过:

- `:69` 明确拒绝把一次快照升格为完整 10 秒/30 秒 heartbeat 时序证明;
- `:138` 独立记"完整 heartbeat interval 仍未被一次设备记录单独证明";
- `:139` "visual/release acceptance 不由本轮 UI XML/截图升格";
- `:140` 阶段一双机与阶段二单机双屏/mobile **分开记录,未把一种形态冒充另一种**;
- `:141` "任何 reviewer 未读取的 evidence 仍按原档位保留,不因本汇总文件存在而自动升级";
- `:136` 甚至写明"本文没有对 Claude implementation review 预先给 GO"。
- `:20` 与 `:139` 两处显式排除 acceptance / release / visual。

⇒ **未发现把未读取内容、heartbeat 完整时序或 visual/release 升格为 PASS 的情形。**

runner 侧(`tools/terminal-topology/run-dual-device.mjs`,上轮我未覆盖,本轮补核):
- `:1863-1866` 聚合为 `results.every(... === 'PASS')`,**全过才过**,单个 profile 失败无法被掩盖;`stageTwoStatus` 要求 business 与 cleanup 双 PASS 否则 `OPEN`;
- `:1070` 目录过滤 `startsWith('stage1-')` ⇒ **不会误比较阶段二结果**;
- `:1079` 要求 `business === 'PASS' && cleanup === 'PASS' && labels.length === 预期`,否则 `continue` ⇒ **不会选到失败的历史结果,也不会把 cleanup 缺失误判为成功**;缺 `result.json` 或 JSON 解析失败同样 `continue`。

## 3. Notes

### N-1 runner 会在最新 stage1 失败时静默回退到更早的通过结果

```
严重度=N
状态=CONFIRMED(静态逻辑可证)
证据档位=static
需 Dexter 裁决=否
```

**仓内事实**:`run-dual-device.mjs:1066-1085` 的 `loadLatestStage1MemberReference` 按 `mtimeMs` 降序遍历 `stage1-*` 目录,**跳过**任何非全 PASS 或标签不全的候选,返回**第一个通过的**。

**推论与适用条件**:若"最新一次 stage1 失败、更早一次 stage1 通过"同时成立,该函数会返回**更早那次**,于是阶段二会拿**新代码的 stage2** 去比**旧代码的 stage1** 参照。

**最小反例**:跑 stage1(通过)→ 改代码 → 再跑 stage1(失败)→ 跑 stage2。比较基线是第一次的结果,而它已不代表当前代码。

**影响**:被流程挡住而非被代码挡住 —— 按约定 stage1 失败就该停下报告,不会进 stage2。所以现实风险低,但**工具本身不阻止**。

**最小修复**:把"最新的**通过**结果"改为"**最新的** stage1 结果,且它必须全 PASS,否则报错停止"。这样最新一次失败会**显式阻断**比较,而不是无声回退。不扩大:只改选择语义,不改聚合与 cleanup 判定。

### N-2 副机的 MAIN 仍只由投影清理(carryover,信息性)

副机不再 prune MAIN;重启到首次投影之间渲染上次持久化内容,构建变更时出 `incompatible-catalog-entry` fallback。属 Dexter 已接受的"版本不协商、允许有损",记录备查,不需要动作。

## 4. 未发现问题、但静态无法证明的事项

- 归属守卫在真实设备上的触发与日志呈现 —— 证据文档有记录,但本轮**未读取其原始产物**,按其原档位保留,不升格;
- 完整 heartbeat interval 时序 —— 按证据文档自陈仍未被单次设备记录证明,我同意该档位;
- APK binding、UI XML、stepwise comparison、cleanup 的**原始产物**本轮未逐份读取 —— 我只核了汇总文档的分档声明与 runner 的判定逻辑与源码一致,**不对其真伪背书**;
- mobile 受管验证的现场呈现未取证。

## 5. 分档结论

- **DESIGN_GAPS**:无。上轮两条设计缺口(S-1 的装配期检查、M-2 的判据)均已落成实现与测试。
- **L2_USER_VISIBLE**:本批不新增 Journey、不改 testId;上轮的 `GO_WITH_UNVERIFIED_UI` 成因(副机异常而非 no-op)已消除。UI 行为本身未在本轮静态范围内取证,仍按 `L2_UNVERIFIED` 保留,不宣称 visual PASS。
- `static` = **已完成**,本文全部结论均为当前源码、测试文本与脚本逻辑可证。
- `focused` = **本轮未运行**。测试的存在与断言方向我逐条读过并确认可证伪,但**运行结果**属实施方证据,本文未据其下结论。
- `native/Android`、`device`、`Web`、`visual/release`、`cleanup` = **一律未升格为已验证**。

## 6. 本轮方法披露

我在本轮**三次**因 grep 模式过窄而差点下出错误的否定结论:检索共享守卫时漏了导出符号名(险些误判 staff-auth 未接)、检索 member-desk 守卫时用了 staff-auth 的本地别名(险些误判未逐处覆盖)、检索 SLAVE 准入时只看了 `catalog.ts`(险些误判 S-1 未闭合)。三处均靠直接打开文件纠正。**凡本文的否定结论,均已用打开文件的方式复核,未停在检索层面。**

## 7. 授权边界

本轮只做 implementation review。未新增产品语义或 Journey、未扩张范围、未执行部署、seed 或 UAT。**GO 不自动升级为 implementation acceptance**;是否进入下一步由 Dexter 裁定。
