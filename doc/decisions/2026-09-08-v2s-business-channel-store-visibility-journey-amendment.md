---
title: v2s 经营渠道模板门店可见范围 Journey 修订
status: PROPOSED_FOR_REVIEW
createdAt: 2026-09-08
decisionOwner: Dexter
implementationAuthority: false
extends: doc/decisions/2026-08-19-v2s-business-channel-management-journey.md
---

# Journey 修订：经营渠道模板的门店可见范围

## 1. 这次修订解决什么问题

项目维护的经营渠道模板中，`operatorKind=STORE` 的模板并不一定要让项目内每个门店都能选择。项目管理员需要在创建模板时决定门店可见范围，之后还能调整范围；门店只能从当前对自己可见、仍处于可用状态的模板中创建新的门店经营渠道。

本修订只改变“门店能否把模板作为新建渠道候选”的事实，不改变已经创建的 `business_channel` 实例。模板可见性不是渠道状态，也不是模板生命周期状态，不能被级联成渠道停用、删除或从既有渠道列表中消失。

## 2. 任务与成功结果

```text
JOURNEY_ID=BUSINESS_CHANNEL_MANAGEMENT
AMENDMENT_ID=BUSINESS_CHANNEL_STORE_VISIBILITY
STATUS=PROPOSED_FOR_REVIEW
UI_BEARING=true
CONSUMER_FACE=operations-admin
OWNER=business-channel
IMPLEMENTATION_AUTHORITY=false
```

### 2.1 Actor 与入口

- **项目经营渠道管理员**：在 `operations-admin` 的项目经营渠道管理页维护由项目创建的渠道模板。
- **门店经营渠道管理员**：在 `operations-admin` 的门店经营渠道管理页查看候选模板并创建门店渠道。
- **Owner**：`business-channel` 保有模板可见范围关系、模板命令与渠道命令；`organization` 只提供项目/门店任务型读取事实。
- **页面入口**：沿用既有项目页、门店页和模板详情/编辑 Drawer，不新增业务页面或新的 actor。

### 2.2 术语与对象边界

| 术语 | 本批含义 | 不得混淆 |
| --- | --- | --- |
| 渠道模板 | `business_channel.business_channel_template`，由项目侧创建，含四维经营渠道定义 | 不是门店已创建的渠道实例 |
| 门店可见范围 | 仅对 `operatorKind=STORE` 的模板生效的候选资格事实 | 不是模板 `status`，不是门店状态，也不是渠道 `status` |
| 门店渠道 | `business_channel` 中 `target_node_type=STORE` 的已创建实例 | 既有实例不因模板后续不可见而被删除或停用 |
| 当前项目全部门店可见 | 以项目范围动态判定：当前及之后属于该项目且满足候选资格的门店均满足模板可见性条件 | 不在关系表逐门店展开 |
| 当前项目部分门店可见 | 以 business-channel owner 持有的门店关系集合判定 | 不从“已创建过渠道”反推可见范围 |

`当前项目全部门店可见` 是动态项目成员关系，不保存当时的门店名单；项目后来加入、且满足候选资格的门店自动纳入。该语义已由 Dexter 裁决，不是实施者可自行改变的快照选择。

## 3. 业务规则与不变量

