# TER 重点代码结构 T1 正式需求独立静态评审

## 评审结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO
M/S/N=0/0/0
REVIEW_CYCLE_STATUS=此前内部 DESIGN cycle 保持关闭；本次外部需求评审未重开该 cycle
```

正式需求 SHA-256：`b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e`，与本次转交的 SHA 一致。

本结论表示《TER重点代码结构T1优化》正式需求在静态层面完整、内部一致且可进入后续详设；不表示当前源码已按 T1 完成，也不授权详设、实现或动态验证。

## 独立性与阅读顺序

本评审先按仓库入口恢复当前规范和记忆，再形成独立判断，最后才读取历史评审、作者 intake 和讨论稿其余分析：

1. `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`scripts/README.md`、`CLAUDE.md`。
2. `project-memory/index.md` 全部 kernel、`project-memory/decisions/deterministic-context-only.md`，以及六维路由命中的适用原文和相关 sourceRefs。路由结果用于定位规范，不作为授权或评审结论。
3. `doc/platform/terminal-coding-standard.md`、`doc/platform/foundation-charter.md`、`doc/platform/review-standard.md`、独立审查治理文件及适用模板。
4. 正式需求全文；讨论稿 §1、§11、§13.1 的用户原话、答复及最终澄清；结构清单 JSON。该 JSON 仅作为导航快照，不视为逐分支审计。
5. 按需求引用检查 contracts/runtime/state、TDC、transport、server-config、topology、store-basic/project-basic、两个 integration、UI 装配和相关生成器的当前源码，判断既有能力和接缝是否可达。
6. 在独立判断形成后，才阅读 R1、R2、finding intake 及讨论稿剩余作者分析进行差异核对。没有用历史 GO 或作者处置替代本次判断。

另由 fresh 只读子审查者 `/root/blind_t1_requirements_review` 对需求和当前源码独立形成盲审结论，结果为 `GO, M/S/N=0/0/0`；其检查未发现需求层阻断。本次报告记录该独立复核，但不将其称为新的内部 DESIGN 轮次，也不改变既有 cycle 状态。

## 方案合理性

需求针对的是长期维护中的真实结构成本：包职责、模块声明、状态同步资格、外部 API 归属及配置地址存在重复事实或第二名单风险。需求用可检查的行为和归属规则约束这些问题，没有把“减少文件/目录/行数”当作目标，也没有要求每个包都创建固定空文件或为每个 actor 拆出强制的一文件一 actor 结构。

现有代码提供了可复用的落点：Runtime 已接收显式加载的模块集合、按依赖解析模块顺序并收集已加载模块的状态切片；state slice owner 已能声明 `syncIntent`；feature assembly 已从实际 command、actor 和 slice 定义派生部分模块元数据。由此可在保留显式应用装配边界的情况下，减少重复手工清单，而无需动态扫描、超级 registry 或自动引入任意包。

需求同时保留了必要区分：模块自己的声明与行为可以随模块定义聚合；应用阶段策略和环境输入仍属于 composition；owner 的同步资格声明不替代具体业务读取所需的 required projection；A 包调用 B 的业务仍走 B 的 command/selector；transport 继续负责其既有连接与传输职责。上述边界没有形成已证实的依赖环或不可达接缝。

## 九项独立核验

| 核验面 | 结论 | 证据与边界 |
|---|---|---|
| 1. 全包逻辑盘点与验收 | 无 finding | R-02/V-01 以模块职责、事实、调用路径和判据为盘点对象；需求明确说明 inventory JSON 的数量是静态导航快照，不能代替逐项语义核验。逐分支盘点和实施前后差异属于后续详设/实施工作，不要求本需求评审假称已审遍全部源码。 |
| 2. 声明、actor、slice、selector 的拆分 | 无 finding | R-03/R-04、V-02/V-03 区分模块声明与具名业务定义，并保留一个 actor 作为其并发、资源及生命周期 owner 的合法形态。需求没有把拆分本身等同于消除大 actor，也没有用目录/文件数量设伪目标。 |
| 3. errors、静态参数及协议常量 | 无 finding | R-05/R-06、V-04/V-05 区分失败类型、静态 ParameterDefinition 与协议常量，未要求恢复动态 catalog，也未要求无业务内容的空文件。后续设计仍须列清现有错误与调用方映射。 |
| 4. 包加载、装配与政策住址 | 无 finding | R-08/R-10、V-09/V-10/V-16/V-18 保留应用显式选择已加载模块的权力，同时要求模块贡献自身声明和行为。Runtime 的显式模块输入与依赖解析仍可保留；需求不要求全仓自动发现，也不要求把 application policy、外部环境或 composition 注入搬进 package。 |
| 5. 同步资格与 required projection | 无 finding | R-09、V-11/V-12 将 owner 声明的可同步资格与业务必需投影分开；主副权威、断链遮罩和本地 admin 恢复仍有明确验收边界。owner descriptor 不被误作“同步事实全集就是当前业务所需数据”。 |
| 6. 外部 API、业务调用与凭证边界 | 无 finding | R-07、V-06～V-08 要求外部 API 由消费业务包拥有其声明、生成和消费；跨包业务调用继续经过 owner 的 command/selector。当前 TDC 仍是唯一 credential owner，transport 定位不变，TDC 不继续充当全业务 API 目录。共享认证/凭证执行接口的精确接法由 R-16/§7.2 留给详设，未构成正本遗漏或产品语义悬空。 |
| 7. 可变 serverSpaces 地址集合 | 无 finding | R-11、V-13/V-14 取消 One/Two 命名模式和旧固定数量限制；transport 已消费地址数组，server-config 现有范围校验和两个 integration 的 DEV 双 TDS/代理地址仍可作为当前配置事实。需求不扩张 DEV 拓扑、不引入服务发现。 |
| 8. 版本、持久化键、任务、boot、凭证及 reset | 无 finding | R-12/V-15 区分 App/协议/原生版本等事实住址，并将正常恢复、解绑/换主与取消激活 root reset 的保留/清除边界分开。当前 TR-09 已有具名 retain 机制可供后续实施遵循；需求没有将“正常恢复保留”错误推广为 root reset 保留。 |
| 9. 规范、生成、公开边界、README、测试与映射 | 无 finding | R-13～R-17、V-01～V-18 将正本更新、生成器/公开边界、README、测试与验收映射纳入可执行后续工作，并明确区分需求目标与详设决定。当前生成器只有 TDC 一个 target、integration 仍有显式同步名单，均属于本需求准备消除的现状，不是需求要求保留的限制，也不说明目标不可达。 |

