# TER 版本更新阶段 C · 当前整批 IMPLEMENTATION 复评 R4

## 1. 结论与范围

- `REVIEW_TARGET=IMPLEMENTATION`
- `REVIEW_SCOPE=STAGE_C_WHOLE_CURRENT_SOURCE_AND_SCOPED_ARCHIVED_EVIDENCE`
- `VERDICT=NO-GO`
- `M/S/N=0/1/1`
- 日期：2026-10-11。

原 S-1～S-4 的修复在当前源码中闭合；原 N-1、N-2 关闭，原 N-3 部分关闭。新增阻断是共享 integration assembly 仍调用旧的 catalog context 签名，实际产出缺少 displayMode 的 command route context。此问题位于作者已披露的未修改路径，但当前整批实现仍消费它，不能仅因它不是本次修复文件而豁免。

本结论不代表 CP 当前所有字节 MATCHED、13c 完成、修复后整批动态 PASS，也不继承差量 reviewer 的 GO。未执行任何测试、构建、生成、verify、DEV、Web、设备或数据操作；只新增本评审文件。

### 独立性与读法

主评审是续接会话，不是 fresh。主评审先读当前 request/intake 定位，再重开需求、详设、实际生产调用链与直接测试，故不能声称主评审盲审。三名 fork-none fresh 只读子 reviewer 分别负责业务/凭证、执行/driver、CBS/运营报告，要求先形成源码判断再对照作者 intake；主评审重新核查并去重，不机械继承分工 verdict。子 reviewer 均未写文件、执行测试或读取运行归档。既有内部 DESIGN cycle 不重开。

