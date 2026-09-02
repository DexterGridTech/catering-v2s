# kernel.base.display-context handoff

状态：`IMPLEMENTATION_AUTHORIZED / TER_LOCAL_ONLY`。

本包当前交付的是 `displayRole` owner slice、四条 command、五个 actor、count-only
`DevicePort.getDisplayInfo` 使用、电源 bridge 以及其 TER-local 静态与 focused proof。
公开面、测试分母和最终运行输出以本批实施记录及新鲜命令为准；本文件不替代证据。

已知欠账与边界：

1. 没有 production `Runtime` stop/dispose，电源订阅生产释放依赖进程退出；`registerResource` 当前唯一 drain
   是 test-only `releaseRuntimeForTest`。该 release 只验证本地失活与 unsubscribe 调用发起，不构成生产 teardown。
2. 本模块不定义 `onApplicationReset`，reset 不重跑 install，不能借 reset 增加第二条订阅路径。
3. batch-1 默认 device adapter 不支持真实 display info，`VICE` 跨重启会按安全规则纠正为 `CHIEF`。
4. transport activation、Android/native adapter、生产 route context 可信性、角色变更留痕跨重启均未在本批证明。
5. 不做 workspace scoping、设备/Gradle、仓级 normal verify、DEV、seed、reset、browser L2、UAT 或部署。

后续 owner 读取本文件后，必须先重开需求、详设、实施计划、TR-01/TR-02/TR-04/TR-09/TR-10/TR-11、
项目记忆和当前源码。任何新增公开 API、端口方法、依赖边、role effect、`onApplicationReset` 或生产 teardown
都必须停机并重新获得相应授权。
