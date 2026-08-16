package com.catering.v2s.platform.workspace.api;

import java.util.List;

/** Bounded owner readback for the platform workspace management task. */
public record WorkspaceAdministrationPage(
        List<WorkspaceAdministrationReadback> items,
        long page,
        long pageSize,
        long total,
        String sortKey,
        String sortDirection) {}
