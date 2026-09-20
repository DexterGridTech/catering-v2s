# TER terminal admin login 主题化视觉实施计划

```text
PLAN_STATUS=IMPLEMENTED_REVIEW_PENDING
DESIGN=doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-design-codex.md
IA=doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-ia-design-codex.md
IMPLEMENTATION_AUTHORITY=DEXTER_GRANTED_2026-09-19
FOCUSED_EXECUTION=COMPLETED
WEB_METRO_ANDROID_DEVICE_ACTIONS=NOT_RUN
```

本计划定义本批获得授权后的最小落地顺序；本轮已按该顺序修改源码/测试/主题文档并执行 focused、typecheck
与既有 terminal static。未执行 Web、Metro、Android、设备、DEV、seed、UAT 或部署命令。

## 1. 范围与不变量

本批只改 shared admin login 的视觉承接：六格方形 PIN、`*` 遮罩、主题语义 token、card 层级和相应
focused/static 覆盖。两个 integration 继续共享同一 `ui.base.admin-shell`，但各自提供 theme 值。

不变量：

1. `ui.base.input` 仍是唯一 password string、focus scope 和 virtual keyboard owner；
2. `ui.base.admin-shell` 仍是 AdminLogin 结构、文案、认证状态、关闭行为与 testID owner；
3. `ui.base.primitives` 只提供无业务词汇的展示 primitive/token；
4. 两个 integration 只拥有自己的 CSS var/Tailwind semantic mapping；
5. 两个 Android assembly 只加载自己的 integration theme，代码不改；
6. `console-assembly` 的 admin parts、catalog、AdminLauncher 和 layer 装配不改；
7. 业务画布、壁纸、会员、拓扑和已认证 admin section 不改。

## 2. 串行 CP

### CP-0：关系、分母与来源复核

主 agent 在动笔前逐项重开：

- `AdminLogin.tsx`、`AdminLayer.tsx`、`consoleAssembly.tsx`；
- 两个 integration `assembly.tsx`、`theme/global.css`、`tailwind.config.cjs`、`test-expo/App.tsx`；
- 两个 Android `App.tsx` 与 `metro.config.js`；
- `ui/base/input` 的 `useInputField`/keyboard owner；
- Journey、既有 IA/interaction、TR-13、project memory shared-admin invariant；
- 详设 §6 的完整改动/不改分母。

失败条件：发现需要改 assembly/android、console-assembly、业务 feature、keyboard owner 或认证算法；
此时停在 CP-0，不用 UI 样式掩盖 owner 偏差。

收口：包关系 `MATCHED`，改动分母只有详设 §6；本轮已获 implementation authorization，进入 CP-1。

### CP-1：primitives 公共面与通用视觉 recipe

实施落点：

1. 在 `ui/base/primitives` 新增 `PrimitivePinInput` 与 `PrimitivePinInputProps`；不要改写现有
   `PrimitiveCodeInput` 的真实 TextInput 语义。
2. 增加 `surface-elevated`、`surface-inset`、`focus` semantic token 使用的 base recipes，并给
   `PrimitiveContainer` 增加可选 `elevated` prop；只有 AdminLogin 显式传入它，默认旧 card 行为不变。
3. 同步 `src/index.ts`、`terminal-invariants.json`、README 与 owned primitive test。
4. 测试真实 React Native render tree：六格、1:1 square、`*`、focused/invalid/disabled、真实 Pressable
   与 owner 事件透传；不只查字符串存在。无障碍不是本批验收维度。

红夹具：`maskCharacter='•'`、删 `aspectRatio`、把 root 改为非 Pressable、删除 `onTouchEnd`/`onClick`
   透传、把 primitive 内部加 local state/keyboard controller；每个错误形状都要有对应 focused/static 失败。

CP-1 完成后，必须先做步骤级三维对账；fresh reviewer 只读核对需求/详设/IA、terminal coding standard
与 project memory、当前 public surface。对账不是测试替代品；有 OPEN 不进入 CP-2。

### CP-2：两个 integration 的 theme 语义映射

实施落点：

- `sample-console` 与 `sample-wallpaper-console` 各自补三个 CSS var 和 Tailwind color mapping；
- 既有 `action`/`error-*` 等主题值保持原语义；sample-console 与 wallpaper 可以有不同 `focus`/`surface-inset`；
- theme tests 从“19 个 exact tokens”更新为包含新 token 的完整集合，并断言两个 integration 均有 mapping；
- 可读差异不以“两个 token 不相等”作为机器证明；本批 focused/static 不冻结统一色差或对比度阈值，最终
  由后续 visual/Claude review 观察并保持 OPEN；
- 不把 RGB 值移到 primitives 或 admin-shell，不新建共享 theme 包。
- `layout="card"` 的其余 production consumers 不传 `elevated`；实施验证必须确认它们的 render/style
  输出保持既有 recipe，不允许通过就地升级默认 card 来实现登录卡。

红夹具：删除任一 integration 的 `focus` mapping；让 wallpaper theme 偷用 sample-console 的固定 focus 值；
theme test/static review 必须能发现。

CP-2 完成后同样执行步骤级三维对账，确认 Web `test-expo` 与 Android Metro/App 的入口仍分别加载各自 theme，
但不启动它们。

### CP-3：AdminLogin 视觉接线

实施落点：

