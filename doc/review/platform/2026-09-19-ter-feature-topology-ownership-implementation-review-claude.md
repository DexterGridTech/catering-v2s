# TER feature 端写入归属整改 · IMPLEMENTATION review(静态)

- 评审人:Claude｜日期:2026-09-19
- REVIEW_TARGET=IMPLEMENTATION;**仅静态源码逻辑**
- 方式:先独立重开当前字节形成结论,再对照详设/计划/旧 review/evidence。**未采信任何自报结论或历史证据。**

## 0. 结论

```
VERDICT=NO-GO
M/S/N=2/2/3
```

⚠️ 本轮**只读**,零写入(本文件除外);未执行构建、Metro、Web、Android、设备、seed、UAT 或部署。**不构成 implementation acceptance、Android、Web、release、visual、cleanup 或整体验收 PASS。**

## 1. 先回答:这件事解决什么问题,解决了没有

**业务问题(比"画面漂移"更具体)**:副屏是**面向顾客**的(`sample.desk.customer-welcome` / `customer-member`),主屏是店员的。整改前主副机各写各的内容 slice,两个独立事实源 ⇒ 重连或恢复后,副屏可能向**当前顾客展示上一位顾客的姓名/手机号**,而连接看起来完全健康。这不只是显示不一致,是**信息展示给错的人**。

**技术问题**:同一业务事实有两个写入者,且没有权威来源。

**解决了吗 —— 机制层面:是。** 我逐环走过:主机 actor 写 `MAIN` 的 SECONDARY 段(`sample-member-desk` 的 `hasSecondarySurface` 现在只认 `hasTopologySecondarySurface`,副机为假);`workspaceSlices.ts:634` 把 MAIN 声明为 `master-to-slave`、BRANCH 为 `slave-to-master`;同步控制器已泛化为声明表并由 integration 注入;`resolveCommandTarget` 删掉了"主机把 SECONDARY 命令派给副机"的分支;副机侧写 MAIN 会被门拒。**一个写入者、一条投影、一个事实。方向是对的。**

**但工程层面没做完**:规则落进了 kernel,**却没有任何一个 feature 被教会这条规则**(M-1),而且**这条不变量本身没有机器门**(M-2)。

## 2. 做对的部分(逐条回源核过,不重复计入 finding)

| 事项 | 落点 | 结论 |
|---|---|---|
| 归属门按 `instanceMode` 而非 `currentWorkspace` | `contentActors.ts:170-171,173-182` | ✅ `workspaceOwnedByInstanceMode` 是 `MASTER→MAIN` 否则 `BRANCH`;我上轮 N-1 警告的陷阱避开了 |
| 门覆盖六处派发 | `:240`(覆盖 `278/316/329/339`)、`:357`(`385`)、`:435`(`453`) | ✅ 六处全覆盖 |
| fail closed | `selectRuntimeInstanceMode` 缺片抛、非 `MASTER/SLAVE` 抛 | ✅ 取值域封闭,三元无第三态漏网 |
| prune 按 instanceMode 取单片 | `:397`、`:428` `[workspaceOwnedByInstanceMode(...)]` | ✅ 不再无条件遍历两片 |
| 投影豁免 | 门只在 `contentActions` 派发处;`APPLY_AUTHORITATIVE_SYNC` 走 `createStateStore` 独立 action | ✅ 不误拦投影 |
| **无法绕过门** | `contentActions` **未从 `ui-state/src/index.ts` 导出** | ✅ 他包无法直接派发内容 action |
| 路由收紧 | `resolveCommandTarget`:主机派 peer 的分支已删;`peer-intent` 收紧为 `SLAVE && paired && displayMode === 'SECONDARY'` | ✅ 同时修掉旧 M-3(副机切 PRIMARY 后本地执行) |
| 副机自发重放消除 | `sample-member-desk/actors.ts:82-85` 只剩 `hasTopologySecondarySurface === true` | ✅ `paired === true` fallback 已删 |
| moduleName 配对 | 两个 `assembly.tsx:2` 各自 import integration 层 moduleName 并注入(`:112`/`:95`);`createTopologyModule:348` 比对;`:112/:123` `isExpectedPeer` 连 nodeId 同查 | ✅ 层级、注入点、拒绝逻辑全对 |
| 接收侧方向归一 | `createTopologyStateSyncController:253-262` 三重校验(声明存在、方向匹配声明、方向匹配本机角色)+ stale-revision | ✅ |

