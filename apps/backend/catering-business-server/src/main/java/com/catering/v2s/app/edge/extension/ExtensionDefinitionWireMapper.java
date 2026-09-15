package com.catering.v2s.app.edge.extension;

import com.catering.v2s.app.edge.generated.wire.ExtensionDefinition;
import com.catering.v2s.app.edge.generated.wire.ExtensionDefinitionBlocker;
import com.catering.v2s.app.edge.generated.wire.ExtensionDefinitionDefinitionsItem;
import com.catering.v2s.app.edge.generated.wire.ExtensionEntityType;
import com.catering.v2s.app.edge.generated.wire.ExtensionFieldType;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceStatus;
import com.catering.v2s.extension.api.ExtensionDefinitionReadback;

/** Boundary-only mapping from the extension owner readback to the generated edge wire. */
public final class ExtensionDefinitionWireMapper {
    private ExtensionDefinitionWireMapper() {}

    public static ExtensionDefinition wire(ExtensionDefinitionReadback value) {
        return new ExtensionDefinition(
                value.groupWorkspaceKey(),
                ExtensionEntityType.valueOf(value.hostType()),
                value.fields().stream()
                        .map(ExtensionDefinitionWireMapper::field)
                        .toList(),
                value.version(),
                value.updatedAtEpochMillis(),
                GroupWorkspaceStatus.valueOf(value.workspaceStatus()),
                value.blockers().stream()
                        .map(ExtensionDefinitionWireMapper::blocker)
                        .toList());
    }

    private static ExtensionDefinitionBlocker blocker(ExtensionDefinitionReadback.Blocker value) {
        return new ExtensionDefinitionBlocker(value.type(), GroupWorkspaceStatus.valueOf(value.status()));
    }

    private static ExtensionDefinitionDefinitionsItem field(ExtensionDefinitionReadback.Field value) {
        return new ExtensionDefinitionDefinitionsItem(
                value.fieldKey(),
                value.label(),
                ExtensionFieldType.valueOf(value.fieldType()),
                value.listDisplay(),
                value.searchable(),
                value.required(),
                value.options(),
                value.status(),
                (long) value.displayOrder(),
                value.displaySuffix());
    }
}
