// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OrganizationNodeUpdateRequestPhasesItem.Deserializer.class)
public record OrganizationNodeUpdateRequestPhasesItem(
    String name
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OrganizationNodeUpdateRequestPhasesItem> {
    @Override
    public OrganizationNodeUpdateRequestPhasesItem deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OrganizationNodeUpdateRequestPhasesItem) context.handleUnexpectedToken(OrganizationNodeUpdateRequestPhasesItem.class, parser);
      String name = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OrganizationNodeUpdateRequestPhasesItem.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OrganizationNodeUpdateRequestPhasesItem.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OrganizationNodeUpdateRequestPhasesItem.class, "property value is required");
        switch (property) {
          case "name" -> name = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OrganizationNodeUpdateRequestPhasesItem.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OrganizationNodeUpdateRequestPhasesItem.class, "object must end with END_OBJECT");
      if (name == null) return context.reportInputMismatch(OrganizationNodeUpdateRequestPhasesItem.class, "missing required property name");
      return new OrganizationNodeUpdateRequestPhasesItem(name);
    }
  }
}