## 3. Major

### M-1 归属规则只落进 kernel,没有任何 feature 被教会;`sample-staff-auth` 在副机 VICE 下有七处必被拒的写入

```
严重度=M
状态=CONFIRMED(静态调用链可证)
需 Dexter 裁决=否(属实现补齐);但涉及 Journey 呈现取舍时需一句确认
```

**仓内事实与调用链**

- `ui/feature/sample-staff-auth/src/features/actors/actors.ts:30` `const primary = 'PRIMARY' as const`,其后**七处**内容写入全部硬绑 `primary`,且**无任何 `instanceMode` / `displayRole` / surface 设防**:
  - `createAuthNavigationActor`:`logoutSucceededCommand` → `clearLayers(PRIMARY)` + `showLogin(PRIMARY)`;**`sessionRestoredAnonymousCommand` → `showLogin(PRIMARY)`**;`loginSucceededCommand` → `clearLayers(PRIMARY)`;
  - `createAuthResultActor`:`loginFailed` → `openLayer(PRIMARY)`;
  - `createAuthNoticeActor`:`authNoticeDismissed` → `closeLayer(PRIMARY)`;
  - `createAuthSystemNoticeActor`:`authSystemFailureObserved` → `openLayer(PRIMARY)`;`...Dismissed` → `closeLayer(PRIMARY)`。
- 两个 integration 都装了它(`sample-console/src/assembly/assembly.tsx:11,75,127`;`sample-wallpaper-console/src/assembly/assembly.tsx:10`)。
- `dispatchContentAction:237` 取 `currentWorkspace(context)` = `resolveWorkspace({instanceMode, displayRole})`;`displayDerivation.ts:11-14` 对 **SLAVE + VICE 返回 `MAIN`**。
- `:240` `assertContentWriteOwnership(context, 'MAIN')`,而 SLAVE 拥有 `BRANCH` ⇒ **抛 ownership violation**。
- `createCommandActorDispatcher.ts:255-259` 把该异常 `.catch` 成 `{status: 'error', …}` ⇒ 不崩、不倒模块,但**每次都产出一条 error 状态命令**。

**最小反例(走的是正常路径,不是边角)**

配对流程本身会重置 JS:`kernel/base/topology/src/features/actors/actors.ts:224` `appControl.resetRuntime(...)`,详设亦写明"pair 中 host/服务稳定后切 slave/vice,再 reset JS"。⇒ 配对完成后副机重启 JS → 会话恢复派 `sessionRestoredAnonymousCommand` → `showLogin(PRIMARY)` → 门拒 → error。**此后副机每次启动都会重复。**

**影响**

- **对用户**:结果碰巧是对的(顾客屏不该出现店员登录页),但达成方式是异常而非设计的 no-op;
- **对维护面**:副机日志与命令账上持续出现 ownership violation 的 error 命令 —— 这正是 Dexter 要求阶段一盯 WS 与日志时会看到的"不符合预期";
- **对完成度**:说明整改**只做了 kernel 一半**。`sample-staff-auth` 是我按项目记忆 `ter-primary-placement-has-multiple-owners`("PRIMARY 放什么不止一个 owner,只看 integration 本地 actor 会下错否定结论")找到的;**同类未设防的 feature 可能不止它一个**,须全量排查。

