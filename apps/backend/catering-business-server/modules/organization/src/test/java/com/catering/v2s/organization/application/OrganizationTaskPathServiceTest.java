package com.catering.v2s.organization.application;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup.TaskPath;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OrganizationTaskPathServiceTest {
    private final OrganizationTaskPathService paths = new OrganizationTaskPathService(null, null);
    private final UUID workspace = UUID.randomUUID();
    private final UUID group = UUID.randomUUID();
    private final UUID region = UUID.randomUUID();
    private final UUID project = UUID.randomUUID();
    private final UUID headCompany = UUID.randomUUID();
    private final UUID store = UUID.randomUUID();

    @Test
    void permitsEachPgIamTargetOnlyForItsRealOwnerScopeAndAncestor() {
        TaskPath groupTarget = new TaskPath("GROUP", group, List.of(group), "group");
        TaskPath regionTarget = new TaskPath("REGION", region, List.of(group, region), "region");
        TaskPath projectTarget = new TaskPath("PROJECT", project, List.of(group, region, project), "project");
        TaskPath headCompanyTarget = new TaskPath("HEAD_COMPANY", headCompany, List.of(group, headCompany), "head");
        TaskPath storeTarget = new TaskPath("STORE", store, List.of(group, region, project, store), "store");

        assertTrue(allowed("GROUP", group, groupTarget));
        assertTrue(allowed("GROUP", group, regionTarget));
        assertTrue(allowed("REGION", region, projectTarget));
        assertTrue(allowed("PROJECT", project, storeTarget));
        assertTrue(allowed("HEAD_COMPANY", headCompany, headCompanyTarget));
        assertTrue(allowed("STORE", store, storeTarget));

        assertFalse(allowed("REGION", UUID.randomUUID(), projectTarget));
        assertFalse(allowed("PROJECT", project, regionTarget));
        assertFalse(allowed("HEAD_COMPANY", headCompany, storeTarget));
        assertFalse(allowed("STORE", store, headCompanyTarget));
        assertFalse(allowed("STORE", store, new TaskPath("STORE", store, List.of(group, region, project), "forged ancestor")));
    }

    private boolean allowed(String assignmentType, UUID assignmentId, TaskPath target) {
        return paths.isScopeAllowed(workspace, "scope-test", assignmentType, assignmentId, target);
    }
}
