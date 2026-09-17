# 门店经营规则树形展示与编辑 · UX 修订详设与实施计划

`STATUS=IMPLEMENTATION_REVIEWED_GO_WITH_UNVERIFIED_UI`
`JOURNEY_REF=doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md#j-sos-01--门店经营规则开关`
`BASE_DESIGN_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-design-codex.md`
`INTERACTION_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-interaction-design-codex.md`
`DEXTER_UX_DIRECTIVE=2026-09-17 当前体验反馈`
`IMPLEMENTATION_AUTHORITY=existing J-SOS-01 implementation scope`
`BROWSER_L2=NOT_AUTHORIZED`
`SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`

## 1. 用户任务与变更边界

用户在门店详情 Drawer 中需要直接理解该门店当前的经营规则；进入编辑 Drawer 后，需要在同一棵树中逐项配置规则，而不是面对一组看起来像不可编辑资料的表单字段。每个规则占一行，父子关系由已有 generated rule catalog 驱动。

本修订只改变 operations-admin 的既有 Store 详情/编辑 UI 形态：不新增页面、路由、权限、HTTP operation、数据库字段、保存按钮或第二份规则声明。Store owner readback、同一 update command、`expectedVersion`、幂等键、`useDrawerFormLifecycle`、失败留稿和父值关闭时保留子值的语义不变。

## 2. 当前源码事实与可复用能力

| 事实 | owning source |
| --- | --- |
| 详情 Drawer 以 owner detail readback 渲染基础资料，当前未渲染经营规则 | `apps/frontend/operations-admin/src/features/store-management/ui/StoreDetailDrawer.tsx` |
| 编辑 Drawer 当前把规则渲染为平面 `Card` 与多个纵向 `Form.Item` | `apps/frontend/operations-admin/src/features/store-management/ui/StoreEditDrawer.tsx` |
| 12 项顺序、label、type、default、parentKey 是唯一生成声明 | `apps/frontend/operations-admin/src/app/api/generated/storeOperatingRuleCatalog.ts` |
| Drawer surface、编辑生命周期和 dirty/submitting 由 foundation 提供 | `libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts`、`libraries/frontend/admin-ui-foundation/src/overlay/overlayLock.tsx` |
| Ant Design `Tree` 支持 `treeData`、`blockNode`、`showLine`、`selectable={false}`、`defaultExpandAll` | antd 6.5.0 `Tree` API |

## 3. 方案冻结

### 3.1 一个共享树组件、两个呈现模式

新增 `apps/frontend/operations-admin/src/features/store-management/ui/StoreOperatingRuleTree.tsx`，由 `StoreDetailDrawer` 与 `StoreEditDrawer` 共同使用：

- `treeData` 由 `STORE_OPERATING_RULE_DEFINITIONS` 的 `displayOrder` 与 `parentKey` 构建；页面不复制树关系、默认值或顺序。
- 两种模式都使用同一棵 `Tree`：`blockNode`、`showLine`、`selectable={false}`、`defaultExpandAll`，每个节点只呈现一行。
- `detail` 模式只渲染业务 label 和值文本，不渲染 `Form`、`Input`、`Switch` 或 disabled 表单控件。BOOLEAN 以“是/否”呈现；父级未生效时保留已配置事实并追加“当前未生效”或“上级未开启”，STRING/NUMBER 同样保留值并追加状态说明。
- `edit` 模式使用专门的树节点行布局承载现有 Switch/InputNumber/Input；不是把纵向 `Form.Item` 随意塞进 `Tree.title`。每一行固定为“层级标签 → 依赖说明 → 右侧控制区”，`Form.Item noStyle` 只负责把右侧真实控件绑定到 `operatingRuleSwitches.<key>`，真实控件继续使用 `storeManagementTestIds.operatingRule(key)`。
- 子项仍显示“请先开启上级功能”，只禁用控件，不清除 Form 值；父项恢复后原值继续可编辑。

树是布局组件，不接管表单提交、脏状态、错误、权限或 owner read。编辑 Drawer 仍由 `useDrawerFormLifecycle` 管理所有关闭路径，详情 Drawer 仍显式 `maskClosable`。

### 3.2 符合树形编辑习惯的节点行

规则组保留“经营规则”标题，但不再把每条规则包成独立 Card。树只承担层级、展开/收起和连接线；节点行承担业务信息与控制，不把整行做成一个容易误触的“大按钮”：

