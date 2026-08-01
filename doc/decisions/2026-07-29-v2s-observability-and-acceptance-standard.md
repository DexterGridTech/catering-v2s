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

## 3. 适用边界与反例

不要求为纯数据类、无执行边界的 value object 随意增加日志；也不允许为“看起来有日志”而记录业务秘密或制造高频噪声。是否需要诊断能力以可执行的 owner、脚本、网络/数据库边界、长运行、失败恢复或安全状态转换为有限分母。日志不替代 audit、用户反馈、owner readback、业务 PASS 或 cleanup PASS。

## 4. 当前立即适用的 P6-1 闭环

P6-1 的远端 Testcontainers runner 必须补齐运行期 heartbeat/phase/PID/manifest/log 回收；平台和运营的公开 OTP、认证与匿名密码恢复必须补齐安全结构化诊断、脱敏、可信 correlation/request context 与测试证据。该闭环先形成 implementation-facing amendment 和独立设计 review，再实施；不得将本裁决作为跳过详设或安全审查的理由。
