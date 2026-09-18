---
title: Journey 裁决：J-SPQ-01 门店桌台与二维码管理
status: DEXTER_ACCEPTED
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
---

# Journey 裁决：J-SPQ-01 门店桌台与二维码管理

## 1. 裁决元数据

```text
JOURNEY_ID=J-SPQ-01
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md
CONSUMER_FACES=operations-admin,platform-admin
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-17
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NOT_AUTHORIZED
```

本文件把已确认的业务任务正式落成 Journey；它不替代需求正本、IA 或交互工件，也不授权生产代码、契约生成、迁移、构建、测试、reset、DEV、seed、UAT 或浏览器验证。

## 2. 用户任务与成功结果

- **Actor 一：运营管理后台用户**：在当前门店范围内维护区域、桌台和扫码点，配置门店级二维码下单开关与门店渠道。
- **Actor 二：运维管理后台用户**：在集团空间级扩展字段配置中维护服务点的纯展示描述字段。
- **此刻任务**：门店已经具备“桌台和二维码管理”能力时，运营人员要在一个主从页面内建立区域，再按区域类型维护桌台或扫码点，并选择一个符合业务条件的门店渠道供二维码 URL 派生。
- **成功结果**：owner readback 返回当前门店的区域、从属对象、二维码配置、扩展字段及资产引用；页面用“区域”“桌台”“扫码点”“二维码配置”等业务术语显示这些事实，且成功保存后列表和只读区域立即以权威 readback 更新。
- **失败后仍成立的事实**：任何失败都不得产生跨门店写入、类型错配、部分保存、孤儿图片资产、错误渠道绑定或把 URL 快照存到服务点；区域/服务点的停用或作废不得抹除其保留的业务配置。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据（文件+锚点） | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 运营后台用户 | 已认证的 operations-admin session | `ESTABLISHED_SOURCE` | 既有 workspace session | `contracts/openapi/paths/operations-admin/workspace-session.paths.json` | 由既有认证边界拒绝，不加载业务集合。 |
| 访问资格 | 运营后台用户 | 新页面访问能力与既有门店商品/库存/销售菜单页面一致 | `IN_SCOPE_PRODUCED` | 本批 admin catalog 与生成物 | `contracts/catalog/admin-catalog.json` 的门店级页面/能力登记；详设 §5 | 无页面入口或只读；隐藏写动作不是后端授权替代。 |
| 门店入口 | 运营后台用户 | 全局选择器已提供稳定的当前门店标识 | `ESTABLISHED_SOURCE` | operations-admin 既有 `queryContext.scopeRef` | `apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx` | 显示既有 required-scope surface；不读取区域、从属对象或二维码配置。 |
| 规则事实 | 运营后台用户 | 当前门店的 `tableManagementEnabled` 已开启 | `ESTABLISHED_SOURCE` + `IN_SCOPE_PRODUCED` | 既有门店经营规则 owner read 与本批页面 gate | `apps/frontend/operations-admin/src/features/store-operating-rules/model/useStoreOperatingRuleGate.ts`；`StoreOperatingRuleGate` | 显示统一未开通 surface；不发区域、从属对象或二维码列表请求。 |
| 业务数据 | 运营后台用户 | 当前门店及其区域、桌台/扫码点、二维码配置的 owner 事实 | `IN_SCOPE_PRODUCED` | 本批 organization owner command/readback | `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/OrganizationOwnerApi.java` 的 owner 边界；详设 §9 | 失败显示准确错误与重试，不把失败伪装成空集合。 |
| 候选渠道 | 运营后台用户 | 当前门店下满足四个模板维度且渠道/模板启用的候选 | `ESTABLISHED_SOURCE` + `IN_SCOPE_PRODUCED` | business-channel owner bounded read | `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java`；详设 §5 | 候选为空时说明需到门店渠道页开通；不在前端取回全量后筛选。 |
| 扩展字段定义 | 运营后台用户 | 集团空间级 `SERVICE_POINT` 定义可被 owner 读取 | `IN_SCOPE_PRODUCED` | 本批 extension host registration 与 definition lookup | `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`；详设 §7 | 未配置时按既有扩展定义空态；不凭空生成字段。 |
| 资产能力 | 运营后台用户 | 桌台图片使用现有 stage/release/claim 资产链路 | `ESTABLISHED_SOURCE` + `IN_SCOPE_PRODUCED` | asset owner typed command 与桌台 owner settlement | `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/api/SalesMenuAssetCommandApi.java`；详设 §6 | 上传/保存失败保留输入并释放或补偿 staged 资产；扫码点无图片前提。 |
| 身份 | 运维后台用户 | 已认证的 platform-admin session | `ESTABLISHED_SOURCE` | 既有 platform session | `contracts/openapi/paths/platform-admin/workspace-session.paths.json` | 由既有认证边界拒绝，不写定义。 |
| 访问资格 | 运维后台用户 | 既有扩展字段配置能力 | `ESTABLISHED_SOURCE` | extension management catalog/edge | `apps/frontend/platform-admin` 的扩展字段配置页面；`ExtensionDefinitionService.listManagementDefinitions` | 保持既有权限与定义管理失败行为。 |
| 业务数据 | 运维后台用户 | 集团空间级服务点扩展字段定义 | `IN_SCOPE_PRODUCED` | 本批新增 host type 后的 extension owner | `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java` | 读取/保存定义失败按既有 typed problem 呈现。 |

没有 `EXTERNAL_PREREQUISITE_DEXTER_DECISION` 前提。当前“线框图已确认”解除的是进入 implementation-facing 文档的前置门；它不等于实施或运行授权。