1. **层级可读**：所有节点默认展开；父节点使用 Tree 原生展开箭头和连接线，子项用原生缩进表达归属。点击展开箭头只改变展开状态，点击 label 或右侧控件不会误触发其他节点选择；`selectable={false}`，不制造无意义的选中态。
2. **一行一项**：每行保持固定的垂直对齐，左侧是中文业务 label，中间只在必要时显示“请先开启上级功能”，右侧是统一宽度的 Switch 或 Input。不会把 label 放在控件上方，也不会为一个规则再套一张 Card；12 行可以连续扫读和逐项操作。
3. **控制区符合设置页习惯**：BOOLEAN 行在右侧使用 Switch，STRING/NUMBER 行在右侧使用带明确中文 `aria-label` 的输入控件。控件点击事件与 Tree 节点事件隔离，输入框可连续输入、Switch 可直接切换，不因 Tree 行点击丢焦点。
4. **父子依赖可解释**：父项关闭后，子行仍在原位置显示并保留值；子控件 disabled，同时在同一行给出“请先开启上级功能”，不能只变灰或把子行隐藏。父项重新开启后，子控件在原位置恢复可操作，不清空原值。
5. **键盘和读屏顺序**：可展开节点先按树的标准顺序到达，随后按从上到下、从父到子的 DOM 顺序到达右侧控件；每个控件有对应 label，依赖说明通过 `aria-describedby` 关联。详情态没有表单控件，不让只读用户进入不可操作的假焦点。

详情态和编辑态共用上述节点行的层级与对齐基线，但详情态右侧是值文本/状态标签而不是 disabled 表单；编辑态才使用真实 Form 控件。详情值和编辑控件均有稳定 testId，且不可编辑原因不能只靠颜色传递。

## 4. 最小替代方案比较

| 方案 | 结论 | 原因 |
| --- | --- | --- |
| 继续使用平面 `Form.Item`，只调整间距 | 不采用 | 不能表达父子层级，也继续让详情侧缺少规则事实。 |
| 详情和编辑各自手写一棵树 | 不采用 | 会产生顺序、父子关系和状态文案漂移；违反单一声明驱动。 |
| 新建规则配置页面或嵌套 Drawer | 不采用 | 改变既有 Journey、权限和同一次 CAS 保存边界。 |
| 一个共享 `StoreOperatingRuleTree`，以 mode 区分只读/编辑 | 采用 | 只新增一个业务 UI 组件，复用现有 Tree、catalog、Form、Drawer lifecycle 和 owner read，满足当前两个 surface。 |

## 5. 实施单元

### P1 · 共享规则树与 testId

修改 `storeManagementTestIds.ts`，增加详情规则组、详情树、详情行的稳定 testId；新增 `StoreOperatingRuleTree.tsx`，集中实现树构建、完整默认值、类型化值文本和 detail/edit 两种行渲染。不得在两个 Drawer 内重新实现树关系。

### P2 · 接入既有 Drawers

- `StoreDetailDrawer.tsx`：在基础资料 `Descriptions` 后增加“经营规则”树；数据只取当前 `selected.operatingRuleSwitches`，不使用不可编辑 `Form` 镜像。
- `StoreEditDrawer.tsx`：保留当前 Form、提交 payload、生命周期和失败处理；用同一树的 `edit` 模式替换平面规则字段。

### P3 · focused proof

新增共享树的 focused tests：

- 两根、12 节点、完整父子关系和 generated display order 逐项匹配；
- detail 模式无 `Form.Item`/编辑控件，能显示 BOOLEAN、STRING、NUMBER 和上级未生效语义；
- edit 模式存在 12 个真实规则控件，控件 name/testId 与 generated key 一一对应，节点行 label/依赖说明/控制区保持单行对齐；
- 父 false 不清除子值，父恢复后仍可编辑。

执行 operations-admin 的 focused unit test、architecture test 与 typecheck；不执行 reset、seed、DEV 重启或 browser L2。

## 6. 失败、恢复和不变式

- Store detail read 失败仍由现有详情 Drawer error surface 呈现，规则树不猜默认值。
- 编辑 definition/candidate/read 失败仍保持现有错误文案、保存禁用和输入留存；树不新造第二套错误状态。
- 保存失败不关闭 Drawer、不丢规则输入；保存成功仍以 owner response 回填详情。
- 规则树不改变后端 gate、Store-target read、审计、CAS、幂等和父子存储值保留语义。

