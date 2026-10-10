# TER 主副机共享终端凭证需求变更说明稿

**状态：** PROPOSED；这是需求变更输入稿，不是正式需求正本或已接受的详设。
**范围：** 阶段 C 中 TDC 凭证状态、主副机同步与副机直接调用 CBS 的接缝。
**审查周期：** `TER_SHARED_TERMINAL_CREDENTIAL_CHANGE_2026-10-10`；`REVIEW_TARGET=DESIGN`；最多两轮。完成内部两轮后，交 Claude 修改阶段 C 详设与实施计划；不重开已关闭的需求审查周期。
**执行状态：** 源码与文档静态核对；未执行生成、编译、测试、verify、DEV 或设备验收。本稿不授权这些动作或阶段 C 实施。

## 1. Dexter 的原始产品意见

> 副机就是主机的一部分，它所有的行为都代表主机，而且也拥有主机的凭证，主机获取凭证后，应该通过配对将凭证state同步给副机，副机的所有行为都代表同一个terminal，只是不同的device。后续副机也会有很多场景单独向CBS发起业务请求，不可能每次都获取主机的grant。凭证不得加密，凭证必须得同步给副机，本身终端的机器就是一个封闭的受管的环境，不是谁都能操作的，不需要过度安全设计。

随后补充的问题与答复：

- 问：为什么副机需要主机的 grant，为什么不能直接向 CBS 请求？
- Dexter 的澄清：副机应持有主机凭证状态，并以同一 terminal 身份直接向 CBS 请求；不应为了每次业务请求再向主机取 grant。

本稿将“主机 grant”解释为阶段 C 设计中的 **MASTER 代副机请求 CBS、再把授权结果中转给副机**。它与 CBS 为下载接口直接签发的短期下载 grant 是两种不同东西。

## 2. 当前设计和源码基线

以下是本稿作者重开的当前字节，不是对新需求的反证：

1. 阶段 C 详设 §8.6、§9a 将 TDC credential 设为 MASTER-only；副机通过 peer command 请求主机取得 grant，再自行下载。详设还规定凭证不下行。
2. 正式需求 R-08 说“凭证继续仅由 TDC 拥有”；R-07 当前要求主机同步规则等业务 state，并未要求同步凭证。正式需求 §0.2 将副机定义为主机扩展，且写明 CBS/TDS 不知道副机存在。
3. `apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts` 中，`TerminalCredential` 位于 TDC 的 `credential` 字段；该 slice 当前 `syncIntent: 'isolated'`，该字段登记为 `protection: 'protected'`。
4. 同文件附近已有可复用的状态同步范式：`terminalClientStatusProjectionStateSlice` 以 `master-to-slave` 的 record projection 同步有限字段。整份 TDC state 还含本机连接、心跳、topic 订阅和 remote operation 状态，不能因为凭证要共享就把整份 slice 无差别投影。
5. `terminalDataClientActor.ts` 中 `readTerminalDataCommand`、`requestTerminalUpdateDownloadGrantCommand`、`submitTerminalUpdateReportCommand` 等当前先要求 `isHostRuntime`，再使用凭证构造认证请求。`activateTerminalCommand`、TDS 连接和 topic 操作也有主机角色检查。
6. TDC 认证请求使用 credential 中的 `bindingGeneration`、`credentialSecret`、`terminalRef` 和绑定时的 `deviceId`。CBS 的 `TerminalCredentialVerificationApi.Credential` 同样要求 `deviceId`；`TerminalCredentialDecision.classify` 对有效绑定校验它等于服务端当前绑定设备 ID。因此，共享凭证请求代表同一 CBS 绑定；不能把副机本地设备 ID 擅自替换进该认证字段。
7. Android `protected` storage 实际使用 `persistSecure`，native `TerminalPersistKvModule` 为之提供 MMKV crypt key。若严格落实“凭证不得加密”，这会改变当前凭证持久化登记；不能只在说明中说“明文同步”却保留对凭证值加密的持久层。