## 4. 任务边界、非目标与禁推

### 4.1 范围内动作

1. 在 operations-admin 新增“门店桌台与二维码管理”页面，区域为左侧 master 列表，当前区域下的桌台/扫码点为右侧 dependent 列表。
2. 在区域列表头部创建区域；选中桌台区后显示“新建桌台”，选中扫码区后显示“新建扫码点”。
3. 区域、桌台和扫码点的顺序只通过列表行末“…”菜单中的“上移/下移”维护，不出现在创建/编辑表单中。
4. 主页面展示门店级二维码配置的只读事实；点击“编辑”打开独立二维码配置 Drawer，主页面不内联编辑。
5. 详情 Drawer 只读展示真实事实；编辑 Drawer 才使用 Form。所有编辑 Drawer 的 dirty、关闭确认、提交中锁定和失败留稿由 `useDrawerFormLifecycle` 统一管理，子控件不得自行提示“请先保存”。
6. 桌台支持独立属性和既有资产链路；扫码点不显示桌台属性或图片入口。
7. 运维管理后台为 `SERVICE_POINT` 宿主维护集团空间级扩展字段；operations-admin 只读取并保存服务点扩展值，不接入动态列与类型化搜索。
8. 二维码候选层按四个模板维度及渠道/模板自身状态过滤；生成层只判最终 URL 合规性，已选渠道状态变化不成为第四种不出码原因。

### 4.2 非目标

- 不建设桌台会话、扫码会话、候位、取餐、开台、并桌、清台或终端消费。
- 不下载或批量导出二维码图片；本批在二维码生成位置按派生 URL 直接生成并展示二维码图像，不落库、不新增二维码图片资产链路。
- 不把二维码 URL 或码实体写入服务点表；不新建 provider config 层。
- 不把服务点加入扩展字段平面宿主集合；本批无扩展动态列与类型化搜索。
- 不把桌台“是否可预约”与门店经营规则预约开关联动。
- 不在创建/编辑 Drawer 中输入顺序值，不新增拖拽排序或另造列表交互。

### 4.3 禁推

- 不从列表行、未保存表单或前端缓存推导门店/区域/服务点身份；所有 owner command 都重新校验归属和类型。
- 不把 `statusDimensions` 或 `blockers` 自动当作二维码生成判定；D-12 已将生成层收成最终 URL 单一谓词。
- 不把 URL 规则为空/非法提前变成候选过滤或配置保存错误；D-10 要求在生成层显示固定文案。
- 不把父区域停用/作废转换为对子对象存储状态的批量改写；只计算有效性，不改写后代存储值。
- 不以“技术实体服务点”替代面向用户的“桌台/扫码点”命名。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 区域、桌台、扫码点 | `project-memory/decisions/confirmed-business-language-corpus.md` 的门店配置业务词条；需求 §1、§3 | 页面、按钮、Drawer、空态与帮助文案只使用这些词 | 无 | 否 |
| 运维管理后台 / 运营管理后台 | `AGENTS.md` 术语红线 | `platform-admin` 负责定义，`operations-admin` 负责门店对象 | 无 | 否 |
| Drawer 生命周期 | `project-memory/practices/drawer-form-lifecycle.md` | 所有新建/编辑 Drawer 统一复用 Foundation 生命周期 | 用户已明确禁止子控件自管理 dirty | 否 |
| 列表排序 | `project-memory/practices/ordering-only-for-consumer-facing.md` 与 Dexter 本批明确排序要求 | 本批按 Dexter 明确的销售菜单式操作落地，只做同集合相邻移动，不额外引入通用排序系统 | 通用规范偏向只为消费者展示对象排序；本批排序是已明确的后台运营展示/维护语义 | 否，按本批明确输入执行 |
| URL 生成 | 需求 D-10/D-12 | 候选层与生成层严格分离 | 状态集合丰富但本批生成层不消费 | 否 |
| 扩展宿主粒度 | 需求 D-8、当前 extension definition 主键粒度 | `SERVICE_POINT` 为集团空间级一套定义 | 不区分桌台与扫码点 | 否；作为已知限制 |

## 6. UI 适用性与后续工件

`UI_BEARING=true`。已创建并由 Dexter 视觉确认：

- IA：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md`；
- 交互与低保真线框：`doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md`。

确认后的后续顺序是：

1. 依据本 Journey、需求、IA、交互工件和六维 memory 命中项形成 implementation-facing 详设；
2. 依据详设形成实施计划；
3. 详设与实施计划交 Dexter 和 Claude 做静态 DESIGN review；
4. 只有取得独立设计 review 与 Dexter 的明确实施授权后，才可进入生产代码或运行。

## 7. Dexter 裁决

- **裁决**：接受本 Journey 作为已确认需求与线框的正式用户任务工件。
- **精确范围**：区域、桌台、扫码点、二维码配置、模板 URL 规则、服务点扩展字段宿主、桌台图片资产接入及其 operations-admin/platform-admin 入口。
- **已知前提**：本批桌台属性定义但没有运行时消费者，且容纳人数、形态、是否可预约均为非必填；服务点扩展字段不进入动态列/类型化搜索；二维码 URL、二维码图像和码实体不持久化；区域与服务点采用三态生命周期。
- **未决项**：无新增产品裁决；详设仍须以当前源码确认 operation、schema、migration、asset target、权限、错误映射和验收场景的实际落点。
- **后续允许动作**：只允许继续写 implementation-facing 详设与实施计划，并进行只读源码核查；当前不允许生产代码、契约生成物、迁移、构建、测试、reset、DEV、seed、UAT、部署或浏览器验证。