## 7. 逐代码与详设对账

这是本修订交付前的硬步骤，执行者为主 Codex agent，范围是 P1-P3 产生或修改的每一行代码、测试和本文件引用的 UI 文案，不抽样。逐项对照本文件 §3、§6、原 Journey J-SOS-01、interaction §3、IA-SOS-01、`storeOperatingRuleCatalog.ts` 与 foundation Drawer/Form 约束；核对行为、形态、层级、值语义、控件、testId、失败/恢复和生命周期。结果只允许 `MATCHED` 或 `OPEN`；存在 OPEN 时报告“实施未就绪”，不得交付 review。

## 8. 授权与证据边界

本修订使用 Dexter 当前请求对既有 J-SOS-01 operations UI 的实施授权；没有扩大到 backend、contract、migration、reset、seed、UAT、deploy 或 browser L2。完成后如声明整批 implementation ready，仍需 fresh 独立 `REVIEW_TARGET=IMPLEMENTATION` review；本文件和 focused/typecheck 结果不能代替该 review。

## 9. 当前字节实施记录

- P1 `MATCHED`：`StoreOperatingRuleTree.tsx` 集中使用 generated catalog 构建双根树、节点行、详情值语义与编辑控件绑定；`storeManagementTestIds.ts` 为树、节点、详情值和编辑控件提供稳定标识。
- P2 `MATCHED`：`StoreDetailDrawer.tsx` 以当前 owner detail readback 的 `operatingRuleSwitches` 渲染只读树；`StoreEditDrawer.tsx` 复用同一树的 `edit` 模式，保留原 Form、提交 payload、CAS、幂等键、失败留稿和生命周期。
- P3 `MATCHED`：`StoreOperatingRuleTree.test.tsx` 覆盖两根/12 节点/父子顺序、默认值补齐、失效后代的配置事实、详情无编辑控件、编辑逐项真实控件与依赖说明；operations-admin 的最终 focused 结果为 `typecheck=PASS`、`unit=45 files/269 tests PASS`、`architecture=46 tests/42 pass/4 todo/0 fail`、`lint=PASS`。
- 相邻静态修复：`useStoreOperatingRuleGate` 的 retry 回调改为显式依赖 `refetch`，仅修正 Hook 依赖声明，不改变读取、失败关闭或重试行为。
- 运行边界：本修订未执行 reset、seed、DEV 重启、backend acceptance、browser L2、UAT 或部署；上述静态结果不升级为动态验收。

以上记录只说明当前主 agent 的实现与静态 focused proof；仍需 fresh 独立只读 `REVIEW_TARGET=IMPLEMENTATION` review 后，才能声明整批实施交付就绪。

## 10. 独立 review 处置

首轮 fresh implementation review 提出的三条代码 finding 已由主 agent 逐条重开 owning source 后确认并修复：

- gate refresh：`useStoreOperatingRuleGate` 统一订阅 `operationsContentTabRefreshSignal`，仅在有效 `enabled + storeId` 且已有 refresh version 时重读 Store-target rule。
- dirty hydrate：`StoreEditDrawer` 按 `store.id` 与 definition 读回边界 hydrate；同一实体的 dirty 草稿不会被 definition 背景变化覆盖，也不会被清 dirty；新实体仍重新初始化。
- catalog 边界：规则定义声明了非 root 节点却找不到 `parentKey` 时抛出 `STORE_OPERATING_RULE_CATALOG_INVALID`，不再静默降级为根节点。

第二轮由 fresh 独立只读 reviewer 完成复核，结果为：

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS_STATIC
L3_UNVERIFIED=浏览器焦点/Tree真实事件/视觉对齐/三host网络帧级行为
DESIGN_GAPS=空
EVIDENCE_TIER=STATIC_SOURCE_REVIEW + TYPESCRIPT_LSP_DIAGNOSTICS + FOCUSED_TEST_SOURCE_REVIEW
```

本修订的代码逻辑已无 OPEN finding；浏览器 L2、DEV、reset、seed、UAT 和部署仍未运行且不在授权内，因此结论保持 `GO_WITH_UNVERIFIED_UI`，不升级为动态验收。
