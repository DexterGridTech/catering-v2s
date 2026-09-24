// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OrganizationNodeCreateRequest.Deserializer.class)
public record OrganizationNodeCreateRequest(
    String code,
    String name,
    String notes,
    tools.jackson.databind.JsonNode extensionValues
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OrganizationNodeCreateRequest> {
    @Override
    public OrganizationNodeCreateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OrganizationNodeCreateRequest) context.handleUnexpectedToken(OrganizationNodeCreateRequest.class, parser);
      String code = null;
      String name = null;
      String notes = null;
      tools.jackson.databind.JsonNode extensionValues = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OrganizationNodeCreateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OrganizationNodeCreateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OrganizationNodeCreateRequest.class, "property value is required");
        switch (property) {
          case "code" -> code = context.readValue(parser, String.class);
          case "name" -> name = context.readValue(parser, String.class);
          case "notes" -> notes = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "extensionValues" -> extensionValues = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readTree(parser));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OrganizationNodeCreateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OrganizationNodeCreateRequest.class, "object must end with END_OBJECT");
      if (code == null) return context.reportInputMismatch(OrganizationNodeCreateRequest.class, "missing required property code");
      if (name == null) return context.reportInputMismatch(OrganizationNodeCreateRequest.class, "missing required property name");
      return new OrganizationNodeCreateRequest(code, name, notes, extensionValues);
    }
  }
}
