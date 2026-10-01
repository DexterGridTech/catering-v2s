// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = SalesMenuScheduleUpdateRequest.Deserializer.class)
public record SalesMenuScheduleUpdateRequest(
    SalesMenuSchedule schedule,
    Long expectedVersion
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<SalesMenuScheduleUpdateRequest> {
    @Override
    public SalesMenuScheduleUpdateRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (SalesMenuScheduleUpdateRequest) context.handleUnexpectedToken(SalesMenuScheduleUpdateRequest.class, parser);
      SalesMenuSchedule schedule = null;
      Long expectedVersion = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(SalesMenuScheduleUpdateRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(SalesMenuScheduleUpdateRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(SalesMenuScheduleUpdateRequest.class, "property value is required");
        switch (property) {
          case "schedule" -> schedule = context.readValue(parser, SalesMenuSchedule.class);
          case "expectedVersion" -> expectedVersion = context.readValue(parser, Long.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(SalesMenuScheduleUpdateRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(SalesMenuScheduleUpdateRequest.class, "object must end with END_OBJECT");
      if (schedule == null) return context.reportInputMismatch(SalesMenuScheduleUpdateRequest.class, "missing required property schedule");
      if (expectedVersion == null) return context.reportInputMismatch(SalesMenuScheduleUpdateRequest.class, "missing required property expectedVersion");
      return new SalesMenuScheduleUpdateRequest(schedule, expectedVersion);
    }
  }
}