1. `AdminLogin` 删除手工 `Pressable` + `PrimitiveGrid` + `PrimitiveText` cell；改用 `PrimitivePinInput`。
2. 把既有 `field.inputProps.value`、`field.focus()`、`keyboardState.activeFieldId`、error 状态和既有
   password testID 传入/保留，不增加第二份 password state。
3. 已填格只显示 `*`，空格不显示 `○`；验证、关闭、错误、时钟不可用、身份降级和 debug password 文案保持原行为。
4. card 只使用 primitive 的 layout/elevated recipe；AdminLogin 不 import integration、theme 或 RN 绘制节点。
5. 不改 `keyboardPlacement='surface'`，不在 login 内嵌 keyboard，不加手动 keyboard lift。
6. `PrimitivePinInput` 的 root 接收并转交 owner 的 surface-dismiss 守卫：native 走 `onTouchEnd`，browser
   走 `onClick`；删除任一必要入口，点击 PIN 区的 active field/keyboard focused proof 必须变红。该守卫仍由
   `AdminLogin` 提供，primitive 不依赖 `ui.base.input`。

验证：新增/更新 admin-shell focused render test，并保留 sample-console 真实 assembly 测试的 existing auth/focus/
debug-password 覆盖；新增 PIN root 触摸/点击后 field 不被 surface dismiss 的 focused 断言；必要时为 wallpaper
assembly 增加同一 shared login render readback，但不复制实现。

红夹具：用第二个 local password state、删掉 pin root 的 focus callback、删除 native/browser 任一事件透传、把
`•` 或 `○` 恢复、把 close/auth 回调移出既有 layer；focused test 或 source readback 必须红。

CP-3 完成后做步骤级三维对账；对账项必须包含可见文案、动作、焦点、失败/恢复、testID、theme owner、
input owner 和“背景业务画布未改”。

### CP-4：全批验证与交付对账

所有 CP 完成后、任何整体测试之前，fresh 只读 reviewer 进行全批三维对账；之后主 agent 逐代码与详设
逐行对账。两种对账都只允许 `MATCHED` 或 `OPEN`，任一 OPEN 的交付语句必须是“实施未就绪”。

授权后的最低验证清单：

```text
yarn --cwd apps/terminal/ui/base/primitives typecheck
yarn --cwd apps/terminal/ui/base/primitives test
yarn --cwd apps/terminal/ui/base/admin-shell typecheck
yarn --cwd apps/terminal/ui/base/admin-shell test
yarn --cwd apps/terminal/ui/integration/sample-console typecheck
yarn --cwd apps/terminal/ui/integration/sample-console test
yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console typecheck
yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test
yarn --cwd apps/terminal verify:static
```

本轮已执行上述命令；结果与 first failure/last known good/broken boundary 记录在 implementation handoff。
后续若重跑，每条命令都要保留原始输出，失败按 owning source 最小修复后 focused 重验。不要用 Web/Android 运行观察替代
primitive/theme/login 的 focused proof，也不要把静态或 focused 结果称为 visual PASS。

## 3. 文件对账表

| 计划步骤 | 详设落点 | 计划改动 | 不在范围的相邻文件 |
| --- | --- | --- | --- |
| CP-0 | 详设 §0、§6.2 | 只读核对 owner 与分母 | 两个 Android App/Metro、console assembly、business feature |
| CP-1 | 详设 §2.4、§6.1、§7 | primitives types/component/token/index/invariants/README/test | input controller、console assembly |
| CP-2 | 详设 §2.3、§6.1、§7 | 两个 integration CSS/Tailwind/theme tests | integration assembly/feature/业务背景 |
| CP-3 | 详设 §2.1–§2.2、§5、§6.1、§7 | AdminLogin 与 admin-shell focused test；sample-console existing expectation | AdminLayer 行为、认证算法、virtual keyboard |
| CP-4 | 详设 §8、§9、§10 | 证据、对账、review handoff | Web/Metro/Android/device runtime |

## 4. 防止再次发生的 failure family

| 已识别失败模式 | 根因 | 本批预防目的地 |
| --- | --- | --- |
| shared base 写死 integration 颜色 | 忽略 theme owner 与 package graph | 详设 §0.3/§2.3、两个 theme test、Claude review checklist |
| 业务组件手搓 PIN cell | primitive 分母未覆盖新组合控件 | `PrimitivePinInput` focused test、primitives README/public surface |
| 只换外观却新增第二 input owner | 把视觉 cell 当真实输入 | 详设 §2.4/§5、AdminLogin focused test、source readback |
| 只验证一个 integration | 用 sample-console 代表所有主题 | 两个 integration 的完整 theme token test 与逐包对账 |
| 把背景业务画面混进 login wireframe | surface owner 不清 | IA §2.3、详设 §6.2 scope guard、review handoff |

## 5. 交付状态

```text
DESIGN_DOCUMENT=READY_FOR_DEXTER_CLAUDE_REVIEW
IMPLEMENTATION=CODE_AND_FOCUSED_EXECUTION_COMPLETE_REVIEW_PENDING
RUNTIME=FOCUSED_ONLY
WEB=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
VISUAL_ACCEPTANCE=USER_DIRECTION_ACCEPTED; implementation evidence OPEN
CODE_DESIGN_RECONCILIATION=AUTHOR_READBACK_MATCHED;INDEPENDENT_REVIEW_OPEN
```
