# TER 版本更新阶段 A · S-1～S-4 修复差量独立静态复评

- 日期：2026-10-09。
- **结论：NO-GO，M/S/N=0/4/0。只适用于本次修复差量及直接同根路径，不是阶段 A 整批 verdict。**
- 会话为续接的 Claude 外部复评，不宣称作者会话 fresh。两位 fresh 只读子 agent 分别检查 owner/boot 与 FULL 产物/清理；主 agent 重开源码、复核反例、去重并独立形成本结论。先读原始需求、当前详设和源码，再对照旧报告及 intake；不继承作者分类或此前 GO。
- 使用本仓 cs-review。无测试、编译、构建、生成、verify、DEV、设备或数据操作；未读取 `.runtime/` 或运行 evidence。唯一写入是本评审文件。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=0/4/0
L1_ENGINEERING=findings：四个有普通源码反例的成功/产物/清理缺口
L2_USER_VISIBLE=findings：FULL-only 完成后的后继任务被阻止；外部安装场景输入错误。本轮未评 UI 渲染与动态可用性
L3_UNVERIFIED=空（本轮不核验 UI；native/运行未验证项单列 §6，不以缺少运行 evidence 判定失败）
SAME_ROOT_SCAN=见 §4；两 App 共用路径、全部生产 unzip 字节消费者、同 action 的两个成功出口、现有清理集合已核对
DESIGN_GAPS=无新增；旧 DG-1 的普通 boot 确认判据已补入当前详设
TEMPLATE_COVERAGE=NOT_APPLICABLE：当前 IMPLEMENTATION 差量，不是设计模板复评
EVIDENCE_TIER=READ_ONLY_STATIC_SOURCE_DELTA
```

## 1. 原四项修复的直接关闭情况

下表的 CLOSED 只关闭原报告的准确反例，不代表同族代码无其他问题。

| 原 finding | 当前判断 | 当前源码及测试依据 |
| --- | --- | --- |
| S-1：把 selected HOT 当 FULL 身份 | CLOSED | `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:106–113` 用 `facts.embedded` 的 application/native/runtime/publication；HOT 仍用 actual selected 身份 `:117–125`。`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts:1024–1078` 覆盖同 APK 已运行 HOT 后继续 HOT。 |
| S-2：FULL UNKNOWN/等待后丢固定 HOT | CLOSED（FULL＋HOT 出口） | `apps/terminal/kernel/base/terminal-update/src/types/terminalUpdate.ts:40–42` 保存 actionKind；actor `:379–390` 核对 task/action/kind 对应的 publication，`:399–423` 依据固定 actionKind 续 HOT，不再依赖观察 phase。测试 `:1081–1161` 覆盖 UNKNOWN→同 action 成功及不重复 FULL。另一 FULL-only 成功出口见本轮 D-S-1。 |
| S-3：无 task 普通 HOT boot 不确认 | CLOSED；DG-1 CLOSED | actor `:497–510` 对有 actual facts 且 contentReady 的 PRIMARY-ready 提交 boot 确认，独立于 task 是否存在；`src/application/createTerminalUpdateModule.ts:56–66` 初始化 facts。`TerminalUpdateModule.kt:76–80` 使用调用者 ReactContext，`TerminalUpdateRuntime.kt:51–64,301–309` 保留 context/token/publication/record/APK 身份匹配。owner 测试 `:624–658` 有无 task 普通 HOT boot；native `TerminalUpdateBootPolicyTest.kt:38–58` 有旧 context/APK 反例。详设 §8.7 `:201–205` 明确当前 boot 就绪与任务推进分开。 |
| S-4：FULL ZIP 生成/消费缺失 | PARTIALLY | builder `scripts/build/terminal-update-artifact.mjs:475–520,865–875` 生成单 APK ZIP，并使用同次 INSTALL APK 原字节；preparer `TerminalUpdateArtifactPreparer.kt:57–60,261–294` 校验 ZIP、提取 APK，再走既有 APK 签名/身份链。来源已改用 ZIP。普通大小、失败清理和 compatibility 外部 APK 消费仍有本轮 D-S-2～D-S-4。 |

以上测试均为**测试源码断言已读**，不表示本轮执行通过。按当前详设 §8.1 的单 APK ZIP 形态核验，不增加第二清单包装或恶意归档专项。

## 2. Findings

### D-S-1 · FULL-only 成功读回把 bootId 写为 null，终态任务永久占位

**性质：仓内事实＋普通路径推论；CONFIRMED；S。** 这是 S-2 同一 FULL action 成功消费链的另一个正常出口，属于既存同根缺陷，未声称由本轮新引入。

**判据：**正式需求 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md:162,168`：完成的规则不能永久阻止后继启动选择新规则，同时完成一条规则的同一次启动不能领取第二条。详设 `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:184–187` 区分本 boot 占位与继任 boot 续接。

