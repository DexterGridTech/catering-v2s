// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuManualRestoreRequestTarget.Deserializer.class)
public record SalesMenuManualRestoreRequestTarget(
    String targetKind,
    java.util.UUID targetRef
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuManualRestoreRequestTarget> {
    @Override
    public SalesMenuManualRestoreRequestTarget deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuManualRestoreRequestTarget) context.handleUnexpectedToken(SalesMenuManualRestoreRequestTarget.class, parser);
      String targetKind = null;
      java.util.UUID targetRef = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuManualRestoreRequestTarget.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuManualRestoreRequestTarget.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuManualRestoreRequestTarget.class, "property value is required");
        switch (property) {
          case "targetKind" -> targetKind = context.readValue(parser, String.class);
          case "targetRef" -> targetRef = context.readValue(parser, java.util.UUID.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuManualRestoreRequestTarget.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuManualRestoreRequestTarget.class, "object must end with END_OBJECT");
      if (targetKind == null) return context.reportInputMismatch(SalesMenuManualRestoreRequestTarget.class, "missing required property targetKind");
      if (targetRef == null) return context.reportInputMismatch(SalesMenuManualRestoreRequestTarget.class, "missing required property targetRef");
      return new SalesMenuManualRestoreRequestTarget(targetKind, targetRef);
    }
  }
}
