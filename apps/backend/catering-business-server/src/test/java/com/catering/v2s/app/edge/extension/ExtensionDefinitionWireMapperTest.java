package com.catering.v2s.app.edge.extension;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceStatus;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;
import java.util.List;
import org.junit.jupiter.api.Test;

class ExtensionDefinitionWireMapperTest {
    @Test
    void mapsWorkspaceDimensionBlockerAndFieldSelfStatusWithoutCollapsingThem() {
        ExtensionDefinitionReadback value = new ExtensionDefinitionReadback(
                "workspace-a",
                "STORE",
                3,
                42,
                List.of(
                        new ExtensionDefinitionReadback.Field(
                                "enabledField", "Enabled field", "TEXT", true, List.of(), "ENABLED", 0, null),
                        new ExtensionDefinitionReadback.Field(
                                "disabledField", "Disabled field", "TEXT", false, List.of(), "DISABLED", 1, null)),
                "DISABLED",
                List.of(new ExtensionDefinitionReadback.Blocker("WORKSPACE", "DISABLED")));

        var wire = ExtensionDefinitionWireMapper.wire(value);

        assertEquals(GroupWorkspaceStatus.DISABLED, wire.workspaceStatus());
        assertEquals(1, wire.blockers().size());
        assertEquals("WORKSPACE", wire.blockers().getFirst().type());
        assertEquals(GroupWorkspaceStatus.DISABLED, wire.blockers().getFirst().status());
        assertEquals("ENABLED", wire.definitions().get(0).status());
        assertEquals("DISABLED", wire.definitions().get(1).status());
    }
}