**最小修复**:给内容写入提供**按角色的可用性前置**,让 feature 在不拥有该 workspace 时走 no-op 而非抛错 —— 例如在 feature 侧统一用一个"本机是否拥有该 displayMode 对应的 workspace"的判据做守卫。**不要**把门放宽,也**不要**给 staff-auth 单独打补丁:七处只是当前已知,放宽或个案补丁都会让下一个 feature 再撞一次。

### M-2 本批的核心不变量没有机器门:`assertContentWriteOwnership` 在全树测试中零命中

```
严重度=M
状态=CONFIRMED
需 Dexter 裁决=否
```

**仓内事实**:`assertContentWriteOwnership` 在 `apps/terminal` 全树的出现点只有 **4 处,全部在源码**(`contentActors.ts:173` 定义 + `:240`/`:357`/`:435` 调用)。`kernel`、`ui`、`tools` 下**任何测试文件零命中**;检索 `content write ownership` / `ownership violation` 同样零命中。

**反向代入(逐条推演,均不变红)**

- 把 `workspaceOwnedByInstanceMode` 改回按 `currentWorkspace` 判定 ⇒ 无测试变红;
- 删除三处 `assertContentWriteOwnership` 调用 ⇒ 无测试变红;
- 把 prune 的 `:397`/`:428` 改回 `['MAIN','BRANCH']` ⇒ 无测试变红;
- 恢复 `sample-member-desk` 的 `paired === true` fallback ⇒ 无测试变红(`hasSecondarySurface` 亦无专项断言)。

**影响**:`project-memory/operations/verification-governance.md` 与仓内一贯要求是"判据要能逮住自己那条 finding"。本批把一条 Dexter 亲自定的写入归属规则落成运行期守卫,却**没有任何门保证它不被回退** —— 下一次重构可以无声地把它改掉。

**最小修复**:为归属门补 focused 测试,至少四条反向用例各配一次 red mutation(副机 VICE 写 MAIN 必抛、副机 CHIEF 写 BRANCH 必通过、主机写 MAIN 必通过、主机写 BRANCH 必抛)。为什么不扩大:不需要新机制,现有 `kernel/base/ui-state/test/content.test.ts` 已有 workspace/role 夹具可直接复用。

## 4. Significant

### S-1 "被投影的 SECONDARY part 必须允许 SLAVE"没有装配期封闭检查,当前合规属巧合

```
严重度=S
状态=CONFIRMED
```

**仓内事实**:`catalog.ts:93` 只校验 `instanceModes` 是封闭取值的数组(`assertClosedArray`),`:157` 在渲染期查 `entry.instanceModes.includes(context.instanceMode)`;**没有任何规则要求"可出现在 SECONDARY 的 part 必须包含 SLAVE"**。当前两个 integration 的副屏 part 确实都是 `masterAndSlave`(`sample-wallpaper-console/src/parts/parts.ts:17,30`),但这是**当前值,不是机械保证** —— 详设自己也是这么写的,只是检查未实现。

**最小反例**:新增一个 `instanceModes: ['MASTER']` 的 SECONDARY part。同 APP 同构建下投影到副机后 `isUiCatalogEntryAvailable` 判否 ⇒ 渲染成 `incompatible-catalog-entry` fallback。现场表现为"内容没同步",而实际是 part 声明问题,极难定位。

**最小修复**:在 `createUiCatalog` 的既有封闭校验里加一条:`displayModes` 含 `SECONDARY` 的条目,`instanceModes` 必须含 `SLAVE`。**不新增机制**,复用现有 `assertClosedArray` 同层的校验位置即可。

### S-2 `kernel/base/topology` 仍以字符串字面量硬编码 sample feature 的 slice 名,且重复两处

```
严重度=S
状态=CONFIRMED
```

**仓内事实**:`createTopologyStateSyncController.ts:13` 与 `createTopologyModule.ts:64` 各有一份 `const membersSliceName = 'kernel.feature.sample-member-registry.members' as const`;而 `kernel/base/topology/package.json` **不依赖** `sample-member-registry` ⇒ 是**依赖图看不见的字符串耦合**。

