package com.catering.v2s.extension.api;

import java.util.List;
public record ExtensionDefinitionReadback(String groupWorkspaceKey, String hostType, long version, long updatedAtEpochMillis, List<Field> fields) {
    public record Field(String fieldKey, String label, String fieldType, boolean required, List<String> options, String status, int displayOrder, String displaySuffix) {
    }
}
