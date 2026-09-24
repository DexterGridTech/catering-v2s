// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = PlatformAdminStatusTransitionRequest.Deserializer.class)
public record PlatformAdminStatusTransitionRequest(
    PlatformAdminStatus targetStatus,
    Long expectedVersion,
    String idempotencyKey
) {
  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<PlatformAdminStatusTransitionRequest> {
    @Override
    public PlatformAdminStatusTransitionRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (PlatformAdminStatusTransitionRequest) context.handleUnexpectedToken(PlatformAdminStatusTransitionRequest.class, parser);
      PlatformAdminStatus targetStatus = null;
      Long expectedVersion = null;
      String idempotencyKey = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(PlatformAdminStatusTransitionRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(PlatformAdminStatusTransitionRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(PlatformAdminStatusTransitionRequest.class, "property value is required");
        switch (property) {
          case "targetStatus" -> targetStatus = context.readValue(parser, PlatformAdminStatus.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          case "idempotencyKey" -> idempotencyKey = context.readValue(parser, String.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(PlatformAdminStatusTransitionRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(PlatformAdminStatusTransitionRequest.class, "object must end with END_OBJECT");
      if (targetStatus == null) return context.reportInputMismatch(PlatformAdminStatusTransitionRequest.class, "missing required property targetStatus");
      if (expectedVersion == null) return context.reportInputMismatch(PlatformAdminStatusTransitionRequest.class, "missing required property expectedVersion");
      if (idempotencyKey == null) return context.reportInputMismatch(PlatformAdminStatusTransitionRequest.class, "missing required property idempotencyKey");
      return new PlatformAdminStatusTransitionRequest(targetStatus, expectedVersion, idempotencyKey);
    }
  }
}
