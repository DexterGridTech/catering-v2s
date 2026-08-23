---
title: 商品库业务、用户 Journey 与 UI 交互优化 Journey 裁决
status: DEXTER_ACCEPTED
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
---

# Journey 裁决：J-CATUI-001 商品库唯一工作区

<a id="journey-j-catui-001"></a>

## 1. 裁决元数据

```text
JOURNEY_ID=J-CATUI-001
JOURNEY_PATHS=J-CATUI-01..J-CATUI-08
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md#G-05B/G-11/G-12/CIPG-01
```

本 Journey 是一个商品库工作台内的八条用户任务路径，不是八个可以各自选壳、各自交付的页面专题。
目录树、结果表、查看、编辑、配置、批量、复制和治理必须作为一个用户上下文统一设计。

2026-08-24 最终裁定补充：生产标签属于商品且为可空单值；本期只保证单值、维护、展示与筛选，不实现生产
路由。商品表十个业务列全部常显，具体顺序与单元格四行视觉契约以正式需求 §4.2 为准。

## 2. 用户任务与成功结果

### 2.1 总任务

- **Actor**：总部商品资料维护者、门店商品资料维护者、门店库存维护者、门店店长、后厨/出品人员、
  库存员、治理处理人。
- **此刻任务**：在当前已授权商品范围内找到商品，读懂商品，必要时创建、编辑、配置、批量整理、复制或治理，
  并在任务完成或失败后回到原工作台上下文。
- **成功结果**：用户始终知道当前范围、对象、查看/编辑状态、未保存内容和业务结果；已保存事实由 owner
  readback 证明，查看面不出现禁用表单，商品父行与每个规格子行可直接比较。
- **失败后仍成立的事实**：已保存商品、规格、定义、库存、BOM、引用和历史快照不因前端草稿、关闭弹层、
  读取失败、提交拒绝或错误推导而改变；批量已成功项与失败项按权威结果分别成立。

### 2.2 八条任务路径

| Path | Actor 的此刻任务 | 用户成功结果 | 失败/退出后仍成立 |
| --- | --- | --- | --- |
| `J-CATUI-01` 查找 | 从范围、目录树、商品标签、生产标签、分类、状态、来源或关键词缩小商品集合 | 保持现有工具区与结果域筛选区；父商品可比较，按规格商品展开后每个规格独占一行；十个业务列全部常显 | 筛选、分页、横向滚动位置和有效展开状态不因打开/关闭详情丢失 |
| `J-CATUI-02` 查看 | 回答“是什么、怎么做、怎样扣库存、被谁使用” | 只读 Drawer 以业务陈述回答，无 Form 和 disabled 控件 | 读取失败不改变列表或商品事实，原地可重试 |
| `J-CATUI-03` 新建 | 以最少身份建立商品草稿 | 商品分类按树层级单选；原子创建后进入该商品编辑 Drawer | 创建失败不产生半个商品，不打开伪编辑态 |
| `J-CATUI-04` 编辑 | 修改当前商品的适用事实族并整单保存 | 商品分类按树层级单选；区段导航、dirty/error、草稿恢复、一次整单 readback | 已知失败保草稿；未知结果先读回；取消恢复已保存事实 |
| `J-CATUI-05` 配置 | 维护六类被商品复用的定义 | 配置 Drawer 内按简单/父子/复杂三形态完成 | 失败不改既有绑定；编辑绕行草稿可恢复 |
| `J-CATUI-06` 批量 | 对选中父商品批量分类、标签、状态或归档 | 目标分类按树层级单选；提交前知情、提交中可见、提交后逐项报告 | 规格子行不参与商品批量；失败项事实未变 |
| `J-CATUI-07` 复制 | 从品牌复制到门店或覆盖当前商品的选定设置 | 来源、目标、范围、冲突、结果连续可见 | 检查影响失败不写；逐项结果不被一条提示覆盖 |
| `J-CATUI-08` 治理 | 执行生命周期动作或补全外部临时商品 | 只显示当前可执行动作，危险影响可理解 | owner 拒绝后状态、版本和引用不变 |

## 3. 逐 actor 前提链

