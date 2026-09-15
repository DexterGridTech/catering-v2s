---
title: Journey 裁决：J-EXTENSION-FIELD-LIST-SEARCH 扩展字段列表展示与类型化搜索
status: ACCEPTED_FOR_IMPLEMENTATION
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
---

# Journey 裁决：J-EXTENSION-FIELD-LIST-SEARCH 扩展字段列表展示与类型化搜索

## 1. 裁决元数据

```text
JOURNEY_ID=J-EXTENSION-FIELD-LIST-SEARCH
STATUS=PROPOSED
SKILL_USED=cs-spec-to-plan@.agents/skills/cs-spec-to-plan/SKILL.md
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md
BUSINESS_REQUIREMENT=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
```

## 2. 用户任务与成功结果

- **Actor**：平台管理员（运维管理后台）；运营管理员（运营管理后台）。
- **此刻任务**：平台管理员为一个业务宿主配置扩展字段是否进入平面列表/搜索；运营管理员或平台管理员在已有实体列表中用这些字段找到记录并看见结果。
- **成功结果**：八类宿主的配置状态可读；五类平面宿主的十个现有列表面显示正确动态列和类型匹配搜索项；owner 返回同一过滤集合的 `total/items/page` 与 raw `extensionValues`；用户可继续打开现有详情。
- **失败后仍成立的事实**：定义 replace 不部分保存；实体已有扩展值不删除/改写；不可搜索、停用、类型错误或过期 revision 不被静默忽略；权限范围、核心条件、核心排序和既有动作不改变。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据（文件+锚点） | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 平台管理员 | 已登录的平台管理员身份 | `ESTABLISHED_SOURCE` | platform session | `apps/backend/catering-business-server/modules/extension/.../ExtensionDefinitionService.java#replaceDraft` | 未登录拒绝，配置页显示读取/登录错误 |
| 访问资格 | 平台管理员 | 已启用平台管理员可执行 definition replace；平台列表具备既有 platform read | `ESTABLISHED_SOURCE` | extension auth / platform read | `ExtensionDefinitionService#replaceDraft`；platform controller read boundary | 已停用账号或无读资格拒绝；不发明“配置读 capability” |
| 入口数据 | 平台管理员 | 当前 selected workspace 与八类宿主 catalog | `ESTABLISHED_SOURCE` | catalog/selected workspace | `contracts/openapi/paths/platform-admin/extension-definition.paths.json#getExtensionEntityCatalog` | context 无效时不显示旧宿主配置，提供重试/重新选择 |
| 业务数据 | 平台管理员 | 当前宿主 `ExtensionDefinition.revision` 与 `definitions[]` | `ESTABLISHED_SOURCE` | definition readback | `ExtensionDefinitionReadback.java#ExtensionDefinition`；现有 `getExtensionDefinition` | 定义读取失败不得打开带旧数据的成功 Drawer |
| 身份 | 运营管理员 | 已完成 workspace session 的运营管理员身份 | `ESTABLISHED_SOURCE` | operations session | `apps/backend/catering-business-server/modules/workspace/...` operations session boundary | session 无效拒绝，保留核心页面错误语义 |
| 访问资格 | 运营管理员 | 对当前 workspace/project scope 的实体读权限 | `ESTABLISHED_SOURCE` | organization/contract owner read | `OrganizationOverviewTaskReadPersistence`；`ContractTaskReadService` 当前读边界 | 无权限不返回范围外数据 |
| 入口数据 | 运营管理员 | 既有列表上下文；合同列表先选择项目 | `ESTABLISHED_SOURCE` | page context bar / list route | `apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx` | 未选项目显示“请先选择项目”，不发合同列表请求 |
| 业务数据 | 运营管理员 | 当前 host definition、实体分页结果和 raw extension values | `ESTABLISHED_SOURCE` | owner page read | §3.2 七个 flat operation；现有 list item `extensionValues` | 定义/列表读取失败可见且可重试，不伪装为空结果 |

没有 `EXTERNAL_PREREQUISITE_DEXTER_DECISION`；低保真交互工件已获 Dexter 视觉确认。进入实现仍须完成当前修订字节的 fresh 独立 DESIGN 盲审并由主 agent 逐条处置；视觉确认本身不替代该盲审。

## 4. Journey 步骤与范围

| 步骤 | 用户动作 | 结果与 owner readback | 范围 |
| --- | --- | --- | --- |
| J1 | 打开 `/platform/extension-fields`，选择一个宿主 | 通过 catalog 与 definition readback 显示完整字段配置 | 8 host 全部配置可见 |
| J2 | 在 field card 设置两个独立开关并保存 | replace 使用 expected version/Idempotency-Key，返回权威 definition/revision | flat 两个开关可编辑；三类树 host 两个槽位均 N/A |
| J3 | 进入一个现有 flat list，填写动态搜索或直接浏览 | 当前 definition 决定动态控件/列；列表返回 page 与 raw values | 10 个 flat screen face |
| J4 | 使用核心条件与一个/多个动态条件查询、翻页、重置 | owner 以 AND 计算同一结果集；动态列不排序 | 7 个 flat list operation |
| J5 | definition 在页面读取后发生变化 | 一次强制权威重读，清除失效扩展条件、保留核心条件并回第一页；同 revision 再拒绝则停止并手动重试 | flat list only |

