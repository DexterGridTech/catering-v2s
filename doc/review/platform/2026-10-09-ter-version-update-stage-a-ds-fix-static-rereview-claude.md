# TER 版本更新阶段 A · D-S-1～D-S-4 修复差量静态复评

日期：2026-10-09。审查者：Claude。只针对本次修复差量，不是阶段 A 整批交付 review。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/1/0
EVIDENCE_TIER=STATIC_SOURCE_ONLY
L1_ENGINEERING=S-1：FULL 失败读回仍会永久占用任务
L2_USER_VISIBLE=NOT_APPLICABLE：本差量无新增界面，且仅授权源码静态复评
L3_UNVERIFIED=空：不以本轮范围外动态验证作为 finding
SAME_ROOT_SCAN=已核对成功/失败、直接返回/readback、同 boot/后继 boot、APK 消费与 run-owned 清理路径
DESIGN_GAPS=无：本轮 finding 已有明确需求及详设判据
TEMPLATE_COVERAGE=NOT_APPLICABLE：本轮不评审设计模板完整性
```

## 1. 范围、独立性与读法

本主会话是续接会话，不宣称 fresh。本轮先重开需求、详设和 owning source，独立形成原四项闭合情况与同根反例，再读作者 intake。两位 fresh 只读子 agent 分别检查 boot 生命周期和 builder/cleanup/compatibility 调用链；前者独立确认 S-1，后者对 D-S-2～D-S-4 给出限定范围 GO、0/0/0。主审逐条核对、去重后形成本文，不继承作者或此前 reviewer 的 verdict，也不重开已关闭的 DESIGN cycle。

仅使用读取、检索与文件摘要命令。没有运行测试、生成、编译、构建、verify、Android/Kotlin、Expo Web、DEV、设备或环境操作，没有读取 `.runtime/` 或运行 evidence。仅新增本评审交付物，未修改实现、测试、需求、详设或计划。

## 2. 四项原反例的关闭情况

| 项目 | 当前静态判断 | 源码及测试依据 |
| --- | --- | --- |
| D-S-1 FULL-only 成功 boot 占位 | CLOSED：原成功路径反例关闭；相邻失败路径仍有 S-1 | `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:399`～`:405` 在成功但无权威 boot 时保持 UNKNOWN；`:460` 成功使用同次 `actualBootId`。`test/terminalUpdate.test.ts:302`～`:421` 覆盖 nullable action boot、成功 boot 占位、同 boot 拒绝第二目标及持久化重建后的继任 boot 释放。 |
| D-S-2 完整 APK stdout 缓冲 | CLOSED | `scripts/build/terminal-update-artifact.mjs:80`～`:93` 以 1 MiB buffer 流式摘要；`:128`～`:153` 将 unzip stdout 写文件，错误/空输出删除临时文件，finally 关闭 fd。INSTALL、FULL 和 minimum-FULL 的完整 APK 消费在 `:884`、`:902`～`:904`、`:519`～`:553`、`:943`～`:975` 使用文件摘要或文件输出；残余 `runBytes` 是 JS/资源输入，不是完整 APK。`:573`～`:583` 的 40 MiB 自测为源码可确认的覆盖设计，未在本轮执行。 |
| D-S-3 FULL staging 与 compatibility 解包物清理 | CLOSED | `tools/terminal-automation/src/runner.ts:245`～`:264` 为两 App 明确登记 `full-staging` 和独立 compatibility APK；`:268`～`:290` 在 runRoot 内逐段校验、拒绝 symlink，删除并读回不存在。`:1231`～`:1243` 将清理异常进入 cleanup 判定。`test/runner.test.ts:153`～`:222` 验证新增文件删除，`:281`～`:293` 覆盖 symlink 拒绝；不扩展未知资源删除权。 |
| D-S-4 外部 FULL3 实际安装输入 | CLOSED | `tools/terminal-automation/journeys/update.android.test.ts:80`～`:127` 复核 descriptor/publication、外层 ZIP 摘要、唯一 APK entry 和内层 APK 摘要，提取到独立 `*-compat-external.apk`；`:2055`～`:2059` 将返回文件传入既有 `connection.install`。`scripts/build/terminal-update-artifact.mjs:906`～`:920` 独立产生外部 FULL 输入，未覆盖 INSTALL APK。 |

以上 CLOSED 是原反例的静态关闭判断，不代表相关测试已由本轮执行，或设备行为已通过。

## 3. S-1 · FULL 技术失败读回丢失 boot，后继启动永久占位

**性质：仓内事实支持的失效推论；CONFIRMED。需要 Dexter 产品裁决：否。**

**需求与详设判据：**

- 正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md:178`：终态失败解除后继启动的任务占用，同启动不执行另一规则；后继启动可接受不同修复工件，仍不允许重试旧失败工件。
- 详设 `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:184`、`:187`：同 boot 只占一条规则，后继 boot 可接受不同修复 artifact。

**当前源码事实与反例：**

