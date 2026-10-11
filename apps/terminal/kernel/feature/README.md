# Kernel feature 包边界

`kernel/feature` 下的 owner feature 包负责各自业务事实、command、actor、selector 与模块描述，不承载界面。当前示例范围包含 `sample-staff-session` 和 `sample-member-registry`；它们保持与 UI 解耦，只依赖契约所需的共享 kernel foundation。
