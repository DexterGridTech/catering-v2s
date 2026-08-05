---
title: workspace-IAM 管理员重置凭据与强制改密状态
status: active
createdAt: 2026-08-04
decisionOwner: Dexter
implementationAuthority: true
supersedes:
  - doc/decisions/2026-07-29-v2s-rm1-ia-05-operations-users-recovery-and-home-interaction.md#administrator-resetGenerationKey-chain
---

# workspace-IAM 管理员重置凭据与强制改密状态

## 产品裁决

Dexter 裁决：运维管理后台对运营账号执行“重置登录凭据”时，密码重置为该账号的规范化登录名；该账号下次以密码或手机号验证码登录后，必须先设置新密码，不能进入任职选择、数据范围选择或任何运营业务页面。

运营端必须明确提示“管理员已将登录密码重置为登录账号，请立即设置新密码”，提供当前密码、新密码、确认新密码、提交和退出登录。该表面是居中的不可关闭强制页面，不是可取消 Drawer。新密码继续遵守至少 8 位策略；临时密码只是在已标记的强制改密状态下允许与登录名相同。

## Owner 状态机与边界

`workspace_iam.workspace_credential.password_change_required` 是唯一事实源：

`SET --管理员重置--> CHANGE_REQUIRED --本人改密或本人自助找回完成--> SET`。

管理员命令在同一 workspace-IAM 事务中以当前账号 revision 进行 CAS，写入登录名的 bcrypt hash，清除失败/锁定状态，设置标记，撤销该账号全部 ACTIVE operations session，并写幂等 receipt 与不含秘密的审计。readback 的 `credentialStatus` 为 `CHANGE_REQUIRED`；不返回临时密码、token、generation、过期时间或投递状态。

密码登录和 OTP 登录都必须投影 `PASSWORD_CHANGE_REQUIRED` outcome。任何普通 operations endpoint 经公共 session resolver 读取时都必须拒绝该状态；只有 session entry、当前密码修改和 logout 允许读取受限会话。前端分流只改善体验，绝不作为唯一强制手段。

运营账号的匿名自助找回仍以“登录名 + 本人手机号 + OTP + 自选新密码”验证本人，完成时清除该标记。它不是管理员重置的 UI 或 token 入口。platform-admin 自身管理员凭据重置是另一个 owner 事实，明确不在本裁决内。

## 退役

旧 `resetGenerationKey` 管理员链没有批准的交付或用户入口，且没有改变 credential hash 或阻断会话；它必须整体删除：公开三段 `/api/public/password-reset/{resetGenerationKey}` paths、controller、owner generation/progress state、schema、生成的 public operations、测试和引用。不得保留兼容路径、空实现或第二套管理员重置语义。

## 取舍

只在前端登录后跳转被拒绝：它会被 OTP、旧会话或直接调用业务端点绕过。继续补 token 投递链被拒绝：它增加不可达的交付依赖和第二套凭据状态。选用 credential owner 的单 flag 和 resolver 边界，既不合并双 app 的 session/router/theme，也不把权限判断下放客户端。
