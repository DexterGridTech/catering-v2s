// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OrganizationNodeStatusTransitionRequest.Deserializer.class)
public record OrganizationNodeStatusTransitionRequest(
    String targetStatus,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OrganizationNodeStatusTransitionRequest> {
    @Override
    public OrganizationNodeStatusTransitionRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OrganizationNodeStatusTransitionRequest) context.handleUnexpectedToken(OrganizationNodeStatusTransitionRequest.class, parser);
      String targetStatus = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OrganizationNodeStatusTransitionRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OrganizationNodeStatusTransitionRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OrganizationNodeStatusTransitionRequest.class, "property value is required");
        switch (property) {
          case "targetStatus" -> targetStatus = context.readValue(parser, String.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OrganizationNodeStatusTransitionRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OrganizationNodeStatusTransitionRequest.class, "object must end with END_OBJECT");
      if (targetStatus == null) return context.reportInputMismatch(OrganizationNodeStatusTransitionRequest.class, "missing required property targetStatus");
      if (expectedVersion == null) return context.reportInputMismatch(OrganizationNodeStatusTransitionRequest.class, "missing required property expectedVersion");
      return new OrganizationNodeStatusTransitionRequest(targetStatus, expectedVersion);
    }
  }
}
