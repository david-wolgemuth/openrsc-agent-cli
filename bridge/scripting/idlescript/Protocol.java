package scripting.idlescript;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Minimal newline-delimited bridge protocol for the server-skeleton phase. */
public final class Protocol {
  private static final Pattern OP_PATTERN =
      Pattern.compile("\\\"op\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
  private static final Pattern SOURCE_PATTERN =
      Pattern.compile("\\\"source_b64\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");

  private Protocol() {}

  public static String echo(String frame) {
    return frame;
  }

  public static Request parse(String frame) {
    Matcher op = OP_PATTERN.matcher(frame);
    if (!op.find()) throw new IllegalArgumentException("request is missing op");
    String operation = op.group(1);
    if ("run".equals(operation)) {
      Matcher source = SOURCE_PATTERN.matcher(frame);
      if (!source.find()) throw new IllegalArgumentException("run request is missing source_b64");
      byte[] decoded = Base64.getDecoder().decode(source.group(1));
      return new Request(operation, new String(decoded, StandardCharsets.UTF_8));
    }
    return new Request(operation, null);
  }

  public static String success(Object value) {
    if (value == null) return "{\"ok\":true,\"result\":null}";
    return "{\"ok\":true,\"result\":\"" + escape(String.valueOf(value)) + "\"}";
  }

  public static String error(Throwable exception) {
    return "{\"ok\":false,\"error\":\"" + escape(exception.getMessage()) + "\"}";
  }

  private static String escape(String value) {
    if (value == null) return "";
    return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
  }

  public static final class Request {
    private final String operation;
    private final String source;

    private Request(String operation, String source) {
      this.operation = operation;
      this.source = source;
    }

    public String getOperation() {
      return operation;
    }

    public String getSource() {
      return source;
    }
  }
}
