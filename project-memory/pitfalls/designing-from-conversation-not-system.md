---
id: pitfalls.designing-from-conversation-not-system
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","admin-ui","contract","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture"]
triggers: ["task-start","implementation","review"]
assertions: ["EXISTING_CAPABILITY_BEFORE_DESCRIBING_BEHAVIOR"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 在有形状的系统里,从白纸开始设计

**失败模式**:拿到需求后,从**对话上下文**推导出一个自洽的方案,
而不是先摸清**这个系统已经长成什么样**。产物在对话里句句成立,放进仓里句句重复或冲突。

⚠️ **光知道这条没用。** 2026-08-18 我在同一个会话里两次把它写下来、命名、总结,
然后**继续犯**,直到被用户连着纠正六轮。知道 ≠ 会做。**必须变成一个动作,不是一份觉悟。**

## 强制动作(替代"我会注意")

**凡是你正准备写下「应该有」「需要提供」「必须支持」「我建议引入」的那一刻,先做一次查找。**

按**意图**查,不按技术名查:

- 前端任何控件/列表/抽屉/表单/渲染 → `project-memory/practices/frontend-capability-lookup.md`
- 授权/并发/凭证/跨 owner/定义-宿主/外部映射 → `project-memory/practices/backend-capability-lookup.md`
- 集合接口形态 → `project-memory/practices/collection-boundary-modes.md`
- 业务语义 → `project-memory/decisions/confirmed-business-language-corpus.md`(G-01～G-12)
- 红线 → `PLATFORM-BLUEPRINT.md` / `AGENTS.md`

查不到再写。**查到就指向它,不要复述它的行为。**

## 这条错的八个真实形态(同一天,同一个人)

```text
❌ 造了一个红线明令禁止的概念
   为 platform-admin 设计「运维写能力」。而 blueprint 红线写明平台端不得有 capability 模型,
   且生成链与不变量门必须拒绝 platform-admin 的 capabilityKey。
   ⇒ 该问题不是"待裁项",是"已经被禁止"。

❌ 把外部平台的规则写进主程序
   读了美团文档,提议主程序按"跳转 + 回调"实现解绑。
   而适配器层存在的全部意义就是吸收这种平台差异。
   ⇒ 用户一句「主程序不需要知道各个平台的规则」点破。

❌ 设计了一个已有机制的替代品
   设计订单同步给商场 ERP 的映射,不知道 G-09 的**货号**定义就是「订单上报商场 ERP 映射」。

❌ 把已裁结论弄丢
   重写文档时丢掉了「已停用门店不阻断建绑定」这条既有裁定,它不在作废清单里。

❌ 问了一个语料早就答了的问题
   问"品牌在不在组织路径上",而 G-03 明写「可见门店范围不从品牌授权反推」。

❌ 描述了一个已经跑着的控件
   为"节点选择框"写交互规格(结果上界、总数提示、编辑态回显、不翻页)。
   而 usePlatformOrganizationCandidates 已经实现了其中每一条,连 PAGE_SIZE=50 都一样。

❌ 为一个已有的渲染器发明字段
   为"能力属性字典"设计 key/label/businessMeaning/controlKind,并纠结用哪套控件词表。
   而 foundation 的 FieldDescriptor 已有 fieldKey/label/helpText/controlKind/optionSourceRef,
   DESCRIPTOR_CONTROL_KINDS 就是那套词表。

❌ 把自己的推论写成用户的裁定
   同一天两次:第一次 6 条,被独立盲审判 M;写下教训后,第二次 8 条。
   ⇒ 口述必须**与对话同步**补记进原始材料;等文档写完再回头补,对第三方等同于没说过。
```

## 一次量化的代价

2026-08-18 对一份需求文档做机械普查:**它描述的十项机制,十项都已存在,零项需要新建。**
集团空间切换、树形浏览、抽屉 surface、可搜索分页表格、启停开关、节点选择器、
CAS 并发、opaque 凭证、声明驱动只读渲染、列表上下文 —— 全部有现成的。

## 为什么危害不只是"白写"

写进需求/详设的行为描述**会被当成规格执行**。实施方照着它重造一个平行实现,
于是同一个行为在仓里有两份、两处会漂移、两处都要维护 —— 比不写更坏。

- **判别式**:我这一段是在说**「必须满足什么」**,还是在说**「它长什么样、怎么动」**?
  后者 ⇒ 停,去查表。
- **反向判别式**:我准备提的这个"新机制",**它的名字是我起的,还是仓里已有的**?
  名字是我起的 ⇒ 极可能已经存在,只是叫别的名。**按意图搜,不按名字搜。**