## 3. 变更目标与初步设计建议

### 3.1 身份与 owner

- 逻辑上仍只有一个 terminal binding。MASTER 激活得到的 credential 是该绑定的唯一权威值；TDC 继续是 credential 生命周期、命令与 selector 的 owner。
- 同 App 配对成立时，MASTER 经现有 topology state-sync 通道把 TDC credential state 同步到 SLAVE。SLAVE 保存的是同一凭证值的本机副本，不是另一个 binding、另一个 generation 或独立激活流程。
- 主、副机拥有不同的本地 runtime/device/topology identity；CBS 认证仍使用共享 credential 内的绑定身份。CBS 按一个 terminal binding 处理两端请求，不创建第二台 CBS terminal 记录。
- 不同步 activation code、尚未完成的 activation operation、TDS socket/session、PING/PONG、topic pending、连接延时样本、各机 update task/actual version 或报告队列。它们不是共享 credential state。

### 3.2 同步与加密

- 使用现有 MASTER→SLAVE 配对 state-sync 能力，只投影 `credential` 这一项；优先在现有 TDC slice 中投影，不新增 credential owner、第二 credential store 或独立 peer grant command。
- 凭证值不做应用层/字段级加密，不增加加密 envelope。按 Dexter 的字面裁定，TDC 凭证持久化也不再使用 Android `persistSecure`/MMKV crypt-key 路径，而使用现有 plain persistence port。现有 HTTPS、WebSocket 或 topology 传输配置不因此另作修改。
- `credential=null` 与新 binding generation 通过同一权威投影同步，不能把旧 generation、旧 secret 与新 terminalRef 拼成一份凭证。主机取消激活后，凭证清除结果向副机同步。
- 副机完成同步和本地持久化后，后续 CBS 请求只依赖自己的当前 TDC credential 与自身网络配置，不要求主机在线或每次保持配对链路；服务端仍以当前 binding 校验每个请求。
- 凭证原值仍不得写入日志、截图、run manifest 或验收报告；这是现有诊断脱敏要求，不是对凭证加密或增加访问控制。

### 3.3 副机直连 CBS

- 配对同步到有效 credential 后，SLAVE 上的 TDC 可执行已有的、使用 terminal credential 的 CBS HTTP command，并通过其本机网络配置直接连接 CBS。请求不先经 MASTER 代理；不要求每次请求先向 MASTER 取授权。
- 终端凭证认证本身仍由 CBS 在每个请求上按当前 binding/generation/secret/绑定设备身份核验。同步 credential 不跳过 CBS 的现有 owner 校验，也不新建通用授权机制。
- 主副机 command 范围按当前 TDC 实际 HTTP catalog 逐项闭合：九个 `terminalRead*`（`terminalReadContract`、`terminalReadProjectUpdateRuleSnapshotPage`、`terminalReadServicePoint`、`terminalReadServicePointArea`、`terminalReadStoreActiveContracts`、`terminalReadStoreBasic`、`terminalReadStoreOrganizationPath`、`terminalReadStoreServicePointAreas`、`terminalReadStoreServicePoints`）与 `issueTerminalUpdateArtifactDownloadGrant` 可由已配对且持有当前 credential 的任一端直接请求 CBS；`activateTerminal` 仍由 MASTER 建立首份凭证；`submitTerminalUpdateReport` 暂按现有 R-15 保留 MASTER-only，避免在本需求未明确报告语义前把不同设备的本机版本覆盖到同一“最后主机版本”事实；`cancelTerminalActivation` 的调用端资格需 Claude 在现有取消激活/撤销通知闭包中明确，不能只凭删除 `isHostRuntime` gate 推断安全。将来新增的 CBS terminal-authenticated business commands 由 TDC 使用共享 credential 直接发出，不要求引入按请求 grant 中转。
- 对于下载：副机可直接请求 CBS 现有 `issueTerminalUpdateArtifactDownloadGrant`，取得 CBS 对该 artifact 签发的短期下载 grant，然后由副机按原下载、摘要校验与安装流程执行。删除的是 **MASTER→SLAVE 的 grant 中转**，不是擅自删除 CBS 当前下载 API 所需的短期 grant。
- 激活仍由 MASTER 建立首份 credential；SLAVE 没有 credential 时不能自行启动新的 terminal binding。不得借此增加 UI 入口。
- Stage C 既有“副机不连接 TDS、各机版本事实和本机任务独立”的边界暂不改变。凭证共享只解决共享 terminal 身份下的 CBS 直连；不自动把 TDS WebSocket、PING/PONG、topic ownership 改成双连接。

