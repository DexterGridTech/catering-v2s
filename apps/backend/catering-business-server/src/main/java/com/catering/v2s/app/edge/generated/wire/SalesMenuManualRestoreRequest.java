// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuManualRestoreRequest.Deserializer.class)
public record SalesMenuManualRestoreRequest(
    SalesMenuManualRestoreRequestTarget target,
    Boolean confirm,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuManualRestoreRequest> {
    @Override
    public SalesMenuManualRestoreRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuManualRestoreRequest) context.handleUnexpectedToken(SalesMenuManualRestoreRequest.class, parser);
      SalesMenuManualRestoreRequestTarget target = null;
      Boolean confirm = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuManualRestoreRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuManualRestoreRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuManualRestoreRequest.class, "property value is required");
        switch (property) {
          case "target" -> target = context.readValue(parser, SalesMenuManualRestoreRequestTarget.class);
          case "confirm" -> confirm = context.readValue(parser, Boolean.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuManualRestoreRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuManualRestoreRequest.class, "object must end with END_OBJECT");
      if (target == null) return context.reportInputMismatch(SalesMenuManualRestoreRequest.class, "missing required property target");
      if (confirm == null) return context.reportInputMismatch(SalesMenuManualRestoreRequest.class, "missing required property confirm");
      if (expectedVersion == null) return context.reportInputMismatch(SalesMenuManualRestoreRequest.class, "missing required property expectedVersion");
      return new SalesMenuManualRestoreRequest(target, confirm, expectedVersion);
    }
  }
}