J4 中未携带 `extensionFilters` 或解码后为零元素数组（包括 `extensionFilters=[]`）均表示无扩展条件：不发送 `definitionRevision`，owner 不做 revision 比对；只有非空扩展条件才触发 revision 要求与比较。

J4 的请求判定顺序固定为：授权/context → percent decode、JSON syntax、encoded length、顶层 array、item shape 和原始数组上限 → 未携带或空数组按无扩展条件直接走既有 Page → 非空数组缺失或不满足 `definitionRevision` 的 `integer/int64/minimum=0` contract 时返回 `400 EXTENSION_FILTER_INVALID`，且不读取 definition snapshot → 读取当前 definition snapshot 并比较 revision → revision 相等后校验 enabled/searchable/type/options/duplicate 等定义语义并聚合 invalid → owner 计算核心条件与扩展条件的 AND Page。UI typed draft 可以是数字/布尔值，但 `ExtensionFilter.value` wire 始终是按 `type` 编码后的 JSON string。

## 5. 任务边界、非目标与禁推

- **范围内动作**：配置八类宿主的两个状态；在品牌、经营租户、总公司、门店、合同的 operations/platform 平面列表消费固定动态列和类型化搜索；保留现有详情和核心操作。
- **非目标**：组织树扩展搜索/列/快照/接口/详情；候选选择器改造；扩展值独立管理页；范围、多选、全文、数字/日期范围搜索；稳定 option key/label 迁移。
- **禁推**：`searchable` 不推导 `listDisplay`；实体 `extensionRuleRevision` 不推导当前 definition revision；平台列表不从详情接口逐行补值；页面数不推导 operation 数；DB operation count 不推导数据规模或延迟通过。
- **禁止伪修复**：不以当前页本地过滤、抽干所有分页、空结果、旧缓存、文本框降级、逐行请求、兼容 fallback、默认账号、seed 或测试 fixture 代替业务闭环。

组织架构树保持现状：运营管理后台和运维管理后台的组织架构树只保留现有的名称/编码搜索；树接口、树页面、树详情都不改。`COMMERCIAL_GROUP`、`REGION`、`PROJECT` 的 `listDisplay` 与 `searchable` 均显示“不适用”、不可编辑、不产生任何消费；候选选择器也不属于本需求。

## 6. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 运维管理后台 / `platform-admin` | `project-memory/decisions/confirmed-business-language-corpus.md` | 平台配置和平台只读列表使用“运维管理后台” | 无 | 否 |
| 运营管理后台 / `operations-admin` | 同上 | operations 实体列表使用“运营管理后台” | 无 | 否 |
| 列表展示 / 可搜索 | 用户直接需求；本需求 §4 | 两个独立布尔消费配置 | N/A wire 需 nullable boolean，已在需求冻结 | 否，按 Dexter 2026-09-14 裁决 |
| 扩展字段宿主 | `ExtensionHostTypes.VALUES` 与 `ExtensionEntityType` | 八类配置全集，五类 flat 消费 | 树消费被裁决关闭 | 否 |
| 合同列表先选项目 | current operations UI | J3 的合同前置与空态 | 不得写成合同名称搜索 | 否 |

## 7. UI 适用性与后续工件

本 Journey 是 UI-bearing，必须配套：

1. `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md`：声明授权、集合、刷新、数据级联和失败观察；
2. `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md`：12 个 screen 的可见形态、低保真线框、文案、控件和 testId roster；
3. `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md`：七 operation、contract/owner/foundation/SQL/seed/acceptance 的实现边界；
4. `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-plan-codex.md`：受授权后可执行的步骤与独立对账。

## 8. Dexter 裁决与当前状态

- **裁决**：需求范围与低保真交互工件已获 Dexter 2026-09-14 直接确认；round 2 fresh 独立 DESIGN 复审已完成，S-R2-1 与 N-1 已由主 agent 按 `SELF_DECIDED` 最小修复闭合，不再启动第三轮。
- **精确范围**：8 个 host 配置、2 个配置 screen、10 个 flat list screen face、7 个 target list operation；树面零改动。
- **已知前提**：现有 extension definition、owner read、platform read、operations session、foundation primitive 和候选边界均以当前源码为准。
- **未决项**：OpenAPI/generation/owner/SQL/index/seed 的实施验证；七 operation budget 的实际 `from/to/measuredMax`；P6/P7/P9 独立对账与实施后复审。
- **后续允许动作**：按 Dexter 当前授权修改生产代码、契约、测试、seed source，并在实现与静态/重点验证闭合后执行受管 reset、DEV、seed；browser L2、UAT 和部署仍不在本次授权内。

```text
JOURNEY_STATUS=REVISED_PENDING_INDEPENDENT_DESIGN_REVIEW
UI_SCREEN_DENOMINATOR=12
FLAT_SCREEN_DENOMINATOR=10
TARGET_LIST_OPERATION_DENOMINATOR=7
TREE_CHANGE=NONE
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
DESIGN_REVIEW=NO_GO_ROUND_2_FINDINGS_SELF_CLOSED
```
