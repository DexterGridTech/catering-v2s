package com.catering.v2s.app.edge.operations.businesschannel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.app.edge.generated.wire.BusinessChannelView;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BusinessChannelWireMapperTest {
    @Test
    void structuredStatusDimensionsAndBlockersAreMappedWithoutLegacyStopFields() {
        UUID channelRef = UUID.randomUUID();
        UUID templateRef = UUID.randomUUID();
        UUID ownerNodeRef = UUID.randomUUID();
        List<BusinessChannelReadback.StatusDimension> dimensions = List.of(
                new BusinessChannelReadback.StatusDimension(
                        "BUSINESS_CHANNEL_TEMPLATE", templateRef.toString(), "DISABLED"),
                new BusinessChannelReadback.StatusDimension("COLLABORATION_PROVIDER_PROFILE", "PROVIDER-A", "DISABLED"),
                new BusinessChannelReadback.StatusDimension("GROUP_WORKSPACE", "workspace-key", "DISABLED"));
        BusinessChannelReadback.Channel source = new BusinessChannelReadback.Channel(
                channelRef,
                templateRef,
                "PROJECT",
                ownerNodeRef.toString(),
                "CHANNEL-CODE",
                "Channel",
                null,
                "UNBOUND",
                "ENABLED",
                dimensions,
                dimensions,
                1L);

        BusinessChannelView wire = BusinessChannelWireMapper.channel(source);

        assertEquals(3, wire.statusDimensions().size());
        assertEquals(3, wire.blockers().size());
    }

    @Test
    void closedSetDisplayProjectionFailsClosedForUnknownAndRetiredValues() {
        UUID templateRef = UUID.randomUUID();
        UUID projectRef = UUID.randomUUID();
        BusinessChannelReadback.Template unknownAccess = new BusinessChannelReadback.Template(
                templateRef,
                projectRef,
                "Template",
                "TEMPLATE-CODE",
                "UNKNOWN",
                "PROJECT",
                "TAKEAWAY",
                null,
                null,
                null,
                0L,
                "ENABLED",
                List.of(),
                List.of(),
                1L);
        assertThrows(IllegalStateException.class, () -> BusinessChannelWireMapper.template(unknownAccess));

        BusinessChannelReadback.Template retiredStatus = new BusinessChannelReadback.Template(
                templateRef,
                projectRef,
                "Template",
                "TEMPLATE-CODE",
                "INTERNAL",
                "PROJECT",
                "TAKEAWAY",
                null,
                null,
                null,
                0L,
                "DRAFT",
                List.of(),
                List.of(),
                1L);
        assertThrows(IllegalStateException.class, () -> BusinessChannelWireMapper.template(retiredStatus));
    }
}