本次需求、详设、计划与关键入口的 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` | `1c3f864cd94d77296be4fdc2e4ef95c54abaf7155aef75b23ab0b35906d1605d` |
| `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md` | `801bf6429095b80612edf1432d5af9dbfac9f9754feb6dddfcf3b89f7347ea48` |
| `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md` | `9291dd46c1d4d0c21d8c55d3161c6b4cf9b688eca1987ffbdb307103a9146e88` |
| `apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx` | `1fef9eb95c5b20b0d0520c803d45e8987d3c770df25f122665d90199a5f00dea` |
| `apps/terminal/ui/base/render/src/foundations/createCatalogContext.ts` | `93ff321eb199b80157dc21d2d4a426fc35fa3819d258883ac9f208fcded73ea6` |
| `apps/terminal/kernel/feature/project-basic/src/selectors/selectors.ts` | `c67557106ce1be27a7446a86bcfa0d03f15cb9dde7244bdaea4ba2868f4173c8` |
| `tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts` | `6f7ce86911e00f58caabb87da41b54dcaaa5cc99ec1af422af3c6b06996e2530` |

## 2. 当前 findings

### R4-S-1：共享装配使用旧签名，command 路由上下文没有有效屏幕身份

- 性质：`CONFIRMED / 仓内源码事实`；S。
- 判据：C 详设 `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:282`（§8.5）要求本机 MAIN/BRANCH 的 PRIMARY route context；同文 `:333` 保持既有同 App 配对业务/peer owner。
- 实现：`apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx:401` 调用 `createCatalogContext(root, displayMode, input.surfaceForm)`。当前 `apps/terminal/ui/base/render/src/foundations/createCatalogContext.ts:8` 的第二参数已经是 `{displayMode,surfaceForm,workspaceOverride?}`；`:12` 直接解构该对象。
- 可复验反例：PRIMARY/SECONDARY 字符串作为第二参数进入当前函数，解构出的 displayMode、surfaceForm 均为 undefined，第三参数不被消费。装配 `:402` 将这个无有效 displayMode 的对象返回；`apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:55`、`:63` 将它传入真实 UI dispatch 的 routeContext，没有字段校正或 fallback。
- 实际消费者：`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:137`、`apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:115` 都使用该共享装配。`apps/terminal/kernel/base/display-context/src/features/actors/switchInstanceModeActor.ts:64`、`switchDisplayRoleActor.ts:44` 消费 command 的屏幕字段；`displayDerivation.ts:32`、`:52` 将缺失屏幕身份判作 missing-display-route。Topology resolver `apps/terminal/kernel/base/topology/src/foundations/resolveCommandTarget.ts:22`、`:30` 也依赖该字段进行 peer-intent 判定。
- 影响：当前生产装配违反屏幕路由输入契约，且对应作者已披露的 package typecheck 阻断。依赖屏幕身份的 command 无法取得声明的上下文。**不据此宣称当前 confirm/defer 或成员操作必败**：更新安装 actor 不直接读取 displayMode，当前成员 caller 使用显式 target；本轮没有执行这些动态操作。
- 最小修正：将 `:401` 改为 `createCatalogContext(root, {displayMode, surfaceForm: input.surfaceForm})`，不改 render API、不加 fallback 或第二路由机制。可验收条件是共享真实装配为 PRIMARY/SECONDARY 各产出有效 routeContext，并保持两个 integration 的本机 workspace 归属。仅需受影响调用链的差量复核及定向检查，不要求完整设备矩阵。
- 是否需 Dexter 产品裁决：否，现有签名与详设已经明确。

### R4-N-1：报告最终汇总仍把“找到”写成未测得的计数

- 性质：`CONFIRMED / 仓内源码事实`；N，原 N-3 同根残余。
- 判据：C 详设 §8.8 的同 task 报告及 §11 `update.report` 的精确读回；同文 `:505` 的必要诊断。诊断须与实际读取范围一致，不能由找到一项推导全历史唯一。
- 位置：`tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts:960` 最终输出硬编码 `currentTaskMatches=1`。`:831` 使用 findIndex，`:863` 找到目标即停止读取后续页；`:859` 页日志已经正确改成 taskFound。
- 反例与影响：两个相同 task 项或后页另有相同 task 时，该汇总仍写 1。这只证明标记没有测量计数，**不证明 CBS 真的产生重复行**。真实同 task 唯一性仍由服务端约束与 owner 处理证明；业务读回未因此失效。
- 最小修正：最终字段改为 `currentTaskFound=1`，与页日志统一。无需扫描完整历史、增加重复检测框架或重跑设备。
- 是否需 Dexter 产品裁决：否。

## 3. 原七项的关闭表

下表 CLOSED 仅指本轮源码反例关闭，不表示修复后设备证明。

| 原项 | 状态 | 当前独立核验依据 |
| --- | --- | --- |
| S-1 Web HTTP 上界 | CLOSED | `createBrowserTransportNetworkAdapter.ts:10` 使用 1,048,576 字节，`:17` 起流式计数，超界取消 reader，`:142` 消费；直接测试包含 70,000 字节成功和 1 MiB+1 拒绝。HTTP 与 WS 消息上限分开。 |
| S-2 fixed 与断链资格 | CLOSED | `project-basic/src/selectors/selectors.ts:176` 的 fixed selector 仅放宽普通 peer projection readiness，`:97` 仍核 MASTER 来源与绑定；新候选 `:142` 继续 strict。两 assembly `:205`、`:192` 注入；update actor `:1175`、`:1218` grant 前后实际消费 fixed reader。解绑/身份不匹配仍拒绝。 |
| S-3 actual 未知原因展示 | CLOSED | formatter `terminalUpdateActualUnknownReason.ts:1` 映射四个 canonical 值，未知/null 不伪造；`ProjectTerminalUpdatePage.tsx:685` 最新详情及 `:1042` 历史都读取 actual.unknownReason，而非 recent.reason。 |
| S-4 Android 诊断闭包 | CLOSED | `androidDevice.ts:350` 起 logcat 有界；`runner.ts:169` 起按同 run/role/source 聚合，缺失/不可读/重复独立 FAIL；`:1582`、`:1604` 更新 diagnostics 并进入退出判定。Journey 每源捕获读取失败后仍进入 cleanup。源码闭合，设备读取修复 NOT_RUN。 |
| N-1 旧 runner case | CLOSED | `runner.ts:1104` 在预算预检、manifest 与 suite 前拒绝旧 case；当前 supply-chain/pair 未被误伤。旧分支仍存在但不是 implemented 入口，不据此声称已迁移或通过。 |
| N-2 首订阅水位 | CLOSED | 详设 `:196` 与计划 `:36` 明确 subscribe-before-snapshot、initialTimeEpochMillis=0；0 是登记起点，不冒充规则更新时间。完整 HTTP 分页/hash/flush 后才 ready。 |
| N-3 taskFound | PARTIALLY | 页日志 `terminalUpdateSupplyUi.ts:859` 已正确；最终 `:960` 仍残留未测计数字段，见 R4-N-1。 |

## 4. 方案合理性、同根扫描与过滤

业务目标仍是管理员维护规则，两端各自按本机事实更新并读回报告。project-basic 拥有组织/规则，store-basic 拥有门店及其后续资料，terminal-update 拥有固定执行与报告，TDC 保持凭证/认证 HTTP owner；当前修复不需要更换方案。

- route context 全部 createCatalogContext 调用已核对：共享装配错配；`render/src/hooks/useUiCatalogContext.ts:32` 与 `render/test/layerStack.test.tsx:319` 使用对象签名。两套 integration 的共享生产入口均受影响，无需分别再造修法。
- fixed selector 的组织、绑定与规则 ready 同根路径已查。曾怀疑规则刷新 loading/failed 后 fixed 暂停也是新 S；重读详设 `:208` 明确“context 暂未 ready 保留 fixed 并延期，ready 后续接”，当前实现没有撤销任务或换目标，故撤回该源码 finding。普通配对断链与规则读取失败须分开，不把所有等待都当 bug。
- fixed 的 PRIMARY-ready → confirm/reconcile 与 project ready → target:null 两个续接入口均核对；不是仅注册新 selector 而没有消费。
- CBS 报告 owner 的 binding 锁核、序号/receipt/同 task 更新、历史 cursor 与启用门店/终端范围闭合；下载仍核 binding/scope/App/artifact，固定之后不要求规则继续启用。运营页面仍复用 foundation cursor/Drawer lifecycle/刷新，不需第二账本、通用恢复框架或全历史重复计数。
- Android runtime/native、MASTER/SLAVE、读取失败与 cleanup 聚合均查；业务、diagnostics、cleanup 保持分别判定。

## 5. 证据档位与未验证项

### L1_ENGINEERING

本轮亲验为当前文档、源码、直接测试的只读检查。作者 intake `:71` 起记录的 focused 数字包括 integration-assembly 7 files/21 tests、project-basic 2/13、terminal-update 3/57、runner 最终 1/50，以及 formatter/required-scope focused；这些是**作者记录的本轮局部验证**，本评审未执行命令或用测试源码代替 PASS，也不将其升级为整批动态证明。

integration-assembly typecheck 的三个残余 `intake:77` 如实 OPEN：生产 `integrationAssembly.tsx:401` 已列为 R4-S-1；测试 `partSelection.test.ts:34` 缺当前 renderer placementScope、`runtimeOwner.test.ts:104` 未对 createSurface 返回类型作相应 ReactElement 收窄，是测试/类型边界残余，不另外计为两个生产业务 S。它们不能被写成 package typecheck PASS。

### L2_USER_VISIBLE / 历史归档

重新读取六份 manifest：均记录 business=PASS、runner cleanup=PASS。准确分类为 **两次 Expo Web＋四次 Android**，不是六次设备 run：

| run ID | 执行面及范围 |
| --- | --- |
| `87afb762-ea92-44ad-a443-5761feaefeca` | console Expo Web |
| `06e78579-a966-4514-bd40-01b2af4cfbd6` | wallpaper Expo Web |
| `cdede977-e568-42a9-b1de-5148b3db23aa` | console 真机双屏 |
| `24ee070e-76bf-425e-b7aa-55a84ca010ac` | wallpaper mobile 虚拟机 |
| `039c9a27-c918-4ffe-b94a-ad5a1a36269d` | console 双虚拟机配对 |
| `928cfaa0-6aa7-45d4-b0f6-16f289fcba7d` | wallpaper 双虚拟机配对 |

共同路径为 `.runtime/terminal-automation/<runId>/run-manifest.json` 与 runner.log。配对日志分别 `:2463`、`:2727` 仍是 PAIR_SLAVE android-runtime `LOG_NOT_AVAILABLE / OUTPUT_LIMIT`；本次 S-4 修复不能追溯改写它们。其历史业务与资源回收 PASS 保留，诊断缺口另列，不能写修复后当前设备完整 PASS。

### 后端与 DEV 生命周期

`.runtime/r5/evidence/remote-testcontainers/r5-tc-1791688651328-25736/run-manifest.json`：business=PASS、Testcontainers cleanup=PASS，但 status=FAIL、firstFailure=DEV_RESTART_FAILED，devLifecycle.restore=FAIL / R5_DEV_START=PASS_NOT_CONFIRMED。后续受管 DEV start 不把该 run 的自动恢复改写为 PASS。本次按 Dexter 边界不将它扩大成阶段 C 业务 finding，也不要求再次启动/重跑。

### L3_UNVERIFIED / NOT_RUN

- 修复后的真实 Web HTTP 边界、fixed 离线直连、未知原因浏览器展示、Android 诊断读取及退出行为未在本轮动态运行。
- 本轮没有新 backend-acceptance、完整设备矩阵、DEV、reset/seed、L2/UAT、默认全仓 verify 或生产行为证明。
- 当前源码结论不授权这些运行；缺少新动态记录本身不额外计 S，不以重跑未受影响完整矩阵替代最小源码修正。

## 6. DESIGN_GAPS 与交付动作

新增 DESIGN_GAPS：无。两项 finding 均已有详设/接口/诊断判据；不另造产品义务。历史 severity 正本补充等治理项不在本轮自行扩大或修改。

建议由主 agent 重开本报告的 owning source，只修确认内容：共享调用改当前对象参数、汇总标记改 Found，并处理已披露的测试类型残余。对受影响真实装配和诊断输出作差量复核及必要定向检查；无需重新对账未变 CP 或重跑未受影响完整矩阵。后续实施/验证仍须 Dexter 授权，本评审本身不授权。
