---
id: decisions.v2s-terminal-activation-and-connection-journey
title: Terminal activation, connection and store-terminal type display Journey
type: journey-decision
status: IN_DESIGN
scope: terminal activation feature; batch 1 UI delta is store-terminal edit only
owner: Dexter
createdAt: 2026-09-26
source: doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md#13
---

# Journey 裁决：TERMINAL-ACTIVATION-AND-CONNECTION 终端激活与连接

## 1. 裁决元数据

```text
JOURNEY_ID=TERMINAL-ACTIVATION-AND-CONNECTION
STATUS=IN_DESIGN
SKILL_USED=NONE
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md
```

## 2. 用户任务与成功结果

| Actor | 此刻任务 | 成功结果 | 失败后仍成立的事实 |
|---|---|---|---|
| TER runtime（本期由 node 测试/脚本调用 command；没有设备侧 UI） | 把设备绑定到已预配置的门店终端 | 业务后端读回 binding generation；终端凭证可认证 TDS | 未成功的操作不改变绑定、generation 或审计；已有 binding 不被失败请求替换 |
| 门店设备 | 保持已激活终端在线 | 同一会话持续 PING/PONG；认证通过的新连接立即取代同终端旧会话 | 普通断网、服务暂不可用或终端/门店停用不误清除本地身份 |
| 运营人员 | 核实或解除一条终端绑定 | 现有终端详情只读返回激活状态；后台取消激活按当前 generation 生效并有审计 | 无权、跨店或 generation 已变化时无写入 |
| 运营人员 | 编辑现有终端规则时确认设备形态 | E01 显示创建时的类型为纯文本；保存其他字段不更改该类型 | 创建 C01 仍可选择类型；现有功能配置与类型保持一致 |
| 设备操作者 | 在线或离线退出终端 | 在线时服务端解绑并清本地身份；离线时只清本地身份 | 在线失败时保留身份，不自动转成离线取消 |

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时的行为 |
|---|---|---|---|---|---|---|
| 身份 | 设备操作者（激活） | 无登录会话；提供集团空间编码、激活码 | `ESTABLISHED_SOURCE` | 终端 command 与现有运营终端配置 | 需求 R-1.1～R-1.3；门店终端需求 R-8.6；corpus G-10 | 按 R-1.4 返回对应结果，不创建绑定 |
| 入口 | 设备操作者（激活） | 本期没有设备侧 UI；设备 command 仅由 node 测试或双端脚本调用，未来 UI 操作入口不在本 Journey | `ESTABLISHED_SOURCE` | 原始需求第 5 条 | 需求 §13.3；原始需求第 5 条 | 不产生本期设备侧页面或用户入口 |
| 访问资格 | 设备操作者 | 拥有本地设备身份和装配层安全随机源 | `ESTABLISHED_SOURCE` | 平台 DevicePort 与装配层 | 需求 R-2.1、R-9.5、R-9.8 | 随机源不可用则不发送请求，明确失败 |
| 设备事实 | 设备 | `deviceId`、设备形态、`appVersion` 与每次激活操作生成的安全随机秘密 | `IN_SCOPE_PRODUCED` | DevicePort 与 command 装配层 | 需求 R-1.1、R-2.1、R-9.5 | 缺字段或随机源不可用时，不发送激活请求 |
| 业务数据 | 设备 | 对应 terminal 存在、类型匹配、尚可激活 | `ESTABLISHED_SOURCE` | store-terminal owner 与 terminal-binding owner | 需求 R-1.3～R-1.6、R-8.4 | 按已裁决优先级拒绝，原 binding 不变 |
| 身份 | 设备（长连接） | 最近成功激活返回的 ref 与 generation 加本次秘密 | `IN_SCOPE_PRODUCED` | activation HTTP 成功响应与设备本地合成 | 需求 R-1.7、R-2.1 | 不发首帧；认证失败按 R-4.6 保留或清除身份 |
| 入口数据 | 设备（连接） | 当前 TDS 地址列表 | `ESTABLISHED_SOURCE` | 装配默认值与 server-config 覆盖 | 需求 R-11.2～R-11.3，D-11、D-31 | 批次一无设备端配置包；批次二由 server-config/transport 执行重试 |
| 身份与访问资格 | 设备（设备取消激活） | Authorization credential 与绑定 generation 匹配 | `IN_SCOPE_PRODUCED` | 激活 | 需求 R-3.1、R-4.7 | 错误凭证不改变状态、不写审计 |
| 操作重试 | TER runtime（激活） | 同一次操作的所有请求复用同一设备生成的秘密；执行器重发仍带同一秘密 | `IN_SCOPE_PRODUCED` | command 开始时生成；业务后端按摘要识别 | 需求 R-1.6、R-2.1、V-B13 | 当前有效代次且设备相同则原样成功；最近已结束代次返回「本次激活已失效」；其他请求按新激活判定 |
| 持久身份 | TER runtime（重启后） | 当前 generation 与秘密保存在 server-config 管理的终端凭证状态中 | `IN_SCOPE_PRODUCED` | 激活成功后由批次二 terminal-data-client/state 持有 | 需求 R-9.6、R-10.5、D-31 | 本批不实现终端持久化；批次二须遵守 state 重置保留范围，不可退化成额外 credential store |
| 身份 | 运营人员 | operations-admin 有效会话与现有门店终端写权限 | `ESTABLISHED_SOURCE` | 当前终端管理页面与共享授权解析 | corpus G-05；门店终端需求 R-9.4～R-9.6 | 拒绝且无写入 |
| 入口数据 | 运营人员（后台取消） | 当前详情读回的 generation | `IN_SCOPE_PRODUCED` | `getOperationsStoreTerminal` 详情 | 需求 R-3.2、R-3.7 | generation 不符返回“绑定已变化” |
| 业务数据 | 运营人员 | 门店在现有授权范围且状态可用 | `ESTABLISHED_SOURCE` | organization/store-terminal owner | 门店终端需求 §7；需求 D-17、D-21 | 详情与后台取消激活按现有规则不可用 |
| 访问资格 | 运营人员（编辑/后台取消） | 有所选门店的终端页面读权限；`EDIT_STORE_TERMINAL` 只控制写动作，详情读回不新增读 capability | `ESTABLISHED_SOURCE` | TER-P01、TER-E01 与现有 operations-admin 授权解析 | 门店终端需求 R-9.4～R-9.6、D-1；交互工件 TER-E01 | 无读权限不见页面；无写权限不出现保存或后台取消入口 |
| 入口数据 | 设备操作者（在线退出） | 当前环境下业务后端地址及其有效代理；离线退出不依赖后端地址 | `ESTABLISHED_SOURCE` | 装配默认值与 server-config 覆盖 | 需求 R-10.1、R-11.2、R-11.9 | 在线失败则身份保留并报错；操作者可明确选择离线退出 |
| 持久状态 | TER runtime（重启或取消激活后） | 当前凭证代次与秘密按 server-config state 持久化；取消激活只清凭证 slice，保留 server-config 的环境与服务覆盖 | `IN_SCOPE_PRODUCED` | 批次二 terminal-data-client/state 与 server-config | 需求 R-9.6、R-10.5、D-16、D-31 | 重启按 R-9.6 的精确保留范围恢复；不得引入第二份 credential store |
| 操作重试 | TER runtime（激活） | 一次 command 调用与执行器换地址重发都复用同一设备秘密；生成新秘密即为新操作 | `IN_SCOPE_PRODUCED` | command 入口生成秘密；后端摘要识别代次 | 需求 R-1.6、R-2.1、V-B13 | 当前代次摘要与设备相同即原样成功；否则按 R-1.4 顺序并检查最近一个已结束代次 |

