package com.catering.v2s.platform.workspace.domain;

public record GroupWorkspace(
        long id, String groupWorkspaceKey, String name, GroupWorkspaceStatus status, long revision) {}
