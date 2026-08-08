# 双后台名称（编号）视觉密度实施详设

## 用户任务与推荐方案

用户在组织树、表格、详情 Drawer、下拉和范围栏中阅读实体时，名称应是主信息，编号应可核对但不抢夺视觉层级。推荐复用 foundation 新增的 `NameCodeText`/`NameCodePathText`，统一替换 75 个 formatter 调用和 2 处手拼组合；编号使用 Ant Design `fontSizeSM` token 与 `text-tertiary`。保留纯字符串 formatter 只供辅助语义。相比全局 CSS 或每页复制 `<span>`，该方案最小、可审计且不会因主题或新页面而漂移。

## 实施单元

1. Foundation：在 `libraries/frontend/admin-ui-foundation/src/presentation/nameCode.ts` 增加两个纯展示组件并从 index 导出；组件只负责名称/编号层级和 owner path 分段。
2. Platform UI：替换组织树、组织/合同概览、workspace、workspace-IAM 的 Tree/Table/Drawer/Select/Tag 展示；审计 target 继续保留 plain string metadata，审计 Modal 标题支持 ReactNode。
3. Operations UI：替换组织树、业务实体授权、合同、门店、门店 profile、workspace user、role-home data-scope 和范围 context bar 的所有视觉组合；下拉 label 接受 ReactNode，aria/tooltip 继续使用 plain formatter。
4. Machine gate：扫描所有生产 `.ts/.tsx`，禁止旧 formatter 视觉调用和模板/相邻 JSX 手拼 `name(code)`，枚举并守住 31 文件/77 producer 的共享组件覆盖，并以多种 self-test red mutation 证明门有效。

## 六类 package-exit source 对账

| 类别 | 分母/owner |
| --- | --- |
| contract | `NOT_APPLICABLE_WITH_REASON`：不改 OpenAPI/generated wire |
| owner | `NOT_APPLICABLE_WITH_REASON`：不改后端 owner |
| edge | `NOT_APPLICABLE_WITH_REASON`：不改 HTTP edge |
| frontend | foundation 2 个组件 + 两后台 29 个基线文件/75 个 formatter 组合 + 2 个手拼反例 |
| runtime | `NOT_APPLICABLE_WITH_REASON`：不启动 DEV/UAT，不改 runtime |
| evidence | 本详设、标准、checker、focused proof、独立 review、exit |

失败行为：缺失名称/编号沿用既有 plain formatter 的 `—`/单值语义；组件不得构造新业务值。验证只证明静态 source truth，不宣称浏览器 L2 或业务闭环 PASS。
