# 双后台 ProTable 紧凑密度实施规范

## 目标

`platform-admin` 与 `operations-admin` 的所有生产 ProTable 列表统一使用 Ant Design 的紧凑表格密度。Ant Design Table 的 `size` 合法值为 `large | medium | small`，本规范将用户所说的“compact 紧凑模式”落为显式 `size="small"`，不新增自定义 CSS 或组件包装层。

## 唯一规则

1. 两个后台生产源码中的每个 `<ProTable ...>` 必须在组件首个属性位置显式声明 `size="small"`。
2. 不以全局 CSS、主题默认值或父级上下文替代该属性；源代码必须能直接表达列表密度。
3. 后续新增或搬运 ProTable 必须进入同一分母并通过 `scripts/check/protable-compact.mjs`；除非 Dexter 另行批准并在设计决策中记录例外，不允许单页恢复为其他密度。
4. 该规范只约束 ProTable。Tree、Descriptions、普通 `Table`、EditableProTable 和详情 Drawer 不因本规则被改动。

## 真实分母

当前生产分母为 13 个 ProTable 实例，分布为 `platform-admin=8`、`operations-admin=5`，覆盖 12 个源码文件（平台组织/合同概览页含 2 个实例）。测试文件、仅导入 ProTable 未渲染实例，以及普通 Table/Tree/Descriptions 均不计入分母。

## Package-exit 六类 source 对账

本次 delivery unit 的六类 source 分母如下，避免把“只改前端密度”误报成跨层闭环：

| 类别 | owning source / 本包状态 |
| --- | --- |
| contract | `NOT_APPLICABLE_WITH_REASON`：不改 OpenAPI 或 generated wire |
| owner | `NOT_APPLICABLE_WITH_REASON`：不改后端 owner |
| edge | `NOT_APPLICABLE_WITH_REASON`：不改 HTTP edge |
| frontend | 13 个生产 ProTable 实例，12 个源码文件，platform-admin 8 / operations-admin 5 |
| runtime | `NOT_APPLICABLE_WITH_REASON`：不启动或修改 DEV/UAT/runtime |
| evidence | 本设计、checker、focused proof、independent review、package exit |

`hookSetEquality` 必须在 exit 中声明为 `PASS`；实际改动路径只允许来自上述 frontend/evidence 分母与 active package。

## 方案取舍

显式 `size="small"` 比全局 CSS 或 ConfigProvider 默认值更小且更稳：它没有新增运行时抽象，保留 Ant Design 的语义 API，能在代码审查和静态门中逐实例核对，也不会因主题/Provider 变化而静默改变密度。统一 wrapper 会扩大共享 foundation 的职责并增加迁移成本，本任务不采用。

## 验证与边界

- 机械门扫描两个后台的生产 `.tsx`，逐个计算 `<ProTable>` 实例并要求首个属性为 `size="small"`。
- 机械门的自测会把缺少该属性的红变异判为失败，证明检查器不会假绿。
- 本规范不改变查询、分页、排序、owner、契约、数据库、日志或运行时边界；这些行为仍由各页面现有实现负责。
- 该包是静态 UI 标准实施包，业务与 cleanup 均为 `NOT_APPLICABLE_WITH_REASON`，不借此宣称 DEV/UAT 或浏览器 L2 PASS。