| ID | 规则 | 判定位置 | 失败/恢复事实 |
| --- | --- | --- | --- |
| BCV-01 | `operatorKind=STORE` 的模板必须选择 `ALL_PROJECT_STORES` 或 `SELECTED_PROJECT_STORES`；用户界面文案分别为“当前项目全部门店可见”“当前项目部分门店可见”。 | owner policy + command | 未选择或未知 enum 返回 typed validation；不落模板或关系行 |
| BCV-02 | `operatorKind=PROJECT` 不适用门店范围，wire 发送 `storeVisibilityScope=null` 且没有关系项；任何非空组合都拒绝。 | owner policy | 保持项目模板四维事实；不把 null 映射成“全部门店” |
| BCV-03 | `SELECTED_PROJECT_STORES` 允许最终集合为空；空集合表示当前没有门店可以从该模板新建渠道，不等于模板停用，也不返回空集合 typed error。 | owner policy + candidate read | 保存仍可成功；项目侧显示零家可见与恢复提示，门店侧显示候选空态 |
| BCV-04 | 选中的每个 ref 必须是同 workspace、同项目的组织门店；最终数组内重复 ref 或未知 ref 均 typed 拒绝。门店状态不参与保存校验，VOIDED ref 可以被保留。 | owner task-shaped organization read + owner policy | 不返回 foreign identity；不写部分关系；用户可另次保存主动剔除 VOIDED 门店 |
| BCV-05 | `ALL_PROJECT_STORES` 使用项目范围动态判定，不插入逐门店关系；候选查询按模板所属项目和目标门店当前状态判断。 | owner candidate read | 新加入项目且当前为 ENABLED 的门店按该规则自然成为候选 |
| BCV-06 | 门店模板候选必须同时满足：模板属于请求项目、`operatorKind=STORE`、模板 `status=ENABLED`、目标门店当前 `status=ENABLED`，且目标门店满足 BCV-05 或存在 BCV-04 关系。目标门店状态门禁必须由候选 edge/owner 明确执行，不得只依赖 session/project pair。 | edge scope + organization owner/task read + owner candidate query | 候选响应不含不可见模板或 DISABLED/VOIDED 目标门店；页面不靠前端过滤补齐 owner 事实 |
| BCV-07 | 创建门店渠道时 owner 必须在同一 `REQUIRED` 事务中锁定/重读模板、校验门店项目归属与当前可见范围；陈旧页面不能绕过该复核。 | `createChannel` owner command | 不可见返回 typed problem；不插入渠道或关系的半成品 |
| BCV-08 | 修改可见范围只替换模板可见性事实，不级联修改 `business_channel`，不写渠道状态事件，不删除既有关系历史以外的渠道事实。 | `updateTemplate` owner command | 更新后既有门店渠道仍可读取；候选仅影响下一次新建 |
| BCV-09 | `business_channel` 门店列表/详情读取不追加可见范围谓词；它读取已创建渠道的 owner 事实与模板状态维度。 | channel read owner | 模板从门店移除可见后，既有渠道仍出现在门店渠道列表/详情 |
| BCV-10 | 模板范围更新与模板版本使用 CAS；同一请求使用 idempotency key；scope、集合差异、审计和模板 version 在同一事务内提交。 | owner command receipt + aggregate lock | VERSION_CONFLICT / 重放保持前次完整结果 |
| BCV-11 | 可见范围关系不是门店生命周期状态。关系行不级联删除；模板列表只统计非 VOIDED 门店，项目只读详情只读非 VOIDED 门店，编辑 Drawer 读取全部并标注 VOIDED。候选只允许当前 ENABLED 目标门店；保存最终集合不因门店状态拒绝。 | organization candidate + visibility readback | 不伪造“已不可见”或把状态写回模板；用户可手动剔除 stale VOIDED 关系 |

## 4. 用户任务流

### 4.1 项目侧创建/编辑模板

1. 项目管理员打开既有“新建渠道模板”或“编辑渠道模板” Drawer。
2. 经营主体选择为“门店”时出现“门店可见范围”分组；项目主体不显示该分组。
3. 选择“当前项目全部门店可见”时，页面显示动态范围说明，不出现逐门店关系编辑列表。
4. 选择“当前项目部分门店可见”时，页面显示“已选门店”列表和“添加门店”候选区；候选区使用项目约束的门店候选读取，添加/删除只改变本次表单草稿，保存时一次性提交。
5. 保存前校验与 owner 同形：集合可以为空、没有重复项、每个 ref 属于当前项目；门店状态不参与保存校验，VOIDED 门店可保留；最终仍以 owner readback 为准。
6. 保存成功后刷新模板列表、模板详情和相关候选查询；失败保持 Drawer 输入和旧列表，不把失败误报成功。

