// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = OrganizationStoreStatusRequest.Deserializer.class)
public record OrganizationStoreStatusRequest(
    OrganizationStoreStatus targetStatus,
    Long expectedVersion
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<OrganizationStoreStatusRequest> {
    @Override
    public OrganizationStoreStatusRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (OrganizationStoreStatusRequest) context.handleUnexpectedToken(OrganizationStoreStatusRequest.class, parser);
      OrganizationStoreStatus targetStatus = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(OrganizationStoreStatusRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(OrganizationStoreStatusRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(OrganizationStoreStatusRequest.class, "property value is required");
        switch (property) {
          case "targetStatus" -> targetStatus = context.readValue(parser, OrganizationStoreStatus.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(OrganizationStoreStatusRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(OrganizationStoreStatusRequest.class, "object must end with END_OBJECT");
      if (targetStatus == null) return context.reportInputMismatch(OrganizationStoreStatusRequest.class, "missing required property targetStatus");
      if (expectedVersion == null) return context.reportInputMismatch(OrganizationStoreStatusRequest.class, "missing required property expectedVersion");
      return new OrganizationStoreStatusRequest(targetStatus, expectedVersion);
    }
  }
}
