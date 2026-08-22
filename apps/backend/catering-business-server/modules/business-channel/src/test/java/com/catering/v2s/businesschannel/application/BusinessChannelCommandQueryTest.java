package com.catering.v2s.businesschannel.application;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class BusinessChannelCommandQueryTest {
    @Test
    void commandChannelReadCarriesTemplateFactsInTheSameOwnerRead() {
        String sql = BusinessChannelOwnerService.channelCommandSelect("WHERE c.channel_ref=? FOR UPDATE");

        assertTrue(sql.contains("t.project_ref AS template_project_ref"));
        assertTrue(sql.contains("t.provider_code AS template_provider_code"));
        assertTrue(sql.endsWith("WHERE c.channel_ref=? FOR UPDATE"));
    }
}