## 4. 任务边界、非目标与禁推

- 范围内：激活、设备取消激活、后台取消激活、绑定读回/审计、单节点 WebSocket、创建终端后的类型不可变、现有编辑 Drawer 的只读类型展示。
- 非目标：终端侧用户界面、管理端取消激活页面、多节点 TDS、Doris 历史、topic 同步、双机激活策略。
- `server-config` 没有被取消：属于本期整体的批次二，本批不创建或修改 TER 包。
- 不从“已连接”推导设备业务资格，不因终端/门店/集团空间状态变更关闭已建立的会话；这些状态只在激活与新建连接时检查（D-21）。
- 不从列表选择、当前 URL 或测试种子推导 actor 权限；不从类型文字推导可写字段；不把失联当作用户离线取消激活。
- 不以 seed、测试夹具、直接数据库写入或测试代码代发通知替代真实 owner HTTP 命令与真实 WebSocket 交互；不得以绕过凭证检查、放宽首帧/状态断言或手工构造 binding 作为伪修复（需求 R-14）。
- 不用既有的 CP-07 实施批次隐式归并：D-18 改动的实现与验收归终端激活批次一，旧 CP-07 只作为被本批 overlay 修订的工件来源。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
|---|---|---|---|---|
| 集团空间编码 | `project-memory/decisions/confirmed-business-language-corpus.md#G-10` | 只标识路径中的集团空间，不自动授权 | 无 | 否 |
| 门店与集团空间状态 | 同文件 G-03/G-05/G-10 | 按需求的先后次序检查 | 无 | 否 |
| 设备形态/终端设备类型 | 门店终端需求 R-C.5、D-18 与需求 R-1.2/R-8.4 | 创建时闭集一致；终端编辑只读 | 旧“可修改”表述已由 D-18 取代 | 否；D-18 已裁决 |
| 登录与后台授权 | 同文件 G-05 | 设备激活公开；operations-admin 后台命令继续使用现有会话权限 | 无 | 否 |