### Finding 清单

无需求层 finding（`M=0, S=0, N=0`）。逐项核验没有发现相互矛盾的要求、无法抵达的 owner 接缝、要求复制凭证/业务事实的冲突，或必须由 Dexter 新作产品裁决的事项。

当前源码中的重复同步名单、TDC 集中生成 target、server-config 的旧地址数上限等是被审需求明确指出并安排治理的现状；不能因当前实现尚未变化而把目标当作缺陷。反过来，本结论也不证明这些整改已完成。

## 后续详设义务与未验证事项

`DESIGN_GAPS=NONE_AT_REQUIREMENTS_LEVEL`。

进入详设时必须具体闭合但不构成本轮需求阻断的事项包括：

- 模块声明、实际定义、公开边界和 codegen 的 canonical 输入及派生顺序；
- 生成 API 按消费 owner 拆分时，唯一凭证 owner 如何提供窄而可调用的认证执行能力，避免凭证副本及 TDC 全量业务 API 目录；
- 跨包操作的具体 command/selector、状态 owner、启动依赖、环境地址注入及错误映射；
- owner 可同步全集与具体业务 required projection 的逐项表；
- 受影响包、生成产物、README、测试及 automation driver 的完整实施范围和 R/V 到场景的逐条映射。

这些是 R-16/§7.2 及相关后续设计工作，不得在详设中退化成默认实现假设。若详设发现必须改变已确认产品语义，再交 Dexter 裁决。

本轮仅进行静态需求与源码可达性检查。生成、类型检查、构建、测试、verify、Web、Android/设备、DEV、reset/seed、L2、UAT、部署及运行 evidence 均为 `NOT_RUN` / 未读取；它们不是本次需求 GO 的前置条件，也不能据此推断实现通过。未选择新增第三方 API，故本轮不涉及实际解析版本/API 行为核验。

## 审查模板覆盖

- L1 Engineering：`PASS`（本需求有明确目标、owner/边界约束、R/V 判据和后续设计交接；不是实现完成证明）。
- L2 User-visible：`NOT_APPLICABLE_WITH_REASON`（本正式需求不增加新 UI、页面或用户流程；已有 Journey 的未来实现仍按 V-16/V-17 验证）。
- L3 Implementation status：`UNVERIFIED / NOT_RUN`（本轮是需求评审，不审实现验收结果）。
- Journey、IA、UI interaction、implementation-facing detailed design 模板：本轮 `N/A`，因为这些是后续详设工件，且本轮正式需求未提出新的 UI-bearing Journey。对应设计义务在 R-16 中保留。

## 历史评审对照（仅作边界说明）

历史 R1 的 V-15 问题来自旧 SHA 下把合法恢复与取消激活 root reset 混写为“不丢凭证”。当前正式稿已按不同事件拆开预期，当前 SHA 与转交 SHA 一致，因此该旧 finding 不再适用于当前字节。

历史 R2 对当前 SHA 给出 GO。独立复核与本次结论一致；这只是差异核对，不是沿用历史 verdict。此前内部 DESIGN cycle 继续保持关闭，本评审没有开启第三轮。

## 交付结论

当前正式需求静态评审为 `GO, M/S/N=0/0/0`。方案能够针对重复事实与职责外置问题给出可实施目标，同时保留 owner、应用装配、同步投影、凭证及 root reset 的边界。可进入下一项单独授权的详设工作；本报告本身不构成该授权。
