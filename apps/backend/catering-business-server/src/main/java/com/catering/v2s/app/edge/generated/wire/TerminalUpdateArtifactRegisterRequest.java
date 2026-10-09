// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

@tools.jackson.databind.annotation.JsonDeserialize(using = TerminalUpdateArtifactRegisterRequest.Deserializer.class)
public record TerminalUpdateArtifactRegisterRequest(
    java.util.UUID stageRef,
    String stageBindGrant,
    String kind,
    java.util.UUID minimumFullArtifactRef
) {


  public static final class Deserializer extends tools.jackson.databind.ValueDeserializer<TerminalUpdateArtifactRegisterRequest> {
    @Override
    public TerminalUpdateArtifactRegisterRequest deserialize(tools.jackson.core.JsonParser parser, tools.jackson.databind.DeserializationContext context)
            throws tools.jackson.core.JacksonException {
      if (!parser.isExpectedStartObjectToken())
        return (TerminalUpdateArtifactRegisterRequest) context.handleUnexpectedToken(TerminalUpdateArtifactRegisterRequest.class, parser);
      java.util.UUID stageRef = null;
      String stageBindGrant = null;
      String kind = null;
      java.util.UUID minimumFullArtifactRef = null;
      java.util.Set<String> seen = new java.util.HashSet<>();
      tools.jackson.core.JsonToken token = parser.nextToken();
      while (token != null && token != tools.jackson.core.JsonToken.END_OBJECT) {
        if (token != tools.jackson.core.JsonToken.PROPERTY_NAME)
          return context.reportInputMismatch(TerminalUpdateArtifactRegisterRequest.class, "object property name is required");
        String property = parser.currentName();
        if (!seen.add(property))
          return context.reportInputMismatch(TerminalUpdateArtifactRegisterRequest.class, "duplicate property " + property);
        token = parser.nextToken();
        if (token == null)
          return context.reportInputMismatch(TerminalUpdateArtifactRegisterRequest.class, "property value is required");
        switch (property) {
          case "stageRef" -> stageRef = context.readValue(parser, java.util.UUID.class);
          case "stageBindGrant" -> stageBindGrant = context.readValue(parser, String.class);
          case "kind" -> kind = context.readValue(parser, String.class);
          case "minimumFullArtifactRef" -> minimumFullArtifactRef = context.readValue(parser, java.util.UUID.class);
          default -> {
            parser.skipChildren();
            return context.reportInputMismatch(TerminalUpdateArtifactRegisterRequest.class, "unknown property " + property);
          }
        }
        token = parser.nextToken();
      }
      if (token == null)
        return context.reportInputMismatch(TerminalUpdateArtifactRegisterRequest.class, "object must end with END_OBJECT");
      if (stageRef == null) return context.reportInputMismatch(TerminalUpdateArtifactRegisterRequest.class, "missing required property stageRef");
      if (stageBindGrant == null) return context.reportInputMismatch(TerminalUpdateArtifactRegisterRequest.class, "missing required property stageBindGrant");
      if (kind == null) return context.reportInputMismatch(TerminalUpdateArtifactRegisterRequest.class, "missing required property kind");
      return new TerminalUpdateArtifactRegisterRequest(stageRef, stageBindGrant, kind, minimumFullArtifactRef);
    }
  }
}
