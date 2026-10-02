# 批次三 R-14 resident feasibility probe 记录

## 结论与证据边界

结论：`RESIDENT_PROBE_PASS_WITH_BOUNDS`。在远端完整批次二 DEV 服务运行期间，以官方 Apache Doris `apache/doris:all-in-one-4.1.3` 缓存镜像启动隔离容器，health、SQL、持久挂载停止/重启读回、同机资源采样和受管 cleanup 均通过。本次不接入 DEV 业务流量，不修改正式 DEV 拓扑，也不部署常驻 Doris。

本结果关闭批次三详设的 R-14 resident feasibility 前置，范围限于本次远端主机与当前启动字节。它是短时单次资源样本，没有设置 Doris cgroup memory 上限，不代表长期运行、峰值写入或容量 SLO；Stream Load、权限、reset 和跨节点业务仍待批次三实施期验证。

## 受管 DEV 生命周期

- 启动前 `.runtime/r5/run-manifest.json` 不存在，资源门没有发现活动受管进程；DEV 原先未运行。
- 通过 `node scripts/dev/r5-dev-runner.mjs start` 启动，DEV run id：`r5-dev-1790872488339-68583-5d7e0ef1-1397-4e3d-b119-e0223deef049`。结果 `R5_DEV_START=PASS`，包含远端 Java、三个 TDS、HAProxy、两个本机 Vite 和受管 tunnel。
- 探针完成后通过 `node scripts/dev/r5-dev-runner.mjs stop` 停止该 run。terminal manifest 记录 local process、remote Java、三 TDS、HAProxy stop 均 `PASS/STOPPED`，最终 cleanup `PASS`。
- 结束后 DEV run manifest 不存在；`scripts/env/check-runtime-resource-budget .runtime` 返回 `STATUS=PASS`、`LIVE_MANAGED_PROCESSES=0`。

## 有效探针

| 字段 | 结果 |
|---|---|
| run id | `r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5` |
| UTC 时间 | 2026-10-01 16:39:38.089 至 16:40:48.295 |
| DEV run id | `r5-dev-1790872488339-68583-5d7e0ef1-1397-4e3d-b119-e0223deef049` |
| 远端主机 / boot id | `catering-remote-dev` / `b37e1fe3-4e4b-4459-9f5c-7620f3f26063` |
| Docker | 29.1.3；主机报告内存 32,155,267,072 B（约 29.95 GiB） |
| Doris 镜像 | `apache/doris:all-in-one-4.1.3`；缓存命中；image id `sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609`；repo digest `apache/doris@sha256:82a5cabc7900ebcd3d080412d636c0cebd6602799fffe2605c652b2ea7d42609` |
| 网络与数据 | 9030 仅发布到远端 loopback `127.0.0.1:29030`；FE metadata 与 BE storage 使用本 run 独立临时 bind mount |
| 启动健康 | 初次与重启后均在第 16 次 2 秒轮询达到 image healthcheck；日志计时分别为 31 秒 |
| SQL / 持久化 | 建库建表、写入随机 marker、读取成功；graceful stop 后启动同一容器与挂载，health 再次通过，marker 读回一致 |
| host 资源 | 8 CPU；Doris 启动前 MemAvailable 20,172 MiB、磁盘可用 6,327 MiB；Doris健康后可用内存 18,530 MiB、磁盘可用 6,242 MiB；重启读回后 MemAvailable 18,610 MiB、磁盘可用 6,233 MiB |
| Doris 内存 | Docker stats 健康后约 1.601 GiB，重启读回后约 1.53 GiB；`HostConfig.Memory=0`，即未设置容器内存上限 |
| 业务 / cleanup | `business=NOT_APPLICABLE`；`feasibility=PASS`；`cleanup=PASS`；探针标签容器数 0、临时目录已删除、官方镜像缓存保留 |

原始材料：

- manifest：`.runtime/r5/evidence/doris-resident-feasibility/r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5/run-manifest.json`
- transcript：`.runtime/r5/evidence/doris-resident-feasibility/r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5/probe.log`
- 执行时探针源 SHA-256：`b165e2eb639d7df1f0ca1f8c7950e7e6f72ff710d575947d25a3b9b00a3a2707`
- 原始 transcript SHA-256：`dcd937eeff206ef7e3ed453c9a126cf15e018b9fbad5abcb8ede24877caf619c`

manifest 中容器 ID与 PID/startTicks 曾因本地 delimited-row 投影下标错位而记录错误。未修改 transcript 或远端事实；依据 transcript 中带验证的 container ID、PID、startTicks 与 boot id 修正 manifest 派生字段，并追加 `evidenceCorrection`，记录修正前值、原始 transcript SHA-256、执行时源 SHA-256和修正后投影代码 SHA-256。修正后的值为 container `b30df66d8e50aa6a0628911aa1b33ef8924503322ccbaa21dcf34009b752c2da`，PID `1966168`、startTicks `109840695`、同一 boot id。当前投影实现增加了列绑定 self-test；远端操作代码没有随该投影修正改变。

## 首败与根因处置

所有探针尝试均保留独立 manifest 与 transcript；只有第四次作为有效 R-14 证据。

1. `r5-doris-feasibility-1790872605171-70499-6cf5ef29-b971-4214-88d8-66c4a0fbf398`：身份比对把 probe 的临时 run/root 与 DEV-owned HAProxy 的 run/root 混为一体，在 Doris 创建前拒绝；cleanup PASS。根因是跨 owner 身份字段错误；改为分别用 DEV runId、DEV remoteRoot 与 probe runId、probe root。
2. `r5-doris-feasibility-1790872652518-70869-914cd808-4ac0-4400-a4fb-c353cd27c679`：第一次只分离了 root，仍错误拿 probe runId 比对 DEV HAProxy runId；同一边界第二次失败，cleanup PASS。随后修复两字段绑定，并将两项加入 self-test。
3. `r5-doris-feasibility-1790872686115-71168-add95cdd-197f-43dd-9e52-588c4bd1a4b6`：Doris 整体运行与持久化读回表面 PASS，但 transcript 有 `probePort` 未绑定错误，说明端口预检拼写错误、未 fail closed；因此不作为有效证据。cleanup PASS。随后修正为 `probe_port`，加入检查拼写的 self-test；并修正本地事实列投影的 off-by-one，加入 PID/container 字段断言。
4. 第四次为上表有效 run。其 stderr 为空，端口预检无错误，identity、health、SQL、重启读回与 cleanup 均 PASS。

最后的本地验证：`node --check scripts/dev/r5-doris-resident-feasibility.mjs` 与 `node scripts/dev/r5-doris-resident-feasibility.mjs --self-test` 均通过；self-test 覆盖身份 root/runId 绑定、端口预检变量及事实列索引。没有运行 `scripts/verify`、backend-acceptance、DEV业务验收、reset、seed、L2、UAT或部署。

## 状态

当前字节上的最新运行：resident feasibility run `r5-doris-feasibility-1790872778086-71714-0ff1e0ca-c53f-4352-aac4-448238ff3bc5`，2026-10-01 16:39:38–16:40:48 UTC，远端可行性与cleanup PASS。执行时源 SHA 与当前源 SHA仅因本地manifest事实投影/自测修正不同；受管远端操作段未变，修正已由self-test验证。

最后一次通过：同一 run，同一host与DEV run id；在上述限定范围内复用，不把这一结果升级为Stream Load、长期容量或业务验收通过。