当部分模式最终集合为零时，模板列表范围摘要显示“当前项目部分门店可见（0 家）”；只读详情显示“暂无可见门店，当前不会出现在任何门店的新建候选中”，并提供进入编辑以添加门店的既有操作路径。它不是停用状态，也不改变模板本身的启停开关。

### 4.2 门店侧查看/创建

1. 门店进入既有门店经营渠道管理页，模板区只读取当前门店可见且 `ENABLED` 的 STORE 模板候选。
2. 模板区与“新建经营渠道”选择器使用同一候选事实；不能出现模板区可见但新建选择器不可见，或反向只在前端过滤的分叉。
3. 门店已存在的渠道列表独立读取已创建渠道；模板后来撤销该门店可见性时，既有渠道仍显示，详情继续显示模板/渠道各自状态事实。
4. 门店打开旧页面并尝试创建已撤销可见性的模板时，owner 返回 typed stale/visibility problem，前端保留上下文并刷新候选；不得创建渠道。

## 5. 范围、非目标与禁止推导

### 5.1 范围内

- 项目创建 `operatorKind=STORE` 模板时设置门店可见范围。
- 项目管理员在模板编辑时切换范围、添加/删除部分可见门店。
- 门店候选模板读取和新建渠道选择器的可见范围过滤。
- 创建门店渠道时的 owner 最终复核。
- 既有门店渠道读取不受范围变更影响。
- 相关审计、CAS、幂等、typed problem、readback 与 acceptance 设计。

### 5.2 非目标

- 不修改 `organization.store` 生命周期、不新增门店状态、不改变既有 store candidate 的启用状态规则。
- 不把可见范围做成渠道状态、库存可售状态、销售菜单状态或 external provider enablement。
- 不把项目主体模板暴露给门店、不新增第三个 operations 写 capability。
- 不新增批量删除模板/渠道，不改频道四维语义、provider、binding 或 URL。
- 不进入生产代码、契约生成、迁移执行、测试执行、seed/reset、DEV、browser L2、UAT 或部署。

### 5.3 禁止推导

- “模板对门店不可见”不得推出“该门店已有渠道停用/删除”。
- “门店曾创建过渠道”不得推出“门店现在可见”。
- “模板 `status=ENABLED`”不得推出“对所有门店可见”。
- 前端候选列表为空不得被解释成模板被删除；必须区分范围、模板状态、门店状态和授权问题。

## 6. 已裁决的产品边界

| 决策 | Dexter 裁决与本稿固定语义 |
| --- | --- |
| D-BCV-02 | `SELECTED_PROJECT_STORES` 允许空集合；空集合表示零家门店可从该模板新建，不等于停用；项目侧和门店侧均有明确空态与恢复路径。 |
| D-BCV-03 | 关系行保留、不做级联删除；模板列表 count 排除 VOIDED；只读详情读非 VOIDED；编辑 Drawer 读全部并标注 VOIDED。 |
| D-BCV-04 | 编辑保存整体替换最终名单，不提交两个差集数组；关系变更与 scope、version、audit 同一事务提交。 |
| D-BCV-05 | `PROJECT` wire 固定为 `storeVisibilityScope=null`、`visibleStoreRefs=[]`；不把 null 解释为 ALL。 |
| D-BCV-06 | visible-store 读取使用同一个 owner operation 的过滤参数：只读详情为 `storeStatusFilter=NON_VOIDED`，编辑 Drawer 为 `storeStatusFilter=ALL`；响应均带 `storeStatus`。 |

`D-BCV-01` 已删除：ALL 是开关式动态项目成员规则，不存在需要单独裁决的第二种快照选项。D-BCV-04/05/06 原先的“是否”问题也已由上述固定形态收敛，不再作为未决产品问题。

本次用户提供的 Claude DESIGN review 仍要求对修订后的当前字节进行 follow-up review；这是评审证据闭环，不是新的产品裁决，也不改变 `IMPLEMENTATION_AUTHORITY=false`。

本文状态仍为 `PROPOSED_FOR_REVIEW`，不构成实施授权；只有当前文档完成 Claude follow-up review 且 Dexter 另行授权后，才可进入实施。