来源类型均已成立，无 `EXTERNAL_PREREQUISITE_DEXTER_DECISION`。

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 全部 actor | 已登录运营用户与有效会话 | `ESTABLISHED_SOURCE` | operations session | `contracts/openapi/paths/operations-admin/workspace-session.paths.json#selectOperationsWorkspaceSessionDataNode` | 回到会话处理，不进入商品工作台 |
| 任职与当前范围 | 全部 actor | 当前 data node、上下文版本、总部/门店范围 | `ESTABLISHED_SOURCE` | session 选择 + workbench context | `contracts/openapi/paths/operations-admin/catalog-workbench.paths.json#getOperationsCatalogWorkbenchContext` | 显示“请选择管理范围”或无权说明，不伪装空列表 |
| 品牌范围 | 总部资料维护者 | 当前总部下已授权、启用品牌 | `ESTABLISHED_SOURCE` | organization readback | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx#headCompanyRequest` | 没有授权品牌时显示范围说明，不读取其它品牌 |
| 页面与动作能力 | 写 actor | 可查看/创建/编辑/复制/治理的当前能力与原因 | `ESTABLISHED_SOURCE` | IAM grant + owner action availability | `contracts/openapi/components/catalog/catalog-workbench.schemas.json#actionAvailability` | 维持正常只读详情；不打开整张禁用表单 |
| 商品目录 | 全部 actor | 目录树、智能视图、标签与分类 | `ESTABLISHED_SOURCE` | catalog navigation read | `contracts/openapi/paths/operations-admin/catalog-workbench.paths.json#getOperationsCatalogNavigation` | 树区显示失败与重试，保留已确认结果 |
| 商品父行 | 全部 actor | 当前结果域、父商品摘要、分页、规格子行可用性 | `ESTABLISHED_SOURCE` | catalog list read | `contracts/openapi/paths/operations-admin/catalog-workbench.paths.json#getOperationsCatalogItems` | 表区显示失败与重试，不把旧范围数据当新结果 |
| 规格子行 | 全部 actor | 某父商品的规格行摘要 | `IN_SCOPE_PRODUCED` | 本 Journey contract 设计新增/扩展的懒加载 task read | `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md#42-商品工作台` | 展开位置显示失败子行；不改父列表分母 |
| 商品详情 | 全部 actor | 当前商品完整事实、适用区段和动作 readback | `ESTABLISHED_SOURCE` | catalog detail read | `contracts/openapi/paths/operations-admin/catalog-workbench.paths.json#getOperationsCatalogItem` | Drawer 内持久错误与重试，原列表不变 |
| 有效制作信息 | 后厨/出品、资料维护者 | 商品级单一生产标签；商品/规格制作内容；选项只增时长与说明 | `ESTABLISHED_SOURCE` | catalog/fulfillment-production readback + 2026-08-24 Dexter 单值裁定 | `project-memory/decisions/confirmed-business-language-corpus.md#CIPG-01` | 制作区独立失败，不退回自由文本或技术 profile；不推导生产路由已实现 |
| 库存扣减与用料 | 库存员、库存维护者、店长 | 当前扣减方式、单位、用料和引用摘要 | `ESTABLISHED_SOURCE` | catalog + inventory task read | `project-memory/decisions/confirmed-business-language-corpus.md#G-12` | 只读区失败可重试；实际余额流水不搬入商品页 |
| 六类配置 | 资料维护者 | 商品标签、单位、规格维度、生产标签、属性、点单选项 | `ESTABLISHED_SOURCE` | 各 owner dictionary/definition reads | `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md#47-商品配置抽屉` | 当前库右栏失败与重试；其它库状态不冒充当前库 |
| 当前版本 | 所有写 actor | 用户开始编辑时看到的商品/定义版本 | `ESTABLISHED_SOURCE` | latest detail readback | `doc/platform/frontend-coding-standard.md#3-E-同一个事实只能有一个住址` | 冲突保草稿并提示重载，不提交新读到的版本代替用户版本 |

## 4. 任务边界、非目标与禁推

- **范围内动作**：八条路径、47 个现有 surface、父商品/规格子行树形表、四个互斥第一层 Drawer、
  直接原子/批量 Modal、编辑子任务面、草稿恢复和配置绕行。
- **非目标**：销售集合、发布、当前可售、扫码销售解析、打印机、KDS、生产工作台、生产路由、任务分派、导入导出、库存余额流水执行、
  新的 owner 或新的商品业务语义。
- **禁推**：商品启用不推发布/可售；库存摘要不推菜单；总部模板不推门店继承；UI 动作隐藏不推 owner 防线；
  父商品列表存在规格数不推规格行已经加载。
- **禁止伪修复**：只改像素和文案、给 disabled 表单补说明、继续使用 `expandedRowRender` 拼 SKU 文本、
  Modal 上叠宽 Drawer、子任务内再开 Picker Drawer、用 testId 存在冒充 L2、用 seed 或 fixture 发明用户任务。
- **生产标签边界**：一个商品最多一个生产标签；规格和点单选项不能改写。没有标签是合法状态；不得建立
  默认标签、兜底队列或任何看似已经路由的反馈。
- **用户语言**：用户始终看到“规格、检查影响、重新加载、从品牌复制”；`SKU/预检/owner/ref/UUID/problem code`
  等技术词只允许出现在实现与测试说明。“商品元数据/当前结果域”仅因冻结入口保留，不扩散到任务正文。