## 6. UI 适用性与后续工件

`UI_BEARING=true`，但本批唯一 UI 行为变化是既有 TER-E01 的设备类型由可编辑选择器改为 read-only text；没有新路由、页面或动作。创建态控件使用 `Radio.Group`，编辑态无选择器。更新请求契约不含 `deviceType`；旧请求携带该字段由 controller `strictBody` 按未知字段拒绝，owner 不执行更新且终端配置、版本不变；不另建 owner 专属错误码。需求 D-24 已明确此项不单独交 Dexter 进行交互确认。本次随批次一提交更新后的 IA、交互工件、详设和 L2 重新准入；不改变 TER-C01/C02 的创建类型选择。

### 6.1 管理后台交互一致性

按 `doc/platform/frontend-coding-standard.md` §3-K-1～§3-K-10 检查 TER-E01。布局与值来源见交互工件 D-18 overlay；本字段是展示节点，不是按钮或输入控件，没有 testId action。测试观察绑定到 `TERMINAL_DEVICE_TYPE_READONLY`，且该节点不进入 `actionControlKeys`。其余编辑 Drawer 的 dirty ownership、错误焦点、权限、加载、保存、版本冲突行为沿用当前 TER-E01 工件。

## 7. Dexter 裁决

- 裁决：D-33/D-34 已授权进入批次一详设、实施计划、实施与规定验证，且批次内工作无需另行授权；本文件是该阶段的 Journey 输入，不构成额外的单独接受门。service-shape decision 已由 Dexter 于 2026-09-26 接受，状态为 `ACCEPTED`。
- 精确范围：终端激活与连接任务，以及批次一的终端类型只读 overlay。
- 已知前提：D-18、D-21、D-24、D-31、D-33、D-34 已在需求正本裁决；server-config 仍属于批次二。
- 未决项：无新增产品语义；详设指出的需求缺陷仍按 DEXTER_DECISION 单列。
- 后续允许动作：D-33/D-34 已直接授权批次一实施与规定验证，按详设/计划中的 CP、整体对账和各动态准入条件推进；Dexter 已明确无需再交 Claude 复评。不得扩展到生产部署、UAT、设备操作或批次二/三。新出现的产品语义冲突须列为 `DEXTER_DECISION`，不可由实现者自行补义。
