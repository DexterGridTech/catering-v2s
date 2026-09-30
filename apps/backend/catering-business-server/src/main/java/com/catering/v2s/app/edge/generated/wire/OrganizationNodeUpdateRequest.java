// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OrganizationNodeUpdateRequest.Deserializer.class)
public record OrganizationNodeUpdateRequest(
    String code,
    String name,
    String parentId,
    java.util.List<OrganizationNodeUpdateRequestPhasesItem> phases,
    String notes,
    Long expectedVersion,
    tools.jackson.databind.JsonNode extensionValues
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OrganizationNodeUpdateRequest> {
    @Override
    public OrganizationNodeUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OrganizationNodeUpdateRequest) context.handleUnexpectedToken(OrganizationNodeUpdateRequest.class, parser);
      String code = null;
      String name = null;
      String parentId = null;
      java.util.List<OrganizationNodeUpdateRequestPhasesItem> phases = null;
      String notes = null;
      Long expectedVersion = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "property value is required");
        switch (property) {
          case "code" -> code = context.readValue(parser, String.class);
          case "name" -> name = context.readValue(parser, String.class);
          case "parentId" -> parentId = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "phases" -> phases = context.readValue(parser, new tools.jackson.core.type.TypeReference<java.util.List<OrganizationNodeUpdateRequestPhasesItem>>() {});
          case "notes" -> notes = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "extensionValues" -> extensionValues = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "object must end with END_OBJECT");
      if (code == null) return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "missing required property code");
      if (name == null) return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "missing required property name");
      if (!seen.contains("parentId")) return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "missing required property parentId");
      if (phases == null) return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "missing required property phases");
      if (expectedVersion == null) return context.reportInputMismatch(OrganizationNodeUpdateRequest.class, "missing required property expectedVersion");
      return new OrganizationNodeUpdateRequest(code, name, parentId, phases, notes, expectedVersion, extensionValues);
    }
  }
}