- **控制权**：Journey 决定任务和 surface；contract 声明业务适用性、动作和候选；App state 只组织当前任务、
  草稿与界面瞬态；foundation 只拥有机械生命周期；owner 在命令内最终复核。任一层不得替另一层补义。
- **验证边界**：browser L2 必须由每 run TEST fixture 驱动并用 owner readback 证明结果；DEV seed、旧用例、
  元素存在或静态 proof 都不能证明本 Journey。日志必须能从用户 action 关联到 request/owner/DB/cleanup。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 商品目录 | `confirmed-business-language-corpus.md#G-11` | 工作台、详情和编辑都围绕“商品是什么” | 无 | 否 |
| 规格与做法加料 | `confirmed-business-language-corpus.md#G-11` | 技术模型中的 SKU 在 UI 一律称“规格”；每个规格子行是一个规格对象；点单选项不混成规格 | 无 | 否 |
| 库存与 BOM | `confirmed-business-language-corpus.md#G-12` | 用户用“库存扣减与用料”；BOM 仅在正式业务词必须出现处保留 | 无 | 否 |
| 条码、PLU、助记码、制作信息 | `confirmed-business-language-corpus.md#CIPG-01` | 沿用已确认业务文案，不恢复自由三元组或技术 profile | 无 | 否 |
| 名称与编码 | `confirmed-business-language-corpus.md#G-05B` | 名称首列可进入详情，编码独立显示；关联对象显示名称（编码） | 无 | 否 |
| 集合模式 | `collection-boundary-modes.md` | 单值分类用单选/可清空；多值标签保持多选 | 当前批量分类旧 UI 漂移 | 否，正式需求已定 |
| 跨批交互七族 | `doc/platform/frontend-coding-standard.md#3-K` | 所有 surface 逐字引用，不建商品第二规范 | 无 | 否 |

## 6. UI 适用性与后续工件

`UI_BEARING=true`。

必须创建一份覆盖八条路径的交互工件，并至少提供四组可审阅低保真线框：

1. 工作台 + 商品查看 Drawer，含父商品/规格子行展开与收起；
2. 超宽编辑 Drawer + 区段导航 + 子任务面 + 草稿恢复；
3. 全高配置 Drawer 的简单字典、父子字典、复杂定义三个代表态；
4. 批量三态 + 两类复制向导。

Dexter 看图确认前不得写 IA 或 implementation-facing design。线框必须画出 loading、empty、error、dirty、
recovery 和焦点归还，不得只画 happy path。

## 7. Dexter 裁决

- 裁决：接受。
- 精确范围：正式需求中的八条 Journey 路径、47 个 surface 和 `U-CATUI-01/02/03/05/06/07/08/09/10/11/12`。
- 已知前提：所有商品操作留在商品库唯一页面；目录树保留；第一层 Drawer 互斥；深链/浏览器后退放弃；
  每个规格在树形商品表中独占一行，父商品可展开/收起，默认使用 V4 同款普通 Ant Design Table。
- `U-CATUI-06=DEXTER_ACCEPTED`：顶部“树表视图/仅表格、商品元数据、从品牌复制、新建商品”工具区，
  以及“当前结果域、搜索、状态、来源、重置”筛选区保持现状；本批不改变其文案、顺序、位置或语义。
- `U-CATUI-07=DEXTER_ACCEPTED`：新建、编辑、批量移动、分类挪父及所有后续商品分类选择控件统一使用
  单选树形选择器，显示分类层级和完整路径；不得平铺。
- `U-CATUI-08=DEXTER_ACCEPTED`：库存扣减是商品列表默认常显列。
- `U-CATUI-09=DEXTER_ACCEPTED`：商品表格允许并预期在表体内横向滚动；不得为了避免横向滚动删除默认列、
  压缩业务内容或把父商品/规格行改成卡片。横向滚动不改变父子共享列模型。
- `U-CATUI-10=DEXTER_ACCEPTED`：商品与规格的标准价均可不设置；未设置不是异常、风险或配置缺口，不阻止
  商品创建、保存、启用或其它配置。进入菜单销售时菜单项必须有价，该准入由菜单/销售集合 owner 负责，
  商品库不得提前替它报错或把菜单规则写回商品。
- `U-CATUI-11=DEXTER_ACCEPTED`：“制作处理标签”改为“生产标签”；每个商品 0..1，规格和点单选项不得覆盖或
  叠加。目录树新增“生产标签”一级节点及全部标签二级筛选；本期不实现生产路由。
- `U-CATUI-12=DEXTER_ACCEPTED`：商品表十个业务列全部默认常显，顺序和四行单元格规则以正式需求 §4.2 为准；
  横向滚动承载完整信息，不建立列隐藏偏好。
- 未决项：零。
- 后续允许动作：创建交互工件与低保真线框交 Dexter 看图；线框确认前不进入 IA、详设或实施。
