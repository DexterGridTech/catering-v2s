# TER automation-agent 再次修订设计包 · 外部第二次差量静态复核

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
reviewerKind=EXTERNAL_CLAUDE_STATIC_DESIGN_RECHECK
PRIOR=doc/review/platform/2026-10-05-ter-automation-agent-design-recheck-claude.md（NO-GO 0M/3S/4N，详设 3fde4d1c…）
SESSION_PROVENANCE=续接会话（v2s 仓根），非 fresh；本会话起草了正式需求、写了前两轮评审，S-B 的“专用槽位”原建议也出自本会话
NOT_A_SUBSTITUTE_FOR=内部 fresh 独立子 agent DESIGN 审查（intake 记录有效内部轮次仍为 0）
AUTHORIZATION=仅静态复核设计包；不授权任何修改、安装、生成、编译、构建、测试、verify、DEV、Web/设备、reset/seed、L2、UAT 或部署
```

## 0 · 亲验哈希

本轮重新计算 SHA-256，与请求及 intake 一致：

| 文件 | 前 16 位 |
|---|---|
| 需求 | `37fe9363e79b6db3`（未变） |
| 详设 | `12b995c8e888bf39` |
| 计划 | `8eb041e05b8f4e9e` |
| 附件 | `fb48983b92d9c14f` |
| skill 草案 | `3c200f7df972519d` |
| Journey | `18be1f5d97a5289c` |
| IA | `be8fa1bd07bc233a`（未变） |
| UI 交互 | `08c994c9f8aa6e4a`（未变） |

附件所记三个外部源的哈希也已复算一致：

- seed 契约 `105bd6c17e35…`
- `r5-dev-runner.mjs` `9c1dbca1fb83…`
- `r5-dev-runner.d.mts` `176cc0462882…`

源码与 seed 事实读自当前工作区字节。runtime、TDC 仍处于 Codex 在途改动中。intake 只作为待核输入，在形成判断之后才对照。

## 1 · 结论

```text
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/4
L1_ENGINEERING=PASS（静态）；4 项 N 均为补充说明，不阻断
L2_USER_VISIBLE=PASS（文档层）：admin 两行 valueTestID 挂实际 value 文本，UI/IA/详设一致；本轮差量未改 UI
L3_UNVERIFIED=见 §5（含 admin 两行线框 UNSET）
SAME_ROOT_SCAN=见各 finding
DESIGN_GAPS=沿用：verification-governance.md 未定义 M/S/N
TEMPLATE_COVERAGE=差量涉及的模板节（详设 §4.4、§4.5、§9a、§9a.1、§9a.2、§10b.3/10b.4/10b.6、§11a V-14/V-17/V-18；Journey §3）均在；其余节同首轮报告 §5
EVIDENCE_TIER=静态文档 + 当前源码 + seed 契约 + 资源门脚本读取；无任何运行
```

已知阻断全部关闭，只剩未验证项，按 review standard 给出 GO_WITH_UNVERIFIED_UI。

**授权边界。** 本结论只表示这份设计包在静态层面可以进入后续步骤。它不授权实施，也不替代内部 fresh DESIGN 审查：按 CLAUDE.md 与独立审查治理，内部审查仍需完成，或由 Dexter 决定如何处理工具容量问题。它也不替代 Dexter 对两行线框的看图确认。

## 2 · 七项关闭表

| 原项 | 判定 | 独立核验依据（当前行号） |
|---|---|---|
| S-A 原生节点字面量 | CLOSED | 详设 L185-186：全部 TER 生产 TSX 的每个 `testID`/`testId` 属性都在该处做 checker 定点类型查询，不按标签豁免；`TestId \| undefined` 也不能绕过。红夹具分开设置：品牌 props 的“编译失败”与 `<View testID="x">` 的“属性门红”分列，后者明确写“不能误称为 RN 编译失败”；品牌值传给直接 View 的绿例须通过。附件 `testIdPointTypeControl` 列出 55 个节点、12 个文件，与我上一轮的计数一致。没有引入跨组件流分析。计划 L136、skill L65、V-14（L359）三处同步 |
| S-B 按 seed key 共享 | CLOSED | 详设 L316、L321，计划 L117，Journey L30-31，附件 `activationFixtureSource`：dual=`term-front`、mobile=`term-handheld`，两者都属于 store-operating；seed 契约中两条均为 ENABLED，deviceType 分别为 laptop、mobile，已复核。激活码只从契约读入内存；manifest 只记 seedKey、terminalRef、storeRef、本机 deviceId、generation、DEV 身份、契约 hash；不与 TDC 并行；REQUIRE_INACTIVE 与“只回收本 driver 身份”的规则保持一致 |
| S-C 前提倒置 | CLOSED | 计划 L61（CP-01 第 5 步）：首次动态前完成资源准入、新运行根与 kind、DEV 侧 profile 及红例、health/format 首批登记。计划 L114 与附件 phaseDisposition：顾客 fixture 在 CP-04 首次顾客输入前迁移。计划 L150（CP-06 第 3 步）只做最终删除。详设 §9a.1 表与 §9a.2 首段一致 |
| N-a DEV readback 跨 owner | CLOSED | 详设 §9a 第 L250 行与 L323、附件 `managedBindingReadbackExtension`，覆盖四项：SQL projection、parse 的形状/唯一性/身份校验、`.d.mts` 两函数声明、parser 红例。`bound_device_id` 只在内存比对，落盘只写匹配结果。未来实施授权须单独点名，本轮状态为 `FUTURE_CROSS_OWNER_NOT_AUTHORIZED_THIS_ROUND` |
| N-b skill 请求关联与激活前提 | CLOSED | skill L46-63、详设 L174、L324：`requests.observeUiAction` 是 driver 内唯一的薄封装，只包装传入的真实动作，不发业务 command、不复制账本；`fixtures.ensureActivated({shape})` 只在显式调用时执行，不在纯连接 proof 中隐式激活。两者复用已登记 selector 与既有账本，没有第二条业务通路 |
| N-c 字段名 | CLOSED | 详设 L174、skill L46 改为 `activation.status` / `currentPeerValue`；非 MASTER 且投影不可用时返回 null，属于合法 JSON。与 `selectActivationStatusView.ts:20-33` 一致 |
| N-1 需求开始时间 | PARTIALLY（接受） | 需求正本未改，本轮无授权；详设 L15 已登记来源 |

## 3 · 方案合理性

这一轮的修订都是收敛，没有新增机制：

- **S-A**：testID 门仍是“品牌类型 + 窄 AST 门”。新增的是单点类型查询，不是流分析，成本低。
- **S-B**：回到仓内既有的做法，与旧 runner 一样按 seed key 共享终端、读回绑定状态。不需要新数据，也不需要 reset/seed。
- **S-C**：只调整执行顺序。
- **N-b**：两个 helper 都是薄封装，消费的是已登记 selector 和 Runtime 账本，没有绕过 owner。

我另外构造了一个替代方案：让 agent 在节点 press 事件里直接返回 requestId，以此关联真实点击产生的 request。这需要把 UI 内部的 `dispatchWithRequestId` 暴露给接缝，等于让 primitives 感知 command，破坏零依赖接缝。现方案（订阅加基线差集）更符合 owner 边界。

代价与当前阶段相配。UI 与操作路径在这几轮修订中都没有变化，产品层面无歧义需要裁决。

## 4 · Findings（均为 N，不阻断）

### N-d 正常结束时如何释放共享 seed 终端没有写明

- **位置**：详设 L323（只写了“上次 driver 崩溃留下 ACTIVE”时的回收）、V-17（L362，cleanup 列只写“fixture 业务 cleanup”）、计划 CP-04。
- **事实**：W dual 与 D dual 先后共用 `term-front`，W mobile 与 M 先后共用 `term-handheld`。TDC 有终端侧 owner command `cancel-terminal-activation`（`terminalDataClientCommands.ts:30-36`，public，actor 调用 `cancelTerminalActivation`，见 `terminalDataClientActor.ts:1259-1266`）。
- **推论**：如果正常结束不释放，下一个执行面每次都要走“跨 run 回收”。现行文字只说“崩溃”，实现者可能不把它用于正常路径；也可能每次都要在多个旧 manifest 中查找。
- **最小修正**：在 §10b.4 与 V-17 cleanup 中写明：业务结束后，经 TDC `cancel-terminal-activation` 释放本 run 的绑定，并以受管 readback 确认为 INACTIVE；该结果作为 cleanup 单列。现有“manifest 加 deviceId 回收”改写为“任一先前本 driver run 遗留 ACTIVE 时的兜底”。
- **需 Dexter 裁决**：否。

### N-e 属性定点门未覆盖 JSX spread

- **位置**：详设 L186。
- **推论**：形如 `<View {...p}>` 的写法，若 `p` 是带 `testID: 'x'` 的 `ViewProps`，就能绕过按属性逐个检查的门。当前生产代码中是否存在这种写法未逐个核对，属 UNVERIFIED。
- **最小修正**：对同一门的 `JsxSpreadAttribute` 做同样的单点检查：若其类型包含 `testID`/`testId` 属性，则该属性类型必须可赋给 `TestId | undefined`。仍是单点类型查询，不做流分析。红夹具补一例。
- **需 Dexter 裁决**：否。

### N-f 资源门脚本的改动同样属于跨 owner 机制变更，未来授权应单独点名

- **位置**：详设 L279、L293；计划 L61。
- **事实**：`scripts/env/check-runtime-resource-budget` 中，`admin-validation-with-ter` 目前只按目录前缀豁免（L21-25 与路径遍历逻辑）。详设要求新根按“根 + 精确 kind + PID/startToken”豁免，这相当于给 DEV 侧共享门新增 kind 判定，并要同步更新该脚本的 `--self-test`。
- **最小修正**：像 N-a 一样，在 §9a 写明这是共享门的逻辑变更，列出新增与改写的 self-test 红例；起草实施授权话术时与 DEV readback 一并点名。
- **需 Dexter 裁决**：实施授权时确认。

### N-1（carried）需求 D-1 开始时间

保持 PARTIALLY，待下次获得需求修改授权时同步。

## 5 · 已亲验事实（本轮）

- seed 契约中 `term-front`（store-operating、laptop、ENABLED）与 `term-handheld`（store-operating、mobile、ENABLED）存在，均有 8 位激活码，本文不复述值。
- TDC `cancel-terminal-activation` 存在，可见性为 public。
- 资源门在 `live>0` 时失败（L101）；`ter-validation-with-dev` 只放行精确的 r5 manifest 与 kind；DEV 侧 profile 当前仅按前缀放行。
- 当前带 `testID?` 的可选声明只有 4 处（`AuthGuide.tsx:8`、`InputProvider.tsx:34`、`nativeSlots.tsx:187`、`types.ts:416`），所以“`TestId | undefined` 不能绕过”的严格写法改动面很小。
- 附件新增的 `testIdPointTypeControl`、`activationFixtureSource`、`managedBindingReadbackExtension` 三节都标为 DESIGN_ONLY/NOT_RUN 或未授权，没有冒充当前 PASS。

## 6 · OPEN / NOT_RUN（L3_UNVERIFIED）

1. admin 两行线框 UNSET，等 Dexter 看图。
2. 以下实现均未开始：
   - 共享 operationsFixture 抽取；
   - readback 新增两列；
   - 资源门 kind 判定；
   - 品牌类型与属性门；
   - `observeUiAction`、`ensureActivated`。
3. DEV 上 `term-front` 与 `term-handheld` 当前是否为 INACTIVE 未知，运行时才会读回。
4. Fabric 与副屏 Presentation 的坐标、双屏 VM 是否可用、断线重连、迟到结果、F-4a/F-4b 性能与包体，均 NOT_RUN。
5. 新依赖未安装或解析；RN 0.86 官方性能页在本会话中无法抓取，仍为 UNVERIFIED。
6. V-01～V-20 全部 NOT_RUN；内部 fresh DESIGN 审查有效轮次为 0。
