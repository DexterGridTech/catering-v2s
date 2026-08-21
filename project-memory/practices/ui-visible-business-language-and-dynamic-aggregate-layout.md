---
id: practices.ui-visible-business-language-and-dynamic-aggregate-layout
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["admin-ui","platform"]
consumerFaces: ["platform-admin","operations-admin"]
owners: ["frontend-platform"]
impacts: ["architecture"]
triggers: ["task-start","implementation","review"]
assertions: ["BUSINESS_LANGUAGE_FOR_VISIBLE_UI","PARENT_CHILD_DYNAMIC_AGGREGATE_LAYOUT","BUSINESS_CORPUS_FOR_VISIBLE_UI"]
sourceRefs: ["doc/decisions/templates/ui-interaction-design-template.md","project-memory/decisions/confirmed-business-language-corpus.md"]
---

# 用户可见业务语言与主从动态集合布局

**触发时刻**：设计、实现或评审一个有动态明细、候选选择、表单列表或明细抽屉的管理后台 screen。

## 两个容易同时发生的失败模式

1. 用实现结构给字段命名，例如把用户要选择的原材料、用量或业务对象叫作“组件”“目标”或内部对象名。
   用户无法由名称判断该数据的业务作用，且错误/确认提示会把实现细节泄漏给运营用户。
2. 主项和从属明细被平铺在同一堆卡片或重复行中。用户无法判断当前编辑的是哪一个主项，明细归属谁，
   以及保存会影响哪一组数据；常见伴随缺陷是不同主项明细混排，或已有数据时仍展示空态。

## 最小防线

- 可见文案只使用已接受业务语料、Journey 或 Dexter 裁决中的对象、动作和结果词；技术词只留在
  `TECHNICAL_BOUNDARY` 等非用户可见说明。
- 主从动态集合先画出稳定的主项定位与当前项，再让从属集合只随当前项展示；将空态、切换、增删、
  排序、待删除确认、去重、最少项和保存/readback 写成可检查的交互事实。

规范正文、完整适用范围和反例见
`doc/decisions/templates/ui-interaction-design-template.md#business-language-and-dynamic-item-naming` 与
`doc/decisions/templates/ui-interaction-design-template.md#parent-child-dynamic-aggregate-layout`。本记忆只作
六维路由提示，不复制模板正文，也不把可见交互规则误归入 IA 的不可见维度。

**判别式**：不看技术说明，运营用户能否说清“这个字段是什么、现在在编辑哪一项、下方数据归谁、保存
会影响什么”？任一答案是否定的，先回到交互工件修正层级与业务文案，不能用实现术语或更多卡片补救。