### 3.4 生命周期与最小判据

1. MASTER 激活成功并完成当前 credential 持久化后，配对副机最终读取到字段完全一致的凭证 state；未配对或不同 App 的 peer 不收到该 state。
2. 同一已配对副机在重连/重新同步后恢复当前 credential，不要求重新向 MASTER 取 grant。
3. MASTER 取消激活或 credential 被新 generation 替换后，副机应用相同的 null/新 credential 投影；旧凭证直接访问 CBS 被拒绝，不能回写覆盖新 credential。
4. 副机使用自己本地的 TDC command 和 server-config/network adapter 直接调用一项普通 CBS 业务 GET；在调用链中没有 MASTER peer request，且主机 runtime 停止时仍可完成请求。更新下载场景再证明副机自行向 CBS 请求短期 download grant。当前九个 GET 及 grant operation 逐项列在 §3.3；新增操作沿同一 TDC credential 路径。
5. 两端物理 device/runtime identity 不同，但请求使用凭证中原绑定 deviceId；CBS 仍读回同一个 terminal binding。若需要 CBS 对调用来源设备做区分，必须另有明确业务字段与需求，不从本次“共享同一 terminal credential”暗造第二 binding。
6. 旧主机 grant 中转 command 不再被副机路径调用；不为兼容保留新的并行授权路径。

## 4. 方案比较

| 方案 | 适配 Dexter 目标 | 复杂度/影响 | 初步结论 |
| --- | --- | --- | --- |
| 保持 MASTER 代办并逐次发 peer grant | 否；每项副机 CBS 业务都依赖 MASTER 在线且逐项中转 | 继续保留现有 peer command、grant 生命周期和换 peer 失效接缝 | 拒绝 |
| MASTER 激活并同步同一 credential；SLAVE 直接调用 CBS | 是；复用配对 state-sync、TDC credential 与 CBS 现有请求/绑定核验 | 改同步字段和当前 MASTER-only HTTP gate；无需第二 store 或授权服务 | 推荐 |
| SLAVE 单独激活或从后台再领凭证 | 否；会创建第二 binding/credential 生命周期，偏离“同一 terminal” | 改 activation、CBS owner 与管理流程 | 拒绝 |

## 5. 变更对照范围

以下是给 Claude 修改 Stage C 详设与计划时的待同步接缝；本稿不直接编辑正式需求、Stage C 详设、计划或源码：

- 正式需求 R-07/R-08 中的 credential sync/owner 表述需要由需求 owner 后续同步；当前需求正本明确要求“TDC 独占凭证”，本稿是拟议变更，不能冒充已经接受。
- Stage C 详设 §3、§7、§8、§9a、§10b、§11a 中 MASTER-only TDC、凭证不下行、peer grant、凭证零同步，以及副机 grant 场景需要按本稿调整。
- Stage C 实施计划 CP-04 及跨 CP 对账/验收映射需要改成：credential 同步到同 App SLAVE、SLAVE 使用 TDC command 直连 CBS、分辨 CBS download grant 与 MASTER 中转 grant。
- Journey/IA/UI 中若只呈现终端操作结果而不显示 credential，则无需添加凭证界面；本变更不增加设置页、授权弹窗或手工重试入口。
- `terminalDataClientActor` 的 MASTER-only gate 只对本稿覆盖的 terminal-authenticated CBS HTTP commands 重新分类。激活 bootstrap、TDS 连接/协议等边界不得被“直连 CBS”一并误改；具体全集须由 Claude 对现有 command catalog 逐项列清。

