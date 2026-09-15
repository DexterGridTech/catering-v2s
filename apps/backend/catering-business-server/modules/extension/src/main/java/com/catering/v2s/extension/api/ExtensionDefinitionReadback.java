package com.catering.v2s.extension.api;

import java.util.List;

public record ExtensionDefinitionReadback(
        String groupWorkspaceKey,
        String hostType,
        long version,
        long updatedAtEpochMillis,
        List<Field> fields,
        String workspaceStatus,
        List<Blocker> blockers) {
    public record Blocker(String type, String status) {}

    public record Field(
            String fieldKey,
            String label,
            String fieldType,
            Boolean listDisplay,
            Boolean searchable,
            boolean required,
            List<String> options,
            String status,
            int displayOrder,
            String displaySuffix) {
        public Field(
                String fieldKey,
                String label,
                String fieldType,
                boolean required,
                List<String> options,
                String status,
                int displayOrder,
                String displaySuffix) {
            this(fieldKey, label, fieldType, false, false, required, options, status, displayOrder, displaySuffix);
        }
    }
}
