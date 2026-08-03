# U22 运维后台邀请读回与可诊断命令

用户任务是在运维管理后台查看、核实并处置当前集团空间邀请；手机号为运维记录事实，须明文显示，详情须显示不可变的发起人名称。运营管理后台和公开邀请面不是本包消费者，保持原有脱敏 `WorkspaceInvitation` 投影。

最小方案是 owner 保存邀请创建时的发起人显示名快照，并由平台专属 OpenAPI/mapper 输出 `mobile` 与 `issuerDisplayName`。共享 mapper 继续仅输出 `maskedMobile`。这是比把明文塞进共享 DTO 或从 audit 反查更小且正确的替代：前者会扩大运营面，后者不能保证是创建人事实。

取消/重发在 UI 先取得最新 owner detail/readback 所用版本，失败显示 owner problem，成功以命令 readback 刷新详情和列表；不吞异常、不用旧列表版本作为唯一 CAS 来源。邀请手机号搜索则先去除空格、连字符和首位 `+`，再直接匹配 owner 的 `mobile_normalized`；脱敏字段只用于运营及公开面展示，绝不参与过滤。平台 session 与 enabled-workspace 校验、无 workspace capability 映射保持不变。