1. FULL 固定执行时，owner 已从 actual 保存任务 boot（actor `:160`～`:181`）。原生 `apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateRuntime.kt:684`～`:695` 创建 FULL action 时没有写 `actionBootId`；此前未执行 HOT 的合法 FULL 可以没有这个字段。
2. 原生明确技术失败 callback 写 `callback-failed`（`:488`）。当 installer session 已结束而目标未安装时，`:403`、`:414` 返回 `failed`，`action.bootId` 可以为 null。
3. actor `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:460` 在非成功分支直接采用 `action.bootId`，把任务原先已知的 boot 覆盖为 null。它仍会保存 failed 状态、失败工件身份并释放 prepared 资源，因此不是失败未被识别的问题。同一赋值还覆盖能走到此处的 waiting-user/unknown 读回；若这些状态先擦掉 boot，随后只修 failed 分支也不足以保留身份。
4. 同文件 `:355`～`:365` 的终态释放要求 `task.bootId !== null`。继任 Runtime 无法释放上述任务；再次 readback 仍得到 failed/null，再次写回 null。`:578`～`:596` 因 `currentTask` 仍存在拒绝不同 selection 或返回 already-fixed。

**影响：** 一次明确 FULL 安装技术失败后，后继启动也无法领取不同修复工件。失败终态被永久占位，违反 R-10；没有手工重试入口的既定产品边界不能作为这个缺口的出口。

**测试源码核对：**

`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts:1917`～`:1976` 已有 FULL readback 失败 fixture，沿用 bootId 为 null 的 `noAction`（`:1942`～`:1948`），但只断言失败身份、recentStatus 和 releasePrepared（`:1970`～`:1975`）。`:423` 起的失败跨 boot 用例是 HOT 且有非空 action boot，不能覆盖此反例。测试存在不等于本路径正确，也不因缺少动态 evidence 而提出本 finding。

**可验收的最小修正：**

- FULL 非成功 readback 不应以空 action boot 擦掉已固定的占位身份；包括 failed，以及此前可能经过的 waiting-user/unknown。可在现有赋值处对缺失 action boot 保留 `task.bootId`，无需增加状态。成功分支继续使用同次权威 actual boot，无权威成功 boot 保持 UNKNOWN。无需更改 native 的 FULL boot 契约、新建账本或增加恢复框架。
- 在既有 FULL 失败测试补充：直接 failed/null 和先 waiting-user/unknown/null 再 failed 两条路径仍保留有效占位身份；同 boot 不接受第二规则；持久化重建后继 boot 释放任务并可接受不同修复工件；原 `failedArtifactIds` 不被清除、旧失败工件仍被拒绝。
- 修复只需要对应 focused proof，不要求重跑完整动态矩阵。

## 4. 方案合理性与同根扫描

当前 owner 与 adapter 分工成立：base owner 固定目标、持久任务和失败身份；adapter 返回平台事实；builder 用既有文件/摘要路径；runner 扩展既有 run-owned cleanup；compatibility Journey 复用既有 install。四项修复没有引入第二任务账本、新依赖、通用恢复框架或恶意归档专项。

同根扫描涵盖 FULL-only 成功、FULL→HOT 续接、HOT 成功、直接 apply 失败、准备失败、FULL/HOT readback 失败、同 boot 与继任 boot。直接 apply 失败在 actor `:299`～`:335` 保留原 task boot，而 reconcile 的 `:460` 会擦掉它；S-1 是同一生命周期事实的两个消费者不一致，最小修复应落在消费处。工件侧检查 INSTALL/FULL/minimum-FULL 的完整 APK 消费、两 App 清理条目及外部 FULL3 输入，没有新增源码支持的阻断。

## 5. 证据限制

作者 intake 和实施计划 §11.9 记录了 owner typecheck/31 tests、builder self-test/2 tests、runner 38 tests/typecheck 等局部 PASS。本文仅把它们作为作者声明与范围说明，没有索取或核对运行产物，不给出独立运行 PASS。

本轮测试、构建和运行均 NOT_RUN。真实 PackageInstaller、安装/重启、Android/Kotlin、Expo Web、DEV、完整 verify 和完整设备矩阵均未由本轮验证；这些不构成本次 finding 或准入前置。没有阶段 B/C、reset/seed、L2、UAT、部署授权。差量 verdict 不等于阶段 A 整批交付 verdict。

## 6. 审阅字节

| 文件 | SHA-256 |
| --- | --- |
| 正式需求 | `f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22` |
| 阶段 A 详设 | `8b8b98b64714fa989434f77b01a389ec31d2e9e9e53e609331e5a00f108576f3` |
| 阶段 A 计划 | `c87e1190a545464eeebac7786de9e1282f1c9ea1f082bf45e4e844e4a72cc082` |
| terminalUpdateActor.ts | `08f13096e198a3197b772287840610cc310db88049183a101dc15c7672e501ac` |
| terminalUpdate.test.ts | `9350c991fb14500c40642869fb72b8fead132881f8c55e981f12ebd168cbf1e4` |
| terminal-update-artifact.mjs | `5f1cdec689f32e07919947b52bdcd92846498fd4f7b0df81fac55f6e65638841` |
| terminal-update-artifact.test.mjs | `8d1e65be012b9202630474cf897659f8eb6d7dc42b52a54a41afc23539deb45a` |
| runner.ts | `1d1f60a2480224ebeaf12a30af5ed60c457d9eea52e584bce44cc675881e041e` |
| runner.test.ts | `8b90b1d67e705b10197a333142fa6f08801e03f289653f1af4c9a80a45d1383f` |
| update.android.test.ts | `89067d7466916dc9b929d9c6bd5d361002b61e80884b3d569b9a6e6c1d020ed5` |
