# R5 CR03–CR06 静态 v2 对比记录

状态：`PASS_STATIC_ONLY_DYNAMIC_L2_DEFERRED_TO_CR08`

## 目的与边界

本记录是 CR06 package-exit 前的静态复核，不把“有对应文件”冒充为行为等价。Heritage `catering-all-v2` 仅作只读比较；不会成为本仓运行、构建或契约 fallback。浏览器 L2、DEV、seed 和远端运行证明均明确移交 CR08。

全量前端承接分母由 [carry-over manifest](../../../contracts/policy/frontend-asset-carryover-manifest.json) 派生：22 个 surface；页面语义目录由 [admin catalog](../../../contracts/catalog/admin-catalog.json) 派生：8 个 platform + 17 个 operations = 25 个 pageDesignKey。逐项 target/source byte binding 见 [CR06 surface closure](2026-07-27-v2s-r5-cr06-static-surface-and-page-key-closure.json)。

## CR03：认证与安全边界

| 对比项 | v2 原文 | v2s 亲验结果 | 结论 |
|---|---|---|---|
| 运营登录的 OTP 备选 | `apps/frontend/operations-admin/src/features/authentication/ui/WorkspaceLoginPage.tsx`：密码/OTP Tabs，分别调用 `sendOperationsWorkspaceOtp`、`verifyOperationsWorkspaceOtp` | `apps/frontend/operations-admin/src/features/authentication/ui/OperationsLoginPage.tsx` 同样以生成 client 调用两项冻结 operation；只展示 server 回传的 expiry，不显示 v2 测试夹具中的 `testCode` | 保留用户任务，减少一次性验证码在 UI 的泄漏面 |
| 会话选身份/数据节点 | v2 的 generated session entry 提供候选项 | `libraries/backend/workspace-iam/.../WorkspaceSessionEntryReadback.java` 与 `WorkspaceAuthenticationService.java` 由 owner 生成候选、selected 和 navigation；`WorkspaceSessionWireMapper.java` 仅映射 typed readback | 比“前端从菜单推导身份/范围”更强；实际 menu、能力和范围来自同一 owner readback |
| 每次写入的上下文版本 | v2 仅以该时点 edge request 形态约束 | v2s `workspace-iam` 的 revoke/invitation request 与 organization 的 update request 均含 `expectedContextVersion`，operations controller 先校验 session | 追加式、契约化的 stale-context 防线；不改变 HTTP path/operationId |

## CR04：owner、持久化与跨 owner 读边界

| 对比项 | v2 原文 | v2s 亲验结果 | 结论 |
| 被选范围的授权 | v2 `WorkspaceLoginPage.tsx` 与 generated operations API 以 workspace key 进入业务页 | v2s `OperationsBusinessEntityController.java` 在每个 detail/update 先取 `WorkspaceSessionReadback` 并以 selected assignment/data-node 进行 owner task read | 不能由 workspace key 单独推出可见实体，避免同空间横向越权 |
| 详情读取 | v2 `UserManagementPage.tsx`、`StoreManagementPage.tsx`、`ContractManagementPage.tsx` 均有 list 后 detail query | v2s `WorkspaceMembershipPage.tsx`、`StoreManagementPage.tsx`、`StoreProfilePage.tsx`、`ContractManagementPage.tsx` 均已从列表点击显式调用对应 generated detail operation | 恢复 v2 的 list→detail 交互，不再把列表投影视作详情事实 |
| extension/asset 写入 | v2 `ExtensionFieldManagementPage.tsx` 和 `WorkspaceFormDrawer.tsx` 均使用 owner command | v2s `ExtensionsPage.tsx` 调 `replaceExtensionDefinition`；`WorkspaceManagementPage.tsx` 将 staged `assetRef`/`bindGrant` 作为 opaque 临时值直接交 create command；`PlatformTransport.ts` 以通用 Blob→FormData bridge 发送 | 比手写 JSON/手填 token 更可控；不增加跨 owner 直读或持久化一次性凭据 |

## CR05：写能力与页面语义闭合

| 对比项 | v2 原文 | v2s 亲验结果 | 结论 |
| 角色/账号/邀请管理 | v2 `UserManagementPage.tsx` 包含成员详情与 assignment 操作 | v2s `WorkspaceMembershipPage.tsx` 以 generated `getOperationsWorkspaceMembershipAccount` 取详情；`WorkspaceInvitationPanel.tsx` 消费 invitation list/candidate/create/cancel/reissue，page capability 从生成的 `adminCatalog.userManagementActionBindings` 读取 | 不以手写 `actionCapabilityKeys.includes('...')` 决定业务操作；能力语义只有 catalog/生成物一个来源 |
| 业务实体写能力 | v2 business/store/contract feature 有独立 update mutation | v2s brand、tenant、head-company、层级、store、contract 均接 generated update operation，并传 expected version/context version/idempotency key | 消除“冻结 operation 存在却不可调用”的假闭合 |
| 静态一致性控制 | v2 以页面/测试局部覆盖为主 | v2s operations `static-boundary.test.mjs` 对全部已批准 detail/login operation consumer 做机械断言；CR06 另以 active package receipt 对账实际变更文件 | 控制从单个页面提升为有限 operation 分母，不将其冒充为动态行为证明 |

## CR06：22 surface / 25 pageDesignKey 与 v2 交互基线

| 对比项 | v2 原文 | v2s 亲验结果 | 结论 |
| 扩展字段排序 | v2 `ExtensionFieldManagementPage.tsx` 通过 `DragSortTable` 更新 `displayOrder` | v2s `ExtensionsPage.tsx` 提供上移/下移并按 Form.List 顺序提交 `displayOrder`；编辑仍使用 ProTable + Drawer/Modal 组合 | 保留可控排序的业务结果，避免在 app 重造拖拽基础设施；排序动作更显式、可键盘/按钮触发 |
| 静态资源上传 | v2 `useWorkspaceManagement.ts` 使用 `FormData`，由页面组合 stage→bind | v2s `PlatformTransport.ts` 是仅依 Blob 形态决定的通用 multipart bridge，`WorkspaceManagementPage.tsx` 不提供手输 assetRef/bindGrant 控件 | 保留 v2 的 stage→owner command 模式，并减少每 feature 自行编码 multipart/opaque grant 的偏离面 |
| 运营登录与详情 | v2 具备 OTP tab 和详情 read hooks | v2s 已接回相同用户任务，并在 generated operation consumer static test 中纳入整个已批准分母 | v2s 保持 UI 基线，同时使用 v2s 的 generated client、owner session context 和当前契约 |

## 结论与未声明事项

CR03–CR06 的静态实现符合 v2s 的冻结契约、owner 主权和 generated-consumer 规则，并在以下可验证点严于 v2：不在浏览器显示 OTP test code、不会手填 opaque asset grant、不会以菜单/列表投影推导 session/entity 事实、所有本包补齐 operation 均有静态 consumer 分母。

本记录**不**声称 DOM、可访问性、交互时序、401 扇出、远端 Testcontainers、DEV/seed 或真实上传已通过；这些必须在 CR08 再以动态证据验证。