## 6. 需独立审查的设计风险

1. **同步闭包：** 仅投影 credential 是否能复用当前 record state sync 且不投影其他 TDC 字段；断开/重连及解绑后的副机 state 行为是否已在既有 topology lifecycle 内有明确答案。
2. **设备身份：** CBS 目前按凭证中的绑定 deviceId 验证。副机直接请求代表同一 binding，但服务端不能仅凭该字段识别物理来源。应确认这符合“同一个 terminal、不同 device”，而不是擅自增加设备登记或改服务端绑定语义。
3. **持久化字面含义：** “凭证不得加密”按本稿解释为现有 TDC credential persistence 从 protected/crypt-key store 改用 plain store，且配对 payload 不做应用加密。请 reviewer 查明该范围是否准确复述 Dexter 原意；不能弱化成“只是不做另一层加密”。
4. **CBS 操作全集：** 当前九个 `terminalRead*` 与 `issueTerminalUpdateArtifactDownloadGrant` 按本稿允许两端直调；`activateTerminal` 仍为 MASTER bootstrap；`submitTerminalUpdateReport` 保留 R-15 的 MASTER-only；`cancelTerminalActivation` 留给 Claude 对照撤销通知与双向 state-sync 闭包明确调用端。将来新 CBS operation 不逐次向 MASTER 取 grant。TDS WebSocket 命令与 CBS HTTP 命令分开，不由名称相近推导同一角色规则。
5. **报告身份：** 现有阶段 C 需求规定仅 MASTER 向 CBS 报告实际版本。共享凭证使副机具备直接调用能力，但不会自动改变该产品判据；如果有人主张副机报告，必须说明同一 binding 下不同本机版本如何映射到现有“最后主机版本”事实。本稿暂不改变该报告语义。
6. **现有测试判据：** 应至少覆盖绑定凭证同步前后、配对重连、取消激活传播、旧 generation 拒绝、同一 CBS binding、不同物理设备 ID、普通 CBS 业务 GET、branch 自取 CBS download grant、无 MASTER 中转，以及日志/manifest 不含凭证原值。全部目前为设计建议，尚未实现或运行。

## 7. 明确不在本稿内的内容

- 不改阶段 A/B/C 的业务范围、FULL/HOT 选择、设备更新状态或 CBS/TDS 数据模型；仅在本稿明确的凭证及副机 CBS 请求接缝上提出变更。
- 不新增 terminal binding、第二凭证 owner/store、共享授权服务、grant broker、消息队列、恢复框架或新 UI。
- 不据此开放跨 App 配对、不同 terminal 共享凭证、TDS 双连接或批次外 CBS API。
- 不改正式需求正本；待 Dexter/Claude 对本变更输入完成处置后，再由需求 owner 决定是否同步正本。
- 不授权源码实施、生成、构建、测试、verify、DEV、reset/seed、L2、UAT、部署或设备操作。

## 8. 当前结论与证据边界

- 当前阶段 C 的 peer grant 方案是从“凭证不下行、TDC 仅 MASTER 认证”推导出来的；它不是 CBS 强制要求。按 Dexter 新意见，推荐改为同步同一 TDC credential state，副机直接使用现有 CBS terminal-authenticated API。
- 该变更会放宽当前需求和设计中的 TDC 主机限定，并改变 Android credential persistence 的 protected/plain 选择；这是明确的需求变更，不是可在实现中暗改的局部修补。
- 本稿没有证明投影代码已存在、完整 TDC operation set 已接通、服务端已允许副机请求或任何运行场景已通过。所有实现与动态结论均为 `NOT_RUN`。

