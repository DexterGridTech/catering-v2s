package com.catering.v2s.app.edge.terminal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.catering.v2s.app.edge.session.EdgeRequestContextArgumentResolver;
import com.catering.v2s.contract.application.ContractTaskReadService;
import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.BusinessCredential;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Outcome;
import com.catering.v2s.terminalbinding.api.TerminalCredentialVerificationApi.Verification;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class TerminalDataReadControllerTest {
    private static final String GROUP_KEY = "terminal-read-test";
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID STORE = UUID.randomUUID();
    private static final UUID TERMINAL = UUID.randomUUID();
    private static final String SECRET = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);

    @Test
    void mapsOwnerDatabaseFailureToTerminalDependencyUnavailable() throws Exception {
        TerminalCredentialVerificationApi credentials = mock(TerminalCredentialVerificationApi.class);
        BusinessEntityService entities = mock(BusinessEntityService.class);
        OperationsOrganizationTaskReadService organizationReads = mock(OperationsOrganizationTaskReadService.class);
        StoreServicePointOwnerApi servicePoints = mock(StoreServicePointOwnerApi.class);
        ContractTaskReadService contracts = mock(ContractTaskReadService.class);
        when(credentials.verifyBusinessCredential(any(BusinessCredential.class)))
                .thenReturn(new Verification(Outcome.VERIFIED, WORKSPACE, GROUP_KEY, STORE, TERMINAL, 1, 0,
                        "tdp-test-device"));
        when(organizationReads.store(WORKSPACE, GROUP_KEY, STORE))
                .thenThrow(new DataAccessResourceFailureException("fixture database unavailable"));

        TerminalDataReadController controller =
                new TerminalDataReadController(credentials, entities, organizationReads, servicePoints, contracts);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller)
                .setCustomArgumentResolvers(new EdgeRequestContextArgumentResolver())
                .build();

        mvc.perform(get("/api/terminal/group-workspaces/{group}/stores/{store}/basic", GROUP_KEY, STORE)
                        .header("Authorization", "Terminal 1." + SECRET)
                        .header("X-Terminal-Ref", TERMINAL))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value("PLATFORM_DEPENDENCY_UNAVAILABLE"));

        verify(credentials).verifyBusinessCredential(any(BusinessCredential.class));
        verify(organizationReads).store(WORKSPACE, GROUP_KEY, STORE);
    }
}
