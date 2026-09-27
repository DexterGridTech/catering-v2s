package com.catering.v2s.audit.contract;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AuditEventTest {
    @Test
    void keepsStructuredTargetActorAndChangesBounded() {
        // spotless:off
        AuditChange change = new AuditChange("name", "名称", AuditValueState.VALUE, "旧名称",
            AuditValueState.VALUE, "新名称");
        // spotless:on
        AuditEvent event = new AuditEvent(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "workspace",
                new AuditTarget("STORE_SERVICE_POINT", "point-1"),
                AuditActor.system(),
                "UPDATED",
                1L,
                List.of(change));

        assertEquals("STORE_SERVICE_POINT", event.target().entityType());
        assertEquals("系统", event.actor().displaySnapshot());
        assertEquals(List.of(change), event.changes());
    }

    @Test
    void rejectsMissingRequiredEventFacts() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new AuditEvent(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "workspace",
                        new AuditTarget("STORE", "store-1"),
                        AuditActor.system(),
                        "UPDATED",
                        -1L,
                        List.of()));
    }

    @Test
    void terminalDeviceAuditActorHasNoIdAndUsesItsFixedDisplay() {
        AuditActor actor = AuditActor.terminalDevice();

        assertEquals("TERMINAL_DEVICE", actor.actorType());
        assertEquals(null, actor.actorId());
        assertEquals("终端设备", actor.displaySnapshot());
        assertThrows(IllegalArgumentException.class, () -> new AuditActor("TERMINAL_DEVICE", null, "device"));
    }
}