**源码证据与反例：**

1. 全新 INSTALL 后尚未执行 HOT，native 没有 actionBootId。`apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateRuntime.kt:628` 的唯一赋值属于 HOT；FULL `:684–695` 不写此字段。
2. 合法 FULL-only 安装成功，继任 boot 读回实际目标 APK；native `:371–377` 返回 succeeded，但 action.bootId 为 null。
3. owner 的配对 HOT 分支 `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:399` 不适用于 FULL-only；一般终态 `:449–456` 把 null 写入 task.bootId。
4. 当前 PRIMARY-ready 与后继普通冷启动的 reconcile，均受 `:356–359` 的非 null 条件限制，不能释放该 succeeded task。task 持久化于 `src/features/slices/terminalUpdate.ts:43`。
5. 后续同上下文 accept 在 `:571–589` 返回 already-fixed，尚未读取新目标 provider；更换上下文则拒绝 IDENTITY_CONFLICT。

**影响：**普通 FULL-only 成功后，后续更新规则被永久阻止；无需坏包、竞态或异常安装输入。现有 FULL-only 降级拒绝测试 `test/terminalUpdate.test.ts:1613–1655` 不是这个成功生命周期的断言。

**最小可验收修正：**一般终态保存本次权威 readFacts 的实际 boot 身份，保持完成启动的占位；实际 boot 不可取得时保持 UNKNOWN。不能直接使用安装前 bootId，否则第二次 reconcile 可能在同 boot 提前释放。扩展既有 owner 测试：FULL-only action.bootId=null → 成功 boot 保持占位 → 下一 boot 释放 → 新目标可以接受。无需第二账本或自动重试机制。

**Dexter 产品裁决：不需要。**

### D-S-2 · 合法 FULL APK 的校验被 32 MiB 子进程输出上限拒绝

**性质：仓内事实＋已核实 API 语义下的反例；CONFIRMED；S。**

**判据：**详设 §8.8 `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:249` 的 ZIP 预算为 256 MiB；native `apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateArtifactPreparer.kt:28,272` 接受该范围内的 APK。当前无批准的 32 MiB APK 上限。

**源码证据：**`scripts/build/terminal-update-artifact.mjs:99` 的 runBytes 固定 maxBuffer=32 MiB；新增 FULL ZIP 校验 `:503` 将整个 APK 从 unzip stdout 读入；HOT 最小 FULL 校验 `:909` 同样整 APK 读入。`result.error` 在 `:100–105` 转为构建失败。

**普通反例：**有效 APK 33 MiB、其 ZIP 及内容均在声明预算内，仍被这两个调用拒绝。self-test `:525` 的 5 MiB 正例及 `scripts/test/terminal-update-artifact.test.mjs:14` 的对应 marker 不覆盖 32 MiB 边界。

