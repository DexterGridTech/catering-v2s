# 前后台结构优化 · 13c 逐代码与详设对账

## 结论

`MATCHED`。本记录为 fresh 独立只读对账，reviewer 为 `/root/t1_13c_current`。未运行命令、测试、构建、verify 或环境操作；不代替整批 `REVIEW_TARGET=IMPLEMENTATION`。

## 核对范围与结论

依据当前详设 §8、§9a、§11a、§13c，实施计划 §3～10、附件 §1～5，逐项检查六个 CP 的生产接线、调用者、直接测试、生成器、fixture、seed helper、公开入口、README 与控制面。未发现当前源码偏离详设的新 finding。

| 范围 | 对账结果 |
|---|---|
| CP-01 协议 | canonical topic Set 由 Protocol 加载并由 Codec 消费；remote 六组 runtime enum/type 由同一 renderer 生成，两个生成目标当前字节一致；parser 保留 string、nullable、cancel 坐标与原消息限制。 |
| CP-02 owner 提纯 | Asset 两 wrapper 共用流物化，校验和精确文件清理仍由各 owner 路径负责；Catalog pure 类不含 JDBC、事务或 owner command，service 保持事实读取与编排。CP-01/02 对账记录中的 22 项源码/测试哈希与当前文件一致。 |
| CP-03 注册与公开边界 | Shell 实际消费菜单 selector；菜单成员由 catalog、registration 和授权决定，不以 icon 是否 truthy 决定；窄公开入口及其消费者与详设一致。 |
| CP-04 extension | 十个 Drawer 的十四个 operation 使用对象提交；false、0、DATE、CLEAR 与 omission 语义保留；七处 seed helper、edge typed mapper、消费者及旧 helper 退役状态一致。历史留痕仍为 `OPEN / DEXTER_WAIVED`，未伪造为 MATCHED。 |
| CP-05 资源边界 | 四个 read hooks 各自保持业务 identity 与 foundation guard；Page 消费新 hooks。RuleCreateDrawer 保留原 lifecycle/幂等/候选语义；launcher 是唯一当前 session owner，Workspace 捕获旧 Room 并校验异步结果资格。直接 deferred/同挂载交错测试对应当前调用链。 |
| CP-06 运行链 | admin helper 位于现有 update owner-flow 的报告读回后、最终 business PASS 前；复用同一 browser、generated operation、owner readback 与精确清理。Vitest/test-health 发现该现有入口，没有新增 runner 或 suite。 |

## CLEAR 差量读回

- `tools/terminal-automation/journeys/adminStructureDevUi.ts` 仍要求门店/合同请求分别提交 `floorLabel:null`、`signedDate:null`，同时保留 false、0 与未变字段断言。
- `ExtensionSubmissionWireMapper.java:22–31` 将 JSON null 映射为 typed CLEAR；`ExtensionDefinitionService.java:650–651` 删除字段；`BusinessEntityWireMapper.java:114–124` 只序列化已存在字段。因此成功 owner GET 应为 key omission。
- 当前 helper 的 CLEAR oracle 检查 key 缺失；其余字段值和存在性日志在断言前记录。直接测试拒绝显式 null、仍有值和非对象 readback。
- helper finally 先恢复本 run 起始字段并经 owner GET 核验，再关闭 role context、回收精确 assignment/role；没有以 runner cleanup 替代业务状态恢复。

## 运行证据边界

- 当前 console run `ccc67936-2758-45cf-90da-62c3474fff30`：manifest `FINISHED`，business/cleanup `PASS`，`firstFailure=null`。日志分别读到 `floorLabelPresent=false`、`signedDatePresent=false`，并确认 false/0 与未变字段；CBS/TDS A/B/C 诊断读取成功，生成物按 manifest 清理。
- 旧 run `e949b00d-3666-4e62-83e2-43b2a42b5061` 的 business FAIL 保持原状；旧日志未记录当时实际字段值，不能追溯宣称该次唯一根因。
- 2026-10-13 的 wallpaper update 与两个 remote PASS 均保留为历史基线，不代表 CP-05 修改后的当前浏览器行为已动态通过。
- Expo Web 本次证明更新供给、HTTP、后台 owner readback 与报告流程；不证明 Android 安装器或 Hermes/native HOT 实际应用。
- CP-04 的 `OPEN / DEXTER_WAIVED` 治理状态继续保留；未运行、历史和未覆盖边界均未升级。

`13c=MATCHED` 仅表示当前代码与详设的逐项静态对应成立，不等同于整批动态验收或整批 IMPLEMENTATION GO。