**关键点**:注入机制**已经建好了** —— `createTopologyStateSyncController:134-135` 的 `declarations` 已支持 `...(input.stateSyncSlices ?? [])`,两个 integration 也已在 `assembly.tsx:116`/`:99` 注入内容 slice。members 完全可以走同一条路。⇒ **这是重复造轮子的反面:轮子造好了却没用上**,kernel base 继续认识一个 sample feature 的名字。

**最小修复**:把 members 也改为由 integration 注入,删掉两处字面量。为什么不更小:只删一处会留下另一处,且两处已出现漂移风险。

## 5. Notes

### N-1 content 跨机投影的接线无任何测试引用

`stateSyncSlices` 在测试树零命中(仅源码与两个 `assembly.tsx` 出现);`kernel/base/topology/test` 与两个 integration 测试中检索 `.content.MAIN` / `.content.BRANCH` 亦零命中。⇒ 替代了命令路由的那条投影链**没有 focused 证明**。归入 `UNVERIFIED_REQUIRES_EVIDENCE`,不计为缺陷,但它与 M-2 是同一类风险。

### N-2 `resolveWorkspace` 与 `workspaceOwnedByInstanceMode` 语义不同但未在规范中记录

前者答"本机当前**渲染**哪个 workspace"(SLAVE+VICE → MAIN),后者答"本机可**写入**哪个 workspace"(SLAVE → BRANCH)。**两者对 SLAVE+VICE 刻意不同**,这正是整条规则的要害。但 `doc/platform/terminal-coding-standard.md` §4-D 未记录这个区别。⇒ 将来很可能被人"统一"成一个函数而无声地复活旧缺陷。建议在 §4-D 补一句并点名两个符号。

### N-3 副机的 MAIN 从此只由投影清理(carryover)

副机不再 prune MAIN;重启到首次投影之间渲染的是上次持久化内容,构建变更时会出 `incompatible-catalog-entry` fallback。属 Dexter 已接受的"版本有损",记录备查。

## 6. 未发现问题、但静态无法证明的事项

- 归属门在真实运行期是否被触发、错误如何在日志中呈现 —— `UNVERIFIED_REQUIRES_EVIDENCE`(M-1 的现场形态需 focused/device 证明);
- 投影在双机上的端到端正确性(revision 单调、断连恢复、半套不 apply)—— 本轮未执行 focused;
- `tools/terminal-topology/run-dual-device.mjs` 的阶段结果选择与 cleanup 判定逻辑 —— 本轮未逐行核,列为未覆盖,不作结论;
- mobile topology tab 恒显示与置灰原因 —— 未在本轮核验范围内取证。

## 7. 分档结论

- **DESIGN_GAPS**:有。S-1 的装配期封闭检查在详设中被写为"应增加"但未实现;M-2 的判据在详设的测试覆盖章节未落成具体用例。
- **L2_USER_VISIBLE**:`GO_WITH_UNVERIFIED_UI`。本批不新增 Journey、不改 testId;M-1 的用户可见后果是"副机不显示店员登录页",**结果正确但达成方式是异常**,其现场呈现未经证明。
- **L2_UNVERIFIED**:是(同上)。
- `static` = **已完成**,本文全部结论均为当前源码、类型与调用图可证。
- `focused` = **未运行**,不得据本轮结论宣称任何测试通过。
- `native/Android`、`device`、`Web`、`visual/release`、`cleanup` = **本轮不涉及,一律未升格为已验证**。

## 8. 授权边界

本轮只授权静态源码 review。未修改源码、测试、脚本、依赖或文档;未执行任何构建或设备动作;未重新裁定 Dexter 已确定的 MAIN/BRANCH 写入归属、projection 豁免、路由边界与 mobile 展示规则;未把历史 evidence 或作者自报数字当作源码真相。**本轮只覆盖实施后的静态逻辑,不代表整体 implementation acceptance。**
