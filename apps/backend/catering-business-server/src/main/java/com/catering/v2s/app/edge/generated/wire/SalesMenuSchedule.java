// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuSchedule.Deserializer.class)
public record SalesMenuSchedule(
    String kind,
    String startLocalTime,
    String endLocalTime
) {

  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuSchedule> {
    @Override
    public SalesMenuSchedule deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuSchedule) context.handleUnexpectedToken(SalesMenuSchedule.class, parser);
      String kind = null;
      String startLocalTime = null;
      String endLocalTime = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuSchedule.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuSchedule.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuSchedule.class, "property value is required");
        switch (property) {
          case "kind" -> kind = context.readValue(parser, String.class);
          case "startLocalTime" -> startLocalTime = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          case "endLocalTime" -> endLocalTime = (parser.currentToken() == tools.jackson.core.JsonToken.VALUE_NULL ? null : context.readValue(parser, String.class));
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuSchedule.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuSchedule.class, "object must end with END_OBJECT");
      if (kind == null) return context.reportInputMismatch(SalesMenuSchedule.class, "missing required property kind");
      if (!seen.contains("startLocalTime")) return context.reportInputMismatch(SalesMenuSchedule.class, "missing required property startLocalTime");
      if (!seen.contains("endLocalTime")) return context.reportInputMismatch(SalesMenuSchedule.class, "missing required property endLocalTime");
      return new SalesMenuSchedule(kind, startLocalTime, endLocalTime);
    }
  }
}