**官方依据：**仓根 `package.json:6` 声明 Node≥22；[Node v22 官方 spawnSync 文档](https://nodejs.org/download/release/v22.0.0/docs/api/child_process.html#child_processspawnsynccommand-args-options) 明确 maxBuffer 是 stdout/stderr 字节上限，超过则终止子进程并截断输出。本轮没有执行 Node 版本命令，不把 engines 声明当作主 agent 实际运行版本证明；这里没有依赖默认上限，而是源码显式指定了 32 MiB。

**影响：**普通 FULL 不能发布，HOT 对合法最小 FULL 的关联校验也失败；与压缩炸弹等范围外输入无关。

**最小可验收修正：**让 APK 校验读取预算与已声明有效 APK 上界一致，或将 unzip 输出写入本 run 文件后做有界摘要比较。后一方式避免整 APK 内存副本；不需要新库。既有 builder 自测补大于 32 MiB、仍在允许范围内的正常 APK 字节校验，以及真正超过声明上界的拒绝断言。

**Dexter 产品裁决：不需要。**

### D-S-3 · FULL 普通构建失败后遗留 staging APK，runner 仍可报告 cleanup PASS

**性质：仓内事实＋确定失败分支；CONFIRMED；S。**

**判据：**详设 §11a `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:375` 的 update.cleanup；实施计划 CP-05 `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md:216` 的 owned 清理与失败判定。

**源码证据：**builder `scripts/build/terminal-update-artifact.mjs:485–488` 创建 full-staging 并复制 APK；只有所有构建/校验成功后 `:516` 才删除。普通 Gradle 失败或 D-S-2 的输出限额失败会跳过删除。`tools/terminal-automation/src/runner.ts:247–263` 列出 hot-staging、FULL ZIP 等，但没有 full-staging；`:283–291` 仅对列出的目标删除/读回，`:1229–1236` 在该函数返回时记录 generated-artifacts.cleanup.passed。

**影响：**本 run 的完整 APK 副本留存，却被现有清理集合遗漏；business 失败也不能使这个 cleanup PASS 成为真实清理闭包。这不涉及删除既存、非本 run 所有的 node_modules build 目录。

**最小可验收修正：**把两 App 的 full-staging 纳入现有 run-owned 清理集合及读回；也可在 builder 局部 finally 中提前释放，但 runner 仍应覆盖中断留下的自有 staging。沿现有 `tools/terminal-automation/test/runner.test.ts:153–212` 增加含 staging APK 的遗留目录删除断言，不建清理框架、不扩大到未知资源。

**Dexter 产品裁决：不需要。**

### D-S-4 · compatibility 外部 FULL3 步骤实际安装原 INSTALL APK

**性质：测试/runner 源码事实＋普通场景推论；CONFIRMED；S。不是缺少设备 evidence。**

**判据：**详设 §11a `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md:367` 的 update.compatibility 要求外部更高 APK 安装后切换到其 embedded 身份。

**源码证据：**

- `tools/terminal-automation/journeys/update.android.test.ts:629–664` 的 snapshotCompatibilityArtifact 现在只复制 ZIP/descriptor，APK path 保持 `<app>.apk`。
- `scripts/build/terminal-update-artifact.mjs:848–862` 的 FULL2/FULL3 fixture 分支把新 builtApk 封进 ZIP，没有覆盖 INSTALL 的 `<app>.apk`。Journey `:861` 先生成 INSTALL，`:874–885` 再分别 snapshot FULL2、FULL3；两者包含的 APK 和 INSTALL APK 不同。
- 外部 FULL3 步骤 `update.android.test.ts:1993–2000` 却将 externalFull.apk.path 直接交给 connection.install，即仍位于输出根的 INSTALL APK；`:2016–2021` 期望的却是 FULL3 的 native/bundle/publication/embedded。

**影响：**这个已实现的场景无法验证其声称的外部 APK 身份复位；它有真实版本断言，会失败，未称其会假绿。两 App 共享该错误输入路径。

**最小可验收修正：**从已 snapshot 的外部 FULL ZIP 取出并校验目标 APK到独立 run-owned 路径，复用既有 connection.install；新路径加入现有清理集合。不要覆盖用于首次安装的 INSTALL APK。相关源码断言应能区分 INSTALL1 和 external FULL3 的实际输入摘要/身份，无需重新运行未受影响的整批动态验收。

**Dexter 产品裁决：不需要。**

## 3. 方案合理性与职责判断

本轮 S-1～S-3 修法保留清晰 owner：业务选择、固定 task/action 与 boot 确认在 kernel/base/terminal-update；下载、签名、系统安装、加载和平台事实在 adapter。两 integration 只转发通用 PRIMARY-ready，未加入更新状态判断。新增 actionKind 是现有固定 action 所需的一项事实，不是第二任务账本。

FULL ZIP 的传输 SHA、内层 APK SHA 与 publicationId 也已分开；builder 默认 FULL 复用同次 INSTALL 的 APK 原字节，native extractFull 后复用原校验/安装路径。无需更换更新方案。四项 finding 均可用当前函数、字段、文件清理和测试 fixture 作小修；不提出通用恢复框架、离线更新平台或恶意归档专项。

## 4. 同根扫描与防再犯

| 问题族 | 本批全集与其余成员判定 | 可复用最小解/反例边界 |
| --- | --- | --- |
| FULL 成功后的身份消费 | 配对 FULL＋HOT、FULL-only 两个成功出口均已核对。前者通过 actionKind/publication 续接，后者 D-S-1；accepted/unknown 不误作成功。两个 App 共用 owner，无第二实现。 | 技术 action 的 nullable 观察字段不能覆盖 owner 必需生命周期身份；同时验证同 boot 占位和次 boot 释放。 |
| 二进制工具输出预算 | 四个生产 unzip 字节消费者 `builder:454,503,909,939` 已核对；两个整 APK 消费有 D-S-2，其余两个仍受同 helper 限额。另一个 `:525` 是自测。没有要求所有二进制输出无界。 | 按实际消费对象匹配现有声明上界，拒绝真正超预算，不把诊断 stdout 预算当有效工件预算。 |
| 新增 FULL 文件清理 | 两 App 的 full-staging、FULL ZIP、descriptor、compatibility ZIP 及既有 hot-staging 均已核对；清理列表中其他项已登记，full-staging 未登记。 | 新建大文件同时纳入已有 owned cleanup/readback；正常尾删不能代替失败/中断清理。 |
| ZIP 改造后的 APK 消费 | 首次 INSTALL `journey:961` 的直接 APK 输入正确；正式 FULL provider/prepare 使用 ZIP；external FULL `:2000` 未跟随 snapshot 变化。其余这些消费点已核对。 | 封装改变后区分传输物、内层内容和固定 publication；不得靠相同 basename 偷换实例。 |

四类失败模式及反例记录在本 checklist；未来修复落入既有真实 focused 测试，不增加门台账、恢复中心或 per-edit 关卡。两位子 agent 全程只读；文件写入仅由主 agent 完成本报告。

## 5. 未采用的额外疑点与 DESIGN_GAPS

- `confirmBoot` 失败后 actor `:476` 调用 reconcile(true)、native selectedFacts `:262–290` 使用全局 record，已沿当前消费者核对；没有建立本轮普通路径的额外错误提交反例，不凭理论竞态增加 finding。
- 旧 DG-1 已在当前详设 §8.7 明确普通 boot 确认与 task 推进分离，不再重复计为设计缺口。
- 四项均有现成需求/详设判据，**DESIGN_GAPS=无新增**。
- 恶意 ZIP entry、symlink、截断目录、压缩炸弹不在本轮；不要求对应库、专用 seam、测试或 evidence。

## 6. 证据边界

| 档位 | 当前结论 |
| --- | --- |
| 本轮静态核验 | 已读取当前生产代码、测试/Journey 断言、生成/清理脚本；上述反例为源码支持的判断。 |
| 作者所述 TS/typecheck/builder/artifact/runner 局部 PASS | 仅按用户及 intake 声明记录；本轮未重跑、未核验 run/source 绑定，不作为独立运行证明。 |
| Kotlin focused proof | **OPEN / NOT_RUN**。按用户交接：资源门发现四个既存非本 run 所有的 Android build 目录，Gradle 未启动，Kotlin 测试未运行。此情况不计 finding，不要求越权删目录或绕过资源门。 |
| 完整动态/设备/DEV/reset/seed/L2/UAT/部署及 B/C | 本轮未执行、不复核；不要求重复未受影响的全量运行，不由差量 verdict 推导整批交付。 |
| UI 看图/可见行为、真实安装、真实 cleanup | 本轮未验证；本次 source-only 差量不发 UI 可用性结论。 |

## 7. 被审字节

| 文件 | SHA-256 |
| --- | --- |
| 正式需求 | f4ae511b8691710f772f191f073bba6c3939f1afc533933b583eee0495983c22 |
| 阶段 A 详设 | 78b2245225525811cdf2724b32d268e1916bc1706a1aceafb7739d11eb1db1ec |
| 阶段 A 计划 | f10fda30fa164e071ce1da4a70f16326296955e8c582a9fddb68edccaa49b254 |
| terminalUpdateActor.ts | bf5484db1cf3ead8a7f45113fe7b57b4ec0ddd45e2681961b062fff900f4b7f0 |
| types/terminalUpdate.ts | 19393e6cecdf555b92346db83a2c3f9bbbcc07e8d483c658d1c5d7e02f279cc1 |
| terminalUpdate.test.ts | 1d0cc2b62d38e1661e2c986f301f94ba3f76fa3b3ab1d2ad8e046e199962efb9 |
| TerminalUpdateArtifactPreparer.kt | 545e01100eb7ede8019eca71d1d72a7ca69d397f1a111aea7f3fbb1e1654d362 |
| TerminalUpdateRuntime.kt | d6903e96b21f5355c65c61f353e57d26cfdc27333b499d796218df478d422cfb |
| TerminalUpdateModule.kt | acfb4bfee22346382f9e73bfdd25e24138a4f35e839e3a0b11817849e2f6ea6b |
| terminal-update-artifact.mjs | c570327881fea9f323bbeefc0ec6bbcabf0fa0d19202aa79ff32137d55e620e6 |
| terminal-update-artifact.test.mjs | d7d7ac8c7f78978eb628e9eca4156877d1f819adb375103cb2e31db124a51d54 |
| terminal-automation/src/runner.ts | 6f4f47d7b977e98ddb3aab084e87e9c8143aed92dc3f66e2d1b3eece9cb1fc8c |
| terminal-automation/test/runner.test.ts | b22492bc93d5ebcfc7a2522a7d791136783c657649b63de297c25c0ce6e502a5 |
| terminal-automation/journeys/update.android.test.ts | 07e8ea1271bf56def69152d64028cbfaba63a4787087b3c13411067deeb6a8da |

不重开内部 DESIGN cycle。本报告不授权源码修复或任何运行；主 agent 后续按既有授权对 findings 做辩证 intake，只修确认项，并按受影响 focused 范围验证。
