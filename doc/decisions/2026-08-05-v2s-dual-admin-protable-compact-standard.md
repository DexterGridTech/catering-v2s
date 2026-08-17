# 双后台 ProTable 紧凑密度规范

## 裁决

`platform-admin` 与 `operations-admin` 的生产 ProTable 统一采用 Ant Design `size="small"`，作为本仓“compact 紧凑模式”的唯一实现。该属性必须显式写在每个 `<ProTable>` 实例上，不能用全局 CSS、主题默认值或隐式 Provider 配置替代。

## 适用分母

本规范覆盖两个后台所有生产 `.tsx` 中实际渲染的每一个 ProTable。⛔ 不冻结实例总数：冻结计数会随合法新增而变红，传达的信息是错的——让人以为密度不对，实际只是数字过期。测试 fixture、只导入未渲染的文件，以及普通 `Table`、Tree、Descriptions、EditableProTable 不在本规范分母内。

## 理由与例外

Ant Design Table 的 `size` API 以 `small` 表达紧凑密度。逐实例显式声明最小、可读、可静态验证，并避免主题或 Provider 漂移；不新增 wrapper 或共享业务组件。未来新增 ProTable 必须显式声明 `size="small"` 并通过 `scripts/check/protable-compact.mjs`。除非 Dexter 另行形成决策，不允许单个列表恢复为其他密度。

## 验收

`node scripts/check/protable-compact.mjs --self-test` 必须证明缺失 `size="small"` 的红变异会失败；`node scripts/check/protable-compact.mjs` 必须逐个扫描两个后台，并确认每个实例均显式声明 `size="small"`。该规范仅约束视觉密度，不改变列表查询、分页、排序、owner、契约、数据库或运行时边界。
