---
title: 日志、诊断与执行验收强制标准
status: DEXTER_ACCEPTED
createdAt: 2026-07-29
decisionOwner: Dexter
implementationAuthority: true
---

# 日志、诊断与执行验收强制标准

## 1. 裁决

所有脚本、业务代码与支撑代码都必须在其实际运行边界提供合理且必要的诊断能力，用于追踪问题、判断执行阶段与效率，并且统一遵守冻结的 `logging-and-debugging-foundation-standard`。这不是仅对某一 P6 功能或某一次测试的建议，而是后续设计、实施、测试、review 与 package-exit 的共同验收条件。

已经发现的运行或业务路径即使原本不在当前 feature 的显式 change surface，只要缺少满足本标准所必需的日志/诊断能力，也必须在当前工作中补齐；不需要再次向 Dexter 单独索取“是否允许添加日志”的授权。该授权不改变业务 Journey、owner、公开协议、数据或 Roadmap 状态，仍须遵守相应的设计、权限、隐私和 package-exit 边界。

## 2. 强制执行规则

1. 业务代码不得以 audit、异常 response、测试输出或临时 `System.out/console` 代替运行诊断。后端必须通过 `platform-foundation` 的统一 correlation/request context 与安全结构化日志入口；两个 admin 必须通过 `admin-ui-foundation` 的统一日志/请求诊断能力。
2. 每个认证、授权、凭据、公开入口或其他安全敏感操作必须记录可关联的固定 operation/route、owner、phase、outcome，失败补 status/errorCode；严禁记录密码、密码 hash、验证码、token、cookie、Authorization、手机号明文、登录名、原始 IP、raw request/response 或可反推账号存在性的字段。
3. 受管脚本必须在开始时创建 run-scoped manifest，并在运行中产生可读取的阶段/心跳、受控 process identity、run-scoped log path 和失败边界。超过 30 秒的执行必须依据这些日志报告进度；无新日志是待诊断信号，不是等待、增大 timeout 或盲目重试的理由。
4. 测试、动态验证和 package exit 必须实际读取对应 run-scoped 日志，分别判定 firstFailure、lastKnownGood、brokenBoundary、business 与 cleanup。仅有 exit code、全绿测试名、静态 gate 或事后复制的日志都不足以证明执行过程和结果可验收。
5. 每个新增或修复的日志/诊断路径须有正向证明与敏感字段/缺阶段/失联 runner 的真实 red mutation；纯机械可判定的约束进入既有 machine control，语义充分性进入明确 review checklist，二者不得互相冒充。
6. 每个受管长运行启动前必须按 manifest 明确 owner 做资源预算预检：本机 PID+OS start token，远端 host+PID+boot id+start ticks；历史 live tree 或累计 RSS 超预算即拒绝启动，绝不按端口/命令名猜测或杀未知资源。远端 Testcontainers 必须先确认 `org.testcontainers=true` 容器/卷为空；运行中记录可用内存与受控 tree 资源样本，run 后残留资源是 cleanup FAIL。只可停止本 run 的精确 process tree。

## 3. 适用边界与反例

### 2026-10-10 Dexter 补充：动态测试前全链日志与两轮对抗审查

进入动态测试之前，必须先把本次测试的整条链路补齐调试日志，再完成两轮 fresh 独立、只读、证伪式审查，查缺补漏，关闭可由源码确定的低级错误后才运行；切勿不经思考地不断来回往复重跑。

1. 全链按实际场景从受管入口、fixture/seed与身份/权限、UI动作或请求、生成客户端/协议、各实际owner/数据库或网络边界、异步结果与业务oracle，一直覆盖到资源清理和结果读回。只包含该场景真实经过的环节；不要求每个函数、纯value object或高频数据帧各打一条日志。
2. 日志先复用项目现有结构化、安全、可关联的入口；至少能够定位当前阶段、关联request/operation/session、开始/成功/拒绝/失败/超时/取消、耗时及资源释放结果。不得用raw payload、秘密、audit或exit code代替诊断；高频媒体/输入只记有界摘要、阶段与失败，沿本标准脱敏要求，不另建日志平台。
3. 第一轮沿整条实际源码调用链检查参数/身份/权限、时序/异步与fixture/oracle，以及日志能否把失败定位到边界；主agent重开源码确认finding并作最小修复。第二轮使用新的fresh只读审查者，核验修复并找同根遗漏，完整检查脚本/生产边界、业务断言和cleanup。两轮均在日志补齐后、动态运行前；缺日志或已确认低级错误未关闭，不进入动态。
4. 这是 `TEST_CHAIN_PREFLIGHT` 的两轮运行前源码审查，不是追加需求/详设的 DESIGN 轮次，不替代CP/6b对账、UI/testId准入或交付IMPLEMENTATION review，不产生环境或数据操作授权。已完成的审查只有覆盖同一完整链路、在日志补齐后的相关字节且无未关闭影响时才可计入；不以增加两张形式报告重复审阅无变化内容。
5. 第二轮后若仍有具体缺口，先做最小根因修复并只读复核受影响链路，不能把“两轮已做完”当成PASS。动态首败必须实际读日志，确定first failure、last known good和broken boundary；下一次只验证已改变的具体假设，先focused后必要回归。不得用反复全量重跑、延长timeout、魔法等待或放宽oracle代替思考。

本条的判定是源码与日志充分性的语义审查，`UNENFORCEABLE_BY_MACHINE`；检查清单即以上五项，不新增receipt、hook、台账或独立机器门。其设计落点为 implementation-design-template 的日志表，执行落点为 implementation-task-template 的 6c；具体批次详设/计划必须写出链路、日志owner/落点和两轮所在阶段。纯读取文档、静态编译/类型检查不需要启动动态环境来满足本条。

不要求为纯数据类、无执行边界的 value object 随意增加日志；也不允许为“看起来有日志”而记录业务秘密或制造高频噪声。是否需要诊断能力以可执行的 owner、脚本、网络/数据库边界、长运行、失败恢复或安全状态转换为有限分母。日志不替代 audit、用户反馈、owner readback、业务 PASS 或 cleanup PASS。

## 4. 当前立即适用的 P6-1 闭环

P6-1 的远端 Testcontainers runner 必须补齐运行期 heartbeat/phase/PID/manifest/log 回收；平台和运营的公开 OTP、认证与匿名密码恢复必须补齐安全结构化诊断、脱敏、可信 correlation/request context 与测试证据。该闭环先形成 implementation-facing amendment 和独立设计 review，再实施；不得将本裁决作为跳过详设或安全审查的理由。
